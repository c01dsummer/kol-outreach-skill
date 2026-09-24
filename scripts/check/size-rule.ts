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
 *
 * ⚠️ `added` 不是「diff 里的新增行」,是**带来新内容的新增行**:吃折扣的后缀
 * (`WHITESPACE_FREE`)里,只改了行内空白的那些行不算(ADR-98)。总原则是一句
 * **按内容量收费,不按搬运量** —— 删除、整文件挪位置、重排缩进都只是搬运。
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
 * 量新增行要用的 git 参数 —— **它是判定的一部分,不是调用点的细节。**
 *
 * `docs/CONVENTIONS.md` 第十节逐字写着:「哪些行算新增……那一半(它决定这道闸门
 * 看得见多少改动;扫描范围被悄悄缩小和判定写错一样致命,所以它也是判定)」。
 * 而在这以前,「必须走 `-z`」「也必须开着改名检测」这两条要求写在下面的注释里、
 * 开关却留在 `size.ts` 的调用点上 —— **规则模块立了两条它自己管不到的规矩**:
 * 删掉 `-z`、或者在一台 `diff.renames=false` 的机器上跑,7 条 `M-H9-*` 一条都不会红。
 * 搬进来之后,`scripts/test.ts` 起一个真 git 仓库就能把三条一起钉住。
 */
export const GIT_CONFIG = [
  // 中文路径不许被转义成 `"docs/adr/\346..."`。这个仓库的文件名几乎全是中文,
  // 转义之后它们匹配不上分类判据,整批掉进「其他」—— 同一个坑栽过三次。
  // '-c', 'core.quotePath=false',
  // 改名检测必须开着,理由见 `parseNumstat`。git 2.9 起这是缺省值,
  // **但缺省值不是保证**:把 `diff.renames=false` 写进全局配置的那台机器上,
  // 一个 400 行文件挪个位置读出源码 400 行、当场判红(实测)。
  '-c', 'diff.renames=true',
]

/** 照实数的那一遍:文件清单由它定,没吃折扣的类别也由它定 */
export const NUMSTAT = ['diff', '--numstat', '-z']
/** 忽略行内空白的那一遍:吃折扣的文件,计数取它 */
export const NUMSTAT_IGNORING_SPACE = [...NUMSTAT, '-w']

/**
 * 哪些后缀吃「重排缩进不收费」这个折扣。
 *
 * **写成白名单,不是黑名单。** 漏掉一种文件类型的后果是「照实全数」——
 * 也就是今天的行为,失败方向朝安全那边倒。反过来写成「这几类不折价」,
 * 下一种空白带语义的文件(Python、Makefile、`.rst`)进来时会被静默折价,
 * 而没有任何东西提醒。ADR-77 撤掉的那张手写敏感字段表,错的正是这个方向。
 *
 * 今天只有 `.ts`。markdown 的四空格代码块、围栏缩进、列表层级都带语义
 * (实测:全仓 `.md` 零内容变化重排,照实数会判红,忽略空白后读 0),
 * YAML 与 `AGENTS.md.tpl` 同理 —— 它们一律照实数。
 * 代价写在 ADR-98:`.ts` 的字符串与模板字面量里空白也是内容,那一类改动在这里读 0。
 */
export const WHITESPACE_FREE = ['.ts']

/** 这条路径吃不吃折扣 —— 判据只有后缀,理由见上面 `WHITESPACE_FREE` */
export const discountable = (path: string): boolean =>
  WHITESPACE_FREE.some(ext => path.endsWith(ext))

/**
 * 两遍 numstat 合成一份计数:吃折扣的取忽略空白那一遍,其余照实。
 *
 * **两遍都不带 pathspec。** 用 `-- ':(exclude)*.md'` 分流看着更直接,却会把一次
 * **跨类改名**的两端切进不同调用,改名检测就此失效 —— 400 行零内容变化的
 * `挪走的.md → 挪来的.ts` 会读成「文档侧删 400 ＋ 源码侧增 400」(实测),
 * 正撞在下面 `parseNumstat` 那段承重注释上:拿走改名折扣去换空白折扣,
 * 是把这道闸门自己写下的原则换掉一条。
 *
 * 吃折扣的文件在忽略空白那一遍里**整个消失**(不是记 0),所以查不到就是 0。
 */
export function merge(plain: FileDelta[], ignoringSpace: FileDelta[]): FileDelta[] {
  const lean = new Map(ignoringSpace.map(f => [f.path, f.added]))
  return plain.map(f => ({
    path: f.path,
    added: discountable(f.path) ? (lean.get(f.path) ?? 0) : f.added,
  }))
}

/**
 * 折掉了多少 —— 逐类。**为 0 也照打**:读的人要分得出「这次没折价」与「没人算过」。
 *
 * 量的是**行**不是文件。多数被折价的文件在忽略空白那一遍里并不消失
 * (600 行包进回调 ＋ 两处真新增 → 照实 604,忽略空白 4,文件两边都在),
 * 按文件数报会在折价最大的那一类上报 0,那句交代就成了假话。
 */
export function discount(plain: Record<Category, number>, merged: Record<Category, number>):
Record<Category, number> {
  const out: Record<Category, number> = { 源码: 0, 测试: 0, 文档: 0, 其他: 0 }
  for (const c of CATEGORIES) out[c] = plain[c] - merged[c]
  return out
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
 * ⚠️ **别把这个折扣和空白折扣相乘。** 两者天然互斥:忽略行内空白唯一宣称免费的
 * 那类编辑,恰好是唯一会把改名相似度打到零的那类,于是改名检测认不出来。
 * 实测:挪个位置同时改 3 行真内容收 3 行;挪个位置、一行内容都不改、只整体缩进
 * 收满额 60 行 —— **真改内容反而便宜 20 倍**。`-M`、`--find-renames=01%`、`-C`、
 * `-B`、`--find-copies-harder` 全试过都救不回来:这是结构性的,只能写在明处。
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

// ── 起点：哪些提交算这条分支自己的 ─────────────────────────────────

/**
 * 找主干时按这个顺序试,取第一个存在的。远端引用排在前面:本地 `main` 可能很久没拉,
 * 拿它当主干会把起点算得太靠前 —— 别人已合进主干的提交被算成这条分支自己的。
 */
export const TRUNK_CANDIDATES = ['origin/main', 'main']

/**
 * 调用方交进来的 git。答得上来时交回去掉首尾空白的输出;命令失败时交回 `null`。
 * (`size.ts` 传的是带着 `GIT_CONFIG` 的那个 `tryGit`。)
 */
export type GitAsk = (...args: string[]) => string | null

export type Baseline =
  /** 无从判断:入口照 `why`／`how` 说出来并以退出码 1 失败,不退化成「0 行,通过」 */
  | { kind: 'cannot-answer'; why: string; how: string }
  /** HEAD 就在主干上,而且没有父提交 —— 没有可比的上一版,入口说「不适用」并退出 0 */
  | { kind: 'not-applicable'; trunk: string }
  /** 量 `base..head`;`commits` 是这条分支自己的提交(豁免只从这些提交信息里找) */
  | { kind: 'measure'; trunk: string; head: string; base: string; onTrunk: boolean; commits: string[] }

/**
 * 体量闸门从哪里量起 —— `docs/CONVENTIONS.md` 第十节后半句「哪些提交算这条分支自己的」。
 * 它决定这道闸门看得见多少改动,也决定去哪些提交信息里找 `size-ok:` 豁免,所以它是判定,不是走法。
 *
 * 逐步问 `ask`,任何一步答不上来就停在那一步:
 * 1. `rev-parse HEAD` 答不上来 → 无从判断:这里不是 git 仓库,或者没有任何提交。
 * 2. `rev-parse --is-shallow-repository` 只有答 `false` 才往下走:答 `true` → 无从判断(浅克隆算出来的基线不可信);
 *    答别的(2.15 以前的 git 不认识这个参数,会把它原样打回来)或答不上来 → 同样无从判断,`why` 里带上它答了什么。
 * 3. 按 `TRUNK_CANDIDATES` 的顺序问 `rev-parse --verify <候选>^{commit}`,取第一个答得上来的当主干;
 *    都答不上来 → 无从判断,`why` 里点名试过的每一个候选。
 * 4. `merge-base <主干> HEAD` 答不上来 → 无从判断:HEAD 与主干没有共同祖先。
 * 5. 共同祖先就是 HEAD 自己 → HEAD 在主干上(`onTrunk`):改和上一版比,起点是 `rev-parse <HEAD>^1`;
 *    没有上一版 → 不适用。否则起点就是共同祖先。
 * 6. 这条分支自己的提交 = `rev-list <起点>..<HEAD>` 按行拆开、去掉空行(没有提交时是空数组)。
 *
 * 主干上照样量、照样报数,只是入口不据此判红:这个闸门守的是待评审的改动,
 * CI 跑在推送之后,在主干上判红只会让主干变红(`size.ts` 里有完整理由)。
 */
export function resolveBaseline(ask: GitAsk): Baseline {
  const cannot = (why: string, how: string): Baseline => ({ kind: 'cannot-answer', why, how })

  const head = ask('rev-parse', 'HEAD')
  if (head === null) return cannot('这里不是一个 git 仓库,或者没有任何提交', '在仓库里跑;新建的仓库先提交一次。')

  const shallow = ask('rev-parse', '--is-shallow-repository')
  if (shallow === 'true') {
    return cannot('这是一个浅克隆,算出来的基线不可信',
      'CI 里给 actions/checkout 加 `with: { fetch-depth: 0 }`;本地跑 `git fetch --unshallow`。')
  }
  // 只有答 false 才往下走。2.15 以前的 git 不认识这个参数,会把它原样打回来、退出 0 ——
  // 那不是「不是浅克隆」,是没问出来;当成 false 接着量,就在浅克隆里报一个可能缩水的数
  if (shallow !== 'false') {
    return cannot(`问不出这是不是浅克隆(\`rev-parse --is-shallow-repository\` 答的是 ${JSON.stringify(shallow)}),`
      + '算出来的基线不知道可不可信',
      'git 2.15 以前不认识这个参数,会把它原样打回来;升级 git 后再跑。')
  }

  const trunk = TRUNK_CANDIDATES.find(r => ask('rev-parse', '--verify', `${r}^{commit}`) !== null)
  if (trunk === undefined) return cannot(`找不到主干引用(试过 ${TRUNK_CANDIDATES.join('、')})`, '先 `git fetch origin main`。')

  const merged = ask('merge-base', trunk, 'HEAD')
  if (merged === null) return cannot(`HEAD 与 ${trunk} 没有共同祖先`, '确认这条分支确实从主干长出来。')

  const onTrunk = merged === head
  const base = onTrunk ? ask('rev-parse', `${head}^1`) : merged
  if (base === null) return { kind: 'not-applicable', trunk }

  // 列不出来 ≠ 没有提交:空串才是「查过、这条分支一个提交都没有」
  const listed = ask('rev-list', `${base}..${head}`)
  if (listed === null) {
    // 这两个提交刚刚都解析出来了,走到这里多半是仓库本身坏了 —— 让人先看 git 自己怎么说
    return cannot(`列不出 ${base.slice(0, 7)}..${head.slice(0, 7)} 之间的提交,找不了 size-ok 豁免`,
      `手工跑 \`git rev-list ${base.slice(0, 7)}..${head.slice(0, 7)}\`,看 git 报什么(常见是仓库损坏)。`)
  }
  return { kind: 'measure', trunk, head, base, onTrunk, commits: listed.split('\n').filter(Boolean) }
}
