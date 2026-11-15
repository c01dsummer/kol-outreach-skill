/**
 * 变异负载闸门（ADR-203）—— 新增的变异不让 CI 悄悄变慢。纯判定：不起进程、不读文件，量由入口数好交进来。
 *
 * CI 上变异一步分成三份并行跑（ADR-197、ADR-200），整跑要等最重的那一份。会让它变慢的有三种涨法，各守一道：
 * - **三份不均**：同一种配置的变异必须在同一份里（那种配置的基线只跑一次），某种配置越长越大，那一份就越拖越慢；
 * - **一次涨一大截**：一个 PR 加了一大批变异；
 * - **一次涨一点、涨了很多次**：每次都不显眼，十月和十一月那两轮变慢都是这么涨上去的 ——
 *   跟上一次比永远「差不多」，所以第三道不跟谁比，看的是最重的那一份离上限还有多远。
 *
 * **量用仓库里的实测秒数文件，不用这一跑的秒数**（需求所有者 2026-11-15 06:06Z 选的，ADR-203 第二节）：
 * `scripts/check/shard-weights.json` 记着每种配置一次正常基线几秒、一条变异几秒，取自 CI 上几跑变异一步的成本报告
 * （`weightsFromReports`，由 `npm run shard-weights` 写）。拿这一跑的秒数判红，同一个提交重跑一次就可能换个结论
 * （同一份代码在不同 runner 上差到 ×1.6）；拿文件里的数，同一棵树永远算出同一个数。文件里没有的配置按验证者取默认值。
 * 分份也按同一份数分（`jobs-rule.ts` 的 `shardPlan`），闸门量的就是变异一步实际的分法。文件旧了只影响分得平不平、
 * 估得准不准，不影响哪条变异被抓到。
 *
 * 三道线与有没有豁免是需求所有者 2026-11-15 05:41Z 在选择卡上定的（ADR-203 第三节）：PR 上越线就红；主干上只报数 ——
 * CI 跑在推送之后，主干上判红只会让主干变红（同体量闸门、启动数闸门的理由）。只有「一次涨一大截」那一道
 * 可以用提交信息末段的 `mutation-growth-ok: <理由>` 豁免；另两道不设豁免，越线的改法写在各自那一行里。
 * 读不到就红：主干上算不出、PR 基线的清单读不出来、秒数文件认不得，都不当成「没涨」。
 */

/** CI 上变异一步分几份。`.github/workflows/check.yml` 里写死的几处与它对不对得上由 `workflowWiringFaults` 核（ADR-203 第四节） */
export const SHARD_COUNT = 3
/** CI 上每一份变异派几个 worker（ADR-200：4 核的 runner 上派 6 个）。与 `check.yml` 对得上由 `workflowWiringFaults` 核 */
export const CI_MUTATE_JOBS = 6

/** 最重一份比平均值高多少就红 */
export const BALANCE_LIMIT = 0.25
/** 一次 PR 让总秒数比 PR 基线涨多少就红 */
export const GROWTH_LIMIT = 0.05
/**
 * 一份里验证者秒数合计折成那一份变异一步的墙钟：× 0.19。6 个 worker 跑在 4 核上，几个验证者同时跑；
 * 主干五跑十五份实测 0.180～0.191（ADR-203 第二节）
 */
export const WALL_PER_VERIFIER_SECOND = 0.19
/** 最重一份的变异一步预计超过几分钟就红 */
export const CEILING_MINUTES = 14
/** 上面那条线折成验证者秒数：14 × 60 ÷ 0.19 ≈ 4421 */
export const CEILING_SECONDS = Math.round(CEILING_MINUTES * 60 / WALL_PER_VERIFIER_SECOND)

/** 「一次涨一大截」那一道的豁免写在提交信息末段的 trailer 里，键是这个 */
export const GROWTH_WAIVER_KEY = 'mutation-growth-ok'

/** 树内的实测秒数文件 */
export const SHARD_WEIGHTS_FILE = 'scripts/check/shard-weights.json'
export const SHARD_WEIGHTS_SCHEMA = 'mutation-shard-weights/v1'
const VERIFIER_NAMES = ['test', 'selfcheck'] as const
type VerifierName = (typeof VERIFIER_NAMES)[number]
const isVerifier = (v: unknown): v is VerifierName => (VERIFIER_NAMES as readonly unknown[]).includes(v)

/** 一种配置：一次正常基线几秒、一条变异几秒 */
export interface PileCost { readonly base: number; readonly each: number }
export interface ShardWeights {
  readonly schema: typeof SHARD_WEIGHTS_SCHEMA
  /** 取自哪几跑（成本报告里的 headSha），按字典序 */
  readonly runs: readonly string[]
  /** 文件里没有的配置按验证者取这里的 */
  readonly defaults: Readonly<Record<VerifierName, PileCost>>
  /** 键是变异一步的配置键（`jobs-rule.ts` 的 `shardKey`） */
  readonly configs: Readonly<Record<string, PileCost>>
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isCost = (v: unknown): v is PileCost => isObject(v)
  && typeof v.base === 'number' && Number.isFinite(v.base) && v.base >= 0
  && typeof v.each === 'number' && Number.isFinite(v.each) && v.each >= 0

/** 认秒数文件。认不得交回为什么 —— 认不得就不分、不判，不拿一个猜的数顶上 */
export function readWeights(json: unknown): { weights: ShardWeights } | { fault: string } {
  if (!isObject(json) || json.schema !== SHARD_WEIGHTS_SCHEMA) return { fault: `schema 不是 ${SHARD_WEIGHTS_SCHEMA}` }
  if (!Array.isArray(json.runs) || json.runs.some(r => typeof r !== 'string')) return { fault: 'runs 不是一组字符串' }
  if (!isObject(json.defaults)) return { fault: 'defaults 不是对象' }
  for (const by of VERIFIER_NAMES) if (!isCost(json.defaults[by])) return { fault: `defaults.${by} 不是一对非负的 base、each` }
  if (!isObject(json.configs)) return { fault: 'configs 不是对象' }
  for (const [key, cost] of Object.entries(json.configs)) if (!isCost(cost)) return { fault: `configs 里 ${key} 不是一对非负的 base、each` }
  return { weights: json as unknown as ShardWeights }
}

/** 跑一遍整个验证者大约几秒：文件里这个验证者各种配置的一次基线加起来（键认不出来的不算） */
const fullRunSeconds = (w: ShardWeights, name: VerifierName): number => {
  let sum = 0
  for (const [key, cost] of Object.entries(w.configs)) {
    let parsed: unknown
    try { parsed = JSON.parse(key) } catch { continue }
    if (Array.isArray(parsed) && parsed[0] === name) sum += cost.base
  }
  return sum
}

/**
 * 一摞的秒数：文件里有这种配置就用它的，没有就按验证者取默认值；都是一次基线加 n 条变异。
 * 整跑的变异（键是 undefined）每一条都要把整个验证者跑一遍：按 n × 那个验证者各配置基线之和算，
 * 不少于默认值的一次基线加一条（文件里一种配置都没有时）。认不得的验证者抛错 —— 猜一个数等于量一个编出来的量。
 */
export function pileSeconds(w: ShardWeights, key: string | undefined, by: string | undefined, n: number): number {
  const name = by === undefined ? 'test' : by
  if (!isVerifier(name)) throw new Error(`认不得的验证者「${name}」，不知道它一条要几秒`)
  if (key === undefined) return n * Math.max(fullRunSeconds(w, name), w.defaults[name].base + w.defaults[name].each)
  const cost = Object.hasOwn(w.configs, key) ? w.configs[key] : w.defaults[name]
  return cost.base + n * cost.each
}

/** 变异一步与闸门称一摞用的同一个函数：这一摞的键、这一摞的条目（取第一条的验证者） → 秒数 */
export const pileWeigher = (w: ShardWeights) =>
  (key: string | undefined, pile: readonly { readonly by?: string }[]): number => pileSeconds(w, key, pile[0]?.by, pile.length)

const round2 = (x: number): number => Math.round(x * 100) / 100
/** 中位数：排好序取下标 ⌊(n−1)/2⌋（偶数个取较小的那个） */
const median = (xs: readonly number[]): number => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]
const sumOf = (o: unknown, field: 'totalMs' | 'samples'): number | undefined => {
  if (!isObject(o)) return undefined
  let s = 0
  for (const v of Object.values(o)) {
    if (!isObject(v) || typeof v[field] !== 'number' || !Number.isFinite(v[field]) || (v[field] as number) < 0) return undefined
    s += v[field] as number
  }
  return s
}

/**
 * 从 CI 上几跑变异一步的成本报告（每份分片一份 `MUTATION_COST_JSON` 的 `report`）派生秒数文件。
 * 同一个 headSha 的几份算同一跑。每种配置每一跑：base = 基线各类毫秒之和，each = 变异各类毫秒之和 ÷ 各类样本数之和
 * （样本为 0 的那一跑不取 each）；文件里记各跑的中位数，两位小数。默认值：base 取该验证者各配置各跑 base 的中位数，
 * each 取该验证者全部变异毫秒 ÷ 全部样本。报告形状不对、一份都没有、某个验证者一条都没有，交回为什么。
 */
export function weightsFromReports(reports: readonly unknown[]): { weights: ShardWeights } | { fault: string } {
  if (reports.length === 0) return { fault: '一份成本报告都没有' }
  const byKey = new Map<string, VerifierName>()
  const perRun = new Map<string, Map<string, { base: number; ms: number; samples: number }>>()
  const totals = new Map<VerifierName, { ms: number; samples: number }>()
  for (const [i, r] of reports.entries()) {
    if (!isObject(r) || !isObject(r.identity) || typeof r.identity.headSha !== 'string' || !Array.isArray(r.rows)) return { fault: `第 ${i + 1} 份报告形状不对` }
    const rows = perRun.get(r.identity.headSha) ?? new Map<string, { base: number; ms: number; samples: number }>()
    perRun.set(r.identity.headSha, rows)
    for (const row of r.rows) {
      if (!isObject(row) || typeof row.key !== 'string' || !isObject(row.route) || !isVerifier(row.route.by)) return { fault: `第 ${i + 1} 份报告里有一行形状不对` }
      const base = sumOf(row.baselineTimes, 'totalMs'), ms = sumOf(row.mutationTimes, 'totalMs'), samples = sumOf(row.mutationTimes, 'samples')
      if (base === undefined || ms === undefined || samples === undefined) return { fault: `第 ${i + 1} 份报告里 ${row.key} 的时间形状不对` }
      byKey.set(row.key, row.route.by)
      const acc = rows.get(row.key) ?? { base: 0, ms: 0, samples: 0 }
      rows.set(row.key, { base: acc.base + base, ms: acc.ms + ms, samples: acc.samples + samples })
      const t = totals.get(row.route.by) ?? { ms: 0, samples: 0 }
      totals.set(row.route.by, { ms: t.ms + ms, samples: t.samples + samples })
    }
  }
  const bases = new Map<string, number[]>(), eaches = new Map<string, number[]>()
  for (const rows of perRun.values()) for (const [key, v] of rows) {
    bases.set(key, [...(bases.get(key) ?? []), v.base / 1000])
    if (v.samples > 0) eaches.set(key, [...(eaches.get(key) ?? []), v.ms / v.samples / 1000])
  }
  const defaults = {} as Record<VerifierName, PileCost>
  for (const by of VERIFIER_NAMES) {
    const t = totals.get(by), all = [...byKey].filter(([, b]) => b === by).flatMap(([k]) => bases.get(k) ?? [])
    if (t === undefined || t.samples === 0 || all.length === 0) return { fault: `${by} 一条变异的实测都没有` }
    defaults[by] = { base: round2(median(all)), each: round2(t.ms / t.samples / 1000) }
  }
  const configs: Record<string, PileCost> = {}
  for (const key of [...byKey.keys()].sort()) {
    const each = eaches.get(key)
    configs[key] = { base: round2(median(bases.get(key)!)), each: each === undefined ? defaults[byKey.get(key)!].each : round2(median(each)) }
  }
  return { weights: { schema: SHARD_WEIGHTS_SCHEMA, runs: [...perRun.keys()].sort(), defaults, configs } }
}

/** 秒数文件的全文：一种配置一行，键按字典序，末尾一个换行 —— 回写两次逐字节相同 */
export function weightsText(w: ShardWeights): string {
  const cost = (c: PileCost): string => `{"base":${c.base},"each":${c.each}}`
  return ['{', `  "schema": ${JSON.stringify(w.schema)},`, `  "runs": ${JSON.stringify(w.runs)},`,
    `  "defaults": {"test":${cost(w.defaults.test)},"selfcheck":${cost(w.defaults.selfcheck)}},`,
    '  "configs": {', Object.keys(w.configs).sort().map(k => `    ${JSON.stringify(k)}: ${cost(w.configs[k])}`).join(',\n'), '  }', '}', ''].join('\n')
}

/**
 * 提交信息末段（只认 trailer 块，见 `trailer.ts`）里 `mutation-growth-ok:` 各行写的理由（去两头空白，空的不收）。
 * 只写键没写理由的那一行过不了 git（行尾空白被去掉）与 trailer 的形状，整块都不算，所以这里不另数「空豁免」。
 */
export function growthWaivers(trailers: readonly string[]): string[] {
  const reasons: string[] = []
  for (const line of trailers) {
    const m = /^([\w.-]+):(.*)$/.exec(line.trim())
    if (m === null || m[1] !== GROWTH_WAIVER_KEY) continue
    const reason = m[2].trim()
    if (reason !== '') reasons.push(reason)
  }
  return reasons
}

/**
 * `check.yml` 的接线对不对得上（ADR-203 第四节；需求所有者 2026-11-15 09:40Z 选的「新设计另开 PR」）。
 *
 * **不猜哪几行属于哪一步。** 先前逐行找文字、再猜它落在哪个 job，评审三轮各找到一种写法让它猜错、悄悄放行。这里改成：
 * 1. 下面每一条「记号」在整份工作流里（去掉 `#` 起的注释）**恰好出现一次**，且落在指定的那个 job 里 ——
 *    job 只认 `jobs:` 底下缩进两格的键（标准的块写法）；写法不标准、认不出是哪个 job 时算对不上；
 * 2. 变异那一步、chain 那一步、分份矩阵各自**紧挨着**写，中间与后面不许夹别的键（变异那一步只许有 env 里那两行）；
 * 3. 写到 `MUTATE_SHARD`、`MUTATE_JOBS` 的行、`matrix:` 与 `shard:` 的行，整份里各只许一行；
 * 4. 任何地方出现 `exclude`／`include` 都红；YAML 的锚点、别名与 `<<:` 合并都红（它们能把一段搬到别处而文字不动）；
 * 5. `if:` 与 `continue-on-error:` 只许出现在三种只报数的步骤里（`lscpu`、欠条点名提醒、墙钟对比）与 check 那个 job 的
 *    `if: ${{ !cancelled() }}` —— 别处写一个，变异那几份或检查链就可能不跑、跑红了也不算红。
 * 最坏是误红（以后真要多写一处这些写法时改这道核对），这几样对不上时不会悄悄放行。没核的照 ADR-203 第七节的欠条。
 * `checkScript` 是 `package.json` 的 `check` 那一串，读不到（undefined）也算一处对不上。对得上交回 []。
 */
export function workflowWiringFaults(workflow: string, checkScript: string | undefined): string[] {
  const raw = workflow.split('\n').map(l => l.replace(/\r$/, '').replace(/#.*$/, '').trimEnd())
  const indent = (i: number): number => raw[i].length - raw[i].trimStart().length
  const text = (i: number): string => raw[i].trim()
  const faults: string[] = []
  const jobsAt = raw.flatMap((l, i) => l === 'jobs:' ? [i] : [])
  if (jobsAt.length !== 1) return [`顶层的「jobs:」有 ${jobsAt.length} 个（应恰好 1 个），认不出各步在哪个 job 里`]
  // 每一行属于哪个 job：jobs: 之后、缩进两格的「名字:」开一个 job，回到顶层就出了 jobs
  const jobOf: (string | undefined)[] = []
  let job: string | undefined
  raw.forEach((l, i) => {
    if (i > jobsAt[0] && l !== '' && indent(i) === 0) job = undefined
    else if (i > jobsAt[0] && /^ {2}[\w-]+:$/.test(l)) job = l.trim().slice(0, -1)
    jobOf.push(i > jobsAt[0] ? job : undefined)
  })
  // 某一行所在的那一步：往上找同一个 job 里缩进比它浅、以「- 」开头的那一行；job 一级的键没有步骤
  const stepOf = (i: number): number | undefined => {
    for (let k = i; k > jobsAt[0] && jobOf[k] === jobOf[i]; k--) {
      if (text(k).startsWith('- ') && (k === i || indent(k) < indent(i))) return indent(k) >= 6 ? k : undefined
      if (raw[k] !== '' && indent(k) <= 4 && k !== i) return undefined
    }
    return undefined
  }
  const stepLines = (start: number): string[] => {
    const out = [text(start)]
    for (let k = start + 1; k < raw.length && (raw[k] === '' || indent(k) > indent(start)); k++) if (raw[k] !== '') out.push(text(k))
    return out
  }
  const nextLive = (i: number): number => { let k = i + 1; while (k < raw.length && raw[k] === '') k++; return k }
  const prevLive = (i: number): number => { let k = i - 1; while (k >= 0 && raw[k] === '') k--; return k }

  const list = Array.from({ length: SHARD_COUNT }, (_unused, i) => i + 1).join(', ')
  const shardLine = `MUTATE_SHARD: \${{ matrix.shard }}/${SHARD_COUNT}`, jobsLine = `MUTATE_JOBS: '${CI_MUTATE_JOBS}'`
  const chain = checkScript?.replace(' && npm run mutate', '').replace(' && npm run launches', '')
  if (checkScript === undefined) faults.push('读不到 package.json 的 check 那一串')
  const at = new Map<string, number>()
  const once = (marker: string, wanted: string): void => {
    const hits = raw.flatMap((_l, i) => text(i) === marker ? [i] : [])
    if (hits.length !== 1) { faults.push(`「${marker}」出现了 ${hits.length} 次（应恰好 1 次）`); return }
    if (jobOf[hits[0]] !== wanted) { faults.push(`「${marker}」不在 ${wanted} 那个 job 里`); return }
    at.set(marker, hits[0])
  }
  for (const m of ['- run: npm run mutate', `shard: [${list}]`, shardLine, jobsLine, 'name: mutation-launches-${{ matrix.shard }}',
    `path: output/mutation-launches/launches-\${{ matrix.shard }}-of-${SHARD_COUNT}.json`]) once(m, 'mutate')
  if (chain !== undefined) once(`- run: ${chain}`, 'chain')
  for (const m of ['needs: [chain, mutate]', 'CHAIN: ${{ needs.chain.result }}', 'MUTATE: ${{ needs.mutate.result }}',
    '[ "$CHAIN" = success ] && [ "$MUTATE" = success ]', 'pattern: mutation-launches-*', '- run: npm run launches']) once(m, 'check')

  for (const [what, hit] of [['写到 MUTATE_SHARD 的', (t: string) => t.includes('MUTATE_SHARD')], ['写到 MUTATE_JOBS 的', (t: string) => t.includes('MUTATE_JOBS')],
    ['「matrix:」', (t: string) => /^(- )?matrix\s*:/.test(t)], ['「shard:」', (t: string) => /^(- )?shard\s*:/.test(t)]] as const) {
    const n = raw.filter((_l, i) => hit(text(i))).length
    if (n !== 1) faults.push(`${what}行有 ${n} 行（应只有 1 行）`)
  }
  // 紧挨着：变异那一步下面恰是 env 与那两行，再往下就是下一步；chain 那一步与矩阵那一行后面不再有同一段的键
  const mutate = at.get('- run: npm run mutate')
  if (mutate !== undefined) {
    const d = indent(mutate), e = nextLive(mutate), a = nextLive(e), b = nextLive(a), after = nextLive(b)
    const env = [a, b].filter(k => k < raw.length && indent(k) === d + 4).map(text).sort()
    if (!(e < raw.length && text(e) === 'env:' && indent(e) === d + 2 && env.join('\n') === [shardLine, jobsLine].sort().join('\n')
      && (after >= raw.length || indent(after) <= d))) faults.push('「- run: npm run mutate」那一步不是恰好只带 env 里那两行')
  }
  const chainAt = chain === undefined ? undefined : at.get(`- run: ${chain}`)
  if (chainAt !== undefined) { const n = nextLive(chainAt); if (n < raw.length && indent(n) > indent(chainAt)) faults.push('chain 那一步除了 run 还写了别的') }
  const shardAt = at.get(`shard: [${list}]`)
  if (shardAt !== undefined) {
    const p = prevLive(shardAt), n = nextLive(shardAt)
    if (!(p >= 0 && text(p) === 'matrix:' && indent(p) === indent(shardAt) - 2 && (n >= raw.length || indent(n) < indent(shardAt))))
      faults.push(`矩阵不是恰好一行「shard: [${list}]」`)
  }

  raw.forEach((_l, i) => {
    const t = text(i)
    if (/^(- )?(exclude|include)\s*:/.test(t)) faults.push(`第 ${i + 1} 行写了 ${t.replace(/^- /, '').split(':')[0]}（矩阵剔掉或加进某一份）`)
    if (/^(- )?<<\s*:/.test(t) || /:\s+[&*][\w-]+/.test(t) || /^- [&*][\w-]+/.test(t)) faults.push(`第 ${i + 1} 行用了 YAML 锚点、别名或合并`)
    if (/^(- )?(if|continue-on-error)\s*:/.test(t)) {
      const s = stepOf(i)
      const quiet = s !== undefined && stepLines(s).some(l => ['- run: lscpu', 'run: lscpu', 'run: npm run -s debt-touch', '- name: 墙钟对比（只报数）'].includes(l))
      const checkJob = s === undefined && jobOf[i] === 'check' && t === 'if: ${{ !cancelled() }}' && indent(i) === 4
      if (!quiet && !checkJob) faults.push(`第 ${i + 1} 行「${t}」写在只报数的步骤以外（${jobOf[i] ?? '不在任何 job'} 那个 job 里）`)
    }
  })
  return faults
}

/** 闸门要的量。`trunk` 同启动数闸门：在不在主干上，或者问不出来 */
export interface ShardLoadInput {
  /** 每一份的验证者秒数（`shardPlan` 交回的 `loads`），按份的编号排 */
  readonly loads: readonly number[]
  /** PR 基线（主干上是上一版）那份清单按同一份秒数文件算出的总秒数；读不出来时说为什么 */
  readonly base: { readonly total: number } | { readonly unknown: string }
  readonly trunk: { readonly onTrunk: boolean } | { readonly unknown: string }
  /** 这条分支自己的提交里 `growthWaivers` 读出来的理由 */
  readonly waivers: readonly string[]
  /** `workflowWiringFaults` 交回的：`check.yml` 接线对不上的几处 */
  readonly wiring: readonly string[]
}
export interface ShardLoadGate { readonly red: boolean; readonly lines: readonly string[] }

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
const minutes = (seconds: number): string => (seconds * WALL_PER_VERIFIER_SECOND / 60).toFixed(1)

/**
 * 判三道线。先打一行报数（每份秒数、最重一份比平均高多少、预计几分钟、总秒数比基线涨了多少），再每越一道线打一行 ✗。
 * 红：问不出在不在主干上、接线对不上（两样主干上也红：它们是数据错，不是越线）；
 * PR 上越了线（「一次涨一大截」有理由豁免的除外）、PR 基线读不出来。
 */
export function shardLoadGate(input: ShardLoadInput): ShardLoadGate {
  const { loads, base, trunk, waivers, wiring } = input
  const lines: string[] = []
  let fault = false
  if ('unknown' in trunk) { lines.push(`✗ 变异负载：问不出这棵树在不在主干上（${trunk.unknown}），三道线都没法判`); return { red: true, lines } }
  if (wiring.length > 0) {
    fault = true
    lines.push(`✗ 变异负载：check.yml 的接线对不上（份数按 ${SHARD_COUNT}、派 ${CI_MUTATE_JOBS} 个 worker）—— ${wiring.join('；')}`)
  }
  const onTrunk = trunk.onTrunk
  const total = loads.reduce((a, b) => a + b, 0)
  const heaviest = Math.max(0, ...loads)
  const mean = loads.length === 0 ? 0 : total / loads.length
  const over = mean === 0 ? 0 : heaviest / mean - 1
  const vs = onTrunk ? '上一版' : ' PR 基线'
  let growth: number | undefined
  let delta: string
  if ('total' in base) {
    const d = Math.round(total - base.total)
    growth = base.total === 0 ? (total > 0 ? Infinity : 0) : (total - base.total) / base.total
    delta = `比${vs} ${d > 0 ? '+' : ''}${d} 秒（${Number.isFinite(growth) ? `${growth >= 0 ? '+' : ''}${pct(growth)}` : '基线为 0'}，线 ${pct(GROWTH_LIMIT)}）`
  } else delta = `比${vs}：读不出来（${base.unknown}）`
  lines.push(`变异负载（验证者秒数，按 ${SHARD_WEIGHTS_FILE}）：`
    + `${loads.length} 份 ${loads.map(Math.round).join(' / ')}，最重一份比平均高 ${pct(over)}（线 ${pct(BALANCE_LIMIT)}），`
    + `预计约 ${minutes(heaviest)} 分钟（线 ${CEILING_MINUTES} 分钟）；总 ${Math.round(total)} 秒，${delta}`
    + (onTrunk ? ' —— 主干上只报数' : ''))
  const findings: string[] = []
  if (over > BALANCE_LIMIT) findings.push(`✗ 三份不均：最重一份 ${Math.round(heaviest)} 秒，比平均 ${Math.round(mean)} 秒高 ${pct(over)}，过了 ${pct(BALANCE_LIMIT)} 那条线 —— `
    + '多半是某一种配置的变异太多、一摞压在一份里；把那组用例拆成两组、或删掉重复的变异。不设豁免')
  if (heaviest > CEILING_SECONDS) findings.push(`✗ 最重一份太重：${Math.round(heaviest)} 秒，预计约 ${minutes(heaviest)} 分钟，过了 ${CEILING_MINUTES} 分钟（${CEILING_SECONDS} 秒）那条线 —— `
    + '变异总量涨到头了：删掉重复的变异，或由需求所有者决定加一台 runner（改份数）。不设豁免')
  if (growth !== undefined && growth > GROWTH_LIMIT) {
    const line = `一次涨太多：这次让总秒数涨了 ${Number.isFinite(growth) ? pct(growth) : '（基线为 0）'}，过了 ${pct(GROWTH_LIMIT)} 那条线`
    if (onTrunk) findings.push(`✗ ${line}`)
    else if (waivers.length > 0) lines.push(`  已豁免：${line}（${GROWTH_WAIVER_KEY}：${waivers.join('；')}）`)
    else findings.push(`✗ ${line} —— 拆成几个 PR，或在提交信息末段写「${GROWTH_WAIVER_KEY}: <理由>」`)
  }
  if (!onTrunk && !('total' in base)) { fault = true; lines.push('✗ 变异负载：PR 基线那份变异清单读不出来，一次涨了多少没法判，不当成没涨') }
  lines.push(...findings)
  return { red: fault || (!onTrunk && findings.length > 0), lines }
}
