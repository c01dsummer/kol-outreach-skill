# ADR-08 采集累加器与交付物拆成两个文件；记忆过滤按任务作用域

- 日期 · 2026-08-26 · 代码复查环节
- 类型：**事实证伪**（两处实现与 D6/P1 的假设矛盾）
- 冲击的需求：D6（断点续跑）、P1（三态）
- 结论：**采纳，两处都改**

### 触发它的事实

复查时实跑 `collect → render → collect --resume`，`creators.json` 从 4 人变成 **0 人**：

```
1) collect          → creators.json 4 人
2) render           → memory 写入 4 条
3) collect --resume → collected: 0, filtered_recommended: 4
   creators.json 剩 0 人
```

`collect.ts` 结尾把过滤后的名单写回 `creators.json`，而 `--resume` 开头又从**同一个文件**
读回。`render.ts` 的 `recordRecommendations` 把这批人按当前 product 记进记忆之后，
续跑时 `filterByMemory` 判定「本产品已推荐过」，全部滤掉，然后把空数组写回去。
**已经付费采集的数据不可恢复地消失。**

触发路径不冷门：用户看完报告说「人不够，再多找点」，Agent 就会去跑 `--resume`。
而 `skill/SKILL.md` 当时根本没写 `--resume` 的具体命令。

第二处：`identity.ts` 的 `primary.email = primary.email ?? secondary.email ?? null`
把两侧都 undefined（未查询）的情况写成 null（查过，没有）。同一个函数里紧挨着的 `sum()`
对 followers 处理得完全正确 —— 漏的只是 email 这一行。

### 连带改动

| 文件 | 改了什么 |
|---|---|
| `scripts/lib/task.ts` | 新增 `creators.raw.json` 累加器（只增不减）+ `taskId()` |
| `scripts/collect.ts` | `--resume` 读累加器；过滤只作用于交付物 |
| `scripts/lib/memory.ts` | `filterByMemory` / `recordRecommendations` 增加 task 作用域；同任务重复 render 覆盖而非追加 |
| `scripts/lib/identity.ts` | 抽出 `mergeEmail()`，三态与 `sum()` 对齐 |
| `scripts/check/lint.ts` | `FALLBACK` 加入 `null` |
| `scripts/check/audit.ts` | 删掉让入口自检判据失效的 `includes(base)` 兜底 |
| 测试 | 新增 `[P1] 跨平台合并…`、`[D6] 续跑不得被自己上一轮滤空` |
| 变异 | `M-P1-f`、`M-D6-b` |
| 自检 | 新增 `collect → render → --resume` 端到端回归 |
| 文档 | D6 验收补充；SKILL.md 补 `--resume` 命令；memory.md 补 task 字段 |

### 教训

**这两个 bug 全部通过了 lint / 类型 / 20 个变异 / 自检 / 审计。** 原因各不相同，
但指向同一件事：

1. **`null` 是三态模型的中间态，却是唯一没被 lint 盯住的兜底值。**
   `FALLBACK` 白名单列了 `0 / '' / [] / false`，偏偏漏了那个语义最接近红线的。
   检查表里最该出现的一项，往往因为「它看起来不像默认值」而被漏掉。

2. **数据丢失发生在文件的职责重叠处，不在任何一个函数内部。**
   `filterByMemory` 是对的，`saveCreators` 是对的，`loadCreators` 也是对的 ——
   错的是让同一个文件既当输入又当输出。**单元测试永远看不到这类 bug**，
   因为它不在任何一个单元里。这是 ADR-06 那条教训的另一个面：
   「每个部件都正确」和「组装起来正确」是两个命题。

3. **同一个坑第四次。** ADR 里已经记过两次「逻辑埋在入口脚本里就测不了，
   要抽到 `lib/`」（M-P2-a、M-U5-a 存活），于是有了 `rows.ts`。
   但 `collect.ts` 的 `main()` 仍是裸的流水线：合并 → 闸门 → 记忆过滤 → 落盘，
   而 bug 正好落在这段。**教训被记下来了，却没有被应用到最大的那个入口。**
   记录一条教训的成本远低于执行它 —— 下次复查先看还有哪些 `main()` 没被拆。
