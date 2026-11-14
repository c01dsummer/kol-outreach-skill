# ADR-95 闸门比较的两边都是外部输入：没人查过它们是不是数

- 日期 · 2026-09-05 · 预算协议验证试点的静态盘点（试点本身另记一条决策记录，另一条 PR）
- 类型：**事实证伪**（两处实现违反已有的红线）
- 触发它的事实：预算闸门是一句「已花 + 本次开销 > 上限」的比较，两边都从命令行或
  `task.json` 进来。`--budget 3.0.0` 让上限成 `NaN`，比较恒为假；`task.json` 的 `requests`
  是 `null` 时账退回零、是字符串时下一次请求让计数变成拼接
- 冲击的需求：P3 · P3.a · F7 · D6.a
- 结论：**采纳** —— 判定写进 `scripts/lib/budget.ts`，三条入口在花钱之前各查一次；
  比不了大小就以退出码 2 停下，一次请求都不发

## 两处，同一个形状

1. **上限。** `--budget 3.0.0` 经 `Number()` 是 `NaN`；`budget_usd` 从 `task.json` 反序列化
   进来时静态类型一个字段都不拦。闸门那句比较恒为假 —— 不是宽了一点，是整条不存在；
   百分比同时恒为 0，50%／80% 的提醒也不出现（P3 · F7）。
2. **已花次数。** `requests: null` → `new Budget(limit, null)` 的账面是 0，续跑等于白送一份
   预算；`requests: "4"` → 下一次 `charge()` 把计数变成 `"41"`，一次请求把账面翻十倍（D6.a）。

`enrich.ts` 早就查过 `--budget` 的有限性，`collect.ts` 与 `probe.ts` 一直没查 ——
**同一个判定有两份副本时，没查的那一份不会报错**（ADR-46 的形状，第三次）。
所以判定只写一份，三条入口共用。

## 为什么退出码是 2 不是 3

3 的意思是「预算用尽，可续跑」（P3.b）。这里不是用尽，是**没法算** —— 续跑也算不了。
2 是「停下问人」那一档：stderr 指名是哪个值、从哪来（命令行还是盘上哪个文件），
报的是**用户打的那个东西**而不是解析结果 —— `3.0.0` 照解析结果印出来是 `null`，
用户会以为自己打错成了一个 null。

## 怎么证明的

- 单元：`scripts/test.ts` 的「上限与已花次数是外部输入」—— 断言落在**后果**上
  （闸门一次没拦、百分比恒零、账面退回零），不落在「有没有这个函数」上；认领 P3.a
- 端到端：`scripts/check/selfcheck.ts` 起三条入口各喂一份坏文件，退出码 2；
  `--budget 3.0.0` 的报错里必须出现 `3.0.0`
- 负片：`M-P3-d`（`budgetProblem` 恒放行）、`M-D6-l`（`ledgerProblem` 恒放行）

> ⚠️ 欠条：**自检里那几条端到端夹具还没有负片。** 它们用 `run(...)` 起进程、看退出码，
> 而 `run` 一族不在自检的清册里，任何变异的 `kills` 都点不着它们 —— 跑是真跑了，
> 但没有第三拍。主干已经把这条路修通（ADR-70：`named()` 起名、`by: "selfcheck"` 加
> `kills`），接上去是扩范围，不夹进本条。
> · 重启条件：下次有人改 `collect.ts` / `enrich.ts` / `probe.ts` 里 `budgetProblem` 或
> `ledgerProblem` 那几处接线时，把这几条夹具改成 `named()` 并配一条 `by: "selfcheck"` 的负片。

## 连带改动

`scripts/lib/budget.ts`（`budgetProblem` · `ledgerProblem` · `showAmount`）· `scripts/collect.ts` ·
`scripts/enrich.ts` · `scripts/probe.ts` · `scripts/test.ts` · `scripts/check/selfcheck.ts` ·
`scripts/check/mutations.json` · `skill/SKILL.md`（成本闸门一节：退出码 2 的那一句）

## 教训

判据落在「`charge()` 超限会抛」上是对的，但闸门是一句比较，**比较的两边是谁没人问过**。
反序列化进来的就是外部输入（`process/4-VERIFY.md` 那张表里有这一行）——
「文件是我们自己写的」不构成理由。

## 还第 43 行：`budget-gate` 六条夹具写成具名断言，各有负片（KOL-21，2026-10-30）

> ⚠️ 已还：ADR-95 第 43 行 · 还在 KOL-21 的 PR #411（代码一步是提交 `14cda65`）：自检 `budget-gate` 组里的六条端到端夹具都写成具名断言，每条都有一条指名自检验的负片指着（`M-D13-w`～`M-D13-aa`），三条入口各先跑一次请求观察器阳性对照

**从哪棵树起。** 交接包里这一片的补丁基于 `902e63e`，不整份套用：`budget-gate` 一组先按 KOL-20 的候选头 `7f1c160` 上的现状重写、变异按当时的目录重新编号，做成提交 `2fb63c8`，推到了远端分支、没开 PR；KOL-20 由 #406、#408、#409、#410 合入之后，改基到主干 `ab48003`（#410 合入后），`cherry-pick` 没有冲突，代码一步是提交 `14cda65`。`7f1c160` 与 `ab48003` 之间，这一片改的四个文件只差 `selfcheck.ts` 里 `audit-entry` 一组与 `mutations.json` 里 `M-H68-b` 一条的 `find`／`replace`，`collect.ts`、`probe.ts`、`enrich.ts`、`lib/pipeline.ts` 一字未变（`git diff --stat 7f1c160 ab48003 -- scripts/check/selfcheck.ts scripts/check/mutations.json scripts/collect.ts scripts/probe.ts scripts/enrich.ts scripts/lib/pipeline.ts`），所以改基前后 `budget-gate` 这一组与它起的几个入口字节相同。本节的行号与提交，不另注的都按 `ab48003`（改前）与 `14cda65`（改后）。另两张同一片还的欠条记在 ADR-70 与 ADR-92 末尾；欠条台账清点只记在 ADR-70 那一节。

**条件响过一次，只还了一半。** 条件是「下次有人改 `collect.ts`／`enrich.ts`／`probe.ts` 里 `budgetProblem` 或 `ledgerProblem` 那几处接线时」。本条写下它之后（#131，`2e5d22a`，2026-09-19），#155（`4b79629`，2026-09-23）把这两个函数连同 `lib/budget.ts` 里那套判定整个换掉，条件在那时响过；今天 `scripts/` 里已经搜不到这两个名字。#155 顺手把「已花次数写成 null」那条夹具改成了具名断言，但是同一个名字在循环里给 collect、enrich 各断一次，也没配负片；上限那三条与 `--budget` 那条仍用 `run(...)` 只看退出码。#155 之后到 `ab48003`，没有首父提交再动过这一组。查法：`git log --first-parent --format='%h %s' -S budgetProblem 2e5d22a..ab48003 -- scripts/collect.ts scripts/enrich.ts scripts/probe.ts`（`-S ledgerProblem` 结果相同）；`git log --first-parent -s -L "/^group('budget-gate'/,/^})/:scripts/check/selfcheck.ts" 4b79629..ab48003` 为空。

**欠条点名的两个函数不在了，接线还在，照今天的接线还。** 今天上限由 `lib/cost-json.ts` 的 `readCostLimit` 读，`--budget` 由 `lib/cost-ledger.ts` 的 `parseUsdMicros` 解；盘上的账在第一次要付费时由 `lib/budget.ts` 的 `Budget` 开账核，读不成就抛 `BudgetInputError`。留在入口里的接线有三种（按 `14cda65` 的行号）：配置里写没写上限由入口自己判（`collect.ts` 第 106 行、`probe.ts` 第 65 行）；`collect --budget` 读不懂时由入口抛错（`collect.ts` 第 69 行）；坏账抛出的 `BudgetInputError` 由入口译成退出码 2（`collect.ts` 第 451 行、`enrich.ts` 第 257 行）。

**六条具名断言，五条负片。** 每条都要三样同时成立：退出码 2；stderr 点出是哪个值（上限那三条要出现 `budget_usd`，坏次数那两条要出现 `requests` 或「次数」，`--budget` 那条要出现用户打的原文 `3.0.0`）；假 fetch 一个请求都没收到。坏次数原先是一个名字在循环里断两次，红了分不出是哪条入口；现在拆成 `collect 坏次数…`、`enrich 坏次数…` 两个字面名字，各用一份自己的坏账目录，互不影响。

五条负片逐条在本克隆里照 `mutate` 的施法施上（替换第一处、`prebuildOne`、按路由只跑 `budget-gate`、`MUTATING=1`），跑完整组、不提前停，拿 `judgeRun` 判，另把整份输出里每一行「✗」都列出来，核点名之外没有别的红、没有进程或夹具记号，再写回原字节并核 SHA256；预编缓存在时（裸 node 起，ADR-158）与 `KOL_PREBUILT=0`（tsx 起）两种起法各施一轮，结果相同，五条都判 `caught`：

| 变异 | 需求 | 改了什么 | 只红这几条（施变后实测） |
|---|---|---|---|
| `M-D13-w` | D13.a | `collect` 把写了却不是数的上限当成没写 | 「collect 上限不是数字」：退出码 0，套上默认的 $2，发出 4 次请求 |
| `M-D13-x` | D13.a | `probe` 同样，套上默认的 $0.5 | 「probe 上限不是数字」「probe 上限是 null」：都是退出码 0，各发出 1 次请求 |
| `M-D13-y` | D13.b | `collect --budget` 读不懂就当没给 | 「collect 设置的总预算不是数字…」：退出码 0，按原额度续跑，发出 4 次请求 |
| `M-D13-z` | D13.s | `collect` 把坏账当成运行中的内部错误 | 「collect 坏次数…」：退出码 1，请求照样 0 次 |
| `M-D13-aa` | D13.s | `enrich` 同上 | 「enrich 坏次数…」：退出码 1，请求照样 0 次 |

**零请求先证明观察器记得到。** 假 fetch 在每次响应前往 `FAKE_FETCH_LEDGER` 追加一行；落点没接上、或者这条入口根本没装上它，读回来同样是 0 行。`[fake-fetch] 已接管` 那句提示分不出是谁打的（经 tsx 起时壳和真进程各打一遍），不能拿来作证。所以三条入口各先跑一次阳性对照：起进程与观察的接线和断言相同（`runBoth` 起、`costEnv` 交落点、读回同一个落点），输入换成合法的。`probe` 只把上限换成 0.5；`enrich` 只把次数换成 0；`collect` 用合法账目续跑、`--budget 3` —— 与坏次数、`--budget 3.0.0` 两条同走续跑，「上限不是数字」那条走新建，那一条与对照差的不只是那个值（头一版的注释写成「同一个起法、只把被测的值换成合法的」，改基前那一轮三路台账清点里有一路指出对这一条不准，`2fb63c8` 之前已改）。collect、enrich 两份对照共用一个当前目录 `tmp/budget-gate-observer`，任务数据各在它底下一个子目录（`collect-ok`、`enrich-ok`），账本也是它底下各自的一份文件；probe 那份与另两条 probe 夹具一样以自检自己的当前目录（`process.cwd()`）起，配置与账本各是 `tmp` 下自己的一份文件（`probe.ts` 不写盘）；三份都不碰 `tmp` 下共用的记忆与产出。要求账本里真记下了请求（正常树上两种起法共六次，每次都是 probe 1 次、collect 4 次、enrich 1 次，对照那一行下面打的「观察器记下 N 次请求」）；对照没成立按夹具失格报（带夹具记号），那条入口的几条具名断言都不判 —— 零请求是每条的一拍，这一拍没有依据就整条不判。五条负片施上去时三份对照照样绿；其中三条让入口真发了请求（上表），同一个落点把它们记下来了。反过来也在本克隆里手工试过一次：把对照起进程时交的落点换成另一个文件（读的仍是原落点），三份对照都按夹具失格红（「…（夹具）：合法输入照常跑完，账本里却一次请求也没记下」），六条具名断言一条都没判，汇总「3 项失败」—— 观察器没接上时，零请求不会被当成证据算绿。这个试法改的是 `selfcheck.ts` 自己，只是手验，不是负片；施后写回原字节，`git status` 前后相同。

**代价。** 单跑这一组（`--only=budget-gate`，含入口每次都打的那条 `mutate --brief`），整棵进程树的用户＋系统 CPU 在本机各三次：预编缓存在时 2.39–2.46 秒，`KOL_PREBUILT=0` 时 3.41–3.53 秒；同一法量改前 `ab48003` 上的这一组（只把 `selfcheck.ts` 与 `mutations.json` 临时换回 `ab48003` 的版本，量完换回），两种起法是 2.18–2.54 秒与 2.10–2.16 秒。改后这一组多起三次入口（三份阳性对照：改前起 6 次、改后 9 次，数的是输出里起进程的那几行）。五条负片就是把这一组多跑五遍，施变那五次：预编缓存在时 2.20–2.46 秒，`KOL_PREBUILT=0` 时 3.45–3.94 秒。

**哪几拍有自己的负片。** 上限那三条与 `--budget` 那条，负片让入口照常开跑：退出码、点名、零请求三拍一起红。坏次数那两条的负片只把退出码 2 改成 1，请求照样 0 次 —— 「付费前拒绝」那一拍在入口这一层没有单独的负片，库那一层由 `M-D6-l`（`by: test`，施在 `lib/cost-ledger.ts`）守；「stderr 点名」那一拍各条都没有单独弄坏它的负片（比如把 `3.0.0` 印成解析结果）。欠条要的是「改成具名断言并配负片」，这几拍是合进同一条断言里的附加条件，负片没逐拍拆。`collect.ts` 第 451 行另有一条现役 `M-D13-s`（`by: selfcheck`，同一锚点）反方向改：把运行中的内部费用错误当成输入问题、1 变 2；`M-D13-z` 是它的另一半。

**退出码 0、1、3 交给具名断言判。** 原来的 `run(..., { status: 2 })` 遇到别的退出码就记成进程失败；那样施变后入口照常跑完（退出码 0），判定见的是「跑不起来」，算不到负片头上。现在起进程时把 0、1、3 列为软退出码；起不来、被信号打死的照旧带进程记号。

**和已有负片的关系。** `cost-input` 组的 `M-D13-a`（施在 `lib/cost-json.ts`）、`M-D13-b`（施在 `collect.ts` 读金额那一处，与 `M-D13-y` 的锚点不重叠）守的是读数那一层：前者让根预算先过一遍浮点，后者让命令行金额先转成浮点数。这次五条守的是入口那一层：读出来的问题有没有变成「停下问人」。两层各坏各的，互不顶替。

**代码里的副本同改。** `selfcheck.ts` 里 `budget-gate` 组头上的注释，原写判定在 `lib/budget.ts`、这几条「还没配负片」，改成判定在 `lib/cost-json.ts` 与 `lib/cost-ledger.ts`、六条各有负片，并写明阳性对照的用意。
