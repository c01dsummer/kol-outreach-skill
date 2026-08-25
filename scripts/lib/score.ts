import type { Creator } from './types.js'
import { PR_SIGNALS } from './email.js'

export const FOLLOWER_MIN = 5_000
export const FOLLOWER_MAX = 5_000_000

/**
 * 硬指标计分。**只算客观项** —— 内容相关性由 Agent 在 Phase 04 判断，不在这里做
 * 字符串匹配（那是前一版的设计错误）。
 */
export function scoreCreator(c: Creator): number {
  let s = 0
  if (c.email) s += 30
  // P1：粉丝数未知时不给分，也不当作 0 —— 「没查到」不等于「不合格」
  if (c.followers !== undefined && c.followers >= FOLLOWER_MIN && c.followers <= FOLLOWER_MAX) s += 20
  if (c.source_dimension === 'competitor') s += 15
  if (c.cross_platform) s += 15
  if (c.post_count !== undefined && c.post_count > 30) s += 10
  if (c.source_dimension === 'scene') s += 10
  if (c.bio !== undefined && PR_SIGNALS.test(c.bio)) s += 10
  if ((c.recent_posts ?? []).some(p => (p.plays ?? 0) > 100_000)) s += 5
  return s
}

/**
 * 分层。**语义判断有一票否决权** —— 高分但 ❌ 的（搬运号、品类冲突）不进 A。
 * 反过来，语义强相关但缺邮箱的进 B 而非 C：他值得花时间去私信。
 */
export function tierOf(c: Creator): 'A' | 'B' | 'C' {
  if (c.fit === '❌') return 'C'
  if (c.email && c.fit === '✅') return 'A'
  if (c.fit === '✅' || c.fit === '⚠️') return 'B'
  // 未做语义判断时退化为纯分数
  const s = c.score ?? 0
  return s >= 60 ? 'A' : s >= 40 ? 'B' : 'C'
}

/** 受众地域降权 —— 有增强数据时生效 */
export function applyGeoPenalty(c: Creator, market: string): 'keep' | 'demote' | 'drop' {
  const pct = c.audience_geo?.[market]
  if (pct === undefined) return 'keep'
  if (pct < 0.15) return 'drop'
  if (pct < 0.30) return 'demote'
  return 'keep'
}

/**
 * 粉丝数闸门。
 *
 * P1：**未知一律放行** —— 「没查到」不等于「不合格」。
 * 静默过滤掉未知的人，会让真实创作者凭空消失且无人知晓。
 */
export function passesFollowerGate(c: Creator): boolean {
  if (c.followers === undefined) return true
  return c.followers >= FOLLOWER_MIN && c.followers <= FOLLOWER_MAX
}
