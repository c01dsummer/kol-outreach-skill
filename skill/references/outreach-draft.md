# 英文开发信草稿

Phase 06 用。**只给 A 级候选写** —— B/C 级还没到发信阶段。

## 为什么这一步值得做

群发模板回复率通常 <2%，有针对性的第一句能到两位数。差距全在**你是否真的看过他的内容**。

而你在 Phase 04 已经读过了。不用这个信息是纯浪费 —— 这是整个 Skill 最后一公里的价值所在。

---

## 结构

四段，控制在 120 词以内。运营会自己改，你给的是能直接用的骨架。

```
1. 具体的一句话，证明你看过他的内容        ← 最重要
2. 你是谁 + 产品一句话                      ← 简短
3. 明确的合作提议                           ← 具体，不要"探讨合作可能"
4. 低门槛的下一步                           ← 让回复只需要一个词
```

## 模板

```
Subject: {具体到内容的钩子}

Hi {nickname 或 first name},

{第一句：引用他某条具体内容，说清你看到了什么、为什么想到他}

I'm {name} from {brand} — we make {产品一句话，带一个具体差异点}.

{提议：寄样测评 / 付费合作 / 联盟分成，说清能给什么}

{下一步：一个只需回一个词就能推进的问题}

Best,
{name}
```

## 好例子

```
Subject: Your 3-ingredient smoothie series

Hi Mei,

Your 3-ingredient smoothie series is the only one I've seen that
actually shows the cleanup — that's the part everyone skips and
it's exactly why people don't stick with it.

I'm Yu from Brightly. We make a 400ml portable blender that rinses
in about ten seconds, which felt relevant to that exact point.

Happy to send one over, no strings — if it doesn't fit your kitchen,
no post needed. If it does, we'd love to talk about a paid piece.

Want me to ship one? Just need an address.

Best,
Yu
```

第一句为什么好：**具体到只可能是看过那条内容的人才写得出来**，而且指出了一个他自己可能没意识到的优点。这比 "I love your content!" 强一个量级。

## 坏例子

```
❌ Hi there, I came across your profile and love your content!
   → 群发感，"your profile" 说明你没看内容

❌ Your content aligns perfectly with our brand values.
   → 套话，任何品牌对任何博主都能说

❌ We'd like to explore potential collaboration opportunities.
   → 没有具体提议，对方不知道该回什么

❌ Dear Influencer,
   → 直接进垃圾箱
```

---

## 硬规则

**只写英语。** 首版不做多语言 —— 判断母语容易出错，非英语文案写得生硬比写英语更伤，日语敬语这类文化规约风险更高。

**第一句必须引用具体内容。** 从 `recent_posts[].desc` 里挑一条最能说明他内容方向的，具体到标题、做法、观点。写不出具体的第一句，说明 Phase 04 的语义判断做得不够 —— 回去补，不要用套话糊过去。

**称呼用 `nickname` 里的名字部分**，不是 handle。`@techwithsarah` → `Sarah`。取不出人名就用 handle，但别用 "there" 或 "Influencer"。

**提议要具体。** 说清是寄样、付费、还是分成。"探讨合作可能"等于没说。

**不要替用户承诺报价。** 你不知道预算。写"we'd love to talk about a paid piece"这种留口子的说法，具体数字让运营自己填。

**不要编造品牌信息。** 产品描述只能用 Phase 01 从商品页读到的真实内容。不知道的留占位符 `{...}` 让用户填，比编一个好。

---

## 输出方式

每个 A 级候选一封，放在 CSV 的 `outreach_draft` 列，同时在 HTML 报告里以可复制的块呈现。

CSV 里换行要正确转义（字段用引号包裹，内部换行保留），确保 Excel/Numbers 打开时格式不乱。
