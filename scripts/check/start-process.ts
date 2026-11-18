/**
 * 通用启动函数（ADR-219）：已挪过来的文件起进程都经这里（还没挪的见登记表），不直接碰 `node:child_process`（ADR-217 的闸门管着）。
 *
 * 只认一种写法：（程序, 参数数组, 选项?）。下面三种当场抛错，过了的参数原样交给 Node，一个字不改：
 * 1. 要起的程序末段是 `git`、`git.exe` —— 调 git 只许经 git 入口；看的是真要起的那个程序名，不猜。
 * 2. 选项要经 shell（`shell` 是真值，Node 自己就照真值判）—— 经 shell 起，命令串里起什么要读懂那串才知道，这里不读。
 * 3. 写法不是上面那一种（参数数组省了、选项挪到第二个位置、选项不是对象、多出第四个参数）。
 *    不替调用方把别的写法改成这一种：改写就得照 Node 每个函数各自怎么分参数去模仿，模仿不全就出错。
 *
 * 包的是 `spawn`、`spawnSync`、`execFileSync` 三个；`exec`、`execSync`、`fork`、`execFile` 不包（本仓库要挪的文件用不到，
 * 前两个只能经 shell）。函数是在调用时从模块上取的，计数预加载与观察器预加载换掉模块上的函数后照样数得到、拦得住。
 */
import cp from 'node:child_process'
export type { ChildProcess, SpawnOptions, SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process'

import { isGitProgram } from './launch-count.js'

const SHAPE = '通用启动函数只认（程序, 参数数组, 选项）一种写法：参数数组不能省（没有就写 []），选项放第三个位置、是对象（ADR-219）'

function checked(file: unknown, rest: readonly unknown[]): readonly unknown[] {
  // 程序名不是字符串的原样交给 Node：三个函数 Node 都先验程序名是字符串，不是就报它自己的参数类型错，进程起不来
  if (typeof file !== 'string') return rest
  if (isGitProgram(file)) throw new Error(`通用启动函数不起 git（${file}）：调 git 走 git 入口（ADR-219）`)
  const [args, options] = rest
  if (rest.length > 2 || !Array.isArray(args)) throw new Error(SHAPE)
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) throw new Error(SHAPE)
  if ((options as { shell?: unknown } | undefined)?.shell) throw new Error('通用启动函数不经 shell 起进程：去掉 shell 选项，程序与参数分开传（ADR-219）')
  return rest
}

export const spawn: typeof cp.spawn = ((file: unknown, ...rest: unknown[]) =>
  (cp.spawn as (...a: unknown[]) => cp.ChildProcess)(file, ...checked(file, rest))) as typeof cp.spawn

export const spawnSync: typeof cp.spawnSync = ((file: unknown, ...rest: unknown[]) =>
  (cp.spawnSync as (...a: unknown[]) => unknown)(file, ...checked(file, rest))) as typeof cp.spawnSync

export const execFileSync: typeof cp.execFileSync = ((file: unknown, ...rest: unknown[]) =>
  (cp.execFileSync as (...a: unknown[]) => unknown)(file, ...checked(file, rest))) as typeof cp.execFileSync
