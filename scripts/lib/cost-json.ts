/** D13 · 根预算与费用字段保留精确数值证据；其余业务字段照常解析。 */
import { CostError, formatUsd, parseUsdMicros, type MicroUsd } from './cost-ledger.js'
import type { CostView } from './budget.js'

export type CostState = { budget_usd?: unknown; cost_ledger?: unknown; requests?: unknown }
type SourceContext = { source?: string }
type ExactJSON = {
  parse(text: string, reviver: (this: object, key: string, value: unknown, context?: SourceContext) => unknown): unknown
  rawJSON?: (text: string) => unknown
}
const exactJSON = JSON as unknown as ExactJSON
const roots = new WeakMap<object, { value: unknown; token: string }>()
// 无法解释为非负安全整数的费用数字保留原件；对象形态不能误过费用账的 number 校验。
const unavailableNumbers = new WeakMap<object, string>()

/** 缺少原生精确 JSON 能力时，不允许有损写回或新增付费。 */
export function assertCostJsonRuntime(): void {
  let source: string | undefined
  exactJSON.parse('9007199254740993', function(_key, value, context) { source = context?.source; return value })
  if (source !== '9007199254740993' || typeof exactJSON.rawJSON !== 'function')
    throw new CostError('invalid-money', '当前运行时缺少 JSON.parse source context / JSON.rawJSON，不能精确保存费用或新增付费')
}

export function readCostDocument<T extends object = CostState>(text: string): T {
  const tokens = new WeakMap<object, Map<string, string>>()
  const parsed = exactJSON.parse(text, function(key, value, context) {
    if (typeof value === 'number' && context?.source !== undefined) {
      let fields = tokens.get(this)
      if (!fields) { fields = new Map(); tokens.set(this, fields) }
      fields.set(key, context.source)
    }
    return value
  })
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new CostError('invalid-money', '任务或配置必须是 JSON 对象')
  const state = parsed as Record<string, unknown>
  const rootToken = tokens.get(parsed)?.get('budget_usd')
  if (rootToken !== undefined) roots.set(parsed, { value: state.budget_usd, token: rootToken })
  const preserveCostNumbers = (holder: Record<string, unknown> | unknown[], key: string): void => {
    const record = holder as Record<string, unknown>, value = record[key]
    const token = tokens.get(holder)?.get(key)
    if (typeof value === 'number' && token !== undefined) {
      // 将原系数的指数减六后交给同一个精确整数转换，不先舍入成 number。
      const parts = /^(-?\d+(?:\.\d+)?)(?:[eE]([+-]?\d+))?$/.exec(token)!
      try { record[key] = parseUsdMicros(`${parts[1]}e${BigInt(parts[2] ?? '0') - 6n}`) }
      catch {
        const unavailable = Object.freeze({})
        unavailableNumbers.set(unavailable, token)
        record[key] = unavailable
      }
    } else if (value !== null && typeof value === 'object') {
      for (const child of Object.keys(value)) preserveCostNumbers(value as Record<string, unknown>, child)
    }
  }
  for (const key of ['requests', 'cost_ledger'])
    if (Object.hasOwn(state, key)) preserveCostNumbers(state, key)
  return parsed as T
}

export function readCostLimit(state: CostState): MicroUsd {
  const root = roots.get(state)
  if (!root || !Object.hasOwn(state, 'budget_usd') || !Object.is(root.value, state.budget_usd))
    throw new CostError('invalid-money', 'budget_usd 缺少可核验的根数值 token')
  return parseUsdMicros(root.token)
}

export function setCostLimitField(state: CostState, limit: MicroUsd): void {
  const token = formatUsd(limit)
  assertCostJsonRuntime()
  // 内存保留精确十进制文本；JSON 出口才写成 number token。
  state.budget_usd = token
  roots.set(state, { value: token, token })
}

const moneyFields = ['cost_estimate_usd', 'budget_usd', 'cost_http_200_usd',
  'cost_unknown_result_usd', 'cost_pending_usd'] as const

export function stringifyCostJson(value: object, view?: CostView): string {
  assertCostJsonRuntime()
  const result: Record<string, unknown> = { ...value }
  if (view) {
    Object.assign(result, view)
    for (const field of moneyFields)
      result[field] = view[field] === null ? null : exactJSON.rawJSON!(view[field])
  } else if (Object.hasOwn(value, 'budget_usd') && typeof (value as CostState).budget_usd === 'number') {
    const root = roots.get(value)
    if (!root || !Object.is(root.value, (value as CostState).budget_usd))
      throw new CostError('invalid-money', 'budget_usd 没有原数值 token，不能精确保存')
    result.budget_usd = exactJSON.rawJSON!(root.token)
  } else {
    const root = roots.get(value)
    if (root && Object.hasOwn(value, 'budget_usd') && Object.is(root.value, (value as CostState).budget_usd))
      result.budget_usd = exactJSON.rawJSON!(root.token)
  }
  return JSON.stringify(result, (_key, item: unknown) => {
    if (item !== null && typeof item === 'object') {
      const token = unavailableNumbers.get(item)
      if (token !== undefined) return exactJSON.rawJSON!(token)
    }
    return item
  }, 2)
}
