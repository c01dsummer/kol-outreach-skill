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
import { taskId, loadTask, loadCreators, saveCreators } from './lib/task.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { scoreCreator, tierOf, applyGeoPenalty } from './lib/score.js'
import { recordRecommendations } from './lib/memory.js'
import { writeCsv } from './lib/csv.js'
import { HEADERS, toRow, sortForOutput, buildSheets } from './lib/rows.js'
import { writeXlsx, type Sheet } from './lib/xlsx.js'
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

creators = sortForOutput(creators)
saveCreators(dir, creators)

// ---------- CSV（单表，供脚本与其他工具消费）----------
const csvPath = join(dir, 'kol.csv')
writeCsv(csvPath, [...HEADERS], sortForOutput(creators).map(toRow))

// ---------- XLSX（分 sheet，供人快速切换）----------
// CSV 规范里没有「工作表」这个概念，多 sheet 只能走 xlsx。两个文件各司其职：
// CSV 给机器读，xlsx 给人看。
const xlsxPath = join(dir, 'kol.xlsx')
writeXlsx(xlsxPath, buildSheets(creators) as Sheet[])

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
recordRecommendations(creators, state.product, taskId(dir))

console.log(JSON.stringify({
  csv: csvPath,
  xlsx: xlsxPath,
  html: join(dir, 'report.html'),
  ...meta,
}, null, 2))
