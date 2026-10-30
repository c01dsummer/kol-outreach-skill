/**
 * 零请求观察器装在入口进程里的那一半（KOL-21）。`observer-run.ts` 起入口时经 `--import` 排在 tsx 加载器之后加载，
 * 在入口模块求值之前装好；判定（脚本怎么应答、事件长什么样）在 `observer-rule.ts`。
 *
 * 观察只在主线程（入口代码跑的那一个）。启用前先删掉观察配置那个环境变量，入口和它起的进程都看不到它；`process.argv[1]`
 * 不是配置里那个目标入口就叫停。启用后先写 armed（本次运行的 id、进程号、入口路径、脚本与本文件的 SHA256、加载顺序、
 * 环境变量**名**、看得见的网卡），再把 `fetch` 换成按脚本应答的那一份 —— 每个请求在答之前先写一行事件；入口退出时写 close。
 *
 * 观察器看不到的执行上下文一律不许入口起（ADR-70 末尾「修复轮 1」）：主线程里换掉 `Worker` 的构造、`child_process` 起进程的
 * 那几个函数与 `process.execve`，一起就记故障、叫停。唯一放过的是加载器自己的 esbuild 服务线程 —— tsx 转译时由 esbuild 起，
 * 文件是 tsx 用的那份 esbuild 的 `lib/main.js`、`execArgv` 为空（不加载预加载、不跑入口代码）。armed 之后主线程把运行 id 与
 * 事件文件的描述符交给后起的线程（`setEnvironmentData`）：一个线程拿着这份交接还加载了本文件，就是绕过了构造那一道的入口线程，
 * 记一条故障、结束这个线程 —— 主线程照常收尾也判不了零请求通过。主线程启用之前就有的线程（加载器的）没有交接，这里什么也不装。
 *
 * **fail-closed**：没有配置、起的不是目标、脚本不合格、事件文件建不出来或写不进去、脚本外的请求、`fetch` 被换掉、
 * 绕过 `fetch` 去连网（`net` 连接、`dgram`、`dns` 查询与解析；`http`、`https`、`tls`、`http2` 都经 `net` 的连接）、
 * 起线程或子进程 —— 一律打一行 `OBSERVER_MARK` 开头的话、以 `OBSERVER_EXIT` 叫停入口，不答、不放行、不回落到真 fetch。
 * 入口吞掉连接失败也没用：故障在连接之前就记下了、入口当场叫停。记录里不写请求头、查询的值与完整 URL，只写方法、origin、
 * 路径与查询的键名。
 */
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import dgram from 'node:dgram'
import childProcess from 'node:child_process'
import workerThreads from 'node:worker_threads'
import { createHash } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  API_KEY_PLACEHOLDER, OBSERVER_EXIT, OBSERVER_MARK, answer, scriptProblems, type ResponseScript, type ScriptResponse,
} from './observer-rule.js'

// 加载这一刻的写函数：入口后来换掉 fs 的，事件照样写得进
const { openSync, writeSync, readFileSync, realpathSync } = fs
const { getEnvironmentData, isMainThread, setEnvironmentData, threadId } = workerThreads
const raw = process.env.KOL_OBSERVER
delete process.env.KOL_OBSERVER
/** 主线程交给后起线程的那一份（运行 id、事件文件的描述符）用的键 */
const HANDOFF = 'kol-observer'

let fd: number | undefined
let run = ''
/** 叫停。主线程里整个入口进程退出；别的线程里只结束那个线程 —— 故障已经记在事件里，判的一侧照样判观察器故障 */
function stop(why: string): never {
  try { writeSync(2, `${OBSERVER_MARK} ${why}\n`) } catch { /* 照样叫停 */ }
  process.exit(OBSERVER_EXIT)
}
/** 写一行事件；写不进去就叫停 —— 不能让一次没记下的请求被答出去 */
function put(event: Record<string, unknown>): void {
  if (fd === undefined) stop('事件文件没打开')
  try { writeSync(fd, `${JSON.stringify({ ...event, run, pid: process.pid })}\n`) } catch (e) { fd = undefined; stop(`事件写不进去：${String(e)}`) }
}

if (!isMainThread) {
  const handoff = getEnvironmentData(HANDOFF) as { run: string; fd: number } | undefined
  if (handoff !== undefined) {
    run = handoff.run; fd = handoff.fd
    put({ kind: 'fault', reason: '观察器之外的线程：入口绕过 Worker 那一道起了线程' })
    stop(`入口绕过 Worker 那一道起了线程 ${threadId}，观察器看不到那里的请求`)
  }
} else {
  if (raw === undefined) stop('没有观察配置')
  let target!: { run: string; events: string; script: string; target: string }
  try { target = JSON.parse(raw) } catch { stop('观察配置不是 JSON') }
  const real = (p: string) => { try { return realpathSync(p) } catch { return undefined } }
  if (process.argv[1] === undefined || real(process.argv[1]) === undefined || real(process.argv[1]) !== real(target.target)) stop('起的不是目标入口')
  let script!: ResponseScript, bytes!: Buffer
  try { bytes = readFileSync(target.script); script = JSON.parse(bytes.toString('utf8')) } catch (e) { stop(`读不出响应脚本：${String(e)}`) }
  const bad = scriptProblems(script)
  if (bad.length) stop(`响应脚本不合格：${bad.join('；')}`)
  run = target.run
  try { fd = openSync(target.events, 'wx') } catch (e) { stop(`事件文件建不出来：${String(e)}`) }
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  const key = process.env.TIKHUB_API_KEY
  put({ kind: 'armed', ppid: process.ppid, entry: real(process.argv[1]), script_sha256: sha(bytes),
    preload_sha256: sha(readFileSync(new URL(import.meta.url))), exec_argv: process.execArgv, node: process.version,
    env_names: Object.keys(process.env).sort(), api_key: key === undefined ? 'absent' : key === API_KEY_PLACEHOLDER ? 'placeholder' : 'other',
    net: Object.keys(networkInterfaces()).sort() })
  setEnvironmentData(HANDOFF, { run, fd })

  // 绕过 fetch 去连网的几条路：记一条故障、叫停。外层断网照样挡着，这里是让「绕过」看得见，不被入口当成普通连不上吞掉
  const deny = (what: string) => function (): never { put({ kind: 'fault', reason: `绕过 fetch 用了 ${what}` }); stop(`入口绕过 fetch 用了 ${what}`) }
  net.Socket.prototype.connect = deny('net.Socket.connect') as never
  dgram.Socket.prototype.send = deny('dgram.send') as never
  dgram.Socket.prototype.connect = deny('dgram.connect') as never
  const QUERY = /^(lookup|lookupService|reverse|resolve\w*)$/
  for (const [at, api] of [['dns', dns], ['dns.promises', dns.promises], ['dns.Resolver', dns.Resolver.prototype], ['dns.promises.Resolver', dns.promises.Resolver.prototype]] as const)
    for (const k of Object.getOwnPropertyNames(api)) if (QUERY.test(k)) (api as unknown as Record<string, unknown>)[k] = deny(`${at}.${k}`)

  // 入口起线程、子进程：那里发的请求观察器看不到，一起就记故障、叫停（fail-closed，不去观察它们）
  const refuse = (what: string) => function (): never { put({ kind: 'fault', reason: `入口起了观察器看不到的 ${what}` }); stop(`入口起了观察器看不到的 ${what}`) }
  for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const)
    (childProcess as unknown as Record<string, unknown>)[k] = refuse(`child_process.${k}`)
  Object.assign(childProcess.ChildProcess.prototype, { spawn: refuse('ChildProcess.spawn') })
  const proc = process as unknown as Record<string, unknown>
  if (typeof proc.execve === 'function') proc.execve = refuse('process.execve')
  // 加载器自己的 esbuild 服务线程：tsx 用的那份 esbuild 的 lib/main.js，execArgv 为空
  const esbuild = realpathSync(createRequire(createRequire(import.meta.url).resolve('tsx')).resolve('esbuild'))
  const loaderThread = (file: unknown, options: { execArgv?: unknown } | undefined): boolean => {
    try { return realpathSync(file instanceof URL ? fileURLToPath(file) : String(file)) === esbuild && Array.isArray(options?.execArgv) && options.execArgv.length === 0 } catch { return false }
  }
  const { Worker } = workerThreads
  Object.assign(workerThreads, { Worker: class extends Worker {
    constructor(file: string | URL, options?: ConstructorParameters<typeof Worker>[1]) {
      if (!loaderThread(file, options)) refuse('Worker 线程')()
      super(file, options)
    }
  } })
  syncBuiltinESMExports()

  const used: number[] = []
  let requests = 0
  const respond = (seq: number, r: Extract<ScriptResponse, { status: number }>): Response => {
    const body = r.body_read === 'fail'
      ? new ReadableStream({ pull(c) { c.error(new TypeError(`${OBSERVER_MARK} 脚本给的正文读取失败`)) } })
      : r.body_base64 !== undefined ? Buffer.from(r.body_base64, 'base64') : r.body !== undefined ? Buffer.from(r.body, 'utf8') : null
    const res = new Response(body, { status: r.status, headers: r.headers })
    for (const read of ['text', 'json', 'arrayBuffer', 'blob', 'bytes', 'formData'] as const) {
      const original = (res as unknown as Record<string, (() => Promise<unknown>) | undefined>)[read]
      if (typeof original !== 'function') continue
      Object.defineProperty(res, read, { value: async () => {
        try { const v = await original.call(res); put({ kind: 'body', seq, read, ok: true }); return v }
        catch (e) { put({ kind: 'body', seq, read, ok: false }); throw e }
      } })
    }
    return res
  }
  const observed = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: URL, method: string
    try {
      url = new URL(input instanceof Request ? input.url : String(input))
      method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    } catch { put({ kind: 'fault', reason: '请求的地址或方法读不出' }); return stop('请求的地址或方法读不出') }
    const seq = ++requests
    const got = answer(script, used, method, url.href)
    const event = { kind: 'request', seq, method, origin: url.origin, endpoint: url.pathname, query_keys: [...new Set(url.searchParams.keys())].sort() }
    if ('refused' in got) {
      put({ ...event, rule: got.rule, index: null, outcome: { refused: got.refused } })
      return stop(`脚本外的请求（${got.refused}）：${method} ${url.pathname}`)
    }
    used[got.rule] = got.index + 1
    const r = got.response
    put({ ...event, rule: got.rule, index: got.index, outcome: 'connect' in r ? { connect: 'fail' } : { status: r.status } })
    if ('connect' in r) throw new TypeError('fetch failed', { cause: Object.assign(new Error(`${OBSERVER_MARK} 脚本给的连接失败`), { code: 'ECONNREFUSED' }) })
    return respond(seq, r)
  }) as typeof fetch
  Object.defineProperty(globalThis, 'fetch', { configurable: false, enumerable: true, get: () => observed,
    set: () => { put({ kind: 'fault', reason: '入口换掉了 fetch' }); stop('入口换掉了 fetch') } })
  process.on('exit', code => {
    if (fd !== undefined) try { writeSync(fd, `${JSON.stringify({ kind: 'close', requests, code, run, pid: process.pid })}\n`) } catch { /* 少一行 close，读的一侧判不完整 */ }
  })
}
