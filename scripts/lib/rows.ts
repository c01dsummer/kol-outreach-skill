import type { Creator } from './types.js'

/** U1：列定义固定，顺序即 CSV 表头 */
export const HEADERS = [
  'tier', 'score', 'fit', 'fit_reason', 'platform', 'handle', 'nickname',
  'followers', 'post_count', 'bio', 'email', 'email_verified', 'audience_geo_top',
  'cross_platform', 'linked_handle', 'profile_url', 'source_keyword',
  'source_dimension', 'best_post_desc', 'outreach_draft', 'previously_recommended',
] as const

/**
 * P1：CSV 必须区分三档。
 *   undefined → 「未查询」   null/'' → 空白（查过，没有）   有值 → 值
 * 都写成空白就是把「没测量」说成「测量结果是零」。
 */
export const cell = (v: unknown): string =>
  v === undefined ? '未查询' : v === null ? '' : String(v)

const topGeo = (c: Creator): string => {
  if (!c.audience_geo) return ''
  const [k, v] = Object.entries(c.audience_geo).sort((a, b) => b[1] - a[1])[0] ?? []   // p1-ok: 上一行已守 audience_geo 存在，此处仅防空对象
  return k ? `${k} ${Math.round((v as number) * 100)}%` : ''
}

const bestPost = (c: Creator): string =>
  [...(c.recent_posts ?? [])].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))[0]?.desc ?? ''   // p1-ok: 展示用文本，缺失即无内容

/**
 * 构造一行 CSV。
 *
 * P2：`outreach_draft` **原样输出** —— 不得删除、替换或「补全」草稿里的 {…}。
 * 抹掉占位符，运营就看不到还有待填项，会把半成品直接发出去。
 */
export function toRow(c: Creator): unknown[] {
  return [
    c.tier, c.score, c.fit ?? '', c.fit_reason ?? '', c.platform, c.handle, c.nickname,
    cell(c.followers), cell(c.post_count), cell(c.bio), cell(c.email), cell(c.email_verified),
    topGeo(c), c.cross_platform ?? false, c.linked_handle ?? '', c.profile_url, c.source_keyword,
    c.source_dimension, bestPost(c), c.outreach_draft ?? '', c.previously_recommended ?? '',
  ]
}

/** U1：tier 升序，同层 score 降序 */
export function sortForOutput(creators: Creator[]): Creator[] {
  const order = { A: 0, B: 1, C: 2 }
  return [...creators].sort(
    (a, b) => order[a.tier!] - order[b.tier!] || (b.score ?? 0) - (a.score ?? 0))
}

const TIER_LABEL = { A: 'A级 直接发信', B: 'B级 先互动', C: 'C级 观察池' } as const

/**
 * U5：按分层切成多个 sheet。
 *
 * **空分层也建 sheet**，名称里标出 `(0)` —— 「这一层一个人都没有」本身是信息。
 * 隐藏掉会让运营以为是数据漏了，而不是这一层真的没人。
 */
export function buildSheets(creators: Creator[]): Array<{ name: string; headers: string[]; rows: unknown[][] }> {
  const sorted = sortForOutput(creators)
  const out: Array<{ name: string; headers: string[]; rows: unknown[][] }> = []
  for (const t of ['A', 'B', 'C'] as const) {
    const rows = sorted.filter(c => c.tier === t)
    out.push({ name: `${TIER_LABEL[t]} (${rows.length})`, headers: [...HEADERS], rows: rows.map(toRow) })
  }
  return out
}
