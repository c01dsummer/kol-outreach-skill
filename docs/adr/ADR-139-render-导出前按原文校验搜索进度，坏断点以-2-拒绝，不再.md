# ADR-139 render 导出前按原文校验搜索进度，坏断点以 2 拒绝，不再把溢出印成 Infinity

- 日期 · 2026-10-11 · 还 ADR-138 第五节第二张既有缺陷的欠条（第 56 行「render 不校验续跑进度……report.html 印 `Infinity`」），需求所有者 2026-10-11 定为修，并在「拒绝（退出码 2）」「坏值显示为无从确认」「登记为已知缺口」三条里选了拒绝
- 类型：既有缺陷。D19 只管 collect 续跑时判进度、经别的命令写回后不许变得看不出来，没说 render 读到坏进度该怎么办；本条在 D19 正文补半句、新增 D19.h、D19.i、D19.j，按改需求逐条评定，见第二节
- 触发它的事实：主干 `3c574a9` 上，`task.json` 里写 `"found":{"1":1e400}` 再跑 render：退出 0，report.html 关键词表那一行印 `<td>Infinity</td>`，meta.json 写 `"found": null`，task.json 留着原文 `1e400`（ADR-138 修好的那一半）。
  同一类还有：`2.0000000000000001` 印成 `2`，`-1e400` 印成 `-Infinity`，`answered: null` 让整张表印「无从确认」。
  `scripts/render.ts` 从来不调 `scripts/lib/resume-progress.ts`；`scripts/lib/pipeline.ts` 的 `keywordRows` 把 `state.found[i]` 原样带出，`scripts/lib/report.ts` 的 `foundText` 用 `String()` 印，meta.json 经 JSON 写成 `null`
- 冲击的需求：D19（正文补半句，新增 D19.h、D19.i、D19.j）；D19.g（正文不改，见第二节第 4 条）；P1（交点 D19 × P1 已在，裁决不改）
- 结论：采纳。render 在任务列表有效之后、读名单与任何写入之前，用 collect 续跑的同一判据按原文 token 校验 `done` 与四张统计表，不合规以 2 拒绝
- 连带改动：`scripts/render.ts`；`docs/requirements.json` 与 `docs/SPEC.md`；`scripts/check/selfcheck.ts` 的 `resume-progress` 组；`scripts/check/mutations.json`（新增 M-D19-m–q，M-D19-j 的点名跟着改名）；`docs/ARCHITECTURE.md`（顺序契约表一行、锚点表一行、D19 那一段）、README、`skill/SKILL.md`、`skill/references/output-format.md`；本记录与索引；ADR-138 末尾追加 `⚠️ 已还`

---

## 一、决定

1. **复用 collect 的判据，不另写一份。** render 调同一个 `resumeProgressProblems`，经 `sourceNumberToken` 按读入时的原文 token 判。
   两边判的是同一件事（这份 task.json 的进度能不能按索引读出精确值），另写一份就会出现「collect 拒、render 收」的同一份文件。
2. **位置：任务列表有效之后，读名单与任何写入之前。** 进度按任务索引解释，要先有有效的任务数（与 collect 同，ARCHITECTURE 顺序契约那一行）；
   拒绝先于名单、交付物、任务与记忆写入，与 D16.n 拒绝坏任务列表一样。和品牌输入问题同时出现时两类都报再退出，与任务列表和品牌输入的既有做法一致。
3. **整份拒绝，不降级显示。** 否决的两条备选：
   - 坏的 `found` 改印「无从确认」继续导出：报告看不出 task.json 坏了，坏值和 D6.l 的 `null`（这个数注定不全或没记下）混成一态 —— 正是 ADR-138 在写回那一层防的事，只是换到了展示层。
     用户拿到的信息变模糊，按 `process/2-CHANGE.md` 是降标准。
   - 登记为已知缺口：需求所有者没选。
4. **五张表都判，不只 `found`。** 报告直接读的是 `answered`（判查询状态）与 `found`（印条数），只判 `found` 的话坏的 `answered` 照样以另一种样子进报告。
   `done`、`offsets`、`pages` 报告不读，也一并判：它们坏了说明这份 task.json 的断点已不可信，collect 续跑会拒；render 照收的话，同一份文件两个入口一个拒一个收。
5. **`answered: null` 现在被拒。** 过去 render 把它当「无从确认」（`taskQueryStatus` 里 `== null` 那一支）；D19.b 不允许整表是 `null`，collect 本来就拒。
   `taskQueryStatus` 那一支留着：它是函数自己的防御，`scripts/test.ts` 的单测还钉着，删它是另一项改动。

## 二、逐条评定

1. **触碰红线吗？** 撞的就是 P1：读不出精确值的进度印成 `Infinity`、`null` 或舍入后的数，是把「不知道」印成看起来像测量值的数。拒绝不违反任何红线。
2. **缩范围还是降标准？** 拒绝让「坏 task.json 还能出报告」这件事没了。那份报告本来就带着错数；合法输入一个都没挡（D19.j：缺整张表的旧目录、`1.0`、`1e0` 照常导出）。不降标准，覆盖只少了本来就是错的那部分。
3. **可逆吗？** 可逆：一个入口多一道校验，删掉即回到原样。
4. **D19.g 正文不改。** 它说 render 整份写回后进度原文逐字相同。坏进度现在到不了 render 的写回，那半句对 render 不再有可触达的输入；
   合法而写法不规范的 `3.0`、`5e0` 仍经 render 写回，逐字不变由新段一条断言守着、配 M-D19-q。含义没变，编号不动。

## 三、测试与变异

按 `process/4-VERIFY.md`「改 bug」先写测试、对着主干看红：`resume-progress` 组新段在主干上红 12 条（6 份坏进度各 2 条断言），红的值是退出 0、写出了 kol.csv、stderr 没有路径与原文。
期望只来自判据原文与夹具里写的字面值。测试与实现是同一个上下文写的（ADR-04 那个缺口），所以合并前过一次独立复核（D19 × P1 碰红线）。

**第一版夹具被无关的原因满足过。** 记忆哨兵写成了非 JSON 文本，render 因记忆读不进来以 2 退出，「退出 2、原样不变」那条在主干上就是绿的。
改成合法的空记忆，并加一个同样放哨兵、进度合规的阳性对照（必须以 0 结束并生成 kol.csv）；对照不成立，整段坏进度不跑。计入 ADR-70 第 2487 行的累计。

**改了一处既有测试。** D19.g 段的写回方去掉 render，两条断言名里的「render」跟着去掉，M-D19-j 的点名跟着改名。
那段把「render 对坏进度以 0 结束并刷新 updated_at」当阳性对照，与 D19.h 正好相反（`docs/CONVENTIONS.md` 第 8 条：改测试要写进记录）。render 在 D19.g 里剩下的一半转到新段。

变异五条，都由自检判、各点一条断言：

| 变异 | 违反了什么 |
|---|---|
| M-D19-m | render 不判进度（D19.h） |
| M-D19-n | 先改写名单再拒绝（D19.h，顺序） |
| M-D19-o | stderr 丢了 task.json 路径（D19.i） |
| M-D19-p | 缺整张表的旧目录被拒（D19.j） |
| M-D19-q | render 写回时丢了原文，合法的 `3.0` 被改成 `3`（D19.g 的 render 一半） |

每条都在本地施变后跑 `resume-progress` 组，确认点名的断言红、没有夹具或进程记号。M-D19-q 的第一版用 JSON 往返克隆整份状态，`saveTask` 当场抛错、对照带着夹具记号红，属于「跑不起来」而非「抓到」；
改成只换掉 `found` 那一个对象。

## 四、边界

- 只管 render。enrich 与 `calibration version` 不展示进度，仍只按 D19.g 照原文写回、不判。
- ADR-138 第五节第一张（`collect --config` 新建任务写重建出来的根）不在本条。
