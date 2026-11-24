/**
 * 周回访「周一」取原料那一段与只进 PR 正文的 (a)、(d)、(e) 三段的判定（`docs/REVISIT.md`）。
 *
 * 这些原先是说明书里手写的 shell 与「照这个口径自己算」的几段话，检查链里没有测试或变异跑
 * （ADR-151「周一那几段命令没有测试跑」）。挪到这里，由需求测试直接调；入口 `revisit-raw.ts` 只剩读参数、读文件与打印。
 *
 * - 取原料：两棵树（本跑、一周前）都从 git 对象里读 `docs/adr/`，不建工作树、不切目录，
 *   拿本跑这份代码的台账与被引表去量 —— 尺子相同，差只来自记录本身。
 * - (a)、(e) 的 GitHub 接口由例程自己取（手头有什么工具用什么），存成文件交进来；这里只算，不联网。
 *
 * 只读 git，不写任何文件（写文件是入口的事）。
 */
import { citeReport, citeTable } from './cite-rule.js'
import { iouNameFaults, ledgerReport, ledgerStatus, orphanIous } from './debt-rule.js'
import { gitText, runGit } from './git-entry.js'
import { addDays, adrId } from './revisit-rule.js'

/** 取原料要问 git 的四件事。答不上来给 undefined */
export interface RawGit {
  /** `rev` 第一亲代链上提交时间早于 `before` 的最后一个提交 */
  // 字段不入断言：问 git 的口子，取原料那几例经它真问玩具仓库、按全文比结果
  lastBefore(rev: string, before: string): string | undefined
  /** `rev` 上 `docs/adr/` 下全部 `.md`（含子目录），键是仓库里的路径 */
  adrTree(rev: string): Map<string, string> | undefined
  /** 工作区（含暂存区）里 `docs/adr/` 与 `rev` 不同的路径 */
  adrDrift(rev: string): string[] | undefined
  /** `rev:path` 的全文 */
  // 字段不入断言：问 git 的口子，条数那一例经它真问玩具仓库
  show(rev: string, path: string): string | undefined
}

/** 用命令行 git 答那四件事；`cwd` 是仓库目录。入口与需求测试用的都是这一份 */
export function cliRawGit(cwd = '.', env: NodeJS.ProcessEnv = process.env): RawGit {
  const git = (a: string[], input?: string): string | undefined => gitText(a, { cwd, env, input }) ?? undefined
  return {
    lastBefore: (rev, before) => git(['rev-list', '-1', '--first-parent', '--before', before, rev])?.trim() || undefined,
    adrTree: rev => {
      const names = git(['ls-tree', '-r', '-z', '--name-only', rev, '--', 'docs/adr'])
      if (names === undefined) return undefined
      const paths = names.split('\0').filter(p => p.endsWith('.md'))
      const out = new Map<string, string>()
      if (paths.length === 0) return out
      // 一次读完：`cat-file --batch` 按行吃 `<提交>:<路径>`，逐个交回「头一行 + 正文 + 换行」，读字节数切
      const r = runGit(['cat-file', '--batch'], { cwd, env, input: paths.map(p => `${rev}:${p}\n`).join('') })
      if (r.error !== undefined || r.status !== 0) return undefined
      let at = 0
      for (const p of paths) {
        const nl = r.stdout.indexOf(0x0a, at)
        const head = r.stdout.subarray(at, nl).toString('utf8').split(' ')
        if (nl < 0 || head[1] !== 'blob') return undefined
        const size = Number(head[2])
        out.set(p, r.stdout.subarray(nl + 1, nl + 1 + size).toString('utf8'))
        at = nl + 1 + size + 1
      }
      return out
    },
    adrDrift: rev => {
      const out = git(['diff', '--name-only', '--no-renames', '-z', rev])
      return out === undefined ? undefined : out.split('\0').filter(p => p.startsWith('docs/adr/'))
    },
    show: (rev, path) => git(['show', `${rev}:${path}`]),
  }
}

/** 台账全表（同 `adr-ledger.ts` 不带参数时打的，孤儿那一句不算在里面） */
export const ledgerText = (docs: Map<string, string>): string =>
  ledgerReport(ledgerStatus(docs), orphanIous(docs), iouNameFaults(docs)).out.map(l => `${l}\n`).join('')
/** 被引表全表（同 `adr-ledger.ts --cites`） */
export const citesText = (docs: Map<string, string>): string => citeReport(citeTable(docs)).map(l => `${l}\n`).join('')

/** 只比 `docs/adr/` 开头的行、去掉行号，按多重集合求差：`from` 里没有、`to` 里多出来的那些行（各自在 `to` 里的原样） */
export function ledgerDiff(from: string, to: string): string[] {
  const key = (l: string) => l.replace(/:[0-9]+ {2}/, '  ')
  const left = new Map<string, number>()
  for (const l of from.split('\n')) if (l.startsWith('docs/adr/')) left.set(key(l), (left.get(key(l)) ?? 0) + 1)
  const out: string[] = []
  for (const l of to.split('\n')) {
    if (!l.startsWith('docs/adr/')) continue
    const n = left.get(key(l)) ?? 0
    if (n > 0) left.set(key(l), n - 1); else out.push(l)
  }
  return out
}

/** 取原料写下的六份全文 */
export interface RawFiles {
  新台账: string // 字段不入断言：取原料那一例核末尾汇总那一行
  旧台账: string // 字段不入断言：同上
  新被引表: string // 字段不入断言：同上
  旧被引表: string // 字段不入断言：同上
  新增: string // 字段不入断言：取原料那一例按行核；M-H245-a、b、c 改的是求差
  消失: string // 字段不入断言：同上
}

/** 取原料的结果：几份文件的全文、齐没齐、一周前那棵树 */
export interface Raw {
  files: RawFiles // 字段不入断言：六份由取原料那几例逐份核，入口那一例核写出的文件名
  /** 不齐的原因，齐了是空的 */
  faults: string[] // 字段不入断言：取原料那几例按全文比；M-H245-e、f 改的是往里放的那两处
  old?: string // 字段不入断言：取原料那一例按提交号全文比；M-H245-d 改的是取它的那一问
}

const SUMMARY = /^ {2}(欠条台账|被引表) [0-9]+ 条/

/**
 * 取原料：一周前那棵树是 `<日期>` 往前 7 天那天北京时间 00:00 之前 `run` 第一亲代链上最后一个提交。
 * 两棵树都从 git 对象里读，拿同一份代码量。几样不齐就交回为什么：一周前那棵树取不到、哪棵树读不出、
 * 哪份没打到末尾汇总、工作区的 `docs/adr/` 与 `run` 不同（后面几步读工作区、问 git 读 `run`，两边不是同一棵树行号就对不上）。
 */
export function gatherRaw(git: RawGit, run: string, day: string): Raw {
  const faults: string[] = []
  // git 的 --before 连那一秒本身也算进去；提交时刻只到秒，取前一天 23:59:59 就是「00:00 之前」
  const old = git.lastBefore(run, `${addDays(day, -8)} 23:59:59 +0800`)
  if (old === undefined) faults.push(`取不到一周前那棵树（${addDays(day, -7)} 北京时间 00:00 之前主干上没有提交）`)
  const now = git.adrTree(run)
  if (now === undefined) faults.push(`读不出本跑那棵树（${run}）的 docs/adr/`)
  const then = old === undefined ? undefined : git.adrTree(old)
  if (old !== undefined && then === undefined) faults.push(`读不出一周前那棵树（${old.slice(0, 7)}）的 docs/adr/`)
  const empty = new Map<string, string>()
  const 新台账 = ledgerText(now ?? empty), 旧台账 = ledgerText(then ?? empty)
  const 新被引表 = citesText(now ?? empty), 旧被引表 = citesText(then ?? empty)
  for (const [name, text] of [['新台账', 新台账], ['旧台账', 旧台账], ['新被引表', 新被引表], ['旧被引表', 旧被引表]] as const) {
    if (!SUMMARY.test(text.trimEnd().split('\n').at(-1) ?? '')) faults.push(`${name}没打到末尾那一行汇总`)
  }
  const drift = git.adrDrift(run)
  if (drift === undefined) faults.push('问不出工作区的 docs/adr/ 与本跑那棵树有没有不同')
  else if (drift.length > 0) faults.push(`工作区的 docs/adr/ 与本跑那棵树不同：${drift.slice(0, 3).join('、')}${drift.length > 3 ? ` 等 ${drift.length} 个` : ''}`)
  const lines = (xs: string[]) => xs.map(l => `${l}\n`).join('')
  return {
    files: { 新台账, 旧台账, 新被引表, 旧被引表, 新增: lines(ledgerDiff(旧台账, 新台账)), 消失: lines(ledgerDiff(新台账, 旧台账)) },
    faults,
    old,
  }
}

/** 取原料打的那一行：齐了说一周前那棵树与增减几行，不齐说为什么 */
export function rawLine(raw: Raw): string {
  if (raw.faults.length > 0) return `原料不齐：${raw.faults.join('；')}`
  const n = (s: string) => s.split('\n').filter(Boolean).length
  return `原料齐了：一周前 ${raw.old?.slice(0, 7)} · 新增 ${n(raw.files.新增)} 行、消失 ${n(raw.files.消失)} 行`
}

/** 被引表一行：记录编号与被引次数 */
const CITE_ROW = /^(docs\/adr\/\S+?\.md) {2}被引 ([0-9]+) /
const citeRows = (text: string): Array<{ id: string; cited: number }> => text.split('\n').flatMap(l => {
  const m = CITE_ROW.exec(l)
  return m === null ? [] : [{ id: adrId(m[1]), cited: Number(m[2]) }]
})
/** `docs/adr/` 开头却认不出是被引表一行的行数：被引表的样子改了，前十就不可信 */
const strayRows = (text: string): number => text.split('\n').filter(l => l.startsWith('docs/adr/') && !CITE_ROW.test(l)).length

/**
 * (d) 被引表前十：两份各取前 10 行，写进了前十的与掉出前十的（编号与「一周前 → 本跑」的被引次数，
 * 那一边没有这条记录写「没有这条」），再抄两边末尾那一行汇总。`docs/adr/` 开头却认不出的行不悄悄跳过，多打一行说有几行。
 */
export function topTen(oldCites: string, newCites: string): string[] {
  const before = citeRows(oldCites), after = citeRows(newCites)
  const count = (rows: Array<{ id: string; cited: number }>, id: string) => {
    const r = rows.find(x => x.id === id)
    return r === undefined ? '没有这条' : String(r.cited)
  }
  const topB = before.slice(0, 10).map(r => r.id), topA = after.slice(0, 10).map(r => r.id)
  const fmt = (ids: string[]) => ids.length === 0 ? '没有' : ids.map(id => `${id}（${count(before, id)} → ${count(after, id)}）`).join('、')
  const tail = (t: string) => t.trimEnd().split('\n').at(-1)?.trim() ?? ''
  const stray = [strayRows(oldCites), strayRows(newCites)]
  return [
    `进了前十：${fmt(topA.filter(id => !topB.includes(id)))}`,
    `掉出前十：${fmt(topB.filter(id => !topA.includes(id)))}`,
    `一周前汇总：${tail(oldCites)}`,
    `本跑汇总：${tail(newCites)}`,
    ...(stray[0] + stray[1] === 0 ? [] : [`无从确认：认不出是被引表一行的有 一周前 ${stray[0]} 行、本跑 ${stray[1]} 行，前十可能不准`]),
  ]
}

/** 接口交回的一跑里用得上的几样 */
export interface ApiRun {
  id: number // 字段不入断言：接口原样的字段，不是算出来的；核形状那几例逐样钉住缺哪样、哪样不对
  head_sha: string // 字段不入断言：同上
  created_at: string // 字段不入断言：同上
  run_started_at: string // 字段不入断言：同上
  updated_at: string // 字段不入断言：同上
}

/** 读接口返回的结果：核过形状的跑（从新到旧）与接口说的一共几跑，或不收的原因 */
export type RunsRead =
  | {
    runs: ApiRun[] // 字段不入断言：读接口返回那一例按 id 全文比；M-H245-o、p 改的是去重与排序
    /** 页上的 `total_count`（几页取最大的）；直接交一组跑就没有 */
    total?: number // 字段不入断言：读接口返回那一例按全文比；M-H245-ao 改的是取它的那一处
  }
  | {
    fault: string // 字段不入断言：核形状那一例五种情形按全文比
  }

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** 交进来的跑该是哪一种：哪份 workflow 文件、什么事件触发、什么结论（不写就不核） */
export interface RunsWant {
  path: string // 字段不入断言：核形状那一例按全文比；M-H245-ap 改的是比它的那一处
  event?: string // 字段不入断言：同上；M-H245-aq
  conclusion?: string // 字段不入断言：同上；M-H245-ar
}
/** (a) 要的：`check.yml` 在主干上 push 触发的成功跑 */
export const CHECK_RUNS: RunsWant = { path: '.github/workflows/check.yml', event: 'push', conclusion: 'success' }
/** (e) 要的：`never-red.yml` 在主干上跑完了的（红了的也要，整跑那几份红是要报的） */
export const NEVER_RED_RUNS: RunsWant = { path: '.github/workflows/never-red.yml' }

/**
 * 读例程存下来的接口返回：一页（`{ workflow_runs: [...] }`）、几页排成的数组、或直接一组跑都认。
 * 整份先核形状：每一跑那几样都得在、类型对、时刻读得出，还得是 `want` 说的那一种（主干上、跑完了、那份 workflow、那种事件与结论），
 * 有一跑不对就整份不收，交回第几跑哪一样不对 —— 取错了接口（别的 workflow、别的分支、没过滤结论）不会悄悄算进去。
 */
export function parseRuns(text: string, want: RunsWant): RunsRead {
  let data: unknown
  try { data = JSON.parse(text) } catch (e) { return { fault: `不是 JSON：${(e as Error).message}` } }
  const pages = Array.isArray(data) && data.every(isObject) && data.every(p => 'workflow_runs' in p) ? data : [data]
  const runs: unknown[] = []
  for (const p of pages) {
    const list = Array.isArray(p) ? p : isObject(p) && Array.isArray(p.workflow_runs) ? p.workflow_runs : undefined
    if (list === undefined) return { fault: '既不是一页接口返回（带 workflow_runs），也不是一组跑' }
    runs.push(...list)
  }
  const totals = pages.flatMap(p => isObject(p) && typeof p.total_count === 'number' ? [p.total_count] : [])
  for (const [i, r] of runs.entries()) {
    if (!isObject(r)) return { fault: `第 ${i + 1} 跑不是对象` }
    if (typeof r.id !== 'number') return { fault: `第 ${i + 1} 跑缺 id` }
    if (typeof r.head_sha !== 'string' || !/^[0-9a-f]{7,40}$/.test(r.head_sha)) return { fault: `第 ${i + 1} 跑（${r.id}）的 head_sha 不对` }
    for (const k of ['created_at', 'run_started_at', 'updated_at'] as const) {
      if (typeof r[k] !== 'string' || Number.isNaN(Date.parse(r[k] as string))) return { fault: `第 ${i + 1} 跑（${r.id}）的 ${k} 读不出时刻` }
    }
    const expect: Array<[string, string | undefined]> = [['head_branch', 'main'], ['status', 'completed'], ['path', want.path], ['event', want.event], ['conclusion', want.conclusion]]
    for (const [k, v] of expect) {
      if (v !== undefined && r[k] !== v) return { fault: `第 ${i + 1} 跑（${r.id}）的 ${k} 是 ${JSON.stringify(r[k])}，要的是 ${v}` }
    }
  }
  // 同一跑在两页里都出现（翻页时主干上又多了一跑）只算一次
  const byId = new Map<number, ApiRun>()
  for (const r of runs as ApiRun[]) byId.set(r.id, r)
  const sorted = [...byId.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  return totals.length === 0 ? { runs: sorted } : { runs: sorted, total: Math.max(...totals) }
}

/** `<日期>` 那天北京时间 00:00 的毫秒数 */
export const beijingMidnight = (day: string): number => Date.parse(`${day}T00:00:00+08:00`)
/** 一跑的时长（秒）：`run_started_at → updated_at` */
export const runSeconds = (r: ApiRun): number => Math.round((Date.parse(r.updated_at) - Date.parse(r.run_started_at)) / 1000)
/** 同 CI 上那一行：`分:秒`，秒补足两位 */
export const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const round2 = (x: number): number => Math.round(x * 100) / 100

/** 变异条数：那个提交上 `mutations` 是数组就数它，不是数组、读不出都算取不到 */
export function catalogCount(git: RawGit, sha: string): number | undefined {
  const text = git.show(sha, 'scripts/check/mutations.json')
  if (text === undefined) return undefined
  try {
    const data: unknown = JSON.parse(text)
    return isObject(data) && Array.isArray(data.mutations) ? data.mutations.length : undefined
  } catch { return undefined }
}

/** 比值线：四舍五入到两位以后跟它比 */
export const SLOW_RATIO = 1.3

/**
 * (a) 主干上偏慢的几跑：`runs` 是 `check.yml` 在主干上 push 触发的成功跑（从新到旧），要往窗口起点之前多取至少 5 跑。
 * 窗口是 `<日期>` 往前 7 天那天 00:00（含）到 `<日期>` 00:00（不含），北京时间。窗口里每一跑与比它早的 5 跑的中位（排序后第 3 个）比，
 * 四舍五入两位后 ≥ 1.30 的列出来；比它早的不足 5 跑写无从确认 —— 交进来的比接口说的 `total` 少，多半是没翻完，多打一行叫再取一页。
 * 再写一行工作量。
 */
export function slowRuns(runs: readonly ApiRun[], day: string, count: (sha: string) => number | undefined, total?: number): string[] {
  const end = beijingMidnight(day), start = beijingMidnight(addDays(day, -7))
  const at = (r: ApiRun) => Date.parse(r.created_at)
  const window = runs.filter(r => at(r) >= start && at(r) < end)
  const out = [`窗口里 ${window.length} 跑`]
  const slow: string[] = []
  for (const r of window) {
    const prev = runs.filter(x => at(x) < at(r)).slice(0, 5)
    const head = `run ${r.id} · ${r.head_sha.slice(0, 7)}`
    if (prev.length < 5) { slow.push(`${head} · 无从确认：前面不足 5 次`); continue }
    const median = prev.map(runSeconds).sort((a, b) => a - b)[2]
    const mine = runSeconds(r)
    if (median <= 0) { slow.push(`${head} · 无从确认：前 5 次的中位是 ${median} 秒`); continue }
    const ratio = round2(mine / median)
    if (ratio >= SLOW_RATIO) slow.push(`${head} · 本跑 ${mmss(mine)} · 主干前 5 次中位 ${mmss(median)} · ×${ratio.toFixed(2)}`)
  }
  out.push(...(slow.length === 0 ? ['比值 ≥ 1.30 的：没有'] : ['比值 ≥ 1.30 的：', ...slow.map(s => `- ${s}`)]))
  if (slow.some(s => s.endsWith('前面不足 5 次')) && total !== undefined && runs.length < total) {
    out.push(`前面不足 5 次的可能是没取够：交进来 ${runs.length} 跑，接口说一共 ${total} 跑，再取下一页`)
  }
  out.push(workload(runs, window, start, count))
  return out
}

/** 工作量那一行：窗口里最晚那一跑的变异条数、比窗口前最后一跑多几条、窗口里每一跑的秒数摊到每条上的中位 */
function workload(runs: readonly ApiRun[], window: readonly ApiRun[], start: number, count: (sha: string) => number | undefined): string {
  if (window.length === 0) return '工作量：没有'
  const n = count(window[0].head_sha)
  const before = runs.find(r => Date.parse(r.created_at) < start)
  let head: string
  if (n === undefined) head = `变异 无从确认：窗口里最晚那一跑（${window[0].head_sha.slice(0, 7)}）上取不到条数（比窗口前 无从确认：同上）`
  else {
    const m = before === undefined ? undefined : count(before.head_sha)
    const d = m === undefined ? `无从确认：${before === undefined ? '交进来的跑里没有窗口起点之前的' : `窗口前那一跑（${before.head_sha.slice(0, 7)}）上取不到条数`}`
      : n === m ? '±0' : n > m ? `+${n - m}` : `-${m - n}`
    head = `变异 ${n} 条（比窗口前 ${d}）`
  }
  const per = window.flatMap(r => { const c = count(r.head_sha); return c === undefined || c === 0 ? [] : [runSeconds(r) / c] }).sort((a, b) => a - b)
  const lost = window.length - per.length
  const lostText = lost === 0 ? '' : `，少了 ${lost} 跑：提交上取不到条数或条数为 0`
  if (per.length === 0) return `工作量：${head} · 摊到每条的秒数中位 无从确认：每一跑的提交上都取不到条数或条数为 0`
  const k = per.length
  const mid = k % 2 === 1 ? per[(k - 1) / 2] : (per[k / 2 - 1] + per[k / 2]) / 2
  return `工作量：${head} · 摊到每条的秒数中位 ${round2(mid).toFixed(2)}（${k} 跑${lostText}）`
}

/**
 * (e) 挑「本周那一跑」与「上一跑」：`runs` 是 `never-red.yml` 在主干上跑完了的（从新到旧）。
 * 本周那一跑是创建在 `<日期>` 往前 7 天那天 00:00（含，北京时间）到 `now` 之间最晚的一跑；上一跑是比它早的最晚一跑。
 */
export interface NeverRedPick {
  this?: ApiRun // 字段不入断言：挑跑那一例三种情形按全文比；M-H245-ab 改的是挑法
  prev?: ApiRun // 字段不入断言：同上
  fault?: string // 字段不入断言：同上
}

export function pickNeverRed(runs: readonly ApiRun[], day: string, now: number): NeverRedPick {
  const start = beijingMidnight(addDays(day, -7))
  const at = (r: ApiRun) => Date.parse(r.created_at)
  const mine = runs.find(r => at(r) >= start && at(r) <= now)
  if (mine === undefined) return { fault: '窗口里没有跑完的一跑' }
  const prev = runs.find(r => at(r) < at(mine))
  return prev === undefined ? { this: mine, fault: '交进来的跑里没有比本周那一跑更早的（接口还有下一页就再取）' } : { this: mine, prev }
}

/** 日志里那一行：`never-red.ts` 打的 `NEVER_RED_JSON <JSON>`，GitHub 的日志每行前面带一个时刻 */
export interface NeverRed {
  head: string // 字段不入断言：日志里那一行原样的数，读日志与打行那几例按全文比
  earlyStop: boolean // 字段不入断言：同上；M-H245-af 改的是读到以后怎么办
  verifiers: Record<string, NeverRedCounts> // 字段不入断言：同上
}
/** 一个验证者的三个数 */
export interface NeverRedCounts {
  catalog: number // 字段不入断言：日志里那一行原样的数，打行那一例按全文比
  notReached: number // 字段不入断言：同上
  neverRed: number // 字段不入断言：同上；M-H245-ah 改的是相减以后的正负号
}
/** 读日志的结果：那一行，或不收的原因 */
export type NeverRedRead =
  | {
    data: NeverRed // 字段不入断言：读日志那一例按全文比
  }
  | {
    fault: string // 字段不入断言：读日志那一例七种情形按全文比
  }

/** 从一份 job 日志里读出 `NEVER_RED_JSON` 那一行。没有、不止一行、形状不对都交回为什么 */
export function readNeverRed(log: string): NeverRedRead {
  const hits = log.split('\n').map(l => l.replace(/\r$/, '').replace(/^\S*Z /, '')).filter(l => l.startsWith('NEVER_RED_JSON '))
  if (hits.length === 0) return { fault: '日志里没有 NEVER_RED_JSON 那一行' }
  if (hits.length > 1) return { fault: `日志里 NEVER_RED_JSON 有 ${hits.length} 行` }
  let d: unknown
  try { d = JSON.parse(hits[0].slice('NEVER_RED_JSON '.length)) } catch (e) { return { fault: `NEVER_RED_JSON 那一行不是 JSON：${(e as Error).message}` } }
  if (!isObject(d) || d.schema !== 'never-red/v1') return { fault: 'NEVER_RED_JSON 那一行不是 never-red/v1' }
  if (typeof d.head !== 'string' || typeof d.earlyStop !== 'boolean' || !isObject(d.verifiers)) return { fault: 'NEVER_RED_JSON 那一行缺 head、earlyStop 或 verifiers' }
  for (const [by, v] of Object.entries(d.verifiers)) {
    if (!isObject(v) || !['catalog', 'notReached', 'neverRed'].every(k => Number.isInteger(v[k]) && (v[k] as number) >= 0)) {
      return { fault: `NEVER_RED_JSON 里 ${by} 那一份的数不对` }
    }
  }
  return { data: d as unknown as NeverRed }
}

/** 整跑那几份 job 的名字（`never-red.yml` 里 `不提前停的整跑（第 k/3 份）`）与结论 */
export interface ApiJob {
  run_id: number // 字段不入断言：接口原样的字段；jobs 那一例核它与 --run-id 给的是同一跑
  name: string // 字段不入断言：接口原样的字段；jobs 那一例核形状，打行那一例按名字与结论挑红的份
  conclusion: string | null // 字段不入断言：同上
}
/** 读 jobs 接口返回的结果 */
export type JobsRead =
  | {
    jobs: ApiJob[] // 字段不入断言：jobs 那一例按条数比，打行那一例用它
  }
  | {
    fault: string // 字段不入断言：jobs 那一例四种情形按全文比
  }

/** 读例程存下来的 `/actions/runs/<id>/jobs` 返回（一页，带 `jobs`），整份先核形状；每个 job 都得是 `runId` 那一跑的（取错一跑的 jobs 不悄悄算） */
export function parseJobs(text: string, runId: number): JobsRead {
  let d: unknown
  try { d = JSON.parse(text) } catch (e) { return { fault: `不是 JSON：${(e as Error).message}` } }
  if (!isObject(d) || !Array.isArray(d.jobs)) return { fault: '不是一页 jobs 接口返回（带 jobs）' }
  for (const [i, j] of d.jobs.entries()) {
    if (!isObject(j) || typeof j.name !== 'string' || !(typeof j.conclusion === 'string' || j.conclusion === null)) return { fault: `第 ${i + 1} 个 job 缺 name 或 conclusion` }
    if (j.run_id !== runId) return { fault: `第 ${i + 1} 个 job 的 run_id 是 ${JSON.stringify(j.run_id)}，不是 ${runId} 那一跑的` }
  }
  return { jobs: d.jobs as ApiJob[] }
}

/**
 * (e) 从没红过的断言：本周那一跑的 run id 与它验的提交；`earlyStop` 是 true 就整段无从确认；
 * 每个验证者一行清册、从没红过、没有负片跑到，接「比上一跑」；整跑那几份 job 有红的（结论 failure），列出第几份。
 */
export function neverRedLines(runId: number, mine: NeverRedRead, prev: NeverRedRead, jobs: readonly ApiJob[]): string[] {
  if ('fault' in mine) return [`无从确认：${mine.fault}`]
  const d = mine.data
  if (d.earlyStop) return [`run ${runId} · ${d.head.slice(0, 7)} · 无从确认：那一跑没关提前停`]
  const out = [`run ${runId} · ${d.head.slice(0, 7)}`]
  for (const by of ['test', 'selfcheck']) {
    const v = d.verifiers[by]
    if (v === undefined) { out.push(`${by}：无从确认：那一行里没有这个验证者`); continue }
    const p = 'fault' in prev ? undefined : prev.data.verifiers[by]
    const diff = 'fault' in prev ? `比上一跑：无从确认：${prev.fault}` : p === undefined ? '比上一跑：无从确认：上一跑里没有这个验证者'
      : `比上一跑 ${v.neverRed === p.neverRed ? '±0' : v.neverRed > p.neverRed ? `+${v.neverRed - p.neverRed}` : `-${p.neverRed - v.neverRed}`}`
    out.push(`${by}：清册 ${v.catalog} 条，从没红过 ${v.neverRed} 条（没有负片跑到 ${v.notReached} 条），${diff}`)
  }
  const red = jobs.flatMap(j => { const m = /^不提前停的整跑（第 ([0-9]+)\/[0-9]+ 份）$/.exec(j.name); return m !== null && j.conclusion === 'failure' ? [m[1]] : [] })
  if (red.length > 0) out.push(`整跑有变异没被抓到：第 ${red.join('、')} 份`)
  return out
}
