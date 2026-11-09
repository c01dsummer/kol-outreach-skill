/**
 * 墙钟来源身份合同的机械接入。案例/oracle及原runner逐字内嵌，补充runner的历史归档
 * 连续性校验仅替换为实际解包输入manifest；公共API调用、检查和权限恢复逻辑保留。
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fixtureLoader } from './check/prebuilt.js'

const sha256 = (body: string | Buffer): string => createHash('sha256').update(body).digest('hex')
const FROZEN_INPUTS = [
  { path: "sealed/cases.json", sha256: "58649392579f793ce7b838a1bfbc045b847fd4b0a81e03947475fc29c45490b9", body: `[
  {
    "label": "Q01_fixture_bytes_and_layout",
    "expected": "All private fixture bytes match the frozen template, one root check.yml is present, two script TS files and two custom TS files exist."
  },
  {
    "label": "P01_same_fingerprint_fresh",
    "expected": "claimsFresh(baseHash,baseHash) === true using the same calls and fixture as invalidation."
  },
  {
    "label": "P02_same_mutation_identity",
    "expected": "Two mutationSourceIdentity() calls without edits are equal."
  },
  {
    "label": "D01_default_membership",
    "expected": "sourceFiles() has exactly scripts TS plus root check.yml and their frozen bodies."
  },
  {
    "label": "D02_explicit_scripts_membership",
    "expected": "sourceFiles(\\"scripts\\") has the same exact paths and bodies as default."
  },
  {
    "label": "D03_explicit_scripts_fingerprint",
    "expected": "fingerprint(sourceFiles(\\"scripts\\")) === fingerprint(sourceFiles())."
  },
  {
    "label": "C01_custom_membership",
    "expected": "sourceFiles(\\"custom\\") has exactly two .ts paths and their frozen bodies, with no YAML."
  },
  {
    "label": "C02_custom_workflow_independent",
    "expected": "Root check.yml edit leaves custom source fingerprint equal."
  },
  {
    "label": "C03_custom_non_ts_independent",
    "expected": "Custom non-TS edits leave custom source fingerprint equal."
  },
  {
    "label": "W01_workflow_fingerprint_changes",
    "expected": "Only root check.yml body changes; default fingerprint differs."
  },
  {
    "label": "W02_workflow_mutation_identity_changes",
    "expected": "Only root check.yml body changes; mutation identity differs."
  },
  {
    "label": "W03_old_claims_rejected",
    "expected": "claimsFresh(oldHash,newHash) === false after root check.yml edit."
  },
  {
    "label": "W04_current_claims_fresh",
    "expected": "claimsFresh(newHash,newHash) === true after root check.yml edit."
  },
  {
    "label": "W05_old_cost_launches_identity_unequal",
    "expected": "Old mutation-cost/launches source identity equality with new source identity is false; equality-only interface check."
  },
  {
    "label": "G01_other_github_fingerprint_stable",
    "expected": "Only non-check .github files change; default fingerprint stays equal."
  },
  {
    "label": "G02_other_github_mutation_identity_stable",
    "expected": "Only non-check .github files change; mutation identity stays equal."
  },
  {
    "label": "S01_script_fingerprint_changes",
    "expected": "Only scripts TS body changes; default fingerprint differs."
  },
  {
    "label": "S02_script_mutation_identity_changes",
    "expected": "Only scripts TS body changes; mutation identity differs."
  },
  {
    "label": "S03_old_script_claims_rejected",
    "expected": "claimsFresh(oldHash,newHash) === false after scripts TS edit."
  }
]
` },
  { path: "sealed/expected.json", sha256: "111977ca01136389664190b38a2051affe215cb3548ec474052db5d380b73146", body: `{
  "contract": "Default source identity = scripts/**/*.ts plus exactly .github/workflows/check.yml; explicit scripts equals default; custom directory remains TS-only.",
  "defaultPaths": [
    ".github/workflows/check.yml",
    "scripts/a.ts",
    "scripts/nested/b.ts"
  ],
  "customPaths": [
    "custom/nested/deep.ts",
    "custom/unit.ts"
  ],
  "baseFiles": {
    "scripts/a.ts": "export const alpha = 1;\\n",
    "scripts/nested/b.ts": "export const beta = \\"base\\";\\n",
    "scripts/readme.txt": "This non-TS script neighbor is not a program input.\\n",
    ".github/workflows/check.yml": "name: check\\non: [push]\\njobs:\\n  verify:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: echo baseline\\n",
    ".github/workflows/other.yml": "name: other\\non: [workflow_dispatch]\\njobs:\\n  idle:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: echo other\\n",
    ".github/README.md": "An unrelated GitHub note.\\n",
    ".github/helpers/ignored.ts": "export const unrelatedGitHubInput = 1;\\n",
    "custom/unit.ts": "export const customUnit = 1;\\n",
    "custom/nested/deep.ts": "export const customDeep = true;\\n",
    "custom/notes.txt": "Custom non-TS neighbor.\\n",
    "custom/.github/workflows/check.yml": "name: custom-non-ts\\n",
    "mutations.json": "{\\"mutations\\":[]}\\n",
    "package-lock.json": "{\\"name\\":\\"identity-contract-fixture\\",\\"version\\":\\"1.0.0\\",\\"lockfileVersion\\":3,\\"requires\\":true,\\"packages\\":{}}\\n",
    "package.json": "{\\"name\\":\\"identity-contract-fixture\\",\\"private\\":true,\\"type\\":\\"module\\"}\\n",
    "scripts/check/mutations.json": "{\\"mutations\\":[]}\\n"
  },
  "changes": {
    "workflow": {
      "path": ".github/workflows/check.yml",
      "body": "name: check\\non: [push]\\njobs:\\n  verify:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: echo changed-workflow\\n"
    },
    "script": {
      "path": "scripts/nested/b.ts",
      "body": "export const beta = \\"changed-script\\";\\n"
    },
    "otherGithub": {
      ".github/workflows/other.yml": "name: other-changed\\non: [push]\\n",
      ".github/README.md": "Changed unrelated GitHub note.\\n",
      ".github/helpers/ignored.ts": "export const unrelatedGitHubInput = 2;\\n",
      ".github/workflows/new-other.yml": "name: new-other\\n"
    },
    "customNonTs": {
      "custom/notes.txt": "Changed custom non-TS.\\n",
      "custom/.github/workflows/check.yml": "name: changed-custom-non-ts\\n"
    }
  },
  "handDerivedRelations": [
    "Default and explicit scripts have the same exact three logical paths and matching bodies.",
    "Changing only root check.yml changes fingerprint(default) and mutationSourceIdentity().",
    "For the workflow change, claimsFresh(oldFingerprint,newFingerprint) is false; claimsFresh(x,x) is true on either stage.",
    "An old mutation-cost/launches identity string compared to the current mutationSourceIdentity is unequal after the workflow change; no mutation-cost or launches CLI is invoked.",
    "Changing only other .github files leaves both default identities unchanged.",
    "Changing only scripts/nested/b.ts changes both default identities and invalidates old claims.",
    "Custom traversal contains only its two .ts files; changing project check.yml or custom non-TS neighbors leaves its fingerprint unchanged."
  ],
  "algorithmConstants": "None: tests compare hand-derived equality/inequality and exact public source membership, never specific digest constants."
}
` },
  { path: "sealed/fixture-validity-and-positives.json", sha256: "95f58297a85dd6319e57eeb91c02edf9e0a53ea988beb864455899140b5f09d7", body: `{
  "fixtureValidity": "Exact sealed UTF-8 bytes, private cwd, two nested TS scopes, distinct root check.yml and unrelated .github files; dependency files remain fixed in every edited comparison.",
  "semanticQualification": "Target calls must complete. Throw/import failure is harness or fixture error, never semantic red. Exact-membership mismatch does not disqualify valid bytes: that is a contractual observation.",
  "positives": [
    "P01_same_fingerprint_fresh",
    "P02_same_mutation_identity",
    "W04_current_claims_fresh",
    "S01_script_fingerprint_changes",
    "S02_script_mutation_identity_changes",
    "S03_old_script_claims_rejected"
  ],
  "positiveQualificationRule": "Report each positive separately; do not silently credit an invalidation observation if the same-wiring positive or fixture qualification failed.",
  "claimsScope": "Only the four public API calls are exercised. No claim that audit, launches, mutation-cost CLI, or all SPEC/process verification has run."
}
` },
  { path: "suite/run-contract.ts", sha256: "2d25be82dcc4557d5a9a8e22f58c9783e196ea28b4b5144ddd4395c5181bf0e6", body: `import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type PublicApi = {
  sourceFiles(dir?: string): [string, string][];
  fingerprint(files: readonly (readonly [string, string])[]): string;
  claimsFresh(recordHash: string, selfHash: string): boolean;
  mutationSourceIdentity(): string;
};
type Result = { label: string; status: 'pass' | 'semantic-fail' | 'harness-error'; expected: unknown; actual: unknown; fixture?: string; error?: string };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetModule = process.env.CONTRACT_TARGET_MODULE || '/private/tmp/kc-20261024/ci-wallclock/scripts/check/claims.ts';
const runName = process.env.CONTRACT_RUN_NAME || 'baseline';
if (!/^[a-zA-Z0-9_-]+$/.test(runName)) throw new Error('Unsafe run name');
const out = path.join(root, 'runs', runName);
if (existsSync(out)) throw new Error(\`Run already exists: \${out}\`);
mkdirSync(out, { recursive: true });
const expected = JSON.parse(readFileSync(path.join(root, 'sealed', 'expected.json'), 'utf8'));
const cases = JSON.parse(readFileSync(path.join(root, 'sealed', 'cases.json'), 'utf8')) as { label: string; expected: string }[];
const results: Result[] = [];
const identities: Record<string, unknown> = {};
const sourceObservations: Record<string, unknown> = {};
let activeFixture = '';
let api: PublicApi;
let imported = false;
const startUtc = new Date().toISOString();

function hash(buf: Buffer | string): string { return createHash('sha256').update(buf).digest('hex'); }
function filesUnder(dir: string): string[] {
  const result: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const entry = path.join(dir, ent.name);
    if (ent.isDirectory()) result.push(...filesUnder(entry));
    else if (ent.isFile()) result.push(entry);
    else throw new Error(\`Unexpected fixture entry: \${entry}\`);
  }
  return result;
}
function snapshot(dir: string): Record<string, string> {
  return Object.fromEntries(filesUnder(dir).map(p => [path.relative(dir, p).split(path.sep).join('/'), hash(readFileSync(p))]));
}
function check(label: string, actual: unknown, wanted: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(wanted);
  results.push({ label, status: pass ? 'pass' : 'semantic-fail', expected: wanted, actual, fixture: activeFixture || undefined });
}
function wantedSources(paths: string[], changes: Record<string, string> = {}): [string, string][] {
  return paths.map(p => [p, Object.hasOwn(changes, p) ? changes[p] : expected.baseFiles[p]] as [string,string]).sort((a,b) => a[0].localeCompare(b[0]));
}
function observedSources(raw: [string,string][]): [string,string][] {
  if (!Array.isArray(raw)) throw new Error('sourceFiles did not return an array');
  return raw.map(tuple => {
    if (!Array.isArray(tuple) || tuple.length !== 2 || typeof tuple[0] !== 'string' || typeof tuple[1] !== 'string') throw new Error('sourceFiles returned a malformed tuple');
    const rel = path.relative(process.cwd(), path.resolve(process.cwd(), tuple[0])).split(path.sep).join('/');
    if (rel.startsWith('../') || rel === '..' || path.isAbsolute(rel)) throw new Error('Source escaped private fixture');
    return [rel, tuple[1]] as [string,string];
  }).sort((a,b) => a[0].localeCompare(b[0]));
}
function qualify(dir: string): void {
  const actual = filesUnder(dir).map(p => path.relative(dir,p).split(path.sep).join('/')).sort();
  const wanted = Object.keys(expected.baseFiles).sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(\`Fixture tree mismatch at \${dir}\`);
  for (const rel of wanted) if (readFileSync(path.join(dir,rel),'utf8') !== expected.baseFiles[rel]) throw new Error(\`Fixture byte mismatch at \${rel}\`);
}
function fixture(name: string): void {
  activeFixture = name;
  const dir = path.join(out, name);
  cpSync(path.join(root,'template'), dir, { recursive:true });
  qualify(dir);
  sourceObservations[\`\${name}:initial-sha256\`] = snapshot(dir);
  process.chdir(dir);
}
function edit(changes: Record<string,string>): void {
  for (const [rel,body] of Object.entries(changes)) {
    const p = path.join(process.cwd(),rel); mkdirSync(path.dirname(p),{recursive:true}); writeFileSync(p,body);
  }
}
function stage(name: string): void { sourceObservations[\`\${activeFixture}:\${name}-sha256\`] = snapshot(process.cwd()); }
function scenario(name: string, fn: () => void): void {
  try { fixture(name); fn(); }
  catch(error) { results.push({label:\`ERROR_\${name}\`,status:'harness-error',expected:'Public calls complete on a qualified fixture',actual:null,fixture:activeFixture,error:String(error instanceof Error ? error.stack : error)}); }
}

try {
  qualify(path.join(root,'template'));
  const sealed = JSON.parse(readFileSync(path.join(root,'sealed','seal.json'),'utf8'));
  for (const [rel,digest] of Object.entries(sealed.frozenArtifactHashes as Record<string,string>)) {
    if (hash(readFileSync(path.join(root,rel))) !== digest) throw new Error(\`Pre-import frozen artifact changed: \${rel}\`);
  }
  results.push({label:'Q01_fixture_bytes_and_layout',status:'pass',expected:'Exact frozen fixture and runner hashes before import',actual:'Exact frozen fixture and runner hashes before import'});
  writeFileSync(path.join(out,'pre-import-qualification.json'),JSON.stringify({utc:new Date().toISOString(),sealSha256:hash(readFileSync(path.join(root,'sealed','seal.json'))),templateSha256:snapshot(path.join(root,'template')),targetModule},null,2)+'\\n');
  api = await import(pathToFileURL(targetModule).href) as PublicApi;
  imported = true;
  for (const k of ['sourceFiles','fingerprint','claimsFresh','mutationSourceIdentity'] as const) if (typeof api[k] !== 'function') throw new Error(\`Public API missing: \${k}\`);
  scenario('default-and-positives', () => {
    const def = api.sourceFiles(); const explicit = api.sourceFiles('scripts');
    const base = api.fingerprint(def); const mutation = api.mutationSourceIdentity();
    identities['default-and-positives'] = {baseFingerprint:base,baseMutationIdentity:mutation};
    sourceObservations['default-returned'] = observedSources(def);
    sourceObservations['explicit-scripts-returned'] = observedSources(explicit);
    check('P01_same_fingerprint_fresh', api.claimsFresh(base,base), true);
    check('P02_same_mutation_identity', api.mutationSourceIdentity() === mutation, true);
    check('D01_default_membership', observedSources(def), wantedSources(expected.defaultPaths));
    check('D02_explicit_scripts_membership', observedSources(explicit), wantedSources(expected.defaultPaths));
    check('D03_explicit_scripts_fingerprint', api.fingerprint(explicit) === base, true);
  });
  scenario('custom-scope', () => {
    const custom = api.sourceFiles('custom'); const initial = api.fingerprint(custom);
    sourceObservations['custom-returned'] = observedSources(custom);
    check('C01_custom_membership', observedSources(custom), wantedSources(expected.customPaths));
    edit({[expected.changes.workflow.path]:expected.changes.workflow.body}); stage('root-workflow-changed');
    check('C02_custom_workflow_independent', api.fingerprint(api.sourceFiles('custom')) === initial, true);
    edit(expected.changes.customNonTs); stage('custom-non-ts-changed');
    check('C03_custom_non_ts_independent', api.fingerprint(api.sourceFiles('custom')) === initial, true);
  });
  scenario('root-workflow-change', () => {
    const oldHash = api.fingerprint(api.sourceFiles()); const oldMutation = api.mutationSourceIdentity();
    edit({[expected.changes.workflow.path]:expected.changes.workflow.body}); stage('workflow-changed');
    const newHash = api.fingerprint(api.sourceFiles()); const newMutation = api.mutationSourceIdentity();
    identities['root-workflow-change'] = {oldFingerprint:oldHash,newFingerprint:newHash,oldMutationIdentity:oldMutation,newMutationIdentity:newMutation};
    sourceObservations['workflow-changed-returned'] = observedSources(api.sourceFiles());
    check('W01_workflow_fingerprint_changes', newHash !== oldHash, true);
    check('W02_workflow_mutation_identity_changes', newMutation !== oldMutation, true);
    check('W03_old_claims_rejected', api.claimsFresh(oldHash,newHash), false);
    check('W04_current_claims_fresh', api.claimsFresh(newHash,newHash), true);
    check('W05_old_cost_launches_identity_unequal', oldMutation === newMutation, false);
  });
  scenario('other-github-change', () => {
    const oldHash = api.fingerprint(api.sourceFiles()); const oldMutation = api.mutationSourceIdentity();
    edit(expected.changes.otherGithub); stage('other-github-changed');
    const newHash = api.fingerprint(api.sourceFiles()); const newMutation = api.mutationSourceIdentity();
    identities['other-github-change'] = {oldFingerprint:oldHash,newFingerprint:newHash,oldMutationIdentity:oldMutation,newMutationIdentity:newMutation};
    check('G01_other_github_fingerprint_stable', newHash === oldHash, true);
    check('G02_other_github_mutation_identity_stable', newMutation === oldMutation, true);
  });
  scenario('script-change-positive', () => {
    const oldHash = api.fingerprint(api.sourceFiles()); const oldMutation = api.mutationSourceIdentity();
    edit({[expected.changes.script.path]:expected.changes.script.body}); stage('script-changed');
    const newHash = api.fingerprint(api.sourceFiles()); const newMutation = api.mutationSourceIdentity();
    identities['script-change-positive'] = {oldFingerprint:oldHash,newFingerprint:newHash,oldMutationIdentity:oldMutation,newMutationIdentity:newMutation};
    check('S01_script_fingerprint_changes', newHash !== oldHash, true);
    check('S02_script_mutation_identity_changes', newMutation !== oldMutation, true);
    check('S03_old_script_claims_rejected', api.claimsFresh(oldHash,newHash), false);
  });
} catch(error) {
  results.push({label:'ERROR_runner',status:'harness-error',expected:'Valid frozen setup and import',actual:null,error:String(error instanceof Error ? error.stack : error)});
} finally {
  process.chdir(root);
  const observed = new Set(results.map(r => r.label));
  const missing = cases.map(c => c.label).filter(label => !observed.has(label));
  const harnessErrors = results.filter(r => r.status==='harness-error');
  const fixtureValid = results.find(r => r.label==='Q01_fixture_bytes_and_layout')?.status==='pass';
  const positiveLabels = JSON.parse(readFileSync(path.join(root,'sealed','fixture-validity-and-positives.json'),'utf8')).positives as string[];
  const positives = positiveLabels.map(label => ({label,status:results.find(r=>r.label===label)?.status||'missing'}));
  const observationQualified = fixtureValid && imported && harnessErrors.length===0 && missing.length===0 && positives.every(p=>p.status==='pass');
  const report = {runName,startUtc,endUtc:new Date().toISOString(),targetModule,scope:'Four public API calls only; no actual audit, launches or mutation-cost CLI execution.',qualification:{fixtureValid,imported,missing,harnessErrorCount:harnessErrors.length,positives,observationQualified},summary:{pass:results.filter(r=>r.status==='pass').length,semanticFail:results.filter(r=>r.status==='semantic-fail').length,harnessError:harnessErrors.length},results,identities,sourceObservations};
  writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\\n');
  for (const r of results) console.log(\`\${r.status.toUpperCase()} \${r.label}\`);
  console.log(JSON.stringify({qualification:report.qualification,summary:report.summary,resultsPath:path.join(out,'results.json')}));
  process.exitCode = harnessErrors.length || missing.length ? 2 : report.summary.semanticFail ? 1 : 0;
}
` },
  { path: "suite/package.json", sha256: "83927bd2c9dc445a9b1f760c00fd3994087d7d84b38b532526ed364a1715b233", body: `{"name":"wallclock-identity-contract-tests","private":true,"type":"module"}
` },
  { path: "template/.github/README.md", sha256: "489d54570fc5caa4fa758ac7f101138ba6baa529aca7b8b27021d62f2253f331", body: `An unrelated GitHub note.
` },
  { path: "template/.github/helpers/ignored.ts", sha256: "84413684842145cdffd97a986a9a48cbc93488ead2e21151f9231380cb785235", body: `export const unrelatedGitHubInput = 1;
` },
  { path: "template/.github/workflows/check.yml", sha256: "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5", body: `name: check
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - run: echo baseline
` },
  { path: "template/.github/workflows/other.yml", sha256: "33941ffeaaa080ad5c872ecc8798f8232df7e2c4b7577b11a29adea99f902d19", body: `name: other
on: [workflow_dispatch]
jobs:
  idle:
    runs-on: ubuntu-latest
    steps:
      - run: echo other
` },
  { path: "template/custom/.github/workflows/check.yml", sha256: "cca187c3ada12027e527153b116ce30f3da16bb213b4b38673ad31a4f9263fe8", body: `name: custom-non-ts
` },
  { path: "template/custom/nested/deep.ts", sha256: "e1aee713d34976f9e345dd16ec5647d41ff8c4af20cf5ac97ae8eb4cd75f9451", body: `export const customDeep = true;
` },
  { path: "template/custom/notes.txt", sha256: "a62413221ca9d2c5e540f91bacfca1e947b2e0c924c4d480466de61ce04e272c", body: `Custom non-TS neighbor.
` },
  { path: "template/custom/unit.ts", sha256: "ba705f42f25c8408285c79284119e908e432f8ce384403c1b43a4bc8a9fd3b63", body: `export const customUnit = 1;
` },
  { path: "template/mutations.json", sha256: "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9", body: `{"mutations":[]}
` },
  { path: "template/package-lock.json", sha256: "ac15bb277d032075ca784177e3ec36b9b810f8582d58916691ba58b98cac2d65", body: `{"name":"identity-contract-fixture","version":"1.0.0","lockfileVersion":3,"requires":true,"packages":{}}
` },
  { path: "template/package.json", sha256: "22f372439d288cae0488ef6b8e7b43b64ada25df3ac053d8672ed343a18e4278", body: `{"name":"identity-contract-fixture","private":true,"type":"module"}
` },
  { path: "template/scripts/a.ts", sha256: "2f2d8ab6453896290e40a007f1df961cc6004062c86a0a1e6480e8ce201a58aa", body: `export const alpha = 1;
` },
  { path: "template/scripts/check/mutations.json", sha256: "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9", body: `{"mutations":[]}
` },
  { path: "template/scripts/nested/b.ts", sha256: "683d83774fa70e88eea40991a8050c3c5898e9d9e64ddf17715b5c4d20bae93d", body: `export const beta = "base";
` },
  { path: "template/scripts/readme.txt", sha256: "203170ad3f18b00e3dc90462c9e055f5c744c4fae9baa115751e9495a753d412", body: `This non-TS script neighbor is not a program input.
` },
  { path: "supplement/sealed/cases.json", sha256: "2ec495ef33dab05c2ea3fc19472b58232396456f6c8b2848aa7a28afb31c687e", body: `[
  {
    "label": "A01_absent_default_TS_only",
    "expected": "With exact root check.yml absent, default scope is exactly the two script TS files and bodies."
  },
  {
    "label": "A02_absent_explicit_scripts_equivalent",
    "expected": "With exact root check.yml absent, explicit scripts scope matches default paths, bodies and fingerprint."
  },
  {
    "label": "A03_absent_custom_TS_only",
    "expected": "With exact root check.yml absent, custom directory remains exactly its two TS files and bodies."
  },
  {
    "label": "P01_present_claims_same_hash_fresh",
    "expected": "Before deletion, claimsFresh(presentHash,presentHash) is true."
  },
  {
    "label": "P02_present_mutation_stable",
    "expected": "Before deletion, repeated mutationSourceIdentity() is equal."
  },
  {
    "label": "R01_deletion_fingerprint_changes",
    "expected": "Deleting only exact root check.yml changes the default source fingerprint."
  },
  {
    "label": "R02_deletion_old_claims_rejected",
    "expected": "After deletion, claimsFresh(presentHash,absentHash) is false."
  },
  {
    "label": "R03_deletion_old_mutation_identity_unequal",
    "expected": "After deletion, old present-state mutation identity differs from current identity."
  },
  {
    "label": "P03_absent_claims_same_hash_fresh",
    "expected": "After deletion, claimsFresh(absentHash,absentHash) is true."
  },
  {
    "label": "E01_present_unreadable_default_throws",
    "expected": "When exact root check.yml is an existing regular file whose read is independently denied, sourceFiles() throws rather than accepting missing/empty body."
  },
  {
    "label": "E02_present_unreadable_mutation_throws",
    "expected": "On that independently denied-read file, mutationSourceIdentity() throws rather than accepting missing/empty body."
  },
  {
    "label": "P04_readable_default_completes",
    "expected": "On the exact same fixture before denial, sourceFiles() completes."
  },
  {
    "label": "P05_readable_mutation_completes",
    "expected": "On the exact same fixture before denial, mutationSourceIdentity() completes."
  }
]
` },
  { path: "supplement/sealed/expected.json", sha256: "f0daa90876a5f6f75b367611e7439b548b09f3ac6e693e0ff74c3a30965f36d9", body: `{
  "publicSupplementDesign": "Default project scope conditionally includes the exact root .github/workflows/check.yml only when present, using its real bytes. Absent workflow remains compatible with TS-only toy projects. Deleting a previously present workflow invalidates claims and mutation source identity. Existing unreadable workflow errors must propagate. Custom directory traversal remains TS-only.",
  "baseFiles": {
    "scripts/a.ts": "export const alpha = 1;\\n",
    "scripts/nested/b.ts": "export const beta = \\"base\\";\\n",
    "scripts/readme.txt": "This non-TS script neighbor is not a program input.\\n",
    ".github/workflows/check.yml": "name: check\\non: [push]\\njobs:\\n  verify:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: echo baseline\\n",
    ".github/workflows/other.yml": "name: other\\non: [workflow_dispatch]\\njobs:\\n  idle:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: echo other\\n",
    ".github/README.md": "An unrelated GitHub note.\\n",
    ".github/helpers/ignored.ts": "export const unrelatedGitHubInput = 1;\\n",
    "custom/unit.ts": "export const customUnit = 1;\\n",
    "custom/nested/deep.ts": "export const customDeep = true;\\n",
    "custom/notes.txt": "Custom non-TS neighbor.\\n",
    "custom/.github/workflows/check.yml": "name: custom-non-ts\\n",
    "mutations.json": "{\\"mutations\\":[]}\\n",
    "package-lock.json": "{\\"name\\":\\"identity-contract-fixture\\",\\"version\\":\\"1.0.0\\",\\"lockfileVersion\\":3,\\"requires\\":true,\\"packages\\":{}}\\n",
    "package.json": "{\\"name\\":\\"identity-contract-fixture\\",\\"private\\":true,\\"type\\":\\"module\\"}\\n",
    "scripts/check/mutations.json": "{\\"mutations\\":[]}\\n"
  },
  "workflowPath": ".github/workflows/check.yml",
  "scriptPaths": [
    "scripts/a.ts",
    "scripts/nested/b.ts"
  ],
  "customPaths": [
    "custom/nested/deep.ts",
    "custom/unit.ts"
  ],
  "handDerivedRelations": [
    "Absent default = scripts TS only; explicit scripts equals default; absent custom remains custom TS only.",
    "Existence-to-absence changes path/body source set, so fingerprint(present) != fingerprint(absent).",
    "claimsFresh(present,present) and claimsFresh(absent,absent) are true; claimsFresh(present,absent) is false.",
    "Same-state mutation identities are equal; old present mutation identity != current absent identity.",
    "Independent permission denial on an existing regular exact check.yml requires public identity calls to throw; no fallback empty body."
  ],
  "algorithmConstants": "None; no target output used to derive expected values.",
  "originalPackageManifestSha256": "c231d072211a75738effbddc18502b62494753034387579c740d4559861ef1e2"
}
` },
  { path: "supplement/sealed/fixture-validity-and-positives.json", sha256: "b4ce1d2b068016820b7738add1b912b37bef134bb04c6648ecef875e64c92d33", body: `{
  "pre-importQualification": "Exact frozen fixture bytes; existing regular read-denied file permission capability independently verified before supplement target execution. Runtime repeats denial qualification on the same fixture.",
  "positives": [
    "P01_present_claims_same_hash_fresh",
    "P02_present_mutation_stable",
    "P03_absent_claims_same_hash_fresh",
    "P04_readable_default_completes",
    "P05_readable_mutation_completes"
  ],
  "errorClassification": "Private setup errors or an unavailable permission-denial capability are harness errors; target exceptions on qualified absence fixtures are observed semantic failures of compatibility. Read-denial cases require EACCES or EPERM from public calls.",
  "scope": "No target imports/calls have been made since this supplemental public design was received. Original 19 labels and expectations remain untouched."
}
` },
  { path: "supplement/suite/run-supplement.ts", sha256: "ee0056654bd0fd30d1726e1a5bb1caa6b05f480af21831ff7504b7a00fd0d0c3", body: `import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Api = { sourceFiles(dir?: string): [string,string][]; fingerprint(files: readonly (readonly [string,string])[]): string; claimsFresh(a:string,b:string):boolean; mutationSourceIdentity():string };
type Obs<T> = {kind:'return';value:T} | {kind:'throw';code:string|null;error:string};
type Result = {label:string;status:'pass'|'semantic-fail'|'harness-error';actual:unknown;expected:unknown};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const originalRoot=path.dirname(root);
const targetModule=process.env.CONTRACT_TARGET_MODULE||'/private/tmp/kc-20261024/ci-wallclock/scripts/check/claims.ts';
const runName=process.env.CONTRACT_RUN_NAME||'fixed-supplement';
if(!/^[a-zA-Z0-9_-]+$/.test(runName))throw new Error('Unsafe run name');
const out=path.join(root,'runs',runName);
if(existsSync(out))throw new Error(\`Run exists: \${out}\`);
mkdirSync(out,{recursive:true});
const expected=JSON.parse(readFileSync(path.join(root,'sealed/expected.json'),'utf8'));
const cases=JSON.parse(readFileSync(path.join(root,'sealed/cases.json'),'utf8')) as {label:string;expected:string}[];
const startUtc=new Date().toISOString();
const results:Result[]=[];
const observations:Record<string,unknown>={};
const qualification:Record<string,unknown>={};
let api:Api;
let imported=false;
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function tree(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?tree(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:(()=>{throw new Error('Unexpected fixture type')})());}
function snapshot(dir:string){return Object.fromEntries(tree(dir).map(p=>[path.relative(dir,p).split(path.sep).join('/'),sha(readFileSync(p))]));}
function fixture(name:string){const dir=path.join(out,name);cpSync(path.join(root,'template'),dir,{recursive:true});
 const files=Object.keys(expected.baseFiles).sort();const actual=tree(dir).map(p=>path.relative(dir,p).split(path.sep).join('/')).sort();
 if(JSON.stringify(files)!==JSON.stringify(actual))throw new Error('Fixture tree mismatch');
 for(const rel of files)if(readFileSync(path.join(dir,rel),'utf8')!==expected.baseFiles[rel])throw new Error(\`Fixture bytes differ \${rel}\`);
 observations[\`\${name}:initial-sha256\`]=snapshot(dir);process.chdir(dir);return dir;}
function call<T>(fn:()=>T):Obs<T>{try{return {kind:'return',value:fn()};}catch(e){return {kind:'throw',code:typeof e==='object'&&e!==null&&'code'in e?String(e.code):null,error:String(e)};}}
function check(label:string,actual:unknown,wanted:unknown){results.push({label,status:JSON.stringify(actual)===JSON.stringify(wanted)?'pass':'semantic-fail',actual,expected:wanted});}
function sources(dir?:string):Obs<[string,string][]> {return call(()=>api.sourceFiles(dir).map(([p,b])=>[path.relative(process.cwd(),path.resolve(process.cwd(),p)).split(path.sep).join('/'),b] as [string,string]).sort((a,b)=>a[0].localeCompare(b[0])));}
function wanted(paths:string[]):Obs<[string,string][]> {return {kind:'return',value:paths.map(p=>[p,expected.baseFiles[p]] as [string,string]).sort((a,b)=>a[0].localeCompare(b[0]))};}
function hash(dir?:string):Obs<string>{return call(()=>api.fingerprint(api.sourceFiles(dir)));}
function relation(label:string,a:Obs<string>,b:Obs<string>,equals:boolean){check(label,a.kind==='return'&&b.kind==='return'?{kind:'return',value:a.value===b.value}:{kind:'upstream-error',a,b},{kind:'return',value:equals});}
function freshness(label:string,a:Obs<string>,b:Obs<string>,fresh:boolean){check(label,a.kind==='return'&&b.kind==='return'?call(()=>api.claimsFresh(a.value,b.value)):{kind:'upstream-error',a,b},{kind:'return',value:fresh});}
function scenario(name:string,fn:()=>void){try{fixture(name);fn();}catch(e){results.push({label:\`ERROR_\${name}\`,status:'harness-error',actual:String(e),expected:'Qualified fixture and harness operations complete'});}}
try{
 const seal=JSON.parse(readFileSync(path.join(root,'sealed/seal.json'),'utf8'));
 for(const [rel,digest] of Object.entries(seal.frozenArtifactHashes))if(sha(readFileSync(path.join(root,rel)))!==digest)throw new Error(\`Supplement freeze changed: \${rel}\`);
 if(sha(readFileSync(path.join(originalRoot,'manifest.json')))!==expected.originalPackageManifestSha256)throw new Error('Original manifest changed');
 const prior=JSON.parse(readFileSync(path.join(originalRoot,'manifest.json'),'utf8'));
 for(const [rel,value]of Object.entries(prior.files) as [string,{sha256:string}][])if(sha(readFileSync(path.join(originalRoot,rel)))!==value.sha256)throw new Error(\`Original artifact changed: \${rel}\`);
 qualification.frozenHashesValid=true;qualification.originalArtifactCount=Object.keys(prior.files).length;qualification.originalArtifactsUnchanged=true;
 writeFileSync(path.join(out,'pre-import-qualification.json'),JSON.stringify({utc:new Date().toISOString(),qualification,sealSha256:sha(readFileSync(path.join(root,'sealed/seal.json'))),targetModule},null,2)+'\\n');
 api=await import(pathToFileURL(targetModule).href)as Api;imported=true;
 scenario('absent-workflow',()=>{
  rmSync(expected.workflowPath);observations['absent-workflow:deleted-sha256']=snapshot(process.cwd());
  const def=sources();const explicit=sources('scripts');const custom=sources('custom');const h=hash();const e=hash('scripts');
  check('A01_absent_default_TS_only',def,wanted(expected.scriptPaths));
  check('A02_absent_explicit_scripts_equivalent',{sources:explicit,hashEqual:h.kind==='return'&&e.kind==='return'?h.value===e.value:{h,e}},{sources:wanted(expected.scriptPaths),hashEqual:true});
  check('A03_absent_custom_TS_only',custom,wanted(expected.customPaths));
  observations['absent-workflow:source-results']={def,explicit,custom};
 });
 scenario('delete-existing-workflow',()=>{
  const present=hash();const presentMutation=call(()=>api.mutationSourceIdentity());
  freshness('P01_present_claims_same_hash_fresh',present,present,true);
  relation('P02_present_mutation_stable',presentMutation,call(()=>api.mutationSourceIdentity()),true);
  rmSync(expected.workflowPath);observations['delete-existing-workflow:deleted-sha256']=snapshot(process.cwd());
  const absent=hash();const absentMutation=call(()=>api.mutationSourceIdentity());
  observations['deletion-identities']={present,absent,presentMutation,absentMutation};
  relation('R01_deletion_fingerprint_changes',present,absent,false);
  freshness('R02_deletion_old_claims_rejected',present,absent,false);
  relation('R03_deletion_old_mutation_identity_unequal',presentMutation,absentMutation,false);
  freshness('P03_absent_claims_same_hash_fresh',absent,absent,true);
 });
 scenario('existing-unreadable-workflow',()=>{
  const workflow=path.resolve(expected.workflowPath);const beforeHash=sha(readFileSync(workflow));
  const readableSources=call(()=>api.sourceFiles());const readableMutation=call(()=>api.mutationSourceIdentity());
  check('P04_readable_default_completes',readableSources.kind,'return');
  check('P05_readable_mutation_completes',readableMutation.kind,'return');
  const mode=statSync(workflow).mode&0o777;
  try{
   chmodSync(workflow,0);
   const independentRead=call(()=>readFileSync(workflow));
   const denied=independentRead.kind==='throw'&&['EACCES','EPERM'].includes(independentRead.code||'');
   qualification.deniedRead={utc:new Date().toISOString(),existingRegularFile:statSync(workflow).isFile(),sha256BeforeDenial:beforeHash,modeDuringRead:'000',independentRead,denied};
   if(!denied)throw new Error('Unreadable-file fixture is not independently denied; denied-read assertions cannot qualify');
   const def=call(()=>api.sourceFiles());const mutation=call(()=>api.mutationSourceIdentity());
   observations['denied-read-public-results']={def,mutation};
   check('E01_present_unreadable_default_throws',def.kind==='throw'&&['EACCES','EPERM'].includes(def.code||''),true);
   check('E02_present_unreadable_mutation_throws',mutation.kind==='throw'&&['EACCES','EPERM'].includes(mutation.code||''),true);
  }finally{chmodSync(workflow,mode);observations['existing-unreadable-workflow:restored-sha256']=snapshot(process.cwd());qualification.deniedReadBytesPreserved=sha(readFileSync(workflow))===beforeHash;}
 });
}catch(e){results.push({label:'ERROR_runner',status:'harness-error',actual:String(e),expected:'Frozen setup and target import complete'});}
finally{
 process.chdir(root);
 const missing=cases.map(c=>c.label).filter(l=>!results.some(r=>r.label===l));
 const positiveLabels=['P01_present_claims_same_hash_fresh','P02_present_mutation_stable','P03_absent_claims_same_hash_fresh','P04_readable_default_completes','P05_readable_mutation_completes'];
 const positives=positiveLabels.map(label=>({label,status:results.find(r=>r.label===label)?.status||'missing'}));
 const harnessErrors=results.filter(r=>r.status==='harness-error').length;
 const summary={pass:results.filter(r=>r.status==='pass').length,semanticFail:results.filter(r=>r.status==='semantic-fail').length,harnessError:harnessErrors};
 const report={runName,startUtc,endUtc:new Date().toISOString(),targetModule,scope:'Supplemental public interface calls only; no complete audit/launches CLI run.',qualification:{...qualification,imported,missing,positives,observationQualified:imported&&harnessErrors===0&&missing.length===0&&positives.every(p=>p.status==='pass')},summary,results,observations};
 writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\\n');
 for(const r of results)console.log(\`\${r.status.toUpperCase()} \${r.label}\`);
 console.log(JSON.stringify({summary,qualification:report.qualification,resultsPath:path.join(out,'results.json')}));
 process.exitCode=harnessErrors||missing.length?2:summary.semanticFail?1:0;
}
` },
  { path: "supplement/suite/package.json", sha256: "064c35561d7a7aff612198a6d0edfda67c7b50e3ab7b4cd11732436c9e5a5fa8", body: `{"name":"wallclock-identity-absence-supplement","private":true,"type":"module"}
` },
  { path: "supplement/template/.github/README.md", sha256: "489d54570fc5caa4fa758ac7f101138ba6baa529aca7b8b27021d62f2253f331", body: `An unrelated GitHub note.
` },
  { path: "supplement/template/.github/helpers/ignored.ts", sha256: "84413684842145cdffd97a986a9a48cbc93488ead2e21151f9231380cb785235", body: `export const unrelatedGitHubInput = 1;
` },
  { path: "supplement/template/.github/workflows/check.yml", sha256: "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5", body: `name: check
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - run: echo baseline
` },
  { path: "supplement/template/.github/workflows/other.yml", sha256: "33941ffeaaa080ad5c872ecc8798f8232df7e2c4b7577b11a29adea99f902d19", body: `name: other
on: [workflow_dispatch]
jobs:
  idle:
    runs-on: ubuntu-latest
    steps:
      - run: echo other
` },
  { path: "supplement/template/custom/.github/workflows/check.yml", sha256: "cca187c3ada12027e527153b116ce30f3da16bb213b4b38673ad31a4f9263fe8", body: `name: custom-non-ts
` },
  { path: "supplement/template/custom/nested/deep.ts", sha256: "e1aee713d34976f9e345dd16ec5647d41ff8c4af20cf5ac97ae8eb4cd75f9451", body: `export const customDeep = true;
` },
  { path: "supplement/template/custom/notes.txt", sha256: "a62413221ca9d2c5e540f91bacfca1e947b2e0c924c4d480466de61ce04e272c", body: `Custom non-TS neighbor.
` },
  { path: "supplement/template/custom/unit.ts", sha256: "ba705f42f25c8408285c79284119e908e432f8ce384403c1b43a4bc8a9fd3b63", body: `export const customUnit = 1;
` },
  { path: "supplement/template/mutations.json", sha256: "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9", body: `{"mutations":[]}
` },
  { path: "supplement/template/package-lock.json", sha256: "ac15bb277d032075ca784177e3ec36b9b810f8582d58916691ba58b98cac2d65", body: `{"name":"identity-contract-fixture","version":"1.0.0","lockfileVersion":3,"requires":true,"packages":{}}
` },
  { path: "supplement/template/package.json", sha256: "22f372439d288cae0488ef6b8e7b43b64ada25df3ac053d8672ed343a18e4278", body: `{"name":"identity-contract-fixture","private":true,"type":"module"}
` },
  { path: "supplement/template/scripts/a.ts", sha256: "2f2d8ab6453896290e40a007f1df961cc6004062c86a0a1e6480e8ce201a58aa", body: `export const alpha = 1;
` },
  { path: "supplement/template/scripts/check/mutations.json", sha256: "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9", body: `{"mutations":[]}
` },
  { path: "supplement/template/scripts/nested/b.ts", sha256: "683d83774fa70e88eea40991a8050c3c5898e9d9e64ddf17715b5c4d20bae93d", body: `export const beta = "base";
` },
  { path: "supplement/template/scripts/readme.txt", sha256: "203170ad3f18b00e3dc90462c9e055f5c744c4fae9baa115751e9495a753d412", body: `This non-TS script neighbor is not a program input.
` },
  { path: "parent-read-denial/sealed/cases.json", sha256: "b46ff8fc2c0a6e39550adbaa2495f1aac96dd2b0569e2987bf2e32229ab3a8a7", body: `[
  {
    "label": "Q01_nonroot_independent_parent_read_calibration",
    "expected": "Preflight EACCES is valid for both parent denial fixtures under a nonroot UID and independent restore succeeds."
  },
  {
    "label": "A01_genuine_absence_default_TS_only",
    "expected": "default source tuples are exactly scripts TS when only exact root workflow is absent."
  },
  {
    "label": "A02_genuine_absence_explicit_scripts_equivalent",
    "expected": "explicit scripts tuples match default TS-only scope and its fingerprint."
  },
  {
    "label": "A03_genuine_absence_mutation_identity_stable",
    "expected": "mutation identity returns a string and repeats equally under genuine absence."
  },
  {
    "label": "A04_genuine_absence_current_claims_fresh",
    "expected": "claimsFresh(absentHash,absentHash) is true."
  },
  {
    "label": "A05_genuine_absence_custom_TS_only",
    "expected": "custom scope remains exactly its own TS tuples."
  },
  {
    "label": "W_B01_readable_before_positives",
    "expected": "workflows-parent: Before permission denial, exact default/explicit sources, current same-hash claims and stable mutation identity all pass."
  },
  {
    "label": "W_D01_default_propagates_EACCES",
    "expected": "workflows-parent: default sourceFiles throws actual EACCES under independently qualified parent denial."
  },
  {
    "label": "W_D02_explicit_scripts_propagates_EACCES",
    "expected": "workflows-parent: sourceFiles(\\"scripts\\") throws actual EACCES under independently qualified parent denial."
  },
  {
    "label": "W_D03_mutation_identity_propagates_EACCES",
    "expected": "workflows-parent: mutationSourceIdentity throws actual EACCES under independently qualified parent denial."
  },
  {
    "label": "W_D04_custom_scope_unaffected",
    "expected": "workflows-parent: custom tuples and fingerprint remain equal while project YAML parent is denied."
  },
  {
    "label": "W_R01_restored_public_positives",
    "expected": "workflows-parent: After permission restoration, source tuples and fingerprints, mutation identity and fresh claims equal their pre-denial state."
  },
  {
    "label": "H_B01_readable_before_positives",
    "expected": "github-parent: Before permission denial, exact default/explicit sources, current same-hash claims and stable mutation identity all pass."
  },
  {
    "label": "H_D01_default_propagates_EACCES",
    "expected": "github-parent: default sourceFiles throws actual EACCES under independently qualified parent denial."
  },
  {
    "label": "H_D02_explicit_scripts_propagates_EACCES",
    "expected": "github-parent: sourceFiles(\\"scripts\\") throws actual EACCES under independently qualified parent denial."
  },
  {
    "label": "H_D03_mutation_identity_propagates_EACCES",
    "expected": "github-parent: mutationSourceIdentity throws actual EACCES under independently qualified parent denial."
  },
  {
    "label": "H_D04_custom_scope_unaffected",
    "expected": "github-parent: custom tuples and fingerprint remain equal while project YAML parent is denied."
  },
  {
    "label": "H_R01_restored_public_positives",
    "expected": "github-parent: After permission restoration, source tuples and fingerprints, mutation identity and fresh claims equal their pre-denial state."
  }
]
` },
  { path: "parent-read-denial/sealed/expected.json", sha256: "a31f8cc7c812c4cb47b335750562d16564f377b7c5c15ebfd2a4efe006223123", body: `{
  "publicDesign": "Only genuine ENOENT is absence. Existing exact project check.yml with either workflows or .github parent lacking traversal permission must cause default sourceFiles(), explicit sourceFiles(\\"scripts\\"), and mutationSourceIdentity() to propagate actual read EACCES. Custom traversal remains TS-only. True absence and full restoration are positive controls.",
  "workflowPath": ".github/workflows/check.yml",
  "baseFiles": {
    "scripts/a.ts": "export const alpha = 1;\\n",
    "scripts/nested/b.ts": "export const beta = \\"base\\";\\n",
    "scripts/readme.txt": "This non-TS script neighbor is not a program input.\\n",
    ".github/workflows/check.yml": "name: check\\non: [push]\\njobs:\\n  verify:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: echo baseline\\n",
    ".github/workflows/other.yml": "name: other\\non: [workflow_dispatch]\\njobs:\\n  idle:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: echo other\\n",
    ".github/README.md": "An unrelated GitHub note.\\n",
    ".github/helpers/ignored.ts": "export const unrelatedGitHubInput = 1;\\n",
    "custom/unit.ts": "export const customUnit = 1;\\n",
    "custom/nested/deep.ts": "export const customDeep = true;\\n",
    "custom/notes.txt": "Custom non-TS neighbor.\\n",
    "custom/.github/workflows/check.yml": "name: custom-non-ts\\n",
    "mutations.json": "{\\"mutations\\":[]}\\n",
    "package-lock.json": "{\\"name\\":\\"identity-contract-fixture\\",\\"version\\":\\"1.0.0\\",\\"lockfileVersion\\":3,\\"requires\\":true,\\"packages\\":{}}\\n",
    "package.json": "{\\"name\\":\\"identity-contract-fixture\\",\\"private\\":true,\\"type\\":\\"module\\"}\\n",
    "scripts/check/mutations.json": "{\\"mutations\\":[]}\\n"
  },
  "defaultPaths": [
    ".github/workflows/check.yml",
    "scripts/a.ts",
    "scripts/nested/b.ts"
  ],
  "scriptPaths": [
    "scripts/a.ts",
    "scripts/nested/b.ts"
  ],
  "customPaths": [
    "custom/nested/deep.ts",
    "custom/unit.ts"
  ],
  "denials": [
    {
      "name": "workflows-parent",
      "prefix": "W",
      "parentPath": ".github/workflows"
    },
    {
      "name": "github-parent",
      "prefix": "H",
      "parentPath": ".github"
    }
  ],
  "directoryDeniedMode": 384,
  "handDerivedRelations": [
    "Two controlled edits remove only execute/traversal permission on the respective parent directory; the workflow remains the same readable-mode regular file with the same inode and bytes.",
    "Independent readFileSync by path must produce EACCES for both denials under nonroot UID; otherwise the case is invalid and is not semantic red.",
    "All three project identity public calls must throw EACCES; custom source tuples and fingerprint remain identical.",
    "Removing only check.yml while both parent directories are traversable is genuine absence: default/explicit scripts are TS-only, mutation identity completes stably, self claims are fresh, custom remains TS-only.",
    "After finally restoring original directory permissions, independent readFileSync succeeds, file path/dev/ino/bytes/file-mode and both parent modes match initial values, default/explicit identity and mutation identity equal their pre-denial identities, and those claims are fresh."
  ],
  "algorithmConstants": "None. Equality, source membership and genuine exception-code relationships only.",
  "expectedOrigin": "New public PARENT-READ-ADMISSION only; no target output, function body, repo test or negative raw inspected."
}
` },
  { path: "parent-read-denial/sealed/permission-preflight.json", sha256: "1b16ff17fa372b850b81264e40412f3a780fac97ab43757b0ee205bfa15274a6", body: `{
  "utc": "2026-10-24T15:24:29.555Z",
  "scope": "Independent own-fixture filesystem calibration only; no target import or target public calls.",
  "uid": 501,
  "allValid": true,
  "records": [
    {
      "initialSha256": {
        ".github/helpers/ignored.ts": "84413684842145cdffd97a986a9a48cbc93488ead2e21151f9231380cb785235",
        ".github/README.md": "489d54570fc5caa4fa758ac7f101138ba6baa529aca7b8b27021d62f2253f331",
        ".github/workflows/check.yml": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        ".github/workflows/other.yml": "33941ffeaaa080ad5c872ecc8798f8232df7e2c4b7577b11a29adea99f902d19",
        "custom/.github/workflows/check.yml": "cca187c3ada12027e527153b116ce30f3da16bb213b4b38673ad31a4f9263fe8",
        "custom/nested/deep.ts": "e1aee713d34976f9e345dd16ec5647d41ff8c4af20cf5ac97ae8eb4cd75f9451",
        "custom/notes.txt": "a62413221ca9d2c5e540f91bacfca1e947b2e0c924c4d480466de61ce04e272c",
        "custom/unit.ts": "ba705f42f25c8408285c79284119e908e432f8ce384403c1b43a4bc8a9fd3b63",
        "mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "package-lock.json": "ac15bb277d032075ca784177e3ec36b9b810f8582d58916691ba58b98cac2d65",
        "package.json": "22f372439d288cae0488ef6b8e7b43b64ada25df3ac053d8672ed343a18e4278",
        "scripts/a.ts": "2f2d8ab6453896290e40a007f1df961cc6004062c86a0a1e6480e8ce201a58aa",
        "scripts/check/mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "scripts/nested/b.ts": "683d83774fa70e88eea40991a8050c3c5898e9d9e64ddf17715b5c4d20bae93d",
        "scripts/readme.txt": "203170ad3f18b00e3dc90462c9e055f5c744c4fae9baa115751e9495a753d412"
      },
      "evidence": {
        "name": "workflows-parent",
        "uid": 501,
        "workflowPath": "/private/tmp/kc-20261024/wallclock-identity-contract-tests-artifacts/parent-read-denial/qualification/preflight-W/.github/workflows/check.yml",
        "deniedParent": "/private/tmp/kc-20261024/wallclock-identity-contract-tests-artifacts/parent-read-denial/qualification/preflight-W/.github/workflows",
        "utcBefore": "2026-10-24T15:24:29.548Z",
        "beforeFile": {
          "dev": 16777233,
          "ino": 262282871,
          "size": 104,
          "mode": 420,
          "regular": true
        },
        "beforeSha256": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        "beforeParentModes": {
          "github": 493,
          "workflows": 493
        },
        "deniedDirectoryMode": 384,
        "fileDuringDenial": {
          "dev": 16777233,
          "ino": 262282871,
          "size": 104,
          "mode": 420,
          "regular": true
        },
        "fdSha256DuringDenial": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        "independentPathRead": {
          "kind": "throw",
          "code": "EACCES",
          "error": "Error: EACCES: permission denied, open '/private/tmp/kc-20261024/wallclock-identity-contract-tests-artifacts/parent-read-denial/qualification/preflight-W/.github/workflows/check.yml'"
        },
        "calibrated": true,
        "restoredFile": {
          "dev": 16777233,
          "ino": 262282871,
          "size": 104,
          "mode": 420,
          "regular": true
        },
        "restoredSha256": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        "restoredParentModes": {
          "github": 493,
          "workflows": 493
        },
        "restoredIndependentRead": true,
        "restoredIntegrity": true,
        "utcAfter": "2026-10-24T15:24:29.548Z",
        "setupError": null,
        "restorationError": null,
        "valid": true
      },
      "restoredSha256": {
        ".github/helpers/ignored.ts": "84413684842145cdffd97a986a9a48cbc93488ead2e21151f9231380cb785235",
        ".github/README.md": "489d54570fc5caa4fa758ac7f101138ba6baa529aca7b8b27021d62f2253f331",
        ".github/workflows/check.yml": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        ".github/workflows/other.yml": "33941ffeaaa080ad5c872ecc8798f8232df7e2c4b7577b11a29adea99f902d19",
        "custom/.github/workflows/check.yml": "cca187c3ada12027e527153b116ce30f3da16bb213b4b38673ad31a4f9263fe8",
        "custom/nested/deep.ts": "e1aee713d34976f9e345dd16ec5647d41ff8c4af20cf5ac97ae8eb4cd75f9451",
        "custom/notes.txt": "a62413221ca9d2c5e540f91bacfca1e947b2e0c924c4d480466de61ce04e272c",
        "custom/unit.ts": "ba705f42f25c8408285c79284119e908e432f8ce384403c1b43a4bc8a9fd3b63",
        "mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "package-lock.json": "ac15bb277d032075ca784177e3ec36b9b810f8582d58916691ba58b98cac2d65",
        "package.json": "22f372439d288cae0488ef6b8e7b43b64ada25df3ac053d8672ed343a18e4278",
        "scripts/a.ts": "2f2d8ab6453896290e40a007f1df961cc6004062c86a0a1e6480e8ce201a58aa",
        "scripts/check/mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "scripts/nested/b.ts": "683d83774fa70e88eea40991a8050c3c5898e9d9e64ddf17715b5c4d20bae93d",
        "scripts/readme.txt": "203170ad3f18b00e3dc90462c9e055f5c744c4fae9baa115751e9495a753d412"
      }
    },
    {
      "initialSha256": {
        ".github/helpers/ignored.ts": "84413684842145cdffd97a986a9a48cbc93488ead2e21151f9231380cb785235",
        ".github/README.md": "489d54570fc5caa4fa758ac7f101138ba6baa529aca7b8b27021d62f2253f331",
        ".github/workflows/check.yml": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        ".github/workflows/other.yml": "33941ffeaaa080ad5c872ecc8798f8232df7e2c4b7577b11a29adea99f902d19",
        "custom/.github/workflows/check.yml": "cca187c3ada12027e527153b116ce30f3da16bb213b4b38673ad31a4f9263fe8",
        "custom/nested/deep.ts": "e1aee713d34976f9e345dd16ec5647d41ff8c4af20cf5ac97ae8eb4cd75f9451",
        "custom/notes.txt": "a62413221ca9d2c5e540f91bacfca1e947b2e0c924c4d480466de61ce04e272c",
        "custom/unit.ts": "ba705f42f25c8408285c79284119e908e432f8ce384403c1b43a4bc8a9fd3b63",
        "mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "package-lock.json": "ac15bb277d032075ca784177e3ec36b9b810f8582d58916691ba58b98cac2d65",
        "package.json": "22f372439d288cae0488ef6b8e7b43b64ada25df3ac053d8672ed343a18e4278",
        "scripts/a.ts": "2f2d8ab6453896290e40a007f1df961cc6004062c86a0a1e6480e8ce201a58aa",
        "scripts/check/mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "scripts/nested/b.ts": "683d83774fa70e88eea40991a8050c3c5898e9d9e64ddf17715b5c4d20bae93d",
        "scripts/readme.txt": "203170ad3f18b00e3dc90462c9e055f5c744c4fae9baa115751e9495a753d412"
      },
      "evidence": {
        "name": "github-parent",
        "uid": 501,
        "workflowPath": "/private/tmp/kc-20261024/wallclock-identity-contract-tests-artifacts/parent-read-denial/qualification/preflight-H/.github/workflows/check.yml",
        "deniedParent": "/private/tmp/kc-20261024/wallclock-identity-contract-tests-artifacts/parent-read-denial/qualification/preflight-H/.github",
        "utcBefore": "2026-10-24T15:24:29.554Z",
        "beforeFile": {
          "dev": 16777233,
          "ino": 262282897,
          "size": 104,
          "mode": 420,
          "regular": true
        },
        "beforeSha256": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        "beforeParentModes": {
          "github": 493,
          "workflows": 493
        },
        "deniedDirectoryMode": 384,
        "fileDuringDenial": {
          "dev": 16777233,
          "ino": 262282897,
          "size": 104,
          "mode": 420,
          "regular": true
        },
        "fdSha256DuringDenial": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        "independentPathRead": {
          "kind": "throw",
          "code": "EACCES",
          "error": "Error: EACCES: permission denied, open '/private/tmp/kc-20261024/wallclock-identity-contract-tests-artifacts/parent-read-denial/qualification/preflight-H/.github/workflows/check.yml'"
        },
        "calibrated": true,
        "restoredFile": {
          "dev": 16777233,
          "ino": 262282897,
          "size": 104,
          "mode": 420,
          "regular": true
        },
        "restoredSha256": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        "restoredParentModes": {
          "github": 493,
          "workflows": 493
        },
        "restoredIndependentRead": true,
        "restoredIntegrity": true,
        "utcAfter": "2026-10-24T15:24:29.554Z",
        "setupError": null,
        "restorationError": null,
        "valid": true
      },
      "restoredSha256": {
        ".github/helpers/ignored.ts": "84413684842145cdffd97a986a9a48cbc93488ead2e21151f9231380cb785235",
        ".github/README.md": "489d54570fc5caa4fa758ac7f101138ba6baa529aca7b8b27021d62f2253f331",
        ".github/workflows/check.yml": "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5",
        ".github/workflows/other.yml": "33941ffeaaa080ad5c872ecc8798f8232df7e2c4b7577b11a29adea99f902d19",
        "custom/.github/workflows/check.yml": "cca187c3ada12027e527153b116ce30f3da16bb213b4b38673ad31a4f9263fe8",
        "custom/nested/deep.ts": "e1aee713d34976f9e345dd16ec5647d41ff8c4af20cf5ac97ae8eb4cd75f9451",
        "custom/notes.txt": "a62413221ca9d2c5e540f91bacfca1e947b2e0c924c4d480466de61ce04e272c",
        "custom/unit.ts": "ba705f42f25c8408285c79284119e908e432f8ce384403c1b43a4bc8a9fd3b63",
        "mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "package-lock.json": "ac15bb277d032075ca784177e3ec36b9b810f8582d58916691ba58b98cac2d65",
        "package.json": "22f372439d288cae0488ef6b8e7b43b64ada25df3ac053d8672ed343a18e4278",
        "scripts/a.ts": "2f2d8ab6453896290e40a007f1df961cc6004062c86a0a1e6480e8ce201a58aa",
        "scripts/check/mutations.json": "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9",
        "scripts/nested/b.ts": "683d83774fa70e88eea40991a8050c3c5898e9d9e64ddf17715b5c4d20bae93d",
        "scripts/readme.txt": "203170ad3f18b00e3dc90462c9e055f5c744c4fae9baa115751e9495a753d412"
      }
    }
  ]
}
` },
  { path: "parent-read-denial/suite/run-parent-read.mjs", sha256: "fa59f3c6d77c109b0f71fed9c9cac944b88ee5a9a5720b725e0100ed5f1b76c3", body: `import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyQualified, observe, sha, snapshot, withParentDenied } from './fixture-helpers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const runName=process.env.CONTRACT_RUN_NAME||'baseline-parent-read';if(!/^[a-zA-Z0-9_-]+$/.test(runName))throw new Error('Unsafe run name');const out=path.join(root,'runs',runName);if(existsSync(out))throw new Error('Run already exists');mkdirSync(out,{recursive:true});
const targetModule=process.env.CONTRACT_TARGET_MODULE||'/private/tmp/kc-20261024/ci-wallclock/scripts/check/claims.ts';const expected=JSON.parse(readFileSync(path.join(root,'sealed/expected.json'),'utf8'));const cases=JSON.parse(readFileSync(path.join(root,'sealed/cases.json'),'utf8'));const results=[];const observations={};const qualifications={};const startUtc=new Date().toISOString();let api;let imported=false;
function check(label,actual,wanted){results.push({label,status:JSON.stringify(actual)===JSON.stringify(wanted)?'pass':'semantic-fail',actual,expected:wanted});}
function wanted(paths){return {kind:'return',value:paths.map(p=>[p,expected.baseFiles[p]]).sort((a,b)=>a[0].localeCompare(b[0]))};}
function sources(dir){return observe(()=>api.sourceFiles(dir).map(([p,b])=>[path.relative(process.cwd(),path.resolve(process.cwd(),p)).split(path.sep).join('/'),b]).sort((a,b)=>a[0].localeCompare(b[0])));}
function fingerprint(dir){return observe(()=>api.fingerprint(api.sourceFiles(dir)));}
function equal(a,b){return a.kind==='return'&&b.kind==='return'&&typeof a.value==='string'&&typeof b.value==='string'?a.value===b.value:{kind:'upstream-error',a,b};}
function fresh(a,b){return a.kind==='return'&&b.kind==='return'?observe(()=>api.claimsFresh(a.value,b.value)):{kind:'upstream-error',a,b};}
function fixture(name){const dir=path.join(out,name);observations[\`\${name}:initial-sha256\`]=copyQualified(path.join(root,'template'),dir,expected);process.chdir(dir);return dir;}
function scenario(name,fn){try{const dir=fixture(name);fn(dir);}catch(error){results.push({label:\`ERROR_\${name}\`,status:'harness-error',actual:String(error),expected:'Qualified private fixture and harness operations complete'});}}
function presentPositive(baseHash,baseMutation){return {default:sources(),explicit:sources('scripts'),fingerprintEqual:equal(baseHash,fingerprint()),explicitFingerprintEqual:equal(baseHash,fingerprint('scripts')),mutationStable:equal(baseMutation,observe(()=>api.mutationSourceIdentity())),claimsFresh:fresh(baseHash,fingerprint())};}
const wantedPresent={default:wanted(expected.defaultPaths),explicit:wanted(expected.defaultPaths),fingerprintEqual:true,explicitFingerprintEqual:true,mutationStable:true,claimsFresh:{kind:'return',value:true}};
try {
 const seal=JSON.parse(readFileSync(path.join(root,'sealed/seal.json'),'utf8'));for(const [rel,digest]of Object.entries(seal.frozenArtifactHashes))if(sha(readFileSync(path.join(root,rel)))!==digest)throw new Error(\`Frozen supplemental artifact changed: \${rel}\`);
 const preflight=JSON.parse(readFileSync(path.join(root,'sealed/permission-preflight.json'),'utf8'));if(!preflight.allValid||preflight.uid===0||preflight.uid===null)throw new Error('Nonroot parent read-denial preflight is invalid');
 qualifications.preflight=preflight;check('Q01_nonroot_independent_parent_read_calibration',true,true);
 writeFileSync(path.join(out,'pre-import-qualification.json'),JSON.stringify({utc:new Date().toISOString(),sealSha256:sha(readFileSync(path.join(root,'sealed/seal.json'))),preflightAllValid:preflight.allValid,uid:preflight.uid,targetModule},null,2)+'\\n');
 api=await import(pathToFileURL(targetModule).href);imported=true;
 scenario('genuine-absence',()=>{rmSync(expected.workflowPath);observations['genuine-absence:deleted-sha256']=snapshot(process.cwd());const def=sources();const explicit=sources('scripts');const h=fingerprint();const mutation=observe(()=>api.mutationSourceIdentity());check('A01_genuine_absence_default_TS_only',def,wanted(expected.scriptPaths));check('A02_genuine_absence_explicit_scripts_equivalent',{sources:explicit,fingerprintEqual:equal(h,fingerprint('scripts'))},{sources:wanted(expected.scriptPaths),fingerprintEqual:true});check('A03_genuine_absence_mutation_identity_stable',equal(mutation,observe(()=>api.mutationSourceIdentity())),true);check('A04_genuine_absence_current_claims_fresh',fresh(h,h),{kind:'return',value:true});check('A05_genuine_absence_custom_TS_only',sources('custom'),wanted(expected.customPaths));observations['genuine-absence:identities']={fingerprint:h,mutation};});
 for(const config of expected.denials)scenario(config.name,dir=>{
  const q=config.prefix;const baseHash=fingerprint();const baseMutation=observe(()=>api.mutationSourceIdentity());const customHash=fingerprint('custom');const customSources=sources('custom');
  check(\`\${q}_B01_readable_before_positives\`,presentPositive(baseHash,baseMutation),wantedPresent);
  const {evidence,output}=withParentDenied(dir,config,expected,()=>{
   const def=observe(()=>api.sourceFiles());const explicit=observe(()=>api.sourceFiles('scripts'));const mutation=observe(()=>api.mutationSourceIdentity());const custom=sources('custom');const customDuring=fingerprint('custom');return {def,explicit,mutation,custom,customDuring};
  });qualifications[config.name]=evidence;observations[\`\${config.name}:denied-public-results\`]=output||null;
  if(!evidence.valid)throw new Error(\`Runtime parent-denial fixture invalid: \${JSON.stringify(evidence)}\`);
  check(\`\${q}_D01_default_propagates_EACCES\`,output.def.kind==='throw'&&output.def.code==='EACCES',true);check(\`\${q}_D02_explicit_scripts_propagates_EACCES\`,output.explicit.kind==='throw'&&output.explicit.code==='EACCES',true);check(\`\${q}_D03_mutation_identity_propagates_EACCES\`,output.mutation.kind==='throw'&&output.mutation.code==='EACCES',true);check(\`\${q}_D04_custom_scope_unaffected\`,{sources:output.custom,beforeSources:customSources,hashEqual:equal(customHash,output.customDuring)},{sources:wanted(expected.customPaths),beforeSources:wanted(expected.customPaths),hashEqual:true});
  check(\`\${q}_R01_restored_public_positives\`,presentPositive(baseHash,baseMutation),wantedPresent);observations[\`\${config.name}:restored-sha256\`]=snapshot(dir);
 });
} catch(error){results.push({label:'ERROR_runner',status:'harness-error',actual:String(error),expected:'Frozen setup, qualification and target import complete'});}
finally {
 process.chdir(root);const missing=cases.map(c=>c.label).filter(l=>!results.some(r=>r.label===l));const positiveLabels=['Q01_nonroot_independent_parent_read_calibration',...cases.filter(c=>c.label.startsWith('A')||c.label.includes('_B01_')||c.label.includes('_R01_')).map(c=>c.label)];const positives=positiveLabels.map(label=>({label,status:results.find(r=>r.label===label)?.status||'missing'}));const summary={pass:results.filter(r=>r.status==='pass').length,semanticFail:results.filter(r=>r.status==='semantic-fail').length,harnessError:results.filter(r=>r.status==='harness-error').length};const observationQualified=imported&&summary.harnessError===0&&missing.length===0&&positives.every(p=>p.status==='pass')&&expected.denials.every(d=>qualifications[d.name]?.valid);
 const report={runName,startUtc,endUtc:new Date().toISOString(),targetModule,scope:'New independent parent traversal denial supplement after original 19+13. Public API only; original 32 did not exercise parent traversal denial. No full audit/launches CLI.',qualification:{imported,missing,positives,observationQualified,fixtures:qualifications},summary,results,observations};writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\\n');for(const r of results)console.log(\`\${r.status.toUpperCase()} \${r.label}\`);console.log(JSON.stringify({summary,qualification:{imported,missing,positives,observationQualified},resultsPath:path.join(out,'results.json')}));process.exitCode=summary.harnessError||missing.length?2:summary.semanticFail?1:0;
}
` },
  { path: "parent-read-denial/suite/fixture-helpers.mjs", sha256: "1f08bba59437a33ca19148ce82dc5513d0aab5bfc08cbee16fff2f9cc707e486", body: `import { chmodSync, closeSync, cpSync, fstatSync, openSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
export const sha = value => createHash('sha256').update(value).digest('hex');
export function files(dir) { return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:(()=>{throw new Error('Unexpected fixture kind')})()); }
export function snapshot(dir) { return Object.fromEntries(files(dir).map(p=>[path.relative(dir,p).split(path.sep).join('/'),sha(readFileSync(p))])); }
export function copyQualified(template,dir,expected) { cpSync(template,dir,{recursive:true});const actual=files(dir).map(p=>path.relative(dir,p).split(path.sep).join('/')).sort();if(JSON.stringify(actual)!==JSON.stringify(Object.keys(expected.baseFiles).sort()))throw new Error('Fixture file layout mismatch');for(const [rel,body]of Object.entries(expected.baseFiles))if(readFileSync(path.join(dir,rel),'utf8')!==body)throw new Error(\`Fixture body mismatch: \${rel}\`);return snapshot(dir); }
export function observe(fn) { try { return {kind:'return',value:fn()}; } catch(error) { return {kind:'throw',code:typeof error==='object'&&error!==null&&'code'in error?String(error.code):null,error:String(error)}; } }
function fileState(st) { return {dev:st.dev,ino:st.ino,size:st.size,mode:st.mode&0o777,regular:st.isFile()}; }
export function withParentDenied(dir,config,expected,action) {
 const workflow=path.join(dir,expected.workflowPath);const github=path.join(dir,'.github');const workflows=path.join(github,'workflows');const deniedParent=path.join(dir,config.parentPath);
 const beforeBytes=readFileSync(workflow);const before=fileState(statSync(workflow));const parentModes={github:statSync(github).mode&0o777,workflows:statSync(workflows).mode&0o777};const fd=openSync(workflow,'r');
 const evidence={name:config.name,uid:process.getuid?.()??null,workflowPath:workflow,deniedParent,utcBefore:new Date().toISOString(),beforeFile:before,beforeSha256:sha(beforeBytes),beforeParentModes:parentModes,deniedDirectoryMode:expected.directoryDeniedMode};
 let output;let setupError;let restorationError;
 try {
  chmodSync(deniedParent,expected.directoryDeniedMode);
  evidence.fileDuringDenial=fileState(fstatSync(fd));evidence.fdSha256DuringDenial=sha(readFileSync(fd));
  evidence.independentPathRead=observe(()=>sha(readFileSync(workflow)));
  evidence.calibrated=evidence.uid!==null&&evidence.uid!==0&&before.regular&&(before.mode&0o400)!==0&&evidence.independentPathRead.kind==='throw'&&evidence.independentPathRead.code==='EACCES'&&JSON.stringify(evidence.fileDuringDenial)===JSON.stringify(before)&&evidence.fdSha256DuringDenial===evidence.beforeSha256;
  if(evidence.calibrated&&action) output=action(evidence);
 } catch(error) { setupError=String(error); }
 finally {
  try { chmodSync(github,parentModes.github);chmodSync(workflows,parentModes.workflows); }catch(error){restorationError=String(error);}
  try { closeSync(fd); }catch(error){restorationError=(restorationError||'')+String(error);}
  try {
   evidence.restoredFile=fileState(statSync(workflow));evidence.restoredSha256=sha(readFileSync(workflow));evidence.restoredParentModes={github:statSync(github).mode&0o777,workflows:statSync(workflows).mode&0o777};evidence.restoredIndependentRead=true;
   evidence.restoredIntegrity=JSON.stringify(evidence.restoredFile)===JSON.stringify(before)&&evidence.restoredSha256===evidence.beforeSha256&&JSON.stringify(evidence.restoredParentModes)===JSON.stringify(parentModes);
  }catch(error){restorationError=(restorationError||'')+String(error);evidence.restoredIntegrity=false;}
  evidence.utcAfter=new Date().toISOString();
 }
 evidence.setupError=setupError||null;evidence.restorationError=restorationError||null;evidence.valid=!!evidence.calibrated&&!!evidence.restoredIntegrity&&!setupError&&!restorationError;
 return {evidence,output};
}
` },
  { path: "parent-read-denial/suite/package.json", sha256: "96871004b222b319ed0e3fae4507ad770b6aa9da2577f2eb01d932d248f0ce04", body: `{"name":"wallclock-parent-read-denial-contract","private":true,"type":"module"}
` },
  { path: "parent-read-denial/template/.github/README.md", sha256: "489d54570fc5caa4fa758ac7f101138ba6baa529aca7b8b27021d62f2253f331", body: `An unrelated GitHub note.
` },
  { path: "parent-read-denial/template/.github/helpers/ignored.ts", sha256: "84413684842145cdffd97a986a9a48cbc93488ead2e21151f9231380cb785235", body: `export const unrelatedGitHubInput = 1;
` },
  { path: "parent-read-denial/template/.github/workflows/check.yml", sha256: "105a8f3e345fe0bba1d320d3fd7422414cf5a1353ddecbf642f61d8e6b1918c5", body: `name: check
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - run: echo baseline
` },
  { path: "parent-read-denial/template/.github/workflows/other.yml", sha256: "33941ffeaaa080ad5c872ecc8798f8232df7e2c4b7577b11a29adea99f902d19", body: `name: other
on: [workflow_dispatch]
jobs:
  idle:
    runs-on: ubuntu-latest
    steps:
      - run: echo other
` },
  { path: "parent-read-denial/template/custom/.github/workflows/check.yml", sha256: "cca187c3ada12027e527153b116ce30f3da16bb213b4b38673ad31a4f9263fe8", body: `name: custom-non-ts
` },
  { path: "parent-read-denial/template/custom/nested/deep.ts", sha256: "e1aee713d34976f9e345dd16ec5647d41ff8c4af20cf5ac97ae8eb4cd75f9451", body: `export const customDeep = true;
` },
  { path: "parent-read-denial/template/custom/notes.txt", sha256: "a62413221ca9d2c5e540f91bacfca1e947b2e0c924c4d480466de61ce04e272c", body: `Custom non-TS neighbor.
` },
  { path: "parent-read-denial/template/custom/unit.ts", sha256: "ba705f42f25c8408285c79284119e908e432f8ce384403c1b43a4bc8a9fd3b63", body: `export const customUnit = 1;
` },
  { path: "parent-read-denial/template/mutations.json", sha256: "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9", body: `{"mutations":[]}
` },
  { path: "parent-read-denial/template/package-lock.json", sha256: "ac15bb277d032075ca784177e3ec36b9b810f8582d58916691ba58b98cac2d65", body: `{"name":"identity-contract-fixture","version":"1.0.0","lockfileVersion":3,"requires":true,"packages":{}}
` },
  { path: "parent-read-denial/template/package.json", sha256: "22f372439d288cae0488ef6b8e7b43b64ada25df3ac053d8672ed343a18e4278", body: `{"name":"identity-contract-fixture","private":true,"type":"module"}
` },
  { path: "parent-read-denial/template/scripts/a.ts", sha256: "2f2d8ab6453896290e40a007f1df961cc6004062c86a0a1e6480e8ce201a58aa", body: `export const alpha = 1;
` },
  { path: "parent-read-denial/template/scripts/check/mutations.json", sha256: "071acdc0665a34bbb8462bacae543d45e9a41c4284275309c75c8ba5c64e5eb9", body: `{"mutations":[]}
` },
  { path: "parent-read-denial/template/scripts/nested/b.ts", sha256: "683d83774fa70e88eea40991a8050c3c5898e9d9e64ddf17715b5c4d20bae93d", body: `export const beta = "base";
` },
  { path: "parent-read-denial/template/scripts/readme.txt", sha256: "203170ad3f18b00e3dc90462c9e055f5c744c4fae9baa115751e9495a753d412", body: `This non-TS script neighbor is not a program input.
` },
] as const

const ARCHIVE_BLOCK = " if(sha(readFileSync(path.join(originalRoot,'manifest.json')))!==expected.originalPackageManifestSha256)throw new Error('Original manifest changed');\n const prior=JSON.parse(readFileSync(path.join(originalRoot,'manifest.json'),'utf8'));\n for(const [rel,value]of Object.entries(prior.files) as [string,{sha256:string}][])if(sha(readFileSync(path.join(originalRoot,rel)))!==value.sha256)throw new Error(`Original artifact changed: ${rel}`);\n qualification.frozenHashesValid=true;qualification.originalArtifactCount=Object.keys(prior.files).length;qualification.originalArtifactsUnchanged=true;\n"
const RUNTIME_BLOCK = " const runtimeInputs=JSON.parse(readFileSync(path.join(originalRoot,'runtime-input-manifest.json'),'utf8'));\n for(const [rel,value]of Object.entries(runtimeInputs.files) as [string,{sha256:string}][])if(sha(readFileSync(path.join(originalRoot,rel)))!==value.sha256)throw new Error(`Runtime frozen input changed: ${rel}`);\n qualification.frozenHashesValid=true;qualification.runtimeInputCount=Object.keys(runtimeInputs.files).length;qualification.runtimeInputsUnchanged=true;\n"

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function runWallclockIdentityContracts(group: 'identity' | 'parent-read' = 'identity'): ReadonlyMap<string, readonly string[]> {
  const targetModule = resolve('scripts/check/claims.ts')
  const targetSha = sha256(readFileSync(targetModule))
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kol-wallclock-identity-')))
  try {
    const inputs: Record<string, { sha256: string }> = {}
    for (const file of FROZEN_INPUTS) {
      if (sha256(file.body) !== file.sha256) throw new Error('identity fixture-invalid: frozen input changed: ' + file.path)
      const path = join(root, file.path)
      mkdirSync(dirname(path), { recursive: true })
      let body: string = file.body
      if (file.path === 'supplement/suite/run-supplement.ts') {
        if (body.split(ARCHIVE_BLOCK).length !== 2) throw new Error('identity fixture-invalid: archival adapter anchor')
        writeFileSync(path + '.frozen-original', body)
        inputs[file.path + '.frozen-original'] = { sha256: sha256(body) }
        body = body.replace(ARCHIVE_BLOCK, RUNTIME_BLOCK)
      }
      writeFileSync(path, body)
      inputs[file.path] = { sha256: sha256(body) }
    }
    for (const prefix of ['', 'supplement/', 'parent-read-denial/']) {
      const frozenArtifactHashes = Object.fromEntries(Object.entries(inputs)
        .filter(([path]) => prefix ? path.startsWith(prefix) : !path.startsWith('supplement/') && !path.startsWith('parent-read-denial/'))
        .map(([path, row]) => [path.slice(prefix.length), row.sha256]))
      const path = prefix + 'sealed/seal.json'
      const body = JSON.stringify({ scope: 'actual unpacked frozen runtime inputs; archival continuity is a separate delivery receipt', frozenArtifactHashes }, null, 2) + '\n'
      writeFileSync(join(root, path), body)
      inputs[path] = { sha256: sha256(body) }
    }
    writeFileSync(join(root, 'runtime-input-manifest.json'), JSON.stringify({ files: inputs }, null, 2) + '\n')
    console.log('wallclock identity source: claims=' + targetSha)
    const result = new Map<string, readonly string[]>()
    const packets = group === 'parent-read' ? [['parent-read-denial/', 'run-parent-read.mjs']] : [['', 'run-contract.ts'], ['supplement/', 'run-supplement.ts']]
    for (const [prefix, entry] of packets) {
      const script = join(root, prefix, 'suite', entry)
      const child = spawnSync(process.execPath, ['--import', fixtureLoader(script), script], {
        encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 60_000,
        env: { ...process.env, CONTRACT_TARGET_MODULE: targetModule, CONTRACT_RUN_NAME: 'identity', TSX_DISABLE_CACHE: '1' },
      })
      if (child.error || child.signal || ![0, 1].includes(child.status as number)) {
        throw new Error(`identity verifier failed: ${child.error ?? child.signal ?? child.status}\n${child.stdout}${child.stderr}`)
      }
      let report: unknown
      try { report = JSON.parse(readFileSync(join(root, prefix, 'runs/identity/results.json'), 'utf8')) }
      catch (error) { throw new Error(`identity missing/invalid report: ${String(error)}\n${child.stdout}${child.stderr}`) }
      if (!object(report) || report.targetModule !== targetModule || report.runName !== 'identity' || !object(report.qualification) ||
          report.qualification.observationQualified !== true || !Array.isArray(report.qualification.missing) || report.qualification.missing.length !== 0 ||
          !Array.isArray(report.qualification.positives) || report.qualification.positives.some(row => !object(row) || row.status !== 'pass') ||
          !object(report.summary) || report.summary.harnessError !== 0 || !Array.isArray(report.results)) {
        throw new Error('identity fixture-invalid, incomplete qualification or verifier-crash')
      }
      if (prefix === 'supplement/' && (!object(report.qualification.deniedRead) || report.qualification.deniedRead.denied !== true ||
          report.qualification.deniedReadBytesPreserved !== true || report.qualification.runtimeInputsUnchanged !== true)) {
        throw new Error('identity denied-read fixture did not qualify or restore')
      }
      if (prefix === 'parent-read-denial/') {
        const fixtures = report.qualification.fixtures
        if (!object(fixtures)) throw new Error('identity parent-read fixtures missing')
        for (const name of ['workflows-parent', 'github-parent']) {
          const fixture = fixtures[name]
          if (!object(fixture) || fixture.valid !== true || fixture.calibrated !== true || fixture.restoredIntegrity !== true ||
              typeof fixture.uid !== 'number' || fixture.uid === 0 || !object(fixture.independentPathRead) ||
              fixture.independentPathRead.kind !== 'throw' || fixture.independentPathRead.code !== 'EACCES') {
            throw new Error('identity parent-read fixture did not qualify or restore')
          }
        }
      }
      const cases = JSON.parse(FROZEN_INPUTS.find(file => file.path === prefix + 'sealed/cases.json')!.body) as { label: string }[]
      const expected = cases.map(row => row.label).sort()
      const seen: string[] = []
      let failed = 0
      for (const row of report.results) {
        if (!object(row) || typeof row.label !== 'string' || !['pass', 'semantic-fail'].includes(row.status as string)) {
          throw new Error('identity invalid result row')
        }
        const pass = JSON.stringify(row.actual) === JSON.stringify(row.expected)
        if (pass !== (row.status === 'pass')) throw new Error('identity row status mismatch')
        if (!pass) failed++
        seen.push(row.label)
        if (result.has(row.label)) throw new Error('identity duplicate result label')
        result.set(row.label, pass ? [] : [JSON.stringify({ expected: row.expected, actual: row.actual })])
      }
      if (JSON.stringify(seen.sort()) !== JSON.stringify(expected) || report.summary.semanticFail !== failed ||
          report.summary.pass !== seen.length - failed || child.status !== (failed ? 1 : 0)) throw new Error('identity incomplete results or exit mismatch')
    }
    if (sha256(readFileSync(targetModule)) !== targetSha) throw new Error('identity target changed during execution')
    return result
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
