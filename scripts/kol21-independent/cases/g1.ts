// KOL-21 C1 · G1 最小输入与逐字段反例（冻结单 pack/30-frozen-spec.md:283-653；35 例：可执行 34、附条件 1）
// 依据只取冻结单各用例的 expected 与所引正本；用例号与标签照冻结单。
import type { CaseDef, Ctx, RunRec } from '../lib/judge.ts'
import * as J from '../lib/judge.ts'
import { CFG, PRICE_VERSION } from '../fixtures.ts'
import { get1, decEq, describe, usdFromMicro } from '../lib/json.ts'
import {
  SP, rejNew, rejProbe, rejResume, pathSem, onNode, fieldEq, exactAt, intEq, noPending, lcIs, doneLacks, doneEmpty,
  tasksEqInput, newTaskDir, sampleItems, strOf, is200,
} from './common.ts'

const ACC = { kind: 'accepted' as const, of: 'G1-02', why: 'GAP-03：全部 collect 新建用例以 G1-02 被接受为资格' }
const base = (of: string, why: string) => ({ kind: 'semantic' as const, of, why })

/** G1-01 / G1-01B / G1-19 共用的 probe expected。 */
function probeMain(c: Ctx, r: RunRec, t1Count: number): void {
  J.exitIs(c, r, 0, 'D16.a、D16.c–e、D17.g、D17.f、D28.d → README.md:183、:185；skill/SKILL.md:75')
  const pis = J.probeOut(c, r)
  J.onPi(c, pis, 'Π.sample 存在 top_post === "kol21 g1 sample desc"',
    (pi) => sampleItems(pi).some((it) => strOf(get1(it, 'top_post')) === 'kol21 g1 sample desc'), 'P1.i；types.ts:320')
  J.onPi(c, pis, 'Π.sample 没有任何项 top_post 为（未查询）',
    (pi) => !sampleItems(pi).some((it) => strOf(get1(it, 'top_post')) === '（未查询）'), 'P1.i')
  const K = J.costOut(c, r)
  J.kIs(c, K, 'cost_scope', 'process', 'skill/SKILL.md:170；ADR-109:13；ADR-108:34')
  J.kIs(c, K, 'cost_status', 'known', 'ADR-108:33')
  J.kIs(c, K, 'cost_problems', [], 'ADR-108:38')
  J.kExact(c, K, 'cost_unknown_result_usd', '0', 'D12.e；ADR-108:35')
  J.kExact(c, K, 'cost_pending_usd', '0', 'D12.f；ADR-108:35')
  const n = r.obs!.requests.filter(is200).length
  J.kIs(c, K, 'requests', n, `D12.e：只有 200 计净次数；n = 本跑观察到的 {status:200} 请求数 = ${n}`)
  const usd = usdFromMicro(1000 * n)
  J.kExact(c, K, 'cost_estimate_usd', usd, `0.001 × n（dss.md:258；tikhub.md:16；D12.f）`)
  J.kExact(c, K, 'cost_http_200_usd', usd, `0.001 × n（dss.md:258；D12.e、D12.f）`)
  J.kIs(c, K, 'cost_price_versions', [PRICE_VERSION], 'ADR-108:37；ADR-107:106-107')
  J.sem(c, r, J.SEM.DEFAULT_US('D17.l、D17.m'))
  const t1 = J.reqsOnRule(r, 'T1')
  const idx = t1.map((q) => q.index).sort()
  c.ok(`T1 上恰好 ${t1Count} 次（outcome 200，index 0…${t1Count - 1}）`,
    t1.length === t1Count && t1.every(is200) && idx.every((x, i) => x === i),
    `T1 上 ${t1.length} 次，index ${JSON.stringify(idx)}`, 'README.md:153「每个关键词、每个平台采集一页小样」；tikhub.md:141')
  const first = [...r.obs!.requests].sort((a, b) => a.seq - b.seq)[0]
  c.ok('本跑第 1 个请求在 T1', !!first && first.rule === J.ruleOf(r, 'T1'), first ? `第 1 个请求 ${J.reqKey(r, first)}` : '没有请求', '冻结单（见用例 spec 区间）')
  const allowed = ['T1', 'T2', 'T3'].map((x) => J.ruleOf(r, x))
  const off = r.obs!.requests.filter((q) => q.rule === null || !allowed.includes(q.rule))
  c.ok('全部请求只落在 T1、T2、T3 三条规则上', off.length === 0, off.length ? `落到别处 ${off.map((q) => J.reqKey(r, q)).join(', ')}` : '无', '落到陷阱即语义红；GAP-27')
  J.treeNoTaskC(c, r, 'skill/SKILL.md:170；ADR-109:13「不增加落盘」；tikhub.md:442')
}

/** G1-02 / G1-02B / G1-02C 共用的 collect 新建 expected。原 PK-HAS 已删（GAP-07④，:343、:391），不恢复。 */
function newMain(c: Ctx, r: RunRec, cfg: string, doneRule: 'lacks0' | 'empty'): void {
  J.exitIs(c, r, 1, 'D6.y；skill/SKILL.md:194；tikhub.md:437')
  J.summary(c, r, 'error')
  J.err402(c, r)
  const K = J.costOut(c, r)
  J.kIs(c, K, 'requests', 0, 'D12.i；D12.e')
  for (const f of ['cost_estimate_usd', 'cost_http_200_usd', 'cost_unknown_result_usd', 'cost_pending_usd']) J.kExact(c, K, f, '0', 'D12.e、D12.f')
  J.kIs(c, K, 'cost_status', 'known', 'ADR-108:33')
  J.kIs(c, K, 'cost_scope', 'task', 'ADR-108:34')
  J.reqExactly(c, r, '请求恰好 1 次：T1，index 0，402', [['T1', 0, 'status:402']], 'D6.y「遇 402 立即停、之后不再发任何请求」')
  J.sem(c, r, J.SEM.DEFAULT_US('D17.l、D17.m'))
  const t = newTaskDir(r)
  c.ok('恰好新增一个含 task.json 的目录', !!t.rel && t.dirIsNew, t.problem ?? `新目录 ${t.dir}（新目录=${t.dirIsNew}）`, 'D17.n；D13.v')
  onNode(c, t.node, t.problem, [
    ['task.json market === "US"', fieldEq(['market'], 'US'), 'D17.l、D17.n'],
    ['task.json target_count === 50', fieldEq(['target_count'], 50), 'D17.n'],
    ['task.json tasks 与输入深度相等', tasksEqInput(cfg), 'D16.i、D17.e'],
    ['task.json requests === 0', fieldEq(['requests'], 0), 'D12.i'],
    ['task.json cost_ledger.schema === 1', fieldEq(['cost_ledger', 'schema'], 1), 'ADR-107:58'],
    ['task.json cost_ledger.scope === "task"', fieldEq(['cost_ledger', 'scope'], 'task'), 'ADR-107:58'],
    ['task.json 无 pending', noPending, 'D12.i（402 只撤销预留）'],
    ['task.json LC：H = U = 0', lcIs(0, 0), 'D12.e'],
    doneRule === 'empty'
      ? ['task.json done 为空', doneEmpty, 'D6.y；types.ts:460-461']
      : ['task.json done 不含 0', doneLacks(0), 'types.ts:460-461'],
  ])
  J.bytesC(c, r, 'config.json', 'D13.v 末句「不回写 --config 指向的配置文件」')
}

export const G1: CaseDef[] = [
  {
    id: 'G1-01', group: 'G1', frozen: '可执行', spec: `${SP}:294-316`, runs: ['G1-01'],
    judge(c) { const r = c.observed('G1-01'); if (r) probeMain(c, r, 1) },
  },
  {
    id: 'G1-01A', group: 'G1', frozen: '可执行', spec: `${SP}:317-322`, runs: ['G1-01'],
    judge(c) {
      const r = c.observed('G1-01'); if (!r) return
      J.kExact(c, J.kappa(r), 'budget_usd', '0.5', 'ADR-108:21「默认金额只适用于新输入中预算字段缺席：collect 2、probe 0.5」；ADR-108:32')
      J.sem(c, r, J.SEM.DEFAULT_PROBE_BUDGET('ADR-108:21；skill/SKILL.md:170'))
      J.treeNoTaskC(c, r, 'ADR-109:13「process 范围，不增加落盘」')
    },
  },
  {
    id: 'G1-01B', group: 'G1', frozen: '可执行', spec: `${SP}:323-332`, runs: ['G1-01B'],
    judge(c) { const r = c.observed('G1-01B'); if (r) probeMain(c, r, 2) },
  },
  {
    id: 'G1-02', group: 'G1', frozen: '可执行', spec: `${SP}:333-356`, runs: ['G1-02'],
    judge(c) { const r = c.observed('G1-02'); if (r) newMain(c, r, CFG['G1-02'], 'lacks0') },
  },
  {
    id: 'G1-02A', group: 'G1', frozen: '可执行', spec: `${SP}:357-365`, runs: ['G1-02'],
    judge(c) {
      const r = c.observed('G1-02'); if (!r) return
      const t = newTaskDir(r)
      const bA = 'D13.v「…建出的 task.json 根 budget_usd 为 JSON 数值 2，cost_ledger 的 limit_micro_usd 为 2000000…」'
      onNode(c, t.node, t.problem, [
        ['(a) task.json 根 budget_usd 是 JSON 数值且 EXACT 2', exactAt(['budget_usd'], '2'), bA],
        ['(a) cost_ledger.limit_micro_usd === 2000000（整数）', intEq(['cost_ledger', 'limit_micro_usd'], 2000000), bA],
      ])
      J.kExact(c, J.kappa(r), 'budget_usd', '2', 'ADR-108:32')
      J.sem(c, r, J.SEM.DEFAULT_BUDGET('D13.w'))
      J.bytesC(c, r, 'config.json', 'D13.v 末句')
      // (c)：目录名 kol-alpha- 加 12 位数字，位于 <RUN>/cwd/output/ 下；在 cwd 下别处 → GAP-03 报需求方，不记红
      if (!t.dir) c.red('(c) 新目录名为 kol-alpha- 加 12 位数字', t.problem ?? '没有新任务目录', 'output-format.md:12、:29')
      else {
        const name = t.dir.split('/').pop()!
        const parent = t.dir.split('/').slice(0, -1).join('/')
        c.ok('(c) 新目录名为 kol-alpha- 加 12 位数字', /^kol-alpha-\d{12}$/.test(name), `目录名 ${name}`, 'output-format.md:12、:29')
        if (parent === 'output') c.pass('(c) 位于 <RUN>/cwd/output/ 下', `位于 ${parent}/`, 'README.md:157、:160')
        else c.nj('(c) 位于 <RUN>/cwd/output/ 下', `目录在 cwd 下的「${parent || '.'}」：按 :362 记 GAP-03 报需求方，不记红`)
      }
    },
  },
  {
    id: 'G1-02D', group: 'G1', frozen: '附条件', spec: `${SP}:366-372`, runs: ['G1-02'],
    judge(c) {
      const r = c.observed('G1-02'); if (!r) return
      const label = 'DEFAULT-BUDGET 说明先于第一次实际 HTTP 尝试'
      const e3 = c.env.e3
      // 只有 E-3 取 stderr 通道时，才能据「默认说明在第一条 reserved 事件之前」判；否则 GAP-40，不从分存的 stderr/request 猜先后。
      if (!(c.cond('E-3') && e3 && e3.channel === 'stderr')) {
        return c.nj(label, 'GAP-40：stderr 写出时刻与观察器 request 事件之间没有公开的先后关系；E-3 未公开或未取 stderr 通道', 'D13×P3 req:1021')
      }
      if (!e3.ready(r.obs!)) return c.fixture(label, 'E-3 就绪标记缺席（A.0.10 第 4 条，:279）')
      const firstRes = e3.events(r.obs!).filter((e) => e.result === 'reserved' && e.stderrLine !== undefined).map((e) => e.stderrLine!).sort((a, b) => a - b)[0]
      const rec = c.env.reviews.get('G1-02A/DEFAULT-BUDGET')
      if (!rec || rec.verdict !== 'pass' || !(rec.quotes ?? []).length) return c.pending(label, '待 G1-02A 的 DEFAULT-BUDGET 复核通过并引出所依据的那一行')
      const lines = r.obs!.stderr.split('\n')
      const at = lines.findIndex((l) => rec.quotes!.some((q) => l.includes(q)))
      if (firstRes === undefined) return c.red(label, '没有 reserved 事件（与 G1-02 的 1 次请求不对应）', 'E-3 第 4 条')
      c.ok(label, at >= 0 && at < firstRes, `默认说明在 stderr 第 ${at} 行，第一条 reserved 事件在第 ${firstRes} 行`, 'D13×P3 req:1021；E-3')
    },
  },
  {
    id: 'G1-02P', group: 'G1', frozen: '可执行', spec: `${SP}:373-383`, runs: ['G1-02P'], deps: [base('G1-02', '基线 G1-02（只差 product，:375）')],
    judge(c) {
      const r = c.observed('G1-02P'); if (!r) return
      J.exitIs(c, r, 2, 'D13.v「只缺 product 的配置因 product 不合规以退出码 2 结束」')
      J.noSummaryJson(c, r)
      J.noStopped(c, r)
      J.zero(c, r, 'G2-00')
      J.treeNoDirC(c, r, 'D13.v「不建任务目录、不写 task.json」')
      J.bytesC(c, r, 'config.json', '冻结单（见用例 spec 区间）')
      // 默认预算说明的有无不断（D13.w）；product 问题的诊断措辞正本未规定，不断。
    },
  },
  {
    id: 'G1-02B', group: 'G1', frozen: '可执行', spec: `${SP}:384-394`, runs: ['G1-02B'], deps: [ACC],
    judge(c) { const r = c.observed('G1-02B'); if (r) newMain(c, r, CFG['G1-02B'], 'empty') },
  },
  {
    id: 'G1-02C', group: 'G1', frozen: '可执行', spec: `${SP}:395-405`, runs: ['G1-02C'], deps: [ACC],
    judge(c) {
      const r = c.observed('G1-02C'); if (!r) return
      newMain(c, r, CFG['G1-02C'], 'lacks0')
      J.kExact(c, J.kappa(r), 'budget_usd', '2', 'D13.a')
      const t = newTaskDir(r)
      // 手算推导 ①–③：D13 总句 req:918 同一精确费用依据；D13.k req:962 无 --budget 时根预算与账上限不一致不得付费；本跑预期真发 1 次请求 → 新账上限必等于根 2 美元 = 2000000 µ$（D12.a）
      onNode(c, t.node, t.problem, [
        ['task.json 根 budget_usd EXACT 2', exactAt(['budget_usd'], '2'), 'D13.a'],
        ['cost_ledger.limit_micro_usd = 2000000', intEq(['cost_ledger', 'limit_micro_usd'], 2000000), 'req:918；D13.k req:962；D12.a'],
      ])
      J.sem(c, r, J.SEM.NOT_DEFAULT_BUDGET('D13.w「根上写了合规 budget_usd 时不打默认说明」'))
    },
  },
  {
    id: 'G1-02U', group: 'G1', frozen: '可执行', spec: `${SP}:406-412`, runs: ['G1-02U'], deps: [ACC],
    judge(c) {
      const r = c.observed('G1-02U'); if (!r) return
      J.exitIs(c, r, 1, 'D6.y（402 收尾同 G1-02，:410）')
      J.summary(c, r, 'error')
      J.err402(c, r)
      J.reqExactly(c, r, '请求恰好 1 次：T1，402', [['T1', 0, 'status:402']], 'D6.y')
      J.kExact(c, J.costOut(c, r), 'budget_usd', '3', 'D13.u')
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [
        ['task.json 根 budget_usd 是 JSON 数值且 EXACT 3', exactAt(['budget_usd'], '3'), 'D13.u「…根 budget_usd 为 --budget 所给金额的美元 JSON 数值」'],
        ['cost_ledger.limit_micro_usd === 3000000', intEq(['cost_ledger', 'limit_micro_usd'], 3000000), 'D13.u；D12.a'],
      ])
      J.sem(c, r, J.SEM.NOT_DEFAULT_BUDGET('D13.u「不打未提供预算、采用默认 $2 的说明」'))
      J.bytesC(c, r, 'config.json', '冻结单（见用例 spec 区间）')
    },
  },
  {
    id: 'G1-02W', group: 'G1', frozen: '可执行', spec: `${SP}:413-419`, runs: ['G1-02W'], deps: [ACC],
    judge(c) {
      const r = c.observed('G1-02W'); if (!r) return
      J.exitIs(c, r, 2, 'D13.b req:926；D28.b；D6.y、skill/SKILL.md:197')
      J.noSummaryJson(c, r)
      J.noStopped(c, r)
      J.zero(c, r, 'G2-00')
      J.treeNoTaskC(c, r, 'D28.b「实参不合规时先拒实参、不读配置」')
      J.bytesC(c, r, 'config.json', '冻结单（见用例 spec 区间）')
      J.sem(c, r, J.SEM.CUSTOM('stderr：--budget 值不合规并写出原输入 abc', ['指出 --budget 的值不合规', '写出原输入 abc（D13.b「报错保留原输入」）'], 'D13.b', true,
        (t) => (t.includes('abc') ? '预筛命中（含 abc）' : '预筛未命中（含 abc）——不判红，待复核')))
    },
  },
  {
    id: 'G1-02X', group: 'G1', frozen: '可执行', spec: `${SP}:420-426`, runs: ['G1-02X'], deps: [ACC],
    judge(c) {
      const r = c.observed('G1-02X'); if (!r) return
      J.exitIs(c, r, 2, 'D13.b「…缺操作数均拒绝」')
      J.noSummaryJson(c, r)
      J.noStopped(c, r)
      J.zero(c, r, 'G2-00')
      J.treeNoTaskC(c, r, '冻结单（见用例 spec 区间）')
      J.bytesC(c, r, 'config.json', '冻结单（见用例 spec 区间）')
      J.sem(c, r, J.SEM.CUSTOM('stderr：--budget 缺少金额', ['指出 --budget 缺少金额'], 'D13.b', true))
    },
  },
  {
    id: 'G1-03', group: 'G1', frozen: '可执行', spec: `${SP}:427-438`, runs: ['G1-03'],
    judge(c) {
      const r = c.observed('G1-03'); if (!r) return
      J.exitIs(c, r, 0, 'D17.a；README.md:153')
      J.probeOut(c, r)
      const onT1 = r.obs!.requests.filter((q) => q.endpoint === r.script.script.rules[J.ruleOf(r, 'R0')].endpoint)
      const r0 = J.ruleOf(r, 'R0'); const r1 = J.ruleOf(r, 'R1')
      c.ok('T1 上的请求恰 1 次且 rule 为 R0（region=us），没有 R1', onT1.length === 1 && onT1[0].rule === r0 && !r.obs!.requests.some((q) => q.rule === r1),
        `T1 上 [${onT1.map((q) => J.reqKey(r, q)).join(', ')}]`, 'D17.o「probe 交给搜索的 market 保留原值、不改大小写」；tikhub.md:52、:84')
      J.sem(c, r, J.SEM.NOT_DEFAULT_US('D17.m'))
      // 限制说明：发了别的值或不带 region 会落成 unmatched → 设施故障，不是语义红。
    },
  },
  {
    id: 'G1-03C', group: 'G1', frozen: '可执行', spec: `${SP}:439-449`, runs: ['G1-03C'], deps: [ACC],
    judge(c) {
      const r = c.observed('G1-03C'); if (!r) return
      J.exitIs(c, r, 1, '402 收尾同 G1-02')
      J.summary(c, r, 'error')
      J.err402(c, r)
      J.reqExactly(c, r, '请求恰好 1 次：R0（region=us），402', [['R0', 0, 'status:402']], 'D17.o')
      const t = newTaskDir(r)
      onNode(c, t.node, t.problem, [['task.json market === "us"', fieldEq(['market'], 'us'), 'D17.o「新建任务状态保存原值」']])
      J.sem(c, r, J.SEM.NOT_DEFAULT_US('D17.m'))
    },
  },
  {
    id: 'G1-04', group: 'G1', frozen: '可执行', spec: `${SP}:450-460`, runs: ['G1-04'], deps: [base('G1-02', '基线 G1-02')],
    judge(c) {
      const r = c.observed('G1-04'); if (!r) return
      rejNew(c, r)
      pathSem(c, r, 'config', 'D16.k；README.md:183')
      J.sem(c, r, J.SEM.ABSENT('tasks', 'D16.a「缺席写明缺席」'))
      J.sem(c, r, J.SEM.NOT_TASKS_NAMED('D16.a'))
    },
  },
  {
    id: 'G1-05', group: 'G1', frozen: '可执行', spec: `${SP}:461-471`, runs: ['G1-05'], deps: [base('G1-01', '基线 G1-01')],
    judge(c) {
      const r = c.observed('G1-05'); if (!r) return
      rejProbe(c, r)
      pathSem(c, r, 'probe', 'README.md:183「坏任务…会带文件路径一起报告」')
      J.sem(c, r, J.SEM.ABSENT('tasks', 'D16.a → D16.l、D16.m'))
      J.sem(c, r, J.SEM.NOT_TASKS_NAMED('D16.a'))
    },
  },
  {
    id: 'G1-06', group: 'G1', frozen: '可执行', spec: `${SP}:472-481`, runs: ['G1-06'], deps: [base('G1-02', '基线 G1-02')],
    judge(c) {
      const r = c.observed('G1-06'); if (!r) return
      rejNew(c, r)
      pathSem(c, r, 'config', 'D16.k')
      J.sem(c, r, J.SEM.FIELD('tasks', 'D16.a'))
      J.sem(c, r, J.SEM.RAW('[]', 'D16.a「写出读到的值」'))
      J.sem(c, r, J.SEM.NOT_TASKS_NAMED('D16.a'))
    },
  },
  {
    id: 'G1-07', group: 'G1', frozen: '可执行', spec: `${SP}:482-490`, runs: ['G1-07'], deps: [base('G1-01', '基线 G1-01')],
    judge(c) {
      const r = c.observed('G1-07'); if (!r) return
      rejProbe(c, r)
      pathSem(c, r, 'probe', 'README.md:183')
      J.sem(c, r, J.SEM.FIELD('tasks', 'D16.a → D16.l、D16.m'))
      J.sem(c, r, J.SEM.RAW('[]', 'D16.a'))
      J.sem(c, r, J.SEM.NOT_TASKS_NAMED('D16.a'))
    },
  },
  {
    id: 'G1-08', group: 'G1', frozen: '可执行', spec: `${SP}:491-500`, runs: ['G1-08'], deps: [base('G1-02B', '基线 G1-02B（只差第 2 个任务的 keyword，:493）'), ACC],
    judge(c) {
      const r = c.observed('G1-08'); if (!r) return
      rejNew(c, r)
      pathSem(c, r, 'config', 'D16.k')
      J.sem(c, r, J.SEM.ORD(2, 'keyword', 'D16.b「从 1 数」、D16.h'))
      J.sem(c, r, J.SEM.FIELD('keyword', 'D16.c'))
      J.sem(c, r, J.SEM.RAW('"   "', 'D16.c「写读到的值」'))
    },
  },
  {
    id: 'G1-09', group: 'G1', frozen: '可执行', spec: `${SP}:501-509`, runs: ['G1-09'], deps: [base('G1-01B', '基线 G1-01B')],
    judge(c) {
      const r = c.observed('G1-09'); if (!r) return
      rejProbe(c, r)
      pathSem(c, r, 'probe', 'README.md:183')
      J.sem(c, r, J.SEM.ORD(2, 'keyword', 'D16.b、D16.h'))
      J.sem(c, r, J.SEM.FIELD('keyword', 'D16.c → D16.l、D16.m'))
      J.sem(c, r, J.SEM.RAW('"   "', 'D16.c'))
    },
  },
  {
    id: 'G1-10', group: 'G1', frozen: '可执行', spec: `${SP}:510-519`, runs: ['G1-10'], deps: [base('G1-02B', '基线 G1-02B'), ACC],
    judge(c) {
      const r = c.observed('G1-10'); if (!r) return
      rejNew(c, r)
      pathSem(c, r, 'config', 'D16.k')
      J.sem(c, r, J.SEM.ORD(2, 'dimension', 'D16.b、D16.h'))
      J.sem(c, r, J.SEM.FIELD('dimension', 'D16.d'))
      J.sem(c, r, J.SEM.RAW('"Scene"', 'D16.d「按原值比较、区分大小写」'))
    },
  },
  {
    id: 'G1-11', group: 'G1', frozen: '可执行', spec: `${SP}:520-528`, runs: ['G1-11'], deps: [base('G1-01B', '基线 G1-01B')],
    judge(c) {
      const r = c.observed('G1-11'); if (!r) return
      rejProbe(c, r)
      pathSem(c, r, 'probe', 'README.md:183')
      J.sem(c, r, J.SEM.ORD(2, 'dimension', 'D16.b、D16.h'))
      J.sem(c, r, J.SEM.FIELD('dimension', 'D16.d → D16.l、D16.m'))
      J.sem(c, r, J.SEM.RAW('"Scene"', 'D16.d'))
    },
  },
  {
    id: 'G1-12', group: 'G1', frozen: '可执行', spec: `${SP}:529-538`, runs: ['G1-12'], deps: [base('G1-02B', '基线 G1-02B'), ACC],
    judge(c) {
      const r = c.observed('G1-12'); if (!r) return
      rejNew(c, r)
      pathSem(c, r, 'config', 'D16.k')
      J.sem(c, r, J.SEM.ORD(2, 'platform', 'D16.b、D16.h'))
      J.sem(c, r, J.SEM.ABSENT('platform', 'D16.e；D16×P1 req:1259「缺席时不以默认值补齐」'))
    },
  },
  {
    id: 'G1-13', group: 'G1', frozen: '可执行', spec: `${SP}:539-547`, runs: ['G1-13'], deps: [base('G1-01B', '基线 G1-01B')],
    judge(c) {
      const r = c.observed('G1-13'); if (!r) return
      rejProbe(c, r)
      pathSem(c, r, 'probe', 'README.md:183')
      J.sem(c, r, J.SEM.ORD(2, 'platform', 'D16.b、D16.h'))
      J.sem(c, r, J.SEM.ABSENT('platform', 'D16.e → D16.l、D16.m'))
    },
  },
  {
    id: 'G1-14', group: 'G1', frozen: '可执行', spec: `${SP}:548-557`, runs: ['G1-14'], deps: [base('G1-02', '基线 G1-02')],
    judge(c) {
      const r = c.observed('G1-14'); if (!r) return
      rejNew(c, r)
      pathSem(c, r, 'config', 'D17.i')
      J.sem(c, r, J.SEM.FIELD('market', 'D17.a、D17.d'))
      J.sem(c, r, J.SEM.RAW('null', 'D17.d'))
      J.sem(c, r, J.SEM.CUSTOM('诊断表达「值为 null」而不是「缺席」', ['那条诊断表达的是「值为 null」而不是「缺席」（D17.d 可区分）'], 'D17.a、D17.g、D17.d', true))
    },
  },
  {
    id: 'G1-15', group: 'G1', frozen: '可执行', spec: `${SP}:558-567`, runs: ['G1-15'], deps: [base('G1-01', '基线 G1-01')],
    judge(c) {
      const r = c.observed('G1-15'); if (!r) return
      rejProbe(c, r)
      pathSem(c, r, 'probe', 'D17.k')
      J.sem(c, r, J.SEM.FIELD('market', 'D17.a → D17.j、D17.k'))
      J.sem(c, r, J.SEM.RAW('null', 'D17.d'))
      J.sem(c, r, J.SEM.CUSTOM('RAW(null) 与缺席可区分', ['诊断里的 null 与「缺席」可区分'], 'D17.d', true))
      J.sem(c, r, J.SEM.NO_INTERNAL('D17.k 已重述「不带内部异常类名与堆栈」'))
    },
  },
  {
    id: 'G1-16', group: 'G1', frozen: '可执行', spec: `${SP}:568-578`, runs: ['G1-16'], deps: [base('G1-02C', '基线 G1-02C'), ACC],
    judge(c) {
      const r = c.observed('G1-16'); if (!r) return
      rejNew(c, r, { sameTree: true })
      pathSem(c, r, 'config', 'D28.b；README.md:185')
      J.sem(c, r, J.SEM.FIELD('budget_usd', 'D28.a'))
      J.sem(c, r, J.SEM.CUSTOM('原文 2.5 与 3.75 都出现且 2.5 在前', ['stderr 写出每一处原文 2.5 与 3.75，按文件先后，2.5 在前（D28.a）'], 'D28.a、D28.b', true,
        (t) => { const a = t.indexOf('2.5'); const b = t.indexOf('3.75'); return a >= 0 && b >= 0 && a < b ? '预筛：两处原文都出现且 2.5 在前' : `预筛未满足（2.5@${a}，3.75@${b}）——不判红，待复核` }))
      J.sem(c, r, J.SEM.CUSTOM('出现次数 2、位置在配置根上', ['诊断指出出现次数为 2', '位置在配置根上（只按 D28.a 已重述的「位置、出现次数与按文件先后的每一处原文」判）'], 'D28.a', true))
    },
  },
  {
    id: 'G1-17', group: 'G1', frozen: '可执行', spec: `${SP}:579-588`, runs: ['G1-17'], deps: [base('G1-01', '基线 G1-01')],
    judge(c) {
      const r = c.observed('G1-17'); if (!r) return
      rejProbe(c, r)
      J.stdoutEmpty(c, r)
      pathSem(c, r, 'probe', 'D28.c')
      J.sem(c, r, J.SEM.FIELD('keyword', 'D28.a'))
      J.sem(c, r, J.SEM.CUSTOM('原文 "kol21 g1 dup-first" 在 "kol21 g1 dup-second" 之前', ['写出每一处原文，按文件先后："kol21 g1 dup-first" 在 "kol21 g1 dup-second" 之前'], 'D28.a、D28.c', true,
        (t) => { const a = t.indexOf('"kol21 g1 dup-first"'); const b = t.indexOf('"kol21 g1 dup-second"'); return a >= 0 && b >= 0 && a < b ? '预筛：两处原文都出现且先后对' : `预筛未满足（first@${a}，second@${b}）——不判红，待复核` }))
      J.sem(c, r, J.SEM.NO_INTERNAL('D28.c'))
      J.sem(c, r, J.SEM.CUSTOM('出现次数 2、位置为第 1 个任务', ['诊断指出出现次数 2', '位置为第 1 个任务'], 'D28.a', true))
    },
  },
  {
    id: 'G1-18', group: 'G1', frozen: '可执行', spec: `${SP}:589-598`, runs: ['G1-18'], deps: [base('G1-02', '基线 G1-02')],
    judge(c) {
      const r = c.observed('G1-18'); if (!r) return
      rejNew(c, r)
      pathSem(c, r, 'config', 'D17.i')
      J.sem(c, r, J.SEM.FIELD('target_count', 'D17.b'))
      J.sem(c, r, J.SEM.RAW('"50"', 'D17.d'))
      J.sem(c, r, J.SEM.CUSTOM('原值是字符串 "50"、与数 50 可区分', ['诊断里的原值是字符串 "50"、与数 50 可区分'], 'D17.b、D17.d', true))
    },
  },
  {
    id: 'G1-19', group: 'G1', frozen: '可执行', spec: `${SP}:599-608`, runs: ['G1-19'], deps: [base('G1-01', '基线 G1-01')],
    judge(c) {
      const r = c.observed('G1-19'); if (!r) return
      c.ok('退出码不是 2', r.obs!.status !== 2, `退出码 ${r.obs!.status}`, 'D17.f「无论该字段缺席或取何值，都不因它返回问题」；README.md:185')
      probeMain(c, r, 1)
    },
  },
  {
    id: 'G1-20', group: 'G1', frozen: '可执行', spec: `${SP}:609-619`, runs: ['G1-20'], deps: [base('G2-00', '基线 G2-00；F-PAY 确有待付费工作')],
    judge(c) {
      const r = c.observed('G1-20'); if (!r) return
      rejResume(c, r)
      pathSem(c, r, 'task', 'D19.f')
      J.sem(c, r, J.SEM.FIELD('done', 'D19.f'))
      J.sem(c, r, J.SEM.CUSTOM('指出重复的索引 0', ['指出重复的索引 0（D19.c「指出字段及非法索引或值」）'], 'D19.a、D19.c', true))
    },
  },
  {
    id: 'G1-21', group: 'G1', frozen: '可执行', spec: `${SP}:620-629`, runs: ['G1-21'], deps: [base('G2-00', '基线 G2-00')],
    judge(c) {
      const r = c.observed('G1-21'); if (!r) return
      rejResume(c, r)
      pathSem(c, r, 'task', 'D19.f')
      J.sem(c, r, J.SEM.FIELD('offsets', 'D19.f'))
      J.sem(c, r, J.SEM.CUSTOM('指出键 0 与值 null', ['指出键 0 与值 null'], 'D19.b、D19.c', true))
    },
  },
  {
    id: 'G1-22', group: 'G1', frozen: '可执行', spec: `${SP}:630-636`, runs: ['G1-22'], deps: [base('G2-00', '基线 G2-00')],
    judge(c) {
      const r = c.observed('G1-22'); if (!r) return
      rejResume(c, r) // BYTES(task.json) ⇒ 根 budget_usd 仍是 2、limit_micro_usd 仍是 2000000
      pathSem(c, r, 'task', 'D19.f')
      J.sem(c, r, J.SEM.FIELD('done', 'D19.f'))
      J.sem(c, r, J.SEM.CUSTOM('指出重复的索引 0', ['指出重复的索引 0'], 'D19.c', true))
    },
  },
  {
    id: 'G1-23', group: 'G1', frozen: '可执行', spec: `${SP}:637-643`, runs: ['G1-23'], deps: [base('G2-00', '基线 G2-00')],
    judge(c) {
      const r = c.observed('G1-23'); if (!r) return
      rejResume(c, r)
      pathSem(c, r, 'task', 'D17.i')
      J.sem(c, r, J.SEM.ABSENT('target_count', 'D17.c「续跑角色缺席字段逐个报错、不套新输入缺省」；D17.d'))
    },
  },
  {
    id: 'G1-24', group: 'G1', frozen: '可执行', spec: `${SP}:644-653`, runs: ['G1-24'], deps: [base('G1-01', '基线 G1-01')],
    judge(c) {
      const r = c.observed('G1-24'); if (!r) return
      J.exitIs(c, r, 0, 'D28.d、D28.a；D16.h')
      J.probeOut(c, r)
      J.costOut(c, r)
      const t1 = J.reqsOnRule(r, 'T1')
      c.ok('T1 上至少 1 次', t1.length >= 1, `T1 上 ${t1.length} 次（相同任务是否合并请求无出处，不断次数）`, '冻结单（见用例 spec 区间）')
    },
  },
]
// 未用到的导入防误删提示：describe、decEq 供将来补断言时使用（不影响判定）。
void describe; void decEq
