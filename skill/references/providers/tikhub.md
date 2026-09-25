# TikHub —— 默认数据源

> 端点路径与参数于 2026-08-25 从 `https://api.tikhub.io/openapi.json` 核实。
> 该 spec 是活的，TikHub 迭代频繁（IG 在 2025-12 做过 V1/V2/V3 重构）。
> **拿不准时直接拉 spec 核对，不要照抄本文档猜。**

## 基础

```
Base URL:  https://api.tikhub.io
认证:      Authorization: Bearer {TIKHUB_API_KEY}
限速:      10 RPS —— 请求间隔取 150ms
费用依据: 按实际端点固定公开基础价估算；不是实际账单
```

当前八条缺省生产端点按固定价目计预算：TikTok 三路与 IG 两路 profile 各 $0.001；IG Reels、账号名搜索、主页作品各 $0.002。来源为 [TikHub 官方定价资产](https://tikhub.io/_next/static/chunks/16hcexj0jth19.js)，观察时刻与固定版本见 ADR-107 末尾；不计优惠，不是实付账单或未来价格上界。实验 general 不因此成为生产路径。同一价目版本另登记了 v2 话题端点 `fetch_hashtag_posts`（$0.002，同一份资产原样转录，见 ADR-107 末尾）；**只有运营在任务上显式写 `ig_route: "hashtag"` 时才请求它**，缺省仍走 Reels（D15.j、D15.k，ADR-112）。

⚠️ **早期样本中的 IG 请求不接受免费额度。** 实测（2026-08-25）：当时采用的 TikTok 端点可用注册赠送的
free credit 调用；当时测试的 Instagram 端点返回 **402**，提示
「this endpoint requires payment and does not accept free credit」。
不接受免费额度的端点需要可用付费余额，已有足额余额无需再次充值。
不能把上述历史 402 外推成所有 IG 端点或所有账户都必须先充值。
2026-09-23 核到的公开价目中，本项目五条缺省生产 IG 路径和两条当时的实验发现路径（话题搜索现已可由运营显式开启，ADR-112）均标记不接受
免费额度；具体范围、快照日期与来源见 `docs/data-source-strategy.md` 的免费额度补充。

> curl 对这个 host 连接不稳定（LibreSSL SSL_ERROR_SYSCALL 间歇性出现），
> Node 的 fetch 正常。调试时用 Node，不要用 curl 排查。

**普通 API 请求与缓存结果直链分开看。** [官方固定 OpenAPI 快照](https://github.com/TikHub/TikHub-API-Python-SDK/blob/2d92927332e1ff0fdc2d05b46381218a0f5a3511/spec/openapi.json)
的 `ResponseModel.cache_message_zh` 默认说明：缓存结果直链有效 24 小时，访问缓存不另收费。
`cache_url` 可缺失或为 null，不能保证每次都有可用链接；普通 API 重发不因此免费。
当前采集器和 `--resume` 没有接入缓存直链，仍按本地断点继续搜索与补 profile。
本次只核文档声明，未请求真实缓存链接。

---

## TikTok

### 发现：视频搜索（首选）

```
GET /api/v1/tiktok/app/v3/fetch_video_search_result
```

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `keyword` | string | 必填 | 搜索关键词 |
| `offset` | int | 0 | 偏移量，翻页时 += count |
| `count` | int | 20 | 每页数量 |
| `sort_type` | int | 0 | 0 相关度，1 最多点赞 |
| `publish_time` | int | 0 | 0 不限，1 最近一天，7 一周，30 一月，90 三月，180 半年 |
| `region` | string | `US` | 地区，ISO 3166-1 alpha-2 |

**实测的响应结构（2026-08-25 真实调用）**：

```
data.search_item_list[].aweme_info.author.unique_id      ← 结果在这里
data.search_item_list[].aweme_info.author.follower_count ✓ 有值
data.search_item_list[].aweme_info.author.aweme_count    ✗ 恒为 0，不是真实值
data.search_item_list[].aweme_info.author.signature      ✗ 恒为 undefined
data.search_item_list[].aweme_info.statistics.play_count / digg_count  ✓
data.search_item_list[].aweme_info.desc                  ✓
```

**图文的样本（2026-09-23，两个词首页 40 条，ADR-101 第十五节）**：40 条都有视频播放地址、正时长与非零
`statistics.play_count`，`image_infos` 全为 null，没有 `image_post_info`。`aweme_type` 为 0 的 39 条、55 的 1 条；
55 那条同样有视频播放地址、正时长与非零播放数，没有 `image_post_info`。没有找到这个端点的官方类型枚举，
它是视频还是图文没有判定，不能拿「`aweme_type` 不是 0」判图文。没确认到图文正例，
不等于这个端点排除图文；主页作品端点这批没有调用。

⚠️ **两个坑，都是实测才发现的**：

1. **`data.aweme_list` 同时存在，但是空数组。** 解析时若按「第一个存在的数组」取，
   会命中空的 `aweme_list`，静默产出「这个关键词一个人都没有」—— 而事实是有 10 个。
   必须取**第一个非空**的数组。
2. **`author.aweme_count` 对所有人都返回 0。** 那不是真实作品数，是搜索结果里不填这个
   字段。当成 0 会让「视频数 > 30」的内容积累加分全员失效。且 0 是个「值」，类型系统
   防不住，只能显式判掉，等 profile 补全。

**为什么当前采用视频搜索**：项目需要作品内容作为判断候选的证据。早期用户搜索样本商家与机构偏多，但这不证明其结果必然如此；视频搜索也不保证排除商家，实际内容仍需语义判断。

**两个参数要用起来**：

- `region` 按 Phase 01 的目标市场设置。默认 US 只适合美国市场
- `publish_time=90` 可以过滤掉已经不活跃的账号。想要覆盖面就留 0

### 补全：用户 Profile

```
GET /api/v1/tiktok/web/fetch_user_profile?uniqueId={handle}
```

参数 `uniqueId`（优先）或 `secUid`。

**这一步不能省。** 视频搜索返回的 author 是精简版，`signature`（bio）常为空 —— 而邮箱就在 bio 里。前一版实测：仅视频搜索有邮箱率约 5%，补 profile 后 46%+。

字段路径（前一版实际使用中验证过）：

```
data.userInfo.user.uniqueId
data.userInfo.user.nickname
data.userInfo.user.signature        // bio，邮箱在这里
data.userInfo.user.followerCount
data.userInfo.user.followingCount
data.userInfo.user.videoCount
data.userInfo.user.verified
data.userInfo.user.bioLink.link     // ★ 跨平台同人识别信号
data.userInfo.user.avatarMedium
```

`bioLink.link` 常指向 Instagram/Linktree —— 这是识别同一个人在两个平台账号最可靠的信号，务必抓取。

### 公开指标：用户近期作品

```
GET /api/v1/tiktok/app/v3/fetch_user_post_videos_v3?unique_id={handle}&count=12
```

2026-08-26 用公开账号真实调用确认：

```
data.aweme_list[]
  .aweme_id
  .create_time
  .is_top
  .statistics.play_count
  .statistics.digg_count
  .statistics.comment_count
  .statistics.share_count
  .author.follower_count
  .author.following_count
```

这是 D8/D10 的主页近期样本，与关键词搜索的 `search_item_list` 分开。`is_top=1` 的作品
在绩效聚合时排除，但发布时间仍用于当前活跃标签；任何计数字段缺失都保持 undefined，不补 0。

### 备选

| 端点 | 何时用 |
|------|--------|
| `/api/v1/tiktok/app/v3/fetch_user_search_result` | 视频搜索无结果时的兜底。商家号多但字段完整 |
| `/api/v1/tiktok/web/fetch_search_user` | 另一个数据源，`fetch_user_search_result` 结果少时试 |
| `/api/v1/tiktok/app/v3/fetch_hashtag_search_result` | 需要按话题而非关键词发现时 |

---

## Instagram

**当前采集器的发现主路径是 Reels 搜索。** 下文分别标记历史调用、固定规范声明和用户样本摘要；
没有对应调用证据的端点不算“全部实测通过”。

### 发现：Reels 搜索（首选）

```
GET /api/v1/instagram/v2/search_reels?keyword={kw}
```

当前用它取得作品及作者线索；实际匹配依据与排序规则未核实，不能保证自动排除商家号。

**2026-08 历史 Reels 样本的字段记录（不保证当前所有条目）**：

```
data.data.items[].user.username      ✓
data.data.items[].user.full_name     ✓
data.data.items[].user.id            ✓
data.data.items[].user.is_verified   ✓
data.data.items[].user.is_private    ✓  私密号建联方式受限，值得标出
data.data.items[].user.follower_count  ✗ 当时样本未取得；当前此解析路径仍待 profile 补全
data.data.items[].caption.text       ✓
data.data.items[].play_count         ✓
data.data.items[].like_count         ⚠️ 可能是 null（作者隐藏赞数）—— null 是「不可见」不是 0
```

**当前搜索适配口径**：Reels 与显式启用的话题路线共用逐条视频判定；只在 `is_video === true`、
`media_type === 2`、`media_format === 'video'`、`media_name === 'reel'` 或
`product_type === 'clips'` 任一信号成立时写搜索作品播放数。图文、轮播及类型未知的
作品仍提供作者、文案等内容线索，但不写播放数，即使源字段给出 0；确认视频的真实 0
保留。此规则不证明 Reels 端点只返回视频，也不核实主页图文的播放字段（D18.a–d、ADR-102 第九节）。

⚠️ **当前实现、历史样本与未知边界分别记。** 下面的样本观察不是端点的穷尽保证。

1. **顺着续页令牌翻，页数随达标走**（D6.u、D6.v，ADR-111）。首页只发 `keyword`；之后带上一页响应交回的
   `pagination_token` 再问，没达标就继续翻、达标即停，单个任务仍受 4 页上限约束。
   本页 0 条、解析不出作者、响应没给令牌或令牌只有空白，就在这一页停下 —— 这只说明**本次没有可继续的令牌**，
   不说明服务端已经没有更多。走了账号名兜底的那一页不带令牌。**令牌只在同一次运行内有效**，不写进 `task.json`：
   一次运行结束时还握着令牌的任务记进 `done`，续跑不会再为已经抓过页的 IG 任务请求。
   ⚠️ **「它没有分页游标」那句话是错的，2026-09-22 真跑一次验掉了。** 那句话原本写在
   这里，证据只有一句「响应只有 `count` 和 `items`」—— 而那次真调用打出的键路径里，
   **`data.data` 的兄弟位置上就有一个 `data.pagination_token`**。`pickList` 只取
   `data.data.items`，所以在那之前没有任何一行代码看得见它：那句「只有 count 和 items」
   是透过我们自己那个窄窗口看出来的。

   **能翻页 —— 2026-09-22 顺着链翻了一次，实测有效。** 参数名是 `pagination_token`
   （官方 spec 声明的那一个，不是猜的，出处见下面那张参数名表）。**历史 `smoothie` 记录里**：链式请求观察到的累计去重作者多于等次数原样重发，
   重发又多于单请求；这不证明统计显著性或因果可加性（ADR-101 第十三节）。具体几个人别抄在这儿 —— 跑一次看输出的
   `chain_cum_creators` 与 `control_cum_creators`（数记在 ADR-101 第十二节那棵不会再动的树上）。
   ⚠️ 但它**不是干净的分页** —— 每一次的新条目在满页与个位数之间跳，重叠很重，
   所以**别按「翻 N 页 = N × 单页条数」估**。
   ⚠️ 而且那是**一个关键词、一次跑**，换词换时段都没验过（ADR-101 第十二节）。

   ⚠️ **端点会漂**：两次完全相同的请求返回不同的条目集。这件事比参数问题更根本 ——
   它意味着「一个关键词固定返回那一批人」这个隐含前提也不成立，而且它本身就是一条
   不需要任何分页参数的召回路径。

   要验就跑探针（要一把**充过值**的 key；真发了几次、估算花了多少，脚本自己打在输出的
   `requests` 与 `cost_estimate_usd` 上；后者是该进程固定价目下的占用，含保守留存/未结分项，
   不是 TikHub 的账单）：

   ```
   npm run probe:ig-paging -- --keyword smoothie              # 只打一次，看响应形状
   npm run probe:ig-paging -- --keyword smoothie --chain 10   # 顺着游标翻，自带对照组
   npm run probe:ig-paging -- --keyword smoothie --repeat 10  # 原样重发，只量漂移
   ```

   ⚠️ **`--chain` 一定同时跑对照组**，这就是它发 2N 次请求的原因。端点会漂，少了对照
   曲线，链上多出来的人分不清是翻页给的还是漂给的 —— **而这两种读法的结论正好相反**。

   ⚠️ **只看人，别看条目。** 同一个人连发几条 Reels，条目在涨而一个新达人都没多给，
   对召回毫无用处。结论那句话自己会点出是哪一种。

   ⚠️ **它给不出「服务端只有这么多人」这个结论。** 末尾连着几次不涨，说的是
   「**这 N 次之内**没再涨」——「问完了」与「还没问够」在一次观测里不可区分。
   响应中未取得可用的下一个游标时，探针会停止追链；这只能证明本次没有可继续的游标，
   不能证明已穷尽全部匹配结果。探针现有结论措辞的限制见 ADR-101 第十三节。

2. **历史样本中短词比词组多返回结果。** 2026-08 的 `smoothie` / `smoothie recipe`
   记录提示可先试短词，但不足以推出“所有词组都返回 0”，也不是固定页大小的证据。
   当前关键词应以本次试探为准。
3. **本稿不作媒体覆盖结论。** 不能由 `search_reels` 名称断言它只会返回视频，或只发
   图文的作者永远搜不到。固定规范未限定目标 `data` 的媒体类型与字段语义。
   2026-09-23 两个词的 8 份 Reels 首页共 96 条，全是视频（ADR-101 第十五节）；这只说明那两个词、
   那几分钟里没看到图文，不能据此判定纯图文、轮播、PhotoMode 的覆盖、`play_count` 适用范围或排序。
   话题页同批样本里一半是图片与轮播，它们的 `play_count` 是 0，那是假零，不能拿来和视频比。

### 为什么弃用了 v1 的 hashtag 端点

`/api/v1/instagram/v1/fetch_hashtag_posts` 能跑通（`data.data.hashtag.edge_hashtag_to_media.edges`，
33 条），但**它的 `owner` 只有 `{id}`** —— 没有 username、没有昵称、没有粉丝数。

该次响应中要额外调用 `user_id_to_username` 才能得到 handle，因此当前采集器未采用 V1。
这是 **V1 的历史样本**，不能用来断言 V2 hashtag/general 同样没有 username，
也不能直接换算成整个采集任务成本翻倍。

### 备选：关键词搜用户

```
GET /api/v1/instagram/v2/search_users?keyword={kw}
```

响应 `data.data.items[]`，直接是 user 对象（`username` / `full_name` / `id`），50 条。
商家号偏多，作为 Reels 搜索无结果时的兜底。
**响应里没有作品** —— 这条路搜到的人不带 `recent_posts`：没问过，不是没作品（ADR-102）。

### 补全：用户 Profile

```
GET /api/v1/instagram/v1/fetch_user_info_by_username_v3?username={handle}
```

**实测：user 对象直接在 `data` 下**，不是 `data.user`。

```
data.pk / data.id          ✓
data.username              ✓
data.full_name             ✓
data.biography             ✓  邮箱在这里
data.follower_count        ✓  （V2 没有这个字段，V3 才有）
data.following_count       ✓
data.media_count           ⚠️ 实测常为 null —— 当 0 会让内容积累加分失效
data.is_verified / is_private  ✓
data.external_url          ✓
data.bio_links[]           ✓  含 `url`（原始地址）和 `lynx_url`（IG 重定向包装）
```

`bio_links[].url` 是原始地址可直接用；`lynx_url` 是 `https://l.instagram.com/?u=<编码>` 的包装。
跨平台同人识别用 `url`。

### 公开指标：用户主页近期作品

```
GET /api/v1/instagram/v2/fetch_user_posts?username={handle}
```

2026-08-26 实测响应为（这次取到的是 12 条 Reels，未验证主页图文条目的字段）：

```
data.data.items[]
  .id
  .is_video / .media_type / .media_name / .product_type
  .is_pinned
  .play_count / .ig_play_count
  .like_count
  .comment_count
  .taken_at
data.data.user.follower_count / following_count
```

当前采集从提供方返回顺序中取前 12 条作品，不先按媒体类型筛选，也不向第 13 条补位。
只有 `is_video === true`、`media_type === 2`、`media_format === 'video'`、
`media_name === 'reel'` 或 `product_type === 'clips'` 才确认视频；没有这些肯定信号的
作品仍留在样本中，但不凭播放数字段推断为视频，也不把缺失的播放量补成 0。
播放类指标及 Reels 报价的播放/互动分母只使用确认视频；普通互动、发布间隔和当前活跃
使用全部返回作品。明确 pinned 的项目不进入绩效聚合，发布时间仍参与最后发布。

新样本记 `media_scope: 'provider_returned_first12'`。已存旧样本只有来源为
`public_api/tikhub`、端点为本节 V2 路径且 basis 精确匹配旧视频筛后记录时，才可标
`legacy_video_filtered_first12`；其表现和 Reels 报价是历史视频样本结果，
不能据此推断同期图文或当前活跃；无法确认旧口径时标 `unknown`，依赖作品范围的
指标与报价不可用。旧样本缺失的图文无法从本地缓存复原；要取得新范围须显式刷新，
可能产生付费请求。上述规则是解析契约，不表示已实际观察到 IG 主页图文返回。

OpenAPI 同时列有 `/api/v1/instagram/v3/get_user_posts`。2026-08-26 对公开账号
`mkbhd` 使用文档默认参数真实调用返回 **400**，响应明确说明不扣费；同一账号 V2 返回
200 与 12 条完整数据。因此当前实现以 **V2 为已验证路径**，不为了版本号更新而强用 V3。

### 参数名各版本不一致 —— 踩过的坑

> 2026-09-23 直接核对 [官方 SDK 的固定 OpenAPI 快照](https://github.com/TikHub/TikHub-API-Python-SDK/blob/2d92927332e1ff0fdc2d05b46381218a0f5a3511/spec/openapi.json)，
> 提交 `2d92927332e1ff0fdc2d05b46381218a0f5a3511`。以下只陈述该快照的路径与请求参数，
> 不当作所有历史版本或当前在线服务的穷尽保证。目标端点的 200 响应均引用 `ResponseModel`；
> 外壳有 schema，而 `data` 为 `anyOf: [{}, {"type":"null"}]`，不能从该 schema 推出业务字段路径。
> 端点 `description` 另列返回字段说明，如三路 V2 发现的 `data.items` / `pagination_token`；
> 实际响应的完整包装层级、字段值与每条覆盖率仍由对应样本核验。

| 端点 | 参数名 | 分页参数或边界 |
|------|--------|---------|
| `v1/fetch_hashtag_posts` | `hashtag` | `end_cursor` |
| `v2/fetch_hashtag_posts` | `keyword`；可选 `feed_type`（默认 `top`，说明列 `top`/`recent`/`reels`） | `pagination_token` |
| `v3/get_hashtag_posts` | — | 此路径在该固定快照中未找到；不推断它在所有版本或当前服务中不存在 |
| `v2/search_users` | `keyword` | 未声明分页参数；不能据此断言一次返回全部匹配用户 |
| `v3/search_users` | `query` | `rank_token` |
| `v2/search_reels` | `keyword` | `pagination_token`；历史 `smoothie` 探针有链式翻页增量；采集器按令牌翻页，令牌不跨运行（ADR-111） |
| `v2/general_search` | `keyword` | `pagination_token`；两批首页已逐条核过字段（见下文），尚未接入采集器 |
| `v1`／`v2` `user_id_to_username` | `user_id` | 未声明分页参数 |

### V2 发现路径的样本（2026-09-23 采）

`selfcare` / `journaling` 在三条 V2 路线上各采了两批首页，存在需求所有者本机的
`output/adiaro-discovery/sample-FUn2by/`（早两分多钟开始）与 `sample-lInRuK/`；两份清单每次观测都带 `sha256`，
与原始响应逐份一致。2026-09-25 对照原会话记录确认，丢失原批的后 9 次请求发生于 2026-09-22，
不同于这两批 2026-09-23 的请求；`sample-FUn2by` 不是丢失原批，原批响应仍未恢复（ADR-101 第十六节）。
这次来历更正不改变下文基于两份现存样本的字段与统计结论。
下表是键路径，逐条覆盖见表下。

| 来源 | 列表 | 首条作者与作品 id | 首条文案 | 其他首条字段 |
|---|---|---|---|---|
| `v2/search_reels` | `data.data.items` | `user.username`、直接 `id` | `caption.text` | — |
| `v2/fetch_hashtag_posts` | `data.data.items` | `user.username`、直接 `id` | `caption_text` | — |
| `v2/general_search` | `data.data.items` | `user.username`、直接 `id` | `caption.text` | `user.follower_count` |

表内 item 子路径省略共同前缀 `data.data.items[0].`。这里的 `id` 不加 `media` 包层，
也不使用 `user.id` 或 `caption.id` 代替作品标识。两批 24 份首页已在本机零成本逐条核过（ADR-101 第十五节）：
- 每条都有顶层 `id` 与 `user.username`，条目都没有 `media` 包层；文案除 4 条 Reels 的 `caption.text` 不是字符串外都是字符串；
  `user.follower_count` 只在 general 上是数值（64 条全是），Reels 与话题页上没有一条是数值，字段在不在没核；
- 媒体字段（`media_type`／`product_type`／`is_video`）逐条数过；`play_count` 只数了非视频条目；
- 同词重跑的作者重叠、跨路线独有与两词交集也算了：话题页作者两个词都不在 Reels 与 general 里；
  Reels 同一请求重跑漂得很厉害；两个词之间作者没有交集。

分页增量没有样本；`feed_type` 只用过 `top`。

历史测试曾因缺少正确的必填参数返回 **422** 并指出缺失字段；这不保证所有参数错误都返回相同状态或被拒绝。

## 双平台差异速查

| | TikTok | Instagram |
|---|---|---|
| 发现主路径 | 视频搜索 `fetch_video_search_result` | **Reels 搜索 `v2/search_reels`** |
| 结果路径 | `data.search_item_list[]` | `data.data.items[]` |
| 分页 | ✅ `offset` + `has_more` | 端点**支持**游标翻页（`pagination_token`，实测有效）；采集器顺着它翻、页数随达标走，令牌只在一次运行内有效（ADR-111）。另外端点会漂，见上 |
| 关键词长度 | 2–3 词的自然短语作为起点 | 可先试短词；历史单例不证明词组必为 0，以本次试探为准 |
| bio 字段名 | `signature` | `biography` |
| bio 完整度 | 早期搜索样本未取得，当前需补 profile | 早期 Reels 样本未取得，当前需补 profile；不外推所有发现端点 |
| 外链字段 | `bioLink.link`（单个） | `bio_links[]`（数组） |
| 粉丝数字段 | `followerCount`（驼峰） | `follower_count`（下划线） |
| 地区过滤 | ✅ `region` 参数 | 本次核对的目标搜索端点未声明地区参数；关键词语言不能证明作者或受众地区 |
| 时间过滤 | ✅ `publish_time` | ❌ 无 |

**字段命名两边不一致**（驼峰 vs 下划线），归一化时容易出错，写适配器时对着这张表核。

---

## 搜索作品标识与并集（D11）

实际发现路径另存于 `Creator.discovery_sources`（D15）：TikTok 视频搜索、IG Reels、IG 账号名搜索、IG 话题搜索只有真正返回该账号时才记录端点、平台、账号、原词及维度。Reels 空结果后的兜底账号只记账号名搜索；话题任务（`ig_route: "hashtag"`）只请求话题页首页，请求词去掉一个开头的 `#`、`feed_type=top`，解析不出人也不走兜底，来源里照记原词（D6.w、D15.k）；profile 不算发现。`as_hashtag` 不改变路径，路线只由 `ig_route` 决定。集合只含已观察来源，旧缺席/空数组读作来源未知，不保证完整历史或某条作品的具体来源；合并与展示规则见 ADR-110。

| 搜索来源 | 原始作品 id 字段 | 归一化后的 `RecentPost.id` |
|---|---|---|
| TikTok App V3 视频搜索 | `data.search_item_list[].aweme_info.aweme_id`；已有直接作品条目兼容路径仍读该作品的 `aweme_id` | `tiktok:<原始id>` |
| Instagram V2 Reels 搜索 | `data.data.items[].id`，不使用 `caption.id`、`user.id` 或未核实的其他层级 | `instagram:<原始id>` |
| Instagram V2 话题搜索（`ig_route: "hashtag"`） | `data.data.items[].id`，同样不使用文案或用户的标识（ADR-112 第五节：4 份样本的首条 `id` 为字符串） | `instagram:<原始id>` |

TikTok 的字段来自交接中的本地调用观察；Instagram 的 2026-09-23 本地键路径只确认
那次首条存在直接 `id` 键；`selfcare`／`journaling` 两批 24 份首页后来逐条核过，每条顶层 `id` 都不是 null 或缺席
（ADR-101 第十五节），但类型与是否空白没有逐条核，所以仍不能说值都可用。归一化仅接收非空白字符串
或安全整数：字符串只用 `trim()` 判空，保存原值；整数转十进制字符串。其余保持缺失。
这与主页公开绩效样本的 id 是不同契约，不从主页适配逻辑借用空串兜底。

同平台同作品保留首次记录，后到新作品稳定追加；缺 id 或空白 id 的记录逐条保留，
不按文案去重。有效字符串键按原值比较；跨平台原始 id 相同仍分别保留。采集合页与
同人合并复用这一契约，后者主记录作品在先；两侧无作品仍是未查询。完整适配约束见
`_interface.md`，采用原因见 ADR-105。

---

## 响应结构自动检测

TikHub 透传平台原始响应，schema 随端点和版本变化。**首次调用一个没用过的端点时，先探测结构再写解析逻辑**，不要假设：

实现见 `scripts/providers/tikhub.ts` 的 `pickList()`：

```
1. data.search_item_list      → TikTok 视频搜索
2. data.data.items            → IG v2 search_reels / search_users / fetch_hashtag_posts
3. data.user_list / data.users
4. data.aweme_list            → post 类型，从 .author 提取
5. data.data.hashtag.edge_hashtag_to_media.edges  → IG v1 hashtag（已弃用）
6. data.data / data.items / data.result
7. 都不匹配 → 打印 data 的顶层 key，报错，**不硬猜**
```

⚠️ **取「第一个非空数组」，不是「第一个存在的数组」。**
实测视频搜索会同时返回**空的** `aweme_list` 和有数据的 `search_item_list` ——
命中前者会静默产出「这个关键词一个人都没有」，而事实是有 10 个。
全空但确实是数组，才是真的没有结果。

---

## 错误处理

| 状态码 | 含义 | 处理 |
|--------|------|------|
| 200 | 收到成功状态 | 留存本次估算金额；后续解析失败不退款 |
| 402 | 余额不足 | **停止**，告诉用户去充值，不要重试 |
| 429 | 超过限速 | 退避后重试，把间隔从 150ms 调到 300ms |
| 非 200 | 各类错误（含 201/204） | 只撤销本次预留；是否重试沿用既有规则，每次重试重新检查预算 |
| 无 HTTP 状态 | 结果不明 | 保守留存本次金额，不当作已核扣费；费用错误不得触发 retry/fallback |

collect/enrich 每次请求前先保存 pending，结算也须保存成功后才读正文或继续尝试。任一费用保存失败停止本运行并退出 1；恢复 pending 保留占用、拒绝付费和改额，不推断是否已扣款。probe 与直接分页探针仍只使用本进程预算，不落盘（ADR-109）。

同一个关键词连续多页返回空，视为该关键词耗尽，换下一个 —— 不要继续翻页浪费请求。
