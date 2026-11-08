/**
 * 契约 kol-obs/v1：测试观察用的 stderr 行与保存失败注入。公开说明在 `skill/references/output-format.md`
 * 「测试观察用的 stderr 行与保存失败注入」一节，那是需求方逐字确认过的原文（ADR-186）；这里只照它做，不另立口径。
 *
 * 两样默认都关着：`KOL_OBS_EVENTS` 不是恰为 `1`、当前目录里也没有 `.kol-save-fault.json` 时，这里一个字节都不写，
 * 除了看一眼那个文件在不在，什么也不做。
 *
 * 行只写 fd 2，**同步写、整行写完才回**：入口在出错时会立刻 `process.exit`，排着队没写出去的会丢；预留行因此在那次请求发出之前
 * 已经整行进了 fd 2，KOL-OBS 行之间的次序就是调用的次序。与 `console.error` 的行之间只在 stderr 没塞满时如此 —— 塞满时那些行
 * 排在 Node 自己的队列里晚一步出去，契约也没许诺它们之间的次序。
 */
import { readFileSync, writeSync } from 'node:fs'
import { join, normalize } from 'node:path'

export const OBS_CONTRACT = 'kol-obs/v1'
export const OBS_PREFIX = 'KOL-OBS '
export const SAVE_FAULT_FILE = '.kol-save-fault.json'
export const SAVE_FAULT_SCHEMA = 'kol-save-fault/v1'
export const SAVE_POINTS = ['SP-R', 'SP-200', 'SP-N200', 'SP-NS', 'SP-BUD'] as const
export type SavePoint = typeof SAVE_POINTS[number]
export type ObsEntry = 'collect' | 'probe' | 'enrich'
export type RejectReason = 'budget' | 'ledger-unavailable' | 'pending' | 'root-conflict' | 'save-failed'
/** 一次真实 HTTP 尝试在任务账里的序号与它的 URL 路径 */
export type Attempt = { attempt_id: number; endpoint: string }
export type ReserveResult = { result: 'reserved'; attempt_id: number } | { result: 'rejected'; reason: RejectReason }

/**
 * 名字检查（原文「行的格式」末尾）：入口有几句给人看的提示以用户给的路径或产品名开头，名字以 `KOL-OBS` 开头时提示也就以它开头了，
 * 所以原样或整理成规范路径之后以它开头的一律不接受，名字里有换行的每一行都算；不看两样开没开。`path` 为假时只看原样（产品名）。
 * 有毛病时返回给人看的那一句：以固定的字开头，名字加引号写在句中 —— 原样写出带换行的名字，下一行就以它开头了。
 */
export function obsNameProblem(what: string, name: string, path = true): string | undefined {
  const lines = (path ? [name, normalize(name)] : [name]).flatMap(form => form.split('\n'))
  if (!lines.some(line => line.startsWith('KOL-OBS'))) return undefined
  return `${what} ${JSON.stringify(name)} 以 KOL-OBS 开头，不能用：这个开头留给测试观察的记录行（契约 ${OBS_CONTRACT}）。换个名字再跑。`
}

/**
 * fd 2 是管道时，进程里一碰 `process.stderr` Node 就把它设成不阻塞；读的一方慢了、管道满着，写就回 EAGAIN 或只写进一截。
 * 这时歇一毫秒接着写剩下的：抛出去的话，预留已经存好、请求却不发了（#431 评审指出）。
 */
const pause = new Int32Array(new SharedArrayBuffer(4))
const write = (record: Record<string, unknown>): void => {
  const line = Buffer.from(`${OBS_PREFIX}${JSON.stringify({ kind: record.kind, contract: OBS_CONTRACT, ...record })}\n`)
  for (let done = 0; done < line.length;) {
    try { done += writeSync(2, line, done) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EAGAIN') throw error; Atomics.wait(pause, 0, 0, 1) }
  }
}

/** 事件开着时是本跑的入口名；关着是 undefined，`obsReserve` 据此什么都不写 */
let events: ObsEntry | undefined

/** 就绪行。入口的第一句：在读命令行参数、配置、`task.json` 之前 */
export function obsReady(entry: ObsEntry, env: NodeJS.ProcessEnv = process.env): void {
  if (env.KOL_OBS_EVENTS !== '1') return
  events = entry
  write({ kind: 'ready', entry })
}

/**
 * 预留行，每一次预留尝试一行。`scope` 看入口：collect、enrich 的账写进 `task.json`，probe 的只在本进程里；
 * `attempt_id` 只在任务账上预留成功时带。
 */
export function obsReserve(endpoint: string, unit: number, r: ReserveResult): void {
  if (events === undefined) return
  const scope = events === 'probe' ? 'process' : 'task'
  write({ kind: 'reserve', entry: events, scope, endpoint, unit_micro_usd: unit, result: r.result,
    ...(r.result === 'rejected' ? { reason: r.reason } : scope === 'task' ? { attempt_id: r.attempt_id } : {}) })
}

export interface SaveFault {
  /** 到了一个保存点。是选中的那个点、又正好是第 k 次，就写命中行并抛出 —— 那一次保存不写盘 */
  at(point: SavePoint, attempt?: Attempt): void
}

type FaultFile = { point: SavePoint | null; occurrence: number | null; valid: boolean }

/** 只认契约列的四种不合格：不是合格 JSON、`schema` 不对、`point` 不在五个里、`occurrence` 不是正整数 */
function parseFault(text: string | undefined): FaultFile {
  let raw: unknown
  try { raw = text === undefined ? undefined : JSON.parse(text) } catch { raw = undefined }
  const o = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const point = (SAVE_POINTS as readonly unknown[]).includes(o.point) ? o.point as SavePoint : null
  const occurrence = typeof o.occurrence === 'number' && Number.isSafeInteger(o.occurrence) && o.occurrence > 0 ? o.occurrence : null
  return { point, occurrence, valid: o.schema === SAVE_FAULT_SCHEMA && point !== null && occurrence !== null }
}

/**
 * 启动时读一次当前目录下的 `.kol-save-fault.json`，只读，不改不删。没有这个文件返回 undefined，本跑不写任何注入行。
 * 有文件就挂上退出时的未命中记录：注入一直没生效（没到第 k 次，或文件不合格）就在退出时写一行。
 */
export function loadSaveFault(entry: 'collect', cwd = process.cwd()): SaveFault | undefined {
  let text: string | undefined
  try { text = readFileSync(join(cwd, SAVE_FAULT_FILE), 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    text = undefined // 在，却读不出（是目录、没权限）：照文件不合格处理
  }
  const file = parseFault(text)
  let seen = 0, hit = false
  process.on('exit', () => {
    if (hit) return
    write({ kind: 'save-fault-miss', entry, point: file.point, occurrence: file.occurrence,
      seen: file.point === null ? null : seen, why: file.valid ? 'not-reached' : 'invalid-file' })
  })
  return {
    at(point, attempt) {
      if (point !== file.point) return
      seen++
      if (!file.valid || hit || seen !== file.occurrence) return
      hit = true
      write({ kind: 'save-fault', entry, point, occurrence: seen,
        ...(attempt ? { attempt_id: attempt.attempt_id, endpoint: attempt.endpoint } : {}), not_written: true })
      throw new Error(`${SAVE_FAULT_FILE} 注入的保存失败：${point} 第 ${seen} 次出现，这一次没有写盘`)
    },
  }
}
