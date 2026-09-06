/**
 * 变异跑完一次之后的判定 —— 抽出来是为了它能被测(它自己也在判定模块的名单上,M-H14-a 以下几条守着)。
 *
 * 「被抓到」原先的定义是「进程以非零退出」。评审指出这太宽:一个把进程弄崩的变异
 * (语法错、`TypeError`)也算被抓到,而崩溃不是任何一条断言的功劳 —— 它证明不了「那条测试
 * 有效」,只证明「代码跑不起来」。这一次自己就撞上过:M-H12-b 最初删掉整个 if 块、留下一个
 * 悬空的右花括号,`mutate` 照样报「被抓到」。
 *
 * 四态,不压成三态:
 *
 * | 状态 | 判据 |
 * |---|---|
 * | `caught` | 非零退出,打出了那个验证者的失败汇总,而且点了名的话红的正是那一条 —— 是断言红的 |
 * | `elsewhere` | 断言确实红了,**但红的不是 `kills` 点名的那条** |
 * | `crashed` | 非零退出,但没有汇总 —— 进程死在半路 |
 * | `survived` | 零退出 |
 *
 * `crashed` 不算抓到:一条只靠崩溃被抓到的变异,和它声称守的那条断言之间没有任何关系。
 *
 * `elsewhere` 是 ADR-70 加上来的第四态,它挡的是**假阳性**:一条变异把验证者弄红了,
 * 但红的是别处 —— 那它对 `kills` 点名的那条夹具什么也没证明。压进 `caught` 会让人以为
 * 那条夹具有效;压进 `survived` 或 `crashed` 又都是假话(它确实被某条断言抓到了)。
 * 三条路都错,所以它自成一态。
 *
 * ## 汇总那一行是唯一的契约,现在有两方
 *
 * 判定认的是验证者自成一行的失败汇总。原先只有 `scripts/test.ts` 一方,那句话写死在这里;
 * ADR-70 让变异可以指定验证者,于是**按它的说法给这个契约加一方**,而不是绕开它 ——
 * 每个验证者自带「跑哪个脚本」和「它的汇总长什么样」,两样在同一处声明,对不上就是判定的 bug,
 * 不是散在两个文件里的巧合。
 */

/** 一个验证者:跑哪个脚本,它失败时那句自成一行的汇总长什么样。 */
export interface Verifier {
  script: string
  summary: RegExp
}

/**
 * 认得的验证者。变异的 `by` 缺省 `test` —— 不写的那些逐字保持今天的行为。
 *
 * `selfcheck` 那条汇总是 `selfcheck.ts` 结尾打的 `✗ 脚本自检：N 项失败`,
 * 和 `test.ts` 的 `N 个失败` 不是一个形状 —— 不在这里分开写,每条接线变异都会被判 `crashed`。
 *
 * **这里是 `Record<string, …>`,不是 `as const` 加 `keyof typeof`**,和
 * `verifier-rule.ts` 的 `SELFCHECK_TOOLS` 有意不一样:那张表的消费方是 TS 代码,
 * 编译期钉得住;而 `by` 是从 `mutations.json` 读进来的字符串,编译期根本不在场。
 * 认不得的名字只能在运行时拦(`mutate.ts` 开跑前那一道),写成 `keyof` 只会让人以为
 * 有一道编译期的保证,而那道保证对这个输入不存在。
 */
export const VERIFIERS: Record<string, Verifier> = {
  test: { script: 'scripts/test.ts', summary: /(^|\n)\d+ 个失败\s*(\n|$)/ },
  selfcheck: { script: 'scripts/check/selfcheck.ts', summary: /(^|\n)✗ 脚本自检：\d+ 项失败\s*(\n|$)/ },
}

export type RunVerdict = 'caught' | 'elsewhere' | 'crashed' | 'survived'

/**
 * `kills` 点名的那条夹具红了没有。
 *
 * **匹配精确到 label 边界**:`✗ ` 之后要么正好是那条 label(整行到此为止),要么是
 * 「label ＋ `：`」。不这么钉的话,一条 label 是另一条的前缀时,红了短的会被算成红了长的 ——
 * 那正是 `kills` 要堵的错误归因,换个入口又发生一次(评审指出)。
 *
 * 用字符串比,不用正则:label 里满是中文全角括号,拼进正则要转义,而转义漏一个的坏法是静默的。
 *
 * ⚠️ **进程级的失败不算数。** 自检里「退出码不对」和「断言红了」原先打同一个 label,
 * 于是一条只把被测脚本弄崩的变异也能满足 `kills` —— 正是上面 `crashed` 那一态要拦的东西。
 * 所以自检给进程级失败加了一个记号(`verifier-rule.ts` 的 `SELFCHECK_PROCESS_MARK`),
 * 跟在名字后面 —— 两种边界都对不上,这里不必为它开特例。
 */
export function killsMatched(output: string, label: string): boolean {
  return output.split('\n').some(line => {
    const rest = line.trimStart()
    if (!rest.startsWith('✗ ')) return false
    const body = rest.slice(2)
    return body === label || body.startsWith(`${label}：`)
  })
}

/**
 * 一次运行算什么。
 *
 * `kills` 没写时不判第四态 —— 缺省跑测试的那两百多条变异没有点名任何夹具,
 * 对它们来说「断言红了」就是被抓到,行为与今天逐字一致。
 */
export function judgeRun(exitCode: number | null, output: string,
  verifier: Verifier, kills?: string): RunVerdict {
  if (exitCode === 0) return 'survived'
  if (!verifier.summary.test(output)) return 'crashed'
  if (kills === undefined) return 'caught'
  return killsMatched(output, kills) ? 'caught' : 'elsewhere'
}
