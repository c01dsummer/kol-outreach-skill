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
  if (typeof c.bio === 'string' && PR_SIGNALS.test(c.bio)) s += 10
  // P1：播放数未知时不给分，也不当作 0 —— 「没取到播放数」不等于「这条不是爆款」
  if (c.recent_posts?.some(p => p.plays !== undefined && p.plays > 100_000)) s += 5
  return s
}

/**
 * D21 / F6：基础分层先核评审时效；待重评与缺主号 fit 保留 B 待核实。
 * 其余明确 fit 保持兼容规则，硬分不代替内容判断；地域与风险由管线随后处理。
 */
export function tierOf(c: Creator, _score: number): 'A' | 'B' | 'C' {
  if (c.review_status === '待重评') return 'B'
  if (c.fit === '❌') return 'C'
  if (c.email && c.fit === '✅') return 'A'
  // 缺判断不等于不合格；保留参数兼容调用方，不从新判断或另一平台补 fit。
  return 'B'
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
 * F8：公开信号只给“受众质量风险”，不是假粉率。只有 high 会触发人工复核降级，
 * unavailable / medium / low 都不偷偷改变名单。
 */
export function applyAudienceRiskPenalty(c: Creator): 'keep' | 'demote' {
  const risk = c.account_assessment?.metrics?.audience_quality_risk
  return risk?.status === 'measured' && risk.value.level === 'high' ? 'demote' : 'keep'
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
