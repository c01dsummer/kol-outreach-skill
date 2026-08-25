import type { Creator, Platform } from './types.js'

const IG_RE = /instagram\.com\/([A-Za-z0-9._]+)/i
const TT_RE = /tiktok\.com\/@([A-Za-z0-9._]+)/i

function norm(h: string): string {
  return h.toLowerCase().replace(/[._-]/g, '')
}

/** 从 bio_links 里找出指向另一平台的 handle */
function linkedHandle(c: Creator, target: Platform): string | null {
  const re = target === 'instagram' ? IG_RE : TT_RE
  for (const link of c.bio_links ?? []) {
    const m = link.match(re)
    if (m) return m[1].toLowerCase()
  }
  return null
}

/**
 * 跨平台同人识别。
 *
 * 信号强度：bio 外链互指 > handle 完全相同 > 去标点后相同。
 * 昵称/头像相近单独不足以判定，不在此实现 —— 宁可漏合并，不可错合并。
 */
export function linkCrossPlatform(creators: Creator[]): number {
  const tt = new Map<string, Creator>()
  const ig = new Map<string, Creator>()
  for (const c of creators) {
    ;(c.platform === 'tiktok' ? tt : ig).set(c.handle.toLowerCase(), c)
  }

  let linked = 0
  const pair = (a: Creator, b: Creator) => {
    if (a.cross_platform || b.cross_platform) return
    a.cross_platform = b.cross_platform = true
    a.linked_handle = `${b.platform}:${b.handle}`
    b.linked_handle = `${a.platform}:${a.handle}`
    linked++
  }

  // 信号 1：外链互指（最可靠）
  for (const c of tt.values()) {
    const h = linkedHandle(c, 'instagram')
    if (h && ig.has(h)) pair(c, ig.get(h)!)
  }
  for (const c of ig.values()) {
    const h = linkedHandle(c, 'tiktok')
    if (h && tt.has(h)) pair(c, tt.get(h)!)
  }

  // 信号 2：handle 完全相同
  for (const [h, c] of tt) if (ig.has(h)) pair(c, ig.get(h)!)

  // 信号 3：去标点后相同（较弱，但配合双方都做同品类内容仍可接受）
  const igByNorm = new Map<string, Creator>()
  for (const [h, c] of ig) igByNorm.set(norm(h), c)
  for (const [h, c] of tt) {
    const m = igByNorm.get(norm(h))
    if (m) pair(c, m)
  }

  return linked
}

/**
 * 把已识别的同人对合并成一条。
 *
 * 保留信息量更大的一条（有邮箱优先，其次粉丝多的），粉丝数取两平台之和，
 * 另一条标记 merged_into 后排除出名单 —— 同一个人不该占两个名额。
 */
export function mergeCrossPlatform(creators: Creator[]): Creator[] {
  const byKey = new Map<string, Creator>()
  for (const c of creators) byKey.set(`${c.platform}:${c.handle}`, c)

  for (const c of creators) {
    if (!c.linked_handle || c.merged_into) continue
    const other = byKey.get(c.linked_handle)
    if (!other || other.merged_into) continue

    // 有邮箱的优先做主记录；都有或都没有则取粉丝多的
    const cScore = (c.email ? 1e9 : 0) + c.followers
    const oScore = (other.email ? 1e9 : 0) + other.followers
    const [primary, secondary] = cScore >= oScore ? [c, other] : [other, c]

    primary.followers = c.followers + other.followers
    primary.post_count = c.post_count + other.post_count
    primary.email = primary.email ?? secondary.email ?? null
    primary.bio_links = [...new Set([...(c.bio_links ?? []), ...(other.bio_links ?? [])])]
    primary.recent_posts = [...(primary.recent_posts ?? []), ...(secondary.recent_posts ?? [])]
    primary.linked_handle = `${secondary.platform}:${secondary.handle}`
    secondary.merged_into = `${primary.platform}:${primary.handle}`
  }
  return creators.filter(c => !c.merged_into)
}
