# 输出格式

Phase 06 用。

## 文件

```
output/
├── kol-{product}-{YYYYMMDDHHmm}.csv         名单
├── kol-{product}-{YYYYMMDDHHmm}.html        可读报告
└── kol-{product}-{YYYYMMDDHHmm}.meta.json   本次任务元数据
```

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

## HTML 报告

单文件，内联所有样式，不依赖网络 —— 运营要发给同事、要存档。

需要包含：

- 顶部统计：总人数、A/B/C 分布、有邮箱比例、跨平台人数、实际花费
- 关键词表现：每个词找到多少人、语义命中率多少 —— **这是下次调整策略的依据**
- 名单卡片：按层级分组，A 级展开显示开发信草稿并**可一键复制**
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
  "filtered_by_memory": 23,
  "requests": 412,
  "cost_estimate_usd": 0.412,
  "budget_usd": 2.0,
  "enriched": false
}
```

`keywords[].fit_pass` 记的是语义判断通过数 —— 跨任务累积后能看出哪些维度对这个品类真正有效。

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
```

**数据边界必须说。** 让用户知道名单的局限在哪，比让他以为数据很完整强 —— 后者会导致他把预算压在错误的假设上。
