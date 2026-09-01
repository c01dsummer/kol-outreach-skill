#!/usr/bin/env tsx
/**
 * 分支寿命闸门 —— 把「分支活不过 48 小时」从自觉变成能报错的检查。
 *
 * 这条纪律有真实战绩:三条在途分支各自分叉四天多、彼此 92% 相同、都碰同一批
 * 文件,而这期间**没有任何东西说过一句话**。体量闸门管得住「一次改动多大」,
 * 管不住「一条分支开多久」——后者才是让三条分支互相重写同一批文件的那一个。
 *
 * 判定与阈值校准见 `scripts/check/age-rule.ts`。
 *
 * ## 三种跑法,因为**这是个时间型的判据**
 *
 * 体量闸门量的是 diff:不推新东西,数就不会变,所以「推送时查一次」够了。
 * 分叉时长不是 —— **它自己会长**。一条分支停在 47 小时通过,没人碰它,
 * 第二天就过线了,而 `push` / `pull_request` 都不会再触发一次。
 *
 * 于是恰好是这条闸门要拦的那种分支(没人动的那种)最容易漏掉:
 * 三条在途分支停了四天、一次推送都没有,只靠推送触发的话,它一句话也不会说。
 *
 * | 跑法 | 谁在跑 | 守什么 |
 * |---|---|---|
 * | 不带参数 | `npm run check`,每次推送 | 你正要合的这个改动 |
 * | `--ref <分支> [--since <锚>]` | `age.yml`,PR 事件时 + 每天 | **合并闸看的那个地方** |
 * | `--all` | `age.yml`,每天一次 | 没人动的那些分支 |
 *
 * 中间那条不能省:GitHub 的合并闸看的是 **PR head 那个 SHA 上的检查**,
 * 聚合结果红在主干的 SHA 上不会让它失效 —— 聚合红着,PR 照样能合。
 * `--since` 给一个改写不了的时间锚,见 `age-rule.ts` 的 `birthOf`。
 *
 * 时间型的判据要配时间型的触发,少一个,保证就只在有人已经在看的时候才成立。
 */
import { execFileSync } from 'node:child_process'
import { LIMIT_HOURS, birthOf, judgeAge, scanAgeWaiver } from './age-rule.js'

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

interface Measured {
  kind: 'measured'
  hours: number
  commits: number
  oldest: string
  subject: string
  since: string
  /** 用的是锚(PR 创建时间)而不是作者时间 —— 说明作者时间被改写过或时钟不对 */
  fromAnchor: boolean
  waiver: string | null
}

/**
 * `--since <ISO>`:一个**改写不了的时间锚**,通常是 PR 的创建时间。
 * 出生时间取它与作者时间里更早的一个,理由见 `age-rule.ts` 的 `birthOf`。
 */
const sinceArg = process.argv.indexOf('--since')
const ANCHOR = sinceArg >= 0 ? (process.argv[sinceArg + 1] ?? null) : null

/**
 * 一个 ref 相对主干的分叉时长。
 *
 * **「已经合完了」和「量不了」必须分开。** 两者都不产出小时数,但含义相反:
 * 前者是这条分支没什么可量的(它的提交都在主干上了),后者是**我不知道**。
 * 早先两种都返回 null,于是一条没有共同祖先的分支被当成「已合完」静默跳过,
 * 而末尾照样宣布「N 条在途分支都在线内」—— 那句话里不包含它,却听起来包含。
 *
 * 三态:是 / 否 / 我不知道。第三种要说出口,不能塞进前两种里
 * (`process/4-VERIFY.md`)。
 */
type Verdict3 = Measured | { kind: 'merged' } | { kind: 'unrelated' }

function measure(ref: string): Verdict3 {
  const tip = git('rev-parse', ref)
  const base = tryGit('merge-base', trunk!, ref)
  if (!base) return { kind: 'unrelated' }
  if (base === tip) return { kind: 'merged' }
  /**
   * **取作者时间最小的那个提交,不是「排在最前面」的那个。**
   *
   * 早先这里用的是 `rev-list --reverse` 的第一条。而 `rev-list` 默认按**提交
   * 时间**排(`--topo-order` / `--date-order` 是另外的开关),作者时间和提交时间
   * 可以差很远 —— cherry-pick 一段老工作进来就是最常见的形状:作者时间两百多
   * 小时前,提交时间是现在。它于是排在后面,而闸门只看第一条。
   *
   * 实测:一条含 250 小时前工作的分支,报的是 `✓ 分叉 1.0 / 48 小时`。
   * **不是量错,是根本没量到那一条。**
   *
   * 用 `%at`(纪元秒)比大小,不比 ISO 字符串 —— 带不同时区偏移的 ISO 串
   * 按字典序排是错的。
   */
  const log = git('log', '--format=%at%x09%aI%x09%H', `${base}..${tip}`)
    .split('\n').filter(Boolean)
  if (!log.length) return { kind: 'merged' }

  let first = { at: Number.POSITIVE_INFINITY, iso: '', sha: '' }
  const shas: string[] = []
  for (const line of log) {
    const [at, iso, sha] = line.split('\t')
    shas.push(sha)
    const n = Number(at)
    if (Number.isFinite(n) && n < first.at) first = { at: n, iso, sha }
  }
  const oldest = first.sha
  const birth = birthOf(first.iso, ANCHOR)
  const since = birth.at

  /**
   * 豁免只认**这条分支自己的**提交(第一父链),不认合进来的旁支。
   *
   * **年龄和豁免的范围是不一样的,这是故意的：**
   *
   * | | 范围 | 因为它是什么 |
   * |---|---|---|
   * | 年龄 | `base..tip` **全部**提交 | 内容的属性:这些改动在主干之外待了多久 |
   * | 豁免 | 只有第一父链 | **声明**:谁为这条分支说的这句话 |
   *
   * 合进来一条带 `age-ok:` 的旁支,那句理由是**为那条分支写的**。照单全收的话,
   * 一条自己从没声明过任何东西的分支,会拿着别人的理由过闸门 —— 实测:B 合了
   * 带豁免的 A 之后,报「⊘ 已具名豁免:A 在等上游接口定稿」。
   *
   * 这也正是这条豁免被设计成提交信息里一行、而不是一条决策记录的理由:
   * **它跟着分支生,跟着分支死**(`process/6-INTEGRATE.md`)。跟着合并跑到别的
   * 分支上去,就不是那个东西了。
   *
   * 合并提交本身在第一父链上 —— 想为这次合并说话,写在那条提交信息里就算。
   *
   * 豁免不设新鲜度,理由见 `age-rule.ts`。
   */
  let waiver: string | null = null
  /**
   * **第一父链要从分支自己的头开始走,不是从检出的那个提交。**
   *
   * `pull_request` 事件下,CI 检出的是 GitHub 合成的 `refs/pull/N/merge` ——
   * 它的**第一父是主干那一侧**,第二父才是 PR 的头。从它走第一父链,走到的只有
   * 那个合成提交本身,一条分支提交都碰不到。实测(本 PR 的合并 ref):
   *
   * ```
   * 范围内提交数(全部)          21
   * 范围内提交数(--first-parent)  1   ← 只有合成的那条
   * ```
   *
   * 于是一条**写了合法 `age-ok:` 的超线 PR**,在必需的 `check` 里照样红:
   * 它的豁免根本没被看到。
   *
   * 判别形状:这个提交是合并,而且它的**第一父已经整个在主干里** ——
   * 那它就是「把我的工作并进主干」的那种合并,真正的头是第二父。
   *
   * **但这个形状不只合成 ref 有。** 一次自己动手的 `git checkout main &&
   * git merge --no-ff feature` 长得一模一样,而那条合并提交是分支作者写的,
   * 可能就带着 `age-ok:` —— 上一轮我还明写着「想为这次合并说话,写在那条提交
   * 信息里就算」。靠父提交的祖先关系分不开这两者。
   *
   * 所以**检出的那条提交自己也扫一遍**,不管它是不是合成的:
   *
   * - 是合成的 → 它的信息是 GitHub 自动生成的 `Merge <sha> into <sha>`,
   *   不可能带 trailer 块,扫了也是空,没有误判的余地
   * - 是分支作者写的合并 → 那句话本来就该算
   *
   * 判不准「这条提交是谁写的」时,**读它写了什么**比猜它的出身可靠。
   *
   * 这个 ref 形状在这个仓库里绊过两次:体量闸门的豁免新鲜度(PR #6,CI 当场红过,
   * 最后换成不看提交顺序的树对树),和这里。两次都是「按提交结构推理」栽的跟头。
   */
  const p1 = tryGit('rev-parse', `${ref}^1`)
  const p2 = tryGit('rev-parse', `${ref}^2`)
  const ownTip = p1 && p2 && tryGit('merge-base', trunk!, p1) === p1 ? p2 : tip
  const own = git('log', '--first-parent', '--format=%H', `${base}..${ownTip}`)
    .split('\n').filter(Boolean)
  for (const sha of [tip, ...own]) waiver ??= scanAgeWaiver(git('log', '-1', '--format=%B', sha))

  return {
    kind: 'measured',
    hours: (Date.now() - new Date(since).getTime()) / 3_600_000,
    commits: shas.length,
    oldest: oldest.slice(0, 7),
    subject: git('log', '-1', '--format=%s', oldest),
    since: since.slice(0, 16),
    fromAnchor: birth.fromAnchor,
    waiver,
  }
}

const FLAG = { ok: '✓', waived: '⊘', over: '✗', future: '?' } as const
const LEGEND = '\n  图例:✓ 在线内  ⊘ 超线但已具名豁免  ✗ 超线  ? 量不了\n'
  + '  (量的是分叉时长,不是最后一次提交距今多久;用作者时间,有 --since 锚时取更早的一个)\n'
const HOWTO = '  先合一次:能独立交付的部分先合,剩下的留在分支上。\n'
  + '  合不了就说为什么 —— 在提交信息最后一段写 `age-ok: <理由>`。'

// ── 量指定的一个 ref ───────────────────────────────────────────

/**
 * `--ref <ref>`:量一条指定分支,给**定时任务往每个 PR 的 head 上贴检查**用。
 *
 * `--all` 只在主干的 SHA 上留一条聚合结果。而 GitHub 的合并闸看的是 **PR head
 * 那个 SHA 上的检查**:一个 47 小时通过、之后没人碰的 PR,它 head 上那条绿
 * 不会因为聚合任务红了而失效 —— **聚合任务红着,PR 照样能合。**
 *
 * 所以定时任务对每个开着的 PR 各跑一次这个模式,把结果作为一条 check run 贴回
 * 那个 head,让信号出现在做合并决定的地方。
 */
const refArg = process.argv.indexOf('--ref')
if (refArg >= 0) {
  const ref = process.argv[refArg + 1]
  if (!ref) cannotAnswer('`--ref` 后面没有给分支名', '写成 `--ref origin/某分支`。')
  if (!tryGit('rev-parse', '--verify', `${ref}^{commit}`)) {
    cannotAnswer(`找不到 ${ref}`, '先 `git fetch origin`。')
  }
  const one = measure(ref)
  if (one.kind === 'merged') {
    console.log(`✓ 分支寿命:${ref} 相对 ${trunk} 没有自己的提交`)
    process.exit(0)
  }
  if (one.kind === 'unrelated') {
    cannotAnswer(`${ref} 与 ${trunk} 没有共同祖先`, '接上主干,或者删掉这条分支。')
  }
  const v = judgeAge(one.hours, one.waiver)
  if (v.kind === 'future') {
    cannotAnswer(`${ref} 最早那个提交(${one.oldest})的作者时间在未来:${one.since}`,
      '把提交那台机器的时钟对一下;`--date` 手写的日期也算。')
  }
  console.log(`${FLAG[v.kind]} ${ref}:分叉 ${one.hours.toFixed(1)} / ${LIMIT_HOURS} 小时`
    + `,${one.commits} 个提交,自 ${one.since}`)
  if (one.fromAnchor) console.log(`  (最早那个提交的作者时间比这还晚 —— 历史被改写过,`
    + `或者时钟不对。改用 --since 给的那个改写不了的时间。)`)
  if (v.kind === 'waived') { console.log(`  豁免:${v.reason}`); process.exit(0) }
  if (v.kind === 'over') { console.error(`\n${HOWTO}`); process.exit(1) }
  process.exit(0)
}

// ── 扫所有远端分支 ──────────────────────────────────────────────

if (process.argv.includes('--all')) {
  const refs = git('for-each-ref', '--format=%(refname)', 'refs/remotes/origin')
    .split('\n').filter(Boolean)
    .filter(r => r !== `refs/remotes/${trunk}` && !r.endsWith('/HEAD'))

  console.log(`\n分支寿命 · 所有远端分支相对 ${trunk}\n`)
  const over: string[] = []
  const waived: string[] = []
  const unknown: string[] = []
  let live = 0
  for (const ref of refs) {
    const name = ref.replace('refs/remotes/', '')
    const m = measure(ref)
    // 已经全部合进主干的分支不算在途 —— 它没有自己的提交,量它没有意义
    if (m.kind === 'merged') continue
    if (m.kind === 'unrelated') {
      console.log(`  ? ${'—'.padStart(6)}        ——  ${name}`)
      unknown.push(`${name}(与 ${trunk} 没有共同祖先)`)
      continue
    }
    const v = judgeAge(m.hours, m.waiver)
    if (v.kind === 'future') {
      console.log(`  ? ${m.hours.toFixed(1).padStart(6)} 小时  ${String(m.commits).padStart(3)} 个提交  ${name}`)
      unknown.push(`${name}(最早的提交 ${m.oldest} 作者时间在未来:${m.since})`)
      continue
    }
    live++
    console.log(`  ${FLAG[v.kind]} ${m.hours.toFixed(1).padStart(6)} 小时`
      + `  ${String(m.commits).padStart(3)} 个提交  ${name}`)
    if (v.kind === 'waived') {
      console.log(`         豁免:${v.reason}`)
      waived.push(`${name}(${m.hours.toFixed(1)} 小时:${v.reason})`)
    }
    if (v.kind === 'over') over.push(`${name}(${m.hours.toFixed(1)} 小时,自 ${m.since})`)
  }
  console.log(LEGEND)
  if (unknown.length) {
    console.error(`✗ 分支寿命:${unknown.length} 条分支量不了\n`)
    for (const u of unknown) console.error(`  · ${u}`)
    console.error('\n  不当作「在线内」—— 一个把「不知道」算成「通过」的检查等于没有检查。')
    console.error('  没有共同祖先:接上主干,或者删掉这条分支。')
    console.error('  作者时间在未来:把提交那台机器的时钟对一下(`--date` 手写的日期也算)。')
  }
  if (over.length) {
    console.error(`${unknown.length ? '' : '\n'}✗ 分支寿命:${over.length} / ${live} 条在途分支`
      + `超过 ${LIMIT_HOURS} 小时且无豁免\n`)
    for (const o of over) console.error(`  · ${o}`)
    console.error(`\n${HOWTO}`)
  }
  if (over.length || unknown.length) process.exit(1)
  /**
   * **豁免掉的那几条要留在汇总里,不能并进「都在线内」。**
   *
   * 早先这里打的是「N 条在途分支都在 48 小时线内」,而 N 把已豁免的也算进去了 ——
   * 于是一条 200 小时的分支在表里是 `⊘ 200.0 小时`,三行之下的汇总说它在线内。
   * **同一屏之内自相矛盾**,而且藏掉的正是这个视图存在的理由。
   *
   * 单分支那边早就写着「豁免让它别拦路,不让它消失」,汇总这边没照做。
   */
  const inLimit = live - waived.length
  if (waived.length) {
    console.log(`✓ 分支寿命:${live} 条在途分支 —— ${inLimit} 条在 ${LIMIT_HOURS} 小时线内,`
      + `${waived.length} 条超线但已具名豁免\n`)
    for (const w of waived) console.log(`  ⊘ ${w}`)
  } else {
    console.log(`✓ 分支寿命:${live} 条在途分支都在 ${LIMIT_HOURS} 小时线内`)
  }
  process.exit(0)
}

// ── 量当前 HEAD ─────────────────────────────────────────────────

const merged = tryGit('merge-base', trunk, 'HEAD')
if (!merged) cannotAnswer(`HEAD 与 ${trunk} 没有共同祖先`, '确认这条分支确实从主干长出来。')

/** HEAD 就在主干上时不适用:主干没有「分叉」这回事。 */
if (merged === head) {
  console.log(`✓ 分支寿命:不适用 —— HEAD 就在 ${trunk} 上`)
  process.exit(0)
}

const m = measure('HEAD')
if (m.kind !== 'measured') {
  console.log(`✓ 分支寿命:不适用 —— 相对 ${trunk} 没有自己的提交`)
  process.exit(0)
}

const verdict = judgeAge(m.hours, m.waiver)
if (verdict.kind === 'future') {
  cannotAnswer(`最早那个提交(${m.oldest})的作者时间在未来:${m.since}`,
    '把提交那台机器的时钟对一下;`--date` 手写的日期也算。')
}

console.log(`\n分支寿命 · 相对 ${trunk}\n`)
console.log(`  ${FLAG[verdict.kind]} 分叉 ${m.hours.toFixed(1)} / ${LIMIT_HOURS} 小时`
  + `,${m.commits} 个提交,自 ${m.since}`)
console.log(`      最早的提交:${m.oldest} ${m.subject}`)
if (m.fromAnchor) {
  console.log('      ⚠ 那个提交的作者时间比上面这个时间还晚 —— 历史被改写过,或者时钟不对。')
  console.log('        改用了 --since 给的那个改写不了的时间(PR 创建时间)。')
  console.log('        注意它只按得住 PR 开出来**之后**的改写 —— 之前的按不住,')
  console.log('        见 `age-rule.ts` 的 `birthOf`。')
}
console.log(LEGEND)

if (verdict.kind === 'waived') {
  console.log(`  ⊘ 已具名豁免:${verdict.reason}\n`)
  console.log(`✓ 分支寿命:${m.hours.toFixed(1)} 小时,超线但已具名豁免`)
  process.exit(0)
}
if (verdict.kind === 'over') {
  console.error(`✗ 分支寿命:分叉 ${m.hours.toFixed(1)} 小时,超过 ${LIMIT_HOURS}\n`)
  console.error(HOWTO)
  console.error('\n  三条在途分支各自分叉四天多、彼此 92% 相同,就是没人拦的样子')
  console.error('  (`process/6-INTEGRATE.md`)。')
  process.exit(1)
}
console.log(`✓ 分支寿命:分叉 ${m.hours.toFixed(1)} 小时,在 ${LIMIT_HOURS} 小时线内`)
