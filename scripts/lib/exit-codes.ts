/**
 * 入口共用的退出码（ADR-193，KOL-106 方案乙）。
 *
 * 每个数对着 Agent 接下来该做的**一件事**，同一个数在 collect、enrich、probe、render 里意思一样。
 * 原先只有 0–3 四个数，「关键词跑完」与「达标」同为 0，「供应商余额不足」与「其他运行错误」同为 1，
 * 「记忆读不出来」与「输入问题」同为 2 —— 只看数字分不出该去充值、该重试还是该请用户改文件。
 *
 * 取 4–7 是接着原有的 3 往下排。Node 自身内部故障时也会用到 3–7 里的几个数，但那只在 Node
 * 运行时本身坏掉时出现（原先的 3 也一样）。入口里新写、改写的退出都用这里的名字；开跑前那些
 * 原有的 `process.exit(2)` 照旧写数字（变异目录的 find 逐字钉着它们，意思也没变，ADR-193 第二节）。
 */
export const EXIT = {
  /** 该干的都干完了：collect 关键词跑完、enrich／probe 跑完、render 成功 */
  done: 0,
  /** 其他运行中错误或意外崩溃：读 stderr；有汇总时断点已保存，可以续跑 */
  runtime: 1,
  /** 输入问题（开跑前查出、或跑到一半才查出的缺 key／费用账问题、收尾时的评审文件问题）：把具体哪里不对报给用户 */
  input: 2,
  /** 预算不足以支付下一请求：collect／enrich 断点已保存；probe 已出部分结果 */
  budget: 3,
  /** collect 达标停下 */
  target: 4,
  /** 供应商返回 402（余额不足）：告诉用户去充值，不要原样重试 */
  provider402: 5,
  /** 保存失败（断点、费用、名单、交付物或评审正本）：不得声称已保存 */
  save: 6,
  /** 跨任务记忆文件读不出来：停下，请用户修那个文件 */
  memory: 7,
} as const

export type ExitCode = typeof EXIT[keyof typeof EXIT]

const SAVE_FAILED = Symbol('kol.save-failed')

/**
 * 跑一段保存；它抛出的错误原样抛出，只多打一个不可枚举的记号，入口靠 `isSaveFailure` 把它分到 `EXIT.save`。
 * 不换成新的错误对象：`console.error(e)`、`String(e)` 与错误上的 `code` 一样不变，stderr 上一个字都不多。
 * 抛的不是对象（极少见）时打不上记号，归为其他运行错误。
 */
export function saving<T>(save: () => T): T {
  try { return save() }
  catch (e) {
    if (typeof e === 'object' && e !== null && !Object.hasOwn(e, SAVE_FAILED)) {
      Object.defineProperty(e, SAVE_FAILED, { value: true, enumerable: false })
    }
    throw e
  }
}

/** 这个错误是不是从 `saving` 里出来的 */
export function isSaveFailure(e: unknown): boolean {
  return typeof e === 'object' && e !== null && Object.hasOwn(e, SAVE_FAILED)
}
