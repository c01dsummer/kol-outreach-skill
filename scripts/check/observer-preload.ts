/**
 * 零请求观察器装在入口进程里的那一半（KOL-21）。`observer-run.ts` 起入口时经 `--import` 排在 tsx 加载器之后加载，
 * 在入口模块求值之前装好；判定（脚本怎么应答、事件长什么样）在 `observer-rule.ts`。
 *
 * 只在主线程启用（tsx 冷缓存时在 worker 线程里起 esbuild，那里什么也不装）。启用前先删掉观察配置那个环境变量，
 * 入口和它起的进程都看不到它；`process.argv[1]` 不是配置里那个目标入口就叫停。启用后先写 armed（本次运行的 id、
 * 进程号、入口路径、脚本与本文件的 SHA256、加载顺序、环境变量**名**、看得见的网卡），再把 `fetch` 换成按脚本应答的
 * 那一份 —— 每个请求在答之前先写一行事件；入口退出时写 close。
 *
 * **fail-closed**：没有配置、起的不是目标、脚本不合格、事件文件建不出来或写不进去、脚本外的请求、`fetch` 被换掉、
 * 绕过 `fetch` 去连网 —— 一律打一行 `OBSERVER_MARK` 开头的话、以 `OBSERVER_EXIT` 叫停入口，不答、不放行、不回落到真 fetch。
 * 记录里不写请求头、查询的值与完整 URL，只写方法、origin、路径与查询的键名。
 */
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import dgram from 'node:dgram'
import { createHash } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { syncBuiltinESMExports } from 'node:module'
import { isMainThread } from 'node:worker_threads'
import {
  API_KEY_PLACEHOLDER, OBSERVER_EXIT, OBSERVER_MARK, answer, scriptProblems, type ResponseScript, type ScriptResponse,
} from './observer-rule.js'

// 加载这一刻的写函数：入口后来换掉 fs 的，事件照样写得进
const { openSync, writeSync, readFileSync, realpathSync } = fs
const raw = process.env.KOL_OBSERVER
delete process.env.KOL_OBSERVER

let fd: number | undefined
let run = ''
function stop(why: string): never {
  try { writeSync(2, `${OBSERVER_MARK} ${why}\n`) } catch { /* 照样叫停 */ }
  process.exit(OBSERVER_EXIT)
}
/** 写一行事件；写不进去就叫停 —— 不能让一次没记下的请求被答出去 */
function put(event: Record<string, unknown>): void {
  if (fd === undefined) stop('事件文件没打开')
  try { writeSync(fd, `${JSON.stringify({ ...event, run, pid: process.pid })}\n`) } catch (e) { fd = undefined; stop(`事件写不进去：${String(e)}`) }
}

if (isMainThread) {
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

  // 绕过 fetch 去连网的几条路：记一条故障、叫停。外层断网照样挡着，这里是让「绕过」看得见，不被入口当成普通连不上吞掉
  const deny = (what: string) => function (): never { put({ kind: 'fault', reason: `绕过 fetch 用了 ${what}` }); stop(`入口绕过 fetch 用了 ${what}`) }
  net.Socket.prototype.connect = deny('net.Socket.connect') as never
  dgram.Socket.prototype.send = deny('dgram.send') as never
  dns.lookup = deny('dns.lookup') as never
  dns.promises.lookup = deny('dns.promises.lookup') as never
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
