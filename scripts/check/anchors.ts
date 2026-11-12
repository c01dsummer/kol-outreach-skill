#!/usr/bin/env tsx
/**
 * 变异锚点对着当前树 —— 检查链的第一步（ADR-70 末尾「变异残留」第三片）。
 *
 * 读变异目录与每条变异的目标文件，交给 `mutate-rule.ts` 的 `anchorCatalog` 与 `anchorVerdict`，照它交回的逐条说人话，
 * 有一条就以 1 退出。判定全在那两个函数（目录是不是一组变异、编号重复先报、五种对不上、哪条是被连带的、附哪两句话），
 * 这里只读文件、说人话、设退出码（`docs/CONVENTIONS.md` 第 10 条）。
 *
 * **排在最前面**：一处变异没还原、躺在树里时，后面每一步跑的都是被改过的源码，报出来的却是别的事 ——
 * 需求测试红在某条断言上，或者变异一步十几分钟后才说那一条「锚点失效」。也为了提交之前单跑
 * `npm run anchors` 就查得到：不起验证者、不碰 git。
 *
 * 它拦不住「变异正在跑、恰好在那一刻提交」那个窗口（要一把锁，ADR-70 第 1399–1400 行）；派工跑时变异施加在
 * 隔离目录里，树上本来就不会有，会躺在树上的只有串行那条路（`--jobs=1`、单核、只剩一条）和被打断没还原的。
 *
 * 读不到的目标文件交 `undefined`，由判定报成一处，不当成空文件。变异目录本身读不到、读不出一组变异（不是数组、
 * 空的、哪一条缺了那四样字符串）时也以 1 退出：没得核不是核过了。设退出码、不硬退出：报的行可能有几十条，接管道时硬退出会把还没写出去的
 * 截掉（`mutate-rule.ts` 的 `exitRace` 记着的那个坑）。
 */
import { readFileSync } from 'node:fs'
import { type AnchorFault, anchorCatalog, anchorVerdict } from './mutate-rule.js'

const CATALOG = 'scripts/check/mutations.json'
type Mut = { id: string; file: string; find: string; replace: string }

const read = (file: string): string | undefined => { try { return readFileSync(file, 'utf8') } catch { return undefined } }
const catalog = ((): Mut[] | undefined => {
  try { return anchorCatalog(JSON.parse(readFileSync(CATALOG, 'utf8'))) } catch { return undefined }
})()

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
  } else if (verdict.faults.length === 0) {
    console.log(`✓ 变异锚点：${catalog.length} 条变异的锚点各在目标文件里恰好一处，树上没有没还原的变异`)
  } else {
    const { faults, advice } = verdict
    const out = [`✗ 变异锚点：${faults.length} 条变异对不上目标文件\n`]
    for (const f of faults) {
      const count = f.kind === 'ambiguous' ? `（${f.count} 处）` : ''
      const knock = f.knockOn ? '（这个文件里有一处可能没还原的，先撤那一处再看这一条）' : ''
      out.push(`  ${f.id}  ${f.file}：${SAY[f.kind]}${count}${knock}`)
    }
    if (advice.diff) {
      out.push('\n  没还原或分不开的：先用 git diff HEAD 看那个文件再动手（暂存了的也看得见）。是没还原的（多半是上一次变异跑被打断，'
        + '或者 --jobs=1 正跑着的时候动了树），只撤那一处 —— 整个文件 git checkout 会把别的改动一起按回去（ADR-70 第 2099 行）。'
        + 'diff 里看不到那一处的（空的，或者只有你自己的改动），那处可能已经提交了：先 git log -p 那个文件，找出那次提交里的那一处再撤；'
        + '历史里也找不到，才是锚点失效：改那条变异的 file 与 find，跟上现在的代码。')
    }
    if (advice.catalog) {
      out.push('\n  锚点失效、不唯一、读不到的：改那条变异的 file 与 find，跟上现在的代码。')
    }
    console.error(out.join('\n'))
    process.exitCode = 1
  }
}
