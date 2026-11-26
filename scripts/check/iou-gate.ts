#!/usr/bin/env tsx
/**
 * 新登记欠条闸门的入口（`npm run iou-gate`，检查链里的一步）：列给需求所有者、他还没判的欠条满了，这条改动又新登记欠条，就红。
 * 判定全在 `iou-gate-rule.ts`（哪些块算新加、哪些算登记、数法、红不红），这里只读文件与 git、打印、设退出码（`docs/CONVENTIONS.md` 第 10 条）。
 *
 * 改动前从哪个提交量起，与体量闸门同一个判定（`size-rule.ts` 的 `resolveBaseline`）：分支上是与主干的共同祖先，主干上是上一版。
 * 改动前读那个提交上 `docs/adr/` 下的全部记录，改动后读工作区（没提交的也算）。
 * HEAD 还在主干上（新开的分支还没提交过）也按主干算、只报数 —— 与体量闸门一样；提交一次之后才按分支量。
 * 列过没判的张数在主干最新那一版上数（不是共同祖先：别人在主干上判完了，这里就该放行），判定要了才数 —— 要几十秒。
 * 回访 PR：CI 上看这条 PR 的分支名，本地看当前分支。
 *
 * 量不了（浅克隆、找不到主干、读不到记录）以 1 退出并说怎么办：没得比不是比过了。
 */
import { adrDocs } from './debt-rule.js'
import { askGit } from './git-entry.js'
import { freshBlocks, iouGate, revisitBranch, waitingOf } from './iou-gate-rule.js'
import { cliRawGit } from './revisit-raw-rule.js'
import { beijingDate, cliGit, dueItems } from './revisit-rule.js'
import { resolveBaseline } from './size-rule.js'

function main(): number {
  const baseline = resolveBaseline(askGit)
  if (baseline.kind === 'cannot-answer') {
    console.log(`✗ 新登记闸门：无从比较 —— ${baseline.why}`)
    console.log(`  怎么办：${baseline.how}`)
    return 1
  }
  if (baseline.kind === 'not-applicable') {
    console.log(`新登记闸门（只报数）：HEAD 就是 ${baseline.trunk} 且没有父提交，没有改动前的记录可比`)
    return 0
  }
  const raw = cliRawGit()
  const before = raw.adrTree(baseline.base)
  if (before === undefined) {
    console.log(`✗ 新登记闸门：读不到 ${baseline.base.slice(0, 7)} 上的决策记录，没得比`)
    return 1
  }
  const branch = process.env.GITHUB_HEAD_REF || (askGit('symbolic-ref', '-q', '--short', 'HEAD') ?? undefined)
  const verdict = iouGate({
    added: freshBlocks(before, adrDocs()),
    waiting: () => {
      const docs = raw.adrTree(baseline.trunk)
      if (docs === undefined) throw new Error(`读不到 ${baseline.trunk} 上的决策记录，数不了列过没判的`)
      return waitingOf(dueItems(cliGit(), baseline.trunk, docs), docs, beijingDate(Date.now() / 1000))
    },
    revisit: revisitBranch(branch),
    trunk: baseline.onTrunk,
  })
  for (const line of verdict.lines) console.log(line)
  return verdict.red ? 1 : 0
}

try {
  process.exitCode = main()
} catch (error) {
  console.log(`✗ 新登记闸门：${(error as Error).message.split('\n')[0]}`)
  process.exitCode = 1
}
