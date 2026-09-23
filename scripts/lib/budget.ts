/** D13 · 生产费用账：与保存方共享 state，不在这里写盘。 */
import {
  CostError, createCostBudget, formatUsd, inspectExistingCostLedger, restoreCostBudget,
  type AttemptOutcome, type AttemptReceipt, type CostBudget, type CostProblem, type MicroUsd,
} from './cost-ledger.js'
import { assertCostJsonRuntime, readCostLimit, setCostLimitField, type CostState } from './cost-json.js'
import { quoteTikHub, TIKHUB_PRICE_BASIS, TIKHUB_PRICE_CATALOG } from '../providers/tikhub-pricing.js'

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

export class Budget {
  private engine?: CostBudget
  private notified = new Set<number>()
  constructor(private state: CostState, private onNotify: NotifyCost = () => {}) {}
  get count(): number | null { return this.view().requests }
  view(): CostView { return costView(this.state) }

  private open(checkRoot: boolean): CostBudget {
    try { assertCostJsonRuntime() } catch (e) { throw new BudgetInputError((e as Error).message) }
    if (checkRoot) {
      const view = this.view()
      if (view.cost_status !== 'known') throw new BudgetInputError(`费用账不可用：${view.cost_problems.map(p => `${p.path}: ${p.reason}`).join('; ')}`)
    }
    if (this.engine) return this.engine
    const seen = inspectExistingCostLedger(this.state.cost_ledger, this.state.requests, TIKHUB_PRICE_CATALOG)
    if (seen.status !== 'known') throw new BudgetInputError(`费用账不可用：${seen.problems.map(p => `${p.path}: ${p.reason}`).join('; ')}`)
    if (seen.snapshot.cost_ledger.pending)
      throw new BudgetInputError('cost_ledger.pending 存在未结预留，不能新增付费或改额')
    this.engine = restoreCostBudget(this.state.cost_ledger, this.state.requests, TIKHUB_PRICE_CATALOG)
    return this.engine
  }
  private sync(): void { Object.assign(this.state, this.engine!.snapshot()) }

  reserve(endpoint: string): AttemptReceipt {
    const engine = this.open(true)
    const receipt = engine.reserve(quoteTikHub(endpoint))
    this.sync()
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
    if (!this.engine) throw new CostError('invalid-receipt', '本运行没有当前请求凭据')
    this.engine.settle(receipt, outcome)
    this.sync()
  }
  setLimit(limit: MicroUsd): void {
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

export function startBudget(state: CostState, limit: MicroUsd, scope: 'task' | 'process', notify?: NotifyCost): Budget {
  const engine = createCostBudget(limit, scope, TIKHUB_PRICE_CATALOG)
  setCostLimitField(state, limit)
  Object.assign(state, engine.snapshot())
  return new Budget(state, notify)
}
