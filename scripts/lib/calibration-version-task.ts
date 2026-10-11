/** D20.k–D20.u：`calibration version` 的判定与读写（ADR-136 第一节第 1 条）。入口 scripts/calibration.ts 只接线。 */
import { resolve } from 'node:path'
import { brandCalibrationProblems, calibrationContentVersion } from './brand-calibration.js'
import { ReviewInputError } from './review.js'
import { loadTask, saveTask, taskFile } from './task.js'

/** 纯判定的四种结果；不读写文件、不改写输入。 */
export type CalibrationVersionPlan =
  | { action: 'absent' }
  | { action: 'invalid'; problems: string[] }
  | { action: 'unchanged'; version: string }
  | { action: 'write'; version: string }

/**
 * 只看传入的任务状态：没有 brand_calibration 键 → absent；不合 D20.a（含 null、version 缺席或空白）→ invalid，
 * 问题清单里不出现按内容算出的哈希；合 D20.a 时按 D20.f 对除顶层 version 外的内容算内容哈希版本，
 * 与现有 version 相等 → unchanged，否则 → write（原 version 是什么都不拒绝，D20.p）。不改写输入。
 */
export function planCalibrationVersion(state: unknown): CalibrationVersionPlan {
  // D20 × P1：缺席就是缺席，不补出校准或版本
  if (typeof state !== 'object' || state === null || !Object.hasOwn(state, 'brand_calibration')) return { action: 'absent' }
  // 结构不合 D20.a 时只报结构问题、不另算哈希；随后要改写的 version 不合规也不放过（D20.n）
  const problems = brandCalibrationProblems(state)
  if (problems.length) return { action: 'invalid', problems }
  // 合 D20.a 时它必是对象。与入口复算同一份实现；原 version 只拿来比，不按 D20.g 核对（D20.p）
  const calibration = (state as { brand_calibration: { version: string } }).brand_calibration
  const version = calibrationContentVersion(calibration)
  return version === calibration.version ? { action: 'unchanged', version } : { action: 'write', version }
}

/** 成功时入口打到 stdout 的那份 JSON（D20.t）：absent 不带 version。 */
export interface CalibrationVersionResult {
  file: string
  status: 'written' | 'unchanged' | 'absent'
  version?: string
}

/**
 * 读 dir 下的 task.json，按 planCalibrationVersion 判定：absent、unchanged 不写盘；write 只换
 * brand_calibration.version 再按任务保存的惯例写回（D20.q）。读不到任务或不合 D20.a 抛 ReviewInputError
 * （入口以 2 退出）；保存错误原样传播（入口以 1 退出）。
 */
export function runCalibrationVersion(dir: string): CalibrationVersionResult {
  dir = resolve(dir)
  const file = taskFile(dir)
  let state: ReturnType<typeof loadTask>
  // D20.l：不存在、读不了、坏 JSON、根不是对象各有各的说法；只取 message，不带异常类名与堆栈
  try { state = loadTask(dir) }
  catch (error) { throw new ReviewInputError([`${file} 无法读取任务：${error instanceof Error ? error.message : String(error)}`]) }
  const plan = planCalibrationVersion(state)
  if (plan.action === 'absent') return { file, status: 'absent' }
  // D20.n：每处不合规一条，都带 task.json 路径
  if (plan.action === 'invalid') throw new ReviewInputError(plan.problems.map(p => `${file}: ${p}`))
  // D20.r：已一致就零写入，不以同字节重写代替，也不刷新 updated_at
  if (plan.action === 'unchanged') return { file, status: 'unchanged', version: plan.version }
  // D20.q：只给读进来的那个对象换 version 一个字段，不按已知字段重建；同一个对象交给 saveTask，
  // 读入时的原文 token 才跟得上（费用字段按 D13，其余没改动的数字按 D19.g、ADR-138）。updated_at 由 saveTask 照惯例刷新
  state.brand_calibration!.version = plan.version
  saveTask(dir, state)
  return { file, status: 'written', version: plan.version }
}
