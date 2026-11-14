// KOL-21 C1 · G2 坏账样本（冻结单 pack/30-frozen-spec.md:656-1007；30 例：可执行 25、附条件 4、不覆盖 1）
// 样本 «COST» 槽见 fixtures.ts（:660-761）；「历史费用不可用」分类 A.2.2（:763）；BLOCK-PAY A.2.3（:781）。
// 每条用例的三字段期望（FK，:32-35）都逐项写出，不靠「同上」继承。
import type { CaseDef, Ctx, RunRec, FKExp } from '../lib/judge.ts'
import * as J from '../lib/judge.ts'
import { PRICE_VERSION } from '../fixtures.ts'
import { get1, has, describe, plain, deepEqual, parseDocument, exact, type JNode } from '../lib/json.ts'
import { SP, onNode, exactAt, intEq, fieldEq, noPending, lcIs, doneLacks } from './common.ts'

const PAYDEP = { kind: 'semantic' as const, of: 'G2-00', why: 'F-PAY 确有待付费工作的资格证明（A.0.10 第 2 条；G2-00「作用」）' }
const DONEDEP = { kind: 'semantic' as const, of: 'G3-02', why: 'F-DONE 没有待付费工作的资格证明（A.0.10 第 2 条；G3-02「作用」）' }
const RENDERDEP = { kind: 'semantic' as const, of: 'G2-17', why: 'render 用的 F-PAY 资格（A.0.10 第 2 条；G2-17「作用」）' }
const SAME: FKExp = { sameAsBefore: true }
const ABSENT: FKExp = { absent: true }
const NULL_AMOUNTS = ['cost_estimate_usd', 'cost_http_200_usd', 'cost_unknown_result_usd', 'cost_pending_usd']

function costDiag(c: Ctx, r: RunRec, points: string[], names: string[]): void {
  const basis = 'skill/SKILL.md:185；D13.s；D13×P1 req:1016（BLOCK-PAY 第 4 项）'
  const s = J.SEM.COST_DIAG(points, names.length ? names : ['?'], basis)
  J.sem(c, r, names.length ? s : { ...s, pre: undefined })
}
/** BLOCK-PAY（A.2.3）：退出码 2 + NOT-BUDGET；零新请求（S-TRAP，阳性 G2-00）；FK；COST-DIAG。 */
function blockPay(c: Ctx, r: RunRec, fk: { cost_ledger: FKExp; requests: FKExp; budget_usd: FKExp }, diag: string[], names: string[]): void {
  J.exitIs(c, r, 2, 'D13.s；ADR-108:47「配置/金额/初始费用状态…2；初始 pending 的付费/改额拒绝亦为 2」；ADR-109:21；README.md:181（BLOCK-PAY 第 1 项）')
  J.notBudget(c, r)
  J.zero(c, r, 'G2-00')
  J.fk(c, r, fk, 'D13.i（缺席仍缺席，预算不舍入、不归零、不转 null）；D13.a；D12.w（BLOCK-PAY 第 3 项）')
  costDiag(c, r, diag, names)
}
/** G2-10/11/12：G2-16P 不过即把它们的 COST-DIAG 结论标「待复核」（G2-16P「作用」）。 */
function flagIf16P(c: Ctx): void {
  const v = c.env.result('G2-16P').verdict
  const it = c.items.find((i) => i.label.endsWith('COST-DIAG'))
  if (v === 'red' && it && it.status !== 'facility' && it.status !== 'fixture') {
    it.status = 'review-pending'
    it.detail = 'G2-16P 语义红：按其「作用」把本例 COST-DIAG 结论标「待复核」（原结论：' + (it.detail ?? '') + '）'
  }
}
/** G2-00 / G2-01 共用（G2-01「同 G2-00」，只换根预算与上限）。PK-HAS(kol21 g2 pay) 为附条件子断言（GAP-07④）。 */
function payPositive(c: Ctx, r: RunRec, budget: string, limit: number): void {
  J.exitIs(c, r, 5, 'ADR-193（KOL-106 方案乙）（402 → error、退 5）；旧值 1 见 D6.y')
  J.summary(c, r, 'error')
  J.err402(c, r)
  J.pk(c, r, 'kol21 g2 pay', 'HAS', c.cond('GAP-07④', 'present') ? undefined
    : 'GAP-07④：error 收尾汇总是否必带 pending_keywords 缺直接出处，补齐前不判；不判期间本例作基线、资格证明与观察器阳性只看其余断言（:799、:801）')
  J.reqExactly(c, r, '请求恰好 1 次：T1，index 0，402', [['T1', 0, 'status:402']], 'D6.y；A.0.9 F-PAY 任务 0 有待付费的首页')
  const K = J.costOut(c, r)
  J.kIs(c, K, 'requests', 0, 'D12.i、D12.e')
  J.kExact(c, K, 'cost_estimate_usd', '0', 'D12.f')
  J.kExact(c, K, 'budget_usd', budget, 'D13.a、D13.k')
  J.kIs(c, K, 'cost_status', 'known', 'ADR-108:33')
  J.kIs(c, K, 'cost_scope', 'task', 'ADR-108:34')
  const t = J.taskAfter(r)
  onNode(c, t.node, t.problem, [
    [`运行后 task.json 根 budget_usd EXACT ${budget}`, exactAt(['budget_usd'], budget), 'D13.a'],
    [`运行后 cost_ledger.limit_micro_usd ${limit}`, intEq(['cost_ledger', 'limit_micro_usd'], limit), 'D12.a、D13.k'],
    ['运行后 requests 0', fieldEq(['requests'], 0), 'D12.i'],
    ['运行后 LC：H = U = 0', lcIs(0, 0), 'D12.e、D12.f'],
    ['运行后无 pending', noPending, 'D12.i（402 只撤销该次预留）'],
    ['运行后 done 不含 0', doneLacks(0), 'types.ts:460-461'],
  ])
}
/** G2-13 系列（本地零请求对照，F-DONE）：退出码 0；SUMMARY(done)；零请求；COST-OUT 各项；HINT(0, 0)。 */
function localZero(c: Ctx, r: RunRec, status: string, o: { requests: unknown[]; nullAmounts: boolean; versions: boolean; problems: boolean }): JNode | undefined {
  J.exitIs(c, r, 0, 'D13.f；ADR-108:17、:83')
  J.summary(c, r, 'done')
  J.zero(c, r, 'G2-00')
  const K = J.costOut(c, r)
  J.kIs(c, K, 'cost_status', status, 'ADR-107:66、:67；ADR-108:33、:40')
  if (o.nullAmounts) for (const f of NULL_AMOUNTS) J.kIs(c, K, f, null, 'ADR-108:35（费用不可用时均为 null）；ADR-107:67')
  if (o.versions) J.kIs(c, K, 'cost_price_versions', [], 'ADR-108:37')
  if (o.problems) {
    const v = K ? get1(K, 'cost_problems') : undefined
    const ok = v !== undefined && v !== 'dup' && v.t === 'arr' && v.items.length > 0 &&
      v.items.every((it) => { const p = get1(it, 'path'), q = get1(it, 'reason'); return p !== undefined && p !== 'dup' && p.t === 'str' && q !== undefined && q !== 'dup' && q.t === 'str' })
    c.ok('Κ.cost_problems 非空数组、每项有字符串 path 与 reason', ok, `cost_problems = ${describe(v)}`, 'ADR-108:38')
  }
  if (o.requests.length === 1) J.kIs(c, K, 'requests', o.requests[0], 'ADR-108:31；P1 条头「缺失的数据不得用默认值填充」')
  else J.kIn(c, K, 'requests', o.requests, 'ADR-108:31「旧费用未知但原计数仍为非负安全整数可保留，计数本身坏则 null」（允许集合推导见冻结单该用例）')
  J.sem(c, r, J.SEM.HINT(0, 0, 'D6.q（两者皆零 → 声明无新请求）'))
  return K
}
/** META-COST（G2-17「META-COST」）：读回 meta.json，带 cost_status 键的对象（根或任一层）至少一个；不止一个则费用字段取值一致；记为 M。 */
function metaCost(c: Ctx, r: RunRec): JNode | undefined {
  const dir = r.def.taskRel!.split('/').slice(0, -1).join('/')
  const text = J.readRel(r, `${dir}/meta.json`)
  const node = text === null ? null : parseDocument(text)
  const basis = 'D13.c「费用 meta」；D13.q；output-format.md:262（不断 M 的确切位置，GAP-30）'
  if (!node) { c.red('META-COST', text === null ? 'meta.json 不存在' : 'meta.json 不是合法 JSON', basis); return undefined }
  const objs: JNode[] = []
  const walk = (n: JNode): void => {
    if (n.t === 'obj') { if (has(n, 'cost_status')) objs.push(n); for (const [, v] of n.entries) walk(v) }
    else if (n.t === 'arr') n.items.forEach(walk)
  }
  walk(node)
  const pick = (o: JNode) => J.COST_FIELDS.map((f) => { const v = get1(o, f); return v === undefined || v === 'dup' ? String(v) : JSON.stringify(plain(v)) })
  const same = objs.every((o) => deepEqual(pick(o), pick(objs[0])))
  c.ok('META-COST', objs.length > 0 && same, `带 cost_status 的对象 ${objs.length} 个，费用字段一致=${same}`, basis)
  return objs[0]
}
function mIs(c: Ctx, M: JNode | undefined, f: string, want: unknown): void {
  const lab = `M.${f} = ${JSON.stringify(want)}`
  if (!M) return c.red(lab, '没有 M（meta.json 里没有带 cost_status 的对象）')
  const v = get1(M, f)
  c.ok(lab, v !== undefined && v !== 'dup' && deepEqual(plain(v), want), `M.${f} = ${describe(v)}`, 'ADR-108:33、:35')
}
function mExact(c: Ctx, M: JNode | undefined, f: string, d: string): void {
  const lab = `M.${f} EXACT ${d}`
  if (!M) return c.red(lab, '没有 M')
  const e = exact(get1(M, f), d)
  c.ok(lab, e.ok, `M.${f} = ${e.got}`, 'ADR-108:27、:35；D12.f')
}
/** render 交付文件（G2-17：kol.csv、kol.xlsx、report.html、meta.json；output-format.md:11-22、:140、:198）。 */
function renderFiles(c: Ctx, r: RunRec): void {
  const dir = r.def.taskRel!.split('/').slice(0, -1).join('/')
  for (const f of ['kol.csv', 'kol.xlsx', 'report.html', 'meta.json']) {
    c.ok(`任务目录下出现 ${f}`, r.after!.files.has(`${dir}/${f}`), r.after!.files.has(`${dir}/${f}`) ? '在' : '不在', 'output-format.md:11-22、:140、:198')
  }
}
function renderBase(c: Ctx, r: RunRec): void {
  J.exitIs(c, r, 0, 'D13.h；ADR-108:52「render 只读费用，不创建或修复账」')
  J.zero(c, r, 'G4-04')
  renderFiles(c, r)
}
const kStatus = (r: RunRec | null): string | undefined => {
  if (!r) return undefined
  const K = J.kappa(r)
  const v = K ? get1(K, 'cost_status') : undefined
  return v !== undefined && v !== 'dup' && v.t === 'str' ? v.v : undefined
}

// A.2.2 表：各样本的预期 cost_status（G2-23a 用）
const SAMPLE_OF: Record<string, [string, string]> = {
  'G2-02': ['B1', 'invalid-ledger'], 'G2-03': ['B2', 'invalid-ledger'], 'G2-04': ['B3', 'unknown-history'],
  'G2-04Z': ['B3z', 'unknown-history'], 'G2-05': ['B3b', 'unknown-history'], 'G2-07': ['B4', 'unavailable-evidence'],
  'G2-08': ['B5', 'invalid-ledger'], 'G2-09': ['B6', 'invalid-ledger'], 'G2-10': ['PD', 'known'], 'G2-12': ['B7', 'unavailable-evidence'],
}

export const G2: CaseDef[] = [
  {
    id: 'G2-00', group: 'G2', frozen: '附条件', spec: `${SP}:796-802`, runs: ['G2-00'],
    judge(c) { const r = c.observed('G2-00'); if (r) payPositive(c, r, '2', 2000000) },
  },
  {
    id: 'G2-01', group: 'G2', frozen: '附条件', spec: `${SP}:804-809`, runs: ['G2-01'],
    // 继承的 PK-HAS(kol21 g2 pay) 同为附条件子断言（GAP-07④），其余照判；精确预算 1.000001 / 1000001（D13.a、D13.k；D12.g）
    judge(c) { const r = c.observed('G2-01'); if (r) payPositive(c, r, '1.000001', 1000001) },
  },
  {
    id: 'G2-02', group: 'G2', frozen: '可执行', spec: `${SP}:811-816`, runs: ['G2-02'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-02'); if (!r) return
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 1 }, budget_usd: { exact: '2' } }, ['账目净次数与 requests 不一致'], ['requests', 'cost_ledger'])
    },
  },
  {
    id: 'G2-03', group: 'G2', frozen: '可执行', spec: `${SP}:818-823`, runs: ['G2-03'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-03'); if (!r) return
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, ['费用账损坏（entries 仍是 {}，不被修成 []）'], ['cost_ledger', 'entries'])
    },
  },
  {
    id: 'G2-04', group: 'G2', frozen: '可执行', spec: `${SP}:825-830`, runs: ['G2-04'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-04'); if (!r) return
      blockPay(c, r, { cost_ledger: ABSENT, requests: ABSENT, budget_usd: { exact: '2' } }, ['费用账缺席 / 旧费用未知'], ['cost_ledger'])
    },
  },
  {
    id: 'G2-04Z', group: 'G2', frozen: '可执行', spec: `${SP}:832-837`, runs: ['G2-04Z'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-04Z'); if (!r) return
      blockPay(c, r, { cost_ledger: ABSENT, requests: ABSENT, budget_usd: ABSENT }, ['费用账缺席 / 旧费用未知'], [])
    },
  },
  {
    id: 'G2-05', group: 'G2', frozen: '可执行', spec: `${SP}:839-844`, runs: ['G2-05'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-05'); if (!r) return
      blockPay(c, r, { cost_ledger: ABSENT, requests: { eq: 0 }, budget_usd: { exact: '2' } }, ['费用账缺席', '不把 requests=0 当作「免费历史」'], [])
    },
  },
  {
    id: 'G2-06', group: 'G2', frozen: '可执行', spec: `${SP}:846-851`, runs: ['G2-06'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-06'); if (!r) return
      blockPay(c, r, { cost_ledger: ABSENT, requests: ABSENT, budget_usd: { exact: '2' } }, ['费用账缺席，不能靠提高上限恢复'], [])
    },
  },
  {
    id: 'G2-07', group: 'G2', frozen: '可执行', spec: `${SP}:853-858`, runs: ['G2-07'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-07'); if (!r) return
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, ['无法识别的费用账版本（schema 仍为 2）'], ['schema', 'cost_ledger'])
    },
  },
  {
    id: 'G2-08', group: 'G2', frozen: '可执行', spec: `${SP}:860-865`, runs: ['G2-08'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-08'); if (!r) return
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, ['根 budget_usd 与账上限冲突（ADR-108:40）'], ['budget_usd'])
    },
  },
  {
    id: 'G2-09', group: 'G2', frozen: '可执行', spec: `${SP}:867-872`, runs: ['G2-09'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-09'); if (!r) return
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '1.000001' } }, ['根 budget_usd 与账上限冲突（同 G2-08）'], ['budget_usd'])
    },
  },
  {
    id: 'G2-10', group: 'G2', frozen: '可执行', spec: `${SP}:874-879`, runs: ['G2-10'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-10'); if (!r) return
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, ['存在未结预留', '不说成预算用尽'], ['pending'])
      flagIf16P(c)
    },
  },
  {
    id: 'G2-11', group: 'G2', frozen: '可执行', spec: `${SP}:881-886`, runs: ['G2-11'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-11'); if (!r) return
      // 三字段期望同 G2-10：账深度相等（limit_micro_usd 仍 2000000，新上限 3 不落盘）、requests 0、budget_usd EXACT 2
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, ['存在未结预留', '不说成预算用尽'], ['pending'])
      flagIf16P(c)
    },
  },
  {
    id: 'G2-12', group: 'G2', frozen: '可执行', spec: `${SP}:888-893`, runs: ['G2-12'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G2-12'); if (!r) return
      blockPay(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, ['不认识的价目版本'], ['price_version', 'tikhub-public-19990101-000000000000'])
      flagIf16P(c)
    },
  },
  {
    id: 'G2-13', group: 'G2', frozen: '可执行', spec: `${SP}:895-900`, runs: ['G2-13'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-13'); if (!r) return
      localZero(c, r, 'unknown-history', { requests: [null], nullAmounts: true, versions: true, problems: true })
      J.fk(c, r, { cost_ledger: ABSENT, requests: ABSENT, budget_usd: { exact: '2' } }, 'D13.i')
    },
  },
  {
    id: 'G2-13Z', group: 'G2', frozen: '可执行', spec: `${SP}:902-907`, runs: ['G2-13Z'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-13Z'); if (!r) return
      // 「同 G2-13 的退出码、SUMMARY、零请求、cost_status、null 金额、Κ.requests === null、HINT(0, 0)」——只断这几项
      localZero(c, r, 'unknown-history', { requests: [null], nullAmounts: true, versions: false, problems: false })
      J.fk(c, r, { cost_ledger: ABSENT, requests: ABSENT, budget_usd: ABSENT }, 'D13.i「缺席仍缺席」；D13.v「续跑…不借此默认」')
    },
  },
  {
    id: 'G2-14', group: 'G2', frozen: '可执行', spec: `${SP}:909-914`, runs: ['G2-14'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-14'); if (!r) return
      localZero(c, r, 'invalid-ledger', { requests: [1, null], nullAmounts: true, versions: true, problems: true })
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 1 }, budget_usd: { exact: '2' } }, 'D13.f、D13.i')
    },
  },
  {
    id: 'G2-15', group: 'G2', frozen: '可执行', spec: `${SP}:916-921`, runs: ['G2-15'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-15'); if (!r) return
      localZero(c, r, 'unavailable-evidence', { requests: [0, null], nullAmounts: true, versions: true, problems: true })
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, 'D13.f、D13.i；ADR-107:66')
    },
  },
  {
    id: 'G2-15C', group: 'G2', frozen: '可执行', spec: `${SP}:923-928`, runs: ['G2-15C'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-15C'); if (!r) return
      localZero(c, r, 'invalid-ledger', { requests: [0, null], nullAmounts: true, versions: true, problems: true })
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, 'D13.f、D13.i')
      // G2-13（unknown-history）、G2-15（unavailable-evidence）、G2-15C（invalid-ledger）三跑 cost_status 两两不同（D13×P1、D12×P1）
      const a = c.peek('G2-13'), b = c.peek('G2-15')
      if (!a || !b) c.nj('G2-13 / G2-15 / G2-15C 三跑 cost_status 两两不同', 'G2-13 或 G2-15 那一跑未观察成立，跨跑比较不判')
      else {
        const s = [kStatus(a), kStatus(r), kStatus(b)]
        c.ok('G2-13 / G2-15 / G2-15C 三跑 cost_status 两两不同', s.every((x) => x !== undefined) && new Set(s).size === 3, `三跑 ${JSON.stringify(s)}`, 'D13×P1「缺失、不可核实与损坏分别诊断」；D12×P1「坏账与未知分别处理」')
      }
    },
  },
  {
    id: 'G2-16', group: 'G2', frozen: '可执行', spec: `${SP}:930-935`, runs: ['G2-16'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-16'); if (!r) return
      J.exitIs(c, r, 0, 'D13.f「…或缺少供应商 key 而阻止本地整理及输出」；ADR-108:17、:47')
      J.summary(c, r, 'done')
      J.zero(c, r, 'G2-00') // 阳性 G2-00 的 apiKey 是 placeholder；协议只要求同一认证、同一入口、同一观察器（ADR-70:3423）
      const K = J.costOut(c, r)
      J.kIs(c, K, 'cost_status', 'known', 'ADR-108:33')
      J.kExact(c, K, 'cost_estimate_usd', '0', 'D12.f')
      J.kIs(c, K, 'requests', 0, 'D12.e')
      J.sem(c, r, J.SEM.HINT(0, 0, 'D6.q'))
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, 'D13.i')
    },
  },
  {
    id: 'G2-16P', group: 'G2', frozen: '可执行', spec: `${SP}:937-943`, runs: ['G2-16P'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-16P'); if (!r) return
      J.exitIs(c, r, 0, 'ADR-108:83、:17、:109、:47；ADR-109:21；skill/SKILL.md:206；D6.y')
      J.summary(c, r, 'done')
      J.zero(c, r, 'G2-00')
      const K = J.costOut(c, r)
      J.kIs(c, K, 'cost_status', 'known', 'ADR-108:33「known 可有 pending」')
      J.kExact(c, K, 'cost_pending_usd', '0.002', 'ADR-107:122-124（2000 µ$）；D12.f；ADR-108:27')
      J.kExact(c, K, 'cost_estimate_usd', '0.002', 'ADR-108:35（三项之和为占用）')
      J.kExact(c, K, 'cost_http_200_usd', '0', 'D12.e')
      J.kExact(c, K, 'cost_unknown_result_usd', '0', 'D12.e')
      J.kIs(c, K, 'requests', 0, 'D12.e；D14×P1')
      J.kExact(c, K, 'budget_usd', '2', 'ADR-108:32')
      J.kIs(c, K, 'cost_price_versions', [PRICE_VERSION], 'ADR-108:37（entries 与 pending 的版本去重）')
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, 'D12.m、D14.f（pending 仍在，不退款、不生成终态）')
    },
  },
  {
    id: 'G2-17', group: 'G2', frozen: '可执行', spec: `${SP}:945-951`, runs: ['G2-17'],
    judge(c) {
      const r = c.observed('G2-17'); if (!r) return
      renderBase(c, r)
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, 'ADR-108:52')
    },
  },
  {
    id: 'G2-18', group: 'G2', frozen: '可执行', spec: `${SP}:953-958`, runs: ['G2-18'], deps: [RENDERDEP],
    judge(c) {
      const r = c.observed('G2-18'); if (!r) return
      renderBase(c, r)
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, 'D13.h「不新建或修复费用账」；ADR-109:21')
      const M = metaCost(c, r)
      mIs(c, M, 'cost_status', 'known')
      mExact(c, M, 'cost_pending_usd', '0.002')
      mExact(c, M, 'cost_estimate_usd', '0.002')
      mExact(c, M, 'cost_http_200_usd', '0')
      mExact(c, M, 'cost_unknown_result_usd', '0')
    },
  },
  {
    id: 'G2-19', group: 'G2', frozen: '可执行', spec: `${SP}:960-965`, runs: ['G2-19'], deps: [RENDERDEP],
    judge(c) {
      const r = c.observed('G2-19'); if (!r) return
      renderBase(c, r)
      J.fk(c, r, { cost_ledger: ABSENT, requests: ABSENT, budget_usd: { exact: '2' } }, 'D13.h（不新建）、D13.i、D12.q')
      const M = metaCost(c, r)
      mIs(c, M, 'cost_status', 'unknown-history')
      mIs(c, M, 'cost_estimate_usd', null)
      const dir = r.def.taskRel!.split('/').slice(0, -1).join('/')
      const html = J.readRel(r, `${dir}/report.html`)
      if (html === null) c.red('report.html 费用处不出现 $0、$null 或已用百分比', 'report.html 不存在', 'D13.r')
      else c.review('report.html 费用处不出现 $0、$null 或已用百分比', {
        text: html, textRef: `${r.cwd}/${dir}/report.html`, needsQuote: false,
        points: ['对旧费用未知的任务，HTML 费用处不显示 $0、$null 或伪造已用百分比（D13.r）'], basis: 'D13.r（C 节 C.1 #6）',
      })
    },
  },
  {
    id: 'G2-20', group: 'G2', frozen: '可执行', spec: `${SP}:967-972`, runs: ['G2-20'], deps: [RENDERDEP],
    judge(c) {
      const r = c.observed('G2-20'); if (!r) return
      renderBase(c, r)
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, 'D13.h（不修复）、D13.i；ADR-107:67')
      const M = metaCost(c, r)
      mIs(c, M, 'cost_status', 'invalid-ledger')
      // G2-19 与 G2-20 的 cost_status 不同（D12×P1、D13×P1）
      const r19 = c.peek('G2-19')
      if (!r19) c.nj('G2-19 与 G2-20 的 M.cost_status 不同', 'G2-19 那一跑未观察成立，跨跑比较不判')
      else {
        const m19 = (() => { const d = r19.def.taskRel!.split('/').slice(0, -1).join('/'); const t = J.readRel(r19, `${d}/meta.json`); const n = t ? parseDocument(t) : null; let s: string | undefined; const walk = (x: JNode): void => { if (s) return; if (x.t === 'obj') { const v = get1(x, 'cost_status'); if (v && v !== 'dup' && v.t === 'str') { s = v.v; return } x.entries.forEach(([, y]) => walk(y)) } else if (x.t === 'arr') x.items.forEach(walk) }; if (n) walk(n); return s })()
        const m20 = M ? get1(M, 'cost_status') : undefined
        const s20 = m20 !== undefined && m20 !== 'dup' && m20.t === 'str' ? m20.v : undefined
        c.ok('G2-19 与 G2-20 的 M.cost_status 不同', m19 !== undefined && s20 !== undefined && m19 !== s20, `G2-19=${m19} G2-20=${s20}`, 'D12×P1、D13×P1')
      }
    },
  },
  {
    id: 'G2-21', group: 'G2', frozen: '可执行', spec: `${SP}:974-979`, runs: ['G2-21'], deps: [RENDERDEP],
    judge(c) {
      const r = c.observed('G2-21'); if (!r) return
      renderBase(c, r)
      J.fk(c, r, { cost_ledger: ABSENT, requests: ABSENT, budget_usd: ABSENT }, 'D13.h、D13.i「缺席仍缺席」')
      const M = metaCost(c, r)
      mIs(c, M, 'cost_status', 'unknown-history')
    },
  },
  {
    id: 'G2-22', group: 'G2', frozen: '不覆盖', spec: `${SP}:981-984`, runs: [],
    notCovered: 'enrich 的付费被拒与本地对照（D13.g）：(1) 合法 Creator 完整声明缺（GAP-18）；(2)「游离账号」「已评候选必填证据」只有名目没有判据（README.md:189；D21.h）；(3) 无完整 enrichment.json 缓存样例（public-metrics.md:48-49、:120-137）；(4) 私密账号本地记录写法缺；(5) enrich 无可构造的观察器阳性（G4-05）。见 GAP-16（:1584）。只登记，不写判定测试。',
  },
  {
    id: 'G2-23a', group: 'G2', frozen: '附条件', spec: `${SP}:986-992`,
    runs: ['G2-02', 'G2-03', 'G2-04', 'G2-04Z', 'G2-05', 'G2-07', 'G2-08', 'G2-09', 'G2-10', 'G2-12'], deps: [PAYDEP],
    judge(c) {
      // E-1 第 S2 行（:1797-1822）：契约公开并经需求方逐字确认、且与冻结单所列 S2「有 / error」一致之前，一律不判；不由输出反推阶段。
      for (const id of Object.keys(SAMPLE_OF)) {
        c.prefix = `${id} `
        if (!c.cond('E-1', 'as-frozen')) { c.nj('E-1 S2：汇总 JSON / stopped / COST-OUT / HINT-BLOCK', '待 E-1 契约由实现方提供并经需求方逐字确认（:986-992；E-1 :1797-1822）'); continue }
        const r = c.observed(id); if (!r) continue
        const [sample, status] = SAMPLE_OF[id]
        J.summary(c, r, 'error')
        const K = J.costOut(c, r)
        J.kIs(c, K, 'cost_status', status, `A.2.2 表 ${sample}`)
        if (status === 'known') J.kExact(c, K, 'cost_pending_usd', '0.002', 'PD；ADR-107:122-124')
        else for (const f of ['cost_http_200_usd', 'cost_unknown_result_usd', 'cost_pending_usd']) J.kIs(c, K, f, null, 'ADR-108:35；ADR-107:67')
        J.sem(c, r, J.SEM.CUSTOM('HINT-BLOCK(1, 0)：阻止原因是费用状态', [
          '续跑提示分别报告待查关键词数 1 与待补 profile 数 0', '不声明无新请求', '阻止原因是费用状态（与 COST-DIAG 一致）', '不承诺直接续跑即可花钱',
        ], 'D6.q 第二句、D6.r；E-1 另外三项要求第 2 条', true, (t) => (t.includes('1') && t.includes('0') ? '预筛命中（含 1 与 0）' : '预筛未命中——不判红，待复核')))
      }
      c.prefix = ''
    },
  },
  {
    id: 'G2-23b', group: 'G2', frozen: '附条件', spec: `${SP}:994-1000`, runs: ['G2-06', 'G2-11'], deps: [PAYDEP],
    judge(c) {
      for (const id of ['G2-06', 'G2-11']) {
        c.prefix = `${id} `
        if (!c.cond('E-1', 'as-frozen')) { c.nj('E-1 S1：NO-SUMMARY-JSON / NO-STOPPED', '待 E-1 契约由实现方提供并经需求方逐字确认（:994-1000；E-1 :1797-1822）'); continue }
        const r = c.observed(id); if (!r) continue
        J.noSummaryJson(c, r)
        J.noStopped(c, r)
        // 退出码 2 已在 BLOCK-PAY（G2-06、G2-11 主用例）判，这里不吞掉、也不重复
      }
      c.prefix = ''
    },
  },
  {
    id: 'G2-24', group: 'G2', frozen: '可执行', spec: `${SP}:1002-1007`, runs: ['G2-24'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G2-24'); if (!r) return
      J.zero(c, r, 'G2-00')
      const t = J.taskAfter(r)
      if (!t.node) c.red('运行后根上不出现数值为 2 的 budget_usd', t.problem ?? '读不出', 'D13.v')
      else {
        const all = J.getAll(t.node, 'budget_usd')
        const bad = all.filter((v) => v.t === 'num' && exact(v, '2').ok)
        c.ok('运行后根上不出现数值为 2 的 budget_usd', bad.length === 0, `根 budget_usd：${all.map(describe).join('，') || '缺席'}（缺席或其他值不在本例断言内）`,
          'D13.v「续跑不适用本条，盘上任务缺 budget_usd 时不借此默认」；D13.w；ADR-108:21')
      }
      // 退出码、汇总、cost_status 不断（GAP-36）
    },
  },
]
