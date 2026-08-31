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

/**
 * 解析 `git diff --numstat -z` 的输出。
 *
 * **必须走 `-z`。** 默认输出会把非 ASCII 路径转义成带引号的形式
 * (`"docs/adr/\\351\\207\\207..."`),于是这个仓库里几乎每一个中文文件名
 * 都匹配不上分类判据,整批掉进「其他」—— 实测 14 个决策记录文件全部被误归。
 *
 * **也必须开着改名检测。** 关掉之后一次纯改名会被拆成「旧路径全删 + 新路径全增」,
 * 一个 400 行的文件挪个位置就顶掉整个源码预算 —— 而它一行内容都没加。
 * 这和「只数新增行」是同一条理由:按搬运量收费会惩罚重构。
 *
 * 改名记录的形状不一样:`added\tremoved\t` 之后是空的,真正的两个路径跟在
 * 后面两个 NUL 段里。纯改名两个数都是 0,所以照常累加即可。
 */
export function parseNumstat(raw: string): FileDelta[] {
  const fields = raw.split('\0')
  const out: FileDelta[] = []
  for (let i = 0; i < fields.length; i++) {
    if (!fields[i]) continue
    const [added, , path] = fields[i].split('\t')
    // 二进制文件 numstat 给 `-`;它不占评审的「读」成本,按 0 计
    const n = added === '-' ? 0 : Number(added)
    if (path === '' || path === undefined) {
      // 改名/复制:后两段是旧路径与新路径,记在新路径上
      out.push({ path: fields[i + 2] ?? '', added: n })
      i += 2
    } else {
      out.push({ path, added: n })
    }
  }
  return out
}

/**
 * 解析 `git show --cc --format=` 的合并 diff,数**所有父都没有的那些行** ——
 * 也就是解决冲突时真写下的内容。
 *
 * 两个父时这样的行以 `++` 开头。必须**先进到 `@@` hunk 里才数**,否则
 * `+++ b/<路径>` 那行文件头会被算成新增(实测 901 vs 900)。
 *
 * 调用方必须带 `-c core.quotePath=false` —— 否则中文路径会以带引号的转义形式
 * 出现在 `diff --cc` 头里,整片归错类。`--numstat` 那边靠 `-z`,这里没有 `-z`,
 * 所以那个开关是唯一的办法。
 */
export function parseCombinedDiff(raw: string, parents: number): FileDelta[] {
  const marker = '+'.repeat(parents)
  const files: FileDelta[] = []
  let inHunk = false
  for (const line of raw.split('\n')) {
    const d = /^diff --cc (.+)$/.exec(line)
    if (d) { files.push({ path: d[1], added: 0 }); inHunk = false; continue }
    if (line.startsWith('@@')) { inHunk = true; continue }
    // files 为空时不可能进到 hunk（`@@` 总跟在 `diff --cc` 之后），但不赖这个假设
    if (inHunk && files.length && line.startsWith(marker)) files[files.length - 1].added++
  }
  return files
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


export interface Overage { category: Category; added: number; budget: number; note?: string }

/** 一个提交:它的信息(找豁免)与它各类新增了多少(判断豁免有没有过期) */
export interface CommitDelta { message: string; counts: Record<Category, number> }

export interface SizeReport {
  counts: Record<Category, number>
  over: Overage[]
  /** 超了但被一条**仍然有效**的具名豁免挡住 */
  waived: Overage[]
  /** 有豁免，但写下之后又往这一类加了东西 —— 过期，不放行 */
  stale: Overage[]
  /** 写了 size-ok 但没指名类别或没写理由的,一律不放行 */
  unjustified: string[]
  ok: boolean
}

/**
 * 判定。`commits` 按时间正序。
 *
 * **豁免绑在它写下的那一刻,不绑整条分支。**
 *
 * 否则会这样:某个提交里 400 行生成代码,写一条豁免说明理由 —— 从此这条分支的
 * 源码这一类**永久免检**,后面再追加几千行不相干的代码也一样绿。豁免是对
 * 「当时那些行」的说明,不是一张长期通行证。
 *
 * 所以规则是:某一类最后一次被追加,必须**不晚于**该类最后一条豁免。
 * 之后又加了东西,就得重新写一条 —— 重新写的时候,理由也会被重新想一遍。
 */
export function judge(
  counts: Record<Category, number>,
  commits: CommitDelta[],
): SizeReport {
  const unjustified: string[] = []
  const lastWaiver = new Map<Category, number>()
  const lastAdd = new Map<Category, number>()

  commits.forEach((c, i) => {
    for (const line of c.message.split('\n')) {
      const v = judgeExemption(line)
      if (!v) continue
      if (v.kind === 'unjustified') unjustified.push(v.text)
      else lastWaiver.set(v.category, i)
    }
    for (const cat of CATEGORIES) if (c.counts[cat] > 0) lastAdd.set(cat, i)
  })

  const over: Overage[] = []
  const waived: Overage[] = []
  const stale: Overage[] = []
  for (const c of CATEGORIES) {
    if (counts[c] <= BUDGET[c]) continue
    const row: Overage = { category: c, added: counts[c], budget: BUDGET[c] }
    const w = lastWaiver.get(c)
    const a = lastAdd.get(c) ?? -1
    if (w === undefined) over.push(row)
    else if (w < a) stale.push({ ...row, note: `豁免写在第 ${w + 1} 个提交，之后第 ${a + 1} 个提交又往这一类加了东西` })
    else waived.push(row)
  }

  return {
    counts, over, waived, stale, unjustified,
    ok: over.length === 0 && stale.length === 0 && unjustified.length === 0,
  }
}
