/**
 * 变异跑完一次之后的判定 —— 抽出来是为了它能被测(它自己也在判定模块的名单上)。
 *
 * 「被抓到」原先的定义是「进程以非零退出」。评审指出这太宽:一个把进程弄崩的变异
 * (语法错、`TypeError`)也算被抓到,而崩溃不是任何一条断言的功劳。自己撞过:M-H12-b
 * 最初删掉整个 if 块、留下一个悬空的右花括号,`mutate` 照样报「被抓到」。
 *
 * 四态,不压成三态:
 *
 * | 状态 | 判据 |
 * |---|---|
 * | `caught` | 非零退出,打出了那个验证者的失败汇总,而且点了名的话红的正是那一条 |
 * | `elsewhere` | 断言确实红了,**但红的不是 `kills` 点名的那条** |
 * | `crashed` | 非零退出但没有汇总,或者这一次出过进程级的失败 |
 * | `survived` | 零退出 |
 *
 * `elsewhere` 单成一态,是因为另外三条路都错:压进 `caught` 会让人以为那条夹具有效,
 * 压进 `survived` 或 `crashed` 又都是假话 —— 它确实被某条断言抓到了,只是不是那一条。
 */
import { SELFCHECK_PROCESS_MARK } from './verifier-rule.js'

/** 一个验证者:跑哪个脚本,失败汇总长什么样,进程级失败带什么记号。 */
export interface Verifier {
  script: string
  summary: RegExp
  /** 不填就是这个验证者分不出「进程级失败」与「断言红了」(`test` 就是) */
  processMark?: string
}

/**
 * 认得的验证者。变异的 `by` 缺省 `test` —— 不写的那些逐字保持今天的行为。
 *
 * **判定认的是验证者自成一行的失败汇总,而每个验证者的汇总不一样**:自检打的是
 * `✗ 脚本自检：N 项失败`,测试打的是 `N 个失败`。所以「跑哪个脚本」和「它的汇总长什么样」
 * 在同一处声明 —— 分开放的话,换一边不换另一边的症状是「它真的红了,却被判成崩了」。
 *
 * 用 `Record` 不用 `as const` 加 `keyof typeof`(与 `verifier-rule.ts` 的 `SELFCHECK_TOOLS`
 * 有意不同):那张表的消费方是 TS 代码,而 `by` 是从 JSON 读进来的字符串,编译期不在场。
 * 认不得的名字只能在运行时拦,写成 `keyof` 只会让人以为有一道并不存在的编译期保证。
 */
export const VERIFIERS: Record<string, Verifier> = {
  test: { script: 'scripts/test.ts', summary: /(^|\n)\d+ 个失败\s*(\n|$)/ },
  selfcheck: {
    script: 'scripts/check/selfcheck.ts',
    summary: /(^|\n)✗ 脚本自检：\d+ 项失败\s*(\n|$)/,
    processMark: SELFCHECK_PROCESS_MARK,
  },
}

/** 这一次运行里,有没有过一条**进程级**的失败。 */
export function processFailed(output: string, mark: string): boolean {
  return output.split('\n').some(l => l.trimStart().startsWith('✗ ') && l.includes(mark))
}

/**
 * `by` 与 `kills` 这一对写得成不成立 —— 三种不成立各有名字,成立时返回 `undefined`。
 *
 * 判定在这里、打印在入口(`docs/CONVENTIONS.md` 第 10 条)。同一个入口里的另外两道体检
 * 早就是这形状(`attribution-rule.ts` / `why-rule.ts`),这一道原先留在入口里是它自己不合群。
 *
 * | 不成立 | 不拦会怎样 |
 * |---|---|
 * | `unknown-verifier` | 判定拿到的不是验证者,当场抛在跑变异那一段 —— 人看见的是一个栈,不是「名字写错了」 |
 * | `missing-kills` | 只知道「那个验证者红了」,红在哪儿不问,一条把别处弄红的变异照样记成被抓到 |
 * | `kills-without-by` | 那是 ADR-70 明写要另外评定的延伸:机制生效、没有规矩、没有记录 |
 *
 * ⚠️ **认的是自有键,不是「原型链上有没有」**(评审指出):后者会放行语言内建的那几个名字,
 * 它们「在」这个对象上,取出来却不是验证者 —— 这道体检就在它唯一该说话的时候抛了个栈。
 */
export type WiringFault = 'unknown-verifier' | 'missing-kills' | 'kills-without-by'

export function wiringFault(mut: { by?: string; kills?: string }): WiringFault | undefined {
  if (mut.by === undefined) return mut.kills === undefined ? undefined : 'kills-without-by'
  if (!Object.hasOwn(VERIFIERS, mut.by)) return 'unknown-verifier'
  return mut.kills === undefined ? 'missing-kills' : undefined
}

/**
 * 验证者源码里**打完汇总立刻退出**的写法 —— 交回撞上的那一段,没撞上交回 `undefined`。
 *
 * 汇总是最后打的,紧跟着硬退出、而输出又接着管道(变异就是这么跑的),那一行可能还没
 * 写出去就被截掉:退出码非零、汇总没有,判定只能判 `crashed`。**一条真被抓到的变异被
 * 报成跑不起来,而且时红时绿。** 实测(40 次一组):积压全在另一条流上时一次不丢 ——
 * 我上一轮只量了这一种,结论下早了;而自检真失败时诊断和汇总都在 stderr,积压 400 行
 * 丢 18 次、3400 行丢 31 次。改成设退出码让进程自己走完,两种都是 0 次。
 *
 * 顺带买到第二样:**没有提前退出,就没有绕过汇总的路** —— 自检原先「孤儿文件」那一条
 * 就是打完自己那句话直接退出,它的失败根本到不了汇总。
 *
 * ⚠️ 扫的是源码字面,**注释也算**(和 `mutate-restore.ts` 那条同步等法的判据同一处境)。
 * 只提名字不带括号的是散文,不算;要举反例得把那一串拼出来,别写成整串。
 */
const HARD_EXIT = /\bprocess\.exit\s*\(/

export function exitRace(source: string): string | undefined {
  return HARD_EXIT.exec(source)?.[0]
}

export type RunVerdict = 'caught' | 'elsewhere' | 'crashed' | 'survived'

/**
 * `kills` 点名的那条夹具红了没有。
 *
 * **匹配精确到 label 边界**:`✗ ` 之后要么正好是那条 label,要么是「label ＋ `：`」。
 * 不这么钉的话,一条 label 是另一条的前缀时,红了短的会被算成红了长的 —— 那正是
 * `kills` 要堵的错误归因,换个入口又发生一次(评审指出)。
 *
 * 用字符串比不用正则:label 里满是中文全角括号,拼进正则要转义,而转义漏一个是静默的。
 *
 * ⚠️ **它管不了「崩溃算不算数」,那一道在 `judgeRun` 上。**
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
 * **被信号杀掉(没有退出码)一律 `crashed`**,哪怕汇总已经打出来了:那一次没跑完,
 * 它剩下的断言一条也没说过话,拿它当证据就是拿半份跑当整份用。这个洞从判定第一版
 * 就在,是 ADR-70 把四态表写出来之后才看得见「散文说的」与「代码做的」对不上。
 *
 * `kills` 没写时不判第四态 —— 缺省跑测试的那两百多条没有点名任何夹具,行为逐字如旧。
 *
 * **出过进程级失败,这一次的证据就不算数。** 记号只贴在打那句话的那一行上,护不住它
 * 后面照打的派生诊断 —— 实测一条只把 `collect` 弄崩的变异会漏出「没有留下可读的断点」
 * 这类不带记号的 `✗`,`kills` 点它就成了把崩溃的功劳记到断言头上(评审第三轮指出,
 * 我第一轮驳回错了)。所以拦在**整次运行**这一层:记号只有一个打点(`runBoth`),
 * 而派生诊断有几十处、还会长 —— 保证要挂在不随数量长的那一头。
 *
 * 代价是**保守的假阴性**:一次里既崩了、又真红了点名那条,现在也判 `crashed`;
 * 「入口的退出码接线」也从此没法靠 `kills` 认领 —— 那条路本来就只能靠点名派生诊断
 * 走通,而那正是要堵的错误归因。
 */
export function judgeRun(exitCode: number | null, output: string,
  verifier: Verifier, kills?: string): RunVerdict {
  if (exitCode === 0) return 'survived'
  if (exitCode === null) return 'crashed'
  if (!verifier.summary.test(output)) return 'crashed'
  if (kills === undefined) return 'caught'
  if (verifier.processMark !== undefined && processFailed(output, verifier.processMark)) return 'crashed'
  return killsMatched(output, kills) ? 'caught' : 'elsewhere'
}
