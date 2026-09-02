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
 * | `--ref <分支> [--since <锚>] [--base <PR 的 base>]` | `age.yml`,PR 事件时 + 每天 | **合并闸看的那个地方** |
 * | `--all [--prs <清单>]` | `age.yml`,每天一次 | 没人动的那些分支 |
 *
 * 中间那条不能省:GitHub 的合并闸看的是 **PR head 那个 SHA 上的检查**,
 * 聚合结果红在主干的 SHA 上不会让它失效 —— 聚合红着,PR 照样能合。
 * `--since` 给一个改写不了的时间锚,见 `age-rule.ts` 的 `birthOf`;`--prs` 给 `--all`
 * 同一把锚 —— 开着的 PR 清单,每条分支若有同仓库的 PR 就用它的创建时间(`anchorFor`)。
 *
 * 时间型的判据要配时间型的触发,少一个,保证就只在有人已经在看的时候才成立。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  LIMIT_HOURS, type OpenPr, anchorFor, birthOf, judgeAge, ownSince, ownTipOf, parseLog,
  parsePrList, pickWaiver, shapeOf, waiverOrder,
} from './age-rule.js'

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
  /** 那句豁免写在哪个提交上。没有 base 的跑法上,**继承来的豁免靠它露出马脚**,见下面扫描处的说明。 */
  waiverFrom: string
  /** 豁免扫的是哪一段:声明了 base 就截到从它开出来的那一点;null = 没声明,扫整条第一父链 */
  scope: { base: string; dropped: number } | null
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
 * **这个函数只做 IO**:跑 `git`,把字串递给 `age-rule.ts` 里的判定,把结果装起来。
 * 判定本身(形状分类、取哪个提交、豁免扫哪些)在那边,因为它们的**顺序错了会出错**
 * —— 有语义就该能被测,能被测就不该待在入口脚本里(`docs/CONVENTIONS.md` 第 10 条)。
 *
 * 这一条是评审第三次在同一件事上叫停:头两次是「判据不在提交图里」,这次是
 * 「判据不在入口脚本里」。抽出去之前,真正量分支的那段代码一行都没被证明过 ——
 * 测试与变异全绿,而它们够不到这里。
 */
type Verdict3 = Measured | { kind: 'merged' } | { kind: 'unrelated' } | { kind: 'unreadable' }

function measure(ref: string, anchor: string | null, declaredBase: string | null): Verdict3 {
  const tip = git('rev-parse', ref)
  const base = tryGit('merge-base', trunk!, ref)
  const raw = base === null || base === tip
    ? '' : git('log', '--format=%at%x09%aI%x09%H', `${base}..${tip}`)
  const rawCount = raw.split('\n').filter(Boolean).length
  const shape = shapeOf(base, tip, parseLog(raw), rawCount)
  if (shape.kind !== 'diverged') return shape

  const birth = birthOf(shape.oldest.iso, anchor)
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
   * **它跟着分支生,跟着分支死**(`process/6-INTEGRATE.md`)。
   *
   * ⚠️ **「第一父链」不等于「这条分支自己的提交」,差在叠分支上。** B 不是把 A
   *    合进来,而是**直接从没合的 A 上开出去**的话,A 的提交就在 B 的第一父链上,
   *    B 于是照样继承 A 那句 `age-ok:` —— 它自己一句话没说过。图里没有能分开它们的
   *    东西(理由和下面那两轮一样),分得出的事实只有「这条 PR 的 base 是谁」,它在
   *    调用方手里:`AGE_PR_BASE`(check.yml)、`--base`(age.yml 贴 PR 那一步)、
   *    `--prs` 清单里的 baseRefOid(`--all`)。有 base 就把 base 里已有的提交从扫描范围里
   *    去掉(`ownSince`);没有 base 的跑法去不掉,报告里说,并点名那句理由写在哪个提交上
   *    (`pickWaiver`)—— 那几条路上仍是看得见、挡不住。base 是主干的 PR 也一样:叠分支
   *    对着主干开 PR,下面那条的提交就是这条 PR 要合的内容,它的豁免跟着进来。
   *
   * ## 「从哪个头开始走」不能靠看提交图判,试过两轮都不行
   *
   * `pull_request` 事件下,CI 检出的是 GitHub 合成的 `refs/pull/N/merge` ——
   * 它的**第一父是主干那一侧**,第二父才是 PR 的头。从它走第一父链,走到的只有
   * 那个合成提交本身,一条分支提交都碰不到:一条写了合法 `age-ok:` 的超线 PR
   * 会在必需的 `check` 里照样红。
   *
   * | 轮 | 判据 | 被什么打回 |
   * |---|---|---|
   * | 14 | 「是合并 + 第一父在主干里」→ 取第二父 | 一次自己动手的 `checkout main && merge --no-ff` 长得一模一样,把作者写在合并提交上的豁免打没了 |
   * | 15 | 上面那条 + 也扫检出的那条提交 | 补回了合并提交那句话,但第二父那条历史照旧在扫 —— 一条自己没声明过任何东西的分支又开始继承旁支的豁免 |
   *
   * **合成 ref 和「从主干开一条分支、头一次就 `merge --no-ff` 别人」在提交图里
   * 是同一个形状。** 图里没有能分开它们的东西,所以判据不在图里,在**调用方**:
   * `AGE_PR_HEAD` 给出「正在评审的那个头」。工作流在 `pull_request` 事件下填
   * `github.event.pull_request.head.sha`;push、本地、`--ref`、`--all` 都没有它,
   * 那时检出的就是头本身。
   *
   * 传的是**事实**(头是哪个提交),不是**推断**(这次是不是 PR 事件)——
   * 后者还要再猜一次。仍然核一遍它确实是 HEAD 的祖先。
   */
  const prHead = ref === 'HEAD' && process.env.AGE_PR_HEAD
    ? tryGit('rev-parse', `${process.env.AGE_PR_HEAD}^{commit}`)
    : null
  const ownTip = ownTipOf(tip, prHead,
    prHead !== null && tryGit('merge-base', '--is-ancestor', prHead, tip) !== null)
  const own = git('log', '--first-parent', '--format=%H', `${base}..${ownTip}`)
    .split('\n').filter(Boolean)
  /**
   * 再收一次:声明了 base(PR 的 base 分支)的话,把 **base 里已经有的提交**去掉 ——
   * 它们是下面那条分支的、或早已合进 base 的,那上面的 `age-ok:` 不是为这条分支写的。
   * 判据是祖先关系(`merge-base --is-ancestor`),一条一问;为什么不是「截到分叉点」,
   * 见 `age-rule.ts` 的 `ownSince`。检出的那条也一起问:它要是 base 的祖先,同样不算。
   */
  const order = waiverOrder(tip, own)
  const scoped = declaredBase === null ? order
    : ownSince(order, sha => tryGit('merge-base', '--is-ancestor', sha, declaredBase) !== null)
  const picked = pickWaiver(scoped.map(sha => ({ sha, message: git('log', '-1', '--format=%B', sha) })))

  return {
    kind: 'measured',
    hours: (Date.now() - new Date(since).getTime()) / 3_600_000,
    commits: shape.commits,
    oldest: shape.oldest.sha.slice(0, 7),
    subject: git('log', '-1', '--format=%s', shape.oldest.sha),
    since: since.slice(0, 16),
    fromAnchor: birth.fromAnchor,
    waiver: picked?.reason ?? null,
    waiverFrom: picked?.from ?? '',
    scope: declaredBase === null ? null
      : { base: declaredBase.slice(0, 7), dropped: order.length - scoped.length },
  }
}

/**
 * 豁免扫的是哪些提交 —— 有 base 时说去掉了几条 base 里已有的(0 也照说,**没去掉就说没去掉**);
 * 没有 base 时说这一路去不掉。
 */
const scopeNote = (scope: Measured['scope']) => scope
  ? `  豁免只认这条分支自己的提交:base ${scope.base} 里已有的 ${scope.dropped} 条不算`
    + '(下面那条分支的,或早已合进 base 的)'
  : '  没给 base(本地跑、push 事件上没有开着 PR 的分支、没有 PR 的分支),豁免扫的是整条第一父链'
    + ' —— 叠在别的分支上开出来的话,这句理由可能是下面那条的:看那个提交属不属于这条分支'

const FLAG = { ok: '✓', waived: '⊘', over: '✗', future: '?' } as const
const LEGEND = '\n  图例:✓ 在线内  ⊘ 超线但已具名豁免  ✗ 超线  ? 量不了\n'
  + '  (量的是分叉时长,不是最后一次提交距今多久;用作者时间,有锚时取更早的一个 —— `--since`,或 `--all` 的 `--prs`)\n'
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
  /**
   * `--base <提交>`:这条 PR 声明的 base(`age.yml` 从 PR 清单的 baseRefOid、或 PR 事件里取)。
   * 给了却找不到 → 拒答:豁免该扫哪一段判不了,不退化成扫整条 —— 那正是叠分支继承豁免的那条路。
   */
  const baseArg = process.argv.indexOf('--base')
  const declared = baseArg >= 0 ? (process.argv[baseArg + 1] ?? null) : null
  if (declared === null && baseArg >= 0) cannotAnswer('`--base` 后面没有给提交', '写成 `--base <PR 的 base 分支的 SHA>`。')
  if (declared === '') cannotAnswer('`--base` 给的是空串', 'PR 清单里这条的 baseRefOid 是空的?`gh pr list --json baseRefOid` 应该总有值。')
  if (declared && !tryGit('rev-parse', '--verify', `${declared}^{commit}`)) {
    cannotAnswer(`\`--base\` 给的 ${declared} 找不到`, '先 `git fetch origin`;这个值是 PR 的 base 分支的 SHA。')
  }
  if (declared && !tryGit('merge-base', declared, ref)) {
    cannotAnswer(`\`--base\` 给的 ${declared} 与 ${ref} 没有共同祖先`, '这不是它的 base;豁免该扫哪些提交判不了,不退化成扫整条。')
  }
  const one = measure(ref, ANCHOR, declared)
  if (one.kind === 'merged') {
    console.log(`✓ 分支寿命:${ref} 相对 ${trunk} 没有自己的提交`)
    process.exit(0)
  }
  if (one.kind === 'unrelated') {
    cannotAnswer(`${ref} 与 ${trunk} 没有共同祖先`, '接上主干,或者删掉这条分支。')
  }
  if (one.kind === 'unreadable') {
    cannotAnswer(`${ref} 上有提交,却一条作者时间都读不出来`, '这多半说明 git 的输出格式变了,或者这不是一个正常的仓库。')
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
  if (v.kind === 'waived') {
    console.log(`  豁免(写在 ${one.waiverFrom} 上):${v.reason}`)
    console.log(scopeNote(one.scope))
    process.exit(0)
  }
  if (v.kind === 'over') { console.error(`\n${HOWTO}`); process.exit(1) }
  process.exit(0)
}

// ── 扫所有远端分支 ──────────────────────────────────────────────

if (process.argv.includes('--all')) {
  /**
   * `--prs <文件>`:开着的 PR 清单(`gh pr list --json number,headRefName,createdAt,isCrossRepository,baseRefOid`
   * 的原样输出)。每条分支若有同仓库开着的 PR,就拿它的创建时间当锚 —— 和 `--ref --since`
   * 是同一把锚。少了它,这条路上作者时间是唯一的钟;这不是理论缺口,量到过:同一条分支
   * (PR #5 的 head),这里报 108.1 小时,`--ref --since <PR 创建时间>` 报 118.8 —— 差 10.7
   * 小时,而且一声不响(ADR-61)。
   *
   * 没给清单不拒答 —— 本地随手跑一次不该非要先去问 GitHub;但**每一行都标出它有没有锚**,
   * 汇总里再说一次有几条没有。「没给清单」和「这条分支没有 PR」分开标:前者是这次跑法的事,
   * 后者是这条分支的事。清单给了却读不懂,那是拒答:一份读错的清单会把所有分支静默标成「无 PR」。
   */
  const prsArg = process.argv.indexOf('--prs')
  let prs: OpenPr[] | null = null
  if (prsArg >= 0) {
    const path = process.argv[prsArg + 1]
    if (!path) cannotAnswer('`--prs` 后面没有给文件', '写成 `--prs <gh pr list --json … 的输出文件>`。')
    let text: string | null = null
    try { text = readFileSync(path, 'utf8') } catch { /* 下面统一处理 */ }
    if (text === null) cannotAnswer(`读不到 ${path}`, '确认 `--prs` 指向的文件存在。')
    prs = parsePrList(text)
    if (prs === null) {
      cannotAnswer(`${path} 不是一份开着的 PR 清单`,
        '要 `gh pr list --json number,headRefName,createdAt,isCrossRepository,baseRefOid` 的原样输出。')
    }
  }
  /** 每一行末尾的锚标记。四态各一个写法,和 `age-rule.ts` 的 `Anchor` 一一对应。 */
  const TAG = {
    unreadable: (pr: number) => `[#${pr} 的创建时间读不出来]`,
    'no-pr': () => '[无 PR]',
    'no-list': () => '[无清单]',
  } as const

  const refs = git('for-each-ref', '--format=%(refname)', 'refs/remotes/origin')
    .split('\n').filter(Boolean)
    .filter(r => r !== `refs/remotes/${trunk}` && !r.endsWith('/HEAD'))

  console.log(`\n分支寿命 · 所有远端分支相对 ${trunk}\n`)
  const over: string[] = []
  const waived: string[] = []
  const unknown: string[] = []
  const unanchored: string[] = []
  let live = 0
  for (const ref of refs) {
    const name = ref.replace('refs/remotes/', '')
    const anchor = anchorFor(name.replace(/^origin\//, ''), prs)
    // 有 PR 的分支连它的 base 一起拿到:豁免只认从 base 开出来之后的提交。base 找不到就是量不了
    const declared = anchor.kind === 'anchored' ? anchor.base : null
    if (anchor.kind === 'anchored' && declared !== null) {
      const why = !tryGit('rev-parse', '--verify', `${declared}^{commit}`) ? '找不到'
        : !tryGit('merge-base', declared, ref) ? `与 ${name} 没有共同祖先` : null
      if (why) {
        console.log(`  ? ${'—'.padStart(6)}        ——  ${name}`)
        unknown.push(`${name}(PR #${anchor.pr} 的 base ${declared.slice(0, 7)} ${why},豁免该扫哪些提交判不了)`)
        continue
      }
    }
    const m = measure(ref, anchor.kind === 'anchored' ? anchor.at : null, declared)
    // 已经全部合进主干的分支不算在途 —— 它没有自己的提交,量它没有意义
    if (m.kind === 'merged') continue
    if (m.kind === 'unrelated') {
      console.log(`  ? ${'—'.padStart(6)}        ——  ${name}`)
      unknown.push(`${name}(与 ${trunk} 没有共同祖先)`)
      continue
    }
    if (m.kind === 'unreadable') {
      console.log(`  ? ${'—'.padStart(6)}        ——  ${name}`)
      unknown.push(`${name}(有提交,却一条作者时间都读不出来)`)
      continue
    }
    const v = judgeAge(m.hours, m.waiver)
    if (v.kind === 'future') {
      console.log(`  ? ${m.hours.toFixed(1).padStart(6)} 小时  ${String(m.commits).padStart(3)} 个提交  ${name}`)
      unknown.push(`${name}(最早的提交 ${m.oldest} 作者时间在未来:${m.since})`)
      continue
    }
    live++
    const tag = anchor.kind === 'anchored'
      ? `[锚 #${anchor.pr}${m.fromAnchor ? ' ⚠ 按锚算' : ''}]`
      : TAG[anchor.kind](anchor.kind === 'unreadable' ? anchor.pr : 0)
    if (anchor.kind !== 'anchored') unanchored.push(name)
    console.log(`  ${FLAG[v.kind]} ${m.hours.toFixed(1).padStart(6)} 小时`
      + `  ${String(m.commits).padStart(3)} 个提交  ${name}  ${tag}`)
    if (v.kind === 'waived') {
      console.log(`         豁免(写在 ${m.waiverFrom} 上):${v.reason}`)
      console.log(`         ${scopeNote(m.scope).trim()}`)
      waived.push(`${name}(${m.hours.toFixed(1)} 小时,豁免写在 ${m.waiverFrom} 上:${v.reason})`)
    }
    if (v.kind === 'over') over.push(`${name}(${m.hours.toFixed(1)} 小时,自 ${m.since})`)
  }
  console.log(LEGEND)
  console.log('  锚:[锚 #N] 有开着的同仓库 PR,出生时间取作者时间与它的创建时间里更早的一个')
  console.log('     [锚 #N ⚠ 按锚算] 作者时间比 PR 创建时间还晚 —— 历史被改写过,或者时钟不对')
  console.log('     [无 PR] 没有开着的同仓库 PR  [无清单] 本次没给 --prs  [#N 的创建时间读不出来] 有 PR 但那个时间不像时间')
  console.log('     后三种都没有锚,只有作者时间 —— PR 开出来之前改写过历史的话,这个数会偏小\n')
  if (unanchored.length) {
    console.log(`  ⚠ ${unanchored.length} / ${live} 条在途分支没有锚,它们的小时数可能偏小`
      + (prs === null ? '(本次没给 --prs)' : '') + '\n')
  }
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

/**
 * `AGE_PR_BASE`:check.yml 在 pull_request 事件下填 `github.event.pull_request.base.sha`,
 * 这条 PR 声明的 base。和 `AGE_PR_HEAD` 同一个形状 —— 传事实,不传推断。给了却找不到就拒答。
 */
const declaredBase = process.env.AGE_PR_BASE ? process.env.AGE_PR_BASE : null
if (declaredBase && !tryGit('rev-parse', '--verify', `${declaredBase}^{commit}`)) {
  cannotAnswer(`AGE_PR_BASE 给的 ${declaredBase} 找不到`,
    'CI 里给 actions/checkout 加 `fetch-depth: 0`;这个值是 PR 的 base 分支的 SHA。')
}
if (declaredBase && !tryGit('merge-base', declaredBase, 'HEAD')) {
  cannotAnswer(`AGE_PR_BASE 给的 ${declaredBase} 与 HEAD 没有共同祖先`, '这不是它的 base;豁免该扫哪些提交判不了,不退化成扫整条。')
}
const m = measure('HEAD', ANCHOR, declaredBase)
if (m.kind === 'unreadable') {
  cannotAnswer('HEAD 上有提交,却一条作者时间都读不出来', '这多半说明 git 的输出格式变了,或者这不是一个正常的仓库。')
}
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
  console.log(`  ⊘ 已具名豁免(写在 ${m.waiverFrom} 上):${verdict.reason}`)
  console.log(`  ${scopeNote(m.scope)}\n`)
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
