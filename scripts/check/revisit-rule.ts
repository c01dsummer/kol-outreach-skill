/**
 * 周回访 (b) 那几步的判定：一张欠条哪天登记的、按什么名字认，到期清单列哪几张，这一周轮到哪几条死亡条件。
 *
 * 这些原先是 `docs/REVISIT.md` 里手写的一段 shell，没有测试守着，评审一轮挑一个新问题
 * （块边界和孤儿闸门不是同一份、几张旧欠条重挂到同一个名字只认第一张、条件拆后改过旧行号丢了……）。
 * 挪到这里，由需求测试在玩具 git 仓库上直接调；入口 `revisit-due.ts` 只剩读参数与打印。
 *
 * 只读，不写任何文件。git 由调用方传进来（`Git`），测试与入口用同一份判定。
 */
import { basename } from 'node:path'
import { cellsOf } from './adr-fact-table.js'
import { CONDITION, IOU_NAME, entries, entryKey, isHistory, iouBlocks, iouName, blockAt, ledgerStatus, nameKey, recordNum, splitRecords, statusLines, type Row } from './debt-rule.js'
import { gitText } from './git-entry.js'
import { quotedMask } from './quoted.js'

/** 判定要问 git 的三件事。答不上来（文件不在、行号越界）给 undefined，判定按「取不到」办 */
export interface Git {
  /** 这个路径在 `rev` 的第一亲代链上第一次被加进来的那次提交（`log --first-parent --diff-filter=A` 最早一条） */
  firstAdded(rev: string, path: string): string | undefined
  /** `rev:path` 的全文 */
  show(rev: string, path: string): string | undefined
  /** `rev` 上 `path` 第 `line` 行最后被改的那次提交与它的提交时间（秒），按第一亲代链 */
  blame(rev: string, path: string, line: number): { commit: string; time: number } | undefined
}

/** 用命令行 git 答那三件事；`cwd` 是仓库目录。入口与需求测试用的都是这一份 */
export function cliGit(cwd = '.', env: NodeJS.ProcessEnv = process.env): Git {
  // 经 git 入口问（ADR-220）：它带的固定几项里除了中文路径不转义，还有改名检测开着 —— git 2.9 起这本来就是缺省值，钉住了不随机器配置变
  const git = (...a: string[]): string | undefined => gitText(a, { cwd, env }) ?? undefined
  return {
    firstAdded: (rev, path) => git('log', '--first-parent', '--diff-filter=A', '--format=%H', rev, '--', path)?.split('\n').filter(Boolean).at(-1),
    show: (rev, path) => git('show', `${rev}:${path}`),
    blame: (rev, path, line) => {
      const out = git('blame', '--first-parent', '--porcelain', '-L', `${line},${line}`, rev, '--', path)
      const time = out === undefined ? undefined : /^committer-time (\d+)$/m.exec(out)?.[1]
      return out === undefined || time === undefined ? undefined : { commit: out.split(' ')[0], time: Number(time) }
    },
  }
}

/** 第 `line` 行（从 1 数）所在那张欠条的短名字；不在欠条块里、块头没有短名字都给空串。块怎么定界就是孤儿闸门那一份 */
export function iouNameAt(text: string, line: number): string {
  const lines = text.split('\n')
  const i = line - 1
  const block = iouBlocks(lines, quotedMask(text)).filter(b => b.start <= i && i < b.end).at(-1)
  return block ? IOU_NAME.exec(lines[block.start])?.[1] ?? '' : ''
}

/** 记录编号前缀，如 `ADR-151`；文件名不以它开头给空串 */
export function adrId(file: string): string {
  return /^ADR-\d+/.exec(basename(file))?.[0] ?? ''
}

const HISTORY_DIR = 'docs/adr/历史/'

/** 同 `wc -l`：数换行，末尾没有换行的那一行不算 */
function lineCount(text: string): number {
  let n = 0
  for (const ch of text) if (ch === '\n') n++
  return n
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 历史文件里指到这张的一行「已重挂」：老写法按旧行号（`已重挂：<编号> 第 <行> 行`），老欠条本来有名字的按旧名字（`已重挂：<编号>「<旧名字>」`） */
export type Rehung = { line: number } | { name: string }

/** 历史文件里「已重挂：… · …现行的是 <编号>「<名字>」」那几行，两种写法都认，按出现先后（ADR-211 第一节） */
export function rehungLines(history: string, id: string, name: string): Rehung[] {
  const tail = ` · .*现行的是 ${escapeRe(id)}「${escapeRe(name)}」`
  const byLine = new RegExp(`已重挂：${escapeRe(id)} 第 (\\d+) 行${tail}`)
  const byName = new RegExp(`已重挂：${escapeRe(id)}「([^」\\n]*)」${tail}`)
  const out: Rehung[] = []
  for (const l of history.split('\n')) {
    const m = byLine.exec(l), n = byName.exec(l)
    if (m) out.push({ line: Number(m[1]) })
    else if (n) out.push({ name: n[1] })
  }
  return out
}

/** `text` 里名字是 `name` 的那张欠条，条件那一行（从 1 数）：块里第一行带「重启条件：」的，同台账抽的那一行；没有这张、或块里没条件，给 undefined */
export function conditionLineOf(text: string, name: string): number | undefined {
  const lines = text.split('\n'), quoted = quotedMask(text)
  const b = iouBlocks(lines, quoted).find(b => IOU_NAME.exec(lines[b.start])?.[1] === name)
  if (b) for (let i = b.start; i < b.end; i++) if (!quoted[i] && CONDITION.test(lines[i])) return i + 1
  return undefined
}

/**
 * 一张欠条的登记日（提交时间，秒）与拆之前它在原文里的旧身份（旧行号、旧名字）。
 *
 * - 登记日 = 条件那一行最后一次在主干上被改的提交时间。
 * - 拆过的记录（ADR-211）：拆的那次提交把原文整份挪进历史文件、开着的欠条重写进主文件，两处 blame 都只给得出拆的那天。
 *   历史文件里拆前那一段与原文逐行相同，取原文同一行；主文件里拆时重写、之后条件没再改过的那张
 *   （这一行最后改在拆的那次提交上），取历史文件里指过来的第一行「已重挂」在原文里的那一行：
 *   按旧行号的就是那一行，按旧名字的是原文里那张同名欠条的条件行。
 * - 旧身份只要名字对得上就全给，不管条件拆后改没改过：「列过」按名字认，旧身份与名字是同一个口径。
 */
export function bornOf(git: Git, run: string, file: string, line: number, name: string): { time?: number; oldLines: number[]; oldNames: string[] } {
  const id = adrId(file)
  const main = `docs/adr/${basename(file)}`
  const history = `${HISTORY_DIR}${basename(file)}`
  const split = git.firstAdded(run, history)
  let src = run, path = file, at: number | undefined = line, olds: Rehung[] = []
  if (split && file === history) {
    const original = git.show(`${split}^`, main)
    if (original !== undefined && line <= lineCount(original)) { src = `${split}^`; path = main }
  } else if (split && name) {
    olds = rehungLines(git.show(run, history) ?? '', id, name)
    if (olds.length && git.blame(run, file, line)?.commit === split) {
      src = `${split}^`; path = main
      const first = olds[0]
      at = 'line' in first ? first.line : conditionLineOf(git.show(src, main) ?? '', first.name)
    }
  }
  return {
    time: at === undefined ? undefined : git.blame(src, path, at)?.time,
    oldLines: olds.flatMap(o => 'line' in o ? [o.line] : []),
    oldNames: olds.flatMap(o => 'name' in o ? [o.name] : []),
  }
}

/** 北京时间的日期 `YYYY-MM-DD` */
export function beijingDate(time: number): string {
  return new Date((time + 8 * 3600) * 1000).toISOString().slice(0, 10)
}

/**
 * 回访里几张欠条的先后：有登记日的在前、从早到晚；同一天按记录编号的数比（ADR-80 在 ADR-120 前）；
 * 再按记法的 UTF-8 字节比，只为次序固定。取不到登记日的排最后 —— 它们不该被当成「最老的」先起草
 */
export function rowCompare(a: { date?: string; key: string }, b: { date?: string; key: string }): number {
  if ((a.date === undefined) !== (b.date === undefined)) return a.date === undefined ? 1 : -1
  if (a.date !== b.date) return a.date! < b.date! ? -1 : 1
  const na = Number(/^ADR-(\d+)/.exec(a.key)?.[1] ?? 0), nb = Number(/^ADR-(\d+)/.exec(b.key)?.[1] ?? 0)
  if (na !== nb) return na - nb
  return Buffer.compare(Buffer.from(a.key), Buffer.from(b.key))
}

/** 按「、」切开，书名号里的「、」是名字的一部分、不切 */
function splitItems(cell: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of cell) {
    if (ch === '、' && depth === 0) { out.push(cur); cur = ''; continue }
    if (ch === '「') depth++
    else if (ch === '」' && depth > 0) depth--
    cur += ch
  }
  out.push(cur)
  return out
}

export interface DueRow { date?: string; key: string; aliases: string[] }

/** 一张欠条在回访里怎么记、哪天登记、拆前叫什么（旧行号、旧名字都算它的别名）：有短名字按 `<编号>「<名字>」`，没有按 `<编号> 第 <行> 行` */
export function dueRow(git: Git, run: string, file: string, line: number, text: string): DueRow {
  const id = adrId(file), name = iouNameAt(text, line)
  const { time, oldLines, oldNames } = bornOf(git, run, file, line, name)
  return {
    date: time === undefined ? undefined : beijingDate(time),
    key: name ? `${id}「${name}」` : `${id} 第 ${line} 行`,
    aliases: [...oldLines.map(n => `${id} 第 ${n} 行`), ...oldNames.map(n => `${id}「${n}」`)],
  }
}

/** 两道门判「过」的那几张按登记日排：`<日期> <编号> 第 <行> 行`，次序同 `rowCompare`；取不到登记日的日期栏空着、排最后 */
export function bornReport(git: Git, run: string, rows: Array<{ file: string; line: number; text: string }>): string[] {
  return rows.map(r => {
    const { time } = bornOf(git, run, r.file, r.line, iouNameAt(r.text, r.line))
    return { date: time === undefined ? undefined : beijingDate(time), key: `${adrId(r.file)} 第 ${r.line} 行` }
  }).sort(rowCompare).map(r => `${r.date ?? ''} ${r.key}`)
}

/* ───────────── 到期清单（ADR-167「到期清单」那一片） ─────────────
 * 登记满 28 天算到期，每次最多列 10 张，最老的先列 —— 两个数是需求所有者 2026-11-22 批的（ADR-167 第三节）。
 * 「列过」只认 ADR-152 候选表里的行（读过、没进候选的不算：那些没有列给需求所有者）；他在「人判」栏回的
 * 只认三个词：还、收尾、留。别的（空着、旧的接受／拒绝）都算没判，下周照列、不换一批。
 */

/** 登记满几天算到期（需求所有者 2026-11-22 批） */
export const DUE_DAYS = 28
/** 每次最多列几张（同上） */
export const DUE_LIMIT = 10
/** 人判栏算「判了」的三个词 */
export const VERDICTS: ReadonlySet<string> = new Set(['还', '收尾', '留'])

/** 一项最近一次列给需求所有者：那一行的 id 里的日期，与人判栏原样的字 */
export interface Listing {
  day: string
  verdict: string
  /** 取的那一次在 ADR-152 里是第几行（从 0 数）：名字与别名同一天各列过一次时，后写的那一行为准 */
  at: number
  /** 这一项哪一次列出判过「留」（不只看最近一次：判过留、续挂行没落下、四周后再列没判的，仍要标续挂过） */
  kept: boolean
}

/**
 * ADR-152 候选表里每一项最近一次列出。候选行认第一格是 `YYYY-MM-DD#N` 的表行（回访每块的 id 写法），
 * 第二格按书名号外的「、」切开（书名号里的「、」不切），最后一格是人判栏。同一项列过几次取日期最晚的那一次，
 * 同一天的取后写的那一行（名字与别名之间也是，见 `at`）。日子不成立的 id 不算。哪一次判过「留」都记下（`kept`）。
 */
export function listings(adr152: string): Map<string, Listing> {
  const out = new Map<string, Listing>()
  for (const [at, l] of adr152.split('\n').entries()) {
    if (!l.startsWith('|')) continue
    const cells = cellsOf(l)
    const day = /^(\d{4}-\d{2}-\d{2})#\d+$/.exec(cells[0] ?? '')?.[1]
    if (day === undefined || cells.length < 3) continue
    // 日子不成立的不算：2026-13-01 算不出到期，整份清单会打不出来；2026-02-30 会被当成 3 月 2 日，往返对不上也跳过
    const ms = Date.parse(`${day}T00:00:00Z`)
    if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) continue
    const verdict = cells.at(-1)!
    for (const item of splitItems(cells[1])) {
      const key = item.replace(/^ +| +$/g, '')
      const old = out.get(key)
      const kept = (old?.kept ?? false) || verdict.trim() === '留'
      out.set(key, !old || old.day <= day ? { day, verdict, kept, at } : { ...old, kept })
    }
  }
  return out
}

/** 一张开着的欠条在到期清单里要的几样 */
export interface DueItem {
  /** 回访里怎么记（`dueRow` 那种） */
  key: string
  /** 列过时可能用的别的记法：拆前的旧行号、旧名字，整张改挂过来之前那几张的记法 */
  aliases: string[]
  /** 登记日（北京时间）；整张改挂过来的，取最早那一张的；取不到给 undefined */
  date?: string
  /** 续挂写的那天里最晚的一天；没续挂过给 undefined */
  until?: string
  /** 自己或改挂过来之前那几张续挂过（有续挂行就算，不管写没写到哪天） */
  carried: boolean
}

/** `YYYY-MM-DD` 加 `n` 天 */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)
}

const later = (a: string | undefined, b: string | undefined): string | undefined => a === undefined ? b : b === undefined ? a : a < b ? b : a

/**
 * 到期清单：交回要列的几行（最多 `limit` 行）与三个数。
 *
 * 每一张先看它最近一次列出（名字、别名哪个列过都算）：
 * - 列过、人判栏没写还／收尾／留：**列过没判**，不管到没到期，排在最前面，下周照列、不换一批；
 * - 其余的算一个到期日，到了（≤ `today`）才列：
 *   - 起点是登记日加 `days` 天；
 *   - 续挂过的，取续挂写的那天（续挂把到期推到那一天，到了那天仍开着就重新到期 —— ADR-167 历史文件第 213 行那条更正）；
 *   - 列过、判了的，判的那一块的日期再加 `days` 天之前不再列（判了还／收尾等下一条欠条 PR 落状态行，判了留等续挂行；
 *     四周过去还开着，说明没落下来，照样再列）；
 *   - 几种都有的取最晚的那一天。
 * - 取不到登记日、也没续挂过、没列过的：不列，只数（不能当成最老的先列）。
 *
 * 次序：列过没判的在前，其余在后；两段各按登记日从早到晚（`rowCompare`）。
 * 续挂过（自己或改挂过来之前那几张）、或哪一次列出判过留的，行尾标「续挂过，只能还或收尾」（「留」只许一次，ADR-167 第三节）。
 */
export function dueList(items: DueItem[], today: string, listed: Map<string, Listing>, days = DUE_DAYS, limit = DUE_LIMIT): {
  lines: string[] // 字段不入断言：到期清单那一组按全文比这几行
  again: number // 字段不入断言：同上，数在第一行里
  due: number // 字段不入断言：同上
  undated: number // 字段不入断言：同上
} {
  type Pick = { date?: string; key: string; tag: string }
  const again: Pick[] = [], due: Pick[] = []
  let undated = 0
  for (const it of items) {
    const ls = [it.key, ...it.aliases].map(k => listed.get(k)).filter((l): l is Listing => l !== undefined)
    const last = ls.reduce<Listing | undefined>((a, b) => a === undefined || a.day < b.day || (a.day === b.day && a.at <= b.at) ? b : a, undefined)
    const judged = last !== undefined && VERDICTS.has(last.verdict.trim())
    const second = it.until !== undefined || it.carried || ls.some(l => l.kept)
    const tag = second ? ' · 续挂过，只能还或收尾' : ''
    if (last !== undefined && !judged) { again.push({ date: it.date, key: it.key, tag: ' · 列过没判' + tag }); continue }
    const on = [it.date === undefined ? undefined : addDays(it.date, days), it.until, judged ? addDays(last!.day, days) : undefined]
      .reduce(later, undefined)
    if (on === undefined) { undated++; continue }
    if (on <= today) due.push({ date: it.date, key: it.key, tag })
  }
  const line = (p: Pick) => `${p.date ?? ''} ${p.key}${p.tag}`
  const picked = [...again.sort(rowCompare), ...due.sort(rowCompare)].slice(0, limit)
  return {
    lines: [`到期 ${due.length} 张、列过没判 ${again.length} 张、取不到登记日 ${undated} 张；这次列 ${picked.length} 张（最多 ${limit} 张）`, ...picked.map(line)],
    again: again.length, due: due.length, undated,
  }
}

/**
 * 状态行里「现行的是」后面指的那一张，按台账的键（`nameKey` / `entryKey` 那种）交回。认三种写法：
 * 「ADR-N「名字」」「ADR-N 第 M 行」，和「本条第 M 行」—— 本条就是这一行所在的那条记录（`self`，不给就不认这一种）。
 * 别的写法（「那一行」「本条下一张」「本块下面第一张」、只在散文里说「余额由 … 承接」）不猜，给 null。
 */
export function currentOf(text: string, self?: number | null): string | null {
  const m = /现行的是\s*(?:ADR-(\d+)\s*(?:「([^」\n]+)」|第\s*(\d+)\s*行)|本条第\s*(\d+)\s*行)/.exec(text)
  if (!m) return null
  if (m[4] !== undefined) return self == null ? null : `ADR-${self}:${Number(m[4])}`
  return m[2] !== undefined ? `ADR-${Number(m[1])}「${m[2].trim()}」` : `ADR-${Number(m[1])}:${Number(m[3])}`
}

/**
 * 状态行在哪，补记那一行照这个写法点名原来那行：`ADR-N 第 M 行`；拆过的记录分 `主文件`、`历史文件`。
 * 历史文件里的那行，拆之前写下的补记只写了 `ADR-N 第 M 行`（拆的时候原文逐行原样进历史文件，行号不变），也认；
 * 主文件里的不认不带「主文件」的写法：主文件是重写过的，同一个行号指的不是原来那行。
 */
const placesOf = (file: string, line: number, split: ReadonlySet<number>): string[] => {
  const n = recordNum(file)
  if (isHistory(file)) return [`ADR-${n} 历史文件第 ${line} 行`, `ADR-${n} 第 ${line} 行`]
  return [`ADR-${n}${n !== null && split.has(n) ? ' 主文件' : ' '}第 ${line} 行`]
}

/**
 * 已重挂行里有几行认不出现行的是哪一张（`currentOf` 给 null 的）：这几张的接手者到期清单接不回原来的登记日，按自己的算。
 * 旧行不许改，补的办法是别处追加一行指同一张旧欠条、认得出的已重挂，写明「补记接手者：照 <原来那行在哪>那一行原文认定」（ADR-167）；
 * 补过的那行不数。只认点名了原来那行的补记：同一张旧欠条另挂给别的接手者的那种，不算补了这一行。
 */
export function movesUnread(docs: Map<string, string>): number {
  const split = splitRecords(docs)
  const moves = statusLines(docs).filter(s => s.kind === '已重挂')
  const read = moves.filter(s => currentOf(s.text, recordNum(s.file)) !== null)
  return moves.filter(s => currentOf(s.text, recordNum(s.file)) === null
    && !read.some(o => o.key === s.key && placesOf(s.file, s.line, split).some(p => o.text.includes(`补记接手者：照 ${p}那一行原文认定`)))).length
}

/** 台账键换成回访里的记法：`ADR-9:5` → `ADR-9 第 5 行`，按名字的原样 */
const listingKey = (k: string): string => k.replace(/^(ADR-\d+):(\d+)$/, '$1 第 $2 行')

const UNTIL = /到\s*(\d{4}-\d{2}-\d{2})/

/**
 * 台账里开着的每张欠条（只有续挂行的也算开着）在到期清单里要的几样。
 *
 * 整张改挂过来的（别处一行「已重挂：<旧的> · …现行的是 <这一张>」）：登记日取旧的那几张里最早的，旧的那几张的记法当别名，
 * 旧的续挂过就标上（`process/6-INTEGRATE.md`「登记怎么做」第 5 条：改挂不清零）。旧的又是从更早那张改挂过来的，一路往回找。
 * 拆过的记录在同一份记录里的旧身份照旧由 `dueRow` 认（ADR-211）。
 */
export function dueItems(git: Git, run: string, docs: Map<string, string>): DueItem[] {
  const ledger = ledgerStatus(docs)
  const split = splitRecords(docs)
  const all = statusLines(docs)
  const keysOf = (r: Row): string[] => {
    const text = docs.get(r.entry.file) ?? ''
    const lines = text.split('\n')
    const block = blockAt(iouBlocks(lines, quotedMask(text)), r.entry.line - 1)
    return [entryKey(r.entry, split), nameKey(r.entry.file, block ? iouName(lines[block.start]) : null)].filter((k): k is string => k !== null)
  }
  const restart = ledger.rows.filter(r => r.status !== null)
  const byKey = new Map<string, Row>()
  for (const r of restart) for (const k of keysOf(r)) byKey.set(k, r)
  const rows = new Map<Row, DueRow>()
  const rowOf = (r: Row): DueRow => {
    let d = rows.get(r)
    if (!d) { d = dueRow(git, run, r.entry.file, r.entry.line, docs.get(r.entry.file) ?? ''); rows.set(r, d) }
    return d
  }
  const untilOf = (keys: string[]): string | undefined => all.filter(s => s.kind === '续挂' && keys.includes(s.key))
    .map(s => UNTIL.exec(s.text)?.[1]).reduce(later, undefined)
  return restart.filter(r => r.status === '开着' || r.status === '续挂').map((r): DueItem => {
    const keys = keysOf(r)
    const own = rowOf(r)
    const aliases = [...own.aliases]
    let date = own.date, carried = all.some(x => x.kind === '续挂' && keys.includes(x.key))
    const seen = new Set<Row>([r])
    const walk = (targets: string[]): void => {
      for (const s of all) {
        if (s.kind !== '已重挂' || !targets.includes(currentOf(s.text, recordNum(s.file)) ?? '')) continue
        const src = byKey.get(s.key)
        if (!src || seen.has(src)) continue
        seen.add(src)
        const d = rowOf(src), srcKeys = keysOf(src)
        if (d.date !== undefined && (date === undefined || d.date < date)) date = d.date
        aliases.push(d.key, ...d.aliases, ...srcKeys.map(listingKey))
        if (all.some(x => x.kind === '续挂' && srcKeys.includes(x.key))) carried = true
        walk(srcKeys)
      }
    }
    walk(keys)
    return {
      key: own.key,
      aliases: [...new Set(aliases)].filter(a => a !== own.key),
      date,
      until: untilOf(keys),
      carried,
    }
  })
}

/* ───────────── 死亡条件四周轮一遍（ADR-167「周回访按到期列」那一片） ─────────────
 * 死亡条件说的是「什么时候撤掉一条规则」，没有登记日、也不会被还上，按到期清单的办法列不出来；
 * 改成按记录编号分四组，每周列一组，四周正好轮完。需求所有者 2026-11-23 定了列进候选表、由他判。
 */

/** 几周轮完一遍 */
export const ROTA_WEEKS = 4

/** 1970-01-05（星期一）起第几周：同一周的七天给同一个数 */
export function weekIndex(day: string): number {
  return Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse('1970-01-05T00:00:00Z')) / (7 * 86400_000))
}

/**
 * 这一周轮到的死亡条件：记录编号除以 `weeks` 的余数，等于这一周的序号除以 `weeks` 的余数。
 * 主文件与历史文件里的都算（台账两处都抽），只是拆的时候原样抄进主文件的那几条（从条件那一行到空行为止、去掉空白后整条相同）只列主文件那一份，
 * 不让同一句列两遍。记法同回访：`<编号> 第 <行> 行`；拆过的记录，这个记法指历史文件那一行（ADR-211），
 * 主文件里的写 `<编号> 主文件第 <行> 行`。按编号、再按行号排；同一条记录先列主文件。
 * 第一行是几个数，后面每行是记法、两个空格、条件原文。
 */
export function deathRota(docs: Map<string, string>, today: string, weeks = ROTA_WEEKS): string[] {
  const split = splitRecords(docs)
  const turn = weekIndex(today) % weeks
  const flat = (t: string) => t.replace(/\s+/g, '')
  // 整条：从条件那一行起，到空行（或只有 `>` 的行）为止 —— 第一行相同、续行不同的不算同一条
  const whole = (e: { file: string; line: number }): string => {
    const lines = (docs.get(e.file) ?? '').split('\n')
    const end = lines.findIndex((l, i) => i >= e.line && /^\s*>?\s*$/.test(l))
    return flat(lines.slice(e.line - 1, end < 0 ? undefined : end).join('\n'))
  }
  const all = entries(docs).filter(e => e.notation === '死亡条件' && recordNum(e.file) !== null)
  const inMain = new Set(all.filter(e => !isHistory(e.file)).map(e => `${recordNum(e.file)} ${whole(e)}`))
  const kept = all.filter(e => !isHistory(e.file) || !inMain.has(`${recordNum(e.file)} ${whole(e)}`))
  const picked = kept.filter(e => recordNum(e.file)! % weeks === turn).map(e => {
    const num = recordNum(e.file)!, hist = isHistory(e.file)
    return { num, hist, line: e.line, text: `${adrId(e.file)} ${!hist && split.has(num) ? '主文件' : ''}第 ${e.line} 行  ${e.text}` }
  }).sort((a, b) => a.num - b.num || Number(a.hist) - Number(b.hist) || a.line - b.line)
  return [`死亡条件 ${kept.length} 条（历史文件里与主文件整句相同的 ${all.length - kept.length} 条不重复算）；这一周轮到编号除以 ${weeks} 余 ${turn} 的 ${picked.length} 条`,
    ...picked.map(p => p.text)]
}
