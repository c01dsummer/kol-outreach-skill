import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Called by the project test runner with its actual current cwd, including private mutations.
// Adapter/observation failures are invalid; they are not semantic failures.
export async function runRealCleanupRegression(source = process.cwd()) {
  const home = mkdtempSync(join(tmpdir(), 'wcr-'));
  try {
    const sourceRoot = realpathSync(source);
    const specimen = join(home, 'source'), runtimePath = join(home, 'r');
    mkdirSync(runtimePath);
    const runtime = realpathSync(runtimePath);
    mkdirSync(join(runtime, 'foreign'));
    const sentinel = join(runtime, 'foreign', 'sentinel');
    writeFileSync(sentinel, 'independent foreign sentinel\n');
    // Keep current working bytes including uncommitted mutations; skip dependencies,
    // repository metadata and generated output. Do not modify the input tree.
    const excluded = new Set(['.git', 'node_modules', '.check-cache', 'output', 'memory']);
    cpSync(sourceRoot, specimen, { recursive: true, dereference: false, verbatimSymlinks: true,
      filter: path => {
        const rel = relative(sourceRoot, path);
        return !rel || !rel.split(sep).some(part => excluded.has(part) || part.startsWith('.env'));
      },
    });
    const coreSha = createHash('sha256').update(readFileSync(join(sourceRoot, 'scripts/check/mutate.ts'))).digest('hex');
    const dependencies = realpathSync(join(sourceRoot, 'node_modules'));
    symlinkSync(dependencies, join(specimen, 'node_modules'), 'dir');
    const marker = join(runtime, 'baseline-observed.json');
    const target = join(specimen, 'scripts', 'test.ts');
    const original = readFileSync(target, 'utf8');
    const anchor = "await group('h-lazy-typescript-contract', async () => {";
    if (original.split(anchor).length !== 2) throw new Error('unique baseline test group hook not found');
    // The fixture edits only the private copy of the baseline test, never production source.
    const injection = `\n  eq('independent fixture controlled baseline failure', false, true)\n  ;(await import('node:fs')).writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ cwd: process.cwd(), exists: (await import('node:fs')).existsSync(process.cwd()) }))\n`;
    writeFileSync(target, original.replace(anchor, anchor + injection));
    const entry = join(home, 'entry.mjs');
    const moduleUrl = pathToFileURL(join(specimen, 'scripts', 'worker-output-contract-test.ts')).href;
    writeFileSync(entry, `import { runWorkerOutputContract } from ${JSON.stringify(moduleUrl)};\ntry { console.log('REGRESSION_RETURN ' + JSON.stringify(runWorkerOutputContract())); } catch (error) { console.log('REGRESSION_ERROR ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 2; }\n`);
    const child = spawnSync(process.execPath, ['--import', join(specimen, 'node_modules/tsx/dist/loader.mjs'), entry], {
      cwd: specimen, env: { ...process.env, TMPDIR: runtime }, encoding: 'utf8', timeout: 360000, maxBuffer: 8 * 1024 * 1024,
    });
    if (child.error || child.signal) throw new Error('actual entry did not complete: ' + (child.error?.message ?? child.signal));
    const records = child.stdout.split('\n').filter(x => x.startsWith('WORKER_OUTPUT_CONTRACT_JSON '));
    if (records.length !== 1) throw new Error('missing or repeated runner receipt');
    const receipt = JSON.parse(records[0].slice('WORKER_OUTPUT_CONTRACT_JSON '.length));
    if (!existsSync(marker)) throw new Error('controlled assertion did not execute');
    const observed = JSON.parse(readFileSync(marker, 'utf8'));
    if (receipt.context?.coreSha256 !== coreSha || receipt.context?.dotGitAtCwd !== false)
      throw new Error('copied working bytes or Git-free fixture identity differs');
    const identity = receipt.originalResult?.identity;
    if (!observed.exists || identity?.normal !== observed.cwd || dirname(observed.cwd) !== identity.tempRoot || dirname(identity.tempRoot) !== runtime)
      throw new Error('observed snapshot does not match receipt and private runtime');
    if (receipt.originalResult?.baselineQualified !== false) throw new Error('controlled baseline not independently qualified as failed');
    const checks = {
      fixtureInvalid: receipt.outcome === 'fixture-unqualified' && child.status === 2 && /REGRESSION_ERROR .*（夹具）/.test(child.stdout),
      snapshotRemoved: !existsSync(identity.tempRoot),
      foreignPreserved: existsSync(sentinel) && readFileSync(sentinel, 'utf8') === 'independent foreign sentinel\n',
    };
    return { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks };
  } catch (error) {
    return { status: 'invalid', reason: error instanceof Error ? error.message : String(error) };
  } finally {
    // Only the private root created above is removed after measurements.
    rmSync(home, { recursive: true, force: true });
  }
}
