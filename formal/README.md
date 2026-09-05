# 形式化验证

> 这里只装**机械子系统**的模型与证明。
> 语义筛选准不准、开发信有没有回复 —— 那些不在这里，也不可能在这里。
>
> 规则在 `process/4-VERIFY.md`；这一份说的是本仓库当前有哪些形式化资产、
> 它们各自保证到哪为止，以及需求或实现改了之后怎么把它们跟上。

---

## 为什么第一个试点是预算协议

四条判据同时成立的子系统，目前只有它：

| 判据 | 预算协议为什么合 |
|---|---|
| **能精确定义** | 状态是三个整数：内存里记了几次、盘上记了几次、供应商真的收了几次钱。没有一处需要判断 |
| **违反后由用户承担且不可逆** | P3 是红线：花的是用户的钱，花掉了就是花掉了 |
| **状态空间可以抽象** | 每一块钱都从一个地方出去（`scripts/providers/tikhub.ts` 的那一行 `fetch`），计数只有两处会变 |
| **能与实现建立清晰对应** | `Budget` 与 `TikHub.get()` 都能直接 import 进来跑，不必复述业务逻辑 |

还有一条**只有它有**的理由：

> `Budget.charge()` 是纯函数，单元测试早就验过它超限会抛。
> **但钱不是在 `charge()` 里花掉的。**
>
> 过闸门、把请求发出去、把请求数写进 `task.json` 是三步，步与步之间可以崩溃、
> 可以续跑。那两个窗口**不在任何一个单元里**，所以任何单元测试都看不到它们
> （`docs/CONVENTIONS.md` 第 10 条说的就是这一类）。
> 这正是形式化方法比多写几个测试多买到的东西。

---

## 命令

| 命令 | 跑什么 | 要什么 | 在检查链里 |
|---|---|---|---|
| `npm run formal` | 穷举抽象模型 + 拿真实实现对照 + 两个钱字段的全域 | 只要 Node | **是** |
| `npm run formal -- --tla` | 再加：TLC 跑同一个模型，并逐字符比两边的可达状态集 | Java + `TLA_TOOLS_JAR` | 否 |
| `npm run formal -- --trace <不变量名>` | 把某条反例的整条轨迹打出来 | 只要 Node | 否 |

**`--tla` 为什么不进检查链**：它要 Java 与一个 2.2 MB 的外部 jar。
检查链的价值在于「谁跑都一样红」—— 一条会因为环境不同而消失的检查比没有检查更糟。
所以它是一条**具名的、要人记得跑**的命令：

> **谁、什么时候跑**：改动 `scripts/lib/budget.ts`、`scripts/providers/tikhub.ts` 的
> 请求路径、`scripts/collect.ts` 或 `scripts/enrich.ts` 的落盘节奏与退出码、
> 或者改 `formal/budget/BudgetProtocol.tla` 与 `scripts/check/formal-rule.ts`
> 任何一份的人，在开 PR 之前跑一次，把输出贴进 PR 描述。

拿不到 jar 时 `--tla` 以退出码 2 结束并说「无从判断」——
**不是跳过，也不是通过**（`process/4-VERIFY.md`：一个从来不会失败的检查等于没有检查）。

### 取 TLA+ 工具

```sh
curl -L -o /tmp/tla2tools.jar \
  https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar
# 936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
sha256sum /tmp/tla2tools.jar
TLA_TOOLS_JAR=/tmp/tla2tools.jar npm run formal -- --tla
```

版本与摘要都钉在这里。**jar 不进仓库** —— 二进制既读不了也审不了，
而这条命令本来就不在检查链上。本轮验证用的是 TLC 2.19（2024-08-08）。

`.cfg` 也不进仓库：常量存两份就会漂，而漂了之后 TLC 跑的是**另一个模型**，
两边的状态数看上去还挺像。它们由 `scripts/check/formal-rule.ts` 的场景表生成，
跑的时候落在临时目录里。要手跑一次，照下面这份抄（对应 `spec` 场景）：

```
CONSTANTS
  Limit = 2
  MaxSent = 4
  MaxResumes = 2
  PersistEvery = 1
  BillNon200 = FALSE
  MayCrash = TRUE
  BrokenCharge = FALSE
INIT Init
NEXT Next
INVARIANT NoOverspend
```

---

## 保证等级 —— 不许混写成一句「已验证」

| 等级 | 意思 |
|---|---|
| `PROVED_IMPLEMENTATION` | 实际实现经机器证明 |
| `MODEL_CHECKED` | 一个**有界**模型的全部可达状态都被检查过 |
| `MODEL_ONLY` | 只检查了抽象模型，没有自动连回实现 |
| `PROPERTY_TESTED` | 用生成的输入把模型与实现对照过 |
| `UNIT_TESTED` | 只有固定样例 |
| `ASSUMED` | 靠环境或人的假设 |
| `EMPIRICAL` | 只能由真实数据评估 |

**本仓库目前一条 `PROVED_IMPLEMENTATION` 都没有。** 逐条的等级在
`formal/budget/IMPLEMENTATION-MAP.md`，不在这一页复述。

三句话不许说：

- ❌「系统已经被形式化证明正确」
- ❌ 把有限状态的模型检查说成无限状态的证明
- ❌ 把「模型里没找到反例」说成「实现里没有这个 bug」

---

## 目录

```
formal/
├── README.md                      本页：为什么、跑什么、保证到哪
└── budget/
    ├── BudgetProtocol.tla         协议模型（TLA+，给 TLC 跑）
    └── IMPLEMENTATION-MAP.md      模型 ↔ TypeScript 的逐条对应、结论与等级
```

TypeScript 那一份模型与判定在 `scripts/check/formal-rule.ts`，入口在
`scripts/check/formal.ts` —— 它们在 `scripts/` 下，所以受架构锚点表管
（`docs/ARCHITECTURE.md`）。

**两份模型是同一个转移系统的两种写法。** 存两份是因为买到的东西不一样：

- TLA+ 那份由 TLC 检查 —— 一个别人写的、被用了二十年的模型检查器，
  排除掉「检查器自己写错了」这一类
- TypeScript 那份**能调真实的 `Budget` 与 `TikHub.get()`**

两份会漂移，所以不靠人记得同步：`npm run formal -- --tla` 把两边的**可达状态集
逐个字符**比一遍，不一致当场红。比的是集合不是个数 —— 个数一样而集合不同的两个
模型是存在的，那正是漂移最难看出来的形状。

---

## 下一个试点

按「精确定义 × 用户承担且不可逆 × 可抽象 × 对得上实现」四条判据，
排在后面的是**记忆与交付物一致性**（`docs/SPEC.md` 的 P4、P5、D4）：
状态是文件在原子替换过程中的中间形态，动作是三步落盘协议
（`scripts/lib/task.ts` 的 `persistListAndStatus`），而 D4.i、D4.j 已经把
不变量写成了几乎可以直接照抄的句子。

**不建议**拿去做形式化验证的：语义筛选、关键词策略、开发信草稿、风险信号口径。
理由见 `docs/SPEC.md` 的「尚未确定的」一节 —— 那些的判据是真实发信的结果，
不是任何证明说了算。

---

## 需求或实现改了，怎么把模型跟上

按改的是什么，走对应那一条：

| 改了什么 | 要做什么 |
|---|---|
| `scripts/lib/budget.ts` 的计数、退还、阈值 | 跑 `npm run formal`。对照那一段会直接红 —— 它跑的就是真的 `Budget` |
| `scripts/providers/tikhub.ts` 的请求路径（过闸门与发请求的先后、重试次数、退还的条件） | 同上；顺序变了会在「提交那一刻本地记了几次账」那一栏红 |
| `collect` / `enrich` 的落盘节奏或退出码 | 那一段是**模型化的、不是执行的**：改 `scripts/check/formal-rule.ts` 的场景表，并在 `IMPLEMENTATION-MAP.md` 的人工核对表里改对应行 |
| 加一条不变量 | 两份模型都要加（TypeScript 的 `INVARIANTS`、TLA+ 的定义），并在场景表里给出每个场景的预期。**指不回 `docs/requirements.json` 的性质不许加** —— 测试里有一条断言在查这件事 |
| 改有界参数 | 只改场景表；预期的反例长度会跟着变，照 `IMPLEMENTATION-MAP.md` 的推导重算，**不要跑一遍粘回来**（`process/4-VERIFY.md`：expected 不许来自运行结果）|
| 改了 `docs/requirements.json` 的 P3 / F7 / D6 | 回头看 `IMPLEMENTATION-MAP.md` 的第一张表：每条不变量认领的编号还在不在、说的还是不是同一件事 |

**模型自己也会写错。** 所以 `scripts/check/formal-rule.ts` 是判定模块，
在审计的名单上，必须有变异守着（`M-H16-a`／`M-H16-b`／`M-H16-c`）——
一个「怎么改都不会红」的模型检查器，和没有检查的区别只有心理作用。
