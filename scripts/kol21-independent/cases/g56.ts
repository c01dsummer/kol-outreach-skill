// KOL-21 C1 · G5 排序函数层（冻结单 pack/30-frozen-spec.md:1416-1463）与 G6 名单层（:1467-1559）；各 3 例，均附条件（GAP-18）
// G5：只按导出签名 sortForOutput(creators: Creator[]): Creator[]（scripts/lib/rows.ts:170）调用整合方传入的函数，不 import、不自写排序实现。
// G6：真实 render 入口；kol.csv 与 kol.xlsx 两种格式各自独立解析（lib/table.ts），不导入实现里的 writer/reader。
import type { CaseDef, Ctx, RunRec } from '../lib/judge.ts'
import * as J from '../lib/judge.ts'
import { G5, G5_II, G5_N7, G6_K, G6_K3, G6_U, G6_U3, DIR } from '../fixtures.ts'
import { deepEqual, decEq } from '../lib/json.ts'
import { parseCsv, col, readXlsx, xcol, type XSheet } from '../lib/table.ts'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SP } from './common.ts'

const GAP18 = 'GAP-18：完整 Creator 声明（tier/score/fit/effective_priority 的字段名与其余必填字段）或公开的夹具资格检查未入包（:1586）；补齐前不判，不编造字段'

// ---------------- G5 ----------------
type Obj = Record<string, unknown>
const parse = (s: string): Obj => JSON.parse(s) as Obj // 只用于把冻结单的 G5 候选原文变成调用参数（候选本身无重复键）
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
interface Call { label: string; input: Obj[]; snapshot: Obj[]; out?: unknown; threw?: string; want: string[] }
const memo = new WeakMap<object, Call[]>()
/** G5-01、G5-02 的全部调用（两组身份 × 6 排列；C-N7 组 × 6 排列）；G5-03 对同样这些调用另断。只算一次。 */
function g5Calls(c: Ctx): Call[] {
  const hit = memo.get(c.env); if (hit) return hit
  const groups: Array<[string, string[], string[], string[]]> = [
    ['G5-01 组I', ['C-Z', 'C-U', 'C-N'], [G5['C-Z'], G5['C-U'], G5['C-N']], ['c_known_g5', 'b_unqueried_g5', 'a_zero_g5']],
    ['G5-01 组II', ["C-Z'", "C-U'", "C-N'"], [G5_II["C-Z'"], G5_II["C-U'"], G5_II["C-N'"]], ['a_known_g5', 'c_unqueried_g5', 'b_zero_g5']],
    ['G5-02 组I+N7', ['C-Z', 'C-U', 'C-N7'], [G5['C-Z'], G5['C-U'], G5_N7], ['c_known_g5', 'b_unqueried_g5', 'a_zero_g5']],
  ]
  const calls: Call[] = []
  for (const [g, names, srcs, want] of groups) {
    for (const p of PERMS) {
      const input = p.map((i) => parse(srcs[i]))                   // 每次用新的深拷贝（:1445）
      const snapshot = p.map((i) => parse(srcs[i]))                // 调用前的深拷贝 S（:1461）
      const call: Call = { label: `${g} [${p.map((i) => names[i]).join(',')}]`, input, snapshot, want }
      try { call.out = c.env.sort!(input) } catch (e) { call.threw = String(e) }
      calls.push(call)
    }
  }
  memo.set(c.env, calls)
  return calls
}
function g5Gate(c: Ctx, what: string): boolean {
  if (!c.cond('GAP-18')) { c.nj(what, GAP18); return false }
  if (!c.env.sort) { c.nj(what, '未注入被测函数 sortForOutput（SuiteOptions.sortForOutput），不自写排序实现代替'); return false }
  if (c.env.creatorCheck) {
    const probs = [...Object.values(G5), ...Object.values(G5_II), G5_N7].flatMap((s) => c.env.creatorCheck!(parse(s)))
    if (probs.length) { c.fixture(what, '公开夹具资格检查不过：' + probs.join('；')); return false }
  }
  return true
}
const handles = (out: unknown): unknown[] => (Array.isArray(out) ? out.map((x) => (x as Obj)?.handle) : [])
function orderCase(c: Ctx, prefix: string, basis: string): void {
  for (const call of g5Calls(c).filter((x) => x.label.startsWith(prefix))) {
    if (call.threw) { c.red(`${call.label} 返回长度 3 且顺序为 ${call.want.join(' → ')}`, '调用抛错：' + call.threw, basis); continue }
    const h = handles(call.out)
    c.ok(`${call.label} 返回长度 3 且顺序为 ${call.want.join(' → ')}`, Array.isArray(call.out) && call.out.length === 3 && deepEqual(h, call.want), `返回 ${JSON.stringify(h)}`, basis)
  }
}

// ---------------- G6 ----------------
const KU = (id: string): { K: string; U: string; list: [string, string] } =>
  id === 'G6-03' ? { K: 'aa_known_g6', U: 'zz_unqueried_g6', list: [G6_U3, G6_K3] }
    : id === 'G6-02' ? { K: 'zz_known_g6', U: 'aa_unqueried_g6', list: [G6_K, G6_U] }
      : { K: 'zz_known_g6', U: 'aa_unqueried_g6', list: [G6_U, G6_K] }
function g6(c: Ctx, id: string): void {
  if (!c.cond('GAP-18')) return c.nj('Q1–Q5 资格与名单层排序', GAP18 + '；附带断言另受 GAP-20 影响（:1588）')
  if (c.env.creatorCheck) {
    const probs = KU(id).list.flatMap((s) => c.env.creatorCheck!(JSON.parse(s)))
    if (probs.length) return c.fixture('名单记录是合法 Creator', '公开夹具资格检查不过：' + probs.join('；'))
  }
  const r = c.observed(id); if (!r) return
  const { K, U } = KU(id)
  const dir = join(r.cwd, DIR['F-G6'])
  // Q1：render 退出码 0；observed；零请求（阳性 G4-04）
  if (r.obs!.status !== 0) return c.fixture('Q1', `render 退出码 ${r.obs!.status}（资格不成立，记夹具失格，:1526）`)
  J.zero(c, r, 'G4-04', 'Q1 零请求')
  const q1 = c.items[c.items.length - 1]
  if (q1.status !== 'pass') return c.fixture('Q1', 'Q1 零请求未判 pass：' + (q1.detail ?? ''))
  // Q2：kol.csv 恰有 2 行数据，handle 列恰为 {U, K}
  const csvPath = join(dir, 'kol.csv')
  if (!existsSync(csvPath)) return c.fixture('Q2', 'kol.csv 不存在')
  const t = parseCsv(readFileSync(csvPath, 'utf8'))
  const ih = col(t, 'handle'), it = col(t, 'tier'), is = col(t, 'score'), ie = col(t, 'effective_priority'), ifo = col(t, 'followers')
  const hs = t.rows.map((row) => row[ih])
  if (!hs.includes(U)) return c.fixture('Q2', `交付名单缺 ${U}；另报「可能违反 P1.g：粉丝数未查询的人应放行」（P1.g；semantic-fit.md:48）`)
  if (t.rows.length !== 2 || !deepEqual([...hs].sort(), [K, U].sort())) return c.fixture('Q2', `kol.csv 数据行 ${t.rows.length}，handle ${JSON.stringify(hs)}`)
  c.pass('Q2', `kol.csv 2 行，handle = {${U}, ${K}}`)
  // Q3：两行 tier 都为 B、score 相同、effective_priority 都为待核实（:1528；同 tier 写法逐字比较，不 trim）
  const rowOf = (h: string) => t.rows[hs.indexOf(h)]
  const [rk, ru] = [rowOf(K), rowOf(U)]
  const q3 = rk[it] === 'B' && ru[it] === 'B' && rk[is] === ru[is] && rk[ie] === '待核实' && ru[ie] === '待核实'
  if (!q3) return c.fixture('Q3', `tier ${rk[it]}/${ru[it]} score ${rk[is]}/${ru[is]} effective_priority ${JSON.stringify([rk[ie], ru[ie]])}`)
  c.pass('Q3', '两行 tier B、score 相同、effective_priority 待核实（D21.d、D21.p；D25.a、D25.b、D25×P1（req:1857）、U9.h、U9.j、output-format.md:140、:150）')
  // Q4：两行 score 都为 20（同分手算 :1508-1520）
  if (!(rk[is] === '20' && ru[is] === '20')) return c.fixture('Q4', `score ${rk[is]}/${ru[is]}；另把「CSV 分数与公开加分规则手算不符」报给需求方`)
  c.pass('Q4', '两行 score 都为 20（semantic-fit.md:21-28 手算）')
  // Q5：kol.xlsx 恰有三张分层表；两个 handle 在同一张表里，另两张没有数据行（按内容定位，表名格式不断，GAP-20）
  const xp = join(dir, 'kol.xlsx')
  let sheets: XSheet[]
  try { sheets = readXlsx(readFileSync(xp)) } catch (e) { return c.fixture('Q5', 'kol.xlsx 读不出：' + String(e)) }
  const withRows = sheets.filter((s) => s.rows.length > 0)
  const sh = withRows[0]
  const xh = sh ? xcol(sh, 'handle') : -1
  const xhs = sh ? sh.rows.map((row) => row[xh]?.v) : []
  if (!(sheets.length === 3 && withRows.length === 1 && deepEqual([...xhs].sort(), [K, U].sort()))) {
    return c.fixture('Q5', `工作表 ${sheets.length} 张，有数据的 ${withRows.length} 张，handle ${JSON.stringify(xhs)}`)
  }
  c.pass('Q5', `三张分层表；两人同在「${sh.name}」（output-format.md:128-133；U9.c）`)
  // expected
  const b = 'P1.h；output-format.md:114-116、:174；U9.b、U9.c、U9×P1；ADR-92:168-184'
  c.ok(`CSV：${K} 所在行在 ${U} 所在行之前`, hs.indexOf(K) < hs.indexOf(U), `CSV 顺序 ${JSON.stringify(hs)}`, b)
  c.ok(`XLSX：分层表里 ${K} 所在行在 ${U} 所在行之前`, xhs.indexOf(K) < xhs.indexOf(U), `XLSX 顺序 ${JSON.stringify(xhs)}`, b)
  // 附带（P1.e；GAP-20 只影响 XLSX 单元格类型，按「数值或文本」两种都接受）
  c.ok(`附带：CSV ${K} 的 followers 为 10000、${U} 的为 未查询`, rk[ifo] === '10000' && ru[ifo] === '未查询', `followers ${rk[ifo]} / ${ru[ifo]}`, 'P1.e')
  const xf = xcol(sh, 'followers'), xt = xcol(sh, 'tier'), xs = xcol(sh, 'score')
  const xr = (h: string) => sh.rows[xhs.indexOf(h)]
  const kf = xr(K)?.[xf], uf = xr(U)?.[xf]
  c.ok(`附带：XLSX ${K} 的 followers 表示 10000、${U} 为 未查询`, !!kf && (kf.numeric ? decEq(kf.v, '10000') : kf.v === '10000') && uf?.v === '未查询', `XLSX followers ${JSON.stringify([kf, uf])}`, 'P1.e；GAP-20')
  const same = (h: string, row: string[]) => { const x = xr(h); return !!x && x[xt]?.v === row[it] && (x[xs]?.numeric ? decEq(x[xs].v, row[is]) : x[xs]?.v === row[is]) }
  c.ok('附带：两种格式中两人的 tier、score 彼此一致', same(K, rk) && same(U, ru), 'CSV 与 XLSX 按 handle 对照', 'U9.b、U9.c；output-format.md:134')
}

export const G56: CaseDef[] = [
  {
    id: 'G5-01', group: 'G5', frozen: '附条件', spec: `${SP}:1416-1449`, runs: [],
    judge(c) { if (g5Gate(c, 'G5-01 两组身份 × 6 排列')) { orderCase(c, 'G5-01 组I ', 'P1.h（同层同分同建议：已查到且不是 0 → 未查询 → 确实是 0）'); orderCase(c, 'G5-01 组II ', 'P1.h') } },
  },
  {
    id: 'G5-02', group: 'G5', frozen: '附条件', spec: `${SP}:1416-1424、:1451-1456`, runs: [],
    judge(c) { if (g5Gate(c, 'G5-02 组I（C-N7）× 6 排列')) orderCase(c, 'G5-02 ', 'P1.h「未查询…压不过任何真查到了数的人」；ADR-92:177；U9×P1；U9.b（返回长度 3：排序不删人）') },
  },
  {
    id: 'G5-03', group: 'G5', frozen: '附条件', spec: `${SP}:1416-1424、:1458-1463`, runs: [],
    judge(c) {
      if (!g5Gate(c, 'G5-03 输入、分数、层级与三态不变')) return
      for (const call of g5Calls(c)) {
        const b = 'U9.b「排序不修改输入名单」；P1.h「只改先后，不改分数也不改分层」；P1 三态；P1.b'
        c.ok(`${call.label} 调用后输入数组顺序与每个元素都与 S 深度相等`, deepEqual(call.input, call.snapshot), '对比调用前深拷贝 S', b)
        const out = Array.isArray(call.out) ? (call.out as Obj[]) : []
        const byH = (h: unknown) => call.snapshot.find((s) => s.handle === h)
        c.ok(`${call.label} 返回的每个元素与 S 中同 handle 的元素深度相等`, !call.threw && out.length === 3 && out.every((x) => deepEqual(x, byH(x?.handle))), call.threw ?? '逐元素对照', b)
        const u = out.find((x) => typeof x?.handle === 'string' && (x.handle as string).includes('unqueried'))
        const z = out.find((x) => typeof x?.handle === 'string' && (x.handle as string).includes('zero'))
        c.ok(`${call.label} C-U 的返回值上 'followers' in x 仍为 false`, !!u && !('followers' in u), u ? `followers ${'followers' in u ? '在' : '缺席'}` : '找不到 C-U', 'P1 三态（未查询 = 键缺席）')
        c.ok(`${call.label} C-Z 的 followers 仍严格等于 0`, !!z && z.followers === 0, z ? `followers = ${JSON.stringify(z.followers)}` : '找不到 C-Z', 'P1.b')
      }
    },
  },
  { id: 'G6-01', group: 'G6', frozen: '附条件', spec: `${SP}:1467-1545`, runs: ['G6-01'], judge(c) { g6(c, 'G6-01') } },
  { id: 'G6-02', group: 'G6', frozen: '附条件', spec: `${SP}:1467-1530、:1547-1552`, runs: ['G6-02'], judge(c) { g6(c, 'G6-02') } },
  { id: 'G6-03', group: 'G6', frozen: '附条件', spec: `${SP}:1467-1530、:1554-1559`, runs: ['G6-03'], judge(c) { g6(c, 'G6-03') } },
]
export type _R = RunRec
