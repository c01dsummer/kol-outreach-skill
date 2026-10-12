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

1. **测试先于实现、由另一个上下文写成**：只读需求原文、函数签名、夹具与 `mutate --brief`，不读实现。`scripts/test.ts` 的 `d19-resume` 组新增 D27 一段（库层的 D27.a、D19.k 的判据范围不变、D27 × P3 起真入口 `collect --resume --budget 2` 与 `enrich --budget 2`），`d20-content-version` 组补 D27.c 库层与 D27 × P1，`feedback-template-crossings` 组补 D27.d 库层；自检 `resume-progress` 组补五个入口里四个（collect、enrich、render、`calibration version`）的 D27.b、D27.c、D27.e，`feedback-template` 组补 D27.d、D27.e。每个拒绝用例都先跑同一模式下只留最后一处的阳性对照：collect、enrich 要照常预留并请求，render 要照常导出，`calibration version` 要照常写入或报 `unchanged`，模板命令要照常建表；对照不过就带夹具记号、跳过该例。
2. **对着接口看红**：`test.ts` 十七条红（`d19-resume` 十二、`d20-content-version` 三、`feedback-template-crossings` 二），自检十五条红（`resume-progress` 十二、`feedback-template` 三），都是新断言；原有断言一条没变色，没有夹具或进程记号。观测值见文首「触发它的事实」。绿着的是夹具有效性、D27.e 不多拒、D19.k 的判据范围与 `calibration version` 缺席、已一致两条 —— 断的是现状本来就对的那一半。接上实现（`a822ea6`）后全绿。
3. **变异 M-D27-a 至 M-D27-s，十九条**（五条 `by: selfcheck`、十四条 `by: test`）：
   - 扫描：只认根与根下一层、数组不数下标、位置少了根上那一层；
   - 问题文本：只写最后一处、次数写死、下标写成键的样子、找不到原文当成没有重复；
   - 跳过 D19.k 那几处的判据：把表里更深一层也跳过、把 `requests` 当进度键跳过、不跳过（报两遍）、不分场合都跳过；
   - 入口：去掉 collect、render、enrich、`calibration version`、模板命令各自的那一次调用，`calibration version` 缺席与已一致也拒，模板命令只报 D19.k 以外。
   每条在副本里单独施变后只跑点名的组（非 root 用户）：点名的断言都红，没有夹具或进程记号。M-D19-y、M-D19-af、M-D19-ao 跟着扫描改了 find，同样单独验过。
4. **没写成变异的一条**：collect 不分 `--resume` 都判（`if (resume)` 去掉）。那样 `collect --config` 读的配置写重复时也会被拒，而 D27.a 把配置文件划在范围外；没有测试钉「配置写重复照常收下」—— 那是在钉一条需求没说的行为，这条变异施下去什么都不会红。

## 四、边界

- collect --config 与 probe 读的配置文件不由本条判。那份文件是用户写的输入，不被整份写回；它写重复时 collect 按最后一处建任务，新建的 task.json 里只有那一处。
- 同一目录的并发写入按 D4 当前不保证（ADR-66）：命令跑到一半时有人手改 task.json 写出重复，费用检查点重读后只留最后一处，不在本条。

## 五、独立复核的发现与去向

待填。

## 六、本条那条 PR 上响了的欠条

普查办法同 ADR-140 第六节：`scripts/check/debt-rule.ts` 的 `entries` 按块列出 `docs/adr/` 里带重启条件的条目，295 条，逐条按字面读重启条件，再读全块、查后面有没有已还或销掉。只列响了的。

- ADR-140 第 89 行（第四节第二张，根上其他键写重复时任何入口都不判）：本条要还的那张，还了，ADR-140 末尾 `⚠️ 已还`。
- ADR-141 第 41 行（第四节第一张，进度字段更深一层写重复的键）：本条一并还了，ADR-141 末尾 `⚠️ 已还`。
- ADR-141 第 45 行（D19.k「同一个任务索引键」的措辞比实现窄，条件是改 `cost-json.ts` 的重复键扫描）：响了，还了 —— D19.k 改成「某张表里同一个键」，末句补「由 D27 判」，ADR-141 末尾 `⚠️ 已还`。
- ADR-139 第 126 行（重挂 ADR-97 第 190–192 行：下一条往入口脚本里加判定）：响了。collect、render、enrich 三个入口各多一次调用，M-D27-l、m、n 只由自检抓。没还，记在 ADR-139 末尾并重挂。
- ADR-94 第 1281 行（ADR-141 重挂的「三态靠字段存不存在来表达」，条件之一是再碰 `offsets`、`answered`、`found`）：响了，没还，记在 ADR-94 末尾并重挂。
- ADR-94 第 465 行（F9、P5.i、U3.b、D6.g、D6.h 的登记表条目，兜底条件是下一条碰 `docs/requirements.json`）：响了，核过缺 0 条，D6.c 已退役，ADR-94 末尾 `⚠️ 已还`。
- ADR-134 第 96 行（新增或改动的自检组用到看不见的通道）：`resume-progress` 组新段经 `costFixture` 用拼出来的路径 `cost-d27-*`、`cost-calver-dup-d27-*`，`feedback-template` 组新段用组内 `base` 下的 `d27-*`，都起子进程，`resume-progress` 那一段经 `NODE_OPTIONS` 装预留观测。
  核过：前缀不与别的夹具名重名，两组的 `needs` 仍为空；`scripts/check/share-rule.ts` 的扫描在 `7214352` 与本条上都是 67 组、没有报问题，`feedback-template` 组的读写集相同，`resume-progress` 组多读两个顶层常量 `TT_SEARCH`、`TT_PROFILE`（没有组写它们）。拆进程跑与单进程跑的 ✓ 行对照没做。没还，照旧挂着。
- ADR-89 第 91–93 行（往 `mutations.json` 加变异时看一眼盖的是不是从来没人盖过的地方）：看过了。十九条新变异里十七条的 find 在 `7214352` 上出现 0 次、在本条上恰好一次，盖的是本条新写的代码；M-D27-p、q 锚在主干就有的 `unchanged`、`absent` 两行，那两行原有 M-D19-ax、ay 守着「有进度键的重复也不拒绝」，「有其余位置的重复也不拒绝」这一半是第一次有变异守。改了 find 的 M-D19-y、af、ao 在主干上也是 0 次。那张欠条照原样留着。
- ADR-78 第 78–81 行（改 `ARCHITECTURE.md` 顺序契约表）：响了 —— 本条改了 enrich 与 `calibration version` 那一行的措辞，位置栏补上 `scripts/lib/duplicate-keys.ts`。按 ADR-78 第 93 行那条字面规则在 `7214352` 与本条上各跑一遍，输出相同：只有三行旧的不过（算分 → 基础分层、三个入口读旧名单、render 当前 Agent／人工投影）。表里点名的变异本条一条没动。没还，照旧挂着。

普查判为没响、但离得近的：
- ADR-136 第 137 行（改 collect、enrich 读任务失败时报错的改动）：读任务失败那条路没动。
- ADR-138 第 76 行（开始读任务条目或 `brand_calibration` 里此前未列出的键）：扫描器在源文本里认每一层的键名，但只为找重复，不把任何未列出键的值读进任务状态，也不改它们怎么写回。
- ADR-88 第 189 行（下一次有红线需求变更时）与 ADR-90 第 107 行（下一次有隔离上下文重写测试、或动 `test.ts` 里别的红线 suite）：P1、P3 原文没动，D27 一侧声明了两个交点；测试是另一个上下文新写的，不是重写，P1 到 P5 的 suite 没碰。
- ADR-132 第 310 行（往 `selfcheck.ts` 新增组、改 `needs`、或新增跨组读运行结果）：没有新组，`needs` 没改，新段只读本组与顶层常量。
- ADR-12 开头四块（锚点表说明列）：本条新增一行、改六行说明，那张欠条 2026-10-08 已由需求所有者收尾、不再挂条件。
