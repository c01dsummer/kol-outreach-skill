import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { SELFCHECK_FIXTURE_MARK } from './check/verifier-rule.js'
import { WORKER_OUTPUT_CONTRACT_FILES } from './worker-output-contract-data.js'
import { WORKER_OUTPUT_GUARDIAN, WORKER_OUTPUT_GUARDIAN_SHA256 } from './worker-output-guardian-data.js'

const CONTROLLER = "// Review copy of the local adapter embedded in worker-output-contract-test.ts.\n// It never loads DUT code into the controller or reads implementation bodies.\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport os from 'node:os';\nimport crypto from 'node:crypto';\nimport { spawn, spawnSync } from 'node:child_process';\n\nconst home = fs.realpathSync(process.argv[2]);\nconst context = JSON.parse(fs.readFileSync(path.join(home, 'context.json')));\nconst specimen = path.join(home, 'specimen');\nconst output = path.join(home, 'run');\n// Every process group this run starts below is noted here first thing, so the carrier can wait for all of them to stop.\nconst groupsFile = path.join(home, 'process-groups.ndjson');\nconst noteGroup = entry => fs.appendFileSync(groupsFile, JSON.stringify(entry) + '\\n');\nconst driverRoot = context.driverTempRoot;\nconst sha = b => crypto.createHash('sha256').update(b).digest('hex');\nconst originalDriverSha = '578db7a45bf36ae6da9945af913bb1eca0ed49b497023980819a0a72b5e8b8b3';\nconst wrapperSha = '03b355d3a78b9ec72cb2f73e01d9deb14fc6ed8bc7dab328412cf6e2145c3305';\nconst mark = 'WORKER_OUTPUT_CONTRACT_JSON ';\nconst report = { fixtureErrors: [], context: { ...context, sourceManifest: undefined }, runtime: { version: process.version, platform: process.platform,\n  arch: process.arch, execPath: fs.realpathSync(process.execPath), sha256: sha(fs.readFileSync(process.execPath)) } };\nconst invalid = message => { throw new Error(message); };\nconst read = name => fs.readFileSync(path.join(output, name));\nconst json = name => JSON.parse(read(name));\nconst same = (a,b) => JSON.stringify(a) === JSON.stringify(b);\nconst git = args => {\n  const r = spawnSync('git', args, { cwd: specimen, env: process.env, encoding: null });\n  if (r.error || r.status !== 0 || r.signal !== null) invalid('private specimen Git failed: ' + (r.error?.message ?? r.stderr.toString()));\n  return r.stdout;\n};\nconst events = mode => read(`${mode}.events.ndjson`).toString().trim().split('\\n').map(line => JSON.parse(line));\n\ntry {\n  noteGroup({ role: 'controller', pid: process.pid });\n  if (!same(report.runtime, context.runtime)) invalid('controller runtime differs from host input');\n  // The carrier made this root before anything ran and alone removes it; the driver only fills it.\n  if (typeof driverRoot !== 'string' || path.dirname(driverRoot) !== os.tmpdir() || !/^kc-worker-output-independent-[A-Za-z0-9]+$/.test(path.basename(driverRoot))\n    || !fs.lstatSync(driverRoot).isDirectory() || fs.readdirSync(driverRoot).length !== 0) invalid('carrier-owned driver temporary root is not a fresh private directory');\n  if (sha(fs.readFileSync(path.join(specimen, 'scripts/check/mutate.ts'))) !== context.coreSha256) invalid('specimen core differs from actual cwd');\n  // Existing local Git-fixture isolation pattern: no inherited repository,\n  // global/system config, templates, signing, hooks or user identity.\n  git(['init', '--quiet', '--initial-branch=worker-output-specimen', '--template=' + path.join(home, 'empty-git')]);\n  git(['add', '--force', '--all', '--', '.', ':!node_modules']);\n  git(['commit', '--quiet', '-m', 'private worker-output opaque cwd specimen']);\n  const specimenCommit = git(['rev-parse', 'HEAD']).toString().trim();\n  const coreCommit = git(['show', `${specimenCommit}:scripts/check/mutate.ts`]);\n  if (sha(coreCommit) !== context.coreSha256 || !coreCommit.equals(fs.readFileSync(path.join(specimen, 'scripts/check/mutate.ts')))) invalid('committed core is not the actual cwd bytes');\n  const original = fs.readFileSync(path.join(home, 'original-driver.mjs'));\n  const wrapper = fs.readFileSync(path.join(home, 'pipe-wrapper.mjs'));\n  if (sha(original) !== originalDriverSha || sha(wrapper) !== wrapperSha) invalid('frozen original changed');\n  const edits = [\n    { input: 'source', before: \"const source = '/private/tmp/kc-20261024/ci-runtime-recovery-20261025';\", after: `const source = ${JSON.stringify(specimen)};` },\n    { input: 'specimenCommit', before: \"const expectedHead = '26b8ceb4c0f36220e381c7b7bb71716567f54c29';\", after: `const expectedHead = ${JSON.stringify(specimenCommit)};` },\n    { input: 'runtime.sha256', before: \"const expectedNodeSha = '913b144fdb40638b1acef7974ab3c33fbd527cc0974cb5da467ab1e6ac51b4d4';\", after: `const expectedNodeSha = ${JSON.stringify(report.runtime.sha256)};` },\n    { input: 'runtime.version', before: \"process.version !== 'v22.22.0'\", after: `process.version !== ${JSON.stringify(report.runtime.version)}` },\n    // Preserve the frozen wrapper bytes while inserting a process-lifetime guard.\n    { input: 'wrapperGuard', before: \"[path.join(here, 'pipe-wrapper.mjs')]\", after: \"[path.join(here, 'guardian.cjs'), 'group', process.execPath, path.join(here, 'pipe-wrapper.mjs')]\" },\n    { input: 'wrapperGuardParent', before: \"cwd, env: environment, detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe']\", after: \"cwd, env: { ...environment, KOL_GUARDIAN_PARENT_PID: String(process.pid), KOL_GUARD_FORWARD_FD3: '1' }, detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe']\" },\n    // Node's pause() only stops 'data' events: the pipe handle keeps reading and takes one read-ahead\n    // chunk, which can land after the wrapper's one-byte EAGAIN and reopen room for the DUT write.\n    // Stop the handle's reads (as net's pauseOnCreate does) until the release restarts them; without\n    // both handle methods nothing is stopped, the codes stay null and the check below rejects the run.\n    { input: 'consumerPause', before: \"  child.stdout.pause();\\n\", after: \"  child.stdout.pause();\\n  const pausedHandle = child.stdout._handle;\\n  const holdsAtHandle = typeof pausedHandle?.readStop === 'function' && typeof pausedHandle?.readStart === 'function';\\n  if (holdsAtHandle) pausedHandle.reading = false;\\n  record({ event: 'consumer-read-stopped', code: holdsAtHandle ? pausedHandle.readStop() : null, at: Date.now() });\\n\" },\n    // The driver fills the carrier-owned root instead of making its own, and notes the wrapper's process group.\n    { input: 'driverTempRoot', before: \"  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-worker-output-independent-'));\", after: `  const tempRoot = ${JSON.stringify(driverRoot)};` },\n    { input: 'wrapperGroup', before: \"  child.stderr.on('data', (b) => stderr.push(b));\\n\", after: `  if (child.pid !== undefined) fs.appendFileSync(${JSON.stringify(groupsFile)}, JSON.stringify({ role: 'wrapper-guardian', pgid: child.pid }) + '\\\\n');\\n  child.stderr.on('data', (b) => stderr.push(b));\\n` },\n    { input: 'consumerResume', before: \"    child.stdout.resume();\\n\", after: \"    const pausedReadBytes = child.stdout.readableLength;\\n    if (holdsAtHandle) pausedHandle.reading = true;\\n    record({ event: 'consumer-read-restarted', pausedReadBytes, code: holdsAtHandle ? pausedHandle.readStart() : null, at: Date.now() });\\n    child.stdout.resume();\\n\" }\n  ];\n  const replaceOne = (body, before, after) => {\n    const at = body.indexOf(before);\n    if (at < 0 || body.indexOf(before, at + before.length) !== -1) invalid('binding region missing or repeated');\n    return body.slice(0, at) + after + body.slice(at + before.length);\n  };\n  let bound = original.toString('utf8');\n  if (!Buffer.from(bound).equals(original)) invalid('original driver UTF-8 round trip failed');\n  for (const e of edits) bound = replaceOne(bound, e.before, e.after);\n  let reversed = bound;\n  for (const e of [...edits].reverse()) reversed = replaceOne(reversed, e.after, e.before);\n  if (!Buffer.from(reversed).equals(original) || sha(reversed) !== originalDriverSha) invalid('full driver reverse binding differs');\n  fs.mkdirSync(output);\n  fs.writeFileSync(path.join(output, 'contract-driver.mjs'), bound);\n  fs.writeFileSync(path.join(output, 'pipe-wrapper.mjs'), wrapper);\n  fs.copyFileSync(path.join(home, 'guardian.cjs'), path.join(output, 'guardian.cjs'));\n  report.binding = { inputs: ['opaqueCurrentCwdSpecimen', 'privateSpecimenCommit', 'actualRuntimeProfile'], edits,\n    specimen, specimenCommit, commitRole: 'Synthetic private snapshot only; never the author or main HEAD',\n    originalDriverSha256: originalDriverSha, boundDriverSha256: sha(bound), reverseDriverSha256: sha(reversed),\n    reverseFullFileByteEqual: true, wrapperSha256: sha(wrapper), coreSha256: context.coreSha256 };\n  fs.writeFileSync(path.join(output, 'binding.json'), JSON.stringify(report.binding, null, 2) + '\\n');\n  // Same limits as a synchronous launch, but the group is noted the moment it exists.\n  const raw = await new Promise(resolve => {\n    const child = spawn(process.execPath, [path.join(home, 'guardian.cjs'), 'group', process.execPath, path.join(output, 'contract-driver.mjs')], {\n      cwd: specimen, env: { ...process.env, KOL_GUARDIAN_PARENT_PID: String(process.pid) }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });\n    // A launch that failed made no group; nothing to wait for.\n    if (child.pid !== undefined) noteGroup({ role: 'driver-guardian', pgid: child.pid });\n    const out = [], err = []; let bytes = 0, error = null, settled = false;\n    const finish = (status, signal) => { if (settled) return; settled = true; clearTimeout(timer);\n      resolve({ stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), status, signal, error }); };\n    const stop = e => { error ??= e; try { child.kill('SIGTERM'); } catch { /* already gone */ } };\n    const take = list => b => { list.push(b); bytes += b.length; if (bytes > 4 * 1024 * 1024) stop(new Error('driver output exceeded 4 MiB')); };\n    child.stdout.on('data', take(out)); child.stderr.on('data', take(err));\n    const timer = setTimeout(() => stop(new Error('driver timed out after 300000 ms')), 300000);\n    child.on('error', e => { error ??= e; if (child.pid === undefined) finish(null, null); });\n    child.on('close', finish);\n  });\n  report.driverRaw = { stdout: raw.stdout, stderr: raw.stderr, status: raw.status,\n    signal: raw.signal, error: raw.error?.message ?? null };\n  if (raw.error || raw.signal !== null) invalid('original driver did not complete');\n  report.originalResult = json('run-result.json');\n  const result = report.originalResult;\n  if (result.identity.source !== specimen || result.identity.head !== specimenCommit\n    || result.identity.nodeVersion !== report.runtime.version || result.identity.nodeSha256 !== report.runtime.sha256\n    || result.identity.platform !== report.runtime.platform || result.identity.arch !== report.runtime.arch) invalid('driver input/runtime receipt differs');\n  const cloneManifest = json('source.manifest.json');\n  if (!same(cloneManifest, context.sourceManifest)) invalid('Git clone no longer represents the actual cwd source snapshot');\n  if (result.identity.lockSha256 !== context.lockSha256 || result.identity.dependenciesManifestSha256 !== context.dependenciesManifestSha256) invalid('driver dependency identity differs from current input');\n  const driverSource = read('contract-driver.mjs');\n  if (sha(driverSource) !== report.binding.boundDriverSha256 || sha(read('pipe-wrapper.mjs')) !== wrapperSha) invalid('bound controller files changed during execution');\n  if (sha(fs.readFileSync(path.join(specimen, 'scripts/check/mutate.ts'))) !== context.coreSha256) invalid('specimen core changed during execution');\n  if (result.identity.tempRoot !== driverRoot) invalid('driver receipt names a temporary root the carrier does not own');\n  if (!['green','red'].includes(result.outcome) || result.baselineQualified !== true || result.positive?.passed !== true || result.adverse?.fixtureQualified !== true) invalid('original driver fixture did not qualify');\n  if (raw.status !== (result.outcome === 'green' ? 0 : 1)) invalid('original driver exit and outcome differ');\n  const expectedDriverOut = JSON.stringify({ outcome: result.outcome, positive: true, adverseQualified: true,\n    adverseAssertions: result.adverse.assertion, tempRoot: result.identity.tempRoot }) + '\\n';\n  if (raw.stdout !== expectedDriverOut || raw.stderr !== '') invalid('raw controller-to-driver result differs');\n  // The bound pause held only if nothing was read before the release, in both cases.\n  for (const mode of ['normal', 'backpressure']) {\n    const ev = events(mode), stopped = ev.filter(e => e.event === 'consumer-read-stopped'), restarted = ev.filter(e => e.event === 'consumer-read-restarted');\n    if (stopped.length !== 1 || stopped[0].code !== 0 || restarted.length !== 1 || restarted[0].code !== 0 || restarted[0].pausedReadBytes !== 0) invalid(mode + ' consumer did not stop reading its stdout pipe until the release');\n  }\n  const baseline = json('baseline.result.json');\n  const normalOut = read('normal.dut-stdout.bin'), adverseOut = read('backpressure.dut-stdout.bin');\n  report.publicRaw = { baseline,\n    baselineCompleteSummary: read('baseline.stdout.bin').toString().split('\\n').filter(line => /全部通过（执行|已完成子集/.test(line)),\n    normal: { events: events('normal'), stdout: normalOut.toString(), stdoutBytes: normalOut.length, stdoutBase64: normalOut.toString('base64'), stdoutSha256: sha(normalOut), stderr: read('normal.stderr.bin').toString(), result: json('normal.result.json') },\n    backpressure: { events: events('backpressure'), stdout: adverseOut.toString(), stdoutBytes: adverseOut.length, stdoutBase64: adverseOut.toString('base64'), stdoutSha256: sha(adverseOut), stderr: read('backpressure.stderr.bin').toString(), result: json('backpressure.result.json'),\n      padding: { bytes: result.adverse.prefixBytes, recoveredIntact: result.adverse.prefixValid, fullStreamSha256: result.adverse.stdoutSha256 } } };\n  report.outcome = result.outcome;\n  // This authorizes only this actually completed runtime/dependency execution.\n  // It grants no profile from the earlier Darwin evidence or platform name.\n  report.runtimeProfile = { identity: report.runtime, dependenciesManifestSha256: context.dependenciesManifestSha256,\n    actualExecutionCompleted: true, fixtureQualified: true, behaviorPassed: result.outcome === 'green' };\n  process.exitCode = result.outcome === 'green' ? 0 : 1;\n} catch (e) {\n  report.fixtureErrors.push(e instanceof Error ? e.message : String(e));\n  report.outcome = 'fixture-unqualified';\n  process.exitCode = 2;\n} finally {\n  fs.writeFileSync(path.join(home, 'controller-result.json'), JSON.stringify(report, null, 2) + '\\n');\n  process.stdout.write(mark + JSON.stringify(report) + '\\n');\n}\n"
const CONTROLLER_SHA256 = "1ee69724fa3a6870237110733c165d4ff7052a836bd91fca81f01d4b61a09103"
const PREFIX = 'WORKER_OUTPUT_CONTRACT_JSON '
const sha = (body: string | Buffer): string => createHash('sha256').update(body).digest('hex')
const inside = (candidate: string, root: string): boolean => candidate === root || candidate.startsWith(root + sep)
function invalid(message: string): never { throw new Error(`${SELFCHECK_FIXTURE_MARK} worker-output contract: ${message}`) }
/**
 * Which names the opaque cwd specimen leaves out. This fixture deliberately does not consult Git (see
 * `sourceManifest`), so it keeps its own name list: the one the worker copy used before it switched to
 * `git ls-files` (`workerCopyList` in `jobs-rule.ts`, ADR-72 line 303). It decides only what this
 * specimen contains, not what any mutation worker sees.
 */
const SPECIMEN_SKIP = new Set(['node_modules', '.git', '.check-cache', 'output', 'memory'])
const inSpecimen = (src: string): boolean => {
  const name = basename(src)
  return !SPECIMEN_SKIP.has(name) && !name.startsWith('.env')
}
type SourceEntry = { path: string; type: 'file' | 'symlink'; sha256: string }

/** Uses current visible cwd bytes, without consulting Git or a parent directory. */
function sourceManifest(root: string): SourceEntry[] {
  const rows: SourceEntry[] = []
  const visit = (rel: string): void => {
    for (const name of readdirSync(join(root, rel)).sort()) {
      const next = rel ? join(rel, name) : name, entry = join(root, next)
      if (!inSpecimen(entry)) continue
      if (next.includes('\n') || next.includes('\r')) invalid('source path cannot be represented by this fixture')
      const st = lstatSync(entry)
      if (st.isDirectory()) { visit(next); continue }
      if (st.isSymbolicLink()) {
        const link = readlinkSync(entry)
        // Production copying can make these two documentation links absolute.
        // Preserve their opaque link bytes; neither snapshot nor DUT traverses them.
        const documentationLink = isAbsolute(link) && (next === join('.agents', 'skills', 'kol-outreach') || next === join('.claude', 'skills', 'kol-outreach'))
        if (!documentationLink) {
          const resolved = realpathSync(entry)
          if (isAbsolute(link) || !inside(resolved, root)) invalid('source symlink escapes the isolated snapshot: ' + next)
          const target = relative(root, resolved)
          if (target.split(sep).some(part => !inSpecimen(part))) invalid('source symlink points into an excluded subtree: ' + next)
        }
        rows.push({ path: next, type: 'symlink', sha256: sha(link) })
      } else if (st.isFile()) rows.push({ path: next, type: 'file', sha256: sha(readFileSync(entry)) })
      else invalid('source snapshot contains a special file: ' + next)
    }
  }
  visit('')
  return rows.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

/** Matches the unchanged driver's dependency manifest; symlink bytes are explicit. */
function dependencyManifest(root: string, rel = ''): SourceEntry[] {
  return readdirSync(join(root, rel)).sort().flatMap(name => {
    const next = rel ? join(rel, name) : name, entry = join(root, next), st = lstatSync(entry)
    if (st.isDirectory()) return dependencyManifest(root, next)
    if (!st.isSymbolicLink() && !st.isFile()) invalid('dependency snapshot contains a special file')
    return [{ path: next, type: st.isSymbolicLink() ? 'symlink' as const : 'file' as const, sha256: sha(st.isSymbolicLink() ? readlinkSync(entry) : readFileSync(entry)) }]
  })
}

/**
 * Process groups whose leader is one of `pgids` and that still have a member that is not a zombie; null when the
 * process table cannot be read. Linux reads /proc without starting a process, so polling it does not change how
 * many processes a test group starts (the launch-count gate, ADR-145); elsewhere `ps` lists the table.
 */
export function liveGroups(pgids: readonly number[]): number[] | null {
  // One rule for both process-table readers: a member that is only a zombie has exited and counts as stopped.
  const running = (state: string): boolean => !state.includes('Z')
  if (process.platform === 'linux') {
    let pids: string[]
    try { pids = readdirSync('/proc').filter(name => /^\d+$/.test(name)) } catch { return null }
    const live = new Set<number>()
    for (const pid of pids) {
      let stat: string
      try { stat = readFileSync(`/proc/${pid}/stat`, 'utf8') } catch { continue }
      // pid (comm) state ppid pgrp …; comm may hold spaces and parentheses, so split after the last ')'
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      const pgid = Number(fields[2])
      if (!Number.isSafeInteger(pgid)) return null
      if (pgids.includes(pgid) && running(fields[0]!)) live.add(pgid)
    }
    return [...live]
  }
  const ps = spawnSync('/bin/ps', ['-A', '-o', 'pid=', '-o', 'pgid=', '-o', 'stat='], { encoding: 'utf8', timeout: 2000, maxBuffer: 8 * 1024 * 1024 })
  if (ps.error || ps.status !== 0 || !ps.stdout.trim()) return null
  const live = new Set<number>()
  for (const row of ps.stdout.trim().split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(row)
    if (!match) return null
    const pgid = Number(match[2])
    if (pgids.includes(pgid) && running(match[3]!)) live.add(pgid)
  }
  return [...live]
}

/**
 * The process groups this run started: the carrier's own controller group, plus every group the controller noted
 * in its ledger (the driver's guardian and the two wrapper guardians). Null when the ledger cannot be trusted —
 * a torn last line, a line that is not JSON, or a group without a usable id — because then a group may be missing.
 */
export function recordedGroups(ledger: string, carrierGroup: number | undefined): number[] | null {
  const groups = carrierGroup === undefined ? [] : [carrierGroup]
  if (!existsSync(ledger)) return groups
  let text: string
  try { text = readFileSync(ledger, 'utf8') } catch { return null }
  if (text !== '' && !text.endsWith('\n')) return null
  for (const line of text.split('\n').filter(Boolean)) {
    let parsed: unknown
    try { parsed = JSON.parse(line) } catch { return null }
    if (typeof parsed !== 'object' || parsed === null) return null
    const entry = parsed as { role?: unknown; pgid?: unknown }
    if (entry.role === 'controller') continue
    if (typeof entry.pgid !== 'number' || !Number.isSafeInteger(entry.pgid) || entry.pgid <= 1) return null
    groups.push(entry.pgid)
  }
  return groups
}

/**
 * Processes whose current directory is inside one of `roots` (zombies have none). This catches what the ledger cannot:
 * a process the code under test starts in a group of its own (the worker's verifier is detached). Linux reads
 * /proc; elsewhere `lsof` lists the cwd of every process of this user. Only this user (or root) can enter the roots,
 * which mkdtemp makes private, so other users' processes cannot hold them; this user's own processes are all readable,
 * so lsof must finish without any error (status 0) for the list to count. Null when neither can be read completely.
 */
/**
 * Real uid and start time (clock ticks since boot) of a process, from /proc/<pid>/status and /proc/<pid>/stat, which
 * need no ptrace check, unlike cwd. Undefined when either cannot be read.
 */
function owner(pid: string): { uid: number; started: number } | undefined {
  try {
    const uid = /^Uid:\s+(\d+)/m.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const started = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19])
    return uid && Number.isSafeInteger(started) ? { uid: Number(uid[1]), started } : undefined
  } catch { return undefined }
}

export function cwdHolders(roots: readonly string[]): number[] | null {
  const all = roots.flatMap(root => { try { return [root, realpathSync(root)] } catch { return [root] } })
  const inside = (dir: string): boolean => all.some(root => dir === root || dir.startsWith(root + sep))
  if (process.platform === 'linux') {
    let pids: string[]
    try { pids = readdirSync('/proc').filter(name => /^\d+$/.test(name)) } catch { return null }
    const self = owner(String(process.pid))
    const found: number[] = []
    for (const pid of pids) {
      let dir: string
      try { dir = readlinkSync(`/proc/${pid}/cwd`) } catch (error) {
        // Gone already: nothing to wait for. Otherwise the cwd is hidden (the process is not dumpable). It can only be
        // one this run started if it belongs to this user and was born after this process (which made the roots);
        // such a process might be inside, so the listing is not complete. Older or foreign ones are skipped.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        const it = owner(pid)
        if (it === undefined) { if (existsSync(`/proc/${pid}`)) return null; continue }
        if (self === undefined || (it.uid === process.getuid?.() && it.started >= self.started)) return null
        continue
      }
      if (inside(dir)) found.push(Number(pid))
    }
    return found
  }
  const lsof = spawnSync('lsof', ['-a', '-u', String(process.getuid?.() ?? -1), '-d', 'cwd', '-F', 'pn'], { encoding: 'utf8', timeout: 2000, maxBuffer: 8 * 1024 * 1024 })
  if (lsof.error || lsof.status !== 0) return null
  const found: number[] = []
  let pid = 0
  for (const line of lsof.stdout.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1))
    else if (line.startsWith('n') && inside(line.slice(1))) found.push(pid)
  }
  return found
}

const pause = (ms: number): void => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }

/**
 * Removes this run's own roots, and only after every process group it started has stopped, so that no member still
 * running can write a file back in after the removal. Returns undefined when they are gone; otherwise keeps the roots
 * and says why (groups unobservable, still running at the deadline, or the removal refused), for the caller to fail on.
 */
export function reclaimOwned(roots: readonly string[], groups: readonly number[] | null, deadlineMs = 5000): string | undefined {
  if (groups === null) return `kept ${roots.join(', ')}: the started process groups cannot be listed`
  // An unreadable or stalled `ps` counts as not seen yet: look again until the deadline (the guardian's rule, ADR-70「还第 2741 行」).
  for (const until = Date.now() + deadlineMs; ;) {
    const live = liveGroups(groups)
    const holders = live !== null && live.length === 0 ? cwdHolders(roots) : []
    if (live !== null && live.length === 0 && holders !== null && holders.length === 0) break
    if (Date.now() >= until) {
      return live === null || holders === null ? `kept ${roots.join(', ')}: cannot observe whether the processes this run started stopped`
        : live.length ? `kept ${roots.join(', ')}: process groups ${live.join(', ')} still running after ${deadlineMs} ms`
        : `kept ${roots.join(', ')}: processes ${holders.join(', ')} still working inside after ${deadlineMs} ms`
    }
    pause(50)
  }
  const refused: string[] = []
  for (const root of roots) {
    try { rmSync(root, { recursive: true, force: true }) } catch (error) { refused.push(`${root} (${error instanceof Error ? error.message : String(error)})`) }
  }
  return refused.length ? 'could not remove ' + refused.join(', ') : undefined
}

/** One host controller launch; only an original qualified red returns false. */
export function runWorkerOutputContract(): boolean {
  const root = realpathSync(process.cwd()), home = realpathSync(mkdtempSync(join(tmpdir(), 'worker-output-carrier-')))
  // Made here, before any controller or driver exists, so this run knows the exact path it owns. Same parent and
  // name pattern as the driver's own mkdtemp had: TMPDIR is not deepened (tsx sockets and caches stay where they were).
  let driverRoot: string | undefined, carrierGroup: number | undefined, failure: unknown
  try {
    driverRoot = mkdtempSync(join(tmpdir(), 'kc-worker-output-independent-'))
    const core = join(root, 'scripts/check/mutate.ts'), lock = join(root, 'package-lock.json')
    if (!lstatSync(core).isFile() || !lstatSync(lock).isFile()) invalid('core DUT and lock must be regular current-cwd files')
    const before = sourceManifest(root), coreBefore = readFileSync(core), lockBefore = readFileSync(lock)
    const dependenciesAt = realpathSync(join(root, 'node_modules')), dependenciesBefore = dependencyManifest(dependenciesAt)
    const runtime = { version: process.version, platform: process.platform, arch: process.arch,
      execPath: realpathSync(process.execPath), sha256: sha(readFileSync(process.execPath)) }
    const specimen = join(home, 'specimen')
    cpSync(root, specimen, { recursive: true, dereference: false, verbatimSymlinks: true,
      filter: source => source === root || inSpecimen(source) })
    if (!isDeepStrictEqual(sourceManifest(specimen), before) || !readFileSync(join(specimen, 'scripts/check/mutate.ts')).equals(coreBefore)) invalid('opaque source copy differs from current cwd')
    // Dependencies are a separate declared shared input, not Git specimen files.
    symlinkSync(dependenciesAt, join(specimen, 'node_modules'), 'dir')
    for (const file of WORKER_OUTPUT_CONTRACT_FILES) {
      if (sha(file.body) !== file.sha256) invalid('frozen oracle member hash mismatch: ' + file.name)
      writeFileSync(join(home, file.name), file.body)
    }
    if (sha(WORKER_OUTPUT_GUARDIAN) !== WORKER_OUTPUT_GUARDIAN_SHA256) invalid('guardian source hash mismatch')
    writeFileSync(join(home, 'guardian.cjs'), WORKER_OUTPUT_GUARDIAN)
    if (sha(CONTROLLER) !== CONTROLLER_SHA256) invalid('local controller source hash mismatch')
    writeFileSync(join(home, 'controller.mjs'), CONTROLLER)
    const emptyGit = join(home, 'empty-git'); mkdirSync(emptyGit)
    const env: NodeJS.ProcessEnv = { ...process.env }
    // Existing selfcheck Git isolation, with explicit template/hook/identity controls.
    for (const key of Object.keys(env)) if (key === 'NODE_OPTIONS' || key.startsWith('TSX_') || key.startsWith('KOL_') || key.startsWith('GIT_')) delete env[key]
    Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_TEMPLATE_DIR: emptyGit, GIT_AUTHOR_NAME: 'Worker output specimen', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Worker output specimen', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
      GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false',
      GIT_CONFIG_KEY_1: 'core.hooksPath', GIT_CONFIG_VALUE_1: emptyGit,
      GIT_CONFIG_KEY_2: 'commit.gpgsign', GIT_CONFIG_VALUE_2: 'false' })
    const context = { actualCwd: root, driverTempRoot: driverRoot, sourceManifest: before, sourceManifestSha256: sha(JSON.stringify(before)), sourceFiles: before.length,
      dotGitAtCwd: readdirSync(root).includes('.git'), coreSha256: sha(coreBefore), lockSha256: sha(lockBefore),
      dependenciesRoot: dependenciesAt, dependenciesManifestSha256: sha(JSON.stringify(dependenciesBefore)),
      dependencyEntries: ['tsx/dist/cli.mjs','tsx/package.json','typescript/lib/typescript.js','typescript/package.json','esbuild/package.json'].map(p => ({ path: p, realPath: realpathSync(join(dependenciesAt, p)), sha256: sha(readFileSync(join(dependenciesAt, p))) })),
      runtime, envPolicy: 'No inherited Git/Node preload/TSX/KOL controls; private Git config/template/hook/identity; remaining environment inherited' }
    writeFileSync(join(home, 'context.json'), JSON.stringify(context) + '\n')
    const controllerOptions = {
      cwd: root, env: { ...env, KOL_GUARDIAN_PARENT_PID: String(process.pid) }, detached: true, encoding: 'utf8' as const, timeout: 360000, maxBuffer: 8 * 1024 * 1024
    }
    const child = spawnSync(process.execPath, [join(home, 'guardian.cjs'), 'group', process.execPath, join(home, 'controller.mjs'), home], controllerOptions)
    if (child.pid) carrierGroup = child.pid
    const after = sourceManifest(root), dependenciesAfter = dependencyManifest(dependenciesAt)
    const sourceAfter = { sourceManifestSha256: sha(JSON.stringify(after)), coreSha256: sha(readFileSync(core)),
      lockSha256: sha(readFileSync(lock)), dependenciesManifestSha256: sha(JSON.stringify(dependenciesAfter)), runtimeSha256: sha(readFileSync(process.execPath)) }
    process.stdout.write(child.stdout ?? ''); process.stderr.write(child.stderr ?? '')
    console.log('WORKER_OUTPUT_CARRIER_SOURCE_JSON ' + JSON.stringify({ before: { sourceManifestSha256: context.sourceManifestSha256,
      coreSha256: context.coreSha256, lockSha256: context.lockSha256, dependenciesManifestSha256: context.dependenciesManifestSha256, runtimeSha256: runtime.sha256 }, after: sourceAfter, controllerSha256: sha(CONTROLLER) }))
    if (!isDeepStrictEqual(before, after) || !isDeepStrictEqual(dependenciesBefore, dependenciesAfter)
      || !readFileSync(core).equals(coreBefore) || !readFileSync(lock).equals(lockBefore) || sourceAfter.runtimeSha256 !== runtime.sha256) invalid('actual cwd, dependencies or runtime changed during the contract')
    if (child.error || child.signal !== null) invalid('external controller did not complete: ' + (child.error?.message ?? child.signal))
    const lines = (child.stdout ?? '').split('\n')
    if (lines.pop() !== '' || lines.length !== 1 || !lines[0]!.startsWith(PREFIX) || child.stderr !== '') invalid('external controller raw receipt incomplete or repeated')
    let receipt: { fixtureErrors: unknown[]; outcome: string; runtime: unknown; binding: { reverseFullFileByteEqual: boolean }; originalResult: { outcome: string } }
    try { receipt = JSON.parse(lines[0]!.slice(PREFIX.length)) as typeof receipt } catch { invalid('external controller JSON malformed') }
    if (!isDeepStrictEqual(receipt, JSON.parse(readFileSync(join(home, 'controller-result.json'), 'utf8')))) invalid('raw receipt and controller result differ')
    if (!Array.isArray(receipt.fixtureErrors) || receipt.fixtureErrors.length || !['green','red'].includes(receipt.outcome)
      || !isDeepStrictEqual(receipt.runtime, runtime) || receipt.binding?.reverseFullFileByteEqual !== true
      || receipt.originalResult?.outcome !== receipt.outcome || child.status !== (receipt.outcome === 'green' ? 0 : 1)) invalid('original contract or controller fixture did not qualify')
    return receipt.outcome === 'green'
  } catch (error) {
    failure = error
    if (error instanceof Error && error.message.includes(SELFCHECK_FIXTURE_MARK)) throw error
    return invalid(error instanceof Error ? error.message : String(error))
  } finally {
    // Before a receipt or after one, completed or interrupted: the same two roots, once the groups are gone.
    const kept = reclaimOwned(driverRoot === undefined ? [home] : [driverRoot, home], recordedGroups(join(home, 'process-groups.ndjson'), carrierGroup))
    // A kept root makes the run unqualified, whatever it returned.
    if (kept) invalid(kept + (failure instanceof Error ? ` (after: ${failure.message})` : ''))
  }
}
