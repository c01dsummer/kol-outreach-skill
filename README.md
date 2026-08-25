# kol-outreach-skill

海外 KOL 建联 Agent Skill —— 第二版重做。

**当前状态：已用真实 API 跑通完整流程（TikTok + Instagram 双平台）。**

> 开工前先读 **[AGENTS.md](AGENTS.md)** —— 本仓库约定的正本。

## 这是什么

一个 AI Agent Skill。运营用自然语言说自己卖什么，Agent 完成从产品理解到可发信名单的全过程，产出带**个性化开发信草稿**的分层名单。

与前一版（`tikhub-kol-sourcing`）的根本区别：

> 护城河是判断力，不是数据获取能力。

任何人都能包一层采集 API，SaaS 在筛选导出上做得比我们好。Agent 唯一不可替代的是语义判断 —— 读懂产品、推导搜索策略、判断内容调性是否匹配、写出有针对性的第一封信。复杂度必须集中在这四件事上。

## 文档

| 文档 | 内容 |
|------|------|
| **[AGENTS.md](AGENTS.md)** | **约定正本**，开工前先读。两层文档的路由 |
| [docs/SPEC.md](docs/SPEC.md) | 需求唯一来源 · 5 条红线 · 28 条编号需求 |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | 在本项目里**反着**的通用做法 |
| [DECISIONS.md](DECISIONS.md) | 决策记录 ADR |
| [docs/SYNC.md](docs/SYNC.md) | 文档同步表 |
| [业务需求](docs/business-requirements.md) | 背景、痛点排序、成功指标、论证过程 |
| [数据源策略](docs/data-source-strategy.md) | 各家 API 对比、选型结论、官方 API 为何不可用 |
| [SKILL.md](skill/SKILL.md) | Skill 主定义 —— 触发条件、六阶段流程、成本闸门 |

## Skill 结构

```
skill/
├── SKILL.md
└── references/
    ├── product-intake.md        产品理解、品类关键词倾向
    ├── keyword-strategy.md      四维关键词、分平台出词、试探判读
    ├── semantic-fit.md          ★ 语义契合判断、评分、A/B/C 分层
    ├── outreach-draft.md        ★ 英文开发信写法
    ├── memory.md                跨任务记忆、跨平台同人识别
    ├── output-format.md         CSV 列、HTML 报告、meta.json
    └── providers/
        ├── _interface.md        适配接口契约
        ├── tikhub.md            默认源（端点已核实）
        └── influencers-club.md  可选增强层
```

★ 标记的两个是这个 Skill 值得被 clone 的理由 —— 其余部分任何人包一层 API 都能做。

## 关键决策速览

- **默认数据源 TikHub** —— 不因为数据最好，而因为唯一同时满足即时注册 + 同步返回 + 便宜到能让 Agent 试错
- **零配置必须跑通** —— 这是发布给别人用的 Skill，任何"再注册一个服务"的要求都会劝退
- **增强层可选且优雅降级** —— 邮箱验证和受众画像只对入围者做，缺配置就跳过
- **首发 TikTok + Instagram** —— 含跨平台同人识别
- **记忆存本地 JSON** —— 单人使用，不做多人共享
- **开发信仅英语** —— 目标市场默认英语区
- **不发信、不回访** —— 产出草稿，发信交给用户现有工具；不向用户索要效果回填

## 相比前一版的主要增量

1. **试探验证循环** —— 小样采集后让用户确认方向，再放量。避免整轮返工
2. **语义筛选取代静态评分表** —— 输出理由而非分数
3. **开发信草稿** —— 用上筛选阶段已经读过的内容
4. **跨任务创作者记忆** —— 推荐过的人不再重复出现；已联系状态由用户手动标记
5. **数据源适配层** —— 换供应商不动编排逻辑
6. **去掉"确认接口"环节** —— 实现细节不该暴露给非技术用户

## 脚本

```bash
npm install
cp .env.example .env      # 填入 TIKHUB_API_KEY

npm run check             # 完整检查链，不消耗 API
npm test                  # 只跑需求测试
```

`npm run check` = 纪律 lint → SPEC 一致性 → 类型检查 → 需求测试 →
变异测试 → 脚本自检 → 链路审计。CI 跑的是同一条链。

三个入口，Agent 按 Phase 调用：

```bash
# Phase 02 — 小样试探，每词每平台 1 页
npx tsx scripts/probe.ts --config probe.json

# Phase 03 — 规模采集（可断点续跑）
npx tsx scripts/collect.ts --config task.json
npx tsx scripts/collect.ts --resume output/xxx --budget 3   # 预算用尽后追加续跑

# Phase 06 — 算分、分层、CSV + HTML + 写回记忆
npx tsx scripts/render.ts --dir output/xxx
```

三个脚本都把结构化结果打到 **stdout（JSON）**、进度打到 **stderr**，方便 Agent 解析。

`collect.ts` 预算用尽时以**退出码 3** 结束并保存断点 —— Agent 据此询问用户是否追加预算，续跑不会重复已完成的关键词，也不会重复计费。

### 目录

```
scripts/
├── lib/
│   ├── types.ts      Creator / TaskState 等
│   ├── budget.ts     请求计数、阈值提醒、跨运行累加
│   ├── task.ts       任务状态读写（断点续跑的基础）
│   ├── email.ts      bio 邮箱提取（含 (at)/(dot) 等反爬写法）
│   ├── identity.ts   跨平台同人识别与合并
│   ├── memory.ts     跨任务记忆
│   ├── score.ts      硬指标计分、分层、受众降权
│   ├── rows.ts       CSV/xlsx 列定义、排序、分层分 sheet
│   ├── csv.ts        UTF-8 BOM + 转义
│   ├── xlsx.ts       最小 XLSX 写出器（多 sheet，零依赖）
│   └── report.ts     HTML 报告
├── providers/
│   └── tikhub.ts     默认数据源（响应结构探测 cascade）
├── check/            检查链
│   ├── lint.ts       纪律 lint（P1 兜底写法）
│   ├── spec-sync.ts  SPEC.md ← requirements.json 生成与校验
│   ├── mutate.ts     变异测试
│   ├── mutations.json
│   ├── fake-fetch.ts 罐头响应（结构取自真实调用）
│   ├── selfcheck.ts  脚本自检（未执行的路径）
│   └── audit.ts      链路审计
├── probe.ts / collect.ts / render.ts
└── test.ts
```

### 一次任务的产出

```
output/{product}-{时间戳}/
├── kol.csv        单表名单 —— 给脚本和其他工具读
├── kol.xlsx       按 A/B/C 分 sheet —— 给人看
├── report.html    可读报告（分层 tab + 开发信草稿一键复制）
├── creators.json  完整数据
├── task.json      采集状态（断点续跑用）
└── meta.json      任务元数据
```
