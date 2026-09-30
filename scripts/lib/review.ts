import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from './atomic.js'
import {
  ADOPTION_PRIORITIES, DIMENSIONS, ELIGIBILITIES, PLATFORMS, creatorKey,
  type AdoptionPriority, type Creator, type Dimension, type Eligibility, type Fit, type Platform, type TaskState,
} from './types.js'

/** D21：任务级 Agent 评审正本；采集原件与人工反馈由其他文件拥有。 */
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

export interface AgentReviewDocument {
  version: 1
  updated_at: string
  reviews: Record<string, AgentReview>
  rounds: ReviewRound[]
}

export interface ReviewSourceTask {
  task_index: number
  keyword: string
  dimension: Dimension
  platform: Platform
}

export interface ReviewRoundCandidate {
  account_key: string
  source_tasks: ReviewSourceTask[] | null
}

export interface ReviewRound {
  round_id: string
  created_at: string
  source: 'task.json'
  candidates: ReviewRoundCandidate[]
}

/** D22：按旧池、当前新账号的顺序冻结平台账号候选；tasks 须先通过 taskListProblems，不改输入。 */
export function freezeReviewRounds(
  document: AgentReviewDocument, state: Pick<TaskState, 'tasks'>,
  previousCreators: readonly Creator[], currentCreators: readonly Creator[], createdAt: string,
): AgentReviewDocument {
  if (!nonblank(createdAt)) throw new ReviewInputError(['新轮 created_at 必须是非空字符串'])
  const frozen = validatedDocument(document, 'agent-review.json')
  const problems = reviewRoundSourceProblems(frozen, state)
  if (problems.length) throw new ReviewInputError(problems)
  const known = new Set(frozen.rounds.flatMap(round => round.candidates.map(candidate => candidate.account_key)))
  const append = (creators: readonly Creator[]): void => {
    const added = new Map<string, ReviewRoundCandidate>()
    for (const creator of creators) for (const account_key of roundAccounts(creator)) {
      if (known.has(account_key)) continue
      const sources = roundSources(creator, state, account_key)
      const candidate = added.get(account_key)
      if (!candidate) added.set(account_key, { account_key, source_tasks: sources })
      else if (candidate.source_tasks === null || sources === null) candidate.source_tasks = null
      else {
        const indices = new Set(candidate.source_tasks.map(source => source.task_index))
        candidate.source_tasks.push(...sources.filter(source => !indices.has(source.task_index)))
      }
    }
    if (!added.size) return
    const last = frozen.rounds.reduce((max, round) => {
      const digits = /^round-(\d+)$/.exec(round.round_id)?.[1]
      const value = digits === undefined ? 0n : BigInt(digits)
      return value > max ? value : max
    }, 0n)
    frozen.rounds.push({
      round_id: `round-${String(last + 1n).padStart(3, '0')}`,
      created_at: createdAt, source: 'task.json', candidates: [...added.values()].map(candidate => ({
        ...candidate, source_tasks: candidate.source_tasks?.length ? candidate.source_tasks : null,
      })),
    })
    for (const key of added.keys()) known.add(key)
  }
  append(previousCreators)
  append(currentCreators)
  return frozen
}

/** D22：核对已校验正本的冻结来源；tasks 须先通过 taskListProblems，只读同下标元数据。 */
export function reviewRoundSourceProblems(
  document: AgentReviewDocument, state: Pick<TaskState, 'tasks'>,
): string[] {
  const problems: string[] = []
  for (const [i, round] of document.rounds.entries()) for (const [j, candidate] of round.candidates.entries()) {
    if (candidate.source_tasks === null) continue
    for (const [k, source] of candidate.source_tasks.entries()) {
      const task = state.tasks[source.task_index]
      const at = `rounds[${i}].candidates[${j}].source_tasks[${k}]`
      if (!task) { problems.push(`${at}.task_index ${source.task_index} 超出 task.json 原任务范围`); continue }
      const changed = (['keyword', 'dimension', 'platform'] as const).filter(field => source[field] !== task[field])
      if (changed.length) problems.push(`${at} ${changed.join('、')} 与 task.json 原任务 ${source.task_index} 不一致`)
    }
  }
  return problems
}

function roundAccounts(creator: Creator): string[] {
  let primary: string
  try { primary = normalizedAccountKey(creator.platform, creator.handle) }
  catch { return [] }
  const parts = typeof creator.linked_handle === 'string' ? creator.linked_handle.split(':') : undefined
  if (parts?.length !== 2) return [primary]
  try {
    const linked = normalizedAccountKey(parts[0], parts[1])
    return linked.split(':')[0] === primary.split(':')[0] ? [primary] : [primary, linked]
  } catch { return [primary] }
}

function roundSources(
  creator: Creator, state: Pick<TaskState, 'tasks'>, accountKey: string,
): ReviewSourceTask[] | null {
  const indices = creator.source_tasks
  if (!Array.isArray(indices) || !indices.length ||
    [...indices].some(index => !Number.isSafeInteger(index) || index < 0 || index >= state.tasks.length)) return null
  // A valid record without this platform's tasks can still meet another record's proven sources.
  return [...new Set(indices)].flatMap(index => {
    const task = state.tasks[index]
    return task.platform === accountKey.split(':')[0]
      ? [{ task_index: index, keyword: task.keyword, dimension: task.dimension, platform: task.platform }]
      : []
  })
}

export type AgentReviewRead =
  | { status: 'absent'; document: AgentReviewDocument }
  | { status: 'present'; document: AgentReviewDocument }

export class ReviewInputError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'))
    this.name = 'ReviewInputError'
  }
}

const reviewFile = (dir: string): string => join(dir, 'agent-review.json')
const object = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
const nonblank = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim()
const oneOf = (value: unknown, options: readonly string[]): boolean =>
  typeof value === 'string' && options.includes(value)

/** A dot and an underscore identify different accounts; case and a leading @ do not. */
export function normalizedAccountKey(platform: unknown, handle: unknown): string {
  const p = typeof platform === 'string' ? platform.toLowerCase() : platform
  if (!oneOf(p, PLATFORMS)) throw new Error(`platform 必须是 ${PLATFORMS.join(' 或 ')}，收到 ${String(platform)}`)
  if (!nonblank(handle)) throw new Error('handle 不能为空')
  const h = handle.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9._]+$/.test(h)) throw new Error(`handle ${JSON.stringify(handle)} 含无效字符`)
  return creatorKey({ platform: p as string, handle: h })
}

function accountKeyFromText(value: unknown): string {
  if (typeof value !== 'string') throw new Error('账号键不是字符串')
  const parts = value.split(':')
  if (parts.length !== 2) throw new Error(`账号键 ${JSON.stringify(value)} 必须是 platform:handle`)
  const key = normalizedAccountKey(parts[0], parts[1])
  if (value !== key) throw new Error(`账号键 ${JSON.stringify(value)} 未规范化，应写 ${key}`)
  return key
}

/** JSON.parse accepts duplicate properties; this scanner rejects them at every object depth. */
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

function roundDocumentProblems(rounds: unknown[], file: string): string[] {
  const problems: string[] = []
  const ids = new Set<string>(), pooled = new Set<string>()
  for (const [i, round] of rounds.entries()) {
    const at = `${file} rounds[${i}]`
    if (!object(round)) { problems.push(`${at} 必须是对象`); continue }
    if (!nonblank(round.round_id)) problems.push(`${at}.round_id 必须是非空字符串`)
    else {
      if (ids.has(round.round_id)) problems.push(`${at}.round_id 重复 ${round.round_id}`)
      ids.add(round.round_id)
    }
    if (!nonblank(round.created_at)) problems.push(`${at}.created_at 必须是非空字符串`)
    if (round.source !== 'task.json') problems.push(`${at}.source 必须是 task.json`)
    if (!Array.isArray(round.candidates)) { problems.push(`${at}.candidates 必须是数组`); continue }
    for (const [j, candidate] of round.candidates.entries()) {
      const place = `${at}.candidates[${j}]`
      if (!object(candidate)) { problems.push(`${place} 必须是对象`); continue }
      let key: string | undefined
      try {
        key = accountKeyFromText(candidate.account_key)
        if (pooled.has(key)) problems.push(`${place}.account_key ${key} 重复或已在旧轮`)
        pooled.add(key)
      } catch (error) { problems.push(`${place}.account_key：${String(error)}`) }
      if (candidate.source_tasks === null) continue
      if (!Array.isArray(candidate.source_tasks) || !candidate.source_tasks.length) {
        problems.push(`${place}.source_tasks 必须是非空数组或 null`)
        continue
      }
      const indices = new Set<number>()
      for (const [k, source] of candidate.source_tasks.entries()) {
        const sourceAt = `${place}.source_tasks[${k}]`
        if (!object(source)) { problems.push(`${sourceAt} 必须是对象`); continue }
        const index = source.task_index
        if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) {
          problems.push(`${sourceAt}.task_index 必须是非负安全整数`)
        } else {
          if (indices.has(index)) problems.push(`${sourceAt}.task_index ${index} 重复`)
          indices.add(index)
        }
        if (!nonblank(source.keyword)) problems.push(`${sourceAt}.keyword 必须是非空字符串`)
        if (!oneOf(source.dimension, DIMENSIONS)) problems.push(`${sourceAt}.dimension 取值无效`)
        if (!oneOf(source.platform, PLATFORMS)) problems.push(`${sourceAt}.platform 取值无效`)
        else if (key && source.platform !== key.split(':')[0]) problems.push(`${sourceAt}.platform 与候选账号平台不一致`)
      }
    }
  }
  return problems
}

function validatedDocument(value: unknown, file: string): AgentReviewDocument {
  if (!object(value)) throw new ReviewInputError([`${file} 根结构必须是对象`])
  const problems: string[] = []
  if (value.version !== 1) problems.push(`${file} version 必须是 1`)
  if (typeof value.updated_at !== 'string') problems.push(`${file} updated_at 必须是字符串`)
  if (!object(value.reviews)) problems.push(`${file} reviews 必须是对象`)
  if (!Array.isArray(value.rounds)) problems.push(`${file} rounds 必须是数组`)
  else problems.push(...roundDocumentProblems(value.rounds, file))
  if (problems.length) throw new ReviewInputError(problems)

  const owners = new Map<string, string>()
  const primaryKeys = new Map<string, string>()
  for (const [id, review] of Object.entries(value.reviews as Record<string, unknown>)) {
    const at = `${file} reviews[${JSON.stringify(id)}]`
    let primary: string | undefined
    try { primary = accountKeyFromText(id) }
    catch (error) {
      problems.push(`${at}：${String(error)}`)
      // Even a noncanonical key can collide with another record once normalized.
      try {
        const parts = id.split(':')
        if (parts.length === 2) primary = normalizedAccountKey(parts[0], parts[1])
      } catch { /* The malformed key cannot establish an identity. */ }
    }
    if (primary) {
      const first = primaryKeys.get(primary)
      if (first) problems.push(`${at} 规范化后与 reviews[${JSON.stringify(first)}] 重复主键 ${primary}`)
      else primaryKeys.set(primary, id)
    }
    if (!object(review)) { problems.push(`${at} 必须是对象`); continue }
    if (!Array.isArray(review.account_keys)) {
      problems.push(`${at}.account_keys 必须是数组`)
      continue
    }
    const aliases = new Set<string>()
    for (const [index, alias] of review.account_keys.entries()) {
      const aliasAt = `${at}.account_keys[${index}]`
      let key: string
      try { key = accountKeyFromText(alias) }
      catch (error) { problems.push(`${aliasAt}：${String(error)}`); continue }
      if (aliases.has(key)) problems.push(`${aliasAt} 重复别名 ${key}`)
      aliases.add(key)
      if (primary && key.split(':')[0] !== primary.split(':')[0]) {
        problems.push(`${aliasAt} ${key} 与主键分属不同平台`)
      }
      const first = owners.get(key)
      if (first && first !== id) problems.push(`${aliasAt} ${key} 已由 reviews[${JSON.stringify(first)}] 使用`)
      else owners.set(key, id)
    }
    if (!aliases.has(id)) problems.push(`${at}.account_keys 必须包含自身键 ${id}`)

    for (const [field, values] of [
      ['eligibility', ELIGIBILITIES], ['adoption_priority', ADOPTION_PRIORITIES], ['fit', ['✅', '⚠️', '❌']],
    ] as const) {
      if (review[field] !== undefined && !oneOf(review[field], values)) problems.push(`${at}.${field} 取值无效`)
    }
    for (const field of [
      'observed_content', 'work_evidence', 'natural_integration', 'mismatch_risk',
      'fit_reason', 'outreach_draft', 'brand_calibration_version', 'reviewed_at',
    ]) {
      if (review[field] !== undefined && typeof review[field] !== 'string') problems.push(`${at}.${field} 必须是字符串`)
    }
    if (review.eligibility === '不合格' && review.fit === '✅') problems.push(`${at}.fit 与 eligibility 自相矛盾`)
    if (review.eligibility === '不合格' && review.adoption_priority === '优先联系') {
      problems.push(`${at}.adoption_priority 与 eligibility 自相矛盾`)
    }
    const newReview = [
      'eligibility', 'adoption_priority', 'observed_content', 'work_evidence',
      'natural_integration', 'mismatch_risk', 'brand_calibration_version',
    ].some(field => review[field] !== undefined)
    if (newReview) {
      if (!oneOf(review.eligibility, ELIGIBILITIES)) problems.push(`${at}.eligibility 新评审必填`)
      if (!oneOf(review.adoption_priority, ADOPTION_PRIORITIES)) problems.push(`${at}.adoption_priority 新评审必填`)
      for (const field of ['observed_content', 'work_evidence', 'natural_integration', 'mismatch_risk']) {
        if (!nonblank(review[field])) problems.push(`${at}.${field} 已评候选须有非空证据`)
      }
    }
    if (review.adoption_priority === '优先联系' && !nonblank(review.natural_integration)) {
      problems.push(`${at}.natural_integration 优先联系须有具体植入场景`)
    }
  }
  if (problems.length) throw new ReviewInputError(problems)
  return structuredClone(value) as unknown as AgentReviewDocument
}

export function readAgentReviewDocument(dir: string): AgentReviewRead {
  const file = reviewFile(dir)
  try { lstatSync(file) }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return { status: 'absent', document: { version: 1, updated_at: '', reviews: {}, rounds: [] } }
    }
    throw new ReviewInputError([`${file} 无法检查：${String(error)}`])
  }
  let raw: string
  let value: unknown
  try { raw = readFileSync(file, 'utf8'); value = JSON.parse(raw) }
  catch (error) { throw new ReviewInputError([`${file} 无法读取 JSON：${String(error)}`]) }
  const duplicate = duplicateJsonKey(raw)
  if (duplicate) throw new ReviewInputError([`${file}:${duplicate.line} 重复 JSON 键 ${JSON.stringify(duplicate.key)}`])
  return { status: 'present', document: validatedDocument(value, file) }
}

export function writeAgentReviewDocument(dir: string, document: unknown): void {
  const file = reviewFile(dir)
  const valid = validatedDocument(document, file)
  writeFileAtomic(file, `${JSON.stringify(valid, null, 2)}\n`)
}
