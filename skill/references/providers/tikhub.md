# TikHub —— 默认数据源

> 端点路径与参数于 2026-08-25 从 `https://api.tikhub.io/openapi.json` 核实。
> 该 spec 是活的，TikHub 迭代频繁（IG 在 2025-12 做过 V1/V2/V3 重构）。
> **拿不准时直接拉 spec 核对，不要照抄本文档猜。**

## 基础

```
Base URL:  https://api.tikhub.io
认证:      Authorization: Bearer {TIKHUB_API_KEY}
限速:      10 RPS —— 请求间隔取 150ms
计费:      $0.001/请求，非 200 不计费
```

⚠️ **免费额度不覆盖 Instagram。** 实测（2026-08-25）：TikTok 端点可用注册赠送的
free credit 调用；Instagram 端点一律返回 **402**，提示
「this endpoint requires payment and does not accept free credit」。
**要跑 IG 必须先充值真实余额。**

> curl 对这个 host 连接不稳定（LibreSSL SSL_ERROR_SYSCALL 间歇性出现），
> Node 的 fetch 正常。调试时用 Node，不要用 curl 排查。

**重要：TikHub 不返回缓存数据。** 每次请求都实时抓取并独立计费。响应里的 `cache_url` 只是把那一次响应留存 24 小时供调试和分享，**不是**省钱的重取通道 —— 不要设计"中断重跑复用缓存"的逻辑，不会生效。

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

⚠️ **两个坑，都是实测才发现的**：

1. **`data.aweme_list` 同时存在，但是空数组。** 解析时若按「第一个存在的数组」取，
   会命中空的 `aweme_list`，静默产出「这个关键词一个人都没有」—— 而事实是有 10 个。
   必须取**第一个非空**的数组。
2. **`author.aweme_count` 对所有人都返回 0。** 那不是真实作品数，是搜索结果里不填这个
   字段。当成 0 会让「视频数 > 30」的内容积累加分全员失效。且 0 是个「值」，类型系统
   防不住，只能显式判掉，等 profile 补全。

**为什么用视频搜索而不是用户搜索**：用户搜索按账号名匹配，结果里全是把产品词塞进账号名的商家号和机构号。视频搜索按内容匹配，找到的是"真的在做这类内容"的人，与 TikTok 网页搜索结果一致。

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

**发现主路径是 Reels 搜索，不是 hashtag。** 全部端点于 2026-08-25 真实调用核实。

### 发现：Reels 搜索（首选）

```
GET /api/v1/instagram/v2/search_reels?keyword={kw}
```

这是 TikTok 视频搜索在 IG 上的对应物 —— 按**内容**匹配而非账号名。

**实测响应结构**：

```
data.data.items[].user.username      ✓
data.data.items[].user.full_name     ✓
data.data.items[].user.id            ✓
data.data.items[].user.is_verified   ✓
data.data.items[].user.is_private    ✓  私密号建联方式受限，值得标出
data.data.items[].user.follower_count  ✗ 没有，必须补 profile
data.data.items[].caption.text       ✓
data.data.items[].play_count         ✓
data.data.items[].like_count         ⚠️ 可能是 null（作者隐藏赞数）—— null 是「不可见」不是 0
```

⚠️ **两条限制 —— 第一条是我们自己的做法，第二条才是实测的**：

1. **我们只取一页**（约 12 条）。代码只发 `keyword` 一个参数，第 2 页起直接返回空，不白花请求。
   ⚠️ **别把这条读成「它没有分页游标」。** 那句话原本写在这里，证据只有一句「响应只有
   `count` 和 `items`」—— 那是**响应**那一侧的观测，而**请求收不收 `offset`／`max_id`
   从来没有人试过**，两件事不是一回事。TikHub 的 OpenAPI 又不描述响应体（见
   `docs/data-source-strategy.md` 第 3 条），所以文档那条路也走不通。
   要验就跑 `npm run probe:ig-paging -- --keyword smoothie`（基线 2 次 ＋ 每个参数各 1 次；
   实际次数与花费脚本自己打在输出里，这儿不写死。要一把**充过值**的 key）。**它的输出里没有「不支持」这句判词**，只有三句：

   | 判词 | 什么时候打 | 它说了什么 |
   |---|---|---|
   | **认了** | 拿到了基线里没有的条目，而基线自己两次一致 | 服务端确实按这个参数多给了 |
   | **这一次没多给** | 一个新条目都没多拿到 | **只有这么多。**未知参数常被静默忽略，「没这个参数」与「这一次没多给」在一次观测里不可区分 |
   | **作废** | 基线自己两次就不一样 | 端点在漂，这一跑一个参数也别判 |

   把「这一次没多给」写成「不支持分页」，就是把不确定伪装成确定 —— 而方向最坏：
   下一个人看了就不再试，这句承重话于是永远没人验（这正是它上一次的下场）
2. **对词组敏感。** `smoothie recipe` 返回 **0** 条，`smoothie` 返回 12 条。
   **IG 侧的关键词要比 TikTok 短** —— 生成关键词时分平台处理

### 为什么弃用了 v1 的 hashtag 端点

`/api/v1/instagram/v1/fetch_hashtag_posts` 能跑通（`data.data.hashtag.edge_hashtag_to_media.edges`，
33 条），但**它的 `owner` 只有 `{id}`** —— 没有 username、没有昵称、没有粉丝数。

每个创作者要额外一次 `user_id_to_username` 调用才能拿到 handle，成本翻倍，
而且拿到的信息还不如 Reels 搜索多。已弃用。

### 备选：关键词搜用户

```
GET /api/v1/instagram/v2/search_users?keyword={kw}
```

响应 `data.data.items[]`，直接是 user 对象（`username` / `full_name` / `id`），50 条。
商家号偏多，作为 Reels 搜索无结果时的兜底。

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

### 公开指标：用户近期 Reels

```
GET /api/v1/instagram/v2/fetch_user_posts?username={handle}
```

2026-08-26 实测响应为：

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

只保留明确标成视频或 Reel 的项目。响应最多取 12 条；明确 pinned 的项目不进入绩效聚合，
但发布时间仍用于当前活跃标签。

OpenAPI 同时列有 `/api/v1/instagram/v3/get_user_posts`。2026-08-26 对公开账号
`mkbhd` 使用文档默认参数真实调用返回 **400**，响应明确说明不扣费；同一账号 V2 返回
200 与 12 条完整数据。因此当前实现以 **V2 为已验证路径**，不为了版本号更新而强用 V3。

### 参数名各版本不一致 —— 踩过的坑

| 端点 | 参数名 |
|------|--------|
| `v1/fetch_hashtag_posts` | `hashtag` |
| `v2/fetch_hashtag_posts` | **`keyword`** |
| `v3/get_hashtag_posts` | **`tag`** |
| `v2/search_users` | `keyword` |
| `v3/search_users` | **`query`** |

传错会返回 **422** 并明确指出缺哪个字段 —— 这个报错很有用，别急着改别的。

## 双平台差异速查

| | TikTok | Instagram |
|---|---|---|
| 发现主路径 | 视频搜索 `fetch_video_search_result` | **Reels 搜索 `v2/search_reels`** |
| 结果路径 | `data.search_item_list[]` | `data.data.items[]` |
| 分页 | ✅ `offset` + `has_more` | ⚠️ **我们只取一页（约 12 条）**；它收不收游标没验过，见上 |
| 关键词长度 | 2–3 词的自然短语 | **1 个词** —— 词组会返回 0 条 |
| bio 字段名 | `signature` | `biography` |
| bio 完整度 | 搜索结果里**没有**，必须补 profile | 搜索结果里也没有，同样要补 |
| 外链字段 | `bioLink.link`（单个） | `bio_links[]`（数组） |
| 粉丝数字段 | `followerCount`（驼峰） | `follower_count`（下划线） |
| 地区过滤 | ✅ `region` 参数 | ❌ 无，靠 hashtag 语言间接控制 |
| 时间过滤 | ✅ `publish_time` | ❌ 无 |

**字段命名两边不一致**（驼峰 vs 下划线），归一化时容易出错，写适配器时对着这张表核。

---

## 响应结构自动检测

TikHub 透传平台原始响应，schema 随端点和版本变化。**首次调用一个没用过的端点时，先探测结构再写解析逻辑**，不要假设：

实现见 `scripts/providers/tikhub.ts` 的 `pickList()`：

```
1. data.search_item_list      → TikTok 视频搜索
2. data.data.items            → IG v2 search_reels / search_users
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
| 200 | 成功 | 计费 |
| 402 | 余额不足 | **停止**，告诉用户去充值，不要重试 |
| 429 | 超过限速 | 退避后重试，把间隔从 150ms 调到 300ms |
| 非 200 | 各类错误 | **不计费**，可安全重试，但同一端点连续失败 3 次就停下来报告 |

同一个关键词连续多页返回空，视为该关键词耗尽，换下一个 —— 不要继续翻页浪费请求。
