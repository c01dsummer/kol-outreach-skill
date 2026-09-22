import type { AudienceRiskFlag, Creator, Measurement } from './types.js'

/** U1：列定义固定，顺序即 CSV 表头 */
export const HEADERS = [
  'tier', 'score', 'fit', 'fit_reason', 'platform', 'handle', 'nickname',
  'followers', 'post_count', 'bio', 'email', 'email_verified', 'audience_geo_top',
  'metrics_account_followers', 'metrics_account_following',
  'engagement_rate_followers', 'engagement_rate_views', 'median_views', 'median_engagements', 'view_rate',
  'following_ratio', 'reach_consistency', 'median_post_gap_days',
  'latest_post_at', 'days_since_last_post', 'activity_status',
  'audience_quality_risk', 'audience_quality_reasons', 'tier_adjustments',
  'collaboration_quote', 'implied_ecpm', 'implied_ecpe', 'metrics_observed_at',
  'cross_platform', 'linked_handle', 'profile_url', 'source_keyword',
  'source_dimension', 'best_post_desc', 'outreach_draft', 'previously_recommended',
] as const

/**
 * P1：CSV 必须区分三档。
 *   undefined → 「未查询」   null/'' → 空白（查过，没有）   有值 → 值
 * 都写成空白就是把「没测量」说成「测量结果是零」。
 */
export const cell = (v: unknown): string =>
  v === undefined ? '未查询' : v === null ? '' : String(v)

const topGeo = (c: Creator): string => {
  if (!c.audience_geo) return ''
  const [k, v] = Object.entries(c.audience_geo).sort((a, b) => b[1] - a[1])[0] ?? []   // P1 例外：上一行已守 audience_geo 存在，此处仅防空对象
  return k ? `${k} ${Math.round((v as number) * 100)}%` : ''
}

/**
 * P1.e：这一列只有三态 —— 没问过作品 →「未查询」，问到了、文案是空的 → 空白，有文案 → 文案。
 *
 * 不走 `cell()`：空数组也得落到「未查询」。盘上的旧数据里空数组全是 IG 按账号名搜人那条
 * 兜底路径凭空写的，意思是没问过（见 `Creator.recent_posts`、ADR-102）。
 *
 * 没有「无作品」这一态：说得出这句话的证据只有主页样本，而 IG 的主页样本只留视频、
 * 把图文帖丢了（ADR-102 欠账）—— 测出来是零也不代表他没发过帖。
 */
const bestPost = (c: Creator): string => {
  const posts = c.recent_posts
  if (!posts?.length) return '未查询'
  // 挑播放最高的那条。缺播放数的排在有数的后面 —— 这里只决定展示哪一条，不写回数据
  return [...posts].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))[0].desc   // P1 例外：仅排序取展示项
}

const metricCell = <T>(m: Measurement<T> | undefined, format: (value: T) => unknown): unknown => {
  if (!m) return '未查询'
  if (m.status === 'unavailable') return `不可用:${m.reason}`
  return format(m.value)
}

const pct = (value: number): string => `${(value * 100).toFixed(2)}%`
const riskFlag = (flag: AudienceRiskFlag): string => {
  const name = {
    engagement_rate_followers: '粉丝互动率',
    view_rate: '播粉比',
    following_ratio: '关注/粉丝比',
  }[flag.metric]
  return `${name}${flag.direction === 'low' ? '偏低' : '偏高'}（同行 ${flag.peer_size}）`
}

const quoteCell = (c: Creator): string => {
  const quote = c.account_assessment?.collaboration_quote
  if (!quote) return '未查询'
  if (quote.status === 'unavailable') return `不可用:${quote.reason}`
  const q = quote.value
  return `${q.currency} ${q.amount} / ${q.quantity} ${q.format} (${q.source})`
}

const efficiencyCell = (c: Creator, field: 'implied_ecpm' | 'implied_ecpe'): string => {
  const value = c.account_assessment?.quote_efficiency?.[field]
  if (!value) return '未查询'
  if (value.status === 'unavailable') return `不可用:${value.reason}`
  const quote = c.account_assessment?.collaboration_quote
  const currency = quote?.status === 'measured' ? quote.value.currency : ''
  return `${currency} ${value.value.toFixed(2)}`.trim()
}

/**
 * 构造一行 CSV。
 *
 * P2：`outreach_draft` **原样输出** —— 不得删除、替换或「补全」草稿里的 {…}。
 * 抹掉占位符，运营就看不到还有待填项，会把半成品直接发出去。
 */
export function toRow(c: Creator): unknown[] {
  const assessment = c.account_assessment
  const metrics = assessment?.metrics
  const risk = metrics?.audience_quality_risk
  return [
    // score 单独留在这一行。原因是当年那条按**行**匹配的纪律 lint 会把它和下面两个
    // 把空串当缺省的表达式判成「score 上有兜底」(实际那两处落在 fit / fit_reason 上)。
    // 闸门 2026-09-18 撤了(ADR-77),这一行照旧分开 —— 分行本来就更好读,
    // 而且**这里根本没有 score 的兜底**这句话仍然要成立。
    c.tier, c.score,
    c.fit ?? '', c.fit_reason ?? '', c.platform, c.handle, c.nickname,
    cell(c.followers), cell(c.post_count), cell(c.bio), cell(c.email), cell(c.email_verified),
    topGeo(c), cell(assessment?.followers), cell(assessment?.following),
    metricCell(metrics?.engagement_rate_followers, pct),
    metricCell(metrics?.engagement_rate_views, pct),
    metricCell(metrics?.median_views, v => v),
    metricCell(metrics?.median_engagements, v => v),
    metricCell(metrics?.view_rate, pct),
    metricCell(metrics?.following_ratio, pct),
    metricCell(metrics?.reach_consistency, pct),
    metricCell(metrics?.median_post_gap_days, v => v.toFixed(1)),
    metricCell(metrics?.latest_post_at, v => v),
    metricCell(metrics?.days_since_last_post, v => v.toFixed(1)),
    metricCell(metrics?.activity_status, v => v),
    metricCell(risk, v => v.level),
    risk?.status === 'measured' ? risk.value.flags.map(riskFlag).join('；') :
      risk?.status === 'unavailable' ? `不可用:${risk.reason}` : '未查询',
    c.tier_adjustments?.map(a => `${a.from}→${a.to}: ${a.reason}`).join('；') ?? '',
    quoteCell(c), efficiencyCell(c, 'implied_ecpm'), efficiencyCell(c, 'implied_ecpe'),
    assessment?.sample?.observed_at ?? '未查询',
    c.cross_platform ?? false, c.linked_handle ?? '', c.profile_url, c.source_keyword,
    c.source_dimension, bestPost(c), c.outreach_draft ?? '', c.previously_recommended ?? '',
  ]
}

/** U1：tier 升序，同层 score 降序 */
export function sortForOutput(creators: Creator[]): Creator[] {
  const order = { A: 0, B: 1, C: 2 }
  // 未分层的排末位。写 order[c.tier!] 会在 tier 缺失时得到 NaN 比较器，
  // 而 NaN 是 falsy —— sort 会静默退化成「只按分数排」，且没有任何迹象。
  const rank = (c: Creator) => (c.tier ? order[c.tier] : 3)
  // 「还没算过分」不是「0 分」—— 与上面 tier 缺失同一处理:排本层末位,且与 0 分
  // 分得开。原来是把两边的 score 缺省成零再相减,两者被压成同一个值(P1.b)。
  // 不用哨兵值相减:两个都没分时会得到 NaN,正是上面那段注释警告过的比较器。
  const byScore = (a: Creator, b: Creator): number => {
    if (a.score === undefined && b.score === undefined) return 0
    if (a.score === undefined) return 1
    if (b.score === undefined) return -1
    return b.score - a.score
  }
  /**
   * P1.h：同层同分时，粉丝数分三档 —— **已查到且不是 0 → 未查询 → 确实是 0**。
   *
   * 「未查询」只压得过一个确认为 0 的人，压不过任何一个真查到了数的人：
   * 查到了数的那位有据可依；未查询的那位只是**可能**够，凭一个还没量过的可能
   * 越过量过的人，是拿不知道当成了本钱。而确实是 0 的那位已经量过、就是 0，
   * 「不知道」比他多一分指望，所以在他前面。
   *
   * **只改先后，不改分也不改层** —— 给「不知道」加分等于替他编一个他可能没有的
   * 实力，那会把他推进他不该进的档（需求所有者 2026-09-19 裁决，ADR-92）。
   */
  const followerRank = (c: Creator) =>
    c.followers === undefined ? 1 : c.followers === 0 ? 2 : 0
  const byFollowers = (a: Creator, b: Creator): number =>
    followerRank(a) - followerRank(b)
  return [...creators].sort((a, b) =>
    rank(a) - rank(b) || byScore(a, b) || byFollowers(a, b))
}

const TIER_LABEL = { A: 'A级 直接发信', B: 'B级 先互动', C: 'C级 观察池' } as const

/**
 * U5：按分层切成多个 sheet。
 *
 * **空分层也建 sheet**，名称里标出 `(0)` —— 「这一层一个人都没有」本身是信息。
 * 隐藏掉会让运营以为是数据漏了，而不是这一层真的没人。
 */
export function buildSheets(creators: Creator[]): Array<{ name: string; headers: string[]; rows: unknown[][] }> {
  const sorted = sortForOutput(creators)
  const out: Array<{ name: string; headers: string[]; rows: unknown[][] }> = []
  for (const t of ['A', 'B', 'C'] as const) {
    const rows = sorted.filter(c => c.tier === t)
    out.push({ name: `${TIER_LABEL[t]} (${rows.length})`, headers: [...HEADERS], rows: rows.map(toRow) })
  }
  return out
}
