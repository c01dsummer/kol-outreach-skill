/**
 * 分支寿命的判定 —— 把「分支活不过 48 小时」从自觉变成能报错的检查。
 *
 * 量的是**分叉时长**:本分支最早那个不在主干上的提交,到现在有多久。
 * 不是「最后一次提交距今多久」—— 那量的是活跃度,不是分叉;一条天天在提交、
 * 却四天没合的分支,正是这条纪律要拦的东西。
 *
 * ## 阈值按本仓库自己的历史校准
 *
 * | 分支 | 提交 | 分叉时长 |
 * |---|---|---|
 * | 已合并 PR #1 | 2 | 0.5 小时 |
 * | 已合并 PR #2 | 4 | 0.3 小时 |
 * | 已合并 PR #3 | 2 | 0.5 小时 |
 * | 已合并 PR #4 | 9 | 1.3 小时 |
 * | 已合并 PR #6 | 34 | 22.9 小时 |
 * | **在途** `durable-persistence` | 21 | **91.5 小时** |
 * | **在途** `requirement-conflict` | 23 | **91.5 小时** |
 * | **在途** `requirements-registry` | 18 | **102.8 小时** |
 *
 * 48 小时对最长的健康分支有一倍余量,对三条出事的分支只有一半 ——
 * 这条线不是拍的,是这两组数之间的空档。
 *
 * ⚠️ **证不了这条分支该不该拆。** 什么东西能在事实不成立时也让它通过?
 *    一条 40 小时、却把三件互不相干的事堆在一起的分支。
 *    它保证的是**上限**,不是内聚 —— 后者仍在 `process/README.md` 第三层。
 *
 * ⚠️ 用的是**作者时间**,不是提交时间。rebase 会重写提交时间,拿它计时的话
 *    「一次 rebase 把分支洗成新的」就是一条免检通道。
 *
 *    **但作者时间只挡得住普通 rebase,挡不住 `--amend --reset-author`。**
 *    所以出生时间还要和一个改写不了的锚取更早的一个,见 `birthOf` ——
 *    早先这里写的是「作者时间挡得住这个」,那句话只对了一半。
 *
 *    另一处代价:把一个很老的提交 cherry-pick 到新分支上会报得偏老 ——
 *    这是**故意的**:那段工作确实在主干之外待了那么久。报告里点名那个提交,
 *    人一看就知道。(取的是分支上**所有**提交里作者时间最小的那个;早先取的是
 *    `rev-list --reverse` 的第一条,而它按提交时间排 —— 于是同一个 cherry-pick
 *    反而会让分支显得**更年轻**,因为那条老提交根本没被看到。见 `age.ts`。)
 */
import { trailerLines } from './trailer.js'

/** 分叉时长的上限,小时。校准过程见文件头。 */
export const LIMIT_HOURS = 48

export type Verdict =
  | { kind: 'ok' }
  | { kind: 'over' }
  | { kind: 'waived'; reason: string }
  /** 最早那个提交的作者时间在**未来** —— 这不是「很新」,是量不了。 */
  | { kind: 'future' }

/**
 * `age-ok: <理由>` —— 理由必填,只写 `age-ok:` 不算。
 *
 * 和体量豁免同一个形状,理由也同一条:**具名的豁免是一次决定,
 * 匿名的豁免是一个开关。** 写理由的时候人会重新想一遍值不值。
 */
export function judgeAgeExemption(line: string): string | null {
  const m = /^age-ok:\s*(.+)$/.exec(line)
  const reason = m?.[1].trim()
  return reason ? reason : null
}

/** 指令区里第一条成立的 `age-ok:`。 */
export function scanAgeWaiver(message: string): string | null {
  for (const line of trailerLines(message)) {
    const reason = judgeAgeExemption(line)
    if (reason) return reason
  }
  return null
}

/**
 * **豁免不设新鲜度。** 体量豁免会过期,是因为「之后又加了行」是一个能观测的事件;
 * 分叉时长没有这种事件,唯一的变化是时间本身流逝。拿时间做新鲜度,等于要求
 * 一条在等评审的分支不断补提交才能保持绿 —— 而它多半没有真东西可提,
 * 剩下的只有空提交:一串只为让检查变绿而存在的提交,历史里全是噪音。
 *
 * (这里原先写的是「空提交是这个仓库明令不做的事(`process/6-INTEGRATE.md`)」——
 * **那条规则不存在**,当时 `git grep 空提交` 只搜得到我自己写的那两处。
 * 引用一条规则之前要 grep 它是不是真在那儿,见 `process/2-CHANGE.md`「描述保证的那句话」。)
 *
 * 代价是一条豁免管一整条分支。所以**报告里那个小时数照打**,豁免与否都打:
 * 豁免让它别拦路,不让它消失。
 */
export function judgeAge(hours: number, waiver: string | null): Verdict {
  /**
   * **未来的作者时间不是「很新」,是量不了。**
   *
   * 时钟不准、或者一句 `git commit --date=<未来某天>`,都会让最早那个提交的作者
   * 时间落在现在之后。分叉时长于是变成负数,而「负数 ≤ 48」成立 —— 一条真实
   * 已经两百小时的分支,报出来是 `✓ 分叉 -720.0 / 48 小时`:一个不可能的数,
   * 旁边打着勾。日期填得够远,这条闸门就一直是绿的。
   *
   * **不设容差。** 「几秒的时钟抖动」和「日期是编的」之间没有一条量得出来的界,
   * 而这个仓库其余的拒答(浅克隆、找不到主干、没有共同祖先)也都不设容差:
   * 判不了就说判不了。代价是时钟快几分钟的机器会看到一条红 —— 它说的是实话,
   * 而且时钟一对上就自己好了。
   *
   * 放在豁免**之前**:豁免免的是「这条分支活得久」,不是「这个数我算不出来」。
   */
  if (hours < 0) return { kind: 'future' }
  if (hours <= LIMIT_HOURS) return { kind: 'ok' }
  return waiver ? { kind: 'waived', reason: waiver } : { kind: 'over' }
}

/**
 * 分支的「出生时间」—— 取**最早那个提交的作者时间**与一个**改写不了的锚**里更早的一个。
 *
 * ## 为什么光有作者时间不够
 *
 * 选作者时间而不是提交时间,是因为 rebase 会重写提交时间。但作者时间同样是
 * 用户可控的:`git commit --amend --reset-author` 把它设成现在。实测一条
 * 两百小时的分支,`--reset-author` 之后报 `✓ 分叉 0.0 小时` —— **闸门自己
 * 给它续了 48 小时**,而且一声不响。
 *
 * 这不只是「有人故意绕」。一次正当的 `--amend --reset-author` 也会让这个数
 * 悄悄归零 —— 那时它不是被绕过,是**答错了**,而答错和绕过一样坏。
 *
 * ## 锚是什么
 *
 * PR 的创建时间。它在服务端,提交历史怎么改写都动不了它。取两者更早的一个:
 *
 * - 正常情况:作者时间早于 PR 创建时间 → 用作者时间,和以前一样
 * - 作者时间被改写到现在 → 它比 PR 创建时间晚 → 用 PR 创建时间
 *
 * ## 这把锚到底买到了什么 —— 说准一点
 *
 * 上一版这里写的是「改写历史只能让分支显得更老,不能更年轻」。**那句话太满了。**
 * 锚是 PR 的创建时间,所以它只按得住 **PR 开出来之后**的改写:PR 之前就把作者
 * 时间洗新的话,两个时间戳都是新的,取更早的一个还是新的。
 *
 * | 什么时候改写的 | 挡不挡得住 |
 * |---|---|
 * | PR 开出来之后 | 挡得住 —— 下限是 PR 创建时间 |
 * | PR 开出来之前 | **挡不住** |
 * | 干脆另开一条分支把改动搬过去 | 挡不住,而且**没有任何时间戳挡得住** |
 *
 * 最后一行是这件事的底:另开一条分支 cherry-pick 过去,产生的东西在服务端的
 * **每一个可观测量上都是新的** —— 新 ref、新提交、新 PR。它和一条真正的新分支
 * 之间没有可量的差别,所以「查一个更可靠的时间戳」这条路没有尽头。
 *
 * **所以这条闸门是纪律工具,不是防作弊装置。** 它挡的是**无意**养出来的长命
 * 分支;存心要绕的人,写一行 `age-ok:` 比重写历史便宜得多 —— 那条路本来就是
 * 给他留的,而且留下的是一句能被读到的理由。
 *
 * ⚠️ 另一处:锚只在有 PR 的时候才有。`--all` 扫的是分支,不是 PR —— 那条路上每条
 *    分支的锚由 `anchorFor` 从开着的 PR 清单里找;没有 PR 的分支仍只有作者时间,
 *    报告里逐条标出来。
 *
 * 锚**给了却读不出来** → `unreadable-anchor`:那是「量不了」,不是「没有锚」,所以是一个有名字的
 * 判定,不是一个缺值 —— 入口脚本只把它传出去,不在那边再判一次(评审指出)。锚在服务端明明存在(PR 的
 * 创建时间),只是这次读不出来;静默退回作者时间,等于在锚最该起作用的时候(历史被改写过)
 * 把它扔掉,而退回去的正是用户可控的那个钟,报告里还一个字不提。空串也算「给了」。
 * 调用方拒答,不退化。(原先退回作者时间;PR #10 合并后的评审指出,ADR-61 就地更正。)
 */
export type Birth =
  | { kind: 'birth'; at: string; fromAnchor: boolean }
  | { kind: 'unreadable-anchor' }

/**
 * 锚必须长得像一个时间戳(RFC 3339,GitHub 给的就是这个形状)。`Date.parse` 什么都肯认 ——
 * `Jan 1 9999` 也是一个有限的时间,拿它和一个刚被洗过的作者时间比,「取更早的」就静默选了
 * 作者时间。形状不对就是读不出来,不进比较(评审指出)。
 *
 * 形状对了还要日历上存在:`2026-04-31`、`24:00:00` 这种 `Date.parse` 会悄悄进位成下一天 ——
 * 那是另一个时间,量出来的是另一个时间的年龄,线附近能改判(评审再指出)。秒只认 00–59,
 * 闰秒的 60 不认:GitHub 不会给,给了就是读不出来。
 */
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/
export function readableAnchor(s: string): boolean {
  const m = ISO_TIMESTAMP.exec(s)
  if (!m) return false
  const [y, mo, d, h, mi, se] = m.slice(1, 7).map(Number)
  const [oh, om] = [m[7] === undefined ? 0 : Number(m[7]), m[8] === undefined ? 0 : Number(m[8])]
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const calendarOk = mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth && h <= 23 && mi <= 59 && se <= 59 && oh <= 23 && om <= 59
  return calendarOk && Number.isFinite(Date.parse(s))
}

export function birthOf(authorISO: string, anchorISO: string | null): Birth {
  if (anchorISO === null) return { kind: 'birth', at: authorISO, fromAnchor: false }
  if (!readableAnchor(anchorISO)) return { kind: 'unreadable-anchor' }
  const [a, b] = [Date.parse(authorISO), Date.parse(anchorISO)]
  return b < a ? { kind: 'birth', at: anchorISO, fromAnchor: true } : { kind: 'birth', at: authorISO, fromAnchor: false }
}

/**
 * `--all` 那条路上的锚:每条分支若有**开着的、同仓库的** PR,就用那个 PR 的创建时间。
 *
 * 早先这条路上没有锚,作者时间是唯一的钟。这不是理论缺口,量到过:同一条分支
 * (PR #5 的 head),`--all` 报 108.1 小时,`--ref --since <PR 创建时间>` 报 118.8 小时
 * —— 差 10.7 小时,`--all` 系统性地把它报年轻了,而且一声不响(ADR-61)。
 *
 * 只认同仓库的 PR:fork 来的 PR,那条分支在 fork 里,基仓的 `origin/<同名>` 要么不存在,
 * 要么是**另一条恰好同名的分支** —— 把它的创建时间安到基仓那条分支头上,是拿别人的锚
 * 量自己。同一条分支开了不止一个 PR 时取最早的那个:锚说的是「至少从这时起就在主干之外」。
 *
 * 四态,不压成两态:有锚 / 有 PR 但创建时间读不出来 / 没有开着的 PR / 根本没给清单。
 * 后两种只能用作者时间,报告里要分开说 —— 「没给清单」是这次跑法的事,
 * 「没有 PR」是这条分支的事,两者的补法不一样。「读不出来」不是没有锚,是量不了:
 * 那个字串原样带出去(`at`),交给 `birthOf` 拒答,和 `--ref --since` 读不出来走同一条路。
 * 一条分支的几个 PR 里有一个读不出来就算读不出来:锚取的是最早的那个,读不出来的那条可能正是最早的。
 */
export interface OpenPr {
  number: number
  headRefName: string
  createdAt: string
  isCrossRepository: boolean
  /** PR 声明的 base 分支的 SHA(`baseRefOid`)。豁免的扫描范围要它(`ownSince`),所以是必填列:少了这一列的清单不算清单 */
  baseRefOid: string
}

export type Anchor =
  | { kind: 'anchored'; at: string; pr: number; base: string }
  | { kind: 'unreadable'; pr: number; at: string }
  | { kind: 'no-pr' }
  | { kind: 'no-list' }

/**
 * `gh pr list --json number,headRefName,createdAt,isCrossRepository,baseRefOid` 的原样输出。
 * 形状不对返回 null,不猜 —— 少一列也算不对:少了 baseRefOid 的清单会让 `--all` 那条路上的
 * 豁免范围静默退回整条链,而报告里看不出清单缺了什么。
 */
export function parsePrList(text: string): OpenPr[] | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!Array.isArray(raw)) return null
  const out: OpenPr[] = []
  for (const p of raw as Record<string, unknown>[]) {
    if (typeof p?.number !== 'number' || typeof p.headRefName !== 'string'
      || typeof p.createdAt !== 'string' || typeof p.isCrossRepository !== 'boolean'
      || typeof p.baseRefOid !== 'string') return null
    out.push({ number: p.number, headRefName: p.headRefName, createdAt: p.createdAt,
      isCrossRepository: p.isCrossRepository, baseRefOid: p.baseRefOid })
  }
  return out
}

export function anchorFor(branch: string, prs: OpenPr[] | null): Anchor {
  if (prs === null) return { kind: 'no-list' }
  const mine = prs.filter(p => !p.isCrossRepository && p.headRefName === branch)
  if (!mine.length) return { kind: 'no-pr' }
  // 有一条读不出来就整条读不出来:锚取的是最早的那个,而读不出来的那条可能正是最早的 ——
  // 悄悄丢掉它、拿剩下的当锚,分支就可能被报年轻,而且一声不响(评审指出)
  const bad = mine.find(p => !readableAnchor(p.createdAt))
  if (bad) return { kind: 'unreadable', pr: bad.number, at: bad.createdAt }
  let best = mine[0]
  for (const p of mine) if (Date.parse(p.createdAt) < Date.parse(best.createdAt)) best = p
  return { kind: 'anchored', at: best.createdAt, pr: best.number, base: best.baseRefOid }
}

/**
 * ## 从 git 读到的字串,到能判定的事实
 *
 * 下面这几个是**决策**,不是搬运:顺序错了会出错,所以它们不该待在入口脚本里
 * (`docs/CONVENTIONS.md` 第 10 条)。这条纪律在这个仓库踩过五次,这是第六次 ——
 * 而且是同一个形状:闸门自己的判定留在入口里,于是测试与变异全绿,
 * **而真正量分支的那段代码一行都没被证明过**。
 *
 * 入口只负责跑 `git`、把字串递进来、把结果打出去。
 */

/** `git log --format=%at%x09%aI%x09%H` 的一行:纪元秒、ISO 作者时间、完整 SHA。 */
export interface Commit { at: number; iso: string; sha: string }

/**
 * **读不出纪元秒的行直接丢掉,不当成 0。** 丢进来一个 0,它会立刻变成
 * 「1970 年的作者时间」—— 一个五十万小时的分叉,比任何真实情况都老,
 * 而且看起来言之凿凿。丢掉之后「一条都没读出来」是一种能说出口的状态,见 `shapeOf`。
 */
export function parseLog(text: string): Commit[] {
  const out: Commit[] = []
  for (const line of text.split('\n')) {
    if (!line) continue
    const [at, iso, sha] = line.split('\t')
    const n = Number(at)
    if (Number.isFinite(n) && iso && sha) out.push({ at: n, iso, sha })
  }
  return out
}

/**
 * 一条 ref 相对主干的形状。
 *
 * **「已经合完了」「量不了」「读不出来」必须分开。** 三者都不产出小时数,含义却不同:
 * 第一个是这条分支没什么可量的(提交都在主干上了),后两个是**我不知道**,
 * 而且原因不一样。早先 `unrelated` 和 `merged` 返回同一个 null,于是一条没有共同
 * 祖先的分支被当成「已合完」静默跳过,末尾照样宣布「N 条在途分支都在线内」——
 * 那句话里不包含它,却听起来包含。
 */
export type Shape =
  | { kind: 'unrelated' }
  | { kind: 'merged' }
  | { kind: 'diverged'; oldest: Commit; commits: number }
  /** 范围里有提交,却一条作者时间都读不出来 —— 量不了,**不是**「已合完」。 */
  | { kind: 'unreadable' }

/**
 * **取作者时间最小的那个提交,不是「排在最前面」的那个。**
 *
 * 早先入口里用的是 `rev-list --reverse` 的第一条。而 `rev-list` 默认按**提交
 * 时间**排(`--topo-order` / `--date-order` 是另外的开关),作者时间和提交时间
 * 可以差很远 —— cherry-pick 一段老工作进来就是最常见的形状:作者时间两百多
 * 小时前,提交时间是现在。它于是排在后面,而闸门只看第一条。
 *
 * 实测:一条含 250 小时前工作的分支,报的是 `✓ 分叉 1.0 / 48 小时`。
 * **不是量错,是根本没量到那一条。**
 *
 * 比的是纪元秒,不是 ISO 字符串 —— 带不同时区偏移的 ISO 串按字典序排是错的。
 *
 * 三个判断的**顺序**也是语义:`unrelated` 要排在 `merged` 前面,否则「没有共同
 * 祖先」这件事根本没机会被说出来。
 */
export function shapeOf(base: string | null, tip: string, log: Commit[], raw: number): Shape {
  if (base === null) return { kind: 'unrelated' }
  if (base === tip) return { kind: 'merged' }
  if (!log.length) return raw > 0 ? { kind: 'unreadable' } : { kind: 'merged' }
  let oldest = log[0]
  for (const c of log) if (c.at < oldest.at) oldest = c
  return { kind: 'diverged', oldest, commits: log.length }
}

/**
 * 走第一父链要从**分支自己的头**开始,不是从检出的那个提交。
 *
 * 调用方给两件**事实**:正在评审的那个头是谁(`prHead`),以及它确实是检出那条
 * 提交的祖先(`isAncestor`)。两件都成立才用它 —— 填错了不至于量到别处去。
 * 判据为什么不在提交图里,见 `age.ts` 里那张表。
 */
export function ownTipOf(tip: string, prHead: string | null, isAncestor: boolean): string {
  return prHead && isAncestor ? prHead : tip
}

/**
 * 豁免扫描的范围里,**去掉 base 里已经有的提交**。
 *
 * `chain` 是要扫的提交(检出的那条 + 第一父链);`inBase` 回答「这个提交是不是声明的
 * base(PR 的 base 分支)的祖先」—— 是的就不算这条分支自己的,它上面的 `age-ok:` 不是
 * 为这条分支写的。
 *
 * 这一刀是给叠分支的:B 直接从没合的 A 上开出去,A 的提交就在 B 的第一父链上,B 于是
 * 继承 A 那句 `age-ok:`,自己一句话没说过。提交图分不出「叠上去」和「这些提交本来就是
 * 我写的」,分得出的事实只有「这条 PR 的 base 是谁」—— 它只在调用方手里,和 `AGE_PR_HEAD`
 * 同一个形状(ADR-63)。
 *
 * 判据是**祖先关系**,不是「链里碰到分叉点就停」。第一版写的是后者,评审当场举出反例:
 * B 叠在 A 上之后 A 又长了一个提交,B 把 A 合进来(GitHub 的 Update branch 就是这个动作)——
 * 分叉点成了 A 的新头,它在 B 的第二父那边,第一父链上碰不到,于是一刀没切,A 的旧提交
 * 连同它的豁免原样留下,而报告还说「只认 base 之后」。按祖先关系问,A 的旧提交是新头的
 * 祖先,照样去掉。
 *
 * - 没给 base(本地、push 事件上没有开着 PR 的分支、`--all` 里没有 PR 的分支)→ 不动,
 *   **报告里要说这一路没收窄**
 * - base 是主干 → 第一父链上没有主干的提交,一条都不去,本来就全是自己的
 * - base 是另一条分支 → 那条分支的提交去掉,不论它后来又长了多少、B 有没有把它合进来
 * - **按不住的**:base 里带豁免的那个提交在这条开出来之后被改写过(哪怕只 amend 一次)——
 *   新的 base 不再包含它,它留在链上,豁免照样被拿到。出处照样打出来,看得见
 */
export function ownSince(chain: string[], inBase: (sha: string) => boolean): string[] {
  return chain.filter(sha => !inBase(sha))
}

/**
 * 扫豁免的**顺序与范围**:先看检出的那条提交自己,再顺着分支的第一父链往回走。
 *
 * 检出的那条要单独排在最前面,是因为它可能根本不在第一父链上 ——
 * `pull_request` 事件下它是 GitHub 合成的合并提交。少了它,一条把理由写在
 * 合并提交上的分支就找不到自己的豁免。
 *
 * 去重只是省几次 `git log`:第一父链的头通常就是它。
 */
export function waiverOrder(tip: string, ownFirstParent: string[]): string[] {
  return [tip, ...ownFirstParent.filter(s => s !== tip)]
}

/** 一句豁免,连同**它写在哪个提交上**。 */
export interface Attributed { reason: string; from: string }

/**
 * 按给定顺序取**第一条**成立的豁免,并记下它的出处。
 *
 * 记出处不是为了好看:叠在一条没合的分支上开出去的分支,会连着下面那条的提交
 * 一起继承它的 `age-ok:`。有 base 时 `ownSince` 把那些提交截掉了;没有 base 的跑法
 * (本地、没有 PR 的分支)截不掉,那时报告里点出那个提交,它不属于这条分支的话
 * 人一眼看得出来。
 */
export function pickWaiver(commits: { sha: string; message: string }[]): Attributed | null {
  for (const c of commits) {
    const reason = scanAgeWaiver(c.message)
    if (reason) return { reason, from: c.sha.slice(0, 7) }
  }
  return null
}
