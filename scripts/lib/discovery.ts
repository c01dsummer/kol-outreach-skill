import { creatorKey, type DiscoveryEndpoint, type DiscoverySource } from './types.js'

/** D15：按输入顺序保留五元组首次记录；未知历史不抹掉已观察来源。 */
export function mergeDiscoverySources(first?: readonly DiscoverySource[],
  next?: readonly DiscoverySource[]): DiscoverySource[] | undefined {
  if (first === undefined && next === undefined) return undefined
  const seen = new Set<string>()
  const out: DiscoverySource[] = []
  for (const source of [...(first ?? []), ...(next ?? [])]) {
    const key = JSON.stringify([creatorKey(source), source.keyword, source.dimension, source.endpoint])
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...source })
  }
  return out
}

const ROUTES: Record<DiscoveryEndpoint, string> = {
  '/api/v1/tiktok/app/v3/fetch_video_search_result': 'TikTok 视频搜索',
  '/api/v1/instagram/v2/search_reels': 'Instagram Reels 搜索',
  '/api/v1/instagram/v2/search_users': 'Instagram 账号名搜索',
  '/api/v1/instagram/v2/fetch_hashtag_posts': 'Instagram 话题搜索',
}

/** 展示只陈述已有观察；HTML 调用方负责转义，不修改原数据。 */
export function formatDiscoverySources(sources?: readonly DiscoverySource[]): string {
  if (!sources?.length) return '来源未知'
  return sources.map(s => `${ROUTES[s.endpoint]} · ${s.platform}:@${s.handle} · ${s.keyword} · ${s.dimension}`).join('；')
}
