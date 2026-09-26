# KOL 筛选优化：完整接手 Prompt

> 2026-09-26 工作快照。可把本文全文复制给另一个 AI，或让新会话读取本文件后开始。
> 本文是接手说明，需求正本仍是 `docs/requirements.json`，架构与流程仍以仓库对应文档为准。
> 本文包含评估结果和已知实现问题，**不能作为独立盲评者或独立测试编写者的全部输入**。那些上下文必须按下文另行隔离。

---

## 1. 你接手的任务与工作位置

请在 `kol-outreach-skill` 仓库继续完成通用 KOL 筛选优化，复核已有实现，修复已知遗漏，并在资料足够时完成有真实人工答案的新旧效果对照。

- 仓库：`https://github.com/c01dsummer/kol-outreach-skill`
- 工作快照分支：`codex/kol-screening-calibration`
- 本地原工作目录：`/Users/yucheng/Documents/Personal/Development/kol-outreach-skill`
- 快照基于提交：`1097457`，对应 `Validate raw resume progress before side effects (#189)`。
- 保存快照前抓取到的 `origin/main` 是 `45f5402`，比上述基点领先 20 个提交，主要涉及检查与 CI 优化。
- 这份快照保留了已有未提交检查基础设施改动及本次筛选优化，**尚未与这批较新的 main 提交整合**。后续先重新核对远端，不能假定上述 SHA 永远最新。
- 本次保存分支的授权包括提交并推送当前工作；没有把分支合入 main 的授权，也没有新增付费 API 请求的授权。
- 分支是完整工作快照，存在第 9 节的已知待修问题；不能以“已推送”代替“可合并”或“业务效果已改善”。

若在另一个本地目录或新机器工作，使用实际仓库根目录替代本文绝对路径。先检查 `git status`、当前分支和最新提交，保留已有未提交改动。不要用 `reset --hard`、`clean` 或整文件覆盖清空别人工作。

新 clone 可以直接检出该分支；已有 checkout 应先核对本地改动后再选择安全的检出方式。不要为了接手而覆盖 `.env`、`memory/` 或 `output/`。

## 2. 用户真正要解决的问题

减少“工具强推荐、团队却不采用”的账号，让名单更接近团队真实选人方式。**不能靠增加候选数代替质量改善，也不能只靠减少推荐数宣称更准。**

已经确定，不要重新让用户选择：

1. 优化通用工具，Adiaro 偏好作为项目输入。
2. 默认按采用优先级排序，保留 A/B/C。
3. 人工反馈独立 CSV，支持 Excel 填写。
4. 人工答案必须来自对应队列的真实人工复评；附件 10 人只是初筛候选。
5. 第一轮用本地已有证据，不新增付费 API 请求。
6. 人工评审与 Agent 判断分别保存，不能用人工答案覆写 Agent 后再比较。
7. 暂不调整硬指标权重。积累 3–5 轮真实人工审核后，再评估评分或长期反馈记忆。
8. 不扩展 memory 为 CRM：人工不采用不等于全局 blocked，不改 contacted/replied，不建设共享 memory。
9. 用户关心的是新资料以后补齐是否要重做。现有数据所有权、身份、轮次和证据边界应使补资料主要变成数据接入、项目校准或新一轮评估；不要承诺永远不需要修代码。

用户后来作了关键澄清：**18 人人工复评截图来自另一位使用者，与 Adiaro 57 人没有直接关联。两者是不同队列，无需重合。** 不能把“18 人表没有覆盖 57 人”当成错误，也不能把外部人工标签借给 57 人。

## 3. 开始前必须读的仓库文件

依 `AGENTS.md` 规定顺序读取：

1. `AGENTS.md`、`process/README.md`。
2. `docs/SPEC.md`；编号定义、验收标准与 `content_hash` 来自 `docs/requirements.json`。
3. 改代码前读 `process/3-BUILD.md`、`docs/CONVENTIONS.md`。
4. 改边界、顺序或接口前读 `process/5-DESIGN.md`、`docs/ARCHITECTURE.md`。
5. 写测试前读 `process/4-VERIFY.md`；独立测试上下文遵守其准入读物清单。
6. 改需求读 `process/1-REQUIREMENTS.md`、`process/2-CHANGE.md`。
7. `skill/SKILL.md` 及此次涉及的 `skill/references/*`。
8. 同步文档读 `docs/SYNC.md`；提交、分支、评审读 `process/6-INTEGRATE.md`；独立复核读 `REVIEW.md`。

特别注意：

- 判断、编排、开发信属于 `skill/`；采集、身份、排序、统计、文件读写属于 `scripts/`。不要把品牌语义判断写成僵硬规则引擎。
- 五条红线 P1–P5 保持：不补造缺失值、不编产品事实、不超未授权预算、不重新推荐已联系/屏蔽者、交付声明数据边界。
- SPEC 登记表不能手改；变更 json 后按仓库命令生成并校验。
- ADR 一条一个文件，已有记录只追加更正，不改写历史。
- 新运行原件、日志、离线评估放 `output/<名字>/`，保留 manifest 和哈希；不放进 `docs/`，不强行加入 Git。
- 向用户报告用“改了什么、证据是什么、还差什么”，不用内部流程术语冒充进度。

## 4. 已有改动在哪里

先读差异，不要从零重写。以下为定位索引，确切行为以代码与需求为准。

| 位置 | 当前改动职责 |
|---|---|
| `scripts/lib/review.ts`（新增） | 评审正本、校准校验、规范化身份、旧字段迁移、冻结审核轮次、CSV 校验、统一投影、有效优先级、人工统计 |
| `scripts/feedback-template.ts`（新增） | 单独创建人工 CSV；显式 `--append` 补充新账号，保留已有人工行 |
| `scripts/lib/types.ts` | 品牌校准、评审、人工反馈、报告需要的结构化类型 |
| `scripts/collect.ts` | 新建/续跑输入校验、覆盖旧 creators 前保存 Agent 评审、统一投影 |
| `scripts/enrich.ts` | 指标补全和评审投影共用关联逻辑；坏输入在副作用前失败 |
| `scripts/render.ts` | 统一投影、重新检查 memory 后生成交付物 |
| `scripts/lib/memory.ts` | 导出前检查联系/屏蔽状态，保留同任务既有推荐豁免 |
| `scripts/lib/pipeline.ts`、`score.ts` | 分层、优先级排序、缺语义与待重评降级；没有改硬指标权重 |
| `scripts/lib/rows.ts` | 保持旧列，追加 Agent/人工/有效优先级列，CSV/XLSX 共用行结构 |
| `scripts/lib/report.ts` | HTML 全量默认可见、双筛选、Agent/人工并列、证据、轮次/分母/分歧/关键词统计 |
| `scripts/review-test.ts`、`scripts/screening-contract-test.ts`（新增） | 独立契约断言、真实入口与产出物回归 |
| `scripts/test.ts`、`scripts/check/selfcheck.ts`、`scripts/check/mutations.json` | 接入需求测试、入口自检和关键负向变异 |
| `docs/requirements.json`、`docs/SPEC.md` | D20–D22、F11、U9–U11、S6 等登记/更新，旧编号保留；U1/U6 退役 |
| `docs/ARCHITECTURE.md`、`docs/business-requirements.md`、`README.md` | 所有权、入口、顺序、业务解释与用法同步 |
| `docs/adr/ADR-118-评审与人工反馈分离，名单以采用优先级排序.md` | 本次边界与取舍 |
| `skill/SKILL.md` 及 product-intake、semantic-fit、output-format、keyword-strategy、memory、outreach-draft 参考文件 | Agent 判断方式、证据边界、项目偏好、输出与操作约定 |

同时保留的检查基础设施改动包括：Node 22.22.2 与 CI `MUTATE_JOBS=4`、检查命令 `node --import tsx`、严格选组参数、子集合法基线、并行变异恢复和输出刷新。

- 主要文件：`.github/workflows/check.yml`、`scripts/check/{group-rule,mutate-restore,mutate-rule,mutate,tsx-cmd}.ts`。
- **混合文件**：`package.json`、`scripts/test.ts`、`scripts/check/selfcheck.ts`、`scripts/check/mutations.json` 同时包含原有检查优化及本次业务部分。不能整份认作某一类后撤销。
- main 后续提交已有一部分相同方向的检查优化。整合时逐段比较，保留 main 的新修正和本分支业务测试，不要盲选 ours/theirs。

## 5. 不得丢失的数据与判断契约

### 5.1 品牌校准是可选项目输入

`task.json.brand_calibration` 可缺席；存在时包含以下结构，类型见 `scripts/lib/types.ts`：

```json
{
  "version": "项目自定版本",
  "target_creator_types": ["目标创作者类型"],
  "tone_aesthetic": ["内容语气与审美偏好"],
  "natural_scenarios": ["可解释的自然使用场景"],
  "negative_signals": ["项目负面信号"],
  "sources": [
    {
      "source": "可追溯出处",
      "kind": "brand_preference",
      "detail": "项目偏好，不能当产品功能事实"
    },
    {
      "source": "已核对出处与日期",
      "kind": "verified_product_fact",
      "detail": "已证实到什么程度；官网宣称不等于实测或疗效"
    }
  ]
}
```

Agent 从官网、附件、已有偏好整理，在现有小样方向确认里展示，不新增固定长问卷。新建任务与续跑保留该输入。偏好/事实改变时明确更新版本，保留旧判断并标“待重评”，不要暗改版本含义后将旧评审当新评审。

Adiaro 项目方向：journaling、self-reflection、具体 daily reset/self-care 为主；jewelry styling 补充；个人、自然、有生活感；能解释“佩戴 → 轻触 → 记录或反思”。这不是所有品牌的淘汰规则。

本地 `output/adiaro-screening-validation-20260925/adiaro-brand-calibration.json` 的作用是保存这次离线验证所用的 **Adiaro 项目输入快照**，版本 `adiaro-initial-20260925`。它不是人工答案、全局规则或继续技术工作的强制前置文件；要用到真实任务时按任务契约接入，不能把验证目录伪装成任务。

### 5.2 Agent 必须分开写判断与证据

- `eligibility`：`合格` / `不合格` / `待核实`。
- `adoption_priority`：`优先联系` / `备选` / `待核实` / `暂不采用`。
- `observed_content`：实际观察到什么。
- `work_evidence`：对应作品、ID/链接/本地位置、样本范围。
- `natural_integration`：产品如何自然进入其已有内容形式，必须具体。
- `mismatch_risk`：最大不匹配或尚未核实的问题。
- `fit`、`fit_reason` 兼容保留；开发信 `outreach_draft`、所用 `brand_calibration_version` 一并保存。

没有具体植入场景不能给 Agent“优先联系”。不露脸本身不能否决原创手帐/手作。缺语义判断统一待核实 B，不能凭分数升 A。旧任务有 legacy fit 但无新判断时新字段显示未评，不伪造新结论；既有明确语义字段如何参与原分层按代码/契约执行，不把所有旧账号一律当作完全未做语义评审。

创作者所在地与受众所在地分开。未看画面不推断审美，未看评论不判断真实性，搜索命中不冒充完整近期主页，缺数据不等于不合格。公开互动只是辅助，高互动不挽救不匹配、低互动不自动淘汰适合内容；公开风险规则与数据边界保留。

### 5.3 字段所有权与统一投影

| 文件 | 所有权和用途 |
|---|---|
| `task.json` | 真实任务状态、原任务列表、项目校准、既有进度/预算契约 |
| `creators.raw.json` / 供应商原始响应 | 采集证据，不写 Agent 或人工结论 |
| `agent-review.json` | 新 Agent 评审正本及冻结审核轮次；迁移旧 Agent 字段时也落这里 |
| `manual-feedback.csv` | 人工填写正本，报告生成不得覆盖 |
| `creators.json`、CSV、XLSX、HTML | 上述输入生成的投影/交付物，不反向冒充正本 |
| `memory/` | 既有联系/屏蔽/推荐状态；不接管人工拒绝记录 |

`agent-review.json` 结构版本为 1：`version`、`updated_at`、`reviews`、`rounds`。

- `reviews` 用规范化 `platform:handle` 做键；单项有 `account_keys`、上述 Agent 字段及可选 `reviewed_at`。
- `rounds` 每项保存 `round_id`、`created_at`、`source: "task.json"`、`candidates`。
- 每个 round candidate 保存 `account_key` 和 `source_tasks`；每个来源包含原 `task_index`、`keyword`、`dimension`、`platform`。来源未知用 `null`，不能臆造。
- 正本是任务级文件；跨任务汇总要额外保留来源任务身份，不能只凭一个整数 `task_index` 混在一起。
- 旧 creators 被重建前迁移 legacy fit、理由和草稿；迁移不往采集原件写结论。
- 已知正本投影存在第 9 节残留问题，需要先修；不要以这里的目标契约声称当前实现毫无缺口。

### 5.4 人工反馈与轮次

真实任务上单独生成模板：

```sh
npm run feedback-template -- --dir <真实任务目录>
```

文件已存在则拒绝覆盖；续跑新增账号需要明确补模板时：

```sh
npm run feedback-template -- --dir <真实任务目录> --append
```

表头顺序：

```csv
round_id,platform,handle,manual_eligible,manual_adopted,manual_content_fit,manual_engagement,manual_comment_authenticity,manual_reject_reason,manual_note
```

- `manual_eligible`、`manual_adopted`：`yes/no/unknown`。
- `manual_content_fit`、`manual_engagement`、`manual_comment_authenticity`：`high/medium/low/unknown`。
- **空白表示未评，unknown 表示已看但无法判断**；不能互换，不能把空白补 no。
- 拒绝原因：商家号、内容不匹配、过度商业化、植入生硬、语气不符、审美不符、互动弱、账号或数据错配、其他。多个原因按现有实现用分号分隔；备注保留原意。
- 支持 Excel 常见 BOM、CRLF、引号与多行单元格。
- round 固定账号集合和来源。续跑新增进入新 round；补模板不能改变旧分母。
- 用户后来要同一账号复评，先明确轮次/任务语义，不能直接追加重复账号行伪装成当前已支持的多次纵向历史。

### 5.5 身份、冲突与副作用顺序

- 规范化平台和账号大小写；handle 去首个 `@` 和两端空白，点号/下划线有意义。
- 不按行号匹配；同名不同平台是不同身份。
- `linked_handle` 保留跨平台映射；切换主账号不丢旧平台评审。
- 一个平台已审核不代表另一个平台已审核。关联账号反馈可以参与合并行的有效展示，但必须显式给出 `effective_priority_account_key`，各平台结论分别显示。
- 同一平台 `manual_eligible=no` 且 `manual_adopted=yes` 报冲突；同一合并候选两平台出现相反 adopted yes/no 时，当前实现同样拒绝并指出两行，不静默选边。
- 重复键/行、非法值、冲突和无法匹配输入必须定位文件及具体行/字段，在交付和 memory 写入前失败。
- collect 续跑、enrich、render 共用关联和投影；不能某入口偷偷容忍坏输入或改人工结论。

### 5.6 有效展示、排序与报告

人工只覆盖**展示建议**，不改 Agent 原判断：

| 条件 | 有效展示 |
|---|---|
| `manual_adopted=yes`（且无冲突） | 优先联系 |
| `manual_adopted=no` 或 `manual_eligible=no` | 暂不采用，文案可为本次暂不采用 |
| `manual_adopted=unknown` | 待核实 |
| 相应人工字段未填 | 使用当前可用 Agent 建议 |

优先级顺序：优先联系 → 备选 → 待核实 → 暂不采用。

- CSV、HTML：有效优先级 → A/B/C → 原分数降序。
- XLSX：保留且仅保留 A/B/C 三张工作表（空层也保留）；表内有效优先级 → 分数。
- 旧列顺序保留，新列追加；三个格式的同一账号判断一致。
- HTML 初始所有候选可见；优先级和分层筛选取交集，不切换页面滚动位置，平台标签保留视觉区别。
- Agent 与人工并列，展示证据、植入与风险、未评/待重评，不让一个 fit_reason 包办一切。
- 报告按固定轮次展示审核覆盖、主要拒绝原因、双方分歧。
- 合格率 = eligible yes / (eligible yes + eligible no)。
- 采用率 = adopted yes / (adopted yes + adopted no)。
- 两字段分母各自算；unknown 与未评分别计数；分母为零显示不可计算。
- 关键词统计用来源任务 + 原 task_index。相同词/平台的不同任务不合并，一人多来源分别计入，各平台审核不串用；供应商返回条数、入围人数、人工审核人数分列。来源未知不能补造。

重新导出前复核 memory 主账号和关联账号的 contacted/blocked 状态；人工 yes 不能恢复这些账号。重复生成保留同任务既有推荐豁免。显式忽略 memory 仍需既有用户授权与交付声明。离线诊断不写推荐 memory，也不对合并验证目录直接跑可能写 memory 的常规 render。

## 6. Adiaro 下一轮搜索策略

保留品类词、场景词、竞品词、人群词四维框架，不平均分配配额。

优先小样：

- journaling routine
- self reflection routine
- journal with me
- night reset routine
- self care journaling

少量测试：bracelet stack、everyday jewelry styling。

暂停 mindful lifestyle、meaningful jewelry；emotional wellness 用具体行为词试探。扩大哪个方向看小样作品证据和真实人工采用，不能只看供应商返回量。

这只是下一轮方案；当前没有授权为验证新增付费搜索。需要真实新采集时依现有预算/小样确认流程，不把本 prompt 当费用授权。

## 7. 业务证据、已有离线评估与局限

### 7.1 附件与本地证据是否可用

原附件：

- `/Users/yucheng/Downloads/ADIARO_Instagram_KOL_Candidate_List.docx`
- `/Users/yucheng/Downloads/ADIARO_KOL_Skill_Improvement_Plan.docx`

附件是业务参考，本任务明确范围优先。不要执行附件超出本次范围的建议。

**Git 分支不包含 `output/`、`.check-cache/`、`memory/`、`.env` 或 Downloads 附件。** 另一个工具在同一机器可能能读它们；新机器 clone 只有代码文档。资料不在时直说缺哪些，先完成不依赖它们的技术工作；不能假装读过路径。

为了跨机器复现，可请用户另行提供下列最小材料。按要做的工作索取，不要一开始要求整个磁盘或全部 memory：

| 材料 | 用途 |
|---|---|
| `output/adiaro-screening-validation-20260925/` | 校准、57 人索引、盲输入、新旧判断、对照与 manifest |
| `output/independent-manual-calibration-20260926/` | 外部独立截图、忠实转录、同名证据审计与 manifest |
| `output/adiaro-shortlist-20260925/manifest.json`、`creators.json`、`meta.json` | 合并 50 人来源与原交付判断核对 |
| 两个真实 Adiaro 任务目录（下一节列出）中 manifest 引用的任务/创作者/原始采集文件 | 追溯原任务及关键词，不凭合并行猜来源 |
| `pool.json` 和 evidence manifest 实际引用的 `output/adiaro-discovery/sample-*` 文件 | 附件独有候选的保存作品证据与产品依据 |
| 两份原 DOCX | 核对初筛观察与品牌偏好来源 |
| 外部使用者补充的完整复评表、旧报告、同批内容证据、产品/品牌输入 | 独立队列的可比较业务评估 |

不要复制 `.env` 或 API key；不要为了给另一个 AI 看而强行把原始业务资料提交到 Git。按 manifest 保持相对路径，迁移后核对哈希；symlink 在不同机器可能失效，使用其指向的正本文件。

### 7.2 Adiaro 57 人池的来历

`output/adiaro-shortlist-20260925/` 是**合并交付目录**，不是原生采集任务。不能伪造 `task.json`、费用账或来源来让它通过入口。

原 50 人：TikTok 37、Instagram 13；A 19、B 31、C 0；原 Agent fit ✅26、⚠️24。它们都不是人工答案。

与附件 10 人按规范化平台账号去重后为 57：50 人独有 47，重合 3，附件独有 7。

重合 3 个：`instagram:marissafindsahobby`、`instagram:gionnnnna`、`instagram:dontwasteyourlifeaway`。`tiktok:journalbymoon` 的 Instagram 关联身份保留。

通过合并 manifest 追溯到真实任务：

| 真实任务目录 | 原 task_index 与关键词 |
|---|---|
| `output/adiaro-emotional-jewelry-202609251301/` | 0 journaling routine / TikTok；1 mindful journaling / TikTok；2 journaling / Instagram；3 selfcare / Instagram；4 braceletstack / Instagram；5 lokai bracelet / TikTok |
| `output/adiaro-emotional-jewelry-202609251307/` | 0 mood journaling / TikTok；1 journal prompts / TikTok；2 emotional wellness / TikTok；3 mindfuljournaling / Instagram；4 journalprompts / Instagram；5 emotionalwellness / Instagram |

合并 meta 把任务排为 0–11，但 creators 的 source_tasks 仍是各任务原 0–5。必须按来源目录 + 原 index 归因，不能把第二批 0 当第一批 0。

附件独有 7 人中，stationeryous、bella_grace016、plumeria.cloud 在第一批原任务的 index 2 有原件；rebecaddz、kayse.lyn、ab.journaling.aus 在另存 discovery 样本有作品；stephsbougiefinds2.0 只有附件观察，没找到供应商响应。后四者不能凭空归到 50 人两任务。

产品依据是 `output/adiaro-discovery/sample-lInRuK/analysis/product-basis.md` 中 2026-09-23 官网记录。手机轻触手链、信息/心情记录等是页面宣称的核对，未实测功能，不支持医疗功效承诺。

### 7.3 已完成的 57 人离线诊断

目录 `output/adiaro-screening-validation-20260925/`：

- `pool.json` / `pool.csv`：逐人来源、证据、旧判断索引，**不能给盲评者读**。
- `blind-input.json`：去掉旧判断、分数、层级、附件排序/建议与人工答案的 57 人同证据输入。
- 输入 SHA256：`19da730b4ecbdfc2979ab20ac21fcf7d777c8a60a5469e3c685b9cf383b3c3a7`。
- `old-evaluation.json/.md`、`new-evaluation.json/.md`：逐人新旧诊断。
- `comparison.json/.md`、`evidence-report.md`、`evidence-manifest.json`：对照、范围与溯源。

两份评估账号集合、顺序均为相同 57；56 人的证据引用了输入中存在的保存作品 ID，1 人只有附件观察。两份 JSON 现记录相同输入哈希；新版哈希在评估后补记，补记未改逐人判断。

旧版模拟判断：✅28、⚠️29。

新版：eligibility 合格33、待核实24；adoption_priority 优先联系18、备选20、待核实10、暂不采用9。

**这些不是业务改善指标。** 旧 ✅ 不是旧 A，也不是人工采用；28→18 不能叫误推减少。9 个暂不采用仍是资格待核，不能理解成缺数据所以不合格。

旧版评估上下文此前读过改进计划和旧交付部分汇总/样例，存在上下文污染；不能称严格盲评。新版声明未读取旧结论、分数、层级和人工答案。现存结果保留为离线诊断，不要覆盖历史文件把它伪装成后来更严格的实验。

这批主要是搜索命中作品，未看画面、评论或受众地域，不是完整近期主页评估。57 人没有对应真实人工采用结论，所以强推荐误推率与优先推荐中的人工采用人数尚不可计算。

### 7.4 另一使用者的 18 人截图

正本在 `output/independent-manual-calibration-20260926/`：

- `source-screenshot.png`
- `visible-transcription.json`
- `local-evidence-audit.md`
- `README.md`
- `manifest.json`

旧 Adiaro 验证目录中的相关截图/转录路径仅为兼容旧链接的 symlink。用户聊天里原图在临时 clipboard 路径，不能作为长期唯一存档。

可见行 2–19，共18人：eligible yes8/no8/空白2；adopted yes4/no11/空白3；无可见 unknown。按明确 yes/no 口径，该局部截图可见行的合格率8/16=50%，采用率4/15≈26.7%。

截图底部 0.4、0.2 的公式、隐藏行、完整范围未知，不能据此确认“约20%”基线。第15行账号被截断；平台、账号链接、旧报告身份、审核日期/范围未显示。G列原备注保持原文，不自动映射成拒绝原因；空白采用不能补否。看起来矛盾的原人工单元格也不能擅自修正。

截图可定性观察“内容适合与公开互动需要分开”，但不能归纳成 Adiaro 专用偏好，也不能据此调硬权重。本地只有两处同名命中且无法确认原任务，不能把那些证据借来冒充该使用者当时看到的内容。

还缺：完整复评表及平台/链接、该队列对应旧报告、当时作品/主页证据、原产品与品牌输入、候选范围/日期。**不要求它与57人重合，不合并分母。**

## 8. 后续业务评估怎么做，防止资料补齐后返工

1. 先确定队列身份：Adiaro57、外部18完整池、未来新轮次各自独立。为每轮冻结候选、证据、品牌校准、规则版本与来源/哈希。
2. 用规范化平台账号核对原表；截断账号或平台未知时标待映射，不根据相似 handle 自动写反馈。保留原表与转换依据，冲突逐行指出。
3. 取得旧版实际报告时保留实际推荐；只有旧规则重跑时明确叫“模拟旧版”，不冒充历史实际交付。
4. **先冻结强推荐定义**：例如旧实际 A 与新版 Agent 优先联系；写明可比性。不要看完人工结果再挑一个使数字变好的定义。
5. 组织两个全新独立评估上下文，分别只给相同证据、对应冻结规则和适用品牌/产品输入。不给人工答案、对方结果、pool旧标签、当前对照报告、含标签的本 prompt、改进计划中的账号建议。
6. 新版和旧版评估完成且封存后，分析上下文才读取人工表进行对照。不能把 manual_adopted 的展示覆盖结果当作 Agent 准确率。
7. 分别报告推荐数、人工审核覆盖、eligible与adopted明确分母、未知/未评数量、推荐中的人工不采用数和采用数。
8. 以已明确 adopted yes/no 的强推荐账号计算采用误推比例；合格性错误另列，不把两种分母混成一个。若使用别的误推定义，先明确且两版一致。
9. 同池同证据下比较：强推荐误推率应下降；被优先推荐的人工采用人数不能减少。未评/unknown 不计作否，分母零显示不可计算。采用答案缺失时不能宣称满足目标。
10. 对校准使用过的账号与独立验证账号标明重合/分开。若用某队列调过规则或品牌偏好，它就不是未见过的独立效果证据。
11. 新作品、新人工答案或新校准版本到来时新增有版本的记录/评估，不篡改旧评估的输入和结果。未改变证据与规则的既有57人诊断无需为“出现另一个队列”重做。
12. 不必等待这些资料才修代码、补正确测试、整合主干或完善通用契约；资料不足只限制相应业务结论。

预期影响面：新表格式可能需要导入/映射；新品牌偏好更新校准和相关评审；新作品补齐证据并重评受影响账号；新真实结果揭示通用 bug 才改代码。正确的 Agent/人工分离、平台身份和冻结轮次应保留。没有依据为了一个用户截图推倒重写通用架构。

## 9. 已知待修：正本删字段后旧理由/草稿残留

这是保存快照前独立只读复核新发现的确定问题，尚未修复，推工作分支不代表忽略它。

- 位置：`scripts/lib/review.ts` 的 `prepareReviewProjection`，大约 560–590 行（以函数为准）。
- 条件：creators.json 已含上一轮投影的 fit_reason / outreach_draft；agent-review.json 仍有该账号 review，但从该 review 删除其中一个属性。
- 当前行为：清理投影字段列表没有清理这两项，后续只复制正本存在属性，导致旧理由/草稿仍留在导出 creators 中。
- `c.fit` 有单独覆盖，这个复现不是 fit 残留；整条 review 删除的路径与仅删除某属性的路径也不能混为一谈。
- 复核者用纯内存文件适配复现：正本不含两项，投影仍有 old projected reason / old projected draft。没有改运行原件、没有付费请求。
- 正确目标：正本存在且删掉某字段后，下一次投影不能继续使用旧派生值；但首次从真正旧任务迁移字段仍须保留。
- 继续时先按需求/所有权写独立可失败断言，确认红，再最小修补并验证绿；覆盖删理由、删草稿、整条删除、旧任务首次迁移和重复生成。不要顺手重构全模块。
- 后续须跑相关变异和完整检查，再独立复核。先前全绿不足以覆盖这个新发现。

## 10. 已做技术验证与证据边界

保存此快照前，在当前业务实现与测试上已运行完整 `MUTATE_JOBS=8 npm run check`，退出0，**739/739 变异被杀死**。需求测试、类型检查、自检、SPEC/ADR检查和链路审计跑过。之后新增的本接手文件属于文档；不要把提交前体量结果算作提交后的检查。

已覆盖的技术场景包括：

- blank、unknown、明确否定分开；两个比例各自明确 yes/no 分母；零分母不可计算。
- legacy Agent迁移，续跑/补指标/重复导出保存评审，冻结旧pool，新账号新round。
- CSV非法值/重复/冲突/无法匹配在写输出与memory之前拒绝，Excel引号/BOM/换行。
- 规范化平台大小写和账号键，主账号切换，关联账号独立结论，来源任务不串台。
- 原 task_index 和重复关键词身份，供应商条目与人工人数分开。
- contacted/blocked优先于人工采用；同任务重复导出豁免。
- 缺语义判断不进A；校准版本变化待重评。
- 真正生成并检查CSV、XLSX、HTML的判断与排序；人工yes/no使顺序改变。
- HTML脚本双筛选取交集、卡片初始可见、平台样式、每人作品/植入/风险及人工Agent并列。

独立复核发现的平台大小写问题已做红绿验证并修复；相应 `M-D22-h` 以及分母/HTML的 `M-U11-d`、`M-U10-a`、`M-U10-b` 已进入变异清单并被杀死。

仍要诚实说明：

- 全绿不表示无bug，第9节就是后来发现且尚未覆盖的问题。
- 保存时重新运行 `npm run audit` 退出0，报告30组非阻断缺口，包括D20.a/b、F11.c/d等未全部机器认领；不要写“所有业务语义已自动证明”。审计数字会随后续改动变化，重新读取当前结果。
- 测试入口“覆盖43个需求”与审计“41/52活跃需求”等统计口径不同，不混用成一个完成率。
- P2的事实判断仍不能完全机器验证，ADR-04记载的同源测试局限仍存在。
- 原739结果主要可在旧会话工具执行记录中追溯；被忽略的检查缓存不随Git迁移。新环境需要新验证时重新跑并保存实际结果，不能假造历史日志。
- 没有新增付费API请求；离线业务诊断没有写推荐memory；没有证明真实采用率、误推率或回复率改善。

## 11. 接手后的执行顺序与检查

请直接推进已授权可做的工作，不要把“是否可以继续”再次交还用户。

1. 核对Git状态、远端和可用本地证据；阅读规定文档，理解当前差异及第9节。
2. 先修正本删字段残留，用独立测试与最小修补证明。
3. 独立复核任务级正本、跨平台映射、坏输入副作用顺序和统计口径；把确定问题与可选扩展分开。
4. 要整合最新main时，先看20个及后续提交的实际差异。保护本快照和用户未提交改动；遵守评审分支只追加不改写。若需按证据切成较小合并单元，按仓库约定做，不把保存快照当自动合并许可。
5. 新人工作表或内容到位后按第8节独立队列评估；未到位仍完成技术工作并列清缺口。
6. 依 `docs/SYNC.md` 同步真正改变的需求、架构、Skill和输出说明；不要为了重复本文而再复制一套规则。
7. 改了行为或合并了代码后跑针对性测试、关键变异、完整检查及独立复核。检查通过且无新改动/新失败时停止无目的重跑。

环境以仓库Node约定为准（快照CI用22.22.2）。已安装依赖可直接用；新环境按lockfile安装。常用命令：

```sh
npm run spec
npm run adr
npm run typecheck
npm test
npm run mutate -- --brief
npm run selfcheck
npm run audit
npm run check
git diff --check
```

需要只跑一个测试/变异组时先读当前入口支持参数，不猜参数；独立测试编写者只看允许的契约与 `mutate -- --brief` 描述，不看变异实现原文。并行变异可用环境变量 `MUTATE_JOBS`，按机器资源选；不要同时另起改同一源码的变异任务。

提交前检查待暂存清单、密钥和原始数据；提交后再跑 `npm run size`，该命令只数已提交分支相对主干的内容。快照体量大，保存时的具名豁免只解释这次完整留存，不说明适合作为单一巨大PR合并。

当前工作流只在main推送和pull_request触发，**只推工作分支不会自动触发CI**。要报告本地验证与远端CI各自实际状态，不能相互代替。

本 prompt 不授权发送开发信、联系创作者、购买API额度、更新全局memory或直接合并main。遇到确实需要新授权的动作先完成可审阅的准备工作，说明缺什么；不要把资料缺失扩大成整个任务不能推进。

## 12. 最终向用户交代什么

- 实际改了哪些通用功能，哪些只属于Adiaro项目输入。
- 正本与投影、人工反馈、排序、统计和memory约束的验证结果；已知问题修好还是仍未解决。
- 检查命令及真实结果，独立复核发现和去向；不要只说“应该能用”。
- 代码分支/提交、可读说明与本地证据路径；明确哪些文件没有随Git迁移。
- 57人离线诊断能说明什么；外部人工队列能说明什么；哪些指标仍不可计算及具体缺什么。
- 新资料到来需要追加哪些映射、校准或评估，是否出现有证据支持的代码改动；不要笼统要求推倒重来。
- 后续3–5轮人工审核的收集建议，但本次不擅自改权重或长期memory。

开始时先简短说明你读到的实际状态，然后执行。除非发现真正阻断信息，不要只复述计划就停止。
