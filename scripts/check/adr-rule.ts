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
 */
export const slugify = (title: string) =>
  title.replace(/[\/\\:*?"<>|#[\]()「」『』（）,。.]/g, '').replace(/\s+/g, '-').slice(0, 32)

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
