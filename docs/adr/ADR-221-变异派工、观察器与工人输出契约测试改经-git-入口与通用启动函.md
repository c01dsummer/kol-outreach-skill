# ADR-221 变异派工、观察器与工人输出契约测试改经 git 入口与通用启动函数

- 日期 · 2026-11-19
- 类型：挪文件，是「调 git 只走一个入口」的第四片前一半
- 触发它的事实：ADR-220 合入后，主干 `d5cee29` 上「待挪」还有 6 个文件。其中 4 个不是测试夹具：变异派工（`mutate.ts`）只读 git，但它接管了信号、不能同步等子进程，git 入口只有同步那一版；观察器的两份（`observer-run.ts`、`observer-cert.ts`）是认证过的设施，改一个字节认证就失效；工人输出契约测试（`worker-output-contract-test.ts`）里回执的 `binding` 字段被闸门按名字记成「进程内部的口」
- 决定人与时间：需求所有者丸子 2026-11-17 选「三道都做，先做 git 入口」与「改成按模块拦，加运行时拒绝」；本条是其中挪文件的一步，做法照设计稿第四片（项目共享目录 `471-lessons-rules/git-entry/slice4/`）与它的独立复核第一轮
- 结论：采纳。人批痕迹：需求所有者合入本条那条 PR
- 理由：这 4 个文件挪完，「待挪」只剩两份大测试，它们要的是写 git 的夹具，另成一件事
- 连带改动：`scripts/check/git-config.ts`（新，只装钉死的 git 配置）· `scripts/check/size-rule.ts` 把这个常量转出去 · `scripts/check/git-entry.ts` 加异步一版 `runGitAsync`、表里加三问 · `scripts/check/mutate.ts`、`observer-run.ts`、`observer-cert.ts`、`scripts/worker-output-contract-test.ts` 改经 git 入口与通用启动函数 · `scripts/check/mutate-restore.ts` 加 `syncGitImports` · `scripts/check/child-process-registry.json`「待挪」删 4 行 · `scripts/test.ts` 两组加断言 · `scripts/check/mutations.json` 本条的变异与几条旧变异的锚点 · `docs/adr/ADR-220` 两处指过来 · `docs/ARCHITECTURE.md`、`docs/GLOSSARY.md`、`docs/SYNC.md`

## 一、要用到的事实，各找谁要（`process/3-BUILD.md` 第 8 条）

| 要用到的事实 | 找谁要 | 给机器读的还是给人看的 |
|---|---|---|
| 一个文件挪干净了没有 | ADR-217 的闸门 | 机器 |
| 变异派工有没有同步等子进程 | 两条：源码里按字面找 `spawnSync(` 这类调用（`blockingWait`，原有）；编译器的语法树上，它从 git 入口引了哪些名字，除 `runGitAsync` 以外的都算（`syncGitImports`，本条新加） | 机器 |
| 异步那一版答得对不对 | 真起 git：答得上来、标准输入照传、非 0 退出、起不来、输出超过 1 MB，各一条，形状与同步那一版逐项对上 | 机器（真跑） |
| 变异派工的问法在不在表里 | 它问基线与路由的七种形状静态读得全（`resolveMutationBaseline`、`executionRoutes`），本来就在表里；新加的只有拷贝清单那两问 | 机器（运行时不在表里当场抛错） |
| 控制器字符串是不是只改了字段名 | 改前改后逐字节比，差异只在控制器里三处代码；外层读回执的两处同改；控制器的 SHA256 现算 | 机器 |
| 观察器设施没变坏 | 照冻结命令在干净克隆里重新认证，见第三节 | 机器（真跑） |

## 二、做了什么

1. **钉死的 git 配置单放一份文件。** `GIT_CONFIG` 从体量闸门的规则挪进 `git-config.ts`，规则那边原样转出去给测试用。理由在第三节：观察器的设施清单要记 git 入口依赖的每一份文件，体量闸门的规则常改、和观察器无关，放在里面认证表就跟着它过期。两条钉配置的旧变异（`M-H9-k`、`M-H9-l`）改指新文件。
2. **git 入口加异步一版。** `runGitAsync` 与 `runGit` 共用查表与拼参数（`argvFor`）、共用「没给标准输入就不接」（`stdioFor`），交回同样的形状：`error` 只表示起不来，非 0 退出、被信号杀都看退出码。用调用时从模块上取的 `spawn` 自己收字节，不用 `execFile`：后者不认 `stdio`，标准输入是一根开着的管道，`cat-file --batch` 这种从标准输入读的会一直等；它还把起不来、非 0、被杀、超上限混进同一个错误。表里加三问：`rev-parse --show-prefix`、`ls-files -z --cached --others --exclude-standard`（变异派工列 worker 副本要带的文件）、`status --porcelain`（观察器认证判被测的树干不干净）。
3. **变异派工。** 两处问 git 改经 `runGitAsync`；本地那个异步小函数改名 `askGitLater`，免得和 git 入口导出的同步 `askGit` 撞名，手一滑引成同步的。起验证者、起 worker 两处改经通用启动函数（`detached` 原样交给 Node）。`syncGitImports` 加进「接管了信号的那个入口」那几条断言。
4. **观察器两份。** `observer-run.ts` 起 bwrap、node 改经通用启动函数；`observer-cert.ts` 问提交号与工作区干不干净改经 git 入口（多带的 `core.quotePath=false` 只影响输出怎么写，判的是空不空）。对照夹具 `CONTROL` 是写在字符串里、运行时落盘再跑的代码，它自己导入模块起子进程 —— 设施故障对照里「入口起子进程」那一条等的就是它，原样留着。
5. **工人输出契约测试。** 回执字段 `binding` 改名 `bindingRecord`：控制器字符串里三处代码（赋值、写进 `binding.json` 那一句、读 `boundDriverSha256`），外层读回执的两处（类型、断言）。文件名 `binding.json` 与报错文字不动。控制器的 SHA256 现算换上。起 `ps`、`lsof`、`node` 改经通用启动函数。

## 三、观察器设施清单与重新认证

设施清单（`facilityFiles`）加四份：通用启动函数与它认 git 的那一句所在的 `launch-count.ts`、git 入口与 `git-config.ts`。观察器「看得对不对」走起进程那一路，被测的树是哪个提交、干不干净走 git 入口 —— 两路的字节都该在认证表里。**这四份任一改了（含 git 入口表里加一问），都要重新认证。** 现在没有检查拿树上的 SHA256 去对认证表，过期是无声的，所以这句写在这里，也写进了清单那一行的注释。

重新认证照 ADR-186 的做法：在本条最后一个碰设施文件的提交的干净克隆里，照冻结命令原样跑。

在 `90a8fbe`（本条最后一个碰设施文件的提交）的全新干净克隆里原样跑两条：`npm ci --prefer-offline --no-audit` 以 0 退出；`sh scripts/check/observer-cert.sh` 以 0 退出，19/19 项成立，被测提交 `90a8fbe340ae581e35f82b6be6940d057924ad31`、工作区干净。环境：Linux 6.18、Node v22.23.4（node 二进制 SHA256 `2286ce921a47349726b0e8b037ccbb6627043d24d1fc3c8f22c2dc53c4a1f7ff`）、tsx 4.23.12（`loader_sha256` `49fb4673…10c2`、`dist_sha256` `5af56f52…dd52`，与 ADR-186 那次相同）。证据的 `summary.json` SHA256 `1a05200ca3b99473a6075e6a38ed6b9a3bea70cf3ebb068906b30820c486c7f3`（证据不进仓库）。

设施各文件（`90a8fbe` 的树）：

| 文件 | SHA256 |
|---|---|
| `scripts/check/observer-rule.ts` | `967dc388d8c9dfbffd5e4b27876845e57cc3e86f97ded6e3a9c8401f055d2944`（没变） |
| `scripts/check/observer-preload.ts` | `b73c2c19fb2e04fc1a92c20b256290591860509ff126340c8abc5c5f94c242d7`（没变） |
| `scripts/check/observer-run.ts` | `faa47a5c3f919e4367071eefaf15a9e9378be5ecbcafbd5b71d9a04420b9c25d` |
| `scripts/check/observer-cert.ts` | `ea9b196448a511854b8d6af337ba24e0d4537b84ecbadf718d9c0f557e346d2e` |
| `scripts/check/observer-cert.sh` | `fff95dc7a5a72d209ac6f4a204aa4b66a6319a30494154b92a262388b7ce027f`（没变） |
| `package-lock.json` | `6fc97367b7c757beca5c6d3dc3e3af77880f6c4954599178900fab3d0e6b0543`（没变） |
| `scripts/check/start-process.ts` | `bc2be950e531e63f8a53afb9d815308a499340e7f4149ea2b3c818061edecec7`（新进清单） |
| `scripts/check/launch-count.ts` | `6b69560f583c364b3b3f10a8c602f3a08225f4753da443bca7caa610eab32b31`（新进清单） |
| `scripts/check/git-entry.ts` | `fdf874adb1771fd9fb4a781d28b924ec5f9042372ad266ad4ca8ca7845d2b3af`（新进清单） |
| `scripts/check/git-config.ts` | `1a61c2eadcd745d969f3568faf809ece9d8585194b2d857b493a1862281c32f2`（新进清单） |

ADR-186 那张表里 `observer-cert.ts` 的 SHA256 在本条以前就已经和树上对不上（什么时候改的没查），本条这张表替代它。合入前若又改了清单里的文件，在最终 head 的干净克隆里再跑一遍，结果写在 PR 正文里。

## 四、拦不住的

- 写在字符串里、运行时落盘再跑的代码，自己导入模块起子进程，闸门与通用启动函数都管不到（ADR-219 第四节第三条）。本条点名两处：观察器的对照夹具 `CONTROL`、工人输出契约测试的控制器（它在字符串里起 git 建私有快照）。
- `syncGitImports` 认不出动态 `import()` 与经别的文件转手引来的同步函数；按字面找的那条认不出改了名的调用。两条一起只守「直接写在入口里」的那几种。
- 设施清单与认证表对不对得上，没有机器检查（见第三节）。
- 变异派工两处问 git 的出错分支（拷贝清单问不出来以 1 退出、基线问不出来判无从判断）没有变异守着；它们改坏了是整个变异那一步红，大半自证，但「以 0 退出把错吞掉」那种坏法不自证。

## 五、清点

（开 PR 前按台账逐条清点，结果待填。）
