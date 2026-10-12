/**
 * 计数预加载（ADR-145 第十三节第 1 小节）：数验证者进程**自己直接**起了几次子进程，与每行 ✓／✗ 写出时已经起了几次。
 *
 * 变异一步只在正常基线那一跑经 `NODE_OPTIONS` 的 `--import` 注入它（环境由 `launch-count.ts` 的 `countingEnv` 造），
 * 变异运行不注入。tsx 的壳也会加载它，但只在 `process.argv[1]` 就是验证者脚本的那个进程里启用；启用后先把
 * 自己的环境变量删掉、`NODE_OPTIONS` 还原，验证者起的子进程什么也不继承。
 *
 * **只照实记，不判。** 每次调用都记一行（起没起来都算一次），git 算不算由读日志那一侧定（`parseLaunchLog`）。
 * **从不打扰验证者**：写日志出错一律吞掉，少写的那一行会让结尾那行的两个数对不上，读的一侧判认不得。
 * 只 import `node:` 内建：tsx 壳里没有 tsx 的转换，这个文件靠 Node 自己去掉类型。
 */
import fs from 'node:fs'
import cp from 'node:child_process'
import util from 'node:util'
import { syncBuiltinESMExports } from 'node:module'
import { isMainThread } from 'node:worker_threads'

// 与 `launch-count.ts` 的 LAUNCH_COUNT_ENV、LAUNCH_APIS 是同一份约定；对不上时 `h-launch-preload` 那一组红
const ENV = 'LAUNCH_COUNT'
const APIS = ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork'] as const

const real = (p: string): string | undefined => { try { return fs.realpathSync(p) } catch { return undefined } }
const raw = process.env[ENV]
let count: { log: string; target: string; options?: string } | undefined
try { count = raw === undefined ? undefined : JSON.parse(raw) } catch { count = undefined }
const script = process.argv[1]

// worker 线程里也会加载这个文件（tsx 冷缓存时从那里起 esbuild），argv 未必认得出，所以另要求主线程
if (isMainThread && count !== undefined && script !== undefined && real(script) !== undefined && real(script) === real(count.target)) {
  delete process.env[ENV]
  if (count.options === undefined) delete process.env.NODE_OPTIONS
  else process.env.NODE_OPTIONS = count.options

  // 加载这一刻的 fs：需求测试里有几处会临时换掉 fs.*，换掉之后日志照样写得进去
  const { openSync, writeSync } = fs
  let fd: number | undefined
  try { fd = openSync(count.log, 'a') } catch { fd = undefined }
  let closed = false
  let launches = 0
  let prints = 0
  const emit = (event: object): void => {
    if (closed || fd === undefined) return
    try { writeSync(fd, JSON.stringify(event) + '\n') } catch { /* 不打扰验证者 */ }
  }

  // 深度保护：一次被包住的调用里面再调到的不记（exec 内部走 execFile，只记一次）
  let depth = 0
  const record = (api: string, args: unknown[]): void => {
    const opts = Array.isArray(args[1]) ? args[2] : args[1]
    const shell = opts !== null && typeof opts === 'object' && Boolean((opts as { shell?: unknown }).shell)
    launches++
    emit({ t: 'L', api, file: String(args[0]), ...(shell ? { shell: true } : {}) })
  }
  type Fn = (...args: unknown[]) => unknown
  const counted = (api: string, original: Fn): Fn => function (this: unknown, ...args: unknown[]) {
    if (depth > 0) return Reflect.apply(original, this, args)
    depth++
    try { record(api, args); return Reflect.apply(original, this, args) } finally { depth-- }
  }
  const mod = cp as unknown as Record<string, Fn & { [util.promisify.custom]?: Fn }>
  for (const api of APIS) {
    const original = mod[api]
    const wrapped = counted(api, original)
    Object.defineProperty(wrapped, 'name', { value: original.name })
    const custom = original[util.promisify.custom]
    if (typeof custom === 'function') Object.defineProperty(wrapped, util.promisify.custom, { value: counted(api, custom) })
    mod[api] = wrapped
  }
  syncBuiltinESMExports()

  // 每股各自按换行切：写完的一整行以 ✓／✗ 开头才记，没写完的半行不记（mutate 见齐就停也只认整行）
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write
    let pending = ''
    stream.write = function (this: unknown, chunk: unknown, ...rest: unknown[]) {
      try {
        pending += typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8')
        let at: number
        while ((at = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, at)
          pending = pending.slice(at + 1)
          const head = line.trimStart()
          if (head.startsWith('✓ ') || head.startsWith('✗ ')) { prints++; emit({ t: 'O', line }) }
        }
      } catch { /* 不打扰验证者 */ }
      return Reflect.apply(write, this, [chunk, ...rest])
    } as typeof stream.write
  }
  // 结尾一行写下两个数，之后什么也不再记：排在它后面的 exit 回调里打的行不算打印过（付费偏大，不偏小）
  process.on('exit', () => { emit({ t: 'E', launches, prints }); closed = true })
}
