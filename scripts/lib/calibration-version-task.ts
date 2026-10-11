/** D20.k–D20.u：`calibration version` 的判定与读写（ADR-136 第一节第 1 条）。入口 scripts/calibration.ts 只接线。 */

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
  void state
  throw new Error('planCalibrationVersion 尚未实现')
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
  void dir
  throw new Error('runCalibrationVersion 尚未实现')
}
