# 过程层的问题回路：识别 → 记录 → 回访 → 沉淀（提案）

> **状态：已采纳（ADR-151），原文已换成这份转发。** 本文只做转发，不装任何规则；不删，是因为别处引着这个路径。

**裁决与落位**：`docs/adr/ADR-151-过程层问题回路：七条实践按层拆开落位，先合记录、再逐片合.md`。
第一节裁了什么（含提案 §7 那六项），第二节怎么切，第三节落位时改了形的地方，第四节边界与死亡条件
（第四节几条后来改过：更正块在第六节末、第十二节、第十三节末，第 6 条第三个数的命令在第十四节），第六节起一片一节（第 8 片记在 ADR-145 第三十五到四十三节）。

**提案 §5 那七条落在哪**（换成转发时，2026-10-17；只列主要落点，不是全清单，全清单在第二节与各片那一节）：

| 实践 | 落点 |
|---|---|
| P1 时长对比一行 | `.github/workflows/check.yml` 的「墙钟对比（只报数）」一步 |
| P2 被引表 | `npm run adr-ledger -- --cites`（`scripts/check/cite-rule.ts`）；`docs/adr/README.md` 前言「新开一条记录之前」那一句 |
| P3 启动数摘要落树 | `scripts/check/launches.json`（`npm run launches -- --write` 写回）；ADR-145 第三十五节（升红另开一条 PR） |
| P4 回访例程契约 | `docs/REVISIT.md`；回访台账 ADR-152；`AGENTS.md` 路由表那一行 |
| P5 周回访只递原料 | `docs/REVISIT.md`「周一」一节；`docs/adr/README.md` 前言「开欠条 PR」那一句 |
| P6 评审时同类提示 | `docs/adr/README.md`「同类」一节 |
| P7 通用句候选 | `docs/REVISIT.md`「候选句」一节；首条候选句记录 ADR-153 |

**还没落位的**：提案 §3 从 self-evolution 分支挑出的那十句通用句。ADR-151 第五节定的是先开一条记录、
再一句一条只改 `process/` 的 PR；换成转发时那条记录还没开。开了没有、是哪一号，看 `docs/adr/README.md` 索引里讲 ADR-151 第五节那十句的那一条
（ADR-153 是首条候选句记录，不是它）。

**原文**：别处写的「提案 §0」到「提案 §7」「附录 A」、提案第几行，节号与行号都指原文。§0 到 §4 的事实与分析、§6「明确不做的」十二件、
§7 各条的证据问题、附录 A，都只在原文里整段读得到；哪几句另有落点、哪几句只在原文，见 ADR-151 第十六节第 3 条；§1.1 那几类的重建见 ADR-151 第十四节开头。
原文合入时（#318）：`git show 9b4ce3f:proposals/process-loop/README.md`；换成转发之前的最后一版（#331）：`git show be3193b:proposals/process-loop/README.md`；
浅克隆先 `git fetch --unshallow`。
两版行数、节号、行号都相同，只差三行：第 3 行状态（#321 改成已采纳），两处 self-evolution 分支名（#331 改成归档名 `archive/self-evolution-2026-09-18`）。
