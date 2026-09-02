import {
  readFileSync, writeFileSync, renameSync, rmSync, readdirSync, existsSync,
  statSync, chmodSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { PLATFORMS, creatorKey, textProblem, type Creator, type MemoryStatus, type Platform } from './types.js'
import { isAbsence, mkdirDurable, writeFileAtomic, writeTarget } from './atomic.js'

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

/**
 * handle 允许的字符 —— `PLATFORMS` 里两家都只允许字母、数字、下划线、点，
 * 连字符留着是因为现有数据里有（`active-kol`）。见 `normalizeKeys` 的推导。
 */
const HANDLE = /^[a-z0-9._-]+$/

/** D1：身份是 platform 与 handle 的组合，整体大小写不敏感。规则在 types.ts，只此一份 */
const key = creatorKey

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
    // 同一条规矩第三次出现：ADR-20 不许把写不进去说成文件坏了，
    // ADR-43 不许替上一步编原因，这次是不许替失败编一个阶段。
    super(`记忆文件 ${file} 不可用：${detail}`)
    this.name = 'MemoryUnreadable'
  }
}

type ReadResult =
  | { status: 'ok' | 'absent'; mem: MemoryFile }
  | { status: 'unreadable'; detail: string }

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
    // 「undefined @ undefined」；`[null]` 直接抛 TypeError，绕开整条
    // 「退出码 2 + 一句人照做得了的报错」的流程（ADR-21）。
    for (const [i, rec] of (r.recommendations as unknown[]).entries()) {
      const at = `${k} 的第 ${i + 1} 条推荐记录`
      if (!obj(rec)) return `${at}不是对象`
      const rr = rec as Record<string, unknown>
      // 类型对不等于能用：product 用来匹配「这个人是不是已经为这个产品推过了」，
      // date 用来渲染「上次推的是什么、什么时候」。空字符串两件事都做不了 ——
      // 一条空 product 的记录永远匹配不上任何产品，等于这条去重记录不存在（ADR-37）。
      // task 不在此列：空字符串与缺省在过滤里行为完全一致，不是坏数据。
      // 判据本身在 types.ts，只此一份 —— 写回前与花钱前问的是同一个函数（ADR-53）。
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
 * 键的规范化。
 *
 * D1 说身份是 platform 与 handle 的组合、**大小写不敏感**，而查询侧一直在
 * 小写化、存储侧没有 —— 于是手改出来的 `tiktok:Alice` 永远查不到：
 * 已联系的人照进名单，而状态报的是「读到了」（ADR-22）。
 *
 * 两类键不规范化，直接判读不出来：
 *
 * - **不是 `platform:handle` 形状** —— 少冒号、多冒号（`tiktok:alice:old`）、
 *   两边任一为空、或平台不是支持的那几个（`tikok:alice` 这种拼错）。
 *   它永远匹配不到任何人，是个静默的黑洞。**「有个冒号」远不够** ——
 *   查询侧生成的键是什么形状，这里就得要求什么形状（ADR-25）
 * - **handle 不是 handle 的形状** —— `tiktok:@alice`、`tiktok:alice/`、
 *   `tiktok:ali%63e` 每一关都过得去：两边非空、平台也对、也没有空白，
 *   而查询侧生成的是 `tiktok:alice`。空白只是这一类里最显眼的那个
 *   （ADR-32 只堵了空白，ADR-37 补上其余）
 * - **两个键规范化后撞在一起** —— 该用哪一条无从判断，而**答不上来时不许猜**
 *
 * handle 的形状**是从这个仓库里推出来的，不是拍的**：
 *
 * - `report.ts` 渲染的是 `@${handle}` —— handle 自己带 `@` 的话会显示成 `@@alice`
 * - `profile_url` 拼的是 `.../@${handle}` 与 `.../${handle}/` —— handle 是个
 *   **裸的 URL 路径段**，带 `/ ? # %` 拼出来就是另一个地址
 *
 * 所以取两家平台用户名都允许的字符集。仍然绑在 `PLATFORMS` 上 ——
 * **平台集合变了，这条得跟着重看**。可能失之过严，所以选了错得起的那边：
 * 误判会大声中止（还有 `--ignore-memory` 兜底），漏判是静默地破 P4。
 */
/**
 * 这个 platform / handle 组合能不能当键用。
 *
 * **两边共用**：读进来的键要过它，写出去之前生成的键也要过它。
 * 只在读的那一侧校验，写的那一侧就能造出一个自己下次读不出来的文件 ——
 * 一次写回把一份好好的记忆变成读不出来的，此后每次采集都被挡住（ADR-51）。
 * 与 ADR-46 的产品名是同一条规矩，只是这次轮到了键。
 *
 * 收 `unknown` 而不是 `string`：写出去那一侧的两个值直接来自
 * `JSON.parse(creators.json)`，**类型标注在运行时一个值都不拦**。
 * 标成 `string` 时第一句 `toLowerCase` 就抛，而抛出去会绕开
 * 「报为未写回、照常完成交付」那条路 —— `recordRecommendations` 的契约
 * 是**绝不抛**，它只包住了落盘那一条路，没包住这一条（ADR-56）。
 */
function keyProblem(platform: unknown, handle: unknown): string | undefined {
  // 先确认它们是文字，判据用的还是那一份（types.ts）
  const badPlatform = textProblem(platform)
  if (badPlatform) return `平台${badPlatform} —— 它永远匹配不到任何人`
  const badHandle = textProblem(handle)
  if (badHandle) return `handle ${badHandle} —— 它永远匹配不到任何人`
  const p = (platform as string).toLowerCase()
  const h = (handle as string).toLowerCase()
  if (!(PLATFORMS as readonly string[]).includes(p)) {
    return `平台「${platform}」不是支持的平台（${PLATFORMS.join(' / ')}）—— 它永远匹配不到任何人`
  }
  if (!HANDLE.test(h)) {
    return `handle「${handle}」不是 handle 的形状（只允许字母、数字、下划线、点、连字符）—— 展示时前面才加 @，链接里它是一个裸的路径段 —— 支持的平台都不允许用户名出现别的字符，所以这样的键只可能来自手改，而它永远匹配不到任何人`
  }
  return undefined
}

function normalizeKeys(creators: Record<string, MemoryEntry>):
  { ok: true; creators: Record<string, MemoryEntry> } | { ok: false; why: string } {
  const out: Record<string, MemoryEntry> = {}
  const seen = new Map<string, string>()
  for (const [raw, entry] of Object.entries(creators)) {
    const parts = raw.split(':')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { ok: false, why: `键「${raw}」不是 platform:handle 的形式（分隔符必须恰好一个，两边都不能空）—— 它永远匹配不到任何人` }
    }
    const [rawPlatform, rawHandle] = parts
    const bad = keyProblem(rawPlatform, rawHandle)
    if (bad) return { ok: false, why: `键「${raw}」的${bad}` }
    // **用查询侧那个函数本人算**，不要在这里再写一遍同样的表达式。
    // D1 要求两侧「逐字一致」—— 各写一份时那只是巧合，同一个函数才是保证
    // （这个仓库为「同一段逻辑有两份副本」栽过三次：ADR-46 · ADR-48 · 本条）。
    const norm = key({ platform: rawPlatform, handle: rawHandle })
    const prev = seen.get(norm)
    if (prev !== undefined) {
      return { ok: false, why: `键「${prev}」与「${raw}」指的是同一个人，但各有一条记录 —— 该用哪一条无从判断` }
    }
    seen.set(norm, raw)
    out[norm] = entry
  }
  return { ok: true, creators: out }
}

/**
 * 同一个对象里出现两次的键。**必须在文本上查，解析之后就晚了** ——
 * `JSON.parse` 遇到重复键静默保留**最后一个**，重复在解析完成的那一刻
 * 就已经不存在了，`normalizeKeys` 的撞车检测再严也看不到它。
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
  const mem = parsed as MemoryFile
  // 规范化之后写回去的也是规范形式 —— 手改出来的大小写会被就地纠正，
  // 而纠正不了的（形状错、撞键）当读不出来处理。
  const norm = normalizeKeys(mem.creators)
  if (!norm.ok) return { status: 'unreadable', detail: `结构不对 —— ${norm.why}` }
  return { status: 'ok', mem: { ...mem, creators: norm.creators } }
}

/** 读不出来就抛。要在读不出来时继续的调用方，走 filterByMemory 的显式开关。 */
export function loadMemory(): MemoryFile {
  const r = readMemory()
  if (r.status === 'unreadable') throw new MemoryUnreadable(FILE, r.detail)
  return r.mem
}

/**
 * 一个临时文件最多可能正在被写多久。
 *
 * 写的过程是一次 `writeFileSync` 加一次 `renameSync`，毫秒级。取一小时是
 * **荒谬地宽松** —— 为的是正常写盘的文件不会被误判成孤儿。
 * **不是「不可能」**：被 SIGSTOP 或调试器按住超过这个时长的写入方仍会被误判，
 * 那是 ADR-44 明写下来的取舍（误判是响的，不清理是静默的）。
 * 同一个文件里另一处曾把这里写成「不可能」，与那条取舍自相矛盾（ADR-52 自查发现）。
 * 它只用来兜住 pid 被系统回收的那一种情况。
 */
const TMP_MAX_AGE_MS = 60 * 60 * 1000

/** 那个进程还在吗。EPERM 说明进程存在、只是不归我们管 —— 那也算活着 */
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true }
  catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM' }
}

/**
 * 清掉**已经死掉的进程**留下的临时文件。
 *
 * 写临时文件再 rename 挡得住「写到一半被打断」，挡不住**在两步之间被硬杀**
 * （SIGKILL、断电）—— 那时 catch 根本不会跑，一份完整的临时文件留在盘上。
 * 任何 write-then-rename 都躲不掉这一格，能做的是**下次写回时把它清掉**。
 *
 * 活着的进程的临时文件不动：两个 render 同时跑时，那是人家正在写的（ADR-30）。
 *
 * **但「pid 还活着」不等于「它就是写这个文件的那个进程」** —— 系统会回收 pid。
 * 回收到一个长命进程头上，这个孤儿就再也清不掉了，一份完整的记忆副本
 * 永远躺在盘上。所以再拿**文件年龄**兜一道：真正在写的文件只有毫秒级的寿命
 * （一次 writeFileSync 加一次 rename），活过一小时的**几乎一定不是**（ADR-39 · ADR-44）。
 *
 * **年龄这一道有代价，明写在这里：** 一个被 SIGSTOP 或调试器按住超过一小时的
 * 写入方，它的临时文件会被当成孤儿清掉，它恢复后 rename 失败。这是一个
 * **有意的取舍** —— 两边都罕见，但坏法不同：pid 回收留下的孤儿是**静默的**
 * （一份完整副本永远躺在盘上，没人知道），而误清一个被按住的写入方是**响的**
 * （那一次写回报为失败，交付照常完成并带出原因，走 D4 已有的那条路）。
 * 静默与响之间选响的（ADR-44）。
 */
function sweepStaleTemps(): void {
  // **扫的必须是写的那个地方。** 目标是软链时临时文件落在终点旁边，
  // 照着链接那一侧扫就永远扫不到 —— 而那是一份完整的联系历史，
  // 会一直留在盘上（ADR-60）。所以两边问同一个函数，不各写各的。
  const target = writeTarget(FILE)
  const dir = dirname(target)
  const prefix = `${basename(target)}.`
  let names: string[]
  // 目录列不出来（只写不可读这种权限组合）就跳过这一次清理，**不因此让写回失败** ——
  // 清不掉临时文件的代价是盘上多一份副本，而中断写回的代价是这一轮的记录全丢。
  // D4 的措辞据此写成「列得出来时清掉」，不写成无条件的「必须」（自查发现）。
  try { names = readdirSync(dir) } catch { return }
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.tmp')) continue
    const pid = Number(name.slice(prefix.length, -'.tmp'.length))
    if (!Number.isInteger(pid) || pid <= 0) continue
    // 年龄读不出来（文件刚被别人清掉）就当没这回事，没什么可清的
    let ageMs: number
    // 看不到它的年龄就跳过（刚被别人清掉、或者读不到）—— **跳过是安全的那一边**：
    // 拿不准的文件不删，代价是盘上多留一份；删错的代价是搬走别人正在写的东西
    try { ageMs = Date.now() - statSync(join(dir, name)).mtimeMs } catch { continue }
    if (pid !== process.pid && alive(pid) && ageMs < TMP_MAX_AGE_MS) continue
    rmSync(join(dir, name), { force: true })
  }
}

/**
 * 写回。整体替换（先写临时文件再改名，判定在 `atomic.ts`），并在写之前清掉
 * 已死进程留下的孤儿临时文件。
 *
 * **它不管并发。** 两个 render 同时跑时，双方读到同一份快照、各自加上自己那批、
 * 然后先后改名 —— 后写的把先写的整个盖掉，而两边的报告都说「已记入」。
 * 改名前再确认一次盘上还是读到的那份，属于并发那一层，单独一个改动（ADR-54）。
 * **这里不声称它已经被挡住了。**
 */
export function saveMemory(mem: MemoryFile): void {
  // 建的也得是写的那个地方 —— 目标是软链时临时文件落在终点旁边，
  // 建链接那一侧的目录对它一点用没有。第三处问「到底写在哪个文件上」的地方，
  // 三处都调 writeTarget（ADR-60）。
  mkdirDurable(dirname(writeTarget(FILE)))
  sweepStaleTemps()
  mem.updated_at = new Date().toISOString()
  writeFileAtomic(FILE, JSON.stringify(mem, null, 2))
}

export interface FilterResult {
  kept: Creator[]
  filtered_recommended: number
  filtered_contacted: number
  /**
   * 这一批到底有没有去重。**必须往上带** —— 否则 filtered_contacted 为 0 无法解释。
   *
   * 排除 `unknown`：这里是**当场观察**的结果，观察不可能得到「不知道」。
   * 那一档只属于「记录里根本没有这个字段」的旧任务目录（ADR-18）。
   */
  memory_status: Exclude<MemoryStatus, 'unknown'>
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
 * 记忆读不出来时**默认抛**（P4 无法保证就不产出名单）。`ignoreUnreadable` 是用户
 * 显式打出来的逃生口：它不让这件事消失，只是把「接受重复打扰的风险」从一个
 * 静默默认变成一次显式决定，代价随 memory_status 带到交付物上声明（ADR-15）。
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
 * 这里可以退化返回值而名单那边不行，因为交付物上有地方写这条声明（P5），
 * 名单上没有。
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
  // 生成出去的键也要过同一道校验。只校验读进来的那一侧，写出去的这一侧
  // 就能造出一个自己下次读不出来的文件（ADR-51）。
  for (const c of creators) {
    const bad = keyProblem(c.platform, c.handle)
    if (bad) return { written: false, reason: `${c.platform}:${c.handle} 记不下来 —— ${bad}` }
  }
  const r = readMemory()
  if (r.status === 'unreadable') return { written: false, reason: r.detail }
  const mem = r.mem
  const date = new Date().toISOString().slice(0, 10)
  // 下面这段只改内存里的对象；落盘的失败在末尾统一处理

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
  try {
    saveMemory(mem)
  } catch (e) {
    // 写不进去（目录只读、磁盘满、路径被占）同样是**「没写回」,不是「交付失败」**。
    // 这一步跑在报告之前,让它抛会把已经算好的名单连同报告一起丢掉 ——
    // 而原文件仍然完好,真实损失只有这一轮的推荐记录（ADR-19）。
    return { written: false, reason: e instanceof Error ? e.message : String(e) }
  }
  return { written: true }
}
