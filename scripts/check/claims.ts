/**
 * 测试运行时留下的覆盖记录 —— 审计据它回答「有没有测试」。
 *
 * 为什么不从源码里搜:**注释掉的认领会被搜出来。**把测试删掉、
 * 把认领留在注释里,红线交点的硬失败就被一句注释绕过去了(ADR-20)。
 * 运行时收集的记录里,没执行的就是没有。
 *
 * 路径与文件名常量单独放这里,让写的一方和读的一方指向同一个地方 ——
 * 两边各写一个字符串,迟早会有一边先改。
 */
export const CLAIMS_PATH = '.check-cache/test-claims.json'
export const SELF = 'scripts/test.ts'

export interface Claims {
  /** 写下这份记录时 `scripts/test.ts` 的指纹。对不上就是过期记录,不算数 */
  source_hash: string
  /** 真正跑过的需求编号 */
  covered: string[]
  /** 真正跑过的交点认领,形如 `A|B` */
  tensions: string[]
  /** 真正跑过的**验收判据**认领,形如 `D1.a` —— 计量单位是判据,不是需求 */
  criteria: string[]
}

/**
 * 这份记录还新鲜吗 —— 指纹对不上就是过期的,不算数（ADR-20）。
 *
 * 抽出来是为了它能被测:比较本身留在入口里,改成反向比较或恒真,
 * 没有任何一条测试会红,而过期检查就静默失效了（M-H14-c 守着）。
 */
export const claimsFresh = (recordHash: string, selfHash: string): boolean =>
  recordHash === selfHash

/**
 * 这一次运行有资格写下覆盖记录吗 —— 只有一次**干净的运行**才算数（ADR-20）。
 *
 * 两个条件缺一不可:变异测试跑的是被改过的源码,那次执行留下的记录不作数;
 * 断言红过的运行同样不写 —— 一份没通过的运行会被当成证据交出去。
 *
 * 抽出来是为了它能被测:条件留在入口里,少掉 `fail === 0` 那一半,
 * 没有任何一条测试会红,而审计会把红着的认领当成证据（M-H14-e 守着）。
 */
export const claimsPublishable = (mutating: boolean, fail: number): boolean =>
  !mutating && fail === 0
