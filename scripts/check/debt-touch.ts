#!/usr/bin/env tsx
/**
 * 欠条点名提醒的入口（`npm run debt-touch`）—— 这条分支改到的文件，被哪几条开着的欠条写进了正文。
 *
 * **只报，恒以 0 退出。** 不在检查链里：CI 在 `npm run check` 之后单列一步跑它，
 * 汇总那一句打成一条通知、全文写进那一跑的 Summary，红绿都照跑（`.github/workflows/check.yml`）。
 * 取不到改动清单时打「无从比较」加原因，也以 0 退出 —— 这是提醒，不是闸门（ADR-196）。
 *
 * 「改到的文件」从哪里量起，和体量闸门是同一个判定（`size-rule.ts` 的 `resolveBaseline`）：
 * 分支上是与主干的共同祖先，主干上是上一版。量到工作区为止，所以本地没提交的改动也算；
 * 没 `git add` 的新文件不算。判定在 `debt-touch-rule.ts`。
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { adrDocs } from './debt-rule.js'
import { touchLines, touchReport, touchSummary } from './debt-touch-rule.js'
import { GIT_CONFIG, resolveBaseline } from './size-rule.js'

function git(...args: string[]): string {
  return execFileSync('git', [...GIT_CONFIG, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim()
}
function tryGit(...args: string[]): string | null {
  try { return git(...args) } catch { return null }
}
const list = (out: string) => out.split('\0').filter(Boolean)

/** 在 GitHub Actions 里：汇总一句进通知，全文进 Summary。通知里只有固定文案与数字。 */
function toGithub(summary: string, lines: string[]): void {
  if (process.env.GITHUB_ACTIONS !== 'true') return
  console.log(`::notice title=欠条点名::${summary}`)
  const file = process.env.GITHUB_STEP_SUMMARY
  if (!file) return
  try {
    appendFileSync(file, ['### 欠条点名提醒', '', '```text', ...lines, '```', ''].join('\n'))
  } catch (error) {
    console.log(`  （Summary 写不进去：${(error as Error).message}）`)
  }
}

function main(): void {
  const baseline = resolveBaseline(tryGit)
  if (baseline.kind !== 'measure') {
    const why = baseline.kind === 'cannot-answer' ? baseline.why : `HEAD 就是 ${baseline.trunk} 且没有父提交`
    const line = `欠条点名提醒：无从比较（${why}）`
    console.log(line); toGithub(line, [line]); return
  }
  const changed = list(git('diff', '--name-only', '--no-renames', '-z', baseline.base))
  const files = list(git('ls-files', '-z'))
  const report = touchReport(adrDocs(), files, changed)
  const lines = touchLines(report)
  for (const line of lines) console.log(line)
  toGithub(touchSummary(report), lines)
}

try { main() } catch (error) {
  const line = `欠条点名提醒：无从比较（${(error as Error).message.split('\n')[0]}）`
  console.log(line); toGithub(line, [line])
}
