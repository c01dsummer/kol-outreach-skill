/**
 * 决策记录的判定 —— 一条记录一个文件,编号即文件名。
 *
 * 拆成一文件一条的理由是**冲突面**:ADR 在语义上追加、彼此独立,是这个仓库里
 * 最不该冲突的东西;装在一个文件里之后,它变成了最大的冲突面。实测三条在途分支
 * 各自把 `DECISIONS.md` 从 537 行写到 1978~2539 行,而且编号互相交错 ——
 * 第一条合进主干后,后两条不是「追加到末尾」,是往文件中间十几个位置插入。
 *
 * 换成文件之后,并发抢号变成**文件名撞车**,git 当场报冲突,而不是静默交错。
 */

/** `ADR-08-采集累加器与交付物拆成两个文件.md` */
export const FILE_RE = /^ADR-(\d+)-(.+)\.md$/
/** 文件里的第一行:`# ADR-08 采集累加器与交付物拆成两个文件` */
export const HEAD_RE = /^#\s+ADR-(\d+)\s+(.+?)\s*$/

export interface Adr { file: string; num: number; title: string }

/** 编号宽度跟随既有约定:个位数补零到两位,其余原样。**编号不复用,允许有空号。** */
export const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 文件名里的标题部分。保留中文,只去掉会坏事的字符,分三类:
 *
 * - 文件系统有歧义的 `/ \ : * ? " < >`
 * - **Markdown 链接语法**的 `# [ ] ( )` —— `#` 留在文件名里,链接里它会被当成锚点,
 *   指向一个不存在的文件;方括号会把链接标签截断
 * - 表格分隔符 `|`
 *
 * 全角逗号一类**不剔** —— 它在文件名和链接里都无害,剔掉只会让既有文件
 * 全部改名,那是自造的假阳性。
 *
 * 截到 32 数的是**码点**,不是 `String` 的码元。`slice(0, 32)` 数码元,会从中间
 * 劈开一个代理对 —— 31 个汉字后面跟一个 emoji,切口正好落在那个 emoji 中间,
 * 留下半个字符。半个代理对不是合法 Unicode,写盘时 Node 把它换成 `�`,于是
 * **盘上的名字和算出来的名字不是同一个**:`--split` 刚写出的文件,`npm run adr`
 * 当场判它文件名与正文不符,而报错的位置离出错的位置隔着一整条命令。
 *
 * 只保到码点,不保到**字形簇** —— ZWJ 序列、旗帜、组合符照样会被劈开。这不是偷懒:
 * 劈开的字形簇仍是合法 Unicode,原样往返,名字稳定,检查照过,难看而已。
 * 界划在合法性上,是因为**合法性有规范定义的边界,好不好看没有**。
 *
 * 纯 BMP 的标题(这个仓库现有的全部)按码点和按码元截出来一模一样,所以既有文件
 * 一个都不改名。
 */
export const slugify = (title: string) =>
  [...title.replace(/[\/\\:*?"<>|#[\]()「」『』（）,。.]/g, '').replace(/\s+/g, '-')]
    .slice(0, 32).join('')

/**
 * 索引里的标签用的是**原标题**(不是过了 slugify 的文件名),所以结构性字符要在
 * 这里转义,一个都不能少 —— 少一个,`npm run adr` 仍报「索引一致」,而那份一致的
 * 索引点不开:
 *
 * | 字符 | 少转义会怎样 |
 * |---|---|
 * | `\\` | 它自己会把后面那个转义吃掉,所以**必须第一个转** |
 * | `\|` | 表格多切出一列 |
 * | `[` `]` | **提前终止链接标签** —— 一个标题里有 `]`,后面半截连同链接一起散成纯文本 |
 * | `<` `>` | 被当成原始 HTML 或自动链接 |
 * | `` ` `` | 起一个代码段,把后面的内容吞进去 |
 *
 * CommonMark 允许反斜杠转义任何 ASCII 标点,所以统一用反斜杠。
 */
export const escapeCell = (t: string) => t.replace(/[\\|[\]<>`]/g, c => '\\' + c)

/**
 * 链接目标里**只编码真正会断链的那一组** ASCII:空格与 `( ) # [ ] < > "`。
 *
 * 不用 `encodeURI` —— 它会把中文整片编成百分号序列,而中文在链接里本来合法,
 * 结果是索引变成一页看不懂的乱码,换来的安全是零。
 *
 * **`%` 自己也要编码。** 一个标题里含 `%20`,slugify 原样留在文件名里,而渲染器
 * 会把它当成编码过的空格 —— 链接指向一个别的文件名,`npm run adr` 却仍报一致。
 * 不必担心顺序:`String.replace` 的替换结果不会被再次扫描,所以把 `%` 放进
 * 同一个字符组就够,不会把自己产生的 `%2F` 再编一遍。
 *
 * 这一组之外的字符 slugify 已经从文件名里去掉了,所以那部分是兜底:
 * 万一哪天 slugify 放宽了,断的是链接而不是这条规则。
 */
export const encodeTarget = (t: string) =>
  t.replace(/[ %()#[\]<>"]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))

export const fileNameOf = (num: number, title: string) => `ADR-${pad(num)}-${slugify(title)}.md`

/**
 * 编号必须唯一,且文件名与正文标题里的编号必须一致。
 *
 * 后一条不是洁癖:改标题时只改了正文,文件名还留着旧编号,索引会指到一个
 * 说着别的编号的文件 —— 而下游引用的是编号。
 */
export function checkAll(adrs: Adr[]): string[] {
  const errors: string[] = []
  const seen = new Map<number, string>()
  for (const a of adrs) {
    const prev = seen.get(a.num)
    if (prev) errors.push(`ADR-${pad(a.num)} 被两个文件同时占用:${prev} 与 ${a.file} —— 编号不复用`)
    else seen.set(a.num, a.file)
    const want = fileNameOf(a.num, a.title)
    if (a.file !== want) errors.push(`${a.file} 的文件名与正文标题对不上,应为 ${want}`)
  }
  return errors
}

export function renderIndex(adrs: Adr[]): string {
  const rows = [...adrs].sort((a, b) => a.num - b.num)
    // 标签转义 `|`;链接目标编码 —— 文件名过了 slugify,标题没有,两边规则不同
    .map(a => `| **ADR-${pad(a.num)}** | [${escapeCell(a.title)}](${encodeTarget(a.file)}) |`)
  return ['| 编号 | 结论 |', '|---|---|', ...rows, ''].join('\n')
}

/**
 * 编号不可回收 —— 这一条要**对着历史**查,不是对着当前目录查。
 *
 * 只看当前目录的话,一个改动可以删掉某条记录、把号腾出来给另一条决策,再跑
 * `--write` 回写索引,一路全绿。而「一个不可回收的编号」是 `docs/adr/README.md`
 * 明写的契约,下游引用的正是这个号。
 *
 * 查两件事,而且**只查这两件**:
 *
 * - **号还在不在** —— 删了就是回收
 * - **标题变没变** —— 标题是这条决策的身份。号还在但标题换了,等于把号让给了
 *   另一条决策,下游那些引用 ADR-NN 的地方会静默指向一件别的事
 *
 * 比的是**正文第一行的完整标题**,不是文件名 —— `fileNameOf` 会剔标点、截到 32 字
 * 符,是个有损代理:一个长标题只在 32 字符之后改动、或只改了被剔掉的标点,文件名
 * 一模一样,借尸还魂就查不出来了。
 *
 * **只对着基线上已经落地的记录查。** 一条在本分支里新加、又在本分支里改掉或
 * 删掉的记录,不在这条检查的范围内 —— 它还是草稿,没有任何下游引用得到它,
 * 而合并之前修改自己的草稿是正常的。编号跨分支不撞车靠的是另一个机制:
 * 号一旦落地,别的分支再取同一个号就是**文件名撞车**,git 当场报冲突。
 *
 * **不查正文**:就地标注作废是这个仓库既有的做法(ADR-13 就是那么改的),
 * 把正文一起冻住会把这个正当操作也挡掉。作废要写在正文里,标题不动。
 */
export interface Baseline { file: string; title: string }

export function checkAppendOnly(before: Map<number, Baseline>, after: Adr[]): string[] {
  const now = new Map(after.map(a => [a.num, a]))
  const errors: string[] = []
  for (const [num, was] of before) {
    const cur = now.get(num)
    if (!cur) {
      errors.push(`ADR-${pad(num)} 在主干上存在,这里没有了 —— 编号不可回收,记录只作废不删除`)
    } else if (cur.title !== was.title) {
      errors.push(`ADR-${pad(num)} 的标题变了(「${was.title}」→「${cur.title}」)—— 编号不可回收。`
        + '作废写进正文,标题不动;确实是另一条决策的,新开一个号')
    }
  }
  return errors
}

/**
 * 生成区标记的形状。`--write` 是 `slice(0, i) + want + slice(j + end.length)` ——
 * 这个式子只在**恰好一对、BEGIN 在前**时成立,所以两个都在还不够:
 *
 * | 形状 | 回写会怎样 |
 * |---|---|
 * | 缺任一个 | 下标为 −1,切出来的位置全错 |
 * | END 在 BEGIN 前 | 两个下标都非负、判断放行,而前半段留下 END、后半段又把 BEGIN 抄一遍 —— **索引被写坏**,而这条命令正是报错时让人去跑的那条 |
 * | 不止一对 | `indexOf` 只认第一个,多出来的那对留在生成区里,下一次比对永远不一致,提示还是「跑 `--write`」—— 一个自己修不好自己的循环 |
 *
 * 判不准时**不动**:回写会盖掉内容,报错让人看一眼,比动了便宜。
 */
export type MarkerFault = 'missing' | 'reversed' | 'duplicate'

export function markerFault(text: string, begin: string, end: string): MarkerFault | null {
  const i = text.indexOf(begin)
  const j = text.indexOf(end)
  if (i < 0 || j < 0) return 'missing'
  if (j < i) return 'reversed'
  if (text.indexOf(begin, i + 1) >= 0 || text.indexOf(end, j + 1) >= 0) return 'duplicate'
  return null
}
