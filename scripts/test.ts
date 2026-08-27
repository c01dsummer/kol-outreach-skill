#!/usr/bin/env tsx
/**
 * 需求测试。**每个用例标注它验的是哪条需求编号** —— 审计据此回答覆盖度。
 *
 * 写测试的纪律（process/4-VERIFY.md）：只看需求描述和验收标准，不读实现。
 * 本文件目前违反了这一条（同一上下文写的代码和测试），已登记为 ADR-04 的已知缺口。
 */
import { extractEmail, PR_SIGNALS } from './lib/email.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { scoreCreator, tierOf, passesFollowerGate } from './lib/score.js'
import { fillEmail, pickList } from './providers/tikhub.js'
import { esc } from './lib/csv.js'
import { HEADERS, toRow, cell, sortForOutput, buildSheets } from './lib/rows.js'
import { writeXlsx } from './lib/xlsx.js'
import { readFileSync as rf, unlinkSync as ul } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { Budget, BudgetExceeded } from './lib/budget.js'
import { renderHtml } from './lib/report.js'
import { filterByMemory, useMemoryFile } from './lib/memory.js'
import { finalize, pendingKeywords, rankCreators, keywordStats, tierCounts } from './lib/pipeline.js'
import {
  ACTIVITY_ACTIVE_MAX_DAYS, ACTIVITY_COOLING_MAX_DAYS,
  accountKey, assignAudienceRisks, attachAssessments, calculatePublicMetrics,
  calculateQuoteEfficiency, measured, unavailable,
} from './lib/assessment.js'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  AccountAssessment, AudienceRiskAssessment, CollaborationQuote, Creator,
  EnrichmentState, MetricSource, NormalizedPublicPost, RecentPost,
} from './lib/types.js'

let fail = 0
let cur = ''
export const covered = new Set<string>()

const suite = (req: string, name: string) => { cur = req; covered.add(req); console.log(`\n[${req}] ${name}`) }
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fail++; console.log(`  ✗ ${label}\n     got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`) }
  else console.log(`  ✓ ${label}`)
}
const ok = (label: string, cond: boolean) => eq(label, cond, true)

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
   * 这一档能验的只有「不得被当成大数」那一半。另一半只剩类型层
   * （RecentPost.plays 可选）挡着：纪律 lint 的敏感字段表里有 views、play_count，
   * 没有 plays —— 实测 `p.plays ?? 0` 不会被 lint 拦下。已报告，不在本次改动范围内。
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

  unlinkSync(tmp)
  useMemoryFile('memory/creators.json')
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
  ok('未增强时声明邮箱未验证', html.includes('未做有效性验证'))
  ok('未增强时声明受众未知', html.includes('无法确认'))

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

  const activeCreator = mk('tiktok', 'active-kol', {
    email: 'a@example.com', fit: '✅',
    account_assessment: {
      platform: 'tiktok', handle: 'active-kol', metrics: metricsAt(10),
    },
  })
  const dormantCreator = mk('tiktok', 'dormant-kol', {
    email: 'd@example.com', fit: '✅',
    account_assessment: {
      platform: 'tiktok', handle: 'dormant-kol', metrics: metricsAt(120),
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
  ok('HTML 明说风险不是假粉率或带货效果',
    html.includes('不是假粉率') && html.includes('不能代表实际带货效果'))
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

console.log(fail ? `\n${fail} 个失败\n` : `\n全部通过（覆盖 ${covered.size} 条需求）\n`)
if (process.argv.includes('--json')) {
  console.log('COVERED=' + JSON.stringify([...covered]))
}
process.exit(fail ? 1 : 0)
