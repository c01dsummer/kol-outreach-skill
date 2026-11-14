/**
 * 欠条点名提醒的**判定** —— 一条改动改到的文件里，哪些被还开着的欠条写进了正文。
 *
 * **只提醒，不判响没响。** 点了名不等于条件成立（条件常是「碰 X 的 PR，或某片开工」这种析取），
 * 没点名也不等于没响（ADR-86 第二节那三处实测：符号名不出现在自己的 diff 里、历史上漏报过一次）。
 * 这里只做一件机械的事：欠条正文里逐字写着的文件路径，和这次改到的文件取交，交出那几条让人去读。
 * 需求所有者 2026-11-14 要的就是这一件（KOL-110），为什么这一回不违背 ADR-86 第三节记在 ADR-196。
 *
 * 和 ADR-86 撤掉的那一版的分界：**不解析词，不维护符号索引。** 认得的名字只有一种来源 ——
 * 仓库里受控文件的路径本身（`pathNames`），所以没有一张会漂的手写表；代码标识符、需求编号、
 * 「某模块」「某类改动」这种写法一律认不出，那部分仍靠人读台账。
 *
 * 条目来自 `debt-rule.ts` 的 `entries`，块的定界来自它的 `iouBlocks` —— 不另抽一份，
 * 免得两边对「哪些是欠条」说两样。已还／已重挂／收尾那几种状态行（写法见 ADR-167 第五节）
 * 台账今天还不读（ADR-167 第六片），这里先按同一写法读，只用来不列已关的那些。
 */
import { entries, iouBlocks, type Entry } from './debt-rule.js'
import { quotedMask } from './quoted.js'

/**
 * 每个文件能被怎样点名：完整路径，以及按 `/` 切出来的尾段里**只属于它一个**、且带扩展名的那些。
 *
 * `scripts/check/mutate.ts` 于是认 `scripts/check/mutate.ts`、`check/mutate.ts`、`mutate.ts`；
 * `README.md` 在仓库里不止一份，只认完整路径 —— 认了尾段，一句「README.md」会点到每一份。
 * 不带点的尾段不认：`check`、`scripts` 是目录名，也是普通的词。
 * 交回的键是名字，值是它指的那个文件。
 */
export function pathNames(files: string[]): Map<string, string> {
  const owners = new Map<string, Set<string>>()
  for (const file of new Set(files)) {
    const parts = file.split('/')
    for (let i = 0; i < parts.length; i++) {
      const name = parts.slice(i).join('/')
      if (i > 0 && !parts[parts.length - 1].includes('.')) continue
      if (!owners.has(name)) owners.set(name, new Set())
      owners.get(name)!.add(file)
    }
  }
  const out = new Map<string, string>()
  for (const [name, set] of owners) if (set.size === 1) out.set(name, [...set][0])
  // 完整路径总是认，哪怕它恰好也是另一个文件的尾段（`a.md` 与 `docs/a.md`）
  for (const file of files) out.set(file, file)
  return out
}

/** 名字两头不能还连着路径里的字符：`mutate.ts` 不能从 `xmutate.ts`、`mutate.tsx`、`a/mutate.ts` 里认出来。 */
const PATH_CHAR = /[A-Za-z0-9_\-/.]/
function bounded(text: string, at: number, len: number): boolean {
  if (at > 0 && PATH_CHAR.test(text[at - 1])) return false
  const next = text[at + len]
  if (next === undefined) return true
  if (next === '.') return !/[A-Za-z0-9_]/.test(text[at + len + 1] ?? '')
  return !PATH_CHAR.test(next)
}

/** 一段正文点了哪些文件（按 `pathNames` 认），去重、按路径排好。 */
export function namedFiles(text: string, names: Map<string, string>): string[] {
  const hit = new Set<string>()
  for (const [name, file] of names) {
    if (hit.has(file)) continue
    for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
      if (bounded(text, at, name.length)) { hit.add(file); break }
    }
  }
  return [...hit].sort()
}

/**
 * 已关上的那几张：`⚠️ 已还／已重挂／收尾：ADR-N 第 M 行` 指到的「记录 + 行号」，键写成 `ADR-N:M`。
 * 围栏与 HTML 注释里的不算 —— ADR-167 第五节自己就在围栏里演示了这几种写法。
 */
export const CLOSING = /⚠️\s*\*{0,2}(已还|已重挂|收尾)\*{0,2}\s*[：:]\s*ADR-(\d+)\s*第\s*(\d+)\s*行/g
export function closedKeys(docs: Map<string, string>): Set<string> {
  const out = new Set<string>()
  for (const text of docs.values()) {
    const lines = text.split('\n'), quoted = quotedMask(text)
    lines.forEach((line, i) => {
      if (quoted[i]) return
      for (const m of line.matchAll(CLOSING)) out.add(`ADR-${Number(m[2])}:${Number(m[3])}`)
    })
  }
  return out
}

/** 条目所在的那条记录的编号键：`docs/adr/ADR-86-….md` 第 118 行 → `ADR-86:118`；不是编号记录的文件交回 null。 */
export function entryKey(e: Entry): string | null {
  const m = /(?:^|\/)ADR-(\d+)-[^/]*$/.exec(e.file)
  return m ? `ADR-${Number(m[1])}:${e.line}` : null
}

export interface Hit {
  entry: Entry
  /** 这条欠条点了名、这次又改到了的文件 */
  files: string[]
}

export interface TouchReport {
  /** 开着的、点到了改到的文件的 */
  hits: Hit[]
  /** 也点到了，但已有已还／已重挂／收尾行指着它的条数 —— 不列，只报数 */
  closed: number
  /** 这次改到了几个文件 */
  changed: number
}

/**
 * 每条欠条拿来找名字的正文：条目在某个 `⚠️ 欠条` 块里时是整个块（块头写缺什么、条件写什么时候回来，
 * 两处都可能点文件），否则就是条目那一行。块里被遮住的行（围栏示例）不算。
 */
export function entryTexts(docs: Map<string, string>): Array<{ entry: Entry; text: string }> {
  const out: Array<{ entry: Entry; text: string }> = []
  for (const [file, text] of docs) {
    const lines = text.split('\n'), quoted = quotedMask(text)
    const blocks = iouBlocks(lines, quoted)
    for (const entry of entries(new Map([[file, text]]))) {
      const i = entry.line - 1
      const block = blocks.find(b => b.start <= i && i < b.end)
      out.push({ entry, text: block
        ? lines.slice(block.start, block.end).filter((_, k) => !quoted[block.start + k]).join('\n')
        : lines[i] })
    }
  }
  return out
}

/**
 * 判定本身：`docs` 是决策记录（`adrDocs` 读进来的那一批），`files` 是仓库里认得的文件（受控文件加上这次删掉的），
 * `changed` 是这次改到的文件。
 */
export function touchReport(docs: Map<string, string>, files: string[], changed: string[]): TouchReport {
  const names = pathNames([...files, ...changed])
  const touched = new Set(changed)
  const closed = closedKeys(docs)
  const hits: Hit[] = []
  let closedHits = 0
  for (const { entry, text } of entryTexts(docs)) {
    const both = namedFiles(text, names).filter(f => touched.has(f))
    if (!both.length) continue
    const key = entryKey(entry)
    if (key !== null && closed.has(key)) { closedHits++; continue }
    hits.push({ entry, files: both })
  }
  return { hits, closed: closedHits, changed: touched.size }
}

/** 正文太长时截到这么多个字，后面接「…」；全文在条目所在的那一行与它的块里。 */
export const TEXT_LIMIT = 160
const clip = (s: string) => [...s].length > TEXT_LIMIT ? [...s].slice(0, TEXT_LIMIT).join('') + '…' : s

/** 漏网情形：认不出的那一类，每次都说。 */
export const BLIND_SPOT =
  '只认欠条正文里逐字写着的文件路径；只写了模块名、代码标识符、需求编号或「某类改动」的欠条这里提醒不到，仍要读台账（npm run adr-ledger）判'

/** 汇总那一行 —— 也是 CI 通知里那一句。 */
export function touchSummary(r: TouchReport): string {
  const tail = r.closed ? `（另有 ${r.closed} 条点到了、已标已还／已重挂／收尾，不列）` : ''
  return r.hits.length
    ? `欠条点名提醒：改到的 ${r.changed} 个文件被 ${r.hits.length} 条开着的欠条点了名${tail} —— 只提醒，不拦合入；响没响逐条读条件判`
    : `欠条点名提醒：改到的 ${r.changed} 个文件没有被开着的欠条点名${tail}`
}

/** 全文：每条一行（位置、写法、点到的文件、截短的正文），空一行，汇总，漏网情形。 */
export function touchLines(r: TouchReport): string[] {
  return [
    ...r.hits.map(h => `${h.entry.file}:${h.entry.line}  [${h.entry.notation}]  点名：${h.files.join('、')}  —— ${clip(h.entry.text)}`),
    ...(r.hits.length ? [''] : []),
    `  ${touchSummary(r)}`,
    `  ${BLIND_SPOT}`,
  ]
}
