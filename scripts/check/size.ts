#!/usr/bin/env tsx
/**
 * 体量闸门 —— 把「一个改动 = 一个能一次读完的 diff」变成能报错的检查。
 *
 * 量的是**分支相对主干的全部新增行**,不是单个提交。理由:评审、冲突、
 * 线程失效这些成本都按合并单元结算,按提交结算会得到一个永远合格的漂亮数字。
 *
 * ⚠️ 这个检查**证不了改动是不是一件事**。什么东西能在事实不成立时也让它通过?
 *    一个 340 行、但同时改了三件互不相干的事的分支。
 *    所以它保证的是**上限**,不是内聚 —— 后者仍在 `process/README.md` 第三层。
 *
 * 阈值按本仓库已合并 PR 校准,见 `scripts/check/size-rule.ts`。
 */
import { execFileSync } from 'node:child_process'
import {
  BUDGET, CATEGORIES, GIT_CONFIG, NUMSTAT, NUMSTAT_IGNORING_SPACE, type Waiver,
  discount, judge, merge, parseNumstat, scanMessage, tally,
} from './size-rule.js'

const TRUNK_CANDIDATES = ['origin/main', 'main']

/**
 * 所有 git 调用统一走这里,**一律带上 `GIT_CONFIG` 里钉死的那几项**。
 *
 * 逐处补是补不完的:`core.quotePath` 这个坑在这里栽过三次(`diff --numstat`
 * 文档整类被误归、`ls-tree` 基线读成空的、`show --cc` 决策记录归进「其他」),
 * 前两次都是逐处加参数补的,所以第三次照样中招 —— 一条只写在提交信息里的教训
 * 挡不住下一个调用点。放在入口才是结构保证(`docs/CONVENTIONS.md`:
 * 能靠结构保证的,就别靠对比保证)。
 *
 * **钉哪几项是判定,不是调用细节**,所以清单在 `size-rule.ts`(第十节逐字写着
 * 「哪些行算新增」那一半也是判定),那里有一个真 git 仓库的夹具守着它。
 */
function git(...args: string[]): string {
  return execFileSync('git', [...GIT_CONFIG, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function tryGit(...args: string[]): string | null {
  try { return git(...args) } catch { return null }
}

/** 无从判断时说「无从判断」并失败,不退化成「0 行,通过」。 */
function cannotAnswer(why: string, how: string): never {
  console.error(`✗ 体量闸门:无从判断 —— ${why}\n`)
  console.error(`  ${how}\n`)
  console.error('  不退化成「0 行,通过」:一个永远不会失败的检查等于没有检查')
  console.error('  (process/4-VERIFY.md)。')
  process.exit(1)
}

const head = tryGit('rev-parse', 'HEAD')
if (!head) cannotAnswer('这里不是一个 git 仓库,或者没有任何提交', '在仓库里跑。')

if (tryGit('rev-parse', '--is-shallow-repository') === 'true') {
  cannotAnswer(
    '这是一个浅克隆,算出来的基线不可信',
    'CI 里给 actions/checkout 加 `with: { fetch-depth: 0 }`;本地跑 `git fetch --unshallow`。')
}

const trunk = TRUNK_CANDIDATES.find(r => tryGit('rev-parse', '--verify', `${r}^{commit}`))
if (!trunk) {
  cannotAnswer(
    `找不到主干引用(试过 ${TRUNK_CANDIDATES.join('、')})`,
    '先 `git fetch origin main`。')
}

const merged = tryGit('merge-base', trunk, 'HEAD')
if (!merged) cannotAnswer(`HEAD 与 ${trunk} 没有共同祖先`, '确认这条分支确实从主干长出来。')

/**
 * HEAD 就在主干上时**照样量,但不判定**。
 *
 * 这时 `merge-base` 就是 HEAD 自己,没有「相对主干的改动」这回事。早先这里直接
 * 退 0,于是一次直推主干的大改动连数字都不会出现 —— 那是静默通过。
 *
 * 现在退回上一版比,把数字打出来。**但不失败**:这个闸门守的是「一个待评审的
 * 改动读不读得完」,而 CI 跑在推送**之后**,这时判红只能让主干变红,
 * 而主干红了是这套方法最要避免的事。真要拦住直推主干,那是分支保护的活,
 * 不是一个事后才跑的检查。
 */
const onTrunk = merged === head
const base = onTrunk ? tryGit('rev-parse', `${head}^1`) : merged
if (!base) {
  console.log(`✓ 体量闸门:不适用 —— HEAD 就是 ${trunk} 且没有父提交`)
  process.exit(0)
}

// ── 量 ──────────────────────────────────────────────────────────

/**
 * 量两遍:一遍照实,一遍忽略行内空白。
 *
 * **文件清单取照实那一遍** —— 只改了空白的文件在另一遍里整个消失,拿它报
 * 「N 个文件」会少报,而那句话该是真的。**计数取合并后的**(`merge`:吃折扣的
 * 按忽略空白那遍,其余照实)。两个 `tally` 之差就是折掉的行数,下面逐类打出来。
 */
const files = parseNumstat(git(...NUMSTAT, base, head))
const plain = tally(files)
const counts = tally(merge(files, parseNumstat(git(...NUMSTAT_IGNORING_SPACE, base, head))))
const folded = discount(plain, counts)

/**
 * 每条具名豁免,连同**它写下之后最终 diff 里这一类还净增了多少**。
 *
 * 树对树:`总数 - 豁免那一刻相对同一基线的数`。不看提交顺序、不看合并形状、
 * 不看时间戳 —— 那条路走了四版都不对,理由记在 `size-rule.ts` 的 `Waiver` 上。
 *
 * 顺带:一条豁免只要一次 `git diff`,比原来每个提交各量一次便宜得多。
 */
const waivers: Waiver[] = []
const unjustified: string[] = []
for (const sha of git('rev-list', `${base}..${head}`).split('\n').filter(Boolean)) {
  const found = scanMessage(git('log', '-1', '--format=%B', sha))
  if (!found.length) continue
  for (const v of found) {
    if (v.kind === 'unjustified') { unjustified.push(v.text); continue }
    waivers.push({ category: v.category, reason: v.reason })
  }
}

const report = judge(counts, waivers, unjustified)


// ── 报 ──────────────────────────────────────────────────────────

const scope = onTrunk ? `${trunk} 的上一版` : trunk
const nCommits = git('rev-list', '--count', `${base}..${head}`)
console.log(`\n体量闸门 · 相对 ${scope}(${base.slice(0, 7)}..${head.slice(0, 7)},${nCommits} 个提交,${files.length} 个文件)\n`)
for (const c of CATEGORIES) {
  const n = counts[c]
  const b = BUDGET[c]
  const flag = n <= b ? '✓'
    : report.waived.some(w => w.category === c) ? '⊘'
    : '✗'
  console.log(`  ${flag} ${c}  ${String(n).padStart(5)} / ${b} 行新增`)
}
console.log('\n  图例:✓ 在线内  ⊘ 超线但已具名豁免  ✗ 超线')
console.log('  (按内容量收费,不按搬运量:只数新增行;纯改名不计;未提交的工作区不计)')
console.log(`  折掉的行:${CATEGORIES.map(c => `${c} ${folded[c]}`).join(' · ')}`)
console.log('  —— 只改行内空白的行不计,今天只对 `.ts` 生效(ADR-98)。')
console.log('  注意折扣与改名互斥:挪个位置同时重排缩进,两个折扣都吃不到。')

if (onTrunk) {
  console.log('\n✓ 体量闸门:HEAD 就在主干上,**只报数不判定**')
  console.log('  这个闸门守的是待评审的改动;CI 跑在推送之后,这时判红只会让主干变红。')
  console.log('  拦住直推主干是分支保护的活 —— 这是一处显式缺口,不假装它被守住了。')
  process.exit(0)
}

for (const w of report.waived) {
  console.log(`\n  ⊘ ${w.category} ${w.added} 行,超 ${w.budget} —— 已具名豁免`)
}

if (report.unjustified.length) {
  console.error(`\n✗ ${report.unjustified.length} 条 size-ok 不成立:`)
  for (const t of report.unjustified) console.error(`    size-ok: ${t}`)
  console.error('    格式是 `size-ok: <类别> <理由>`,类别必须指名,理由必填。')
}

for (const o of report.over) {
  console.error(`\n✗ ${o.category} ${o.added} 行新增,超出 ${o.budget}`)
}

if (!report.ok) {
  console.error('\n  先问:这条分支能不能按「验收证据」切成两个?')
  console.error('  两段代码要写两种不同的证据来证明它们对,它们就是两个改动。')
  console.error('  确有必要时,在提交信息**最后一段**写 `size-ok: <类别> <理由>`')
  console.error('  (和 `Co-Authored-By:` 同一段;正文里的不算)—— 见 process/6-INTEGRATE.md。')
  process.exit(1)
}

/** 「超线但已豁免」和「在线内」是两回事。压成同一句话,正是这套方法要防的三态压两态。 */
console.log(report.waived.length
  ? `\n✓ 体量闸门:${report.waived.length} 类超线但已具名豁免,其余在线内`
  : '\n✓ 体量闸门:各类均在线内')
