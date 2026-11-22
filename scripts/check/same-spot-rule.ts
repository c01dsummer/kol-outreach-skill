/**
 * 同一处连着两轮被评审挑中就拦住合入（ADR-225，`process/6-INTEGRATE.md`「同一处连着两轮被挑出毛病」）。
 *
 * 这里只放判定，全是纯函数；取数（GitHub 的评审意见、git 的提交链与那时候的文件）在 `same-spot.ts`。
 *
 * 判法（ADR-225 第二节）：
 * - 一轮 = 评审意见锚着的同一个版本；回复不算意见。同步主干的合并（第二个父提交在主干上）、空提交（树与第一个父提交相同）
 *   不起轮，锚在它们上面的意见算进它下面最近那个起轮的版本。没有意见的版本不算一轮，「连着」跳过它们。
 * - 每条意见换算成「地方」：代码文件 = 包住那几行的顶层声明（类里是 `类名.成员`），顶层的调用语句取第一个字符串参数；
 *   Markdown = 最近一个标题；其余文件、文件级意见、锚在基线那一侧的意见 = 整份文件（和这份文件里任何地方都算同一处）。
 * - 连着的两轮有同一处 → 拦。Markdown 只列出、不拦（`DOCS_BLOCK`，需求所有者定的，ADR-225 第二节）。
 * - 解除：决策记录里「同一处连着两轮：改设计」那张表点了这一处、写了旧做法最后一轮的提交 —— 那个提交和它之前的轮次对这一处不再算，
 *   之后又连着两轮落回来就再拦。
 *
 * 找不准的一律往多报那边偏：认不出的语句算一整块「顶层」、认不出的文件算整份。
 */
import { createRequire } from 'node:module'
import type * as Ts from 'typescript'

import { cellsOf } from './adr-fact-table.js'
import { quotedMask } from './quoted.js'

/** Markdown 文件里连着两轮的同一处只列出、不拦：需求所有者 2026-11-19 定的（ADR-225 第二节） */
export const DOCS_BLOCK = false

/** 整份文件：和这份文件里任何地方都算同一处 */
export const WHOLE_FILE = '（整份文件）'

/** 一条评审意见里判定要用的几样，字段名照 GitHub REST `pulls/{n}/comments` 的原名 */
export interface ReviewComment {
  id: number
  path: string
  original_commit_id: string
  original_line: number | null
  original_start_line: number | null
  side: string | null
  subject_type: string | null
  in_reply_to_id: number | null
  created_at: string
  html_url: string
}

/** PR 头沿第一个父提交往回走到主干为止的一个提交：`parents[0]` 是第一个父 */
export interface ChainCommit {
  sha: string
  parents: string[]
  /** 树与第一个父提交的树相同 */
  empty: boolean
}

/**
 * PR 头沿第一个父提交往回走，到主干上的提交（或没有父提交）为止。`parentsOf` 答一个提交的全部父提交（第一个父在前），
 * `treeOf` 答它的树，`onMain` 答它在不在主干上
 */
export function chainFrom(head: string, parentsOf: (sha: string) => string[], treeOf: (sha: string) => string,
  onMain: (sha: string) => boolean): ChainCommit[] {
  const chain: ChainCommit[] = []
  for (let sha: string | undefined = head; sha !== undefined && !onMain(sha);) {
    const parents = parentsOf(sha)
    chain.push({ sha, parents, empty: parents.length > 0 && treeOf(sha) === treeOf(parents[0]) })
    sha = parents[0]
  }
  return chain
}

/** 一个提交号（可以是前缀）在链上的位置，最旧的是 0；不在链上、或前缀对得上不止一个，给 undefined */
export function positionIn(chain: readonly ChainCommit[], sha: string): number | undefined {
  const found = chain.flatMap((c, k) => c.sha.startsWith(sha) ? [k] : [])
  return found.length === 1 ? chain.length - 1 - found[0] : undefined
}

/** 一处地方：文件路径 + 名字；名字是 `WHOLE_FILE` 时与这份文件的任何名字都算同一处 */
export interface Spot { path: string; name: string }

export const CODE_FILE_RE = /\.(?:[cm]?[jt]s|tsx|jsx)$/
export const DOC_FILE_RE = /\.md$/

let ts: typeof Ts
function loadCompiler(): void {
  if (ts === undefined) ts = createRequire(import.meta.url)('typescript') as typeof Ts
}

/** 第 `a` 到第 `b` 行（从 1 数）落在代码文件的哪几处顶层声明上 */
export function codeSpots(path: string, text: string, a: number, b: number): string[] {
  loadCompiler()
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const lineOf = (pos: number) => file.getLineAndCharacterOfPosition(pos).line + 1
  const hit = ([lo, hi]: Span) => lo <= b && hi >= a
  // 把一串相邻节点切成一段段连续的行，不漏不叠：每个节点从上一个占到的最后一行的下一行起（所以前面的注释与空行归它），
  // 到它自己结尾那一行；结尾后面同一行起头的注释（行尾注释，跨几行的也算）归它，由编译器的 getTrailingCommentRanges 量出，
  // 不自己数换行。同一行挤着两个节点时，后一个从它自己那一行起，那一行两个都算。`last` 是行尾注释最多延到哪一行
  // （类成员不越过类的右花括号那一行），节点自己的行不受它限
  const spans = (nodes: readonly Ts.Node[], from: number, last = Infinity): [Ts.Node, Span][] => {
    let next = from
    return nodes.map(n => {
      const tail = ts.getTrailingCommentRanges(text, n.getEnd())
      const own = lineOf(n.getEnd())
      const end = Math.max(own, Math.min(last, lineOf(tail?.length ? tail[tail.length - 1].end : n.getEnd())))
      const span: Span = [Math.min(next, lineOf(n.getStart(file))), end]
      next = end + 1
      return [n, span]
    })
  }
  const pick = {
    // 类成员从类的左花括号下一行切起；类名那一行、右花括号那一行不归哪个成员（成员自己写在那一行上的除外）
    members: (c: Ts.ClassDeclaration) => spans(c.members, lineOf(c.members.pos) + 1, lineOf(c.getEnd()) - 1).filter(([, sp]) => hit(sp)).map(([m]) => m as Ts.ClassElement),
    own: (n: Ts.Node) => hit([lineOf(n.getStart(file)), lineOf(n.getEnd())]),
  }
  const names: string[] = []
  for (const [s, span] of spans(file.statements, 1)) if (hit(span)) names.push(...statementNames(s as Ts.Statement, file, pick))
  if (names.length === 0) names.push('（文件末尾）')
  return [...new Set(names)]
}

type Span = [number, number]
interface Pickers { members: (c: Ts.ClassDeclaration) => Ts.ClassElement[]; own: (n: Ts.Node) => boolean }

function statementNames(s: Ts.Statement, file: Ts.SourceFile, pick: Pickers): string[] {
  const named = s as { name?: Ts.Node }
  if (ts.isClassDeclaration(s) && s.name) {
    const inner = pick.members(s).map(m => `${s.name!.text}.${m.name ? m.name.getText(file) : '（构造或索引）'}`)
    return inner.length ? inner : [s.name.text]
  }
  if ((ts.isFunctionDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)
    || ts.isEnumDeclaration(s) || ts.isModuleDeclaration(s)) && named.name) return [named.name.getText(file)]
  if (ts.isVariableStatement(s)) {
    // 落在语句前面的注释上、没落到哪个名字的，整条语句的名字都算
    const all = s.declarationList.declarations, hit = all.filter(pick.own)
    return (hit.length ? hit : all).map(d => d.name.getText(file))
  }
  if (ts.isExpressionStatement(s)) {
    // `await group('…', …)`、`void f('…')`、带括号的，剥到里面那个调用再看
    let e: Ts.Expression = s.expression
    while (ts.isAwaitExpression(e) || ts.isVoidExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression
    const first = ts.isCallExpression(e) ? e.arguments[0] : undefined
    if (first && ts.isCallExpression(e) && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
      return [`${e.expression.getText(file)}('${first.text}')`]
    }
  }
  if (ts.isImportDeclaration(s) || ts.isImportEqualsDeclaration(s)) return ['（导入）']
  return ['（顶层其余语句）']
}

/** 第 `a` 到第 `b` 行落在 Markdown 的哪几节：最近一个标题（引文里的不算）；第一个标题之前算「文首」 */
export function docSpots(text: string, a: number, b: number): string[] {
  const lines = text.split('\n')
  const mask = quotedMask(text)
  let current = '（文首）'
  const names = new Set<string>()
  for (let i = 0; i < lines.length && i < b; i++) {
    if (!mask[i] && /^#{1,6} /.test(lines[i])) current = lines[i].trim()
    if (i + 1 >= a) names.add(current)
  }
  if (names.size === 0) names.add(current)
  return [...names]
}

/**
 * 一条意见落在哪几处。`fileAt` 给出那个版本上那份文件的内容，取不到给 null（算整份文件）。
 * 文件级意见、锚在基线一侧（`side` 是 LEFT）的意见、没有行号的，都算整份文件
 */
export function spotsOf(c: ReviewComment, fileAt: (sha: string, path: string) => string | null): Spot[] {
  const whole = [{ path: c.path, name: WHOLE_FILE }]
  if (c.subject_type === 'file' || c.side === 'LEFT' || c.original_line == null) return whole
  if (!CODE_FILE_RE.test(c.path) && !DOC_FILE_RE.test(c.path)) return whole
  const text = fileAt(c.original_commit_id, c.path)
  if (text === null) return whole
  const a = c.original_start_line ?? c.original_line, b = c.original_line
  const names = CODE_FILE_RE.test(c.path) ? codeSpots(c.path, text, a, b) : docSpots(text, a, b)
  return names.map(name => ({ path: c.path, name }))
}

export const sameSpot = (x: Spot, y: Spot): boolean =>
  x.path === y.path && (x.name === y.name || x.name === WHOLE_FILE || y.name === WHOLE_FILE)

export const spotText = (s: Spot): string => `${s.path}#${s.name}`

/** 一轮：起轮的版本、它在链上的位置（越大越新）、这一轮的意见与各自落的地方 */
export interface Round { head: string; at: number; items: Array<{ comment: ReviewComment; spots: Spot[] }> }

/**
 * 把意见分轮。`chain` 从 PR 头往回排（第 0 个是头），只含主干以外的提交；`onMain` 答一个提交在不在主干上。
 * 锚在链外（被强推掉）的版本单独成一轮，按它最早一条意见的时间插进链上各轮之间
 */
export function roundsOf(
  chain: readonly ChainCommit[], onMain: (sha: string) => boolean,
  comments: readonly ReviewComment[], spots: (c: ReviewComment) => Spot[],
): Round[] {
  // 链上每个提交归到哪个起轮的版本：不起轮的归到它第一个父提交的那一轮（从旧往新算）
  const owner = new Map<string, string>()
  const position = new Map<string, number>()
  for (let k = chain.length - 1; k >= 0; k--) {
    const c = chain[k]
    position.set(c.sha, chain.length - 1 - k)
    const syncMerge = c.parents.length > 1 && c.parents.slice(1).every(onMain)
    const folds = syncMerge || c.empty
    owner.set(c.sha, folds ? (owner.get(c.parents[0]) ?? c.sha) : c.sha)
  }
  const rounds = new Map<string, Round>()
  for (const c of comments) {
    if (c.in_reply_to_id != null) continue
    const head = owner.get(c.original_commit_id) ?? c.original_commit_id
    const r = rounds.get(head) ?? { head, at: position.get(head) ?? Number.NaN, items: [] }
    r.items.push({ comment: c, spots: spots(c) })
    rounds.set(head, r)
  }
  const first = (r: Round) => r.items.map(i => i.comment.created_at).sort()[0]
  const onChain = [...rounds.values()].filter(r => !Number.isNaN(r.at)).sort((x, y) => x.at - y.at)
  const off = [...rounds.values()].filter(r => Number.isNaN(r.at)).sort((x, y) => first(x) < first(y) ? -1 : 1)
  // 链外的一轮插在最早意见不晚于它的最后一个链上轮次之后，位置取两者之间
  for (const r of off) {
    const before = onChain.filter(o => first(o) <= first(r))
    const lo = before.length ? before.at(-1)!.at : -1
    const next = onChain.find(o => o.at > lo)
    r.at = next ? (lo + next.at) / 2 : lo + 0.5
    onChain.push(r)
    onChain.sort((x, y) => x.at - y.at)
  }
  return onChain
}

/** 解除表里的一行：这一处、旧做法最后一轮的提交（这一轮和之前的对这一处不再算） */
export interface Waiver { spot: Spot; after: string; where: string }

export const WAIVER_HEADING_RE = /^## (?:[一二三四五六七八九十]+、)?同一处连着两轮：改设计\s*$/
export const WAIVER_TABLE_HEAD = '| 同一处 | 旧做法最后一轮的提交 | 新做法写在哪 |'
const DIVIDER_RE = /^\|(?:\s*:?-+:?\s*\|){3}\s*$/
const SPOT_CELL_RE = /^`([^`#]+)#([^`]+)`$/
const SHA_RE = /^[0-9a-f]{7,40}$/

/** 从一份决策记录里读解除表；格式不对的报出来（解除表认不出就不算解除） */
export function waiversOf(file: string, text: string): { waivers: Waiver[]; faults: string[] } {
  const lines = text.split('\n')
  const mask = quotedMask(text)
  const waivers: Waiver[] = [], faults: string[] = []
  for (let h = 0; h < lines.length; h++) {
    if (mask[h] || !WAIVER_HEADING_RE.test(lines[h])) continue
    let i = h + 1
    while (i < lines.length && !lines[i].trim()) i++
    if (lines[i]?.trim() !== WAIVER_TABLE_HEAD || !DIVIDER_RE.test(lines[i + 1]?.trim() ?? '')) {
      faults.push(`${file} 第 ${h + 1} 行的「同一处连着两轮：改设计」下面要紧跟表头 \`${WAIVER_TABLE_HEAD}\` 和分隔行`)
      continue
    }
    for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
      const cells = cellsOf(lines[i])
      const spot = SPOT_CELL_RE.exec(cells[0] ?? '')
      if (cells.length !== 3 || !spot || !SHA_RE.test(cells[1]) || !cells[2]) {
        faults.push(`${file} 第 ${i + 1} 行：解除表一行要写成 \`| \`路径#名字\` | 提交号 | 新做法写在哪 |\``)
        continue
      }
      waivers.push({ spot: { path: spot[1], name: spot[2] }, after: cells[1], where: `${file} 第 ${i + 1} 行` })
    }
  }
  return { waivers, faults }
}

/**
 * 哪几份决策记录里的解除表算数：只算这条 PR 加了或改了的（与分叉点上同名文件内容不同、或那里没有）。
 * 已经合进主干的解除表管的是那条旧 PR，提交不在新 PR 的链上，算进来会让以后每条 PR 都红
 */
export function changedRecords<T extends { text: string; base: string | null }>(files: readonly T[]): T[] {
  return files.filter(f => f.text !== f.base)
}

/**
 * 一份决策记录里这条 PR 新写的解除行：主干上已有的行（同一处、同一个提交）是那条旧 PR 的，提交不在新 PR 的链上，
 * 不算这条 PR 的解除，也不报「不在历史上」—— 否则往一份带解除表的老记录末尾补一句「已还」，这条 PR 就红（ADR-232）。
 * 主干上那份的格式毛病同理只算旧账，只报新写出来的
 */
export function newWaiversOf(file: string, text: string, base: string | null): { waivers: Waiver[]; faults: string[] } {
  const now = waiversOf(file, text)
  if (base === null) return now
  const old = waiversOf(file, base)
  const key = (w: Waiver) => `${w.spot.path}#${w.spot.name}@${w.after}`
  const had = new Set(old.waivers.map(key))
  const oldFaults = new Set(old.faults.map(f => f.replace(/第 \d+ 行/, '')))
  return {
    waivers: now.waivers.filter(w => !had.has(key(w))),
    faults: now.faults.filter(f => !oldFaults.has(f.replace(/第 \d+ 行/, ''))),
  }
}

/** 连着两轮落在同一处的一对 */
export interface Hit { spot: Spot; earlier: Round; later: Round; blocks: boolean }

/**
 * 找出连着两轮的同一处，去掉解除表管到的。`positionOf` 答一个提交号（可以是前缀）在链上的位置，不在链上给 undefined；
 * 解除表写的提交不在链上，那一行不算解除，报出来
 */
export function hitsOf(rounds: readonly Round[], waivers: readonly Waiver[], positionOf: (sha: string) => number | undefined):
  { hits: Hit[]; faults: string[] } {
  const faults: string[] = []
  const live: Array<{ w: Waiver; at: number }> = []
  for (const w of waivers) {
    const at = positionOf(w.after)
    if (at === undefined) faults.push(`${w.where}：提交 ${w.after} 不在这条 PR 的历史上，这一行解除不算`)
    else live.push({ w, at })
  }
  // 解除按报出来的那一处、一字不差地比：解除了别处，不放走「整份文件」意见与这一处配出的那一对
  const waived = (s: Spot, r: Round) => live.some(({ w, at }) => w.spot.path === s.path && w.spot.name === s.name && r.at <= at)
  const hits: Hit[] = []
  for (let k = 0; k + 1 < rounds.length; k++) {
    const earlier = rounds[k], later = rounds[k + 1]
    const seen = new Set<string>()
    for (const x of later.items.flatMap(i => i.spots)) {
      for (const y of earlier.items.flatMap(i => i.spots)) {
        if (!sameSpot(x, y)) continue
        const spot = x.name === WHOLE_FILE ? y : x
        if (waived(spot, earlier)) continue
        const key = spotText(spot)
        if (seen.has(key)) continue
        seen.add(key)
        hits.push({ spot, earlier, later, blocks: DOCS_BLOCK || !DOC_FILE_RE.test(spot.path) })
      }
    }
  }
  return { hits, faults }
}
