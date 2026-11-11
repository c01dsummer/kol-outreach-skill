# KOL-21 C1 测试 · 接入说明（给整合方）

本目录的测试只按冻结规格单 `pack/30-frozen-spec.md`（SHA-256 `a36fb4706b1bb7a16114a18390286ca8e5f725e3dd11ca02a8b2241757658eda`；2026-11-10 按 ADR-193（KOL-106 方案乙）重冻退出码，重冻前 SHA-256 `cabd676f583337487f63f7e8bf4a1cbaad05f2f848f8824db29c4fe7a05e0405`）写成，**不 import 任何产品实现、观察器源码、writer/reader 或比较器**。真实调用面由整合方在测试之外接入。下面的接口形状是测试侧的形式选择，不是新的产品契约。

## 入口

```ts
import { runSuite } from './suite.ts'
const report = runSuite({
  workRoot: '/绝对路径/已存在的空目录',
  facility,        // { certifyIsolation, runObserved, zeroVerdict, readEvents }：ADR-70:3276-3324，Zero 取修订轮 1 版（带 side/cause）
  sortForOutput,   // G5：scripts/lib/rows.ts:170 的导出函数
  creatorCheck,    // 可选：公开的夹具资格检查（GAP-18 的一种补法）；返回问题数组
  conditions,      // 见下表；没登记 = 依赖它的断言不判
  reviews,         // 语义复核记录（见 lib/contract.ts ReviewRecord）
  e2, e3,          // E-2 / E-3 契约公开后的插槽（lib/contract.ts）
  reportPath: '/绝对路径/report.json',
})
```

运行方式：Node 22+ 的类型擦除或 tsx 均可；文件间 import 带 `.ts` 后缀、只用可擦除语法。

## 前提登记（conditions）

只有冻结单写死「补齐后照现有 expected 判」的那一种答案才放行；其他答案意味着 expected 要改，须退回 B2。

| 键 | 放行的 answer | 影响 |
|---|---|---|
| `GAP-07①` | `array-of-keyword-strings` | G3-18 的 pending_keywords 形状（keywords_done 的期望类型冻结单未写，仍不判） |
| `GAP-07④` | `present` | SUMMARY(error) 的 pending_keywords 在场子项；G2-00、G2-01、G3-06 的 PK-HAS；G3-18 error 跑 |
| `GAP-18` | （任意，已补齐） | G5-01…03、G6-01…03 |
| `GAP-24a` | `reads-memory`（`not-read` → G3-15 夹具失格） | G3-15 |
| `GAP-24b` | `reads-memory`（`not-read` → G3-14c 夹具失格） | G3-14c |
| `GAP-24c` | `unchanged` | G3-14c、G3-15 的 BYTES(memory/creators.json) |
| `GAP-39` | `no-secuid-retry` | G3-07 依赖重试与否的两项：Σ.profile_failed === 1、请求次数与序列（COST-OUT 与 HINT 待补 3 不受此项影响，未登记时照判；C1fix F-5） |
| `E-1` | `as-frozen`（与冻结单 E-1 表一致并经需求方逐字确认） | G2-23a、G2-23b |
| `E-2` | （任意，已公开）+ 提供 `e2` | G3-14a…f（不提供则这些跑不起） |
| `E-3` | （任意，已公开）+ 提供 `e3` | G4-06…08；G1-02D（仅 stderr 通道） |
| `GAP-09`、`GAP-10`、`GAP-40` | — | G3-17、G1-02D：冻结单没有可直接照判的 expected，登记了也不判 |

## 语义复核（reviews）

stderr 等文字断言是可执行的语义断言：机械预筛只帮定位，**预筛不过不判红**。评审人按报告里每条的语义要点复核，记录写：

- `key`：`用例号/标签`（报告里每条 review 已给出），PK-HAS 机械未命中时为 `PK@用例号/标签`，GAP-25 排查为 `GAP-25@跑号`；
- `textSha256`：报告给出的本跑文本哈希（防止旧复核替新输出作证）；
- `quotes`：所依据的那一行（几行）原文，必须逐字出现在文本里（正面要点必填）；
- `verdict`：`pass` / `red`；GAP-25 用 `parse-failure` / `no-parse-failure`；PK 用 `red` / `gap07`。

## 不在本轮范围

C2 冻结（`freeze-tests.sha256`）、仓库接线、判据认领（含 `tension('U9','P1')`）、变异、`launches.json` 都由整合方处理。
