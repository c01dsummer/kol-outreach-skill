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
| **改评分/分层规则** | `scripts/lib/score.ts` · `scripts/lib/pipeline.ts` · `skill/references/semantic-fit.md` · 测试 | 部分 |
| **改管线步骤或其顺序** | `scripts/lib/pipeline.ts` · 测试 · **变异集**（顺序有语义，必须有变异守着）· `docs/ARCHITECTURE.md` 顺序契约表 | 🔒 `mutate` `arch` |
| **新增/删除 `scripts/` 下的模块** | `docs/ARCHITECTURE.md` 锚点表 · `scripts/check/selfcheck.ts`（可执行文件） | 🔒 `arch` `audit` |
| **改模块之间的依赖方向** | `docs/ARCHITECTURE.md`（含「一件新工作放哪边」那节，如果判据变了） | 🔒 `arch` |
| **改入口参数/退出码/产出文件/字段所有权** | `docs/ARCHITECTURE.md` 缝隙契约 · `skill/SKILL.md` · `README.md` 快速开始 | 部分 |
| **改数据源端点/字段** | `skill/references/providers/tikhub.md` · `scripts/providers/tikhub.ts` · `scripts/check/fake-fetch.ts` | 🔒 `selfcheck` |
| **改公开指标/风险/报价口径** | `docs/requirements.json` · `skill/references/public-metrics.md` · 计算与分层逻辑 · 输出说明 · 测试 | 部分 |
| **改 CSV 列或报告结构** | `scripts/lib/rows.ts` · `scripts/lib/xlsx.ts` · `scripts/lib/report.ts` · `skill/references/output-format.md` · 测试 · 变异 | 部分 |
| **新增可执行文件** | 三选一：接进 `scripts/check/selfcheck.ts`、在 `npm run check` 里自成一步、或写进 `EXEMPT` 说明理由 | 🔒 `selfcheck` |
| **新增一道闸门** | 判定逻辑（`scripts/check/` 下不带 shebang 的 `.ts`）· 测试 · **`scripts/check/mutations.json`**（闸门自己也是需求，它的测试同样要被证明过）· `process/` 里那条纪律 | 🔒 `audit`：scripts/check/ 下每个判定模块必须有变异指向它，否则硬失败；`mutate` 证明那个变异被抓到 |
| **改流程阶段** | `skill/SKILL.md` · `docs/business-requirements.md` · 对应 reference | ✗ 靠执行 |
| **查到新事实 / 旧结论被推翻** | `docs/data-source-strategy.md` **必须改** · `docs/adr/`（多属事实证伪） | 🔒 `adr` 验编号与索引 |
| **改预算/成本逻辑** | `scripts/lib/budget.ts` · `skill/SKILL.md` 成本闸门一节 · `docs/CONVENTIONS.md` 第 7 条 | 部分 |
| **改对外能力、范围、当前状态或交付物** | 对应正本 · `README.md`（只做摘要，不定义新事实） | ✗ 靠执行 |
| **评审中路由到本 PR 之外的一条发现** | 回复第一行的档与去向 · 线程 resolve · PR 描述末尾的索引 · 登记档还要 `docs/adr/` 里一块 `⚠️ 欠条`（**写重启条件**，由下一条 PR 带上） | ✗ 靠执行 |

---

## 文档地图

哪份文档管什么，避免写错地方：

| 文件 | 管什么 | 不该出现什么 |
|---|---|---|
| `docs/requirements.json` | 编号的**唯一真相来源** | 解释、理由、实现方式 |
| `docs/SPEC.md` | 需求的人类可读渲染 + 红线为什么是那几条 | 手改的表格（由 json 生成） |
| `docs/CONVENTIONS.md` | 在本项目里**反着**的通用做法 | 换个产品也成立的规则（那属于 `process/`） |
| `docs/ARCHITECTURE.md` | **零件之间**：模块边界、顺序契约、缝隙契约、三态落点 | 函数清单、目录树的散文版、需求论证 —— 代码说得出的一律不写 |
| `docs/SYNC.md` | 本表 | 具体规则 |
| `docs/business-requirements.md` | 背景、痛点排序、成功指标、论证过程 | 编号定义（那在 json） |
| `docs/data-source-strategy.md` | 各家 API 调研与选型结论 | 需求 |
| `docs/adr/` | ADR，一条一个文件，追加不删改；欠条与就地更正以 `⚠️` 块追加 | 计划、待办（带重启条件的欠条不算：它写的是缺什么、什么条件下重启） |
| `DECISIONS.md` | **只做转发**，指向 `docs/adr/` | 任何记录本身 |
| `README.md` | 给新接手者看的下游概览 | 只在 README 出现、无法追溯到正本的需求或事实 |
| `AGENTS.md` / `CLAUDE.md` | **只做路由**，指向上面这些 | 任何具体规则 |
| `skill/SKILL.md` | 给 Agent 的执行指令 | 需求论证 |
| `skill/references/*` | 每个阶段的操作细节 | 与 `process/` 重复的通用纪律 |

---

## 一条判别规则

> **在 `docs/` 里写下的每一条规则，如果换个产品也成立，那它写错地方了 —— 移到 `process/` 去。**

反过来，`process/` 里出现「KOL」「TikHub」「开发信」这类字眼，也是写错了地方。
`process/` 是跨项目复用的，改动要慎重。
