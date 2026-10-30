/**
 * 零请求观察器的运行器（KOL-21）：认证外层断网、在认证过的沙箱里起真实入口、收证据、交给 `observer-rule.ts` 判。
 *
 * 入口一律用参数数组起、不经 shell：`bwrap <布局> -- <node> --import <tsx 加载器> --import <observer-preload.ts> <入口> <参数>`。
 * 环境从空表起（`observerEnv`），不继承调用方的任何变量；沙箱的根是空的，只照搬系统目录、node 与仓库里入口要读的四样，
 * gh 配置目录与仓库根的 `.env`、`.env.local` 盖住。断网用 bwrap `--unshare-net`，不靠换掉 fetch；认证不了就不起入口，
 * 不降级成「只靠换 fetch」或共享网络（`runObserved` 只认 `certifyIsolation` 交出的那一份认证）。
 * 每次运行一个新的证据目录：脚本原字节、参数表、事件文件、两股输出与退出码都落在那里，判的结果也写进去。
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { constants, homedir } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  ENTRIES, MASKED_FILES, REPO_PATHS, SYSTEM_PATHS, ghDirs, judgeRun, layoutId, netcutProblems, observerEnv, rwProblems, scriptProblems, sandboxArgs,
  type ApiKey, type Layout, type Observation, type ObserverEntry, type PathFact, type ProbeReport, type ResponseScript,
} from './observer-rule.js'

const REPO = realpathSync(fileURLToPath(new URL('../../', import.meta.url)))
// 预加载不是 import 进来的，是经 --import 装进入口进程的；验证基础设施闭包按源码里的 from 抽边（注释里的也算，
// `verifier-rule.ts`），这一句把它算进闭包：from './observer-preload.js'
const PRELOAD = fileURLToPath(new URL('./observer-preload.ts', import.meta.url))
const TSX = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
const NODE = realpathSync(process.execPath)
const EXEC_ARGV = ['--import', TSX, '--import', pathToFileURL(PRELOAD).href]
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
/** 新建一个证据目录；已经存在就不用（旧证据不覆盖，也不和新的混在一起） */
const fresh = (dir: string): boolean => { if (!isAbsolute(dir) || existsSync(dir)) return false; mkdirSync(dir, { recursive: true }); return true }

/** 一份断网认证。只有 `certifyIsolation` 交得出来，`runObserved` 认的就是它交出的那几个对象 */
export interface Isolation { readonly id: string; readonly bwrap: string; readonly layout: Layout }
const issued = new WeakSet<Isolation>()
export type Certification = { certified: true; isolation: Isolation; problems: string[]; evidenceDir: string }
  | { certified: false; problems: string[]; evidenceDir: string }

const fact = (path: string, at = path): PathFact => {
  try {
    const st = lstatSync(at)
    return st.isSymbolicLink() ? { path, kind: 'symlink', target: readlinkSync(at) } : { path, kind: st.isDirectory() ? 'dir' : 'file' }
  } catch { return { path, kind: 'absent' } }
}
const layoutNow = (): Layout => ({ system: SYSTEM_PATHS.map(p => fact(p)), node: dirname(dirname(NODE)), repoRoot: REPO,
  repo: REPO_PATHS.map(p => fact(p, join(REPO, p))), ghDirs: ghDirs(process.env.HOME ?? homedir(), process.env) })

// 受控目标：宿主 127.0.0.1 上随机端口的监听，收到一行令牌就记下、回 ack；只在认证那一刻活着
const LISTENER = `import net from 'node:net'; import fs from 'node:fs'
const [portFile, seenFile] = process.argv.slice(2)
const server = net.createServer(sock => { let buf = ''; sock.setEncoding('utf8'); sock.on('error', () => {})
  sock.on('data', d => { buf += d; const i = buf.indexOf('\\n'); if (i >= 0) { fs.appendFileSync(seenFile, buf.slice(0, i) + '\\n'); sock.end('ack:' + buf.slice(0, i) + '\\n') } }) })
server.listen(0, '127.0.0.1', () => { fs.writeFileSync(portFile + '.tmp', String(server.address().port)); fs.renameSync(portFile + '.tmp', portFile) })
process.on('SIGTERM', () => process.exit(0)); setTimeout(() => process.exit(3), 60000)
`
// 受控拒绝探针：连受控目标、发令牌、等 ack；另报网卡名、环境变量名与盖住的路径是不是空的（只看类型与条目数，不读内容）
const PROBE = `import net from 'node:net'; import fs from 'node:fs'; import os from 'node:os'
const [port, token, masks] = process.argv.slice(2), seen = {}
for (const p of JSON.parse(masks)) { try { const st = fs.lstatSync(p)
  seen[p] = st.isDirectory() ? { dir: fs.readdirSync(p).length } : st.isFile() ? { file: st.size } : { other: st.isSymbolicLink() ? 'symlink' : 'special' } }
  catch (e) { seen[p] = { absent: e.code ?? String(e) } } }
const report = (result, code) => { process.stdout.write(JSON.stringify({ result, ...(code ? { code } : {}),
  interfaces: Object.keys(os.networkInterfaces()).sort(), env: Object.keys(process.env).sort(), masks: seen }) + '\\n'); process.exit(0) }
const sock = net.connect({ host: '127.0.0.1', port: Number(port) }), timer = setTimeout(() => { sock.destroy(); report('timeout') }, 3000)
let buf = ''; sock.setEncoding('utf8')
sock.on('connect', () => sock.write(token + '\\n'))
sock.on('data', d => { buf += d; if (buf.includes('\\n')) { clearTimeout(timer); report(buf.trim() === 'ack:' + token ? 'acked' : 'mismatch') } })
sock.on('error', e => { clearTimeout(timer); report('error', e.code) })
sock.on('end', () => { clearTimeout(timer); report('mismatch') })
`
const BWRAPS = ['/usr/bin/bwrap', '/bin/bwrap', '/usr/local/bin/bwrap']

/**
 * 认证外层断网：同一个探针在断网外连宿主上的受控目标要连上，在断网里（与入口同一套布局）要被拒，目标那一侧两边都要对得上。
 * 认证不了照实交回问题，不抛；`bwrap` 只为了让测试能换一个假的进来，缺省按固定的几个位置找。
 */
export function certifyIsolation(o: { evidenceDir: string; bwrap?: string }): Certification {
  const dir = o.evidenceDir, no = (problems: string[]): Certification => {
    try { writeFileSync(join(dir, 'verdict.json'), json({ certified: false, problems })) } catch { /* 证据目录本身不成立时写不进 */ }
    return { certified: false, problems, evidenceDir: dir }
  }
  if (!fresh(dir)) return { certified: false, problems: [`证据目录 ${dir} 不是绝对路径或已经存在`], evidenceDir: dir }
  const bwrap = o.bwrap ?? BWRAPS.find(p => existsSync(p))
  if (bwrap === undefined) return no([`找不到 bwrap（${BWRAPS.join('、')}）：外层断网起不来`])
  let tool: { path: string; sha256: string; version: string }
  try {
    const path = realpathSync(bwrap), v = spawnSync(path, ['--version'], { encoding: 'utf8', env: {} })
    tool = { path, sha256: sha(readFileSync(path)), version: (v.stdout ?? '').trim() }
  } catch (e) { return no([`bwrap 读不出：${String(e)}`]) }
  const layout = layoutNow(), empty = join(dir, 'empty'), probe = join(dir, 'probe.mjs'), listener = join(dir, 'listener.mjs')
  const unsafe = rwProblems(layout, [realpathSync(dir)])
  if (unsafe.length) return no(unsafe)
  const port = join(dir, 'listener.port'), seenFile = join(dir, 'listener.seen')
  writeFileSync(empty, ''); writeFileSync(probe, PROBE); writeFileSync(listener, LISTENER); writeFileSync(seenFile, '')
  const env = observerEnv({ nodeBin: dirname(NODE), home: '/tmp', tmp: '/tmp', tsconfig: join(REPO, 'tsconfig.json'), apiKey: 'placeholder' })
  const masks = { dirs: layout.ghDirs, files: MASKED_FILES.map(f => join(REPO, f)) }
  const tokens = { outside: `outside-${randomBytes(8).toString('hex')}`, inside: `inside-${randomBytes(8).toString('hex')}` }
  const target = spawn(NODE, [listener, port, seenFile], { env, stdio: 'ignore' })
  target.on('error', () => { /* 起不来时下面等不到端口，按「受控目标没起来」报 */ })
  let started = target.pid !== undefined
  for (let i = 0; started && !existsSync(port) && i < 250; i++) pause(20)
  started &&= existsSync(port)
  const at = started ? readFileSync(port, 'utf8') : ''
  // 断网外：不进沙箱，盖住的路径不看（宿主上那几处一个字节也不碰）；断网里：与入口同一套布局，只多一个可写的证据目录
  const outside = started ? spawnSync(NODE, [probe, at, tokens.outside, '[]'], { env, encoding: 'utf8', timeout: 10_000 }) : undefined
  const insideArgv = [...sandboxArgs(layout, { empty, rw: [dir], chdir: dir }), '--', NODE, probe, at, tokens.inside, JSON.stringify([...masks.dirs, ...masks.files])]
  const inside = started ? spawnSync(tool.path, insideArgv, { env, encoding: 'utf8', timeout: 10_000 }) : undefined
  // 监听在回 ack 之前先记下令牌：两个探针都已结束，记录此刻已经写全，不必等它退出
  target.kill('SIGTERM')
  const seen = readFileSync(seenFile, 'utf8').split('\n').filter(Boolean)
  const parsed = (r: typeof outside): ProbeReport | undefined => { try { return r?.status === 0 ? JSON.parse(r.stdout) : undefined } catch { return undefined } }
  const facts = { outside: parsed(outside), inside: parsed(inside), seen, tokens, masks,
    insideError: inside === undefined ? '受控目标没起来' : inside.error ? String(inside.error) : `退出码 ${inside.status}，stderr：${inside.stderr.trim()}` }
  writeFileSync(join(dir, 'probe-outside.json'), json({ status: outside?.status, stdout: outside?.stdout, stderr: outside?.stderr }))
  writeFileSync(join(dir, 'probe-inside.json'), json({ argv: [tool.path, ...insideArgv], status: inside?.status, stdout: inside?.stdout, stderr: inside?.stderr }))
  writeFileSync(join(dir, 'layout.json'), json({ bwrap: tool, layout, env: Object.keys(env).sort() }))
  const problems = [...(started ? [] : ['受控目标没起来：认证不了']), ...netcutProblems(facts)]
  if (problems.length) return no(problems)
  const isolation: Isolation = { id: layoutId(layout, tool), bwrap: tool.path, layout }
  issued.add(isolation)
  writeFileSync(join(dir, 'verdict.json'), json({ certified: true, id: isolation.id, problems: [] }))
  return { certified: true, isolation, problems: [], evidenceDir: dir }
}

/** 一次观察：判的结果，加上证据目录、运行身份与两股输出 */
export interface ObservedRun extends Observation { run: string; evidenceDir: string; status: number | null; signal: string | null; stdout: string; stderr: string }
export interface RunOptions {
  isolation: Isolation
  /** 四个真实入口之一；`control` 是观察器自带的对照夹具（参数 `[模式, URL]`，模式 `fetch`／`close-channel`／`kill`） */
  entry: ObserverEntry | 'control'
  args: readonly string[]
  /** 入口的当前目录，绝对路径；入口读写的东西都放在它底下 —— 沙箱里可写、看得见的只有它与证据目录 */
  cwd: string
  script: ResponseScript
  /** 这次运行的证据目录，绝对路径，必须还不存在 */
  evidenceDir: string
  apiKey?: ApiKey
  timeoutMs?: number
}

// 对照夹具：按模式发一次请求、打出状态与正文；close-channel 先关掉观察器的事件文件（注入「写不进」），kill 在请求之后自杀
const CONTROL = `import fs from 'node:fs'
const [mode, url] = process.argv.slice(2)
if (mode === 'close-channel') for (const n of fs.readdirSync('/proc/self/fd')) {
  try { if (fs.readlinkSync('/proc/self/fd/' + n).endsWith('/events.jsonl')) fs.closeSync(Number(n)) } catch {} }
const res = await fetch(url), body = await res.text()
process.stdout.write(JSON.stringify({ status: res.status, body }) + '\\n')
if (mode === 'kill') process.kill(process.pid, 'SIGKILL')
`

const refuse = (o: RunOptions, kind: 'facility' | 'fixture', reason: string): ObservedRun => ({
  outcome: kind === 'fixture' ? { kind, reason } : { kind, cause: 'isolation', reason }, attributable: false, requests: [],
  entry: o.entry, isolation: issued.has(o.isolation) ? o.isolation.id : '', run: '', evidenceDir: o.evidenceDir,
  status: null, signal: null, stdout: '', stderr: '' })
const signalOf = (status: number | null): string | null =>
  status !== null && status > 128 && status < 160 ? Object.entries(constants.signals).find(([, n]) => n === status - 128)?.[0] ?? null : null

function launch(o: RunOptions, knob?: 'channel-taken' | 'no-preload'): ObservedRun {
  // 先核调用方给的东西（夹具失格），再核认证（设施故障）；两样都过了才建证据目录、起进程
  if (o.entry !== 'control' && !(ENTRIES as readonly string[]).includes(o.entry)) return refuse(o, 'fixture', `认不得的入口 ${String(o.entry)}`)
  const bad = scriptProblems(o.script)
  if (bad.length) return refuse(o, 'fixture', `响应脚本不合格：${bad.join('；')}`)
  if (!isAbsolute(o.cwd) || !existsSync(o.cwd)) return refuse(o, 'fixture', `当前目录 ${o.cwd} 不是存在的绝对路径`)
  if (!isAbsolute(o.evidenceDir) || existsSync(o.evidenceDir) || !existsSync(dirname(o.evidenceDir)))
    return refuse(o, 'fixture', `证据目录 ${o.evidenceDir} 不是绝对路径、已经存在，或它的上一级不存在`)
  const rw = [...new Set([realpathSync(o.cwd), join(realpathSync(dirname(o.evidenceDir)), basename(o.evidenceDir))])]
  const unsafe = rwProblems(o.isolation.layout ?? layoutNow(), rw)
  if (unsafe.length) return refuse(o, 'fixture', unsafe.join('；'))
  if (!issued.has(o.isolation)) return refuse(o, 'facility', '没有经 certifyIsolation 认证的断网：不起入口，不降级成只靠换 fetch 或共享网络')
  mkdirSync(o.evidenceDir)
  const dir = o.evidenceDir, run = randomBytes(16).toString('hex'), apiKey = o.apiKey ?? 'placeholder'
  const scriptFile = join(dir, 'script.json'), events = join(dir, 'events.jsonl'), empty = join(dir, 'empty')
  const scriptText = JSON.stringify(o.script)
  writeFileSync(scriptFile, scriptText); writeFileSync(empty, '')
  if (o.entry === 'control') writeFileSync(join(dir, 'control.mjs'), CONTROL)
  if (knob === 'channel-taken') writeFileSync(events, '')
  const target = o.entry === 'control' ? join(dir, 'control.mjs') : join(REPO, 'scripts', `${o.entry}.ts`)
  const execArgv = knob === 'no-preload' ? EXEC_ARGV.slice(0, 2) : EXEC_ARGV
  const env: Record<string, string> = { ...observerEnv({ nodeBin: dirname(NODE), home: '/tmp', tmp: '/tmp', tsconfig: join(REPO, 'tsconfig.json'), apiKey }),
    KOL_OBSERVER: JSON.stringify({ run, events, script: scriptFile, target }) }
  const argv = [...sandboxArgs(o.isolation.layout, { empty, rw, chdir: rw[0] }), '--', NODE, ...execArgv, target, ...o.args]
  const r = spawnSync(o.isolation.bwrap, argv, { env, cwd: o.cwd, encoding: 'utf8', timeout: o.timeoutMs ?? 120_000, killSignal: 'SIGKILL', maxBuffer: 1 << 26 })
  const stdout = r.stdout ?? '', stderr = r.stderr ?? '', signal = r.signal ?? signalOf(r.status)
  const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'
  writeFileSync(join(dir, 'stdout.txt'), stdout); writeFileSync(join(dir, 'stderr.txt'), stderr)
  writeFileSync(join(dir, 'argv.json'), json({ file: o.isolation.bwrap, argv, cwd: o.cwd,
    env: { ...env, ...(env.TIKHUB_API_KEY === undefined ? {} : { TIKHUB_API_KEY: '<占位串，见 API_KEY_PLACEHOLDER>' }) } }))
  const judged = judgeRun({ run, target: realpathSync(target), script: o.script, scriptSha: sha(scriptText), preloadSha: sha(readFileSync(PRELOAD)),
    execArgv: EXEC_ARGV, apiKey, launcher: r.pid, error: r.error && !timedOut ? String(r.error) : undefined, status: r.status, signal, timedOut,
    stderr, events: existsSync(events) ? readFileSync(events, 'utf8') : undefined })
  const result: ObservedRun = { ...judged, entry: o.entry, isolation: o.isolation.id, run, evidenceDir: dir, status: r.status, signal, stdout, stderr }
  writeFileSync(join(dir, 'result.json'), json({ run, entry: o.entry, isolation: result.isolation, status: r.status, signal, timedOut,
    outcome: judged.outcome, attributable: judged.attributable, requests: judged.requests.length }))
  return result
}

/** 在认证过的沙箱里起一个真实入口（或对照夹具），交回判过的观察 */
export const runObserved = (o: RunOptions): ObservedRun => launch(o)

/**
 * 认证用的设施故障对照（`observer-cert.ts`），都用对照夹具：脚本外的请求、事件中途写不进、事件文件建不出来、
 * 被信号打死、没装上观察器。每一种都要判成设施故障，不算零请求通过，也不算语义红。
 */
export type FaultControl = 'unmatched' | 'close-channel' | 'channel-taken' | 'kill' | 'no-preload'
export function runFaultControl(o: { isolation: Isolation; cwd: string; evidenceDir: string; fault: FaultControl }): ObservedRun {
  const script: ResponseScript = { schema: 'kol-observer-script/v1', rules: [{ endpoint: '/observer-control', responses: [{ status: 200, body: 'ok' }] }] }
  const url = `https://observer-control.invalid/observer-control${o.fault === 'unmatched' ? '-unscripted' : ''}`
  const mode = o.fault === 'close-channel' || o.fault === 'kill' ? o.fault : 'fetch'
  return launch({ isolation: o.isolation, entry: 'control', args: [mode, url], cwd: o.cwd, script, evidenceDir: o.evidenceDir },
    o.fault === 'channel-taken' || o.fault === 'no-preload' ? o.fault : undefined)
}

/** 设施各文件的路径（仓库根起算）与 SHA256：认证记录与汇总都照它记 */
export const facilityFiles = (): { path: string; sha256: string }[] =>
  ['scripts/check/observer-rule.ts', 'scripts/check/observer-preload.ts', 'scripts/check/observer-run.ts', 'scripts/check/observer-cert.ts',
    'scripts/check/observer-cert.sh', 'package-lock.json'].map(p => ({ path: p, sha256: existsSync(join(REPO, p)) ? sha(readFileSync(join(REPO, p))) : '（不存在）' }))
export const facilityIdentity = () => ({ repo: REPO, node: { path: NODE, version: process.version, sha256: sha(readFileSync(NODE)) },
  tsx: { loader: TSX, version: (JSON.parse(readFileSync(join(dirname(fileURLToPath(TSX)), '..', 'package.json'), 'utf8')) as { version: string }).version },
  execArgv: EXEC_ARGV })
