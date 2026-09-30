import type { Creator, AdoptionPriority } from './types.js'
import { normalizedAccountKey, type AgentReviewDocument } from './review.js'
import type { ManualFeedbackRow } from './manual-feedback.js'

export interface EffectivePriority {
  priority: AdoptionPriority
  account_key?: string
}

/** D25：人工行已按 D23 校验并按主账号、显式关联账号的顺序匹配。 */
export function effectivePriority(
  creator: Pick<Creator, 'review_status' | 'adoption_priority'>, manual: readonly ManualFeedbackRow[],
): EffectivePriority {
  const yes = manual.find(row => row.manual_adopted === 'yes')
  if (yes) return { priority: '优先联系', account_key: yes.account_key }
  const no = manual.find(row => row.manual_adopted === 'no' || row.manual_eligible === 'no')
  if (no) return { priority: '暂不采用', account_key: no.account_key }
  const unknown = manual.find(row => row.manual_adopted === 'unknown')
  if (unknown) return { priority: '待核实', account_key: unknown.account_key }
  return { priority: creator.review_status === '已评' && creator.adoption_priority !== undefined
    ? creator.adoption_priority : '待核实' }
}

const manualFields = [
  'manual_eligible', 'manual_adopted', 'manual_content_fit', 'manual_engagement',
  'manual_comment_authenticity', 'manual_reject_reason', 'manual_note',
] as const

function accountKey(platform: string, handle: string): string | undefined {
  try { return normalizedAccountKey(platform, handle) }
  catch { return undefined }
}

/** D25：人工行须针对同一正本及投影前完整关联名单通过 D23；消费 D21 Agent 投影，不重新校验或读写文件。 */
export function projectManualFeedback(
  document: AgentReviewDocument, creators: readonly Creator[], feedback: readonly ManualFeedbackRow[],
): Creator[] {
  const byAccount = new Map(feedback.map(row => [row.account_key, row]))
  const byRound = new Map(document.rounds.flatMap(round =>
    round.candidates.map(candidate => [candidate.account_key, round.round_id] as const)))
  return creators.map(original => {
    const creator = { ...original }
    for (const field of [...manualFields, 'manual_reviewed', 'manual_round_id',
      'manual_feedback_accounts', 'effective_priority', 'effective_priority_account_key'] as const) delete creator[field]
    const primary = accountKey(original.platform, original.handle)
    const parts = original.linked_handle?.split(':')
    const linked = primary && parts?.length === 2 ? accountKey(parts[0], parts[1]) : undefined
    const accounts = primary ? [primary] : []
    if (linked && linked.split(':')[0] !== primary?.split(':')[0]) accounts.push(linked)
    const rows = accounts.flatMap(key => {
      const row = byAccount.get(key)
      return row ? [structuredClone(row)] : []
    })
    creator.manual_feedback_accounts = rows
    const manual = primary ? byAccount.get(primary) : undefined
    if (manual) for (const field of manualFields) {
      const value = manual[field]
      if (value !== undefined) (creator as unknown as Record<string, unknown>)[field] = value
    }
    creator.manual_reviewed = manual !== undefined && manualFields.some(field =>
      manual[field] !== undefined && manual[field]!.trim() !== '')
    const round = primary ? byRound.get(primary) : undefined
    if (round !== undefined) creator.manual_round_id = round
    const effective = effectivePriority(creator, rows)
    creator.effective_priority = effective.priority
    if (effective.account_key !== undefined) creator.effective_priority_account_key = effective.account_key
    return creator
  })
}
