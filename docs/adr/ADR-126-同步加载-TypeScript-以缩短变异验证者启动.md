# ADR-126 同步加载 TypeScript 以缩短变异验证者启动

- 日期：2026-09-29
- 类型：发现更优解
- 触发它的事实：`scripts/test.ts` 静态引入 `mutate-rule.ts`，后者在模块加载时引入 TypeScript；即使选组只执行两条业务断言，验证者进程仍要支付这段加载成本。PR 226 合入后的 main `31d25aaf56c13c8189f9b56fedf3262ec7042d90` 是本次固定对照起点；加载方式的可节省量尚待同版本对照。
- 冲击的需求：检查链自己的变异归因与分组选跑；不改变产品需求。
- 结论：采纳顶层同步 `createRequire(import.meta.url)('typescript')` 作为候选加载方式，保留现有 AST 判定、完整测试、变异集合和执行路由。只有同版本、同组、同 Node 与相同成功资格的有限对照显示节省，且完整检查通过，才提交实现。
- 理由：TypeScript 的 AST 能力仍是检查判定的必需依赖，应在验证者启动时加载并在缺失时明确失败；只换模块载入方式，可以单独检验这项成本，避免同时改动测试框架或路由。此前的 CJS 加载热点不能单独证明本改动有收益。
- 连带改动：`scripts/check/mutate-rule.ts` 的导入及类型标注；本索引由 `npm run adr -- --write` 生成。`process/`、产品规格和 `docs/ARCHITECTURE.md` 的模块边界均不变。

## 验收边界

使用本次从 GitHub 取得的固定提交与锁文件，在临时目录安装固定 Node 22.23.2 和依赖。
对照双方只允许改变 `mutate-rule.ts` 的 TypeScript 载入方式和相关类型引用；
确认现有 `find` 锚点和数量、分组、验证者闭包、正常子集、具名失败及完整检查结果不变。
缺失 TypeScript 时必须明确非零退出，不能由未运行到 AST 的子集假绿。

计时分别报告命令、环境、worker、成功次数、中位数和范围；CPU 如可取得另列。
局部验证者启动收益不得冒充完整 CI 收益，逐条耗时之和也不得写成 job 时间。
PR 226 已合入；本实现从包含它的 main 独立开出，PR 前在最新 main 上重新验证。

## 固定版本的局部验收

旧版是 `31d25aaf56c13c8189f9b56fedf3262ec7042d90`，候选实现是
`1e62a536c4b390b9ea1b9d407801f4d4cb4d6211`；两份均从 GitHub 独立克隆，
同一 `package-lock.json`，Node 22.23.2、Darwin arm64、一个直接 worker。
旧版与候选版的完整 `npm test` 均通过，三个实际配置
`p1-plays`、`d7-email`、`d15-discovery-sources` 分别在正常源码上通过，
执行 2、12、162 条断言。TypeScript 缺失时，候选版的最小选组明确以
`MODULE_NOT_FOUND` 非零退出，调用栈指向 `mutate-rule.ts`。

目录仍为 771 条；`mutate-rule.ts` 的 78 个 `find` 锚点改前改后均唯一。
实际路由与基础设施闭包的快照哈希一致：699 条选组、72 条全跑、闭包 15 个文件。
每次 worker 按同一顺序运行 M-P1-h、M-D7-a、M-D15-c；双方所有运行均以
`caught` 收齐三条，源码和完整测试认领原件的字节、inode、mtime 均恢复/保留。

预热后按旧→新、新→旧、旧→新交错三对。命令为固定 Node 加锁定 tsx CLI
启动 `scripts/check/mutate.ts --worker`，从 stdin 送入上述三个 ID 后 EOF；
双方同为三次完整成功，没有把预热或失败样本计入下表。

| 三条变异的直接 worker | 墙钟秒中位数（范围） | user+sys 秒中位数（范围） |
|---|---:|---:|
| 旧加载 | 2.788（2.784–2.849） | 4.163（4.125–4.194） |
| 同步加载 | 1.864（1.852–1.925） | 2.764（2.726–2.858） |

这三个 ID 的 worker 中位数减少 0.924 秒、约 33.1%。CPU 是命令及其等待的子进程合计，
不是 CI job 的 CPU。局部对照没有运行完整目录、coordinator 或 GitHub runner，
不得把此数外推为完整 `npm run check` 的收益；完整 CI 仍须在 PR 上验收。
