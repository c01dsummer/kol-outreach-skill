import { readFileSync, existsSync, lstatSync } from 'node:fs'
import { mkdirDurable, writeFileAtomic } from './atomic.js'
import { basename, join } from 'node:path'
import type { TaskState, Creator, EnrichmentState, MemoryStatus } from './types.js'
import { readCostDocument, stringifyCostJson } from './cost-json.js'
import type { CostSnapshot } from './cost-ledger.js'
import { ReviewInputError } from './review.js'

/**
 * D29.a：新任务的目录由产品名拼成、建在 `output/` 底下（下面的 `taskDir`）。这三种字符拼不成一层目录名：
 * `/` 在哪儿都是路径分隔符（`../x` 会落到 `output/` 以外），`\` 在 Windows 上是，NUL 放不进文件名。
 * 只由点组成的产品名不算 —— 时间戳接在它后面，`..-<时间戳>` 不是上一级（D29.b）
 */
const DIR_BREAKERS: readonly (readonly [string, string])[] = [['/', '/'], ['\\', '\\'], ['\u0000', 'NUL（U+0000）']]
export const productDirProblem = (product: string): string | undefined => {
  const found = DIR_BREAKERS.filter(([c]) => product.includes(c)).map(([, name]) => name)
  return found.length ? `含 ${found.join('、')} —— 它要拼成 output/ 底下的一层任务目录名，这几个字符会让目录落到别处或建不出来` : undefined
}

export function taskDir(product: string, timestamp?: string): string {
  const ts = timestamp ?? new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  return join('output', `${product}-${ts}`)
}

/**
 * 任务状态文件落在哪 —— **全仓库只此一份**。
 *
 * 这个名字原先在四处各拼各的：读、写、`collect --resume` 的存在性检查、
 * `enrich` 的存在性检查。改一处不改另一处时**没有任何东西会报错** ——
 * 存在性检查问的是一个文件，读写落在另一个，而两边各自都成立。
 *
 * ADR-45 的追记还点出更远的一层：ADR-47 那道「改名前再比一次盘上还是不是
 * 读到的那份」会去比**另一个文件，而且比得通过**。**那道比对主干上没有** ——
 * D4 现在明写并发不保证（ADR-66），所以今天坏的不是它；它按 ADR-55 的重启
 * 条件回来时，坏的才是它。写在这里是为了那一天不必重新想一遍。
 *
 * 合成一份之所以有效，正是因为它不依赖谁记得改全。
 */
export const taskFile = (dir: string): string => join(dir, 'task.json')

export function loadTask(dir: string): TaskState {
  return readCostDocument<TaskState>(readFileSync(taskFile(dir), 'utf8'))
}

export function saveTask(dir: string, state: TaskState): void {
  mkdirDurable(dir)
  state.updated_at = new Date().toISOString()
  writeFileAtomic(taskFile(dir), stringifyCostJson(state))
}

/** D14.g：只更新既有任务的费用，业务进度与根预算沿用盘上原值。 */
export function saveCostCheckpoint(dir: string, snapshot: CostSnapshot): void {
  const stored = loadTask(dir)
  stored.cost_ledger = snapshot.cost_ledger
  stored.requests = snapshot.requests
  saveTask(dir, stored)
}

export function loadCreators(dir: string): Creator[] {
  const p = join(dir, 'creators.json')
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []
}

function readOptionalReviewCreators(file: string): Creator[] | undefined {
  try { lstatSync(file) }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return undefined
    throw new ReviewInputError([`${file} 无法检查：${String(error)}`])
  }
  let creators: unknown
  try {
    creators = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(creators)) throw new Error('名单必须是数组')
  } catch (error) { throw new ReviewInputError([`${file} 无法读入名单：${String(error)}`]) }
  const problems = creators.flatMap((creator, index) => recordShapeProblems(file, index, creator))
  if (problems.length) throw new ReviewInputError(problems)
  return creators as Creator[]
}

/** 原值按 JSON 写法给出，过长截短；嵌套深到印不出时照直说（ADR-136 那类栈溢出）。 */
const shown = (value: unknown): string => {
  let text: string
  try { text = JSON.stringify(value) } catch { return '一个嵌套太深、印不出来的值' }
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * D21.t：名单被手改坏时，在读入处就指出是哪个文件、第几条、哪个字段 ——
 * 不然它要到后面的同人识别、打分里才以 `toLowerCase is not a function` 一类的话崩掉。
 * 只查会崩或会错的这几种（逐字段试探 render 得出，ADR-192）；其余字段的类型不在此查。
 */
function recordShapeProblems(file: string, index: number, creator: unknown): string[] {
  const at = `${file} 第 ${index + 1} 条`
  if (!isRecord(creator)) return [`${at}不是一条记录（读到 ${shown(creator)}），应是一个对象；改正或删掉这条后再跑`]
  const who = typeof creator.platform === 'string' && typeof creator.handle === 'string'
    ? `（platform ${shown(creator.platform)}，handle ${shown(creator.handle)}）` : ''
  const wrong = (field: string, expected: string) => {
    const value = creator[field]
    return `${at}${who}的 ${field} ${value === undefined ? '缺席' : `是 ${shown(value)}`}，应是${expected}；改正这条后再跑`
  }
  const problems: string[] = []
  for (const field of ['platform', 'handle']) if (typeof creator[field] !== 'string') problems.push(wrong(field, '字符串'))
  const links = creator.bio_links
  if (!Array.isArray(links) || !links.every(link => typeof link === 'string')) problems.push(wrong('bio_links', '字符串数组（没有外链时写 []）'))
  const posts = creator.recent_posts
  if (posts !== undefined && posts !== null && (!Array.isArray(posts) || !posts.every(isRecord)))
    problems.push(wrong('recent_posts', '作品对象的数组（未查询时删掉这个字段）'))
  const sources = creator.discovery_sources
  if (sources !== undefined && sources !== null && (!Array.isArray(sources) || !sources.every(isRecord)))
    problems.push(wrong('discovery_sources', '来源对象的数组（来源未知时删掉这个字段）'))
  return problems
}

/** D21/D23：只读原名单与累加器；只有确认路径缺席才采用旧名单 clone。 */
export function loadReviewCreatorInputs(dir: string): {
  previous: Creator[]; raw: Creator[]; rawPresent: boolean
} {
  // 两个文件各自读完再一起报，用户改一次就能把两处都改对
  const problems: string[] = []
  const read = (file: string): Creator[] | undefined => {
    try { return readOptionalReviewCreators(file) }
    catch (error) { if (!(error instanceof ReviewInputError)) throw error; problems.push(...error.problems) }
  }
  const before = read(join(dir, 'creators.json')), raw = read(join(dir, RAW))
  if (problems.length) throw new ReviewInputError(problems)
  const previous = before ?? []
  return { previous, raw: raw ?? structuredClone(previous), rawPresent: raw !== undefined }
}

export function saveCreators(dir: string, creators: Creator[]): void {
  mkdirDurable(dir)
  writeFileAtomic(join(dir, 'creators.json'), JSON.stringify(creators, null, 2))
}

/**
 * 名单和它的去重状态一起落盘。
 *
 * 两个文件、两次写入，中间被打断是可能的，而**哪个先写都不安全** ——
 * 安全与否取决于状态往哪个方向变（ADR-41）：
 *
 * | 状态怎么变 | 名单先写 | 状态先写 |
 * |---|---|---|
 * | `ok` → `unreadable_ignored` | 未去重的新名单 + 说已去重的旧状态 ✗ | 安全 |
 * | `unreadable_ignored` → `ok` | 安全 | 未去重的旧名单 + 说已去重的新状态 ✗ |
 *
 * 两种坏法一模一样：报告压掉警告，把打扰过、已拉黑的人当成已去重交付。
 *
 * 所以**不选顺序，分三步**：先把断言撤成「无从确认」，再换名单，最后才断言。
 * 任何一步被打断，盘上留下的都是一个不做肯定断言的状态 —— 报告会警告，
 * 用户重跑一次。**肯定的断言永远最后写，而且只在它描述的东西已经落盘之后。**
 *
 * 每一步自己是整体替换（`atomic.ts`，写到一半被杀不会留下截断的文件）；
 * 两个采集同时写同一个目录时的交错，按 D4 当前不保证（ADR-66）。
 */
export function persistListAndStatus(
  dir: string, state: TaskState, creators: Creator[], status: MemoryStatus,
): void {
  // 一、撤掉旧断言。此后到第三步之间，盘上的状态都不替任何一份名单打包票
  state.memory_status = 'unknown'
  saveTask(dir, state)
  // 二、换名单
  saveCreators(dir, creators)
  // 三、名单确实落盘了，这才敢断言
  state.memory_status = status
  saveTask(dir, state)
}

/**
 * 任务标识 —— 取目录名，与用户怎么写路径（相对/绝对/带尾斜杠）无关。
 * collect 与 render 必须算出同一个值，记忆才认得出「这是同一次任务」。
 */
export const taskId = (dir: string): string => basename(dir.replace(/[/\\]+$/, ''))

const RAW = 'creators.raw.json'

/**
 * 采集累加器。**与交付物 creators.json 是两个文件。**
 *
 * 早先两者共用一个：collect 结尾把过滤后的名单写回 creators.json，而 --resume
 * 开头又从同一个文件读回。于是 render 跑过之后再续跑，记忆过滤把整批人判成
 * 「本产品已推荐过」，creators.json 被清成空数组 —— 已经付费采集的数据
 * 不可恢复地消失。累加器只增不减，过滤只作用于交付物。
 */
export function loadRawCreators(dir: string): Creator[] {
  const raw = join(dir, RAW)
  if (existsSync(raw)) return JSON.parse(readFileSync(raw, 'utf8'))
  // 兼容分文件之前产生的任务目录
  return loadCreators(dir)
}

export function saveRawCreators(dir: string, creators: Creator[]): void {
  mkdirDurable(dir)
  writeFileAtomic(join(dir, RAW), JSON.stringify(creators, null, 2))
}

const ENRICHMENT = 'enrichment.json'

export function loadEnrichment(dir: string): EnrichmentState | undefined {
  const p = join(dir, ENRICHMENT)
  if (!existsSync(p)) return undefined
  return JSON.parse(readFileSync(p, 'utf8'))
}

export function saveEnrichment(dir: string, state: EnrichmentState): void {
  mkdirDurable(dir)
  state.updated_at = new Date().toISOString()
  writeFileAtomic(join(dir, ENRICHMENT), JSON.stringify(state, null, 2))
}
