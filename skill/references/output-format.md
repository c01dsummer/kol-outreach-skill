# 输出格式

> 相关需求：**U2** HTML 单文件不依赖网络 · **U3** 关键词表现 · **U4** A 级附草稿 · **U5** xlsx 分 sheet · **U7** 公开指标与报价 · **U8** 任务展示身份 · **U9–U11** 优先级、筛选与反馈报告 · **D5** BOM 与转义 · **D8–D10** 指标口径 · **P5** 数据边界声明

Phase 06 用。

导出前，render 要求 `task.json` 是可读取的 JSON 对象，且 `tasks` 是非空列表，每项满足既有 keyword、dimension、platform 规则（D16）。读取失败或列表不合规时退出 2，stderr 指出文件路径、实际读取问题或全部任务问题，不带内部异常类名与堆栈；拒绝先于文件和跨任务记忆写入，旧文件不变，原本不存在的文件不创建。按原搜索配置修正，不以空列表或推测任务代替缺失记录。此检查不要求 API key 或可付费费用账。

## 文件

```
output/{product}-{YYYYMMDDHHmm}/
├── kol.csv        单表名单 —— 给脚本和其他工具读
├── kol.xlsx       分层名单 —— 给人看，按分层分 sheet
├── report.html    可读报告
├── creators.json  交付物 —— 过滤后的名单投影，不作评审正本
├── creators.raw.json  采集累加器 —— 只增不减，--resume 读它
├── agent-review.json    Agent 评审正本：判断、证据、草稿、校准版本、审核轮次
├── manual-feedback.csv  人工反馈；工具只创建模板，报告重生成不覆盖填写内容
├── enrichment.json    分平台公开样本、指标、报价与查询状态（运行 enrich 后）
├── task.json      采集状态（断点续跑用）
└── meta.json      本次任务元数据
```

**为什么 CSV 和 xlsx 都要**：CSV 规范里没有「工作表」这个概念，多 sheet 只能走 xlsx。
但 CSV 是通用交换格式，脚本、导入工具、其他系统都读它。**两个文件各司其职，不能只留一个** ——
只留 xlsx 会让机器消费变麻烦，只留 CSV 就没法分层切换。

`{product}` 用短横线小写，如 `anker-powerbank`。

## CSV

**UTF-8 with BOM** —— 没有 BOM 的话 Excel/Numbers 打开中文会乱码。这是实测踩过的坑。

| 列 | 说明 |
|---|---|
| `tier` | A / B / C |
| `score` | 硬指标得分 |
| `fit` | ✅ / ⚠️ / ❌ |
| `fit_reason` | ★ 语义判断理由，一句话 |
| `platform` | tiktok / instagram |
| `handle` | |
| `nickname` | |
| `followers` | 跨平台合并后为两平台之和 |
| `post_count` | |
| `bio` | |
| `email` | |
| `email_verified` | 有增强层时填，否则留空 |
| `audience_geo_top` | 如 `US 62%`，无增强层留空 |
| `metrics_account_followers` / `metrics_account_following` | 当前平台计算公开指标时使用的账号规模；不使用跨平台合计值 |
| `engagement_rate_followers` | 主页近期作品的粉丝互动率；Instagram 新样本用窗口内全部返回作品；未查询/不可用显式显示 |
| `engagement_rate_views` | 播放互动率 |
| `median_views` | 中位播放量 |
| `median_engagements` | 中位互动量；Instagram 新样本用全部返回作品，Reels 隐含 eCPE 另用确认视频的互动分母 |
| `view_rate` | 播粉比 |
| `following_ratio` | 关注/粉丝比 |
| `reach_consistency` | `P25(views) / median(views)` |
| `median_post_gap_days` | 发帖间隔中位天数 |
| `latest_post_at` | 截至采样时的最后发布时间；包含置顶作品 |
| `days_since_last_post` | 最后发布距采样时间的天数 |
| `activity_status` | active / cooling / dormant；只提示，不影响分层 |
| `audience_quality_risk` | low / medium / high；不是假粉率 |
| `audience_quality_reasons` | 触发的同行异常信号与同行数 |
| `tier_adjustments` | 地域/风险导致的分层变化及理由 |
| `collaboration_quote` | 人工录入的明确报价与交付口径；不自动估价 |
| `implied_ecpm` / `implied_ecpe` | 报价与近期中位表现形成的隐含效率 |
| `metrics_observed_at` | 公开样本采集时间 |
| `cross_platform` | true / false |
| `linked_handle` | 跨平台同人的另一个 handle |
| `profile_url` | |
| `source_keyword` | |
| `source_dimension` | category / scene / competitor / audience |
| `best_post_desc` | 搜索命中的作品里播放最高那条的文案。`未查询` = 没问过他的作品（IG 按账号名搜到的人）；空白 = 所选作品的文案值为空，可能是作者未写，也可能是来源字段未取到，当前无法区分 |
| `outreach_draft` | ★ 仅 A 级填写 |
| `previously_recommended` | 曾推荐过则填「{product} @ {date}」 |
| `discovery_sources` | 已观察发现来源，每项为「路线 · 平台:@账号 · 关键词 · 维度」，以 `；` 分隔；缺席或空数组显示「来源未知」 |
| `metrics_sample_scope` | 既有列的末列；Instagram 公开指标的主页样本范围：本次端点返回前最多 12 条／旧版仅视频窗口／旧范围未知。未查询保持未查询；不能把后两者显示为未标记的新窗口数字 |

**既有列保持原顺序，新增列一律追加在 `metrics_sample_scope` 后。** 新列并列展示 Agent 与人工：`eligibility`、`adoption_priority`、`review_status`、`observed_content`、`work_evidence`、`natural_integration`、`mismatch_risk`、`brand_calibration_version`、`effective_priority`、`effective_priority_account_key`、`manual_round_id`、`manual_eligible`、`manual_adopted`、`manual_content_fit`、`manual_engagement`、`manual_comment_authenticity`、`manual_reject_reason`、`manual_note`、`manual_feedback_accounts`、`linked_agent_review`。旧任务缺 Agent 字段显示 `review_status=未评`，不写成「不合格」或「暂不采用」；人工空白与显式 `unknown` 也必须分开。

`agent-review.json` 是新 Agent 判断的唯一正本，以规范化的平台账号键关联；`account_keys` 只包含同平台别名，跨平台账号映射由 `linked_handle` 保留并在交付中分别展示。采集续跑重建 `creators.json` 或补公开指标时，用同一关联和投影逻辑保留评审；覆盖旧任务前先保留原 `creators.json` 中的 Agent 字段。评审包含 `observed_content`、`work_evidence`、`natural_integration`、`mismatch_risk`、`eligibility`、`adoption_priority`、兼容的 `fit`／`fit_reason`、`outreach_draft` 与 `brand_calibration_version`。校准版本变化不擦除旧评审，显示待重评。不要把这些写进 `creators.raw.json` 或用人工结论改写它们。

实际来源也在 HTML 账号卡片展示，原始集合保留在名单 JSON 及 probe 样本中。只含已记录的账号发现来源，可能不含完整历史；不对应具体作品、请求次数或费用。路线不能由 `source_keyword`、任务标签或 `as_hashtag` 推断（D15）。

`enrichment.json` 与 `creators.json` 保留 Instagram 公开样本的 `media_scope`：
`provider_returned_first12` 表示新取的提供方返回窗口，`legacy_video_filtered_first12`
表示可核实的旧视频筛后窗口，`unknown` 表示旧范围无法确认。已测量指标仍保留来源、
样本数和 `basis`；旧范围未知的作品依赖指标不可用。旧视频窗口的可用表现和 Reels 报价
只作历史范围展示，不能解释成当前全媒体窗口；旧窗口的当前活跃不可用。

**转义**：字段含逗号、引号或换行时用双引号包裹，内部双引号写成两个。`outreach_draft` 一定有换行，务必正确转义。

排序：先按 `effective_priority`「优先联系 → 备选 → 待核实 → 暂不采用」，再按 `tier`（A→B→C），再按 `score` 降序；**同优先级、同层、同分时按粉丝数分三档 ——
「已查到且不是 0」→「未查询」→「确实是 0」**（P1.h）。「不知道」压得过确认为 0 的人，
压不过任何真查到了数的人。

有效展示优先级只作投影：`manual_adopted=yes` 为「优先联系」；`manual_adopted=no` 或 `manual_eligible=no` 时字段值为「暂不采用」（界面可写「本次暂不采用」）；`manual_adopted=unknown` 为「待核实」；人工未填则沿用 Agent 建议。`manual_eligible=no` 且 `manual_adopted=yes` 是输入冲突，须在写任何交付物前报错。人工采用不能让已联系或屏蔽账号重新进入名单；重复生成同一任务仍遵守既有豁免。

## manual-feedback.csv

工具生成独立模板供 Excel 填写，报告重生成只能读取和校验，不能覆盖已填写文件。列顺序为 `round_id,platform,handle,manual_eligible,manual_adopted,manual_content_fit,manual_engagement,manual_comment_authenticity,manual_reject_reason,manual_note`。`round_id` 指向固定的审核轮次；身份用 `platform` 与 `handle` 派生规范化平台账号键，不另设 `account_key` 列。不按行号匹配，跨平台关联账号各自有独立反馈，一个平台已评不代表另一个平台已评，主账号切换不得丢反馈。

| 字段 | 允许填写 |
|---|---|
| `manual_eligible` / `manual_adopted` | `yes`、`no`、`unknown` |
| `manual_content_fit` / `manual_engagement` / `manual_comment_authenticity` | `high`、`medium`、`low`、`unknown` |
| `manual_reject_reason` | 商家号、内容不匹配、过度商业化、植入生硬、语气不符、审美不符、互动弱、账号或数据错配、其他 |
| `manual_note` | 自由文本 |

空白表示尚未审核；`unknown` 表示审核过但没有资格下判断，不能合并统计。重复、冲突、非法值或无法匹配的账号要指出文件中的具体位置，在名单、报告及记忆写入前停止。每轮审核固定候选池和来源；续跑新增账号进新的审核轮次，不改既有轮次的分母。人工「暂不采用」留在本任务的反馈里，不写成全局 `blocked`，也不修改 `contacted`／`replied`。

## XLSX（U5）

按分层分 sheet，方便运营在 Excel/Numbers 里快速切换：

```
A 级 (15)
B 级 (30)
C 级 (3)
```

**不设「全部」sheet** —— 完整单表已经由 `kol.csv` 承担，再来一份是冗余，
还会让人在两个「全部」之间犹豫用哪个。

- 首行冻结 + 自动筛选
- **空分层也建 sheet**，名称里标出 `(0)` —— 「这一层一个人都没有」本身是信息，
  隐藏掉会让人以为漏了数据
- 列定义与 CSV 完全一致；每个 sheet 内按有效展示优先级、分数降序排序

实现在 `scripts/lib/xlsx.ts`，手写的最小 XLSX 写出器（零依赖）。

## HTML 报告

单文件，内联所有样式，不依赖网络 —— 运营要发给同事、要存档。

需要包含：

- 顶部统计：总人数、A/B/C 分布、有邮箱比例、跨平台人数；费用显示预算占用估算、总上限与分项（按固定公开基础价估算，不是实际账单），费用不可用时说明原因
- 关键词表现：**来源任务及原 `task_index` 各占一行，任务里的每一个都在表上**，包括同词同平台的不同任务、0 命中和一次都没查过的（U3.b、U8）。
  每行先列任务序号（原 task_index 加一）；缺失或非法下标显示「无从确认」，不按显示位置猜补。
  序号不是查询或命中数；as_hashtag 不渲染成实际路径声明（U8）。
  每行分别列「找到」（供应商返回的**条目数**）、「入围」（过完粉丝闸门与去重之后还在名单上的**人数**）、
  「语义通过」及「人工审核人数」。一人由多个任务发现时，各来源任务分别计入；两项审核人数都只按来源平台对应账号的判断计，不能把关联平台已评当作本平台已评。没有真实来源时不从首词、当前配置或行位置补造归因。**「找到」与「入围」不是一个数、也不相除** —— 单位不同，所以没有「命中率」这一列。
  「找到」那一格四态可分：`N` / `0`（量出来的零）/ `未查询`（从未发出过搜索请求）/
  `无从确认`（旧目录，连记录都没有）；另有 `未知` ＝问过、而那一次的条数没记下来。
  **没查过的行不带任何看起来像测量值的数**（P5.i）—— **这是下次调整策略的依据**
- **名单默认展示全部候选**，按有效展示优先级 → A/B/C → 分数排序；可独立筛选优先级与 A/B/C，切换时不滚动页面。初始可见性在渲染时确定，不依赖 JS 先跑一遍
- 名单卡片：**平台标签用平台专属配色**（TikTok 青、Instagram 橙粉渐变），
  与「双平台」「私密号」等次要标签区分开 —— 运营扫一眼就要知道这人在哪个平台，
  因为两个平台的建联方式完全不同
- A 级卡片展开显示开发信草稿并**可一键复制**
- 每张卡片并列展示 Agent 判断与人工反馈，分别标出未评、人工 `unknown`、明确否定及待重评；展示实际作品证据、自然植入、最大风险，避免一句 `fit_reason` 代替结论
- 人工覆盖情况、人工合格率、采用率、主要拒绝原因、Agent 与团队分歧账号：合格率分母仅为 `manual_eligible` 已有明确 `yes/no` 的人数；采用率分母仅为 `manual_adopted` 已有明确 `yes/no` 的人数；未评与 `unknown` 分开计，分母为零显示「不可计算」
- 主账号与关联账号分平台展示近期公开指标、样本时间、活跃标签、风险依据和报价效率；
  每个 Instagram 账号卡片分别写明其主页样本范围，新返回窗口、旧版仅视频与旧范围未知可辨
- 数据边界说明（见下）

## meta.json

下例展示业务字段；实际费用字段完整契约见 [ADR-108](../../docs/adr/ADR-108-生产请求与输出统一使用逐端点费用账.md)。费用以脚本输出为准，不按请求数重算。`cost_estimate_usd` 是预算占用，含保守留存和 pending；四态 `cost_status` 与 `cost_problems` 决定金额是否可用，未知不显示零或百分比。根预算冲突整体不可用；HTML 同样说明原因，render 不修复任务费用。

费用检查点失败以 stderr 和退出码 1 报错，可能没有本轮结果 JSON；不能拿上一次产物当本轮成功。持久 pending 不代表已发请求或已扣款，恢复时按脚本拒绝原因处理（ADR-109）。

```json
{
  "product": "anker-powerbank",
  "timestamp": "202608251430",
  "market": "US",
  "platforms": ["tiktok", "instagram"],
  "keywords": [
    { "task_index": 0, "keyword": "anker power bank", "dimension": "competitor", "platform": "tiktok",
      "status": "queried", "found": 42, "shortlisted": 12, "fit_pass": 9 },
    { "task_index": 1, "keyword": "portable charger", "dimension": "category", "platform": "instagram",
      "status": "unqueried", "found": null, "shortlisted": null, "fit_pass": null }
  ],
  "total": 187,
  "tiers": { "A": 23, "B": 61, "C": 103 },
  "email_count": 86,
  "cross_platform_count": 14,
  "requests": 412,
  "enriched": false,
  "memory_status": "ok",
  "memory_written": true,
  "capabilities": {
    "email_verification": { "total": 187, "measured": 0, "unavailable": 0, "unqueried": 187 },
    "audience_geo": { "total": 187, "measured": 0, "unavailable": 0, "unqueried": 187 },
    "public_post_sample": { "total": 201, "measured": 170, "unavailable": 4, "unqueried": 27 },
    "audience_quality_risk": { "total": 201, "measured": 145, "unavailable": 29, "unqueried": 27 },
    "creator_activity": { "total": 201, "measured": 168, "unavailable": 6, "unqueried": 27 },
    "collaboration_quote": { "total": 201, "measured": 8, "unavailable": 0, "unqueried": 193 }
  }
}
```

`keywords[].fit_pass` 记的是语义判断通过数 —— 跨任务累积后能看出哪些维度对这个品类真正有效。

`enriched` 是兼容旧消费者的字段，只代表外部邮箱/受众增强；运行公开指标后仍为 false。
新代码应读取 `capabilities`，不要再用一个布尔推断所有数据能力。

`memory_status` 与 `memory_written` 是记忆的两个状态，**坏掉的后果不同，不要合起来报**：

| 字段 | 值 | 意味着 |
|---|---|---|
| `memory_status` | `ok` / `absent` | 这一批做过「已联系 / 已推荐」去重 |
| | `unreadable_ignored` | **没做去重** —— 名单里可能有他联系过甚至拉黑的人 |
| | `unknown` | **不知道有没有去重** —— 说不知道，别说没问题，也别替它编原因（两个来源事后分不出）；重跑一次采集就有确定答案 |
| `memory_written` | `true` | 这一批已记入记忆 |
| | `false` | **没记进去** —— 下一批可能重复推荐这批人（原文件未被改动）。真实原因在 `memory_write_error` |
| `memory_write_error` | 只在没记进去时出现 | 原因原文。**有两类，别替用户猜**：读不出来要去修 JSON，写不进去（权限、磁盘满）要去看环境 |

两条都会同时出现在 HTML 报告的数据边界里。见 `references/memory.md` 与 ADR-15。

## 收尾输出

交付时给一段话，不要只丢文件路径：

```
找到 187 人，A 级 23 个（有邮箱且内容强相关），已附英文开发信草稿。
过滤掉 23 个此前推荐过的。

关键词表现：竞品词「anker power bank」最好（返回 42 条、入围 12 人、其中 9 人语义通过），
品类词「power bank review」商家号偏多（返回 40 条只入围 3 人），下次可以少用。
Instagram 的「portable charger」这次一次都没查到 —— 预算停在了它前面，不是这个方向没人。

预算占用估算与总上限按本次输出填写，并单独说明保守留存或未结金额。
历史费用无法确认时直接说明原因；固定公开基础价估算不是实际账单，也不是未来价格保证。

⚠️ 邮箱来自 bio 提取，未做有效性验证，建议首轮小批量试发观察退信率。
⚠️ 未配置增强层，无法确认这批人的粉丝是否在美国市场。
⚠️ 受众质量风险只依据近期公开互动异常，不是假粉率，也不能代表实际带货效果。
```

**数据边界必须说。** 让用户知道名单的局限在哪，比让他以为数据很完整强 —— 后者会导致他把预算压在错误的假设上。

`memory_status` 不是 `ok` / `absent` 时，**这句要排在最前面**，
而且不能说成「0 人此前推荐过已过滤」——那个 0 和「确实没人需要过滤」长得一模一样。

**两种状态两句话，不要合并。** 它们的确定程度不同：

`unreadable_ignored` —— 知道没去重，也知道为什么：

```
⚠️ 这一批没有做「已联系」去重（记忆文件读不出来，你让我跳过了）——
   名单里可能有你联系过、甚至已经拉黑的人，发信前请自己核对。
```

`unknown` —— **不知道有没有去重，也不知道为什么**：

```
⚠️ 这一批有没有做过「已联系」去重，我确认不了 ——
   名单里可能有你联系过的人。重跑一次采集就有确定答案。
```

套用上面那句去说 `unknown`，等于替它编了一个诊断（「读不出来、你让我跳过了」），
而 `unknown` 有两个来源、事后分不出是哪一个。措辞的规矩在
[`memory.md`](memory.md) 里，**以那份为准** —— 这里只是把它排进输出顺序。
