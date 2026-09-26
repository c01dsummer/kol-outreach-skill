import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from './atomic.js'
import { loadCreators } from './task.js'
import type {
  AdoptionPriority, Creator, Eligibility, Fit, ManualFeedbackView, ManualLevel,
  ManualVerdict, Platform, ReviewStatus, TaskState,
} from './types.js'

/** Agent 评审归本文件所有；采集原件和人工 CSV 都不是它的写入目标。 */
export interface AgentReview {
  account_keys: string[]
  eligibility?: Eligibility
  adoption_priority?: AdoptionPriority
  observed_content?: string
  work_evidence?: string
  natural_integration?: string
  mismatch_risk?: string
  fit?: Fit
  fit_reason?: string
  outreach_draft?: string
  brand_calibration_version?: string
  reviewed_at?: string
}

export interface ReviewSourceTask {
  task_index: number
  keyword: string
  dimension: string
  platform: Platform
}

export interface ReviewRoundCandidate {
  account_key: string
  /** null means that the old creator did not carry trustworthy task attribution. */
  source_tasks: ReviewSourceTask[] | null
}

export interface ReviewRound {
  round_id: string
  created_at: string
  source: 'task.json'
  candidates: ReviewRoundCandidate[]
}

export interface AgentReviewDocument {
  version: 1
  updated_at: string
  reviews: Record<string, AgentReview>
  rounds: ReviewRound[]
}

export interface ManualFeedbackRow extends ManualFeedbackView {
  platform: Platform
  handle: string
  line_number: number
}

export interface PreparedReviewProjection {
  creators: Creator[]
  document: AgentReviewDocument
  feedback: ManualFeedbackRow[]
}

export const MANUAL_FEEDBACK_HEADERS = [
  'round_id', 'platform', 'handle', 'manual_eligible', 'manual_adopted',
  'manual_content_fit', 'manual_engagement', 'manual_comment_authenticity',
  'manual_reject_reason', 'manual_note',
] as const

export const MANUAL_REJECT_REASONS = [
  '商家号', '内容不匹配', '过度商业化', '植入生硬', '语气不符',
  '审美不符', '互动弱', '账号或数据错配', '其他',
] as const

export class ReviewInputError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'))
    this.name = 'ReviewInputError'
  }
}

const reviewFile = (dir: string): string => join(dir, 'agent-review.json')
export const feedbackFile = (dir: string): string => join(dir, 'manual-feedback.csv')
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const nonblank = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T =>
  options.includes(v as T)

/** Check optional project input before any new task, resume, or report write. */
export function brandCalibrationProblems(state: unknown): string[] {
  if (!object(state) || !Object.hasOwn(state, 'brand_calibration')) return []
  const calibration = state.brand_calibration
  if (!object(calibration)) return ['brand_calibration 必须是对象；缺席可不填，null 不代表缺席']
  const problems: string[] = []
  if (!nonblank(calibration.version)) problems.push('brand_calibration.version 必须是非空字符串')
  for (const field of ['target_creator_types', 'tone_aesthetic', 'natural_scenarios', 'negative_signals']) {
    const values = calibration[field]
    if (!Array.isArray(values)) { problems.push(`brand_calibration.${field} 必须是字符串数组`); continue }
    for (const [index, value] of values.entries()) {
      if (!nonblank(value)) problems.push(`brand_calibration.${field}[${index}] 必须是非空字符串`)
    }
  }
  if (!Array.isArray(calibration.sources)) problems.push('brand_calibration.sources 必须是来源数组')
  else for (const [index, source] of calibration.sources.entries()) {
    const at = `brand_calibration.sources[${index}]`
    if (!object(source)) { problems.push(`${at} 必须是对象`); continue }
    if (!nonblank(source.source)) problems.push(`${at}.source 必须是非空字符串`)
    if (!oneOf(source.kind, ['brand_preference', 'verified_product_fact'])) {
      problems.push(`${at}.kind 必须是 brand_preference 或 verified_product_fact`)
    }
    if (!nonblank(source.detail)) problems.push(`${at}.detail 必须是非空字符串`)
  }
  return problems
}

/** Dot/underscore are significant in platform handles; only case and leading @ are presentation. */
export function normalizedAccountKey(platform: unknown, handle: unknown): string {
  const normalizedPlatform = typeof platform === 'string' ? platform.toLowerCase() : platform
  if (normalizedPlatform !== 'tiktok' && normalizedPlatform !== 'instagram') {
    throw new Error(`platform 必须是 tiktok 或 instagram，收到 ${String(platform)}`)
  }
  if (!nonblank(handle)) throw new Error('handle 不能为空')
  const normalized = handle.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9._]+$/.test(normalized)) {
    throw new Error(`handle ${JSON.stringify(handle)} 含无效字符；请填写平台账号名`)
  }
  return `${normalizedPlatform}:${normalized}`
}

function accountKeyFromText(value: unknown): string {
  if (typeof value !== 'string') throw new Error('账号键不是字符串')
  const separator = value.indexOf(':')
  if (separator < 0) throw new Error(`账号键 ${JSON.stringify(value)} 缺少平台前缀`)
  const key = normalizedAccountKey(value.slice(0, separator), value.slice(separator + 1))
  if (value !== key) throw new Error(`账号键 ${JSON.stringify(value)} 未规范化，应写 ${key}`)
  return key
}

function creatorAccounts(c: Creator): string[] {
  // Historical/provider creator rows may have handles outside platform username syntax.
  // They cannot establish a review identity; strict validation remains on the human
  // and Agent review files where a claimed account key is user-authored input.
  let primary: string
  try { primary = normalizedAccountKey(c.platform, c.handle) }
  catch { return [] }
  const keys = [primary]
  if (c.linked_handle) {
    try { keys.push(accountKeyFromText(c.linked_handle.toLowerCase())) }
    catch { /* Old malformed linked_handle is not evidence of an account. */ }
  }
  return [...new Set(keys)]
}

function duplicateJsonKey(raw: string): { key: string; line: number } | undefined {
  const levels: Array<Set<string> | null> = []
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    if (char === '{') { levels.push(new Set()); continue }
    if (char === '[') { levels.push(null); continue }
    if (char === '}' || char === ']') { levels.pop(); continue }
    if (char !== '"') continue
    let end = i + 1
    while (end < raw.length && raw[end] !== '"') end += raw[end] === '\\' ? 2 : 1
    let next = end + 1
    while (next < raw.length && /\s/.test(raw[next])) next++
    const level = levels[levels.length - 1]
    if (raw[next] === ':' && level) {
      const key = JSON.parse(raw.slice(i, end + 1)) as string
      if (level.has(key)) return { key, line: raw.slice(0, i).split('\n').length }
      level.add(key)
    }
    i = end
  }
  return undefined
}

function parseReviewDocument(dir: string): AgentReviewDocument {
  const file = reviewFile(dir)
  if (!existsSync(file)) return { version: 1, updated_at: '', reviews: {}, rounds: [] }
  let source: unknown
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
    source = JSON.parse(raw)
  }
  catch (e) { throw new ReviewInputError([`${file} 无法读取 JSON：${String(e)}`]) }
  const duplicate = duplicateJsonKey(raw)
  if (duplicate) throw new ReviewInputError([`${file}:${duplicate.line} 重复 JSON 键 ${JSON.stringify(duplicate.key)}`])
  const errors: string[] = []
  if (!object(source) || source.version !== 1 || !object(source.reviews) || !Array.isArray(source.rounds)) {
    throw new ReviewInputError([`${file} 根对象须有 version:1、reviews 对象和 rounds 数组`])
  }
  const doc = source as unknown as AgentReviewDocument
  const keys = new Map<string, string>()
  for (const [id, review] of Object.entries(doc.reviews)) {
    const place = `${file} reviews[${JSON.stringify(id)}]`
    try { accountKeyFromText(id) } catch (e) { errors.push(`${place}：${String(e)}`) }
    if (!object(review) || !Array.isArray(review.account_keys)) {
      errors.push(`${place}.account_keys 必须是数组`)
      continue
    }
    const aliases = new Set<string>()
    for (const [i, alias] of review.account_keys.entries()) {
      try {
        const key = accountKeyFromText(alias)
        if (aliases.has(key)) errors.push(`${place}.account_keys[${i}] 重复：${key}`)
        aliases.add(key)
      } catch (e) { errors.push(`${place}.account_keys[${i}]：${String(e)}`) }
    }
    if (!aliases.has(id)) errors.push(`${place}.account_keys 必须包含自身键 ${id}`)
    for (const key of aliases) {
      if (key.split(':')[0] !== id.split(':')[0]) {
        errors.push(`${place}.account_keys 不得把另一平台 ${key} 当作本平台已评`)
      }
      const owner = keys.get(key)
      if (owner && owner !== id) errors.push(`${place}.account_keys 与 reviews[${JSON.stringify(owner)}] 冲突：${key}`)
      keys.set(key, id)
    }
    const enumFields: Array<[string, readonly string[]]> = [
      ['eligibility', ['合格', '不合格', '待核实']],
      ['adoption_priority', ['优先联系', '备选', '待核实', '暂不采用']],
      ['fit', ['✅', '⚠️', '❌']],
    ]
    for (const [field, options] of enumFields) {
      if (review[field] !== undefined && !oneOf(review[field], options)) errors.push(`${place}.${field} 非法：${String(review[field])}`)
    }
    for (const field of ['observed_content', 'work_evidence', 'natural_integration', 'mismatch_risk',
      'fit_reason', 'outreach_draft', 'brand_calibration_version', 'reviewed_at']) {
      if (review[field] !== undefined && typeof review[field] !== 'string') errors.push(`${place}.${field} 必须是字符串`)
    }
    if (review.eligibility === '不合格' && review.fit === '✅') {
      errors.push(`${place}.fit 与 eligibility 自相矛盾`)
    }
    if (review.eligibility === '不合格' && review.adoption_priority === '优先联系') {
      errors.push(`${place}.adoption_priority 与 eligibility=不合格 冲突`)
    }
    const newReview = ['eligibility', 'adoption_priority', 'observed_content', 'work_evidence',
      'natural_integration', 'mismatch_risk', 'brand_calibration_version']
      .some(field => review[field] !== undefined)
    if (newReview) {
      if (!oneOf(review.eligibility, ['合格', '不合格', '待核实'])) {
        errors.push(`${place}.eligibility 新评审必须填写合格／不合格／待核实`)
      }
      if (!oneOf(review.adoption_priority, ['优先联系', '备选', '待核实', '暂不采用'])) {
        errors.push(`${place}.adoption_priority 新评审必须填写优先联系／备选／待核实／暂不采用`)
      }
      for (const field of ['observed_content', 'work_evidence', 'natural_integration', 'mismatch_risk']) {
        if (!nonblank(review[field])) errors.push(`${place}.${field}：已评候选必须填写非空证据`)
      }
    }
    if (review.adoption_priority === '优先联系' && !nonblank(review.natural_integration)) {
      errors.push(`${place}.natural_integration 缺少具体植入场景，不能给优先联系`)
    }
  }
  const roundIds = new Set<string>()
  const pooled = new Map<string, string>()
  for (const [i, round] of doc.rounds.entries()) {
    const place = `${file} rounds[${i}]`
    if (!object(round) || !nonblank(round.round_id) || !Array.isArray(round.candidates) || round.source !== 'task.json') {
      errors.push(`${place} 须有 round_id、source:task.json 和 candidates 数组`)
      continue
    }
    if (roundIds.has(round.round_id)) errors.push(`${place}.round_id 重复：${round.round_id}`)
    roundIds.add(round.round_id)
    for (const [j, candidate] of round.candidates.entries()) {
      const at = `${place}.candidates[${j}]`
      if (!object(candidate)) { errors.push(`${at} 必须是对象`); continue }
      try {
        const key = accountKeyFromText(candidate.account_key)
        const prior = pooled.get(key)
        if (prior) errors.push(`${at}.account_key ${key} 已在 ${prior}`)
        pooled.set(key, at)
      } catch (e) { errors.push(`${at}：${String(e)}`) }
      if (candidate.source_tasks !== null && !Array.isArray(candidate.source_tasks)) {
        errors.push(`${at}.source_tasks 须为数组或 null`)
      }
    }
  }
  if (errors.length) throw new ReviewInputError(errors)
  return structuredClone(doc)
}

function sourceTasks(c: Creator, state: TaskState, accountKey: string): ReviewSourceTask[] | null {
  if (!Array.isArray(c.source_tasks) || !c.source_tasks.length) return null
  const tasks: ReviewSourceTask[] = []
  const platform = accountKey.split(':')[0]
  for (const index of c.source_tasks) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= state.tasks.length) return null
    const task = state.tasks[index]
    if (task.platform !== platform) continue
    tasks.push({ task_index: index, keyword: task.keyword, dimension: task.dimension, platform: task.platform })
  }
  return tasks.length ? tasks : null
}

function freezeNewRound(doc: AgentReviewDocument, state: TaskState, creators: Creator[]): void {
  const known = new Set(doc.rounds.flatMap(round => round.candidates.map(candidate => candidate.account_key)))
  const added = new Map<string, ReviewRoundCandidate>()
  for (const creator of creators) {
    for (const account_key of creatorAccounts(creator)) {
      if (!known.has(account_key) && !added.has(account_key)) {
        added.set(account_key, { account_key, source_tasks: sourceTasks(creator, state, account_key) })
      }
    }
  }
  if (!added.size) return
  const numbers = doc.rounds.map(round => /^round-(\d+)$/.exec(round.round_id)?.[1]).filter(Boolean).map(Number)
  const next = Math.max(0, ...numbers) + 1
  doc.rounds.push({
    round_id: `round-${String(next).padStart(3, '0')}`,
    created_at: new Date().toISOString(), source: 'task.json', candidates: [...added.values()],
  })
}

function roundSourceProblems(doc: AgentReviewDocument, state: TaskState): string[] {
  const problems: string[] = []
  for (const [i, round] of doc.rounds.entries()) for (const [j, candidate] of round.candidates.entries()) {
    const source = candidate.source_tasks
    if (source === null) continue
    const at = `rounds[${i}].candidates[${j}].source_tasks`
    if (!Array.isArray(source) || !source.length) { problems.push(`${at} 须为非空数组或 null（历史来源未知）`); continue }
    const seen = new Set<number>()
    for (const [k, item] of source.entries()) {
      const location = `${at}[${k}]`
      if (!object(item) || !Number.isSafeInteger(item.task_index) || (item.task_index as number) < 0 ||
        (item.task_index as number) >= state.tasks.length || !nonblank(item.keyword) ||
        !nonblank(item.dimension) || !oneOf(item.platform, ['tiktok', 'instagram'])) {
        problems.push(`${location} 任务来源字段不合规`)
        continue
      }
      const index = item.task_index as number
      if (seen.has(index)) problems.push(`${location}.task_index ${index} 重复`)
      seen.add(index)
      const task = state.tasks[index]
      if (item.keyword !== task.keyword || item.dimension !== task.dimension || item.platform !== task.platform ||
        item.platform !== candidate.account_key.split(':')[0]) {
        problems.push(`${location} 与 task.json 原任务 ${index} 或候选账号平台不一致`)
      }
    }
  }
  return problems
}

function lookupReview(doc: AgentReviewDocument, accounts: string[]): AgentReview | undefined {
  for (const key of accounts) if (doc.reviews[key]) return doc.reviews[key]
  for (const review of Object.values(doc.reviews)) {
    if (accounts.some(key => review.account_keys.includes(key))) return review
  }
  return undefined
}

function migrateLegacy(doc: AgentReviewDocument, creators: Creator[]): void {
  for (const creator of creators) {
    const id = creatorAccounts(creator)[0]
    if (!id) continue
    if (lookupReview(doc, [id])) continue
    // Once a creator has been projected from the new review document, that document is
    // authoritative. Its removal must not resurrect the projection as a legacy review.
    if (creator.review_status !== undefined && creator.review_status !== '未评') continue
    if (['eligibility', 'adoption_priority', 'brand_calibration_version',
      'observed_content', 'work_evidence', 'natural_integration', 'mismatch_risk']
      .some(field => creator[field as keyof Creator] !== undefined)) continue
    if (creator.fit === undefined && creator.fit_reason === undefined && creator.outreach_draft === undefined) continue
    const review: AgentReview = { account_keys: [id] }
    for (const field of ['fit', 'fit_reason', 'outreach_draft'] as const) {
      const value = creator[field]
      if (value !== undefined) (review as unknown as Record<string, unknown>)[field] = value
    }
    doc.reviews[id] = review
  }
}

interface CsvRow { values: string[]; line: number }

/** Excel compatible CSV, including BOM, CRLF, quotes and embedded newlines. */
function parseCsv(text: string, file: string): CsvRow[] {
  const input = text.replace(/^\uFEFF/, '')
  const rows: CsvRow[] = []
  let values: string[] = []
  let field = ''
  let quoted = false
  let closed = false
  let line = 1
  let start = 1
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else { field += char; if (char === '\n') line++ }
      continue
    }
    if (char === '"') {
      if (field || closed) throw new ReviewInputError([`${file}:${line} 引号位置非法`])
      quoted = true
      continue
    }
    if (char === ',') { values.push(field); field = ''; closed = false; continue }
    if (char === '\r' && input[i + 1] === '\n') { i++; line++ }
    else if (char === '\n') line++
    else {
      if (closed) throw new ReviewInputError([`${file}:${line} 结束引号后只能是逗号或换行`])
      field += char
      continue
    }
    values.push(field)
    if (values.some(value => value !== '')) rows.push({ values, line: start })
    values = []; field = ''; closed = false; start = line
  }
  if (quoted) throw new ReviewInputError([`${file}:${start} 引号未闭合`])
  if (values.length || field || closed) {
    values.push(field)
    if (values.some(value => value !== '')) rows.push({ values, line: start })
  }
  return rows
}

function manualRows(dir: string, doc: AgentReviewDocument): ManualFeedbackRow[] {
  const file = feedbackFile(dir)
  if (!existsSync(file)) return []
  let lines: CsvRow[]
  try { lines = parseCsv(readFileSync(file, 'utf8'), file) }
  catch (e) { if (e instanceof ReviewInputError) throw e; throw new ReviewInputError([`${file} 无法读取：${String(e)}`]) }
  const [header, ...body] = lines
  if (!header || header.values.length !== MANUAL_FEEDBACK_HEADERS.length ||
    header.values.some((value, i) => value !== MANUAL_FEEDBACK_HEADERS[i])) {
    throw new ReviewInputError([`${file}:1 表头须为 ${MANUAL_FEEDBACK_HEADERS.join(',')}`])
  }
  const pool = new Map(doc.rounds.flatMap(round => round.candidates.map(candidate =>
    [candidate.account_key, round.round_id] as const)))
  const errors: string[] = []
  const seen = new Map<string, number>()
  const result: ManualFeedbackRow[] = []
  for (const row of body) {
    const at = `${file}:${row.line}`
    if (row.values.length !== MANUAL_FEEDBACK_HEADERS.length) {
      errors.push(`${at} 列数 ${row.values.length}，应为 ${MANUAL_FEEDBACK_HEADERS.length}`)
      continue
    }
    const [round_id, platform, handle, eligible, adopted, contentFit, engagement,
      authenticity, rejectReason, note] = row.values.map(value => value.trim())
    let account_key: string
    try { account_key = normalizedAccountKey(platform, handle) }
    catch (e) { errors.push(`${at}：${String(e)}`); continue }
    const prior = seen.get(account_key)
    if (prior) errors.push(`${at} 与 ${file}:${prior} 重复账号 ${account_key}`)
    seen.set(account_key, row.line)
    const expectedRound = pool.get(account_key)
    if (!expectedRound) errors.push(`${at} ${account_key} 无法匹配已冻结候选池`)
    else if (round_id !== expectedRound) errors.push(`${at} round_id ${round_id} 与 ${account_key} 所属 ${expectedRound} 不符`)
    for (const [name, value] of [['manual_eligible', eligible], ['manual_adopted', adopted]] as const) {
      if (value && !oneOf(value, ['yes', 'no', 'unknown'])) errors.push(`${at} ${name} 非法值 ${JSON.stringify(value)}`)
    }
    for (const [name, value] of [['manual_content_fit', contentFit], ['manual_engagement', engagement],
      ['manual_comment_authenticity', authenticity]] as const) {
      if (value && !oneOf(value, ['high', 'medium', 'low', 'unknown'])) errors.push(`${at} ${name} 非法值 ${JSON.stringify(value)}`)
    }
    const reasons = rejectReason ? rejectReason.split(/[;；]/).map(part => part.trim()) : []
    for (const reason of reasons) {
      if (!oneOf(reason, MANUAL_REJECT_REASONS)) errors.push(`${at} manual_reject_reason 非法值 ${JSON.stringify(reason)}`)
    }
    if (eligible === 'no' && adopted === 'yes') errors.push(`${at} manual_eligible=no 与 manual_adopted=yes 冲突`)
    result.push({
      round_id, platform: account_key.split(':')[0] as Platform, handle, account_key, line_number: row.line,
      ...(eligible ? { manual_eligible: eligible as ManualVerdict } : {}),
      ...(adopted ? { manual_adopted: adopted as ManualVerdict } : {}),
      ...(contentFit ? { manual_content_fit: contentFit as ManualLevel } : {}),
      ...(engagement ? { manual_engagement: engagement as ManualLevel } : {}),
      ...(authenticity ? { manual_comment_authenticity: authenticity as ManualLevel } : {}),
      ...(rejectReason ? { manual_reject_reason: rejectReason } : {}),
      ...(note ? { manual_note: note } : {}),
      manual_reviewed: !!(eligible || adopted || contentFit || engagement || authenticity || rejectReason || note),
    })
  }
  if (errors.length) throw new ReviewInputError(errors)
  return result
}

function statusOf(review: AgentReview | undefined, version: string | undefined): ReviewStatus {
  if (!review?.eligibility || !review.adoption_priority) return '未评'
  if (review.brand_calibration_version !== version) return '待重评'
  return '已评'
}

function fitOf(review: AgentReview): Fit | undefined {
  if (review.fit !== undefined) return review.fit
  if (!review.eligibility || !review.adoption_priority) return undefined
  return review.eligibility === '合格' ? '✅' :
    review.eligibility === '不合格' ? '❌' :
      review.eligibility === '待核实' ? '⚠️' : undefined
}

function effectivePriority(c: Creator, manual: ManualFeedbackRow[]): {
  priority: AdoptionPriority; account_key?: string
} {
  const decisive = (predicate: (row: ManualFeedbackRow) => boolean) => manual.find(predicate)
  const yes = decisive(row => row.manual_adopted === 'yes')
  if (yes) return { priority: '优先联系', account_key: yes.account_key }
  const no = decisive(row => row.manual_adopted === 'no' || row.manual_eligible === 'no')
  if (no) return { priority: '暂不采用', account_key: no.account_key }
  const unknown = decisive(row => row.manual_adopted === 'unknown')
  if (unknown) return { priority: '待核实', account_key: unknown.account_key }
  if (c.review_status !== '已评') return { priority: '待核实' }
  return { priority: c.adoption_priority ?? '待核实' }
}

/** No writes occur until all review and manual input has passed validation. */
export function prepareReviewProjection(dir: string, state: TaskState, creators: Creator[]): PreparedReviewProjection {
  const calibrationProblems = brandCalibrationProblems(state)
  if (calibrationProblems.length) throw new ReviewInputError(calibrationProblems.map(problem =>
    `${join(dir, 'task.json')}：${problem}`))
  const document = parseReviewDocument(dir)
  const previousCreators = loadCreators(dir)
  migrateLegacy(document, previousCreators)
  migrateLegacy(document, creators)
  // The previous delivery is the already reviewed candidate pool. Freeze it first,
  // then put accounts introduced by a resumed collection into a separate round.
  freezeNewRound(document, state, previousCreators)
  freezeNewRound(document, state, creators)
  const sourceProblems = roundSourceProblems(document, state)
  if (sourceProblems.length) throw new ReviewInputError(sourceProblems.map(problem =>
    `${reviewFile(dir)} ${problem}`))
  // Migration may have added aliases; validate their uniqueness before accepting any manual input.
  const aliasOwner = new Map<string, string>()
  const aliasProblems: string[] = []
  const knownAccounts = new Set([
    ...document.rounds.flatMap(round => round.candidates.map(candidate => candidate.account_key)),
    ...previousCreators.flatMap(creatorAccounts), ...creators.flatMap(creatorAccounts),
  ])
  for (const [id, review] of Object.entries(document.reviews)) for (const alias of review.account_keys) {
    const previous = aliasOwner.get(alias)
    if (previous && previous !== id) aliasProblems.push(`${reviewFile(dir)} reviews ${previous} 与 ${id} 共用 ${alias}`)
    aliasOwner.set(alias, id)
  }
  for (const [id, review] of Object.entries(document.reviews)) {
    if (!review.account_keys.some(alias => knownAccounts.has(alias))) {
      aliasProblems.push(`${reviewFile(dir)} reviews[${JSON.stringify(id)}] 无法匹配冻结轮次或任务账号`)
    }
  }
  if (aliasProblems.length) throw new ReviewInputError(aliasProblems)
  const feedback = manualRows(dir, document)
  const feedbackByKey = new Map(feedback.map(row => [row.account_key, row]))
  const crossPlatformConflicts = new Set<string>()
  for (const creator of creators) {
    const rows = creatorAccounts(creator).flatMap(key => {
      const row = feedbackByKey.get(key)
      return row ? [row] : []
    })
    const yes = rows.find(row => row.manual_adopted === 'yes')
    const no = rows.find(row => row.manual_adopted === 'no')
    if (yes && no) crossPlatformConflicts.add(
      `${feedbackFile(dir)}:${yes.line_number} ${yes.account_key} 的 adopted=yes 与 ` +
      `${feedbackFile(dir)}:${no.line_number} ${no.account_key} 的 adopted=no 冲突；` +
      `同一候选行无法确定有效优先级`)
  }
  if (crossPlatformConflicts.size) throw new ReviewInputError([...crossPlatformConflicts])
  const roundByKey = new Map(document.rounds.flatMap(round => round.candidates.map(candidate =>
    [candidate.account_key, round.round_id] as const)))
  const projected = creators.map(original => {
    const c = { ...original }
    const accounts = creatorAccounts(c)
    const review = accounts[0] ? lookupReview(document, [accounts[0]]) : undefined
    // Do not trust stale projections from creators.json as a second source of judgment.
    for (const field of ['eligibility', 'adoption_priority', 'effective_priority', 'effective_priority_account_key', 'review_status',
      'observed_content', 'work_evidence', 'natural_integration', 'mismatch_risk',
      'brand_calibration_version', 'manual_eligible', 'manual_adopted', 'manual_content_fit',
      'manual_engagement', 'manual_comment_authenticity', 'manual_reject_reason', 'manual_note',
      'manual_reviewed', 'manual_round_id', 'manual_feedback_accounts', 'linked_agent_review'] as const) delete c[field]
    if (review) {
      for (const field of ['eligibility', 'adoption_priority', 'observed_content', 'work_evidence',
        'natural_integration', 'mismatch_risk', 'fit', 'fit_reason', 'outreach_draft',
        'brand_calibration_version'] as const) {
        const value = review[field]
        if (value !== undefined) (c as unknown as Record<string, unknown>)[field] = value
      }
      c.fit = fitOf(review)
    } else if (accounts.length) {
      delete c.fit; delete c.fit_reason; delete c.outreach_draft
    }
    c.review_status = statusOf(review, state.brand_calibration?.version)
    if (accounts[1]) {
      const linked = lookupReview(document, [accounts[1]])
      if (linked) c.linked_agent_review = {
        account_key: accounts[1], eligibility: linked.eligibility,
        adoption_priority: linked.adoption_priority,
        review_status: statusOf(linked, state.brand_calibration?.version),
        fit: fitOf(linked), fit_reason: linked.fit_reason,
      }
    }
    c.manual_round_id = accounts[0] ? roundByKey.get(accounts[0]) : undefined
    const accountRows = accounts.flatMap(key => {
      const row = feedbackByKey.get(key)
      return row ? [row] : []
    })
    c.manual_feedback_accounts = accountRows
    const manual = accounts[0] ? feedbackByKey.get(accounts[0]) : undefined
    if (manual) {
      for (const field of ['manual_eligible', 'manual_adopted', 'manual_content_fit', 'manual_engagement',
        'manual_comment_authenticity', 'manual_reject_reason', 'manual_note'] as const) {
        const value = manual[field]
        if (value !== undefined) (c as unknown as Record<string, unknown>)[field] = value
      }
      c.manual_reviewed = manual.manual_reviewed
    } else c.manual_reviewed = false
    const effective = effectivePriority(c, accountRows)
    c.effective_priority = effective.priority
    c.effective_priority_account_key = effective.account_key
    return c
  })
  return { creators: projected, document, feedback }
}

export function persistReviewProjection(dir: string, prepared: PreparedReviewProjection): void {
  const doc = structuredClone(prepared.document)
  doc.updated_at = new Date().toISOString()
  writeFileAtomic(reviewFile(dir), JSON.stringify(doc, null, 2))
}

/** Call before collect replaces creators.json. Legacy Agent fields are copied, never into raw data. */
export function preserveLegacyAgentReviews(dir: string, state: TaskState): void {
  const old = loadCreators(dir)
  const prepared = prepareReviewProjection(dir, state, old)
  persistReviewProjection(dir, prepared)
}

/** The standalone template command may create the file once; render never writes it. */
export function writeManualFeedbackTemplate(dir: string, document: AgentReviewDocument): string {
  const file = feedbackFile(dir)
  if (existsSync(file)) throw new ReviewInputError([`${file} 已存在；不会覆盖人工填写内容`])
  const escape = (value: string): string => /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const lines = [MANUAL_FEEDBACK_HEADERS.join(',')]
  for (const round of document.rounds) for (const candidate of round.candidates) {
    const [platform, handle] = candidate.account_key.split(':')
    lines.push([round.round_id, platform, handle, '', '', '', '', '', '', ''].map(escape).join(','))
  }
  writeFileAtomic(file, '\uFEFF' + lines.join('\r\n') + '\r\n')
  return file
}

/** Explicit template action for a resumed task: preserve every existing byte and add only new accounts. */
export function appendManualFeedbackTemplate(
  dir: string, document: AgentReviewDocument, feedback: ManualFeedbackRow[],
): { file: string; appended: number } {
  const file = feedbackFile(dir)
  if (!existsSync(file)) return { file: writeManualFeedbackTemplate(dir, document), appended:
    document.rounds.reduce((sum, round) => sum + round.candidates.length, 0) }
  const existing = readFileSync(file, 'utf8')
  const seen = new Set(feedback.map(row => row.account_key))
  const added: string[] = []
  for (const round of document.rounds) for (const candidate of round.candidates) {
    if (seen.has(candidate.account_key)) continue
    const [platform, handle] = candidate.account_key.split(':')
    added.push(`${round.round_id},${platform},${handle},,,,,,,`)
  }
  if (added.length) {
    const separator = existing.endsWith('\n') ? '' : '\r\n'
    writeFileAtomic(file, existing + separator + added.join('\r\n') + '\r\n')
  }
  return { file, appended: added.length }
}

export interface FeedbackSummary {
  rounds: Array<{ round_id: string; candidates: number; reviewed: number; unreviewed: number }>
  eligible: { yes: number; no: number; unknown: number; unreviewed: number; rate: number | null }
  adopted: { yes: number; no: number; unknown: number; unreviewed: number; rate: number | null }
  reject_reasons: Array<{ reason: string; count: number }>
  disagreements: string[]
}

/** Denominators include only explicit yes/no; unknown and blank are reported separately. */
export function feedbackSummary(document: AgentReviewDocument, feedback: ManualFeedbackRow[]): FeedbackSummary {
  const byKey = new Map(feedback.map(row => [row.account_key, row]))
  const all = document.rounds.flatMap(round => round.candidates.map(candidate => candidate.account_key))
  const tally = (field: 'manual_eligible' | 'manual_adopted') => {
    let yes = 0, no = 0, unknown = 0, unreviewed = 0
    for (const key of all) {
      const value = byKey.get(key)?.[field]
      if (value === 'yes') yes++
      else if (value === 'no') no++
      else if (value === 'unknown') unknown++
      else unreviewed++
    }
    return { yes, no, unknown, unreviewed, rate: yes + no ? yes / (yes + no) : null }
  }
  const reasons = new Map<string, number>()
  for (const row of feedback) if (row.manual_reject_reason) {
    for (const reason of row.manual_reject_reason.split(/[;；]/).map(value => value.trim())) {
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }
  }
  const aliasToReview = new Map<string, AgentReview>()
  for (const review of Object.values(document.reviews)) for (const key of review.account_keys) aliasToReview.set(key, review)
  const disagreements = [...new Set(feedback.flatMap(row => {
    const agent = aliasToReview.get(row.account_key)
    if (!agent?.eligibility || !agent.adoption_priority) return []
    const adoptionConflict = (row.manual_adopted === 'yes' && agent.adoption_priority !== '优先联系') ||
      ((row.manual_adopted === 'no' || row.manual_eligible === 'no') && agent.adoption_priority !== '暂不采用')
    const eligibilityConflict = (row.manual_eligible === 'no' && agent.eligibility === '合格') ||
      (row.manual_eligible === 'yes' && agent.eligibility === '不合格')
    return adoptionConflict || eligibilityConflict ? [row.account_key] : []
  }))]
  return {
    rounds: document.rounds.map(round => ({
      round_id: round.round_id, candidates: round.candidates.length,
      reviewed: round.candidates.filter(candidate => byKey.get(candidate.account_key)?.manual_reviewed).length,
      unreviewed: round.candidates.filter(candidate => !byKey.get(candidate.account_key)?.manual_reviewed).length,
    })),
    eligible: tally('manual_eligible'), adopted: tally('manual_adopted'),
    reject_reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    disagreements,
  }
}
