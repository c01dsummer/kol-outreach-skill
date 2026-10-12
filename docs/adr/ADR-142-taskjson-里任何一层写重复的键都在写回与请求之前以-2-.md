# ADR-142 task.json 里任何一层写重复的键都在写回与请求之前以 2 拒绝，不再只管进度键

- 日期 · 2026-10-12 · 还 ADR-140 第四节第二张既有缺陷的欠条（根上其他键写重复时任何入口都不判）与 ADR-141 第四节第一张（进度字段更深一层写重复的键）。需求所有者 2026-10-11 定为修、另开一条 PR（「再开一条 PR」），2026-10-12 在决定卡上选了整份判（「整份判」）
- 类型：既有缺陷。读入只留最后一处，经任何命令整份写回后前几处从盘上消失；`tasks` 写重复时续跑按最后那份列表判，`requests`、`cost_ledger` 写重复时按最后一处的计数花钱。新增需求 D27，按改需求逐条评定，见第二节
- 触发它的事实：对着 `ff11f98`（`sourceDuplicates` 恒交回空、`duplicateKeyProblems` 恒交回空）跑新测试。把合法夹具里的一处改写成写重复 —— `"tasks":"zq-first-tasks","tasks":[…]`、任务里的 `"keyword":"zq\u002dold","keyword":"local"`、`"requests":7.5e1,"requests":"zz-mid","requests":0`、`"budget_usd":9.5e1,"budget_usd":1`、费用账里的 `"limit_micro_usd":9.5e2,"limit_micro_usd":1000000` —— collect 续跑与 `--budget 2` 每例都以 0 结束，预留 6 次、请求 6 次，task.json 与任务目录都被改写；enrich 普通与 `--budget 2` 以 0 结束，预留 1 次、请求 1 次、整份写回（进度值里更深一层的 `"found":{"0":{"zq":7.25e0,"zq":3}}` 也一样）；render 以 0 结束并写出 `kol.csv`、`kol.xlsx`；`calibration version` 要写盘时以 0 报 `written`；人工反馈模板命令以 0 报 `create`、建出 `manual-feedback.csv`。`tasks` 写两次而最后那份不合规时三个入口以 2 退出，stderr 只写最后那份的问题，不提前一处
- 冲击的需求：D27（新增）；D19（D19.g 那句更深一层的重复改由 D27 判）；D20（D20.p 与 D20 × P1 裁决补上 D27.c）；D26（D26.b 补上 D27.d）；P1、P3（新交点 D27 × P1、D27 × P3）
- 结论：采纳。task.json 任一层对象里写重复的键，collect 续跑、enrich、render 与人工反馈模板命令在任何写入与请求之前，`calibration version` 在要写盘时，以 2 拒绝，按先后列出每一处原文
- 连带改动：`docs/ARCHITECTURE.md` 锚点表新增 `duplicate-keys` 一行、改六行（collect、enrich、render、`cost-json`、`calibration-version-task`、`feedback-template-task`），顺序契约表 enrich 与 `calibration version` 那一行改措辞，写回那一段与 `calibration version`、`feedback-template` 两段补 D27；README、SKILL、`output-format.md` 与 `product-intake.md` 的提醒补上其余位置；D19.k 改成「某张表里同一个键」、末句补「由 D27 判」（ADR-141 第四节第二张那张登记，扫描一改就响），D19.g 末句、D20.p、D20 × P1 裁决与 D26.b 补措辞；ADR-140 第四节第二张、ADR-141 第四节两张记已还；`cost-json.ts` 的扫描改成每一层都记键，`sourceDuplicateKeys` 从同一次扫描里只取根与根下一层（D19.k 的结果不变），变异 M-D19-y、M-D19-af、M-D19-ao 的 find 跟着改（replace 的含义不变）

---

## 一、决定

1. **整份判，不逐字段判。** 读入只留最后一处，在哪个字段都是同一件事：盘上有几处，命令只看见一处，整份写回时其余几处消失。按名单逐个判（`tasks`、`requests`、`cost_ledger`、`budget_usd`、`brand_calibration`）要先猜哪些字段要紧，名单外的键与更深的位置（`tasks[0]` 里的 `keyword`、`cost_ledger` 里的项、进度值里的对象）照样被吞，以后新加的字段还得记着往名单里添。整份判一句话说得清，ADR-141 第四节那张（进度值里更深一层）也一并还掉。
2. **D19.k 那几处不动。** 根上五个进度键与四张表里的键照 D19.k–n 报，措辞与时机都不变；D27 只报其余位置，同一处不报两遍。人工反馈模板命令过去不判进度，这次两类一起判。
3. **其余位置的重复跟任务列表问题一起报。** `tasks` 写重复时，任务列表按最后那份判；要是只在进度那一道报重复，用户会先照最后那份改任务，改完再撞上「写重复」。所以 collect 续跑与 render 在任务列表那一道报，enrich 与模板命令本来就只有一道。
4. **`calibration version` 照 D19.n。** 缺席与已一致都不写盘，盘上的几处原样留着，照旧以 0 结束；要写盘时与进度键的重复一起拒绝。
5. **只管 task.json。** collect --config 与 probe 读的是用户写的配置，见第四节。

## 二、逐条评定

1. **触碰红线吗？** 撞的是 P1（替用户挑一处、写回时抹掉其余几处）与 P3（`requests`、`cost_ledger`、`budget_usd` 按最后一处的计数或上限花钱）。拒绝不违反任何红线；两个交点都写了裁决。
2. **缩范围还是降标准？** 都不是。没有写重复的文件，五个命令的行为一字未改（D27.e）。
3. **可逆吗？** 可逆：五处调用删掉即回到原样。

## 三、测试与变异

待填。

## 四、边界

- collect --config 与 probe 读的配置文件不由本条判。那份文件是用户写的输入，不被整份写回；它写重复时 collect 按最后一处建任务，新建的 task.json 里只有那一处。
- 同一目录的并发写入按 D4 当前不保证（ADR-66）：命令跑到一半时有人手改 task.json 写出重复，费用检查点重读后只留最后一处，不在本条。

## 五、独立复核的发现与去向

待填。

## 六、本条那条 PR 上响了的欠条

待填。
