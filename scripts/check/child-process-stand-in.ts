/**
 * 起进程的替身（ADR-223）：测试要看「交没交给 Node、交了什么」时，经这里把 `node:child_process` 模块对象上的函数暂时换掉，
 * 一段套一段地用时，跑完一定换回。只许「测试文件」提到（登记表那一节，ADR-217 的闸门按名字认）。
 *
 * 为什么要有这一处：被测的几处（通用启动函数、git 入口、git 夹具、自检记当前目录那一处）都在调用时才从模块对象上取函数，
 * 测试得换掉模块对象上的函数才看得见它们交出去的是什么。以前测试文件自己拿着模块对象换，测试文件就得留在「待挪」里；
 * 现在拿模块对象的只有这里，测试文件只拿得到下面三种用法，拿不到原函数：
 *
 * 1. `withStandIns(stand-ins, body)`：换上调用方给的替身，替身拿不到原函数，被叫了也不真起进程。
 * 2. `withSpies(names, body)`：换上探子，记下每次收到的参数，再原样转给原函数（Node 照常起、照常报错）；交出来的只有记下的参数。
 * 3. `withRestore(names, body)`：先记下原样，body 里被测的代码自己去换（如自检那一处）；body 只能问「这个名字现在换成了什么」，
 *    还没被换的问不出东西（不交原函数）。
 *
 * 三种都是进入时记下原函数、在 `finally` 里换回，再 `syncBuiltinESMExports`（被测的代码若让按名字导入的绑定一起换了，换回后也一起回来）。
 * body 还的是 Promise（或别的带 then 的对象）时，等它了结（成或败）再换回，交回一个了结得一样的新 Promise；不是 Promise 的，交回的就是 body 的结果。
 * 只许一段套一段地用：两段交叠（先进的先了结）时，先了结的那段换回当场抛错，不悄悄拆掉别的段的替身。
 * 名字只认下面七个起进程的函数，别的当场抛错；替身要是函数；探子不探 `exec`、`execFile`（它们自带的 promisify 版本带不过去）。
 */
import cp from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'

/** 能换的名字：`node:child_process` 上起进程的七个函数 */
export const STAND_IN_APIS = ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork'] as const
export type StandInName = typeof STAND_IN_APIS[number]
type Fn = (...args: any[]) => any

const live = cp as unknown as Record<string, unknown>

function known(names: readonly string[]): readonly StandInName[] {
  const bad = names.filter(n => !(STAND_IN_APIS as readonly string[]).includes(n))
  if (bad.length) throw new Error(`替身只换起进程的这几个函数：${STAND_IN_APIS.join('、')}；不认 ${bad.join('、')}（ADR-223）`)
  return names as readonly StandInName[]
}

/** 正在换着的几段，先进的在前。换回只许最后进的那一段换：两段交叠（例如 Promise.all 里并排两段）时，先了结的那段换回会把后一段的替身拆掉、后一段再换回会把前一段的替身装回去 */
const open: object[] = []

/** 记下原样 → install → 跑 body → 换回（body 还 Promise 的，等它了结再换回） */
function swapped<T>(names: readonly StandInName[], install: (kept: ReadonlyMap<StandInName, Fn>) => void, body: () => T): T {
  const kept = new Map(names.map(n => [n, live[n] as Fn] as const))
  const me = {}
  const restore = () => {
    if (open.at(-1) !== me) {
      const at = open.indexOf(me)
      if (at >= 0) open.splice(at, 1)
      throw new Error('两段替身交叠：先了结的这一段不是最后换上的那一段，换回会拆掉别的段的替身；只许一段套一段地用（ADR-223）')
    }
    open.pop()
    for (const [n, f] of kept) live[n] = f; syncBuiltinESMExports()
  }
  open.push(me)
  let later = false
  try {
    install(kept)
    const result = body()
    if (result !== null && typeof result === 'object' && typeof (result as { then?: unknown }).then === 'function') {
      later = true
      return Promise.resolve(result).finally(restore) as T
    }
    return result
  } finally { if (!later) restore() }
}

/** 换上替身跑 body，跑完换回。替身拿不到原函数 */
export function withStandIns<T>(standIns: Partial<Record<StandInName, Fn>>, body: () => T): T {
  const names = known(Object.keys(standIns))
  const notFn = names.filter(n => typeof standIns[n] !== 'function')
  if (notFn.length) throw new Error(`替身要是函数：${notFn.join('、')} 不是（ADR-223）`)
  return swapped(names, () => { for (const n of names) live[n] = standIns[n] }, body)
}

/** 一次调用：哪个函数、收到的参数（新数组，元素原样） */
export type Heard = readonly [StandInName, readonly unknown[]]

/** 换上探子跑 body：记下每次收到的参数再原样转给原函数。body 拿到的是一直在长的记录 */
export function withSpies<T>(names: readonly StandInName[], body: (heard: readonly Heard[]) => T): T {
  // exec、execFile 自带 promisify 的版本（交回 { stdout, stderr }），探子不带它，promisify 出来的形状就变了：不给探
  const custom = known(names).filter(n => n === 'exec' || n === 'execFile')
  if (custom.length) throw new Error(`探子不探 ${custom.join('、')}：它们自带的 promisify 版本探子带不过去（ADR-223）`)
  const heard: Heard[] = []
  return swapped(names, kept => {
    for (const [n, original] of kept) live[n] = function (this: unknown, ...args: unknown[]) { heard.push([n, [...args]]); return original.apply(this, args) }
  }, () => body(heard))
}

/** 记下原样跑 body，跑完换回。body 只能问某个名字现在换成了什么；没被换过的交 undefined */
export function withRestore<T>(names: readonly StandInName[], body: (replaced: (name: StandInName) => Fn | undefined) => T): T {
  let kept: ReadonlyMap<StandInName, Fn> = new Map()
  return swapped(known(names), k => { kept = k }, () => body(name => {
    const now = live[name] as Fn
    return kept.has(name) && now !== kept.get(name) ? now : undefined
  }))
}
