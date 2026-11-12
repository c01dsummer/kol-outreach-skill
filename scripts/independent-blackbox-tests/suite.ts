// KOL-21 C1 · 测试套件入口（整合方在测试之外接入真实调用面后调用 runSuite）
//
// 需要外部提供（本文件不 import 任何实现模块；见 out/tests/INTEGRATION.md）：
//   facility        观察器公开调用面 certifyIsolation / runObserved / zeroVerdict / readEvents（ADR-70:3276-3324，Zero 取修订版）
//   sortForOutput   G5 被测函数（scripts/lib/rows.ts:170 的导出签名）
//   conditions      GAP / E 前提的补齐登记（没有登记 = 依赖它的断言不判）
//   e2 / e3         E-2 / E-3 契约公开后的接入插槽
//   reviews         语义复核记录（stderr 等文字断言；绑定本跑文本 SHA-256 与原文行）
//   workRoot        一个已存在的空目录（绝对路径）；每跑一个全新 <RUN> = workRoot/runs/<跑号>
//
// 判定顺序（冻结单 pack/30-frozen-spec.md:11-17、:274-279、:1341-1350）：
//   Z1 认证 → 每跑 observed 闸门 → 用例的基线 / 资格阳性 → 用例自己的断言 → 汇总（facility、fixture、red 分开报）。
import { mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import type { E2Adapter, E3Adapter, ObserverFacility, Resolution, ReviewRecord, SortForOutput, ConditionId, Isolation } from './lib/contract.ts'
import { Ctx, type CaseDef, type CaseResult, type Env, type Item, type RunDef, type RunRec, type Verdict } from './lib/judge.ts'
import { scanJ } from './lib/json.ts'
import { snap, newFilesNamed, sha256 } from './lib/fsnap.ts'
import { S } from './fixtures.ts'
import { RUNS } from './runs.ts'
import { G1 } from './cases/minimal-input-and-field-rejects.ts'
import { G2 } from './cases/bad-cost-ledger-samples.ts'
import { G3 } from './cases/collect-wrap-up.ts'
import { G4 } from './cases/observer-and-zero-reservation.ts'
import { G56 } from './cases/output-sort-and-roster.ts'

export const CASES: CaseDef[] = [...G1, ...G2, ...G3, ...G4, ...G56]
export { RUNS }

export interface SuiteOptions {
  workRoot: string
  facility?: ObserverFacility
  sortForOutput?: SortForOutput
  creatorCheck?: (c: unknown) => string[]
  conditions?: Partial<Record<ConditionId, Resolution>>
  reviews?: ReviewRecord[]
  e2?: E2Adapter
  e3?: E3Adapter
  only?: string[]
  reportPath?: string
}
export interface Report {
  frozen: Record<string, Record<string, number>>
  verdicts: Record<string, number>
  items: Record<string, number>
  cases: CaseResult[]
  runs: Array<{ id: string; skip?: string; outcome?: string; status?: number | null; stderrSha256?: string; evidenceDir: string }>
  questions: string[]
  note: string
}
const POSITIVES = ['G2-00', 'G1-01', 'G4-04']

function execRun(env: Env & { isolation?: Isolation }, def: RunDef, o: SuiteOptions): RunRec {
  const runDir = join(o.workRoot, 'runs', def.id)
  const cwd = join(runDir, 'cwd')
  const evidenceDir = join(runDir, 'evidence')            // 事先不存在、上一级已存在（ADR-70:3234；冻结单 :25）
  mkdirSync(cwd, { recursive: true })
  for (const [rel, text] of Object.entries(def.files)) {   // 原字节写盘，不经 JSON 序列化器（:26）
    mkdirSync(dirname(join(cwd, rel)), { recursive: true })
    writeFileSync(join(cwd, rel), text, 'utf8')
  }
  let extra: string[] = []
  const e2On = !!def.e2 && !!o.e2 && env.conditions['E-2']?.resolved === true
  if (def.e2 && e2On) {
    const armed = o.e2!.arm(def.e2.point, def.e2.k, { cwd, evidenceDir })
    extra = armed.extraArgs ?? []
    for (const [rel, text] of Object.entries(armed.files ?? {})) { mkdirSync(dirname(join(cwd, rel)), { recursive: true }); writeFileSync(join(cwd, rel), text, 'utf8') }
  }
  const before = snap(cwd)
  const rec: RunRec = { def, script: S[def.script](), runDir, cwd, evidenceDir, before, after: before, J: [], stderrText: '' }
  if (!o.facility) { rec.skip = 'facility-missing'; return rec }
  if (!env.certified || !env.isolation) { rec.skip = 'isolation'; return rec }
  if (def.e2 && !e2On) { rec.skip = 'E-2'; return rec }
  const obs = o.facility.runObserved({
    isolation: env.isolation, entry: def.entry, args: [...def.args(cwd), ...extra], cwd,
    script: rec.script.script, evidenceDir, apiKey: def.apiKey ?? 'placeholder',
  })
  rec.obs = obs
  rec.after = snap(cwd)
  rec.J = scanJ(obs.stdout)
  rec.stderrText = o.e3?.stripFromStderr ? o.e3.stripFromStderr(obs.stderr) : obs.stderr
  if (def.e2 && o.e2) rec.e2Hits = o.e2.hits(obs)
  return rec
}

/** 用例汇总（:13-17）：red 优先，但 200 正文的跑须先排除 GAP-25（:278）；资格待定时 red 降为待定。 */
function aggregate(env: Env, def: CaseDef, items: Item[], qualPending: boolean, notes: string[]): Verdict {
  if (items.length === 0) return 'not-judged'
  const has = (s: string) => items.some((i) => i.status === s)
  if (has('red')) {
    for (const id of def.runs) {
      const r = env.runs.get(id)
      if (!r || !r.obs || r.obs.outcome.kind !== 'observed' || !r.script.uses200) continue
      const rev = env.reviews.get(`GAP-25@${id}`)
      const bound = rev && rev.textSha256 === sha256(r.stderrText)
      if (bound && rev!.verdict === 'parse-failure') { notes.push(`${id}：入口把夹具 200 正文当解析失败 → 夹具失格并报 GAP-25（:278）`); return 'fixture' }
      if (!(bound && rev!.verdict === 'no-parse-failure')) { notes.push(`${id} 用了 200 正文：红待 GAP-25 排查（复核 stderr 是否报响应结构/解析问题）后才定（:278）`); return 'review-pending' }
    }
    if (qualPending) { notes.push('资格待定：红暂不定'); return 'review-pending' }
    return 'red'
  }
  if (has('fixture')) return 'fixture'
  if (has('facility')) return 'facility'
  if (has('review-pending')) return 'review-pending'
  if (items.every((i) => i.status === 'not-judged')) return 'not-judged'
  return 'pass'
}

export function runSuite(o: SuiteOptions): Report {
  if (!isAbsolute(o.workRoot) || !existsSync(o.workRoot) || readdirSync(o.workRoot).length > 0) throw new Error('workRoot 必须是已存在的空目录（绝对路径）')
  const results = new Map<string, CaseResult>()
  const env: Env & { isolation?: Isolation } = {
    facility: o.facility, certified: false, certNote: '未注入观察器', runs: new Map(),
    reviews: new Map((o.reviews ?? []).map((r) => [r.key, r])), conditions: o.conditions ?? {},
    e2: o.e2, e3: o.e3, sort: o.sortForOutput, creatorCheck: o.creatorCheck, questions: [],
    result: (id: string) => judgeCase(id),
  }
  // G4-01 / Z1：整个测试进程只认证一次（:1343）
  if (o.facility) {
    mkdirSync(join(o.workRoot, 'session'), { recursive: true })
    const cert = o.facility.certifyIsolation({ evidenceDir: join(o.workRoot, 'session', 'isolation') })
    env.certified = cert.certified === true
    env.certNote = `certified=${cert.certified}；problems=${JSON.stringify(cert.problems)}`
    if (cert.certified === true) env.isolation = cert.isolation
  }
  const selected = o.only ? CASES.filter((c) => o.only!.includes(c.id)) : CASES
  const need = new Set<string>(POSITIVES)
  const addCase = (id: string, seen = new Set<string>()): void => {
    if (seen.has(id)) return
    seen.add(id)
    const c = CASES.find((x) => x.id === id)
    if (!c) return
    c.runs.forEach((r) => need.add(r))
    for (const d of c.deps ?? []) { need.add(d.of); addCase(d.of, seen) }
  }
  selected.forEach((c) => addCase(c.id))
  for (const def of RUNS) if (need.has(def.id)) env.runs.set(def.id, execRun(env, def, o))

  function judgeCase(id: string): CaseResult {
    const hit = results.get(id); if (hit) return hit
    const def = CASES.find((x) => x.id === id)
    if (!def) throw new Error('未登记的用例 ' + id)
    const base = { id, group: def.group, frozen: def.frozen, spec: def.spec }
    if (def.frozen === '不覆盖') {
      const r: CaseResult = { ...base, verdict: 'not-covered', items: [], notes: [def.notCovered ?? ''] }
      results.set(id, r); return r
    }
    results.set(id, { ...base, verdict: 'review-pending', items: [], notes: ['（计算中）'] }) // 防环
    const c = new Ctx(id, env)
    let blocked = false
    for (const d of def.deps ?? []) {
      const label = `资格：${d.kind === 'semantic' ? '基线/资格阳性' : d.kind === 'accepted' ? 'G1-02 被接受' : 'G3-04R 退 3'} ${d.of}`
      if (d.kind === 'semantic') {
        const v = judgeCase(d.of).verdict
        if (v === 'pass') c.pass(label, `${d.of} 已判断言全部成立（附条件子断言不判，不计过也不计不过，:801）；${d.why}`)
        else if (v === 'review-pending') { c.pending(label, `${d.of} 尚待复核；${d.why}`); c.qualPending = true }
        else { c.fixture(label, `${d.of} 未过（${v}）→ 本例记夹具失格（A.0.10 第 1、2 条）；${d.why}`); blocked = true }
      } else {
        const r = env.runs.get(d.of)
        const obs = r?.obs && r.obs.outcome.kind === 'observed' ? r.obs : undefined
        const ok = d.kind === 'accepted'
          ? !!obs && obs.status !== 2 && newFilesNamed(r!.before, r!.after!, 'task.json').length === 1
          : !!obs && obs.status === 3
        if (ok) c.pass(label, d.why)
        else { c.fixture(label, `${d.why}——不成立（${r?.skip ?? r?.obs?.outcome.kind ?? '未起'}，退出码 ${r?.obs?.status ?? '-'}）`); blocked = true }
      }
    }
    if (!blocked && def.judge) {
      try { def.judge(c) } catch (e) {
        c.prefix = ''
        c.items.push({ label: '测试代码异常', status: 'fixture', detail: String((e as Error)?.stack ?? e) })
        env.questions.push(`${id}：测试代码异常（不是产品结论）：${String(e)}`)
      }
    }
    const verdict = aggregate(env, def, c.items, c.qualPending, c.notes)
    const r: CaseResult = { ...base, verdict, items: c.items, notes: c.notes }
    results.set(id, r)
    return r
  }

  const cases = selected.map((c) => judgeCase(c.id))
  const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})
  const frozen: Record<string, Record<string, number>> = {}
  for (const c of selected) { frozen[c.group] ??= {}; frozen[c.group][c.frozen] = (frozen[c.group][c.frozen] ?? 0) + 1 }
  const report: Report = {
    frozen,
    verdicts: count(cases.map((c) => c.verdict)),
    items: count(cases.flatMap((c) => c.items.map((i) => i.status))),
    cases,
    runs: [...env.runs.values()].map((r) => ({ id: r.def.id, skip: r.skip, outcome: r.obs?.outcome.kind, status: r.obs?.status, stderrSha256: r.obs ? sha256(r.stderrText) : undefined, evidenceDir: r.evidenceDir })),
    questions: [...new Set(env.questions)],
    note: 'frozen 是冻结单状态对账，不是运行通过统计；facility / fixture / not-judged / review-pending 都不算过，也不算红。',
  }
  if (o.reportPath) writeFileSync(o.reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
  return report
}
