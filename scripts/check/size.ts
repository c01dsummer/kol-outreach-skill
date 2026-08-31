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
  BUDGET, CATEGORIES, type CommitDelta, judge, parseNumstat, tally,
} from './size-rule.js'

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

const files = parseNumstat(git('diff', '--numstat', '-z', base, head))
const counts = tally(files)

/**
 * 每个提交各自量一次 —— 判断某一类的豁免写下之后有没有又被追加。
 *
 * **合并提交按 0 计。** 它不产出新行,只是把已有的行放到一起,相对第一父的
 * 「新增」其实是另一侧早就存在的内容。按新增算的话有两个后果,都是错的:
 *
 * - PR 事件下 CI 检出的是 `refs/pull/N/merge`,那个合并提交永远排在最后、
 *   永远「新增」了全部内容 —— **任何豁免都永远是过期的**(实测撞上了)
 * - `6-INTEGRATE.md` 自己推荐「要同步主干就 merge 进来」,而合一次主干
 *   就会让所有豁免失效
 *
 * 总数不受影响:它来自 `base..head` 的整体 diff,合并里真夹带的东西照样算进去。
 * 这里只是不让「合并」这个动作把豁免顶掉。
 */
const commits: CommitDelta[] = git('rev-list', '--reverse', `${base}..${head}`)
  .split('\n').filter(Boolean)
  .map(sha => {
    const isMerge = (git('rev-list', '--parents', '-n1', sha).split(' ').length - 1) > 1
    return {
      message: git('log', '-1', '--format=%B', sha),
      counts: isMerge
        ? { 源码: 0, 测试: 0, 文档: 0, 其他: 0 }
        : tally(parseNumstat(git('diff', '--numstat', '-z', `${sha}^1`, sha))),
    }
  })

const report = judge(counts, commits)

// ── 报 ──────────────────────────────────────────────────────────

const scope = onTrunk ? `${trunk} 的上一版` : trunk
console.log(`\n体量闸门 · 相对 ${scope}(${base.slice(0, 7)}..${head.slice(0, 7)},${commits.length} 个提交,${files.length} 个文件)\n`)
for (const c of CATEGORIES) {
  const n = counts[c]
  const b = BUDGET[c]
  const flag = n <= b ? '✓'
    : report.waived.some(w => w.category === c) ? '⊘'
    : '✗'
  console.log(`  ${flag} ${c}  ${String(n).padStart(5)} / ${b} 行新增`)
}
console.log('\n  图例:✓ 在线内  ⊘ 超线但已具名豁免  ✗ 超线')
console.log('  (只数新增行;纯改名不计;未提交的工作区不计)')

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

for (const st of report.stale) {
  console.error(`\n✗ ${st.category} ${st.added} 行新增,超出 ${st.budget} —— 豁免已过期`)
  console.error(`    ${st.note}`)
  console.error('    豁免说明的是当时那些行,不是一张长期通行证。重新写一条。')
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

/** 「超线但已豁免」和「在线内」是两回事。压成同一句话,正是这套方法要防的三态压两态。 */
console.log(report.waived.length
  ? `\n✓ 体量闸门:${report.waived.length} 类超线但已具名豁免,其余在线内`
  : '\n✓ 体量闸门:各类均在线内')
