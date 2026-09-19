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
