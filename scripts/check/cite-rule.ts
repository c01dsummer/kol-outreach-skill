/**
 * 被引表 —— 每条决策记录被几条**别的**记录引过、有没有「教训」栏（ADR-151 第一节 P2）。
 *
 * **只报数，不设阈值、不判。** 前列哪几条是同一类、该不该把一句搬进 `process/`，是读，
 * 交给写新记录的人与评审；这里没有一条会判红（ADR-151 第四节第 1 条：P2 不是闸门）。
 *
 * 口径（ADR-151 第二节第 2 条；欠条块那一条是需求所有者在提案 §7 第 5 项选的「排除」）：
 *
 * - **引用** = 一行里的 `ADR-<编号>`。斜杠接写的 `ADR-16/17/23` 每个编号各算一次；
 *   别的简写（`ADR-97、99`、「第 97 条」）不认。编号按数比，`ADR-8` 与 `ADR-08` 是同一条
 * - **按文件去重**：一条记录引另一条十次，也只算一条
 * - **排自引**：记录提到自己的编号不算
 * - **过引文遮罩**：围栏代码块与 HTML 注释里的不算（`quoted.ts`）
 * - **欠条块里的单列**：块的定界与孤儿闸门是同一份（`debt-rule.ts` 的 `iouBlocks`）。
 *   主计数只数在块外引过它的记录；只在块里引过它的另成一栏，两栏加起来就是引过它的记录数
 * - **只认 `ADR-<编号>-<标题>.md` 这些文件**（`adr-rule.ts` 的 `FILE_RE`），引用方与被引方都是。
 *   索引 `README.md` 把每条都列一遍，算进来的话每条都白多一；引到目录里没有的编号，不进表
 * - **教训栏**：有一行以 `##`／`###` 加「教训」开头，或以 `- ` 加「教训」开头（中间可以有加粗记号）——
 *   提案 §1 表后那条 grep 的口径，同样过遮罩
 */
import { basename } from 'node:path'
import { FILE_RE } from './adr-rule.js'
import { iouBlocks } from './debt-rule.js'
import { quotedMask } from './quoted.js'

const REF = /ADR-(\d+)((?:\/\d+)*)/g
const LESSON = /^#{2,3}\s*教训|^-\s*\*{0,2}教训/

export interface CiteRow {
  file: string
  no: number
  /** 在欠条块外引过它的别的记录数 */
  cited: number
  /** 只在欠条块里引过它的别的记录数 */
  iouOnly: number
  lesson: boolean
}

/** 一行里引到的编号，斜杠接写的展开。 */
export function refs(line: string): number[] {
  return [...line.matchAll(REF)].flatMap(m => [m[1], ...m[2].split('/').slice(1)].map(Number))
}

const recordNo = (file: string): number | undefined => {
  const m = FILE_RE.exec(basename(file))
  return m ? Number(m[1]) : undefined
}

/** 全表，按被引数降序；同数按编号升序，好让前十条是确定的那十条。 */
export function citeTable(docs: Map<string, string>): CiteRow[] {
  const outside = new Map<number, Set<string>>(), inside = new Map<number, Set<string>>()
  const add = (to: Map<number, Set<string>>, no: number, from: string) => {
    const set = to.get(no) ?? new Set<string>()
    set.add(from)
    to.set(no, set)
  }
  const lessons = new Set<string>()
  for (const [file, text] of docs) {
    const self = recordNo(file)
    if (self === undefined) continue
    const lines = text.split('\n')
    const quoted = quotedMask(text)
    const inIou = lines.map(() => false)
    for (const { start, end } of iouBlocks(lines, quoted)) for (let k = start; k < end; k++) inIou[k] = true
    lines.forEach((line, i) => {
      if (quoted[i]) return
      if (LESSON.test(line)) lessons.add(file)
      for (const no of refs(line)) if (no !== self) add(inIou[i] ? inside : outside, no, file)
    })
  }
  const rows: CiteRow[] = []
  for (const file of docs.keys()) {
    const no = recordNo(file)
    if (no === undefined) continue
    const out = outside.get(no) ?? new Set<string>()
    rows.push({ file, no, cited: out.size, iouOnly: [...inside.get(no) ?? []].filter(f => !out.has(f)).length, lesson: lessons.has(file) })
  }
  return rows.sort((a, b) => b.cited - a.cited || a.no - b.no)
}

/**
 * 审计默认输出末尾那一行，也是全表的末行。
 *
 * 「前十条里有教训栏的」是提案 §7 给 P2 的证据问题（「被引最多的 10 条里几条有教训栏？」），
 * 所以单报。末尾那句限定不是客套：去掉它，读的人会把排在前面当成「该搬进 `process/` 了」。
 */
export function citeSummary(rows: CiteRow[]): string {
  const n = (keep: (r: CiteRow) => boolean) => rows.filter(keep).length
  return `被引表 ${rows.length} 条记录 · 被引 3 次及以上 ${n(r => r.cited >= 3)} · 1–2 次 ${n(r => r.cited >= 1 && r.cited < 3)}` +
         ` · 0 次 ${n(r => r.cited === 0)} · 有教训栏 ${n(r => r.lesson)} · 前十条里有教训栏 ${rows.slice(0, 10).filter(r => r.lesson).length}` +
         ' —— 只报数，不设阈值，也不判哪几条是同一类'
}

/** `npm run adr-ledger -- --cites` 打的全表：一条一行、空一行、末尾汇总。 */
export function citeReport(rows: CiteRow[]): string[] {
  return [
    ...rows.map(r => `${r.file}  被引 ${r.cited} · 只在欠条块里引 ${r.iouOnly} · ${r.lesson ? '有' : '无'}教训栏`),
    '',
    `  ${citeSummary(rows)}`,
  ]
}
