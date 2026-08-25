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
data.userInfo.user.videoCount
data.userInfo.user.verified
data.userInfo.user.bioLink.link     // ★ 跨平台同人识别信号
data.userInfo.user.avatarMedium
```

`bioLink.link` 常指向 Instagram/Linktree —— 这是识别同一个人在两个平台账号最可靠的信号，务必抓取。

### 备选

| 端点 | 何时用 |
|------|--------|
| `/api/v1/tiktok/app/v3/fetch_user_search_result` | 视频搜索无结果时的兜底。商家号多但字段完整 |
| `/api/v1/tiktok/web/fetch_search_user` | 另一个数据源，`fetch_user_search_result` 结果少时试 |
| `/api/v1/tiktok/app/v3/fetch_hashtag_search_result` | 需要按话题而非关键词发现时 |

---

## Instagram

IG 的发现路径和 TikTok 不同 —— **hashtag 是主路径**，因为 IG 的关键词搜索更偏账号名匹配。

### 发现：Hashtag 帖子

```
GET /api/v1/instagram/v1/fetch_hashtag_posts
```

| 参数 | 说明 |
|------|------|
| `hashtag` | 话题名，**不含 `#`** |
| `end_cursor` | 分页游标，首次不传 |

响应是 **GraphQL 风格**：`data.hashtag.edge_hashtag_to_media`。和 TikTok 的结构完全不同，解析要分开写。

### 发现：关键词搜索

```
GET /api/v1/instagram/v1/fetch_search?query={kw}&select=users
```

`select` 可选 `users` / `hashtags` / `places`，不传则返回全部。

**两个用法**：
- `select=users` 直接搜账号（商家号偏多，作为补充）
- `select=hashtags` 先搜出相关话题，再喂给 `fetch_hashtag_posts` —— 这条路比自己猜 hashtag 靠谱

### 补全：用户 Profile

```
GET /api/v1/instagram/v1/fetch_user_info_by_username_v3?username={handle}
```

V3 返回字段最全，官方描述里明确包含：

```
pk / id            用户 ID
username
full_name
biography          ★ 邮箱在这里
bio_links[]        ★ 跨平台同人识别信号（列表，不是单个）
follower_count
following_count
media_count
```

注意 IG 是 `bio_links`（**数组**），TikTok 是 `bioLink.link`（**单个对象**）。两边都要处理。

其他版本：`fetch_user_info_by_username`（V1）、`_v2`、以及 `/api/v1/instagram/v2/fetch_user_info`（username 或 user_id 二选一）。**V2 系列是 TikHub 推荐的稳定默认，V3 用于需要最新数据的场景。** V3 拿不到时降级到 V2。

### 帖子列表

```
GET /api/v1/instagram/v1/fetch_user_posts?user_id={id}&count=12
```

分页用 `max_id`。注意这里要 **user_id 不是 username** —— 先从 profile 拿到 `pk`。

---

## 双平台差异速查

| | TikTok | Instagram |
|---|---|---|
| 发现主路径 | 视频搜索 `fetch_video_search_result` | Hashtag `fetch_hashtag_posts` |
| 响应结构 | 扁平列表 | GraphQL 风格嵌套 |
| bio 字段名 | `signature` | `biography` |
| bio 完整度 | 搜索结果中常为空，**必须补 profile** | 相对完整，但仍建议补 V3 |
| 外链字段 | `bioLink.link`（单个） | `bio_links[]`（数组） |
| 粉丝数字段 | `followerCount`（驼峰） | `follower_count`（下划线） |
| 地区过滤 | ✅ `region` 参数 | ❌ 无，靠 hashtag 语言间接控制 |
| 时间过滤 | ✅ `publish_time` | ❌ 无 |

**字段命名两边不一致**（驼峰 vs 下划线），归一化时容易出错，写适配器时对着这张表核。

---

## 响应结构自动检测

TikHub 透传平台原始响应，schema 随端点和版本变化。**首次调用一个没用过的端点时，先探测结构再写解析逻辑**，不要假设：

```
1. data.user_list 是数组      → user 类型
2. data.users 是数组          → user 类型
3. data.aweme_list 是数组     → post 类型，从 .author 提取
4. data.hashtag.edge_hashtag_to_media → IG hashtag，GraphQL 风格
5. data.data 是数组           → 检查首条:
     有 unique_id / uniqueId / username → user
     有 aweme_id / video_id / pk        → post
6. 都不匹配 → 打印 data 的顶层 key，告诉用户实际结构，不要硬猜
```

---

## 错误处理

| 状态码 | 含义 | 处理 |
|--------|------|------|
| 200 | 成功 | 计费 |
| 402 | 余额不足 | **停止**，告诉用户去充值，不要重试 |
| 429 | 超过限速 | 退避后重试，把间隔从 150ms 调到 300ms |
| 非 200 | 各类错误 | **不计费**，可安全重试，但同一端点连续失败 3 次就停下来报告 |

同一个关键词连续多页返回空，视为该关键词耗尽，换下一个 —— 不要继续翻页浪费请求。
