// KOL-21 C1 · G4 观察器（零请求断言的前提）与零预留（冻结单 pack/30-frozen-spec.md:1337-1412；8 例：可执行 4、附条件 3、不覆盖 1）
// 观察器判法照公开协议 v1 与修复轮 1 修订（同号条目以修订为准；ADR-70:3223-3324、:3408-3435）。
import type { CaseDef, Ctx, RunRec } from '../lib/judge.ts'
import * as J from '../lib/judge.ts'
import { T } from '../fixtures.ts'
import { SP, is200 } from './common.ts'

// E-3 判定（:1857 起）——阳性 / 零尝试 / 零成功预留 / 就绪标记缺席 → 夹具失格
const TIKTOK_1000 = new Set([T.T1, T.T2, T.T3]) // dss.md:258「TikTok 视频搜索、profile、主页作品三路各 $0.001」
function e3Gate(c: Ctx, label: string): boolean {
  if (c.cond('E-3') && c.env.e3) return true
  c.nj(label, '待 E-3 契约由实现方提供（就绪标记、预留事件与通道均无公开契约，:1847-1867）；零请求、盘上无 pending、task.json 不变都不能代证零预留（:1350）')
  return false
}
function e3Positive(c: Ctx, id: string, scope: 'task' | 'process', label: string): boolean {
  const r = c.observed(id); if (!r) return false
  const e3 = c.env.e3!
  if (!e3.ready(r.obs!)) { c.fixture(label, `${id}：E-3 就绪标记缺席（A.0.10 第 4 条）`); return false }
  const ev = e3.events(r.obs!)
  const res = ev.filter((e) => e.result === 'reserved')
  const n = r.obs!.requests.length
  c.ok(`${label}：reserved 事件 ≥ 1 且等于请求数`, res.length >= 1 && res.length === n, `reserved ${res.length} 条，观察器请求 ${n} 次`, 'D14.a；ADR-109:15；E-3 第 4 条')
  c.ok(`${label}：scope 为 ${scope}`, res.length > 0 && res.every((e) => e.scope === scope), `scope ${JSON.stringify([...new Set(res.map((e) => e.scope))])}`, scope === 'process' ? 'ADR-109:13' : 'ADR-109:13（collect 任务账）')
  c.ok(`${label}：reserved 的 unit_micro_usd 与所请求端点公开单价一致（TikTok 三路 1000）`, res.every((e) => TIKTOK_1000.has(e.endpoint) && e.unit_micro_usd === 1000),
    JSON.stringify(res.map((e) => [e.endpoint, e.unit_micro_usd])), 'dss.md:258；README.md:181')
  return res.length >= 1 && res.length === n && res.every((e) => e.scope === scope)
}
/** 该跑主用例的资格结论（基线 / 资格阳性）——零预留子断言同样只在基线成立时有效（A.0.10 第 1 条）。 */
function qualOf(c: Ctx, id: string): 'ok' | 'fixture' | 'pending' {
  const q = c.env.result(id).items.filter((i) => i.label.startsWith('资格'))
  if (q.some((i) => i.status === 'fixture' || i.status === 'red' || i.status === 'facility')) return 'fixture'
  if (q.some((i) => i.status === 'review-pending')) return 'pending'
  return 'ok'
}
function zeroReserve(c: Ctx, id: string, mode: '零尝试' | '零成功预留', basis: string): void {
  const label = `${id} ${mode}`
  const q = qualOf(c, id)
  if (q === 'fixture') return c.fixture(label, `${id} 的基线/资格不成立`)
  if (q === 'pending') return c.pending(label, `${id} 的基线/资格尚待复核`)
  const r = c.peek(id)
  if (!r) return c.facility(label, `${id} 那一跑未观察成立`)
  const e3 = c.env.e3!
  if (!e3.ready(r.obs!)) return c.fixture(label, `${id}：E-3 就绪标记缺席`)
  const ev = e3.events(r.obs!)
  const n = mode === '零尝试' ? ev.length : ev.filter((e) => e.result === 'reserved').length
  c.ok(label, n === 0, mode === '零尝试' ? `预留事件 ${ev.length} 条（任何结果）` : `reserved ${n} 条（rejected 允许：${ev.length - n} 条）`, basis)
}

export const G4: CaseDef[] = [
  {
    id: 'G4-01', group: 'G4', frozen: '可执行', spec: `${SP}:1354-1358`, runs: [],
    judge(c) {
      // certifyIsolation({ evidenceDir: '<SESSION>/isolation' })；目录事先不存在、上一级已存在（由 suite 执行）
      if (!c.env.facility) return c.facility('certified === true', '未注入观察器调用面')
      c.ok('certified === true', c.env.certified, c.env.certNote, 'ADR-70:3229、:3280；Z1（:1343）')
      // 原「problems 为空数组」已删（B2r4:T4），不恢复
    },
  },
  {
    id: 'G4-02', group: 'G4', frozen: '可执行', spec: `${SP}:1360-1365`, runs: ['G2-00'],
    judge(c) {
      // 作「观察器阳性」只要 Z3；作 F-PAY 资格证明另由 G2-00 的已判语义断言决定（两种身份分开，不混成一个布尔）
      const r = c.observed('G2-00'); if (!r) return
      const z = J.z3(r)
      c.ok('Z3：G2-00 是同一事件源的阳性', z.ok, z.why, 'ADR-70:3423；Z3（:1345）')
      const q = r.obs!.requests
      c.ok('恰 1 次请求：endpoint T1、rule 指向 T1、index 0、outcome {status:402}',
        q.length === 1 && q[0].endpoint === T.T1 && q[0].rule === J.ruleOf(r, 'T1') && q[0].index === 0 && 'status' in q[0].outcome && q[0].outcome.status === 402,
        `[${q.map((x) => J.reqKey(r, x)).join(', ')}]`, 'ADR-70:3258')
      // G1-02、G1-02C 作备份：冻结单未写何时启用备份，本测试只用 G2-00 作阳性（日志疑问表 Q-07）
    },
  },
  {
    id: 'G4-03', group: 'G4', frozen: '可执行', spec: `${SP}:1367-1371`, runs: ['G1-01'],
    judge(c) {
      const r = c.observed('G1-01'); if (!r) return
      const z = J.z3(r)
      c.ok('Z3：G1-01 是同一事件源的阳性', z.ok, z.why, 'ADR-70:3423')
      const first = [...r.obs!.requests].sort((a, b) => a.seq - b.seq)[0]
      c.ok('至少 1 次请求，首个为 T1、index 0、{status:200}', !!first && first.rule === J.ruleOf(r, 'T1') && first.index === 0 && is200(first),
        first ? J.reqKey(r, first) : '没有请求', 'ADR-70:3258')
    },
  },
  {
    id: 'G4-04', group: 'G4', frozen: '可执行', spec: `${SP}:1373-1379`, runs: ['G4-04'],
    judge(c) {
      const r = c.observed('G4-04'); if (!r) return
      const q = r.obs!.requests
      c.ok('恰 1 次请求：endpoint /kol21/control、rule 0、index 0、outcome {status:200}',
        q.length === 1 && q[0].endpoint === '/kol21/control' && q[0].rule === 0 && q[0].index === 0 && is200(q[0]),
        `[${q.map((x) => J.reqKey(r, x)).join(', ')}]`, 'ADR-70:3231、:3423；FIXTURE_POSITIVE ADR-70:3305（命中不比 origin，ADR-70:3252）')
      c.ok('stdout 含 200 与 kol21-control-ok', r.obs!.stdout.includes('200') && r.obs!.stdout.includes('kol21-control-ok'), `stdout ${JSON.stringify(r.obs!.stdout.slice(0, 120))}`, 'ADR-70:3231「control 把状态与正文打到 stdout」')
    },
  },
  {
    id: 'G4-05', group: 'G4', frozen: '不覆盖', spec: `${SP}:1381-1384`, runs: [],
    notCovered: 'enrich 构造不出可信的待付费夹具（G2-22、G3-16 的原因；GAP-16），因而没有同入口阳性；不对 enrich 下任何零请求断言。只登记，不写判定测试。',
  },
  {
    id: 'G4-06', group: 'G4', frozen: '附条件', spec: `${SP}:1386-1391`, runs: ['G2-00', 'G1-02', 'G1-01'],
    judge(c) {
      if (!e3Gate(c, 'E-3 预留事件阳性（G2-00、G1-02、G1-01）')) return
      e3Positive(c, 'G2-00', 'task', 'G2-00')
      e3Positive(c, 'G1-02', 'task', 'G1-02')
      e3Positive(c, 'G1-01', 'process', 'G1-01')
    },
  },
  {
    id: 'G4-07', group: 'G4', frozen: '附条件', spec: `${SP}:1393-1399`,
    runs: ['G2-00', 'G1-02', 'G1-04', 'G1-06', 'G1-08', 'G1-10', 'G1-12', 'G1-14', 'G1-16', 'G1-18', 'G1-20', 'G1-21', 'G1-22', 'G1-23', 'G2-02', 'G2-03', 'G2-04', 'G2-04Z', 'G2-05', 'G2-07', 'G2-08', 'G2-09', 'G2-10', 'G2-12', 'G2-06', 'G2-11', 'G3-04', 'G3-04R'],
    judge(c) {
      if (!e3Gate(c, 'collect 零预留（零尝试 / 零成功预留）')) return
      // 阳性：G4-06 的 G2-00 / G1-02（同入口、同 E-3 通道）；阳性不成立时零事件不能算零预留
      const p1 = e3Positive(c, 'G2-00', 'task', '阳性 G2-00')
      const p2 = e3Positive(c, 'G1-02', 'task', '阳性 G1-02')
      if (!p1 && !p2) return c.fixture('collect 零预留', '同入口 E-3 阳性不成立（:1394）')
      const za = 'D16.j「在建任务目录、写 task.json、任何预留与请求之前」；D17.h「零预留、零请求」；D28.b「不开账、零预留、零请求」；D19.e'
      for (const id of ['G1-04', 'G1-06', 'G1-08', 'G1-10', 'G1-12', 'G1-14', 'G1-16', 'G1-18', 'G1-20', 'G1-21', 'G1-22', 'G1-23']) zeroReserve(c, id, '零尝试', za)
      const zb = 'D12.m「阻止下一次预留」；ADR-108:109；D12.w；D13.e；ADR-108:19；D14.f；D12.g'
      for (const id of ['G2-02', 'G2-03', 'G2-04', 'G2-04Z', 'G2-05', 'G2-07', 'G2-08', 'G2-09', 'G2-10', 'G2-12', 'G2-06', 'G2-11', 'G3-04', 'G3-04R']) zeroReserve(c, id, '零成功预留', zb)
    },
  },
  {
    id: 'G4-08', group: 'G4', frozen: '附条件', spec: `${SP}:1401-1406`, runs: ['G1-01', 'G1-05', 'G1-07', 'G1-09', 'G1-11', 'G1-13', 'G1-15', 'G1-17'],
    judge(c) {
      if (!e3Gate(c, 'probe 零预留（零尝试）')) return
      if (!e3Positive(c, 'G1-01', 'process', '阳性 G1-01')) return c.fixture('probe 零预留', '同入口 E-3 阳性 G1-01 不成立（:1402）')
      for (const id of ['G1-05', 'G1-07', 'G1-09', 'G1-11', 'G1-13']) zeroReserve(c, id, '零尝试', 'D16.l「在任何预留与请求之前以退出码 2 结束」')
      zeroReserve(c, 'G1-15', '零尝试', 'D17.j「零预留、零请求」')
      zeroReserve(c, 'G1-17', '零尝试', 'D28.c「不开预算、零预留、零请求」')
      // probe 的预算只在进程内，盘上没有可读的预留痕迹，只能靠 E-3 事件通道（ADR-109:13；tikhub.md:442）；不使 probe 因此落盘
    },
  },
]
// 未用到的类型导入（保留以示 RunRec 形状）
export type _R = RunRec
