#!/usr/bin/env tsx
/**
 * 需求测试。**每个用例标注它验的是哪条需求编号** —— 审计据此回答覆盖度。
 *
 * 写测试的纪律（process/4-VERIFY.md）：只看需求描述和验收标准，不读实现。
 * 本文件目前违反了这一条（同一上下文写的代码和测试），已登记为 ADR-04 的已知缺口。
 *
 * 它**没有死亡条件,而那是判过的结论、不是漏了** —— 理由记在 ADR-85。
 */
import { extractEmail, PR_SIGNALS } from './lib/email.js'
import { entries, ledgerSummary, orphanIous } from './check/debt-rule.js'
import { implementationLeak } from './check/why-rule.js'
import {
  JUDGMENT_EXEMPT, coverageSummary, criterionMutations, deprecatedBlock, judgmentModules,
  ledger, selfcheckCriterionMutations, unguarded,
} from './check/audit-rule.js'
import {
  VERIFIERS, allKilled, complete, crashEvidence, exemptionCovered, exemptionLead, exitRace,
  judgeRun, killsMatched,
  labelFault, notAssertion,
  labelFaults,
  groupOfLabel, labelsOf, leadWired, processFailed, wiringFault,
  anchorMatches, baselineFault,
} from './check/mutate-rule.js'
import { type Group, parseOnly, parseOnlyStrict, wanted } from './check/group-rule.js'
import {
  beginMutation, blockingWait, onInterrupt, restoreMutation, restoreOnInterrupt, stopJobs,
  testRunning, trackTest,
} from './check/mutate-restore.js'
import {
  type BillRow, type Outcome, type Ran, BEACON_FLAG, beaconFrom, beaconGone, beaconNote, beaconPathOf,
  billLines, copyIntoWorker, groupShot, hardStopPlan, jobsWanted, looksLikeReport, missingVerdicts,
  neverStarted, noStdio, ownGroup, parseReport, reportLine, signalTargets, verifierBill,
} from './check/jobs-rule.js'
import {
  active, adrIdsIn, contentHash, criteriaCell, danglingAdrRefs, mutationCell, renderTables,
  requirementVerdict,
  rootProblems, tensionEvidence, tensionHasRedline, tensionKey, tensionVerdict,
  validateRegistry,
  type Evidence, type Req, type TensionEvidence,
} from './check/spec-rule.js'
import { HARNESS, attributionFault, duplicateIds, orphanAttributions } from './check/attribution-rule.js'
import {
  CLAIMS_PATH, ENTRY_CLAIMS_PATH, claimsFresh, claimsOwnedBy, claimsPublishable, claimsReadFault,
  claimsWellFormed,
  fingerprint, sourceFiles,
} from './check/claims.js'
import {
  BUDGET, GIT_CONFIG, NUMSTAT, NUMSTAT_IGNORING_SPACE, TRUNK_CANDIDATES, type Baseline, type GitAsk,
  type Waiver,
  categorize, discount, discountable, judge, judgeExemption, merge, parseNumstat,
  resolveBaseline, scanMessage, tally,
} from './check/size-rule.js'
import {
  FILE_RE, checkAll, encodeTarget, escapeCell, fileNameOf, markerFault,
  renderIndex, slugify,
} from './check/adr-rule.js'
import { endsOpen, quotedMask } from './check/quoted.js'
import { tsxCommand } from './check/tsx-cmd.js'
import {
  SELFCHECK_FIXTURE_MARK, SELFCHECK_PRELOAD, SELFCHECK_PROCESS_MARK, SELFCHECK_SEEDS,
  SELFCHECK_TOOLS,
  closure, importsOf, infraClosure, selfVerifying, selfcheckSummary,
} from './check/verifier-rule.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { scoreCreator, tierOf, passesFollowerGate } from './lib/score.js'
import { formatDiscoverySources, mergeDiscoverySources } from './lib/discovery.js'
import { hashtagKeyword, igRouteProblems } from './lib/ig-route.js'
import { taskListProblems } from './lib/search-tasks.js'
import { resumeProgressProblems } from './lib/resume-progress.js'
import { configFieldProblems, type ConfigInputRole } from './lib/config-input.js'
import {
  INSTAGRAM_HASHTAG_ENDPOINT, TikHub, TikHubError, fillEmail, isInstagramVideo, parseInstagramHashtagPage, pickList,
} from './providers/tikhub.js'
import { esc, writeCsv } from './lib/csv.js'
import { HEADERS, toRow, cell, sortForOutput, buildSheets } from './lib/rows.js'
import { writeXlsx } from './lib/xlsx.js'
import { readFileSync as rf, unlinkSync as ul } from 'node:fs'
import { spawnSync, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { isDeepStrictEqual } from 'node:util'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import { Budget, BudgetInputError, startBudget, costView, type CostView } from './lib/budget.js'
import { readCostDocument, readCostLimit, setCostLimitField, sourceNumberToken, stringifyCostJson, type CostState } from './lib/cost-json.js'
import {
  CostError, CostLedgerUnavailable, createCostBudget, formatUsd, inspectExistingCostLedger,
  parseUsdMicros, restoreCostBudget, type CostSnapshot,
} from './lib/cost-ledger.js'
import {
  TIKHUB_PRICE_BASIS, TIKHUB_PRICE_CATALOG, TIKHUB_PRICE_VERSION, quoteTikHub, resolveTikHubPrice,
} from './providers/tikhub-pricing.js'
import { enrichedFlag, renderHtml } from './lib/report.js'
import { filterByMemory, recordRecommendations, useMemoryFile } from './lib/memory.js'
import {
  MAX_PAGES, canRequestPage, finalize, firstPagePending, igAfterPage, keywordsResumeWillRun,
  keywordRows, mergePage, needsProfile, pagesFetched, pendingKeywords, rankCreators,
  taskPlatforms, taskQueryStatus, tierCounts, resumeCostLine, underPageCap,
} from './lib/pipeline.js'
import {
  ACTIVITY_ACTIVE_MAX_DAYS, ACTIVITY_COOLING_MAX_DAYS,
  accountKey, assignAudienceRisks, attachAssessments, calculatePublicMetrics,
  calculateQuoteEfficiency, measured, publicPostSample, recomputeCachedAssessment, unavailable,
} from './lib/assessment.js'
import {
  writeFileSync, unlinkSync, truncateSync, rmSync, mkdirSync, mkdtempSync, existsSync,
  readdirSync, chmodSync, statSync, symlinkSync, lstatSync, utimesSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import type {
  AccountAssessment, AudienceRiskAssessment, CollaborationQuote, Creator, DiscoverySource, EnrichmentState, MetricSource, NormalizedPublicPost, RecentPost, SearchTask, TaskState,
} from './lib/types.js'
import { asMemoryStatus, creatorKey } from './lib/types.js'
import { loadRawCreators, persistListAndStatus, saveCostCheckpoint, saveRawCreators, saveTask } from './lib/task.js'
import { isAbsence, mkdirDurable, writeFileAtomic } from './lib/atomic.js'

let fail = 0
let cur = ''
let assertionCount = 0
export const covered = new Set<string>()

// 只给已核对独立性的块开放子集。登记顺序就是它们在完整测试中的原顺序；
// 其余块仍只在完整运行中执行。依赖写在这一份登记里，选跑由 wanted 展开闭包。
const GROUPS: readonly Group[] = [
  { id: 'd6-pipeline', needs: [] },
  { id: 'd4-memory', needs: [] },
  { id: 'u3-keywords', needs: [] },
  { id: 'u8-labels', needs: [] },
  { id: 'p5-report', needs: [] },
  { id: 'd7-email', needs: [] },
  { id: 'd8-public', needs: [] },
  { id: 'h-spec', needs: [] },
  { id: 'd11-posts', needs: [] },
  { id: 'd15-hashtag', needs: [] },
  { id: 'd16-tasks', needs: [] },
  { id: 'd17-config', needs: [] },
  { id: 'd19-resume', needs: [] },
  { id: 'f8-risk', needs: [] },
  { id: 'h-mutate', needs: [] },
  { id: 'h-jobs', needs: [] },
  { id: 'h-infra-rules', needs: [] },
  { id: 'h-group', needs: [] },
  { id: 'h-check-rules', needs: [] },
  { id: 'd6-provider', needs: [] },
  { id: 'd12-ledger', needs: [] },
]
const testArgs = process.argv.slice(2)
const onlyIds = parseOnlyStrict(testArgs, ['--json'])
if (onlyIds !== undefined && testArgs.includes('--json')) {
  throw new Error('需求测试子集不输出 COVERED；审计认领只能来自完整 npm test')
}
const selectedGroups = wanted(GROUPS, onlyIds)
const fullRun = selectedGroups === undefined
const seenGroups = new Set<string>()
const executedGroups = new Set<string>()
const group = async (id: string, run: () => void | Promise<void>): Promise<void> => {
  const spec = GROUPS[seenGroups.size]
  if (spec?.id !== id) throw new Error(`需求测试组登记与执行顺序不一致：${id}`)
  seenGroups.add(id)
  if (selectedGroups !== undefined && !selectedGroups.has(id)) return
  for (const need of spec.needs) {
    if (!executedGroups.has(need)) throw new Error(`需求测试组 ${id} 的依赖 ${need} 尚未执行`)
  }
  const before = assertionCount
  await run()
  if (assertionCount === before) throw new Error(`需求测试组 ${id} 没有执行断言，不能报告通过`)
  executedGroups.add(id)
}
if (!fullRun) {
  console.log(`[需求测试子集：${[...selectedGroups].join('、')}；其余测试未执行，不认领全量审计]`)
}

// 开跑前先把上一次的覆盖记录清掉 —— 拥有它的一方负责它的生死（ADR-20）。
// 挡的是「源码没改、这一跑却红了或者半路死了」那一半：那时指纹对得上，
// 上一次成功的记录就成了这一次的证据。改坏源码那一半由指纹的范围挡（claims.ts）。
// 挡不住 import 阶段就崩的那一路 —— 这一行在静态 import 求值之后才跑。
// 见 claims.ts 里 claimsOwnedBy 的「够不到的那一段」。
if (fullRun && claimsOwnedBy(process.env.MUTATING === '1')) rmSync(CLAIMS_PATH, { force: true })
// 开跑前的指纹。跑完再算一次，两次对不上说明源码在这一跑的过程中被改过 ——
// 只算跑完那一次的话，记录带的是新那棵树的指纹，而断言执行的是旧的，审计照样
// 比对得上，于是一棵从没被完整测过的树拿到了证据。
const startHash = fingerprint(sourceFiles())

const suite = (req: string, name: string) => { cur = req; covered.add(req); console.log(`\n[${req}] ${name}`) }
const eq = (label: string, got: unknown, want: unknown) => {
  assertionCount++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fail++; console.log(`  ✗ ${label}\n     got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`) }
  else console.log(`  ✓ ${label}`)
}
const ok = (label: string, cond: boolean) => eq(label, cond, true)

// 独立费用夹具：金额和八端点单价来自 ADR-107/108，不调用生产 formatter 作 oracle。
const TEST_PRICE_VERSION = 'tikhub-public-20260720-5d52fe8fb109'
const TEST_TT = '/api/v1/tiktok/app/v3/fetch_video_search_result'
const TEST_IG = '/api/v1/instagram/v2/search_reels'
const TEST_PRICES: Record<string, number> = {
  [TEST_TT]: 1000, '/api/v1/tiktok/web/fetch_user_profile': 1000,
  '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3': 1000,
  [TEST_IG]: 2000, '/api/v1/instagram/v2/search_users': 2000,
  '/api/v1/instagram/v1/fetch_user_info_by_username_v3': 1000,
  '/api/v1/instagram/v1/fetch_user_info_by_username_v2': 1000,
  '/api/v1/instagram/v2/fetch_user_posts': 2000,
}
const TEST_COST_BASIS = '按固定公开基础价、不计优惠的估算；不是实际账单，也不保证供应商未来价格上限。'
const testUsd = (micros: number): string => {
  const n = BigInt(micros), fraction = String(n % 1000000n).padStart(6, '0').replace(/0+$/, '')
  return `${n / 1000000n}${fraction ? '.' + fraction : ''}`
}
const costFixture = (limit = 1_000_000, http = 0, unknown = 0): CostState => {
  const ledger = { schema: 1, currency: 'USD', unit: 'micro_usd', scope: 'task',
    limit_micro_usd: limit, next_attempt_id: http + unknown + 1,
    entries: http + unknown ? [{ endpoint: TEST_TT, price_version: TEST_PRICE_VERSION,
      unit_micro_usd: 1000, http_200_count: http, unknown_result_count: unknown }] : [] }
  return readCostDocument(`{"budget_usd":${testUsd(limit)},"requests":${http + unknown},"cost_ledger":${JSON.stringify(ledger)}}`)
}
const fundedBudget = (limit = 1_000_000, notify: Parameters<typeof startBudget>[3] = () => {}) =>
  startBudget({}, limit, 'process', notify)
const testCostMeta = (requests = 1, limit = 2_000_000): CostView => ({
  requests, budget_usd: testUsd(limit), cost_estimate_usd: testUsd(requests * 1000),
  cost_status: 'known', cost_scope: 'task', cost_http_200_usd: testUsd(requests * 1000),
  cost_unknown_result_usd: '0', cost_pending_usd: '0', cost_basis: TEST_COST_BASIS,
  cost_price_versions: requests ? [TEST_PRICE_VERSION] : [], cost_problems: [],
})
const costSucceeds = async (label: string, run: () => unknown | Promise<unknown>) => {
  let completed = false, error: unknown
  try { await run(); completed = true } catch (caught) { error = caught }
  ok(label, completed)
  if (!completed) console.log(`     escaped=${error instanceof Error ? error.name + ': ' + error.message : String(error)}`)
}


/**
 * 认领一条**验收判据**（ADR-24）。计量单位是判据,不是需求 ——
 * 「这条需求有测试」比事实粗:验收标准里的「与」在计量上是一条,在事实上是两条,
 * 于是漏掉的那一半不扣分。红线的每一条判据没有认领就是硬失败,判定在 `spec-rule.ts`。
 *
 * 写在它认领的那几条断言**后面**:认领的意思是「上面那几条真的跑到了这里」。
 * 断言红了就不写盘（`claimsPublishable`），所以认领不会替一次失败的运行作证。
 * 和 `covered` 一样只认运行时执行到的 —— 注释掉的认领不算数（ADR-20）。
 */
const claimedCriteria = new Set<string>()
const criterion = (...ids: string[]) => { for (const id of ids) claimedCriteria.add(id) }

/**
 * 认领一个**交点** —— 两条需求撞上时以谁为准（ADR-17）。
 *
 * 交点的裁决跨着两条需求，不属于任何一条，所以两边各自的判据谁也不会验它：
 * 登记表上写着「撞上时以 P4 为准」，代码里可以完全不是这么做的，而两条需求
 * 的判据全绿。交点里有红线的，没有认领就是硬失败，判定在 `spec-rule.ts`。
 *
 * 编号由 `tensionKey` 出，写审计的那一头也用同一个函数 —— 两头各拼一次字符串，
 * 迟早拼出两种写法（`CLAIM_LISTS` 那一栏踩过）。两侧顺序无关：
 * 登记表要求写在让步的那一方，那是给读的人定的规矩，认领的时候不必想清楚谁让步。
 */
const claimedTensions = new Set<string>()
const tension = (a: string, b: string) => { claimedTensions.add(tensionKey(a, b)) }

/**
 * 检查链自己的判定也要有测试。这类块不服务任何需求编号，所以**不进覆盖计数** ——
 * 混进去会让「覆盖 N 条需求」那个数字变成一个虚报的数。
 */
const harness = (name: string) => { console.log(`\n[harness] ${name}`) }

/**
 * 从 xlsx 里真正读回 sheet 名。
 *
 * 必须真解压 —— 早先写过一版靠索引硬编码出 "(0)" 的辅助函数，那是个
 * 永远不会失败的检查，等于没测。
 */
function xlsxSheetNames(path: string): string[] {
  const buf = rf(path)
  // 扫本地文件头，找到 xl/workbook.xml 那条，inflate 后取 <sheet name="...">
  for (let i = 0; i + 30 < buf.length; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue
    const nameLen = buf.readUInt16LE(i + 26)
    const extraLen = buf.readUInt16LE(i + 28)
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8')
    if (name !== 'xl/workbook.xml') continue
    const start = i + 30 + nameLen + extraLen
    const compSize = buf.readUInt32LE(i + 18)
    const xml = inflateRawSync(buf.subarray(start, start + compSize)).toString('utf8')
    return [...xml.matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1])
  }
  throw new Error('xlsx 里找不到 xl/workbook.xml')
}

const mk = (p: 'tiktok' | 'instagram', h: string, over: Partial<Creator> = {}): Creator => ({
  platform: p, handle: h, nickname: h, followers: 10000, post_count: 50,
  bio: null, bio_links: [], verified: false, profile_url: '',
  source_keyword: 'k', source_dimension: 'category', recent_posts: [], ...over,
})

const PUBLIC_SOURCE: MetricSource = {
  kind: 'public_api', provider: 'tikhub', endpoint: '/user-posts',
}
const publicPosts = (
  views: number,
  likes: number,
  count = 6,
): NormalizedPublicPost[] => Array.from({ length: count }, (_, i) => ({
  id: `p${i}`,
  views: views + i,
  likes: likes + i,
  comments: i,
  published_at: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
  is_pinned: false,
}))

const assessedAccount = (
  handle: string,
  views: number,
  likes: number,
  following: number,
): AccountAssessment => {
  const sample = measured(publicPosts(views, likes), PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6,
    'latest profile posts')
  return {
    platform: 'tiktok', handle, followers: 10_000, following, sample,
    metrics: calculatePublicMetrics(sample, 10_000, following),
  }
}

// ─────────────────────────── 红线 ───────────────────────────

if (fullRun) {
suite('P1', '缺失数据不得用默认值填充')
{
  // 「未查询」与「查过，值为空」必须是两个不同的值。
  //
  // 这里原先比的是夹具上一行刚放进去的值（`ok('bio 未取到时为 undefined', …)` 这一族），
  // 而 `mk` 是纯展开 —— **那种断言无论实现怎么写都绿**（ADR-88 第一节）。
  // 换成过一趟真正压着正确性的那条路：采集累加器 `creators.raw.json`。
  // 续跑读的就是它（`loadRawCreators`），读回来分不开，「查过、对方没有」
  // 下一轮就会被当成「还没查过」再花一次钱查。
  //
  // 逐条写标量，不并成数组：`eq` 走 JSON.stringify，而数组里的 undefined 会被
  // 序列化成 null —— 并起来写，这几条恰好分不出本条要防的那两个态。
  const rawDir = mkdtempSync(join(tmpdir(), 'kol-p1-raw-'))
  saveRawCreators(rawDir, [
    mk('tiktok', 'a', { bio: undefined, email: undefined, followers: undefined }),
    mk('tiktok', 'b', { bio: null, email: null, followers: 0 }),
  ])
  const back = loadRawCreators(rawDir)
  rmSync(rawDir, { recursive: true, force: true })
  eq('未查询过一趟持久化仍是未查询：bio', back[0].bio, undefined)
  eq('未查询过一趟持久化仍是未查询：email', back[0].email, undefined)
  eq('未查询过一趟持久化仍是未查询：followers', back[0].followers, undefined)
  eq('「查过、对方没有」过一趟持久化仍是 null，没塌成未查询', back[1].bio, null)
  eq('「值就是 0」过一趟持久化仍是 0，没塌成未查询', back[1].followers, 0)

  // 粉丝数未知不得被当作 0 参与评分 —— 那会让人被下限过滤掉
  const unknown = mk('tiktok', 'c', { followers: undefined, post_count: undefined })
  const zero = mk('tiktok', 'd', { followers: 0, post_count: 0 })
  eq('未知粉丝不得分', scoreCreator(unknown), scoreCreator(zero))

  // 未知 + 已知 的合并结果必须是未知，不能当 0 加
  const m = [mk('tiktok', 'x', { followers: undefined, bio_links: ['https://instagram.com/x'] }),
             mk('instagram', 'x', { followers: 31000 })]
  linkCrossPlatform(m)
  const merged = mergeCrossPlatform(m)
  eq('未知参与求和结果仍为未知', merged[0].followers, undefined)

  // bio 未取到 → email 保持 undefined（未查询）；bio 取到但无邮箱 → null（查过，没有）
  const noBio = mk('tiktok', 'e', { bio: undefined })
  fillEmail(noBio)
  eq('bio 未取到 → email 未查询', noBio.email, undefined)

  const emptyBio = mk('tiktok', 'f', { bio: 'no contact here' })
  fillEmail(emptyBio)
  eq('bio 取到但无邮箱 → 查过没有', emptyBio.email, null)

  const withEmail = mk('tiktok', 'g', { bio: 'biz@x.com' })
  fillEmail(withEmail)
  eq('bio 有邮箱 → 提取', withEmail.email, 'biz@x.com')
  criterion('P1.a')

  // 三态的第三种：profile 查回来了、对方没写简介 —— bio 记的是 null（查过，没有）。
  // 那么邮箱也该是「查过，没有」。塌回 undefined，就把「我们看过他的简介、他没留
  // 邮箱」说成了「我们还没看过他的简介」——恰好是 P1 要防的那件事（负片 M-P1-r）。
  const blankBio = mk('tiktok', 'n', { bio: null })
  fillEmail(blankBio)
  eq('查过、对方没写简介 → 邮箱是「查过，没有」', blankBio.email, null)
  criterion('P1.d')

  // 粉丝数未知不得被静默过滤掉
  ok('未知粉丝放行', passesFollowerGate(mk('tiktok', 'h', { followers: undefined })))
  ok('低于下限拦截', !passesFollowerGate(mk('tiktok', 'i', { followers: 100 })))
  ok('高于上限拦截', !passesFollowerGate(mk('tiktok', 'j', { followers: 9_000_000 })))
  ok('区间内放行', passesFollowerGate(mk('tiktok', 'k', { followers: 50_000 })))
}

suite('P1', 'profile 查回来了、对方没写简介 —— 别再当成「还没查过」')
{
  // 适配器那一半：请求已经发出去、人也查回来了，signature／biography 是空只说明
  // 对方没写。记成 undefined，这个人每轮续跑都会被当成「还没查过」重查一次，
  // 钱一轮一轮地花（负片 M-P1-s、M-P1-t）。
  const stub = (raw: unknown) => {
    const api = new TikHub('k', fundedBudget())
    ;(api as unknown as { get: () => Promise<unknown> }).get = async () => raw
    return api
  }
  const tk = await stub({ data: { userInfo: { user: { nickname: 'n' }, stats: {} } } }).profileTikTok('x')
  eq('TikTok：查回来了但没写简介 → 记「查过，没有」', tk.bio, null)
  const ig = await stub({ data: { user: { full_name: 'n' } } }).profileInstagram('x')
  eq('Instagram：同样记「查过，没有」', ig.bio, null)

  // 消费那一半：判定认这个态，续跑才不会再去查他一次。两半坏在不同的地方 ——
  // 只压适配器时，下面两条照样绿；只压判定时，上面两条照样绿（负片 M-P1-u）。
  const c = (over: Partial<Creator>) => mk('tiktok', 'y', over)
  eq('查过、没写简介、有外链 → 不用再补', needsProfile(c({ bio: null, bio_links: ['https://x'] })), false)
  ok('没查过 → 还是要补', needsProfile(c({ bio: undefined, bio_links: ['https://x'] })))
  criterion('P1.c')
}

suite('P1', '采集侧解析：响应里没有的字段不得落成 0 或空串')
{
  /**
   * P1 的 a–g 七条都停在「数据已经进了系统」那一侧，而三态**第一次成形**是在这里 ——
   * 搜索响应解析。这一层把缺失读成 0，下游拿到的就全是「值就是 0」，
   * 后面每一条判据照样绿。ADR-88 把这一处记成真空白。
   */
  const stub = (raw: unknown) => {
    const api = new TikHub('k', fundedBudget())
    ;(api as unknown as { get: () => Promise<unknown> }).get = async () => raw
    return api
  }
  /** 只换 author 上的那几个字段，别的保持一次真实响应的形状 */
  const one = async (author: Record<string, unknown>): Promise<Partial<Creator>> =>
    (await stub({ data: { aweme_list: [{ author: { unique_id: 'u', ...author }, statistics: {} }] } })
      .search({ keyword: 'k', dimension: 'category', platform: 'tiktok' }, 'US', 0)).creators[0]

  const missing = await one({})
  eq('响应里没有粉丝数 → 未查询，不落成 0', missing.followers, undefined)
  eq('响应里没有简介 → 未查询，不落成空串', missing.bio, undefined)

  // 搜索结果里 aweme_count 对**所有人**都返回 0 —— 那不是真实值，是这个端点不填它。
  // 当成 0，内容积累那一档对全员失效，而 0 是个「值」，类型系统拦不住。
  eq('搜索结果里的 aweme_count: 0 是占位不是真值 → 记未查询',
     (await one({ aweme_count: 0 })).post_count, undefined)

  // 反向的一半：真有值时不许被上面那条顺手吞掉
  eq('aweme_count 有真实值 → 照常记下', (await one({ aweme_count: 42 })).post_count, 42)
  eq('follower_count 有真实值 → 照常记下', (await one({ follower_count: 31_000 })).followers, 31_000)
  eq('signature 有内容 → 照常记下', (await one({ signature: 'hi' })).bio, 'hi')
}

suite('P1', '没取到的播放数不得被判成爆款')
{
  /**
   * 这一档是「近期样本里有爆款」加分，爆款阈值 = 单条播放数 > 10 万。
   * **这个阈值没有写进 docs/requirements.json**，只活在实现里 —— 已知缺口。
   * 所以下面只取明显落在阈值两侧的值，不去钉边界：把一个还没登记成需求的常数
   * 钉死在测试里，等于让测试替实现背书。
   *
   * 这一段只假设 plays 唯一的去处是这一档。若实现里还有别的档也读 plays，
   * 性质二会红 —— 那说明契约没交接全，按 4-VERIFY 该报告，不是把测试改弱。
   */
  const NOT_HIT = [0, 1, 12_345, 99_999]
  const HIT = [100_001, 250_000, 4_000_000]

  /** 「没取到」有两种合法写法（plays 是可选字段），都表示未查询，必须同解 */
  type Plays = number | 'absent' | 'undefined'
  const UNKNOWN: { name: string; v: Plays }[] = [
    { name: '字段缺席', v: 'absent' },
    { name: '值为 undefined', v: 'undefined' },
  ]

  const post = (v: Plays, i: number): RecentPost =>
    v === 'absent' ? { desc: `p${i}` }
      : v === 'undefined' ? { desc: `p${i}`, plays: undefined }
        : { desc: `p${i}`, plays: v }
  const scoreOf = (plays: Plays[]) =>
    scoreCreator(mk('tiktok', 'x', { recent_posts: plays.map(post) }))

  /**
   * 样本形状。others 是同一样本里的其它帖子，待验的那一条插在 at；
   * 各变体之间只差这一条的 plays，别的档一律相同、相减抵消。
   */
  const shapes: { name: string; others: Plays[]; at: number; hasHit?: boolean }[] = [
    { name: '样本只有这一条', others: [], at: 0 },
    { name: '待验的在最前', others: [5_000, 20_000], at: 0 },
    { name: '待验的夹在中间', others: [5_000, 20_000], at: 1 },
    { name: '待验的在最后', others: [5_000, 20_000], at: 2 },
    { name: '其它条也没取到', others: ['absent', 'undefined'], at: 1 },
    { name: '样本里已有一条真爆款', others: [300_000, 8_000], at: 2, hasHit: true },
  ]
  const put = (s: { others: Plays[]; at: number }, v: Plays): Plays[] => {
    const a = [...s.others]
    a.splice(s.at, 0, v)
    return a
  }

  /**
   * 性质一：爆款那一档确实生效。
   *
   * 少了这一条，性质二在「爆款加分根本没接上」时同样会绿 ——
   * 那就是一个永远不会失败的检查。已有爆款的样本不参与：
   * 那一档是存在性判断，再多一条爆款本来就不该再加分。
   */
  const dead: string[] = []
  for (const s of shapes.filter(x => !x.hasHit)) {
    for (const low of NOT_HIT) for (const high of HIT) {
      // 写成 !(>) 而不是 <=：得分若是 NaN，<= 恒假，这条检查就永远不会失败了
      if (!(scoreOf(put(s, high)) > scoreOf(put(s, low)))) dead.push(`${s.name}: ${low} → ${high}`)
    }
  }
  eq('爆款确实加分（否则性质二空绿）', dead, [])

  /**
   * 性质二：播放数没取到时，那一条不得被判成一个具体的值 ——
   * 不论那个值落在阈值哪一侧。表现为得分必须与「确定不是爆款」一模一样，
   * 既不多也不少；只要它跟着某个假想值走，这里就会列出来。
   *
   * 什么东西能在 P1 不成立时也让这条绿：**把未知当成 0**。
   * 那一侧得分与「确定不是爆款」本来就同分，scoreCreator 的返回值里看不见 ——
   * 这一档能验的只有「不得被当成大数」那一半。另一半靠类型层
   * （RecentPost.plays 可选）挡着。⚠️ 原先这里还写着「加纪律 lint 挡着」——
   * 那道闸门 2026-09-18 撤了（ADR-77），`p.plays ?? 0` 现在**不会**在写下的那一刻
   * 被拦；它要到把三态压平、且压平点落在取值／排序／入池三处之一时才红。
   */
  const decided: string[] = []
  for (const s of shapes) {
    for (const u of UNKNOWN) {
      const got = scoreOf(put(s, u.v))
      for (const low of NOT_HIT) {
        const want = scoreOf(put(s, low))
        if (got !== want) decided.push(`${s.name}/${u.name}: ${got} 分，plays=${low} 时 ${want} 分`)
      }
    }
  }
  eq('没取到的播放数不参与爆款判定', decided, [])
}

suite('P2', '开发信占位符必须原样保留到产出物')
{
  // 只验可执行的那一半：render 不得删除/替换草稿里的 {…}
  // 「是否编造产品事实」由 Agent 判断，不经代码路径 —— 见 ADR-01
  const draft = 'Hi Sarah,\n\nWe make a {产品一句话} for {价格待填}.\n\nBest,\n{name}'
  const html = renderHtml([mk('tiktok', 'a', { tier: 'A', score: 1, outreach_draft: draft })],
    { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [], total: 1,
      tiers: { A: 1, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
      ...testCostMeta(1, 2000000), enriched: false })
  ok('HTML 保留占位符', html.includes('{产品一句话}') && html.includes('{价格待填}'))

  const row = toRow(mk('tiktok', 'a', { tier: 'A', score: 1, outreach_draft: draft }))
  const drafted = String(row[HEADERS.indexOf('outreach_draft')])
  ok('CSV 保留占位符', drafted.includes('{产品一句话}') && drafted.includes('{价格待填}'))
  eq('占位符一个不少', (drafted.match(/\{[^}]*\}/g) ?? []).length, 3)
  criterion('P2.b')
}

suite('P1', '响应结构探测不得被空数组满足')
{
  covered.add('P1')
  // 实测：视频搜索同时返回空 aweme_list 和有数据的 search_item_list
  const real = { data: { aweme_list: [], has_more: 1, search_item_list: [{ a: 1 }, { a: 2 }] } }
  eq('取有数据的那个', pickList(real, 't').length, 2)

  // 顺序反过来也要对
  const rev = { data: { search_item_list: [], user_list: [{ b: 1 }] } }
  eq('不被前置的空数组挡住', pickList(rev, 't').length, 1)

  // 全空是真的没结果，不该报错
  eq('全空 → 空结果而非报错', pickList({ data: { aweme_list: [], user_list: [] } }, 't'), [])

  // 完全不认识的结构 → 报错并附顶层 key，不硬猜
  let msg = ''
  try { pickList({ data: { weird_key: 1, other: 2 } }, 'x') } catch (e) { msg = String(e) }
  ok('不认识就报错', msg.includes('无法识别'))
  ok('报错里带上顶层 key', msg.includes('weird_key'))
}

suite('P3', '按实际端点金额拒绝超额，刚好等于上限允许')
{
  await costSucceeds('预算闸门完整执行', () => {
    const b = fundedBudget(5000)
    let sent = 0, caught: unknown
    try { for (let i = 0; i < 10; i++) { const r = b.reserve(TEST_TT); sent++; b.settle(r, { kind: 'http', status: 200 }) } }
    catch (e) { caught = e }
    eq('5000 微美元只允许五次 1000 请求', sent, 5)
    ok('超额只以 budget-exceeded 表示额度不足', caught instanceof CostError && caught.code === 'budget-exceeded')
    eq('被拒时不增加净次数', b.count, 5)
    eq('恰好用满金额没有被浮点拒绝', b.view().cost_estimate_usd, '0.005')
    const resumed = new Budget(costFixture(10000, 2, 1), () => {})
    eq('恢复不从净次数重新制造金额或归零', [resumed.count, resumed.view().cost_estimate_usd], [3, '0.003'])
  })
  criterion('P3.c')
}

suite('P3', '实际 fetch 前已经预留端点金额，终态才增加净次数')
{
  type Obs = { local: number | null; occupied: string | null; threw: string;
    atSend: { count: number | null; occupied: string | null; pending: string | null }[];
    served: { path: string; status: number }[] }
  const bodyFor = (path: string): unknown =>
    path.includes('fetch_video_search_result')
      ? { data: { aweme_list: [], search_item_list: [{ aweme_info: { author: { unique_id: 'u' } } }], has_more: 1 } }
      : path.includes('instagram/v2/search_reels') ? { items: [] }
        : path.includes('instagram/v2/search_users') ? { items: [{ username: 'u' }] }
          : path.includes('fetch_user_post_videos_v3') || path.includes('instagram/v2/fetch_user_posts') ? { items: [] } : {}
  async function drive(limit: number, start: number, outcomes: number[], call: (api: TikHub) => Promise<unknown>): Promise<Obs> {
    const o: Obs = { local: null, occupied: null, threw: '', atSend: [], served: [] }
    const realFetch = globalThis.fetch, realTimeout = globalThis.setTimeout
    globalThis.setTimeout = ((fn: () => void) => { fn(); return 0 }) as unknown as typeof setTimeout
    try {
      const budget = new Budget(costFixture(limit, start), () => {})
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const status = outcomes[o.served.length] ?? 200, path = new URL(String(input)).pathname
        const v = budget.view()
        o.atSend.push({ count: budget.count, occupied: v.cost_estimate_usd, pending: v.cost_pending_usd })
        o.served.push({ status, path })
        return status === 200 ? new Response(JSON.stringify(bodyFor(path)), { status }) : new Response('nope', { status })
      }) as typeof fetch
      try { await call(new TikHub('k', budget)) } catch (e) {
        o.threw = e instanceof CostError ? e.code : e instanceof TikHubError ? 'TikHubError' : `unexpected:${String(e)}`
      }
      o.local = budget.count; o.occupied = budget.view().cost_estimate_usd
    } catch (e) { o.threw = `unexpected:${String(e)}` }
    finally { globalThis.fetch = realFetch; globalThis.setTimeout = realTimeout }
    return o
  }
  // Oracle 用实际服务的状态序列，既不导入生产报价，也不替重试策略作新决定。
  const generic = (o: Obs, limit: number, start: number): string[] => {
    const bad: string[] = []; let amount = start * 1000, count = start
    o.served.forEach(({ path, status }, i) => {
      const price = TEST_PRICES[path], seen = o.atSend[i]
      if (price === undefined) { bad.push(`未核端点仍 fetch：${path}`); return }
      if (amount + price > limit) bad.push(`提交越过上限 ${amount}+${price}>${limit}`)
      if (seen?.count !== count) bad.push(`提交时净次数 ${seen?.count} 应为 ${count}，pending 不计次数`)
      if (seen?.occupied !== testUsd(amount + price)) bad.push(`提交前未按端点预留完整金额 ${path}`)
      if (seen?.pending !== testUsd(price)) bad.push(`提交时 pending 未精确等于本次 ${path}`)
      if (status === 200) { count++; amount += price }
    })
    if (o.local !== count) bad.push(`净次数 ${o.local} 应为 ${count}`)
    if (o.occupied !== testUsd(amount)) bad.push(`留存金额 ${o.occupied} 应为 ${testUsd(amount)}`)
    if (o.threw.startsWith('unexpected')) bad.push(o.threw)
    return bad
  }
  const singleGet = (o: Obs, limit: number, start: number): string[] => {
    const bad = generic(o, limit, start), rejected = start * 1000 + 1000 > limit
    if ((o.threw === 'budget-exceeded') !== rejected) bad.push(`拒绝与精确余额不符：${o.threw}`)
    if (rejected && o.served.length) bad.push('不足仍 fetch')
    if (!rejected && (o.threw === '') !== (o.served.at(-1)?.status === 200)) bad.push('200 与正常返回不符')
    if (o.served.slice(0, -1).some(s => s.status === 200)) bad.push('200 之后仍在重试')
    if (o.served.length > 4) bad.push('单次搜索超过既有四次尝试边界')
    return bad
  }
  const sequences = (maxLen: number): number[][] => {
    const out: number[][] = []
    const grow = (prefix: number[]) => { if (prefix.length) out.push(prefix); if (prefix.length < maxLen)
      for (const s of [200, 402, 429, 500]) grow([...prefix, s]) }
    grow([]); return out
  }
  // IG reels→users 各 2000 微美元；4000 的夹具让第二个实际端点也能到达。
  const CASES: [number, number][] = [[0, 0], [1000, 0], [1000, 1], [2000, 0], [2000, 1], [3000, 1], [4000, 0]]
  const searchTikTok = (api: TikHub) => api.search({ keyword: 'k', dimension: 'category', platform: 'tiktok' }, 'US', 0)
  const singleFailures: string[] = []; let exhausted = 0
  for (const [limit, start] of CASES) for (const seq of sequences(4)) {
    const o = await drive(limit, start, seq, searchTikTok)
    if (o.served.length === 4) exhausted++
    for (const why of singleGet(o, limit, start)) singleFailures.push(`${limit}/${start}/[${seq}] ${why}`)
  }
  eq('单次 get() 在全部序列上都合金额与净次数性质', singleFailures.slice(0, 5), [])
  ok('重试耗尽分支确实发生四次 fake fetch', exhausted > 0)
  const METHODS: [string, (api: TikHub) => Promise<unknown>][] = [
    ['search tiktok', searchTikTok],
    ['search instagram', api => api.search({ keyword: 'k', dimension: 'category', platform: 'instagram' }, 'US', 0)],
    ['profile tiktok', api => api.profile('u', 'tiktok')], ['profile instagram', api => api.profile('u', 'instagram')],
    ['recentPosts tiktok', api => api.recentPosts('u', 'tiktok')], ['recentPosts instagram', api => api.recentPosts('u', 'instagram')],
  ]
  const genericFailures: string[] = [], reached = new Set<string>(), paths = new Set<string>()
  for (const [name, call] of METHODS) for (const [limit, start] of CASES) for (const seq of sequences(2)) {
    const o = await drive(limit, start, seq, call)
    if (o.served.length) reached.add(name)
    for (const s of o.served) paths.add(s.path)
    for (const why of generic(o, limit, start)) genericFailures.push(`${name} ${limit}/${start}/[${seq}] ${why}`)
  }
  eq('六个公开方法在全部序列上都合通用不变量', genericFailures.slice(0, 5), [])
  eq('六个方法都实际走过 fake fetch', [...reached].sort(), METHODS.map(([name]) => name).sort())
  eq('重试与 fallback 实际覆盖固定八端点', [...paths].sort(), Object.keys(TEST_PRICES).sort())
  const fine: Obs = { local: 1, occupied: '0.001', threw: '',
    atSend: [{ count: 0, occupied: '0.001', pending: '0.001' }], served: [{ path: TEST_TT, status: 200 }] }
  eq('独立 oracle 接受正确示例', singleGet(fine, 2000, 0), [])
  ok('独立 oracle 拦住先发再预留', generic({ ...fine, atSend: [{ count: 0, occupied: '0', pending: '0' }] }, 2000, 0).length > 0)
  ok('独立 oracle 拦住 pending 冒充净次数', generic({ ...fine, atSend: [{ count: 1, occupied: '0.001', pending: '0.001' }] }, 2000, 0).length > 0)
  ok('独立 oracle 拦住拒绝后多计次数', singleGet({ local: 2, occupied: '0.001', threw: 'budget-exceeded', atSend: [], served: [] }, 1000, 1).length > 0)
  criterion('P3.c')
}

suite('P4', '已联系/屏蔽的人不得进入名单')
{
  const tmp = join(tmpdir(), `kol-p4-${process.pid}.json`)
  writeFileSync(tmp, JSON.stringify({
    version: 1, updated_at: '', creators: {
      'tiktok:contacted': { platform: 'tiktok', handle: 'contacted', nickname: '', followers: 1,
        first_seen: '2026-01-01', recommendations: [], contacted: true, replied: false, blocked: false, note: '' },
      'tiktok:blocked': { platform: 'tiktok', handle: 'blocked', nickname: '', followers: 1,
        first_seen: '2026-01-01', recommendations: [], contacted: false, replied: false, blocked: true, note: '' },
      'tiktok:seen': { platform: 'tiktok', handle: 'seen', nickname: '', followers: 1,
        first_seen: '2026-01-01', recommendations: [{ date: '2026-01-01', product: 'other', keyword: 'k' }],
        contacted: false, replied: false, blocked: false, note: '' },
    },
  }), 'utf8')
  useMemoryFile(tmp)

  const r = filterByMemory(
    [mk('tiktok', 'contacted'), mk('tiktok', 'blocked'), mk('tiktok', 'seen'), mk('tiktok', 'fresh')],
    'thisproduct')

  eq('contacted 被排除', r.kept.some(c => c.handle === 'contacted'), false)
  eq('blocked 被排除', r.kept.some(c => c.handle === 'blocked'), false)
  eq('计入 filtered_contacted', r.filtered_contacted, 2)
  eq('新人保留', r.kept.some(c => c.handle === 'fresh'), true)
  eq('换了产品的旧人保留但标注', r.kept.find(c => c.handle === 'seen')?.previously_recommended, 'other @ 2026-01-01')
  criterion('P4.a')

  unlinkSync(tmp)
  useMemoryFile('memory/creators.json')
}

}
await group('d6-pipeline', async () => {
suite('D6', '续跑要花多少钱，数的是它真会去抓的，不是「不在 done 里的」')
{
  const st = (over: Partial<TaskState> = {}): TaskState => ({
    product: 'p', market: 'US', target_count: 50, budget_usd: 1,
    tasks: [{ keyword: 'a', dimension: 'category', platform: 'tiktok' },
            { keyword: 'b', dimension: 'scene', platform: 'tiktok' }],
    done: [], offsets: {}, requests: 0, created_at: '', updated_at: '', ...over,
  })
  // F9 之后这条口径分成两支：没达标照旧全算；达标之后**只剩「一页都没抓过」的那些**，
  // 因为第一页不受达标判断约束，续跑照样会去抓它们（D6.g 接替退役的 D6.c）。
  eq('没达标 → 剩下的关键词续跑会去抓', keywordsResumeWillRun(st(), 10).length, 2)
  eq('已达标 → 一页都没抓过的仍然会去抓', keywordsResumeWillRun(st(), 50).length, 2)
  eq('超出目标同理', keywordsResumeWillRun(st(), 99).length, 2)
  // 抓过第一页的（offsets 里有这个键）在达标之后就不再翻页了 —— 那是 F9.d 的边界
  eq('已达标 + 都抓过第一页 → 一个都不会抓',
     keywordsResumeWillRun(st({ offsets: { 0: 20, 1: 20 } }), 99).length, 0)
  eq('已达标 + 只有一个没抓过 → 只抓那一个',
     keywordsResumeWillRun(st({ offsets: { 0: 20 } }), 99).length, 1)
  eq('已标记完成的本来就不算', keywordsResumeWillRun(st({ done: [0] }), 10).length, 1)
  eq('已达标时，标记完成的也不算 —— 它抓过了', keywordsResumeWillRun(st({ done: [0] }), 99).length, 1)
  // D6.v：令牌不跨运行 —— 抓过页、不在 done 的 IG 任务续跑一次请求都不发，所以不算进要花钱的那一半
  // （D6.g 写明的例外）。期望只出自 D6.g、D6.v 原文：同样抓过页的 TikTok 照算（按平台分支不是平台配额，
  // F9 × P1），一页都没抓过的 IG 照算（第一页保证）。这种任务正常收尾时已进 done，只在进程被硬杀之后出现。
  {
    const mixed = st({
      tasks: [{ keyword: 'tt', dimension: 'category', platform: 'tiktok' },
              { keyword: 'ig-paged', dimension: 'scene', platform: 'instagram' },
              { keyword: 'ig-fresh', dimension: 'scene', platform: 'instagram' }],
      offsets: { 0: 20, 1: 1 },
    })
    const left = keywordsResumeWillRun(mixed, 10)
    eq('没达标：抓过页、没令牌的 IG 任务续跑不会再请求，不算进要花钱的那一半', left.length, 2)
    ok('没达标：算进去的是抓过页的 TikTok 与没抓过的 IG',
       left.some(l => l.includes('「tt」')) && left.some(l => l.includes('「ig-fresh」'))
         && !left.some(l => l.includes('「ig-paged」')))
    eq('进度口径照旧把没进 done 的 IG 任务列出来', pendingKeywords(mixed).length, 3)
  }
  // F9.e：整张分页记录表缺失 = 无从确认，不发请求。**不是**读成「都没抓过」去重抓一遍。
  // 没达标那一支也要为空 —— #138 评审之前它交回的是「不在 done 里的」全部，
  // 而调度那边一个都不抓，两句话当场对不上。
  eq('无从确认 → 一个都不去抓', keywordsResumeWillRun(st({ offsets: undefined }), 99).length, 0)
  eq('无从确认 + 没达标 → 照样一个都不去抓',
     keywordsResumeWillRun(st({ offsets: undefined }), 0).length, 0)
  // 「没有那个键」和「没有那张表」要给出**不同**的答案，而且不是空集与空集 ——
  // 两种都交回 `[]` 的话，调用方分不出「无从确认」和「没有一个欠着」，
  // 于是没达标那条路直接从 offset 0 重抓，把付过钱的几页再买一遍（#138 评审实测）。
  eq('有表、没有这个键 → 这两个任务都欠着第一页', firstPagePending(st())?.length, 2)
  eq('有表、都抓过 → 空集，不是 null', firstPagePending(st({ offsets: { 0: 20, 1: 20 } }))?.length, 0)
  ok('整张表都没有 → null（无从确认），不是空集也不是全体',
     firstPagePending(st({ offsets: undefined })) === null)
  // pendingKeywords 仍然报「还没跑完的」—— 它服务的是进度，不是花钱
  eq('进度口径不受达标影响', pendingKeywords(st()).length, 2)
  criterion('D6.g')
  criterion('F9.c')
  criterion('F9.e')

  // ── D6.h / D6.m：页数上限跨运行 ─────────────────────────────────────
  // 判定只此一份，调度与「续跑要不要花钱」共用 —— 各写一份的话，先改的那一边
  // 不会报错（`needsProfile` 栽过的同一个形状，ADR-25）。
  eq('表在、有这个键 → 确知抓了几页', pagesFetched(st({ pages: { 0: 3 } }), 0), 3)
  eq('表在、没有这个键、游标里也没有 → 确知一页都没抓过', pagesFetched(st({ pages: {} }), 0), 0)
  // **`null` 不许被压成 0。** 压成 0 的话，上一版留下的目录里每个已经抓过页的词都会
  // 重新拿到一份满配额，而那种目录正是今天用户手上的形状 —— 这条需求对现存数据一条都不管。
  ok('表缺失、游标里有这个键 → null（抓了几页无从确认），不是 0',
     pagesFetched(st({ pages: undefined, offsets: { 0: 9 } }), 0) === null)
  // 游标里没有这个键 ⇒ 没成功拿回过页，这是恒真的（那个键只在 search() 正常返回之后才写），
  // 所以这一条不是推测 —— F9 的第一页保证正靠它在旧目录上活下来。
  eq('表缺失、游标里没有这个键 → 确知 0，第一页保证不受影响（F9）',
     pagesFetched(st({ pages: undefined, offsets: { 0: 9 } }), 1), 0)
  ok('连游标都没有 → null（那时 F9.e 已经让这一跑一个词都不抓，但交回 null 才是实话）',
     pagesFetched(st({ pages: undefined, offsets: undefined }), 0) === null)
  // 盘上那个值是反序列化进来的外部输入 —— 认不出的一律读作无从确认（不多花钱的那一边）。
  // ⚠️ **这几条必须把分页游标留空**：头一版全写成 `offsets: { 0: 9 }`，于是认不出的值
  // 往下掉、被那句「游标里有键 → null」偶然救了回来 —— 断言绿了，而守的那一半没被走到。
  // 游标里**没有**这个键时它会落进 `0`（「确知一页都没抓过」），当场再给一份满配额。
  // 评审指出；M-D6-aa 现在守着「先问键在不在」那一句。
  ok('值不是非负整数 → 读作无从确认，不读作 0',
     pagesFetched(st({ pages: { 0: -1 }, offsets: {} }), 0) === null)
  ok('值是小数 → 同样读作无从确认', pagesFetched(st({ pages: { 0: 1.5 }, offsets: {} }), 0) === null)
  ok('值根本不是数 → 同样读作无从确认',
     pagesFetched(st({ pages: { 0: 'x' } as unknown as Record<number, number>, offsets: {} }), 0) === null)
  ok('值认不出、而游标里有键 → 照样是无从确认（两条路都要通到同一处）',
     pagesFetched(st({ pages: { 0: -1 }, offsets: { 0: 9 } }), 0) === null)
  ok('值认不出、而整张游标都没有 → 同样无从确认',
     pagesFetched(st({ pages: { 0: -1 }, offsets: undefined }), 0) === null)
  // 上限本身要在**边界**上可失败：写成 `<=` 的实现会让第二行红，写成 `<` 的会让第一行红
  ok('还差一页 → 还能翻', underPageCap(st({ pages: { 0: MAX_PAGES - 1 } }), 0))
  ok('正好到上限 → 不能再翻', !underPageCap(st({ pages: { 0: MAX_PAGES } }), 0))
  ok('超过上限（上一版写下的数）→ 同样不能再翻', !underPageCap(st({ pages: { 0: MAX_PAGES + 5 } }), 0))
  ok('无从确认 → 不能再翻，不是「随便翻」', !underPageCap(st({ pages: undefined, offsets: { 0: 9 } }), 0))
  criterion('D6.h')
  criterion('D6.m')
  // F9.d 是范围边界：第一页之后照旧按达标停。上面「都抓过第一页 → 一个都不会抓」
  // 就是它 —— 一条「达标之后继续翻页」的实现会让那一行红（ADR-67 要求边界可失败）。
  // 负片是 M-F9-d：让这份判定不再看「抓没抓过」，只看「标没标完成」。
  // 采集调度用的是同一份判定，所以这一条同时管住入口那一头（自检那条端到端
  // 断言为什么拿不到自己的负片，理由写在 selfcheck.ts 那一段上）。
  criterion('F9.d')

  // ── F9 × D6：续跑会去抓的 ＝ 没抓过第一页的 ∪（未达标时）其余未完成的 ──────
  // 上面那一组断言逐条量的就是这个并集：没达标那一支全算，达标那一支只剩没抓过的，
  // 两支之间不重不漏。D6.c 据此退役、D6.g 接替 —— 判据不改含义、不回收复用（ADR-67）。
  tension('F9', 'D6')

  // ── F9 × P1：不设任何默认的平台配额 ───────────────────────────────────
  // 第一页保证是**按任务**的，对平台一无所知。谁先谁后、哪个平台，都不改变
  // 「这个任务抓过第一页没有」这个判断 —— 它只读 done 与 offsets。
  // 有人往里塞一条「IG 至少留 N 个」的默认配额，下面那几行就红。
  {
    const mixed = (over: Partial<TaskState> = {}): TaskState => st({
      tasks: [{ keyword: 'a', dimension: 'category', platform: 'tiktok' },
              { keyword: 'b', dimension: 'scene', platform: 'instagram' }],
      ...over,
    })
    eq('两个平台各欠一页 → 两个都算，不分平台', firstPagePending(mixed())?.length, 2)
    eq('把 IG 那个抓过 → 只剩 TikTok 那个，平台不影响结论',
       firstPagePending(mixed({ offsets: { 1: 12 } })), [0])
    eq('把 TikTok 那个抓过 → 只剩 IG 那个，同一条规则',
       firstPagePending(mixed({ offsets: { 0: 20 } })), [1])
  }
  tension('F9', 'P1')

  // ── F9 × P3：不超预算 ──────────────────────────────────────────────
  // **这里认领的是单元那一半，说清楚它证了什么、没证什么。**
  // 证了：第一页保证从不把自己报成「免费」—— 还欠着第一页时，那句话照旧说要花钱。
  //       有人为了让「保证」听起来无代价而把这些词从账单里摘掉，下面这行就红。
  // 没证：预算真的用尽时会不会停下来 —— 那是入口捕获 budget-exceeded 的事，
  //       由 F9.b 在自检里端到端跑（退 3、存断点、不为抓齐第一页多花一次）。
  ok('还欠着第一页时，续跑口径说的是要花钱，不是免费',
     keywordsResumeWillRun(st({ offsets: {} }), 99).length === 2)
  tension('F9', 'P3')
}

// 独立于实现写成：期望只出自 ADR-111 第一、二节与 D6.h、F9 的原文，函数体此时只会抛「尚未实现」。
suite('D6', 'IG 续页：这一页之后还能不能带着令牌再翻，这一跑还能不能再请求一页')
{
  const st = (over: Partial<TaskState> = {}): TaskState => ({
    product: 'p', market: 'US', target_count: 50, budget_usd: 1,
    tasks: [{ keyword: 'a', dimension: 'category', platform: 'instagram' },
            { keyword: 'b', dimension: 'scene', platform: 'tiktok' }],
    done: [], offsets: { 0: 12 }, pages: { 0: 1 }, requests: 0, created_at: '', updated_at: '', ...over,
  })
  // 实现之前函数体会抛；接住它，让每一条各自红，而不是整个文件在第一条上崩掉
  const tryIt = <T>(f: () => T): T | 'threw' => { try { return f() } catch { return 'threw' } }
  const after = (page: { token: string | undefined; rawCount: number; parsed: number }, over: Partial<TaskState> = {}) =>
    tryIt(() => igAfterPage(st(over), 0, page))
  const good = { token: 'tok-1', rawCount: 12, parsed: 5 }

  // ── 拿回这一页之后（ADR-111 第二节：在同一次迭代里判） ─────────────────────
  eq('有条目、解析出人、有令牌、没到上限 → 带着这个令牌接着翻', after(good), { next: 'tok-1' })
  eq('令牌原样带上，不替它修剪', after({ ...good, token: ' tok-1 ' }), { next: ' tok-1 ' })
  eq('响应里没有令牌 → 本次没有可继续的令牌', after({ ...good, token: undefined }), { stop: 'no-token' })
  // 空白令牌必须在这里拦下：交给 provider 的话，空串会被当成「没带令牌」只发 keyword ——
  // 那是把首页当续页再买一遍
  eq('令牌是空串 → 同样没有可继续的令牌', after({ ...good, token: '' }), { stop: 'no-token' })
  eq('令牌只有空白 → 同样没有可继续的令牌', after({ ...good, token: '   ' }), { stop: 'no-token' })
  eq('本页 0 条 → 停', after({ ...good, rawCount: 0, parsed: 0 }), { stop: 'empty' })
  eq('本页有条目却一个作者都解析不出 → 停', after({ ...good, rawCount: 8, parsed: 0 }), { stop: 'unparsed' })
  // D6.h 的上限同样管 IG：页数按「这一页已经记上之后」的累计数判，边界两侧都要可失败
  eq('算上这一页还差一页到上限 → 还能翻', after(good, { pages: { 0: MAX_PAGES - 1 } }), { next: 'tok-1' })
  eq('算上这一页正好到上限 → 停', after(good, { pages: { 0: MAX_PAGES } }), { stop: 'cap' })
  // 上一版留下的目录没有页数表：抓了几页无从确认，按不多花钱的那一边停（D6.m）
  eq('已抓页数无从确认 → 停，不是随便翻', after(good, { pages: undefined }), { stop: 'cap' })

  // ── 这一跑还能不能再请求一页（ADR-111 第一节第 2 条：令牌只在一次运行内有效） ─────
  const can = (i: number, token: string | undefined, over: Partial<TaskState> = {}) =>
    tryIt(() => canRequestPage(st(over), i, token))
  eq('IG 一页都没抓过 → 能，没有令牌也能（第一页保证，F9）', can(0, undefined, { offsets: {}, pages: {} }), true)
  eq('IG 抓过、手里有令牌 → 能', can(0, 'tok-1'), true)
  // 续跑时手里没有令牌：已经抓过页、还没进 done 的 IG 任务不再翻页
  eq('IG 抓过、手里没有令牌 → 不能', can(0, undefined), false)
  eq('TikTok 抓过、没有令牌 → 能，它按 offset 翻，不看令牌', can(1, undefined, { offsets: { 1: 20 } }), true)
  eq('TikTok 一页都没抓过 → 能', can(1, undefined), true)
  eq('IG 已进 done → 不能，有令牌也不能', can(0, 'tok-1', { done: [0] }), false)
  eq('TikTok 已进 done → 不能', can(1, undefined, { done: [1] }), false)
  // F9.e：整张分页记录表缺失 = 无从确认哪些查过，一个都不抓 —— 两个平台同一条
  eq('分页记录表整张缺失 → IG 不能', can(0, 'tok-1', { offsets: undefined }), false)
  eq('分页记录表整张缺失 → TikTok 也不能', can(1, undefined, { offsets: undefined }), false)
}

suite('D6', '收尾那句话说的是「续跑要不要花钱」—— 两支都得算出来，不能写死')
{
  const st = (over: Partial<TaskState> = {}): TaskState => {
    const state = {
    product: 'p', market: 'US', target_count: 50, budget_usd: 1,
    tasks: [{ keyword: 'a', dimension: 'category', platform: 'tiktok' },
            { keyword: 'b', dimension: 'scene', platform: 'tiktok' }],
    done: [], offsets: {}, requests: 0, created_at: '', updated_at: '', ...over,
    } as TaskState
    startBudget(state, 1_000_000, 'task', () => {})
    return state
  }
  // 补全过的人：简介查过了、也有外链，`needsProfile` 认他不用再补
  const done1 = mk('tiktok', 'a', { bio: '有简介', bio_links: ['https://x'] })
  const todo1 = mk('tiktok', 'b', { bio: undefined })
  // F9 之后「关键词那一半为零」要两个条件：达标，**并且**每个任务都抓过第一页。
  // 夹具默认把两个任务的 offsets 都记上 —— 否则 qualified 再高，续跑也还欠着第一页。
  // ⚠️ offsets 用 `'offsets' in o` 判缺省，**不能用 `??`** —— 这张表本身就是三态的，
  // 而 `o.offsets ?? 默认值` 会把「显式传 undefined＝无从确认」吞回默认值，
  // 于是想测第三支的断言测到的是第二支（实测：四条红三条、还有一条因此假绿）。
  // 同一个形状正是 F9.e 要治的那件事，夹具自己先栽了一次。
  const line = (o: { qualified?: number; done?: number[]; creators?: Creator[]
                     offsets?: Record<number, number> } = {}) =>
    resumeCostLine('out/x',
                   st({ done: o.done ?? [], offsets: 'offsets' in o ? o.offsets : { 0: 20, 1: 20 } }),
                   o.qualified ?? 10, o.creators ?? [done1])

  // 说反了的代价不对称：说成「不花钱」，账单在用户不知情时又长一截；说成
  // 「要花钱」，用户不敢续跑，那份已经付过钱的名单就永远拿不到（负片 M-D6-f）。
  ok('还有关键词 → 说要继续花钱', line().includes('续跑会继续发请求、继续花钱'))
  // 关键词全跑完不等于不花钱：只要还有人没补 profile，续跑第一件事就是去发
  // 付费请求。只数关键词那一半会把这一种漏成「不花钱」（负片 M-D6-g、M-D6-h）。
  ok('关键词跑完了但还有人要补 profile → 仍然说要花钱',
    line({ qualified: 99, creators: [done1, todo1] }).includes('续跑会继续发请求、继续花钱'))
  ok('两样都还有 → 两样都点名',
    line({ creators: [done1, todo1] }).includes('2 个关键词、1 个人的 profile'))
  ok('两样都没有了 → 才说不产生新的请求',
    line({ qualified: 99 }).includes('续跑不产生新的请求'))
  // 关键词那一半按「续跑真会去抓的」数（D6.g）。判据数的是**调用那一刻**的 qualified，
  // 不是 stopped 的取值 —— 达标停下之后补全会把粉丝数写回，那个数可能掉回目标以下，
  // 于是续跑照样去抓（ADR-94 第十三节）。下面几处传的 qualified 高于 target_count。
  ok('达标 + 都抓过第一页 → 那些关键词不算还剩的活',
    !line({ qualified: 99 }).includes('个关键词'))
  // F9：达标也盖不住还欠着的第一页 —— 这一句要如实说它还要花钱（负片 M-F9-c）
  ok('达标但还欠着第一页 → 仍然说要花钱',
    line({ qualified: 99, offsets: {} }).includes('续跑会继续发请求、继续花钱'))
  // 两支都要把结果放在哪儿说清楚 —— 「不会重新抓」「结果都在」指的都是它
  ok('还有活时也说清已抓到的在哪', line().includes('out/x'))
  ok('没活时同样说清结果在哪', line({ qualified: 99 }).includes('out/x'))

  // F9.e：整张分页记录表缺失是**第三支**，不能落进上面那两支里的任何一支。
  // 关键词那一半确实为零，但理由是「无从确认」—— 说成「采集与补全都已跑完」
  // 就是把它读成「都查过了」，那是 F9.e 逐字禁的第二种误读（#138 评审指出）。
  const unknown = (o = {}) => line({ offsets: undefined, qualified: 99, ...o })
  ok('无从确认 → 说出「没有分页记录」', unknown().includes('没有分页记录'))
  ok('无从确认 → 不能说成都跑完了', !unknown().includes('采集与补全都已跑完'))
  ok('无从确认 → 说清为什么不抓：免得重抓已付过钱的词',
     unknown().includes('已经付过钱'))
  // profile 那一半照旧说话 —— 关键词不抓不等于续跑免费（同 D6.d）
  ok('无从确认但还有人要补 profile → 仍然说要花钱',
     unknown({ creators: [done1, todo1] }).includes('续跑会继续发请求、继续花钱'))
  ok('无从确认且没人要补 → 说不会有新请求，但理由仍是无从确认',
     unknown().includes('也不会有新的请求') && unknown().includes('无从确认'))
  criterion('F9.e')
  for (const [name, state] of [
    ['历史缺账', { ...st(), cost_ledger: undefined }],
    ['根预算冲突', readCostDocument<TaskState>(JSON.stringify({
      ...JSON.parse(stringifyCostJson(st())), budget_usd: 2,
    }))],
  ] as [string, TaskState][]) {
    const text = resumeCostLine('out/x', state, 10, [done1, todo1])
    ok(`${name}仍说出待查量`, text.includes('2 个关键词、1 个人的 profile'))
    ok(`${name}不承诺续跑即可花钱`, !text.includes('续跑会继续发请求、继续花钱'))
    ok(`${name}说出费用阻止原因`, /费用|账|预算/.test(text) && /未知|无从|不可|缺|冲突|不一致|阻止/.test(text))
  }
  criterion('D6.q')
}

suite('D6', '「还要不要补 profile」只有一个判定 —— 补全循环与「续跑要花多少钱」共用它')
{
  const c = (over: Partial<Creator>) => mk('tiktok', 'x', over)
  ok('bio 未查询 → 还要补', needsProfile(c({ bio: undefined })))
  ok('查过了但没有外链 → 还要补', needsProfile(c({ bio: '简介', bio_links: [] })))
  eq('查过且有外链 → 不用再补', needsProfile(c({ bio: '简介', bio_links: ['https://x'] })), false)
  // 这个判定决定要不要花钱：关键词全跑完了，只要还有人没补 profile，
  // 续跑第一件事就是去发付费请求（负片 M-D6-d）。关键词那一半是 D6.g，
  // 在上一个 suite（负片 M-D6-e）—— 两种活坏在不同的地方，所以是两条判据。
  criterion('D6.p')
}

suite('D6', '续跑不得被本任务自己上一轮的产出滤空')
{
  const tmp = join(tmpdir(), `kol-d6-${process.pid}.json`)
  const entry = (h: string, task: string) => ({
    platform: 'tiktok', handle: h, nickname: '', followers: 1, first_seen: '2026-01-01',
    recommendations: [{ date: '2026-01-01', product: 'ring', keyword: 'k', task }],
    contacted: false, replied: false, blocked: false, note: '',
  })
  writeFileSync(tmp, JSON.stringify({
    version: 1, updated_at: '',
    creators: { 'tiktok:mine': entry('mine', 'ring-202601010000'),
                'tiktok:theirs': entry('theirs', 'ring-202512310000') },
  }), 'utf8')
  useMemoryFile(tmp)

  const r = filterByMemory([mk('tiktok', 'mine'), mk('tiktok', 'theirs')],
                           'ring', 'ring-202601010000')
  ok('本任务上一轮推荐过的人仍保留', r.kept.some(c => c.handle === 'mine'))
  eq('别的任务为同一产品推荐过的仍排除', r.kept.some(c => c.handle === 'theirs'), false)
  eq('只有跨任务的那条计入 filtered_recommended', r.filtered_recommended, 1)

  // 不传 task（render 之外的调用方）时退化为旧行为：一律排除
  const legacy = filterByMemory([mk('tiktok', 'mine')], 'ring')
  eq('不传 task 时同产品一律排除', legacy.kept.length, 0)
  // D4 × D6 的交点：记忆去重（D4）撞上续跑（D6）时，让步的是去重 ——
  // 本任务自己上一轮写下的推荐不参与过滤。否则 render 之后每次续跑都会把
  // 已经付钱采过的人判成「已推荐过」，交出一份空名单（ADR-08）。
  tension('D4', 'D6')

  unlinkSync(tmp)
  useMemoryFile('memory/creators.json')
}

// ─────────────────── 管线：单步都对，错的是组合方式 ───────────────────

suite('P1', '收尾管线：合并必须在粉丝闸门之前')
{
  useMemoryFile(join(tmpdir(), `kol-none-${process.pid}.json`))
  // 单平台各 3000 都够不到 5000 下限，合起来 6000 够线
  const r = finalize([mk('tiktok', 'duo', { followers: 3000 }),
                      mk('instagram', 'duo', { followers: 3000 })], 'p')
  eq('合并后过线的人保住了', r.kept.length, 1)
  eq('粉丝数取两平台之和', r.kept[0]?.followers, 6000)
  eq('识别出一对同人', r.linked, 1)

  // 反过来，合起来仍不够线的照样滤掉
  const low = finalize([mk('tiktok', 'tiny', { followers: 500 }),
                        mk('instagram', 'tiny', { followers: 500 })], 'p')
  eq('合并后仍不够线的仍滤掉', low.kept.length, 0)
  covered.add('D3')
}

suite('D6', '收尾管线不得修改传入的累加器数据')
{
  useMemoryFile(join(tmpdir(), `kol-none-${process.pid}.json`))
  const raw = [mk('tiktok', 'sam', { followers: 3000 }),
               mk('instagram', 'sam', { followers: 3000 })]
  const snapshot = JSON.parse(JSON.stringify(raw))
  finalize(raw, 'p')
  // 累加器只增不减是结构性保证，不该依赖调用方记得先落盘再调用
  eq('传入对象未被就地合并/打标', raw, snapshot)
}

suite('P4', '收尾管线：闸门在记忆过滤之前，不虚报打扰规模')
{
  const tmp = join(tmpdir(), `kol-order-${process.pid}.json`)
  writeFileSync(tmp, JSON.stringify({
    version: 1, updated_at: '', creators: {
      // 这人联系过，但粉丝数根本过不了闸门 —— 不该计入「因联系过而排除」
      'tiktok:tinycontacted': { platform: 'tiktok', handle: 'tinycontacted', nickname: '',
        followers: 1, first_seen: '2026-01-01', recommendations: [],
        contacted: true, replied: false, blocked: false, note: '' },
      'tiktok:bigcontacted': { platform: 'tiktok', handle: 'bigcontacted', nickname: '',
        followers: 1, first_seen: '2026-01-01', recommendations: [],
        contacted: true, replied: false, blocked: false, note: '' },
    },
  }), 'utf8')
  useMemoryFile(tmp)

  const r = finalize([mk('tiktok', 'tinycontacted', { followers: 10 }),
                      mk('tiktok', 'bigcontacted', { followers: 50000 })], 'p')
  eq('只数过得了闸门的那一个', r.filtered_contacted, 1)
  eq('两人都不在名单里', r.kept.length, 0)
  unlinkSync(tmp)
  useMemoryFile('memory/creators.json')
}

})
await group('d4-memory', () => {
suite('D4', '记忆不可用分三档：不存在 / 读不出来 / 显式跳过')
{
  // 这一族的临时文件放进**本次运行独有**的目录，不直接摊在系统临时目录上。
  // 摊在外面时文件名只能靠进程号划范围，而进程号会被系统回收重发：一次跑弄坏了孤儿
  // 清理、留下 `…<pid>.json.999999.tmp`，将来某次跑抽到同一个号，下面那条
  // 「不留下半成品」就凭空判红。而对不点名的那一大批变异，判定只问「这一跑有没有红」、
  // 不问「红的是哪一条」（`judgeRun` 里 `kills === undefined` 直接给 `caught`）——
  // 于是一条本该**存活**的变异会被记成被抓到。**那是假绿，不是假红。**
  // 实测这台机器上已经攒了 99 个这样的孤儿，而 pid_max 是 32768。
  // 换成一次一个独有目录，孤儿留在自己那份里，结构上撞不着未来任何一次跑（与自检同一路数）。
  const d4Dir = mkdtempSync(join(tmpdir(), 'kol-d4-'))
  const tmp = join(d4Dir, 'creators.json')
  const person = (h: string, over: Record<string, unknown> = {}) => ({
    platform: 'tiktok', handle: h, nickname: h, followers: 50000, first_seen: '2026-01-01',
    recommendations: [], contacted: false, replied: false, blocked: false, note: '', ...over,
  })
  const batch = [mk('tiktok', 'alice'), mk('tiktok', 'erin')]

  // 一、文件不存在 = 查过，记忆里确实没有人
  useMemoryFile(join(tmpdir(), `kol-d4-none-${process.pid}.json`))
  const absent = filterByMemory(batch, 'p')
  eq('文件不存在时报 absent', absent.memory_status, 'absent')
  eq('文件不存在时全员保留', absent.kept.length, 2)

  // 二、读不出来 = 没查到。**不得与上一档同值**
  writeFileSync(tmp, JSON.stringify({
    version: 1, updated_at: '', creators: { 'tiktok:alice': person('alice', { contacted: true }) },
  }), 'utf8')
  truncateSync(tmp, Math.floor(rf(tmp, 'utf8').length * 0.6))
  const broken = rf(tmp, 'utf8')
  useMemoryFile(tmp)

  let threw = ''
  try { filterByMemory(batch, 'p') } catch (e) { threw = (e as Error).name }
  eq('读不出来时抛出而不是返回名单', threw, 'MemoryUnreadable')

  // 三、显式跳过 = 出名单，但状态必须说出去
  const ignored = filterByMemory(batch, 'p', undefined, { ignoreUnreadable: true })
  eq('显式跳过时出名单', ignored.kept.length, 2)
  eq('显式跳过不得伪装成 absent', ignored.memory_status, 'unreadable_ignored')

  // 四、读不出来时绝不写回 —— 盖掉它就永久抹掉了「谁联系过」
  const wb = recordRecommendations(ignored.kept, 'p')
  eq('读不出来时不写回', wb.written, false)
  eq('磁盘上仍是那份读不出来的文件，一个字节没动', rf(tmp, 'utf8'), broken)

  // D4 × P4 的交点：记忆读不出来时让步的是 D4（出名单这件事）—— 不产出名单，
  // 显式跳过才继续，且状态必须说出去；任何情况下都不得拿一份读不出来的记忆
  // 盖掉原文件，盖掉就永久抹掉了「谁联系过」（ADR-15）。上面二、三、四三段是它的三头。
  tension('D4', 'P4')

  // 五、解析成功不等于形状对。这个文件是产品要求运营手改的，
  //     手改很容易改出一份合法 JSON、错误结构的记忆（ADR-19）。
  const shapes: Array<[string, string]> = [
    ['creators 是数组', '{"version":1,"creators":[]}'],
    ['顶层是数组', '[]'],
    ['条目缺 contacted', JSON.stringify({ version: 1, creators: {
      'tiktok:a': { recommendations: [] } } })],
    ['contacted 写成字符串', JSON.stringify({ version: 1, creators: {
      'tiktok:a': { contacted: 'true', blocked: false, recommendations: [] } } })],
    ['recommendations 不是数组', JSON.stringify({ version: 1, creators: {
      'tiktok:a': { contacted: false, blocked: false, recommendations: null } } })],
    // 容器对了不等于里面的东西对：过滤逐条读 task / product / date
    ['推荐记录是空对象', JSON.stringify({ version: 1, creators: {
      'tiktok:a': { contacted: false, blocked: false, recommendations: [{}] } } })],
    ['推荐记录是 null', JSON.stringify({ version: 1, creators: {
      'tiktok:a': { contacted: false, blocked: false, recommendations: [null] } } })],
    ['推荐记录缺 date', JSON.stringify({ version: 1, creators: {
      'tiktok:a': { contacted: false, blocked: false,
        recommendations: [{ product: 'p' }] } } })],
    ['推荐记录的 task 不是字符串', JSON.stringify({ version: 1, creators: {
      'tiktok:a': { contacted: false, blocked: false,
        recommendations: [{ product: 'p', date: '2026-01-01', task: 7 }] } } })],
    // 键本身也得能用：查询侧按 platform:handle 小写化去找，
    // 一个找不到的键是个静默的黑洞
    ['键没有冒号', JSON.stringify({ version: 1, creators: {
      alice: { contacted: true, blocked: false, recommendations: [] } } })],
    ['键的 handle 是空的', JSON.stringify({ version: 1, creators: {
      'tiktok:': { contacted: true, blocked: false, recommendations: [] } } })],
    ['两个键指同一个人', JSON.stringify({ version: 1, creators: {
      'tiktok:Alice': { contacted: true, blocked: false, recommendations: [] },
      'tiktok:alice': { contacted: false, blocked: false, recommendations: [] } } })],
    // 「有个冒号」远不够：查询侧生成的键是什么形状，这里就得要求什么形状（ADR-25）
    ['键的平台拼错了', JSON.stringify({ version: 1, creators: {
      'tikok:a': { contacted: true, blocked: false, recommendations: [] } } })],
    ['键的平台不在支持范围内', JSON.stringify({ version: 1, creators: {
      'youtube:a': { contacted: true, blocked: false, recommendations: [] } } })],
    ['键里多一个分隔符', JSON.stringify({ version: 1, creators: {
      'tiktok:a:old': { contacted: true, blocked: false, recommendations: [] } } })],
    // 同一间屋子的第四扇门：两边非空、平台也对，只差一个空格，
    // 平台不允许用户名带空白，所以带空白的键只可能来自手改（ADR-32）。
    // **不写成「查询侧永远不会生成带空白的键」** —— 查询侧照单全收，
    // 拦住它的是写入侧的校验和这里的读入校验（ADR-22 追记）
    ['键的 handle 尾部带空格', JSON.stringify({ version: 1, creators: {
      'tiktok:a ': { contacted: true, blocked: true, recommendations: [] } } })],
    ['键的 handle 头部带空格', JSON.stringify({ version: 1, creators: {
      'tiktok: a': { contacted: true, blocked: true, recommendations: [] } } })],
    ['键的 handle 中间带空格', JSON.stringify({ version: 1, creators: {
      'tiktok:a b': { contacted: true, blocked: true, recommendations: [] } } })],
    ['键里带制表符', JSON.stringify({ version: 1, creators: {
      'tiktok:a\t': { contacted: true, blocked: true, recommendations: [] } } })],
  ]
  // 字面重复的键**构造不出来**：对象字面量和 JSON.stringify 都只留一条。
  // 而手改的文件里它就是两行 —— 解析会静默吃掉前一条（ADR-36）。
  const dupText = `{"version":1,"creators":{
    "tiktok:a":{"contacted":true,"blocked":true,"recommendations":[]},
    "tiktok:a":{"contacted":false,"blocked":false,"recommendations":[]}}}`
  shapes.push(['同一个键在文件里出现了两次', dupText])
  // 数组里的对象各有各的层，别把不同对象的同名键算成重复
  shapes.push(['嵌套对象里的重复键也算', `{"version":1,"creators":{
    "tiktok:a":{"contacted":true,"blocked":true,"contacted":false,"recommendations":[]}}}`])
  // handle 的形状不是拍的：展示时前面才加 @，链接里它是裸的路径段（ADR-37）。
  // 连字符也在此列：两家平台的用户名都没有它
  for (const bad of ['@a', 'a/b', 'a?x', 'a%63', 'a#b', 'a-b']) {
    shapes.push([`键的 handle 是展示形态或含 URL 字符（${bad}）`, JSON.stringify({ version: 1, creators: {
      [`tiktok:${bad}`]: { contacted: true, blocked: true, recommendations: [] } } })])
  }
  // 类型对不等于能用：空 product 永远匹配不上任何产品，这条去重记录等于不存在。
  // 全是空白的和不是字符串的一样不行 —— 判据只有一份（types.ts），两侧都问它。
  for (const [f, v] of
    [['product', ''], ['date', ''], ['product', '   '], ['date', 7]] as const) {
    shapes.push([`推荐记录的 ${f} 是 ${JSON.stringify(v)}`, JSON.stringify({ version: 1, creators: {
      'tiktok:a': { contacted: false, blocked: false, recommendations:
        [{ product: 'p', date: '2026-01-01', [f]: v }] } } })])
  }
  // 读不到（不是解析不了）时，报错不许说成「解析失败」—— 权限或路径出问题的人
  // 会去查一份完好的 JSON。真实原因在 detail 里，它自己会说（ADR-44）。
  {
    // tmp 本身是个文件，拿它当父路径必定 ENOTDIR —— 一个纯粹的路径问题
    writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
    useMemoryFile(join(tmp, 'x.json'))
    let msg = ''
    try { filterByMemory(batch, 'p') } catch (e) { msg = (e as Error).message }
    ok('读不到时报的不是「解析失败」', msg.length > 0 && !msg.includes('解析失败'))
    ok('而是把真实原因原样带出来', msg.includes('ENOTDIR'))
    useMemoryFile(tmp)
  }

  for (const [label, content] of shapes) {
    writeFileSync(tmp, content, 'utf8')
    let caught = ''
    try { filterByMemory(batch, 'p') } catch (e) { caught = (e as Error).name }
    eq(`合法 JSON 但${label} → 当作读不出来`, caught, 'MemoryUnreadable')
  }
  // 但不做全量 schema：运营自己加的字段不该被判成损坏
  writeFileSync(tmp, JSON.stringify({ version: 1, creators: { 'tiktok:a': {
    contacted: false, blocked: false, 我的备注: '随手写的',
    recommendations: [{ product: 'p', date: '2026-01-01', 我的批注: '记一笔' }] } } }), 'utf8')
  eq('多出来的自定义字段不算损坏', filterByMemory(batch, 'p').memory_status, 'ok')

  // 六、读不到但**不是**「文件不存在」—— 权限、父路径不是目录、IO 错误。
  //     existsSync 对这些统统返回 false，拿它分档等于把三档压回两档（ADR-26）。
  const notADir = join(tmpdir(), `kol-d4-notadir-${process.pid}`)
  writeFileSync(notADir, '我是文件，不是目录', 'utf8')
  useMemoryFile(join(notADir, 'creators.json'))
  let enoentish = ''
  try { filterByMemory(batch, 'p') } catch (e) { enoentish = (e as Error).name }
  eq('读不到但不是「不存在」→ 当作读不出来，不是空记忆', enoentish, 'MemoryUnreadable')
  unlinkSync(notADir)
  // 真正不存在的文件仍然是 absent
  useMemoryFile(join(tmpdir(), `kol-d4-really-none-${process.pid}.json`))
  eq('文件真的不存在 → 仍然是 absent', filterByMemory(batch, 'p').memory_status, 'absent')
  useMemoryFile(tmp)

  // 下面几段的失败模式是「记忆被自己写的东西毒掉、下一次读抛出来」。抛出来要变成一个
  // 能断言的值 —— 否则那条变异是靠测试进程崩溃「被抓到」的，而崩溃不是断言的功劳
  // （变异判定把「崩溃」和「断言红」分成两态，见 mutate-rule.ts）。
  const statusOf = (f: () => { memory_status: string }): string => {
    try { return f().memory_status } catch (e) { return `抛了：${(e as Error).name}` }
  }
  const writeOf = (f: () => ReturnType<typeof recordRecommendations>) => {
    try { return { ...f(), threw: '' } } catch (e) { return { written: true, threw: (e as Error).name } as const }
  }

  // 七、product 的首尾空白不该让「已推荐过」失效。**不判成损坏** ——
  //     product 来自用户的任务配置，配置里多一个空格就把我们自己写下的
  //     记忆判成读不出来，那是自伤。纯空白仍然算损坏（trim 之后是空的）。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {
    'tiktok:pad': { contacted: false, blocked: false,
      recommendations: [{ product: ' Foo ', date: '2026-01-01' }] } } }), 'utf8')
  // 打开 ignoreUnreadable 不是放松要求，是为了让「判成损坏」变成一个能断言的值：
  // 默认那条路是抛，抛出来测试进程就崩了，而崩溃不是断言的功劳（同上）。
  // 代价原样带在 memory_status 上，下面第三条就盯着它。
  const padded = filterByMemory([mk('tiktok', 'pad')], 'Foo', undefined, { ignoreUnreadable: true })
  eq('产品名两侧的空白不影响「已推荐过」', padded.filtered_recommended, 1)
  eq('于是那个人不会被再推荐一次', padded.kept.length, 0)
  // 后半句「不判为损坏」单独断言，但**不是**因为上面两条抓不到它：负片
  // M-D4-ag 让读取侧把带空白的产品名判成损坏，readMemory 返回 unreadable，
  // 上面两条也一起红。它们红得不好读 —— 报的是「没去重」，真正坏的是
  // 「读不出来」。这一条把状态钉住，坏因才写在脸上。（前半句的负片是
  // M-D4-af：只让比较不去空白，状态仍是 ok，就靠上面两条抓。）
  eq('而且没把这份记忆判成损坏', padded.memory_status, 'ok')
  criterion('D4.q')

  // 七之一、反过来的那一半：记忆里存的是干净的，空白在**任务配置**这一侧。
  //        两半坏在不同的行 —— 上面那半坏在比较处的 r.product.trim()（负片
  //        M-D4-af），这半坏在入口的 want（负片 M-D4-ah）。只压上面那半时，
  //        把入口的 trim 去掉，上面三条断言全是绿的：存的干净、查的也干净，
  //        谁都不动它。所以这是独立的一条判据，不是同一条的另一种说法。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {
    'tiktok:cfg': { contacted: false, blocked: false,
      recommendations: [{ product: 'Foo', date: '2026-01-01' }] } } }), 'utf8')
  const padQuery = filterByMemory([mk('tiktok', 'cfg')], '  Foo  ', undefined, { ignoreUnreadable: true })
  eq('任务配置里的空白同样不影响「已推荐过」', padQuery.filtered_recommended, 1)
  eq('于是那个人也不会被再推荐一次', padQuery.kept.length, 0)
  eq('这一侧同样不算损坏', padQuery.memory_status, 'ok')
  criterion('D4.r')

  // 七之二、名单和它的去重状态：**哪个先写都不安全**，取决于状态往哪边变。
  //        ok → unreadable_ignored 时名单先写会坏；unreadable_ignored → ok 时
  //        状态先写会坏。两种坏法一样：报告压掉警告，把打扰过的人当成已去重
  //        交付出去。所以分三步，肯定的断言最后写（ADR-41）。
  {
    const d = join(tmpdir(), `kol-d4-persist-${process.pid}`)
    rmSync(d, { recursive: true, force: true })
    mkdirSync(d, { recursive: true })
    // 用一个同名目录占住 creators.json —— 写它必定失败，模拟「名单没落成」
    mkdirSync(join(d, 'creators.json'))
    const st = readCostDocument<TaskState>(JSON.stringify({ product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1,
      memory_status: 'unreadable_ignored' }))
    let threw = false
    try { persistListAndStatus(d, st, [mk('tiktok', 'zoe')], 'ok') } catch { threw = true }
    ok('名单写不进去时确实抛出来', threw)
    eq('而盘上的状态停在「无从确认」，不是刚要断言的那个 ok',
      existsSync(join(d, 'task.json')) ? JSON.parse(rf(join(d, 'task.json'), 'utf8')).memory_status : '（没有 task.json）',
      'unknown')
    rmSync(d, { recursive: true, force: true })
  }
  // 都落成时才断言
  {
    const d = join(tmpdir(), `kol-d4-persist2-${process.pid}`)
    rmSync(d, { recursive: true, force: true })
    const st = readCostDocument<TaskState>(JSON.stringify({ product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1,
      memory_status: 'unreadable_ignored' }))
    persistListAndStatus(d, st, [mk('tiktok', 'zoe')], 'ok')
    eq('两边都落成时，状态才是那个肯定的断言',
      JSON.parse(rf(join(d, 'task.json'), 'utf8')).memory_status, 'ok')
    eq('名单也确实换了', JSON.parse(rf(join(d, 'creators.json'), 'utf8')).length, 1)
    rmSync(d, { recursive: true, force: true })
  }

  // 七之三、写不进去也是「没写回」，不是「交付失败」。
  //     这一步跑在报告之前，让它抛会把算好的名单连同报告一起丢掉，
  //     而原文件本来就完好 —— 真实损失只有这一轮的记录（ADR-19）。
  // 要的是**读得出来但写不进去**：在写回用的临时文件名上放一个目录，
  // 于是读照常成功，写必然失败（容器里跑 root，chmod 拦不住写）。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  const blocker = `${tmp}.${process.pid}.tmp`
  // 上一次被杀在半路的进程可能留下同名文件，而 pid 会被复用 —— 先清掉，别让 mkdir 撞上它
  rmSync(blocker, { recursive: true, force: true })
  mkdirSync(blocker, { recursive: true })
  eq('这一步记忆仍然读得出来', filterByMemory(batch, 'p').memory_status, 'ok')
  const blocked = writeOf(() => recordRecommendations([mk('tiktok', 'erin')], 'p'))
  eq('写不进去时不抛', blocked.threw, '')
  eq('而是报「没写回」', blocked.written, false)
  ok('并带上原因', !blocked.written && blocked.reason.length > 0)
  ok('原文件没被动过', JSON.parse(rf(tmp, 'utf8')).creators.erin === undefined)
  rmSync(blocker, { recursive: true, force: true })

  // 七之三之二、临时名上已经有东西时**不复用它**。带着这个 pid 死掉的前任留下的
  //     临时文件权限已经被调宽，而 Node 对已存在的文件忽略 mode —— 复用它，这次的
  //     内容就在宽权限下敞开着写；它还可能是条软链，跟着写就落到别处去了。
  //     同名的只可能是死掉的前任留下的：删掉重建，写回照常成功。
  {
    const elsewhere = join(tmpdir(), `kol-d4-elsewhere-${process.pid}.json`)
    writeFileSync(elsewhere, '别处的文件', 'utf8')
    writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
    const planted = `${tmp}.${process.pid}.tmp`
    rmSync(planted, { recursive: true, force: true })
    symlinkSync(elsewhere, planted)
    const r = writeOf(() => recordRecommendations([mk('tiktok', 'erin')], 'p'))
    eq('临时名上有残留时删掉重建，写回照常成功', r.written, true)
    eq('没有顺着残留的软链写到别处去', rf(elsewhere, 'utf8'), '别处的文件')
    ok('写回的是一个普通文件', !lstatSync(tmp).isSymbolicLink())
    ok('内容是这一次写的', JSON.parse(rf(tmp, 'utf8')).creators['tiktok:erin'] !== undefined)
    rmSync(planted, { force: true }); rmSync(elsewhere, { force: true })
  }

  // 七之三之三、交付物同样走整体替换：kol.csv / kol.xlsx 写到一半被打断时，上一份
  //     完整的还在 —— D4 说的是任务目录里的**每个**文件，不只是 task.ts 管的那几个
  //     （评审第二轮）。
  {
    const dd = join(tmpdir(), `kol-d4-deliv-${process.pid}`)
    rmSync(dd, { recursive: true, force: true }); mkdirSync(dd, { recursive: true })
    const csvP = join(dd, 'kol.csv'), xlsxP = join(dd, 'kol.xlsx')
    const sheet = (v: string) => [{ name: 'S', headers: ['a'], rows: [[v]] }]
    writeCsv(csvP, ['a'], [['旧']]); writeXlsx(xlsxP, sheet('旧'))
    const csvBefore = rf(csvP, 'utf8'), xlsxBefore = rf(xlsxP)
    mkdirSync(`${csvP}.${process.pid}.tmp`); mkdirSync(`${xlsxP}.${process.pid}.tmp`)
    let csvThrew = false, xlsxThrew = false
    try { writeCsv(csvP, ['a'], [['新']]) } catch { csvThrew = true }
    try { writeXlsx(xlsxP, sheet('新')) } catch { xlsxThrew = true }
    ok('kol.csv 写不进去时抛出来', csvThrew)
    eq('而上一份 kol.csv 一个字节没动', rf(csvP, 'utf8'), csvBefore)
    ok('kol.xlsx 写不进去时抛出来', xlsxThrew)
    ok('而上一份 kol.xlsx 一个字节没动', rf(xlsxP).equals(xlsxBefore))
    rmSync(dd, { recursive: true, force: true })
  }

  // 任务目录走的是同一份整体替换：写不进去时原来那份一个字节不动
  {
    const d = join(tmpdir(), `kol-d4-atomic-${process.pid}`)
    rmSync(d, { recursive: true, force: true })
    const st = readCostDocument<TaskState>(JSON.stringify({ product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1,
      memory_status: 'ok' }))
    saveTask(d, st)
    const before = rf(join(d, 'task.json'), 'utf8')
    // 拿一个同名目录占住临时文件名，写入必定失败
    mkdirSync(join(d, `task.json.${process.pid}.tmp`), { recursive: true })
    let threw = false
    try { saveTask(d, readCostDocument<TaskState>(JSON.stringify({ ...st, product: '改过的' }))) } catch { threw = true }
    ok('任务目录写不进去时抛出来', threw)
    eq('而原来那份 task.json 一个字节没动', rf(join(d, 'task.json'), 'utf8'), before)
    ok('它仍然解析得出来', (() => {
      try { JSON.parse(rf(join(d, 'task.json'), 'utf8')); return true } catch { return false }
    })())
    rmSync(d, { recursive: true, force: true })
  }

  // 读权限位：文件不在了就把「没了」当成一个值带回来 —— 让它作为断言失败被抓到，
  // 不是让测试进程死在 statSync 上
  const modeOf = (p: string): number | string => existsSync(p) ? statSync(p).mode & 0o777 : '（文件没了）'
  // 七之四、写回不许悄悄放开权限。按 umask 建的临时文件（通常 0644）改名之后
  //        会把这个权限一并装到目标上 —— 特意 chmod 600 过的记忆每写回一次
  //        就被放开一次，而它记着谁联系过、备注写了什么（ADR-40）。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  chmodSync(tmp, 0o600)
  recordRecommendations([mk('tiktok', 'erin')], 'p')
  eq('写回保留目标文件原有的权限位', modeOf(tmp), 0o600)
  // 再验一个**不等于临时文件那档**的权限：临时文件是按最严建的，
  // 只断言 0600 的话，「建得严」和「事后调回目标」这两件事分不开 ——
  // 删掉后者，测试照样绿
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  chmodSync(tmp, 0o640)
  recordRecommendations([mk('tiktok', 'erin')], 'p')
  eq('目标比临时文件宽时也照样还原，不是停在最严那一档', modeOf(tmp), 0o640)
  {
    const d2 = join(tmpdir(), `kol-d4-mode-${process.pid}`)
    rmSync(d2, { recursive: true, force: true })
    const st2 = readCostDocument<TaskState>(JSON.stringify({ product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1 }))
    saveTask(d2, st2)
    chmodSync(join(d2, 'task.json'), 0o640)
    saveTask(d2, st2)
    eq('任务目录的落盘同样保住权限位', modeOf(join(d2, 'task.json')), 0o640)
    rmSync(d2, { recursive: true, force: true })
  }

  // 七之四之二、目标是只读的就**不替换**。直接写会被拒（EACCES），改名却会成功 ——
  //        换掉的是目录里的条目，目录可写就行；整体替换不该悄悄绕过用户给文件设的
  //        只读（评审第三轮）。看权限位而不是 accessSync：root 跑的时候后者对什么都说可写。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  chmodSync(tmp, 0o400)
  const ro = writeOf(() => recordRecommendations([mk('tiktok', 'erin')], 'p'))
  eq('只读的记忆不被替换 —— 报未写回', ro.written, false)
  ok('原因说的是权限', !ro.written && ro.reason.includes('EACCES'))
  ok('原文件没被动过', JSON.parse(rf(tmp, 'utf8')).creators.erin === undefined)
  eq('权限位也没动', modeOf(tmp), 0o400)
  ok('也没留下半成品', !existsSync(`${tmp}.${process.pid}.tmp`))
  chmodSync(tmp, 0o644)
  {
    const d3 = join(tmpdir(), `kol-d4-ro-${process.pid}`)
    rmSync(d3, { recursive: true, force: true })
    const st3 = readCostDocument<TaskState>(JSON.stringify({ product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1 }))
    saveTask(d3, st3)
    chmodSync(join(d3, 'task.json'), 0o444)
    const before3 = rf(join(d3, 'task.json'), 'utf8')
    let threw3 = false
    try { saveTask(d3, readCostDocument<TaskState>(JSON.stringify({ ...st3, product: '改过的' }))) } catch { threw3 = true }
    ok('只读的 task.json 写不进去时抛出来', threw3)
    eq('而它一个字节没动', rf(join(d3, 'task.json'), 'utf8'), before3)
    rmSync(d3, { recursive: true, force: true })
  }

  // 七之五、**新文件按 umask 默认建**，不是停在临时文件那一档。
  //        临时文件按最严建是为了盖住那段窗口，不是替产品决定新文件该多严；
  //        少了还原那一步，每个新建的 task.json / 名单 / 增强结果都变成
  //        只有属主可读，而这是一句注释说了、代码没做的事（ADR-42 追记）。
  {
    const fresh = join(tmpdir(), `kol-d4-fresh-${process.pid}.json`)
    rmSync(fresh, { force: true })
    const before = process.umask()
    writeFileAtomic(fresh, '{}')
    eq('新文件按 umask 默认，不是临时文件那档最严的', modeOf(fresh), 0o666 & ~before)
    rmSync(fresh, { force: true })
  }

  // 七之六、**目标是软链时，写的是它指向的那个文件**。
  //        改名换掉的是链接本身 —— 第一次写回就把用户配好的链接换成
  //        普通文件，真正那份从此不再更新，而报告照样说「已记入」。
  //        换成整体替换之前这里是一次普通 writeFileSync，它跟着链接写到终点，
  //        所以这不是新能力，是不让整体替换顺手弄坏原来对的行为（ADR-46 追记三）。
  {
    const base = join(tmpdir(), `kol-d4-link-${process.pid}`)
    rmSync(base, { recursive: true, force: true })
    mkdirSync(base, { recursive: true })
    const real = join(base, 'real.json'), link = join(base, 'link.json')
    writeFileSync(real, '{"v":1}', 'utf8')
    symlinkSync(real, link)
    writeFileAtomic(link, '{"v":2}')
    ok('链接还是链接，没被换成普通文件', lstatSync(link).isSymbolicLink())
    eq('写进去的是它指向的那份', rf(real, 'utf8'), '{"v":2}')
    rmSync(base, { recursive: true, force: true })
  }

  // 七之七、一次读失败算不算「盘上没有」：**只有 ENOENT 算**。
  //        权限不足、父路径不是目录、IO 错都是「看不到」—— 压成一个值，
  //        读记忆的那一侧会拿「看不到」当「没有」放行（ADR-26），写文件的这一侧
  //        会把读不到权限位的目标当成新文件。两个调用方，所以只留一份。
  eq('文件不存在算「盘上没有」', isAbsence({ code: 'ENOENT' }), true)
  for (const code of ['EACCES', 'ENOTDIR', 'EIO', 'EISDIR', undefined]) {
    eq(`读不到（${code ?? '没有错误码'}）不算「盘上没有」`, isAbsence({ code }), false)
  }
  eq('连错误对象都没有时也不算', isAbsence(null), false)

  // 七之八、硬杀（SIGKILL、断电）发生在写临时文件与改名之间时，catch 不会跑，
  //        一份完整的临时文件留在盘上。任何 write-then-rename 都躲不掉这一格，
  //        能做的是下次写回时把它清掉 —— 但只清死掉的进程留下的（ADR-30）。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  const deadPid = 999999          // 不存在的进程
  const orphan = `${tmp}.${deadPid}.tmp`
  writeFileSync(orphan, '上一次被硬杀时留下的', 'utf8')
  recordRecommendations([mk('tiktok', 'erin')], 'p')
  eq('死掉的进程留下的临时文件被清掉', existsSync(orphan), false)

  // 但活着的进程正在写的那份不许动 —— 两个 render 同时跑时那是人家的
  const otherLive = `${tmp}.${process.ppid}.tmp`
  writeFileSync(otherLive, '别的进程正在写', 'utf8')
  recordRecommendations([mk('tiktok', 'erin')], 'p')
  ok('活着的进程的临时文件不动', existsSync(otherLive))

  // 但「pid 还活着」不等于「它就是写这个文件的那个进程」—— 系统会回收 pid。
  // 回收到一个长命进程头上，孤儿就再也清不掉了。真正在写的文件只有毫秒级寿命，
  // 所以活得太久的一律清掉（ADR-39 · ADR-44）。
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  writeFileSync(otherLive, '别的进程正在写', 'utf8')   // 这一步自己备好文件，不依赖上一步没删它
  utimesSync(otherLive, twoHoursAgo, twoHoursAgo)
  recordRecommendations([mk('tiktok', 'erin')], 'p')
  eq('pid 被回收给别的进程时，靠年龄兜底清掉孤儿', existsSync(otherLive), false)

  // 兜底不能反过来误伤：刚写下的那份还是不许动
  writeFileSync(otherLive, '别的进程正在写', 'utf8')
  recordRecommendations([mk('tiktok', 'erin')], 'p')
  ok('刚写下的仍然不动 —— 年龄兜底不误伤并发写', existsSync(otherLive))
  rmSync(otherLive, { force: true })

  // 只认 pid 的正规十进制写法：`1e3` 在 Number() 眼里是 1000，`007` 是 7 ——
  // 但本函数从不写出这种名字，它们是别人的文件，再老也不许动（评审发现）。
  // 长过 2^53 的数字串转成数字会丢精度、超出 int32 的 process.kill 直接抛参数错 ——
  // 这两种同样没有哪个进程写得出来，一样不许动（评审第二轮）。
  // 系统发得出的 pid 有上限（Linux 硬上限 4194304）：超过它、哪怕还在 int32 以内，
  // process.kill 也只会答「没这个进程」—— 一样是别人的文件（评审第三轮）
  for (const spelled of ['1e3', '007', '9007199254740993', '4294967296', '2147483647', '4194305']) {
    const alien = `${tmp}.${spelled}.tmp`
    writeFileSync(alien, '别人的文件，名字只是长得像', 'utf8')
    utimesSync(alien, twoHoursAgo, twoHoursAgo)
    recordRecommendations([mk('tiktok', 'erin')], 'p')
    ok(`名字没有哪个进程写得出来的（${spelled}）不动`, existsSync(alien))
    rmSync(alien, { force: true })
  }

  // 清不掉的残留不让写回失败：占着临时名的是个目录时删不掉，写回照常
  {
    const stuck = `${tmp}.999998.tmp`
    rmSync(stuck, { recursive: true, force: true })
    mkdirSync(stuck, { recursive: true })
    const r = writeOf(() => recordRecommendations([mk('tiktok', 'erin')], 'p'))
    eq('残留清不掉时写回照常成功', r.written, true)
    rmSync(stuck, { recursive: true, force: true })
  }

  // 七之九、**扫孤儿临时文件要扫写的那个地方**。目标是软链时临时文件落在
  //        终点旁边，照着链接那一侧扫就永远扫不到 —— 而那是一份完整的
  //        联系历史，会一直留在盘上（ADR-46 追记四）。
  {
    const base = join(tmpdir(), `kol-d4-linksweep-${process.pid}`)
    rmSync(base, { recursive: true, force: true })
    const here = join(base, 'memory'), there = join(base, 'elsewhere')
    mkdirSync(here, { recursive: true }); mkdirSync(there, { recursive: true })
    const real = join(there, 'real.json'), link = join(here, 'creators.json')
    writeFileSync(real, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
    symlinkSync(real, link)
    useMemoryFile(link)
    const orphan2 = `${real}.999999.tmp`     // 死掉的进程留下的
    writeFileSync(orphan2, '{}', 'utf8')
    recordRecommendations([mk('tiktok', 'zed')], 'p')
    eq('终点旁边的孤儿也被清掉了', existsSync(orphan2), false)
    useMemoryFile(tmp)
    rmSync(base, { recursive: true, force: true })
  }

  // 七之十、任务目录走的是同一份整体替换，硬杀留下的残留同样由下一次写回清掉
  {
    const d3 = join(tmpdir(), `kol-d4-sweep-${process.pid}`)
    rmSync(d3, { recursive: true, force: true })
    mkdirSync(d3, { recursive: true })
    const orphan3 = join(d3, 'task.json.999999.tmp')
    writeFileSync(orphan3, '{}', 'utf8')
    saveTask(d3, readCostDocument<TaskState>(JSON.stringify({ product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1 })))
    eq('任务目录里死掉的进程留下的临时文件也被清掉', existsSync(orphan3), false)
    rmSync(d3, { recursive: true, force: true })
  }

  // 七之十一、建目录也要让新建的每一层被记住 —— 刷文件所在那层只让
  //          **文件的目录项**落了盘，而这些目录本身是刚建的，记录它们的是
  //          各自的上一层，那几层没人刷（ADR-49）。持久性本身测不了（ADR-50），
  //          这里守的是「它确实把多层目录建出来了、且重复调用不出事」。
  {
    const root = join(tmpdir(), `kol-d4-mkdir-${process.pid}`)
    const deep = join(root, 'a', 'b', 'c')
    rmSync(root, { recursive: true, force: true })
    mkdirDurable(deep)
    ok('多层目录一次建出来', existsSync(deep))
    mkdirDurable(deep)
    ok('已经在了再调一次也不出事', existsSync(deep))
    rmSync(root, { recursive: true, force: true })
  }

  // 七之十二、目标是**只写**的文件（0200）也替换得了，权限原样带过去。它过得了
  //          「可写」那一问；刷盘用的描述符要是在权限改成 0200 之后才按读打开，
  //          不是 root 时就被拒在改名之前 —— 一个能写的文件从此永远写不回
  //          （评审第一轮）。root 跑的时候打开什么都成，这条只在 CI（非 root）
  //          咬得住；本地跑过不算数。
  {
    const wo = join(tmpdir(), `kol-d4-writeonly-${process.pid}.json`)
    writeFileSync(wo, '旧的', 'utf8')
    chmodSync(wo, 0o200)
    let threwWo = ''
    try { writeFileAtomic(wo, '新的') } catch (e) { threwWo = String(e) }
    eq('只写的目标照样替换成功', threwWo, '')
    eq('只写这个权限位原样带过去', modeOf(wo), 0o200)
    chmodSync(wo, 0o600)
    eq('内容是这一次写的', rf(wo, 'utf8'), '新的')
    rmSync(wo, { force: true })
  }
  // 七之十三、umask 遮掉属主写位（0200）时照样写得了：临时文件按 0600 建出来
  //          实际是 0400，事后再按读写打开会被拒 —— 建文件那次打开不看新文件的
  //          权限位，拿到的就是可写句柄（读写句柄那一刀的评审第一轮）。同上，
  //          root 跑的时候打不开的事不发生，这条只在 CI（非 root）咬得住。
  {
    const um = join(tmpdir(), `kol-d4-umask-${process.pid}.json`)
    writeFileSync(um, '旧的', 'utf8')
    chmodSync(um, 0o644)
    const before = process.umask(0o200)
    let threwUm = ''
    try { writeFileAtomic(um, '新的') } catch (e) { threwUm = String(e) }
    finally { process.umask(before) }
    eq('umask 遮掉属主写位时照样替换成功', threwUm, '')
    eq('权限原样带过去，不受 umask 影响', modeOf(um), 0o644)
    eq('内容是这一次写的', rf(um, 'utf8'), '新的')
    rmSync(um, { force: true })
  }

  // 七之十四、**写回失败时不许把半成品留在盘上（D4.p）。** 改名之前失败（盘满、IO 错、
  //          目标路径上卡着别的东西），那一刻盘上已经躺着一份**完整的内容副本**，
  //          名字带进程号；而调用方拿到的是「没写回」、照常交付（D4.n）——
  //          没有任何人被告知那份副本在那儿。清它的只有两条路，失败的这一刻
  //          两条都走不到：同一个进程**再写一次同一个文件**（写之前那一次删），
  //          或者这个进程号死掉之后**别人再写一次同一个文件**（清残留那一步
  //          明写着自己名下的不清）。而写回失败往往就是最后一次写。
  //
  //          让改名注定失败：目标是个非空目录。前面几问它全过得了（目录是可写的），
  //          临时文件建出来、写完、刷完，到改名那一步才失败 —— 落点正是要守的那一段。
  //          **这也是这条断言不空的理由**：失败发生在临时文件写完之后，那一刻盘上
  //          确实躺着它，所以「它不在了」只能是被清掉的（第四轮评审提的：先摆一份
  //          半成品守不住什么，写之前那一次 rmSync 会先把它删掉）。
  {
    const stuck = join(tmpdir(), `kol-d4-halfdone-${process.pid}`)
    rmSync(stuck, { recursive: true, force: true })
    mkdirSync(stuck, { recursive: true })
    writeFileSync(join(stuck, 'x'), '占着，改名搬不进来', 'utf8')
    const half = `${stuck}.${process.pid}.tmp`
    let threwHalf = ''
    try { writeFileAtomic(stuck, '这一次的内容') } catch (e) { threwHalf = String(e) }
    ok('目标是目录时写回报失败', threwHalf !== '')
    eq('写回失败时半成品不留在盘上', existsSync(half), false)
    criterion('D4.p')
    rmSync(half, { force: true })
    rmSync(stuck, { recursive: true, force: true })
  }

  // 八、写入侧不许写出读取侧会拒绝的东西。任务配置里 product 是空白时，
  //     写下的那条推荐记录下次读盘正好被判成损坏 —— 一次写回就把一份好好的
  //     记忆变成读不出来的，此后每次采集都被挡住（ADR-46）。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  const blank = recordRecommendations([mk('tiktok', 'zed')], '   ')
  eq('产品名是空白时拒绝写回', blank.written, false)
  // 不是字符串的也拒绝：手改过的 task.json 里 product 可能是数字、null、对象，
  // 而写入侧原先只 trim —— 那会直接抛，绕开「报为未写回、照常交付」这条路。
  const notText = writeOf(() => recordRecommendations([mk('tiktok', 'zed')], 7 as unknown as string))
  eq('产品名不是字符串时不抛', notText.threw, '')
  eq('产品名不是字符串时同样拒绝写回', notText.written, false)
  eq('记忆仍然读得出来 —— 没有被自己写的东西毒掉',
    statusOf(() => filterByMemory([mk('tiktok', 'zed')], 'X')), 'ok')

  // 八之二、**写出去的键也要过同一道校验**。只校验读进来的那一侧，
  //     写的这一侧就能造出一个自己下次读不出来的文件 —— 同一条规矩，这次轮到键。
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  for (const [what, c] of [
    ['handle 是展示形态', mk('tiktok', '@alice')],
    ['平台不在支持范围内', { ...mk('tiktok', 'alice'), platform: 'youtube' } as unknown as Creator],
    // 这两个值直接来自 JSON.parse(creators.json)，**类型标注在运行时一个都不拦**。
    // 校验只做「取值对不对」而不做「是不是文字」时，第一句 toLowerCase 就抛，
    // 而抛出去会绕开「报为未写回、照常完成交付」那条路：这个函数的契约是绝不抛（ADR-56）。
    ['handle 不是字符串', { platform: 'tiktok', handle: null } as unknown as Creator],
    ['平台不是字符串', { platform: 7, handle: 'zed' } as unknown as Creator],
    ['handle 全是空白', { platform: 'tiktok', handle: '   ' } as unknown as Creator],
    ['两个都缺', {} as unknown as Creator],
  ] as const) {
    const w = writeOf(() => recordRecommendations([c], 'p'))
    eq(`${what}时不抛`, w.threw, '')
    eq(`${what}时拒绝写回`, w.written, false)
  }
  eq('记忆仍然读得出来 —— 没有被自己写的键毒掉',
    statusOf(() => filterByMemory([mk('tiktok', 'alice')], 'p')), 'ok')

  // 八之三、D1 的「同一个人」只有一个定义：去重与记忆查询调同一个函数。
  //     各写一份表达式时「一致」只是巧合 —— collect 原先只小写 handle，
  //     memory 两个都小写，平台名恒为小写所以看不出来（ADR-22 追记）。
  eq('平台名大小写不同也是同一个人',
    creatorKey({ platform: 'TikTok', handle: 'Alice' }), creatorKey({ platform: 'tiktok', handle: 'alice' }))
  eq('而记忆过滤用的正是这个键 —— 存的大写、查的小写，照样挡得住', (() => {
    writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {
      'tiktok:Carol': { contacted: true, blocked: false, recommendations: [] } } }), 'utf8')
    return filterByMemory([mk('tiktok', 'carol')], 'p').filtered_contacted
  })(), 1)
  eq('规范化之后写回去的也是规范形式', (() => {
    recordRecommendations([mk('tiktok', 'dave')], 'p')
    return Object.keys(JSON.parse(rf(tmp, 'utf8')).creators)
  })(), ['tiktok:carol', 'tiktok:dave'])

  // 九、正常写回是原子的 —— 不留临时文件
  writeFileSync(tmp, JSON.stringify({ version: 1, updated_at: '', creators: {} }), 'utf8')
  const okWb = recordRecommendations([mk('tiktok', 'erin')], 'p')
  eq('正常时写回成功', okWb.written, true)
  eq('不留下半成品', readdirSync(d4Dir).filter(f => f.endsWith('.tmp')).length, 0)
  ok('写回后仍可解析', (() => { try { JSON.parse(rf(tmp, 'utf8')); return true } catch { return false } })())

  rmSync(d4Dir, { recursive: true, force: true })   // 变异可能已经把它删了，清理不该因此崩掉
  useMemoryFile('memory/creators.json')
}

suite('P4', '记忆读不出来时不产出名单 —— 已联系的人不得靠一个解析错误重新进来')
{
  const tmp = join(tmpdir(), `kol-p4d4-${process.pid}.json`)
  writeFileSync(tmp, JSON.stringify({
    version: 1, updated_at: '', creators: {
      'tiktok:contacted': { platform: 'tiktok', handle: 'contacted', nickname: '', followers: 50000,
        first_seen: '2026-01-01', recommendations: [], contacted: true, replied: false,
        blocked: false, note: '' },
      'tiktok:blocked': { platform: 'tiktok', handle: 'blocked', nickname: '', followers: 50000,
        first_seen: '2026-01-01', recommendations: [], contacted: false, replied: false,
        blocked: true, note: '' },
    },
  }), 'utf8')
  useMemoryFile(tmp)
  const batch = [mk('tiktok', 'contacted', { followers: 50000 }),
                 mk('tiktok', 'blocked', { followers: 50000 }),
                 mk('tiktok', 'fresh', { followers: 50000 })]

  eq('记忆完好时只剩没联系过的那个', finalize(batch, 'p').kept.map(c => c.handle), ['fresh'])

  truncateSync(tmp, Math.floor(rf(tmp, 'utf8').length * 0.6))

  let threw = ''
  try { finalize(batch, 'p') } catch (e) { threw = (e as Error).name }
  eq('同一份记忆坏掉后：抛，而不是交出一份含已联系者的名单', threw, 'MemoryUnreadable')
  criterion('P4.b')

  // D1 × P4 的交点：身份规范化两侧必须是同一个规则。查询侧一直在小写化、
  // 存储侧没有，于是手改出来的 `tiktok:Alice` 永远查不到 —— 已联系的人
  // 照进名单，而状态报的是「读到了」（ADR-22）。
  writeFileSync(tmp, JSON.stringify({ version: 1, creators: {
    'tiktok:Contacted': { platform: 'tiktok', handle: 'contacted', nickname: '', followers: 50000,
      first_seen: '2026-01-01', recommendations: [], contacted: true, replied: false,
      blocked: false, note: '' },
  } }), 'utf8')
  eq('键的大小写不影响身份 —— 已联系的人照样被挡在外面',
    finalize([mk('tiktok', 'contacted', { followers: 50000 })], 'p').kept.length, 0)
  // 让步的是 D1（身份怎么算）：两侧走同一个规范化函数，而不是各写一遍写成一样 ——
  // 「今天一致」靠的是同一句话被写对了两遍，那不是保证（ADR-22 追记）。
  // 另一头「规范化不了的键当作记忆读不出来、不当成这个人没有记录」在
  // D4 那张形状表里（键没有冒号 / handle 是空的 / 两个键指同一个人 / 平台拼错），
  // 那一整张表跑在这之前。
  tension('D1', 'P4')

  // 同一条红线的另一扇门：合法 JSON、错误结构。产品要求运营手改这个文件，
  // 把花括号改成方括号是最容易的一种手滑，而它照样能解析（ADR-19）。
  writeFileSync(tmp, '{"version":1,"creators":[]}', 'utf8')
  let shapeThrew = ''
  try { finalize(batch, 'p') } catch (e) { shapeThrew = (e as Error).name }
  eq('结构不对时也不得交出一份含已联系者的名单', shapeThrew, 'MemoryUnreadable')

  truncateSync(tmp, Math.floor(rf(tmp, 'utf8').length * 0.6))
  const forced = finalize(batch, 'p', undefined, { ignoreUnreadableMemory: true })
  eq('逃生口下确实放行了已联系的人', forced.kept.length, 3)
  eq('但这件事必须能被下游读到', forced.memory_status, 'unreadable_ignored')
  criterion('P4.c')

  // 真正要守的是这个：「没查到」与「查过、确实没人」在下游必须不同值。
  // 两者的 filtered_contacted 都是 0，能分开它们的只剩 memory_status。
  useMemoryFile(join(tmpdir(), `kol-p4d4-none-${process.pid}.json`))
  const cleanEmpty = finalize(batch, 'p')
  eq('空记忆同样一个都没滤掉', cleanEmpty.filtered_contacted, forced.filtered_contacted)
  ok('但两者不是同一个状态 —— 0 不再同时代表两件事',
     cleanEmpty.memory_status !== forced.memory_status)

  unlinkSync(tmp)
  useMemoryFile('memory/creators.json')
}

})
if (fullRun) {
suite('F5', '分层管线：受众降权在分层之后，且缺增强数据时不中断')
{
  const withGeo = (pct: number) =>
    mk('tiktok', 'g', { email: 'a@example.com', fit: '✅', audience_geo: { US: pct } })

  eq('地域达标 → 保持 A', rankCreators([withGeo(0.8)], 'US')[0].tier, 'A')
  // 降权必须发生在 tierOf 之后，否则会被算出来的 tier 覆盖掉
  eq('地域 20% → A 降到 B', rankCreators([withGeo(0.2)], 'US')[0].tier, 'B')
  eq('地域 10% → 直接剔除', rankCreators([withGeo(0.1)], 'US').length, 0)
  // F5：没有增强层时 audience_geo 为 undefined，主流程照常走完
  const noGeo = mk('tiktok', 'n', { email: 'a@example.com', fit: '✅' })
  eq('无增强数据不影响分层', rankCreators([noGeo], 'US')[0].tier, 'A')
  // F5 × P1 的交点：**只降能力，不降数据**。缺增强层时主流程照常走完（上一条），
  // 但缺的字段不许填猜测值 —— 填一个「US: 0.5」进去，下游分不出这是量出来的
  // 还是猜的，而 P1 不让步。判别见 docs/CONVENTIONS.md 第 2 条。
  eq('缺增强层时地域留空，不补一个猜出来的值',
    rankCreators([noGeo], 'US')[0].audience_geo, undefined)

  // 没做过语义判断（没有 fit）时按分数分层，而分层用的必须是**刚算出来的那个分**。
  // 三个语料的分数实测落在 30 / 45 / 60，正好跨过两条阈值 —— 传错一个常数进去，
  // 三条里至少两条会红。原先这一支一条断言都没有：把它整个改成永远返回 C，
  // 整个测试套照样全绿（#93 评审指出）
  const noFit = (h: string, over: Partial<Creator> = {}) => mk('tiktok', h, over)
  eq('没做语义判断时按分数分层：30 分 → C',
    rankCreators([noFit('s30')], 'US')[0].tier, 'C')
  eq('45 分 → B', rankCreators([noFit('s45', { source_dimension: 'competitor' })], 'US')[0].tier, 'B')
  eq('60 分 → A', rankCreators([noFit('s60', { email: 'a@example.com' })], 'US')[0].tier, 'A')

  tension('F5', 'P1')
}

}
await group('u3-keywords', () => {
suite('U1', '分层管线返回的名单已按 tier 排好序')
{
  const c = (h: string, fit: '✅' | '❌', tasks = [0]) =>
    mk('tiktok', h, { email: 'a@example.com', fit, source_tasks: tasks })
  // `high` 被两个词搜到 —— 各行相加可以大于名单总人数，这是 U3.b 明写的
  const out = rankCreators([c('low', '❌'), c('high', '✅', [0, 5])], 'US')
  eq('A 排在 C 前面', out.map(x => x.tier), ['A', 'C'])

  // U3.b：关键词表从**任务列表**出发 —— 0 命中的词和一次都没查过的词也要有自己那一行。
  // 从交付名单反推时它们整行消失，而那正是 IG 为零时最贵的那一半（P5.i）。
  const tstate = (over: any = {}) => ({
    product: 'p', market: 'US', target_count: 50, budget_usd: 1,
    tasks: [{ keyword: 'k', dimension: 'category', platform: 'tiktok' },
            { keyword: 'zero', dimension: 'scene', platform: 'instagram' },
            { keyword: 'never', dimension: 'competitor', platform: 'instagram' },
            // ⚠️ 和任务 0 **同词同平台、维度不同**：行的身份比（关键词, 平台）细。
            // 按那个二元组归人的话，这一行会数到任务 0 那两个人 —— 而它一次都没问过。
            { keyword: 'k', dimension: 'scene', platform: 'tiktok' },
            // 问过、而那一次的条数没记下来（D6.l 的 null）—— 四态里最容易被渲染成 0 的那一个
            { keyword: 'lost', dimension: 'category', platform: 'tiktok' },
            { keyword: 'tag', dimension: 'category', platform: 'tiktok', as_hashtag: true }],
    // 三张表各答一个问题：answered＝问过没有（P5.i）、found＝拿回几条（U3.b）、
    // offsets＝下一页从哪儿接（D6）。任务 2 三张表里都没有 → 一次都没问过。
    done: [], offsets: { 0: 40, 1: 0, 4: 0, 5: 7 },
    answered: { 0: 2, 1: 1, 4: 1, 5: 1 }, found: { 0: 40, 1: 0, 4: null, 5: 7 },
    requests: 0, created_at: '', updated_at: '', ...over,
  })
  const rows = keywordRows(tstate(), out)
  eq('每个任务一行，一个都不少', rows.length, 6)
  // ⚠️ 逐行取值一律走 `?.` —— 少了一行时要让**断言红**，不是让测试崩：
  // 崩溃不是任何一条断言的功劳，指着这儿的变异会被判「跑不起来」而不是「被抓到」
  // （M-U3-a 实测过一次）。
  eq('查过且有命中：found 是搜索返回的条数，入围是名单里的人 —— 两个数不一样',
     [rows[0]?.status, rows[0]?.found, rows[0]?.shortlisted, rows[0]?.fit_pass],
     ['queried', 40, 2, 1])
  eq('查了 0 命中：found 是 0，不是 null —— 这是量出来的零',
     [rows[1]?.status, rows[1]?.found, rows[1]?.shortlisted], ['queried', 0, 0])
  // 本条落地之前采的人身上没有来源任务 —— **整张名单**据此判无从确认，
  // 不许每一行都印一个确定为假的 0（上一条 PR 先合、本条后合，中间那个窗口就是这个形状）
  eq('名单里有一个人没带来源任务 → 每一行的入围都印「无从确认」，不印 0',
     keywordRows(tstate(), [...out, mk('tiktok', 'legacy', {})]).map(r => r.shortlisted),
     Array(6).fill(null))
  eq('一次都没查过：found 是 null，入围与语义通过也是 null —— 没测量不能说成测量结果是零',
     [rows[2]?.status, rows[2]?.found, rows[2]?.shortlisted, rows[2]?.fit_pass],
     ['unqueried', null, null, null])
  eq('平台跟着任务走', rows.map(r => r.platform),
     ['tiktok', 'instagram', 'instagram', 'tiktok', 'tiktok', 'tiktok'])
  // ⚠️ **条数不全不等于归人不全。** 这一页付了钱、抛在记条数之前 —— 那一页一个人都没入库，
  // 前几页采到的人身上下标一个不少，所以入围是**确知的**。绑在一起会把一个真数抹成「无从确认」。
  eq('问过、而那一次的条数没记下：found 是 null，而入围仍然是确知的数',
     [rows[4]?.status, rows[4]?.found, rows[4]?.shortlisted, rows[4]?.fit_pass],
     ['queried', null, 0, 0])
  // 一个人可以被多个词搜到 —— 各行入围相加（2＋1）大于名单总人数（2），U3.b 明写的
  eq('被第二个词搜到的人，在那一行也算得上',
     [rows[5]?.shortlisted, rows[5]?.fit_pass, out.length], [1, 1, 2])
  eq('hashtag 词在行上带得出标记 —— 行的身份比（关键词, 平台）细',
     [rows[5]?.as_hashtag, rows[0]?.as_hashtag], [true, undefined])
  // 归人按**任务下标**，不按（关键词, 平台）—— 后者比行粗，同词同平台的两行会数到
  // 同一批人：一个从没发过请求的行上于是挂着别人的测量结果，比印 0 更糟（负片 M-U3-c）。
  eq('同词同平台、维度不同的那一行，一个人都不归它 —— 它一次都没问过',
     [rows[3]?.status, rows[3]?.found, rows[3]?.shortlisted, rows[3]?.fit_pass],
     ['unqueried', null, null, null])
  // 无从确认（整张分页记录表缺失，F9 落地之前的旧目录）：四态里的第四态
  // 旧目录的真实形状：连 `answered` 都没有的目录，人身上当然也没有来源任务
  const legacyPeople = out.map(c => ({ ...c, source_tasks: undefined }))
  const unknownRows = keywordRows(tstate({ answered: undefined }), legacyPeople)
  eq('无从确认 → 每一行都说无从确认，不是「都没查过」',
     unknownRows.map(r => r.status), Array(6).fill('unknown'))
  eq('无从确认 → 入围与语义通过也是 null，不是 0 —— 那种目录的人身上没有任务下标',
     [unknownRows[0]?.shortlisted, unknownRows[0]?.fit_pass], [null, null])
  // `answered` 是 null（盘上的值是反序列化进来的外部输入）也读作无从确认，不许当场抛 ——
  // 抛的位置在 render 写完名单、写回记忆之后，交付物会互相矛盾
  // ⚠️ 抛了要让**断言红**，不是让测试崩 —— 崩了指着这儿的负片会被判「跑不起来」
  eq('answered 是 null 也读作无从确认，不崩',
     (() => { try { return keywordRows(tstate({ answered: null }), out).map(r => r.status) }
              catch (e) { return `抛了：${String(e)}` } })(),
     Array(6).fill('unknown'))
  eq('无从确认 → found 一律 null', unknownRows.map(r => r.found), Array(6).fill(null))
  // 迁移过来的任务：分页记录证明它问过，但升级前抓了几页、采到谁都无从得知 ——
  // 条数记 null（注定不全），归人也跟着 null。印一个偏小的数和印 0 一样坏，
  // 都是「看起来像测量值的数」（ADR-94 第十六节）。
  {
    const migrated = keywordRows(tstate({ found: { 0: null, 1: 0 } }), out)
    eq('条数注定不全 → found 是 null，不是一个偏小的数', migrated[0]?.found, null)
    eq('条数不全，归人照样确知 —— 抛掉的那一页一个人都没入库',
       [migrated[0]?.shortlisted, migrated[0]?.fit_pass], [2, 1])
    eq('同一张表里量得准的那一行不受影响',
       [migrated[1]?.status, migrated[1]?.found, migrated[1]?.shortlisted], ['queried', 0, 0])
  }
  // P5.i：平台那一行也从任务列表出发 —— 一次都没查到人的平台不得静默消失
  eq('平台从任务列表出发，采不到人的平台照样在', taskPlatforms(tstate()), ['tiktok', 'instagram'])
  // ⚠️ 它与 `firstPagePending` **不是同一份判定** —— 那个读 offsets 答「这一页付过钱没有」，
  // 这个读 answered 答「发出过请求没有」。#139 之前两者合用一张表，于是各自都不准。
  eq('问过没有：读的是「应答过几次」那张表，三态齐',
     [taskQueryStatus(tstate(), 0), taskQueryStatus(tstate(), 2),
      taskQueryStatus(tstate({ answered: undefined }), 0)],
     ['queried', 'unqueried', 'unknown'])

  // ── 归人的两个维护点：采集时追加、跨平台合并时取并集 ──────────────────
  // 两处都是「漏一笔就少报入围」，而独立复核实测：把任一处改坏，整条检查链全绿
  // （ADR-94 第十六节丁）。它们原先一条断言都没有 —— `source_tasks` 在整份 test.ts 里
  // 只出现在一个 fixture 的赋值上。
  {
    const t0 = { keyword: 'k0', dimension: 'category', platform: 'tiktok' } as any
    const t1 = { keyword: 'k1', dimension: 'scene', platform: 'tiktok' } as any
    const acc = new Map<string, Creator>()
    const page = [{ handle: 'sam', platform: 'tiktok' }, { handle: 'ann', platform: 'tiktok' }] as any
    eq('第一个任务：两个人都是新的', mergePage(acc, page, 0, t0), 2)
    // 同一个人被第二个任务搜到：不算新增，但那个任务下标要记进他的来源
    eq('第二个任务搜到同一批人：一个新增都没有', mergePage(acc, [page[0]], 1, t1), 0)
    eq('但他的来源里多了那个任务 —— 漏了这一笔，第二个词会被报成「找到 N 条、一个都没入围」',
       acc.get('tiktok:sam')?.source_tasks, [0, 1])
    eq('字段不被第二个任务覆盖', acc.get('tiktok:sam')?.source_keyword, 'k0')
    eq('同一个任务重复搜到他，不会把下标记两遍',
       (mergePage(acc, [page[0]], 1, t1), acc.get('tiktok:sam')?.source_tasks), [0, 1])
    eq('没有 handle 或 platform 的条目直接跳过',
       mergePage(acc, [{ handle: '', platform: 'tiktok' }, { handle: 'x' }] as any, 0, t0), 0)
    // ⚠️ 累加器里可能有本条落地之前采的人（`loadRawCreators` 从 creators.raw.json 读回来）——
    // 他们的来源**无从确认**。凭空补一个 `[i]` 等于替他打包票说「他只来自这个任务」，
    // 而整张表会据此认定归得了人，每一行又开始印确定为假的 0。
    const legacyAcc = new Map<string, Creator>([['tiktok:old', mk('tiktok', 'old', {})]])
    eq('旧人被新任务又搜到一次：不算新增', mergePage(legacyAcc, [{ handle: 'old', platform: 'tiktok' }] as any, 2, t0), 0)
    eq('而且他的来源仍然是「无从确认」，不许凭空补成 [2]',
       legacyAcc.get('tiktok:old')?.source_tasks, undefined)
  }
  {
    // 跨平台同人被合并时，次记录那一侧的来源任务不能跟着消失
    const tt = mk('tiktok', 'sam', { source_tasks: [0], bio_links: ['https://instagram.com/sam'] })
    const ig = mk('instagram', 'sam', { source_tasks: [1], bio_links: [] })
    const pair = [tt, ig]
    linkCrossPlatform(pair)               // 就地连线，交回的是连上几对
    const merged = mergeCrossPlatform(pair)
    const primary = merged.find(c => c.merged_into === undefined)
    eq('两侧的来源任务取并集 —— 漏了并集，次记录那一侧的词就再也归不到他',
       primary?.source_tasks, [0, 1])
    // 有一边无从确认，并集就无从确认 —— 把缺的那边当成空集等于替它打包票
    const ttOld = mk('tiktok', 'sam2', { bio_links: ['https://instagram.com/sam2'] })
    const igNew = mk('instagram', 'sam2', { source_tasks: [1], bio_links: [] })
    const pair2 = [ttOld, igNew]
    linkCrossPlatform(pair2)
    const merged2 = mergeCrossPlatform(pair2)
    eq('一边的来源无从确认 → 合出来的人也无从确认，不留一个看着归得清的残集',
       merged2.find(c => c.merged_into === undefined)?.source_tasks, undefined)
  }
  criterion('U3.b')

  // P5.i 的渲染那一半：**四态要在报告上分得开**，而且没查过的那一行不许带出
  // 一个看起来像测量值的数。判定在 report.ts，所以在这里直调 renderHtml 断言
  // （同 P5.f／P5.g 的形状 —— 留在 render.ts 里没有任何测试够得着）。
  const kwHtml = renderHtml(out, {
    product: 'p', market: 'US', platforms: taskPlatforms(tstate()),
    keywords: rows, total: 2, tiers: { A: 1, B: 0, C: 1 }, email_count: 2,
    cross_platform_count: 0, ...testCostMeta(1, 2000000), enriched: false,
  })
  // ⚠️ **断言落在表体上，不是整页。** 头一版写的是 `kwHtml.includes('未查询')` ——
  // 它命中的是我在同一个提交里新写的那句说明文案，关键词表整个为空时照样绿
  // （#139 复核第 4 条，实测：`renderHtml([], {keywords: []})` 也命中）。
  // 那两条断言于是什么都没测，而整条检查链 403/403 全绿。
  // 切到 <tbody> 为止 —— 那句说明文案在 <h2> 与 <table> 之间，切在 </table> 上它还在里面，
  // 断言照样恒真（我头一版的修就栽在这儿，切细了才真的只剩行）
  const kwTable = (h: string): string =>
    ((h.split('<h2>关键词表现</h2>')[1] ?? '').split('<tbody>')[1] ?? '').split('</tbody>')[0]
  ok('夹具本身有效：表体里真的有行', /<tr>/.test(kwTable(kwHtml)))
  ok('没查过的词照样在表体里，写着「未查询」', kwTable(kwHtml).includes('未查询'))
  ok('空表时那两个字不该出现在表体里 —— 证明上一条测的是行，不是说明文案',
     !kwTable(renderHtml([], {
       product: 'p', market: 'US', platforms: [], keywords: [], total: 0,
       tiers: { A: 0, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
       ...testCostMeta(0, 1000000), enriched: false,
     } as any)).includes('未查询'))
  // ⚠️ **断言要落在格子上，不是「这几个字在表体里出现过」。**
  // 上一版 U3.c 名下全是 `includes('<th>找到</th>')` 这种表头存在性，行的取值一格没测：
  // 独立复核当场把「入围」那一列的接线换成 `countText(k.found)`（两个数合并成同一个，
  // 正是 U3.b 逐字禁的），**整条检查链 371/371 全绿**。四态里也只有两态被钉住 ——
  // 把「未知」印成 0、把「查了 0 命中」印成「—」，两个改法都全绿（ADR-94 第十六节丁，实测）。
  const cells = (h: string, col: number): string[] =>
    kwTable(h).split('<tr>').slice(1).map(r =>
      ([...r.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1].trim())[col]) ?? '（没有这一格）')
  // 四态在**同一张表**上，逐格钉死。分两次渲染各命中一个词的话，「它们互不相同」测不到。
  eq('「找到」那一列四态俱全，逐格对得上：量出来的 0 印 0，没测量的不印 0',
     cells(kwHtml, 4), ['40', '0', '未查询', '未查询', '未知', '7'])
  // ⚠️ 没问过的两行印「—」**不是**印 0 —— P5.i 逐字：未查询的行不得带出看起来像测量值的数。
  // 而「问过、条数没记下」那一行照样印确知的 0：那一页一个人都没入库，入围是量得出来的。
  eq('「入围」那一列是人数，不是条目数 —— 和「找到」不是同一个数',
     cells(kwHtml, 5), ['2', '0', '—', '—', '0', '1'])
  eq('「语义通过」那一列', cells(kwHtml, 6), ['1', '0', '—', '—', '0', '1'])
  eq('配置的 hashtag 标记不成为报告中的实际路径声明', cells(kwHtml, 1)[5], 'tag')
  const unknownHtml = renderHtml(out, {
    product: 'p', market: 'US', platforms: taskPlatforms(tstate()),
    keywords: unknownRows, total: 2, tiers: { A: 1, B: 0, C: 1 }, email_count: 2,
    cross_platform_count: 0, ...testCostMeta(1, 2000000), enriched: false,
  } as any)
  ok('无从确认那一态也说得出来', kwTable(unknownHtml).includes('无从确认'))
  // 无从确认时连归人都无从谈起 —— 入围与语义通过要印「—」，不许印 0（P5.i 逐字）
  ok('无从确认的行不印 0，印「—」',
     kwTable(unknownHtml).includes('—') && !/<td>0<\/td>/.test(kwTable(unknownHtml)))
  // 那个 0% 是这条判据逐字点名的东西：命中率那一列本来就是两种单位相除，
  // 本条把它整列撤掉 —— 没查过的行于是不可能再带出一个像测量值的百分比。
  ok('关键词表里不再有命中率那一列', !kwHtml.includes('<th>命中率</th>'))
  ok('平台成了表上的一列 —— 关键词×平台才是一行', kwHtml.includes('<th>平台</th>'))
  ok('找到与入围各自一列，没有合并', kwHtml.includes('<th>找到</th>') && kwHtml.includes('<th>入围</th>'))
  // U3.c 接替退役的 U3.a：那一条要求「找到**人数**」与「命中率」，而本条把「找到」
  // 换成供应商返回的条目数、并撤掉了命中率那一列（两种单位相除无意义）——
  // 判据不改含义、不回收复用（ADR-67），所以退役、用下一个字母。
  ok('三列都在：找到、入围、语义通过',
     kwHtml.includes('<th>找到</th>') && kwHtml.includes('<th>入围</th>')
     && kwHtml.includes('<th>语义通过</th>'))
  // ⚠️ 上面这几条只管表头在不在。**U3.c 说的是「每一行列出」**，所以它的承重断言是
  // 前面那三条逐格比对 —— 表头存在性一条负片都指不动（`M-U3-d` 指的是格子）。
  criterion('U3.c')
  criterion('P5.i')
  // ── U3 × P5：同一份数据，两种坏法 ─────────────────────────────────────
  // 上面那一组断言同时量了两件事：**每个任务都有自己那一行**（U3.b，表里有什么），
  // 以及**四态各说各的、平台不会消失**（P5.i，用户会不会据此做错决定）。
  // 两者都从任务列表出发，所以是同一份数据；但坏起来后果不同 ——
  // 少一行是表不全，把「没查过」印成 0 是让运营砍掉一个没查过的方向。
  tension('U3', 'P5')
  eq('分层计数', tierCounts(out), { A: 1, B: 0, C: 1 })
}

})
await group('u8-labels', () => {
suite('F3', '剩余关键词列表按 done 排除，保留任务身份')
{
  const st = {
    tasks: [{ keyword: 'a', dimension: 'category', platform: 'tiktok' },
            { keyword: 'b', dimension: 'scene', platform: 'instagram', as_hashtag: true },
            { keyword: 'c', dimension: 'audience', platform: 'tiktok' }],
    done: [0],
  } as any
  eq('跳过已完成，原任务身份与关键词照留', pendingKeywords(st), [
    '任务 2 · scene · instagram · 关键词「b」',
    '任务 3 · audience · tiktok · 关键词「c」',
  ])
}

// ADR-106：独立测试上下文仅依据 U8、P5 与公开契约写成，先于实现见红。
suite('U8', '搜索任务展示能指回原任务，配置意图不冒充发现路径')
{
  const st = (over: Partial<TaskState> = {}): TaskState => ({
    product: 'p', market: 'US', target_count: 50, budget_usd: 1,
    tasks: [
      { keyword: 'done', dimension: 'category', platform: 'tiktok' },
      { keyword: 'selfcare', dimension: 'category', platform: 'instagram', as_hashtag: true },
      { keyword: 'selfcare', dimension: 'scene', platform: 'instagram', as_hashtag: true },
      { keyword: 'selfcare', dimension: 'scene', platform: 'instagram', as_hashtag: true },
      { keyword: '#Self Care', dimension: 'audience', platform: 'tiktok', as_hashtag: true },
    ],
    done: [0], offsets: { 0: 20, 1: 20 }, pages: { 0: 1, 1: 1 },
    answered: { 0: 1, 1: 1 }, found: { 0: 3, 1: 0 },
    requests: 2, created_at: '', updated_at: '', ...over,
  })
  // 预期直接来自 ADR-106 格式；相同配置的任务 3、4 必须仍可区分。
  const labels = [
    '任务 2 · category · instagram · 关键词「selfcare」',
    '任务 3 · scene · instagram · 关键词「selfcare」',
    '任务 4 · scene · instagram · 关键词「selfcare」',
    '任务 5 · audience · tiktok · 关键词「#Self Care」',
  ]
  eq('未完成标签逐项保留原序号、维度、平台、原词，完全重复项仍可区分',
     pendingKeywords(st()), labels)
  criterion('U8.a')
  // 任务 2 抓过页、不在 done、是 IG：D6.v 之后续跑不再为它请求（令牌不跨运行），按 U8.b「只包含按既有规则
  // 会继续搜索的任务」不在这张表里。这一处期望随 D6.v 改过，原先是 `labels` 全部。
  eq('未达标的续跑标签保留原序号与全部实际待查项', keywordsResumeWillRun(st(), 0), labels.slice(1))
  eq('达标后只剩未抓首页的任务，筛选不重新编号', keywordsResumeWillRun(st(), 50), labels.slice(1))
  criterion('U8.b')
  eq('标签不因 hashtag 配置增添字符，关键词自身的井号原样保留',
     pendingKeywords(st({ done: [0, 1, 2] })), labels.slice(2))

  const rows = keywordRows(st(), [])
  // 通过 JSON 读取公开字段，旧返回类型尚未新增字段时也能先看到具体断言红。
  const indexed = JSON.parse(JSON.stringify(rows))
  eq('每个关键词行带零起始原下标，包括未查询行和完全重复行',
     indexed.map((r: any) => r.task_index), [0, 1, 2, 3, 4])
  eq('无从确认查询状态的行也带原任务下标',
     JSON.parse(JSON.stringify(keywordRows(st({ answered: undefined }), []))).map((r: any) => r.task_index),
     [0, 1, 2, 3, 4])
  criterion('U8.c')

  const table = (keywords: any[]): string[][] => {
    const html = renderHtml([], {
      product: 'p', market: 'US', platforms: ['tiktok', 'instagram'], keywords,
      total: 0, tiers: { A: 0, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
      ...testCostMeta(2, 1000000), enriched: false,
    })
    const body = ((html.split('<h2>关键词表现</h2>')[1] ?? '').split('<tbody>')[1] ?? '').split('</tbody>')[0]
    return body.split('<tr>').slice(1).map(r => [...r.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1].trim()))
  }
  const row = (over: any = {}) => ({ keyword: 'selfcare', dimension: 'scene', platform: 'instagram',
    status: 'queried', found: 7, shortlisted: 2, fit_pass: 1, ...over })
  const reordered = table([row({ task_index: 8 }), row({ task_index: 2 }), row({ task_index: 0 })])
  eq('HTML 任务序号使用每行下标而非显示顺序', reordered.map(r => r[0]), ['9', '3', '1'])
  eq('最大可显示序号与零下标都保留准确整数',
     table([row({ task_index: Number.MAX_SAFE_INTEGER - 1 }), row({ task_index: 0 })]).map(r => r[0]),
     [String(Number.MAX_SAFE_INTEGER), '1'])
  criterion('U8.d')

  // 缺失与非法值来自旧 JSON；Number.MAX_SAFE_INTEGER 自身虽安全，加一已不安全。
  const invalid = [undefined, null, -1, 0.5, '2', Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, true]
  const legacy = table(invalid.map(task_index => row({ task_index })))
  eq('缺失与非法任务下标一律无从确认，不从行位置或相同关键词猜补',
     legacy.map(r => r[0]), invalid.map(() => '无从确认'))
  eq('身份无从确认不会抹掉该行已经查实的计数',
     legacy.map(r => r.slice(4)), invalid.map(() => ['7', '2', '1']))
  const states = table([
    row({ task_index: 6, status: 'unqueried', found: null, shortlisted: null, fit_pass: null }),
    row({ status: 'queried', found: 0, shortlisted: 0, fit_pass: 0 }),
    row({ task_index: null, status: 'unknown', found: null, shortlisted: null, fit_pass: null }),
  ])
  eq('有任务序号仍可未查询，身份未知仍可测得零，两种未知互不替代', states.map(r => [r[0], ...r.slice(4)]), [
    ['7', '未查询', '—', '—'], ['无从确认', '0', '0', '0'], ['无从确认', '无从确认', '—', '—'],
  ])
  criterion('U8.e')
  tension('U8', 'P5')

  const rawKeywords = table([row({ task_index: 0, as_hashtag: true }),
    row({ task_index: 1, keyword: '#Self Care', as_hashtag: true }),
    row({ task_index: 2, as_hashtag: false })])
  eq('HTML 原关键词不因 hashtag 配置加井号或路径承诺',
     rawKeywords.map(r => r[1]), ['selfcare', '#Self Care', 'selfcare'])
  criterion('U8.k')
}

})
await group('p5-report', () => {
suite('P5', '交付必须声明数据边界')
{
  const html = renderHtml([mk('tiktok', 'a', { tier: 'A', score: 50 })],
    { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      total: 1, tiers: { A: 1, B: 0, C: 0 }, email_count: 0,
      cross_platform_count: 0, ...testCostMeta(1, 2000000), enriched: false })
  // 下面三条以前合在一条 P5.a 里，拆开是因为它们各自独立地坏：两条 HTML 声明是
  // renderHtml 里两个各带条件的 if 块，enriched 是第三条判定（ADR-67 的就地更正）。
  // 断言整句，判据只要一半：P5.f 沿用 P5.a 原文，只要求声明「未做有效性验证」；
  // 邮箱**出处**不是红线 —— 一度写进判据，复核（#51）指出那是新加一条，不是拆，退回。
  // 代码本来就输出整句，就整句断言：断言比判据严不是问题，多出来那半句的负片是
  // M-P5-k，记在 P5 名下、不认领判据。P5.g 那句整条都是判据要的，负片是 M-P5-l。
  ok('未增强时声明邮箱来自 bio 提取、未做有效性验证',
    html.includes('邮箱来自 bio 提取，未做有效性验证'))
  criterion('P5.f')
  ok('未增强时声明无法确认粉丝是否在目标市场',
    html.includes('无法确认这批人的粉丝是否在目标市场'))
  criterion('P5.g')
  // P5.h：未配置增强层时 enriched 必须为 false。判定在 report.ts（enrichedFlag），
  // 才能在这里断言 —— 留在 render.ts 里没有任何测试够得着（CONVENTIONS 第 10 条）。
  // 下面这一条认领 P5.h，M-P5-j（未增强却报 true）是它的负片。
  eq('没跑过邮箱/地域增强 → enriched false',
    enrichedFlag([mk('tiktok', 'a', { tier: 'A', score: 50 })]), false)
  criterion('P5.h')
  // true 那两条**不认领判据**（P5.h 只管 false 那一头，见 ADR-67 的就地更正）：
  // 它们断言 enrichedFlag 本身，也是 M-P5-h（恒 false）唯一抓得住的地方。
  // 变异编号末尾的字母是流水号，跟判据的字母不是一回事 —— M-P5-h 记在 P5 名下。
  eq('邮箱增强跑过（查了没有邮箱）→ true',
    enrichedFlag([mk('tiktok', 'a', { tier: 'A', score: 50, email_verified: false })]), true)
  eq('地域增强跑过 → true',
    enrichedFlag([mk('tiktok', 'a', { tier: 'A', score: 50, audience_geo: { US: 0.5 } })]), true)

  const enriched = renderHtml([mk('tiktok', 'a', { tier: 'A', score: 50 })],
    { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      total: 1, tiers: { A: 1, B: 0, C: 0 }, email_count: 1,
      cross_platform_count: 0, ...testCostMeta(1, 2000000), enriched: true })
  ok('已增强时不再声明', !enriched.includes('未做有效性验证'))

  const empty = renderHtml([], {
    product: 'p', market: 'US', platforms: [], keywords: [], total: 0,
    tiers: { A: 0, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
    ...testCostMeta(0, 2000000), enriched: false,
    capabilities: {
      email_verification: { total: 0, measured: 0, unavailable: 0, unqueried: 0 },
      audience_geo: { total: 0, measured: 0, unavailable: 0, unqueried: 0 },
      public_post_sample: { total: 0, measured: 0, unavailable: 0, unqueried: 0 },
    },
  })
  ok('空名单也不隐藏全局数据边界',
    empty.includes('未做有效性验证') && empty.includes('无法确认'))

  // 记忆失效的两件事分开声明：这一批可能重复打扰（P4 没跑），
  // 下一批可能重复推荐（这一批没记下）。后果不同，不能合成一句。
  const base = { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
    total: 1, tiers: { A: 1, B: 0, C: 0 }, email_count: 1,
    cross_platform_count: 0, ...testCostMeta(1, 2000000), enriched: true }
  const one = [mk('tiktok', 'a', { tier: 'A', score: 50 })]

  const skipped = renderHtml(one, { ...base, memory_status: 'unreadable_ignored',
                                    memory_written: true })
  ok('未去重的名单必须在报告上说出来', skipped.includes('未做「已联系 / 已推荐」去重'))
  ok('未去重时点明后果是可能重复打扰', skipped.includes('已经联系过'))
  criterion('P5.d')

  const unwritten = renderHtml(one, { ...base, memory_status: 'ok', memory_written: false,
                                      memory_write_error: 'EACCES: permission denied' })
  ok('没写回记忆也必须说出来', unwritten.includes('未记入跨任务记忆'))
  ok('没写回时不误报成没去重', !unwritten.includes('未做「已联系 / 已推荐」去重'))
  // 没写回有两个原因：读不出来（去修 JSON）和写不进去（去看权限或磁盘）。
  // 报告替用户断定成前者，磁盘满的人会对着一份没坏的文件较劲（ADR-20）。
  ok('把真实原因带给用户', unwritten.includes('EACCES'))
  ok('不替用户断定是文件坏了', !unwritten.includes('读不出来'))

  // 旧任务目录没有这个字段，而当时读不出来的记忆会被静默当成空记忆 ——
  // 所以「不知道」必须说出口，不能悄悄当成「没问题」（ADR-18）。
  const legacy = renderHtml(one, { ...base, memory_status: 'unknown', memory_written: true })
  ok('去重状态无从确认时也要说出来', legacy.includes('无从确认'))
  ok('说的是不知道，不是「你跳过了」', !legacy.includes('运行时显式跳过'))
  ok('并给出拿到确定答案的办法', legacy.includes('重跑'))
  // unknown 有两个来源（早期采集、名单与状态没能一起落成），事后分不出是哪一个。
  // 写死其中一个就是给用户一个**编造的诊断**：被打断的那种情况会被告知
  // 「这批人由早期版本采集」，而它其实是刚刚才产生的（ADR-43）。
  ok('不替用户编一个原因 —— 两个来源事后分不出',
    !legacy.includes('早期版本') && !legacy.includes('这批人由'))

  // 认不出的取值（null、拼错、新版本写的）必须读作 unknown —— 否则报告只对
  // 两个精确字符串警告，一个认不出的值会**压掉警告**（ADR-47）
  eq('认得出的状态原样读', asMemoryStatus('ok'), 'ok')
  eq('认不出的去重状态读作 unknown', asMemoryStatus('okk'), 'unknown')
  for (const bad of [null, undefined, 'okk', 'OK', 42, {}]) {
    eq(`认不出的状态（${JSON.stringify(bad)}）读作 unknown`, asMemoryStatus(bad), 'unknown')
  }

  const normal = renderHtml(one, { ...base, memory_status: 'ok', memory_written: true })
  ok('一切正常时不加噪音',
    !normal.includes('未做「已联系 / 已推荐」去重') && !normal.includes('未记入跨任务记忆') &&
    !normal.includes('无从确认'))
}

// ─────────────────────────── 数据 ───────────────────────────

})
await group('d7-email', () => {
suite('D7', '邮箱提取支持反爬写法且不误判')
{
  eq('普通', extractEmail('biz: sarah@example.com'), 'sarah@example.com')
  eq('(at)/(dot)', extractEmail('📩 sarahbiz (at) example (dot) com'), 'sarahbiz@example.com')
  eq('[at]/[dot]', extractEmail('hi[at]brand[dot]co'), 'hi@brand.co')
  eq('空格 at/dot', extractEmail('press at example dot com'), 'press@example.com')
  eq('.co 域名不误杀', extractEmail('hi@brand.co'), 'hi@brand.co')
  eq('无邮箱', extractEmail('just a bio 🌸'), null)
  eq('空串', extractEmail(''), null)
  eq('不误判 "look at x.com"', extractEmail('look at gmail.com for more'), null)
  eq('不误判文件名', extractEmail('logo@2x.png'), null)
  ok('PR 信号 英文', PR_SIGNALS.test('DM for collabs'))
  ok('PR 信号 中文', PR_SIGNALS.test('商务合作请私信'))
  ok('PR 信号 无', !PR_SIGNALS.test('just vibes'))
}
})

await group('d8-public', () => {
suite('D8', '公开指标使用独立近期样本并保留三态与溯源')
{
  const posts = publicPosts(100, 10)
  posts.push({
    id: 'pinned', views: 9_999_999, likes: 999_999, comments: 999,
    published_at: '2025-12-01T00:00:00.000Z', is_pinned: true,
  })
  const sample = measured(posts, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', posts.length,
    'latest profile posts')
  const metrics = calculatePublicMetrics(sample, 10_000, 100)

  eq('明确 pinned 的爆款不进入中位播放',
    metrics.median_views.status === 'measured' ? metrics.median_views.value : undefined, 102.5)
  eq('六条时间戳只有五个间隔，不能冒充六个观测',
    metrics.median_post_gap_days.status === 'unavailable'
      ? metrics.median_post_gap_days.sample_size : undefined,
    5)
  const sevenPosts = publicPosts(100, 10, 7)
  const sevenSample = measured(
    sevenPosts, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', sevenPosts.length,
    'latest profile posts')
  const sevenMetrics = calculatePublicMetrics(sevenSample, 10_000, 100)
  eq('七条时间戳形成六个间隔后才返回 measured',
    sevenMetrics.median_post_gap_days.status === 'measured'
      ? sevenMetrics.median_post_gap_days.sample_size : undefined,
    6)
  eq('来源穿透到指标', metrics.view_rate.source, PUBLIC_SOURCE)
  eq('样本时间穿透到指标', metrics.view_rate.observed_at, '2026-08-26T00:00:00.000Z')
  const noFollowing = calculatePublicMetrics(sample, 10_000)
  eq('关注数缺失有独立原因，不混成其他不可用状态',
    noFollowing.following_ratio.status === 'unavailable'
      ? noFollowing.following_ratio.reason : undefined,
    'missing_following')

  const missing = publicPosts(100, 10)
  delete missing[0].comments
  const partial = measured(missing, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'partial')
  const partialMetrics = calculatePublicMetrics(partial, 10_000, 100)
  eq('缺一个评论字段后只有五个有效互动观测，不能按 0 补足',
    partialMetrics.median_engagements.status === 'unavailable'
      ? partialMetrics.median_engagements.reason : undefined,
    'insufficient_posts')
  eq('不可用仍保留真实有效样本数', partialMetrics.median_engagements.sample_size, 5)

  const notQueried: AccountAssessment = { platform: 'tiktok', handle: 'not-queried' }
  ok('未查询时 sample 字段不存在', !('sample' in notQueried))
  const privateSample = unavailable<NormalizedPublicPost[]>(
    'private_account', PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z')
  eq('查询过但私密与未查询可区分', privateSample.status, 'unavailable')
}

suite('D8', '样本窗口先定在最近 12 条，再从窗口内剔置顶')
{
  /**
   * D8 的口径是两句话：「最多取最近 12 条」+「明确标记为 pinned 的作品从绩效
   * 聚合与发布间隔中排除」。两步的**顺序**有语义 —— 先截窗口再剔置顶，剔完
   * 不足 12 条就是不足；反过来先剔置顶再截，窗口外更旧的作品会被顶上来补满，
   * 而提供方一次多返回几条完全由它自己决定，于是「最近 12 条」变成
   * 「取决于这次多返回了几条」，同一个账号换个时间查会得到不同口径的中位数。
   *
   * 这条测试能红，靠的是窗口外那几条的量级与节奏都与窗口内明显不同 ——
   * 如果两边的值差不多，补没补进来都得到同一个中位数，
   * 那就是 4-VERIFY 说的「永远不会失败的检查」。
   */
  const observedAt = '2026-08-26T00:00:00.000Z'
  const at = (daysAgo: number) =>
    new Date(Date.parse(observedAt) - daysAgo * 86_400_000).toISOString()

  /** 提供方顺序：新的在前。窗口内 12 条，其中第 3 条（i=2）是置顶。 */
  const inWindow: NormalizedPublicPost[] = Array.from({ length: 12 }, (_, i) => ({
    id: `w${i}`, views: 1_000 + i, likes: 100 + i, comments: 10 + i,
    published_at: at(i * 2), is_pinned: i === 2,
  }))
  /** 窗口之外：更旧、播放量高两个数量级、发布节奏慢十几倍。 */
  const beyond: NormalizedPublicPost[] = Array.from({ length: 4 }, (_, i) => ({
    id: `b${i}`, views: 900_000 + i, likes: 90_000 + i, comments: 9_000 + i,
    published_at: at(60 + i * 30), is_pinned: false,
  }))
  const overflowed = [...inWindow, ...beyond]
  const metrics = calculatePublicMetrics(
    measured(overflowed, PUBLIC_SOURCE, observedAt, overflowed.length,
      'provider returned more than the requested 12'),
    10_000, 100)

  // 窗口内非置顶 11 条，播放量 1000…1011 缺 1002，升序第 6 个 = 1006。
  // 先剔置顶再截窗口的话，b0 的 900_000 会补进来凑满 12 条，中位变成 1006.5。
  eq('窗口外的旧作品不得补进中位播放',
    metrics.median_views.status === 'measured' ? metrics.median_views.value : undefined, 1_006)
  eq('剔完置顶就是 11 条，样本量照实记，不去窗口外补满 12 条',
    metrics.median_views.sample_size, 11)
  // 互动量 = likes + comments = 110 + 2i，缺 i=2 的 114，升序第 6 个 = 122。
  eq('窗口外的旧作品不得补进中位互动',
    metrics.median_engagements.status === 'measured'
      ? metrics.median_engagements.value : undefined, 122)
  // 11 条时间戳形成 10 个间隔：九个 2 天、一个跨过置顶的 4 天，中位 2 天。
  eq('发布间隔只在窗口内数',
    metrics.median_post_gap_days.status === 'measured'
      ? metrics.median_post_gap_days.value : undefined, 2)
  eq('间隔观测数按窗口内的 11 条算',
    metrics.median_post_gap_days.sample_size, 10)

  // 一条都没置顶时，窗口本身也必须挡住多返回的部分。
  const noPinned = Array.from({ length: 20 }, (_, i) => ({
    id: `n${i}`, views: 1_000 + i, likes: 100 + i, comments: 10 + i,
    published_at: at(i * 2), is_pinned: false,
  }))
  eq('没有置顶时提供方多返回的部分同样进不来',
    calculatePublicMetrics(
      measured(noPinned, PUBLIC_SOURCE, observedAt, noPinned.length, 'provider overflow'),
      10_000, 100).median_views.sample_size,
    12)
}

suite('D8', '样本记录本身也守窗口：说记了几条就是几条')
{
  /**
   * 这条记录会原样写进 enrichment.json，是用户读到的溯源，也是 D10 补算时
   * 唯一的输入。提供方一次给几条由它自己决定，所以两件事必须同时成立：
   * 记下来的不超过窗口；`sample_size` 与真正记下来的条数一致 ——
   * 否则会出现 basis 说「最多 12 条」而 sample_size 写着 20 的记录，自己打自己。
   *
   * 只断言这两条不变量，不去钉 basis 的字面 —— 钉字面只能证明字符串没被改过，
   * 证不了它说的是实话。
   */
  const observedAt = '2026-08-26T00:00:00.000Z'
  const supply = (n: number): NormalizedPublicPost[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, views: 1_000 + i }))

  for (const n of [0, 1, 6, 11, 12, 13, 20]) {
    const record = publicPostSample(supply(n), PUBLIC_SOURCE, observedAt)
    const want = Math.min(n, 12)
    eq(`提供方给 ${n} 条，记录里就是 ${want} 条`,
      record.status === 'measured' ? record.value.length : undefined, want)
    eq(`提供方给 ${n} 条，sample_size 与记录里的条数一致`, record.sample_size, want)
  }

  const overflow = publicPostSample(supply(20), PUBLIC_SOURCE, observedAt)
  ok('窗口之外的第 13 条不进记录',
    overflow.status === 'measured' && overflow.value.every(p => p.id !== 's12'))
  eq('来源穿透到样本记录', overflow.source, PUBLIC_SOURCE)
  eq('采样时间穿透到样本记录', overflow.observed_at, observedAt)
}

suite('D10', '缓存命中时按当前口径重算，不靠新请求')
{
  /**
   * D10 写着「旧 enrichment 样本可在不新增 API 请求的情况下补算」。
   * 「补算」不等于「缺字段时才补」—— 缓存里的数是上一版代码算出来的，
   * 只要口径变过一次，那批数就和当前口径不是同一件事，而它们照样会被交付，
   * 且交付物上看不出区别。重算不花钱，所以这里没有取舍。
   *
   * 要一起收的还有**样本记录本身**：交付物发布的是那条记录自己的说法
   * （记着几条、sample_size、basis）。记录说 16 条、指标按 12 条里的 11 条算，
   * 就是 D8 的溯源契约被自己的产出物违反。
   *
   * 什么东西能在这几条不成立时也让检查通过：**缓存里恰好就是对的数**。
   * 所以下面的 cached 造成「活跃字段齐全、但按旧口径算」的形状 —— 那正是一份
   * 上一版代码写下的缓存。第一条断言先把这个前提钉住，否则后面全是空绿。
   */
  const observedAt = '2026-08-26T00:00:00.000Z'
  const at = (daysAgo: number) =>
    new Date(Date.parse(observedAt) - daysAgo * 86_400_000).toISOString()
  const inWindow: NormalizedPublicPost[] = Array.from({ length: 12 }, (_, i) => ({
    id: `w${i}`, views: 1_000 + i, likes: 100 + i, comments: 10 + i,
    published_at: at(i * 2), is_pinned: i === 2,
  }))
  const beyond: NormalizedPublicPost[] = Array.from({ length: 4 }, (_, i) => ({
    id: `b${i}`, views: 900_000 + i, likes: 90_000 + i, comments: 9_000 + i,
    published_at: at(60 + i * 30), is_pinned: false,
  }))
  const stored = measured([...inWindow, ...beyond], PUBLIC_SOURCE, observedAt, 16,
    'oversized sample already on disk')

  // 旧口径：先剔置顶、再截 12 条 —— 窗口外的 b0 被补了进来。
  const oldSelection = [...inWindow.filter(p => p.is_pinned !== true), ...beyond].slice(0, 12)
  const cached = calculatePublicMetrics(
    measured(oldSelection, PUBLIC_SOURCE, observedAt, oldSelection.length, 'old selection'),
    10_000, 100)
  eq('前提：这份缓存确实是旧口径算出来的',
    cached.median_views.status === 'measured' ? cached.median_views.value : undefined, 1_006.5)
  ok('前提：这份缓存的活跃字段是齐的（否则它根本不是那批漏掉的账号）',
    cached.activity_status.status === 'measured')

  const again = recomputeCachedAssessment(stored, 10_000, 100, cached)
  eq('活跃字段齐全的缓存也要按当前窗口重算',
    again.metrics.median_views.status === 'measured' ? again.metrics.median_views.value : undefined,
    1_006)
  ok('重算过的缓存要报「变了」，否则运营不知道手上的数换过', again.changed)
  eq('重算不改采样时间 —— 它属于当初那次采样，不是这次跑的时间',
    again.metrics.median_views.observed_at, observedAt)

  // 样本记录也要收：交付物照着它说样本量。
  eq('旧缓存的样本记录也收进窗口',
    again.sample.status === 'measured' ? again.sample.value.length : undefined, 12)
  eq('记录的 sample_size 与它真正记着的条数一致', again.sample.sample_size, 12)
  eq('样本记录的采样时间不动', again.sample.observed_at, observedAt)
  ok('窗口之外那几条不留在记录里',
    again.sample.status === 'measured' && again.sample.value.every(p => !p.id.startsWith('b')))

  // 幂等：已经收好、已经是当前口径的缓存，再跑一次不算改动。
  const settled = recomputeCachedAssessment(again.sample, 10_000, 100, again.metrics)
  ok('已经是当前口径的缓存不算改动，计数不虚报', !settled.changed)

  /**
   * 盘上的缓存里，受众风险是**跨账号那一步**赋过值的，不是重算时的占位符。
   * 把它算进比较，每次重跑都会把「占位符 vs 已赋值」当成变化 ——
   * locally_recomputed 就变成一个每轮都虚报的数，而它是我们自己文档里
   * 承诺「数真的换过」的那个数。
   */
  const withRisk = structuredClone(again.metrics)
  withRisk.audience_quality_risk = measured<AudienceRiskAssessment>(
    { level: 'low', flags: [], peer_size: 9 }, PUBLIC_SOURCE, observedAt, 9, 'peer comparison')
  ok('受众风险由跨账号那一步赋值，不算这一步的改动',
    !recomputeCachedAssessment(again.sample, 10_000, 100, withRisk).changed)

  ok('没有缓存时算改动', recomputeCachedAssessment(stored, 10_000, 100, undefined).changed)

  // 私密账号的缓存：样本本来就是 unavailable，不该被改成别的形状。
  const privateSample = unavailable<NormalizedPublicPost[]>(
    'private_account', PUBLIC_SOURCE, observedAt)
  const kept = recomputeCachedAssessment(privateSample, 10_000, 100, undefined)
  eq('不可用的样本记录原样留着', kept.sample, privateSample)
}

// ADR-102 §9：夹具先按公开契约手算，不以被测适配器的输出反推期望值。
suite('D8', 'IG 主页混合媒体的窗口、视频资格和独立分母')
{
  const at = '2026-09-15T00:00:00.000Z'
  const source: MetricSource = { kind: 'public_api', provider: 'tikhub',
    endpoint: '/api/v1/instagram/v2/fetch_user_posts' }
  // 前 12 条交错媒体；窗口外两条旧 Reel。图文高互动与视频零播放区分缺测和实测零。
  const posts: NormalizedPublicPost[] = Array.from({ length: 14 }, (_, i) => {
    const video = i % 2 === 1 || i >= 12
    const rank = Math.floor(i / 2) + 1
    // 未确认项刻意带有伪播放值：即使跳过适配器直接读到旧/脏缓存，消费端也须守资格。
    return { id: `ig-${i}`, video_confirmed: video,
      views: video ? (i >= 12 ? 9_000_000 : rank === 1 ? 0 : rank * 100)
        : i % 4 === 0 ? 0 : 900_000,
      likes: video ? rank * 10 : 1000 + rank - 1,
      comments: video ? rank : 20,
      published_at: new Date(Date.parse(at) - (i + 1) * 86_400_000).toISOString(),
      is_pinned: false }
  })
  const newSample = (items: NormalizedPublicPost[]) =>
    (publicPostSample as (...args: [NormalizedPublicPost[], MetricSource, string,
      'provider_returned_first12']) => ReturnType<typeof publicPostSample>)(
        items, source, at, 'provider_returned_first12')
  const sample = newSample(posts)
  eq('IG 返回先截前 12 条所有作品，不让旧 Reel 补位',
    sample.status === 'measured' ? sample.value.map(p => p.id) : [],
    posts.slice(0, 12).map(p => p.id))
  eq('新样本明示“本次端点返回前 12 条作品”的有限覆盖范围',
    sample.status === 'measured' ? (sample as typeof sample & { media_scope?: string }).media_scope : undefined,
    'provider_returned_first12')
  ok('新样本 basis 明示提供方返回窗口，不声称账号全量', sample.status === 'measured'
    && /returned|provider|endpoint|api|返回|提供方|端点/i.test(sample.basis)
    && /12/.test(sample.basis) && !/all (?:profile )?(?:posts|media)|所有作品/i.test(sample.basis))
  criterion('D8.e', 'D8.o')
  tension('D8', 'P5')
  const metrics = calculatePublicMetrics(sample, 1000, 10)
  const value = (m: { status: string; value?: unknown }) => m.status === 'measured' ? m.value : undefined
  eq('IG 只有 6 条肯定视频且有播放，真实 0 参加中位数',
    [value(metrics.median_views), metrics.median_views.sample_size], [350, 6])
  eq('播粉比只以视频中位播放除粉丝数',
    [value(metrics.view_rate), metrics.view_rate.sample_size], [0.35, 6])
  const noFollowers = calculatePublicMetrics(sample, 0, 10).view_rate
  eq('IG 播粉比分母为 0 时不交付数值', noFollowers.status, 'unavailable')
  const equalViews = posts.map(p => ({ ...p, ...(p.video_confirmed && p.id !== 'ig-12'
    && p.id !== 'ig-13' ? { views: 200 } : {}) }))
  const equalReach = calculatePublicMetrics(newSample(equalViews), 1000, 10).reach_consistency
  eq('六条同播放量视频的触达稳定度为 1，不钉 P25 插值实现',
    [value(equalReach), equalReach.sample_size], [1, 6])
  const zeroViews = posts.map(p => ({ ...p, ...(p.video_confirmed && Number(p.id.slice(3)) < 12
    ? { views: 0 } : {}) }))
  eq('六条视频中位播放为 0 时触达稳定度不除 0',
    calculatePublicMetrics(newSample(zeroViews), 1000, 10).reach_consistency.status,
    'unavailable')
  eq('真实 0 不作播放互动率除数，剩 5 条不可冒充 6 条',
    [metrics.engagement_rate_views.status, metrics.engagement_rate_views.sample_size],
    ['unavailable', 5])
  criterion('D8.h', 'D8.i', 'D8.j', 'D8.k')
  tension('D8', 'P1')
  eq('六条未证实视频的高互动也参与全作品中位互动',
    [value(metrics.median_engagements), metrics.median_engagements.sample_size,
      value(metrics.engagement_rate_followers)], [543, 12, 0.543])
  eq('IG 粉丝互动率的有效观测数包含未证实视频作品',
    metrics.engagement_rate_followers.sample_size, 12)
  eq('全作品 12 条有效日期形成 11 个间隔',
    [value(metrics.median_post_gap_days), metrics.median_post_gap_days.sample_size], [1, 11])
  eq('最新非视频作品决定最近发布和当前活跃',
    [value(metrics.latest_post_at), value(metrics.activity_status)],
    ['2026-09-14T00:00:00.000Z', 'active'])
  criterion('D8.l', 'D8.m', 'D8.n', 'D10.e', 'D10.f')

  const quote: CollaborationQuote = { amount: 770, currency: 'USD', platform: 'instagram',
    format: 'instagram_reel', quantity: 1, source: 'creator_quote', observed_at: at }
  const account: AccountAssessment = { platform: 'instagram', handle: 'mixed', followers: 1000,
    following: 10, sample, metrics, collaboration_quote: measured(quote,
      { kind: 'manual', provider: 'operator' }, at, 1, 'creator Reel quote') }
  const efficiency = calculateQuoteEfficiency(account)!
  eq('Reel eCPM 只除以六条确认视频的中位播放',
    value(efficiency.implied_ecpm!), 2200)
  eq('Reel eCPE 只除以确认视频的 38.5 中位互动，不借全作品 543',
    [value(efficiency.implied_ecpe!), efficiency.implied_ecpe?.sample_size], [20, 6])
  ok('Reel eCPE basis 说明确认视频互动分母', efficiency.implied_ecpe?.status === 'measured'
    && /video|reel|视频/i.test(efficiency.implied_ecpe.basis)
    && /confirm|affirm|确认|肯定|有视频证据/i.test(efficiency.implied_ecpe.basis))
  criterion('D9.d', 'D9.e', 'D9.f')
  tension('D9', 'P5')
  const unqueriedAccount: AccountAssessment = { ...account, handle: 'unqueried',
    sample: undefined, metrics: undefined }
  eq('有 Reel 报价但主页未查询时不生成两个效率估值',
    calculateQuoteEfficiency(unqueriedAccount), undefined)
  const unqueriedCreator = mk('instagram', 'unqueried', { tier: 'A', score: 60 })
  attachAssessments([unqueriedCreator], { version: 1, updated_at: at,
    accounts: { [accountKey('instagram', 'unqueried')]: unqueriedAccount } })
  eq('未采样账号的表格保留报价，两个效率位各写未查询',
    ['collaboration_quote', 'implied_ecpm', 'implied_ecpe']
      .map(field => toRow(unqueriedCreator)[HEADERS.indexOf(field as typeof HEADERS[number])]),
    ['USD 770 / 1 instagram_reel (creator_quote)', '未查询', '未查询'])
  const unqueriedHtml = renderHtml([unqueriedCreator], {
    product: 'p', market: 'US', platforms: ['instagram'], keywords: [], total: 1,
    tiers: { A: 1, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
    ...testCostMeta(), enriched: true,
  })
  eq('未采样账号的 HTML 报价栏仅将两个效率标为未查询',
    unqueriedHtml.match(/<div class="commercial">([^<]+)<\/div>/)?.[1]?.trim(),
    '合作报价 USD 770 / 1 instagram_reel · creator_quote · 2026-09-15 · 隐含 eCPM 未查询 · 隐含 eCPE 未查询')
  criterion('D9.d', 'P1.e')
  tension('D9', 'P1')
  const incomplete = posts.map(p => ({ ...p }))
  delete incomplete[11].comments
  const incompleteSample = newSample(incomplete)
  const incompleteMetrics = calculatePublicMetrics(incompleteSample, 1000, 10)
  const incompleteEfficiency = calculateQuoteEfficiency({ ...account,
    sample: incompleteSample, metrics: incompleteMetrics })!
  eq('六视频仅五个完整赞评：eCPM 可测，eCPE 不可测',
    [incompleteEfficiency.implied_ecpm?.status, incompleteEfficiency.implied_ecpe?.status,
      incompleteEfficiency.implied_ecpe?.sample_size], ['measured', 'unavailable', 5])
  eq('缺评论不补 0，全作品仍有 11 个有效互动观测',
    [incompleteMetrics.median_engagements.status, incompleteMetrics.median_engagements.sample_size],
    ['measured', 11])
  const noView = posts.map(p => ({ ...p }))
  delete noView[11].views
  const noViewSample = newSample(noView)
  const noViewEfficiency = calculateQuoteEfficiency({ ...account, sample: noViewSample,
    metrics: calculatePublicMetrics(noViewSample, 1000, 10) })!
  eq('仅五个视频播放：eCPM 不可测，但六个视频赞评仍可算 eCPE',
    [noViewEfficiency.implied_ecpm?.status, value(noViewEfficiency.implied_ecpe!)],
    ['unavailable', 20])
  criterion('D8.g', 'D9.e', 'D9.f')
  tension('D9', 'P1')

  const legacyBasis = 'up to 12 latest short-form profile posts; '
    + 'pinned included for recency and excluded from aggregates'
  const oldPosts = posts.filter(p => p.video_confirmed && Number(p.id.slice(3)) < 12)
    .map(({ video_confirmed: _oldMarker, ...p }) => p)
  const oldAt = at
  const legacy = recomputeCachedAssessment(measured(oldPosts, source, oldAt, 6, legacyBasis),
    1000, 10, undefined)
  eq('确证旧视频筛后样本保持历史视频播放，但当前活跃未知',
    [legacy.metrics.median_views.status, legacy.metrics.activity_status.status],
    ['measured', 'unavailable'])
  eq('历史仅视频样本没有账号当前发布时间或距今状态',
    [legacy.metrics.latest_post_at.status, legacy.metrics.days_since_last_post.status],
    ['unavailable', 'unavailable'])
  eq('旧视频样本不补图文、不改观测时间和来源，范围标为历史仅视频',
    [legacy.sample.status === 'measured' ? legacy.sample.value.map(p => p.id) : [],
      legacy.sample.observed_at, legacy.sample.source,
      (legacy.sample as typeof legacy.sample & { media_scope?: string }).media_scope],
    [oldPosts.map(p => p.id), oldAt, source, 'legacy_video_filtered_first12'])
  const unknown = recomputeCachedAssessment(measured(oldPosts, source, oldAt, 6,
    'up to 12 latest profile posts; media type was not recorded'), 1000, 10, undefined)
  const unknownEfficiency = calculateQuoteEfficiency({ ...account, sample: unknown.sample,
    metrics: unknown.metrics })!
  eq('旧 basis 不匹配时不从 views 推视频或当前活跃',
    [unknown.metrics.median_views.status, unknown.metrics.activity_status.status,
      unknown.metrics.median_engagements.status,
      (unknown.sample as typeof unknown.sample & { media_scope?: string }).media_scope],
    ['unavailable', 'unavailable', 'unavailable', 'unknown'])
  eq('旧 basis 不匹配时 Reel eCPM/eCPE 都不可用',
    [unknownEfficiency.implied_ecpm?.status, unknownEfficiency.implied_ecpe?.status],
    ['unavailable', 'unavailable'])
  criterion('D8.p', 'D8.q', 'D10.g')

  const riskMetrics = calculatePublicMetrics(sample, 10_000, 100)
  const oldRiskMetrics = calculatePublicMetrics(legacy.sample, 10_000, 100)
  const riskAccount: AccountAssessment = { ...account, followers: 10_000, following: 100,
    metrics: riskMetrics }
  const accounts: Record<string, AccountAssessment> = {
    [accountKey('instagram', 'mixed')]: riskAccount,
  }
  for (let i = 0; i < 8; i++) {
    accounts[accountKey('instagram', `new-${i}`)] = { ...riskAccount, handle: `new-${i}`,
      metrics: structuredClone(riskMetrics) }
    accounts[accountKey('instagram', `old-${i}`)] = { ...riskAccount, handle: `old-${i}`,
      sample: legacy.sample, metrics: structuredClone(oldRiskMetrics) }
  }
  assignAudienceRisks(accounts)
  const risk = accounts[accountKey('instagram', 'mixed')].metrics?.audience_quality_risk
  eq('IG 同行基线只纳入同媒体范围的八个账号',
    risk?.status === 'measured' ? risk.value.peer_size : risk, 8)
  criterion('F8.e')
  const scopedSample = sample.status === 'measured' ? { ...sample, value: sample.value.length } : sample
  const scoped = mk('instagram', 'mixed', { tier: 'A', score: 60,
    account_assessment: { ...account, sample: scopedSample } })
  const scopeColumn = HEADERS.indexOf('metrics_sample_scope')
  ok('IG 样本范围有独立表格列', scopeColumn >= 0)
  ok('IG CSV 行明确写本次端点返回范围',
    /本次端点返回|provider.{0,20}returned/i.test(String(toRow(scoped)[scopeColumn] ?? '')))
  const populatedSheets = buildSheets([scoped]).filter(sheet => sheet.rows.length)
  ok('IG XLSX 有账号的各表共用同一范围说明', populatedSheets.length > 0
    && populatedSheets.every(sheet => /本次端点返回|provider.{0,20}returned/i
      .test(String(sheet.rows[0]?.[scopeColumn] ?? ''))))
  criterion('U7.f')
}

})
await group('h-spec', () => {
harness('需求登记表的完整性判定')
{
  const req = (id: string, over: Partial<Req> = {}): Req =>
    ({ id, cat: id[0], pri: 'P0', text: `${id} 要什么`,
       accept: [{ id: `${id}.a`, text: `${id} 怎么算满足` }], ...over })
  const CATS = { D: '数据', P: '红线' }

  // 内容指纹：键序无关（磁盘上的键序由写下它的那一版代码决定），内容一变就变
  const a = req('D1')
  const reordered = JSON.parse(JSON.stringify({
    accept: a.accept, id: a.id, text: a.text, pri: a.pri, cat: a.cat })) as Req
  eq('指纹与键序无关', contentHash([a], CATS), contentHash([reordered], CATS))
  ok('内容一变指纹就变', contentHash([a], CATS) !== contentHash([req('D1', { accept: [{ id: 'D1.a', text: '改了' }] })], CATS))
  // 嵌套字段同样是需求内容。**这里栽过一次**：拿顶层键当白名单时,
  // 交点会被序列化成一个空对象,裁决改成相反的意思指纹纹丝不动（ADR-18）。
  const withT = req('D1', { tension: [{ with: 'P1', ruling: '红线赢' }] })
  ok('改交点的裁决,指纹必须变',
    contentHash([withT], CATS) !== contentHash([req('D1', { tension: [{ with: 'P1', ruling: '相反的裁决' }] })], CATS))
  ok('改交点指向谁,指纹必须变',
    contentHash([withT], CATS) !== contentHash([req('D1', { tension: [{ with: 'P2', ruling: '红线赢' }] })], CATS))
  ok('改作废理由,指纹必须变',
    contentHash([req('D1', { deprecated: { since: '2026-01-01', why: '甲' } })], CATS) !==
    contentHash([req('D1', { deprecated: { since: '2026-01-01', why: '乙' } })], CATS))
  ok('顺序不同就是不同的登记表',
    contentHash([req('D1'), req('D2')], CATS) !== contentHash([req('D2'), req('D1')], CATS))
  // 分类表也进指纹：只改一个分类的说明，渲染出来的文档就变了 ——
  // 指纹不动的话「派生元数据」名不副实（ADR-22）。
  ok('只改分类表的说明，指纹也必须变',
    contentHash([req('D1')], CATS) !== contentHash([req('D1')], { ...CATS, D: '数据（改过）' }))
  // 分类表的**顺序**也影响渲染（分节按插入顺序排），所以也得进指纹。
  // canonical 会把对象的键排序 —— 用 entries 数组绕开它（ADR-28）。
  ok('只调换分类表的顺序，指纹也必须变',
    contentHash([req('D1')], { D: '数据', P: '红线' }) !==
    contentHash([req('D1')], { P: '红线', D: '数据' }))

  // 作废：编号保留，不进现行表，单独成节
  const dead = req('D9', { deprecated: { since: '2026-01-01', why: '需求本身不成立了' } })
  eq('作废的不算现行需求', active([req('D1'), dead]).map(r => r.id), ['D1'])
  const withTension = req('D2', { tension: [{ with: 'P1', ruling: '撞上时 P1 赢', adr: 'ADR-01' }] })
  const html = renderTables([req('D1'), withTension, dead], { D: '数据' })
  ok('交点的裁决渲染进人类可读的那一份', html.includes('撞上时 P1 赢'))
  ok('并指出裁决记在哪', html.includes('ADR-01'))
  ok('作废的不混进现行表', !html.split('已作废')[0].includes('~~D9~~') &&
    !html.split('###')[1].includes('D9'))
  ok('但仍然列出来 —— 编号不回收复用', html.includes('已作废') && html.includes('D9'))
  ok('并说明为什么作废', html.includes('需求本身不成立了'))
  // 单元格里的竖线要转义，不然多切一列；紧挨在竖线前面的反斜杠先加倍，否则它把后面那个转义吃掉
  // （#39 合入后的评审意见）；别处的反斜杠不动 —— 文本是 Markdown，代码段里的 `\d+`
  // 一律转就渲染成 `\\d+`（#41 评审意见）
  const cells = renderTables([req('D1', { text: '甲|乙 `\\d+`', accept: [{ id: 'D1.a', text: '丙\\|丁' }] })], { D: '数据' })
  ok('需求文本里的竖线转义', cells.includes('甲\\|乙'))
  ok('判据里本来就有的反斜杠先转，再转竖线', cells.includes('丙\\\\\\|丁'))
  ok('代码段里的反斜杠不动', cells.includes('`\\d+`'))

  const adrs = new Set(['ADR-01'])
  // 形状校验被拿掉时，后面的关系检查会在缺字段的需求上直接抛 —— 那要作为断言失败被抓到
  const bad = (rs: Req[]) => { try { return validateRegistry(rs, adrs, ['D', 'P']).length } catch { return -1 } }
  // 同上，只是下面有一条要看具体的问题文本：抛出来时得是这条断言失败，不是测试进程死在半路
  const msgs = (rs: Req[]) => { try { return validateRegistry(rs, adrs, ['D', 'P']) } catch { return ['抛了'] } }
  eq('干净的登记表没有问题', bad([req('D1'), req('P1')]), 0)
  ok('编号重复被抓到', bad([req('D1'), req('D1')]) > 0)
  ok('交点指向自己被抓到',
    bad([req('D1', { tension: [{ with: 'D1', ruling: '裁决' }] })]) > 0)
  ok('交点指向不存在的编号被抓到',
    bad([req('D1', { tension: [{ with: 'ZZ9', ruling: '裁决' }] })]) > 0)
  ok('交点没写裁决被抓到',
    bad([req('D1', { tension: [{ with: 'P1', ruling: '  ' }] }), req('P1')]) > 0)
  ok('同一个方向声明两次被抓到 —— 两条裁决可能相反，而一次认领会同时算数',
    bad([req('D1', { tension: [{ with: 'P1', ruling: '甲' }, { with: 'P1', ruling: '乙' }] }),
         req('P1')]) > 0)
  ok('两边各声明一次被抓到', bad([
    req('D1', { tension: [{ with: 'P1', ruling: '裁决' }] }),
    req('P1', { tension: [{ with: 'D1', ruling: '另一种说法' }] })]) > 0)
  ok('决策记录编号不存在被抓到', bad([req('D1', { adr: ['ADR-99'] })]) > 0)
  eq('存在的就放行', bad([req('D1', { adr: ['ADR-01'] })]), 0)
  ok('正文点了决策记录、adr 里却没有，被抓到',
    bad([req('D1', { text: '这句话按 ADR-01 定的' })]) > 0)
  ok('判据里点的一样算 —— 正文干净不等于这条需求干净',
    bad([req('D1', { accept: [{ id: 'D1.a', text: '按 ADR-01 算满足' }] })]) > 0)
  eq('正文点了、adr 里也登记了，放行',
    bad([req('D1', { text: '这句话按 ADR-01 定的', adr: ['ADR-01'] })]), 0)
  // 红线不许作废：active() 会把作废的挡在渲染和审计之外，于是红线条数
  // 静静少一条，它的测试、变异、交点要求全部随之消失，而检查报「全部通过」。
  ok('红线被标作废，当场拦下',
    bad([req('P4', { deprecated: { since: '2026-01-01', why: '有理由' } })]) > 0)
  eq('非红线作废仍然放行',
    bad([req('D1', { deprecated: { since: '2026-01-01', why: '有理由' } })]), 0)
  ok('作废没写理由被抓到',
    bad([req('D1', { deprecated: { since: '2026-01-01', why: '' } })]) > 0)
  ok('取代者不存在被抓到', bad([req('D1',
    { deprecated: { since: '2026-01-01', why: '有', superseded_by: 'ZZ9' } })]) > 0)
  // 分类表里没有的 cat：渲染时整条被跳过，而一致性检查比的是生成结果和生成结果，
  // 漏掉的那条与它自己完全一致 —— 于是登记表和它号称的渲染装着不一样的需求。
  const strayCat = req('Z1', { cat: 'Z' })
  ok('分类不在分类表里被抓到', bad([strayCat]) > 0)
  ok('而它确实不会出现在渲染里', !renderTables([strayCat], { D: '数据' }).includes('Z1'))
  // 更难看见的一种：分类**声明过**，只是与编号前缀不符。两个值各自合法，
  // 而下游全都按分类分流 —— 一条红线被挪进别的分类，审计就不再要求它有
  // 测试和变异，还会报出比项目声明的更少的红线条数，然后照样通过（ADR-23）。
  ok('分类声明过但与编号前缀不符也被抓到', bad([req('P4', { cat: 'D' })]) > 0)
  eq('前缀与分类一致就放行', bad([req('P4'), req('D4')]), 0)

  // 验收判据：编号与需求同规矩（稳定、不回收复用），因为下游按它认领覆盖
  ok('没有判据被抓到', bad([req('D1', { accept: [] })]) > 0)
  ok('判据编号挂在别的需求名下被抓到',
    bad([req('D1', { accept: [{ id: 'D2.a', text: 'x' }] })]) > 0)
  ok('判据编号重复被抓到', bad([req('D1', { accept:
    [{ id: 'D1.a', text: 'x' }, { id: 'D1.a', text: 'y' }] })]) > 0)
  ok('判据没有内容被抓到', bad([req('D1', { accept: [{ id: 'D1.a', text: '  ' }] })]) > 0)
  ok('判据都渲染出来，且带着自己的编号', (() => {
    const html = renderTables([req('D1', { accept:
      [{ id: 'D1.a', text: '前一半' }, { id: 'D1.b', text: '后一半' }] })], { D: '数据' })
    return html.includes('D1.a') && html.includes('前一半') &&
           html.includes('D1.b') && html.includes('后一半')
  })())

  // 形状:关系检查全都假定字段在、类型对,而登记表是 JSON.parse 出来的,
  // `Req` 那个接口运行时一个字段都不拦。判据是**渲染实际读哪些字段** ——
  // 漏一个,`undefined` 就被写进生成的表格,`--write` 原样存下,而一致性
  // 检查比的是生成结果和生成结果,于是全绿(ADR-33)。
  const strip = (r: Req, f: string) => { const c = { ...r } as Record<string, unknown>; delete c[f]; return c as unknown as Req }
  for (const f of ['id', 'cat', 'pri', 'text']) {
    ok(`需求缺 ${f} 被抓到`, bad([strip(req('D1'), f)]) > 0)
  }
  ok('作废缺 since 被抓到 —— 它只被渲染、不被任何关系检查碰,是静默那一类',
    bad([req('D1', { deprecated: { why: '有理由' } as never })]) > 0)
  ok('而缺了它确实会把 undefined 写进文档', renderTables(
    [req('D1', { deprecated: { why: '有理由' } as never })], { D: '数据' }).includes('undefined'))
  ok('pri 缺失同样会把 undefined 写进文档',
    renderTables([strip(req('D1'), 'pri')], { D: '数据' }).includes('undefined'))
  ok('accept 不是数组被抓到', bad([req('D1', { accept: '一段话' as never })]) > 0)
  ok('判据不是对象被抓到', bad([req('D1', { accept: [null as never] })]) > 0)
  ok('交点不是对象被抓到', bad([req('D1', { tension: [null as never] })]) > 0)
  ok('交点缺 with 被抓到', bad([req('D1', { tension: [{ ruling: '裁决' } as never] })]) > 0)
  ok('adr 不是字符串数组被抓到', bad([req('D1', { adr: [7 as never] })]) > 0)
  ok('形状不对时不接着跑关系检查 —— 否则只会抛 TypeError,把真正的问题盖掉',
    msgs([strip(req('D1'), 'text')]).every(m => m.includes('不是非空字符串')))

  // 根的形状：上面查的全是需求数组，而数组是从根对象里取出来的 —— 取之前那一层谁也没查。
  // 分类表里一条说明写成 null，渲染成「### P · null」写进 SPEC，一致性检查比的是
  // 生成结果和生成结果，照样绿（#44 合入后的评审意见）
  const root = (over: Record<string, unknown> = {}) =>
    rootProblems({ categories: CATS, requirements: [req('D1')], ...over }).length
  eq('根的形状对就放行', root(), 0)
  ok('根不是对象被抓到', rootProblems(null).length > 0 && rootProblems([]).length > 0)
  ok('requirements 不是数组被抓到', root({ requirements: { D1: req('D1') } }) > 0)
  ok('缺 categories 被抓到', root({ categories: undefined }) > 0)
  ok('分类表是空的被抓到 —— 一条需求都渲染不出来', root({ categories: {} }) > 0)
  ok('分类的说明是 null 被抓到', root({ categories: { ...CATS, P: null } }) > 0)
  ok('而它确实会把 null 写进文档',
    renderTables([req('P1')], { P: null as never }).includes('### P · null'))
  ok('分类的说明是空白被抓到', root({ categories: { ...CATS, P: '  ' } }) > 0)
  ok('分类前缀是空白被抓到', root({ categories: { ...CATS, ' ': '说明' } }) > 0)

  // 变异记在谁名下：审计拿它回答「这条需求有没有变异守着」。写成一个**不存在**
  // 的编号时，变异照样跑、照样被抓到，全绿 —— 而它对任何一条需求都不算数（ADR-34）。
  const known = new Set(['P4', 'P4.a'])
  eq('记在真实需求名下 —— 放行', orphanAttributions([{ id: 'M-x', req: 'P4' }], known), [])
  eq('记在验收判据名下 —— 也放行，豁免常常只豁免其中一条判据',
    orphanAttributions([{ id: 'M-x', req: 'P4.a' }], known), [])
  eq('记在检查链自己名下 —— 放行', orphanAttributions([{ id: 'M-x', req: HARNESS }], known), [])
  eq('记在不存在的编号名下 —— 抓到', orphanAttributions(
    [{ id: 'M-x', req: 'H4' }], known).map(o => o.req), ['H4'])

  // 编号重复也在「静默」那一半：编号不进任何判定，只进报告，所以复制一条忘了改字母时
  // 两条都照跑、照样各自被抓到，全绿。代价在报告读不回去 —— 一条存活一条被抓时，
  // 日志里 `✓ M-X` 和 `✗ M-X` 并排，「去修 M-X」指不出该修表里哪一行（负片 M-H7-b）。
  eq('编号都不重复 —— 放行', duplicateIds([{ id: 'M-a' }, { id: 'M-b' }]), [])
  eq('同一个编号出现两次 —— 抓到', duplicateIds([{ id: 'M-a' }, { id: 'M-a' }]), ['M-a'])
  // 出现三次只报一次：报告要的是「哪个编号重复了」，不是「重复了几次」
  eq('出现三次也只报一次', duplicateIds([{ id: 'M-a' }, { id: 'M-a' }, { id: 'M-a' }]), ['M-a'])
  eq('多个编号各自重复都要报',
    duplicateIds([{ id: 'M-a' }, { id: 'M-b' }, { id: 'M-a' }, { id: 'M-b' }]), ['M-a', 'M-b'])
  // 同一条需求下有多条变异是常态 —— 那不是重复，这条判定只看编号本身
  const sameReq: { id: string; req: string }[] = [{ id: 'M-a', req: 'P4' }, { id: 'M-b', req: 'P4' }]
  eq('同一个 req 下多条不同编号 —— 放行', duplicateIds(sameReq), [])

  // 两种毛病同时在时先报哪一种，是有语义的先后：记错名下那份报告印的也是 id，
  // 编号还没唯一时它自己就指不出该改表里哪一行。留在入口里的话，把两段调换或者
  // 删掉一段，上面那两组断言照样全绿（负片 M-H7-c）。
  const bothBad = [{ id: 'M-a', req: 'P4' }, { id: 'M-a', req: 'H4' }]
  eq('重复与记错名下同时在 —— 先报重复', attributionFault(bothBad, bothBad, known)?.kind, 'duplicate')
  eq('只有记错名下 —— 报记错名下',
    attributionFault([{ id: 'M-a' }], [{ id: 'M-a', req: 'H4' }], known)?.kind, 'orphan')
  eq('两样都没有 —— 放行', attributionFault([{ id: 'M-a' }], [{ id: 'M-a', req: 'P4' }], known), undefined)
  // 显式豁免也走记错名下这一关，但不参与编号唯一 —— 两份名单不是同一份
  eq('豁免记错名下也抓得到', attributionFault(
    [{ id: 'M-a' }], [{ id: '豁免 H4', req: 'H4' }], known)?.kind, 'orphan')

  // 反向：决策记录提到的编号必须真实存在 —— 「编号不回收复用」查得了的那一半
  const doc = '## ADR-07 标题\n\n- 冲击的需求：D1 · D9\n'
  eq('决策记录里的编号也被解析出来', [...adrIdsIn(doc)], ['ADR-07'])
  // 拆成一文件一条之后记录标题是一级的 `# ADR-NN`（docs/adr/ 里的写法），也得认；
  // 标题与编号之间的空白按 adr-sync 同一约定，不止一个空格也行
  eq('单文件里的一级标题也认', [...adrIdsIn('# ADR-08 标题\n')], ['ADR-08'])
  eq('标题与编号之间多个空白也认', [...adrIdsIn('#  ADR-09 标题\n')], ['ADR-09'])
  // 引文里举例的标题不算记录 —— 不遮住，一条需求引用 ADR-99 就被当成真实存在（评审第一轮）
  eq('围栏里的示例标题不算记录',
    [...adrIdsIn('# ADR-08 标题\n\n```md\n# ADR-99 示例\n```\n')], ['ADR-08'])
  eq('HTML 注释里的示例标题不算记录',
    [...adrIdsIn('# ADR-08 标题\n<!--\n## ADR-98 示例\n-->\n')], ['ADR-08'])
  ok('决策记录指向不存在的需求被抓到',
    danglingAdrRefs(doc, new Set(['D1']), ['D']).length > 0)
  eq('都存在时不报', danglingAdrRefs(doc, new Set(['D1', 'D9']), ['D']).length, 0)
  // 前缀从分类表派生，不写死形状 —— 写死的话换个项目这条检查会安静地失效
  ok('两字母前缀的项目一样查得到',
    danglingAdrRefs('- 冲击的需求：REQ7', new Set<string>(), ['REQ']).length > 0)
  eq('没有分类前缀就不装作查过', danglingAdrRefs(doc, new Set<string>(), []).length, 0)
  // 前缀各自转义：登记表那头认了含正则元字符的前缀，这里不能炸（#36 合入后的评审意见）
  // 炸掉的话要作为断言失败报出来，不是让测试进程死在半路
  const cpp = (ids: Set<string>) => {
    try { return danglingAdrRefs('- 冲击的需求：C++7', ids, ['C++']).length }
    catch (e) { return String(e) }
  }
  eq('前缀含正则元字符也查得到', cpp(new Set<string>()), 1)
  eq('前缀含正则元字符且编号存在时不报', cpp(new Set(['C++7'])), 0)
  // 引文里举例的编号不算引用 —— 与记录标题同一把遮罩
  eq('围栏里的示例编号不算引用',
    danglingAdrRefs('## ADR-07 标题\n\n```md\n- 冲击的需求：D99\n```\n', new Set<string>(), ['D']).length, 0)
  eq('HTML 注释里的示例编号不算引用',
    danglingAdrRefs('<!--\n- 冲击的需求：D98\n-->\n', new Set<string>(), ['D']).length, 0)
  // 行内注释只去掉注释那一段，行本身还是元数据 —— 整行按引文算会漏报（#38 合入后的评审意见）
  eq('带行内注释的元数据行照查',
    danglingAdrRefs('- 冲击的需求：D99 <!-- 待定 -->', new Set<string>(), ['D']).length, 1)
  eq('行内注释里举例的编号不算引用',
    danglingAdrRefs('- 冲击的需求：D1 <!-- 原来写的是 D97 -->', new Set(['D1']), ['D']).length, 0)
  // 只从元数据行上剥注释：围栏的闭合行后面只能是空白，先剥注释再算遮罩会把
  // ``` <!-- 示例 --> 当成闭合，示例里接下来的编号就露出来了（#40 第二轮评审意见）
  eq('围栏里带注释的假闭合行不闭合，后面的示例编号仍是引文',
    danglingAdrRefs('```md\n``` <!-- 示例 -->\n- 冲击的需求：D99\n```\n', new Set<string>(), ['D']).length, 0)
  // 开着的跨行注释里，元数据形状的行上那个关闭记号是在关注释：先剥掉它，注释关不上，
  // 后面真的元数据行被整行盖住（#40 合入后的评审意见）
  eq('开着的跨行注释里的元数据行不剥，后面真的元数据行照查',
    danglingAdrRefs('<!-- 说明\n- 冲击的需求：D98 <!-- x -->\n- 冲击的需求：D99\n', new Set<string>(), ['D']).length, 1)
  // 边界按编号自己的文法定，不借 JavaScript 的词边界：前缀以标点开头时，
  // 冒号与 `+` 之间没有词边界，`+C7` 永远匹配不到（#38 合入后的评审意见）
  // `+` 也是正则元字符，同样不能让不转义的实现把测试进程炸死
  const plus = (ids: Set<string>) => {
    try { return danglingAdrRefs('- 冲击的需求：+C7', ids, ['+C']).length }
    catch (e) { return String(e) }
  }
  eq('前缀以标点开头也查得到', plus(new Set<string>()), 1)
  eq('前缀以标点开头且编号存在时不报', plus(new Set(['+C7'])), 0)
  // 主干上真实的写法：加粗、连字符区间、括号说明、间隔号 —— 边界换法不能把它们查漏或拆散
  const real = '- 冲击的需求：**P1–P5**（守它们的检查可被绕过）· D4 · D10'
  eq('真实写法里的编号都查得到',
    danglingAdrRefs(real, new Set(['P1', 'D4', 'D10']), ['P', 'D']).length, 1)
  eq('相邻的数字不被拆成别的编号',
    danglingAdrRefs(real, new Set(['P1', 'P5', 'D4', 'D10']), ['P', 'D']).length, 0)
  // 下划线也算标识符字符：`legacy_D99`、`D99_note` 这种说明性记号里嵌着的编号不是引用（#40 评审意见）
  eq('嵌在下划线记号里的编号不算引用',
    danglingAdrRefs('- 冲击的需求：D1（legacy_D99、D99_note 已作废）', new Set(['D1']), ['D']).length, 0)
}

harness('审计对一条需求的裁定')
{
  const req = (id: string, crit: string[]): Req => ({
    id, cat: id[0], pri: 'P0', text: 'x',
    accept: crit.map(c => ({ id: `${id}.${c}`, text: `${id}.${c} 要什么` })),
  })
  const ev = (over: Partial<Evidence> = {}): Evidence => ({
    tested: true, mutated: true, exempt: false, impl: 1, refs: 1,
    claimedCriteria: new Set<string>(), entryCriteria: new Set<string>(),
    exemptIds: new Set<string>(), mutatedCriteria: new Set<string>(),
    selfcheckMutatedCriteria: new Set<string>(), ...over,
  })

  // 红线：每一条判据都要有认领，缺一条就是硬失败
  const p = req('P9', ['a', 'b'])
  eq('红线判据全认领 → 通过',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a', 'P9.b']) })).hard, 0)
  eq('红线漏一条判据 → 硬失败',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a']) })).hard, 1)
  eq('红线一条都没认领 → 两条都硬失败', requirementVerdict(p, ev()).hard, 2)
  eq('判据级豁免算数',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a']),
                              exemptIds: new Set(['P9.b']) })).hard, 0)
  // 两种认领都算数：自检端到端跑过的那一条，与单元断言认的那一条，在「这条判据
  // 有没有人认领」这件事上同权。少掉任一半，只由那一头守着的判据当场报成没人认领 ——
  // 红线那边就是硬失败，而它明明每一次检查都真跑过（M-H31-a/b，落地 3 第二片）。
  // ⚠️ 这两条要配上那条改跑自检的负片才通过 —— 落地 4 起，只由自检认领的判据
  // 必须有一条 `by: "selfcheck"` 的负片，下面那组专门钉这一条。
  eq('一条判据只由自检认领 → 照样算认领，不是硬失败',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a']),
                               entryCriteria: new Set(['P9.b']),
                               selfcheckMutatedCriteria: new Set(['P9.b']) })).hard, 0)
  eq('两条判据都只由自检认领 → 同样通过',
    requirementVerdict(p, ev({ entryCriteria: new Set(['P9.a', 'P9.b']),
                               selfcheckMutatedCriteria: new Set(['P9.a', 'P9.b']) })).hard, 0)
  eq('只由单元认领 → 照样算认领（别把哪一半丢了）',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a', 'P9.b']) })).hard, 0)
  // 认领之后那条豁免不再算缺口 —— 否则逐条说「认领了」、汇总说「还豁免着」，
  // 一份报告两种说法（落地 3 第二片同时改了汇总那一行）
  eq('自检认领了的判据，不再算进豁免那一栏',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a']),
                               entryCriteria: new Set(['P9.b']),
                               exemptIds: new Set(['P9.b']) })).exempted, 0)
  // 报告里「判据 N/M」的那个 N 也要数上自检认的：只验 hard 与 exempted 的话，把 claimed
  // 那一行改回只看单元那一份，上面四条照样全绿，而报告悄悄少报一条 —— 实测 P3 从
  // 「判据 2/2」退回「判据 1/2」、D6 从 4/6 退回 3/6，**而这一片的招牌结论正是那个数**
  // （M-H31-c，#104 第三轮评审指出）。
  eq('两边混着认领 → 两条都要数进那个 N',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a']),
                               entryCriteria: new Set(['P9.b']) })).claimed, 2)
  eq('全部只由自检认领 → 一条都不能少',
    requirementVerdict(p, ev({ entryCriteria: new Set(['P9.a', 'P9.b']) })).claimed, 2)

  // ---- 落地 4：只由自检认领的判据，必须有一条改跑自检的负片 ----
  // 认领与负片要来自同一头：认领是自检发的，负片也得是自检验的。配不上，
  // 这条判据就只有夹具、没有第三拍 —— 而夹具绿着不证明它还会红（4-VERIFY）。
  eq('只由自检认领、却没有改跑自检的负片 → 硬失败',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a']),
                               entryCriteria: new Set(['P9.b']) })).hard, 1)
  // ⚠️ 不带 `by` 的判据级负片不算数：缺省那个验证者够不到入口，那条变异只会「存活」，
  // 对这条判据什么也证不了。两个集合分开交进来，正是为了这里分得出来。
  eq('只有不带 by 的负片 → 仍是硬失败',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a']),
                               entryCriteria: new Set(['P9.b']),
                               mutatedCriteria: new Set(['P9.b']) })).hard, 1)
  // 单元那边也认领了的不受这一条管 —— 缺省那个验证者够得到它，用不着改跑自检
  eq('两边都认领 → 不要求改跑自检的负片',
    requirementVerdict(p, ev({ claimedCriteria: new Set(['P9.a', 'P9.b']),
                               entryCriteria: new Set(['P9.b']) })).hard, 0)
  // 与红线无关：它买到的东西跟这条需求是不是红线没关系
  eq('非红线的判据同样要求',
    requirementVerdict(req('D9', ['a']), ev({ entryCriteria: new Set(['D9.a']) })).hard, 1)
  eq('非红线配上那条负片也通过',
    requirementVerdict(req('D9', ['a']), ev({ entryCriteria: new Set(['D9.a']),
      selfcheckMutatedCriteria: new Set(['D9.a']) })).hard, 0)
  // ⚠️ 只验 hard 不够：上面几档是按「这条需求整体什么成色」写的，各自会覆盖 flag ——
  // 实测出现过 `hard = 1` 而那一行印着 `·`／`⊘`，审计退出码 1 而逐条那行看着没事
  // （#105 第二轮评审指出）。**硬失败的那一行必须打 ✗**，这是不变量（M-H34-a）。
  eq('非红线：硬失败那一行必须打 ✗，不被「缺认领」那一档改写成 ·',
    requirementVerdict(req('D9', ['a', 'b']), ev({ entryCriteria: new Set(['D9.a']) })).flag, '✗')
  eq('红线整条豁免：也不许把硬失败那一行改写成 ⊘',
    requirementVerdict(req('P9', ['a']), ev({ entryCriteria: new Set(['P9.a']),
                                             exempt: true })).flag, '✗')
  // **没人认领的**豁免才别打 `✓` —— 图例里 `✓` 是「完整」，而审计自己在下面又把这条
  // 列成显式缺口。跟变异那一栏统一成 `⊘`，并把这种豁免有几条数出来（M-H6-g…i）。
  // ⚠️ 条件是「没人认领」不是「有豁免」：上面那条刚证明了认领过的判据即便名下还挂着
  // 豁免也算完整。下面这个夹具里 P9.b 两种认领都没有，才落进这一档（#104 第四轮评审）。
  const exempted1 = ev({ claimedCriteria: new Set(['P9.a']), exemptIds: new Set(['P9.b']) })
  eq('有一条没人认领的豁免 → 打 ⊘，不冒充完整', requirementVerdict(p, exempted1).flag, '⊘')
  eq('没人认领的豁免有几条要数出来', requirementVerdict(p, exempted1).exempted, 1)
  eq('一条豁免都没有 → 不多报', requirementVerdict(p, ev({
    claimedCriteria: new Set(['P9.a', 'P9.b']) })).exempted, 0)
  // `⊘` 只往上抬 `✓` 这一档。少掉「原本是 ✓」这半个条件，一条还欠着认领的
  // 红线会从 `✗` 改写成「已豁免」，非红线的 `·` 同理 —— 报告上看着是有人签过
  // 字的缺口，其实没有，而豁免恰恰是唯一要人签字的那一档（M-H6-j）。
  const p3 = req('P9', ['a', 'b', 'c'])
  eq('红线还欠着认领 → 仍是 ✗，豁免盖不住硬失败',
    requirementVerdict(p3, ev({ claimedCriteria: new Set(['P9.a']),
                                exemptIds: new Set(['P9.b']) })).flag, '✗')
  const d3 = req('D9', ['a', 'b', 'c'])
  eq('非红线还欠着认领 → 仍是 ·，豁免盖不住缺口',
    requirementVerdict(d3, ev({ claimedCriteria: new Set(['D9.a']),
                                exemptIds: new Set(['D9.b']) })).flag, '·')
  // 「判据 N/M」那一格是这条规矩唯一露给人看的地方，而它原先拼在入口脚本里 ——
  // 谁也够不着，把 `+⊘N` 整段删掉全套测试照样绿，报告就退回那种两可的写法
  // （M-H6-k、M-H6-l）。
  eq('有豁免 → 那一格写出豁免了几条', criteriaCell(1, 0, 1, 2), '判据 1+⊘1/2')
  eq('没豁免 → 那一格不多写', criteriaCell(2, 0, 0, 2), '判据 2/2')
  // 变异的 req 两种编号混着写，判据号那几条此前对报告完全不可见。分类原先留在
  // audit.ts 里，没有任何一条测试够得着 —— 把条件反过来或交个空集合，单元测试与
  // 那十一条新变异照样全绿，而报告悄悄退回一个字都没有（评审指出，实测坐实）
  eq('带点的是判据号，收进来',
    [...criterionMutations([{ req: 'P5.f' }, { req: 'P5.g' }])].sort(), ['P5.f', 'P5.g'])
  eq('不带点的是需求号，不收', [...criterionMutations([{ req: 'P5' }, { req: 'harness' }])], [])
  eq('两种混着给，只挑判据号',
    [...criterionMutations([{ req: 'P5' }, { req: 'P5.f' }, { req: 'harness' }])], ['P5.f'])
  eq('同一条判据被点两次，集合里只算一个',
    [...criterionMutations([{ req: 'P5.g' }, { req: 'P5.g' }])], ['P5.g'])
  eq('一条变异都没有 → 空集合', criterionMutations([]).size, 0)

  // 改跑自检的那些单挑出来：落地 4 那条硬失败问的是这个集合，不是上面那个。
  // 两个函数分开，是因为它们回答的问题不同（报告数几条 / 硬失败该不该响）。
  const mu = [
    { req: 'P3.b', by: 'selfcheck' }, { req: 'D6.f', by: 'selfcheck' },
    { req: 'P5.f' }, { req: 'P3', by: 'selfcheck' },
  ]
  eq('只收改跑自检的那些',
    [...selfcheckCriterionMutations(mu)].sort(), ['D6.f', 'P3.b'])
  // 不带 by 的不算：缺省那个验证者够不到入口，那条变异只会「存活」
  eq('不带 by 的判据级负片不收', selfcheckCriterionMutations([{ req: 'P5.f' }]).size, 0)
  // 需求号不收 —— 这一条按判据问，跟 criterionMutations 同一个口径
  eq('需求号不收', selfcheckCriterionMutations([{ req: 'P3', by: 'selfcheck' }]).size, 0)
  // 别的验证者不算：今天只有 selfcheck 一个，写死名字是为了将来多一个时这里会红
  eq('别的验证者不收', selfcheckCriterionMutations([{ req: 'P3.b', by: 'test' }]).size, 0)

  // 验收判据那一行汇总原先也拼在入口脚本里，同一个形状：把入口认领那个数改成从单元
  // 那份名单里数、把红线那半数成全体、或者把豁免数成测试认领，报告上的数字当场变了，
  // 而单元测试与全部变异照样全绿（M-H29-a/b/c）。
  //
  // 三栏还必须**互不重叠**：两边都认领的算在测试那一栏、只有自检认领的才进入口那一栏、
  // 豁免只数两边都没认领的。不这么数，红线那三栏会加出比总数还大的值，而逐条那一头
  // 早就把它算成认领了 —— 一份报告两种说法（M-H30-a/b，落地 3 第二片）。
  {
    const allCrit = [{ id: 'A.a' }, { id: 'A.b' }, { id: 'A.c' }, { id: 'B.a' }]
    const redCrit = [{ id: 'A.a' }, { id: 'A.b' }, { id: 'A.c' }]
    const tested = new Set(['A.a', 'B.a'])
    const entry = new Set(['A.a', 'A.b'])          // A.a 两边都认领 —— 只能算一次
    // 豁免那一头交的是 Map（编号 → 理由），三个名单只问「在不在里面」。
    // A.b 已被自检认领，不再是缺口；只有 A.c 是真的没人认领
    const exempt = new Map([['A.b', '自检认过了'], ['A.c', '这条谁也没认领']])
    eq('三栏互不重叠，红线那三栏正好分完红线判据',
      coverageSummary(allCrit, redCrit, tested, entry, exempt),
      '验收判据 4 条 · 有测试认领 2 · 入口认领 1 · 其中红线 3 条'
        + '（测试认领 1 · 入口认领 1 · 显式豁免 1）')
    // 交换两份认领的名单，各栏跟着换 —— 合成一个数就分不出这件事；
    // 这一条同时钉住「红线那半只数红线」（换过之后入口那一栏红线是 0、全体是 1）
    eq('交换两份认领的名单，各栏跟着换',
      coverageSummary(allCrit, redCrit, entry, tested, exempt),
      '验收判据 4 条 · 有测试认领 2 · 入口认领 1 · 其中红线 3 条'
        + '（测试认领 2 · 入口认领 0 · 显式豁免 1）')
    // 一条判据同时进三张名单：只能被数一次，而且算在最强的那一栏（测试认领）
    const one = [{ id: 'A.a' }]
    eq('三张名单都有它 → 只算测试认领那一次',
      coverageSummary(one, one, new Set(['A.a']), new Set(['A.a']), new Set(['A.a'])),
      '验收判据 1 条 · 有测试认领 1 · 入口认领 0 · 其中红线 1 条'
        + '（测试认领 1 · 入口认领 0 · 显式豁免 0）')
  }

  // 判据级的负片原先在报告里一个字都没有：变异那一列只认需求号，而变异表里
  // 今天已有几条把 req 写成判据号（M-P5-a 守着 P5.f），它们完全不可见
  eq('有判据级的负片 → 那一格写出几条', criteriaCell(3, 2, 0, 3), '判据 3(负片 2)/3')
  eq('没有就不多写这一段', criteriaCell(3, 0, 0, 3), '判据 3/3')
  eq('负片与豁免可以同时写出来', criteriaCell(1, 1, 1, 3), '判据 1(负片 1)+⊘1/3')

  // 「变异」那一格原先拼在入口脚本的模板串里 —— 谁也够不着，把 ⊘ 那一档整个删掉，
  // 全套测试与审计照样全绿（实测）。而它恰恰是「整条需求显式豁免了变异」唯一露给人看的地方
  eq('有变异守着 → 打勾', mutationCell(true, false), '变异✓')
  eq('没变异但整条豁免了 → 打豁免，不打缺口', mutationCell(false, true), '变异⊘')
  eq('都没有 → 缺口', mutationCell(false, false), '变异·')
  // 有变异压过豁免：签过字的缺口后来被补上了，报告该说补上了
  eq('既有变异又登记了豁免 → 说有变异', mutationCell(true, true), '变异✓')

  eq('有几条判据被变异点着，数得出来', requirementVerdict(p, ev({
    claimedCriteria: new Set(['P9.a', 'P9.b']),
    mutatedCriteria: new Set(['P9.a', 'P9.b']) })).mutatedCrit, 2)
  eq('一条都没有就是 0', requirementVerdict(p, ev({
    claimedCriteria: new Set(['P9.a', 'P9.b']) })).mutatedCrit, 0)

  // 需求级豁免那一路此前一条测试都没有 —— 生产数据里三条豁免全是判据号，
  // 于是它整段拆掉照样全绿（实测）。它是可达的（有人写一条需求号的豁免就走到），
  // 一条判定模块里没人守着的分支
  eq('红线整条豁免了变异 → 打豁免，不算硬失败', requirementVerdict(p, ev({
    mutated: false, exempt: true,
    claimedCriteria: new Set(['P9.a', 'P9.b']) })).flag, '⊘')
  eq('红线整条豁免了变异 → 不进硬失败', requirementVerdict(p, ev({
    mutated: false, exempt: true,
    claimedCriteria: new Set(['P9.a', 'P9.b']) })).hard, 0)
  eq('红线没变异又没豁免 → 硬失败', requirementVerdict(p, ev({
    mutated: false, claimedCriteria: new Set(['P9.a', 'P9.b']) })).hard, 1)

  // 非红线：**一条都没认领同样是缺口**。原先只报「认领了一部分」那种，
  // 于是把仅有的那条认领删掉，缺口反而消失了 —— 一个删掉证据就能变绿的
  // 检查，是在奖励删证据（ADR-26）。
  const d = req('D9', ['a', 'b'])
  ok('非红线漏一条判据 → 报缺口',
    requirementVerdict(d, ev({ claimedCriteria: new Set(['D9.a']) })).gaps.length > 0)
  ok('非红线一条都没认领 → 同样报缺口，不许更干净',
    requirementVerdict(d, ev()).gaps.length > 0)
  eq('非红线漏判据不是硬失败', requirementVerdict(d, ev()).hard, 0)
  eq('非红线全认领且有引用 → 通过',
    requirementVerdict(d, ev({ claimedCriteria: new Set(['D9.a', 'D9.b']) })).flag, '✓')
  ok('既没落到代码也没测试 → 报缺口',
    requirementVerdict(d, ev({ tested: false, impl: 0, refs: 0,
      claimedCriteria: new Set(['D9.a', 'D9.b']) })).gaps.length > 0)
  eq('红线有测试没变异 → 硬失败',
    requirementVerdict(p, ev({ mutated: false,
      claimedCriteria: new Set(['P9.a', 'P9.b']) })).hard, 1)
}

harness('审计对一个交点的裁定')
{
  const t = { with: 'P4', ruling: '撞上时以 P4 为准' }
  const te = (over: Partial<TensionEvidence> = {}): TensionEvidence =>
    ({ claimed: false, redline: false, ...over })

  // 认领编号两侧顺序无关：登记表要求交点写在**让步的那一方**，那是给读的人
  // 定的规矩。认领的时候还得先想清楚谁让步的话，想反了就认领不上，而认领不上
  // 的红线交点是硬失败 —— 一条写给人看的规矩会变成一次假的失败。
  eq('两侧顺序不影响认领编号', tensionKey('P1', 'F5'), tensionKey('F5', 'P1'))
  ok('不同的交点不是同一个编号', tensionKey('D4', 'P4') !== tensionKey('D4', 'D6'))

  // 一头是红线就算有红线的交点。退化成「两头都红才算」的话，已登记的交点
  // 一个都不算，下面那条硬失败会静悄悄地全变成软缺口。
  const P = new Set(['P4'])
  eq('这一头是红线就算', tensionHasRedline('P4', 'D1', P), true)
  eq('那一头是红线也算', tensionHasRedline('D1', 'P4', P), true)
  eq('两头都不是红线就不算', tensionHasRedline('D4', 'D6', P), false)

  // 配证据本身也是判断：查认领用哪个编号、红线看哪份名单。裁定收到的是两个
  // 已经算好的布尔值，配错了它一个字都验不出来。
  const ev = (claims: string[], red: string[] = []) =>
    tensionEvidence('D4', t, new Set(claims), new Set(red))
  eq('认领了这个交点，证据里就认领了', ev([tensionKey('D4', 'P4')]).claimed, true)
  eq('认领的是别的交点，不算这一个', ev([tensionKey('D1', 'P4')]).claimed, false)
  eq('红线看的是登记表那份名单', ev([], ['P4']).redline, true)

  // 有红线的交点没被认领是**硬失败**，不是待办：一条红线让步到哪为止，
  // 登记表上写着，而两侧需求各自的判据谁也不验它（ADR-17）。
  eq('有红线的交点没认领 → 硬失败', tensionVerdict('D4', t, te({ redline: true })).hard, 1)
  eq('有红线的交点认领了 → 通过',
    tensionVerdict('D4', t, te({ redline: true, claimed: true })).flag, '✓')
  eq('没红线的交点没认领 → 报缺口但不硬失败', tensionVerdict('D4', t, te()).hard, 0)
  ok('没红线的交点没认领 → 缺口要报出来', tensionVerdict('D4', t, te()).gaps.length > 0)
  eq('认领过的交点不再报缺口',
    tensionVerdict('D4', t, te({ claimed: true })).gaps.length, 0)
  ok('缺口里写得出是哪两条撞上了',
    tensionVerdict('D4', t, te({ redline: true })).gaps[0]?.includes('D4') === true &&
    tensionVerdict('D4', t, te({ redline: true })).gaps[0]?.includes('P4') === true)
}

})
if (fullRun) {
harness('变异集的 why 不许夹带实现原文')
{
  /**
   * `mutate --brief` 会把 why 单独打印给写测试的那个上下文（4-VERIFY 的准入读物
   * 清单）。所以 why 里夹带的实现原文，等于绕过清单让那个上下文读了实现。
   *
   * 界线：**对外契约里的名字算需求语言** —— stdout 字段、产出文件字段、提供方
   * 响应键、命令行参数，写测试的人本来就该看得到它们。本仓库内部的函数名和
   * 任何代码表达式不算。这条判定只挡后者里能机器识别的两类。
   */
  const leaks = [
    '合并邮箱退回 `a ?? b ?? null` —— 两边都没查过被写成查过没有',
    '拿不到就 || [] 兜过去',
    '降完立刻被 tierOf 覆盖',
    '响应结构探测的 pickList 退回取第一个数组',
    '判定写成 status === "measured" 才放行',
    '把 p?.views 当成 0',
  ]
  for (const why of leaks) {
    ok(`拦下：${why.slice(0, 16)}…`, implementationLeak(why) !== undefined)
  }

  const clean = [
    '合并邮箱时把「两边都没查过」压成「查过，他没留邮箱」—— 运营看到空白就不会回头补查',
    '空的 aweme_list 会盖掉有数据的 search_item_list，产出「这个关键词没人」',
    'filtered_contacted 把连闸门都过不了的人也算进去，向用户虚报打扰规模',
    'render 之后每次 --resume 都产出一份空名单',
    'basis 写着「最多 12 条」而 sample_size 是 20，enrichment.json 的溯源自己打自己',
    '写个 p1-ok 就放行、理由可以不写',
    '受众降权跑在分层之前 —— 降完立刻被重新算出来的分层覆盖',
  ]
  for (const why of clean) {
    eq(`放行：${why.slice(0, 16)}…`, implementationLeak(why), undefined)
  }

  // 判定对不对是一回事，**当前那份变异集干不干净**是另一回事。后者才是 --brief
  // 名副其实的前提，所以直接断言真文件，而不是断言一个抽象能力。
  const corpus = JSON.parse(rf('scripts/check/mutations.json', 'utf8'))
  const dirty = (corpus.mutations as { id: string; why: string }[])
    .flatMap(m => {
      const leak = implementationLeak(m.why)
      return leak === undefined ? [] : [`${m.id}:${leak}`]
    })
  eq('当前变异集全集干净', dirty, [])
}

suite('D9', '互动率与合作报价分开，只有可比报价才计算效率')
{
  const account = assessedAccount('quoted', 1_000, 100, 10)
  const quote: CollaborationQuote = {
    amount: 500, currency: 'USD', platform: 'tiktok', format: 'tiktok_video',
    quantity: 2, source: 'creator_quote', observed_at: '2026-08-26T00:00:00.000Z',
  }
  account.collaboration_quote = measured(
    quote, { kind: 'manual', provider: 'operator' }, quote.observed_at, 1, 'creator quote')
  const efficiency = calculateQuoteEfficiency(account)!
  eq('eCPM 用单条报价和中位播放量计算',
    efficiency.implied_ecpm?.status === 'measured'
      ? Number(efficiency.implied_ecpm.value.toFixed(6)) : undefined,
    Number((250 / 1002.5 * 1000).toFixed(6)))
  eq('eCPE 用单条报价和中位互动量计算',
    efficiency.implied_ecpe?.status === 'measured'
      ? Number(efficiency.implied_ecpe.value.toFixed(6)) : undefined,
    Number((250 / 105).toFixed(6)))

  const bundle = structuredClone(account)
  if (bundle.collaboration_quote?.status === 'measured') {
    bundle.collaboration_quote.value.format = 'mixed_bundle'
  }
  eq('混合套餐不硬算', calculateQuoteEfficiency(bundle)?.implied_ecpm?.status, 'unavailable')
  const quoteUnavailable = structuredClone(account)
  quoteUnavailable.collaboration_quote = unavailable(
    'unsupported_content', { kind: 'manual', provider: 'operator' }, quote.observed_at)
  eq('报价查询过但不可用时效率也明确不可用',
    calculateQuoteEfficiency(quoteUnavailable)?.implied_ecpm?.status, 'unavailable')
  const wrongFormat = structuredClone(account)
  if (wrongFormat.collaboration_quote?.status === 'measured') {
    wrongFormat.collaboration_quote.value.format = 'instagram_post'
    wrongFormat.collaboration_quote.value.platform = 'instagram'
  }
  wrongFormat.platform = 'instagram'
  eq('Instagram 静态帖报价不能套用 Reels 表现',
    calculateQuoteEfficiency(wrongFormat)?.implied_ecpm?.status, 'unavailable')
  eq('没有报价就不生成估价', calculateQuoteEfficiency(assessedAccount('noquote', 1000, 100, 10)), undefined)
}

suite('D10', '当前活跃标签与历史内容积累分开且不改变分层')
{
  const observedAt = '2026-08-26T00:00:00.000Z'
  const atDaysAgo = (days: number) =>
    new Date(Date.parse(observedAt) - days * 86_400_000).toISOString()
  const metricsAt = (days: number) => {
    const posts: NormalizedPublicPost[] = [{
      id: `age-${days}`, published_at: atDaysAgo(days), is_pinned: false,
    }]
    const sample = measured(posts, PUBLIC_SOURCE, observedAt, 1, 'activity boundary sample')
    return calculatePublicMetrics(sample, 10_000, 100)
  }
  const statusAt = (days: number) => {
    const status = metricsAt(days).activity_status
    return status.status === 'measured' ? status.value : undefined
  }

  eq('45 天仍为 active', statusAt(ACTIVITY_ACTIVE_MAX_DAYS), 'active')
  eq('46 天进入 cooling', statusAt(ACTIVITY_ACTIVE_MAX_DAYS + 1), 'cooling')
  eq('90 天仍为 cooling', statusAt(ACTIVITY_COOLING_MAX_DAYS), 'cooling')
  eq('91 天进入 dormant', statusAt(ACTIVITY_COOLING_MAX_DAYS + 1), 'dormant')

  const pinnedSample = measured<NormalizedPublicPost[]>([
    { id: 'new-pinned', published_at: atDaysAgo(10), is_pinned: true },
    { id: 'old-normal', published_at: atDaysAgo(120), is_pinned: false },
  ], PUBLIC_SOURCE, observedAt, 2, 'pinned recency sample')
  const pinnedMetrics = calculatePublicMetrics(pinnedSample, 10_000, 100)
  eq('近期置顶作品仍证明账号活跃',
    pinnedMetrics.activity_status.status === 'measured'
      ? pinnedMetrics.activity_status.value : undefined,
    'active')
  eq('置顶与普通作品的有效时间都计入溯源样本量',
    pinnedMetrics.activity_status.sample_size, 2)
  eq('一个有效发布时间足以测量活跃状态',
    metricsAt(10).activity_status.status, 'measured')

  const missingSample = measured<NormalizedPublicPost[]>(
    [{ id: 'missing-date' }], PUBLIC_SOURCE, observedAt, 1, 'missing date sample')
  const missingActivity = calculatePublicMetrics(missingSample, 10_000, 100).activity_status
  eq('没有发布时间明确 unavailable',
    missingActivity.status === 'unavailable' ? missingActivity.reason : undefined,
    'missing_post_dates')

  const futureSample = measured<NormalizedPublicPost[]>([
    { id: 'future', published_at: atDaysAgo(-1) },
  ], PUBLIC_SOURCE, observedAt, 1, 'future date sample')
  const futureActivity = calculatePublicMetrics(futureSample, 10_000, 100).activity_status
  eq('未来发布时间不被补成零天',
    futureActivity.status === 'unavailable' ? futureActivity.reason : undefined,
    'invalid_post_date')

  const activeCreator = mk('tiktok', 'active_kol', {
    email: 'a@example.com', fit: '✅',
    account_assessment: {
      platform: 'tiktok', handle: 'active_kol', metrics: metricsAt(10),
    },
  })
  const dormantCreator = mk('tiktok', 'dormant_kol', {
    email: 'd@example.com', fit: '✅',
    account_assessment: {
      platform: 'tiktok', handle: 'dormant_kol', metrics: metricsAt(120),
    },
  })
  const ranked = rankCreators([activeCreator, dormantCreator], 'US')
  eq('停更标签不改变 score', ranked.map(c => c.score), [60, 60])
  eq('停更标签不改变 tier 或删除成员',
    { tiers: ranked.map(c => c.tier), count: ranked.length },
    { tiers: ['A', 'A'], count: 2 })
  eq('活跃标签不改写受众质量风险', ranked.map(c => {
    const risk = c.account_assessment?.metrics?.audience_quality_risk
    return risk?.status === 'unavailable' ? risk.reason : risk?.status
  }), ['insufficient_peer_group', 'insufficient_peer_group'])
}

suite('D3', '同人识别不确定时不得合并')
{
  const a = [mk('tiktok', 'sarahtech', { bio_links: ['https://instagram.com/sarah.tech'] }),
             mk('instagram', 'sarah.tech')]
  eq('外链互指 → 合并', linkCrossPlatform(a), 1)
  eq('双向标记', [a[0].cross_platform, a[0].linked_handle], [true, 'instagram:sarah.tech'])

  eq('handle 相同 → 合并', linkCrossPlatform([mk('tiktok', 'danvlogs'), mk('instagram', 'danvlogs')]), 1)
  eq('去标点后相同 → 合并', linkCrossPlatform([mk('tiktok', 'mei_cooks'), mk('instagram', 'meicooks')]), 1)
  eq('不相关 → 不合并', linkCrossPlatform([mk('tiktok', 'alpha'), mk('instagram', 'beta')]), 0)

  // 昵称/头像相近单独不足以触发
  const nick = [mk('tiktok', 'aaa', { nickname: 'Sarah Tech' }),
                mk('instagram', 'bbb', { nickname: 'Sarah Tech' })]
  eq('仅昵称相同 → 不合并', linkCrossPlatform(nick), 0)
}

suite('P1', '跨平台合并不得把「未查询」降级成「查过，没有」')
{
  const merged = (ea: string | null | undefined, eb: string | null | undefined) => {
    const a = mk('tiktok', 'sam'), b = mk('instagram', 'sam')
    a.email = ea; b.email = eb
    linkCrossPlatform([a, b])
    return mergeCrossPlatform([a, b])[0].email
  }
  // 两侧 profile 补全都失败是预期内的，不是边角情况
  eq('两侧都未查询 → 仍是未查询', merged(undefined, undefined), undefined)
  eq('一侧未查询一侧查过没有 → 未查询', merged(undefined, null), undefined)
  eq('两侧都查过没有 → null', merged(null, null), null)
  eq('一侧有值 → 取该值', merged(undefined, 'a@example.com'), 'a@example.com')

  // 真正要防住的是它到达产出物的样子
  const a = mk('tiktok', 'kim'), b = mk('instagram', 'kim')
  linkCrossPlatform([a, b])
  const row = toRow(mergeCrossPlatform([a, b])[0])
  eq('未查询在 CSV 里是「未查询」而非空白', row[HEADERS.indexOf('email')], '未查询')
  covered.add('D3')
}

suite('P1', '三态不得被压平：取值、排序、入池三处各验一次')
{
  /**
   * P1.b 原先写的是「任何位置不得出现 `?? 0` 这种写法」，由一条纪律 lint 扫源码来查。
   * 那条判据在说大话：实现是一张**手写的敏感字段表**，`score` 和 `null` 都漏过
   * （ADR-71），而判据正文写着「任何位置」。2026-09-18 改成直接查结果（ADR-77）——
   * 结果查得住那些没被谁枚举到的字段，写法查不住。
   *
   * **三处各验一次，因为压平可以发生在任何一处**：交付表里那个格子的取值、
   * 名单的排序、以及这个人进不进池子。三处用的是三套代码，各自都能独立压平。
   */
  // 取值：三态三个不同的格子。空串与「未查询」不是同一件事
  eq('取值：未查询 / 查过为空 / 值就是 0，三个格子各不相同',
     [cell(undefined), cell(null), cell(0)], ['未查询', '', '0'])

  // 排序：「还没算过分」不是「0 分」。旧写法 `(b.score ?? 0) - (a.score ?? 0)` 会让两者
  // 打平，而排序稳定 —— 打平就保持输入顺序，于是旧写法给出 none 在前。写反了这条
  // 断言就分不出两种实现（ADR-71 的原话）
  eq('排序：没算过分的排在 0 分之后，不与它混同',
     sortForOutput([
       mk('tiktok', 'none', { tier: 'A' }),
       mk('tiktok', 'zero', { tier: 'A', score: 0 }),
       mk('tiktok', 'ten', { tier: 'A', score: 10 }),
     ]).map(c => c.handle), ['ten', 'zero', 'none'])

  // 入池：粉丝数未查询 → 放行（不知道不等于不合格）；确实是 0 → 挡掉。
  // 两者给出相反的结论，压成同一个值的那一刻这两条里必有一条红
  ok('入池：粉丝数未查询 → 放行', passesFollowerGate(mk('tiktok', 'x', { followers: undefined })))
  ok('入池：粉丝数确实是 0 → 挡掉，与未查询结论相反',
     !passesFollowerGate(mk('tiktok', 'x', { followers: 0 })))

  // 三条路径三个编号 —— 它们会被不同的代码路径独立弄坏（`process/1-REQUIREMENTS.md`
  // 的拆分判据）。P1.b 本身留着原来的含义（「任何位置不得出现兜底写法」），
  // 而那个全称没有任何检查兑现得了，已按规矩登记成显式豁免（ADR-77）。
  criterion('P1.e')
  criterion('P1.f')
  criterion('P1.g')
}

suite('P1', '作品那一列：没问过作品不得显示成「文案是空的」')
{
  /**
   * `best_post_desc` 原先把三件事都印成空白：没问过作品（IG 按账号名搜人的兜底路径）、
   * 盘上旧数据里那个凭空写的空数组、以及已取得作品的文案值为空。空文案不证明作者没写。
   * 没有「无作品」这一态 —— 说得出它的证据今天没有（ADR-102）。
   */
  const desc = (over: Partial<Creator>) => toRow(mk('instagram', 'x', over))[HEADERS.indexOf('best_post_desc')]
  eq('没问过作品 → 未查询', desc({ recent_posts: undefined }), '未查询')
  eq('盘上旧数据里的空数组也是没问过 → 未查询，不是空白', desc({ recent_posts: [] }), '未查询')
  eq('问到了作品、文案是空的 → 空白', desc({ recent_posts: [{ desc: '' }] }), '')
  eq('有文案 → 播放最高的那条的文案',
     desc({ recent_posts: [
       { desc: 'low', plays: 1 }, { desc: 'top', plays: 9 }, { desc: 'last', plays: 3 },
     ] }), 'top')

  // 补齐：同一个人先从兜底路径进来（没作品），后来被别的词从 reels 搜到（带作品）
  const t = { keyword: 'k', dimension: 'scene', platform: 'instagram' } as any
  const posts = (d: string) => [{ desc: d }]
  // 从本轮空池起步，不能用手造的旧记录替代「新建记录再遇到作品」这条路径。
  const fresh = new Map<string, Creator>()
  eq('本轮首次搜到无作品的人 → 新增一人',
     mergePage(fresh, [{ handle: 'ann', platform: 'instagram' }], 0, t), 1)
  eq('本轮首次未问过作品 → 仍为未查询', fresh.get('instagram:ann')?.recent_posts, undefined)
  eq('本轮另一个任务再搜到同人带作品 → 不增加人数',
     mergePage(fresh, [{ handle: 'ann', platform: 'instagram', recent_posts: posts('hello') }],
       1, { ...t, keyword: 'second' }), 0)
  eq('本轮补齐作品后仍只有一个人', fresh.size, 1)
  eq('本轮新建的人保留两次来源', fresh.get('instagram:ann')?.source_tasks, [0, 1])
  eq('本轮补齐作品不覆盖最初的来源词', fresh.get('instagram:ann')?.source_keyword, 'k')
  eq('本轮新建的人后来搜到作品 → 补上', fresh.get('instagram:ann')?.recent_posts, posts('hello'))
  const after = (seen: Partial<Creator>, incoming: Partial<Creator>) => {
    const acc = new Map<string, Creator>([['instagram:ann', mk('instagram', 'ann', seen)]])
    mergePage(acc, [{ handle: 'ann', platform: 'instagram', ...incoming }], 1, t)
    return acc.get('instagram:ann')?.recent_posts
  }
  eq('先到的那次没问过作品，后来的一页带来了 → 补上', after({ recent_posts: undefined },
     { recent_posts: posts('hello') }), posts('hello'))
  eq('旧数据里的空数组同样补上', after({ recent_posts: [] }, { recent_posts: posts('hello') }), posts('hello'))
  // ADR-105 / D11 替代原来的「两边都有不拼接」：缺 id 无可靠去重依据，逐条保留。
  eq('已经有作品 → 先到的不换掉，后到无 id 作品也保留', after({ recent_posts: posts('first') },
     { recent_posts: posts('second') }), [...posts('first'), ...posts('second')])
  eq('后来的一页没有作品 → 已有的不被抹掉', after({ recent_posts: posts('first') }, {}), posts('first'))
  criterion('P1.e')
}

}
await group('d11-posts', async () => {
// 独立上下文只读 D11/ADR-105、公开契约及既有测试；以下 expected 均先于实现写成。
suite('D11', '搜索作品标识只取可核实的来源字段')
{
  type SearchEvidence = RecentPost & { id?: string }
  const cases: [string, unknown, string | undefined][] = [
    ['字符串保留前导零', '001', '001'], ['字符串保留原值', ' raw ', ' raw '],
    ['数字零', 0, '0'], ['负整数', -7, '-7'], ['负零', -0, '0'],
    ['最大安全整数', Number.MAX_SAFE_INTEGER, '9007199254740991'],
    ['最小安全整数', Number.MIN_SAFE_INTEGER, '-9007199254740991'],
    ['缺失', undefined, undefined], ['null', null, undefined], ['空串', '', undefined],
    ['空白', ' \n\t', undefined], ['true', true, undefined], ['false', false, undefined],
    ['对象', { id: 'other' }, undefined], ['数组', ['other'], undefined],
    ['小数', 1.5, undefined], ['不安全整数', 9007199254740992, undefined],
    ['NaN', NaN, undefined], ['无穷', Infinity, undefined], ['负无穷', -Infinity, undefined],
    ['bigint', 1n, undefined],
  ]
  const read = async (platform: 'tiktok' | 'instagram', raw: unknown) => {
    const api = new TikHub('k', fundedBudget())
    ;(api as unknown as { get: () => Promise<unknown> }).get = async () => raw
    return (await api.search({ keyword: 'k', dimension: 'category', platform }, 'US', 0)).creators
  }
  const ttItems = cases.map(([, raw], i) => ({ aweme_id: raw, desc: `post${i}`,
    author: { unique_id: `u${i}`, uid: 'user-id' }, statistics: {} }))
  for (const [label, raw] of [
    ['TikTok 嵌套作品', { data: { search_item_list: ttItems.map(aweme_info => ({ aweme_info })) } }],
    ['TikTok 直接作品兼容', { data: { aweme_list: ttItems } }],
  ] as const) {
    const rows = await read('tiktok', raw)
    eq(`${label}：每条作品仍归到对应作者`, rows.map(c => c.handle), cases.map((_, i) => `u${i}`))
    cases.forEach(([name, , expected], i) => eq(`${label}：${name}`,
      (rows[i]?.recent_posts?.[0] as SearchEvidence | undefined)?.id,
      expected === undefined ? undefined : `tiktok:${expected}`))
    if (label === 'TikTok 嵌套作品') {
      eq('TikTok 视频搜索保留真实作品标识',
        (rows[0]?.recent_posts?.[0] as SearchEvidence | undefined)?.id, 'tiktok:001')
    }
  }
  criterion('D11.g')
  const igItems = cases.map(([, raw], i) => ({ id: raw,
    caption: { id: 'caption-id', text: `post${i}` }, media: { id: 'media-id' },
    user: { username: `u${i}`, id: 'user-id', full_name: 'U' } }))
  const ig = await read('instagram', { data: { data: { items: igItems } } })
  eq('Instagram：每条作品仍归到对应作者', ig.map(c => c.handle), cases.map((_, i) => `u${i}`))
  cases.forEach(([name, , expected], i) => eq(`Instagram 直接作品 id：${name}`,
    (ig[i]?.recent_posts?.[0] as SearchEvidence | undefined)?.id,
    expected === undefined ? undefined : `instagram:${expected}`))
  const igId = (name: string) =>
    (ig[cases.findIndex(([caseName]) => caseName === name)]?.recent_posts?.[0] as SearchEvidence | undefined)?.id
  eq('Instagram 搜索使用作品 id 而非文案 id', igId('字符串保留前导零'), 'instagram:001')
  eq('Instagram 非安全整数不生成作品标识', igId('不安全整数'), undefined)
  eq('Instagram 缺失标识保持未知', igId('缺失'), undefined)
  eq('Instagram 字符串标识保留两端空白', igId('字符串保留原值'), 'instagram: raw ')
  criterion('D11.h', 'D11.i')
  // 同一个原始号来自不同平台，适配后就是两个作品键。
  const tt = await read('tiktok', { data: { aweme_list: [ttItems[0]] } })
  eq('两平台相同原始号各自保留平台前缀',
    [(tt[0].recent_posts?.[0] as SearchEvidence)?.id, (ig[0].recent_posts?.[0] as SearchEvidence)?.id],
    ['tiktok:001', 'instagram:001'])
  criterion('D11.d')
}

suite('D11', '首次收页及跨页都稳定保留作品证据')
{
  type SearchEvidence = RecentPost & { id?: string }
  const post = (id: string | undefined, desc: string, plays = 1): SearchEvidence => ({ id, desc, plays })
  const t: SearchTask = { keyword: 'first', dimension: 'category', platform: 'tiktok' }
  const a = post('tiktok:a', 'first a', 3), b = post('tiktok:b', 'first b', 4)
  const c = post('tiktok:c', 'new c', 5), newerA = post('tiktok:a', 'later a', 999)
  const missing = post(undefined, 'same'), empty = post('', 'same'), blank = post(' \t', 'same')
  const first = [a, newerA, missing, empty, blank, b, missing]
  const firstBefore = structuredClone(first)
  const acc = new Map<string, Creator>()
  eq('首次收页新增一人', mergePage(acc, [{ handle: 'sam', platform: 'tiktok', recent_posts: first }], 0, t), 1)
  eq('首次单条记录内：重复 id 只留首次，未知 id 逐条保留',
    acc.get('tiktok:sam')?.recent_posts, [a, missing, empty, blank, b, missing])
  eq('首次收页不改输入作品数组或内容', first, firstBefore)
  criterion('D11.j')

  const second = [newerA, c, post('tiktok:c', 'later c'), missing, empty, blank]
  const secondBefore = structuredClone(second)
  eq('另一关键词再搜到同人不增加人数', mergePage(acc,
    [{ handle: 'sam', platform: 'tiktok', recent_posts: second }], 1, { ...t, keyword: 'second' }), 0)
  eq('跨页稳定并集：保留先到完整记录，新作品按到达顺序追加',
    acc.get('tiktok:sam')?.recent_posts, [a, missing, empty, blank, b, missing, c, missing, empty, blank])
  eq('跨页合并不改任一输入作品数组或内容', [first, second], [firstBefore, secondBefore])
  criterion('D11.b')
  eq('作品并集保留最初来源与两次来源任务',
    [acc.get('tiktok:sam')?.source_keyword, acc.get('tiktok:sam')?.source_tasks], ['first', [0, 1]])

  const samePage = new Map<string, Creator>()
  mergePage(samePage, [
    { handle: 'sam', platform: 'tiktok', recent_posts: [a, b] },
    { handle: 'sam', platform: 'tiktok', recent_posts: [newerA, c] },
  ], 0, t)
  eq('首次页内多次命中同人也取作品并集', samePage.get('tiktok:sam')?.recent_posts, [a, b, c])

  const after = (left: RecentPost[] | undefined, right: RecentPost[] | undefined) => {
    const old = new Map<string, Creator>([['tiktok:sam', mk('tiktok', 'sam', { recent_posts: left })]])
    mergePage(old, [{ handle: 'sam', platform: 'tiktok', recent_posts: right }], 1, t)
    return old.get('tiktok:sam')?.recent_posts
  }
  eq('跨页空白 id 不作去重键，两条作品均保留',
    after([post(' \t', 'same')], [post(' \t', 'same')]),
    [post(' \t', 'same'), post(' \t', 'same')])
  eq('旧任务无 id 的相同文案逐条保留',
    after([{ desc: 'same' }, { desc: 'same' }], [{ desc: 'same' }]),
    [{ desc: 'same' }, { desc: 'same' }, { desc: 'same' }])
  for (const left of [undefined, []] as (RecentPost[] | undefined)[]) {
    const fresh = new Map<string, Creator>()
    mergePage(fresh, [{ handle: 'sam', platform: 'tiktok', recent_posts: left }], 0, t)
    eq(`首次作品为 ${left === undefined ? '缺失' : '旧空数组'} 时仍未查询`,
      fresh.get('tiktok:sam')?.recent_posts, undefined)
    for (const right of [undefined, []] as (RecentPost[] | undefined)[])
      eq('两边都无作品证据时仍未查询', after(left, right), undefined)
    eq('无作品证据的旧记录后来可以补齐', after(left, [a]), [a])
    eq('后来缺失或空数组都不擦除已有作品', after([a], left), [a])
  }
  criterion('D11.k', 'D11.l')
  // 对同一未知文案重复出现的次数作属性断言；不能仅靠有 id 的样例证明证据不丢失。
  for (let count = 1; count <= 5; count++) {
    const unknown = Array.from({ length: count }, () => ({ desc: 'same' }))
    eq(`无 id 作品 ${count}+${count} 条全部保留`, after(unknown, unknown), [...unknown, ...unknown])
  }
  criterion('D11.c')
  tension('D11', 'P1')
}

suite('D11', '同人合并按主记录优先沿用作品并集，作品 id 不参与身份或评分')
{
  type SearchEvidence = RecentPost & { id?: string }
  const post = (id: string | undefined, desc: string, plays = 1): SearchEvidence => ({ id, desc, plays })
  // 公开契约：双方邮箱相同时，粉丝较多者为主。两种平台均作主记录，期望顺序事先固定。
  for (const primary of ['tiktok', 'instagram'] as const) {
    const other = primary === 'tiktok' ? 'instagram' : 'tiktok'
    const first = post(`${primary}:42`, 'primary first', 2)
    const second = post(`${other}:42`, 'linked first', 3)
    const unknown = post(undefined, 'same')
    const left = [first, post(`${primary}:42`, 'primary later', 999), unknown]
    const right = [second, first, post(`${other}:new`, 'linked new'), unknown, post(' ', 'same')]
    const before = structuredClone([left, right])
    const hi = mk(primary, 'sam', { followers: 30_000, email: null, recent_posts: left })
    const lo = mk(other, 'sam', { followers: 10_000, email: null, recent_posts: right })
    const pair = [lo, hi] // 输入先放关联记录，不能误把输入顺序当主记录顺序。
    eq(`${primary} 为主：同人识别照常成立`, linkCrossPlatform(pair), 1)
    const result = mergeCrossPlatform(pair)
    const main = result.find(c => c.merged_into === undefined)
    eq(`${primary} 为主：邮箱相同则粉丝较多者仍为主`, main?.platform, primary)
    eq(`${primary} 为主：同原始号跨平台保留、同键去重、主记录作品在先`,
      main?.recent_posts, [first, unknown, second, post(`${other}:new`, 'linked new'), unknown, post(' ', 'same')])
    if (primary === 'tiktok') {
      eq('同人合并先主后关联且跨平台同号均保留', main?.recent_posts?.map(p => p.id),
        ['tiktok:42', undefined, 'instagram:42', 'instagram:new', undefined, ' '])
    }
    eq(`${primary} 为主：不改输入作品数组或内容`, [left, right], before)
    eq(`${primary} 为主：粉丝汇总不受作品 id 影响`, main?.followers, 40_000)
  }
  criterion('D11.d', 'D11.m')
  for (const left of [undefined, []] as (RecentPost[] | undefined)[])
    for (const right of [undefined, []] as (RecentPost[] | undefined)[]) {
      const pair = [mk('tiktok', 'sam', { recent_posts: left }), mk('instagram', 'sam', { recent_posts: right })]
      linkCrossPlatform(pair)
      eq('同人两边均无作品证据时仍未查询',
        mergeCrossPlatform(pair).find(c => c.merged_into === undefined)?.recent_posts, undefined)
    }
  criterion('D11.l')

  const idsOnly = (withIds: boolean, related: boolean) => {
    const pair = [
      mk('tiktok', 'alpha', { followers: 30_000, email: 'a@example.com', fit: '✅',
        recent_posts: [post(withIds ? 'tiktok:42' : undefined, 'one', 100)] }),
      mk('instagram', related ? 'alpha' : 'beta', { followers: 10_000, email: null, fit: '✅',
        recent_posts: [post(withIds ? 'instagram:42' : undefined, 'two', 200)] }),
    ]
    const linked = linkCrossPlatform(pair)
    const result = mergeCrossPlatform(pair)
    return { linked, rows: result.map(c => ({
      platform: c.platform, handle: c.handle, merged_into: c.merged_into,
      linked_handle: c.linked_handle, followers: c.followers,
      score: scoreCreator(c), tier: tierOf(c, scoreCreator(c)),
    })) }
  }
  for (const related of [false, true])
    eq(`添加作品 id 不改变${related ? '已关联' : '不相关'}账号的识别、主记录、评分与分层`,
      idsOnly(true, related), idsOnly(false, related))
  criterion('D11.o', 'D11.p', 'D11.q')
  const unrelated = [mk('tiktok', 'alpha', { recent_posts: [post('tiktok:42', 'same')] }),
    mk('instagram', 'beta', { recent_posts: [post('instagram:42', 'same')] })]
  eq('同原始作品号不构成同人证据', linkCrossPlatform(unrelated), 0)
  criterion('D11.n')
}

})
if (fullRun) {
// D15：独立上下文按需求与 ADR-110 写成；未读发现来源生产函数体。
suite('D15', '已观察来源按五元组稳定合并，未知不能从任务配置猜补')
{
  const src = (over: Partial<DiscoverySource> = {}): DiscoverySource => ({
    platform: 'instagram', handle: 'Sam', keyword: ' #Tea ', dimension: 'category',
    endpoint: '/api/v1/instagram/v2/search_reels', ...over,
  })
  const a = src(), caps = src({ platform: 'INSTAGRAM' as DiscoverySource['platform'], handle: 'sAM' })
  const differences = [src({ platform: 'tiktok' }), src({ handle: 'Sami' }),
    src({ keyword: '#Tea' }), src({ keyword: ' #tea ' }), src({ keyword: ' Tea ' }),
    src({ dimension: 'scene' }), src({ endpoint: '/api/v1/instagram/v2/search_users' })]
  const first = [caps, a, differences[0]], next = [a, ...differences, caps]
  const before = structuredClone([first, next])
  eq('五字段任一差异都保留，平台账号大小写重复仅留首次原值与顺序',
    mergeDiscoverySources(first, next), [caps, ...differences])
  eq('来源并集不修改两侧数组或记录', [first, next], before)
  for (const separator of [':', '|', ',', '\u0000', '；', ' · ']) {
    const pair = [src({ handle: `a${separator}b`, keyword: 'c' }),
      src({ handle: 'a', keyword: `b${separator}c` })]
    eq(`五元组边界不被分隔符 ${JSON.stringify(separator)} 碰撞吞掉`, mergeDiscoverySources(pair), pair)
  }
  for (const left of [undefined, []] as (DiscoverySource[] | undefined)[])
    for (const right of [undefined, []] as (DiscoverySource[] | undefined)[])
      eq('只有两侧均缺席才保留缺席，有空数组就保留空数组', mergeDiscoverySources(left, right),
        left === undefined && right === undefined ? undefined : [])
  for (const unknown of [undefined, []] as (DiscoverySource[] | undefined)[]) {
    eq('未知在前不抹掉后来观察', mergeDiscoverySources(unknown, [a]), [a])
    eq('未知在后不抹掉已有观察', mergeDiscoverySources([a], unknown), [a])
  }
  criterion('D15.c')

  const task: SearchTask = { keyword: 'config-only', dimension: 'audience', platform: 'instagram', as_hashtag: true }
  const b = src({ keyword: 'later', dimension: 'scene' }), c = src({ keyword: 'third' })
  const acc = new Map<string, Creator>(), page = [{ platform: 'instagram' as const, handle: 'Sam', discovery_sources: [a, caps, b] }]
  const pageBefore = structuredClone(page)
  eq('首次收页新增账号', mergePage(acc, page, 0, task), 1)
  eq('首次收页也去重且保留响应快照，不改成任务配置', acc.get('instagram:sam')?.discovery_sources, [a, b])
  eq('首次收页不改输入来源', page, pageBefore)
  eq('后页同人不增加人数', mergePage(acc, [{ ...page[0], discovery_sources: [b, c, a] }], 1, task), 0)
  eq('合页来源按旧记录、新页顺序取并集', acc.get('instagram:sam')?.discovery_sources, [a, b, c])
  for (const sources of [undefined, []] as (DiscoverySource[] | undefined)[]) {
    const old = new Map([['instagram:sam', mk('instagram', 'Sam', { discovery_sources: sources })]])
    mergePage(old, [{ platform: 'instagram', handle: 'Sam', discovery_sources: [b] }], 2, task)
    eq('旧未知来源允许追加真实观察，只留下新的观察', old.get('instagram:sam')?.discovery_sources, [b])
    eq('新增观察不伪造旧账号完整任务归属', old.get('instagram:sam')?.source_tasks, undefined)
    const fresh = new Map<string, Creator>()
    mergePage(fresh, [{ platform: 'instagram', handle: 'Sam', discovery_sources: sources }], 0, task)
    eq('来源未知不会由配置、首词或任务下标补造', fresh.get('instagram:sam')?.discovery_sources, sources)
  }
  criterion('D15.d')
  tension('D15', 'P1')

  for (const primary of ['tiktok', 'instagram'] as const) {
    const other = primary === 'tiktok' ? 'instagram' : 'tiktok'
    const hiSource = src({ platform: primary, handle: 'Main.Case', dimension: 'competitor' })
    const loSource = src({ platform: other, handle: 'Other.Case', dimension: 'scene' })
    for (const left of [undefined, [], [hiSource, hiSource]] as (DiscoverySource[] | undefined)[])
      for (const right of [undefined, [], [loSource, hiSource]] as (DiscoverySource[] | undefined)[]) {
        const hi = mk(primary, 'Main.Case', { followers: 30_000, email: null, discovery_sources: left,
          bio_links: [other === 'instagram' ? 'https://instagram.com/Other.Case' : 'https://tiktok.com/@Other.Case'] })
        const lo = mk(other, 'Other.Case', { followers: 10_000, email: null, discovery_sources: right })
        const before = structuredClone([left, right]), pair = [lo, hi]
        eq(`${primary} 主账号与关联账号仍按外链识别`, linkCrossPlatform(pair), 1)
        const main = mergeCrossPlatform(pair).find(x => x.merged_into === undefined)
        eq(`${primary} 来源数量与输入位置不改变主账号`, main?.platform, primary)
        const expected = left?.length ? right?.length ? [hiSource, loSource] : [hiSource]
          : right?.length ? [loSource, hiSource] : left === undefined && right === undefined ? undefined : []
        eq(`${primary} 跨平台并集按主次记录保留原平台、账号及维度`, main?.discovery_sources, expected)
        eq('跨平台来源合并不修改输入来源集合', [left, right], before)
      }
  }
  criterion('D15.e')

  const state: TaskState = { product: 'p', market: 'US', target_count: 1, done: [], tasks: [task],
    answered: { 0: 1 }, found: { 0: 1 }, created_at: '', updated_at: '' }
  for (const followers of [undefined, 0, 100, 10_000, 9_000_000]) {
    const plain = mk('instagram', 'Sam', { followers, email: 'a@example.com', fit: '✅', source_tasks: [0],
      recent_posts: [{ id: 'instagram:42', desc: 'observed work', plays: 1000 }] })
    for (const sources of [undefined, [], [a, b, c]] as (DiscoverySource[] | undefined)[]) {
      const withSources = { ...plain, discovery_sources: sources }
      eq('来源集合不改变评分、分层或粉丝准入',
        [scoreCreator(withSources), tierOf(withSources, scoreCreator(withSources)), passesFollowerGate(withSources)],
        [scoreCreator(plain), tierOf(plain, scoreCreator(plain)), passesFollowerGate(plain)])
      eq('已知与未知来源均不改变任务归属统计', keywordRows(state, [withSources]), keywordRows(state, [plain]))
      eq('已知与未知来源均不改变作品交付', toRow(withSources)[HEADERS.indexOf('best_post_desc')], 'observed work')
    }
  }
}

suite('D15', '表格与 HTML 展示真实路线并明确来源记录的边界')
{
  const sources: DiscoverySource[] = [
    { platform: 'tiktok', handle: 'Video', keyword: '#Tea', dimension: 'category', endpoint: '/api/v1/tiktok/app/v3/fetch_video_search_result' },
    { platform: 'instagram', handle: 'Reel', keyword: ' Tea ', dimension: 'scene', endpoint: '/api/v1/instagram/v2/search_reels' },
    { platform: 'instagram', handle: 'User', keyword: 'tea', dimension: 'audience', endpoint: '/api/v1/instagram/v2/search_users' },
  ]
  const expected = 'TikTok 视频搜索 · tiktok:@Video · #Tea · category；Instagram Reels 搜索 · instagram:@Reel ·  Tea  · scene；Instagram 账号名搜索 · instagram:@User · tea · audience'
  eq('三条实际路线共享格式，原词和原账号不改写', formatDiscoverySources(sources), expected)
  for (const unknown of [undefined, []] as (DiscoverySource[] | undefined)[])
    eq('缺席与空来源显示来源未知', formatDiscoverySources(unknown), '来源未知')
  const creator = mk('tiktok', 'delivered', { tier: 'A', score: 10, discovery_sources: sources })
  // 旧列公开契约；不可从改后 HEADERS 的切片取得 expected。
  const oldHeaders = ['tier', 'score', 'fit', 'fit_reason', 'platform', 'handle', 'nickname', 'followers',
    'post_count', 'bio', 'email', 'email_verified', 'audience_geo_top', 'metrics_account_followers',
    'metrics_account_following', 'engagement_rate_followers', 'engagement_rate_views', 'median_views',
    'median_engagements', 'view_rate', 'following_ratio', 'reach_consistency', 'median_post_gap_days',
    'latest_post_at', 'days_since_last_post', 'activity_status', 'audience_quality_risk', 'audience_quality_reasons',
    'tier_adjustments', 'collaboration_quote', 'implied_ecpm', 'implied_ecpe', 'metrics_observed_at',
    'cross_platform', 'linked_handle', 'profile_url', 'source_keyword', 'source_dimension', 'best_post_desc',
    'outreach_draft', 'previously_recommended']
  eq('表头保持旧列与来源顺序，仅末尾追加样本范围', HEADERS,
    [...oldHeaders, 'discovery_sources', 'metrics_sample_scope'])
  eq('来源列维持原位置', HEADERS.indexOf('discovery_sources'), oldHeaders.length)
  eq('来源列维持原单元格', toRow(creator)[HEADERS.indexOf('discovery_sources')], expected)
  eq('行与新增表头一一对应', toRow(creator).length, oldHeaders.length + 2)
  eq('样本范围新列不改变所有旧列及来源的值', toRow(creator).slice(0, -1),
    toRow({ ...creator, account_assessment: undefined }).slice(0, -1))
  const sheets = buildSheets([creator])
  eq('XLSX 每个 sheet 都保留旧列和来源，末尾追加样本范围', sheets.map(s => s.headers),
    Array.from({ length: 3 }, () => [...oldHeaders, 'discovery_sources', 'metrics_sample_scope']))
  eq('XLSX 来源单元格与 CSV 共用格式',
    sheets[0].rows[0][HEADERS.indexOf('discovery_sources')], expected)
  for (const unknown of [undefined, []] as (DiscoverySource[] | undefined)[])
    eq('表格未知来源不冒充空白或未查询作品',
      toRow({ ...creator, discovery_sources: unknown })[HEADERS.indexOf('discovery_sources')], '来源未知')
  const dangerous = { ...sources[1], handle: 'Handle<&>', keyword: '<img src=x onerror="boom()">&\'TAG' }
  const html = renderHtml([creator, mk('instagram', 'empty', { tier: 'B', discovery_sources: [] }),
    mk('instagram', 'missing', { tier: 'C' }), mk('instagram', 'escaped', { tier: 'C', discovery_sources: [dangerous] })],
    { product: 'p', market: 'US', platforms: ['tiktok', 'instagram'], keywords: [], total: 4,
      tiers: { A: 1, B: 1, C: 2 }, email_count: 0, cross_platform_count: 0, ...testCostMeta(), enriched: false })
  ok('HTML 来源展示与表格使用同一格式', html.includes(expected))
  eq('HTML 每个账号均有已观察发现来源标签', html.split('已观察发现来源').length - 1, 4)
  eq('HTML 缺席与空数组分别显示来源未知', html.split('来源未知').length - 1, 2)
  ok('HTML 转义来源账号、标签边界与 ampersand', html.includes('Handle&lt;&amp;&gt;') &&
    html.includes('&lt;img src=x') && html.includes('&gt;&amp;') && !html.includes('<img src=x'))
  ok('HTML 转义来源中的双引号与单引号', !html.includes('onerror="boom()"') && /&(?:#39|#x27|apos);TAG/.test(html))
  criterion('D15.h')
  ok('HTML 不把已有记录包装成完整历史、作品来源或请求次数',
    html.includes('仅含已记录的账号发现来源，可能不含完整历史；不对应具体作品或请求次数'))
  criterion('D15.i')
  tension('D15', 'P5')
}

// 独立上下文先于实现写成；期望只依据 ADR-112 第二、五节，D11、P1、D15 的需求文字，
// 以及 isInstagramVideo、parseInstagramHashtagPage、pickList 的接口说明；不取自任何产品函数体。
suite('D15', 'IG 话题页解析：只解析、不分派（ADR-112 第四节第 2 步）')
{
  // 调用放进 thunk：抛出变成一个显眼的值再比 —— 否则「期望缺席」的断言会被一次抛出静默放行，
  // 而一次抛出也不会拖垮后面的断言。
  const probe = (label: string, run: () => unknown, want: unknown) => {
    let got: unknown
    try { got = run() } catch (e) { got = `抛出：${e instanceof Error ? e.message : String(e)}` }
    eq(label, got, want)
  }

  // 五个信号各自单独成立就算视频；话题页混着的图文与轮播不算（isInstagramVideo 说明、ADR-112 第五节）。
  const videoCases: [string, unknown, boolean][] = [
    ['只有 is_video 为 true 也算', { is_video: true }, true],
    ['只有 media_type 为 2 也算', { media_type: 2 }, true],
    ['只有 media_format 为 video 也算', { media_format: 'video' }, true],
    ['只有 media_name 为 reel 也算', { media_name: 'reel' }, true],
    ['只有 product_type 为 clips 也算', { product_type: 'clips' }, true],
    // 「任一成立就算」：别的键说不是也不推翻
    ['任一信号成立就算，is_video 为 false 不推翻 media_type 2', { is_video: false, media_type: 2 }, true],
    ['话题页的图文不算', { media_type: 1, is_video: false, product_type: 'feed' }, false],
    ['话题页的轮播不算', { media_type: 8, is_video: false, product_type: 'carousel_container' }, false],
    ['五个键都缺席的空对象不算', {}, false],
    ['null 不是对象，不算', null, false],
    ['undefined 不是对象，不算', undefined, false],
    ['字符串不是对象，不算', 'reel', false],
  ]
  for (const [name, item, want] of videoCases) probe(`IG 视频判定：${name}`, () => isInstagramVideo(item), want)

  const task: SearchTask = { keyword: '#Self Care', dimension: 'scene', platform: 'instagram' }
  // 话题页响应形状：列表在 data.data.items，续页令牌与 data.data 同级（ADR-112 第五节第 2 条）。
  const items = [
    { id: 'abc', user: { username: 'alice' }, caption_text: '话题视频', caption: { text: 'Reels 那边的文案字段' },
      media_type: 2, play_count: 1000, ig_play_count: 1, like_count: 50 },
    { id: 'orphan', caption_text: '没有作者', media_type: 2, play_count: 5 },
    { id: 12345, user: { username: 'bob' }, caption_text: '话题图文',
      media_type: 1, product_type: 'feed', is_video: false, play_count: 999, like_count: null },
    { id: '   ', user: { username: 'alice' }, caption_text: '话题轮播',
      media_type: 8, product_type: 'carousel_container', is_video: false, play_count: 777, like_count: 7 },
    { user: { username: 'carol' }, caption: { text: '只有 caption.text' }, is_video: true, ig_play_count: 500, like_count: 0 },
    { id: 'nameless', user: { full_name: '有 user 没账号名' }, caption_text: '没有账号名', media_type: 2 },
    { id: 'd1', user: { username: 'dave' }, media_type: 2 },
  ]
  type Page = ReturnType<typeof parseInstagramHashtagPage>
  let parsed: Page | undefined, parseError: unknown = new Error('没有解析结果')
  try { parsed = parseInstagramHashtagPage({ data: { data: { items }, pagination_token: 'NEXT_PAGE_TOKEN' } }, task) }
  catch (e) { parseError = e }
  const page = (): Page => { if (parsed === undefined) throw parseError; return parsed }
  const account = (handle: string) => {
    const found = page().creators.find(c => c.handle === handle)
    if (!found) throw new Error(`没有账号 ${handle}`)
    return found
  }
  const post = (handle: string, i: number): RecentPost => {
    const found = account(handle).recent_posts?.[i]
    if (!found) throw new Error(`${handle} 没有第 ${i + 1} 条作品`)
    return found
  }

  probe('话题页 raw_count 是列表条目数，含没有作者名的条目', () => page().raw_count, 7)
  // 七条里 orphan（没有 user）与 nameless（user 里没有 username）不产出账号；alice 两条合成一个
  probe('话题页有作者名的作者各成一个账号，没有作者名的条目不产出账号',
    () => page().creators.map(c => c.handle).sort(), ['alice', 'bob', 'carol', 'dave'])
  // 有作者名的五条全在账号名下，orphan 与 nameless 两条不挂到任何人名下
  probe('话题页没有作者名的条目不挂到任何账号名下',
    () => page().creators.flatMap(c => c.recent_posts ?? []).length, 5)
  // 中间隔着 bob 的一条，顺序才真的被检查到
  probe('话题页同一作者的条目合成一个账号，作品按条目出现顺序排',
    () => account('alice').recent_posts?.map(p => p.desc), ['话题视频', '话题轮播'])
  for (const handle of ['alice', 'bob', 'carol', 'dave']) {
    probe(`话题页账号 ${handle}：平台与主页地址`, () => [account(handle).platform, account(handle).profile_url],
      ['instagram', `https://www.instagram.com/${handle}/`])
    // 投影成元组比：不依赖实现拼对象的键顺序；数组长度同时钉住「恰好一条」（alice 两条作品也只一条来源）
    probe(`话题页账号 ${handle}：来源恰好一条，关键词原样保留开头的 #，端点是话题页`,
      () => account(handle).discovery_sources?.map(s => [s.platform, s.handle, s.keyword, s.dimension, s.endpoint]),
      [['instagram', handle, '#Self Care', 'scene', '/api/v1/instagram/v2/fetch_hashtag_posts']])
    // 解析器写不写 source_keyword 说明里没讲；写了就只能是原词（ADR-112 第二节「原词保留」）
    probe(`话题页账号 ${handle}：source_keyword 若写出只能是任务原词`,
      () => [undefined, '#Self Care'].includes(account(handle).source_keyword), true)
  }

  // D11.i：非空白字符串原样、安全整数转十进制，都加 instagram: 前缀；空白或缺失时缺席
  probe('话题页作品 id：字符串原样加平台前缀', () => post('alice', 0).id, 'instagram:abc')
  probe('话题页作品 id：安全整数转十进制加平台前缀', () => post('bob', 0).id, 'instagram:12345')
  probe('话题页作品 id：空白时缺席，不以空串代替', () => post('alice', 1).id, undefined)
  probe('话题页作品 id：原始 id 缺失时缺席', () => post('carol', 0).id, undefined)
  criterion('D11.i')

  probe('话题页文案取 caption_text，同条目里的 caption.text 不认', () => post('alice', 0).desc, '话题视频')
  probe('话题页只有 caption.text 的条目文案为空串', () => post('carol', 0).desc, '')
  probe('话题页没有任何文案字段的条目文案为空串', () => post('dave', 0).desc, '')

  probe('话题页赞数取 like_count', () => post('alice', 0).likes, 50)
  // 0 不是 null 也不是缺席，是真实的值
  probe('话题页赞数为 0 照写 0', () => post('carol', 0).likes, 0)
  probe('话题页赞数为 null 时缺席，不写成 0', () => post('bob', 0).likes, undefined)
  probe('话题页赞数字段缺席时缺席', () => post('dave', 0).likes, undefined)

  // 「取 play_count，缺席时 ig_play_count」：两个都在时 play_count 优先
  probe('话题页视频条目播放数取 play_count，不被 ig_play_count 盖掉', () => post('alice', 0).plays, 1000)
  probe('话题页视频条目没有 play_count 时取 ig_play_count', () => post('carol', 0).plays, 500)
  // 图文、轮播的播放字段语义没确认过，不能当成真实的数，也不能当成 0（ADR-112 第二节、P1）
  probe('话题页图文条目带着 play_count 也不写播放数', () => post('bob', 0).plays, undefined)
  probe('话题页轮播条目带着 play_count 也不写播放数', () => post('alice', 1).plays, undefined)
  // 两个播放字段都缺席：不推算、不补 0（ADR-112 第五节「缺席字段保持缺席」）
  probe('话题页视频条目两个播放字段都缺席时播放数缺席', () => post('dave', 0).plays, undefined)

  probe('话题页 has_more 为 false', () => page().has_more, false)
  probe('话题页响应里有 pagination_token 也不交回续页令牌', () => page().next_token, undefined)

  // 全空但确实是数组 = 真的没结果，不报错（P1 那组 pickList 用例的同一条口径）
  probe('话题页列表为空数组：零条、零人、不报错',
    () => { const p = parseInstagramHashtagPage({ data: { data: { items: [] } } }, task)
      return [p.raw_count, p.creators, p.has_more] }, [0, [], false])
  // 认不出列表时照 pickList 抛出：报错附上 data 下的顶层 key，不硬猜（pickList 说明、P1 那组用例第四条）
  probe('话题页认不出列表时照 pickList 抛出，报错里带上顶层 key', () => {
    try { parseInstagramHashtagPage({ data: { hashtag_weird_key: 1 } }, task) } catch (e) {
      return String(e instanceof Error ? e.message : e).includes('hashtag_weird_key') }
    return '没有抛出'
  }, true)

  // 与上一组三条路线同一格式：路线 · 平台:@账号 · 原词 · 维度
  probe('话题端点来源显示为「Instagram 话题搜索」，格式与另三条路线相同',
    () => formatDiscoverySources([{ platform: 'instagram', handle: 'Tag', keyword: '#Self Care', dimension: 'scene',
      endpoint: INSTAGRAM_HASHTAG_ENDPOINT }]),
    'Instagram 话题搜索 · instagram:@Tag · #Self Care · scene')
}

// 独立上下文先于实现写成：期望只出自 ADR-112 第二、五节，D15.j、D15.k、D6.w、D11.b 原文，
// 以及 ig-route.ts 与 TikHub.search 的说明；没有读 search() 与 ig-route.ts 的函数体。
}
await group('d15-hashtag', async () => {
suite('D15', 'IG 话题入口：配置校验与分派（ADR-112 第四节第 3 步）')
{
  // 调用包一层：抛出变成一个显眼的值再比，一次抛出不拖垮后面的断言；标签照样写成字面量，进清册
  const attempt = <T>(run: () => T): T | string => {
    try { return run() } catch (e) { return `抛出：${e instanceof Error ? e.message : String(e)}` }
  }
  // 端点取字面量，不拿产品常量当预期：话题页见 ADR-112 第五节与价目那一行，Reels 与账号名搜索见 D15.a
  const HT = '/api/v1/instagram/v2/fetch_hashtag_posts'
  const REELS = '/api/v1/instagram/v2/search_reels'
  const USERS = '/api/v1/instagram/v2/search_users'

  // ── hashtagKeyword：去掉**一个**开头的 #，别的一个字不动（D15.k、ig-route.ts 说明）──
  const kw = (keyword: string) => attempt(() => hashtagKeyword({ keyword }))
  eq('话题入口：请求关键词没有 # 时原样', kw('selfcare'), 'selfcare')
  eq('话题入口：请求关键词去掉开头的一个 #', kw('#selfcare'), 'selfcare')
  eq('话题入口：请求关键词开头两个 # 只去掉一个', kw('##selfcare'), '#selfcare')
  eq('话题入口：请求关键词只有一个 # 时剩空串', kw('#'), '')
  eq('话题入口：请求关键词中间的 # 不动', kw('self#care'), 'self#care')
  // 「不修剪空白」：开头是空白时 # 就不在开头，一个字都不去；末尾的空白原样留着（空白在校验里就拒了）
  eq('话题入口：请求关键词不修剪空白，开头是空白时 # 不算开头',
    [kw(' #selfcare'), kw('#selfcare ')], [' #selfcare', 'selfcare '])

  // ── igRouteProblems：合规交回空数组；每个不合规的任务一句话，写明第几个任务（D15.j、ig-route.ts 说明）──
  const problems = (tasks: unknown): string[] | string => attempt(() => igRouteProblems(tasks))
  const ig = (keyword: string, over: Record<string, unknown> = {}) =>
    ({ keyword, dimension: 'scene', platform: 'instagram', ...over })
  const tt = (keyword: string, over: Record<string, unknown> = {}) =>
    ({ keyword, dimension: 'category', platform: 'tiktok', ...over })
  /** 这句话写明的是不是第 n 个任务：从 1 数、同任务标签「任务 N」；写成「第 N 个」也认 */
  const names = (msg: unknown, n: number): boolean =>
    typeof msg === 'string' && new RegExp(`任务\\s*${n}(?!\\d)|第\\s*${n}\\s*个`).test(msg)

  const fine: [string, unknown][] = [
    ['空任务列表', []],
    // 没写 ig_route 的任务关键词怎么写都不归它管（关键词本身的校验在别处）
    ['没写 ig_route 的任务', [ig('self care'), tt('#'), ig(''), ig('#self care'), tt('a\tb')]],
    ['as_hashtag 不是路线', [ig('#selfcare', { as_hashtag: true }), tt('#selfcare', { as_hashtag: true })]],
    ['IG 任务写 hashtag、关键词没有 #', [ig('selfcare', { ig_route: 'hashtag' })]],
    ['IG 任务写 hashtag、关键词开头一个 #', [ig('#selfcare', { ig_route: 'hashtag' })]],
    // 只去掉一个 #：剩下的「#selfcare」「#」都不空、不含空白
    ['IG 任务写 hashtag、关键词开头两个 #', [ig('##selfcare', { ig_route: 'hashtag' })]],
    ['IG 任务写 hashtag、关键词是 ##', [ig('##', { ig_route: 'hashtag' })]],
    ['IG 任务写 hashtag、非拉丁关键词', [ig('#护肤', { ig_route: 'hashtag', as_hashtag: true })]],
    // 任务列表不是数组时交回空数组，交给别处（ig-route.ts 说明）
    ['不是数组：undefined', undefined], ['不是数组：null', null], ['不是数组：字符串', 'tasks'],
    ['不是数组：数字', 42], ['不是数组：像数组的对象', { 0: ig('#a b', { ig_route: 'reels' }), length: 1 }],
    // 每项是不是对象也不在这里判
    ['数组里有不是对象的项', [null, 42, 'task', ig('#selfcare', { ig_route: 'hashtag' })]],
  ]
  const fineWrong = fine.map(([name, tasks]) => [name, problems(tasks)] as const)
    .filter(([, got]) => JSON.stringify(got) !== '[]').map(([name, got]) => `${name} → ${JSON.stringify(got)}`)
  eq('话题入口：合规的路线配置与不归它判的输入都交回空数组', fineWrong, [])

  const bad: [string, Record<string, unknown>][] = [
    // ig_route 出现了、却不是字符串 "hashtag"
    ['ig_route 为 null', ig('selfcare', { ig_route: null })],
    ['ig_route 为空串', ig('selfcare', { ig_route: '' })],
    ['ig_route 大小写不同', ig('selfcare', { ig_route: 'Hashtag' })],
    ['ig_route 全大写', ig('selfcare', { ig_route: 'HASHTAG' })],
    ['ig_route 带空白', ig('selfcare', { ig_route: ' hashtag' })],
    ['ig_route 是别的路线名', ig('selfcare', { ig_route: 'reels' })],
    ['ig_route 是 true', ig('selfcare', { ig_route: true })],
    ['ig_route 是数字', ig('selfcare', { ig_route: 1 })],
    ['ig_route 是数组', ig('selfcare', { ig_route: ['hashtag'] })],
    ['ig_route 是对象', ig('selfcare', { ig_route: {} })],
    // "hashtag" 写在非 Instagram 任务上
    ['hashtag 写在 TikTok 任务上', tt('selfcare', { ig_route: 'hashtag' })],
    // 去掉一个开头的 # 之后为空，或含空白（空格、制表符、换行等）
    ['关键词只有 #', ig('#', { ig_route: 'hashtag' })],
    ['关键词是空串', ig('', { ig_route: 'hashtag' })],
    ['关键词去掉 # 后含空格', ig('#self care', { ig_route: 'hashtag' })],
    ['关键词不带 # 也含空格', ig('self care', { ig_route: 'hashtag' })],
    ['关键词含制表符', ig('#self\tcare', { ig_route: 'hashtag' })],
    ['关键词末尾是换行', ig('#selfcare\n', { ig_route: 'hashtag' })],
    ['关键词开头是空格', ig(' #selfcare', { ig_route: 'hashtag' })],
    ['# 后面紧跟空格', ig('# selfcare', { ig_route: 'hashtag' })],
    ['关键词含全角空格', ig('#self　care', { ig_route: 'hashtag' })],
    // 一个任务两处不合规：仍是「每个不合规的任务一句话」
    ['TikTok 任务写 hashtag、关键词还只有 #', tt('#', { ig_route: 'hashtag' })],
    ['TikTok 任务写了别的路线名', tt('selfcare', { ig_route: 'reels' })],
  ]
  // 坏的一律放在第 2 个，前面垫一个合规任务：按 0 数的写法会写成「任务 1」
  const badWrong = bad.map(([name, task]) => [name, problems([tt('plainword'), task])] as const)
    .filter(([, got]) => !(Array.isArray(got) && got.length === 1 && names(got[0], 2)))
    .map(([name, got]) => `${name} → ${JSON.stringify(got)}`)
  eq('话题入口：每个不合规的任务恰好一句话，写明是第 2 个任务', badWrong, [])

  // 好坏相间、跨过两位数：句数等于坏任务数；每个坏任务恰好被一句话点名，好任务一个都不被点名。
  // 关键词不带数字、取值不用数字，免得句子里的数被误认成序号
  const mixed = [
    tt('alpha'), ig('#beta', { ig_route: 'reels' }), ig('#gamma', { ig_route: 'hashtag' }), ig('delta'),
    tt('#epsilon', { ig_route: 'hashtag' }), ig('zeta'), ig('#eta', { ig_route: 'hashtag' }), tt('theta'),
    ig('iota'), ig('#kappa lambda', { ig_route: 'hashtag' }), ig('#mu', { ig_route: 'hashtag' }),
    ig('#', { ig_route: 'hashtag' }),
  ]
  const mixedGot = problems(mixed)
  const namedCount = (n: number) => Array.isArray(mixedGot) ? mixedGot.filter(m => names(m, n)).length : mixedGot
  eq('话题入口：好坏相间的配置，每个坏任务恰好被一句话点名、好任务不被点名',
    [Array.isArray(mixedGot) ? mixedGot.length : mixedGot, mixed.map((_, i) => namedCount(i + 1))],
    [4, [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1]])
  // 不是对象的项不判，但照数组位置占号：同任务标签，第 4 项坏了就写第 4 个
  const holes = problems([null, 42, 'task', ig('#self care', { ig_route: 'hashtag' })])
  eq('话题入口：不是对象的项不判，序号仍按数组位置从 1 数',
    Array.isArray(holes) && holes.length === 1 && names(holes[0], 4), true)
  // 「哪一条不合规」：三种不合规各自单独放在第 1 个任务上，同一个序号，说的必须是三件不同的事
  const kinds = [ig('selfcare', { ig_route: 'reels' }), tt('selfcare', { ig_route: 'hashtag' }),
    ig('#', { ig_route: 'hashtag' })].map(t => problems([t]))
  eq('话题入口：取值不对、不在 IG 任务上、关键词不可用，三种不合规的说法互不相同',
    kinds.every(k => Array.isArray(k) && k.length === 1)
      && new Set(kinds.map(k => Array.isArray(k) ? k[0] : k)).size === 3, true)
  criterion('D15.j')

  // ── search() 在最前面按 ig_route 分派（D15.k、D6.w，TikHub.search 说明）──
  type Page = Awaited<ReturnType<TikHub['search']>>
  // 话题页响应形状：列表在 data.data.items，令牌与 data.data 同级（ADR-112 第五节第 2 条）
  const hashtagBody = (items: unknown[]) => ({ data: { pagination_token: 'ht-token-in-response', data: { items } } })
  const htItems = [
    { id: 'h1', user: { username: 'alice' }, caption_text: '话题视频',
      media_type: 2, is_video: true, product_type: 'clips', play_count: 300 },
    { id: 'h2', user: { username: 'bob' }, caption_text: '话题图文',
      media_type: 1, is_video: false, product_type: 'feed' },
  ]
  // Reels 也带着令牌：话题任务若被错送到 Reels，「不交回令牌」那条会红，而不是碰巧绿
  const reelsBody = { data: { pagination_token: 'reels-token-in-response', data: { items: [
    { id: 'r1', caption: { text: 'Reels 文案' }, play_count: 5, user: { username: 'carol', full_name: 'C' } },
  ] } } }
  const usersBody = { data: { data: { items: [{ username: 'fallback', full_name: 'F', id: '1' }] } } }
  /** 按端点回罐头，记下每一次请求的完整地址；没登记的端点回一个认不出的结构 */
  const searchVia = async (task: SearchTask, offset: number, token: string | undefined,
    bodies: Record<string, unknown>) => {
    const budget = fundedBudget()
    const calls: URL[] = []
    const real = globalThis.fetch
    globalThis.fetch = (async (input: any) => {
      const u = new URL(String(input))
      calls.push(u)
      return new Response(JSON.stringify(bodies[u.pathname] ?? { data: { 认不出: 1 } }), { status: 200 })
    }) as unknown as typeof fetch
    let page: Page | undefined, error: string | undefined
    try { page = await new TikHub('k', budget).search(task, 'US', offset, token) }
    catch (e) { error = `抛出：${e instanceof Error ? e.message : String(e)}` }
    finally { globalThis.fetch = real }
    return { page, error, calls, paid: budget.count }
  }
  const sortedCreators = (p: Page | undefined) =>
    [...(p?.creators ?? [])].sort((a, b) => String(a.handle).localeCompare(String(b.handle)))
  const all = { [HT]: hashtagBody(htItems), [REELS]: reelsBody, [USERS]: usersBody }

  const htTask: SearchTask = { keyword: '#SelfCare', dimension: 'scene', platform: 'instagram', ig_route: 'hashtag' }
  const first = await searchVia(htTask, 0, undefined, all)
  const sent = first.calls[0]?.searchParams
  eq('话题入口：话题任务首页恰好发一次请求，请求的是话题页', first.calls.map(u => u.pathname), [HT])
  eq('话题入口：话题请求的 keyword 去掉开头的 #，feed_type 为 top，不带续页令牌',
    [sent?.get('keyword'), sent?.get('feed_type'), sent?.has('pagination_token')], ['SelfCare', 'top', false])
  eq('话题入口：话题页照常计费一次', first.paid, 1)
  eq('话题入口：话题首页交回解析出的账号与条目数，没有抛出',
    [first.error, sortedCreators(first.page).map(c => c.handle), first.page?.raw_count], [undefined, ['alice', 'bob'], 2])
  // 原词保留（ADR-112 第二节）：来源照用任务关键词原样，只有请求参数去掉 #
  eq('话题入口：话题路线的来源是话题端点与任务原关键词，开头的 # 保留',
    sortedCreators(first.page).map(c => c.discovery_sources?.map(s => [s.platform, s.handle, s.keyword, s.dimension, s.endpoint])),
    [[['instagram', 'alice', '#SelfCare', 'scene', HT]], [['instagram', 'bob', '#SelfCare', 'scene', HT]]])
  // D6.w：不交回续页令牌 —— 响应里明明有 data.pagination_token
  eq('话题入口：话题页不交回续页令牌、has_more 为 false，响应里有令牌也一样',
    [first.page === undefined, first.page?.next_token, first.page?.has_more], [false, undefined, false])
  // 「用 parseInstagramHashtagPage 解析」：同一份响应，search 交回的与解析器直接解析的一模一样（解析口径由上一组钉住）
  eq('话题入口：search 交回的页就是话题解析器对同一份响应的解析',
    first.page ?? first.error, attempt(() => parseInstagramHashtagPage(hashtagBody(htItems), htTask)))

  const keywordSent = async (keyword: string) =>
    (await searchVia({ ...htTask, keyword }, 0, undefined, all)).calls[0]?.searchParams.get('keyword')
  eq('话题入口：关键词没有 # 时请求参数原样，## 开头时只去掉一个',
    [await keywordSent('selfcare'), await keywordSent('##selfcare')], ['selfcare', '#selfcare'])

  // 有条目、一个作者都解析不出：Reels 这样会改搜账号名（D6.k），话题路线不走兜底（D6.w）
  const nobody = await searchVia(htTask, 0, undefined, { ...all, [HT]: hashtagBody([
    { id: 'n1', caption_text: '没有 user' },
    { id: 'n2', user: { full_name: '有 user 没账号名' }, caption_text: '没有账号名' },
    { id: 'n3', caption_text: '也没有 user' },
  ]) })
  eq('话题入口：话题页解析不出人也不改搜账号名，只发这一次请求', nobody.calls.map(u => u.pathname), [HT])
  eq('话题入口：解析不出人的话题页照实交回 0 人与条目数，只计费一次',
    [nobody.error, nobody.page?.creators.length, nobody.page?.raw_count, nobody.paid], [undefined, 0, 3, 1])
  // D6.w「零条目如实记为 0 条，不改搜账号名」
  const empty = await searchVia(htTask, 0, undefined, { ...all, [HT]: hashtagBody([]) })
  eq('话题入口：零条目的话题页如实交回 0 条，不改搜账号名',
    [empty.calls.map(u => u.pathname), empty.error, empty.page?.raw_count, empty.page?.creators.length], [[HT], undefined, 0, 0])

  // 只请求首页：offset > 0 或带着令牌时直接交回空页、不发请求（TikHub.search 说明、D6.w）
  const blankPage = (r: Awaited<ReturnType<typeof searchVia>>) =>
    [r.calls.length, r.paid, r.error, r.page?.creators.length, r.page?.raw_count, r.page?.has_more, r.page?.next_token]
  eq('话题入口：话题任务 offset 大于 0 时交回空页、一个请求都不发',
    blankPage(await searchVia(htTask, 20, undefined, all)), [0, 0, undefined, 0, 0, false, undefined])
  eq('话题入口：话题任务带着令牌时交回空页、一个请求都不发',
    blankPage(await searchVia(htTask, 0, 'tok-1', all)), [0, 0, undefined, 0, 0, false, undefined])
  eq('话题入口：话题任务 offset 大于 0 又带着令牌时也不发请求',
    blankPage(await searchVia(htTask, 3, 'tok-1', all)), [0, 0, undefined, 0, 0, false, undefined])

  // ig_route 缺席照旧走 Reels；路线不由 as_hashtag、关键词写法推断（D15.k）
  const plainTask: SearchTask = { keyword: '#SelfCare', dimension: 'scene', platform: 'instagram' }
  eq('话题入口：没写 ig_route 的 IG 任务照走 Reels，关键词带 # 也不改路线',
    (await searchVia(plainTask, 0, undefined, all)).calls.map(u => u.pathname), [REELS])
  eq('话题入口：as_hashtag 只是配置元数据，不切换到话题页',
    (await searchVia({ ...plainTask, as_hashtag: true }, 0, undefined, all)).calls.map(u => u.pathname), [REELS])
  criterion('D15.k', 'D6.w', 'D15.a')

  // ── 跨路线同一作品 id（ADR-112 第二节末条、D11.b、D11.h）──
  // Reels 页与话题页都给了 alice 的同一条作品 id 'same'；两页都真的经 search() 分派拿回来，
  // 再按任务顺序并进同一个累加器：先到的那条整条留下，后到的不回填播放数；话题独有的那条追加在后。
  // Reels 条目虽有源 play_count: 100，却没有确认视频的信号，归一化后的 plays 应缺席。
  const crossBodies = {
    [REELS]: { data: { data: { items: [
      { id: 'same', caption: { text: 'Reels 那条' }, play_count: 100, user: { username: 'alice', full_name: 'A' } },
    ] } } },
    [HT]: hashtagBody([
      { id: 'same', user: { username: 'alice' }, caption_text: '话题那条',
        media_type: 2, is_video: true, product_type: 'clips', play_count: 999 },
      { id: 'extra', user: { username: 'alice' }, caption_text: '话题独有', media_type: 1, product_type: 'feed' },
    ]),
  }
  const reelsTask: SearchTask = { keyword: 'selfcare', dimension: 'category', platform: 'instagram' }
  const reelsPage = (await searchVia(reelsTask, 0, undefined, crossBodies)).page
  const htPage = (await searchVia(htTask, 0, undefined, crossBodies)).page
  const mergedInOrder = (order: [Page | undefined, SearchTask][]) => attempt(() => {
    const firstPost = order[0][0]?.creators.find(c => c.handle === 'alice')?.recent_posts?.[0]
    const firstBefore = structuredClone(firstPost)
    const acc = new Map<string, Creator>()
    order.forEach(([p, t], i) => { if (!p) throw new Error(`第 ${i + 1} 页没拿到`); mergePage(acc, p.creators, i, t) })
    const kept = acc.get('instagram:alice')
    return [kept?.recent_posts?.map(p => [p.id, p.desc, p.plays]),
      JSON.stringify(kept?.recent_posts?.[0]) === JSON.stringify(firstBefore),
      JSON.stringify(firstPost) === JSON.stringify(firstBefore),
      kept?.discovery_sources?.map(s => s.endpoint)]
  })
  eq('话题入口：Reels 先到、话题后到的同一作品 id 只留 Reels 那条，话题独有的作品追加在后',
    mergedInOrder([[reelsPage, reelsTask], [htPage, htTask]]),
    [[['instagram:same', 'Reels 那条', undefined], ['instagram:extra', '话题独有', undefined]], true, true, [REELS, HT]])
  eq('话题入口：话题先到、Reels 后到的同一作品 id 只留话题那条，播放数随先到的路线',
    mergedInOrder([[htPage, htTask], [reelsPage, reelsTask]]),
    [[['instagram:same', '话题那条', 999], ['instagram:extra', '话题独有', undefined]], true, true, [HT, REELS]])
  criterion('D11.b', 'D11.h')
  tension('D18', 'P1')
}

})
await group('d16-tasks', () => {
suite('D16', '任务列表按必填字段校验')
{
  // 照 D15：调用包一层，抛出变成一个显眼的值再比，一次抛出不拖垮后面的断言；标签照样写成字面量
  const attempt = <T>(run: () => T): T | string => {
    try { return run() } catch (e) { return `抛出：${e instanceof Error ? e.message : String(e)}` }
  }
  // 传入值的「形状照」：键、键序与取值都拍进去 —— JSON 看不见值为 undefined 的键，
  // 把缺席的字段补成 undefined 也得看得见
  const shape = (v: unknown): unknown =>
    v !== null && typeof v === 'object'
      ? [Array.isArray(v) ? '数组' : '对象', Object.keys(v).map(k => [k, shape((v as Record<string, unknown>)[k])])]
      : [typeof v, v === undefined ? '（undefined）' : v]
  // D16.i 的属性形式：本组每一次调用前后各拍一张，对不上就记下，组末一条断言一起比 —— 不管喂的是什么，传入值都不变
  const rewritten: string[] = []
  const problems = (tasks: unknown): string[] | string => {
    const before = JSON.stringify(shape(tasks))
    const got = attempt(() => taskListProblems(tasks))
    const after = JSON.stringify(shape(tasks))
    if (after !== before) rewritten.push(`${before} → ${after}`)
    return got
  }
  // 维度与平台取字面量，不拿产品常量当预期（F2.a 的四个维度、S4 的两个平台）
  const tt = (keyword: string, over: Record<string, unknown> = {}): Record<string, unknown> =>
    ({ keyword, dimension: 'category', platform: 'tiktok', ...over })
  const ig = (keyword: string, over: Record<string, unknown> = {}): Record<string, unknown> =>
    ({ keyword, dimension: 'scene', platform: 'instagram', ...over })
  /** 缺席 = 没有这个键（不是值为 undefined —— task.json 里写不出 undefined） */
  const without = (task: Record<string, unknown>, ...keys: string[]) => {
    const copy = { ...task }
    for (const k of keys) delete copy[k]
    return copy
  }
  const ABSENT = Symbol('缺席')
  /**
   * 这句话点名的是不是第 n 个任务：从 1 数、**同任务标签「任务 N」**（D16.b「同任务标签」，签名说明「写明『任务 N』」）；
   * 「任务 1」不算点名「任务 12」。与 D15 不同，这里不认「第 N 个」—— 那不是任务标签的写法，用户拿它对不上采集输出里的标签（U8.a）
   */
  const names = (msg: unknown, n: number): boolean =>
    typeof msg === 'string' && new RegExp(`任务\\s*${n}(?!\\d)`).test(msg)
  /**
   * 这句话点名了随便哪一个任务。只用在「不点名任何一个任务」那一侧，所以故意比 names 宽 ——
   * 写成「第 N 个」也算点名了，宽一点只会更严
   */
  const namesSome = (msg: unknown): boolean => typeof msg === 'string' && /任务\s*\d|第\s*\d+\s*个/.test(msg)
  const namedCount = (got: string[] | string, n: number): number | string =>
    Array.isArray(got) ? got.filter(s => names(s, n)).length : got
  /**
   * 这句话写着读到的值 text（按 JSON 写法）。缺席那一格写「缺席」：不带引号 —— 带了就和读到字符串 "缺席" 那一句
   * 分不出（P1）；也不写 undefined —— JSON 里没有这个值，那是把缺席原样打了出来。
   * 模板里本来就有「缺席」两个字、读到的值那一格却没写的那一种，这里看不出，由下面「缺席与读到 null」那一组比出来
   */
  const writes = (s: string, text: string): boolean =>
    text === '缺席' ? s.includes('缺席') && !s.includes('"缺席"') && !s.includes('undefined') : s.includes(text)
  /**
   * 这一句写进的是整个任务或整份列表，不是这一处读到的值。子串判定「写着读到的值」挡不住它：夹具里的列表本来就含着这一项。
   * - JSON 的「"键":」写法只会从一个整对象里来 —— 读到的值那一格写不出它（本组夹具没有哪个读到的值是带这三个键的对象），
   *   任务标签「任务 N」也写不出它；
   * - 垫在前面的合规任务的关键词 plainword 只会从整份列表里来（只拿它查点名第 2 个及以后任务的那一句）
   */
  const dumpsWhole = (s: string): boolean => /"(keyword|dimension|platform)":/.test(s) || s.includes('plainword')
  /** 点名第 n 个任务的那一句里，同时写着字段名与读到的值（按 JSON 写法；缺席写「缺席」）—— 是这个字段的值，不是整个任务 */
  const pointsAt = (got: string[] | string, n: number, field: string, text: string): boolean =>
    Array.isArray(got) && got.some(s => names(s, n) && s.includes(field) && writes(s, text) && !dumpsWhole(s))
  /** word 在 s 里出现了几次 */
  const occurrences = (s: string, word: string) => s.split(word).length - 1
  const missList = (rows: readonly (readonly [string, string[] | string, ...unknown[]])[],
    pass: (got: string[], row: readonly unknown[]) => boolean) =>
    rows.filter(row => { const got = row[1]; return !(Array.isArray(got) && pass(got, row)) })
      .map(([name, got]) => `${name} → ${JSON.stringify(got)}`)

  // ── D16.a：tasks 本身缺席、不是数组或是空数组（空数组是需求所有者的裁决，ADR-115 第二节）──
  // 读到的值按 JSON 写法、缺席写明缺席；预期写成字面量
  const wholes: [string, unknown, string][] = [
    ['缺席', undefined, '缺席'],
    ['null', null, 'null'],
    ['空数组', [], '[]'],
    ['字符串', 'selfcare', '"selfcare"'],
    ['数字', 7, '7'],
    ['布尔', true, 'true'],
    ['空对象', {}, '{}'],
    // 把单个任务当成了列表
    ['单个任务对象', tt('selfcare'), '{"keyword":"selfcare","dimension":"category","platform":"tiktok"}'],
    // 按下标与 length 走一遍，会把它当成一份只有一个合规任务的列表
    ['类数组对象', { 0: tt('selfcare'), length: 1 },
      '{"0":{"keyword":"selfcare","dimension":"category","platform":"tiktok"},"length":1}'],
  ]
  const wholeGot = wholes.map(([name, tasks, text]) => [name, problems(tasks), text] as const)
  eq('任务列表校验：tasks 缺席、不是数组或是空数组时报出一句，写着 tasks 与读到的值（缺席写明缺席）',
    missList(wholeGot, (got, row) => got.some(s => s.includes('tasks') && writes(s, row[2] as string))), [])
  // 「不点名任何一个任务」要求确实报了话：交回空数组时「一句都没点名」是空洞地成立
  eq('任务列表校验：tasks 本身不合规时报出的话不点名任何一个任务',
    missList(wholeGot, got => got.length > 0 && !got.some(namesSome)), [])
  eq('任务列表校验：tasks 本身不合规时只交回一句（签名说明）',
    missList(wholeGot, got => got.length === 1), [])
  // 「写着读到的值」只查子串的话，规则描述就能满足它 —— 「不能是空数组 []」「不能是 null」照抄进句子，读到的值那一格空着，
  // 那几行照样绿。照 D16.b 的办法：拿读到 7 的那一句当底（7 那一行自己拿读到 "selfcare" 的那一句当底），
  // 这一行的值的写法在自己那一句里出现得比底那一句多，多出来的只能是读到的值那一格。
  // 前提同下面「缺席与读到 null」那一组：同一处的句子只随读到的值变。缺席那一行由那一组比
  const wholeSentence = (got: string[] | string) => (Array.isArray(got) ? got.find(s => s.includes('tasks')) : undefined)
  const wholeBase = (text: string) => wholeSentence(wholeGot.find(r => r[2] === (text === '7' ? '"selfcare"' : '7'))![1])
  eq('任务列表校验：tasks 本身不合规时，读到的值那一格随读到的值变，不是规则描述里本来就有的字',
    missList(wholeGot.filter(r => r[2] !== '缺席'), (got, row) => {
      const s = wholeSentence(got), base = wholeBase(row[2] as string)
      return s !== undefined && base !== undefined && occurrences(s, row[2] as string) > occurrences(base, row[2] as string)
    }), [])
  criterion('D16.a')

  // ── D16.b：某一项不是对象 —— 写明第几个任务（从 1 数，同任务标签）与这一项读到的值 ──
  // 坏的一律放在第 2 个，前面垫一个合规任务：按 0 数的写法会写成「任务 1」
  const items: [string, unknown, string][] = [
    ['null', null, 'null'],
    ['空数组', [], '[]'],
    ['数组', ['selfcare', 'scene', 'tiktok'], '["selfcare","scene","tiktok"]'],
    // typeof 是 object、三个字段也读得到 —— 可它是数组，不是任务对象
    ['挂着三个字段的数组', Object.assign([], tt('selfcare')), '[]'],
    ['字符串', 'selfcare', '"selfcare"'],
    ['空串', '', '""'],
    ['数字', 7, '7'],
    ['数字 0', 0, '0'],
    ['true', true, 'true'],
    ['false', false, 'false'],
  ]
  const itemGot = items.map(([name, item, text]) => [name, problems([tt('plainword'), item]), text] as const)
  // 写的是这一项，不是整份列表（dumpsWhole：整份列表里有第 1 个任务的 "keyword": 与 plainword）
  eq('任务列表校验：不是对象的一项被点名是第几个任务（从 1 数），并写出这一项读到的值',
    missList(itemGot, (got, row) =>
      got.some(s => names(s, 2) && s.includes(row[2] as string) && !dumpsWhole(s)) && !got.some(s => names(s, 1))), [])
  // 「写着读到的值」只查子串的话，规则描述就能满足它 —— 签名说明「不是对象（null、数组、字符串、数字、布尔）」照抄进句子，
  // null 那一行不看读到的值也绿。拿同一处（第 2 个任务不是对象）读到别的值的那一句当底：这一行的值的写法在自己那一句里
  // 出现得比底那一句多，多出来的只能是读到的值那一格。底取读到 "selfcare" 的那一句，它不含别的行的写法；
  // "selfcare" 那一行自己拿读到 7 的那一句当底。前提同下面「缺席与读到 null」那一组：同一处的句子只随读到的值变。
  // 列表里的项在就是在，不会缺席：点名它的那一句不写缺席 —— 把读到的 null 当缺席写，是把 P1 要分开的两个值压平了
  const itemSentence = (got: string[] | string, n: number) => (Array.isArray(got) ? got.find(s => names(s, n)) : undefined)
  const itemBase = (text: string) => itemSentence(itemGot.find(r => r[2] === (text === '"selfcare"' ? '7' : '"selfcare"'))![1], 2)
  eq('任务列表校验：不是对象的一项，读到的值那一格随这一项变：不是规则描述里本来就有的字，也不写成缺席',
    missList(itemGot, (got, row) => {
      const s = itemSentence(got, 2), base = itemBase(row[2] as string)
      return s !== undefined && base !== undefined && !s.includes('缺席')
        && occurrences(s, row[2] as string) > occurrences(base, row[2] as string)
    }), [])
  // undefined 在 task.json 里写不出来，这里只要它同样被当成不是对象的一项点名（读到的值怎么写不强求）
  const undefinedItem = problems([tt('plainword'), undefined])
  ok('任务列表校验：值为 undefined 的一项也按不是对象点名',
    Array.isArray(undefinedItem) && undefinedItem.some(s => names(s, 2)) && !undefinedItem.some(s => names(s, 1)))
  eq('任务列表校验：不是对象的一项恰好一句（签名说明：这一项一句）',
    missList(itemGot, got => got.length === 1 && names(got[0], 2)), [])
  // 同一个原始值在列表里出现两次（JSON.parse 本来就会产出这种形状）：按「这个值第一次出现在哪」算序号的写法，
  // 会把第 4 个报成第 2 个、第 6 个报成第 5 个，后出现的那个从来不被点名。每个位置各算各的
  const dupItems = problems([tt('plainword'), null, tt('beta'), null, 7, 7])
  eq('任务列表校验：同一个值的不是对象的项出现几次，就按各自的位置点名几次',
    [Array.isArray(dupItems) ? dupItems.length : dupItems, [1, 2, 3, 4, 5, 6].map(n => namedCount(dupItems, n)),
      [4, 6].map(n => itemSentence(dupItems, n)?.includes(n === 4 ? 'null' : '7'))],
    [4, [0, 1, 0, 1, 1, 1], [true, true]])
  criterion('D16.b')

  // ── D16.c–e：一个字段不合规 —— 点名那个任务与字段名，并写出读到的值（缺席写明缺席）──
  // 坏的一律是第 2 个任务，第 1 个合规
  const fieldGot = (field: string, base: Record<string, unknown>, cases: [string, unknown, string][]) =>
    cases.map(([name, v, text]) => {
      const task = v === ABSENT ? without(base, field) : { ...base, [field]: v }
      return [`${field} ${name}`, problems([tt('plainword'), task]), text, field] as const
    })
  const fieldMiss = (rows: ReturnType<typeof fieldGot>) =>
    missList(rows, (got, row) => pointsAt(got, 2, row[3] as string, row[2] as string) && !got.some(s => names(s, 1)))

  // D16.c：是字符串、去掉首尾空白后仍有内容（textProblem 的口径）
  const keywordRows = fieldGot('keyword', ig('selfcare'), [
    ['缺席', ABSENT, '缺席'],
    ['null', null, 'null'],
    ['数字', 7, '7'],
    ['数字 0', 0, '0'],
    ['true', true, 'true'],
    ['false', false, 'false'],
    // String() 一下就成了 "selfcare"
    ['数组', ['selfcare'], '["selfcare"]'],
    ['对象', { text: 'selfcare' }, '{"text":"selfcare"}'],
    ['空串', '', '""'],
    ['一个空格', ' ', '" "'],
    ['几个空格', '   ', '"   "'],
    ['制表符', '\t', '"\\t"'],
    ['换行', '\n', '"\\n"'],
    ['回车换行夹空格', ' \r\n ', '" \\r\\n "'],
    ['全角空格', '　', '"　"'],
    ['全角空格夹半角空格', '　 　', '"　 　"'],
    ['不换行空格', ' ', '" "'],
  ])
  eq('任务列表校验：keyword 缺席、不是字符串、空串或只含空白时，点名那个任务与 keyword，并写出读到的值（缺席写明缺席）',
    fieldMiss(keywordRows), [])
  eq('任务列表校验：首尾带空白但有内容的关键词合规',
    [problems([tt(' selfcare')]), problems([ig('selfcare\n')]), problems([tt('\tself care ')]),
      problems([ig('　护肤　')]), problems([tt(' #selfcare ')])],
    [[], [], [], [], []])
  criterion('D16.c')

  // D16.d：只认 category、scene、competitor、audience，按原值比较、区分大小写、不修剪空白
  const dimensionRows = fieldGot('dimension', ig('selfcare'), [
    ['缺席', ABSENT, '缺席'],
    ['null', null, 'null'],
    ['数字', 7, '7'],
    ['true', true, 'true'],
    // String() 一下就成了 "scene"
    ['数组', ['scene'], '["scene"]'],
    ['空对象', {}, '{}'],
    ['空串', '', '""'],
    ['一个空格', ' ', '" "'],
    ['首字母大写', 'Scene', '"Scene"'],
    ['全大写', 'CATEGORY', '"CATEGORY"'],
    ['开头空格', ' scene', '" scene"'],
    ['末尾空格', 'category ', '"category "'],
    ['末尾换行', 'competitor\n', '"competitor\\n"'],
    ['开头全角空格', '　audience', '"　audience"'],
    // 只认整值：截短的、多一截的、拼在一起的都不算
    ['截短', 'scen', '"scen"'],
    ['复数', 'categories', '"categories"'],
    // 去掉末尾 s 再比的写法会放行这三个（categories 去掉 s 是 categorie，挡不住这一类）
    ['复数 scenes', 'scenes', '"scenes"'],
    ['复数 competitors', 'competitors', '"competitors"'],
    ['复数 audiences', 'audiences', '"audiences"'],
    ['两个维度拼在一起', 'category,scene', '"category,scene"'],
    ['中文名', '品类词', '"品类词"'],
    ['平台名', 'tiktok', '"tiktok"'],
    // 原型链上的键名：拿对象当查找表的写法会放行它们
    ['toString', 'toString', '"toString"'],
    ['constructor', 'constructor', '"constructor"'],
    ['__proto__', '__proto__', '"__proto__"'],
    ['hasOwnProperty', 'hasOwnProperty', '"hasOwnProperty"'],
    ['valueOf', 'valueOf', '"valueOf"'],
    // 写着「缺席」两个字的字符串是读到了值，不是缺席
    ['字符串「缺席」', '缺席', '"缺席"'],
  ])
  eq('任务列表校验：dimension 缺席或不是四个维度之一（区分大小写、不修剪空白）时，点名那个任务与 dimension，并写出读到的值（缺席写明缺席）',
    fieldMiss(dimensionRows), [])
  criterion('D16.d')

  // D16.e：只认 tiktok、instagram，按原值比较、区分大小写、不修剪空白；缺席不当作任何一个平台
  const platformRows = fieldGot('platform', tt('selfcare'), [
    ['缺席', ABSENT, '缺席'],
    ['null', null, 'null'],
    ['数字', 7, '7'],
    ['false', false, 'false'],
    ['数组', ['tiktok'], '["tiktok"]'],
    ['空对象', {}, '{}'],
    ['空串', '', '""'],
    ['一个空格', ' ', '" "'],
    ['TikTok', 'TikTok', '"TikTok"'],
    ['Instagram', 'Instagram', '"Instagram"'],
    ['全大写', 'INSTAGRAM', '"INSTAGRAM"'],
    ['开头空格', ' tiktok', '" tiktok"'],
    ['末尾空格', 'instagram ', '"instagram "'],
    ['末尾换行', 'tiktok\n', '"tiktok\\n"'],
    ['开头全角空格', '　instagram', '"　instagram"'],
    ['截短', 'tik', '"tik"'],
    // 去掉末尾 s 再比的写法会放行它们
    ['复数 tiktoks', 'tiktoks', '"tiktoks"'],
    ['复数 instagrams', 'instagrams', '"instagrams"'],
    ['两个平台拼在一起', 'tiktok,instagram', '"tiktok,instagram"'],
    ['简称', 'ig', '"ig"'],
    // S4：只做出海平台
    ['抖音', 'douyin', '"douyin"'],
    ['小红书', 'xiaohongshu', '"xiaohongshu"'],
    ['别的平台', 'youtube', '"youtube"'],
    ['维度名', 'scene', '"scene"'],
    ['toString', 'toString', '"toString"'],
    ['constructor', 'constructor', '"constructor"'],
    ['__proto__', '__proto__', '"__proto__"'],
    ['hasOwnProperty', 'hasOwnProperty', '"hasOwnProperty"'],
    ['valueOf', 'valueOf', '"valueOf"'],
    ['字符串「缺席」', '缺席', '"缺席"'],
  ])
  eq('任务列表校验：platform 缺席或不是 tiktok、instagram（区分大小写、不修剪空白）时，点名那个任务与 platform，并写出读到的值（缺席写明缺席）',
    fieldMiss(platformRows), [])
  eq('任务列表校验：一个任务只坏一个字段时恰好一句（签名说明：每个不合规的字段各一句）',
    missList([...keywordRows, ...dimensionRows, ...platformRows], got => got.length === 1 && names(got[0], 2)), [])
  criterion('D16.e')

  // ── 缺席与读到了值分得出（D16.a、D16.c–e 的「缺席写明缺席」；P1：没有与读到了某个值是两个可区分的值）──
  // 同一个位置调用四次：缺席（A）、读到 null（N）、读到字符串 "缺席"（S）、读到 7（Z，下面比 null 用）。不比措辞，只比交回的：
  // - A 那一句不带引号写缺席（上面的 writes）；A 与 S 交回的不同 —— 展示时拿 "缺席" 顶替缺席的写法，两句一字不差；
  // - A 与 N 交回的不同，且 A 那一句里「缺席」比 N 那一句多 —— 规则描述里本来就有「缺席」两个字的话，两句一样多，
  //   只有读到的值那一格写了缺席，A 才多出一次。前提：同一处的句子只随读到的值变（签名说明：每一句是「哪一处」加「读到的值」）
  // keyword 读到 "缺席" 是合规的关键词，S 交回空数组，那一行「与 S 不同」是空洞地成立 —— 靠 A 不带引号撑着
  /** [哪一处, 按取值造出整份任务列表（ABSENT = 缺席）, 认出说这一处的那一句] */
  type AbsentRow = [string, (v: unknown) => unknown, (s: string) => boolean]
  // 字段那几行：坏的是第 2 个任务，第 1 个合规
  const fieldAbsent = (field: string, base: Record<string, unknown>): AbsentRow => [field,
    v => [tt('plainword'), v === ABSENT ? without(base, field) : { ...base, [field]: v }],
    s => names(s, 2) && s.includes(field)]
  const absentRows = ([
    ['tasks', v => (v === ABSENT ? undefined : v), s => s.includes('tasks')],
    fieldAbsent('keyword', ig('selfcare')),
    fieldAbsent('dimension', ig('selfcare')),
    fieldAbsent('platform', tt('selfcare')),
  ] as AbsentRow[]).map(([name, make, mine]) => {
    const A = problems(make(ABSENT)), N = problems(make(null)), S = problems(make('缺席')), Z = problems(make(7))
    const pick = (got: string[] | string) => (Array.isArray(got) ? got.find(mine) : undefined)
    return { name, A, N, S, Z, a: pick(A), n: pick(N), z: pick(Z) }
  })
  const absentMiss = (pass: (r: typeof absentRows[number]) => boolean) =>
    absentRows.filter(r => !pass(r)).map(r => `${r.name} → 缺席 ${JSON.stringify(r.A)}；null ${JSON.stringify(r.N)}；"缺席" ${JSON.stringify(r.S)}`)
  eq('任务列表校验：缺席与读到字符串「缺席」分得出，缺席那一句不带引号写缺席，两次交回的不一样',
    absentMiss(r => r.a !== undefined && writes(r.a, '缺席') && JSON.stringify(r.A) !== JSON.stringify(r.S)), [])
  eq('任务列表校验：缺席与读到 null 分得出，缺席那一句不写 undefined，读到的值那一格写着缺席',
    absentMiss(r => r.a !== undefined && r.n !== undefined && !r.a.includes('undefined')
      && JSON.stringify(r.A) !== JSON.stringify(r.N) && occurrences(r.a, '缺席') > occurrences(r.n, '缺席')), [])
  // 读到 null 那一格同样可能被规则描述满足：「不能是 null」照抄进句子、读到的值那一格空着，上面的子串判定照样绿。
  // 同一处读到 7 的那一句（Z）当底：null 在 N 那一句里比在 Z 那一句里多，多出来的只能是读到的值那一格
  eq('任务列表校验：读到 null 那一句里的 null 比读到 7 那一句多，读到的值那一格写着 null',
    absentRows.filter(r => !(r.n !== undefined && r.z !== undefined && occurrences(r.n, 'null') > occurrences(r.z, 'null')))
      .map(r => `${r.name} → null ${JSON.stringify(r.N)}；7 ${JSON.stringify(r.Z)}`), [])
  // 「点名了哪个字段」只查字段名在不在句子里的话，一段把三个字段名都写进去的规则描述就能满足它 ——
  // 每个坏字段各出一句、句句写着「必填字段（keyword、dimension、platform）有一处不合规」，用户分不出坏的是哪个字段。
  // 拿第 2 个任务上三个字段各自读到 null 的那三句（上面的 N）两两比：字段 f 在自己那一句里出现得比在别的字段那一句里多。
  // 三句读到的值一样，差出来的只能是点名的那个字段；规则描述里把三个字段名各列一次的，照样是自己那一句多一次
  const FIELDS = ['keyword', 'dimension', 'platform']
  const nullSentence = (field: string) => absentRows.find(r => r.name === field)?.n
  eq('任务列表校验：点名字段的那一句说的就是这个字段，字段名在自己那一句里比在别的字段那一句里出现得多',
    FIELDS.flatMap(f => FIELDS.filter(g => g !== f).filter(g => {
      const sf = nullSentence(f), sg = nullSentence(g)
      return !(sf !== undefined && sg !== undefined && occurrences(sf, f) > occurrences(sg, f))
    }).map(g => `${f} 对 ${g}：${JSON.stringify(nullSentence(f))}／${JSON.stringify(nullSentence(g))}`)), [])
  criterion('D16.a', 'D16.c', 'D16.d', 'D16.e', 'D16.g')

  // ── D16.f、D16.h：好坏相间、跨过两位数 ──
  // 关键词不带数字、取值不用数字，免得句子里的数被误认成序号
  const shared = ig('beta')
  const mixed: unknown[] = [
    tt('alpha', { dimension: 'Category' }),   // 1 坏：dimension（按 0 数会写成「任务 0」）
    null,                                     // 2 坏：不是对象
    shared,                                   // 3
    tt('gamma'),                              // 4
    {},                                       // 5 坏：三个字段都缺席
    shared,                                   // 6 与第 3 个是同一个对象
    ig('delta', { as_hashtag: true }),        // 7
    tt('gamma'),                              // 8 与第 4 个配置完全相同
    tt(' epsilon '),                          // 9
    ig('zeta', { dimension: 'audience' }),    // 10
    ig('eta', { platform: 'Instagram' }),     // 11 坏：platform
    ig('   '),                                // 12 坏：keyword
    tt('theta', { dimension: 'competitor' }), // 13
    tt('alpha', { dimension: 'Category' }),   // 14 坏：与第 1 个配置完全相同，各报各的
  ]
  const mixedGot = problems(mixed)
  const isNamed = (n: number) => { const c = namedCount(mixedGot, n); return typeof c === 'number' ? c > 0 : c }
  eq('任务列表校验：列表里每个不合规的任务都被点名，不止第一个',
    [1, 2, 5, 11, 12, 14].map(isNamed), [true, true, true, true, true, true])
  criterion('D16.f')
  eq('任务列表校验：好坏相间时只点名不合规的那些，合规的（包括与别的任务完全相同的）一个都不点名',
    mixed.map((_, i) => isNamed(i + 1)),
    [true, true, false, false, true, false, false, false, false, false, true, true, false, true])
  // 句数：不是对象的一项一句，对象每个不合规的字段一句 —— 1 + 1 + 3 + 1 + 1 + 1 = 8
  eq('任务列表校验：好坏相间时的句数按签名说明，一句不多',
    [Array.isArray(mixedGot) ? mixedGot.length : mixedGot, mixed.map((_, i) => namedCount(mixedGot, i + 1))],
    [8, [1, 1, 0, 0, 3, 0, 0, 0, 0, 0, 1, 1, 0, 1]])

  // 长列表：三十几个任务、大多数不合规，坏的一直排到两位数的序号上，句数远过十句 ——
  // 报到第几句、第几个任务就截断的写法（「只报前十处」「再有就写『另有几处』」）在上面那份十四个任务、八句的列表上照样全绿，
  // 在这里红。不是对象的项在两位数序号上与前面的同值重复（第 21 个同第 8 个、第 30 个同第 12 个），
  // 同一个坏对象的引用出现两次（第 16、33 个），三个字段全坏的任务也落在两位数上；合规的夹在中间，包括与别的配置完全相同的。
  // 每一行的句数照签名说明手算，写在行里：不是对象的项一句；对象按 keyword、dimension、platform 里不合规的个数
  const badSame = ig('omega', { platform: 'Instagram' })
  const longSpec: [unknown, number][] = [
    [tt('alpha'), 0],                                                     // 1
    [ig('beta', { platform: 'TikTok' }), 1],                              // 2 platform
    [ig('gamma'), 0],                                                     // 3
    [tt(''), 1],                                                          // 4 keyword
    [without(ig('delta'), 'dimension'), 1],                               // 5 dimension 缺席
    [tt('epsilon', { dimension: 'audience' }), 0],                        // 6
    [{}, 3],                                                              // 7 三个字段缺席
    [7, 1],                                                               // 8 不是对象
    [ig('zeta', { dimension: 'competitor' }), 0],                         // 9
    [{ keyword: null, dimension: 'Audience', platform: 'Instagram' }, 3], // 10 三个字段
    [without(tt('eta'), 'platform'), 1],                                  // 11 platform 缺席
    [null, 1],                                                            // 12 不是对象
    [tt('theta', { dimension: 'toString' }), 1],                          // 13 dimension
    [tt('alpha'), 0],                                                     // 14 与第 1 个配置完全相同
    [{ keyword: ' ', dimension: 'SCENE', platform: 'douyin' }, 3],        // 15 三个字段
    [badSame, 1],                                                         // 16 platform
    [ig('　'), 1],                                                        // 17 keyword 全角空格
    [ig('iota', { ig_route: 'hashtag' }), 0],                             // 18
    [[], 1],                                                              // 19 不是对象
    [tt('kappa', { dimension: ' scene' }), 1],                            // 20 dimension
    [7, 1],                                                               // 21 不是对象，与第 8 个同值
    [{ dimension: 'category', platform: 'ig' }, 2],                       // 22 keyword 缺席、platform
    [ig('lambda'), 0],                                                    // 23
    [{}, 3],                                                              // 24 三个字段缺席，与第 7 个配置完全相同
    [without(ig('mu'), 'dimension'), 1],                                  // 25 dimension 缺席
    [tt('nu', { platform: '__proto__' }), 1],                             // 26 platform
    [ig('xi', { keyword: false }), 1],                                    // 27 keyword
    [tt('omicron', { as_hashtag: true }), 0],                             // 28
    [without(tt('pi'), 'dimension', 'platform'), 2],                      // 29 dimension、platform 缺席
    [null, 1],                                                            // 30 不是对象，与第 12 个同值
    [tt('\t'), 1],                                                        // 31 keyword
    ['task', 1],                                                          // 32 不是对象
    [badSame, 1],                                                         // 33 platform，与第 16 个是同一个对象
    [tt('rho'), 0],                                                       // 34
  ]
  const longGot = problems(longSpec.map(([task]) => task))
  // 句数：25 个坏任务 —— 三处全坏的 4 个（第 7、10、15、24 个）、两处的 2 个（第 22、29 个）、其余 19 个一处：
  // 19×1 + 2×2 + 4×3 = 35
  eq('任务列表校验：三十几个任务的长列表里，每个不合规的任务都按各自的位置被点名，句数一句不少一句不多',
    [Array.isArray(longGot) ? longGot.length : longGot, longSpec.map((_, i) => namedCount(longGot, i + 1))],
    [35, longSpec.map(([, count]) => count)])
  // 截断的另一种写法是后面的只点名、不写细节：两位数序号上的每一处照样写字段名与读到的值
  const longFields: [number, string, string][] = [
    [10, 'keyword', 'null'], [10, 'dimension', '"Audience"'], [10, 'platform', '"Instagram"'],
    [15, 'platform', '"douyin"'], [22, 'keyword', '缺席'], [22, 'platform', '"ig"'],
    [24, 'keyword', '缺席'], [24, 'dimension', '缺席'], [24, 'platform', '缺席'],
    [29, 'dimension', '缺席'], [29, 'platform', '缺席'], [31, 'keyword', '"\\t"'], [33, 'platform', '"Instagram"'],
  ]
  const longItems: [number, string][] = [[12, 'null'], [19, '[]'], [21, '7'], [30, 'null'], [32, '"task"']]
  eq('任务列表校验：长列表里两位数序号上的每一处也写着字段名或这一项读到的值',
    [...longFields.filter(([n, field, text]) => !pointsAt(longGot, n, field, text)).map(([n, field]) => `任务 ${n} ${field}`),
      ...longItems.filter(([n, text]) => {
        const s = itemSentence(longGot, n)
        return !(s !== undefined && s.includes(text) && !dumpsWhole(s) && !s.includes('缺席'))
      }).map(([n]) => `任务 ${n}`)],
    [])
  criterion('D16.f', 'D16.g', 'D16.h')

  // 合规一侧：一句都不报
  const same = ig('selfcare')
  const fine: [string, unknown][] = [
    ['一个任务', [tt('selfcare')]],
    ['四个维度乘两个平台', ['category', 'scene', 'competitor', 'audience'].flatMap(dimension =>
      ['tiktok', 'instagram'].map(platform => ({ keyword: 'selfcare', dimension, platform })))],
    ['同一个任务对象出现三次', [same, same, same]],
    ['配置完全相同的两个任务', [tt('selfcare'), tt('selfcare')]],
    ['关键词的各种写法', [tt('#'), ig('##selfcare'), tt('self care'), ig('护肤'), tt('a'), tt('0'),
      tt('toString'), ig('__proto__'), tt('constructor'), ig('缺席')]],
    ['关键词首尾带空白', [tt(' selfcare'), ig('selfcare\n'), tt('　护肤　')]],
    ['带着别的字段', [ig('selfcare', { as_hashtag: true }),
      tt('selfcare', { as_hashtag: false, note: null, Platform: 'Douyin', Dimension: '品类词' })]],
    ['十五个合规任务', Array.from({ length: 15 }, (_, i) => i % 2 ? tt('selfcare') : ig('selfcare'))],
  ]
  eq('任务列表校验：合规的任务列表交回空数组，与别的任务配置完全相同的任务也合规',
    fine.map(([name, tasks]) => [name, problems(tasks)] as const).filter(([, got]) => JSON.stringify(got) !== '[]')
      .map(([name, got]) => `${name} → ${JSON.stringify(got)}`), [])
  // ig_route 由路线校验判（D15.j），别的字段不在这里判（签名说明）：三个必填字段都合规，就一句不报
  eq('任务列表校验：三个必填字段合规时，ig_route 与别的字段怎么写都不在这里报',
    problems([tt('selfcare', { ig_route: 'hashtag' }), ig('#self care', { ig_route: 'hashtag' }),
      ig('selfcare', { ig_route: 'reels' }), ig('#', { ig_route: 'hashtag' }), tt('selfcare', { as_hashtag: 'yes' })]), [])
  criterion('D16.h')

  // ── D16.g：同一个任务几个字段不合规，就指出几个 ──
  const multi: [string, Record<string, unknown>, [string, string][]][] = [
    ['三个字段都缺席', {}, [['keyword', '缺席'], ['dimension', '缺席'], ['platform', '缺席']]],
    ['三个字段都读到了不合规的值', { keyword: '  ', dimension: 'Scene', platform: 'TikTok' },
      [['keyword', '"  "'], ['dimension', '"Scene"'], ['platform', '"TikTok"']]],
    ['keyword 与 platform 不合规', { keyword: 7, dimension: 'scene', platform: null },
      [['keyword', '7'], ['platform', 'null']]],
    ['dimension 与 platform 是原型链上的键名', { keyword: 'selfcare', dimension: 'toString', platform: 'constructor' },
      [['dimension', '"toString"'], ['platform', '"constructor"']]],
    ['keyword 缺席、dimension 大小写不对', { dimension: 'SCENE', platform: 'instagram', ig_route: 'hashtag' },
      [['keyword', '缺席'], ['dimension', '"SCENE"']]],
  ]
  const multiGot = multi.map(([name, task, want]) => [name, problems([tt('plainword'), task]), want] as const)
  eq('任务列表校验：同一个任务几个字段不合规就指出几个，每一处写着字段名与读到的值',
    multiGot.flatMap(([name, got, want]) => want.filter(([field, text]) => !pointsAt(got, 2, field, text))
      .map(([field]) => `${name}：${field} → ${JSON.stringify(got)}`)), [])
  // 句句不同：三个字段都缺席时读到的值一样，三句要是一字不差，用户分不出哪一句说的是哪个字段
  eq('任务列表校验：同一个任务几个字段不合规就恰好几句、句句不同，前面合规的任务不被点名（签名说明）',
    multiGot.map(([, got]) => [namedCount(got, 2), namedCount(got, 1),
      Array.isArray(got) ? new Set(got.filter(s => names(s, 2))).size : got]),
    [[3, 0, 3], [3, 0, 3], [2, 0, 2], [2, 0, 2], [2, 0, 2]])
  criterion('D16.g')

  // ── 非空、但每一项都不合规的列表：逐项点名，不当成 tasks 本身不合规 ──
  // 上面的坏夹具前面都垫着一个合规任务；D16.a 那一类只有缺席、不是数组、空数组（ADR-115 第二节：空数组是「一个任务都没有」）。
  // 把「至少一个任务」读成「至少一个对象任务」「至少一个合规任务」的写法，会把这几份整份报成 tasks 本身 —— 那一句不点名任何任务
  // 点名这一项的那一句写的是这一项，不是整份列表（整份列表的写法 [null]、[[]]、[null,7] 不能出现），也不写缺席
  const allBad: [string, string[] | string, (got: string[]) => boolean][] = [
    ['[null]', problems([null]), got => got.length === 1 && names(got[0], 1) && got[0].includes('null')
      && !got[0].includes('[null]') && !got[0].includes('缺席')],
    ['[[]]', problems([[]]), got => got.length === 1 && names(got[0], 1) && got[0].includes('[]')
      && !got[0].includes('[[]]') && !got[0].includes('缺席')],
    // 三句读到的值都是缺席，一字不差的三句分不出各说哪个字段
    ['[{}]', problems([{}]), got => got.length === 3 && got.every(s => names(s, 1)) && new Set(got).size === 3
      && ['keyword', 'dimension', 'platform'].every(field => pointsAt(got, 1, field, '缺席'))],
    ['[关键词只含空白]', problems([tt('   ')]), got => got.length === 1 && pointsAt(got, 1, 'keyword', '"   "')],
    // 第 1 个那一句不写 7、「null」比第 2 个那一句多（规则描述里有 null 的话两句一样多，多出来的是读到的值那一格）
    ['[null, 7]', problems([null, 7]), got => {
      const one = got.filter(s => names(s, 1)), two = got.filter(s => names(s, 2))
      return got.length === 2 && one.length === 1 && two.length === 1
        && one[0].includes('null') && !one[0].includes('7') && two[0].includes('7')
        && !one[0].includes('null,7') && !two[0].includes('null,7')
        && !one[0].includes('缺席') && !two[0].includes('缺席')
        && occurrences(one[0], 'null') > occurrences(two[0], 'null')
    }],
  ]
  eq('任务列表校验：非空但每一项都不合规的列表逐项点名第几个任务与读到的值，不当成 tasks 本身不合规',
    missList(allBad, (got, row) => (row[2] as (g: string[]) => boolean)(got)), [])
  criterion('D16.a', 'D16.b', 'D16.f', 'D16.g')

  // ── P1 交点：缺席不以默认值补齐、不从别的字段推断（ADR-115）──
  const inferred: [string, Record<string, unknown>, string][] = [
    ['缺 platform、写了 ig_route: hashtag', without(ig('selfcare', { ig_route: 'hashtag' }), 'platform'), 'platform'],
    ['缺 platform、写了 as_hashtag', without(ig('#selfcare', { as_hashtag: true }), 'platform'), 'platform'],
    ['缺 dimension', without(tt('selfcare'), 'dimension'), 'dimension'],
    ['缺 dimension、关键词长得像维度名', without(tt('competitor'), 'dimension'), 'dimension'],
    ['缺 keyword', without(ig('selfcare', { ig_route: 'hashtag' }), 'keyword'), 'keyword'],
  ]
  eq('任务列表校验：缺席的字段不补默认值、不从别的字段推断，照样点名那个字段并写明缺席',
    missList(inferred.map(([name, task, field]) => [name, problems([tt('plainword'), task]), field] as const),
      (got, row) => pointsAt(got, 2, row[2] as string, '缺席')), [])
  // 这里只守得住交点裁决的函数这一半：校验本身不补、不推断，缺席照样点名。另一半在入口 ——
  // collect（新建、续跑）与 probe 要是先把任务「规范化」（比如按 ig_route 补上 instagram、补一个默认维度）再交给校验，
  // 这里一句都看不见，而裁决在产品上并不成立。那一半要 D16.j、D16.l 的入口组来验：同样两份夹具（缺 platform 却写了
  // ig_route: hashtag；缺 dimension），断言退出码 2、零请求、stderr 点名那个任务的字段并写明缺席。
  // 这一条 PR 不接入口，认领照写是因为交点里有红线、不认领就是硬失败 —— 缺的那一半写在这里，别当它已经守住了。
  // 这段注释审计读不到：审计只看认领，会把整个交点报成已守住。入口那一半要在决策记录里登记成欠条（两份入口夹具与上面的断言，
  // 重启条件绑 D16.j、D16.l 的入口组），测试文件里登记不了
  tension('D16', 'P1')

  // ── D16.i：校验不改写任务列表 ──
  const tempting = (): unknown[] => [
    tt(' Self Care '),                                                     // 1 不修剪、不改大小写
    ig('selfcare', { dimension: 'Scene' }),                                // 2 不改成小写
    tt('selfcare', { platform: ' tiktok' }),                               // 3 不修剪
    without(ig('selfcare', { ig_route: 'hashtag' }), 'platform'),          // 4 不补成 instagram
    without(tt('selfcare'), 'dimension'),                                  // 5 不补维度
    without(ig('selfcare', { as_hashtag: true, note: 'keep' }), 'keyword'), // 6 不补关键词，别的字段留着
    null,                                                                  // 7 坏项不被删掉
    tt('selfcare'),                                                        // 8
  ]
  const has = (t: unknown, k: string) => t !== null && typeof t === 'object' && k in t
  const read = (t: unknown, k: string) => (t !== null && typeof t === 'object' ? (t as Record<string, unknown>)[k] : t)
  const list = tempting()
  const refs = [...list]
  const listJson = JSON.stringify(list)
  const listGot = problems(list)
  eq('任务列表校验：校验之后关键词、维度、平台与别的字段原样留着，缺席的没被补上',
    [read(list[0], 'keyword'), read(list[1], 'dimension'), read(list[2], 'platform'),
      has(list[3], 'platform'), has(list[4], 'dimension'), has(list[5], 'keyword'),
      read(list[3], 'ig_route'), read(list[5], 'as_hashtag'), read(list[5], 'note')],
    [' Self Care ', 'Scene', ' tiktok', false, false, false, 'hashtag', true, 'keep'])
  eq('任务列表校验：校验之后任务列表还是那些项、那个顺序，一项不少、一项不换',
    [Array.isArray(listGot), list.length, list.every((t, i) => t === refs[i]), JSON.stringify(list) === listJson],
    [true, 8, true, true])
  // 冻住之后任何改写都会抛出（模块是严格模式）：照常交回结果，说明它没想改
  const deepFreeze = (v: unknown): unknown => {
    if (v !== null && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v) }
    return v
  }
  const frozenBad = problems(deepFreeze(tempting()))
  const frozenFine = problems(deepFreeze([tt(' Self Care '), ig('　护肤 ', { ig_route: 'hashtag', as_hashtag: true })]))
  // 「照常」：冻住的与没冻住的同一份交回的一样，并且照 tempting() 旁边的注释点名第 2–7 个、不点名第 1、8 个
  const frozenNamed = tempting().map((_, i) => { const c = namedCount(frozenBad, i + 1); return typeof c === 'number' ? c > 0 : c })
  eq('任务列表校验：冻住的任务列表照常校验，不因为想改它而抛出',
    [JSON.stringify(frozenBad) === JSON.stringify(listGot), frozenNamed, frozenFine],
    [true, [false, true, true, true, true, true, true, false], []])
  eq('任务列表校验：本组每一次调用前后，传入的值连键带值都没变', rewritten, [])
  criterion('D16.i')
}

})
await group('d17-config', () => {
suite('D17', '市场与目标人数按原始字段和输入角色校验')
{
  // 独立上下文先于实现编写；依据 D17.a–g 与公开签名，不读入口或判定实现。
  type Raw = Readonly<{ market?: unknown; target_count?: unknown }>
  type Result = string[] | { threw: string }
  const roles: ConfigInputRole[] = ['new', 'resume', 'probe']
  // JSON.stringify 会吞掉 undefined、混淆 NaN/null，故逐个自有键拍照后用深比较。
  const snapshot = (value: unknown): unknown => value !== null && typeof value === 'object'
    ? [Object.getPrototypeOf(value), Reflect.ownKeys(value).map(key => {
      const d = Object.getOwnPropertyDescriptor(value, key)!
      return [key, d.enumerable, d.configurable, d.writable, snapshot(d.value)]
    })] : value
  const rewritten: string[] = []
  const problems = (raw: Raw, role: ConfigInputRole): Result => {
    const before = snapshot(raw)
    let result: Result
    try { result = configFieldProblems(raw, role) }
    catch (error) { result = { threw: error instanceof Error ? error.message : String(error) } }
    if (!isDeepStrictEqual(snapshot(raw), before)) rewritten.push(role)
    return result
  }
  const one = (got: Result, field: string): got is string[] =>
    Array.isArray(got) && got.length === 1 && typeof got[0] === 'string' && got[0].includes(field)
  const both = (got: Result): boolean => Array.isArray(got) && got.length === 2
    && new Set(got).size === 2 && ['market', 'target_count'].every(f => got.some(s => s.includes(f)))
  const rejected: [string, unknown][] = [
    ['undefined', undefined], ['null', null], ['true', true], ['false', false],
    ['空数组', []], ['数组', ['bad-value']], ['空对象', {}], ['对象', { bad_value: 31 }],
    ['bigint', 71n], ['symbol', Symbol('bad-value')], ['function', () => 71],
  ]
  const badMarkets = [...rejected, ['0', 0], ['数字', 71], ['NaN', NaN], ['Infinity', Infinity],
    ['-Infinity', -Infinity], ['空串', ''], ['空格', ' '], ['tab', '\t'], ['换行', '\r\n'], ['全角空格', '　']] as const
  const marketFailures = roles.flatMap(role => badMarkets.flatMap(([name, value]) => {
    const got = problems({ market: value, target_count: 50 }, role)
    return one(got, 'market') ? [] : [`${role}/${name}`]
  }))
  eq('配置字段校验：三个角色均逐类拒绝非字符串与空白 market，返回字段问题而不抛出', marketFailures, [])
  criterion('D17.a')

  // 1e400 是合法 JSON 数字文本，解析后非有限；不能拿 stringify(Infinity) 生成这个反例。
  const overflow: unknown = JSON.parse('1e400')
  const badCounts = [...rejected, ['空串', ''], ['数字字符串', '50'], ['空白数字字符串', ' 50 '],
    ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity], ['JSON溢出数', overflow]] as const
  eq('配置字段校验：新建与续跑逐类拒绝非数值和非有限 target_count，不转换数字字符串',
    (['new', 'resume'] as const).flatMap(role => badCounts.flatMap(([name, value]) =>
      one(problems({ market: 'US', target_count: value }, role), 'target_count') ? [] : [`${role}/${name}`])), [])
  criterion('D17.b')

  const missing = [
    ['market', { target_count: 50 }], ['target_count', { market: 'US' }],
  ] as const
  eq('配置字段校验：续跑分别缺市场或人数时，逐个报告缺席字段',
    missing.filter(([field, raw]) => !one(problems(raw, 'resume'), field)).map(([field]) => field), [])
  ok('配置字段校验：续跑两个字段都缺席时返回两处不同的问题', both(problems({}, 'resume')))
  const inherited: Raw = Object.create({ market: 'US', target_count: 50 })
  eq('配置字段校验：原型上的合规字段不算自有字段，续跑仍报两处缺席', both(problems(inherited, 'resume')), true)
  const inheritedBad: Raw = Object.create({ market: null, target_count: '50' })
  eq('配置字段校验：原型上的坏字段也算缺席，新建与 probe 不报错',
    [problems(inheritedBad, 'new'), problems(inheritedBad, 'probe')], [[], []])
  criterion('D17.c')

  // 只要求字段与原值可辨识，不锁整句措辞、诊断顺序或内部的序列化办法。
  const rawValues: [string, unknown, string[]][] = [
    ['null', null, ['null']], ['undefined', undefined, ['undefined']],
    ['true', true, ['true']], ['false', false, ['false']],
    ['数组', ['unique-invalid-item'], ['unique-invalid-item']],
    ['对象', { unique_invalid_key: 391 }, ['unique_invalid_key', '391']],
  ]
  eq('配置字段校验：每个字段问题都带出实际坏值，不能只重复规则',
    (['market', 'target_count'] as const).flatMap(field => rawValues.flatMap(([name, value, tokens]) => {
      const got = problems({ market: 'US', target_count: 50, [field]: value }, 'new')
      return one(got, field) && tokens.every(token => got[0].includes(token)) ? [] : [`${field}/${name}`]
    })), [])
  eq('配置字段校验：错误人数带出原始数字字符串，错误市场带出原始数值',
    [['target_count', '0050.00'], ['market', 731]].flatMap(([field, value]) => {
      const got = problems({ market: 'US', target_count: 50, [field as string]: value }, 'new')
      return one(got, String(field)) && got[0].includes(String(value)) ? [] : [field]
    }), [])
  const states = [
    { market: 'US' }, { market: 'US', target_count: undefined }, { market: 'US', target_count: null },
    { market: 'US', target_count: '缺席' }, { market: 'US', target_count: NaN },
    { market: 'US', target_count: Infinity }, { market: 'US', target_count: -Infinity },
  ].map(raw => problems(raw, 'resume'))
  eq('配置字段校验：人数缺席、undefined、null、字符串缺席及三种非有限数逐一可区分',
    [states.every(got => one(got, 'target_count')), new Set(states.map(got => JSON.stringify(got))).size], [true, 7])
  const marketStates = [{ target_count: 50 }, { market: undefined, target_count: 50 }, { market: null, target_count: 50 }]
    .map(raw => problems(raw, 'resume'))
  eq('配置字段校验：市场缺席、undefined 与 null 逐一可区分',
    [marketStates.every(got => one(got, 'market')), new Set(marketStates.map(got => JSON.stringify(got))).size], [true, 3])
  const blankMessages = ['', ' ', '\t', '\n', '　'].map(market => problems({ market, target_count: 50 }, 'new'))
  eq('配置字段校验：市场空串与不同空白原值的诊断可区分，不把原值先修剪掉',
    new Set(blankMessages.map(got => JSON.stringify(got))).size, 5)
  const dualBad = problems({ market: 731, target_count: 'invalid-count-83' }, 'new')
  ok('配置字段校验：同一输入两处坏值全部返回，各自指向字段和自己的原值',
    both(dualBad) && Array.isArray(dualBad)
      && dualBad.some(s => s.includes('market') && s.includes('731'))
      && dualBad.some(s => s.includes('target_count') && s.includes('invalid-count-83')))
  // 坏容器中的原值也不能被 JSON 序列化抹平；溢出数仍从原始 JSON 文本生成。
  const nestedCases: [Raw, string, string][] = [
    [JSON.parse('{"market":[1e400],"target_count":{"n":-1e400}}'), 'Infinity', '-Infinity'],
    [{ market: ['Infinity'], target_count: { n: '-Infinity' } }, 'Infinity', '-Infinity'],
    [{ market: [null], target_count: { n: null } }, 'null', 'null'],
  ]
  const nestedResults = nestedCases.map(([raw]) => problems(raw, 'new'))
  eq('配置字段校验：嵌套非有限数、同名字符串与 null 全部报告，且写出各字段的容器与原值',
    nestedResults.map((got, i) => both(got) && Array.isArray(got)
      && got.some(s => s.includes('market') && s.includes('[') && s.includes(']') && s.includes(nestedCases[i][1]))
      && got.some(s => s.includes('target_count') && s.includes('{') && s.includes('}') && /\bn\b/.test(s)
        && s.includes(nestedCases[i][2]))), [true, true, true])
  eq('配置字段校验：同一字段嵌套的非有限数、同名字符串与真 null 三种诊断互不相同',
    ['market', 'target_count'].map(field => new Set(nestedResults.map(got =>
      Array.isArray(got) ? got.find(s => s.includes(field)) : undefined)).size), [3, 3])
  eq('配置字段校验：数组与对象中嵌套 BigInt 仍返回全部字段问题，不因诊断序列化而抛出',
    (['new', 'resume'] as const).flatMap(role => [
      both(problems({ market: [71n], target_count: { n: 83n } }, role)),
      both(problems({ market: { n: 71n }, target_count: [83n] }, role)),
    ]), [true, true, true, true])
  criterion('D17.d')

  // D17 没有限制国家编码、整数、正数或最大人数；正例故意跨这些常见误加边界。
  const markets = ['US', 'uS', ' zz-not-a-country ', '　全球🌍 ', '缺席', 'undefined']
  const counts = [0, -0, -7, 0.25, -2.75, Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE]
  eq('配置字段校验：非标准市场与所有有限人数边界在三个角色均合规，保留原始大小写和空白',
    roles.flatMap(role => markets.flatMap(market => counts.flatMap(target_count => {
      const got = problems({ market, target_count }, role)
      return Array.isArray(got) && got.length === 0 ? [] : [`${role}/${market}/${target_count}`]
    }))), [])
  const extra = { nested: [undefined, null, NaN, Infinity, -0, { untouched: ' 留下 ' }] }
  Object.freeze(extra.nested[5]); Object.freeze(extra.nested); Object.freeze(extra)
  const frozenGood = Object.freeze({ market: ' uS ', target_count: -0.25, extra })
  const frozenBad = Object.freeze({ market: null, target_count: '50', extra })
  eq('配置字段校验：深冻结的合法对象照常通过，额外字段原样不动',
    roles.map(role => problems(frozenGood, role)), [[], [], []])
  eq('配置字段校验：深冻结的坏对象照常返回全部问题，不因尝试改写而抛出',
    [both(problems(frozenBad, 'new')), both(problems(frozenBad, 'resume')), one(problems(frozenBad, 'probe'), 'market')],
    [true, true, true])

  eq('配置字段校验：probe 忽略任何 target_count，包括每种坏类型与非有限数',
    badCounts.flatMap(([name, target_count]) => {
      const good = problems({ market: 'US', target_count }, 'probe')
      const bad = problems({ market: null, target_count }, 'probe')
      return Array.isArray(good) && good.length === 0 && one(bad, 'market') ? [] : [name]
    }), [])
  criterion('D17.f')
  eq('配置字段校验：新建与 probe 允许缺市场，新建也允许缺人数，判定不填缺省',
    [problems({}, 'new'), problems({}, 'probe'), problems({ target_count: 0 }, 'new'),
      problems({ target_count: 'unused' }, 'probe'), problems({ market: 'US' }, 'new')], [[], [], [], [], []])
  eq('配置字段校验：允许缺席不等于允许自有 undefined，新建与 probe 仍报告使用字段的问题',
    [both(problems({ market: undefined, target_count: undefined }, 'new')),
      one(problems({ market: undefined, target_count: undefined }, 'probe'), 'market')], [true, true])
  criterion('D17.g')
  eq('配置字段校验：本组每次调用前后，自有键、属性、原值及其他字段全部不变', rewritten, [])
  criterion('D17.e')
  // 本次只认领判定函数不补值：续跑缺席和显式非法仍报错，新输入缺席通过但不写默认值。
  // 入口是否先补值再调用不在本组证据范围，入口接线与对应反例另行实现。
  tension('D17', 'P1')
}

})
await group('d19-resume', () => {
suite('D19', '续跑进度字段先验校验')
{
  const fromToken = (field: 'done' | 'pages', token: string): string[] => {
    const source = field === 'done'
      ? `{"done":[${token}],"pages":{"0":0}}`
      : `{"done":[0],"pages":{"0":${token}}}`
    const parsed = readCostDocument<{ done: unknown; pages: unknown }>(source)
    return resumeProgressProblems(parsed, 2, (holder, key) => sourceNumberToken(parsed, holder, key))
  }
  eq('恢复进度：原始 JSON 小数和指数只有精确等于整数时通过',
    ['1.0', '1e0', '1e+0', '1.00e0'].map(token =>
      [fromToken('done', token), fromToken('pages', token)]),
    [[[], []], [[], []], [[], []], [[], []]])
  eq('恢复进度：舍入为整数、下溢为零、精度越界和溢出都按原始数字拒绝',
    [fromToken('done', '0.99999999999999999'), fromToken('pages', '1e-325'),
      fromToken('pages', '9007199254740990.5'), fromToken('pages', '1e400')]
      .map(problems => problems.length > 0), [true, true, true, true])
  eq('恢复进度：无限大按原始指数报告，不把它写成 null',
    fromToken('pages', '1e400').some(problem => problem.includes('1e400') && !problem.includes('null')), true)

  const base = () => ({ done: [0, 2], offsets: { 0: 0, 2: 80 },
    answered: { 0: 0, 2: 3 }, found: { 0: null, 2: 40 }, pages: { 0: 0, 2: 12 } })
  const badDone: [string, unknown][] = [
    ['缺席', undefined], ['null', null], ['字符串', '0'], ['对象', { 0: 1 }],
    ['重复', [0, 0]], ['负数', [-1]], ['越界', [3]], ['小数', [0.5]],
    ['溢出', [Number.MAX_SAFE_INTEGER + 1]], ['字符串项', ['0']],
  ]
  const doneFailures = badDone.flatMap(([name, done]) => {
    const raw: Record<string, unknown> = { ...base(), done }
    if (name === '缺席') delete raw.done
    const got = resumeProgressProblems(raw, 3)
    return got.some(p => p.includes('done')) ? [] : [name]
  })
  eq('恢复进度：done 缺席、非数组、重复或非法任务索引逐类报错', doneFailures, [])
  criterion('D19.a')

  const tables = ['offsets', 'answered', 'found', 'pages'] as const
  const badTables: [string, unknown][] = [
    ['null', null], ['数组', [0]], ['字符串', '0'], ['数字', 0],
    ['负数', { 0: -1 }], ['小数', { 0: 0.5 }],
    ['溢出', { 0: Number.MAX_SAFE_INTEGER + 1 }], ['字符串值', { 0: '1' }],
    ['带前导零键', { '00': 1 }], ['负数键', { '-1': 1 }],
    ['越界键', { 3: 1 }], ['指数键', { '1e0': 1 }], ['非索引键', { abc: 1 }],
  ]
  eq('恢复进度：四张表均拒绝坏容器、坏索引与坏值，问题点名原字段',
    tables.flatMap(field => badTables.flatMap(([name, value]) =>
      resumeProgressProblems({ ...base(), [field]: value }, 3).some(p => p.includes(field))
        ? [] : [`${field}/${name}`])), [])
  eq('恢复进度：只有 found 允许 null，其他表的 null 仍被拒绝',
    tables.map(field => resumeProgressProblems({ ...base(), [field]: { 0: null } }, 3)
      .some(p => p.includes(field))), [true, true, false, true])
  criterion('D19.b')

  const bad = { done: [0, 0, 5], offsets: { '01': -3, 2: 0.2 },
    answered: { 9: -1 }, found: { 0: 'missing' }, pages: { 1: null } }
  const before = JSON.stringify(bad)
  const problems = resumeProgressProblems(bad, 3)
  eq('恢复进度：同一任务文件里的各表问题全部报告且不改原输入',
    [tables.every(field => problems.some(p => p.includes(field))),
      problems.some(p => p.includes('done')), JSON.stringify(bad) === before], [true, true, true])
  criterion('D19.c')

  const legacy = { done: [0], tasks: ['placeholder'] }
  eq('恢复进度：旧目录的四张整表可缺席；页数高于当前上限仍是有效历史',
    [resumeProgressProblems(legacy, 3), resumeProgressProblems(base(), 3)], [[], []])
  eq('恢复进度：两位任务索引与最大安全整数仍可作为历史进度读取',
    resumeProgressProblems({ done: [10], offsets: { 10: Number.MAX_SAFE_INTEGER },
      answered: { 10: Number.MAX_SAFE_INTEGER }, found: { 10: null }, pages: { 10: 12 } }, 11), [])
  eq('恢复进度：表之间不要求互相推算或补齐',
    resumeProgressProblems({ done: [1], offsets: { 0: 0 }, answered: { 2: 4 },
      found: { 1: null }, pages: { 2: 12 } }, 3), [])
  criterion('D19.d')
}

})
if (fullRun) {
suite('P1', '排序：粉丝数「未查询」不被当成「已确认不够」')
{
  /**
   * 需求所有者 2026-09-19 裁决（ADR-92）：同层同分时，粉丝数分三档 ——
   * **已查到且不是 0 → 未查询 → 确实是 0**。未查询只压得过确认为 0 的人，
   * 压不过任何真查到了数的人。**只改先后，不改分也不改层。**
   */
  const FOLLOWERS: Record<string, number | undefined> = { big: 50_000, unknown: undefined, zero: 0 }
  const line = (...handles: string[]): Creator[] =>
    handles.map(h => mk('tiktok', h, { tier: 'B', score: 40, followers: FOLLOWERS[h] }))

  // 三档的先后。**正序逆序各排一次**：打平时排序稳定，比较器返回 0 就跟着输入
  // 顺序走 —— 只写一个方向，有一半的错写法照样绿，包括「这一条根本没生效」
  eq('三档先后：已查到的非 0 → 未查询 → 确实是 0',
     sortForOutput(line('big', 'unknown', 'zero')).map(c => c.handle), ['big', 'unknown', 'zero'])
  eq('把输入顺序整个颠倒，结论不变',
     sortForOutput(line('zero', 'unknown', 'big')).map(c => c.handle), ['big', 'unknown', 'zero'])

  // 两两各钉一次 —— 三个一起排时，只要有一档放对了，另一档错位也可能被挤回正确位置
  eq('未查询压得过确实是 0 的', sortForOutput(line('zero', 'unknown')).map(c => c.handle),
     ['unknown', 'zero'])
  eq('未查询压不过真查到了数的', sortForOutput(line('unknown', 'big')).map(c => c.handle),
     ['big', 'unknown'])
  eq('真查到了数的压得过确实是 0 的', sortForOutput(line('zero', 'big')).map(c => c.handle),
     ['big', 'zero'])

  // 这一条只在打平时说话，不许越过分数插队 —— 否则就等于偷偷给「未查询」加了分
  eq('分数仍然优先：分高的在前，哪怕他的粉丝数是已查到的 0',
     sortForOutput([
       mk('tiktok', 'low-unknown', { tier: 'B', score: 10, followers: undefined }),
       mk('tiktok', 'high-known', { tier: 'B', score: 40, followers: 0 }),
     ]).map(c => c.handle), ['high-known', 'low-unknown'])
  criterion('P1.h')
}

suite('D1', 'platform:handle 唯一标识，大小写不敏感')
{
  const c = [mk('tiktok', 'Sarah', { bio_links: [] }), mk('instagram', 'sarah')]
  eq('大小写不同视为同一人', linkCrossPlatform(c), 1)
}

suite('D5', 'CSV 转义')
{
  eq('含逗号', esc('a,b'), '"a,b"')
  eq('含引号', esc('say "hi"'), '"say ""hi"""')
  eq('含换行', esc('l1\nl2'), '"l1\nl2"')
  eq('普通不加引号', esc('plain'), 'plain')
}

suite('D2', 'bio_links 归一化为数组')
{
  const c = mk('tiktok', 'a', { bio_links: ['https://x.com'] })
  ok('恒为数组', Array.isArray(c.bio_links))
}

// ─────────────────────────── 流程 ───────────────────────────

suite('F6', '语义判断否定有一票否决权')
{
  const high = mk('tiktok', 'x', { email: 'a@b.com', source_dimension: 'competitor', post_count: 50 })
  high.score = scoreCreator(high)
  ok('分数确实很高', high.score >= 60)
  high.fit = '❌'
  eq('❌ 一律降到 C', tierOf(high, high.score), 'C')
  high.fit = '✅'
  eq('✅ 且有邮箱 → A', tierOf(high, high.score), 'A')
  const noEmail = mk('tiktok', 'y', { fit: '✅', score: 45 })
  eq('强相关但缺邮箱 → B 而非 C', tierOf(noEmail, 45), 'B')
}

suite('F7', '每个运行实例只在成功预留后各提醒一次 50% 与 80%')
{
  await costSucceeds('阈值、退款、恢复与拒绝组合完整执行', () => {
    const seen: [number, string | null, string | null][] = []
    const b = fundedBudget(10000, (threshold, view) => seen.push([threshold, view.cost_estimate_usd, view.cost_pending_usd]))
    for (let i = 0; i < 4; i++) b.settle(b.reserve(TEST_TT), { kind: 'http', status: 200 })
    eq('低于一半不提醒', seen, [])
    b.settle(b.reserve(TEST_TT), { kind: 'http', status: 429 })
    eq('恰到一半立即提醒，此时本次仍 pending', seen, [[0.5, '0.005', '0.001']])
    for (let i = 0; i < 5; i++) b.settle(b.reserve(TEST_TT), { kind: 'http', status: 200 })
    eq('退款不重置；settle 不另提醒', seen, [[0.5, '0.005', '0.001'], [0.8, '0.008', '0.001']])
    const before = b.view(); let error: unknown
    try { b.reserve(TEST_IG) } catch (e) { error = e }
    ok('下一价高于余额时拒绝', error instanceof CostError && error.code === 'budget-exceeded')
    eq('拒绝不改变费用投影', b.view(), before)
    eq('拒绝不触发额外提醒', seen.length, 2)
    ok('余额不足不冒充占用 100%', !/100\s*%/.test(b.summary()))
    ok('说明不足以支付下一请求', /余额|剩余/.test(String(error)) && /不足|不够/.test(String(error)))
    const restoredSeen: [number, string | null][] = []
    const restored = new Budget(costFixture(10000, 8), (threshold, view) => restoredSeen.push([threshold, view.cost_estimate_usd]))
    eq('单纯恢复不提醒', restoredSeen, [])
    const receipt = restored.reserve(TEST_TT)
    eq('恢复超过两线时首个成功预留分别提醒', restoredSeen, [[0.5, '0.009'], [0.8, '0.009']])
    restored.settle(receipt, { kind: 'http', status: 429 })
    restored.settle(restored.reserve(TEST_TT), { kind: 'http', status: 200 })
    eq('恢复实例退款后不重复提醒', restoredSeen.length, 2)
    const none: number[] = [], empty = fundedBudget(0, pct => none.push(pct))
    try { empty.reserve(TEST_TT) } catch { /* 零额度仍是合法上限，付费被拒绝。 */ }
    eq('零额度且拒绝预留不做除零提醒', none, [])
    eq('零额度占用仍为明确零', empty.view().cost_estimate_usd, '0')
    // 精确交叉乘法边界：上限 MAX_SAFE_INTEGER，历史占用离一半差 0.0004955。
    const hugeState = costFixture(Number.MAX_SAFE_INTEGER, 4503599627370)
    const hugeSeen: number[] = [], huge = new Budget(hugeState, pct => hugeSeen.push(pct))
    huge.settle(huge.reserve(TEST_TT), { kind: 'http', status: 200 })
    eq('最大安全金额精确比较，不扩大上限或丢掉 50% 线', hugeSeen, [0.5])
  })
  criterion('F7.c', 'F7.d')
}

}
await group('f8-risk', () => {
suite('F8', '公开信号风险透明降级但不删除')
{
  const accounts: Record<string, AccountAssessment> = {}
  const target = assessedAccount('risk-target', 100, 1, 9_000)
  accounts[accountKey('tiktok', target.handle)] = target
  for (let i = 0; i < 8; i++) {
    const peer = assessedAccount(`peer-${i}`, 5_000 + i * 10, 500 + i, 100 + i)
    accounts[accountKey('tiktok', peer.handle)] = peer
  }
  assignAudienceRisks(accounts)
  const risk = target.metrics!.audience_quality_risk
  eq('至少两个异常信号才判 high', risk.status === 'measured' ? risk.value.level : undefined, 'high')
  ok('high 带可读的逐指标依据', risk.status === 'measured' && risk.value.flags.length >= 2)
  eq('同行样本达到下限且不含被评账号自己',
    risk.status === 'measured' ? risk.value.peer_size : undefined, 8)

  const creator = mk('tiktok', 'risk-target', {
    email: 'a@example.com', fit: '✅',
    account_assessment: { platform: 'tiktok', handle: 'risk-target', metrics: target.metrics },
  })
  const ranked = rankCreators([creator], 'US')
  eq('高风险不删除创作者', ranked.length, 1)
  eq('高风险只降一级', ranked[0].tier, 'B')
  eq('降级留下理由', ranked[0].tier_adjustments?.[0]?.kind, 'audience_quality_risk')

  const mediumMetrics = structuredClone(target.metrics!)
  const mediumValue: AudienceRiskAssessment = {
    level: 'medium', flags: risk.status === 'measured' ? risk.value.flags.slice(0, 1) : [], peer_size: 9,
  }
  mediumMetrics.audience_quality_risk = measured(
    mediumValue, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 9, 'one signal')
  const medium = mk('tiktok', 'medium', {
    email: 'a@example.com', fit: '✅',
    account_assessment: { platform: 'tiktok', handle: 'medium', metrics: mediumMetrics },
  })
  eq('medium 不改变分层', rankCreators([medium], 'US')[0].tier, 'A')

  const both = mk('tiktok', 'both', {
    email: 'a@example.com', fit: '✅', audience_geo: { US: 0.2 },
    account_assessment: { platform: 'tiktok', handle: 'both', metrics: target.metrics },
  })
  const adjusted = rankCreators([both], 'US')[0]
  eq('地域规则后再执行风险降级', adjusted.tier_adjustments?.map(a => a.kind),
    ['audience_geo', 'audience_quality_risk'])
  eq('两项独立风险可连续降级', adjusted.tier, 'C')

  const few: Record<string, AccountAssessment> = {
    [accountKey('tiktok', 'alone')]: assessedAccount('alone', 100, 10, 10),
  }
  assignAudienceRisks(few)
  eq('同行不足时明确 unknown 而不是 low',
    few[accountKey('tiktok', 'alone')].metrics?.audience_quality_risk.status, 'unavailable')

  const boundary: Record<string, AccountAssessment> = {}
  const edge = assessedAccount('edge', 100, 10, 100)
  boundary[accountKey('tiktok', edge.handle)] = edge
  for (let i = 0; i < 8; i++) {
    const peer = assessedAccount(`edge-peer-${i}`, 100, 10, 100)
    peer.metrics!.engagement_rate_followers = measured(
      (i + 1) / 100, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test peer value')
    peer.metrics!.view_rate = measured(
      (i + 1) / 100, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test peer value')
    peer.metrics!.following_ratio = measured(
      0.01, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 1, 'test peer value')
    boundary[accountKey('tiktok', peer.handle)] = peer
  }
  // 8 个同行 [0.01..0.08] 的 P10 是 0.017；等于阈值不满足“低于 P10”。
  edge.metrics!.engagement_rate_followers = measured(
    0.017, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test edge')
  edge.metrics!.view_rate = measured(
    0.017, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test edge')
  edge.metrics!.following_ratio = measured(
    0.01, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 1, 'test edge')
  assignAudienceRisks(boundary)
  const edgeRisk = edge.metrics!.audience_quality_risk
  eq('恰好等于 P10 不报警',
    edgeRisk.status === 'measured' ? edgeRisk.value.level : undefined, 'low')

  const tied: Record<string, AccountAssessment> = {}
  const tiedTarget = assessedAccount('tied-target', 100, 10, 100)
  tiedTarget.metrics!.engagement_rate_followers = measured(
    0.01, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test outlier')
  tiedTarget.metrics!.view_rate = measured(
    0.01, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test outlier')
  tied[accountKey('tiktok', tiedTarget.handle)] = tiedTarget
  for (let i = 0; i < 8; i++) {
    const peer = assessedAccount(`tied-peer-${i}`, 100, 10, 100)
    peer.metrics!.engagement_rate_followers = measured(
      0.02, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test tied baseline')
    peer.metrics!.view_rate = measured(
      0.02, PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 6, 'test tied baseline')
    tied[accountKey('tiktok', peer.handle)] = peer
  }
  assignAudienceRisks(tied)
  const tiedRisk = tiedTarget.metrics!.audience_quality_risk
  eq('同行并列时真正低于基线的账号仍会报警',
    tiedRisk.status === 'measured' ? tiedRisk.value.level : undefined, 'high')

  const wrongBand: Record<string, AccountAssessment> = {
    [accountKey('tiktok', 'same-target')]: assessedAccount('same-target', 100, 10, 10),
  }
  for (let i = 0; i < 8; i++) {
    const peer = assessedAccount(`other-band-${i}`, 1000, 100, 10)
    peer.followers = 100_000
    wrongBand[accountKey('tiktok', peer.handle)] = peer
  }
  assignAudienceRisks(wrongBand)
  eq('不能拿相邻粉丝档凑够同行数',
    wrongBand[accountKey('tiktok', 'same-target')].metrics?.audience_quality_risk.status,
    'unavailable')
}

})
if (fullRun) {
suite('F2', '关键词四维度')
{
  const dims = ['category', 'scene', 'competitor', 'audience']
  const scores = dims.map(d => scoreCreator(mk('tiktok', 'x', { source_dimension: d as any })))
  ok('竞品词权重最高', scores[2] === Math.max(...scores))
}

// ─────────────────────────── 展示 ───────────────────────────

suite('U1', 'CSV 排序与三档区分')
{
  const sorted = sortForOutput([
    mk('tiktok', 'c1', { tier: 'C', score: 90 }),
    mk('tiktok', 'a1', { tier: 'A', score: 50 }),
    mk('tiktok', 'a2', { tier: 'A', score: 80 }),
    mk('tiktok', 'b1', { tier: 'B', score: 70 }),
  ])
  eq('A→B→C，同层分数降序', sorted.map(c => c.handle), ['a2', 'a1', 'b1', 'c1'])
  eq('未查询与空值可区分', [cell(undefined), cell(null), cell(0)], ['未查询', '', '0'])

  // 「还没算过分」不是「0 分」。原来写的是 `(b.score ?? 0) - (a.score ?? 0)`，
  // 两者被压成同一个值：没分的和 0 分的谁在前全看排序算法，交付表上分不出来
  // 没分的**写在 0 分前面**：缺省成零的旧写法会让两者打平，而排序是稳定的 ——
  // 打平就保持输入顺序，于是旧写法给出 none 在前。写反了这条断言就分不出两种实现
  const noScore = sortForOutput([
    mk('tiktok', 'none', { tier: 'A' }),
    mk('tiktok', 'zero', { tier: 'A', score: 0 }),
    mk('tiktok', 'ten', { tier: 'A', score: 10 }),
  ])
  eq('没算过分的排在 0 分之后，不与它混同', noScore.map(c => c.handle), ['ten', 'zero', 'none'])
}

suite('U5', 'xlsx 分 sheet')
{
  // 只有 A 和 B 有人，C 为空 —— C 的 sheet 必须照建
  const sheets = buildSheets([
    mk('tiktok', 'a', { tier: 'A', score: 90 }),
    mk('instagram', 'b', { tier: 'B', score: 50 }),
  ])
  eq('三个 sheet（含空的 C，无「全部」）', sheets.length, 3)
  eq('sheet 名带计数', sheets.map(s => s.name),
     ['A级 直接发信 (1)', 'B级 先互动 (1)', 'C级 观察池 (0)'])

  const tmpx = join(tmpdir(), `kol-u5-${process.pid}.xlsx`)
  writeXlsx(tmpx, sheets)
  const buf = rf(tmpx)
  eq('是 ZIP 容器', buf.subarray(0, 2).toString(), 'PK')
  const text = buf.toString('latin1')
  ok('含 workbook', text.includes('xl/workbook.xml'))
  ok('三个 sheet 各一个 xml', ['sheet1', 'sheet2', 'sheet3'].every(n => text.includes(`xl/worksheets/${n}.xml`)))
  ok('没有第四个 sheet', !text.includes('xl/worksheets/sheet4.xml'))

  // 空分层也必须建 sheet —— 「这一层没人」是信息，隐藏会让人以为漏了数据
  const names = xlsxSheetNames(tmpx)
  eq('sheet 名读回正确', names, ['A级 直接发信 (1)', 'B级 先互动 (1)', 'C级 观察池 (0)'])
  ok('空分层的 sheet 存在且标出 (0)', names.some(n => n.endsWith('(0)')))
  ul(tmpx)
}

suite('U2', 'HTML 报告不依赖网络资源')
{
  const html = renderHtml([mk('tiktok', 'a', { tier: 'A', score: 1, profile_url: 'https://www.tiktok.com/@a' })],
    { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [], total: 1,
      tiers: { A: 1, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
      ...testCostMeta(1, 2000000), enriched: false })
  ok('无外部 script', !/<script[^>]+src=/.test(html))
  ok('无外部样式表', !/<link[^>]+href=/.test(html))
  ok('无外部图片', !/<img[^>]+src="https?:/.test(html))
}

suite('U6', 'HTML 分层 tab 与平台标签')
{
  const html = renderHtml(
    [mk('tiktok', 'a', { tier: 'A', score: 1 }), mk('instagram', 'b', { tier: 'B', score: 1 })],
    { product: 'p', market: 'US', platforms: ['tiktok', 'instagram'], keywords: [], total: 2,
      tiers: { A: 1, B: 1, C: 0 }, email_count: 0, cross_platform_count: 0,
      ...testCostMeta(1, 2000000), enriched: false })
  ok('三个 tab，无「全部」', ['data-f="A"', 'data-f="B"', 'data-f="C"'].every(t => html.includes(t))
     && !html.includes('data-f="all"'))
  ok('卡片带 data-tier 供筛选', html.includes('data-tier="A"') && html.includes('data-tier="B"'))
  ok('默认选中 A（第一个非空）', html.includes('class="tab A on"'))
  ok('非默认分层初始隐藏（不依赖 JS）', html.includes('data-tier="B" style="display:none"'))
  ok('切换不滚动页面', !html.includes('scrollIntoView'))

  // A 为空时应默认落在 B，而不是打开就是一片空白
  const noA = renderHtml([mk('instagram', 'b', { tier: 'B', score: 1 })],
    { product: 'p', market: 'US', platforms: ['instagram'], keywords: [], total: 1,
      tiers: { A: 0, B: 1, C: 0 }, email_count: 0, cross_platform_count: 0,
      ...testCostMeta(1, 2000000), enriched: false })
  ok('A 为空时默认落到 B', noA.includes('class="tab B on"') && !noA.includes('class="tab A on"'))
  ok('平台标签区分 class', html.includes('pf tiktok') && html.includes('pf instagram'))
  ok('平台标签有专属配色', html.includes('.pf.tiktok{') && html.includes('.pf.instagram{'))
  ok('平台标签与次要标签不同层级', html.includes('.xp{') && !html.includes('.pf,.xp{'))
}

suite('U7', '公开指标、风险依据、报价效率与边界进入交付物')
{
  const primary = assessedAccount('main', 1_000, 100, 100)
  const linked = assessedAccount('linked', 2_000, 200, 100)
  linked.platform = 'instagram'
  linked.sample = measured<NormalizedPublicPost[]>([
    { id: 'linked-recent', published_at: '2026-08-20T00:00:00.000Z', is_pinned: false },
  ], PUBLIC_SOURCE, '2026-08-26T00:00:00.000Z', 1, 'linked activity sample')
  linked.metrics = calculatePublicMetrics(linked.sample, linked.followers, linked.following)
  const quote: CollaborationQuote = {
    amount: 300, currency: 'USD', platform: 'tiktok', format: 'tiktok_video', quantity: 1,
    source: 'public_rate_card', observed_at: '2026-08-26T00:00:00.000Z',
  }
  primary.collaboration_quote = measured(
    quote, { kind: 'manual', provider: 'operator' }, quote.observed_at, 1, 'public rate card')
  const state: EnrichmentState = {
    version: 1, updated_at: '2026-08-26T00:00:00.000Z', accounts: {
      [accountKey('tiktok', 'main')]: primary,
      [accountKey('instagram', 'linked')]: linked,
    },
  }
  const creator = mk('tiktok', 'main', {
    fit: '✅', email: 'a@example.com', cross_platform: true, linked_handle: 'instagram:linked',
  })
  attachAssessments([creator], state)
  rankCreators([creator], 'US')

  const row = toRow(creator)
  eq('CSV 单列当前平台粉丝分母，不复用跨平台合计',
    row[HEADERS.indexOf('metrics_account_followers')], '10000')
  ok('CSV 含粉丝互动率', String(row[HEADERS.indexOf('engagement_rate_followers')]).endsWith('%'))
  ok('CSV 含 eCPE 的中位互动量分母',
    Number(row[HEADERS.indexOf('median_engagements')]) > 0)
  eq('CSV 展示当前平台的活跃状态',
    row[HEADERS.indexOf('activity_status')], 'dormant')
  ok('CSV 展示最后发布及距采样天数',
    row[HEADERS.indexOf('latest_post_at')] !== '未查询' &&
    Number(row[HEADERS.indexOf('days_since_last_post')]) > 90)
  ok('CSV 含合作报价', String(row[HEADERS.indexOf('collaboration_quote')]).includes('USD 300'))
  ok('CSV 含 eCPM', String(row[HEADERS.indexOf('implied_ecpm')]).startsWith('USD '))
  ok('结构化交付物关联主账号与另一平台',
    creator.account_assessment?.handle === 'main' && creator.linked_account_assessment?.handle === 'linked')

  const html = renderHtml([creator], {
    product: 'p', market: 'US', platforms: ['tiktok', 'instagram'], keywords: [], total: 1,
    tiers: { A: 1, B: 0, C: 0 }, email_count: 1, cross_platform_count: 1,
    ...testCostMeta(2, 2000000), enriched: false,
    high_risk_count: 0,
    capabilities: {
      email_verification: { total: 1, measured: 0, unavailable: 0, unqueried: 1 },
      audience_geo: { total: 1, measured: 0, unavailable: 0, unqueried: 1 },
      public_post_sample: { total: 2, measured: 2, unavailable: 0, unqueried: 0 },
      audience_quality_risk: { total: 2, measured: 0, unavailable: 2, unqueried: 0 },
      creator_activity: { total: 2, measured: 2, unavailable: 0, unqueried: 0 },
      collaboration_quote: { total: 2, measured: 1, unavailable: 0, unqueried: 1 },
    },
  })
  ok('HTML 展示两个平台明细', html.includes('TikTok · @main') && html.includes('Instagram（关联） · @linked'))
  ok('HTML 分平台展示停更与活跃标签',
    html.includes('活跃状态') && html.includes('>停更</b>') && html.includes('>活跃</b>'))
  ok('公开指标不会隐藏邮箱与地域边界',
    html.includes('未做有效性验证') && html.includes('无法确认'))
  criterion('P5.b')
  ok('HTML 明说风险不是假粉率或带货效果',
    html.includes('不是假粉率') && html.includes('不能代表实际带货效果'))
  criterion('P5.c')
}

suite('U4', 'A 级附开发信草稿且可复制')
{
  const html = renderHtml([mk('tiktok', 'a', { tier: 'A', score: 1, outreach_draft: 'Hi there' })],
    { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [], total: 1,
      tiers: { A: 1, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
      ...testCostMeta(1, 2000000), enriched: false })
  ok('渲染草稿', html.includes('Hi there'))
  ok('有复制按钮', html.includes('cp(this)'))
}

}
await group('h-mutate', () => {
harness('变异子集先过正常代码基线：失败或没跑完不能当绿')
{
  const goodTest = '\n全部通过（执行 1 条断言；覆盖 1 条需求）\n'
  const goodHarness = '\n全部通过（执行 1 条断言；覆盖 0 条需求）\n'
  const goodSelfcheck = '\n✓ 脚本自检（只跑 1 组）：点名的那几组都跑完了，一条断言都没红\n'
  eq('需求测试正常完成且执行断言，基线通过', baselineFault(0, goodTest, VERIFIERS.test), undefined)
  eq('纯检查夹具执行断言但不冒领需求，基线通过', baselineFault(0, goodHarness, VERIFIERS.test), undefined)
  eq('自检正常完成指定组，基线通过', baselineFault(0, goodSelfcheck, VERIFIERS.selfcheck), undefined)
  ok('断言失败即使误打成功汇总也拒绝', baselineFault(1, goodTest, VERIFIERS.test) !== undefined)
  ok('进程被杀没有退出码也拒绝', baselineFault(null, goodTest, VERIFIERS.test) !== undefined)
  ok('退出 0 却没有完成汇总也拒绝', baselineFault(0, '', VERIFIERS.test) !== undefined)
  ok('用另一个验证者的汇总冒充完成也拒绝',
    baselineFault(0, goodSelfcheck, VERIFIERS.test) !== undefined)
  ok('零条断言的空子集不能冒充完成',
    baselineFault(0, '\n全部通过（执行 0 条断言；覆盖 0 条需求）\n', VERIFIERS.test) !== undefined)
}

harness('变异测试：验证者崩了不算抓到')
{
  const T = VERIFIERS.test
  // 「被抓到」= 断言红了。一处语法错、一个 TypeError 也能让进程非零退出，但那不是任何一条断言的功劳
  eq('零退出 → 存活', judgeRun(0, '全部通过（覆盖 26 条需求）', T), 'survived')
  eq('非零退出且有失败汇总 → 抓到', judgeRun(1, '  ✗ 某条\n\n2 个失败\n', T), 'caught')
  eq('非零退出但没有汇总 → 跑不起来，不算抓到', judgeRun(1, "TypeError: Cannot read properties of undefined", T), 'crashed')
  eq('被信号杀掉（没有退出码）也不算抓到', judgeRun(null, '', T), 'crashed')
  // 汇总已经打出来了也一样：那一次没跑完，剩下的断言一条也没说过话（ADR-70 的欠条）
  eq('被信号杀掉：汇总已经打出来也不算', judgeRun(null, '  ✗ 某条\n\n2 个失败\n', T), 'crashed')
  eq('汇总必须是自成一行的那句，正文里提到「个失败」不算', judgeRun(1, '断言说：这里不该有 3 个失败的例子', T), 'crashed')
}

harness('判 crashed 时留下的现场：带记号的一条都不许丢')
{
  const SC = VERIFIERS.selfcheck
  // 判定交回来的是 trim 过的行 —— 夹具也按 trim 过的比，别拿带缩进的去比
  const mark = (n: number) => `✗ 第${n}条${SELFCHECK_PROCESS_MARK}：进程级的`
  const plain = (n: number) => `✗ 第${n}条普通失败`
  // 带记号的那几行是判定一票否决的原因。混在一起按顺序截的话，吵一点的一次运行
  // 会把唯一说得清原因的那行挤掉，留下来的全是无关的（M-H33-a）。
  const noisy = [...Array.from({ length: 20 }, (_, i) => plain(i)), mark(99)].join('\n')
  const got = crashEvidence(noisy, SC, 5)
  ok('带记号的那行在，哪怕它排在二十行之后', got.lines.includes(mark(99)))
  eq('总行数不超过封顶', got.lines.length, 5)
  eq('截掉了几行要报出来', got.omitted, 16)
  // 封顶要给带记号的让位：只按普通行去算余量，总数就会超过封顶（M-H33-b）
  const allMarked = [mark(1), mark(2), mark(3)].join('\n')
  eq('带记号的比封顶还多 → 一条不丢，也不去截它们',
    crashEvidence(allMarked, SC, 2).lines.length, 3)
  eq('那时没有普通行可截，omitted 是 0', crashEvidence(allMarked, SC, 2).omitted, 0)
  // 夹具记号与进程记号同权 —— 两支都是「不是断言的功劳」
  ok('夹具记号也算原因',
    crashEvidence(`  ✗ 某条${SELFCHECK_FIXTURE_MARK}：夹具废了`, SC, 1).lines.length === 1)
  // 没有失败行就是没有 —— 兜底那句话由入口打，判定这边交空名单
  // ⚠️ 一条成形的失败行都没有 → 交回原始输出的末尾几行。真崩掉的那一次打的是**栈**，
  // 一行以「✗ 」开头的都没有 —— 只认成形的失败行的话，现场恰恰在最需要它的那一档
  // 是空的，而这段代码存在的唯一理由就是诊断那一次（M-H35-a，#105 第四轮评审指出）。
  const stack = ['Error: Transform failed with 1 error:', '  at foo (x.ts:1:1)',
                 '  at bar (y.ts:2:2)'].join('\n')
  eq('没有成形的失败行 → 交回原始输出的尾巴', crashEvidence(stack, SC, 5).lines,
    ['Error: Transform failed with 1 error:', 'at foo (x.ts:1:1)', 'at bar (y.ts:2:2)'])
  ok('并且标明这是原始输出，不是断言说的话', crashEvidence(stack, SC, 5).raw)
  // 尾巴也封顶，而且取的是**末尾** —— 崩的原因通常在最后，不在开头（M-H35-b）
  eq('尾巴取末尾那几行', crashEvidence(stack, SC, 1).lines, ['at bar (y.ts:2:2)'])
  eq('尾巴截掉了几行也要报', crashEvidence(stack, SC, 1).omitted, 2)
  // 有成形的失败行时**不掺**原始输出 —— 掺进栈只会把它们淹掉（M-H35-c）
  ok('有成形的失败行 → raw 为假', !crashEvidence(`✗ 真的失败了\n${stack}`, SC, 5).raw)
  eq('有成形的失败行 → 只交那些', crashEvidence(`✗ 真的失败了\n${stack}`, SC, 5).lines,
    ['✗ 真的失败了'])
  eq('一个字都没打 → 空', crashEvidence('\n  \n', SC, 5).lines.length, 0)
  // 缺省那个验证者没有记号，两栏都取不到时不许当成「每行都是原因」
  eq('验证者没有记号 → 全按普通行截', crashEvidence(noisy, VERIFIERS.test, 5).lines.length, 5)
  // 「失败行」的文法与 processFailed / killsMatched 同一条：trim 之后以「✗ 」开头。
  // 只问「含不含这个字」的话，一行顺带提到它的诊断会占掉普通行的名额，把真的挤出去
  // （M-H34-b，#105 第二轮评审指出）。
  const chatty = ['诊断：下面用 ✗ 标记失败', '✗ 真的失败了', '值是「✗」'].join('\n')
  eq('只有以「✗ 」开头的才算失败行', crashEvidence(chatty, VERIFIERS.test, 5).lines, ['✗ 真的失败了'])
}

harness('变异指定验证者：认哪一句汇总，点名杀哪几条夹具')
{
  const T = VERIFIERS.test
  const SC = VERIFIERS.selfcheck
  // 「跑哪个脚本」和「它的汇总长什么样」在同一处声明。分两个地方放的话，换一边不换
  // 另一边的症状是「它真的红了，却被判成跑不起来」—— 一个不响的假阴性
  // 汇总是最后打的，紧跟着硬退出会在管道上把它截掉 —— 退出码非零、汇总没有，
  // 判定只能判「跑不起来」，而那是一条真被抓到的变异，还时红时绿（评审指出）。
  // 反例得把那一串拼出来：本文件自己也是验证者，写成整串的话下面那条循环会判到它自己
  const hardExit = `process.${'exit'}(1)`
  eq('打完汇总就硬退出的写法要认出来',
    exitRace(`console.error(汇总); ${hardExit}`), `process.${'exit'}(`)
  eq('只提名字不调用的是散文，不算', exitRace('// 别用 process.exit 那种写法'), undefined)

  // 逐个验证者验两件事。**读文件要带保护**：路径指空时直接读会抛，而抛在这里的样子是
  // 「测试进程崩了」—— 判定如实报「跑不起来」，于是 M-H14-r 那条本该被断言抓到的变异
  // 变成了崩溃。一条只靠崩溃被抓到的变异什么也证明不了，这正是四态要拦的东西
  // （这个坑是变异集自己抓出来的，不是我读出来的）。
  for (const [name, v] of Object.entries(VERIFIERS)) {
    const src = existsSync(v.script) ? rf(v.script, 'utf8') : ''
    // 断的是「这条路径真指着一个入口」，不是把同一个常量抄一遍 —— 抄一遍的那种
    // 路径写错了照样绿，而路径写错的样子是每条接线变异都「跑不起来」，不是「路径写错了」
    ok(`${name} 这个验证者起的是一个真在的入口`, src.startsWith('#!'))
    // 没有提前退出，就没有绕过汇总的路 —— 每条失败路径都经过同一句汇总，
    // 这一条从此不必靠读代码相信
    eq(`${name} 这个验证者不硬退出`, exitRace(src), undefined)
  }
  const scFail = '  ✗ 某条夹具：说错了\n\n✗ 脚本自检：1 项失败\n'
  eq('自检红了，按它自己那句汇总认', judgeRun(1, scFail, SC), 'caught')
  // 汇总在两处各写了一份字面量：自检打的那句话、判定这边的正则。拿**自检真会打的那句**
  // 去喂这条正则 —— 任一边改了文案这条当场红。各写各的话两边都绿，而每条接线变异
  // 从此被误报成「跑不起来」，一个不响的假阴性（ADR-70 的欠条）
  ok('自检真会打的那句汇总，判定认得出来', SC.summary.test(`\n${selfcheckSummary(3)}\n`))
  // 两句汇总不是一个形状：拿测试那一句去认自检的输出，每一条接线变异都会被判成跑不起来
  eq('拿另一个验证者的汇总去认，一次真的失败会被当成跑不起来', judgeRun(1, scFail, T), 'crashed')

  // ---- 点了名的还要再问一层：红的是不是那一条 ----
  // 用的是自检里真有的那两条夹具名 —— 编出来的名字证不了「这套匹配对得上真的输出」
  const done = 'collect 关键词跑完（退出码 0）也说续跑代价'
  const budget = 'collect 预算用尽（退出码 3）也说续跑代价'
  const red = `  ✗ ${done}：没说清续跑的代价\n\n✗ 脚本自检：1 项失败\n`
  eq('点名那条红了 → 被抓到', judgeRun(1, red, SC, [done]), 'caught')
  eq('验证者红了，红的却不是点名那条 → 红错了地方，不算抓到', judgeRun(1, red, SC, [budget]), 'elsewhere')
  // 不点名的那些逐字保持原样：断言红了就是被抓到，不判第四态
  eq('没点名就不问第二层', judgeRun(1, red, SC), 'caught')

  // ---- 点名是一组，每一条都要红 ----
  // 只收一个名字的时候，一条变异弄红名单里的头一条就算被抓到：M-D6-j 因此只证明了
  // 「四条收尾里的第一条还活着」，后三条夹具删光它照样绿（#91 复查实测）。一条没红，
  // 这条变异对那一条就什么也没证明 —— 判的是「红错了地方」，不是「被抓到」
  const both = `  ✗ ${done}：没说清续跑的代价\n  ✗ ${budget}：说反了\n\n✗ 脚本自检：2 项失败\n`
  eq('点名两条、两条都红 → 被抓到', judgeRun(1, both, SC, [done, budget]), 'caught')
  eq('点名两条、只红了头一条 → 红错了地方', judgeRun(1, red, SC, [done, budget]), 'elsewhere')
  eq('点名两条、只红了后一条 → 一样不算', judgeRun(1, red, SC, [budget, done]), 'elsewhere')
  eq('顺序不影响判定', judgeRun(1, both, SC, [budget, done]), 'caught')

  // ---- 出过进程级失败，这一次的证据就不算数 ----
  // 记号只贴在打那句话的那一行上，护不住它后面照打的**派生诊断**：一条只把被测脚本
  // 弄崩的变异会漏出不带记号的 ✗，kills 点它就成了「把崩溃的功劳记到断言头上」。
  // 所以拦在整次运行这一层（评审第三轮实测指出，我第一轮驳回错了）
  const derived = 'collect 预算用尽后没有留下可读的断点（P3.b 要求捕获后保存断点）'
  const crashed = [
    `  ✗ collect 预算用尽保存断点${SELFCHECK_PROCESS_MARK}：预期以退出码 3 结束，实际是 1`,
    `  ✗ ${derived}`, '', '✗ 脚本自检：2 项失败', '',
  ].join('\n')
  eq('带记号的那一行说明这次出过进程级失败', processFailed(crashed, SELFCHECK_PROCESS_MARK), true)
  eq('没有带记号的行就不算出过', processFailed(red, SELFCHECK_PROCESS_MARK), false)
  // 点名那条**确实红了**（派生诊断照打），可它红得不算数
  eq('崩溃漏出来的派生诊断真会匹配上', killsMatched(crashed, derived), true)
  eq('但整次判的是跑不起来，不是被抓到', judgeRun(1, crashed, SC, [derived]), 'crashed')
  // 没崩的那一次照旧 —— 这一道不能顺手把正常的抓到也拦掉
  eq('没崩的那一次照旧算被抓到', judgeRun(1, red, SC, [done]), 'caught')

  // ---- 夹具自己废了，这一次同样什么也没证明 ----
  // 一条夹具的诊断分「夹具没造对」和「断言红了」两种，打的却是同一句 `✗ <名字>：…`，
  // killsMatched 只认名字、分不出红的理由。实测把一条收尾夹具的场景弄坏之后，整次唯一
  // 那行红是「夹具没造对」，判定给的仍是 caught —— 自检在说「我什么也没测到」，而闸门
  // 记成「那条判据被守住了」（ADR-70 的欠条，勘察 5c 时实测）。记号从自检那边引过来，
  // 不在这儿再抄一份字面量：抄一份的话，自检改了记号这条照样绿
  const broke = (mark: string) =>
    `  ✗ ${done}${mark}：这一次走的不是 done 那条收尾 —— 夹具没造对\n\n✗ 脚本自检：1 项失败\n`
  eq('不带记号的话，那一行照样匹配得上点的名', killsMatched(broke(''), done), true)
  eq('带上记号就不算那条夹具红了', killsMatched(broke(SELFCHECK_FIXTURE_MARK), done), false)
  eq('夹具废了，整次判的是跑不起来，不是被抓到',
    judgeRun(1, broke(SELFCHECK_FIXTURE_MARK), SC, [done]), 'crashed')
  // 拦在**整次运行**这一层，跟进程记号同一个理由：记号只贴在废掉的那一行上，护不住
  // 后面照打的诊断。点名那条真红了也不算数 —— 这一次里有一条夹具压根没测到它要测的东西
  const alsoBroke = `  ✗ 别的夹具${SELFCHECK_FIXTURE_MARK}：夹具没造对\n${red}`
  eq('别的夹具废了，点名那条真红了也不算数', judgeRun(1, alsoBroke, SC, [done]), 'crashed')
  // ---- 见齐就停：凭点名认，不等汇总 ----
  // 提前退出会同时踩判定前面两道闸：主动杀掉 → 没有退出码 → 判崩；没跑到尾 → 没有汇总
  // → 还是判崩（ADR-70 记着这处「同一份设计里两句话打架」）。所以另开一条路：看见那几行
  // 不带记号的 ✗ <名字> 本身就是「断言真的跑了并且红了」的直接证据，比「打出了汇总」
  // 这个代理更硬 —— 汇总那道闸是给不点名的那一大批用的
  // 半行不算数：`✗ 某条夹具` 与 `✗ 某条夹具又长了一截` 的前缀一模一样，边收边看时
  // 名字写到一半就算数的话，后缀还没到就把人杀了。两股各自截 —— 合起来再截会把它们
  // 之间那个人为插入的换行当成行尾（#99 评审指出）
  eq('写完的那几行才算数', complete('甲\n乙'), '甲\n')
  eq('一整行都没写完 → 一个字也不算', complete('甲'), '')
  eq('正好写到行尾 → 全算', complete('甲\n'), '甲\n')
  eq('半行的名字不算它红了', allKilled(complete('  ✗ 某条夹具') + complete(''), ['某条夹具']), false)
  eq('成行之后才算', allKilled(complete('  ✗ 某条夹具\n') + complete(''), ['某条夹具']), true)
  eq('见齐了才算见齐', allKilled(both, [done, budget]), true)
  eq('少一条就不算', allKilled(red, [done, budget]), false)
  eq('带记号的那一行不算它红了', allKilled(broke(SELFCHECK_FIXTURE_MARK), [done]), false)
  // 主动停下的那一次：退出码是空的、汇总也没打出来，照旧算被抓到。
  // **第五个参数是「动手那一刻它说过的话」** —— 给了就是停过，没给就是跑到尾了。
  // 两件事合成一个参数，是因为拆成「停没停」加一份快照的话，两者对不上是表示得出来的
  // 状态，而对不上的症状是判定悄悄换了一份输入
  eq('主动停下的那一次凭点名认', judgeRun(null, both, SC, [done, budget], both), 'caught')
  // 入口说「停了」不算数，判定自己再问一遍 allKilled —— 不然入口那边一漂，一次连一行
  // 具名失败都没有的运行也能拿到 caught；而「两边共用同一判据」正是 allKilled 只此一份
  // 的理由，只让入口用、判定不用，等于把那句承诺自己作废（#99 评审指出）
  eq('说停了却一行具名失败都没有 → 不算数', judgeRun(null, '', SC, [done], ''), 'crashed')
  eq('说停了但只见齐了一半 → 不算数', judgeRun(null, red, SC, [done, budget], red), 'crashed')
  eq('说停了却没点名 → 不算数', judgeRun(null, both, SC, undefined, both), 'crashed')
  eq('停下之前崩过，整份不算数',
    judgeRun(null, `${crashed}${both}`, SC, [done], `${crashed}${both}`), 'crashed')
  eq('停下之前夹具废过，也不算数',
    judgeRun(null, `${alsoBroke}${both}`, SC, [done], `${alsoBroke}${both}`), 'crashed')

  // **我们自己那一刀打出来的东西，不算这条变异的账。** 杀的是整个进程组，验证者手上
  // 正跑着的子进程跟着一起没，它临死会补打一句带「进程」记号的失败 —— 拿最终输出去判，
  // 这一句就一票否决掉一次本来成立的抓到。实测 M-D6-j 就是这么被判成「跑不起来」的：
  // 四条点名的夹具全红了，而主干上机器占满时 8 次里红 5 次、空闲时 0 次 ——
  // 是台机器忙不忙决定的，不是这条变异
  eq('开枪之后才冒出来的进程级失败，不算数',
    judgeRun(null, `${both}${crashed}`, SC, [done, budget], both), 'caught')
  eq('开枪之后冒出来的夹具级失败，同样不算数',
    judgeRun(null, `${both}${alsoBroke}`, SC, [done, budget], both), 'caught')
  // 而开枪**之前**就有的照旧一票否决 —— 那时候我们还没动手，记号是真的（上面两条钉着）
  // 没停的那一次逐字如旧 —— 这条路不能顺手把别的判定改松
  eq('没主动停就还是按老规矩：没有退出码 → 跑不起来', judgeRun(null, both, SC, [done, budget]), 'crashed')
  eq('没主动停：没有汇总 → 跑不起来',
    judgeRun(1, `  ✗ ${done}：说错了\n  ✗ ${budget}：说反了\n`, SC, [done, budget]), 'crashed')
  // 「不是断言的功劳」两种记号同一个待遇 —— 新加一种记号时只补一条路是这里要拦的
  eq('进程级的记号算', notAssertion(crashed, SC), true)
  eq('夹具废了的记号也算', notAssertion(alsoBroke, SC), true)
  eq('都没有就不算', notAssertion(red, SC), false)
  eq('分不出这两种的验证者，一律不算', notAssertion(alsoBroke, T), false)

  // 分不出这两种的验证者（test 没有这个记号）逐字保持原样，不受这道闸影响
  eq('没声明夹具记号的验证者不受影响',
    judgeRun(1, `  ✗ 别的夹具${SELFCHECK_FIXTURE_MARK}：夹具没造对\n  ✗ ${done}：说错了\n\n1 个失败\n`,
      T, [done]), 'caught')

  // 一条夹具的名字是另一条的前缀时，只按前缀匹配会把「短的红了」记成「长的红了」——
  // 归错功劳换个入口再来一次，而那正是点名要堵的东西
  eq('整行到此为止，算它红了', killsMatched('  ✗ 某条夹具', '某条夹具'), true)
  eq('名字后面跟冒号再说原因，也算它红了', killsMatched('  ✗ 某条夹具：说错了', '某条夹具'), true)
  eq('点的名只是那一行的前缀，不算', killsMatched('  ✗ 某条夹具又长了一截', '某条夹具'), false)
  eq('那一行只是点的名的前缀，也不算', killsMatched('  ✗ 某条夹具', '某条夹具又长了一截'), false)
  eq('打勾的那一行是通过，不是红了', killsMatched('  ✓ 某条夹具', '某条夹具'), false)
  // 自检把「进程级失败」和「断言红了」分开打，为的就是这一条：一条只把被测脚本弄崩的
  // 变异，不该因为那条夹具跟着报了错就算把它杀掉了 —— 那是崩溃的功劳，不是断言的
  // 记号从自检那边引过来，不在这儿再抄一份字面量：抄一份的话，自检改了记号、
  // 这条断言照样绿，而 kills 又开始把崩溃算成抓到
  eq('进程级的失败带记号，不算那条夹具红了',
    killsMatched(`  ✗ 某条夹具${SELFCHECK_PROCESS_MARK}：预期以退出码 0 结束，实际是 1`, '某条夹具'), false)
}

harness('变异的锚点在目标文件里数几处：按起点数，重叠也算')
{
  // 判据在 ADR-99 第十一节：find 必须恰好出现一次。替换只改第一处，所以「出现几处」
  // 要按**起点**数 —— 按不重叠数的话，重叠的那种歧义会被漏成「唯一」
  eq('恰好一处', anchorMatches('const a = 1\nconst b = 2\n', 'const b'), 1)
  eq('一处都没有 —— 那是「锚点失效」，不是唯一', anchorMatches('const a = 1\n', 'const z'), 0)
  eq('两处不重叠', anchorMatches('x = 1\ny = 2\nx = 1\n', 'x = 1'), 2)
  // 'aaa' 里 'aa' 的起点是 0 和 1 两个位置：替换会挑第一个，而作者可能想的是第二个
  eq('两处重叠 —— 仍是两处', anchorMatches('aaa', 'aa'), 2)
  // 跨行的锚点整段比对：两段一模一样就是两处，哪怕中间隔着别的行
  eq('跨行锚点出现两次', anchorMatches('if (x)\n  go()\nmid\nif (x)\n  go()\n', 'if (x)\n  go()'), 2)
  // 空锚点在每个位置都「出现」：长度为 2 的文件有 0、1、2 三个起点
  eq('空锚点在每个起点都出现', anchorMatches('ab', ''), 3)
}

harness('by 与 kills 同进同出：四种写错各有名字')
{
  // 不写这一对的那些逐字保持原样；写全了的也成立
  eq('两个都不写 → 成立', wiringFault({}), undefined)
  eq('两个都写了 → 成立', wiringFault({ by: 'selfcheck', kills: ['某条夹具'] }), undefined)

  // 四种不成立各堵一个坑。判定给的是名字不是一句话 —— 话由入口说（第 10 条）
  eq('验证者的名字不认得', wiringFault({ by: '查无此人', kills: ['某条夹具'] }), 'unknown-verifier')
  eq('指了验证者却没点名', wiringFault({ by: 'selfcheck' }), 'missing-kills')
  eq('点了名却没说谁来验', wiringFault({ kills: ['某条夹具'] }), 'kills-without-by')
  // 缺省那个验证者写出来也一样要点名 —— 不然那个字段写了等于没写
  eq('把缺省的验证者写出来，也要点名', wiringFault({ by: 'test' }), 'missing-kills')
  // JSON 读进来的东西编译期不在场：老写法是个字符串，按一组名字遍历它会逐个字符走一遍，
  // 每个字都得红才算抓到 —— 那条变异从此永远判「红错了地方」，而没有一句话说得出为什么
  eq('kills 写成一个名字（老写法）→ 形状不对', wiringFault({ by: 'selfcheck', kills: '某条夹具' }), 'kills-not-list')
  eq('名单里混进了不是名字的东西 → 形状不对',
    wiringFault({ by: 'selfcheck', kills: ['某条夹具', 3] }), 'kills-not-list')
  // 点了验证者、名单却是空的：判定那边 `every` 对空名单返回真，会一路判成「被抓到」——
  // 一条什么也没点名的变异被记成守住了某条夹具，正是这道闸要拦的
  eq('点了验证者、名单是空的 → 等于没点名', wiringFault({ by: 'selfcheck', kills: [] }), 'missing-kills')

  // 按「原型链上有没有」来认的话，语言内建的那几个名字会被放行，而取出来的根本不是
  // 验证者：判定当场抛，人看见的是一个栈，不是「名字写错了」—— 这道体检唯一该说话的
  // 时候把自己弄哑了（评审指出）。四个内建名字都试，一个都不许放行
  for (const builtin of ['constructor', 'valueOf', 'hasOwnProperty', 'propertyIsEnumerable']) {
    eq(`语言内建的名字不算认得：${builtin}`,
      wiringFault({ by: builtin, kills: ['某条夹具'] }), 'unknown-verifier')
  }
}

harness('豁免那一行开头说的话，要跟变异集对得上')
{
  // 「无变异（显式缺口）」原先写死在入口里。落地 2 第 5 步起它变成假话 ——
  // D6.f 挂着豁免、同时被 M-D6-j 真守着，同一份报告里两句话打架
  eq('有变异写着这个编号 → 说有负片', exemptionCovered('D6.f', [{ req: 'D6.f' }]), true)
  eq('一条变异都没有 → 说无变异', exemptionCovered('D6.f', []), false)
  // 编号要逐字相同：判据比需求细，拿粗的去顶细的正是判据级计量当初要治的那件事
  eq('需求号的变异不算守着它下面那条判据',
    exemptionCovered('D6.f', [{ req: 'D6' }]), false)
  eq('判据号的变异也不算守着整条需求',
    exemptionCovered('D6', [{ req: 'D6.f' }]), false)

  // 短到不带括号：三处报告各自组框（--brief 后接 scope、整跑接冒号、审计接在
  // 它自己那句「显式缺口，不消灭」之后）。带括号的话嵌套起来读不成句
  eq('名下有变异时这么说', exemptionLead(true), '名下有负片')
  eq('没有时这么说', exemptionLead(false), '名下无变异')

  // 同一句话有三处入口在印。mutate 那两处各有自检夹具真跑一遍断言输出；audit 那一处
  // 没有 —— 给它造夹具要把 audit 加进自检的工具表，而那张表同时是隔离判据的种子来源，
  // 闭包会跟着撑大，为一行报告不值。退而求其次扫源码问「还在调吗」，
  // 它挡得住「换回写死的字面量」这个坏法，但证不了印出来的话对（差额记在 ADR-70）
  eq('调了判定就算接着', leadWired('exemptionLead(exemptionCovered(x, y))'), true)
  eq('中间有空白也认', leadWired('exemptionLead( exemptionCovered (x, y))'), true)
  eq('换成写死的字面量 → 断了', leadWired("const lead = '名下无变异'"), false)
  eq('只调一半也不算接着', leadWired('exemptionLead(covered)'), false)
  // 按语法树问，不按字面扫 —— 头一版写成正则，下面这三种它全收：于是真调用删掉、
  // 同一句话留在注释或串里，这几条断言照样绿。同一个洞 labelsOf 上面刚补过，
  // 两次都是评审指出来的
  eq('注释里写着同一句话不算', leadWired('// exemptionLead(exemptionCovered(x, y))'), false)
  eq('串里装着调用的形状也不算',
    leadWired("const s = 'exemptionLead(exemptionCovered(x, y))'"), false)
  eq('别的对象上的同名方法不算', leadWired('other.exemptionLead(exemptionCovered(x, y))'), false)
  // 两个文件、三处调用：手搭的数据证不了真文件里还在调。判定按文件问，mutate 里那两处
  // 断了哪一处它分不出 —— 那两处各有夹具兜着，这里真正独自扛的是 audit 那一处
  for (const f of ['scripts/check/mutate.ts', 'scripts/check/audit.ts']) {
    ok(`${f} 里还有从判定取的豁免行`, leadWired(rf(f, 'utf8')))
  }
}

harness('清册：点的那些夹具真的在，而且各自只有一条叫那个名字')
{
  const D = ['eq', 'ok']
  eq('声明处的字面量进清册', [...labelsOf("eq('甲', 1, 1)", D).keys()], ['甲'])
  eq('同一个名字起过两次，数得出来是两次',
    labelsOf("eq('甲', 1, 1)\nok('甲', true)", D).get('甲'), 2)
  eq('反引号但没插值的也定得下来，算数', [...labelsOf('eq(`甲`, 1, 1)', D).keys()], ['甲'])
  eq('写在块里的调用也收得到 —— 要递归才看得见',
    [...labelsOf("if (x) { eq('甲', 1, 1) }", D).keys()], ['甲'])

  // 清册宁可小：它唯一的用途是「点的这条真的在」，小了是拦住、大了是放行
  eq('转发调用（实参是个变量）不进清册', [...labelsOf('eq(label, 1, 1)', D).keys()], [])
  eq('模板串里带插值的定不下来，不进清册', [...labelsOf('eq(`甲${x}`, 1, 1)', D).keys()], [])
  eq('没写进 declares 的调用不算起名', [...labelsOf("say('甲')", D).keys()], [])
  eq('一个起名的函数都没写 → 清册是空的', labelsOf("eq('甲', 1, 1)", []).size, 0)

  // **按语法树而不是按正则**（评审指出）。正则分不出「真的在调用」与「串里、
  // 注释里写着一句长得像调用的话」—— 而放行方向的坏法正是往任何一份源码里写一句
  // `"eq('幽灵', …)"`，`kills: '幽灵'` 就过得了这道闸。第一版自带一处：本文件里
  // 喂给 labelsOf 的这些测试数据，当时就被数进了 test 的真清册
  eq('串里写着的调用不算 —— 那是一个字符串的值，结构上就不是调用',
    [...labelsOf(`const s = "eq('幽灵', 1, 1)"`, D).keys()], [])
  eq('注释里写着的调用也不算', [...labelsOf("// eq('幽灵', 1, 1)", D).keys()], [])
  eq('别的对象上的同名方法不算', [...labelsOf("obj.eq('甲', 1, 1)", D).keys()], [])

  eq('清册里没有 → 点了个谁也不会打出来的名字', labelFault('甲', new Map()), 'unknown-label')
  eq('只起过一次 → 立得住', labelFault('甲', new Map([['甲', 1]])), undefined)
  eq('起过两次 → 红的是哪一条分不出', labelFault('甲', new Map([['甲', 2]])), 'ambiguous-label')

  // ---- 名单里每一项各查一次 ----
  // 「每一项都要查」是语义。它原先留在入口那道循环里，没有任何负片守得住 ——
  // 改成只查首项的话，当时的测试与三条新负片仍会全绿，后面几项点着不存在的夹具
  // 就此被静默放行（#97 评审指出，CONVENTIONS 第 10 条）
  const inv = new Map([['甲', 1], ['乙', 1], ['丙', 2]])
  eq('都立得住 → 一条也不报', labelFaults(['甲', '乙'], inv), [])
  eq('头一项立得住、后一项不在清册里 → 报后一项',
    labelFaults(['甲', '查无此名'], inv), [{ label: '查无此名', fault: 'unknown-label' }])
  eq('后一项重名也要报', labelFaults(['甲', '丙'], inv), [{ label: '丙', fault: 'ambiguous-label' }])
  eq('两项都立不住 → 两条都报，各带各的名字',
    labelFaults(['查无此名', '丙'], inv),
    [{ label: '查无此名', fault: 'unknown-label' }, { label: '丙', fault: 'ambiguous-label' }])

  // 手搭的数据证不了扫真源码扫不扫得动 —— #85 记的那条欠条就是这个形状
  const selfInv = labelsOf(rf('scripts/check/selfcheck.ts', 'utf8'), VERIFIERS.selfcheck.declares)
  // 点名的是 D6.f 那条收尾夹具：落地 2 第 5 步要写的第一条 kills 正是它，
  // 而它由 endPath 起名 —— 把 endPath 从 declares 里删掉，这一条当场红
  eq('自检的真清册收得到 endPath 起的那几个名字',
    labelFault('collect 关键词跑完（退出码 0）也说续跑代价', selfInv), undefined)
  // **run 那一族起过名，却进不了清册**（评审指出）。它们失败时只打
  // `✗ <名字>（进程）：…` —— killsMatched 认的是 `<名字>` 或 `<名字>：`，对不上；
  // 就算对上了 judgeRun 见了记号也整次判 crashed。登记它们等于放行一批
  // **永远得不到 caught** 的点名，正是这道闸要拦的
  eq('跑一个脚本起的名字进不了清册 —— 它永远满足不了点名',
    labelFault('collect 预算用尽保存断点', selfInv), 'unknown-label')
  // 具名断言那一族也收 —— P3.b 的「保存断点」那一半靠它才点得着（5b）。
  // 把 named 从 declares 里删掉，这一条当场红（M-H24-a）
  eq('自检的真清册也收得到 named 起的名字',
    labelFault('collect 预算用尽后留下的断点记到了中止那一刻', selfInv), undefined)
  // 派生诊断那几十句散文也不进：它们是夹具的后果，不是夹具的名字
  eq('派生诊断不算夹具的名字',
    labelFault('collect 预算用尽后没有留下可读的断点（P3.b 要求捕获后保存断点）', selfInv),
    'unknown-label')
  // 自检里那个临时仓库夹具往磁盘上写了三行起名的调用。**语法树扫法下这条是结构性的**
  // ——那三行在本文件里是一个字符串的值，不是调用；换回正则就又成了活的洞
  eq('夹具往磁盘写的名字没被当成自检自己的声明', labelFault('甲', selfInv), 'unknown-label')
}

})
if (fullRun) {
harness('变异跑到一半被打断：动过的源文件要还回去')
{
  // 信号杀进来时 finally 不跑，留在工作区里的是一处故意违反某条需求的改动。
  // 而下一次 check 报的是「锚点失效」—— 一句指着变异集的话，错的却是上一次没跑完
  let threw = ''
  // 打断完全可能落在还没开始应用变异的那一段：那时盘上本来就是干净的，什么都不该写。
  // 照着一个不存在的现场去写，只会在信号处理里当场抛 —— 还原和退出都做不成
  try { restoreMutation() } catch (e) { threw = (e as Error).message }
  eq('还没开始应用变异就被打断：不抛', threw, '')

  const sigs = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const
  const armedOn = (s: (typeof sigs)[number]) =>
    process.listeners(s).filter(l => l === onInterrupt).length
  restoreOnInterrupt()
  eq('三种打断都接管了 —— Ctrl-C、被杀掉、终端关掉', sigs.filter(s => armedOn(s) === 1).length, 3)
  // 每记一次现场都接管一遍的话，两百个变异会在同一个信号上挂满处理函数，
  // Node 开始刷告警 —— 而那时被盖住的，正是人来看的那份变异结果
  restoreOnInterrupt()
  eq('接管过就不再接管，处理函数不叠', Math.max(...sigs.map(armedOn)), 1)

  const f = join(tmpdir(), `kol-h-restore-${process.pid}.ts`)
  writeFileSync(f, '原文', 'utf8')
  beginMutation(f, '原文')
  writeFileSync(f, '被改坏的', 'utf8')
  restoreMutation()
  eq('被打断时把动过的那份还回去', rf(f, 'utf8'), '原文')

  // 上面几条都在同一个进程里直接调函数：它们证得了「记了现场就还得回去」，
  // 证不了「**信号真的杀进来**的时候还得回去」—— 把还原和非零退出整个从信号处理里
  // 删掉，上面每一条照样绿（评审指出的正是这个缺口）。要证它，只有另起一个进程真挨一刀。
  // 而这一刀要落在**正等着子进程**的那一段：变异跑起来之后几乎所有时间都在那里。
  // 挨刀的时机换成「闲着」，测的就不是这个入口真实的处境（评审第二次指出的正是这个）。
  // 子脚本只调「记现场」和「把这一轮交出去」这两个函数：接管信号要是没跟着记现场走，
  // 这一刀直接把它杀了，还原和退出码两条一起红
  const kid = join(tmpdir(), `kol-h-kid-${process.pid}.ts`)
  const victim = join(tmpdir(), `kol-h-victim-${process.pid}.ts`)
  const waited = join(tmpdir(), `kol-h-waited-${process.pid}.txt`)
  writeFileSync(victim, '原文', 'utf8')
  rmSync(waited, { force: true })            // 上一轮留下的会让这一轮凭空判红
  // 那一轮测试照着入口的真实形状搭：入口手上拿到的是 `npx` 那层壳，真正跑脚本的是
  // 壳再分出去的那一个。所以这里的孙子也再分一个出来，由**它**来说自己还活着 ——
  // 只杀手上那一个的话，壳死了，说话的那个还在，而它跑的正是被改过的源码。
  // 说话走的是继承来的那根管子，它一直不关，等它的那一方就一直收得到
  const printer = `setTimeout(() => console.log('孙子还活着'), 600)`
  const shell = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(printer)}], { stdio: 'inherit' }); process.send('孙子分出来了'); setTimeout(() => {}, 2000)`
  writeFileSync(kid, [
    `import { spawn } from 'node:child_process'`,
    `import { writeFileSync as w } from 'node:fs'`,
    `import { beginMutation, trackTest } from ${JSON.stringify(join(process.cwd(), 'scripts/check/mutate-restore.js'))}`,
    `beginMutation(${JSON.stringify(victim)}, '原文')`,
    `w(${JSON.stringify(victim)}, '被改坏的', 'utf8')`,
    // 除了继承来的那三根，再要一根专门用来回话：孙子说自己还活着走的还是原来那根，两边不混
    `const g = spawn(process.execPath, ['-e', ${JSON.stringify(shell)}], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'], detached: true })`,
    `trackTest(g)`,
    // **动手的时机不能看表。** 上一版是等固定的两百毫秒，可机器一忙，那一刻壳可能还没
    // 把孙子分出来 —— 那时「只杀手上这一个」和「连组一起杀」留下的现场一模一样：
    // 都没有孙子在说话。于是下面那条断言时红时绿，而绿的那一次什么也没证（评审指出）。
    // 改成等它说一声：壳把孙子分出来之后回一句，收到了才动手。
    // 信号还是异步送到的：手上不留一件事，Node 会在处理函数跑起来之前就正常退出，
    // 这一刀等于没挨。手上留的正是「等一个子进程」，挨刀的那一刻它还没等完
    `g.on('message', () => process.kill(process.pid, 'SIGTERM'))`,
    `g.on('close', () => w(${JSON.stringify(waited)}, '等完了', 'utf8'))`,
  ].join('\n'), 'utf8')
  const [exe, argv] = tsxCommand([kid])
  const r = spawnSync(exe, argv, { encoding: 'utf8' })
  eq('真挨一刀：动过的那份还是还回去了', rf(victim, 'utf8'), '原文')
  eq('真挨一刀：这一次检查没跑完，退出码非零', r.status, 1)
  // 还回去了、退出码也对，却是把那个子进程等完了才停 —— 那还是「看上去做了」：
  // 真出事时要等的是一整轮测试，而升级上来的硬杀不会等它等完
  eq('挨刀的那一刻还在等子进程：当场就停，没等完', existsSync(waited), false)
  // 停的得是**整棵树**。父进程退掉不会把那一轮带走 —— 它会被过继出去接着跑，
  // 而它跑的正是被改过的源码，还原完之后它再写一次，盘上留下的就是一份没人审过的东西。
  // 孙子那一层还有一个在说话，就说明这一刀只落在壳上（评审指出的正是这个）
  eq('挨刀之后那一轮测试也停了：没留下一个还在跑的', r.stdout.includes('孙子还活着'), false)

  // 这一刀指得着谁，取决于记着的那一个还算不算数。一轮跑完之后不抹掉，从这一轮结束到
  // 下一轮记上之间那段空档里，记着的是一个已经散了的组号 —— 而组号系统是会重新发给
  // 别人的，那一刀就落到不相干的进程身上（评审指出）。整轮都装着信号处理，空档也整轮都在。
  // 这里拿两个能自己说「我结束了」的替身来问：本文件从头到尾是同步跑的，等不到真子进程结束
  const one = new EventEmitter() as ChildProcess
  const two = new EventEmitter() as ChildProcess
  trackTest(one)
  eq('交出去了：这一轮正被看着', testRunning(), true)
  one.emit('close')
  eq('这一轮跑完了：记着的那一个要抹掉，空档里不留散了的组号', testRunning(), false)
  // 抹的时候要认人。上一轮的结束是迟到送来的，它要是把下一轮刚记上的抹没，
  // 这一刀就落空 —— 而落空和落错一样，都是不响的
  trackTest(two)
  one.emit('close')
  eq('上一轮迟到的结束：不许把下一轮刚记上的抹掉', testRunning(), true)
  two.emit('close')
  eq('轮到它自己结束：这才抹掉', testRunning(), false)

  // 上面证的是「这一刀能被接住」，而它接不接得住取决于入口怎么等子进程：同步等会把
  // 事件循环整个挡住，挡住的那段时间里接管过的信号一次也派发不出去，而变异几乎所有
  // 时间都在等子进程。子脚本是异步等的，替不了入口自己 —— 入口那一侧另判一条
  eq('同步等子进程：撞上了要说出是哪一种', blockingWait('const out = execSync(cmd)'), 'execSync')
  eq('另一种同步等法也认', blockingWait('spawnSync(cmd, args)'), 'spawnSync')
  eq('第三种同步等法也认', blockingWait('execFileSync(cmd)'), 'execFileSync')
  // 只提名字不调用的是散文不是调用 —— 否则连解释这条规矩的那段注释都会把自己判红
  eq('异步等法不算，光提名字也不算', blockingWait("spawn(cmd) // 别写 execSync 那种"), undefined)
  eq('接管了信号的那个入口：没有一处同步等子进程',
    blockingWait(rf('scripts/check/mutate.ts', 'utf8')), undefined)

  // 最后才拆：处理函数里有退出，留在测试进程里会把后面任何一次打断变成静默退出
  for (const s of sigs) process.off(s, onInterrupt)
  for (const p of [f, kid, victim, waited]) rmSync(p, { force: true })
}

harness('派工被打断：先请每个 worker 自己收摊，都收完了再走')
{
  // 派工那一侧自己不改源文件，它欠的是另一样：那几个 worker 各自攥着一处改写和一个正在
  // 跑的验证者，而它们**自成一组、收不到打在派工进程上的那一刀**。直接退掉的话，
  // 那几组会被过继出去接着跑被改过的源码。这里拿能自己说「我停了」的替身来问 ——
  // 本文件从头到尾同步跑，等不到真子进程结束
  const later: { ms: number; fn: () => void }[] = []
  const schedule = (fn: () => void, ms: number) => { later.push({ fn, ms }) }
  const kidOf = () => {
    const k = new EventEmitter() as ChildProcess & { hit: string[] }
    k.hit = []
    k.kill = ((s?: NodeJS.Signals) => { k.hit.push(String(s)); return true }) as ChildProcess['kill']
    return k
  }

  let hard = 0
  stopJobs([], () => { hard++ }, 5000, schedule)
  eq('一个 worker 都没在跑：当场收摊', hard, 1)
  eq('没什么可等的，不必排计时器', later.length, 0)

  hard = 0; later.length = 0
  const w1 = kidOf(); const w2 = kidOf()
  stopJobs([w1, w2], () => { hard++ }, 5000, schedule)
  eq('那一刀要转发给每一个 worker', [w1.hit, w2.hit], [['SIGTERM'], ['SIGTERM']])
  eq('宽限期照说好的排上一次', later.map(l => l.ms), [5000])
  eq('还没停完就不走 —— 走了它们就成了没人看着的孤儿', hard, 0)
  w1.emit('close')
  eq('只停了一个也不走', hard, 0)
  w2.emit('close')
  eq('都停了才走', hard, 1)
  // 两条路都会走到收摊那一步（都停了、或者宽限期到了），而它是删目录加退出
  later.at(0)?.fn()
  eq('收摊至多跑一次 —— 跑两遍时第二遍删的是别人刚建的东西', hard, 1)

  // 等不到的那种：worker 自己卡死。不硬来的话，人看到的是「Ctrl-C 按了没反应」
  hard = 0; later.length = 0
  const stuck = kidOf()
  stopJobs([stuck], () => { hard++ }, 5000, schedule)
  eq('卡死的那个也收到了那一刀', stuck.hit, ['SIGTERM'])
  later.at(0)?.fn()
  eq('宽限期到了硬来，不陪着它一起挂', hard, 1)
}

}
await group('h-jobs', () => {
harness('变异跑的派工：派几个、结论怎么带回来、派出去没回话的怎么算')
{
  // 都没写就按机器核数；再按要跑的条数收口 —— 派得比变异还多，多出来那几个只是白起进程
  eq('都没写：按机器核数', jobsWanted([], undefined, 8, 100), 8)
  eq('比要跑的条数还多：按条数收口', jobsWanted([], undefined, 8, 3), 3)
  eq('明写的也一样收口', jobsWanted([], '9', 8, 3), 3)
  eq('单核机器：一个，也就是串行那条路', jobsWanted([], undefined, 1, 100), 1)
  eq('环境变量说了算', jobsWanted([], '2', 8, 100), 2)
  eq('命令行压环境变量 —— 临时改一次不该要求先改环境',
    jobsWanted(['--jobs=3'], '2', 8, 100), 3)
  // 读不出来要说读不出来。悄悄按核数跑，等于把一个写错的配置当成没写
  eq('读不出来的值：说不清要派几个', jobsWanted([], 'abc', 8, 100), undefined)
  eq('零个不成立', jobsWanted([], '0', 8, 100), undefined)
  eq('负数不成立', jobsWanted([], '-1', 8, 100), undefined)
  eq('小数不成立', jobsWanted(['--jobs=2.5'], undefined, 8, 100), undefined)

  // 汇报行：写下去再读回来，五种结论一个不丢。两边各写一份格式的话，
  // 改一边不改另一边的症状是「每一条都没回话」，而人会去翻变异集，不会去翻这个格式
  const ran = (outcome: Outcome, over: Partial<Ran> = {}): Ran =>
    ({ outcome, status: 1, stopped: false, output: '', ms: 0, ...over })
  for (const o of ['caught', 'elsewhere', 'crashed', 'survived', 'not-applied'] as const) {
    eq(`结论「${o}」写下去读回来还是它`, parseReport(reportLine('M-X-a', ran(o))),
      { id: 'M-X-a', ...ran(o) })
  }
  // 退出码那一栏要分得开「被信号杀掉」和「退出码 0」—— 压成一个值就是把三档压成两档
  eq('被信号杀掉那一次：退出码是 null，不是 0',
    parseReport(reportLine('M-X-a', ran('crashed', { status: null })))?.status, null)

  // **现场只有 crashed 那一档带回来。** 另外四档各带一份完整输出要从管道里挤过去，
  // 而除了那一档没人读它
  eq('跑不起来那一档：现场带回来了',
    parseReport(reportLine('M-X-a', ran('crashed', { output: '验证者说的话' })))?.output, '验证者说的话')
  eq('别的档不带现场',
    parseReport(reportLine('M-X-a', ran('caught', { output: '验证者说的话' })))?.output, '')
  // 现场是多行的，而这条线按行读 —— 拼出来的话第一个换行就把一行劈成两行
  eq('多行的现场仍然只占一行',
    reportLine('M-X-a', ran('crashed', { output: '第一行\n第二行' })).split('\n').length, 1)
  eq('劈不开的那一行读回来还是原样',
    parseReport(reportLine('M-X-a', ran('crashed', { output: '第一行\n第二行' })))?.output,
    '第一行\n第二行')

  // 认不出的一律 undefined。兜底成「抓到」的话，一条崩掉的变异会安静地记成被抓到。
  // **每个字段各验一次**：只验到「是个对象」为止的话，一份 status 是字符串、output
  // 缺失的行会通过这一关，然后在报告里被当成现场去印
  const wire = (o: unknown) => `⟦结论⟧ ${JSON.stringify(o)}`
  // 「认不出」的说法是**交回 undefined**，不是当场抛出去：这条线上一行读不出来就掀桌，
  // 掀掉的是整跑那一大批，而抛出去那一次连自己是哪一行都说不出
  const read = (line: string) => {
    try { return parseReport(line) } catch (e) { return `抛了：${String(e)}` }
  }
  // 计时（ms）是汇报行的第六栏：样本行按新契约带上它，而且用非零的数 ——
  // 桩与「锚点失效没跑」写的都是 0，拿 0 当样本验不出「读回来的是写下去的那个」
  const good = { id: 'M-X-a', outcome: 'caught', status: 1, stopped: false, output: '', ms: 1234 }
  eq('好的那一行认得', parseReport(wire(good)), good)
  eq('不是汇报行的：认不出', parseReport('  ✓ M-X-a  [X1] 被抓到'), undefined)
  eq('记号后面不是合法 JSON：认不出', parseReport('⟦结论⟧ caught M-X-a'), undefined)
  eq('记号后面是 null：认不出，不是抛出去', read('⟦结论⟧ null'), undefined)
  eq('结论那个词不认得：认不出，不猜', parseReport(wire({ ...good, outcome: 'ok' })), undefined)
  eq('没有编号：认不出', parseReport(wire({ ...good, id: '' })), undefined)
  eq('退出码是串：认不出', parseReport(wire({ ...good, status: '1' })), undefined)
  // 这两行都带上计时：只少它们自己那一栏。不带的话，「少了计时」一样让它们认不出，
  // 把「停没停」「现场」那两道验拿掉，这两条照样绿 —— 判据被无关的东西满足了
  eq('少了停没停那一栏：认不出',
    parseReport(wire({ id: 'M-X-a', outcome: 'caught', status: 1, output: '', ms: 1234 })), undefined)
  eq('少了现场那一栏：认不出',
    parseReport(wire({ id: 'M-X-a', outcome: 'caught', status: 1, stopped: false, ms: 1234 })), undefined)

  // ── 计时那一栏（Ran.ms）。契约：「ms 须是有限、非负的数，否则认不出」；它和别的字段一样
  // 要穿过 worker 的进程边界，所以写下去读回来必须还是原值 —— 读回一个 0 的话，账单上那个
  // 乘法乘的就是 0，而人看到的是「这个验证者不花钱」
  // 写的那一半单独验一次（不经 parseReport）：往返红了的时候，分得清是没写进去还是没读出来
  eq('计时写进了汇报行（1234 毫秒）', (() => {
    const line = reportLine('M-X-a', ran('caught', { ms: 1234 }))
    try { return (JSON.parse(line.slice('⟦结论⟧ '.length)) as { ms?: unknown }).ms } catch (e) { return `抛了：${String(e)}` }
  })(), 1234)
  eq('计时写下去读回来还是原值（1234 毫秒）',
    read(reportLine('M-X-a', ran('caught', { ms: 1234 }))), { id: 'M-X-a', ...ran('caught', { ms: 1234 }) })
  // 契约只说「有限、非负的数」，没说整数：墙钟量出来带小数是常态，不许被拒、也不许被取整
  eq('带小数的计时照样认得、原样读回（1234.5 毫秒）',
    read(reportLine('M-X-a', ran('caught', { ms: 1234.5 }))), { id: 'M-X-a', ...ran('caught', { ms: 1234.5 }) })
  // 契约：点名的都红了、被主动停掉的那几条，量到停下为止 —— 那个数也要带回来
  eq('被主动停掉的那一条：计时照样带回来（8765 毫秒）',
    read(reportLine('M-X-a', ran('caught', { stopped: true, ms: 8765 }))),
    { id: 'M-X-a', ...ran('caught', { stopped: true, ms: 8765 }) })
  eq('跑不起来那一档：现场和计时一起带回来',
    read(reportLine('M-X-a', ran('crashed', { output: '验证者说的话', ms: 4321 }))),
    { id: 'M-X-a', ...ran('crashed', { output: '验证者说的话', ms: 4321 }) })
  // 「非负」含 0：锚点失效没跑的那条写的就是 0，把 0 拒掉等于把 not-applied 那一档整个弄丢
  eq('计时是 0：认得（非负含 0）', read(wire({ ...good, ms: 0 })), { ...good, ms: 0 })
  eq('少了计时那一栏：认不出',
    read(wire({ id: 'M-X-a', outcome: 'caught', status: 1, stopped: false, output: '' })), undefined)
  eq('计时是串：认不出，不替它转成数', read(wire({ ...good, ms: '1234' })), undefined)
  eq('计时是负数：认不出', read(wire({ ...good, ms: -1 })), undefined)
  eq('计时是 null：认不出', read(wire({ ...good, ms: null })), undefined)
  // NaN／Infinity 在 JSON 里写不出来：`JSON.stringify` 把它们写成 null（汇报行整份是 JSON，
  // `reportLine` 的说明写着）。所以写的一侧真交了个 NaN／Infinity，线上走的是 null ——
  // 读回来必须认不出，不能变成一个 0 或别的数混进账里
  eq('写的一侧交了 NaN：线上是 null，读回来认不出',
    read(reportLine('M-X-a', ran('caught', { ms: NaN }))), undefined)
  eq('写的一侧交了 Infinity：线上是 null，读回来认不出',
    read(reportLine('M-X-a', ran('caught', { ms: Infinity }))), undefined)
  // 读的一侧：JSON 文本 `1e999` 合法，而 `JSON.parse` 把它读成 Infinity —— 这是线上唯一
  // 能进来的非有限数，只能手写这一行（`wire` 过 `JSON.stringify`，写不出它）。
  // **NaN 不测**：没有任何一段 JSON 文本会被 `JSON.parse` 读成 NaN，线上进不来
  const infLine = '⟦结论⟧ {"id":"M-X-a","outcome":"caught","status":1,"stopped":false,"output":"","ms":1e999}'
  ok('（夹具自检）手写的那一行里，计时读出来确实是 Infinity',
    (JSON.parse(infLine.slice('⟦结论⟧ '.length)) as { ms: unknown }).ms === Infinity)
  eq('计时是无穷大（JSON 文本 1e999）：认不出', read(infLine), undefined)

  // 「不是汇报行」和「是汇报行但读不出来」对读的人是同一件事，**对派工那一侧不是**：
  // 前者是验证者漏出来的闲话，跳过就行；后者意味着那一条不会有结论了，而 worker 正等着
  // 下一个编号 —— 不收摊它就永远等下去，整跑挂住，连核账那一步都走不到（而模块承诺的
  // 是硬失败）。所以这一问要分得开，`parseReport` 交回 undefined 分不开
  eq('好的那一行：认得是在汇报', looksLikeReport(reportLine('M-X-a', ran('caught'))), true)
  eq('带记号但读不出来的：仍然算在汇报', looksLikeReport('⟦结论⟧ 这不是 JSON'), true)
  eq('验证者漏出来的闲话：不算在汇报', looksLikeReport('  ✓ 某条夹具'), false)
  eq('光有记号没有空格：不算', looksLikeReport('⟦结论⟧'), false)

  // 派出去却没回话的，是「没查过」，不是通过（process/README.md 总纲的第三档）
  eq('少了谁就报谁，按派出去的顺序',
    missingVerdicts(['M-a', 'M-b', 'M-c'], new Set(['M-b'])), ['M-a', 'M-c'])
  eq('都回话了就没有欠账', missingVerdicts(['M-a', 'M-b'], new Set(['M-a', 'M-b'])), [])

  // 哪些文件进得了 worker 的那份副本。错一格不是跑得慢，是密钥被复制出去
  // （`docs/CONVENTIONS.md` 第 10 条：走文件树那一半也是判定）
  eq('装不下的那几个：不带', copyIntoWorker('node_modules'), false)
  eq('会把自己复制进自己的：不带', copyIntoWorker('.check-cache'), false)
  eq('源文件：带', copyIntoWorker('scripts/check/a.ts'), true)
  eq('`.env` 本人：不带', copyIntoWorker('.env'), false)
  eq('`.env.local`：不带 —— 逐字比认不出它，这一条正是手抄本漂掉的那个',
    copyIntoWorker('.env.local'), false)
  eq('受跟踪的 `.env.example` 也不带 —— 有意的，没有代码从盘上读它',
    copyIntoWorker('.env.example'), false)
  eq('认的是文件名那一节，不是整条路径', copyIntoWorker('a/b/.env.local'), false)
  eq('名字里带 env 但不在开头：照带', copyIntoWorker('my.env.ts'), true)
  eq('逐字那张表不按前缀 —— `outputs` 不是 `output`', copyIntoWorker('outputs'), true)

  // `spawn` 交回来的对象起没起来。不先问这一句，报出来的原因会指向派工代码
  eq('连管道都没装上：没起来', noStdio({ stdin: undefined }), true)
  eq('压根没有这一栏：没起来', noStdio({}), true)
  eq('明写着空：没起来', noStdio({ stdin: null }), true)
  eq('管道在：起来了', noStdio({ stdin: { write: () => true } }), false)

  // 没起来的那个不许发信号：对 pid 是 undefined 的调 kill，那一刀落在自己这组上
  eq('压根没有号：没起来，不许发信号', neverStarted({}), true)
  eq('号是 undefined：同上', neverStarted({ pid: undefined }), true)
  eq('有号：起来了，可以发', neverStarted({ pid: 4321 }), false)

  // 该对谁发信号：整个筛子在判定里，入口只剩「遍历它交回来的那些」——
  // 守卫留在入口里的话，删掉那一句上面三条照样绿（#112 第二轮评审指出）
  eq('起来了的都要', signalTargets([{ pid: 1 }, { pid: 2 }]).length, 2)
  eq('没起来的一个都不要', signalTargets([{ pid: 1 }, {}, { pid: 2 }]).map(k => k.pid), [1, 2])
  eq('一个都没起来：空手', signalTargets([{}, { pid: undefined }]), [])

  // ── 验证者那一组的号：从 worker 传到派工进程（ADR-74）

  // 号文件搁哪。是 `w<i>/` 的兄弟不是它的孩子 —— 那个目录会被复制、是验证者的 cwd、
  // 还是收尾要删的目标；名字里带派工进程的号，另一跑留下的路径就对不上
  eq('号文件是隔离目录的兄弟，不在它里面',
    beaconPathOf('.cache/jobs', 777, 3), '.cache/jobs/w3.777.verifier')
  ok('不落进 w<i>/ 那棵被复制的树',
    !beaconPathOf('.cache/jobs', 777, 3).startsWith('.cache/jobs/w3/'))
  ok('两跑的路径不一样 —— 并发两跑不会读到对方的号',
    beaconPathOf('j', 1, 0) !== beaconPathOf('j', 2, 0))

  // 这一跑有没有人收号。空值那一种要挡：worker 会去写一个空路径，抛在 close 监听器里，
  // 那一轮的还原整个不跑，被改过的源文件留在工作区
  eq('没有那个参数：没人收', beaconFrom(['--worker']), undefined)
  eq('有：收在那儿', beaconFrom(['--worker', `${BEACON_FLAG}/tmp/a.verifier`]), '/tmp/a.verifier')
  eq('参数在但值是空的：当没人收，不去写空路径', beaconFrom([`${BEACON_FLAG}`]), undefined)
  eq('出现两次：取头一个', beaconFrom([`${BEACON_FLAG}a`, `${BEACON_FLAG}b`]), 'a')

  // worker 侧留号的整个筛子。没人收不留；验证者压根没起来也不留 ——
  // 留了也只是一行 undefined 字样，读回来是「该杀谁不知道」，那比没有号更糟：它看起来像有
  eq('没人收：不留', beaconNote(undefined, 4321), undefined)
  eq('验证者没起来：不留 —— 不许把 undefined 写成一个号', beaconNote('/tmp/a', undefined), undefined)
  eq('正常：留在那儿，带结束符', beaconNote('/tmp/a', 4321), { path: '/tmp/a', text: '4321\n' })
  ok('结束符是格式的一部分，读的那一半据此认「写完了没有」',
    (beaconNote('/tmp/a', 4321) as { text: string }).text.endsWith('\n'))

  // 抹号和留号一样是判定，必须成对住在判定里 —— 留在入口写成裸的 rmSync(undefined) 的话，
  // 串行那条路当场 ERR_INVALID_ARG_TYPE，抛在 close 监听器里，还原整个不跑
  eq('没人收：没有要抹的', beaconGone(undefined), undefined)
  eq('有人收：抹它', beaconGone('/tmp/a'), '/tmp/a')

  // 自己那一组的号。比 pid 是假守卫 —— 实测 shell 底下 pgid ≠ pid，那一条永不命中
  eq('正常一行：取 pgrp 那一段', ownGroup('27331 (node) S 27324 27320 27319 0 -1'), 27320)
  eq('comm 里带空格：从最后一个 `)` 之后切才对',
    ownGroup('10 (node foo bar) S 9 8 7 0'), 8)
  eq('comm 里带右括号：同上', ownGroup('10 (a)b) S 9 8 7 0'), 8)
  eq('垃圾串：拿不到，不猜', ownGroup('garbage'), undefined)
  eq('切完没东西：拿不到', ownGroup('10 (x)'), undefined)

  // 读一份号，算出可以原样交给 process.kill 的那个负数。这是整条改动里最危险的一格
  const me = { pid: 4321, pgid: 4300 }
  eq('没有号：不发', groupShot(undefined, me), undefined)
  eq('空的：不发', groupShot('', me), undefined)
  eq('没有结束符 —— 写到一半的 12345 被截成 1234，那是杀错一整组',
    groupShot('12345', me), undefined)
  eq('0：POSIX 里打的是调用者自己这一组，而 JS 里 -0 === 0', groupShot('0\n', me), undefined)
  eq('1：kill(-1) 不是「1 号那一组」，是发给发得出的每一个进程', groupShot('1\n', me), undefined)
  eq('负数：不发', groupShot('-5\n', me), undefined)
  eq('十六进制 —— Number 认它，往返核对不认', groupShot('0x10\n', me), undefined)
  eq('科学记数法：同上', groupShot('1e3\n', me), undefined)
  eq('前导零：同上', groupShot('007\n', me), undefined)
  eq('带空白：同上', groupShot(' 12\n', me), undefined)
  eq('超出安全整数：不发', groupShot('9007199254740993\n', me), undefined)
  eq('正好是自己的 pid：不发', groupShot('4321\n', me), undefined)
  eq('正好是自己那一组 —— 真正的自杀向量', groupShot('4300\n', me), undefined)
  eq('正常：交回负数，入口一处算术都不做', groupShot('12345\n', me), -12345)
  eq('拿不到自己那一组时，那一格就是没守', groupShot('4300\n', { pid: 4321 }), -4300)

  // 硬来那一步的整张计划。顺序契约就守在这里（M-H40-g / M-H40-h）
  const slotsOf = (...xs: { pid?: number; beacon: string }[]) =>
    xs.map(x => ({ kid: { pid: x.pid }, beacon: x.beacon }))
  const reads = (m: Record<string, { text?: string; error?: string }>) =>
    (path: string) => m[path] ?? {}
  const plan1 = hardStopPlan(
    slotsOf({ pid: 11, beacon: 'b0' }, { pid: 12, beacon: 'b1' }),
    reads({ b0: { text: '900\n' }, b1: { text: '901\n' } }), me)
  // **只数各档出几步,不钉壳与组的先后。** `jobs-rule.ts` 那段逐字写着「① 与 ② 的先后
  // 买不到任何东西」,`ARCHITECTURE.md` 登记的契约也只有「组 → 删目录」那一段 ——
  // 在这里钉死顺序,等于让测试替那张表许一个它没许的承诺(#116 第七轮评审指出)
  const steps = (p: readonly { do: string }[], d: string) => p.filter(s => s.do === d).length
  eq('每个起来了的壳一刀', steps(plan1, 'kid'), 2)
  eq('每个读得出的组一刀', steps(plan1, 'group'), 2)
  eq('删目录只有一步', steps(plan1, 'sweep'), 1)
  ok('删目录是最后一项 —— 排到前面的话，刀落下之前验证者还能往一棵正在被删的树里写，'
     + '而诊断已经说过收干净了',
    plan1[plan1.length - 1].do === 'sweep')
  ok('组那几刀一律带负号且不是 -1',
    plan1.filter(s => s.do === 'group').every(s => (s as { shot: number }).shot < -1))
  eq('两个 worker 报了同一个号：只挨一刀',
    hardStopPlan(slotsOf({ pid: 11, beacon: 'b0' }, { pid: 12, beacon: 'b1' }),
      reads({ b0: { text: '900\n' }, b1: { text: '900\n' } }), me)
      .filter(s => s.do === 'group').length, 1)
  eq('没起来的壳不出刀 —— 对 pid 是 undefined 的调 kill，那一刀落在自己这组上',
    hardStopPlan(slotsOf({ beacon: 'b0' }), reads({}), me).filter(s => s.do === 'kid').length, 0)
  eq('没有号文件（那个 worker 没起验证者）：一句话都不说',
    hardStopPlan(slotsOf({ pid: 11, beacon: 'b0' }), reads({}), me)
      .filter(s => s.do === 'warn').length, 0)
  const plan2 = hardStopPlan(slotsOf({ pid: 11, beacon: 'b0' }),
    reads({ b0: { error: 'EMFILE' } }), me)
  eq('号读不动：出一句话 —— 「没量成」不许压成「量出来是零」',
    plan2.filter(s => s.do === 'warn').length, 1)
  eq('读不动的那个不出组刀', plan2.filter(s => s.do === 'group').length, 0)
  ok('那句话要指得出是哪一份读不动',
    (plan2.find(s => s.do === 'warn') as { text: string }).text.includes('b0'))
  // 号在、却认不得：确实起过一个验证者而我们不知道该收谁 —— 不许压成「压根没有号」
  const plan3 = hardStopPlan(slotsOf({ pid: 11, beacon: 'b0' }),
    reads({ b0: { text: '12345' } }), me)   // 写了一半，没有结束符
  eq('号写了一半：出一句话，不许当成「没起验证者」',
    plan3.filter(s => s.do === 'warn').length, 1)
  eq('认不出的号不出组刀 —— 宁可不发，也不对着一个猜出来的号开刀',
    plan3.filter(s => s.do === 'group').length, 0)
  eq('不是个号（垃圾串）：同样出一句话',
    hardStopPlan(slotsOf({ pid: 11, beacon: 'b0' }), reads({ b0: { text: 'x\n' } }), me)
      .filter(s => s.do === 'warn').length, 1)
  eq('号正好是自己那一组：拒了之后也要出一句话，不能悄悄当没有',
    hardStopPlan(slotsOf({ pid: 11, beacon: 'b0' }), reads({ b0: { text: '4300\n' } }), me)
      .filter(s => s.do === 'warn').length, 1)
  ok('话排在删目录之前，不然会被「隔离目录没收干净」那句盖掉',
    plan2.findIndex(s => s.do === 'warn') < plan2.findIndex(s => s.do === 'sweep'))
  // 拿等价的数组跑一遍做对照,不写死那一串 —— 同上,这里要测的是「只遍历一次」
  eq('传生成器和传数组结果一样 —— slots 只遍历一次',
    hardStopPlan((function* () { yield { kid: { pid: 11 }, beacon: 'b0' } })(),
      reads({ b0: { text: '900\n' } }), me).map(s => s.do),
    hardStopPlan(slotsOf({ pid: 11, beacon: 'b0' }),
      reads({ b0: { text: '900\n' } }), me).map(s => s.do))
  eq('一个都没有：空手', signalTargets([]), [])
}

// 独立于实现写成：期望只出自 `verifierBill`／`billLines`／`BillRow` 的说明（ADR-99 第八节那张
// 「不打那个乘法」的欠条、第十三节的更正），函数体此时只会抛「尚未实现」。数全是手算的，推导写在旁边。
harness('变异跑的账：每个验证者被几条变异用、每条跑多久，它每慢 1 秒整跑多几秒')
{
  // 实现之前函数体会抛；接住它，让每一条各自红，而不是整个文件在第一条上崩掉
  const tryIt = <T>(f: () => T): T | 'threw' => { try { return f() } catch { return 'threw' } }
  const t = (verifier: string, ms: number) => ({ verifier, ms })
  const byName = ([a]: [string, unknown], [b]: [string, unknown]) => (a < b ? -1 : a > b ? 1 : 0)
  // 按验证者名字摆好再比：分组对不对和排序对不对各验各的，一处错不连累另一处
  const per = (timed: readonly { verifier: string; ms: number }[], pick: (r: BillRow) => unknown) =>
    tryIt(() => Object.fromEntries(verifierBill(timed).map(r => [r.verifier, pick(r)] as [string, unknown]).sort(byName)))
  // 只取四栏、按固定顺序摆：`eq` 比的是 JSON 串，键的先后不该让一份对的实现红
  const rowOf = (r: BillRow) => ({ verifier: r.verifier, count: r.count, totalMs: r.totalMs, meanMs: r.meanMs })

  // 三个验证者，交错着给（名字只是串，谁都行；缺省那个叫 test）：
  //   test      1000 + 2000 + 2000 + 3000 = 8000，4 条，平均 8000 / 4 = 2000
  //   selfcheck 5000                      = 5000，1 条，平均 5000 / 1 = 5000
  //   smoke      400 +  600               = 1000，2 条，平均 1000 / 2 = 500
  // 这组数让几种错的排法各排出一个不同的顺序：
  //   按合计从大到小（契约）test, selfcheck, smoke
  //   按条数 test, smoke, selfcheck · 按平均 selfcheck, test, smoke
  //   按名字、按头一回出现 selfcheck, smoke, test
  const timed = [t('selfcheck', 5000), t('smoke', 400), t('test', 1000), t('test', 2000),
    t('smoke', 600), t('test', 2000), t('test', 3000)]
  eq('按验证者分组：三个验证者，一个一行，不多不少',
    tryIt(() => verifierBill(timed).map(r => r.verifier).sort()), ['selfcheck', 'smoke', 'test'])
  eq('条数：每个验证者被用了几次（selfcheck 1、smoke 2、test 4）',
    per(timed, r => r.count), { selfcheck: 1, smoke: 2, test: 4 })
  eq('合计：各自那几条的毫秒数加起来（5000、400+600、1000+2000+2000+3000）',
    per(timed, r => r.totalMs), { selfcheck: 5000, smoke: 1000, test: 8000 })
  eq('平均 = 合计 / 条数（5000/1、1000/2、8000/4）',
    per(timed, r => r.meanMs), { selfcheck: 5000, smoke: 500, test: 2000 })
  eq('合计大的排前面：test 8000 > selfcheck 5000 > smoke 1000 —— 不按条数、不按平均、不按先来后到',
    tryIt(() => verifierBill(timed).map(r => r.verifier)), ['test', 'selfcheck', 'smoke'])
  eq('整张账逐栏对得上',
    tryIt(() => verifierBill(timed).map(rowOf)), [
      { verifier: 'test', count: 4, totalMs: 8000, meanMs: 2000 },
      { verifier: 'selfcheck', count: 1, totalMs: 5000, meanMs: 5000 },
      { verifier: 'smoke', count: 2, totalMs: 1000, meanMs: 500 },
    ])
  // 契约写的是「totalMs / count」，没说取整：100 + 101 = 201，2 条，平均 100.5
  // （向下取整会是 100，四舍五入会是 101）
  eq('平均不取整：(100 + 101) / 2 = 100.5',
    tryIt(() => verifierBill([t('test', 100), t('test', 101)]).map(rowOf)),
    [{ verifier: 'test', count: 2, totalMs: 201, meanMs: 100.5 }])
  // 三个合计一样大（都是 3000），按名字从小到大排：alpha, beta, gamma。
  //   alpha 1500 × 2（平均 1500）· beta 1000 × 3（平均 1000）· gamma 3000 × 1（平均 3000）
  // 给的顺序倒着来（gamma 先出现）；这样按先来后到、按条数（两个方向）、按平均（两个方向）、
  // 按名字倒序，排出来都不是 alpha, beta, gamma
  eq('合计一样大时按名字：alpha, beta, gamma',
    tryIt(() => verifierBill([t('gamma', 3000), t('beta', 1000), t('alpha', 1500), t('beta', 1000),
      t('alpha', 1500), t('beta', 1000)]).map(r => r.verifier)), ['alpha', 'beta', 'gamma'])
  eq('没有输入：交回空数组', tryIt(() => verifierBill([])), [])

  // ── 账单怎么印。两行，按 verifierBill 会交出来的顺序给（合计大的在前），
  // 所以「第几行对第几个验证者」不管它照原样印还是再按合计排一遍都成立。
  // 数是手挑的，count × meanMs = totalMs 对得上：
  //   selfcheck 3 条 × 20000 ms = 60000 ms；平均 20000 ms = 20 秒 → 一位小数「20.0」（整数也要印出那一位）
  //   test      7 条 ×  1276 ms =  8932 ms；平均 1276 ms = 1.276 秒 → 一位小数「1.3」（往上进：
  //             截断印「1.2」，不取整印「1.276」，忘了换成秒印「1276」—— 都对不上）
  // 条数 3、7 这两个数字在各自那行的平均、合计里都不会单独出现，数得出它印了几次
  const rows: BillRow[] = [
    { verifier: 'selfcheck', count: 3, totalMs: 60000, meanMs: 20000 },
    { verifier: 'test', count: 7, totalMs: 8932, meanMs: 1276 },
  ]
  const lines = () => billLines(rows)
  // 一个数单独出现：前面不是数字或小数点，后面不是数字（所以「1.3」认不了「1.30」「11.3」）
  const alone = (n: string) => new RegExp(`(?<![\\d.])${n.replace('.', '\\.')}(?!\\d)`, 'g')
  eq('每个验证者一行：两行账印两行', tryIt(() => lines().length), 2)
  eq('每一行真是一行：不含换行', tryIt(() => lines().map(l => l.includes('\n'))), [false, false])
  eq('每一行写出它那个验证者的名字', tryIt(() => lines().map((l, i) => l.includes(rows[i].verifier))), [true, true])
  // 锚在「平均每条 」后面：只数「这个数出现过」的话，平均和合计对调、或者合计恰好印成同一个数，一样满足
  const after = (label: string, n: string) => new RegExp(`${label} ${n.replace('.', '\\.')}(?!\\d)`)
  eq('平均每条几秒，保留一位小数：20000 ms → 20.0',
    tryIt(() => after('平均每条', '20.0').test(lines()[0])), true)
  eq('平均每条几秒，保留一位小数：1276 ms → 1.3（不是 1.2、不是 1.276）',
    tryIt(() => after('平均每条', '1.3').test(lines()[1])), true)
  // 契约：逐条合计四舍五入到整秒，另附约几分钟、一位小数
  //   60000 ms = 60 秒 = 1.0 分钟（整数也要印出那一位）
  //    8932 ms = 8.932 秒 → 9（截断会印 8，忘了换成秒会印 8932）；= 0.14887 分钟 → 0.1
  eq('逐条合计几秒，四舍五入到整秒：60000 ms → 60',
    tryIt(() => after('逐条合计', '60').test(lines()[0])), true)
  eq('逐条合计几秒，四舍五入到整秒：8932 ms → 9（不是 8、不是 8932）',
    tryIt(() => after('逐条合计', '9').test(lines()[1])), true)
  eq('约几分钟，保留一位小数：60000 ms → 约 1.0 分钟',
    tryIt(() => lines()[0].includes('约 1.0 分钟')), true)
  eq('约几分钟，保留一位小数：8932 ms → 约 0.1 分钟',
    tryIt(() => lines()[1].includes('约 0.1 分钟')), true)
  // 契约：不写成等式。test 那行正是对不上的那种：7 × 1.3 = 9.1，而合计印的是 9
  eq('不写成等式：两行都不带「=」',
    tryIt(() => lines().map(l => l.includes('='))), [false, false])
  // 契约把「条数」和那个乘法列成两样：条数本身印一次，乘法里又出现一次，所以至少两次
  eq('条数写出来了：3 条那行里「3」单独出现至少两次（条数一次、乘法一次）',
    tryIt(() => (lines()[0].match(alone('3')) ?? []).length >= 2), true)
  eq('条数写出来了：7 条那行里「7」单独出现至少两次（条数一次、乘法一次）',
    tryIt(() => (lines()[1].match(alone('7')) ?? []).length >= 2), true)
  // 契约原文：「它每慢 1 秒，整跑串行多 <条数> 秒」—— 乘数是条数，不是平均（20、1.3）、不是合计
  eq('那个乘法：selfcheck 每慢 1 秒，整跑串行多 3 秒',
    tryIt(() => lines()[0].includes('每慢 1 秒，整跑串行多 3 秒')), true)
  eq('那个乘法：test 每慢 1 秒，整跑串行多 7 秒',
    tryIt(() => lines()[1].includes('每慢 1 秒，整跑串行多 7 秒')), true)
  eq('没有行：交回空数组，什么都不印', tryIt(() => billLines([])), [])
}

})
await group('h-infra-rules', () => {
harness('起 tsx 的那条命令：三处共用一份，不经 npx、不经 shell')
{
  const args = ['scripts/probe.ts', '--config', 'x.json']
  const [exe, argv] = tsxCommand(args)

  // 起的是**正在跑这个进程的那个 node**：不经 PATH，子进程的版本不会和父进程错开。
  // 更要紧的是另外两条路在 Windows 上根本起不来 —— `npx` 是 `npx.cmd`，而 `.cmd` 不带
  // shell 起不来；`node_modules/.bin/tsx` 无扩展名，libuv 只试 `tsx.com` / `tsx.exe`，
  // 而 npm 在那边生成的是 `tsx.cmd` / `tsx.ps1` / `tsx`(sh shim)（ADR-69 第一块欠条）
  eq('起的是当前这个 node', exe, process.execPath)

  // cli 走 tsx 包的**公开导出**（它的 exports 里有 "./cli"），不写死 `node_modules/tsx/dist/…`
  // 那种内部路径，也不指 `.bin` 里那个垫片 —— 写死的那种升一次版就指空
  eq('垫在最前面的是 tsx 那个公开导出解析出来的 cli',
    argv[0], createRequire(import.meta.url).resolve('tsx/cli'))
  // 断的是**绝对路径**这一半：相对的那种才会随 cwd 变，而自检有几处切到临时目录里跑。
  // 「切过去再调一次、结果不变」那样的断言写不得 —— 那个常量在 import 阶段就求值一次，
  // 之后怎么切都不会变，那条断言永远不会红（`4-VERIFY.md`：不会失败的检查等于没有检查）
  ok('而且是一条真的绝对路径', isAbsolute(argv[0]) && existsSync(argv[0]))

  // 要跑的那几个原样跟在后面。少一个或顺序反了，起来的就不是要跑的那个脚本，
  // 而那时的样子是「跑起来了、结论不对」，不是「起不来」
  eq('要跑的那几个参数原样跟在 cli 后面', argv.slice(1), args)
}

harness('验证基础设施闭包：一条变异改的是不是验证者自己要用的东西')
{
  // ---- 三种边里，import 之外那两种 ----
  // 种子这份清单**就是行为**：自检从 SELFCHECK_TOOLS 起工具，闭包从同一份取种子。
  // 上一版是扫源码猜哪些路径是工具，评审两轮各找到一批诱饵（注释里的、夹具串里的、
  // 串里装着调用形状的、以及普通的读文件）—— 收紧正则是军备竞赛，让清单成为行为才是根治。
  eq('种子 = 自检自己 ＋ 它当工具起的 ＋ 它预加载的', SELFCHECK_SEEDS, [
    'scripts/check/fake-fetch.ts', 'scripts/check/mutate.ts', 'scripts/check/selfcheck.ts',
  ])
  // 预加载单独列，因为它既不是 import 也不是「起了谁」—— 两种扫法都收不到
  ok('预加载那一份在种子里', SELFCHECK_SEEDS.includes(`scripts/${SELFCHECK_PRELOAD}`))
  ok('三个工具一个不少', Object.values(SELFCHECK_TOOLS)
    .every(f => SELFCHECK_SEEDS.includes(`scripts/${f}`)))

  // ---- 抽边：一个文件 import 了本仓库的哪些文件 ----
  // 源码里写的是 `.js`（ESM 的规矩），图里要的是磁盘上的 `.ts`；相对路径按引它的那个
  // 文件所在目录解，不然 `../lib/x.js` 会被解到根上去
  eq('同目录的边，规格化成仓库根起算的 .ts',
    importsOf('scripts/check/a.ts', `import { x } from './b.js'`),
    { path: 'scripts/check/a.ts', to: ['scripts/check/b.ts'] })
  eq('上一级的边也解得对',
    importsOf('scripts/check/a.ts', `import { x } from '../lib/c.js'`).to, ['scripts/lib/c.ts'])
  // 内建和第三方不是本仓库的文件，改不动也变异不了
  eq('node 内建与第三方包不算边',
    importsOf('scripts/a.ts', `import { readFileSync } from 'node:fs'\nimport z from 'tsx'`).to, [])
  eq('同一个文件被引两次只算一条边',
    importsOf('scripts/a.ts', `import { x } from './b.js'\nimport { y } from './b.js'`).to,
    ['scripts/b.ts'])
  // 判据故意写得宽：注释里提到的路径也收。两头不对称 —— 多收只是把闭包撑大、
  // 多拦几条变异；少收就是**放行**一条自己验自己的变异（`closure` 头上同一条道理）
  eq('注释里的也收 —— 宁可闭包偏大，不可偏小',
    importsOf('scripts/a.ts', `// 早先是 from './old.js'`).to, ['scripts/old.ts'])

  // ---- 递归，不是只收一层 ----
  const graph = [
    { path: 'a.ts', to: ['b.ts'] },
    { path: 'b.ts', to: ['c.ts'] },
    { path: 'x.ts', to: [] },
  ]
  eq('顺着边一直收到底', closure(graph, ['a.ts']), ['a.ts', 'b.ts', 'c.ts'])
  eq('每个种子各自走一遍', closure(graph, ['a.ts', 'x.ts']), ['a.ts', 'b.ts', 'c.ts', 'x.ts'])
  // 图里没有的仍然进闭包、只是不再往下走 —— 悄悄丢掉会让闭包偏小
  eq('图里没有的路径也算在闭包里', closure(graph, ['zzz.ts']), ['zzz.ts'])

  // ---- 边读边递归：遍历本身是判定，不是 I/O ----
  // 读法由调用方注入，所以这段不碰文件系统也验得了。搭一条两跳的链：种子引一跳、
  // 一跳引叶子。少走一层的话叶子进不了闭包，而闭包缩小的那一头是**放行**（评审指出）
  const fake = new Map([
    ['scripts/check/selfcheck.ts', `import { a } from './hop.js'`],
    ['scripts/check/hop.ts', `import { b } from './leaf.js'`],
  ])
  const walked = infraClosure(f => fake.get(f))
  ok('一跳的收得到', walked.includes('scripts/check/hop.ts'))
  ok('两跳的也收得到 —— 只走一层的话它不在', walked.includes('scripts/check/leaf.ts'))
  ok('种子一个不少', SELFCHECK_SEEDS.every(s => walked.includes(s)))
  ok('没被谁引到的不算进来', !walked.includes('scripts/check/无人引用.ts'))
  // 叶子那份源码压根读不到（假表里没有它），它仍然在闭包里 —— 读不到只是不再往下走
  ok('读不到源码的路径自己仍在闭包里', walked.includes('scripts/check/leaf.ts'))

  // 真闭包里的每一个都得在磁盘上 —— 不存在的多半是**夹具串被当成了真 import**
  // （抽边认的是源码字面，种子里写一句完整的 import 样例就会被收进来；实测栽过一次：
  // 凭空多两个文件）。判据故意宽是为了不漏，可它宽出来的东西该在这儿被看见
  const real = infraClosure(f => existsSync(f) ? rf(f, 'utf8') : undefined)
  eq('真闭包里没有磁盘上不存在的路径', real.filter(f => !existsSync(f)), [])

  // ---- 谁受这条判据管 ----
  const infra = ['scripts/check/mutate-rule.ts']
  ok('打在基础设施上的、指名了验证者的变异：自己验自己',
    selfVerifying({ by: 'selfcheck', file: 'scripts/check/mutate-rule.ts' }, infra))
  ok('打在被测入口上的不算 —— 那正是这条记录要的头号用例',
    !selfVerifying({ by: 'selfcheck', file: 'scripts/collect.ts' }, infra))
  ok('缺省跑测试的那些不受这条判据管',
    !selfVerifying({ file: 'scripts/check/mutate-rule.ts' }, infra))
  ok('写明跑测试的也一样不受管',
    !selfVerifying({ by: 'test', file: 'scripts/check/mutate-rule.ts' }, infra))
}

harness('审计：检查链自己的判定模块必须有变异守着')
{
  // 入口（带 shebang）不算：按 CONVENTIONS 第 10 条它不该装判定；其余每个文件都是「有判定要能被测」。
  // 不按文件名后缀认 —— trailer.ts、quoted.ts 都是判定，不叫 rule
  const files = [
    { path: 'scripts/check/size.ts', entry: true },
    { path: 'scripts/check/size-rule.ts', entry: false },
    { path: 'scripts/check/trailer.ts', entry: false },
    { path: 'scripts/check/fake-fetch.ts', entry: false },
  ]
  eq('入口不算、豁免的不算，其余都算', judgmentModules(files),
    ['scripts/check/size-rule.ts', 'scripts/check/trailer.ts'])
  ok('豁免必须写理由', Object.values(JUDGMENT_EXEMPT).every(r => r.trim().length > 0))
  eq('没有变异指向它的判定模块被点名', unguarded(['a.ts', 'b.ts'], [{ file: 'a.ts' }]), ['b.ts'])
  eq('都有变异 → 无', unguarded(['a.ts'], [{ file: 'a.ts' }, { file: 'a.ts' }]), [])
  eq('变异指向别的文件不算数', unguarded(['a.ts'], [{ file: 'c.ts' }]), ['a.ts'])
}

harness('审计的计量输入：作废的不参与计量，只参与展示')
{
  const r = (id: string, over: Partial<Req> = {}): Req =>
    ({ id, cat: id[0], pri: 'P0', text: `${id} 要什么`,
       accept: [{ id: `${id}.a`, text: `${id} 怎么算满足` }], ...over })
  const dead = r('D9', { deprecated: { since: '2026-01-01', why: '不做了' } })
  const replaced = r('D8', { deprecated: { since: '2026-02-01', why: '换了口径', superseded_by: 'D1' } })
  const l = ledger([r('D1'), dead, replaced])

  // 分母只数现行的。作废的算进去，「还差多少」就是个虚报的数 ——
  // 人会去补一条已经不做的事的测试。
  eq('作废的不进计量', l.live.map(x => x.id), ['D1'])
  eq('作废的单独留着，不是丢掉', l.deprecated.map(x => x.id), ['D9', 'D8'])

  // 覆盖率按现行表算：D9 有测试认领也不该把分子分母各顶高一格
  const tested = new Set(['D1', 'D9'])
  eq('覆盖率的分子分母都只算现行的',
    [l.live.length, l.live.filter(x => tested.has(x.id)).length], [1, 1])

  eq('有取代者就指出来', deprecatedBlock([replaced]), ['~~D8~~ 2026-02-01 → D1'])
  eq('没有取代者就只说作废于哪一版', deprecatedBlock([dead]), ['~~D9~~ 2026-01-01'])
  eq('没有作废的 → 这一段不印', deprecatedBlock([]), [])
}

harness('覆盖记录：指纹保护的是整棵 scripts/ 树')
{
  // 指纹只算 test.ts 自己有个洞：静态 import 先于模块体求值，被 import 的实现改出
  // 语法错误时，测试在「开跑前清记录」那一行之前就崩了 —— test.ts 一个字没动、
  // 指纹照旧对得上，上一次的记录成了这一次的证据。范围收窄或者不进子目录，
  // 下面三条会红（M-H14-b、M-H14-h）。
  const scanned = sourceFiles().map(([f]) => f)
  // 用 join 拼期望值：sourceFiles 也是用 join 拼的，写死斜杠的话这三条在 Windows 上必红，
  // 而扫描本身是对的 —— 一条永远在某个平台上红的断言证明不了任何事。
  ok('入口本身在指纹范围里', scanned.includes(join('scripts', 'test.ts')))
  ok('被 import 的实现也在 —— 改坏它就等于改了指纹', scanned.includes(join('scripts', 'lib', 'atomic.ts')))
  ok('子目录要走进去', scanned.includes(join('scripts', 'check', 'claims.ts')))
  // 只哈希内容不哈希路径的话，把一个文件改名、挪到别处，指纹一个字不变（M-H14-g）。
  const fp = (...files: [string, string][]) => fingerprint(files)
  eq('路径也算进指纹', fp(['a.ts', 'x']) === fp(['b.ts', 'x']), false)
  eq('内容变了指纹就变', fp(['a.ts', 'x']) === fp(['a.ts', 'y']), false)
  eq('给的顺序不影响指纹 —— 目录遍历的顺序不保证稳定', fp(['a.ts', 'x'], ['b.ts', 'y']), fp(['b.ts', 'y'], ['a.ts', 'x']))
  // 新鲜度判定抽出来是为了它能被测：比较留在入口里，改成反向比较或恒真，
  // 没有任何测试会红（M-H14-c）。
  eq('指纹对得上才新鲜', claimsFresh('abc', 'abc'), true)
  eq('指纹对不上就是过期', claimsFresh('abc', 'def'), false)
  // 写盘条件同理：少掉「断言全过」那一半没有任何测试会红，而审计会把一份
  // 红着的运行的认领当成证据 —— 三种情况各钉一条（M-H14-d）。
  eq('干净的运行才写得下记录', claimsPublishable(false, 0, 'a', 'a'), true)
  eq('断言红过就不写 —— 没通过的运行不是证据', claimsPublishable(false, 1, 'a', 'a'), false)
  eq('变异运行不写 —— 它跑的是被改过的源码', claimsPublishable(true, 0, 'a', 'a'), false)
  // 开跑前和跑完各算一次指纹：对不上说明源码在这一跑的过程中变过，那份记录会替
  // 一棵从没被完整测过的树作证（M-H14-k）。
  eq('跑的过程中源码变过就不写', claimsPublishable(false, 0, 'a', 'b'), false)

  // ---- 两份记录：单元认领与入口认领各写各的 ----
  // 一份文件两个写方会互相抹掉：拥有的一方开跑前先清、跑完整份重写，单独跑 npm test
  // 就会把自检那一栏一起清掉，而审计读到的是一份形状合法、内容少了一半的记录 ——
  // 它会照着报「红线判据没有测试认领」，把人支到那些判据上（claims.ts 记着这笔账）
  // 「不是同一个路径」这句得把一边放宽成 string 才写得出来：两个字面量类型无交集，
  // 直接比编译器会说这个比较没有意义。那道拒绝拦的是断言本身，不是「两份指到同一处」
  // 这个错 —— 真指到同一处时它反倒编译得过 —— 所以它守不住任何东西，得靠运行时这条
  ok('两份记录不是同一个路径 —— 指到同一处就互相抹掉', (CLAIMS_PATH as string) !== ENTRY_CLAIMS_PATH)
  ok('两份记录都在 .check-cache 底下',
    (CLAIMS_PATH as string).startsWith('.check-cache/')
      && (ENTRY_CLAIMS_PATH as string).startsWith('.check-cache/'))
  // 形状故意一样 —— 同一套判定守两份，不必再写一套。自检写的那份 covered／tensions
  // 恒空，形状照样要过：少一栏就不是合法记录，审计该说「记录坏了」而不是「没测过」
  ok('自检写的那种形状（两栏空）也是合法记录',
    claimsWellFormed({ source_hash: 'abc', covered: [], criteria: ['P3.b'], tensions: [] }))
  ok('少一栏就不合法 —— 两份记录同一套形状判定',
    !claimsWellFormed({ source_hash: 'abc', criteria: ['P3.b'], tensions: [] }))
  // 入口认领与单元认领的资格判定是同一套：变异跑一律不写（否则写下的是一份由被改过
  // 的源码产生的认领），断言红过不写，跑的过程中源码变过不写
  eq('变异跑里自检也不写入口认领', claimsPublishable(true, 0, 'a', 'a'), false)

  // 谁拥有这份记录，谁负责开跑前清掉它 —— 少了这一步，半路崩掉的运行会把
  // 上一次成功的记录留在盘上当证据（M-H14-e）。
  eq('普通运行拥有这份记录', claimsOwnedBy(false), true)
  eq('变异运行不拥有它 —— 既不清也不写', claimsOwnedBy(true), false)

  // 形状不对的记录要当「没有记录」办，不当「这些东西没测过」——
  // 后者会报出一串根本不存在的缺口，把人支到错的地方去修（M-H14-f）。
  const wf = { source_hash: 'abc', covered: [], criteria: [], tensions: [] }
  eq('齐全的记录认得出来', claimsWellFormed(wf), true)
  eq('缺一个数组字段就认不出 —— 不兜底成空数组', claimsWellFormed({ ...wf, covered: undefined }), false)
  eq('字段在但不是数组，同样认不出', claimsWellFormed({ ...wf, covered: 'D1' }), false)
  // 判据认领那一栏也得验，而且要逐栏点名：验的是「每一栏都在」，名单里漏掉一栏
  // 就是那一栏不验形状 —— 一份缺了判据认领的记录被当成合法记录读进去，红线判据
  // 全被报成没有认领，而毛病在记录本身，不在那些判据（M-H14-l）。
  eq('缺判据认领那一栏，同样认不出', claimsWellFormed({ ...wf, criteria: undefined }), false)
  eq('判据认领里混进非字符串，认不出', claimsWellFormed({ ...wf, criteria: [1] }), false)
  eq('缺交点认领那一栏，同样认不出', claimsWellFormed({ ...wf, tensions: undefined }), false)
  eq('交点认领里混进非字符串，认不出', claimsWellFormed({ ...wf, tensions: [1] }), false)
  eq('指纹不是字符串，认不出', claimsWellFormed({ ...wf, source_hash: 12 }), false)
  eq('null 不是记录', claimsWellFormed(null), false)
  // 只验到「是数组」为止的话，元素不是字符串的记录会通过这一关，然后被审计当成
  // 编号去比对 —— 该说「记录坏了、重跑测试」的地方变成一串对不上的编号（M-H14-i）。
  eq('数组里混进非字符串，认不出', claimsWellFormed({ ...wf, covered: [1] }), false)

  // 读不出记录时三种毛病三种说法 —— 塌成一种就是替毛病编答案：权限不对、路径底下
  // 变成了目录，重跑一遍测试照样写不进同一个地方，「先跑 npm test」把人支到跟毛病
  // 无关的方向去（M-H14-j）。
  const errno = (code: string) => Object.assign(new Error(code), { code })
  eq('文件不在，是还没跑过', claimsReadFault(errno('ENOENT')), 'missing')
  eq('读得出来但不是合法 JSON，是记录坏了', claimsReadFault(new SyntaxError('坏了')), 'unparsable')
  eq('权限不对，是这个路径读不了 —— 不是没跑过', claimsReadFault(errno('EACCES')), 'unreadable')
  eq('路径底下变成了目录，同样是读不了', claimsReadFault(errno('EISDIR')), 'unreadable')
}

})
await group('h-group', () => {
harness('自检夹具的分组与选跑：不点名就全跑，点了名就连 needs 一起跑')
{
  const G = [
    { id: 'collect', needs: [] },
    { id: 'enrich', needs: ['collect'] },
    { id: 'render', needs: ['enrich'] },
    { id: '独立', needs: [] },
  ]
  // **不点名就是全跑。** 缺省行为逐字如旧，这是这条改动敢动自检那个文件的前提
  eq('没写 --only → 交回 undefined，调用方据此全跑', wanted(G, undefined), undefined)
  // 闭包是**传递**的：点 render 要连 enrich 与 collect 一起，否则 render 读到的是初始值
  eq('点一个，连它的 needs 递归拖进来', [...wanted(G, ['render'])!].sort(),
    ['collect', 'enrich', 'render'])
  eq('没被点也没人需要的，不跑', wanted(G, ['render'])!.has('独立'), false)
  eq('点两个，并集', [...wanted(G, ['独立', 'enrich'])!].sort(), ['collect', 'enrich', '独立'])
  eq('点它自己一个，需要它的那些不跟着跑', [...wanted(G, ['collect'])!], ['collect'])
  // 名字写错的 --only 会让这一跑什么也不验、还以退出码 0 结束 —— 那正是这套方法要防的假绿。
  // **要它说出是哪个名字，不能只问「抛没抛」**：拿掉那道检查之后 `byId.get(id)!.needs`
  // 会抛 TypeError，照样是抛，只问抛没抛的断言照样绿（实测：M-H42-b 因此存活了一轮）
  eq('点了不存在的组，抛的那句话要点出是哪个名字', (() => {
    try { wanted(G, ['没这个']); return '没抛' } catch (e) {
      return (e as Error).message.includes('没这个') ? '点了名' : '抛了别的'
    }
  })(), '点了名')
  // 空的 `--only=` 是「一组都不跑」（点得出来的错），不是「全跑」（静默变成另一件事）
  eq('--only= 空着 → 空数组，不是 undefined', parseOnly(['--only=']), [])
  eq('没写这个参数 → undefined', parseOnly(['--worker']), undefined)
  eq('逗号分隔', parseOnly(['--only=a,b']), ['a', 'b'])
  eq('空集跑不出任何一组', [...wanted(G, [])!], [])
  const rejected = (run: () => unknown): string => {
    try { run(); return '没有拒绝' } catch (e) { return e instanceof Error ? e.message : String(e) }
  }
  eq('需求测试没有选择参数时保留全跑', parseOnlyStrict([]), undefined)
  eq('需求测试解析合法多组', parseOnlyStrict(['--only=collect,独立']), ['collect', '独立'])
  for (const arg of ['--only=', '--only=,', '--only=collect,', '--only=,collect',
    '--only=collect,,独立', '--only= collect', '--only=collect ']) {
    ok(`需求测试拒绝空或带空格的组名：${arg}`,
      rejected(() => parseOnlyStrict([arg])).includes('非空'))
  }
  ok('需求测试拒绝拼错的参数并点名它',
    rejected(() => parseOnlyStrict(['--olny=collect'])).includes('--olny=collect'))
  ok('需求测试拒绝重复选择参数',
    rejected(() => parseOnlyStrict(['--only=collect', '--only=独立'])).includes('一次'))
  ok('需求测试拒绝同一组重复点名',
    rejected(() => parseOnlyStrict(['--only=collect,collect'])).includes('重复'))
  ok('选跑判定拒绝缺失依赖并点名两端',
    rejected(() => wanted([{ id: 'render', needs: ['missing'] }], ['render']))
      .includes('组 render 缺少依赖组 missing'))
  ok('选跑判定拒绝重复登记 id',
    rejected(() => wanted([{ id: 'same', needs: [] }, { id: 'same', needs: [] }], ['same']))
      .includes('id 重复'))

  // 标签落在哪一组 —— 认的是 group(...) 这个代码结构，不认注释里的分节线
  const src = [
    "named('组外那条', true, '')",
    "group('甲', [], () => {",
    "  named('甲里的', true, '')",
    "  if (x) { endPath('嵌在块里的') }",
    "  别的函数('不算起名的')",
    "  别的对象.named('属性调用的', true, '')",
    "  named(`反引号的`, true, '')",
    '})',
    "group('乙', ['甲'], () => { named('乙里的', true, '') })",
  ].join('\n')
  const where = groupOfLabel(src, ['named', 'endPath'])
  eq('组里的标签归到那一组', where.get('甲里的'), '甲')
  eq('嵌在块里、嵌在箭头函数里的也认', where.get('嵌在块里的'), '甲')
  eq('第二组归第二组', where.get('乙里的'), '乙')
  // 组外的标签查不到 —— 调用方据此整跑，而不是缩成一个漏掉它的子集
  eq('组外的标签不在表里', where.get('组外那条'), undefined)
  eq('没写进 declares 的调用不算起名', where.get('不算起名的'), undefined)
  // 下面两条守的是**照抄过来、却没跟着抄负片**的那两处判断（评审第二轮指出）：
  // `labelsOf` 那边各有 M-H20-c／M-H20-g，这边原先一条都没有，改了它们在真文件上
  // 完全等价，全链不可能变红。
  eq('点号右边那一截不算起名 —— 别的对象上碰巧同名的方法', where.get('属性调用的'), undefined)
  eq('反引号、没插值的也定得下来，归到那一组', where.get('反引号的'), '甲')

  // **「宁可多跑」之所以成本为零，全靠每条标签都落得进某一组。** 一条落不进，
  // `onlyFor` 就静默退回整跑 —— 报告一字不差，只有墙钟变了，而检查链里没有任何
  // 地方量墙钟：这条改动买到的东西可以一秒不剩地漏光而全链照绿（评审实测）。
  // `misnamed` 那道闸只问「名字在不在清册里」，落不落得进组它不问。手搭的数据证不了
  // 真源码，照 #85 那条欠条的先例扫真的。
  const selfDecl = VERIFIERS.selfcheck.declares
  const selfSrc = rf('scripts/check/selfcheck.ts', 'utf8')
  const selfGrouped = groupOfLabel(selfSrc, selfDecl)
  eq('真 selfcheck.ts：清册里的每条标签都翻得出组，一条不落',
    [...labelsOf(selfSrc, selfDecl).keys()].filter(l => selfGrouped.get(l) === undefined), [])
}

})
await group('h-check-rules', () => {
harness('引文遮罩：围栏与 HTML 注释里的东西不是结构')
{
  // 这个遮罩守着两条路径：提交信息里的豁免、决策记录的分节。后者不可逆 ——
  // 把示例当成分节，`--split` 会截断原记录并写出一个假记录。
  eq('围栏块整段盖住', quotedMask(['a', '```', 'b', '```', 'c'].join('\n')),
    [false, true, true, true, false])
  eq('带信息串的开启，闭合不带', quotedMask(['```ts', 'x', '```'].join('\n')),
    [true, true, true])
  eq('异种标记不闭合', quotedMask(['```', '~~~', 'x', '```', 'c'].join('\n')),
    [true, true, true, true, false])
  eq('更短的同种标记不闭合', quotedMask(['````', '```', '````', 'c'].join('\n')),
    [true, true, true, false])
  eq('闭合后面有内容就不算闭合', quotedMask(['```', '``` 还有字', 'x'].join('\n')),
    [true, true, true])
  eq('跨行 HTML 注释', quotedMask(['a', '<!--', '## ADR-59 例子', '-->', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('单行注释只盖那一行', quotedMask(['a', '<!-- x -->', 'b'].join('\n')),
    [false, true, false])
  // 一行里两个界定符：`<!-- 甲 --> <!-- 乙` —— 第二个还开着，后面仍是注释
  eq('关了又开，后面仍算注释',
    quotedMask(['a', '<!-- 甲 --> <!-- 乙', '## ADR-59 例子', '-->', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('开了又关，后面不算',
    quotedMask(['a', '<!-- 甲', '乙 --> <!-- 丙 -->', 'b'].join('\n')),
    [false, true, true, false])
  eq('什么都没有时全是 false', quotedMask(['a', 'b'].join('\n')), [false, false])

  // 原始 HTML 块（CommonMark 类型 1）是唯一会原样藏住顶格 `## ADR-NN` 的一类
  eq('pre 块整段盖住',
    quotedMask(['a', '<pre>', '## ADR-59 例子', '</pre>', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('同一行开合的 HTML 块只盖那一行',
    quotedMask(['a', '<pre>x</pre>', 'b'].join('\n')), [false, true, false])
  // 其余 HTML 块到空行为止；pre 一类允许块内空行，所以两种收尾规则要分开
  eq('div 块到空行为止',
    quotedMask(['a', '<div>', '## ADR-59 例子', '</div>', '', 'b'].join('\n')),
    [false, true, true, true, true, false])
  eq('pre 块内允许空行',
    quotedMask(['<pre>', '', '## ADR-59 例子', '</pre>', 'b'].join('\n')),
    [true, true, true, true, false])
  // 规范原话：开启符后跟空格、制表符、`>`，**或行尾**。少了行尾这一种，单独一行的
  // `<pre` 会掉进「到空行为止」的兜底 —— 空行之后的 `## ADR-NN` 就露出来当分节了
  eq('开启符后面直接是行尾也算第 1 类 —— 空行不收尾',
    quotedMask(['a', '<pre', '', '## ADR-59 例子', '</pre>', 'b'].join('\n')),
    [false, true, true, true, true, false])
  // 规范括号里写明「不必与开启的那个匹配」
  eq('收尾标签不必与开启的那个匹配',
    quotedMask(['a', '<pre', '## ADR-59 例子', '</style>', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('`<presentation>` 不是第 1 类 —— 后面既不是空白也不是 `>` 或行尾',
    quotedMask(['<presentation>', '', '## ADR-59 例子'].join('\n')),
    [true, true, false])

  // 开启符里带注释：`<pre><!-- x -->` 是规范认的第 1 类（第 2 类要求行**以** `<!--` 开头，
  // 它不满足）。放宽的注释判据若抢在前面，注释同行开合、状态归零，`<pre>` 块就没被记下
  eq('开启符里带注释，仍按 HTML 块算',
    quotedMask(['a', '<pre><!-- 说明 -->', '## ADR-59 例子', '</pre>', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('行首就是注释的，仍走注释那条路 —— 放宽没被顺手删掉',
    quotedMask(['a', '<!-- 甲', '## ADR-59 例子', '-->', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('不是开启符、但含注释的半真半假行，整行盖住',
    quotedMask(['a', '## ADR-59 甲 <!-- 注释', 'x', '-->', 'b'].join('\n')),
    [false, true, true, true, false])

  // 顺序摆正之后的残留，钉成一条决定而不是意外：第 6 类开启符里带一个跨空行的注释，
  // 规范说 `<div>` 块到空行为止，空行之后那行就是真的标题 —— 渲染器也是这么显示的。
  // 比改之前盖得少，方向上是「更像一个 CommonMark 解析器」，所以照规范走
  eq('第 6 类里的注释跨过空行 —— 块在空行处收尾，之后的分节是真的',
    quotedMask(['<div><!-- 甲', 'x', '', '## ADR-59 空行之后', '-->', 'b'].join('\n')),
    [true, true, true, false, false, false])

  // CommonMark 的七类开启符列全了 —— 这是个闭合集合，不会再有第八种
  eq('CDATA 块到 ]]> 为止',
    quotedMask(['a', '<![CDATA[', '## ADR-59 例子', ']]>', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('处理指令到 ?> 为止',
    quotedMask(['a', '<?php', '## ADR-59 例子', '?>', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('声明到 > 为止（跨行）',
    quotedMask(['a', '<!DOCTYPE', '## ADR-59 例子', '>', 'b'].join('\n')),
    [false, true, true, true, false])
  eq('同一行收尾的声明只盖那一行',
    quotedMask(['a', '<!DOCTYPE html>', 'b'].join('\n')), [false, true, false])

  // 兜底：切在引文中间，那一段必然带着没关上的构造 —— 与形态无关
  ok('没关上的围栏 → 残段', endsOpen(['## ADR-01 甲', '```', 'x'].join('\n')))
  ok('没关上的注释 → 残段', endsOpen(['## ADR-01 甲', '<!--', 'x'].join('\n')))
  ok('没关上的 HTML 块 → 残段', endsOpen(['## ADR-01 甲', '<pre>', 'x'].join('\n')))
  ok('都关上了 → 不是残段', !endsOpen(['## ADR-01 甲', '```', 'x', '```'].join('\n')))
}

harness('决策记录：编号唯一、文件名与正文一致、索引按数字排序')
{
  eq('文件名由编号与标题生成，个位数补零',
    fileNameOf(8, '采集累加器与交付物拆成两个文件'), 'ADR-08-采集累加器与交付物拆成两个文件.md')
  // 索引是 Markdown：会断链或多切一列的字符必须处理掉，否则 `npm run adr` 仍报「一致」，
  // 而那份一致的索引点不开
  eq('井号与方括号从文件名里去掉 —— 留着会变成锚点、把链接标签截断',
    slugify('带#井号与[方括号]的标题'), '带井号与方括号的标题')
  eq('全角逗号不剔 —— 它在文件名与链接里都无害', slugify('甲，乙'), '甲，乙')

  // 截断数的是码点：数码元会从中间劈开代理对，留下半个字符 ——
  // 那不是合法 Unicode，写盘时被换成 `\uFFFD`，盘上的名字和算出来的名字就此不是同一个
  const astral = '一'.repeat(31) + '🎯'
  const lone = (s: string) => /[\uD800-\uDFFF]/.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''))
  ok('码元切法确实会留下半个字符 —— 这是这条测试要挡住的东西', lone(astral.slice(0, 32)))
  ok('码点切法不留半个字符', !lone(slugify(astral)))
  ok('emoji 整个留下 —— 它算一个字符，不是两个', slugify(astral).endsWith('🎯'))
  eq('第 33 个码点照样截掉 —— 换的是单位，不是长度', [...slugify('一'.repeat(31) + '🎯' + '乙')].length, 32)
  eq('纯 BMP 的标题截出来和以前一样 —— 既有文件一个都不改名',
    slugify('一'.repeat(40)), '一'.repeat(32))
  eq('标签里的竖线转义，不然多切一列', escapeCell('甲|乙'), '甲\\|乙')
  // 方括号会**提前终止链接标签** —— 一个标题里有 `]`，后面半截连同链接散成纯文本
  eq('方括号转义', escapeCell('甲]乙'), '甲\\]乙')
  eq('反斜杠必须第一个转，否则它把后面那个转义吃掉', escapeCell('甲\\|乙'), '甲\\\\\\|乙')
  eq('尖括号与反引号也转 —— 原始 HTML 与代码段一样会吞后文',
    escapeCell('甲<b>乙`丙'), '甲\\<b\\>乙\\`丙')
  // 整条链接仍然可解析：标签闭合在正确的位置
  ok('带方括号的标题渲染出的链接仍然只有一个标签',
    renderIndex([{ file: 'ADR-09-甲乙.md', num: 9, title: '甲]乙' }])
      .includes('[甲\\]乙](ADR-09-甲乙.md)'))
  eq('链接目标只编码会断链的那一组', encodeTarget('ADR-01-甲 (乙).md'), 'ADR-01-甲%20%28乙%29.md')
  eq('中文不编码 —— 编了只会让索引变成乱码', encodeTarget('ADR-01-甲乙.md'), 'ADR-01-甲乙.md')
  // 字面量 `%` 自己也要编码：一个标题里含 `%20`，slugify 原样留在文件名里，
  // 而渲染器会把它当成编码过的空格 —— 链接指向另一个文件名，而检查仍报一致
  eq('字面量 % 编成 %25', encodeTarget('ADR-09-甲%20乙.md'), 'ADR-09-甲%2520乙.md')
  ok('真空格与字面量 %20 编出来不同 —— 两者必须能区分',
    encodeTarget('ADR-09-甲 乙.md') !== encodeTarget('ADR-09-甲%20乙.md'))

  // 整由待剔字符组成的标题过完 slugify 是空串，拼出来 `ADR-15-.md` —— FILE_RE 要求
  // 标题段非空，读路径不认。`--split` 拿这同一条判据在写之前拦下：写方与读方
  // 共用一条判据就漂不了，另写一条「标题不能为空」早晚会和 FILE_RE 分家
  ok('标题剔空之后拼出的文件名，读路径不认', !FILE_RE.test(fileNameOf(15, '[]()')))
  ok('留一个字符就认', FILE_RE.test(fileNameOf(15, '甲[]()')))

  // `--write` 是 slice(0, i) + want + slice(j + END.length)，这个式子只在
  // 「恰好一对、BEGIN 在前」时成立。两个下标都非负就放行的话，END 在前会让前半段
  // 留下 END、后半段把 BEGIN 再抄一遍 —— 回写把索引写坏，而它正是报错时让人跑的命令
  const [MB, ME] = ['<!--B-->', '<!--E-->']
  eq('一对、顺序对 → 无异常', markerFault(`前${MB}中${ME}后`, MB, ME), null)
  eq('缺一个 → missing', markerFault(`前${MB}中`, MB, ME), 'missing')
  eq('END 在 BEGIN 之前 → reversed（两个下标都非负，只查在不在会放行）',
    markerFault(`前${ME}中${MB}后`, MB, ME), 'reversed')
  eq('多出一对 → duplicate', markerFault(`${MB}甲${ME}${MB}乙${ME}`, MB, ME), 'duplicate')

  // 「文件名是有损代理」这一条留着 —— 它守的是 fileNameOf 自己，和已撤的那套 git 机器无关：
  // slugify 截到 32 字符，长标题只在那之后改动，文件名一模一样。撞号判定（checkAll）
  // 认的是编号，不是文件名，所以这个有损不影响它；记在这里是因为 ADR-79 撤掉编号不可回收
  // 那套检查之后，「文件名能不能代表标题」再没有别的地方说了。
  const long = '一'.repeat(32)
  ok('两个只在第 32 字符之后不同的标题，文件名相同',
    fileNameOf(9, long + '甲') === fileNameOf(9, long + '乙'))

  eq('标题里的斜杠与括号在文件名里去掉',
    fileNameOf(15, '记忆读不出来时/不产出名单（也不覆盖）'), 'ADR-15-记忆读不出来时不产出名单也不覆盖.md')

  eq('编号唯一时无错', checkAll([
    { file: 'ADR-01-甲.md', num: 1, title: '甲' },
    { file: 'ADR-02-乙.md', num: 2, title: '乙' },
  ]), [])

  // 两条分支各自取了同一个号。**不是「装成文件就看得见」** —— 这条判定只看得见
  // 递给它的那一棵树，要等两边都合进来才比得出；git 那头也不可靠 —— 这里的「甲」「乙」
  // 过完 slugify 仍然不同，两个文件各自干净落地 —— 反面那半在上面：「两个只在第 32
  // 字符之后不同的标题，文件名相同」
  const dup = checkAll([
    { file: 'ADR-58-甲.md', num: 58, title: '甲' },
    { file: 'ADR-58-乙.md', num: 58, title: '乙' },
  ])
  eq('撞号报一条错', dup.length, 1)
  // 撞号那条变异下 dup 是空数组:先判长度,让它作为断言失败而不是让整个进程崩掉
  ok('错里指出两个文件', dup.length === 1 && dup[0].includes('ADR-58-甲.md') && dup[0].includes('ADR-58-乙.md'))

  ok('改了标题却没改文件名，报错',
    checkAll([{ file: 'ADR-03-旧标题.md', num: 3, title: '新标题' }]).length === 1)

  // 编号有空号是正常的：号不复用，包括还活在别的分支上的
  const idx = renderIndex([
    { file: 'ADR-10-十.md', num: 10, title: '十' },
    { file: 'ADR-09-九.md', num: 9, title: '九' },
    { file: 'ADR-58-五八.md', num: 58, title: '五八' },
  ])
  const order = [...idx.matchAll(/\*\*ADR-(\d+)\*\*/g)].map(m => m[1])
  eq('按数字排序而不是按字典序，且空号不报错',
    order, ['09', '10', '58'])
}

harness('体量闸门的判定：四类分开算，豁免必须指名类别且写明理由')
{
  eq('源码预算仍按已合入改动校准为 350 行', BUDGET.源码, 350)
  eq('决策记录算文档', categorize('docs/adr/0001-x.md'), '文档')
  eq('需求登记表算文档', categorize('docs/requirements.json'), '文档')
  eq('lib 算源码', categorize('scripts/lib/memory.ts'), '源码')
  eq('检查脚本也算源码 —— 它一样会写错', categorize('scripts/check/size.ts'), '源码')
  eq('test.ts 算测试', categorize('scripts/test.ts'), '测试')
  eq('变异集算测试', categorize('scripts/check/mutations.json'), '测试')
  eq('其余归其他', categorize('package.json'), '其他')

  // 四类分开算：合并成一个总数，源码的超标会被文档稀释掉
  const counts = tally([
    { path: 'scripts/lib/a.ts', added: 400 },
    { path: 'DECISIONS.md', added: 2000 },
    { path: 'scripts/test.ts', added: 10 },
  ])
  eq('分类累加', counts, { 源码: 400, 测试: 10, 文档: 2000, 其他: 0 })

  // 默认的 numstat 会把中文路径转义成 `"docs/adr/\351\207\207..."`，
  // 于是这个仓库里几乎每个文件名都匹配不上判据、整批掉进「其他」。实测栽过一次。
  const parsed = parseNumstat('23\t0\tdocs/adr/ADR-01-拆成可执行的一半.md\x0089\t0\tscripts/check/adr-sync.ts\x00')
  eq('中文路径原样解析', parsed, [
    { path: 'docs/adr/ADR-01-拆成可执行的一半.md', added: 23 },
    { path: 'scripts/check/adr-sync.ts', added: 89 },
  ])
  eq('中文路径归对类', tally(parsed), { 源码: 89, 测试: 0, 文档: 23, 其他: 0 })
  // `-z` 关掉的是引号转义，不是分隔符：路径里的制表符原样留着（git 2.43 实测）。
  // 按制表符全切再取第三段，`scripts/foo\tjunk.ts` 被截成 `scripts/foo` ——
  // 少了后缀，源码被记进「其他」，量的是另一个预算
  eq('路径里的制表符原样保留，不被当成分隔符',
    parseNumstat('2\t0\tscripts/foo\tjunk.ts\x00'),
    [{ path: 'scripts/foo\tjunk.ts', added: 2 }])
  eq('所以它仍算源码，不掉进「其他」',
    tally(parseNumstat('2\t0\tscripts/foo\tjunk.ts\x00')).源码, 2)
  // 路径可以含换行，尾段必须用 [\s\S] 才吃得下
  eq('路径里的换行也保留',
    parseNumstat('1\t0\tdocs/a\nb.md\x00'), [{ path: 'docs/a\nb.md', added: 1 }])
  // 读不懂就抛，不静默计零 —— 一个读错了还照常给数的闸门比没有闸门更糟
  ok('缺分隔符的记录当场抛，不当成 0 行', (() => {
    try { parseNumstat('乱七八糟\x00'); return false } catch { return true }
  })())

  eq('二进制文件按 0 计', parseNumstat('-\t-\tdocs/a.png\x00'), [{ path: 'docs/a.png', added: 0 }])
  // 纯改名：git 的记录形状不一样，两个路径跟在后面。一个 400 行的文件挪个位置
  // 不该顶掉整个源码预算 —— 它一行内容都没加
  eq('纯改名记在新路径上，且按 0 计',
    parseNumstat('0\t0\t\x00scripts/old.ts\x00scripts/new.ts\x00'),
    [{ path: 'scripts/new.ts', added: 0 }])
  eq('改名记录后面还能继续解析普通记录',
    parseNumstat('0\t0\t\x00a/old.ts\x00a/new.ts\x0012\t0\tscripts/lib/x.ts\x00').length, 2)

  // ── 真起一个 git 仓库量一遍 ─────────────────────────────────────
  //
  // 上面那些断言喂的是**手写的** numstat 字符串:它们测的是解析器吃不吃那个形状,
  // 测不到「git 到底会不会产出那个形状」。而这道闸门看得见多少改动,全取决于
  // `GIT_CONFIG` 与两个 `NUMSTAT` 里钉死的几项 —— 那几项只有真跑一遍才验得到
  // (`docs/CONVENTIONS.md` 第十一节:描述保证的那句话,没有任何检查看着)。
  //
  // 仓库的本地配置**故意设成反的**:改名检测关掉、中文路径转义打开、行尾自动
  // 转换关掉。前两项设反是为了让「钉死」这件事真的被验到 —— 钉不住就当场红。
  // 第三项必须关:开着的话 CRLF 那一笔写进去就被规范化成 LF,两边都读 0、
  // 断言恒真 —— 那正是本仓库最不许的那种假绿。
  {
    const repo = mkdtempSync(join(tmpdir(), 'kol-size-git-'))
    /**
     * 这条夹具跑 git 的环境。**两件事都得做,漏一件这条夹具就从「验到了」变成「更糟」。**
     *
     * 一、把全局与系统配置挡在外面:否则一台设了 `core.autocrlf=true` 的机器上,
     * 下面那条 CRLF 断言会恒真 —— 假绿。
     *
     * 二、**把继承来的仓库指向变量删掉。** `git -C <目录>` 压不住 `GIT_DIR` ——
     * 实测导出 `GIT_DIR`／`GIT_WORK_TREE` 指向另一个仓库之后,
     * `git -C 夹具 rev-parse --show-toplevel` 交回的是**那个**仓库。
     * 而这条夹具会 `init`、`commit`、`mv`,落在别人的仓库上就是真破坏;
     * 「在 git 钩子里跑 `npm run check`」正好导出这几个变量(#142 评审指出)。
     */
    // 诱饵必须摆在 `{...process.env}` **之前** —— 摆在后面的话它进不了子进程的环境,
    // 下面那条断言就什么都没验(第一版正是这么写的,拿掉删除循环照样全绿)
    const decoy = process.env.GIT_DIR
    process.env.GIT_DIR = join(repo, '诱饵.git')
    const gitEnv: NodeJS.ProcessEnv = {
      ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
    }
    for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
      'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete gitEnv[k]
    /** 在夹具仓库里跑一条 git */
    const g = (...args: string[]) =>
      spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: gitEnv })
    const w = (rel: string, body: string) => {
      mkdirSync(join(repo, dirname(rel)), { recursive: true })
      writeFileSync(join(repo, rel), body, 'utf8')
    }
    g('init', '-q', '.')
    // 上面那个诱饵的第三拍就在这里:没把 `GIT_DIR` 删掉的话,`init` 会跑到诱饵那边,
    // 这个目录里不会有 `.git`。**先断言、再 mkdir 兜住** —— 不兜的话下一句
    // 写配置会 ENOENT 当场崩,而崩了不算被抓到(ADR-70),后面的断言一句话都说不上
    const dotGit = join(repo, '.git')
    ok('夹具仓库建在它自己的目录里 —— 继承来的 GIT_DIR 没把 init 带走', existsSync(dotGit))
    mkdirSync(dotGit, { recursive: true })
    // 六项配置一次写完,不起六个 `git config` 子进程 —— 这条夹具的每一毫秒都要
    // 乘以缺省验证者名下的变异条数(ADR-97 第二节),九个子进程已经是它的全部成本
    writeFileSync(join(dotGit, 'config'), [
      '[user]', '\temail = t@t', '\tname = t',
      '[diff]', '\trenames = false',      // 故意设反:钉不住就当场红
      '[core]', '\tquotePath = true',     // 同上
      '\tautocrlf = false',               // 必须关:开着 CRLF 那一笔会被规范化 → 假绿
      '[commit]', '\tgpgsign = false',
    ].join('\n') + '\n', 'utf8')

    w('scripts/check/包起来.ts', '甲\n乙\n丙\n')
    w('docs/adr/文档.md', '# 标题\n\n1. 甲\n2. 乙\n')
    w('docs/挪走的.md', Array.from({ length: 40 }, (_, i) => `行 ${i}`).join('\n') + '\n')
    w('scripts/lib/行尾.ts', '子\n丑\n')
    g('add', '-A'); g('commit', '-qm', '底')

    // 三笔改动,每一笔的期望值都手推、推导写在旁边:
    // ① `.ts` 包进回调:三行原样、每行只多了两个空格。照实数把这三行都算成新增,
    //    再加 `group(() => {` 与 `})` 两行 → 3 + 2 = 5;忽略行内空白后只剩那两行 → 2。
    w('scripts/check/包起来.ts', 'group(() => {\n  甲\n  乙\n  丙\n})\n')
    // ② `.md` 只给一行加前导空白:`.md` 不在白名单里,两边都照实数 → 1。
    w('docs/adr/文档.md', '# 标题\n\n1. 甲\n   2. 乙\n')
    // ③ 跨类改名、零内容变化:纯改名记录是 `0\t0\t`,与文件多长无关 → 两边都 0。
    g('mv', 'docs/挪走的.md', 'scripts/lib/挪来的.ts')
    // ④ 行尾翻转:两行各多一个 \r。照实数两行都算新增 → 2;`.ts` 吃折扣 → 0。
    //    **这是这条改动明写的代价,不是漏掉的情形** —— 钉住两边的数,
    //    它哪天变了(比如有人给仓库加了 .gitattributes)这条会红,而不是静默改口径。
    w('scripts/lib/行尾.ts', '子\r\n丑\r\n')
    g('add', '-A'); g('commit', '-qm', '改')

    const numstat = (args: readonly string[]) => {
      const r = g(...GIT_CONFIG, ...args, 'HEAD~1', 'HEAD')
      return parseNumstat((r.stdout ?? '').trim())
    }
    const plainFiles = numstat(NUMSTAT)
    const mergedFiles = merge(plainFiles, numstat(NUMSTAT_IGNORING_SPACE))
    const added = (fs: readonly { path: string; added: number }[], path: string) =>
      fs.find(f => f.path === path)?.added

    // 仓库本地把 `core.quotePath` 打开了,而路径照样是原样的 —— 压住它的是 `-z`
    // (实测:注掉 `GIT_CONFIG` 里的 `core.quotePath=false`,这条照样绿)。
    eq('中文路径原样进分类判据 —— 靠的是 `-z`,不是 quotePath',
      plainFiles.map(f => f.path).includes('docs/adr/文档.md'), true)
    // `core.quotePath=false` 那一项要靠一次**不走 `-z`** 的调用才验得到:仓库本地把转义打开了,
    // 压得住它的只有 `GIT_CONFIG`。列一遍改过的文件名,中文路径必须原样出来,
    // 不能是 `"docs/adr/\346\226\207..."` 那种转义串(ADR-98 末尾:它曾被注掉,没人发现,因为之前量不到)
    const names = (g(...GIT_CONFIG, 'diff', '--name-only', 'HEAD~1', 'HEAD').stdout ?? '').split('\n')
    eq('不走 -z 的调用:中文路径照样原样出来 —— 仓库本地打开了转义,钉死的 core.quotePath=false 压住了它',
      names.includes('docs/adr/文档.md'), true)
    eq('① 包进回调:照实数三行重排 + 两行新代码',
      added(plainFiles, 'scripts/check/包起来.ts'), 5)
    eq('① 包进回调:忽略行内空白后只剩那两行新代码',
      added(mergedFiles, 'scripts/check/包起来.ts'), 2)
    eq('② .md 不在白名单里:纯缩进照样收那一行',
      added(mergedFiles, 'docs/adr/文档.md'), 1)
    eq('③ 跨类改名零内容变化:两遍都读 0 —— 仓库本地把改名检测关了,钉死的那一项压住了它',
      [added(plainFiles, 'scripts/lib/挪来的.ts'), added(mergedFiles, 'scripts/lib/挪来的.ts')],
      [0, 0])
    eq('④ 行尾翻转:照实数两行',
      added(plainFiles, 'scripts/lib/行尾.ts'), 2)
    eq('④ 行尾翻转:`.ts` 吃折扣读 0 —— 明写的代价,不是漏掉的情形',
      added(mergedFiles, 'scripts/lib/行尾.ts'), 0)
    // 折掉的行数逐类:源码 = ①的 5-2=3 加 ④的 2-0=2 = 5;文档 = 0(不吃折扣)
    eq('折掉的行数逐类算,为 0 也报出来',
      discount(tally(plainFiles), tally(mergedFiles)),
      { 源码: 5, 测试: 0, 文档: 0, 其他: 0 })
    if (decoy === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = decoy
    rmSync(repo, { recursive: true, force: true })
  }

  eq('只有白名单里的后缀吃折扣', [discountable('scripts/a.ts'), discountable('docs/a.md'),
    discountable('x.yml'), discountable('process/AGENTS.md.tpl')], [true, false, false, false])

  eq('豁免必须指名类别', judgeExemption('size-ok: 就这一次'), { kind: 'unjustified', text: '就这一次' })
  eq('指名了类别但没写理由，不放行', judgeExemption('size-ok: 源码'), { kind: 'unjustified', text: '源码' })
  eq('合格的豁免', judgeExemption('size-ok: 源码 首次落地，拆不开'),
    { kind: 'exempt', category: '源码', reason: '首次落地，拆不开' })
  eq('普通提交信息不是豁免', judgeExemption('fix: 修一个 bug'), null)

  // 类别必须是第一个空白之前的**完整一段**，不是前缀匹配 —— 否则这两条都会
  // 被当成合格豁免（类别取「源码」「文档」，剩下的当理由）
  eq('类别后面没有空白，不成立',
    judgeExemption('size-ok: 源码理由没有空格'), { kind: 'unjustified', text: '源码理由没有空格' })
  eq('类别是更长词的前缀，不成立',
    judgeExemption('size-ok: 文档案 某个理由'), { kind: 'unjustified', text: '文档案 某个理由' })
  eq('不认识的类别，不成立',
    judgeExemption('size-ok: 源代码 generated'), { kind: 'unjustified', text: '源代码 generated' })

  // 必须顶格：提交信息里举例说明这个语法是很自然的事，缩进的例子不该被当成真的豁免。
  // 实测栽过一次 —— 上一个提交的正文里用缩进写了两个反例，CI 当场红。
  eq('缩进的 size-ok 不算', judgeExemption('    size-ok: 源码 某个理由'), null)
  eq('引文里的 size-ok 不算', judgeExemption('> size-ok: 源码 某个理由'), null)
  ok('顶格的才算', judgeExemption('size-ok: 源码 某个理由')?.kind === 'exempt')

  // 豁免只认最后一个 trailer 块 —— 正文里怎么写都不算。
  // 这条换掉了原先「扫整个正文、再逐一排除引文写法」的做法：那条路补到第六种
  // 形态（缩进/引文/围栏/围栏种类/信息串/HTML 注释）仍在冒新的。
  const withBody = ['feat: x', '', '```', 'size-ok: 源码 围栏里的例子', '```', '',
    '<!--', 'size-ok: 源码 注释里的例子', '-->', '',
    'size-ok: 文档 这条在最后一段，算', 'Co-Authored-By: X <x@y>'].join('\n')
  eq('只有最后一段里的算',
    scanMessage(withBody).map(v => v.kind === 'exempt' ? v.category : 'bad'), ['文档'])
  eq('正文里的 size-ok 一律不算 —— 围栏、注释、缩进都不必再分别处理',
    scanMessage(['x', '', 'size-ok: 源码 正文里的', '', 'Co-Authored-By: X <x@y>'].join('\n')), [])
  ok('和 Co-Authored-By 同一段的算',
    scanMessage('fix: y\n\nsize-ok: 源码 真理由\nCo-Authored-By: X <x@y>')[0]?.kind === 'exempt')
  // 最后一段必须整段都是 trailer：一条以示例结尾、后面没有 trailer 的提交信息，
  // 那个示例就成了最后一段
  eq('最后一段是围栏示例 → 整段不算指令区',
    scanMessage(['feat: x', '', '```', 'size-ok: 源码 例子', '```'].join('\n')), [])
  eq('最后一段是 HTML 注释 → 整段不算',
    scanMessage(['feat: x', '', '<!--', 'size-ok: 源码 例子', '-->'].join('\n')), [])
  eq('最后一段掺了散文 → 整段不算',
    scanMessage('feat: x\n\nsize-ok: 源码 理由\n这一行是散文，不是 trailer'), [])

  eq('最后一段里写歪的仍然拦下',
    scanMessage('x\n\nsize-ok: 写歪的').map(v => v.kind), ['unjustified'])

  // 豁免管整条分支，不设新鲜度（ADR-80 撤掉了「写下之后又净增就判过期」那套）。
  const W = (category: '源码' | '测试' | '文档' | '其他'): Waiver => ({ category, reason: 'r' })

  const over = judge({ 源码: 400, 测试: 0, 文档: 0, 其他: 0 }, [], [])
  ok('超线且无豁免 → 失败', !over.ok)
  eq('报出超的那一类', over.over.map(o => o.category), ['源码'])

  const waived = judge({ 源码: 400, 文档: 2000, 测试: 0, 其他: 0 }, [W('源码')], [])
  ok('豁免了源码，文档照样拦下 —— 一个豁免不放行四类', !waived.ok)
  eq('豁免的那一类进 waived 而不是 over', waived.waived.map(w => w.category), ['源码'])
  eq('没豁免的那一类仍在 over', waived.over.map(o => o.category), ['文档'])

  // 豁免之后这一类再涨多少都照样放行 —— 这是有意的缺口，挡它的是读 diff 的人（ADR-80）
  ok('豁免之后这一类又涨了 → 仍然放行',
    judge({ 源码: 4000, 测试: 0, 文档: 0, 其他: 0 }, [W('源码')], []).ok)

  // 同类多条豁免：有一条就够，不再挑「哪一条还没过期」（ADR-80 撤掉了新鲜度）
  ok('同类多条豁免 → 放行',
    judge({ 源码: 4000, 测试: 0, 文档: 0, 其他: 0 }, [W('源码'), W('源码')], []).ok)

  const bad = judge({ 源码: 0, 测试: 0, 文档: 0, 其他: 0 }, [], ['随便'])
  ok('写了不成立的 size-ok，即使没超线也失败 —— 否则它会被当成挡箭牌留在历史里', !bad.ok)
}

// 独立上下文先于实现写成：期望只出自接口提交里 TRUNK_CANDIDATES／GitAsk／Baseline／resolveBaseline
// 的契约说明（下文「第 N 步」就是 resolveBaseline 说明里的编号），外加 CONVENTIONS 第十节与 ADR-98
// 末两节；没读入口 size.ts 里现有的那段实现。写下时函数体只会抛「尚未实现」。
harness('体量闸门的起点：哪些提交算这条分支自己的 —— 喂假的 git 应答，逐步问、答不上来就停')
{
  // 假 sha 起成一眼认得出的名字，而且没有一个是字面的 `HEAD` 或主干名 ——
  // 第 5、6 步要的是解析出来的值，把字面量交给 git 的实现在这里拿不到答案
  const SHA_HEAD = 'sha-head', SHA_FORK = 'sha-fork', SHA_PARENT = 'sha-parent'
  const SHA_ORIGIN = 'sha-origin-main', SHA_MAIN = 'sha-main'
  // 本地 main 很久没拉：它与 HEAD 的共同祖先更靠前，从那儿列出来的提交里混着别人已合进主干的
  // （TRUNK_CANDIDATES 说明里「远端在前」的理由）
  const SHA_STALE_FORK = 'sha-stale-fork', SHA_OTHERS = 'sha-others-merged'
  const SHA_C1 = 'sha-c1', SHA_C2 = 'sha-c2'

  // 契约里每条命令的原文：尖括号换成解析出来的值，没加尖括号的 `HEAD`（第 4 步）照字面
  const Q_HEAD = 'rev-parse HEAD'                              // 第 1 步
  const Q_SHALLOW = 'rev-parse --is-shallow-repository'        // 第 2 步
  const Q_ORIGIN = 'rev-parse --verify origin/main^{commit}'   // 第 3 步，第一个候选
  const Q_MAIN = 'rev-parse --verify main^{commit}'            // 第 3 步，第二个候选
  const Q_BASE_ORIGIN = 'merge-base origin/main HEAD'          // 第 4 步，主干是 origin/main
  const Q_BASE_MAIN = 'merge-base main HEAD'                   // 第 4 步，主干是 main
  const Q_PARENT = `rev-parse ${SHA_HEAD}^1`                   // 第 5 步
  const Q_LIST_FORK = `rev-list ${SHA_FORK}..${SHA_HEAD}`      // 第 6 步，起点是共同祖先
  const Q_LIST_PARENT = `rev-list ${SHA_PARENT}..${SHA_HEAD}`  // 第 6 步，起点是上一版
  const Q_LIST_STALE = `rev-list ${SHA_STALE_FORK}..${SHA_HEAD}`

  /**
   * 一个在分支上的假仓库：两个候选都在，共同祖先不是 HEAD。每个用例只改它要改的那几条，
   * 改成 `null` = 那条命令失败（GitAsk 的约定）；表里没有的命令一律答不上来。
   * 「这条路径本不该问」的几条（本地 main 的共同祖先、HEAD 的上一版）也照真仓库填上答案 ——
   * 走错路的实现拿到的是一个看得出错在哪的值，而不是笼统的「答不上来」。
   */
  const onBranch = (over: Record<string, string | null> = {}): Record<string, string | null> => ({
    [Q_HEAD]: SHA_HEAD, [Q_SHALLOW]: 'false', [Q_ORIGIN]: SHA_ORIGIN, [Q_MAIN]: SHA_MAIN,
    [Q_BASE_ORIGIN]: SHA_FORK, [Q_BASE_MAIN]: SHA_STALE_FORK, [Q_PARENT]: SHA_PARENT,
    [Q_LIST_FORK]: `${SHA_C2}\n${SHA_C1}`, [Q_LIST_STALE]: `${SHA_C2}\n${SHA_C1}\n${SHA_OTHERS}`,
    [Q_LIST_PARENT]: SHA_HEAD,
    ...over,
  })
  /** 按命令原文查表交回预设答案，并按顺序记下被问过的每一条 */
  const run = (table: Record<string, string | null>) => {
    const asked: string[] = []
    const ask: GitAsk = (...args) => {
      // 契约里没有一个参数带空白；带了，说明整条命令被塞进了一个参数 —— 真 git 答不上来
      const q = args.some(a => /\s/.test(a)) ? `（整条命令塞进了一个参数）${JSON.stringify(args)}` : args.join(' ')
      asked.push(q)
      return Object.hasOwn(table, q) ? table[q] : null
    }
    // 实现之前函数体会抛；接住它，让每一条各自红，而不是整个文件在第一条上崩掉
    let got: Baseline | string
    try { got = resolveBaseline(ask) } catch (e) { got = `抛了：${e instanceof Error ? e.message : String(e)}` }
    return { got, asked }
  }
  // 整个对象比较不走 eq：eq 比的是 JSON 串，键的先后不同也算不等，一个写对了的实现会被冤红
  const exact = (label: string, got: unknown, want: unknown) => {
    const equal = isDeepStrictEqual(got, want)
    ok(label, equal)
    if (!equal) console.log(`     got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`)
  }
  /** 无从判断、而且 why 与 how 都有话（入口要照着说出来）→ 'cannot-answer'；否则原样交回，红的时候看得见是什么 */
  const refusal = (got: Baseline | string) =>
    typeof got !== 'string' && got.kind === 'cannot-answer' && got.why.trim() !== '' && got.how.trim() !== ''
      ? 'cannot-answer' : got
  const measure = (trunk: string, base: string, onTrunk: boolean, commits: string[]): Baseline =>
    ({ kind: 'measure', trunk, head: SHA_HEAD, base, onTrunk, commits })

  // TRUNK_CANDIDATES 的说明：「远端引用排在前面」
  eq('起点：主干候选的顺序 —— 远端 origin/main 在前，本地 main 在后', TRUNK_CANDIDATES, ['origin/main', 'main'])

  // ── 第 1、2 步：这里能不能算 ──────────────────────────────────────
  {
    const r = run(onBranch({ [Q_HEAD]: null }))
    eq('起点第 1 步：rev-parse HEAD 答不上来（不是仓库／没有提交）→ 无从判断，why 与 how 都有话',
      refusal(r.got), 'cannot-answer')
    eq('起点第 1 步答不上来就停：只问过 rev-parse HEAD', r.asked, [Q_HEAD])
  }
  {
    const r = run(onBranch({ [Q_SHALLOW]: 'true' }))
    eq('起点第 2 步：--is-shallow-repository 答 true（浅克隆）→ 无从判断', refusal(r.got), 'cannot-answer')
    eq('起点第 2 步答 true 就停：不再去找主干', r.asked, [Q_HEAD, Q_SHALLOW])
    // 契约第 2 步：答 true 时 how 说怎么取完整历史 —— 和「问不出来」那一支的结局一样是无从判断，
    // 分得开的只有这句怎么修（开 PR 前的独立审阅之后补）
    eq('起点第 2 步答 true：how 说怎么取完整历史（fetch-depth: 0 或 git fetch --unshallow）',
      typeof r.got !== 'string' && r.got.kind === 'cannot-answer' && /fetch-depth: 0|--unshallow/.test(r.got.how), true)
  }
  // 契约只写了答 true 怎么办；答不上来归开头那句总则「任何一步答不上来就停在那一步」——
  // 当成「不是浅克隆」接着量，是把「没查过」当成「查过、没有」
  {
    const r = run(onBranch({ [Q_SHALLOW]: null }))
    eq('起点第 2 步答不上来（总则：答不上来就停）→ 无从判断，不当成「不是浅克隆」',
      refusal(r.got), 'cannot-answer')
    eq('起点第 2 步答不上来就停：不再去找主干', r.asked, [Q_HEAD, Q_SHALLOW])
  }
  // 契约第 2 步：只有答 false 才往下走。2.15 以前的 git 不认识这个参数，会把它原样打回来、退出 0 ——
  // 那既不是 true 也不是「答不上来」，当成「不是浅克隆」接着量，就在浅克隆里报一个可能缩水的数（开 PR 前的独立审阅指出）
  {
    const r = run(onBranch({ [Q_SHALLOW]: '--is-shallow-repository' }))
    eq('起点第 2 步把参数原样打回来（旧 git）→ 无从判断，不当成「不是浅克隆」',
      refusal(r.got), 'cannot-answer')
    eq('起点第 2 步把参数原样打回来就停：不再去找主干', r.asked, [Q_HEAD, Q_SHALLOW])
  }

  // ── 第 3 步：找主干 ──────────────────────────────────────────────
  {
    const r = run(onBranch({ [Q_ORIGIN]: null, [Q_MAIN]: null }))
    eq('起点第 3 步：两个候选都答不上来 → 无从判断', refusal(r.got), 'cannot-answer')
    const why = typeof r.got !== 'string' && r.got.kind === 'cannot-answer' ? r.got.why : ''
    ok('起点第 3 步：why 点名了 origin/main', why.includes('origin/main'))
    // 「main」是「origin/main」的子串：只写了远端那一个，includes('main') 照样成立 —— 先抹掉再找
    ok('起点第 3 步：why 也点名了本地 main（抹掉 origin/main 之后还找得到 main）',
      why.replaceAll('origin/main', '').includes('main'))
    eq('起点第 3 步：按候选顺序各问一遍，都答不上来就停，不去取共同祖先', r.asked,
      [Q_HEAD, Q_SHALLOW, Q_ORIGIN, Q_MAIN])
  }
  {
    const r = run(onBranch({ [Q_ORIGIN]: null }))
    exact('起点第 3 步：只有本地 main → 主干取 main，拿它取共同祖先、列提交', r.got,
      measure('main', SHA_STALE_FORK, false, [SHA_C2, SHA_C1, SHA_OTHERS]))
    eq('起点第 3 步：先问 origin/main，答不上来再问 main', r.asked,
      [Q_HEAD, Q_SHALLOW, Q_ORIGIN, Q_MAIN, Q_BASE_MAIN, Q_LIST_STALE])
  }

  // ── 分支上：两个候选都在，共同祖先不是 HEAD ────────────────────────
  {
    const r = run(onBranch())
    // 第 3 步取第一个答得上来的 → origin/main（本地 main 的共同祖先更靠前，取错了 base 会是
    // sha-stale-fork、commits 里混进 sha-others-merged）；第 5 步「否则起点就是共同祖先」；
    // 第 6 步按行拆开，顺序照 rev-list 交回的
    exact('起点：分支上、两个候选都在 → 主干取 origin/main，从共同祖先量起，onTrunk=false', r.got,
      measure('origin/main', SHA_FORK, false, [SHA_C2, SHA_C1]))
    // 第 2 步答 false 接着往下问。契约没说第一个候选答上来之后还问不问后面的；
    // 这里按「取第一个答得上来的」读成不再问
    eq('起点：逐步问的完整顺序（分支上）—— 浅克隆答 false 接着问，origin/main 答上来就不再问 main', r.asked,
      [Q_HEAD, Q_SHALLOW, Q_ORIGIN, Q_BASE_ORIGIN, Q_LIST_FORK])
    eq('起点第 6 步（分支上）：rev-list 问的是 <共同祖先的 sha>..<HEAD 的 sha>，不是字面 HEAD 或主干名',
      r.asked.filter(q => q.startsWith('rev-list')), [Q_LIST_FORK])
  }
  {
    const r = run(onBranch({ [Q_BASE_ORIGIN]: null }))
    eq('起点第 4 步：merge-base 答不上来（HEAD 与主干没有共同祖先）→ 无从判断', refusal(r.got), 'cannot-answer')
    // 表里本地 main 的 merge-base 答得上来：退回去拿 main 再试的实现，上面那条也会红
    eq('起点第 4 步答不上来就停：不问上一版、不列提交，也不退回去拿 main 再试', r.asked,
      [Q_HEAD, Q_SHALLOW, Q_ORIGIN, Q_BASE_ORIGIN])
  }

  // ── 第 5 步：主干上（共同祖先就是 HEAD 自己）─────────────────────────
  {
    const r = run(onBranch({ [Q_BASE_ORIGIN]: SHA_HEAD }))
    exact('起点第 5 步：主干上（共同祖先就是 HEAD）→ 起点是 <HEAD>^1 的答案，onTrunk=true', r.got,
      measure('origin/main', SHA_PARENT, true, [SHA_HEAD]))
    eq('起点：逐步问的完整顺序（主干上）—— 共同祖先之后问 <HEAD>^1，再列提交', r.asked,
      [Q_HEAD, Q_SHALLOW, Q_ORIGIN, Q_BASE_ORIGIN, Q_PARENT, Q_LIST_PARENT])
    eq('起点第 6 步（主干上）：rev-list 问的是 <上一版的 sha>..<HEAD 的 sha>',
      r.asked.filter(q => q.startsWith('rev-list')), [Q_LIST_PARENT])
  }
  {
    const r = run(onBranch({ [Q_BASE_ORIGIN]: SHA_HEAD, [Q_PARENT]: null }))
    exact('起点第 5 步：主干上且没有上一版（<HEAD>^1 答不上来）→ 不适用，带主干名 origin/main', r.got,
      { kind: 'not-applicable', trunk: 'origin/main' })
    eq('主干首提交没有上一版时判不适用',
      typeof r.got === 'string' ? r.got : r.got.kind, 'not-applicable')
    eq('起点第 5 步 <HEAD>^1 答不上来就停：不再列提交', r.asked,
      [Q_HEAD, Q_SHALLOW, Q_ORIGIN, Q_BASE_ORIGIN, Q_PARENT])
  }
  {
    const r = run(onBranch({ [Q_ORIGIN]: null, [Q_BASE_MAIN]: SHA_HEAD, [Q_PARENT]: null }))
    exact('起点第 5 步：不适用时带的是选中的那个主干名 —— 只有本地 main 时是 main', r.got,
      { kind: 'not-applicable', trunk: 'main' })
  }

  // ── 第 6 步：这条分支自己的提交 ─────────────────────────────────────
  {
    const r = run(onBranch({ [Q_LIST_FORK]: null }))
    eq('起点第 6 步：rev-list 答不上来（总则：答不上来就停）→ 无从判断，不当成「没有提交」',
      refusal(r.got), 'cannot-answer')
  }
  {
    const r = run(onBranch({ [Q_LIST_FORK]: '' }))
    exact('起点第 6 步：rev-list 答空串 → 照量，commits 是空数组（不是 [""]，也不是无从判断）', r.got,
      measure('origin/main', SHA_FORK, false, []))
    eq('没有分支提交时列表为空数组',
      typeof r.got !== 'string' && r.got.kind === 'measure' ? r.got.commits : r.got, [])
  }
  {
    // GitAsk 已经去掉了首尾空白，只有夹在中间的空行能让「去掉空行」这句话被违反
    const r = run(onBranch({ [Q_LIST_FORK]: `${SHA_C2}\n\n${SHA_C1}` }))
    eq('起点第 6 步：按行拆开，夹在中间的空行去掉',
      typeof r.got !== 'string' && r.got.kind === 'measure' ? r.got.commits : r.got, [SHA_C2, SHA_C1])
  }
}

harness('引文遮罩：引用块里的围栏也要盖住')
{
  const m = (t: string) => quotedMask(t).map(b => b ? '1' : '0').join('')
  // 规范说围栏最多三个前导空格,而 `>` 不是空白 —— 不剥引用记号的话,写在引用块里
  // 的整段示例一行都遮不住。而这个仓库里举例的地方几乎都在引用块里
  eq('裸围栏照旧', m('a\n```\nx\n```\nb'), '01110')
  eq('引用块里的围栏也遮', m('> a\n> ```\n> x\n> ```\n> b'), '01110')
  eq('嵌两层也遮', m('>> ```\n>> x\n>> ```'), '111')
  eq('开的在引用块里、关的也要在', m('> ```\n> x\nx'), '111')
  // 只剥给围栏那一路:HTML 与注释仍看原行,免得多影响另外两个调用方
  eq('引用块里的注释不受这一改影响', m('> <!-- x -->\n> y'), '10')

  // 规范:反引号围栏的信息串里不许再有反引号。不判这一句的话,一行普通文字会被
  // 当成开启,到下一个闭合之间整段被遮住 —— 那中间可能正有一条真的重启条件
  eq('信息串里带反引号 → 不算开启', m('```js`\nx\ny'), '000')
  eq('波浪号围栏不受这条限制', m('~~~a`b\nx\n~~~'), '111')
  eq('正常信息串照旧开', m('```ts\nx\n```'), '111')
}

harness('欠条台账：三套写法怎么认，以及写了欠条不写重启条件')
{
  const doc = (text: string) => new Map([['docs/adr/X.md', text]])

  // 第一套必须带冒号。裸的「重启条件」三个字一大半不是条件,是在谈这个机制本身 ——
  // 仓库里 167 行只有 107 行是真条件,逐条分桶记在 ADR-86
  eq('全角冒号', entries(doc('> 重启条件：下一条碰 `x.ts` 的 PR')).length, 1)
  eq('半角冒号', entries(doc('> 重启条件:下一条')).length, 1)
  eq('四种后缀', entries(doc(
    '> 重启条件收紧：a\n\n> 重启条件不变：b\n\n> 重启条件放宽：c\n\n> 重启条件改为：d')).length, 4)
  eq('括注也算 —— ADR-70:2009 就长这样', entries(doc(
    '> 重启条件（扩范围档，按 `6-INTEGRATE.md`）：本 PR 已合入')).length, 1)
  // 闭集不是讲究:放开成「冒号之前随便什么」,下面这句叙述会被收成一条条件,
  // 而同一条判据还要拿去判孤儿 —— 一条叙述顶上去,真孤儿就报不出来了
  eq('叙述句不算条件', entries(doc('> 这是「重启条件响了没人提醒」的第四个实例：见上')).length, 0)
  eq('不带冒号不算', entries(doc('> 那条欠条的重启条件已经到期')).length, 0)

  // 第二、三套都是整节,判据是节标题加条目形状,不是某个词
  eq('重开讨论那一节,出了节就不算', entries(doc(
    '## 什么条件下重开这个讨论\n\n- **A 时**：x\n- **B 时**：y\n\n## 别的\n\n- **C**：z')).length, 2)
  eq('死亡条件那一节 —— 引子五花八门,共同点是引用块里的加粗', entries(doc(
    '## 死亡条件\n\n> **ADR-62 那条**：降到 5 个以下时\n\n> ⚠️ 欠条：另一回事 · 重启条件：x')).length, 2)
  eq('ADR-85 那种不挂在标题下的', entries(doc(
    '### `adr`\n\n> **什么条件下整个撤掉**：对手方全没了时')).length, 1)

  // 决策记录里有演示这些写法的命令与代码块。不盖住的话,一段教人怎么 grep 欠条的
  // 示例会变成一条真欠条 —— `quoted.ts` 的文件头写着凡按结构解析都要先过这一道
  eq('围栏里的示例不算', entries(doc('```bash\n# 重启条件：示例\n```')).length, 0)

  // 孤儿 = 块里没有重启条件的欠条。`docs/SYNC.md`:56 说带重启条件的欠条不算待办,
  // 反过来:不带的是纯待办,而待办不该住在决策记录里
  eq('块里有条件 → 不是孤儿', orphanIous(doc('> ⚠️ 欠条：缺 x\n> 重启条件：下次碰 y 时')).length, 0)
  eq('块里没有 → 孤儿', orphanIous(doc('> ⚠️ 欠条：缺 x，改天再说')).length, 1)
  // 定界要在第一个非 `>` 行停住。不停的话前一块白蹭后一块的条件 ——
  // 那正是「0 条孤儿」变成假话的方式,而 0 正是这道闸门放行的意思
  eq('相邻两块不许互相顶账', orphanIous(doc(
    '> ⚠️ 欠条：第一块，没写条件\n\n> ⚠️ 欠条：第二块\n> 重启条件：下次 x')).length, 1)
  eq('不带 > 的散块到空行为止', orphanIous(doc(
    '⚠️ 欠条：散块没写条件\n\n重启条件：这一行属于下一段')).length, 1)
  // 块内也要过遮罩:一段演示「欠条该怎么写」的围栏例子替这个块交了差的话,
  // 真孤儿就报不出来 —— 而漏报正是这道闸门放行的意思
  eq('块里只有围栏示例写着条件 → 仍是孤儿', orphanIous(doc(
    '⚠️ 欠条：缺 x\n照这个写：\n```\n重启条件：<条件>\n```')).length, 1)
  // 这个仓库的欠条块**都是引用块**,示例自然也写在 `> ` 里面 —— 头一版的遮罩
  // 不认这种围栏,等于给这道闸门留了一条绕过去的路(评审指出,实测确认)
  eq('引用块里的围栏同样遮得住', orphanIous(doc(
    '> ⚠️ 欠条：缺 x\n> ```\n> 重启条件：<条件>\n> ```')).length, 1)

  // 手搭的数据证不了真仓库。今天 88 个块 88 个都写了条件 —— 这道闸门是绿的,
  // 它拦的是往后的滑坡,不是现状
  const realAdr = new Map(readdirSync('docs/adr').filter(f => f.endsWith('.md'))
    .map(f => [`docs/adr/${f}`, rf(`docs/adr/${f}`, 'utf8')] as const))
  eq('真仓库里没有孤儿欠条', orphanIous(realAdr).map(o => `${o.file}:${o.line}`), [])
  eq('真仓库里三套写法都抽得到', new Set(entries(realAdr).map(e => e.notation)).size, 3)

  // 末尾那句限定不是客套:去掉它,读的人会把条数当成「还欠着这么多」,
  // 而这份清单根本不知道哪一条已经还了
  const sum = ledgerSummary(entries(realAdr))
  ok('汇总要写明不判已还', sum.includes('不判已还'))
  ok('汇总要写明不判踩没踩到', sum.includes('不判这次改动踩到了谁'))
}

// ═══════════ provider 的契约：fetch 换成罐头，把四条一直没人跑过的路走一遍 ═══════════
// 独立复核点出的结构性缺口：`TikHub.search()` **从未被任何测试直接调用过**。
// 于是 pickList 抛出、IG 兜底、预算卡在两次请求之间这几条路，在整条检查链里一次都没跑过 ——
// 而复核挖出的两个 blocking 就长在这几条路上。自检那层的假 fetch 永远返回认得出的结构，
// 够不到这里（ADR-94 第十五节）。
})
await group('d6-provider', async () => {
suite('D6', 'provider：请求发出去之后才坏掉的那几条路')
{
  const canned = (bodies: any[]) => {
    let n = 0
    const calls: string[] = []
    const fake = (async (input: any) => {
      calls.push(String(input))
      const b = bodies[Math.min(n++, bodies.length - 1)]
      if (b instanceof Error) throw b
      return new Response(JSON.stringify(b.body ?? b), { status: b.status ?? 200 })
    }) as unknown as typeof fetch
    return { fake, calls: () => calls }
  }
  const withFetch = async <T>(fake: typeof fetch, fn: () => Promise<T>): Promise<T> => {
    const real = globalThis.fetch
    globalThis.fetch = fake
    try { return await fn() } finally { globalThis.fetch = real }
  }
  const igTask = { keyword: 'smoothie', dimension: 'scene', platform: 'instagram' } as any
  const reelsWith = (n: number) => ({ data: { data: { count: n, items: Array.from({ length: n },
    (_, i) => ({ caption: { text: 'x' }, user: { username: 'u' + i, full_name: 'U' } })) } } })
  /** reels 返回了条目、但每条都取不出 username —— 解析读不懂，不是「没有内容」 */
  const reelsUnparseable = (n: number) => ({ data: { data: { count: n,
    items: Array.from({ length: n }, () => ({ caption: { text: 'x' }, nobody: {} })) } } })
  const usersWith = (n: number) => ({ data: { data: { items: Array.from({ length: n },
    (_, i) => ({ username: 'm' + i, full_name: 'M', id: String(i) })) } } })

  // ① IG 兜底：reels 有条目但解析不出人 → 改搜账号名。**两次的条数要相加。**
  //    只交回后一次的话，第一次已经付过钱、供应商也确实返回了 8 条，而盘上记着「拿回 0 条」。
  {
    const budget = fundedBudget()
    const { fake, calls } = canned([reelsUnparseable(8), usersWith(1)])
    const page = await withFetch(fake, () => new TikHub('k', budget).search(igTask, 'US', 0))
    eq('IG 兜底走了两次请求', calls().length, 2)
    eq('两次的条数相加，第一次那 8 条没被丢掉', page.raw_count, 9)
    eq('两次都计了费', budget.count, 2)
    // 这条路搜的是账号，响应里没有作品。写一个空数组就是替它说「问过了，没作品」——
    // 读 creators.json 做语义判定的那一步会据此把人判掉（P1.e、ADR-102）
    eq('兜底搜到的人不带作品字段 —— 没问过，不是没作品', 'recent_posts' in page.creators[0], false)
  }

  // ② 预算恰好卡在两次请求之间：**照常抛**，不许吞成正常返回。
  // ⚠️ 这一条头一版断言的是反面（「已经付过钱的那一页要交回去」）—— 把一个错误行为
  // 锁成了期望。吞掉之后交回的是一个解析不出人的 reels 页，入口据此（D6.u）当页把任务推进 `done`
  // **永久烧掉**：退出码 0、还说「续跑不产生新的请求」，而预算已经见底，
  // 追加预算续跑时它再也不会被碰（ADR-94 第十五节乙，实测）。
  {
    const budget = fundedBudget(3000)               // 只够一次 2000 的 IG 搜索
    const { fake, calls } = canned([reelsUnparseable(8)])
    let caught: unknown
    await withFetch(fake, async () => {
      try { await new TikHub('k', budget).search(igTask, 'US', 0) } catch (e) { caught = e }
    })
    ok('预算卡在两次之间时抛 budget-exceeded，不吞成正常返回', caught instanceof CostError && caught.code === 'budget-exceeded')
    eq('第二次请求根本没发出去', calls().length, 1)
    eq('第一次的钱记在预算上 —— 入口据此留下「问过」的痕迹', budget.count, 1)
  }
  criterion('D6.k')
  // ── D6 × P3：已经付过的那一页，和「预算用尽必须停」 ───────────────────────
  // 上面这一组量的正是那条裁决：兜底的第二次请求撞上预算时**照常抛**，
  // 第一次那一页的钱就此白花 —— 但那笔损失只是一个「拿回几条无从确认」，
  // 而吞掉它换来的是把一个可重试的任务永久烧进 `done`。P3 赢。
  tension('D6', 'P3')

  // ③ schema 漂移：200 已返回、钱已扣，解析认不出结构 → 抛。
  //    **这就是「游标答不了『问过没有』」的根源**：游标只在 search() 正常返回之后才写，
  //    而钱在这之前就扣了。入口那边靠预算计数器留下痕迹（D6.i），端到端那一半在自检里。
  {
    const budget = fundedBudget()
    const { fake } = canned([{ body: { data: { 全新的键: [] } } }])
    let threw = false
    await withFetch(fake, async () => {
      try { await new TikHub('k', budget).search(igTask, 'US', 0) } catch { threw = true }
    })
    ok('认不出结构时抛出，不静默产出空结果', threw)
    eq('但钱已经扣了 —— 这就是「发出过请求」的痕迹', budget.count, 1)
  }

  // ④ IG 不走 offset：第二页不白花请求（既有行为，这一组是它第一次被跑到）。
  {
    const budget = fundedBudget()
    const { fake, calls } = canned([reelsWith(2)])
    const page = await withFetch(fake, () => new TikHub('k', budget).search(igTask, 'US', 20))
    eq('IG 的第二页一个请求都不发', calls().length, 0)
    eq('也不谎报条数', page.raw_count, 0)
  }

  // ⑤ IG 续页令牌（ADR-111 第五节第 1 步：provider 读出、带上；入口怎么用见 D6.u、D6.v 与自检 d6uv-igpaging）。
  //    期望只出自 ADR-111 与对外契约：令牌在与 `data.data` 同级的 `data.pagination_token`，
  //    请求参数名是 `pagination_token`（固定官方规范）；兜底只属于第一页、
  //    不取账号名响应里的任何值作令牌、带令牌的续页不走兜底（ADR-111 第二节）。
  {
    const withToken = (body: any, token: unknown) => ({ data: Object.assign({}, body.data, { pagination_token: token }) })
    // 首页：请求一个字不变（不带令牌），响应里的令牌原样交回
    {
      const { fake, calls } = canned([withToken(reelsWith(2), 'tok-1')])
      const page = await withFetch(fake, () => new TikHub('k', fundedBudget()).search(igTask, 'US', 0))
      eq('首页请求不带续页令牌', new URL(calls()[0] ?? 'https://no.request/').searchParams.has('pagination_token'), false)
      eq('响应里的续页令牌原样交回', page.next_token, 'tok-1')
      eq('交回令牌不改「还有没有下一页」—— Reels 页仍是 false', page.has_more, false)
    }
    // 响应没给、或给的不是字符串 → 没有令牌，不编一个出来
    for (const [label, body] of [
      ['响应里没有续页令牌', reelsWith(2)],
      ['续页令牌是数字', withToken(reelsWith(2), 12345)],
      ['续页令牌是 null', withToken(reelsWith(2), null)],
    ] as const) {
      const { fake } = canned([body])
      const page = await withFetch(fake, () => new TikHub('k', fundedBudget()).search(igTask, 'US', 0))
      eq(`${label}时，搜索结果里没有令牌`, page.next_token, undefined)
    }
    // 带令牌：同一个端点、同一个关键词，多带一个 pagination_token；offset 大于 0 也照发
    {
      const budget = fundedBudget()
      const { fake, calls } = canned([withToken(reelsWith(2), 'tok-2')])
      const page = await withFetch(fake, () => new TikHub('k', budget).search(igTask, 'US', 2, 'tok-1'))
      eq('带令牌的续页发出一次请求', calls().length, 1)
      const u = new URL(calls()[0] ?? 'https://no.request/')   // 一次都没发时不崩，照常红在下面几条
      eq('续页请求的是 Reels 搜索', u.pathname, TEST_IG)
      eq('续页带上上一页交回的令牌', u.searchParams.get('pagination_token'), 'tok-1')
      eq('续页的关键词不变', u.searchParams.get('keyword'), 'smoothie')
      eq('续页交回这一页的令牌', page.next_token, 'tok-2')
      eq('续页照常计费', budget.count, 1)
    }
    // 续页解析不出人：不改搜账号名（兜底只属于第一页），条数照实交回
    {
      const { fake, calls } = canned([reelsUnparseable(8), usersWith(1)])
      const page = await withFetch(fake, () => new TikHub('k', fundedBudget()).search(igTask, 'US', 8, 'tok-1'))
      eq('续页解析不出人时不改搜账号名', calls().length, 1)
      eq('续页交回的人数就是 0', page.creators.length, 0)
      eq('续页的条数照实交回', page.raw_count, 8)
    }
    // 第一页走了兜底：两次响应里的令牌都不交回 —— 账号名那次的不是 Reels 的令牌，这个任务当页就结束
    {
      const { fake, calls } = canned([withToken(reelsUnparseable(8), 'reels-tok'), withToken(usersWith(1), 'users-tok')])
      const page = await withFetch(fake, () => new TikHub('k', fundedBudget()).search(igTask, 'US', 0))
      eq('兜底照常发了两次', calls().length, 2)
      eq('走了兜底的那一页没有令牌', page.next_token, undefined)
    }
    // 空白令牌：一个请求都不发、当场报错。请求参数里的空串会被丢掉，发出去就只带 keyword ——
    // 把首页当续页再买一遍，钱照付（评审指出）。报错而不是交回空页：交回空页会被入口读成「本页 0 条」，把调用方的错藏起来
    for (const blank of ['', '   ']) {
      const budget = fundedBudget()
      const { fake, calls } = canned([withToken(reelsWith(2), 'tok')])
      let threw = false
      await withFetch(fake, async () => {
        try { await new TikHub('k', budget).search(igTask, 'US', 2, blank) } catch { threw = true }
      })
      eq(`空白令牌 ${JSON.stringify(blank)} 一个请求都不发`, calls().length, 0)
      eq(`空白令牌 ${JSON.stringify(blank)} 不计费`, budget.count, 0)
      ok(`空白令牌 ${JSON.stringify(blank)} 当场报错，不静默交回空页`, threw)
    }
    // 没有令牌时，第二页照旧一个请求都不发（④ 的形状，令牌参数明写缺席）
    {
      const { fake, calls } = canned([withToken(reelsWith(2), 'tok')])
      await withFetch(fake, () => new TikHub('k', fundedBudget()).search(igTask, 'US', 2, undefined))
      eq('没有令牌时第二页仍不发请求', calls().length, 0)
    }
  }
  // ⚠️ **这一组不认领 D6.i** —— 它一次都没打开过 `task.json`，而 D6.i 说的正是
  // 「`task.json` 必须记下…」。认领它不只是多说一句：`spec-rule.ts` 那道
  // 「只由自检认领的判据必须有一条 by:"selfcheck" 负片」的硬失败，**只要单元这边
  // 认领了就整条跳过** —— 这一行的实际作用是给 D6.i 常年免掉那道闸
  // （独立复核用对照实验证明的，ADR-94 第十五节丙）。D6.i 的证据全在 selfcheck.ts。
}

// 独立上下文先于实现写成；只依据 D12、ADR-107 接口及固定价目证据，未读产品函数体。
})
await group('d12-ledger', () => {
suite('D12', '费用金额按端点与历史价目记账，未知不能变成新增额度')
{
  const max = Number.MAX_SAFE_INTEGER
  const exact = (label: string, got: unknown, want: unknown) => {
    const equal = isDeepStrictEqual(got, want)
    if (!equal) console.log(`     got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`)
    ok(label, equal)
  }
  type Cost = ReturnType<typeof createCostBudget>
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
  const price = (endpoint: string, unit_micro_usd: number, price_version = 'old') =>
    ({ endpoint, price_version, unit_micro_usd })
  const catalog = { old: { '/tt': 1000, '/ig': 2000 }, newer: { '/tt': 3000, '/ig': 4000 }, free: { '/zero': 0 } }
  const tt = price('/tt', 1000), ig = price('/ig', 2000), zero = price('/zero', 0, 'free')
  const fresh = (limit = 10000) => createCostBudget(limit, 'task', catalog)
  const failure = (label: string, run: () => unknown, code: string, budget?: Cost) => {
    const before = budget?.snapshot()
    let error: unknown
    try { run() } catch (caught) { error = caught }
    ok(label, error instanceof CostError && error.code === code)
    if (budget) exact(`${label}：拒绝后完整快照不变`, budget.snapshot(), before)
  }
  const succeeds = (label: string, run: () => void) => {
    let completed = false, error: unknown
    try { run(); completed = true } catch (caught) { error = caught }
    ok(label, completed)
    if (!completed) console.log(`     escaped=${error instanceof Error ? error.name : typeof error}`)
  }
  const money = (budget: Cost) => {
    const s = budget.summary()
    return [s.occupied_micro_usd, s.remaining_micro_usd, s.http_200_micro_usd,
      s.unknown_result_micro_usd, s.pending_micro_usd, s.requests,
      s.http_200_count, s.unknown_result_count, s.pending_count]
  }
  const validTokens: [string, number][] = [['0', 0], ['-0', 0], ['0.000001', 1], ['0.005', 5000],
    ['0.0010000', 1000], ['1e-6', 1], ['10e-7', 1], ['5E-3', 5000], ['-0e999', 0],
    ['9007199254.740990', max - 1], ['9007199254.740991', max]]
  for (const [token, micros] of validTokens) exact(`原始十进制精确转换 ${token}`, parseUsdMicros(token), micros)
  for (const value of ['', ' ', 'NaN', 'Infinity', '0x10', '-0.000001', '0.0000001', '1e', '1.2.3',
    '0.00499999999999999999999999999999999999999', '9007199254.740992', '1e1000000000',
    '1e-1000000000', 0, 0.005, null, undefined, true, [], {}])
    failure(`非法或不可精确表示的美元 ${String(value)}`, () => parseUsdMicros(value as any), 'invalid-money')
  let impreciseError: unknown
  try { parseUsdMicros('0.00499999999999999999999999999999999999999') }
  catch (error) { impreciseError = error }
  ok('原始金额超微美元精度必须拒绝而非舍入',
    impreciseError instanceof CostError && impreciseError.code === 'invalid-money')
  criterion('D12.a')
  for (const [micros, text] of [[0, '0'], [1, '0.000001'], [1000, '0.001'], [5000, '0.005'],
    [1000001, '1.000001'], [max, '9007199254.740991']] as [number, string][])
    exact(`金额显示不改动 ${micros} 微美元`, formatUsd(micros), text)
  for (const value of [-1, 0.5, max + 1, NaN, Infinity, '5000', null]) {
    failure(`拒绝非法展示金额 ${String(value)}`, () => formatUsd(value as any), 'invalid-money')
    failure(`拒绝非法新建上限 ${String(value)}`, () => createCostBudget(value as any, 'task', catalog), 'invalid-money')
  }
  eq('五千微美元必须完整显示为 0.005', formatUsd(5000), '0.005')
  criterion('D12.b')

  // 数值由2026-09-23官方定价资产独立摘录，来源见 ADR-107 末尾。
  const version = 'tikhub-public-20260720-5d52fe8fb109'
  const expectedPrices: Record<string, number> = {
    '/api/v1/tiktok/app/v3/fetch_video_search_result': 1000,
    '/api/v1/tiktok/web/fetch_user_profile': 1000,
    '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3': 1000,
    '/api/v1/instagram/v2/search_reels': 2000,
    '/api/v1/instagram/v2/search_users': 2000,
    '/api/v1/instagram/v1/fetch_user_info_by_username_v3': 1000,
    '/api/v1/instagram/v1/fetch_user_info_by_username_v2': 1000,
    '/api/v1/instagram/v2/fetch_user_posts': 2000,
    // 话题端点：同一份定价资产（SHA256 与本版本记录的一致）里的原始元组
    // ["/api/v1/instagram/v2/fetch_hashtag_posts",0.002,0,0,"10/second"]，0.002 USD = 2000 微美元；
    // 用户本地只读核对，见 ADR-112 第五节。登记价目不等于接入生产路径（ADR-112 第三、四节）。
    '/api/v1/instagram/v2/fetch_hashtag_posts': 2000,
  }
  exact('当前价目版本绑定固定证据', TIKHUB_PRICE_VERSION, version)
  exact('本版只列九条已核端点：八条缺省生产端点与显式开启时才请求的话题端点', TIKHUB_PRICE_CATALOG, { [version]: expectedPrices })
  ok('价目表两层均冻结', Object.isFrozen(TIKHUB_PRICE_CATALOG) && Object.values(TIKHUB_PRICE_CATALOG).every(Object.isFrozen))
  for (const [endpoint, amount] of Object.entries(expectedPrices)) {
    exact(`固定报价 ${endpoint}`, quoteTikHub(endpoint), price(endpoint, amount, version))
    exact(`历史版本解析 ${endpoint}`, resolveTikHubPrice(version, endpoint), price(endpoint, amount, version))
    const quoted = quoteTikHub(endpoint)
    try { (quoted as any).unit_micro_usd = 0 } catch { /* 冻结副本同样保护价目。 */ }
    exact(`外部改报价不改固定表 ${endpoint}`, quoteTikHub(endpoint), price(endpoint, amount, version))
  }
  for (const endpoint of ['/api/v1/instagram/v2/search_reels/', '/api/v1/instagram/v2/search_hashtag', '/unknown', 'toString'])
    failure(`未知完整端点不得套价 ${endpoint}`, () => quoteTikHub(endpoint), 'unknown-price')
  failure('未知历史版本不得换当前价格', () => resolveTikHubPrice('missing', Object.keys(expectedPrices)[0]), 'unknown-price')
  criterion('D12.c')

  const mixed = fresh(5000)
  exact('显式新建才产生空账', mixed.snapshot(), { cost_ledger: { schema: 1, currency: 'USD', unit: 'micro_usd',
    scope: 'task', limit_micro_usd: 5000, next_attempt_id: 1, entries: [] }, requests: 0 })
  exact('process 范围由显式创建保留', createCostBudget(0, 'process', catalog).snapshot().cost_ledger.scope, 'process')
  criterion('D12.q')
  const first = mixed.reserve(tt)
  exact('预留占用金额但不冒充发出次数', money(mixed), [1000, 4000, 0, 0, 1000, 0, 0, 0, 1])
  eq('未结预留不计入净请求数', mixed.summary().requests, 0)
  failure('已有未结项不再预留', () => mixed.reserve(ig), 'pending-attempt', mixed)
  mixed.settle(first, { kind: 'http', status: 200 })
  exact('200 只转换状态，不重复累计金额', money(mixed), [1000, 4000, 1000, 0, 0, 1, 1, 0, 0])
  eq('HTTP 200 结算保留该次金额', mixed.summary().http_200_micro_usd, 1000)
  failure('200 后正文失败不能再退款', () => mixed.settle(first, { kind: 'http', status: 500 }), 'invalid-receipt', mixed)
  for (let i = 0; i < 2; i++) mixed.settle(mixed.reserve(ig), { kind: 'http', status: 200 })
  // 手算：1000 + 2×2000 = 5000；混合端点净次数为 3，不能按次数×1000。
  exact('不同价格恰好用满允许且汇总完整', mixed.summary(), { limit_micro_usd: 5000, occupied_micro_usd: 5000,
    remaining_micro_usd: 0, http_200_micro_usd: 5000, unknown_result_micro_usd: 0, pending_micro_usd: 0,
    requests: 3, http_200_count: 3, unknown_result_count: 0, pending_count: 0 })
  exact('同价聚合且保留首次留存顺序', mixed.snapshot().cost_ledger.entries,
    [{ ...tt, http_200_count: 1, unknown_result_count: 0 }, { ...ig, http_200_count: 2, unknown_result_count: 0 }])
  const capped = fresh(1000)
  capped.settle(capped.reserve(tt), { kind: 'http', status: 200 })
  const cappedBefore = capped.snapshot()
  let capError: unknown
  try { capped.reserve(tt) } catch (error) { capError = error }
  ok('预算金额超限时预留必须报错', capError instanceof CostError && capError.code === 'budget-exceeded')
  ok('预算拒绝后整本账和净次数不变', isDeepStrictEqual(capped.snapshot(), cappedBefore))
  failure('超过上限拒绝且不增加尝试序号', () => mixed.reserve(tt), 'budget-exceeded', mixed)
  const tight = fresh(3000)
  tight.settle(tight.reserve(ig), { kind: 'http', status: 200 })
  failure('3000 只够一次 2000，剩余不够第二次', () => tight.reserve(ig), 'budget-exceeded', tight)
  criterion('D12.e', 'D12.f', 'D12.g', 'D12.h')

  for (const status of [100, 199, 201, 204, 301, 400, 402, 429, 500, 599]) {
    const budget = fresh(), kept = budget.reserve(tt)
    budget.settle(kept, { kind: 'http', status: 200 })
    const refund = budget.reserve(ig)
    budget.settle(refund, { kind: 'http', status })
    exact(`HTTP ${status} 只退本次 2000，保留此前 1000`, money(budget), [1000, 9000, 1000, 0, 0, 1, 1, 0, 0])
    if (status === 429) eq('非 200 只退本次费用且不加净次数',
      [budget.summary().occupied_micro_usd, budget.summary().requests], [1000, 1])
    failure(`HTTP ${status} 不允许重复退款`, () => budget.settle(refund, { kind: 'http', status }), 'invalid-receipt', budget)
  }
  criterion('D12.i')
  const uncertain = fresh()
  uncertain.settle(uncertain.reserve(tt), { kind: 'http', status: 200 })
  uncertain.settle(uncertain.reserve(ig), { kind: 'no_http_status' })
  exact('无 HTTP 状态保留同额但与 200 分开', money(uncertain), [3000, 7000, 1000, 2000, 0, 2, 1, 1, 0])
  eq('费用占用包括未知结果的保守留存', uncertain.summary().occupied_micro_usd, 3000)
  eq('无 HTTP 状态的金额列入未知结果保守留存', uncertain.summary().unknown_result_micro_usd, 2000)
  exact('未知结果独立记数', uncertain.snapshot().cost_ledger.entries[1], { ...ig, http_200_count: 0, unknown_result_count: 1 })
  criterion('D12.j')

  const owner = fresh(), foreign = fresh(), ownReceipt = owner.reserve(tt), otherReceipt = foreign.reserve(ig)
  const otherBefore = foreign.snapshot()
  failure('外来凭据不能消费本账预留', () => owner.settle(otherReceipt, { kind: 'http', status: 429 }), 'invalid-receipt', owner)
  exact('拒绝外来凭据也不改变所属账', foreign.snapshot(), otherBefore)
  failure('快照字段不能伪造可退款凭据', () => owner.settle(owner.snapshot().cost_ledger.pending as any,
    { kind: 'http', status: 429 }), 'invalid-receipt', owner)
  for (const outcome of [null, {}, { kind: 'other' }, ...[99, 600, 200.5, NaN, Infinity, '200', null]
    .map(status => ({ kind: 'http', status }))])
    failure(`非法结算不消费凭据 ${JSON.stringify(outcome)}`, () => owner.settle(ownReceipt, outcome as any), 'invalid-outcome', owner)
  owner.settle(ownReceipt, { kind: 'http', status: 200 })
  exact('此前非法结算之后原凭据仍能成功结算', owner.summary().requests, 1)
  let duplicateError: unknown
  try { owner.settle(ownReceipt, { kind: 'no_http_status' }) } catch (error) { duplicateError = error }
  ok('终态凭据再次消费必须拒绝', duplicateError instanceof CostError && duplicateError.code === 'invalid-receipt')
  failure('终态后再次消费原凭据拒绝', () => owner.settle(ownReceipt, { kind: 'no_http_status' }), 'invalid-receipt', owner)
  foreign.settle(otherReceipt, { kind: 'http', status: 429 })
  criterion('D12.k')

  const raw = { schema: 1, currency: 'USD', unit: 'micro_usd', scope: 'task', limit_micro_usd: 10000,
    next_attempt_id: 4, entries: [{ ...tt, http_200_count: 2, unknown_result_count: 0 },
      { ...ig, http_200_count: 0, unknown_result_count: 1 }] }
  eq('历史单价与已声明版本不符必须拒绝', inspectExistingCostLedger({ ...raw,
    entries: [{ ...raw.entries[0], unit_micro_usd: 1001 }] }, 2, catalog).status, 'invalid-ledger')
  const unavailable = (label: string, ledger: unknown, requests: unknown, status: string) => {
    const original = structuredClone({ ledger, requests })
    const seen = inspectExistingCostLedger(ledger, requests, catalog)
    exact(`${label}：按证据分类`, seen.status, status)
    exact(`${label}：不带伪造金额或快照`, Object.keys(seen).sort(), ['problems', 'status'])
    ok(`${label}：原因逐项可读`, seen.problems.length > 0 && seen.problems.every(p =>
      typeof p.path === 'string' && typeof p.reason === 'string' && p.reason.length > 0))
    let error: unknown
    try { restoreCostBudget(ledger, requests, catalog) } catch (caught) { error = caught }
    ok(`${label}：恢复使用专门错误`, error instanceof CostLedgerUnavailable)
    if (error instanceof CostLedgerUnavailable) exact(`${label}：恢复保留同样诊断`,
      { status: error.status, problems: error.problems }, { status: seen.status, problems: seen.problems })
    exact(`${label}：读入失败不改原件`, { ledger, requests }, original)
  }
  eq('费用账缺席不因请求数为零补造金额', inspectExistingCostLedger(undefined, 0, catalog).status, 'unknown-history')
  for (const requests of [0, 3, undefined]) unavailable('旧记录费用字段缺席不补零', undefined, requests, 'unknown-history')
  criterion('D12.r')
  for (const ledger of [null, {}, [], 'bad']) unavailable('损坏费用账不当新任务', ledger, 0, 'invalid-ledger')
  unavailable('未来 schema 无从解释', { ...raw, schema: 2 }, 3, 'unavailable-evidence')
  unavailable('未知历史价格不以当前版代替', { ...raw, entries: [{ ...raw.entries[0], price_version: 'missing' }] }, 2, 'unavailable-evidence')
  criterion('D12.t')
  for (const patch of [{ currency: 'EUR' }, { unit: 'usd' }, { scope: 'other' }, { limit_micro_usd: -1 },
    { limit_micro_usd: 0.5 }, { next_attempt_id: 0 }, { next_attempt_id: max + 1 }, { entries: null }])
    unavailable('账目结构必须完整有效', { ...raw, ...patch }, 3, 'invalid-ledger')
  for (const [label, entries] of [['稀疏条目数组', new Array(1)], ['null 条目', [null]]] as const) {
    let escaped: unknown
    try { unavailable(`${label}是普通坏账`, { ...raw, entries }, 0, 'invalid-ledger') }
    catch (error) { escaped = error }
    ok(`${label}按坏账诊断，不泄漏原生异常`, escaped === undefined)
    if (escaped !== undefined) console.log(`     escaped=${escaped instanceof Error ? escaped.name : typeof escaped}`)
  }
  let sparseVerdict: string
  try { sparseVerdict = inspectExistingCostLedger({ ...raw, entries: new Array(1) }, 0, catalog).status }
  catch { sparseVerdict = 'native-exception' }
  eq('稀疏费用条目按坏账诊断而不泄漏原生异常', sparseVerdict, 'invalid-ledger')
  unavailable('算术自洽也不自动合并重复聚合键', { ...raw, entries: [raw.entries[0], raw.entries[0]] }, 4, 'invalid-ledger')
  for (const patch of [{ endpoint: '/missing' }, { unit_micro_usd: 0 }, { unit_micro_usd: 1001 },
    { http_200_count: -1, unknown_result_count: 3 }, { http_200_count: 0.5, unknown_result_count: 1.5 },
    { http_200_count: '2' }, { unknown_result_count: undefined },
    { http_200_count: max }, { unit_micro_usd: Infinity }])
    unavailable('价目与次数不符不得修补', { ...raw, entries: [{ ...raw.entries[0], ...patch }] }, 2, 'invalid-ledger')
  for (const requests of [0, 4, -1, 1.5, '3', undefined, NaN]) unavailable('外部净次数须与账一致', raw, requests, 'invalid-ledger')
  const damagedRequestsBook = clone(raw)
  eq('非法盘上请求数不得重置为零账',
    inspectExistingCostLedger(damagedRequestsBook, '3', catalog).status, 'invalid-ledger')
  // 9007199254740×1000 本身安全；再加 2000 超过最大安全微美元，次数之和仍安全。
  const almost = { ...tt, http_200_count: 9007199254740, unknown_result_count: 0 }
  unavailable('分项安全但总金额溢出仍拒绝', { ...raw, entries: [almost, { ...ig, http_200_count: 1,
    unknown_result_count: 0 }] }, 9007199254741, 'invalid-ledger')
  unavailable('pending 加入后溢出仍拒绝', { ...raw, entries: [almost], pending: { ...ig, attempt_id: 3 } },
    9007199254740, 'invalid-ledger')
  unavailable('两种净计数相加不得溢出', { ...raw, entries: [{ ...zero, http_200_count: max,
    unknown_result_count: 1 }] }, max, 'invalid-ledger')
  criterion('D12.d')

  const live = fresh(), liveReceipt = live.reserve(ig), liveSnapshot = live.snapshot()
  const resumed = restoreCostBudget(liveSnapshot.cost_ledger, liveSnapshot.requests, catalog)
  exact('恢复未结项原样保留占用与净次数', money(resumed), [2000, 8000, 0, 0, 2000, 0, 0, 0, 1])
  const pendingAgain = restoreCostBudget(liveSnapshot.cost_ledger, liveSnapshot.requests, catalog)
  let pendingError: unknown
  try { pendingAgain.reserve(tt) } catch (error) { pendingError = error }
  ok('恢复未结项后不得新增预留', pendingError instanceof CostError && pendingError.code === 'pending-attempt')
  failure('恢复未结项不能再预留', () => resumed.reserve(tt), 'pending-attempt', resumed)
  failure('恢复对象也不能消费原进程凭据', () => resumed.settle(liveReceipt, { kind: 'http', status: 429 }), 'invalid-receipt', resumed)
  live.settle(liveReceipt, { kind: 'http', status: 200 })
  exact('恢复操作不消费活账的原凭据', live.summary().requests, 1)
  criterion('D12.m')
  const input = clone(raw), historicalCatalog = clone(catalog)
  const history = restoreCostBudget(input, 3, historicalCatalog)
  exact('旧版金额 2×1000 + 1×2000 保留', money(history), [4000, 6000, 2000, 2000, 0, 3, 2, 1, 0])
  input.entries[0].http_200_count = 0; input.limit_micro_usd = 0
  historicalCatalog.old['/tt'] = 1; historicalCatalog.newer['/ig'] = 1
  history.settle(history.reserve(price('/ig', 4000, 'newer')), { kind: 'http', status: 200 })
  exact('新版只影响新请求，旧版不重算', money(history), [8000, 2000, 6000, 2000, 0, 4, 3, 1, 0])
  exact('旧项版本单价仍完整保存', history.snapshot().cost_ledger.entries.slice(0, 2), raw.entries)
  criterion('D12.s')

  const detached = history.snapshot(), detachedSummary = history.summary()
  try { (detached as any).cost_ledger.entries[0].http_200_count = 0; (detached as any).cost_ledger.limit_micro_usd = 0;
    (detached as any).requests = 0; (detachedSummary as any).occupied_micro_usd = 0 } catch { /* 冻结副本也可拒绝外部修改。 */ }
  exact('调用方改快照和汇总不能改内账', money(history), [8000, 2000, 6000, 2000, 0, 4, 3, 1, 0])
  eq('外部改快照不能改变内账占用金额', history.summary().occupied_micro_usd, 8000)
  criterion('D12.v')
  const externalCatalog = clone(catalog), isolated = createCostBudget(2000, 'task', externalCatalog)
  externalCatalog.old['/ig'] = 1
  const invalidPriceBefore = isolated.snapshot()
  failure('外部改价目不能替内账生成低价', () => isolated.reserve(price('/ig', 1)), 'unknown-price', isolated)
  ok('非法报价被拒后尝试序号与账目原样不动', isDeepStrictEqual(isolated.snapshot(), invalidPriceBefore))
  succeeds('外部改价目后，合法固定价仍可预留并结算', () => {
    const mutablePrice = { ...ig }, isolatedReceipt = isolated.reserve(mutablePrice)
    mutablePrice.unit_micro_usd = 0
    isolated.settle(isolatedReceipt, { kind: 'http', status: 200 })
    exact('预留报价引用不会改变结算金额', isolated.summary().occupied_micro_usd, 2000)
  })
  criterion('D12.u')
  const checked = inspectExistingCostLedger(raw, 3, catalog)
  ok('合法历史记录可检查', checked.status === 'known')
  if (checked.status === 'known') {
    exact('合法账无诊断问题', checked.problems, [])
    exact('检查保留已知账与净次数', checked.snapshot, { cost_ledger: raw, requests: 3 })
    exact('检查直接返回准确金额摘要', checked.summary, { limit_micro_usd: 10000, occupied_micro_usd: 4000,
      remaining_micro_usd: 6000, http_200_micro_usd: 2000, unknown_result_micro_usd: 2000, pending_micro_usd: 0,
      requests: 3, http_200_count: 2, unknown_result_count: 1, pending_count: 0 })
    try { (checked.snapshot as any).cost_ledger.entries[0].unit_micro_usd = 0 } catch { /* 冻结副本也可保护原件。 */ }
    exact('检查输出不改原始账', raw.entries[0].unit_micro_usd, 1000)
  }
  const zeroBook = createCostBudget(0, 'task', catalog)
  zeroBook.settle(zeroBook.reserve(zero), { kind: 'http', status: 200 })
  exact('合法零价仍计真实净次数', money(zeroBook), [0, 0, 0, 0, 0, 1, 1, 0, 0])
  failure('零预算也不替未知路径套零价', () => zeroBook.reserve(price('/missing', 0)), 'unknown-price', zeroBook)
  const exhausted = restoreCostBudget({ ...raw, next_attempt_id: max, entries: [] }, 0, catalog)
  failure('尝试序号递增溢出保持原账', () => exhausted.reserve(zero), 'invalid-money', exhausted)
  succeeds('净次数达安全上界仍能零价预留，溢出拒绝后可按429结算', () => {
    const fullCount = restoreCostBudget({ ...raw, entries: [{ ...zero, http_200_count: max, unknown_result_count: 0 }] }, max, catalog)
    const overflowReceipt = fullCount.reserve(zero)
    failure('终态计数溢出不能部分记账', () => fullCount.settle(overflowReceipt, { kind: 'http', status: 200 }), 'invalid-money', fullCount)
    fullCount.settle(overflowReceipt, { kind: 'http', status: 429 })
    exact('结算失败仍保留原凭据供有效终态处理', fullCount.summary().requests, max)
  })
  const overdrawn = restoreCostBudget({ ...raw, limit_micro_usd: 3000 }, 3, catalog)
  exact('已知超额账余额保留负数', overdrawn.summary().remaining_micro_usd, -1000)
  failure('已超额不能因零价获得新请求资格', () => overdrawn.reserve(zero), 'budget-exceeded', overdrawn)
  criterion('D12.w')
  ok('费用依据是可读声明', typeof TIKHUB_PRICE_BASIS === 'string')
  ok('依据声明固定公开基础价', /固定/.test(TIKHUB_PRICE_BASIS) && /公开/.test(TIKHUB_PRICE_BASIS) && /基础/.test(TIKHUB_PRICE_BASIS))
  ok('依据声明不计优惠', /不计优惠/.test(TIKHUB_PRICE_BASIS))
  ok('依据明确非实际账单', /(?:非|不是).{0,6}账单/.test(TIKHUB_PRICE_BASIS))
  ok('依据不保证供应商未来价格', /(?:不保证|不作为|不是|非).*(?:未来|将来|价格上)/.test(TIKHUB_PRICE_BASIS))
  criterion('D12.p')
  tension('D12', 'P1'); tension('D12', 'P3'); tension('D12', 'P5')
}

})
if (fullRun) {
suite('D13', '实际 HTTP 状态先结算；正文失败、无状态和本地失败彼此不同')
{
  const methods: [string, (api: TikHub) => Promise<unknown>][] = [
    ['TT 搜索', api => api.search({ keyword: 'k', dimension: 'category', platform: 'tiktok' }, 'US', 0)],
    ['IG 搜索', api => api.search({ keyword: 'k', dimension: 'category', platform: 'instagram' }, 'US', 0)],
    ['TT profile', api => api.profile('u', 'tiktok')], ['IG profile', api => api.profile('u', 'instagram')],
    ['TT posts', api => api.recentPosts('u', 'tiktok')], ['IG posts', api => api.recentPosts('u', 'instagram')],
  ]
  const realFetch = globalThis.fetch, realTimeout = globalThis.setTimeout
  globalThis.setTimeout = ((fn: () => void) => { fn(); return 0 }) as unknown as typeof setTimeout
  try {
    for (const [name, call] of methods) for (const first of [200, 201, 204, 429, 500, 'no-status'] as const) {
      await costSucceeds(`${name} ${first} 的费用结算检查完整执行`, async () => {
        const b = fundedBudget(100000), attempts: { path: string; status: number | 'no-status' }[] = []
        const atBody: [number | null, string | null, string | null, string | null][] = []
        globalThis.fetch = (async (input: RequestInfo | URL) => {
          const path = new URL(String(input)).pathname, status = attempts.length ? 200 : first
          attempts.push({ path, status })
          if (status === 'no-status') throw new Error('test fetch rejected before HTTP status')
          const response = new Response(null, { status })
          const badBody = async () => {
            const view = b.view()
            atBody.push([b.count, view.cost_http_200_usd, view.cost_unknown_result_usd, view.cost_pending_usd])
            throw new Error('test body read failed after HTTP status')
          }
          // 每次实际响应都坏正文；所有重试仍由真实 provider 决定，不把重试次数当结算 oracle。
          response.json = badBody; response.text = badBody
          return response
        }) as typeof fetch
        let returned = false
        try { await call(new TikHub('k', b)); returned = true } catch { /* 业务错误是测试输入，检查留存与撤销。 */ }
        ok(`${name}/${first} 坏正文或非200不变成正常结果`, !returned)
        ok(`${name}/${first} 至少实际发出一次 fake fetch`, attempts.length > 0)
        let http = 0, unknown = 0, net = 0
        for (const attempt of attempts) {
          const price = TEST_PRICES[attempt.path]
          ok('实际路径必须是已核报价端点', Number.isSafeInteger(price))
          if (attempt.status === 200) { http += price; net++ }
          if (attempt.status === 'no-status') { unknown += price; net++ }
        }
        eq(`${name}/${first} 金额按每次实际端点状态手算`,
          [b.count, b.view().cost_estimate_usd, b.view().cost_http_200_usd, b.view().cost_unknown_result_usd, b.view().cost_pending_usd],
          [net, testUsd(http + unknown), testUsd(http), testUsd(unknown), '0'])
        if (first !== 'no-status' && atBody.length) {
          eq(`${name}/${first} 读第一次正文前已按HTTP结算且无pending`, atBody[0],
            [first === 200 ? 1 : 0, first === 200 ? testUsd(TEST_PRICES[attempts[0].path]) : '0', '0', '0'])
        }
      })
    }
    await costSucceeds('本地等待失败不伪造 fetch 无状态留存', async () => {
      const b = fundedBudget(), calls: string[] = []; let waits = 0
      globalThis.fetch = (async (input: RequestInfo | URL) => { calls.push(String(input)); return new Response('retry', { status: 429 }) }) as typeof fetch
      globalThis.setTimeout = (() => { waits++; throw new Error('test local wait failed') }) as unknown as typeof setTimeout
      try { await methods[0][1](new TikHub('k', b)) } catch { /* 等待没有完成，不能当成未收到HTTP。 */ }
      ok('本地等待故障确实注入', waits > 0)
      eq('没有HTTP200或无状态 fetch，不增加净费用', [b.count, b.view().cost_estimate_usd, b.view().cost_unknown_result_usd, b.view().cost_pending_usd], [0, '0', '0', '0'])
      ok('等待失败后没有继续重试', calls.length <= 1)
    })
    globalThis.setTimeout = ((fn: () => void) => { fn(); return 0 }) as unknown as typeof setTimeout
    await costSucceeds('费用错误穿透 profile fallback 与搜索', async () => {
      let injected: unknown
      try { quoteTikHub('/test-unpriced') } catch (error) { injected = error }
      ok('注入来自公开报价接口的 unknown-price', injected instanceof CostError && injected.code === 'unknown-price')
      for (const [name, call] of methods) for (const phase of ['reserve', 'settle'] as const) {
        const b = fundedBudget(), paths: string[] = []; let touched = false, caught: unknown
        if (phase === 'reserve') b.reserve = () => { touched = true; throw injected }
        else b.settle = () => { touched = true; throw injected }
        globalThis.fetch = (async (input: RequestInfo | URL) => {
          paths.push(new URL(String(input)).pathname); return new Response('{"items":[]}', { status: 200 })
        }) as typeof fetch
        try { await call(new TikHub('k', b)) } catch (error) { caught = error }
        ok(`${name}/${phase} 注入方法确实执行`, touched)
        ok(`${name}/${phase} 同一个费用错误穿透，不改成供应商失败`, caught === injected)
        eq(`${name}/${phase} 不触发重试或fallback`, paths.length, phase === 'reserve' ? 0 : 1)
      }
    })
    await costSucceeds('无key只在付费点拒绝，零请求路径仍可执行', async () => {
      const b = fundedBudget(), api = new TikHub(undefined, b); let fetched = 0
      globalThis.fetch = (async () => { fetched++; return new Response('{}', { status: 200 }) }) as typeof fetch
      await api.search({ keyword: 'k', dimension: 'category', platform: 'instagram' }, 'US', 20)
      eq('IG 已知不翻页路径缺key也零请求', fetched, 0)
      const before = b.view(); let error: unknown
      try { await methods[0][1](api) } catch (e) { error = e }
      ok('实际请求点明确拒绝缺key', error !== undefined)
      eq('缺key没有 fetch', fetched, 0)
      eq('缺key的本地拒绝不占费', b.view(), before)
    })
  } finally { globalThis.fetch = realFetch; globalThis.setTimeout = realTimeout }
  // 入口费用保存与退出仍由进程场景验收，本组只守 provider 的真实调用边界。
}

// D13 独立于生产函数体；金额 expected 来自 ADR-108 与手算，不回抄运行结果。
suite('D13', '原 JSON 数值与明确新账、旧账诊断使用同一精确费用依据')
{
  const exact = (label: string, got: unknown, want: unknown) => ok(label, isDeepStrictEqual(got, want))
  const rejected = (label: string, run: () => unknown, expected?: 'input' | string) => {
    let error: unknown, didThrow = false
    try { run() } catch (e) { error = e; didThrow = true }
    ok(label, didThrow && (expected === undefined || (expected === 'input'
      ? error instanceof BudgetInputError : error instanceof CostError && error.code === expected)))
  }
  // 测试自己的 root numeric-token 观察器：JSON reviver 的 holder 识别根，不靠生产 serializer。
  const numberTokens = (text: string, path: (string | number)[] = []): Record<string, string> => {
    const seen = new WeakMap<object, Record<string, string>>()
    const parsed = (JSON.parse as any)(text, function(this: object, key: string, value: unknown, context: { source?: string }) {
      if (typeof value === 'number' && context?.source !== undefined) {
        const values = seen.get(this) ?? {}; values[key] = context.source; seen.set(this, values)
      }
      return value
    })
    return seen.get(path.reduce((value, key) => value?.[key], parsed)) ?? {}
  }
  const stateLedger = (state: CostState) => state.cost_ledger as any
  const viewAmounts = (view: CostView) => [view.cost_estimate_usd, view.budget_usd, view.cost_http_200_usd,
    view.cost_unknown_result_usd, view.cost_pending_usd]
  const assertUnavailable = (label: string, state: CostState, status: CostView['cost_status'], count: number | null, limit = '1') => {
    const before = stringifyCostJson(state), b = new Budget(state, () => {}), view = b.view()
    eq(`${label}：具体状态`, view.cost_status, status)
    eq(`${label}：可核请求数单独保留`, view.requests, count)
    exact(`${label}：未知占用不是零，合法总上限仍可解释`, viewAmounts(view), [null, limit, null, null, null])
    eq(`${label}：不冒充任务范围`, view.cost_scope, null)
    eq(`${label}：不制造可确认历史版本`, view.cost_price_versions, [])
    ok(`${label}：具体字段和原因`, view.cost_problems.length > 0 && view.cost_problems.every(p => !!p.path && !!p.reason))
    eq(`${label}：固定估算声明`, view.cost_basis, TEST_COST_BASIS)
    eq(`${label}：count 不把未知补零`, b.count, count)
    rejected(`${label}：付费前是输入错误`, () => b.reserve(TEST_TT), 'input')
    rejected(`${label}：增加上限不修复未知账`, () => b.setLimit(1_000_000), 'input')
    eq(`${label}：诊断与拒绝后原费用输入未动`, stringifyCostJson(state), before)
  }
  await costSucceeds('根数值 token 与内存金额资格完整执行', () => {
    for (const [token, amount] of [['0.005', 5000], ['5e-3', 5000], ['9007199254.740991', Number.MAX_SAFE_INTEGER], ['-0e999', 0]] as const) {
      const state = readCostDocument(`{"nested":{"budget_usd":999},"budget_usd":${token}}`)
      eq(`读取原根数值 ${token}`, readCostLimit(state), amount)
      eq(`不经 Number 写回原 token ${token}`, numberTokens(stringifyCostJson(state)).budget_usd, token)
    }
    for (const text of ['{}', '{"budget_usd":null}', '{"budget_usd":"0.005"}', '{"budget_usd":true}',
      '{"budget_usd":[]}', '{"budget_usd":{}}', '{"nested":{"budget_usd":0.005}}',
      '{"budget_usd":0.00499999999999999999999999999999999999999}', '{"budget_usd":9007199254.740992}',
      '{"budget_usd":1e999}', '{"budget_usd":-0.001}'])
      rejected(`根输入不得修补成合法额度 ${text}`, () => readCostLimit(readCostDocument(text)))
    rejected('普通内存 number 未核原 token', () => readCostLimit({ budget_usd: 0.005 }))
    const fresh: CostState = {}; setCostLimitField(fresh, Number.MAX_SAFE_INTEGER)
    eq('显式设置微美元可核验', readCostLimit(fresh), Number.MAX_SAFE_INTEGER)
    eq('显式设置最大上限精确写出', numberTokens(stringifyCostJson(fresh)).budget_usd, '9007199254.740991')
    const before = stringifyCostJson(fresh)
    for (const amount of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '5000', null]) {
      rejected(`无效改字段不扩大上限 ${String(amount)}`, () => setCostLimitField(fresh, amount as any))
      eq('无效改字段保持完整原输入', stringifyCostJson(fresh), before)
    }
  })
  await costSucceeds('无 view 的写回保留旧金额语义完整执行', () => {
    for (const token of ['0.00499999999999999999999999999999999999999', '9007199254.740991', '1e999']) {
      const state = readCostDocument(`{"budget_usd":${token},"requests":7,"nested":{"budget_usd":5}}`)
      ;(state as any).business = 'changed'
      eq(`本地业务写回不改原根 token ${token}`, numberTokens(stringifyCostJson(state)).budget_usd, token)
      eq('本地业务变化仍可保存', JSON.parse(stringifyCostJson(state)).business, 'changed')
    }
    for (const source of ['{}', '{"budget_usd":null}', '{"budget_usd":"original"}']) {
      const state = readCostDocument(source)
      exact('缺席、null、string 原样保留，不填默认', JSON.parse(stringifyCostJson(state)), JSON.parse(source))
    }
  })
  await costSucceeds('非法对象或数组预算的原数字保留，但不能取得付费资格', () => {
    const tokens = ['1e400', '9007199254740993', '0.99999999999999999']
    for (const [shape, raw, keys] of [
      ['对象', '{"overflow":1e400,"integer":9007199254740993,"fraction":0.99999999999999999}', ['overflow', 'integer', 'fraction']],
      ['数组', '[1e400,9007199254740993,0.99999999999999999]', ['0', '1', '2']],
    ] as const) {
      const state = readCostDocument(`{"budget_usd":${raw},"requests":0}`)
      ;(state as any).business = 'updated locally'
      const saved = stringifyCostJson(state)
      const originalNumbers = (text: string) => {
        const values = numberTokens(text, ['budget_usd'])
        return keys.map(key => values[key])
      }
      // expected 是上述原始字面值；普通 JSON.parse 已舍入后的值不能证明保真。
      eq(`${shape}预算本地保存保留三个原数字`, originalNumbers(saved), tokens)
      eq(`${shape}预算本地业务修改仍可保存`, JSON.parse(saved).business, 'updated locally')
      eq(`${shape}预算不新建费用账`, Object.hasOwn(state, 'cost_ledger'), false)
      const view = costView(state), budget = new Budget(state, () => {})
      eq(`${shape}预算仍是旧费用未知`, view.cost_status, 'unknown-history')
      eq(`${shape}预算可核原计数仍为零`, view.requests, 0)
      exact(`${shape}预算不可解释且所有金额为未知`, viewAmounts(view), [null, null, null, null, null])
      ok(`${shape}预算诊断给出具体原因`, view.cost_problems.length > 0 && view.cost_problems.every(p => !!p.path && !!p.reason))
      rejected(`${shape}预算不能读为合法总额`, () => readCostLimit(state))
      rejected(`${shape}预算不因零请求获得付费资格`, () => budget.reserve(TEST_TT), 'input')
      rejected(`${shape}预算不能借改额修复缺账`, () => budget.setLimit(1_000_000), 'input')
      const after = stringifyCostJson(state)
      eq(`${shape}预算诊断及拒绝后仍保留原数字`, originalNumbers(after), tokens)
      eq(`${shape}预算拒绝后不改原计数或补账`, [numberTokens(after).requests, Object.hasOwn(state, 'cost_ledger')], ['0', false])
    }
  })
  await costSucceeds('费用账与请求数的原数字也不得在离线写回时舍入', () => {
    for (const token of ['9007199254740993', '1e400']) {
      const state = readCostDocument(`{"budget_usd":1,"requests":${token}}`)
      ;(state as any).business = 'updated locally'
      eq(`旧 requests ${token} 写回保留原数字`, numberTokens(stringifyCostJson(state)).requests, token)
      eq(`旧 requests ${token} 不冒充可核次数`, costView(state).requests, null)
    }
    const malformed = readCostDocument('{"budget_usd":1,"requests":0,"cost_ledger":1e400}')
    eq('坏 ledger 数字不能在本地写回时变成 null', numberTokens(stringifyCostJson(malformed)).cost_ledger, '1e400')
    const nested = readCostDocument('{"budget_usd":1,"requests":0,"cost_ledger":{"entries":[{"unit_micro_usd":1e400}]}}')
    eq('ledger 内的原数字也不能变成 null',
      numberTokens(stringifyCostJson(nested), ['cost_ledger', 'entries', 0]).unit_micro_usd, '1e400')
  })
  await costSucceeds('费用数字不能先舍入成安全整数再授予付费资格', () => {
    for (const [field, unit, count, requests] of [
      ['unit_micro_usd', '999.99999999999999', '1', '1'],
      ['http_200_count', '1000', '0.99999999999999999', '1'],
      ['requests', '1000', '1', '0.99999999999999999'],
    ]) {
      // 三例经普通 Number 解析会成为合法的 1000/1；原文都不是整数，不能得到 4000 剩余额度。
      const source = `{"budget_usd":0.005,"requests":${requests},"cost_ledger":{"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":5000,"next_attempt_id":2,"entries":[{"endpoint":"${TEST_TT}","price_version":"${TEST_PRICE_VERSION}","unit_micro_usd":${unit},"http_200_count":${count},"unknown_result_count":0}]}}`
      const state = readCostDocument(source), budget = new Budget(state, () => {})
      eq(`${field} 原文非整数必须诊断坏账`, budget.view().cost_status, 'invalid-ledger')
      rejected(`${field} 不因舍入获得付费资格`, () => budget.reserve(TEST_TT), 'input')
      const adjustment = new Budget(readCostDocument(source), () => {})
      rejected(`${field} 也不能借改额修复`, () => adjustment.setLimit(6000), 'input')
      const saved = stringifyCostJson(readCostDocument(source))
      eq(`${field} 离线写回保持根 requests 原数字`, numberTokens(saved).requests, requests)
      const item = numberTokens(saved, ['cost_ledger', 'entries', 0])
      eq(`${field} 离线写回保持单价与次数原数字`, [item.unit_micro_usd, item.http_200_count], [unit, count])
    }
  })
  await costSucceeds('新账同步 state 与固定费用投影完整执行', () => {
    const state: CostState = {}, b = startBudget(state, 5000, 'task', () => {})
    eq('显式新建同一 state 具有已核上限', readCostLimit(state), 5000)
    exact('新账投影完整且空账版本为空', b.view(), {
      requests: 0, cost_estimate_usd: '0', budget_usd: '0.005', cost_status: 'known', cost_scope: 'task',
      cost_http_200_usd: '0', cost_unknown_result_usd: '0', cost_pending_usd: '0',
      cost_basis: TEST_COST_BASIS, cost_price_versions: [], cost_problems: [],
    })
    const a = b.reserve(TEST_TT)
    eq('state 预留时仍是净零次数', state.requests, 0)
    ok('state 在预留后有 pending', !!stateLedger(state).pending)
    b.settle(a, { kind: 'http', status: 200 })
    b.settle(b.reserve(TEST_IG), { kind: 'no_http_status' })
    const pending = b.reserve(TEST_TT), view = b.view()
    // 1000 HTTP200 + 2000 无状态 + 1000 pending = 4000 占用；净次数是 2。
    exact('混合价三分项与次数彼此独立', [view.requests, ...viewAmounts(view)], [2, '0.004', '0.005', '0.001', '0.002', '0.001'])
    eq('同版本实际 entries/pending 去重', view.cost_price_versions, [TEST_PRICE_VERSION])
    exact('costView 与预算 view 使用同一 state', costView(state), view)
    const json = stringifyCostJson({ product: 'kept' }, view), parsed = JSON.parse(json), tokens = numberTokens(json)
    exact('外部费用数值精确 token', ['cost_estimate_usd', 'budget_usd', 'cost_http_200_usd', 'cost_unknown_result_usd', 'cost_pending_usd'].map(k => tokens[k]),
      ['0.004', '0.005', '0.001', '0.002', '0.001'])
    eq('业务字段没有被费用投影丢掉', parsed.product, 'kept')
    eq('requests 是净次数数值', parsed.requests, 2)
    const restored = new Budget(readCostDocument(stringifyCostJson(state)), () => {})
    exact('保存恢复 pending 金额仍已知', restored.view(), view)
    rejected('恢复 pending 不得付费', () => restored.reserve(TEST_TT), 'input')
    rejected('恢复 pending 不得改额', () => restored.setLimit(6000), 'input')
    b.settle(pending, { kind: 'http', status: 204 })
    eq('非200只撤销本次pending并同步原state净次数', state.requests, 2)
    exact('非200不撤销此前200与未知', viewAmounts(b.view()), ['0.003', '0.005', '0.001', '0.002', '0'])
    rejected('重复receipt保持原CostError', () => b.settle(pending, { kind: 'http', status: 200 }), 'invalid-receipt')
    rejected('未知端点原样抛unknown-price，不当预算不足', () => b.reserve('/not-priced'), 'unknown-price')
    const maxState: CostState = {}; startBudget(maxState, Number.MAX_SAFE_INTEGER, 'process', () => {})
    eq('最大上限费用JSON也是精确数值', numberTokens(stringifyCostJson({}, costView(maxState))).budget_usd, '9007199254.740991')
  })
  await costSucceeds('未知、坏账与版本诊断完整执行', () => {
    for (const requests of [0, 7]) assertUnavailable(`旧账 requests=${requests}`,
      readCostDocument(`{"budget_usd":1,"requests":${requests}}`), 'unknown-history', requests)
    for (const requests of [null, -1, 1.5, '7']) assertUnavailable(`旧计数非法 ${String(requests)}`,
      readCostDocument(JSON.stringify({ budget_usd: 1, requests })), 'unknown-history', null)
    const bad = costFixture(10000, 1); stateLedger(bad).entries[0].unit_micro_usd = 1
    assertUnavailable('已知版本却改了单价', bad, 'invalid-ledger', 1, '0.01')
    const version = costFixture(10000, 1); stateLedger(version).entries[0].price_version = 'future-unverified'
    assertUnavailable('未知价目版本不能换当前价', version, 'unavailable-evidence', 1, '0.01')
    const count = costFixture(10000, 1); count.requests = 0
    assertUnavailable('ledger净次数和原计数冲突', count, 'invalid-ledger', 0, '0.01')
  })
  await costSucceeds('总上限替换、根冲突修复和失败原子性完整执行', () => {
    const state = costFixture(5000, 1, 2), b = new Budget(state, () => {})
    const priorEntries = structuredClone(stateLedger(state).entries), seq = stateLedger(state).next_attempt_id
    b.setLimit(6000)
    eq('6000 是总额度，不是原5000再加6000', readCostLimit(state), 6000)
    eq('ledger 同步替换总上限', stateLedger(state).limit_micro_usd, 6000)
    exact('增加额度不改历史价次数和尝试序号', [stateLedger(state).entries, state.requests, stateLedger(state).next_attempt_id], [priorEntries, 3, seq])
    b.setLimit(3000)
    eq('允许降至已占用额度', b.view().budget_usd, '0.003')
    const before = stringifyCostJson(state)
    rejected('不能把总额度降到占用之下', () => b.setLimit(2999))
    eq('失败没有写半份新上限', stringifyCostJson(state), before)
    const original = costFixture(5000, 1, 2)
    const conflict = readCostDocument(`{"budget_usd":0.007,"requests":3,"cost_ledger":${JSON.stringify(original.cost_ledger)}}`)
    eq('根冲突夹具的原token确为0.007', readCostLimit(conflict), 7000)
    const conflictBefore = stringifyCostJson(conflict), cb = new Budget(conflict, () => {}), view = cb.view()
    eq('根上限冲突是整体 invalid-ledger', view.cost_status, 'invalid-ledger')
    exact('冲突不挑一份金额假装有效', [...viewAmounts(view), view.cost_scope, view.cost_price_versions, view.requests], [null, null, null, null, null, null, [], 3])
    ok('冲突诊断具体指出根字段', view.cost_problems.some(p => /budget_usd/.test(p.path) && !!p.reason))
    rejected('无显式替换不能付费', () => cb.reserve(TEST_TT), 'input')
    eq('仅诊断不改任何一份上限', stringifyCostJson(conflict), conflictBefore)
    cb.setLimit(6000)
    eq('有效原ledger允许显式修复两处上限', [readCostLimit(conflict), stateLedger(conflict).limit_micro_usd], [6000, 6000])
    exact('修复后历史与净次数仍连续', [stateLedger(conflict).entries, conflict.requests], [priorEntries, 3])
    eq('修复后整体输出已知', cb.view().cost_status, 'known')
    const live = fundedBudget(5000), receipt = live.reserve(TEST_TT), liveBefore = live.view()
    rejected('活实例pending改额也不成功', () => live.setLimit(6000))
    exact('pending改额失败不动账', live.view(), liveBefore)
    live.settle(receipt, { kind: 'http', status: 200 })
    // CostBudget 的新增小接口单独检验：只改 limit；无需包装层才能守住原子性。
    const pure = createCostBudget(5000, 'task', { test: { '/a': 2000 } })
    pure.settle(pure.reserve({ endpoint: '/a', price_version: 'test', unit_micro_usd: 2000 }), { kind: 'http', status: 200 })
    const snapshot = pure.snapshot(); pure.setLimit(2000)
    exact('纯模型改额保留所有历史字段', pure.snapshot(), { ...snapshot, cost_ledger: { ...snapshot.cost_ledger, limit_micro_usd: 2000 } })
    const pureBefore = pure.snapshot()
    for (const limit of [1999, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      rejected(`纯模型拒绝非法或低于占用上限 ${limit}`, () => pure.setLimit(limit))
      exact('纯模型拒绝原子性', pure.snapshot(), pureBefore)
    }
  })
  // 入口判据 D13.a–s 与交点还需 selfcheck 的进程证据；本组不以纯接口冒领整条入口判据。
}

suite('D13', '已有数据可离线输出，未知费用不得换来新增付费或伪账单')
{
  const cwd = mkdtempSync(join(tmpdir(), 'kol-cost-cross-')), dir = join(cwd, 'task'), taskFile = join(dir, 'task.json')
  const log = join(cwd, 'attempts.tsv'), scripts = new URL('./', import.meta.url)
  const preload = new URL('./check/fake-fetch.ts', import.meta.url).href
  const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
  mkdirSync(dir); mkdirSync(join(cwd, 'memory'))
  const writeLegacy = (paid = false) => {
    writeFileSync(taskFile, JSON.stringify({ product: 'legacy-cross', market: 'US', target_count: 9999,
      budget_usd: 1, requests: 0, tasks: [{ keyword: 'local', dimension: 'category', platform: 'tiktok' }],
      done: paid ? [] : [0], offsets: paid ? {} : { 0: 5 }, pages: paid ? {} : { 0: 1 },
      answered: paid ? {} : { 0: 1 }, found: paid ? {} : { 0: 3 },
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }))
    for (const file of ['creators.json', 'creators.raw.json']) writeFileSync(join(dir, file), '[]')
  }
  const run = (file: string, args: string[], key = '') => spawnSync(process.execPath,
    ['--import', tsx, '--import', preload, fileURLToPath(new URL(file, scripts)), ...args], {
      cwd, encoding: 'utf8', timeout: 20000, env: { ...process.env, NODE_OPTIONS: '',
        TIKHUB_API_KEY: key, FAKE_FETCH_LEDGER: log, FAKE_FETCH_NO_429: '1' },
    })
  const noFetch = () => !existsSync(log) || rf(log, 'utf8').trim() === ''
  try {
    await costSucceeds('旧账本地处理交点完整执行', () => {
      writeLegacy()
      const result = run('collect.ts', ['--resume', dir])
      eq('没有待办的旧账collect缺key仍成功', result.status, 0)
      ok('旧账本地collect确实零fetch', noFetch())
      const after = JSON.parse(rf(taskFile, 'utf8'))
      eq('本地写回不因requests为0新造ledger', Object.hasOwn(after, 'cost_ledger'), false)
      eq('本地写回保留可验证原计数与原根预算', [after.requests, after.budget_usd], [0, 1])
      tension('D13', 'P1')
    })
    await costSucceeds('未知费用不产生新增额度交点完整执行', () => {
      writeLegacy(true)
      const before = rf(taskFile, 'utf8'), result = run('collect.ts', ['--resume', dir], 'fake-key-for-cost-test')
      eq('有待办旧账拒绝付费为输入问题', result.status, 2)
      ok('有待办旧账在实际fetch前拒绝', noFetch())
      ok('错误点名费用状态而非只让用户加钱', /费用|账|历史/.test(result.stderr) && /未知|无从|缺|不可/.test(result.stderr))
      const after = JSON.parse(rf(taskFile, 'utf8')), original = JSON.parse(before)
      eq('拒绝付费不制造ledger', Object.hasOwn(after, 'cost_ledger'), false)
      eq('拒绝付费不重置费用原字段', [after.requests, after.budget_usd], [original.requests, original.budget_usd])
      tension('D13', 'P3')
    })
    await costSucceeds('未知费用在JSON和HTML如实显示交点完整执行', () => {
      writeLegacy()
      const result = run('render.ts', ['--dir', dir])
      eq('旧账render缺key仍成功', result.status, 0)
      ok('render确实零fetch', noFetch())
      const meta = JSON.parse(rf(join(dir, 'meta.json'), 'utf8')), html = rf(join(dir, 'report.html'), 'utf8')
      eq('未知状态与可解释上限单独输出', [meta.requests, meta.budget_usd, meta.cost_status, meta.cost_scope], [0, 1, 'unknown-history', null])
      eq('未知占用及三分项不推算为0', [meta.cost_estimate_usd, meta.cost_http_200_usd, meta.cost_unknown_result_usd, meta.cost_pending_usd], [null, null, null, null])
      eq('所有费用出口都声明固定价估算边界', meta.cost_basis, TEST_COST_BASIS)
      eq('未知版本列表不是凭空宣称本版历史', meta.cost_price_versions, [])
      ok('meta给出具体未知原因', Array.isArray(meta.cost_problems) && meta.cost_problems.some((p: any) => p.path && p.reason))
      ok('HTML费用未知不显示伪零或null金额', /未知|无从确认/.test(html) && !/\$\s*(?:0(?:\.0+)?(?:[^\d.]|$)|null)/.test(html))
      ok('HTML仍说明估算非账单', html.includes('固定公开基础价') && html.includes('不是实际账单'))
      const task = JSON.parse(rf(taskFile, 'utf8'))
      eq('render没有修复未知ledger', Object.hasOwn(task, 'cost_ledger'), false)
      tension('D13', 'P5')
    })
  } finally { rmSync(cwd, { recursive: true, force: true }) }
}

// ADR-109：仅由公开保存回调与真实临时文件观察，未读取生产函数体。
suite('D14', '费用保存回调先于返回，保存失败后本实例停止一切费用变更')
{
  const exact = (label: string, got: unknown, want: unknown) => ok(label, isDeepStrictEqual(got, want))
  const caught = (run: () => unknown): unknown => { try { run() } catch (error) { return error } }
  const history = { endpoint: TEST_TT, price_version: TEST_PRICE_VERSION, unit_micro_usd: 1000,
    http_200_count: 1, unknown_result_count: 2 }
  const pending = { endpoint: TEST_IG, price_version: TEST_PRICE_VERSION, unit_micro_usd: 2000, attempt_id: 4 }
  const ledger = { schema: 1, currency: 'USD', unit: 'micro_usd', scope: 'task',
    limit_micro_usd: 10000, next_attempt_id: 5, entries: [history] }
  const outcomes = [
    ['200', { kind: 'http', status: 200 }, 1, 0],
    ['非200', { kind: 'http', status: 429 }, 0, 0],
    ['无HTTP状态', { kind: 'no_http_status' }, 0, 1],
  ] as const
  for (const [name, outcome, http, unknown] of outcomes) await costSucceeds(`${name} 的同步费用快照完整执行`, () => {
    const state = costFixture(10000, 1, 2), writes: CostSnapshot[] = [], events: string[] = []
    const budget = new Budget(state, () => {}, (snapshot: CostSnapshot) => {
      exact(`${name} 回调观察到已同步的内存费用`,
        { cost_ledger: state.cost_ledger, requests: state.requests }, snapshot)
      writes.push(structuredClone(snapshot)); events.push('保存')
    })
    const before = writes.length, receipt = budget.reserve(TEST_IG)
    events.push('预留返回')
    eq(`${name} 每次预留同步保存一次`, writes.length - before, 1)
    exact(`${name} pending 保存不增加净次数或改历史`, writes.at(-1),
      { cost_ledger: { ...ledger, pending }, requests: 3 })
    budget.settle(receipt, outcome); events.push('结算返回')
    const extra = http + unknown ? [{ endpoint: TEST_IG, price_version: TEST_PRICE_VERSION,
      unit_micro_usd: 2000, http_200_count: http, unknown_result_count: unknown }] : []
    exact(`${name} 终态只结算本次并保存正确历史次数`, writes.at(-1),
      { cost_ledger: { ...ledger, entries: [history, ...extra] }, requests: 3 + http + unknown })
    eq(`${name} 每次结算同步保存一次`, writes.length - before, 2)
    exact(`${name} 方法返回前已完成保存`, events, ['保存', '预留返回', '保存', '结算返回'])
  })
  await costSucceeds('新任务预算也将保存回调传到预留和结算', () => {
    const state: CostState = {}, writes: CostSnapshot[] = []
    const budget = startBudget(state, 5000, 'task', () => {}, (snapshot: CostSnapshot) => writes.push(structuredClone(snapshot)))
    const before = writes.length, receipt = budget.reserve(TEST_IG)
    eq('startBudget 第五参数在预留返回前收到 pending',
      [writes.length - before, writes.at(-1)?.requests, writes.at(-1)?.cost_ledger.pending?.unit_micro_usd], [1, 0, 2000])
    budget.settle(receipt, { kind: 'http', status: 200 })
    eq('startBudget 第五参数收到终态且不重复计次',
      [writes.length - before, writes.at(-1)?.requests, Object.hasOwn(writes.at(-1)?.cost_ledger ?? {}, 'pending')], [2, 1, false])
  })
  for (const phase of ['预留', ...outcomes.map(([name]) => name)]) await costSucceeds(`${phase} 保存失败后锁定实例`, () => {
    const state = costFixture(10000, 1, 2), reason = new Error(`模拟保存失败：${phase}`)
    const failAt = phase === '预留' ? 1 : 2
    let calls = 0
    const budget = new Budget(state, () => {}, () => { if (++calls === failAt) throw reason })
    let receipt: ReturnType<Budget['reserve']> | undefined
    const error = caught(() => {
      receipt = budget.reserve(TEST_IG)
      if (phase !== '预留') budget.settle(receipt, outcomes.filter(([name]) => name === phase)[0][1])
    })
    ok(`${phase} 保存失败是 persistence-failed 而非额度不足`, error instanceof CostError && error.code === 'persistence-failed')
    ok(`${phase} 保存失败保留实际原因`, error instanceof Error
      && (error.message.includes(reason.message) || error.cause === reason))
    const frozen = stringifyCostJson(state), callsAfterFailure = calls
    // 预留失败没有返回本账凭据；一个异账的合法凭据也不能绕开本实例已锁定的错误。
    const settleReceipt = receipt ?? fundedBudget().reserve(TEST_TT)
    for (const [operation, run] of [
      ['reserve', () => budget.reserve(TEST_TT)],
      ['settle', () => budget.settle(settleReceipt, { kind: 'http', status: 200 })],
      ['setLimit', () => budget.setLimit(20000)],
    ] as const) {
      const later = caught(run)
      ok(`${phase} 失败后的 ${operation} 仍报告持久化失败`, later instanceof CostError && later.code === 'persistence-failed')
      eq(`${phase} 失败后的 ${operation} 不改变费用`, stringifyCostJson(state), frozen)
      eq(`${phase} 失败后的 ${operation} 不再调用保存`, calls, callsAfterFailure)
    }
    if (phase === '预留') {
      exact('本地预留保存失败不伪造无HTTP结果留存',
        [(state.cost_ledger as any).entries, state.requests], [[history], 3])
    }
    tension('D14', 'P5')
  })
}

suite('D14', '费用检查点只推进费用，保留盘上业务与精确预算，并使恢复的未结占用继续有效')
{
  const exact = (label: string, got: unknown, want: unknown) => ok(label, isDeepStrictEqual(got, want))
  const business = (state: Record<string, unknown>) => Object.fromEntries(Object.entries(state)
    .filter(([key]) => !['cost_ledger', 'requests', 'updated_at'].includes(key)))
  const rootBudgetToken = (text: string): string | undefined => {
    const tokens = new WeakMap<object, string>()
    const parsed = (JSON.parse as any)(text, function(this: object, key: string, value: unknown, context?: { source?: string }) {
      if (key === 'budget_usd' && typeof value === 'number' && context?.source !== undefined) tokens.set(this, context.source)
      return value
    })
    return tokens.get(parsed)
  }
  const root = mkdtempSync(join(tmpdir(), 'kol-d14-checkpoint-'))
  try {
    for (const [status, present, token, limit] of [
      ['ok', true, '9007199254.740991', Number.MAX_SAFE_INTEGER],
      ['unknown', true, '5e-3', 5000],
      ['unreadable_ignored', false, '0.005000', 5000],
      [undefined, false, '0.005', 5000],
    ] as const) await costSucceeds(`费用检查点保留 ${String(status)} 及 ${token}`, () => {
      const dir = join(root, String(status)), task = join(dir, 'task.json')
      mkdirSync(dir)
      const original = { product: 'disk-product', market: 'US', target_count: 9999,
        tasks: [{ keyword: 'saved', dimension: 'category', platform: 'tiktok' }],
        created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
        custom: { nested: { budget_usd: 7 }, zero: 0, empty: null },
        ...(present ? { done: [], offsets: { 0: 5 }, pages: { 0: 1 }, answered: { 0: 2 }, found: { 0: null } } : {}),
        ...(status === undefined ? {} : { memory_status: status }),
        cost_ledger: costFixture(limit, 1, 1).cost_ledger, requests: 2 }
      writeFileSync(task, `{"budget_usd":${token},${JSON.stringify(original).slice(1)}`)
      const artifacts = ['creators.json', 'creators.raw.json', 'enrichment.json']
      for (const file of artifacts) if (present) writeFileSync(join(dir, file), `原盘上内容 ${file}`)
      const diskBusiness = business(JSON.parse(rf(task, 'utf8')))
      const state = readCostDocument<Record<string, unknown>>(rf(task, 'utf8'))
      Object.assign(state, { product: 'not-yet-saved', done: [0], offsets: { 0: 99 }, pages: { 0: 99 },
        answered: { 0: 99 }, found: { 0: 99 }, memory_status: 'ok' })
      const snapshots: CostSnapshot[] = []
      const budget = new Budget(state, () => {}, (snapshot: CostSnapshot) => {
        saveCostCheckpoint(dir, snapshot); snapshots.push(structuredClone(snapshot))
      })
      const before = Date.now(), receipt = budget.reserve(TEST_IG), after = Date.now()
      const savedText = rf(task, 'utf8'), saved = JSON.parse(savedText)
      exact(`${String(status)} 预留只替换费用和保存时间`, business(saved), diskBusiness)
      eq(`${String(status)} 根预算保留原数值 token`, rootBudgetToken(savedText), token)
      exact(`${String(status)} 盘上保存本次 pending 与原净次数`,
        [saved.requests, saved.cost_ledger.pending], [2, {
          endpoint: TEST_IG, price_version: TEST_PRICE_VERSION, unit_micro_usd: 2000, attempt_id: 3 }])
      exact(`${String(status)} 盘上费用是保存回调的快照`,
        { cost_ledger: saved.cost_ledger, requests: saved.requests }, snapshots.at(-1))
      const updated = Date.parse(saved.updated_at)
      ok(`${String(status)} 费用保存时间真实更新`, updated >= before && updated <= after)
      const restoredState = readCostDocument(savedText), restored = new Budget(restoredState, () => {})
      exact(`${String(status)} 恢复不把 pending 冒充已发请求或终态`,
        [restored.count, restored.view().cost_http_200_usd, restored.view().cost_unknown_result_usd, restored.view().cost_pending_usd],
        [2, '0.001', '0.001', '0.002'])
      const persisted = stringifyCostJson(restoredState)
      for (const [operation, run] of [
        ['新增请求', () => restored.reserve(TEST_TT)], ['显式改额', () => restored.setLimit(limit)],
      ] as const) {
        let error: unknown
        try { run() } catch (caught) { error = caught }
        ok(`${String(status)} 恢复未结占用拒绝${operation}`, error instanceof BudgetInputError)
        eq(`${String(status)} 拒绝${operation}不退款或制造终态`, stringifyCostJson(restoredState), persisted)
      }
      tension('D14', 'P1'); tension('D14', 'P3')
      // 模拟同一写入方在两次费用检查点之间保存了业务变化，第二次必须重读盘上版本。
      const nextDisk = readCostDocument<Record<string, unknown>>(savedText)
      nextDisk.market = 'CA'; nextDisk.local_revision = 2
      if (present) nextDisk.memory_status = 'unreadable_ignored'
      writeFileSync(task, stringifyCostJson(nextDisk))
      const nextBusiness = business(JSON.parse(rf(task, 'utf8')))
      budget.settle(receipt, { kind: 'http', status: 200 })
      const terminalText = rf(task, 'utf8'), terminal = JSON.parse(terminalText)
      exact(`${String(status)} 终态保存沿用最新盘上业务，不提升内存去重声明`, business(terminal), nextBusiness)
      eq(`${String(status)} 终态保存仍不改原预算 token`, rootBudgetToken(terminalText), token)
      exact(`${String(status)} 终态费用已保存且净次数只增加一次`,
        [terminal.requests, Object.hasOwn(terminal.cost_ledger, 'pending')], [3, false])
      for (const file of artifacts) eq(`${String(status)} 费用检查点不提前写 ${file}`,
        existsSync(join(dir, file)) ? rf(join(dir, file), 'utf8') : undefined, present ? `原盘上内容 ${file}` : undefined)
      tension('D14', 'P4')
    })
    await costSucceeds('不存在的任务不能由费用检查点创建', () => {
      const pure = createCostBudget(5000, 'task', TIKHUB_PRICE_CATALOG)
      pure.reserve(quoteTikHub(TEST_IG))
      for (const name of ['missing-directory', 'missing-task']) {
        const dir = join(root, name)
        if (name === 'missing-task') mkdirSync(dir)
        let threw = false
        try { saveCostCheckpoint(dir, pure.snapshot()) } catch { threw = true }
        ok(`${name} 费用保存报错`, threw)
        eq(`${name} 没有凭空产生 task.json`, existsSync(join(dir, 'task.json')), false)
      }
    })
    criterion('D14.g')
  } finally { rmSync(root, { recursive: true, force: true }) }
  // HTTP 前后顺序、强杀窗口与入口退出码由进程测试认领，纯接口不冒领 D14.a–f/h。
}

}
if (seenGroups.size !== GROUPS.length) {
  throw new Error(`需求测试组只遇到 ${seenGroups.size}/${GROUPS.length} 组，不能报告完成`)
}
if (!fullRun && assertionCount === 0) {
  throw new Error('需求测试子集没有执行断言，不能报告通过')
}
console.log(fail ? `\n${fail} 个失败\n` : fullRun
  ? `\n全部通过（覆盖 ${covered.size} 条需求）\n`
  : `\n全部通过（执行 ${assertionCount} 条断言；覆盖 ${covered.size} 条需求）\n`)
if (!fullRun) console.log(`✓ 已完成子集 ${[...selectedGroups].join('、')}；没有认领全量审计`)
if (process.argv.includes('--json')) {
  console.log('COVERED=' + JSON.stringify([...covered]))
}
/*
 * 把「谁被覆盖了」交给审计 —— **运行时收集，不是源码里搜出来的**。
 *
 * 审计原先按源码正则找 `suite('X')`，于是**注释掉的认领照样算数**：把测试删掉、
 * 认领留在注释里，审计照样报「有测试」。这个仓库在同一个坑上栽过 —— `audit.ts`
 * 里那句「早先还 or 了一个 includes(base) 兜底，结果是任何地方提到文件名
 *（哪怕注释里）就算执行过」（ADR-20）。
 *
 * 带上整棵 `scripts/` 树的指纹：审计要重算一遍并比对，**过期的记录不算数**。
 * 没跑过测试就没有这份记录，审计当场说「先跑 npm test」，而不是默默放行。
 */
// 变异测试跑的是被改过的源码，那一次执行留下的覆盖记录不作数 —— 记录只能由
// 一次干净的测试运行写（mutate.ts 给变异跑打上 MUTATING 标记，这里据此跳过）。
// 失败的测试运行同样不写：断言红了还照写，一份没通过的运行会被当成证据交出去。
// 判定本身在 claims.ts，不留在这个入口里 —— 留在这里就没有测试守得住它。
const endHash = fingerprint(sourceFiles())
if (fullRun && claimsPublishable(process.env.MUTATING === '1', fail, startHash, endHash)) {
  mkdirSync(dirname(CLAIMS_PATH), { recursive: true })
  // 原子写：半截写坏的记录读起来是合法 JSON 的概率不大，但读的一方要为它写一段
  // 判死的代码 —— 换成写临时文件再改名，这一类根本不会出现（lib/atomic.ts）。
  writeFileAtomic(CLAIMS_PATH, JSON.stringify({
    source_hash: endHash,
    covered: [...covered].sort(),
    criteria: [...claimedCriteria].sort(),
    tensions: [...claimedTensions].sort(),
  }, null, 2))
}

// 不用硬退出那种写法：stdout 接的是管道时（变异测试就是这么跑的），刚 console.log 的那几行可能
// 还没写出去就被 exit 截掉 —— 实测 8 次里 1 次「N 个失败」那一行丢了，进程退出码 1 却没有汇总，
// mutate 判成「跑不起来」。设 exitCode 让进程自己走完，输出一定落地
process.exitCode = fail ? 1 : 0
