import type { Creator } from './types.js'
import type { ReviewStatus } from './types.js'
import { normalizedAccountKey, type AgentReview, type AgentReviewDocument, type AgentReviewRead } from './review.js'

const legacyFields = ['fit', 'fit_reason', 'outreach_draft'] as const
const newJudgmentFields = [
  'eligibility', 'adoption_priority', 'observed_content', 'work_evidence',
  'natural_integration', 'mismatch_risk', 'brand_calibration_version',
] as const
const projectedFields = [
  ...legacyFields, ...newJudgmentFields, 'review_status', 'linked_agent_review',
] as const

function primaryAccount(creator: Creator): string | undefined {
  try { return normalizedAccountKey(creator.platform, creator.handle) }
  catch { return undefined }
}

function linkedAccount(creator: Creator, primary: string | undefined): string | undefined {
  if (!primary || typeof creator.linked_handle !== 'string') return undefined
  const parts = creator.linked_handle.split(':')
  if (parts.length !== 2) return undefined
  try {
    const linked = normalizedAccountKey(parts[0], parts[1])
    return linked.split(':')[0] === primary.split(':')[0] ? undefined : linked
  }
  catch { return undefined }
}

function statusOf(review: AgentReview | undefined, version: string | undefined): ReviewStatus {
  if (!review?.eligibility || !review.adoption_priority) return '未评'
  return review.brand_calibration_version === version ? '已评' : '待重评'
}

/** D21：仅从缺席正本之前的旧名单迁入已有的 Agent 兼容字段。 */
export function migrateLegacyAgentReviews(
  read: AgentReviewRead, legacyCreators: readonly Creator[],
): AgentReviewDocument {
  const document = structuredClone(read.document)
  if (read.status === 'present') return document
  for (const creator of legacyCreators) {
    const key = primaryAccount(creator)
    if (!key || (creator.review_status !== undefined && creator.review_status !== '未评')) continue
    if (newJudgmentFields.some(field => creator[field] !== undefined)) continue
    if (legacyFields.every(field => creator[field] === undefined)) continue
    const review = document.reviews[key] ?? { account_keys: [key] }
    for (const field of legacyFields) {
      const value = creator[field]
      if (value !== undefined && review[field] === undefined) {
        (review as unknown as Record<string, unknown>)[field] = value
      }
    }
    document.reviews[key] = review
  }
  return document
}

/** D21：从已校验的当前评审正本重建 Agent 判断，不读取或写入任务文件。 */
export function projectAgentReviews(
  document: AgentReviewDocument, creators: readonly Creator[], calibrationVersion?: string,
): Creator[] {
  const byAccount = new Map<string, AgentReview>()
  for (const [key, review] of Object.entries(document.reviews)) {
    for (const alias of [key, ...review.account_keys]) byAccount.set(alias, review)
  }
  return creators.map(original => {
    const creator = { ...original }
    const primary = primaryAccount(original)
    for (const field of projectedFields) delete creator[field]
    if (!primary) {
      creator.review_status = '未评'
      return creator
    }
    const review = byAccount.get(primary)
    if (review) {
      for (const field of [...legacyFields, ...newJudgmentFields]) {
        const value = review[field]
        if (value !== undefined) (creator as unknown as Record<string, unknown>)[field] = value
      }
    }
    creator.review_status = statusOf(review, calibrationVersion)
    const linked = linkedAccount(original, primary)
    const linkedReview = linked && linked !== primary ? byAccount.get(linked) : undefined
    if (linked && linkedReview) {
      creator.linked_agent_review = {
        account_key: linked,
        ...(linkedReview.eligibility !== undefined ? { eligibility: linkedReview.eligibility } : {}),
        ...(linkedReview.adoption_priority !== undefined ? { adoption_priority: linkedReview.adoption_priority } : {}),
        review_status: statusOf(linkedReview, calibrationVersion),
        ...(linkedReview.observed_content !== undefined ? { observed_content: linkedReview.observed_content } : {}),
        ...(linkedReview.work_evidence !== undefined ? { work_evidence: linkedReview.work_evidence } : {}),
        ...(linkedReview.natural_integration !== undefined ? { natural_integration: linkedReview.natural_integration } : {}),
        ...(linkedReview.mismatch_risk !== undefined ? { mismatch_risk: linkedReview.mismatch_risk } : {}),
        ...(linkedReview.fit !== undefined ? { fit: linkedReview.fit } : {}),
        ...(linkedReview.fit_reason !== undefined ? { fit_reason: linkedReview.fit_reason } : {}),
      }
    }
    return creator
  })
}
