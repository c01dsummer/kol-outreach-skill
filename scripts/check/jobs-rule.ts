/**
 * 变异跑的**派工**判定 —— 派几个、结论怎么带回来、派出去却没回话的怎么算。
 *
 * 变异跑起来之后几乎所有时间都在等验证者（实测一次完整 `npm run mutate` 里，
 * 293 条各起一次验证者，占整条 `npm run check` 的九成）。要压这段时间只有两条路：
 * 让每一次跑得更快，或者同时跑几条。这个模块管后者的判定那一半。
 *
 * ## 为什么必须一人一个目录
 *
 * 一条变异是**真的改写一份源文件**，跑完再还回去。两条变异同时改同一棵树的话，
 * 验证者跑的是「两处改动叠在一起」那棵树 —— 而报告仍按条归因。那不是变慢，
 * 是**每一条的绿或红都不算数**。所以并行的单位是目录，不是进程：
 * 一个 worker 一份自己的源码树，改的、还的、写的覆盖记录全在自己那份里。
 *
 * ## 为什么是一条一派，不是先切好再发
 *
 * 先按条数切成 N 份最省事，但**切不平**：指名了验证者的那几条跑的是另一个验证者，
 * 代价与缺省那个不可比（实测自检一次 35 秒，需求测试一次 1.5 秒）。原型上量过：
 * 293 条切 6 份轮流发，两份落在 186 秒，另外四份 154 秒 —— 32 秒的空转，
 * 正是那两条自检的代价。要靠静态切法摊平，就得先知道每条要跑多久，
 * 而那个数今天没有人量过，猜一个写进代码就是把「不知道」伪装成「知道」。
 *
 * 一条一派不需要那个数：谁先空出来谁接下一条。代价是每条要回一句话，
 * 也就是下面这个格式。
 *
 * ## 派出去却没回话的，算「没查过」，不算通过
 *
 * worker 崩了、被杀了、汇报行被截断 —— 这几种在输出上长得都一样：**那一条没有结论**。
 * 把它当成「跑过了、没事」是 `process/README.md` 总纲里那个头号事故（把第三档压进
 * 「是」）。所以派出去的编号要逐个核回来，少一个就是硬失败。
 */
import type { RunVerdict } from './mutate-rule.js'

/** 一条变异跑完的结论。四种来自 `judgeRun`，外加「锚点失效，压根没应用上」 */
export type Outcome = RunVerdict | 'not-applied'

const OUTCOMES: readonly string[] = ['caught', 'elsewhere', 'crashed', 'survived', 'not-applied']

/**
 * 汇报行的记号。**写的一方和读的一方只此一份** —— 两边各写一个字面量的话，
 * 改一边不改另一边的症状是「每一条都没回话」，而那时报的是一整跑全军覆没，
 * 人会去翻变异集，不会去翻这个记号。
 *
 * 挑一个正常输出里不会出现的字符：worker 那一侧只往 stdout 写这一种行，
 * 但验证者的输出万一漏出来一行，也不能被认成结论。
 */
const MARK = '⟦结论⟧'

/** 一条变异的结论怎么写成一行 */
export const reportLine = (id: string, outcome: Outcome): string => `${MARK} ${outcome} ${id}`

/**
 * 一行汇报读回来。**认不出就是 undefined，不猜。**
 *
 * 认不出的分两种（不是这个记号开头的、结论那个词不在表里），但对调用方是同一件事：
 * 这一行不带结论。真正要紧的是**不许把认不出的当成「跑过了」** —— 一个把未知词
 * 兜底成 `caught` 的读法，会让一条崩掉的变异安静地记成被抓到。
 */
export function parseReport(line: string): { id: string; outcome: Outcome } | undefined {
  if (!line.startsWith(`${MARK} `)) return undefined
  const [outcome, id, ...rest] = line.slice(MARK.length + 1).split(' ')
  if (rest.length || id === undefined || id === '') return undefined
  return OUTCOMES.includes(outcome) ? { id, outcome: outcome as Outcome } : undefined
}

/**
 * 这一跑派几个 worker。**说不清要几个就交回 undefined**，由入口当场拒绝 ——
 * `MUTATE_JOBS=abc` 悄悄按机器核数跑，是把一个写错的配置当成没写。
 *
 * 命令行压环境变量：临时改一次不该要求先改环境。都没写就按机器核数。
 * 再按要跑的条数收口 —— 派出去的 worker 比变异还多，多出来那几个只是白起一遍进程。
 */
export function jobsWanted(
  argv: readonly string[], env: string | undefined, cpus: number, total: number,
): number | undefined {
  const flag = argv.find(a => a.startsWith('--jobs='))
  const asked = flag === undefined ? env : flag.slice('--jobs='.length)
  if (asked === undefined) return Math.max(1, Math.min(cpus, total))
  const n = Number(asked)
  if (!Number.isInteger(n) || n < 1) return undefined
  return Math.max(1, Math.min(n, total))
}

/**
 * 派出去了、却没有结论回来的那些编号。**顺序按派出去的顺序**，报告里才指得回表里那一行。
 *
 * 不做「多回来的」那一半：一个编号被答错成另一个，缺的那头照样在这里露出来，
 * 而多一条判据就多一处要维护的说法。
 */
export function missingVerdicts(handed: readonly string[], reported: ReadonlySet<string>): string[] {
  return handed.filter(id => !reported.has(id))
}
