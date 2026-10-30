/**
 * 零请求观察器的判定（KOL-21，ADR-70 末尾「KOL-21 零请求观察器与外层断网」一节）：响应脚本的格式与应答、
 * 事件文件读回、一次观察归到哪一档、零请求断言的四档结论、外层断网探针的认证、入口进程只拿的白名单环境、
 * 沙箱布局与它的参数。
 *
 * **纯函数**：不起进程、不读写文件。起进程与落盘在 `observer-run.ts`，入口进程里装钩子、写事件的那一半在
 * `observer-preload.ts`。判据一律偏向「我不知道」：读不全、对不上、缺一项，都不判零请求通过（`process/README.md`
 * 总纲）；设施故障既不算零请求通过，也不算语义红（`process/4-VERIFY.md`「推论」第三条）。
 */
import { createHash } from 'node:crypto'
import { posix } from 'node:path'

export const SCRIPT_SCHEMA = 'kol-observer-script/v1'
/** 观察器自己叫停入口时的退出码：脚本外的请求、事件写不进、钩子被换或绕过 */
export const OBSERVER_EXIT = 97
/** 观察器叫停时打到 stderr 的那一行的开头 */
export const OBSERVER_MARK = '[kol-observer]'
export const ENTRIES = ['probe', 'collect', 'enrich', 'render'] as const
export type ObserverEntry = typeof ENTRIES[number]
/** 按契约不发请求的入口：阳性对照可以用观察器自带的对照夹具（同一拦截点），入口自己的 armed 仍逐次核 */
export const FIXTURE_POSITIVE: readonly ObserverEntry[] = ['render']

export type ScriptResponse =
  | { status: number; headers?: Record<string, string>; body?: string; body_base64?: string; body_read?: 'fail' }
  | { connect: 'fail' }
export interface ScriptRule { method?: string; endpoint: string; query?: Record<string, string>; responses: ScriptResponse[] }
export interface ResponseScript { schema: typeof SCRIPT_SCHEMA; rules: ScriptRule[] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strMap = (v: unknown): boolean => isObj(v) && Object.values(v).every(x => typeof x === 'string')
const extra = (v: Record<string, unknown>, keys: readonly string[], at: string): string[] =>
  Object.keys(v).filter(k => !keys.includes(k)).map(k => `${at} 多出的键 ${k}`)
const NULL_BODY = [204, 205, 304]
const methodOf = (r: { method?: unknown }): string => typeof r.method === 'string' ? r.method : 'GET'

function responseProblems(r: unknown, at: string): string[] {
  if (!isObj(r)) return [`${at} 不是对象`]
  if ('connect' in r) return r.connect === 'fail' && Object.keys(r).length === 1 ? [] : [`${at} 连接失败只写 {"connect":"fail"}`]
  const out = extra(r, ['status', 'headers', 'body', 'body_base64', 'body_read'], at)
  const status = r.status
  if (typeof status !== 'number' || !Number.isInteger(status) || status < 200 || status > 599) out.push(`${at}.status 要是 200–599 的整数`)
  if (r.headers !== undefined && !strMap(r.headers)) out.push(`${at}.headers 的值要是字符串`)
  if (r.body !== undefined && typeof r.body !== 'string') out.push(`${at}.body 要是字符串`)
  if (r.body_base64 !== undefined && (typeof r.body_base64 !== 'string' || r.body_base64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(r.body_base64))) out.push(`${at}.body_base64 不是 base64`)
  if (r.body !== undefined && r.body_base64 !== undefined) out.push(`${at} 的 body 与 body_base64 只能写一个`)
  if (NULL_BODY.includes(status as number) && (r.body !== undefined || r.body_base64 !== undefined || r.body_read !== undefined))
    out.push(`${at} 状态 ${String(status)} 不带正文`)
  if (r.body_read !== undefined && r.body_read !== 'fail') out.push(`${at}.body_read 只能是 "fail"`)
  return out
}

/** 两条规则能不能命中同一个请求：方法、端点相同，查询条件里没有一个键要的值互斥 */
function overlap(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (methodOf(a) !== methodOf(b) || a.endpoint !== b.endpoint) return false
  const qa = isObj(a.query) ? a.query : {}, qb = isObj(b.query) ? b.query : {}
  return Object.keys(qa).every(k => !(k in qb) || qa[k] === qb[k])
}

/** 一份响应脚本哪里不合格，空数组才能用。歧义（两条规则能命中同一个请求）在这里就拦下，运行时不会有 */
export function scriptProblems(value: unknown): string[] {
  if (!isObj(value)) return ['脚本不是对象']
  const out = extra(value, ['schema', 'rules'], '脚本')
  if (value.schema !== SCRIPT_SCHEMA) out.push(`schema 不是 ${SCRIPT_SCHEMA}`)
  if (!Array.isArray(value.rules)) return [...out, 'rules 不是数组']
  const rules = value.rules as unknown[]
  rules.forEach((rule, i) => {
    const at = `rules[${i}]`
    if (!isObj(rule)) { out.push(`${at} 不是对象`); return }
    out.push(...extra(rule, ['method', 'endpoint', 'query', 'responses'], at))
    if (rule.method !== undefined && (typeof rule.method !== 'string' || !/^[A-Z]+$/.test(rule.method))) out.push(`${at}.method 要写大写的方法名`)
    if (typeof rule.endpoint !== 'string' || !rule.endpoint.startsWith('/') || /[?#]/.test(rule.endpoint)) out.push(`${at}.endpoint 要以 / 开头、不带查询`)
    if (rule.query !== undefined && !strMap(rule.query)) out.push(`${at}.query 的值要是字符串`)
    if (!Array.isArray(rule.responses) || rule.responses.length === 0) out.push(`${at}.responses 要是非空数组`)
    else rule.responses.forEach((r, j) => out.push(...responseProblems(r, `${at}.responses[${j}]`)))
  })
  for (let i = 0; i < rules.length; i++) for (let j = i + 1; j < rules.length; j++) {
    const a = rules[i], b = rules[j]
    if (isObj(a) && isObj(b) && overlap(a, b)) out.push(`rules[${i}] 与 rules[${j}] 能命中同一个请求`)
  }
  return out
}

export type Refusal = 'unmatched' | 'exhausted' | 'ambiguous'
export type Answer = { rule: number; index: number; response: ScriptResponse } | { refused: Refusal; rule: number | null }

/** 一个请求由脚本里哪一条、第几个响应来答。`used` 是每条规则已答过几次，由调用方保管、答了才加一 */
export function answer(script: ResponseScript, used: readonly number[], method: string, url: string): Answer {
  const u = new URL(url)
  const hits = script.rules.flatMap((r, i) => methodOf(r) === method.toUpperCase() && r.endpoint === u.pathname
    && Object.entries(r.query ?? {}).every(([k, v]) => u.searchParams.get(k) === v) ? [i] : [])
  if (hits.length === 0) return { refused: 'unmatched', rule: null }
  if (hits.length > 1) return { refused: 'ambiguous', rule: null }
  const index = used[hits[0]] ?? 0
  const response = script.rules[hits[0]].responses[index]
  return response === undefined ? { refused: 'exhausted', rule: hits[0] } : { rule: hits[0], index, response }
}

// ── 事件 ──────────────────────────────────────────────────────────────

/**
 * 入口进程里只该有的环境变量名（值由运行器定，见 `observerEnv`）；观察配置那一个由预加载删掉、不在里面。
 * `PWD` 不是运行器给的：bwrap 的 `--chdir` 自己设它，值就是那个当前目录
 */
export const ALLOWED_ENV = ['HOME', 'LANG', 'PATH', 'PWD', 'TIKHUB_API_KEY', 'TMPDIR', 'TSX_TSCONFIG_PATH', 'TZ'] as const
/** 入口要有 key 才走到请求那一步；给的是这个占位串，不是任何真密钥 */
export const API_KEY_PLACEHOLDER = 'kol-observer-placeholder-not-a-key'
export type ApiKey = 'placeholder' | 'absent'

export interface Armed { kind: 'armed'; run: string; pid: number; ppid: number; entry: string; script_sha256: string;
  preload_sha256: string; exec_argv: string[]; node: string; env_names: string[]; api_key: ApiKey | 'other'; net: string[] }
export type RequestOutcome = { status: number } | { connect: 'fail' } | { refused: Refusal }
export interface RequestEvent { kind: 'request'; run: string; pid: number; seq: number; method: string; origin: string;
  endpoint: string; query_keys: string[]; rule: number | null; index: number | null; outcome: RequestOutcome }
export interface BodyEvent { kind: 'body'; run: string; pid: number; seq: number; read: string; ok: boolean }
export interface FaultEvent { kind: 'fault'; run: string; pid: number; reason: string }
export interface CloseEvent { kind: 'close'; run: string; pid: number; requests: number; code: number | null }
export type ObserverEvent = Armed | RequestEvent | BodyEvent | FaultEvent | CloseEvent

const SHAPES: Record<ObserverEvent['kind'], Record<string, string>> = {
  armed: { ppid: 'number', entry: 'string', script_sha256: 'string', preload_sha256: 'string', exec_argv: 'array', node: 'string',
    env_names: 'array', api_key: 'string', net: 'array' },
  request: { seq: 'number', method: 'string', origin: 'string', endpoint: 'string', query_keys: 'array', outcome: 'object' },
  body: { seq: 'number', read: 'string', ok: 'boolean' },
  fault: { reason: 'string' },
  close: { requests: 'number' },
}
const typeOf = (v: unknown): string => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v

/** 读回事件文件：每行一个对象，最后一行要写完（以换行结尾）。认不得的行、没写完的尾巴都报，不当成没有 */
export function readEvents(text: string): { events: ObserverEvent[]; problems: string[] } {
  if (text === '') return { events: [], problems: ['事件文件是空的'] }
  const problems: string[] = []
  if (!text.endsWith('\n')) problems.push('事件文件最后一行没写完')
  const events: ObserverEvent[] = []
  text.split('\n').slice(0, -1).forEach((line, i) => {
    let e: unknown
    try { e = JSON.parse(line) } catch { problems.push(`第 ${i + 1} 行不是 JSON`); return }
    const shape = isObj(e) && typeof e.kind === 'string' && Object.hasOwn(SHAPES, e.kind) ? SHAPES[e.kind as ObserverEvent['kind']] : undefined
    if (!isObj(e) || shape === undefined || typeof e.run !== 'string' || !Number.isInteger(e.pid)
      || Object.entries(shape).some(([k, t]) => typeOf(e[k]) !== t)) { problems.push(`第 ${i + 1} 行认不得`); return }
    events.push(e as unknown as ObserverEvent)
  })
  return { events, problems }
}

export type FacilityCause = 'launch' | 'loader' | 'observer' | 'isolation' | 'signal'
export type Outcome =
  | { kind: 'observed' }
  | { kind: 'facility'; cause: FacilityCause; reason: string }
  | { kind: 'fixture'; reason: string }

/** 判一次观察要的全部事实，由运行器收齐 */
export interface RunFacts {
  run: string; target: string; script: ResponseScript; scriptSha: string; preloadSha: string; execArgv: string[]; apiKey: ApiKey
  /** 起的那个进程（bwrap）：入口是它的子进程 */
  launcher: number | undefined
  error?: string; status: number | null; signal: string | null; timedOut: boolean; stderr: string
  /** 事件文件全文；`undefined` 是文件不存在 */
  events: string | undefined
}
/** `attributable`：armed 核过了（本次运行、目标入口、这一份脚本与预加载、断网与白名单），下面的请求事件归得到这次运行 */
export interface Judged { outcome: Outcome; attributable: boolean; armed?: Armed; requests: RequestEvent[] }

const fault = (cause: FacilityCause, reason: string, rest: Partial<Judged> = {}): Judged =>
  ({ outcome: { kind: 'facility', cause, reason }, attributable: false, requests: [], ...rest })
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])

/** 请求事件记的结局与脚本在那一条、那一个位置上写的对不对得上 */
function scripted(script: ResponseScript, e: RequestEvent): boolean {
  if ('refused' in e.outcome) return e.index === null && (e.outcome.refused === 'exhausted' ? e.rule !== null : e.rule === null)
  const r = e.rule === null || e.index === null ? undefined : script.rules[e.rule]?.responses[e.index]
  if (r === undefined) return false
  return 'connect' in r ? 'connect' in e.outcome : 'status' in e.outcome && e.outcome.status === r.status
}

/**
 * 一次观察归到哪一档。完整 = 恰好一条属于本次运行、由目标入口进程写的 armed 打头，请求序号连续、结局与脚本对得上，
 * 恰好一条 close 收尾且数目对得上。脚本外的请求是观察器故障（观察器叫停了入口），但那些请求事件照样归得到这次运行。
 */
export function judgeRun(f: RunFacts): Judged {
  if (f.error !== undefined) return fault('launch', `起不来：${f.error}`)
  if (f.timedOut) return fault('signal', '超时被杀')
  // 观察器叫停时自己说的那一句，附在观察器故障的原因后面
  const mark = f.stderr.split('\n').find(l => l.startsWith(OBSERVER_MARK))
  const said = mark === undefined ? '' : `（${mark}）`
  if (f.events === undefined) {
    if (f.signal !== null) return fault('signal', `没写事件就被 ${f.signal} 打死`)
    if (/^bwrap: /m.test(f.stderr)) return fault('isolation', '沙箱没起来')
    if (mark !== undefined) return fault('observer', `观察器没接上${said}`)
    return fault('loader', '入口进程没写 armed：加载器或预加载没起来')
  }
  const { events, problems } = readEvents(f.events)
  if (problems.length) return fault(f.signal !== null ? 'signal' : 'observer', `${problems.join('；')}${said}`)
  const [armed] = events
  if (armed?.kind !== 'armed' || events.filter(e => e.kind === 'armed').length !== 1) return fault('observer', 'armed 不是恰好一条、打头')
  if (armed.entry !== f.target || armed.ppid !== f.launcher) return fault('observer', 'armed 对不上目标入口或起的那个进程', { armed })
  if (armed.script_sha256 !== f.scriptSha || armed.preload_sha256 !== f.preloadSha || !same(armed.exec_argv, f.execArgv))
    return fault('observer', '入口进程装的脚本、预加载或加载顺序不是这一份', { armed })
  if (!same(armed.net, ['lo'])) return fault('isolation', `入口进程看得见的网卡不是只有 lo：${armed.net.join(',')}`, { armed })
  if (armed.env_names.some(n => !(ALLOWED_ENV as readonly string[]).includes(n)) || armed.api_key !== f.apiKey)
    return fault('isolation', `入口进程的环境不是白名单：${armed.env_names.join(',')}，key=${armed.api_key}`, { armed })
  // 运行身份在这里核：每一行（armed 在内）都要带本次运行的 id、由 armed 那个进程写
  if (events.some(e => e.run !== f.run || e.pid !== armed.pid)) return fault('observer', '有事件不属于本次运行（运行 id 对不上）或不是入口进程写的', { armed })
  const requests = events.filter((e): e is RequestEvent => e.kind === 'request')
  if (requests.some((e, i) => e.seq !== i + 1 || !scripted(f.script, e))) return fault('observer', '请求序号不连续，或记下的结局与脚本对不上', { armed })
  const seen = { attributable: true, armed, requests }
  const faults = events.filter((e): e is FaultEvent => e.kind === 'fault')
  if (faults.length) return fault('observer', faults.map(e => e.reason).join('；'), seen)
  const refused = requests.filter(e => 'refused' in e.outcome)
  if (refused.length) return fault('observer', `脚本外的请求 ${refused.length} 次，观察器叫停了入口`, seen)
  if (f.signal !== null) return fault('signal', `入口被 ${f.signal} 打死`, seen)
  const closes = events.filter((e): e is CloseEvent => e.kind === 'close')
  if (closes.length !== 1 || events.at(-1)?.kind !== 'close' || closes[0].requests !== requests.length)
    return fault('observer', `close 不是恰好一条、收尾，或数目与请求对不上${said}`, seen)
  if (f.status === OBSERVER_EXIT || mark !== undefined) return fault('observer', `观察器叫停了入口${said}`, seen)
  return { outcome: { kind: 'observed' }, ...seen }
}

/** 零请求断言用得上的那几样：一次观察的结果，加它在哪次断网认证下、由哪个入口跑的 */
export interface Observation extends Judged { entry: ObserverEntry | 'control'; isolation: string }
export type Zero = { verdict: 'pass' } | { verdict: 'red'; requests: number }
  | { verdict: 'facility'; reason: string } | { verdict: 'fixture'; reason: string }

/**
 * 零请求断言的四档（ADR-70 那一节「对作者公开的协议」第 5 条）。归得到这次运行的请求一次也算红（拒答的也算：入口确实发了）；
 * 判通过要四样都在：目标入口进程自己的 armed、同一认证下同一入口（按契约不发请求的入口可用对照夹具）观察到请求的阳性、
 * 事件通道完整（观察成立）、外层断网认证（两次运行都在同一份认证下，armed 里只有 lo）。
 */
export function zeroVerdict(target: Observation, positive: Observation | undefined): Zero {
  if (target.attributable && target.requests.length > 0) return { verdict: 'red', requests: target.requests.length }
  if (target.outcome.kind !== 'observed') return target.outcome.kind === 'fixture'
    ? { verdict: 'fixture', reason: target.outcome.reason } : { verdict: 'facility', reason: `目标：${target.outcome.reason}` }
  if (positive === undefined) return { verdict: 'fixture', reason: '没有阳性对照' }
  if (positive.outcome.kind === 'facility') return { verdict: 'facility', reason: `阳性：${positive.outcome.reason}` }
  if (positive.outcome.kind === 'fixture') return { verdict: 'fixture', reason: `阳性：${positive.outcome.reason}` }
  if (positive.isolation !== target.isolation) return { verdict: 'fixture', reason: '阳性与目标不在同一份断网认证下' }
  if (positive.entry !== target.entry && !(positive.entry === 'control' && target.entry !== 'control' && FIXTURE_POSITIVE.includes(target.entry)))
    return { verdict: 'fixture', reason: `阳性跑的是 ${positive.entry}，不是 ${target.entry}` }
  if (positive.requests.length === 0) return { verdict: 'fixture', reason: '阳性一次请求也没观察到' }
  if (positive.armed?.preload_sha256 !== target.armed?.preload_sha256) return { verdict: 'fixture', reason: '阳性与目标装的不是同一份预加载' }
  return { verdict: 'pass' }
}

// ── 外层断网 ──────────────────────────────────────────────────────────

export type MaskSeen = { dir: number } | { file: number } | { absent: string } | { other: string }
export interface ProbeReport { result: 'acked' | 'error' | 'timeout' | 'mismatch'; code?: string; interfaces: string[]; env: string[];
  masks: Record<string, MaskSeen> }
export interface NetcutFacts { outside?: ProbeReport; inside?: ProbeReport; insideError?: string; seen: string[];
  tokens: { outside: string; inside: string }; masks: { dirs: string[]; files: string[] } }
const REFUSED = ['ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH']

/**
 * 受控拒绝探针认不认证得了断网。同一个探针在断网外连本机受控目标要连上（目标收到并回了这一次的令牌），
 * 在断网里要被拒、目标一次也没收到里面那个令牌；两边都观察到，探针才算有效。断网里另核网卡只有 lo、
 * gh 配置目录与仓库根的 `.env` 那几个盖住的路径是空的、环境只有白名单 —— 都在盖住之后的那一侧看，不读内容。
 */
export function netcutProblems(f: NetcutFacts): string[] {
  const out: string[] = []
  if (f.outside === undefined) out.push('断网外的探针没交回结果')
  else if (f.outside.result !== 'acked' || !f.seen.includes(f.tokens.outside)) out.push(`断网外连不上受控目标（${f.outside.result} ${f.outside.code ?? ''}）：探针无效`)
  if (f.inside === undefined) return [...out, `断网里的探针没跑起来：${f.insideError ?? '没有输出'}`]
  if (f.inside.result === 'acked' || f.seen.includes(f.tokens.inside)) out.push('断网里连上了受控目标：断网不成立')
  else if (f.inside.result !== 'error' || !REFUSED.includes(f.inside.code ?? '')) out.push(`断网里不是被拒（${f.inside.result} ${f.inside.code ?? ''}）`)
  if (!same(f.inside.interfaces, ['lo'])) out.push(`断网里看得见的网卡不是只有 lo：${f.inside.interfaces.join(',')}`)
  for (const d of f.masks.dirs) if (JSON.stringify(f.inside.masks[d]) !== '{"dir":0}') out.push(`${d} 在隔离里不是空目录`)
  for (const p of f.masks.files) if (JSON.stringify(f.inside.masks[p]) !== '{"file":0}') out.push(`${p} 在隔离里不是空文件`)
  const stray = f.inside.env.filter(n => !(ALLOWED_ENV as readonly string[]).includes(n))
  if (stray.length) out.push(`隔离里的环境多了 ${stray.join(',')}`)
  return out
}

/** 入口进程的环境：从空表起，只放这几样（等于 env -i 加最小集），继承来的一个都不带 */
export function observerEnv(o: { nodeBin: string; home: string; tmp: string; tsconfig: string; apiKey: ApiKey }): Record<string, string> {
  return { PATH: `${o.nodeBin}:/usr/bin:/bin`, HOME: o.home, TMPDIR: o.tmp, LANG: 'C.UTF-8', TZ: 'UTC', TSX_TSCONFIG_PATH: o.tsconfig,
    ...(o.apiKey === 'placeholder' ? { TIKHUB_API_KEY: API_KEY_PLACEHOLDER } : {}) }
}

// ── 沙箱布局 ──────────────────────────────────────────────────────────

export interface PathFact { path: string; kind: 'dir' | 'file' | 'symlink' | 'absent'; target?: string }
/** 沙箱照搬的宿主路径：系统目录、node 的安装目录、仓库里入口要读的四样；另有要盖住的 gh 配置目录 */
export interface Layout { system: PathFact[]; node: string; repoRoot: string; repo: PathFact[]; ghDirs: string[] }
export const SYSTEM_PATHS = ['/usr', '/bin', '/sbin', '/lib', '/lib32', '/lib64', '/libx32']
export const REPO_PATHS = ['scripts', 'node_modules', 'package.json', 'tsconfig.json']
export const MASKED_FILES = ['.env', '.env.local']

/** 要用空 tmpfs 盖住的 gh 配置目录：宿主 HOME 下那一处，加上宿主环境里显式指过的（只取路径，不读里面的东西） */
export function ghDirs(home: string, env: { GH_CONFIG_DIR?: string; XDG_CONFIG_HOME?: string }): string[] {
  return [...new Set([posix.join(home, '.config', 'gh'), ...(env.XDG_CONFIG_HOME ? [posix.join(env.XDG_CONFIG_HOME, 'gh')] : []),
    ...(env.GH_CONFIG_DIR ? [env.GH_CONFIG_DIR] : [])].filter(p => posix.isAbsolute(p)))]
}

/**
 * bwrap 的参数（不经 shell，命令由调用方接在 `--` 后面）。根是空的：只照搬系统目录、node 与仓库里的 scripts、node_modules、
 * 两份配置，仓库根本身、`.git`、output、memory 都不在里面；gh 配置目录用空 tmpfs 盖住，`.env`、`.env.local` 用空文件盖住。
 * 可写的只有 `rw` 那几个目录；`--tmpfs /tmp` 排在仓库与它们前面，落在 /tmp 底下的也照样挂得上。
 */
export function sandboxArgs(l: Layout, run: { empty: string; rw: readonly string[]; chdir: string }): string[] {
  return ['--unshare-net', '--die-with-parent', '--new-session',
    ...l.system.flatMap(p => p.kind === 'symlink' ? ['--symlink', p.target!, p.path] : p.kind === 'dir' ? ['--ro-bind', p.path, p.path] : []),
    '--dev', '/dev', '--proc', '/proc', '--tmpfs', '/tmp', '--ro-bind', l.node, l.node,
    ...l.repo.flatMap(p => p.kind === 'absent' ? [] : ['--ro-bind', posix.join(l.repoRoot, p.path), posix.join(l.repoRoot, p.path)]),
    ...l.ghDirs.flatMap(d => ['--tmpfs', d]),
    ...MASKED_FILES.flatMap(f => ['--ro-bind', run.empty, posix.join(l.repoRoot, f)]),
    ...run.rw.flatMap(d => ['--bind', d, d]), '--chdir', run.chdir]
}

/**
 * 可写目录哪里不行。可写的绑在最后，会盖住前面的一切：它要是仓库根、gh 配置目录、系统目录或 node 的祖先（含自己），
 * 真 `.env`、真凭据就跟着露出来；落在只读照搬的那几样里面，入口就能改真源码。两种都拦下，交回问题，不起入口
 */
export function rwProblems(l: Layout, rw: readonly string[]): string[] {
  const within = (p: string, root: string) => p === root || p.startsWith(root.endsWith('/') ? root : `${root}/`)
  const guarded = [l.repoRoot, l.node, ...l.ghDirs, ...l.system.filter(p => p.kind !== 'absent').map(p => p.path)]
  const inside = [l.node, ...l.ghDirs, ...l.system.filter(p => p.kind !== 'absent').map(p => p.path),
    ...[...REPO_PATHS, '.git', ...MASKED_FILES].map(p => posix.join(l.repoRoot, p))]
  return rw.flatMap(d => !posix.isAbsolute(d) ? [`可写目录 ${d} 不是绝对路径`]
    : guarded.some(g => within(g, d)) ? [`可写目录 ${d} 盖住了 ${guarded.find(g => within(g, d))}`]
      : inside.some(g => within(d, g)) ? [`可写目录 ${d} 落在只读照搬或盖住的 ${inside.find(g => within(d, g))} 里`] : [])
}

/** 布局的身份：认证时算一次，每次运行用的就是那一份。看布局与 bwrap 本身，不看每次运行自己的可写目录 */
export const layoutId = (l: Layout, bwrap: { path: string; sha256: string; version: string }): string =>
  createHash('sha256').update(JSON.stringify([bwrap, l, MASKED_FILES])).digest('hex')
