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

/** 文件名里的标题部分。保留中文,只去掉在文件名里有歧义的字符。 */
export const slugify = (title: string) =>
  title.replace(/[\/\\:*?"<>|「」『』()（）,,。.]/g, '').replace(/\s+/g, '-').slice(0, 32)

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
    .map(a => `| **ADR-${pad(a.num)}** | [${a.title}](${a.file}) |`)
  return ['| 编号 | 结论 |', '|---|---|', ...rows, ''].join('\n')
}
