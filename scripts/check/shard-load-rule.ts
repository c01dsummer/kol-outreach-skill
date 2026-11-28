/**
 * 变异负载闸门（ADR-203）—— 新增的变异不让 CI 悄悄变慢。纯判定：不起进程、不读文件，量由入口数好交进来。
 *
 * CI 上变异一步分成三份并行跑（ADR-197、ADR-200），整跑要等最重的那一份。会让它变慢的有三种涨法，各守一道：
 * - **三份不均**：同一种配置的变异必须在同一份里（那种配置的基线只跑一次），某种配置越长越大，那一份就越拖越慢；
 * - **一次涨一大截**：一个 PR 加了一大批变异；
 * - **一次涨一点、涨了很多次**：每次都不显眼，十月和十一月那两轮变慢都是这么涨上去的 ——
 *   跟上一次比永远「差不多」，所以第三道不跟谁比，看的是最重的那一份离上限还有多远。
 *
 * **量用主干上一跑的实测秒数**（需求所有者 2026-11-28 02:55Z 选的「直接用主干上一跑实测」，ADR-254；先前是仓库里一份手写的秒数文件，
 * ADR-203 第二节，十一月中以后没人重写，分份与闸门一起失明）。CI 上第一个 job 跑 `scripts/check/main-costs.sh`，
 * 从主干上一跑各份变异的日志里摘出成本报告（`MUTATION_COST_JSON` 那一行），交给这一跑的各份变异与检查链；
 * `mainCostWeights` 把它算成每种配置一次正常基线几秒、一条变异几秒（`weightsFromReports`），这一跑里没有的配置按验证者取默认值。
 * 各份与闸门读的是同一个文件、同一个函数，所以分法处处一样，闸门量的就是变异一步实际的分法。
 * 代价：同一棵树换一个时候跑，主干上一跑换了，数就跟着换（同一份代码在不同 runner 上差到 ×1.6）；涨幅那一道两边用同一份数，不受影响。
 * 取不到时（`unavailable`）：分份退回按条数分（每条都照跑，只是分得不平），闸门在 PR 上红、主干上只报数；
 * 本地没有这份数（入口没拿到 `MAIN_COSTS_ENV`），闸门只核接线，三道线只在 CI 上判。
 *
 * 三道线与有没有豁免是需求所有者 2026-11-15 05:41Z 在选择卡上定的（ADR-203 第三节）：PR 上越线就红；主干上只报数 ——
 * CI 跑在推送之后，主干上判红只会让主干变红（同体量闸门、启动数闸门的理由）。只有「一次涨一大截」那一道
 * 可以用提交信息末段的 `mutation-growth-ok: <理由>` 豁免；另两道不设豁免，越线的改法写在各自那一行里。
 * 读不到就红：主干上算不出、PR 基线的清单读不出来、PR 上取不到主干上一跑的实测，都不当成「没涨」。
 */

/** CI 上变异一步分几份。`.github/workflows/check.yml` 里写死的几处与它对不对得上由 `workflowWiringFaults` 核（ADR-203 第八节） */
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

/** CI 上把主干上一跑的成本报告交给入口的环境变量：值是 `scripts/check/main-costs.sh` 写的那份文件的路径 */
export const MAIN_COSTS_ENV = 'MUTATION_MAIN_COSTS'
/** 那份文件第一行的 schema */
export const MAIN_COSTS_SCHEMA = 'main-mutation-costs/v1'
const VERIFIER_NAMES = ['test', 'selfcheck'] as const
type VerifierName = (typeof VERIFIER_NAMES)[number]
const isVerifier = (v: unknown): v is VerifierName => (VERIFIER_NAMES as readonly unknown[]).includes(v)

/** 一种配置：一次正常基线几秒、一条变异几秒 */
export interface PileCost { readonly base: number; readonly each: number }
export interface ShardWeights {
  /** 取自哪几跑（成本报告里的 headSha），按字典序 */
  readonly runs: readonly string[]
  /** 实测里没有的配置按验证者取这里的 */
  readonly defaults: Readonly<Record<VerifierName, PileCost>>
  /** 键是变异一步的配置键（`jobs-rule.ts` 的 `shardKey`） */
  readonly configs: Readonly<Record<string, PileCost>>
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

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
 * 从 CI 上几跑变异一步的成本报告（每份分片一份 `MUTATION_COST_JSON` 的 `report`）算出每种配置的秒数（`mainCostWeights` 用它）。
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
  return { weights: { runs: [...perRun.keys()].sort(), defaults, configs } }
}

const COST_MARK = 'MUTATION_COST_JSON '
/**
 * 一份成本报告的观测齐不齐：`complete` 为 true；或报告本身没记问题、每一行都没记问题，只有整跑的那几行（`outsideBaseline`）各记了一条。
 * 整跑的变异不另起正常基线，`configurationCost` 给这种行无条件记一条「全量正常基线在本命令外」，别的缺漏都会再多记；
 * 所以「恰好一条」就是只缺这一样。不放这一样，清单里一有整跑的变异，它那一份就永远不完整，之后每跑都取不到。
 */
const costsWhole = (r: Record<string, unknown>): boolean => r.complete === true || (Array.isArray(r.issues) && r.issues.length === 0 && Array.isArray(r.rows) &&
  r.rows.every(row => isObject(row) && Array.isArray(row.issues) && row.issues.length === (row.outsideBaseline === true ? 1 : 0)))
/** 主干上一跑的实测：算好的秒数与它取自哪一跑；或取不到、为什么 */
export type MainCosts =
  | { readonly weights: ShardWeights; readonly run: number; readonly headSha: string }
  | { readonly unavailable: string }

/**
 * 认 `scripts/check/main-costs.sh` 写的那份文件，算成秒数（ADR-254）。第一行是说明取自哪一跑（或取不到、为什么）的一行 JSON，
 * 后面每行是从那几份变异日志里摘出的、带 `MUTATION_COST_JSON ` 的行。只收 `kind` 为 summary 的那几段，要：
 * 恰好 `SHARD_COUNT` 份（每份变异一份）；每份的 `identity.headSha` 都是第一行说的那个提交、`identity.state` 是 succeeded、成本观测齐（`costsWhole`：`complete` 为 true，或只缺整跑那几行的正常基线）；
 * 同一种带子集的配置只出现在一份里（份与份不重叠 —— 同一份日志摘了两遍、或几跑混在一起，就会重叠；整跑的各自成摞、本来就散在几份里，不算）。
 * 都对上了交给 `weightsFromReports` 算；算出来每种配置的秒数全是 0（计时坏了）也算取不到。
 * 哪一样对不上都交回 `unavailable` 与为什么，不拿一份残缺的数顶上。
 */
export function mainCostWeights(text: string): MainCosts {
  const [first, ...rest] = text.split('\n')
  let head: unknown
  try { head = JSON.parse(first) } catch { return { unavailable: '第一行不是一行 JSON' } }
  if (!isObject(head) || head.schema !== MAIN_COSTS_SCHEMA) return { unavailable: `第一行的 schema 不是 ${MAIN_COSTS_SCHEMA}` }
  if (typeof head.unavailable === 'string') return { unavailable: head.unavailable }
  const { run, headSha } = head
  if (typeof run !== 'number' || !Number.isSafeInteger(run) || run <= 0) return { unavailable: '第一行没说取自哪一跑（run 不是正整数）' }
  if (typeof headSha !== 'string' || !/^[0-9a-f]{40}$/.test(headSha)) return { unavailable: '第一行没说取自哪个提交（headSha 不是 40 位十六进制）' }
  const reports: Record<string, unknown>[] = []
  for (const [i, line] of rest.entries()) {
    const at = line.indexOf(COST_MARK)
    if (at < 0) continue
    let seg: unknown
    try { seg = JSON.parse(line.slice(at + COST_MARK.length)) } catch { return { unavailable: `第 ${i + 2} 行的成本报告读不出来` } }
    if (!isObject(seg) || seg.kind !== 'summary') continue
    if (!isObject(seg.report)) return { unavailable: `第 ${i + 2} 行的成本报告没有 report` }
    reports.push(seg.report)
  }
  if (reports.length !== SHARD_COUNT) return { unavailable: `run ${run} 摘出 ${reports.length} 份成本报告，应为 ${SHARD_COUNT} 份` }
  const seen = new Set<string>()
  for (const [i, r] of reports.entries()) {
    const id = isObject(r.identity) ? r.identity : {}
    if (id.headSha !== headSha) return { unavailable: `第 ${i + 1} 份成本报告不是提交 ${headSha.slice(0, 7)} 的` }
    if (id.state !== 'succeeded' || !costsWhole(r)) return { unavailable: `第 ${i + 1} 份成本报告不是一次跑完的变异（state 不是 succeeded，或成本观测缺了整跑那几行的正常基线以外的东西）` }
    for (const row of Array.isArray(r.rows) ? r.rows : []) {
      // 整跑的变异各自成摞、散在几份里，键都一样；只有带子集的配置要求份与份不重叠
      const key = isObject(row) && row.outsideBaseline !== true ? row.key : undefined
      if (typeof key !== 'string') continue
      if (seen.has(key)) return { unavailable: `配置 ${key} 出现在不止一份成本报告里` }
      seen.add(key)
    }
  }
  const got = weightsFromReports(reports)
  if ('fault' in got) return { unavailable: `run ${run} 的成本报告算不出秒数（${got.fault}）` }
  const all = Object.values(got.weights.configs)
  if (all.every(c => c.base === 0 && c.each === 0)) return { unavailable: `run ${run} 的成本报告里每种配置都是 0 秒，计时多半坏了` }
  return { weights: got.weights, run, headSha }
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
 * `.github/workflows/check.yml` 钉死的样子（ADR-203 第八节）：整份去掉整行注释与空行之后，逐行就是这些。
 * 份数、worker 数与 chain 那一串不写死，按 `SHARD_COUNT`、`CI_MUTATE_JOBS` 与 `package.json` 的 `check` 填（«N»、«LIST»、«JOBS»、«CHAIN»）。
 * **改工作流就在同一条 PR 里改这里** —— 闸门红在第一处不一样的那一行，评审看得见这里改了什么。
 */
const WORKFLOW_PIN: readonly string[] = [
  "name: check",
  "on:",
  "  push:",
  "    branches: [main]",
  "  pull_request:",
  "concurrency:",
  "  group: ${{ github.workflow }}-${{ github.ref == 'refs/heads/main' && github.run_id || github.ref }}",
  "  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}",
  "permissions:",
  "  contents: read",
  "  actions: read",
  "jobs:",
  "  main-costs:",
  "    name: 取主干上一跑的变异实测",
  "    runs-on: ubuntu-latest",
  "    timeout-minutes: 5",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - name: 摘主干上一跑各份变异的成本报告",
  "        env:",
  "          GH_TOKEN: ${{ github.token }}",
  "        run: bash scripts/check/main-costs.sh output/main-costs/main-costs.txt «N»",
  "      - uses: actions/upload-artifact@v4",
  "        with:",
  "          name: main-mutation-costs",
  "          path: output/main-costs/main-costs.txt",
  "          if-no-files-found: error",
  "          retention-days: 3",
  "  chain:",
  "    name: 检查链（变异以外各步）",
  "    needs: [main-costs]",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "        with:",
  "          fetch-depth: 0",
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: '22'",
  "          cache: npm",
  "      - name: 装 bubblewrap（外层断网要它）",
  "        run: |",
  "          sudo apt-get update -q",
  "          sudo apt-get install -y -q --no-install-recommends bubblewrap",
  "          command -v bwrap",
  "          bwrap --version",
  "      - name: 关掉用户命名空间限制（bwrap 断网要它）",
  "        run: |",
  "          sysctl kernel.apparmor_restrict_unprivileged_userns",
  "          sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0",
  "          sysctl kernel.apparmor_restrict_unprivileged_userns",
  "      - run: npm ci --prefer-offline --no-audit",
  "      - uses: actions/download-artifact@v4",
  "        with:",
  "          name: main-mutation-costs",
  "          path: output/main-costs",
  "      - run: bash scripts/check/cpu-time.sh 检查链 bash -c '«CHAIN»'",
  "        env:",
  "          SIZE_PR_BASE: ${{ github.event.pull_request.base.ref && format('origin/{0}', github.event.pull_request.base.ref) || '' }}",
  "          MUTATION_MAIN_COSTS: output/main-costs/main-costs.txt",
  "      - name: 欠条点名提醒（只提醒）",
  "        if: always()",
  "        continue-on-error: true",
  "        timeout-minutes: 2",
  "        run: npm run -s debt-touch",
  "      - name: 生词提示（只提醒）",
  "        if: always()",
  "        continue-on-error: true",
  "        timeout-minutes: 2",
  "        run: npm run -s jargon",
  "        env:",
  "          SIZE_PR_BASE: ${{ github.event.pull_request.base.ref && format('origin/{0}', github.event.pull_request.base.ref) || '' }}",
  "      - uses: actions/upload-artifact@v4",
  "        with:",
  "          name: selfcheck-launches",
  "          path: output/selfcheck-launches/families.json",
  "          if-no-files-found: error",
  "          retention-days: 3",
  "      - run: lscpu",
  "        if: always()",
  "        continue-on-error: true",
  "  mutate:",
  "    name: 变异（第 ${{ matrix.shard }}/«N» 份）",
  "    needs: [main-costs]",
  "    runs-on: ubuntu-latest",
  "    strategy:",
  "      fail-fast: false",
  "      matrix:",
  "        shard: [«LIST»]",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "        with:",
  "          fetch-depth: 0",
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: '22'",
  "          cache: npm",
  "      - name: 装 bubblewrap（外层断网要它）",
  "        run: |",
  "          sudo apt-get update -q",
  "          sudo apt-get install -y -q --no-install-recommends bubblewrap",
  "          command -v bwrap",
  "          bwrap --version",
  "      - name: 关掉用户命名空间限制（bwrap 断网要它）",
  "        run: |",
  "          sysctl kernel.apparmor_restrict_unprivileged_userns",
  "          sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0",
  "          sysctl kernel.apparmor_restrict_unprivileged_userns",
  "      - run: npm ci --prefer-offline --no-audit",
  "      - run: npm run compile",
  "      - uses: actions/download-artifact@v4",
  "        with:",
  "          name: main-mutation-costs",
  "          path: output/main-costs",
  "      - run: bash scripts/check/cpu-time.sh 变异 npm run mutate",
  "        env:",
  "          MUTATE_SHARD: ${{ matrix.shard }}/«N»",
  "          MUTATE_JOBS: '«JOBS»'",
  "          MUTATION_MAIN_COSTS: output/main-costs/main-costs.txt",
  "      - uses: actions/upload-artifact@v4",
  "        with:",
  "          name: mutation-launches-${{ matrix.shard }}",
  "          path: output/mutation-launches/launches-${{ matrix.shard }}-of-«N».json",
  "          if-no-files-found: error",
  "          retention-days: 3",
  "      - run: lscpu",
  "        if: always()",
  "        continue-on-error: true",
  "  check:",
  "    needs: [chain, mutate]",
  "    if: ${{ !cancelled() }}",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - name: 变异以外各步与各份变异都绿了才往下",
  "        env:",
  "          CHAIN: ${{ needs.chain.result }}",
  "          MUTATE: ${{ needs.mutate.result }}",
  "        run: |",
  "          echo \"chain：$CHAIN · mutate：$MUTATE\"",
  "          [ \"$CHAIN\" = success ] && [ \"$MUTATE\" = success ]",
  "      - uses: actions/checkout@v4",
  "        with:",
  "          fetch-depth: 0",
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: '22'",
  "          cache: npm",
  "      - run: npm ci --prefer-offline --no-audit",
  "      - uses: actions/download-artifact@v4",
  "        with:",
  "          pattern: mutation-launches-*",
  "          merge-multiple: true",
  "          path: output/mutation-launches",
  "      - uses: actions/download-artifact@v4",
  "        with:",
  "          name: selfcheck-launches",
  "          path: output/selfcheck-launches",
  "      - run: npm run launches",
  "      - name: 墙钟对比（只报数）",
  "        continue-on-error: true",
  "        timeout-minutes: 2",
  "        env:",
  "          GH_TOKEN: ${{ github.token }}",
  "          BASE_SHA: ${{ github.event.before }}",
  "        run: |",
  "          set +e",
  "          out=\"$RUNNER_TEMP/wall.json\"",
  "          auth=(); [ -n \"$GH_TOKEN\" ] && auth=(-H \"Authorization: Bearer $GH_TOKEN\")",
  "          api() { curl -sS --max-time 20 -o \"$out\" -w '%{http_code}' \"${auth[@]}\" \\",
  "                    -H 'Accept: application/vnd.github+json' \"$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/$1\"; }",
  "          why() { if [ \"$2\" = 28 ]; then echo 超时; elif [ \"$1\" = 000 ]; then echo 连不上; else echo \"HTTP $1\"; fi; }",
  "          cpu=$(export LC_ALL=C; lscpu 2>/dev/null | sed -n 's/^[[:space:]]*Model name://p' | head -n 1 \\",
  "                  | tr -cd '[:alnum:] ()@.,_+/-' | tr -s ' ' | cut -c 1-80 | sed 's/^ //; s/ $//')",
  "          [ -n \"$cpu\" ] || cpu=读不到",
  "          count() { git show \"$1:scripts/check/mutations.json\" 2>/dev/null | jq -er '.mutations | arrays | length' 2>/dev/null; }",
  "          muts=$(count HEAD); muts0=; mine=; base=$BASE_SHA",
  "          [ \"$GITHUB_EVENT_NAME\" = pull_request ] && base=$(git rev-parse -q --verify 'HEAD^1' 2>/dev/null)",
  "          [[ $base =~ ^[0-9a-f]{40}$ ]] && muts0=$(count \"$base\")",
  "          work() {",
  "            [ -n \"$muts\" ] || { echo \"变异：读不到\"; return; }",
  "            local d=对照读不到 per=摊到每条：读不到",
  "            [ -n \"$muts0\" ] && d=$(( muts - muts0 )) && { [ \"$d\" = 0 ] && d=±0 || d=$(printf '%+d' \"$d\"); }",
  "            [ -n \"$mine\" ] && [ \"$muts\" -gt 0 ] && per=\"摊到每条 $(awk -v a=\"$mine\" -v b=\"$muts\" 'BEGIN { printf \"%.2f\", a / b }') 秒\"",
  "            echo \"变异 $muts 条（$d） · $per\"",
  "          }",
  "          say() { local line=\"$1 · CPU：$cpu · $(work)\"",
  "                  echo \"::notice title=墙钟::$line\"; echo \"$line\" >> \"$GITHUB_STEP_SUMMARY\"; exit 0; }",
  "          mmss() { printf '%d:%02d' $(( $1 / 60 )) $(( $1 % 60 )); }",
  "          code=$(api \"actions/runs/$GITHUB_RUN_ID\"); rc=$?",
  "          [ \"$code\" = 200 ] || say \"墙钟：无从比较（取本跑的起跑时间：$(why \"$code\" \"$rc\")）\"",
  "          created=$(jq -er .created_at \"$out\") && started=$(jq -er '.run_started_at | fromdate' \"$out\") \\",
  "            || say \"墙钟：无从比较（本跑的记录里没有创建或起跑时间）\"",
  "          mine=$(( $(date -u +%s) - started ))",
  "          code=$(api \"actions/workflows/check.yml/runs?branch=main&event=push&status=success&per_page=5&created=%3C$created\"); rc=$?",
  "          [ \"$code\" = 200 ] || say \"墙钟：无从比较（取主干前 5 次：$(why \"$code\" \"$rc\")）\"",
  "          n=$(jq -er '.workflow_runs | length' \"$out\") || say \"墙钟：无从比较（主干的运行记录读不出来）\"",
  "          [ \"$n\" = 5 ] || say \"墙钟：无从比较（本跑之前主干上只找到 $n 次成功跑）\"",
  "          median=$(jq -er '[.workflow_runs[] | (.updated_at | fromdate) - (.run_started_at | fromdate)] | sort | .[2]' \"$out\") \\",
  "            || say \"墙钟：无从比较（主干的运行记录里缺起跑或结束时间）\"",
  "          [ \"$median\" -gt 0 ] || say \"墙钟：无从比较（主干前 5 次的中位是 $median 秒）\"",
  "          say \"本跑 $(mmss \"$mine\") · 主干前 5 次中位 $(mmss \"$median\") · ×$(awk -v a=\"$mine\" -v b=\"$median\" 'BEGIN { printf \"%.2f\", a / b }')\"",
  "      - run: lscpu",
  "        if: always()",
  "        continue-on-error: true",
]

/** 按眼下的份数、worker 数与 chain 那一串填好的 `WORKFLOW_PIN` */
export function pinnedWorkflow(chain: string): string[] {
  const list = Array.from({ length: SHARD_COUNT }, (_unused, i) => i + 1).join(', ')
  return WORKFLOW_PIN.map(l => l.replaceAll('«N»', String(SHARD_COUNT)).replaceAll('«LIST»', list)
    .replaceAll('«JOBS»', String(CI_MUTATE_JOBS)).replaceAll('«CHAIN»', () => chain))
}

/**
 * `check.yml` 的接线对不对得上（ADR-203 第八节；需求所有者在选择卡上选的「整份钉死」）：整份去掉整行注释与空行后，逐行与 `pinnedWorkflow` 相同。
 * **不从文字猜 YAML 的结构。** 先前两版都是找几行关键的字、再猜它们落在哪个 job、哪一步，评审一轮轮找到合法的 YAML 写法
 * （引号括起来的键、接到下一行的命令、块里的假记号、流式写法……）让它猜错、悄悄放行。逐字相同就没有可猜的：
 * 工作流里任何一处起作用的改动都红，改的人在同一条 PR 里改钉死的那份，评审看得见。最坏是误红。
 * 整行注释（空格缩进之后以 `#` 起头的行）与空行（空的或全是空格）不比：这种行不改变 YAML 解析出的结构（缩进不够时让整份解析失败，
 * GitHub 上看得见），落在 `run:` 块里是 shell 注释；行内注释、行尾空白照样比。
 * 空格、tab 与换行以外的空白（单独的 `\r`、U+0085、U+2028、全角空格……）出现在哪里都红；注释或空行接在行尾 `\` 后面也红。
 * `checkScript` 是 `package.json` 的 `check` 那一串，读不到（undefined）、或不是 `CHECK_SHAPE` 那种「npm run 某步 && …」也算对不上 ——
 * 它原样填进 chain 那一行，里面要是有 `#`、`\`、`$` 之类，YAML 与 shell 读出来的就不是字面那一串。对得上交回 []。
 */
/** `package.json` 的 `check` 那一串只许这个样子：几步 `npm test`／`npm run 某名字` 用 ` && ` 连起来 */
const CHECK_SHAPE = /^npm (test|run [a-z][\w:-]*)( && npm (test|run [a-z][\w:-]*))*$/

export function workflowWiringFaults(workflow: string, checkScript: string | undefined): string[] {
  if (checkScript === undefined) return ['读不到 package.json 的 check 那一串']
  if (!CHECK_SHAPE.test(checkScript)) return ['package.json 的 check 那一串不是「npm run 某步 && npm run 某步 …」的样子，不拿它填 chain 那一行']
  const want = pinnedWorkflow(checkScript.split(' && ').filter(step => step !== 'npm run mutate' && step !== 'npm run launches').join(' && '))
  return pinnedLinesFaults(workflow, want, ' —— 改了工作流就在同一条 PR 里改 shard-load-rule.ts 的 WORKFLOW_PIN')
}

/**
 * 一份工作流与钉死的样子逐行比，比法见上面 `workflowWiringFaults` 的说明（去掉整行注释与空行，别的逐字比，怪空白一律红）。
 * `hint` 接在「与钉死的样子不一样」那句后面，告诉改的人去改哪一份钉死的样子。对得上交回 []。
 * 另一份工作流（`size-base.yml`，ADR-235）也用它钉：不从文字猜 YAML 的结构，同一个理由
 */
export function pinnedLinesFaults(workflow: string, want: readonly string[], hint: string): string[] {
  // 换行只认 \n 与 \r\n，空白只认空格与 tab：单独的 \r、U+0085、U+2028、全角空格、不换行空格……YAML 或 shell 会当真，
  // 去注释、去空行时却可能被当成空白或换行吃掉，一律红（最坏是误红）
  const text = workflow.replace(/\r\n/g, '\n'), odd = /[^\S \t\n]|\u0085/.exec(text)
  if (odd !== null) {
    const n = text.slice(0, odd.index).split('\n').length, code = odd[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
    return [`第 ${n} 行有空格、tab 与换行以外的空白（U+${code}），去掉它再比`]
  }
  // 只有以空格缩进、# 起头的行算整行注释，只有空的或全是空格的行算空行；接在行尾「\」后面的不算 —— 那里一行注释或空行会改掉 shell 命令
  const raw = text.split('\n'), got: { n: number; text: string }[] = []
  for (let i = 0; i < raw.length; i++) {
    if (!/^ *(#|$)/.test(raw[i])) { got.push({ n: i + 1, text: raw[i] }); continue }
    if (i > 0 && got.at(-1)?.n === i && raw[i - 1].endsWith('\\')) return [`第 ${i + 1} 行是注释或空行，却接在上一行行尾的「\\」后面（shell 会把它连进命令）`]
  }
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (got[i]?.text === want[i]) continue
    const at = got[i] === undefined ? '文件已经到头' : `第 ${got[i].n} 行是「${got[i].text.trim()}」`
    return [`与钉死的样子不一样（去掉整行注释与空行后逐行比）：${at}，应为${want[i] === undefined ? '没有这一行' : `「${want[i].trim()}」`}`
      + hint]
  }
  return []
}

/** 闸门要的量。`trunk` 同启动数闸门：在不在主干上，或者问不出来 */
export interface ShardLoadInput {
  /**
   * 秒数取自哪里：主干上的哪一跑（`mainCostWeights` 认出来的）；取不到、为什么；或者本地根本没拿到那份数（`MAIN_COSTS_ENV` 没设）。
   * 不是取自某一跑时 `loads` 与 `base` 不看
   */
  readonly measured: { readonly run: number; readonly headSha: string } | { readonly unavailable: string } | { readonly local: true }
  /** 每一份的验证者秒数（`shardPlan` 交回的 `loads`），按份的编号排 */
  readonly loads: readonly number[]
  /** PR 基线（主干上是上一版）那份清单按同一份秒数算出的总秒数；读不出来时说为什么 */
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
 * PR 上越了线（「一次涨一大截」有理由豁免的除外）、PR 基线读不出来、取不到主干上一跑的实测。
 * 本地没拿到实测时只核接线，三道线不判、不红（CI 上判）。
 */
export function shardLoadGate(input: ShardLoadInput): ShardLoadGate {
  const { measured, loads, base, trunk, waivers, wiring } = input
  const lines: string[] = []
  let fault = false
  if ('unknown' in trunk) { lines.push(`✗ 变异负载：问不出这棵树在不在主干上（${trunk.unknown}），三道线都没法判`); return { red: true, lines } }
  if (wiring.length > 0) {
    fault = true
    lines.push(`✗ 变异负载：check.yml 的接线对不上（份数按 ${SHARD_COUNT}、派 ${CI_MUTATE_JOBS} 个 worker）—— ${wiring.join('；')}`)
  }
  const onTrunk = trunk.onTrunk
  if ('local' in measured) {
    lines.push(`变异负载：本地没有主干上一跑的实测（没设 ${MAIN_COSTS_ENV}），三道线只在 CI 上判；这里只核了接线`)
    return { red: fault, lines }
  }
  if ('unavailable' in measured) {
    if (onTrunk) lines.push(`变异负载：取不到主干上一跑的实测（${measured.unavailable}），三道线没法判 —— 主干上只报数`)
    else lines.push(`✗ 变异负载：取不到主干上一跑的实测（${measured.unavailable}），三道线没法判，不当成没越线 —— 重跑这一跑的全部 job（只重跑失败的，取数那一步不重跑）；还取不到就看「取主干上一跑的变异实测」那个 job`)
    return { red: fault || !onTrunk, lines }
  }
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
  lines.push(`变异负载（验证者秒数，按主干 run ${measured.run}、提交 ${measured.headSha.slice(0, 7)} 的实测）：`
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
