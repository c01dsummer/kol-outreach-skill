/**
 * 周回访「定期清点」那一步的判定：一张欠条哪天登记的、按什么名字认、在 ADR-152 里列过没有。
 *
 * 这些原先是 `docs/REVISIT.md` 里手写的一段 shell，没有测试守着，评审一轮挑一个新问题
 * （块边界和孤儿闸门不是同一份、几张旧欠条重挂到同一个名字只认第一张、条件拆后改过旧行号丢了……）。
 * 挪到这里，由需求测试在玩具 git 仓库上直接调；入口 `revisit-due.ts` 只剩读参数与打印。
 *
 * 只读，不写任何文件。git 由调用方传进来（`Git`），测试与入口用同一份判定。
 */
import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'
import { IOU_NAME, iouBlocks } from './debt-rule.js'
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
  const git = (...a: string[]): string | undefined => {
    try {
      return execFileSync('git', ['-c', 'core.quotePath=false', ...a],
        { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 })
    } catch { return undefined }
  }
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

/** 历史文件里「已重挂：<编号> 第 <行> 行 · …现行的是 <编号>「<名字>」」那几行的旧行号，按出现先后 */
export function rehungLines(history: string, id: string, name: string): number[] {
  const re = new RegExp(`已重挂：${escapeRe(id)} 第 (\\d+) 行 · .*现行的是 ${escapeRe(id)}「${escapeRe(name)}」`)
  const out: number[] = []
  for (const l of history.split('\n')) {
    const m = re.exec(l)
    if (m) out.push(Number(m[1]))
  }
  return out
}

/**
 * 一张欠条的登记日（提交时间，秒）与拆之前它在原文里的旧行号。
 *
 * - 登记日 = 条件那一行最后一次在主干上被改的提交时间。
 * - 拆过的记录（ADR-211）：拆的那次提交把原文整份挪进历史文件、开着的欠条重写进主文件，两处 blame 都只给得出拆的那天。
 *   历史文件里拆前那一段与原文逐行相同，取原文同一行；主文件里拆时重写、之后条件没再改过的那张
 *   （这一行最后改在拆的那次提交上），取历史文件「已重挂」指过去的原文第一行。
 * - 旧行号只要名字对得上就全给，不管条件拆后改没改过：「列过」按名字认，旧行号与名字是同一个口径。
 */
export function bornOf(git: Git, run: string, file: string, line: number, name: string): { time?: number; oldLines: number[] } {
  const id = adrId(file)
  const main = `docs/adr/${basename(file)}`
  const history = `${HISTORY_DIR}${basename(file)}`
  const split = git.firstAdded(run, history)
  let src = run, path = file, at = line, oldLines: number[] = []
  if (split && file === history) {
    const original = git.show(`${split}^`, main)
    if (original !== undefined && line <= lineCount(original)) { src = `${split}^`; path = main }
  } else if (split && name) {
    oldLines = rehungLines(git.show(run, history) ?? '', id, name)
    if (oldLines.length && git.blame(run, file, line)?.commit === split) { src = `${split}^`; at = oldLines[0] }
  }
  return { time: git.blame(src, path, at)?.time, oldLines }
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

/** ADR-152 里「列过」的每一项：候选表第二栏，与「读过、没进候选」那一行，按「、」切开、去首尾的半角空格 */
export function listedItems(adr152: string): Set<string> {
  const out = new Set<string>()
  for (const l of adr152.split('\n')) {
    const cell = l.startsWith('- 读过、没进候选：') ? l.slice('- 读过、没进候选：'.length)
      : /^\| [^|]+ \| ([^|]+) \|/.exec(l)?.[1]
    if (cell === undefined) continue
    for (const item of cell.split('、')) out.add(item.replace(/^ +| +$/g, ''))
  }
  return out
}

/** 台账里一行「重启条件」写着「定期清点」的欠条：文件与条件那一行的行号 */
export function periodicEntries(ledger: string): Array<{ file: string; line: number }> {
  const out: Array<{ file: string; line: number }> = []
  for (const l of ledger.split('\n')) {
    if (!l.startsWith('docs/adr/') || !l.includes('  [重启条件]  ') || !l.includes('定期清点')) continue
    const m = /^([^:]+):(\d+)  /.exec(l)
    if (m) out.push({ file: m[1], line: Number(m[2]) })
  }
  return out
}

export interface DueRow { date?: string; key: string; aliases: string[] }

/** 一张欠条在回访里怎么记、哪天登记、拆前叫什么：有短名字按 `<编号>「<名字>」`，没有按 `<编号> 第 <行> 行` */
export function dueRow(git: Git, run: string, file: string, line: number, text: string): DueRow {
  const id = adrId(file), name = iouNameAt(text, line)
  const { time, oldLines } = bornOf(git, run, file, line, name)
  return {
    date: time === undefined ? undefined : beijingDate(time),
    key: name ? `${id}「${name}」` : `${id} 第 ${line} 行`,
    aliases: oldLines.map(n => `${id} 第 ${n} 行`),
  }
}

/**
 * 定期清点的三个数与前 5 行：取不到登记日的条数、满四周（登记日 ≤ `cut`）的条数、其中没列过的条数，
 * 再按登记日从早到晚、同一天按编号取没列过的前 5 张。名字与任一旧行号列过一个就算列过。
 */
export function dueReport(rows: DueRow[], cut: string, listed: Set<string>): string[] {
  const line = (r: DueRow) => `${r.date ?? ''} ${r.key}`
  const known = rows.filter(r => r.date !== undefined)
  const due = known.filter(r => r.date! <= cut)
  const open = due.filter(r => ![r.key, ...r.aliases].some(k => listed.has(k))).sort(rowCompare).map(line)
  return [String(rows.length - known.length), String(due.length), String(open.length), ...open.slice(0, 5)]
}

/** 两道门判「过」的那几张按登记日排：`<日期> <编号> 第 <行> 行`，次序同 `rowCompare`；取不到登记日的日期栏空着、排最后 */
export function bornReport(git: Git, run: string, rows: Array<{ file: string; line: number; text: string }>): string[] {
  return rows.map(r => {
    const { time } = bornOf(git, run, r.file, r.line, iouNameAt(r.text, r.line))
    return { date: time === undefined ? undefined : beijingDate(time), key: `${adrId(r.file)} 第 ${r.line} 行` }
  }).sort(rowCompare).map(r => `${r.date ?? ''} ${r.key}`)
}
