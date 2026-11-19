# 文档同步表

> **每次改完任一份文档，回头检查其余几份要不要跟着改。要改就当场改完。**
>
> 漂移是这样发生的：改动 A 时同步了 B，改动 C 时只改了代码，D 落下了。
> 半年后 D 说的是一个已经被推翻的结论，而没人知道。
>
> 这张表里**能机器检查的部分已经在 `npm run check` 里**（标 🔒）。
> 剩下的靠执行 —— 纯靠人执行的同步规则，执行率会随时间趋近于零。
>
> **两处副本每一行都隐含，却最常被漏：**
> `docs/SPEC.md` 只有登记表由 `requirements.json` 生成、被 `spec` 校验；表格外「红线为什么是这五条」
> 「尚未确定的」两节是手写的，`spec` 不看，结论变了它照样说旧话。`docs/adr/` 里陈述过同一事实、
> 承诺或裁决的记录也是副本 —— 找它们靠读索引标题与正文，不靠名单或正则；改法：还没拆过的记录在原记录末尾
> 追加 `⚠️` 更正块，不改写原文（`process/2-CHANGE.md`「新内容加在哪」）；已拆成主文件加历史文件的，主文件改成新结论、更正过程追加进历史文件（ADR-211，主文件只放现行结论那一份）。

---

## 触发表

| 改了什么 | 至少要看 | 机器检查 |
|---|---|---|
| **新增/删除/修改需求** | `docs/requirements.json` → `docs/SPEC.md` → 下游引用 → 测试 → 变异 | 🔒 `spec` `audit` |
| **新增/修改一条验收判据** | `accept` 判据编号稳定 · `test.ts` 或 `scripts/check/selfcheck.ts` 里 `criterion(...)` 认领（**两种认领同权**） · **只由自检认领的（需求测试未认领），要配一条 `by: "selfcheck"` 的负片** · 红线判据两种认领一个都没有时要显式登记豁免 | 🔒 `spec` · `audit` 逐条数：红线判据两种认领都没有是硬失败，只由自检认领却没有那种负片也是硬失败 |
| **两条需求撞上了（新增一处交点）** | `requirements.json` 的 `tension` 写在**让步的那一方**，双向声明会被拦下 · 裁决写结论不写「待讨论」· `test.ts` 里 `tension('A', 'B')` 认领 | 🔒 `spec` 查裁决与编号 · `audit` 逐个数，**有红线的交点没认领是硬失败** |
| **作废一条需求** | `requirements.json` 的 `deprecated`（编号保留不复用）· 下游引用要清掉 · 相关测试与变异。**红线（P1–P5）不许作废** —— 那是产品定义变了，走变更评定 | 🔒 `spec` 查作废必须写理由、**红线作废当场拦下** |
| **新增红线** | 需求登记表 · **测试** · **变异集** · `docs/CONVENTIONS.md` | 🔒 `audit` 强制红线有测试+变异 |
| **改评分/分层规则** | `scripts/lib/score.ts` · `scripts/lib/pipeline.ts` · `skill/references/semantic-fit.md` · 测试 | 部分 |
| **改管线步骤或其顺序** | `scripts/lib/pipeline.ts` · 测试 · **变异集**（顺序有语义，必须有变异守着）· `docs/ARCHITECTURE.md` 顺序契约表 | 🔒 `mutate`（顺序契约表点名的变异在不在、`file` 在不在那一行的位置栏里由它开跑前核，守不守靠人核；ADR-148） |
| **新增/改名/删除顶层目录或 `docs/` 下的子目录，或者换了运行产物的落点** | `docs/ARCHITECTURE.md`「新东西落在哪个目录」那张表 · `.gitignore`（不进仓库的；变异 worker 的副本清单问 git，跟着它走，ADR-72 第 303 行） · `AGENTS.md`（影响路由时） | ✗ 靠执行（ADR-114） |
| **新增/删除 `scripts/` 下的模块** | `docs/ARCHITECTURE.md` 锚点表 · `scripts/check/selfcheck.ts`（可执行文件） | 🔒 `audit`（锚点表靠人核，ADR-78） |
| **改模块之间的依赖方向** | `docs/ARCHITECTURE.md`（含「一件新工作放哪边」那节，如果判据变了） | ✗ 靠执行（ADR-78） |
| **改入口参数/退出码/产出文件/字段所有权** | `docs/ARCHITECTURE.md` 缝隙契约 · `skill/SKILL.md` · `README.md` 快速开始 | 部分 |
| **改报错/提示里给用户的一句承诺**（比如「续跑要不要花钱」）| **点名逐个过，不要 grep**：**`docs/requirements.json` 的对应判据（机器可读的真相来源，最不该说错）** → `docs/ARCHITECTURE.md` 缝隙契约 → **`skill/SKILL.md`（Agent 照着转述）** → 对应 `skill/references/*` → `README.md` → **那个脚本自己的文件头与块注释**（代码注释也是副本，而且离实现最近、最容易被当成权威）→ `docs/SPEC.md` 表格外的手写两节 → `docs/adr/` 里说过这句承诺的记录（追加 `⚠️` 更正）。副本的措辞常常不一样（「不产生新请求」vs「不产生新的请求」），按记忆搜必漏。**承诺的「条件」变了也要重走一遍全表**；**给一个已有取值加第二个来源**时同样要过 —— 承诺一个字没改，但可能已经不再为真（ADR-43） | ✗ 靠执行 |
| **增删需求登记表的字段** | `scripts/check/spec-rule.ts`（类型与校验）· `scripts/check/spec-sync.ts`（读写）· **`AGENTS.md` 与本表的文档地图**（它们描述这个文件有哪些字段）· `process/1-REQUIREMENTS.md`（如果那是通用概念） | ✗ 靠执行 |
| **改数据源端点/字段** | `skill/references/providers/tikhub.md` · `scripts/providers/tikhub.ts` · `scripts/check/fake-fetch.ts` | 🔒 `selfcheck` |
| **改搜索作品标识或并集契约** | `docs/requirements.json` 的 D11 → `docs/ARCHITECTURE.md` → `scripts/lib/types.ts` · `scripts/lib/posts.ts` · `scripts/providers/tikhub.ts` · `scripts/lib/pipeline.ts` · `scripts/lib/identity.ts` → `skill/references/providers/_interface.md` · `tikhub.md` · `skill/references/semantic-fit.md` → 测试与变异；已有结论的替代只在 ADR 末尾追加 | 🔒 `spec` `audit`；副本语义靠人核 |
| **改公开指标/风险/报价口径** | `docs/requirements.json` · `skill/references/public-metrics.md` · 计算与分层逻辑 · 输出说明 · 测试 | 部分 |
| **改 CSV 列或报告结构** | `scripts/lib/rows.ts` · `scripts/lib/xlsx.ts` · `scripts/lib/report.ts` · `skill/references/output-format.md` · 测试 · 变异 | 部分 |
| **新增可执行文件** | 三选一：接进 `scripts/check/selfcheck.ts`、在 `npm run check` 里自成一步、或写进 `EXEMPT` 说明理由 | 🔒 `selfcheck` |
| **新增一道闸门** | 判定逻辑（`scripts/check/` 下不带 shebang 的 `.ts`）· 测试 · **`scripts/check/mutations.json`**（闸门自己也是需求，它的测试同样要被证明过）· `process/` 里那条纪律 | 🔒 `audit`：scripts/check/ 下每个判定模块必须有变异指向它，否则硬失败；`mutate` 证明那个变异被抓到 |
| **改变变异全量/选组路由、`full_run` 解释或验证者分组配置** | `process/4-VERIFY.md`「只跑验证者的一部分时」那一条 · `process/6-INTEGRATE.md`「改验证成本时」的运行证据 · 实际变异目录与组/依赖/顺序配置 · `docs/ARCHITECTURE.md` 的维护判据、具体字段、基线及执行边界 · CI 可信基线传入 · 对应 ADR · `scripts/check/launches.json`（配置的集合变了：跑过 `npm run mutate` 后 `npm run launches -- --write` 写回，ADR-145 第三十五节） | 🔒 `mutate` 核真实基线变化与解释形状；解释语义和可比证据靠评审 |
| **改变变异配置使用、基线复用或经过时间报告** | `docs/ARCHITECTURE.md` 的计量语义（公开验收）、具体取数、输出协议和观察/汇总边界 · `process/6-INTEGRATE.md`「改验证成本时」的可比证据 · 对应 ADR 与完整变化清单 | ✗ 报告只提供原料，不拿哪一跑的秒数判红（入口启动数另由 ADR-145 的闸门判，见下一行；变异负载另由 ADR-203 的闸门按树内秒数文件判，见下两行） |
| **改变变异入口启动数的计数单位、计数预加载、启动数的输出或判法** | `docs/ARCHITECTURE.md` 的 `launch-rule.ts`、`launch-count.ts`、`launch-preload.ts`、`launches.ts` 四行与「入口启动数」那一段 · 改了 `launch-count.ts` 要重新认证观察器（它在设施清单里，ADR-221 第三节）· ADR-145（计数单位、两条线、第十三节的日志形状与输出协议）· 读 `output/mutation-launches/launches.json` 的那一侧（检查链最后一步 `launches.ts` 与它的判定 `launchGate`、升红后那一行摘要的判定 `summaryLine`，以及自检组 `launch-count-entry`）· `scripts/check/launches.json`（它是启动数的产出：跑过 `npm run mutate` 后 `npm run launches -- --write` 写回，ADR-145 第三十五节） | 部分：`h-launch-preload`、`h-launch-preload-edge`、`h-launch-rule` 与自检组 `launch-count-entry` 守行为；文档靠执行 |
| **改变异分份、变异负载闸门的线，或重写秒数文件** | `docs/ARCHITECTURE.md` 的 `shard-load.ts`、`shard-load-rule.ts`、`shard-weights.ts` 三行与 `MUTATE_SHARD` 那一段 · ADR-203（量法、三道线、死亡条件、什么时候重写秒数文件）· `.github/workflows/check.yml` 的份数与 worker 数（改份数要 `SHARD_COUNT` 一起改）· `scripts/check/shard-weights.json`（只由 `npm run shard-weights` 写，与别的改动分开提交） | 部分：`h-shard-load`、`h-jobs` 与自检组 `shard-load-entry` 守行为、闸门核 `check.yml` 接线（`check.yml` 除整行注释与空行外改一个字，同一条 PR 都要改 `shard-load-rule.ts` 的 `WORKFLOW_PIN`）；线定得对不对、秒数文件准不准靠读报数行与 CI 墙钟 |
| **改外部工单号闸门认哪几种写法，或换、加外部任务工具** | `docs/ARCHITECTURE.md` 的 `ticket-refs.ts`、`ticket-refs-rule.ts` 两行 · ADR-205（认得出、认不出的写法，死亡条件）· `process/3-BUILD.md` 第 7 条（只写通用的话）· `docs/GLOSSARY.md`「外部工单号闸门」 | 部分：`h-ticket-refs`、`h-ticket-refs-entry` 守行为；认不出的写法靠读 |
| **改起子进程接口闸门认哪几类写法，或往登记表的「登记」里加文件** | `docs/ARCHITECTURE.md` 的 `child-process-use-rule.ts`、`child-process-use.ts`、`child-process-registry.json` 三行 · ADR-217（认得出、认不出的，本条不定的，死亡条件）· `docs/GLOSSARY.md`「起子进程接口闸门」 | 部分：`h-child-process-sites`、`h-child-process-judge`、`h-child-process-entry`、`h-child-process-entry-test-files` 守行为；新「登记」的理由对不对、新「测试文件」是不是只有测试用得着，靠评审读（闸门把多出的行列出来） |
| **改 git 夹具能起什么、在哪起，改自检记当前目录那一处，改起进程的替身，或加只给测试用的模块** | `docs/ARCHITECTURE.md` 的 `git-fixture.ts`、`selfcheck-spawn-notes.ts`、`child-process-stand-in.ts` 三行 · ADR-222（白名单为什么是这几样，拦不住的）· ADR-223（替身的三种用法，拦不住的）· `child-process-use-rule.ts` 的 `TEST_ONLY_MODULES` 与登记表「测试文件」· `docs/GLOSSARY.md`「git 夹具」「起进程的替身」 | 部分：`h-git-fixture`（不合规矩的抛错、不交给模块上的函数）、`h-git-fixture-run`（真起 git：建得出玩具仓库、继承来的仓库指向碰不到别的仓库）、`h-selfcheck-spawn-notes`（换上的函数先告诉自检、名字与承诺版照旧、返回值原样）、`h-child-process-stand-in`（替身只在 body 里、各种了结都换回、交叠当场抛错）、`h-child-process-stand-in-spies`（探子转给原函数，只问得到换成了什么）守行为；白名单加的一项是不是只在玩具仓库里用得着靠评审 |
| **改通用启动函数拦什么、包哪几个函数** | `docs/ARCHITECTURE.md` 的 `start-process.ts` 一行 · ADR-219（做什么、拦不住的、什么时候撤）· 观察器重新认证（它与 `launch-count.ts` 在设施清单里，ADR-221 第三节）· `docs/GLOSSARY.md`「通用启动函数」 · `scripts/check/launches.json`（包装改了、测试的启动数跟着变时：跑过 `npm run mutate` 后 `npm run launches -- --write` 写回，ADR-145 第三十五节） | 部分：`h-start-process`（拦 git）、`h-start-process-shell`（不许经 shell、只认一种写法、过了的原样交给 Node）守行为，启动数认 git 的那几条（`h-launch-rule`）一起守 |
| **改 git 入口能答哪几问、怎么起 git** | `docs/ARCHITECTURE.md` 的 `git-entry.ts` 一行 · ADR-220（表里每一问写明谁要问；拦不住的、什么时候撤）· 观察器重新认证（git 入口、`git-config.ts`、通用启动函数、`launch-count.ts` 都在设施清单里，ADR-221 第三节）· `docs/GLOSSARY.md`「git 入口」 · 改了问法的判定模块自己的测试 · `scripts/check/launches.json`（测试的启动数跟着变时：跑过 `npm run mutate` 后 `npm run launches -- --write` 写回） | 部分：`h-git-entry`（表里有已挪文件真问的那几串、不在表里的抛错不起 git、子命令都只读、交给模块上的函数时带固定配置）、`h-git-entry-run`（真起 git：固定配置压得住仓库里反着设的、答不上来的分得开）守行为；新加的一行是不是给机器读的输出靠评审 |
| **改决策记录「要用到的事实，各找谁要」那一节的标题、表头、「不列：」的写法，或起算号** | `docs/ARCHITECTURE.md` 的 `adr-fact-table.ts` 一行 · ADR-224（怎么判、拦不住的、什么时候撤）· `docs/CONVENTIONS.md` 第 13 条 · `docs/GLOSSARY.md`「找谁要的表」 | 部分：`h-adr-fact-table`（齐的不报、缺节两节空节、表头分隔行空格子格数、引文里的不算、旧空号、接进 `npm run adr`）守行为；填得对不对靠复核 |
| **改两层的判别规则** | `process/README.md`「为什么要分两层」（原则）· `process/AGENTS.md.tpl` · `AGENTS.md` · 本表「一条判别规则」· `REVIEW.md` 那句指针 | ✗ 靠执行（替代「读」的，不建检查；判据见 `process/README.md` 第二层） |
| **重命名／删掉 `process/` 或 `docs/` 下被 `REVIEW.md` 指到的那几份** | `REVIEW.md` 的指针（三份转发一般不用动，它们只指 `REVIEW.md`；例外见下一行） | ✗ 靠执行 |
| **改名、挪走或删掉 `docs/adr/README.md`「同类」一节（文件本身不动也算）** | 所有按名字指到这一节的地方，不靠记，现找：`git grep -n '「同类」' -- '*.md' '*.yaml' ':!docs/adr/ADR-*' ':!docs/adr/历史/'`（不带管道，表格里也能原样复制；没拆过的决策记录与历史文件只追加，旧文字不改，所以排除）；拆过的记录主文件可以重写，`docs/adr/历史/` 下有同名文件的那几份主文件另用 `git grep -n '「同类」' -- docs/adr/<那份主文件>` 看。其中 `.coderabbit.yaml` 里只管 `docs/adr/ADR-*.md` 的那一条点名的就是这一节的名字，漏改了评审器就照着一个不存在的节提 | ✗ 靠执行 |
| **改 `process/` 里任何一份** | 各工具的入口文件（`AGENTS.md`、`CLAUDE.md`）与 `process/AGENTS.md.tpl` 里指向 `process/` 章节的路由 · 改的是一条纪律（加、改、删）时另要的两样，见 `process/2-CHANGE.md`「文档同步规则」那张表的「改本目录里的任何一份」 | ✗ 靠执行 |
| **改流程阶段** | `skill/SKILL.md` · `docs/business-requirements.md` · 对应 reference | ✗ 靠执行 |
| **改 `skill/references/` 下的文件（新增、删除、改名）、`package.json` 的命令名、`skill/` 下文档里写的 `npm run …` 或 `scripts/….ts`、SKILL.md 的 frontmatter 或指向 `skill/` 的两个软链** | `skill/SKILL.md` 的「参考文档」表与点名处 · `skill/` 下写着那个命令名或脚本路径的每份文档 · `.claude/skills/`、`.agents/skills/` 下名字等于 `name`、指向 `../../skill` 的软链（`docs/ARCHITECTURE.md`「新东西落在哪个目录」） | 🔒 `skill`：五样关系（ADR-156）；「参考文档」表的说明列与 reference 正文靠人读 |
| **查到新事实 / 旧结论被推翻** | `docs/data-source-strategy.md` **必须改** · `docs/SPEC.md`「尚未确定的」一节（手写，状态与证据边界常在这里） · `docs/adr/`：新裁决另开一条（多属事实证伪），陈述过旧结论的记录各在末尾追加 `⚠️` 更正（已拆成主文件加历史文件的，主文件改结论、更正追加进历史文件，ADR-211 主文件只放现行结论那一份） | 🔒 `adr` 验编号与索引 |
| **改预算/成本逻辑** | `scripts/lib/cost-ledger.ts` · `cost-json.ts` · `budget.ts` · `task.ts` 费用检查点 · 价目与所有付费/费用出口 · `skill/SKILL.md` 成本闸门与相关 references · `docs/CONVENTIONS.md` 第 7 条 · `docs/ARCHITECTURE.md` · ADR-108/109 对外契约 | 部分 |
| **新造一个词或一种编号写法，或者改了一个词的意思** | `docs/GLOSSARY.md` 加一行或改那一行（一句白话、一个例子、出处）· 出处那份文件里的定义 | ✗ 靠执行（ADR-207：写给人看的文字用白话、立术语表） |
| **改对外能力、范围、当前状态或交付物** | 对应正本 · `README.md`（只做摘要，不定义新事实） | ✗ 靠执行 |
| **评审中不修在本 PR 的一条发现（含驳回）** | 回复第一行的档与去向 · 线程 resolve · PR 描述末尾的索引 · 合入后的**欠条 PR** 往 `docs/adr/` 追加 `⚠️ 欠条「短名字」`（写重启条件；驳回只做前三项，不进欠条；晚到的同类候选怎么写欠条，见 `docs/adr/README.md`「同类」）—— 本表唯一允许延后到下一条 PR 的一行：为登记再 push 会再起一轮评审，见 `6-INTEGRATE.md` | 🔒 `audit`：欠条块里没写重启条件当场红（ADR-86），同一条记录里欠条短名字重名或取不出当场红（ADR-211，欠条用短名字互指那一份）；**写了的那些机器不读** —— 读懂条件是会随模型变强的那一侧，台账只抽取不匹配 |

---

## 文档地图

哪份文档管什么，避免写错地方：

| 文件 | 管什么 | 不该出现什么 |
|---|---|---|
| `docs/requirements.json` | 编号的**唯一真相来源** | 解释、理由、实现方式；**手改 `content_hash`**（派生字段，由 `spec-sync --write` 写、由 `check` 校验）。**没人读又校验不了的元数据一律不留** —— 见 ADR-30 |
| `docs/SPEC.md` | 需求的人类可读渲染 + 红线为什么是那几条 + 尚未确定的问题（后两节手写，`spec` 不校验） | 手改的表格（由 json 生成） |
| `docs/CONVENTIONS.md` | 在本项目里**反着**的通用做法 | 换个产品也成立的规则（那属于 `process/`） |
| `docs/ARCHITECTURE.md` | **零件之间**：模块边界、顺序契约、缝隙契约、三态落点；新东西落在哪个目录（顶层目录与落点规矩） | 函数清单、逐文件的目录树、需求论证 —— 代码说得出的一律不写 |
| `docs/SYNC.md` | 本表 | 具体规则 |
| `process/` | 通用的流程与纪律，换个项目也成立 | 本仓库的任何信息（见下「一条判别规则」） |
| `docs/business-requirements.md` | 背景、痛点排序、成功指标、论证过程 | 编号定义（那在 json） |
| `docs/data-source-strategy.md` | 各家 API 调研与选型结论 | 需求 |
| `docs/adr/` | ADR，一条一个编号：主文件只放现行结论，过程在 `docs/adr/历史/` 下的同名文件里只加不删（ADR-211，主文件只放现行结论那一份）；没拆过的照旧追加不删改；欠条与就地更正以 `⚠️` 块追加，欠条起短名字 | 计划、待办（带重启条件的欠条不算：它写的是缺什么、什么条件下重启） |
| `docs/REGRESSION.md` | 改了 `skill/` 的判断类文字以后，在几个冻结的真实任务上比新旧两版、看产出有没有变差的手工流程（ADR-159） | 每次跑的结果（在那条改 `skill/` 的 PR 正文里）；真实任务数据 |
| `docs/REVISIT.md` | 回访例程照做的全部规则（例程往 ADR-152 追加台账；「候选句」两道门都过了、起草了的，另开一条候选句记录） | 例程以外的规则；每周的结果（在 ADR-152 与例程开的候选句记录里） |
| `docs/GLOSSARY.md` | 术语表：编号怎么读、自造的词和普通词在这里的特定意思，每条一句白话、一个例子、出处 | 规则本身（只解释词，规则在出处那份）；外部任务工具的卡号 |
| `DECISIONS.md` | **只做转发**，指向 `docs/adr/` | 任何记录本身 |
| `README.md` | 给新接手者看的下游概览 | 只在 README 出现、无法追溯到正本的需求或事实 |
| `AGENTS.md` / `CLAUDE.md` | **只做路由**，指向上面这些 | 任何具体规则 |
| `skill/SKILL.md` | 给 Agent 的执行指令 | 需求论证 |
| `skill/references/*` | 每个阶段的操作细节 | 与 `process/` 重复的通用纪律 |

---

## 一条判别规则

> **在 `docs/` 里写下的每一条规则，如果换个产品也成立，那它写错地方了 —— 移到 `process/` 去。**

反方向的原则在 `process/README.md`「为什么要分两层」：`process/` 里的每一句话都要换个项目也成立。
在本仓库，写进 `process/` 就是写错了地方的，通常是这几样：

- 决策记录编号（占位符 `ADR-NN` 除外），以及「（本仓库：ADR-NN）」这种指针
- 本仓库的文件与命令：`docs/` 下的具体文件名、`scripts/…`、`npm run …`、检查的脚本名（`size`、`adr`、`audit`、`mutate`）
- 本仓库的编号与字段名：需求与判据编号（`P1`、`D14`、`U9.b`）、变异编号（`M-H14-e`）、变异集的字段（`by`、`kills`）
- 业务词：「KOL」「TikHub」「开发信」
- 本仓库的经过：日期，以及「以前」「今天」「撤了」这类把一句规则钉在本仓库时间线上的写法

它们的去处是 `docs/adr/` 或 `docs/` 下对应的那一份，`process/` 不指回来。
这张单子是举例，不是判据：「这句话算不算本仓库的信息」写不成一条命令，按 `process/README.md`
第二层那把尺子是替代「读」的，所以不做成检查，靠写的人和评审的人读（`REVIEW.md`）。
`process/` 是跨项目复用的，改动要慎重。
