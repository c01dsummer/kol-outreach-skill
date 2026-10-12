/**
 * 变异的入口启动数有没有过线（ADR-145）。纯判定：不起进程、不读文件，计数由别处数好交进来。
 *
 * 两条线：
 * - **规则一**：会提前停的变异（`stopsEarly`，今天就是自检变异），在它点名的断言出结果之前要付的
 *   启动不超过 `LAUNCH_LIMIT.paid`。付几次 = 它的 `kills` 里各标签**末次打印**时已经起了几次，取最大；
 *   有一条没打印过，就是整个配置的启动数（见齐就停永远凑不齐，它会跑到底）。
 * - **规则二**：不提前停的配置（需求测试的选组），配置内启动数 × 选它的变异条数不超过 `LAUNCH_LIMIT.product`。
 *
 * 「启动」是验证者进程自己直接起的子进程，不含 git —— 那是数的那一侧的事，交进来的数已经不含它。
 *
 * **缺了不放行**：全跑变异没有基线计数，按超线判（`full-run`）；有变异落到、却没有计数的配置报
 * `missing`。这里没有一条路把「不知道」变成「没超」—— 删掉计数就等于关掉闸门的那种路。
 *
 * 不设豁免。超线的改法只有三种，写在 `launchReport` 的末尾；调线要改这里的常量、写决策记录、由需求所有者批。
 */
import { configurationKey } from './jobs-rule.js'
import { launchDrift } from './launch-count.js'
import { VERIFIERS, stopsEarly } from './mutate-rule.js'

export const LAUNCH_LIMIT = { paid: 50, product: 100 } as const

/** 正常基线里打印出来的一行 ✓／✗：正文（去掉行首空白、记号与记号后那个空格）与此刻验证者已经起了几次 */
export interface LaunchPrint { readonly body: string; readonly launched: number }
/** 一种配置一次正常基线的计数：整跑起了几次，与按打印先后排的每一行 */
export interface BaselineLaunches { readonly total: number; readonly prints: readonly LaunchPrint[] }

export type LaunchVerifier = 'selfcheck' | 'test'
/** 路由之后的一条变异：`only` 为 undefined 是全跑 */
export interface LaunchMutation {
  readonly id: string; readonly by: LaunchVerifier
  readonly only?: readonly string[]; readonly kills: readonly string[]
}

export type LaunchFinding =
  | { readonly kind: 'paid'; readonly config: string; readonly id: string; readonly paid: number }
  | { readonly kind: 'product'; readonly config: string; readonly launches: number; readonly ids: readonly string[] }
  | { readonly kind: 'full-run'; readonly id: string }
  | { readonly kind: 'missing'; readonly config: string; readonly ids: readonly string[] }
  /** 超线的配置再跑一次基线，两次计数不同（第一节末）：不报超线，报这一条 */
  | { readonly kind: 'unsteady'; readonly config: string; readonly drift: string }

/**
 * 一行正文归到哪条声明标签：**最长的** `L`，使正文等于 `L`、或以 `L：`、`L（` 开头。
 * `L（` 是 `runBoth` 打的 `✓ L（按预期以退出码 N 结束）`。判变异被抓到的 `killsMatched` 只认 `L` 与 `L：`，
 * 所以不复用它。取最长的，是因为一条标签可能是另一条的前缀：归给短的，就把长的那条的成本记到短的头上。
 */
export function printLabel(body: string, declared: readonly string[]): string | undefined {
  let best: string | undefined
  for (const label of declared) {
    const hit = body === label || body.startsWith(`${label}：`) || body.startsWith(`${label}（`)
    if (hit && (best === undefined || label.length > best.length)) best = label
  }
  return best
}

/** 会提前停的变异付几次：各 `kills` 标签末次打印时已起的启动数里最大的；有一条没打印过就是整个配置的启动数 */
export function paidLaunches(kills: readonly string[], baseline: BaselineLaunches, declared: readonly string[]): number {
  const last = new Map<string, number>()
  for (const { body, launched } of baseline.prints) {
    const label = printLabel(body, declared)
    if (label !== undefined) last.set(label, launched)
  }
  let paid = 0
  for (const label of kills) {
    const at = last.get(label)
    if (at === undefined) return baseline.total
    paid = Math.max(paid, at)
  }
  return paid
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** 按配置分组：配置键排好，组里按 id 排；全跑的（没选组）单列，也按 id 排。判定与汇总共用这一份 */
function byConfiguration(mutations: readonly LaunchMutation[]): { fullRun: string[]; configs: [string, LaunchMutation[]][] } {
  const fullRun: string[] = []
  const byConfig = new Map<string, LaunchMutation[]>()
  for (const m of mutations) {
    if (m.only === undefined) { fullRun.push(m.id); continue }
    const key = configurationKey({ by: m.by, only: m.only, executes: [] })
    byConfig.set(key, [...byConfig.get(key) ?? [], m])
  }
  return { fullRun: fullRun.sort(byText),
    configs: [...byConfig.keys()].sort(byText).map(key => [key, [...byConfig.get(key)!].sort((a, b) => byText(a.id, b.id))]) }
}

/**
 * 两条规则的判定。`baselines` 以 `configurationKey` 为键；`declared` 是每个验证者的声明标签清单。
 * 顺序：全跑的按 id 排在前，其余先按配置键、同一配置里 `paid` 按变异 id。
 */
export function launchFindings(
  mutations: readonly LaunchMutation[],
  baselines: ReadonlyMap<string, BaselineLaunches>,
  declared: Readonly<Record<LaunchVerifier, readonly string[]>>,
): LaunchFinding[] {
  const { fullRun, configs } = byConfiguration(mutations)
  const out: LaunchFinding[] = fullRun.map(id => ({ kind: 'full-run', id }))
  for (const [key, routed] of configs) {
    const ids = routed.map(m => m.id)
    const baseline = baselines.get(key)
    if (baseline === undefined) { out.push({ kind: 'missing', config: key, ids }); continue }
    const stopping = routed.filter(m => stopsEarly(VERIFIERS[m.by], m.kills, m.only))
    for (const m of stopping) {
      const paid = paidLaunches(m.kills, baseline, declared[m.by])
      if (paid > LAUNCH_LIMIT.paid) out.push({ kind: 'paid', config: key, id: m.id, paid })
    }
    const running = routed.filter(m => !stopsEarly(VERIFIERS[m.by], m.kills, m.only))
    if (running.length > 0 && baseline.total * running.length > LAUNCH_LIMIT.product)
      out.push({ kind: 'product', config: key, launches: baseline.total, ids: running.map(m => m.id) })
  }
  return out
}

/** 报错文本：每条发现一行起头，末尾附三种改法、少写变异不算、上限只由决策记录调 */
export function launchReport(findings: readonly LaunchFinding[]): string[] {
  if (findings.length === 0) return []
  const lines: string[] = []
  for (const f of findings) {
    if (f.kind === 'paid')
      lines.push(`✗ 变异启动上限（每条 ≤ ${LAUNCH_LIMIT.paid}，会提前停）：${f.config} 的 ${f.id} 付 ${f.paid} 次`,
        '    （这条变异点名的断言出结果之前，要先跑的入口启动次数）')
    else if (f.kind === 'product')
      lines.push(`✗ 启动乘条数上限（≤ ${LAUNCH_LIMIT.product}，不提前停）：${f.config} ${f.launches} 次启动 × ${f.ids.length} 条变异 = ${f.launches * f.ids.length}`,
        `    选组的需求测试不提前停：组里每加 1 次启动，乘以 ${f.ids.length}（${f.ids.join('、')}）`)
    else if (f.kind === 'full-run')
      lines.push(`✗ ${f.id} 是全跑变异：全跑变异没有基线计数，按规则视为超线`)
    else if (f.kind === 'missing')
      lines.push(`✗ ${f.config} 没有启动计数（落到它的变异：${f.ids.join('、')}）—— 计数缺了不放行`)
    else
      lines.push(`✗ ${f.config} 的启动数不确定：同一棵树上两次正常基线不一样（${f.drift}），不按超线报`,
        '    启动数不再是树的函数，判红就成了按运气红（第六节）：先查这种配置两次起的进程为什么不一样')
  }
  // 改法是给超线与缺计数的；只有「不确定」时附上它们，等于叫人去拆一个没判成超线的组
  if (findings.every(f => f.kind === 'unsteady')) return lines
  lines.push('  改法只有三种：拆组（按变异点名的用例拆，ADR-131）；',
    '        把覆盖整个矩阵的一条断言改成每个用例各一条；',
    '        把真入口用例移出需求测试组（ADR-120）。',
    '  少写变异不是改法。不设豁免；上限只能改常量、写决策记录、由需求所有者批（ADR-145）')
  return lines
}

/** 要再跑一次基线确认的配置：有 `paid` 或 `product` 发现的配置键，去重、排好 */
export function launchRecheck(findings: readonly LaunchFinding[]): string[] {
  return [...new Set(findings.flatMap(f => f.kind === 'paid' || f.kind === 'product' ? [f.config] : []))].sort(byText)
}

/**
 * 拿重跑的计数确认（第一节末）：两次都有计数而且不同，这种配置的超线发现换成一条 `unsteady`，
 * 放在它原来第一条的位置；两次相同就原样留下。有一次没有计数也原样留下：缺数照第五节末是红的，
 * 不能因为重跑那次没写全，超线就换成不确定、不按超线报。别的发现不动。
 */
export function settleLaunches(findings: readonly LaunchFinding[], first: ReadonlyMap<string, BaselineLaunches>,
  again: ReadonlyMap<string, BaselineLaunches | undefined>): LaunchFinding[] {
  const drifts = new Map<string, string>()
  for (const key of launchRecheck(findings)) {
    const a = first.get(key)
    const b = again.get(key)
    const drift = a === undefined || b === undefined ? undefined : launchDrift(a, b)
    if (drift !== undefined) drifts.set(key, drift)
  }
  const out: LaunchFinding[] = []
  const placed = new Set<string>()
  for (const f of findings) {
    const drift = f.kind === 'paid' || f.kind === 'product' ? drifts.get(f.config) : undefined
    if (drift === undefined || (f.kind !== 'paid' && f.kind !== 'product')) { out.push(f); continue }
    if (!placed.has(f.config)) out.push({ kind: 'unsteady', config: f.config, drift })
    placed.add(f.config)
  }
  return out
}

/** 每种有计数的配置一行，给只报数那一行与机器段用 */
export interface LaunchTally {
  readonly config: string; readonly launches: number
  /** 会提前停的每条变异付几次，按 id 排 */
  readonly paid: readonly { readonly id: string; readonly paid: number }[]
  /** 不提前停、落到这种配置的变异条数 */
  readonly running: number
}

/** 有变异落到、也有计数的配置各一行，按配置键排；全跑的与没有计数的不在里面（它们由 `launchFindings` 报） */
export function launchTally(
  mutations: readonly LaunchMutation[],
  baselines: ReadonlyMap<string, BaselineLaunches>,
  declared: Readonly<Record<LaunchVerifier, readonly string[]>>,
): LaunchTally[] {
  const out: LaunchTally[] = []
  for (const [key, routed] of byConfiguration(mutations).configs) {
    const baseline = baselines.get(key)
    if (baseline === undefined) continue
    const stopping = routed.filter(m => stopsEarly(VERIFIERS[m.by], m.kills, m.only))
    out.push({ config: key, launches: baseline.total,
      paid: stopping.map(m => ({ id: m.id, paid: paidLaunches(m.kills, baseline, declared[m.by]) })),
      running: routed.length - stopping.length })
  }
  return out
}

/** 人读的那一行：几种配置有计数、会提前停的最多付几次、不提前停的启动×条数最多多少；并列取排在前的 */
export function tallyLine(tally: readonly LaunchTally[]): string {
  // 并列按配置键、再按 id 取排在前的：不靠交进来的先后
  const before = (a: readonly string[], b: readonly string[]): boolean => byText(a.join('\0'), b.join('\0')) < 0
  let paid: { id: string; paid: number; config: string } | undefined
  let product: LaunchTally | undefined
  for (const t of tally) {
    for (const p of t.paid) if (paid === undefined || p.paid > paid.paid
      || (p.paid === paid.paid && before([t.config, p.id], [paid.config, paid.id]))) paid = { ...p, config: t.config }
    const x = t.launches * t.running
    if (t.running > 0 && (product === undefined || x > product.launches * product.running
      || (x === product.launches * product.running && before([t.config], [product.config])))) product = t
  }
  const early = paid === undefined ? '会提前停的：没有' : `会提前停的最多付 ${paid.paid} 次（${paid.id}，${paid.config}）`
  const running = product === undefined ? '不提前停的：没有'
    : `不提前停的启动×条数最多 ${product.launches * product.running}（${product.config}，${product.launches} × ${product.running}）`
  return `启动数（只报数）：${tally.length} 种配置有计数；${early}；${running}`
}

/** HEAD 在不在主干上：resolveBaseline 答得出来时是 onTrunk；答不出来时是它给的原因 */
export type LaunchTrunk = { readonly onTrunk: boolean } | { readonly unknown: string }
export interface LaunchGate { readonly red: boolean; readonly lines: readonly string[] }

const KINDS: readonly string[] = ['paid', 'product', 'full-run', 'missing', 'unsteady']
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** 第二十一节第 2 小节，按顺序核，交回第一条不过的原因；都过了是 undefined */
function recordFault(record: unknown, source: string | undefined): string | undefined {
  if (!isObject(record)) return '没有启动数文件，或读不出来、不是一个 JSON 对象'
  if (record.schema !== 'mutation-launches/v1') return '启动数文件的 schema 不是 mutation-launches/v1'
  if (typeof record.source !== 'string') return '启动数文件里没有源码身份（变异一步没取到）'
  if (source === undefined) return '当前树的源码身份取不到'
  if (record.source !== source) return '启动数文件是另一棵树上写的（源码身份对不上）'
  if (!Array.isArray(record.tally) || !Array.isArray(record.findings)
    || !record.findings.every(f => isObject(f) && KINDS.includes(f.kind as string)))
    return '启动数文件的 tally 或 findings 不是数组，或有一条发现的种类认不得'
  return undefined
}

/**
 * 检查链最后一步的判定（ADR-145 第二十一节）：先核数据，缺了、另一棵树上写的都红，主干上也红；
 * 再看发现：没有就绿，有就在 PR 上红（「不确定」也红），在主干上只报数。不重判，读文件里变异一步判好的发现。
 */
export function launchGate(record: unknown, source: string | undefined, trunk: LaunchTrunk): LaunchGate {
  const fault = recordFault(record, source)
  if (fault !== undefined) return { red: true, lines: [`✗ 启动数闸门：无从判断 —— ${fault}`,
    '  先跑 npm run mutate：它在全部正常基线都绿了以后写 output/mutation-launches/launches.json；数的那一段出错时不写，看它输出里「启动数没数成」那一行'] }
  const { tally, findings, again } = record as { tally: unknown[]; findings: LaunchFinding[]; again?: unknown }
  if (findings.length === 0) return { red: false, lines: [`✓ 启动数闸门：${tally.length} 种配置有计数，都在线内`] }
  const lines = [...launchReport(findings)]
  // 重跑那次没拿到计数的，超线照第一次报（settleLaunches）；原先没有一行说为什么
  if (isObject(again)) for (const key of launchRecheck(findings))
    if (again[key] === null) lines.push(`  ${key} 重跑那次没拿到计数，超线照第一次报（第五节末）`)
  if ('unknown' in trunk) return { red: true,
    lines: [...lines, `✗ 启动数闸门：${findings.length} 条发现；无从判断 HEAD 在不在主干上（${trunk.unknown}），按 PR 判红`] }
  if (!trunk.onTrunk) return { red: true, lines: [...lines, `✗ 启动数闸门：${findings.length} 条发现，不设豁免（ADR-145）`] }
  lines.push('启动数闸门：HEAD 就在主干上，只报数不判红（ADR-145 第四节）')
  if (findings.some(f => f.kind !== 'unsteady'))
    lines.push('  主干上有发现：按「主干红了」的优先级先开拆组的那一条，其余在途 PR 等它合了再把主干合进来')
  if (findings.some(f => f.kind === 'unsteady'))
    lines.push('  主干上报了启动数不确定：第六节的死亡条件响了，这道闸门退不退成只报数由需求所有者定')
  return { red: false, lines }
}
