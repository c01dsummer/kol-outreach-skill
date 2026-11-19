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
2. **git 入口加异步一版。** `runGitAsync` 与 `runGit` 共用查表与拼参数（`argvFor`）、共用「没给标准输入就不接」（`stdioFor`），交回同样的形状：`error` 只表示起不来，非 0 退出、被信号杀都看退出码。有一处不同：给了标准输入、git 没读完就退出时，同步版交回退出码 0 并带一个「管道断了」的 `error`（于是 `gitText` 交回空值），异步版把这一错吞掉、只看退出码。表里吃标准输入的只有 `cat-file --batch`，它读完才退，碰不到；按退出码判是对的那一边，同步版那样是 Node 的 `spawnSync` 自带的，没去改（git 入口在设施清单里，改一个字节就要重新认证）。用调用时从模块上取的 `spawn` 自己收字节，不用 `execFile`：后者不认 `stdio`，标准输入是一根开着的管道，`cat-file --batch` 这种从标准输入读的会一直等；它还把起不来、非 0、被杀、超上限混进同一个错误。表里加三问：`rev-parse --show-prefix`、`ls-files -z --cached --others --exclude-standard`（变异派工列 worker 副本要带的文件）、`status --porcelain`（观察器认证判被测的树干不干净）。
3. **变异派工。** 两处问 git 改经 `runGitAsync`；本地那个异步小函数改名 `askGitLater`，免得和 git 入口导出的同步 `askGit` 撞名，手一滑引成同步的。起验证者、起 worker 两处改经通用启动函数（`detached` 原样交给 Node）。`syncGitImports` 加进「接管了信号的那个入口」那几条断言。
4. **观察器两份。** `observer-run.ts` 起 bwrap、node 改经通用启动函数；`observer-cert.ts` 问提交号与工作区干不干净改经 git 入口（多带的 `core.quotePath=false` 只影响输出怎么写，判的是空不空）。对照夹具 `CONTROL` 是写在字符串里、运行时落盘再跑的代码，它自己导入模块起子进程 —— 设施故障对照里「入口起子进程」那一条等的就是它，原样留着。
5. **工人输出契约测试。** 回执字段 `binding` 改名 `bindingRecord`：控制器字符串里三处代码（赋值、写进 `binding.json` 那一句、读 `boundDriverSha256`），外层读回执的两处（类型、断言）。文件名 `binding.json` 与报错文字不动。控制器的 SHA256 现算换上。起 `ps`、`lsof`、`node` 改经通用启动函数。

## 三、观察器设施清单与重新认证

设施清单（`facilityFiles`）加四份：通用启动函数与它认 git 的那一句所在的 `launch-count.ts`、git 入口与 `git-config.ts`。观察器「看得对不对」走起进程那一路，被测的树是哪个提交、干不干净走 git 入口 —— 两路的字节都该在认证表里。**这四份任一改了（含 git 入口表里加一问），都要重新认证。** 现在没有检查拿树上的 SHA256 去对认证表，过期是无声的，所以这句写在这里，也写进了清单那一行的注释。

重新认证照 ADR-186 的做法：在本条最后一个碰设施文件的提交的干净克隆里，照冻结命令原样跑。

在 `90a8fbe`（本条最后一个碰设施文件的提交）的全新干净克隆里原样跑两条：`npm ci --prefer-offline --no-audit` 以 0 退出；`sh scripts/check/observer-cert.sh` 以 0 退出，19/19 项成立，被测提交 `90a8fbe340ae581e35f82b6be6940d057924ad31`、工作区干净。环境：Linux 6.18、Node v22.23.4（node 二进制 SHA256 `2286ce921a47349726b0e8b037ccbb6627043d24d1fc3c8f22c2dc53c4a1f7ff`）、tsx 4.23.12（`loader_sha256` `49fb46730ddeb226ac4fa9fb990d3573ac8f18fa4de02f1bf723c61d715710c2`、`dist_sha256` `5af56f523ee75397bcfc1d2d38842d52d7d5f3f17b40de4ee509d62d209edd52`，与 ADR-186 那次相同）。证据写在那台容器的克隆里（`/var/tmp/recert/output/kol21-observer-cert/`，容器回收后不在），`summary.json` 的 SHA256 `1a05200ca3b99473a6075e6a38ed6b9a3bea70cf3ebb068906b30820c486c7f3`。

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

ADR-186 那张表里 `observer-cert.ts` 的 SHA256 在本条以前就已经和树上对不上：`774723fa`（四个入口的退出码分号，ADR-193）改了它两行，没有重新认证。本条这张表替代 ADR-186 那张。合入前若又改了清单里的文件，在最终 head 的干净克隆里重跑，并更新本节这张表。

## 四、拦不住的

- 写在字符串里、运行时落盘再跑的代码，自己导入模块起子进程，闸门与通用启动函数都管不到（ADR-219 第四节第三条）。本条点名两处：观察器的对照夹具 `CONTROL`、工人输出契约测试的控制器（它在字符串里起 git 建私有快照）。
- `syncGitImports` 认不出动态 `import()`、经别的文件转手引来的同步函数、把模块名拆开拼的写法；说明符按「最后一段是 `git-entry`」认（带后缀、查询串、哪一级目录都算），宁可多报。按字面找的那条认不出改了名的调用。两条一起只守「直接写在入口里」的那几种。
- 设施清单与认证表对不对得上，没有机器检查（见第三节）。
- 变异派工两处问 git 的出错分支见第五节那张欠条。

## 五、后面还有两片

「待挪」剩 `selfcheck.ts`、`scripts/test.ts`，照设计稿第四片第二版分两条，串行，本条合入后开前一条、前一条合入后开后一条：

1. **git 夹具模块与自检。** 新登记模块 `git-fixture.ts`：测试建临时仓库用，能写，但只在临时根下、不在本仓库里；环境、`-c` 的键、子命令各一张白名单。登记表加一节「测试文件」，不在这一节里的文件，任何字符串里出现夹具模块的名字就红。`selfcheck.ts` 记当前目录那段挪进一个登记模块，其余起进程走通用启动函数、建仓库走夹具模块、读真仓库走 git 入口。
2. **换替身模块与需求测试。** 新登记模块（只许测试文件引）给需求测试临时换掉模块上的函数：一种替身不拿原函数，一种只记参数再转给原函数。`scripts/test.ts` 其余起进程、建仓库、读真仓库同上。「待挪」清空，`process/README.md` 第三层与 ADR-216 第四节那句改成建了什么、守到哪。

两片都不该碰设施清单里的文件；碰了就照第三节再认证。

## 六、清点

本条开 PR 前三个互不知情的上下文按台账（810 条）分三段逐条清点，另有一轮独立复核。

响了、本条还的：

- ADR-211「架构文档接续那段指向与基线说法没改」：#506 已合入，本条改了 `docs/ARCHITECTURE.md`，两句照欠条说的改了（基线与重放的说法、指向 ADR-158 历史文件那一节）。

响了、只记核过的：

- ADR-89 第 92 行（加变异时看一眼盖的是不是没人盖过的地方）：本条新加的十条（`M-H221-a`～`j`）的锚点全落在本条新写的代码上（异步那一版六条、变异派工新导入那一行一条、`syncGitImports` 三条）。没有变异的：异步那一版收标准错误那一行与 `close` 那一支、观察器认证判干净多出的「起不来」那一项。
- ADR-132 第 375 行（「指着变异派工入口的变异会被自己验自己拦下」那句理由的副本）：`M-H221-g` 指着 `mutate.ts`、由需求测试验；本条没有新添那句理由的副本，余额照挂。

响了、重挂的（见下面两张）：ADR-186 第 160 行（观察器运行器起进程的那一半没有变异）、ADR-186 第 162 行（`observer-cert-entry` 在那台机器上为什么红没人核）。本条改了这两份文件并重新认证，认证是实跑不是负片，那台机器也没人核。

字面上响、两种读法的（照旧挂，不重新起算）：

- ADR-72 第 708 行（编译缓存那两处 env 没检查守）、ADR-201 第 135 行（工人输出契约测试外层「确认不了」「删不掉」两支）：所点函数与那两处 env 字节没动，只是起进程换成了通用启动函数。窄读不响；宽读响，但通用启动函数原样交给 Node，那两张说的缺口没变。先例 ADR-200 第 80 行。
- ADR-193 第 112 行（入口脚本里的判定只有自检够得到）：本条没往入口加判定，问 git 的出错判定跟着答案形状换了写法；新加的判定 `syncGitImports` 放在规则模块、由需求测试直接测。取不响。
- ADR-70 第 342 行（引仓外文件只写 SHA256 前缀）：第三节原先照抄 ADR-186 只写了 tsx 两个 SHA256 的头尾，已补全，并写了证据的位置。

拿不准、取窄读的：ADR-70 第 362 行（用到才取 TypeScript 没有断言守）：本条在 `mutate-restore.ts` 新加了一处首次调用才取 TypeScript，条件点名的是 `mutate-rule.ts`、`share-rule.ts` 与那组契约，没碰；同一缺口多了一处，写在这里。条件带「或定期清点」的那批，开 PR 前的清点不算定期清点（先例 ADR-151 历史文件），计不响。

> ⚠️ 欠条「变异派工问 git 的出错分支没有变异」：`mutate.ts` 里拷贝清单问不出来以 1 退出、维护基线问不出来判无从判断，这两处的判断改成恒假，需求测试与 git 入口两组全绿（独立复核实测）；坏了大半是整个变异那一步红，但「以 0 退出把错吞掉」那种坏法不自证 · 来源：ADR-221 独立复核第一轮 · 档：登记 · 重启条件：下一条改 `mutate.ts` 里 `workerFiles` 或 `askGitLater` 的改动，或下一条给变异入口加自检组的 PR，先到为准

> ⚠️ 欠条「观察器运行器起进程那一半没有变异」：承接 ADR-186 第 160 行原样 —— `observer-run.ts` 起进程的那一半（认证时起受控目标与两个探针、起入口时拼沙箱参数与环境、收证据）没有变异守着；本条把起进程换成通用启动函数并重新认证，认证是实跑不是负片 · 来源：ADR-186 第 160 行（本条清点重挂） · 档：登记 · 重启条件：下一条改 `certifyIsolation` 或起入口那几行逻辑的 PR（只改名字或只换起进程的来路不算），或 CI 上确认起不来 bwrap 时，先到为准

> ⚠️ 欠条「observer-cert-entry 在那台机器上为什么红」：承接 ADR-186 第 162 行原样 —— 自检组 `observer-cert-entry` 在 PR #426 作者的本机上红、红在哪一条、为什么，没人核；本条改了认证入口 `observer-cert.ts`，本机这一组是绿的 · 来源：ADR-186 第 162 行（本条清点重挂） · 档：登记 · 重启条件：下次有改动碰到 `selfcheck.ts` 的 `observer-cert-entry` 组、`observer-cert.ts`、`observer-run.ts` 的 `certifyIsolation` 或 `observer-rule.ts` 的 `sandboxArgs`，或同一缺口再被点名，先到为准
