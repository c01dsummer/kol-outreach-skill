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
import { BUDGET, CATEGORIES, collectExemptions, judge, parseNumstat, tally } from './size-rule.js'

const TRUNK_CANDIDATES = ['origin/main', 'main']

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
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

const base = tryGit('merge-base', trunk, 'HEAD')
if (!base) cannotAnswer(`HEAD 与 ${trunk} 没有共同祖先`, '确认这条分支确实从主干长出来。')

if (base === head) {
  console.log(`✓ 体量闸门:不适用 —— HEAD 是 ${trunk} 的祖先或就是它本身`)
  process.exit(0)
}

// ── 量 ──────────────────────────────────────────────────────────

const files = parseNumstat(git('diff', '--numstat', '-z', '--no-renames', base, head))
const counts = tally(files)
const messages = git('log', '--format=%B%x00', `${base}..${head}`).split('\0')
const report = judge(counts, collectExemptions(messages))

// ── 报 ──────────────────────────────────────────────────────────

const commits = git('rev-list', '--count', `${base}..${head}`)
console.log(`\n体量闸门 · 相对 ${trunk}(${base.slice(0, 7)}..${head.slice(0, 7)},${commits} 个提交,${files.length} 个文件)\n`)
for (const c of CATEGORIES) {
  const n = counts[c]
  const b = BUDGET[c]
  const flag = n > b ? (report.waived.some(w => w.category === c) ? '⊘' : '✗') : '✓'
  console.log(`  ${flag} ${c}  ${String(n).padStart(5)} / ${b} 行新增`)
}
console.log('\n  图例:✓ 在线内  ⊘ 超线但已具名豁免  ✗ 超线\n  (只数新增行;未提交的工作区不计)')

for (const w of report.waived) {
  console.log(`\n  ⊘ ${w.category} ${w.added} 行,超 ${w.budget} —— 已豁免:${w.exemptedBy}`)
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
  console.error('  确有必要时,在提交信息里写 `size-ok: <类别> <理由>` —— 见 process/6-INTEGRATE.md。')
  process.exit(1)
}

/** 「超线但已豁免」和「在线内」是两回事。压成同一句话，正是这套方法要防的三态压两态。 */
console.log(report.waived.length
  ? `\n✓ 体量闸门:${report.waived.length} 类超线但已具名豁免,其余在线内`
  : '\n✓ 体量闸门:各类均在线内')
