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
import { basename } from 'node:path'

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
/**
 * 这一行是不是在**试图**汇报结论 —— 认得记号就算，哪怕后面读不出来。
 *
 * `parseReport` 把「不是汇报行」和「是汇报行但读不出来」都交回 undefined，对读的人是
 * 同一件事；**对派工那一侧不是**。前者是验证者漏出来的一句闲话，跳过就行；后者意味着
 * 那一条从此不会有结论了，而 worker 正等着下一个编号 —— 不收摊的话它永远等下去，
 * 整跑挂住。而挂住比硬失败更坏：模块头上承诺的是「少一个就是硬失败」，挂住连核账
 * 那一步都走不到。
 */
export const looksLikeReport = (line: string): boolean => line.startsWith(`${MARK} `)

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

/**
 * 这个名字**要不要带进 worker 的那份副本**。
 *
 * 为什么这是判定而不是 I/O：`docs/CONVENTIONS.md` 第 10 条把「跳过哪些目录、
 * 哪些文件算数」明写在判定那一层 —— 它决定 worker 看得见什么。这里错一格的后果
 * 不是跑得慢：**一份装着密钥的 `.env.local` 会被复制进每个 worker 目录**，
 * 正常跑完会删，被硬杀就留在盘上。
 *
 * 两张表，一张逐字比一张按前缀。`.env` 那一族必须按前缀 —— 这两张表合起来是
 * `.gitignore` 的**手抄本**，而手抄本会漂：实测漂过一次，`.gitignore` 里写着
 * `.env.local`，表里只有 `.env`，而逐字比认不出前者。
 *
 * 偏大的那一头是安全的：worker 不需要任何 `.env`，它继承派工进程的环境变量。
 * 跟着被挡掉的受跟踪文件 `.env.example` 也是有意的 —— 全仓库只有 `README.md`
 * 把它当一句 `cp` 的说明提过一次，没有任何代码从盘上读它。
 *
 * ⚠️ **两份表是手抄本这件事本身没修，只补了漏掉的那一项。** 真正的修法是不再手抄：
 * 让 `git ls-files --cached --others --exclude-standard` 来说哪些该复制，失败方向就从
 * 「不该带的漏进来」翻成「该带的漏出去」。挡着的是自检夹具 —— 它们的语料建在临时目录里，
 * **不是 git 仓库**，那条路会把它们全弄挂。欠条与重启条件记在 ADR-72。
 */
const SKIP = new Set(['node_modules', '.git', '.check-cache', 'output', 'memory'])
const SKIP_PREFIX = ['.env']
export function copyIntoWorker(src: string): boolean {
  const name = basename(src)
  return !SKIP.has(name) && !SKIP_PREFIX.some(p => name.startsWith(p))
}

/**
 * `spawn` 交回来的这个对象**根本没起来** —— 起进程时资源不够（打开的文件数到顶）时，
 * Node 在装管道之前就返回：`stdin`、`stdout`、`pid` 全是 undefined，而且不同步抛，
 * 真正的 errno 要等 `error` 事件才送到。
 *
 * 不先问这一句的后果**不是崩**，是**报错指错了地方**：紧跟着那句给 stdin 装监听器
 * 是同步的，会先一步抛「读不到 undefined 上的属性」，被外层接住打印出来 ——
 * 闸门那一侧照样非零退出、目录照样收干净，但人看到的原因是派工代码有 bug，
 * 于是去翻派工代码，而该做的是调高允许打开的文件数、或者少派几个。
 */
export function noStdio(kid: { stdin?: unknown }): boolean {
  return kid.stdin === null || kid.stdin === undefined
}

/**
 * 这个对象**根本没起来**，所以不许对它发信号。
 *
 * `spawn` 因为资源不够没起来时交回的对象上 `pid` 是 undefined，而对它调 `kill`
 * 打出去的**不是「那个子进程」** —— 实测那一刀落在**调用者自己这个进程组**上：
 * 进程当场 137（SIGKILL，不是未捕获异常的 1），紧跟在后面的收尾一句也走不到，
 * 半成品连同被改过的源码留在盘上。在终端里跑的话，挨刀的还包括人的那个前台组。
 *
 * 这条判定在别处已经有一份（`mutate-restore.ts` 停测试那一步的 `pid === undefined`
 * 就返回），而硬来那一步漏了 —— 同一个坑的第二处。抽在这里是为了第三处不要再漏，
 * 也为了它能被变异守住：留在入口里的话，指着入口的变异会被「自己验自己」拦下。
 */
export function neverStarted(kid: { pid?: number }): boolean {
  return kid.pid === undefined
}

/**
 * 硬来那一步**该对谁发信号** —— 起来了的都要，没起来的一个都不要。
 *
 * 为什么是一整个筛子、而不是在入口里写一句 `if (没起来) continue`：
 * **入口里的接线缺省那个验证者够不到**（`process/4-VERIFY.md`：改在那儿的变异只会
 * 「存活」）。守卫留在入口里的话，把那一句删掉，`neverStarted` 的单测和负片照样全绿 ——
 * 判定被守住了，而「入口到底有没有调它」没人守。整个筛子搬进来之后，入口只剩
 * 「遍历它交回来的那些」，而**筛错了谁**是这里的事，有单测也有负片。
 * （#112 第二轮机器评审指出，那一轮 0 条讨论串、两条都在汇总的「抑制」里。）
 */
export function signalTargets<T extends { pid?: number }>(kids: Iterable<T>): T[] {
  return [...kids].filter(kid => !neverStarted(kid))
}

/**
 * 硬来那一步要收掉的**验证者那一组**,它的号怎么从 worker 传到派工进程。
 *
 * ## 为什么非传不可
 *
 * 拓扑是两层,而且两层的组不一样(`mutate.ts` 两处 `spawn` 实测):
 * worker 起的时候没有 `detached`,跟派工进程同一组;验证者起的时候 **有** `detached`,
 * 自成一组。验证者那个 `detached` 去不掉 —— 「见齐就停」靠 `process.kill(-验证者pid)`
 * 连 tsx 壳底下那个真正跑脚本的进程一起收,不自成一组就没有那个负号可用。
 *
 * 于是派工进程手上没有任何一个号能打到验证者那一组:杀 worker 那一组会打到自己,
 * 杀 worker 自己够不到孙子。**只剩把号传上来这一条。**
 *
 * ## 为什么走文件,不走已经有的那根 stdout 管子
 *
 * **硬来那一步是同步的,而管道不是。** 它从三个地方进来 —— `error` 事件、`noStdio`、
 * 建目录那一圈的外层 catch —— 其中后两条发生在派工进程**一次事件循环都还没转过**的时候
 * (`cpSync` → `spawn` → 第一次 `hand()` 是一整趟同步)。那时管道里就算躺着一行号,
 * 也还没变成「派工进程知道」。文件不挑这个:`readFileSync` 当场就读得到。
 *
 * 代价诚实写在这里:**fd 到顶那一次硬来,号一个都读不出来**,那几组验证者照旧漏掉。
 * 挡住的是「不吭声」——读不动要出一句 `warn`(见 `hardStopPlan`),不是静默退化成空操作。
 *
 * ## 为什么经命令行参数告诉 worker,不经环境变量
 *
 * 环境变量会**继承下去**:worker 起验证者时 `env: { ...process.env }` 原样带过去,
 * 验证者又可能是另一个 `mutate`(自检把它当工具起)。那样每一层都要「记得掐掉」,
 * 而漏掉一层的症状是一份号文件被两个进程抢着写,读回来的号指向别人。
 * 命令行参数天生不继承 —— 验证者是 `tsxCommand([verifier.script])` 起的,argv 是新的,
 * 看不见这个参数。**没有一处要记得掐,也就没有一处会漏。**
 */
export const BEACON_FLAG = '--beacon='

/**
 * 第 `i` 个 worker 的号文件搁哪。**派工进程算一次**,既记在自己表里、又拼进 argv 交给 worker。
 *
 * 两处讲究,各挡一种坏法:
 *
 * - **是 `w<i>/` 的兄弟,不是它的孩子。** 那个目录是 `cpSync` 复制出来的源码树,
 *   也是验证者的 cwd,还是收尾那句 `rmSync` 的目标。号文件落进去会跟着被复制、
 *   被检查链看见、被当成树的一部分。放在外面、仍在 `JOBS_DIR` 底下,收尾顺手收掉。
 * - **名字里带派工进程的号。** 同一棵树上另一跑(或者被当工具起的另一个 `mutate`)
 *   留下的号文件,路径就对不上,我们读都不会去读 —— **不会拿着别人的号去开刀**。
 *   ⚠️ 挡的只有这一头。它**挡不住别人把我们这份删掉** —— 两跑共用同一个根目录、
 *   `w<i>` 还同名,那一格还开着(实测过,记在 ADR-74);也堵不住**号被系统回收**给别人。
 */
export function beaconPathOf(jobsDir: string, dispatcherPid: number, i: number): string {
  return `${jobsDir}/w${i}.${dispatcherPid}.verifier`
}

/**
 * 这一跑有没有人收号,收在哪。**没有就是 undefined,不猜一个默认路径。**
 *
 * 三种「没有」都要认出来:串行那条路(压根不派工)、被当工具起的 `mutate`、`--brief`。
 * 空值那一种尤其要挡 —— `--beacon=` 后面什么都没有时若当成合法路径,worker 会去写一个
 * 空路径,抛在 `close` 监听器里,那一轮的还原整个不跑,被改过的源文件留在工作区。
 */
export function beaconFrom(argv: readonly string[]): string | undefined {
  const flag = argv.find(a => a.startsWith(BEACON_FLAG))
  if (flag === undefined) return undefined
  const path = flag.slice(BEACON_FLAG.length)
  return path === '' ? undefined : path
}

/**
 * worker 这一侧**整个筛子**:这一轮该不该留号、留在哪、留什么。
 *
 * 为什么是一整个筛子而不是在入口里写一句 `if`:**入口里的接线缺省那个验证者够不到**
 * (`process/4-VERIFY.md`:改在那儿的变异只会「存活」)。守卫留在入口里的话,把那一句
 * 删掉,这里的单测和负片照样全绿 —— 判定被守住了,而「入口到底有没有调它」没人守。
 * 和 `signalTargets` 同一个路数。
 *
 * 两道拒:**没人收**(串行路)不留;**验证者压根没起来**(`pid` 是 undefined,
 * 复用 `neverStarted` 那条判据)也不留 —— 留了也只是一行 `undefined` 字样,
 * 读回来就是「该杀谁不知道」,而那比没有号更糟:它看起来像有。
 *
 * 正文末尾那个换行**是格式的一部分**,不是排版:读的那一半据此认「这一份写完了没有」。
 * 少了它,一次写到一半的 `12345` 会被读成 `1234` —— 那是对着一整组不相干的进程开刀。
 */
export function beaconNote(
  beacon: string | undefined, pid: number | undefined,
): { path: string; text: string } | undefined {
  if (beacon === undefined) return undefined
  if (neverStarted({ pid })) return undefined
  return { path: beacon, text: `${pid as number}\n` }
}

/**
 * 该抹哪一份号,没有就 undefined。
 *
 * **抹号和留号一样是判定,必须成对住在这里。** 留在入口里写成一句裸的
 * `rmSync(beacon, …)` 的话,串行那条路上 `beacon` 是 undefined,当场
 * `ERR_INVALID_ARG_TYPE` —— 而它抛在验证者的 `close` 监听器里,于是那个 promise
 * 永不落地、`runOne` 的 `finally` 不跑、**被改过的源文件留在工作区**。
 * 成对搬进来之后,入口只剩「它给了就抹」,写不出那种坏法。
 */
export function beaconGone(beacon: string | undefined): string | undefined {
  return beacon
}

/**
 * 从 `/proc/self/stat` 的正文里取**这个进程自己那一组的号**。
 *
 * 为什么要读 procfs:`'getpgrp' in process` 实测是 `false` —— Node 没有把它露出来,
 * 而自保守卫必须比**组号**。比 pid 是一道假守卫:实测 shell 底下
 * `pgid(27794) ≠ pid(27795)`,那一条永远不命中,配它的负片也就是一条假负片。
 *
 * 切法要讲究:**从最后一个 `)` 之后切,取第 3 段**(state、ppid、pgrp)。
 * 按空格整行切再取第 5 段的写法,遇到 comm 里带空格或右括号的进程就取到别的数上 ——
 * 而那个数会被当成「我自己这一组」拿去比对,比错了等于没有守卫,且不响。
 *
 * 读不出来交回 undefined。**那时这一格就是没守**,不假装守住了 —— 非 Linux、
 * procfs 没挂的时候都是这样,如实记在 ADR-74。
 */
export function ownGroup(stat: string): number | undefined {
  const tail = stat.slice(stat.lastIndexOf(')') + 1).trim()
  if (tail === '') return undefined
  const pgrp = tail.split(/\s+/)[2]
  if (pgrp === undefined) return undefined
  const n = Number(pgrp)
  return Number.isSafeInteger(n) && String(n) === pgrp ? n : undefined
}

/**
 * 读一份留下来的号,交回**可以原样交给 `process.kill` 的那个负数**。认不出就 undefined,不猜。
 *
 * 这是整条改动里最危险的一格 —— 它算出来的东西会被当成信号的目标。逐条写明每一拒挡的是什么:
 *
 * | 拒 | 挡的坏法 |
 * |---|---|
 * | 没有正文 / 空 | 没有号可用,这一次就当没有 |
 * | **末尾没有换行** | 写到一半的 `12345` 被截成 `1234` —— 杀错一整组,而且不响 |
 * | **往返核对** `String(n) === 主体` | `Number` 认 `0x10`／`1e3`／`007`／`''`,实测分别是 16／1000／7／0,每一个都能悄悄变成一个号 |
 * | 不是安全整数 | 同上,越界之后比较与还原都不作数 |
 * | **`n <= 1`** | `0` 在 POSIX 里打的是**调用者自己这一组**(而 JS 里 `-0 === 0`);`1` 更狠 —— `kill(-1, …)` 不是「1 号那一组」,是**发给发得出的每一个进程** |
 * | `n === self.pid` | 便宜,挡住一份写坏的号正好撞上自己 |
 * | **`n === self.pgid`** | 真正的自杀向量。拿不到组号时这一拒不成立,见 `ownGroup` |
 *
 * **负号加在这一层。** 入口一处算术都不做 —— 少了负号只杀 tsx 壳,里面那个照样把
 * 后面那次写盘做完(`mutate-restore.ts` 的 `killTest` 上记着实测),而那是不响的。
 *
 * **没有「超过 PID_MAX 就拒」那一条**,而且是有意不加:实测本机 `pid_max` 是 32768,
 * 而 systemd 常把它设成 4194304 —— 写死哪个都错。写小了把合法的大号判成认不出,
 * 那一刀干脆不发,不响;写大了等于没这一拒。越界的号发出去只会拿到 ESRCH,
 * 而那一支本来就被吞掉。
 */
export function groupShot(
  text: string | undefined, self: { pid: number; pgid?: number },
): number | undefined {
  if (text === undefined || !text.endsWith('\n')) return undefined
  const body = text.slice(0, -1)
  const n = Number(body)
  if (!Number.isSafeInteger(n) || String(n) !== body) return undefined
  if (n <= 1 || n === self.pid || n === self.pgid) return undefined
  return -n
}

/** 硬来那一步的一记动作。`shot` 已经是负数,入口照发即可 */
export type HardStep<T> =
  | { do: 'kid'; kid: T }
  | { do: 'group'; shot: number }
  | { do: 'warn'; text: string }
  | { do: 'sweep' }

/**
 * 硬来那一步**打哪几刀、按什么顺序、读不出来说不说话** —— 一整个筛子。
 *
 * 整段搬进来而不是留在入口,有两个各自独立的理由:
 *
 * 1. 和 `signalTargets` 同一条:入口里的接线缺省那个验证者够不到,留在那儿的顺序
 *    改掉也不会红。
 * 2. **顺序契约登记不了。** 留在 `mutate.ts` 的话,契约位置只能写那个文件,而指着它的
 *    变异不写 `by` 只会「存活」,写了 `by: "selfcheck"` 又被 `selfVerifying` 当场拦下
 *    (`mutate.ts` 是自检的工具种子)。搬到这里之后,守它的是两条缺省验证者的变异。
 *
 * 次序定死,而**承重的只有一段**:
 *
 * ```
 * ① 每个还活着的 worker 壳一刀(signalTargets 筛过)
 * ② 每个读得出号的验证者组一刀(已取负、已去重)
 * ③ 号读不动的各出一句 warn
 * ④ 删隔离目录
 * ```
 *
 * **② 必须在 ④ 之前,这是唯一真正承重的一段。** 验证者的 cwd 就是那个 worker 目录:
 * 先删后杀的话,刀落下之前它还能往一棵已经被删掉的树里写,盘上重新长出半成品,
 * 而删那一句已经成功返回、诊断根本不打 —— **静默**。倒过来至多剩下「一次已经交给内核的写」,
 * 撞上时删会抛 `ENOTEMPTY`,被现成那个 catch 接住打诊断 —— **响**的。
 *
 * **③ 在 ④ 之前**:那句「隔离目录没收干净」是给人指路的,号读不动这件事得排在它前面
 * 一起被看见,不能被盖掉。
 *
 * **① 与 ② 的先后买不到任何东西** —— 这一句要写明,不许写成「先杀 worker 就冻住了集合」。
 * 实测:那一刀落在 tsx 壳上,壳底下真正的 worker 进程**活着**(tsx 转发 SIGTERM,但
 * SIGKILL 转发不了)。真正让集合近似冻住的是派工协议本身:`hand()` 一条一派,
 * 任何时刻一个 worker 手上至多一个没消化的编号;派工进程一进硬来就不再转事件循环,
 * 也就不会再有新编号出去。
 *
 * **三种状态,三条路,一条都不许压掉。** ENOENT = 没起验证者,那是「量出来是零」,不吭声;
 * 读不动(别的 errno)是「没量成」,出一句话;**号在却认不得**(写了一半、不是个号)是
 * 「量到了但读不懂」—— 确实起过一个验证者而我们不知道该收谁,也要出一句话。
 * 把后两种压进第一种,每一次都安安静静地漏掉一组;把第一种压进后两种,每一次正常的硬来
 * 都刷一堆吓人的话,真出事那次淹在里面。
 *
 * **这一刀只收一层。** 收的是验证者自己那一组;验证者若再 `detached` 分出去孙子,
 * 那个孙子逃出这一组,谁也收不到 —— 如实写在这里,不写成「收掉它底下的一切」。
 */
export function hardStopPlan<T extends { pid?: number }>(
  slots: Iterable<{ kid: T; beacon: string }>,
  read: (path: string) => { text?: string; error?: string },
  self: { pid: number; pgid?: number },
): HardStep<T>[] {
  const all = [...slots]
  const steps: HardStep<T>[] = signalTargets(all.map(s => s.kid)).map(kid => ({ do: 'kid', kid }))
  const shots: number[] = []
  const warns: HardStep<T>[] = []
  for (const s of all) {
    const got = read(s.beacon)
    if (got.error !== undefined) {
      warns.push({ do: 'warn', text: `\n  ⚠️ 验证者的号读不出来(${got.error})：${s.beacon}`
                                     + ` —— 那一组没收掉,可能还在跑被改过的源码\n` })
      continue
    }
    // **号在、却认不得**，和「压根没有号」是两回事：前者意味着确实起过一个验证者，
    // 而我们不知道该收谁 —— 那一组会被静默过继出去，同时这边照样删目录、照样报「收干净了」。
    // 压成一个值正是本文件上面那句「两种状态不许压成一个值」骂的那件事，而头一版就是那么写的
    // （#116 第一轮评审指出）。
    if (got.text === undefined) continue
    const shot = groupShot(got.text, self)
    if (shot === undefined) {
      warns.push({ do: 'warn', text: `\n  ⚠️ 验证者的号不能拿去发刀（写了一半、不是个号，`
                                     + `或者指向不许打的目标）：${s.beacon}`
                                     + ` —— 那一组没收掉，可能还在跑被改过的源码\n` })
      continue
    }
    shots.push(shot)
  }
  // **去重**：两个 worker 报了同一个号时只挨一刀。第二刀落下时那一组多半已经散了,
  // 拿到 ESRCH 被吞掉 —— 除非那个号正好已经被系统回收给了别人
  for (const shot of new Set(shots)) steps.push({ do: 'group', shot })
  steps.push(...warns)
  steps.push({ do: 'sweep' })
  return steps
}
