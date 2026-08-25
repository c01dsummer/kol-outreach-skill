export type Platform = 'tiktok' | 'instagram'
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
  followers: number
  post_count: number
  bio: string
  bio_links: string[]
  verified: boolean
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
