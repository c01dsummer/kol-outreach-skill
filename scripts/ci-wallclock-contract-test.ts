/**
 * ADR-151 公共墙钟合同的机械测试适配。五份冻结输入逐字内嵌，不追当前实现修改 expected。
 * 三组每次读当前 worker 的 YAML；提取/执行资格失败时抛出，只有完整报告交回具名断言。
 * claims/launches 共用的源清单包含精确 check.yml；实际提取仍在每次运行时进行。
 */
import { createHash } from 'node:crypto'
import { mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export type WallclockGroup = 'core' | 'cpu' | 'unavailable'
const sha256 = (body: string | Buffer): string => createHash('sha256').update(body).digest('hex')

// Source extractor mechanically follows the reviewed byte-preserving adapter, not a stored run body.
function extractWallclockRun(workflow: Buffer): { run: Buffer; sourceSha256: string; runSha256: string } {
  const lines = workflow.toString('utf8').match(/[^\n]*\n|[^\n]+$/g) ?? []
  const content = (line: string): string => line.replace(/\r?\n$/, '')
  const stepName = '      - name: 墙钟对比（只报数）'
  const starts = lines.flatMap((line, i) => content(line) === stepName ? [i] : [])
  if (starts.length !== 1) throw new Error('wallclock fixture-invalid: expected one current wallclock step')
  const start = starts[0]
  let end = start + 1
  while (end < lines.length && !content(lines[end]).startsWith('      - ')) end++
  const runStarts = lines.flatMap((line, i) => i > start && i < end && content(line) === '        run: |' ? [i] : [])
  if (runStarts.length !== 1) throw new Error('wallclock fixture-invalid: expected one literal run')
  const body: string[] = []
  for (let i = runStarts[0] + 1; i < end; i++) {
    const line = lines[i]
    if (line.startsWith('          ')) body.push(line.slice(10))
    else if (!content(line).trim()) body.push(line)
    else if (/^ {0,8}\S/.test(content(line))) break
    else throw new Error('wallclock fixture-invalid: unsupported run indentation')
  }
  if (!body.some(line => line.trim())) throw new Error('wallclock fixture-invalid: empty run')
  const run = Buffer.from(body.join(''))
  return { run, sourceSha256: sha256(workflow), runSha256: sha256(run) }
}

const FROZEN_FILES = [
  { name: "runner.mjs", sha256: "0b0fa2c3805e427169730b7ea811899c319d197c7887c12295310aa5a1ee7888", body: `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { FixtureError, cleanEnv, command, pythonJSON, readJSON, splitlines, writeJSON } from './shared.mjs';
import { dataFor, oracle } from './contract.mjs';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = readJSON(path.join(ROOT, 'fixtures.json'));
const MUT_PATH = 'scripts/check/mutations.json';
const write = (filename, value) => fs.writeFileSync(filename, value);
const mkdir = dirname => fs.mkdirSync(dirname);
const shellQuote = value => "'" + value.replaceAll("'", "'\\\\''") + "'";

function git(repo, env, args, input) {
  const result = command('/usr/bin/git', args, { cwd: repo, env, input });
  if (result.returncode !== 0) throw new FixtureError('real Git failed: ' + JSON.stringify(args) + ': ' + result.stderr);
  return result.stdout.trim();
}

export function buildGraph(repo, env) {
  mkdir(repo);
  git(repo, env, ['init', '-q']);
  const refs = {};
  for (const [name, spec] of Object.entries(FIXTURES.git_graph)) {
    let tree;
    if (spec.missing) tree = git(repo, env, ['mktree'], '');
    else {
      const value = spec.value ?? { mutations: Array(spec.n ?? 0).fill(null) };
      const blob = git(repo, env, ['hash-object', '-w', '--stdin'], pythonJSON(value) + '\\n');
      const check = git(repo, env, ['mktree'], \`100644 blob \${blob}\\tmutations.json\\n\`);
      const scripts = git(repo, env, ['mktree'], \`040000 tree \${check}\\tcheck\\n\`);
      tree = git(repo, env, ['mktree'], \`040000 tree \${scripts}\\tscripts\\n\`);
    }
    const parents = spec.parents.flatMap(parent => ['-p', refs[parent]]);
    refs[name] = git(repo, env, ['commit-tree', tree, ...parents], name + '\\n');
    git(repo, env, ['update-ref', 'refs/heads/fixture/' + name, refs[name]]);
  }
  if (Object.values(refs).length !== new Set(Object.values(refs)).size) throw new FixtureError('Git identities unexpectedly aliased');
  const parents = git(repo, env, ['rev-list', '--parents', '-n', '1', refs.head12]).split(/\\s+/);
  if (!isDeepStrictEqual(parents, [refs.head12, refs.parent10, refs.parent2_12])) throw new FixtureError('PR first/second parent identity is wrong');
  return refs;
}

export function platformSelfcheck(out, tools, baseEnv) {
  const sample = FIXTURES.cases[0];
  const cfg = path.join(out, 'platform-config.json');
  writeJSON(cfg, dataFor(FIXTURES, sample));
  const logfile = path.join(out, 'platform-selfcheck.jsonl');
  const env = { ...baseEnv, WALL_FIXTURE_CONFIG: cfg, WALL_FIXTURE_LOG: logfile };
  const url = 'https://fixture.invalid/repos/owner/repo/actions/workflows/check.yml/runs';
  const good = '?branch=main&event=push&status=success&created=%3C2026-10-24T01%3A00%3A00Z&per_page=5';
  const probes = { good,
    wrong_branch: good.replace('branch=main', 'branch=feature'),
    wrong_event: good.replace('event=push', 'event=pull_request'),
    wrong_status: good.replace('status=success', 'status=failure'),
    inclusive_cutoff: good.replace('created=%3C', 'created=%3C%3D'), other_workflow: good };
  const selected = {};
  for (const [name, query] of Object.entries(probes)) {
    const endpoint = name === 'other_workflow' ? url.replace('check.yml', 'other.yml') : url;
    const run = command(path.join(tools, 'curl'), ['-sS', endpoint + query], { env });
    if (run.returncode !== 0) throw new FixtureError('curl platform selfcheck failed');
    selected[name] = JSON.parse(run.stdout).workflow_runs.map(row => row.id);
  }
  if (!isDeepStrictEqual(selected.good, [100, 101, 102, 103, 104])) throw new FixtureError('positive server filter fixture is wrong');
  if (Object.keys(probes).some(name => name !== 'good' && isDeepStrictEqual(selected[name], selected.good))) throw new FixtureError('bad server filters accidentally returned the same five');
  const fourCfg = dataFor(FIXTURES, sample);
  fourCfg.http = 'history_four';
  writeJSON(cfg, fourCfg);
  const four = command(path.join(tools, 'curl'), ['-sS', url + good], { env });
  selected.history_four = JSON.parse(four.stdout).workflow_runs.map(row => row.id);
  if (four.returncode !== 0 || !isDeepStrictEqual(selected.history_four, [100, 101, 102, 103])) throw new FixtureError('four-history fixture is not exactly four eligible runs');
  writeJSON(path.join(out, 'platform-selfcheck-result.json'), selected);
}

export function runSuite({ group = 'all', out, target }) {
  if (!target) throw new FixtureError('WALLCLOCK_UNDER_TEST is required');
  if (!['all', 'core', 'cpu', 'unavailable'].includes(group)) throw new FixtureError('unknown group');
  out = path.resolve(out);
  const relative = path.relative(ROOT, out);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new FixtureError('all writes must remain under artifact root');
  if (fs.existsSync(out)) throw new FixtureError('output directory must not already exist');
  fs.mkdirSync(out, { recursive: true });
  const home = path.join(out, 'home'); mkdir(home);
  const baseEnv = cleanEnv(home);
  const tools = path.join(out, 'bin'); mkdir(tools);
  for (const name of ['curl', 'date', 'lscpu']) {
    const wrapper = '#!/bin/sh\\nexec ' + [process.execPath, path.join(ROOT, 'fake-tool.mjs'), name].map(shellQuote).join(' ') + ' "$@"\\n';
    write(path.join(tools, name), wrapper);
    fs.chmodSync(path.join(tools, name), 0o755);
  }
  platformSelfcheck(out, tools, baseEnv);
  const repo = path.join(out, 'repository');
  const refs = buildGraph(repo, baseEnv);
  writeJSON(path.join(out, 'git-identities.json'), refs);
  const cases = FIXTURES.cases.filter(sample => group === 'all' || sample.group === group);
  const rows = [];
  for (const sample of cases) {
    const label = sample.label;
    const caseout = path.join(out, label); mkdir(caseout);
    const cfgpath = path.join(caseout, 'config.json'); writeJSON(cfgpath, dataFor(FIXTURES, sample));
    const logfile = path.join(caseout, 'interfaces.jsonl');
    const summarypath = path.join(caseout, 'summary.txt'); write(summarypath, '');
    const temporary = path.join(caseout, 'tmp'); mkdir(temporary);
    git(repo, baseEnv, ['reset', '--hard', '-q', refs[sample.head]]);
    git(repo, baseEnv, ['checkout', '--detach', '-q', refs[sample.head]]);
    const dirty = path.join(repo, MUT_PATH); fs.mkdirSync(path.dirname(dirty), { recursive: true });
    write(dirty, pythonJSON({ mutations: Array(FIXTURES.dirty_worktree_n).fill(null) }) + '\\n');
    const baseSha = ({ uppercase: refs.before9.toUpperCase(), zero: '0'.repeat(40), missing: 'f'.repeat(40) })[sample.base] ?? refs[sample.base];
    if (baseSha === undefined) throw new FixtureError('unknown base fixture');
    const gitSnapshot = {
      head: git(repo, baseEnv, ['rev-parse', 'HEAD']), parent1: git(repo, baseEnv, ['rev-parse', 'HEAD^1']),
      parent2: git(repo, baseEnv, ['rev-parse', 'HEAD^2']), base_sha: baseSha, dirty_n: 99,
      status: git(repo, baseEnv, ['status', '--porcelain']),
    };
    if (gitSnapshot.head !== refs[sample.head] || !gitSnapshot.status) throw new FixtureError('HEAD/dirty wiring invalid');
    writeJSON(path.join(caseout, 'git-snapshot.json'), gitSnapshot);
    const env = { ...baseEnv, PATH: tools + ':' + baseEnv.PATH, WALL_FIXTURE_CONFIG: cfgpath,
      WALL_FIXTURE_LOG: logfile, GITHUB_API_URL: 'https://fixture.invalid', GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_RUN_ID: String(FIXTURES.run_id), GITHUB_EVENT_NAME: sample.event, BASE_SHA: baseSha,
      GH_TOKEN: label === 'wall.core.pr_first_parent' ? '' : 'fixture-token-ONLY-not-real',
      RUNNER_TEMP: temporary, GITHUB_STEP_SUMMARY: summarypath };
    // The target is executed only; never read, parsed, or hashed by this runner.
    const run = command('/bin/bash', [target], { cwd: repo, env, timeout: 20000 });
    write(path.join(caseout, 'stdout.txt'), run.stdout);
    write(path.join(caseout, 'stderr.txt'), run.stderr);
    const logs = fs.existsSync(logfile) ? splitlines(fs.readFileSync(logfile, 'utf8')).map(line => JSON.parse(line)) : [];
    const fixtureErrors = logs.filter(entry => Object.hasOwn(entry, 'fixture_error')).map(entry => entry.fixture_error);
    if (fixtureErrors.length) throw new FixtureError(label + ': ' + fixtureErrors.join('; '));
    const wiringErrors = [];
    if (!logs.some(row => row.tool === 'curl' && row.kind === 'current')) wiringErrors.push('current-HTTP observer was never reached');
    if (!logs.some(row => row.tool === 'lscpu')) wiringErrors.push('CPU observer was never reached');
    if (logs.some(row => row.tool === 'lscpu' && row.locale !== 'C')) wiringErrors.push('lscpu must receive LC_ALL=C');
    if (!sample.unavailable) {
      if (!logs.some(row => row.tool === 'curl' && row.kind === 'history')) wiringErrors.push('history-HTTP observer was never reached');
      if (!logs.some(row => row.tool === 'date' && row.fixed)) wiringErrors.push('fixed-clock observer was never reached');
    }
    const { errors, body } = oracle(sample, run, fs.readFileSync(summarypath, 'utf8'));
    errors.push(...wiringErrors);
    const result = { label, group: sample.group, status: errors.length ? 'FAIL' : 'PASS', errors,
      body, entry_exit: run.returncode, fixture_valid: true };
    rows.push(result);
    writeJSON(path.join(caseout, 'result.json'), result);
    console.log(result.status + ' ' + label + (errors.length ? ': ' + errors.join('; ') : ''));
  }
  const counts = {};
  for (const row of rows) counts[row.label] = (counts[row.label] ?? 0) + 1;
  if (!isDeepStrictEqual(Object.keys(counts).sort(), cases.map(sample => sample.label).sort()) || Object.values(counts).some(n => n !== 1)) throw new FixtureError('each selected frozen label must execute exactly once');
  const passed = rows.filter(row => row.status === 'PASS').length;
  const failed = rows.filter(row => row.status === 'FAIL').length;
  writeJSON(path.join(out, 'results.json'), { group, target_entry: target, target_not_read: true,
    cases: rows, label_counts: counts, passed, failed });
  console.log('RESULT ' + JSON.stringify({ pass: passed, fail: failed, fixture_invalid: false }));
  return failed ? 1 : 0;
}

export function main(argv = process.argv.slice(2)) {
  let group = 'all';
  let out;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--group') group = argv[++i];
    else if (argv[i] === '--out') out = argv[++i];
    else throw new FixtureError('unknown argument: ' + argv[i]);
  }
  if (!out) throw new FixtureError('--out is required');
  return runSuite({ group, out, target: process.env.WALLCLOCK_UNDER_TEST });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = main(); }
  catch (error) {
    if (error instanceof FixtureError) { console.error('FIXTURE_INVALID ' + error.message); process.exitCode = 2; }
    else { console.error('VERIFIER_CRASH ' + error.stack); process.exitCode = 1; }
  }
}
` },
  { name: "fake-tool.mjs", sha256: "62a6e332952e4be59bf70c6759d0ee33d77c905c3d44e7e80d66d927bf773413", body: `import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { epoch, pythonJSON, readJSON } from './shared.mjs';

// Internal dispatch interface: node fake-tool.mjs curl|date|lscpu ...actualArgs.
const [name, ...args] = process.argv.slice(2);
const cfg = readJSON(process.env.WALL_FIXTURE_CONFIG);
const logpath = process.env.WALL_FIXTURE_LOG;
const log = row => fs.appendFileSync(logpath, JSON.stringify({ tool: name, ...row }) + '\\n');
const outputText = text => fs.writeSync(1, String(text));

if (name === 'lscpu') {
  log({ args, locale: process.env.LC_ALL ?? null, output: cfg.cpu_text });
  outputText(cfg.cpu_text);
  process.exit(0);
}
if (name === 'date') {
  if ([['-u', '+%s'], ['+%s'], ['--utc', '+%s']].some(row => JSON.stringify(row) === JSON.stringify(args))) {
    log({ args, fixed: true });
    outputText(epoch(cfg.now) + '\\n');
    process.exit(0);
  }
  for (const flag of ['-d', '--date']) {
    if (args.includes(flag)) {
      let result;
      try { result = epoch(args[args.indexOf(flag) + 1]); }
      catch {
        log({ args, parsed: false });
        process.exit(1);
      }
      if (args.includes('+%s')) {
        log({ args, parsed: true });
        outputText(result + '\\n');
        process.exit(0);
      }
    }
  }
  log({ args, delegated: true });
  const delegated = spawnSync('/bin/date', args, { stdio: 'inherit' });
  if (delegated.error) throw delegated.error;
  process.exit(delegated.status ?? 1);
}
if (name !== 'curl') {
  log({ args, fixture_error: 'unexpected fake tool' });
  process.exit(96);
}

let url = null;
let output = null;
let writeout = '';
let fail = false;
const data = [];
let parseError = null;
const valueFlags = ['-o', '--output', '-w', '--write-out', '-H', '--header', '--max-time',
  '--connect-timeout', '--retry', '--retry-delay', '--retry-max-time', '-X', '--request',
  '--url', '--data-urlencode', '-d', '--data', '--data-raw', '-A', '--user-agent'];
try {
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (valueFlags.includes(arg)) {
      const value = args[i + 1];
      if (value === undefined) throw new Error('list index out of range');
      if (['-o', '--output'].includes(arg)) output = value;
      if (['-w', '--write-out'].includes(arg)) writeout = value;
      if (arg === '--url') url = value;
      if (['--data-urlencode', '-d', '--data', '--data-raw'].includes(arg)) data.push(value);
      i += 2;
    } else if (arg.startsWith('--output=')) { output = arg.slice('--output='.length); i++; }
    else if (arg.startsWith('--write-out=')) { writeout = arg.slice('--write-out='.length); i++; }
    else if (arg.startsWith('--url=')) { url = arg.slice('--url='.length); i++; }
    else if (['--silent', '--show-error', '--location', '--get', '--globoff', '--fail', '--fail-with-body'].includes(arg) || /^-[sSfLgG]+$/.test(arg)) {
      fail ||= arg.startsWith('--') ? ['--fail', '--fail-with-body'].includes(arg) : arg.slice(1).includes('f');
      i++;
    } else if (arg.startsWith('http://') || arg.startsWith('https://')) { url = arg; i++; }
    else throw new Error('unsupported curl argument: ' + arg);
  }
  if (url === null) throw new Error('curl URL missing');
} catch (error) { parseError = error.message; }
if (parseError) {
  log({ args, fixture_error: parseError });
  process.exit(96);
}

const parsed = new URL(url);
const query = {};
for (const [key, value] of parsed.searchParams) (query[key] ??= []).push(value);
for (const item of data) {
  const separator = item.indexOf('=');
  const key = separator < 0 ? item : item.slice(0, separator);
  const value = separator < 0 ? '' : item.slice(separator + 1);
  (query[key] ??= []).push(value);
}
const path = parsed.pathname;
const kind = path.endsWith('/actions/runs/' + cfg.run_id) ? 'current' : 'history';
const mode = cfg.http;
let status = 200;
let exitcode = 0;
let payload = null;
if (kind === 'current') {
  payload = cfg.current;
  if (mode === 'current_missing_started') payload = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'run_started_at'));
  if (['current403', 'current500'].includes(mode)) { status = Number(mode.slice(-3)); payload = { message: 'fixture HTTP status' }; }
  if (['connect', 'timeout'].includes(mode)) { status = 0; exitcode = mode === 'connect' ? 7 : 28; payload = null; }
} else {
  let rows = [...cfg.records];
  const workflowMatch = path.match(/\\/actions\\/workflows\\/([^/]+)\\/runs$/);
  const genericMatch = path.endsWith('/actions/runs');
  if (workflowMatch) rows = rows.filter(row => row.workflow_file === workflowMatch[1]);
  else if (!genericMatch) { status = 404; rows = []; }
  for (const key of ['branch', 'event', 'status']) {
    if (Object.hasOwn(query, key)) {
      const value = query[key].at(-1);
      const field = key === 'status' && ['success', 'failure'].includes(value) ? 'conclusion' : key;
      rows = rows.filter(row => row[field] === value);
    }
  }
  if (Object.hasOwn(query, 'created')) {
    const match = query.created.at(-1).match(/^(<=|>=|<|>)(.+)$/);
    if (match) {
      try {
        const limit = epoch(match[2]);
        const op = match[1];
        rows = rows.filter(row => ({ '<': epoch(row.created_at) < limit, '<=': epoch(row.created_at) <= limit,
          '>': epoch(row.created_at) > limit, '>=': epoch(row.created_at) >= limit })[op]);
      } catch { rows = []; }
    } else rows = [];
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (mode === 'history_four') rows = rows.filter(row => (row.valid_ordinal ?? 999) !== 4 && row.id !== 900007);
  if (mode === 'history_missing_updated') rows = rows.map(row => row.valid_ordinal === 2 ?
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at')) : row);
  if (mode === 'median_zero') rows = rows.map(row => Object.hasOwn(row, 'valid_ordinal') ? { ...row, updated_at: row.run_started_at } : row);
  const int = value => {
    if (!/^[+-]?\\d+$/.test(value.trim())) throw new Error('invalid fixture integer');
    return Number(value);
  };
  try {
    const page = int((query.page ?? ['1']).at(-1));
    const per = int((query.per_page ?? ['30']).at(-1));
    rows = rows.slice((page - 1) * per, page * per);
  } catch { rows = []; }
  payload = { total_count: rows.length, workflow_runs: rows };
  if (['history403', 'history500'].includes(mode)) { status = Number(mode.slice(-3)); payload = { message: 'fixture HTTP status' }; }
}
const body = payload === null ? '' : pythonJSON(payload);
if (fail && status >= 400) exitcode = 22;
log({ args, url, path, query, kind, status, exitcode,
  selected_ids: payload && !Array.isArray(payload) ? (payload.workflow_runs ?? []).map(row => row.id) : [],
  response: payload, output, writeout });
if (output) fs.writeFileSync(output, body);
else outputText(body);
outputText(writeout.replaceAll('%{http_code}', String(status).padStart(3, '0'))
  .replaceAll('%{response_code}', String(status).padStart(3, '0')).replaceAll('\\\\n', '\\n'));
process.exit(exitcode);
` },
  { name: "contract.mjs", sha256: "5d9b573c34ee830ef6308af3d2154faf2373be4dbacebe89a016773101968c33", body: `import { iso, splitlines } from './shared.mjs';

// These functions mechanically preserve the previously frozen Python-v2 semantics.
export function dataFor(fixture, sample) {
  const now = Date.parse(fixture.fixed_now);
  const started = now - sample.current_seconds * 1000;
  const current = {
    id: fixture.run_id, created_at: fixture.current_created, run_started_at: iso(started),
    updated_at: fixture.current_updated, event: 'push', branch: 'main',
    status: 'in_progress', workflow_file: 'check.yml',
  };
  const record = (id, created, duration, fields = {}) => {
    const start = Date.parse(created) + 1000;
    return { id, created_at: created, run_started_at: iso(start), updated_at: iso(start + duration * 1000),
      event: 'push', branch: 'main', status: 'completed', conclusion: 'success',
      workflow_file: 'check.yml', ...fields };
  };
  const cutoff = Date.parse(fixture.current_created);
  const records = sample.historical_seconds.map((duration, ordinal) =>
    record(100 + ordinal, iso(cutoff - (ordinal + 1) * 60000), duration, { valid_ordinal: ordinal }));
  records.push(current, record(900001, fixture.current_created, 7), record(900002, iso(cutoff + 1000), 13));
  for (const [id, seconds, field, value, duration] of [
    [900003, 5, 'workflow_file', 'other.yml', 17], [900004, 6, 'branch', 'feature', 19],
    [900005, 7, 'event', 'pull_request', 23], [900006, 8, 'conclusion', 'failure', 29],
  ]) {
    const row = record(id, iso(cutoff - seconds * 1000), duration);
    row[field] = value;
    records.push(row);
  }
  records.push(record(900007, iso(cutoff - 30 * 60000), 6000));
  return { now: iso(now), run_id: fixture.run_id, http: sample.http, current, records,
    cpu_text: fixture.cpu_inputs[sample.cpu] };
}

export function bodyExpected(sample) {
  const head = sample.unavailable ? null :
    \`本跑 \${sample.expected_current} · 主干前 5 次中位 \${sample.expected_median} · ×\${sample.expected_ratio}\`;
  let tail = ' · CPU：' + sample.expected_cpu;
  if (sample.expected_n === null) return [head, tail + ' · 变异：读不到'];
  const delta = sample.expected_delta === null ? '对照读不到' : sample.expected_delta;
  tail += \` · 变异 \${sample.expected_n} 条（\${delta}）\`;
  tail += sample.expected_each === null ? ' · 摊到每条：读不到' : \` · 摊到每条 \${sample.expected_each} 秒\`;
  return [head, tail];
}

export function oracle(sample, result, summary) {
  const errors = [];
  if (result.returncode !== 0) errors.push('report must exit successfully, got ' + result.returncode);
  const lines = splitlines(result.stdout);
  const notices = lines.filter(line => line.startsWith('::notice '));
  if (notices.length !== 1) {
    errors.push('exactly one notice required; got ' + notices.length);
    return { errors, body: null };
  }
  const separator = notices[0].slice(2).indexOf('::');
  const header = separator < 0 ? notices[0] : notices[0].slice(2, separator + 2);
  const body = separator < 0 ? '' : notices[0].slice(separator + 4);
  if (!/(?: |,)title=墙钟(?:,|$)/.test(header)) errors.push('notice title must be 墙钟');
  if (JSON.stringify(lines) !== JSON.stringify(notices)) errors.push('stdout must contain exactly the one public notice line');
  if (summary !== body + '\\n') errors.push('summary must be exactly the same one-line body + newline');
  if ((result.stdout + result.stderr + summary).includes('fixture-token-ONLY-not-real')) errors.push('token appeared in a public output');
  const [expectedHead, expectedTail] = bodyExpected(sample);
  if (sample.unavailable) {
    if (!body.startsWith('墙钟：无从比较（')) errors.push('unavailable prefix missing');
    const boundary = body.indexOf('） · CPU：');
    const reason = boundary < 0 ? body : body.slice(0, boundary);
    if (boundary < 0 || reason === '墙钟：无从比较（') errors.push('unavailable must carry a nonempty reason');
    const mode = sample.reason_class;
    if (mode.endsWith('403') && !reason.includes('403')) errors.push('HTTP403 reason lost');
    if (mode.endsWith('500') && !reason.includes('500')) errors.push('HTTP500 reason lost');
    if (mode === 'timeout' && !(reason.includes('超时') || reason.toLowerCase().includes('timeout'))) errors.push('timeout must be identifiable as timeout');
    if (mode === 'connect' && (reason.includes('超时') || reason.toLowerCase().includes('timeout'))) errors.push('connection failure incorrectly labeled timeout');
    if (reason.includes('×') || /本跑 [0-9]+:[0-9]{2}/.test(reason)) errors.push('unavailable reason fabricated comparable numeric values');
    if (!body.endsWith(expectedTail)) errors.push('known CPU/N/delta/each tail differs: expected ' + expectedTail);
  } else if (sample.expected_n === null) {
    const required = expectedHead + expectedTail;
    if (!body.startsWith(required)) errors.push('unreadable HEAD segment differs: expected prefix ' + required);
    const remainder = body.startsWith(required) ? body.slice(required.length) : '';
    if (!['', ' · 摊到每条：读不到'].includes(remainder)) errors.push('unreadable HEAD must not fabricate numeric count/per-item seconds');
  } else {
    const expected = expectedHead + expectedTail;
    if (body !== expected) errors.push('body differs: expected ' + expected);
  }
  return { errors, body };
}
` },
  { name: "shared.mjs", sha256: "e725ab007cf02f2dbf40099dccf02aac44d3f6385699ba9e1dc7d0c10bd2f99f", body: `import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export class FixtureError extends Error {}
export const readJSON = path => JSON.parse(fs.readFileSync(path, 'utf8'));
export const writeJSON = (path, value) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\\n');
export const iso = millis => new Date(millis).toISOString().replace('.000Z', 'Z');
export function epoch(value) {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new RangeError('invalid fixture date');
  return Math.trunc(millis / 1000);
}
// Mechanical Python json.dumps default separators for byte-identical Git objects.
export function pythonJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(pythonJSON).join(', ') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ': ' + pythonJSON(item)).join(', ') + '}';
  }
  return JSON.stringify(value);
}
export function command(file, args, options = {}) {
  const result = spawnSync(file, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return { returncode: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
export function splitlines(value) {
  if (value === '') return [];
  const lines = value.split(/\\r\\n|[\\n\\r\\v\\f\\x1c-\\x1e\\x85\\u2028\\u2029]/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}
export function cleanEnv(home) {
  return {
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: home,
    LANG: 'C.UTF-8', LC_ALL: 'C', TZ: 'UTC', GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'Blind Contract Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Blind Contract Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
  };
}
` },
  { name: "fixtures.json", sha256: "da66fd8175312c837fe0e4a5896b82f52d78b24fd07b6d3f53370daf2c527521", body: `{
  "version": 1,
  "fixed_now": "2026-10-24T02:05:00Z",
  "current_created": "2026-10-24T01:00:00Z",
  "current_started": "2026-10-24T02:00:00Z",
  "current_updated": "2026-10-24T02:01:01Z",
  "run_id": 910001,
  "dirty_worktree_n": 99,
  "cpu_inputs": {
    "normal": "Architecture: x86_64\\nBIOS Model name: Wrong BIOS CPU\\n   Model name: Fixture CPU 8-Core @ 3.20GHz\\n",
    "first": "BIOS Model name: Wrong BIOS CPU\\n   Model name: First CPU\\nModel name: Second CPU\\n",
    "injection": " Model name: CPU%: 汉 A()@.,_+/-::warning file=x::\\n::error file=evil::from-other-line\\n",
    "spaces": "Model name:   Foo     Bar   \\n",
    "long": "Model name:    AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZ\\n",
    "bios": "BIOS Model name: BIOS Is Not CPU Model\\nArchitecture: x86_64\\n",
    "empty": "  Model name: 中文%%%:::∆\\n"
  },
  "git_graph": {
    "root": {
      "parents": [],
      "n": 1
    },
    "parent10": {
      "parents": [
        "root"
      ],
      "n": 10
    },
    "parent2_12": {
      "parents": [
        "root"
      ],
      "n": 12
    },
    "base7": {
      "parents": [
        "root"
      ],
      "n": 7
    },
    "before9": {
      "parents": [
        "root"
      ],
      "n": 9
    },
    "before13": {
      "parents": [
        "root"
      ],
      "n": 13
    },
    "equal12": {
      "parents": [
        "root"
      ],
      "n": 12
    },
    "equal3": {
      "parents": [
        "root"
      ],
      "n": 3
    },
    "base_nonarray": {
      "parents": [
        "root"
      ],
      "value": {
        "mutations": {}
      }
    },
    "head12": {
      "parents": [
        "parent10",
        "parent2_12"
      ],
      "n": 12
    },
    "head3": {
      "parents": [
        "parent10",
        "parent2_12"
      ],
      "n": 3
    },
    "head0": {
      "parents": [
        "parent10",
        "parent2_12"
      ],
      "n": 0
    },
    "head_nonarray": {
      "parents": [
        "parent10",
        "parent2_12"
      ],
      "value": {
        "mutations": {}
      }
    },
    "head_missing": {
      "parents": [
        "parent10",
        "parent2_12"
      ],
      "missing": true
    },
    "head3mixed": {
      "parents": [
        "parent10",
        "parent2_12"
      ],
      "value": {
        "mutations": [
          null,
          42,
          {}
        ]
      }
    }
  },
  "cases": [
    {
      "label": "wall.core.pr_first_parent",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "pull_request",
      "base": "base7",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+2",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.push_before",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.long_minutes",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head3",
      "event": "push",
      "base": "equal3",
      "current_seconds": 3699,
      "historical_seconds": [
        240,
        120,
        180,
        300,
        60
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 3,
      "expected_delta": "±0",
      "expected_ratio": "20.55",
      "expected_each": "1233.00",
      "expected_current": "61:39",
      "expected_median": "3:00",
      "unavailable": false
    },
    {
      "label": "wall.core.head_zero",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head0",
      "event": "push",
      "base": "parent10",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 0,
      "expected_delta": "-10",
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.head_nonarray",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head_nonarray",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": null,
      "expected_delta": null,
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.head_missing",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head_missing",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": null,
      "expected_delta": null,
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.array_length_only",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head3mixed",
      "event": "push",
      "base": "equal3",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 3,
      "expected_delta": "±0",
      "expected_ratio": "1.25",
      "expected_each": "100.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.base_uppercase",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "push",
      "base": "uppercase",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": null,
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.base_zero",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "push",
      "base": "zero",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": null,
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.base_missing",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "push",
      "base": "missing",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": null,
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.base_nonarray",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "push",
      "base": "base_nonarray",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": null,
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.delta_negative",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "push",
      "base": "before13",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "-1",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.core.delta_zero",
      "group": "core",
      "source": "C1-4,C6-8;E179,185,862-864",
      "head": "head12",
      "event": "push",
      "base": "equal12",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "ok",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "±0",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.cpu.first_model",
      "group": "cpu",
      "source": "C1,C5;E850,858-860",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "first",
      "http": "ok",
      "expected_cpu": "First CPU",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.cpu.allowed_and_injection",
      "group": "cpu",
      "source": "C1,C5;E850,858-860",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "injection",
      "http": "ok",
      "expected_cpu": "CPU A()@.,_+/-warning filex",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.cpu.whitespace",
      "group": "cpu",
      "source": "C1,C5;E850,858-860",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "spaces",
      "http": "ok",
      "expected_cpu": "Foo Bar",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.cpu.truncate_before_trim",
      "group": "cpu",
      "source": "C1,C5;E850,858-860",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "long",
      "http": "ok",
      "expected_cpu": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.cpu.bios_only",
      "group": "cpu",
      "source": "C1,C5;E850,858-860",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "bios",
      "http": "ok",
      "expected_cpu": "读不到",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.cpu.filtered_empty",
      "group": "cpu",
      "source": "C1,C5;E850,858-860",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "empty",
      "http": "ok",
      "expected_cpu": "读不到",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": false
    },
    {
      "label": "wall.unavailable.current403",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "current403",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "current403"
    },
    {
      "label": "wall.unavailable.current500",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "current500",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "current500"
    },
    {
      "label": "wall.unavailable.connect",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "connect",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "connect"
    },
    {
      "label": "wall.unavailable.timeout",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "timeout",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "timeout"
    },
    {
      "label": "wall.unavailable.history403",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "history403",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "history403"
    },
    {
      "label": "wall.unavailable.history500",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "history500",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "history500"
    },
    {
      "label": "wall.unavailable.history_four",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "history_four",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "history_four"
    },
    {
      "label": "wall.unavailable.history_missing_updated",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "history_missing_updated",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "history_missing_updated"
    },
    {
      "label": "wall.unavailable.current_missing_started",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "current_missing_started",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": null,
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "current_missing_started"
    },
    {
      "label": "wall.unavailable.median_zero",
      "group": "unavailable",
      "source": "C2-3,C8-9;E179,185,850,864",
      "head": "head12",
      "event": "push",
      "base": "before9",
      "current_seconds": 300,
      "historical_seconds": [
        360,
        120,
        300,
        180,
        240
      ],
      "cpu": "normal",
      "http": "median_zero",
      "expected_cpu": "Fixture CPU 8-Core @ 3.20GHz",
      "expected_n": 12,
      "expected_delta": "+3",
      "expected_ratio": "1.25",
      "expected_each": "25.00",
      "expected_current": "5:00",
      "expected_median": "4:00",
      "unavailable": true,
      "reason_class": "median_zero"
    }
  ]
}
` },
] as const

interface FrozenCase { label: string; group: WallclockGroup }
interface FrozenRow { label: string; group: WallclockGroup; status: 'PASS' | 'FAIL'; errors: string[]; fixture_valid: true }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// These are host capabilities used by the frozen runner, not expected workflow output.
function calibrateWallclockTools(): void {
  const env = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }
  const probes = [
    ['jq', ['-cne', '[([0,0] | arrays | length), ("1970-01-01T00:00:00Z" | fromdate), ([7,3,5] | sort | .[1])]'], '', '[2,0,5]\n'],
    ['awk', ['-v', 'a=5', '-v', 'b=2', 'BEGIN { printf "%.2f", a / b }'], '', '2.50'],
    ['sed', ['-n', 's/^[[:space:]]*Model name://p'], '  Model name:  Probe CPU\n', '  Probe CPU\n'],
    ['head', ['-n', '1'], 'first\nsecond\n', 'first\n'],
    ['tr', ['-cd', '[:alnum:] ()@.,_+/-'], '\tProbe CPU!\n', 'Probe CPU'],
    ['tr', ['-s', ' '], 'Probe   CPU\n', 'Probe CPU\n'],
    ['cut', ['-c', '1-3'], 'abcdef\n', 'abc\n'],
  ] as const
  for (const [tool, args, input, expected] of probes) {
    const child = spawnSync(tool, [...args], { input, encoding: 'utf8', env, timeout: 5_000, maxBuffer: 64 * 1024 })
    if (child.error || child.signal || child.status !== 0 || child.stdout !== expected || child.stderr !== '') {
      throw new Error(`wallclock fixture-invalid: ${tool} calibration failed: ${String(child.error ?? child.signal ?? child.status)}; stdout=${JSON.stringify(child.stdout)}; stderr=${JSON.stringify(child.stderr)}`)
    }
  }
}

export function runWallclockContract(group: WallclockGroup): ReadonlyMap<string, readonly string[]> {
  calibrateWallclockTools()
  const source = extractWallclockRun(readFileSync(resolve('.github/workflows/check.yml')))
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kol-wallclock-contract-')))
  try {
    for (const file of FROZEN_FILES) {
      if (sha256(file.body) !== file.sha256) throw new Error('wallclock fixture-invalid: frozen bytes changed: ' + file.name)
      writeFileSync(join(root, file.name), file.body)
    }
    const fixtures = JSON.parse(FROZEN_FILES.find(file => file.name === 'fixtures.json')!.body) as { cases: FrozenCase[] }
    const expected = fixtures.cases.filter(row => row.group === group).map(row => row.label).sort()
    const target = join(root, 'current-wallclock.sh')
    writeFileSync(target, source.run)
    const out = join(root, 'results')
    console.log(`wallclock source ${group}: yaml=${source.sourceSha256} run=${source.runSha256}`)
    const child = spawnSync(process.execPath, [join(root, 'runner.mjs'), '--group', group, '--out', out], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120_000,
      env: { ...process.env, WALLCLOCK_UNDER_TEST: target },
    })
    const output = child.stdout + child.stderr
    if (child.error || child.signal || ![0, 1].includes(child.status as number) || /FIXTURE_INVALID|VERIFIER_CRASH/.test(output)) {
      throw new Error(`wallclock verifier failed: ${child.error ?? child.signal ?? child.status}\n${output}`)
    }
    let report: unknown
    try { report = JSON.parse(readFileSync(join(out, 'results.json'), 'utf8')) }
    catch (error) { throw new Error(`wallclock verifier missing/invalid report: ${String(error)}\n${output}`) }
    if (!object(report) || report.group !== group || report.target_entry !== target || report.target_not_read !== true ||
        !Array.isArray(report.cases) || !object(report.label_counts)) throw new Error('wallclock verifier invalid report identity')
    const rows: FrozenRow[] = []
    for (const row of report.cases) {
      if (!object(row) || typeof row.label !== 'string' || row.group !== group || row.fixture_valid !== true ||
          !['PASS', 'FAIL'].includes(row.status as string) || !Array.isArray(row.errors) ||
          !row.errors.every(error => typeof error === 'string') || (row.status === 'PASS') !== (row.errors.length === 0)) {
        throw new Error('wallclock verifier invalid row')
      }
      rows.push(row as unknown as FrozenRow)
    }
    const labels = rows.map(row => row.label).sort()
    const counts = report.label_counts
    const failed = rows.filter(row => row.status === 'FAIL').length
    if (JSON.stringify(labels) !== JSON.stringify(expected) || new Set(labels).size !== labels.length ||
        JSON.stringify(Object.keys(counts).sort()) !== JSON.stringify(expected) || Object.values(counts).some(n => n !== 1) ||
        report.failed !== failed || report.passed !== rows.length - failed || child.status !== (failed ? 1 : 0)) {
      throw new Error('wallclock verifier incomplete results or exit mismatch')
    }
    return new Map(rows.map(row => [row.label, row.errors]))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
