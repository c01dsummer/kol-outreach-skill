# ADR-149 email_verified 名实不符：先登记，待需求所有者裁决

- 日期 · 2026-10-14 · 专门回头查这一处时写下（待办 2.B2b）：`scripts/lib/report.ts:115` 的注释与 `scripts/check/selfcheck.ts:2385` 的用例把 `email_verified: false` 当成「查过了，没有邮箱」，和字段名说的不是一件事。本条只登记与评定，代码一行没改
- 类型：**需求有歧义**（`false` 是什么意思，类型定义、供应商契约、需求登记表都没写；三处注释与断言名补上的意思和字段名相反）；改名、换形状、删掉这几条路改的是对外口径，属**产品取舍**且不可逆，要人拍板
- 触发它的事实：生产代码里没有一处给 `email_verified` 赋值，写它的只有两个测试夹具；直接读它的有三处（`meta.json` 的 `enriched`、`capabilities.email_verification` 的计数、CSV/XLSX 的 `email_verified` 列），经 `capabilities` 再决定第四处（HTML 里 P5.f 那句声明）。字段名、P5.f 的文字、`capabilities` 的键名与 `docs/business-requirements.md` 都把它当成「邮箱有效性验证」的结果；`report.ts:115`、`selfcheck.ts:2385` 与 `scripts/test.ts:2752` 的断言名（`scripts/check/mutations.json:2948` 点名它）把 `false` 说成「查了、没有邮箱」—— 增强层若只是再读一遍 bio，那是 `email: null` 已经在说的事（P1.a、P1.d）；它查的是什么，没有一处写着（第二节）
- 冲击的需求：P1（三态）；P5（第三节第 1 小节那条链违反的是它的正文）；P5.f、P5.h（经 `enrichedFlag` 与 `capabilities.email_verification` 直接由它决定）；U7.d（`capabilities` 三个数分开统计）；U9.a、U9.d（`email_verified` 是旧表头第 12 列，旧列值仍遵守原口径）。本条不改任何一条的原文
- 结论：**接受为已知缺口**。代码、测试、变异、需求登记表与对外文档本条一行不改；留不留、`false` 定成什么、名字改不改、形状换不换，列成第五节的决定卡，交需求所有者裁决。照注释改了意思、读者照旧拿它判「验证过」的那种改法（第四节方案乙）触碰 P5，直接驳回，不进决定卡。推荐方案甲：名字不改，`false` 定成「验证过，没通过」，改掉三处说反了的话（点名其中一处的变异跟着改），改正 `skill/references/output-format.md:73` 那句和代码不符的说明；换成三态 `Measurement`（方案丙）留到第一条要给它写值的改动开工之前
- 理由：第二到第四节
- 连带改动：本记录及生成的索引。裁决以后那一片改什么、怎么验，见第六节

---

## 一、证据：它今天住在哪儿

行号都按主干 `375ee9a`（本分支的分叉点）。

### 1. 定义

| 位置 | 写着什么 |
|---|---|
| `scripts/lib/types.ts:334` | `email_verified?: boolean`，没有注释。`:332` 那行注释是给上一行 `email`（`:333`）的，只讲 `email`；`bio` 那种「三态各是什么」的说明（`:283–293`）它没有 |
| `skill/references/providers/_interface.md:53` | 同一行。`:50–51` 说这几个字段「profile 补全或未来外部增强后填充」，三态只讲了 `email` |

### 2. 写入：生产代码里没有

给它赋值的只有两个夹具：`scripts/test.ts:2753`（`email_verified: false`）与 `scripts/check/selfcheck.ts:2389`（`patched[0].email_verified = false`）。`scripts/providers/tikhub.ts` 的两个 profile 映射是逐字段构造的，不带它，所以 `scripts/collect.ts:416–421` 把补全结果展开进创作者时也带不进来；第三方增强一家都没接（`skill/references/providers/external-enrichment.md:3`；`_interface.md:163`「当前仅从公开 bio 提取未验证邮箱」）。今天的代码不给它产值，但也不删它：collect 续跑从盘上的名单起步（`scripts/collect.ts:155`、`:182–183`；只有旧 `creators.json` 时，`scripts/lib/pipeline.ts:55–69` 只删评审与派生字段）；render 读盘上的 `creators.json`（`scripts/lib/task.ts:67–72`），克隆后投影（`scripts/render.ts:70–76`），投影只删评审与人工反馈字段（`scripts/lib/review-projection.ts:10–12`、`:69`；`scripts/lib/effective-priority.ts:43–44`），写回盘上时也带着它（`render.ts:120` → `task.ts:100–107`）。名单里带着这个键，它就流到下一小节那四处读者 —— `selfcheck.ts:2383–2404` 就是往已有名单里写一个 `false` 再跑 render。所以「交付物里它在每个人身上都是 `undefined`」只对盘上名单没带这个键的目录成立，从头采的目录是其中一种。带着的有没有：更早的版本写没写过，本条没翻提交历史，不知道；手改过、别的工具写过的名单，同样说不了。

### 3. 读取：三处直接、一处间接

| 位置 | 做什么 |
|---|---|
| `scripts/lib/report.ts:122–123` | `enrichedFlag`：任一人 `email_verified !== undefined` 或 `audience_geo !== undefined` 即为 true，接到 `meta.json` 的 `enriched`（`scripts/render.ts:184`，P5.h）。它上面的注释 `:115`：「`email_verified` 为 false 也算『跑过』（查了、没有邮箱），所以只看字段在不在。」 |
| `scripts/render.ts:142`、`:199–203` | `!== undefined` 的人数记作 `capabilities.email_verification.measured`；`unavailable` 写死 `0`；`unqueried` 是总数减 `measured` |
| `scripts/lib/report.ts:317–320`、`:345–347`（间接） | `measured < total`（或总数为 0）时印 P5.f 那句「邮箱来自 bio 提取，未做有效性验证，建议首轮小批量试发观察退信率。」；没有 `capabilities` 的旧 `meta` 退回看 `!meta.enriched` |
| `scripts/lib/rows.ts:7`、`:132` | 旧表头第 12 列；`cell(c.email_verified)`：`undefined` 印 `未查询`，`true`／`false` 原样印（`:36–37`） |

还有一处不读它、却和它有关：跨平台同人合并（`scripts/lib/identity.ts:104–113`）把两边的 `email` 合到一起（D7.d），`email_verified` 只留主记录自己的。ADR-67 第 68–72 行记过这一半。

### 4. 测试与变异

| 位置 | 内容 |
|---|---|
| `scripts/test.ts:2746–2748` | `没跑过邮箱/地域增强 → enriched false`，认领 P5.h；负片 M-P5-j（`scripts/check/mutations.json:2963–2974`） |
| `scripts/test.ts:2752–2753` | `邮箱增强跑过（查了没有邮箱）→ true`，夹具 `email_verified: false`；不认领判据（`:2749–2751`），是 M-P5-h（恒 false）唯一点名的断言（`mutations.json:2939–2950`，名字在 `:2948`） |
| `scripts/check/selfcheck.ts:2383–2404` | 往 `creators.json` 写 `email_verified = false` 再跑一次 render，要 `enriched === true`；注释 `:2385`：「查了、没查到邮箱，也算跑过（见 report.ts）」 |
| `scripts/test.ts:4426–4433`、`:13316`；`scripts/check/selfcheck.ts:7919` | 三份旧表头的字面清单，各自钉着 `email_verified` 这个列名和它的位置（U9.a、U9.d） |

M-P5-h 与 M-P5-j 的 `find` 都是 `report.ts:123` 那一行的原文。

### 5. 文档

| 位置 | 写着什么 |
|---|---|
| `skill/references/output-format.md:73` | 「有增强层时填，否则留空」。**和代码不符**：没值时 `cell()` 印的是 `未查询`，不是空白；按 P1.e，空白是「查过为空」。这一句今天就不对，与改不改名无关 |
| `skill/references/output-format.md:286`、`:298`、`:329` | `capabilities` 示例；`enriched`「只代表外部邮箱/受众增强」；收尾那句「邮箱来自 bio 提取，未做有效性验证」 |
| `docs/requirements.json:145–146` | P5.f：「未配置外部增强层时，HTML 报告必须声明邮箱未做有效性验证。」 |
| `docs/business-requirements.md:86`、`:103`、`:119`、`:147`、`:264` | 邮箱验证是有成本门槛的可选增强；成功指标「A 级候选邮箱有效率」目标 > 90%，靠发信后退信率反推；范围上不接入外部邮箱增强；「接入后只对 A 级做邮箱验证 + 受众画像；当前跳过」 |
| `docs/data-source-strategy.md:170` | 「当前没有外部 `enrich` 供应商；邮箱验证和受众地域仍明确缺失」 |
| ADR-67 第 68–75 行 | 合并不把次记录的 `email_verified` 带给主记录；「true 那一头」要不要认领、怎么修，「一起走变更评定」 |

## 二、两种读法

| | 甲：邮箱有效性验证的结果 | 乙：增强层查过邮箱没有 |
|---|---|---|
| 谁这么说 | 字段名；P5.f 的文字与 `report.ts:346` 那句声明；`capabilities.email_verification` 这个键；`business-requirements.md` 的「邮箱验证」「邮箱有效率」 | `report.ts:115`；`selfcheck.ts:2385`；`test.ts:2752` 的断言名（连带 `mutations.json:2948`） |
| `undefined` | 没验证过 | 没查过 |
| `true` | 验证过，通过 | 没有一处说过；大概是「查过，有邮箱」—— 增强层若只是再读 bio，又是 `email` 有值那一态 |
| `false` | 验证过，没通过 | 查过，没有邮箱 |

乙的 `false` 是不是 `email: null`，要看增强层查的是什么，而这一点没有一处写着。P1.a 的 `null` 是「补全过但 bio 里没有邮箱」，P1.d「记成『查过，没有』」，说的都是 bio。增强层若只是再读一遍 bio，同一件事由两个字段说，就会有两边说得不一样的时候，以哪一边为准也没写；它若去 bio 以外找，乙的 `false` 是另一次查询的结果，不重复。测试也没把两者绑在一起：`test.ts:2753` 只给了 `email_verified: false`，`email` 是 `undefined`（`mk()` 不带它，`:394–398`），按 P1.a 是「没做过 profile 补全」；`enrichedFlag` 也不看 `email`。

两种读法只在字段有值时才分得开：值缺席时，几处读者给的都是「没做过」（印 `未查询`、不计入 `measured`、那句声明照印），照哪种读法读都对。今天的代码不给它产值，所以盘上名单没带这个键的目录里（从头采的目录是其中一种），两种读法撞不上。名单带着值时，今天的代码就撞上了：第一节第 2 小节那条路径把值原样交给读者，读者不问它是谁、按哪种读法写的 —— 交付名单里一个人带着 `false`，交付表那一格就印 `false`，`enriched` 成了 true，`measured` 记 1；交付名单不空、人人带着值时，那句「未做有效性验证」就不印了，而今天没有外部增强层，正是 P5.f 要求必须印这一句的情形。这种名单有没有，本条没核。另一个撞上的时机是第一个生产者出现的时候 —— 它照名字写还是照注释写，决定了下一节那条链通不通。

## 三、为什么不只是名字的事

### 1. 一条通到 P5 的链

`render.ts:142` 把 `!== undefined` 全算作 `measured` → `report.ts:317–319` 拿 `measured < total` 决定印不印「未做有效性验证」→ 一个照乙写的生产者给查过的每个人都写上值（没邮箱的写 `false`，有邮箱的大概写 `true`），`measured == total`，那句声明就不印了，`enriched` 也成了 true —— 而一个地址都没验证过。

P5.f 的字面不会响：它只管「未配置外部增强层时」，而这时增强层配了。被违反的是 P5 本身：「交付时必须显式声明数据边界：哪些字段未经验证」。这种错在交付物上和对的长得一样（`process/README.md` 的总纲：把第三档「我不知道」压进了「是」）。

照甲写，只有验证过的人才有值，这条链给的结果是对的。

### 2. 照甲写，`boolean` 这个形状也装不下

1. **一个值里可以有几个地址。** D7.d（ADR-147）以后 `email` 可以是 `agency@mgmt.com, jane@gmail.com`；一个布尔说不出验证的是哪一个。
2. **合并把别人的地址拿进来，验证结果留在原地。** `identity.ts:113` 合并两边的邮箱，`email_verified` 只有主记录的：一个 `true` 会和一个从没验证过的地址印在同一行。
3. **说不出「验证了，没得到结果」。** 验证服务超时、额度用完时，只能写成「没验证过」或编一个真假。`render.ts:201` 把 `unavailable` 写死成 `0`，就是这个形状的后果。
4. **没有出处与时间，和同一份契约对不上。** `_interface.md` 第 53 行列着裸布尔，第 115–116 行却要求未来的第三方结果「必须使用与公开指标相同的三态 `Measurement<T>`，来源 `kind='third_party'`」；`external-enrichment.md:22` 说当前只保留 `Measurement<T>` 这个来源结构；`docs/ARCHITECTURE.md:569–570` 的三态落点也只有 `Measurement<T>` 与 `capabilities`。
5. **分母。** `capabilities.email_verification` 的 `total` 是全部人数，而没有地址的人永远验证不了：照甲，他们永远记作 `unqueried`，那句声明也就永远在。这是多说、不是少说，P5 那一侧是安全的；但对一个没有地址的人说「没验证」，不是一句准话。

盘上名单没带这个键的目录里（从头采的目录是其中一种），这五条今天都不响 —— 今天的代码不给这个字段产值。盘上的名单带着布尔时就不能这么说：那些值原样流到读者那里（第一节第 2 小节），这五条今天就可能响；响没响、响了算不算错，要看那些值是谁、按哪种读法写的，本条没核。它们决定的是：第一个生产者出现之前，形状要不要先换。

## 四、方案、取舍与影响面

一个字段住在五层，各层碰到的东西不同：

| 层 | 在哪 | 改它碰到什么 |
|---|---|---|
| TS 字段名 | `types.ts:334` | 盘上 `creators.json`、`creators.raw.json` 的键；今天的代码不给它产值，已有的原样带过去 |
| 供应商契约 | `_interface.md:53` | 以后接供应商的人照它写适配器 |
| CSV／XLSX 列名 | `rows.ts:7` | U9.a、U9.d 锁着；三份字面表头钉着；下游按列名读 `kol.csv` 的工具 |
| `meta.json` 的键 | `render.ts:184`、`:200` | P5.h 的 `enriched`、U7.d 的 `capabilities.email_verification`。和字段名无关，哪个方案都可以不动 |
| 形状 | `boolean` | 第三节第 2 小节那五条 |

| 方案 | 做什么 | 代价 | 可逆吗 |
|---|---|---|---|
| **甲 名字不改，按名字定语义**（推荐） | 五层都不动。`undefined` 没验证过（含没有地址可验）；`true` 验证过，通过；`false` 验证过，没通过；「查过，没有邮箱」不归这个字段（bio 里没有是 `email: null`，P1.a）。改掉三处说反了的话、点名其中一处的变异跟着改，给两处定义补注释，改正 `output-format.md:73` | 第三节第 2 小节那五条照旧：盘上名单没带这个键的目录里今天不响，带着布尔的名单上今天就可能响（这种名单有没有，本条没核），有了生产者会响 —— 交给第七节那张欠条 | 可逆：注释、一个断言名、一行文档 |
| 乙 照注释改名，读者照旧 | 把它改成「增强层查过邮箱」的标记，名字比如 `email_looked_up`；读它的几处（第一节第 3 小节）照旧，有值就算跑过、算 `measured` | **触碰 P5，直接驳回，不进决定卡**（`process/2-CHANGE.md` 第二步第 1 条）：P5.f 说的「有效性验证」没了落点，第三节那条链从隐患变成设计 —— 查过就撤下「未做有效性验证」那句，而一个地址都没验证过 | — |
| 乙′ 照注释改名，查询与验证分开 | 字段改作「增强层查过邮箱」的标记；`capabilities.email_verification` 与那句声明只认验证结果，查过撤不下那句；验证结果另有落点 | 验证结果的落点仍得照甲的三态，乙′ 比甲多出一个今天没有读者的查询标记，还要动执行逻辑（`render.ts:142` 改数验证结果）；字段改了名，`report.ts:123` 那一行跟着变，M-P5-h、M-P5-j 的 `find` 同丙一样要改；增强层若只是再读 bio，查询标记的 `false` 与 `email: null` 重复（P1）；`email_verified` 列若改印查询标记，「查过」会被读成「验证过」，还是第三节那件事，得跟着改列名 —— 那就是改 U9.a、U9.d，按列名读 `kol.csv` 的下游会断 | 改列名就不可逆（对外列名） |
| 丙 换形状 | 换成三态 `Measurement`，`kind='third_party'`，逐个地址记；列名留着 —— 从头采的目录里这一列只印 `未查询`，丙不改它，改的是以后有值时印什么；`capabilities` 改走 `countMeasurements`，`unavailable` 如实；分母改成有地址可验的人；合并逐地址合（接上 ADR-67 第 68–72 行邮箱那一半） | 外层契约已经定了（`Measurement<T>`、`kind='third_party'`、带来源与时间，`_interface.md:115–116`、`types.ts:126–162`），没定的是里面：`T` 装什么、按地址怎么记、拿不到结果时 `reason` 填什么 —— 没有一家供应商过了准入（`external-enrichment.md:6–22`），没有真实样本，现在定这些是猜；有值时的新印法要在 U9.d「旧列值仍遵守原口径」下补一条例外或新判据；M-P5-h、M-P5-j 的 `find` 跟着改；落盘形状变 | 不可逆（落盘形状、以后有值时的对外列值） |
| 丁 删掉 | 没有生产者，删字段、删列 | 删列违反 U9.a、U9.d；`capabilities.email_verification` 成了常数或跟着删（U7.d）；是缩范围；P5.f 说的那件事没了落点，接验证时还得加回来 | 不可逆（对外列名） |

**迁移。** 甲不用迁键、列与 `meta.json`：都不变。今天的代码不给它产值，但盘上已有的会被原样读进来、写回去（第一节第 2 小节）；那种名单里的 `false` 若是照乙写的，甲会把它读成「验证过，没通过」。这种名单有没有，本条没核；碰上了，得先定那些值怎么读。乙′（改列名时）、丁要给按旧列名读表的下游一个说法。丙读旧目录时，缺席照旧读作没验证过，与今天同一态；旧目录里的布尔同样得先定怎么读，不能按新口径猜。

### 按四条判据过一遍甲

1. **触碰红线吗？** 不碰。交付物逐字节不变：改的只是注释、一个断言名（连同点名它的那一行）与一行文档，交付路径上没有一行执行逻辑变（第六节「怎么验」第 3 条），盘上的名单带不带这个键都一样。它拿掉的是会让第三节那条链通到 P5 的读法；乙则是把那条读法写进名字，所以直接驳回（上表）。
2. **缩范围还是降标准？** 都不是。丁是缩范围（要问，第五节第 1 问）；乙会让「查过」的标记压掉「未验证」的声明，落在降标准那一侧，驳回；乙′ 把查询和验证分开，不降标准。
3. **覆盖还是可信？** 护的是可信：P5 那句声明只在真验证过时才退场。
4. **可逆吗？** 可逆。乙′、丙、丁碰对外口径或落盘形状，不可逆，要问。

按 `process/2-CHANGE.md`，甲那一半属需求有歧义，本可以直接写清楚。本条仍等裁决：先做甲，就等于替人把「留着」「名字不改」「形状晚点换」一并选了。

## 五、决定卡

1. **留还是删？** 留（推荐）／删（丁）。删列要先改 U9.a、U9.d，按列名读 `kol.csv` 的下游会断；`capabilities.email_verification` 跟着成常数或删掉（U7.d）；接验证时还得加回来。选删，第 2–4 问不用答。
2. **`false` 是什么意思？** 甲「验证过，没通过」（推荐）／乙′「查过，没有邮箱」，查询与验证分开（第四节）。乙那种读者照旧、查过就撤下声明的，触碰 P5，已驳回，不在这里问。
3. **名字改不改？** 不改（推荐）／改；改的话改哪几层（TS 字段、供应商契约、CSV 列名）—— 改列名要先改 U9.a、U9.d。上一问选乙′，这一问就是改。
4. **形状什么时候换？** 现在就换成三态 `Measurement`（丙）／第一条要给它写值的改动开工之前再换（推荐：外层契约已定，里面的 `T` 没有供应商、没有真实样本，现在定是猜）。
5. **ADR-67 第 75 行那件事接不接？**（「true 那一头」要不要认领、合并怎么修。）本条不接（推荐）：P5.h 照旧只要求 false 那一头；合并的邮箱那一半并进丙，`audience_geo` 被 `drop` 的那一半照旧留在 ADR-67。

## 六、裁决以后那一片（按推荐的甲）

改的全是文字，没有一行执行逻辑：

| 文件 | 改什么 |
|---|---|
| `scripts/lib/types.ts:334` | 补注释：三态各是什么；「查过，没有邮箱」不是这个字段（bio 里没有是 `email: null`）；一个值里有几个地址时布尔说不清，第一次给它写值之前先按本条换形状；`capabilities` 的分母今天是全部人数，没有地址的人记作 `unqueried` 是这个形状的限制、不是判断（第三节第 2 小节第 5 条），换形状时一并改 |
| `skill/references/providers/_interface.md:53` | 同一句话的契约版 |
| `scripts/lib/report.ts:115` | 「查了、没有邮箱」改成「验证过、没通过」 |
| `scripts/check/selfcheck.ts:2385` | 「查了、没查到邮箱」改成「验证过、没通过」；夹具 `:2389` 的 `false` 不动 ——「验证过、没通过」照样是跑过增强 |
| `scripts/test.ts:2752`、`scripts/check/mutations.json:2948` | 断言名改成比如 `邮箱验证跑过（没通过）→ true`；M-P5-h 的 `kills` 在同一个提交里跟着改：清册只认 `eq`、`ok` 的字面量首参（ADR-145 第 242 行），两边对不上，`npm run mutate -- --brief` 当场拒 |
| `skill/references/output-format.md:73` | 「否则留空」改成没验证过印「未查询」，照代码今天的样子。这一行选哪个方案都要动（选丁是随列删掉） |

不改的：需求登记表与 `docs/SPEC.md`（没有一条判据的原文变）；CSV 列名、三份字面表头、`meta.json` 的键；M-P5-h、M-P5-j 的 `find`。

**怎么验：**

1. 点名逐个过第一节那几张表，每一处都对得上甲；再全仓搜关键词兜底（`process/2-CHANGE.md`「描述保证的那句话」）：`查了没有邮箱`、`查了、没有邮箱`、`没查到邮箱` 在本记录以外 0 处。
2. `npm run mutate -- --brief` 过（清册点得着改了名的断言）；手工施 M-P5-h（读原字节、换掉 `find`、跑需求测试、写回原字节），改了名的那条按点名红。
3. diff 里能执行的只有 `test.ts:2752` 与 `mutations.json:2948` 那一对字符串；`scripts/lib/`、`scripts/render.ts` 只动注释，交付物不变。
4. 本机整跑 `npm run check` 通过，PR 上的 CI 绿。

## 七、登记

> ⚠️ 欠条（登记）：`email_verified` 的 `false` 两种读法并存（第二节），留不留、名字、语义与形状都没定；今天的代码不给它产值，盘上名单没带这个键的目录里它不改变任何输出，第三节那条通到 P5 的链也不通；带着它的名单会原样流到读者那里（第一节第 2 小节），这种名单有没有，本条没核 · 重启条件：需求所有者在第五节的决定卡上作答时；第一条要让生产代码给 `email_verified` 写值的改动（接邮箱验证供应商，或别的任何赋值）开工之前；或者撞见带着它的值的名单（交付表这一列印出 `true`／`false`，或 `capabilities.email_verification.measured` 不为 0）时，三者先到为准

## 八、教训

**一个只有读者、没有写者的字段，它的意思是读者的注释给的。** 第一个写者会照名字写，读者照注释读；两边都「对」，错在中间。凡是只有读者的字段，先问一句：第一个写它的人会照什么写？

**拿「结果字段在不在」判「那件事跑没跑过」，就得保证只有真跑过那件事才会写它。** 否则一个「查过」会顶替「验证过」，而顶替的地方正是一句数据边界声明退场的开关。
