# 1-docs.md · 业务层：`docs/*`、`docs/adr/`、`skill/*` 的每条新增或修改

**装什么**：本产品对提案的实例化 —— 登记表字段与草案判据、假设登记表、架构文档、约定、同步表、ADR 清单、Skill 文本、新文件 `docs/EVOLUTION.md`；source §C.2 的 TypeScript 形状、§C.5 的 JSON 示例、§C.6 的迁移 PR、§D.2 术语表与草案判据原文、§D.7 假设表、§G 的传感器 / 控制变量 / 扰动 / 熔断 / 起点数字都原文落在这里；source §C.1 三种放法比较表、§C.3 成分 → 字段表、§C.4 三个坏例、§C.8 交人分歧的原文也在这里。
**不装什么**：换个产品也成立的规则（只写「实例化：通-xx」，原文在 `0-process.md`）；代码改动（只写「守法：码-xx」，在 `2-code.md`）；现状分析与数字的推导（在 `9-evidence.md`）；落地步骤本身（在 `3-rollout.md`）；P3 试点的叙述（在 `8-p3-pilot.md`）。
**编号怎么读**：`业-NN` 只在本文件定义；`通-NN` / `码-NN` / `H0a…H12` / `J1…J49` / `B` / `CE` / `I` / `L` / `A` / `N` / `R` 沿用 source（拆分前的单文件版，见 README）；每条末尾的「档」是 `0-process.md 通-20` 的三档（自动 / 提议 / 人批）；「变更分类」都是提议分类，由评定者按 `process/2-CHANGE.md` 定；所有判据都是草案，不改任何现行需求文本；证据标记只用五种（实跑 / #75 自述 / 读代码 / 联网核对 / 尚未验证），无标记按「读代码」；`file:line` 指主干 `cc132a7`，登记表与文档行号按 inventory 已核对的当前文件；「落地」行的「H 第 n 步」= `3-rollout.md` 的 `Hn`（第 0 步的五条子 PR 写「H 第 0a…0e 步」）。

---

## 1. `docs/requirements.json`

### 1.1 根级与判据级字段

### 业-01 · 登记表根级新键 `terms` / `retired_ids` / `ears_policy`
- **目标文件**：docs/requirements.json · 根对象（行 1–11，今天只有 `$comment` / `content_hash` / `categories` / `requirements`）
- **实例化**：通-01（结构化子句的字段集）、通-02（术语表带 oracle）、通-03（退役编号机器化）
- **现状**：根对象上的新键**不进指纹、不校验、不渲染**（source §C.0，实跑）；`content_hash` 是派生字段、由 `spec-sync --write` 写（requirements.json:2 的 `$comment`），今天只自动覆盖需求与判据上的字段（source §C.0）。
- **提议**：加三键，形状照 §C.2 `EarsRoot`（业-02 的代码块）：`terms?: Record<string, Term>`（键形 `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`，如 `budget.paid_request`）、`retired_ids?: string[]`、`ears_policy?: { require: 'none' | 'redline' | 'all' }`；三键进 `content_hash`（R7：`contentHash` 输入加一行）。
- **变更分类（提议）**：需求有歧义 → 补充（不改任何一条需求要什么）
- **守法**：码-01（R5 / R7 / R8）、码-02（`contentHash` 输入与渲染）
- **落地**：H 第 2 步 · 裁决 J10、J38 · 档：提议

### 业-02 · 判据级可选字段 `accept[].ears`：`{ clauses }` 或 `{ none: { verify, why } }`
- **目标文件**：docs/requirements.json · 字段 `accept[].ears`（§C.2 的 `EarsClause` / `EarsNone` / `Criterion` 落这里）
- **实例化**：通-01、通-05（字段与消费者同一 PR；句型与验证者派生不存）、通-06（一条判据下的多条子句只能是同一路径的边界枚举）
- **现状**：给判据加未知字段 `validateRegistry` 0 问题、`renderTables` 输出与基线逐字相同、`--write` 保留键序，但 `content_hash` 会变（source §C.0，实跑）；`Criterion` 今天只有 `id` / `text`。
- **提议**：`Criterion { id; text; ears?: Ears }`，`Ears = { clauses: EarsClause[] } | { none: EarsNone }`，子句 id 形 `{判据}/{n}`；完整形状见下方代码块（source §C.2 原文）。`unknown` 三个落处：**说的是范围** → 需求正文；**说的是这条判据** → `ears.none`（`human` / `unmeasured`）；**说的是某个术语** → `oracle: none`，三者审计里都单列。句型由 `earsType(clause)` 从字段派生、验证者由 `verifierOf(clause, terms)` 从 oracle 派生（`exit_code` / `stdout_json` / `fixture` → selfcheck，`call` → test，`source_grep` / `file_text` → lint，`human` → 人工），不存字段；范围边界回 `text`（ADR-67 原裁决）。各成分（trigger / state / condition / feature / response / prohibited response / observable outcome / 例外 / 不保证 / 两种 `none` / `oracle: none`）→ 字段 → 术语 kind → P3 例，见下方 §C.3 表。§C.8 交人决定的分歧 —— 子句层存废、`guard` / `if` 分不分字段、`text` 派生时机与开关、验证者存储还是派生、审计是否收紧到判据级变异、`unmeasured` 档存废、`examples` 是否进登记表 —— 每处的两方论据与「评审指出的两处硬伤」逐条原文见本条末尾小节「§C.8 交人决定的分歧（原文）」；本文暂取：保留子句层、合并 guard、迁移期 `text` 不动、派生验证者、保留 `unmeasured` 与 `examples`。
- **变更分类（提议）**：补充（字段可选，`text` 不动）
- **守法**：码-01（R1–R6、R9、R11）、码-02（派生渲染）、码-03（审计「靠什么验」列与 `levels` 栏）
- **落地**：H 第 2 步 · 裁决 J11、J38、J47 · 档：提议

source §C.3 各成分怎么表示（原文，第 5 问；「术语表在 D.2」指 业-06 的表，`8-p3-pilot.md §D.2` 同一份）：

| EARS 成分 | 字段 | 术语 kind | P3 例（术语表在 D.2） |
|---|---|---|---|
| trigger | `when` | `event` | `budget.request_proposed` |
| state | `while` | `state` | `task.running`、`task.resumable` |
| condition / exception（与 `when` 同现时是 guard） | `if` | `condition` | `budget.cost_exceeds_limit`、`budget.limit_unparseable` |
| feature enabled | `where` | `feature` | P4 的 `--ignore-memory` 开关（不在 D.2 的 P3 子集里） |
| response | `shall` | `response` | `budget.raise_exceeded` |
| prohibited response | `shall_not` | `response` | `provider.emit_request`、`budget.change_count` |
| observable outcome（含期望值） | `outcome` | `outcome` / `quantity` | `{ term: 'process.exit_code', expect: 3 }` |
| 例外 | `unless` | `condition` / `state` | `memory.unreadable`（P3 × D4 交点登记后才可用，J9） |
| 「不保证 / 不裁决」 | —（回 `text`） | — | 「并发时本条不保证」写在需求正文 |
| 「保证了但机器观测不到」 | `ears: { none: { verify: 'human' } }` | — | P2.a |
| 「决定了但本仓库测不了」 | `ears: { none: { verify: 'unmeasured' } }` | — | U6.c（浏览器行为） |
| 「还没决定怎么观察」的术语 | 术语的 `oracle: [{ kind: 'none' }]` | — | 审计单列，红线不许 |

source §C.2 数据模型（原文）：

```ts
// ── 根级新键（都不进现有指纹，要把它们加进 contentHash 的输入）──
interface EarsRoot {
  terms?: Record<string, Term>        // 词汇表，键形 ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$，如 'budget.paid_request'
  retired_ids?: string[]              // 退役的判据 id 与子句 id；现行 id 命中即红（补 ADR-67 只活在散文里的那份清单）
  ears_policy?: { require: 'none' | 'redline' | 'all' }   // 迁移闸：哪些判据必须有 ears（或显式 none）
}

// ── 词汇表 ──
type TermKind = 'state' | 'event' | 'condition' | 'response' | 'outcome' | 'feature' | 'quantity'

type Oracle =
  | { kind: 'invoke';      entry?: string; module?: string; export?: string; with?: Record<string, Literal> }  // event：怎么触发
  | { kind: 'call';        module: string; export: string; expect: 'returns' | 'throws' | 'unchanged'; error_name?: string }
  | { kind: 'exit_code';   entry: string; codes: number[] }
  | { kind: 'stdout_json'; entry: string; pointer: string }             // JSON Pointer
  | { kind: 'stderr_match';entry: string; pattern: string }
  | { kind: 'file_json';   path: string; pointer: string }
  | { kind: 'file_text';   path: string; contains?: string; matches?: string }
  | { kind: 'source_grep'; glob: string; pattern: string; expect: 'absent' | 'present' }   // S1.a 这类
  | { kind: 'call_count';  of: string }                                   // 「没有发出请求」这类
  | { kind: 'fixture';     harness: 'selfcheck' | 'fake-fetch' | 'crash-inject'; label: string }  // 只有夹具能观测的量
  | { kind: 'model';       why: string }                                  // 只在模型里存在（ghost / 模型专有状态）
  | { kind: 'human';       who: string; mitigation: string }              // 显式：只能靠人
  | { kind: 'none';        why: string }                                  // 显式：尚未决定怎么观察

interface Term {
  kind: TermKind
  def: string              // 人话定义；过 implementationLeak（why-rule.ts）
  params?: string[]        // 可带参数的术语（如 cost）
  oracle: Oracle[]         // 至少一个；event 只允许 invoke，其余只允许观测类
  since: string            // 首次登记；含义变了换 id，旧 id 进 retired_ids
}

// ── 判据下的子句 ──
type Literal = string | number | boolean | null
type TermRef = string | { term: string; given?: Record<string, Literal> }          // given：术语参数绑定
type OutcomeRef = string | { term: string; expect?: Literal | Literal[] }          // expect：观测到的值必须等于 / 属于

interface EarsClause {
  id: string               // `{判据编号}/{正整数}`，如 'P3.a/1'；稳定、不回收（判据正则 ^{req}\.[a-z]+$ 排除了它，不撞）
  while?: TermRef[]        // 全部成立 → 术语 kind 必须是 state
  when?: TermRef           // 只能一个 → event
  if?: TermRef[]           // 全部成立 → condition（EARS 的 unwanted / 异常；与 when 同现时是 guard）
  where?: TermRef[]        // → feature
  unless?: TermRef[]       // 例外：任一成立则本子句不适用 → condition | state
  shall?: TermRef[]        // 义务响应 → response
  shall_not?: TermRef[]    // 禁止响应 → response
  outcome?: OutcomeRef[]   // 响应之后必须成立的可观测结果 → outcome | state | quantity；expect 装期望值
  examples?: Record<string, Literal>[]   // 边界绑定（cost=0、spent==limit…），测试应使用；不参与计量
  boundary_of?: string     // 本子句是与哪条需求交点上的让步边界；登记表里必须有对应 tension
  note?: string            // 唯一的自由文本；过 implementationLeak；点名的 ADR 必须在 adr[]
}
interface EarsNone { verify: 'human' | 'unmeasured'; why: string; held_by?: string }
type Ears = { clauses: EarsClause[] } | { none: EarsNone }

interface Criterion { id: string; text: string; ears?: Ears }   // 只加可选字段；test.ts 的 req() 助手与 selfcheck 的 fixture 不受影响（原型 typecheck 通过）

// ── 证据等级（沿用 PR #75 formal/README.md 的词表，写进本文以便不依赖 #75 合入）──
type Level =
  | 'PROVED_IMPLEMENTATION'   // 实际实现经机器证明（本仓库今天一条都没有）
  | 'MODEL_CHECKED'           // 有界模型的全部可达状态被检查，且对拍到实现
  | 'MODEL_ONLY'              // 只检查了抽象模型，没有连回实现
  | 'PROPERTY_TESTED'         // 用生成的输入把实现（或模型与实现）对照过
  | 'UNIT_TESTED'             // 只有固定样例
  | 'ASSUMED'                 // 靠环境或人的假设
  | 'EMPIRICAL'               // 只能由真实数据评估

// 覆盖记录（.check-cache/test-claims.json，claims.ts 的 CLAIM_LISTS 是为加字段设计的扩展点）新增一栏：
interface ClaimsLevels { levels: Record<string /* 判据 id 或子句 id */, Level> }
// 由检查自己写：test.ts 写 UNIT_TESTED / PROPERTY_TESTED；formal.ts 写 MODEL_CHECKED / MODEL_ONLY；
// 假设登记表里被引用且状态为「未验证」的性质，审计把它读作 ASSUMED（不写入，派生）。
// 没有「目标等级」字段：审计只报「达到的等级」，红线判据达到 UNIT_TESTED 以下或 ASSUMED 的单列。
```

R1–R11 的通用部分（字段决定句型、术语必须存在且 kind 匹配、oracle 非空、`implementationLeak`、id 形状与退役、红线必须有 `ears`、根键进指纹、孤儿术语分级、`boundary_of` 对 `tension`、`shall` 连词只警告、验证者与 oracle 交叉校验）在 `0-process.md 通-01 / 通-02 / 通-03 / 通-04 / 通-06`，本文件不复述；R1–R11 逐条的判定代码在 `2-code.md 码-01`。

#### §C.8 交人决定的分歧（原文；J11 / J38 / J47 的论据，裁决者据此拍板）

三份独立设计经一位独立评审合成后，仍然留下这些分歧（全部进附录一，J38）：

- **子句层要不要存在**：兼容优先的设计在判据下挂多条带 id 的子句（`P3.a/1`、`P3.a/2`…），另两份坚持「一条判据 = 一条 EARS 子句、不发第三套编号」。子句 id 今天没有下游消费者（只有 `retired_ids` 与报错用），按「派生或删」要拍板：保留子句层（拒绝 / 放行分支与边界例子在同一判据下），还是把 P3.a 拆成两条判据（ADR-24：true / false 分支算不算不同代码路径）。本文暂取子句层，理由是它不改判据编号。
- **`guard` 与 `if` 分不分字段**：形式化优先的设计分开，状态机映射更直接；本文合并，按「有 `when` 则 `if` 是 guard」派生。
- **`text` 由 `ears` 派生的时机与谁按开关**：迁移期 `text` 不动（两个去处无检查）vs 落地即派生（每迁一条红线判据 `text` 就变一次，都要过 ADR-24 复核，且 SPEC 句子变刻板）vs 永不派生只并排渲染。本文取第一种，需人确认能接受迁移期的漂移风险，并定开关时点。
- **验证者是存储字段还是派生值**：派生符合「派生或删」，但一条 oracle 全是 `call` 的判据派生结果恒为 test，没办法声明「我打算由 selfcheck 验」。
- **审计是否收紧到「带子句且验证者为 test 的判据必须有判据名下的变异」**：这是迁移的杠杆也是成本；今天 `M-P3-a` 记在需求 P3 名下，收紧后要改成 P3.a 并靠 `audit.ts:143` 的前缀规则让 P3 仍算有变异。
- **`unmeasured` 档要不要存在**：给「决定了但本仓库测不了」的判据（U6.c）一个显式 `none`，还是写不出 oracle 就不该有 `ears`、保持散文由审计统计。本文保留 `unmeasured`，但它在审计里的分量应与「保持散文」一样。
- **`examples` 要不要进登记表**：它是测试的输入而不是需求；三份设计都保留，理由是「边界值写在需求旁边比写在测试里更容易被复核」。本文保留，标明不参与计量。

**评审自己指出的两处硬伤，本文已避开**（source §C.8 原文）：`holds` 白名单把 P3 的领域名写死进判定规则（换别的需求写不出）—— 本文的 oracle 不带谓词白名单，谓词留在术语 `def` 里靠人；oracle 只有闭合枚举而没有谓词时「大于什么」机器不知道 —— 本文承认这一层机器只守「有 oracle」，不守「oracle 说的是什么」。

### 1.2 P3.a / P3.b 挂子句（现行判据，`text` 不动）

### 业-04 · P3.a 挂子句 `P3.a/1`
- **目标文件**：docs/requirements.json · P3.a（行 66）· 字段 `accept[].ears`
- **实例化**：通-01
- **现状**：P3.a `text`：「Budget.charge() 在 spent + 本次开销 > limit 时抛 BudgetExceeded 且不增加计数；给定 limit=0.005 与 10 次请求，实际发出的请求不超过 5 次。」（requirements.json:66–68）；无结构化字段；测试认领 `criterion('P3.a')`，变异 M-P3-a；它是一个例子，不表达不变量（B1）。
- **提议**：见下方 §C.5 示例的 `P3.a/1`：`when budget.request_proposed`，`if [budget.cost_exceeds_limit]`，`shall [budget.raise_exceeded]`，`shall_not [provider.emit_request, budget.change_count, budget.notify_threshold]`，`outcome [budget.count_unchanged]`，`examples [{ limit: 0.005, count: 5, cost: 1 }]`；**不挂 `unless` / `boundary_of`**（等 J9）。`text`、认领、变异都不动。
- **变更分类（提议）**：补充（只加结构，义务与 `text` 一致）
- **守法**：码-01、码-41（变异 `why` 用子句原句）
- **落地**：H 第 2 步 · 裁决：无（受 J38「子句层存废」影响） · 档：提议

### 业-05 · P3.b 挂子句 `P3.b/1`
- **目标文件**：docs/requirements.json · P3.b（行 70）· 字段 `accept[].ears`
- **实例化**：通-01
- **现状**：P3.b `text`：「collect 捕获 BudgetExceeded 后保存断点并以退出码 3 结束。」（requirements.json:70–71）；`mutations.json` 对 P3.b 显式豁免（理由引 ADR-13），靠 selfcheck 真跑。
- **提议**：`when budget.exceeded_caught`，`shall [task.write_checkpoint]`，`outcome [task_json.requests, task_json.done, task_json.offsets, { term: 'process.exit_code', expect: 3 }]`。照字面写**没有**例外槽：今天记忆读不出来时退的是 2（ADR-15 的裁决优先），这条子句在那条路径上与现状不符 —— 正是 ADR-68 第三张欠条说的「P3 × D4 交点未登记」；例外槽的登记是 业-10 / J9。
- **变更分类（提议）**：补充
- **守法**：码-01、码-41、码-43（N9「exit 3 改 exit 1」先由 selfcheck 夹具守）
- **落地**：H 第 2 步 · 裁决 J9 · 档：提议

source §C.5 P3 的完整示例（原文；术语 id 以 §D.2 术语表为准；草案判据 P3.c–f 不在示例里）：

```json
{
  "id": "P3", "cat": "P", "pri": "P0",
  "text": "未经用户确认不得超出预算上限。",
  "accept": [
    {
      "id": "P3.a",
      "text": "Budget.charge() 在 spent + 本次开销 > limit 时抛 BudgetExceeded 且不增加计数；给定 limit=0.005 与 10 次请求，实际发出的请求不超过 5 次。",
      "ears": { "clauses": [
        { "id": "P3.a/1",
          "when": "budget.request_proposed",
          "if": ["budget.cost_exceeds_limit"],
          "shall": ["budget.raise_exceeded"],
          "shall_not": ["provider.emit_request", "budget.change_count", "budget.notify_threshold"],
          "outcome": ["budget.count_unchanged"],
          "examples": [ { "limit": 0.005, "count": 5, "cost": 1 } ] }
      ] }
    },
    {
      "id": "P3.b",
      "text": "collect 捕获 BudgetExceeded 后保存断点并以退出码 3 结束。",
      "ears": { "clauses": [
        { "id": "P3.b/1",
          "when": "budget.exceeded_caught",
          "shall": ["task.write_checkpoint"],
          "outcome": ["task_json.requests", "task_json.done", "task_json.offsets", { "term": "process.exit_code", "expect": 3 }] }
      ] }
    }
  ],
  "adr": ["ADR-03"]
}
```

### 1.3 术语表、退役清单、迁移闸

### 业-06 · 术语表 P3 子集：十三个现行术语 + 草案术语
- **目标文件**：docs/requirements.json · 根键 `terms`
- **实例化**：通-02
- **现状**：今天不存在词汇表；「unavailable」「safely handle」这类词没有登记处（B1）。
- **提议**：第一批（H 第 2 步第 3 条 PR）只装 P3.a/1、P3.b/1 用到的十三个未标「草案」的术语；标「草案」的随 H 第 3 步登记；`memory.unreadable` 随 J9。全表如下（source §D.2 原文，oracle 栏写的是 §C.2 `Oracle` 联合里的 kind）；每条按 `Term` 形状写 `kind / def / params? / oracle[] / since`。
- **变更分类（提议）**：需求有歧义 → 补充
- **守法**：码-01（R2 / R3 / R4 / R8）
- **落地**：H 第 2 步、H 第 3 步 · 裁决 J9 · 档：提议

| id | kind | 定义 | oracle |
|---|---|---|---|
| `budget.request_proposed` | event | 适配层准备向 TikHub 发一次付费请求 | `invoke: TikHub.get()`（自检 fake-fetch） |
| `budget.paid_request`（草案） | quantity | 一次会向 TikHub 发出的 HTTP 请求 | `call_count: fetch`（fake-fetch 记录） |
| `budget.confirmed_limit`（草案） | quantity | 任务配置的 `budget_usd` 或 `--budget`，经解析为有限非负数 | `file_json: task.json /budget_usd` |
| `budget.limit_unparseable`（草案） | condition | `confirmed_limit` 不是有限非负数 | `call: lib/budget budgetProblem returns`（`budgetProblem` 在 #75 分支，主干没有） |
| `budget.limit_below_spent`（草案） | condition | `round(confirmed_limit × 1000) < 盘上 requests`（`--budget` 是新总额，不是追加） | 入口检查（今天不存在；#75 的 `ledgerProblem` 只守 `requests` 的形状，不比大小） |
| `budget.assumed_limit`（草案） | condition | 配置缺 `budget_usd` | `file_json: task.json /budget_assumed` |
| `budget.cost_exceeds_limit` | condition | `request_count × unit + cost > confirmed_limit` | `call: lib/budget charge throws BudgetExceeded` |
| `budget.raise_exceeded` | response | 抛出 `BudgetExceeded` | 同上 |
| `budget.change_count` | response | 改变 `request_count` | `call: lib/budget count unchanged` |
| `budget.notify_threshold` | response | 触发 50% / 80% 回调 | `call_count: onNotify` |
| `budget.count_unchanged` | outcome | charge 前后 `Budget.count` 相等 | 同上 |
| `budget.request_count`（草案） | quantity | 已授权的付费请求数 | 内存 `Budget.count`；盘上 `file_json: task.json /requests` |
| `budget.exceeded_caught` | event | 入口捕获 `BudgetExceeded` | `invoke: collect / enrich`（自检夹具 `pbudget`） |
| `provider.emit_request` | response | 发出 HTTP 请求 | `call_count: fetch` |
| `provider.non_2xx`（草案） | condition | 响应状态非 2xx | `fixture: fake-fetch`（夹具记录的响应状态） |
| `task.write_checkpoint` | response | `task.json` 落盘且含 `requests / done / offsets` | `file_json: task.json /requests` 等三处 |
| `task.running`（草案） | state | 任务进程存活且未收尾 | `model`（why：进程存活只在模型里可见） |
| `task.resumable`（草案） | state | 任务目录存在 `task.json` | `file_text: task.json` |
| `task_json.requests` / `.done` / `.offsets` | outcome | 盘上三个字段 | `file_json` |
| `process.exit_code` | outcome | 入口退出码 | `exit_code: collect [0,1,2,3]` |
| `memory.unreadable`（J9 后） | condition | 记忆文件读不出来（D4.d 的五类） | `call: lib/memory loadMemory throws MemoryUnreadable` |
| `budget.persist_before_emit`（草案） | response | 在发出请求前把 `request_count` 落盘 | `fixture: crash-inject`（夹具记录的 2xx 响应数 ≤ `task_json.requests`；`billed` 是 ghost，夹具量的是它在 A2 下的代理） |
| `task.start_or_resume`（草案） | event | 入口解析完配置或断点、尚未构造 `Budget` | `invoke: collect / enrich`（自检） |
| `budget.authorized`（草案） | event | `charge()` 返回而未抛 | `call: lib/budget charge returns` |
| `budget.print_assumed`（草案） | response | stderr 打出「预算为假设值 $N」 | `stderr_match` |
| `task_json.unchanged`（草案） | outcome | 入口退出后 `task.json` 字节不变 | `file_text: task.json`（自检前后比对） |
| `task_json.budget_assumed`（草案） | outcome | 盘上 `budget_assumed === true` | `file_json: task.json /budget_assumed` |

### 业-07 · `retired_ids` 填 ADR-67 列的五个判据编号
- **目标文件**：docs/requirements.json · 根键 `retired_ids`
- **实例化**：通-03
- **现状**：「编号不回收」只活在 ADR-67 的散文里；退役判据 `P4.d` 重加通过校验（B13，实跑）。
- **提议**：`"retired_ids": ["P4.d", "P5.e", "D4.o", "D1.a", "P5.a"]`；现行表出现其中任一 id 即红（R5）；日后含义变了的术语换 id，旧 id 也进这里。
- **变更分类（提议）**：补充
- **守法**：码-01（R5）
- **落地**：H 第 2 步 · 裁决：无 · 档：提议

### 业-08 · `ears_policy.require` 从 `none` 升到 `redline`
- **目标文件**：docs/requirements.json · 根键 `ears_policy`
- **实例化**：通-04（机器只守 R2 + R3 + R6）
- **现状**：不存在；红线判据是否有机器可读的义务无人守。
- **提议**：H 第 2 步第 3 条 PR 写 `"ears_policy": { "require": "none" }`（此时 R8 孤儿术语只警告，迁移期先装术语后挂子句不因此红）；第 5 条 PR 升为 `{ "require": "redline" }`：17 条红线判据每条必须有 `ears` 或显式 `none`（R6），R8 从此变红且零孤儿；`all` 不在计划内。
- **变更分类（提议）**：补充（迁移闸，不改需求要什么）
- **守法**：码-01（R6 / R8 按 policy 分级）
- **落地**：H 第 2 步 · 裁决 J46 · 档：提议

### 业-09 · 其余 15 条红线判据各写子句或显式 `none`（P2.a 为 `none`）+「写不出 oracle 的判据清单」
- **目标文件**：docs/requirements.json · 17 条红线判据里除 P3.a / P3.b 之外的 15 条的 `accept[].ears`（编号以登记表现行判据为准，本文不手工枚举；退役编号见 业-07，不在其列）
- **实例化**：通-04、通-13（每条过独立复核，三档结论、第三档有去向）
- **现状**：17 条红线判据只有散文；约九条判据是文档存在性或人工判断（S2.a、S2.b、S3.a、S3.b、S5.a、F1.a、F3.b、F4.b、P2.a），S1.a、S4.a 这类其实可用 `source_grep` / 类型断言机械判定，只是今天没有测试（B1）。
- **提议**：每条写子句或显式 `none`；P2.a 写 `ears: { none: { verify: 'human', why: … } }` 且同时出现在 `mutations.json` 的 `exemptions`（R6）。这是 15 次「改尺子」，本文**不起草**这 15 条的子句原文 —— 每条由独立上下文写并复核；产物之一是「EARS 化时写不出 oracle 的判据清单」，只登记不改，处置（改判据 / 标 `none` / 退役）是 J46。文档存在性类判据的 oracle 是 `source_grep` / `file_text` 或 `none`，审计里被单列 —— 这是诚实不是缺陷。
- **变更分类（提议）**：逐条由评定者定（补充为主；写不出 oracle 的按 J46）
- **守法**：码-01
- **落地**：H 第 2 步 · 裁决 J46 · 档：提议

### 业-61 · 「句式合规但不可判定」的三个坏例在本产品的登记法
- **目标文件**：docs/requirements.json · 根键 `terms`（术语的 `def` 与 `oracle[]`）；写不出术语的句子不得成为任何判据 `accept[].ears` 的子句
- **实例化**：通-04（机器只靠 R2 + R3 + R6：不可判定的词进不了词汇表；进了就得写 oracle；写成 `human` / `none` 的在审计里单列并对红线施压）
- **现状**：今天不存在词汇表，「unavailable」「safely handle」这类词没有登记处（B1）；含糊词表（「safely」「合理」「适当」…）对现有 99 条判据命中 0 条（source §C.4，实跑）—— 一个在存量上从不红的检查只对新写的术语有约束，不能拿它当「可判定性」的保证。
- **提议**：三个坏例在本产品的登记法（source §C.4 原文）—— (1) `When memory is unavailable, the system shall safely handle the error.` → `unavailable` 不在 `terms`（R2 红）；就算登记，`def` 必须写「ENOENT 之外的任何读失败、解析失败、结构不对、键撞」并给 `oracle: [{kind:'call', module:'lib/memory', export:'readMemory', expect:'returns'}]`；`safely handle` 写不出 `response` 术语（R2 红）。 (2) `The system shall respond reasonably fast.` → `reasonably fast` 无术语；登记就得写数字与 oracle。 (3) `The system shall appropriately deduplicate.` → `appropriately` 无术语；`deduplicate` 若登记，oracle 必须指向 `creatorKey` 与 `filterByMemory` 的可观察输出。 业-06 / 业-09 登记新术语时按此写 `def` 与 `oracle`。机器**做不到**的（`0-process.md 通-04`）：判断一个写了 oracle 的术语是否真可判定（oracle 写成 `human` + 一句空话）；判断 oracle 说的「大于」是大于**什么** —— 谓词留在术语 `def` 里靠人。
- **变更分类（提议）**：补充（登记法示例，不改任何现行判据；新术语随 业-06 / 业-09 走各自的评定）
- **守法**：码-01（R2 / R3）
- **落地**：H 第 2 步 · 裁决 J46 · 档：提议

### 1.4 交点与草案判据（P3）

### 业-10 · P3 × D4 交点：`P3.b/1` 加 `unless: memory.unreadable` 与 `boundary_of: D4`，P3 加 `tension`
- **目标文件**：docs/requirements.json · P3.b/1 子句与 P3 的 `tension[]`
- **实例化**：通-09（例外与范围边界是放宽方向，自动执行者只登记）、通-07（`unless` 进义务指纹）
- **现状**：记忆读不出来时退 2（ADR-15 优先），P3.b 的「退出码 3」在该路径不成立；交点未登记（ADR-68 第三张欠条）；`8-p3-pilot.md §D.6` I7 的反向式已带 `¬memory.unreadable` 前提。
- **提议**：登记与否是 J9（两侧红线，退回需求所有者）。登记后 `P3.b/1` 加 `"unless": ["memory.unreadable"]`、`"boundary_of": "D4"`，P3 的 `tension[]` 加 D4 一项（R9 核对），术语 `memory.unreadable` 同时登记（业-06 表末行）。**措辞由需求所有者定** —— 例外是放宽方向，本文不起草。
- **变更分类（提议）**：需求冲突（两侧红线）
- **守法**：码-01（R9）
- **落地**：H 第 2 步 · 裁决 J9 · 档：人批

### 业-11 · 草案判据 P3.c：限额必须可解析且不低于已花，否则不发请求、`task.json` 不动、exit 2
- **目标文件**：docs/requirements.json · 新判据 P3.c（草案）
- **实例化**：通-01、通-04
- **现状**：`collect --resume <dir> --budget abc` → `Number('abc')` = NaN → `spent + 0.001 > NaN` 恒为 false，闸门永不拒绝（CE-1，实跑：请求数 2 → 17，exit 0，提醒 0 条；`collect.ts:59-60`）；`--budget 0` / `-1` 被接受，首个 charge 即抛、exit 3（CE-5）；`enrich.ts:66-72` 有 `isFinite` 校验、`collect` 没有（B2）。
- **提议**：草案原文 —— `when task.start_or_resume, if budget.limit_unparseable or budget.limit_below_spent, the system shall_not provider.emit_request; outcome task_json.unchanged, process.exit_code = 2.` 依据 CE-1、CE-5；`enrich` 已经这么做，`collect` 没有；#75 的 `budgetProblem / ledgerProblem` 是它的实现，且比本节多守了 `requests: null / "4"`。**待人定**：`--budget` 是新总额（`collect.ts:60` 直接替换 `budget_usd`），而 stderr（`collect.ts:268,332`）与 SKILL.md 的文案都说「追加」—— 用户按「追加」填一个小于已花的数就落进「低于已花」；这一处是「想立刻停」还是「输错」（exit 2 拒绝续跑 vs 接受并立刻停），以及文案改哪一边（J3，业-36）；`Infinity` 按「不是有限数」处理还是按「用户明确不限」（本文按前者，理由是 P3 的字面「上限」；J2）；精度细于 $0.001 是 J29、字符串写法 J30；先登记为「故意红」还是与代码修复同一条 PR 是 J39。
- **变更分类（提议）**：需求有歧义 → 补充（按 `2-CHANGE.md:26` 补充不是变更、不走评定，但它改尺子，走提议档过独立复核；其中「低于已花」与 `Infinity` 是产品取舍 → 人批）
- **守法**：码-17（入口校验 + exit 2 + `task.json` 不动）、码-44（例子测试）、码-41（N5）、码-39（P3.c 的随机字符串属性）、码-50（`ConfirmedLimit` 品牌类型，可选）
- **落地**：H 第 0b 步、H 第 3 步 · 裁决 J2、J3、J29、J30、J39 · 档：提议

### 业-12 · 草案判据 P3.d：假设值二选一 —— d-i 保留默认并告知 / d-ii 删除默认
- **目标文件**：docs/requirements.json · 新判据 P3.d（草案，两种措辞）
- **实例化**：通-01
- **现状**：`cfg.budget_usd ?? 2`（`collect.ts:72`）静默给 $2，没有 CONVENTIONS §7 要求的「假设值」告知（CE-4，读代码；B5）；SKILL 没有 `task.json` 字段契约。
- **提议**：**d-i 保留默认并告知**：`where budget.assumed_limit, when task.start_or_resume, the system shall budget.print_assumed; outcome task_json.budget_assumed = true.` **d-ii 删除默认**：`where budget.assumed_limit, when task.start_or_resume, the system shall_not provider.emit_request; outcome process.exit_code = 2.` 依据 CE-4。两种都不违反 P3，选哪种决定用户看到什么。本文推荐 d-ii：F1 已要求 Agent 必问预算，默认值只在 Agent 违反 F1 时起作用，而那正是最不该静默的时刻。`8-p3-pilot.md §D.10 / §D.11` 两个分支各写一套；裁决结果决定 业-34（CONVENTIONS §7）与 业-37（SKILL 成本闸门）怎么改。
- **变更分类（提议）**：产品取舍 → 人批
- **守法**：码-19（`budget_assumed` / stderr 行 / exit 2）、码-41（N6）
- **落地**：H 第 3 步 · 裁决 J4 · 档：人批

### 业-13 · 草案判据 P3.e：授权后、发出前把请求计数落盘（写前记账）
- **目标文件**：docs/requirements.json · 新判据 P3.e（草案）
- **实例化**：通-01
- **现状**：`enrichProfiles()` 每人一次 charge，循环内没有 `persist()`（`collect.ts:205-229`；persist 只在 `:180` 每页后、`:198` run 末尾、`:245` main）；SIGKILL 于第 2 个 profile 请求时盘上 `requests=12`、实际已发 14；续跑从 12 起，最终盘上 15、实际 17（CE-2，实跑；B3）。
- **提议**：草案原文 —— `while task.resumable, when budget.authorized, the system shall budget.persist_before_emit.` 依据 CE-2。这条把「不超出」的对象从「盘上计数」扩到「跨运行供应商实际计费」，是**新的保证对象**，不是澄清。它的代价要人看：每次授权后、发出前一次 `task.json` 原子写（`collect.ts:128-133` 的 `persist()` 今天还同时写 `creators.raw.json`，要先拆成只写账本的一支）；429 重试每次尝试都写；本次实测（本容器 ext4，含 fsync）3 KB × 3000 次 = 1.5 s，相对 150 ms 的限速间隔可忽略；`creators.raw.json` 不拆时 400 KB × 3000 = 4 s / 1.2 GB 写放大 —— 所以必须拆。**它保证的是 `persisted ≥ billed`（A2 成立时），不是 `persisted ≥ emitted`**：429 重试每次 charge → persist → 发出 → refund，四次尝试后 `persisted = 1`、`sent = 4`（实跑），`billed = 0` 是按 A2 推得、不是量得；要 `persisted ≥ emitted` 得另落盘一个单调的发出计数，那是另一条架构决策，本文不提。活性代价：L1 少拿一次（`8-p3-pilot.md §D.6`，J5）。
- **变更分类（提议）**：改需求要什么 —— 收紧
- **守法**：码-20（`onAuthorized` 回调）、码-21（账本支）、码-22（进程内断言）、码-13（`write-ahead` 场景）、码-39（崩溃注入属性）、码-41（N4）
- **落地**：H 第 3 步 · 裁决 J5、J31、J32 · 档：人批

### 业-14 · 草案判据 P3.f：付得起不得拒（不误拒）
- **目标文件**：docs/requirements.json · 新判据 P3.f（草案）
- **实例化**：通-01
- **现状**：`699 × 0.001 + 0.001 > 0.7`，limit=0.7 只放行 699 次；10 万个 `k/1000` 的 limit 中 26,410 个少放行一次、0 个多放行（CE-3，实跑；`budget.ts:36`）；P3.a 用的 0.005 不触发；今天没有判据说「付得起不该拒」，26% 的 limit 少一次是「合规」的（B4）。
- **提议**：草案原文 —— `when budget.request_proposed, unless budget.cost_exceeds_limit, the system shall_not budget.raise_exceeded.` 依据 CE-3。P3.a 说超了必须拒，P3.f 说没超不许拒。#75 判断「方向安全，不写成不变量」；本文认为「付得起不该拒」值得成为判据，交人定。实现上的整数毫美元是架构决策（业-21 / J43）。
- **变更分类（提议）**：改需求要什么 —— 收紧
- **守法**：码-18（整数毫美元）、码-39（随机十进制 limit 恰好 `L/unit` 次）、码-41（N1 / N7）
- **落地**：H 第 3 步 · 裁决 J6 · 档：人批

### 业-15 · P3 正文的并发范围边界：只登记「边界未声明」，不起草
- **目标文件**：docs/requirements.json · P3 的 `text`（行 60–64）—— 本文不改，只登记
- **实例化**：通-09
- **现状**：P3 `text`「未经用户确认不得超出预算上限。」读起来像无条件保证；`collect.ts:102 / :129` 与 `enrich.ts:77 / :126` 各自读一次、无条件写回 `requests`，两个进程同时采集时预算池可能被花两遍；D4 的同类边界已按 ADR-67 写进正文（ADR-66）；A6「单写入方」是假设登记表条目（业-23）。
- **提议**：只登记「边界未声明」（ADR-68 第五张欠条已记录同一件事）；范围边界声明是放宽方向，自动执行者不得起草，措辞由需求所有者起草。
- **变更分类（提议）**：范围边界（放宽方向，Agent 不起草）
- **守法**：无（登记项；A6 由 业-23 承载）
- **落地**：H 第 3 步 · 裁决 J7 · 档：人批

### 业-16 · P3.a 现有判据文本是否改成属性形式并保留 0.005 / 10 次作例子
- **目标文件**：docs/requirements.json · P3.a `text`（行 66–68）
- **实例化**：产品专属
- **现状**：P3.a 是一个例子（limit=0.005、10 次），不表达不变量（B1）；0.005 恰好测不到 CE-3（B4）。
- **提议**：是否改成属性形式（「对任意 limit 与任意序列…」）并保留 0.005 / 10 次作例子 —— 改现有判据要走 `2-CHANGE.md`；本文只提出，不起草。
- **变更分类（提议）**：改判据措辞
- **守法**：码-39（P3 属性：随机 `(limit, 序列)` 检验 I1 / I3）
- **落地**：H 第 3 步 · 裁决 J35 · 档：人批

### 业-17 · `charge(-1)` 让计数减一且不经 `refund()`：是需求还是只记录
- **目标文件**：docs/requirements.json（是否新增判据）或 docs/adr/
- **实例化**：产品专属
- **现状**：`charge(-1)` 让计数从 1 变 0 且不经过 `refund()`（实跑，`8-p3-pilot.md §D.9`）—— 没有任何判据覆盖的输入形状；`charge(0)` 通过且不改计数（实跑）。
- **提议**：模型禁止 `propose(0)`（付费请求 cost ≥ 1 unit）；构造函数与 `charge` 拒绝非正 cost 是架构决策；是否算需求由评定定 —— 是则另起判据草案（本文不起草原文），否则只在 业-19 的 ADR 里记录。
- **变更分类（提议）**：需求有歧义
- **守法**：码-18（`charge` 前置 `n ≥ 1`、构造函数拒非正 cost）
- **落地**：H 第 3 步 · 裁决 J40 · 档：人批

### 业-18 · F7.a「一次」是每进程还是每任务
- **目标文件**：docs/requirements.json · F7.a（行 616）；docs/adr/ 新 ADR（ADR-68 第二张欠条）
- **实例化**：产品专属
- **现状**：F7.a `text`：「Budget 在跨越 0.5 与 0.8 阈值时各触发一次回调，且不重复触发。」；`notified` 不落盘（`budget.ts:18`），续跑新建实例后已跨过的阈值再触发一次：`new Budget(0.020, 18).charge()` 同时打出 50% 与 80%（B22，实跑）。
- **提议**：试点内按「每进程一次」临时解读（I6），建模不裁决（`8-p3-pilot.md §D.0`）；ADR 题目「F7.a 的『一次』：每进程还是每任务」，结论待人定；按任务算则与 D6.a 有未登记交点，须同时登记 `tension`。
- **变更分类（提议）**：需求有歧义
- **守法**：无（等 J8；`notified` 落盘未立项）
- **落地**：无 H 步（F7 单独评定） · 裁决 J8 · 档：人批

### 1.5 其他需求的草案判据与措辞裁决

### 业-49 · 裁定 `memory.ts:410` 的 `||` 算不算 P1.b 违规
- **目标文件**：docs/requirements.json · P1.b（行 23）；docs/adr/ 新 ADR
- **实例化**：产品专属
- **现状**：P1 lint 只认字面量兜底：`?? c.followers`（`collect.ts:215`）、`|| e.followers`（`memory.ts:410`）判 clean；16 处 `p1-ok` 中 9 处多余（B8，实跑）。
- **提议**：ADR 题目「`memory.ts:410` 的 `||` 兜底算不算 P1.b 违规」，结论待人定；裁定后 lint 升级（码-32）才知道它是抓还是豁免。
- **变更分类（提议）**：需求有歧义
- **守法**：码-32
- **落地**：H 第 6 步 · 裁决 J17 · 档：人批

### 业-50 · profile 查询失败的重试策略归谁；`bio_links` 的未查询态怎么表达
- **目标文件**：docs/requirements.json · P1 判据（行 19–31）；docs/adr/ 新 ADR
- **实例化**：产品专属
- **现状**：profile 请求失败（404 / 5xx / 网络 / 402）一律 `bio: undefined`；402 在 profile 阶段被吞成 `profile_failed`，exit 0；429 耗尽在 `run()` 里 exit 1、在 `enrichProfiles` 里被吞；`bio_links` 二态导致有简介无外链者每次续跑重查（付费；测试断言为预期行为）（B6，实跑；`collect.ts:219-225`、`pipeline.ts:78`）。
- **提议**：ADR 题目「profile 查询失败的重试策略归谁；`bio_links` 的未查询态怎么表达」，结论待人定；先 ADR 再迁移（H 第 6 步 (d)）。
- **变更分类（提议）**：需求有歧义
- **守法**：码-30（`Observation<T>` 迁移）
- **落地**：H 第 6 步 · 裁决 J18 · 档：人批

### 业-52 · 写入方并行是否允许（ADR-66 重启条件）
- **目标文件**：docs/requirements.json · D4 / P4 / P5 正文「当前不保证」；docs/adr/ 新 ADR
- **实例化**：产品专属
- **现状**：D4.i / D4.j 无运行时认领；两写入方交错留下 ok + 未去重名单（实跑复现，已声明不保证，ADR-66）；collect 断点保存与 enrich persist 会把旧 `memory_status` 原样写回（B11；`collect.ts:128-133`、`enrich.ts:125-129`）。
- **提议**：ADR 题目「写入方并行是否允许（ADR-66 的重启条件）」，结论待人定；只在重启条件触发时才复用探索器建 `(T, L)` 上写入方交错的模型（`task.json` 三个写入方：三步协议、collect 断点、enrich；`creators.json` 两个：三步协议第二步、render）；D4 的「不保证」正文在评定完成前不动。
- **变更分类（提议）**：产品取舍
- **守法**：码-40
- **落地**：H 第 7 步 · 裁决 J21 · 档：人批

### 业-53 · `filterByMemory` 查询侧是否过 `keyProblem`
- **目标文件**：docs/requirements.json · D1.c / P4.a；docs/adr/ 新 ADR
- **实例化**：产品专属
- **现状**：库里 `tiktok:alice` contacted，查 `alice `/`alice﻿` 静默漏过（P4 路径）；查询侧照单全收（B10，实跑；`memory.ts:339`）。
- **提议**：ADR 题目「`filterByMemory` 查询侧是否过 `keyProblem`」：拒绝会中止出名单，放行是今天的静默漏过；结论待人定；查询侧收紧后真实 API 返回带空白 handle 的比例未知。
- **变更分类（提议）**：产品取舍
- **守法**：码-29
- **落地**：H 第 8 步 · 裁决 J22 · 档：人批

### 业-54 · 「某侧 ≥ 2 候选同信号 ⇒ 不合并」是否是 D3「不确定」的定义
- **目标文件**：docs/requirements.json · D3.a / D3.b（行 260–266）；docs/adr/ 新 ADR
- **实例化**：产品专属
- **现状**：D3.a「仅在 bio 外链互指、handle 完全相同、或去标点后相同三种信号之一成立时合并。」D3.b「昵称或头像相近单独不足以触发合并。」；`[tiktok:mei_cooks, tiktok:mei.cooks, instagram:meicooks]` 两个候选同时命中信号 3 时合并了第一个，配对随输入顺序变；`TikTok` 按字面比较被路由进 instagram 桶（B10，实跑；`identity.ts:30,55-61,92`）。
- **提议**：ADR 题目「『某侧 ≥ 2 候选同信号匹配 ⇒ 一个都不合并』是否是 D3『不确定』的定义」，结论待人定；裁决后六条属性（`creatorKey` 幂等；写入侧收下 ⇒ 读回 ok ∧ 查询命中 ∧ swapcase 命中；昵称相同 handle 无关 ⇒ 不合并；歧义 ⇒ 一个都不合并；任一侧未知 ⇒ 合并结果未知；同数组二次 link 返回 0）与 `merge_reason` 落地。
- **变更分类（提议）**：需求有歧义
- **守法**：码-29、码-39
- **落地**：H 第 8 步 · 裁决 J23 · 档：人批

### 业-55 · 草案判据 P2.c（claim 引用完整性）与 P5.i（词法 token 覆盖声明）
- **目标文件**：docs/requirements.json · 新判据 P2.c、P5.i（草案）
- **实例化**：通-01
- **现状**：三条输出路径今天都原样保留占位符（实跑），但产品页事实不落盘，没有 claim / evidence 结构；事后连人工核对都没有材料（B12）。
- **提议**：P2.c（引用完整性）：每个 `supported` claim 的 `evidenceIds` 存在、`sourceUrl / observedAt` 穿透到数据边界、三条路径占位符计数一致；P5.i（覆盖声明）：词法 token 覆盖只做成 P5 形状的声明，不做硬失败。EARS 原文随 业-29 的 Evidence / Claim 字段定，本文不起草。一份自洽但编造的 claim / evidence 能通过机器检查 —— 写进 `9-evidence.md §I`，不当 bug；机器抓到的是「引用断了」「占位符被抹」「来源丢了」。
- **变更分类（提议）**：改需求要什么 —— 收紧
- **守法**：码-33
- **落地**：H 第 9 步 · 裁决 J42 · 档：人批

### 业-57 · U3.a 措辞：关键词表按任务表出全行，状态三态化（`found = 0 / error / not_run`）
- **目标文件**：docs/requirements.json · U3.a（行 691）；docs/adr/ 新 ADR
- **实例化**：通-32（进入控制决策的量必须能表达三态）
- **现状**：U3.a「报告含关键词表格，列出找到人数、语义通过数、命中率。」；U3 关键词表把「0 结果 / 请求失败 / 未跑」坍缩成「无此行」，`found` 是过滤后计数且随轮转顺序变，`fit_pass` 由 Agent 判定（B16；`pipeline.ts:204-213`、`collect.ts:165-166`）。
- **提议**：关键词表按 `task.json.tasks` 出全行，状态三态化（`found = 0 / error / not_run`）—— 改 U3.a 的判据措辞，要评定；措辞草案由评定时起草（改现行判据文本，本文不改）；`fit_pass` 的定义不动。
- **变更分类（提议）**：改需求要什么
- **守法**：码-28
- **落地**：H 第 10 步 · 裁决 J25 · 档：人批

### 1.6 迁移方式：source §C.6 的六条（前五条即 H 第 2 步的五条 PR，原文）

按 SYNC 表「增删登记表的字段」那一行（今天标为「✗ 靠执行」）逐项做，顺序按「最后一块砖」：

1. **ADR 先行**（J10）：一条 ADR 直面 ADR-67:25-27，写明 `ears` 的三个消费者与「`text` 将来由 `ears` 派生」的终态。文档类，可单独先合。（业-03）
2. **判定 + 消费者同一条 PR**：`ears-rule.ts`（类型 + R1–R9 + R11；从 `spec-rule.ts` 引用）+ `test.ts` 的 `harness` 断言 + `M-H4-l` 起的变异（每条规则至少一个：R2 的变异是「术语不存在也放行」）+ `renderTables` 在验收标准格里追加派生行 `⟨EARS⟩ …`（同步扩 `shapeProblems`，ADR-33：渲染读的字段必须校验）+ `audit` 的「靠什么验」派生列 + 覆盖记录的 `levels` 栏 + `contentHash` 输入加三个根键。此时登记表里还没有任何 `ears`，检查全绿。R10 之后按需。（码-01、码-02、码-03、业-33）
3. **词汇表 + 退役清单**：`terms` **只放 P3.a / P3.b 两条子句用到的十三个术语**（D.2 表里未标「草案术语」的那些）；`retired_ids` 填 ADR-67 列的五个判据编号（P4.d、P5.e、D4.o、D1.a、P5.a）；`ears_policy.require = 'none'`（此时 R8 只警告）；`--write` 回写指纹。走 `2-CHANGE.md`：类型是「需求有歧义 → 补充」（不改任何一条需求要什么）—— **提议分类，评定者定**。（业-01、业-06、业-07、业-08）
4. **给两条现行判据挂 `ears`**（P3.a、P3.b，如 C.5）。`text` 不动，认领不动，变异不动。**不挂 `unless` / `boundary_of`**，等 J9。（业-04、业-05）
5. **`ears_policy.require` 升到 `'redline'`**：17 条红线判据每条必须有 `ears` 或显式 `none`（P2.a 是 `none`），R8 从此变红。这一步之前要把其余 15 条红线判据的子句写出来 —— 那是 15 次「改尺子」，每条过独立复核；产物之一是「写不出 oracle 的判据清单」（J46）。（业-08、业-09）
6. 之后按 H 节的节奏一条需求一条需求地挂；**先红线，再 D 类，U/S/F 类最后甚至不做**（业-47 分级表）。文档存在性类判据挂 `ears` 时 oracle 是 `source_grep` / `file_text`（S1.a、S2.a 这类其实可判定，只是今天没有测试）或 `none`（U6.c）—— 它们在审计里被单列，这是诚实不是缺陷。

---

## 2. `docs/SPEC.md`（派生渲染）

### 业-33 · 验收标准格追加派生行 `⟨EARS⟩ …`
- **目标文件**：docs/SPEC.md · §「需求登记表」生成区（行 43–117，`BEGIN:GENERATED 由 requirements.json 生成，勿手改`）
- **实例化**：通-01、通-05（终态由结构派生散文）、通-29（判据散文 ↔ 子句的漂移通道：过渡期并排渲染 + 复核）
- **现状**：SPEC 是 requirements.json 的渲染；加未知字段后 `renderTables` 输出与基线逐字相同（source §C.0，实跑）—— 即今天不渲染 `ears`。
- **提议**：`renderTables` 在验收标准格里追加派生行 `⟨EARS⟩ …`（同步扩 `shapeProblems`，ADR-33：渲染读的字段必须校验）；过渡期派生行摆在 `text` 下面供人眼对照；由 spec-sync 生成不手改；H 第 2 步第 2 条 PR 的验收项之一是「SPEC 里 P3.a 下出现派生行」（在第 4 条 PR 挂子句之后才出现）。
- **变更分类（提议）**：派生（不是需求变更）
- **守法**：码-02
- **落地**：H 第 2 步 · 裁决：无 · 档：自动

---

## 3. `docs/assumptions.json`（新文件）

### 业-23 · 新文件 `docs/assumptions.json`：A1–A9，含失效触发器与检测方式
- **目标文件**：docs/assumptions.json（新）
- **实例化**：通-11（假设登记表方法）、通-10（失效即降级到 ASSUMED）、通-33（起点数字进登记表待校准）、通-34（「当前不可控」目标写进登记表）
- **现状**：单价上限、非 200 不计费、rename 原子性、fsync 尽力而为散落在注释与 ADR-50（`budget.ts:1`、`tikhub.ts:90`、`atomic.ts:35-37`）；#75 的 `IMPLEMENTATION-MAP.md` 集中了它们但不可机器读；「非 200 不计费」「in-flight 是否计费」未验证；`probe` 的花销不进任何账（B15）。
- **提议**：机器可读，进 `content_hash` 同类的指纹，审计读它。每条：是什么、若为假破坏哪条性质、验证方式、状态、失效触发器、触发器由谁怎么检测（外部：TTL 起点 90 天，过期即「未验证」；代码：登记表记相关函数的内容指纹，审计比对，变了即「待重验」）。条目 A1–A9 见下表（source §D.7 原文）。另登记：J34「网络异常（`fetch` reject）是否退款」挂在 A2；A1 / A2 各一位负责人与目标日期由人填、验证日期由人写、审计只读（J15）；对账钩子（人工）：一次真实任务后把供应商后台的请求数与 `Σ task.json.requests` 对照，结果写进 A1 / A2 的「最近验证日期」；`8-p3-pilot.md §D.8` 的「当前不可控」目标（回复率；关键词命中率「当前不可决策」）与起点数字（业-46）也登记在此；Z3 浮点证明脚本与结论入此作证据。**失效后的接线**：状态变「未验证 / 待重验」时依赖它的性质在覆盖记录 `levels` 栏从 `MODEL_CHECKED` 降为 `ASSUMED`，审计对红线判据报「目标等级未达」；这一步依赖 `levels` 栏落地（码-03），之前只能靠审计打印登记表。
- **变更分类（提议）**：补充（登记假设，不改需求）
- **守法**：码-45（审计读 + 形状校验 + TTL / 指纹比对 + 变异）、码-03（`levels` 派生 ASSUMED）、码-24（`meta.json.budget.reconciliation` 默认 `unverified`）
- **落地**：H 第 1 步 · 裁决 J15、J34 · 档：提议（标「未验证」是诚实可自动；反向提议）

| # | 假设 | 若为假 | 验证方式 | 状态 | 失效触发器 → 触发器检测 |
|---|---|---|---|---|---|
| A1 | 单次请求单价 ≤ $0.001（`budget.ts:1`：TikHub 基础价，有阶梯折扣，此为上限） | `spent` 低估真实花费；I1 / I2 在美元意义上失效（请求数意义上仍成立） | 对照 TikHub 价格页；一次真实任务后对照供应商账单（**人工**，H 第 1 步指定责任与日期） | **未验证** | 价格页变化；`tikhub.ts` 端点变化 → 外部：TTL（起点 90 天，过期即「未验证」）；代码：登记表记 `tikhub.ts` 相关函数的内容指纹，审计比对，变了即「待重验」 |
| A2 | 非 2xx 响应不计费（`tikhub.ts:90` 退款的依据） | I2 失效（退款后 `charged` 低估）；B21 的 8 次提交 1 次计数是它的放大 | 账单对照，专门数 4xx / 429 | **未验证** | 同 A1 → 同 A1 |
| A3 | 请求已发出、进程在响应前死亡 → 供应商**可能**计费 | 按不计费建模会低估 | 无法直接验证；模型按最保守方向（视为已计费）处理 | 保守假设 | — |
| A4 | `writeFileAtomic` 的 rename 使文件要么旧要么新（`atomic.ts:74-87`） | `persisted` 可能是坏 JSON → 续跑读不出来 | 有测试（D4.i 相关断言）**但无 `criterion()` 认领**（B11） | 已验证（测试） | Node 版本、文件系统类型变化 → 代码指纹：`atomic.ts`；环境：`meta.json.versions` 记 Node 版本 |
| A5 | 断电后 rename 是否持久化：尽力而为（ADR-50） | 断电丢最后一次 persist → I2 失效一次 | 不验证；写进不保证 | 已声明不保证 | — |
| A6 | 同一任务目录单写入方（ADR-66） | 两个进程各自 `persisted` 互相覆盖 | 不验证；写进不保证（D.2 的范围边界，待需求所有者起草） | 已声明不保证 | — |
| A7 | 用户在 `--budget` 里输入的就是确认 | 误输入即误确认 | 产品决定 | 已接受 | SKILL.md 流程改变 → 代码指纹：`SKILL.md` 预算段 |
| A8 | 整数在 JSON 往返中精确（< 2⁵³） | 计数读回失真 | 语言规范保证，无需验证 | — | — |
| A9 | fake-fetch 的行为等价于真实 fetch 的**顺序**（不是内容） | 自检里的顺序断言对真实运行无效 | `selfcheck` 与一次真实运行的 `requests` 对照 | 部分验证（2026-08-26 真实跑通） | `fake-fetch.ts` 或 `tikhub.ts` 改动 → 代码指纹 |

（source 原表七列；为守「表格不超过 6 列」把「失效触发器」与「触发器检测」合为一格，内容未删。）

---

## 4. `docs/ARCHITECTURE.md`

### 业-22 · ADR + 顺序契约新行：`charge → persist（账本）→ fetch`（适配层 `onAuthorized` 回调）
- **目标文件**：docs/ARCHITECTURE.md · §「顺序契约」表（行 110–116）新行；docs/adr/ 新 ADR
- **实例化**：产品专属（沿现行规则：顺序契约每行绑真实变异，`npm run arch` 校验）
- **现状**：顺序契约表四行，每行绑变异（M-D6-c、M-D6-b 等）；`TikHub.get()` 今天 `charge`（`tikhub.ts:84`）→ `fetch`（`:87`）→ 非 2xx `refund`（`:90`），`persist` 是入口的函数（`collect.ts:128-133`；`enrich.ts:125-129`）。
- **提议**：ADR 题目「写前记账的落点：适配层 `onAuthorized` 回调，顺序契约 `charge → persist（账本）→ fetch`」。结论草稿：`TikHub` 构造时接受 `onAuthorized: () => void`，`get()` 在 `charge()` 之后、`fetch` 之前调用它，入口把只写账本的 `persist` 传进去；另一种落点（`enrichProfiles` 循环里「先 +1 再 persist 再 get」）写下去的是上一次的 `charged`，I2 仍破，不采用；`persist` 失败 ⇒ 不发出，按 error 收尾。顺序契约表新行：`charge → persist（账本）→ fetch` · `scripts/providers/tikhub.ts` `get()` · 错了会怎样：进程被杀时盘上少记，续跑后总花费超出上限 · 守它的变异：N4（落地时续编）。SYNC「改预算 / 成本逻辑」行同步（业-31）。
- **变更分类（提议）**：架构（顺序契约）
- **守法**：码-20、码-21、码-41（N4）
- **落地**：H 第 3 步 · 裁决 J44 · 档：人批

### 业-25 · `meta.json` / `task.json` 新字段是否触及 U7 / D6 的评定；缝隙契约写新字段与读取规则
- **目标文件**：docs/ARCHITECTURE.md · §「缝隙契约：Agent ↔ scripts」（行 121–156）；docs/requirements.json · U7.d（行 771）、D6（行 389–409）
- **实例化**：通-40（新增字段缺失读作「无从确认」）
- **现状**：U7.d「meta.json 按能力分别统计 measured/unavailable/unqueried；公开指标不得把兼容字段 enriched 置为 true。」—— `meta.json` 装什么是 U7.d 的对象；缝隙契约只列入口读写文件与退出码，无字段级契约；`meta.json` 没有代码 / 配置 / schema 版本，429 / schema 未识别 / IG 回退不计数，`profile_failed` 只在 stdout（B17；`render.ts:90-141`、`tikhub.ts:96-100,294`）。
- **提议**：新增字段 —— `task.json.budget_assumed`；`meta.json.versions: { code, config, provider_shape, node, by_target: { <软目标>: <只含影响它的文件的指纹> } }`；`meta.json.budget: { limit_m, charged, persisted_at_exit, assumed, reconciliation: 'unverified' | { provider_count, checked_at } }`；`meta.json.shadow`；`task.json` 累加 429 次数（selfcheck 验收 `rate_limited === 1`）、schema 半漂移（`raw_count > 0` 但入库 0）关键词数、IG 回退次数；`profile_failed` 带原因分布进 `meta.json`。读取规则统一按 ADR-18：**缺失读作「无从确认」，不读作 `false` / `0` / `ok`**；`meta.json.versions` 缺失时报告声明「版本未知」；旧任务目录续跑（D6）时缺字段不算不兼容。缝隙契约加「字段级新增与读取规则」小节。是否触及 U7 / D6 由评定定（J13）；旧目录续跑行为变化的迁移 / 宽限期是 J36。
- **变更分类（提议）**：需评定（可能触及 U7.d / D6）
- **守法**：码-23（`versions`）、码-24（`budget` 块）、码-27（扰动计数）、码-19（`budget_assumed`）
- **落地**：H 第 1 步、H 第 3 步、H 第 10 步 · 裁决 J13、J36 · 档：人批

### 业-26 · 缝隙契约：入口对坏预算 / 坏账本以 exit 2 拒绝续跑且 `task.json` 不动
- **目标文件**：docs/ARCHITECTURE.md · §「缝隙契约」退出码表（行 136–147）—— `2` 多一个原因，含义不扩展
- **实例化**：产品专属（沿 ARCHITECTURE「退出码的含义不许扩展」）
- **现状**：退出码表 `2` = 「用法错 / 缺 `TIKHUB_API_KEY` / 记忆文件读不出来」；旧目录 `budget_usd: null` 续跑今天在第一次 charge 时 `TypeError`，exit 1（CE-1 后半，实跑）；`requests: "4"` 让下一次计数变成 `"41"`（#75 自述，本次未复跑）。
- **提议**：`2` 的原因列表加「预算 / 账本校验失败：限额不可解析或低于已花、`requests` 不是非负整数」，含义不变（停下问人，重试没有意义），`task.json` 不动，stderr 说明要求 `--budget`；进程内断言失败沿用 exit 1「其他失败」的既有含义，不扩展退出码。从「TypeError exit 1」变为「校验 exit 2 并要求 `--budget`」是行为变化，要不要迁移命令或宽限期是 J36。
- **变更分类（提议）**：补充（退出码原因，不扩展含义）
- **守法**：码-17、码-44（selfcheck 三入口真跑：`budget_usd: "abc"`、`requests: null`、`--budget 3.0.0`）
- **落地**：H 第 0b 步 · 裁决 J36、J3 · 档：提议

### 业-27 · 锚点表新行：`formal-rule.ts`、`formal.ts`、`ears-rule.ts`、`oracle-rule.ts` / `oracle.ts`、崩溃点夹具等新模块
- **目标文件**：docs/ARCHITECTURE.md · §「模块锚点表」（行 46–96，`BEGIN:ANCHORS`）
- **实例化**：通-22（闸门代码是尺子的尺子，须登记并由非作者复核）
- **现状**：锚点表由 `npm run arch` 校验，新增模块必须加行（列：模块 / 层 / 服务的需求 / 它保证什么）；#75 已写 `formal-rule.ts` / `formal.ts` 两行。
- **提议**：每个新增判定模块各一行（层一律「检查」）：`ears-rule.ts`（服务 P1–P5 判据的结构；保证子句引用可解析、术语有 oracle、退役 id 不回收）；`formal-rule.ts` + `formal.ts`（P3、D6；有界模型无反例 + 对拍）；`oracle-rule.ts` + `oracle.ts`（全部尺子；改尺子必有 trailer）；崩溃点穷举夹具（D4.i / D4.j / D4.k / D4.p）；假设登记表判定模块（业-23）。各行「它保证什么」的措辞随各条 PR 定。
- **变更分类（提议）**：架构（锚点登记）
- **守法**：码-10、码-11、码-01、码-06、码-40
- **落地**：H 第 0c 步、H 第 2 步、H 第 5 步、H 第 7 步 · 裁决：无 · 档：提议

### 业-28 · 「守红线的模块」认定规则：锚点表「服务的需求」列含 P1–P5 者
- **目标文件**：docs/ARCHITECTURE.md · §「模块锚点表」说明段（行 38–45）
- **实例化**：通-20（触及守红线模块的普通代码升为提议）、通-22
- **现状**：说明段只讲层的含义与「入口层不许放决策逻辑」；「守红线的模块」没有定义；普通代码直接做（`process/README.md`「什么时候不走流程」）。
- **提议**：加一句：「锚点表『服务的需求』列含 P1–P5 的模块是守红线的模块；触及它们的普通代码改动从自动升为提议（合并前须独立复核）」；认定靠现有锚点表，不另建清单；oracle-rule 读这一列。
- **变更分类（提议）**：架构 / 治理
- **守法**：码-06
- **落地**：H 第 5 步 · 裁决：无（措辞归 J28 的通用层那条） · 档：提议

### 业-29 · 字段所有权与缝隙契约新增：`product-facts.json`、`Creator.outreach_claim_ids`、`fit_review`、`shadow.json`、`experiments.json`
- **目标文件**：docs/ARCHITECTURE.md · §「字段所有权」表（行 158–169）与 §「缝隙契约」入口表（行 126–131）
- **实例化**：产品专属
- **现状**：字段所有权表四行（collect / Agent：`fit` · `fit_reason` · `outreach_draft` / enrich 只写 `enrichment.json` / render：`score` · `tier` · `tier_adjustments` · `account_assessment`）；入口表四个入口；Phase 01 抓页今天不落盘。
- **提议**：新增 —— `product-facts.json`：Agent 拥有、Phase 01 写、render 只读，装 `Evidence{ id, sourceUrl, observedAt, contentHash, excerpt }` 与 `Claim{ id, text, evidenceIds, status: 'supported' | 'placeholder' | 'offer' }`；`Creator.outreach_claim_ids`（Agent 写）；`Creator.fit_review: { by: 'human' | 'agent-2', value, at }`（由人或第二判定写，Agent 不写）；`shadow.json`（脚本写、Agent 不读）；`experiments.json`（跨任务台账）。改字段所有权是改尺子，走 `5-DESIGN.md`，依赖 H 第 5 步的 oracle-rule（J41）；新入口与产出文件是缝隙契约改动。
- **变更分类（提议）**：架构（字段所有权）
- **守法**：码-33、码-36、码-37
- **落地**：H 第 9 步、H 第 12 步 · 裁决 J41 · 档：人批

### 业-30 · ADR：`Observation<T> = Unqueried | MeasuredPresent<T> | MeasuredAbsent | Unavailable<Reason>` 作为 Creator 层架构决策
- **目标文件**：docs/ARCHITECTURE.md · §「三态在类型层的落点」（行 184–197）；docs/adr/ 新 ADR
- **实例化**：通-19（非法状态不可表示：DU + `never` 穷尽）
- **现状**：三态表：`undefined` = 没查过、`null` = 查过没有、有值、`Measurement<T>`（`measured` / `unavailable` / 字段缺席 = 未查询）；「查询失败」与「未查询」同态、Creator 层没有 Unavailable(reason)（B6）；主干 31 处 `status === 'measured' / 'unavailable'` 二分，无 `never` 断言（B9）。
- **提议**：ADR 题目「Creator 层观测值改为 `Observation<T>` discriminated union」。结论草稿：作为架构决策采纳；迁移按读点数分批（email 9、bio 10、followers 29：一批一个字段）；三态表加一行 `Observation<T>`；不改 P1 的 `text` 与四条判据，不改 `_interface.md` 的跨层契约；验收：新增变异「把 Unavailable 折叠成 Unqueried」被抓到。
- **变更分类（提议）**：架构
- **守法**：码-30
- **落地**：H 第 6 步 · 裁决 J20 · 档：人批

---

## 5. `docs/CONVENTIONS.md`

### 业-34 · 第 7 条随 P3.d 裁决改写
- **目标文件**：docs/CONVENTIONS.md · §「7. 有默认值的配置项 —— 预算不许有默认值」（行 105–114）
- **实例化**：产品专属
- **现状**：原文「必须由用户在 Phase 01 设定；用户不给才按 $2 走，**并明确告知这是假设值**。」（CONVENTIONS.md:110）；代码 `cfg.budget_usd ?? 2` 无告知 —— 与自己的约定不一致（B5）。
- **提议**：d-ii 采纳则删「用户不给才按 $2 走」一句，改为「缺预算即拒绝采集（exit 2）」；d-i 采纳则补告知口径（stderr「预算为假设值 $N」）与落盘标记 `task.json.budget_assumed = true`。改的是给用户的承诺，走 SYNC「改报错 / 提示里给用户的一句承诺」点名清单（requirements.json 对应判据 → ARCHITECTURE → SKILL）。
- **变更分类（提议）**：随 J4（补充或改承诺）
- **守法**：无（文档承诺；机器守的是 业-12 → 码-19）
- **落地**：H 第 3 步 · 裁决 J4 · 档：提议

### 业-35 · 第三层表补三条：三种绕法机器守不住、只有一个人类身份、表现表与控制器同源
- **目标文件**：docs/CONVENTIONS.md · §「11. 关于第三层」（行 170–179）
- **实例化**：通-08（机器认不出恒真化 / 改期望值 / 旁路执行）、通-13（「只有一个人」登记为已知缺口）、通-32（传感器与控制器不得同源）
- **现状**：第三层表三条：P2 的判断那一半（ADR-01）、写测试时不读实现（ADR-04）、一个改动只回答一个证据问题（体量闸门管上限不管内聚）。
- **提议**：加三条 —— (1)「断言恒真化、期望值改成运行结果、断言旁路执行（`if (process.env.CI) return`）—— 只有恰好有变异的断言才会红，其余靠变异覆盖与独立复核」；(2)「仓库只有一个人类身份：『必须人批』『非作者复核』今天靠自觉且没有第二个人（B18）—— 见 SYNC 分支保护核对行（业-31）」；(3)「关键词表现表的 `passed` 由 Agent 判定，`output-format.md:104` 把它定为『下次调整策略的依据』—— 传感器与控制器同源；机器守不住『同源』本身，只守结构（`fit_review` 落处与一致率，业-40）」。
- **变更分类（提议）**：补充（显式登记第三层）
- **守法**：无（第三层，显式留在审计报告里）
- **落地**：H 第 5 步、H 第 12 步 · 裁决 J16 · 档：自动

---

## 6. `docs/SYNC.md`

### 业-31 · 触发表新行与升级
- **目标文件**：docs/SYNC.md · §「触发表」（行 13–38）：「增删需求登记表的字段」行（行 28）、「改预算/成本逻辑」行（行 36）、「新增一道闸门」行（行 33）
- **实例化**：通-29（五对漂移通道）、通-30（`process/` 改动配 ADR、产品词 lint）、通-13（分支保护核对由人做）
- **现状**：「增删需求登记表的字段」行机器检查列标「✗ 靠执行」（source §C.6 首句）；「改预算/成本逻辑」行 = `budget.ts` · SKILL 成本闸门 · CONVENTIONS 第 7 条，机器检查「部分」；没有 `process/` 那一行，`process/` 无任何检查读（B18）。
- **提议**：(1)「增删需求登记表的字段」→ 至少要看加 `scripts/check/ears-rule.ts`，机器检查升为 🔒 `spec`（ears-rule）；(2)「改预算/成本逻辑」→ 至少要看加「`scripts/check/formal-rule.ts` 的模型与 `formal/IMPLEMENTATION-MAP.md`」，机器检查 🔒 `formal`（对拍）；(3) 新行「改 `process/` 里的任何一份 → 配一条 ADR；不得混进代码 PR」，机器检查 🔒 `adr` · lint（产品词）；(4) 新行「分支保护核对结果（由人核对后写）：`main` required checks 含 `check` 与 `age`；触及 P1–P5 的 PR 需非作者复核」，机器检查 ✗ 靠人；(5)「新增一道闸门」行加「提交信息 `oracle-change:` trailer + 非作者复核」。
- **变更分类（提议）**：文档同步（不是需求变更）
- **守法**：码-11（`formal` 入口 + SYNC 行）、码-01、码-47（`process/` 产品词 lint）
- **落地**：H 第 0d 步、H 第 2 步、H 第 5 步 · 裁决 J16 · 档：提议

### 业-32 · 文档地图与入口文件：新增 `docs/assumptions.json`、`docs/EVOLUTION.md`、`formal/`；AGENTS.md 缺口表加「只有一个人」
- **目标文件**：docs/SYNC.md · §「文档地图」（行 42–60）；AGENTS.md · §「目前已知的缺口」（行 94–111）
- **实例化**：通-13
- **现状**：文档地图无 `assumptions.json` / `EVOLUTION.md` / `formal/`；AGENTS 缺口表三行：P2 判断那一半（ADR-01）、同源污染（ADR-04）、语义筛选与开发信效果未经真实发信验证（`docs/SPEC.md` 尚未确定一节）。
- **提议**：文档地图加三行 —— `docs/assumptions.json`｜管：环境假设、失效触发器、「当前不可控」目标与起点数字｜不该出现：需求、已被测试保证的事实；`docs/EVOLUTION.md`｜管：本产品的目标 / 传感器 / 控制变量 / 扰动 / 熔断 / 台账 / 分级｜不该出现：换个产品也成立的控制论纪律（那属于 `process/7-EVOLVE.md`）；`formal/`｜管：TLA+ 参考规约、`IMPLEMENTATION-MAP.md` 人工核对表｜不该出现：检查链读的判定逻辑。AGENTS 缺口表加一行「仓库只有一个人类身份，『人批』『非作者复核』没有第二人」，记在 SYNC 分支保护行（业-31）与 B18 对应 ADR。
- **变更分类（提议）**：文档同步
- **守法**：无
- **落地**：H 第 1 步、H 第 5 步、H 第 0e 步 · 裁决 J16 · 档：自动

---

## 7. `docs/adr/`（ADR 清单）

编号不由本文分配（每条写「新 ADR」）；题目与结论都是草稿；按 `0-process.md 通-26`，记录人批结论的 ADR 必须能指到 PR 里人类身份的批准或人类提交，否则按提案读。

### 业-03 · ADR：直面 ADR-67「不新增字段」，写明三个消费者与「`text` 由 `ears` 派生」终态
- **目标文件**：docs/adr/ · 新 ADR（H 第 2 步第 1 条 PR，文档类可单独先合）
- **实例化**：通-05、通-26
- **现状**：ADR-67:25-27 原文：「`accept` 的形状不动，不新增字段：『不保证』在 D4 的正文里本来就有先例，再加一栏只会让同一类内容有两个去处。」
- **提议**：题目「判据下挂结构化子句 `accept[].ears`：字段与三个消费者同一 PR 落地，`text` 终态由结构派生」。结论草稿：采纳 §C.1 的 C2 方案（A 改 `text`：否；B 换判据：否；C1 需求级 `behaviors[]`：否，若 ADR-67 那句被裁定不可推翻则退回 C1；C2 挂在判据下：建议采纳）；四个方案各自的做法 / 优点 / 代价 / 结论见本条末尾的比较表（source §C.1 原文），ADR 正文引用该表而不是只写结论。ADR-67 拒的是**同一类散文**再开一栏；`ears` 落地时若没有任何消费者就恰恰是「同一句话两种写法」，所以硬条件：形状与关系校验、SPEC 派生渲染行、审计「靠什么验」派生列必须同一条 PR 合入，没有消费者的字段不进登记表；终态 `text` 由 `ears` 派生（`renderClause`），两处描述收口成一处；派生时点与开关由谁按另裁（J47）。业务意图层就是今天需求的 `text`，不动；行为判据层挂在判据下。
- **变更分类（提议）**：流程补缺（推翻 ADR-67 的那一句）
- **守法**：码-01
- **落地**：H 第 2 步 · 裁决 J10 · 档：自动（ADR 是记录；它记录的人批结论按通-26 要痕迹）

source §C.1 三种放法的比较（原文，第 2 问）：

| 方案 | 做法 | 优点 | 代价 | 结论 |
|---|---|---|---|---|
| A. EARS 作为主需求 `text` | 把 `text` 改写成 EARS 句 | 一处真相 | 改 `text` = 改需求含义，35 条全部走变更评定；一条需求多义务塞不进一句；`text` 按 `1-REQUIREMENTS.md` 是「一句话说清要什么」，不是行为规格；ADR-67 已把「不保证」的范围边界放回 `text`，EARS 没有这个槽位 | 否 |
| B. EARS 替换判据 `accept[].text` | 每条判据改写 | 计量单位不变 | 判据 id「不改含义」的规矩下，改写等于退役 + 新编号，99 条判据全部换号；约十条文档存在性 / 人工判据写成 shall 就是 ADR-67 说的「不可失败判据」；仍是句子，`safely handle` 一样过形状检查 | 否 |
| C1. 需求级并列数组 `behaviors[]` 反指判据 | 不碰判据对象 | 字面上不动 `accept` | 认领单位是判据 id；子句没有 id 就没法认领，另发一套编号就是「两侧各写一遍」（ADR-22） | 否（若 ADR-67 那句被裁定不可推翻，退回此方案） |
| **C2. 挂在每条判据下 `accept[].ears`** | 判据 `text` 一字不动，旁边挂结构 | 编号、认领、变异、指纹全部兼容（原型实跑：注入后校验 0 问题、渲染相同）；可以一条一条迁；没 EARS 的判据按旧规则计量 | **直接撞 ADR-67:25-27**（见下）；`text` 与 `ears` 两处描述会漂 | **建议采用（待 ADR，J10）** |

### 业-19 · ADR：P3 草案判据评定 —— 一条 ADR 提交四条草案与「边界未声明」，逐条裁决
- **目标文件**：docs/adr/ · 新 ADR（H 第 3 步）
- **实例化**：通-26、通-14（采纳后测试先行，由独立上下文只读子句与术语表写，模型不在准入读物）
- **现状**：业务意图「P3 未经用户确认不得超出预算上限。」一字不动（`8-p3-pilot.md §D.1`）；四条草案与「边界未声明」今天只在提案里。
- **提议**：题目「P3 判据草案的评定：P3.c 限额确认、P3.d 假设值、P3.e 写前记账、P3.f 不误拒，与并发边界未声明的登记」。结论草稿（逐条独立结论）：P3.c —— 提议分类补充，连带 J2 / J3 / J29 / J30 / J39；P3.d —— d-i 或 d-ii（J4），与其余三条分开评定免得拖住整条；P3.e —— 收紧，连带 J5 / J31 / J32，架构另有 ADR（业-22 / J44）；P3.f —— 收紧（J6），架构另有 ADR（业-21 / J43）；边界未声明 —— 只登记，措辞由需求所有者起草（J7）；J35（P3.a 属性形式）、J40（`charge(-1)`）一并挂。采纳后顺序：测试先行（独立上下文）→ 实现 → 变异 N1–N7 续编 → 模型加 `write-ahead` 与 `two-level-endpoint` 场景。冲击的需求：P3、D6、F7。
- **变更分类（提议）**：见各条（本条 ADR 是记录）
- **守法**：无（各草案的守法见 业-11 … 业-15）
- **落地**：H 第 3 步 · 裁决 J2、J3、J4、J5、J6、J7、J29、J30、J35、J39、J40 · 档：自动（记录人批结论须指到人批痕迹）

### 业-20 · ADR-68 单独先合（0a）；备选：一条「弃用 #75、按 D 节重做」的 ADR
- **目标文件**：docs/adr/ · ADR-68（自 #75 分支）；或新 ADR「弃用 #75」
- **实例化**：产品专属
- **现状**：ADR-68 在 #75 分支（draft、2148 行新增、18 个文件、base 落后主干 5 次合并、`mergeable_state: dirty`）；它的五张欠条：崩溃窗口、F7.a「一次」、P3 × D4 交点、「非 200 不计费」、probe 不记账 + 并发覆盖。
- **提议**：0a：ADR-68 从主干开一条 PR 单独合入（ADR 不依赖代码）。备选（J1 选弃用）：新 ADR 题目「弃用 PR #75，按提案 D 节重做 P3 试点」，结论草稿：保留 #75 的五张欠条与等级词表为记录；探索器按 `8-p3-pilot.md §D.3–§D.6` 另写，工作量另估。
- **变更分类（提议）**：产品与工程取舍
- **守法**：无
- **落地**：H 第 0a 步 · 裁决 J1 · 档：自动（文档类）

### 业-21 · ADR：预算内部表示改为整数毫美元（换算规则、精度拒绝）
- **目标文件**：docs/adr/ · 新 ADR；docs/ARCHITECTURE.md · §「三态在类型层的落点」（行 184–197）加一行「金额单位」
- **实例化**：产品专属
- **现状**：`budget.ts:36` 浮点比较；CE-3（业-14）。
- **提议**：题目「预算内部表示改为整数毫美元（1 unit = $0.001）」。结论草稿：模型与 `Budget` 用整数毫美元，理由是 `k × 0.001 + 0.001 > k/1000` 在 26% 的 k 上为真，而 `k + 1 > k` 永远为假；盘上 `task.json.budget_usd` 仍是用户面的美元数（改盘上表示会碰 D6 的旧目录续跑），续跑时不回写 `limit_m / 1000`，只读不写；边界换算 `limit_m = Math.round(budget_usd × 1000)` 要一条测试：`'0.7' → 700`、`'1.005' → 1005`（`1.005 × 1000 = 1004.9999999999999`，`floor` 给 1004）；`Math.round(k/1000 × 1000) === k` 对 `k = 0 … 2,000,000` 零失败（实跑）；精度细于 $0.001 的预算（0.0005、0.0015）拒绝并 exit 2 还是取整后继续是 J29。ARCHITECTURE 三态表加行「金额单位：内存整数毫美元；盘上美元，只读」。
- **变更分类（提议）**：架构
- **守法**：码-18
- **落地**：H 第 3 步 · 裁决 J43、J29 · 档：人批

### 业-24 · ADR：交付物版本指纹 ≠ 缓存键（与 ADR-13「不引版本号」的关系）
- **目标文件**：docs/adr/ · 新 ADR
- **实例化**：产品专属
- **现状**：ADR-13「缓存不引版本号」；`meta.json` 没有代码 / 配置 / schema 版本，两次任务的差异无法归因（B17；`render.ts:90-141`）。
- **提议**：题目「交付物的版本指纹不是缓存键：与 ADR-13 的关系」。结论草稿：`meta.json.versions` 记录产出物由哪一版代码 / 配置 / 供应商响应形状 / Node 产出，用于窗口分桶与归因，不参与任何缓存命中判定；ADR-13 不变；`by_target` 只取影响该软目标的文件（整树指纹会让窗口每天重置 —— 主干每天 10–18 次合并）；是否冲突由人定（J14）。
- **变更分类（提议）**：需评定
- **守法**：码-23
- **落地**：H 第 1 步 · 裁决 J14 · 档：自动

### 业-48 · ADR：`replied` 的只读消费者是否算 S3 禁止的「索取回填」（E 段传感器）
- **目标文件**：docs/adr/ · 新 ADR；docs/requirements.json S3 不动
- **实例化**：通-31（没有传感器的目标不能成为自动演化的目标）
- **现状**：`replied` 由外部手写且没有任何读者；回复率 / 邮箱有效率 / 草稿改动率无入口（B16；`memory.ts:341,407`）；SKILL「不做什么」表：主动索要效果回填（S3）不做。
- **提议**：题目「`replied` 的只读消费者（按 keyword / dimension / tier 汇总）是否算 S3 禁止的『索取回填』」。结论三选一：采纳（解锁以业务效果为目标的实验，写出重启条件）/ 驳回（`docs/EVOLUTION.md` 的禁令永久化）/ 已知缺口；无代码。
- **变更分类（提议）**：产品取舍
- **守法**：无
- **落地**：H 第 11 步 · 裁决 J26 · 档：人批

### 业-51 · ADR（补充）：报告把 email `undefined` 显示成「未查询」而不是「无邮箱」
- **目标文件**：docs/adr/ 新 ADR；docs/requirements.json U 类交付物判据（报告措辞）
- **实例化**：产品专属
- **现状**：`report.ts:129` 把 email `undefined` 显示成「无邮箱」—— 报告把三档压两档（B7）。
- **提议**：题目「报告层沿用 P1 三态口径：email 未查询显示『未查询』而不是『无邮箱』」。结论草稿：补充，不改 P1 判据；报告措辞是 U 类交付物、把 P1 口径扩到报告层，冲击的需求列 U 类对应判据（编号评定时查登记表）。
- **变更分类（提议）**：补充
- **守法**：码-26
- **落地**：H 第 6 步 · 裁决 J19 · 档：提议

### 业-56 · P2.a 豁免 `scope` 收窄（红线，动豁免要独立复核）
- **目标文件**：scripts/check/mutations.json · `exemptions[]` P2.a 条目（行 1837 起）；docs/adr/ 新 ADR
- **实例化**：通-25（新增豁免是提议；理由非空校验）
- **现状**：P2.a 第三层（ADR-01）；`mutations.json` 的 `exemptions[].mitigation` 没有任何代码读（B20）。
- **提议**：评定 P2.c（业-55）后把 P2.a 豁免的 `scope` 收窄到「语义蕴含」那一半（引用完整性由 P2.c 机器守）；P2 是红线，动豁免要独立复核（ADR-24）。ADR 题目「P2.a 豁免范围收窄：机器守引用完整性，人守语义」。
- **变更分类（提议）**：红线判据豁免变更（独立复核）
- **守法**：码-42
- **落地**：H 第 9 步 · 裁决 J24 · 档：人批

### 业-59 · ADR：属性测试依赖决策（引不引 fast-check）附 `npm ci` 实测数
- **目标文件**：docs/adr/ · 新 ADR
- **实例化**：通-12（固定 seed、重放坐标、反例夹具只增不删）
- **现状**：无属性测试设施（B13）；本仓库 devDeps 只有三个，产品代码零依赖；2026-09-04 的 `npm ci` 7 分钟根因未明，`age` 是必需检查、贴在 `npm ci` 之后。
- **提议**：题目「属性测试设施：引入 fast-check 4.9.0（+ `pure-rand`）还是自研约 50 行 `forAll`」。结论草稿：先一条只改 lock 文件的 PR 量 `npm ci` 时长；超过 60 秒则自研（固定 seed、失败走 `fail++` 不 throw、无 shrink）；附实测数；seed 写死、只允许本地环境变量重放，重放坐标（seed / path / replayPath）写进 `4-VERIFY.md`；nightly 随机 seed 另议（J37）。
- **变更分类（提议）**：依赖决策
- **守法**：码-38
- **落地**：H 第 4 步 · 裁决 J12、J37 · 档：人批

### 业-60 · ADR：试点回滚记录（D.14 任一命中时撤掉 CI 步骤、保留文件）
- **目标文件**：docs/adr/ · 新 ADR（触发时才写）
- **实例化**：通-37（回滚条件预定义）、通-28（自动回滚只限被量的改动）
- **现状**：无。
- **提议**：题目「撤下 `formal` 检查步骤：触发条件与重启条件」。触发条件（`8-p3-pilot.md §D.14` 原文）：`npm run formal` 在 CI 上 > 30 秒，或出现不可重现的结果（探索器是确定性的，出现即 bug）；连续三次「反例」被人判定为模型错而不是代码错；模型核心（不含对拍夹具与打印）超过 350 行（体量线）还表达不了 D.9 的全部输入；写前记账的开销：用一个 3000 请求量级的基准（不是 selfcheck）实测账本落盘总耗时 > 限速总时长的 5%。任一命中即撤掉 CI 步骤（保留文件），ADR 记原因；回滚是安全动作不是归因。
- **变更分类（提议）**：记录
- **守法**：无
- **落地**：H 第 3 步 · 裁决：无 · 档：自动

ADR 清单索引（本文件各处提议的 ADR；题目与结论都是草稿）：

| 业 | 题目（草稿） | 结论草稿要点 | 裁决 J | 档 |
|---|---|---|---|---|
| 业-03 | 判据下挂 `accept[].ears`，字段与消费者同 PR | 采纳 C2；终态 `text` 派生 | J10 | 自动 |
| 业-18 | F7.a「一次」：每进程还是每任务 | 待人定；按任务算要登记与 D6.a 的交点 | J8 | 人批 |
| 业-19 | P3 判据草案评定（P3.c–f + 边界未声明） | 逐条独立结论；P3.d 分开评 | J2–J7、J29、J30、J35、J39、J40 | 自动 |
| 业-20 | ADR-68 先合 / 弃用 #75 | 拆五条或弃用重做 | J1 | 自动 |
| 业-21 | 预算内部表示改整数毫美元 | `Math.round(× 1000)`；盘上美元只读 | J43、J29 | 人批 |
| 业-22 | 写前记账落点：`onAuthorized` 回调 | 顺序契约新行 + N4 | J44 | 人批 |
| 业-24 | 交付物版本指纹 ≠ 缓存键 | ADR-13 不变；`by_target` 指纹 | J14 | 自动 |
| 业-30 | Creator 层 `Observation<T>` | 分批迁移 email / bio / followers | J20 | 人批 |
| 业-48 | `replied` 只读消费者与 S3 | 采纳 / 驳回 / 已知缺口 | J26 | 人批 |
| 业-49 | `memory.ts:410` 的 `\|\|` 与 P1.b | 待人定 | J17 | 人批 |
| 业-50 | profile 重试策略；`bio_links` 未查询态 | 待人定 | J18 | 人批 |
| 业-51 | 报告 email 未查询显示「未查询」 | 补充 | J19 | 提议 |
| 业-52 | 写入方并行（ADR-66 重启条件） | 待人定；触发才建模 | J21 | 人批 |
| 业-53 | `filterByMemory` 查询侧过 `keyProblem` | 待人定 | J22 | 人批 |
| 业-54 | D3「不确定」的定义 | 待人定；裁后六条属性 | J23 | 人批 |
| 业-56 | P2.a 豁免 `scope` 收窄 | 机器守引用完整性，人守语义 | J24 | 人批 |
| 业-59 | 属性测试依赖决策 | 先量 `npm ci`；> 60 秒自研 | J12、J37 | 人批 |
| 业-60 | 撤下 `formal` 步骤的记录 | D.14 四条触发 | — | 自动 |
| 业-57 | U3.a 关键词表三态化 | 措辞评定时起草 | J25 | 人批 |

---

## 8. `skill/`（Agent 判断层）

### 业-36 · `skill/SKILL.md`「追加预算」文案 vs `--budget` 是新总额
- **目标文件**：skill/SKILL.md · §「超限后的续跑」（行 142–172），行 152「追加预算继续」、行 159「用户选择追加后」、行 165 `--budget <新额度>`；scripts stderr `collect.ts:268,332`
- **实例化**：产品专属
- **现状**：SKILL.md:152「1. 追加预算继续 —— 估计还需 $0.6 左右跑完」、:159「用户选择追加后，用 `--resume` 续跑」、:165 `npm run collect -- --resume output/{task} --budget <新额度>`；代码 `collect.ts:60` 把 `--budget` 当新总额替换 `budget_usd`（业-11「待人定」）。
- **提议**：与 J3 一起裁决改哪一边：若「`--budget` 是新总额」为准，SKILL 三处与 stderr 改为「重设预算总额为 $N（含已花）」；若「追加」为准，代码改为累加（那是代码改动，随 码-17 的 J3 分支）。改的是给用户的承诺，走 SYNC 点名清单（`requirements.json` 对应判据 → ARCHITECTURE → SKILL）。
- **变更分类（提议）**：改给用户的一句承诺
- **守法**：码-17
- **落地**：H 第 3 步 · 裁决 J3 · 档：提议

### 业-37 · `skill/SKILL.md` 成本闸门：「用户不给就按 $2 走」随 P3.d
- **目标文件**：skill/SKILL.md · §「成本闸门」（行 127–141），行 129
- **实例化**：产品专属
- **现状**：SKILL.md:129「**不预置默认数字** —— 不同人的预算和任务规模差异太大。用户不给就按 $2 走，并明确告知这是假设值。」；代码无告知（B5）；SKILL 没有 `task.json` 字段契约；A7「用户在 `--budget` 里输入的就是确认」的失效触发器就是这一段的指纹。
- **提议**：d-ii：删「用户不给就按 $2 走」，改为「必须先问预算；未确认不采集（脚本 exit 2）」；d-i：写明「未给预算时脚本按假设值 $2 运行、stderr 打出『预算为假设值 $N』、`task.json.budget_assumed = true`，报告须声明」。同时补 `task.json` 字段契约（引 ARCHITECTURE 缝隙契约，业-25）。
- **变更分类（提议）**：随 J4
- **守法**：码-19
- **落地**：H 第 3 步 · 裁决 J4 · 档：提议

### 业-38 · `skill/SKILL.md` 明写不读 `shadow.json`
- **目标文件**：skill/SKILL.md · §「六个阶段」Phase 06 或 §「不做什么」（行 209–217）
- **实例化**：通-36（影子运行结果写进控制器不读的文件）
- **现状**：没有影子机制；「不做什么」表五行（S1–S5）。
- **提议**：加一行「不读 `output/{task}/shadow.json`（影子运行的候选参数结果）—— 它只给人看，Agent 依据它改任何东西都是同源回路」。注意：这一句本身含文件名，而 source 要求 lint 守 `skill/` 里不出现该文件名 —— 例外形式（例如只允许出现在「不读」那一行）由 码-36 定，source 未写。
- **变更分类（提议）**：补充
- **守法**：码-36
- **落地**：H 第 12 步 · 裁决：无 · 档：自动

### 业-39 · `skill/` 文本里出现的需求编号必须在登记表里存在
- **目标文件**：skill/SKILL.md 与 skill/references/*（今天 `arch` 只查 `scripts/`）
- **实例化**：通-20（Skill 文本是被量的，改动自动；引用编号要机器守）
- **现状**：Skill 文本直接做（第三层）；SKILL「不做什么」表引用 S1–S5；无检查核对编号存在。
- **提议**：`skill/` 里出现的需求编号必须在登记表里存在，退役编号命中即红；Skill 文本改动仍自动，改「给用户的承诺」那一句走 SYNC 表。无文本改动，只加守法。
- **变更分类（提议）**：无（守法）
- **守法**：码-46
- **落地**：H 第 5 步 · 裁决：无 · 档：自动

### 业-40 · `fit_review` 盲判流程：每任务固定 N = 10 条用户盲判，一致率三态进 `meta.json`
- **目标文件**：skill/SKILL.md · §「Phase 04 — 语义筛选」（行 83–96）；skill/references/semantic-fit.md
- **实例化**：通-32（传感器与控制器不得同源；结构上要有第二判定的落处与一致率抽检）
- **现状**：Phase 04「内容相关性靠你判断」，`fit` / `fit_reason` 由 Agent 写（字段所有权表）；`fit` 只有一个字段，没有第二判定的落处；「重跑一次语义判断」不是零成本（LLM 成本、同会话不盲、没有落处）。
- **提议**：Phase 04 末尾加「盲判抽检」小节：每任务由用户盲判固定 N 条（起点 N = 10，可调），不看 Agent 的 `fit` / `fit_reason`，结果写 `Creator.fit_review: { by: 'human' | 'agent-2', value, at }`；一致率以三态进 `meta.json`（未抽检 / 抽检 n 条一致 k 条）；**一致率按桶跨任务累计，n ≥ 50 才成为决策输入**，单任务的 10 条只是记录；一致率未记录或未达 n 时关键词表不得作为任何改动（含换词）的依据。semantic-fit.md 加同一句。
- **变更分类（提议）**：流程补充（`fit` 判定规则不动）
- **守法**：码-37
- **落地**：H 第 12 步 · 裁决 J13 · 档：提议

### 业-41 · 换词逻辑与「下次调整策略的依据」是同源回路：禁止由 Agent 依据自己的判定自动改规则或换词
- **目标文件**：skill/references/keyword-strategy.md 换词逻辑；skill/references/output-format.md 行 104
- **实例化**：通-32
- **现状**：output-format.md:104「关键词表现：每个词找到多少人、语义命中率多少 —— **这是下次调整策略的依据**」；keyword-strategy.md 的换词逻辑与这句合起来就是同源回路 —— `passed` 由 Agent 判定又被 Agent 用来调策略（B16；`9-evidence.md §I`「用表现表自动调规则」做不到）。
- **提议**：output-format.md:104 改为「关键词表现只记录；一致率达门槛（桶内 n ≥ 50 且 ≥ 0.8，业-40）后由人决定是否调整策略」；keyword-strategy.md 换词逻辑加一句「不得依据本任务 `passed` / 命中率（Agent 自己的判定）自动改语义规则或换词；Skill 层规则的改动只能提议 + 人工盲评」。
- **变更分类（提议）**：改 Skill 文本（同源回路的禁令）
- **守法**：无（第三层；结构落处由 业-40 与 码-37 提供）
- **落地**：H 第 10 步、H 第 12 步 · 裁决：无 · 档：提议

---

## 9. 新文件 `docs/EVOLUTION.md`（本产品的控制闭环实例）

是否新增 `docs/EVOLUTION.md`、还是把这几张表并进 `docs/ARCHITECTURE.md` 与 `docs/SPEC.md`「尚未确定的」一节，是 J49。

### 业-42 · 目标（参考量）表与自演化层级映射表
- **目标文件**：docs/EVOLUTION.md（新）· §「目标」§「层级」
- **实例化**：通-31、通-39
- **现状**：文件不存在；目标与层级只在提案 §G。
- **提议**：两张表原文如下（source §G）。红线与安全不变量是硬约束不是目标函数；限额与达标人数是每任务常量由用户定；命中率与每人成本是软目标，只在熔断解除后动参数层；回复率今天不可观测。
- **变更分类（提议）**：新文档（不是需求变更）
- **守法**：无
- **落地**：H 第 10 步、H 第 12 步 · 裁决 J49 · 档：提议

| 目标 | 形式 | 谁定 | 能否自动改 |
|---|---|---|---|
| 红线 P1–P5 | 硬约束，不是目标函数 | 人 | 否 |
| 安全不变量（模型层） | 硬约束 | 人批 | 否 |
| 预算 `limit`、达标人数 `target_count` | 每任务常量 | 用户 | 否 |
| 检查链全绿 | 布尔 | — | 否 |
| 关键词命中率、每人成本 | 软目标，可优化 | 人定方向，Agent 可提建议 | 参数层，且只在熔断解除后 |
| 回复率、合作率 | **今天不可观测** | — | 无从谈起 |

| 层级 | 本产品对应 | 传感器 | 今天能否自动 |
|---|---|---|---|
| 1 运行参数 | `MAX_PAGES`、退避间隔 | 成本、429 计数（提议） | 今天否（熔断 0）；无影子形式（改它就花钱），H 第 12 步后只能小步改 + 人批 |
| 2 配置与策略 | 维度权重、竞品词权重 | 关键词表现表（噪声大） | 只能提议 + 人批；纯评分常量可影子运行（H 第 12 步） |
| 3 prompt / 知识 / 工作流 | `skill/references/*` | 人工盲评 | 只能提议 |
| 4 代码与测试 | `scripts/` | 检查链 | 修实现自动；改尺子提议 |
| 5 架构 | 模块边界、顺序契约 | 架构锚点检查 | 人批 |
| 6 需求变化 | `requirements.json` | 无 | 只能提议（ADR 草案） |
| 7 真实业务反馈实验 | 回复率 | **无** | 不可能，先建传感器 |

### 业-43 · 传感器表：八个传感器各答 unknown 表示 / 延迟 / 噪声
- **目标文件**：docs/EVOLUTION.md（新）· §「传感器」（含框图的产品版）
- **实例化**：通-31（框图与断开段标注）、通-32（三态表示、不同源、失效形态）
- **现状**：传感器 A（检查链、审计、变异）与 B（`meta.json` / `task.json`）闭合；C（关键词表现表）闭合但噪声大且与控制器同源；D（memory 的 contacted / replied / blocked）半开；E（回复率、合作率）开路（source §G 框图；现状分析在 `9-evidence.md`）。
- **提议**：表原文如下（source §G）；每个传感器要有失效形态（读不到、样本不足、口径变了），失效时控制器停手；进入决策的量来源字段必须能表达三态，裸 `0` 不得进入任何自动决策。
- **变更分类（提议）**：新文档
- **守法**：码-27（扰动计数）、码-28（关键词表三态）
- **落地**：H 第 10 步 · 裁决 J49 · 档：提议

| 传感器 | 读哪里 | 测的是什么（测量 / 代理） | unknown 的表示 | 延迟 | 噪声来源 |
|---|---|---|---|---|---|
| 检查链 | `npm run check` 退出码与各步输出 | 逻辑与文档一致性（测量） | 检查可以「无从判断」（size 基线算不出时明说） | 分钟 | 假阳性（体量闸门）、同源污染 |
| 变异测试 | `mutate.ts` 的三态判定（抓到 / 崩溃 / 存活）+ 锚点失效 | 测试是否能失败（测量） | 崩溃与锚点失效都不算抓到 | 十分钟级 | 变异集只覆盖想到的形状 |
| 成本 | `task.json.requests`、`meta.json.cost_estimate_usd` | 请求数 × 单价上限（**代理**：真实计费在 TikHub 侧） | 请求数可能**不可读或非法**（`null` / 字符串，B2）—— #75 的 `ledgerProblem` 让它变成显式拒绝而不是静默归零 | 即时 | 崩溃窗口、非 200 是否计费的假设、probe 不记账 |
| 采集覆盖 | `meta.json` 的 measured / unavailable / unqueried 三计数 | 数据边界（测量） | 三态分开计数 —— 这是本产品做对的地方 | 即时 | 「查询失败」与「未查询」同态（B6）；外部响应无形状校验（B7）；`profile_failed` 只在 stdout 不进 meta |
| 关键词表现 | 报告的关键词表 `found / passed / hit rate` | 搜索策略质量（**代理**：`passed` 由 Agent 的语义判断给出） | **今天把「0 结果 / 请求失败 / 未跑」坍缩成「无此行」**（B16） | 每任务 | 样本小（一词几十人，IG ≤ 12）、判定者与控制器同源、`found` 随轮转顺序变、跨品类不可比 |
| 记忆回填 | `memory/creators.json` 的 `contacted / replied / blocked` | 真实联系结果（测量，但稀疏且不及时） | 缺字段 = 未回填，不是 false；读不出来 = 整个传感器失效（D4 已定成「不产出名单」） | 天到周 | 用户是否回填、是否准确 |
| 扰动计数（429、schema 未识别、IG 回退） | **今天不存在**（`tikhub.ts:96-100` 退避后不计数不落盘） | 环境扰动 | — | — | H 第 10 步才有 |
| 回复率 / 合作 | 不存在 | — | — | — | — |

（source 原表七列；「测的是什么」与「测量 / 代理」合为一格，内容未删。）

### 业-44 · 控制变量表 + 「当前不可控」目标登记
- **目标文件**：docs/EVOLUTION.md（新）· §「控制变量」；docs/assumptions.json 加「不可控目标」条目
- **实例化**：通-34（控制变量表与不可控识别两问）
- **现状**：参数散在 `score.ts`、`collect.ts`、`assessment.ts`、`tikhub.ts`；粉丝上下限「算不算改需求」两份文档矛盾（B20）。
- **提议**：表原文如下（source §G）。对每个软目标问两句 —— (a) 有没有传感器能在它变动后分辨出结果的变化；(b) 变动它是否触碰任何红线或人批项；任一答「否 / 不知道」就标「当前不可控」写进假设登记表并停止对它的自动演化。登记：**回复率**不可控（既无传感器，又只有文案一个变量，而文案不是唯一原因）；**关键词命中率**在现有效应量与样本量下「当前不可决策」。参数层的变量要先集中到一个配置文件（码-35），单变量守法才守得住。
- **变更分类（提议）**：新文档
- **守法**：码-35
- **落地**：H 第 12 步 · 裁决 J27 · 档：提议

| 变量 | 在哪 | 谁能动 | 影响面 | 反馈延迟 |
|---|---|---|---|---|
| 关键词四维权重、竞品词 +15 | `scripts/lib/score.ts` 常量（`semantic-fit.md` 有副本） | 参数层：Agent 可提议，影子运行后人批 | 排序与分层 | 每任务 |
| 粉丝闸门阈值 5000 / 5000000 | `score.ts`（`assessment.ts` 的粉丝档独立写死） | 人批（它决定谁「凭空消失」；两份文档对「算不算改需求」矛盾，B20） | 名单成员 | 每任务 |
| 单关键词页数上限 `MAX_PAGES = 4` | `collect.ts:30` | 参数层，Agent 可提议；**无影子形式**（候选值意味着多发请求） | 成本与覆盖 | 每任务 |
| 每关键词轮转顺序 | `collect.ts` `run()` | 架构层，人批 | 维度多样性 | 每任务 |
| 语义匹配规则、反模式清单 | `skill/references/semantic-fit.md` | Skill 层：Agent 可提议，**不得由 Agent 依据自己的判定结果自动改** | 分层、名单 | 每任务 + 人工盲评 |
| 下一轮关键词的选择 | `keyword-strategy.md` 的换词逻辑 | Skill 层：同上 —— 它与上一行是同一种同源回路，不是参数层 | 召回 | 每任务 |
| 开发信写法 | `outreach-draft.md` | Skill 层：提议；效果无传感器（E 段开路），今天**没有任何数据可以支持改它** | 草稿 | 不可观测 |
| 预算、达标人数 | 用户输入 | 用户 | — | — |
| 风险阈值（P10 / P90、两个信号、8 个同行）、样本窗口 12 / 6、活跃 45 / 90 | `assessment.ts` | 人批（F8 / D8 / D10 的判据写死了数字，改它是改需求） | 降级 | 每任务 + 盲评 |

### 业-45 · 扰动表与熔断条件 0–6
- **目标文件**：docs/EVOLUTION.md（新）· §「扰动」§「熔断」
- **实例化**：通-38（默认态是熔断；七条条件；熔断后只许回滚与修复；恢复需人解除）
- **现状**：熔断条件 0「任一传感器不存在（版本指纹、扰动计数、一致率、台账）」今天全部命中 —— 任何参数层的自动演化都处于熔断态，这不是缺陷，是「没有传感器就不动」的字面意思。
- **提议**：扰动表与熔断 0–6 原文如下（source §G）；熔断之后只允许回滚与修复，不允许新实验；恢复需要人解除；H 第 12 步的验收是「熔断 0 的四个传感器全部存在，熔断默认态解除」。
- **变更分类（提议）**：新文档
- **守法**：码-27（429 / schema 半漂移 / IG 回退计数）
- **落地**：H 第 12 步 · 裁决：无 · 档：提议

| 扰动 | 怎么察觉（今天 / 提议） | 对策 |
|---|---|---|
| TikHub 响应结构变化 | 今天：`pickList` 完全识别不出时打印顶层 key；**半漂移（数组在、item 形状变）静默成「0 人且标完成」**（sensors track）；提议：`raw_count > 0 但入库 0` 的关键词计数进 `task.json` | 计数 > 0 即冻结所有参数层演化 |
| TikHub 限流 / 单价变化 | 今天：无（429 不计数）；提议：`task.json` 累加 429 次数；单价假设在登记表里 | 单价假设失效 → P3 的性质结论降为未知（D.7） |
| IG 回退到 `search_users` | 今天：不记录（`tikhub.ts:294`） | 提议记录来源端点 |
| 平台搜索质量随时间漂移 | 同一关键词跨窗口 `found` 数下降 | 只记录，不自动调关键词 |
| 季节、市场 | 无传感器 | 不做 |
| 测量噪声：小样本 | 桶与区间 | 低于最小可分辨差不决策 |
| 测量噪声：Agent 判定不稳定 | 一致率抽检（纪律 2） | 一致率 < 阈值时关键词表不得用于决策 |

熔断（停止一切自动演化的条件，任一命中即停）：
0. 任一传感器不存在（版本指纹、扰动计数、一致率、台账）—— **今天全部命中**；
1. 任何红线判据的测试或变异变红；
2. 假设登记表里任一条 P3 假设被标为失效（单价、计费规则、原子写）；
3. 传感器失效：`meta.json` 缺 `versions` 块、schema 半漂移计数 > 0、记忆读不出来；
4. 影子运行与现行结果的差异超过上限（说明候选规则不是「微调」）；
5. 同一目标连续两轮实验方向相反（振荡迹象，从台账读）；
6. 一致率抽检低于阈值。

### 业-46 · 实验台账格式、起点数字、影子运行与翻开关 / 回滚流程
- **目标文件**：docs/EVOLUTION.md（新）· §「状态估计」§「实验台账」§「影子运行」；`experiments.json` 的形状
- **实例化**：通-28（revert 收紧尺子的 PR 是放宽）、通-33（窗口、区间、分桶、版本指纹）、通-35（迟滞、冷却、单变量、台账）、通-36（影子运行）、通-37（回滚触发器预定义）
- **现状**：今天只有每任务的 `meta.json`，没有跨任务记录；无影子机制；主干每天 10–18 次合并（`git log --merges`）。
- **提议**：**台账** `experiments.json` 每条记：改了什么（配置键）、何时、桶（同品类 × `versions.by_target`）、桶内结果（区间）、回滚触发器、是否回滚。**状态估计的数字**（source §G 原文）：用 Wilson 区间，以 SPEC 首轮记录的命中率量级（竞品词 30%、品类词 38%）算：n = 48 时半宽 ±0.13，n = 200 时 ±0.065，两个 n = 200 的窗口区间不相交需要相差 **≥ 14 个百分点**；SPEC 记录的那条「与预期相反」的观察只差 8 点，要每窗口 n ≈ 600（半宽 ≤ 4 点）到 1000（留出两窗口都偏的余量）才可能被判定 —— **以现有效应量，这个闭环在可见的将来只记录、不决策**。窗口口径：按「同品类、同版本」分桶，桶内攒样本；跨品类不比；版本指纹只取影响该软目标的文件（例如关键词命中率只看 `score.ts` 的维度加分与 `keyword-strategy.md`），不是整棵 `scripts/`。**起点数字**（可失败、待校准，写进 业-23）：桶内 M = 200 名过粉丝闸门的候选；一致率阈值 ≥ 0.8；影子差异上限 = 分层变动 ≤ 10% 候选。**迟滞**例：「竞品词权重下调」的触发是连续两个桶命中率区间低于品类词，改回的触发是连续三个桶高于。**冷却期**：任何参数层改动之后，至少一个完整桶内不得再改任何参数层变量；同一时间只允许一个在途实验。**单变量**：一次改一个变量（码-09 守「一次 PR 只 diff 一个键」）。**影子运行**只对纯评分常量（`score.ts` 的维度加分、竞品词加分、tier 阈值）成立：候选参数与现行参数同时计算（本地纯函数，不花 TikHub 的钱），候选结果写进 Agent 不读的 `shadow.json`，交付物仍按现行参数产出，累积到桶满后人看一眼再决定翻开关；`MAX_PAGES` 这类改变请求数的参数**没有影子形式**；Skill 层规则没有影子形式，只有人工盲评。**回滚条件预定义**：翻开关的那条 PR 里必须写明回滚触发器（例如「两个桶内命中率区间低于翻开关前」或「任何一次 P1–P5 相关检查变红」），触发即 revert，不等复核（限被量的改动）；revert 后指标回升不证明那次改动是原因，归因仍要单变量 + 对照 + 窗口。
- **变更分类（提议）**：新文档
- **守法**：码-37（台账 + `fit_review` + 一致率三态）、码-36（`shadow.json`）、码-09（单变量守法）
- **落地**：H 第 12 步 · 裁决：无 · 档：提议

### 业-47 · 验证强度分级表：每条需求的级别、理由、今天的守法
- **目标文件**：docs/EVOLUTION.md（新）· §「分级」
- **实例化**：通-16（分级三问）、通-18（结构化义务到各层守法的映射表）
- **现状**：无分级文档；「今天的守法」列即现状。
- **提议**：表原文如下（source §B 分级表）。**不值得形式化的（明确说出来，免得被要求「一视同仁」）：** 全部 U 类、S 类、F1–F4；D8–D10 的聚合算法本身（只值得属性）。把重型方法用在它们上面，证明的是格式对，不是产品对。
- **变更分类（提议）**：新文档
- **守法**：码-39（三组属性）、码-40（崩溃点穷举）、码-29（身份属性与 lint）、码-31（形状校验）、码-34（占位符变异）
- **落地**：H 第 3 步、H 第 6 步、H 第 7 步、H 第 8 步、H 第 9 步 · 裁决：无 · 档：提议

| 需求 | 级别 | 理由 | 今天的守法 |
|---|---|---|---|
| **P3** 预算 | **模型检查 + 属性 + 例子** | 状态少、事件少、崩溃与重入交错多、数值边界明确、违反不可逆 | 例子测试 P3.a、变异 M-P3-a；P3.b 靠 selfcheck 真跑（`mutations.json` 显式豁免，理由引 ADR-13）；#75 的模型（未合入） |
| **D6** 断点续跑 | **模型检查**（与 P3 同一个模型；试点内**建模不裁决**） | 它就是 P3 模型的另一半：`persist` 点、`resume` 初始化 | 例子测试；#75 的 `ResumeKeepsCount` |
| **F7** 阈值提醒 | **例子**；「一次」的定义待评定 | 状态太小；但 B22 说明它与 D6 有未登记的交点 | 例子 + 变异 M-F7-a |
| **P1** 三态 | **类型结构 + 属性 + lint** | 「Unqueried ≠ MeasuredAbsent」是结构性质；不需要模型检查 | undefined/null 约定 + P1 lint + 21 条 `req: P1` 变异 |
| **P4 / D4** 记忆 | **崩溃点穷举（单写入方）+ 属性（过滤）+ 例子；并发成为需求时再模型检查** | 三步协议与原子写是交错问题（ADR-38 / 41 记的都是漏掉的交错）；`filterByMemory` 是「对所有 contacted / blocked 永不出现在 kept」的属性 | 例子测试 + 变异 M-P4-a 等；并发明写不保证（ADR-66） |
| **D1 / D3** 身份 | **属性**（幂等、等价关系两侧同函数、不合并的安全方向、歧义不合并） | 纯函数；输入空间大（Unicode）；不需要状态机 | 例子测试 + 变异 M-D3-a |
| **P2** 产品事实 | **结构契约（引用完整性）+ 人工语义复核** | 蕴含关系无裁决器（ADR-01） | P2.b 变异 M-P2-a；P2.a 第三层 |
| **P5** 数据边界声明 | **例子 + 变异**；不值得模型 | 声明的存在性是布尔，穷举没有意义 | 变异 M-P5-a…l（12 条） |
| **D5** CSV 转义 | **属性**（round-trip） | 纯函数 | 例子 + 变异 M-D5-a |
| **D7** 邮箱提取 | **属性 + 例子** | 正则；负例空间无限，属性只能采样 | 例子 + 变异 M-D7-a |
| **D8 / D9 / D10** 公开指标 | **例子 + 属性（样本量门槛、缺失不按 0）** | 聚合是纯函数 | 例子测试 |
| **F6 / F8** 分层否决与降级 | **属性** | 纯函数 | 例子 + 变异 M-F6-a、M-F8-a |
| **U1 / U5 / U6** 输出结构 | **例子 + 变异** | 渲染结构，不是性质 | 已有 |
| **S1–S5** 范围 | **`source_grep` / 类型断言 / 人工** | 「不存在 SMTP 调用」是 grep 级；「无对应模块」是人工 | 无 suite |
| **F1 / F3 / F4.b / S2.a** Skill 文档条款 | **`file_text` oracle 或人工** | 判据本身是「文档里写着」 | 字符串存在性 |
| **F2 / F5** | **例子** | 类型穷举与降级路径 | 已有 |

---

## 10. 跨文件的文档漂移裁决

### 业-58 · B20 七项文档漂移各以哪边为准；粉丝上下限「算不算改需求」
- **目标文件**：docs/SPEC.md、docs/CONVENTIONS.md、skill/SKILL.md、README.md、AGENTS.md、skill/references/*（B20 点名的各处）
- **实例化**：产品专属
- **现状**（B20）：`PR_SIGNALS` 代码正则 ≠ 文档；tier fallback 60/40 无文档；429 退避的文档口径（150 → 300ms）与代码（翻倍封顶 1000 + 额外倍数）不同；粉丝上下限「算不算改需求」两份文档矛盾；SKILL「profile 补全跑在续跑最前面」≠ 代码顺序；README 手写「35 条需求 / 5 条红线」、AGENTS 手写「共 5 条」无检查守；`mutations.json` 的 `exemptions[].mitigation` 没有任何代码读（`mutate.ts:29`）。
- **提议**：逐项定正本（代码 / 文档哪边为准），各一行 SYNC 或一条 ADR；粉丝上下限先裁「算不算改需求」（J27），是则走 `2-CHANGE.md`。本文不替任何一项定。
- **变更分类（提议）**：需求有歧义 / 文档
- **守法**：无（J45 裁决后按项立项）
- **落地**：无 H 步 · 裁决 J27、J45 · 档：人批
