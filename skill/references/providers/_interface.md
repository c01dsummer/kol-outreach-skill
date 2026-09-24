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
  discovery_sources?: Array<{
    platform: Platform
    handle: string
    keyword: string
    dimension: Dimension
    endpoint: '/api/v1/tiktok/app/v3/fetch_video_search_result'
      | '/api/v1/instagram/v2/search_reels' | '/api/v1/instagram/v2/search_users'
      | '/api/v1/instagram/v2/fetch_hashtag_posts'   // 只在任务写了 ig_route: "hashtag" 时（D15.k）
  }> // D15：实际返回该账号的路径；缺席或空数组表示来源未知

  // 内容样本 —— Phase 04 语义判断的原料。搜索命中的那几条作品。
  // 缺席 = 没问过（按账号名搜人的路径拿不到作品）；有就非空。**不要写空数组** ——
  // 它读起来是「问过了，他没作品」，而我们其实没问过（P1.e，ADR-102）
  recent_posts?: Array<{
    id?:    string  // D11：平台:原始作品 id；缺失不填占位，不使用用户或文案 id
    desc:   string  // 空串也可能是来源字段未取到，当前无法与作者未写区分（ADR-102）
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
  as_hashtag?: boolean  // 配置元数据；当前 TikHub 不据此切换端点，不证明实际发现路径
  ig_route?: 'hashtag'  // IG 发现路线，只由运营显式写；缺席走 Reels。不合规时入口以退出码 2 拒绝（D15.j）
}

interface SearchPage {
  creators: Partial<Creator>[]
  raw_count: number
  has_more: boolean
  next_token?: string   // IG 续页令牌：Reels 响应的 data.pagination_token；缺席 = 这次没给（ADR-111）
}

// 当前采集入口要求实现。token 是上一页交回的 IG 续页令牌，可选；采集入口只在同一次运行内传它（ADR-111）
// ig_route 为 hashtag 的 IG 任务在这里最前面分派到话题页，只取首页、不走兜底（D15.k、D6.w）；probe 与 collect 共用
search(task: SearchTask, region: string, offset: number, token?: string): Promise<SearchPage>
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
| `recent_posts[].id` | `tiktok:` + 搜索作品 `aweme_info.aweme_id` | `instagram:` + Reels 或话题页（`ig_route: "hashtag"`）item 直接 `id` |

**`bio_links` 必须统一成数组**，即使源数据只有单个值。跨平台同人识别依赖这个字段，两边形状不一致会导致漏识别。

## 搜索作品并集（D11）

实际发现来源按 D15、ADR-110 独立保存：来源五字段稳定去重，账号及平台大小写不敏感，其余保持原值；合页旧记录在先，同人合并主记录在先。profile 不补来源，任务标签不证明路径。已观察集合可能不含完整历史，不对应具体作品或请求次数；Agent 不补写。probe 原样透传，旧缺席仍缺席。

`recent_posts[].id` 是作品键，不是创作者身份键。外部原始 id 只有非空白字符串或
安全整数可用：字符串用 `trim()` 仅判断是否为空白，保存时保留原值；安全整数转十进制
字符串后加平台前缀。缺键、null、空白、对象或不安全数字均不生成 id。

搜索合页从首次收页起取稳定并集：依次保留先到、后到作品，同一个有效键只留第一次记录，
不以新文案或指标覆盖它；不同平台即使原始 id 相同也不合并。缺失或空白 id 的记录逐条
保留，包括旧任务样本及相同文案；有非空白字符串 id 时按其原值去重，不擅自 trim 改键。
跨平台同人合并使用同样规则，顺序为主记录作品、关联记录作品，主记录选择不变。

合并不修改输入作品数组或内容。后页没带作品不擦除已有证据；两侧都缺席或为空数组时
仍返回未查询，不写出「确认无作品」。这一规则只用于搜索证据，不改变独立 `recentPosts`
能力产出的主页绩效样本契约，也不参与同人识别、评分或分层（ADR-105）。

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
