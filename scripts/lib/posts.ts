import type { Platform, RecentPost } from './types.js'

/** D11.a/d：只保存真实可用的作品标识；平台前缀防止跨平台同号相撞。 */
export function searchPostId(platform: Platform, raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.trim().length > 0) return `${platform}:${raw}`
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) return `${platform}:${raw}`
  return undefined
}

/** D11.b/c/e/f：先到记录优先，无可靠标识的证据逐条保留；不修改输入。 */
export function mergeRecentPosts(left?: readonly RecentPost[], right?: readonly RecentPost[]): RecentPost[] | undefined {
  const merged: RecentPost[] = []
  const seen = new Set<string>()
  for (const post of [...(left ?? []), ...(right ?? [])]) {
    const id = post.id
    if (typeof id === 'string' && id.trim().length > 0) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    merged.push(post)
  }
  return merged.length ? merged : undefined
}
