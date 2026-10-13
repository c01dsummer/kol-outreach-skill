/**
 * 顺序契约表每行点名的变异对不对得上的判定（ADR-148）—— 准备接进 `mutate.ts` 开跑前体检的那一半，
 * 理由与 `attribution-rule.ts` 同：有语义就该能被测，而 `mutate.ts` 上的变异抓不到。
 *
 * 只核字面绑定：点名的变异在变异目录里、它的 `file` 在这一行的「位置」栏里。
 * **守不守这一行不判** —— 那要看施加之后的后果（ADR-146 第一节），是读，不是跑。
 */

/** 变异目录里与绑定有关的两样 */
export interface OrderMutation { readonly id: string; readonly file: string }

/** ADR-148 第二节的各种问题；line 是 docs/ARCHITECTURE.md 里的行号（从 1 起） */
export type OrderFault =
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'markers'; readonly begins: number; readonly ends: number }
  | { readonly kind: 'header' }
  | { readonly kind: 'stray'; readonly line: number }
  | { readonly kind: 'shape'; readonly line: number; readonly cells: number; readonly expected: number }
  | { readonly kind: 'malformed'; readonly line: number; readonly text: string }
  | { readonly kind: 'empty'; readonly line: number }
  | { readonly kind: 'unknown'; readonly line: number; readonly id: string }
  | { readonly kind: 'off-site'; readonly line: number; readonly id: string; readonly file: string }

/** 按 ADR-148 第二节核整张表；返回第二节第 3 小节的先后。纯函数，不读文件、不起进程 */
export function orderBindingFaults(doc: string | undefined, mutations: readonly OrderMutation[]): OrderFault[] {
  void doc; void mutations
  throw new Error('orderBindingFaults 还没实现（ADR-148 第四节）')
}
