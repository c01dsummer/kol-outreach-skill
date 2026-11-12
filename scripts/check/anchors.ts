#!/usr/bin/env tsx
/**
 * 变异锚点对着当前树 —— 检查链的第一步（ADR-70 末尾「变异残留」第三片）。
 *
 * 读变异目录与每条变异的目标文件，交给 `mutate-rule.ts` 的 `anchorCatalog` 与 `anchorVerdict`，照它交回的逐条说人话，
 * 有一条就以 1 退出。编号不重复时再读 git 暂存区与 HEAD，交给 `stagedResidue`：变异被 `git add` 过、工作树那一处
 * 又按回去了的，工作树上看不出来，下一次提交却会带进去（ADR-70 末尾「变异残留：暂存区」第五片）。
 * 判定全在那三个函数（目录是不是一组变异、编号重复先报、五种对不上、哪条是被连带的、附哪两句话、暂存区里哪条算躺着），
 * 这里只读文件与 git、说人话、设退出码（`docs/CONVENTIONS.md` 第 10 条）。
 *
 * 暂存区只对 `git diff --name-only`（工作树与暂存区不同）列出的文件读，其余文件交工作树那份 —— 两边一样，
 * 判定的注释写着交哪份结论都一样，这只省进程，不改结论。HEAD 同样只对那几个文件读。读不到 git（不是仓库、
 * 没装 git）时暂存区那一步不做，✓ 那一行照实说没查。合并冲突里多阶段的条目 `git show :文件` 读不出，那个文件按不在暂存区算。
 *
 * **排在最前面**：一处变异没还原、躺在树里时，后面每一步跑的都是被改过的源码，报出来的却是别的事 ——
 * 需求测试红在某条断言上，或者变异一步十几分钟后才说那一条「锚点失效」。也为了提交之前单跑
 * `npm run anchors` 就查得到：不起验证者，git 只读不写。
 *
 * 它拦不住「变异正在跑、恰好在那一刻提交」那个窗口（要一把锁，ADR-70 第 1399–1400 行）；派工跑时变异施加在
 * 隔离目录里，树上本来就不会有，会躺在树上的只有串行那条路（`--jobs=1`、单核、只剩一条）和被打断没还原的。
 *
 * 读不到的目标文件交 `undefined`，由判定报成一处，不当成空文件。变异目录本身读不到、读不出一组变异（不是数组、
 * 空的、哪一条缺了那四样字符串）时也以 1 退出：没得核不是核过了。设退出码、不硬退出：报的行可能有几十条，接管道时硬退出会把还没写出去的
 * 截掉（`mutate-rule.ts` 的 `exitRace` 记着的那个坑）。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { type AnchorFault, type StagedFault, anchorCatalog, anchorVerdict, stagedResidue } from './mutate-rule.js'
import { GIT_CONFIG } from './size-rule.js'

const CATALOG = 'scripts/check/mutations.json'
type Mut = { id: string; file: string; find: string; replace: string }

const read = (file: string): string | undefined => { try { return readFileSync(file, 'utf8') } catch { return undefined } }
const catalog = ((): Mut[] | undefined => {
  try { return anchorCatalog(JSON.parse(readFileSync(CATALOG, 'utf8'))) } catch { return undefined }
})()

const git = (...args: string[]): string =>
  execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 })
const fromGit = (spec: string): string | undefined => { try { return git('show', spec) } catch { return undefined } }
/** 工作树与暂存区不同的文件（相对当前目录）；读不到 git 交 `undefined` */
const unstaged = ((): Set<string> | undefined => {
  try { return new Set(git('diff', '--name-only', '-z', '--relative').split('\0').filter(f => f !== '')) } catch { return undefined }
})()

const STAGED: Record<StagedFault['kind'], string> = {
  residue: '暂存区里像是没还原 —— 工作树已按回去，暂存区里还是这条变异施加之后的样子',
  unclear: '暂存区里分不开 —— 暂存区里 find 一处都没有、replace 在，工作树里对得上',
}

const SAY: Record<AnchorFault['kind'], string> = {
  unreadable: '目标文件读不到',
  residue: '像是没还原 —— 文件里是这条变异施加之后的样子',
  ambiguous: '锚点不止一处，要恰好一处',
  unclear: '分不开 —— find 一处都没有、replace 在，没还原与锚点失效都是这个样子',
  stale: '锚点失效 —— find 一处都没有',
}

if (catalog === undefined) {
  console.error(`✗ 变异锚点：${CATALOG} 读不到，或读不出一组变异 —— 没得核不是核过了`)
  process.exitCode = 1
} else {
  const verdict = anchorVerdict(catalog, read)
  if (verdict.kind === 'duplicate') {
    const out = [`✗ 变异锚点：${verdict.ids.length} 个编号重复 —— 报告按编号指回目录里那一行，重名时指不回，锚点没往下查\n`]
    for (const id of verdict.ids) out.push(`  ${id}  出现不止一次`)
    out.push('\n  复制一条就改掉它的字母。')
    console.error(out.join('\n'))
    process.exitCode = 1
  } else {
    const changed = unstaged
    const viaGit = (prefix: string) => (file: string) => changed?.has(file) ? fromGit(`${prefix}:./${file}`) : read(file)
    const staged = changed === undefined ? [] : stagedResidue(catalog, read, viaGit(''), viaGit('HEAD'))
    const { faults, advice } = verdict
    if (faults.length === 0 && staged.length === 0) {
      const index = changed === undefined ? '读不到 git，暂存区没查' : '暂存区也查过'
      console.log(`✓ 变异锚点：${catalog.length} 条变异的锚点各在目标文件里恰好一处，树上没有没还原的变异（${index}）`)
    } else {
      const out = faults.length === 0 ? [] : [`✗ 变异锚点：${faults.length} 条变异对不上目标文件\n`]
      for (const f of faults) {
        const count = f.kind === 'ambiguous' ? `（${f.count} 处）` : ''
        const knock = f.knockOn ? '（这个文件里有一处可能没还原的，先撤那一处再看这一条）' : ''
        out.push(`  ${f.id}  ${f.file}：${SAY[f.kind]}${count}${knock}`)
      }
      if (advice.diff) {
        out.push('\n  没还原或分不开的：先用 git diff HEAD 看那个文件再动手（暂存了的也看得见；还没 git add 过的新文件，diff 和历史都看不见它，直接看文件内容找那一处，别凭历史判锚点失效）。是没还原的（多半是上一次变异跑被打断，'
          + '或者 --jobs=1 正跑着的时候动了树），只撤那一处 —— 整个文件 git checkout 会把别的改动一起按回去（ADR-70 第 2099 行）。'
          + 'diff 里看不到那一处的（空的，或者只有你自己的改动），那处可能已经提交了：先 git log -p 那个文件，找出那次提交里的那一处：是变异跑漏下的残留才撤，是有意改的就不撤，改变异集；'
          + '浅克隆（git rev-parse --is-shallow-repository 为 true）先 git fetch --unshallow 再查；历史完整也找不到，还要直接看文件内容、确认树上没有那一处变异后的样子（新文件先暂存再被变异的，diff HEAD 和历史都看不出来），才是锚点失效：改那条变异的 file 与 find，跟上现在的代码。')
      }
      if (advice.catalog) {
        out.push('\n  锚点失效、不唯一、读不到的：改那条变异的 file 与 find，跟上现在的代码。')
      }
      if (staged.length > 0) {
        out.push(`${faults.length === 0 ? '' : '\n'}✗ 变异锚点：暂存区里 ${staged.length} 条变异是施加之后的样子，下一次 git commit 会把它带进去\n`)
        for (const f of staged) out.push(`  ${f.id}  ${f.file}：${STAGED[f.kind]}`)
        out.push('\n  暂存区里的：先用 git diff --cached 看那个文件，只撤暂存区里那一处 —— git restore --staged 整个文件会把它暂存的别的改动一起撤掉，'
          + '有别的改动就用 git restore --staged -p 挑出那一处。工作树里也有那一处的，两边都要撤。')
      }
      console.error(out.join('\n'))
      process.exitCode = 1
    }
  }
}
