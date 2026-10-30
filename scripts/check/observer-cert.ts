#!/usr/bin/env tsx
/**
 * 零请求观察器与外层断网的认证入口（KOL-21）。冻结的命令行在 `observer-cert.sh`，由整合方在 PR head 的干净克隆里照跑；
 * 自检组 `observer-cert-entry` 把它当工具起在临时目录里，验的是接线，那一跑不算认证。
 *
 *   tsx scripts/check/observer-cert.ts --out <证据目录>
 *
 * 依次做：外层断网认证（受控拒绝探针）→ 四个入口各一条阳性、一条零记录资格对照 → 六条设施故障对照 → 汇总。
 * 断网认证不了就停在那一步、不起任何入口。证据全部写进 `--out`（必须还不存在）：每一步一个子目录，装着脚本、参数表、
 * 事件文件、两股输出与退出码；`summary.json` 最后写，记被测提交、设施各文件与每份证据的 SHA256、每一项的结论。
 * 全部成立才以 0 退出，否则 1；用法错 2。不访问外网，expected 全写在下面，不拿目标输出补。
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { certifyIsolation, facilityFiles, facilityIdentity, runFaultControl, runObserved, type FaultControl, type Isolation, type ObservedRun } from './observer-run.js'
import { SCRIPT_SCHEMA, zeroVerdict, type ObserverEntry, type ResponseScript, type ScriptResponse } from './observer-rule.js'

const at = process.argv.indexOf('--out'), given = process.argv[at + 1]
if (at < 0 || !given || given.startsWith('--') || process.argv.length !== 4 || existsSync(resolve(given))) {
  console.error('用法: tsx scripts/check/observer-cert.ts --out <还不存在的证据目录>')
  process.exit(2)
}
const out = resolve(given)
mkdirSync(out, { recursive: true })
const say = (line: string) => { console.log(line); appendFileSync(join(out, 'console.txt'), `${line}\n`) }
type Item = { id: string; kind: 'isolation' | 'positive' | 'zero' | 'fault'; ok: boolean; got: unknown }
const items: Item[] = []
const item = (id: string, kind: Item['kind'], ok: boolean, got: unknown) => { items.push({ id, kind, ok, got }); say(`${ok ? '✓' : '✗'} ${id}：${JSON.stringify(got)}`) }

// 被测的是哪一棵树：40 位提交、工作区干不干净、Node 主版本
const git = (...args: string[]) => spawnSync('git', args, { cwd: facilityIdentity().repo, encoding: 'utf8' })
const head = git('rev-parse', 'HEAD').stdout?.trim() ?? '', dirty = git('status', '--porcelain')
const provenance = { head, clean: dirty.status === 0 && dirty.stdout === '', node: process.version, problems: [] as string[] }
if (!/^[0-9a-f]{40}$/.test(head)) provenance.problems.push('取不到被测提交（不是 git 检出）')
if (!provenance.clean) provenance.problems.push('工作区不干净：被测的不是那个提交原样的树')
if (!process.version.startsWith('v22.')) provenance.problems.push(`Node 是 ${process.version}，不是 22`)
for (const p of provenance.problems) say(`✗ 被测树：${p}`)

const cert = certifyIsolation({ evidenceDir: join(out, 'isolation') })
item('外层断网：断网外连得上受控目标、断网里被拒，盖住的路径为空、环境只有白名单', 'isolation', cert.certified, cert.problems)

const json200 = (body: unknown): ScriptResponse => ({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const script = (rules: ResponseScript['rules']): ResponseScript => ({ schema: SCRIPT_SCHEMA, rules })
const SEARCH = '/api/v1/tiktok/app/v3/fetch_video_search_result', POSTS = '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3'
const tasks = [{ keyword: 'observer-cert', dimension: 'category', platform: 'tiktok' }]
const parsed = (s: string): any => { try { return JSON.parse(s) } catch { return undefined } }
const work = (name: string, files: Record<string, unknown> = {}) => {
  const cwd = join(out, name, 'work')
  for (const [f, v] of Object.entries(files)) { mkdirSync(join(cwd, f, '..'), { recursive: true }); writeFileSync(join(cwd, f), typeof v === 'string' ? v : JSON.stringify(v)) }
  mkdirSync(cwd, { recursive: true })
  return cwd
}
const taskDir = () => {
  const person = [{ platform: 'tiktok', handle: 'observer_cert', nickname: 'Observer cert', followers: 10000, post_count: 50, bio: null,
    bio_links: ['https://example.com'], verified: false, profile_url: '', source_keyword: 'observer-cert', source_dimension: 'category', fit: '✅' }]
  return { 'task/task.json': { product: 'observer-cert', market: 'US', target_count: 1, budget_usd: 1, tasks, done: [0], offsets: { 0: 5 },
    pages: { 0: 1 }, answered: { 0: 1 }, found: { 0: 1 }, requests: 0, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    cost_ledger: { schema: 1, currency: 'USD', unit: 'micro_usd', scope: 'task', limit_micro_usd: 1_000_000, next_attempt_id: 1, entries: [] } },
    'task/creators.json': person, 'task/creators.raw.json': person }
}
const outcomes = (r: ObservedRun) => r.requests.map(q => q.outcome)
const brief = (r: ObservedRun) => ({ outcome: r.outcome, status: r.status, signal: r.signal, requests: r.requests.map(q => [q.endpoint, q.outcome]) })

/**
 * 每个入口两条资格对照。阳性：已知会发请求的合法输入，脚本给的响应要原样回到入口的输出里（事件、响应与运行身份对得上）；
 * render 按契约不发请求，阳性用对照夹具（同一启动形状、同一预加载、同一认证），它自己的 armed 在零记录那一跑里核。
 * 零记录：已知不发请求的路径；零请求断言要四样都在（`zeroVerdict`）。
 */
interface Control { args: (cwd: string) => string[]; files?: Record<string, unknown>; script: ResponseScript; exit: number;
  requests: unknown[]; stdout?: (v: any) => boolean }
const CONTROLS: Record<ObserverEntry, { positive: Control & { entry?: 'control' }; zero: Control }> = {
  probe: {
    positive: { files: { 'probe.json': { market: 'US', budget_usd: 0.5, tasks: [...tasks, ...tasks] } }, args: cwd => ['--config', join(cwd, 'probe.json')],
      script: script([{ endpoint: SEARCH, responses: [json200({ data: { search_item_list: [] } }), { status: 402, body: 'payment required' }] }]),
      exit: 0, requests: [{ status: 200 }, { status: 402 }], stdout: v => v?.results?.length === 2 && v.results[0].found === 0 && typeof v.results[1].error === 'string' },
    zero: { files: { 'probe.json': { market: 'US', budget_usd: 0.5, tasks: [] } }, args: cwd => ['--config', join(cwd, 'probe.json')], script: script([]), exit: 2, requests: [] },
  },
  collect: {
    positive: { files: { 'collect.json': { product: 'observer-cert', market: 'US', target_count: 1, budget_usd: 1, tasks } }, args: cwd => ['--config', join(cwd, 'collect.json')],
      script: script([{ endpoint: SEARCH, responses: [json200({ data: { search_item_list: [] } })] }]), exit: 0, requests: [{ status: 200 }], stdout: v => v?.stopped === 'done' },
    zero: { files: { 'collect.json': { product: 'observer-cert', market: 'US', target_count: 1, budget_usd: 1, tasks: [] } }, args: cwd => ['--config', join(cwd, 'collect.json')],
      script: script([]), exit: 2, requests: [] },
  },
  enrich: {
    positive: { files: taskDir(), args: cwd => ['--dir', join(cwd, 'task')], script: script([{ endpoint: POSTS, responses: [json200({ data: { aweme_list: [], has_more: 0 } })] }]),
      exit: 0, requests: [{ status: 200 }], stdout: v => v?.newly_queried === 1 },
    zero: { args: cwd => ['--dir', join(cwd, 'missing')], script: script([]), exit: 2, requests: [] },
  },
  render: {
    positive: { entry: 'control', args: () => ['fetch', 'https://observer-control.invalid/observer-control'],
      script: script([{ endpoint: '/observer-control', responses: [{ status: 200, body: 'ok' }] }]), exit: 0, requests: [{ status: 200 }],
      stdout: v => v?.status === 200 && v.body === 'ok' },
    zero: { files: taskDir(), args: cwd => ['--dir', join(cwd, 'task')], script: script([]), exit: 0, requests: [], stdout: v => typeof v?.csv === 'string' },
  },
}

const runControl = (isolation: Isolation, entry: ObserverEntry, side: 'positive' | 'zero') => {
  const c = CONTROLS[entry][side], cwd = work(`${entry}-${side}`, c.files)
  const r = runObserved({ isolation, entry: side === 'positive' && 'entry' in c && c.entry === 'control' ? 'control' : entry, args: c.args(cwd), cwd,
    script: c.script, evidenceDir: join(out, `${entry}-${side}`, 'run') })
  const ok = r.outcome.kind === 'observed' && r.status === c.exit && JSON.stringify(outcomes(r)) === JSON.stringify(c.requests)
    && (c.stdout === undefined || c.stdout(parsed(r.stdout)))
  return { r, ok }
}

const FAULTS: [FaultControl, string, (r: ObservedRun) => boolean][] = [
  ['unmatched', '脚本外的请求：观察器叫停入口，判观察器故障', r => r.outcome.kind === 'facility' && r.outcome.cause === 'observer' && r.status === 97 && r.attributable],
  ['close-channel', '事件中途写不进：入口以观察器的退出码失败，判观察器故障', r => r.outcome.kind === 'facility' && r.outcome.cause === 'observer' && r.status === 97 && /事件写不进去/.test(r.stderr)],
  ['channel-taken', '事件文件建不出来：入口一行不跑，判观察器故障', r => r.outcome.kind === 'facility' && r.outcome.cause === 'observer' && r.status === 97 && r.armed === undefined],
  ['kill', '入口被信号打死：判信号故障', r => r.outcome.kind === 'facility' && r.outcome.cause === 'signal'],
  ['no-preload', '没装上观察器：没有 armed，判加载故障', r => r.outcome.kind === 'facility' && r.outcome.cause === 'loader' && r.armed === undefined],
]

if (cert.certified) {
  let positive: ObservedRun | undefined
  for (const entry of Object.keys(CONTROLS) as ObserverEntry[]) {
    const p = runControl(cert.isolation, entry, 'positive')
    item(`${entry} 阳性：观察到预定的请求，脚本给的响应回到了入口的输出里`, 'positive', p.ok, brief(p.r))
    const z = runControl(cert.isolation, entry, 'zero'), verdict = zeroVerdict(z.r, p.r)
    item(`${entry} 零记录：入口自己的 armed、同一认证下的阳性、事件通道完整，判零请求通过`, 'zero', z.ok && verdict.verdict === 'pass', { ...brief(z.r), verdict })
    if (entry === 'render') positive = p.r
  }
  for (const [fault, id, want] of FAULTS) {
    const r = runFaultControl({ isolation: cert.isolation, cwd: work(`fault-${fault}`), evidenceDir: join(out, `fault-${fault}`, 'run'), fault })
    const verdict = zeroVerdict(r, positive)
    item(id, 'fault', want(r) && verdict.verdict !== 'pass', { ...brief(r), verdict })
  }
  const forged = { ...cert.isolation }, dir = join(out, 'fault-forged', 'run')
  const r = runObserved({ isolation: forged, entry: 'render', args: [], cwd: work('fault-forged'), script: script([]), evidenceDir: dir })
  item('不是 certifyIsolation 交出的认证：不起入口，判隔离故障', 'fault', r.outcome.kind === 'facility' && r.outcome.cause === 'isolation' && !existsSync(dir), brief(r))
}

const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex')
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)])
const certified = cert.certified && items.every(i => i.ok) && provenance.problems.length === 0
const evidence = files(out).filter(f => !['summary.json', 'console.txt'].includes(relative(out, f))).sort()
  .map(f => ({ path: relative(out, f), sha256: sha(f) }))
const bwrap = cert.certified ? { path: cert.isolation.bwrap, layout: cert.isolation.id } : undefined
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ schema: 'kol21-observer-cert/v1', result: certified ? 'certified' : 'not-certified',
  provenance, identity: facilityIdentity(), facility: facilityFiles(), isolation: { certified: cert.certified, problems: cert.problems, bwrap },
  items, evidence, exit: certified ? 0 : 1 }, null, 2)}\n`)
say(`${certified ? '✓' : '✗'} 观察器认证：${certified ? '全部成立' : '不成立'}（${items.filter(i => i.ok).length}/${items.length} 项成立，被测提交 ${head || '取不到'}）`)
process.exitCode = certified ? 0 : 1
