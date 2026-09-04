/**
 * 变异跑到一半被打断时,把动过的源文件还回去。
 *
 * `mutate.ts` 每应用一个变异就**改写一份真实源文件**,跑完测试再由 `finally` 改回来。
 * **信号杀进来时 `finally` 不跑** —— Ctrl-C、被杀掉、CI 超时、终端关掉,没人接管这几个
 * 信号时 Node 当场结束进程,`finally` 和挂在退出上的清理一个都不执行。那一刻留在
 * 工作区里的,是一处**故意违反某条需求的改动**,而没有任何东西说过它在那儿。
 *
 * 它有多难被发现:下一次 `npm run check` 报的是「锚点失效,未能应用」——
 * 一句指着变异集的话,而错的是上一次没跑完。中间要是把工作区整个提交上去,
 * 进去的就是那处改动。
 *
 * **挡不住硬杀和断电** —— 那时没有任何代码跑得起来。和落盘那边「先写临时文件
 * 再改名」同一个形状:能挡的是「被打断」,不是「被硬杀」,差额明写在这里,不假装。
 *
 * 抽成模块而不是写在入口里:什么时候该写回、什么时候不该,是判定,
 * 而判定写在入口脚本里就永远测不到(`docs/CONVENTIONS.md` 第 10 条)。
 */
import { writeFileSync } from 'node:fs'

/** 正被改写的那个源文件和它的原文。没有变异在跑的时候是 undefined */
let inFlight: { file: string; orig: string } | undefined

/** 要开始改这个文件了 —— 记下现场,好让被打断的时候有东西可还 */
export function beginMutation(file: string, orig: string): void {
  inFlight = { file, orig }
}

/**
 * 把现场还回去。跑完一个变异走这里,被信号打断也走这里 —— **只此一条还原路径**;
 * 两边各写一份的话,总有一边会在下一次改动之后被忘掉。
 *
 * 没有现场就什么都不写。**打断的时机完全可能落在还没开始应用变异的那一段**
 * (读登记表、查变异集记在谁名下),那时盘上本来就是干净的;而照着一个不存在的
 * 现场去写,只会在信号处理里当场抛 —— 还原没做成,退出也没走成,覆盖记录跟着
 * 一起留在盘上,而人看到的是一堆栈,像是变异集自己坏了。
 *
 * 写之前先把现场清掉:还原过的就没有什么可还的了,再调一次不该再写一遍。
 */
export function restoreMutation(): void {
  const cur = inFlight
  if (cur === undefined) return
  inFlight = undefined
  writeFileSync(cur.file, cur.orig, 'utf8')
}

/**
 * 被打断时该做的:先还原,再退出。
 *
 * 退出码非零 —— 这一次检查没跑完,不能算过。
 * 走 `process.exit` 而不是就地结束,是因为入口还把覆盖记录的还原挂在退出上:
 * 那一份原先也只在正常跑完时才还得回去,这一步顺带把它接上。
 */
export function onInterrupt(): never {
  restoreMutation()
  process.exit(1)
}

/**
 * 装上信号处理。**三种都要装**:Ctrl-C 是一种,被杀掉和 CI 超时是另一种,
 * 终端关掉是第三种 —— 只接管其中一种,另外两条路照样把改动留在工作区里。
 */
export function restoreOnInterrupt(): void {
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(sig, onInterrupt)
}
