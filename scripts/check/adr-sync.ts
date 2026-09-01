#!/usr/bin/env tsx
/**
 * 决策记录:一条一个文件,索引由本脚本生成。
 *
 * 检查:  tsx scripts/check/adr-sync.ts
 * 回写:  tsx scripts/check/adr-sync.ts --write
 * 迁移:  tsx scripts/check/adr-sync.ts --split   ← 把还装在 DECISIONS.md 里的记录拆成文件
 *
 * `--split` 是给在途分支用的:它们各自往 `DECISIONS.md` 里写了上千行,
 * 跑一次就地拆开,不必手工搬。**幂等**:没有可拆的就什么都不做。
 *
 * ⚠️ 证不了记录写得对。它保证的是编号唯一、文件名与正文一致、索引不漂移。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  type Adr, type Baseline, FILE_RE, HEAD_RE, checkAll, checkAppendOnly, fileNameOf, renderIndex,
} from './adr-rule.js'
import { endsOpen, quotedMask } from './quoted.js'

const DIR = 'docs/adr'
const INDEX = join(DIR, 'README.md')
const LEGACY = 'DECISIONS.md'
const BEGIN = '<!-- BEGIN:GENERATED 由 npm run adr 生成，勿手改 -->'
const END = '<!-- END:GENERATED -->'
/**
 * 整册里的记录标题。**两级都认**:`##` 是旧整册的写法,`#` 是拆开后单文件的写法。
 *
 * 只认 `##` 的话,一条照**新**格式误写进转发页的记录会溜过去 —— 它既不在
 * `docs/adr/`,也不在索引里,而检查是绿的。
 */
const RECORD_HEADING = /^#{1,2}\s+ADR-(\d+)\s+(.+?)\s*$/

// ── 迁移 ────────────────────────────────────────────────────────
if (process.argv.includes('--split')) {
  const src = existsSync(LEGACY) ? readFileSync(LEGACY, 'utf8') : ''
  /**
   * 分节只认**引文之外**的 `## ADR-NN`(围栏块、HTML 注释都算引文)。
   *
   * 一条记录的正文里完全可能有围栏示例写着 `## ADR-59 …`(这个仓库的记录就爱举例)。
   * 不看围栏地切下去,会把原记录拦腰截断、再写出一个假记录 —— 迁移动的是决策历史
   * 本身,这种错不可逆。
   */
  const lines = src.split('\n')
  const mask = quotedMask(src)
  const starts = lines.map((l, i) => (!mask[i] && RECORD_HEADING.test(l) ? i : -1)).filter(i => i >= 0)
  const body = starts.map((start, k) =>
    lines.slice(start, starts[k + 1] ?? lines.length).join('\n'))

  /**
   * 兜底:切出来的每一段都必须是**自足**的 —— 没有没关上的围栏、注释或 HTML 块。
   *
   * 一刀切在引文中间,那一段必然带着一个没关上的构造。这条判断与引文的形态无关,
   * 所以哪怕遮罩漏了某种写法(它只是近似,不是完整的 Markdown 解析器),
   * 结果也是**拒绝写**,而不是写出一份被截断的记录。
   */
  const broken = body.filter(sec => endsOpen(sec))
  if (broken.length) {
    console.error(`✗ 决策记录：${broken.length} 段切出来是残的（有没关上的围栏/注释/HTML 块）\n`)
    for (const b of broken) console.error(`  · ${b.split('\n')[0]}`)
    console.error('\n  多半是某个 `## ADR-` 出现在引文里、被当成了分节。')
    console.error('  一个字都没写 —— `DECISIONS.md` 原样未动,先看那几段。')
    process.exit(1)
  }
  if (!body.length) { console.log('✓ 决策记录：没有可拆的整册内容'); process.exit(0) }
  mkdirSync(DIR, { recursive: true })
  /**
   * **既有文件内容不同时拒绝覆盖。**
   *
   * 这个迁移器是给还装着整册的在途分支用的，而那些分支迟早要先合一次主干 ——
   * 于是盘上会同时有主干带来的 `docs/adr/ADR-NN-….md` 和分支自己那份整册里的
   * 同号记录。无条件写下去，就是用分支上那份（可能是旧的）静默盖掉主干的裁决，
   * 而后面的撞号与文件名检查只看得到一个文件，一路全绿 ——
   * **恰好把这次拆分本来要暴露的并发抢号变成了数据丢失。**
   *
   * 内容一致时照写不误，`--split` 的幂等不受影响。
   */
  const clashes: string[] = []
  const written: string[] = []
  for (const sec of body) {
    const m = RECORD_HEADING.exec(sec.split('\n')[0])!
    const [num, title] = [Number(m[1]), m[2].trim()]
    const text = sec.split('\n').slice(1).join('\n').replace(/\n+---\s*$/, '').trim()
    const file = join(DIR, fileNameOf(num, title))
    const content = `# ADR-${m[1]} ${title}\n\n${text}\n`
    if (existsSync(file) && readFileSync(file, 'utf8') !== content) {
      clashes.push(`ADR-${m[1]} 已存在于 ${file}，内容与整册里的这一条不同`)
      continue
    }
    writeFileSync(file, content, 'utf8')
    written.push(file)
  }
  /**
   * 写完回头问一次目录:**盘上的名字必须和算出来的名字逐字相同**。
   *
   * `fileNameOf` 算出来的名字要过一趟文件系统的编解码,而那一趟不保证原样返回 ——
   * 半个代理对会被换成 `�`,某些文件系统还会顺手把名字归一化。任何一种情况下,
   * 后面 `npm run adr` 读目录读到的都是另一个名字,于是它判**这次拆分刚写出来的
   * 文件**「文件名与正文不符」,而那时候报错的位置离出错的位置隔着一整条命令。
   *
   * 与其枚举「哪些名字过不了这一趟」,不如写完直接问一次 —— 这道兜底与成因无关,
   * 今天挡的是代理对,明天 slugify 放宽了、或者换个文件系统,挡的还是它。
   */
  const onDisk = new Set(readdirSync(DIR))
  const mangled = written.filter(f => !onDisk.has(basename(f)))
  if (mangled.length) {
    console.error(`✗ 决策记录：${mangled.length} 条写出来的文件名被文件系统改写了\n`)
    for (const f of mangled) console.error(`  · 想写 ${basename(f)}`)
    console.error('\n  文件已经在盘上，但名字不是这个 —— `npm run adr` 会判它文件名与正文不符。')
    console.error('  多半是标题里有半个代理对一类的东西：换个写法，或先手工把这几个文件删掉重来。')
    process.exit(1)
  }
  if (clashes.length) {
    console.error(`✗ 决策记录：${clashes.length} 条拒绝覆盖（其余 ${written.length} 条已写出）\n`)
    for (const c of clashes) console.error(`  · ${c}`)
    console.error('\n  两份内容都要保留：给其中一条换一个没用过的编号，或把两条合成一条。')
    console.error('  **不要删掉任何一条** —— 编号不可回收，撞号本身就是这次拆分要暴露的东西。')
    process.exit(1)
  }
  console.log(`✓ 决策记录：${written.length} 条已拆成文件，preamble 与转发页需手工确认`)
  process.exit(0)
}

// ── 读 ──────────────────────────────────────────────────────────
if (!existsSync(DIR)) { console.error(`✗ 决策记录：缺少 ${DIR}/`); process.exit(1) }

const errors: string[] = []
const adrs: Adr[] = []
for (const file of readdirSync(DIR).sort()) {
  if (file === 'README.md') continue
  const m = FILE_RE.exec(file)
  if (!m) { errors.push(`${file} 文件名不合格式，应为 ADR-<编号>-<标题>.md`); continue }
  const first = readFileSync(join(DIR, file), 'utf8').split('\n')[0]
  const h = HEAD_RE.exec(first)
  if (!h) { errors.push(`${file} 第一行不是 \`# ADR-<编号> <标题>\``); continue }
  adrs.push({ file, num: Number(h[1]), title: h[2] })
}
errors.push(...checkAll(adrs))

/**
 * 编号不可回收，要对着主干查 —— 只看当前目录的话，删掉一条再把号让给别的决策，
 * 检查是全绿的。基线取不到时**说取不到并失败**，不当作「没有删过」。
 *
 * HEAD 就在主干上时，`merge-base` 就是 HEAD 自己 —— 那等于拿改完之后的目录
 * 当自己的基线，一次直推主干的删除会因为「前后一模一样」而通过。这时退回
 * 上一版比。这里**不像体量闸门那样只报数**：少一条决策记录是永久的损失，
 * 而报红不会让主干「变坏」，只会让人立刻发现。
 */
function trunkAdrs(): Map<number, Baseline> {
  const g = (...a: string[]) => {
    // `-c core.quotePath=false`:git 默认转义非 ASCII 路径，而这个仓库的文件名几乎全是中文。
    // 同一个坑栽过三次，所以放在调用入口一次性关掉，不在每个调用点各补一遍。
    try {
      return execFileSync('git', ['-c', 'core.quotePath=false', ...a],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    }
    catch { return null }
  }
  const trunk = ['origin/main', 'main'].find(r => g('rev-parse', '--verify', `${r}^{commit}`))
  const merged = trunk && g('merge-base', trunk, 'HEAD')
  const head = g('rev-parse', 'HEAD')
  /**
   * HEAD 就在主干上时要退回**整次推送之前**，不是退回 `HEAD^1`。
   *
   * 一次推多个提交时，删除可能发生在靠前那个提交里 —— `HEAD^1` 已经包含了删除，
   * 前后两张表一模一样，检查照样放行。GitHub 的 push 事件带着推送前的 SHA
   * （`github.event.before`），工作流把它传成 `GIT_PUSH_BEFORE`。
   *
   * 取不到就退回 `HEAD^1`：**它比什么都不比强**，但挡不住上面那种多提交推送。
   * 这是一处显式缺口，不假装它被守住了。
   */
  const pushBefore = process.env.GIT_PUSH_BEFORE
  const before = pushBefore && g('rev-parse', '--verify', `${pushBefore}^{commit}`)
  const base = merged === head ? (before ?? g('rev-parse', `${head}^1`)) : merged
  if (!merged) {
    console.error('✗ 决策记录：无从核对「编号不可回收」—— 找不到主干基线\n')
    console.error('  CI 里给 actions/checkout 加 `fetch-depth: 0`；本地先 `git fetch origin main`。')
    console.error('  不当作「没有删过」：一个永远不会失败的检查等于没有检查。')
    process.exit(1)
  }
  if (!base) return new Map()   // 主干上的第一个提交，没有上一版可比

  const out = new Map<number, Baseline>()
  for (const p of (g('ls-tree', '--name-only', '-z', base, `${DIR}/`) ?? '').split('\0')) {
    const name = p.split('/').pop() ?? ''
    if (!FILE_RE.test(name)) continue
    // 标题以**正文第一行**为准。文件名过了 slugify，是有损的。
    const h = HEAD_RE.exec((g('show', `${base}:${p}`) ?? '').split('\n')[0])
    if (h) out.set(Number(h[1]), { file: name, title: h[2] })
  }
  return out
}
errors.push(...checkAppendOnly(trunkAdrs(), adrs))

/** 拆开之后 `DECISIONS.md` 只做转发。写回整册就是把冲突面又装回去。 */
if (existsSync(LEGACY)) {
  const src = readFileSync(LEGACY, 'utf8')
  const mask = quotedMask(src)
  // 引文里的示例不算 —— 转发页本来就要举例说明记录长什么样
  const found = src.split('\n').some((l, i) => !mask[i] && RECORD_HEADING.test(l))
  if (found) {
    errors.push(`${LEGACY} 里又出现了记录标题(\`# ADR-\` 或 \`## ADR-\`)`
      + ` —— 记录写进 ${DIR}/，跑 \`npm run adr -- --split\``)
  }
}

// ── 索引 ────────────────────────────────────────────────────────
const index = existsSync(INDEX) ? readFileSync(INDEX, 'utf8') : ''
const i = index.indexOf(BEGIN)
const j = index.indexOf(END)
if (i < 0 || j < 0) errors.push(`${INDEX} 缺少 BEGIN/END 标记`)

if (errors.length) {
  console.error(`✗ 决策记录：${errors.length} 项\n`)
  for (const e of errors) console.error(`  · ${e}`)
  process.exit(1)
}

const want = `${BEGIN}\n\n${renderIndex(adrs)}${END}`
if (process.argv.includes('--write')) {
  writeFileSync(INDEX, index.slice(0, i) + want + index.slice(j + END.length), 'utf8')
  console.log('✓ 决策记录：索引已回写')
  process.exit(0)
}
if (index.slice(i, j + END.length) !== want) {
  console.error(`✗ 决策记录：${INDEX} 的索引与目录不一致`)
  console.error('  跑 `npm run adr -- --write` 回写')
  process.exit(1)
}

const nums = adrs.map(a => a.num).sort((a, b) => a - b)
console.log(`✓ 决策记录：${adrs.length} 条，编号 ${nums[0]}–${nums[nums.length - 1]}，索引一致`)
