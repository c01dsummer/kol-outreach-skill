/**
 * 粉丝数、作品数两项读数在「同一个人又被查到一次」时怎么合（P1.m，ADR-227）。
 * 单独成一个小模块，是因为两处要用：同一页搜索结果里同一个账号出现两次（`providers/tikhub.ts`），
 * 和第二个关键词又搜到同一个人（`lib/pipeline.ts`）。数据源适配层不该为这一条去引整个流程模块。
 */
import type { Creator } from './types.js'

/** 合并只看这三样 */
export type CountHolder = Pick<Creator, 'followers' | 'post_count' | 'invalid_from_provider'>

/**
 * P1.m（ADR-227）：粉丝数、作品数已有值的不动；还没有值的，这一次给了有效值就用它、不再记怪值，
 * 这一次给的是怪值就记「未取得有效值」。供应商没给（这一次也缺席）时照旧。
 */
export function mergeCounts(seen: CountHolder, p: CountHolder): void {
  const invalid = new Set(seen.invalid_from_provider ?? [])
  for (const k of ['followers', 'post_count'] as const) {
    if (seen[k] !== undefined) continue
    if (p[k] !== undefined) { seen[k] = p[k]; invalid.delete(k) }
    else if (p.invalid_from_provider?.includes(k)) invalid.add(k)
  }
  if (invalid.size) seen.invalid_from_provider = (['followers', 'post_count'] as const).filter(k => invalid.has(k))
  else delete seen.invalid_from_provider
}
