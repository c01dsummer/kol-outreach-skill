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
  BUDGET, CATEGORIES, type Category, type CommitDelta, type FileDelta,
  judge, parseNumstat, tally,
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
 * 合并提交量的是**两个父都没有的那些行**(合并 diff 里的 `++`),也就是解决
 * 冲突时真写下的内容。试过两种更省事的做法,都不对:
 *
 * - **按第一父计**:相对第一父的「新增」其实是另一侧早就存在、已经各自被计过的
 *   内容。PR 事件下 CI 检出的是 `refs/pull/N/merge`,那个合并提交永远排在最后、
 *   永远「新增」全部内容 —— **任何豁免都永远过期**(实测撞上了);而
 *   `6-INTEGRATE.md` 推荐的「要同步主干就 merge 进来」也会让所有豁免失效
 * - **一律按 0**:解决冲突时**新写**的代码两边都没有,却因此不刷新 `lastAdd`,
 *   一条旧豁免会盖住一批它从没覆盖过的行
 * - **各父 diff 的逐类最小值**:主干那侧真带进新文件时最小值就不是 0 了,
 *   一次干净的合并主干照样把豁免顶掉(实测)
 *
 * `--cc --numstat` 也不能用 —— 实测无冲突的普通合并也报 1/1,`--numstat`
 * 没有按合并 diff 的语义走。只有 patch 输出是准的。
 *
 * 总数不受影响:它来自 `base..head` 的整体 diff。
 */
function mergeCounts(sha: string, parents: number): Record<Category, number> {
  const marker = '+'.repeat(parents)
  const files: FileDelta[] = []
  let path = ''
  let inHunk = false
  for (const line of git('show', '--cc', '--format=', sha).split('\n')) {
    const d = /^diff --cc (.+)$/.exec(line)
    if (d) { path = d[1]; inHunk = false; files.push({ path, added: 0 }); continue }
    if (line.startsWith('@@')) { inHunk = true; continue }
    // 必须先进到 hunk 里才数 —— 否则 `+++ b/<路径>` 这行文件头会被当成新增
    if (inHunk && line.startsWith(marker)) files[files.length - 1].added++
  }
  return tally(files)
}

function countsOf(sha: string): Record<Category, number> {
  const parents = git('rev-list', '--parents', '-n1', sha).split(' ').length - 1
  return parents > 1
    ? mergeCounts(sha, parents)
    : tally(parseNumstat(git('show', '--numstat', '-z', '--format=', sha)))
}

const commits: CommitDelta[] = git('rev-list', '--reverse', `${base}..${head}`)
  .split('\n').filter(Boolean)
  .map(sha => ({ message: git('log', '-1', '--format=%B', sha), counts: countsOf(sha) }))

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
