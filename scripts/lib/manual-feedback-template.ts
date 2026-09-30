import { esc } from './csv.js'
import { MANUAL_FEEDBACK_HEADERS, parseManualFeedbackCsv } from './manual-feedback.js'
import { ReviewInputError, type AgentReviewDocument } from './review.js'
import type { Creator } from './types.js'

export type ManualFeedbackTemplatePlan =
  | { action: 'create' | 'append'; added_accounts: number; bytes: Buffer }
  | { action: 'unchanged'; added_accounts: 0 }

/** D24：纯字节计划；正本已校验，undefined 仅表示调用方已确认文件缺席。 */
export function planManualFeedbackTemplate(
  existing: Buffer | undefined, file: string, document: AgentReviewDocument,
  creators: readonly Creator[], append = false,
): ManualFeedbackTemplatePlan {
  if (existing !== undefined && !append) {
    throw new ReviewInputError([`${file}:1 人工反馈文件已存在；须显式 append，不能覆盖`])
  }
  const known = new Set<string>()
  if (existing !== undefined) {
    const text = existing.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(existing)) {
      throw new ReviewInputError([`${file}:1 人工反馈文件不是合法 UTF-8`])
    }
    for (const row of parseManualFeedbackCsv(text, file, document, creators)) known.add(row.account_key)
  }
  const added = document.rounds.flatMap((round, index) => round.candidates
    .filter(candidate => !known.has(candidate.account_key))
    .map(candidate => {
      if (Buffer.from(round.round_id, 'utf8').toString('utf8') !== round.round_id) {
        throw new ReviewInputError([`${file}: rounds[${index}].round_id ${JSON.stringify(round.round_id)} 不能无损编码成 UTF-8`])
      }
      const [platform, handle] = candidate.account_key.split(':')
      return [round.round_id, platform, handle, '', '', '', '', '', '', ''].map(esc).join(',')
    }))
  if (existing !== undefined && added.length === 0) return { action: 'unchanged', added_accounts: 0 }
  const newRows = Buffer.from(added.map(row => `${row}\n`).join(''), 'utf8')
  if (existing === undefined) {
    const header = Buffer.from(`\uFEFF${MANUAL_FEEDBACK_HEADERS.join(',')}\n`, 'utf8')
    return { action: 'create', added_accounts: added.length, bytes: Buffer.concat([header, newRows]) }
  }
  const separator = existing[existing.length - 1] === 10 ? Buffer.alloc(0) : Buffer.from('\n')
  return { action: 'append', added_accounts: added.length, bytes: Buffer.concat([existing, separator, newRows]) }
}
