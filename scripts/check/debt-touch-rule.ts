/**
 * 欠条点名提醒的**判定** —— 一条改动改到的文件里，哪些被还开着的欠条写进了正文。
 *
 * **只提醒，不判响没响。** 点了名不等于条件成立（条件常是「碰 X 的 PR，或某片开工」这种析取），
 * 没点名也不等于没响（ADR-86 第二节那三处实测：符号名不出现在自己的 diff 里、历史上漏报过一次）。
 * 这里只做一件机械的事：欠条正文里逐字写着的文件路径，和这次改到的文件取交，交出那几条让人去读。
 * 需求所有者 2026-11-14 要的就是这一件，为什么这一回不违背 ADR-86 第三节记在 ADR-196。
 *
 * 和 ADR-86 撤掉的那一版的分界：**不解析词，不维护符号索引。** 认得的名字只有一种来源 ——
 * 仓库里受控文件的路径本身（`pathNames`），所以没有一张会漂的手写表；代码标识符、需求编号、
 * 「某模块」「某类改动」这种写法一律认不出，那部分仍靠人读台账。
 *
 * 条目来自 `debt-rule.ts` 的 `entries`，块的定界来自它的 `iouBlocks`，状态行来自它的 `statusLines` —— 不另抽一份，
 * 免得两边对「哪些是欠条」「哪张已经关上」说两样。这里只用状态行不列已关的那些；续挂不关，照旧提醒。
 */
import { CLOSED_KINDS, blockAt, entries, entryKey, iouBlocks, iouName, nameKey, splitRecords, statusLines, type Entry } from './debt-rule.js'

export { entryKey, nameKey }
import { quotedMask } from './quoted.js'

/** git 的一次调用：参数进、标准输出出，失败就抛。入口给真的 git，测试给假的。 */
export type GitRun = (...args: string[]) => string

/** `-z` 的输出按 NUL 切开；末尾那个 NUL 后面的空段不算一个文件。 */
const nulList = (out: string) => out.split('\0').filter(Boolean)

/**
 * 「改到的文件」看得见哪些 —— 扫描范围也是判定（`docs/CONVENTIONS.md` 第 10 条）：
 * 与 `base` 比到**工作区**为止，不写 head，所以本地没提交的改动也算；`--no-renames` 让改名记成
 * 删旧加新，点了旧路径的欠条照样被认出；`-z` 按 NUL 切，路径里有空格或中文也不被引号包起来。
 */
export function changedFiles(git: GitRun, base: string): string[] {
  return nulList(git('diff', '--name-only', '--no-renames', '-z', base))
}

/** 认得的名字从哪来：受控文件（`git ls-files`）。没 `git add` 的新文件不在里面。 */
export function trackedFiles(git: GitRun): string[] {
  return nulList(git('ls-files', '-z'))
}

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
 * 已关上的那几张的键：已还、已重挂、收尾三种状态行指着的（`debt-rule.ts` 的 `statusLines`，两种指法都认）。
 * 续挂不算关上 —— 条件响了、这次还不了，那张照旧开着。
 */
export function closedKeys(docs: Map<string, string>): Set<string> {
  return new Set(statusLines(docs).filter(s => CLOSED_KINDS.has(s.kind)).map(s => s.key))
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
export function entryTexts(docs: Map<string, string>): Array<{ entry: Entry; text: string; name: string | null }> {
  const out: Array<{ entry: Entry; text: string; name: string | null }> = []
  for (const [file, text] of docs) {
    const lines = text.split('\n'), quoted = quotedMask(text)
    const blocks = iouBlocks(lines, quoted)
    for (const entry of entries(new Map([[file, text]]))) {
      const i = entry.line - 1
      // 取起点最靠后的那个块（`blockAt` 写着为什么）
      const block = blockAt(blocks, i)
      out.push({ entry, text: block
        ? lines.slice(block.start, block.end).filter((_, k) => !quoted[block.start + k]).join('\n')
        : lines[i], name: block ? iouName(lines[block.start]) : null })
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
  const split = splitRecords(docs)
  const hits: Hit[] = []
  let closedHits = 0
  for (const { entry, text, name } of entryTexts(docs)) {
    const both = namedFiles(text, names).filter(f => touched.has(f))
    if (!both.length) continue
    const keys = [entryKey(entry, split), nameKey(entry.file, name)]
    if (keys.some(k => k !== null && closed.has(k))) { closedHits++; continue }
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
    : `欠条点名提醒：改到的 ${r.changed} 个文件没有被开着的欠条点名${tail} —— 只认逐字写着的文件路径，没写路径的欠条仍要读台账判`
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
