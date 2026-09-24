import type {
  Creator, Platform, SearchTask, RecentPost, SearchPage, MetricSource, NormalizedPublicPost,
} from '../lib/types.js'
import { Budget, BudgetInputError } from '../lib/budget.js'
import { CostError } from '../lib/cost-ledger.js'
import { extractEmail } from '../lib/email.js'
import { searchPostId } from '../lib/posts.js'
import { hashtagKeyword } from '../lib/ig-route.js'

const BASE = 'https://api.tikhub.io'
const TIKTOK_SEARCH_ENDPOINT = '/api/v1/tiktok/app/v3/fetch_video_search_result'
const INSTAGRAM_REELS_ENDPOINT = '/api/v1/instagram/v2/search_reels'
const INSTAGRAM_USERS_ENDPOINT = '/api/v1/instagram/v2/search_users'
/** 限速 10 RPS —— 留余量 */
const INTERVAL_MS = 150
export const TIKTOK_POSTS_ENDPOINT = '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3'
export const INSTAGRAM_POSTS_ENDPOINT = '/api/v1/instagram/v2/fetch_user_posts'
/** IG 话题页。只有任务显式写 `ig_route: "hashtag"` 时才请求它，缺省走 Reels（D15.k，ADR-112）。 */
export const INSTAGRAM_HASHTAG_ENDPOINT = '/api/v1/instagram/v2/fetch_hashtag_posts'

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

/**
 * 这一条 IG 条目算不算视频/Reels（D8.a「短视频/Reels」、ADR-112 第二节）。
 *
 * **主页作品样本与话题页的播放数共用这一份判定**，不另写第二份。认的信号是响应里的五个键，
 * 任一成立就算：`is_video` 为 `true`、`media_type` 为 `2`、`media_format` 为 `'video'`、
 * `media_name` 为 `'reel'`、`product_type` 为 `'clips'`。都不成立 —— 包括这些键缺席、
 * 条目不是对象 —— 就不算。话题页里混着的图文（`media_type` 1、`product_type` `'feed'`）
 * 与轮播（`media_type` 8、`product_type` `'carousel_container'`）不算。
 */
export function isInstagramVideo(item: unknown): boolean {
  const i = item as any
  return i?.is_video === true || i?.media_type === 2 || i?.media_format === 'video' ||
    i?.media_name === 'reel' || i?.product_type === 'clips'
}

/**
 * IG 话题页（`fetch_hashtag_posts`）的一份响应 → 一页搜索结果（ADR-112 第二、五节）。
 * **只解析**：不发请求；请求与分派在 `TikHub.search()` 最前面（D15.k）。
 *
 * - 列表按 `pickList` 探测（话题页在 `data.data.items`）；认不出列表时照 `pickList` 抛出。
 * - `raw_count` 是列表条目数（供应商返回的条目，不是人数）。`has_more` 为 `false`，
 *   **不交回续页令牌**：话题页翻不翻另议（ADR-112 第二节），响应里有令牌也不带出来。
 * - 作者取 `user.username`；没有作者名的条目不产出账号（仍计入 `raw_count`）。
 *   同一作者的多个条目合成一个账号，作品按条目出现的顺序排。
 * - 每个账号：`platform` 为 `'instagram'`、`handle`、`profile_url` 为
 *   `https://www.instagram.com/<handle>/`，其余账号字段与 Reels 路线同样取法；
 *   `discovery_sources` 恰好一条：平台、账号、**任务关键词原样**（开头有 `#` 也保留，只有请求参数去掉它）、
 *   任务维度、端点 `INSTAGRAM_HASHTAG_ENDPOINT`。
 * - 每条作品：`id` 按 D11.i（`instagram:` 前缀加原始 `id`；不可用时缺席），文案取 `caption_text`
 *   （话题页的文案字段；Reels 与 general 是 `caption.text`，这里不认），缺席时为空串；
 *   `likes` 取 `like_count`，`null` 或缺席时缺席（赞数被隐藏不是 0）。
 * - **播放数只给 `isInstagramVideo` 判为视频的条目**（取 `play_count`，缺席时 `ig_play_count`）；
 *   图文、轮播等其余条目不写播放数 —— 该媒体类型的播放字段语义没确认过，不能当成真实的 0（P1）。
 */
export function parseInstagramHashtagPage(raw: unknown, task: SearchTask): SearchPage {
  const list = pickList(raw, 'instagram/fetch_hashtag_posts')
  const byHandle = new Map<string, Partial<Creator>>()
  for (const item of list) {
    const u = item?.user
    const handle = u?.username
    if (!handle) continue

    const post: RecentPost = {
      id: searchPostId('instagram', item?.id),
      desc: item?.caption_text ?? '',
      // 只有视频条目才写播放数：图文、轮播的播放字段语义没确认过，写进去就是把「不知道」当成数（P1）
      ...(isInstagramVideo(item) ? { plays: item?.play_count ?? item?.ig_play_count } : {}),
      likes: item?.like_count ?? undefined,
    }

    const seen = byHandle.get(handle)
    if (seen) { seen.recent_posts!.push(post); continue }

    byHandle.set(handle, {
      platform: 'instagram',
      handle,
      user_id: u?.id ?? u?.pk,
      nickname: u?.full_name ?? '',   // P1 例外：展示用
      bio_links: [],
      verified: Boolean(u?.is_verified),
      is_private: Boolean(u?.is_private),
      profile_url: `https://www.instagram.com/${handle}/`,
      discovery_sources: [{ platform: 'instagram', handle, keyword: task.keyword,
        dimension: task.dimension, endpoint: INSTAGRAM_HASHTAG_ENDPOINT }],
      recent_posts: [post],
    })
  }
  // 话题页翻不翻另议（ADR-112 第二节）：响应里有令牌也不交回，has_more 写死 false
  return { creators: [...byHandle.values()], raw_count: list.length, has_more: false }
}

export class TikHub {
  constructor(private key: string | undefined, private budget: Budget) {}

  /** 429 的退避重试次数。超过就放弃，不无限重试。 */
  private static readonly MAX_RETRY = 3
  private interval = INTERVAL_MS

  private async get(path: string, params: Record<string, string | number>): Promise<any> {
    const url = new URL(path, BASE)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
    if (!this.key) throw new BudgetInputError('缺少 TIKHUB_API_KEY，未发送请求。')

    for (let attempt = 0; ; attempt++) {
      await sleep(this.interval)
      const receipt = this.budget.reserve(path) // P3.c：每次 retry 按实际端点预检
      let res: Response
      try {
        res = await fetch(url, { headers: { Authorization: `Bearer ${this.key}` } })
      } catch (error) {
        // D13.o：这里只包 fetch；本地等待与正文错误不能冒充无 HTTP 状态。
        this.budget.settle(receipt, { kind: 'no_http_status' })
        throw error
      }
      this.budget.settle(receipt, { kind: 'http', status: res.status })
      if (res.status === 200) return res.json() // D13.m：正文失败不改变终态

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

  /** 视频搜索 → 从 author 提取创作者与作品线索；商家号仍须后续判断。 */
  private async searchTikTok(task: SearchTask, region: string, offset: number): Promise<SearchPage> {
    const raw = await this.get(TIKTOK_SEARCH_ENDPOINT, {
      keyword: task.keyword, offset, count: 20, region,
    })
    const list = pickList(raw, 'tiktok/video_search')

    const byHandle = new Map<string, Partial<Creator>>()
    for (const item of list) {
      const aw = item?.aweme_info ?? item
      const a = aw?.author
      const handle = a?.unique_id ?? a?.uniqueId
      if (!handle) continue

      const post: RecentPost = {
        id: searchPostId('tiktok', aw?.aweme_id),
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
        discovery_sources: [{ platform: 'tiktok', handle, keyword: task.keyword,
          dimension: task.dimension, endpoint: TIKTOK_SEARCH_ENDPOINT }],
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
   * 当前用它取得作品与作者线索；实际匹配、排序及创作者覆盖未核实。
   * V1 hashtag 的历史样本 owner 只有 id，当前未采用；不外推到 V2 hashtag/general。
   *
   * 首页只发 keyword；给了 IG 续页令牌就多带一个 pagination_token（固定官方规范声明的参数），
   * 并把响应里与 data.data 同级的 data.pagination_token 交回为下一个令牌（ADR-111）。
   * 采集入口只在同一次运行内传令牌；没有令牌时 search() 见 offset > 0 仍直接返回空，has_more 写死 false。
   * 这不是端点只有一页的证据：2026-09-22 的 smoothie 历史记录中链式请求比等次数重发
   * 取得更多去重作者（ADR-101 第十三节）。
   *
   * 早期短词样本优于词组，不证明所有词组都无结果或页大小固定；按当次试探调整。
   * 不能由 Reels 名称推断纯图文/轮播作者必然被排除。PhotoMode 是否返回、play_count
   * 的媒体适用范围、V2 hashtag/general 的覆盖与排序均待样本验证。
   */
  private async searchInstagramReels(task: SearchTask, token?: string): Promise<SearchPage> {
    const params: Record<string, string> = { keyword: task.keyword }
    if (token !== undefined) params.pagination_token = token
    const raw = await this.get(INSTAGRAM_REELS_ENDPOINT, params)
    const list = pickList(raw, 'instagram/search_reels')

    const byHandle = new Map<string, Partial<Creator>>()
    for (const item of list) {
      const u = item?.user ?? item?.media?.user
      const handle = u?.username
      if (!handle) continue

      const post: RecentPost = {
        id: searchPostId('instagram', item?.id),
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
        // 早期 Reels 样本未取得这些字段；此路径暂不解析，保持 undefined 等 profile 补全
        bio_links: [],
        verified: Boolean(u?.is_verified),
        is_private: Boolean(u?.is_private),
        profile_url: `https://www.instagram.com/${handle}/`,
        discovery_sources: [{ platform: 'instagram', handle, keyword: task.keyword,
          dimension: task.dimension, endpoint: INSTAGRAM_REELS_ENDPOINT }],
        recent_posts: [post],
      })
    }
    // has_more 写死 false：翻不翻由入口看令牌决定，这是本地停止决定，不是对服务端结果已穷尽的观测。
    // 令牌只认字符串；缺席或别的类型就不交回，不编一个出来。空白能不能再翻不在这里判（ADR-111）。
    const next = raw?.data?.pagination_token
    return { creators: [...byHandle.values()], raw_count: list.length, has_more: false,
      ...(typeof next === 'string' ? { next_token: next } : {}) }
  }

  /** IG 关键词搜用户 —— Reels 搜索无结果时的补充路径。商家号偏多。 */
  private async searchInstagramUsers(task: SearchTask): Promise<SearchPage> {
    const raw = await this.get(INSTAGRAM_USERS_ENDPOINT, { keyword: task.keyword })
    const list = pickList(raw, 'instagram/search_users')
    const creators = list.flatMap((item: any): Partial<Creator>[] => {
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
        discovery_sources: [{ platform: 'instagram' as Platform, handle, keyword: task.keyword,
          dimension: task.dimension, endpoint: INSTAGRAM_USERS_ENDPOINT }],
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
      if (e instanceof CostError || e instanceof BudgetInputError) throw e
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

  /**
   * `token`：上一页交回的 IG 续页令牌（ADR-111）；TikTok 不用它，入口只在同一次运行内传。
   *
   * **话题路线在最前面分派**（D15.k、D6.w，ADR-112 第二节）：`task.ig_route === 'hashtag'` 的 Instagram 任务
   * 请求 `INSTAGRAM_HASHTAG_ENDPOINT`，参数 `keyword` 为 `hashtagKeyword(task)`、`feed_type` 为 `top`，
   * 用 `parseInstagramHashtagPage` 解析。只请求首页：`offset > 0` 或带着令牌时直接交回空页、不发请求；
   * 解析不出人也不改搜账号名。probe 与 collect 都经这里，所以试探与采集走同一条路线。
   */
  async search(task: SearchTask, region: string, offset: number, token?: string): Promise<SearchPage> {
    if (task.platform === 'instagram' && task.ig_route === 'hashtag') {
      // 只请求首页：话题页不交回续页令牌，翻不翻另议（ADR-112 第二节）；也不走账号名兜底（D6.w）
      if (offset > 0 || token !== undefined) return { creators: [], raw_count: 0, has_more: false }
      const raw = await this.get(INSTAGRAM_HASHTAG_ENDPOINT, { keyword: hashtagKeyword(task), feed_type: 'top' })
      return parseInstagramHashtagPage(raw, task)
    }
    if (task.platform === 'tiktok') return this.searchTikTok(task, region, offset)
    // 续页：带上上一页交回的令牌再问一次 Reels，不看 offset。**不走兜底** —— 兜底只属于第一页，
    // 续页解析不出人就如实交回这一页（ADR-111 第二节）。
    // 空白令牌当场报错、一个请求都不发：请求参数里的空串会被 get() 丢掉，发出去就只带 keyword ——
    // 把首页当续页再买一遍。报错而不是交回空页，免得入口把调用方的错读成「本页 0 条」。
    // 能不能拿令牌再翻由 pipeline 那份判定决定，它只交出非空白的令牌；这里只守「不为错参数付钱」。
    if (token !== undefined && token.trim() === '') {
      throw new Error('IG 续页令牌是空白，未发送请求 —— 空白令牌会被当成首页再请求一次')
    }
    if (token !== undefined) return this.searchInstagramReels(task, token)
    // 没有令牌时只向 IG 取一页：offset > 0 直接返回空，不白花请求。
    // **第 2 页是空的这个现象是这一行造的**，不是问出来的（ADR-101）。
    if (offset > 0) return { creators: [], raw_count: 0, has_more: false }
    const reels = await this.searchInstagramReels(task)
    if (reels.creators.length) return reels
    // 兜底：reels 一个人都没解析出来时改搜账号名。**两次的条数要相加** ——
    // 只交回后一次的话，第一次已经付过钱、供应商也确实返回了条目，而报告上那一行
    // 写着「找到 0」，读作「这个词一条内容都没有」（D6.k，ADR-94 第十五节甲，实测）。
    // ⚠️ **预算卡在两次之间时照常抛**，不要吞成正常返回。
    // 头一版为了「别丢掉已付的那一页」把它 catch 掉、交回 reels —— 后果严重得多：
    // 交回的是一个解析不出人的 reels 页，入口按 D6.u（解析不出作者就停）当页把这个任务推进 `done` **永久烧掉**，
    // 退出码 0、还告诉用户「续跑不产生新的请求」，而预算其实已经见底 ——
    // 追加预算续跑时它再也不会被碰（D6 × P3 的裁定，ADR-94 第十五节乙，实测）。
    // 而且走到这一支就说明 reels **一个人都没解析出来**，交回它并不保住任何人；
    // 丢的只是条数，那个数由 `TaskState.answered`／`found` 如实报成「未知」。
    // 这一页**不带令牌**：账号名那次的响应不读令牌，Reels 那次的也不交回 —— 走了兜底的任务当页结束（ADR-111 第二节）。
    return this.searchInstagramUsers(task)
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
    const videos = list.filter(isInstagramVideo)
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
