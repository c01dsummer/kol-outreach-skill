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

  // profile 补全或未来增强后填充
  // undefined = 未查询，null = 查询过但没有
  email?:               string | null
  email_verified?:      boolean
  audience_geo?:        Record<string, number>
  fake_follower_score?: number
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

// 未来可选实现；当前入口尚未调用
enrich(handle: string, platform: Platform): Promise<{
  email?:              string | null
  email_verified?:     boolean
  audience_geo?:       Record<string, number>   // { US: 0.62, GB: 0.11, ... }
  fake_follower_score?: number
}>
```

## 规则

**`search` 和 `profile` 必须实现。** 搜索结果通常没有完整 bio、粉丝数或发帖数；没有 profile 补全，邮箱状态和准入判断都会失真。

**`enrich` 是未来可选能力。** 接入后，未配置时仍必须让主流程完整运行：
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

| 供应商 | 发现与 profile 补全 | 外部增强 | 文档 |
|---|---|---|---|
| TikHub | ✅ | 未提供；当前仅从公开 bio 提取未验证邮箱 | `tikhub.md` |
| influencers.club | 尚未接入 | 尚未接入 | `influencers-club.md` |

当前 `probe.ts` 与 `collect.ts` 直接实例化 TikHub，尚未实现按配置切换供应商。上面的契约已经约束了归一化数据形状，但新增供应商仍需实现适配器并接入执行入口；不能只改一个配置项就生效。

## 加新供应商

1. 按上面的契约实现 `search` 与 `profile`，能做就再实现 `enrich`
2. 把适配器接入 `probe.ts` 与 `collect.ts` 的供应商选择
3. 在 `providers/` 下加一份文档，格式对齐 `tikhub.md`
4. 更新上面这张表

**评估新供应商时先问一个问题：它是不是注册即用？** 本 Skill 是发布给别人 clone 的，任何"发邮件申请、等审批"的数据源都不能做默认源 —— 使用者会卡在第一步。CreatorDB、Modash API、Phyllo 数据都更好，但都因此不可用作默认。
