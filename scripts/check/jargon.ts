#!/usr/bin/env tsx
/**
 * 生词提示的入口（`npm run jargon`）—— 这条分支在 Markdown 里新加的行，冒出了哪几处要配白话的写法（ADR-237）。
 *
 * **只报，恒以 0 退出。** 不在检查链里：CI 在 `chain` 那个 job 跑完检查链各步之后单列一步跑它，
 * 汇总那一句打成一条通知、全文写进那一跑的 Summary，红绿都照跑（`.github/workflows/check.yml`）。
 * 取不到改动时打「无从比较」加原因，也以 0 退出 —— 这是提醒，不是闸门。
 *
 * 「新加的行」从哪里量起，和体量闸门、欠条点名提醒是同一个判定（`size-rule.ts` 的 `resolveBaseline`）；
 * 每个改过的 `.md` 各问一次 `git diff -U0`，块头交给 `field-use-rule.ts` 的 `addedLines` 读（与字段断言闸门同一套）。
 * 量到工作区为止；没 `git add` 的新文件不算。判定（扫哪几份、哪几行，认得哪些词，哪处要提醒）都在 `jargon-rule.ts`，
 * 这里只起 git、读文件、打印。
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { askGit, gitOrThrow } from './git-entry.js'
import { addedMarkdown, jargonHits, jargonLines, jargonSummary, knownFrom } from './jargon-rule.js'
import { resolveBaseline } from './size-rule.js'

const git = (...args: string[]): string => gitOrThrow(args)
const zList = (out: string): string[] => out.split('\0').filter(n => n !== '')

/** 在 GitHub Actions 里：汇总一句进通知，全文进 Summary。通知里只有固定文案与数字。 */
function toGithub(summary: string, lines: string[]): void {
  if (process.env.GITHUB_ACTIONS !== 'true') return
  console.log(`::notice title=生词提示::${summary}`)
  const file = process.env.GITHUB_STEP_SUMMARY
  if (!file) return
  try {
    appendFileSync(file, ['### 生词提示', '', '```text', ...lines, '```', ''].join('\n'))
  } catch (error) {
    console.log(`  （Summary 写不进去：${(error as Error).message}）`)
  }
}

function main(): void {
  const baseline = resolveBaseline(askGit)
  if (baseline.kind !== 'measure') {
    const why = baseline.kind === 'cannot-answer' ? baseline.why : `HEAD 就是 ${baseline.trunk} 且没有父提交`
    const line = `生词提示：无从比较（${why}）`
    console.log(line); toGithub(line, [line]); return
  }
  // 路径都是相对仓库根的（`--no-relative`、`ls-files` 在根上跑）；npm 在根上起这个脚本
  const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
  const changed = zList(git('diff', '--name-only', '--no-renames', '--no-relative', '-z', baseline.base))
  const { added, skipped } = addedMarkdown(changed, file => git('diff', '--no-renames', '--no-relative', '--no-color', '--no-ext-diff', '--no-textconv',
    '--text', '--diff-algorithm=myers', '--indent-heuristic', '-U0', '--inter-hunk-context=0', baseline.base, '--', `:(top,literal)${file}`))
  const known = knownFrom(zList(git('ls-files', '-z')), read, added)
  // 改过、却已经删掉的文件没有新加的行（只删的块），读不到也不要紧
  const hits = jargonHits(added, f => { try { return read(f) } catch { return '' } }, known)
  const lines = [...jargonLines(hits), ...skipped.map(s => `  （这一份没法比、跳过了：${s}）`)]
  for (const line of lines) console.log(line)
  toGithub(jargonSummary(hits), lines)
}

try { main() } catch (error) {
  const line = `生词提示：无从比较（${(error as Error).message.split('\n')[0]}）`
  console.log(line); toGithub(line, [line])
}
