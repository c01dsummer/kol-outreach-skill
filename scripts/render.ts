#!/usr/bin/env tsx
/**
 * Phase 06 —— 交付
 *
 * 读 creators.json（Agent 已在 Phase 04 填入 fit / fit_reason / outreach_draft），
 * 算分、分层、写 CSV + HTML 报告 + meta.json，并写回跨任务记忆。
 *
 * 用法: tsx scripts/render.ts --dir output/anker-powerbank-202608251430
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadTask, loadCreators, saveCreators } from './lib/task.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { scoreCreator, tierOf, applyGeoPenalty } from './lib/score.js'
import { recordRecommendations } from './lib/memory.js'
import { writeCsv } from './lib/csv.js'
import { renderHtml } from './lib/report.js'
import type { Creator } from './lib/types.js'

const i = process.argv.indexOf('--dir')
const dir = i >= 0 ? process.argv[i + 1] : undefined
if (!dir) { console.error('用法: tsx scripts/render.ts --dir <output/xxx>'); process.exit(2) }

const state = loadTask(dir)
let creators = loadCreators(dir)

// 同人识别与合并 —— 在这里再跑一次，render 才能独立于 collect 正确工作（幂等）
linkCrossPlatform(creators)
creators = mergeCrossPlatform(creators)

// 算分 → 分层 → 受众降权
const DEMOTE = { A: 'B', B: 'C', C: 'C' } as const
creators = creators.filter(c => {
  c.score = scoreCreator(c)
  c.tier = tierOf(c)
  const geo = applyGeoPenalty(c, state.market)
  if (geo === 'drop') return false
  if (geo === 'demote') c.tier = DEMOTE[c.tier]
  return true
})

const order = { A: 0, B: 1, C: 2 }
creators.sort((a, b) => order[a.tier!] - order[b.tier!] || (b.score ?? 0) - (a.score ?? 0))
saveCreators(dir, creators)

// ---------- CSV ----------
const HEADERS = [
  'tier', 'score', 'fit', 'fit_reason', 'platform', 'handle', 'nickname',
  'followers', 'post_count', 'bio', 'email', 'email_verified', 'audience_geo_top',
  'cross_platform', 'linked_handle', 'profile_url', 'source_keyword',
  'source_dimension', 'best_post_desc', 'outreach_draft', 'previously_recommended',
]

const topGeo = (c: Creator) => {
  if (!c.audience_geo) return ''
  const [k, v] = Object.entries(c.audience_geo).sort((a, b) => b[1] - a[1])[0] ?? []
  return k ? `${k} ${Math.round((v as number) * 100)}%` : ''
}
const bestPost = (c: Creator) =>
  [...(c.recent_posts ?? [])].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))[0]?.desc ?? ''

const csvPath = join(dir, 'kol.csv')
writeCsv(csvPath, HEADERS, creators.map(c => [
  c.tier, c.score, c.fit ?? '', c.fit_reason ?? '', c.platform, c.handle, c.nickname,
  c.followers, c.post_count, c.bio, c.email ?? '', c.email_verified ?? '', topGeo(c),
  c.cross_platform ?? false, c.linked_handle ?? '', c.profile_url, c.source_keyword,
  c.source_dimension, bestPost(c), c.outreach_draft ?? '', c.previously_recommended ?? '',
]))

// ---------- 关键词表现 ----------
const kwStats = new Map<string, { found: number; fit_pass: number; dimension: string }>()
for (const c of creators) {
  const k = c.source_keyword
  const e = kwStats.get(k) ?? { found: 0, fit_pass: 0, dimension: c.source_dimension }
  e.found++
  if (c.fit === '✅') e.fit_pass++
  kwStats.set(k, e)
}

// ---------- HTML + meta ----------
const tiers = { A: 0, B: 0, C: 0 }
for (const c of creators) tiers[c.tier!]++

const meta = {
  product: state.product,
  market: state.market,
  platforms: [...new Set(creators.map(c => c.platform))],
  keywords: [...kwStats].map(([keyword, s]) => ({ keyword, ...s })),
  total: creators.length,
  tiers,
  email_count: creators.filter(c => c.email).length,
  cross_platform_count: creators.filter(c => c.cross_platform).length,
  requests: state.requests,
  cost_estimate_usd: Number((state.requests * 0.001).toFixed(4)),
  budget_usd: state.budget_usd,
  enriched: creators.some(c => c.email_verified !== undefined),
}
writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
writeFileSync(join(dir, 'report.html'), renderHtml(creators, meta), 'utf8')

// ---------- 写回记忆 ----------
recordRecommendations(creators, state.product)

console.log(JSON.stringify({
  csv: csvPath,
  html: join(dir, 'report.html'),
  ...meta,
}, null, 2))
