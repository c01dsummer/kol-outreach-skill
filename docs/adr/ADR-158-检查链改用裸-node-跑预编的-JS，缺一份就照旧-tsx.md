# ADR-158 检查链改用裸 node 跑预编的 JS，缺一份就照旧 tsx

- 日期 · 2026-10-23 · 需求所有者 2026-10-22 在项目线程里定的检查链时长排程（「先照这个排」）里的乙路线：先在一条只量数的分支上做原型，同一台机器上整条检查链省得到 5 分钟以上才落地（原型与它的报告都不在仓库里，本条第六节在落地这一版上重新量）。本条那条 PR 是第一片
- 类型：不属于反向输入的几类 —— 改的是检查链怎么起进程，不触及需求登记表
- 触发它的事实：检查链里变异、自检、需求测试起的每个 `.ts` 进程都经 tsx：先起 tsx 的壳，再在壳起的那个 node 进程里装转换。本机一次起法本身就要约 0.5 秒 CPU，装本条的钩子跑预编的 JS 约 0.08 秒（第六节第 1 条），而一次完整检查要起几千个这样的进程
- 冲击的需求：无。跑的东西不变（第二节），变的是起法与成本
- 结论：采纳，分两片（第一节）。本条那条 PR 是第一片：新的判定 `scripts/check/prebuilt.ts` 决定一次起法走裸 node 还是照旧 tsx，钩子 `scripts/check/prebuilt-hook.ts` 让裸 node 跑缓存里预编的那一份，入口 `scripts/check/compile.ts`（`npm run compile`，检查链里紧跟 `npm run typecheck`）预编整棵树；变异、自检、需求测试起子进程的地方换成它。顺带还上分派过来的两张欠条、重挂一张（第四、五节）。人批痕迹是需求所有者合入本条那条 PR
- 理由：第二到第六节
- 连带改动：`scripts/check/prebuilt.ts`、`scripts/check/prebuilt-hook.ts`、`scripts/check/compile.ts`（新）；`scripts/check/mutate.ts`、`scripts/check/selfcheck.ts`、`scripts/test.ts` 起子进程的几处；`scripts/check/mutate-restore.ts` 文件头一段；`scripts/test.ts` 新组 `h-prebuilt`、`h-prebuilt-entry`、`h-selfcheck-shard-open`；`scripts/check/mutations.json`；`scripts/check/launches.json`（派生）；`package.json`（`compile` 一步、`esbuild` 写成直接依赖）与 `package-lock.json`；`docs/ARCHITECTURE.md` 锚点表三行、改一行；ADR-132、ADR-145 末尾各追加一块「已还」；本记录及生成的索引

---

## 一、做什么，分两片

**第一片（本条那条 PR）。** 换成 `prebuiltCommand` 的是这几处起法：变异起验证者（`mutate.ts` 的 `runTest`），自检起入口与工具（`selfcheck.ts` 的 `runBoth`）、拆进程跑起每一族的子进程（`runShards`），需求测试起自检的两组、起 `render` 的两处。不换的：`npm run` 各步本身（`package.json` 里写的就是 `tsx …`）；变异的 worker（照旧 `tsxCommand`）；临时目录里的玩具树（找不到缓存，第二节）；`NODE_OPTIONS` 里带着 tsx 加载器起的（下面第二片）。

**第二片（本片合入以后开，内容追加在本条末尾，索引不另加一行）。** 夹具经 `NODE_OPTIONS` 装 tsx 的加载器、在入口之前按 `.ts` 地址 import 产品模块做观察器的那几处，今天由 `bringsTsxLoader` 认出来、照旧 tsx：裸 node 起的话，入口经钩子 import 的产品模块与观察器经 tsx import 的是两份，观察器看到的不是入口用的那一份。第二片给这些观察器一个不靠 tsx 的加载办法，换掉自检里 9 处、需求测试里 3 处，外加需求测试里两处直接 `tsxCommand` 带着加载器起的。原型在同一台机器上量过：第二片在第一片之上再省 3.9–4.1 分钟（原型数，不在仓库里；第二片落地时照第六节重新量）。

两片都碰 `scripts/check/selfcheck.ts`，第二片等第一片合入（ADR-99 第 541 行）。

> ⚠️ 欠条（档：登记）：第二片是因为串行切片故意延后开的，主干上只有上面这一段记着它（ADR-75 第 117 行要的那张） · 重启条件：本条那条 PR 合入时 —— 开第二片；或决定不做第二片时，在本条末尾写明为什么、把上面那一段标成不做

## 二、怎么做

**缓存。** 放在仓库根的 `.check-cache/prebuilt/`（已被 `.gitignore` 挡着），一个 `.ts` 一份 `<键>.js`。键是 sha256(编译身份、`\0`、文件名、`\0`、正文)：**跟着正文走**，改一个字就是另一个键，没有「过期」这回事；**不含目录**，变异 worker 副本里没改的文件与真树里同名同内容的那一份共用。编译身份是 sha256(做法版本 `FORMAT`、esbuild 版本、目标 node 版本、`tsconfig.json` 的 `compilerOptions`) 的前 16 位，任一样变了，编出来的东西就可能不同，键跟着全换。编译选项照 tsx 给 esbuild 的那几项：esm、目标是当前 node、`keepNames`、`minifyWhitespace`；不带源码映射（第七节）。写一份是先写到旁边再改名，别的进程同时读这个键，读到的要么没有、要么是整份。

**谁的缓存。** 从那棵 `scripts/` 的上一层往上找第一个带 `.check-cache/prebuilt/` 的目录：真树找到仓库根；变异 worker 的副本在仓库根的 `.check-cache/mutate-jobs/` 底下，往上也找到仓库根；玩具树在临时目录里，找不到，照旧 tsx —— 与原型量数时同一个范围。

**什么时候裸起（`bareLaunch`）。** 样样成立才走：没设 `KOL_PREBUILT=0`；这个 node 自己能去掉类型（`process.features.typescript`，22.18 起默认开着，钩子是 `.ts`，靠的就是它）；起的是 `.ts`；`NODE_OPTIONS` 里没带 tsx 的加载器；找得到树与缓存；**整棵树每个 `.ts` 在缓存里都有现在这一版**。最后一样要走一遍树、给每个文件算键，按修改时间与大小记住，没变的不重读正文。缺一份（改了没重编、变异编不出来）就照旧 tsx：跑得慢，跑的东西不变。

**钩子：地址不换，只换内容。** 裸 node 经 `--import <钩子>?root=…&cache=…&id=…` 装上它。解析出来的仍是 `.ts` 的地址；加载时读这份 `.ts` 现在的正文、算出键，交给 Node 的是缓存里那个键的 JS。所以 `process.argv[1]`、`import.meta.url`、报错里的文件名都与 tsx 跑时一样是 `.ts`；按 `.ts` 地址 import 的与入口 import 的是同一份模块。缓存里没有现在这一版（起进程之后才改的，或者缓存被删了）就当场报错、点名那个文件，**不拿一份旧的顶上**。`./x.js` 在 `x.ts` 在时认 `x.ts`，与 tsx 一样；那棵树以外的一律交给下一个。钩子只 import `node:` 内建，靠 Node 自己去掉类型（与 `launch-preload.ts` 同一处境）；键怎么算只在它这里写一份，写缓存的一侧也从它拿。

**预编。** `npm run compile` 预编整棵树：缺的编上，不属于现在这一版的删掉，打一行写了几份、沿用几份、删了几份。类型对不上的话链在上一步 `npm run typecheck` 就停了。变异每条落盘后只把被改的那一个文件编进缓存（`prebuildOne`），编不出来、写不进去就什么也不写，这一条退回 tsx、照旧在那里报它的错；用完不删 —— 别的 worker 可能正跑着同一份，下一次预编整棵树时清掉。所以变异中途被打断也**没有东西要还原**。

**退出码。** tsx 的壳把里面那个进程的信号死亡报成退出码 128+N、信号为空；裸 node 没有壳。`asTsx` 照壳的样子换算裸起的那一份，读退出码的一侧（变异的判定与成本账、自检的 `runBoth` 与 `runShards`）不必分两种起法 —— 自检「被杀」那几条夹具认的是 137。

`esbuild` 原来只是 tsx 的依赖、碰巧被提到顶层，本条把它写成直接依赖（`^0.28.2`，与 tsx 4.23.12 要的 `~0.28.0` 是同一份）。

## 三、原型那一版的五处毛病，这一版怎么没有

原型把编出来的 `.js` 放在每个 `.ts` 旁边、在首次起进程时按一个整树的戳判新鲜。合并前的独立复核列了五件落地前必须改的，这一版换了做法，五件都不成立：

1. **复制 `scripts/` 的玩具树带走旧的 `.js`。** 现在 `.ts` 旁边什么也不放。Node 自己就能跑 `.ts`，旁边放着 `.js` 的话，哪天有一条起法绕过了判定，`./x.js` 就会认到那份旧的。
2. **「新鲜」记在进程里、永不作废。** 现在记住的只是「这个文件没改过」（修改时间与大小），而且只决定走不走裸 node；跑哪一份由钩子在加载时按正文现算，记错了也只会当场报错，不会跑错。
3. **戳只管源码、不管编译器。** 现在编译身份含 esbuild 版本、node 版本、`compilerOptions` 与做法版本。
4. **变异被打断时要把那份 `.js` 也还原。** 现在按正文寻址，不改任何已有的东西，没有要还原的。
5. **`import.meta.url` 变成了 `.js`。** 现在地址不换（第二节）。

复核另列的几件小事：128+N 的换算原型只在变异一侧做了，这一版自检两处也做（`asTsx`）；源码映射没带（第七节）；判新鲜那一遍树按修改时间与大小记住，不再每次重读。退回 tsx 时打一句话这一件没做：那句话打在起进程的一侧，变异与自检的输出里会多出几百行，而退回本身不改结论。

## 四、信号与退出钩子：两种起法不一样

裸 node 没有 tsx 的壳，也没有 tsx 预加载的那个信号处理。挨信号时退出钩子跑不跑，两种起法不同。玩具实测（tsx 4.23.12、Node 22.22.0；被测进程自成一组，信号发给整组；脚本附在本节末）：

| 起法 | 信号 | 被测进程当时 | 结束时 | 退出钩子 |
|---|---|---|---|---|
| 裸 node | `SIGINT`／`SIGTERM`／`SIGHUP` | 在事件循环里等 | 以那个信号结束 | 不跑 |
| 裸 node | `SIGTERM` | 卡在同步等子进程里 | 以 `SIGTERM` 结束，8–10 毫秒 | 不跑 |
| tsx | `SIGINT`／`SIGTERM` | 在事件循环里等 | 退出码 130／143 | 跑 |
| tsx | `SIGHUP` | 在事件循环里等 | 以 `SIGHUP` 结束 | 不跑 |
| tsx | `SIGTERM` | 卡在同步等子进程里 | 退出码 143（壳补的 `SIGKILL`），74–129 毫秒 | 不跑 |
| 裸 node，自己挂了 `SIGTERM` 处理 | `SIGTERM` | 卡在同步等子进程里 | 处理一直轮不上，剩下的步骤全跑完、以 0 退出，4.6 秒 | 正常结束时才跑 |

`finally` 哪一种都不跑。tsx 的两行与 ADR-132 第 344 行记的一致（只发给真进程或只发给壳，结果同上）。

**ADR-132 第 344 行那张欠条，本片还上。** 它说四处说法与实测不全符：`docs/ARCHITECTURE.md` 锚点表 `mutate-restore.ts` 那一行、`mutate-restore.ts` 文件头、`mutate.ts` 挂 `restoreClaims` 之后那段注释、`selfcheck.ts` 挂删临时目录那段注释，都笼统地说信号下退出钩子不跑。本片改了起法，这四处要说的话也跟着变：四处都改成上表的说法（裸 node 起时都不跑；经 tsx 起时只有 `SIGINT`／`SIGTERM` 落在没卡在同步等里、也没摘过处理的真进程上才跑），结论（要自己接管信号、别把退出钩子当成已保证的事）不变。

**ADR-70 第 1195 行那张欠条（被见齐就停的验证者留下的临时目录不清），本片没还，重挂。** 分派时给的修法是在 `selfcheck.ts` 挂一个 `SIGTERM` 处理，先删临时目录再退。上表最后一行说明它不成立：自检点名的那几组是同步跑完的（`runGroups` 逐组直接调），信号处理要等事件循环轮得上才跑。裸 node 起时，这个处理反而把「当场停」变成「跑到最后」，见齐就停省下的时间整段丢掉；tsx 起时，壳在 60 毫秒左右补一个 `SIGKILL`，处理同样轮不上，什么也没改。两种起法下目录今天都留着，本片没把它变多：同一台机器上整跑一次变异之后，系统临时目录里留下的 `kol-*` 目录数与大小见第六节第 3 条。

> ⚠️ 欠条（重挂 ADR-70 第 1195 行 · 档：登记）：被见齐就停的验证者留下的临时目录不清，两种起法都是（第四节那张表；数见第六节第 3 条）。真要清，得由变异一侧在验证者结束之后收：比如给每一跑一个自己的临时根，跑完整个删掉 —— 但那样 tsx 的编译缓存（也在系统临时目录里，没有环境变量能改）每跑都是冷的，玩具树那几处 tsx 起法会变慢，要先量 · 重启条件：留下的目录造成了后果（CI 或本机磁盘被它们占满、或者有夹具因为它们误红）；或下一条改变异停验证者那一刀（`stopIfSeen`）、或改自检临时目录归属的 PR

玩具脚本（在一个 `{"type":"module"}` 的目录里，`node drive.mjs <bare|tsx> <sync|async> <0|1>`；第二个脚本把被测进程换成只在事件循环里等 5 秒、带 `finally` 的那个，改发 `SIGINT`／`SIGHUP` 即得前四行）：

```js
// victim.ts —— 同步：每步 spawnSync sleep 0.3，共 20 步；异步：每 300 毫秒打一行
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const mark = process.env.MARK
if (process.env.HANDLER === '1') process.on('SIGTERM', () => { writeFileSync(`${mark}.handler`, '1'); process.exit(143) })
process.on('exit', () => writeFileSync(`${mark}.exit`, '1'))
if (process.env.MODE === 'sync') for (let i = 0; i < 20; i++) { spawnSync('sleep', ['0.3']); console.log('step', i) }
else { let i = 0; const t = setInterval(() => { console.log('tick', i++); if (i > 20) clearInterval(t) }, 300) }

// drive.mjs —— 自成一组起它，1.5 秒后给整组发 SIGTERM，记到 close 的毫秒数、退出码、两个记号文件在不在
import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
const [how, mode, handler] = process.argv.slice(2), mark = `/tmp/sigmark-${how}-${mode}-${handler}`
for (const s of ['.exit', '.handler']) rmSync(mark + s, { force: true })
const [exe, args] = how === 'bare' ? [process.execPath, ['victim.ts']] : ['<仓库>/node_modules/.bin/tsx', ['victim.ts']]
const kid = spawn(exe, args, { detached: true, stdio: 'pipe', env: { ...process.env, MARK: mark, MODE: mode, HANDLER: handler } })
let t0; setTimeout(() => { t0 = Date.now(); process.kill(-kid.pid, 'SIGTERM') }, 1500)
kid.on('close', (code, sig) => console.log(how, mode, handler, Date.now() - t0, code, sig, existsSync(mark + '.exit'), existsSync(mark + '.handler')))
```

## 五、拆进程跑打不开某一族的日志（ADR-132 第 324 行，本片还上）

那张欠条说：`runShards` 派工时打开某一族的日志排在 `spawn` 前面、在那个 `try` 外面，打不开时父进程以未捕获异常退出，不走「没起来」那条路，已起的几族成了孤儿。它与第 322 行（父进程先走、在跑的子进程没人收）一起被 ADR-145 第 1108 行重挂过，现行的是那一张。本片改的正是这几行（起法换成 `prebuiltCommand`），照条件还上打开日志这一半：打开日志挪进同一个 `try`；打不开时那一族报成「没起来」、带着原因，收尾那一段读不到日志当空、不再抛一次；父进程照常等其余各族交回、合并、打汇总。

新组 `h-selfcheck-shard-open` 守它：在一份只有 `scripts/` 与 `package.json` 的副本里跑完整、非变异的自检（只有它拆进程，而它会删认领与按族的启动计数，所以不在真树上跑），经 `NODE_OPTIONS` 注入一个让每一族的日志都打不开（`EMFILE`）的 `openSync`。于是一个子进程也不起，这一跑只花一次启动（本机约 2 秒）。断言以 1 结束、有带着 `EMFILE` 的「没起来」、打出了汇总，临时目录收干净。把打开日志挪回 `try` 外面（变异 `M-H63-a`），实测父进程以未捕获的 `EMFILE` 退出、一句「没起来」也没有、没有汇总，断言红。

父进程先走那一半本片没碰（起法换了，子进程不是 `detached`，父进程只挨了信号时它们照样各自跑完手上那一族），条件按字面响了（改 `runShards`），照原样重挂：

> ⚠️ 欠条（重挂 ADR-145 第 1108 行余下的一半 · 档：登记）：拆进程跑时父进程先走，在跑的子进程没人收（ADR-132 第 322 行、第 326 行那块实测与取舍） · 重启条件：父进程退出之后仍看到 `selfcheck.ts --only=` 子进程在跑并造成了后果；或下一条给 `selfcheck.ts` 加信号处理、改 `runShards` 或父子回报协议的 PR（重新起算）

## 六、实测

### 1. 一次起法本身

【待量】

### 2. 整条检查链，同一台机器前后各跑两次

【待量】

### 3. 整跑一次变异之后留在系统临时目录里的

【待量】

## 七、测试与变异

- `h-prebuilt`（进程内，读盘换成一张表）：键、编译身份、树与缓存主人、齐不齐、认不认 tsx 加载器、`bareLaunch` 样样成立才走且齐不齐最后才问、`asTsx`、钩子的解析与加载（含同前缀的兄弟目录不算树里、缓存没有就报错点名）。期望值照第二节手写，不取自实现的运行结果。
- `h-prebuilt-entry`（三次起进程）：在临时目录里搭一棵带缓存的小树，预编之后裸 node 装钩子跑，`./x.js` 认到 `x.ts`、`import.meta.url` 与 `argv[1]` 照旧是 `.ts`；拿改之前的那张参数表在改过之后再跑，钩子报错点名；改了没重编照旧 tsx；只编被改的那一个就又裸起、跑的是改过的；再预编整棵树沿用两份、删一份；`KOL_PREBUILT=0` 照旧 tsx。
- `h-selfcheck-shard-open`：第五节。
- 变异 `M-H62-a`…`M-H62-v`（22 条，都 `by: "test"`：两个模块都在自检的闭包里，`verifier-rule.ts`）、`M-H63-a`。没配变异的：`mutate.ts` 里每条变异之后那句 `prebuildOne` 拿掉，验证者退回 tsx，结论不变、只是慢 —— 断言看不见快慢，这一条靠第六节的数。

**源码映射没带。** 带上的话每次起法多约 0.02 秒（原型量的），而 `minifyWhitespace` 把代码压成几行，裸起的进程报错时栈里的行号、列号对不上 `.ts`。要看 tsx 原样的栈，设 `KOL_PREBUILT=0` 再跑那一条。

## 八、这一片的边界

- 没有死亡条件：这不是闸门（不拦路、不判任何东西，`process/README.md`「这把尺子只量闸门」那一段）。它是一个起法，跑的东西不变；哪天 tsx 自己起进程不再贵，删掉本条三个文件、把几处起法换回 `tsxCommand` 即可。
- 缓存只在 `npm run compile` 时整理；只跑 `npm test` 而没先预编的，缓存缺着就照旧 tsx。
- 判齐要走一遍树、给每个文件算一次键（记住了的只 `stat`），每个起进程的父进程每次都走：本机 `scripts/` 下 82 个 `.ts`，走一遍约【待量】毫秒。
