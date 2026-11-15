/**
 * 变异负载闸门（ADR-203）—— 新增的变异不让 CI 悄悄变慢。纯判定：不起进程、不读文件，量由入口数好交进来。
 *
 * CI 上变异一步分成三份并行跑（ADR-197、ADR-200），整跑要等最重的那一份。会让它变慢的有三种涨法，各守一道：
 * - **三份不均**：同一种配置的变异必须在同一份里（那种配置的基线只跑一次），某种配置越长越大，那一份就越拖越慢；
 * - **一次涨一大截**：一个 PR 加了一大批变异；
 * - **一次涨一点、涨了很多次**：每次都不显眼，十月和十一月那两轮变慢都是这么涨上去的 ——
 *   跟上一次比永远「差不多」，所以第三道不跟谁比，看的是最重的那一份离上限还有多远。
 *
 * **量用估重，不用秒数**：一条变异的秒数随机器与并发变（同一份代码在不同 runner 上差到 ×1.6），
 * 拿它判红，同一个提交重跑一次就可能换个结论。估重只看清单本身，同一棵树永远算出同一个数。
 * 自检变异一条算 6、需求测试变异一条算 1：主干五跑实测，自检一条约 10.2 秒、需求测试一条约 1.6 秒（ADR-203 第二节）。
 * 分份也按同一个估重分（`jobs-rule.ts` 的 `shardPlan`），闸门量的就是变异一步实际的分法。
 *
 * 三道线与有没有豁免是需求所有者 2026-11-15 在选择卡上定的（ADR-203 第三节）：PR 上越线就红；主干上只报数 ——
 * CI 跑在推送之后，主干上判红只会让主干变红（同体量闸门、启动数闸门的理由）。只有「一次涨一大截」那一道
 * 可以用提交信息末段的 `mutation-growth-ok: <理由>` 豁免；另两道不设豁免，越线的改法写在各自那一行里。
 * 读不到就红：主干上算不出、PR 基线的清单读不出来，都不当成「没涨」。
 */

/** CI 上变异一步分几份。与 `.github/workflows/check.yml` 的三处对得上由 `shardWiringFaults` 核 */
export const SHARD_COUNT = 3

/** 一条变异的估重，按验证者。没写 `by` 的是需求测试（同 `mutate-rule.ts` 的 `executionRoutes`） */
export const MUTATION_WEIGHT: Readonly<Record<string, number>> = { test: 1, selfcheck: 6 }

/** 最重一份比平均值高多少就红 */
export const BALANCE_LIMIT = 0.25
/** 一次 PR 让估重总量比 PR 基线涨多少就红 */
export const GROWTH_LIMIT = 0.05
/** 一个估重单位在 CI 上大约要几秒（墙钟，含并发；主干五跑的变异一步按份摊出来约 0.30–0.32，取宽一点） */
export const SECONDS_PER_UNIT = 0.35
/** 最重一份预计超过几分钟就红 */
export const CEILING_MINUTES = 14
/** 上面那条线折成估重：14 × 60 ÷ 0.35 = 2400 */
export const CEILING_UNITS = Math.round(CEILING_MINUTES * 60 / SECONDS_PER_UNIT)

/** 「一次涨一大截」那一道的豁免写在提交信息末段的 trailer 里，键是这个 */
export const GROWTH_WAIVER_KEY = 'mutation-growth-ok'

/** 一条变异的估重。认不得的验证者抛错 —— 猜一个数等于让闸门量一个编出来的量 */
export function mutationWeight(by: string | undefined): number {
  const name = by === undefined ? 'test' : by
  if (!Object.hasOwn(MUTATION_WEIGHT, name)) throw new Error(`认不得的验证者「${name}」，不知道它一条算多少`)
  return MUTATION_WEIGHT[name]
}

/**
 * 提交信息末段（只认 trailer 块，见 `trailer.ts`）里的 `mutation-growth-ok:` 各行：写了理由的交回理由，
 * 只写了键没写理由的数进 `empty` —— 那一行不算豁免，入口在 PR 上判红，免得「写了个空豁免」被当成写了。
 */
export function growthWaivers(trailers: readonly string[]): { reasons: string[]; empty: number } {
  const reasons: string[] = []
  let empty = 0
  for (const line of trailers) {
    const m = /^([\w.-]+):(.*)$/.exec(line.trim())
    if (m === null || m[1] !== GROWTH_WAIVER_KEY) continue
    const reason = m[2].trim()
    if (reason === '') empty++
    else reasons.push(reason)
  }
  return { reasons, empty }
}

/**
 * `check.yml` 里写死份数的三处与 `SHARD_COUNT` 对不对得上（ADR-197 第 121 行那张接线欠条的「份数」那一半）：
 * matrix 列的是 1..n、`MUTATE_SHARD` 写的是 `/n`、上传的分份启动数文件名是 `-of-n.json`。
 * 对不上时交回每一处说的是什么；改份数要三处与这个常量一起改。
 */
export function shardWiringFaults(workflow: string, count: number): string[] {
  const faults: string[] = []
  const list = Array.from({ length: count }, (_unused, i) => i + 1).join(', ')
  if (!workflow.includes(`shard: [${list}]`)) faults.push(`matrix 不是「shard: [${list}]」`)
  if (!workflow.includes(`MUTATE_SHARD: \${{ matrix.shard }}/${count}`)) faults.push(`MUTATE_SHARD 不是「\${{ matrix.shard }}/${count}」`)
  if (!workflow.includes(`launches-\${{ matrix.shard }}-of-${count}.json`)) faults.push(`分份启动数文件名不是「launches-\${{ matrix.shard }}-of-${count}.json」`)
  return faults
}

/** CI 上每一份变异派几个 worker（ADR-200：4 核的 runner 上派 6 个）。与 `check.yml` 对得上由 `chainWiringFaults` 核 */
export const CI_MUTATE_JOBS = 6

/**
 * `check.yml` 里另外两处接线（ADR-200 第 92 行那张欠条的两半）：
 * - `chain` 那个 job 跑的那一串，必须恰是 `package.json` 的 `check` 去掉变异与启动数两步 —— 本地那一串加了一步、CI 上忘了加，
 *   CI 就少查一样还照样绿；
 * - 变异那几份写着 `MUTATE_JOBS: '6'` —— 删掉它，每份照核数只派 4 个，变异一步慢约一成半，没有东西会红。
 * `checkScript` 读不到（undefined）也算一处对不上。对得上交回 []。
 */
export function chainWiringFaults(workflow: string, checkScript: string | undefined): string[] {
  const faults: string[] = []
  if (checkScript === undefined) faults.push('读不到 package.json 的 check 那一串')
  else {
    const chain = checkScript.replace(' && npm run mutate', '').replace(' && npm run launches', '')
    if (!workflow.split('\n').some(line => line.trim() === `- run: ${chain}`)) faults.push(`chain 那一串不是 package.json 的 check 去掉 mutate 与 launches 两步（应为「${chain}」）`)
  }
  if (!workflow.includes(`MUTATE_JOBS: '${CI_MUTATE_JOBS}'`)) faults.push(`变异那几份没写「MUTATE_JOBS: '${CI_MUTATE_JOBS}'」`)
  return faults
}

/** 闸门要的量。`trunk` 同启动数闸门：在不在主干上，或者问不出来 */
export interface ShardLoadInput {
  /** 每一份的估重，按份的编号排（`shardPlan` 交回的 `loads`） */
  readonly loads: readonly number[]
  /** PR 基线（主干上是上一版）那份清单的估重总量；读不出来时说为什么 */
  readonly base: { readonly total: number } | { readonly unknown: string }
  readonly trunk: { readonly onTrunk: boolean } | { readonly unknown: string }
  /** 这条分支自己的提交里 `growthWaivers` 读出来的 */
  readonly waivers: { readonly reasons: readonly string[]; readonly empty: number }
  /** `shardWiringFaults` 与 `chainWiringFaults` 交回的，合在一起 */
  readonly wiring: readonly string[]
}
export interface ShardLoadGate { readonly red: boolean; readonly lines: readonly string[] }

const pct = (x: number): string => `${Math.round(x * 100)}%`
const minutes = (units: number): string => (units * SECONDS_PER_UNIT / 60).toFixed(1)
const signed = (n: number): string => (n > 0 ? `+${n}` : n === 0 ? '±0' : `${n}`)

/**
 * 判三道线。先打一行报数（每份估重、最重一份比平均高多少、预计几分钟、总量比基线涨了多少），再每越一道线打一行 ✗。
 * 红：问不出在不在主干上、份数接线对不上（两样主干上也红：它们是数据错，不是越线）；
 * PR 上越了线（「一次涨一大截」有理由豁免的除外）、PR 基线读不出来、写了空豁免。
 */
export function shardLoadGate(input: ShardLoadInput): ShardLoadGate {
  const { loads, base, trunk, waivers, wiring } = input
  const lines: string[] = []
  let fault = false
  if ('unknown' in trunk) { lines.push(`✗ 变异负载：问不出这棵树在不在主干上（${trunk.unknown}），三道线都没法判`); return { red: true, lines } }
  if (wiring.length > 0) { fault = true; lines.push(`✗ 变异负载：check.yml 的接线对不上（份数按 ${SHARD_COUNT}、派 ${CI_MUTATE_JOBS} 个 worker）—— ${wiring.join('；')}`) }
  const onTrunk = trunk.onTrunk
  const total = loads.reduce((a, b) => a + b, 0)
  const heaviest = Math.max(0, ...loads)
  const mean = loads.length === 0 ? 0 : total / loads.length
  const over = mean === 0 ? 0 : heaviest / mean - 1
  const vs = onTrunk ? '上一版' : 'PR 基线'
  let growth: number | undefined
  let delta = ''
  if ('total' in base) {
    const d = total - base.total
    growth = base.total === 0 ? (d > 0 ? Infinity : 0) : d / base.total
    delta = `比${vs} ${signed(d)}（${base.total === 0 ? '基线为 0' : `${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(1)}%`}，线 ${pct(GROWTH_LIMIT)}）`
  } else delta = `比${vs}：读不出来（${base.unknown}）`
  lines.push(`变异负载（估重：自检一条算 ${MUTATION_WEIGHT.selfcheck}、需求测试一条算 ${MUTATION_WEIGHT.test}）：`
    + `${loads.length} 份 ${loads.join(' / ')}，最重一份比平均高 ${pct(over)}（线 ${pct(BALANCE_LIMIT)}），`
    + `预计约 ${minutes(heaviest)} 分钟（线 ${CEILING_MINUTES} 分钟）；总量 ${total}，${delta}`
    + (onTrunk ? ' —— 主干上只报数' : ''))
  const findings: string[] = []
  if (over > BALANCE_LIMIT) findings.push(`✗ 三份不均：最重一份 ${heaviest}，比平均 ${Math.round(mean)} 高 ${pct(over)}，过了 ${pct(BALANCE_LIMIT)} 那条线 —— `
    + '多半是某一种配置的变异太多、一摞压在一份里；把那组用例拆成两组、或删掉重复的变异。不设豁免')
  if (heaviest > CEILING_UNITS) findings.push(`✗ 最重一份太重：估重 ${heaviest}，预计约 ${minutes(heaviest)} 分钟，过了 ${CEILING_MINUTES} 分钟（估重 ${CEILING_UNITS}）那条线 —— `
    + '变异总量涨到头了：删掉重复的变异，或由需求所有者决定加一台 runner（改份数）。不设豁免')
  if (growth !== undefined && growth > GROWTH_LIMIT) {
    const line = `一次涨太多：这次让估重总量涨了 ${Number.isFinite(growth) ? `${(growth * 100).toFixed(1)}%` : '（基线为 0）'}，过了 ${pct(GROWTH_LIMIT)} 那条线`
    if (waivers.reasons.length > 0) lines.push(`  已豁免：${line}（${GROWTH_WAIVER_KEY}：${waivers.reasons.join('；')}）`)
    else findings.push(`✗ ${line} —— 拆成几个 PR，或在提交信息末段写「${GROWTH_WAIVER_KEY}: <理由>」`)
  }
  if (!onTrunk && !('total' in base)) { fault = true; lines.push('✗ 变异负载：PR 基线那份变异清单读不出来，一次涨了多少没法判，不当成没涨') }
  if (!onTrunk && waivers.empty > 0) { fault = true; lines.push(`✗ 变异负载：${waivers.empty} 行「${GROWTH_WAIVER_KEY}:」没写理由，不算豁免`) }
  lines.push(...findings)
  return { red: fault || (!onTrunk && findings.length > 0), lines }
}
