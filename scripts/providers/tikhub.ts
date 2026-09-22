import type {
  Creator, Platform, SearchTask, RecentPost, SearchPage, MetricSource, NormalizedPublicPost,
} from '../lib/types.js'
import { Budget } from '../lib/budget.js'
import { extractEmail } from '../lib/email.js'

const BASE = 'https://api.tikhub.io'
/** 限速 10 RPS —— 留余量 */
const INTERVAL_MS = 150
export const TIKTOK_POSTS_ENDPOINT = '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3'
export const INSTAGRAM_POSTS_ENDPOINT = '/api/v1/instagram/v2/fetch_user_posts'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface PublicPostSample {
  posts: NormalizedPublicPost[]
  followers?: number
  following?: number
  source: MetricSource
}

const finiteNumber = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

const isoFromUnix = (v: unknown): string | undefined => {
  const n = finiteNumber(v)
  if (n === undefined) return undefined
  const d = new Date(n * 1000)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export class TikHubError extends Error {
  constructor(public status: number, msg: string) {
    super(msg)
    this.name = 'TikHubError'
  }
}

/**
 * 响应结构探测。
 *
 * TikHub 透传平台原始响应，schema 随端点和版本变化。按 cascade 找出记录数组，
 * 找不到就抛出并附上顶层 key —— **不硬猜**。
 *
 * 取「第一个非空数组」而不是「第一个存在的数组」：实测视频搜索会同时返回
 * 空的 aweme_list 和有数据的 search_item_list，命中前者会静默产出
 * 「这个关键词一个人都没有」，而事实是有 10 个。
 */
export function pickList(data: any, path: string): any[] {
  const d = data?.data ?? data
  const cands = [
    d?.search_item_list,                        // ★ TikTok 视频搜索的真实结果
    d?.data?.items,                             // ★ IG v2 search_reels / search_users
    d?.user_list, d?.users, d?.aweme_list,
    d?.data?.hashtag?.edge_hashtag_to_media?.edges,   // IG v1 hashtag（已弃用，见下）
    d?.data, d?.items, d?.result,
  ]
  const arrays = cands.filter(Array.isArray)

  const nonEmpty = arrays.find(a => a.length > 0)
  if (nonEmpty) return nonEmpty

  // 全空但确实是数组 → 这才是真的没有结果
  if (arrays.length) return []

  const keys = Object.keys(d ?? {}).join(', ')
  throw new TikHubError(0, `无法识别 ${path} 的响应结构。data 顶层 key: [${keys}]`)
}

export class TikHub {
  constructor(private key: string, private budget: Budget) {}

  /** 429 的退避重试次数。超过就放弃，不无限重试。 */
  private static readonly MAX_RETRY = 3
  private interval = INTERVAL_MS

  private async get(path: string, params: Record<string, string | number>): Promise<any> {
    const url = new URL(path, BASE)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }

    for (let attempt = 0; ; attempt++) {
      this.budget.charge()          // 预检 —— 超限在这里抛 BudgetExceeded
      await sleep(this.interval)

      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.key}` } })
      if (res.ok) return res.json()

      this.budget.refund()          // 非 200 不计费
      const body = await res.text().catch(() => '')

      if (res.status === 402) {
        throw new TikHubError(402, 'TikHub 余额不足，请充值后重试')
      }
      // 429：退避并**永久调慢后续间隔** —— 单次退避治标，撞过一次说明整体太快了
      if (res.status === 429 && attempt < TikHub.MAX_RETRY) {
        this.interval = Math.min(this.interval * 2, 1000)
        await sleep(this.interval * (attempt + 1))
        continue
      }
      throw new TikHubError(res.status, `${res.status} ${path} ${body.slice(0, 200)}`)
    }
  }

  // ---------- TikTok ----------

  /** 视频搜索 → 从 author 提取创作者。按内容匹配，能过滤掉商家号。 */
  private async searchTikTok(kw: string, region: string, offset: number): Promise<SearchPage> {
    const raw = await this.get('/api/v1/tiktok/app/v3/fetch_video_search_result', {
      keyword: kw, offset, count: 20, region,
    })
    const list = pickList(raw, 'tiktok/video_search')

    const byHandle = new Map<string, Partial<Creator>>()
    for (const item of list) {
      const aw = item?.aweme_info ?? item
      const a = aw?.author
      const handle = a?.unique_id ?? a?.uniqueId
      if (!handle) continue

      const post: RecentPost = {
        desc: aw?.desc ?? '',
        plays: aw?.statistics?.play_count,
        likes: aw?.statistics?.digg_count,
      }

      const seen = byHandle.get(handle)
      if (seen) { seen.recent_posts!.push(post); continue }

      byHandle.set(handle, {
        platform: 'tiktok',
        handle,
        nickname: a?.nickname ?? '',   // P1 例外：展示用，缺失退化为空名不影响决策
        followers: a?.follower_count,   // P1: 缺失即 undefined，不记 0
        // 实测：搜索结果里 aweme_count 对**所有人**都返回 0 —— 那不是真实值，
        // 是 TikTok 在搜索结果里不填这个字段。当成 0 会让内容积累加分全员失效，
        // 且 0 是个「值」，类型系统防不住。只能显式判掉，等 profile 补全。
        post_count: a?.aweme_count === 0 ? undefined : a?.aweme_count,
        bio: a?.signature,            // P1: 搜索结果常无 bio，须与「bio 为空」区分
        bio_links: [],
        verified: Boolean(a?.custom_verify || a?.enterprise_verify_reason),
        profile_url: `https://www.tiktok.com/@${handle}`,
        recent_posts: [post],
      })
    }
    return {
      creators: [...byHandle.values()],
      raw_count: list.length,
      has_more: Boolean(raw?.data?.has_more),
    }
  }

  /**
   * 补全 TikTok profile。
   * 不能省 —— 搜索结果里的 author 是精简版，signature 常为空，而邮箱就在 bio 里。
   */
  async profileTikTok(handle: string): Promise<Partial<Creator>> {
    const raw = await this.get('/api/v1/tiktok/web/fetch_user_profile', { uniqueId: handle })
    const u = raw?.data?.userInfo?.user ?? raw?.data?.user ?? {}
    const stats = raw?.data?.userInfo?.stats ?? {}
    const link = u?.bioLink?.link
    return {
      nickname: u?.nickname || undefined,
      // profile 已经查回来了，signature 是空只说明对方没写简介 —— 那是「查过，没有」。
      // 记成 undefined 有两笔账：这个人每轮续跑再被查一次，email 还会跟着记成「未查询」。
      bio: u?.signature ?? null,   // P1 例外：三态本身，profile 侧的空简介就是 null
      bio_links: link ? [link] : [],
      followers: stats?.followerCount ?? u?.followerCount ?? undefined,
      following: stats?.followingCount ?? u?.followingCount ?? undefined,
      post_count: stats?.videoCount ?? u?.videoCount ?? undefined,
      verified: Boolean(u?.verified),
      avatar: u?.avatarMedium,
    }
  }

  // ---------- Instagram ----------

  /**
   * IG 主路径：Reels 搜索。
   *
   * 这是 TikTok 视频搜索在 IG 上的对应物 —— 按**内容**匹配而非账号名，
   * 找到的是真在做这类内容的人。
   *
   * 为什么不用 v1 的 hashtag 端点：实测它的 `owner` 只有 `{id}`，
   * 没有 username 也没有粉丝数，每个创作者还要额外一次 id→username 调用，
   * 成本翻倍且拿不到更多信息。已弃用。
   *
   * ⚠️ 限制 —— **第一条是我们自己的做法，后两条是这个端点本身的**
   * （**别把这张单子读成穷尽的**：原先它写着「两条」而漏了第三条，
   * 那正是「响应只有 count 和 items」当年的错法 —— 一张宣称完整的单子）：
   *   1. **只取一页** —— 下面只发 `keyword` 一个参数，`search()` 见到 `offset > 0` 直接
   *      返回空。⚠️ **别读成「它没有分页游标」**：那句话原先写在这里，证据只有
   *      「响应只有 `count` 和 `items`」，那是**响应**那一侧的观测。实际上响应里就有
   *      `data.pagination_token`，而官方 spec 里 `search_reels` 声明的分页参数正是它
   *      （ADR-101）。**2026-09-22 顺着链翻了一次，实测能翻页**：同一个关键词，
   *      翻十次拿到的去重达人是单次的五倍左右，而且还在涨。所以下面这个 `has_more: false`
   *      与 `search()` 里「offset > 0 就返回空」**才是「IG 只有一页」的真正来源**，
   *      不是对面的性质。复跑 `npm run probe:ig-paging -- --chain 10`（自带对照组）
   *   2. **对词组敏感** —— "smoothie recipe" 返回 0，"smoothie" 返回 12。
   *      IG 侧的关键词要比 TikTok 短
   *   3. **它只找得到发 Reels 的人。** 只发图文／轮播的创作者对这个端点根本不存在 ——
   *      跑多少次、翻多少页都不会出现。所以 IG 那一侧的候选池不是「这个品类的创作者」，
   *      是「这个品类里**发短视频**的创作者」，而下游没有一处提过这个限定。
   *      补它要另一条路（话题下的全部媒体），见任务簿里的 hashtag 那条
   */
  private async searchInstagramReels(kw: string): Promise<SearchPage> {
    const raw = await this.get('/api/v1/instagram/v2/search_reels', { keyword: kw })
    const list = pickList(raw, 'instagram/search_reels')

    const byHandle = new Map<string, Partial<Creator>>()
    for (const item of list) {
      const u = item?.user ?? item?.media?.user
      const handle = u?.username
      if (!handle) continue

      const post: RecentPost = {
        desc: item?.caption?.text ?? '',
        plays: item?.play_count ?? item?.ig_play_count,
        // like_count 实测可能是 null（作者隐藏了赞数）—— null 是「不可见」不是 0
        likes: item?.like_count ?? undefined,
      }

      const seen = byHandle.get(handle)
      if (seen) { seen.recent_posts!.push(post); continue }

      byHandle.set(handle, {
        platform: 'instagram',
        handle,
        user_id: u?.id ?? u?.pk,
        nickname: u?.full_name ?? '',   // P1 例外：展示用
        // followers / post_count / bio 搜索结果里都没有 —— 保持 undefined 等 profile 补全
        bio_links: [],
        verified: Boolean(u?.is_verified),
        is_private: Boolean(u?.is_private),
        profile_url: `https://www.instagram.com/${handle}/`,
        recent_posts: [post],
      })
    }
    // 我们只取一页，所以这里写死 false。**这不是观测到的 `has_more`** —— 响应里压根没有
    // 那个字段，而它收不收游标没人试过（ADR-101）。下游把这个 false 读成「翻完了」，
    // 读的是我们自己的决定，不是 TikHub 的性质。
    return { creators: [...byHandle.values()], raw_count: list.length, has_more: false }
  }

  /** IG 关键词搜用户 —— Reels 搜索无结果时的补充路径。商家号偏多。 */
  private async searchInstagramUsers(kw: string): Promise<SearchPage> {
    const raw = await this.get('/api/v1/instagram/v2/search_users', { keyword: kw })
    const list = pickList(raw, 'instagram/search_users')
    const creators = list.flatMap((item: any) => {
      const u = item?.user ?? item
      const handle = u?.username
      if (!handle) return []
      return [{
        platform: 'instagram' as Platform,
        handle,
        user_id: u?.id ?? u?.pk,
        nickname: u?.full_name ?? '',   // P1 例外：展示用
        bio_links: [],
        verified: Boolean(u?.is_verified),
        is_private: Boolean(u?.is_private),
        profile_url: `https://www.instagram.com/${handle}/`,
        // **不写 recent_posts** —— 这条路搜的是账号，响应里根本没有作品，我们没问过。
        // 原先这里写着一个空数组，交付表对这批人显示成空白，
        // 跟「作品文案本来就是空的」混成一个样子（P1.e）。
      }]
    })
    return { creators, raw_count: list.length, has_more: false }
  }

  /** V3 字段最全（biography + bio_links）；拿不到就降级到 V2。 */
  async profileInstagram(handle: string): Promise<Partial<Creator>> {
    let u: any
    try {
      const raw = await this.get('/api/v1/instagram/v1/fetch_user_info_by_username_v3', { username: handle })
      u = raw?.data?.user ?? raw?.data ?? {}
    } catch (e) {
      if (e instanceof TikHubError && e.status === 402) throw e
      const raw = await this.get('/api/v1/instagram/v1/fetch_user_info_by_username_v2', { username: handle })
      u = raw?.data?.user ?? raw?.data ?? {}
    }
    const links: string[] = []
    for (const l of u?.bio_links ?? []) {   // P1 例外：缺失→无外链→不合并，符合 D3「不确定不合并」的安全方向
      const url = typeof l === 'string' ? l : (l?.url ?? l?.link)
      if (url) links.push(url)
    }
    if (u?.external_url) links.push(u.external_url)

    return {
      user_id: u?.pk ?? u?.id ?? undefined,
      nickname: u?.full_name || undefined,
      bio: u?.biography ?? null,   // P1 例外：同上，profile 查回来了，biography 空就是「查过，没写」
      bio_links: links,
      followers: u?.follower_count ?? undefined,
      following: u?.following_count ?? undefined,
      // 实测 media_count 常为 null（IG 不返回）—— null 是「没给」，当 0 会让内容积累加分失效
      post_count: u?.media_count ?? undefined,
      is_private: Boolean(u?.is_private),
      verified: Boolean(u?.is_verified),
      avatar: u?.profile_pic_url,
    }
  }

  // ---------- 统一入口 ----------

  async search(task: SearchTask, region: string, offset: number): Promise<SearchPage> {
    if (task.platform === 'tiktok') return this.searchTikTok(task.keyword, region, offset)
    // 我们只向 IG 取一页：offset > 0 直接返回空，不白花请求。
    // **第 2 页是空的这个现象是这一行造的**，不是问出来的（ADR-101）。
    if (offset > 0) return { creators: [], raw_count: 0, has_more: false }
    const reels = await this.searchInstagramReels(task.keyword)
    if (reels.creators.length) return reels
    // 兜底：reels 一个人都没解析出来时改搜账号名。**两次的条数要相加** ——
    // 只交回后一次的话，第一次已经付过钱、供应商也确实返回了条目，而报告上那一行
    // 写着「找到 0」，读作「这个词一条内容都没有」（D6.k，ADR-94 第十五节甲，实测）。
    // ⚠️ **预算卡在两次之间时照常抛**，不要吞成正常返回。
    // 头一版为了「别丢掉已付的那一页」把它 catch 掉、交回 reels —— 后果严重得多：
    // IG 的 reels 页恒 `has_more: false`，于是入口把这个任务推进 `done` **永久烧掉**，
    // 退出码 0、还告诉用户「续跑不产生新的请求」，而预算其实已经见底 ——
    // 追加预算续跑时它再也不会被碰（D6 × P3 的裁定，ADR-94 第十五节乙，实测）。
    // 而且走到这一支就说明 reels **一个人都没解析出来**，交回它并不保住任何人；
    // 丢的只是条数，那个数由 `TaskState.answered`／`found` 如实报成「未知」。
    return this.searchInstagramUsers(task.keyword)
      .then(users => ({ ...users, raw_count: reels.raw_count + users.raw_count }))
  }

  async profile(handle: string, platform: Platform): Promise<Partial<Creator>> {
    return platform === 'tiktok' ? this.profileTikTok(handle) : this.profileInstagram(handle)
  }

  /**
   * D8：主页近期作品样本。不能复用 search() 命中的帖子 —— 搜索结果被关键词筛过，
   * 用它算互动率会系统性高估相关内容的表现。
   */
  private async recentTikTokPosts(handle: string): Promise<PublicPostSample> {
    const endpoint = TIKTOK_POSTS_ENDPOINT
    const raw = await this.get(endpoint, { unique_id: handle, count: 12 })
    const list = pickList(raw, 'tiktok/user_posts')
    const posts = list.map((item: any): NormalizedPublicPost => {
      const stats = item?.statistics
      return {
        id: String(item?.aweme_id ?? item?.id ?? ''),   // P1 例外：标识仅用于样本追溯，不参与决策
        views: finiteNumber(stats?.play_count),
        likes: finiteNumber(stats?.digg_count),
        comments: finiteNumber(stats?.comment_count),
        shares: finiteNumber(stats?.share_count),
        published_at: isoFromUnix(item?.create_time),
        is_pinned: item?.is_top === undefined ? undefined : Boolean(item.is_top),
      }
    })
    const author = list.find((item: any) => item?.author)?.author
    return {
      posts,
      followers: finiteNumber(author?.follower_count),
      following: finiteNumber(author?.following_count),
      source: { kind: 'public_api', provider: 'tikhub', endpoint },
    }
  }

  /**
   * D8：2026-08-26 实测 V3 对公开账号返回 400，V2 返回 12 条完整 Reels 数据，
   * 因而以 V2 为已验证路径。只保留明确的视频/Reels，不拿图片帖与视频混算。
   */
  private async recentInstagramPosts(handle: string): Promise<PublicPostSample> {
    const endpoint = INSTAGRAM_POSTS_ENDPOINT
    const raw = await this.get(endpoint, { username: handle })
    const list = pickList(raw, 'instagram/user_posts')
    const videos = list.filter((item: any) =>
      item?.is_video === true || item?.media_type === 2 || item?.media_format === 'video' ||
      item?.media_name === 'reel' || item?.product_type === 'clips')
    const posts = videos.slice(0, 12).map((item: any): NormalizedPublicPost => ({
      id: String(item?.id ?? item?.pk ?? item?.code ?? ''),   // P1 例外：标识仅用于样本追溯，不参与决策
      views: finiteNumber(item?.play_count) ?? finiteNumber(item?.ig_play_count), // P1 例外：同一指标的两个真实字段别名，不是缺失数据兜底
      likes: finiteNumber(item?.like_count),
      comments: finiteNumber(item?.comment_count),
      shares: finiteNumber(item?.reshare_count),
      published_at: isoFromUnix(item?.taken_at) ?? isoFromUnix(item?.taken_at_ts), // P1 例外：同一时间字段的响应别名
      is_pinned: item?.is_pinned === undefined ? undefined : Boolean(item.is_pinned),
    }))
    const data = raw?.data?.data ?? raw?.data
    const user = data?.user ?? videos.find((item: any) => item?.user)?.user
    return {
      posts,
      followers: finiteNumber(user?.follower_count),
      following: finiteNumber(user?.following_count),
      source: { kind: 'public_api', provider: 'tikhub', endpoint },
    }
  }

  async recentPosts(handle: string, platform: Platform): Promise<PublicPostSample> {
    return platform === 'tiktok'
      ? this.recentTikTokPosts(handle)
      : this.recentInstagramPosts(handle)
  }
}

/**
 * profile 补全后提取邮箱。
 *
 * P1：bio 没取到时 email 保持 undefined（**未查询**），不是 null（**查了，没有**）。
 * 两者混为一谈会让「我们没看过他的 bio」被下游读成「他没留邮箱」。
 */
export function fillEmail(c: Creator): void {
  c.email = c.bio === undefined ? undefined
    // 查过、对方没写简介 —— 那就是「查过，没有邮箱」，不是「没查过」
    : c.bio === null ? null
      : (extractEmail(c.bio) ?? null)   // P1 例外：三态本身——bio 已取到而提取不出，才是「查过，没有」，这正是 null 的正确用法
}
