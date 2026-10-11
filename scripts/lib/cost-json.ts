/**
 * D13 · 根预算与费用字段保留精确数值证据；其余业务字段照常解析成 number。
 * D19.g／D14.g（ADR-138）· 整份写回读入的根时，没被程序改动的非费用数字照读入时的原文写回。
 * D19.k（ADR-140）· 读入时记下根与根下一层对象里重复的键：JSON.parse 只留最后一处，前面的原文只在源文本里找得到。
 */
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
// 进度字段必须按原始 JSON 数字判定；Number 可能把小数舍入为整数或让指数下溢为 0。
// 按解析根对象关联原 token，不往业务状态写入任何辅助字段。
// 这张表也供 D19.g／D14.g 的整份写回用：stringifyCostJson 写出读入的根时，没改动的非费用数字照它写回原文。
const sourceTokens = new WeakMap<object, WeakMap<object, Map<string, string>>>()
// 无法解释为非负安全整数的费用数字保留原件；对象形态不能误过费用账的 number 校验。
const unavailableNumbers = new WeakMap<object, string>()
// 只有判进度的入口要重复键：读入时只留住原文，用到时才扫，扫过的按根缓存。
const sourceTexts = new WeakMap<object, string>()
const duplicateKeys = new WeakMap<object, readonly SourceDuplicate[]>()

/** 逐个记号扫一遍 JSON.parse 已接受的文本。只给根与根下一层的对象记键，更深的只记层数；不递归，深嵌套也不爆栈（ADR-136）。 */
function topDuplicateKeys(text: string): SourceDuplicate[] {
  const out: SourceDuplicate[] = []
  const open: ({ parent?: string; seen: Map<string, string[]>; key?: string } | undefined)[] = []
  const token = /[ \t\n\r]*(?:("(?:[^"\\]|\\.)*")([ \t\n\r]*:)?|([{[])|([}\]])|(,)|([^ \t\n\r{}[\],:"]+))/y
  for (let m = token.exec(text); m; m = token.exec(text)) {
    const [, string, colon, opener, closer, comma, literal] = m
    const top = open.at(-1)
    if (comma) continue
    // 键按解码后的名字比："0" 与 "\u0030" 是同一个键
    if (colon) { if (top) top.key = JSON.parse(string) as string; continue }
    if (closer) {
      const frame = open.pop()
      for (const [key, values] of frame?.seen ?? [])
        if (values.length > 1) out.push({ ...(frame!.parent === undefined ? {} : { parent: frame!.parent }), key, values })
      continue
    }
    // 其余都是值：记在所在对象当前的键名下
    if (top?.key !== undefined) {
      const values = top.seen.get(top.key) ?? []
      values.push(opener === '{' ? '{…}' : opener === '[' ? '[…]' : string ?? literal ?? '')
      top.seen.set(top.key, values)
    }
    if (opener) open.push(opener === '{' && open.length < 2
      ? { ...(top?.key === undefined ? {} : { parent: top.key }), seen: new Map() } : undefined)
  }
  return out
}

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
  sourceTokens.set(parsed, tokens)
  sourceTexts.set(parsed, text)
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
  // 非法容器预算仍须原样写回；只保护内部数字，不把它变成可用的根金额。
  if (state.budget_usd !== null && typeof state.budget_usd === 'object')
    preserveCostNumbers(state, 'budget_usd')
  return parsed as T
}

export function sourceNumberToken(root: object, holder: object, key: string): string | undefined {
  return sourceTokens.get(root)?.get(holder)?.get(key)
}

/** 读入文本里根与根下一层对象中重复出现的键（D19.k）。parent 是所在对象在根上的键名，根上的重复没有 parent；
 * values 按在文本里的先后，数字与字符串照原文，对象与数组记作 {…}、[…]。 */
export type SourceDuplicate = { parent?: string; key: string; values: readonly string[] }

export function sourceDuplicateKeys(root: object): readonly SourceDuplicate[] {
  let found = duplicateKeys.get(root)
  const text = sourceTexts.get(root)
  if (!found && text !== undefined) duplicateKeys.set(root, found = topDuplicateKeys(text))
  return found ?? []
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
const costRootKeys = new Set(['requests', 'cost_ledger', 'budget_usd'])

/** 写出任务或配置 JSON：费用字段按 D13 精确写出；整份写回 readCostDocument 读入的根时，没被改动的非费用数字照原文写回（D19.g、ADR-138）。 */
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
  // D19.g／D14.g：只查传进来的那个根的原文表；新建的根（meta、stdout）查不到，照常写。
  const tokens = sourceTokens.get(value)
  // 顶层费用三棵子树只走上面的 D13 专用路径，下层随写出往下传；下层与费用同名的键不算。
  const costHolders = new WeakSet<object>()
  return JSON.stringify(result, function(this: object, key: string, item: unknown) {
    const cost = this === result ? costRootKeys.has(key) : costHolders.has(this)
    if (item !== null && typeof item === 'object') {
      const token = unavailableNumbers.get(item)
      if (token !== undefined) return exactJSON.rawJSON!(token)
      if (cost) costHolders.add(item)
    } else if (typeof item === 'number' && tokens && !cost) {
      // 结果是浅拷贝：顶层键回读入的根查，嵌套对象与根共用。当前值仍等于原文的值才写原文，改过的照新值写。
      const token = tokens.get(this === result ? value : this)?.get(key)
      if (token !== undefined && Object.is(item, Number(token))) return exactJSON.rawJSON!(token)
    }
    return item
  }, 2)
}
