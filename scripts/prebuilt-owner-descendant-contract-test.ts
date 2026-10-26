import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { OWNER_DESCENDANT_CONTRACT_FILES } from './prebuilt-owner-descendant-contract-data.js'
import { SELFCHECK_FIXTURE_MARK } from './check/verifier-rule.js'

const PREFIX = 'OWNER_DESCENDANT_CONTRACT_JSON '
const SOURCE_FILES = ['prebuilt.ts', 'prebuilt-hook.ts', 'prebuilt-parent.ts', 'prebuilt-signals.ts'] as const
const sha = (body: string | Buffer): string => createHash('sha256').update(body).digest('hex')
const identity = (root: string): Record<string, string> => Object.fromEntries(SOURCE_FILES.map(name => [name, sha(readFileSync(join(root, 'scripts/check', name)))]))
function invalid(message: string): never { throw new Error(`${SELFCHECK_FIXTURE_MARK} owner-descendant contract: ${message}`) }

const CONTROLLER = `import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [root, home] = process.argv.slice(2);
const names = ${JSON.stringify(SOURCE_FILES)};
const identity = () => Object.fromEntries(names.map(name => [name, createHash('sha256').update(readFileSync(join(root, 'scripts/check', name))).digest('hex')]));
const sourceBefore = identity();
const { runOwnerDescendantContract } = await import(pathToFileURL(join(home, 'portable.mjs')).href);
const result = await runOwnerDescendantContract({ apiModuleURL: pathToFileURL(join(root, 'scripts/check/prebuilt.ts')).href, publicTsxResolveOwner: root, outputRoot: join(home, 'output') });
const sourceAfter = identity();
process.stdout.write(${JSON.stringify(PREFIX)} + JSON.stringify({ result, sourceBefore, sourceAfter }) + '\\n');
`

type Assertion = { label: string; kind: string; status: 'PASS' | 'FAIL' }
type Row = { id: string; assertions: Assertion[] }
type Receipt = { result: { schema: string; repository: string; publicCli: string; cases: Row[]; summary: unknown; frozenHashes: unknown }; sourceBefore: unknown; sourceAfter: unknown }

/** Runs the unchanged frozen 15-case public contract once, outside the host's preload/counting environment. */
export function runOwnerDescendantContracts(): readonly string[] {
  const root = realpathSync(process.cwd()), home = realpathSync(mkdtempSync(join(tmpdir(), 'owner-descendant-contract-')))
  try {
    const expectedHashes = Object.fromEntries(OWNER_DESCENDANT_CONTRACT_FILES.map(file => [file.name, file.sha256]))
    for (const file of OWNER_DESCENDANT_CONTRACT_FILES) {
      if (sha(file.body) !== file.sha256) invalid(`frozen member hash mismatch: ${file.name}`)
      writeFileSync(join(home, file.name), file.body, 'utf8')
    }
    const manifest = JSON.parse(OWNER_DESCENDANT_CONTRACT_FILES.find(file => file.name === 'manifest.json')!.body) as { schema: string; cases: { id: string; route: string }[] }
    if (manifest.cases.length !== 15) invalid('frozen case cardinality changed')
    const labelsFor = (spec: { id: string; route: string }): string[] => ['public-reference-qualified', `route-${spec.route}`, 'candidate-hand-derived-semantics', 'raw-streams-and-exit-equal'].map(suffix => `${spec.id}:${suffix}`)
    const labels = manifest.cases.flatMap(labelsFor), requireFromRoot = createRequire(join(root, 'package.json'))
    if (labels.length !== 60 || new Set(labels).size !== 60) invalid('frozen assertion identities changed')
    writeFileSync(join(home, 'controller.mjs'), CONTROLLER, 'utf8')
    const env = { ...process.env }
    for (const key of Object.keys(env)) if (key === 'NODE_OPTIONS' || key.startsWith('TSX_') || key.startsWith('KOL_')) delete env[key]
    const sourceBefore = identity(root)
    const child = spawnSync(process.execPath, ['--import', pathToFileURL(requireFromRoot.resolve('tsx')).href, join(home, 'controller.mjs'), root, home], { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
    process.stdout.write(child.stdout ?? ''); process.stderr.write(child.stderr ?? '')
    if (child.error || child.status !== 0 || child.signal !== null) invalid(`controller did not complete: ${child.error?.message ?? `${child.status}/${child.signal}`}`)
    const lines = child.stdout.split('\n')
    if (lines.pop() !== '') invalid('controller stdout has no final newline')
    const receipts = lines.filter(line => line.startsWith(PREFIX))
    if (receipts.length !== 1 || lines.at(-1) !== receipts[0]) invalid('expected exactly one last-line receipt')
    let receipt: Receipt
    try { receipt = JSON.parse(receipts[0]!.slice(PREFIX.length)) as Receipt } catch { invalid('receipt JSON is malformed') }
    if (!receipt || !isDeepStrictEqual(receipt.sourceBefore, sourceBefore) || !isDeepStrictEqual(receipt.sourceAfter, identity(root)) || !isDeepStrictEqual(receipt.sourceBefore, receipt.sourceAfter)) invalid('production source identity changed')
    const result = receipt.result
    if (!result || result.schema !== manifest.schema || result.repository !== root || result.publicCli !== requireFromRoot.resolve('tsx/cli') || !isDeepStrictEqual(result.frozenHashes, expectedHashes)) invalid('public binding or frozen source receipt mismatch')
    if (!Array.isArray(result.cases) || result.cases.length !== 15) invalid('missing normal contract cases')
    for (const [index, row] of result.cases.entries()) {
      if (!row || row.id !== manifest.cases[index]!.id || !Array.isArray(row.assertions)) invalid('case identity or assertion shape mismatch')
      for (const a of row.assertions) if (!a || typeof a.label !== 'string' || !['PASS', 'FAIL'].includes(a.status) || !['qualification', 'assertion', 'fixture-error'].includes(a.kind)) invalid('invalid assertion record')
    }
    const all = result.cases.flatMap(row => row.assertions)
    if (all.some(a => a.kind === 'fixture-error' || (a.kind === 'qualification' && a.status === 'FAIL'))) invalid('public reference qualification or fixture setup failed')
    for (const [index, row] of result.cases.entries()) if (!isDeepStrictEqual(row.assertions.map(a => a.label), labelsFor(manifest.cases[index]!)) || row.assertions.some((a, n) => a.kind !== (n === 0 ? 'qualification' : 'assertion'))) invalid('normal 60-label identity/order mismatch')
    if (all.length !== 60 || new Set(all.map(a => a.label)).size !== 60) invalid('normal labels are incomplete or repeated')
    const failures = all.filter(a => a.status === 'FAIL').map(a => a.label)
    const summary = { cases: result.cases.length, assertions: all.length, pass: all.filter(a => a.status === 'PASS').length, fail: failures.length, fixtureErrors: all.filter(a => a.kind === 'fixture-error').length, qualificationFailures: all.filter(a => a.kind === 'qualification' && a.status === 'FAIL').length, failures }
    if (!isDeepStrictEqual(result.summary, summary)) invalid('reported summary disagrees with actual assertions')
    return failures
  } catch (error) {
    if (error instanceof Error && error.message.includes(SELFCHECK_FIXTURE_MARK)) throw error
    invalid(error instanceof Error ? error.message : String(error))
  } finally { rmSync(home, { recursive: true, force: true }) }
}
