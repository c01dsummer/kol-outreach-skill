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
  /**
   * **必须顶格。** 缩进的 `size-ok:` 不算。
   *
   * 提交信息里举例说明这个语法是很自然的事 —— 而允许行首空白的话,
   * 那些缩进的例子会被当成真的豁免。实测:上一个提交的正文里用缩进写了两个
   * 「写歪的豁免」当反例,CI 当场判它们不成立,红了一轮。
   *
   * 顶格是 git trailer 的一贯写法,缩进的文本是引文,不是指令。
   */
  const m = /^size-ok:\s*(.*)$/.exec(line)
  if (!m) return null
  const rest = m[1].trim()
  /**
   * 类别是**第一个空白之前的完整一段**,不是前缀匹配。
   *
   * 前缀匹配会把 `size-ok: 源码理由没有空格` 和 `size-ok: 文档案 某个理由`
   * 都当成合格的豁免(类别取「源码」「文档」,剩下的当理由)。文档写的语法是
   * 空白分隔的 `<类别> <理由>`,判定就该照着它,不该比它松 ——
   * **一条能被写歪还照样生效的规则,等于没有规则。**
   */
  const parts = /^(\S+)\s+(.+)$/.exec(rest)
  if (!parts) return { kind: 'unjustified', text: rest }
  const category = CATEGORIES.find(c => c === parts[1])
  if (!category) return { kind: 'unjustified', text: rest }
  return { kind: 'exempt', category, reason: parts[2].trim() }
}

/**
 * 扫一条提交信息里的豁免标记,**跳过围栏代码块**。
 *
 * 提交信息里举例说明这个语法是很自然的事,而例子有两种写法:
 *
 * - 缩进 —— 由 `judgeExemption` 的「必须顶格」挡住(栽过一次,CI 红了一轮)
 * - **围栏代码块** —— 块里的行本身是顶格的,顶格那条规则拦不住
 *
 * 两种都必须当引文,不当指令。少一种,后果是双向的:格式正确的示例会**白送
 * 一条豁免**,格式故意写歪的示例会**让闸门报红** —— 后者已经发生过。
 *
 * 围栏标记按 CommonMark 允许最多三个前导空格。
 */
export function scanMessage(message: string): ExemptionVerdict[] {
  const out: ExemptionVerdict[] = []
  let fenced = false
  for (const line of message.split('\n')) {
    if (/^ {0,3}(```|~~~)/.test(line)) { fenced = !fenced; continue }
    if (fenced) continue
    const v = judgeExemption(line)
    if (v) out.push(v)
  }
  return out
}

export interface Overage { category: Category; added: number; budget: number; note?: string }

/**
 * 一条具名豁免,以及**它写下之后最终 diff 里这一类还净增了多少**。
 *
 * 这个数是树对树算出来的:`总数(c) - 豁免那一刻的数(c)`,两边都相对同一个基线。
 * 早先是按提交序列算的 —— 数每个提交各自加了多少,再看某一类最后一次被追加
 * 是不是晚于最后一条豁免。那条路走了四版都不对:
 *
 * - 合并提交按第一父计,PR 检出的 `refs/pull/N/merge` 让任何豁免永远过期
 * - 一律按 0,冲突解决时新写的代码不算数
 * - 各父 diff 的逐类最小值,一次干净的合并主干就把豁免顶掉
 * - 按第一父链重排,修好了顺序,但**加一行又删掉**仍然会误判成过期
 *
 * 四个反例的共同点:它们都在问「历史上发生过什么」,而闸门要守的是
 * **最终这份 diff 有多大**。改成树对树之后,提交顺序、合并形状、时间戳
 * 一概不参与,上面四种情形自然全对。
 *
 * ## 明确不保证的
 *
 * 两个数相减,量的是**净增**,不是「哪些行是后加的」。所以有一种情形查不出来:
 * 豁免之后删掉 100 行被豁免的、又补上 100 行新的 —— 两个数都不变,净增为 0,
 * 旧豁免照样放行,而那 100 行它从没覆盖过。
 *
 * 这是**已知缺口,不是遗漏**。试过两种补法,都更糟:
 *
 * - 改用 `diff(豁免那一刻, HEAD)` 的新增:干净地合一次主干就会报「已过期」——
 *   那些行来自主干,根本不在总数里(实测 1 行 `trunk.ts` 就够触发)
 * - 再按「出现在总数里的路径」筛一道:七种情形都能过,但**主干和分支碰过
 *   同一个文件**时,主干那侧的行会算进来 —— 而「合主干进来」正是
 *   `6-INTEGRATE.md` 推荐的做法,这个假阳性会天天响
 *
 * 真正对的做法是逐行比对两份 patch 的新增行集合,而不是相减。那要写一个
 * patch 行级差分,量不小;在这个缺口(总数必须**一行不差**地保持相等)面前
 * 不成比例。**假阳性会让闸门被忽略,而被忽略的检查比没有检查更糟。**
 */
export interface Waiver { category: Category; reason: string; addedAfter: number }

export interface SizeReport {
  counts: Record<Category, number>
  over: Overage[]
  /** 超了但被一条**仍然有效**的具名豁免挡住 */
  waived: Overage[]
  /** 有豁免，但写下之后这一类又净增了 —— 过期，不放行 */
  stale: Overage[]
  /** 写了 size-ok 但没指名类别或没写理由的,一律不放行 */
  unjustified: string[]
  ok: boolean
}

/**
 * **豁免绑在它写下的那一刻,不绑整条分支。**
 *
 * 否则会这样:某个提交里 400 行生成代码,写一条豁免说明理由 —— 从此这条分支的
 * 源码这一类永久免检,后面再追加几千行不相干的代码也一样绿。豁免是对
 * 「当时那些行」的说明,不是一张长期通行证。
 *
 * 所以:一条豁免有效,当且仅当它写下之后这一类**没有净增**。之后又加了东西,
 * 就得重新写一条 —— 重新写的时候,理由也会被重新想一遍。
 */
export function judge(
  counts: Record<Category, number>,
  waivers: Waiver[],
  unjustified: string[],
): SizeReport {
  const over: Overage[] = []
  const waived: Overage[] = []
  const stale: Overage[] = []

  for (const c of CATEGORIES) {
    if (counts[c] <= BUDGET[c]) continue
    const row: Overage = { category: c, added: counts[c], budget: BUDGET[c] }
    const mine = waivers.filter(w => w.category === c)
    if (!mine.length) { over.push(row); continue }
    const best = Math.min(...mine.map(w => w.addedAfter))
    if (best <= 0) waived.push(row)
    else stale.push({ ...row, note: `最新一条豁免写下之后，这一类又净增了 ${best} 行` })
  }

  return {
    counts, over, waived, stale, unjustified,
    ok: over.length === 0 && stale.length === 0 && unjustified.length === 0,
  }
}
