#!/usr/bin/env tsx
/**
 * 需求测试。**每个用例标注它验的是哪条需求编号** —— 审计据此回答覆盖度。
 *
 * 写测试的纪律（process/4-VERIFY.md）：只看需求描述和验收标准，不读实现。
 * 本文件目前违反了这一条（同一上下文写的代码和测试），已登记为 ADR-04 的已知缺口。
 */
import { extractEmail, PR_SIGNALS } from './lib/email.js'
import { judgeLine, lintTree } from './check/lint-rule.js'
import { implementationLeak } from './check/why-rule.js'
import { JUDGMENT_EXEMPT, deprecatedBlock, judgmentModules, ledger, unguarded } from './check/audit-rule.js'
import { judgeRun } from './check/mutate-rule.js'
import {
  active, adrIdsIn, contentHash, danglingAdrRefs, renderTables, requirementVerdict,
  rootProblems, tensionEvidence, tensionHasRedline, tensionKey, tensionVerdict,
  validateRegistry,
  type Evidence, type Req, type TensionEvidence,
} from './check/spec-rule.js'
import { HARNESS, orphanAttributions } from './check/attribution-rule.js'
import {
  CLAIMS_PATH, claimsFresh, claimsOwnedBy, claimsPublishable, claimsReadFault, claimsWellFormed,
  fingerprint, sourceFiles,
} from './check/claims.js'
import {
  BUDGET, type Waiver, categorize, judge, judgeExemption, parseNumstat, scanMessage, tally,
} from './check/size-rule.js'
import {
  FILE_RE, checkAll, checkAppendOnly, encodeTarget, escapeCell, fileNameOf, markerFault,
  renderIndex, slugify,
} from './check/adr-rule.js'
import {
  LIMIT_HOURS, anchorFor, birthOf, judgeAge, judgeAgeExemption, ownSince, ownTipOf, parseLog,
  parsePrList, pickWaiver, scanAgeWaiver, shapeOf, waiverOrder,
} from './check/age-rule.js'
import { endsOpen, quotedMask } from './check/quoted.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { scoreCreator, tierOf, passesFollowerGate } from './lib/score.js'
import { fillEmail, pickList } from './providers/tikhub.js'
import { esc, writeCsv } from './lib/csv.js'
import { HEADERS, toRow, cell, sortForOutput, buildSheets } from './lib/rows.js'
import { writeXlsx } from './lib/xlsx.js'
import { readFileSync as rf, unlinkSync as ul } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { Budget, BudgetExceeded } from './lib/budget.js'
import { enrichedFlag, renderHtml } from './lib/report.js'
import { filterByMemory, recordRecommendations, useMemoryFile } from './lib/memory.js'
import {
  finalize, keywordsResumeWillRun, needsProfile, pendingKeywords, rankCreators, keywordStats, tierCounts,
} from './lib/pipeline.js'
import {
  ACTIVITY_ACTIVE_MAX_DAYS, ACTIVITY_COOLING_MAX_DAYS,
  accountKey, assignAudienceRisks, attachAssessments, calculatePublicMetrics,
  calculateQuoteEfficiency, measured, publicPostSample, recomputeCachedAssessment, unavailable,
} from './lib/assessment.js'
import {
  writeFileSync, unlinkSync, truncateSync, rmSync, mkdirSync, existsSync,
  readdirSync, chmodSync, statSync, symlinkSync, lstatSync, utimesSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type {
  AccountAssessment, AudienceRiskAssessment, CollaborationQuote, Creator,
  EnrichmentState, MetricSource, NormalizedPublicPost, RecentPost, TaskState,
} from './lib/types.js'
import { asMemoryStatus, creatorKey } from './lib/types.js'
import { persistListAndStatus, saveTask } from './lib/task.js'
import { isAbsence, mkdirDurable, writeFileAtomic } from './lib/atomic.js'

let fail = 0
let cur = ''
export const covered = new Set<string>()

// 开跑前先把上一次的覆盖记录清掉 —— 拥有它的一方负责它的生死（ADR-20）。
// 挡的是「源码没改、这一跑却红了或者半路死了」那一半：那时指纹对得上，
// 上一次成功的记录就成了这一次的证据。改坏源码那一半由指纹的范围挡（claims.ts）。
// 挡不住 import 阶段就崩的那一路 —— 这一行在静态 import 求值之后才跑。
// 见 claims.ts 里 claimsOwnedBy 的「够不到的那一段」。
if (claimsOwnedBy(process.env.MUTATING === '1')) rmSync(CLAIMS_PATH, { force: true })
// 开跑前的指纹。跑完再算一次，两次对不上说明源码在这一跑的过程中被改过 ——
// 只算跑完那一次的话，记录带的是新那棵树的指纹，而断言执行的是旧的，审计照样
// 比对得上，于是一棵从没被完整测过的树拿到了证据。
const startHash = fingerprint(sourceFiles())

const suite = (req: string, name: string) => { cur = req; covered.add(req); console.log(`\n[${req}] ${name}`) }
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fail++; console.log(`  ✗ ${label}\n     got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`) }
  else console.log(`  ✓ ${label}`)
}
const ok = (label: string, cond: boolean) => eq(label, cond, true)

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
  bio: '', bio_links: [], verified: false, profile_url: '',
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

suite('P1', '缺失数据不得用默认值填充')
{
  // 「未查询」与「查过，值为空」必须是两个不同的值
  const notFetched = mk('tiktok', 'a', { bio: undefined })
  const fetchedEmpty = mk('tiktok', 'b', { bio: '' })
  ok('bio 未取到时为 undefined', notFetched.bio === undefined)
  ok('bio 取到但为空时为空串', fetchedEmpty.bio === '')

  // 粉丝数未知不得被当作 0 参与评分 —— 那会让人被下限过滤掉
  const unknown = mk('tiktok', 'c', { followers: undefined, post_count: undefined })
  const zero = mk('tiktok', 'd', { followers: 0, post_count: 0 })
  eq('未知粉丝不得分', scoreCreator(unknown), scoreCreator(zero))
  ok('未知与 0 在类型上可区分', unknown.followers === undefined && zero.followers === 0)

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

  // 粉丝数未知不得被静默过滤掉
  ok('未知粉丝放行', passesFollowerGate(mk('tiktok', 'h', { followers: undefined })))
  ok('低于下限拦截', !passesFollowerGate(mk('tiktok', 'i', { followers: 100 })))
  ok('高于上限拦截', !passesFollowerGate(mk('tiktok', 'j', { followers: 9_000_000 })))
  ok('区间内放行', passesFollowerGate(mk('tiktok', 'k', { followers: 50_000 })))
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
   * （RecentPost.plays 可选）加纪律 lint 挡着 —— `plays` 已在敏感字段表里，
   * `p.plays ?? 0` 会被拦下（M-P1-i 守着这一条）。
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
      requests: 1, cost_estimate_usd: 0.001, budget_usd: 2, enriched: false })
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

suite('P3', '未经确认不得超出预算')
{
  const b = new Budget(0.005)             // 只够 5 次
  let sent = 0
  let threw = false
  try { for (let i = 0; i < 10; i++) { b.charge(); sent++ } }
  catch (e) { threw = e instanceof BudgetExceeded }
  eq('实际发出请求数受限', sent, 5)
  ok('超限抛 BudgetExceeded', threw)
  eq('抛出时不增加计数', b.count, 5)
  criterion('P3.a')

  // 跨运行累加，不重复计费（D6）
  const resumed = new Budget(0.010, 5)
  eq('续跑时已花部分不归零', resumed.spent, 0.005)
  covered.add('D6')
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

suite('D6', '续跑要花多少钱，数的是它真会去抓的，不是「不在 done 里的」')
{
  const st = (over: Partial<TaskState> = {}): TaskState => ({
    product: 'p', market: 'US', target_count: 50, budget_usd: 1,
    tasks: [{ keyword: 'a', dimension: 'category', platform: 'tiktok' },
            { keyword: 'b', dimension: 'scene', platform: 'tiktok' }],
    done: [], offsets: {}, requests: 0, created_at: '', updated_at: '', ...over,
  })
  // 达标提前停下：剩下的关键词一个都没碰过，也没被标记完成 ——
  // 但续跑的第一件事是再查一次达标，一个请求都不会发。
  eq('没达标 → 剩下的关键词续跑会去抓', keywordsResumeWillRun(st(), 10).length, 2)
  eq('已达标 → 续跑一个关键词都不会抓', keywordsResumeWillRun(st(), 50).length, 0)
  eq('超出目标同理', keywordsResumeWillRun(st(), 99).length, 0)
  eq('已标记完成的本来就不算', keywordsResumeWillRun(st({ done: [0] }), 10).length, 1)
  // pendingKeywords 仍然报「还没跑完的」—— 它服务的是进度，不是花钱
  eq('进度口径不受达标影响', pendingKeywords(st()).length, 2)
}

suite('D6', '「还要不要补 profile」只有一个判定 —— 补全循环与「续跑要花多少钱」共用它')
{
  const c = (over: Partial<Creator>) => mk('tiktok', 'x', over)
  ok('bio 未查询 → 还要补', needsProfile(c({ bio: undefined })))
  ok('查过了但没有外链 → 还要补', needsProfile(c({ bio: '简介', bio_links: [] })))
  eq('查过且有外链 → 不用再补', needsProfile(c({ bio: '简介', bio_links: ['https://x'] })), false)
  // 这个判定决定要不要花钱：说「续跑不产生新请求」之前，它必须对每个人都是 false
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

suite('D4', '记忆不可用分三档：不存在 / 读不出来 / 显式跳过')
{
  const tmp = join(tmpdir(), `kol-d4-${process.pid}.json`)
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
  const padded = filterByMemory([mk('tiktok', 'pad')], 'Foo')
  eq('产品名两侧的空白不影响「已推荐过」', padded.filtered_recommended, 1)
  eq('于是那个人不会被再推荐一次', padded.kept.length, 0)

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
    const st = { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1,
      memory_status: 'unreadable_ignored' } as unknown as TaskState
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
    const st = { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1,
      memory_status: 'unreadable_ignored' } as unknown as TaskState
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
    const st = { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1,
      memory_status: 'ok' } as unknown as TaskState
    saveTask(d, st)
    const before = rf(join(d, 'task.json'), 'utf8')
    // 拿一个同名目录占住临时文件名，写入必定失败
    mkdirSync(join(d, `task.json.${process.pid}.tmp`), { recursive: true })
    let threw = false
    try { saveTask(d, { ...st, product: '改过的' }) } catch { threw = true }
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
    const st2 = { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1 } as unknown as TaskState
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
    const st3 = { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1 } as unknown as TaskState
    saveTask(d3, st3)
    chmodSync(join(d3, 'task.json'), 0o444)
    const before3 = rf(join(d3, 'task.json'), 'utf8')
    let threw3 = false
    try { saveTask(d3, { ...st3, product: '改过的' }) } catch { threw3 = true }
    ok('只读的 task.json 写不进去时抛出来', threw3)
    eq('而它一个字节没动', rf(join(d3, 'task.json'), 'utf8'), before3)
    rmSync(d3, { recursive: true, force: true })
  }

  // 七之五、**新文件按 umask 默认建**，不是停在临时文件那一档。
  //        临时文件按最严建是为了盖住那段窗口，不是替产品决定新文件该多严；
  //        少了还原那一步，每个新建的 task.json / 名单 / 增强结果都变成
  //        只有属主可读，而这是一句注释说了、代码没做的事（ADR-57）。
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
  //        所以这不是新能力，是不让整体替换顺手弄坏原来对的行为（ADR-57）。
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
  //        联系历史，会一直留在盘上（ADR-57）。
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
    saveTask(d3, { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      target_count: 1, done: [], requests: 0, budget_usd: 1 } as unknown as TaskState)
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
  eq('不留下半成品', readdirSync(tmpdir()).filter(f =>
    f.startsWith(`kol-d4-${process.pid}`) && f.endsWith('.tmp')).length, 0)
  ok('写回后仍可解析', (() => { try { JSON.parse(rf(tmp, 'utf8')); return true } catch { return false } })())

  rmSync(tmp, { force: true })   // 变异可能已经把它删了，清理不该因此崩掉
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
  tension('F5', 'P1')
}

suite('U1', '分层管线返回的名单已按 tier 排好序')
{
  const c = (h: string, fit: '✅' | '❌') => mk('tiktok', h, { email: 'a@example.com', fit })
  const out = rankCreators([c('low', '❌'), c('high', '✅')], 'US')
  eq('A 排在 C 前面', out.map(x => x.tier), ['A', 'C'])

  eq('关键词表现按来源聚合', keywordStats(out), [
    { keyword: 'k', dimension: 'category', found: 2, fit_pass: 1 }])
  eq('分层计数', tierCounts(out), { A: 1, B: 0, C: 1 })
}

suite('F3', '剩余关键词列表按 done 排除，hashtag 带 #')
{
  const st = {
    tasks: [{ keyword: 'a', dimension: 'category', platform: 'tiktok' },
            { keyword: 'b', dimension: 'scene', platform: 'instagram', as_hashtag: true },
            { keyword: 'c', dimension: 'audience', platform: 'tiktok' }],
    done: [0],
  } as any
  eq('跳过已完成，hashtag 带 #', pendingKeywords(st), ['#b(instagram)', 'c(tiktok)'])
}

suite('P5', '交付必须声明数据边界')
{
  const html = renderHtml([mk('tiktok', 'a', { tier: 'A', score: 50 })],
    { product: 'p', market: 'US', platforms: ['tiktok'], keywords: [],
      total: 1, tiers: { A: 1, B: 0, C: 0 }, email_count: 0,
      cross_platform_count: 0, requests: 1, cost_estimate_usd: 0.001,
      budget_usd: 2, enriched: false })
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
      cross_platform_count: 0, requests: 1, cost_estimate_usd: 0.001,
      budget_usd: 2, enriched: true })
  ok('已增强时不再声明', !enriched.includes('未做有效性验证'))

  const empty = renderHtml([], {
    product: 'p', market: 'US', platforms: [], keywords: [], total: 0,
    tiers: { A: 0, B: 0, C: 0 }, email_count: 0, cross_platform_count: 0,
    requests: 0, cost_estimate_usd: 0, budget_usd: 2, enriched: false,
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
    cross_platform_count: 0, requests: 1, cost_estimate_usd: 0.001,
    budget_usd: 2, enriched: true }
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
  for (const bad of [null, undefined, 'okk', 'OK', 42, {}]) {
    eq(`认不出的状态（${JSON.stringify(bad)}）读作 unknown`, asMemoryStatus(bad), 'unknown')
  }

  const normal = renderHtml(one, { ...base, memory_status: 'ok', memory_written: true })
  ok('一切正常时不加噪音',
    !normal.includes('未做「已联系 / 已推荐」去重') && !normal.includes('未记入跨任务记忆') &&
    !normal.includes('无从确认'))
}

// ─────────────────────────── 数据 ───────────────────────────

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
    validateRegistry([strip(req('D1'), 'text')], adrs, ['D', 'P'])
      .every(m => m.includes('不是非空字符串')))

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
    claimedCriteria: new Set<string>(), exemptIds: new Set<string>(), ...over,
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

suite('P1', '纪律 lint 的判定：会变成决策的字段上不许有兜底')
{
  /**
   * P1 机器可执行的那一半就是这条 lint。它自己一直没有测试、也没有变异守着 ——
   * 一个从来没被证伪过的检查，和没有检查之间的差别只有心理作用。
   *
   * 断言依据只有三样：P1 原文、docs/CONVENTIONS.md 第 1 条（三态不许压成两档、
   * `?? null` 也是兜底），以及这条 lint 自己声明的职责 —— 只盯**会变成决策的
   * 数据字段**，例外必须写明理由。没有从实现里抄字段表：下面的字段是按
   * 「它的值会不会进入过滤、评分、分层」挑的。
   */
  const DECIDING = ['followers', 'views', 'plays', 'likes', 'email', 'median_views']
  const DISPLAY = ['label', 'title', 'nickname', 'desc']
  const FALLBACKS = ['0', "''", '[]', 'false', 'null']

  for (const field of DECIDING) {
    for (const v of FALLBACKS) {
      eq(`${field} 上的 ?? ${v} 判违规`, judgeLine(`  const x = c.${field} ?? ${v}`), 'violation')
      eq(`${field} 上的 || ${v} 判违规`, judgeLine(`  const x = c.${field} || ${v}`), 'violation')
    }
  }

  // 一个满屏假阳性的检查会被忽略，而被忽略的检查比没有检查更糟。
  for (const field of DISPLAY) {
    eq(`展示层的 ${field} 上同样的写法不报`, judgeLine(`  const x = c.${field} ?? ''`), 'clean')
  }
  eq('敏感字段但没有兜底不报', judgeLine('  if (c.followers !== undefined) return true'), 'clean')

  // 「没测量」和「测量结果是零」必须是两个不同的值 —— 空输入返回 0 是同一件事的
  // 另一种形状，敏感字段名在这一行里根本不出现。
  eq('空输入返回 0 判违规', judgeLine('  if (!values.length) return 0'), 'violation')

  eq('写明理由的 p1-ok 是具名豁免',
    judgeLine("  const x = c.followers ?? 0   // p1-ok: 展示用，不参与决策"), 'exempt')
  eq('只写 p1-ok 不写理由的不算豁免',
    judgeLine('  const x = c.followers ?? 0   // p1-ok'), 'unjustified_exemption')
}

suite('P1', '纪律 lint 的扫描范围：scripts/ 全量，例外只有说好的那两处')
{
  /**
   * 判定写对了、但扫不到那个文件，等于没查。P1.b 的后半句「对 scripts/ 全量扫描」
   * 自己也要被证伪一次 —— 递归少走一层、例外表悄悄放大，检查照样打印「无违规」，
   * 而它已经看不见半个仓库了。
   *
   * 断言依据只有 P1.b 原文，和这条 lint 自己声明的两处例外（检查链自己那一坨、
   * 测试文件里故意写出来的样例）—— 那是**两个位置**，不是两个名字。搭一棵假树，
   * 因为真树上没有违规可扫。
   */
  const root = join(tmpdir(), `kol-lint-${process.pid}`)
  rmSync(root, { recursive: true, force: true })
  const put = (rel: string, body: string) => {
    mkdirSync(join(root, dirname(rel)), { recursive: true })
    writeFileSync(join(root, rel), body, 'utf8')
  }
  const BAD = '  const x = c.followers ?? 0'
  put('lib/deep/score.ts', BAD)                                  // 嵌套两层：递归得下得去
  put('check/self.ts', BAD)                                      // 检查链自己那一坨不算
  put('test.ts', BAD)                                            // 测试里的样例不算
  put('lib/notes.md', BAD)                                       // 只看 .ts
  put('lib/ok.ts', `${BAD}   // p1-ok: 展示用，不参与决策`)
  // 例外是**两个具体位置**，不是两个名字。按名字排除的话，下面这两个跟着被放过 ——
  // 而 lib/ 恰恰是最会出兜底的地方，「全量扫描」就是这么缩水的。
  put('lib/check/nested.ts', BAD)                                // 顶层以下的同名目录：该扫
  put('lib/test.ts', BAD)                                        // 顶层以下的同名文件：该扫

  const { hits, exempted } = lintTree(root)
  eq('该扫的都报了，说好的那两处例外之外一个不漏',
    hits.map(h => h.file.slice(root.length + 1)).sort().join('|'),
    'lib/check/nested.ts|lib/deep/score.ts|lib/test.ts')
  eq('报到行，不是只报文件', hits[0]?.line, 1)
  eq('写明理由的具名豁免被数进去，不报违规', exempted, 1)
  rmSync(root, { recursive: true, force: true })

  // 「命中即失败」还剩退出码那一截，长在入口脚本里：由 scripts/check/selfcheck.ts
  // 拿一棵只含一处违规的假树真跑一遍 lint.ts，断言它以退出码 1 结束。
  criterion('P1.b')
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
  eq('❌ 一律降到 C', tierOf(high), 'C')
  high.fit = '✅'
  eq('✅ 且有邮箱 → A', tierOf(high), 'A')
  const noEmail = mk('tiktok', 'y', { fit: '✅', score: 45 })
  eq('强相关但缺邮箱 → B 而非 C', tierOf(noEmail), 'B')
}

suite('F7', '预算 50%/80% 各提醒一次')
{
  const seen: number[] = []
  const b = new Budget(0.010, 0, pct => seen.push(pct))
  for (let i = 0; i < 9; i++) b.charge()
  eq('两个阈值各触发一次', seen, [0.5, 0.8])
}

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
      requests: 1, cost_estimate_usd: 0.001, budget_usd: 2, enriched: false })
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
      requests: 1, cost_estimate_usd: 0.001, budget_usd: 2, enriched: false })
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
      requests: 1, cost_estimate_usd: 0.001, budget_usd: 2, enriched: false })
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
    requests: 2, cost_estimate_usd: 0.002, budget_usd: 2, enriched: false,
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
      requests: 1, cost_estimate_usd: 0.001, budget_usd: 2, enriched: false })
  ok('渲染草稿', html.includes('Hi there'))
  ok('有复制按钮', html.includes('cp(this)'))
}

harness('变异测试：测试进程崩了不算抓到')
{
  // 「被抓到」= 断言红了。一处语法错、一个 TypeError 也能让进程非零退出，但那不是任何一条断言的功劳
  eq('零退出 → 存活', judgeRun(0, '全部通过（覆盖 26 条需求）'), 'survived')
  eq('非零退出且有失败汇总 → 抓到', judgeRun(1, '  ✗ 某条\n\n2 个失败\n'), 'caught')
  eq('非零退出但没有汇总 → 跑不起来，不算抓到', judgeRun(1, "TypeError: Cannot read properties of undefined"), 'crashed')
  eq('被信号杀掉（没有退出码）也不算抓到', judgeRun(null, ''), 'crashed')
  eq('汇总必须是自成一行的那句，正文里提到「个失败」不算', judgeRun(1, '断言说：这里不该有 3 个失败的例子'), 'crashed')
}

harness('审计：检查链自己的判定模块必须有变异守着')
{
  // 入口（带 shebang）不算：按 CONVENTIONS 第 10 条它不该装判定；其余每个文件都是「有判定要能被测」。
  // 不按文件名后缀认 —— trailer.ts、quoted.ts 都是判定，不叫 rule
  const files = [
    { path: 'scripts/check/lint.ts', entry: true },
    { path: 'scripts/check/lint-rule.ts', entry: false },
    { path: 'scripts/check/trailer.ts', entry: false },
    { path: 'scripts/check/fake-fetch.ts', entry: false },
  ]
  eq('入口不算、豁免的不算，其余都算', judgmentModules(files),
    ['scripts/check/lint-rule.ts', 'scripts/check/trailer.ts'])
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

harness('分支寿命：分叉时长有上限，超线要具名豁免')
{
  // 阈值按本仓库自己的历史校准：已合并 PR 最长 22.9 小时，三条出事的在途分支
  // 91.5 / 91.5 / 102.8 小时 —— 48 落在这两组数之间的空档里
  eq('线内通过', judgeAge(22.9, null).kind, 'ok')
  eq('正好压线仍算线内', judgeAge(LIMIT_HOURS, null).kind, 'ok')
  eq('超线且无豁免 → 拦下', judgeAge(102.8, null).kind, 'over')
  eq('超线但有豁免 → 放行', judgeAge(102.8, '等上游接口定稿').kind, 'waived')
  // 豁免不消灭数字：报告照打小时数，豁免只让它别拦路
  eq('豁免带着理由一起报', (judgeAge(102.8, '等上游接口定稿') as { reason: string }).reason,
    '等上游接口定稿')

  // 作者时间在未来（时钟不准，或者 `git commit --date=<未来>`）→ 分叉时长是负数。
  // 「负数 ≤ 48」成立，于是一条真实两百小时的分支报出 `✓ 分叉 -720.0 / 48 小时`：
  // 一个不可能的数，旁边打着勾。这不是「很新」，是量不了
  eq('作者时间在未来 → 量不了，不是通过', judgeAge(-720, null).kind, 'future')
  eq('差一点点也一样 —— 不设容差', judgeAge(-0.01, null).kind, 'future')
  eq('零算在线内', judgeAge(0, null).kind, 'ok')
  // 豁免免的是「这条分支活得久」，不是「这个数我算不出来」
  eq('豁免盖不过「量不了」', judgeAge(-720, '有理由').kind, 'future')

  // 作者时间是用户可控的：`git commit --amend --reset-author` 一句就能把一条
  // 两百小时的分支洗成 0 小时（实测）。所以出生时间要和一个改写不了的锚
  // （PR 创建时间）取更早的一个。按得住的是 PR 开出来**之后**的改写；之前的、
  // 以及「另开一条分支搬过去」都按不住 —— 见 birthOf 的注释
  const 早 = '2026-08-24T00:00:00Z'
  const 晚 = '2026-09-01T00:00:00Z'
  eq('作者时间更早 → 用作者时间，锚不抢', birthOf(早, 晚), { kind: 'birth', at: 早, fromAnchor: false })
  eq('作者时间被洗到更晚 → 用锚', birthOf(晚, 早), { kind: 'birth', at: 早, fromAnchor: true })
  eq('没有锚 → 只能用作者时间（没有 PR 的分支就是这样）',
    birthOf(晚, null), { kind: 'birth', at: 晚, fromAnchor: false })
  // 锚给了却读不出来：那是「量不了」，不是「没有锚」。原先退回作者时间——退回去的正是
  // 用户可控的那个钟，而且在锚最该起作用的时候（历史被改写过）。评审指出，ADR-61 就地更正
  eq('锚给了却解析不出来 → 「量不了」是一个有名字的判定，不退回作者时间',
    birthOf(晚, '不是时间'), { kind: 'unreadable-anchor' })
  eq('空串也算给了锚 → 量不了，不当成没有锚', birthOf(晚, ''), { kind: 'unreadable-anchor' })
  // Date.parse 什么都肯认：Jan 1 9999 也是一个有限的时间，和刚洗过的作者时间比就静默选了作者时间
  eq('长得不像时间戳的也算读不出来，即使 Date.parse 认', birthOf(晚, 'Jan 1 9999'), { kind: 'unreadable-anchor' })
  // 形状对、日历上不存在：Date.parse 悄悄进位成下一天，那是另一个时间
  eq('4 月 31 日 → 读不出来', birthOf(晚, '2026-04-31T00:00:00Z'), { kind: 'unreadable-anchor' })
  eq('24 点 → 读不出来', birthOf(晚, '2026-01-01T24:00:00Z'), { kind: 'unreadable-anchor' })
  eq('平年 2 月 29 日 → 读不出来', birthOf(晚, '2023-02-29T00:00:00Z'), { kind: 'unreadable-anchor' })
  eq('闰年 2 月 29 日存在', birthOf(晚, '2024-02-29T00:00:00Z'), { kind: 'birth', at: '2024-02-29T00:00:00Z', fromAnchor: true })
  eq('带时区偏移的也认', birthOf(晚, '2026-02-28T23:59:59+08:00'), { kind: 'birth', at: '2026-02-28T23:59:59+08:00', fromAnchor: true })

  // `--all` 那条路上的锚：每条分支若有开着的、同仓库的 PR，用它的创建时间。
  // 量到过：同一条分支，--all 报 108.1 小时，--ref --since <PR 创建时间> 报 118.8 —— 差 10.7
  const pr = (number: number, headRefName: string, createdAt: string, isCrossRepository = false) =>
    ({ number, headRefName, createdAt, isCrossRepository, baseRefOid: 'base0' })
  eq('有开着的 PR → 用它的创建时间', anchorFor('b', [pr(5, 'b', 早)]),
    { kind: 'anchored', at: 早, pr: 5, base: 'base0' })
  eq('fork 来的 PR 不算 —— 那条分支在 fork 里，基仓同名的是另一条',
    anchorFor('b', [pr(5, 'b', 早, true)]), { kind: 'no-pr' })
  eq('同一条分支两个 PR → 取最早的', anchorFor('b', [pr(6, 'b', 晚), pr(5, 'b', 早)]),
    { kind: 'anchored', at: 早, pr: 5, base: 'base0' })
  eq('别的分支的 PR 不算', anchorFor('b', [pr(5, 'c', 早)]), { kind: 'no-pr' })
  eq('没给清单 ≠ 没有 PR —— 前者是这次跑法的事，后者是这条分支的事',
    anchorFor('b', null), { kind: 'no-list' })
  eq('创建时间读不出来 → 说读不出来，不当成没有 PR；那个字串原样带出去，交给 birthOf 拒答',
    anchorFor('b', [pr(5, 'b', '不是时间')]), { kind: 'unreadable', pr: 5, at: '不是时间' })
  eq('创建时间不是 RFC 3339 的形状 → 读不出来，即使 Date.parse 认',
    anchorFor('b', [pr(5, 'b', 'Jan 1 9999')]), { kind: 'unreadable', pr: 5, at: 'Jan 1 9999' })
  eq('几个 PR 里有一个读不出来 → 整条读不出来，不悄悄拿剩下的当锚 —— 丢掉的可能正是最早的',
    anchorFor('b', [pr(6, 'b', '不是时间'), pr(5, 'b', 早)]), { kind: 'unreadable', pr: 6, at: '不是时间' })
  eq('清单不是数组 → 读不出来', parsePrList('{}'), null)
  eq('条目缺字段 → 读不出来，不猜', parsePrList('[{"number":5}]'), null)
  eq('合格的清单', parsePrList(JSON.stringify([pr(5, 'b', 早)]))?.length, 1)
  // 豁免的扫描范围要 PR 的 base(ownSince),所以清单里的 baseRefOid 要一起带出来
  eq('清单里带 base 就一起带出来', anchorFor('b', [{ ...pr(5, 'b', 早), baseRefOid: 'a2' }]),
    { kind: 'anchored', at: 早, pr: 5, base: 'a2' })
  eq('base 不像 SHA → 读不出来，不当成没给', parsePrList(JSON.stringify([{ ...pr(5, 'b', 早), baseRefOid: 7 }])), null)
  eq('少了 baseRefOid 这一列 → 整份清单不算 —— 否则 --all 那条路的豁免范围静默退回整条链',
    parsePrList(JSON.stringify([{ ...pr(5, 'b', 早), baseRefOid: undefined }])), null)

  eq('理由必填 —— 只写指令不算', judgeAgeExemption('age-ok:'), null)
  eq('只有空白也不算', judgeAgeExemption('age-ok:   '), null)
  eq('写了理由就算', judgeAgeExemption('age-ok: 等上游'), '等上游')
  // 判据借的是 trailer 块（和体量豁免同一份实现）：正文里的示例一律不算
  eq('和 Co-Authored-By 同一段的算',
    scanAgeWaiver('标题\n\n正文\n\nage-ok: 等上游\nCo-Authored-By: x <a@b.c>'), '等上游')
  eq('正文里举的例子不算',
    scanAgeWaiver('标题\n\n想豁免就写：\n\n    age-ok: 某个理由\n\n就这样。'), null)
  eq('最后一段掺了散文 → 整段不算',
    scanAgeWaiver('标题\n\nage-ok: 等上游\n这一行是散文'), null)

  // ── 量分支的那几个判定。抽出入口才够得着：顺序错了会出错的都是语义 ──

  const c = (at: number, sha: string) => ({ at, iso: new Date(at * 1000).toISOString(), sha })

  // 三种「不是分叉」彼此不同，不能塞成一种
  eq('没有共同祖先 → 不相干', shapeOf(null, 'tip', [], 0).kind, 'unrelated')
  eq('分叉点就是分支头 → 已合完', shapeOf('x', 'x', [], 0).kind, 'merged')
  eq('范围里一个提交都没有 → 已合完', shapeOf('base', 'tip', [], 0).kind, 'merged')
  // 有提交、却一条作者时间都读不出来：那是「量不了」，不是「已合完」——
  // 当成已合完的话，这条分支会从「在途」那份名单里静默消失，而汇总照样说都在线内
  eq('有提交却读不出作者时间 → 量不了', shapeOf('base', 'tip', [], 3).kind, 'unreadable')

  // 取作者时间**最小**的那个，不是排在最前面的那个 —— cherry-pick 进来的老提交
  // 按提交时间排会落在后面，只看第一条等于根本没量到它（实测报过 ✓ 1.0 小时）
  const div = shapeOf('base', 'tip', [c(1000, 'newer12'), c(10, 'oldest1'), c(2000, 'newest')], 3)
  eq('挑的是作者时间最小的那个', div.kind === 'diverged' ? div.oldest.sha : '', 'oldest1')
  eq('提交数是全部，不是第一父链那几条', div.kind === 'diverged' ? div.commits : 0, 3)

  // 读不出纪元秒的行丢掉，不兜底成 0 —— 0 是 1970 年，一个比任何真实情况都老的分叉
  eq('读不出纪元秒的行丢掉', parseLog('x\tISO\tsha\n100\t2026-01-01T00:00:00Z\tabc').length, 1)
  eq('缺字段的行也丢掉', parseLog('100\t\tabc').length, 0)

  // 从哪个头开始走第一父链：调用方给的两件事实都成立才用它
  eq('没给头 → 用检出的那条', ownTipOf('tip', null, false), 'tip')
  eq('给了头但它不是祖先 → 不用，填错了不至于量到别处去', ownTipOf('tip', 'other', false), 'tip')
  eq('给了头且确实是祖先 → 用它', ownTipOf('merge', 'head', true), 'head')

  // 叠分支：B 直接从没合的 A 上开出去，A 的提交在 B 的第一父链上。base 里已有的提交去掉，
  // A 那句 age-ok 就不再是 B 的。判据是「是不是 base 的祖先」，不是「截到分叉点」——
  // B 把长了新提交的 A 合进来之后，分叉点在第二父那边、第一父链上碰不到，截法一刀都不切
  const inA = (base: string[]) => (sha: string) => base.includes(sha)
  const chain = ['b3', 'b2', 'b1', 'a2', 'a1']
  eq('base 是 A → A 的提交不扫', ownSince(chain, inA(['a2', 'a1'])), ['b3', 'b2', 'b1'])
  eq('A 又长了 a3、B 把 A 合了进来 → a1 a2 仍是 a3 的祖先，照样不扫',
    ownSince(['merge', 'b1', 'a2', 'a1'], inA(['a3', 'a2', 'a1'])), ['merge', 'b1'])
  eq('base 是主干 → 第一父链上没有它的提交，一条都不去', ownSince(chain, inA(['m9', 'm8'])), chain)
  eq('检出的那条也在 base 里 → 它也不算', ownSince(['b3', 'b2'], inA(['b3', 'b2'])), [])
  eq('base 里带豁免的那条被改写过 → 新 base 不含它，留下来（显式缺口）',
    ownSince(chain, inA(['a2改', 'a1'])), ['b3', 'b2', 'b1', 'a2'])

  // 检出的那条要单独排最前：PR 事件下它是合成的合并提交，根本不在第一父链上
  eq('检出的那条排最前，其余按第一父链', waiverOrder('m', ['a', 'b']), ['m', 'a', 'b'])
  eq('已经在链里就不重复扫', waiverOrder('a', ['a', 'b']), ['a', 'b'])

  // 取第一条成立的，并记下它写在哪个提交上 —— 没有 base 的跑法上，出处是叠分支继承豁免时唯一的线索
  eq('第一条成立的说了算，并带出处', pickWaiver([
    { sha: 'aaaaaaa1', message: '无关\n\nCo-Authored-By: x <a@b.c>' },
    { sha: 'bbbbbbb2', message: 'x\n\nage-ok: 等上游' },
    { sha: 'ccccccc3', message: 'y\n\nage-ok: 另一条' },
  ]), { reason: '等上游', from: 'bbbbbbb' })
  eq('一条都没有 → 没有豁免', pickWaiver([{ sha: 'a', message: '无关' }]), null)
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

  // 编号不可回收：只看当前目录的话，删一条再把号让给别的决策是查不出来的
  const A = (num: number, title: string): { file: string; num: number; title: string } =>
    ({ file: fileNameOf(num, title), num, title })
  const B = (num: number, title: string): [number, { file: string; title: string }] =>
    [num, { file: fileNameOf(num, title), title }]
  const base0 = new Map([B(1, '甲'), B(2, '乙')])

  eq('主干上有、这里没了 → 报错', checkAppendOnly(base0, [A(1, '甲')]).length, 1)
  eq('新增编号不报错', checkAppendOnly(base0, [A(1, '甲'), A(2, '乙'), A(58, '新')]), [])
  // 删掉记录、把号让给另一条决策 —— 号还在，只有标题露馅
  eq('号还在但标题换了 → 报错', checkAppendOnly(base0, [A(1, '甲'), A(2, '借尸还魂')]).length, 1)
  ok('不冻正文 —— 就地标注作废是既有做法（ADR-13），标题不动就放行',
    checkAppendOnly(new Map([B(13, '丙')]), [A(13, '丙')]).length === 0)

  // 文件名是有损代理：slugify 截到 32 字符，长标题只在那之后改动，文件名一模一样
  const long = '一'.repeat(32)
  ok('两个只在第 32 字符之后不同的标题，文件名相同',
    fileNameOf(9, long + '甲') === fileNameOf(9, long + '乙'))
  eq('比的是正文标题而不是文件名 —— 所以仍然抓得到',
    checkAppendOnly(new Map([B(9, long + '甲')]), [A(9, long + '乙')]).length, 1)
  eq('只改了会被 slugify 剔掉的标点，也抓得到',
    checkAppendOnly(new Map([B(9, '甲(乙)')]), [A(9, '甲乙')]).length, 1)

  eq('标题里的斜杠与括号在文件名里去掉',
    fileNameOf(15, '记忆读不出来时/不产出名单（也不覆盖）'), 'ADR-15-记忆读不出来时不产出名单也不覆盖.md')

  eq('编号唯一时无错', checkAll([
    { file: 'ADR-01-甲.md', num: 1, title: '甲' },
    { file: 'ADR-02-乙.md', num: 2, title: '乙' },
  ]), [])

  // 两条分支各自取了同一个号 —— 装在一个文件里时它是静默交错，装成文件才看得见
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

  // 豁免带着「写下之后这一类还净增了多少」。树对树算出来，不看提交顺序 ——
  // 按顺序算的那条路走了四版都不对，理由记在 size-rule.ts 的 Waiver 上。
  const W = (category: '源码' | '测试' | '文档' | '其他', addedAfter: number): Waiver =>
    ({ category, reason: 'r', addedAfter })

  const over = judge({ 源码: 400, 测试: 0, 文档: 0, 其他: 0 }, [], [])
  ok('超线且无豁免 → 失败', !over.ok)
  eq('报出超的那一类', over.over.map(o => o.category), ['源码'])

  const waived = judge({ 源码: 400, 文档: 2000, 测试: 0, 其他: 0 }, [W('源码', 0)], [])
  ok('豁免了源码，文档照样拦下 —— 一个豁免不放行四类', !waived.ok)
  eq('豁免的那一类进 waived 而不是 over', waived.waived.map(w => w.category), ['源码'])
  eq('没豁免的那一类仍在 over', waived.over.map(o => o.category), ['文档'])

  const stale = judge({ 源码: 4000, 测试: 0, 文档: 0, 其他: 0 }, [W('源码', 3600)], [])
  ok('豁免之后这一类又净增 → 过期，不放行', !stale.ok)
  eq('过期的进 stale，不进 waived', [stale.stale.map(x => x.category), stale.waived], [['源码'], []])

  // 加一行又删掉：最终 diff 没变，不该判成过期（按提交序列算时这里会误报）
  ok('净增为 0 → 仍有效', judge({ 源码: 4000, 测试: 0, 文档: 0, 其他: 0 }, [W('源码', 0)], []).ok)
  ok('净增为负（写下后反而删了）→ 仍有效',
    judge({ 源码: 4000, 测试: 0, 文档: 0, 其他: 0 }, [W('源码', -20)], []).ok)

  // 同类多条豁免：只要有一条覆盖到最终内容就放行
  ok('取净增最小的那条',
    judge({ 源码: 4000, 测试: 0, 文档: 0, 其他: 0 }, [W('源码', 3600), W('源码', 0)], []).ok)

  const bad = judge({ 源码: 0, 测试: 0, 文档: 0, 其他: 0 }, [], ['随便'])
  ok('写了不成立的 size-ok，即使没超线也失败 —— 否则它会被当成挡箭牌留在历史里', !bad.ok)
}

console.log(fail ? `\n${fail} 个失败\n` : `\n全部通过（覆盖 ${covered.size} 条需求）\n`)
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
if (claimsPublishable(process.env.MUTATING === '1', fail, startHash, endHash)) {
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

// 不 process.exit()：stdout 接的是管道时（变异测试就是这么跑的），刚 console.log 的那几行可能
// 还没写出去就被 exit 截掉 —— 实测 8 次里 1 次「N 个失败」那一行丢了，进程退出码 1 却没有汇总，
// mutate 判成「跑不起来」。设 exitCode 让进程自己走完，输出一定落地
process.exitCode = fail ? 1 : 0
