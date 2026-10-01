# kol-outreach-skill

面向海外市场的 KOL 搜索与建联 Agent Skill，支持 TikTok 和 Instagram。

运营只需说明产品、目标市场、API 预算和目标人数，Agent 就能完成从产品理解到可发信名单的全过程，交付带语义匹配理由和个性化英文开发信草稿的分层名单。

**当前状态：历史真实调用曾跑通当时采用的 TikTok + Instagram 发现、资料补全与主页作品链路；其他端点、字段覆盖与媒体类型仍按各自证据说明。**

> 参与开发前请先读 [AGENTS.md](AGENTS.md)，它是本仓库约定的正本。

## 项目定位

这不是一个单纯的采集工具，也不是 KOL SaaS 的命令行版本。它解决的是运营真正需要判断的三个问题：

1. 应该找谁？
2. 为什么这个创作者适合当前产品？
3. 第一封建联邮件应该怎么写？

仓库的设计原则是：

> 护城河是判断力，不是数据获取能力。

API 负责提供候选数据，Agent 负责读懂产品、推导搜索策略、判断创作者内容是否匹配，以及写出有针对性的第一封邮件。

## 能做什么

- 根据产品描述或产品页理解品类和卖点
- 从品类、使用场景、竞品、目标人群四个方向生成搜索词
- 在放量前先采集小样，由用户确认搜索方向
- 从 TikTok 和 Instagram 搜索并补全创作者资料
- 根据 bio 和近期内容进行语义匹配，并输出可读的判断理由
- 结合硬指标与语义判断生成 A/B/C 分层名单
- 基于主页近期作品计算公开指标：Instagram 按端点返回的前最多 12 条作品取互动与活跃，播放类指标仅取确认视频；TikTok 仍按现有视频口径
- 用带同行依据的“受众质量风险”标记异常账号；高风险只降级复核，不自动删除
- 记录明确的合作报价并计算隐含 eCPM/eCPE；没有报价时不自动估价
- 为合适且有公开邮箱的 A 级创作者生成个性化英文开发信草稿
- 记录跨任务创作者状态，排除已联系或已屏蔽的人
- 输出 HTML、XLSX、CSV 和 JSON，支持断点续跑和预算控制
- 本次改动开放本地人工复评模板命令：基于已保存冻结池创建空表，显式追加保留已有作答

缺语义判断或评审所用品牌版本已过期的候选先进入基础 B。三个命令按任务级 Agent 评审正本和人工反馈重建当前判断；后续受众地域与公开风险规则仍可降级，地域规则仍可剔除。人工反馈与 Agent 原判断分别保留，人工采用不豁免已联系或已屏蔽过滤。

render 导出的 CSV/HTML 先按有效采用建议，再按原分层与分数排序；XLSX 保留 A/B/C 三表，各表内先按建议排序。旧列后追加评审字段，Agent 与人工分平台展示，来源和待重评状态可辨；HTML 仍默认显示第一个非空分层。输出契约见 [输出说明](skill/references/output-format.md#评审输出u9)。

完整工作路径如下：

```text
产品理解
  → 四维关键词策略
  → 小样试探与方向确认
  → 批量采集
  → 语义匹配与理由
  → 可选的主页公开指标与风险复核
  → A/B/C 分层与英文开发信草稿
  → 报告、表格和本地记忆
```

## 不做什么

- 不实际发送邮件，只生成草稿
- 不做 CRM 跟进、付款、寄样物流或投放效果归因
- 不主动索取发信结果；联系、回复和屏蔽状态由外部手动维护
- 不支持抖音、小红书、快手等中国大陆平台
- 不生成多语言开发信，目前仅支持英语

## 架构

仓库把“需要判断的工作”和“机械执行的工作”分开：

| 位置 | 职责 | 执行者 |
|---|---|---|
| `skill/` | 产品理解、关键词策略、语义筛选、分层判断、开发信写法 | Agent |
| `scripts/` | API 调用、分页、去重、预算、断点、计分和文件生成 | Node.js |

```text
skill/
├── SKILL.md
└── references/
    ├── product-intake.md        产品理解与信息收集
    ├── keyword-strategy.md      四维关键词与小样判读
    ├── semantic-fit.md          语义匹配、理由与分层约束
    ├── public-metrics.md        公开指标、风险与报价口径
    ├── outreach-draft.md        个性化英文开发信写法
    ├── memory.md                跨任务记忆与跨平台同人识别
    ├── output-format.md         交付物格式
    └── providers/
        ├── _interface.md        数据源适配契约
        ├── tikhub.md            默认数据源
        └── external-enrichment.md 第三方增强准入（当前无接入）

scripts/
├── probe.ts                     小样采集
├── collect.ts                   批量采集与断点续跑
├── enrich.ts                    主页公开指标与可续跑风险评估
├── render.ts                    计分、分层和交付物生成
├── feedback-template.ts         已保存冻结池的人工复评模板创建／追加
├── lib/                         预算、邮箱、身份、记忆、CSV/XLSX 等
├── providers/                   数据源实现
└── check/                       纪律检查、变异测试、自检和审计
```

判断口径主要集中在 `semantic-fit.md`、`public-metrics.md` 和 `outreach-draft.md`。仓库已经定义数据源适配契约；当前执行入口只接入 TikHub，新增供应商仍需实现适配器并接入入口，但不需要改写下游判断和输出结构。

模块边界、哪几步的顺序有语义、Agent 与脚本之间的交接契约（退出码、字段归属、两个 creators 文件的分工）见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 数据源与数据边界

- **默认数据源：TikHub**，负责 TikTok 和 Instagram 的发现与资料补全
- **公开指标仍由 TikHub 提供**，只对语义筛选后的候选抓主页近期作品，不需要第二个 key
- **当前不接入任何外部增强供应商**；已评估的候选要么要求企业信息，要么缺少足够的主体、历史和方法验证
- 报告会明确标注邮箱未经验证、受众市场无法确认；公开风险不是假粉率，也不能代表实际带货效果
- TikHub 响应结构通过探测式解析兼容版本变化；识别失败时会暴露响应顶层字段，而不是猜测数据结构

## 五条不可突破的边界

1. 缺失数据不能用默认值伪造；“未查询”和“查询结果为空”必须可区分。
2. 开发信不能包含未经产品页证实的信息；未知内容必须保留占位符。
3. 未经用户确认不能超过 API 预算上限。
4. 已联系或已屏蔽的创作者不能再次进入名单。
5. 交付时必须明确说明哪些字段未经验证、哪些数据缺失。

详细定义和验收标准见 [docs/SPEC.md](docs/SPEC.md)。

## 快速开始

```bash
npm install
cp .env.example .env
```

在 `.env` 中配置：

```dotenv
TIKHUB_API_KEY=your_key
```

先运行不消耗 API 的完整检查：

```bash
npm run check
```

机械执行入口如下；正常情况下由读过 `skill/SKILL.md` 的 Agent 编排调用：

```bash
# 每个关键词、每个平台采集一页小样
npm run probe -- --config probe.json

# 方向确认后批量采集
npm run collect -- --config task.json

# 用户确认新的总预算后续跑，已完成关键词跳过
npm run collect -- --resume output/xxx --budget 3

# Agent 将语义判断保存至 agent-review.json 后，可选抓取主页近期公开指标
npm run enrich -- --dir output/xxx

# 公开指标预算用尽后，提高的是同一任务的总预算
npm run enrich -- --dir output/xxx --budget 3

# Agent 将判断和草稿保存至 agent-review.json 后，生成最终交付物并写回本地记忆
npm run render -- --dir output/xxx

# 本次改动开放：为已保存冻结轮次创建人工复评空表（不请求 API）
npm run --silent feedback-template -- --dir output/xxx

# 保留已有人工作答，只追加冻结池中缺席的平台账号
npm run --silent feedback-template -- --dir output/xxx --append
```

各脚本将结构化结果写入 `stdout`、进度或诊断写入 `stderr`；机械消费使用 `npm run --silent` 去掉 npm 自身 banner。每次请求按固定端点价检查剩余额度；`--budget 3` 是总上限 $3。collect/enrich 额度不足且保存成功才退出 `3`；初始费用/输入问题退出 `2`，运行或保存失败退出 `1`。旧费用未知仍可导出及做零请求本地处理，不能靠增加上限补造历史账。费用契约见 [ADR-108](docs/adr/ADR-108-生产请求与输出统一使用逐端点费用账.md)。

probe 与 collect 要求 `tasks` 至少包含一个任务，每项明确写出非空白 `keyword`、四维之一的 `dimension` 和 `tiktok`/`instagram` 的 `platform`。坏任务与 IG 路线问题会带文件路径一起报告，退出 `2`，不请求或写任务文件；旧任务续跑（含 `--budget`）同样整表检查，不补默认字段、不跳过坏项（D16）。

`market` 须为非空白字符串，collect 的 `target_count` 须为有限数；合规原值保留，不另加国家或人数范围限制。新 collect / probe 仅在市场缺席时用 US，并在 stderr 说明默认；新 collect 仅在人数缺席时用 50，probe 不校验人数。显式 null 不算缺席，旧任务缺任一字段直接拒绝。字段问题按输入路径与任务、路线问题一起报告（collect 的 CLI 预算及新建预算须合规），退出 `2`，不建任务目录、不写任务、不预留、不请求；改额续跑也保留原 task.json（D17）。

collect 续跑还会先检查 `task.json` 的已完成索引和分页统计；损坏时指出文件及字段，退出 `2`，不改写原文件或发请求。旧目录缺少整张统计表可继续，缺失仍保留为历史未知（D19）。

collect、enrich、render 在改预算、预留、请求或交付写入前校验 Agent 正本、冻结来源及已有人工反馈。读取失败、坏 JSON、游离账号或冲突人工行会指出实际文件和位置，以退出码 `2` 拒绝；正本真实保存失败退出 `1`。只确认 `creators.raw.json` 路径缺席时才使用旧名单的采集证据，已有坏原件不能当作缺席；enrich 和 render 不改写采集原件或人工表。

`feedback-template` 只接受必填一次 `--dir` 和可选一次 `--append`，相对目录按调用 cwd 解析。只读校验任务、已保存正本及冻结来源，要求完整 `creators.json` 数组；raw 仅真缺席时回退，合法直接关联由完整旧名单及 raw 提供。正本缺席时先由既有生产命令保存真实轮次，模板不迁移或冻结。默认已有人工文件均退出 `2` 防覆盖；显式追加先校验完整原表，保留旧字节，新账号七个人工字段全空，同账号不重复加行。合法无新增返回 `unchanged` 且实际不保存；其他输入问题退出 `2`，实际保存失败退出 `1` 并保原件，均无成功 JSON。成功 JSON 的 `file` 为绝对路径、`status` 为 create/append/unchanged、`added_accounts` 为新增平台账号行数。命令只保存人工目标，不改任务、名单、正本、raw、报告、memory 或费用账，不要求 key 或可付费账。填写与追加边界见[输出说明](skill/references/output-format.md#人工反馈模板d23d24d26)；默认全量 HTML、双筛选及审核统计仍未启用。

render 导出同样要求 `task.json` 至少保留一项合规搜索任务。任务文件读不到、JSON/根对象形状不合规或任务列表不合规时，报告路径和具体问题并退出 `2`，不改写或创建名单、交付物与跨任务记忆（D16.n–q）。需按原搜索配置恢复或修正真实任务记录，不能任意添加关键词冒充搜索范围。

`memory/creators.json` 读不出来时（多半是手改 `contacted` 时改坏了），`collect.ts` 以退出码 `2` 结束且**不产出名单** —— 那个文件记着谁已经联系过，读不出来就无法保证不重复打扰。采集结果与预算状态完好，**已经抓到的不会重抓**；但续跑要不要花钱取决于活干完没有 —— 关键词全跑完、profile 也全补完才是零请求；有待查项还须费用状态允许付费，`stderr` 会说明剩余量及阻止原因（**别把它简化成「续跑免费」**）。确实需要在这种状态下拿名单，显式加 `--ignore-memory`，`meta.json` 与报告会声明本次未做去重（见 `docs/adr/` 的 ADR-15、ADR-25）。

`render.ts` 每次重导出也会按当前记忆复核主账号及历史关联的账号；本次候选没有带关联字段时，仍沿记忆中的同人关系查已联系状态。记忆不可用时默认退出 `2`，保留旧交付；只有明确接受未去重风险时才在 render 命令上加 `--ignore-memory`，并在任务状态、`meta.json` 和报告中声明。

## 交付物

每次任务生成一个独立目录：

```text
output/{product}-{timestamp}/
├── report.html        单文件可读报告，支持分层切换和草稿复制
├── kol.xlsx           A/B/C 分 Sheet 的 Excel 名单
├── kol.csv            适合脚本和其他工具读取的完整单表
├── creators.json      最终筛选后的结构化名单与当前评审投影
├── creators.raw.json  原始采集累加器，断点续跑时只增不减
├── agent-review.json  Agent 判断、平台账号别名与冻结候选轮次的正本
├── manual-feedback.csv 人工反馈原作答（模板命令创建／显式追加，报告只读）
├── enrichment.json    分平台公开样本、指标、报价和查询状态（运行 enrich 后）
├── task.json          采集状态、费用账、请求数和断点信息
└── meta.json          平台、费用、分能力状态和数据边界
```

其中：

- HTML 报告完全内联，不依赖外部样式或脚本
- CSV 使用 UTF-8 BOM 并正确处理逗号、引号和换行
- XLSX 始终包含 A/B/C 三个 Sheet，包括空分层
- A 级候选附带可复制的英文开发信草稿
- 公开指标按平台显示；跨平台创作者不会把两边粉丝和播放量混算
- 活跃标签按采样时最后一次发布分为 active / cooling / dormant，仅提示、不改变分层
- `meta.json` 分别统计各能力的 measured / unavailable / unqueried

## 质量保证

需求的机器可读正本是 `docs/requirements.json`，`docs/SPEC.md` 中的表格由它生成。有多少条需求、其中几条是红线，跑 `npm run audit` 会打印 —— 这里不写数，写下来就是一份没人核的副本。

```bash
npm run check
```

完整检查有哪几步，正本是 `package.json` 的 `check` 脚本（人话版在 `AGENTS.md` 的「检查命令」那一行）。这里不抄 —— 抄一份就是一份会漂的副本，而它已经漂过一次：ADR-77 撤掉纪律 lint 之后，这句话在主干上说了一段时间的假话。CI 执行同一条命令 —— 推到 `main` 时，以及每个 pull request 上（`.github/workflows/check.yml`；**既不在 `main`、也没开 PR 的分支不跑**，代价与理由记在 ADR-97）。

## 当前已知边界

当时采用的双平台路径曾跑通，接口覆盖与最终名单、开发信的效果仍有待验证：

- collect/enrich 请求前保存费用预留；强制中断留下未结项会阻止付费与改额。费用终态已存但业务响应未存时仍可能重查，不保证断电或多个写者，见 [ADR-109](docs/adr/ADR-109-任务请求前持久保存费用预留.md)
- 首轮 Reels 小样本的 Instagram 入围人数较少；跨品类质量、其他发现路径与分页收益仍未充分验证
- 跨平台同人识别的真实样本仍然不足
- 单关键词采集四页是否足够，还缺少衰减数据
- 语义筛选相比静态评分能提升多少，尚未完成盲评
- 开发信草稿的实际可用率和回复率，需要真实发信数据验证
- 公开信号风险逻辑已经实现，但识别真实受众质量的准确率尚未用已知样本盲评
- 竞品关键词容易带来品牌官方号、经销商和已签约创作者，当前权重可能偏高

这些问题保留在 [docs/SPEC.md](docs/SPEC.md) 的“尚未确定的”部分，不会被实现层用默认答案掩盖。

## 关键文档

| 文档 | 内容 |
|---|---|
| [AGENTS.md](AGENTS.md) | 仓库约定正本与开工路由 |
| [skill/SKILL.md](skill/SKILL.md) | Agent 的触发条件和完整执行方式 |
| [docs/SPEC.md](docs/SPEC.md) | 需求唯一来源、红线和验收标准 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 模块边界、顺序契约和 Agent 与脚本的交接契约 |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | 本项目中特别容易违反红线的实现习惯 |
| [docs/business-requirements.md](docs/business-requirements.md) | 用户痛点、目标与业务论证 |
| [docs/data-source-strategy.md](docs/data-source-strategy.md) | 数据源比较和选型依据 |
| [docs/adr/](docs/adr/) | 架构与产品决策记录，一条一个文件 |
| [docs/SYNC.md](docs/SYNC.md) | 需求变动时需要同步的文档和实现 |
