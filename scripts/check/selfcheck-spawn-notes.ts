/**
 * 自检记当前目录（ADR-212）用的那一处包装，从 `selfcheck.ts` 挪出来单独登记（ADR-222）：要把起进程的那几个函数
 * 换成「先告诉自检这一次的参数，再原样起」，只能直接拿到起子进程的那个模块（理由同 `launch-preload.ts`）。
 *
 * `noteSpawns(onLaunch)` 换掉模块对象上的七个函数，再 `syncBuiltinESMExports` 让按名字导入的绑定一起换。
 * 换上的函数保留原来的名字；`exec`、`execFile` 自带的 promisify 版本一并带过来、也先告诉一声（否则 `promisify(execFile)`
 * 拿到的结果形状会变）；交回原函数的返回值，一个字不改。`onLaunch` 拿到的是这一次的全部参数，怎么记由自检定。
 */
import cp from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { promisify } from 'node:util'

/** 换掉的那几个函数（与 `launch-preload.ts` 的 APIS 同一份） */
export const NOTED_APIS = ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork'] as const

export function noteSpawns(onLaunch: (args: unknown[]) => void): void {
  type Fn = (...a: unknown[]) => unknown
  const mod = cp as unknown as Record<string, Fn & { [promisify.custom]?: Fn }>
  const noted = (f: Fn): Fn => function (this: unknown, ...a: unknown[]) { onLaunch(a); return f.apply(this, a) }
  for (const name of NOTED_APIS) {
    const original = mod[name]
    const wrapped = noted(original)
    Object.defineProperty(wrapped, 'name', { value: original.name })
    const custom = original[promisify.custom]
    if (typeof custom === 'function') Object.defineProperty(wrapped, promisify.custom, { value: noted(custom) })
    mod[name] = wrapped
  }
  syncBuiltinESMExports()
}
