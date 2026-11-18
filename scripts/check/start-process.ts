/**
 * 通用启动函数（ADR-219）：别处起进程都经这里，不直接碰 `node:child_process`（ADR-217 的闸门管着）。
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

/** 要起的程序是不是 git：看路径末段，`/` 与 `\` 都算分隔 */
export function isGitProgram(file: string): boolean {
  const last = file.split(/[/\\]/).pop()
  return last === 'git' || last === 'git.exe'
}

function refuseGit(file: string): void {
  if (isGitProgram(file)) throw new Error(`通用启动函数不起 git（${file}）：调 git 走 git 入口（ADR-219）`)
}

// 参数形状照 Node：(程序, 参数数组?, 选项?)；选项在第二个位置时没有参数数组
function withoutShell(rest: readonly unknown[]): unknown[] {
  const [first, second] = rest
  if (Array.isArray(first) || (first == null && rest.length > 1)) return [first ?? [], { ...(second as object | undefined), shell: false }]
  return [[], { ...(first as object | undefined), shell: false }]
}

export const spawn: typeof cp.spawn = ((file: string, ...rest: unknown[]) => {
  refuseGit(file)
  return (cp.spawn as (...a: unknown[]) => cp.ChildProcess)(file, ...withoutShell(rest))
}) as typeof cp.spawn

export const spawnSync: typeof cp.spawnSync = ((file: string, ...rest: unknown[]) => {
  refuseGit(file)
  return (cp.spawnSync as (...a: unknown[]) => unknown)(file, ...withoutShell(rest))
}) as typeof cp.spawnSync

export const execFileSync: typeof cp.execFileSync = ((file: string, ...rest: unknown[]) => {
  refuseGit(file)
  return (cp.execFileSync as (...a: unknown[]) => unknown)(file, ...withoutShell(rest))
}) as typeof cp.execFileSync
