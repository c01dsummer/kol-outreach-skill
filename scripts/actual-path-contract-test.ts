/**
 * ADR-90 两条 A 的机械接入。四份独立冻结原件逐字保留，expected不随目标输出改写。
 * 每次调用只在私有子进程装网络观察器，调用当前工作树真实profile/save/load路径。
 */
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fixtureLoader } from './check/prebuilt.js'

const sha256 = (body: string | Buffer): string => createHash('sha256').update(body).digest('hex')
const FROZEN_FILES = [
  { name: "actual-path-contracts.mts", sha256: "b3b86756cb3821ca874e7974b384e4a7bd2d484897ce1f5edb81514894e2582d", body: `import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const frozenRoot = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(frozenRoot, 'cases.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(frozenRoot, 'expected.json'), 'utf8'));
const plan = JSON.parse(readFileSync(join(frozenRoot, 'plan.json'), 'utf8'));
const fakeKey = 'FIXTURE_ONLY_NOT_A_REAL_TOKEN';
const labels = [
  'D2.a::tiktok-single-link-through-public-profile',
  'D2.a::instagram-array-through-public-profile',
  'D8.c::save-load-preserves-unqueried-sample-absence',
  'D8.c::save-load-preserves-queried-unavailable',
];
const copy = (value: any) => structuredClone(value);
const has = (value: any, key: string) => value != null && Object.hasOwn(value, key);

class FixtureInvalid extends Error {
  constructor(message: string) { super(message); this.name = 'FixtureInvalid'; }
}

/** Adjacent frozen JSON files travel with this module when integrating it. */
export async function runActualPathContractTests(options: {
  targetRoot: string;
  runRoot: string;
  mode?: string;
  emit?: (event: any) => void;
}) {
  const mode = options.mode ?? 'baseline';
  const allowedModes = ['baseline', ...plan.negative_controls.map((x: any) => x.mode)];
  if (!allowedModes.includes(mode)) throw new FixtureInvalid('Unknown control mode');
  const runRoot = resolve(options.runRoot);
  mkdirSync(runRoot, { recursive: true });
  const events: any[] = [];
  const fetchLog: any[] = [];
  const assertions: any[] = [];
  const record = (event: any) => { events.push(event); options.emit?.(event); };
  const assertCase = (label: string, checks: any[], actual: any) => {
    const result = { record: 'assertion', label, status: checks.every(x => x.pass) ? 'pass' : 'fail', checks, expected: expected[label], actual };
    assertions.push(result);
    record(result);
  };
  const check = (name: string, pass: boolean) => ({ name, pass });
  const originalFetch = globalThis.fetch;
  const patches: Array<[any, string, any]> = [];
  let invalid: any;
  const invalidate = (message: string) => {
    invalid = { record: 'fixture-invalid', message };
    fetchLog.push(invalid);
    record(invalid);
    throw new FixtureInvalid(message);
  };
  const block = (object: any, property: string, channel: string) => {
    patches.push([object, property, object[property]]);
    object[property] = () => invalidate('Blocked non-fixture network channel: ' + channel);
  };
  const fakeFetch: typeof fetch = async (input: any, init?: any) => {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    let url: URL;
    try { url = new URL(rawUrl); } catch { return invalidate('Unparseable request URL'); }
    const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers ?? input?.headers);
    const route = cases.profile_routes.find((r: any) => r.path === url.pathname && isDeepStrictEqual([...url.searchParams.entries()].sort(), Object.entries(r.query).sort()));
    const request = { record: 'fetch', method, origin: url.origin, path: url.pathname, query: Object.fromEntries(url.searchParams), authorization_is_fixture: headers.get('authorization') === 'Bearer ' + fakeKey };
    fetchLog.push(request);
    if (url.origin !== 'https://api.tikhub.io' || method !== 'GET' || !route || !request.authorization_is_fixture) {
      return invalidate('Unexpected request; no network fallback exists: ' + JSON.stringify(request));
    }
    const responseBody = { code: 200, message: 'Request successful. This request will incur a charge.', data: copy(route.provider_data) };
    fetchLog.push({ record: 'fixture-response', path: route.path, status: 200, body: responseBody });
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const wired = () => { if (globalThis.fetch !== fakeFetch) invalidate('Global fetch observer was replaced'); };
  try {
    // All patches precede target imports. No original network function is called.
    globalThis.fetch = fakeFetch;
    block(http, 'request', 'http.request'); block(http, 'get', 'http.get');
    block(https, 'request', 'https.request'); block(https, 'get', 'https.get');
    block(net, 'connect', 'net.connect'); block(net, 'createConnection', 'net.createConnection');
    block(net.Socket.prototype, 'connect', 'net.Socket.connect'); block(tls, 'connect', 'tls.connect');
    syncBuiltinESMExports();
    record({ record: 'wiring', phase: 'before-import', fake_fetch_installed: globalThis.fetch === fakeFetch, socket_channels_blocked: true });
    const root = resolve(options.targetRoot);
    const { TikHub } = await import(pathToFileURL(join(root, 'scripts/providers/tikhub.ts')).href);
    const { startBudget } = await import(pathToFileURL(join(root, 'scripts/lib/budget.ts')).href);
    const { saveEnrichment, loadEnrichment } = await import(pathToFileURL(join(root, 'scripts/lib/task.ts')).href);
    wired();
    const state = {};
    const budget = startBudget(state, 1_000_000, 'process');
    const api = new TikHub(fakeKey, budget);

    const profileResults: any[] = [];
    for (const route of cases.profile_routes) {
      wired();
      const before = fetchLog.filter(x => x.record === 'fetch').length;
      const result = await api.profile(route.handle, route.platform);
      wired();
      const requests = fetchLog.filter(x => x.record === 'fetch').slice(before);
      if (requests.length !== 1 || requests[0].path !== route.path) invalidate('Profile call did not produce exactly one documented positive observer event for ' + route.platform);
      profileResults.push({ platform: route.platform, actual_return: result });
      record({ record: 'fixture-qualified', platform: route.platform, documented_endpoint_seen: route.path, exact_request_count: 1 });
    }
    // Preserve true target returns before any deliberate assertion-boundary control.
    writeFileSync(join(runRoot, 'profile-returns.original.json'), JSON.stringify(profileResults, null, 2) + '\\n');
    const observedTikTok = { bio_links: copy(profileResults[0].actual_return?.bio_links) };
    const observedInstagram = { bio_links: copy(profileResults[1].actual_return?.bio_links) };
    if (mode === 'negative-tiktok-scalar') observedTikTok.bio_links = cases.profile_routes[0].provider_data.userInfo.user.bioLink.link;
    if (mode === 'negative-instagram-objects') observedInstagram.bio_links = copy(cases.profile_routes[1].provider_data.bio_links);
    assertCase('D2.a::tiktok-single-link-through-public-profile', [
      check('array of strings', Array.isArray(observedTikTok.bio_links) && observedTikTok.bio_links.every((x: any) => typeof x === 'string')),
      check('single original address', isDeepStrictEqual(observedTikTok.bio_links, expected[labels[0]].bio_links)),
    ], { bio_links: observedTikTok.bio_links });
    assertCase('D2.a::instagram-array-through-public-profile', [
      check('array of strings', Array.isArray(observedInstagram.bio_links) && observedInstagram.bio_links.every((x: any) => typeof x === 'string')),
      check('two original addresses in source order', isDeepStrictEqual(observedInstagram.bio_links, expected[labels[1]].bio_links)),
    ], { bio_links: observedInstagram.bio_links });

    const persistenceDir = join(runRoot, 'persistence');
    mkdirSync(persistenceDir, { recursive: true });
    writeFileSync(join(runRoot, 'enrichment-input.json'), JSON.stringify(cases.enrichment, null, 2) + '\\n');
    wired();
    saveEnrichment(persistenceDir, copy(cases.enrichment));
    wired();
    const persistedPath = join(persistenceDir, 'enrichment.json');
    const originalBytes = readFileSync(persistedPath);
    writeFileSync(join(runRoot, 'enrichment.saved-original.json'), originalBytes);
    if (mode === 'negative-unqueried-collapsed' || mode === 'negative-unavailable-erased') {
      const controlled = JSON.parse(originalBytes.toString('utf8'));
      if (mode === 'negative-unqueried-collapsed') controlled.accounts['tiktok:frozen_unqueried'].sample = copy(cases.enrichment.accounts['tiktok:frozen_unavailable'].sample);
      if (mode === 'negative-unavailable-erased') delete controlled.accounts['tiktok:frozen_unavailable'].sample;
      writeFileSync(persistedPath, JSON.stringify(controlled, null, 2) + '\\n');
    }
    const inspectedBytes = readFileSync(persistedPath);
    writeFileSync(join(runRoot, 'enrichment.inspected.json'), inspectedBytes);
    const disk = JSON.parse(inspectedBytes.toString('utf8'));
    wired();
    const loaded = loadEnrichment(persistenceDir);
    wired();
    writeFileSync(join(runRoot, 'enrichment.loaded.json'), JSON.stringify(loaded, null, 2) + '\\n');
    const unqueriedExpected = expected[labels[2]];
    const unqueriedDisk = disk?.accounts?.[unqueriedExpected.key];
    const unqueriedLoaded = loaded?.accounts?.[unqueriedExpected.key];
    assertCase('D8.c::save-load-preserves-unqueried-sample-absence', [
      check('disk retains account and absent sample', !!unqueriedDisk && !has(unqueriedDisk, 'sample')),
      check('real load retains account and absent sample', !!unqueriedLoaded && !has(unqueriedLoaded, 'sample')),
    ], { disk: unqueriedDisk, loaded: unqueriedLoaded });
    const unavailableExpected = expected[labels[3]];
    const diskSample = disk?.accounts?.[unavailableExpected.key]?.sample;
    const loadedSample = loaded?.accounts?.[unavailableExpected.key]?.sample;
    const unavailableChecks = (where: string, sample: any) => [
      check(where + ' unavailable status', sample?.status === unavailableExpected.sample_status),
      check(where + ' unavailable reason', sample?.reason === unavailableExpected.reason),
      check(where + ' source retained', isDeepStrictEqual(sample?.source, unavailableExpected.source)),
      check(where + ' query time retained', sample?.observed_at === unavailableExpected.observed_at),
      check(where + ' explicit zero sample count retained', sample?.sample_size === unavailableExpected.sample_size),
      check(where + ' unavailable has no measured value', !!sample && !has(sample, 'value')),
    ];
    assertCase('D8.c::save-load-preserves-queried-unavailable', [
      ...unavailableChecks('disk', diskSample), ...unavailableChecks('real load', loadedSample),
    ], { disk: diskSample, loaded: loadedSample });
    if (assertions.length !== labels.length || labels.some(label => assertions.filter(x => x.label === label).length !== 1)) invalidate('Assertion label runtime identity was not unique');
    record({ record: 'wiring', phase: 'after-calls', fake_fetch_installed: globalThis.fetch === fakeFetch, positive_profile_fetches: fetchLog.filter(x => x.record === 'fetch').length });
  } catch (error: any) {
    const classification = error instanceof FixtureInvalid || invalid ? 'fixture-invalid' : 'verifier-crash';
    record({ record: classification, message: error?.message ?? String(error) });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [object, property, previous] of patches.reverse()) object[property] = previous;
    syncBuiltinESMExports();
    writeFileSync(join(runRoot, 'fetch-log.json'), JSON.stringify(fetchLog, null, 2) + '\\n');
  }
  const failedLabels = assertions.filter(x => x.status === 'fail').map(x => x.label);
  const invalidRun = !!invalid || events.some(x => x.record === 'fixture-invalid' || x.record === 'verifier-crash');
  const result = { mode, valid: !invalidRun && assertions.length === 4, assertions, failed_labels: failedLabels, events };
  writeFileSync(join(runRoot, 'result.json'), JSON.stringify(result, null, 2) + '\\n');
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [targetRoot, runRoot, mode = 'baseline'] = process.argv.slice(2);
  if (!targetRoot || !runRoot) throw new Error('Usage: node --import <tsx-loader> actual-path-contracts.mts <target-root> <run-root> [mode]');
  const result = await runActualPathContractTests({ targetRoot, runRoot, mode, emit: event => console.log(JSON.stringify(event)) });
  console.log(JSON.stringify({ record: 'summary', mode, valid: result.valid, assertion_count: result.assertions.length, failed_labels: result.failed_labels }));
  process.exitCode = result.valid && result.failed_labels.length === 0 ? 0 : 1;
}
` },
  { name: "cases.json", sha256: "87cb6ed8f31af4632381e5aea666d6e01d2e0de0b3473893a75a1df24d18bf42", body: `{
  "profile_routes": [
    {
      "platform": "tiktok",
      "handle": "frozen_tt_links",
      "path": "/api/v1/tiktok/web/fetch_user_profile",
      "query": { "uniqueId": "frozen_tt_links" },
      "provider_data": {
        "userInfo": {
          "user": {
            "uniqueId": "frozen_tt_links",
            "nickname": "Frozen TikTok Profile",
            "signature": "Independent profile fixture",
            "followerCount": 3200,
            "followingCount": 12,
            "videoCount": 28,
            "verified": false,
            "bioLink": { "link": "https://tt-link.example/one" }
          }
        }
      }
    },
    {
      "platform": "instagram",
      "handle": "frozen_ig_links",
      "path": "/api/v1/instagram/v1/fetch_user_info_by_username_v3",
      "query": { "username": "frozen_ig_links" },
      "provider_data": {
        "pk": "fixture-ig-id",
        "username": "frozen_ig_links",
        "full_name": "Frozen Instagram Profile",
        "biography": "Independent profile fixture",
        "follower_count": 4300,
        "following_count": 23,
        "media_count": 37,
        "is_verified": false,
        "is_private": false,
        "bio_links": [
          { "url": "https://ig-link.example/first", "lynx_url": "https://l.instagram.com/?u=https%3A%2F%2Fig-link.example%2Ffirst" },
          { "url": "https://ig-link.example/second", "lynx_url": "https://l.instagram.com/?u=https%3A%2F%2Fig-link.example%2Fsecond" }
        ]
      }
    }
  ],
  "enrichment": {
    "version": 1,
    "updated_at": "2026-01-02T03:04:05.000Z",
    "accounts": {
      "tiktok:frozen_unqueried": {
        "platform": "tiktok",
        "handle": "frozen_unqueried"
      },
      "tiktok:frozen_unavailable": {
        "platform": "tiktok",
        "handle": "frozen_unavailable",
        "sample": {
          "status": "unavailable",
          "reason": "private_account",
          "source": {
            "kind": "public_api",
            "provider": "tikhub",
            "endpoint": "/api/v1/tiktok/app/v3/fetch_user_post_videos_v3"
          },
          "observed_at": "2026-01-02T03:04:05.000Z",
          "sample_size": 0
        }
      }
    }
  }
}
` },
  { name: "expected.json", sha256: "acc6c4e1d7798adad2bdb73c073b2843c1cbe17f372c9db2bb0c26b0aa016bc0", body: `{
  "D2.a::tiktok-single-link-through-public-profile": {
    "bio_links": ["https://tt-link.example/one"],
    "derivation": "D2.a requires string[]. A single bioLink.link therefore contributes one string, not the scalar itself or an object."
  },
  "D2.a::instagram-array-through-public-profile": {
    "bio_links": ["https://ig-link.example/first", "https://ig-link.example/second"],
    "derivation": "D2.a requires string[]. Public provider documentation identifies bio_links[].url as original addresses; the two original addresses remain two strings, in fixture order. lynx_url is not the original address."
  },
  "D8.c::save-load-preserves-unqueried-sample-absence": {
    "key": "tiktok:frozen_unqueried",
    "sample_has_own_property": false,
    "derivation": "AccountAssessment.sample is optional. No query is represented by absence; both persisted JSON and real loader must retain absence rather than inventing a measured or unavailable sample."
  },
  "D8.c::save-load-preserves-queried-unavailable": {
    "key": "tiktok:frozen_unavailable",
    "sample_status": "unavailable",
    "reason": "private_account",
    "source": { "kind": "public_api", "provider": "tikhub", "endpoint": "/api/v1/tiktok/app/v3/fetch_user_post_videos_v3" },
    "observed_at": "2026-01-02T03:04:05.000Z",
    "sample_size": 0,
    "sample_has_value_property": false,
    "derivation": "The public Measurement union encodes a queried but unavailable sample with status/reason/source/time and optional sample_size, with no value. Given explicit sample_size=0 it remains a real count of returned observations; the unqueried account stays absent. Compare actual disk and real load result, not the constructed state."
  }
}
` },
  { name: "plan.json", sha256: "cca701fd654d051cde7b39b257e3245b7a5b2d491a0aa22644f22f9295a1663e", body: `{
  "scope": ["D2.a actual public profile adaptation", "D8.c actual save/load enrichment persistence"],
  "target": { "root": "/private/tmp/kc-20261024/cross-cwd", "commit_prefix": "dbfc069", "runtime_modules": ["scripts/providers/tikhub.ts", "scripts/lib/budget.ts", "scripts/lib/task.ts"] },
  "runtime": "/private/tmp/kc-20261024/node-v22.22.0-darwin-arm64/bin/node",
  "loader": "/private/tmp/kc-20261024/cross-cwd/node_modules/tsx/dist/loader.mjs",
  "fixtures": {
    "origin": "Synthetic values chosen from admitted public field paths; no production outputs used.",
    "tiktok": "public-provider-contract.md lines 87-109: raw provider data.userInfo.user.bioLink.link is a single string.",
    "instagram": "public-provider-contract.md lines 256-278: raw provider data is the user object; bio_links is an array of url/lynx_url records, original address is url.",
    "enrichment": "public-types.ts AccountAssessment.sample optional; Measurement unavailable variant; EnrichmentState version/updated_at/accounts shape.",
    "wrapper": "ResponseModel.public.json independently admitted from fixed official SDK commit 2d92927332e1ff0fdc2d05b46381218a0f5a3511. Explicit HTTP 200 + code integer 200 + string message + data is a valid synthetic success wrapper. Schema has no required array and does not establish business data paths; those come only from the separate public provider field documentation."
  },
  "observation_wiring": {
    "install_before_import": "globalThis.fetch is replaced before any target module is imported; socket/http/https/tls entry points are blocked with fixture-invalid.",
    "positive": "Each public profile call must actually reach the same fake fetch observer exactly once at its documented endpoint/query; link sentinels must appear in the public return value.",
    "negative": "Every unexpected URL, query, HTTP method, absent fake Authorization, or blocked network request immediately makes the entire run fixture-invalid. No real fetch fallback exists.",
    "persistence": "saveEnrichment is called on a directory inside the run artifact root; exact enrichment.json bytes are preserved; JSON is parsed independently and loadEnrichment is called on that same directory.",
    "zero_events": "No business assertion is based solely on a zero event count; the same observer has real target-profile positive events. The observer identity is checked before and after each public call."
  },
  "negative_controls": [
    { "mode": "negative-tiktok-scalar", "change": "After real profile returns, replace only observed TikTok bio_links with the fixture scalar.", "must_fail": ["D2.a::tiktok-single-link-through-public-profile"] },
    { "mode": "negative-instagram-objects", "change": "After real profile returns, replace only observed Instagram bio_links with fixture url/lynx_url objects.", "must_fail": ["D2.a::instagram-array-through-public-profile"] },
    { "mode": "negative-unqueried-collapsed", "change": "After genuine saveEnrichment, replace absent sample on disk with a copy of the valid unavailable fixture; then inspect disk and call real loadEnrichment.", "must_fail": ["D8.c::save-load-preserves-unqueried-sample-absence"] },
    { "mode": "negative-unavailable-erased", "change": "After genuine saveEnrichment, remove the unavailable account's sample on disk; then inspect disk and call real loadEnrichment.", "must_fail": ["D8.c::save-load-preserves-queried-unavailable"] }
  ],
  "negative_control_limit": "These are deliberate assertion-boundary and persisted-data controls, not production-source mutations. They demonstrate observer/assertion sensitivity without claiming target-source mutation coverage.",
  "outcome_rules": {
    "valid_run": "Exactly four unique literal assertion labels, exactly one result per label. All HTTP fixture-qualified; no fixture-invalid or verifier-crash.",
    "baseline": "All four assertions pass; current product need not fail because this repairs old test paths, not a presumed production defect.",
    "negative": "Exactly the predeclared label fails and the other three pass, with no fixture-invalid/verifier-crash.",
    "fixture_invalid": "Preserve all originals; never count as product counterexample or negative-control detection. Any premise correction needs independent public documentation and another freeze; expected does not change to match output."
  },
  "independence": "New isolated author read only admitted packet files plus later admitted public wrapper, no production bodies, existing test.ts, mutation edits, author fix, peer/Astra/catalog reports. Narrow two-contract supplementation; not full SPEC rewrite or business regression."
}
` },
 ] as const

const LABELS = [
  'D2.a::tiktok-single-link-through-public-profile',
  'D2.a::instagram-array-through-public-profile',
  'D8.c::save-load-preserves-unqueried-sample-absence',
  'D8.c::save-load-preserves-queried-unavailable',
] as const
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function runActualPathContracts(): ReadonlyMap<string, readonly string[]> {
  const targetRoot = resolve('.')
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kol-actual-path-contract-')))
  try {
    for (const file of FROZEN_FILES) {
      if (sha256(file.body) !== file.sha256) throw new Error('actual-path fixture-invalid: frozen bytes changed: ' + file.name)
      writeFileSync(join(root, file.name), file.body)
    }
    const entry = join(root, 'actual-path-contracts.mts')
    const runRoot = join(root, 'observed')
    const source = ['scripts/providers/tikhub.ts', 'scripts/lib/budget.ts', 'scripts/lib/task.ts']
      .map(file => [file, sha256(readFileSync(join(targetRoot, file)))])
    console.log('actual-path source: ' + JSON.stringify(source))
    const child = spawnSync(process.execPath, ['--import', fixtureLoader(entry), entry, targetRoot, runRoot, 'baseline'], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 60_000, env: { ...process.env },
    })
    if (child.error || child.signal || ![0, 1].includes(child.status as number)) {
      throw new Error(`actual-path verifier failed: ${child.error ?? child.signal ?? child.status}\n${child.stdout}${child.stderr}`)
    }
    let result: unknown
    try { result = JSON.parse(readFileSync(join(runRoot, 'result.json'), 'utf8')) }
    catch (error) { throw new Error(`actual-path missing/invalid report: ${String(error)}\n${child.stdout}${child.stderr}`) }
    if (!object(result) || result.mode !== 'baseline' || result.valid !== true || !Array.isArray(result.assertions) ||
        !Array.isArray(result.events) || result.events.some(event => !object(event) || ['fixture-invalid', 'verifier-crash'].includes(event.record as string)) ||
        !Array.isArray(result.failed_labels)) throw new Error('actual-path fixture-invalid or verifier-crash')
    const rows = new Map<string, readonly string[]>()
    for (const row of result.assertions) {
      if (!object(row) || typeof row.label !== 'string' || rows.has(row.label) || !['pass', 'fail'].includes(row.status as string) ||
          !Array.isArray(row.checks) || row.checks.length === 0 ||
          row.checks.some(check => !object(check) || typeof check.name !== 'string' || typeof check.pass !== 'boolean')) {
        throw new Error('actual-path invalid assertion row')
      }
      const errors = row.checks.filter(check => !check.pass).map(check => check.name as string)
      if ((row.status === 'pass') !== (errors.length === 0)) throw new Error('actual-path row status mismatch')
      rows.set(row.label, errors)
    }
    const failed = [...rows].filter(([, errors]) => errors.length).map(([label]) => label).sort()
    if (JSON.stringify([...rows.keys()].sort()) !== JSON.stringify([...LABELS].sort()) ||
        JSON.stringify([...result.failed_labels].sort()) !== JSON.stringify(failed) || child.status !== (failed.length ? 1 : 0)) {
      throw new Error('actual-path incomplete results or exit mismatch')
    }
    return rows
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
