/**
 * 变异与豁免**记在谁名下** —— 从 `mutate.ts` 里抽出来的那一半，理由与
 * `why-rule.ts` / `lint-rule.ts` 同：有语义就该能被测，能被测就不该待在入口脚本里。
 *
 * `audit.ts` 拿 `req` 去回答「这条需求有没有变异守着」。写成一个**不存在**的
 * 编号时，变异照样跑、照样被抓到，控制台一片绿 —— 而它记在了一个空名下，
 * 对任何一条需求都不算数，也没有人被告知（ADR-34）。
 *
 * 写成**另一条真实存在**的编号是吵的（被顶替的那条会报缺变异）；
 * 写成不存在的编号是**静默**的。这条只管静默的那一半。
 *
 * `harness` 是检查链给自己留的名下 —— 它守的是检查链本身（登记表完整性、
 * 内容指纹、审计口径），不对应任何一条产品需求。
 */
export const HARNESS = 'harness'

/**
 * 返回记错名下的那些，`{ id, req }`；都对返回空数组。
 *
 * `known` 是合法名下的全集，由入口从登记表算出来：需求编号，以及拆出来之后的
 * 验收判据编号 —— 豁免常常只豁免其中一条判据（ADR-34）。这条判定只认
 * 「在不在名单上」，不认编号的形状。
 */
export function orphanAttributions(
  entries: { id: string; req: string }[],
  known: Set<string>,
): { id: string; req: string }[] {
  return entries.filter(e => e.req !== HARNESS && !known.has(e.req))
}
