/**
 * 体量闸门的判定 —— 从入口里抽出来的那一半。
 *
 * 它守的是 `process/6-INTEGRATE.md` 里那条纪律:**一个改动 = 一个能一次读完的 diff**。
 * 这条纪律原本写在 `process/README.md` 的第三层(只能靠自觉),理由是
 * 「『能一次读完』没有阈值」。这个文件就是那个阈值 —— 有了它,这条纪律
 * 从期望变成能报错的检查,也就从第三层升到了第二层。
 *
 * 抽出来的理由和 `lint-rule.ts` 一样:判定有语义就该能被测。
 * 走 git、打印、退出码留在 `size.ts`。
 */

export type Category = '源码' | '测试' | '文档' | '其他'
export const CATEGORIES: Category[] = ['源码', '测试', '文档', '其他']

/**
 * 四类分开算,**不合并成一个总数**。
 *
 * 合并会让这个闸门失去意义:2000 行追加式的决策记录和 400 行改了控制流的
 * `lib/`,评审成本差一个量级,却会在同一个总数里互相稀释 —— 一个改动可以靠
 * 「大部分是文档」把源码的超标藏掉,而那正是最需要被拆开的情形。
 */
export const BUDGET: Record<Category, number> = {
  源码: 350,
  测试: 450,
  文档: 600,
  其他: 200,
}

/**
 * 只数新增行。
 *
 * 删除便宜 —— 读一段被删掉的代码不需要理解它将来会怎样。按删除量收费还会
 * 惩罚重构和删代码,而那是应该被鼓励的事。
 */
export interface FileDelta { path: string; added: number }

export function categorize(path: string): Category {
  if (path === 'scripts/test.ts' || path === 'scripts/check/mutations.json') return '测试'
  if (path.startsWith('scripts/') && path.endsWith('.ts')) return '源码'
  if (path.endsWith('.md')) return '文档'
  if (path.startsWith('docs/') && path.endsWith('.json')) return '文档'
  return '其他'
}

export function tally(files: FileDelta[]): Record<Category, number> {
  const out: Record<Category, number> = { 源码: 0, 测试: 0, 文档: 0, 其他: 0 }
  for (const f of files) out[categorize(f.path)] += f.added
  return out
}

export type ExemptionVerdict =
  | { kind: 'exempt'; category: Category; reason: string }
  | { kind: 'unjustified'; text: string }

/**
 * 豁免写在提交信息里:`size-ok: <类别> <理由>`。
 *
 * 两条硬要求,和纪律 lint 的 `p1-ok` 同一个形状:
 *
 * - **必须指名类别** —— 一个不指名的豁免会把四类一起放行,于是最该被看见的
 *   那一类被顺手带过去。指名之后,豁免掉源码不会同时豁免文档。
 * - **理由必填** —— 没有理由的豁免等于把闸门关掉,而关掉这件事必须留下痕迹。
 *
 * 放在提交信息而不是某个 `.size-exempt` 文件里,是因为提交信息进历史、
 * 进评审视野,且不会被忘记删掉。
 */
export function judgeExemption(line: string): ExemptionVerdict | null {
  const m = /^\s*size-ok:\s*(.*)$/.exec(line)
  if (!m) return null
  const rest = m[1].trim()
  const category = CATEGORIES.find(c => rest.startsWith(c))
  if (!category) return { kind: 'unjustified', text: rest }
  const reason = rest.slice(category.length).trim()
  if (!reason) return { kind: 'unjustified', text: rest }
  return { kind: 'exempt', category, reason }
}

export function collectExemptions(commitMessages: string[]): ExemptionVerdict[] {
  const out: ExemptionVerdict[] = []
  for (const msg of commitMessages) {
    for (const line of msg.split('\n')) {
      const v = judgeExemption(line)
      if (v) out.push(v)
    }
  }
  return out
}

export interface Overage { category: Category; added: number; budget: number; exemptedBy?: string }

export interface SizeReport {
  counts: Record<Category, number>
  over: Overage[]
  /** 超了但被具名豁免的 —— 单独列出来,不和「没超」混为一谈 */
  waived: Overage[]
  /** 写了 size-ok 但没指名类别或没写理由的,一律不放行 */
  unjustified: string[]
  ok: boolean
}

export function judge(counts: Record<Category, number>, exemptions: ExemptionVerdict[]): SizeReport {
  const unjustified = exemptions.filter(e => e.kind === 'unjustified').map(e => (e as { text: string }).text)
  const waivers = new Map<Category, string>()
  for (const e of exemptions) {
    if (e.kind === 'exempt' && !waivers.has(e.category)) waivers.set(e.category, e.reason)
  }

  const over: Overage[] = []
  const waived: Overage[] = []
  for (const c of CATEGORIES) {
    if (counts[c] <= BUDGET[c]) continue
    const row: Overage = { category: c, added: counts[c], budget: BUDGET[c] }
    const why = waivers.get(c)
    if (why) waived.push({ ...row, exemptedBy: why })
    else over.push(row)
  }

  return { counts, over, waived, unjustified, ok: over.length === 0 && unjustified.length === 0 }
}
