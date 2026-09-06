/**
 * 起一个跑 `.ts` 的子进程要用的那条命令 —— **全仓只此一份。**
 *
 * 三处都要起 tsx，等法各不一样（自检同步等、还要两股分开收；测试同步等一股；
 * 变异异步等、还要自成一组）。**不一样的是等法，一样的是「起哪个可执行文件、
 * 前面垫哪些参数」** —— 只有后者搬进来。代跑的话这里就得装下三种等法，
 * 而那正是三处各自的语义。
 *
 * ## 为什么值得只此一份
 *
 * 三处原先各写各的，而且**各错各的**：
 *
 * | 原先那一行 | 在 Windows 上怎么坏 |
 * |---|---|
 * | `spawn('npx', ['tsx', …])`（`mutate.ts`，PR #73 已改） | `npx` 是 `npx.cmd`，而 **`.cmd` 不带 shell 根本起不来** —— Node 文档写着「`.bat` 和 `.cmd` 在 Windows 上没有终端就不能自己执行」 |
 * | `spawnSync('npx', ['tsx', …])`（`selfcheck.ts`） | 同上 |
 * | `spawnSync('node_modules/.bin/tsx', …)`（`test.ts`） | libuv 只按**文件名段**找扩展名（`.bin` 里那个点不算），无扩展名就只试 `tsx.com` / `tsx.exe`；而 npm 在 Windows 生成的是 `tsx.cmd` / `tsx.ps1` / `tsx`(sh shim) |
 *
 * #73 只修了第一处就收工，于是同一个坑在另外两处原样留着 —— ADR-69 第一块欠条记的
 * 就是这件事，而它自己写明修法是「三处抽一份共用的『怎么起 tsx』**一起改**」：
 * 同一份证据，按 `process/6-INTEGRATE.md` 的切分判据是**一个**改动。
 * 只改其中一处就是又一次「只修实例」（ADR-45 / ADR-69 的教训一节骂的正是这个）。
 *
 * ## 摆在桌上的三条路，为什么选当前这条
 *
 * | 做法 | 判定 |
 * |---|---|
 * | 显式挑 `npx.cmd` | **走不通**。不带 shell 起不来的正是 `.cmd` 这类文件，挑明名字也一样 |
 * | `spawn(..., { shell: true })` | 能跑，但要经 `cmd.exe`，而 DEP0190 的正文点名了 `spawn`：带 shell 传参数数组时，各个值**不转义、只用空格拼起来，会导致 shell 注入**。也就是说注入面不是「拼字符串才有」，是这条路自带的。（本仓库钉的是 Node v22，那里 DEP0190 是 Documentation-only；v24+ 的 `.cmd` 那一节才写着「不推荐」——**结论不受版本影响**，注入那句在 v22 文档里就在） |
 * | **当前 node + tsx 的 cli** | 不经 shell，也就没有注入面可争论；`.cmd` 压根不参与；还少一层进程 |
 *
 * ⚠️ **本仓库的 CI 只跑 Linux（`.github/workflows/*.yml` 的 `runs-on` 全是
 * `ubuntu-latest`），所以上面关于 Windows 的话没有任何自动化验过。** 它靠的是
 * Node 官方文档 + 代码推理，不是一次真的 Windows 运行。Linux 这一侧是真跑过的。
 *
 * ⚠️ 这一条只解决**「起不起得来」**。Windows 上「怎么把它停下来」是另一个坑，
 * 还欠着（ADR-69 第二块：`mutate-restore.ts` 的 `process.kill(-pid)` 配的是
 * POSIX 的进程组语义，而 `detached` 在 Windows 上给的是一个控制台窗口，不是进程组）。
 */
import { createRequire } from 'node:module'

/**
 * tsx 的 cli 入口。
 *
 * `tsx/cli` 是 tsx 包的**公开导出**（它的 `exports` 里有 `"./cli"`），所以用
 * `require.resolve` 拿路径，不把 `node_modules/tsx/dist/…` 这种内部路径写死 ——
 * 写死的那种升一次版就指空，而且指空的样子是「起不来」，不是「说不出为什么」。
 *
 * 认的是 `import.meta.url`，**不是 `process.cwd()`**：自检有几处切到临时目录里跑，
 * 按 cwd 找会找到临时目录那一侧去。
 */
const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli')

/**
 * 跑这几个参数要用的 `[可执行文件, 参数表]`，直接摊给 `spawn` / `spawnSync`。
 *
 * `process.execPath` 就是正在跑这个进程的那个 node —— 子进程的版本不会和父进程错开，
 * 也不经 `PATH`，于是「装了哪个 node」和「跑的是哪个 node」不再是两件事。
 */
export const tsxCommand = (args: string[]): [string, string[]] =>
  [process.execPath, [TSX_CLI, ...args]]
