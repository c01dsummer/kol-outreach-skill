/** Finite public Node listener-removal contract; invoked only by the existing selected test group. */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { SELFCHECK_FIXTURE_MARK } from './check/verifier-rule.js'

type Row = Record<string, unknown>
type Tuple = [string, string[]]
type API = { prebuildTree(owner: string): { wrote: number; kept: number; removed: number }; prebuiltCommand(args: string[], cwd?: string, env?: NodeJS.ProcessEnv): Tuple }
type PS = { pid: number; ppid: number; pgid: number; stat: string }
type Run = { tuple: Tuple | null; pid?: number; ready: Row | null; readyOK: boolean; events: Row[]; raw: { status: number | null; signal: string | null; error: string | null } | null; close: boolean; residual: PS[]; cleanup: boolean; error?: string; factory: boolean; envSame: boolean; proof?: unknown; stdout: string; stderr: string }
const MODES = ['KEEP', 'REMOVE_TERM', 'REMOVE_ALL'] as const
const ACTION = { KEEP: '// Preserve public TERM handling.', REMOVE_TERM: "process.removeAllListeners('SIGTERM')", REMOVE_ALL: 'process.removeAllListeners()' }
const ARGS = ['clear-term-arg', 'clear term arg with space']
const ENTRY = String.raw`import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { isMainThread, threadId } from 'node:worker_threads'
const mode = '__MODE__'
const before: number = process.listenerCount('SIGTERM')
__ACTION__
const after: number = process.listenerCount('SIGTERM')
const common = { fingerprint: 'CLEAR_TERM_PUBLIC_V1', mode, pid: process.pid, ppid: process.ppid, threadId, isMainThread, entryURL: import.meta.url, node: process.execPath, cwd: process.cwd(), args: process.argv.slice(2), token: process.env.CLEAR_TERM_TOKEN, sourceSha: createHash('sha256').update(readFileSync(process.env.CLEAR_TERM_SOURCE!)).digest('hex') }
const log = (row: Record<string, unknown>) => appendFileSync(process.env.CLEAR_TERM_EVENTS!, JSON.stringify({ ...common, ...row }) + '\n')
// Register AFTER removal, so no-argument removal cannot erase this observer.
process.on('exit', code => log({ kind: 'exit', code, termListeners: process.listenerCount('SIGTERM') }))
log({ kind: 'eval' })
setInterval(() => {}, 1000)
const ready = { ...common, kind: 'ready', before, after, armed: true }
log(ready)
writeFileSync(process.env.CLEAR_TERM_READY!, JSON.stringify(ready) + '\n')
`
const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex')
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))
const invalid = (why: string): never => { throw new Error(`${SELFCHECK_FIXTURE_MARK} cleared TERM: ${why}`) }
const snapshot = (files: readonly string[]): Row => Object.fromEntries(files.map(file => [file, existsSync(file) ? hash(readFileSync(file)) : null]))
function ps(): PS[] {
  const p = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,stat='], { encoding: 'utf8' })
  if (p.error || p.status) return invalid('process observation unavailable')
  return p.stdout.split('\n').map(line => line.trim().split(/\s+/)).filter(v => v.length === 4).map(([pid, ppid, pgid, stat]) => ({ pid: +pid, ppid: +ppid, pgid: +pgid, stat }))
}
const active = (p: PS): boolean => !p.stat.startsWith('Z')
const members = (pid?: number): PS[] => pid ? ps().filter(p => p.pgid === pid && active(p)) : []
function noConfig(cwd: string): string[] {
  const proof: string[] = []
  for (let dir = realpathSync(cwd);; dir = dirname(dir)) {
    try { lstatSync(join(dir, 'tsconfig.json')); return invalid('configured actual cwd ancestor') }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    proof.push(dir); if (dirname(dir) === dir) return proof
  }
}
function rows(file: string): Row[] {
  if (!existsSync(file)) return []
  const text = readFileSync(file, 'utf8')
  if (text && !text.endsWith('\n')) return invalid('incomplete final event tape')
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line) as Row)
}

/** C uses only real prebuildTree + final-env prebuiltCommand. No fixture entry is imported into the host. */
export async function runPrebuiltClearTermContracts(): Promise<readonly string[]> {
  const target = realpathSync(resolve('.')), root = realpathSync(mkdtempSync('/tmp/kol-clear-term-'))
  const failures: string[] = [], req = createRequire(join(target, 'package.json')), cli = req.resolve('tsx/cli')
  const provider = ['prebuilt.ts', 'prebuilt-hook.ts', 'prebuilt-parent.ts', 'prebuilt-signals.ts'].map(file => join(target, 'scripts/check', file))
  const identity = [process.execPath, cli, req.resolve('tsx'), req.resolve('tsx/package.json'), ...provider], before = snapshot(identity)
  let api: API | undefined
  try {
    for (const mode of MODES) {
      const dir = join(root, mode), owner = join(dir, 'owner'), entry = join(owner, 'scripts/entry.ts'), cwd = join(dir, 'cwd/leaf')
      const source = ENTRY.replace('__MODE__', mode).replace('__ACTION__', ACTION[mode]), sourceSha = hash(source)
      for (const path of [join(owner, 'scripts'), cwd, join(dir, 'tmp')]) mkdirSync(path, { recursive: true })
      writeFileSync(join(owner, 'package.json'), '{"type":"module"}\n'); writeFileSync(entry, source)
      const receipt: Row = { version: 'clear-term-public-v2', mode, runtime: { node: process.execPath, version: process.version, platform: process.platform, arch: process.arch }, source, sourceSha, owner, entry, cwd, args: ARGS, noConfigAncestors: noConfig(cwd), identityBefore: before, assertions: [] }
      const check = (name: string, ok: boolean, expected: unknown, actual: unknown): void => {
        const label = `CLEAR_TERM_V2.${mode}.${name}`
        ;(receipt.assertions as Row[]).push({ label, status: ok ? 'PASS' : 'FAIL', expected, actual })
        if (!ok) failures.push(`${label}: ${JSON.stringify({ expected, actual })}`)
      }
      const isN = (tuple: Tuple): boolean => {
        try { const args = tuple[1], hook = new URL(args[2]); return tuple[0] === process.execPath && realpathSync(args[0]) === realpathSync(provider[2]) && args[1] === '--hook' && realpathSync(fileURLToPath(hook)) === realpathSync(provider[1]) && hook.searchParams.get('noConfig') === '1' && args[3] === '--' && same(args.slice(4), [entry, ...ARGS]) && !args.includes(cli) }
        catch { return false }
      }
      const observe = async (side: 'R' | 'C'): Promise<Run> => {
        const out = join(dir, side); mkdirSync(out)
        const readyFile = join(out, 'ready.json'), eventsFile = join(out, 'events.jsonl'), token = randomBytes(12).toString('hex')
        const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: join(dir, 'tmp'), LANG: 'C', TZ: 'UTC', CLEAR_TERM_SOURCE: entry, CLEAR_TERM_READY: readyFile, CLEAR_TERM_EVENTS: eventsFile, CLEAR_TERM_TOKEN: token }
        for (const key of ['NODE_OPTIONS', 'TSX_TSCONFIG_PATH', 'KOL_PREBUILT']) delete env[key]
        const envHash = (): string => hash(JSON.stringify(Object.entries(env).sort(([a], [b]) => a.localeCompare(b))))
        const initialEnvHash = envHash(), runnerPgid = ps().find(p => p.pid === process.pid)?.pgid
        if (!runnerPgid) return invalid('runner PGID missing')
        const r: Run = { tuple: null, ready: null, readyOK: false, events: [], raw: null, close: false, residual: [], cleanup: false, factory: false, envSame: true, stdout: '', stderr: '' }
        let child: ChildProcess | undefined, isolated = false
        try {
          if (side === 'R') r.tuple = [process.execPath, [cli, entry, ...ARGS]]
          else { r.tuple = api!.prebuiltCommand([entry, ...ARGS], cwd, env); r.factory = true; r.envSame = initialEnvHash === envHash() }
          if (!r.envSame || r.tuple[0] !== process.execPath || !Array.isArray(r.tuple[1]) || !same(r.tuple[1].slice(-ARGS.length - 1), [entry, ...ARGS])) throw new Error('actual tuple/node/argv/env mismatch')
          if (side === 'C' && !isN(r.tuple)) throw new Error('actual factory did not select the bound N parent/hook route')
          child = spawn(r.tuple[0], r.tuple[1], { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); r.pid = child.pid
          child.stdout?.on('data', (b: Buffer) => { r.stdout += b.toString() }); child.stderr?.on('data', (b: Buffer) => { r.stderr += b.toString() })
          child.once('error', (e: NodeJS.ErrnoException) => { r.raw = { status: null, signal: null, error: e.code ?? 'UNKNOWN' } })
          child.once('exit', (status, signal) => { r.raw = { status, signal, error: null } }); child.once('close', () => { r.close = true })
          const at = Date.now()
          while (!r.raw && Date.now() - at < 5000) {
            const table = ps(), carrier = table.find(p => p.pid === r.pid)
            if (carrier) { if (carrier.pgid !== r.pid || carrier.pgid === runnerPgid) throw new Error('carrier is not isolated'); isolated = true }
            if (existsSync(readyFile) && readFileSync(readyFile, 'utf8').endsWith('\n')) {
              const ready = JSON.parse(readFileSync(readyFile, 'utf8')) as Row, actual = table.find(p => p.pid === ready.pid)
              r.ready = ready
              const parent = ready.pid === r.pid ? process.pid : r.pid
              r.readyOK = ready.fingerprint === 'CLEAR_TERM_PUBLIC_V1' && ready.mode === mode && ready.token === token && ready.sourceSha === sourceSha && ready.entryURL === pathToFileURL(entry).href && ready.node === process.execPath && ready.cwd === cwd && same(ready.args, ARGS) && ready.threadId === 0 && ready.isMainThread === true && ready.armed === true && !!actual && actual.ppid === parent && actual.pgid === r.pid
              if (!r.readyOK) break
              const fresh = ps()
              if (!isolated || fresh.find(p => p.pid === process.pid)?.pgid !== runnerPgid || !fresh.some(p => p.pid === ready.pid && p.pgid === r.pid && active(p))) throw new Error('fresh entry signal proof unavailable')
              r.proof = { signal: 'SIGTERM', target: 'entry PID only', entryPid: ready.pid, carrierPid: r.pid, runnerPgid, members: fresh.filter(p => p.pgid === r.pid) }
              process.kill(ready.pid as number, 'SIGTERM'); break
            }
            await sleep(5)
          }
          const settle = Date.now()
          while (Date.now() - settle < 5000) { if (r.raw && r.close && !members(r.pid).length) break; await sleep(5) }
          r.residual = members(r.pid)
        } catch (error) { r.error = String(error) }
        if (members(r.pid).length) {
          if (!isolated || r.pid === runnerPgid || ps().find(p => p.pid === process.pid)?.pgid !== runnerPgid) return invalid('owned cleanup isolation unavailable')
          r.cleanup = true; process.kill(-r.pid!, 'SIGKILL')
          const clean = Date.now(); while (members(r.pid).length && Date.now() - clean < 2000) await sleep(5)
          if (members(r.pid).length) return invalid('owned group did not clean up')
        }
        r.events = rows(eventsFile)
        Object.assign(r, { input: { envHash: initialEnvHash, controlledEnv: { TMPDIR: env.TMPDIR, LANG: env.LANG, TZ: env.TZ, CLEAR_TERM_SOURCE: entry, CLEAR_TERM_READY: readyFile, CLEAR_TERM_EVENTS: eventsFile, CLEAR_TERM_TOKEN: token } }, finalResidual: members(r.pid) })
        return r
      }
      const hooks = (r: Run): Row[] => r.events.filter(e => e.kind === 'exit' && e.pid === r.ready?.pid).map(({ code }) => ({ code }))
      const entryOK = (r: Run): boolean => r.readyOK && r.events.filter(e => e.kind === 'eval').length === 1 && r.events.filter(e => e.kind === 'ready').length === 1 && r.events.every(e => e.pid === r.ready!.pid && e.token === r.ready!.token && e.sourceSha === sourceSha && e.entryURL === pathToFileURL(entry).href && e.threadId === 0 && e.isMainThread === true)
      try {
        const R = await observe('R'); receipt.R = R
        if (R.error || !entryOK(R) || !R.raw || !R.close || R.cleanup || R.residual.length || (mode !== 'KEEP' && R.ready!.after !== 0) || (mode === 'KEEP' && !hooks(R).length)) return invalid(`public R/positive observer not qualified: ${mode}`)
        try { api ??= await import(pathToFileURL(provider[0]).href) as API; receipt.prebuildCalled = true; receipt.prebuildResult = api.prebuildTree(owner) }
        catch (error) { check('SUPPLY', false, 'actual owner prebuild after healthy public R', String(error)); continue }
        const supply = receipt.prebuildResult as ReturnType<API['prebuildTree']>
        check('SUPPLY', !!supply && Number.isInteger(supply.wrote) && Number.isInteger(supply.kept) && supply.wrote + supply.kept > 0 && readFileSync(entry, 'utf8') === source && readFileSync(join(owner, 'package.json'), 'utf8') === '{"type":"module"}\n', 'real nonempty prebuild supply keeps exact input', { called: receipt.prebuildCalled, result: supply, sourceSha: hash(readFileSync(entry)) })
        const C = await observe('C'); receipt.C = C
        check('FACTORY', C.factory && !!C.tuple && C.envSame && !C.error && isN(C.tuple), 'actual final-env bound N parent/hook tuple; public CLI fallback refused', { tuple: C.tuple, called: C.factory, envSame: C.envSame, error: C.error })
        check('ENTRY_ONCE', entryOK(C), 'one real source eval and one armed ready with exact source/URL/args/cwd/node/token/PID', { ready: C.ready, events: C.events })
        if (mode !== 'KEEP') check('CLEARED', entryOK(C) && C.ready!.after === 0, 'explicit removal completes with zero TERM listeners; before/KEEP counts are diagnostic only', { R: R.ready, C: C.ready })
        check('RAW', entryOK(C) && same(C.raw, R.raw), 'literal status/signal/error C=live public CLI; no numeric constant', { R: R.raw, C: C.raw })
        check('HOOKS', entryOK(C) && C.close && !C.cleanup && !C.error && same(hooks(C), hooks(R)), 'ordered actual entry exit-hook code list C=live R; listener counts are diagnostic only', { R: hooks(R), C: hooks(C) })
        check('CLOSE', C.close && !C.cleanup && !C.residual.length && !members(C.pid).length, 'raw/stdio/groups finish before any cleanup', { R: { close: R.close, residual: R.residual }, C: { close: C.close, cleanup: C.cleanup, residual: C.residual } })
        check('IDENTITY', same(before, snapshot(identity)) && readFileSync(entry, 'utf8') === source, 'Node/public/provider/fixture bytes unchanged', snapshot(identity))
      } finally { receipt.identityAfter = snapshot(identity); console.log(`CLEAR_TERM_CONTRACT_JSON ${JSON.stringify(receipt)}`) }
    }
    return failures
  } finally { rmSync(root, { recursive: true, force: true }) }
}
