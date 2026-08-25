import type { Creator, Platform, SearchTask, RecentPost } from '../lib/types.js'
import { Budget } from '../lib/budget.js'
import { extractEmail } from '../lib/email.js'

const BASE = 'https://api.tikhub.io'
/** 限速 10 RPS —— 留余量 */
const INTERVAL_MS = 150

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export class TikHubError extends Error {
  constructor(public status: number, msg: string) {
    super(msg)
    this.name = 'TikHubError'
  }
}

export class TikHub {
  constructor(private key: string, private budget: Budget) {}

  private async get(path: string, params: Record<string, string | number>): Promise<any> {
    const url = new URL(path, BASE)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }

    this.budget.charge()          // 预检 —— 超限在这里抛 BudgetExceeded
    await sleep(INTERVAL_MS)

    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.key}` } })

    if (!res.ok) {
      this.budget.refund()        // 非 200 不计费
      const body = await res.text().catch(() => '')
      if (res.status === 402) {
        throw new TikHubError(402, 'TikHub 余额不足，请充值后重试')
      }
      throw new TikHubError(res.status, `${res.status} ${path} ${body.slice(0, 200)}`)
    }
    return res.json()
  }

  // ---------- 响应结构探测 ----------

  /**
   * TikHub 透传平台原始响应，schema 随端点和版本变化。
   * 按 cascade 找出记录数组，找不到就抛出并附上顶层 key —— 不硬猜。
   */
  private pickList(data: any, path: string): any[] {
    const d = data?.data ?? data
    const cands = [
      d?.user_list, d?.users, d?.aweme_list, d?.data,
      d?.hashtag?.edge_hashtag_to_media?.edges,   // IG hashtag，GraphQL 风格
      d?.items, d?.result,
    ]
    for (const c of cands) if (Array.isArray(c)) return c
    const keys = Object.keys(d ?? {}).join(', ')
    throw new TikHubError(0, `无法识别 ${path} 的响应结构。data 顶层 key: [${keys}]`)
  }

  // ---------- TikTok ----------

  /** 视频搜索 → 从 author 提取创作者。按内容匹配，能过滤掉商家号。 */
  private async searchTikTok(kw: string, region: string, page: number): Promise<Partial<Creator>[]> {
    const raw = await this.get('/api/v1/tiktok/app/v3/fetch_video_search_result', {
      keyword: kw, offset: page * 20, count: 20, region,
    })
    const list = this.pickList(raw, 'tiktok/video_search')

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
        nickname: a?.nickname ?? '',
        followers: a?.follower_count ?? 0,
        post_count: a?.aweme_count ?? 0,
        bio: a?.signature ?? '',
        bio_links: [],
        verified: Boolean(a?.custom_verify || a?.enterprise_verify_reason),
        profile_url: `https://www.tiktok.com/@${handle}`,
        recent_posts: [post],
      })
    }
    return [...byHandle.values()]
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
      bio: u?.signature ?? '',
      bio_links: link ? [link] : [],
      followers: stats?.followerCount ?? u?.followerCount ?? undefined,
      post_count: stats?.videoCount ?? u?.videoCount ?? undefined,
      verified: Boolean(u?.verified),
      avatar: u?.avatarMedium,
    }
  }

  // ---------- Instagram ----------

  /** IG 主路径是 hashtag —— 关键词搜索更偏账号名匹配，商家号多。 */
  private async searchInstagramHashtag(tag: string, cursor?: string): Promise<Partial<Creator>[]> {
    const raw = await this.get('/api/v1/instagram/v1/fetch_hashtag_posts', {
      hashtag: tag.replace(/^#/, ''), ...(cursor ? { end_cursor: cursor } : {}),
    })
    const list = this.pickList(raw, 'instagram/hashtag_posts')

    const byHandle = new Map<string, Partial<Creator>>()
    for (const edge of list) {
      const n = edge?.node ?? edge
      const owner = n?.owner ?? n?.user
      const handle = owner?.username
      if (!handle) continue

      const post: RecentPost = {
        desc: n?.edge_media_to_caption?.edges?.[0]?.node?.text ?? n?.caption?.text ?? n?.caption ?? '',
        plays: n?.video_view_count ?? n?.play_count,
        likes: n?.edge_liked_by?.count ?? n?.like_count,
      }

      const seen = byHandle.get(handle)
      if (seen) { seen.recent_posts!.push(post); continue }

      byHandle.set(handle, {
        platform: 'instagram',
        handle,
        user_id: owner?.id ?? owner?.pk,
        nickname: owner?.full_name ?? '',
        followers: owner?.edge_followed_by?.count ?? owner?.follower_count ?? 0,
        post_count: 0,
        bio: '',
        bio_links: [],
        verified: Boolean(owner?.is_verified),
        profile_url: `https://www.instagram.com/${handle}/`,
        recent_posts: [post],
      })
    }
    return [...byHandle.values()]
  }

  /** IG 关键词搜用户 —— hashtag 无结果时的补充路径 */
  private async searchInstagramUsers(kw: string): Promise<Partial<Creator>[]> {
    const raw = await this.get('/api/v1/instagram/v1/fetch_search', { query: kw, select: 'users' })
    const list = Array.isArray(raw?.data?.users) ? raw.data.users : this.pickList(raw, 'instagram/search')
    return list.map((item: any) => {
      const u = item?.user ?? item
      const handle = u?.username
      if (!handle) return null
      return {
        platform: 'instagram' as Platform,
        handle,
        user_id: u?.pk ?? u?.id,
        nickname: u?.full_name ?? '',
        followers: u?.follower_count ?? 0,
        post_count: 0,
        bio: '',
        bio_links: [],
        verified: Boolean(u?.is_verified),
        profile_url: `https://www.instagram.com/${handle}/`,
        recent_posts: [],
      }
    }).filter(Boolean) as Partial<Creator>[]
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
    for (const l of u?.bio_links ?? []) {
      const url = typeof l === 'string' ? l : (l?.url ?? l?.link)
      if (url) links.push(url)
    }
    if (u?.external_url) links.push(u.external_url)

    return {
      user_id: u?.pk ?? u?.id ?? undefined,
      nickname: u?.full_name || undefined,
      bio: u?.biography ?? '',
      bio_links: links,
      followers: u?.follower_count ?? undefined,
      post_count: u?.media_count ?? undefined,
      verified: Boolean(u?.is_verified),
      avatar: u?.profile_pic_url,
    }
  }

  // ---------- 统一入口 ----------

  async search(task: SearchTask, region: string, page: number): Promise<Partial<Creator>[]> {
    if (task.platform === 'tiktok') return this.searchTikTok(task.keyword, region, page)
    if (task.as_hashtag) return this.searchInstagramHashtag(task.keyword)
    return this.searchInstagramUsers(task.keyword)
  }

  async profile(handle: string, platform: Platform): Promise<Partial<Creator>> {
    return platform === 'tiktok' ? this.profileTikTok(handle) : this.profileInstagram(handle)
  }
}

/** profile 补全后重新提取邮箱 */
export function fillEmail(c: Creator): void {
  c.email = extractEmail(c.bio) ?? null
}
