/**
 * D13 · 根预算与费用字段保留精确数值证据；其余业务字段照常解析成 number。
 * D19.g／D14.g（ADR-138）· 整份写回读入的根时，没被程序改动的非费用数字照读入时的原文写回。
 * D19.k（ADR-140）· 读入时留住源文本，判进度时才找出根与根下一层对象里重复的键：JSON.parse 只留最后一处，前面的原文只在源文本里找得到。
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
// 读 task.json 的入口判写重复的键（D19.k、D27）：读入时只留住原文，用到时才扫，扫过的按根缓存。
const sourceTexts = new WeakMap<object, string>()
const duplicateKeys = new WeakMap<object, readonly KeyDuplicate[]>()

/** 字符串记号的结尾（右引号之后）。不用正则：正则引擎逐字符回溯，九百万字的字符串就栈溢出（ADR-140 第五节）。
 * 找下一个引号，前面紧挨着偶数个反斜杠才是右引号。 */
function stringEnd(text: string, at: number): number {
  for (let quote = text.indexOf('"', at + 1); ; quote = text.indexOf('"', quote + 1)) {
    let slashes = 0
    while (text.charCodeAt(quote - 1 - slashes) === 92) slashes++
    if (slashes % 2 === 0) return quote + 1
  }
}

const blank = (c: number) => c === 32 || c === 10 || c === 13 || c === 9

/** 一层容器：挂在上一层的哪个键或下标（根没有），对象另记各键的每一处，数组只数下标。 */
type Frame = { up?: Frame; at?: string | number; seen?: Map<string, string[]>; key?: string; index: number }

/** 从根到这一层的路径；每层只记自己挂在哪儿，报重复时才拼，深嵌套也不逐层复制路径 */
function pathOf(frame: Frame): (string | number)[] {
  const path: (string | number)[] = []
  for (let f: Frame | undefined = frame; f?.up; f = f.up) path.push(f.at!)
  return path.reverse()
}

/** 逐个记号扫一遍 JSON.parse 已接受的文本，给每一层对象记键（D27.a）；不递归，深嵌套也不爆栈（ADR-136）。 */
function scanDuplicateKeys(text: string): KeyDuplicate[] {
  const out: KeyDuplicate[] = []
  const open: Frame[] = []
  for (let i = 0; i < text.length;) {
    const c = text.charCodeAt(i)
    if (blank(c) || c === 44 || c === 58) { i++; continue } // 空白、逗号、冒号
    const top = open.at(-1)
    if (c === 125 || c === 93) { // } ]
      const frame = open.pop()!
      for (const [key, values] of frame.seen ?? [])
        if (values.length > 1) out.push({ path: [...pathOf(frame), key], values })
      i++
      continue
    }
    let raw: string
    if (c === 34) {
      const end = stringEnd(text, i)
      let next = end
      while (blank(text.charCodeAt(next))) next++
      // 后面跟着冒号的是键。键按解码后的名字比："0" 与 "\u0030" 是同一个键；没有反斜杠的键原文就是解码后的名字
      if (text.charCodeAt(next) === 58) {
        const body = text.slice(i + 1, end - 1)
        top!.key = body.includes('\\') ? JSON.parse(text.slice(i, end)) as string : body
        i = next + 1
        continue
      }
      raw = text.slice(i, end); i = end
    } else if (c === 123 || c === 91) { raw = c === 123 ? '{…}' : '[…]'; i++ }
    else {
      let end = i + 1
      // 字面量（数字、true、false、null）在空白、逗号与右括号前结束
      for (let d = text.charCodeAt(end); end < text.length && !blank(d) && d !== 44 && d !== 93 && d !== 125; d = text.charCodeAt(++end));
      raw = text.slice(i, end); i = end
    }
    // 是值：对象里记在当前的键名下，数组里数下标
    let at: string | number | undefined
    if (top?.seen) {
      at = top.key!
      const values = top.seen.get(at) ?? []
      values.push(raw)
      top.seen.set(at, values)
    } else if (top) at = top.index++
    if (c === 123 || c === 91) open.push({ up: top, at, ...(c === 123 ? { seen: new Map() } : {}), index: 0 })
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

/** 找不到读入时的原文（不是 readCostDocument 读入的根，或是它的副本）交回 null：无从核对，不当成没有重复。 */
export function sourceDuplicateKeys(root: object): readonly SourceDuplicate[] | null {
  // D19.k 只看根与根下一层的对象：路径一段是根上的键，两段是根上某个对象里的键
  return sourceDuplicates(root)?.filter(({ path }) => path.length <= 2)
    .map(({ path, values }) => path.length === 1
      ? { key: path[0] as string, values }
      : { parent: path[0] as string, key: path[1] as string, values }) ?? null
}

/** 读入文本里任一层对象中重复出现的键（D27.a）。path 从根往下：对象里的键名、数组里的下标，最后一段是写重复的那个键；
 * values 按在文本里的先后，数字与字符串照原文，对象与数组记作 {…}、[…]。 */
export type KeyDuplicate = { path: readonly (string | number)[]; values: readonly string[] }

/** 找不到读入时的原文交回 null，同 sourceDuplicateKeys。 */
export function sourceDuplicates(root: object): readonly KeyDuplicate[] | null {
  const text = sourceTexts.get(root)
  if (text === undefined) return null
  let found = duplicateKeys.get(root)
  if (!found) duplicateKeys.set(root, found = scanDuplicateKeys(text))
  return found
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
