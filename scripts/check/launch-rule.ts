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
import { type CostMutation, configurationKey } from './jobs-rule.js'
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

/**
 * 第七节末第一行（ADR-145 第二十七节第 2 小节）：组内不起进程的配置，进程内耗时，以这一跑单条变异耗时的中位数为单位。
 * `baselines` 是正常基线的计数，`mutations` 是成本观测里变异那一张；交回那一行，不带缩进。只报数
 */
export function inProcessLine(baselines: ReadonlyMap<string, BaselineLaunches>, mutations: readonly CostMutation[]): string {
  if (baselines.size === 0) return '进程内耗时：没有启动计数，分不出哪些配置组内不起进程（只报数）'
  // 只认回报了、经过时间是有限非负实测值的；单位与合计都只用这几条
  const timed = mutations.flatMap(m => m.state === 'reported' && m.elapsed.kind === 'measured'
    && Number.isFinite(m.elapsed.ms) && m.elapsed.ms >= 0 ? [{ key: m.key, ms: m.elapsed.ms }] : [])
  const sorted = timed.map(t => t.ms).sort((a, b) => a - b)
  const mid = sorted.length >> 1
  const unit = sorted.length === 0 ? 0 : sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  if (unit === 0) return '进程内耗时：这一跑没有实测的变异耗时，无从归一（只报数）'
  const rows = new Map<string, { ms: number; n: number }>()
  for (const t of timed) {
    if (baselines.get(t.key)?.total !== 0) continue
    const row = rows.get(t.key) ?? { ms: 0, n: 0 }
    rows.set(t.key, { ms: row.ms + t.ms, n: row.n + 1 })
  }
  if (rows.size === 0) return '进程内耗时：组内不起进程的配置没有实测的变异耗时（只报数）'
  const one = (ms: number): string => (ms / unit).toFixed(1)
  const all = [...rows].sort(([a, x], [b, y]) => y.ms - x.ms || byText(a, b))
  const total = all.reduce((s, [, r]) => s + r.ms, 0), n = all.reduce((s, [, r]) => s + r.n, 0)
  return `进程内耗时（组内不起进程的 ${rows.size} 种配置、${n} 条变异，只报数）：合计 ${one(total)} 个单位；`
    + `单位是这一跑 ${sorted.length} 条实测变异单条耗时的中位数 ${(unit / 1000).toFixed(1)} 秒；`
    + `最多的：${all.slice(0, 5).map(([key, r]) => `${key} ${one(r.ms)}`).join('、')}`
}

/** 整跑自检按族数的启动计数（ADR-145 第三十一节第 2 小节）：自检写、检查链最后一步读 */
export const SELFCHECK_LAUNCHES_FILE = 'output/selfcheck-launches/families.json'
export const SELFCHECK_LAUNCHES_SCHEMA = 'selfcheck-launches/v1'

/**
 * 第七节末第二行（ADR-145 第三十一节第 4 小节）：有启动但没有变异的组。`file` 是读出来的按族计数，`source` 是当前树的身份，
 * `routes` 是 `executionRoutes` 交回的全部路由，只认自检的；交回那一行，不带缩进。只报数
 */
export function idleGroupsLine(file: unknown, source: string | undefined,
  routes: readonly { readonly by: string; readonly executes: readonly string[] }[] | undefined): string {
  const head = '有启动但没有变异的组'
  const families = familyCounts(file)
  if (families === undefined) return `${head}：没有自检整跑的按族启动计数（只报数）`
  if (source === undefined || source !== (file as { source: string }).source) return `${head}：自检的按族启动计数不是这棵树上数的（只报数）`
  if (routes === undefined) return `${head}：算不出自检变异落到哪些组（只报数）`
  const routed = new Set(routes.flatMap(r => r.by === 'selfcheck' ? r.executes : []))
  let mixed = 0, unknown = 0
  const idle: { name: string; groups: number; launches: number }[] = []
  for (const f of families) {
    const off = f.groups.filter(g => !routed.has(g)).length
    // 有一组落到：这一族的启动数分不到没落到的组头上，只数组数
    if (off < f.groups.length) mixed += off
    else if (f.launches === null) unknown++
    else if (f.launches > 0) idle.push({ name: f.groups.join('+'), groups: f.groups.length, launches: f.launches })
  }
  idle.sort((a, b) => b.launches - a.launches || byText(a.name, b.name))
  return `${head}（自检，只报数）：整族没有变异落到、起过进程的 ${idle.length} 族、`
    + `${idle.reduce((s, f) => s + f.groups, 0)} 组共起 ${idle.reduce((s, f) => s + f.launches, 0)} 次，不含 git`
    + (idle.length > 0 ? `；最多的：${idle.slice(0, 5).map(f => `${f.name} ${f.launches}`).join('、')}` : '')
    + `；与有变异的组同族、按族分不开的 ${mixed} 组不在其内`
    + (unknown > 0 ? `；整族没有变异落到、没拿到计数的 ${unknown} 族不在其内` : '')
}

/** 第三十一节第 4 小节「认文件」：认得交回那几族，认不得是 undefined */
function familyCounts(file: unknown): { groups: readonly string[]; launches: number | null }[] | undefined {
  if (!isObject(file) || file.schema !== SELFCHECK_LAUNCHES_SCHEMA || typeof file.source !== 'string'
    || !Array.isArray(file.families)) return undefined
  const seen = new Set<string>()
  for (const f of file.families) {
    if (!isObject(f) || !Array.isArray(f.groups) || f.groups.length === 0
      || !f.groups.every(g => typeof g === 'string' && g !== '')) return undefined
    if (f.launches !== null && !(Number.isSafeInteger(f.launches) && (f.launches as number) >= 0)) return undefined
    for (const g of f.groups as string[]) { if (seen.has(g)) return undefined; seen.add(g) }
  }
  return file.families as { groups: string[]; launches: number | null }[]
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
 * 再看发现：没有就绿，有就在 PR 上红（「不确定」也红），在主干上只报数，缺计数的除外。不重判，读文件里变异一步判好的发现。
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
  // 缺计数不是超线：第五节末「某种配置的计数缺了，判定一律报错」，主干上也红；每种配置至多一条 missing
  const missing = findings.filter(f => f.kind === 'missing').length
  if (missing > 0) return { red: true, lines: [...lines,
    `✗ 启动数闸门：${findings.length} 条发现，其中 ${missing} 种配置没有启动计数：HEAD 就在主干上也红，计数缺了不放行（ADR-145 第五节末）`] }
  lines.push('启动数闸门：HEAD 就在主干上，只报数不判红（ADR-145 第四节）')
  if (findings.some(f => f.kind !== 'unsteady'))
    lines.push('  主干上有发现：按「主干红了」的优先级先开拆组的那一条，其余在途 PR 等它合了再把主干合进来')
  if (findings.some(f => f.kind === 'unsteady'))
    lines.push('  主干上报了启动数不确定：第六节的死亡条件响了，这道闸门退不退成只报数由需求所有者定')
  return { red: false, lines }
}

/** 树内的启动数摘要（ADR-145 第三十五节）：npm run launches -- --write 写，检查链最后一步拿它与现算的比 */
export const LAUNCH_SUMMARY_FILE = 'scripts/check/launches.json'
export const LAUNCH_SUMMARY_SCHEMA = 'mutation-launch-summary/v1'
/** 派生出来的全文与配置种数；派生不出来时是第一条不过的原因 */
export type LaunchSummary = { readonly text: string; readonly configs: number } | { readonly fault: string }

const count = (v: unknown): boolean => Number.isSafeInteger(v) && (v as number) >= 0
/** 第三十五节第 3 小节：tally 的每一项认得。recordFault 只核它是不是数组 */
function tallyFault(tally: readonly unknown[]): boolean {
  const seen = new Set<string>()
  for (const t of tally) {
    if (!isObject(t) || typeof t.config !== 'string' || t.config === '' || seen.has(t.config)
      || !count(t.launches) || !count(t.running) || !Array.isArray(t.paid)
      || !t.paid.every(p => isObject(p) && typeof p.id === 'string' && p.id !== '' && count(p.paid))) return true
    seen.add(t.config)
  }
  return false
}

/** 第 2 小节「压成一行」：对象的键按 JS `<` 排（不靠 JSON.stringify 的键序：整数样的键它会提到前面），不加空白 */
function compact(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(compact).join(',')}]`
  if (isObject(v)) return `{${Object.keys(v).sort(byText).map(k => `${JSON.stringify(k)}:${compact(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}

/** 第 2 小节：一种配置一行的五个键；maxPaid 并列取 id 小的 */
function summaryRow(t: LaunchTally): Record<string, unknown> {
  let max: { id: string; paid: number } | null = null
  for (const p of t.paid) if (max === null || p.paid > max.paid || (p.paid === max.paid && byText(p.id, max.id) < 0)) max = p
  return { config: t.config, launches: t.launches, maxPaid: max === null ? null : { id: max.id, paid: max.paid },
    running: t.running, stopping: t.paid.length }
}

/** 第 2 小节「序列化」：顶层三个键各起一行，数组每项一行、四格缩进，空数组写在键那一行上，末尾一个换行 */
function summaryText(configs: readonly string[], findings: readonly string[]): string {
  const list = (key: string, items: readonly string[]): string => items.length === 0 ? `  ${JSON.stringify(key)}: [],`
    : [`  ${JSON.stringify(key)}: [`, items.map(i => `    ${i}`).join(',\n'), '  ],'].join('\n')
  return ['{', list('configs', configs), list('findings', findings), `  "schema": ${JSON.stringify(LAUNCH_SUMMARY_SCHEMA)}`, '}', ''].join('\n')
}

/** 第三十五节第 2、3 小节：从变异一步那份启动数文件派生摘要的全文。record、source 同 launchGate */
export function launchSummary(record: unknown, source: string | undefined): LaunchSummary {
  const fault = recordFault(record, source)
  if (fault !== undefined) return { fault }
  const { tally, findings } = record as { tally: unknown[]; findings: unknown[] }
  if (tallyFault(tally)) return { fault: '启动数文件的 tally 里有一项认不得' }
  const rows = (tally as LaunchTally[]).map(summaryRow).sort((a, b) => byText(a.config as string, b.config as string))
  return { text: summaryText(rows.map(compact), findings.map(compact)), configs: rows.length }
}

const pick = (o: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter(k => Object.prototype.hasOwnProperty.call(o, k)).map(k => [k, o[k]]))

/** 第 4 小节「差别」认文件：认得交回按配置键的一行与 findings 各条，都已压成一行；认不得是 undefined */
function summaryParts(text: string): { rows: Map<string, string>; findings: string[] } | undefined {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return undefined }
  if (!isObject(parsed) || parsed.schema !== LAUNCH_SUMMARY_SCHEMA || !Array.isArray(parsed.configs) || !Array.isArray(parsed.findings)) return undefined
  const rows = new Map<string, string>()
  for (const c of parsed.configs) {
    if (!isObject(c) || typeof c.config !== 'string' || c.config === '' || rows.has(c.config)) return undefined
    // 只取五个键，maxPaid 是对象时只取 id、paid；缺的不写。多出来的键不算「变了」，落进「差在别处」
    const row = pick(c, ['config', 'launches', 'maxPaid', 'running', 'stopping'])
    if (isObject(row.maxPaid)) row.maxPaid = pick(row.maxPaid, ['id', 'paid'])
    rows.set(c.config, compact(row))
  }
  return { rows, findings: parsed.findings.map(compact) }
}

/** 第 4 小节「差别」：树内与现算的按配置键对上，数变了、多了、少了几种，前五种的键，findings 同不同 */
function summaryDiff(tree: string, text: string): string {
  const mine = summaryParts(tree)
  if (mine === undefined) return '认不得树内的文件'
  const now = summaryParts(text)!
  const changed = [...now.rows].filter(([k, row]) => mine.rows.has(k) && mine.rows.get(k) !== row).map(([k]) => k)
  const added = [...now.rows.keys()].filter(k => !mine.rows.has(k))
  const removed = [...mine.rows.keys()].filter(k => !now.rows.has(k))
  const findings = mine.findings.length !== now.findings.length || mine.findings.some((f, i) => f !== now.findings[i])
  const keys = [...changed, ...added, ...removed].sort(byText)
  if (keys.length === 0 && !findings) return '配置与 findings 都一样，差在别处，不是 --write 写的'
  return `变了 ${changed.length} 种、多了 ${added.length} 种、少了 ${removed.length} 种`
    + (keys.length > 0 ? `：${keys.slice(0, 5).join('、')}${keys.length > 5 ? ` 等 ${keys.length} 种` : ''}` : '')
    + (findings ? '；findings 也不同' : '')
}

/**
 * 第三十五节第 4 小节：最后一步多打的那一行，不带缩进。tree 是树内文件照 UTF-8 读出的全文，没有或读不出来时是 undefined；
 * computed 是 launchSummary 交回的（别处拼出来的全文不认，认树内文件时会抛错）。只报数
 */
export function summaryLine(tree: string | undefined, computed: LaunchSummary, trunk: LaunchTrunk): string {
  const head = '启动数摘要（只报数）：'
  if ('fault' in computed) return `${head}这一跑现算不出来（${computed.fault}），不比`
  if (tree === undefined) return `${head}树内没有 ${LAUNCH_SUMMARY_FILE}，不比`
  // 逐字节比：序列化定死了，手改过排版的也算不同
  if (tree === computed.text) return `${head}树内 ${LAUNCH_SUMMARY_FILE} 与这一跑现算的相同，${computed.configs} 种配置`
  const diff = summaryDiff(tree, computed.text)
  // 不知道在不在主干上就按 PR，同闸门
  if ('onTrunk' in trunk && trunk.onTrunk) return `${head}树内 ${LAUNCH_SUMMARY_FILE} 已过期（${diff}），下一条 PR 须 npm run launches -- --write`
  return `${head}树内 ${LAUNCH_SUMMARY_FILE} 与这一跑现算的不同（${diff}）；CI 上比的是与主干的合并提交，这条 PR 没改数时多半是主干已经过期：`
    + '把主干合进来，在这棵树上跑过 npm run mutate 之后，跑 npm run launches -- --write 写回'
}
