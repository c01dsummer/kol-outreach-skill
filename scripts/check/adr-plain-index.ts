/**
 * 决策记录的白话目录（`docs/adr/白话目录.md`，ADR-236）：每份决策记录一行白话，原文不动。
 *
 * 机器只管「一一对应、格都填了」：目录里每一行是 `| ADR-<编号> | 定了什么 | 对用户有什么影响 | 还欠什么 |`，
 * 编号与 `docs/adr/` 下的记录一一对应 —— 新记录没补那一行、目录里多出没有记录的一行、同一个编号写了两行，
 * 都报红；四格任何一格是空的也报红。写得白不白、说得对不对，仍由写的人和评审读（`docs/GLOSSARY.md` 那套白话规矩）。
 *
 * 哪几行是目录表、哪几行不是，交给 Markdown 解析器（`marked`，GFM）定，不自己认：读的人在页面上看到的那张表，
 * 就是检查核的那张表。围栏或缩进四格的代码块、HTML 注释、引用块和列表里的东西，解析器怎么渲染，这里就怎么算 ——
 * 自己一条条认写法，每漏一种就多一个洞（ADR-236 末尾）。
 * 目录表 = 顶层那张表头一字不差的表；表外任何一行以「|」开头的文字、目录表之外的任何表，都报红（不悄悄跳过）。
 * 表内每一行的格子照原文按竖线切（`cellsOf`，转义的竖线不算分格）：解析器会把多出的格子丢掉、少的补空，
 * 那样「这一行几格」就看不出来了。只写占位（`&nbsp;`、`<br>`、一个横线）的格子算空。
 */
import { marked, type Token, type Tokens } from 'marked'
import { cellsOf } from './adr-fact-table.js'

/** 目录文件名（放在 `docs/adr/` 下，不是一份决策记录，`adrSync` 读目录时跳过它） */
export const PLAIN_INDEX_FILE = '白话目录.md'
/** 表头一字不差 */
export const PLAIN_INDEX_HEAD = '| 编号 | 定了什么 | 对用户有什么影响 | 还欠什么 |'
const HEAD_CELLS = cellsOf(PLAIN_INDEX_HEAD)
/** 只写了占位、看着有字其实没写的格子 */
const blankCell = (c: string): boolean => ['', '-', '—', '–'].includes(c.replace(/&nbsp;|<br\s*\/?>/gi, '').trim())
/** 目录行：第一格是 `ADR-<编号>`（编号可带前导零，与记录文件名一致） */
const ROW_RE = /^ADR-(\d+)$/

const isDirectoryTable = (t: Token): t is Tokens.Table =>
  t.type === 'table' && (t as Tokens.Table).header.length === HEAD_CELLS.length
  && (t as Tokens.Table).header.every((c, i) => c.text.trim() === HEAD_CELLS[i])

/** 一个块里（含引用块、列表里套的）以「|」开头的文字行与表：交回各自相对这个块开头的行号偏移 */
function strays(t: Token): { kind: 'line' | 'table', at: number }[] {
  if (t.type === 'code' || t.type === 'html' || t.type === 'space') return []
  if (t.type === 'table') return [{ kind: 'table', at: 0 }]
  const children = [...('tokens' in t && Array.isArray(t.tokens) ? t.tokens : []), ...('items' in t && Array.isArray(t.items) ? t.items : [])] as Token[]
  if (t.type === 'paragraph' || t.type === 'text' || children.length === 0) {
    return t.raw.split('\n').flatMap((l, i) => l.trim().startsWith('|') ? [{ kind: 'line' as const, at: i }] : [])
  }
  // 套着的块（引用、列表）：里面的行号对不回原文，只报到这个块的开头
  return children.flatMap(strays).map(s => ({ kind: s.kind, at: 0 }))
}

/**
 * 核白话目录：`nums` 是 `docs/adr/` 下现有记录的编号，`text` 是目录全文（读不到时传 `undefined`）。
 * 返回每一处问题一句话；一一对应、格都填了时返回空数组。
 */
export function plainIndexFaults(nums: readonly number[], text: string | undefined): string[] {
  if (text === undefined) return [`缺少 docs/adr/${PLAIN_INDEX_FILE}（每份决策记录一行白话，ADR-236）`]
  const faults: string[] = []
  const tokens = marked.lexer(text, { gfm: true })
  // 顶层各块的原文首尾相接就是全文，按它数行号
  let line = 1
  let directory: { token: Tokens.Table, line: number } | undefined
  const seen = new Map<number, number>()
  for (const t of tokens) {
    const start = line
    line += (t.raw.match(/\n/g) ?? []).length
    if (isDirectoryTable(t) && directory === undefined) { directory = { token: t, line: start }; continue }
    for (const s of strays(t)) {
      faults.push(s.kind === 'table'
        ? `${PLAIN_INDEX_FILE} 第 ${start + s.at} 行起另有一张表：目录里只许有一张目录表，别的表不核、也不算数`
        : `${PLAIN_INDEX_FILE} 第 ${start + s.at} 行像目录行，却不在目录表里（表头下少了分隔行、隔了空行、写在表头之前或缩进了），页面上它不在那张表里，不算数`)
    }
  }
  if (directory === undefined) {
    faults.push(`${PLAIN_INDEX_FILE} 里没有表头 \`${PLAIN_INDEX_HEAD}\` 下面紧跟分隔行 \`|---|---|---|---|\` 的目录表（缩进四格、写在代码块里的不算）`)
  } else {
    // 表的原文：第一行表头、第二行分隔行，其后每行一条目录行，与解析器交回的行一一对应
    const rows = directory.token.raw.split('\n').slice(2).filter(l => l.trim() !== '')
    rows.forEach((raw, k) => {
      const at = directory!.line + 2 + k
      const cells = cellsOf(raw)
      const m = ROW_RE.exec(cells[0] ?? '')
      if (!m) { faults.push(`${PLAIN_INDEX_FILE} 第 ${at} 行第一格应是 \`ADR-<编号>\``); return }
      const num = Number(m[1])
      const where = `${PLAIN_INDEX_FILE} 第 ${at} 行（ADR-${m[1]}）`
      const first = seen.get(num)
      if (first !== undefined) faults.push(`${where} 与第 ${first} 行是同一个编号，一份记录只写一行`)
      else seen.set(num, at)
      if (cells.length !== 4) faults.push(`${where} 应是四格（编号、定了什么、对用户有什么影响、还欠什么），这一行是 ${cells.length} 格`)
      else if (cells.slice(1).some(blankCell)) faults.push(`${where} 有空格子（或只写了占位）：定了什么、对用户有什么影响、还欠什么三格都要写（没有就写「无」）`)
    })
  }
  const have = new Set(nums)
  for (const n of [...have].sort((a, b) => a - b)) {
    if (!seen.has(n)) faults.push(`ADR-${n} 在 ${PLAIN_INDEX_FILE} 里没有那一行 —— 新加决策记录时同一条改动里补上`)
  }
  for (const [n, at] of [...seen].sort((a, b) => a[0] - b[0])) {
    if (!have.has(n)) faults.push(`${PLAIN_INDEX_FILE} 第 ${at} 行写的 ADR-${n} 在 docs/adr/ 下没有这份记录`)
  }
  return faults
}
