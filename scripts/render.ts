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
import { asMemoryStatus } from './lib/types.js'
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

// ---------- 写回记忆 ----------
// 在 meta 之前 —— 报告要声明写回的结果，就得先拿到结果。
// 记忆读不出来时不写回（绝不拿一份「谁都没联系过」去盖掉它，ADR-15），
// 损失的是下一轮的「已推荐过」去重，属于覆盖；写回则会毁掉 contacted 与
// blocked，属于可信。覆盖能补，可信补不回来。
const writeBack = recordRecommendations(creators, state.product, taskId(dir))
if (!writeBack.written) {
  // 原因有两类：读不出来（去修 JSON）和写不进去（去看权限/磁盘）。
  // **不要替用户断定是哪一类** —— 让他拿着真实原因去修对的地方（ADR-20）。
  console.error(`\n⚠️  记忆未写回：${writeBack.reason}`)
  console.error(`   原文件保持不动（盖掉它会永久抹掉「谁联系过」）。`)
  console.error(`   解决之前，这一批人不会被记进跨任务记忆。`)
}

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
  // P4/P5（ADR-15）：这一批有没有去重、这一批有没有被记下。两件事分开报，
  // 因为它们坏掉的后果不同：前者是这次可能重复打扰，后者是下次可能重复推荐。
  //
  // 字段缺失读作 unknown，**不读作 ok**：缺失来自 ADR-15 之前的 collect，
  // 而那一版遇到读不出来的记忆会静默当成空记忆 —— 「过滤跑过了」不等于
  // 「过滤生效了」。当成 ok 就是替一批无从确认的名单打包票（ADR-18）。
  // unknown 另有一个来源：名单与状态没能一起落成（ADR-41）。两者事后分不出，
  // 所以报告里的措辞与来源无关，不替用户编一个原因（ADR-43）。
  // 缺失、null、拼错、新版本写下的新取值 —— 认不出的一律 unknown（ADR-47）
  memory_status: asMemoryStatus(state.memory_status),
  memory_written: writeBack.written,
  // 只在真的没写回时出现。原因有两类（读不出来 / 写不进去），
  // 报告要把原文带给用户，否则他会去修一份根本没坏的 JSON（ADR-20）。
  ...(writeBack.written ? {} : { memory_write_error: writeBack.reason }),
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

console.log(JSON.stringify({
  csv: csvPath,
  xlsx: xlsxPath,
  html: join(dir, 'report.html'),
  ...meta,
}, null, 2))
