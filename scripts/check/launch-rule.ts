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

/**
 * 两条规则的判定。`baselines` 以 `configurationKey` 为键；`declared` 是每个验证者的声明标签清单。
 * 顺序：全跑的按 id 排在前，其余先按配置键、同一配置里 `paid` 按变异 id。
 */
export function launchFindings(
  mutations: readonly LaunchMutation[],
  baselines: ReadonlyMap<string, BaselineLaunches>,
  declared: Readonly<Record<LaunchVerifier, readonly string[]>>,
): LaunchFinding[] {
  const fullRun: string[] = []
  const byConfig = new Map<string, LaunchMutation[]>()
  for (const m of mutations) {
    if (m.only === undefined) { fullRun.push(m.id); continue }
    const key = configurationKey({ by: m.by, only: m.only, executes: [] })
    byConfig.set(key, [...byConfig.get(key) ?? [], m])
  }
  const out: LaunchFinding[] = fullRun.sort(byText).map(id => ({ kind: 'full-run', id }))
  for (const key of [...byConfig.keys()].sort(byText)) {
    const routed = [...byConfig.get(key)!].sort((a, b) => byText(a.id, b.id))
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
    else
      lines.push(`✗ ${f.config} 没有启动计数（落到它的变异：${f.ids.join('、')}）—— 计数缺了不放行`)
  }
  lines.push('  改法只有三种：拆组（按变异点名的用例拆，ADR-131）；',
    '        把覆盖整个矩阵的一条断言改成每个用例各一条；',
    '        把真入口用例移出需求测试组（ADR-120）。',
    '  少写变异不是改法。不设豁免；上限只能改常量、写决策记录、由需求所有者批（ADR-145）')
  return lines
}
