#!/usr/bin/env tsx
/**
 * 回写变异分份用的秒数文件（ADR-203）：`npm run shard-weights -- <日志>…`。
 *
 * 读给定的几份 CI 变异 job 日志（`gh run view --log` 或网页上下载的那种都行），取每行 `MUTATION_COST_JSON ` 后面那段里
 * `kind` 为 summary 的 `report`，交给 `shard-load-rule.ts` 的 `weightsFromReports` 算，照 `weightsText` 写回 `shard-weights.json`。
 * 一份报告都读不到、或算不出来，不写、退出 1。什么时候该重写见 ADR-203 第六节。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { SHARD_WEIGHTS_FILE, weightsFromReports, weightsText } from './shard-load-rule.js'

const MARK = 'MUTATION_COST_JSON '
const files = process.argv.slice(2)
const reports: unknown[] = []
for (const file of files) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const at = line.indexOf(MARK)
    if (at < 0) continue
    const seg = JSON.parse(line.slice(at + MARK.length)) as { kind?: unknown; report?: unknown }
    if (seg.kind === 'summary') reports.push(seg.report)
  }
}
const got = weightsFromReports(reports)
if ('fault' in got) {
  console.log(`✗ 秒数文件：${files.length} 份日志里读到 ${reports.length} 份成本报告，算不出来（${got.fault}）；没有写`)
  process.exitCode = 1
} else {
  writeFileSync(SHARD_WEIGHTS_FILE, weightsText(got.weights))
  console.log(`✓ 秒数文件：${files.length} 份日志、${reports.length} 份成本报告（${got.weights.runs.length} 跑），${Object.keys(got.weights.configs).length} 种配置，写到 ${SHARD_WEIGHTS_FILE}`)
}
