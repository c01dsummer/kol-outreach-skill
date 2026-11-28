/**
 * 条件探针：决策记录里「到某个条件就该做某事」的条件，能由确切数据判定的，在这里按字面算成没成立（ADR-252）。
 *
 * 欠条台账（`debt-rule.ts`）只认人写的状态行、不判条件；周回访按日历列欠条、四周轮一遍死亡条件，也不判条件。
 * 条件早就成立了却没人看见（ADR-203 那条「连着 3 跑差过 25% 就重写秒数文件」过线十天）补的就是这一块：
 * 登记表 `CONDITIONS` 里每一行绑着台账里一条确切的条目（按 `notationOf` 的记法），用三种通用判法之一，带上这一条的参数。
 * 每周回访跑 `npm run conditions`，越线的排在候选表最前面，交需求所有者判。
 *
 * - 判法全是纯函数，输入是入口交进来的确切原料（主干第一亲代链上的提交标题、台账、树里的文件、受跟踪的路径），不读散文、不猜。
 * - 只算条件按字面成没成立，不判条件本身对不对、值不值得做；那是人判的事。
 * - 登记表的核对（绑的条目在不在、种类对不对、还开着没有）由 `adr-sync.ts` 调 `conditionFaults`，进检查链。
 *
 * 只读，不写任何文件。git 由调用方传进来（`ConditionGit`），测试与入口用同一份判定。
 */
import { ledgerStatus, splitRecords, type RowStatus } from './debt-rule.js'
import { gitText, runGit } from './git-entry.js'
import { addDays, notationOf, type Listing } from './revisit-rule.js'

/* ───────────── 登记表 ───────────── */

/** 判法与它的参数 */
export type Probe =
  /** 主干第一亲代链上有一个提交标题说 PR #`pr` 合进来了（GitHub 生成的两种定死写法） */
  | { judge: 'pr-merged'; pr: number }
  /** 台账里另一张欠条（按记法）的状态是 `status` */
  | { judge: 'ledger-status'; waits: string; status: '已还' }
  /** 树里的一个数按比较符越过线 */
  | { judge: 'tree-number'; measure: Measure; op: Op; line: number }

/** 量法 */
export type Measure =
  /** 文件的字节数 */
  | { kind: 'bytes'; path: string }
  /** 文件的行数：数换行字节，同 `wc -l` */
  | { kind: 'lines'; path: string }
  /** JSON 文件顶层一个键下数组的长度 */
  | { kind: 'json-array'; path: string; key: string }
  /** 文件在不在：在是 1，不在是 0 */
  | { kind: 'exists'; path: string }
  /** 这几个目录下（含子目录）受跟踪、以 `suffix` 结尾的文件份数，按 `git ls-files` 列出的路径数 */
  | { kind: 'tracked-suffix'; dirs: string[]; suffix: string }

export type Op = '>' | '>=' | '='

/** 登记表的一行 */
export interface Condition {
  /** 绑的台账条目，按 `notationOf` 的记法 */
 
  binds: string
  /** 它在台账里是哪一种：欠条（重启条件）或死亡条件 */
 
  kind: '欠条' | '死亡条件'
  /** 一句白话：这一行算的是什么 */
 
  name: string
 
  probe: Probe
}

/**
 * 第一批：303 条开着的条件分类时「能算」、用得上这三种判法的（ADR-252 附表）。
 * 参数填错（PR 号写错）检查链拦不住，只能靠评审对着原文看 —— 每行后面写着原文怎么说的。
 */
export const CONDITIONS: readonly Condition[] = [
  // 原文：「重启条件：PR #73 已合入」（后半句另有所等的话，越线时由人判）
  { binds: 'ADR-69 第 20 行', kind: '欠条', name: 'PR #73 合入', probe: { judge: 'pr-merged', pr: 73 } },
  // 原文：「本登记合入 main 后」，本登记就是 #255；若原意是等另一条改动，就是多报，越线时由人判
  { binds: 'ADR-130 第 110 行', kind: '欠条', name: 'PR #255（本登记）合入', probe: { judge: 'pr-merged', pr: 255 } },
  // 原文：「重启条件：#376 已合入」
  { binds: 'ADR-180 第 62 行', kind: '欠条', name: 'PR #376 合入', probe: { judge: 'pr-merged', pr: 376 } },
  // 原文：#417 合入后（D13 缺省预算那一片）
  { binds: 'ADR-184 第 217 行', kind: '欠条', name: 'PR #417 合入', probe: { judge: 'pr-merged', pr: 417 } },
  { binds: 'ADR-184 第 219 行', kind: '欠条', name: 'PR #417 合入', probe: { judge: 'pr-merged', pr: 417 } },
  // 原文写的是「独立测试包」那条分支合入（记录里写着分支名）；那条分支开的 PR 是 #425，合入时压成一个提交，标题末尾「 (#425)」
  { binds: 'ADR-183 第 118 行', kind: '欠条', name: '独立测试包那条分支（PR #425）合入', probe: { judge: 'pr-merged', pr: 425 } },
  { binds: 'ADR-184 第 193 行', kind: '欠条', name: '独立测试包那条分支（PR #425）合入', probe: { judge: 'pr-merged', pr: 425 } },
  { binds: 'ADR-184 第 272 行', kind: '欠条', name: '独立测试包那条分支（PR #425）合入', probe: { judge: 'pr-merged', pr: 425 } },
  // 原文：「还法：台账认得出已还、已重挂、收尾之后（ADR-151「台账不判哪张欠条已还」…）」
  { binds: 'ADR-236「还欠什么那一栏没有机器跟着改」', kind: '欠条', name: 'ADR-151「台账不判哪张欠条已还」已还',
    probe: { judge: 'ledger-status', waits: 'ADR-151「台账不判哪张欠条已还」', status: '已还' } },
  // 原文：「重启条件：上一张「生词提示的提示太多会没人看」还上时」
  { binds: 'ADR-237「生词提示只看 Markdown」', kind: '欠条', name: 'ADR-237「生词提示的提示太多会没人看」已还',
    probe: { judge: 'ledger-status', waits: 'ADR-237「生词提示的提示太多会没人看」', status: '已还' } },
  // 原文：「ADR-152 过了 30 000 字节」
  { binds: 'ADR-211「回访台账过线后挪块只靠回访 PR 正文一句提醒」', kind: '欠条', name: '回访台账主文件超过 30 000 字节',
    probe: { judge: 'tree-number', measure: { kind: 'bytes', path: 'docs/adr/ADR-152-回访台账：例程每周往这里追加一块，人合每一块.md' }, op: '>', line: 30000 } },
  // 原文：「它超过 30 行、或者里面出现任何一条……」：只算前一腿
  { binds: 'ADR-83 第 61 行', kind: '死亡条件', name: 'REVIEW.md 超过 30 行（只算前一腿）',
    probe: { judge: 'tree-number', measure: { kind: 'lines', path: 'REVIEW.md' }, op: '>', line: 30 } },
  // 原文：「仓库里不再有 `skill/SKILL.md` 时」
  { binds: 'ADR-156 第 210 行', kind: '死亡条件', name: 'skill/SKILL.md 不在了',
    probe: { judge: 'tree-number', measure: { kind: 'exists', path: 'skill/SKILL.md' }, op: '=', line: 0 } },
  // 原文：「`scripts/lib` 或 `scripts/providers` 里出现第一份手写的 `.d.ts` 时」：手写的就是进了仓库的
  { binds: 'ADR-202 第 473 行', kind: '欠条', name: 'scripts/lib、scripts/providers 里出现手写的 .d.ts',
    probe: { judge: 'tree-number', measure: { kind: 'tracked-suffix', dirs: ['scripts/lib', 'scripts/providers'], suffix: '.d.ts' }, op: '>=', line: 1 } },
  // 原文：「`--brief` 不再打豁免（或不再有豁免）……」：只算「不再有豁免」那一腿
  { binds: 'ADR-70 主文件第 273 行', kind: '死亡条件', name: '变异目录里不再有豁免（只算这一腿）',
    probe: { judge: 'tree-number', measure: { kind: 'json-array', path: 'scripts/check/mutations.json', key: 'exemptions' }, op: '=', line: 0 } },
]

/* ───────────── 原料 ───────────── */

/** 判法要的原料。取不到的给 undefined，那一行判「无从确认」 */
export interface ConditionRaw {
  /** 主干第一亲代链上每个提交的标题（消息第一行），从新到旧 */
  // 字段不入断言：交给判法的原料口子，判法用例各自喂一份、按结果比
  subjects: string[] | undefined
  /** 台账：记法 → 这一记法对上的那几行的种类与状态（`ledgerIndex`） */
  // 字段不入断言：交给判法的原料口子，判法用例各自喂一份、按结果比
  ledger: Map<string, LedgerHit[]>
  /** 树里一个文件的全文；不在给 undefined */
  // 字段不入断言：交给判法的原料口子，判法用例各自喂一份、按结果比
  read(path: string): Buffer | undefined
  /** 受跟踪的全部路径 */
  tracked: string[] | undefined
}

/** 台账里对上一个记法的一行 */
export interface LedgerHit { kind: '欠条' | '死亡条件'; status: RowStatus | null }

/**
 * 台账按记法索引：重启条件记作欠条，死亡条件照轮值的记法；重开讨论不进（没有探针绑它）。
 * 拆过的记录，主文件重写过的那张与历史文件里的原件名字相同、记法也相同，算同一个记法对上了两行。
 */
export function ledgerIndex(docs: Map<string, string>): Map<string, LedgerHit[]> {
  const split = splitRecords(docs)
  const out = new Map<string, LedgerHit[]>()
  for (const r of ledgerStatus(docs).rows) {
    if (r.entry.notation === '重开讨论') continue
    const n = notationOf(r.entry, docs.get(r.entry.file) ?? '', split)
    const hit: LedgerHit = { kind: r.entry.notation === '重启条件' ? '欠条' : '死亡条件', status: r.status }
    out.set(n, [...out.get(n) ?? [], hit])
  }
  return out
}

/** 判法要问 git 的两件事。答不上来给 undefined */
export interface ConditionGit {
  /** `rev` 第一亲代链上每个提交的标题，从新到旧 */
  subjects(rev: string): string[] | undefined
  /** 受跟踪的全部路径（`ls-files`） */
  tracked(): string[] | undefined
}

/**
 * `cat-file --batch` 按 `<修订>~0`、`<修订>~1`……一路问下去的回答，切成每个提交的标题。
 * 每一段是「`<对象> commit <字节数>`」一行、正文、一个换行；问过了链头，git 答「`<问的> missing`」，到这里为止。
 * 正文里头几行是提交的头，空一行之后是消息，标题取消息的第一行。形状不对（不是 commit、字节数不够）交回 undefined。
 */
export function parseSubjects(out: Buffer): string[] | undefined {
  const subjects: string[] = []
  let at = 0
  while (at < out.length) {
    const nl = out.indexOf(0x0a, at)
    if (nl < 0) return undefined
    const head = out.subarray(at, nl).toString('utf8').split(' ')
    if (head.at(-1) === 'missing') return subjects
    const size = Number(head[2])
    if (head.length !== 3 || head[1] !== 'commit' || !Number.isInteger(size) || nl + 1 + size > out.length) return undefined
    const body = out.subarray(nl + 1, nl + 1 + size).toString('utf8')
    const blank = body.indexOf('\n\n')
    subjects.push(blank < 0 ? '' : body.slice(blank + 2).split('\n')[0])
    at = nl + 1 + size + 1
  }
  return subjects
}

/** 用命令行 git 答那两件事；`cwd` 是仓库目录。入口与需求测试用的都是这一份 */
export function cliConditionGit(cwd = '.', env: NodeJS.ProcessEnv = process.env): ConditionGit {
  return {
    subjects: rev => {
      // 链有多长先用全部可达提交的个数封顶（第一亲代链只会更短），一次问完；问过链头的那几问 git 答 missing
      const all = gitText(['rev-list', rev], { cwd, env })
      if (all === null) return undefined
      const n = all.split('\n').filter(Boolean).length
      const r = runGit(['cat-file', '--batch'], { cwd, env, input: Array.from({ length: n + 1 }, (_, k) => `${rev}~${k}\n`).join('') })
      return r.error !== undefined || r.status !== 0 ? undefined : parseSubjects(r.stdout)
    },
    tracked: () => gitText(['ls-files', '-z'], { cwd, env })?.split('\0').filter(Boolean) ?? undefined,
  }
}

/** 入口交给判法的整份原料：git 那两件、台账、读树里文件的口子 */
export function conditionRaw(docs: Map<string, string>, git: ConditionGit, run: string, read: (path: string) => Buffer | undefined): ConditionRaw {
  return { subjects: git.subjects(run), ledger: ledgerIndex(docs), read, tracked: git.tracked() }
}

/* ───────────── 判法 ───────────── */

/** 一行算出来的：越线、没越线，或原料取不到（无从确认）；`value` 是算出来的数或为什么取不到，一句话 */
export interface Verdict { state: '越线' | '没越线' | '无从确认'; value: string }

/** 原料形状不对（例如 JSON 读出来不是那个形状）：不是「取不到」，整跑以 1 退出 */
export class RawShapeError extends Error {}

/** PR 合入的两种 GitHub 定死写法：合并提交「Merge pull request #N from …」，压成一个提交时标题末尾「 (#N)」 */
export function mergedBy(subject: string, pr: number): boolean {
  return subject.startsWith(`Merge pull request #${pr} from `) || subject.endsWith(` (#${pr})`)
}

function prMerged(raw: ConditionRaw, pr: number): Verdict {
  if (raw.subjects === undefined) return { state: '无从确认', value: '取不到主干第一亲代链上的提交标题' }
  const hit = raw.subjects.find(s => mergedBy(s, pr))
  return hit === undefined ? { state: '没越线', value: `#${pr} 没有合入主干` } : { state: '越线', value: `#${pr} 已合入：${hit}` }
}

function ledgerWait(raw: ConditionRaw, waits: string, status: '已还'): Verdict {
  const hits = raw.ledger.get(waits) ?? []
  if (hits.length === 0) return { state: '无从确认', value: `等的那张 ${waits} 在台账里找不到` }
  const st = hits.map(h => h.status)
  if (st.includes(status)) return { state: '越线', value: `${waits} ${status}` }
  // 等的那张没还就关了（收尾、改挂），「已还」永远等不到：不判没越线，每周点名
  const closed = st.find(s => s === '收尾' || s === '已重挂')
  if (closed !== undefined) return { state: '无从确认', value: `等的那张 ${waits} 已${closed === '收尾' ? '收尾' : '改挂'}，等不到${status}` }
  return { state: '没越线', value: `${waits} ${st.join('、')}` }
}

/** 量出来的数；原料取不到给 undefined */
function measured(raw: ConditionRaw, m: Measure): number | undefined {
  if (m.kind === 'tracked-suffix') {
    return raw.tracked?.filter(p => p.endsWith(m.suffix) && m.dirs.some(d => p.startsWith(`${d}/`))).length
  }
  const buf = raw.read(m.path)
  if (m.kind === 'exists') return buf === undefined ? 0 : 1
  if (buf === undefined) return undefined
  if (m.kind === 'bytes') return buf.length
  if (m.kind === 'lines') { let n = 0; for (const b of buf) if (b === 0x0a) n++; return n }
  let data: unknown
  try { data = JSON.parse(buf.toString('utf8')) } catch { throw new RawShapeError(`${m.path} 不是 JSON`) }
  const list = data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>)[m.key] : undefined
  if (!Array.isArray(list)) throw new RawShapeError(`${m.path} 顶层的 ${m.key} 不是数组`)
  return list.length
}

const MEASURE_WORD: Record<Measure['kind'], string> = { bytes: '字节数', lines: '行数', 'json-array': '条数', exists: '在不在（在 1，不在 0）', 'tracked-suffix': '份数' }

function treeNumber(raw: ConditionRaw, m: Measure, op: Op, line: number): Verdict {
  const n = measured(raw, m)
  const what = m.kind === 'tracked-suffix' ? `${m.dirs.join('、')} 下受跟踪的 ${m.suffix}` : m.kind === 'json-array' ? `${m.path} 的 ${m.key}` : m.path
  if (n === undefined) return { state: '无从确认', value: m.kind === 'tracked-suffix' ? '取不到受跟踪的路径' : `${m.path} 不在` }
  const over = op === '>' ? n > line : op === '>=' ? n >= line : n === line
  return { state: over ? '越线' : '没越线', value: `${what} ${MEASURE_WORD[m.kind]} ${n}（线：${op} ${line}）` }
}

/** 算一行 */
export function judge(raw: ConditionRaw, p: Probe): Verdict {
  if (p.judge === 'pr-merged') return prMerged(raw, p.pr)
  if (p.judge === 'ledger-status') return ledgerWait(raw, p.waits, p.status)
  return treeNumber(raw, p.measure, p.op, p.line)
}

/* ───────────── 核对登记表（检查链） ───────────── */

/**
 * 登记表核不过的地方，一处一行；空数组就是过。由 `adr-sync.ts` 调，进检查链：
 * 1. 绑的记法在台账里恰好对上一条（拆过的记录主文件与历史文件同名的那张，状态相同算一条），种类与登记的同；
 * 2. 欠条要开着或续挂：已还、收尾、已重挂了，这个探针管的那条已经关了或改挂了，要撤掉或改绑；死亡条件没有状态，只核在不在；
 * 3. 一条至多一个探针；
 * 4. 参数：PR 号是正整数；`ledger-status` 等的那张在台账里是一张欠条；量的文件在（量「在不在」的除外）、数份数的目录下有受跟踪的文件。
 */
export function conditionFaults(table: readonly Condition[], docs: Map<string, string>, exists: (path: string) => boolean): string[] {
  const ledger = ledgerIndex(docs)
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of table) {
    const at = `条件探针「${c.name}」（绑 ${c.binds}）`
    if (seen.has(c.binds)) out.push(`${at}：这一条已经绑了一个探针，一条至多一个`)
    seen.add(c.binds)
    const hits = ledger.get(c.binds) ?? []
    const states = new Set(hits.map(h => `${h.kind}${h.status}`))
    if (hits.length === 0) out.push(`${at}：台账里没有这个记法（行号挪了、名字改了，或那一条删了）`)
    else if (states.size > 1) out.push(`${at}：这个记法在台账里对上不止一条、种类或状态不同`)
    else if (hits[0].kind !== c.kind) out.push(`${at}：台账里它是${hits[0].kind}，登记的是${c.kind}`)
    else if (c.kind === '欠条' && hits[0].status !== '开着' && hits[0].status !== '续挂') {
      out.push(`${at}：这个探针管的那条已经${hits[0].status === '已重挂' ? '改挂' : hits[0].status === '已还' ? '还了' : '收尾'}，撤掉这一行或改绑到现行那一张`)
    }
    const p = c.probe
    if (p.judge === 'pr-merged' && !(Number.isInteger(p.pr) && p.pr > 0)) out.push(`${at}：PR 号要是正整数`)
    if (p.judge === 'ledger-status' && !(ledger.get(p.waits) ?? []).some(h => h.kind === '欠条')) out.push(`${at}：等的那张 ${p.waits} 在台账里不是一张欠条`)
    if (p.judge === 'tree-number') {
      const m = p.measure
      if (m.kind === 'tracked-suffix') { for (const d of m.dirs) if (!exists(d)) out.push(`${at}：目录 ${d} 不在`) }
      else if (m.kind !== 'exists' && !exists(m.path)) out.push(`${at}：文件 ${m.path} 不在`)
    }
  }
  return out
}

/* ───────────── 每周回访那一段 ───────────── */

/** 人判栏算「判了」的词：欠条照到期清单那三个，死亡条件认接受、拒绝 */
const JUDGED: Record<Condition['kind'], ReadonlySet<string>> = { 欠条: new Set(['还', '收尾', '留']), 死亡条件: new Set(['接受', '拒绝']) }

/** 判过以后几天内越线也不再列（与到期清单同一个数） */
export const QUIET_DAYS = 28

/** 一行算完的结果 */
export interface Outcome {
  // 字段不入断言：逐行算那一例按每一行的记法与状态比，变异改坏挂到哪一行
  binds: string
  // 字段不入断言：同上，回访那一段按它挑判词
  kind: Condition['kind']
  // 字段不入断言：同上，回访那一段原样打出来
  name: string
  // 字段不入断言：同上，变异改坏按哪一行的判法算
  verdict: Verdict
}

/** 照登记表逐行算。判法抛的错（原料形状不对）不接，由入口以 1 退出 */
export function evaluate(table: readonly Condition[], raw: ConditionRaw): Outcome[] {
  return table.map(({ binds, kind, name, probe }) => ({ binds, kind, name, verdict: judge(raw, probe) }))
}

/** 越线的记法（含先不列的）：到期清单与死亡条件轮值先拿掉它们 */
export function firedSet(outcomes: Outcome[]): Set<string> {
  return new Set(outcomes.filter(o => o.verdict.state === '越线').map(o => o.binds))
}

/**
 * 回访 PR 正文与候选表要的那一段。第一行是几个数；之后越线、这一周要列的每条一行
 * `<记法> · <欠条|死亡条件> · <名字> · 越线：<算出来的>`，列过没判的接「 · 列过没判」；最后是无从确认的每条一行，每周都点名。
 *
 * 越线了也先不列的两种：
 * - 在 ADR-152 候选表里列过、人判栏判了（欠条：还、收尾、留；死亡条件：接受、拒绝），判的那一块的日期再过 28 天之前；
 * - 欠条续挂了，续挂写的那天之前（`until`，按记法）。
 *
 */
export function conditionReport(outcomes: Outcome[], today: string, listed: Map<string, Listing>, until: Map<string, string>): string[] {
  const n = (s: Verdict['state']) => outcomes.filter(o => o.verdict.state === s).length
  const fired = outcomes.filter(o => o.verdict.state === '越线')
  let quiet = 0, carried = 0
  const shown: string[] = []
  for (const { verdict: v, ...c } of fired) {
    const l = listed.get(c.binds)
    const judged = l !== undefined && JUDGED[c.kind].has(l.verdict.trim())
    if (judged && today < addDays(l.day, QUIET_DAYS)) { quiet++; continue }
    const u = c.kind === '欠条' ? until.get(c.binds) : undefined
    if (u !== undefined && today < u) { carried++; continue }
    shown.push(`${c.binds} · ${c.kind} · ${c.name} · 越线：${v.value}${l !== undefined && !judged ? ' · 列过没判' : ''}`)
  }
  const unknown = outcomes.filter(o => o.verdict.state === '无从确认').map(o => `无从确认：${o.binds} · ${o.name} · ${o.verdict.value}`)
  return [`条件探针 ${outcomes.length} 条：越线 ${fired.length}、没越线 ${n('没越线')}、无从确认 ${n('无从确认')}；这次列 ${shown.length} 条（判过、${QUIET_DAYS} 天内不再列的 ${quiet} 条，续挂没到那天的 ${carried} 条）`,
    ...shown, ...unknown]
}
