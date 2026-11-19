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

import type { Readable, Writable } from 'node:stream'

import { isGitProgram } from './launch-count.js'

const SHAPE = '通用启动函数只认（程序, 参数数组, 选项）一种写法：参数数组不能省（没有就写 []），选项放第三个位置、是对象（ADR-219）'

function checked(file: unknown, rest: readonly unknown[]): readonly unknown[] {
  // 程序名不是字符串的原样交给 Node：Node 起进程前一定验程序名，不是字符串就报错、进程起不来；同时错了几个参数时先报哪个由 Node 定
  if (typeof file !== 'string') return rest
  if (isGitProgram(file)) throw new Error(`通用启动函数不起 git（${file}）：调 git 走 git 入口（ADR-219）`)
  const [args, options] = rest
  if (rest.length > 2 || !Array.isArray(args)) throw new Error(SHAPE)
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) throw new Error(SHAPE)
  if ((options as { shell?: unknown } | undefined)?.shell) throw new Error('通用启动函数不经 shell 起进程：去掉 shell 选项，程序与参数分开传（ADR-219）')
  return rest
}

// 类型只留带参数数组的那几种写法：省掉参数数组、选项挪到第二个位置的，编译时就报，不等跑到那一句才抛。返回类型照 Node 自己的签名
type In<T> = T extends cp.StdioPipe ? Writable : null
type Out<T> = T extends cp.StdioPipe ? Readable : null
type Std = cp.StdioNull | cp.StdioPipe
interface Spawn {
  (command: string, args: readonly string[], options?: cp.SpawnOptionsWithoutStdio): cp.ChildProcessWithoutNullStreams
  <I extends Std, O extends Std, E extends Std>(command: string, args: readonly string[], options: cp.SpawnOptionsWithStdioTuple<I, O, E>): cp.ChildProcessByStdio<In<I>, Out<O>, Out<E>>
  (command: string, args: readonly string[], options: cp.SpawnOptions): cp.ChildProcess
}
interface SpawnSync {
  (command: string, args: readonly string[]): cp.SpawnSyncReturns<NonSharedBuffer>
  (command: string, args: readonly string[], options: cp.SpawnSyncOptionsWithStringEncoding): cp.SpawnSyncReturns<string>
  (command: string, args: readonly string[], options: cp.SpawnSyncOptionsWithBufferEncoding): cp.SpawnSyncReturns<NonSharedBuffer>
  (command: string, args: readonly string[], options?: cp.SpawnSyncOptions): cp.SpawnSyncReturns<string | NonSharedBuffer>
}
interface ExecFileSync {
  (file: string, args: readonly string[]): NonSharedBuffer
  (file: string, args: readonly string[], options: cp.ExecFileSyncOptionsWithStringEncoding): string
  (file: string, args: readonly string[], options: cp.ExecFileSyncOptionsWithBufferEncoding): NonSharedBuffer
  (file: string, args: readonly string[], options?: cp.ExecFileSyncOptions): string | NonSharedBuffer
}

export const spawn: Spawn = ((file: unknown, ...rest: unknown[]) =>
  (cp.spawn as (...a: unknown[]) => cp.ChildProcess)(file, ...checked(file, rest))) as Spawn

export const spawnSync: SpawnSync = ((file: unknown, ...rest: unknown[]) =>
  (cp.spawnSync as (...a: unknown[]) => unknown)(file, ...checked(file, rest))) as SpawnSync

export const execFileSync: ExecFileSync = ((file: unknown, ...rest: unknown[]) =>
  (cp.execFileSync as (...a: unknown[]) => unknown)(file, ...checked(file, rest))) as ExecFileSync
