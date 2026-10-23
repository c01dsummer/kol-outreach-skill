/**
 * 准入读物包的判定（ADR-162）：给写测试的那个上下文出的四份读物里，需求单与变异说明怎么出，
 * 签名怎么扫，包目录在不在仓库里。入口在第二片（ADR-162 第六节）。
 *
 * 桩：签名与类型照 ADR-162 第五节，函数体只有一句抛错。
 */
import type { Req } from './spec-rule.js'

/** 第 1 份（ADR-162 第二节）。不出包时交理由 */
export function requirementSheet(reqs: readonly Req[], id: string):
  { ok: true; text: string } | { ok: false; reason: string } {
  throw new Error('桩：还没有实现')
}

/** 第 4 份（ADR-162 第二节）。leaks 不空时入口不出包 */
export function briefSheet(id: string,
  mutations: readonly { id: string; req: string; why: string }[],
  exemptions: readonly { req: string; why: string; scope?: string }[]):
  { text: string; leaks: { id: string; leak: string }[] } {
  throw new Error('桩：还没有实现')
}

/** ADR-162 第三节。空单子 = 没找到 */
export function declarationFindings(text: string): string[] {
  throw new Error('桩：还没有实现')
}

/** ADR-162 第四节。两个参数都是绝对路径 */
export function insideRoot(root: string, dir: string): boolean {
  throw new Error('桩：还没有实现')
}
