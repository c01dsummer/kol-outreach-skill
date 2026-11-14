import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, rmSync, existsSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { reclaimOwned, recordedGroups } from './worker-output-contract-test.js';

// Copies the current working bytes into a private specimen under `home`, with a private TMPDIR (`runtime`) holding two
// foreign directories — one of them named like a driver root — and the baseline test hook replaced by `injection(runtime)`.
function prepare(home: string, sourceRoot: string, injection: (runtime: string) => string) {
  const specimen = join(home, 'source'), runtimePath = join(home, 'r');
  mkdirSync(runtimePath);
  const runtime = realpathSync(runtimePath);
  const sentinels = [join(runtime, 'foreign', 'sentinel'), join(runtime, 'kc-worker-output-independent-foreign', 'sentinel')];
  for (const sentinel of sentinels) { mkdirSync(dirname(sentinel)); writeFileSync(sentinel, 'independent foreign sentinel\n'); }
  // Keep current working bytes including uncommitted mutations; skip dependencies,
  // repository metadata and generated output. Do not modify the input tree.
  const excluded = new Set(['.git', 'node_modules', '.check-cache', 'output', 'memory', 'evidence', 'dist', 'build', 'coverage']);
  cpSync(sourceRoot, specimen, { recursive: true, dereference: false, verbatimSymlinks: true,
    filter: path => {
      const rel = relative(sourceRoot, path);
      return !rel || !rel.split(sep).some(part => excluded.has(part) || part.startsWith('.env'));
    },
  });
  const coreSha = createHash('sha256').update(readFileSync(join(sourceRoot, 'scripts/check/mutate.ts'))).digest('hex');
  // The mutation may be in the carrier itself; never substitute committed bytes.
  const carrierPath = join('scripts', 'worker-output-contract-test.ts');
  const carrierSha = createHash('sha256').update(readFileSync(join(sourceRoot, carrierPath))).digest('hex');
  if (createHash('sha256').update(readFileSync(join(specimen, carrierPath))).digest('hex') !== carrierSha)
    throw new Error('copied carrier bytes differ from current working input');
  const dependencies = realpathSync(join(sourceRoot, 'node_modules'));
  symlinkSync(dependencies, join(specimen, 'node_modules'), 'dir');
  const target = join(specimen, 'scripts', 'test.ts');
  const original = readFileSync(target, 'utf8');
  const anchor = "await group('h-lazy-typescript-contract', async () => {";
  if (original.split(anchor).length !== 2) throw new Error('unique baseline test group hook not found');
  // The fixture edits only the private copy of the baseline test, never production source.
  writeFileSync(target, original.replace(anchor, anchor + injection(runtime)));
  const entry = join(home, 'entry.mjs');
  const moduleUrl = pathToFileURL(join(specimen, 'scripts', 'worker-output-contract-test.ts')).href;
  writeFileSync(entry, `import { runWorkerOutputContract } from ${JSON.stringify(moduleUrl)};\ntry { console.log('REGRESSION_RETURN ' + JSON.stringify(runWorkerOutputContract())); } catch (error) { console.log('REGRESSION_ERROR ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 2; }\n`);
  const args = ['--import', join(specimen, 'node_modules/tsx/dist/loader.mjs'), entry];
  const options = { cwd: specimen, env: { ...process.env, TMPDIR: runtime, TEMP: runtime, TMP: runtime } };
  const foreignPreserved = () => sentinels.every(sentinel => existsSync(sentinel) && readFileSync(sentinel, 'utf8') === 'independent foreign sentinel\n');
  return { specimen, runtime, coreSha, args, options, foreignPreserved };
}

// Called by the project test runner with its actual current cwd, including private mutations.
// Adapter/observation failures are invalid; they are not semantic failures.
export async function runRealCleanupRegression(source = process.cwd()) {
  const home = mkdtempSync(join(tmpdir(), 'wcr-'));
  try {
    const marker = (runtime: string) => join(runtime, 'baseline-observed.json');
    const { runtime, coreSha, args, options, foreignPreserved } = prepare(home, realpathSync(source), runtime => `
  const independentFixtureFs = await import('node:fs')
  const independentFixtureLog = console.log
  const independentFixtureLines: string[] = []
  let independentFixtureUnexpectedError = false
  process.on('uncaughtExceptionMonitor', () => { independentFixtureUnexpectedError = true })
  console.log = (...args: unknown[]) => { independentFixtureLines.push(args.map(String).join(' ')); independentFixtureLog(...args) }
  process.on('exit', () => independentFixtureFs.writeFileSync(${JSON.stringify(marker(runtime))}, JSON.stringify({ cwd: process.cwd(), exists: independentFixtureFs.existsSync(process.cwd()), evidencePresent: independentFixtureFs.existsSync('evidence'), envPresent: independentFixtureFs.existsSync('.env'), unexpectedError: independentFixtureUnexpectedError, exitCode: process.exitCode, lines: independentFixtureLines })))
  eq('independent fixture controlled baseline failure', false, true)
`);
    const child = spawnSync(process.execPath, args, { ...options, encoding: 'utf8', timeout: 360000, maxBuffer: 8 * 1024 * 1024 });
    if (child.error || child.signal) throw new Error('actual entry did not complete: ' + (child.error?.message ?? child.signal));
    const records = child.stdout.split('\n').filter(x => x.startsWith('WORKER_OUTPUT_CONTRACT_JSON '));
    if (records.length !== 1) throw new Error('missing or repeated runner receipt');
    const receipt = JSON.parse(records[0].slice('WORKER_OUTPUT_CONTRACT_JSON '.length));
    if (!existsSync(marker(runtime))) throw new Error('controlled assertion did not execute');
    const observed = JSON.parse(readFileSync(marker(runtime), 'utf8'));
    if (receipt.context?.coreSha256 !== coreSha || receipt.context?.dotGitAtCwd !== false)
      throw new Error('copied working bytes or Git-free fixture identity differs');
    const identity = receipt.originalResult?.identity;
    if (!observed.exists || identity?.normal !== observed.cwd || dirname(observed.cwd) !== identity.tempRoot || dirname(identity.tempRoot) !== runtime)
      throw new Error('observed snapshot does not match receipt and private runtime');
    if (observed.evidencePresent !== false || observed.envPresent !== false) throw new Error('excluded sensitive input reached the baseline snapshot');
    if (!Array.isArray(observed.lines) || !observed.lines.every((line: unknown) => typeof line === 'string') || observed.exitCode !== 1 || observed.unexpectedError !== false) throw new Error('baseline did not end normally with failure code');
    const failures = observed.lines.filter((line: string) => /^  ✗ /m.test(line));
    const targeted = '  ✗ independent fixture controlled baseline failure\n     got=false\n     want=true';
    if (failures.length !== 1 || failures[0] !== targeted || !observed.lines.includes('\n1 个失败\n') ||
        !observed.lines.some((line: string) => /^✓ 已完成子集 h-lazy-typescript-contract；没有认领全量审计$/.test(line)))
      throw new Error('controlled assertion failure or normal failure summary not observed exactly');
    if (receipt.originalResult?.baselineQualified !== false) throw new Error('controlled baseline not independently qualified as failed');
    const checks = {
      fixtureInvalid: receipt.outcome === 'fixture-unqualified' && child.status === 2 && /REGRESSION_ERROR .*（夹具）/.test(child.stdout),
      snapshotRemoved: !existsSync(identity.tempRoot),
      foreignPreserved: foreignPreserved(),
    };
    return { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks, baselineEvidence: observed };
  } catch (error) {
    return { status: 'invalid', reason: error instanceof Error ? error.message : String(error) };
  } finally {
    // Only the private root created above is removed after measurements.
    rmSync(home, { recursive: true, force: true });
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Interrupts the real controller before any receipt exists, while a baseline process in the driver's group ignores
 * SIGTERM and keeps re-creating a file in the driver root every 10 ms. The carrier must fail the fixture, and remove
 * the driver root and its own home only once that group has stopped, so neither comes back; foreign directories stay.
 */
export async function runInterruptedCleanupRegression(source = process.cwd()) {
  const home = mkdtempSync(join(tmpdir(), 'wci-'));
  let child: ReturnType<typeof spawn> | undefined;
  // The run's process groups, as the carrier's ledger names them; teardown waits for these before removing `home`.
  let ledgerPath: string | undefined;
  try {
    const ready = (runtime: string) => join(runtime, 'writer-ready.json');
    const { runtime, args, options, foreignPreserved } = prepare(home, realpathSync(source), runtime => `
  const independentFixtureFs = await import('node:fs')
  process.on('SIGTERM', () => {})
  const independentFixtureAt = process.cwd()
  const independentFixtureBeat = () => { try { independentFixtureFs.mkdirSync(independentFixtureAt, { recursive: true }); independentFixtureFs.writeFileSync(independentFixtureAt + '/interrupt-heartbeat', String(Date.now())) } catch { /* keep trying */ } }
  independentFixtureBeat()
  setInterval(independentFixtureBeat, 10)
  independentFixtureFs.writeFileSync(${JSON.stringify(ready(runtime) + '.tmp')}, JSON.stringify({ cwd: independentFixtureAt }))
  independentFixtureFs.renameSync(${JSON.stringify(ready(runtime) + '.tmp')}, ${JSON.stringify(ready(runtime))})
  await new Promise(() => {})
`);
    const out: Buffer[] = [];
    const started = spawn(process.execPath, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    child = started;
    started.stdout!.on('data', (b: Buffer) => out.push(b));
    started.stderr!.resume();
    const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => started.on('close', (code, signal) => resolve({ code, signal })));
    for (const until = Date.now() + 240000; !existsSync(ready(runtime)); await sleep(50)) {
      if (Date.now() > until || started.exitCode !== null) throw new Error('the baseline writer never started');
    }
    const carrierHomes = readdirSync(runtime).filter(name => name.startsWith('worker-output-carrier-'));
    if (carrierHomes.length !== 1) throw new Error('expected exactly one carrier home');
    const carrierHome = join(runtime, carrierHomes[0]!);
    const driverRoot = dirname(JSON.parse(readFileSync(ready(runtime), 'utf8')).cwd);
    ledgerPath = join(carrierHome, 'process-groups.ndjson');
    const ledger = readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    const controller = ledger.find(entry => entry.role === 'controller')?.pid;
    if (!Number.isSafeInteger(controller) || dirname(driverRoot) !== runtime || !existsSync(join(driverRoot, 'normal', 'interrupt-heartbeat'))) throw new Error('writer, ledger or driver root not as expected');
    process.kill(controller, 'SIGTERM');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ended = await Promise.race([closed, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 60000); })]);
    clearTimeout(timer);
    if (ended === null) throw new Error('carrier did not finish after the interruption');
    await sleep(500);
    const stdout = Buffer.concat(out).toString('utf8');
    const checks = {
      interruptedInvalid: ended.code === 2 && /REGRESSION_ERROR .*（夹具）/.test(stdout) && !stdout.includes('REGRESSION_RETURN'),
      driverRootGone: !existsSync(driverRoot),
      carrierHomeGone: !existsSync(carrierHome),
      foreignPreserved: foreignPreserved(),
    };
    return { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks };
  } catch (error) {
    return { status: 'invalid', reason: error instanceof Error ? error.message : String(error) };
  } finally {
    // On an early exit the writer can outlive the entry (its guardians stop it), and it re-creates its directory every
    // 10 ms. Stop what this run started, then remove `home` only once those groups and every process working inside
    // it have stopped, so nothing is written back after the removal and nothing is left running.
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    const groups = ledgerPath === undefined ? [] : recordedGroups(ledgerPath, undefined) ?? [];
    for (const pgid of groups) { try { process.kill(-pgid, 'SIGKILL'); } catch { /* already gone */ } }
    const kept = reclaimOwned([home], groups, 10000);
    if (kept !== undefined) console.error(`interrupted-cleanup teardown: ${kept}`);
  }
}
