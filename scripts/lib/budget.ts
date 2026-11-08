/** D13/D14 · 生产费用账：共享 state，通过同步回调保存任务费用。 */
import {
  CostError, createCostBudget, formatUsd, inspectExistingCostLedger, restoreCostBudget,
  type AttemptOutcome, type AttemptReceipt, type CostBudget, type CostProblem, type CostSnapshot, type MicroUsd,
} from './cost-ledger.js'
import { assertCostJsonRuntime, readCostLimit, setCostLimitField, type CostState } from './cost-json.js'
import { quoteTikHub, TIKHUB_PRICE_BASIS, TIKHUB_PRICE_CATALOG } from '../providers/tikhub-pricing.js'
import { obsReserve, type Attempt, type RejectReason } from './obs.js'

export type CostView = {
  requests: number | null
  cost_estimate_usd: string | null
  budget_usd: string | null
  cost_status: 'known' | 'unknown-history' | 'unavailable-evidence' | 'invalid-ledger'
  cost_scope: 'task' | 'process' | null
  cost_http_200_usd: string | null
  cost_unknown_result_usd: string | null
  cost_pending_usd: string | null
  cost_basis: string
  cost_price_versions: string[]
  cost_problems: CostProblem[]
}
export type NotifyCost = (threshold: 0.5 | 0.8, view: CostView) => void
/** 这一次费用保存是哪个保存点、对着哪一次尝试（kol-obs/v1 的保存点名；collect 据此注入，见 `obs.ts`） */
export type CostSave = Attempt & { point: 'SP-R' | 'SP-200' | 'SP-N200' | 'SP-NS' }
export type PersistCost = (snapshot: CostSnapshot, save: CostSave) => void
export class BudgetInputError extends Error {
  constructor(message: string) { super(message); this.name = 'BudgetInputError' }
}

export function costView(state: CostState): CostView {
  const seen = inspectExistingCostLedger(state.cost_ledger, state.requests, TIKHUB_PRICE_CATALOG)
  let limit: MicroUsd | undefined, limitProblem: CostProblem | undefined
  try { limit = readCostLimit(state) }
  catch (error) { limitProblem = { path: 'budget_usd', reason: (error as Error).message } }
  const requests = typeof state.requests === 'number' && Number.isSafeInteger(state.requests) && state.requests >= 0
    ? state.requests : null
  const base: CostView = {
    requests, cost_estimate_usd: null, budget_usd: limit === undefined ? null : formatUsd(limit),
    cost_status: seen.status, cost_scope: null, cost_http_200_usd: null, cost_unknown_result_usd: null,
    cost_pending_usd: null, cost_basis: TIKHUB_PRICE_BASIS, cost_price_versions: [],
    cost_problems: [...seen.problems, ...(limitProblem ? [limitProblem] : [])],
  }
  if (seen.status !== 'known') return base
  if (limit === undefined || limit !== seen.summary.limit_micro_usd) {
    return { ...base, cost_status: 'invalid-ledger', budget_usd: null,
      cost_problems: [limitProblem ?? { path: 'budget_usd', reason: '根预算与 cost_ledger 上限冲突' }] }
  }
  const { summary: s, snapshot: { cost_ledger: ledger } } = seen
  return { ...base, requests: s.requests, cost_estimate_usd: formatUsd(s.occupied_micro_usd),
    cost_scope: ledger.scope, cost_http_200_usd: formatUsd(s.http_200_micro_usd),
    cost_unknown_result_usd: formatUsd(s.unknown_result_micro_usd), cost_pending_usd: formatUsd(s.pending_micro_usd),
    cost_price_versions: [...new Set([...ledger.entries, ...(ledger.pending ? [ledger.pending] : [])].map(e => e.price_version))] }
}

/** 预留被拒时属于 kol-obs/v1 的哪一种原因：抛出点当场标上，`reserve` 写预留行时取 */
const REJECTED = new WeakMap<object, RejectReason>()
const refused = <E extends Error>(reason: RejectReason, error: E): E => { REJECTED.set(error, reason); return error }
function rejectReason(error: unknown): RejectReason {
  const tagged = typeof error === 'object' && error !== null ? REJECTED.get(error) : undefined
  if (tagged) return tagged
  if (error instanceof CostError && error.code === 'persistence-failed') return 'save-failed'
  if (error instanceof CostError && error.code === 'budget-exceeded') return 'budget'
  if (error instanceof CostError && error.code === 'pending-attempt') return 'pending'
  // 余下的是账本身走不下去（运行时缺精确 JSON、尝试序号到顶）：契约五种里最近的是「认不得」（ADR-186）
  return 'ledger-unavailable'
}
const unitOf = (endpoint: string): number | undefined => { try { return quoteTikHub(endpoint).unit_micro_usd } catch { return undefined } }

export class Budget {
  private engine?: CostBudget
  private notified = new Set<number>()
  private persistenceFailure?: CostError
  constructor(private state: CostState, private onNotify: NotifyCost = () => {}, private persistCost?: PersistCost) {}
  get count(): number | null { return this.view().requests }
  view(): CostView { return costView(this.state) }

  private open(checkRoot: boolean): CostBudget {
    this.assertWritable()
    try { assertCostJsonRuntime() } catch (e) { throw new BudgetInputError((e as Error).message) }
    if (checkRoot) {
      const view = this.view()
      // 账本身认得、合起来却不可用，只剩根预算与账上上限对不上那一种（`costView`）
      const rootConflict = () => inspectExistingCostLedger(this.state.cost_ledger, this.state.requests, TIKHUB_PRICE_CATALOG).status === 'known'
      if (view.cost_status !== 'known') throw refused(rootConflict() ? 'root-conflict' : 'ledger-unavailable',
        new BudgetInputError(`费用账不可用：${view.cost_problems.map(p => `${p.path}: ${p.reason}`).join('; ')}`))
    }
    if (this.engine) return this.engine
    const seen = inspectExistingCostLedger(this.state.cost_ledger, this.state.requests, TIKHUB_PRICE_CATALOG)
    if (seen.status !== 'known') throw refused('ledger-unavailable', new BudgetInputError(`费用账不可用：${seen.problems.map(p => `${p.path}: ${p.reason}`).join('; ')}`))
    if (seen.snapshot.cost_ledger.pending)
      throw refused('pending', new BudgetInputError('cost_ledger.pending 存在未结预留，不能新增付费或改额'))
    this.engine = restoreCostBudget(this.state.cost_ledger, this.state.requests, TIKHUB_PRICE_CATALOG)
    return this.engine
  }
  private sync(): void { Object.assign(this.state, this.engine!.snapshot()) }
  private assertWritable(): void {
    if (this.persistenceFailure) throw this.persistenceFailure
  }
  private checkpoint(save: CostSave): void {
    if (!this.persistCost) return
    try { this.persistCost(this.engine!.snapshot(), save) }
    catch (error) {
      this.persistenceFailure = new CostError('persistence-failed', `保存费用失败：${error instanceof Error ? error.message : String(error)}`)
      throw this.persistenceFailure
    }
  }

  /**
   * 每一次尝试都留一行预留记录（kol-obs/v1，开着事件时）：成了的在预留存好之后、返回去发请求之前写，
   * 被拒的在拒的那一刻写。价目外的端点算不出单价，不写行 —— 那是调用方的缺陷，`quoteTikHub` 照样会抛（ADR-186）
   */
  reserve(endpoint: string): AttemptReceipt {
    const unit = unitOf(endpoint)
    let engine: CostBudget, receipt: AttemptReceipt, attempt_id: number
    try {
      engine = this.open(true)
      receipt = engine.reserve(quoteTikHub(endpoint))
      this.sync()
      attempt_id = engine.snapshot().cost_ledger.pending!.attempt_id
      this.checkpoint({ point: 'SP-R', attempt_id, endpoint })
    } catch (error) {
      if (unit !== undefined) obsReserve(endpoint, unit, { result: 'rejected', reason: rejectReason(error) })
      throw error
    }
    if (unit !== undefined) obsReserve(endpoint, unit, { result: 'reserved', attempt_id })
    const { occupied_micro_usd: occupied, limit_micro_usd: limit } = engine.summary()
    for (const threshold of [0.5, 0.8] as const) {
      const numerator = threshold === 0.5 ? 5n : 8n
      if (limit > 0 && BigInt(occupied) * 10n >= BigInt(limit) * numerator && !this.notified.has(threshold)) {
        this.notified.add(threshold)
        this.onNotify(threshold, this.view())
      }
    }
    return receipt
  }
  settle(receipt: AttemptReceipt, outcome: AttemptOutcome): void {
    this.assertWritable()
    if (!this.engine) throw new CostError('invalid-receipt', '本运行没有当前请求凭据')
    const pending = this.engine.snapshot().cost_ledger.pending
    this.engine.settle(receipt, outcome)
    this.sync()
    // 结算成了，账上原先一定有这一笔未结预留（`settle` 不认别的凭据）
    this.checkpoint({ point: outcome.kind === 'no_http_status' ? 'SP-NS' : outcome.status === 200 ? 'SP-200' : 'SP-N200',
      attempt_id: pending!.attempt_id, endpoint: pending!.endpoint })
  }
  setLimit(limit: MicroUsd): void {
    this.assertWritable()
    formatUsd(limit)
    try { assertCostJsonRuntime() } catch (e) { throw new BudgetInputError((e as Error).message) }
    const engine = this.open(false)
    engine.setLimit(limit)
    setCostLimitField(this.state, limit)
    this.sync()
  }
  summary(): string {
    const view = this.view()
    return view.cost_status === 'known'
      ? `估算占用 $${view.cost_estimate_usd} / $${view.budget_usd}（净次数 ${view.requests}；含结果不明与未结预留）`
      : `费用无从确认：${view.cost_problems.map(p => `${p.path}: ${p.reason}`).join('; ')}`
  }
}

export function startBudget(state: CostState, limit: MicroUsd, scope: 'task' | 'process', notify?: NotifyCost, persist?: PersistCost): Budget {
  const engine = createCostBudget(limit, scope, TIKHUB_PRICE_CATALOG)
  setCostLimitField(state, limit)
  Object.assign(state, engine.snapshot())
  return new Budget(state, notify, persist)
}
