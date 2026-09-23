# 数据源策略

> 供应商比较的历史调研时间：2026-08-26 · 该比较数字来自各家官方页面，未独立验证。
> 后续固定规范核对、真实调用记录与用户样本另标日期和证据范围。
> 业务侧结论见 `docs/business-requirements.md` §9

---

## 决策约束

这个 Skill 要**发布给别人 clone**，因此有一条压倒性约束：

> 别人拿到 repo，注册一个账号、填一个 key，就必须能跑出完整结果。

任何"发邮件申请评估 key、等 1–2 周审批"的数据源，无论数据多好，都不可用 —— 使用者会卡在第一步。

三条派生要求：

1. **即时自助注册** — 注册完当场拿到 key
2. **同步返回** — Agent 是对话式的，用户在等；异步任务轮询会让体验断裂
3. **按次计费、无月费门槛** — Agent 会试错、重搜、分页发散，按次计费较月费门槛适合此流程；具体端点单价须单独核对，不能用历史统一估算代替。

---

## 候选评估

### 采集型（现抓）

| | Bright Data | TikHub |
|---|---|---|
| 模式 | 提交 URL/条件 → 实时抓取 | 平台接口透传 |
| 数据新鲜度 | 每次请求触发实时抓取，无缓存 | 普通 API 请求与缓存结果直链是两种访问；固定规范声明缓存直链有效 24 小时且访问不另收费，见下文 |
| 同步支持 | `/scrape` ≤20 URL，10–30 秒 | 秒级 |
| **发现能力** | 支持关键词/hashtag/搜索页发现，**但仅限异步 `/trigger`** | 同步搜索，多种入口 |
| 平台覆盖 | 1,547 个现成 scraper，800+ 网站实时 | 16 个平台、1000+ 接口 |
| 中文平台 | 基本没有 | 抖音/小红书/快手/微博/B站/知乎 |
| 计费 | **$1.5 / 1K records**（Scale $499/月档 $1.3/1K） | 历史调研按 $0.001/请求；固定规范的三路 IG V2 发现端点各声明 $0.002/请求，不能沿用统一价，见下文 |
| 免费额度 | 5,000 records/月 | 历史注册赠送约 50 次请求；是否接受按具体端点声明，见下文 |
| 数据形态 | 规整化、字段名稳定，可投递 S3/Snowflake/GCS | 原始响应透传，schema 随端点变化 |
| 合规 | SOC 2 Type II、ISO 27001、CSA STAR L1、GDPR/CCPA、PwC 审计、Trust Center | 未见公开 SLA 或合规认证 |

### 数据库型（预建库）

| | CreatorDB | Modash | influencers.club | Phyllo/InsightIQ |
|---|---|---|---|---|
| 库存（自报） | 30M | 380M | 340M | — |
| 平台数 | 3 | 3 | **47** | 20+ |
| 起价 | 一事一议 | SaaS $199/月<br>**API $16,200/年起** | **$140/月**（含 API $208） | 约 $199/月起 |
| 自助 | ❌ 申请制 / closed beta | ❌ API 需 book a call | ❌ 注册要求公司/工作信息 | ❌ 销售报价 |
| 邮箱 | 三方验证，自报 99.8% 送达 | 有，但月度解锁上限 | 验证过，含状态标记 | — |
| 受众画像 | ✅ | ✅ | ✅ | ✅ |
| 赞助历史/报价 | ✅ 独有 | — | — | — |
| 特殊限制 | 无沙箱，调用即扣费 | 年付 | — | **OAuth 授权制**，创作者须先同意 |

**Phyllo 单独说明**：它读的是创作者 OAuth 授权后的一方数据，质量最高（含后台 insights 和收入），但**创作者必须先同意**。冷启动建联场景下完全不适用。

**库存数字不可比**：380M / 340M / 220M（HypeAuditor）/ 30M（CreatorDB）差十倍以上，源于"创作者档案"的定义不同 —— 有的把 50 粉账号也算一条。选型不应参考这个数字，应拿自己的关键词实测召回。

---

## 实测补充（2026-08-26）

以下保留 2026-08-26 的调用记录；2026-09-23 的文档核对另标出处，二者不混作同一次实测。

1. **当时测试的 IG 请求不接受免费额度。** 当时 TikTok 端点可用注册赠送的 free credit，
   IG 端点返回 **402**，提示不接受 free credit、需要付费余额。这是当时的接入记录，
   本次未复测赠送额度与账户充值门槛。公开价目的端点资格另见下方补充。
2. **当时采用 Reels 作为 IG 主发现路径。** 原先试用的 **V1** hashtag 响应中，
   `owner` 只有 `{id}`，没有 username；该观察不能外推到 V2 hashtag 或 general search。
   当前采集器只取 Reels 首页。2026-09-22 的 `smoothie` 历史探针记录显示响应有
   `data.pagination_token`，顺着它翻取得了更多去重作者；这不表示任意关键词的页大小、
   召回上限或边际产出相同。历史作者数与结果条目数的区别见 ADR-101 第十三节。
3. **目标接口的响应外壳有 schema，业务 `data` 没有结构约束。**
   2026-09-23 核对的 [官方 SDK 固定 OpenAPI 快照](https://github.com/TikHub/TikHub-API-Python-SDK/blob/2d92927332e1ff0fdc2d05b46381218a0f5a3511/spec/openapi.json)
   （提交 `2d92927332e1ff0fdc2d05b46381218a0f5a3511`）含 **114 个** `components.schemas`。
   本次核对的 Instagram 发现、用户搜索与 id 转用户名端点，其 200 JSON 响应均引用
   `ResponseModel`；该模型的 `data` 为 `anyOf: [{}, {"type":"null"}]`。
   这只能说明该响应 schema 不限定这些接口的业务数据形状，不能说整个规范没有响应 schema，
   也不能说所有端点都返回同一模型。端点 `description` 另有返回字段文字说明，例如
   Reels/hashtag/general 的 `data.items` 与 `pagination_token`；实际值、覆盖率和完整响应
   的包装层级仍需样本核验，不能把缺少类型化 schema 说成文档没有任何字段说明。
4. **主页近期作品路径的历史核实仍有效地记录在案。** 2026-08-26 调用 TikTok 的
   `app/v3/fetch_user_post_videos_v3` 与 Instagram 的 `v2/fetch_user_posts` 跑通公开指标路径；
   同次 IG V3 对公开账号用默认参数返回 400，当前采用 V2。细节见供应商参考文档，
   本次未重新调用这些端点。

### 固定规范的发现端点标价（2026-09-23）

上述固定规范中，`/api/v1/instagram/v2/search_reels`、`fetch_hashtag_posts` 与
`general_search` 的 `get.description` 均声明 **0.002 USD/请求**。这是该快照的声明，
真实账单未核；既不证明全部端点同价，也不能把仓库当前 `$0.001/请求` 的旧估算说成可靠上界。
本次只更正文档事实，预算代码与其尚未核对的费用上限承诺另行处理，见 ADR-101 第十三节。

### Instagram 原批发现路径的样本边界（2026-09-23）

用户原批 `selfcare` / `journaling` 调用交接中保留了**首条键路径摘要**：V2 Reels、
V2 hashtag 与 V2 general 的列表路径均为 `data.data.items`，首条有直接 `id` 和
`user.username`；Reels/general 的文案路径为 `caption.text`，hashtag 为 `caption_text`；
general 的首条另见 `user.follower_count`。这不保证每条都有该字段、值可用，或其含义一致。

原批 JSON 与先前分析的临时目录已丢失，无法复算原批作者/条目总数、字段覆盖率、
跨词重叠或分页增量，不沿用旧对话中的精确统计。用户后来重新采样，文件保存于
`output/adiaro-discovery/sample-lInRuK/`；新批是另一组观测，本次不纳入其分析数字，
也不以新批代替原批的可追溯性。
V2 hashtag/general 尚未接入采集器；V1 的 `owner` 限制不应成为否定它们的依据。
Reels 对纯图文、轮播及 PhotoMode 的覆盖、`play_count` 的媒体适用范围、匹配与排序规则
均未核实，不能从接口名称或首条键路径推导排除规则。

## 外部增强供应商复查（2026-08-26）

用户实际注册路径推翻了“页面写 self-service 就等于个人可用”的假设：

| 候选 | 注册/接入事实 | 数据方法与资历 | 结论 |
|---|---|---|---|
| Influencers Club | 要求公司/工作信息 | 数据库型增强，月费门槛高 | 不接入 |
| Click Analytic | 要求 company address/企业信息 | API 需商务身份 | 不接入 |
| DecodeCreator | 普通 Google 登录可用 | 由印度独立开发者运营；底层取 HikerAPI/tikwm 等公开数据再做派生分析；域名 2026-07-14 才注册，未找到独立基准、客户案例或可核验公司主体 | 不进入正式决策链 |

DecodeCreator 的官网条款也明确派生信号不保证准确、99.5% 只是目标而非 SLA。
这不能证明它是骗局，但不足以让其结果改变 KOL 分层。详见 ADR-10。

## 结论

| 角色 | 选择 | 理由 |
|------|------|------|
| **默认数据源** | **TikHub** | 唯一同时满足即时注册 + 同步返回 + 便宜到能让 Agent 试错。已覆盖 TikTok / Instagram / YouTube，扩展平台不用换供应商 |
| **公开指标** | **TikHub 主页近期作品** | 复用现有 key 与预算；真实端点已核实。只能得到公开绩效与异常信号，不能得到假粉率或受众地域 |
| **外部增强** | **当前不选** | 已调查的个人可接入候选要么要求企业信息，要么缺少足够的主体、历史与方法验证 |
| 备选适配 | Bright Data | 自助且合规资质完整，适合有企业采购要求的使用者。异步发现不适合做默认，但可作为 IG/跨平台的替代适配器 |
| **不采用** | CreatorDB / Modash API / Phyllo | 申请制或年付。数据更好，但分发不了 |

### 公开指标的成本模型

语义筛选后只对 `fit=✅/⚠️` 的幸存者请求主页作品。通常每个平台账号一次请求，
当前实现仍按旧的 `$0.001/请求` 估算并计入同一任务预算；这不是已核实的统一现价或
可靠费用上界。上文三路发现端点的规范价不代表主页端点同价，主页端点的固定公开价目见下方 2026-09-23 摘录，实际扣费仍未核对。
不运行时保持未查询，主流程照常交付。

---

## 适配层接口

数据源是可替换的商品层，因此先定义最小契约：

```
search(task, region, offset) → { creators: Partial<Creator>[],
                                 raw_count, has_more }

profile(handle, platform)   → Partial<Creator>

recentPosts(handle, platform) → { posts, followers?, following?, source }
```

- `search` 与 `profile` 必须实现
- `recentPosts` 已由 TikHub 实现但执行可选；结果进入供应商无关的三态 `Measurement<T>`
- 当前没有外部 `enrich` 供应商；邮箱验证和受众地域仍明确缺失

搜索作品标识补充（2026-09-23）：用户本地 IG 探针的首条键路径为
`data.data.items[0].id`，未见 `media` 包层；这只确认该条的路径，不保证所有条目的值可用。
适配层据此读取 item 直接 `id`，TikTok 读取 `aweme_info.aweme_id`（直接条目兼容路径为
`aweme_id`）。可用值写为带平台前缀的 `RecentPost.id`；合页和同人合并按标识稳定取并集，
首次记录优先，缺标识的作品逐条保留。完整边界见
[ADR-105](adr/ADR-105-搜索作品保留真实标识并稳定取并集.md)。

**当前实现边界**：`probe.ts`、`collect.ts` 与 `enrich.ts` 直接实例化 TikHub；仓库尚未实现按配置切换供应商。未来来源可复用统一测量结构，但必须先通过主体、注册、方法、双平台与真实样本验证。

---

## 平台官方 API：为什么都不能用

调研过一轮，结论是**官方 API 不为"发现陌生红人并联系"设计**，全部不可用于本场景。

### Instagram / Meta

| 接口 | 状态 |
|------|------|
| Basic Display API | **2024-12-04 已彻底关停**，无过渡期 |
| Instagram API with Instagram/Facebook Login | 只能访问授权你的账号 |
| **Business Discovery** | 唯一能查陌生人的口子。但调用方和目标方**都必须是商业/创作者账号**，需过应用审核，**只能按 username 精确查询、无搜索**，且**不返回邮箱** |
| Meta Content Library | 学术研究，需 ICPSR 申请 |

### TikTok

| 接口 | 状态 |
|------|------|
| Research API | 仅限美/欧/巴西非营利学术研究者，**明确禁止商业用途**，约 4 周审批 |
| Display API | 只能拿授权用户自己的数据 |
| Creator Marketplace API | 数据很好（受众画像、增长趋势、历史合作），但**合作伙伴白名单制**；且创作者需 ≥1万粉、28天10万赞才入库 |
| TikTok Shop Affiliate API | 2024 年开放，**对有店铺的电商是最佳合规路径**，但需 Partner Center 注册且要有店 |

### 三条共同限制

1. **准入** — 学术审批 / 白名单 / 应用审核，没有一条注册即用
2. **范围** — 要么只能查专业账号且需知道用户名，要么只能看已入驻的创作者
3. **字段** — 两家**都不给邮箱**。这是设计意图，不是遗漏

官方希望撮合和沟通留在站内闭环（TCM / Shop Affiliate）。这正是第三方数据源存在的原因。

> **例外值得记一笔**：如果使用者是有 TikTok 店铺的电商，`TikTok Shop Affiliate API` 给的是真实转化数据，比任何第三方的粉丝估算都值钱。未来可作为一个高价值的可选适配器。

---

## 普通 API 请求与缓存结果直链分开记（2026-09-23 更正）

此前把 `cache_url` 说成“只是调试和分享，不能省下重取费用”过强。
[上述固定 OpenAPI 快照](https://github.com/TikHub/TikHub-API-Python-SDK/blob/2d92927332e1ff0fdc2d05b46381218a0f5a3511/spec/openapi.json) 的 `ResponseModel.cache_message_zh` 默认说明：
返回的缓存结果直链有效 24 小时，访问该缓存不另收费；同一模型的 `message_zh` 默认说明
普通请求成功会计费。两种访问不能混为一谈。

`cache_url` 声明为 string 或 null，且不在必填列表中；不能保证每次响应都有可用直链，
本次也没有访问真实缓存链接来验证其可用性。缓存保存的是那次结果，不是新一次搜索。

**当前 `--resume` 不读取或复用 `cache_url`。** 它跳过已完成任务、保留本地已采集数据，
仍可能继续付费搜索或补 profile。此更正不修改预算、请求计数或续跑逻辑，也不承诺
普通 API 重发免费；是否接入缓存属于另一项实现工作。

## 免费额度资格按端点说明（2026-09-23 补充）

[官方 pricing 页](https://tikhub.io/pricing)的[计算器脚本](https://tikhub.io/_next/static/chunks/03dluu4eljhx9.js)
从[公开静态价目](https://tikhub.io/_next/static/chunks/16hcexj0jth19.js)逐项读取免费额度标记。
本次读取于 2026-09-23；价目自身 `updatedAt=2026-07-20`，读取日期不是价格更新时间。
原文 SHA256：`5d52fe8fb109a569e4e16b39b611ee9d5233c9131d264f1e856a987f23cc8cbf`。
本项目涉及的七条 Instagram 路径，在该快照中的免费额度标记均为 0：

| 完整端点 | 本项目状态 |
|---|---|
| `/api/v1/instagram/v2/search_reels` | 生产发现 |
| `/api/v1/instagram/v2/search_users` | 生产发现兜底 |
| `/api/v1/instagram/v2/fetch_user_posts` | 生产主页样本 |
| `/api/v1/instagram/v1/fetch_user_info_by_username_v3` | 生产 profile |
| `/api/v1/instagram/v1/fetch_user_info_by_username_v2` | 生产 profile 降级 |
| `/api/v1/instagram/v2/fetch_hashtag_posts` | 仅实验采样，未接入生产 |
| `/api/v1/instagram/v2/general_search` | 仅实验采样，未接入生产 |

这支持“该快照中的这七条路径不接受免费额度”，不支持“所有 IG 端点永久不接受”。
不接受免费额度的请求需要可用付费余额；已有足额余额无需再次充值。本次未查询账户余额、
赠送额度或实际扣费，也未发新的数据请求；是否需要充值不能由历史 402 替具体账户判断。

## 生产端点的固定公开价目（2026-09-23 摘录）

已将同一公开静态价目的八条生产路径及原始 tuple 归档到
[`tikhub-pricing-20260923.json`](evidence/tikhub-pricing-20260923.json)，带来源 URL、观察时间及资产 SHA256。
TikTok 搜索、profile、主页作品三路各 $0.001；IG Reels、账号名搜索、主页作品各 $0.002，
IG profile 的 v3/v2 两路各 $0.001。它是固定公开基础价，不计优惠，不是账单或未来价格上界。
当前生产仍按旧统一单价；ADR-107 的纯金额模型尚未接入付费入口，不能把归档价格当成已修好的预算。
