#!/usr/bin/env tsx
/**
 * 变异锚点对着当前树 —— 检查链的第一步（ADR-70 末尾「变异残留」一节，第二片）。
 *
 * 读变异目录与每条变异的目标文件，交给 `mutate-rule.ts` 的 `anchorFaults`，照它交回的逐条说人话，
 * 有一条就以 1 退出。判定全在 `anchorFaults`，这里只读文件、说人话、设退出码（`docs/CONVENTIONS.md` 第 10 条）。
 *
 * **排在最前面**：一处变异没还原、躺在树里时，后面每一步跑的都是被改过的源码，报出来的却是别的事 ——
 * 需求测试红在某条断言上，或者变异一步十几分钟后才说那一条「锚点失效」。也为了提交之前单跑
 * `npm run anchors` 就查得到：不起验证者、不碰 git，一两秒。
 *
 * 它拦不住「变异正在跑、恰好在那一刻提交」那个窗口（要一把锁，ADR-70 第 1399–1400 行）；派工跑时变异施加在
 * 隔离目录里，树上本来就不会有，会躺在树上的只有串行那条路（`--jobs=1`、单核、只剩一条）和被打断没还原的。
 *
 * 读不到的目标文件交 `undefined`，由判定报成一处，不当成空文件。变异目录本身读不到、读不出一组变异时
 * 也以 1 退出：没得核不是核过了。设退出码、不硬退出：报的行可能有几十条，接管道时硬退出会把还没写出去的
 * 截掉（`mutate-rule.ts` 的 `exitRace` 记着的那个坑）。
 */
import { readFileSync } from 'node:fs'
import { type AnchorFault, anchorFaults } from './mutate-rule.js'

const CATALOG = 'scripts/check/mutations.json'
type Mut = { id: string; file: string; find: string; replace: string }

const read = (file: string): string | undefined => { try { return readFileSync(file, 'utf8') } catch { return undefined } }
const catalog = ((): Mut[] | undefined => {
  try {
    const muts: unknown = JSON.parse(readFileSync(CATALOG, 'utf8')).mutations
    return Array.isArray(muts) ? muts as Mut[] : undefined
  } catch { return undefined }
})()

if (catalog === undefined) {
  console.error(`✗ 变异锚点：${CATALOG} 读不到，或读不出一组变异 —— 没得核不是核过了`)
  process.exitCode = 1
} else {
  const faults = anchorFaults(catalog, read)
  if (faults.length === 0) {
    console.log(`✓ 变异锚点：${catalog.length} 条变异的锚点各在目标文件里恰好一处，树上没有没还原的变异`)
  } else {
    const byId = new Map(catalog.map(m => [m.id, m]))
    const say = (f: AnchorFault): string => {
      if (f.kind === 'ambiguous') return `锚点出现 ${f.count} 处，要恰好一处 —— 替换只改第一处`
      if (f.kind === 'stale') return '锚点失效 —— find 一处都没有'
      if (f.kind === 'unreadable') return '目标文件读不到'
      return byId.get(f.id)?.replace === ''
        ? '像是没还原 —— find 一处都没有；这条是删一段的，锚点失效也是这个样子'
        : '像是没还原 —— 文件里是这条变异施加之后的样子'
    }
    // 一处没还原的变异会连带同一个文件里别的锚点：它改掉的那段要是别的变异的 find，那一条就跟着失效
    // （真树上施加 M-D6-d，M-P1-u 就跟着报失效）。这种照「改那条变异的 find」去改就改错了，所以单说一句
    const residueFiles = new Set(faults.filter(f => f.kind === 'residue').map(f => f.file))
    const out = [`✗ 变异锚点：${faults.length} 条变异对不上目标文件\n`]
    for (const f of faults) {
      const knock = f.kind !== 'residue' && residueFiles.has(f.file) ? '（这个文件里有没还原的变异，先撤那一处再看这一条）' : ''
      out.push(`  ${f.id}  ${f.file}：${say(f)}${knock}`)
    }
    if (faults.some(f => f.kind === 'residue')) {
      out.push('\n  没还原的：多半是上一次变异跑被打断，或者 --jobs=1 正跑着的时候动了树。用 git diff 看那个文件，'
        + '只撤那一处 —— 整个文件 git checkout 会把别的改动一起按回去（ADR-70 第 2099 行）。')
    }
    if (faults.some(f => f.kind !== 'residue')) {
      out.push('\n  锚点失效、不唯一、读不到的：改那条变异的 file 与 find，跟上现在的代码。')
    }
    console.error(out.join('\n'))
    process.exitCode = 1
  }
}
