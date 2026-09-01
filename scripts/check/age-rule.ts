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
 *    「一次 rebase 把分支洗成新的」就是一条免检通道。作者时间挡得住这个,
 *    代价是把一个很老的提交 cherry-pick 到新分支上会误报 ——
 *    报告里点名那个提交,人一看就知道。
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
 * 一条在等评审的分支不断补提交才能保持绿 —— 那只能靠空提交,而空提交是这个
 * 仓库明令不做的事(`process/6-INTEGRATE.md`)。
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
