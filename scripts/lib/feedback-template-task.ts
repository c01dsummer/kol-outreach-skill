import { lstatSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { writeFileAtomic } from './atomic.js'
import { brandCalibrationProblems } from './brand-calibration.js'
import { planManualFeedbackTemplate } from './manual-feedback-template.js'
import { readAgentReviewDocument, reviewRoundSourceProblems, ReviewInputError } from './review.js'
import { taskListProblems } from './search-tasks.js'
import { loadReviewCreatorInputs, loadTask, taskFile } from './task.js'

export interface ManualFeedbackTemplateResult {
  file: string
  status: 'create' | 'append' | 'unchanged'
  added_accounts: number
}

/** 只在 lstat 确认路径缺席时创建；悬空软链是已存在且读失败。 */
function readTarget(file: string): Buffer | undefined {
  try { lstatSync(file) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw new ReviewInputError([`${file} 无法检查：${String(error)}`])
  }
  try { return readFileSync(file) }
  catch (error) { throw new ReviewInputError([`${file} 无法读取：${String(error)}`]) }
}

/** D26：只消费已保存的任务与冻结池；准备阶段不写盘，保存错误原样传播。 */
export function runManualFeedbackTemplate(dir: string, append = false): ManualFeedbackTemplateResult {
  dir = resolve(dir)
  let state: ReturnType<typeof loadTask>
  try { state = loadTask(dir) }
  catch (error) { throw new ReviewInputError([`${taskFile(dir)} 无法读取任务：${String(error)}`]) }
  const inputProblems = [...taskListProblems(state.tasks), ...brandCalibrationProblems(state)]
  if (inputProblems.length) throw new ReviewInputError(inputProblems.map(p => `${taskFile(dir)}: ${p}`))

  const saved = readAgentReviewDocument(dir)
  if (saved.status === 'absent') {
    throw new ReviewInputError([`${join(dir, 'agent-review.json')} 缺席；请先由 collect／render 保存真实候选轮次`])
  }
  const sourceProblems = reviewRoundSourceProblems(saved.document, state)
  if (sourceProblems.length) {
    throw new ReviewInputError(sourceProblems.map(p => {
      const index = Number(/^rounds\[(\d+)\]/.exec(p)![1])
      return `${join(dir, 'agent-review.json')}: 轮次 ${JSON.stringify(saved.document.rounds[index].round_id)} ${p}`
    }))
  }

  // 该通用读取器允许旧名单缺席；模板入口要求真实完整名单先存在。
  const creatorsFile = join(dir, 'creators.json')
  try { lstatSync(creatorsFile) }
  catch (error) { throw new ReviewInputError([`${creatorsFile} 无法检查：${String(error)}`]) }
  const inputs = loadReviewCreatorInputs(dir)
  const file = join(dir, 'manual-feedback.csv')
  const existing = readTarget(file)
  const plan = planManualFeedbackTemplate(existing, file, saved.document,
    [...inputs.previous, ...inputs.raw], append)
  if (plan.action !== 'unchanged') writeFileAtomic(file, plan.bytes)
  return { file, status: plan.action, added_accounts: plan.added_accounts }
}
