import {
  readFileSync, writeFileSync, renameSync, rmSync, readdirSync, existsSync, mkdirSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { PLATFORMS, type Creator, type MemoryStatus, type Platform } from './types.js'

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

/** D1：身份是 platform 与 handle 的组合，**整体**大小写不敏感 */
const key = (c: { platform: string; handle: string }) =>
  `${c.platform.toLowerCase()}:${c.handle.toLowerCase()}`

/**
 * 记忆读不出来。**不是「记忆里没有人」** —— 见 ADR-15。
 *
 * 抛而不是退化，因为**名单没有第三态**：CSV 里的每一行就是「这个人可以发信」，
 * 没有地方写「我不确定该不该发」。这里能表达「我没有资格回答」的唯一方式，
 * 是不产出名单。
 */
export class MemoryUnreadable extends Error {
  constructor(readonly file: string, readonly detail: string) {
    super(`记忆文件 ${file} 解析失败：${detail}`)
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
      if (typeof rr.product !== 'string') return `${at}的 product 不是字符串`
      if (typeof rr.date !== 'string') return `${at}的 date 不是字符串`
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
 * - **带空白字符** —— `tiktok:alice ` 每一关都过得去：两边非空、平台也对，
 *   而查询侧生成的是 `tiktok:alice`，永远差那一个空格。这是同一间屋子的
 *   第四扇门（ADR-32）
 * - **两个键规范化后撞在一起** —— 该用哪一条无从判断，而**答不上来时不许猜**
 *
 * 空白这一条**是个判断，不是推导出来的**：`PLATFORMS` 里这两家都不允许
 * 用户名带空白，所以带空白的键只可能来自手改。它绑在这个枚举上 ——
 * **平台集合变了，这条得跟着重看**。判断有可能错，所以选了错得起的那边：
 * 误判会大声中止（还有 `--ignore-memory` 兜底），漏判是静默地破 P4。
 */
function normalizeKeys(creators: Record<string, MemoryEntry>):
  { ok: true; creators: Record<string, MemoryEntry> } | { ok: false; why: string } {
  const out: Record<string, MemoryEntry> = {}
  const seen = new Map<string, string>()
  for (const [raw, entry] of Object.entries(creators)) {
    const parts = raw.split(':')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { ok: false, why: `键「${raw}」不是 platform:handle 的形式（分隔符必须恰好一个，两边都不能空）—— 它永远匹配不到任何人` }
    }
    if (/\s/.test(raw)) {
      return { ok: false, why: `键「${raw}」里有空白字符 —— ${PLATFORMS.join(' / ')} 的用户名都不允许空白，查询侧生成的键里也不会有，它永远匹配不到任何人` }
    }
    const [rawPlatform, rawHandle] = parts
    if (!(PLATFORMS as readonly string[]).includes(rawPlatform.toLowerCase())) {
      return { ok: false, why: `键「${raw}」的平台「${rawPlatform}」不是支持的平台（${PLATFORMS.join(' / ')}）—— 它永远匹配不到任何人` }
    }
    const norm = `${rawPlatform.toLowerCase()}:${rawHandle.toLowerCase()}`
    const prev = seen.get(norm)
    if (prev !== undefined) {
      return { ok: false, why: `键「${prev}」与「${raw}」指的是同一个人，但各有一条记录 —— 该用哪一条无从判断` }
    }
    seen.set(norm, raw)
    out[norm] = entry
  }
  return { ok: true, creators: out }
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
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'absent', mem: empty() }
    return { status: 'unreadable', detail: e instanceof Error ? e.message : String(e) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { status: 'unreadable', detail: e instanceof Error ? e.message : String(e) }
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
 */
function sweepStaleTemps(): void {
  const dir = dirname(FILE)
  const prefix = `${basename(FILE)}.`
  let names: string[]
  try { names = readdirSync(dir) } catch { return }
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.tmp')) continue
    const pid = Number(name.slice(prefix.length, -'.tmp'.length))
    if (!Number.isInteger(pid) || pid <= 0) continue
    if (pid !== process.pid && alive(pid)) continue
    rmSync(join(dir, name), { force: true })
  }
}

export function saveMemory(mem: MemoryFile): void {
  mkdirSync(dirname(FILE), { recursive: true })
  sweepStaleTemps()
  mem.updated_at = new Date().toISOString()
  // 先写临时文件再 rename。直接盖原文件是非原子的，中途被打断会留下一份截断的
  // JSON —— 而这个文件装着「谁联系过」，是唯一一份副本（memory/ 不进 git），
  // 坏了就再也重建不了。这个模块原来既制造这个故障又吞掉它（ADR-15）。
  // 临时名带 pid：两个 render 同时跑（两个产品各开一个终端）时，共用一个临时名
  // 会让 A 的 rename 搬走 B 写的内容 —— 原子写反而制造了一种新的串味。
  const tmp = `${FILE}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(mem, null, 2), 'utf8')
    renameSync(tmp, FILE)
  } catch (e) {
    rmSync(tmp, { force: true })   // 半成品不留在盘上
    throw e
  }
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
    if (others.some(r => r.product === product)) { rec++; continue }

    const prior = others.filter(r => r.product !== product)
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
      date, product, keyword: c.source_keyword, task,
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
