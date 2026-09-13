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

/**
 * 跑一条变异得到的东西：结论，外加判「跑不起来」那一档要摆出来的现场。
 *
 * **现场必须跟着结论走。** 派工跑的时候「跑」在 worker 进程里、「报」在派工进程里，
 * 现场留在 worker 的局部变量里过不了那道边界 —— 报告就只剩一句「跑不起来」而没有
 * 为什么，而那正是这一档唯一的用处（分辨「真崩了」与「这一次不巧」）。
 */
export interface Ran {
  outcome: Outcome
  /** 验证者的退出码。被信号杀掉时是 `null` —— 和「退出码 0」不是一回事 */
  status: number | null
  /** 是不是因为点名的那些都红了而被主动停掉 */
  stopped: boolean
  /** 验证者说过的话。**只有判 `crashed` 那一档才带回来**，理由在 `reportLine` 上 */
  output: string
}

/**
 * 一条变异的结论怎么写成一行。
 *
 * **整份编码成 JSON**，不是用空格拼：现场是多行的，而这条线是按行读的 ——
 * 拼出来的话第一个换行就把一行劈成两行，后半截成了「认不出的那种」。
 * `JSON.stringify` 会把换行转义掉，一行还是一行。
 *
 * **只有 `crashed` 那一档带现场。** 另外四档的结论自己就够清楚，而三百多条各带一份
 * 完整输出要从管道里挤过去，白花钱。这不是省事，是那一档之外没人读它。
 */
export const reportLine = (id: string, ran: Ran): string =>
  `${MARK} ${JSON.stringify({ ...ran, id, output: ran.outcome === 'crashed' ? ran.output : '' })}`

/**
 * 一行汇报读回来。**认不出就是 undefined，不猜。**
 *
 * 认不出的有好几种（不是这个记号开头的、不是合法 JSON、少字段、字段类型不对、
 * 结论那个词不在表里），但对调用方是同一件事：这一行不带结论。真正要紧的是
 * **不许把认不出的当成「跑过了」** —— 一个把未知词兜底成 `caught` 的读法，
 * 会让一条崩掉的变异安静地记成被抓到。
 *
 * **每一个字段都要验，不是只验结论那个词。** 只验到「是个对象」为止的话，
 * 一份 `status` 是字符串、`output` 缺失的行会通过这一关，然后在报告里被当成现场去印 ——
 * 该说「这一行读不出来」的地方变成一句不知所云的诊断（`claims.ts` 的
 * `claimsWellFormed` 是同一条道理，那边也栽过）。
 */
export function parseReport(line: string): ({ id: string } & Ran) | undefined {
  if (!line.startsWith(`${MARK} `)) return undefined
  let raw: unknown
  try { raw = JSON.parse(line.slice(MARK.length + 1)) } catch { return undefined }
  if (raw === null || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const { id, outcome, status, stopped, output } = r
  if (typeof id !== 'string' || id === '') return undefined
  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome)) return undefined
  if (status !== null && typeof status !== 'number') return undefined
  if (typeof stopped !== 'boolean' || typeof output !== 'string') return undefined
  return { id, outcome: outcome as Outcome, status, stopped, output }
}

/**
 * worker 手上那个验证者的**组号**。跟在结论后面另开一种行，因为它要在那一条跑**完之前**
 * 就到派工那一侧手里 —— 结论到的时候，验证者已经结束了。
 *
 * ## 为什么派工那一侧非知道这个数不可
 *
 * 打断时的硬来那一步（宽限期到了、或者人又按了一次）是对 worker 发 SIGKILL，
 * 而 SIGKILL 挡不住也接不住：worker 当场没了，**来不及停掉手上的验证者**。
 * 那个验证者自成一组（`mutate.ts` 里的 `detached`，为的是 worker 能连它底下
 * 那个真正跑脚本的进程一起杀 —— 实测 `tsx` 的壳会再分出一个孙子进程，只杀壳，
 * 孙子照样跑完），于是它既收不到打在 worker 身上的那一刀，也收不到打在派工进程上的。
 * 结果是：人按了两次 Ctrl-C，命令行回来了，几个验证者还在后台跑着被改过的源码。
 *
 * 一个进程只能在一个组里，所以「worker 能按组杀验证者」和「派工能按组杀干净」
 * 没有任何一种拓扑同时成立 —— 派工那一侧只能**被告知**那个组号。
 *
 * 派工那一侧记下这个数，收到那一条的结论时抹掉（结论到手意味着验证者已经结束了）。
 * 残留的窗口只有「验证者咽气」到「结论送达」之间那一瞬，那期间记着的是个死组号；
 * 拿它去杀会报「查无此组」，吞掉。**号码回收在这个窗口里理论上仍可能撞上**，
 * 但它不是那种会越攒越多的窗口（对照 `test.ts` 里 D4 那一族踩过的：孤儿只增不减，
 * 概率单调上升），这里每一瞬都随结论关掉。
 */
const LIVE = '⟦验证者⟧'

export const verifierLine = (pgid: number): string => `${LIVE} ${pgid}`

/**
 * 读回一个组号。
 *
 * 这一行来自另一个进程的 stdout：读不出一个整数就当没有。**「能不能拿它去发信号」
 * 不在这儿判**，在 `hardTargets` —— 判据放在会出事的那一头，不在读的这一头。
 */
export function parseVerifier(line: string): number | undefined {
  if (!line.startsWith(`${LIVE} `)) return undefined
  const n = Number(line.slice(LIVE.length + 1))
  return Number.isInteger(n) ? n : undefined
}

/**
 * 硬来那一步，刀往哪儿发。
 *
 * ## 两层都要，而且**两层都按组**（负号）
 *
 * 起一个 `.ts` 要经过 `tsx` 的壳，而那个壳会**再分出一个真正跑脚本的进程**
 * （`tsx-cmd.ts`，本条重新实测过）。`spawn` 拿到的 pid 是壳的，不是干活那个的。
 * SIGTERM 那一档不必操心 —— 实测壳会把它转下去；**SIGKILL 转不了**，
 * 打在壳上就是「壳没了，干活那个变成孤儿接着跑」。
 *
 * 所以这里两串都要负号：
 *
 * - **worker 那一串**：不加负号，刀落在 `tsx` 的壳上，真正在跑变异的那个进程活下来，
 *   连它手上的验证者一起被过继出去（#109 实测：`ps` 里两个 `--worker` 挂在 1 号进程
 *   底下接着跑，而派工进程已经退了）
 * - **验证者那一串**：它们自成一组，既收不到打在 worker 身上的那一刀，
 *   也收不到打在派工进程上的（Copilot 在 #109 上指出的就是这一条）
 *
 * 负号是 POSIX 的进程组语义。Windows 那一半没修，`mutate.ts` 的模块头上写着。
 *
 * ## worker 那一串排在前面
 *
 * 反过来的话，先杀掉的验证者会让 worker 收到一次「跑完了」，于是它汇报、接下一条、
 * **再起一个验证者** —— 那一个的组号谁也没记下，正好逃过这一轮。
 * 先把 worker 摁死，就没有新的组会冒出来。
 *
 * ## 0 和 1 一律不发
 *
 * 这不是洁癖，是这个函数唯一能造成的那种事故：
 *
 * - `process.kill(-0, …)` 打的是**自己这一组** —— 派工进程连同全部 worker 一起没了，
 *   而且是在 `rmSync` 收目录之前，隔离目录全留在盘上
 * - `process.kill(-1, …)` 在 POSIX 上是「打给这个用户有权打的**每一个**进程」——
 *   在 CI 上就是把整个 runner 掀了
 *
 * 判据放在这儿而不是读那一行的地方：worker 那一串不经过任何一行汇报，
 * 而两串最后都要从这里出去。**会出事的是发信号这一头，判据就守在这一头。**
 *
 * ## ⚠️ 两串里，只有验证者那一串有夹具证明
 *
 * 自检那份打断夹具（按两次那一趟）实测过：**去掉验证者那一串，它当场红**
 * —— 账还在长，有验证者被过继出去了。
 *
 * **worker 那一串去掉，夹具照样全绿。** 这是实测出来的，不是推的：把 `mutate.ts` 里
 * worker 的 `detached` 拿掉（组号于是指不着任何组，这一串每一刀都落空），三条断言
 * 一条没红。原因是那一趟里 worker 还醒着 —— 验证者被杀掉之后它去读 stdin，
 * 而派工进程已经退了，读到 EOF 就自己收工了。
 *
 * 所以这一串守的是**另一种 worker**：不再读 stdin 的那种（死循环、卡在某处同步调用）。
 * 那正是硬来这一步存在的理由，也正是**造不出夹具的那一种** —— 要造得出，就得给
 * `mutate.ts` 开一个只有测试才用的口子，而那样证明的是那个口子，不是这条路。
 * 如实记在这里：**这一串没有任何自动化验过**，它靠的是「SIGKILL 转不下去、
 * 而 `spawn` 拿到的是 `tsx` 的壳」这两件实测过的事实推出来的。
 */
export function hardTargets(
  workerGroups: Iterable<number>, verifierGroups: Iterable<number>,
): number[] {
  return [...workerGroups, ...verifierGroups].filter(g => g > 1).map(g => -g)
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
