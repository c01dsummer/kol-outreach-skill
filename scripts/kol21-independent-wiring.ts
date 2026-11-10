#!/usr/bin/env tsx
/**
 * KOL-21 独立测试包的接线：把冻结在 `scripts/kol21-independent/` 的测试套件接到真实入口与观察器的公开调用面上，
 * 跑一遍，把冻结套件自己写的报告原样落盘（ADR-183 第 95 行 T 那一片）。
 *
 *   tsx scripts/kol21-independent-wiring.ts --work <已存在的空目录> --report <报告文件> [--only <用例号,…>]
 *
 * 冻结目录一个字节都不改（嵌入提交按 freeze-tests.sha256 核等）。这里只做冻结包 `INTEGRATION.md` 写明留给整合方的几样：
 *
 * - `facility`：观察器的公开调用面，`observer-run.ts` 的 `certifyIsolation`、`runObserved` 与 `observer-rule.ts` 的
 *   `zeroVerdict`、`readEvents`（ADR-70 末尾那一节，`Zero` 是修复轮 1 修订后带 side/cause 的那一版）。`readEvents` 交回的
 *   事件逐条浅拷贝一份，只为过类型（接口类型的事件不能直接当 `Record` 用），字段一个不增不减；其余原样传入。
 * - `sortForOutput`：`scripts/lib/rows.ts` 的导出函数，同一个数组原样传进去（G5-03 要看调用后输入有没有被改）。
 * - `conditions`：每条 `ref` 写着出处。登的是冻结单 B 节把「建议问谁」写成整合方、整合方又答得出出处的（冻结单 :1586、:1592）：
 *   GAP-18（补法是下面的 `creatorCheck`）；GAP-24a、GAP-24b 是读实现得出的事实，只作资格前提（夹具有没有区分力），
 *   不当任何断言的期望。GAP-24c 要正本或对外文档直接给出「原文件不被改动」，没找到，不登；GAP-09、GAP-20 登了也不判，不登。
 *   再加 E-2、E-3：实现方把契约 kol-test-observer/v1 公开在 `skill/references/output-format.md` 末节，需求方逐字确认过
 *   （冻结单 :1797），`ref` 指那一节与 ADR-186、ADR-187。其余（GAP-07①④、GAP-10、GAP-39、GAP-40 与 E-1）不登。
 *   没登的，依赖它的断言照冻结单落在 not-judged。
 * - `reviews`：一条复核都不给。语义复核要独立复核方对着本跑的文本写（GAP-25 也只是复核记录的键，不是前提登记），
 *   依赖它的断言落在 review-pending。not-judged、review-pending 都不算过、也不算红。
 * - `creatorCheck`：只照公开的 `Creator` 类型声明核 G5、G6 的夹具记录是不是合法 `Creator`（冻结单 :1586 的「公开的夹具资格检查」）。
 * - `e2`、`e3`：都从观察器每一跑交给入口的测试观察记录文件读（证据目录里的 `CONTRACT_RECORDS`；`observer-run.ts` 起入口时经
 *   `KOL_TEST_OBSERVER_EVENTS` 给），由 `observer-rule.ts` 的 `readContractRecords` 照原文逐行核。`e2.arm` 在当前目录写控制文件，
 *   选〈保存点，第 k 次〉；`e2.hits` 交回命中与未命中记录：命中记录去掉 `kind`、`contract`，`not_written` 改叫 `notWritten`；
 *   未命中记录只交保存点、次数与入口，标上 `miss`、`notWritten` 记 false（冻结类型里没有 `seen`、`why` 的位置）。
 *   `e3` 走记录文件那一路（`channel: 'events'`，不剥 stderr）：就绪看那一条就绪记录，预留事件是预留记录去掉 `kind`、`contract`。
 *   G1-02D 只认 stderr 那一路，照冻结套件落在 not-judged。记录文件不在、或哪一处不合契约，整份当没有记录 —— 命中记录交空、
 *   就绪交 false，冻结套件照它的规则判夹具失格；不合在哪写进 stdout 汇总的 `records`，不挑能读的那几行用。
 *   控制文件名与它的 `schema` 照原文抄在这里，不从产品代码 import：被测的正是产品照不照原文做。
 *
 * 判定一律在冻结套件里：这里不读、不改、不合并任何一条结论。冻结套件的每一种结论原样留在报告里，由读报告的一侧
 * （自检组 `kol21-independent`）分开报。
 * 退出码：报告写成就是 0，不论里面的结论是什么；用法错 2；跑到一半抛出 1。
 *
 * 它不是 `scripts/check/` 下的工具，自检把它当被测对象起（`verifier-rule.ts`「它挡不住什么」第一条说的正是这种写法：
 * 从 `scripts/check/` 外面起的东西，自己验自己的判据按被测对象放行）。不放进自检的工具表，是因为那张表是验证基础设施闭包的
 * 种子：本文件 import 的 `scripts/lib/rows.ts` 及其依赖会跟着进闭包，现有指着它们的 `by: "selfcheck"` 负片会被当成自己验自己拦下。
 * 所以指着本文件或冻结目录的变异不该写 `by: "selfcheck"` —— 那是拿被改坏的验证接线给自己判分，判据拦不住，靠写的人不写。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { CASES, runSuite } from './kol21-independent/suite.ts'
import type {
  ConditionId, E2Adapter, E2HitRecord, E3Adapter, ObservedRun, ObserverFacility, Resolution, SavePoint, SortForOutput,
} from './kol21-independent/lib/contract.ts'
import { certifyIsolation, facilityFiles, runObserved } from './check/observer-run.js'
import { CONTRACT_RECORDS, readContractRecords, readEvents, zeroVerdict, type ContractRecord } from './check/observer-rule.js'
import { sortForOutput } from './lib/rows.js'
import type { AdoptionPriority, Creator, Dimension, Eligibility, Fit, Platform, RecentPost, ReviewStatus, Tier } from './lib/types.js'

const USAGE = '用法: tsx scripts/kol21-independent-wiring.ts --work <已存在的空目录> --report <报告文件> [--only <用例号,…>]'
const args = process.argv.slice(2)
const flags = new Map<string, string>()
for (let i = 0; i < args.length; i += 2) {
  const [k, v] = [args[i], args[i + 1]]
  if (!['--work', '--report', '--only'].includes(k) || v === undefined || v.startsWith('--') || flags.has(k)) {
    console.error(USAGE); process.exit(2)
  }
  flags.set(k, v)
}
const work = flags.get('--work'), report = flags.get('--report')
if (work === undefined || report === undefined || !isAbsolute(work) || !isAbsolute(report)) { console.error(USAGE); process.exit(2) }
if (!existsSync(work) || readdirSync(work).length > 0) { console.error(`--work ${work} 不是已存在的空目录`); process.exit(2) }
// 点了冻结单里没有的用例号就停：冻结套件按 `only` 过滤，点错的那个只会静默少跑一例
const only = flags.get('--only')?.split(',')
const unknown = only?.filter(id => !CASES.some(c => c.id === id)) ?? []
if (only !== undefined && (only.length === 0 || unknown.length)) { console.error(`--only 里有冻结单没有的用例号：${unknown.join('、') || '（空）'}`); process.exit(2) }

const facility: ObserverFacility = {
  certifyIsolation,
  runObserved,
  zeroVerdict,
  readEvents: text => { const r = readEvents(text); return { events: r.events.map(e => ({ ...e })), problems: r.problems } },
}
// 冻结包里没有 Creator 的完整声明（GAP-18），G5 按导出签名把冻结单的候选原文当参数传进来；这里只在类型上认作
// `Creator[]`，运行时就是那个数组本身。G5 先过 GAP-18 的登记与下面的 `creatorCheck`（冻结单 G5 各例的闸门）才调它。
//
// U9×P1 的独立认领（R 片，ADR-183 第 96 行；记录在 ADR-92 末尾）用的就是从这里接进去的 G5 排序函数层与 G6 名单层（真实
// render 入口）那六例：需求测试 `u9-p1-independent-claim` 起本文件、用 `--only` 只点这六例，六例都判 pass、每一项也都是 pass
// 才认领。只用冻结了的用例，不改断言、不改冻结字节；交点的认领只写在需求测试里（自检的入口认领记录不收交点）。
const sort: SortForOutput = creators => sortForOutput(creators as Creator[])

// 公开的夹具资格检查（GAP-18）：只照 `scripts/lib/types.ts` @251d2d6 的类型声明 —— `Creator` 在 :270-408，它用到的
// `Platform`、`Dimension`、`Tier`、`Fit`、`ReviewStatus`、`Eligibility`、`AdoptionPriority`、`RecentPost` 在 :8-9、:72-80、:112-123 ——
// 核一条记录是不是合法 `Creator`。只读声明，不读任何函数体，也不看排序怎么写。报三种问题：声明里没有的键（冻结单 :1424
// 第 (2) 件：层级、分数若不叫 `tier`、`score`）、缺的必填字段（第 (1) 件）、值的类型不符；声明是这里没展开的类型的字段
// （G5、G6 的夹具都不带）在场也报「判不了」，不放过。下面两张表的键、必填与否、每个键能写的类型都由 typecheck 对着声明核：
// 声明一改，这里先编译不过，不会悄悄跟丢。
interface Kinds {
  str: string; num: number; bool: boolean; 'str|null': string | null; 'str[]': string[]; 'num[]': number[]; geo: Record<string, number>
  platform: Platform; dimension: Dimension; tier: Tier; fit: Fit; review: ReviewStatus; eligibility: Eligibility; priority: AdoptionPriority
  posts: RecentPost[]
}
type KindOf<V> = { [k in keyof Kinds]: [Kinds[k]] extends [V] ? [V] extends [Kinds[k]] ? k : never : never }[keyof Kinds]
type Must<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]
type Table<T> = { [K in keyof T]-?: K extends Must<T> ? KindOf<T[K]> : `${KindOf<Exclude<T[K], undefined>> | 'opaque'}?` }
const CREATOR: Table<Creator> = {
  platform: 'platform', handle: 'str', user_id: 'str?', nickname: 'str', followers: 'num?', following: 'num?', post_count: 'num?',
  bio: 'str|null?', bio_links: 'str[]', verified: 'bool', is_private: 'bool?', avatar: 'str?', profile_url: 'str',
  source_keyword: 'str', source_dimension: 'dimension', source_tasks: 'num[]?', discovery_sources: 'opaque?', recent_posts: 'posts?',
  email: 'str|null?', email_verified: 'bool?', audience_geo: 'geo?', fake_follower_score: 'num?',
  cross_platform: 'bool?', linked_handle: 'str?', merged_into: 'str?',
  score: 'num?', fit: 'fit?', fit_reason: 'str?', tier: 'tier?', outreach_draft: 'str?', eligibility: 'eligibility?',
  adoption_priority: 'priority?', observed_content: 'str?', work_evidence: 'str?', natural_integration: 'str?', mismatch_risk: 'str?',
  brand_calibration_version: 'str?', review_status: 'review?', linked_agent_review: 'opaque?',
  manual_eligible: 'opaque?', manual_adopted: 'opaque?', manual_content_fit: 'opaque?', manual_engagement: 'opaque?',
  manual_comment_authenticity: 'opaque?', manual_reject_reason: 'str?', manual_note: 'str?', manual_reviewed: 'bool?',
  manual_round_id: 'str?', manual_feedback_accounts: 'opaque?', effective_priority: 'priority?', effective_priority_account_key: 'str?',
  account_assessment: 'opaque?', linked_account_assessment: 'opaque?', tier_adjustments: 'opaque?', previously_recommended: 'str?',
}
const POST: Table<RecentPost> = {
  id: 'str?', desc: 'str', plays: 'num?', likes: 'num?', comments: 'num?', shares: 'num?', published_at: 'str?', is_pinned: 'bool?',
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const among = <T extends string>(set: Record<T, true>) => (v: unknown) => typeof v === 'string' && Object.hasOwn(set, v)
const IS: { [k in keyof Kinds]: (v: unknown) => boolean } = {
  str: v => typeof v === 'string', num: v => typeof v === 'number', bool: v => typeof v === 'boolean',
  'str|null': v => v === null || typeof v === 'string',
  'str[]': v => Array.isArray(v) && v.every(x => typeof x === 'string'),
  'num[]': v => Array.isArray(v) && v.every(x => typeof x === 'number'),
  geo: v => isObj(v) && Object.values(v).every(x => typeof x === 'number'),
  platform: among<Platform>({ tiktok: true, instagram: true }),
  dimension: among<Dimension>({ category: true, scene: true, competitor: true, audience: true }),
  tier: among<Tier>({ A: true, B: true, C: true }),
  fit: among<Fit>({ '✅': true, '⚠️': true, '❌': true }),
  review: among<ReviewStatus>({ 未评: true, 已评: true, 待重评: true }),
  eligibility: among<Eligibility>({ 合格: true, 不合格: true, 待核实: true }),
  priority: among<AdoptionPriority>({ 优先联系: true, 备选: true, 待核实: true, 暂不采用: true }),
  posts: v => Array.isArray(v), // 元素另照 POST 表逐条核
}
function shape(table: Record<string, string>, v: unknown, at: string): string[] {
  if (!isObj(v)) return [`${at} 不是对象`]
  const probs = Object.keys(v).filter(k => !Object.hasOwn(table, k)).map(k => `${at}.${k} 不是声明里的字段`)
  for (const [k, spec] of Object.entries(table)) {
    const kind = spec.replace(/\?$/, '')
    if (!Object.hasOwn(v, k)) { if (kind === spec) probs.push(`${at} 缺必填字段 ${k}`); continue }
    if (kind === 'opaque') probs.push(`${at}.${k}：声明里的类型这里没展开，判不了合不合法`)
    else if (!IS[kind as keyof Kinds](v[k])) probs.push(`${at}.${k} = ${JSON.stringify(v[k])} 不是声明的类型（${kind}）`)
    else if (kind === 'posts') (v[k] as unknown[]).forEach((p, i) => probs.push(...shape(POST, p, `${at}.${k}[${i}]`)))
  }
  return probs
}
const creatorCheck = (c: unknown): string[] => shape(CREATOR, c, isObj(c) && typeof c.handle === 'string' ? c.handle : '（没有 handle 的记录）')

// 测试观察记录（契约 kol-test-observer/v1，`skill/references/output-format.md` 末节）。同一跑的记录只读、只核一次
const records = new Map<string, ContractRecord[] | undefined>()
const recordProblems: { evidenceDir: string; problems: string[] }[] = []
function recordsOf(run: ObservedRun): ContractRecord[] | undefined {
  if (records.has(run.evidenceDir)) return records.get(run.evidenceDir)
  const file = join(run.evidenceDir, CONTRACT_RECORDS)
  const got = existsSync(file) ? readContractRecords(readFileSync(file, 'utf8'), run.entry) : { records: [], problems: ['记录文件不在'] }
  if (got.problems.length) recordProblems.push({ evidenceDir: run.evidenceDir, problems: got.problems })
  records.set(run.evidenceDir, got.problems.length ? undefined : got.records)
  return records.get(run.evidenceDir)
}
// 原文第二节的控制文件：放在入口的当前目录，collect 启动时读一次
const SAVE_FAULT_FILE = '.kol-save-fault.json', SAVE_FAULT_SCHEMA = 'kol-save-fault/v1'
const e2: E2Adapter = {
  arm: (point, k) => ({ files: { [SAVE_FAULT_FILE]: `${JSON.stringify({ schema: SAVE_FAULT_SCHEMA, point, occurrence: k })}\n` } }),
  // 记录已照原文核过：命中记录的保存点在五个里；未命中记录文件不合格时保存点、次数是 null，冻结类型写不出 null，只在类型上照认
  hits: run => (recordsOf(run) ?? []).flatMap((r): E2HitRecord[] =>
    r.kind === 'save-fault' ? [{ point: r.point as SavePoint, occurrence: r.occurrence, entry: r.entry,
      ...(r.attempt_id === undefined ? {} : { attempt_id: r.attempt_id }), ...(r.endpoint === undefined ? {} : { endpoint: r.endpoint }), notWritten: r.not_written }]
    : r.kind === 'save-fault-miss' ? [{ point: r.point as SavePoint, occurrence: r.occurrence as number, entry: r.entry, notWritten: false, miss: true }]
    : []),
}
const e3: E3Adapter = {
  channel: 'events',
  ready: run => recordsOf(run)?.[0]?.kind === 'ready',
  events: run => (recordsOf(run) ?? []).flatMap(r => r.kind === 'reserve' ? [{ entry: r.entry, scope: r.scope, endpoint: r.endpoint,
    unit_micro_usd: r.unit_micro_usd, result: r.result, ...(r.attempt_id === undefined ? {} : { attempt_id: r.attempt_id }),
    ...(r.reason === undefined ? {} : { reason: r.reason }) }] : []),
}

// 前提登记：理由在文件头。answer 只填冻结套件闸门认的那两种之一（INTEGRATION.md 前提登记表）；E-2、E-3 任意答案都放行，不填。
const MAIN = '@251d2d6'
// E-2、E-3 的出处：原文进主干的那一次合入（#434）；需求方逐字确认的时刻与原文字节的 SHA256 记在 ADR-187 开头
const CONTRACT = 'skill/references/output-format.md 末节「测试观察用的记录文件与保存失败注入（契约 kol-test-observer/v1）」@b3535ee'
const conditions: Partial<Record<ConditionId, Resolution>> = {
  'GAP-18': {
    resolved: true,
    ref: `scripts/lib/types.ts:270-408 ${MAIN}（公开的 Creator 类型声明；所用类型在 :8-9、:72-80、:112-123）；补法是公开的夹具资格检查，即本文件的 creatorCheck，只依据声明，不读函数体`,
  },
  'GAP-24a': {
    resolved: true, answer: 'reads-memory',
    ref: `实现事实，只作资格前提：collect 续跑名单为空也走到读记忆 —— scripts/collect.ts:440-472 main() 在 run()、enrichProfiles() 之后` +
      `无条件 persist() 再调 finalize；scripts/lib/pipeline.ts:101-115 finalize 无条件调 filterByMemory；scripts/lib/memory.ts:392-401 ` +
      `filterByMemory 先 readMemory()（:259-291，读 cwd 下 :8 的 memory/creators.json），不看名单空不空，读不出且没给 --ignore-memory ` +
      `就抛 MemoryUnreadable；scripts/collect.ts:473-501 接住后退 2。${MAIN}`,
  },
  'GAP-24b': {
    resolved: true, answer: 'not-read',
    ref: `实现事实，只作资格前提：预留保存失败之后 collect 不读记忆 —— scripts/providers/tikhub.ts:167 每次 fetch 之前 budget.reserve；` +
      `scripts/lib/budget.ts:80-93 reserve 落盘失败即抛 CostError('persistence-failed')；scripts/collect.ts:444-449 main() 的 catch 对它` +
      `只尽力 persist() 一次再原样抛出，走不到 :469-472 的 finalize（collect 读记忆只有这一处：scripts/lib/pipeline.ts:115 → ` +
      `scripts/lib/memory.ts:397），由 :557-560 退 1。${MAIN}`,
  },
  'E-2': {
    resolved: true,
    ref: `${CONTRACT} 第二节（控制文件 .kol-save-fault.json 选〈保存点，第 k 次〉、命中与未命中记录）；实现方公开、需求方逐字确认：` +
      `ADR-186（第一版）、ADR-187（改写进记录文件，第 4 版原文需求方 2026-11-08 确认）；适配器在本文件 e2`,
  },
  'E-3': {
    resolved: true,
    ref: `${CONTRACT} 第一节（就绪记录、预留记录，写进 KOL_TEST_OBSERVER_EVENTS 指的文件）；实现方公开、需求方逐字确认：` +
      `ADR-186（第一版）、ADR-187（改写进记录文件，第 4 版原文需求方 2026-11-08 确认）；适配器在本文件 e3，走记录文件那一路`,
  },
}

try {
  const r = runSuite({ workRoot: work, facility, sortForOutput: sort, creatorCheck, conditions, reviews: [], e2, e3, only, reportPath: report })
  console.log(JSON.stringify({ cases: r.cases.length, runs: r.runs.length, verdicts: r.verdicts, items: r.items, records: recordProblems, facility: facilityFiles() }))
} catch (e) {
  console.error(`冻结套件跑到一半抛出：${e instanceof Error ? e.stack ?? e.message : String(e)}`)
  process.exitCode = 1
}
