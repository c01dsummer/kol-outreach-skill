# ADR-114 目录要有章法：新目录先登记，运行产物只放 output

- 日期 · 2026-09-24 · 需求所有者问「以后怎么保证 evidence 目录不再被传上去」时追问出来的
- 类型：**既有缺陷**（约定缺口：一直没有写下目录各装什么、运行产物放哪）；做法由需求所有者 2026-09-24 裁决
- 触发它的事实：仓库曾有过一个 `docs/evidence/`，是为给决策记录留原始证据建的。需求所有者要求删掉之后，
  这次又问：这个目录为什么会被造出来？新建目录总要有个章法；往 `audit-rule.ts` 里加补丁代码也不好
- 冲击的需求：无（文档约定，不碰需求登记表）
- 结论：**采纳**目录表与三条规矩；**驳回**在审计里加一道闸门
- 连带改动：`docs/ARCHITECTURE.md`（新增一节）、`docs/SYNC.md`（触发表一行、文档地图里 ARCHITECTURE 那一行）、
  `AGENTS.md`（路由表一行）、`.gitignore`（只改注释）

## evidence 目录是怎么来的、怎么没的

- 资源夹具在 macOS / Node 24 上的诊断快照：分支提交 `4897fdc` 建了 `docs/evidence/resource-fixture-node24-20260923.json`，
  随 #148（`6c195e9`）进主干，ADR-104 链接了它；#150（`34a08eb`）删掉。
- TikHub 价目快照 `docs/evidence/tikhub-pricing-20260923.json`：只在 #154 的分支上出现过（`02c4a8b` 加、`6de2540` 删），
  主干上没有过；ADR-107 写过这个路径。#154（`c651046`）在 `.gitignore` 里加了 `evidence/`。
- 旧记录里提到它的有 8 处：写出 `docs/evidence/…` 路径的 4 处（ADR-104、ADR-107 各两处），
  说「不提交 evidence 文件」的 4 处（ADR-107、108、109、110 各一处）。那是当时的事实，按只追加的约定原样保留。
  `docs/data-source-strategy.md` 里「仓库不再提交 evidence 文件」一句仍然成立，不改。

## 根子

没有一处把全部顶层目录连同「进不进仓库」列全，也没有一处说采集任务目录以外的运行产物该放哪。
已有的都是零散的：`README.md` 有 `skill/` 与 `scripts/` 的目录树，`skill/references/output-format.md` 写了任务目录，
`skill/SKILL.md` 与 `skill/references/memory.md` 写了 `memory/creators.json`，`docs/SYNC.md` 的文档地图逐个列了文档文件。
碰到「要存一份原始证据」时没有一条写下的约定可依，只能自己起名建目录。
ADR-101 第十三节记着的那批 IG 样本放在了 `output/adiaro-discovery/`，同样没有约定可依。

## 决定

- `docs/ARCHITECTURE.md` 加「新东西落在哪个目录」一节：顶层目录表（进不进仓库、装什么）与三条规矩 ——
  不新建顶层目录、也不在 `docs/` 下新建子目录，真需要就在同一条改动里登记；运行产物一律放 `output/<名字>/`，
  决策记录只引用本机路径与 SHA256；这张表没有机器核，靠 `docs/SYNC.md` 提醒。
- 放在 ARCHITECTURE、又不算 `process/5-DESIGN.md` 说的「目录树的散文版」：它只列顶层目录与落点规矩，不逐个文件列；
  「进不进仓库」「新东西放哪」是代码说不出的，和同一页「一件新工作放哪边」是同一种形状。
  文档地图里 ARCHITECTURE 那一行跟着改：「管什么」加上目录落点，「不该出现」收窄成逐文件的目录树。
- 新增一个不进仓库的目录时，除了 `.gitignore`，还要改 `scripts/check/jobs-rule.ts` 里那份手抄本（`SKIP`，
  决定变异 worker 复制哪些东西，ADR-72 记着它为什么是手抄本）；写进了规矩 1 与 SYNC 触发表。
- `.gitignore` 的 `evidence/` 一行保留，注释改成指向那张表。

## 驳回：在审计里加一道闸门

原提议：被跟踪的文件里，路径有一段叫 `evidence`、或者 `.gitignore` 说该忽略却已被跟踪的，一律硬失败。

- 后一半防的是 `git add -f`：`.gitignore` 已经挡住平常的 `git add`，`-f` 是有意为之，防它要一段新的判定、测试与变异。
- 前一半只认 `evidence` 这个名字：换个目录名提交同类文件，它照样拦不住。真正缺的是「东西该放哪」那句话。
- 它会让 `audit-rule.ts` 多一块与它本职（检查链自己算不算数、计量输入怎么分、报告上的数怎么数）无关的东西。

> ⚠️ 欠条：规矩 1「不新建目录，真需要就在同一条改动里登记」换个产品也成立，按 `docs/SYNC.md` 末尾的判别规则
> 本该放进 `process/`；`process/` 跨项目复用、改动要慎重，先留在 ARCHITECTURE ·
> 重启条件：下一条改 `process/5-DESIGN.md`「不许装的」或 `process/2-CHANGE.md`「决策记录格式」里目录布局那一段的改动

## 什么条件下重开这个讨论

- **又有一个没登记的新目录进了主干。** 说明靠人记不住，再议要不要让检查去核目录清单。
