#!/usr/bin/env tsx
/**
 * 分支寿命闸门 —— 把「分支活不过 48 小时」从自觉变成能报错的检查。
 *
 * 这条纪律有真实战绩:三条在途分支各自分叉四天多、彼此 92% 相同、都碰同一批
 * 文件,而这期间**没有任何东西说过一句话**。体量闸门管得住「一次改动多大」,
 * 管不住「一条分支开多久」——后者才是让三条分支互相重写同一批文件的那一个。
 *
 * 判定与阈值校准见 `scripts/check/age-rule.ts`。
 */
import { execFileSync } from 'node:child_process'
import { LIMIT_HOURS, judgeAge, scanAgeWaiver } from './age-rule.js'

const TRUNK_CANDIDATES = ['origin/main', 'main']

function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function tryGit(...args: string[]): string | null {
  try { return git(...args) } catch { return null }
}

/** 无从判断时说「无从判断」并失败,不退化成「0 小时,通过」。 */
function cannotAnswer(why: string, how: string): never {
  console.error(`✗ 分支寿命:无从判断 —— ${why}\n`)
  console.error(`  ${how}\n`)
  console.error('  不退化成「0 小时,通过」:一个永远不会失败的检查等于没有检查')
  console.error('  (process/4-VERIFY.md)。')
  process.exit(1)
}

const head = tryGit('rev-parse', 'HEAD')
if (!head) cannotAnswer('这里不是一个 git 仓库,或者没有任何提交', '在仓库里跑。')

if (tryGit('rev-parse', '--is-shallow-repository') === 'true') {
  cannotAnswer(
    '这是一个浅克隆,算出来的分叉点不可信',
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

/** HEAD 就在主干上时不适用:主干没有「分叉」这回事。 */
if (merged === head) {
  console.log(`✓ 分支寿命:不适用 —— HEAD 就在 ${trunk} 上`)
  process.exit(0)
}

// ── 量 ──────────────────────────────────────────────────────────

const commits = git('rev-list', '--reverse', `${merged}..${head}`).split('\n').filter(Boolean)
if (!commits.length) {
  console.log(`✓ 分支寿命:不适用 —— 相对 ${trunk} 没有自己的提交`)
  process.exit(0)
}

/**
 * 最早那个提交的**作者时间**。用作者时间不用提交时间的理由见 `age-rule.ts`:
 * 提交时间被 rebase 重写,拿它计时等于留了一条「rebase 一下就免检」的通道。
 */
const oldest = commits[0]
const since = new Date(git('log', '-1', '--format=%aI', oldest))
const hours = (Date.now() - since.getTime()) / 3_600_000

/** 豁免只要分支上任一条提交写了就算,理由见 `age-rule.ts`(不设新鲜度)。 */
let waiver: string | null = null
for (const sha of commits) {
  waiver ??= scanAgeWaiver(git('log', '-1', '--format=%B', sha))
}

const verdict = judgeAge(hours, waiver)

// ── 报 ──────────────────────────────────────────────────────────

const flag = verdict.kind === 'ok' ? '✓' : verdict.kind === 'waived' ? '⊘' : '✗'
console.log(`\n分支寿命 · 相对 ${trunk}\n`)
console.log(`  ${flag} 分叉 ${hours.toFixed(1)} / ${LIMIT_HOURS} 小时`
  + `,${commits.length} 个提交,自 ${git('log', '-1', '--format=%aI', oldest).slice(0, 16)}`)
console.log(`      最早的提交:${oldest.slice(0, 7)} ${git('log', '-1', '--format=%s', oldest)}`)
console.log('\n  图例:✓ 在线内  ⊘ 超线但已具名豁免  ✗ 超线')
console.log('  (量的是分叉时长,不是最后一次提交距今多久;用作者时间,rebase 洗不掉)\n')

if (verdict.kind === 'waived') {
  console.log(`  ⊘ 已具名豁免:${verdict.reason}\n`)
  console.log(`✓ 分支寿命:${hours.toFixed(1)} 小时,超线但已具名豁免`)
  process.exit(0)
}
if (verdict.kind === 'over') {
  console.error(`✗ 分支寿命:分叉 ${hours.toFixed(1)} 小时,超过 ${LIMIT_HOURS}\n`)
  console.error('  先合一次:能独立交付的部分先合,剩下的留在分支上。')
  console.error('  合不了就说为什么 —— 在提交信息最后一段写 `age-ok: <理由>`。')
  console.error('\n  三条在途分支各自分叉四天多、彼此 92% 相同,就是没人拦的样子')
  console.error('  (`process/6-INTEGRATE.md`)。')
  process.exit(1)
}
console.log(`✓ 分支寿命:分叉 ${hours.toFixed(1)} 小时,在 ${LIMIT_HOURS} 小时线内`)
