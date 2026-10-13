/**
 * 顺序契约表每行点名的变异对不对得上的判定（ADR-148）—— 准备接进 `mutate.ts` 开跑前体检的那一半，
 * 理由与 `attribution-rule.ts` 同：有语义就该能被测，而 `mutate.ts` 上的变异抓不到。
 *
 * 只核字面绑定：点名的变异在变异目录里、它的 `file` 在这一行的「位置」栏里。
 * **守不守这一行不判** —— 那要看施加之后的后果（ADR-146 第一节），是读，不是跑。
 * 截表、切行、切格、认编号、展开区间也都在这里：范围被悄悄缩小和比错一样致命。
 */

/** 变异目录里与绑定有关的两样 */
export interface OrderMutation { readonly id: string; readonly file: string }

/** ADR-148 第二节的各种问题；line 是 docs/ARCHITECTURE.md 里的行号（从 1 起） */
export type OrderFault =
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'markers'; readonly begins: number; readonly ends: number }
  | { readonly kind: 'header' }
  | { readonly kind: 'stray'; readonly line: number }
  | { readonly kind: 'shape'; readonly line: number; readonly cells: number; readonly expected: number }
  | { readonly kind: 'malformed'; readonly line: number; readonly text: string }
  | { readonly kind: 'empty'; readonly line: number }
  | { readonly kind: 'unknown'; readonly line: number; readonly id: string }
  | { readonly kind: 'off-site'; readonly line: number; readonly id: string; readonly file: string }

const BEGIN = 'BEGIN:ORDER'
const END = 'END:ORDER'
const ID = /^M-[A-Z]+[0-9]+-[a-z]+$/
// 区间两端至多两个字母（ADR-148 第二节）：展开至多 702 个；也让下面按数比大小的那一步不会超出浮点数的精度
const RANGE = /^(M-[A-Z]+[0-9]+-)([a-z]{1,2})[…–]([a-z]{1,2})$/
// 长得像编号、又不完全是：大小写不限的前缀片段，或者一个区间记号
const LOOKS_LIKE = /[Mm]-[A-Za-z]+[0-9]+-|[…–]/
const SEPARATORS = /[\s、，；：。,;:（）()「」]+/
const SEPARATOR_CELL = /^:?-+:?$/

const occurrences = (text: string, part: string): number => text.split(part).length - 1

/** 第二节第 1 小节的切格：去掉第一个竖线及之前，行尾的竖线去掉一个，再按竖线切、逐格去首尾空白 */
const cellsOf = (line: string): string[] => {
  let rest = line.slice(line.indexOf('|') + 1)
  const trimmed = rest.trimEnd()
  if (trimmed.endsWith('|')) rest = trimmed.slice(0, -1)
  return rest.split('|').map(c => c.trim())
}

/** 字母串当成没有零的二十六进制数：a=1 … z=26，aa=27 */
const rank = (s: string): number => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 96, 0)
const letters = (n: number): string => n > 0 ? letters(Math.floor((n - 1) / 26)) + String.fromCharCode(97 + (n - 1) % 26) : ''

/** 一格「守它的变异」读成编号与写错的词，都按出现的先后 */
const namesIn = (cell: string): { ids: string[]; malformed: string[] } => {
  const ids: string[] = []
  const malformed: string[] = []
  for (const word of cell.split(SEPARATORS)) {
    if (word === '') continue
    if (ID.test(word)) { ids.push(word); continue }
    const range = RANGE.exec(word)
    if (range !== null && rank(range[3]) > rank(range[2])) {
      for (let k = rank(range[2]); k <= rank(range[3]); k++) ids.push(range[1] + letters(k))
      continue
    }
    if (LOOKS_LIKE.test(word)) malformed.push(word)
  }
  return { ids, malformed }
}

/** 按 ADR-148 第二节核整张表；返回第二节第 3 小节的先后。纯函数，不读文件、不起进程 */
export function orderBindingFaults(doc: string | undefined, mutations: readonly OrderMutation[]): OrderFault[] {
  if (doc === undefined) return [{ kind: 'unreadable' }]
  const begins = occurrences(doc, BEGIN)
  const ends = occurrences(doc, END)
  if (begins !== 1 || ends !== 1 || doc.indexOf(BEGIN) > doc.indexOf(END)) return [{ kind: 'markers', begins, ends }]
  // 行尾的 \r 不另去：判空行、认表格行、切格、切词都按空白去头尾或切开，\r 本来就是空白
  const lines = doc.split('\n')
  const first = lines.findIndex(l => l.includes(BEGIN)) + 1
  const last = lines.findIndex(l => l.includes(END))
  const scope: { line: number; text: string }[] = []
  for (let i = first; i < last; i++) scope.push({ line: i + 1, text: lines[i] })
  const isTable = (t: string): boolean => t.trimStart().startsWith('|')
  const head = scope.findIndex(l => isTable(l.text))
  const header = head < 0 ? undefined : cellsOf(scope[head].text)
  const separator = head < 0 || head + 1 >= scope.length || !isTable(scope[head + 1].text)
    ? undefined : cellsOf(scope[head + 1].text)
  const at = (name: string): number => header === undefined || header.filter(c => c === name).length !== 1 ? -1 : header.indexOf(name)
  const site = at('位置')
  const named = at('守它的变异')
  if (header === undefined || separator === undefined
      || !separator.every(c => SEPARATOR_CELL.test(c)) || site < 0 || named < 0) return [{ kind: 'header' }]

  const catalog = new Map<string, string>()
  for (const m of mutations) if (!catalog.has(m.id)) catalog.set(m.id, m.file)
  const faults: OrderFault[] = []
  scope.forEach(({ line, text }, i) => {
    if (i === head || i === head + 1 || text.trim() === '') return
    if (!isTable(text)) { faults.push({ kind: 'stray', line }); return }
    const cells = cellsOf(text)
    if (cells.length !== header.length) { faults.push({ kind: 'shape', line, cells: cells.length, expected: header.length }); return }
    const sites = [...cells[site].matchAll(/`([^`]*)`/g)].map(m => m[1])
    const { ids, malformed } = namesIn(cells[named])
    for (const word of malformed) faults.push({ kind: 'malformed', line, text: word })
    const distinct = [...new Set(ids)]
    if (distinct.length === 0) { faults.push({ kind: 'empty', line }); return }
    for (const id of distinct) {
      const file = catalog.get(id)
      if (file === undefined) faults.push({ kind: 'unknown', line, id })
      else if (!sites.includes(file)) faults.push({ kind: 'off-site', line, id, file })
    }
  })
  return faults
}
