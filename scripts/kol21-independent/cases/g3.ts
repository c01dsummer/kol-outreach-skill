// KOL-21 C1 · G3 collect 收尾（冻结单 pack/30-frozen-spec.md:1011-1333；27 例：可执行 15、附条件 11、不覆盖 1）
// 每条都同时断 stopped 与退出码，不从退出码推标签（D6.y；skill/SKILL.md:200）。
import type { CaseDef, Ctx, RunRec, FKExp } from '../lib/judge.ts'
import * as J from '../lib/judge.ts'
import { PRICE_VERSION } from '../fixtures.ts'
import { get1, has, describe, decEq, type JNode } from '../lib/json.ts'
import { SP, onNode, exactAt, intEq, fieldEq, noPending, lcIs, doneHas, doneEmpty, newTaskDir } from './common.ts'

const ACC = { kind: 'accepted' as const, of: 'G1-02', why: 'GAP-03：全部 collect 新建用例以 G1-02 被接受为资格（:1571）' }
const PAYDEP = { kind: 'semantic' as const, of: 'G2-00', why: 'F-PAY 确有待付费工作（G2-00「作用」:801；A.0.10 第 1、2 条）' }
const DONEDEP = { kind: 'semantic' as const, of: 'G3-02', why: 'F-DONE 没有待付费工作（G3-02「作用」；A.0.10 第 2 条）' }
const SAME: FKExp = { sameAsBefore: true }
const PK07 = 'GAP-07④：error 收尾汇总是否必带 pending_keywords 缺直接出处，补齐前不判（:56；:1575）'

function costAll(c: Ctx, K: JNode | undefined, n: number, micro: number, budget: string): void {
  const usd = (micro / 1e6).toString()
  J.kIs(c, K, 'requests', n, 'D12.e；D13.p')
  J.kExact(c, K, 'cost_estimate_usd', usd, 'dss.md:258-259；D12.f')
  J.kExact(c, K, 'cost_http_200_usd', usd, 'D12.e、D12.h')
  J.kExact(c, K, 'cost_unknown_result_usd', '0', 'D12.e')
  J.kExact(c, K, 'cost_pending_usd', '0', 'D12.f')
  J.kExact(c, K, 'budget_usd', budget, 'D13.a')
  J.kIs(c, K, 'cost_status', 'known', 'ADR-108:33')
  J.kIs(c, K, 'cost_price_versions', [PRICE_VERSION], 'ADR-108:37；ADR-107:106-107')
}
const noIndexAbove0 = (c: Ctx, r: RunRec, label: string, basis: string): void => {
  const bad = r.obs!.requests.filter((q) => q.index !== null && q.index > 0)
  c.ok(label, bad.length === 0, bad.length ? `用到了 ${bad.map((q) => J.reqKey(r, q)).join(', ')}` : '没有任何规则用到第 1 个及以后的响应', basis)
}
const reqEqHplusU = (n: JNode): [boolean, string] => {
  const l = J.lc(n); const rq = get1(n, 'requests')
  return [!l.problem && J.isNum(rq, l.H + l.U), `requests = ${describe(rq)}，H + U = ${l.H + l.U}`]
}

/** E-2 命中判定（:1839）：恰有一条命中记录且指向所选〈保存点，k〉才判需求断言；否则夹具失格。 */
function e2Hit(c: Ctx, r: RunRec): boolean {
  const want = r.def.e2!
  const hits = r.e2Hits ?? []
  const real = hits.filter((h) => !h.miss)
  const ok = real.length === 1 && real[0].point === want.point && real[0].occurrence === want.k && real[0].notWritten === true
  if (!ok) c.fixture('E-2 命中', `命中记录 ${JSON.stringify(hits)}；期望恰一条指向〈${want.point}，第 ${want.k} 次〉（:1839；A.0.10 第 4 条）`)
  else c.pass('E-2 命中', `命中〈${want.point}，第 ${want.k} 次〉attempt_id=${real[0].attempt_id ?? '-'} endpoint=${real[0].endpoint ?? '-'}`, 'E-2 第 4 条（:1836）')
  return ok
}
/** SAVE-FAIL 公共 expected（G3-14 组 :1246-1250）。 */
function saveFail(c: Ctx, r: RunRec): void {
  const b = 'D6.y「断点或费用保存失败退 1…不打出 stopped、不出汇总 JSON」；skill/SKILL.md:196；ADR-108:46、:48；D14.h；ADR-109:19、:47；README.md:181'
  J.exitIs(c, r, 1, b)
  J.noSummaryJson(c, r)
  J.noStopped(c, r)
  J.semBoth(c, r, 'NO-SAVED-CLAIM', 'P3.d；D14.h；ADR-108:46「不能称已保存」；skill/SKILL.md:206')
  J.sem(c, r, J.SEM.SAVE_FAIL_DIAG('ADR-109:19；output-format.md:264；skill/SKILL.md:185；D14×P5 req:1091'))
}
const budgetKept = (n: JNode): [boolean, string] => {
  const b = get1(n, 'budget_usd'); const l = J.field(n, ['cost_ledger', 'limit_micro_usd'])
  return [b !== undefined && b !== 'dup' && b.t === 'num' && decEq(b.raw, '2') && J.isNum(l, 2000000), `budget_usd = ${describe(b)}，limit_micro_usd = ${describe(l)}`]
}
/** G3-14d/f 的盘面允许集合（ADR-109:47）：(i) 旧 pending 还在且 H=U=0、requests 0；(ii) 尽力收尾写成真实终态。 */
function twoStates(c: Ctx, n: JNode | undefined, problem: string | undefined, kind: '200' | 'NS'): void {
  const label = kind === '200' ? '盘面 ∈ {(i) 旧 pending：H=U=0、requests 0；(ii) 终态：无 pending、H=1（unit 1000）、U=0、requests 1}'
    : '盘面 ∈ {(i) 旧 pending：H=U=0、requests 0；(ii) 保守留存终态：无 pending、U=1（unit 1000）、H=0、requests 1}'
  const basis = kind === '200' ? 'D14.c；ADR-109:15、:47；D12.h' : 'D14.e；D12.j；D12.e；ADR-109:47'
  if (!n) return c.red(label, problem ?? '读不出', basis)
  const l = J.lc(n); const rq = get1(n, 'requests')
  if (l.problem) return c.red(label, l.problem, basis)
  const unitOk = l.entries.length === 1 && J.isNum(get1(l.entries[0], 'unit_micro_usd'), 1000)
  const s1 = l.pending && l.H === 0 && l.U === 0 && J.isNum(rq, 0)
  const s2 = kind === '200'
    ? !l.pending && l.H === 1 && l.U === 0 && unitOk && J.isNum(rq, 1)
    : !l.pending && l.U === 1 && l.H === 0 && unitOk && J.isNum(rq, 1)
  c.ok(label, s1 || s2, `pending=${l.pending} H=${l.H} U=${l.U} requests=${describe(rq)}（不许：无 pending 且 ${kind === '200' ? 'H' : 'U'}=0 = 退款；${kind === '200' ? 'U>0' : 'H>0'}）`, basis)
}
function noBodySeq1(c: Ctx, r: RunRec): void {
  const label = 'events.jsonl 没有 seq 为 1 的 body 事件'
  const p = `${r.evidenceDir}/events.jsonl`
  const text = J.readRel({ ...r, cwd: r.evidenceDir } as RunRec, 'events.jsonl')
  if (text === null || !c.env.facility) return c.red(label, `读不到 ${p}`, 'ADR-70:3259；readEvents ADR-70:3319')
  const ev = c.env.facility.readEvents(text)
  if (ev.problems.length) return c.facility(label, 'readEvents 报问题：' + ev.problems.join('；'))
  const bad = ev.events.filter((e) => e.kind === 'body' && e.seq === 1)
  c.ok(label, bad.length === 0, bad.length ? `有 ${bad.length} 条 seq 1 的 body 事件` : '没有', 'D14.c、D14.d「终态成功保存后才读取／处理正文」；ADR-109:15；ADR-70:3259')
}
const SUMMARY_RUNS_G318 = ['G3-01', 'G3-02', 'G3-03', 'G3-04', 'G3-04R', 'G3-05', 'G3-06', 'G3-07', 'G3-07T', 'G3-08', 'G1-02', 'G2-00']
const ERROR_RUNS = new Set(['G3-06', 'G3-07', 'G3-08', 'G1-02', 'G2-00'])

export const G3: CaseDef[] = [
  {
    id: 'G3-01', group: 'G3', frozen: '可执行', spec: `${SP}:1037-1057`, runs: ['G3-01'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-01'); if (!r) return
      J.exitIs(c, r, 0, 'D6.y；skill/SKILL.md:192；需求方口径第 3 条')
      J.summary(c, r, 'target')
      J.sigmaCount(c, r, 'profile_failed', 0, 'D6.z')
      J.pk(c, r, 'kol21 g3 target a', 'LACKS')
      J.pk(c, r, 'kol21 g3 target b', 'LACKS')
      J.reqExactly(c, r, '请求恰好 4 次：R0、R1、R2、R3 各一次，都是第 0 个响应（200）', [['R0', 0, 'status:200'], ['R1', 0, 'status:200'], ['R2', 0, 'status:200'], ['R3', 0, 'status:200']],
        'F9.a；skill/SKILL.md:84；product-intake.md:37；tikhub.md:182-183、:253、:376、:388；D6.p、D6.z（先后不断）')
      noIndexAbove0(c, r, '任何规则的第 1 个响应（402）都没被用到', '没有第二页、没有重复补 profile')
      costAll(c, J.costOut(c, r), 4, 6000, '1')
      J.sem(c, r, J.SEM.HINT(0, 0, 'D6.q、D6.r（声明无新请求）'))
      J.sem(c, r, J.SEM.NOT_DEFAULT_BUDGET('D13.w'))
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [
        ['新 task.json done 含 0 与 1', doneHas(0, 1), 'skill/SKILL.md:84；tikhub.md:186-187'],
        ['新 task.json requests 4', fieldEq(['requests'], 4), 'D12.e'],
        ['新 task.json LC：H = 4、Σ(h×unit) = 6000、U = 0', lcIs(4, 0, 6000), 'dss.md:258-259；D12.f'],
        ['新 task.json 无 pending', noPending, 'D12.h'],
        ['新 task.json requests = H + U', reqEqHplusU, 'D13.p 同一快照'],
      ])
    },
  },
  {
    id: 'G3-02', group: 'G3', frozen: '可执行', spec: `${SP}:1059-1065`, runs: ['G3-02'],
    judge(c) {
      const r = c.observed('G3-02'); if (!r) return
      J.exitIs(c, r, 0, 'D6.y；D6 条头「已完成的关键词不重跑」')
      J.summary(c, r, 'done')
      J.pk(c, r, 'kol21 g2 done', 'LACKS')
      J.sigmaCount(c, r, 'profile_failed', 0, 'D6.p')
      J.zero(c, r, 'G2-00')
      J.sem(c, r, J.SEM.HINT(0, 0, 'D6.q（两者皆零 → 声明无新请求）'))
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, '三项与 L0 相同')
    },
  },
  {
    id: 'G3-03', group: 'G3', frozen: '可执行', spec: `${SP}:1067-1072`, runs: ['G3-03'],
    judge(c) {
      const r = c.observed('G3-03'); if (!r) return
      J.exitIs(c, r, 0, 'D6.y；skill/SKILL.md:191')
      J.summary(c, r, 'done')
      J.zero(c, r, 'G2-00')
      J.pk(c, r, 'kol21 g3 old', 'HAS')
      J.sigmaCount(c, r, 'profile_failed', 0, 'D6.p')
      J.sem(c, r, J.SEM.HINT(0, 0, 'D6.q「按既有调度判据」；D6.y'))
      J.sem(c, r, J.SEM.NOT_COMPLETED_CLAIM('kol21 g3 old', 'D6.r'))
    },
  },
  {
    id: 'G3-04', group: 'G3', frozen: '可执行', spec: `${SP}:1074-1087`, runs: ['G3-04'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-04'); if (!r) return
      J.exitIs(c, r, 3, 'D12.a、D12.g、D12.w；D6.y；README.md:181；skill/SKILL.md:174；P3.d')
      J.summary(c, r, 'budget')
      J.zero(c, r, 'G2-00')
      const K = J.costOut(c, r)
      J.kExact(c, K, 'budget_usd', '0', 'D12.a')
      J.kExact(c, K, 'cost_estimate_usd', '0', 'D12.g（预留被拒且账不变）')
      J.kIs(c, K, 'requests', 0, 'D12.e')
      J.kIs(c, K, 'cost_status', 'known', 'ADR-108:33')
      J.pk(c, r, 'kol21 g3 budget a', 'HAS')
      J.pk(c, r, 'kol21 g3 budget b', 'HAS')
      J.sigmaCount(c, r, 'profile_failed', 0, 'D6.z')
      J.sem(c, r, J.SEM.HINT_BLOCK(2, 0, 'D6.q 第二句、D6.r；README.md:197；F9.b；types.ts:444'))
      J.semBoth(c, r, 'SAVED-CLAIM', 'P3.d「只有断点保存成功才以退出码 3 结束并声明已保存」')
      J.sem(c, r, J.SEM.NOT_DEFAULT_BUDGET('D13.w'))
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [
        ['新 task.json 根 budget_usd EXACT 0', exactAt(['budget_usd'], '0'), 'D12.a'],
        ['新 task.json limit_micro_usd 0', intEq(['cost_ledger', 'limit_micro_usd'], 0), 'D12.a'],
        ['新 task.json entries 为空', (n) => { const e = J.field(n, ['cost_ledger', 'entries']); return [e !== undefined && e !== 'dup' && e.t === 'arr' && e.items.length === 0, `entries = ${describe(e)}`] }, 'D12.g、D12.w'],
        ['新 task.json requests 0', fieldEq(['requests'], 0), 'D12.e'],
        ['新 task.json 无 pending', noPending, 'D12.g'],
        ['新 task.json done 为空', doneEmpty, 'F9.b'],
      ])
    },
  },
  {
    id: 'G3-04R', group: 'G3', frozen: '可执行', spec: `${SP}:1089-1094`, runs: ['G3-04R'],
    judge(c) {
      const r = c.observed('G3-04R'); if (!r) return
      J.exitIs(c, r, 3, 'D12.g、D12.w；D6.y、P3.d')
      J.summary(c, r, 'budget')
      J.zero(c, r, 'G2-00')
      J.pk(c, r, 'kol21 g2 pay', 'HAS')
      J.sem(c, r, J.SEM.HINT_BLOCK(1, 0, 'D6.q 第二句'))
      J.semBoth(c, r, 'SAVED-CLAIM', 'P3.d')
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '0' } }, '三项与 L0z 相同（D12.g、D12.w）')
      const t = J.taskAfter(r)
      onNode(c, t.node, t.problem, [
        ['task.json done 仍为 []', fieldEq(['done'], []), 'D12.g（没有付费，进度不变）'],
        ['task.json offsets 仍为 {}', fieldEq(['offsets'], {}), 'D12.g'],
      ])
    },
  },
  {
    id: 'G3-05', group: 'G3', frozen: '可执行', spec: `${SP}:1096-1110`, runs: ['G3-05'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-05'); if (!r) return
      J.exitIs(c, r, 3, 'D12.g「恰好等于上限时允许」；D12.h；D6.y、P3.d')
      J.summary(c, r, 'budget')
      J.reqExactly(c, r, '请求恰好 1 次：R0 第 0 个响应（200，关键词 a）', [['R0', 0, 'status:200']], 'D12.g；skill/SKILL.md:84')
      c.ok('R1 没被命中（关键词 b 从未请求）', J.reqsOnRule(r, 'R1').length === 0, `R1 上 ${J.reqsOnRule(r, 'R1').length} 次`, 'F9.b')
      costAll(c, J.costOut(c, r), 1, 1000, '0.001')
      J.pk(c, r, 'kol21 g3 budget b', 'HAS')
      J.semBoth(c, r, 'SAVED-CLAIM', 'P3.d')
      J.sem(c, r, J.SEM.CUSTOM('HINT-BLOCK：待补 0、待查 ≥ 1（至少 b）、额度不足的阻止原因', [
        '待补 profile 0', '待查关键词 ≥ 1（至少 b；a 是否仍算待查取决于 GAP-09，不断）', '说明额度不足的阻止原因', '不承诺直接续跑即可花钱',
      ], 'D6.q 第二句、D6.r；F9.b', true))
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [
        ['task.json 根 budget_usd EXACT 0.001', exactAt(['budget_usd'], '0.001'), 'D12.a、D13.a'],
        ['task.json limit_micro_usd 1000', intEq(['cost_ledger', 'limit_micro_usd'], 1000), 'D12.a'],
        ['task.json entries 恰一项：unit 1000、http_200_count 1、unknown_result_count 0、price_version 当前版', (n) => {
          const l = J.lc(n)
          const e = l.entries[0]
          const pv = e ? get1(e, 'price_version') : undefined
          const ok = !l.problem && l.entries.length === 1 && J.isNum(get1(e, 'unit_micro_usd'), 1000) && J.isNum(get1(e, 'http_200_count'), 1) && J.isNum(get1(e, 'unknown_result_count'), 0) && pv !== undefined && pv !== 'dup' && pv.t === 'str' && pv.v === PRICE_VERSION
          return [ok, `entries = ${describe(J.field(n, ['cost_ledger', 'entries']))}`]
        }, 'D12.h；ADR-107:106-107'],
        ['task.json 无 pending', noPending, 'D12.h'],
        ['task.json next_attempt_id ≥ 2', (n) => { const v = J.field(n, ['cost_ledger', 'next_attempt_id']); return [v !== undefined && v !== 'dup' && v.t === 'num' && Number(v.raw) >= 2, `next_attempt_id = ${describe(v)}`] }, 'ADR-107:61'],
        ['task.json requests 1（= H + U）', (n) => { const [ok, d] = reqEqHplusU(n); return [ok && J.isNum(get1(n, 'requests'), 1), d] }, 'D13.p'],
      ])
    },
  },
  {
    id: 'G3-06', group: 'G3', frozen: '附条件', spec: `${SP}:1112-1121`, runs: ['G3-06'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-06'); if (!r) return
      J.exitIs(c, r, 1, 'D6.y；skill/SKILL.md:194；tikhub.md:437')
      J.summary(c, r, 'error')
      J.err402(c, r)
      J.reqExactly(c, r, '请求恰好 1 次：T1，402', [['T1', 0, 'status:402']], 'D6.y「立即停、之后不再请求」')
      const K = J.costOut(c, r)
      J.kIs(c, K, 'requests', 0, 'D12.i')
      J.kExact(c, K, 'cost_estimate_usd', '0', 'D12.i')
      J.kExact(c, K, 'budget_usd', '1', 'D13.a')
      // 附条件子断言：PK-HAS(kol21 g3 err)（GAP-07④），补齐前不判；其余照判
      J.pk(c, r, 'kol21 g3 err', 'HAS', c.cond('GAP-07④', 'present') ? undefined : PK07)
      J.sigmaCount(c, r, 'profile_failed', 0, 'D6.z')
      J.sem(c, r, J.SEM.HINT(1, 0, 'D6.q、D6.r；types.ts:460-461'))
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [
        ['task.json done 为空', doneEmpty, 'types.ts:460-461'],
        ['task.json requests 0', fieldEq(['requests'], 0), 'D12.i'],
        ['task.json 无 pending', noPending, 'D12.i'],
      ])
    },
  },
  {
    id: 'G3-07', group: 'G3', frozen: '附条件', spec: `${SP}:1123-1145`, runs: ['G3-07'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-07'); if (!r) return
      // 冻结单写明与 GAP-39 无关的三项（退出码、stopped、ERR-402）照判；不把场景改成 target，不猜重试。
      J.exitIs(c, r, 1, 'D6.z、D6.y（profile 阶段 402 → error、退 1）')
      J.summary(c, r, 'error')
      J.err402(c, r)
      // 依赖「404 后是否改 secUid 再查」的部分（GAP-39）：只在整合方登记答案为「不再查」时按现 expected 判。
      const g39 = 'GAP-39：TikTok profile 404 后对同一人是否改用 secUid 再查未定（tikhub.md:93、:439；D6.z），补齐前不判'
      // C1fix（F-5）：本闸门只管冻结单 :1144 点名会因 404 后重查而变的「请求数与 profile_failed」；COST-OUT（:1133）与 HINT 待补 3（:1134、:1140）不在闸门内，GAP-39 未补时照判。
      if (c.cond('GAP-39', 'no-secuid-retry')) {
        J.sigmaCount(c, r, 'profile_failed', 1, 'D6.z「只数 402 之前非 402 的单人补全失败」')
        J.reqExactly(c, r, '请求恰好 3 次：T1#0(200)、T2#0(404)、T2#1(402)', [['T1', 0, 'status:200'], ['T2', 0, 'status:404'], ['T2', 1, 'status:402']], 'D6.z；D6.y')
      } else {
        for (const l of ['Σ.profile_failed === 1', '请求恰好 3 次：T1#0(200)、T2#0(404)、T2#1(402)']) c.nj(l, g39)
      }
      // 冻结脚本里只有搜索那一次 200，404、402 只撤销（:1141；D12.i）：第二个 T2 响应不论给同一人重查还是下一人，净请求都是 1、金额 $0.001，三人都仍待补（:1140）。
      // Κ.requests 是费用视图的净请求数，与上面观察器记下的请求次数（:1132）不是一回事。
      const K = J.costOut(c, r)
      J.kIs(c, K, 'requests', 1, 'D12.e、D12.i')
      J.kExact(c, K, 'cost_estimate_usd', '0.001', 'dss.md:258；D12.i')
      J.sem(c, r, J.SEM.CUSTOM('HINT 报待补 profile 3', ['续跑提示报告待补 profile 数 3（待查关键词那个数见 G3-17，不断）'], 'D6.p、D6.z', true, (t) => (t.includes('3') ? '预筛命中（含 3）' : '预筛未命中——不判红，待复核')))
    },
  },
  {
    id: 'G3-07T', group: 'G3', frozen: '可执行', spec: `${SP}:1147-1166`, runs: ['G3-07T'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-07T'); if (!r) return
      J.exitIs(c, r, 0, 'D6.y；skill/SKILL.md:192；需求方口径第 3、5 条')
      J.summary(c, r, 'target')
      J.sigmaCount(c, r, 'profile_failed', 0, 'D6.z 那一路不发生')
      J.reqExactly(c, r, '请求恰好 4 次：T1、P1、P2、P3 各自第 0 个响应（200）', [['T1', 0, 'status:200'], ['P1', 0, 'status:200'], ['P2', 0, 'status:200'], ['P3', 0, 'status:200']],
        'skill/SKILL.md:84；F9.a；product-intake.md:37；D6.p；tikhub.md:95（先后不断）')
      noIndexAbove0(c, r, 'T1 第 1 个与各 P 规则第 1 个响应（402）都没被用到', '没有第二页、没有重复补 profile')
      costAll(c, J.costOut(c, r), 4, 4000, '1')
      J.sem(c, r, J.SEM.CUSTOM('stderr 报告待补 profile 数为 0', ['语义复核报告待补 profile 数为 0（待查关键词那个数与「是否声明无新请求」见 G3-17，不断）'], 'D6.p；tikhub.md:102、:107', true))
      J.sem(c, r, J.SEM.NOT_DEFAULT_BUDGET('D13.w'))
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [
        ['新 task.json requests 4', fieldEq(['requests'], 4), 'D12.e'],
        ['新 task.json LC：H = 4、Σ(h×unit) = 4000、U = 0', lcIs(4, 0, 4000), 'dss.md:258；D12.f'],
        ['新 task.json 无 pending', noPending, 'D12.h'],
      ])
      // 限制说明：profile 请求按 uniqueId 辨认；改用 secUid 会落成 unmatched → 设施故障（ADR-70:3255、:3262）
    },
  },
  {
    id: 'G3-08', group: 'G3', frozen: '可执行', spec: `${SP}:1168-1177`, runs: ['G3-08'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-08'); if (!r) return
      J.exitIs(c, r, 1, 'D6.z；D6.y')
      J.summary(c, r, 'error')
      J.err402(c, r)
      J.sigmaCount(c, r, 'profile_failed', 0, 'D6.z（402 那人不计）')
      J.reqExactly(c, r, '请求恰好 2 次：T7#0(200)、T10#0(402)', [['T7', 0, 'status:200'], ['T10', 0, 'status:402']], 'tikhub.md:185、:253；D6.z')
      c.ok('T12（IG profile V2）一次也没被请求', J.reqsOnRule(r, 'T12').length === 0, `T12 上 ${J.reqsOnRule(r, 'T12').length} 次`, 'D6.z「同一人不改走 V2」；dss.md:246')
      const K = J.costOut(c, r)
      J.kIs(c, K, 'requests', 1, 'dss.md:258；D12.i')
      J.kExact(c, K, 'cost_estimate_usd', '0.002', 'dss.md:258（IG Reels $0.002 留存、402 撤销）')
      J.sem(c, r, J.SEM.HINT(0, 1, 'skill/SKILL.md:84；tikhub.md:187；D6.p、D6.z'))
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [['task.json done 含 0', doneHas(0), 'skill/SKILL.md:84；tikhub.md:187']])
      // 原 PK-LACKS(kol21 g3 ig) 已撤（B2r6:C1｜GAP-07），不恢复；其余断言与「可执行」不变。
    },
  },
  {
    id: 'G3-09', group: 'G3', frozen: '可执行', spec: `${SP}:1179-1188`, runs: ['G3-09'], deps: [ACC],
    judge(c) {
      const r = c.observed('G3-09'); if (!r) return
      J.exitIs(c, r, 2, 'D6.y「运行中才查出的预算或费用输入问题…error、退 2」；skill/SKILL.md:195；ADR-108:47、:17')
      J.summary(c, r, 'error')
      J.zero(c, r, 'G2-00')
      const K = J.costOut(c, r)
      J.kIs(c, K, 'requests', 0, 'D13.o')
      J.kExact(c, K, 'cost_unknown_result_usd', '0', 'D13.o「请求发出前的本地失败不得伪造无 HTTP 状态的留存」')
      const t = newTaskDir(r)
      if (!t.rel) c.pass('新 task.json（若已建）LC：U = 0', '未新建 task.json：「若已建」前提不成立，本项按原文成立', 'D13.o')
      else onNode(c, t.node, t.problem, [['新 task.json（若已建）LC：U = 0', lcIs(null, 0), 'D13.o']])
      // Σ.error 的内容不断（正本只对 402 规定了提示语义）
    },
  },
  {
    id: 'G3-10', group: 'G3', frozen: '可执行', spec: `${SP}:1190-1195`, runs: ['G3-10'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G3-10'); if (!r) return
      J.exitIs(c, r, 2, 'D13.b；D6.y；skill/SKILL.md:197')
      J.noSummaryJson(c, r)
      J.noStopped(c, r)
      J.zero(c, r, 'G2-00')
      J.sem(c, r, J.SEM.CUSTOM('stderr 写出原输入 abc', ['写出原输入 abc（D13.b「报错保留原输入」）'], 'D13.b', true, (t) => (t.includes('abc') ? '预筛命中（含 abc）' : '预筛未命中——不判红，待复核')))
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, '三项与 L0 相同；D13.j「失败不写入半份上限」')
    },
  },
  ...(['G3-11', 'G3-11B', 'G3-11N'] as const).map((id): CaseDef => ({
    id, group: 'G3', frozen: '可执行',
    spec: `${SP}:${id === 'G3-11' ? '1197-1206' : id === 'G3-11B' ? '1208-1217' : '1219-1228'}`, runs: [id], deps: [ACC],
    judge(c) {
      const r = c.observed(id); if (!r) return
      const b = id === 'G3-11B' ? 'D12.a「超出精度时拒绝，不截断、舍入或归零」；D13.a；D13.v' : 'D13.v「根上 budget_usd 存在但不合规（如 null、字符串）不算缺席，不套 $2，以退出码 2 拒绝、不建 task.json」；D13.a'
      J.exitIs(c, r, 2, b + '；D6.y；skill/SKILL.md:185')
      J.noSummaryJson(c, r)
      J.noStopped(c, r)
      J.zero(c, r, 'G2-00')
      J.treeNoTaskC(c, r, 'D13.v「不建 task.json」（是否连目录也不建不断，GAP-31）')
      J.sem(c, r, J.SEM.COST_DIAG(['配置的 budget_usd 不合规'], ['budget_usd'], 'D13.v；skill/SKILL.md:185'))
      if (id === 'G3-11N') J.treeNoTaskC(c, r, 'D13.v；需求方口径第 10 条', '新 task.json 不存在（不可能出现根 budget_usd 为 2 的任务）')
      // 默认 $2 说明的有无不断（D13.w「前置检查拒绝时，本条不规定」）；BYTES(config.json) 已由冻结单删去（B2r4:M8），不恢复。
    },
  })),
  {
    id: 'G3-12', group: 'G3', frozen: '可执行', spec: `${SP}:1230-1235`, runs: ['G2-02'], deps: [PAYDEP],
    judge(c) {
      // 就是 G2-02（F-PAY + B1）那一跑；只断退出码 2、NOT-BUDGET、零请求三项；汇总 JSON / stopped 由 G2-23a 单列（E-1）
      const r = c.observed('G2-02'); if (!r) return
      J.exitIs(c, r, 2, 'D13.s、D13.e；ADR-108:47')
      J.notBudget(c, r)
      J.zero(c, r, 'G2-00')
    },
  },
  {
    id: 'G3-13', group: 'G3', frozen: '可执行', spec: `${SP}:1237-1242`, runs: ['G1-04', 'G1-14', 'G1-02P'],
    deps: [{ kind: 'semantic', of: 'G1-02', why: '三跑（G1-04、G1-14、G1-02P）的基线都是 G1-02' }],
    judge(c) {
      for (const id of ['G1-04', 'G1-14', 'G1-02P']) {
        c.prefix = `${id} `
        const r = c.observed(id); if (!r) continue
        J.exitIs(c, r, 2, 'D6.y；skill/SKILL.md:197；D13.v')
        J.noSummaryJson(c, r)
        J.noStopped(c, r)
        J.zero(c, r, 'G2-00')
      }
      c.prefix = ''
    },
  },
  {
    id: 'G3-14a', group: 'G3', frozen: '附条件', spec: `${SP}:1244-1259`, runs: ['G3-14a'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G3-14a'); if (!r || !e2Hit(c, r)) return
      saveFail(c, r)
      J.zero(c, r, 'G2-00')
      const t = J.taskAfter(r)
      const hit = (r.e2Hits ?? []).find((h) => !h.miss)
      onNode(c, t.node, t.problem, [
        ['task.json requests === 0', fieldEq(['requests'], 0), 'D14.b'],
        ['task.json LC：H = U = 0', lcIs(0, 0), 'D14.b「不得伪造无 HTTP 状态的请求留存」'],
        ['根 budget_usd EXACT 2、limit_micro_usd 2000000', budgetKept, '不改额'],
        ['task.json done 不含 0', (n) => [!J.arrHas(get1(n, 'done'), 0), `done = ${describe(get1(n, 'done'))}`], 'D14.b'],
      ])
      if (t.node) {
        const p = J.field(t.node, ['cost_ledger', 'pending'])
        if (p === undefined) c.pass('pending 可有可无（有则只能是那笔未发出的预留）', '无 pending', 'ADR-109:47')
        else if (!hit || hit.attempt_id === undefined || hit.endpoint === undefined) c.nj('pending 可有可无（有则只能是那笔未发出的预留）', 'pending 在，但命中记录未给 attempt_id/端点，无从核是不是那一笔')
        else {
          const ok = p !== 'dup' && J.isNum(get1(p, 'attempt_id'), hit.attempt_id) && (() => { const e = get1(p, 'endpoint'); return e !== undefined && e !== 'dup' && e.t === 'str' && e.v === hit.endpoint })()
          c.ok('pending 可有可无（有则只能是那笔未发出的预留）', ok, `pending = ${describe(p)}；命中 attempt_id=${hit.attempt_id} endpoint=${hit.endpoint}`, 'ADR-109:47；E-2 第 4 条')
        }
      }
    },
  },
  {
    id: 'G3-14b', group: 'G3', frozen: '附条件', spec: `${SP}:1244-1252、:1261-1267`, runs: ['G3-14b'],
    deps: [PAYDEP, { kind: 'exit3', of: 'G3-04R', why: '前提：G3-04R（同一夹具、无注入）已按预期退 3' }],
    judge(c) {
      const r = c.observed('G3-14b'); if (!r || !e2Hit(c, r)) return
      saveFail(c, r) // 退出码 1（不是 3）；NO-STOPPED（因而也没有 budget 标签）；NO-SAVED-CLAIM
      J.zero(c, r, 'G2-00')
      J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '0' } }, '三项与 L0z 相同（D12.g、D12.w）')
    },
  },
  {
    id: 'G3-14c', group: 'G3', frozen: '附条件', spec: `${SP}:1244-1252、:1269-1278`, runs: ['G3-14c'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G3-14c'); if (!r || !e2Hit(c, r)) return
      // 还缺「已读记忆」的证据（:1277）：保存失败后不再进入生成名单（ADR-109:19），收尾读不读记忆包内没写；
      // 不读时「不被记忆错误改成 2」会被无关的东西满足，所以登记答案前不判（GAP-24b）。
      if (c.cond('GAP-24b', 'not-read')) return c.fixture('G3-14c 前提', 'GAP-24b 登记为保存失败后不读记忆：本例的区分力不存在（:1277）')
      if (!c.cond('GAP-24b', 'reads-memory')) {
        c.nj('同 G3-14a（退 1、NO-SUMMARY-JSON、NO-STOPPED、零请求、NO-SAVED-CLAIM、SAVE-FAIL-DIAG）', 'GAP-24b：保存失败后的收尾是否读记忆缺出处、也没有「已读记忆」证据（:1277；:1592）')
      } else {
        J.exitIs(c, r, 1, 'D14.h「…也不得被后续记忆错误改成退出 2」')
        J.noSummaryJson(c, r)
        J.noStopped(c, r)
        J.zero(c, r, 'G2-00')
        J.semBoth(c, r, 'NO-SAVED-CLAIM', 'D14.h；P3.d')
        J.sem(c, r, J.SEM.SAVE_FAIL_DIAG('ADR-109:19'))
      }
      if (c.cond('GAP-24c', 'unchanged')) J.bytesC(c, r, 'memory/creators.json', 'GAP-24c 登记的出处')
      else c.nj('BYTES(memory/creators.json)', 'GAP-24c：collect 读不出记忆时原文件是否必不被改动缺直接出处，补齐前不判（output-format.md:310 已撤作依据）')
    },
  },
  {
    id: 'G3-14d', group: 'G3', frozen: '附条件', spec: `${SP}:1244-1252、:1280-1288`, runs: ['G3-14d'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G3-14d'); if (!r || !e2Hit(c, r)) return
      saveFail(c, r)
      J.reqExactly(c, r, '请求恰好 1 次：T1，index 0，200（之后零请求）', [['T1', 0, 'status:200']], 'D14.c「终态保存失败退出 1，停止后续请求」')
      noBodySeq1(c, r)
      const t = J.taskAfter(r)
      twoStates(c, t.node, t.problem, '200')
      onNode(c, t.node, t.problem, [['两种情形下根 budget_usd EXACT 2、limit_micro_usd 2000000', budgetKept, 'ADR-109:47']])
    },
  },
  {
    id: 'G3-14e', group: 'G3', frozen: '附条件', spec: `${SP}:1244-1252、:1290-1295`, runs: ['G3-14e'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G3-14e'); if (!r || !e2Hit(c, r)) return
      saveFail(c, r)
      J.reqExactly(c, r, '请求恰好 1 次：T1，index 0，404（不重试、不 fallback）', [['T1', 0, 'status:404']], 'D14.d；D12.i')
      noBodySeq1(c, r)
      const t = J.taskAfter(r)
      onNode(c, t.node, t.problem, [
        ['task.json requests === 0', fieldEq(['requests'], 0), 'D12.i'],
        ['task.json LC：H = U = 0（pending 可有可无）', lcIs(0, 0), 'D14.d；ADR-109:15、:47'],
        ['根 budget_usd EXACT 2、limit_micro_usd 2000000', budgetKept, 'ADR-109:47'],
      ])
    },
  },
  {
    id: 'G3-14f', group: 'G3', frozen: '附条件', spec: `${SP}:1244-1252、:1297-1305`, runs: ['G3-14f'], deps: [PAYDEP],
    judge(c) {
      const r = c.observed('G3-14f'); if (!r || !e2Hit(c, r)) return
      saveFail(c, r)
      J.reqExactly(c, r, '请求恰好 1 次：T1，index 0，connect:fail（T4、T5 等兜底端点一次也没被请求）', [['T1', 0, 'connect:fail']], 'D14.e「不能退款或触发 fallback」；tikhub.md:440')
      const t = J.taskAfter(r)
      twoStates(c, t.node, t.problem, 'NS')
      onNode(c, t.node, t.problem, [['两种情形下根 budget_usd EXACT 2、limit_micro_usd 2000000', budgetKept, 'ADR-109:47']])
    },
  },
  {
    id: 'G3-15', group: 'G3', frozen: '附条件', spec: `${SP}:1307-1314`, runs: ['G3-15'], deps: [DONEDEP],
    judge(c) {
      const r = c.observed('G3-15'); if (!r) return
      // 未满足的前提（:1313）：名单为空的续跑是否走到读记忆这一步；若实际不读，本例夹具失格（GAP-24a）。
      if (c.cond('GAP-24a', 'not-read')) return c.fixture('G3-15 前提', 'GAP-24a 登记为名单为空的续跑不读记忆：本例夹具失格（:1313）')
      if (!c.cond('GAP-24a', 'reads-memory')) {
        c.nj('退 2、NO-SUMMARY-JSON、NO-STOPPED、零请求、HINT(0, 0)、三字段期望', 'GAP-24a：名单为空的续跑是否走到读记忆这一步未定；若不读则夹具失格（:1313；:1592）')
      } else {
        J.exitIs(c, r, 2, 'D6.y；skill/SKILL.md:198；README.md:197')
        J.noSummaryJson(c, r)
        J.noStopped(c, r)
        J.zero(c, r, 'G2-00')
        J.sem(c, r, J.SEM.HINT(0, 0, 'D6.q「记忆读不出来而中止时…两者皆零才声明无新请求」'))
        J.fk(c, r, { cost_ledger: SAME, requests: { eq: 0 }, budget_usd: { exact: '2' } }, '三项与 L0 相同')
      }
      if (c.cond('GAP-24c', 'unchanged')) J.bytesC(c, r, 'memory/creators.json', 'GAP-24c 登记的出处')
      else c.nj('BYTES(memory/creators.json)', 'GAP-24c：读不出记忆而中止时原文件是否必不被改动缺直接出处，补齐前不判（output-format.md:310 已撤作依据）')
    },
  },
  {
    id: 'G3-16', group: 'G3', frozen: '不覆盖', spec: `${SP}:1316-1319`, runs: [],
    notCovered: 'enrich 的 P3.d（额度不足停止的保存成功 / 失败）：public-metrics.md:16 已给退出口径，但构造不出待付费的处理对象——需要通过正本校验的 agent-review.json（D21、D22；semantic-fit.md:72-90）与投影后 fit=✅/⚠️ 的合法 Creator（public-metrics.md:10），完整 Creator（GAP-18）、「游离账号」「已评候选必填证据」判据（README.md:189；D21.h）都缺；enrich 也没有观察器阳性（G4-05），零请求一面无法判。GAP-16（:1584）。只登记，不写判定测试。',
  },
  {
    id: 'G3-17', group: 'G3', frozen: '附条件', spec: `${SP}:1321-1326`, runs: ['G3-05', 'G3-07', 'G3-07T'],
    judge(c) {
      // 只登记原文列出的三跑；冻结单没有给出这个数的期望值，补齐 GAP-09/10 之后也须先回 B2 写出 expected，本轮不补页数或耗尽规则。
      c.nj('G3-05 关键词 a 的待查数', 'GAP-09：一页空结果算不算耗尽（tikhub.md:444）与 TikTok 页数上限没给')
      c.nj('G3-07 TikTok 词的待查数', 'GAP-09、GAP-10：以 target 判据停在第一页之后，续跑是否再搜取决于页数上限与续跑时的达标判据（skill/SKILL.md:84）')
      c.nj('G3-07T TikTok 词的待查数与「是否声明无新请求」', 'GAP-09、GAP-10（同上）')
    },
  },
  {
    id: 'G3-18', group: 'G3', frozen: '附条件', spec: `${SP}:1328-1333`, runs: SUMMARY_RUNS_G318,
    judge(c) {
      for (const id of SUMMARY_RUNS_G318) {
        c.prefix = `${id} `
        c.nj('Σ.keywords_done 的类型', 'GAP-07①：冻结单只写「Σ.keywords_done 的类型」而未写期望类型；JSON 类型与元素形状待补，补齐后须回 B2 写出 expected')
        if (!c.cond('GAP-07①', 'array-of-keyword-strings')) { c.nj('Σ.pending_keywords 是数组、元素是关键词字符串', 'GAP-07①：pending_keywords 的 JSON 类型与元素形状缺出处（:1575 第①题）'); continue }
        if (ERROR_RUNS.has(id) && !c.cond('GAP-07④', 'present')) { c.nj('Σ.pending_keywords 是数组、元素是关键词字符串', 'error 收尾：形状子断言同以该字段在场为前提（GAP-07④，:1575）'); continue }
        const r = c.peek(id)
        if (!r) { c.nj('Σ.pending_keywords 是数组、元素是关键词字符串', `${id} 那一跑未观察成立（其设施/夹具结果在主用例报）`); continue }
        const s = J.sigmaFor(c, r, 'Σ.pending_keywords 是数组、元素是关键词字符串')
        if (!s) continue
        const v = get1(s, 'pending_keywords')
        const ok = v !== undefined && v !== 'dup' && v.t === 'arr' && v.items.every((x) => x.t === 'str')
        c.ok('Σ.pending_keywords 是数组、元素是关键词字符串', ok, `pending_keywords = ${describe(v)}${has(s, 'pending_keywords') ? '' : '（缺席）'}`, 'GAP-07① 登记的出处')
      }
      c.prefix = ''
    },
  },
]
