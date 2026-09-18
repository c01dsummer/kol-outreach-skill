# 给评审者的开工须知

> **只做转发，不装规则。** 规则在 `process/`（通用）与 `docs/`（业务）——
> 往这里抄一份就多一份会漂的副本，这个仓库刚清掉 47 处（ADR-82）。
>
> 三个评审器各有一份转发都指到这里：`.github/copilot-instructions.md`、
> `.coderabbit.yaml`、`AGENTS.md` 的路由表。**改规矩只改被指的那几份。**

| 要评的 | 读 |
|---|---|
| 发现怎么分档、何时只登记不修、合并者核什么 | `process/6-INTEGRATE.md` |
| 一条测试算不算数（红→绿→变异；expected 不许来自运行结果） | `process/4-VERIFY.md` |
| 需求与判据能不能这么改（编号不改含义、不回收复用） | `process/1-REQUIREMENTS.md` |
| 这里哪些「通用最佳实践」是错的 | `docs/CONVENTIONS.md` |
| 模块边界与契约 | `docs/ARCHITECTURE.md` —— **人维护、无机器核，当索引读别当证据读** |
| 某个决定为什么长这样 | `docs/adr/` 与它的 `README.md` 索引 |

**两条这里特别在意的**：可算的数不许写进散文和注释，要么钉一棵不会再动的树、
要么只写命令不写输出（ADR-73、ADR-82）；一句承诺往往有多份副本，改一处要
点名逐个过、不要 grep（`docs/SYNC.md`）。

**四个坑**：中文文件名要 `-c core.quotePath=false`，否则 `git ls-files` 取到 0 个 ADR；
可能是浅克隆而 `git log` 不会说它被截断；换个说法就躲过检索（搜关键词别搜整句，
搜全仓别只搜 `docs/`）；`npm run check` / `test` / `mutate` 会写覆盖记录文件，
核事实时它们不是只读命令。

> **看不见 diff 之外的东西时，说「我不知道」，不要补全。**
> 一条基于猜测的发现比没有发现更贵 —— 它要人花时间证伪。
