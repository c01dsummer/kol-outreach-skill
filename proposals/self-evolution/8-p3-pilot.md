# 8-p3-pilot.md · P3 纵向试点：反例、术语与判据草案、状态机、不变量、假设、测试 / 变异 / 监控 / CI 映射

**装什么**：source §D 的 D.0–D.13 原文 —— P3 预算安全试点的完整纵向叙述：已复现的反例 CE-1–CE-5、业务意图、术语表与草案判据 P3.c–f（对照副本）、状态 / 事件 / 转移、不变量 I1–I7 与活性 L1–L2、假设 A1–A9、目标 / 未知 / 非目标、反例清单、测试与变异映射 N1–N9、运行时监控、CI 接入；每小节顶部一行标它落在哪一层、对应哪些 `业-xx` / `码-xx`。
**不装什么**：任何编号的定义 —— 术语表与草案判据的正本在 `1-docs.md`（业-06、业-11–业-14），假设登记表正本在 `1-docs.md 业-23`，代码改动在 `2-code.md`，通用规则在 `0-process.md`，落地步骤在 `3-rollout.md`，**试点回滚条件（D.14）与成功 / 失败判据（D.15）的正本也在 `3-rollout.md`「P3 试点的回滚与成败判据」**（本文 §D.14 / §D.15 只留标题与指针，让既有引用仍可跳，裁决文本只有一处），差距表 B1–B22、工具比较与 #75 对照在 `9-evidence.md`；本文件不改任何现行需求文本，草案判据全是提议，变更分类都是提议分类。
**编号怎么读**：本文件不定义 `通 / 业 / 码`，只引用；`CE-1…CE-5`（§D.0）、`I1–I7` / `L1–L2`（§D.6）、`A1–A9`（§D.7，正本 业-23）、`N1–N9`（§D.11）沿用 source；`Jnn` 在 `README.md`，`H0a…H12` 在 `3-rollout.md`；`file:line` 指主干 `d7e20d7`（#118 的合并提交，2026-09-18T17:28Z；cc132a7 之后 199 个提交），写明「#75 分支」的除外（#75 分支的 `file:line` 指 97c358e，即提案读的那棵树；分支今天的 head 是 rebase 到 d7e20d7 之后的 2deb489，见 §D.0 末段与 §D.13 的注）；标「实跑」的数字是在 cc132a7 树或本会话 scratchpad 上跑出来的，d7e20d7 上未复跑（句中另注「d7e20d7」的除外）；可算的数按 ADR-82 要么写「N（d7e20d7）」要么只写命令；证据标记只用五种（实跑 / #75 自述 · 本次复现 / 读代码 / 联网核对 / 尚未验证），无标记按「读代码」；「设计面板」「scratchpad」指本会话的工作目录，脚本与输出不在仓库内（索引在 `9-evidence.md 附录二`）。

---

## D.0 范围与已复现的反例

层：docs / code · 对应：业-11、业-12、业-13、业-14（四条草案各对应一个反例）、业-15（并发范围外）、业-18（F7.a 建模不裁决）、业-20（#75 去向）· 码-17、码-18、码-20、码-21 · 差距证据：`9-evidence.md §B`

试点的对象刻意小：`scripts/lib/budget.ts`（56 行（d7e20d7）；cc132a7 → d7e20d7 未改）、`scripts/providers/tikhub.ts` 的 `get()`（charge / fetch / refund 顺序）、`scripts/collect.ts` 与 `scripts/enrich.ts` 里的 `--budget` 解析、`persist()` 的时机与退出码。它适合当试点的理由在 `1-docs.md 业-47`（分级表）的 P3 行。

| 试点内**裁决**（本节给草案，评定后生效） | 试点内**建模不裁决**（模型里有，结论只登记） | 范围外 |
|---|---|---|
| 限额的确认（P3.c）、假设值（P3.d）、写前记账（P3.e）、不误拒（P3.f） | D6.a 的续跑计数、F7.a 的「一次」、P3 × D4 的退出码交点、「非 200 不计费」 | 并发进程（A6）、断电（A5）、`probe` 不记账、汇率与阶梯折扣、enrich 的缓存命中判定（D8 / ADR-13） |

本次会话在读到 PR #75 之前，用读代码 + 端到端实跑确认了三个反例**存在**（这是对代码缺陷的独立确认，不是对 #75 尺子的复核 —— 区别见 `9-evidence.md §I` 最后一表）：

| # | 反例 | 复现 | 违反的是什么 |
|---|---|---|---|
| CE-1 | `collect --resume <dir> --budget abc`：`Number('abc')` = NaN，`spent + 0.001 > NaN` 恒为 false，闸门永不拒绝。实跑：请求数 2 → 17，exit 0，提醒 0 条（stderr 只打出「预算 $NaN」）。NaN 落盘成 `null`，下次续跑在第一次 charge 时 `TypeError`，exit 1 | `collect.ts:59-60`；scratchpad `p3/e2e-a` | P3（多花）；退出码契约；对照 `enrich.ts:66-72` 有校验 |
| CE-2 | 崩溃窗口：`enrichProfiles()` 每人一次 charge，循环内没有 `persist()`（`collect.ts:205-229`；persist 只在 `:180` 每页后、`:198` run 末尾、`:245` main）。SIGKILL 于第 2 个 profile 请求时盘上 `requests=12`，实际已发 14；续跑从 12 起，最终盘上 15，实际 17 | `p3/e2e-c`，`kill-fetch.ts` 夹具 | 「不超出」只对盘上计数成立；最坏落后 = `needsProfile` 人数 |
| CE-3 | 浮点误拒：`699 × 0.001 + 0.001 > 0.7`，limit=0.7 只放行 699 次；10 万个 `k/1000` 的 limit 中 26,410 个少放行一次，0 个多放行；P3.a 用的 0.005 不触发 | `p3/scan.ts`、`budget-probe.ts`；fast-check、Z3（`9-evidence.md §E.0`） | 不违反「不超出」；违反「付得起不该拒」；`remaining` 与 `affordable` 自相矛盾 |

读代码得出、未实跑的：**CE-4** `cfg.budget_usd ?? 2`（`collect.ts:72`）静默给 $2，没有 CONVENTIONS §7 要求的「假设值」告知；**CE-5** `--budget 0` / `-1` 被接受，首个 charge 即抛、exit 3、提示「预算用尽 $0.017 / $0.00」。

PR #75 在本次会话之前已经用模型找到了 CE-2（`SpendIsRecorded` 5 步、`NoOverspend` 12 步）并手工修了 CE-1。**#75 已于 2026-09-11 关闭、未合入**（GitHub API：state closed、仍是 draft、merged false、mergeable_state dirty；PR 记录的 head 是 f652943（2026-09-08 的空提交，只带一行 `age-ok:`；提案读的代码是它之前的 97c358e），base 仍 475cfe9，主干自 base 起已有 50 个合并提交（d7e20d7）；唯一一条评论是 chatgpt-codex-connector 机器人的安全评审汇总，没有人类评论，关闭理由：未知）。分支 `claude/kol-formal-verification-kr5igx` 仍在远端，且在 PR 关闭之后（2026-09-18 19:00Z 前后）被**整条 rebase 到 d7e20d7 上**并追加了一个提交 2deb489（GitHub API：分支 = d7e20d7 + 5 个提交，四个原提交换了 sha，f652943 那个空提交没了；详见 §D.13 首段的注）；主干 d7e20d7 上没有 `formal-rule.ts` / `formal.ts` / `formal/` / ADR-68。本节仍**建议**采用它的模型，去向按 J1 的新选项定（重开并拆五条 / 从分支摘取重做 / 弃用；`1-docs.md 业-20`；对照表在 `9-evidence.md 附录三`；拆法在 `3-rollout.md` H0a–H0e，码-10 / 码-11），只做四件它没做的事：EARS 层的判据草案（业-11–业-14）、不误拒（P3.f，业-14）、随机 + shrink 的属性层（码-38、码-39）、机器可读的假设登记表（业-23）。

## D.1 业务意图（不变）

层：docs · 对应：业-19（一条 ADR 提交四条草案与「边界未声明」，逐条裁决）、业-15 · 规则：`0-process.md 通-09`、通-26

> P3 未经用户确认不得超出预算上限。

这一句一个字不动。下面标「草案」的是新增判据的提议；每条给的变更分类是**提议分类**，由评定者按 `process/2-CHANGE.md` 定。

## D.2 术语表与 EARS 判据

层：docs · 对应：业-06（术语表正本）、业-04 / 业-05（`P3.a/1`、`P3.b/1`）、业-11、业-12、业-13、业-14（草案判据正本）、业-15（范围边界）、业-16、业-34、业-36、业-37、业-23（A2）· 码-01（R2 / R3 守术语）、码-41（每条 shall / shall_not 一条变异）· 规则：`0-process.md 通-01`、通-02

**术语表**（词汇表的 P3 子集；id 带命名空间。**正本见 `1-docs.md 业-06`**，本表是对照副本，改动只改正本；`1-docs.md 业-04 / 业-05` 的示例引用它。标「草案」的术语只被 P3.c–f 的草案子句用到，随 `3-rollout.md` H3 登记；未标的十三个就是 `1-docs.md §1.6` C.6 第 3 步装进 `terms` 的那些。oracle 栏写的是 `1-docs.md 业-02` `Oracle` 联合里的 kind）：

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

**现行判据（文本不变，只加子句）：** 见 `1-docs.md 业-04`（`P3.a/1`）与 `业-05`（`P3.b/1`）；P3 × D4 交点的 `unless` / `boundary_of` 见 `业-10`（J9）。

**草案判据（新增，需评定；分类是提议；正本在 `1-docs.md 业-11`–`业-14`，本节是对照副本）：**

- **P3.c（提议分类：需求有歧义 → 补充。按 `2-CHANGE.md:26` 补充不是变更、不走评定，但它改尺子，走 `0-process.md 通-20` 的提议档过独立复核；其中「低于已花」与 `Infinity` 的处理是产品取舍 → 人批；正本 业-11）** — `when task.start_or_resume, if budget.limit_unparseable or budget.limit_below_spent, the system shall_not provider.emit_request; outcome task_json.unchanged, process.exit_code = 2.`
  依据：CE-1、CE-5；`enrich` 已经这么做，`collect` 没有。#75 的 `budgetProblem / ledgerProblem` 是它的实现（码-17），且比本节多守了 `requests: null / "4"`。**待人定**：`--budget` 是新总额（`collect.ts:60` 直接替换 `budget_usd`），而 stderr（`collect.ts:268,332`）与 SKILL.md 的文案都说「追加」—— 用户按「追加」填一个小于已花的数就落进「低于已花」；这一处是「想立刻停」还是「输错」（exit 2 拒绝续跑 vs 接受并立刻停），以及文案改哪一边（J3，业-36）；`Infinity` 按「不是有限数」处理还是按「用户明确不限」（本文按前者，理由是 P3 的字面「上限」；J2）。

- **P3.d（提议分类：产品取舍 → 人批，二选一；正本 业-12，J4）**
  - **d-i 保留默认并告知**：`where budget.assumed_limit, when task.start_or_resume, the system shall budget.print_assumed; outcome task_json.budget_assumed = true.`
  - **d-ii 删除默认**：`where budget.assumed_limit, when task.start_or_resume, the system shall_not provider.emit_request; outcome process.exit_code = 2.`
  依据：CE-4。两种都不违反 P3，选哪种决定用户看到什么。本文推荐 d-ii：F1 已要求 Agent 必问预算，默认值只在 Agent 违反 F1 时起作用，而那正是最不该静默的时刻。§D.10 / §D.11 两个分支各写一套（码-19、码-41 的 N6）；裁决结果决定 业-34（CONVENTIONS §7）与 业-37（SKILL 成本闸门）怎么改。

- **P3.e（提议分类：改需求要什么 —— 收紧；人批；正本 业-13，J5 / J31 / J32）** — `while task.resumable, when budget.authorized, the system shall budget.persist_before_emit.`
  依据：CE-2。这条把「不超出」的对象从「盘上计数」扩到「跨运行供应商实际计费」，是**新的保证对象**，不是澄清。它的代价要人看：每次授权后、发出前一次 `task.json` 原子写（`collect.ts:128-133` 的 `persist()` 今天还同时写 `creators.raw.json`，要先拆成只写账本的一支 —— 码-21）；429 重试每次尝试都写；本次实测（本容器 ext4，含 fsync）3 KB × 3000 次 = 1.5 s，相对 150 ms 的限速间隔可忽略；`creators.raw.json` 不拆时 400 KB × 3000 = 4 s / 1.2 GB 写放大 —— 所以必须拆。
  **它保证的是 `persisted ≥ billed`（A2 成立时），不是 `persisted ≥ emitted`**：429 重试每次 charge → persist → 发出 → refund，四次尝试后 `persisted = 1`、`sent = 4`（实跑，用真实 `Budget` + 真实 `TikHub.get()` + fake-fetch），`billed = 0` 是按 A2 推得、不是量得。要 `persisted ≥ emitted` 得另落盘一个单调的发出计数，那是另一条架构决策，本文不提。

- **P3.f（提议分类：改需求要什么 —— 收紧；人批；正本 业-14，J6）** — `when budget.request_proposed, unless budget.cost_exceeds_limit, the system shall_not budget.raise_exceeded.`
  依据：CE-3。P3.a 说超了必须拒，P3.f 说没超不许拒；今天没有判据说后者，26% 的 limit 少一次是「合规」的。#75 判断「方向安全，不写成不变量」；本文认为「付得起不该拒」值得成为判据，交人定。实现上的整数毫美元是架构决策（§D.3；`1-docs.md 业-21`，J43）。

- **P3 正文的范围边界（本文只指出，不起草；正本 业-15，J7）**：`collect.ts:102 / :129` 与 `enrich.ts:77 / :126` 各自读一次、无条件写回 `requests`，两个进程同时采集时预算池可能被花两遍；P3 文本今天读起来像无条件保证，而 D4 的同类边界已按 ADR-67 写进正文（ADR-66）。**范围边界声明是放宽方向，`0-process.md 通-09` 禁止自动执行者起草**；这里只登记「边界未声明」，措辞由需求所有者起草（#75 分支的 ADR-68 第五张欠条已记录同一件事 —— ADR-68 未合入主干，d7e20d7 的 `docs/adr/` 共 74 条、编号 1–83，68 号空着）。

- **P3.a 现有文本是否改成属性形式并保留 0.005 / 10 次作例子**：改现有判据要走 `2-CHANGE.md`，只提出不起草（业-16，J35）。

- **不进判据、只进假设登记表的**：「非 200 不计费」（`tikhub.ts:90`，A2 —— `1-docs.md 业-23`）。

## D.3 状态定义

层：code（模型与 `budget.ts`）/ docs（架构决策 ADR）· 对应：业-21（整数毫美元 ADR，J43）、业-25（盘上表示不动）· 码-18（整数毫美元 + 换算测试）、码-50（`ConfirmedLimit` 品牌类型，可选）· 规则：`0-process.md 通-19`

模型用**整数毫美元**（1 unit = $0.001），不用浮点美元。理由是 CE-3：`k × 0.001 + 0.001 > k/1000` 在 26% 的 k 上为真，而 `k + 1 > k` 永远为假。这是**架构决策**，采纳时写 ADR（业-21）。盘上 `task.json.budget_usd` 仍是用户面的美元数（改盘上表示会碰 D6 的旧目录续跑）；边界换算 `limit_m = Math.round(budget_usd × 1000)` 要一条测试：`'0.7' → 700`、`'1.005' → 1005`（`1.005 × 1000 = 1004.9999999999999`，`floor` 给 1004）；设计面板实跑 `Math.round(k/1000 × 1000) === k` 对 `k = 0 … 2,000,000` 零失败。续跑时不回写 `limit_m / 1000`，只读不写，避免重新引入浮点。

| 变量 | 取值域 | 对应实现 | 说明 |
|---|---|---|---|
| `limit` | `ℕ ∪ {⊥}` | `Budget.limitUsd`（`budget.ts:21`）；`task.json.budget_usd` | `⊥` = 未确认（NaN / null / 缺失）。⊥ 时不得存在任何授权转移 —— 今天不成立（CE-1） |
| `charged` | `ℕ` | `Budget.requests`（`budget.ts:22`） | 内存计数；`spent = charged × unit` 派生 |
| `persisted` | `ℕ` | `task.json.requests` | 盘上计数 |
| `sent` | `ℕ`（ghost） | 无 | 供应商**收到**的提交次数，含非 2xx（沿用 #75 的命名） |
| `billed` | `ℕ`（ghost） | 无 | 供应商**真正计费**的次数。A2 成立时 `billed` = 2xx 响应数；A2 为假时 `billed = sent` |
| `phase` | `idle · charged · sent` | 隐含在 `get()` 的控制流（`tikhub.ts:83-103`） | #75 的三态 |
| `notified` | `⊆ {50, 80}` | `Budget.notified`（`budget.ts:18`） | 只在内存；续跑重触发（`9-evidence.md §B` B22） |
| `exit` | `{–, 0, 1, 2, 3}` | `process.exit` 各处 | |

**非法状态不可表示**（类型层，架构决策，**不在试点内**，`3-rollout.md` H3 之后可选 —— 码-50）：`limit` 用品牌类型 `ConfirmedLimit`，唯一构造函数就是 #75 的 `budgetProblem` 校验；`Budget` 只接受它。要说清：类型只保证「值必须经过那个构造函数」，真正挡 NaN 的是构造函数里的运行时校验 —— `loadTask()` 返回的 `budget_usd: number` 一个 `as` 就过编译。

## D.4 事件

层：code · 对应：码-17（`start` / `resume` 校验）、码-18（`authorize` / `reject`）、码-20（`propose` / `send` / `respond` / `refund`）、码-21（`persist`）、码-10（`crash` 只在模型里）

| 事件 | 触发者 | 对应实现 |
|---|---|---|
| `start(cfg)` / `resume(dir, arg?)` | 入口 | `collect.ts:47-75`；`enrich.ts:64-73` |
| `propose(c)` | 适配层准备发请求 | `tikhub.ts:84` 调 `charge()` 之前 |
| `authorize` / `reject` | `Budget.charge()` | `budget.ts:35-46` |
| `persist` | 入口的 `persist()` | `collect.ts:128-133`（主干变异 `M-P3-b` 钉在 `:129`，d7e20d7）；`enrich.ts:125-129` |
| `send` | `fetch` 发出 | `tikhub.ts:87` |
| `respond(ok)` / `respond(status)` | 响应到达 | `tikhub.ts:88-102` |
| `refund` | 非 2xx | `tikhub.ts:90` |
| `notify(th)` | 跨阈值 | `budget.ts:41-45` |
| `crash` | 任意时刻 | 无（模型专有） |
| `terminate(code)` | 入口收尾 | `collect.ts:330-335`；`enrich.ts:270-273` |

## D.5 转移（现状 → 提议）

层：docs / code · 对应：业-22（顺序契约新行 + ADR，J44）、业-26（exit 2 缝隙契约）、业-12（`start` 缺配置走 P3.d）· 码-17（`resume` 校验）、码-19（`start`）、码-20（`onAuthorized`）、码-21（账本支与 persist 失败）、码-18（`reject` 无状态变化）、码-13（`write-ahead` 场景）

**写前记账的落点是一条顺序契约改动（架构决策，要 ADR + 顺序契约变异 —— 业-22，变异 N4）：** `persist` 是入口的函数，`charge` 在适配层里；提议让 `TikHub` 构造时接受一个 `onAuthorized: () => void` 回调，`get()` 在 `charge()` 之后、`fetch` 之前调用它，入口把 `persist`（只写账本的那一支）传进去。另一种落点 —— 在 `enrichProfiles` 循环里「先 +1 再 persist 再 get」—— 写下去的是上一次的 `charged`，I2 仍破，不采用。

| 转移 | 前置 | 副作用顺序（现状） | 副作用顺序（提议） | 理由 |
|---|---|---|---|---|
| `start(cfg)` | — | `limit := cfg.budget_usd ?? 2`；`charged := 0`；saveTask | `limit := parse(cfg.budget_usd)`，缺失 → P3.d 的 d-i 或 d-ii | CE-4 |
| `resume(dir, arg)` | task.json 存在 | `limit := Number(arg)`（无校验）；`charged := persisted` | `budgetProblem / ledgerProblem` 校验，失败 → exit 2、task.json 不动 | CE-1、CE-5 |
| `propose(c) → authorize` | `limit ≠ ⊥ ∧ charged + c ≤ limit` | `charged += c`；阈值检查；sleep；fetch | `charged += c`；**`persist`（账本）**；阈值检查；fetch | CE-2 |
| `propose(c) → reject` | `limit ≠ ⊥ ∧ charged + c > limit` | throw；无状态变化 | 同 | 已确认（读代码）；属性测试要检验「无状态变化」包括 `notified` |
| `propose(c)`，`limit = ⊥` | — | **授权**（NaN 比较恒 false） | 不可达（`budgetProblem` 在入口拦） | CE-1 |
| `respond(non-2xx)` | `phase = sent` | `charged −= 1`（`max 0`）；429 → 退避后回到 `propose` | 同；下一次 authorize 的 persist 把退款写回盘 —— 退款后到下次 persist 之间盘上**多记**一次（安全方向） | — |
| `crash` | 任意 | 内存丢；`persisted` 保留 | 同；提议下 `persisted ≥ billed` 在界内成立（依赖 A2、A4；A5 为非目标） | CE-2 |
| `persist` 失败 | writeFileAtomic 抛 | 在 `run()` 内抛出 → main catch → `stopped='error'` → 再 persist（可能再抛）→ exit 1 | persist 失败 ⇒ **不发出**，按 error 收尾 | 写前记账的自然结果 |
| `terminate` | — | budget → 3；error → 1；记忆读不出 → 2；否则 0 | 同 | 主路径已正确；阶段相关分歧（402 / 429 在 profile 阶段被吞）见 `9-evidence.md §B` B6 |

## D.6 不变量与时序性质

层：code（模型与 TLA+ 规约）/ docs（裁决点）· 对应：业-13（I2 / L1，J5 / J31 / J32）、业-14（I4）、业-11（I5）、业-18（I6，J8）、业-10（I7 的 `unless`，J9）· 码-10（模型不变量）、码-12（`BudgetP3.tla` 活性）、码-13（`write-ahead`）、码-16（活性进链，可选）、码-39（I1 / I3 属性）· 规则：`0-process.md 通-15`（不变量只增不删）

安全性（对所有可达状态成立；每条标现状 / 提议）：

- **I1 进程内不超出**：`limit ≠ ⊥ ⇒ charged × unit ≤ limit`。现状成立（`budget.ts:36` 是预检；#75 的 `RejectedNotCounted`）。
- **I2 跨运行不超出**：`persisted ≥ billed`（在 A2 下），推论 `Σ billed ≤ limit`。**现状不成立**（CE-2；#75 的 `SpendIsRecorded`）；提议的写前记账使其在界内成立（TLC `Limit0 = 3`、2 页 2 人 1 次崩溃；依赖 A2、A4，A5 非目标）。严格版 `persisted ≥ sent` 提议**也不满足**（429 重试），列为「A2 为假时才需要、当前设计不满足」。
- **I3 拒绝无副作用**：`reject` 前后 `charged / persisted / notified / sent` 全部不变，且不发生 `send`。
- **I4 不误拒**：`limit ≠ ⊥ ∧ charged + c ≤ limit ⇒ authorize`。**现状在浮点上不成立**（CE-3）；整数模型下成立。
- **I5 限额已确认**：任何 `send` 发生时 `limit ∈ ℕ`。**现状不成立**（CE-1）。注意：#75 的 BFS 模型里没有 ⊥ 这个状态，I5 在 #75 里由对真实 `Budget` 的 14 值域扫描（`LIMIT_DOMAIN`）守，不是模型报出的。
- **I6 提醒各一次（每进程）**：每个阈值在一个进程生命周期内最多 `notify` 一次，且只在跨越时。「每任务一次」是 F7.a 未定义的部分（`9-evidence.md §B` B22），不在试点内裁决（业-18）。
- **I7 退出码忠实**：`exit = 3 ⇒ 终止原因是 reject ∧ checkpoint 已写`；反向 `reject ∧ checkpoint 已写 ∧ ¬memory.unreadable ⇒ exit = 3`（记忆读不出来时退 2，ADR-15 优先）。

活性（时序性质；本次会话的 P3 设计面板用一份独立写的 TLA+ 规约在 TLC 上跑过，**实跑**，规约与日志在 scratchpad `formal-p3/`；#75 的模型没有这两条）：

- **L1 付得起的最终发出**：若 `limit − charged ≥ unit` 且仍有工作，最终有一次 `send`。现状配置成立（无崩溃 26 个 temporal 分支、`MaxCrash = 1` 46 个）。**提议配置（写前记账）+ 崩溃时被违反**：`persist(disk=3) → send → 429 → refund(mem=2) → crash → resume(mem = disk = 3 = limit) → reject → exit 3` —— 退款还没写回盘就崩了，续跑把那次退款当成花掉了，付得起的最后一次被拒。这是写前记账的**活性代价**：安全方向保守，用户可能少拿一次请求。要人知道（J5）。
- **L2 拒绝后终止**：若 `reject` 发生，则最终 `terminate(3)`（在 `¬memory.unreadable` 下）。现状与提议都成立。

同一份规约给出的安全性结论（实跑，`Limit0 = 3`）：现状配置 `S2 billed ≤ limit` 被违反，19 步反例与 `e2e-c` 同构；「响应后落盘」（`after`）配置仍被违反，两次崩溃各漏一次；写前记账（`ahead`）配置全部安全性质成立，22,696 个 distinct states 1.3 秒、放大界（2 页、3 人、3 次重试）150,502 个状态 2.2 秒；`--resume --budget` 低于已花（负追加）在 `resume` 步违反 `mem ≤ limit`（对应 CE-5，P3.c 处理）。

## D.7 环境假设登记表与失效检测（第 12 问）

层：docs · 对应：业-23（`docs/assumptions.json` 正本，J15 / J34）、业-15（A6）、业-32（文档地图）· 码-45（审计读、TTL 与指纹比对）、码-03（`levels` 降为 ASSUMED）、码-23（`meta.json.versions` 记 Node 版本）、码-24（`reconciliation`）· 规则：`0-process.md 通-11`、通-10

每条假设写成：是什么、若为假破坏哪条性质、怎么验证、状态、失效触发器、**触发器由谁怎么检测**。建议落在 `docs/assumptions.json`（机器可读，进 `content_hash` 同类的指纹），审计读它。**正本见 `1-docs.md 业-23`**；下表是对照副本。

| # | 假设 | 若为假 | 验证方式 | 状态 | 失效触发器 → 触发器检测 |
|---|---|---|---|---|---|
| A1 | 单次请求单价 ≤ $0.001（`budget.ts:1`：TikHub 基础价，有阶梯折扣，此为上限） | `spent` 低估真实花费；I1 / I2 在美元意义上失效（请求数意义上仍成立） | 对照 TikHub 价格页；一次真实任务后对照供应商账单（**人工**，`3-rollout.md` H1 指定责任与日期） | **未验证** | 价格页变化；`tikhub.ts` 端点变化 → 外部：TTL（起点 90 天，过期即「未验证」）；代码：登记表记 `tikhub.ts` 相关函数的内容指纹，审计比对，变了即「待重验」 |
| A2 | 非 2xx 响应不计费（`tikhub.ts:90` 退款的依据） | I2 失效（退款后 `charged` 低估）；B21 的 8 次提交 1 次计数是它的放大 | 账单对照，专门数 4xx / 429 | **未验证** | 同 A1 → 同 A1 |
| A3 | 请求已发出、进程在响应前死亡 → 供应商**可能**计费 | 按不计费建模会低估 | 无法直接验证；模型按最保守方向（视为已计费）处理 | 保守假设 | — |
| A4 | `writeFileAtomic` 的 rename 使文件要么旧要么新（`atomic.ts:74-87`） | `persisted` 可能是坏 JSON → 续跑读不出来 | 有测试（D4.i 相关断言）**但无 `criterion()` 认领**（`9-evidence.md §B` B11） | 已验证（测试） | Node 版本、文件系统类型变化 → 代码指纹：`atomic.ts`；环境：`meta.json.versions` 记 Node 版本 |
| A5 | 断电后 rename 是否持久化：尽力而为（ADR-50） | 断电丢最后一次 persist → I2 失效一次 | 不验证；写进不保证 | 已声明不保证 | — |
| A6 | 同一任务目录单写入方（ADR-66） | 两个进程各自 `persisted` 互相覆盖 | 不验证；写进不保证（§D.2 的范围边界，待需求所有者起草） | 已声明不保证 | — |
| A7 | 用户在 `--budget` 里输入的就是确认 | 误输入即误确认 | 产品决定 | 已接受 | SKILL.md 流程改变 → 代码指纹：`SKILL.md` 预算段 |
| A8 | 整数在 JSON 往返中精确（< 2⁵³） | 计数读回失真 | 语言规范保证，无需验证 | — | — |
| A9 | fake-fetch 的行为等价于真实 fetch 的**顺序**（不是内容） | 自检里的顺序断言对真实运行无效 | `selfcheck` 与一次真实运行的 `requests` 对照 | 部分验证（2026-08-26 真实跑通） | `fake-fetch.ts` 或 `tikhub.ts` 改动 → 代码指纹（按内容指纹算，cc132a7 → d7e20d7 之间 `tikhub.ts` 已被 ecde780 触发过一次：22 行改动全是 `p1-ok:` → `P1 例外：` 的注释改名，`get()` 83–103 等被引段逐字未变；`fake-fetch.ts` 未变） |

（source 原表七列；为守「表格不超过 6 列」把「失效触发器」与「触发器检测」合为一格，内容未删。）

**失效后的接线**：假设状态变为「未验证 / 待重验」时，依赖它的性质在覆盖记录的 `levels` 栏（`1-docs.md §1.6` C.6 第 2 步落地，码-03，审计读）从 `MODEL_CHECKED` 降为 `ASSUMED`，审计对红线判据报「目标等级未达」。这一步依赖 `0-process.md 通-10` 的等级栏落地，之前只能靠审计打印登记表。

## D.8 目标性质 · 未知 · 非目标

层：docs · 对应：业-23（未知 A1 / A2 / A3 登记在假设表）、业-15（A6 非目标）、业-18（F7「每任务一次」非目标）、业-10（P3 × D4 交点非目标）· 码-16（活性不进 `npm run formal`）、码-12（TLC 参考规约）

**目标性质（提议实施后，待 §D.13 的检查确认；今天没有一条是已证明的）**：I1–I7。活性 L2 在本会话的 TLC 参考规约上成立（实跑）；L1 在提议配置下**已知被违反**（§D.6，接受为写前记账的代价，J5 / J31 / J32）；两条活性都**不在 `npm run formal` 的检查范围内**（BFS 探索器没有时序逻辑，`9-evidence.md §E.2`），只留在 TLC 参考规约上，或按 §D.13 第 9 条改写成可达性检查（码-16）。

**未知**：真实账单与 `requests × unit` 的差（A1 / A2）；供应商对 in-flight 请求的处理（A3）。

**非目标**：并发进程（A6）；断电持久性（A5）；`probe` 的花销不记账（#75 分支的 ADR-68 第五张欠条，未合入主干；ARCHITECTURE 缝隙契约表明写 `probe` **不落盘**，d7e20d7 行 133）；汇率与币种；阶梯折扣；enrich 的缓存命中判定；F7「每任务一次」；P3 × D4 交点的裁决。

## D.9 反例清单（模型必须覆盖的输入）与两套配置的预期

层：code · 对应：码-17（NaN / null / Infinity / 低于已花）、码-18（`c = 0`、`c < 0`、浮点 limit、精度）、码-13（`write-ahead`、`two-level-endpoint`）、码-21（persist 失败）、码-39（连续 reject 属性）、码-10（模型两套配置）· 裁决点落在：业-11（J2 / J3）、业-12（J4）、业-17（J40）、业-21（J29）

模型跑**两套配置**：「现状」（persist 在循环外、无入口校验）与「提议」（写前记账、入口校验）。每个输入给两套的预期结论：

| 输入 | 现状预期 | 提议预期 |
|---|---|---|
| `limit = NaN / null / 缺失` | I5 违反（对真实 `Budget` 的值域扫描；模型里 ⊥ 不可表示） | 入口 exit 2，不可达 |
| `limit = Infinity` | 无限放行（本次实跑） | 按 P3.c 拒（待人定，J2） |
| `limit < alreadySpent`（含 0、负数） | 首个 charge 即抛、exit 3、提示自相矛盾 | exit 2（待人定，J3） |
| `c = 0` | `charge(0)` 通过且不改计数（实跑） | 模型禁止 `propose(0)`（付费请求 cost ≥ 1 unit） |
| `c < 0` | `charge(-1)` 让计数从 1 变 0 且不经过 `refund()`（实跑）—— 没有任何判据覆盖的输入形状 | 构造函数与 `charge` 拒绝非正 cost（架构决策；是否算需求由评定定 —— 业-17，J40） |
| `budget_usd = 0.0005`（低于单价精度） | 折算成 0 次或 1 次取决于四舍五入 | 拒绝「精度超过 $0.001」（设计面板的 `parseBudgetMilli` 实跑；是否拒绝要人定，J29） |
| 写前记账 + 退款后崩溃 | — | L1 违反：少拿一次（见 §D.6） |
| `charged × unit = limit` 恰好相等 | 下一次 `propose(1)` reject | 同 |
| 浮点 `limit = 0.7 / 0.009 / 0.010` | 699 / 8 / 9 次（I4 违反） | 700 / 9 / 10 次 |
| 连续 reject | 每次 reject 状态不变 | 同（属性测试） |
| authorize 后、send 前崩溃 | `persisted < charged`（I2 违反，CE-2） | 不可能（persist 在前）。**「每个 profile 之后 persist」（enrich 今天的节奏）挡不住这一条**：设计面板的探索器在该配置下仍报 in-flight 崩溃反例（5 步），只有写前记账无反例（实跑，2,965 / 28,845 状态两档界） |
| send 后、响应前崩溃 | 同上 | `persisted ≥ billed`（保守多记） |
| 非 2xx 后、下次 persist 前崩溃 | — | `persisted` 多记一次 —— 安全方向 |
| `persist` 失败 | 计数丢、exit 1 | 不 send；exit 1；task.json 是旧的（A4） |
| 429 → refund → 重试 × 3 | `charged` 净不变；`sent = 4`；`persisted` 落后 | `persisted = 1`、`sent = 4`、`billed = 0`（本次实跑）；**A2 为假则 `billed = 4 > persisted`** —— 这是 ADR-68（#75 分支，未合入主干）第四张欠条的形状 |
| 402 | exit 1（不是 3）：供应商余额不足不是本预算问题 | 同；profile 阶段被吞成 `profile_failed` 的分歧见 `9-evidence.md §B` B6 |
| 两次并发 `charge`（同进程） | JS 单线程、`charge()` 同步 → 原子 | 同 |
| 两个进程 | 非目标（A6） | — |
| 默认预算 | CE-4 | P3.d 的 d-i 或 d-ii |

## D.10 测试映射（含函数契约）

层：code · 对应：码-17 / 码-18（`budgetProblem` / `ledgerProblem` / `charge` / `refund` 契约）、码-20 / 码-21（`TikHub.get()` / `persist()` 契约）、码-39（属性测试与生成器）、码-44（例子测试）、码-19（P3.d 两分支）、码-22（进程内 assert）、码-38（属性设施与用例预算）、码-10 / 码-14（模型检查与对拍）、码-50（类型约束，可选）· 分级依据：业-47 · 规则：`0-process.md 通-12`（用例预算）、通-18（义务 → 各层守法）

**函数契约（前置 / 后置）** —— 运行时 assert 或注释 + 测试：

| 函数 | 前置 | 后置 |
|---|---|---|
| `budgetProblem(v)` | 任意 | 返回 `undefined` ⇔ `v` 是有限非负数 |
| `ledgerProblem(v)` | 任意 | 返回 `undefined` ⇔ `v` 是 `undefined` 或非负整数 |
| `Budget.charge(n)` | `limit` 已过 `budgetProblem`；`n ≥ 1` | 抛出 ⇒ `count` 不变且未 notify；不抛 ⇒ `count += n ∧ count × unit ≤ limit` |
| `Budget.refund(n)` | — | `count = max(0, old − n)`；`notified` 不变 |
| `persist()`（账本支） | — | 盘上 `requests = charged`；失败抛出且盘上是旧的（A4） |
| `TikHub.get()` | — | 每次尝试：`charge` → `onAuthorized` → `fetch`；非 2xx ⇒ `refund` |
| `resume` | `task.json` 存在 | `charged = persisted`；`limit` 过校验 |

| 义务 | 类型约束 | 属性测试 | 例子测试 | 模型检查 | 运行时监控 |
|---|---|---|---|---|---|
| P3.a/1 超限必拒、拒绝无副作用 | — | ✔ 随机 `(limit, 序列)`：I1、I3 | ✔ 现有 0.005 × 10 | ✔ I1、I3（#75 `RejectedNotCounted`） | 进程内 assert |
| P3.b/1 断点 + exit 3 | — | — | ✔ selfcheck 夹具（现有；d7e20d7 上 P3.b 由自检入口认领（`selfcheck.ts:280` `criterion('P3.b')`）+ `M-P3-b`（by: selfcheck，kills 点名 `selfcheck.ts:247` 那条夹具）守，ADR-70 落地 4，显式豁免已撤） | ✔ I7（#75 `Exit3Recoverable`） | 退出码分布 |
| P3.c 限额必须可解析 | （可选）`ConfirmedLimit` | ✔ 随机字符串：非有限 → 拒 | ✔ `abc`、`-1`、`0`、`Infinity`、`1e400`；盘上 `null` / `"4"` | ✔ 值域扫描（#75 `LIMIT_DOMAIN`） | 启动时打印限额来源 |
| P3.d 假设值 | — | — | d-i：缺配置 → stderr 行 + 标记；d-ii：缺配置 → exit 2 | — | `meta.json.budget.assumed`（d-i） |
| P3.e 写前记账 | — | ✔ 崩溃注入：任意崩溃点后 `persisted ≥ billed` | ✔ `kill-fetch` 夹具 | ✔ I2（#75 `SpendIsRecorded` 从违反变成立） | 续跑时打印 `persisted` 与 `updated_at` |
| P3.f 不误拒 | 整数单位 | ✔ 随机十进制 limit：恰好 `L/unit` 次 | ✔ `0.7 → 700`、`1.005 → 1005` | ✔ I4 | — |
| F7.a 提醒各一次（每进程 —— 按 J8 裁决前的临时解读） | — | ✔ 随机序列下每阈值 ≤ 1 次 | ✔ 现有 | ✔ I6 | — |

属性测试的生成器只需要三样：`limit ∈ [0, 3000]` 毫美元（或十进制字符串）、事件序列 ∈ `{propose, respond(ok), respond(429), respond(500), crash, resume}*`、序列长度 ≤ 50。用例数要按变异乘数预算：`npm run mutate` 对每条变异跑一次 `npm test`（主干 330 条（d7e20d7）；命令：`node -p "require('./scripts/check/mutations.json').mutations.length"`），属性用例的每一毫秒 **CPU 时间**都要乘 330；`mutate` 从 ADR-72 起缺省按核数并行（`--jobs=N` / `MUTATE_JOBS`，每个 worker 一个隔离目录），墙钟按并行度折算（ADR-72 实测 4 核 3.41 核同时在忙、85%，并明写「倍数可以跨机器参考，秒数不行」）。设计面板实跑一套 P3 属性在 N = 2000 时 3.8 秒（每例约 1.9 ms），N = 100,000 超过 120 秒被中止。按 `3-rollout.md §D.15` 第 4 条「`npm run check` 总增量 < 60 秒」拆预算：`formal` ≤ 5 秒（本地目标；CI 上限 30 秒是 `3-rollout.md §D.14` 的回滚线）；属性测试每条 N ≤ 50、七条合计 `npm test` 增量 ≤ 0.1 秒，× 330 ≈ 33 秒 CPU 时间（墙钟按核数折算，未实测）；三项合计 < 60 秒（60 / 5 / 30 秒是提案自定阈值，按 ADR-82 属配置不属可算数；但 ADR-72 之后按绝对秒数定预算只在一台机器上成立，要不要改成相对倍数 —— 相对一次 `test.ts` 或 `mutate` 总时长 —— 待人定）。大 N（2000 以上）只在本地按 seed 跑，不进 CI；nightly 随机 seed 是 J37。P3.c 的例子要包括 `Number()` 会静默接受的输入：`'1e3'` → 1000、`'0x10'` → 16、`''` → 0（实跑）；字符串写法的取舍是 J30。

## D.11 变异映射

层：code · 对应：码-41（N1–N8 进 `mutations.json`）、码-43（N9）、码-10（N8 与 `M-H16-*` 重编号）、码-42（变异集治理）· N2 的归属：业-13（P3.e 子句）或 业-23（A2 进判据）· 规则：`0-process.md 通-18`、通-24

编号：主干 d7e20d7 已占用 `M-P3-b`（req `P3.b`：`collect.ts` 的 `state.requests = budget.count` → `= 0`，by: selfcheck，ADR-70 落地 4）—— 与 #75 分支 97c358e 上同名的 `M-P3-b`（「请求先发出去再过闸门」）同名不同义；#75 的 `M-P3-c`（`budgetProblem` 恒 `undefined`）主干未占用。主干 P3 名下今天只有 `M-P3-a`、`M-P3-b` 两条（命令：`node -p "require('./scripts/check/mutations.json').mutations.filter(m=>m.req.startsWith('P3')).map(m=>m.id).join(',')"`）。#75 分支 rebase 到 d7e20d7 之后的 2deb489 已自行避让（按 2deb489 的 `mutations.json` 实核：336 条（2deb489）= 主干 330 + 6，`comm` 两份 id 清单只多出 `M-P3-c` / `M-P3-d` / `M-D6-l` / `M-H41-a/b/c` 六条；分支树已取，体量数见 `3-rollout.md` H0「背景（分支现状）」/ `9-evidence.md 附录三`）：原 `M-P3-b` → `M-P3-c`（tikhub 的先后）、原 `M-P3-c` → `M-P3-d`（budgetProblem）、原 `M-D6-i` → `M-D6-l`（ledgerProblem；2deb489 的提交信息说 `M-D6-i` 被另一条在途分支占着，按「号不复用，包括活在别的分支上的」避开 —— 这条规则 process/ 里未见明文，只有需求号与决策记录号明写不回收）、`M-H16-a/b/c` → `M-H41-a/b/c`（formal-rule）。本节用临时标号 N1–N9，落地时从主干未占用的号续编（今天从 `M-P3-c` 起）；走「从分支摘取」就沿用 2deb489 的编号。

| 临时号 | 改什么 | why（需求语言） | 被谁抓 |
|---|---|---|---|
| （现有 M-P3-a） | 删掉超限时的抛出 | 预算超限不再抛出，静默继续花用户的钱 | P3.a 例子 |
| N1 | `>` 改 `>=` | 恰好花完预算时最后一次付得起的请求被拒 | 现有 P3.a 例子已能抓到（实跑：sent = 4 ≠ 5）；P3.f 属性把它扩到全域 |
| N2 | 删掉非 2xx 的退款 | 被限流的重试也计费，用户少拿三分之一额度 | 429 例子。**实跑（cc132a7）：把它打到主干上跑现有 `scripts/test.ts`，837 个 ✓、exit 0 —— 存活；d7e20d7 上 `scripts/test.ts` 是 1004 个 ✓、4109 行（d7e20d7 导出树的 `npx tsx scripts/test.ts` 日志计 ✓，`wc -l`），N2 打上去是否仍存活：未知（未复跑）。** 今天没有任何测试守它，也没有任何判据要求它 —— 「非 2xx 不计费所以退款」只存在于 A2；这条变异落地前要先有归属（P3.e 的子句或 A2 进判据），否则 `mutate` 的归属检查会拒（ADR-34） |
| N3（= #75 分支里原叫 `M-P3-b` 的那条，2deb489 起改叫 `M-P3-c`；主干 `M-P3-b` 已被占用） | 把记账挪到发请求之后 | 请求先发出去再看预算，超限的那一次已经花了钱 | fake-fetch 顺序断言（自检）。**实跑（cc132a7）：打到主干上现有测试同样存活；d7e20d7 未复跑**；设计面板的顺序属性（每次 fetch 前最近两事件必须是 charge, persist）随机 500 例全部抓到 |
| N4 | 删掉发请求前的落盘回调 | 进程被杀时盘上少记，续跑后总花费超出上限 | 崩溃注入属性 |
| N5（= #75 分支里原叫 `M-P3-c` 的那条，2deb489 起改叫 `M-P3-d`；主干 `M-P3-c` / `M-P3-d` 都未占用（d7e20d7）） | `budgetProblem` 恒 `undefined` | 输错一个参数得到一次无上限采集 | P3.c 例子 |
| N6 | d-i：删掉假设值告知；d-ii：缺配置也放行 | 用户不知道系统替他定了预算 | P3.d 例子 |
| N7 | 毫美元换算用 `floor` | 用户填 1.005 美元只拿到 1004 次 | 换算例子 |
| N8 | 模型检查器的不变量改成恒真 | 检查器对任何模型都报通过 | #75 已有 `broken-charge` 负例场景 + `M-H16-*`（须重编号：主干 `M-H16-a/b/c` 仍被 #78 占用；harness 变异组号已用到 `M-H40`（d7e20d7），新组从 `M-H41` 起，2deb489 已把它们改成 `M-H41-a/b/c` —— H2、H18 虽空着，变异 id 能否回收 process/ 里未见明文（需求号与决策记录号明写不回收：`1-REQUIREMENTS.md:13`、`2-CHANGE.md:168`），保守不用） |
| N9 | 入口 exit 3 改 exit 1 | 预算用尽被当成出错，Agent 不会提示追加预算 | selfcheck 夹具（现有）。**主干已做（ADR-70 落地 2–4，d7e20d7）**：`by / kills` 已接线（`mutate.ts:57` import `verifier-rule.ts`；`4-VERIFY.md` 177–210 写入 by / kills 同进同出、见齐就停、夹具没造对不算抓到），只由自检认领的判据没有 `by: "selfcheck"` 负片就是审计硬失败（`audit.ts:307`）。N9 可直接写成 `by: "selfcheck"` + `kills` 的变异（req `P3.b`），夹具 label 要能被 kills 清册点名（`selfcheck.ts` 的 `named` / `runBoth` / `run`，:109 / :115 / :145），不必再等 |

## D.12 运行时监控

层：code / docs · 对应：码-22（进程内断言）、码-19（启动 / 续跑打印限额来源）、码-24（`meta.json.budget` 块）· 业-25（`meta.json` 是否触及 U7，J13）、业-26（exit 1 含义不扩展）、业-23（对账钩子写进 A1 / A2）

- **进程内**：每次 `charge()` 之后 `assert(charged × unit ≤ limit)`；每次账本 `persist()` 之后 `assert(persisted ≥ charged)`（退款后 `persisted > charged` 是允许的）。断言失败按 error 收尾、exit 1 —— 它们不该被触发，触发就是模型与代码分叉了。**exit 1 沿用「其他失败」的既有含义**，不扩展退出码（ARCHITECTURE「含义不许扩展」）。
- **启动 / 续跑时**：打印限额来源（配置 / `--budget` / 假设值）、盘上 `requests`、上次 `updated_at`。
- **`meta.json` 新增 `budget` 块**（`{ limit_m, charged, persisted_at_exit, assumed, reconciliation: 'unverified' | { provider_count, checked_at } }`）—— `meta.json` 装什么是 U7.d 的对象，**要评定是否触及 U7**（J13）。`reconciliation` 默认 `unverified`。
- **对账钩子（人工）**：一次真实任务后，把供应商后台的请求数与 `Σ task.json.requests` 对照，结果由人写进假设登记表 A1 / A2 的「最近验证日期」（审计只读）。

## D.13 CI 接入

层：code / docs · 对应：码-10（模型核心）、码-11（`formal.ts` 入口与接线）、码-13（两个新场景）、码-14（对拍扩界）、码-05（认领 id 与登记表比对）、码-15（反例夹具）、码-44（selfcheck 三入口）、码-45（审计读假设表）、码-16（活性）、码-48（CI）· 业-27（锚点表）、业-31（SYNC 行）、业-23、业-25（旧目录读法）、业-20（J1）· 规则：`0-process.md 通-15`、通-12、通-40

建议采用 #75 的文件与命名，不另起（J1，`1-docs.md 业-20`。**#75 已于 2026-09-11 关闭未合入，分支仍在远端且已 rebase 到 d7e20d7**（`git ls-remote origin` 指向 2deb489，PR 记录的 head 仍是 f652943 —— 见本段末注）；主干 d7e20d7 上没有 `formal-rule.ts` / `formal.ts` / `formal/`，所以 J1 的三个选项是：重开（或新开 PR）并拆五条 / 从分支摘取重做 / 弃用 —— 若 `3-rollout.md` H0 选弃用，本节按 §D.3–§D.6 另写探索器，工作量另估）：`scripts/check/formal-rule.ts`（判定：状态、动作、不变量、有界 BFS、对拍投影）+ `scripts/check/formal.ts`（入口）+ `npm run formal`，位置在 `mutate` 之后、`selfcheck` 之前（现行 `check` 链已是 8 步：size → spec → adr → typecheck → test → mutate → selfcheck → audit，见 `package.json` 的 `check` 脚本（d7e20d7）；lint / age / arch 三步已随 ADR-77 / ADR-76 / ADR-78 撤掉，这个插入位置仍在）；`--tla` 不进链。拆分方式见 `3-rollout.md` H0c / H0d（码-10、码-11）。

> 注（2deb489，联网核对）：分支 `claude/kol-formal-verification-kr5igx` 今天 = d7e20d7 + 5 个提交：0025608（ADR-68）→ 4e962b5（budgetProblem / ledgerProblem）→ c65b08d（模型）→ b8d15c7（报错改法）—— 四个原提交 rebase 后换了 sha，committer 时间 2026-09-18 18:59–19:03Z —— 再加 2deb489（19:10Z，9 个文件 +23/−20）。2deb489 的提交信息自述：把分支里因 ADR-76 / 77 / 78 / 70 而失真的八处散文与注释改准（AGENTS.md 检查链加回 formal 一步；formal/README.md 改成「表还在、没机器核」；formal-rule.ts 不再拿已删的 lint-rule.ts 举例；budget.ts / selfcheck.ts 不再说「入口判定没有变异守得住」；按 ADR-82 拿掉「三条入口」「六条不变量」的基数），并把变异编号避让为 `M-P3-c` / `M-P3-d` / `M-D6-l` / `M-H41-a/b/c`。分支树已取（本地 `git cat-file -t 2deb489` = commit，`git merge-base 2deb489 d7e20d7` = d7e20d7）：对 d7e20d7 的 `git diff --numstat` 是 19 个文件 +2148/−11（2deb489），按 `size-rule.ts:40-46` 的 `categorize()` 归类源码类 1278 / 测试 203 / 文档 485 / 其他 182；`formal-rule.ts` 903 行、`formal.ts` 203、`BudgetProtocol.tla` 180、ADR-68 119（`wc -l`）；变异 336 条 —— 数值与 `3-rollout.md` H0「背景（分支现状）」/ `9-evidence.md 附录三` 一致。该树上 `npm run check` 是否全绿：未跑。它让「从分支摘取重做」的起点从 97c358e 变成 2deb489，H0a–H0e 的拆法要对着 2deb489 重核（`3-rollout.md` 那边的事）。

1. **界**（码-13、码-11）：#75 的五个场景（`spec` / `entry-cadence` / `no-crash` / `bill-non-200` / `broken-charge`，56–2236 状态）；本文加两个：`write-ahead`（提议配置，`SpendIsRecorded` 与 `NoOverspend` 预期成立）与 `two-level-endpoint`（`9-evidence.md §B` B21，预期给出 A2 为假时的反例）。规模参考（设计面板的独立探索器，实跑）：宽界（limit ≤ 6、3 页、3 人、2 次崩溃）现状 64,957 状态 211 ms，写前记账 28,845 状态 65 ms。目标：`npm run formal` < 5 秒（本地）；`3-rollout.md §D.14` 的回滚阈值 30 秒是 CI 上的上限，两者的关系是「本地目标 / CI 上限」。
2. **对拍**（模型 ↔ 代码；码-14、码-05）：#75 的 `runConformance()`（有界穷举，把 `CONFORMANCE_LIMITS` 从 `[0,1,2,3]` 扩到含 9，让它碰到 CE-3 —— 扩界后的对拍本次**未跑**，「能碰到」是从最小误拒点 9 推出的）+ `3-rollout.md` H4 的随机对拍（码-39）。认领只写 `criterion('P3.a')`；P3.c–f 是草案，两份覆盖记录（`.check-cache/test-claims.json` 由 `test.ts` 写、`.check-cache/selfcheck-claims.json` 由 `selfcheck.ts` 写，`claims.ts:15` / `:35`，ADR-70 落地 3）都不与登记表比对（`claims.ts:103` `claimsWellFormed` 只查形状；`9-evidence.md §B` B13 后半，d7e20d7 上仍成立），认领草案 id 会静默通过。
3. **模型 ↔ 模型**（码-12）：`--tla` 逐字符比可达状态集，复现条件 `-deadlock -workers 1`（`9-evidence.md §E.2b`）。
4. **反例持久化**（码-15）：探索器找到轨迹时写成夹具 `scripts/check/fixtures/p3/<name>.json`，形状 `{ name, bounds, trace: [{ action, state }], expect: '<不变量名> violated at step k' }`；`test.ts` 里一条「回放全部夹具」的测试。**夹具只增不删**；删一条要 `oracle-change:` trailer（`0-process.md 通-21`）。
5. **审计**（码-10、码-44）：`formal-rule.ts` 进判定模块清单，必须有变异（`SYNC.md:33`「新增一道闸门」🔒 audit；ADR-81 明写不撤 ADR-62 这条）（N8 / #75 的 `M-H16-*`，2deb489 已重编号为 `M-H41-a/b/c`，见 §D.11）；`formal.ts` 在链里自成一步。#75 分支（97c358e 时）给 `selfcheck.ts` 加的 46 行（2deb489 又改了 +6/−5）与 `formal` 无关 —— 是三条入口对坏预算 / 坏账本的真跑（P3.c 的入口验收：`budget_usd: "abc"`、`requests: null`、`--budget 3.0.0`），随 `3-rollout.md` H0b 走（码-17）。主干 `selfcheck.ts` 已是 1305 行（d7e20d7），自检报「11 个可执行文件都有出处」（#75 自述的 15 个是 #75 树上的数）；新夹具要走 `named` / `run` / `runBoth`，label 写成能被 `kills` 清册点名的样子，并对 P3.c 发 `criterion()` 入口认领（ADR-70 落地 3；码-44）。
6. **锚点与同步**（业-27、业-31）：ARCHITECTURE 锚点表两行（#75 分支已写，主干上没有；**目标已撤（ADR-78，主干 d7e20d7）**的是机器核 —— 表还在，`<!-- BEGIN:ANCHORS 人维护，无机器校验（ADR-78） -->` 行 53–99，忘了登记没有任何东西提醒）；SYNC 表「改预算/成本逻辑」那一行（d7e20d7 行 37，机器检查列「部分」）的同步对象加上「模型与 `IMPLEMENTATION-MAP.md`」。
7. **假设登记表**（业-23、码-45）：`docs/assumptions.json` + 审计读它。
8. **旧任务目录**（业-25、码-19、码-23；规则 `0-process.md 通-40`）：`task.json` 缺新字段（`budget_assumed`）时按 ADR-18 的方向读作「无从确认」而不是 `false`；`meta.json.versions` 缺失时报告声明「版本未知」。
9. **活性**（码-16）：`formal-rule.ts` 不检查 L1 / L2（没有时序逻辑）。要进链只能改写成可达性 / 无 stuck 状态检查（「存在付得起且仍有工作的可达状态，其后继里没有 `send`」是安全性形状）；否则只留 TLC 参考规约（`9-evidence.md §E.4` ③）。本文不把活性列进 H3 的验收。

## D.14 回滚条件（试点本身）

层：docs / code · 对应：业-60（触发时写的 ADR）· 码-48 / 码-11（30 秒 CI 上限）、码-10（350 行体量线）、码-21（3000 请求量级基准）· 规则：`0-process.md 通-37`（回滚条件预定义）、通-28 · `3-rollout.md` H3 的验收与 go / no-go 引用它

**正本在 `3-rollout.md`「P3 试点的回滚与成败判据」§D.14**，四条回滚线的原文只在那里；本节只留标题与上面的对应关系，让 `8-p3-pilot.md §D.14` 这类既有引用仍可跳。

## D.15 试点成功 / 失败判据（第 19 问）

层：docs / code · 对应（条目号指 `3-rollout.md §D.15` 那份）：业-19（第 6 条：一条 ADR 逐条裁决）、业-21 / 业-22（J43 / J44 的两条架构 ADR）、业-06（第 2、3 条依据的术语表与义务）· 码-13 / 码-17（第 1 条的两个回归）、码-10（状态数与最短反例长度钉住）、码-39 / 码-41（第 3 条认领与变异）、码-48（第 4 条 CI 数字）· 规则：`0-process.md 通-13`、通-14（第 5 条）、通-15（不变量只增不删）· `3-rollout.md` H3 的验收与「推广的 go / no-go」引用它

**正本在 `3-rollout.md`「P3 试点的回滚与成败判据」§D.15**，六条成功判据与四条失败判据的原文只在那里；本节只留标题与上面的对应关系，让 `8-p3-pilot.md §D.15` 这类既有引用仍可跳。
