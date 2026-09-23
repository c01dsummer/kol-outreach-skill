/** D12 · 纯金额与费用账；不发请求、不写盘，生产接线与持久预留另行验证。 */
export type MicroUsd = number
export type FixedPriceCatalog = Readonly<Record<string, Readonly<Record<string, number>>>>
export type FrozenPrice = { endpoint: string; price_version: string; unit_micro_usd: MicroUsd }
export type CostLine = FrozenPrice & { http_200_count: number; unknown_result_count: number }
export type PendingAttempt = FrozenPrice & { attempt_id: number }
export type CostLedgerV1 = {
  schema: 1; currency: 'USD'; unit: 'micro_usd'; scope: 'task' | 'process'
  limit_micro_usd: MicroUsd; next_attempt_id: number; entries: CostLine[]; pending?: PendingAttempt
}
export type CostSnapshot = { cost_ledger: CostLedgerV1; requests: number }
export type CostSummary = {
  limit_micro_usd: number; occupied_micro_usd: number; remaining_micro_usd: number
  http_200_micro_usd: number; unknown_result_micro_usd: number; pending_micro_usd: number
  requests: number; http_200_count: number; unknown_result_count: number; pending_count: 0 | 1
}
export type CostProblem = { path: string; reason: string }
type UnavailableStatus = 'unknown-history' | 'unavailable-evidence' | 'invalid-ledger'
export type ExistingCost =
  | { status: 'known'; snapshot: CostSnapshot; summary: CostSummary; problems: [] }
  | { status: UnavailableStatus; problems: CostProblem[] }
export type CostErrorCode = 'invalid-money' | 'unknown-price' | 'pending-attempt'
  | 'invalid-receipt' | 'invalid-outcome' | 'budget-exceeded'
export class CostError extends Error {
  constructor(public readonly code: CostErrorCode, message: string) { super(message); this.name = 'CostError' }
}
export class CostLedgerUnavailable extends Error {
  constructor(public readonly status: UnavailableStatus, public readonly problems: CostProblem[]) {
    super(`${status}: ${problems.map(p => `${p.path}: ${p.reason}`).join('; ')}`)
    this.name = 'CostLedgerUnavailable'
  }
}
const max = BigInt(Number.MAX_SAFE_INTEGER)
const integer = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new CostError('invalid-money', `${path}: 必须是非负安全整数`)
  return value
}
const bounded = (value: bigint, path: string): number => {
  if (value < 0n || value > max) throw new CostError('invalid-money', `${path}: 超出安全整数范围`)
  return Number(value)
}
/** 原始十进制 token 转换；系数从不经过浮点数，也不展开巨大指数。 */
export function parseUsdMicros(token: string): MicroUsd {
  const m = typeof token === 'string' ? /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token) : null
  if (!m) throw new CostError('invalid-money', '金额必须是原始十进制文本')
  const fraction = m[3] === undefined ? '' : m[3]
  let digits = (m[2] + fraction).replace(/^0+/, '')
  if (!digits) return 0
  const exponent = m[4] === undefined ? '0' : m[4]
  if (m[1] === '-' || !Number.isSafeInteger(Number(exponent)))
    throw new CostError('invalid-money', '金额为负或指数超出范围')
  const trimmed = digits.replace(/0+$/, '')
  const shift = BigInt(exponent) - BigInt(fraction.length) + 6n + BigInt(digits.length - trimmed.length)
  digits = trimmed
  if (shift < 0n || BigInt(digits.length) + shift > 16n)
    throw new CostError('invalid-money', '金额超出微美元精度或范围')
  return bounded(BigInt(digits) * 10n ** shift, '金额')
}
export function formatUsd(micros: MicroUsd): string {
  integer(micros, '金额')
  const value = BigInt(micros), fraction = (value % 1000000n).toString().padStart(6, '0').replace(/0+$/, '')
  return `${value / 1000000n}${fraction ? '.' + fraction : ''}`
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const own = (value: object, key: string): boolean => Object.hasOwn(value, key)
function copyCatalog(raw: FixedPriceCatalog): FixedPriceCatalog {
  if (!object(raw)) throw new CostError('unknown-price', '价目表不是对象')
  const result: Record<string, Record<string, number>> = Object.create(null)
  for (const [version, prices] of Object.entries(raw)) {
    if (!version.trim() || !object(prices)) throw new CostError('unknown-price', '价目版本或表无效')
    result[version] = Object.create(null)
    for (const [endpoint, amount] of Object.entries(prices)) {
      if (!endpoint.trim()) throw new CostError('unknown-price', '价目端点为空')
      result[version][endpoint] = integer(amount, `价目.${version}.${endpoint}`)
    }
  }
  return result
}
function checkedPrice(raw: unknown, catalog: FixedPriceCatalog): FrozenPrice {
  if (!object(raw) || typeof raw.price_version !== 'string' || typeof raw.endpoint !== 'string'
    || !own(catalog, raw.price_version) || !own(catalog[raw.price_version], raw.endpoint)
    || raw.unit_micro_usd !== catalog[raw.price_version][raw.endpoint])
    throw new CostError('unknown-price', '端点、版本或单价与固定价目不符')
  return { endpoint: raw.endpoint, price_version: raw.price_version, unit_micro_usd: integer(raw.unit_micro_usd, '单价') }
}
function summarize(ledger: CostLedgerV1): CostSummary {
  let httpCount = 0n, unknownCount = 0n, httpMoney = 0n, unknownMoney = 0n
  for (const line of ledger.entries) {
    httpCount += BigInt(line.http_200_count); unknownCount += BigInt(line.unknown_result_count)
    httpMoney += BigInt(line.http_200_count) * BigInt(line.unit_micro_usd)
    unknownMoney += BigInt(line.unknown_result_count) * BigInt(line.unit_micro_usd)
  }
  const pending = ledger.pending === undefined ? 0 : ledger.pending.unit_micro_usd
  const occupied = bounded(httpMoney + unknownMoney + BigInt(pending), '占用金额')
  return { limit_micro_usd: ledger.limit_micro_usd, occupied_micro_usd: occupied,
    remaining_micro_usd: ledger.limit_micro_usd - occupied, http_200_micro_usd: bounded(httpMoney, '200金额'),
    unknown_result_micro_usd: bounded(unknownMoney, '未知金额'), pending_micro_usd: pending,
    requests: bounded(httpCount + unknownCount, '净次数'), http_200_count: bounded(httpCount, '200次数'),
    unknown_result_count: bounded(unknownCount, '未知次数'), pending_count: ledger.pending === undefined ? 0 : 1 }
}
function unavailable(path: string, reason: string, status: UnavailableStatus = 'invalid-ledger'): never {
  throw new CostLedgerUnavailable(status, [{ path, reason }])
}
/** 外部账目逐项校验，输出与输入隔离；缺席不是零。 */
export function inspectExistingCostLedger(raw: unknown, rawRequests: unknown, prices: FixedPriceCatalog): ExistingCost {
  try {
    if (raw === undefined) unavailable('cost_ledger', '历史金额无从确认', 'unknown-history')
    if (!object(raw)) unavailable('cost_ledger', '费用账必须是对象')
    if (raw.schema !== 1) unavailable('cost_ledger.schema', '无法解释版本',
      typeof raw.schema === 'number' && Number.isSafeInteger(raw.schema) ? 'unavailable-evidence' : 'invalid-ledger')
    if (raw.currency !== 'USD' || raw.unit !== 'micro_usd') unavailable('cost_ledger', '货币或单位不符')
    if (raw.scope !== 'task' && raw.scope !== 'process') unavailable('cost_ledger.scope', '范围无效')
    const catalog = copyCatalog(prices)
    const amount = (v: unknown, path: string): number => {
      try { return integer(v, path) } catch (e) { return unavailable(path, (e as Error).message) }
    }
    const price = (v: unknown, path: string): FrozenPrice => {
      if (object(v) && typeof v.price_version === 'string' && !own(catalog, v.price_version))
        unavailable(`${path}.price_version`, '价目版本不可用', 'unavailable-evidence')
      try { return checkedPrice(v, catalog) } catch (e) { return unavailable(path, (e as Error).message) }
    }
    const limit = amount(raw.limit_micro_usd, 'cost_ledger.limit_micro_usd')
    const next = amount(raw.next_attempt_id, 'cost_ledger.next_attempt_id')
    if (next === 0) unavailable('cost_ledger.next_attempt_id', '尝试序号必须为正整数')
    if (!Array.isArray(raw.entries)) unavailable('cost_ledger.entries', '聚合项必须是数组')
    const keys = new Set<string>()
    const entries: CostLine[] = Array.from(raw.entries, (value, i) => {
      const path = `cost_ledger.entries[${i}]`, p = price(value, path)
      const key = JSON.stringify([p.price_version, p.endpoint])
      if (keys.has(key)) unavailable(path, '重复聚合键')
      keys.add(key)
      return { ...p, http_200_count: amount(value.http_200_count, `${path}.http_200_count`),
        unknown_result_count: amount(value.unknown_result_count, `${path}.unknown_result_count`) }
    })
    const ledger: CostLedgerV1 = { schema: 1, currency: 'USD', unit: 'micro_usd', scope: raw.scope,
      limit_micro_usd: limit, next_attempt_id: next, entries }
    if (raw.pending !== undefined) {
      const p = price(raw.pending, 'cost_ledger.pending')
      const id = amount((raw.pending as Record<string, unknown>).attempt_id, 'cost_ledger.pending.attempt_id')
      if (id === 0 || id >= next) unavailable('cost_ledger.pending.attempt_id', '预留序号必须为正且小于下一序号')
      ledger.pending = { ...p, attempt_id: id }
    }
    const summary = summarize(ledger), requests = amount(rawRequests, 'requests')
    if (requests !== summary.requests) unavailable('requests', '净次数与费用账不一致')
    return { status: 'known', snapshot: { cost_ledger: ledger, requests }, summary, problems: [] }
  } catch (error) {
    if (error instanceof CostLedgerUnavailable) return { status: error.status, problems: error.problems }
    if (error instanceof CostError) return { status: 'invalid-ledger', problems: [{ path: 'cost_ledger', reason: error.message }] }
    throw error
  }
}
declare const receiptBrand: unique symbol
export type AttemptReceipt = { readonly [receiptBrand]: true }
export type AttemptOutcome = { kind: 'http'; status: number } | { kind: 'no_http_status' }
export interface CostBudget {
  snapshot(): CostSnapshot
  summary(): CostSummary
  setLimit(limit: MicroUsd): void
  reserve(price: FrozenPrice): AttemptReceipt
  settle(receipt: AttemptReceipt, outcome: AttemptOutcome): void
}
function openBudget(initial: CostLedgerV1, prices: FixedPriceCatalog): CostBudget {
  let ledger = structuredClone(initial)
  const catalog = copyCatalog(prices)
  let liveReceipt: AttemptReceipt | undefined
  return {
    snapshot() { return { cost_ledger: structuredClone(ledger), requests: summarize(ledger).requests } },
    summary() { return summarize(ledger) },
    setLimit(limit) {
      integer(limit, '上限')
      if (ledger.pending !== undefined) throw new CostError('pending-attempt', '存在未结预留，不能改额')
      if (limit < summarize(ledger).occupied_micro_usd)
        throw new CostError('invalid-money', '总上限不能低于已占用金额')
      ledger = { ...ledger, limit_micro_usd: limit }
    },
    reserve(raw) {
      const p = checkedPrice(raw, catalog)
      if (ledger.pending !== undefined) throw new CostError('pending-attempt', '存在未结预留，不能新增请求')
      if (BigInt(summarize(ledger).occupied_micro_usd) + BigInt(p.unit_micro_usd) > BigInt(ledger.limit_micro_usd))
        throw new CostError('budget-exceeded', '余额不足以支付本次端点费用')
      const next = bounded(BigInt(ledger.next_attempt_id) + 1n, '下一尝试序号')
      const candidate = { ...ledger, next_attempt_id: next, pending: { ...p, attempt_id: ledger.next_attempt_id } }
      summarize(candidate)
      const receipt = Object.freeze({}) as AttemptReceipt
      ledger = candidate; liveReceipt = receipt
      return receipt
    },
    settle(receipt, outcome) {
      if (liveReceipt === undefined || receipt !== liveReceipt || ledger.pending === undefined)
        throw new CostError('invalid-receipt', '凭据不属于本账当前预留或已消费')
      if (!object(outcome) || (outcome.kind !== 'no_http_status' && (outcome.kind !== 'http'
        || !Number.isInteger(outcome.status) || outcome.status < 100 || outcome.status > 599)))
        throw new CostError('invalid-outcome', '结算必须提供有效 HTTP 状态或明确无状态')
      const candidate = structuredClone(ledger), p = candidate.pending!
      delete candidate.pending
      if (outcome.kind === 'no_http_status' || outcome.status === 200) {
        let line = candidate.entries.find(e => e.endpoint === p.endpoint && e.price_version === p.price_version)
        if (!line) {
          line = { endpoint: p.endpoint, price_version: p.price_version, unit_micro_usd: p.unit_micro_usd,
            http_200_count: 0, unknown_result_count: 0 }
          candidate.entries.push(line)
        }
        const field = outcome.kind === 'http' ? 'http_200_count' : 'unknown_result_count'
        line[field] = bounded(BigInt(line[field]) + 1n, '结算次数')
      }
      summarize(candidate)
      ledger = candidate; liveReceipt = undefined
    },
  }
}
export function createCostBudget(limit: MicroUsd, scope: 'task' | 'process', catalog: FixedPriceCatalog): CostBudget {
  integer(limit, '上限')
  if (scope !== 'task' && scope !== 'process') unavailable('scope', '范围无效')
  return openBudget({ schema: 1, currency: 'USD', unit: 'micro_usd', scope, limit_micro_usd: limit,
    next_attempt_id: 1, entries: [] }, catalog)
}
export function restoreCostBudget(raw: unknown, requests: unknown, catalog: FixedPriceCatalog): CostBudget {
  const seen = inspectExistingCostLedger(raw, requests, catalog)
  if (seen.status !== 'known') throw new CostLedgerUnavailable(seen.status, seen.problems)
  return openBudget(seen.snapshot.cost_ledger, catalog)
}
