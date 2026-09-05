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
 * 编号自己重复也在静默那一半（`duplicateIds`）：编号不进任何判定，只进报告，
 * 所以两条顶着同一个名字时检查链一路全绿，而报告里 `✓ M-X` 和 `✗ M-X` 并排，
 * 指不回表里是哪一行。
 *
 * `harness` 是检查链给自己留的名下 —— 它守的是检查链本身（登记表完整性、
 * 内容指纹、审计口径），不对应任何一条产品需求。
 */
export const HARNESS = 'harness'

/**
 * 返回**重复出现**的编号，去重后按首次重复的先后排列；都不重复返回空数组。
 *
 * 编号不参与任何判定 —— `mutate.ts` 只拿它印报告的每一行。所以复制一条变异忘了改
 * 字母时，两条都照跑、照样各自被抓到，控制台一片绿：没有任何一步会说「这里有两条」。
 * 代价在报告读不回去：一条存活一条被抓时，日志里是 `✓ M-X` 和 `✗ M-X` 并排，
 * 而「去修 M-X」指不出该修表里哪一行。
 *
 * 只看编号本身，不看它记在谁名下 —— 同一条需求下有多条变异是常态，那不是重复。
 */
export function duplicateIds(entries: { id: string }[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const e of entries) (seen.has(e.id) ? dup : seen).add(e.id)
  return [...dup]
}

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

/** 变异集在「记在谁名下」这一层的毛病。一次只报一种 —— 哪一种由 `attributionFault` 定 */
export type AttributionFault =
  | { kind: 'duplicate'; ids: string[] }
  | { kind: 'orphan'; entries: { id: string; req: string }[] }

/**
 * 两种毛病同时在时报哪一种 —— **先报编号重复**。
 *
 * 这个先后有语义，所以它在这儿，不在入口。记错名下那份报告印的也是 id：
 * 「M-X 记在 H4 名下」在编号还没唯一时指不出该改表里哪一行，人会去翻名下，
 * 而错的是有两条重名。反过来不成立 —— 编号唯一之后，记错名下那份报告自己定位得了。
 *
 * 留在入口里的话，把两段调换或者删掉一段，`duplicateIds` 与 `orphanAttributions`
 * 各自的断言照样全绿（`docs/CONVENTIONS.md` 第 10 条：顺序错了会出错就是语义，
 * 有语义就该能被测，能被测就不该待在入口脚本里）—— 评审指出的正是这个缺口。
 *
 * 两份名单不是同一份：编号唯一只对变异本身说话，记错名下连显式豁免一起看。
 */
export function attributionFault(
  muts: { id: string }[],
  attributed: { id: string; req: string }[],
  known: Set<string>,
): AttributionFault | undefined {
  const ids = duplicateIds(muts)
  if (ids.length) return { kind: 'duplicate', ids }
  const entries = orphanAttributions(attributed, known)
  return entries.length ? { kind: 'orphan', entries } : undefined
}
