import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { copyIntoWorker } from './check/jobs-rule.js'
import { SELFCHECK_FIXTURE_MARK } from './check/verifier-rule.js'
import { WORKER_OUTPUT_CONTRACT_FILES } from './worker-output-contract-data.js'
import { WORKER_OUTPUT_GUARDIAN, WORKER_OUTPUT_GUARDIAN_SHA256 } from './worker-output-guardian-data.js'

const CONTROLLER = "// Review copy of the local adapter embedded in worker-output-contract-test.ts.\n// It never loads DUT code into the controller or reads implementation bodies.\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport os from 'node:os';\nimport crypto from 'node:crypto';\nimport { spawnSync } from 'node:child_process';\n\nconst home = fs.realpathSync(process.argv[2]);\nconst context = JSON.parse(fs.readFileSync(path.join(home, 'context.json')));\nconst specimen = path.join(home, 'specimen');\nconst output = path.join(home, 'run');\nconst sha = b => crypto.createHash('sha256').update(b).digest('hex');\nconst originalDriverSha = '578db7a45bf36ae6da9945af913bb1eca0ed49b497023980819a0a72b5e8b8b3';\nconst wrapperSha = '03b355d3a78b9ec72cb2f73e01d9deb14fc6ed8bc7dab328412cf6e2145c3305';\nconst mark = 'WORKER_OUTPUT_CONTRACT_JSON ';\nconst report = { fixtureErrors: [], context: { ...context, sourceManifest: undefined }, runtime: { version: process.version, platform: process.platform,\n  arch: process.arch, execPath: fs.realpathSync(process.execPath), sha256: sha(fs.readFileSync(process.execPath)) } };\nlet ownedCompletedDriverTemp = null;\nconst invalid = message => { throw new Error(message); };\nconst read = name => fs.readFileSync(path.join(output, name));\nconst json = name => JSON.parse(read(name));\nconst same = (a,b) => JSON.stringify(a) === JSON.stringify(b);\nconst git = args => {\n  const r = spawnSync('git', args, { cwd: specimen, env: process.env, encoding: null });\n  if (r.error || r.status !== 0 || r.signal !== null) invalid('private specimen Git failed: ' + (r.error?.message ?? r.stderr.toString()));\n  return r.stdout;\n};\nconst events = mode => read(`${mode}.events.ndjson`).toString().trim().split('\\n').map(line => JSON.parse(line));\n\ntry {\n  if (!same(report.runtime, context.runtime)) invalid('controller runtime differs from host input');\n  if (sha(fs.readFileSync(path.join(specimen, 'scripts/check/mutate.ts'))) !== context.coreSha256) invalid('specimen core differs from actual cwd');\n  // Existing local Git-fixture isolation pattern: no inherited repository,\n  // global/system config, templates, signing, hooks or user identity.\n  git(['init', '--quiet', '--initial-branch=worker-output-specimen', '--template=' + path.join(home, 'empty-git')]);\n  git(['add', '--force', '--all', '--', '.', ':!node_modules']);\n  git(['commit', '--quiet', '-m', 'private worker-output opaque cwd specimen']);\n  const specimenCommit = git(['rev-parse', 'HEAD']).toString().trim();\n  const coreCommit = git(['show', `${specimenCommit}:scripts/check/mutate.ts`]);\n  if (sha(coreCommit) !== context.coreSha256 || !coreCommit.equals(fs.readFileSync(path.join(specimen, 'scripts/check/mutate.ts')))) invalid('committed core is not the actual cwd bytes');\n  const original = fs.readFileSync(path.join(home, 'original-driver.mjs'));\n  const wrapper = fs.readFileSync(path.join(home, 'pipe-wrapper.mjs'));\n  if (sha(original) !== originalDriverSha || sha(wrapper) !== wrapperSha) invalid('frozen original changed');\n  const edits = [\n    { input: 'source', before: \"const source = '/private/tmp/kc-20261024/ci-runtime-recovery-20261025';\", after: `const source = ${JSON.stringify(specimen)};` },\n    { input: 'specimenCommit', before: \"const expectedHead = '26b8ceb4c0f36220e381c7b7bb71716567f54c29';\", after: `const expectedHead = ${JSON.stringify(specimenCommit)};` },\n    { input: 'runtime.sha256', before: \"const expectedNodeSha = '913b144fdb40638b1acef7974ab3c33fbd527cc0974cb5da467ab1e6ac51b4d4';\", after: `const expectedNodeSha = ${JSON.stringify(report.runtime.sha256)};` },\n    { input: 'runtime.version', before: \"process.version !== 'v22.22.0'\", after: `process.version !== ${JSON.stringify(report.runtime.version)}` },\n    // Preserve the frozen wrapper bytes while inserting a process-lifetime guard.\n    { input: 'wrapperGuard', before: \"[path.join(here, 'pipe-wrapper.mjs')]\", after: \"[path.join(here, 'guardian.cjs'), 'group', process.execPath, path.join(here, 'pipe-wrapper.mjs')]\" },\n    { input: 'wrapperGuardParent', before: \"cwd, env: environment, detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe']\", after: \"cwd, env: { ...environment, KOL_GUARDIAN_PARENT_PID: String(process.pid), KOL_GUARD_FORWARD_FD3: '1' }, detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe']\" }\n  ];\n  const replaceOne = (body, before, after) => {\n    const at = body.indexOf(before);\n    if (at < 0 || body.indexOf(before, at + before.length) !== -1) invalid('binding region missing or repeated');\n    return body.slice(0, at) + after + body.slice(at + before.length);\n  };\n  let bound = original.toString('utf8');\n  if (!Buffer.from(bound).equals(original)) invalid('original driver UTF-8 round trip failed');\n  for (const e of edits) bound = replaceOne(bound, e.before, e.after);\n  let reversed = bound;\n  for (const e of [...edits].reverse()) reversed = replaceOne(reversed, e.after, e.before);\n  if (!Buffer.from(reversed).equals(original) || sha(reversed) !== originalDriverSha) invalid('full driver reverse binding differs');\n  fs.mkdirSync(output);\n  fs.writeFileSync(path.join(output, 'contract-driver.mjs'), bound);\n  fs.writeFileSync(path.join(output, 'pipe-wrapper.mjs'), wrapper);\n  fs.copyFileSync(path.join(home, 'guardian.cjs'), path.join(output, 'guardian.cjs'));\n  report.binding = { inputs: ['opaqueCurrentCwdSpecimen', 'privateSpecimenCommit', 'actualRuntimeProfile'], edits,\n    specimen, specimenCommit, commitRole: 'Synthetic private snapshot only; never the author or main HEAD',\n    originalDriverSha256: originalDriverSha, boundDriverSha256: sha(bound), reverseDriverSha256: sha(reversed),\n    reverseFullFileByteEqual: true, wrapperSha256: sha(wrapper), coreSha256: context.coreSha256 };\n  fs.writeFileSync(path.join(output, 'binding.json'), JSON.stringify(report.binding, null, 2) + '\\n');\n  const raw = spawnSync(process.execPath, [path.join(home, 'guardian.cjs'), 'group', process.execPath, path.join(output, 'contract-driver.mjs')], {\n    cwd: specimen, env: { ...process.env, KOL_GUARDIAN_PARENT_PID: String(process.pid) }, detached: true, encoding: 'utf8', timeout: 300000, maxBuffer: 4 * 1024 * 1024\n  });\n  report.driverRaw = { stdout: raw.stdout ?? '', stderr: raw.stderr ?? '', status: raw.status,\n    signal: raw.signal, error: raw.error?.message ?? null };\n  if (raw.error || raw.signal !== null) invalid('original driver did not complete');\n  report.originalResult = json('run-result.json');\n  const result = report.originalResult;\n  if (result.identity.source !== specimen || result.identity.head !== specimenCommit\n    || result.identity.nodeVersion !== report.runtime.version || result.identity.nodeSha256 !== report.runtime.sha256\n    || result.identity.platform !== report.runtime.platform || result.identity.arch !== report.runtime.arch) invalid('driver input/runtime receipt differs');\n  const cloneManifest = json('source.manifest.json');\n  if (!same(cloneManifest, context.sourceManifest)) invalid('Git clone no longer represents the actual cwd source snapshot');\n  if (result.identity.lockSha256 !== context.lockSha256 || result.identity.dependenciesManifestSha256 !== context.dependenciesManifestSha256) invalid('driver dependency identity differs from current input');\n  const driverSource = read('contract-driver.mjs');\n  if (sha(driverSource) !== report.binding.boundDriverSha256 || sha(read('pipe-wrapper.mjs')) !== wrapperSha) invalid('bound controller files changed during execution');\n  if (sha(fs.readFileSync(path.join(specimen, 'scripts/check/mutate.ts'))) !== context.coreSha256) invalid('specimen core changed during execution');\n  // Claim only the independently validated private root, including an unqualified completed run.\n  const completedTemp = fs.realpathSync(result.identity.tempRoot);\n  if (path.dirname(completedTemp) !== fs.realpathSync(os.tmpdir()) || !/^kc-worker-output-independent-[A-Za-z0-9]+$/.test(path.basename(completedTemp))) invalid('completed driver temporary-directory ownership differs');\n  ownedCompletedDriverTemp = completedTemp;\n  if (!['green','red'].includes(result.outcome) || result.baselineQualified !== true || result.positive?.passed !== true || result.adverse?.fixtureQualified !== true) invalid('original driver fixture did not qualify');\n  if (raw.status !== (result.outcome === 'green' ? 0 : 1)) invalid('original driver exit and outcome differ');\n  const expectedDriverOut = JSON.stringify({ outcome: result.outcome, positive: true, adverseQualified: true,\n    adverseAssertions: result.adverse.assertion, tempRoot: result.identity.tempRoot }) + '\\n';\n  if (raw.stdout !== expectedDriverOut || raw.stderr !== '') invalid('raw controller-to-driver result differs');\n  const baseline = json('baseline.result.json');\n  const normalOut = read('normal.dut-stdout.bin'), adverseOut = read('backpressure.dut-stdout.bin');\n  report.publicRaw = { baseline,\n    baselineCompleteSummary: read('baseline.stdout.bin').toString().split('\\n').filter(line => /全部通过（执行|已完成子集/.test(line)),\n    normal: { events: events('normal'), stdout: normalOut.toString(), stdoutBytes: normalOut.length, stdoutBase64: normalOut.toString('base64'), stdoutSha256: sha(normalOut), stderr: read('normal.stderr.bin').toString(), result: json('normal.result.json') },\n    backpressure: { events: events('backpressure'), stdout: adverseOut.toString(), stdoutBytes: adverseOut.length, stdoutBase64: adverseOut.toString('base64'), stdoutSha256: sha(adverseOut), stderr: read('backpressure.stderr.bin').toString(), result: json('backpressure.result.json'),\n      padding: { bytes: result.adverse.prefixBytes, recoveredIntact: result.adverse.prefixValid, fullStreamSha256: result.adverse.stdoutSha256 } } };\n  report.outcome = result.outcome;\n  // This authorizes only this actually completed runtime/dependency execution.\n  // It grants no profile from the earlier Darwin evidence or platform name.\n  report.runtimeProfile = { identity: report.runtime, dependenciesManifestSha256: context.dependenciesManifestSha256,\n    actualExecutionCompleted: true, fixtureQualified: true, behaviorPassed: result.outcome === 'green' };\n  process.exitCode = result.outcome === 'green' ? 0 : 1;\n} catch (e) {\n  report.fixtureErrors.push(e instanceof Error ? e.message : String(e));\n  report.outcome = 'fixture-unqualified';\n  process.exitCode = 2;\n} finally {\n  if (ownedCompletedDriverTemp) {\n    try { fs.rmSync(ownedCompletedDriverTemp, { recursive: true, force: true }); report.completedDriverTempRemoved = true; }\n    catch (e) { report.fixtureErrors.push('completed private driver temporary cleanup failed: ' + e.message); report.outcome = 'fixture-unqualified'; process.exitCode = 2; }\n  }\n  fs.writeFileSync(path.join(home, 'controller-result.json'), JSON.stringify(report, null, 2) + '\\n');\n  process.stdout.write(mark + JSON.stringify(report) + '\\n');\n}\n"
const CONTROLLER_SHA256 = "69bbf34b4e4896b31f5358e994c0d2af1fd82bd77d57981b2012730e4c1f594a"
const PREFIX = 'WORKER_OUTPUT_CONTRACT_JSON '
const sha = (body: string | Buffer): string => createHash('sha256').update(body).digest('hex')
const inside = (candidate: string, root: string): boolean => candidate === root || candidate.startsWith(root + sep)
function invalid(message: string): never { throw new Error(`${SELFCHECK_FIXTURE_MARK} worker-output contract: ${message}`) }
type SourceEntry = { path: string; type: 'file' | 'symlink'; sha256: string }

/** Uses current visible cwd bytes, without consulting Git or a parent directory. */
function sourceManifest(root: string): SourceEntry[] {
  const rows: SourceEntry[] = []
  const visit = (rel: string): void => {
    for (const name of readdirSync(join(root, rel)).sort()) {
      const next = rel ? join(rel, name) : name, entry = join(root, next)
      if (!copyIntoWorker(entry)) continue
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
          if (target.split(sep).some(part => !copyIntoWorker(part))) invalid('source symlink points into an excluded subtree: ' + next)
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

/** One host controller launch; only an original qualified red returns false. */
export function runWorkerOutputContract(): boolean {
  const root = realpathSync(process.cwd()), home = realpathSync(mkdtempSync(join(tmpdir(), 'worker-output-carrier-')))
  try {
    const core = join(root, 'scripts/check/mutate.ts'), lock = join(root, 'package-lock.json')
    if (!lstatSync(core).isFile() || !lstatSync(lock).isFile()) invalid('core DUT and lock must be regular current-cwd files')
    const before = sourceManifest(root), coreBefore = readFileSync(core), lockBefore = readFileSync(lock)
    const dependenciesAt = realpathSync(join(root, 'node_modules')), dependenciesBefore = dependencyManifest(dependenciesAt)
    const runtime = { version: process.version, platform: process.platform, arch: process.arch,
      execPath: realpathSync(process.execPath), sha256: sha(readFileSync(process.execPath)) }
    const specimen = join(home, 'specimen')
    cpSync(root, specimen, { recursive: true, dereference: false, verbatimSymlinks: true,
      filter: source => source === root || copyIntoWorker(source) })
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
    const context = { actualCwd: root, sourceManifest: before, sourceManifestSha256: sha(JSON.stringify(before)), sourceFiles: before.length,
      dotGitAtCwd: readdirSync(root).includes('.git'), coreSha256: sha(coreBefore), lockSha256: sha(lockBefore),
      dependenciesRoot: dependenciesAt, dependenciesManifestSha256: sha(JSON.stringify(dependenciesBefore)),
      dependencyEntries: ['tsx/dist/cli.mjs','tsx/package.json','typescript/lib/typescript.js','typescript/package.json','esbuild/package.json'].map(p => ({ path: p, realPath: realpathSync(join(dependenciesAt, p)), sha256: sha(readFileSync(join(dependenciesAt, p))) })),
      runtime, envPolicy: 'No inherited Git/Node preload/TSX/KOL controls; private Git config/template/hook/identity; remaining environment inherited' }
    writeFileSync(join(home, 'context.json'), JSON.stringify(context) + '\n')
    const controllerOptions = {
      cwd: root, env: { ...env, KOL_GUARDIAN_PARENT_PID: String(process.pid) }, detached: true, encoding: 'utf8' as const, timeout: 360000, maxBuffer: 8 * 1024 * 1024
    }
    const child = spawnSync(process.execPath, [join(home, 'guardian.cjs'), 'group', process.execPath, join(home, 'controller.mjs'), home], controllerOptions)
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
    if (error instanceof Error && error.message.includes(SELFCHECK_FIXTURE_MARK)) throw error
    invalid(error instanceof Error ? error.message : String(error))
  } finally { rmSync(home, { recursive: true, force: true }) }
}
