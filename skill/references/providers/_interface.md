# 数据源适配接口

数据源是可替换的商品层。编排逻辑只依赖这份契约，换供应商不动 Phase 流程。

## 契约

```ts
type Platform = 'tiktok' | 'instagram'

interface Creator {
  platform:      Platform
  handle:        string        // 唯一标识，TikTok 的 uniqueId / IG 的 username
  user_id?:      string        // IG 分页需要
  nickname:      string
  followers:     number
  post_count:    number
  bio:           string
  bio_links:     string[]      // ★ 跨平台同人识别用，两边都归一化成数组
  verified:      boolean
  avatar?:       string
  profile_url:   string

  // 发现上下文
  source_keyword: string
  source_dimension: 'category' | 'scene' | 'competitor' | 'audience'

  // 内容样本 —— Phase 04 语义判断的原料
  recent_posts: Array<{
    desc:   string
    plays?: number
    likes?: number
  }>
}

// 必须实现
search(keyword: string, opts: {
  platform: Platform
  region?:  string
  page?:    number
}): Promise<Creator[]>

// 可选实现
enrich(handle: string, platform: Platform): Promise<{
  email?:              string
  email_verified?:     boolean
  audience_geo?:       Record<string, number>   // { US: 0.62, GB: 0.11, ... }
  audience_age?:       Record<string, number>
  fake_follower_score?: number
}>
```

## 规则

**`search` 必须实现。** 没有它整个 Skill 无法工作。

**`enrich` 可选（F5）。** 未配置时必须优雅降级完成主流程，不得中断：
- 跳过 Phase 05
- 主流程照常完整走完
- 邮箱退化为从 `bio` 正则提取（命中率约 46%，且未经验证）
- 受众地域信息缺失，Phase 04 的受众降权规则不生效

**不要因为缺 `enrich` 就中断，也不要反复提示用户去注册增强服务。** 提一次就够。

## 归一化要点

各家字段命名不一致，适配器负责抹平：

| 归一化字段 | TikHub / TikTok | TikHub / Instagram |
|---|---|---|
| `handle` | `uniqueId` | `username` |
| `nickname` | `nickname` | `full_name` |
| `bio` | `signature` | `biography` |
| `followers` | `followerCount` | `follower_count` |
| `post_count` | `videoCount` | `media_count` |
| `bio_links` | `[bioLink.link]` ← 包成数组 | `bio_links` ← 已是数组 |
| `user_id` | — | `pk` |

**`bio_links` 必须统一成数组**，即使源数据只有单个值。跨平台同人识别依赖这个字段，两边形状不一致会导致漏识别。

## 当前实现

| 供应商 | `search` | `enrich` | 文档 |
|---|---|---|---|
| TikHub | ✅ | ⚠️ 仅 bio 正则提邮箱 | `tikhub.md` |
| influencers.club | ✅ | ✅ | `influencers-club.md` |

## 加新供应商

1. 按上面的契约实现 `search`，能做就再实现 `enrich`
2. 在 `providers/` 下加一份文档，格式对齐 `tikhub.md`
3. 更新上面这张表

**评估新供应商时先问一个问题：它是不是注册即用？** 本 Skill 是发布给别人 clone 的，任何"发邮件申请、等审批"的数据源都不能做默认源 —— 使用者会卡在第一步。CreatorDB、Modash API、Phyllo 数据都更好，但都因此不可用作默认。
