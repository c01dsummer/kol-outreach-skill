/** Finite frozen producer/lifecycle adapter. No oracle or command tuple is reconstructed here. */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { SELFCHECK_FIXTURE_MARK } from './check/verifier-rule.js'
import {
  COMBINED_FREEZE_SHA256, CONTRACT_BUCKETS, FROZEN_CONTRACT_FILES, ORIGINAL_FIXTURE_ROOT,
  ORIGINAL_FREEZES, ORIGINAL_PACKET_ROOT, PORTABLE_GUARD_SCOPES,
  SYNC43_FREEZE_SHA256, SYNC43_FILES, SYNC43_NORMAL_LABELS,
} from './prebuilt-no-config-contract-data.js'

type ObjectValue = Record<string, unknown>
const object = (value: unknown): value is ObjectValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex')
const sameMembers = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && [...actual].sort().every((label, i) => label === [...expected].sort()[i])
function invalid(message: string): never { throw new Error(`${SELFCHECK_FIXTURE_MARK} prebuilt no-config: ${message}`) }
const readObject = (file: string): ObjectValue => {
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
  return object(value) ? value : invalid(`report is not an object: ${file}`)
}
const SELECTED = ['N.SIGTERM.GROUP', 'N.SIGINT.GROUP', 'N.THROW'] as const

/** Loaded only by its selected test.ts group; callers must not import this module eagerly. */
export async function runPrebuiltNoConfigContracts(phase: 'all' | 'producer' | 'lifecycle' = 'all'): Promise<ReadonlyMap<string, readonly string[]>> {
  if (!['all', 'producer', 'lifecycle'].includes(phase)) invalid('unknown contract phase')
  const target = realpathSync(resolve('.'))
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kol-prebuilt-no-config-')))
  try {
    // Prefix replacement is deliberately a narrow, reversible path binding, not a JS rewrite.
    if (/[\\'"\r\n]/.test(root)) invalid('temporary path cannot be represented by the frozen prefix overlay')
    const ownerByLabel = new Map<string, string>()
    const diagnostics = new Map<string, string[]>()
    const syncLabels = process.platform === 'linux' ? SYNC43_NORMAL_LABELS.linux
      : process.platform === 'darwin' ? SYNC43_NORMAL_LABELS.darwin : invalid('sync43 platform is outside the frozen scope')
    for (const bucket of CONTRACT_BUCKETS) {
      if (diagnostics.has(bucket.name) || !bucket.labels.length) invalid('invalid static bucket table')
      diagnostics.set(bucket.name, [])
      const normalLabels = bucket.labels.some(label => label.startsWith('N.SYNC_SELF_TERM.'))
        ? [...bucket.labels.filter(label => !label.startsWith('N.SYNC_SELF_TERM.')), ...syncLabels] : bucket.labels
      for (const label of normalLabels) {
        if (ownerByLabel.has(label)) invalid(`duplicate frozen label: ${label}`)
        ownerByLabel.set(label, bucket.name)
      }
    }
    const normalCount = 164 - 7 + syncLabels.length
    if (diagnostics.size !== 8 || ownerByLabel.size !== normalCount
      || normalCount !== (process.platform === 'linux' ? 166 : 167)) invalid('normal contract must contain 8 buckets / platform-specific 166 or 167 unique labels')
    const selected = new Set((phase === 'producer' ? CONTRACT_BUCKETS.slice(0, 6)
      : phase === 'lifecycle' ? CONTRACT_BUCKETS.slice(6) : CONTRACT_BUCKETS).map(bucket => bucket.name))
    const result = (): ReadonlyMap<string, readonly string[]> => new Map([...diagnostics].filter(([name]) => selected.has(name)))

    const bindings = {
      packet: [ORIGINAL_PACKET_ROOT, join(root, 'packet')],
      original: [ORIGINAL_FIXTURE_ROOT, join(root, 'original')],
    } as const
    // Old76 members and old scoped manifests remain unchanged. New tool has its
    // own exact closure outside every lifecycle319 portable guard prefix.
    const boundFiles = [...FROZEN_CONTRACT_FILES, ...SYNC43_FILES].map(file => {
      if (hash(file.body) !== file.sha256) invalid(`original frozen bytes changed: ${file.name}`)
      let body = file.body
      for (const key of file.rootBindings) {
        const [from, to] = bindings[key]
        body = body.replaceAll(from, to)
      }
      let reversed = body
      for (const key of file.rootBindings) {
        const [from, to] = bindings[key]
        reversed = reversed.replaceAll(to, from)
      }
      if (reversed !== file.body) invalid(`path binding is not reversible: ${file.name}`)
      const path = join(root, file.name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, body)
      return { name: file.name, path, sha256: hash(body), originalSha256: file.sha256 }
    })
    // File-only Git packaging omits both empty fixture directories.
    mkdirSync(join(root, 'packet/producer/inputs/fixtures/no-config/leaf'), { recursive: true })
    mkdirSync(join(root, 'original/fixtures/no-config/leaf'), { recursive: true })
    mkdirSync(join(root, 'tmp'), { recursive: true })
    const portableGuards: { path: string; sha256: string }[] = []
    for (const [scope, origin] of PORTABLE_GUARD_SCOPES) {
      const source = ORIGINAL_FREEZES.find(record => record.path === origin)
      if (!source) invalid(`missing full-manifest provenance: ${scope}`)
      const files = boundFiles.filter(file => file.name.startsWith(`${scope}/`) && !file.name.endsWith('/freeze-manifest.json')).map(file => ({
        path: file.name.slice(scope.length + 1), sha256: file.sha256, originalSha256: file.originalSha256,
      }))
      const body = JSON.stringify({
        kind: 'portable-runtime-subset/v1', originalManifestSha256: source.sha256,
        originalFullManifestNotClaimed: true, omittedFromOriginal: source.omitted, files,
      }, null, 2) + '\n'
      const path = join(root, scope, 'freeze-manifest.json')
      writeFileSync(path, body)
      portableGuards.push({ path, sha256: hash(body) })
    }
    const verifyInputs = (): void => {
      for (const file of [...boundFiles.filter(file => !portableGuards.some(guard => guard.path === file.path)), ...portableGuards]) {
        if (hash(readFileSync(file.path)) !== file.sha256) invalid(`portable input changed: ${file.path}`)
      }
    }
    writeFileSync(join(root, 'portable-bindings.json'), JSON.stringify({
      combinedFreezeSha256: COMBINED_FREEZE_SHA256, originalFreezes: ORIGINAL_FREEZES, bindings,
      sync43FreezeSha256: SYNC43_FREEZE_SHA256, normalCount,
      members: boundFiles.map(file => ({ ...file, executedSha256: portableGuards.find(guard => guard.path === file.path)?.sha256 ?? file.sha256 })),
      scope: 'runtime subset only; no original full-manifest qualification or N.CACHE consumption claim',
    }, null, 2) + '\n')

    const publicRequire = createRequire(join(target, 'package.json'))
    const publicLoader = pathToFileURL(publicRequire.resolve('tsx')).href
    const bindingFiles = Object.fromEntries([
      ['api', 'prebuilt.ts'], ['hook', 'prebuilt-hook.ts'],
      ['parent', 'prebuilt-parent.ts'], ['signals', 'prebuilt-signals.ts'],
    ].map(([key, file]) => [key, join(target, 'scripts/check', file)]))
    const apiRequire = createRequire(pathToFileURL(bindingFiles.api))
    const tsxPackage = readObject(publicRequire.resolve('tsx/package.json'))
    const esbuildPackage = readObject(apiRequire.resolve('esbuild/package.json'))
    const legacyRoot = join(root, 'packet/producer/legacy-public-api')
    // Exactly three frozen legacy public modules share only the installed dependencies.
    symlinkSync(realpathSync(join(target, 'node_modules')), join(legacyRoot, 'node_modules'), 'dir')
    const legacyOwnerBindingFiles = Object.fromEntries(['prebuilt.ts', 'prebuilt-hook.ts', 'tsx-cmd.ts']
      .map(file => [file, join(legacyRoot, 'scripts/check', file)]))
    const runtimePath = join(root, 'runtime.json')
    const lifecycleRuntimePath = join(root, 'lifecycle-runtime.json')
    const runtime = {
      node: process.execPath, nodeVersion: process.version, nodePlatform: process.platform, nodeArch: process.arch,
      tsxVersion: tsxPackage.version, esbuildVersion: esbuildPackage.version, publicResolutionOwner: target,
      apiModuleURL: pathToFileURL(bindingFiles.api).href, bindingFiles,
      legacyOwnerApiModuleURL: pathToFileURL(legacyOwnerBindingFiles['prebuilt.ts']).href, legacyOwnerBindingFiles,
      baseEnv: {
        PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? '/usr/bin:/bin'}`,
        TMPDIR: join(root, 'tmp'), LANG: 'C', TZ: 'UTC',
      },
      unsetEnv: ['TSX_TSCONFIG_PATH', 'NODE_OPTIONS', 'KOL_PREBUILT'],
      outputRoot: join(root, 'producer-runs'), lifecycleOutputRoot: join(root, 'lifecycle-runs'),
      lifecycleRuntimePath, cacheWitnessPayloads: [],
    }
    writeFileSync(runtimePath, JSON.stringify(runtime, null, 2) + '\n')
    const toolEnv = { ...process.env }
    for (const name of ['NODE_OPTIONS', 'TSX_TSCONFIG_PATH', 'KOL_PREBUILT']) delete toolEnv[name]
    const execute = (entry: string, config: string, selectors: readonly string[] = []): ObjectValue | undefined => {
      verifyInputs()
      const child = spawnSync(process.execPath, ['--import', publicLoader, join(root, entry), config, ...selectors], {
        cwd: target, env: toolEnv, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 180_000,
      })
      verifyInputs()
      if (child.error || child.signal || ![0, 1].includes(child.status as number)) {
        invalid(`tool did not produce semantic PASS/FAIL: ${entry}: ${child.error ?? child.signal ?? child.status}\n${child.stdout}${child.stderr}`)
      }
      if (entry.endsWith('/prepare.mjs')) {
        if (child.status !== 0) invalid(`public descriptor preparation failed: ${child.stdout}${child.stderr}`)
        // This is the independent supplier's actual output, never a reconstructed C tuple.
        readObject(lifecycleRuntimePath)
        return undefined
      }
      const summaries = child.stdout.split('\n').flatMap(line => {
        try { const value: unknown = JSON.parse(line); return object(value) && typeof value.report === 'string' ? [value] : [] } catch { return [] }
      })
      if (summaries.length !== 1) invalid(`missing/ambiguous report receipt: ${entry}`)
      const reportPath = realpathSync(summaries[0].report as string)
      const inside = relative(root, reportPath)
      if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) invalid('report escaped owned temporary root')
      const report = readObject(reportPath)
      if (!['PASS', 'FAIL'].includes(report.status as string) || report.infrastructureError || report.reason) {
        invalid(`frozen verifier unavailable: ${entry}: ${JSON.stringify({ status: report.status, error: report.infrastructureError, reason: report.reason })}`)
      }
      if (child.status !== (report.status === 'PASS' ? 0 : 1)) invalid(`report / exit mismatch: ${entry}`)
      return report
    }

    const consume = (report: ObjectValue, expected: readonly string[], context: string): void => {
      if (!Array.isArray(report.assertions)) invalid(`missing assertions: ${context}`)
      const rows = report.assertions as unknown[]
      if (report.semanticAssertions !== rows.length || !rows.length) invalid(`incomplete assertion receipt: ${context}`)
      const labels: string[] = []
      let failures = 0
      for (const row of rows) {
        if (!object(row) || typeof row.label !== 'string' || !['PASS', 'FAIL'].includes(row.status as string) || labels.includes(row.label)) invalid(`invalid/duplicate assertion: ${context}`)
        labels.push(row.label)
        const bucket = ownerByLabel.get(row.label)
        if (!bucket || !expected.includes(row.label)) invalid(`unexpected frozen label: ${row.label}`)
        if (row.status === 'FAIL') {
          failures++
          diagnostics.get(bucket)!.push(`${row.label}: ${JSON.stringify({ expected: row.expected, actual: row.actual })}`)
        }
      }
      // Only the runner's documented candidate-ready / absent-result failure branches are partial.
      const missingFidelity = SELECTED.includes(context as typeof SELECTED[number]) && labels.length === expected.length - 1 &&
        sameMembers(labels, expected.filter(label => label !== `${context}.FIDELITY`)) &&
        rows.some(row => object(row) && row.label === `${context}.VALUES` && row.status === 'FAIL')
      if (!sameMembers(labels, expected) && !missingFidelity) invalid(`missing frozen labels: ${context}`)
      if ((report.status === 'PASS') !== (failures === 0)) invalid(`assertion/status mismatch: ${context}`)
    }
    const labels = [...ownerByLabel.keys()]
    if (phase !== 'lifecycle') {
      const producer = execute('packet/producer/src/run.mjs', runtimePath)!
      consume(producer, labels.filter(label => label.startsWith('V4.') && !label.startsWith('V4.PRELOAD.')), 'producer117')
    }
    if (phase === 'producer') { verifyInputs(); return result() }
    execute('packet/descriptor/prepare.mjs', runtimePath)
    const main = execute('packet/lifecycle319/src/run.mjs', lifecycleRuntimePath, SELECTED)!
    if (!Array.isArray(main.cases) || !sameMembers(main.cases.map(value => object(value) ? String(value.id) : ''), SELECTED)) invalid('selected lifecycle cases missing/duplicated')
    if ((main.status === 'PASS') !== main.cases.every(value => object(value) && value.status === 'PASS')) invalid('lifecycle aggregate status mismatch')
    let lifecycleCount = 0
    for (const value of main.cases) {
      if (!object(value) || !SELECTED.includes(value.id as typeof SELECTED[number]) || !['PASS', 'FAIL'].includes(value.status as string)) invalid('lifecycle case unavailable')
      const id = value.id as string
      // ENTRY_READY is a frozen alternate diagnostic outside the normal label set.
      if (Array.isArray(value.assertions) && value.assertions.length === 1 && object(value.assertions[0]) && value.assertions[0].label === `${id}.ENTRY_READY`) {
        if (value.status !== 'FAIL' || value.assertions[0].status !== 'FAIL' || value.semanticAssertions !== 1 || id === 'N.THROW') invalid('invalid candidate-ready diagnostic')
        diagnostics.get(ownerByLabel.get(`${id}.RAW`)!)!.push(`${id}.ENTRY_READY: ${JSON.stringify(value.assertions[0].actual)}`)
      } else consume(value, labels.filter(label => label.startsWith(`${id}.`)), id)
      lifecycleCount += value.semanticAssertions as number
    }
    if (main.semanticAssertions !== lifecycleCount) invalid('lifecycle assertion total mismatch')
    // Same one outer sync tool slot. The descriptor's actual provider/bindings/
    // source hashes/payloads survive the spread; no C tuple is supplied here.
    const syncExpected = readObject(join(root, 'packet/lifecycle319/sync/expected.json'))
    if (typeof syncExpected.entry !== 'string' || typeof syncExpected.cwd !== 'string') invalid('mapped old sync entry/cwd absent')
    const syncRuntime = { ...readObject(lifecycleRuntimePath), entry: syncExpected.entry, cwd: syncExpected.cwd,
      referenceOnly: false, outputRoot: join(root, 'sync43-local-runs') }
    const syncRuntimePath = join(root, 'sync43-runtime.json')
    writeFileSync(syncRuntimePath, JSON.stringify(syncRuntime, null, 2) + '\n')
    const evidence: {
      forwardEvidence(stdout: string, emit: (line: string) => void): number
      parseSummary(stdout: string): ObjectValue
      validateEvidenceClosure(stdout: string): { summary: ObjectValue; report: ObjectValue; reportSha256: string }
    } = await import(pathToFileURL(join(root, 'packet/sync43/src/evidence.mjs')).href)
    verifyInputs()
    const syncChild = spawnSync(process.execPath,
      ['--import', publicLoader, join(root, 'packet/sync43/src/run.mjs'), syncRuntimePath], {
        cwd: target, env: toolEnv, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 180_000,
      })
    if (syncChild.stderr) process.stderr.write(syncChild.stderr)
    // Before parsing, throwing, validating status, or finally cleanup. Frozen
    // forwarding also emits partial red originals before rejecting their closure.
    try { evidence.forwardEvidence(syncChild.stdout ?? '', line => console.log(line)) }
    catch (error) { invalid(`sync43 evidence closure unavailable: ${String(error)}; toolError=${String(syncChild.error ?? syncChild.signal ?? syncChild.status)}`) }
    verifyInputs()
    const syncSummary = evidence.parseSummary(syncChild.stdout ?? '')
    if (syncChild.error || syncChild.signal || typeof syncSummary.report !== 'string') invalid('sync43 tool/summary unavailable; raw tape retained above')
    // Accept only the frozen decoder's public report, never a different local
    // report.json after successful forwarding. Its path is packet-bound by .1.
    const validated = evidence.validateEvidenceClosure(syncChild.stdout ?? '')
    if (JSON.stringify(syncSummary) !== JSON.stringify(validated.summary)) invalid('sync43 validated summary mismatch')
    const syncReport = validated.report
    if (!['PASS', 'FAIL'].includes(syncReport.status as string) || syncReport.infrastructureError || syncReport.reason
      || syncChild.status !== (syncReport.status === 'PASS' ? 0 : 1)) invalid('sync43 INVALID/qualification failure or report/exit mismatch; tape retained')
    consume(syncReport, syncLabels, 'sync43-normal-pair')
    consume(execute('packet/lifecycle319/preload/run.mjs', lifecycleRuntimePath)!, labels.filter(label => label.startsWith('V4.PRELOAD.')), 'preload4')
    verifyInputs()
    return phase === 'all' ? diagnostics : result()
  } catch (error) {
    if (String(error).includes(SELFCHECK_FIXTURE_MARK)) throw error
    return invalid(`unavailable verifier or portable binding: ${String(error)}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
