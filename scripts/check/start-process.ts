/**
 * 通用启动函数（ADR-219）：已挪过来的文件起进程都经这里（还没挪的见登记表），不直接碰 `node:child_process`（ADR-217 的闸门管着）。
 *
 * 只做两件事，其余参数原样交给 Node：
 * 1. 要起的程序末段是 `git`、`git.exe` 就当场抛错 —— 调 git 只许经 git 入口；这里看的是真要起的那个程序名，不猜。
 * 2. 选项里的 `shell` 一律改成 `false`：经 shell 起，命令串里起什么要读懂那串才知道，这里不读。
 *
 * 包的是 `spawn`、`spawnSync`、`execFileSync` 三个；`exec`、`execSync`、`fork`、`execFile` 不包（本仓库要挪的文件用不到，
 * 前两个只能经 shell）。函数是在调用时从模块上取的，计数预加载与观察器预加载换掉模块上的函数后照样数得到、拦得住。
 */
import cp from 'node:child_process'
export type { ChildProcess, SpawnOptions, SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process'

import { isGitProgram } from './launch-count.js'

function refuseGit(file: unknown): void {
  // 程序名不是字符串的交给 Node 报它自己的参数类型错
  if (typeof file === 'string' && isGitProgram(file)) throw new Error(`通用启动函数不起 git（${file}）：调 git 走 git 入口（ADR-219）`)
}

// 参数怎么分，逐句照 Node 自己的 normalizeSpawnArguments（lib/child_process.js），不另猜：
// 第二个位置是数组就是参数数组、空值就是没有参数、别的对象就是选项（这时第三个位置 Node 不看）；
// 选项是空值、对象以外的东西，或第二个位置是对象以外的东西，都原样交给 Node，由它照常报错或照常处理
function withoutShell(rest: readonly unknown[]): unknown[] {
  let [args, options] = rest
  if (Array.isArray(args) || args == null) args = args ?? []
  else if (typeof args === 'object') { options = args; args = [] }
  else return [...rest]
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) return [...rest]
  return [args, { ...(options as object | undefined), shell: false }]
}

export const spawn: typeof cp.spawn = ((file: unknown, ...rest: unknown[]) => {
  refuseGit(file)
  return (cp.spawn as (...a: unknown[]) => cp.ChildProcess)(file, ...withoutShell(rest))
}) as typeof cp.spawn

export const spawnSync: typeof cp.spawnSync = ((file: unknown, ...rest: unknown[]) => {
  refuseGit(file)
  return (cp.spawnSync as (...a: unknown[]) => unknown)(file, ...withoutShell(rest))
}) as typeof cp.spawnSync

export const execFileSync: typeof cp.execFileSync = ((file: unknown, ...rest: unknown[]) => {
  refuseGit(file)
  return (cp.execFileSync as (...a: unknown[]) => unknown)(file, ...withoutShell(rest))
}) as typeof cp.execFileSync
