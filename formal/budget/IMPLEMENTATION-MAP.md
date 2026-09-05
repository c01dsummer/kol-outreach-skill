# 预算与请求提交协议 · 模型与实现的对应

> 这一页回答一个问题：**凭什么说这个模型不是 `formal/` 目录里一个与产品无关的玩具。**
>
> 词表（`MODEL_CHECKED` 等）在 `formal/README.md`。
> 命令：`npm run formal`、`npm run formal -- --tla`、`npm run formal -- --trace <名字>`。

---

## 一、状态变量

| 模型变量 | TypeScript 实现 | 需求 | 连接方式 |
|---|---|---|---|
| `local` | `scripts/lib/budget.ts` 的 `Budget.requests`（`count` 读它） | P3 · D6.a | **执行**：对照那一段跑的是真的 `Budget`，每步比 `count` |
| `disk` | `task.json` 的 `requests`；写在 `scripts/collect.ts` 的 `persist()`、`scripts/enrich.ts` 的 `persist()` | D6.a | **人工核**（下面第五节）—— 入口脚本 import 不进来 |
| `billed` | **代码里没有任何变量装着它。** 供应商侧真正收费的次数 | P3 | **执行**：对照时由换掉的 `fetch` 数，那是请求真正出去的那一刻 |
| `sent` | 同上，含非 200 | P3 | 同上 |
| `phase` | `scripts/providers/tikhub.ts` 的 `get()` 在过闸门、发请求、拿到响应之间的三个位置 | P3 | **执行**：`charged` 与 `sent` 之间的那一刻由 `fetch` 观测到 |
| `sinceSave` | 没有对应变量 —— 它是「距上次落盘计了几次费」，由 `persist()` 的调用位置决定 | D6.a | **人工核** |
| `warnedHere` | `Budget.notified` 这个集合的大小 | F7.a | **执行**：对照时数回调次数 |
| `warnTotal` | 没有对应变量 —— 跨进程的总数，`task.json` 里不存 | F7.a | **模型** |
| `alive` | 进程还在不在 | — | **模型**（环境动作）|
| `exit` / `stopped` | `collect.ts` 捕获后 `persist()` 再退 3 那一段 | P3.b | **人工核** |
| `resumes` | `--resume` 跑了几次 | D6.a | **模型**（有界参数）|

## 二、操作

| 模型动作 | TypeScript 位置 | 需求 | 连接方式 |
|---|---|---|---|
| `charge` | `scripts/lib/budget.ts` 的 `charge()`，由 `scripts/providers/tikhub.ts` 的 `get()` 在发请求**之前**调 | P3.a · F7.a | **执行** |
| `send` | `get()` 里那一行 `fetch` | P3 | **执行**（换的是响应，不是调用位置）|
| `ok` / `nonOk` | `get()` 对 `res.ok` 的分支；非 200 走 `refund()` | P3 | **执行** |
| `persist` | `collect.ts` 的 `persist()`、`enrich.ts` 的 `persist()` | D6.a | **人工核** |
| `crash` | 进程被杀、主机断电 | — | **模型**（环境动作，`docs/SPEC.md` 的 D4 与 ADR-50 已经把它当成真实环境）|
| `resume` | `collect.ts --resume` 用盘上的 `requests` 新建一个 `Budget` | D6.a | **人工核** + 对照那一段用 `start` 参数覆盖了「从一个非零计数开始」|
| `stop` | `collect.ts` 捕获 `BudgetExceeded` → `persist()` → 退出码 3 | P3.b | **人工核**（已由脚本自检端到端守着，见 `mutations.json` 的 `exemptions`）|

## 三、不变量、结论与等级

跑一次 `npm run formal` 就能复现下面每一行。

| 不变量 | 需求判据 | 结论 | 等级 | 状态空间 / 假设 |
|---|---|---|---|---|
| `RejectedNotCounted` | P3.a | **成立** | `MODEL_CHECKED` + `PROPERTY_TESTED` | 五个场景 56–2236 个可达状态全部检查；对照那 588 个序列上真实 `Budget` 也一致 |
| `Exit3Recoverable` | P3.b | **成立** | `MODEL_CHECKED` | 只对模型。入口那一段的接线由脚本自检守着，不由这里守 |
| `ResumeKeepsCount` | D6.a | **成立** | `MODEL_CHECKED` | 同上 |
| `NoOverspend` | P3 · P3.a | **不崩溃时成立；崩溃 + 续跑时被违反** | `MODEL_CHECKED` | `no-crash` 场景 56 个状态全过；`spec` 场景 12 步反例 |
| `SpendIsRecorded` | P3 · D6.a | **被违反** | `MODEL_CHECKED` | 5 步反例。**这是结论不是疏漏**，见第四节 |
| `WarnOncePerTask` | F7.a | **被违反** | `MODEL_CHECKED` | 8 步反例（`spec`）／14 步（`entry-cadence`）|
| 过闸门在发请求之前 | P3 | **成立** | `PROPERTY_TESTED` | 真实 `TikHub.get()`，`{200,429,402,500}` 上长度 ≤3 的全部序列 × 4 个上限 × 2 个起始计数 = 588 个用例、555 次真实提交 |
| 上限的每个取值要么被挡下要么拦得住 | P3 | **成立** | `MODEL_CHECKED`（真实 `Budget`）| 14 个取值的**全域**，穷举不是抽样 |
| 已花次数的每个取值要么被挡下要么接得上账 | D6.a | **成立** | `MODEL_CHECKED`（真实 `Budget`）| 8 个取值的全域 |
| 非 200 供应商不计费 | — | **没有验证** | `ASSUMED` | 见第四节第 4 条 |

**没有一条是 `PROVED_IMPLEMENTATION`。** 抽象模型那几条只对模型成立；
`PROPERTY_TESTED` 那几条跑的是真实实现，但输入是有界的。

### 两份模型是同一个转移系统

`npm run formal -- --tla` 把 TypeScript 那份与 `BudgetProtocol.tla` 的**可达状态集
逐个字符**比一遍。本轮五个场景全部相等：

| 场景 | 可达状态 | TLC 说 |
|---|---|---|
| `spec` | 1586 | 一样是 1586，集合相等 |
| `entry-cadence` | 2236 | 相等 |
| `no-crash` | 56 | 相等 |
| `bill-non-200` | 113 | 相等 |
| `broken-charge` | 81 | 相等 |

每条不变量的裁定也逐条对过：TLC 说成立的这边也说成立，TLC 抓到的这边也抓到。

---

## 四、找到的反例

### 1. 钱花出去了，盘上没有记录（5 步）

```
npm run formal -- --trace SpendIsRecorded
```

`init → charge → send → ok → crash`。一次请求过了闸门、发出去、供应商收了钱，
落盘之前进程死掉 —— `task.json` 里的 `requests` 不含这一次。

**属于哪一类：需求没有决定该行为。** P3 的两条判据只说了 `charge()` 和退出码；
D6.a 说「spent 连续不归零」，没说崩溃。而**任何**把落盘和发请求分成两步的实现
都有这个窗口 —— 它不是一处写错，是这个架构的性质。

**代价随落盘节奏放大。** `collect.ts` 的关键词循环每抓一页落一次盘，窗口是 1 次请求；
补 profile 那个循环**一次都不落盘**，窗口是整份候选名单。`enrich.ts` 每个账号落一次。
`entry-cadence` 场景就是拿来量这个差的。

### 2. 崩溃 + 续跑之后，供应商收的钱超过已确认的上限（12 步）

```
npm run formal -- --trace NoOverspend
```

上限折算成 2 次请求：正常花满两次（各 3 步），崩溃，续跑时 `Budget` 用盘上那个
偏小的计数初始化，于是又买得起一次 —— 供应商一共收了 3 次。

**属于哪一类：需求没有决定该行为**，与上一条同源。这是上一条的**代价**：
少记的那一段，下一轮会被当成没花过。

### 3. 续跑之后阈值提醒重来一次（8 步）

`Budget` 的提醒集合是**进程内**的，续跑新建一个实例就空了。跑到 85% 之后续跑，
第一次请求会同时打出「已用 50%」和「已用 80%」。

**属于哪一类：需求没有决定该行为。** F7 说「预算达 50% 与 80% 时提醒」，
F7.a 说「各触发一次，且不重复触发」——「一次」是每个进程一次还是每个任务一次，
登记表没说。若按任务算，则 F7.a 与 D6.a（花销跨运行连续）就在这一点上撞了，
而 `docs/requirements.json` 里没有这条交点。

### 4. 「非 200 不计费」这条假设是承重的（10 步）

`bill-non-200` 场景把它取反，`NoOverspend` 立刻被违反：一次成功、一次非 200
（本地退了、供应商没退）、再一次成功 —— 上限 2 而供应商收了 3 次。

这条假设目前只活在 `scripts/providers/tikhub.ts` 那行注释里：**没有需求、没有决策记录、
没有测试**。429 重试路径把它放大：一次调用最多向供应商提交 4 次，本地最多记 1 次；
IG profile 的两级端点再乘一次，最多 8 次提交、1 次计数。

### 5. 负例模型（10 步）

`broken-charge` 场景把预检写成「先记账再判断」。TypeScript 那边与 TLC 都抓到
`NoOverspend`，反例都是 10 步。**它是这套资产的自检**：抓不到它，说明检查器坏了。

### 6. 上限与已花次数是外部输入 —— 已修

第三节那两条「全域」检查在写之前是红的（各 9 个、5 个洞），现在是绿的。
它们守的两处：

- `--budget 3.0.0` 这样的手误让 `Number()` 给出 `NaN`，闸门那句比较恒为假 ——
  闸门整条失效，且百分比恒为 0，连提醒都不出现（P3 · F7）
- `task.json` 的 `requests` 是 `null` 时整本账退回零；是字符串时，下一次请求让计数
  变成拼接（`"4"` → `"41"`），一次请求把账面翻十倍（D6.a）

判定在 `scripts/lib/budget.ts`，三条入口共用；负片是 `M-P3-c` 与 `M-D6-i`。

---

## 五、模型里没有的那一半 —— 人工核对表

下面每一行都是**模型化的、不是执行的**。改了实现这边，模型不会自己红。
改动碰到左栏任何一处时，逐行读一遍右栏。

| 实现位置 | 模型里对应什么 | 现在核对的结论 |
|---|---|---|
| `collect.ts` 关键词循环末尾的 `persist()` | `persistEvery = 1` | ✅ 每抓一页落一次盘 |
| `collect.ts` 补 profile 的循环 | `persistEvery` 等于名单长度 | ⚠️ 循环里**一次都不落盘**，与 `entry-cadence` 场景对应 |
| `enrich.ts` 每个账号之后的 `persist()` | `persistEvery = 1` | ✅ |
| `collect.ts` 捕获 `BudgetExceeded` → `persist()` → 退出码 3 | `stop` 动作 | ✅ 顺序一致 |
| `collect.ts` 记忆读不出来那条中止路径 | 模型里没有 | ⚠️ 那条路径下预算即使用尽也是退出码 2，见下面「未证明」第 2 条 |
| `providers/tikhub.ts` 的重试上限 | 对照里的 `maxRetry = 3` | ✅ 588 个用例里提交次数与模型一致 |
| `providers/tikhub.ts` 的 IG profile 两级端点 | 模型里没有 | ⚠️ V3 失败会再走一遍 V2，各自还能重试 —— 最多 8 次提交、1 次计数 |
| `probe.ts` 的 `Budget` | 模型里没有 | ⚠️ probe 的花销不写盘，任何 `task.json` 都不含它 |
| `collect.ts` / `enrich.ts` 各自把计数**整体赋值**回 `task.json` | 模型里只有一个写入方 | ⚠️ 两个进程同时对着一个任务目录跑时，后写的会盖掉先写的花销 |

---

## 六、明确没有被证明的

1. **崩溃安全。** 反例第 1、2 条说的就是它。要把它变成保证，得改协议
   （先写「打算发一次请求」再发，或者按供应商侧的账对账），那是一次需求变更，
   走 `process/2-CHANGE.md`，不在本次范围内。
2. **预算用尽 + 记忆读不出来时的退出码。** 那条路径退 2 不退 3；P3.b 的措辞是无条件的，
   而 `docs/requirements.json` 里没有 P3 × D4 这条交点。**没有在这里替它裁决。**
3. **供应商真的按 200 计费。** `ASSUMED`。要变成结论，只能拿账单核。
4. **一次逻辑请求最多向供应商提交几次。** 没有任何需求约束它。重试、IG 搜索的两级
   回退、IG profile 的两级端点各自都会多提交。
5. **并发。** 模型里只有一个写入方。两个进程对着同一个任务目录跑时的交错**没有建模**
   —— `docs/SPEC.md` 的 D4 已经就记忆文件撤回过并发承诺（ADR-66），`requests` 这个
   字段不在那条撤回里，也不在任何保证里。
6. **浮点。** 单价 0.001 在二进制里不精确，某些上限会比理论值少买一次请求。
   方向对 P3 是安全的（少花不多花），所以没有把它写成不变量。
7. **模型本身可能写错。** 两份模型互相对账、负例模型必须被抓到、三条变异守着判定 ——
   这三样都只降低概率，不排除它。
