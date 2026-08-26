# 公开指标与受众质量风险

> 相关需求：**D8** 主页近期样本与三态测量 · **D9** 报价口径 · **F8** 风险降级 · **U7** 交付溯源

语义筛选完成后、生成名单前使用。它回答的是“这个账号近期公开表现是否值得继续投入”，
不是“有多少假粉”，更不能回答“实际能卖多少货”。

## 执行

只处理 `fit=✅/⚠️` 的幸存者：

```bash
npm run enrich -- --dir output/xxx
```

预算不够时会保存 `enrichment.json` 并以退出码 3 结束。用户明确追加的是**总预算**：

```bash
npm run enrich -- --dir output/xxx --budget 3
```

默认跳过已经查询过的账号。只有用户确实要刷新数据时才加 `--refresh`；它会重新计费。

## 样本边界

- TikTok 与 Instagram 分开计算，不把两个平台的粉丝和播放量混在一起
- 取主页最近 12 条短视频/Reels，不复用关键词搜索命中的帖子
- 明确标记为 pinned 的帖子排除；源数据没给 pinned 状态时不猜
- 每项指标至少需要 6 条具备所需字段的帖子
- 缺点赞、评论、播放或粉丝数时，该条退出对应公式，不按 0 补

`enrichment.json` 的三态：字段不存在 = 未查询；`unavailable` = 查询过但没有资格回答；
`measured` = 有值，并带来源、时间、样本数和公式。

## 指标

| 指标 | 公式 | 用途 |
|---|---|---|
| 粉丝互动率 | `median((likes + comments) / followers)` | 粉丝规模对应的公开互动能力 |
| 播放互动率 | `median((likes + comments) / views)` | 内容触达后的互动深度 |
| 中位播放量 | `median(views)` | 抗单条爆款干扰的典型触达 |
| 中位互动量 | `median(likes + comments)` | 报价存在时计算隐含 eCPE |
| 播粉比 | `median(views / followers)` | 粉丝规模能否转成实际触达 |
| 关注/粉丝比 | `following / followers` | 同行异常筛查信号，不单独解释成质量结论 |
| 触达稳定度 | `P25(views) / median(views)` | 常规作品是否稳定，而非只靠一条爆款 |
| 发布间隔 | 相邻发布时间间隔天数的中位数 | 活跃与产能 |

## 受众质量风险

这是**任务内同行异常筛查**：被评账号不进入自己的基线；同平台、同粉丝档至少有
8 个其他可比较账号才计算。同档不足就写 `unknown`，不跨规模档拼接。

粉丝档固定为 `5k–<25k`、`25k–<100k`、`100k–<500k`、`500k–<1m`、
`1m–5m`；名单本身已排除这个范围之外的账号。

三个公开信号：

- 粉丝互动率 < 同行 P10
- 播粉比 < 同行 P10
- 关注/粉丝比 > 同行 P90

至少两个信号才是 `high`，一个是 `medium`，零个是 `low`；少于两个可比较指标是
`unknown`。等于阈值不报警；即使同行数值并列，真正低于/高于该基线的账号仍会触发信号。

`high` 只让**当前平台**降一级进入人工复核，永不自动删除；关联平台只展示自己的指标。
输出必须保留触发了哪些信号，不能只给风险标签。

## 合作报价

合作报价不是互动率，也不能从粉丝数自动猜。只有用户提供创作者报价或公开 rate card 时，
才在 `enrichment.json` 对应账号写 `collaboration_quote`：金额、币种、平台、内容形式、
数量、来源、时间缺一不可。

它本身也使用三态包装；不要把裸报价对象直接塞进去：

```json
{
  "status": "measured",
  "value": {
    "amount": 500,
    "currency": "USD",
    "platform": "tiktok",
    "format": "tiktok_video",
    "quantity": 2,
    "source": "creator_quote",
    "observed_at": "2026-08-26T10:00:00.000Z"
  },
  "source": { "kind": "manual", "provider": "operator" },
  "observed_at": "2026-08-26T10:00:00.000Z",
  "sample_size": 1,
  "basis": "creator quote for two TikTok videos"
}
```

未拿到报价时整个字段不存在，不能写 `amount: 0`。

同平台同形式报价可计算：

```text
隐含 eCPM = 单条报价 / 中位播放量 × 1000
隐含 eCPE = 单条报价 / 中位互动量
```

混合套餐、缺报价、缺分母一律显示不可计算。不同币种不自动换算。
当前公开样本是短视频，因此只有 `tiktok_video` 对 TikTok、`instagram_reel` 对 Instagram
能进入公式；`instagram_post` 与 `mixed_bundle` 可以记录，但不能套用 Reels/视频表现。

## 怎么向用户解释

高风险不等于假粉多，更不等于带货差。它只表示公开触达和互动相对同行存在多个异常，
应先人工检查评论质量、内容形式和合作平台，再决定是否联系。

真实带货效果需要订单、GMV、点击、转化、退款和实际投放成本；本仓库不做效果归因，
也不主动要求用户回填这些数据。
