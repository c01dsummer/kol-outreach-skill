import type {
  AccountAssessment,
  AccountAssessmentSummary,
  ActivityStatus,
  AudienceRiskAssessment,
  AudienceRiskFlag,
  AudienceRiskMetric,
  CollaborationQuote,
  Creator,
  EnrichmentState,
  Measurement,
  MetricSource,
  MetricUnavailableReason,
  NormalizedPublicPost,
  Platform,
  PublicMetrics,
  QuoteEfficiency,
} from './types.js'

/** D8：每个平台最多看最近 12 条主页作品；任何派生指标至少要有 6 个有效观测。 */
export const PUBLIC_POST_SAMPLE_SIZE = 12
export const MIN_METRIC_POSTS = 6
export const MIN_PEER_SIZE = 8
export const ACTIVITY_ACTIVE_MAX_DAYS = 45
export const ACTIVITY_COOLING_MAX_DAYS = 90

const FOLLOWER_BANDS = [5_000, 25_000, 100_000, 500_000, 1_000_000, 5_000_001] as const
const FOLLOWER_BAND_LABELS = [
  '5k-<25k', '25k-<100k', '100k-<500k', '500k-<1m', '1m-5m',
] as const

export const accountKey = (platform: Platform, handle: string): string =>
  `${platform}:${handle.toLowerCase()}`

export function measured<T>(
  value: T,
  source: MetricSource,
  observedAt: string,
  sampleSize: number,
  basis: string,
): Measurement<T> {
  return { status: 'measured', value, source, observed_at: observedAt, sample_size: sampleSize, basis }
}

export function unavailable<T>(
  reason: MetricUnavailableReason,
  source: MetricSource,
  observedAt: string,
  sampleSize?: number,
): Measurement<T> {
  return {
    status: 'unavailable', reason, source, observed_at: observedAt,
    ...(sampleSize === undefined ? {} : { sample_size: sampleSize }),
  }
}

export function median(values: number[]): number {
  if (!values.length) throw new Error('median requires at least one value')
  const a = [...values].sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

/** 线性插值分位数，与常见表格工具的 inclusive percentile 一致。 */
export function percentile(values: number[], p: number): number {
  if (!values.length) throw new Error('percentile requires at least one value')
  if (p < 0 || p > 1) throw new Error('percentile must be between 0 and 1')
  const a = [...values].sort((x, y) => x - y)
  const at = (a.length - 1) * p
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  if (lo === hi) return a[lo]
  return a[lo] + (a[hi] - a[lo]) * (at - lo)
}

const metricFrom = (
  values: number[],
  source: MetricSource,
  observedAt: string,
  basis: string,
): Measurement<number> =>
  values.length < MIN_METRIC_POSTS
    ? unavailable('insufficient_posts', source, observedAt, values.length)
    : measured(median(values), source, observedAt, values.length, basis)

const followerMetric = (
  values: number[],
  followers: number | undefined,
  source: MetricSource,
  observedAt: string,
  basis: string,
): Measurement<number> => {
  if (followers === undefined) return unavailable('missing_followers', source, observedAt, values.length)
  if (followers <= 0) return unavailable('zero_denominator', source, observedAt, values.length)
  return metricFrom(values.map(v => v / followers), source, observedAt, basis)
}

interface ActivityMeasurements {
  latest_post_at: Measurement<string>
  days_since_last_post: Measurement<number>
  activity_status: Measurement<ActivityStatus>
}

/**
 * D10：活跃状态是采样时快照，只回答“截至查询时最后一次发布距今多久”。
 * 置顶会扭曲表现聚合，但不会抹掉一次真实发布，所以这里明确计入置顶作品。
 */
const calculateActivity = (
  posts: NormalizedPublicPost[],
  source: MetricSource,
  observedAt: string,
): ActivityMeasurements => {
  const dateValues = posts
    .slice(0, PUBLIC_POST_SAMPLE_SIZE)
    .flatMap(p => p.published_at === undefined ? [] : [p.published_at])

  const sameUnavailable = (reason: MetricUnavailableReason): ActivityMeasurements => ({
    latest_post_at: unavailable(reason, source, observedAt, dateValues.length),
    days_since_last_post: unavailable(reason, source, observedAt, dateValues.length),
    activity_status: unavailable(reason, source, observedAt, dateValues.length),
  })
  if (!dateValues.length) return sameUnavailable('missing_post_dates')

  const observed = Date.parse(observedAt)
  const timestamps = dateValues.map(Date.parse)
  if (!Number.isFinite(observed) || timestamps.some(t => !Number.isFinite(t) || t > observed)) {
    return sameUnavailable('invalid_post_date')
  }

  const latest = Math.max(...timestamps)
  const days = (observed - latest) / 86_400_000
  const status: ActivityStatus = days <= ACTIVITY_ACTIVE_MAX_DAYS
    ? 'active'
    : days <= ACTIVITY_COOLING_MAX_DAYS ? 'cooling' : 'dormant'
  const sampleSize = timestamps.length

  return {
    latest_post_at: measured(
      new Date(latest).toISOString(), source, observedAt, sampleSize,
      'max(published_at) across latest profile posts; pinned included'),
    days_since_last_post: measured(
      days, source, observedAt, sampleSize,
      '(sample observed_at - latest_post_at) / 24h'),
    activity_status: measured(
      status, source, observedAt, sampleSize,
      'active <=45d; cooling >45d and <=90d; dormant >90d'),
  }
}

/**
 * D8：适配器交回的原始列表在这里收成「样本」这条记录。
 *
 * 窗口截在这里，而不是留给入口脚本 —— `sample_size` 与 `basis` 是要写进
 * `enrichment.json`、最后被人读的溯源，说「最多 12 条」就必须真的不超过 12 条。
 * 提供方一次给几条由它自己决定（TikTok 那一路把整个 pickList 结果原样传下来），
 * 照原样记就会出现「basis 说 12 条、sample_size 写着 20」的自相矛盾。
 */
export function publicPostSample(
  posts: NormalizedPublicPost[],
  source: MetricSource,
  observedAt: string,
): Measurement<NormalizedPublicPost[]> {
  const window = posts.slice(0, PUBLIC_POST_SAMPLE_SIZE)
  return measured(
    window, source, observedAt, window.length,
    `up to ${PUBLIC_POST_SAMPLE_SIZE} latest short-form profile posts; ` +
    'pinned included for recency and excluded from aggregates',
  )
}

/**
 * D8：从非关键词偏置的主页近期样本计算公开指标。
 * 某条帖子缺任何一个分子字段时，只让该条退出对应指标，不把缺失当成 0。
 */
export function calculatePublicMetrics(
  sample: Measurement<NormalizedPublicPost[]>,
  followers?: number,
  following?: number,
): PublicMetrics {
  const source = sample.source
  const observedAt = sample.observed_at

  if (sample.status === 'unavailable') {
    const same = <T>(): Measurement<T> =>
      unavailable(sample.reason, source, observedAt, sample.sample_size)
    return {
      median_views: same(),
      median_engagements: same(),
      engagement_rate_followers: same(),
      engagement_rate_views: same(),
      view_rate: same(),
      following_ratio: same(),
      reach_consistency: same(),
      median_post_gap_days: same(),
      latest_post_at: same(),
      days_since_last_post: same(),
      activity_status: same(),
      audience_quality_risk: same(),
    }
  }

  const activity = calculateActivity(sample.value, source, observedAt)
  // D8 的两步有顺序：先把窗口定在最近 12 条，再从窗口里剔置顶。反过来的话，
  // 提供方多返回的第 13、14 条会顶上来补满 12 个 —— TikTok 那一路把整个
  // pickList 结果原样传下来，于是「最近 12 条」的口径变成「取决于这次多返回了几条」。
  // 剔完不足 6 条就按 insufficient_posts 报不可用，不去窗口外借。
  // 样本记录写进盘里之前已经截过一次（publicPostSample），这里仍然要截：
  // D10 允许对旧 enrichment.json 补算，而那些样本是在截断之前写下的。
  const posts = sample.value
    .slice(0, PUBLIC_POST_SAMPLE_SIZE)
    .filter(p => p.is_pinned !== true)
  const views = posts.flatMap(p => typeof p.views === 'number' && Number.isFinite(p.views) ? [p.views] : [])
  const engagements = posts.flatMap(p =>
    typeof p.likes === 'number' && Number.isFinite(p.likes) &&
    typeof p.comments === 'number' && Number.isFinite(p.comments)
      ? [p.likes + p.comments]
      : [])

  const viewEngagementRates = posts.flatMap(p => {
    if (typeof p.views !== 'number' || !Number.isFinite(p.views) || p.views <= 0) return []
    if (typeof p.likes !== 'number' || !Number.isFinite(p.likes)) return []
    if (typeof p.comments !== 'number' || !Number.isFinite(p.comments)) return []
    return [(p.likes + p.comments) / p.views]
  })

  const timestamps = posts.flatMap(p => {
    if (p.published_at === undefined) return []
    const time = Date.parse(p.published_at)
    return Number.isFinite(time) ? [time] : []
  }).sort((a, b) => a - b)
  // N 个发布时间只能形成 N-1 个间隔。这里按“间隔观测”计样本，不能拿
  // 6 个时间戳形成的 5 个间隔冒充“至少 6 个有效观测”。
  const gaps = timestamps.slice(1).map((time, i) => (time - timestamps[i]) / 86_400_000)

  let reachConsistency: Measurement<number>
  if (views.length < MIN_METRIC_POSTS) {
    reachConsistency = unavailable('insufficient_posts', source, observedAt, views.length)
  } else {
    const med = median(views)
    reachConsistency = med <= 0
      ? unavailable('zero_denominator', source, observedAt, views.length)
      : measured(percentile(views, 0.25) / med, source, observedAt, views.length,
          'p25(views) / median(views)')
  }

  let followingRatio: Measurement<number>
  if (followers === undefined) {
    followingRatio = unavailable('missing_followers', source, observedAt)
  } else if (followers <= 0) {
    followingRatio = unavailable('zero_denominator', source, observedAt)
  } else if (following === undefined) {
    followingRatio = unavailable('missing_following', source, observedAt)
  } else {
    followingRatio = measured(following / followers, source, observedAt, 1, 'following / followers')
  }

  return {
    median_views: metricFrom(views, source, observedAt, 'median(views)'),
    median_engagements: metricFrom(engagements, source, observedAt, 'median(likes + comments)'),
    engagement_rate_followers: followerMetric(
      engagements, followers, source, observedAt, 'median((likes + comments) / followers)'),
    engagement_rate_views: metricFrom(
      viewEngagementRates, source, observedAt, 'median((likes + comments) / views)'),
    view_rate: followerMetric(views, followers, source, observedAt, 'median(views / followers)'),
    following_ratio: followingRatio,
    reach_consistency: reachConsistency,
    median_post_gap_days: metricFrom(gaps, source, observedAt, 'median(days between posts)'),
    ...activity,
    audience_quality_risk: unavailable('insufficient_peer_group', source, observedAt),
  }
}

const bandOf = (followers: number): number => {
  for (let i = 0; i < FOLLOWER_BANDS.length - 1; i++) {
    if (followers >= FOLLOWER_BANDS[i] && followers < FOLLOWER_BANDS[i + 1]) return i
  }
  return -1
}

const riskMetric = (a: AccountAssessment, metric: AudienceRiskMetric): number | undefined => {
  const m = a.metrics?.[metric]
  return m?.status === 'measured' ? m.value : undefined
}

const comparableMetricCount = (a: AccountAssessment): number =>
  (['engagement_rate_followers', 'view_rate', 'following_ratio'] as const)
    .filter(metric => riskMetric(a, metric) !== undefined).length

/**
 * F8：风险是任务内的异常筛查，不是假粉率。至少两个可比较信号才有资格给结论。
 * 使用严格小于/大于：等于 P10/P90 不报警，但真正越过并列基线的异常仍会被识别。
 */
export function assignAudienceRisks(accounts: Record<string, AccountAssessment>): void {
  const all = Object.values(accounts)

  for (const target of all) {
    const sample = target.sample
    const metrics = target.metrics
    if (!sample || !metrics) continue
    if (sample.status === 'unavailable') {
      metrics.audience_quality_risk = unavailable(
        sample.reason, sample.source, sample.observed_at, sample.sample_size)
      continue
    }
    if (target.followers === undefined || bandOf(target.followers) < 0) {
      metrics.audience_quality_risk = unavailable(
        'missing_followers', sample.source, sample.observed_at)
      continue
    }

    const targetBand = bandOf(target.followers)
    // “同行”是其他账号：把 target 自己塞进分位数会让它参与定义自己的异常阈值。
    // 同档不足不跨档拼样本；不同规模的自然互动基线不同，硬拼会制造伪精度。
    const peers = all.filter(a =>
      a !== target && a.platform === target.platform && a.followers !== undefined &&
      bandOf(a.followers) === targetBand && comparableMetricCount(a) >= 2)
    if (peers.length < MIN_PEER_SIZE) {
      metrics.audience_quality_risk = unavailable(
        'insufficient_peer_group', sample.source, sample.observed_at, peers.length)
      continue
    }

    const flags: AudienceRiskFlag[] = []
    const evaluatedPeerSizes: number[] = []
    const checks: Array<{ metric: AudienceRiskMetric; direction: 'low' | 'high' }> = [
      { metric: 'engagement_rate_followers', direction: 'low' },
      { metric: 'view_rate', direction: 'low' },
      { metric: 'following_ratio', direction: 'high' },
    ]

    for (const check of checks) {
      const value = riskMetric(target, check.metric)
      if (value === undefined) continue
      const peerValues = peers.flatMap(a => {
        const v = riskMetric(a, check.metric)
        return v === undefined ? [] : [v]
      })
      if (peerValues.length < MIN_PEER_SIZE) continue
      evaluatedPeerSizes.push(peerValues.length)

      const threshold = percentile(peerValues, check.direction === 'low' ? 0.1 : 0.9)
      const flagged = check.direction === 'low' ? value < threshold : value > threshold
      if (flagged) {
        flags.push({
          metric: check.metric,
          direction: check.direction,
          value,
          threshold,
          peer_size: peerValues.length,
        })
      }
    }

    if (evaluatedPeerSizes.length < 2) {
      metrics.audience_quality_risk = unavailable(
        'insufficient_comparable_metrics', sample.source, sample.observed_at,
        evaluatedPeerSizes.length ? Math.min(...evaluatedPeerSizes) : undefined)
      continue
    }

    const risk: AudienceRiskAssessment = {
      level: flags.length >= 2 ? 'high' : flags.length === 1 ? 'medium' : 'low',
      flags,
      peer_size: Math.min(...evaluatedPeerSizes),
    }
    metrics.audience_quality_risk = measured(
      risk, sample.source, sample.observed_at, risk.peer_size,
      `same-platform ${FOLLOWER_BAND_LABELS[targetBand]} follower-band P10/P90 anomaly signals; ` +
      'target excluded; high requires at least two')
  }
}

const quoteUnavailable = (
  reason: MetricUnavailableReason,
  quote: Measurement<CollaborationQuote>,
): Measurement<number> =>
  unavailable(reason, quote.source, quote.observed_at, quote.sample_size)

/** D9：只计算明确、同平台、同形式报价的隐含效率，不自动估价。 */
export function calculateQuoteEfficiency(account: AccountAssessment): QuoteEfficiency | undefined {
  const quote = account.collaboration_quote
  if (!quote) return undefined
  if (quote.status === 'unavailable') return {
    implied_ecpm: quoteUnavailable(quote.reason, quote),
    implied_ecpe: quoteUnavailable(quote.reason, quote),
  }

  const q = quote.value
  const expectedFormat = account.platform === 'tiktok' ? 'tiktok_video' : 'instagram_reel'
  const compatible = q.platform === account.platform && q.format === expectedFormat &&
    q.amount > 0 && q.quantity > 0
  if (!compatible) {
    return {
      implied_ecpm: quoteUnavailable('unsupported_content', quote),
      implied_ecpe: quoteUnavailable('unsupported_content', quote),
    }
  }

  const perDeliverable = q.amount / q.quantity
  const fromMetric = (
    m: Measurement<number> | undefined,
    scale: number,
    basis: string,
  ): Measurement<number> | undefined => {
    if (!m) return undefined
    if (m.status === 'unavailable') return quoteUnavailable(m.reason, quote)
    if (m.value <= 0) return quoteUnavailable('zero_denominator', quote)
    return measured(perDeliverable / m.value * scale, quote.source, quote.observed_at,
      m.sample_size, basis)
  }

  return {
    implied_ecpm: fromMetric(account.metrics?.median_views, 1_000,
      '(quote / quantity) / median_views * 1000'),
    implied_ecpe: fromMetric(account.metrics?.median_engagements, 1,
      '(quote / quantity) / median(likes + comments)'),
  }
}

const summaryOf = (a: AccountAssessment): AccountAssessmentSummary => {
  const efficiency = calculateQuoteEfficiency(a)
  const sample = a.sample?.status === 'measured'
    ? measured(a.sample.value.length, a.sample.source, a.sample.observed_at,
        a.sample.sample_size, a.sample.basis)
    : a.sample
  return {
    platform: a.platform,
    handle: a.handle,
    ...(a.followers === undefined ? {} : { followers: a.followers }),
    ...(a.following === undefined ? {} : { following: a.following }),
    ...(sample ? { sample } : {}),
    ...(a.metrics ? { metrics: a.metrics } : {}),
    ...(a.collaboration_quote ? { collaboration_quote: a.collaboration_quote } : {}),
    ...(efficiency ? { quote_efficiency: efficiency } : {}),
  }
}

/** U7：把 enrichment.json 的当前摘要关联到交付行；缺文件时清掉旧摘要，避免陈旧数据冒充本次数据。 */
export function attachAssessments(creators: Creator[], state?: EnrichmentState): void {
  for (const c of creators) {
    delete c.account_assessment
    delete c.linked_account_assessment
    if (!state) continue

    const primary = state.accounts[accountKey(c.platform, c.handle)]
    if (primary) c.account_assessment = summaryOf(primary)

    if (c.linked_handle) {
      const split = c.linked_handle.indexOf(':')
      const platform = c.linked_handle.slice(0, split)
      const handle = c.linked_handle.slice(split + 1)
      if ((platform === 'tiktok' || platform === 'instagram') && handle) {
        const linked = state.accounts[accountKey(platform, handle)]
        if (linked) c.linked_account_assessment = summaryOf(linked)
      }
    }
  }
}
