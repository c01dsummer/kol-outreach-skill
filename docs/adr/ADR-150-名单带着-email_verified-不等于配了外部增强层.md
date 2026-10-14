# ADR-150 名单带着 email_verified 不等于配了外部增强层

- 日期 · 2026-10-14 · 修 P5.h、P5.f 那个既有缺陷时（分支 `claude/enriched-p5h-fix`，提交 `2222c57`）改了两条旧断言；同日 Codex 复审指出改测试没在 `docs/adr/` 留记录，新加的自检还把夹具没造对报成了断言红
- 类型：既有缺陷。P5.h、P5.f 的正文与判据一个字不改，改的是两条旧断言的期望。改测试默认按「实现方便」驳回（`process/4-VERIFY.md`「测试失败时」、`docs/CONVENTIONS.md` 第 8 条），理由记在本条
- 触发它的事实：修复前（`375ee9a`），`scripts/lib/report.ts` 的 `enrichedFlag` 只要名单里有人带着 `email_verified`（`false` 也算）或 `audience_geo`，就判 `enriched` 为 true；`scripts/render.ts` 把带着 `email_verified` 的人数记成 `capabilities.email_verification.measured`，报告只在 measured 小于总数（或总数为 0）时印「邮箱来自 bio 提取，未做有效性验证」。外部增强一家都没接（`skill/references/providers/external-enrichment.md` 开头那句），今天的代码也不给这个字段产值；盘上名单带着它，render 就原样读进来。于是没配外部增强层时，名单里一个人带着它，`enriched` 就是 true，违反 P5.h；人人带着时那句声明不印，违反 P5.f。两条旧断言要的正是这个输出：`scripts/test.ts` 的「邮箱增强跑过（查了没有邮箱）→ true」；`scripts/check/selfcheck.ts` 给名单头一个人写上 `email_verified: false`、起真 render、要 `enriched` 为 true 的那一条（通过时打「meta.json 的 enriched 如实（跑过邮箱增强时为 true）」）
- 冲击的需求：P5.h、P5.f
- 结论：采纳。名单带着 `email_verified`，不论取值，都不算配了外部增强层：`enriched` 不看它，邮箱验证的 measured 不数它。两条旧断言删掉，换成期望取自 P5.h、P5.f 原文的新断言
- 连带改动：`scripts/lib/report.ts`（`enrichedFlag` 去掉 `email_verified` 那半句）· `scripts/render.ts`（邮箱验证的 measured 记 0）· `scripts/test.ts` · `scripts/check/selfcheck.ts` · `scripts/check/mutations.json`（M-P5-h、M-P5-j 换 `find`，M-P5-h 改点「地域增强跑过 → true」；新增 M-P5-y、M-P5-z）· 本条与索引 · ADR-67、ADR-70 末尾各追加一块

---

## 一、旧期望为什么错

P5.h 原文是「未配置外部增强层时，meta.json 的 enriched 必须为 false」，P5.f 是「未配置外部增强层时，HTML 报告必须声明邮箱未做有效性验证」。今天没有外部增强层，每一次交付都落在「未配置」那一侧。两条旧断言要的却是反面：名单带着 `email_verified: false` 时 `enriched` 为 true。

它们把「名单上有这个字段」当成「这次交付配了增强层」的证据，可带着它证明不了哪一层被配过、跑过 —— 它可以是从盘上名单原样读进来的。期望的出处也不对：旧自检的注释写着「查了、没查到邮箱，也算跑过（见 report.ts）」，取的是实现的说法，不是 P5.h 的原文；实现错了，它跟着错（同源污染，本仓库登记在 ADR-04）。ADR-67 第 68–75 行用的是同一个前提，已在那条末尾追加更正。

新期望全部取自 P5.h、P5.f 原文，不取自运行结果（`process/4-VERIFY.md`「expected 不许来自运行结果」）：

- `scripts/test.ts`：「名单带着 email_verified 为 false、没配外部增强层 → enriched 仍为 false」，以及取值为 true 的同一条。两种取值各写一条，说的是结论与取值无关。true 那一头只剩「地域增强跑过 → true」，照旧不认领判据。
- `scripts/check/selfcheck.ts`：给交付名单每个人写上 `email_verified: false`，起真 render，三条具名断言：`enriched` 仍为 false；报告照样声明邮箱未做有效性验证；meta.json 的邮箱验证 measured 为 0、全数记在 unqueried。每个人都写，是因为只写一个人时 measured 本来就小于总数，那句声明照印，P5.f 那一半测不到。

## 二、只定这一句

本条只定：名单带着 `email_verified`，不论取值，都不算配了外部增强层。

- `false` 是什么意思，本条不定。字段的类型、取值与交付表那一列都没改，那一列照旧印名单上的值。
- `audience_geo` 那一半不在本条：有人带着它时 `enriched` 照旧为 true，形状与本条修掉的相同，所以不能说 P5.h 的每条输入路径都修好了。复审把它判为既有缺陷，另行处理。
- 接上邮箱验证那一天，`enriched` 与 measured 要按那一层配没配、写下了什么重判，`report.ts`、`render.ts` 那两处注释写着。
- 代码注释里引的「ADR-149 更正块第 9 条」，是 #317 那条分支上登记这个缺陷的记录，写本条时不在这棵树上。这棵树上，改测试的理由以本条为准。

## 三、测试与变异

1. **先红后绿没有记录。** 修复时测试与实现在同一个上下文里改；修复作者那个会话没跑起来（修改说明里写着），没对着未修的代码看红。之后有没有人跑过检查链、结果如何，本条没查。红那一拍交给变异重演（`process/4-VERIFY.md`「已经先把代码改好了、补不上这一步的」那一条）：M-P5-y、M-P5-z 的 `replace` 就是修复前那两行。
   - M-P5-y 由需求测试验：字段在就算跑过。点 `enriched` 仍为 false 的那两条。
   - M-P5-z 由自检验：带着字段的人记作邮箱已验证。点自检的后两条；`enriched` 那条在它底下不会红，不点。
2. **自检的前提归错了原因，复审指出。** `2222c57` 里交付名单为空、或有人没带着这个值时，三条具名断言照样点着名字红、不带记号；M-P5-z 点着其中两条，判定会把这份空证据记成被抓到（`process/4-VERIFY.md`「夹具没造对也不算抓到」）。改成前提不成立时带 `SELFCHECK_FIXTURE_MARK` 单报一行，三条不判，复位照旧。

## 四、教训

字段在不在，只说明有人写过它，不说明是谁、在什么配置下写的。要判「做没做过某件事」，得看那件事自己留下的状态；拿一个会被原样带过来的字段当替身，没做过也报做过 —— `process/4-VERIFY.md`「判据的失效方式」说的「被无关的东西满足」，这回落在产品代码里，测试又照着它写。
