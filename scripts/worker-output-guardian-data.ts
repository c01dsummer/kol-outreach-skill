// Process-lifetime guard for the worker-output test fixture.
export const WORKER_OUTPUT_GUARDIAN = `'use strict';
// Process-lifetime guard for the worker-output fixture. A POSIX group guard must itself be launched with detached:true.
// KOL_GUARDIAN_PARENT_PID closes the reparent-before-bootstrap race; set it to
// the spawning parent's own PID. No environment variable is passed to the child.
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const [mode, executable, ...args] = process.argv.slice(2);
if (!['group', 'child'].includes(mode) || !executable) {
  process.stderr.write('usage: node guard.js <group|child> <executable> [args...]\\n');
  process.exit(64);
}
if (mode === 'group' && process.platform === 'win32') {
  process.stderr.write('group guard requires POSIX process groups\\n');
  process.exit(64);
}
const envPpid = process.env.KOL_GUARDIAN_PARENT_PID;
const expectedPpid = envPpid === undefined ? NaN : Number(envPpid);
if (!Number.isSafeInteger(expectedPpid) || expectedPpid <= 1) {
  process.stderr.write('invalid expected parent PID\\n');
  process.exit(64);
}
// A group signal is allowed only while this process is the actual group leader.
// The leader PID stays allocated throughout the signal-and-grace window.
function verifyOwnGroup() {
  const ps = spawnSync('/bin/ps', ['-o', 'pgid=', '-p', String(process.pid)], { encoding: 'utf8', timeout: 2000 });
  return !ps.error && ps.status === 0 && /^\\s*\\d+\\s*$/.test(ps.stdout) && Number(ps.stdout.trim()) === process.pid;
}
if (mode === 'group' && !verifyOwnGroup()) {
  process.stderr.write('group guard must be the verified process group leader\\n');
  process.exit(64);
}
// Query numeric group membership only; the query runs outside our own group.
// A failed or malformed observation cannot qualify a normal fixture result.
function hasLiveGroupMembers() {
  const ps = spawnSync('/bin/ps', ['-A', '-o', 'pid=', '-o', 'pgid=', '-o', 'stat='],
    { encoding: 'utf8', timeout: 2000, maxBuffer: 8 * 1024 * 1024, detached: true });
  if (ps.error || ps.status !== 0 || !ps.stdout.trim()) return null;
  const rows = ps.stdout.trim().split('\\n');
  let own = false, live = false;
  for (const row of rows) {
    const match = /^\\s*(\\d+)\\s+(\\d+)\\s+(\\S+)\\s*$/.exec(row);
    if (!match) return null;
    const pid = Number(match[1]), pgid = Number(match[2]), state = match[3];
    if (!Number.isSafeInteger(pid) || !Number.isSafeInteger(pgid)) return null;
    if (pid === process.pid && pgid === process.pid) own = true;
    else if (pgid === process.pid && !state.includes('Z')) live = true;
  }
  return own ? live : null;
}
function parentGone() { return process.ppid !== expectedPpid; }
if (parentGone()) process.exit(125); // do not spawn after a known dead parent
let fd3 = 'ignore';
if (process.env.KOL_GUARD_FORWARD_FD3 === '1') {
  try { fs.fstatSync(3); fd3 = 3; } catch { process.stderr.write('declared fd3 unavailable\\n'); process.exit(64); }
}
const childEnv = { ...process.env };
delete childEnv.KOL_GUARDIAN_PARENT_PID;
delete childEnv.KOL_GUARD_FORWARD_FD3;
let child;
let stopping = false;
let killTimer;
let poll;
let earlySignal;
let spawnError = false;
let childExited = false;
const pauseMs = 300;
function ignoreESRCH(error) { if (error && error.code !== 'ESRCH') process.stderr.write(\`guard signal error: \${error.message}\\n\`); }
function stop(reason) {
  if (stopping) return;
  stopping = true;
  clearInterval(poll);
  // A signal may be received before spawn returns; remember it and finish
  // cleanup as soon as the spawned child exists.
  if (!child || !child.pid) { earlySignal = reason; return; }
  if (mode === 'group') {
    if (!verifyOwnGroup()) { process.stderr.write('guard lost group ownership\\n'); process.exit(125); }
    try { process.kill(-process.pid, 'SIGTERM'); } catch (e) { ignoreESRCH(e); }
    // Never release the group leader before the hard kill; the KILL includes us.
    killTimer = setTimeout(() => {
      if (!verifyOwnGroup()) { process.stderr.write('guard lost group ownership before KILL\\n'); process.exit(125); }
      try { process.kill(-process.pid, 'SIGKILL'); } catch (e) { ignoreESRCH(e); process.exit(125); }
    }, pauseMs);
  } else {
    try { child.kill('SIGTERM'); } catch (e) { ignoreESRCH(e); }
    killTimer = setTimeout(() => {
      if (childExited) return;
      try { child.kill('SIGKILL'); } catch (e) { ignoreESRCH(e); }
      setTimeout(() => process.exit(125), 1000).unref();
    }, pauseMs);
  }
}
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => stop(sig));
try { child = spawn(executable, args, { env: childEnv, stdio: [0, 1, 2, fd3] }); }
catch (e) { process.stderr.write(\`guard spawn: \${e.message}\\n\`); process.exit(127); }
child.once('exit', () => {
  childExited = true;
  if (stopping && mode === 'child') { clearTimeout(killTimer); process.exit(125); }
});
child.once('error', e => { spawnError = true; process.stderr.write(\`guard spawn: \${e.message}\\n\`); });
// A finished group child can leave same-group descendants with inherited pipes.
// React to exit, not close: a descendant may keep those pipes open.
child.once('exit', (_code, signal) => {
  if (mode !== 'group' || stopping) return;
  if (signal || hasLiveGroupMembers() !== false) stop('child-ended-with-live-group');
});
child.once('close', (code, signal) => {
  if (parentGone() && !stopping) stop('parent-lost-on-close');
  if (stopping) {
    if (mode === 'group' && child.pid) return; // keep group leader alive through SIGKILL
    if (mode === 'group') process.exit(125);
    clearTimeout(killTimer);
    process.exit(125);
  }
  clearInterval(poll);
  if (spawnError) process.exit(127);
  if (signal) {
    for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.removeAllListeners(sig);
    try { process.kill(process.pid, signal); } catch { process.exit(128); }
    return;
  }
  process.exit(code === null ? 125 : code);
});
if (earlySignal) { stopping = false; stop(earlySignal); }
if (parentGone()) stop('parent-lost-after-spawn');
poll = setInterval(() => { if (parentGone()) stop('parent-lost'); }, 50);
`
export const WORKER_OUTPUT_GUARDIAN_SHA256 = "bd57542d575fa94d3f15c46c90aea3f8a407184c07a2dc27b204f3bc37105022"
