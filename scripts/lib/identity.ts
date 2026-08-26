import type { Creator, Platform } from './types.js'

const IG_RE = /instagram\.com\/([A-Za-z0-9._]+)/i
const TT_RE = /tiktok\.com\/@([A-Za-z0-9._]+)/i

function norm(h: string): string {
  return h.toLowerCase().replace(/[._-]/g, '')
}

/** 从 bio_links 里找出指向另一平台的 handle */
function linkedHandle(c: Creator, target: Platform): string | null {
  const re = target === 'instagram' ? IG_RE : TT_RE
  for (const link of c.bio_links) {
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
 * P1：邮箱的三态合并。
 *
 * 有值取值；**两边都「查过且没有」才是 null**；只要有一侧从未查询过就是 undefined。
 * 写成 `a ?? b ?? null` 会把「两边都没查」说成「查过，他没留邮箱」——
 * 运营看到的是空白而不是「未查询」，于是不会再回头补查这个人。
 * 两侧 profile 补全都失败是预期内的（collect 有 profileFailed 计数器），不是边角情况。
 */
function mergeEmail(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null | undefined {
  if (a) return a
  if (b) return b
  if (a === undefined || b === undefined) return undefined
  return null
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

    // 有邮箱的优先做主记录；都有或都没有则取粉丝多的（未知视为最小）
    const rank = (x: Creator) => (x.email ? 1e9 : 0) + (x.followers ?? -1)   // p1-ok: 仅用于排序取主，不写回数据
    const [primary, secondary] = rank(c) >= rank(other) ? [c, other] : [other, c]

    // P1：任一侧未知，合并结果就是未知 —— 不能把未知当 0 加进去
    const sum = (a?: number, b?: number) =>
      a === undefined || b === undefined ? undefined : a + b
    primary.followers = sum(c.followers, other.followers)
    primary.post_count = sum(c.post_count, other.post_count)
    primary.email = mergeEmail(primary.email, secondary.email)
    primary.bio_links = [...new Set([...c.bio_links, ...other.bio_links])]
    primary.recent_posts = [...(primary.recent_posts ?? []), ...(secondary.recent_posts ?? [])]
    primary.linked_handle = `${secondary.platform}:${secondary.handle}`
    secondary.merged_into = `${primary.platform}:${primary.handle}`
  }
  return creators.filter(c => !c.merged_into)
}
