# 2 · 代码层：对 `scripts/`、`mutations.json`、CI 与 `formal/` 的每条改动

**装什么**：本提案要动的每一段代码 —— 检查链判定模块与入口（`scripts/check/`）、产品代码（`scripts/lib` 与入口脚本）、`scripts/test.ts`、`scripts/check/mutations.json`、`.github/workflows`、`formal/`；每条写目标、守哪条判据、执行哪条通用规则、现状、提议、落地。**不装什么**：判据与术语的原文（见 `1-docs.md`）、通用规则原文（见 `0-process.md`）、试点叙述与数字的推导（见 `8-p3-pilot.md`、`9-evidence.md`）。
**编号怎么读**：`码-NN` 只在本文件定义；「守的判据 / 字段」指 `1-docs.md` 的 `业-xx`，「执行的规则」指 `0-process.md` 的 `通-xx`，「—」表示没有对应项；`H 第 n 步` 在 `3-rollout.md`，`Jnn` 在 `README.md`。「现状」的 `file:line` 指主干 `d7e20d7`（2026-09-19 合入 #118；原基线 `cc132a7` 之后 199 个提交，`git rev-list --count cc132a7..d7e20d7`），写明「#75 分支」的除外 —— #75 已于 2026-09-11 关闭未合入（draft、`mergeable_state: dirty`），分支仍在远端，PR 记录的 head 是 `f652943`（本文读的代码是 `97c358e` 那四个实质提交，`f652943` 只是一条带 `age-ok:` 的空提交）；分支 `claude/kol-formal-verification-kr5igx` 已于 2026-09-18T19:10Z 强推为 `2deb489`（`git merge-base 2deb489 d7e20d7` = d7e20d7，`git log --oneline d7e20d7..2deb489 | wc -l` = 5），凡写「2deb489」的指那棵树 —— 本文只核了它的变异编号，其余 #75 分支的 `file:line` 与行数仍指 97c358e；标「实跑（cc132a7）」的数在 d7e20d7 上未复跑，除非另注「实跑 d7e20d7」；变异临时号 N1–N9 与 `M-xx` 沿用 source §D.11；体量数字标「估」的是估计、标「尚未验证」的是 source 没给。`Bnn` 指 `9-evidence.md` §B 的差距编号，`CE-n` 指 `8-p3-pilot.md` §D.0 的反例，`C.n` 指 `1-docs.md`（C.2 / C.5 / C.8）与 `0-process.md`（校验规则 R1–R11）。

## scripts/check/
### 码-01 · `ears-rule.ts`（新）：类型 + R1–R9 + R11，R8 按 `ears_policy` 分级
- **目标**：scripts/check/ears-rule.ts（新，判定）+ scripts/check/spec-rule.ts 引用它 + scripts/test.ts 的 `harness` 断言 + scripts/check/mutations.json（`M-H4-l` 起 —— d7e20d7 上 M-H4 仍只到 k）
- **守的判据 / 字段**：业-01、业-02、业-03、业-04、业-05、业-06、业-07、业-08、业-09、业-10、业-27、业-31；**执行的规则**：通-01、通-02、通-03、通-04、通-05、通-06
- **现状**：给登记表加未知字段 `ears`：`validateRegistry` 0 问题、`rootProblems` 0 问题、`renderTables` 输出逐字相同（实跑）；根级新键不进指纹、不校验、不渲染；退役 `P4.d` 重加通过校验（B13）；`validateRegistry` 形状问题会盖住关系问题；对现有判据 `text` 跑 `implementationLeak`，cc132a7 的 99 条里有 5 条会红（P1.b 的 `??`、P4.a 的 `filterBy`、D2.a 的 `bioLi`、F6.a / F8.c 的 `tierOf`）—— 代码名字的去处是 oracle，不是 `text`（实跑 cc132a7；d7e20d7 判据 102 条 `node -p "require('./docs/requirements.json').requirements.reduce((n,q)=>n+q.accept.length,0)"`，新增的 P1.e/f/g 三条是否命中：未知，未复跑，C.4）；含糊词表（「safely」「合理」「适当」…）对 cc132a7 的 99 条判据命中 0 条（d7e20d7 未复跑）—— 在存量上从不红的检查只约束新写的术语，不能当「可判定性」的保证（实跑，C.4）
- **提议**：导出 `earsProblems(registry)`，实现 R1（句型由字段派生：`when` 至多一个，`shall` / `shall_not` 至少一个非空）、R2（TermRef / OutcomeRef 必须在 `terms` 且 kind 与槽位匹配）、R3（oracle 非空；event 只许 `invoke`；`human` / `none` / `model` 带理由）、R4（`def` / `note` 过 `implementationLeak`，`note` 点名的 ADR 必须在 `adr[]`；不套判据 `text` —— 现有判据里 5 条会红（cc132a7 实跑），见「现状」）、R5（子句 id `{判据}/{n}` 同判据内唯一；`retired_ids` 命中即红）、R6（`require ≥ redline` 时红线判据必须有 `ears`，`none` 的红线判据必须同时在 `mutations.json` 的 `exemptions` —— d7e20d7 上 `exemptions` 是 P2.a 与 P1.b 两条（ADR-77 把 P1.b 登记成显式豁免，形状同 P2.a），R6 的存量例子就是这两条）、R8（孤儿术语：`none` 警告、`≥ redline` 红）、R9（`boundary_of` 指向的需求必须在 `tension[].with`）、R11（`exit_code` / `stdout_json` / `fixture` 类 oracle 不得由 `test.ts` 单元测试认领 —— 主干已有对应机制：入口类判据由 `selfcheck.ts` 的 `criterion()` 发入口认领，写进 `claims.ts:35` `ENTRY_CLAIMS_PATH`（ADR-70 落地 3），R11 只把「不得由单元测试认领」这一半写成规则）；`earsType(clause)` 与 `verifierOf(clause, terms)` 是派生函数不存字段。测试：坏子句（缺术语、空 `shall`、退役 id 重加）变红；登记表尚无 `ears` 时检查全绿。变异：每条规则至少一个（R2 的变异是「术语不存在也放行」）。体量：原型过 `tsc --strict`、ajv 2020-12 strict 对现行登记表 0 错（实跑；「某类术语不得有 oracle」这类约束不能写成 `then: { not: { required } }` —— strictRequired 拒绝 —— 要写成 `properties: { oracle: false }`）；行数 source 未给（尚未验证）。
- **落地**：H 第 2 步（C.6 第 2 条 PR，与 码-02、码-03 同一条）· 裁决 J10、J38、J51 · 档：提议
### 码-02 · `spec-sync.ts` / `spec-rule.ts`：`contentHash` 加三个根键（R7）；`renderTables` 追加 `⟨EARS⟩` 派生行；`shapeProblems` 同步扩
- **目标**：scripts/check/spec-sync.ts（`contentHash` 输入一行）+ scripts/check/spec-rule.ts 的 `renderTables` / `shapeProblems`
- **守的判据 / 字段**：业-01、业-02、业-33；**执行的规则**：通-01、通-05、通-29
- **现状**：需求与判据上的任何字段自动进 `content_hash`，根对象新键（`terms`、`retired_ids`）不进指纹、不校验、不渲染（实跑，C.0）；`spec-sync --write` 整体重写时未知字段与键序原样保留
- **提议**：`contentHash` 输入加 `terms` / `retired_ids` / `ears_policy`（R7：改词汇表不回写指纹即红）；`renderTables` 在验收标准格里、判据 `text` 之下追加派生行 `⟨EARS⟩ …`（`renderClause` 从子句渲染，过渡期供人眼对照）；`shapeProblems` 扩到 `ears`（ADR-33：渲染读的字段必须校验）。测试：注入 `ears` 后 `--write` 一次指纹稳定；SPEC 里 P3.a 下出现派生行。变异：随 码-01 的 `M-H4-l` 系列。体量：`contentHash` 改一行；其余 source 未给（尚未验证）。
- **落地**：H 第 2 步（与 码-01 同一条 PR）· 档：提议
### 码-03 · `audit.ts` 加「靠什么验」派生列；`claims.ts` 的 `CLAIM_LISTS` 加 `levels` 栏；假设未验证 → ASSUMED 派生；红线低等级单列
- **目标**：scripts/check/audit.ts + scripts/check/claims.ts（`CLAIM_LISTS`，`claims.ts:88`）+ scripts/test.ts 写 UNIT_TESTED / PROPERTY_TESTED + 码-11 的 `formal.ts` 写 MODEL_CHECKED / MODEL_ONLY
- **守的判据 / 字段**：业-02、业-23；**执行的规则**：通-02、通-05、通-10、通-11
- **现状**：**主干已做一半（ADR-70 落地 3 / 4，d7e20d7）**：审计已读两份覆盖记录 —— 单元认领 `claims.ts:15` `CLAIMS_PATH` 与入口认领 `claims.ts:35` `ENTRY_CLAIMS_PATH`（`audit.ts:130` `testedCriteria`、`:139` `entryCriteria`，缺后者即 exit 1）—— 并按判据级计负片（`audit.ts:146` 调 `audit-rule.ts:75` `criterionMutations`，报告显示「判据 n(负片 k)/m」；需求级 `mutatedIds` 在 `audit.ts:143`、`:174`）；「由 selfcheck 验」今天已能声明（变异 `by: "selfcheck"` + `kills`，`mutate-rule.ts:58` `VERIFIERS = { test, selfcheck }`；B13 的「不计入」半句已不成立，B19 仍成立）。仍缺：登记表没有「这条判据由哪个模型 / 性质 / 监控守」的信息，模型 / 性质两档没有落处；`CLAIM_LISTS`（`claims.ts:88`，仍是 `covered / criteria / tensions`）是为加字段设计的扩展点
- **提议**：两份覆盖记录（`.check-cache/test-claims.json` 由 `test.ts` 写、`.check-cache/selfcheck-claims.json` 由 `selfcheck.ts` 写，ARCHITECTURE 的 claims.ts 行明写不合成一份）各自新增 `levels: Record<判据 id | 子句 id, Level>`，七级词表 `PROVED_IMPLEMENTATION | MODEL_CHECKED | MODEL_ONLY | PROPERTY_TESTED | UNIT_TESTED | ASSUMED | EMPIRICAL`（沿 #75 `formal/README.md`，本文已收录不依赖 #75 合入）；由检查自己写，不手填、不存目标等级；审计新列「靠什么验」由 `verifierOf(clause, terms)` 派生（`exit_code` / `stdout_json` / `fixture` → selfcheck，`call` → test，`human` → 人工；`source_grep` / `file_text` 类 oracle 在 d7e20d7 上**没有对应验证者** —— `VERIFIERS` 只有 `test` 与 `selfcheck`，扫源码的 lint 与 arch 已撤（ADR-77 / ADR-78）—— 要么新建验证者（与 ADR-77「指令性是最弱一档」相悖，需在 ADR 里直面）、要么归「human」；派生表先按两档 + 人工写，取哪边是新裁决点，见 open question）；`docs/assumptions.json` 里状态「未验证 / 待重验」的假设所支撑的性质读作 ASSUMED（派生不写入），红线判据报「目标等级未达」；红线判据低于 UNIT_TESTED 或 ASSUMED 的单列；`human` / `none` oracle 与 `ears.none` 各自单列，不算缺口也不算完整。判据级变异「计入」这一半**主干已做**（`audit-rule.ts:75` `criterionMutations` 按前缀归并；`M-P3-a` 仍记 `req: "P3"`，不必改记 P3.a），J38 只剩「是否硬性要求带子句且验证者为 test 的判据必须有判据名下的变异」。测试 / 变异：随 码-01 同 PR。体量：source 未给（尚未验证）。
- **落地**：H 第 2 步（等级栏与派生列）、H 第 1 步（ASSUMED 接线，见 码-45）· 裁决 J38、J51 · 档：提议
### 码-04 · R10：`shall` 里的连词只警告
- **目标**：scripts/check/ears-rule.ts
- **守的判据 / 字段**：—（结构规则）；**执行的规则**：通-06
- **现状**：原型未实现（C.4 表）；「拆到多细」只靠 ADR-24 的代码路径判据，机器判不了
- **提议**：`shall` 里出现「and / 且 / 并 / 同时」→ 警告不失败；不替 ADR-24 做决定（C.9）。测试：含连词的子句只出警告、退出码不变。排在 C.6 第 2 步之后按需。体量：source 未给。
- **落地**：H 第 2 步之后按需 · 档：自动
### 码-05 · 覆盖记录里的判据 id 与登记表比对
- **目标**：scripts/check/audit.ts / scripts/check/claims.ts（两份记录 `CLAIMS_PATH` 与 `ENTRY_CLAIMS_PATH` 都比对）
- **守的判据 / 字段**：—；**执行的规则**：通-03、通-29
- **现状**：claims 里的判据编号不与登记表比对（B13；d7e20d7 仍成立：`claims.ts:103` `claimsWellFormed` 只查形状，`audit.ts` / `audit-rule.ts` 无与登记表判据 id 的比对）；认领草案 id（P3.c–f）会静默通过（8-p3-pilot.md §D.13 第 2 条）
- **提议**：审计把覆盖记录里每个被认领的判据 id 与登记表比对，不存在或在 `retired_ids` 的即报缺口。测试：认领不存在的 id 报缺口。变异：「比对恒通过」。体量：source 未给。
- **落地**：H 第 2 步 · 档：提议
### 码-06 · `oracle-rule.ts`（判定）+ `oracle.ts`（入口）+ 接进 `check` 链（`size` 之后）—— 三条 PR
- **目标**：scripts/check/oracle-rule.ts（新）、scripts/check/oracle.ts（新）、package.json 的 `check` 链（d7e20d7 上是 8 步：size → spec → adr → typecheck → test → mutate → selfcheck → audit；lint / age / arch 已撤，「`size` 之后」这个落点仍在）；复用 scripts/check/trailer.ts 的解析（逻辑逐字未变：`trailer.ts:22` `TRAILER`、`:38` 最后一段全 trailer 的判据；今天唯一调用方是 `size.ts`，机器读的 trailer 键只剩 `size-ok`）与 scripts/check/size.ts 的 base 取法 —— **不是「ADR-63 base 机制」**：ADR-63 的 `AGE_PR_BASE` 接线属于已删的 `age.ts`（cc132a7 的 `age.ts:449`），cc132a7 的 `size.ts` 从未读过它，check.yml 的 prbase 步与 `AGE_PR_*` 变量已随 ADR-76 删除；现行 `size.ts:67` 取 `merge-base(origin/main|main, HEAD)`，HEAD 在主干上时退回 `HEAD^1`（`:82`）且只量不判，浅克隆拒答（`:54`）；PR 事件下 checkout 的是合成合并提交，其第一父是主干侧。oracle-rule 若需要真正的 PR base，得自己重建 ADR-63 那套已删的接线
- **守的判据 / 字段**：业-27、业-28；**执行的规则**：通-07、通-08、通-20、通-21、通-22、通-23
- **现状**：改测试要写 ADR 只靠第三层 + ADR 存在性；红线措辞改写与主干无基线比对、`--write` 一条命令即绿；`scripts/check` 归普通代码（`size-rule.ts:40` `categorize` 把 `scripts/**/*.ts` 归源码，未变）、CI 配置无守（check.yml 28 行）；PR #78（cea614e，2026-09-06 合入）改守红线的检查链、零 review、作者自合（B18）；**主干方向与本条相反**：2026-09-18 起 ADR-79 撤掉 `adr` 对主干比历史的 git 机器、ADR-80 撤掉体量豁免的过期计算、ADR-76 撤掉 age —— 仅剩的对主干比较是 `size.ts` 的 merge-base diff；同日 ADR-83 加了 REVIEW.md + 两份评审器转发（Copilot / CodeRabbit）
- **提议**：对 PR diff 判定是否触及尺子：`test.ts` 已有断言整行（标签 + 表达式）被改、`mutations.json` 条目或 `scripts/check/fixtures/` 夹具被删、`requirements.json` 的 `text / accept / ears` 被改（义务指纹见 码-07）、豁免增加、闸门代码（`scripts/check/*`、`package.json` 的 `check` 链）或 CI 配置（`.github/workflows/*`）被改；是则要求提交信息最后 trailer 块有 `oracle-change: ADR-NN` 或 `oracle-change: 重构`，无 trailer 红（纯尺子的 PR 也红），有 trailer 绿且进审计计数；实现与尺子的提交在同一 PR 交错出现时打印警告并要求 trailer；`eq()` 的字面量 `want` 被改时要求同一 diff 里断言旁的推导注释也变（弱守法）；触及守红线模块（锚点表「服务的需求」含 P1–P5）的普通代码改动标为提议档 —— 锚点表（`docs/ARCHITECTURE.md:53–99`）从 ADR-78 起人维护、无机器核，这个判定输入的完整性靠人，ADR 里要写明。三种绕法（恒真化、期望改成运行结果、旁路执行）机器守不住，文档明写。测试 + 变异先合、入口最后接（最后一块砖）。验收：只删断言的 PR 红；带 trailer 绿且审计计数 +1；变异「不认 trailer」被抓到；假阳性（重构移动断言）用 `oracle-change: 重构` 留痕而不是放宽判定。**与 ADR-79 的冲突要在 ADR 里直面**：ADR-79 撤同类机器的理由是「守的坏法在 diff 里是一行红字、评审第一眼就看见」，本条主张尺子改动是「哑」的、评审不一定看得见 —— 两者正面冲突；按 ADR-81 的三问（哑不哑 / 模型能否替代 / 发生过没有）补论证，第三问的证据是 #78 那一次；J28 需加一个选项「不建闸门，写进 REVIEW.md 交评审」（README.md 的 J28 由父级改）。体量：source 未给（尚未验证）。
- **落地**：H 第 5 步 · 裁决 J28、J16、J52、J55 · 档：提议 + 非作者复核（闸门代码）
### 码-07 · 义务指纹：`text` + `when / while / if / unless / where / shall / shall_not`，与 `content_hash` 并存
- **目标**：scripts/check/spec-rule.ts 或 ears-rule.ts（算指纹）；scripts/check/oracle-rule.ts 消费
- **守的判据 / 字段**：—；**执行的规则**：通-07、通-21
- **现状**：判据级字段零成本进现有 `content_hash`，但与 `text` 改动在指纹上不可区分（C.0 推论）
- **提议**：对每条判据另算义务指纹（`unless` / `where` 各是例外槽或前提槽，加一条就是放宽，必须进指纹）；指纹变了 → 码-06 要求 ADR；只改 `outcome` / `examples` 指纹不变。测试：改 `examples` 指纹不变、加 `unless` 指纹变。变异：「指纹不含 `unless`」。与 ADR-79 的关系同 码-06：义务指纹要和主干基线比，是 ADR-79 刚撤掉的那类「对着主干比历史」的机器，需在 ADR 里直面。体量：source 未给。
- **落地**：H 第 5 步 · 裁决 J52 · 档：提议
### 码-08 · `adr` 检查扩展：改 `requirements.json` 的 `text / accept / ears` 必须关联新 ADR
- **目标**：**目标已缩窄（ADR-79，主干 d7e20d7）**：不放进 scripts/check/adr-rule.ts / adr-sync.ts —— ADR-79 后 `npm run adr` 一次 git 都不调（adr-rule.ts 138 行，判定只有 `checkAll` / `renderIndex` / `markerFault` 三个函数，其余导出是正则与文件名格式化辅助 —— `FILE_RE`、`HEAD_RE`、`pad`、`slugify`、`escapeCell`、`encodeTarget`、`fileNameOf` 与 `Adr` / `MarkerFault` 类型（`grep -n export`，d7e20d7）—— `git` 字样只出现在行 13 的注释里；adr-sync.ts 212 行，grep 不到 `git`），本条要读 PR diff，改为随 码-06 的 scripts/check/oracle-rule.ts 落地
- **守的判据 / 字段**：—；**执行的规则**：通-07、通-21
- **现状**：**主干已改（ADR-79）**：`adr` 只查当前目录（编号唯一、文件名与标题一致、README 索引一致、DECISIONS.md 不装整册），对主干基线「号还在 / 标题没变」的比对（`checkAppendOnly` / `Baseline` / `trunkAdrs` / check.yml 的 `GIT_PUSH_BEFORE`、变异 M-H10-c/d）已撤，「编号不可回收」降为第三层（6-INTEGRATE.md:312）；需求文本改动的分类由提出者自填（第三层）
- **提议**：PR 改了 `requirements.json` 的 `text / accept / ears` 时，要求关联一条新 ADR 且其「冲击的需求」含被改编号。测试：改 `text` 无新 ADR → 红。变异：「冲击的需求」不比对。这本质是重装一套需要 PR base 的 git 比对，ADR-79 撤同类机器的理由（「一行红字评审看得见」）要正面回应，重装条件按 ADR-79「真发生一次、事后才发现」的口径写。体量：source 未给。
- **落地**：H 第 5 步 · 裁决 J52 · 档：提议
### 码-09 · 单变量守法进 oracle-rule：一次 PR 只允许 diff 参数配置文件的一个键
- **目标**：scripts/check/oracle-rule.ts
- **守的判据 / 字段**：业-46；**执行的规则**：通-35
- **现状**：参数散在 `score.ts`、`collect.ts`、`assessment.ts`、`tikhub.ts`，单变量无处守
- **提议**：对 码-35 的配置文件 diff 数改动的键，> 1 即红。测试：两键 diff 红。变异：「不数键」。依赖 H 第 5 步的 oracle-rule 与 H 第 12 步的参数集中。体量：source 未给。
- **落地**：H 第 12 步 · 档：提议
### 码-10 · `formal-rule.ts` 拆两块（0c）：模型核心一条 PR、对拍夹具一条 PR
- **目标**：scripts/check/formal-rule.ts（#75 分支 f652943，903 行 —— #75 已关闭未合入，d7e20d7 上没有 formal-rule.ts）→ 模型核心（状态、动作、不变量、有界 BFS）+ 对拍（`runConformance`、trace 打印）；各含 `harness` 测试、新编号 `M-H41-*` 起（分支 2deb489 已改成 `M-H41-a/b/c`；d7e20d7 上 harness 组号用到 H40；H2、H18 空着，但本仓库变异 id 能否回收未见规定 —— 未知，保守不用）、锚点表登记（人工登记，ADR-78 起无机器核）
- **守的判据 / 字段**：业-27；**执行的规则**：通-15、通-17
- **现状**：#75 的模型：状态 `{local, disk, billed, sent, phase, sinceSave, warnedHere, warnTotal, alive, exit, stopped, resumes}`、八个动作、五个场景（`spec` 1586、`entry-cadence` 2236、`no-crash` 56、`bill-non-200` 113、`broken-charge` 81 状态）；源码类新增 1277 行 vs 体量线 350；`M-H16-a/b/c` 已被 #78 占用；主干的崩溃交错只有例子测试（`test.ts:818-851`，与 cc132a7 的 792-825 逐字相同，B14）
- **提议**：建议采用 #75 的模型不另写（J1；弃用则按 D.3–D.6 另写探索器，工作量另估）；903 行里对拍夹具与 trace 打印占大头。验收：拆分后五个场景的可达状态数与最短反例长度与 #75 记录一致（`--tla` 互比钉住 TLC `-deadlock -workers 1`，否则 1586 → 68）；「指不回 `docs/requirements.json` 的性质不许加」保留为测试断言；模型不变量只增不删。变异：N8（不变量恒真：#75 的 `broken-charge` 负例场景 + #75 的 `M-H16-*` 改编为 `M-H41-*` 起（2deb489 已改成 `M-H41-a/b/c`），`M-H16-a/b/c` 在 d7e20d7 上仍被 #78 占用）。体量：模型核心（不含对拍夹具与打印）> 350 行是 8-p3-pilot.md §D.14 回滚线。
- **落地**：H 第 0c 步 · 裁决 J1、J55 · 档：提议
### 码-11 · `formal.ts` 入口 + `package.json` 接线（`mutate` 之后、`selfcheck` 之前）+ SYNC 行（0d，最后一块砖）
- **目标**：scripts/check/formal.ts（#75 分支 f652943，203 行；已关闭未合入）、package.json 的 `check` 链（8 步，「`mutate` 之后、`selfcheck` 之前」这个落点仍在）、docs/SYNC.md（触发表 13–42 行，新增行放在第 33 行「新增一道闸门」之后）
- **守的判据 / 字段**：业-27、业-31；**执行的规则**：通-15、通-22
- **现状**：主干没有 `formal` 步（模型层只有未合入的 #75，B14）；#75 把 `--tla` 放在检查链外
- **提议**：`npm run formal` 进链，位置 `mutate` 之后、`selfcheck` 之前；`--tla` 不进链；`formal.ts` 写 MODEL_CHECKED / MODEL_ONLY 到覆盖记录（码-03）。时长：本地目标 < 5 秒，CI 上限 30 秒（8-p3-pilot.md §D.14 回滚线），关系是「本地目标 / CI 上限」—— 口径按 ADR-72「秒数只在那台机器成立、倍数可跨机器」，写成相对一次 `scripts/test.ts` 的倍数（ADR-72 实测 4 核约 1.9 秒/次）比绝对秒稳；`formal` 步自身时长不乘变异数，变异只跑验证者（`VERIFIERS = { test, selfcheck }`）不跑 formal；规模参考（设计面板独立探索器，实跑）宽界现状 64,957 状态 211 ms、写前记账 28,845 状态 65 ms。体量：203 行（#75）。
- **落地**：H 第 0d 步 · 裁决 J1、J54 · 档：提议 + 非作者复核（闸门代码）
### 码-13 · 模型新增两个场景：`write-ahead` 与 `two-level-endpoint`
- **目标**：scripts/check/formal-rule.ts 场景表
- **守的判据 / 字段**：业-13；**执行的规则**：通-15
- **现状**：#75 五个场景对 429 重试与 IG 两级端点无覆盖（9-evidence.md §E.2b）；`tikhub.ts:257-264` 的 catch 只排除 402，一次逻辑请求最多 8 次提交、1 次计数（B21，本次复核实跑）
- **提议**：`write-ahead`（提议配置：`SpendIsRecorded` 与 `NoOverspend` 预期成立）；`two-level-endpoint`（预期给出 A2 为假时的反例；重试上限把两级端点算进去）。回归验收：把 `entry-cadence` 的 `persistEvery` 设回名单长度后 `SpendIsRecorded` 变红；撤掉 `budgetProblem` 后值域扫描（`LIMIT_DOMAIN`）变红。体量：source 未给。
- **落地**：H 第 3 步 · 档：提议
### 码-14 · `runConformance()` 的 `CONFORMANCE_LIMITS` 从 `[0,1,2,3]` 扩到含 9
- **目标**：scripts/check/formal-rule.ts 的 `CONFORMANCE_LIMITS`
- **守的判据 / 字段**：—；**执行的规则**：通-15、通-29
- **现状**：#75 自述 588 个响应序列驱动真实 `TikHub.get()`、555 次真实提交（自述乘法 672 与 588 不吻合，未复跑）；界 0–3 不含误拒点（最小在 9），所以没碰到 CE-3
- **提议**：扩界到含 9 让对拍碰到 CE-3 —— 扩界后的对拍本次未跑，「能碰到」从最小误拒点 9 推出（尚未验证）；P3.f 落地后该分歧消失，对拍继续查顺序、退款、续跑。认领只写 `criterion('P3.a')`。
- **落地**：H 第 0c / 第 3 步 · 档：自动
### 码-15 · 反例夹具持久化：`scripts/check/fixtures/p3/<name>.json` + `test.ts` 回放全部夹具；只增不删
- **目标**：scripts/check/fixtures/p3/（新）+ scripts/test.ts
- **守的判据 / 字段**：—；**执行的规则**：通-12、通-15
- **现状**：#75 每个场景只记预期的最短反例长度（「模型被改松、反例变长，一样红」）；fast-check 的反例靠 `seed + path + replayPath` 重放
- **提议**：形状 `{ name, bounds, trace: [{ action, state }], expect: '<不变量名> violated at step k' }`；`test.ts` 一条「回放全部夹具」测试；删一条要 `oracle-change:` trailer（码-06 把夹具目录列进路径清单）。
- **落地**：H 第 0c / 第 3 步 · 档：自动
### 码-16 · 活性 L1 / L2：改写成可达性 / 无 stuck 检查进链，或只留 TLC 参考规约（可选）
- **目标**：scripts/check/formal-rule.ts（或 formal/ 的 TLC 规约）
- **守的判据 / 字段**：—；**执行的规则**：通-15
- **现状**：BFS 探索器没有时序逻辑；L2 在 TLC 参考规约上成立、L1 在提议配置 + 崩溃下已知违反（实跑，8-p3-pilot.md §D.6）
- **提议**：要进链只能改写成安全性形状（「存在付得起且仍有工作的可达状态，其后继里没有 `send`」）；否则只留 TLC 规约（码-12）。不列进 H 第 3 步验收。
- **落地**：H 第 3 步之后可选 · 裁决 J33 · 档：自动
### 码-32 · `lint-rule.ts` 升级：抓非字面量兜底并清理 9 处多余 `p1-ok`
- **目标**：**目标已撤（ADR-77，主干 d7e20d7）**：scripts/check/lint-rule.ts 与 lint.ts 已删、`npm run lint` 不存在；`p1-ok` 标记全部改成 `P1 例外：` 纯注释（`git grep -o 'P1 例外' d7e20d7 -- scripts | wc -l` → 19，无工具读），「清理 9 处多余」失去对象；剩下的落点只有 scripts/collect.ts（`:215`）、scripts/lib/memory.ts（`:410`）两行本身（两文件在 d7e20d7 上未变）
- **守的判据 / 字段**：业-49；**执行的规则**：—
- **现状**：**目标已撤**：lint 已撤，「判 clean」在 d7e20d7 上无主体；`?? c.followers`（`collect.ts:215`）、`|| e.followers`（`memory.ts:410`）原样仍在；P1.b 判据正文缩为「任何位置不得出现 `?? 0` / `|| ''` 形式的数据兜底。」并登记为显式豁免（`mutations.json:2664`，scope「任何位置」这个全称），机器可执行的部分拆成 P1.e（取值）/ P1.f（排序）/ P1.g（入池）三条结果判据，由 `test.ts:2435` `suite('P1', '三态不得被压平…')` 与变异 `M-P1-x`@P1.e、`M-U1-d`@P1.f、`M-P1-d`@P1.g 守；「16 处 `p1-ok` 中 9 处多余」是 cc132a7 上仓库外 probe 的结论（cc132a7 产品代码里 `p1-ok` 16 处，d7e20d7 上 0 处），d7e20d7 上无法重核「多余」这一半（未知）；同形状的另一实例 ADR-71（`score` 漏在敏感字段表上）最终修法是结构性的：`tierOf(c, score)` 由调用方传分（B8 已被 ADR-71 / 77 以另一种方式处置）
- **提议**：**待重定** —— lint 升级与清理 `p1-ok` 两件都没有对象了。能改到的落点：J17 的问题仍在，但前提变了 —— 机器已不守写法、P1.b 是显式豁免，问题变成「`memory.ts:410` 的 `||` 是否落在 P1.e/f/g 之外的第四条压平路径」（ADR-77 欠条）；若是，给 memory.ts 补结果轴断言 + 负片（验证性，3-BUILD.md:63–67 三档的第二档），不重装 lint（ADR-77 的重开条件：同类坏法半年内两次，且表由代码生成或判据不再写「任何位置」）。验收：probe A / B 在仓库内变成测试 —— 只对结果轴那一半仍成立。
- **落地**：H 第 6 步 (a)（lint 那一件删去）· 裁决 J17（依据换成 ADR-77 欠条）· 档：提议
### 码-40 · 单写入方崩溃点穷举进 `check` 链
- **目标**：scripts/check/（新夹具：猴补 `node:fs` 11 个同步 API + `module.syncBuiltinESMExports()`；子进程 `SIGKILL`；部分写入三档）、scripts/lib/memory.ts 的 `persistListAndStatus`（42 个 fs 调用点 —— cc132a7 实跑的猴补计数；memory.ts 两基线间无改动，d7e20d7 未复跑）、scripts/test.ts；（可选）并发交错模型复用 码-10 的探索器
- **守的判据 / 字段**：业-27、业-47、业-52；**执行的规则**：通-17
- **现状**：D4.i / D4.j 无运行时认领，「第二步成功、第三步前中断」未测，两写入方交错留下 ok + 未去重名单（实跑复现，已声明不保证，B11）；异常注入 42 个点上「名单要么旧要么新」与 D4.j 全部成立（实跑，9-evidence.md §E.2b）
- **提议**：① 在第 k 个 fs 调用处注入异常，父进程读盘判 D4.i / D4.j / D4.k / D4.p，D4.i / D4.j 获得 `criterion()` 认领；D4.i「不得截断」那一半靠 `SIGKILL` + `writeFileSync` 部分写入（0 / 1 / len−1 三档）—— 尚未验证，耗时未知；② 只在 ADR-66 重启条件触发时建 `(T, L)` 写入方交错模型（`task.json` 三个写入方、`creators.json` 两个），性质「¬(T ∈ {ok, absent} ∧ L 不是在 T 下产出)」，预期先复现 memory track `threestep.ts` 场景 D3 的交错反例，再把候选修法（锁 / 条件更新 / 禁止并行）建进去比较。验收：异常注入结果与本次实跑一致。
- **落地**：H 第 7 步 · 裁决 J21 · 档：提议（并发裁决人批）
### 码-45 · `audit.ts` 读 `docs/assumptions.json`：未验证 / 过期 / 待重验列进报告不硬失败；登记表形状校验与变异
- **目标**：scripts/check/audit.ts + 新判定模块（形状、TTL、指纹比对）+ scripts/check/mutations.json
- **守的判据 / 字段**：业-23；**执行的规则**：通-11
- **现状**：环境假设散在 `budget.ts:1`、`tikhub.ts:90`、`atomic.ts:35-37`、ADR-50；#75 的 `IMPLEMENTATION-MAP.md` 集中了但不可机器读（B15）
- **提议**：读 A1–A9；外部触发器按 TTL（起点 90 天，过期即「未验证」）；代码触发器按内容指纹（`tikhub.ts` 相关函数、`atomic.ts`、`fake-fetch.ts`、`SKILL.md` 预算段；变了即「待重验」—— 注意 tikhub.ts 在 ecde780（ADR-77）只改了 11 处注释 `p1-ok:` → `P1 例外：`，按整文件指纹算已经触发过一次「待重验」，指纹要么取函数体、要么容忍纯注释改动）；验证日期由人写、审计只读；列进报告不硬失败；与 码-03 的 ASSUMED 派生接线。验收：登记表形状有校验与变异。体量：source 未给。
- **落地**：H 第 1 步 · 裁决 J15 · 档：提议
### 码-46 · lint：`skill/` 里出现的需求编号必须在登记表里存在
- **目标**：**目标已撤（ADR-77 / ADR-78，主干 d7e20d7）**：scripts/check/arch-sync.ts 与 lint-rule.ts 都已删；改为新建判定模块（scripts/check/ 下不带 shebang 的 `.ts`，按 SYNC.md:33「新增一道闸门」行走 + 变异），或做成 spec-rule 的一条关系校验 —— 编号存在性是验证性材料
- **守的判据 / 字段**：业-39；**执行的规则**：通-20
- **现状**：**目标已撤**：「`arch` 只查 `scripts/`」无主体 —— `npm run arch` 不存在（F 权限矩阵「Skill 文本」行）；`skill/` 两基线间零改动；REVIEW.md 的指针表不指向 skill/，评审器不会主动读它；3-BUILD.md:63–67 把「扫源码的 lint」定为最后一档
- **提议**：扫描 `skill/SKILL.md` 与 `skill/references/*` 的需求编号，不在登记表即红。测试：引用不存在的编号 → 红。变异：「不扫 `skill/`」。改闸门 → 提议。本条查的是「编号在登记表里存在」这个关系，不是写法 —— 属验证性而非指令性，ADR 里要写明它不与 ADR-77 取向相悖。
- **落地**：H 第 5 步 · 裁决 J50 · 档：提议
### 码-47 · lint：`process/` 不得出现产品专有词
- **目标**：**目标已撤（ADR-77，主干 d7e20d7）**：scripts/check/lint-rule.ts 已删；需新建判定模块（scripts/check/ 下不带 shebang 的 `.ts`，按 SYNC.md:33「新增一道闸门」行走 + 变异）
- **守的判据 / 字段**：业-31；**执行的规则**：通-30
- **现状**：`process/` 无任何检查读（B18；d7e20d7 仍成立 —— 主干没有任何扫源码 / 扫文档的检查，lint、arch 已撤）
- **提议**：禁词表沿 `docs/SYNC.md` 判别规则那一句，由业务层维护；`process/*.md` 命中即红。测试：往 `process/` 塞一个产品词 → 红。变异：「词表为空」。本条是扫文档的「指令性」检查，正是 ADR-77 / 3-BUILD.md:67 列为最弱的那一档 —— ADR 里要写明为何仍选第三档（`process/` 的通用性没有结构性写法可挡）。
- **落地**：H 第 5 步 · 裁决 J28、J50 · 档：提议

## 产品代码（scripts/lib 与入口）
### 码-17 · `budget.ts` 的 `budgetProblem / ledgerProblem` + 三条入口校验（坏预算 / 坏账本 → exit 2，`task.json` 不动）（0b）
- **目标**：scripts/lib/budget.ts（56 行）、scripts/collect.ts（`:59-60`、`:72`）、scripts/enrich.ts（`:66-72` 已有 `isFinite` 校验）、第三条入口（source 写「三条入口共用」未点名 —— 尚未验证）；scripts/check/selfcheck.ts 三入口真跑（#75 分支 f652943 的 +46 行；d7e20d7 的 selfcheck.ts 已到 1305 行，新夹具要走 `named` / `runBoth` / `run`（`selfcheck.ts:109/115/145`）并给可被 `kills` 点名的 label，见 码-44）
- **守的判据 / 字段**：业-11、业-26、业-36；**执行的规则**：通-19
- **现状**：`collect --resume --budget abc` → `Number('abc')` = NaN，`spent + 0.001 > NaN` 恒 false，闸门永不拒绝（实跑：请求数 2 → 17，exit 0，提醒 0 条）；NaN 落盘成 `null`，下次续跑 `TypeError` exit 1（CE-1）；`--budget 0` / `-1` 被接受、首个 charge 即抛 exit 3（CE-5）；`loadTask` 不校验 `budget_usd / requests` 类型（`task.ts:27-29`），`requests: "4"` 让下次计数变 `"41"`（#75 自述，未复跑）
- **提议**：`budgetProblem(v)`：返回 `undefined` ⇔ `v` 是有限非负数；`ledgerProblem(v)`：返回 `undefined` ⇔ `v` 是 `undefined` 或非负整数；入口在构造 `Budget` 前校验，失败 → stderr 真实原因、exit 2、`task.json` 字节不变、不发请求；`Infinity` 按「不是有限数」拒（J2）；「低于已花」是 exit 2 还是接受并立刻停、文案改哪一边（J3）。测试：码-44。变异：N5（#75 分支 97c358e 里叫 `M-P3-c` 的那条，分支 2deb489 起改叫 `M-P3-d`）与 `ledgerProblem` 那条（97c358e 叫 `M-D6-i`，2deb489 起改叫 `M-D6-l`）—— 主干 P3 名下只有 `M-P3-a`、`M-P3-b`（d7e20d7）；分支 2deb489 已占 `M-P3-c`（tikhub 先后，即 N3）与 `M-P3-d`（budgetProblem，即 N5）；走「从分支摘取」沿用 2deb489 编号，走「重做」从主干未占号续编且与分支一次分配（J53），见 码-41；d7e20d7 上 `M-D6-i` / `M-D6-l` 都未用，D6.f 名下已有 `M-D6-j`（by selfcheck，删 `resumeCostLine` 那行），需核 `M-D6-l` 与 `M-D6-j` 是否同一坏法。旧目录（`budget_usd: null`、非整数 `requests`）从 TypeError exit 1 变为 exit 2 并要求 `--budget`，是行为变化（J36）；P3.c 先登记为故意红还是同 PR（J39）。体量：源码 < 150 行（估）；整个计划里价值最高、代价最低，「只做一件事」就做它。
- **落地**：H 第 0b 步 · 裁决 J36、J39、J2、J3、J53 · 档：提议（触及守 P3 的模块）
### 码-18 · `budget.ts` 整数毫美元 + `charge` 前置 `n ≥ 1` + 构造函数拒非正 cost
- **目标**：scripts/lib/budget.ts（`:36` 浮点比较、`:21-22` `limitUsd` / `requests`）
- **守的判据 / 字段**：业-14、业-17、业-21；**执行的规则**：—
- **现状**：`699 × 0.001 + 0.001 > 0.7`，limit=0.7 只放行 699 次；10 万个 `k/1000` 的 limit 中 26,410 个少放行一次、0 个多放行（实跑，CE-3）；`new Budget(0.010, 9).charge()` 直接抛；`charge(0)` 通过且不改计数、`charge(-1)` 让计数 1 → 0 且不经 `refund()`（实跑，8-p3-pilot.md §D.9）；`remaining` 与 `affordable` 自相矛盾
- **提议**：内部 `limit_m = Math.round(budget_usd × 1000)`（1 unit = $0.001），比较用整数（`k + 1 > k` 永远为假）；盘上 `task.json.budget_usd` 仍是用户面美元，续跑不回写 `limit_m / 1000`；契约：`charge(n)` 前置 `limit` 已过 `budgetProblem` 且 `n ≥ 1`，后置抛出 ⇒ `count` 不变且未 notify、不抛 ⇒ `count += n ∧ count × unit ≤ limit`；`refund(n)` 后置 `count = max(0, old − n)`、`notified` 不变；构造函数与 `charge` 拒绝非正 cost。测试：`'0.7' → 700`、`'1.005' → 1005`（`1.005 × 1000 = 1004.9999999999999`，`floor` 给 1004；`Math.round(k/1000 × 1000) === k` 对 `k = 0 … 2,000,000` 零失败，实跑）；随机十进制 limit 恰好 `L/unit` 次（码-39）。变异：N1（`>` 改 `>=`；现有 P3.a 例子已能抓到，实跑 sent = 4 ≠ 5）、N7（`floor`）。精度细于 $0.001（0.0005、0.0015）拒绝还是取整是 J29；`charge(-1)` 是需求还是只记录是 J40；Z3 FloatingPoint 的证明脚本与结论入假设登记表，不进 CI。
- **落地**：H 第 3 步 · 裁决 J43、J29、J40 · 档：提议
### 码-19 · P3.d 落地：`task.json.budget_assumed` + stderr 告知（d-i）或缺配置 exit 2（d-ii）；启动 / 续跑打印限额来源
- **目标**：scripts/collect.ts（`:72` `cfg.budget_usd ?? 2`）、scripts/enrich.ts、scripts/lib/task.ts
- **守的判据 / 字段**：业-12、业-25、业-34、业-37；**执行的规则**：通-40
- **现状**：`cfg.budget_usd ?? 2` 静默给 $2，无 CONVENTIONS §7 要求的「假设值」告知（CE-4，读代码）；SKILL 没有 task.json 字段契约（B5）
- **提议**：d-i：缺 `budget_usd` 时 stderr「预算为假设值 $N」+ `task.json.budget_assumed = true`，`meta.json.budget.assumed` 为运行时监控；d-ii：缺配置 → 不发请求、exit 2。两分支各写一套测试与变异（N6：d-i 删告知 / d-ii 缺配置也放行）。启动 / 续跑时打印限额来源（配置 / `--budget` / 假设值）、盘上 `requests`、上次 `updated_at`。旧目录缺 `budget_assumed` 读作「无从确认」不读作 `false`（ADR-18 方向）。
- **落地**：H 第 3 步 · 裁决 J4 · 档：提议
### 码-20 · `tikhub.ts` 构造接受 `onAuthorized: () => void`，`get()` 在 `charge()` 之后、`fetch` 之前调用
- **目标**：scripts/providers/tikhub.ts 的 `get()`（`:83-103`：`:84` charge、`:87` fetch、`:90` refund）
- **守的判据 / 字段**：业-13、业-22；**执行的规则**：—
- **现状**：顺序 `charge → fetch → 非 2xx refund`；`persist` 是入口函数、`charge` 在适配层，两者之间没有钩子（CE-2 的窗口）
- **提议**：契约 `TikHub.get()` 每次尝试：`charge` → `onAuthorized` → `fetch`；非 2xx ⇒ `refund`；429 重试每次尝试都调回调。另一种落点（`enrichProfiles` 循环里先 +1 再 persist 再 get）写下的是上一次的 `charged`，I2 仍破，不采用。顺序契约改动：ADR + 顺序契约变异 N4（删回调，被崩溃注入属性抓）。测试：fake-fetch 顺序断言（每次 fetch 前最近两事件必须是 charge, persist），设计面板随机 500 例全部抓到 N3。
- **落地**：H 第 3 步 · 裁决 J44 · 档：提议
### 码-21 · `persist()` 拆成只写账本的一支；账本 persist 失败 ⇒ 不发出、按 error 收尾
- **目标**：scripts/collect.ts 的 `persist()`（`:128-133`，今天同时写 `creators.raw.json`；主干变异 `M-P3-b`（req P3.b，by selfcheck）钉在 `:129` `state.requests = budget.count`，拆 persist 时那条 `find` 要跟着动）、scripts/enrich.ts（`:125-129`）、scripts/lib/task.ts
- **守的判据 / 字段**：业-13、业-22；**执行的规则**：—
- **现状**：`enrichProfiles()` 循环内不 persist（`collect.ts:205-229`；persist 只在 `:180` 每页后、`:198` run 末尾、`:245` main）；SIGKILL 于第 2 个 profile 请求时盘上 12、实际 14，续跑后 15 / 17（实跑，CE-2）；persist 失败今天在 `run()` 内抛出 → main catch → `stopped='error'` → 再 persist（可能再抛）→ exit 1
- **提议**：账本支只写 `task.json`，后置「盘上 `requests = charged`；失败抛出且盘上是旧的（A4）」；作为 码-20 的 `onAuthorized` 传入；失败 ⇒ 不 send、exit 1、`task.json` 是旧的。实测（本容器 ext4，含 fsync）3 KB × 3000 次 = 1.5 s，相对 150 ms 限速间隔可忽略；不拆则 400 KB × 3000 = 4 s / 1.2 GB 写放大 —— 必须拆。保证的是 `persisted ≥ billed`（A2 下）不是 `≥ sent`：429 四次尝试后 `persisted = 1`、`sent = 4`、`billed = 0`（实跑，`billed` 按 A2 推得）；退款后到下次 persist 之间盘上多记一次是安全方向。退款后是否也立即落盘是 J32；L1 少拿一次是 J5。验收：3000 请求量级基准（不是 selfcheck）账本落盘总耗时 ≤ 限速总时长 5%（8-p3-pilot.md §D.14 回滚线）。
- **落地**：H 第 3 步 · 裁决 J5、J32 · 档：提议
### 码-22 · 进程内断言：`charge()` 后 `assert(charged × unit ≤ limit)`；账本 `persist()` 后 `assert(persisted ≥ charged)`
- **目标**：scripts/lib/budget.ts、scripts/collect.ts / enrich.ts 的 persist 调用处
- **守的判据 / 字段**：业-13；**执行的规则**：通-18
- **现状**：`budget.ts:36` 是预检（I1 现状成立）；`persisted ≥ charged` 在崩溃窗口内今天不成立（CE-2）；退出码含义「不许扩展」（ARCHITECTURE）
- **提议**：两条断言（退款后 `persisted > charged` 允许）；失败按 error 收尾 exit 1 —— 沿用「其他失败」既有含义；触发即模型与代码分叉。测试：夹具制造分叉后 exit 1。
- **落地**：H 第 3 步 · 档：自动
### 码-23 · `render.ts` 给 `meta.json` 加 `versions: { code, config, provider_shape, node, by_target }`
- **目标**：scripts/render.ts（meta 组装 `:90-141`）
- **守的判据 / 字段**：业-24、业-25；**执行的规则**：通-33、通-40
- **现状**：`meta.json` 没有代码 / 配置 / schema 版本，两次任务的差异无法归因（B17）；主干合并频率不稳：`git log origin/main --merges --format=%cd --date=short | sort | uniq -c` 在 d7e20d7 上按日 1–25 次（cc132a7 之后的日子 1–11 次/天，共 44 个合并）
- **提议**：`by_target: { <软目标>: <只含影响它的文件的指纹> }`（关键词命中率只看 `score.ts` 的维度加分与 `keyword-strategy.md`），不取整棵 `scripts/`；`node` 记 Node 版本（A4 的环境触发器）；旧目录缺 `versions` 时报告声明「版本未知」。验收：selfcheck 里四个字段非空。加的是交付物版本指纹不是缓存键（与 ADR-13 的关系 J14）；是否触及 U7 要评定（J13）。
- **落地**：H 第 1 步 · 裁决 J13、J14 · 档：提议
### 码-24 · `render.ts` 给 `meta.json` 加 `budget` 块
- **目标**：scripts/render.ts
- **守的判据 / 字段**：业-23、业-25；**执行的规则**：—
- **现状**：成本传感器只有 `task.json.requests` 与 `meta.json.cost_estimate_usd`（请求数 × 单价上限的代理，真实计费在供应商侧）
- **提议**：`budget: { limit_m, charged, persisted_at_exit, assumed, reconciliation: 'unverified' | { provider_count, checked_at } }`，`reconciliation` 默认 `'unverified'`；人工对账（供应商后台请求数 vs `Σ task.json.requests`）结果由人写进 assumptions.json 的 A1 / A2「最近验证日期」，审计只读。`meta.json` 装什么是 U7.d 的对象，要评定（J13）。
- **落地**：H 第 3 步 · 裁决 J13 · 档：提议
### 码-25 · `render.ts` 的 `countMeasurements` 对未知 status 报错（`never` 穷尽）
- **目标**：scripts/render.ts（`:54-59`）；主干 `status === 'measured' / 'unavailable'` 二分 —— 口径 scripts/ 除 check/ 与 test.ts：`git grep -o -E "status === '(measured|unavailable)'" d7e20d7 -- scripts ':!scripts/check' ':!scripts/test.ts' | wc -l` → 31（d7e20d7）
- **守的判据 / 字段**：—；**执行的规则**：通-19
- **现状**：31 处二分（17 处是 `?.status`；d7e20d7，口径见目标），无 `never` 断言；未知 status 让 meta 三数不相加或抛 TypeError（observation probe E 实跑，B9）
- **提议**：带 `kind` 的联合 + `never` 穷尽断言，未知 status 报错而不是漏数。零需求变更；是 H 第 10 步三态化计数的地基。验收：probe E 在仓库内变成测试。
- **落地**：H 第 6 步 (a) · 档：自动
### 码-26 · `report.ts:129` 把 email `undefined` 显示成「未查询」
- **目标**：scripts/lib/report.ts（`:129`）
- **守的判据 / 字段**：业-51；**执行的规则**：—
- **现状**：email `undefined` 显示成「无邮箱」，报告把三档压两档（B7）
- **提议**：按 P1 口径显示「未查询」；报告措辞是 U 类交付物且把 P1 口径扩到报告层，配一条「补充」ADR（J19）。测试：`undefined` 与「已查无」渲染不同。
- **落地**：H 第 6 步 (a) · 裁决 J19 · 档：提议
### 码-27 · `task.json` 累加 429 次数、schema 半漂移关键词数、IG 回退次数；`profile_failed` 带原因分布进 `meta.json`
- **目标**：scripts/providers/tikhub.ts（`:96-100` 退避、`:294` IG 回退、`pickList`）、scripts/lib/task.ts、scripts/render.ts
- **守的判据 / 字段**：业-25、业-43、业-45；**执行的规则**：通-32
- **现状**：429 退避后不计数不落盘；`pickList` 完全识别不出时只打印顶层 key，半漂移（数组在、item 形状变）静默成「0 人且标完成」；IG 回退不记录；`profile_failed` 只在 stdout 不进 meta（B6、B17）
- **提议**：`task.json.rate_limited` 累加；`raw_count > 0 但入库 0` 的关键词计数；IG 回退记录来源端点；`profile_failed` 按原因分布进 `meta.json`。这些是熔断 3 与扰动表的传感器（半漂移计数 > 0 冻结参数层）。验收：selfcheck 429 夹具后 `task.json.rate_limited === 1`。是否触及 U7 要评定。
- **落地**：H 第 10 步 · 裁决 J13 · 档：提议
### 码-28 · U3 关键词表按 `task.json.tasks` 出全行，状态三态化
- **目标**：scripts/lib/pipeline.ts（keywordStats `:210-219`）、scripts/lib/report.ts、scripts/collect.ts（`:165-166`）
- **守的判据 / 字段**：业-43、业-57；**执行的规则**：—
- **现状**：把「0 结果 / 请求失败 / 未跑」坍缩成「无此行」；`found` 是过滤后计数且随轮转顺序变（B16）
- **提议**：`task.json.tasks` 里每个关键词出一行，状态 `found = 0 / error / not_run`；`fit_pass` 定义不动。判据措辞先评定（J25）。验收：对 `error` 关键词出行。前提：码-25。
- **落地**：H 第 10 步 · 裁决 J25 · 档：提议
### 码-29 · `identity.ts` 接 `creatorKey`；lint 禁止手拼 `${platform}:${handle}`；合并结果加 `merge_reason`
- **目标**：scripts/lib/identity.ts（`:30,55-61,92`）、scripts/lib/memory.ts（`:339`）；lint 那一半 **目标已撤（ADR-77，主干 d7e20d7）**：lint-rule.ts 已删，「禁止手拼键」要么新建判定模块（指令性，最弱一档，需在 ADR 里直面 ADR-77）、要么改成结构性 —— 让 `creatorKey` 成为唯一能产出键的地方（品牌类型 / 私有构造，3-BUILD.md:65 第一档）
- **守的判据 / 字段**：业-47、业-53、业-54；**执行的规则**：—
- **现状**：`identity.ts` 自拼键且 platform 按字面比较，`TikTok` 被路由进 instagram 桶；库里 `tiktok:alice` contacted，查 `alice `/`alice﻿` 静默漏过；`[tiktok:mei_cooks, tiktok:mei.cooks, instagram:meicooks]` 两个候选同时命中信号 3 时合并了第一个，配对随输入顺序变（实跑，B10）
- **提议**：去重那一半改用 `creatorKey`（修 D1.c）；手拼键按目标里的两条路二选一（默认结构性）；`merge_reason` 落到合并结果。查询侧是否过 `keyProblem`（J22）与「某侧 ≥ 2 候选同信号 ⇒ 不合并」是否是 D3「不确定」（J23）按 ADR 裁决后落地。验收：identity track 的 run1 / run2 变成测试；`TikTok:dana` 与 `tiktok:dana` 合并。属性：码-39。风险：查询侧收紧后真实 API 返回带空白 handle 的比例未知。
- **落地**：H 第 8 步 · 裁决 J22、J23、J50 · 档：提议
### 码-30 · `Observation<T>` discriminated union 迁移，按读点数分批
- **目标**：scripts/lib/types.ts、scripts/collect.ts（`:219-225` 请求失败一律 `bio: undefined` 的赋值，B6）、scripts/lib/pipeline.ts（`:78`，B6）
- **守的判据 / 字段**：业-30、业-50；**执行的规则**：通-19
- **现状**：profile 请求失败（404 / 5xx / 网络 / 402）一律 `bio: undefined`；Creator 层没有 Unavailable(reason)；`bio_links` 二态导致有简介无外链者每次续跑重查（付费；测试断言为预期行为，B6）
- **提议**：`Observation<T> = Unqueried | MeasuredPresent<T> | MeasuredAbsent | Unavailable<Reason>`；一批一个字段：email 9 处、bio 10 处、followers 29 处（cc132a7 计数；rows.ts / pipeline.ts / score.ts 在 d7e20d7 上有改动，未复核）；`_interface.md` 跨层契约不动。`bio_links` 的未查询态与重试策略归谁先 ADR（J18）。验收：新增变异「把 Unavailable 折叠成 Unqueried」被抓到。
- **落地**：H 第 6 步 (b) · 裁决 J20 · 档：提议（架构 ADR 人批）
### 码-31 · 外部响应与四个落盘 JSON 的手写形状校验
- **目标**：scripts/providers/tikhub.ts（`:281` `followerCount` 进 number）、scripts/lib/task.ts（`:27-29`）、render / enrich 的读入点；风格沿 `memory.ts` 的 `shapeProblem`
- **守的判据 / 字段**：业-47；**执行的规则**：通-19
- **现状**：`followerCount:"12K"` 进 number 字段 → 粉丝闸门静默丢弃；`is_private` 缺失被 `Boolean()` 压成 false；只有 memory 文件有校验（observation probe D 实跑，B7）
- **提议**：只校验会读的字段、报真实原因；不引 zod / valibot / arktype（unpacked 5.8 MB / 1.8 MB / 0.34 MB，只 `npm view` 未装）。验收：probe D 变成测试。变异：「`"12K"` 也放行」。
- **落地**：H 第 6 步 (c) · 档：提议
### 码-33 · `product-facts.json` + `Creator.outreach_claim_ids` + render 引用完整性检查
- **目标**：新文件 product-facts.json（Phase 01 写、Agent 拥有、render 只读）、scripts/lib/rows.ts、scripts/render.ts、Phase 01 新入口（缝隙契约改动）
- **守的判据 / 字段**：业-29、业-55；**执行的规则**：—
- **现状**：产品页事实不落盘，没有 claim / evidence 结构；三条输出路径今天都原样保留占位符（实跑，B12）；Phase 01 抓页今天不落盘
- **提议**：`Evidence{ id, sourceUrl, observedAt, contentHash, excerpt }`、`Claim{ id, text, evidenceIds, status: 'supported' | 'placeholder' | 'offer' }`；render 检查：每个 `supported` claim 的 `evidenceIds` 存在、`sourceUrl / observedAt` 穿透到数据边界、三条路径占位符计数一致；词法 token 覆盖只做成 P5 形状的声明不硬失败。机器抓的是「引用断了」「占位符被抹」「来源丢了」；自洽但编造的 claim 通过检查 —— 写进 I 节不当 bug。设计走 5-DESIGN；改字段所有权是改尺子，依赖 H 第 5 步。
- **落地**：H 第 9 步 (b) · 裁决 J41、J42 · 档：人批
### 码-35 · 参数层变量集中到一个配置文件
- **目标**：新配置文件 + scripts/lib/score.ts（四维权重、竞品词 +15、粉丝闸门 5000 / 5000000、tier 阈值）、scripts/collect.ts（`:30` `MAX_PAGES = 4`）、scripts/lib/assessment.ts、scripts/providers/tikhub.ts 的常量
- **守的判据 / 字段**：业-44；**执行的规则**：通-34、通-35
- **现状**：散在四个文件；`semantic-fit.md` 有副本；`assessment.ts` 的粉丝档独立写死
- **提议**：一处文件装全部参数层常量，副本同步；是 码-09 单变量守法的前提。粉丝闸门与风险阈值仍是人批 / 改需求项，集中只改位置不改档。
- **落地**：H 第 12 步 · 档：提议
### 码-36 · `shadow.json` 影子块 + lint 守 `skill/` 不出现该文件名
- **目标**：scripts/render.ts / scripts/lib/pipeline.ts；lint 那一半 **目标已撤（ADR-77，主干 d7e20d7）**：lint-rule.ts 已删，需新建判定模块或改成验证性（`skill/` 下查文件名是一条关系校验，可并入 码-46 的模块）
- **守的判据 / 字段**：业-29、业-38、业-46；**执行的规则**：通-36
- **现状**：本产品无多用户、无部署，传统灰度不适用
- **提议**：只对纯评分常量（`score.ts` 的维度加分、竞品词加分、tier 阈值）：候选参数与现行同时计算（本地纯函数，不花钱），结果写进 Agent 不读的 `shadow.json`，交付物仍按现行参数产出；`MAX_PAGES` 类无影子形式；桶满后人批翻开关，翻开关 PR 写回滚触发器。守法：`skill/` 出现 `shadow.json` 即红（落点见目标，lint-rule.ts 已删）。
- **落地**：H 第 12 步 · 裁决 J50 · 档：提议
### 码-37 · `experiments.json` 跨任务台账 + `Creator.fit_review` + 一致率三态进 `meta.json`
- **目标**：新文件 experiments.json、scripts/lib/types.ts、scripts/render.ts
- **守的判据 / 字段**：业-29、业-40、业-41、业-46；**执行的规则**：通-32、通-35
- **现状**：只有每任务的 `meta.json`；`fit` 只有一个字段，没有第二判定的落处
- **提议**：`fit_review: { by: 'human' | 'agent-2', value, at }`；每任务固定 N = 10 条盲判，一致率以三态进 `meta.json`（未抽检 / 抽检 n 条一致 k 条）；按桶跨任务累计，n ≥ 50 才成决策输入，未达门槛前关键词表不得用于换词（业-41）；台账记改了什么、何时、桶、结果。验收：熔断 0 的四个传感器（版本指纹、扰动计数、一致率、台账）全部存在，熔断默认态解除。
- **落地**：H 第 12 步 · 裁决 J13 · 档：提议
### 码-50 · `ConfirmedLimit` 品牌类型（唯一构造函数 = `budgetProblem`），`Budget` 只接受它（可选）
- **目标**：scripts/lib/budget.ts、scripts/lib/task.ts（`loadTask()` 返回 `budget_usd: number`）
- **守的判据 / 字段**：业-11；**执行的规则**：通-19
- **现状**：`limit` 对应 `Budget.limitUsd`（`budget.ts:21`），⊥（NaN / null / 缺失）时今天仍存在授权转移（CE-1）
- **提议**：类型只保证「值经过了构造函数」，真正挡 NaN 的是 `budgetProblem` 的运行时校验；`loadTask()` 的 `budget_usd: number` 一个 `as` 就过编译。不在试点内。
- **落地**：H 第 3 步之后可选 · 档：自动

## scripts/test.ts
### 码-38 · 属性测试设施：先量 `npm ci`；> 60 秒则自研约 50 行 `forAll`
- **目标**：package.json devDependencies（fast-check 4.9.0 + pure-rand）或 scripts/test.ts 自研 forAll
- **守的判据 / 字段**：业-59；**执行的规则**：通-12
- **现状**：无属性测试设施（B13）；devDeps 只有三个、产品代码零依赖；2026-09-04 的 `npm ci` 7 分钟根因未明（check.yml:23–26 的注释与 `--prefer-offline --no-audit` 仍在）；age 已撤（ADR-76），只剩 check.yml 一条工作流；量 `npm ci` 与检查链时注意 `.check-cache/compile-cache`（`mutate.ts:214` `NODE_COMPILE_CACHE`，ADR-75）—— 首跑与热跑分开量
- **提议**：先一条只改 lock 文件的 PR 量 `npm ci`；超过 60 秒改用自研 `forAll`（固定 seed、失败走 `fail++` 不 throw、无 shrink）。fast-check 实测：性质 C 523 次后失败、shrink 13 次到 `limit=0.009` 第 9 次误拒，每性质 25–60 ms（2000 runs），86 行；重放要 `seed + path + replayPath` 三者齐全（`fc.commands` 需单独传 `replayPath`），写进 `4-VERIFY.md`。seed 写死，只允许本地环境变量重放；nightly 随机 seed 是 J37。验收：`npm test` 增量 < 1 秒。`fc.asyncModelRun` 对 `TikHub.get()` 这类 async 被测对象尚未验证。
- **落地**：H 第 4 步 · 裁决 J12、J37、J54 · 档：人批（devDependency + lock 文件）
### 码-39 · 三组属性：P3（按 `8-p3-pilot.md §D.10` 表）、D1 / D3 六条、D5 round-trip；每条至少一个变异；N ≤ 50
- **目标**：scripts/test.ts（+ kill-fetch / crash-inject 夹具）
- **守的判据 / 字段**：业-11、业-13、业-14、业-16、业-47、业-54；**执行的规则**：通-12、通-14、通-17
- **现状**：P3 只有例子测试 P3.a（0.005 × 10）+ `M-P3-a`（req P3）+ 主干新增的 `M-P3-b`（req P3.b，by selfcheck，d7e20d7）；D1 / D3 例子 + `M-D1-a`、`M-D3-a`；D5 例子 + `M-D5-a`
- **提议**：P3（按 `8-p3-pilot.md §D.10` 表「属性测试」列，一行一条）：P3.a/1 随机 `(limit, 序列)` 检 I1、I3（拒绝前后 `charged / persisted / notified / sent` 不变且不 `send`）；P3.c 随机字符串：非有限 → 拒（`Number()` 静默接受的形状作例子，见 码-44）；P3.e 崩溃注入任意点后 `persisted ≥ billed`；P3.f 随机十进制 limit 恰好 `L/unit` 次；F7.a 每阈值 ≤ 1 次（每进程 —— 业-18 / J8 裁决前的临时解读）；生成器：`limit ∈ [0, 3000]` 毫美元或十进制字符串、事件序列 ∈ `{propose, respond(ok), respond(429), respond(500), crash, resume}*`、长度 ≤ 50。D1 / D3：`creatorKey` 幂等；写入侧收下 ⇒ 读回 ok ∧ 查询命中 ∧ swapcase 命中；昵称相同 handle 无关 ⇒ 不合并；某侧 ≥ 2 候选同信号 ⇒ 一个都不合并（J23）；任一侧未知 ⇒ 结果未知；同数组二次 link 返回 0（identity track 与 tools-research 已跑过，可直接搬）。D5：CSV round-trip。预算：设计面板 N = 2000 时 3.8 秒（每例约 1.9 ms），N = 100,000 超 120 秒中止；每条 N ≤ 50，七条合计 `npm test` 增量 ≤ 0.1 秒，乘变异数 `node -p "require('./scripts/check/mutations.json').mutations.length"` → 330（d7e20d7）≈ 33 秒 CPU 时间；墙钟按并行度折算（`mutate.ts` 缺省按 `availableParallelism()` 派工，ADR-72 实测 4 核 3.41 核忙），秒数按 ADR-72 口径不跨机器、未实测；`formal` 步不乘变异数（变异只跑验证者），其 ≤ 5 秒另算；大 N（2000 以上）只在本地按 seed 跑。测试先行：独立上下文只读子句与术语表写。P3.a 文本改属性形式是 J35。
- **落地**：H 第 4 步（设施）、第 3 步（P3）、第 8 步（D1 / D3）· 裁决 J35、J54 · 档：自动
### 码-44 · `test.ts` 新例子测试（P3.c 输入、换算）+ selfcheck 三入口坏预算 / 坏账本真跑
- **目标**：scripts/test.ts、scripts/check/selfcheck.ts
- **守的判据 / 字段**：业-11、业-26；**执行的规则**：—
- **现状**：`Number()` 静默接受 `'1e3'` → 1000、`'0x10'` → 16、`''` → 0（实跑）；selfcheck 无坏预算 / 坏账本夹具（d7e20d7 仍成立：`selfcheck.ts` 里 `--budget` 只出现在合法值 `'1'` 的续跑夹具，无 `abc` / `null` 形状）
- **提议**：例子：`abc`、`-1`、`0`、`Infinity`、`1e400`、盘上 `null` / `"4"`、`'1e3'`、`'0x10'`、`''`；换算例子见 码-18；selfcheck 真跑 `budget_usd: "abc"`、`requests: null`、`--budget 3.0.0` 三条入口 exit 2 且 `task.json` 字节不变（#75 分支 f652943 的 +46 行随 0b 走；在 d7e20d7 上新夹具要用 `named` / `runBoth` / `run` 写成可被 `kills` 点名的 label —— 进程级失败带 `（进程）`、夹具没造对带 `（夹具）` 记号（`verifier-rule.ts:102/117`），两种都不算「被抓到」；P3.c 的入口判据若要负片，直接写 `by: "selfcheck"` + `kills`，并在自检里 `criterion('P3.c')` 发入口认领）。R11：exit_code 类 oracle 由自检认领 —— 这是 d7e20d7 的现行机制（入口认领 `ENTRY_CLAIMS_PATH`，ADR-70 落地 3），R11 只把「不得由 test.ts 认领」写成规则。字符串写法（`'1e-3'` 接受还是只认十进制、number 型科学计数是否放行）是 J30。
- **落地**：H 第 0b 步（selfcheck）、第 3 步 · 裁决 J30 · 档：自动

## scripts/check/mutations.json
### 码-34 · XLSX 与 HTML 路径的占位符变异；CSV 断言改读回落盘文件
- **目标**：scripts/check/mutations.json（P2 名下新条目）、scripts/test.ts（`:2661-2685` 只验 sheet 名，与 cc132a7 的 2499-2523 逐字相同）、scripts/lib/xlsx.ts 的 `esc`
- **守的判据 / 字段**：业-47；**执行的规则**：—
- **现状**：XLSX 路径没有占位符测试也没有占位符变异（d7e20d7 上 xlsx.ts 唯一的变异是 `M-D4-p`，守的是落盘整体替换），HTML 有测试无变异；在 `xlsx.ts` 的 `esc` 里抹 `{}`，现有测试全绿（读代码推断，B12）
- **提议**：XLSX 与 HTML 各一条「抹占位符」变异；CSV 断言读回落盘文件。零需求变更。
- **落地**：H 第 9 步 (a) · 档：自动
### 码-41 · `mutations.json` 新条目 N1–N8（落地时按合入顺序续编）
- **目标**：scripts/check/mutations.json
- **守的判据 / 字段**：业-04、业-05、业-11、业-12、业-13、业-14、业-22；**执行的规则**：通-18
- **现状**：现有 `M-P3-a`（req P3，删超限抛出，P3.a 例子抓）与**主干已占的 `M-P3-b`**（req P3.b，`collect.ts:129` `state.requests = budget.count` → `= 0`，by selfcheck，kills「collect 预算用尽后留下的断点记到了中止那一刻」，ADR-70 落地）；#75 分支 97c358e 里叫 `M-P3-b`（请求先发再过闸门）与 `M-P3-c`（`budgetProblem` 恒 `undefined`）的两条与主干撞号不同义；分支 2deb489 已自行避让：原 `M-P3-b` → `M-P3-c`（tikhub 先后，即 N3）、原 `M-P3-c` → `M-P3-d`（budgetProblem，即 N5）、原 `M-D6-i` → `M-D6-l`（ledgerProblem）、`M-H16-a/b/c` → `M-H41-a/b/c`（formal-rule）—— `git show 2deb489:scripts/check/mutations.json` 读得 336 条，P3 名下 `M-P3-a/b/c/d`；主干 P3 名下只有 `M-P3-a`、`M-P3-b`（d7e20d7，命令 `node -p "require('./scripts/check/mutations.json').mutations.filter(m=>m.req.startsWith('P3')).map(m=>m.id).join(',')"`），`M-P3-c` / `M-P3-d` / `M-D6-l` / `M-H41-*` 在 d7e20d7 上都未占用；N2、N3 打到 d7e20d7 跑现有 `scripts/test.ts`：1004 ✓、exit 0 —— 仍存活（实跑 d7e20d7；cc132a7 上 837 ✓ 同样存活）
- **提议**：N1 `>` 改 `>=`（P3.a 例子已抓，P3.f 属性扩全域）；N2 删非 2xx 退款（落地前先有归属 —— P3.e 子句或 A2 进判据，否则 ADR-34 归属检查会拒）；N3 = #75 分支 97c358e 里叫 `M-P3-b` 的那条（fake-fetch 顺序断言；2deb489 起叫 `M-P3-c`）—— 落地时不能再用 `M-P3-b`：走「从分支摘取」沿用 2deb489 的编号，走「重做」从主干未占号续编且与分支一次分配（J53）；N4 删发请求前落盘回调（崩溃注入属性）；N5 = #75 分支 97c358e 里叫 `M-P3-c` 的那条（P3.c 例子；2deb489 起叫 `M-P3-d`），编号同 N3 的分配办法；N6 假设值告知（P3.d 例子）；N7 `floor`（换算例子）；N8 不变量恒真（`broken-charge` + #75 的 `M-H16-*` 改编为 `M-H41-*` 起 —— 2deb489 已改成 `M-H41-a/b/c`，见 码-10）。`why` 用需求语言（8-p3-pilot.md §D.11 表原句）；每条 `shall` 一个「不做 R」、每条 `shall_not` 一个「做了 R'」。
- **落地**：H 第 3 步 · 裁决 J53 · 档：自动
### 码-42 · `mutations.json` 治理检查：基线不减；`exemptions[].why` 非空；每类豁免总数进审计
- **目标**：scripts/check/mutate.ts / attribution-rule.ts / audit.ts；`mutations.json` 的 `exemptions[]`
- **守的判据 / 字段**：业-56；**执行的规则**：通-08、通-21、通-24、通-25
- **现状**：d7e20d7 上有机器读的豁免五种（`p1-ok`、`age-ok` 随闸门消失，ADR-76 / 77）：`size-ok`（`trailer.ts`，`size-rule.ts` 校验类别与理由）、`JUDGMENT_EXEMPT`（`audit-rule.ts:42`，1 条 fake-fetch.ts）、`EXEC_EXEMPT`（`audit.ts:199`，1 条 scripts/test.ts）、selfcheck.ts 的 `EXEMPT`（`:33`，目前为空）、`mutations.json` 的 `exemptions`（`:2656`，2 条 P2.a、P1.b），外加一种纯注释 `P1 例外：`（scripts/ 下 19 处，无工具读）；全部自批；理由非空只有 `size-ok` 走 trailer 校验，`JUDGMENT_EXEMPT` 有测试守非空（`test.ts:3651`），`exemptions[].why` 只被 `mutate.ts:189/684` 与 `audit.ts:150` 读进报告、无非空校验；`exemptions[].mitigation` 没有任何代码读（`mutate.ts:69` 声明后无读点；ADR-70 落地 2 第 5c 第四片记了「有负片就不许再写 mitigation 是落地 4 的事」的欠条，B18、B20 → 业-58）；变异数 `node -p "require('./scripts/check/mutations.json').mutations.length"` → 330（d7e20d7；基线迁移：cc132a7 226、#81 后 229）
- **提议**：变异集条数基线不减（对主干基线 —— 这是 ADR-79 刚撤掉的那类「对着主干比」的机器，「为什么」要按 ADR-81 三问补：变异被删是哑的、模型替代不了、发生过没有未知；ADR-81 保留了 ADR-62「判定模块必须有变异」那条关系钩，本条守的是「条数」不是「关系」，两者别混）；`exemptions[].why` 非空校验；每类豁免（代码内常量、提交 trailer、变异集豁免表）总数进审计报告，只增不减时报警不红（ADR-81 / 80 / 83 的死亡条件都挂在「欠条台账可机读」那道闸门上，本条是那道闸门的一半）；删变异或改 `find / replace` 要 `oracle-change:` trailer（码-06），`by` / `kills` 两个字段也算「改尺子」。P2.a 豁免 `scope` 收窄按 ADR-24 独立复核（J24）。
- **落地**：H 第 5 步 · 裁决 J24、J52 · 档：提议
### 码-43 · N9（入口 exit 3 改 exit 1）：先由 selfcheck 夹具守，ADR-70 五刀落地后改为变异
- **目标**：**主干已做（ADR-70 落地 2–4，d7e20d7）**：scripts/check/verifier-rule.ts（219 行）已被 `mutate.ts:57` 引用并接线；本条只剩 scripts/check/mutations.json 一条新变异 + 自检夹具
- **守的判据 / 字段**：业-05；**执行的规则**：—
- **现状**：**主干已做**：P3.b 的显式豁免已撤（`exemptions` 只剩 P2.a、P1.b），改由 `M-P3-b`（by selfcheck，kills 一条夹具）守 + 自检 `criterion('P3.b')`（`selfcheck.ts:280`）发入口认领；`by` / `kills` 同进同出、`unknown-verifier` / `missing-kills` / `kills-without-by` / `kills-not-list` 四种坏法当场拦（`mutate.ts:118–121`）；只由自检认领的判据没有 `by: "selfcheck"` 负片即审计硬失败（4-VERIFY.md:177–210）；变异 226（cc132a7）→ 229（#81）→ 330（d7e20d7）
- **提议**：不必再等：N9 直接写成 `by: "selfcheck"` + `kills: [<入口夹具 label>]` 的变异（req P3.b，与 `M-P3-b` 并列续编），夹具 label 要能被清册扫到（`named` / `runBoth` / `run`）；`why`「预算用尽被当成出错，Agent 不会提示追加预算」。
- **落地**：H 第 3 步 · 裁决 J53 · 档：提议

## .github/workflows
### 码-48 · CI：`oracle` 步进 check；覆盖记录作为 artifact 持久化；`formal` 30 秒回滚线；（可选）TLC 独立 Java job
- **目标**：.github/workflows/check.yml（28 行；`npm ci --prefer-offline --no-audit` `:26`、`npm run check` `:28`；age.yml 已删，ADR-76）
- **守的判据 / 字段**：—；**执行的规则**：通-22、通-27
- **现状**：CI 配置无守；两份覆盖记录（`.check-cache/test-claims.json` 由 `npm test` 写、`.check-cache/selfcheck-claims.json` 由 `npm run selfcheck` 写）不入库、可伪造；改 lock 文件会让 check.yml 这一条工作流首次冷缓存（age.yml 已删）
- **提议**：`npm run check` 含 `oracle`（随 码-06）与 `formal`（随 码-11）；`.check-cache/test-claims.json` 与 `.check-cache/selfcheck-claims.json` 两份上传为 artifact；`formal` > 30 秒或不可重现即撤 CI 步骤（8-p3-pilot.md §D.14）；TLC job 可选：`ubuntu-24.04` 镜像文档列有预装 JDK（联网核对），本仓库 CI 未验证（尚未验证）。
- **落地**：H 第 5 步、第 0d 步 · 裁决 J33、J54 · 档：提议 + 非作者复核（CI 配置）
### 码-49 · 分支保护：由人核对 `main` 的 required checks 与非作者复核，结果写进 SYNC
- **目标**：GitHub 仓库设置（不在仓库内）
- **守的判据 / 字段**：—；**执行的规则**：通-13、通-22
- **现状**：`main` `protected: true` 但规则内容查不到（403）；仓库只有一个人类身份（两条都是 cc132a7 时查的，d7e20d7 未复核）；PR #78 零 review 自合（B18）；2026-09-18 起有 REVIEW.md（28 行，只做转发）+ `.github/copilot-instructions.md` + `.coderabbit.yaml`（ADR-83），#75 的唯一评论是 Codex 机器安全评审 —— 仍无分支保护配置的仓库内证据
- **提议**：核对 required checks 含 `check`（age 已撤，ADR-76）、触及 P1–P5 的 PR 需非作者复核；结果写进 `docs/SYNC.md` 一行（业-31；形状同 SYNC.md:34 那行 REVIEW.md 指针「✗ 靠执行」）。「只有一个人」如何充当第二人是 J16 —— 主干现在多了一个可写的选项：机器评审器（Codex / CodeRabbit / Copilot）充当规则工具方，独立性未验证（ADR-83 自述「没验之前不要当成评审已经知道规矩」）；J16 的选项由父级改。
- **落地**：H 第 5 步 · 裁决 J16 · 档：人批（仓库管理员）

## formal/
### 码-12 · `formal/` 目录：`BudgetProtocol.tla`（安全性）+ `BudgetP3.tla`（活性）+ README + `IMPLEMENTATION-MAP.md`（0e）
- **目标**：formal/（新目录；`.tla` 180 行落 `categorize()` 的「其他 200 行」）
- **守的判据 / 字段**：—；**执行的规则**：通-15
- **现状**：#75 分支（f652943，已关闭未合入）的 `formal/budget/BudgetProtocol.tla` 与 TS 模型互比可达状态集，五个场景 1586 / 2236 / 56 / 113 / 81 全部 `onlyModel = 0, onlyTlc = 0`（本次复现，`-deadlock -workers 1`）；本会话的 `BudgetP3.tla` + 十个 cfg 在 TLC 2.19 跑过（实跑：写前记账 22,696 状态 1.3 秒、放大界 150,502 状态 2.2 秒）
- **提议**：两份规约当参考规约与独立复核工具，`--tla` 不进 CI；`IMPLEMENTATION-MAP.md` 是假设登记表雏形，被 assumptions.json 结构化后保留「模型里没有的那一半 —— 人工核对表」；SYNC 行（d7e20d7 第 37 行「改预算/成本逻辑」）「→ 同时改模型与 IMPLEMENTATION-MAP.md」。0a 的 ADR-68 单独先合见 业-20 —— d7e20d7 上 68 号仍空着（`npm run adr` → 「74 条，编号 1–83」；缺号 27 29 48 51 52 53 57 60 68），从分支提交 ace85ef 摘取，仍可行。入不入库是 J33。
- **落地**：H 第 0e 步 · 裁决 J33、J1 · 档：自动（文档类）
