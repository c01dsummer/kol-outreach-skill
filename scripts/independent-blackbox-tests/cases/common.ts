// KOL-21 C1 · 各组共用的用例片段（G1 统一 expected :287-292 等）
import type { Ctx, RunRec } from '../lib/judge.ts'
import * as J from '../lib/judge.ts'
import { get1, has, describe, plain, deepEqual, parseDocument, decEq, type JNode } from '../lib/json.ts'
import { newDirs } from '../lib/fsnap.ts'

export const SP = 'pack/30-frozen-spec.md'

/** REJ-NEW（:289）：退出码 2；NO-SUMMARY-JSON；NO-STOPPED；零请求（S-TRAP，阳性 G2-00）；TREE-NODIR；BYTES(配置文件)。G1-16 把 TREE-NODIR 加严为 TREE-SAME。 */
export function rejNew(c: Ctx, r: RunRec, o: { sameTree?: boolean } = {}): void {
  const b = 'D16.j、D17.h；D6.y、skill/SKILL.md:197；README.md:183、:185（冻结单 :289）'
  J.exitIs(c, r, 2, b)
  J.noSummaryJson(c, r)
  J.noStopped(c, r)
  J.zero(c, r, 'G2-00')
  if (o.sameTree) J.treeSameC(c, r, 'D28.b「不写任何文件或跨任务记忆，配置文件保持原字节」（:289）')
  else J.treeNoDirC(c, r, 'D16.j、D17.h「新建不留下任务目录」（:289）')
  J.bytesC(c, r, 'config.json', b)
}
/** REJ-PROBE（:290）：退出码 2；零请求（S-TRAP，阳性 G1-01 = G4-03）。不断 stdout（只有 D28.c 另要 STDOUT-EMPTY）。 */
export function rejProbe(c: Ctx, r: RunRec): void {
  J.exitIs(c, r, 2, 'D16.l、D17.j、D28.c（冻结单 :290）')
  J.zero(c, r, 'G1-01')
}
/** REJ-RESUME（:291）：退出码 2；NO-SUMMARY-JSON；NO-STOPPED；零请求（阳性 G2-00）；BYTES(task.json)。 */
export function rejResume(c: Ctx, r: RunRec): void {
  const b = 'D19.e「保持原字节」、D16.j「原样不动」、D17.h「逐字不变」；D6.y、skill/SKILL.md:197（冻结单 :291）'
  J.exitIs(c, r, 2, b)
  J.noSummaryJson(c, r)
  J.noStopped(c, r)
  J.zero(c, r, 'G2-00')
  J.bytesC(c, r, r.def.taskRel!, b)
}
/** PATH(p)：p 用本跑实际绝对路径作预筛；标签用 <RUN> 写法，使复核记录的键不随运行目录变化。 */
export function pathSem(c: Ctx, r: RunRec, which: 'config' | 'probe' | 'task', basis: string): void {
  const rel = which === 'config' ? 'config.json' : which === 'probe' ? 'probe.json' : r.def.taskRel!
  const shown = which === 'task' ? 'PATH(<任务目录>/task.json)' : `PATH(<RUN>/cwd/${rel})`
  J.sem(c, r, { ...J.SEM.PATH(`${r.cwd}/${rel}`, basis), label: shown })
}

/** 对一个 JSON 节点按标签逐条判（节点读不出时每条都记 red，并写明原因）。 */
export function onNode(c: Ctx, node: JNode | undefined, problem: string | undefined, checks: Array<[string, (n: JNode) => [boolean, string], string]>): void {
  for (const [label, f, basis] of checks) {
    if (!node) { c.red(label, problem ?? '读不出', basis); continue }
    const [ok, detail] = f(node)
    c.ok(label, ok, detail, basis)
  }
}
export const fieldEq = (path: string[], want: unknown) => (n: JNode): [boolean, string] => {
  const v = J.field(n, path)
  const ok = v !== undefined && v !== 'dup' && deepEqual(plain(v), want) && (typeof want !== 'number' || v.t === 'num')
  return [ok, `${path.join('.')} = ${describe(v)}`]
}
export const exactAt = (path: string[], d: string) => (n: JNode): [boolean, string] => {
  const v = J.field(n, path)
  return [v !== undefined && v !== 'dup' && v.t === 'num' && decEq(v.raw, d), `${path.join('.')} = ${describe(v)}（十进制精确比较）`]
}
export const intEq = (path: string[], k: number) => (n: JNode): [boolean, string] => {
  const v = J.field(n, path)
  return [v !== undefined && v !== 'dup' && v.t === 'num' && /^-?\d+$/.test(v.raw) && Number(v.raw) === k, `${path.join('.')} = ${describe(v)}`]
}
export const noPending = (n: JNode): [boolean, string] => {
  const led = get1(n, 'cost_ledger')
  return [led !== undefined && led !== 'dup' && led.t === 'obj' && !has(led, 'pending'), led === undefined ? 'cost_ledger 缺席' : `pending ${has(led as JNode, 'pending') ? '在' : '无'}`]
}
export const lcIs = (H: number | null, U: number | null, S?: number) => (n: JNode): [boolean, string] => {
  const l = J.lc(n)
  if (l.problem) return [false, l.problem]
  const ok = (H === null || l.H === H) && (U === null || l.U === U) && (S === undefined || l.S === S)
  return [ok, `LC：H=${l.H} U=${l.U} Σ(h×unit)=${l.S} pending=${l.pending}`]
}
export const doneLacks = (k: number) => (n: JNode): [boolean, string] => {
  const d = get1(n, 'done')
  return [!J.arrHas(d, k), `done = ${describe(d)}`]
}
export const doneHas = (...ks: number[]) => (n: JNode): [boolean, string] => {
  const d = get1(n, 'done')
  return [ks.every((k) => J.arrHas(d, k)), `done = ${describe(d)}`]
}
export const doneEmpty = (n: JNode): [boolean, string] => {
  const d = get1(n, 'done')
  return [d !== undefined && d !== 'dup' && d.t === 'arr' && d.items.length === 0, `done = ${describe(d)}`]
}
export const tasksEqInput = (cfgText: string) => (n: JNode): [boolean, string] => {
  const cfg = parseDocument(cfgText)
  const want = cfg ? get1(cfg, 'tasks') : undefined
  const v = get1(n, 'tasks')
  const ok = !!want && want !== 'dup' && v !== undefined && v !== 'dup' && deepEqual(plain(v), plain(want))
  return [ok, `tasks = ${describe(v)}`]
}

/** collect 新建：运行后唯一新增的 task.json 及其目录（:347「恰好新增一个含 task.json 的目录」）。 */
export function newTaskDir(r: RunRec): { rel?: string; dir?: string; node?: JNode; problem?: string; dirIsNew: boolean } {
  const t = J.newTask(r)
  const dir = t.rel ? t.rel.split('/').slice(0, -1).join('/') : undefined
  const dirIsNew = !!dir && newDirs(r.before, r.after!).includes(dir)
  return { ...t, dir, dirIsNew }
}
/** 读 G1-01 系列 Π.sample 的项。 */
export function sampleItems(pi: JNode): JNode[] {
  const s = get1(pi, 'sample')
  return s !== undefined && s !== 'dup' && s.t === 'arr' ? s.items : []
}
export function strOf(v: JNode | undefined | 'dup'): string | undefined {
  return v !== undefined && v !== 'dup' && v.t === 'str' ? v.v : undefined
}
export function is200(q: { outcome: unknown }): boolean {
  const o = q.outcome as { status?: number }
  return o.status === 200
}
