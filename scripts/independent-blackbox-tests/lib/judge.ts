// KOL-21 C1 · 判定核心：结果分档、语义复核承载、stdout/stderr/文件/请求/零请求公共判据
// 只依据冻结单 pack/30-frozen-spec.md（A.0 通用约定 :21-279、A.4 :1337-1412）；不 import 实现。
//
// 结果分档（:11-17、:1348-1349；ADR-70:3427、:3432）：
//   pass / red（语义红）/ facility（设施故障）/ fixture（夹具失格）/ not-judged（附条件子断言、前提未补，不计过也不计不过）
//   / review-pending（语义复核未做、或资格待定；不计过）。facility、fixture 不算红也不算过，单独计数报告。
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ConditionId, E2Adapter, E3Adapter, ObservedRun, ObserverFacility, ApiKey, ObserverEntry,
  Resolution, ReviewRecord, SavePoint, SortForOutput, RequestOutcome, ScriptResponse,
} from './contract.ts'
import { scanJ, get1, getAll, has, plain, deepEqual, exact, describe, parseDocument, type JNode } from './json.ts'
import { sha256, newFilesNamed, treeNoDir, treeNoTask, treeSame, bytesSame, type Snap } from './fsnap.ts'
import type { NamedScript } from '../fixtures.ts'

export type Status = 'pass' | 'red' | 'facility' | 'fixture' | 'not-judged' | 'review-pending'
export interface Item {
  label: string; status: Status; detail?: string; basis?: string
  review?: { key: string; points: string[]; prefilter?: string; textSha256: string; textRef: string }
}
export type Verdict = Status | 'not-covered'

export interface RunDef {
  id: string
  entry: ObserverEntry | 'control'
  script: string
  apiKey?: ApiKey
  files: Record<string, string>
  args: (cwd: string) => string[]
  configRel?: string
  taskRel?: string
  e2?: { point: SavePoint; k: number }
}
export interface RunRec {
  def: RunDef; script: NamedScript; runDir: string; cwd: string; evidenceDir: string
  before: Snap; after?: Snap; obs?: ObservedRun
  skip?: 'isolation' | 'E-2' | 'facility-missing'
  J: JNode[]; stderrText: string
  e2Hits?: ReturnType<E2Adapter['hits']>
}
export interface CaseDef {
  id: string; group: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6'
  frozen: '可执行' | '附条件' | '不覆盖'
  spec: string                       // 冻结单定位，如 'pack/30-frozen-spec.md:294-315'
  runs: string[]                     // 用到的跑（同跑复用时与主用例相同）
  deps?: Dep[]
  judge?: (c: Ctx) => void           // 不覆盖的用例没有 judge，只登记
  notCovered?: string
}
export interface Dep { kind: 'semantic' | 'accepted' | 'exit3'; of: string; why: string }
export interface CaseResult { id: string; group: string; frozen: string; spec: string; verdict: Verdict; items: Item[]; notes: string[] }

export interface Env {
  facility?: ObserverFacility
  certified: boolean
  certNote: string
  runs: Map<string, RunRec>
  reviews: Map<string, ReviewRecord>
  conditions: Partial<Record<ConditionId, Resolution>>
  e2?: E2Adapter; e3?: E3Adapter
  sort?: SortForOutput
  creatorCheck?: (c: unknown) => string[]
  result(caseId: string): CaseResult
  questions: string[]
}

// ---------------------------------------------------------------------------------------------
export class Ctx {
  caseId: string
  env: Env
  items: Item[] = []
  notes: string[] = []
  qualPending = false
  seenRun = new Set<string>()
  /** 一条用例判多跑时（如 G2-23a、G3-13）给标签加跑号前缀，使循环展开的各案例可区分（process/4-VERIFY.md:214-218）。 */
  prefix = ''
  constructor(caseId: string, env: Env) { this.caseId = caseId; this.env = env }

  push(i: Item): void {
    if (!i.label.startsWith(this.prefix)) i.label = this.prefix + i.label
    if (this.items.some((x) => x.label === i.label)) throw new Error(`标签重复：${this.caseId}/${i.label}`)
    this.items.push(i)
  }
  pass(label: string, detail?: string, basis?: string): void { this.push({ label, status: 'pass', detail, basis }) }
  red(label: string, detail: string, basis?: string): void { this.push({ label, status: 'red', detail, basis }) }
  ok(label: string, cond: boolean, detail: string, basis?: string): void { cond ? this.pass(label, detail, basis) : this.red(label, detail, basis) }
  nj(label: string, reason: string, basis?: string): void { this.push({ label, status: 'not-judged', detail: reason, basis }) }
  fixture(label: string, reason: string): void { this.push({ label, status: 'fixture', detail: reason }) }
  facility(label: string, reason: string): void { this.push({ label, status: 'facility', detail: reason }) }
  pending(label: string, reason: string): void { this.push({ label, status: 'review-pending', detail: reason }) }

  /** 前提是否已由整合方登记为补齐；answer 给出时还要求答案一致（只放行冻结单写死「补齐后照现有 expected 判」的那一种）。 */
  cond(id: ConditionId, answer?: string): boolean {
    const r = this.env.conditions[id]
    return !!r && r.resolved === true && (answer === undefined || r.answer === answer)
  }

  /** A.0.6（:101）：退出码 / stdout / stderr / 文件 / 请求断言只在该跑 observed 时判；否则按 outcome 分档报。 */
  observed(runId: string): RunRec | null {
    const r = this.env.runs.get(runId)
    const tag = `跑 ${runId}`
    const once = (f: () => void): void => { if (!this.seenRun.has(runId)) { this.seenRun.add(runId); f() } }
    if (!r) { once(() => this.fixture(tag, '跑没有登记（测试自身错误）')); return null }
    if (r.skip === 'isolation') { once(() => this.facility(tag, 'Z1：断网认证不成立，未起任何入口（:1343；ADR-70:3417）')); return null }
    if (r.skip === 'facility-missing') { once(() => this.facility(tag, '未注入观察器调用面（SuiteOptions.facility），入口未起；不是语义判定')); return null }
    if (r.skip === 'E-2') { once(() => this.nj(tag, '待 E-2 契约由实现方提供：没有可用的注入办法，本跑未起（:1797、:1824-1845）')); return null }
    if (!r.obs) { once(() => this.facility(tag, '没有观察结果')); return null }
    const o = r.obs.outcome
    if (o.kind === 'facility') { once(() => this.facility(tag, `设施故障 cause=${o.cause}：${o.reason}（这一跑的退出码、输出与请求不判任何需求，ADR-70:3417）`)); return null }
    if (o.kind === 'fixture') { once(() => this.fixture(tag, `观察器夹具失格：${o.reason}`)); return null }
    return r
  }
  run(runId: string): RunRec | undefined { return this.env.runs.get(runId) }
  /** 跨跑比较（如 G2-15C、G2-20）只看别的跑是否 observed，不把别跑的设施/夹具结果记进本例。 */
  peek(runId: string): RunRec | null {
    const r = this.env.runs.get(runId)
    return r && !r.skip && r.obs && r.obs.outcome.kind === 'observed' ? r : null
  }

  /** 语义复核（:13、:67）：机械预筛只辅助定位，预筛不过不判红；评审记录须绑定本跑文本的 SHA-256，正面要点还须引出所依据的原文行。 */
  review(label: string, o: { text: string; textRef: string; points: string[]; pre?: (t: string) => string; needsQuote: boolean; basis?: string; keyOverride?: string }): void {
    const key = o.keyOverride ?? `${this.caseId}/${this.prefix}${label}`
    const textSha256 = sha256(o.text)
    const prefilter = o.pre ? o.pre(o.text) : '（本项冻结单未给预筛）'
    const rec = this.env.reviews.get(key)
    const base = { key, points: o.points, prefilter, textSha256, textRef: o.textRef }
    const mk = (status: Status, detail: string): void => this.push({ label, status, detail, basis: o.basis, review: base })
    if (!rec) return mk('review-pending', '尚待语义复核（预筛结果只供定位，不作判定）')
    if (rec.textSha256 !== textSha256) return mk('review-pending', '复核记录所绑定的文本与本跑输出不符，需对本跑重新复核')
    const quotes = rec.quotes ?? []
    if (quotes.some((q) => !o.text.includes(q))) return mk('review-pending', '复核记录引用的原文不在本跑文本中')
    if (o.needsQuote && rec.verdict === 'pass' && quotes.length === 0) return mk('review-pending', '正面要点的复核记录须写明所依据的那一行原文')
    if (rec.verdict === 'pass') return mk('pass', `语义复核通过（${rec.reviewer}）：${quotes.join(' ⏎ ')}`)
    if (rec.verdict === 'red') return mk('red', `语义复核不过（${rec.reviewer}）：${rec.note ?? ''} ${quotes.join(' ⏎ ')}`)
    return mk('review-pending', '复核记录的结论不是 pass/red：' + rec.verdict)
  }
}

// ---------------------------------------------------------------------------------------------
// 依据标注（测试里每条断言旁的出处，取冻结单原文所引）
export const B = {
  observed: 'ADR-70:3417；冻结单 :101',
}

// ---------------- 请求（A.0.6 :101；ADR-70:3258）----------------
export function outcomeStr(o: RequestOutcome): string {
  if ('status' in o) return `status:${o.status}`
  if ('connect' in o) return 'connect:fail'
  return `refused:${o.refused}`
}
export function respStr(r: ScriptResponse): string {
  return 'connect' in r ? 'connect:fail' : `status:${r.status}`
}
export function reqKey(r: RunRec, q: ObservedRun['requests'][number]): string {
  const name = q.rule === null ? 'null' : (r.script.names[q.rule] ?? `rule${q.rule}`)
  return `${name}#${q.index}@${outcomeStr(q.outcome)}`
}
/** 请求恰好为这些（按次数比，不断先后——冻结单只在写明处断先后，见日志形式选择）；另核每次请求的 endpoint 与所命中规则一致。 */
export function reqExactly(c: Ctx, r: RunRec, label: string, expected: Array<[string, number, string]>, basis: string): void {
  const reqs = r.obs!.requests
  const got = reqs.map((q) => reqKey(r, q)).sort()
  const want = expected.map(([n, i, o]) => `${n}#${i}@${o}`).sort()
  const epBad = reqs.filter((q) => q.rule !== null && r.script.script.rules[q.rule]?.endpoint !== q.endpoint)
  c.ok(label, deepEqual(got, want) && epBad.length === 0, `期望 [${want.join(', ')}]，实际 [${got.join(', ')}]${epBad.length ? '；endpoint 与规则不符 ' + epBad.length + ' 次' : ''}`, basis)
}
export function ruleOf(r: RunRec, name: string): number { return r.script.names.indexOf(name) }
export function reqsOnRule(r: RunRec, name: string): ObservedRun['requests'] {
  const i = ruleOf(r, name)
  return r.obs!.requests.filter((q) => q.rule === i)
}

// ---------------- 零请求（A.4.1 Z1–Z6，:1341-1350；ADR-70:3432 修订版判序）----------------
/** Z3 对阳性那一跑的核对（:1345）：observed；至少一次请求 rule/index 非空、outcome 与脚本该位置一致、run 一致。 */
export function z3(p: RunRec | undefined): { ok: boolean; why: string } {
  if (!p || !p.obs) return { ok: false, why: '阳性那一跑没有观察结果' }
  if (p.obs.outcome.kind !== 'observed') return { ok: false, why: `阳性 ${p.def.id} 不是 observed（${p.obs.outcome.kind}）` }
  const good = p.obs.requests.filter((q) => {
    if (q.rule === null || q.index === null || q.run !== p.obs!.run) return false
    const resp = p.script.script.rules[q.rule]?.responses[q.index]
    return !!resp && respStr(resp) === outcomeStr(q.outcome)
  })
  return good.length > 0 ? { ok: true, why: `阳性 ${p.def.id}：${good.length} 次请求与脚本一致` } : { ok: false, why: `阳性 ${p.def.id} 一次脚本内请求也没看到` }
}
export function zero(c: Ctx, r: RunRec, positiveRun: string, label = '零请求'): void {
  const env = c.env
  const basis = `Z1–Z6（冻结单 :1341-1350）；阳性 ${positiveRun}`
  if (!env.certified || !env.facility) return c.facility(label, 'Z1：断网认证不成立或未注入观察器')
  const want: ApiKey = r.def.apiKey ?? 'placeholder'
  if (r.obs!.armed?.api_key !== want) {
    env.questions.push(`Z2 armed.api_key 不一致（${r.def.id}）：冻结单 :1344 只写「另断」，未写归哪一档；本测试按设施故障报（见日志疑问表 Q-06）`)
    return c.facility(label, `Z2：armed.api_key=${r.obs!.armed?.api_key ?? '缺'}，本跑 apiKey=${want}`)
  }
  const p = env.runs.get(positiveRun)
  if (p?.skip || !p?.obs) return c.fixture(label, `Z3：阳性 ${positiveRun} 未起（${p?.skip ?? '无结果'}）`)
  if (p.obs.outcome.kind === 'facility') return c.facility(label, `Z5：阳性那一跑设施故障（side=positive，cause=${p.obs.outcome.cause}）`)
  const z = z3(p)
  if (!z.ok) return c.fixture(label, 'Z3：' + z.why)
  if (r.obs!.armed?.preload_sha256 !== p.obs.armed?.preload_sha256) return c.fixture(label, 'Z3：两跑 armed.preload_sha256 不同（不是同一份观察器）')
  const v = env.facility.zeroVerdict(r.obs!, p.obs)
  if (v.verdict === 'pass') return c.pass(label, 'zeroVerdict = pass；' + z.why, basis)
  if (v.verdict === 'red') return c.red(label, `zeroVerdict = red，请求 ${v.requests} 次：[${r.obs!.requests.map((q) => reqKey(r, q)).join(', ')}]`, basis)
  if (v.verdict === 'facility') return c.facility(label, `zeroVerdict = facility side=${v.side} cause=${v.cause}：${v.reason}`)
  return c.fixture(label, 'zeroVerdict = fixture：' + v.reason)
}

// ---------------- stdout（A.0.3 :50-65）----------------
export function sigmaCandidates(r: RunRec): JNode[] { return r.J.filter((o) => has(o, 'stopped')) }
/** 唯一的 Σ；没有 → 'none'；不止一个 → 'many'（GAP-07③：不判红、不判过，不另定多对象规则，:55）。 */
export function sigma(r: RunRec): JNode | 'none' | 'many' {
  const s = sigmaCandidates(r)
  return s.length === 0 ? 'none' : s.length > 1 ? 'many' : s[0]
}
const MANY = 'J 中带 stopped 的对象不止一个：本项不判红、不判过，按 GAP-07③ 报需求方，不另定多对象规则（:55）'
/** SUMMARY(X)（:55-58）。返回唯一的 Σ（供后续字段断言），否则 undefined。 */
export function summary(c: Ctx, r: RunRec, X: string): JNode | undefined {
  const s = sigma(r)
  const b1 = 'D6.y 首句；冻结单 :55'
  if (s === 'none') { c.red(`SUMMARY(${X}).1`, 'J 中没有带 stopped 的对象', b1); c.nj(`SUMMARY(${X}).2`, '没有 Σ，第 2 项无从判（第 1 项已判不过）'); return undefined }
  if (s === 'many') { c.nj(`SUMMARY(${X}).1`, MANY, b1); c.nj(`SUMMARY(${X}).2`, MANY + '；Σ 不唯一，第 2 项同样不挑对象（见日志疑问表 Q-01）'); return undefined }
  const st = get1(s, 'stopped')
  c.ok(`SUMMARY(${X}).1`, st !== undefined && st !== 'dup' && st.t === 'str' && st.v === X, `Σ.stopped = ${describe(st)}，期望 "${X}"`, b1)
  const kd = has(s, 'keywords_done'); const pf = has(s, 'profile_failed'); const pk = has(s, 'pending_keywords')
  c.ok(`SUMMARY(${X}).2 keywords_done 在场`, kd, kd ? '在场' : '缺席', 'D6.y「实际进度看汇总 JSON 的 keywords_done 与 pending_keywords」；:56')
  c.ok(`SUMMARY(${X}).2 profile_failed 在场`, pf, pf ? '在场' : '缺席', 'D6.z「汇总的 profile_failed」；:56')
  if (X === 'error' && !c.cond('GAP-07④', 'present')) {
    c.nj(`SUMMARY(${X}).2 pending_keywords 在场`, 'GAP-07④：error 收尾时该字段的在场要求缺直接出处，补齐前该子断言不判、不判红也不判过（:56）')
  } else {
    c.ok(`SUMMARY(${X}).2 pending_keywords 在场`, pk, pk ? '在场' : '缺席', 'D6.y；:56')
  }
  return s
}
/** 取唯一 Σ 供字段断言；不唯一或没有时登记不判/不过（不重复第 1 项的结论）。 */
export function sigmaFor(c: Ctx, r: RunRec, label: string): JNode | undefined {
  const s = sigma(r)
  if (s === 'none') { c.red(label, 'J 中没有 Σ（带 stopped 的对象）'); return undefined }
  if (s === 'many') { c.nj(label, MANY + '（Σ 不唯一，不挑对象；日志疑问表 Q-01）'); return undefined }
  return s
}
export function sigmaCount(c: Ctx, r: RunRec, key: string, n: number, basis: string): void {
  const s = sigmaFor(c, r, `Σ.${key} === ${n}`)
  if (!s) return
  const v = get1(s, key)
  c.ok(`Σ.${key} === ${n}`, v !== undefined && v !== 'dup' && v.t === 'num' && Number(v.raw) === n, `Σ.${key} = ${describe(v)}`, basis)
}
/** ERR-402（:58）：Σ 带 error 键；其内容按语义复核——供应商余额不足（需充值）。非空字符串本身不足以通过。 */
export function err402(c: Ctx, r: RunRec): void {
  const s = sigmaFor(c, r, 'ERR-402 error 键')
  if (!s) { c.nj('ERR-402 语义', '没有唯一 Σ，无从复核'); return }
  const e = get1(s, 'error')
  c.ok('ERR-402 error 键', e !== undefined && e !== 'dup', `Σ.error ${describe(e)}`, 'D6.y「汇总的 error」；冻结单 :58')
  if (e === undefined || e === 'dup') { c.nj('ERR-402 语义', 'Σ 没有 error 键（上一项已判不过），无从复核'); return }
  const text = e.t === 'str' ? e.v : JSON.stringify(plain(e))
  c.review('ERR-402 语义', {
    text, textRef: `${r.evidenceDir}/stdout.txt 中 Σ.error`, needsQuote: true,
    points: ['内容表达的是供应商余额不足（需充值）', '不是任务预算用尽、不是「余额买不起下一请求」的 budget 情形、不是输入问题', '非空字符串本身不足以通过'],
    pre: (t) => ['402', '余额', '充值', 'balance', 'payment', 'credit'].some((w) => t.includes(w)) ? '预筛命中（含 402/余额/充值/balance/payment/credit 之一）' : '预筛未命中（不判红，待复核）',
    basis: 'D6.y「汇总的 error 为余额不足的提示」；D6.z；skill/SKILL.md:200；tikhub.md:437',
  })
}
export const COST_FIELDS = ['requests', 'cost_estimate_usd', 'budget_usd', 'cost_status', 'cost_scope', 'cost_http_200_usd', 'cost_unknown_result_usd', 'cost_pending_usd', 'cost_basis', 'cost_price_versions', 'cost_problems']
export const COST_BASIS = '按固定公开基础价、不计优惠的估算；不是实际账单，也不保证供应商未来价格上限。'
/** COST-OUT（:59）。返回 Κ。 */
export function costOut(c: Ctx, r: RunRec): JNode | undefined {
  const objs = r.J.filter((o) => has(o, 'cost_status'))
  const basis = 'D13.q；ADR-108:27-38；README.md:181；冻结单 :59'
  if (objs.length === 0) { c.red('COST-OUT', 'J 中没有带 cost_status 的对象', basis); return undefined }
  const missing = objs.map((o) => COST_FIELDS.filter((f) => !has(o, f))).filter((m) => m.length > 0)
  const vals = objs.map((o) => COST_FIELDS.map((f) => { const v = get1(o, f); return v === undefined || v === 'dup' ? String(v) : JSON.stringify(plain(v)) }))
  const same = vals.every((v) => deepEqual(v, vals[0]))
  const K = objs[0]
  const cb = get1(K, 'cost_basis')
  const cbOk = cb !== undefined && cb !== 'dup' && cb.t === 'str' && cb.v === COST_BASIS
  c.ok('COST-OUT', missing.length === 0 && same && cbOk,
    `带 cost_status 的对象 ${objs.length} 个；缺字段 ${JSON.stringify(missing)}；两两一致=${same}；cost_basis 恰为固定串=${cbOk}`, basis + '；ADR-108:36、:52；D13.p')
  return K
}
/** 同一跑里另一条用例已判过 COST-OUT 时，取同一个 Κ（第一个带 cost_status 的对象），不重复登记 COST-OUT。 */
export function kappa(r: RunRec): JNode | undefined {
  return r.J.find((o) => has(o, 'cost_status'))
}
// 没有 Κ 时下列断言所断的值不可能成立 → 记 red（不另编 Κ）。
export function kExact(c: Ctx, K: JNode | undefined, f: string, d: string, basis?: string): void {
  if (!K) return c.red(`Κ.${f} EXACT ${d}`, '没有 Κ（J 中没有带 cost_status 的对象）', basis)
  const e = exact(get1(K, f), d)
  c.ok(`Κ.${f} EXACT ${d}`, e.ok, `Κ.${f} = ${e.got}`, basis)
}
export function kIs(c: Ctx, K: JNode | undefined, f: string, want: unknown, basis?: string): void {
  const lab = `Κ.${f} = ${JSON.stringify(want)}`
  if (!K) return c.red(lab, '没有 Κ（J 中没有带 cost_status 的对象）', basis)
  const v = get1(K, f)
  c.ok(lab, v !== undefined && v !== 'dup' && deepEqual(plain(v), want) && (typeof want !== 'number' || v.t === 'num'), `Κ.${f} = ${describe(v)}`, basis)
}
export function kIn(c: Ctx, K: JNode | undefined, f: string, allowed: unknown[], basis?: string): void {
  const lab = `Κ.${f} ∈ ${JSON.stringify(allowed)}`
  if (!K) return c.red(lab, '没有 Κ（J 中没有带 cost_status 的对象）', basis)
  const v = get1(K, f)
  c.ok(lab, v !== undefined && v !== 'dup' && allowed.some((a) => deepEqual(plain(v), a)), `Κ.${f} = ${describe(v)}`, basis)
}
export function noSummaryJson(c: Ctx, r: RunRec): void {
  const keys = ['stopped', 'keywords_done', 'pending_keywords', 'profile_failed']
  const bad = r.J.filter((o) => keys.some((k) => has(o, k)))
  c.ok('NO-SUMMARY-JSON', bad.length === 0, bad.length ? `有 ${bad.length} 个对象带汇总四键之一` : 'J 中没有对象带四键之一', 'D6.y「不出汇总 JSON」；skill/SKILL.md:196-198；冻结单 :60')
}
export function noStopped(c: Ctx, r: RunRec): void {
  const n = sigmaCandidates(r).length
  c.ok('NO-STOPPED', n === 0, `带 stopped 的对象 ${n} 个`, 'D6.y「不打出 stopped」；冻结单 :61')
}
export function notBudget(c: Ctx, r: RunRec): void {
  const bad = r.J.filter((o) => { const v = get1(o, 'stopped'); return v !== undefined && v !== 'dup' && v.t === 'str' && v.v === 'budget' })
  c.ok('NOT-BUDGET', bad.length === 0, `stopped 为 "budget" 的对象 ${bad.length} 个`, 'D13.s「不能冒充预算用尽」；冻结单 :62')
}
export function stdoutEmpty(c: Ctx, r: RunRec): void {
  c.ok('STDOUT-EMPTY', r.obs!.stdout.length === 0, `stdout ${Buffer.byteLength(r.obs!.stdout)} 字节`, 'D28.c；冻结单 :63')
}
/** PROBE-OUT（:64）。返回 Π 候选（sample 非空的对象）。 */
export function probeOut(c: Ctx, r: RunRec): JNode[] {
  const withSample = r.J.filter((o) => { const v = get1(o, 'sample'); return v !== undefined && v !== 'dup' && v.t === 'arr' })
  c.ok('PROBE-OUT', withSample.length > 0, `带 sample 数组的对象 ${withSample.length} 个`, 'P1.i；README.md:181；冻结单 :64')
  return withSample.filter((o) => { const v = get1(o, 'sample'); return v !== undefined && v !== 'dup' && v.t === 'arr' && v.items.length > 0 })
}
/** 对每个 Π 候选求值；全一致才判（:64「记其中 sample 非空的一个为 Π」，多个且结论不同时不挑，见日志疑问表 Q-02）。 */
export function onPi(c: Ctx, pis: JNode[], label: string, f: (pi: JNode) => boolean, basis: string): void {
  if (pis.length === 0) return c.red(label, '没有 sample 非空的对象（Π 不存在）', basis)
  const res = pis.map(f)
  if (res.every((x) => x === res[0])) return c.ok(label, res[0], `Π 候选 ${pis.length} 个，结论一致`, basis)
  c.nj(label, `Π 候选 ${pis.length} 个而结论不一致：冻结单 :64 未定多 Π 规则，不挑对象（日志疑问表 Q-02）`, basis)
}
/** PK-HAS / PK-LACKS（:65）。PK-HAS 机械未命中时转语义复核：若是以词以外的编码列出，按 GAP-07 报需求方、不记红。 */
export function pk(c: Ctx, r: RunRec, K: string, want: 'HAS' | 'LACKS', gate?: string): void {
  const label = `PK-${want}(${K})`
  if (gate) return c.nj(label, gate)
  const s = sigmaFor(c, r, label)
  if (!s) return
  const v = get1(s, 'pending_keywords')
  if (v === undefined || v === 'dup') return c.red(label, `Σ.pending_keywords ${describe(v)}`, 'skill/SKILL.md:84；冻结单 :65')
  const ser = JSON.stringify(plain(v))
  const lit = JSON.stringify(K)
  const hit = ser.includes(lit)
  if (want === 'LACKS') return c.ok(label, !hit, `序列化 ${ser}`, 'skill/SKILL.md:84；冻结单 :65')
  if (hit) return c.pass(label, `序列化含 ${lit}`, 'skill/SKILL.md:84；冻结单 :65')
  c.review(label, {
    text: ser, textRef: 'Σ.pending_keywords 的 JSON 序列化', needsQuote: false, keyOverride: `PK@${c.caseId}/${label}`,
    points: [`机械判法未见 ${lit}；评审确认：pending_keywords 是否以词以外的编码（如任务下标）列出`, '是 → 按 GAP-07 报需求方裁定，不记红（复核记 gap07）；否 → 记 red'],
    basis: '冻结单 :65 代理量边界',
  })
  const last = c.items[c.items.length - 1]
  const rec = c.env.reviews.get(`PK@${c.caseId}/${label}`)
  if (last.status === 'review-pending' && rec?.verdict === 'gap07' && rec.textSha256 === sha256(ser)) {
    last.status = 'not-judged'; last.detail = '复核确认以词以外的编码列出：按 GAP-07 报需求方，不记红（:65）'
  }
}

// ---------------- stderr 语义要点（A.0.4 :67-88）----------------
const lines = (t: string): string[] => t.split('\n')
const anyLine = (t: string, f: (l: string) => boolean): string[] => lines(t).filter(f)
const preHas = (...need: string[]) => (t: string): string => {
  const ls = anyLine(t, (l) => need.every((n) => l.includes(n)))
  return ls.length ? `预筛命中 ${ls.length} 行：${ls.slice(0, 3).join(' ⏎ ')}` : `预筛未命中（含 ${need.join(' 且 ')}）——不判红，待复核`
}
export function stderrOf(c: Ctx, r: RunRec): { text: string; ref: string } {
  return { text: r.stderrText, ref: `${r.evidenceDir}/stderr.txt` }
}
type Sem = { label: string; points: string[]; pre?: (t: string) => string; needsQuote: boolean; basis: string }
export const SEM = {
  PATH: (p: string, basis: string): Sem => ({ label: `PATH(${p})`, needsQuote: true, basis, points: ['stderr 指明读的是文件 p（可以是能唯一确认为同一文件的等价写法）'], pre: preHas(p) }),
  FIELD: (f: string, basis: string): Sem => ({ label: `FIELD(${f})`, needsQuote: true, basis, points: ['指出字段 ' + f], pre: preHas(f) }),
  RAW: (v: string, basis: string): Sem => ({ label: `RAW(${v})`, needsQuote: true, basis, points: ['写出读到的值，按 JSON 写法（字符串带双引号、null 写成 null、空数组写成 []）：' + v], pre: preHas(v) }),
  ABSENT: (f: string, basis: string): Sem => ({ label: `ABSENT(${f})`, needsQuote: true, basis, points: [`就字段 ${f} 写明「缺席」，且与 null、空串、字符串 "缺席" 可区分`], pre: preHas(f) }),
  ORD: (n: number, field: string, basis: string): Sem => ({
    label: `ORD(${n})`, needsQuote: true, basis,
    points: [`那一条诊断指认第 ${n} 个任务（从 1 数，同任务标签）`, '没有把同一列表里合规的任务指为不合规（D16.h）'],
    pre: (t) => { const ls = anyLine(t, (l) => l.includes(field) && new RegExp(`(^|\\D)${n}(\\D|$)`).test(l)); return ls.length ? `预筛命中 ${ls.length} 行` : `预筛未命中（与字段名 ${field} 同行出现 ${n}）——不判红，待复核` },
  }),
  NOT_TASKS_NAMED: (basis: string): Sem => ({ label: 'NOT-TASKS-NAMED', needsQuote: true, basis, points: ['tasks 本身不合规时，诊断说的是 tasks 本身，不点名任何一个任务（D16.a）'] }),
  NO_INTERNAL: (basis: string): Sem => ({
    label: 'NO-INTERNAL', needsQuote: false, basis,
    points: ['输入错误的诊断不带内部异常类名与调用堆栈（D17.k、D28.c）', '预筛命中由评审人判断是否确为内部异常类名或堆栈'],
    pre: (t) => {
      const sus = anyLine(t, (l) => /^\s*at .+\(.+:\d+:\d+\)/.test(l) || /BudgetInputError|CostLedgerUnavailable|CostError/.test(l) || /^(TypeError|SyntaxError|RangeError|ReferenceError):/.test(l))
      return sus.length ? `预筛可疑行 ${sus.length} 处：${sus.slice(0, 3).join(' ⏎ ')}` : '预筛未见可疑行（不代替复核）'
    },
  }),
  DEFAULT_US: (basis: string): Sem => ({ label: 'DEFAULT-US', needsQuote: true, basis, points: ['market 缺席时 stderr 说明市场未提供、本次采用默认 US（D17.m，不规定句子）'], pre: (t) => { const ls = anyLine(t, (l) => l.includes('US') && (l.includes('market') || l.includes('市场'))); return ls.length ? `预筛命中 ${ls.length} 行` : '预筛未命中——不判红，待复核' } }),
  NOT_DEFAULT_US: (basis: string): Sem => ({ label: 'NOT-DEFAULT-US', needsQuote: false, basis, points: ['提供了合规 market 时不得冒称采用缺省 US（D17.m）'], pre: (t) => { const ls = anyLine(t, (l) => l.includes('US') && (l.includes('market') || l.includes('市场'))); return ls.length ? `预筛：有 ${ls.length} 行同含 US 与 market/市场，请复核是否冒称缺省` : '预筛：未见同含 US 与 market/市场 的行' } }),
  DEFAULT_BUDGET: (basis: string): Sem => ({ label: 'DEFAULT-BUDGET', needsQuote: true, basis, points: ['未提供预算', '本次采用默认 $2', '它是本任务总预算（D13.w，不规定句子）'], pre: (t) => { const ls = anyLine(t, (l) => l.includes('2') && (l.includes('budget') || l.includes('预算'))); return ls.length ? `预筛命中 ${ls.length} 行` : '预筛未命中——不判红，待复核' } }),
  NOT_DEFAULT_BUDGET: (basis: string): Sem => ({ label: 'NOT-DEFAULT-BUDGET', needsQuote: false, basis, points: ['stderr 没有「未提供预算／采用默认 $2」一类说明（D13.w、D13.u）'] }),
  DEFAULT_PROBE_BUDGET: (basis: string): Sem => ({ label: 'DEFAULT-PROBE-BUDGET', needsQuote: true, basis, points: ['说明未提供预算、采用默认 $0.5', '说明其作用范围是本进程（不是任务累计预算、不落盘）'], pre: preHas('0.5') }),
  SAVE_FAIL_DIAG: (basis: string): Sem => ({ label: 'SAVE-FAIL-DIAG', needsQuote: true, basis, points: ['stderr 说明本轮发生了保存失败（费用或断点保存），并给出实际原因', '不说成预算不足／额度用尽，不说成输入问题，也不说成保存成功'] }),
  HINT: (q: number, p: number, basis: string): Sem => ({
    label: `HINT(${q}, ${p})`, needsQuote: true, basis,
    points: [`续跑提示分别报告待查关键词数 ${q} 与待补 profile 数 ${p}（任意等价写法）`, q === 0 && p === 0 ? '两者皆零：声明无新请求' : '不声明无新请求', '不把尚待查询说成查询已完成'],
    pre: preHas(String(q), String(p)),
  }),
  HINT_BLOCK: (q: number, p: number, basis: string): Sem => ({
    label: `HINT-BLOCK(${q}, ${p})`, needsQuote: true, basis,
    points: [`续跑提示分别报告待查关键词数 ${q} 与待补 profile 数 ${p}`, '不声明无新请求', '不把尚待查询说成查询已完成', '说明阻止继续付费的原因', '不承诺直接续跑即可花钱'],
    pre: preHas(String(q), String(p)),
  }),
  NOT_COMPLETED_CLAIM: (K: string, basis: string): Sem => ({ label: `NOT-COMPLETED-CLAIM(${K})`, needsQuote: false, basis, points: [`stderr 不把关键词 ${K} 说成已查询或查询已完成（D6.r）`] }),
  COST_DIAG: (points: string[], names: string[], basis: string): Sem => ({
    label: 'COST-DIAG', needsQuote: true, basis,
    points: [...points, '不说成预算用尽 / 额度不足'],
    pre: (t) => { const ls = anyLine(t, (l) => names.some((n) => l.includes(n))); return ls.length ? `预筛命中 ${ls.length} 行（含 ${names.join('/')} 之一）` : `预筛未命中（含 ${names.join('/')} 之一）——不判红，待复核` },
  }),
  CUSTOM: (label: string, points: string[], basis: string, needsQuote: boolean, pre?: (t: string) => string): Sem => ({ label, points, basis, needsQuote, pre }),
}
export function sem(c: Ctx, r: RunRec, s: Sem): void {
  const e = stderrOf(c, r)
  c.review(s.label, { text: e.text, textRef: e.ref, points: s.points, pre: s.pre, needsQuote: s.needsQuote, basis: s.basis })
}
/** SAVED-CLAIM / NO-SAVED-CLAIM（:83-84）：先看 stderr，也看 stdout 汇总文字字段——复核文本为两者拼接。 */
export function semBoth(c: Ctx, r: RunRec, label: 'SAVED-CLAIM' | 'NO-SAVED-CLAIM', basis: string): void {
  const text = 'STDERR\n' + r.stderrText + '\nSTDOUT\n' + r.obs!.stdout
  const points = label === 'SAVED-CLAIM'
    ? ['输出声明断点（进度与预算状态）已保存；先看 stderr，声明只出现在 stdout 汇总的文字字段里也算（P3.d）']
    : ['stderr 与 stdout 都不声称断点已保存', '不声称可以从该断点继续或追加预算续跑', '不把本轮说成成功']
  c.review(label, { text, textRef: `${r.evidenceDir}/stderr.txt + stdout.txt`, points, needsQuote: label === 'SAVED-CLAIM', basis })
}

// ---------------- 文件（A.0.1 :23-38）----------------
export function exitIs(c: Ctx, r: RunRec, n: number, basis: string): void {
  c.ok(`退出码 = ${n}`, r.obs!.status === n, `退出码 ${r.obs!.status}（signal ${r.obs!.signal}）`, basis)
}
export function treeNoDirC(c: Ctx, r: RunRec, basis: string): void { const t = treeNoDir(r.before, r.after!); c.ok('TREE-NODIR', t.ok, t.diff.join('；') || '无新增目录与 task.json', basis) }
export function treeNoTaskC(c: Ctx, r: RunRec, basis: string, label = 'TREE-NOTASK'): void { const t = treeNoTask(r.before, r.after!); c.ok(label, t.ok, t.diff.join('；') || '无新增 task.json', basis) }
export function treeSameC(c: Ctx, r: RunRec, basis: string): void { const t = treeSame(r.before, r.after!); c.ok('TREE-SAME', t.ok, t.diff.join('；') || '路径与哈希前后完全相同', basis) }
export function bytesC(c: Ctx, r: RunRec, rel: string, basis: string): void { const b = bytesSame(r.before, r.after!, rel); c.ok(`BYTES(${rel})`, b.ok, b.detail, basis) }

export function readRel(r: RunRec, rel: string): string | null {
  const p = join(r.cwd, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}
/** 运行后唯一新增的 task.json（collect 新建）。 */
export function newTask(r: RunRec): { rel?: string; node?: JNode; problem?: string } {
  const news = newFilesNamed(r.before, r.after!, 'task.json')
  if (news.length !== 1) return { problem: `新增 task.json ${news.length} 个：${news.join('，')}` }
  const text = readRel(r, news[0])
  const node = text === null ? null : parseDocument(text)
  return node ? { rel: news[0], node } : { rel: news[0], problem: 'task.json 读不出或不是合法 JSON' }
}
export function taskAfter(r: RunRec): { node?: JNode; problem?: string; text?: string } {
  const text = r.def.taskRel ? readRel(r, r.def.taskRel) : null
  if (text === null) return { problem: '运行后 task.json 不存在' }
  const node = parseDocument(text)
  return node ? { node, text } : { problem: 'task.json 不是合法 JSON', text }
}
export function taskBefore(r: RunRec): JNode {
  const n = parseDocument(r.def.files[r.def.taskRel!])
  if (!n) throw new Error('夹具 task.json 不是合法 JSON：' + r.def.id)
  return n
}
/** 三字段期望（:32-35，FK）：每条用例逐项写出，不靠「同上」继承。 */
export type FKExp = { absent: true } | { sameAsBefore: true } | { eq: unknown } | { exact: string }
export function fk(c: Ctx, r: RunRec, exp: { cost_ledger: FKExp; requests: FKExp; budget_usd: FKExp }, basis: string): void {
  const a = taskAfter(r)
  const b = taskBefore(r)
  for (const key of ['cost_ledger', 'requests', 'budget_usd'] as const) {
    const e = exp[key]
    const label = `FK.${key}`
    if (!a.node) { c.red(label, a.problem ?? '读不出', basis); continue }
    const v = get1(a.node, key)
    if ('absent' in e) { c.ok(label + ' 仍缺席', v === undefined, `运行后 ${describe(v)}`, basis); continue }
    if (v === undefined || v === 'dup') { c.red(label, `运行后 ${describe(v)}`, basis); continue }
    if ('sameAsBefore' in e) {
      const bv = get1(b, key)
      c.ok(label + ' 与原值深度相等', bv !== undefined && bv !== 'dup' && deepEqual(plain(v), plain(bv)), `运行后 ${describe(v)}`, basis)
    } else if ('eq' in e) {
      c.ok(`${label} === ${JSON.stringify(e.eq)}`, deepEqual(plain(v), e.eq) && (typeof e.eq !== 'number' || v.t === 'num'), `运行后 ${describe(v)}`, basis)
    } else {
      const x = exact(v, e.exact)
      c.ok(`${label} EXACT ${e.exact}`, x.ok, `运行后 token ${x.got}（十进制精确比较，不经 Number；D13.a、D13.i）`, basis)
    }
  }
}
/** LC（:37）：entries 各项 http_200_count 之和 H、unknown_result_count 之和 U、Σ(h×unit)、pending 有无。 */
export function lc(n: JNode): { H: number; U: number; S: number; pending: boolean; entries: JNode[]; problem?: string } {
  const led = get1(n, 'cost_ledger')
  if (led === undefined || led === 'dup' || led.t !== 'obj') return { H: 0, U: 0, S: 0, pending: false, entries: [], problem: `cost_ledger ${describe(led)}` }
  const en = get1(led, 'entries')
  if (en === undefined || en === 'dup' || en.t !== 'arr') return { H: 0, U: 0, S: 0, pending: has(led, 'pending'), entries: [], problem: `entries ${describe(en)}` }
  let H = 0, U = 0, S = 0
  for (const e of en.items) {
    const h = get1(e, 'http_200_count'), u = get1(e, 'unknown_result_count'), p = get1(e, 'unit_micro_usd')
    if ([h, u, p].some((x) => x === undefined || x === 'dup' || (x as JNode).t !== 'num')) return { H, U, S, pending: has(led, 'pending'), entries: en.items, problem: 'entries 项缺计数或单价' }
    H += Number((h as { raw: string }).raw); U += Number((u as { raw: string }).raw); S += Number((h as { raw: string }).raw) * Number((p as { raw: string }).raw)
  }
  return { H, U, S, pending: has(led, 'pending'), entries: en.items }
}
export function field(n: JNode | undefined, path: string[]): JNode | undefined | 'dup' {
  let cur: JNode | undefined | 'dup' = n
  for (const k of path) { if (cur === undefined || cur === 'dup') return cur; cur = get1(cur, k) }
  return cur
}
export function isNum(v: JNode | undefined | 'dup', n: number): boolean {
  return v !== undefined && v !== 'dup' && v.t === 'num' && Number(v.raw) === n
}
export function arrHas(v: JNode | undefined | 'dup', n: number): boolean {
  return v !== undefined && v !== 'dup' && v.t === 'arr' && v.items.some((x) => x.t === 'num' && Number(x.raw) === n)
}
export { getAll }
