# ADR-250 冻结 preload 工具的 ready 读早了：重冻改掉

- 日期 · 2026-11-26 · 还 ADR-212「冻结 preload 工具偶发失格」
- 类型：测试变更（冻结测试工具里两处读早了的地方，由没读过被测实现的独立作者改；被测实现一行没动）
- 触发它的事实：主干 `10e853bc` 上一次完整检查里，需求测试组 `h-prebuilt-no-config-lifecycle-contract`（预构建入口无配置时的生命周期合同）在正常代码上就失格，单跑又绿；同一张欠条此前已响过五次（ADR-70 第 2613、4247、4275、4289 行那几次与 ADR-212 那一次）
- 冲击的需求：无（只改测试工具，不改产品行为与判据）
- 决定人与时间：需求所有者丸子 —— 授权与否在本线程的选择卡「准不准改冻结的 preload 测试工具里那两处读早了的地方？」上定（推荐「准改，照上次交独立作者」）；PR 正文写明他选了哪一项
- 结论：采纳（以上面那张卡为准）。人批痕迹：上面那张卡；需求所有者合入本条
- 理由：失格的原因可以确定地复现并确定地去掉（第一、三节），不是靠重跑碰运气
- 连带改动：`scripts/prebuilt-no-config-contract-data.ts` 里冻结包五件成员的正文与摘要、`ORIGINAL_FREEZES` 里两份清单的摘要（第二节）；ADR-212 那张欠条下加「已还」一行
- 同类：ADR-70「还第 2739 行」那一节（同一组、同一种「ready 读早了」，那次修的是生命周期入口，做法相同：独立作者重冻、整合方只嵌回）；ADR-155（多个进程写同一个文件、读方读到半截）

## 要用到的事实，各找谁要

| 要用到的事实 | 找谁要 | 给机器读的还是给人看的 |
|---|---|---|
| 冻结包每件的正文与摘要 | `scripts/prebuilt-no-config-contract-data.ts` 的 `FROZEN_CONTRACT_FILES`；适配器每次装包前逐件核摘要 | 机器 |
| 重冻出处 | 改过的三份清单里 id 为 `preload-ready-snapshot-r1` 的那一段 | 机器 |
| 独立作者的产出与报告 | 项目文件 `preload-refreeze/`（`out/报告.md`），第四节 | 人 |
| 复现与对照的次数 | 本节第一、三节 | 人 |

## 一、毛病在哪：两处「准备好了」读早了

冻结的 preload 工具（`packet/lifecycle319/preload/run.mjs`）起一个子进程，等真正的入口进程写出 ready 文件，核对它在独立的进程组里，再写 go 文件放行。入口一侧的预加载（`ordinary-preload.mjs`）写完 ready 就同步卡着等 go。

1. **读到空文件。** 预加载用 `writeFileSync` 写 ready：建出空文件、写进内容是两步。运行器看到文件存在就读第一行取 `.pid`；赶上两步之间，读出来是空的，报 `Cannot read properties of undefined (reading 'pid')`。
2. **进程表拍早了。** 运行器每轮先拍一张进程表（`ps`），再看 ready 文件。入口进程若在拍完之后才起来并写好 ready，这一轮的表里没有它，报 `real entry preload/PGID proof failed`。

工具在 R（公开 tsx 参照）一侧失格时，外层只报 `public R preload qualification invalid; no product assertions`，里面是这两句之一。历次见过的三种原因句都落在这里。

**证据。** 在一份装好的冻结包上直接跑这件工具（4 核，Node 22.23.5）：

| 做法 | 结果 |
|---|---|
| 原件，16 路并发 160 次 | 22 次失格，全是第 2 种（R 一侧 10、C 一侧 12） |
| 原件，在写 ready 的两步之间人为停 300 毫秒 | 5/5 失格，R 一侧第 1 种原句 |
| 同上，但先写临时文件再改名就位 | 5/5 通过 |
| 原件，在拍进程表之后、看 ready 之前人为停 1 秒 | 5/5 失格，R 一侧第 2 种原句 |
| 同上，但看到 ready 之后再拍进程表 | 5/5 通过 |
| 整组需求测试，8 份克隆同时各跑，8 轮 | 64 跑里 1 跑失格，第 2 种原句 |

只给机器加满 CPU（12 个空转进程、4 核）连跑整组 19 次都没红：要撞上的是进程创建和调度的时序，不是单纯算力不够。

## 二、改了什么

独立作者的字节，嵌回时一字未改：

- `ordinary-preload.mjs`：ready 先写 `<ready>.tmp-<pid>`，再 `renameSync` 就位。ready 路径一出现就是写完整的。
- `run.mjs`：每轮先记下 ready 在不在，再拍进程表，用先记下的那个结果决定要不要核对。入口写完 ready 后同步卡着等 go，所以只要 ready 已经在了，随后拍的表里一定有它。
- 跟着换摘要：`lifecycle319/preload/freeze-manifest.json`、`lifecycle319/freeze-manifest.json`（两件 `.mjs` 的摘要与字节数，追加出处段 `refreeze2`，因为已有的 `refreeze` 一键是上一次重冻的，没改形状）、`patch-inventory.json`（`run.mjs` 那一项的 `executedOverlaySha256`，追加 `refreeze`）。
- `ORIGINAL_FREEZES` 里两份清单的摘要换成新值（`86d76724…`→`41b7ffbb…`、`3dcc4694…`→`47ac6494…`），与上一次重冻的处理相同。

没动：断言、标签、R 的资格条件、case ID、`spec.json` 的超时、失格与不通过的路由、没加任何重试。`sync43/source-preservation.json` 记的是更早的历史状态，上次重冻也没改它，这次照旧。`portable-root-binding.json` 的「永不替换」七条与本次不冲突。

| 成员 | 旧 SHA256 | 新 SHA256 | 字节 旧→新 |
|---|---|---|---|
| `packet/lifecycle319/preload/ordinary-preload.mjs` | `56620e06760cd26db5d95ae84800cdacc3377e07a25a6fb43770a86eb7912e22` | `38ee1e2507af6e4f7852546b1c9b5be65073e5995d0ab78c3ed2216139c58899` | 1374→1608 |
| `packet/lifecycle319/preload/run.mjs` | `bcde72029a299beabb6b913fcfa5e520f2ffe69eb8ab74d409fdcba62ed604c6` | `dc080e6b5b13b86c186a733fc1b4c4d0c4b00681147a985d830ba662498e3b5a` | 9474→9484 |
| `packet/lifecycle319/preload/freeze-manifest.json` | `3dcc4694d1d47b762aefb003aade396d4c115161a3bd49166c274175b3b1ebbc` | `47ac6494c403f11f83937193992579c873d24653d4f4fbad1f611c7891f72abd` | 1430→2329 |
| `packet/lifecycle319/freeze-manifest.json` | `86d767248a197b76d95054e6f70ab66b5d9412845d7248953a846ceaac6134a4` | `41b7ffbb4694f16c0f79e061c09e32de2cbd80b5340e9bc2dc430b8d72ec1c19` | 2957→3872 |
| `packet/patch-inventory.json` | `2543f427d704d551de4fd4880bd0538271923f745df7a1db2e17d626b8482f6c` | `3c0d8570c453e3007ea54fe148e243fa9d98097013d22d93bbdebb0969d419ff` | 4493→5307 |

嵌回后逐件核过：数据文件里 98 件的正文与独立作者交回的（没改的与原件）逐字节相同，摘要都对得上。

## 三、改后的数

- 独立作者：新旧两版逐轮交替，各 16 路并发 160 次 —— 新版 160 次全通过；原件 27 次失格，全是第 2 种原句。两种人为拉长的空档加在新版上各 5 次，全通过。
- 整合后：整组需求测试单跑通过；8 份克隆同时各跑整组 8 轮的结果见 PR 正文。

## 四、独立作者是怎么隔开的、能证到哪

一个全新的上下文，只拿到仓库外目录 `/var/tmp/preload-refreeze/`：冻结包 98 件原字节、一份只讲症状与证据的说明、一个只许运行的试跑脚本；被告知不读仓库（尤其被测的 `scripts/check/prebuilt*.ts`）、不读装好的临时根。它报告里列了读过的文件，全在那个目录里。这一次没有 OS 沙箱，「没读过被测实现」只能以它的报告与产出目录为证。它的产出存在项目文件 `preload-refreeze/`。

## 五、碰响了的欠条

- ADR-212「冻结 preload 工具偶发失格」：还，见那张欠条下一行。
- ADR-70「冻结包身份那两项哈希仍指重冻前」：实质不响。它说的是 `COMBINED_FREEZE_SHA256` 与原 fixture 根清单那一项；本次只换了 `lifecycle319` 与 `lifecycle319/preload` 两份 scoped 清单的摘要，那两项照旧算不出新值、也照旧没人读。
