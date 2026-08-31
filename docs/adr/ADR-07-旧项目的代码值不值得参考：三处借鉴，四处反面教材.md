# ADR-07 旧项目的代码值不值得参考：三处借鉴，四处反面教材

- 2026-08-26 · 用户问 `tikhub-kol-sourcing` 的实现值不值得参考
- 类型：**发现更优解**（部分）
- 触发它的事实：对照读 `scrape-powerbank.ts`
- 结论：**采纳三处，其余不取**
- **借鉴的**：
  - `offset += items.length` —— 见 ADR-06，我们这边是真 bug
  - `if (!data?.data?.has_more) break` —— 用 API 自己的信号判断分页终止
  - profile 补全单个失败不中断
- **不取的（旧代码的问题）**：
  - `Number(a.follower_count || 0)` / `String(a.signature || '')` —— 正是 P1 禁的形状
  - `if (followers < FOLLOWER_MIN) continue` 在**采集阶段**就按粉丝数丢人。
    而 `follower_count` 缺失时是 0，于是**所有没返回粉丝数的创作者被静默丢弃**。
    这是 P1 那条红线最好的反面实证
  - 空 `catch (e) {}` 吞掉错误 —— 「补全失败」与「补全了但没 bio」分不清
  - 用 `app/v3/handler_user_profile` 补 profile，然后读 `user.bioLink?.link` ——
    **该端点没有 `bioLink` 字段**，那行是死代码，`bio_link` 恒为 null。
    跨平台同人识别最可靠的信号，在旧版里从未生效过
- 教训：**一份能跑出结果的代码，不等于它做的事和你以为的一样。**
  旧项目跑了很多轮、产出过真实名单，但其中一整个字段是死的、一整类创作者被静默丢弃 ——
  两者都不会报错，也不会在产出物里显形。
  这正是本项目把「未查询 vs 查过没有」做成红线并配变异测试的原因。
