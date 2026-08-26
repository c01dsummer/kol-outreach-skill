# 数据源适配接口

数据源应当是可替换的商品层。这份契约约束归一化形状，使新增供应商不必改写下游判断和输出；当前执行入口的接线状态见下文。

## 契约

```ts
type Platform = 'tiktok' | 'instagram'
type Dimension = 'category' | 'scene' | 'competitor' | 'audience'

interface Creator {
  platform:      Platform
  handle:        string        // 唯一标识，TikTok 的 uniqueId / IG 的 username
  user_id?:      string        // 平台侧用户 ID
  nickname:      string
  // undefined = 未查询，不得伪装成 0 或空串
  followers?:    number
  following?:    number
  post_count?:   number
  bio?:          string
  bio_links:     string[]      // ★ 跨平台同人识别用，两边都归一化成数组
  verified:      boolean
  is_private?:   boolean
  avatar?:       string
  profile_url:   string

  // 发现上下文
  source_keyword: string
  source_dimension: Dimension

  // 内容样本 —— Phase 04 语义判断的原料
  recent_posts: Array<{
    desc:   string
    plays?: number
    likes?: number
  }>

  // profile 补全或未来外部增强后填充
  // undefined = 未查询，null = 查询过但没有
  email?:               string | null
  email_verified?:      boolean
  audience_geo?:        Record<string, number>
  // fake_follower_score 仅为旧任务兼容字段；当前逻辑不读取
}

interface SearchTask {
  keyword: string
  dimension: Dimension
  platform: Platform
  as_hashtag?: boolean
}

interface SearchPage {
  creators: Partial<Creator>[]
  raw_count: number
  has_more: boolean
}

// 当前采集入口要求实现
search(task: SearchTask, region: string, offset: number): Promise<SearchPage>
profile(handle: string, platform: Platform): Promise<Partial<Creator>>

// D8：当前 TikHub 已实现；独立于关键词搜索样本
recentPosts(handle: string, platform: Platform): Promise<{
  posts: Array<{
    id: string
    views?: number
    likes?: number
    comments?: number
    shares?: number
    published_at?: string
    is_pinned?: boolean
  }>
  followers?: number
  following?: number
  source: { kind: 'public_api'; provider: string; endpoint: string }
}>
```

## 规则

**`search` 和 `profile` 必须实现。** 搜索结果通常没有完整 bio、粉丝数或发帖数；没有 profile 补全，邮箱状态和准入判断都会失真。

**`recentPosts` 是可选执行能力，不是额外供应商。** 不运行时主流程仍完整完成；
运行时只用已有 TikHub key，对 `fit=✅/⚠️` 的账号写 `enrichment.json`。
邮箱仍来自 `bio` 正则且未经验证，受众地域仍缺失。

**不要因为缺公开指标就中断，也不要提示用户去注册增强服务。**

未来第三方结果必须使用与公开指标相同的三态 `Measurement<T>`，来源
`kind='third_party'`，并先通过 `external-enrichment.md` 的准入；当前没有外部适配器。

## 归一化要点

各家字段命名不一致，适配器负责抹平：

| 归一化字段 | TikHub / TikTok | TikHub / Instagram |
|---|---|---|
| `handle` | `uniqueId` | `username` |
| `nickname` | `nickname` | `full_name` |
| `bio` | `signature` | `biography` |
| `followers` | `followerCount` | `follower_count` |
| `following` | `followingCount` | `following_count` |
| `post_count` | `videoCount` | `media_count` |
| `bio_links` | `[bioLink.link]` ← 包成数组 | `bio_links` ← 已是数组 |
| `user_id` | — | `pk` |

**`bio_links` 必须统一成数组**，即使源数据只有单个值。跨平台同人识别依赖这个字段，两边形状不一致会导致漏识别。

## 当前实现

| 供应商 | 发现与 profile 补全 | 主页近期作品 | 外部增强 | 文档 |
|---|---|---|---|
| TikHub | ✅ | ✅ | 无；当前仅从公开 bio 提取未验证邮箱 | `tikhub.md` |

当前没有第二家供应商，也没有按配置切换供应商。公开指标由 `enrich.ts` 调用 TikHub，
下游只读取归一化的 `Measurement<T>`。

## 加新供应商

1. 先通过 `external-enrichment.md` 的全部准入条件
2. 按上面的契约实现需要的能力，并保留来源、时间、样本量与不可用原因
3. 把适配器接入对应入口，并用真实样本逐字段核实
4. 在 `providers/` 下加供应商文档并更新上面的状态表

**评估新供应商时先问一个问题：普通个人邮箱能不能注册即用？** 本 Skill 是发布给别人 clone 的，任何要求公司邮箱、公司地址、发邮件申请或等待审批的数据源都不能做默认源。
