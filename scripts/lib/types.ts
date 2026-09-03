/** S4：只做出海平台。抖音/小红书/快手不在范围内 —— 账号体系与合规完全不同。 */
/**
 * 支持的平台。**运行时列表与类型从同一处派生** —— 手写两份迟早会分叉，
 * 而分叉的后果是校验放行一个查询侧永远匹配不到的值（ADR-25）。
 */
export const PLATFORMS = ['tiktok', 'instagram'] as const
export type Platform = typeof PLATFORMS[number]

/**
 * 一个必填的文字字段能不能用：**是字符串，而且去掉首尾空白之后还剩东西**。
 *
 * 判据来自读取侧 —— 记忆里一条产品名为空白的推荐记录，永远匹配不上任何产品，
 * 等于这条去重记录不存在。所以读进来、写出去，问的必须是同一个函数。
 *
 * 曾经各写各的：结构校验里两份、写回前一份 —— 判据本身没错，
 * 错在它得靠人记得在每条新路径上抄一遍（ADR-46 追记二）。
 */
export const textProblem = (v: unknown): string | undefined =>
  typeof v !== 'string' ? `不是字符串（${typeof v}）`
    : !v.trim() ? '是空的'
      : undefined

/**
 * 创作者的身份键 —— **D1 说的「同一个人」就是这个函数说了算。**
 *
 * 放在这里而不是某个用它的模块里，是因为**去重、记忆查询两侧必须是同一个规则**，
 * 而各写一份表达式时「一致」只是巧合：`collect` 原先只小写 handle、
 * `memory` 两个都小写，今天平台名恒为小写所以看不出来，改天就不是了（ADR-22 追记）。
 * 这个仓库为「同一段逻辑有几份副本」栽过不止一次（ADR-46）。
 */
export const creatorKey = (c: { platform: string; handle: string }): string =>
  `${c.platform.toLowerCase()}:${c.handle.toLowerCase()}`

/** D4：记忆「文件不存在」与「读不出来但调用方显式跳过」是两个状态，不得同值 */
export type MemoryStatus = 'ok' | 'absent' | 'unreadable_ignored'
/** F2：关键词的四个维度。竞品词权重最高（评分见 score.ts）。 */
export type Dimension = 'category' | 'scene' | 'competitor' | 'audience'
export type Tier = 'A' | 'B' | 'C'
export type Fit = '✅' | '⚠️' | '❌'

export interface RecentPost {
  desc: string
  plays?: number
  likes?: number
  comments?: number
  shares?: number
  published_at?: string
  is_pinned?: boolean
}

/** D8：所有会进入决策的派生指标都保留来源与测量状态。 */
export interface MetricSource {
  kind: 'public_api' | 'manual' | 'third_party'
  provider: string
  endpoint?: string
}

export type MetricUnavailableReason =
  | 'private_account'
  | 'insufficient_posts'
  | 'missing_post_dates'
  | 'invalid_post_date'
  | 'missing_followers'
  | 'missing_following'
  | 'zero_denominator'
  | 'insufficient_peer_group'
  | 'insufficient_comparable_metrics'
  | 'unsupported_content'
  | 'account_unavailable'

export type Measurement<T> =
  | {
      status: 'measured'
      value: T
      source: MetricSource
      observed_at: string
      sample_size: number
      basis: string
    }
  | {
      status: 'unavailable'
      reason: MetricUnavailableReason
      source: MetricSource
      observed_at: string
      sample_size?: number
    }

/** D8：关键词搜索命中的帖子有选择偏差，公开指标使用单独抓取的主页近期样本。 */
export interface NormalizedPublicPost {
  id: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
  published_at?: string
  is_pinned?: boolean
}

export type AudienceRiskLevel = 'low' | 'medium' | 'high'
export type AudienceRiskMetric = 'engagement_rate_followers' | 'view_rate' | 'following_ratio'
export type ActivityStatus = 'active' | 'cooling' | 'dormant'

export interface AudienceRiskFlag {
  metric: AudienceRiskMetric
  direction: 'low' | 'high'
  value: number
  threshold: number
  peer_size: number
}

export interface AudienceRiskAssessment {
  level: AudienceRiskLevel
  flags: AudienceRiskFlag[]
  peer_size: number
}

export interface PublicMetrics {
  median_views: Measurement<number>
  median_engagements: Measurement<number>
  engagement_rate_followers: Measurement<number>
  engagement_rate_views: Measurement<number>
  view_rate: Measurement<number>
  following_ratio: Measurement<number>
  reach_consistency: Measurement<number>
  median_post_gap_days: Measurement<number>
  latest_post_at: Measurement<string>
  days_since_last_post: Measurement<number>
  activity_status: Measurement<ActivityStatus>
  audience_quality_risk: Measurement<AudienceRiskAssessment>
}

/** D9：报价必须带交付口径；混合套餐不得硬算成单条效率。 */
export interface CollaborationQuote {
  amount: number
  currency: string
  platform: Platform
  format: 'tiktok_video' | 'instagram_reel' | 'instagram_post' | 'mixed_bundle'
  quantity: number
  source: 'creator_quote' | 'public_rate_card'
  observed_at: string
}

export interface QuoteEfficiency {
  implied_ecpm?: Measurement<number>
  implied_ecpe?: Measurement<number>
}

export interface AccountAssessment {
  platform: Platform
  handle: string
  followers?: number
  following?: number
  sample?: Measurement<NormalizedPublicPost[]>
  metrics?: PublicMetrics
  collaboration_quote?: Measurement<CollaborationQuote>
}

export interface AccountAssessmentSummary {
  platform: Platform
  handle: string
  followers?: number
  following?: number
  sample?: Measurement<number>
  metrics?: PublicMetrics
  collaboration_quote?: Measurement<CollaborationQuote>
  quote_efficiency?: QuoteEfficiency
}

export interface EnrichmentState {
  version: 1
  updated_at: string
  accounts: Record<string, AccountAssessment>
}

export interface TierAdjustment {
  kind: 'audience_geo' | 'audience_quality_risk'
  from: Tier
  to: Tier
  reason: string
}

export interface Creator {
  platform: Platform
  handle: string
  user_id?: string
  nickname: string
  /**
   * P1：这些字段可能是 undefined —— 那表示**没查到**，不是「值为 0/空」。
   * 不许用 ?? 0 / ?? '' 兜底：记成 0 会让人被粉丝下限过滤掉，
   * 记成 '' 会让「没取到 bio」被当成「bio 里没有邮箱」。
   */
  followers?: number
  following?: number
  post_count?: number
  bio?: string
  bio_links: string[]
  verified: boolean
  /** IG 私密账号 —— 建联方式受限，值得在名单里标出来 */
  is_private?: boolean
  avatar?: string
  profile_url: string

  source_keyword: string
  source_dimension: Dimension

  recent_posts: RecentPost[]

  // 采集后填充
  email?: string | null
  email_verified?: boolean
  audience_geo?: Record<string, number>
  /** @deprecated 没有可信供应商，保留只为兼容旧任务；分层逻辑明确忽略它。 */
  fake_follower_score?: number

  // 跨平台同人
  cross_platform?: boolean
  linked_handle?: string
  /** 被合并进另一条记录时填其 key，该条不进名单 */
  merged_into?: string

  // Agent 在 Phase 04 填充
  score?: number
  fit?: Fit
  fit_reason?: string
  tier?: Tier
  outreach_draft?: string

  // render 从 enrichment.json 关联的公开指标摘要；原始样本仍只存 enrichment.json
  account_assessment?: AccountAssessmentSummary
  linked_account_assessment?: AccountAssessmentSummary
  tier_adjustments?: TierAdjustment[]

  // 记忆命中
  previously_recommended?: string
}

/** 一个待执行的搜索任务：关键词 × 平台 */
export interface SearchTask {
  keyword: string
  dimension: Dimension
  platform: Platform
  /** IG hashtag 搜索时为 true，keyword 是不带 # 的话题名 */
  as_hashtag?: boolean
}

export interface TaskState {
  product: string
  market: string          // ISO 3166-1 alpha-2，如 US
  target_count: number
  budget_usd: number

  tasks: SearchTask[]
  /** 已完成（耗尽或已达标收尾）的 task 索引 */
  done: number[]

  /**
   * D6：每个 task 下一页的 offset。
   * 只记 done 不够 —— 预算在某个关键词跑到一半时用尽，续跑必须从那一页接上，
   * 否则会把已经付过费的几页重新抓一遍。
   */
  offsets: Record<number, number>

  /** 累计请求数 —— 跨多次运行累加，续跑时不重复计费 */
  requests: number

  created_at: string
  updated_at: string
}

/**
 * 一页搜索结果。
 *
 * 必须带回 `raw_count` 和 `has_more` —— 调用方不能假设每页固定 20 条：
 * 按固定步长递增 offset，遇到返回不足的一页就会**跳过数据**。
 */
export interface SearchPage {
  creators: Partial<Creator>[]
  /** API 本页实际返回的条数（去重前），offset 按它递增 */
  raw_count: number
  /** API 自己说还有没有下一页。比「本页新增 0 人」准，也省一次请求 */
  has_more: boolean
}
