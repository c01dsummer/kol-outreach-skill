#!/usr/bin/env tsx
/**
 * 外部工单号闸门的入口（`npm run ticket-refs`，检查链里排在体量闸门与变异负载闸门之后）。
 *
 * 只起 git、打印、退出；数什么、怎么数、怎么比、什么时候红都在 `ticket-refs-rule.ts`（ADR-205）。
 * 起点与体量闸门同一个判定（`size-rule.ts` 的 `resolveBaseline`）。无从判断时说出来、以 1 退出，
 * 不退化成「零个，通过」。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { GIT_CONFIG, resolveBaseline } from './size-rule.js'
import { grepOutput, judgeRefs, parseRefs, refsArgs, refsLines } from './ticket-refs-rule.js'

function tryGit(...args: string[]): string | null {
  try {
    return execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch { return null }
}

function count(tree?: string): Map<string, number> | null {
  const r = spawnSync('git', [...GIT_CONFIG, ...refsArgs(tree)], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const out = grepOutput(r.status, r.stdout ?? '')
  return out === null ? null : parseRefs(out, tree)
}

function cannotAnswer(why: string): never {
  console.error(`✗ 外部工单号：无从判断 —— ${why}`)
  process.exit(1)
}

const baseline = resolveBaseline(tryGit)
if (baseline.kind === 'cannot-answer') cannotAnswer(`${baseline.why}（${baseline.how}）`)
if (baseline.kind === 'not-applicable') {
  console.log(`✓ 外部工单号：不适用 —— HEAD 就是 ${baseline.trunk} 且没有父提交`)
  process.exit(0)
}
const before = count(baseline.base)
const now = count()
if (before === null || now === null) cannotAnswer('`git grep` 出错了')
const scope = `${baseline.onTrunk ? `${baseline.trunk} 的上一版` : baseline.trunk}（${baseline.base.slice(0, 7)}）`
const { ok, out, err } = refsLines(judgeRefs(before, now), baseline.onTrunk, scope)
for (const line of out) console.log(line)
for (const line of err) console.error(line)
process.exit(ok ? 0 : 1)
