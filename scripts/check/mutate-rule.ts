/**
 * 变异跑完一次测试之后的判定 —— 抽出来是为了它能被测(它自己也在判定模块的名单上,M-H14-a 守着)。
 *
 * 「被抓到」原先的定义是「测试进程以非零退出」。评审指出这太宽:一个把测试进程弄崩的变异
 * (语法错、`TypeError`)也算被抓到,而崩溃不是任何一条断言的功劳 —— 它证明不了「那条测试
 * 有效」,只证明「代码跑不起来」。这一次自己就撞上过:M-H12-b 最初删掉整个 if 块、留下一个
 * 悬空的右花括号,`mutate` 照样报「被抓到」。
 *
 * 三态,不压成两态:
 *
 * | 状态 | 判据 |
 * |---|---|
 * | `caught` | 非零退出,**而且**打出了失败汇总(`N 个失败`)—— 是断言红的 |
 * | `crashed` | 非零退出,但没有汇总 —— 进程死在半路 |
 * | `survived` | 零退出 |
 *
 * `crashed` 不算抓到:一条只靠崩溃被抓到的变异,和它声称守的那条测试之间没有任何关系。
 * 汇总那一行是 `scripts/test.ts` 的对外输出 —— 它是这两个文件之间唯一的契约。
 */
export type RunVerdict = 'caught' | 'crashed' | 'survived'

/** `scripts/test.ts` 失败时最后打出的那一行 */
export const FAIL_SUMMARY = /(^|\n)\d+ 个失败\s*(\n|$)/

export function judgeRun(exitCode: number | null, output: string): RunVerdict {
  if (exitCode === 0) return 'survived'
  return FAIL_SUMMARY.test(output) ? 'caught' : 'crashed'
}
