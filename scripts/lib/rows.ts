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
  const [k, v] = Object.entries(c.audience_geo).sort((a, b) => b[1] - a[1])[0] ?? []   // p1-ok: 上一行已守 audience_geo 存在，此处仅防空对象
  return k ? `${k} ${Math.round((v as number) * 100)}%` : ''
}

const bestPost = (c: Creator): string =>
    [...(c.recent_posts ?? [])].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))[0]?.desc ?? ''   // p1-ok: 展示用文本，缺失即无内容

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
    c.tier, c.score, c.fit ?? '', c.fit_reason ?? '', c.platform, c.handle, c.nickname,
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
  return [...creators].sort((a, b) => rank(a) - rank(b) || (b.score ?? 0) - (a.score ?? 0))
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
