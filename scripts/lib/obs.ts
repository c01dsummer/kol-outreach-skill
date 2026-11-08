/**
 * 契约 kol-test-observer/v1：测试观察用的记录文件与保存失败注入。公开说明在 `skill/references/output-format.md`
 * 「测试观察用的记录文件与保存失败注入」一节，那是需求方逐字确认过的原文（ADR-187）；这里只照它做，不另立口径。
 *
 * 整个由 `KOL_TEST_OBSERVER_EVENTS` 打开：没设或值为空时，这里一个字节都不写、一个文件都不读，当前目录放着
 * `.kol-save-fault.json` 也不看。
 *
 * 记录写进那个变量指的文件，**同步写、整条写完才回**：入口在出错时会立刻 `process.exit`，排着队没写出去的会丢；预留记录因此在
 * 那次请求发出之前已经整条进了文件，记录之间的次序就是调用的次序。stdout、stderr 一个字节都不因此多写。
 * 文件打不开、写不进时在 stderr 说一句、以 1 退出：启动时打不开的什么输入都没读；中途写不进的就停在那一句，那一次请求不发。
 */
import { openSync, readFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'

export const TEST_OBSERVER_CONTRACT = 'kol-test-observer/v1'
export const TEST_OBSERVER_ENV = 'KOL_TEST_OBSERVER_EVENTS'
export const SAVE_FAULT_FILE = '.kol-save-fault.json'
export const SAVE_FAULT_SCHEMA = 'kol-save-fault/v1'
export const SAVE_POINTS = ['SP-R', 'SP-200', 'SP-N200', 'SP-NS', 'SP-BUD'] as const
export type SavePoint = typeof SAVE_POINTS[number]
export type ObsEntry = 'collect' | 'probe' | 'enrich'
export type RejectReason = 'budget' | 'ledger-unavailable' | 'pending' | 'root-conflict' | 'save-failed'
/** 一次真实 HTTP 尝试在任务账里的序号与它的 URL 路径 */
export type Attempt = { attempt_id: number; endpoint: string }
export type ReserveResult = { result: 'reserved'; attempt_id: number } | { result: 'rejected'; reason: RejectReason }

/** 开着时是记录文件（路径与 fd）和本跑的入口名；关着是 undefined，下面几处据此什么都不写、不读 */
let out: { path: string; fd: number; entry: ObsEntry } | undefined

/** 记录文件打不开或写不进：stderr 说是哪个文件、为什么，以 1 退出（在 `exit` 事件里调也一样以 1 退出） */
const giveUp = (path: string, error: unknown): never => {
  console.error(`${TEST_OBSERVER_ENV} 指的记录文件 ${JSON.stringify(path)} 写不进去：${String(error)}`)
  process.exit(1)
}

const write = (record: Record<string, unknown>): void => {
  if (out === undefined) return
  const line = Buffer.from(`${JSON.stringify({ kind: record.kind, contract: TEST_OBSERVER_CONTRACT, ...record })}\n`)
  try { for (let done = 0; done < line.length;) done += writeSync(out.fd, line, done) }
  catch (error) { giveUp(out.path, error) }
}

/** 打开记录文件、写就绪记录。入口的第一句：在读命令行参数、配置、`task.json` 之前 */
export function obsReady(entry: ObsEntry, env: NodeJS.ProcessEnv = process.env): void {
  const path = env[TEST_OBSERVER_ENV]
  if (!path) return
  let fd: number
  try { fd = openSync(path, 'a') } catch (error) { return giveUp(path, error) }
  out = { path, fd, entry }
  write({ kind: 'ready', entry })
}

/**
 * 预留记录，每一次预留尝试一条。`scope` 看入口：collect、enrich 的账写进 `task.json`，probe 的只在本进程里；
 * `attempt_id` 只在任务账上预留成功时带。
 */
export function obsReserve(endpoint: string, unit: number, r: ReserveResult): void {
  if (out === undefined) return
  const scope = out.entry === 'probe' ? 'process' : 'task'
  write({ kind: 'reserve', entry: out.entry, scope, endpoint, unit_micro_usd: unit, result: r.result,
    ...(r.result === 'rejected' ? { reason: r.reason } : scope === 'task' ? { attempt_id: r.attempt_id } : {}) })
}

export interface SaveFault {
  /** 到了一个保存点。是选中的那个点、又正好是第 k 次，就写命中记录并抛出 —— 那一次保存不写盘 */
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
 * 开着时，启动时读一次当前目录下的 `.kol-save-fault.json`，只读，不改不删。关着、或没有这个文件，返回 undefined，本跑不注入、
 * 不写注入的记录。有文件就挂上退出时的未命中记录：注入一直没生效（没到第 k 次，或文件不合格）就在退出时写一条。
 */
export function loadSaveFault(entry: 'collect', cwd = process.cwd()): SaveFault | undefined {
  if (out === undefined) return undefined
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
