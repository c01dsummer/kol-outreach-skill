# 文档同步表

> **每次改完任一份文档，回头检查其余几份要不要跟着改。要改就当场改完。**
>
> 漂移是这样发生的：改动 A 时同步了 B，改动 C 时只改了代码，D 落下了。
> 半年后 D 说的是一个已经被推翻的结论，而没人知道。
>
> 这张表里**能机器检查的部分已经在 `npm run check` 里**（标 🔒）。
> 剩下的靠执行 —— 纯靠人执行的同步规则，执行率会随时间趋近于零。

---

## 触发表

| 改了什么 | 至少要看 | 机器检查 |
|---|---|---|
| **新增/删除/修改需求** | `docs/requirements.json` → `docs/SPEC.md` → 下游引用 → 测试 → 变异 | 🔒 `spec` `audit` |
| **新增红线** | 需求登记表 · **测试** · **变异集** · `docs/CONVENTIONS.md` | 🔒 `audit` 强制红线有测试+变异 |
| **改评分/分层规则** | `scripts/lib/score.ts` · `skill/references/semantic-fit.md` · 测试 | 部分 |
| **改数据源端点/字段** | `skill/references/providers/tikhub.md` · `scripts/providers/tikhub.ts` · `scripts/check/fake-fetch.ts` | 🔒 `selfcheck` |
| **改 CSV 列或报告结构** | `scripts/lib/rows.ts` · `skill/references/output-format.md` · 测试 | 部分 |
| **新增可执行文件** | `scripts/check/selfcheck.ts` 必须执行它，否则登记豁免 | 🔒 `audit` |
| **改流程阶段** | `skill/SKILL.md` · `docs/business-requirements.md` · 对应 reference | ✗ 靠执行 |
| **查到新事实 / 旧结论被推翻** | `docs/data-source-strategy.md` **必须改** · `DECISIONS.md`（多属事实证伪） | ✗ 靠执行 |
| **改预算/成本逻辑** | `scripts/lib/budget.ts` · `skill/SKILL.md` 成本闸门一节 · `docs/CONVENTIONS.md` 第 7 条 | 部分 |

---

## 文档地图

哪份文档管什么，避免写错地方：

| 文件 | 管什么 | 不该出现什么 |
|---|---|---|
| `docs/requirements.json` | 编号的**唯一真相来源** | 解释、理由、实现方式 |
| `docs/SPEC.md` | 需求的人类可读渲染 + 红线为什么是那几条 | 手改的表格（由 json 生成） |
| `docs/CONVENTIONS.md` | 在本项目里**反着**的通用做法 | 换个产品也成立的规则（那属于 `process/`） |
| `docs/SYNC.md` | 本表 | 具体规则 |
| `docs/business-requirements.md` | 背景、痛点排序、成功指标、论证过程 | 编号定义（那在 json） |
| `docs/data-source-strategy.md` | 各家 API 调研与选型结论 | 需求 |
| `DECISIONS.md` | ADR，追加不删改 | 计划、待办 |
| `AGENTS.md` / `CLAUDE.md` | **只做路由**，指向上面这些 | 任何具体规则 |
| `skill/SKILL.md` | 给 Agent 的执行指令 | 需求论证 |
| `skill/references/*` | 每个阶段的操作细节 | 与 `process/` 重复的通用纪律 |

---

## 一条判别规则

> **在 `docs/` 里写下的每一条规则，如果换个产品也成立，那它写错地方了 —— 移到 `process/` 去。**

反过来，`process/` 里出现「KOL」「TikHub」「开发信」这类字眼，也是写错了地方。
`process/` 是跨项目复用的，改动要慎重。
