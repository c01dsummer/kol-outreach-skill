# 输出格式

> 相关需求：**U1** CSV 排序与列定义 · **U2** HTML 单文件不依赖网络 · **U3** 关键词表现 · **U4** A 级附草稿 · **U5** xlsx 分 sheet · **U6** HTML 分层 tab 与平台标签 · **U7** 公开指标与报价 · **D5** BOM 与转义 · **D8–D10** 指标口径 · **P5** 数据边界声明

Phase 06 用。

## 文件

```
output/{product}-{YYYYMMDDHHmm}/
├── kol.csv        单表名单 —— 给脚本和其他工具读
├── kol.xlsx       分层名单 —— 给人看，按分层分 sheet
├── report.html    可读报告
├── creators.json  交付物 —— 过滤后的名单（Agent 在 Phase 04 回写判断的地方）
├── creators.raw.json  采集累加器 —— 只增不减，--resume 读它
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
| `engagement_rate_followers` | 主页近期作品的粉丝互动率；未查询/不可用显式显示 |
| `engagement_rate_views` | 播放互动率 |
| `median_views` | 中位播放量 |
| `median_engagements` | 中位互动量；隐含 eCPE 的分母 |
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
| `best_post_desc` | 最能代表其内容方向的一条 |
| `outreach_draft` | ★ 仅 A 级填写 |
| `previously_recommended` | 曾推荐过则填「{product} @ {date}」 |

**转义**：字段含逗号、引号或换行时用双引号包裹，内部双引号写成两个。`outreach_draft` 一定有换行，务必正确转义。

排序：先按 `tier`（A→B→C），同层按 `score` 降序。

## XLSX（U5）

按分层分 sheet，方便运营在 Excel/Numbers 里快速切换：

```
A级 直接发信 (15)
B级 先互动 (30)
C级 观察池 (3)
```

**不设「全部」sheet** —— 完整单表已经由 `kol.csv` 承担，再来一份是冗余，
还会让人在两个「全部」之间犹豫用哪个。

- 首行冻结 + 自动筛选
- **空分层也建 sheet**，名称里标出 `(0)` —— 「这一层一个人都没有」本身是信息，
  隐藏掉会让人以为漏了数据
- 列定义与 CSV 完全一致

实现在 `scripts/lib/xlsx.ts`，手写的最小 XLSX 写出器（零依赖）。

## HTML 报告

单文件，内联所有样式，不依赖网络 —— 运营要发给同事、要存档。

需要包含：

- 顶部统计：总人数、A/B/C 分布、有邮箱比例、跨平台人数、实际花费
- 关键词表现：每个词找到多少人、语义命中率多少 —— **这是下次调整策略的依据**
- **分层 tab**（U6）：A级 / B级 / C级，点击只显示对应分层。
  **默认选中第一个非空分层** —— 落在空分层上，打开第一眼是空白会被当成出错。
  初始可见性在渲染时就定好，不依赖 JS 先跑一遍。
  **切换不滚动页面** —— 运营常是横向对比几个分层，滚动会让他丢失阅读位置
- 名单卡片：**平台标签用平台专属配色**（TikTok 青、Instagram 橙粉渐变），
  与「双平台」「私密号」等次要标签区分开 —— 运营扫一眼就要知道这人在哪个平台，
  因为两个平台的建联方式完全不同
- A 级卡片展开显示开发信草稿并**可一键复制**
- 主账号与关联账号分平台展示近期公开指标、样本时间、活跃标签、风险依据和报价效率
- 数据边界说明（见下）

## meta.json

```json
{
  "product": "anker-powerbank",
  "timestamp": "202608251430",
  "market": "US",
  "platforms": ["tiktok", "instagram"],
  "keywords": [
    { "keyword": "anker power bank", "dimension": "competitor",
      "platform": "tiktok", "found": 42, "fit_pass": 28 }
  ],
  "total": 187,
  "tiers": { "A": 23, "B": 61, "C": 103 },
  "email_count": 86,
  "cross_platform_count": 14,
  "requests": 412,
  "cost_estimate_usd": 0.412,
  "budget_usd": 2.0,
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
| | `unknown` | **不知道有没有去重**（早期版本采集的任务目录）—— 说不知道，别说没问题；重跑一次采集就有确定答案 |
| `memory_written` | `true` | 这一批已记入记忆 |
| | `false` | **没记进去** —— 下一批可能重复推荐这批人（原文件未被改动）。真实原因在 `memory_write_error` |
| `memory_write_error` | 只在没记进去时出现 | 原因原文。**有两类，别替用户猜**：读不出来要去修 JSON，写不进去（权限、磁盘满）要去看环境 |

两条都会同时出现在 HTML 报告的数据边界里。见 `references/memory.md` 与 ADR-15。

## 收尾输出

交付时给一段话，不要只丢文件路径：

```
找到 187 人，A 级 23 个（有邮箱且内容强相关），已附英文开发信草稿。
过滤掉 23 个此前推荐过的。

关键词表现：竞品词「anker power bank」最好（42 人中 28 人通过语义筛选），
品类词「power bank review」商家号偏多（40 人只通过 9 个），下次可以少用。

花费 $0.41 / 预算 $2.00。这是按 $0.001/请求 的上限估算，实际有阶梯折扣会更低。

⚠️ 邮箱来自 bio 提取，未做有效性验证，建议首轮小批量试发观察退信率。
⚠️ 未配置增强层，无法确认这批人的粉丝是否在美国市场。
⚠️ 受众质量风险只依据近期公开互动异常，不是假粉率，也不能代表实际带货效果。
```

**数据边界必须说。** 让用户知道名单的局限在哪，比让他以为数据很完整强 —— 后者会导致他把预算压在错误的假设上。

`memory_status` 为 `unreadable_ignored` 或 `unknown` 时，**这句要排在最前面**，
而且不能说成「0 人此前推荐过已过滤」——那个 0 和「确实没人需要过滤」长得一模一样：

```
⚠️ 这一批没有做「已联系」去重（记忆文件读不出来，你让我跳过了）——
   名单里可能有你联系过、甚至已经拉黑的人，发信前请自己核对。
```
