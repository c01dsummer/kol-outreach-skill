import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Independent process fixtures: no production implementation or repository files are copied.
const FIXTURES: ReadonlyArray<readonly [string, string]> = [
  ["fixture-worker.cjs", `'use strict';
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const mode = process.argv[2];
// Safety bound applies only to synthetic processes created by this test.
if (mode !== 'quick') setTimeout(() => process.exit(124), 12000);
if (Object.hasOwn(process.env, 'KOL_GUARDIAN_PARENT_PID') || Object.hasOwn(process.env, 'KOL_GUARD_FORWARD_FD3')) { process.stderr.write('guard parent identity leaked into worker environment\\n'); process.exit(91); }
if (mode === 'race') {
  fs.writeFileSync(process.argv[3], JSON.stringify({ pid: process.pid }));
  setInterval(() => {}, 1000);
} else if (mode === 'quick') {
  process.stdout.write('stdout\\n');
  process.stderr.write('stderr\\n');
  fs.writeSync(3, 'fd3\\n');
  process.exitCode = 23;
} else if (['self-term', 'self-kill', 'self-zero', 'self-nonzero'].includes(mode)) {
  fs.writeSync(3, JSON.stringify({ role: 'worker', pid: process.pid }) + '\\n');
  // The direct child signals only itself after its own child reports readiness.
  // No PID discovered from a pipe is ever sent a signal by this fixture.
  const descendant = spawn(process.execPath, [__filename, 'grandchild', 'ignore-term'], {
    stdio: ['ignore', 'ignore', 'ignore', 'pipe']
  });
  let pending = '';
  descendant.stdio[3].setEncoding('utf8');
  descendant.stdio[3].on('data', part => {
    pending += part;
    const at = pending.indexOf('\\n');
    if (at < 0) return;
    const line = pending.slice(0, at);
    fs.writeSync(3, line + '\\n');
    if (mode === 'self-zero' || mode === 'self-nonzero') {
      const code = mode === 'self-zero' ? 0 : 3;
      fs.writeSync(3, JSON.stringify({ role: 'self-exit', code }) + '\\n');
      process.exit(code);
    }
    const signal = mode === 'self-term' ? 'SIGTERM' : 'SIGKILL';
    fs.writeSync(3, JSON.stringify({ role: 'self-signal', signal }) + '\\n');
    process.kill(process.pid, signal);
  });
  setInterval(() => {}, 1000);
} else if (mode === 'hold' || mode === 'ignore-term') {
  if (mode === 'ignore-term') process.on('SIGTERM', () => {});
  fs.writeSync(3, JSON.stringify({ role: 'worker', pid: process.pid }) + '\\n');
  if (process.argv[3] === 'with-child') {
    const child = spawn(process.execPath, [__filename, 'grandchild', mode], {
      stdio: ['ignore', 'ignore', 'ignore', 3]
    });
    child.on('error', e => { fs.writeSync(3, JSON.stringify({ role: 'spawn-error', message: e.message }) + '\\n'); process.exitCode = 1; });
  }
  setInterval(() => {}, 1000);
} else if (mode === 'grandchild') {
  if (process.argv[3] === 'ignore-term') process.on('SIGTERM', () => {});
  fs.writeSync(3, JSON.stringify({ role: 'grandchild', pid: process.pid }) + '\\n');
  setInterval(() => {}, 1000);
} else throw Error('unknown worker mode: ' + mode);
`],
  ["fixture-owner.cjs", `'use strict';
const { spawn } = require('node:child_process');
const [guardian, groupMode, workerMode, tree, raceDir] = process.argv.slice(2);
const path = require('node:path');
const runnerPid = Number(process.env.KOL_TEST_OWNER_PARENT_PID);
if (!Number.isSafeInteger(runnerPid) || runnerPid <= 1 || process.ppid !== runnerPid) process.exit(2);
const ownerEnv = { ...process.env }; delete ownerEnv.KOL_TEST_OWNER_PARENT_PID;
const args = [guardian, groupMode, process.execPath, path.join(__dirname, 'fixture-worker.cjs'), workerMode, ...(tree === 'tree' ? ['with-child'] : []), ...(raceDir ? [path.join(raceDir, 'worker.json')] : [])];
const child = spawn(process.execPath, raceDir ? [path.join(__dirname, 'delayed-entry.cjs'), ...args] : args, {
  detached: groupMode === 'group', stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
  env: { ...ownerEnv, KOL_GUARDIAN_PARENT_PID: String(process.pid), KOL_GUARD_FORWARD_FD3: '1', ...(raceDir ? { KOL_GUARDIAN_RACE_REPORT: path.join(raceDir, 'shim.log') } : {}) }
});
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n');
let out = '', err = '', control = '', pending = '';
child.stdout.on('data', data => { out += data.toString(); });
child.stderr.on('data', data => { err += data.toString(); });
child.stdio[3].on('data', data => {
  control += data.toString();
  pending += data.toString();
  for (;;) {
    const at = pending.indexOf('\\n');
    if (at < 0) break;
    const line = pending.slice(0, at); pending = pending.slice(at + 1);
    try { emit({ type: 'child-control', value: JSON.parse(line) }); } catch { /* raw fd3 content is checked at completion */ }
  }
});
child.on('spawn', () => emit({ type: 'guardian', pid: child.pid }));
child.on('error', error => emit({ type: 'error', error: error.message }));
const watchRunner = setInterval(() => { if (process.ppid !== runnerPid) { child.kill('SIGTERM'); clearInterval(watchRunner); setTimeout(() => process.exit(2), 1000); } }, 50);
child.on('close', (code, signal) => { clearInterval(watchRunner); emit({ type: 'complete', code, signal, stdout: out, stderr: err, fd3: control }); });
`],
  ["delayed-entry.cjs", `'use strict';
// This shim stays in the same process and starts the real guardian only after
// the launcher's verified parent has exited; it exercises the startup race.
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const [guardian, ...args] = process.argv.slice(2);
const parent = Number(process.env.KOL_GUARDIAN_PARENT_PID);
const report = process.env.KOL_GUARDIAN_RACE_REPORT;
delete process.env.KOL_GUARDIAN_RACE_REPORT;
const record = value => fs.appendFileSync(report, JSON.stringify(value) + '\\n');
process.on('exit', code => record({ type: 'exit', code }));
const timer = setInterval(async () => {
  if (process.ppid === parent) return;
  clearInterval(timer);
  process.argv = [process.execPath, guardian, ...args];
  record({ type: 'import', actualParent: process.ppid, expectedParent: parent });
  try { await import(pathToFileURL(guardian).href); }
  catch (error) { record({ type: 'error', message: error.message }); process.exitCode = 123; }
}, 10);
`],
  ["test-guardian.cjs", `'use strict';
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
// The runner itself is detached from its caller. Never outlive that caller.
const runnerParent = Number(process.env.KOL_TEST_RUNNER_PARENT_PID);
const ownershipToken = process.env.KOL_TEST_RUNNER_TOKEN;
delete process.env.KOL_TEST_RUNNER_PARENT_PID;
delete process.env.KOL_TEST_RUNNER_TOKEN;
function leaveAfterParentDies() {
  try {
    const dir = fs.realpathSync(__dirname);
    if (path.dirname(dir) === fs.realpathSync(os.tmpdir()) && path.basename(dir).startsWith('guardian-regression-') &&
      typeof ownershipToken === 'string' && fs.readFileSync(path.join(dir, '.owner-token'), 'utf8') === ownershipToken) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch { /* failure is not reported as successful cleanup */ }
  process.exit(125);
}
if (!Number.isSafeInteger(runnerParent) || runnerParent <= 1 || process.ppid !== runnerParent) leaveAfterParentDies();
setInterval(() => { if (process.ppid !== runnerParent) leaveAfterParentDies(); }, 50).unref();
const guardian = process.argv[2];
if (!guardian || !path.isAbsolute(guardian)) throw Error('usage: node test-guardian.cjs /absolute/path/to/guardian.cjs [--negative]');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// A ps call that ran out of time observed nothing: one look reports that as unobserved,
// never as stopped, and the caller may look again before its own deadline. A deadline
// reached while the last look still observed nothing fails with that original error text,
// so the receipt is fixture-invalid. After one such loss later timeouts fail at once, as before.
let inspectionLost = false;
function look(test) {
  try { return { result: test() }; }
  catch (error) { if (inspectionLost || error.inspectionTimedOut !== true) throw error; return { unobserved: error }; }
}
function unobservedAt(error, label) {
  inspectionLost = true;
  return Error(error.message + ' (nothing observed before deadline: ' + label + ')');
}
async function until(test, label, ms = 5000) {
  const deadline = Date.now() + ms;
  let seen;
  while (Date.now() < deadline) { seen = look(test); if (seen.result) return seen.result; await sleep(20); }
  if (seen && seen.unobserved) throw unobservedAt(seen.unobserved, label);
  throw Error('timeout: ' + label);
}
// Only a liveness assertion may look again later: alive then implies alive before.
// An assertion that a process has already stopped stays one look; it could stop meanwhile.
async function assertAlive(test, message) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const seen = look(test);
    if (!seen.unobserved) return assert.ok(seen.result, message);
    if (Date.now() >= deadline) throw unobservedAt(seen.unobserved, message);
    await sleep(20);
  }
}
const zombiesSeen = new Set();
function exists(pid) {
  const result = spawnSync('/bin/ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8', timeout: 2000 });
  if (result.error) {
    const error = Error('cannot inspect owned process state: ' + result.error.message);
    // Only a timed-out ps may be looked at again; any other failure stays final.
    error.inspectionTimedOut = result.error.code === 'ETIMEDOUT';
    throw error;
  }
  const stat = result.stdout.trim();
  if (result.status !== 0 && result.status !== 1) throw Error('cannot inspect owned process state: ps exit ' + result.status);
  if (!stat) return false;
  if (/^Z/.test(stat)) { zombiesSeen.add(pid); return false; }
  return true;
}
async function waitOwnedStopped(pids) {
  // Never signal a numeric PID learned from a grandchild. Synthetic workers
  // have a hard deadline; a noncooperative guard may outlive that deadline.
  await until(() => pids.filter(Boolean).every(pid => !exists(pid)), 'owned fixtures stop without PID signals', 16000);
}
function launch(mode, worker, tree, raceDir) {
  const owner = spawn(process.execPath, [path.join(__dirname, 'fixture-owner.cjs'), guardian, mode, worker, tree ? 'tree' : 'none', ...(raceDir ? [raceDir] : [])], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, KOL_TEST_OWNER_PARENT_PID: String(process.pid) } });
  const events = []; let lineBuffer = '', stderr = '';
  owner.stdout.setEncoding('utf8'); owner.stdout.on('data', text => {
    lineBuffer += text; let at;
    while ((at = lineBuffer.indexOf('\\n')) >= 0) {
      const line = lineBuffer.slice(0, at); lineBuffer = lineBuffer.slice(at + 1);
      try { events.push(JSON.parse(line)); } catch { events.push({ type:'malformed', line }); }
    }
  });
  owner.stderr.on('data', b => { stderr += b.toString(); });
  return { owner, events, stderr: () => stderr };
}
function remember(pid) {
  if (!Number.isInteger(pid) || pid <= 1) throw Error('invalid owned pid');
  return pid;
}
function killChildHandle(child, signal = 'SIGKILL') {
  if (child.exitCode === null && child.signalCode === null) child.kill(signal);
}
async function quick(mode) {
  const run = launch(mode, 'quick', false); remember(run.owner.pid);
  let guard;
  try {
    guard = remember((await until(() => run.events.find(x => x.type === 'guardian'), mode + ' guardian')).pid);
    const done = await until(() => run.events.find(x => x.type === 'complete'), mode + ' normal completion');
    assert.equal(done.code, 23); assert.equal(done.signal, null);
    assert.equal(done.stdout, 'stdout\\n'); assert.equal(done.stderr, 'stderr\\n'); assert.equal(done.fd3, 'fd3\\n');
    await until(() => !exists(guard), mode + ' guardian exited');
    console.log('PASS normal ' + mode + ': exit code, stdout, stderr and fd3 are unchanged');
  } finally {
    killChildHandle(run.owner);
    await waitOwnedStopped([guard]);
  }
}
async function interrupted(mode, signal, ignore, isolation) {
  const run = launch(mode, ignore ? 'ignore-term' : 'hold', mode === 'group'); remember(run.owner.pid);
  const sentinel = isolation ? spawn(process.execPath, ['-e', "const p=Number(process.env.KOL_TEST_SENTINEL_PARENT_PID);if(process.ppid!==p)process.exit(2);setInterval(()=>{if(process.ppid!==p)process.exit(2)},50)"], { stdio:'ignore', env: { ...process.env, KOL_TEST_SENTINEL_PARENT_PID: String(process.pid) } }) : null;
  if (sentinel) remember(sentinel.pid);
  let guard, worker, grandchild;
  try {
    guard = remember((await until(() => run.events.find(x => x.type === 'guardian'), 'guardian spawned')).pid);
    worker = remember((await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'worker'), 'worker handshake')).value.pid);
    if (mode === 'group') grandchild = remember((await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'grandchild'), 'grandchild handshake')).value.pid);
    await assertAlive(() => exists(guard) && exists(worker) && (!grandchild || exists(grandchild)), 'test processes are alive before owner dies');
    if (sentinel) await assertAlive(() => exists(sentinel.pid), 'unrelated test-owned process group is alive before owner dies');
    killChildHandle(run.owner, signal);
    await until(() => run.owner.exitCode !== null || run.owner.signalCode !== null, 'owner terminated');
    await until(() => !exists(worker) && (!grandchild || !exists(grandchild)), mode + ' descendants stop after parent ' + signal, 7000);
    await until(() => !exists(guard), mode + ' guardian exits after parent ' + signal, 3000);
    if (sentinel) await assertAlive(() => exists(sentinel.pid), 'unrelated test-owned process group must remain alive');
    console.log('PASS interrupt ' + mode + ' ' + signal + (ignore ? ' (worker refuses SIGTERM)' : '') + (sentinel ? ' with group isolation' : ''));
  } finally {
    killChildHandle(run.owner);
    if (sentinel) killChildHandle(sentinel);
    await waitOwnedStopped([grandchild, worker, guard]);
  }
}
async function childDiesFirst(signal) {
  const run = launch('group', signal === 'SIGTERM' ? 'self-term' : 'self-kill', false);
  let guard, worker, grandchild;
  try {
    guard = remember((await until(() => run.events.find(x => x.type === 'guardian'), 'guardian spawned')).pid);
    worker = remember((await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'worker'), 'worker handshake')).value.pid);
    grandchild = remember((await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'grandchild'), 'grandchild handshake')).value.pid);
    const requested = await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'self-signal'), 'child self-signal handshake');
    assert.equal(requested.value.signal, signal);
    // The owner forwards the self-signal event before its own natural exit.
    // The harness never sends a signal to the owner until after the observation.
    await until(() => !exists(worker), 'direct child has stopped');
    await until(() => !exists(grandchild), 'guardian stops descendant after direct child dies', 7000);
    const done = await until(() => run.events.find(x => x.type === 'complete'), 'guardian completes after direct child dies');
    assert.ok(done.signal || done.code !== 0, 'signalled child must not look successful');
    console.log('PASS direct child ' + signal + ' with live descendant');
  } finally {
    killChildHandle(run.owner);
    await waitOwnedStopped([grandchild, worker, guard]);
  }
}
async function childReturnsFirst(code) {
  const run = launch('group', code === 0 ? 'self-zero' : 'self-nonzero', false);
  let guard, worker, grandchild;
  try {
    guard = remember((await until(() => run.events.find(x => x.type === 'guardian'), 'guardian spawned')).pid);
    worker = remember((await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'worker'), 'worker handshake')).value.pid);
    grandchild = remember((await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'grandchild'), 'grandchild handshake')).value.pid);
    const requested = await until(() => run.events.find(x => x.type === 'child-control' && x.value.role === 'self-exit'), 'child natural-exit handshake');
    assert.equal(requested.value.code, code);
    // Owner forwarded the event and no harness signal is sent to it here.
    await until(() => !exists(worker), 'direct child has stopped');
    await until(() => !exists(grandchild), 'guardian stops descendant after direct child returns', 7000);
    const done = await until(() => run.events.find(x => x.type === 'complete'), 'guardian completes after direct child returns');
    assert.ok(done.signal || done.code !== 0, 'live descendant must not look successful');
    console.log('PASS direct child exit ' + code + ' with live descendant');
  } finally {
    killChildHandle(run.owner);
    await waitOwnedStopped([grandchild, worker, guard]);
  }
}
async function startupRace(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-startup-race-'));
  const run = launch(mode, 'race', false, dir); remember(run.owner.pid);
  let guard, worker;
  try {
    guard = remember((await until(() => run.events.find(x => x.type === 'guardian'), 'race shim spawned')).pid);
    await assertAlive(() => exists(guard), 'delayed guardian process exists before owner death');
    killChildHandle(run.owner, 'SIGKILL');
    await until(() => run.owner.exitCode !== null || run.owner.signalCode !== null, 'race owner death');
    const report = path.join(dir, 'shim.log');
    await until(() => fs.existsSync(report) && fs.readFileSync(report, 'utf8').includes('\\"type\\":\\"import\\"'), 'guardian starts only after owner death');
    await until(() => !exists(guard), 'guardian exits after stale expected parent', 7000);
    await sleep(100);
    const rows = fs.readFileSync(report, 'utf8').trim().split('\\n').map(JSON.parse);
    assert.ok(rows.some(x => x.type === 'import' && x.actualParent !== x.expectedParent));
    assert.ok(!rows.some(x => x.type === 'error'), 'guardian import must not crash');
    const exit = rows.find(x => x.type === 'exit');
    assert.ok(exit && exit.code !== 123 && exit.code !== 0, 'stale parent rejected with nonzero exit, rather than appearing successful');
    const marker = path.join(dir, 'worker.json');
    if (fs.existsSync(marker)) {
      worker = remember(JSON.parse(fs.readFileSync(marker, 'utf8')).pid);
      assert.ok(!exists(worker), 'a worker started after parent death must not survive'); // one look only, see assertAlive
    }
    console.log('PASS startup race ' + mode + ': stale expected parent rejected, no surviving worker');
  } finally {
    killChildHandle(run.owner);
    const marker = path.join(dir, 'worker.json');
    if (!worker && fs.existsSync(marker)) {
      try { worker = remember(JSON.parse(fs.readFileSync(marker, 'utf8')).pid); } catch { /* no reliable worker identity */ }
    }
    try { await waitOwnedStopped([worker, guard]); }
    finally { fs.rmSync(dir, {recursive:true,force:true}); }
  }
}

(async () => {
  const tests = [
    ['startup-group', () => startupRace('group')],
    ['startup-child', () => startupRace('child')],
    ['normal-group', () => quick('group')],
    ['normal-child', () => quick('child')],
    ['parent-term-group-isolation', () => interrupted('group', 'SIGTERM', false, true)],
    ['parent-kill-group-ignore-term', () => interrupted('group', 'SIGKILL', true, true)],
    ['parent-term-child', () => interrupted('child', 'SIGTERM', false, false)],
    ['parent-kill-child-ignore-term', () => interrupted('child', 'SIGKILL', true, false)],
    ['direct-child-term-group', () => childDiesFirst('SIGTERM')],
    ['direct-child-kill-group', () => childDiesFirst('SIGKILL')],
    ['direct-child-zero-group', () => childReturnsFirst(0)],
    ['direct-child-nonzero-group', () => childReturnsFirst(3)],
  ];
  const checks = {};
  let fixtureInvalid = false;
  for (const [name, run] of tests) {
    try { await run(); checks[name] = true; }
    catch (error) {
      checks[name] = false;
      if (/owned fixtures stop without PID signals|cannot inspect owned process state/.test(error.message || '')) fixtureInvalid = true;
      console.error('FAIL ' + name + ': ' + (error.stack || error));
    }
  }
  console.log('GUARDIAN_REGRESSION_JSON ' + JSON.stringify({ checks, fixtureInvalid, zombieObserved: zombiesSeen.size > 0 }));
  if (Object.values(checks).some(value => !value)) process.exitCode = 1;
})().catch(error => { console.error('INVALID', error.stack || error); process.exitCode = 2; });
`],
]

const names = [
  'startup-group', 'startup-child', 'normal-group', 'normal-child',
  'parent-term-group-isolation', 'parent-kill-group-ignore-term',
  'parent-term-child', 'parent-kill-child-ignore-term',
  'direct-child-term-group', 'direct-child-kill-group',
  'direct-child-zero-group', 'direct-child-nonzero-group',
] as const

/** Exercise the candidate guard in real, privately owned subprocesses. */
export async function runWorkerOutputGuardianRegression(guardianSource: string) {
  const home = mkdtempSync(join(tmpdir(), 'guardian-regression-'))
  try {
    for (const [name, source] of FIXTURES) writeFileSync(join(home, name), source)
    const guard = join(home, 'guardian.cjs')
    writeFileSync(guard, guardianSource)
    const token = randomUUID()
    writeFileSync(join(home, '.owner-token'), token)
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; timedOut: boolean }>((resolve, reject) => {
      // Fixture owners and sentinels observe the runner parent, so a runner timeout
      // does not require signalling an unowned or potentially reused numeric PID.
      const child = spawn(process.execPath, [join(home, 'test-guardian.cjs'), guard], {
        cwd: home, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, KOL_TEST_RUNNER_PARENT_PID: String(process.pid), KOL_TEST_RUNNER_TOKEN: token },
      })
      let stdout = '', stderr = '', timedOut = false
      child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk })
      const timer = setTimeout(() => {
        timedOut = true
        // Signal only the direct child handle. Each fixture owner observes the
        // runner disappearing and its synthetic worker has a hard deadline.
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      }, 120_000)
      child.once('error', error => { clearTimeout(timer); reject(error) })
      child.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr, timedOut }) })
    })
    if (result.timedOut || result.signal) return { status: 'invalid' as const, reason: 'independent guardian runner did not complete: ' + (result.signal ?? 'timeout') }
    const receipts = result.stdout.split('\n').filter(line => line.startsWith('GUARDIAN_REGRESSION_JSON '))
    if (receipts.length !== 1) return { status: 'invalid' as const, reason: 'guardian test receipt missing or repeated: ' + result.stderr }
    const report: { checks?: unknown; fixtureInvalid?: unknown; zombieObserved?: unknown } = JSON.parse(receipts[0]!.slice('GUARDIAN_REGRESSION_JSON '.length))
    const checks = report.checks
    if (!checks || typeof checks !== 'object' || Array.isArray(checks) || Object.keys(checks).length !== names.length ||
      !names.every(name => typeof (checks as Record<string, unknown>)[name] === 'boolean') ||
      typeof report.fixtureInvalid !== 'boolean' || typeof report.zombieObserved !== 'boolean') {
      return { status: 'invalid' as const, reason: 'guardian test receipt does not contain all named boolean checks' }
    }
    if (report.fixtureInvalid) return { status: 'invalid' as const, reason: 'could not confirm synthetic fixture cleanup or inspect process state: ' + result.stderr }
    const passed = names.every(name => (checks as Record<string, boolean>)[name])
    if ((result.code === 0) !== passed) return { status: 'invalid' as const, reason: 'guardian test exit code disagrees with receipt' }
    // A zombie is no longer running; its observation does not prove it was reaped.
    return { status: passed ? 'pass' as const : 'fail' as const, checks: checks as Record<(typeof names)[number], boolean>, zombieObserved: report.zombieObserved, detail: result.stderr }
  } catch (error) {
    return { status: 'invalid' as const, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}
