/**
 * 纪律 lint 的判定 —— 从入口里抽出来的那一半。
 *
 * 抽出来的理由是 `docs/CONVENTIONS.md` 第 10 条自己那句话：有语义就该能被测，
 * 能被测就不该待在入口脚本里。这条 lint 是 P1 唯一机器可执行的那一半，
 * 而它的判定以前没有任何测试碰得到。走文件树、打印、退出码仍留在 `lint.ts`。
 */

/** 这些字段的值会进入过滤、评分、分层 —— 兜底就是静默改变决策 */
export const SENSITIVE = [
  'followers', 'follower_count', 'post_count', 'aweme_count', 'media_count',
  'following', 'following_count', 'views', 'play_count', 'plays', 'likes', 'like_count',
  'comments', 'comment_count', 'median_views', 'median_engagements',
  'engagement_rate_followers', 'engagement_rate_views', 'view_rate', 'following_ratio',
  'reach_consistency', 'median_post_gap_days', 'latest_post_at', 'days_since_last_post',
  'activity_status', 'audience_quality_risk',
  'implied_ecpm', 'implied_ecpe',
  'bio', 'signature', 'biography', 'email', 'email_verified',
  'audience_geo', 'fake_follower_score',
]

/**
 * `null` 必须在这张表里。它是三态模型的**中间态** —— `?? null` 把「未查询」
 * 写成「查过，没有」，恰恰是 P1 要防的那件事，却是唯一一个曾经漏掉的兜底值。
 * 合法的 `?? null`（确实查过、确实没有）加 p1-ok 说明理由即可。
 */
export const FALLBACK = /(\?\?|\|\|)\s*(0\b|''|""|`|\[\]|false\b|null\b)/

/**
 * 第二类形状：**空输入时返回 0**。
 * 实测栽过一次 —— probe 的 median 在无粉丝数据时返回 0，被读成「这批全是小号」。
 * 敏感字段启发式抓不到它（median 是局部函数），所以单列一条。
 */
export const EMPTY_ZERO = /if\s*\(\s*!\w+\.length\s*\)\s*return\s+(0\b|''|"")/

export type LintVerdict = 'clean' | 'violation' | 'exempt' | 'unjustified_exemption'

/** 一行代码的判定。`unjustified_exemption` 也不放行 —— 豁免的理由是必填的。 */
export function judgeLine(text: string): LintVerdict {
  if (!EMPTY_ZERO.test(text)) {
    if (!FALLBACK.test(text)) return 'clean'
    if (!SENSITIVE.some(f => text.includes(f))) return 'clean'
  }
  if (/\/\/\s*p1-ok:\s*\S/.test(text)) return 'exempt'
  if (/\/\/\s*p1-ok\b/.test(text)) return 'unjustified_exemption'
  return 'violation'
}
