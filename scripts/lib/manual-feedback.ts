import { ReviewInputError, normalizedAccountKey, type AgentReviewDocument } from './review.js'
import type { Creator, Platform } from './types.js'

export const MANUAL_FEEDBACK_HEADERS = [
  'round_id', 'platform', 'handle', 'manual_eligible', 'manual_adopted',
  'manual_content_fit', 'manual_engagement', 'manual_comment_authenticity',
  'manual_reject_reason', 'manual_note',
] as const
export const MANUAL_REJECT_REASONS = [
  '商家号', '内容不匹配', '过度商业化', '植入生硬', '语气不符',
  '审美不符', '互动弱', '账号或数据错配', '其他',
] as const
export type ManualVerdict = 'yes' | 'no' | 'unknown'
export type ManualLevel = 'high' | 'medium' | 'low' | 'unknown'
export interface ManualFeedbackRow {
  round_id: string
  platform: Platform
  handle: string
  account_key: string
  line_number: number
  manual_eligible?: ManualVerdict
  manual_adopted?: ManualVerdict
  manual_content_fit?: ManualLevel
  manual_engagement?: ManualLevel
  manual_comment_authenticity?: ManualLevel
  manual_reject_reason?: string
  manual_note: string
}

/** D23：只读解析人工 CSV；document 已校验，creators 须为过滤或投影前的完整已有显式关联名单。 */
export function parseManualFeedbackCsv(
  text: string, file: string, document: AgentReviewDocument, creators: readonly Creator[],
): ManualFeedbackRow[] {
  const records = csvRecords(text, file)
  const header = records.shift()
  if (!header || header.values.length !== MANUAL_FEEDBACK_HEADERS.length ||
    header.values.some((value, i) => value !== MANUAL_FEEDBACK_HEADERS[i])) {
    throw new ReviewInputError([`${file}:${header?.line ?? 1} 表头必须严格使用约定的十列及顺序`])
  }
  const pool = new Map(document.rounds.flatMap(round =>
    round.candidates.map(candidate => [candidate.account_key, round.round_id] as const)))
  const roundIds = new Set(document.rounds.map(round => round.round_id))
  const first = new Map<string, number>()
  const byAccount = new Map<string, Array<Pick<ManualFeedbackRow, 'account_key' | 'line_number' | 'manual_adopted'>>>()
  const problems: string[] = [], rows: ManualFeedbackRow[] = []
  for (const record of records) {
    const at = `${file}:${record.line}`
    if (record.values.length !== MANUAL_FEEDBACK_HEADERS.length) {
      problems.push(`${at} 必须恰为十列，收到 ${record.values.length} 列`)
    }
    const [round_id, platformText, handleText] = record.values
    const judgments = record.values.slice(3, 8).map(value => value.trim())
    for (const [i, value] of judgments.entries()) {
      const options = i < 2 ? ['yes', 'no', 'unknown'] : ['high', 'medium', 'low', 'unknown']
      if (value && !options.includes(value)) problems.push(`${at} ${MANUAL_FEEDBACK_HEADERS[i + 3]} 非法：${JSON.stringify(value)}`)
    }
    const reason = record.values[8]
    if (reason !== undefined && reason.trim() && reason.split(/[;；]/).some(part =>
      !MANUAL_REJECT_REASONS.includes(part.trim() as typeof MANUAL_REJECT_REASONS[number]))) {
      problems.push(`${at} manual_reject_reason 含非法或空原因片段`)
    }
    if (judgments[0] === 'no' && judgments[1] === 'yes') {
      problems.push(`${at} manual_eligible=no 与 manual_adopted=yes 冲突`)
    }
    if (!roundIds.has(round_id)) problems.push(`${at} round_id ${JSON.stringify(round_id)} 不存在或缺失`)
    // Validate both identity fields independently before forming a canonical key.
    let platform: Platform | undefined, handle: string | undefined
    try { if (platformText !== undefined) platform = normalizedAccountKey(platformText.trim(), 'validation').split(':')[0] as Platform }
    catch (error) { problems.push(`${at} platform 非法：${(error as Error).message}`) }
    try { if (handleText !== undefined) handle = normalizedAccountKey('tiktok', handleText.trim()).split(':')[1] }
    catch (error) { problems.push(`${at} handle 非法：${(error as Error).message}`) }
    if (platform === undefined || handle === undefined) continue
    const account_key = normalizedAccountKey(platform, handle)
    const expectedRound = pool.get(account_key)
    if (expectedRound === undefined) problems.push(`${at} ${account_key} 不在冻结候选池`)
    else if (expectedRound !== round_id) problems.push(`${at} ${account_key} round_id 应为 ${JSON.stringify(expectedRound)}`)
    const earlier = first.get(account_key)
    if (earlier !== undefined) problems.push(`${at} ${account_key} 重复，首次位于 ${file}:${earlier}`)
    else first.set(account_key, record.line)
    const identity = { account_key, line_number: record.line, manual_adopted: judgments[1] as ManualVerdict | undefined }
    const accountRows = byAccount.get(account_key)
    if (accountRows) accountRows.push(identity)
    else byAccount.set(account_key, [identity])
    // Available fields can still be checked on a bad-width record, but no padded or truncated row is produced.
    if (record.values.length !== MANUAL_FEEDBACK_HEADERS.length) continue
    const row: ManualFeedbackRow = { round_id, platform, handle, account_key, line_number: record.line, manual_note: record.values[9] }
    if (judgments[0]) row.manual_eligible = judgments[0] as ManualVerdict
    if (judgments[1]) row.manual_adopted = judgments[1] as ManualVerdict
    if (judgments[2]) row.manual_content_fit = judgments[2] as ManualLevel
    if (judgments[3]) row.manual_engagement = judgments[3] as ManualLevel
    if (judgments[4]) row.manual_comment_authenticity = judgments[4] as ManualLevel
    if (reason.trim()) row.manual_reject_reason = reason
    rows.push(row)
  }
  const pairs = new Set<string>()
  for (const creator of creators) {
    const pair = explicitPair(creator)
    if (!pair) continue
    const pairKey = JSON.stringify([...pair].sort())
    if (pairs.has(pairKey)) continue
    pairs.add(pairKey)
    for (const a of byAccount.get(pair[0]) ?? []) for (const b of byAccount.get(pair[1]) ?? []) {
      if ((a.manual_adopted === 'yes' && b.manual_adopted === 'no') ||
        (a.manual_adopted === 'no' && b.manual_adopted === 'yes')) {
        problems.push(`${file}:${a.line_number} ${a.account_key} 与 ${file}:${b.line_number} ${b.account_key} 的 manual_adopted=yes/no 冲突`)
      }
    }
  }
  if (problems.length) throw new ReviewInputError(problems)
  return rows
}

/** D23.i：名单只提供直接、合法的异平台关联，不扩展冻结候选池或推断关系。 */
function explicitPair(creator: Creator): [string, string] | undefined {
  try {
    const primary = normalizedAccountKey(creator.platform, creator.handle)
    if (typeof creator.linked_handle !== 'string') return undefined
    const parts = creator.linked_handle.split(':')
    if (parts.length !== 2) return undefined
    const linked = normalizedAccountKey(parts[0], parts[1])
    if (primary.split(':')[0] === linked.split(':')[0]) return undefined
    return [primary, linked]
  } catch { return undefined }
}

/** D23.b–c：严格 CSV 解码；位置保留为每条记录的起始物理行。 */
function csvRecords(raw: string, file: string): Array<{ values: string[]; line: number }> {
  const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw
  const records: Array<{ values: string[]; line: number }> = []
  let values: string[] = [], cell = '', quoted = false, closed = false, touched = false
  let line = 1, start = 1
  const fail = (message: string): never => { throw new ReviewInputError([`${file}:${start} ${message}`]) }
  const field = (): void => { values.push(cell); cell = ''; closed = false }
  const record = (): void => {
    if (touched) { field(); records.push({ values, line: start }) }
    values = []; cell = ''; closed = false; touched = false
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else { quoted = false; closed = true }
      } else {
        cell += char
        if (char === '\n') line++
      }
      continue
    }
    if (char === ',') { touched = true; field(); continue }
    if (char === '\n' || char === '\r') {
      if (char === '\r') {
        if (text[i + 1] !== '\n') fail('引号外独立 CR 非法')
        i++
      }
      record(); line++; start = line
      continue
    }
    if (closed) fail('结束引号后只允许分隔符或换行')
    if (char === '"') {
      if (cell.length) fail('双引号只能位于字段开头')
      quoted = true; touched = true
    } else { cell += char; touched = true }
  }
  if (quoted) fail('未闭合的双引号')
  record()
  return records
}
