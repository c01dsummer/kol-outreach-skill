/**
 * 生词提示的**判定**（ADR-237）—— 一条改动在 Markdown 里新加的行，冒出了哪几处读的人可能看不懂的写法。
 *
 * **只提醒，不判该不该写。** 列出来的是三种「多半要配一句白话」的形状，读的人（写的人自己、评审）再判：
 *
 * - **生词**：加粗（`**词**`）或书名号（`「词」`）里的短词，既不在术语表（`docs/GLOSSARY.md`）的词条里，
 *   也没在仓库任何一份 Markdown 的标题里出现过。为什么只认这两种写法：需求所有者 2026-11-22 在选择卡上选的
 *   「只认加粗和书名号里的短词」—— 自造的词几乎都是加粗或打书名号引进来的；不靠分词去猜哪段话是新词。
 * - **行号引用**：`ADR-数字:行号`。术语表「编号怎么读」那一节说这是旧写法、不再新写。
 * - **没配白话的需求编号**：`P2`、`D31.x` 这种，只认需求清单（`docs/requirements.json`）里真有的需求与判据编号，
 *   后面紧跟着全角或半角括号、书名号或全角冒号的算配了白话（编号外面套着加粗之类的，越过收尾记号再看），别的都列。
 *
 * 认得的词只有两个来源，都由入口从仓库里现读，这里不维护任何手写表：术语表每一行的第一格（`glossaryTerms`），
 * 和各份 Markdown 的标题（`headingTexts`）。代码块、行内代码、HTML 与注释里的字不算（整份交给解析器认，`codeRanges`）
 * —— 那是在演示写法，不是在用它。
 */
import { Lexer, marked, type Token, type Tokens } from 'marked'
import { addedLines } from './field-use-rule.js'
import { quotedMask } from './quoted.js'

/** 一处提示：哪个文件第几行、哪一种、原文 */
export interface JargonHit { readonly file: string; readonly line: number; readonly kind: JargonKind; readonly word: string }
/** 一行里的一处提示：哪一种、原文 */
export interface LineHit { readonly kind: JargonKind; readonly word: string }
export type JargonKind = '生词' | '行号引用' | '没配白话的需求编号'

/** 「短」：去掉首尾空白后 2 到 8 个字，中间不含空白与断句的标点 —— 再长就是一句话，不是一个词 */
const SHORT_MAX = 8
const BREAKS = /[\s，。；：！？、,;:!?|（）()]/u
export const isShortWord = (w: string): boolean => {
  const t = w.trim(), n = Array.from(t).length
  return n >= 2 && n <= SHORT_MAX && !BREAKS.test(t)
}

/**
 * 一段 Markdown 里「不显示成正文」的几段在原文里的起止：代码块（围栏的、缩进四格的）、行内代码、HTML（块与行内，含注释）。
 * 交给 Markdown 解析器（`marked`）认 —— 起止反引号串等长、没配对的不算、行内代码跨行，都照解析器 —— 不自己写正则。
 */
function codeRanges(text: string, tokens: readonly Token[]): [number, number][] {
  const out: [number, number][] = []
  // 各记号的原文按先后排在父记号的原文里，在父记号那一段里往后找。引用块、列表里跨行的段落，解析器交回的原文去掉了
  // 行首的「>」或缩进，在原文里找不到，整段跳过 —— 那里不跨行的行内代码由 `lineHits` 逐行再认一次，跨行的认不出（ADR-237 欠条）
  const walk = (list: readonly Token[], from: number, to: number): void => {
    let at = from
    for (const t of list) {
      // 表格的格子不在 tokens／items 里，在表头 header[] 与各行 rows[][] 的 tokens 里，按原文里的先后：表头从左到右，再一行一行
      const cells = t.type === 'table' ? [...(t as Tokens.Table).header, ...(t as Tokens.Table).rows.flat()].flatMap(c => c.tokens) : []
      const kids = [...('tokens' in t && Array.isArray(t.tokens) ? t.tokens : []), ...('items' in t && Array.isArray(t.items) ? t.items : []), ...cells] as Token[]
      const i = text.indexOf(t.raw, at)
      if (i < 0 || i + t.raw.length > to) continue
      if (t.type === 'codespan' || t.type === 'code' || t.type === 'html') out.push([i, i + t.raw.length])
      else walk(kids, i, i + t.raw.length)
      at = i + t.raw.length
    }
  }
  walk(tokens, 0, text.length)
  return out
}

/** 把 `ranges` 里的字换成空格（换行留着、位置不挪） */
const blankRanges = (text: string, ranges: readonly [number, number][]): string =>
  ranges.reduce((s, [a, b]) => s.slice(0, a) + s.slice(a, b).replace(/[^\n]/g, ' ') + s.slice(b), text)

/** 去掉行内代码：每段行内代码连同反引号换成空格（位置不挪，只为后面不把演示的写法当成在用） */
export const stripCodeSpans = (line: string): string =>
  blankRanges(line, codeRanges(line, Lexer.lexInline(line)).filter(([a, b]) => line.slice(a, b).startsWith('`')))

/** 术语表：每张表每一行的第一格算词条；格子里用「、」「/」分开的几种写法各算一个，反引号、书名号里的也各算一个 */
export function glossaryTerms(text: string): Set<string> {
  const out = new Set<string>()
  const lines = text.split('\n'), mask = quotedMask(text)
  lines.forEach((line, i) => {
    if (mask[i] || !line.startsWith('|') || /^\|\s*:?-+/.test(line)) return
    const first = line.split('|')[1] ?? ''
    const parts = [first, ...[...first.matchAll(/`([^`]+)`|「([^」]+)」|\*\*([^*]+)\*\*/g)].map(m => m[1] ?? m[2] ?? m[3])]
    // 括号里的说明与括号外的词各算一个（「已查询但未取得有效值（怪值）」认「怪值」）；空白也断开（「更正块 `⚠️`」认「更正块」）
    for (const p of parts) for (const w of p.replace(/[`*「」]/g, '').split(/[、\/\s]|[（()）]/)) if (w.trim() !== '') out.add(w.trim())
  })
  return out
}

/**
 * 一份 Markdown 的标题文字（`#` 到 `######` 开头的行，围栏与注释里的不算）。`skip` 是这次新加的行号（从 1 起）：
 * 这条分支自己新加的标题不算「已有的标题」—— 新造一个词、顺手拿它起个标题，不该就此不报。
 */
export function headingTexts(text: string, skip: ReadonlySet<number> = new Set()): string[] {
  const lines = text.split('\n'), mask = quotedMask(text)
  return lines.flatMap((line, i) => {
    const m = mask[i] || skip.has(i + 1) ? null : /^ {0,3}#{1,6}\s+(.+)$/.exec(line)
    return m ? [m[1]] : []
  })
}

/** 需求清单里的编号：每条需求的 id 与它底下每条判据的 id */
export function requirementIds(json: string): Set<string> {
  const doc = JSON.parse(json) as { requirements?: { id: string; accept?: { id: string }[] }[] }
  const out = new Set<string>()
  for (const r of doc.requirements ?? []) {
    out.add(r.id)
    for (const a of r.accept ?? []) out.add(a.id)
  }
  return out
}

/** 判定要用的、从仓库里现读的东西 */
export interface JargonKnown {
  /** 术语表词条 */
  readonly terms: ReadonlySet<string>
  /** 各份 Markdown 的标题 */
  readonly headings: readonly string[]
  /** 需求与判据编号 */
  readonly reqIds: ReadonlySet<string>
}

// 编号两头不能连着字母数字（长在别的词里的不算）；下划线只在它另一头也连着字母数字时才算词的一部分，
// 单独一根下划线是斜体记号（`_P2_`），照样认
const ID_RE = /(?<![A-Za-z0-9.\-]|[A-Za-z0-9]_)([PSDFU]\d+(?:\.[a-z]+\d*)?)(?![A-Za-z0-9\-]|_[A-Za-z0-9])/g
const GLOSSED = /^\s*[（(「：]/

/** 一行里的提示（已去掉行内代码）。生词按出现先后、同一行同一个词只报一次。 */
export function lineHits(raw: string, known: JargonKnown): LineHit[] {
  const line = stripCodeSpans(raw), out: LineHit[] = [], seen = new Set<string>()
  for (const m of line.matchAll(/\*\*([^*\n]+?)\*\*|「([^」\n]+)」/g)) {
    const w = (m[1] ?? m[2]).replace(/[*「」]/g, '').trim() // 加粗套书名号（**「词」**、「**词**」）的，按里面那个词认
    // 需求清单里的编号（`**P2**`）不当生词：配没配白话归下面「需求编号」那一种管
    if (!isShortWord(w) || seen.has(w) || known.terms.has(w) || known.reqIds.has(w) || known.headings.some(h => h.includes(w))) continue
    seen.add(w); out.push({ kind: '生词', word: w })
  }
  for (const m of line.matchAll(/ADR-\d+:\d+/g)) out.push({ kind: '行号引用', word: m[0] })
  for (const m of line.matchAll(ID_RE)) {
    // 编号外面套的加粗、斜体、删除线（`**P2**（…）`）先越过它的收尾记号，再看后面配没配白话
    if (!known.reqIds.has(m[1]) || GLOSSED.test(line.slice(m.index! + m[0].length).replace(/^[*_~]+/, ''))) continue
    out.push({ kind: '没配白话的需求编号', word: m[1] })
  }
  return out
}

/**
 * 整次改动：`added` 是「文件 → 新加的行号」（`field-use-rule.ts` 的 `addedLines` 读出来的），
 * `read` 按路径交回文件现在的全文，读不到交回那个错。只看 `.md`。
 * 整份交给解析器（`codeRanges`）先把代码块、行内代码（含跨行的）、HTML 与注释换成空格，再一行行看新加的那几行 ——
 * 一行一行单看，跨行的行内代码、注释就认不出来。有新加的行却读不到的那一份记进 `unread`（不当成没东西可报）。
 */
export function jargonHits(added: ReadonlyMap<string, ReadonlySet<number>>, read: (file: string) => string | Error, known: JargonKnown): { hits: JargonHit[]; unread: string[] } {
  const hits: JargonHit[] = [], unread: string[] = []
  for (const file of [...added.keys()].filter(f => f.endsWith('.md')).sort()) {
    const ns = [...added.get(file)!].sort((a, b) => a - b)
    if (ns.length === 0) continue
    const got = read(file)
    if (got instanceof Error) { unread.push(`${file}（读不到：${got.message.split('\n')[0]}）`); continue }
    const text = got.replace(/\r\n?/g, '\n')
    const lines = blankRanges(text, codeRanges(text, marked.lexer(text, { gfm: true }))).split('\n')
    for (const n of ns) {
      if (lines[n - 1] === undefined || lines[n - 1].trim() === '') continue
      for (const h of lineHits(lines[n - 1], known)) hits.push({ file: file, line: n, kind: h.kind, word: h.word })
    }
  }
  return { hits, unread }
}

/**
 * 扫哪些行：`changed` 是改过的文件（相对仓库根），只看 `.md`；`diffOf` 交回那一份的 `git diff -U0` 原文，块头交给
 * 字段断言闸门那套 `addedLines` 读。哪一份 `diffOf` 抛错（被当成二进制之类），只跳过那一份并记下原因，不让整份提示落空。
 */
export function addedMarkdown(changed: readonly string[], diffOf: (file: string) => string): { added: Map<string, Set<number>>; skipped: string[] } {
  const added = new Map<string, Set<number>>(), skipped: string[] = []
  for (const file of changed.filter(f => f.endsWith('.md'))) {
    try {
      for (const [f, ns] of addedLines([[file, diffOf(file)]])) added.set(f, ns)
    } catch (error) { skipped.push(`${file}（${(error as Error).message.split('\n')[0]}）`) }
  }
  return { added, skipped }
}

/**
 * 认得的词从哪里来：`tracked` 是仓库里跟踪的文件，`read` 按路径交回全文（读不到抛错）。术语表、需求清单不在就当空；
 * 各份 `.md` 的标题里，这次新加的那几行（`added`）不算 —— 新造一个词、顺手拿它起个标题，不该就此不报。
 */
export function knownFrom(tracked: readonly string[], read: (file: string) => string, added: ReadonlyMap<string, ReadonlySet<number>>): JargonKnown {
  const has = (f: string) => tracked.includes(f)
  return {
    terms: has('docs/GLOSSARY.md') ? glossaryTerms(read('docs/GLOSSARY.md')) : new Set<string>(),
    headings: tracked.filter(f => f.endsWith('.md')).flatMap(f => { try { return headingTexts(read(f), added.get(f)) } catch { return [] } }),
    reqIds: has('docs/requirements.json') ? requirementIds(read('docs/requirements.json')) : new Set<string>(),
  }
}

/** 汇总一句（进 CI 的通知，只有固定文案与数字） */
export function jargonSummary(hits: readonly JargonHit[]): string {
  if (hits.length === 0) return '生词提示：新加的行里没有要配白话的写法 —— 只认加粗、书名号里的短词，行号引用，需求编号'
  const count = (k: JargonKind) => hits.filter(h => h.kind === k).length
  return `生词提示：新加的行里有 ${count('生词')} 处生词、${count('行号引用')} 处行号引用、${count('没配白话的需求编号')} 处没配白话的需求编号 —— 只提醒，不拦合入；该配白话的配上，或把词收进术语表`
}

/** 全文：每处一行（位置、种类、原文），空一行，汇总 */
export function jargonLines(hits: readonly JargonHit[]): string[] {
  return [...hits.map(h => `${h.file}:${h.line}  [${h.kind}]  ${h.word}`), ...(hits.length ? [''] : []), `  ${jargonSummary(hits)}`]
}
