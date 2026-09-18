/**
 * 体量闸门的判定 —— 从入口里抽出来的那一半。
 *
 * 它守的是 `process/6-INTEGRATE.md` 里那条纪律:**一个改动 = 一个能一次读完的 diff**。
 * 这条纪律原本写在 `process/README.md` 的第三层(只能靠自觉),理由是
 * 「『能一次读完』没有阈值」。这个文件就是那个阈值 —— 有了它,这条纪律
 * 从期望变成能报错的检查,也就从第三层升到了第二层。
 *
 * 抽出来的理由:判定有语义就该能被测。
 * 走 git、打印、退出码留在 `size.ts`。
 */

import { trailerLines } from './trailer.js'

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
 *
 * **只在前两个制表符处切,剩下的整段都是路径。** `-z` 关掉的是引号转义,不是
 * 分隔符:记录内部仍以制表符分列,只是路径里的制表符和换行都原样留着。实测
 * (git 2.43)一个名字里带制表符的文件,`--numstat -z` 给的是
 *
 * ```
 * 2\t0\tscripts/foo\tjunk.ts\0
 * ```
 *
 * 按制表符全切再取第三段,路径就被截成 `scripts/foo` —— 少了 `.ts` 后缀,
 * 源码被记进「其他」,量的是另一个预算,豁免也得指错类别。
 * 路径可以含换行,所以尾段用 `[\s\S]*` 而不是 `.*`。
 *
 * 切不出两个制表符的记录是**读不懂**,不是「0 行」—— 当场抛,不静默计零。
 * 一个读错了还照常给数的闸门,比没有闸门更糟。
 */
const NUMSTAT_RECORD = /^([^\t]*)\t[^\t]*\t([\s\S]*)$/

export function parseNumstat(raw: string): FileDelta[] {
  const fields = raw.split('\0')
  const out: FileDelta[] = []
  for (let i = 0; i < fields.length; i++) {
    if (!fields[i]) continue
    const rec = NUMSTAT_RECORD.exec(fields[i])
    if (!rec) throw new Error(`numstat 记录读不懂（缺分隔符）：${JSON.stringify(fields[i])}`)
    const [, added, path] = rec
    // 二进制文件 numstat 给 `-`;它不占评审的「读」成本,按 0 计
    const n = added === '-' ? 0 : Number(added)
    if (path === '') {
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
 * 两条硬要求:
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
 * 豁免只认**最后一个 trailer 块** —— 提交信息末尾、由空行隔开的那一段,
 * 和 `Co-Authored-By:` 同一段。正文里出现的一切都不算。
 *
 * 这条规则是**换掉**一串补丁得来的,不是加在它们上面的。原来的做法是扫整个正文、
 * 再逐一排除「看起来像引文」的写法,而每排除一种就冒出下一种:
 *
 * | 形态 | 补法 |
 * |---|---|
 * | 缩进的示例 | 要求顶格 |
 * | `>` 引文 | 同上顺带 |
 * | 围栏代码块 | 加围栏遮罩 |
 * | 围栏的种类与长度 | 照 CommonMark 记住开启标记 |
 * | 闭合后的信息串 | 闭合后只许空白 |
 * | **HTML 注释** | ← 第六种 |
 *
 * 补到第六种就该承认判据错了:**把整个正文当成指令区**,就得没完没了地枚举
 * 「什么不是指令」。反过来划一小块出来当指令区,正文里怎么写都不会被误读 ——
 * 而 git 早就定义好了这一小块。
 *
 * 代价是豁免必须写在最后一段。这不是负担,是惯例:trailer 本来就都在那里。
 */
/** `Key: value` —— git trailer 的形状 */
export function scanMessage(message: string): ExemptionVerdict[] {
  const out: ExemptionVerdict[] = []
  for (const line of trailerLines(message)) {
    const v = judgeExemption(line)
    if (v) out.push(v)
  }
  return out
}

export interface Overage { category: Category; added: number; budget: number }

/**
 * 一条具名豁免:类别 ＋ 理由,从提交信息的 trailer 块里读出来。
 *
 * **它管整条分支,不设新鲜度。** 早先还带一个「写下之后这一类又净增了多少」,
 * 净增为正就判过期、不放行 —— 那套机器 2026-09-18 撤了。撤它的理由、
 * 它当初为什么长成那样(按提交序列算走了四版都不对)、以及这道闸门的死亡条件,
 * 全记在 ADR-80。
 */
export interface Waiver { category: Category; reason: string }

export interface SizeReport {
  counts: Record<Category, number>
  over: Overage[]
  /** 超了但被一条指名这一类的具名豁免挡住 —— 豁免管整条分支 */
  waived: Overage[]
  /** 写了 size-ok 但没指名类别或没写理由的,一律不放行 */
  unjustified: string[]
  ok: boolean
}

/**
 * **超线 ＋ 一条指名这一类的豁免 = 放行。豁免管整条分支。**
 *
 * 早先反过来:豁免只对「写下那一刻的那些行」生效,之后这一类再净增就判过期,
 * 要求重写一条。那套机器撤了(ADR-80) —— 它的主要工作是消化这道闸门自己的
 * 豁免带来的后果,而不是守住任何一个别处守不住的坏法。**一条规则的主要工作
 * 是消化另一条规则的后果时,至少删一条。**
 *
 * 换来的缺口写在明处:一条豁免之后再追加几千行不相干的代码,这一类照样绿。
 * 挡它的是读 diff 的人,不是这道闸门。
 */
export function judge(
  counts: Record<Category, number>,
  waivers: Waiver[],
  unjustified: string[],
): SizeReport {
  const over: Overage[] = []
  const waived: Overage[] = []

  for (const c of CATEGORIES) {
    if (counts[c] <= BUDGET[c]) continue
    const row: Overage = { category: c, added: counts[c], budget: BUDGET[c] }
    const mine = waivers.filter(w => w.category === c)
    if (!mine.length) { over.push(row); continue }
    waived.push(row)
  }

  return {
    counts, over, waived, unjustified,
    ok: over.length === 0 && unjustified.length === 0,
  }
}
