/** S4：只做出海平台。抖音/小红书/快手不在范围内 —— 账号体系与合规完全不同。 */
export type Platform = 'tiktok' | 'instagram'
/** F2：关键词的四个维度。竞品词权重最高（评分见 score.ts）。 */
export type Dimension = 'category' | 'scene' | 'competitor' | 'audience'
export type Tier = 'A' | 'B' | 'C'
export type Fit = '✅' | '⚠️' | '❌'

export interface RecentPost {
  desc: string
  plays?: number
  likes?: number
}

export interface Creator {
  platform: Platform
  handle: string
  user_id?: string
  nickname: string
  /**
   * P1：这三个字段可能是 undefined —— 那表示**没查到**，不是「值为 0/空」。
   * 不许用 ?? 0 / ?? '' 兜底：记成 0 会让人被粉丝下限过滤掉，
   * 记成 '' 会让「没取到 bio」被当成「bio 里没有邮箱」。
   */
  followers?: number
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
  /** 已完成的 task 索引，用于断点续跑 */
  done: number[]

  /** 累计请求数 —— 跨多次运行累加，续跑时不重复计费 */
  requests: number

  created_at: string
  updated_at: string
}
