import type { AgentReview, AgentReviewDocument } from './review.js'
import type { ManualFeedbackRow } from './manual-feedback.js'

interface Tally {
  yes: number
  no: number
  unknown: number
  unreviewed: number
  denominator: number
  rate: number | null
}

export interface FeedbackSummary {
  rounds: Array<{ round_id: string; candidates: number; reviewed: number; unreviewed: number }>
  eligible: Tally
  adopted: Tally
  reject_reasons: Array<{ reason: string; count: number }>
  disagreements: string[]
}

const reviewed = (row: ManualFeedbackRow | undefined): boolean => row !== undefined && (
  (['manual_eligible', 'manual_adopted', 'manual_content_fit', 'manual_engagement',
    'manual_comment_authenticity', 'manual_reject_reason'] as const).some(field => row[field] !== undefined)
  || row.manual_note.trim() !== ''
)

/** U11：仅消费已校验正本与原人工行；单位为全部冻结平台账号，不写输入或借用可变内容。 */
export function feedbackSummary(
  document: AgentReviewDocument, feedback: readonly ManualFeedbackRow[],
): FeedbackSummary {
  const byKey = new Map(feedback.map(row => [row.account_key, row]))
  const accounts = document.rounds.flatMap(round => round.candidates.map(candidate => candidate.account_key))
  const tally = (field: 'manual_eligible' | 'manual_adopted'): Tally => {
    const counts = { yes: 0, no: 0, unknown: 0, unreviewed: 0 }
    for (const key of accounts) {
      const value = byKey.get(key)?.[field]
      if (value === 'yes' || value === 'no' || value === 'unknown') counts[value]++
      else counts.unreviewed++
    }
    const denominator = counts.yes + counts.no
    return { ...counts, denominator, rate: denominator === 0 ? null : counts.yes / denominator }
  }
  const reasons = new Map<string, number>()
  const agents = new Map<string, AgentReview>()
  for (const agent of Object.values(document.reviews)) {
    for (const key of agent.account_keys) agents.set(key, agent)
  }
  const disagreements: string[] = []
  for (const key of accounts) {
    const row = byKey.get(key)
    if (row === undefined) continue
    if (row.manual_reject_reason !== undefined) {
      const uniqueReasons = new Set(row.manual_reject_reason.split(/[;；]/).map(reason => reason.trim()))
      for (const reason of uniqueReasons) {
        const count = reasons.get(reason)
        reasons.set(reason, count === undefined ? 1 : count + 1)
      }
    }
    const agent = agents.get(key)
    if (agent?.eligibility === undefined || agent.adoption_priority === undefined) continue
    const adoptionConflict = (row.manual_adopted === 'yes' && agent.adoption_priority !== '优先联系') ||
      ((row.manual_adopted === 'no' || row.manual_eligible === 'no') && agent.adoption_priority !== '暂不采用')
    const eligibilityConflict = (row.manual_eligible === 'yes' && agent.eligibility === '不合格') ||
      (row.manual_eligible === 'no' && agent.eligibility === '合格')
    if (adoptionConflict || eligibilityConflict) disagreements.push(key)
  }
  return {
    rounds: document.rounds.map(round => {
      const count = round.candidates.filter(candidate => reviewed(byKey.get(candidate.account_key))).length
      return { round_id: round.round_id, candidates: round.candidates.length,
        reviewed: count, unreviewed: round.candidates.length - count }
    }),
    eligible: tally('manual_eligible'), adopted: tally('manual_adopted'),
    reject_reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    disagreements,
  }
}
