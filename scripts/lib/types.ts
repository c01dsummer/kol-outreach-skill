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
