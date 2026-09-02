import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { textProblem, type Creator, type MemoryStatus } from './types.js'

/** D4：本地单文件，不做多人共享。团队场景需另行设计。 */
const DEFAULT_FILE = 'memory/creators.json'

/** 可注入路径 —— 否则这套规则只能靠「看起来对」，测不了 */
let FILE = DEFAULT_FILE
export function useMemoryFile(path: string): void { FILE = path }

export type { MemoryStatus }

export interface MemoryEntry {
  platform: string
  handle: string
  nickname: string
  followers: number
  first_seen: string
  linked_to?: string
  recommendations: Array<{
    date: string
    product: string
    keyword: string
    /** 产出目录名 —— 用来区分「同一任务的续跑」与「另一次任务」，见 filterByMemory */
    task?: string
    tier?: string
    fit_reason?: string
  }>
  contacted: boolean
  replied: boolean
  blocked: boolean
  note: string
}

interface MemoryFile {
  version: number
  updated_at: string
  creators: Record<string, MemoryEntry>
}

const key = (c: { platform: string; handle: string }) => `${c.platform}:${c.handle.toLowerCase()}`

/**
 * 记忆读不出来。**不是「记忆里没有人」** —— 见 ADR-15。
 *
 * 抛而不是退化，因为**名单没有第三态**：CSV 里的每一行就是「这个人可以发信」，
 * 没有地方写「我不确定该不该发」。这里能表达「我没有资格回答」的唯一方式，
 * 是不产出名单。
 */
export class MemoryUnreadable extends Error {
  constructor(readonly file: string, readonly detail: string) {
    // **不说是哪一步坏的。** 这个状态含三类：读不到（权限、路径不是目录、IO）、
    // 解析不了、结构不对。写死成「解析失败」，权限出问题的人会去查一份
    // 完好的 JSON。真实原因在 detail 里，它自己会说（ADR-44）。
    super(`记忆文件 ${file} 不可用：${detail}`)
    this.name = 'MemoryUnreadable'
  }
}

type ReadResult =
  | { status: 'ok' | 'absent'; mem: MemoryFile }
  | { status: 'unreadable'; detail: string }

/**
 * 一次读失败算不算「盘上没有这个文件」：**只有 ENOENT 算**。
 * 权限不足、父路径不是目录、IO 错都是「看不到」，不是「没有」（ADR-26）。
 */
const isAbsence = (e: unknown): boolean =>
  (e as NodeJS.ErrnoException | null)?.code === 'ENOENT'

const empty = (): MemoryFile => ({ version: 1, updated_at: '', creators: {} })

/**
 * **解析成功不等于形状对。** 这个文件是产品明确要求运营手改的（S3），
 * 而手改很容易改出一份**合法 JSON、错误结构**的记忆 —— 最典型的是把
 * `creators` 的花括号改成方括号。那样字符串取键在数组上一个都取不到，
 * 于是打扰过的人全部重新进名单，而状态报的是「读到了」（ADR-19）。
 *
 * 只校验过滤真正会读的那几个字段，不做全量 schema：多出来的自定义字段
 * （比如运营自己加的备注）不该被判成损坏。返回哪里不对，因为**修它的是人**。
 */
function shapeProblem(v: unknown): string | undefined {
  const obj = (x: unknown) => x !== null && typeof x === 'object' && !Array.isArray(x)
  if (!obj(v)) return '顶层不是对象'
  const creators = (v as Record<string, unknown>).creators
  if (!obj(creators)) {
    return `creators 不是以 platform:handle 为键的对象${Array.isArray(creators) ? '（是数组）' : ''}`
  }
  for (const [k, e] of Object.entries(creators as Record<string, unknown>)) {
    if (!obj(e)) return `${k} 的记录不是对象`
    const r = e as Record<string, unknown>
    // contacted 与 blocked 决定 P4；recommendations 决定跨任务去重。
    // 缺一个就没法回答「这个人能不能联系」，而**答不上来时不许猜**。
    if (typeof r.contacted !== 'boolean') return `${k} 的 contacted 不是 true 或 false`
    if (typeof r.blocked !== 'boolean') return `${k} 的 blocked 不是 true 或 false`
    if (!Array.isArray(r.recommendations)) return `${k} 的 recommendations 不是数组`
    // 容器对了不等于里面的东西对。过滤会逐条读 task / product / date ——
    // `[{}]` 会让「已推荐过」这件事悄悄消失，还在名单上留下一个
    // 「undefined @ undefined」；`[null]` 直接抛 TypeError，绕开
    // 「读不出来」那条明确的报错路（ADR-21）。
    for (const [i, rec] of (r.recommendations as unknown[]).entries()) {
      const at = `${k} 的第 ${i + 1} 条推荐记录`
      if (!obj(rec)) return `${at}不是对象`
      const rr = rec as Record<string, unknown>
      // 类型对不等于能用：product 用来匹配「这个人是不是已经为这个产品推过了」，
      // date 用来渲染「上次推的是什么、什么时候」。空字符串两件事都做不了 ——
      // 一条空 product 的记录永远匹配不上任何产品，等于这条去重记录不存在（ADR-37）。
      // task 不在此列：空字符串与缺省在过滤里行为完全一致，不是坏数据。
      // 判据本身在 types.ts，只此一份 —— 写回前问的是同一个函数（ADR-46 追记二）。
      const badProduct = textProblem(rr.product)
      if (badProduct) return `${at}的 product ${badProduct}`
      const badDate = textProblem(rr.date)
      if (badDate) return `${at}的 date ${badDate}`
      if (rr.task !== undefined && typeof rr.task !== 'string') return `${at}的 task 不是字符串`
    }
  }
  return undefined
}

/**
 * 同一个对象里出现两次的键。**必须在文本上查，解析之后就晚了** ——
 * `JSON.parse` 遇到重复键静默保留**最后一个**，重复在解析完成的那一刻
 * 就已经不存在了，解析之后再严的校验也看不到它。
 *
 * 手改时把同一个人又贴一遍是最容易犯的错，而后贴的那条通常是
 * 「还没联系过」—— 于是一条 contacted 的记录被静默顶掉，人重新进名单，
 * 状态照报「读到了」（ADR-36）。
 *
 * 只在已经解析成功的文本上跑，所以不必处理非法 JSON。
 */
function duplicateKey(raw: string): string | undefined {
  // 每进一层对象压一个 Set；数组层压 null（数组没有键）
  const levels: (Set<string> | null)[] = []
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '{') { levels.push(new Set()); continue }
    if (c === '[') { levels.push(null); continue }
    if (c === '}' || c === ']') { levels.pop(); continue }
    if (c !== '"') continue
    let j = i + 1
    while (j < raw.length && raw[j] !== '"') j += raw[j] === '\\' ? 2 : 1
    let k = j + 1
    while (k < raw.length && ' \t\n\r'.includes(raw[k])) k++
    const here = levels[levels.length - 1]
    // 字符串后面跟冒号才是键，跟别的就是值
    if (raw[k] === ':' && here) {
      // 借 JSON.parse 还原转义 —— 手写反转义会把 \u0062 和 b 看成两个键
      const name = JSON.parse(raw.slice(i, j + 1)) as string
      if (here.has(name)) return name
      here.add(name)
    }
    i = j
  }
  return undefined
}

/** 唯一读盘的地方。**它不做决定** —— 读不出来时怎么办由各个调用方自己回答。 */
function readMemory(): ReadResult {
  let raw: string
  try {
    raw = readFileSync(FILE, 'utf8')
  } catch (e) {
    // **只有「文件不存在」才是 absent。** 权限不足、父路径不是目录、IO 错误
    // 都是「没查到」—— 而 existsSync 对它们**统统返回 false**，拿它分档
    // 等于把刚拆开的三档又压回两档：名单照出，还报「记忆里确实没人」（ADR-26）。
    if (isAbsence(e)) return { status: 'absent', mem: empty() }
    return { status: 'unreadable', detail: e instanceof Error ? e.message : String(e) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { status: 'unreadable', detail: e instanceof Error ? e.message : String(e) }
  }
  // 重复键要在**文本**上查：解析已经把它吃掉了（ADR-36）
  const dup = duplicateKey(raw)
  if (dup !== undefined) {
    return { status: 'unreadable',
             detail: `键「${dup}」在同一层出现了两次 —— 解析只会留下最后一条，` +
                     `另一条说了什么无从得知，而它们可能正好相反` }
  }
  const bad = shapeProblem(parsed)
  if (bad) return { status: 'unreadable', detail: `结构不对 —— ${bad}` }
  return { status: 'ok', mem: parsed as MemoryFile }
}

/** 读不出来就抛。要在读不出来时继续的调用方，走 filterByMemory 的显式开关。 */
export function loadMemory(): MemoryFile {
  const r = readMemory()
  if (r.status === 'unreadable') throw new MemoryUnreadable(FILE, r.detail)
  return r.mem
}

export function saveMemory(mem: MemoryFile): void {
  mkdirSync(dirname(FILE), { recursive: true })
  mem.updated_at = new Date().toISOString()
  writeFileSync(FILE, JSON.stringify(mem, null, 2), 'utf8')
}

export interface FilterResult {
  kept: Creator[]
  filtered_recommended: number
  filtered_contacted: number
  /** 「没查到」与「查过、确实没人」的 filtered_contacted 都是 0，能分开它们的只有这个 */
  memory_status: MemoryStatus
}

/**
 * 按记忆过滤。
 *
 * - contacted / blocked → 一律排除（P4）
 * - 同一产品在**别的任务**里推荐过 → 排除
 * - 同一任务自己写下的推荐 → **不参与过滤**。续跑要推荐的就是这批人；
 *   把他们滤掉，会让 render 之后的每一次 --resume 都产出一份空名单。
 * - 换了产品 → 保留但标注，让用户自己判断
 *
 * 记忆读不出来时**默认抛**（P4 无法保证就不产出名单）。`ignoreUnreadable` 是调用方
 * 显式打出来的逃生口：它不让这件事消失，只是把「接受重复打扰的风险」从一个
 * 静默默认变成一次显式决定，代价随 memory_status 原样带出去（ADR-15）。
 */
export function filterByMemory(
  creators: Creator[], product: string, task?: string,
  opts: { ignoreUnreadable?: boolean } = {},
): FilterResult {
  const want = product.trim()
  const r = readMemory()
  if (r.status === 'unreadable') {
    if (!opts.ignoreUnreadable) throw new MemoryUnreadable(FILE, r.detail)
    // 一个人都不滤，并把「没滤」原样带出去。**不得在这里返回空记忆了事** ——
    // 那样 filtered_contacted 的 0 就和「确实没人联系过」再次变成同一个值。
    return {
      kept: [...creators], filtered_recommended: 0, filtered_contacted: 0,
      memory_status: 'unreadable_ignored',
    }
  }
  const mem = r.mem
  const kept: Creator[] = []
  let rec = 0, con = 0

  for (const c of creators) {
    const e = mem.creators[key(c)]
    if (!e) { kept.push(c); continue }
    if (e.contacted || e.blocked) { con++; continue }

    // 本任务自己留下的记录不算数 —— 否则续跑会把自己上一轮的产出判成「已推荐过」
    const others = e.recommendations.filter(r => !(task && r.task === task))
    // 比较两侧都去掉首尾空白。**不判成损坏** —— product 来自用户的任务配置，
    // 配置里多一个空格就把我们自己写下的记忆判成读不出来，那是自伤。
    // 首尾空白对「是不是同一个产品」没有意义，和键的大小写是同一类（ADR-40）。
    if (others.some(r => r.product.trim() === want)) { rec++; continue }

    const prior = others.filter(r => r.product.trim() !== want)
    if (prior.length) {
      const last = prior[prior.length - 1]
      c.previously_recommended = `${last.product} @ ${last.date}`
    }
    kept.push(c)
  }
  return { kept, filtered_recommended: rec, filtered_contacted: con, memory_status: r.status }
}

/**
 * 写回的结果。**不写回也是一种结果，必须让调用方看得见** ——
 * 这里可以退化返回值而名单那边不行，因为写回的调用方有地方把「没写回」
 * 说出去，名单上没有。
 */
export type WriteBackResult =
  | { written: true }
  | { written: false; reason: string }

/**
 * 任务结束后写回。只记录进入名单的人。
 *
 * **记忆读不出来时绝不写回。** 旧实现在这里退化成空记忆再存盘，等于把一份
 * 读不出来的记忆替换成一份「谁都没联系过」的合法记忆 —— contacted 与 blocked
 * 被永久抹掉，而它们只有用户自己知道，没有任何地方能重建（ADR-15）。
 * 一个坏掉的文件还能手工修，被盖掉的就没有了。
 */
export function recordRecommendations(
  creators: Creator[], product: string, task?: string,
): WriteBackResult {
  // **写入侧不许写出读取侧会拒绝的东西。** 任务配置里的 product 是空白时，
  // 这里会存下一条 product 为空的推荐记录，而下一次读盘 shapeProblem 正是
  // 按「product 必须是非空字符串」判它损坏 —— 一次写回就把一份好好的记忆
  // 变成读不出来的，此后每一次采集都被挡住，直到有人手工去修（ADR-46）。
  //
  // 判据是**读取侧实际会拒绝什么**，不是「这个值看起来合不合理」。
  const badProduct = textProblem(product)
  if (badProduct) {
    return { written: false, reason: `任务的产品名${badProduct} —— 记不下来，因为记下的这条下次会被判成损坏` }
  }
  const want = product.trim()
  const r = readMemory()
  if (r.status === 'unreadable') return { written: false, reason: r.detail }
  const mem = r.mem
  const date = new Date().toISOString().slice(0, 10)

  for (const c of creators) {
    const k = key(c)
    const e = mem.creators[k] ?? {
      platform: c.platform, handle: c.handle, nickname: c.nickname,
      followers: c.followers, first_seen: date,
      recommendations: [], contacted: false, replied: false, blocked: false, note: '',
    }
    e.nickname = c.nickname || e.nickname
    e.followers = c.followers || e.followers
    if (c.linked_handle) e.linked_to = c.linked_handle
    // 同一任务重复 render 不该堆出多条记录 —— 覆盖而不是追加
    e.recommendations = e.recommendations.filter(r => !(task && r.task === task))
    e.recommendations.push({
      date, product: want, keyword: c.source_keyword, task,
      tier: c.tier, fit_reason: c.fit_reason,
    })
    mem.creators[k] = e
  }
  saveMemory(mem)
  return { written: true }
}
