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
import { MUTATION_CATALOG, catalogFaultText, readCatalog } from './catalog-rule.js'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { gitText, runGit } from './git-entry.js'
import { addDays, notationOf, rotaNotations, type Listing } from './revisit-rule.js'

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
  /** 变异目录里豁免的条数：经变异目录的读口读（`catalog-rule.ts`），不自己解析 */
  | { kind: 'catalog-exemptions' }
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
  /**
   * 按行号绑的（记法里没有「」名字的）必写：那一行条件原文（台账抽出来的那一句）的指纹，`pinOf` 算的。
   * 核对时拿台账此刻那一句重算、比：行号挪了、同一行换成了另一条（哪怕新的一条里还含着原来的几个字）、措辞改了，都红。
   * 存指纹不存原文：原文里有时写着外部工单号，仓库里不许再多（ADR-205）；原文要点每行上面的注释摘了，全文在绑的那份记录里
   */
  pin?: string
 
  probe: Probe
}

/**
 * 第一批：303 条开着的条件分类时「能算」、用得上这三种判法的（ADR-252 附表）。
 * 参数填错（PR 号写错）检查链拦不住，只能靠评审对着原文看 —— 每行后面写着原文怎么说的。
 */
export const CONDITIONS: readonly Condition[] = [
  // 原文：「重启条件：PR #73 已合入」（后半句另有所等的话，越线时由人判）
  { binds: 'ADR-69 第 20 行', kind: '欠条',
    pin: '7e71ac9548ca4913',
    name: 'PR #73 合入', probe: { judge: 'pr-merged', pr: 73 } },
  // 原文：「本登记合入 main 后」，本登记就是 #255；若原意是等另一条改动，就是多报，越线时由人判
  { binds: 'ADR-130 第 110 行', kind: '欠条',
    pin: 'c07fd2c7187f6d33',
    name: 'PR #255（本登记）合入', probe: { judge: 'pr-merged', pr: 255 } },
  // 原文：「重启条件：#376 已合入」
  { binds: 'ADR-180 第 62 行', kind: '欠条',
    pin: 'e1a396b4a574641d',
    name: 'PR #376 合入', probe: { judge: 'pr-merged', pr: 376 } },
  // 原文：#417 合入后（D13 缺省预算那一片）
  { binds: 'ADR-184 第 217 行', kind: '欠条',
    pin: '826fbf0a0127fa2a',
    name: 'PR #417 合入', probe: { judge: 'pr-merged', pr: 417 } },
  { binds: 'ADR-184 第 219 行', kind: '欠条',
    pin: '8446f7f33346b81a',
    name: 'PR #417 合入', probe: { judge: 'pr-merged', pr: 417 } },
  // 原文写的是「独立测试包」那条分支合入（记录里写着分支名）；那条分支开的 PR 是 #425，合入时压成一个提交，标题末尾「 (#425)」
  { binds: 'ADR-183 第 118 行', kind: '欠条',
    pin: 'fdd46bca636fcb0f',
    name: '独立测试包那条分支（PR #425）合入', probe: { judge: 'pr-merged', pr: 425 } },
  { binds: 'ADR-184 第 193 行', kind: '欠条',
    pin: '61e383f66e434dfd',
    name: '独立测试包那条分支（PR #425）合入', probe: { judge: 'pr-merged', pr: 425 } },
  { binds: 'ADR-184 第 272 行', kind: '欠条',
    pin: '38d4411f83b5cc85',
    name: '独立测试包那条分支（PR #425）合入', probe: { judge: 'pr-merged', pr: 425 } },
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
  { binds: 'ADR-83 第 61 行', kind: '死亡条件',
    pin: 'f5fb3274d623ac29',
    name: 'REVIEW.md 超过 30 行（只算前一腿）',
    probe: { judge: 'tree-number', measure: { kind: 'lines', path: 'REVIEW.md' }, op: '>', line: 30 } },
  // 原文：「仓库里不再有 `skill/SKILL.md` 时」
  { binds: 'ADR-156 第 210 行', kind: '死亡条件',
    pin: 'a820a82c3da1a023',
    name: 'skill/SKILL.md 不在了',
    probe: { judge: 'tree-number', measure: { kind: 'exists', path: 'skill/SKILL.md' }, op: '=', line: 0 } },
  // 原文：「`scripts/lib` 或 `scripts/providers` 里出现第一份手写的 `.d.ts` 时」：手写的就是进了仓库的
  { binds: 'ADR-202 第 473 行', kind: '欠条',
    pin: '7c1fb0a9f8abdff0',
    name: 'scripts/lib、scripts/providers 里出现手写的 .d.ts（只算前一腿）',
    probe: { judge: 'tree-number', measure: { kind: 'tracked-suffix', dirs: ['scripts/lib', 'scripts/providers'], suffix: '.d.ts' }, op: '>=', line: 1 } },
  // 原文：「`--brief` 不再打豁免（或不再有豁免）……」：只算「不再有豁免」那一腿
  { binds: 'ADR-70 主文件第 273 行', kind: '死亡条件',
    pin: 'a50d6bd99d943a33',
    name: '变异目录里不再有豁免（只算这一腿）',
    probe: { judge: 'tree-number', measure: { kind: 'catalog-exemptions' }, op: '=', line: 0 } },
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
  /** 树里一个文件：读到了的全文，或为什么没读到（`readTreeFile`） */
  // 字段不入断言：交给判法的原料口子，判法用例各自喂一份、按结果比
  read(path: string): TreeFile
  /** 受跟踪的全部路径 */
  tracked: string[] | undefined
}

/** 台账里对上一个记法的一行 */
export interface LedgerHit {
  // 字段不入断言：核对与判法按它比，各自的用例按结果比
  kind: '欠条' | '死亡条件'
  // 字段不入断言：同上
  status: RowStatus | null
  /** 这一行的条件原文（台账抽出来的那一句） */
  // 字段不入断言：同上，核对按行号绑的那几行拿它重算指纹比 `pin`
  text: string
}

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
    const hit: LedgerHit = { kind: r.entry.notation === '重启条件' ? '欠条' : '死亡条件', status: r.status, text: r.entry.text }
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
 * 头一问就答 missing（给的修订不是一个提交，例如写成了 `A..B`）也交回 undefined：链头之前至少有它自己，空链只能是问错了，不是「一个都没合入」。
 */
export function parseSubjects(out: Buffer): string[] | undefined {
  const subjects: string[] = []
  let at = 0
  while (at < out.length) {
    const nl = out.indexOf(0x0a, at)
    if (nl < 0) return undefined
    const head = out.subarray(at, nl).toString('utf8').split(' ')
    if (head.at(-1) === 'missing') return subjects.length > 0 ? subjects : undefined
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
      // 浅克隆的链在边界上就断了，早先合入的 PR 会被说成没合入：不是完整历史就算取不到
      if (gitText(['rev-parse', '--is-shallow-repository'], { cwd, env })?.trim() !== 'false') return undefined
      const all = gitText(['rev-list', rev], { cwd, env })
      if (all === null) return undefined
      const n = all.split('\n').filter(Boolean).length
      const r = runGit(['cat-file', '--batch'], { cwd, env, input: Array.from({ length: n + 1 }, (_, k) => `${rev}~${k}\n`).join('') })
      return r.error !== undefined || r.status !== 0 ? undefined : parseSubjects(r.stdout)
    },
    tracked: () => gitText(['ls-files', '-z'], { cwd, env })?.split('\0').filter(Boolean) ?? undefined,
  }
}

/** 树里一个路径是普通文件、目录，还是不在（取不到属性的也算不在）：三个入口核登记表用同一份 */
export function pathKind(path: string): 'file' | 'dir' | undefined {
  try { const s = statSync(path); return s.isFile() ? 'file' : s.isDirectory() ? 'dir' : undefined } catch { return undefined }
}

/**
 * 读树里一个文件的回答，分四种：读到了；确实不在；在、但不是普通文件；在、但读不到。
 * 「确实不在」只认系统答的「没有这个文件」（ENOENT，或路径中间一段是文件的 ENOTDIR），别的错一律算读不到 ——
 * 读不到不等于不在：量「在不在」的把读不到当不在，条件就被说成成立了。
 */
export type TreeFile = { kind: 'file'; bytes: Buffer } | TreeFileMissing

/** 没读到，为什么 */
export interface TreeFileMissing {
  // 字段不入断言：「读不到」只在没有读权限时出，需求测试以 root 跑时造不出来；判法那一侧的用例直接喂「读不到」、按结果比
  kind: '不在' | '不是普通文件' | '读不到'
}

/** 照 `TreeFile` 的四种读一个路径 */
export function readTreeFile(path: string): TreeFile {
  let st
  try { st = statSync(path) } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    return code === 'ENOENT' || code === 'ENOTDIR' ? { kind: '不在' } : { kind: '读不到' }
  }
  if (!st.isFile()) return { kind: '不是普通文件' }
  try { return { kind: 'file', bytes: readFileSync(path) } } catch { return { kind: '读不到' } }
}

/** 入口交给判法的整份原料：git 那两件、台账、读树里文件的口子 */
export function conditionRaw(docs: Map<string, string>, git: ConditionGit, run: string, read: (path: string) => TreeFile): ConditionRaw {
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

/** 量出来的数；原料取不到给一句为什么（这一行无从确认，别的照算） */
function measured(raw: ConditionRaw, m: Measure): number | string {
  if (m.kind === 'tracked-suffix') {
    return raw.tracked?.filter(p => p.endsWith(m.suffix) && m.dirs.some(d => p.startsWith(`${d}/`))).length ?? '取不到受跟踪的路径'
  }
  if (m.kind === 'catalog-exemptions') {
    const f = raw.read(MUTATION_CATALOG)
    if (f.kind !== 'file') return `变异目录${f.kind}`
    const r = readCatalog(f.bytes.toString('utf8'))
    if (!r.ok) throw new RawShapeError(catalogFaultText(r.fault))
    return r.exemptions.length
  }
  const f = raw.read(m.path)
  // 「在不在」只有确实不在才算 0；在、却读不到或不是普通文件，说不清，无从确认
  if (m.kind === 'exists') return f.kind === '不在' ? 0 : f.kind === 'file' ? 1 : `${m.path} ${f.kind}`
  if (f.kind !== 'file') return `${m.path} ${f.kind}`
  if (m.kind === 'lines') { let n = 0; for (const b of f.bytes) if (b === 0x0a) n++; return n }
  return f.bytes.length
}

const MEASURE_WORD: Record<Measure['kind'], string> = { bytes: '字节数', lines: '行数', 'catalog-exemptions': '豁免条数', exists: '在不在（在 1，不在 0）', 'tracked-suffix': '份数' }

function treeNumber(raw: ConditionRaw, m: Measure, op: Op, line: number): Verdict {
  const n = measured(raw, m)
  const what = m.kind === 'tracked-suffix' ? `${m.dirs.join('、')} 下受跟踪的 ${m.suffix}` : m.kind === 'catalog-exemptions' ? '变异目录' : m.path
  if (typeof n === 'string') return { state: '无从确认', value: n }
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

/** 去掉全部空白：原文跨行、多一个空格不算换了一句 */
const flat = (t: string): string => t.replace(/\s+/g, '')

/** 条件原文的指纹：去掉全部空白后的 SHA-256，取前 16 位十六进制。登记表的 `pin` 照它写；核不过时那一行报出现在的指纹 */
export const pinOf = (text: string): string => createHash('sha256').update(flat(text)).digest('hex').slice(0, 16)

/**
 * 登记表核不过的地方，一处一行；空数组就是过。由 `adr-sync.ts` 调，进检查链：
 * 1. 绑的记法在台账里恰好对上一条（拆过的记录主文件与历史文件同名的那张，状态相同算一条；没名字、按行号对上两条的，不知道是哪一张，报），种类与登记的同；
 * 2. 欠条要开着或续挂：已还、收尾、已重挂了，这个探针管的那条已经关了或改挂了，要撤掉或改绑；死亡条件没有状态，
 *    只核它是轮值里会列出的那一份（拆过的记录，历史文件里与主文件整句相同的那份不列，绑它就红）—— 拿掉越线的只按这个记法；
 * 3. 一条至多一个探针；按行号绑的，登记时写下的指纹（`pin`）要与那一行条件原文此刻的指纹相同 —— 行号挪了、同一行换成了另一条、措辞改了，都在这里红；
 * 4. 参数：PR 号是正整数；`ledger-status` 等的那张在台账里是一张欠条；量的是普通文件（量「在不在」与变异目录豁免条数的除外）、数份数的是目录。
 *
 * `kindOf` 答一个路径在树里是普通文件、目录，还是不在（或别的）。
 */
export function conditionFaults(table: readonly Condition[], docs: Map<string, string>, kindOf: (path: string) => 'file' | 'dir' | undefined): string[] {
  const ledger = ledgerIndex(docs)
  const rota = rotaNotations(docs)
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
    else if (hits.length > 1 && !c.binds.includes('「')) out.push(`${at}：这个行号在台账里对上不止一条（拆过的记录主文件与历史文件同一行各有一张），不知道绑的是哪一张`)
    else if (hits[0].kind !== c.kind) out.push(`${at}：台账里它是${hits[0].kind}，登记的是${c.kind}`)
    else if (c.kind === '死亡条件' && !rota.has(c.binds)) out.push(`${at}：轮值里不列这一份（历史文件里与主文件整句相同，只列主文件那一份），改绑主文件那一行`)
    else if (c.kind === '欠条' && hits[0].status !== '开着' && hits[0].status !== '续挂') {
      out.push(`${at}：这个探针管的那条已经${hits[0].status === '已重挂' ? '改挂' : hits[0].status === '已还' ? '还了' : '收尾'}，撤掉这一行或改绑到现行那一张`)
    }
    if (!c.binds.includes('「')) {
      if (c.pin === undefined || !/^[0-9a-f]{16}$/.test(c.pin)) out.push(`${at}：按行号绑的要写 pin（那一行条件原文的指纹，pinOf 算的 16 位十六进制），核对时比`)
      else if (hits.length === 1 && pinOf(hits[0].text) !== c.pin) out.push(`${at}：这一行现在写的与登记时那一句不是同一句（行号挪了、换成了另一条或措辞改了；现在的指纹是 ${pinOf(hits[0].text)}），撤掉这一行或核过原文后改绑`)
    }
    const p = c.probe
    if (p.judge === 'pr-merged' && !(Number.isInteger(p.pr) && p.pr > 0)) out.push(`${at}：PR 号要是正整数`)
    if (p.judge === 'ledger-status' && !(ledger.get(p.waits) ?? []).some(h => h.kind === '欠条')) out.push(`${at}：等的那张 ${p.waits} 在台账里不是一张欠条`)
    if (p.judge === 'tree-number') {
      const m = p.measure
      if (m.kind === 'tracked-suffix') {
        for (const d of m.dirs) { const k = kindOf(d); if (k !== 'dir') out.push(`${at}：${k === undefined ? `目录 ${d} 不在` : `${d} 不是目录`}`) }
      } else if (m.kind !== 'exists' && m.kind !== 'catalog-exemptions') {
        const k = kindOf(m.path)
        if (k !== 'file') out.push(`${at}：${k === undefined ? `文件 ${m.path} 不在` : `${m.path} 不是普通文件`}`)
      }
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

/** 算出来的那一段要抄进候选表的「值」栏：提交标题里的竖线换成全角，不把表格切开 */
const cell = (s: string): string => s.replace(/\|/g, '｜')

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
  // 先不列的也按记法各打一行：例程靠它认出「新增」里哪几张已归探针管，不再列一遍
  const held: string[] = []
  for (const { verdict: v, ...c } of fired) {
    const l = listed.get(c.binds)
    const judged = l !== undefined && JUDGED[c.kind].has(l.verdict.trim())
    const u = c.kind === '欠条' ? until.get(c.binds) : undefined
    // 判过的又续挂了：两道都过了才再列，说的日子取晚的那个
    if (judged && today < addDays(l.day, QUIET_DAYS)) {
      const back = u !== undefined && u > addDays(l.day, QUIET_DAYS) ? u : addDays(l.day, QUIET_DAYS)
      quiet++; held.push(`先不列：${c.binds} · ${c.kind} · ${c.name} · 判过，${back} 起再列`); continue
    }
    if (u !== undefined && today < u) { carried++; held.push(`先不列：${c.binds} · ${c.kind} · ${c.name} · 续挂到 ${u}`); continue }
    // 续挂过（续挂行写了日子）或哪一次判过留的欠条，与到期清单同一个标记：「留」只许一次
    const again = c.kind === '欠条' && (u !== undefined || l?.kept === true) ? ' · 续挂过，只能还或收尾' : ''
    shown.push(`${c.binds} · ${c.kind} · ${c.name} · 越线：${cell(v.value)}${l !== undefined && !judged ? ' · 列过没判' : ''}${again}`)
  }
  const unknown = outcomes.filter(o => o.verdict.state === '无从确认').map(o => `无从确认：${o.binds} · ${o.name} · ${cell(o.verdict.value)}`)
  return [`条件探针 ${outcomes.length} 条：越线 ${fired.length}、没越线 ${n('没越线')}、无从确认 ${n('无从确认')}；这次列 ${shown.length} 条（判过、${QUIET_DAYS} 天内不再列的 ${quiet} 条，续挂没到那天的 ${carried} 条）`,
    ...shown, ...held, ...unknown]
}
