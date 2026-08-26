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
import { taskId, loadTask, loadCreators, loadEnrichment, saveCreators } from './lib/task.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { rankCreators, keywordStats, tierCounts } from './lib/pipeline.js'
import { recordRecommendations } from './lib/memory.js'
import { writeCsv } from './lib/csv.js'
import { HEADERS, toRow, buildSheets } from './lib/rows.js'
import { writeXlsx, type Sheet } from './lib/xlsx.js'
import { renderHtml } from './lib/report.js'
import { accountKey, attachAssessments } from './lib/assessment.js'
import type { Creator, Measurement } from './lib/types.js'

const i = process.argv.indexOf('--dir')
const dir = i >= 0 ? process.argv[i + 1] : undefined
if (!dir) { console.error('用法: tsx scripts/render.ts --dir <output/xxx>'); process.exit(2) }

const state = loadTask(dir)
let creators = loadCreators(dir)

// 同人识别与合并 —— 在这里再跑一次，render 才能独立于 collect 正确工作（幂等）
linkCrossPlatform(creators)
creators = mergeCrossPlatform(creators)

// D8/U7：公开指标独立存于 enrichment.json；渲染时按 platform:handle 关联摘要。
const enrichment = loadEnrichment(dir)
attachAssessments(creators, enrichment)

// 算分 → 分层 → 受众降权 → 排序。管线在 lib/pipeline.ts
creators = rankCreators(creators, state.market)
saveCreators(dir, creators)

// ---------- CSV（单表，供脚本与其他工具消费）----------
const csvPath = join(dir, 'kol.csv')
writeCsv(csvPath, [...HEADERS], creators.map(toRow))   // rankCreators 已排好序

// ---------- XLSX（分 sheet，供人快速切换）----------
// CSV 规范里没有「工作表」这个概念，多 sheet 只能走 xlsx。两个文件各司其职：
// CSV 给机器读，xlsx 给人看。
const xlsxPath = join(dir, 'kol.xlsx')
writeXlsx(xlsxPath, buildSheets(creators) as Sheet[])

// ---------- HTML + meta ----------
const countMeasurements = <T>(total: number, values: Array<Measurement<T> | undefined>) => ({
  total,
  measured: values.filter(v => v?.status === 'measured').length,
  unavailable: values.filter(v => v?.status === 'unavailable').length,
  unqueried: total - values.filter(Boolean).length,
})

const accountKeys = new Set<string>()
for (const c of creators) {
  accountKeys.add(accountKey(c.platform, c.handle))
  if (!c.linked_handle) continue
  const split = c.linked_handle.indexOf(':')
  const platform = c.linked_handle.slice(0, split)
  const handle = c.linked_handle.slice(split + 1)
  if ((platform === 'tiktok' || platform === 'instagram') && handle) {
    accountKeys.add(accountKey(platform, handle))
  }
}
const assessedAccounts = [...accountKeys].map(k => enrichment?.accounts[k])
const emailVerified = creators.filter(c => c.email_verified !== undefined).length
const audienceGeo = creators.filter(c => c.audience_geo !== undefined).length

const meta = {
  product: state.product,
  market: state.market,
  platforms: [...new Set(creators.map(c => c.platform))],
  keywords: keywordStats(creators),
  total: creators.length,
  tiers: tierCounts(creators),
  email_count: creators.filter(c => c.email).length,
  cross_platform_count: creators.filter(c => c.cross_platform).length,
  high_risk_count: creators.filter(c => {
    const risk = c.account_assessment?.metrics?.audience_quality_risk
    return risk?.status === 'measured' && risk.value.level === 'high'
  }).length,
  requests: state.requests,
  cost_estimate_usd: Number((state.requests * 0.001).toFixed(4)),
  budget_usd: state.budget_usd,
  // P5：兼容旧消费者；公开帖子指标不能把“邮箱/受众增强”伪装成已完成。
  enriched: emailVerified > 0 || audienceGeo > 0,
  capabilities: {
    email_verification: {
      total: creators.length, measured: emailVerified, unavailable: 0,
      unqueried: creators.length - emailVerified,
    },
    audience_geo: {
      total: creators.length, measured: audienceGeo, unavailable: 0,
      unqueried: creators.length - audienceGeo,
    },
    public_post_sample: countMeasurements(
      accountKeys.size, assessedAccounts.map(a => a?.sample)),
    audience_quality_risk: countMeasurements(
      accountKeys.size, assessedAccounts.map(a => a?.metrics?.audience_quality_risk)),
    creator_activity: countMeasurements(
      accountKeys.size, assessedAccounts.map(a => a?.metrics?.activity_status)),
    collaboration_quote: countMeasurements(
      accountKeys.size, assessedAccounts.map(a => a?.collaboration_quote)),
  },
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
