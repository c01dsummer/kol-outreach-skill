import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Creator, TaskState } from './types.js'
import {
  freezeReviewRounds, readAgentReviewDocument, reviewRoundSourceProblems,
  ReviewInputError, writeAgentReviewDocument, type AgentReviewDocument,
} from './review.js'
import { migrateLegacyAgentReviews, projectAgentReviews } from './review-projection.js'
import { parseManualFeedbackCsv } from './manual-feedback.js'
import { projectManualFeedback } from './effective-priority.js'

/** D21/D22/D23/D25：只读准备与显式保存；生产入口尚未接线。 */
export interface TaskReviews {
  readonly document: AgentReviewDocument
  freezeCandidates(currentCreators: readonly Creator[], createdAt: string): void
  project(creators: readonly Creator[], fullRelations: readonly Creator[], calibrationVersion?: string): Creator[]
  save(updatedAt: string): boolean
}

function readManualFile(file: string): string | undefined {
  try { lstatSync(file) }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return undefined
    throw new ReviewInputError([`${file} 无法检查：${String(error)}`])
  }
  // 存在的悬空链接读取时也会 ENOENT；它不是缺席的人工文件。
  try { return readFileSync(file, 'utf8') }
  catch (error) { throw new ReviewInputError([`${file} 无法读取：${String(error)}`]) }
}

/** D21/D22/D23：tasks 已由调用方校验；关系须为过滤前完整名单，不写盘。 */
export function prepareTaskReviews(
  dir: string, state: Pick<TaskState, 'tasks'>,
  previousCreators: readonly Creator[], createdAt: string,
  fullRelations: readonly Creator[],
): TaskReviews {
  const file = join(dir, 'agent-review.json')
  const manualFile = join(dir, 'manual-feedback.csv')
  const sourceState = structuredClone(state)
  const original = readAgentReviewDocument(dir)
  const sourceProblems = reviewRoundSourceProblems(original.document, sourceState)
  if (sourceProblems.length) throw new ReviewInputError(sourceProblems.map(problem => {
    const index = /^rounds\[(\d+)\]/.exec(problem)?.[1]
    const round = index === undefined ? undefined : original.document.rounds[Number(index)]
    return `${file}${round === undefined ? '' : ` 轮次 ${round.round_id}`} ${problem}`
  }))
  const initialRelations = structuredClone(fullRelations)
  const manualText = readManualFile(manualFile)
  const feedback = (relations: readonly Creator[]) => manualText === undefined ? []
    : parseManualFeedbackCsv(manualText, manualFile, original.document, relations)
  // D23.h：原池授权先于迁移与冻结；后续新轮不能把本次池外作答变合法。
  feedback(initialRelations)
  const freeze = (document: AgentReviewDocument, previous: readonly Creator[], current: readonly Creator[], time: string) => {
    try { return freezeReviewRounds(document, sourceState, previous, current, time) }
    catch (error) {
      if (error instanceof ReviewInputError) throw new ReviewInputError(error.problems.map(problem => `${file} ${problem}`))
      throw error
    }
  }
  let pending = freeze(migrateLegacyAgentReviews(original, previousCreators), previousCreators, [], createdAt)
  let saved = structuredClone(original.document)
  const content = (document: AgentReviewDocument): string => {
    const { updated_at: _time, ...body } = document
    return JSON.stringify(body)
  }
  return {
    get document() { return structuredClone(pending) },
    freezeCandidates(currentCreators, time) {
      pending = freeze(pending, [], currentCreators, time)
    },
    project(creators, fullRelations, calibrationVersion) {
      const rows = feedback([...initialRelations, ...fullRelations])
      return projectManualFeedback(pending, projectAgentReviews(pending, creators, calibrationVersion), rows)
    },
    save(updatedAt) {
      if (content(pending) === content(saved)) return false
      if (typeof updatedAt !== 'string' || !updatedAt.trim()) throw new ReviewInputError([`${file} updated_at 必须是非空字符串`])
      const next = { ...pending, updated_at: updatedAt }
      writeAgentReviewDocument(dir, next)
      // 真实写入成功之后才消费变化；失败仍可重试，且不伪造已保存时间。
      saved = structuredClone(next)
      pending = next
      return true
    },
  }
}
