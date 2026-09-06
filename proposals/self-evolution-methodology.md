# 受控自演化：EARS × 形式化验证 × 工程控制论的渐进实施方案（提案）

> **状态：提案，未采纳。** 本文不改变任何一条现行需求、判据、测试或代码。凡是提议新增或修改
> `docs/requirements.json` 的地方都只是草案，采纳前必须按 `process/2-CHANGE.md` 评定并留下决策记录；
> 草案的变更分类也是**提议分类**，由评定者定，不由本文定。
>
> **这份文件为什么放在根目录的 `proposals/`，而不在 `process/` 或 `docs/` 里：** 它既含跨项目通用的方法
> （按 `AGENTS.md` 的两层规则属于 `process/`），又含只属于本产品的试点设计（属于 `docs/`），两边都放不下整份。
> 提案阶段不拆，是为了让读者一次读完；采纳时按 H 节的步骤拆开落位 —— 通用的进 `process/`，本产品的进 `docs/`，
> 其余变成代码、登记表与 ADR —— 本文随即只剩一个转发或直接删除。`proposals/` 里的东西不是规则，`AGENTS.md` 不路由到这里。
>
> **证据基线：** 主干 `cc132a7`（2026-09-06 上午）；PR #75 分支 `claude/kol-formal-verification-kr5igx`（head `97c358e`）。
> 文中所有 `file:line` 都指 `cc132a7`，除非写明「#75 分支」。本文提交时主干已前进到 `f33efeb`（PR #81 合入：新增
> `scripts/check/verifier-rule.ts`、变异 226 → 229、`test.ts` 与 `selfcheck.ts` 各加几十行）；被引用的产品代码文件
> （`scripts/lib/*`、`collect.ts`、`enrich.ts`、`providers/tikhub.ts`）在这两个提交之间没有改动，行号仍然有效。

## 怎么读这份文件

### 证据标记（全文只用这五种）

| 标记 | 含义 |
|---|---|
| **实跑** | 本次会话在 Linux 容器（Node 22.22.2、Java 21）里真跑过。**脚本与输出不在仓库内**，仓库读者不能复核，只能按附录二的索引自行复现；所以「实跑」的效力是「本会话实跑」，不是仓库内可复核的证据 |
| **#75 自述 / 本次复现** | PR #75 自己声称的结论；标「本次复现」的是本会话用 `--tla` 参数（`-deadlock -workers 1`）重跑过并对上的 |
| **读代码** | 只读了主干代码或文档得出，没有执行 |
| **联网核对** | 通过代理查过 registry.npmjs.org、GitHub releases 或搜索摘要；标「未逐字核实」的是原文被代理挡住、只见摘要 |
| **尚未验证** | 写了但没跑、跑了没成、或只有联网核对的摘要而无一手材料 |

没有标记的数字与引用一律按「读代码」理解。

### 术语（首次出现前先定义）

- **第一层 / 第二层 / 第三层**：`process/README.md` 的三层保证 —— 第一层是入口文件的约定，第二层是能报错的检查（`npm run check`、CI），第三层是只能靠自觉的纪律。本文说「机器守」指第二层。
- **oracle**：判定一条义务成立与否时机器去读的那个东西 —— 一个文件字段、一个退出码、一行 stderr、一个函数返回值；写成 `human` 就是承认只能人判。
- **ghost 变量**：模型里有、代码里没有任何变量装着的量（例如「供应商真正计费的次数」）。
- **有界模型检查**（BMC）：把状态空间截在一个界内（最多几次请求、几次续跑）穷举全部可达状态；界外的行为不在结论里。
- **对拍**：同一事件序列同时喂给模型与真实代码，逐步比对状态；它是测试不是证明。
- **shrink**：属性测试找到反例后自动把它缩到最小；**seed / path** 是重放这个反例的坐标。
- **品牌类型**：`string & { __brand: 'X' }` 这类只能经唯一构造函数得到的 TypeScript 类型，用来让「没校验过的值」在编译期就进不了参数位。
- **discriminated union（DU）**：带一个字面量 `kind` 字段区分各分支的联合类型；`never` 穷尽断言靠它。
- **MBT（model-based testing）**：从模型生成事件序列去驱动真实实现并逐步比对 —— 本文的「对拍」是它的一种。
- **ITF**：Quint / Apalache 输出反例用的 JSON 轨迹格式（Informal Trace Format）。
- **设计面板**：本会话里让三个互不相见的上下文各写一份 EARS 设计、另三个各写一份 P3 设计，再由两个裁判上下文合成；六份设计稿与两份裁决在附录二的 `panels/`。
- **最后一块砖**：`process/6-INTEGRATE.md` 的切法 —— 判定、测试、变异先合，入口最后接上，没有入口的代码不改变任何行为。
- **trace validation**：让实现打事件日志，再用模型检查器验证「这条日志是模型允许的行为」。
- **Wilson 区间**：二项比例的置信区间；本文用它的宽度说「样本够不够」。
- **尺子 / 被量的**：F 节的分权用语 —— 需求、判据、测试的期望值、变异、不变量、假设是尺子；实现与 Skill 文本是被量的。

### 二十个问题各自在哪一节回答

| # | 问题 | 节 |
|---|---|---|
| 1 | 给现有登记表加 EARS 而不破坏编号与追踪 | C.0 / C.1 / C.6 |
| 2 | EARS 作主需求、验收标准、还是新增字段 | C.1（含与 ADR-67 的冲突） |
| 3 | EARS 的机器可检查 schema | C.2 |
| 4 | 避免「句式合规但不可判定」 | C.4（机器能识别的那部分）· C.2（词汇表与 oracle）· B1 |
| 5 | trigger / state / condition / response / exception / observable 的表示 | C.3 |
| 6 | 一条 EARS 映射到类型、状态机、不变量、前后置、属性测试、验收测试、变异、监控 | B 末尾的通用映射表 · D.10（P3 实例，含前后置契约） |
| 7 | 哪些需求值得形式化、哪些只适合测试或人工 | B 末尾的分级表 |
| 8 | P3 最小试点包含什么 | D |
| 9 | P3 的工具选择与比较 | E |
| 10 | 模型检查接入 Node/TS 与 CI | D.13 · E.4 |
| 11 | 模型、代码、测试、需求不漂移 | C.7（五对漂移通道汇总表）· D.13 第 2、3 条 · E.3 |
| 12 | 记录证明假设并在外部变化后使旧证明失效 | D.7（假设登记表与失效触发器的检测机制） |
| 13 | 防止 Agent 改需求、测试、证明条件迁就实现 | F |
| 14 | 哪些动作自动、哪些人批 | F（矩阵与角色） |
| 15 | 灰度、观察窗口、迟滞、冷却、回滚 | G · D.14 |
| 16 | 反馈指标可观测、可用、未把 unknown 当 zero | G「传感器」· B |
| 17 | 识别缺乏可控变量 | G「控制变量」 |
| 18 | 自然语言产品事实无法完全形式化 | B12 · H 第 9 步 · I |
| 19 | 试点成功与失败的判据 | D.15 · H「推广的 go / no-go」 |
| 20 | 试点成功后推广到 P1、P4/D4、身份去重、P2 | H 第 6–9 步 |

## A. 核心结论

先把七个词分开，后文全按这个用法：

| 词 | 指什么 | 本仓库里的落点 |
|---|---|---|
| **需求** | 用户要什么、不要什么，带编号 | `docs/requirements.json` |
| **规格** | 需求的精确化：触发、状态、条件、响应、可观察结果 | 本文提议的 EARS 字段（今天不存在） |
| **模型** | 规格的可推理形式：状态机、不变量、时序性质 | PR #75 的 `formal-rule.ts` 与 `BudgetProtocol.tla`（未合入主干） |
| **实现** | 代码与 Skill 文本 | `scripts/` · `skill/` |
| **测试** | 对实现的一次具体检验 | `scripts/test.ts` · `mutations.json` |
| **证明** | 「若假设 A 成立则性质 B 成立」的推理 | 今天没有；#75 与本文合起来也只覆盖 P3 的一小块，且是有界的 |
| **运行反馈** | 真实运行留下的记录 | `meta.json` · `task.json` · `memory/creators.json` · 关键词表现表 |

七样东西各自能错、各自能被改，所以 F 节的权限矩阵按这七样分权，而不是按「代码 / 文档」分。

### EARS 能解决什么

- **把一句话里藏着的两条义务逼出来。** 本仓库已经为此付过学费：D1.a 一条判据装着「去重」与「记忆查询」两条代码路径，测试只覆盖前一半，审计报 ✓（ADR-24）；P4.d / P5.e / D4.o 三条「当前不保证」根本不可失败，混在判据里（ADR-67）。EARS 的 `When / While / If` 结构让「这条义务在什么前提下、对什么事件、要求什么可观察结果」必须逐项填，填不出来的那一格就是没想清楚的那一格。
- **给下游一个可引用的对象，而不是一句话。** 今天测试认领的是判据编号（`criterion('P3.a')`），认领的是「这条话」；EARS 化之后可以认领到「这条义务」，模型的不变量、属性测试的性质、变异的负片、运行时监控的探针，都能指向同一个对象。
- **让机器拒绝一部分坏需求。** 「When memory is unavailable, the system shall safely handle the error」句式合规但不可判定 —— 只要要求 `unavailable` 与 `safely handle` 必须是词汇表里带 oracle 的术语，这句话在 `npm run check` 里就红（C 节）。

### EARS 不能解决什么

- **不能证明需求是对的。** 它约束形状，不约束内容。
- **不能替代交点机制。** EARS 是逐条的，两条各自合规的需求在交点上打架它看不见；本仓库已有的 `tension` 字段与「有红线的交点没认领是硬失败」继续负责。
- **不能自动分辨「可判定」。** 词汇表只能保证「每个术语有人写了 oracle」，写的 oracle 是不是真可判定仍要人看。
- **不能挡住全部实现泄漏。** 复用 `why-rule.ts` 只挡得住代码运算符与内部命名惯例；「用 Redis 缓存」这种自然语言里的实现方式挡不住，靠评审。

### 形式化验证能解决什么

- **在一个明确的假设集合下，穷举一个有限模型在界内的全部行为。** 对 P3 这种「状态变量十来个、事件八九个、每个转移处都可能崩溃」的对象，人工枚举交错会漏（ADR-38、ADR-41 与 ADR-47 前两条记的都是漏掉的交错；ADR-45 记的是三步协议建立在没被保证的前提上），有界模型检查在界内不会漏 —— 只要模型忠实。
- **把「我以为已经保证了」变成显式假设清单。** ADR-47 的标题就是这句话。形式化的第一个产物不是证明，是 Assumptions / Guarantees / Unknowns / Out of scope 四栏；本仓库今天这四栏散落在注释与 ADR 里（#75 的 `IMPLEMENTATION-MAP.md` 第一次把它们集中起来，但不可机器读）。
- **生成反例。** 模型检查最有价值的输出是反例轨迹，不是 ✓。反例可以直接转成回归测试与变异（D 节给出三条本仓库真实存在、本次实跑复现的反例）。

### 形式化验证不能解决什么

- **不能证明环境。** TikHub 的真实计费规则、响应结构是否稳定、邮箱是否真实、粉丝是否在目标市场、产品页是否语义蕴含某句英文 —— 这些是假设，不是结论。证明的形状永远是「若 A 则 B」，A 由运行时契约与人工核对守着。
- **不能证明模型忠实于代码。** 模型是第二份实现。模型与代码的一致性只能靠对拍（模型式测试、trace validation）—— 那是测试，不是证明。
- **不能抓同源污染。** Agent 写模型时把实现镜像成模型，不变量恒真、动作与代码一一照抄，检查会全绿。`4-VERIFY.md` 对测试说的那句话对模型同样成立：**独立上下文复核是唯一对策**，而且（本文比 `4-VERIFY.md` 多加一句）同一模型家族的两个会话满足上下文隔离、不满足先验独立 —— 红线上的复核至少一方要有不同来源。
- **不值得铺满全系统。** 语义匹配、开发信写法、关键词策略这些判断类工作没有可枚举的状态空间；对它们做形式化是把力气花在证明「格式对」上。

### 控制论能解决什么

- **给「自演化」一个能被审查的结构。** 目标、传感器、状态估计、控制变量、扰动、噪声、迟滞、冷却、熔断 —— 每一项都要显式写出「是什么、在哪读、谁能改」。写不出来的那一项就是今天闭不上的那一段回路。
- **识别不可观测。** 把「未查询 / 已查无 / 已查有 / 查询失败」压成 `null`，控制器就无法从输出推断状态；这在数据建模里叫 P1，在控制论里叫可观测性丧失。两个视角指向同一个修法。
- **识别不可控与振荡。** 回复率掉了，能改的只有文案，那就不能假设改文案能把它拉回来；对短期噪声频繁改规则会振荡。对策（最小观察窗口、迟滞、冷却期、单变量实验、对照）都是可以写成数字与检查的东西 —— 但数字要算过（G 节算了一次，结论并不乐观）。

### 控制论不能解决什么

- **不能提供因果。** 相关不是因果，它只能告诉你需要实验设计。
- **不能替人定目标与红线。** 参考目标是输入，不是输出。
- **不能凭空闭合今天开着的回路。** 本产品最重要的反馈量（回复、合作）按 S3 不主动索取，`replied` 由外部手写且没有任何读者 —— 这条回路今天是开路。控制论只能把这件事说清楚。

三者共同做不到的事集中在 I 节，不在这里重复。

## B. 当前系统差距

先说这套体系已经做对的事，免得下面的清单读成「一无是处」：需求有机器可读正本与派生指纹；判据拆到可独立计量并有运行时认领；红线不许作废、必须有测试 + 变异，机器守着；226 条变异（`cc132a7`；#81 合入后 229）且「进程崩了不算抓到」；三态原则贯穿类型与报告；顺序契约用变异守；检查链自己也是被检查对象；一条形式化试点 PR（#75）已经把 P3 的协议建成了可穷举的模型。**本文的每一步都建立在这些之上，没有一步要求推倒。**

差距按「离可信自演化闭环还差什么」列。每条给风险、证据、机器可查、需人工；「需人工」的裁决点汇总在附录一，每条指到 H 的哪一步。

| # | 差距 | 风险 | 证据 | 机器可查 | 需人工 |
|---|---|---|---|---|---|
| B1 | **判据的可判定性不均匀。** P3.a 是一个例子（limit=0.005、10 次），不表达不变量；约九条判据是文档存在性或人工判断（S2.a、S2.b、S3.a、S3.b、S5.a、F1.a、F3.b、F4.b、P2.a），其中 S1.a、S4.a 这类其实可用 `source_grep` / 类型断言机械判定，只是今天没有测试；U6.c 是浏览器行为；F2.b「有明确权重」无定义。整个 S 类没有任何 `suite()` | 「可判定」四条要求在不同判据上落实程度差三个量级；EARS 化时这些判据会暴露为「不可失败」或「无 oracle」 | `requirements.json`；registry track 的分类；`grep suite(` 结果 | partly | 是 |
| B2 | **P3 的「确认」没有定义，两个入口行为不同。** `collect --resume --budget abc` → NaN → 闸门永不拒绝（实跑：请求数 2 → 17，exit 0，提醒 0 条，stderr 只打出「预算 $NaN」）；NaN 落盘成 `null`，下次续跑 `TypeError` exit 1；`enrich` 有 `isFinite` 校验；`loadTask` 不校验 `budget_usd / requests` 类型，`requests: "4"` 让下一次计数变成 `"41"`（#75 自述，本次未复跑） | 输错一个参数得到无上限采集；退出码契约被破坏 | `collect.ts:59-60` vs `enrich.ts:66-72`；`task.ts:27-29`；scratchpad `p3/e2e-a` 实跑 | yes | 修法明确（#75 的 `budgetProblem / ledgerProblem`）；「Infinity 算不算确认」「低于已花的 --budget 是想立刻停还是输错」要人定 |
| B3 | **P3 的跨进程窗口。** `enrichProfiles()` 循环内不 persist；SIGKILL 于第 2 个 profile 请求时盘上 12、实际 14；续跑后盘上 15、实际 17 | 「不超出」只对盘上计数成立；最坏落后 = `needsProfile` 人数 | `collect.ts:205-229`；`p3/e2e-c` 实跑；#75 的 `SpendIsRecorded` 5 步反例 | yes（崩溃注入） | 「崩溃时该怎样」登记表没决定（ADR-68 欠条）—— 人批 |
| B4 | **浮点误拒。** 10 万个 $0.001 步进 limit 中 26,410 个少放行一次、0 个多放行（实跑）；fast-check shrink 到最小误拒 limit 0.009；Z3 FloatingPoint 证明 `m < 9` 无误拒、`[1,2000]` 无多放行；P3.a 的 0.005 恰好测不到；续跑初始化同样受影响（`new Budget(0.010, 9).charge()` 直接抛） | 不违反「不超出」；违反「付得起不该拒」，而后者今天没有判据；`remaining` 与 `affordable` 自相矛盾 | `budget.ts:36`；`p3/scan.ts`；tools-hands-on | yes | 「算不算缺陷」要人定 |
| B5 | **默认预算 $2 静默。** `cfg.budget_usd ?? 2` 无告知；CONVENTIONS §7 与 SKILL.md 都要求「明确告知这是假设值」；SKILL 没有 task.json 字段契约 | 与自己的约定不一致；F1 失守时用户不知情花到 $2 | `collect.ts:72`；`CONVENTIONS.md:105-110` | partly | 是（保留告知 vs 删默认） |
| B6 | **观测三态靠约定，「查询失败」与「未查询」同态。** profile 请求失败（404 / 5xx / 网络 / **402**）一律 `bio: undefined`；402 在 profile 阶段被吞成 `profile_failed`，exit 0；429 耗尽在 `run()` 里 exit 1、在 `enrichProfiles` 里被吞；`bio_links` 二态导致有简介无外链者每次续跑重查（付费；测试断言为预期行为） | 续跑成本线性增长；402 用户不知情；同一状态在两个阶段命运不同；Creator 层没有 Unavailable(reason) | `collect.ts:219-225`；`pipeline.ts:78`；observation track 实跑 | yes | 是（重试策略归谁；`bio_links` 的未查询态怎么表达） |
| B7 | **外部响应与四个落盘 JSON 无运行时形状校验。** `followerCount:"12K"` 进 number 字段 → 粉丝闸门静默丢弃；只有 memory 文件有校验；`is_private` 缺失被 `Boolean()` 压成 false；报告层 `report.ts:129` 把 email `undefined` 显示成「无邮箱」 | P1 被绕过且不可见；报告把三档压两档 | observation probe D 实跑；`tikhub.ts:281`、`report.ts:129` | yes | 否 |
| B8 | **P1 lint 只认字面量兜底。** `?? c.followers`（`collect.ts:215`）、`\|\| e.followers`（`memory.ts:410`）判 clean；16 处 `p1-ok` 中 9 处多余 | 「P1 唯一机器可执行的一半」的覆盖面被高估 | `lint-rule.ts:33`；observation probe A/B 实跑 | yes | `memory.ts:410` 算不算 P1.b 违规要裁定 |
| B9 | **状态处理无穷尽检查。** 主干 31 处 `status === 'measured' / 'unavailable'` 二分（其中 17 处是 `?.status`；observation track 的 probe 只数了其中 24 处），无 `never` 断言；未知 status 让 meta 三数不相加或抛 TypeError | 新增一个状态值时静默错 | observation probe E 实跑；`render.ts:54-59` | yes | 否 |
| B10 | **身份：查询侧照单全收、第三套键规则、歧义时仍合并。** 库里 `tiktok:alice` contacted，查 `alice `/`alice﻿` 静默漏过（P4 路径）；`identity.ts` 自拼键且 platform 按字面比较，`TikTok` 被路由进 instagram 桶；「同一个函数」没有检查守；`[tiktok:mei_cooks, tiktok:mei.cooks, instagram:meicooks]` 两个候选同时命中信号 3 时合并了第一个，配对随输入顺序变 | P4 静默失效的一扇门；D1.c 在去重那一半未实现；D3 的「不确定」没有定义 | identity track 与 tools-research 实跑；`memory.ts:339`；`identity.ts:30,55-61,92` | yes | 是（查询侧是否过 `keyProblem`；歧义是否算「不确定」） |
| B11 | **持久化：D4.i / D4.j 无运行时认领；「第二步成功、第三步前中断」未测；两写入方交错留下 ok + 未去重名单（实跑复现，已声明不保证）**；collect 断点保存与 enrich persist 会把旧 `memory_status` 原样写回，可在窗口内复活肯定断言 | 三步协议只靠未认领断言 + 两条变异 | memory track threestep.ts 实跑；`collect.ts:128-133`、`enrich.ts:125-129` | partly | 是（写入方并行是否允许） |
| B12 | **P2：三条输出路径今天都原样保留占位符（实跑），但 XLSX 路径没有测试也没有变异（`test.ts:2499-2523` 只验 sheet 名），HTML 有测试无变异；产品页事实不落盘，没有 claim / evidence 结构** | 在 `xlsx.ts` 的 `esc` 里抹 `{}`，现有测试全绿（读代码推断）；事后连人工核对都没有材料 | claims track p2-paths.ts 实跑；`test.ts:2499-2523` | yes（前半）/ no（后半） | 是 |
| B13 | **测试与实现同源（ADR-04）；无属性测试设施；变异集是手写负片。** 审计只要求红线**需求级**有变异，判据级变异不被要求也不计入；claims 里的判据编号不与登记表比对；退役判据编号可被重新加入（实测 `P4.d` 通过校验） | 「每条红线判据有测试且有变异」的实际口径比文档弱；编号不回收只靠 ADR-67 散文 | registry track 实跑；`audit.ts:117,143`；`claims.ts:83-88` | yes | 否 |
| B14 | **模型层只有一条未合入的 PR。** 顺序契约有变异守，但崩溃交错在主干上只有例子测试；#75 的模型是唯一穷举交错的检查，且它自己合不进去（H 第 0 步） | ADR-38 / 41 / 47 记的漏掉的交错今后还会再漏 | ARCHITECTURE 顺序契约表；`test.ts:792-825`；PR #75 | yes | 否 |
| B15 | **环境假设无机器可读的登记处。** 单价上限、非 200 不计费、rename 原子性、fsync 尽力而为散落在注释与 ADR-50；#75 的 `IMPLEMENTATION-MAP.md` 集中了它们但不可机器读；「非 200 不计费」「in-flight 是否计费」未验证；`probe` 的花销不进任何账 | 「描述保证的那句话没有任何检查看着」（CONVENTIONS §11）；假设失效时没有东西让结论降级 | `budget.ts:1`、`tikhub.ts:90`、`atomic.ts:35-37`；ADR-68 | partly | 是 |
| B16 | **反馈回路开路。** `replied` 没有任何读者；回复率 / 邮箱有效率 / 草稿改动率无入口；U3 关键词表把「0 结果 / 请求失败 / 未跑」坍缩成「无此行」，`found` 是过滤后计数且随轮转顺序变，`fit_pass` 由 Agent 判定；`output-format.md:104` 把这张表定为「下次调整策略的依据」—— 这句话本身就是传感器与控制器同源的回路 | 以业务效果为目标的自演化没有传感器；唯一的自我改进依据噪声大且同源 | sensors track：`memory.ts:341,407`；`pipeline.ts:204-213`；`collect.ts:165-166` | partly | 是（要不要建传感器是产品决策） |
| B17 | **无版本指纹、无扰动计数。** `meta.json` 没有代码 / 配置 / schema 版本；429、schema 未识别、IG 回退都不计数不落盘；`profile_failed` 只在 stdout 不进 meta | 两次任务的差异无法归因；扰动不可察觉 | `render.ts:90-141`；`tikhub.ts:96-100,294` | yes | ADR-13「不引版本号」是否冲突要人定 |
| B18 | **治理只有第三层。** 「红线改动必须独立复核」在仓库里看不到配置；`main` `protected: true` 但规则内容查不到（403）；PR #78 改守红线的检查链、零条正式 review、作者自合；仓库只有一个人类身份；七种豁免全部自批，且只有 `p1-ok / size-ok / age-ok` 三种校验「理由非空」；`process/` 无任何检查读 | 「必须人批」在今天全部靠自觉，且没有第二个人 | governance track（GitHub API 只读核实）；`4-VERIFY.md:235` | partly | 是 |
| B19 | **需求 → 证明的追踪缺位。** 登记表没有「这条判据由哪个模型 / 性质 / 监控守」的信息；审计只数测试认领与变异 | 形式化产物落地后会成为「没人读又校验不了」的东西（ADR-17 的形状） | `requirements.json` 字段集 | yes（一旦有字段并派生） | 否 |
| B20 | **文档副本漂移。** `PR_SIGNALS` 代码正则 ≠ 文档；tier fallback 60/40 无文档；429 退避的文档口径（150 → 300ms）与代码（翻倍封顶 1000 + 额外倍数）不同；粉丝上下限「算不算改需求」两份文档矛盾；SKILL「profile 补全跑在续跑最前面」≠ 代码顺序；README 手写「35 条需求 / 5 条红线」、AGENTS 手写「共 5 条」无检查守；`mutations.json` 的 `exemptions[].mitigation` 没有任何代码读 | SYNC 表靠人执行的那些行在漂 | sensors / p3 / registry track 的对照；`mutate.ts:29` | partly | 是 |
| B21 | **IG profile 的两级端点让一次逻辑请求最多 8 次提交、1 次计数。** `tikhub.ts:260-261` 的 catch 只排除 402：V3 抛 `BudgetExceeded` 时仍走 V2 再 charge 一次；V3 连续 429 打满后降到 V2 再打 4 次（本次会话复核实跑） | 若「非 200 不计费」为假，这里是 8 次计费 1 次计数；模型的重试上限要把两级端点算进去（#75 的模型没有） | `tikhub.ts:257-264`；ADR-68 第四张欠条 | yes | 否 |
| B22 | **F7 的提醒集合只在内存。** `notified` 不落盘（`budget.ts:18`），续跑新建实例后已跨过的阈值再触发一次：`new Budget(0.020, 18).charge()` 同时打出 50% 与 80%（本次会话复核实跑） | F7.a「一次」是每进程一次还是每任务一次没有定义；按任务算则与 D6.a 有交点而登记表没有 | ADR-68 第二张欠条 | yes | 是 |

### 哪些需求值得形式化，哪些只适合测试或人工（第 7 问）

分级的判据只有三条，全部可以对着登记表逐条问：

1. **有没有可枚举的状态空间？** 状态变量少、事件少、但交错多（崩溃、并发、重入）→ 值得模型检查。
2. **是不是「对所有输入 X 永不出现」的形状？** → 值得属性测试；纯函数尤其如此。
3. **结论是否由自然语言语义决定？** → 只能人工，机器只守它的结构外壳。

| 需求 | 级别 | 理由 | 今天的守法 |
|---|---|---|---|
| **P3** 预算 | **模型检查 + 属性 + 例子** | 状态少、事件少、崩溃与重入交错多、数值边界明确、违反不可逆 | 例子测试 P3.a、变异 M-P3-a；P3.b 靠 selfcheck 真跑（`mutations.json` 显式豁免，理由引 ADR-13）；#75 的模型（未合入） |
| **D6** 断点续跑 | **模型检查**（与 P3 同一个模型；试点内**建模不裁决**） | 它就是 P3 模型的另一半：`persist` 点、`resume` 初始化 | 例子测试；#75 的 `ResumeKeepsCount` |
| **F7** 阈值提醒 | **例子**；「一次」的定义待评定 | 状态太小；但 B22 说明它与 D6 有未登记的交点 | 例子 + 变异 M-F7-a |
| **P1** 三态 | **类型结构 + 属性 + lint** | 「Unqueried ≠ MeasuredAbsent」是结构性质；不需要模型检查 | undefined/null 约定 + P1 lint + 21 条 `req: P1` 变异 |
| **P4 / D4** 记忆 | **崩溃点穷举（单写入方）+ 属性（过滤）+ 例子；并发成为需求时再模型检查** | 三步协议与原子写是交错问题（ADR-38 / 41 记的都是漏掉的交错）；`filterByMemory` 是「对所有 contacted / blocked 永不出现在 kept」的属性 | 例子测试 + 变异 M-P4-a 等；并发明写不保证（ADR-66） |
| **D1 / D3** 身份 | **属性**（幂等、等价关系两侧同函数、不合并的安全方向、歧义不合并） | 纯函数；输入空间大（Unicode）；不需要状态机 | 例子测试 + 变异 M-D3-a |
| **P2** 产品事实 | **结构契约（引用完整性）+ 人工语义复核** | 蕴含关系无裁决器（ADR-01） | P2.b 变异 M-P2-a；P2.a 第三层 |
| **P5** 数据边界声明 | **例子 + 变异**；不值得模型 | 声明的存在性是布尔，穷举没有意义 | 变异 M-P5-a…l（12 条） |
| **D5** CSV 转义 | **属性**（round-trip） | 纯函数 | 例子 + 变异 M-D5-a |
| **D7** 邮箱提取 | **属性 + 例子** | 正则；负例空间无限，属性只能采样 | 例子 + 变异 M-D7-a |
| **D8 / D9 / D10** 公开指标 | **例子 + 属性（样本量门槛、缺失不按 0）** | 聚合是纯函数 | 例子测试 |
| **F6 / F8** 分层否决与降级 | **属性** | 纯函数 | 例子 + 变异 M-F6-a、M-F8-a |
| **U1 / U5 / U6** 输出结构 | **例子 + 变异** | 渲染结构，不是性质 | 已有 |
| **S1–S5** 范围 | **`source_grep` / 类型断言 / 人工** | 「不存在 SMTP 调用」是 grep 级；「无对应模块」是人工 | 无 suite |
| **F1 / F3 / F4.b / S2.a** Skill 文档条款 | **`file_text` oracle 或人工** | 判据本身是「文档里写着」 | 字符串存在性 |
| **F2 / F5** | **例子** | 类型穷举与降级路径 | 已有 |

**不值得形式化的（明确说出来，免得被要求「一视同仁」）：** 全部 U 类、S 类、F1–F4；D8–D10 的聚合算法本身（只值得属性）。把重型方法用在它们上面，证明的是格式对，不是产品对。

### EARS 义务 → 各层守法的映射规则（第 6 问的通用部分）

一条子句 `while S, when T, if C, shall R, shall_not R'`，映射按下面的表；D.10 对 P3 逐条实例化，含函数契约（前置 / 后置）那一层。

| 目标层 | 从 EARS 哪一格来 | 形状 | 什么时候值得做 |
|---|---|---|---|
| **类型约束** | `while` 的状态集合；`shall_not` 里「不得表示为」的东西 | 状态是 discriminated union；非法状态不可构造（品牌类型、唯一构造函数） | 状态可枚举、且错误表示会静默传播时（P1、P3 的 limit） |
| **状态机** | `when` 是事件；`while` 是源状态；`shall` 是目标状态与副作用 | 每个事件一行：前置、副作用顺序、后置 | 有崩溃 / 重入 / 并发交错时 |
| **不变量** | `shall_not` 与 ubiquitous 句型 | 对所有可达状态成立的谓词 | 状态机存在时必配 |
| **前置 / 后置条件** | `if` 是前置；`shall` + `outcome` 是后置；unwanted 句型是异常后置 | 函数契约（运行时 assert 或注释 + 测试） | 每个公开函数 |
| **属性测试** | `shall_not`（永不出现）、`shall` 里的等式 / 单调性 | `∀ input ∈ Gen: ¬R'(f(input))` | 输入空间大、纯函数 |
| **普通验收测试** | `examples[]` | 例子 | 永远至少一条（例子是可读的规格说明） |
| **变异测试** | 每条 `shall` 一个「不做 R」的变异；每条 `shall_not` 一个「做了 R'」的变异 | `mutations.json` 条目，`why` 用 EARS 原句 | 红线必配（现行规则） |
| **运行时监控** | `outcome` 那一格：读哪个文件字段、退出码、stderr 行 | 运行时断言 + 落盘的计数 / 状态；失效形态显式 | 义务依赖环境假设时必配 |
| **模型检查** | 整条子句 | 状态机 + 不变量 + 时序性质 | 分级表里「模型检查」那一档 |

## C. EARS 数据模型提案

本节的形状来自本次会话三份独立起草的设计（「形式化优先」「兼容优先」「可审计优先」各一份，其中两份的原型目录保留在 scratchpad：`ears-rule.ts` 过 `tsc --strict`，JSON Schema 用 ajv 对现行登记表验证为 0 错，退役编号重加被拒 —— **实跑**），再经一位独立评审合成、由本文改写。三份在「放哪」上结论相同，在字段粒度上有分歧，分歧点在 C.8 交人。

### C.0 登记表今天的事实（实跑）

给 `requirements.json` 的需求或判据加一个未知字段（比如 `ears`）：`validateRegistry` 0 问题、`rootProblems` 0 问题、`renderTables` 输出与基线逐字相同、`spec-sync --write` 整体重写时未知字段与键序原样保留 —— 但 `content_hash` 会变（需求与判据上的任何字段都自动进指纹），所以要跑一次 `--write`。根对象上的新键（`terms`、`retired_ids`）**不进指纹、不校验、不渲染**。其余消费者（audit / mutate / arch-sync）只读 `id` 与 `accept[].id`，不受影响。`validateRegistry` 在形状有问题时提前返回，关系问题会被形状问题盖住。

两个推论：**判据级字段零成本进现有指纹，但与 `text` 改动在指纹上不可区分**（F 节要的「义务指纹」要另算）；**根级词汇表要改一行 `contentHash` 的输入**。

### C.1 三种放法的比较（第 2 问）

| 方案 | 做法 | 优点 | 代价 | 结论 |
|---|---|---|---|---|
| A. EARS 作为主需求 `text` | 把 `text` 改写成 EARS 句 | 一处真相 | 改 `text` = 改需求含义，35 条全部走变更评定；一条需求多义务塞不进一句；`text` 按 `1-REQUIREMENTS.md` 是「一句话说清要什么」，不是行为规格；ADR-67 已把「不保证」的范围边界放回 `text`，EARS 没有这个槽位 | 否 |
| B. EARS 替换判据 `accept[].text` | 每条判据改写 | 计量单位不变 | 判据 id「不改含义」的规矩下，改写等于退役 + 新编号，99 条判据全部换号；约十条文档存在性 / 人工判据写成 shall 就是 ADR-67 说的「不可失败判据」；仍是句子，`safely handle` 一样过形状检查 | 否 |
| C1. 需求级并列数组 `behaviors[]` 反指判据 | 不碰判据对象 | 字面上不动 `accept` | 认领单位是判据 id；子句没有 id 就没法认领，另发一套编号就是「两侧各写一遍」（ADR-22） | 否（若 ADR-67 那句被裁定不可推翻，退回此方案） |
| **C2. 挂在每条判据下 `accept[].ears`** | 判据 `text` 一字不动，旁边挂结构 | 编号、认领、变异、指纹全部兼容（原型实跑：注入后校验 0 问题、渲染相同）；可以一条一条迁；没 EARS 的判据按旧规则计量 | **直接撞 ADR-67:25-27**（见下）；`text` 与 `ears` 两处描述会漂 | **建议采用（待 ADR，J10）** |

**ADR-67 那句话必须直面，不能绕。** 原文：「`accept` 的形状不动，不新增字段：『不保证』在 D4 的正文里本来就有先例，再加一栏只会让同一类内容有两个去处。」它拒的是**同一类散文**再开一栏。如果 `ears` 落地时没有任何消费者，它就恰恰是「同一句话两种写法」。所以本文把「有消费者」写成落地的**硬条件**（C.6）：`ears` 与它的三个消费者（形状与关系校验、SPEC 派生渲染、审计的「靠什么验」派生列）必须同一条 PR 合入；没有消费者的字段不进登记表。并且写明终态：**`text` 将来由 `ears` 派生**（`renderClause`），两处描述收口成一处 —— 这是对 ADR-67「两个去处」的正面回答，写进推翻它的那条 ADR。

补一条：**业务意图层**就是今天需求的 `text`（「已联系或已屏蔽的创作者不得再次进入名单」），不动；**EARS 行为判据层**挂在判据下。

### C.2 数据模型

```ts
// ── 根级新键（都不进现有指纹，要把它们加进 contentHash 的输入）──
interface EarsRoot {
  terms?: Record<string, Term>        // 词汇表，键形 ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$，如 'budget.paid_request'
  retired_ids?: string[]              // 退役的判据 id 与子句 id；现行 id 命中即红（补 ADR-67 只活在散文里的那份清单）
  ears_policy?: { require: 'none' | 'redline' | 'all' }   // 迁移闸：哪些判据必须有 ears（或显式 none）
}

// ── 词汇表 ──
type TermKind = 'state' | 'event' | 'condition' | 'response' | 'outcome' | 'feature' | 'quantity'

type Oracle =
  | { kind: 'invoke';      entry?: string; module?: string; export?: string; with?: Record<string, Literal> }  // event：怎么触发
  | { kind: 'call';        module: string; export: string; expect: 'returns' | 'throws' | 'unchanged'; error_name?: string }
  | { kind: 'exit_code';   entry: string; codes: number[] }
  | { kind: 'stdout_json'; entry: string; pointer: string }             // JSON Pointer
  | { kind: 'stderr_match';entry: string; pattern: string }
  | { kind: 'file_json';   path: string; pointer: string }
  | { kind: 'file_text';   path: string; contains?: string; matches?: string }
  | { kind: 'source_grep'; glob: string; pattern: string; expect: 'absent' | 'present' }   // S1.a 这类
  | { kind: 'call_count';  of: string }                                   // 「没有发出请求」这类
  | { kind: 'fixture';     harness: 'selfcheck' | 'fake-fetch' | 'crash-inject'; label: string }  // 只有夹具能观测的量
  | { kind: 'model';       why: string }                                  // 只在模型里存在（ghost / 模型专有状态）
  | { kind: 'human';       who: string; mitigation: string }              // 显式：只能靠人
  | { kind: 'none';        why: string }                                  // 显式：尚未决定怎么观察

interface Term {
  kind: TermKind
  def: string              // 人话定义；过 implementationLeak（why-rule.ts）
  params?: string[]        // 可带参数的术语（如 cost）
  oracle: Oracle[]         // 至少一个；event 只允许 invoke，其余只允许观测类
  since: string            // 首次登记；含义变了换 id，旧 id 进 retired_ids
}

// ── 判据下的子句 ──
type Literal = string | number | boolean | null
type TermRef = string | { term: string; given?: Record<string, Literal> }          // given：术语参数绑定
type OutcomeRef = string | { term: string; expect?: Literal | Literal[] }          // expect：观测到的值必须等于 / 属于

interface EarsClause {
  id: string               // `{判据编号}/{正整数}`，如 'P3.a/1'；稳定、不回收（判据正则 ^{req}\.[a-z]+$ 排除了它，不撞）
  while?: TermRef[]        // 全部成立 → 术语 kind 必须是 state
  when?: TermRef           // 只能一个 → event
  if?: TermRef[]           // 全部成立 → condition（EARS 的 unwanted / 异常；与 when 同现时是 guard）
  where?: TermRef[]        // → feature
  unless?: TermRef[]       // 例外：任一成立则本子句不适用 → condition | state
  shall?: TermRef[]        // 义务响应 → response
  shall_not?: TermRef[]    // 禁止响应 → response
  outcome?: OutcomeRef[]   // 响应之后必须成立的可观测结果 → outcome | state | quantity；expect 装期望值
  examples?: Record<string, Literal>[]   // 边界绑定（cost=0、spent==limit…），测试应使用；不参与计量
  boundary_of?: string     // 本子句是与哪条需求交点上的让步边界；登记表里必须有对应 tension
  note?: string            // 唯一的自由文本；过 implementationLeak；点名的 ADR 必须在 adr[]
}
interface EarsNone { verify: 'human' | 'unmeasured'; why: string; held_by?: string }
type Ears = { clauses: EarsClause[] } | { none: EarsNone }

interface Criterion { id: string; text: string; ears?: Ears }   // 只加可选字段；test.ts 的 req() 助手与 selfcheck 的 fixture 不受影响（原型 typecheck 通过）

// ── 证据等级（沿用 PR #75 formal/README.md 的词表，写进本文以便不依赖 #75 合入）──
type Level =
  | 'PROVED_IMPLEMENTATION'   // 实际实现经机器证明（本仓库今天一条都没有）
  | 'MODEL_CHECKED'           // 有界模型的全部可达状态被检查，且对拍到实现
  | 'MODEL_ONLY'              // 只检查了抽象模型，没有连回实现
  | 'PROPERTY_TESTED'         // 用生成的输入把实现（或模型与实现）对照过
  | 'UNIT_TESTED'             // 只有固定样例
  | 'ASSUMED'                 // 靠环境或人的假设
  | 'EMPIRICAL'               // 只能由真实数据评估

// 覆盖记录（.check-cache/test-claims.json，claims.ts 的 CLAIM_LISTS 是为加字段设计的扩展点）新增一栏：
interface ClaimsLevels { levels: Record<string /* 判据 id 或子句 id */, Level> }
// 由检查自己写：test.ts 写 UNIT_TESTED / PROPERTY_TESTED；formal.ts 写 MODEL_CHECKED / MODEL_ONLY；
// 假设登记表里被引用且状态为「未验证」的性质，审计把它读作 ASSUMED（不写入，派生）。
// 没有「目标等级」字段：审计只报「达到的等级」，红线判据达到 UNIT_TESTED 以下或 ASSUMED 的单列。
```

**故意不存的东西（要么派生要么删，`1-REQUIREMENTS.md`）：** 句型（`ubiquitous | event | state | unwanted | optional | complex`）由 `earsType(clause)` 从字段推出，不存 `kind` 字段；「这条子句由什么验」由 `verifierOf(clause, terms)` 从 oracle 推出（`exit_code` / `stdout_json` / `fixture` → selfcheck，`call` → test，`source_grep` / `file_text` → lint，`human` → 人工）；达到的证据等级由检查写进覆盖记录，不手填；期望等级不存。范围边界（「不保证」）回 `text`（ADR-67 原裁决）。

**「一条判据多个独立义务」的处理：** 多个能被不同代码路径独立弄坏的义务 = 多条判据（ADR-24 的规矩不变，机器判不了路径，靠人）；一条判据下的多条子句是**同一路径**的边界枚举（cost = 0、spent == limit、limit 未确认……）。

### C.3 各成分怎么表示（第 5 问）

| EARS 成分 | 字段 | 术语 kind | P3 例（术语表在 D.2） |
|---|---|---|---|
| trigger | `when` | `event` | `budget.request_proposed` |
| state | `while` | `state` | `task.running`、`task.resumable` |
| condition / exception（与 `when` 同现时是 guard） | `if` | `condition` | `budget.cost_exceeds_limit`、`budget.limit_unparseable` |
| feature enabled | `where` | `feature` | P4 的 `--ignore-memory` 开关（不在 D.2 的 P3 子集里） |
| response | `shall` | `response` | `budget.raise_exceeded` |
| prohibited response | `shall_not` | `response` | `provider.emit_request`、`budget.change_count` |
| observable outcome（含期望值） | `outcome` | `outcome` / `quantity` | `{ term: 'process.exit_code', expect: 3 }` |
| 例外 | `unless` | `condition` / `state` | `memory.unreadable`（P3 × D4 交点登记后才可用，J9） |
| 「不保证 / 不裁决」 | —（回 `text`） | — | 「并发时本条不保证」写在需求正文 |
| 「保证了但机器观测不到」 | `ears: { none: { verify: 'human' } }` | — | P2.a |
| 「决定了但本仓库测不了」 | `ears: { none: { verify: 'unmeasured' } }` | — | U6.c（浏览器行为） |
| 「还没决定怎么观察」的术语 | 术语的 `oracle: [{ kind: 'none' }]` | — | 审计单列，红线不许 |

「unknown」在这里有三个落处，分工是：**说的是范围** → 需求正文；**说的是这条判据** → `ears.none`；**说的是某个术语** → `oracle: none`。三者审计里都单列，都不算完整也不算缺口。

### C.4 校验规则（全部进 `spec-rule.ts` 或新拆的 `ears-rule.ts`，每条配测试 + 一条变异，按 ADR-33 的规矩续编 `M-H4-l` 起）

| # | 规则 | 挡住什么 | 原型是否已实现（实跑） |
|---|---|---|---|
| R1 | 字段决定句型：`when` 至多一个；`if` 与 `when` 可同现（guard）；四者皆无即 ubiquitous；`shall` / `shall_not` 至少一个非空 | 句式假装 | 是 |
| R2 | 每个 `TermRef` / `OutcomeRef` 必须在 `terms` 里存在，且 kind 与槽位匹配（`while` 只收 state…） | 「unavailable」「safely」这种没定义的词 | 是 |
| R3 | 每个术语 `oracle` 非空；`event` 只能 `invoke`，其余只能观测类；`human` / `none` / `model` 必须带理由 | 空 oracle | 是 |
| R4 | `def` 与 `note` 过 `implementationLeak`；`note` 点名的 ADR 必须在 `adr[]` | 实现泄漏（只挡机械的那一半） | 是 |
| R5 | 子句 id 形状 `{判据}/{n}`，同判据内唯一；`retired_ids` 里的任何 id 不得在现行表出现 | 编号回收 | 是 |
| R6 | 红线判据：`ears_policy.require ≥ redline` 时必须有 `ears`；`none` 的红线判据必须同时出现在 `mutations.json` 的 `exemptions` | 红线义务全靠人判而不登记 | 是 |
| R7 | `terms` / `retired_ids` / `ears_policy` 进 `content_hash` | 改词汇表不回写指纹 | 需改 `contentHash` 输入一行 |
| R8 | 孤儿术语（没有任何子句引用）：`require = none` 时**警告**，`≥ redline` 时红 | 词汇表长成第二份需求；迁移期先装术语后挂子句不能因此红 | 原型是红；本文改成分级 |
| R9 | `boundary_of` 指向的需求必须在本需求的 `tension[].with` 里 | 交点边界与交点声明脱节 | 是 |
| R10 | `shall` 里出现「and / 且 / 并 / 同时」→ **警告**不失败 | 一句藏两义务（ADR-24 的判据是代码路径，机器判不了） | 否（提议，排在 C.6 第 2 步之后按需） |
| R11 | 验证者与 oracle 种类交叉校验：`exit_code` / `stdout_json` / `fixture` 这类只有真跑入口才观测得到的 oracle，不得由 `test.ts` 单元测试认领（只能 selfcheck 或 ADR-70 的 `by`） | 在单元测试里伪造入口认领（ADR-24 明确禁止的做法） | 是（随 C.6 第 2 步落地） |

**「句式合规但不可判定」的机器识别（第 4 问）**只靠 R2 + R3 + R6：不可判定的词进不了词汇表；进了就得写 oracle；写成 `human` / `none` 的会在审计里单列并对红线施压。三个坏例：

- `When memory is unavailable, the system shall safely handle the error.` → `unavailable` 不在 `terms`（R2 红）；就算登记，`def` 必须写「ENOENT 之外的任何读失败、解析失败、结构不对、键撞」并给 `oracle: [{kind:'call', module:'lib/memory', export:'readMemory', expect:'returns'}]`；`safely handle` 写不出 `response` 术语（R2 红）。
- `The system shall respond reasonably fast.` → `reasonably fast` 无术语；登记就得写数字与 oracle。
- `The system shall appropriately deduplicate.` → `appropriately` 无术语；`deduplicate` 若登记，oracle 必须指向 `creatorKey` 与 `filterByMemory` 的可观察输出。

三条实跑得出的边界，写在规则旁边免得被高估：

- **R4 只能套在词汇表的 `def` 与子句的 `note` 上，不能套在现有判据 `text` 上**：对现有 99 条判据文本跑 `implementationLeak`，今天就有 5 条会红（P1.b 的 `??`、P4.a 的 `filterBy`、D2.a 的 `bioLi`、F6.a / F8.c 的 `tierOf`）。代码名字的去处是 oracle，不是 `text`。
- **含糊词表（「safely」「合理」「适当」…）对现有 99 条判据命中 0 条**：一个在存量上从不红的检查，只对新写的术语有约束；不能拿它当「可判定性」的保证。
- JSON Schema 用 ajv 2020-12 strict 模式编译时，「某类术语不得有 oracle」这类约束不能写成 `then: { not: { required } }`（strictRequired 拒绝），要写成 `properties: { oracle: false }`。

机器**做不到**的：判断一个写了 oracle 的术语是否真可判定（oracle 写成 `human` + 一句空话）；判断 oracle 说的「大于」是大于**什么** —— 谓词留在术语 `def` 里靠人（I 节）。

### C.5 P3 的完整示例（术语 id 以 D.2 的术语表为准）

```json
{
  "id": "P3", "cat": "P", "pri": "P0",
  "text": "未经用户确认不得超出预算上限。",
  "accept": [
    {
      "id": "P3.a",
      "text": "Budget.charge() 在 spent + 本次开销 > limit 时抛 BudgetExceeded 且不增加计数；给定 limit=0.005 与 10 次请求，实际发出的请求不超过 5 次。",
      "ears": { "clauses": [
        { "id": "P3.a/1",
          "when": "budget.request_proposed",
          "if": ["budget.cost_exceeds_limit"],
          "shall": ["budget.raise_exceeded"],
          "shall_not": ["provider.emit_request", "budget.change_count", "budget.notify_threshold"],
          "outcome": ["budget.count_unchanged"],
          "examples": [ { "limit": 0.005, "count": 5, "cost": 1 } ] }
      ] }
    },
    {
      "id": "P3.b",
      "text": "collect 捕获 BudgetExceeded 后保存断点并以退出码 3 结束。",
      "ears": { "clauses": [
        { "id": "P3.b/1",
          "when": "budget.exceeded_caught",
          "shall": ["task.write_checkpoint"],
          "outcome": ["task_json.requests", "task_json.done", "task_json.offsets", { "term": "process.exit_code", "expect": 3 }] }
      ] }
    }
  ],
  "adr": ["ADR-03"]
}
```

`P3.b/1` 照字面写，**没有**例外槽：今天记忆读不出来时退的是 2（ADR-15 的裁决优先），所以这条子句在那条路径上与现状不符 —— 这正是 PR #75 的 ADR-68 第三张欠条说的「P3 × D4 交点未登记」。登记与否是 J9；登记后本子句加 `unless: ["memory.unreadable"]` 与 `boundary_of: "D4"`（R9 会核对 `tension` 里有没有 D4），**措辞由需求所有者定** —— 例外是放宽方向，F 节不许本文起草。

草案判据（D.2 的 P3.c–P3.f）用同一个形状；它们**不在示例里**，示例只展示现行判据加字段后的样子；草案用到的术语在 D.2 里标「草案术语」，随 H 第 3 步登记。

### C.6 迁移方式（第 1 问）

按 SYNC 表「增删登记表的字段」那一行（今天标为「✗ 靠执行」）逐项做，顺序按「最后一块砖」；下面五条就是 H 第 2 步的五条 PR：

1. **ADR 先行**（J10）：一条 ADR 直面 ADR-67:25-27，写明 `ears` 的三个消费者与「`text` 将来由 `ears` 派生」的终态。文档类，可单独先合。
2. **判定 + 消费者同一条 PR**：`ears-rule.ts`（类型 + R1–R9 + R11；从 `spec-rule.ts` 引用）+ `test.ts` 的 `harness` 断言 + `M-H4-l` 起的变异（每条规则至少一个：R2 的变异是「术语不存在也放行」）+ `renderTables` 在验收标准格里追加派生行 `⟨EARS⟩ …`（同步扩 `shapeProblems`，ADR-33：渲染读的字段必须校验）+ `audit` 的「靠什么验」派生列 + 覆盖记录的 `levels` 栏 + `contentHash` 输入加三个根键。此时登记表里还没有任何 `ears`，检查全绿。R10 之后按需。
3. **词汇表 + 退役清单**：`terms` **只放 P3.a / P3.b 两条子句用到的十三个术语**（D.2 表里未标「草案术语」的那些）；`retired_ids` 填 ADR-67 列的五个判据编号（P4.d、P5.e、D4.o、D1.a、P5.a）；`ears_policy.require = 'none'`（此时 R8 只警告）；`--write` 回写指纹。走 `2-CHANGE.md`：类型是「需求有歧义 → 补充」（不改任何一条需求要什么）—— **提议分类，评定者定**。
4. **给两条现行判据挂 `ears`**（P3.a、P3.b，如 C.5）。`text` 不动，认领不动，变异不动。**不挂 `unless` / `boundary_of`**，等 J9。
5. **`ears_policy.require` 升到 `'redline'`**：17 条红线判据每条必须有 `ears` 或显式 `none`（P2.a 是 `none`），R8 从此变红。这一步之前要把其余 15 条红线判据的子句写出来 —— 那是 15 次「改尺子」，每条过独立复核；产物之一是「写不出 oracle 的判据清单」（J46）。
6. 之后按 H 节的节奏一条需求一条需求地挂；**先红线，再 D 类，U/S/F 类最后甚至不做**（B 节分级表）。文档存在性类判据挂 `ears` 时 oracle 是 `source_grep` / `file_text`（S1.a、S2.a 这类其实可判定，只是今天没有测试）或 `none`（U6.c）—— 它们在审计里被单列，这是诚实不是缺陷。

### C.7 五对漂移通道与各自的守法（第 11 问）

| 通道 | 漂移怎么发生 | 守法 | 层 |
|---|---|---|---|
| 需求 `text` ↔ `ears` | 改了一处忘另一处 | 终态由 `ears` 派生 `text`；过渡期靠派生渲染行摆在 `text` 下面人眼对照 + 复核 | 第二层（渲染）+ 第三层 |
| `ears` ↔ 模型（不变量、动作） | 模型加了登记表里没有的性质，或删了有的 | #75 已有：「指不回 `docs/requirements.json` 的性质不许加」是 `formal-rule.ts` 测试里的一条断言；反向（`ears` 有、模型没有）由审计对红线判据的 `levels` 报缺 | 第二层 |
| 模型 ↔ 代码 | 代码改了顺序、模型没改 | 对拍（D.13 第 2 条，模型式测试驱动真实类）；两份模型互比可达状态集（D.13 第 3 条，#75 的 `--tla`，本次复现，参数 `-deadlock -workers 1`）；入口脚本那一段「模型化的、不是执行的」只能靠 `IMPLEMENTATION-MAP.md` 的人工核对表 + 顺序契约变异 | 第二层 + 第三层 |
| 代码 ↔ 测试 | 测试镜像实现（同源） | 变异（抓「什么都没断言」）+ 独立复核（抓「该写没写」）；机器抓不到同源本身 | 第二层 + 第三层 |
| 测试 ↔ 需求 | 认领指错编号、退役编号被重用 | `criterion()` 运行时认领 + `retired_ids`（R5）+ 建议 `claims` 里的判据 id 与登记表比对（今天不比，B13） | 第二层 |

### C.8 交人决定的分歧

三份独立设计经一位独立评审合成后，仍然留下这些分歧（全部进附录一，J38）：

- **子句层要不要存在**：兼容优先的设计在判据下挂多条带 id 的子句（`P3.a/1`、`P3.a/2`…），另两份坚持「一条判据 = 一条 EARS 子句、不发第三套编号」。子句 id 今天没有下游消费者（只有 `retired_ids` 与报错用），按「派生或删」要拍板：保留子句层（拒绝 / 放行分支与边界例子在同一判据下），还是把 P3.a 拆成两条判据（ADR-24：true / false 分支算不算不同代码路径）。本文暂取子句层，理由是它不改判据编号。
- **`guard` 与 `if` 分不分字段**：形式化优先的设计分开，状态机映射更直接；本文合并，按「有 `when` 则 `if` 是 guard」派生。
- **`text` 由 `ears` 派生的时机与谁按开关**：迁移期 `text` 不动（两个去处无检查）vs 落地即派生（每迁一条红线判据 `text` 就变一次，都要过 ADR-24 复核，且 SPEC 句子变刻板）vs 永不派生只并排渲染。本文取第一种，需人确认能接受迁移期的漂移风险，并定开关时点。
- **验证者是存储字段还是派生值**：派生符合「派生或删」，但一条 oracle 全是 `call` 的判据派生结果恒为 test，没办法声明「我打算由 selfcheck 验」。
- **审计是否收紧到「带子句且验证者为 test 的判据必须有判据名下的变异」**：这是迁移的杠杆也是成本；今天 `M-P3-a` 记在需求 P3 名下，收紧后要改成 P3.a 并靠 `audit.ts:143` 的前缀规则让 P3 仍算有变异。
- **`unmeasured` 档要不要存在**：给「决定了但本仓库测不了」的判据（U6.c）一个显式 `none`，还是写不出 oracle 就不该有 `ears`、保持散文由审计统计。本文保留 `unmeasured`，但它在审计里的分量应与「保持散文」一样。
- **`examples` 要不要进登记表**：它是测试的输入而不是需求；三份设计都保留，理由是「边界值写在需求旁边比写在测试里更容易被复核」。本文保留，标明不参与计量。
- **评审自己指出的两处硬伤，本文已避开**：`holds` 白名单把 P3 的领域名写死进判定规则（换别的需求写不出）—— 本文的 oracle 不带谓词白名单，谓词留在术语 `def` 里靠人；oracle 只有闭合枚举而没有谓词时「大于什么」机器不知道 —— 本文承认这一层机器只守「有 oracle」，不守「oracle 说的是什么」。

### C.9 这个模型做不到的

- 不能证明 `text` 与 `ears` 说的是同一件事（过渡期靠人）。
- 不能判断 oracle 是否真可判定，也不知道 oracle 里的谓词是什么。
- 不能挡自然语言里的实现方式。
- 不能替 ADR-24 的「拆到多细」判据做决定 —— R10 只警告。
- 不能自动把 99 条判据翻译成 EARS；翻译是改尺子，每条都要复核。

## D. P3 纵向试点

### D.0 范围与已复现的反例

试点的对象刻意小：`scripts/lib/budget.ts`（56 行）、`scripts/providers/tikhub.ts` 的 `get()`（charge / fetch / refund 顺序）、`scripts/collect.ts` 与 `scripts/enrich.ts` 里的 `--budget` 解析、`persist()` 的时机与退出码。它适合当试点的理由在 B 节分级表的 P3 行。

| 试点内**裁决**（本节给草案，评定后生效） | 试点内**建模不裁决**（模型里有，结论只登记） | 范围外 |
|---|---|---|
| 限额的确认（P3.c）、假设值（P3.d）、写前记账（P3.e）、不误拒（P3.f） | D6.a 的续跑计数、F7.a 的「一次」、P3 × D4 的退出码交点、「非 200 不计费」 | 并发进程（A6）、断电（A5）、`probe` 不记账、汇率与阶梯折扣、enrich 的缓存命中判定（D8 / ADR-13） |

本次会话在读到 PR #75 之前，用读代码 + 端到端实跑确认了三个反例**存在**（这是对代码缺陷的独立确认，不是对 #75 尺子的复核 —— 区别见 I 节最后一表）：

| # | 反例 | 复现 | 违反的是什么 |
|---|---|---|---|
| CE-1 | `collect --resume <dir> --budget abc`：`Number('abc')` = NaN，`spent + 0.001 > NaN` 恒为 false，闸门永不拒绝。实跑：请求数 2 → 17，exit 0，提醒 0 条（stderr 只打出「预算 $NaN」）。NaN 落盘成 `null`，下次续跑在第一次 charge 时 `TypeError`，exit 1 | `collect.ts:59-60`；scratchpad `p3/e2e-a` | P3（多花）；退出码契约；对照 `enrich.ts:66-72` 有校验 |
| CE-2 | 崩溃窗口：`enrichProfiles()` 每人一次 charge，循环内没有 `persist()`（`collect.ts:205-229`；persist 只在 `:180` 每页后、`:198` run 末尾、`:245` main）。SIGKILL 于第 2 个 profile 请求时盘上 `requests=12`，实际已发 14；续跑从 12 起，最终盘上 15，实际 17 | `p3/e2e-c`，`kill-fetch.ts` 夹具 | 「不超出」只对盘上计数成立；最坏落后 = `needsProfile` 人数 |
| CE-3 | 浮点误拒：`699 × 0.001 + 0.001 > 0.7`，limit=0.7 只放行 699 次；10 万个 `k/1000` 的 limit 中 26,410 个少放行一次，0 个多放行；P3.a 用的 0.005 不触发 | `p3/scan.ts`、`budget-probe.ts`；fast-check、Z3（E.0） | 不违反「不超出」；违反「付得起不该拒」；`remaining` 与 `affordable` 自相矛盾 |

读代码得出、未实跑的：**CE-4** `cfg.budget_usd ?? 2`（`collect.ts:72`）静默给 $2，没有 CONVENTIONS §7 要求的「假设值」告知；**CE-5** `--budget 0` / `-1` 被接受，首个 charge 即抛、exit 3、提示「预算用尽 $0.017 / $0.00」。

PR #75 在本次会话之前已经用模型找到了 CE-2（`SpendIsRecorded` 5 步、`NoOverspend` 12 步）并手工修了 CE-1；本节**建议**采用它的模型（J1；对照表在附录三），只做四件它没做的事：EARS 层的判据草案、不误拒（P3.f）、随机 + shrink 的属性层、机器可读的假设登记表。

### D.1 业务意图（不变）

> P3 未经用户确认不得超出预算上限。

这一句一个字不动。下面标「草案」的是新增判据的提议；每条给的变更分类是**提议分类**，由评定者按 `process/2-CHANGE.md` 定。

### D.2 术语表与 EARS 判据

**术语表**（C 节词汇表的 P3 子集；id 带命名空间；这是全文唯一一份，C.5 引用它。标「草案」的术语只被 P3.c–f 的草案子句用到，随 H 第 3 步登记；未标的十三个就是 C.6 第 3 步装进 `terms` 的那些。oracle 栏写的是 C.2 `Oracle` 联合里的 kind）：

| id | kind | 定义 | oracle |
|---|---|---|---|
| `budget.request_proposed` | event | 适配层准备向 TikHub 发一次付费请求 | `invoke: TikHub.get()`（自检 fake-fetch） |
| `budget.paid_request`（草案） | quantity | 一次会向 TikHub 发出的 HTTP 请求 | `call_count: fetch`（fake-fetch 记录） |
| `budget.confirmed_limit`（草案） | quantity | 任务配置的 `budget_usd` 或 `--budget`，经解析为有限非负数 | `file_json: task.json /budget_usd` |
| `budget.limit_unparseable`（草案） | condition | `confirmed_limit` 不是有限非负数 | `call: lib/budget budgetProblem returns`（`budgetProblem` 在 #75 分支，主干没有） |
| `budget.limit_below_spent`（草案） | condition | `round(confirmed_limit × 1000) < 盘上 requests`（`--budget` 是新总额，不是追加） | 入口检查（今天不存在；#75 的 `ledgerProblem` 只守 `requests` 的形状，不比大小） |
| `budget.assumed_limit`（草案） | condition | 配置缺 `budget_usd` | `file_json: task.json /budget_assumed` |
| `budget.cost_exceeds_limit` | condition | `request_count × unit + cost > confirmed_limit` | `call: lib/budget charge throws BudgetExceeded` |
| `budget.raise_exceeded` | response | 抛出 `BudgetExceeded` | 同上 |
| `budget.change_count` | response | 改变 `request_count` | `call: lib/budget count unchanged` |
| `budget.notify_threshold` | response | 触发 50% / 80% 回调 | `call_count: onNotify` |
| `budget.count_unchanged` | outcome | charge 前后 `Budget.count` 相等 | 同上 |
| `budget.request_count`（草案） | quantity | 已授权的付费请求数 | 内存 `Budget.count`；盘上 `file_json: task.json /requests` |
| `budget.exceeded_caught` | event | 入口捕获 `BudgetExceeded` | `invoke: collect / enrich`（自检夹具 `pbudget`） |
| `provider.emit_request` | response | 发出 HTTP 请求 | `call_count: fetch` |
| `provider.non_2xx`（草案） | condition | 响应状态非 2xx | `fixture: fake-fetch`（夹具记录的响应状态） |
| `task.write_checkpoint` | response | `task.json` 落盘且含 `requests / done / offsets` | `file_json: task.json /requests` 等三处 |
| `task.running`（草案） | state | 任务进程存活且未收尾 | `model`（why：进程存活只在模型里可见） |
| `task.resumable`（草案） | state | 任务目录存在 `task.json` | `file_text: task.json` |
| `task_json.requests` / `.done` / `.offsets` | outcome | 盘上三个字段 | `file_json` |
| `process.exit_code` | outcome | 入口退出码 | `exit_code: collect [0,1,2,3]` |
| `memory.unreadable`（J9 后） | condition | 记忆文件读不出来（D4.d 的五类） | `call: lib/memory loadMemory throws MemoryUnreadable` |
| `budget.persist_before_emit`（草案） | response | 在发出请求前把 `request_count` 落盘 | `fixture: crash-inject`（夹具记录的 2xx 响应数 ≤ `task_json.requests`；`billed` 是 ghost，夹具量的是它在 A2 下的代理） |
| `task.start_or_resume`（草案） | event | 入口解析完配置或断点、尚未构造 `Budget` | `invoke: collect / enrich`（自检） |
| `budget.authorized`（草案） | event | `charge()` 返回而未抛 | `call: lib/budget charge returns` |
| `budget.print_assumed`（草案） | response | stderr 打出「预算为假设值 $N」 | `stderr_match` |
| `task_json.unchanged`（草案） | outcome | 入口退出后 `task.json` 字节不变 | `file_text: task.json`（自检前后比对） |
| `task_json.budget_assumed`（草案） | outcome | 盘上 `budget_assumed === true` | `file_json: task.json /budget_assumed` |

**现行判据（文本不变，只加子句）：** 见 C.5 的 `P3.a/1` 与 `P3.b/1`。

**草案判据（新增，需评定；分类是提议）：**

- **P3.c（提议分类：需求有歧义 → 补充。按 `2-CHANGE.md:26` 补充不是变更、不走评定，但它改尺子，走 F 节的提议档过独立复核；其中「低于已花」与 `Infinity` 的处理是产品取舍 → 人批）** — `when task.start_or_resume, if budget.limit_unparseable or budget.limit_below_spent, the system shall_not provider.emit_request; outcome task_json.unchanged, process.exit_code = 2.`
  依据：CE-1、CE-5；`enrich` 已经这么做，`collect` 没有。#75 的 `budgetProblem / ledgerProblem` 是它的实现，且比本节多守了 `requests: null / "4"`。**待人定**：`--budget` 是新总额（`collect.ts:60` 直接替换 `budget_usd`），而 stderr（`collect.ts:268,332`）与 SKILL.md 的文案都说「追加」—— 用户按「追加」填一个小于已花的数就落进「低于已花」；这一处是「想立刻停」还是「输错」（exit 2 拒绝续跑 vs 接受并立刻停），以及文案改哪一边（J3）；`Infinity` 按「不是有限数」处理还是按「用户明确不限」（本文按前者，理由是 P3 的字面「上限」）。

- **P3.d（提议分类：产品取舍 → 人批，二选一）**
  - **d-i 保留默认并告知**：`where budget.assumed_limit, when task.start_or_resume, the system shall budget.print_assumed; outcome task_json.budget_assumed = true.`
  - **d-ii 删除默认**：`where budget.assumed_limit, when task.start_or_resume, the system shall_not provider.emit_request; outcome process.exit_code = 2.`
  依据：CE-4。两种都不违反 P3，选哪种决定用户看到什么。本文推荐 d-ii：F1 已要求 Agent 必问预算，默认值只在 Agent 违反 F1 时起作用，而那正是最不该静默的时刻。D.10 / D.11 两个分支各写一套。

- **P3.e（提议分类：改需求要什么 —— 收紧；人批）** — `while task.resumable, when budget.authorized, the system shall budget.persist_before_emit.`
  依据：CE-2。这条把「不超出」的对象从「盘上计数」扩到「跨运行供应商实际计费」，是**新的保证对象**，不是澄清。它的代价要人看：每次授权后、发出前一次 `task.json` 原子写（`collect.ts:128-133` 的 `persist()` 今天还同时写 `creators.raw.json`，要先拆成只写账本的一支）；429 重试每次尝试都写；本次实测（本容器 ext4，含 fsync）3 KB × 3000 次 = 1.5 s，相对 150 ms 的限速间隔可忽略；`creators.raw.json` 不拆时 400 KB × 3000 = 4 s / 1.2 GB 写放大 —— 所以必须拆。
  **它保证的是 `persisted ≥ billed`（A2 成立时），不是 `persisted ≥ emitted`**：429 重试每次 charge → persist → 发出 → refund，四次尝试后 `persisted = 1`、`sent = 4`（实跑，用真实 `Budget` + 真实 `TikHub.get()` + fake-fetch），`billed = 0` 是按 A2 推得、不是量得。要 `persisted ≥ emitted` 得另落盘一个单调的发出计数，那是另一条架构决策，本文不提。

- **P3.f（提议分类：改需求要什么 —— 收紧；人批）** — `when budget.request_proposed, unless budget.cost_exceeds_limit, the system shall_not budget.raise_exceeded.`
  依据：CE-3。P3.a 说超了必须拒，P3.f 说没超不许拒；今天没有判据说后者，26% 的 limit 少一次是「合规」的。#75 判断「方向安全，不写成不变量」；本文认为「付得起不该拒」值得成为判据，交人定。实现上的整数毫美元是架构决策（D.3）。

- **P3 正文的范围边界（本文只指出，不起草）**：`collect.ts:102 / :129` 与 `enrich.ts:77 / :126` 各自读一次、无条件写回 `requests`，两个进程同时采集时预算池可能被花两遍；P3 文本今天读起来像无条件保证，而 D4 的同类边界已按 ADR-67 写进正文（ADR-66）。**范围边界声明是放宽方向，F 节禁止 Agent 起草**；这里只登记「边界未声明」，措辞由需求所有者起草（ADR-68 第五张欠条已记录同一件事）。

- **不进判据、只进假设登记表的**：「非 200 不计费」（`tikhub.ts:90`，A2）。

### D.3 状态定义

模型用**整数毫美元**（1 unit = $0.001），不用浮点美元。理由是 CE-3：`k × 0.001 + 0.001 > k/1000` 在 26% 的 k 上为真，而 `k + 1 > k` 永远为假。这是**架构决策**，采纳时写 ADR。盘上 `task.json.budget_usd` 仍是用户面的美元数（改盘上表示会碰 D6 的旧目录续跑）；边界换算 `limit_m = Math.round(budget_usd × 1000)` 要一条测试：`'0.7' → 700`、`'1.005' → 1005`（`1.005 × 1000 = 1004.9999999999999`，`floor` 给 1004）；设计面板实跑 `Math.round(k/1000 × 1000) === k` 对 `k = 0 … 2,000,000` 零失败。续跑时不回写 `limit_m / 1000`，只读不写，避免重新引入浮点。

| 变量 | 取值域 | 对应实现 | 说明 |
|---|---|---|---|
| `limit` | `ℕ ∪ {⊥}` | `Budget.limitUsd`（`budget.ts:21`）；`task.json.budget_usd` | `⊥` = 未确认（NaN / null / 缺失）。⊥ 时不得存在任何授权转移 —— 今天不成立（CE-1） |
| `charged` | `ℕ` | `Budget.requests`（`budget.ts:22`） | 内存计数；`spent = charged × unit` 派生 |
| `persisted` | `ℕ` | `task.json.requests` | 盘上计数 |
| `sent` | `ℕ`（ghost） | 无 | 供应商**收到**的提交次数，含非 2xx（沿用 #75 的命名） |
| `billed` | `ℕ`（ghost） | 无 | 供应商**真正计费**的次数。A2 成立时 `billed` = 2xx 响应数；A2 为假时 `billed = sent` |
| `phase` | `idle · charged · sent` | 隐含在 `get()` 的控制流（`tikhub.ts:83-103`） | #75 的三态 |
| `notified` | `⊆ {50, 80}` | `Budget.notified`（`budget.ts:18`） | 只在内存；续跑重触发（B22） |
| `exit` | `{–, 0, 1, 2, 3}` | `process.exit` 各处 | |

**非法状态不可表示**（类型层，架构决策，**不在试点内**，H 第 3 步之后可选）：`limit` 用品牌类型 `ConfirmedLimit`，唯一构造函数就是 #75 的 `budgetProblem` 校验；`Budget` 只接受它。要说清：类型只保证「值必须经过那个构造函数」，真正挡 NaN 的是构造函数里的运行时校验 —— `loadTask()` 返回的 `budget_usd: number` 一个 `as` 就过编译。

### D.4 事件

| 事件 | 触发者 | 对应实现 |
|---|---|---|
| `start(cfg)` / `resume(dir, arg?)` | 入口 | `collect.ts:47-75`；`enrich.ts:64-73` |
| `propose(c)` | 适配层准备发请求 | `tikhub.ts:84` 调 `charge()` 之前 |
| `authorize` / `reject` | `Budget.charge()` | `budget.ts:35-46` |
| `persist` | 入口的 `persist()` | `collect.ts:128-133`；`enrich.ts:125-129` |
| `send` | `fetch` 发出 | `tikhub.ts:87` |
| `respond(ok)` / `respond(status)` | 响应到达 | `tikhub.ts:88-102` |
| `refund` | 非 2xx | `tikhub.ts:90` |
| `notify(th)` | 跨阈值 | `budget.ts:41-45` |
| `crash` | 任意时刻 | 无（模型专有） |
| `terminate(code)` | 入口收尾 | `collect.ts:330-335`；`enrich.ts:270-273` |

### D.5 转移（现状 → 提议）

**写前记账的落点是一条顺序契约改动（架构决策，要 ADR + 顺序契约变异）：** `persist` 是入口的函数，`charge` 在适配层里；提议让 `TikHub` 构造时接受一个 `onAuthorized: () => void` 回调，`get()` 在 `charge()` 之后、`fetch` 之前调用它，入口把 `persist`（只写账本的那一支）传进去。另一种落点 —— 在 `enrichProfiles` 循环里「先 +1 再 persist 再 get」—— 写下去的是上一次的 `charged`，I2 仍破，不采用。

| 转移 | 前置 | 副作用顺序（现状） | 副作用顺序（提议） | 理由 |
|---|---|---|---|---|
| `start(cfg)` | — | `limit := cfg.budget_usd ?? 2`；`charged := 0`；saveTask | `limit := parse(cfg.budget_usd)`，缺失 → P3.d 的 d-i 或 d-ii | CE-4 |
| `resume(dir, arg)` | task.json 存在 | `limit := Number(arg)`（无校验）；`charged := persisted` | `budgetProblem / ledgerProblem` 校验，失败 → exit 2、task.json 不动 | CE-1、CE-5 |
| `propose(c) → authorize` | `limit ≠ ⊥ ∧ charged + c ≤ limit` | `charged += c`；阈值检查；sleep；fetch | `charged += c`；**`persist`（账本）**；阈值检查；fetch | CE-2 |
| `propose(c) → reject` | `limit ≠ ⊥ ∧ charged + c > limit` | throw；无状态变化 | 同 | 已确认（读代码）；属性测试要检验「无状态变化」包括 `notified` |
| `propose(c)`，`limit = ⊥` | — | **授权**（NaN 比较恒 false） | 不可达（`budgetProblem` 在入口拦） | CE-1 |
| `respond(non-2xx)` | `phase = sent` | `charged −= 1`（`max 0`）；429 → 退避后回到 `propose` | 同；下一次 authorize 的 persist 把退款写回盘 —— 退款后到下次 persist 之间盘上**多记**一次（安全方向） | — |
| `crash` | 任意 | 内存丢；`persisted` 保留 | 同；提议下 `persisted ≥ billed` 在界内成立（依赖 A2、A4；A5 为非目标） | CE-2 |
| `persist` 失败 | writeFileAtomic 抛 | 在 `run()` 内抛出 → main catch → `stopped='error'` → 再 persist（可能再抛）→ exit 1 | persist 失败 ⇒ **不发出**，按 error 收尾 | 写前记账的自然结果 |
| `terminate` | — | budget → 3；error → 1；记忆读不出 → 2；否则 0 | 同 | 主路径已正确；阶段相关分歧（402 / 429 在 profile 阶段被吞）见 B6 |

### D.6 不变量与时序性质

安全性（对所有可达状态成立；每条标现状 / 提议）：

- **I1 进程内不超出**：`limit ≠ ⊥ ⇒ charged × unit ≤ limit`。现状成立（`budget.ts:36` 是预检；#75 的 `RejectedNotCounted`）。
- **I2 跨运行不超出**：`persisted ≥ billed`（在 A2 下），推论 `Σ billed ≤ limit`。**现状不成立**（CE-2；#75 的 `SpendIsRecorded`）；提议的写前记账使其在界内成立（TLC `Limit0 = 3`、2 页 2 人 1 次崩溃；依赖 A2、A4，A5 非目标）。严格版 `persisted ≥ sent` 提议**也不满足**（429 重试），列为「A2 为假时才需要、当前设计不满足」。
- **I3 拒绝无副作用**：`reject` 前后 `charged / persisted / notified / sent` 全部不变，且不发生 `send`。
- **I4 不误拒**：`limit ≠ ⊥ ∧ charged + c ≤ limit ⇒ authorize`。**现状在浮点上不成立**（CE-3）；整数模型下成立。
- **I5 限额已确认**：任何 `send` 发生时 `limit ∈ ℕ`。**现状不成立**（CE-1）。注意：#75 的 BFS 模型里没有 ⊥ 这个状态，I5 在 #75 里由对真实 `Budget` 的 14 值域扫描（`LIMIT_DOMAIN`）守，不是模型报出的。
- **I6 提醒各一次（每进程）**：每个阈值在一个进程生命周期内最多 `notify` 一次，且只在跨越时。「每任务一次」是 F7.a 未定义的部分（B22），不在试点内裁决。
- **I7 退出码忠实**：`exit = 3 ⇒ 终止原因是 reject ∧ checkpoint 已写`；反向 `reject ∧ checkpoint 已写 ∧ ¬memory.unreadable ⇒ exit = 3`（记忆读不出来时退 2，ADR-15 优先）。

活性（时序性质；本次会话的 P3 设计面板用一份独立写的 TLA+ 规约在 TLC 上跑过，**实跑**，规约与日志在 scratchpad `formal-p3/`；#75 的模型没有这两条）：

- **L1 付得起的最终发出**：若 `limit − charged ≥ unit` 且仍有工作，最终有一次 `send`。现状配置成立（无崩溃 26 个 temporal 分支、`MaxCrash = 1` 46 个）。**提议配置（写前记账）+ 崩溃时被违反**：`persist(disk=3) → send → 429 → refund(mem=2) → crash → resume(mem = disk = 3 = limit) → reject → exit 3` —— 退款还没写回盘就崩了，续跑把那次退款当成花掉了，付得起的最后一次被拒。这是写前记账的**活性代价**：安全方向保守，用户可能少拿一次请求。要人知道（J5）。
- **L2 拒绝后终止**：若 `reject` 发生，则最终 `terminate(3)`（在 `¬memory.unreadable` 下）。现状与提议都成立。

同一份规约给出的安全性结论（实跑，`Limit0 = 3`）：现状配置 `S2 billed ≤ limit` 被违反，19 步反例与 `e2e-c` 同构；「响应后落盘」（`after`）配置仍被违反，两次崩溃各漏一次；写前记账（`ahead`）配置全部安全性质成立，22,696 个 distinct states 1.3 秒、放大界（2 页、3 人、3 次重试）150,502 个状态 2.2 秒；`--resume --budget` 低于已花（负追加）在 `resume` 步违反 `mem ≤ limit`（对应 CE-5，P3.c 处理）。

### D.7 环境假设登记表与失效检测（第 12 问）

每条假设写成：是什么、若为假破坏哪条性质、怎么验证、状态、失效触发器、**触发器由谁怎么检测**。建议落在 `docs/assumptions.json`（机器可读，进 `content_hash` 同类的指纹），审计读它。

| # | 假设 | 若为假 | 验证方式 | 状态 | 失效触发器 | 触发器检测 |
|---|---|---|---|---|---|---|
| A1 | 单次请求单价 ≤ $0.001（`budget.ts:1`：TikHub 基础价，有阶梯折扣，此为上限） | `spent` 低估真实花费；I1 / I2 在美元意义上失效（请求数意义上仍成立） | 对照 TikHub 价格页；一次真实任务后对照供应商账单（**人工**，H 第 1 步指定责任与日期） | **未验证** | 价格页变化；`tikhub.ts` 端点变化 | 外部：TTL（起点 90 天，过期即「未验证」）；代码：登记表记 `tikhub.ts` 相关函数的内容指纹，审计比对，变了即「待重验」 |
| A2 | 非 2xx 响应不计费（`tikhub.ts:90` 退款的依据） | I2 失效（退款后 `charged` 低估）；B21 的 8 次提交 1 次计数是它的放大 | 账单对照，专门数 4xx / 429 | **未验证** | 同 A1 | 同 A1 |
| A3 | 请求已发出、进程在响应前死亡 → 供应商**可能**计费 | 按不计费建模会低估 | 无法直接验证；模型按最保守方向（视为已计费）处理 | 保守假设 | — | — |
| A4 | `writeFileAtomic` 的 rename 使文件要么旧要么新（`atomic.ts:74-87`） | `persisted` 可能是坏 JSON → 续跑读不出来 | 有测试（D4.i 相关断言）**但无 `criterion()` 认领**（B11） | 已验证（测试） | Node 版本、文件系统类型变化 | 代码指纹：`atomic.ts`；环境：`meta.json.versions` 记 Node 版本 |
| A5 | 断电后 rename 是否持久化：尽力而为（ADR-50） | 断电丢最后一次 persist → I2 失效一次 | 不验证；写进不保证 | 已声明不保证 | — | — |
| A6 | 同一任务目录单写入方（ADR-66） | 两个进程各自 `persisted` 互相覆盖 | 不验证；写进不保证（D.2 的范围边界，待需求所有者起草） | 已声明不保证 | — | — |
| A7 | 用户在 `--budget` 里输入的就是确认 | 误输入即误确认 | 产品决定 | 已接受 | SKILL.md 流程改变 | 代码指纹：`SKILL.md` 预算段 |
| A8 | 整数在 JSON 往返中精确（< 2⁵³） | 计数读回失真 | 语言规范保证，无需验证 | — | — | — |
| A9 | fake-fetch 的行为等价于真实 fetch 的**顺序**（不是内容） | 自检里的顺序断言对真实运行无效 | `selfcheck` 与一次真实运行的 `requests` 对照 | 部分验证（2026-08-26 真实跑通） | `fake-fetch.ts` 或 `tikhub.ts` 改动 | 代码指纹 |

**失效后的接线**：假设状态变为「未验证 / 待重验」时，依赖它的性质在覆盖记录的 `levels` 栏（C.6 第 2 步落地，审计读）从 `MODEL_CHECKED` 降为 `ASSUMED`，审计对红线判据报「目标等级未达」。这一步依赖 C 节的等级栏落地，之前只能靠审计打印登记表。

### D.8 目标性质 · 未知 · 非目标

**目标性质（提议实施后，待 D.13 的检查确认；今天没有一条是已证明的）**：I1–I7。活性 L2 在本会话的 TLC 参考规约上成立（实跑）；L1 在提议配置下**已知被违反**（D.6，接受为写前记账的代价，J5 / J31 / J32）；两条活性都**不在 `npm run formal` 的检查范围内**（BFS 探索器没有时序逻辑，E.2），只留在 TLC 参考规约上，或按 D.13 第 9 条改写成可达性检查。

**未知**：真实账单与 `requests × unit` 的差（A1 / A2）；供应商对 in-flight 请求的处理（A3）。

**非目标**：并发进程（A6）；断电持久性（A5）；`probe` 的花销不记账（ADR-68 第五张欠条，ARCHITECTURE 明写「probe 不落盘」）；汇率与币种；阶梯折扣；enrich 的缓存命中判定；F7「每任务一次」；P3 × D4 交点的裁决。

### D.9 反例清单（模型必须覆盖的输入）与两套配置的预期

模型跑**两套配置**：「现状」（persist 在循环外、无入口校验）与「提议」（写前记账、入口校验）。每个输入给两套的预期结论：

| 输入 | 现状预期 | 提议预期 |
|---|---|---|
| `limit = NaN / null / 缺失` | I5 违反（对真实 `Budget` 的值域扫描；模型里 ⊥ 不可表示） | 入口 exit 2，不可达 |
| `limit = Infinity` | 无限放行（本次实跑） | 按 P3.c 拒（待人定） |
| `limit < alreadySpent`（含 0、负数） | 首个 charge 即抛、exit 3、提示自相矛盾 | exit 2（待人定） |
| `c = 0` | `charge(0)` 通过且不改计数（实跑） | 模型禁止 `propose(0)`（付费请求 cost ≥ 1 unit） |
| `c < 0` | `charge(-1)` 让计数从 1 变 0 且不经过 `refund()`（实跑）—— 没有任何判据覆盖的输入形状 | 构造函数与 `charge` 拒绝非正 cost（架构决策；是否算需求由评定定） |
| `budget_usd = 0.0005`（低于单价精度） | 折算成 0 次或 1 次取决于四舍五入 | 拒绝「精度超过 $0.001」（设计面板的 `parseBudgetMilli` 实跑；是否拒绝要人定） |
| 写前记账 + 退款后崩溃 | — | L1 违反：少拿一次（见 D.6） |
| `charged × unit = limit` 恰好相等 | 下一次 `propose(1)` reject | 同 |
| 浮点 `limit = 0.7 / 0.009 / 0.010` | 699 / 8 / 9 次（I4 违反） | 700 / 9 / 10 次 |
| 连续 reject | 每次 reject 状态不变 | 同（属性测试） |
| authorize 后、send 前崩溃 | `persisted < charged`（I2 违反，CE-2） | 不可能（persist 在前）。**「每个 profile 之后 persist」（enrich 今天的节奏）挡不住这一条**：设计面板的探索器在该配置下仍报 in-flight 崩溃反例（5 步），只有写前记账无反例（实跑，2,965 / 28,845 状态两档界） |
| send 后、响应前崩溃 | 同上 | `persisted ≥ billed`（保守多记） |
| 非 2xx 后、下次 persist 前崩溃 | — | `persisted` 多记一次 —— 安全方向 |
| `persist` 失败 | 计数丢、exit 1 | 不 send；exit 1；task.json 是旧的（A4） |
| 429 → refund → 重试 × 3 | `charged` 净不变；`sent = 4`；`persisted` 落后 | `persisted = 1`、`sent = 4`、`billed = 0`（本次实跑）；**A2 为假则 `billed = 4 > persisted`** —— 这是 ADR-68 第四张欠条的形状 |
| 402 | exit 1（不是 3）：供应商余额不足不是本预算问题 | 同；profile 阶段被吞成 `profile_failed` 的分歧见 B6 |
| 两次并发 `charge`（同进程） | JS 单线程、`charge()` 同步 → 原子 | 同 |
| 两个进程 | 非目标（A6） | — |
| 默认预算 | CE-4 | P3.d 的 d-i 或 d-ii |

### D.10 测试映射（含函数契约）

**函数契约（前置 / 后置）** —— 运行时 assert 或注释 + 测试：

| 函数 | 前置 | 后置 |
|---|---|---|
| `budgetProblem(v)` | 任意 | 返回 `undefined` ⇔ `v` 是有限非负数 |
| `ledgerProblem(v)` | 任意 | 返回 `undefined` ⇔ `v` 是 `undefined` 或非负整数 |
| `Budget.charge(n)` | `limit` 已过 `budgetProblem`；`n ≥ 1` | 抛出 ⇒ `count` 不变且未 notify；不抛 ⇒ `count += n ∧ count × unit ≤ limit` |
| `Budget.refund(n)` | — | `count = max(0, old − n)`；`notified` 不变 |
| `persist()`（账本支） | — | 盘上 `requests = charged`；失败抛出且盘上是旧的（A4） |
| `TikHub.get()` | — | 每次尝试：`charge` → `onAuthorized` → `fetch`；非 2xx ⇒ `refund` |
| `resume` | `task.json` 存在 | `charged = persisted`；`limit` 过校验 |

| 义务 | 类型约束 | 属性测试 | 例子测试 | 模型检查 | 运行时监控 |
|---|---|---|---|---|---|
| P3.a/1 超限必拒、拒绝无副作用 | — | ✔ 随机 `(limit, 序列)`：I1、I3 | ✔ 现有 0.005 × 10 | ✔ I1、I3（#75 `RejectedNotCounted`） | 进程内 assert |
| P3.b/1 断点 + exit 3 | — | — | ✔ selfcheck 夹具（现有） | ✔ I7（#75 `Exit3Recoverable`） | 退出码分布 |
| P3.c 限额必须可解析 | （可选）`ConfirmedLimit` | ✔ 随机字符串：非有限 → 拒 | ✔ `abc`、`-1`、`0`、`Infinity`、`1e400`；盘上 `null` / `"4"` | ✔ 值域扫描（#75 `LIMIT_DOMAIN`） | 启动时打印限额来源 |
| P3.d 假设值 | — | — | d-i：缺配置 → stderr 行 + 标记；d-ii：缺配置 → exit 2 | — | `meta.json.budget.assumed`（d-i） |
| P3.e 写前记账 | — | ✔ 崩溃注入：任意崩溃点后 `persisted ≥ billed` | ✔ `kill-fetch` 夹具 | ✔ I2（#75 `SpendIsRecorded` 从违反变成立） | 续跑时打印 `persisted` 与 `updated_at` |
| P3.f 不误拒 | 整数单位 | ✔ 随机十进制 limit：恰好 `L/unit` 次 | ✔ `0.7 → 700`、`1.005 → 1005` | ✔ I4 | — |
| F7.a 提醒各一次（每进程 —— 按 J8 裁决前的临时解读） | — | ✔ 随机序列下每阈值 ≤ 1 次 | ✔ 现有 | ✔ I6 | — |

属性测试的生成器只需要三样：`limit ∈ [0, 3000]` 毫美元（或十进制字符串）、事件序列 ∈ `{propose, respond(ok), respond(429), respond(500), crash, resume}*`、序列长度 ≤ 50。用例数要按变异乘数预算：`npm run mutate` 对每条变异跑一次 `npm test`（主干 229 条），属性用例的每一毫秒都要乘 229。设计面板实跑一套 P3 属性在 N = 2000 时 3.8 秒（每例约 1.9 ms），N = 100,000 超过 120 秒被中止。按 D.15 第 4 条「`npm run check` 总增量 < 60 秒」拆预算：`formal` ≤ 5 秒（本地目标；CI 上限 30 秒是 D.14 的回滚线）；属性测试每条 N ≤ 50、七条合计 `npm test` 增量 ≤ 0.1 秒，× 229 ≈ 23 秒；三项合计 < 60 秒。大 N（2000 以上）只在本地按 seed 跑，不进 CI；nightly 随机 seed 是 J37。P3.c 的例子要包括 `Number()` 会静默接受的输入：`'1e3'` → 1000、`'0x10'` → 16、`''` → 0（实跑）。

### D.11 变异映射

编号：#75 分支已占用 `M-P3-b`（「请求先发出去再过闸门」）与 `M-P3-c`（`budgetProblem` 恒 `undefined`），本节用临时标号 N1–N9，落地时按合入顺序续编，不与 #75 撞。

| 临时号 | 改什么 | why（需求语言） | 被谁抓 |
|---|---|---|---|
| （现有 M-P3-a） | 删掉超限时的抛出 | 预算超限不再抛出，静默继续花用户的钱 | P3.a 例子 |
| N1 | `>` 改 `>=` | 恰好花完预算时最后一次付得起的请求被拒 | 现有 P3.a 例子已能抓到（实跑：sent = 4 ≠ 5）；P3.f 属性把它扩到全域 |
| N2 | 删掉非 2xx 的退款 | 被限流的重试也计费，用户少拿三分之一额度 | 429 例子。**实跑：把它打到主干上跑现有 `scripts/test.ts`，837 个 ✓、exit 0 —— 存活。** 今天没有任何测试守它，也没有任何判据要求它 —— 「非 2xx 不计费所以退款」只存在于 A2；这条变异落地前要先有归属（P3.e 的子句或 A2 进判据），否则 `mutate` 的归属检查会拒（ADR-34） |
| N3（= #75 的 M-P3-b） | 把记账挪到发请求之后 | 请求先发出去再看预算，超限的那一次已经花了钱 | fake-fetch 顺序断言（自检）。**实跑：打到主干上现有测试同样存活**；设计面板的顺序属性（每次 fetch 前最近两事件必须是 charge, persist）随机 500 例全部抓到 |
| N4 | 删掉发请求前的落盘回调 | 进程被杀时盘上少记，续跑后总花费超出上限 | 崩溃注入属性 |
| N5（= #75 的 M-P3-c） | `budgetProblem` 恒 `undefined` | 输错一个参数得到一次无上限采集 | P3.c 例子 |
| N6 | d-i：删掉假设值告知；d-ii：缺配置也放行 | 用户不知道系统替他定了预算 | P3.d 例子 |
| N7 | 毫美元换算用 `floor` | 用户填 1.005 美元只拿到 1004 次 | 换算例子 |
| N8 | 模型检查器的不变量改成恒真 | 检查器对任何模型都报通过 | #75 已有 `broken-charge` 负例场景 + `M-H16-*`（须重编号） |
| N9 | 入口 exit 3 改 exit 1 | 预算用尽被当成出错，Agent 不会提示追加预算 | selfcheck 夹具（现有）；ADR-70 的 `by / kills` 五刀落地后改为变异（第一刀 PR #81 已于本文提交当天合入主干，只落判定 `verifier-rule.ts`，未接线） |

### D.12 运行时监控

- **进程内**：每次 `charge()` 之后 `assert(charged × unit ≤ limit)`；每次账本 `persist()` 之后 `assert(persisted ≥ charged)`（退款后 `persisted > charged` 是允许的）。断言失败按 error 收尾、exit 1 —— 它们不该被触发，触发就是模型与代码分叉了。**exit 1 沿用「其他失败」的既有含义**，不扩展退出码（ARCHITECTURE「含义不许扩展」）。
- **启动 / 续跑时**：打印限额来源（配置 / `--budget` / 假设值）、盘上 `requests`、上次 `updated_at`。
- **`meta.json` 新增 `budget` 块**（`{ limit_m, charged, persisted_at_exit, assumed, reconciliation: 'unverified' | { provider_count, checked_at } }`）—— `meta.json` 装什么是 U7.d 的对象，**要评定是否触及 U7**（J13）。`reconciliation` 默认 `unverified`。
- **对账钩子（人工）**：一次真实任务后，把供应商后台的请求数与 `Σ task.json.requests` 对照，结果由人写进假设登记表 A1 / A2 的「最近验证日期」（审计只读）。

### D.13 CI 接入

建议采用 #75 的文件与命名，不另起（J1；若第 0 步选弃用，本节按 D.3–D.6 另写探索器，工作量另估）：`scripts/check/formal-rule.ts`（判定：状态、动作、不变量、有界 BFS、对拍投影）+ `scripts/check/formal.ts`（入口）+ `npm run formal`，位置在 `mutate` 之后、`selfcheck` 之前；`--tla` 不进链。拆分方式见 H 第 0 步。

1. **界**：#75 的五个场景（`spec` / `entry-cadence` / `no-crash` / `bill-non-200` / `broken-charge`，56–2236 状态）；本文加两个：`write-ahead`（提议配置，`SpendIsRecorded` 与 `NoOverspend` 预期成立）与 `two-level-endpoint`（B21，预期给出 A2 为假时的反例）。规模参考（设计面板的独立探索器，实跑）：宽界（limit ≤ 6、3 页、3 人、2 次崩溃）现状 64,957 状态 211 ms，写前记账 28,845 状态 65 ms。目标：`npm run formal` < 5 秒（本地）；D.14 的回滚阈值 30 秒是 CI 上的上限，两者的关系是「本地目标 / CI 上限」。
2. **对拍**（模型 ↔ 代码）：#75 的 `runConformance()`（有界穷举，把 `CONFORMANCE_LIMITS` 从 `[0,1,2,3]` 扩到含 9，让它碰到 CE-3 —— 扩界后的对拍本次**未跑**，「能碰到」是从最小误拒点 9 推出的）+ H 第 4 步的随机对拍。认领只写 `criterion('P3.a')`；P3.c–f 是草案，claims 不比对登记表（B13），认领草案 id 会静默通过。
3. **模型 ↔ 模型**：`--tla` 逐字符比可达状态集，复现条件 `-deadlock -workers 1`（E.2b）。
4. **反例持久化**：探索器找到轨迹时写成夹具 `scripts/check/fixtures/p3/<name>.json`，形状 `{ name, bounds, trace: [{ action, state }], expect: '<不变量名> violated at step k' }`；`test.ts` 里一条「回放全部夹具」的测试。**夹具只增不删**；删一条要 `oracle-change:` trailer。
5. **审计**：`formal-rule.ts` 进判定模块清单，必须有变异（N8 / #75 的 `M-H16-*` 重编号）；`formal.ts` 在链里自成一步。#75 给 `selfcheck.ts` 加的 46 行与 `formal` 无关 —— 是三条入口对坏预算 / 坏账本的真跑（P3.c 的入口验收：`budget_usd: "abc"`、`requests: null`、`--budget 3.0.0`），随 0b 走。
6. **锚点与同步**：ARCHITECTURE 锚点表两行（#75 已写）；SYNC 表加「改预算 / 成本逻辑 → 同时改模型与 `IMPLEMENTATION-MAP.md`」。
7. **假设登记表**：`docs/assumptions.json` + 审计读它。
8. **旧任务目录**：`task.json` 缺新字段（`budget_assumed`）时按 ADR-18 的方向读作「无从确认」而不是 `false`；`meta.json.versions` 缺失时报告声明「版本未知」。
9. **活性**：`formal-rule.ts` 不检查 L1 / L2（没有时序逻辑）。要进链只能改写成可达性 / 无 stuck 状态检查（「存在付得起且仍有工作的可达状态，其后继里没有 `send`」是安全性形状）；否则只留 TLC 参考规约（E.4 ③）。本文不把活性列进第 3 步的验收。

### D.14 回滚条件（试点本身）

任一命中即撤掉 CI 步骤（保留文件，写 ADR 记原因）：

- `npm run formal` 在 CI 上 > 30 秒，或出现不可重现的结果（探索器是确定性的，出现即 bug）。
- 连续三次「反例」被人判定为模型错而不是代码错。
- 模型核心（不含对拍夹具与打印）超过 350 行（体量线）还表达不了 D.9 的全部输入。
- 写前记账的开销：用一个 3000 请求量级的基准（不是 selfcheck —— 它的夹具只有十几次请求）实测账本落盘总耗时 > 限速总时长的 5%。

### D.15 试点成功 / 失败判据（第 19 问）

**成功，六条同时成立：**

1. **回归式**：撤掉 `budgetProblem` 的入口校验后 `npm run formal` 的值域扫描变红（I5）；把 `entry-cadence` 场景的 `persistEvery` 设回名单长度后 `SpendIsRecorded` 变红（I2）；拆分后五个场景的可达状态数与最短反例长度与 #75 记录一致（TLC 参数钉住）。（「不给反例、让模型自己找到」在构造上不可能 —— 不变量本来就是从反例反推的。）
2. **盲写不变量**：一个没读过 D.0 与 CE 清单、也没读过 #75 模型的上下文，只依据 P3 原文 + D.2 术语表写不变量，再跑探索器；它写出的不变量里必须有与 I2 同构的一条（探索器报出崩溃窗口反例）和与 I5 同构的一条（由值域扫描报出 —— BFS 模型里 ⊥ 不可表示，I5 不是探索器能报的）。
3. D.2 的每条义务都有测试认领 + 至少一个变异被抓到；`npm run mutate` 无存活。
4. `npm run check` 总时长增加 < 60 秒（CI 数字）。
5. 独立复核（只读需求、EARS、术语表、对应的对外文档、类型签名、`mutate --brief`，不读模型与实现 —— F 节的准入清单）的意见里，「不成立」为零或已处理留痕，**「没资格判断」每条都有去向**（转人批或登记为未知；不要求为零 —— 要求为零会激励把第三档压进第一档）。
6. `requirements.json` 的 P3 `text` 一字未改；新增判据由一条 ADR 提交、逐条裁决，采纳的每条在那条 ADR 里有独立结论（P3.e 与 P3.f 各自的架构决策另有 ADR，J43 / J44）。

**失败，任一成立：**

- 第 1 条的任一回归不变红。
- 模型报的反例里假的多过真的（试点期内累计计数；D.14 的「连续三次」是另一条独立的回滚线）。
- 为了让模型「通过」，有人改了 I1–I7 中任何一条（F 节：不变量只增不删）。
- 试点超过两个 48 小时分支周期还没合进主干 —— 说明切法错了，按 H 节拆得更小。

## E. 工具比较

### E.0 本次会话实测了什么

比较不能只靠资料，所以先在本环境（Node 22.22.2、Java 21、出网走代理）对**真实的 `Budget` 类**和同一个「预算 + 持久化 + 崩溃」小模型（5 个变量，不含 F7 与 persistEvery —— 比 #75 的模型小）把候选工具各跑了一遍。全部脚本在会话 scratchpad 的 `tools-hands-on/` 下，仓库未动。

| 工具 | 版本 | 能装 | 能跑 | 找到的反例 | 耗时 | 代码量 |
|---|---|---|---|---|---|---|
| fast-check | 4.9.0 | 是（devDependency，安装 2 个包：`fast-check` + `pure-rand`） | 是，直接 import 真实 `Budget` | 性质 C「付得起不该拒」：523 次后失败，shrink 13 次到 `limit=0.009` 第 9 次误拒；性质 A 找到 `resumeWith(0.002) → charge×2 → resumeWith(0.001)` 后 `spent > limit`（续跑给更小预算的固有行为，之后会拒，但 `pct > 1`） | 每性质 25–60 ms（2000 runs） | 86 行 |
| z3-solver（wasm） | 5.2.0 | 是 | 是 | 8 步 BMC（整数）找到 `persist → charge → send → ok → crash → resume → charge → send`，`sent=2 > limit=1`；**FloatingPoint 理论**找到 `m=37` 误拒并**证明** `m<9` 无误拒、`m∈[1,2000]` 无多放行 | Int < 200 ms；FP 每问 2–9 s | 111 行（SMT-LIB 字符串） |
| TLA+ / TLC | 2.19 | 是（jar 2.3 MB，0.7 s） | 是（JVM） | `Limit=1`：7 状态 trace `Charge → Send → Crash → Resume → Charge → Send`；`Limit=3` 全空间 500 distinct states | ~0.9 s/次（含 JVM 启动） | 62 行规约 + 4 行 cfg |
| Quint | 0.32.0 | 是（4.5 s） | `run` 是；`verify` 是（自动下载 Apalache 0.56.1，130 MB） | `run`：778 ms 找到 `sent=3 > 2`；`verify`：第 9 步反例 | run 1.4 s；verify 7–9 s | 52 行 |
| 零依赖 BFS（纯 TS） | — | 无需 | 是 | 与 TLC 同构的最短反例（长度 6）；全空间 500 状态与 TLC 的 500 **计数**一致；**对拍真实 `Budget`** 在 `Limit=9`（3219 状态，20 ms）抓到「模型放行 / 真实拒绝」分歧（去掉打印上限后复跑：56 条）= CE-3 | < 1 ms（Limit ≤ 3）；20 ms（Limit=9） | 87 行（+37 行全空间计数） |
| zod / valibot / arktype | 4.5.4 / 1.4.2 / 2.2.3 | 只 `npm view` | 未装 | — | — | unpacked 5.8 MB / 1.8 MB / 0.34 MB（+3 依赖） |

四个值得单独说的实测结论：

1. **零依赖 BFS 与 TLC 的状态数相等（500 = 500），反例同构。** 这是**计数**相等，不是集合相等；集合级对账本次只在 #75 的模型上做了（见 E.2b）。在这个 5 变量的小模型上，重型工具没有带来额外发现；这句话不推广到更大的模型。
2. **对拍真实代码的只有 fast-check 与零依赖 BFS（本次实跑范围内；Quint 有第三方 TS 连接器，尚未验证）。** CE-3 是对拍抓到的：模型是整数、实现是浮点。#75 的对拍界是 0–3 单位，而最小误拒点在 9（$0.009），所以 #75 没碰到 CE-3 —— 是界的问题，不是「穷举 vs 随机」的问题；把界扩到 ≥ 9 的有界穷举一样能找到。P3.f 落地（整数毫美元）后这一类分歧消失，对拍继续检查顺序、退款、续跑。
3. **Z3 的 FloatingPoint 理论能证明「0.009 是最小误拒 limit」「[1,2000] 内不会多放行」。** 这是本次唯一一个「证明」而不是「没找到」的结论。代价是 SMT-LIB 字符串、每问 2–9 秒、context 复用的坑（连续 eval 互相污染，得每问新建 context）。TLC / Quint / Z3 的**整数**模型都找不到 CE-3；Z3 的 FP 编码能找到，但那是对算术的重新编码，不是对拍真实类。
4. **fast-check 的重放**要 `seed + path + replayPath` 三者齐全（`fc.commands` 需单独传 `replayPath`），只传前两个会报 `Unable to replay`。

未验证：`fc.asyncModelRun` 对 `TikHub.get()` 这类 async 被测对象；zod 等三个库在本仓库 `tsc --noEmit` 下是否零改动通过；TLC 多 worker 与 `-simulate`；Quint `verify` 在更大 Limit 下的耗时；这些工具在 GitHub Actions `ubuntu-24.04` 镜像上的表现（镜像文档列有预装 JDK 8/11/17/21/25，本仓库 CI 未验证）。

### E.1 比较表

拆成两张：进得了 `npm run check` 的（同进程、无 JVM）与进不了的。

**表一 · 同进程候选**

| 维度 | fast-check | 零依赖 BFS 探索器 | 类型层（品牌 / DU / 穷尽） | 运行时契约（zod 等 / 手写） | Stryker（对比自研 mutate） |
|---|---|---|---|---|---|
| 学习成本 | 低：属性 1 小时，`fc.commands` 半天 | 低；普通 TS | 低 | 低 | 低 |
| 与 TS 集成 | 同进程，import 真实类 | 同进程 | 编译期 | 同进程 | 独立工具，改测试命令 |
| 能证明 | 无（采样） | 有界穷举内无反例 | 非法状态不可构造（结构性） | 输入形状合法（每次运行） | 测试能失败 |
| 不能证明 | 任何「对所有」 | 界外；模型忠实 | 运行时值（`as` 绕过） | 语义 | 同源污染 |
| CI 成本 | 1 个 devDependency（2 个包）；毫秒级；需固定 seed；**改 lock 文件会让两条工作流首次冷缓存，2026-09-04 的 `npm ci` 7 分钟根因未明** | 零依赖；毫秒级；确定性 | 零 | 零到一个依赖 | 依赖 26 个 + 时长成倍；对自研框架只能用 `command` runner，无 per-test coverage |
| 反例质量 | shrink 到最小 + seed/path 重放 | 最短轨迹（BFS）；可直接转夹具 | 编译错误 | 运行时错误 | 存活变异清单 |
| 长期维护 | 与代码同仓同语言 | 同上；探索器本身要有测试与变异 | 最低 | 中 | 与自研 mutate 重叠 |
| Agent 适配 | 好：生成器与性质是普通代码；**失败模式**：性质恒真、生成器只覆盖 happy path、把 shrink 出的反例「修测试」 | 好：状态与转移是普通对象；**失败模式**：模型照抄实现、不变量恒真、界太小 | 好（结构性，编译器兜底）；**失败模式**：`as` 强转 | 好 | 中；不产出需求语言的 `why` |

**表二 · 独立进程候选**

| 维度 | TLA+ / TLC | Quint | Alloy 6 | Z3 | 程序证明（Dafny / Verus / Lean） |
|---|---|---|---|---|---|
| 学习成本 | 中高 | 中；语法像 TS，语义是 TLA+ | 中；关系逻辑 | 高；SMT 编码 | 很高 |
| 与 TS 集成 | JVM；模型是另一份实现；桥接靠 trace validation 或可达状态集互比 | run 是 Rust 求值器（无 JVM），verify 要 JDK；官方 MBT 连接器只有 Rust | JVM；无 TS 桥；6.2.0 有 CLI（批处理可用） | wasm 同进程，但写法是 SMT | 另一门语言，全部重写 |
| 能证明 | 有界穷举内无反例（Apalache 的归纳证明能力：**尚未验证**） | 同 TLA+ | 有界关系性质 | **真证明**（编码正确的前提下） | 真证明 |
| 不能证明 | 模型忠实；环境 | 同 | 同 | 编码忠实；环境 | 环境 |
| CI 成本 | JVM + jar（下载或提交 2.3 MB，固定 sha256）；秒级 | npm 包 + **20 个运行时依赖** + Apalache 130 MB 自动下载 | JVM | wasm 包 ~34 MB；FP 查询秒级 | 不适合 |
| 反例质量 | 可读 trace 带状态快照 | ITF JSON | 实例图 | 模型赋值，不是最小 | — |
| 长期维护 | 模型与代码漂移是常态；#75 用「两份模型互比可达状态集」压住 | 同 | 同 | 编码难读 | 极高 |
| Agent 适配 | 差：外部评测（搜索摘要，未逐字核实）最好 26.6% 解析通过 / 8.6% 模型检查通过；**失败模式**：写成教科书版而非实现版、`TypeOK == TRUE` 恒真 | 中偏好 | 差 | 差：编码错误静默 | 差 |

**brief 点名而本文不推荐的两项：** *refinement types*（Liquid Haskell 那一类带谓词的类型）在 TypeScript 生态**联网核对未找到**成熟实现（不断言不存在），最接近的是品牌类型 + 唯一构造函数做运行时校验，本文按这个替代品用；*PlusCal* 是 TLA+ 的算法层语法，本次没有单独试，#75 直接写的 TLA+。

### E.2 逐工具评语（≤ 200 字）

- **fast-check**：本仓库最缺的就是「随机 + shrink + 重放」这三样，它一次补齐；`fc.commands` 的模型式测试把「模型」和「真实类」放在同一个进程里对拍。代价是一个 devDependency（本仓库 devDeps 只有三个，产品代码零依赖）与一次 lock 文件变更 —— 这是人批项，且要先量 `npm ci`（H 第 4 步）。
- **零依赖 BFS 探索器**：87 行，在小模型上与 TLC 计数一致、反例同构，还能对拍真实类。它符合仓库的既有形状（判定与入口分开、判定模块必须有变异），#75 的 `formal-rule.ts` 就是它的成熟版。缺点：没有时序逻辑（活性要手写成可达性 / 无 stuck 状态检查）、没有对称约简。
- **TLA+ / TLC**：反例可读性最好，社区成熟。在本仓库的角色应是**参考规约与独立复核工具**，不是 CI 闸门：JVM 与 jar 在 CI 里可做但增加一类依赖；更重要的是它检查不到实现。#75 已经把它放在检查链外，正确。
- **Quint**：语法友好，`run` 快；但 20 个运行时依赖、`verify` 靠 Apalache（JVM、130 MB）。现在引入的收益低于 BFS + fast-check 的组合。
- **Alloy 6**：关系逻辑对「键的等价关系两侧一致」表达力好，6.2.0 有 CLI 能批处理，但没有 TS 桥、要 JVM、是第三份要维护的模型；本仓库的身份问题用属性测试在小字母表上穷举即可（tools-research 把它叫「Alloy 的 small-scope 思路搬进 TS」）。不推荐。
- **Z3**：唯一能对浮点给出**证明**的工具。用法应是一次性的：证明「换整数单位后不误拒」「[范围] 内不多放行」，把证明脚本与结论存进假设登记表当证据，**不进 CI**。
- **程序证明（Dafny / Verus / Lean）**：对 56 行的 `budget.ts` 都要整段重写；本仓库没有任何模块的风险配得上这个维护成本。明确不推荐。
- **类型层**：品牌类型 + 唯一构造函数、`Observation<T>` discriminated union、`never` 穷尽断言 —— 零成本、结构保证。它是 P1 与 P3.c 的首选手段。但要说清：类型只保证「值必须经过那个构造函数」，真正挡 NaN 的是构造函数里的运行时校验（#75 的 `budgetProblem`）。
- **运行时契约**：仓库已有手写校验（`memory.ts` 的 `shapeProblem`），风格是「只校验会读的字段、报真实原因」；zod 等库能省代码但引入运行时依赖并改变错误文案风格。建议继续手写，把「外部响应 / 四个落盘 JSON 的形状校验」补齐（今天只有 memory 文件有）。
- **Stryker**：与自研 `mutate.ts` 功能重叠，且自研版有仓库专属的三态判定、`why` 需求语言检查、归属检查；对自研测试框架只能用 `command` runner。不换。可本地跑一次当扫描仪找候选负片。

### E.2b 联网核对到的现状与本次实跑的补充（截至 2026-09-06；标「未联网核实」的除外）

- fast-check 4.9.0（2025-07），运行时依赖只有 `pure-rand`；Quint 0.32.0 有 20 个运行时依赖；Apalache 0.62.x 要 Java 21，志愿维护；TLC 最新 tag 1.8.0；io-ts 两年未发版；Stryker 10 对自研框架只能用 `command` runner。
- **模型—代码一致性的已知做法**：TLA+ 社区的 trace validation（实现打 NDJSON，`XxxTrace.tla` 用 CommunityModules 的 `Json` 读入，把 `Next` 约束成「只能走日志里的下一步」）有论文（Cirstea / Kuppe / Loillier / Merz，SEFM 2024）与工具（`lbinria/trace_validation_tools`，2026-02 仍在提交；`tlaplus/Examples` 的 `ewd998`；Microsoft CCF 对 C++ Raft 做过）。判断：**方法成熟、工程化不成熟** —— 联网核对未找到 npm 包或 TS 插桩库（尚未验证有无）。
- **#75 的替代品，本次复现**：两份模型（TS 与 TLA+）互比可达状态集，五个场景 1586 / 2236 / 56 / 113 / 81 全部 `onlyModel = 0, onlyTlc = 0`。**复现条件**：TLC 必须带 `-deadlock -workers 1`，否则只给出几十个状态（本次记录到四个场景的数：68 / 46 / 29 / 40，第五个未记） —— H 第 0 步的「状态数不变」验收要钉住这两个参数。这条对拍对 429 重试与 IG 两级端点**无覆盖**（两份模型都没有）。
- **Agent 写形式化模型的可靠性**（搜索摘要，原文被代理挡住，未逐字核实）：一项对 25 个开源模型的评测，最好的 26.6% 能通过 TLA+ 解析、8.6% 能通过模型检查；另一项对 etcd Raft 一致性建模的正确率 < 8%，常见错误是写成教科书版。本文的判断（未测量）：让 Agent 写 TLA+ 是最不可靠的路，让 Agent 写 fast-check 属性并配变异是相对可靠的路；这与 F 节「模型不在复核者准入读物里」互相印证。
- **崩溃点穷举（零依赖，本次实跑）**：猴补 `node:fs` 的 11 个同步 API 并调 `module.syncBuiltinESMExports()`，不改产品代码就能数出一次 `persistListAndStatus` = **42 个 fs 调用**；在第 k 个调用处注入异常，42 个点上「名单要么旧要么新」与「不出现新名单 + ok 旧状态」（D4.j）全部成立；D4.i 的「不得截断」那一半要靠子进程 `SIGKILL` + `writeFileSync` 部分写入（0 / 1 / len−1 三档）模拟，**尚未验证**。对 P4 / D4 这意味着：单写入方的崩溃安全在异常注入粒度上可以穷举真实现，不需要模型；`SIGKILL` 粒度未验证；模型只在并发（多写入方交错）成为需求时才需要。

### E.3 分工边界（第 9 问的补充）

- **属性测试**回答「对实现随机采样，有没有违反性质的输入」—— 抓实现层的 bug（浮点、解析、边界）。
- **模型检查**回答「对状态机穷举，有没有违反不变量的交错」—— 抓设计层的 bug（崩溃窗口、写入顺序、并发）。
- **对拍**（模型式测试 / trace validation / 两份模型互比）回答「模型与实现、模型与模型是不是同一个东西」—— 它是前两者之间唯一的桥。
- **证明**（Z3 / 类型）回答「在这个编码下，性质对所有输入成立」—— 只用在小而稳的算术与结构上。
- **崩溃点穷举**是交点：崩溃点有限时，穷举真实现就是对真实现做的模型检查，不需要模型。

### E.4 明确推荐

| 对象 | 推荐 | 不推荐 | 理由 |
|---|---|---|---|
| **P3 预算试点** | ① 建议采用 #75 的 `formal-rule.ts` / `formal.ts`（J1）（零依赖 BFS 探索器 + 对拍夹具）进 `npm run check`（位置：`mutate` 之后、`selfcheck` 之前，按 #75），反例转夹具；② fast-check 模型式测试对拍真实 `Budget` + fake `TikHub`（人批：devDependency 与 lock 文件变更；被否则用自研约 50 行随机 + 固定 seed，无 shrink）；③ 两份 TLA+ 规约入库当参考文档：#75 的 `BudgetProtocol.tla`（安全性，与 TS 模型互比）与本会话的 `BudgetP3.tla`（活性 L1 / L2 的那份，附录二 `formal-p3/`），`--tla` 不进 CI（按 #75；入不入库是 J33）；④ Z3 的浮点证明脚本与结论入假设登记表 | Quint（收益不够）、Alloy、程序证明 | 实测：BFS 与 TLC 在小模型上计数一致、#75 上集合一致；对拍能抓 CE-3；总耗时毫秒级 |
| **P4 / D4 持久化** | 分两步：① **单写入方崩溃点穷举**（零依赖：猴补 `node:fs` + 子进程 `SIGKILL`，对真实 `persistListAndStatus` 的 42 个 fs 调用逐点杀，父进程读盘判 D4.i / D4.j / D4.k / D4.p）—— 不需要模型；② 并发成为需求时（ADR-66 重启条件）再用零依赖 BFS 建 `(T, L)` 上写入方交错的模型（`task.json` 三个写入方：三步协议、collect 断点、enrich；`creators.json` 两个：三步协议第二步、render），性质「¬(T ∈ {ok, absent} ∧ L 不是在 T 下产出)」，预期先给出 ADR-66 描述、memory track `threestep.ts` 场景 D3 复现的交错反例，再把候选修法（锁 / 条件更新 / 禁止并行）建进去比较 | 断电持久性的任何形式化（A5 已声明不保证）；在并发不是需求时建交错模型 | 崩溃点有限时穷举真实现比建模便宜且无漂移；交错问题才需要模型 |
| **D1 / D3 身份** | fast-check（或自研随机）属性：`creatorKey` 幂等；写入侧收下 ⇒ 读回 ok ∧ 查询命中 ∧ swapcase 命中；昵称相同 handle 无关 ⇒ 不合并；**某侧 ≥ 2 候选同信号匹配 ⇒ 一个都不合并**（D3「不确定」的候选定义，要评定）；任一侧未知 ⇒ 合并结果未知；同数组二次 link 返回 0 —— identity track 与 tools-research 已在 scratchpad 全部跑过一遍，可直接搬 | Alloy、模型检查 | 纯函数、无交错 |
| **P1 三态** | 类型层（`Observation<T>` + 穷尽断言）+ lint 升级（抓非字面量兜底）+ 外部响应与四个落盘 JSON 的手写形状校验 | 任何模型检查 | 结构问题 |
| **P2 产品事实** | 手写引用完整性检查 + 占位符三路径变异 | 语义工具 | 见 H 第 9 步 |

## F. 权限与治理

### 先说原则：分权的依据是「谁能让检查变绿」

最要防的模式是：

    修改代码 → 验证失败 → 自动放宽需求 / 假设 / oracle → 验证通过

它之所以危险，不是因为改需求本身不对，而是因为**同一个执行者在同一个上下文里同时握着「被检查的东西」和「检查的尺子」**。所以权限矩阵按「这件东西是尺子还是被量的」分，而不是按文件类型分：

- 被量的：普通代码、Skill 文本、配置、模型对实现的映射。
- 尺子：需求文本、判据与 EARS、词汇表 oracle、测试的期望值、变异集、模型不变量、假设登记表。
- 尺子的尺子：红线、流程文档、审计判定、**闸门代码与 CI 配置本身**。

**规则一句话：一次改动只能碰一类；碰了尺子的改动，验证它的不能是同一个上下文。**

### 角色：谁是「人」，谁是「独立上下文」

仓库今天只有一个人类身份（B18）。本文里的「人批」= 仓库所有者；「独立复核」= 一个没有参与写这段代码的上下文 —— 可以是新的 Agent 会话（`4-VERIFY.md`：独立性来自上下文隔离，不来自它是谁），但**同一模型家族的两个会话只满足上下文隔离、不满足先验独立**；触及红线的复核至少一方要有不同来源（人、不同模型、或规则工具）。复核记录的固定格式：逐条引用 EARS 子句 id，每条给三档结论（成立 / 不成立 / 没资格判断），第三档每条都要有去向（转人批或登记为未知）。「只有一个人」本身登记为已知缺口。

### 权限矩阵

三档含义：

- **自动**：Agent 可直接改、直接合（仍过 `npm run check`）。
- **提议**：Agent 可以改、可以开 PR，但合并前必须有独立复核，复核记录进 PR。
- **人批**：Agent 只能写提案（ADR 草案 / 提案文档），改动本身由人做或由人明确授权后 Agent 做。

| 对象 | 今天的规则（出处） | 今天靠什么守 | 提议的档 | 提议的守法 |
|---|---|---|---|---|
| 普通代码（`scripts/lib`、入口脚本） | 直接做（`process/README.md`「什么时候不走流程」） | 第二层：`npm run check` | **自动**；触及守红线的模块升为**提议** —— 「守红线的模块」按 `docs/ARCHITECTURE.md` 锚点表的「服务的需求」列含 P1–P5 者认定 | 不变 |
| Skill 文本（`skill/`） | 直接做 | 第三层 | **自动**；改「给用户的承诺」那一句走 SYNC 表 | 加一条 lint：`skill/` 里出现的需求编号必须在登记表里存在（今天 `arch` 只查 `scripts/`） |
| 测试（`scripts/test.ts`） | 「改测试让它绿」默认驳回；要改必须写 ADR（`4-VERIFY.md`、CONVENTIONS 第 8 条） | 第三层 + ADR 存在性 | **提议**（新增自动；修改或删除已有断言必须提议） | 新闸门：对 `test.ts` 的 diff 按**断言整行**（标签 + 表达式）比对，任何已有断言的改动都算「修改」，要求提交信息最后 trailer 块有 `oracle-change: ADR-NN`（重构用 `oracle-change: 重构` 显式豁免留痕）；无 trailer 红，有 trailer 绿且进审计计数。这是 `size-ok:` 同一形状的机制，`trailer.ts` 已有解析；判定需要 PR base，沿用 `size.ts` 的 ADR-63 机制 |
| 测试 oracle（期望值、属性、模型不变量） | `expected` 不许来自运行结果（`4-VERIFY.md`） | 第三层 | **提议**，且复核者只读需求与 EARS，不读实现 | 同上；属性测试的 `seed` 固定、反例夹具只增不删（删夹具 = 改 oracle）。**机器守不住的三种绕法**：断言恒真化、期望值改成运行结果、断言旁路执行 —— 只有恰好有变异的断言才会红，其余靠变异覆盖与独立复核；`eq()` 的字面量 `want` 被改时要求同一 diff 里断言旁的推导注释也变（弱守法） |
| 变异集（`mutations.json`） | 变异存活修测试不删变异；记错名下当场拦（ADR-34） | 第二层：`mutate` `attribution-rule` | 新增**自动**；删除或改 `find / replace`**提议** | 删变异要 `oracle-change:` trailer；`why` 的实现泄漏已有 lint；建议加「变异集基线不减」检查 |
| 需求文本（`text`） | 触及登记表即走 `2-CHANGE.md`；分类由提出者自填（第三层） | `spec` 查形状与编号；分类诚实靠自觉；**红线措辞改写与主干无基线比对，`--write` 一条命令即绿** | **人批**（Agent 写 ADR 草案 + 提议的 JSON diff，不合并） | 新闸门的一部分：PR 改了 `requirements.json` 的 `text / accept / ears` 时，要求关联一条新 ADR 且其「冲击的需求」含被改编号（`adr` 检查可扩展） |
| 判据 / EARS 子句 | 判据编号不改含义、不回收（`1-REQUIREMENTS.md`） | `spec` 查编号唯一；退役编号无机器守 | 新增判据**提议**（变更分类由评定者定）；修改已有判据的 `text` 或子句的 `when / while / if / unless / where / shall / shall_not` **人批**；只补 `outcome` / `examples` **提议** | 对每条判据算 `text + 子句的 when/while/if/unless/where/shall/shall_not` 的义务指纹（`unless` 与 `where` 各是一个例外槽或前提槽，加一条就是放宽，必须进指纹），指纹变了就要 ADR；只改 `outcome` / `examples` 不改指纹。义务指纹与 `content_hash` 并存（后者任何字段都进），要另算 |
| 词汇表 oracle | 今天不存在 | — | 新增术语**提议**；把 oracle 从机器类改成 `human` / `none`（放宽）**人批**；反向**提议** | `spec` 检查 oracle 方向 |
| 模型不变量（`formal-rule.ts` 的 `INVARIANTS`、运行时 assert） | #75：「指不回 `requirements.json` 的性质不许加」（测试断言） | 第二层（#75 合入后） | 删除或弱化**人批**；新增**提议** | 不变量清单只增不删；删除走 ADR |
| 假设登记表（D.7） | 今天散落 | 第三层 | 新增假设**提议**；把「已验证」改成「未验证」是诚实，**自动**；反向**提议**；**验证日期由人写，审计只读** | 登记表带失效触发器（D.7 的检测机制） |
| 红线（P1–P5 的 `text`） | 不参与取舍；不许作废（ADR-30）；改动必须独立复核（ADR-24） | `spec` 拦作废；独立复核靠协作平台规则（**仓库里看不到配置；`main` `protected: true` 但内容 403**） | **人批**；Agent 不得起草「放宽」方向的红线改动，**范围边界声明（「本条当前不保证」）也算放宽** —— Agent 只能指出「边界未声明」，措辞由需求所有者起草；可以起草「收紧」或「拆判据」的 ADR | 由人核对分支保护（required checks 含 `check` 与 `age`；触及 P1–P5 的 PR 需非作者复核），核对结果写进 `docs/SYNC.md` 一行 |
| **闸门代码与 CI 配置**（`scripts/check/*`、`package.json` 的 `check` 链、`.github/workflows/*`、分支保护） | `scripts/check` 归普通代码；判定模块必须有变异（ADR-62） | 第二层（变异）；CI 配置无守 | **提议 + 非作者复核**（整个 F 节的机制可以被它守的对象自己拆掉，所以这一行不能缺） | 新闸门的路径清单把这四类文件列进去：改了它们的 PR 必须有 `oracle-change:` trailer |
| 豁免（`p1-ok`、`size-ok`、`age-ok`、`JUDGMENT_EXEMPT`、`EXEC_EXEMPT`、selfcheck `EXEMPT`、`mutations.json` 的 `exemptions`） | 前三种理由必填且具名；后四种是代码内常量或只查 `req` 存在，`why` 非空都不查 | 第二层（形状）；实质自批 | 新增**提议** | 每类豁免的总数进审计报告，只增不减时报警（不红）；`exemptions[].why` 非空校验补上 |
| ADR | 追加不删改；就地更正用 ⚠️ 块 | `adr` 查编号与索引，对主干基线查「号还在 / 标题没变」 | 新增**自动**（它是记录不是尺子）；但「结论：采纳」不等于采纳 —— 记录人批结论的 ADR 必须能指到人批的痕迹（PR 里人类身份的批准或人类提交），没有痕迹的「采纳」按提案读 | 不变 |
| `process/`（通用层） | 改动要慎重；改了要同步入口文件 | **仅第三层**（没有任何检查读 `process/`；SYNC 表也没有这一行） | **人批**；`process/` 改动不得混进代码 PR | 建议：改 `process/` 的 PR 必须配 ADR；lint 禁止 `process/` 出现产品词 |
| 合并到主干 | PR + `check` 绿；红线改动要复核；合并者不能是写档方（`6-INTEGRATE.md`） | 协作平台；**实际 PR #78 改守红线的检查链、零 review、作者自合** | 普通代码**自动**（若平台允许）；其余按各自档 | — |
| 发布 / 回滚 | 无部署，「发布」= 合入主干；「回滚」= revert | git | **自动回滚只限「被量的」改动**；revert 一条收紧尺子的 PR 就是放宽，走提议 | G 节：回滚条件预定义，触发即 revert |
| 审计记录（claims 文件） | 由干净的一次 `npm test` 写（`claims.ts` 写盘资格）；不入库、可伪造 | 第二层 | **只由机器写** | 建议作为 CI artifact 持久化 |

### 三条硬约束

1. **任何触及「尺子」的改动都要留机器痕迹；与「被量的」同 PR 时更要。** PR 里出现 `test.ts` 已有断言的修改、`mutations.json` 的删除、`requirements.json` 的 `text / accept / ears` 修改、闸门代码或 CI 配置的修改 —— 任一项出现且没有 `oracle-change:` trailer 就红（纯尺子的 PR 也红，H 第 5 步验收里「只删断言的 PR」就是它）；有 trailer 绿且进审计计数。这是 ADR-35「一个 PR 装了四件事」与 ADR-54「按谁在写拆开」的机械版。
2. **放宽方向的改动，Agent 只能提议。** 机器能认的「放宽」：删断言、删变异、删不变量、oracle 从机器类变 `human` / `none`、豁免增加、`shall_not` 被删、`if` 条件加宽、新增 `unless` / `where`、范围边界声明。判不出来的按放宽处理。机器认不出的三种（恒真、改期望、旁路）见上表。
3. **验证失败之后的第一动作只能是改「被量的」。** Agent 在一次任务里如果先改了实现、验证红、再想改尺子 —— 必须结束当前上下文，把「尺子可能错了」作为一条 `2-CHANGE.md` 的反向输入另起 ADR 草案，由另一个上下文评定。**这条是第三层**，机器只守它的痕迹：一次 PR 里实现与尺子的提交交错出现，CI 打印警告并要求 trailer。

### 「Agent 可以做什么」的正面清单

- 修实现让现有测试变绿（不动测试）。
- 新增测试、变异、属性、不变量、运行时断言。
- 把一条散文假设登记进假设表（标「未验证」）。
- 把一条模糊判据的 `outcome` / `examples` 补具体（不改义务本身）。
- 写 ADR 草案、写提案、写复核意见。
- 执行预定义的回滚（限被量的改动）。
- 在参数层影子模式（G 节）下运行候选规则并记录对比数据。

### 独立复核的最低配置

- 复核意见逐条引用 EARS 子句 id，三档结论；没有第三档的意见按未完成处理；第三档每条有去向。
- 准入读物 = `4-VERIFY.md` 的清单（需求登记表、验收标准、对应的对外文档、类型定义、`mutate --brief`）+ EARS 子句 + 词汇表。**模型文件不在清单里** —— 模型是第二份实现，读了就和作者同源。

## G. 控制闭环设计

### 先承认回路的现状

把控制论的框图套到本产品上，第一件事是标出哪几段今天是**断开**的：

```
 目标(需求/红线/预算)
      │
      ▼
 控制器(人 / Agent)──控制动作──▶ 被控对象(scripts + skill + TikHub) ──▶ 输出(名单、草稿、成本)
      ▲                                                                      │
      │            ┌──── 传感器 A：检查链、审计、变异（逻辑正确性）◀───────────┤ 闭合
      │            ├──── 传感器 B：meta.json / task.json（成本、状态计数）◀────┤ 闭合
      │            ├──── 传感器 C：关键词表现表（U3）◀─────────────────────────┤ 闭合，但噪声大且与控制器同源
      │            ├──── 传感器 D：memory 的 contacted / replied / blocked ◀──┤ **半开**：由用户手工回填，S3 禁止主动索取
      └────────────┴──── 传感器 E：回复率、合作率、带货效果 ◀────────────────┘ **开路**：系统里不存在
```

结论先行：**今天能闭合的自演化只到「逻辑正确性」和「成本」这两条回路。** 凡是以「回复率」「名单质量」为目标的自演化，今天没有传感器，控制器只能凭空改，那不是演化，是漂移。本文不假装 E 段存在；H 节把「建 E 段传感器」列为需要产品决策的独立步骤。

**默认态是熔断。** 下面熔断条件里的传感器（版本指纹、扰动计数、一致率、实验台账）都是 H 第 1、10、12 步的产物；它们落地之前，任何参数层的自动演化都处于熔断态 —— 这不是缺陷，是「没有传感器就不动」的字面意思。

### 目标（参考量）

| 目标 | 形式 | 谁定 | 能否自动改 |
|---|---|---|---|
| 红线 P1–P5 | 硬约束，不是目标函数 | 人 | 否 |
| 安全不变量（模型层） | 硬约束 | 人批 | 否 |
| 预算 `limit`、达标人数 `target_count` | 每任务常量 | 用户 | 否 |
| 检查链全绿 | 布尔 | — | 否 |
| 关键词命中率、每人成本 | 软目标，可优化 | 人定方向，Agent 可提建议 | 参数层，且只在熔断解除后 |
| 回复率、合作率 | **今天不可观测** | — | 无从谈起 |

### 传感器：每一个都要答「unknown 怎么表示」

| 传感器 | 读哪里 | 测的是什么 | 测量 / 代理 | unknown 的表示 | 延迟 | 噪声来源 |
|---|---|---|---|---|---|---|
| 检查链 | `npm run check` 退出码与各步输出 | 逻辑与文档一致性 | 测量 | 检查可以「无从判断」（size 基线算不出时明说） | 分钟 | 假阳性（体量闸门）、同源污染 |
| 变异测试 | `mutate.ts` 的三态判定（抓到 / 崩溃 / 存活）+ 锚点失效 | 测试是否能失败 | 测量 | 崩溃与锚点失效都不算抓到 | 十分钟级 | 变异集只覆盖想到的形状 |
| 成本 | `task.json.requests`、`meta.json.cost_estimate_usd` | 请求数 × 单价上限 | **代理**（真实计费在 TikHub 侧） | 请求数可能**不可读或非法**（`null` / 字符串，B2）—— #75 的 `ledgerProblem` 让它变成显式拒绝而不是静默归零 | 即时 | 崩溃窗口、非 200 是否计费的假设、probe 不记账 |
| 采集覆盖 | `meta.json` 的 measured / unavailable / unqueried 三计数 | 数据边界 | 测量 | 三态分开计数 —— 这是本产品做对的地方 | 即时 | 「查询失败」与「未查询」同态（B6）；外部响应无形状校验（B7）；`profile_failed` 只在 stdout 不进 meta |
| 关键词表现 | 报告的关键词表 `found / passed / hit rate` | 搜索策略质量 | **代理**：`passed` 由 Agent 的语义判断给出 | **今天把「0 结果 / 请求失败 / 未跑」坍缩成「无此行」**（B16） | 每任务 | 样本小（一词几十人，IG ≤ 12）、判定者与控制器同源、`found` 随轮转顺序变、跨品类不可比 |
| 记忆回填 | `memory/creators.json` 的 `contacted / replied / blocked` | 真实联系结果 | 测量，但稀疏且不及时 | 缺字段 = 未回填，不是 false；读不出来 = 整个传感器失效（D4 已定成「不产出名单」） | 天到周 | 用户是否回填、是否准确 |
| 扰动计数（429、schema 未识别、IG 回退） | **今天不存在**（`tikhub.ts:96-100` 退避后不计数不落盘） | 环境扰动 | — | — | — | H 第 10 步才有 |
| 回复率 / 合作 | 不存在 | — | — | — | — | — |

**三条纪律：**

1. 任何进入控制决策的量，来源字段必须能表达三态。`meta.json` 里凡是数值，旁边必须有 `status` 或分三态计数；一个裸的 `0` 不得进入任何自动决策。**可机器守**（把 P1 lint 的思路扩到读 `meta.json` 的一侧）。
2. 传感器与控制器不得同源：由 Agent 判定的 `passed` 不能反过来自动调整 Agent 自己的语义判断规则，**也不能自动用于换词**（`keyword-strategy.md` 的换词逻辑与 `output-format.md:104`「下次调整策略的依据」今天就是同源回路）。**机器守不住「同源」本身**（I 节），能守的是结构：`fit` 之外加第二判定的落处 `fit_review: { by: 'human' | 'agent-2', value, at }`；每任务由用户盲判固定 N 条（起点 N = 10），一致率以三态进 `meta.json`（未抽检 / 抽检 n 条一致 k 条）；**一致率按桶跨任务累计，n ≥ 50 才成为决策输入**，单任务的 10 条只是记录；一致率未记录或未达 n 时关键词表不得作为任何改动（含换词）的依据。「重跑一次语义判断」不是零成本（LLM 成本、同会话不盲、没有落处）。
3. 每个传感器要有「失效」形态：读不到、样本不足、口径变了（软件版本、配置版本变了）—— 失效时控制器停手。**可机器守**。

### 状态估计：不看单点，看窗口 —— 先把数算出来

- **最小可分辨差**：用 Wilson 区间。以 SPEC 首轮记录的命中率量级（竞品词 30%、品类词 38%）算：n = 48 时半宽 ±0.13，n = 200 时 ±0.065，两个 n = 200 的窗口区间不相交需要相差 **≥ 14 个百分点**；SPEC 记录的那条「与预期相反」的观察只差 8 点，要每窗口 n ≈ 600（半宽 ≤ 4 点）到 1000（留出两窗口都偏的余量）才可能被判定。**结论要明说：以现有效应量，这个闭环在可见的将来只记录、不决策。** 这不是缺点，但不能给人「窗口攒够就能动」的印象。
- **窗口的口径**：按「同品类、同版本」分桶，桶内攒样本；跨品类不比（传感器表已写「跨品类不可比」）。
- **版本指纹只取影响该软目标的文件**（例如关键词命中率只看 `score.ts` 的维度加分与 `keyword-strategy.md`），不是整棵 `scripts/`。理由：主干每天 10–18 次合并（`git log --merges`），整树指纹会让窗口每天重置、永远攒不满。
- **起点数字**（可失败、待校准，写进假设登记表）：桶内 M = 200 名过粉丝闸门的候选；一致率阈值 ≥ 0.8；影子差异上限 = 分层变动 ≤ 10% 候选。

### 控制变量：写清能动什么、不能动什么

| 变量 | 在哪 | 谁能动 | 影响面 | 反馈延迟 |
|---|---|---|---|---|
| 关键词四维权重、竞品词 +15 | `scripts/lib/score.ts` 常量（`semantic-fit.md` 有副本） | 参数层：Agent 可提议，影子运行后人批 | 排序与分层 | 每任务 |
| 粉丝闸门阈值 5000 / 5000000 | `score.ts`（`assessment.ts` 的粉丝档独立写死） | 人批（它决定谁「凭空消失」；两份文档对「算不算改需求」矛盾，B20） | 名单成员 | 每任务 |
| 单关键词页数上限 `MAX_PAGES = 4` | `collect.ts:30` | 参数层，Agent 可提议；**无影子形式**（候选值意味着多发请求） | 成本与覆盖 | 每任务 |
| 每关键词轮转顺序 | `collect.ts` `run()` | 架构层，人批 | 维度多样性 | 每任务 |
| 语义匹配规则、反模式清单 | `skill/references/semantic-fit.md` | Skill 层：Agent 可提议，**不得由 Agent 依据自己的判定结果自动改** | 分层、名单 | 每任务 + 人工盲评 |
| 下一轮关键词的选择 | `keyword-strategy.md` 的换词逻辑 | Skill 层：同上 —— 它与上一行是同一种同源回路，不是参数层 | 召回 | 每任务 |
| 开发信写法 | `outreach-draft.md` | Skill 层：提议；效果无传感器（E 段开路），今天**没有任何数据可以支持改它** | 草稿 | 不可观测 |
| 预算、达标人数 | 用户输入 | 用户 | — | — |
| 风险阈值（P10 / P90、两个信号、8 个同行）、样本窗口 12 / 6、活跃 45 / 90 | `assessment.ts` | 人批（F8 / D8 / D10 的判据写死了数字，改它是改需求） | 降级 | 每任务 + 盲评 |

**参数层的变量要先集中**：今天它们散在 `score.ts`、`collect.ts`、`assessment.ts`、`tikhub.ts` 里；单变量守法（一次 PR 只允许 diff 一个键）要求它们在一个配置文件里 —— H 第 12 步。

**不可控的识别办法（第 17 问）：** 对每个软目标，列出上表里能动的变量，再问两句 —— (a) 有没有传感器能在它变动后分辨出结果的变化（桶内区间是否可能分开）；(b) 变动它是否触碰任何红线或人批项。任一句答「否 / 不知道」，就把这个目标标成「当前不可控」，写进假设登记表，**停止对它的自动演化**。回复率就是这样被判定为不可控的：既无传感器，又只有文案一个变量，而文案不是唯一原因。关键词命中率在现有效应量与样本量下也是「当前不可决策」。

### 扰动与噪声

| 扰动 | 怎么察觉（今天 / 提议） | 对策 |
|---|---|---|
| TikHub 响应结构变化 | 今天：`pickList` 完全识别不出时打印顶层 key；**半漂移（数组在、item 形状变）静默成「0 人且标完成」**（sensors track）；提议：`raw_count > 0 但入库 0` 的关键词计数进 `task.json` | 计数 > 0 即冻结所有参数层演化 |
| TikHub 限流 / 单价变化 | 今天：无（429 不计数）；提议：`task.json` 累加 429 次数；单价假设在登记表里 | 单价假设失效 → P3 的性质结论降为未知（D.7） |
| IG 回退到 `search_users` | 今天：不记录（`tikhub.ts:294`） | 提议记录来源端点 |
| 平台搜索质量随时间漂移 | 同一关键词跨窗口 `found` 数下降 | 只记录，不自动调关键词 |
| 季节、市场 | 无传感器 | 不做 |
| 测量噪声：小样本 | 桶与区间 | 低于最小可分辨差不决策 |
| 测量噪声：Agent 判定不稳定 | 一致率抽检（纪律 2） | 一致率 < 阈值时关键词表不得用于决策 |

### 稳定性：迟滞、冷却、单变量、灰度、回滚、熔断

- **迟滞**：改一个参数的触发条件与改回的触发条件不对称。例如「竞品词权重下调」的触发是连续两个桶命中率区间低于品类词；改回的触发是连续三个桶高于。
- **冷却期**：任何参数层改动之后，至少一个完整桶内不得再改任何参数层变量。同一时间只允许一个在途实验。
- **单变量**：一次改一个变量；机器守法要求参数集中（上文）。
- **实验台账**：迟滞、冷却、振荡检测都需要「上次改了什么、何时、桶内结果」的跨任务记录；今天只有每任务的 `meta.json`。台账是 H 第 12 步的产物，没有它这一段不可执行。
- **灰度 = 参数层的影子运行。** 本产品没有多用户、没有部署，传统灰度不适用。可行的形式**只对纯评分常量**（`score.ts` 的维度加分、竞品词加分、tier 阈值）成立：候选参数与现行参数同时计算（本地纯函数，不花 TikHub 的钱）；`MAX_PAGES` 这类改变请求数的参数**没有影子形式** —— 候选值意味着多发请求，那是花钱不是计算，候选结果写进一个 **Agent 不读的文件**（`shadow.json`，SKILL.md 明写不读，lint 守 `skill/` 里不出现这个文件名），交付物仍按现行参数产出；累积到桶满后人看一眼再决定翻开关。**Skill 层规则（语义匹配、开发信）没有影子形式** —— 候选规则的「并行计算」意味着 Agent 对同一批人再判一次，那是 LLM 成本且同会话不盲；Skill 层只有人工盲评。
- **回滚条件预定义**：翻开关的那条 PR 里必须写明回滚触发器（例如「两个桶内命中率区间低于翻开关前」或「任何一次 P1–P5 相关检查变红」），触发即 revert，不等复核（限被量的改动，F 节）。**回滚是安全动作，不是归因**：revert 后指标回升不证明那次改动是原因，归因仍要单变量 + 对照 + 窗口。
- **熔断**（停止一切自动演化的条件，任一命中即停）：
  0. 任一传感器不存在（版本指纹、扰动计数、一致率、台账）—— **今天全部命中**；
  1. 任何红线判据的测试或变异变红；
  2. 假设登记表里任一条 P3 假设被标为失效（单价、计费规则、原子写）；
  3. 传感器失效：`meta.json` 缺 `versions` 块、schema 半漂移计数 > 0、记忆读不出来；
  4. 影子运行与现行结果的差异超过上限（说明候选规则不是「微调」）；
  5. 同一目标连续两轮实验方向相反（振荡迹象，从台账读）；
  6. 一致率抽检低于阈值。

熔断之后只允许回滚与修复，不允许新实验；恢复需要人解除。

### 把「自演化层级」映射到本产品

| 层级 | 本产品对应 | 传感器 | 今天能否自动 |
|---|---|---|---|
| 1 运行参数 | `MAX_PAGES`、退避间隔 | 成本、429 计数（提议） | 今天否（熔断 0）；无影子形式（改它就花钱），H 第 12 步后只能小步改 + 人批 |
| 2 配置与策略 | 维度权重、竞品词权重 | 关键词表现表（噪声大） | 只能提议 + 人批；纯评分常量可影子运行（H 第 12 步） |
| 3 prompt / 知识 / 工作流 | `skill/references/*` | 人工盲评 | 只能提议 |
| 4 代码与测试 | `scripts/` | 检查链 | 修实现自动；改尺子提议 |
| 5 架构 | 模块边界、顺序契约 | 架构锚点检查 | 人批 |
| 6 需求变化 | `requirements.json` | 无 | 只能提议（ADR 草案） |
| 7 真实业务反馈实验 | 回复率 | **无** | 不可能，先建传感器 |

## H. 渐进落地计划

组织原则：每一步是一条能在 48 小时内合入的 PR（`6-INTEGRATE.md` 的分支寿命），只回答一个证据问题，验收在合入前就能跑出来。**不重写任何东西。** 每步标 F 节的档（自动 / 提议 / 人批）；「下一步」是正向依赖，依赖图在本节末尾。

### 第 0 步 · 决定 PR #75 的去向 —— 人批

- **背景**：PR #75 是 D 节那个试点的**已有实现**（对照表在附录三）。它今天合不进去：draft、2148 行新增、18 个文件、base 落后主干 5 次合并（按 base sha 算；按真实分叉点算 9 次）、`mergeable_state: dirty`、`M-H16-a/b/c` 已被 #78 占用。用仓库自己的 `categorize()` 归类，它的源码类新增合计 1277 行（`formal-rule.ts` 903 + `formal.ts` 203 + 其余 171）vs 体量线 350；「闸门自身走最后一块砖」被一条 PR 装完。
- **推荐：拆成五条，每条从主干开**：
  - **0a** ADR-68 单独先合（ADR 不依赖代码）—— 文档类；自动。
  - **0b** `budgetProblem / ledgerProblem` + 三条入口的校验 + 测试 + 变异（#75 的 `M-P3-c / M-D6-i`）—— CE-1 的修复，源码 < 150 行（估）；**这一步是整个计划里价值最高、代价最低的一步**；提议（触及守 P3 的模块）。
  - **0c** `formal-rule.ts` 拆两块：模型核心（状态、动作、不变量、探索）一条 PR，对拍夹具（`runConformance`、trace 打印）一条 PR；各含 `harness` 测试与重编号后的 `M-H1x-*`，锚点表登记；提议。
  - **0d** `formal.ts` 入口 + `package.json` 接线 + SYNC 行（最后一块砖）；提议 + 非作者复核（闸门代码）。
  - **0e** `formal/` 目录（TLA+、README、`IMPLEMENTATION-MAP.md`）—— 文档类，`.tla` 180 行落「其他 200 行」；自动。
- **不修改**：任何需求文本；`--tla` 保持在检查链外。
- **产物**：五条已合 PR，或一条「弃用 #75、按 D 节重做」的 ADR。
- **验收**：每条 PR `npm run check` 绿；拆分后五个场景的可达状态数与最短反例长度与 #75 记录一致（TLC `-deadlock -workers 1`）。
- **成本**：一到两天。**风险**：拆分时改坏模型 —— 用状态数与反例长度对账。
- **下一步**：0b 解锁第 3 步；0c/0d 解锁第 3、7 步。

### 第 1 步 · 假设登记表与版本指纹 —— 提议（触及 `meta.json` 字段的部分要评定是否触及 U7）

- **修改**：新增 `docs/assumptions.json`（D.7 的 A1–A9，含失效触发器与检测方式）；`render.ts` 给 `meta.json` 加 `versions: { code, config, provider_shape, node, by_target: { <软目标>: <只含影响它的文件的指纹> } }`（G 节：整树指纹会让窗口每天重置）；审计读登记表，未验证 / 过期 / 待重验的假设列进报告（不硬失败）。旧任务目录缺 `versions` 时报告声明「版本未知」（ADR-18 方向）。
- **不修改**：ADR-13「缓存不引版本号」—— 这里加的是交付物的版本指纹，不是缓存键；写一条 ADR 说明两者不同（B17 要人定）。
- **产物**：登记表、meta 新块、审计新栏、ADR。
- **验收**：`selfcheck` 里 `meta.json.versions` 四个字段非空；登记表形状有校验与变异；A1 / A2 各有一位负责人与目标日期（人）。
- **成本**：小。**风险**：登记表变成没人读的字段 —— 对策是审计读它。
- **下一步**：解锁第 10 步与 G 节熔断 3。

### 第 2 步 · EARS 字段最小落地（C.6 的 1–5）—— 提议；第 3 条 PR 的分类由评定者定；第 5 条 PR 里每条红线子句过独立复核

- **修改**：ADR（直面 ADR-67）→ `ears-rule.ts` + 三个消费者同一条 PR（校验、SPEC 派生渲染行、审计「靠什么验」列）+ `M-H4-l` 起的变异 → `terms`（D.2 未标草案的十三个）+ `retired_ids`（五个）+ `ears_policy: none` + 指纹回写 → P3.a / P3.b 挂子句（不挂 `unless / boundary_of`，等 J9）→ `ears_policy.require` 升到 `redline`（其余 15 条红线判据各写子句或显式 `none`，每条过独立复核）。五条 PR。
- **不修改**：任何 `text`；其他 97 条判据。
- **产物**：五条 PR；一份「EARS 化时写不出 oracle 的判据清单」（只登记不改；处置是 J46）。
- **验收**：`npm run spec` 对坏子句（缺术语、空 `shall`、退役 id 重加）变红且每条规则的变异被抓到；SPEC 里 P3.a 下出现派生行；第 3、4 条 PR 期间 R8 只警告（`require = none`），第 5 条之后 R8 变红且零孤儿。
- **成本**：中。**风险**：术语表长成第二份需求 —— R8 孤儿术语红。
- **下一步**：解锁第 3、5、6 步。**不依赖第 0 步**（`Level` 词表已写进 C 节，不依赖 #75 合入）。

### 第 3 步 · P3 草案判据评定与实施 —— 人批（P3.d、P3.e、P3.f）；提议（P3.c：补充，不走评定，过独立复核）

- **修改**：一条 ADR 提交 D.2 的四条草案与「边界未声明」的登记，逐条给提议分类、逐条裁决（D.15 第 6 条）。采纳后：测试先行（**独立上下文**，只读 EARS 与术语表）→ 实现（P3.e 的适配层回调是顺序契约改动，单独 ADR + 顺序契约变异；P3.f 的整数单位单独 ADR）→ 变异（D.11 的 N1–N7，落地时续编）→ 模型加 `write-ahead` 与 `two-level-endpoint` 场景。
- **不修改**：P3 的 `text`；F7 的判据（「一次」留给 ADR-68 那张欠条另行评定）。
- **产物**：ADR、判据、测试、变异、模型场景、写前记账的 3000 请求基准数。
- **验收**：D.15 的六条。
- **成本**：中。**风险**：P3.d 的产品取舍拖住整条 —— P3.c / P3.e / P3.f 与 P3.d 分开评定。
- **下一步**：解锁第 6、7 步的推广判断（go / no-go 见本节末）。

### 第 4 步 · 属性测试设施 —— 人批（引不引 fast-check）

- **修改**：先一条只改 lock 文件的 PR 量 `npm ci` 时长（2026-09-04 的 7 分钟根因未明，`age` 是必需检查、贴在 `npm ci` 之后）；超过 60 秒则改用自研约 50 行 `forAll`（固定 seed、失败走 `fail++` 不 throw、无 shrink）。然后落三组属性：P3（D.10）、D1 / D3（identity track 与 tools-research 已跑过的六条）、D5（CSV round-trip）。
- **不修改**：变异跑的次数（属性用例数按「× 229」预算，D.10 已拆好）。
- **产物**：一条 ADR（依赖决策 + `npm ci` 实测数）+ 属性测试 + 每条属性至少一个变异。
- **验收**：`npm run mutate` 无存活；`npm test` 时长增量 < 1 秒；seed / path / replayPath 的重放写进 `4-VERIFY.md`。
- **成本**：小。**风险**：随机性让 CI 结论不稳定 —— seed 写死，只允许本地环境变量重放。
- **下一步**：解锁第 8 步；第 3 步的属性测试可先用自研版。

### 第 5 步 · 「改尺子」的机器痕迹 —— 提议 + 非作者复核（它是闸门代码，F 节）；按最后一块砖；`process/` 改动单独人批

- **修改**：`scripts/check/oracle-rule.ts`（判定：diff 里是否改了 `test.ts` 已有断言整行、删了 `mutations.json` 条目或夹具、改了 `requirements.json` 的 `text / accept / ears`、增加了豁免、改了闸门代码或 CI 配置；是则要求最后 trailer 块有 `oracle-change: ADR-NN` 或 `oracle-change: 重构`）→ 测试 + 变异 → 入口 `oracle.ts` → 接进 `check` 链（`size` 之后）。三条 PR。判定需要 PR base，沿用 `size.ts` 的 ADR-63 机制。**`process/` 里那一句纪律单独一条 PR，人批。** 同时**由人**核对 `main` 的分支保护，结果写进 `docs/SYNC.md`。
- **不修改**：既有豁免机制。
- **产物**：新闸门；分支保护核对记录；`4-VERIFY.md` 的一句。
- **验收**：一条只删断言的 PR 在 CI 红；带正确 trailer 的绿且审计计数 +1；变异「不认 trailer」被抓到；三种绕法（恒真、改期望、旁路）在文档里明写「机器守不住」。
- **成本**：中。**风险**：假阳性（重构移动断言）—— 用 `oracle-change: 重构` 留痕而不是放宽判定。
- **下一步**：解锁第 9 步（改字段所有权）。

### 第 6 步 · P1 三态的结构化（推广一）—— (a) 自动 / 提议；(b) 人批（架构）

- **修改**：(a) 三件零需求变更的：`lint-rule.ts` 抓非字面量兜底并清理 9 处多余 `p1-ok`（提议：改闸门）；`render.ts` 的 `countMeasurements` 对未知 status 报错而不是漏数（自动）；`report.ts:129` 把 email `undefined` 显示成「未查询」—— 报告措辞是 U 类交付物且把 P1 口径扩到报告层，**写一条「补充」ADR**（提议）。(b) 一条 ADR 提议 `Observation<T> = Unqueried | MeasuredPresent<T> | MeasuredAbsent | Unavailable<Reason>` 作为 Creator 层的架构决策，迁移按读点数分批（email 9、bio 10、followers 29：一批一个字段）；(c) 外部响应与四个落盘 JSON 的手写形状校验；(d) `bio_links` 二态导致续跑重查（B6）是需求歧义，先 ADR。
- **不修改**：P1 的 `text` 与四条判据；`_interface.md` 的跨层契约。
- **产物**：三条零变更 PR + 两条 ADR + 分批迁移 PR。
- **验收**：observation track 的 probe A / B / D / E 在仓库内变成测试并全绿；新增变异「把 Unavailable 折叠成 Unqueried」被抓到。
- **成本**：中到大。**风险**：迁移面。
- **下一步**：解锁第 10 步的三态化计数。

### 第 7 步 · P4 / D4 持久化（推广二）—— 提议；并发裁决人批

- **修改**：① 单写入方崩溃点穷举（E.4：猴补 `node:fs` + 子进程 `SIGKILL`，42 个调用点 + 部分写入三档）进 `check` 链，D4.i / D4.j 获得 `criterion()` 认领；② 只在 ADR-66 重启条件触发时，复用第 0 步的探索器建 `(T, L)` 上写入方交错的模型（`task.json` 三个写入方、`creators.json` 两个），预期先给出 memory track `threestep.ts` 场景 D3 复现的交错反例，再把候选修法建进去比较。
- **不修改**：D4 的「不保证」正文，直到评定完成。
- **产物**：崩溃点夹具、认领、（可选）模型场景与评定 ADR。
- **验收**：与异常注入同一组调用点（异常注入粒度数出 42 个；`SIGKILL` 粒度的点数未实测）全部满足 D4.i / D4.j / D4.k / D4.p；异常注入结果与本次实跑一致。
- **成本**：中。**风险**：`SIGKILL` 方案未实测，耗时未知。
- **下一步**：解锁并发裁决。

### 第 8 步 · 身份去重（推广三）—— 提议；两处产品取舍人批

- **修改**：`identity.ts` 接 `creatorKey`（修 D1.c 在去重那一半的缺失）；lint「禁止手拼 `${platform}:${handle}`」；第 4 步的六条属性进仓库；合并结果加 `merge_reason`。**人批**：`filterByMemory` 查询侧是否过 `keyProblem`（拒绝会中止出名单，放行是今天的静默漏过）；「某侧 ≥ 2 候选同信号 ⇒ 不合并」是否是 D3「不确定」的定义。
- **不修改**：D1 / D3 的判据文本。
- **产物**：两条 ADR、属性测试、lint、变异。
- **验收**：identity track 的 run1 / run2 实验在仓库内变成测试；`TikTok:dana` 与 `tiktok:dana` 合并；查 `alice ` 的行为按 ADR 的裁决；歧义输入按裁决。
- **成本**：小到中。**风险**：查询侧收紧后真实 API 返回带空白 handle 的比例未知（B10）。
- **下一步**：无。

### 第 9 步 · P2 claim-evidence 契约（推广四，最后）—— (a) 自动；(b)(c) 人批

- **修改**：(a) 零需求变更：XLSX 与 HTML 路径的占位符变异（B12）；CSV 断言读回落盘文件。(b) 设计（走 `5-DESIGN.md`，改字段所有权是改尺子，依赖第 5 步）：新文件 `product-facts.json`（Agent 拥有，Phase 01 写，render 只读）装 `Evidence{ id, sourceUrl, observedAt, contentHash, excerpt }` 与 `Claim{ id, text, evidenceIds, status: 'supported' | 'placeholder' | 'offer' }`；`Creator.outreach_claim_ids`；render 的机器检查：每个 `supported` claim 的 `evidenceIds` 存在、`sourceUrl / observedAt` 穿透到数据边界、三条路径占位符计数一致；**词法 token 覆盖只做成 P5 形状的声明**，不做硬失败。(c) 判据草案 P2.c（引用完整性）与 P5.i（覆盖声明）；评定后 P2.a 的豁免 `scope` 收窄 —— P2 是红线，**动豁免要独立复核**（ADR-24）。
- **不修改**：P2.a / P2.b 文本；判断力仍在 `skill/`。
- **产物**：变异、设计文档、两条 ADR。
- **验收**：一份自洽但编造的 claim / evidence 能通过机器检查 —— **写进 I 节，不当 bug**；机器抓到的是「引用断了」「占位符被抹」「来源丢了」。
- **成本**：中。**风险**：Phase 01 抓页今天不落盘，要新增入口与产出文件（缝隙契约改动）。
- **下一步**：无。

### 第 10 步 · 控制闭环的最小传感器 —— 提议；U3.a 措辞人批

- **修改**：U3 关键词表按 `task.json.tasks` 出全行，状态三态化（`found = 0 / error / not_run`）—— 改 U3.a 的判据措辞，**要评定**；`task.json` 累加 429 次数、schema 半漂移（`raw_count > 0 但入库 0`）关键词数、IG 回退次数；`profile_failed` 带原因分布并进 `meta.json`（是否触及 U7 要评定）。
- **不修改**：`fit_pass` 的定义。
- **产物**：判据 ADR、计数、报告行。
- **验收**：selfcheck 里 429 夹具之后 `task.json.rate_limited === 1`；关键词表对 `error` 关键词出行。
- **成本**：小。**风险**：低。
- **前提**：第 1 步（`versions` 块）；第 6 步 (a) 的 `countMeasurements` 报错（三态化计数的地基）。**下一步**：解锁第 12 步。

### 第 11 步 · 反馈回路 E 段 —— 人批（产品决策）

- **修改**：无代码；一条 ADR 提出「`replied` 的只读消费者（按 keyword / dimension / tier 汇总）是否算 S3 禁止的『索取回填』」。
- **不修改**：S3。
- **产物**：一条 ADR（采纳 / 驳回 / 已知缺口）。
- **验收**：ADR 存在且给出重启条件。
- **成本**：零。**风险**：无。
- **下一步**：采纳则解锁「以业务效果为目标」的实验；驳回则 G 节的禁令永久化。

### 第 12 步 · 参数集中、实验台账、一致率抽检 —— 提议

- **修改**：参数层变量集中到一个配置文件（`score.ts` / `collect.ts` / `assessment.ts` / `tikhub.ts` 的常量），单变量守法「一次 PR 只 diff 一个键」进 oracle-rule；`Creator.fit_review` 字段与每任务固定 N = 10 条用户盲判，一致率三态进 `meta.json`；跨任务实验台账 `experiments.json`（改了什么、何时、桶、结果）；`shadow.json` 影子块 + SKILL.md「不读」+ lint。
- **不修改**：`fit` 的判定规则。
- **产物**：配置文件、台账、影子机制、lint。
- **验收**：G 节熔断 0 的四个传感器全部存在，熔断默认态解除。
- **成本**：中。**风险**：一致率抽检增加用户负担 —— N 可调，起点 10。
- **前提**：第 1、10 步；「单变量守法进 oracle-rule」那一项依赖第 5 步。**下一步**：纯评分常量的影子运行与人批翻开关（`MAX_PAGES` 类没有影子形式，G 节）。

### 推广的 go / no-go（从 P3 到其他对象）

- **go**：D.15 六条成立 **且** 第 0 步（0b 至少）已合入 **且** 第 2 步的 `ears_policy` 到 `redline`。
- **no-go**：D.15 任一失败条件成立；或第 0–3 步累计超过四个 48 小时周期还没合入（切法有问题，先修切法）。
- **只做一件事做哪件**：0b（CE-1 的修复）。
- **A1 / A2 的账单验证**：一位负责人、一个日期、一次真实任务的费用（按 SKILL 的 probe 预算量级）—— 第 1 步的验收项。

### 状态文件与交付物的 schema 演进

新增字段（`task.json.budget_assumed`、`meta.json.versions / budget / shadow`、`assumptions.json`、`product-facts.json`、`experiments.json`）的读取规则统一按 ADR-18：**缺失读作「无从确认」，不读作 `false` / `0` / `ok`**；旧任务目录续跑（D6）时缺字段不算不兼容；与 ADR-13「不引版本号」的关系是「交付物的版本指纹 ≠ 缓存键」，第 1 步的 ADR 写明。

### 依赖图（正向）

```
0a, 0b, 0c, 0d ──→ 3 ──→ (go/no-go) ──→ 6, 7
0c, 0d ─────────────────────────────→ 7（第 7 步 ② 复用探索器）
1 ──→ 10 ──→ 12 ──→ 纯评分常量的影子运行
6(a) ─→ 10
2 ──→ 3, 5, 6
4 ──→ 8
5 ──→ 9(b)(c), 12
11 ─→ E 段实验（若采纳）
```

### 全部步骤的共同验收

- 每条 PR 单独 `npm run check` 绿；不用 `size-ok` 的优先，用了必须指名类别与理由。
- 每一步结束后 `npm run audit` 的缺口数**允许增加**（新登记的假设、新单列的 `human` / `none` oracle）—— 缺口变多是可见性提高；缺口变少而没有对应 PR 才是警报（`4-VERIFY.md`）。

## I. 已知做不到的部分

只用三种措辞：**能做到**（有证据或有明确构造）、**做不到**（原理上或本仓库现状下不可能）、**尚不知道**（没验证过，且本文不假装知道）。

### 关于需求与 EARS

| 事项 | 结论 | 理由 |
|---|---|---|
| 用 EARS 后需求无歧义 | **做不到** | EARS 约束形状；术语的歧义由词汇表约束，词汇表条目本身的歧义只能靠人 |
| 机器判定一条 EARS 义务「可判定」 | **做不到**；能做到的是「每个术语都有一个声明了 oracle 的定义」 | 可判定性是语义性质；机器只能查引用是否解析、oracle 是不是 `human` / `none` |
| 机器判定 `text` 与 `ears` 说的是同一件事 | **做不到**；能做到的是终态由 `ears` 派生 `text` | 跨语言、跨形式的语义比对没有裁决器 |
| 机器挡住全部实现方式泄漏 | **做不到**；能挡代码运算符与内部命名（`why-rule.ts` 已有） | 自然语言里的实现方式没有可靠判据 |
| 自动把旧判据翻译成 EARS | **能做到**草稿，**做不到**免复核 | 翻译是改尺子，按 F 节必须独立复核 |
| 一条需求多义务的拆分由机器判 | **做不到** | 判据是「会不会被不同代码路径独立弄坏」（ADR-24），要读实现结构 |

### 关于形式化验证

| 事项 | 结论 | 理由 |
|---|---|---|
| 证明整个 TypeScript 项目正确 | **做不到**，也不打算 | 状态空间、外部环境、语义判断都不在可枚举范围内 |
| 证明模型忠实于代码 | **做不到**；能做到的是对拍与两份模型互比持续找不一致 | 一致性是测试问题，不是证明问题 |
| 证明 TikHub 计费规则、「非 200 不计费」、「发出未响应是否计费」 | **做不到**；能做到的是把假设写进登记表并给失效触发器、按供应商账单人工对账 | 环境假设；D.7 的 A2 / A3 |
| 用类型系统保证反序列化数据可信 | **做不到** | 静态类型对运行时输入一个字段都不拦（`4-VERIFY.md`、ADR-19）；只能运行时校验 —— #75 的 `budgetProblem / ledgerProblem` 就是这一层 |
| 用模型检查验证外部数据真实 | **做不到** | 模型检查只枚举模型 |
| 用属性测试证明性质 | **做不到**；能做到的是在随机样本内没找到反例 | 采样不是穷举；找到反例是确定的，没找到不是 |
| 用有界模型检查证明无界性质 | **做不到** | #75 五个场景的 `truncated` 全为 true（本次复现）：界外没有结论 |
| 在本仓库 CI 里跑 TLC / Apalache | **尚不知道** | `ubuntu-24.04` 镜像文档列有预装 JDK（联网核对），本仓库 CI 未验证；#75 与本文都把 `--tla` 放在检查链外 |
| 浮点比较的完全形式化 | **能做到**避免（用整数毫美元）；**能做到**对给定范围证明（Z3 FloatingPoint 理论，实跑：`m < 9` 无误拒、`[1,2000]` 无多放行）；**做不到**在浮点上做全域证明并进 CI | 编码是 SMT-LIB 字符串、每问 2–9 秒、context 复用有坑 |
| 崩溃语义的完全建模 | **能做到** fs 调用级崩溃点穷举（单写入方一次 `persistListAndStatus` = 42 个调用点，异常注入实跑；`SIGKILL` 粒度与部分写入三档尚未验证）；**做不到**断电语义 | ADR-50 已把持久性降为尽力而为；断电时写入的可见性取决于文件系统 |
| 并发写入方交错 | **做不到**在今天保证；能做到的是建模并列出反例 | D4/P4/P5 已明写「当前不保证」（ADR-66），要保证先改需求 |
| Agent 自己写 TLA+ 模型的可靠性 | **尚不知道**在本仓库；外部评测（搜索摘要，原文被代理挡住）报 26.6% 解析通过 / 8.6% 模型检查通过 | 本文因此不把「Agent 写 TLA+」放在任何自动路径上 |

### 关于测试与同源

| 事项 | 结论 | 理由 |
|---|---|---|
| 机器检测同源污染 | **做不到** | `4-VERIFY.md`：变异抓不到；只有独立上下文复核 |
| 机器验证复核者独立 | **做不到** | 不可观测，第三层 |
| 同一模型家族的两个会话满足「先验独立」 | **做不到**；能做到的是上下文隔离 | ADR-04 说污染是「误解被完整复制」，共享训练先验的误解不通过上下文传播；红线复核至少一方要有不同来源 |
| 机器验证「写测试时没读实现」 | **做不到** | 同上 |
| 机器分辨「放宽」与「收紧」 | **能做到**部分：删断言、删变异、删不变量、oracle 从机器变 `human`、豁免增加、`shall_not` 被删；**做不到**：断言恒真化、期望值改成运行结果、断言旁路执行（`if (process.env.CI) return`）—— 这三种只有恰好有变异的断言才会红 | 三种绕法在 F 节矩阵「测试 oracle」行 |
| 机器分辨「补充 observe」与「改义务含义」 | **能做到**形状层面：按义务字段指纹（含 `unless` / `where`）分 | 指纹是形状判据，语义上的改义务绕得过；绕过的痕迹靠复核 |

### 关于控制闭环

| 事项 | 结论 | 理由 |
|---|---|---|
| 以回复率、合作率为目标的自演化 | **做不到**（今天） | 无传感器；S3 不索取回填；`replied` 由外部手写且没有读者 |
| 把线上指标改善归因到某次改动 | **做不到**，除非单变量 + 对照 + 窗口 | 相关不是因果 |
| 用关键词表现表自动调语义规则或自动换词 | **做不到**（禁止） | 传感器与控制器同源；`output-format.md:104` 今天就把这张表定为「下次调整策略的依据」，这句话本身就是同源回路 |
| 用「重跑一次语义判断」零成本测一致率 | **做不到**零成本 | 重判是 LLM 成本、同会话不盲、`fit` 只有一个字段没有第二判定的落处 |
| 传统灰度发布 | **做不到** | 无多用户、无部署；替代是**参数层**的影子运行；Skill 层没有影子形式，只有人工盲评 |
| 在 SPEC 记录的效应量（8 个百分点）下，用 n=200 的窗口判定关键词命中率变化 | **做不到** | Wilson 半宽在 n=200 时 ±0.065，两窗口区间不相交需相差 ≥ 14 点；要每窗口 n ≈ 600–1000 |
| 在当前合并频率下攒满一个「同版本」窗口 | **做不到**，若版本指纹取整棵 `scripts/` | 主干每天 10–18 次合并（`git log --merges`）；指纹必须只取影响该软目标的文件 |
| 判断语义筛选相比静态评分提升多少、公开信号风险的准确率 | **尚不知道** | `SPEC.md` 已列为待盲评 |

### 关于 P2 自然语言事实

| 事项 | 结论 | 理由 |
|---|---|---|
| 机器判定 evidence 语义蕴含 claim | **做不到**；能做到的是引用完整性、来源与时间不丢、render 保留占位符 | 语义蕴含没有裁决器；用另一个模型判也是「没资格给出完全确定结论」的一种 |
| 机器判定 claim 没有夸大、一个数字是产品事实还是创作者事实还是 offer | **做不到** | 同上 |
| 机器识别一份自洽但编造的 claim / evidence | **做不到** | 与 ADR-04 同源污染同形：检查只证明「引用对得上」 |
| 让 Agent 自己复核自己的 claim | **做不到**当作证据 | 同源 |

### 关于本文自身

| 事项 | 结论 |
|---|---|
| 本文引用的行号在仓库演进后仍然正确 | **做不到**；引用的是 2026-09-06 主干 `cc132a7` 与 #75 分支 `97c358e` |
| 本文标「实跑」的事项在其他环境成立 | **尚不知道**；验证环境是本次会话的 Linux 容器（Node 22.22.2、Java 21），且脚本与输出不在仓库内，仓库读者只能按附录二复现，不能复核 |
| 本文对 #75 的复核算 `4-VERIFY.md` 意义上的独立复核 | **做不到**：本会话在复核前读了 #75 的模型，按 F 节的准入清单已不独立；本会话在读 #75 之前用实跑确认了 CE-1 / CE-2 **存在**，那是对代码缺陷的独立确认，不是对 #75 尺子的复核 |
| 本文取代变更评定 | **做不到**；它是提案，任何触及 `requirements.json` 的改动仍走 `process/2-CHANGE.md` |

## 附录一 · 待裁决清单（全文里标「人批 / 要人定」的地方，一处不落）

| # | 裁决点 | 出处 | 落在 H 的哪一步 | 类型（提议） |
|---|---|---|---|---|
| J1 | PR #75 的去向：拆成五条 / 弃用重做 | H 第 0 步 | 0 | 产品与工程取舍 |
| J2 | `Infinity` 是「未确认」还是「用户明确不限」 | D.2 P3.c、B2 | 3 | 产品取舍 |
| J3 | `--budget` 低于已花：exit 2 拒绝续跑，还是接受并立刻停 | D.2 P3.c | 3 | 产品取舍 |
| J4 | 默认预算：保留并告知（d-i）还是删除（d-ii） | D.2 P3.d、B5 | 3 | 产品取舍 |
| J5 | 写前记账（P3.e）：收紧保证对象与它的开销 | D.2 P3.e | 3 | 改需求要什么（收紧） |
| J6 | 不误拒（P3.f）成为判据 | D.2 P3.f、B4 | 3 | 改需求要什么（收紧） |
| J7 | P3 正文的并发范围边界由谁起草、怎么写 | D.2 末、ADR-68 第五张欠条 | 3 | 范围边界（放宽方向，Agent 不起草） |
| J8 | F7.a「一次」是每进程还是每任务 | B22、ADR-68 第二张欠条 | F7 单独评定 | 需求有歧义 |
| J9 | P3 × D4 交点（预算用尽 + 记忆读不出来退 2）登记与否 | C.5 的 `boundary_of`、ADR-68 第三张欠条 | 2 | 需求冲突（两侧红线，退回需求所有者） |
| J10 | 推翻 ADR-67「不新增字段」的那条 ADR | C.1、C.6 | 2 | 流程补缺 |
| J11 | `terms` 的 `guard` / `if` 是否分两个字段；`examples` 是否进登记表 | C.8 | 2 | 设计分歧 |
| J12 | 引不引 fast-check（devDependency + lock 文件） | E.4、H 第 4 步 | 4 | 依赖决策 |
| J13 | `meta.json` / `task.json` 新增字段是否触及 U7 / D6 | D.12、H 第 1、10 步 | 1、10 | 需评定 |
| J14 | ADR-13「不引版本号」与交付物版本指纹是否冲突 | B17、H 第 1 步 | 1 | 需评定 |
| J15 | A1 / A2 的账单验证：负责人、日期、费用 | D.7、H 第 1 步 | 1 | 人工验证 |
| J16 | `main` 的分支保护内容核对；「只有一个人」如何充当第二人 | B18、F 角色段 | 5 | 治理 |
| J17 | `memory.ts:410` 的 `\|\|` 算不算 P1.b 违规 | B8 | 6 | 需求有歧义 |
| J18 | profile 查询失败的重试策略归谁；`bio_links` 的未查询态 | B6 | 6 | 需求有歧义 |
| J19 | `report.ts:129`「无邮箱」改「未查询」的 ADR | H 第 6 步 (a) | 6 | 补充 |
| J20 | `Observation<T>` 作为 Creator 层架构决策 | H 第 6 步 (b) | 6 | 架构 |
| J21 | 写入方并行是否允许（决定 ADR-66 重启） | B11、H 第 7 步 | 7 | 产品取舍 |
| J22 | `filterByMemory` 查询侧是否过 `keyProblem` | B10、H 第 8 步 | 8 | 产品取舍 |
| J23 | 「某侧 ≥ 2 候选同信号 ⇒ 不合并」是否是 D3「不确定」的定义 | B10、E.4 | 8 | 需求有歧义 |
| J24 | P2.a 豁免 `scope` 收窄（红线，独立复核） | H 第 9 步 (c) | 9 | 红线判据变更 |
| J25 | U3.a 的判据措辞（关键词表三态化） | B16、H 第 10 步 | 10 | 改需求要什么 |
| J26 | `replied` 的只读消费者是否算 S3 的「索取回填」 | B16、H 第 11 步 | 11 | 产品取舍 |
| J27 | 粉丝上下限「算不算改需求」两份文档矛盾 | B20 | — | 需求有歧义 |
| J28 | `process/` 里 F 节三条硬约束的措辞 | F、H 第 5 步 | 5 | 通用层变更 |
| J29 | 精度细于 $0.001 的预算（0.0005、0.0015）：拒绝并 exit 2，还是取整后继续 | D.9；P3 评审合成 | 3 | 产品取舍 |
| J30 | 预算字符串写法：`'1e-3'` 接受（换算）还是只认十进制字面；number 型科学计数是否放行 | D.10；P3 评审合成 | 3 | 产品取舍 |
| J31 | 「已发出、终止前未收到响应的那一次」按已计费计入（写进判据，保守，带来 L1 的少用一次）还是写成正文范围边界（不引入少用） | D.6 L1；P3 评审合成 | 3 | 改需求要什么 vs 范围边界 |
| J32 | 退款之后是否也立即落盘（429 每轮两次 persist，消掉 L1 的 429 变体） | D.6；P3 评审合成 | 3 | 架构取舍 |
| J33 | TLA+ 规约进不进仓库（`formal/` 目录 + 独立 Java job，还是只当文档附件） | E.4、H 第 0e 步 | 0 | 工具链取舍 |
| J34 | 网络异常（`fetch` reject）是否退款 —— 取决于 TikHub 对连接中断的计费规则，代码里无从得知 | B6；P3 评审合成 | 1（A2 验证） | 环境假设 |
| J35 | P3.a 现有判据文本是否改成属性形式（「对任意 limit 与任意序列…」）并保留 0.005 / 10 次作例子 —— 改现有判据要走 `2-CHANGE.md` | D.2 | 3 | 改判据措辞 |
| J36 | 旧任务目录（`budget_usd: null`、非整数 `requests`）续跑从「TypeError exit 1」改为「校验 exit 2 并要求 `--budget`」是行为变化：要不要迁移命令或宽限期 | H「schema 演进」 | 0b | 产品取舍 |
| J37 | 属性测试在 CI 的第二次跑是否用随机 seed（放 nightly 且失败不阻塞合入）vs 固定 seed | H 第 4 步 | 4 | 工程取舍 |
| J38 | EARS 子句层存不存在；`text` 派生时机；验证者存储还是派生；审计是否收紧到判据级变异；`unmeasured` 档 | C.8 | 2 | 设计分歧 |
| J39 | P3.c 落地方式：先登记为「故意红」（诚实但审计立即硬失败）还是与代码修复同一条 PR | D.2；EARS 评审合成 | 0b / 3 | 工程取舍 |
| J40 | `charge(-1)` 让计数减一且不经 `refund()`：是需求还是只记录 | D.9 | 3 | 需求有歧义 |
| J41 | `product-facts.json` 的设计：新文件归 Agent 拥有、render 只读 —— 改字段所有权是改尺子 | H 第 9 步 (b) | 9 | 架构 |
| J42 | 判据草案 P2.c（引用完整性）与 P5.i（覆盖声明） | H 第 9 步 (c) | 9 | 改需求要什么（收紧） |
| J43 | 预算的内部表示改为整数毫美元（换算规则、精度拒绝） | D.3 | 3 | 架构 |
| J44 | 适配层 `onAuthorized` 回调：`charge → persist → fetch` 的顺序契约改动 | D.5 | 3 | 架构（顺序契约） |
| J45 | B20 的七项文档漂移各以哪边为准（`PR_SIGNALS` 正则、tier fallback 60/40、429 退避口径、SKILL「profile 补全顺序」、README / AGENTS 的手写计数、`exemptions[].mitigation` 无读者） | B20 | — | 需求有歧义 / 文档 |
| J46 | 「写不出 oracle 的判据清单」出来后的处置：改判据、标 `none`、还是退役 | B1、C.6 第 5 步、H 第 2 步 | 2 | 需评定 |
| J47 | `text` 由 `ears` 派生的时间点与开关由谁按 | C.8 | 2 | 设计分歧 |

## 附录二 · 证据索引（本次会话的调研线）

全部脚本与输出在会话 scratchpad 下，仓库未动（每条线结束时 `git status --short` 为空）。

| 线 | 读了什么 | 跑了什么 | 主要结论 |
|---|---|---|---|
| registry | `spec-rule.ts`、`spec-sync.ts`、`audit.ts`、`claims.ts`、`test.ts` 的认领机制、ADR-17/24/33/34/67 | 给登记表注入未知字段跑 `validateRegistry / renderTables / contentHash`；重加退役 `P4.d` | C.0 的全部事实；B13 |
| p3 | `budget.ts`、`tikhub.ts` `get()`、`collect.ts`、`enrich.ts`、`task.ts`、`atomic.ts`、P3/F7/D6 测试与变异 | `budget-probe.ts`（NaN / 边界）、`scan.ts`（10 万 limit）、`kill-fetch.ts` + `e2e-a`（NaN 续跑）、`e2e-c`（SIGKILL 崩溃窗口、`null` 预算、enrich 校验对比） | CE-1 / CE-2 / CE-3；D.5 的现状转移表 |
| observation | `types.ts`、`assessment.ts`、`tikhub.ts` 的赋值、`lint-rule.ts`、CONVENTIONS、ADR-18/19/21/46 | `probe.mts`：lint 漏形状、多余 `p1-ok`、`"12K"` 进 number、未知 status、`needsProfile` 重查 | B6 / B7 / B8 / B9 |
| memory | `memory.ts`、`atomic.ts`、`task.ts` 三步协议、ADR-15/38/40/41/42/45/47/50/55/66 | `states.ts`（五类 unreadable）、`threestep.ts`（每步中断、两写入方交错）、`atomicprobe.ts`（权限位、软链、残留清理） | B11；E.4 的 P4/D4 推荐 |
| identity | `identity.ts`、`creatorKey`、`memory.ts` 键规范化、ADR-22/32/37 | `prop.ts`（2519 handle + 全码点幂等、往返、查询侧照单全收）、`followup.ts`、`mut/probe-mut.mts`（六条变异的等价断言） | B10；E.4 的六条属性 |
| claims (P2) | `outreach-draft.md`、`product-intake.md`、`rows.ts`、`report.ts`、`xlsx.ts`、ADR-01 | `p2-paths.ts`（三条路径的占位符） | B12；H 第 9 步 |
| infra | `package.json`、CI、`test.ts` 框架、`mutate*.ts`、`selfcheck.ts`、`size-rule.ts`、`age-rule.ts`、PR #75 / #81 元数据 | 只读检查耗时；`categorize()` 对 `.tla` / 第二测试文件的归类；CI 时长（Actions API） | E.1 的 CI 成本；H 第 0 步的拆分依据；「新增一道检查的接入清单」 |
| sensors | `SKILL.md`、`references/*`、`render.ts` 的 meta、`pipeline.ts` 的 keywordStats、`score.ts` / `assessment.ts` 常量 | 无（读代码） | G 节的传感器表与控制变量表；B16 / B17 / B20 |
| governance | `process/*`、ADR-16/24/30/62/64、`.github/workflows`、GitHub API（分支保护标志、PR #77/#78/#80 的 review 记录） | GitHub 只读查询；git 作者统计 | F 节的「今天的规则」列；B18 |
| tools-hands-on | `budget.ts` | fast-check / z3-solver / TLC / Quint / 零依赖 BFS 各一遍 | E.0 表 |
| tools-research | 联网核对（registry.npmjs.org、GitHub releases、搜索摘要） | `probe-budget.ts`、`probe-identity.ts`、`probe-faultfs.ts`（42 个 fs 调用点） | E.2b；B10 的歧义合并 |
| 设计面板（`panels/`） | 各自只读 brief 与仓库 | 三份 EARS 设计（两份带可执行原型：`ears/`、`ears-design/`，含 `ears-rule.ts`、JSON Schema + ajv 验证）；三份 P3 设计（原型在 `p3-executable/`、`p3-formal/`）；两份裁决（`judge-*.md`） | C 节的合成；C.8 的分歧；D.3–D.6 的整数单位与写前记账 |
| formal-p3 | `budget.ts`、`tikhub.ts`、#75 的 `BudgetProtocol.tla` | `BudgetP3.tla` + 十个 cfg 在 TLC 2.19 上跑（现状 / 响应后落盘 / 写前记账 × 安全性 / 活性 × 无崩溃 / 一次崩溃）；`milli-parse.ts`（`Math.round(k/1000 × 1000)` 扫描）；`prop-budget-int.ts` | D.6 的 L1 / L2 结论与安全性对照；D.3 的换算测试 |
| p3-executable | 主干 `test.ts` 的 P3 / F7 / D6 用例 | `explore.ts`（独立探索器，两档界）、`verify-existing.ts`（N2 / N3 打到主干跑现有测试：837 ✓ 存活）、`verify-mutations.ts`、`diff.ts` | D.9「每个 profile 之后 persist 挡不住」；D.11 的存活结论 |
| p3-formal | 同上 | `model.ts` + `props.ts`（随机 + 固定 seed 的属性，N = 2000 → 3.8 s；N = 100,000 中止）、`money.ts`、`gate.mts` | D.10 的属性预算 |
| 审阅（`critique/`、`refute/`） | proposal-v1 与 v2 全文 | 第一轮：覆盖度、事实核对 ×2、一致性、对抗性驳斥（`refute/wbe.ts` 写前记账实测、`refute/tla75-check.ts` 复现 #75 的五场景集合对账、`refute/wcost.ts` 落盘开销）；第二轮：一致性、事实核对、覆盖度 | 附录四的修订记录 |

## 附录三 · 与 PR #75 的对照

PR #75（分支 `claude/kol-formal-verification-kr5igx`，draft，2148 行新增 / 18 个文件，base 落后主干 5 次合并，`mergeable_state: dirty`）做了什么、本文怎么对待它：

| #75 做了 | 本文的立场 |
|---|---|
| `scripts/check/formal-rule.ts`（903 行）：状态 `{local, disk, billed, sent, phase, sinceSave, warnedHere, warnTotal, alive, exit, stopped, resumes}`，八个动作，五个场景（`spec` 1586 状态、`entry-cadence` 2236、`no-crash` 56、`bill-non-200` 113、`broken-charge` 81） | 就是 D.3–D.6 的模型，且比本文多了 F7 的提醒计数与 `persistEvery` 参数。**建议采用它，不另写（J1）。** 903 行里对拍夹具与 trace 打印占大头，拆分方式见 H 第 0 步 |
| `formal/budget/BudgetProtocol.tla` 与 TS 模型是「同一转移系统的两种写法」，`--tla` 逐字符比可达状态集，五个场景全部相等 | **本次复现**（`refute/tla75-check.ts`，`onlyModel = 0, onlyTlc = 0`；复现条件 `-deadlock -workers 1`）。这是模型—模型一致性的机制，排除「探索器自己写错」。对 429 重试与 IG 两级端点无覆盖 |
| `runConformance()`：#75 自述 588 个响应序列驱动真实 `TikHub.get()`、555 次真实提交（自述的乘法 `(4+16+64) × 4 × 2 = 672` 与 588 不吻合，未复跑，不知哪个数对） | 这是 D.13 第 2 条。它的界 `CONFORMANCE_LIMITS = [0,1,2,3]` 不含任何误拒点（最小在 9），所以没碰到 CE-3；扩界即可（扩界对拍本次未跑） |
| `budgetProblem / ledgerProblem`：上限与盘上计数都要过校验，三条入口共用 | 就是 P3.c 的实现，且多守了 `requests: null / "4"`。**建议采用。** 本文的 `ConfirmedLimit` 品牌类型是它的类型层版本，不在试点内 |
| ADR-68 五张欠条：崩溃窗口、F7.a「一次」、P3 × D4 交点、「非 200 不计费」、probe 不记账 + 并发覆盖 | P3.e 就是第一张的重启条件里说的「先写打算发一次请求再发」；A2 就是第四张；范围边界就是第五张的后半。**#75 正确地没有替需求裁决**，本文把这些裁决写成草案交人（附录一） |
| 保证等级词表，明写「本仓库一条 PROVED_IMPLEMENTATION 都没有」 | C.2 采用这套词表（已写进本文，不依赖 #75 合入） |
| `IMPLEMENTATION-MAP.md` 第五节「模型里没有的那一半 —— 人工核对表」 | D.7 假设登记表的雏形，差的是机器可读与失效触发器；H 第 1 步把它结构化 |
| 每个场景记下预期的最短反例长度，「模型被改松、反例变长，一样红」 | D.15 第 1 条直接引用 |
| 违反自己仓库的两条纪律：源码类新增 1277 行 vs 350（带 `size-ok`）；「闸门自身走最后一块砖」被一条 PR 装完；`M-H16-a/b/c` 与已合入的 #78 撞号 | **这是它合不进去的原因，不是它内容的问题。** 拆法在 H 第 0 步 |
| 第 6 条「上限是 NaN 时闸门整条不存在」标为「实现违反已有红线，本 PR 修」 | 与本次会话独立实跑的 CE-1 一致。注意 I5 在 #75 里由对真实 `Budget` 的值域扫描守，不是 BFS 模型报出的 |

**本文相对 #75 新增的只有四样**：EARS 层的判据草案（#75 没有动登记表）、P3.f 不误拒、随机 + shrink 的属性层、机器可读的假设登记表与失效触发器。其余是对 #75 的复核与拆分建议。

## 附录四 · 修订记录（两轮审阅改掉的结论，正文只留改后的）

正文不再出现「第一稿」「审阅指出」这类历史；改了什么记在这里，给要核对推理链的人。

| 改前 | 改后 | 为什么 |
|---|---|---|
| I2 写成 `persisted ≥ emitted` | `persisted ≥ billed`（A2 下）；`persisted ≥ sent` 明写提议也不满足 | 429 重试实跑：`persisted = 1`、`sent = 4` |
| P3.e 标「补充」 | 「改需求要什么 —— 收紧」，人批 | 它扩大了保证对象（盘上计数 → 跨运行计费），不是澄清 |
| P3.e「每次授权前一次原子写」 | 「每次授权后、发出前」 | D.5 定的顺序是 `charge → persist → fetch` |
| `meta.json` 加 `budget` 块标「无需求变更」 | 「要评定是否触及 U7」（J13） | `meta.json` 装什么是 U7.d 的对象 |
| 零依赖 BFS 与 TLC「集合相等」 | 「计数相等」；集合级对账只在 #75 的模型上做了 | 小模型只比了状态数 |
| #75 的对拍「没碰到 CE-3 是穷举 vs 随机的问题」 | 是界的问题：`CONFORMANCE_LIMITS` 0–3 不含误拒点 9 | 有界穷举扩到 ≥ 9 一样能找到 |
| H 第 0 步的状态数验收不写 TLC 参数 | 钉住 `-deadlock -workers 1` | 不带 `-deadlock` 时 1586 → 68 |
| 试点成功判据「不给 CE-1 / CE-2，让模型自己找到」 | 回归式（撤掉修复变红）+ 盲写不变量 | 不变量本来就是从反例反推的，构造上不可能「自己找到」 |
| 「五个不同产品的任务」攒窗口 | 同品类、同版本分桶 | 与「跨品类不可比」自相矛盾 |
| 换词逻辑算参数层 | Skill 层同源回路 | 与语义规则是同一种回路 |
| 机器能分辨「放宽」 | 承认三种守不住：恒真化、期望改成运行结果、旁路执行 | 只有恰好有变异的断言才会红 |
| 等级词表「已写进 C 节」（实未写） | C.2 的 `Level` 枚举与 `levels` 栏落处 | 第 12 问的失效接线依赖它 |
| D.8「L1–L2 尚未在任何模型里验证」 | L2 在 TLC 参考规约上成立、L1 已知违反；`npm run formal` 不检查活性 | 与 D.6 的实跑结论矛盾 |
| D.15「五条」 | 六条 | 数错 |
| C.6 第 2 步就让 R8 孤儿术语红 | R8 按 `ears_policy` 分级：`none` 警告、`redline` 红；`terms` 第一批只装十三个 | 先装术语后挂子句的迁移期必红 |
| P3.b/1 的 `outcome` 只引术语 | `{ term: 'process.exit_code', expect: 3 }` | 示例没绑定退出码 3 |
| `task.running` 的 oracle「模型专有」 | `Oracle` 加 `model` 变体 | 不在联合里，R3 会红 |
| 「采用 #75」写成已决 | 「建议采用（J1）」+ 弃用时的另写路径 | H 第 0 步允许弃用 |
| 属性测试「N 取 100–500、总增量 1 秒内」 | N ≤ 50、× 229 ≈ 23 s，与 `formal` 合计 < 60 s | 原预算没乘变异次数 |
| 义务指纹不含 `unless` / `where` | 含 | 加例外槽就是放宽 |
| 「refinement types 没有成熟实现」「没有 npm 包」 | 「联网核对未找到」 | 没找到不等于不存在 |
