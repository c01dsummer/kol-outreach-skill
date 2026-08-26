# 跨任务记忆与跨平台同人识别

## 为什么需要

跨关键词、跨产品、跨时间，同一个博主会反复出现。重复推荐浪费用户时间，重复发信显得不专业。

前一版只记录"每次运行批次"，不记录人 —— 这是个真实缺口。

---

## 文件

`memory/creators.json`，单文件，本地。**不做多人共享** —— 单人使用足够，团队场景需要另行设计。

```json
{
  "version": 1,
  "updated_at": "2026-08-25T14:30:00Z",
  "creators": {
    "tiktok:techwithsarah": {
      "platform": "tiktok",
      "handle": "techwithsarah",
      "nickname": "Sarah | Tech Reviews",
      "followers": 82000,
      "first_seen": "2026-08-25",
      "linked_to": "instagram:techwithsarah",

      "recommendations": [
        {
          "date": "2026-08-25",
          "product": "anker-powerbank",
          "keyword": "anker power bank",
          "task": "anker-powerbank-202608251430",
          "tier": "A",
          "fit_reason": "数码测评方向，最近在测氮化镓充电头"
        }
      ],

      "contacted": false,
      "replied": false,
      "blocked": false,
      "note": ""
    }
  }
}
```

主键格式：`{platform}:{handle}`。

---

## 规则

**任务开始时先读**，任务结束时写回。文件不存在就创建，**不要因为读不到就中断**。

| 状态 | 处理 |
|------|------|
| 已推荐过（`recommendations` 非空） | **默认不进新名单** |
| 推荐记录来自**同一个任务**（`task` 相同） | **不过滤**。续跑要推荐的就是这批人；滤掉会让 render 之后的每次 `--resume` 都产出空名单 |
| 换了产品且契合度更高 | 可以再推，但必须标注「曾为 {product} 推荐过（{date}）」，让用户自己判断 |
| `contacted: true` | 排除 |
| `blocked: true` | 排除，且不再出现在任何名单 |

交付时给用户一行统计：

```
本次发现 187 人，其中 23 人此前推荐过已过滤，2 人已标记联系过。
```

## 关于 `contacted`

**Skill 不发信，因此只能知道"推荐过"，无法知道"联系过"。**

`contacted` / `replied` / `blocked` 是**用户手动标记位**：

- 直接改 JSON
- 或者跟你说一声，由你写入（"@techwithsarah 已经联系过了" → 标记）

**不要主动追问上批结果。** 让运营回填数据这件事历史成功率极低，追问只会在每次任务开头插入一段用户想跳过的对话。

---

## 跨平台同人识别

做双平台之后新增。同一个人在 TikTok 和 IG 都有号，**价值高于任一单平台账号** —— 触达更广，且愿意跨平台经营的创作者通常更认真对待商务合作。评分里给 +15。

### 识别信号（按可靠度排序）

**1. bio 外链互指 —— 最可靠**

```
TikTok  data.userInfo.user.bioLink.link  →  含 instagram.com/{handle}
IG      bio_links[].url                  →  含 tiktok.com/@{handle}
```

Linktree / beacons.ai 这类聚合页也算 —— 但要真去看页面内容才能确认，成本较高，可以只在其他信号也吻合时才验证。

**2. handle 完全相同或高度相似**

```
tiktok:techwithsarah  ↔  instagram:techwithsarah      完全相同，强信号
tiktok:sarah.tech     ↔  instagram:sarahtech          去标点后相同，较强
tiktok:sarahtech      ↔  instagram:sarah_tech_real    相似但不确定，弱
```

**3. 昵称 + 头像同时接近 —— 最弱**

单独出现时不足以判定。只作为前两条的佐证。

### 合并规则

满足信号 1，或信号 2 的强档，才合并。

合并后：
- 按"人"而非"账号"计入名单，避免同一个人占两个名额
- `followers` 取两平台之和
- 输出标注 `cross_platform: true`，并在 CSV 里列出两个 handle
- 记忆里双向写 `linked_to`

**不确定时不合并。** 错误合并两个人的代价（发错信、张冠李戴）比漏合并同一个人（多推荐一次）大得多。

不确定但有嫌疑时，在 `note` 里记一句"疑似与 instagram:xxx 为同一人"，留给下次或用户判断。
