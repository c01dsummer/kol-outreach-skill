/** Readable frozen v4.2 + CI Node22 runtime members; only declared root bindings may change. */
export interface FrozenContractFile { readonly name: string; readonly sha256: string; readonly source: string; readonly rootBindings: readonly ('packet' | 'original')[]; readonly body: string }
export const ORIGINAL_PACKET_ROOT = "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts"
export const ORIGINAL_FIXTURE_ROOT = "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts"
export const COMBINED_FREEZE_SHA256 = "f2d67ff071b7a2058ae62e56fffabc86f042c9597f905dd0b29690057c85c445"
export const PORTABLE_GUARD_SCOPES = [
  [
    "packet/producer",
    "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/freeze-manifest.json"
  ],
  [
    "packet/lifecycle319",
    "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/freeze-manifest.json"
  ],
  [
    "packet/lifecycle319/sync",
    "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/sync/freeze-manifest.json"
  ],
  [
    "packet/lifecycle319/preload",
    "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/preload/freeze-manifest.json"
  ],
  [
    "original",
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/freeze-manifest.json"
  ]
] as const
export const ORIGINAL_FREEZES = [
  {
    "path": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/freeze-manifest.json",
    "sha256": "f2d67ff071b7a2058ae62e56fffabc86f042c9597f905dd0b29690057c85c445",
    "portableMeaning": "explicit runtime subset; not original full old26/superset qualification",
    "omitted": []
  },
  {
    "path": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/freeze-manifest.json",
    "sha256": "12e657481d591eb65d7e2dde0b58100b3c408ee91ea270d6521a9b5d9e6f3fa2",
    "portableMeaning": "explicit runtime subset; not original full old26/superset qualification",
    "omitted": []
  },
  {
    "path": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/freeze-manifest.json",
    "sha256": "8e75b818b0baf50e4ddddffefe23ec57393ea133f1cc0fd908b27415e6cc2055",
    "portableMeaning": "explicit runtime subset; not original full old26/superset qualification",
    "omitted": []
  },
  {
    "path": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/sync/freeze-manifest.json",
    "sha256": "856dfbffee67edeea75b009270ba09b45be4bdfd4cd726b4a588a64b2991ae70",
    "portableMeaning": "explicit runtime subset; not original full old26/superset qualification",
    "omitted": []
  },
  {
    "path": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/preload/freeze-manifest.json",
    "sha256": "66ace09e7f3b77144382c0acea666871d9d15373be09e399dc5b8366c8742c6a",
    "portableMeaning": "explicit runtime subset; not original full old26/superset qualification",
    "omitted": []
  },
  {
    "path": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/freeze-manifest.json",
    "sha256": "c6045e89deae26635a9d021deb8e57c71c6111882920129ea43ddd3c2a7f7f49",
    "portableMeaning": "explicit runtime subset; not original full old26/superset qualification",
    "omitted": [
      "README.md",
      "admission-log.json",
      "cases.json",
      "expected.json",
      "inputs/4-VERIFY.md",
      "inputs/cache-witness-prefix.mjs.txt",
      "inputs/design-before-implementation.json",
      "inputs/no-config-freeze-proof.json",
      "inputs/prior-ADR158-allowed-excerpt.txt",
      "inputs/prior-PUBLIC-CONTRACT.md",
      "inputs/prior-asTsx-public-signature-supplement.d.ts",
      "runtime.example.json",
      "src/entry.ts",
      "src/run.mjs",
      "src/state.ts"
    ]
  },
  {
    "path": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/freeze-manifest.json",
    "sha256": "aaddaa8a06891a399b29af4d5f44b0f45e0556feb5fae6bb3915bc8761528a76",
    "portableMeaning": "explicit runtime subset; not original full old26/superset qualification",
    "omitted": [
      "README.md",
      "expected.json",
      "run.mjs",
      "runtime.example.json"
    ]
  }
] as const
export const CONTRACT_BUCKETS: readonly { readonly name: string; readonly labels: readonly string[] }[] = [
  {
    "name": "预编两种格式与独立无配置身份",
    "labels": [
      "V4.false.COLD.COUNTS",
      "V4.false.COLD.PAYLOAD_K",
      "V4.false.WARM.COUNTS",
      "V4.false.WARM.PAYLOAD_K",
      "V4.false.N.FACTORY_RETURN",
      "V4.false.N.NEW_N_PARENT",
      "V4.false.OWNER.FACTORY_RETURN",
      "V4.false.OWNER.BARE",
      "V4.true.COLD.COUNTS",
      "V4.true.COLD.PAYLOAD_K",
      "V4.true.WARM.COUNTS",
      "V4.true.WARM.PAYLOAD_K",
      "V4.true.N.FACTORY_RETURN",
      "V4.true.N.NEW_N_PARENT",
      "V4.true.OWNER.FACTORY_RETURN",
      "V4.true.OWNER.BARE",
      "V4.empty.COLD.COUNTS",
      "V4.empty.COLD.PAYLOAD_K",
      "V4.empty.WARM.COUNTS",
      "V4.empty.WARM.PAYLOAD_K",
      "V4.empty.N.FACTORY_RETURN",
      "V4.empty.N.NEW_N_PARENT",
      "V4.empty.OWNER.FACTORY_RETURN",
      "V4.empty.OWNER.BARE"
    ]
  },
  {
    "name": "无配置入口参数与默认语义",
    "labels": [
      "V4.false.N.SEMANTICS",
      "V4.false.N.COMPLETE",
      "V4.true.N.SEMANTICS",
      "V4.true.N.COMPLETE",
      "V4.empty.N.SEMANTICS",
      "V4.empty.N.COMPLETE",
      "V4.DEFAULT.N.FACTORY_RETURN",
      "V4.DEFAULT.N.NEW_N_PARENT"
    ]
  },
  {
    "name": "无配置准入边界保留公开加载器回退",
    "labels": [
      "V4.DEFAULT.OPTOUT.PUBLIC_CLI",
      "V4.F.OPTOUT.FACTORY_RETURN",
      "V4.F.OPTOUT.PUBLIC_CLI",
      "V4.F.TSX_EMPTY.FACTORY_RETURN",
      "V4.F.TSX_EMPTY.PUBLIC_CLI",
      "V4.F.TSX_EXPLICIT.FACTORY_RETURN",
      "V4.F.TSX_EXPLICIT.PUBLIC_CLI",
      "V4.F.EXISTING_TSX.FACTORY_RETURN",
      "V4.F.EXISTING_TSX.PUBLIC_CLI",
      "V4.F.NO_STRIP_ENV.FACTORY_RETURN",
      "V4.F.NO_STRIP_ENV.PUBLIC_CLI",
      "V4.F.CLI_CONFIG.FACTORY_RETURN",
      "V4.F.CLI_CONFIG.PUBLIC_CLI",
      "V4.F.CWD_CONFIG.FACTORY_RETURN",
      "V4.F.CWD_CONFIG.PUBLIC_CLI",
      "V4.F.CWD_CONFIG.SEMANTICS",
      "V4.F.CWD_CONFIG.COMPLETE",
      "V4.F.ANCESTOR_CONFIG.FACTORY_RETURN",
      "V4.F.ANCESTOR_CONFIG.PUBLIC_CLI",
      "V4.F.ANCESTOR_CONFIG.SEMANTICS",
      "V4.F.ANCESTOR_CONFIG.COMPLETE",
      "V4.F.CONFIG_SYMLINK.FACTORY_RETURN",
      "V4.F.CONFIG_SYMLINK.PUBLIC_CLI",
      "V4.F.UNKNOWN_CWD.FACTORY_RETURN",
      "V4.F.UNKNOWN_CWD.PUBLIC_CLI",
      "V4.F.UNREADABLE.FACTORY_RETURN",
      "V4.F.UNREADABLE.PUBLIC_CLI",
      "V4.F.OWNER_EXTENDS.FACTORY_RETURN",
      "V4.F.OWNER_EXTENDS.PUBLIC_CLI",
      "V4.F.OWNER_FILES.FACTORY_RETURN",
      "V4.F.OWNER_FILES.PUBLIC_CLI",
      "V4.F.OWNER_INCLUDE.FACTORY_RETURN",
      "V4.F.OWNER_INCLUDE.PUBLIC_CLI",
      "V4.F.OWNER_EXCLUDE.FACTORY_RETURN",
      "V4.F.OWNER_EXCLUDE.PUBLIC_CLI",
      "V4.F.OWNER_REFERENCES.FACTORY_RETURN",
      "V4.F.OWNER_REFERENCES.PUBLIC_CLI",
      "V4.F.CACHE_ABSENT.FACTORY_RETURN",
      "V4.F.CACHE_ABSENT.PUBLIC_CLI",
      "V4.SOURCE.STALE.FACTORY_RETURN",
      "V4.SOURCE.STALE.PUBLIC_CLI",
      "V4.CAPABILITY.NO_STRIP"
    ]
  },
  {
    "name": "观察器加载器与直接IPC及工作线程行为不变",
    "labels": [
      "V4.false.OWNER.SEMANTICS",
      "V4.false.OWNER.COMPLETE",
      "V4.false.OWNER.DIRECT_PID",
      "V4.false.OWNER.FIELD_POSITIVE",
      "V4.true.OWNER.SEMANTICS",
      "V4.true.OWNER.COMPLETE",
      "V4.true.OWNER.DIRECT_PID",
      "V4.true.OWNER.FIELD_POSITIVE",
      "V4.empty.OWNER.SEMANTICS",
      "V4.empty.OWNER.COMPLETE",
      "V4.empty.OWNER.DIRECT_PID",
      "V4.LOADER.N.PUBLIC_TSX",
      "V4.LOADER.FINAL_ENV.FACTORY_RETURN",
      "V4.LOADER.FINAL_ENV.PUBLIC_CLI",
      "V4.DIRECT_N.IPC_UNMIGRATED",
      "V4.LOADER.OWNER.CACHED",
      "V4.OWNER.WORKER"
    ]
  },
  {
    "name": "已选入口拒绝源码缓存与配置失效",
    "labels": [
      "V4.SOURCE_START.SELECT.FACTORY_RETURN",
      "V4.SOURCE_START.SELECT.NEW_N_PARENT",
      "V4.SOURCE_START.STOPS",
      "V4.CACHE_START.SELECT.FACTORY_RETURN",
      "V4.CACHE_START.SELECT.NEW_N_PARENT",
      "V4.CACHE_START.STOPS",
      "V4.INVALIDATE.SELECT.FACTORY_RETURN",
      "V4.INVALIDATE.SELECT.NEW_N_PARENT",
      "V4.INVALIDATE.STOPS"
    ]
  },
  {
    "name": "单源更新清理与坏编译拒绝旧缓存",
    "labels": [
      "V4.ONE.VOID",
      "V4.ONE.TWO_NEW_PAYLOADS",
      "V4.ONE.N.FACTORY_RETURN",
      "V4.ONE.N.NEW_N_PARENT",
      "V4.ONE.N.SEMANTICS",
      "V4.ONE.N.COMPLETE",
      "V4.ONE.OWNER.FACTORY_RETURN",
      "V4.ONE.OWNER.SEMANTICS",
      "V4.ONE.OWNER.COMPLETE",
      "V4.ONE.CLEAN.COUNTS",
      "V4.ONE.CLEAN.PAYLOAD_K",
      "V4.DELETE.TREE.COUNTS",
      "V4.DELETE.TREE.PAYLOAD_K",
      "V4.ONE.INVALID_NO_PUBLISH",
      "V4.ONE.INVALID_SOURCE.FACTORY_RETURN",
      "V4.ONE.INVALID_SOURCE.PUBLIC_CLI",
      "V4.ONE.INVALID_NO_STALE_EXECUTION"
    ]
  },
  {
    "name": "INT和TERM进程组与同步自身信号生命周期",
    "labels": [
      "N.SIGTERM.GROUP.RAW",
      "N.SIGTERM.GROUP.CALLER",
      "N.SIGTERM.GROUP.HOOKS",
      "N.SIGTERM.GROUP.BOUNDARY_HOOKS",
      "N.SIGTERM.GROUP.USER_HANDLER",
      "N.SIGTERM.GROUP.LIFECYCLE",
      "N.SIGTERM.GROUP.NO_ORPHANS",
      "N.SIGTERM.GROUP.ENTRY",
      "N.SIGTERM.GROUP.VALUES",
      "N.SIGTERM.GROUP.FIDELITY",
      "N.SIGTERM.GROUP.OBSERVER_WIRING",
      "N.SIGTERM.GROUP.STDERR",
      "N.SIGINT.GROUP.RAW",
      "N.SIGINT.GROUP.CALLER",
      "N.SIGINT.GROUP.HOOKS",
      "N.SIGINT.GROUP.BOUNDARY_HOOKS",
      "N.SIGINT.GROUP.USER_HANDLER",
      "N.SIGINT.GROUP.LIFECYCLE",
      "N.SIGINT.GROUP.NO_ORPHANS",
      "N.SIGINT.GROUP.ENTRY",
      "N.SIGINT.GROUP.VALUES",
      "N.SIGINT.GROUP.FIDELITY",
      "N.SIGINT.GROUP.OBSERVER_WIRING",
      "N.SIGINT.GROUP.STDERR",
      "N.SYNC_SELF_TERM.ENTRY_READY",
      "N.SYNC_SELF_TERM.RAW",
      "N.SYNC_SELF_TERM.KNOWN_CLI_ZERO",
      "N.SYNC_SELF_TERM.HOOKS",
      "N.SYNC_SELF_TERM.RESULT",
      "N.SYNC_SELF_TERM.STDERR",
      "N.SYNC_SELF_TERM.NO_ORPHANS"
    ]
  },
  {
    "name": "异常保留原栈且普通预载正常收尾",
    "labels": [
      "N.THROW.RAW",
      "N.THROW.CALLER",
      "N.THROW.HOOKS",
      "N.THROW.BOUNDARY_HOOKS",
      "N.THROW.USER_HANDLER",
      "N.THROW.LIFECYCLE",
      "N.THROW.NO_ORPHANS",
      "N.THROW.ENTRY",
      "N.THROW.VALUES",
      "N.THROW.FIDELITY",
      "N.THROW.OBSERVER_WIRING",
      "N.THROW.THROW",
      "V4.PRELOAD.IDENTITIES",
      "V4.PRELOAD.NORMAL_COMPLETION",
      "V4.PRELOAD.NO_RESIDUAL",
      "V4.PRELOAD.STDERR"
    ]
  }
]
export const FROZEN_CONTRACT_FILES: readonly FrozenContractFile[] = [
  { name: "packet/README.md", sha256: "93e033f2728f56ed87f4532f40fc52f95dd962c45279b06d5dc54af45de31639", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/README.md", rootBindings: [], body: `# CI Node22 exact runtime binding tool overlay

All original22.22 frozen files/reports remain untouched. Semantic expected, TS bytes,
case IDs, labels and liveness deadlines are unchanged. This tool overlay accepts
only the existing CI Node22 family and records an exact runtime, not a floating
major-only success claim. Supply runtime.node=process.execPath and
runtime.nodeVersion=process.version from the actual invoking Node. R/C/factory and
preparation use that same canonical binary. Mismatched supplied version, binary,
platform/arch assertions or unavailable native TS/registerHooks are INVALID with
zero semantic assertions before API or target execution.

binding/node-binding.mjs alone is a qualification entry; it performs no product
imports or semantic assertions. Its child has NODE_OPTIONS cleared, positively
loads typed native .mts and uses public registerHooks, then records Node/platform/
arch/type mode plus public tsx exports/package and actual producer esbuild package.
Main/sync/preload/producer/preparation tools import that gate. Only the lifecycle
main's old literal22.22 guard becomes runtime.nodeVersion after strict validation.
Actual carriers are guarded; controlled outer spawn ENOENT remains exempt.

Run Node binding qualification: node binding/node-binding.mjs runtime.json.
Run original semantic scopes through lifecycle319/src/run.mjs, sync/run.mjs,
preload/run.mjs or producer/src/run.mjs. Preparation is descriptor/prepare.mjs.
Parent/source/cache hashes retain their original per-target closure. Descriptor
ready/cache-consumption rules do not change. Node version self qualification is
not proof of a new patch/platform's full semantic contract.

Packaging must explicitly create no-config/leaf because Git/file-only archives
omit empty directories. Root relocation is separate from this Node overlay:
record original SHA and actual mapped-executed SHA plus exactly which path prefix
fields changed. TS bodies and numeric expected/labels cannot change. Retain all
old26 guard members or clearly label a new scoped runtime-member manifest and
its omissions; a reduced guard cannot be reported as the original full guard.

This combined v4.2 overlay uses the independently frozen empty-owner cc57 public API
differential oracle. Exactly3 old source modules are opaque Git-blob/SHA pinned data.
No candidate output becomes expected. New N/false/true/worker/fallback/format/case
labels and all319/ordinary4 semantic expected remain unchanged. Current22.22 tool
self qualification is reused for byte-identical binding modules; new Node patch
or Linux pairing remains unclaimed until actual run.
` },
  { name: "packet/binding/native-probe.mjs", sha256: "88bed797099479800fb35ab7a84a703cb24ea366bd1d9794dbb5938e7ae23388", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/binding/native-probe.mjs", rootBindings: [], body: `import * as Module from 'node:module';
import { pathToFileURL } from 'node:url';
try {
  const native = await import(pathToFileURL(process.argv[2]).href);
  if (typeof Module.registerHooks !== 'function') throw new Error('registerHooks unavailable');
  const hook = Module.registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'ci-node22-binding:probe') return { url: 'data:text/javascript,export%20const%20hookValue%3D912%3B', shortCircuit: true };
    return next(specifier, context);
  } });
  const hooked = await import('ci-node22-binding:probe');
  hook.deregister();
  console.log('@@NODE_BINDING@@' + JSON.stringify({ execPath: process.execPath, version: process.version, platform: process.platform, arch: process.arch, typescript: process.features.typescript, nativeValue: native.nativeValue, hookValue: hooked.hookValue }));
} catch (error) {
  console.log('@@NODE_BINDING@@' + JSON.stringify({ error: error.message }));
  process.exitCode = 2;
}
` },
  { name: "packet/binding/native-probe.mts", sha256: "61fa9de92eac477f270efafdb41005886619b188d6d8f96028c99899c27c456d", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/binding/native-probe.mts", rootBindings: [], body: `export const nativeValue: number = 911;
` },
  { name: "packet/binding/node-binding.mjs", sha256: "cad4562e2a7116de484fd93b56a43cc9dbd80edc37546c06b9b78c7a4dd0da2d", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/binding/node-binding.mjs", rootBindings: [], body: `import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import * as Module from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function assertBoundCarrier(tuple,runtime){
  if(!Array.isArray(tuple)||tuple[0]!==runtime.node||runtime.node!==process.execPath)throw new Error('INVALID Node carrier differs from bound tool/runtime node; no cross-version pairing');
}
export async function bindNode22(runtime){
  const output=path.join(runtime.nodeBindingOutputRoot||runtime.outputRoot||os.tmpdir(),'node-binding-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex'));
  fs.mkdirSync(output,{recursive:true});
  const receipt={status:'INVALID',semanticAssertions:0,receipt:path.join(output,'binding.json'),supplied:{node:runtime.node,nodeVersion:runtime.nodeVersion},tool:{node:process.execPath,nodeVersion:process.version,platform:process.platform,arch:process.arch,typescript:process.features.typescript,registerHooks:typeof Module.registerHooks},reason:null};
  const invalid=(code,detail)=>{const error=new Error(code);error.detail=detail;throw error};
  try{
    if(typeof runtime.node!=='string'||!path.isAbsolute(runtime.node)||runtime.node!==process.execPath||fs.realpathSync(runtime.node)!==fs.realpathSync(process.execPath))invalid('NODE_EXEC_PATH_MISMATCH','runtime.node must be this exact canonical tool executable');
    if(typeof runtime.nodeVersion!=='string'||runtime.nodeVersion!==process.version)invalid('NODE_VERSION_MISMATCH','supplied version must equal tool process.version');
    if(Number(process.versions.node.split('.')[0])!==22)invalid('NODE_MAJOR_UNSUPPORTED','only the existing CI Node22 family is eligible');
    if(!process.features.typescript)invalid('NATIVE_TYPESCRIPT_UNAVAILABLE','actual tool process has type stripping disabled or unavailable');
    if(typeof Module.registerHooks!=='function')invalid('REGISTER_HOOKS_UNAVAILABLE','public synchronous Node module hook API required');
    if(runtime.nodePlatform&&runtime.nodePlatform!==process.platform)invalid('PLATFORM_MISMATCH');
    if(runtime.nodeArch&&runtime.nodeArch!==process.arch)invalid('ARCH_MISMATCH');
    receipt.nodeBinaryBefore=hash(runtime.node);
    const cleanEnv={...process.env,...runtime.baseEnv};delete cleanEnv.NODE_OPTIONS;delete cleanEnv.TSX_TSCONFIG_PATH;
    const version=spawnSync(runtime.node,['--version'],{encoding:'utf8',env:cleanEnv});
    receipt.versionProbe={status:version.status,stdout:version.stdout,stderr:version.stderr,error:version.error?.code||null};
    if(version.error||version.status!==0||version.stdout.trim()!==runtime.nodeVersion||version.stdout.trim()!==process.version)invalid('SUPPLIED_NODE_VERSION_PROBE_MISMATCH');
    const probe=spawnSync(runtime.node,[path.join(here,'native-probe.mjs'),path.join(here,'native-probe.mts')],{encoding:'utf8',env:cleanEnv});
    receipt.nativeProbe={status:probe.status,stdout:probe.stdout,stderr:probe.stderr,error:probe.error?.code||null,mjsSha256:hash(path.join(here,'native-probe.mjs')),mtsSha256:hash(path.join(here,'native-probe.mts'))};
    const line=probe.stdout?.split('\\n').find(value=>value.startsWith('@@NODE_BINDING@@'));
    const positive=line?JSON.parse(line.slice('@@NODE_BINDING@@'.length)):null;
    receipt.nativeProbe.positive=positive;
    if(probe.error||probe.status!==0||!positive||positive.error||positive.nativeValue!==911||positive.hookValue!==912||positive.execPath!==runtime.node||positive.version!==runtime.nodeVersion||positive.platform!==process.platform||positive.arch!==process.arch||positive.typescript!==process.features.typescript)invalid('NATIVE_NODE_CAPABILITY_PROBE_INVALID');
    const publicRequire=Module.createRequire(path.join(runtime.publicResolutionOwner,'package.json'));
    const cli=publicRequire.resolve('tsx/cli'),loader=publicRequire.resolve('tsx'),tsxPackage=publicRequire.resolve('tsx/package.json');
    const tsx=JSON.parse(fs.readFileSync(tsxPackage,'utf8'));
    const apiURL=runtime.producerModuleURL||runtime.apiModuleURL;
    const compilerRequire=apiURL?Module.createRequire(new URL(apiURL)):publicRequire;
    const esbuildPackage=compilerRequire.resolve('esbuild/package.json'),esbuild=JSON.parse(fs.readFileSync(esbuildPackage,'utf8'));
    receipt.publicExports={tsxVersion:tsx.version,tsxRootURL:pathToFileURL(loader).href,tsxCli:cli,tsxPackage,esbuildVersion:esbuild.version,esbuildPackage};
    if(runtime.publicCli&&runtime.publicCli!==cli)invalid('PUBLIC_CLI_RESOLUTION_MISMATCH');
    if(runtime.publicTsxHookURL&&runtime.publicTsxHookURL!==pathToFileURL(loader).href)invalid('PUBLIC_TSX_ROOT_RESOLUTION_MISMATCH');
    receipt.compilerIdentity={nodeVersion:process.version,platform:process.platform,arch:process.arch,nativeTypeScriptMode:process.features.typescript,esbuildVersion:esbuild.version,profileContract:'v4 independent compilerOptions={} relative-basename inline-map profile; owner legacy format unchanged',opaquePreparedSelection:runtime.preparationSelectionForWitnessLocator||null};
    receipt.nodeBinaryAfter=hash(runtime.node);
    if(receipt.nodeBinaryBefore!==receipt.nodeBinaryAfter)invalid('NODE_BINARY_CHANGED_DURING_BINDING');
    receipt.status='VALID_TOOL_BINDING';
  }catch(error){receipt.reason=error.message;receipt.detail=error.detail||null;}
  fs.writeFileSync(receipt.receipt,JSON.stringify(receipt,null,2)+'\\n');
  return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const runtime=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const receipt=await bindNode22(runtime);
  console.log(JSON.stringify({status:receipt.status,semanticAssertions:0,reason:receipt.reason,receipt:receipt.receipt}));
  process.exitCode=receipt.status==='VALID_TOOL_BINDING'?0:2;
}
` },
  { name: "packet/contract.json", sha256: "cfa1f633de94a2d74a7589c413d50b3b7a4743b25a9056d880f4dc64fda62389", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/contract.json", rootBindings: [], body: `{
  "authority": "root explicit CI portability tool request; existing workflow Node22 currently22.23.3, no workflow/dependency change",
  "oldFixed22_22FrozenKept": true,
  "semanticExpectedChanged": false,
  "TSBodiesChanged": false,
  "labelsChanged": false,
  "requiredBinding": "supplied node --version == runtime.nodeVersion == tool process.version; same exact canonical executable; major22; actual native TS and synchronous registerHooks positive",
  "runtimeNewFields": [
    "nodeVersion required: actual process.version",
    "nodePlatform/nodeArch optional assertions: if present exact actual values"
  ],
  "receipt": "exact version/platform/arch/node executable and binary SHA/public tsx root+cli+package/esbuild compiler metadata/native positive probes/opaque prepared compile descriptor",
  "crossPatchQualification": "current22.22 self calibration is only tool qualification. A new patch or platform needs actual paired contract execution; no Linux/22.23 success claimed in advance.",
  "intentionalException": "controlled outer ENOENT has no real Node carrier and remains its own two frozen assertions; disabled-strip product capability probe remains intentionally ineligible",
  "sourceBinding": "API/hook/parent/signals/cache and toy closure in original tools retained",
  "portableRootMapping": "a separate mechanical packaging overlay may replace only documented runtime path prefixes/fields, preserving all TS/numerical expected/labels; record original and actual executed SHA and root mapping diff; never call original complete manifest passed if member scope is reduced"
}
` },
  { name: "packet/descriptor/prepare.mjs", sha256: "b421c038bba2f05bb208c476250ea72eef13a40971ddc89955e755720bfcfd00", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/descriptor/prepare.mjs", rootBindings: ["packet", "original"], body: `import {bindNode22} from '../binding/node-binding.mjs';
// Prepare via real public APIs, never by reconstructing C metadata.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root='/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts';
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const nodeBinding=await bindNode22(config);if(nodeBinding.status!=='VALID_TOOL_BINDING'){console.log(JSON.stringify({status:'INVALID',semanticAssertions:0,reason:nodeBinding.reason,receipt:nodeBinding.receipt}));process.exit(2);}
const old='/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts';
const spec=JSON.parse(fs.readFileSync(path.join(old,'spec.json'),'utf8'));
const owners=[path.join(old,'fixtures/owner-false'),path.join(old,'fixtures/owner-true'),path.join(old,'supplement-sync-self/fixtures/owner')];
const apiDir=path.dirname(fileURLToPath(config.apiModuleURL));
const bindingFiles=config.bindingFiles||Object.fromEntries(['prebuilt.ts','prebuilt-hook.ts','prebuilt-parent.ts','prebuilt-signals.ts'].map(n=>[n,path.join(apiDir,n)]));
const digest=p=>{try{return{state:'FILE',sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}}catch(e){if(e.code==='ENOENT')return{state:'MISSING'};throw e}};
const bind=()=>Object.fromEntries(Object.entries(bindingFiles).map(([k,p])=>[k,{path:p,...digest(p)}]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const expectedToyHashes={"/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts":"8fad32508329d70c7e47ba21b08bc022ca11e007f6f452fd47eedf6605ac5661","/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/state.ts":"4fb0716aab273efe16486f9b2e5435010b9a3b210dddf621f00a429aac116c6f","/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/scripts/entry.ts":"8fad32508329d70c7e47ba21b08bc022ca11e007f6f452fd47eedf6605ac5661","/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/scripts/state.ts":"4fb0716aab273efe16486f9b2e5435010b9a3b210dddf621f00a429aac116c6f","/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/main-alpha.ts":"dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7","/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/state-beta.ts":"aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588"};
const toySources=()=>Object.fromEntries(Object.keys(expectedToyHashes).map(file=>[file,digest(file)]));
for(const [file,sha]of Object.entries(expectedToyHashes))if(digest(file).sha256!==sha)throw new Error('frozen lifecycle toy SHA mismatch: '+file);
const before=bind(),sourceAtImport=toySources(),api=await import(config.apiModuleURL),calls=[];
if(!same(before,bind())||!same(sourceAtImport,toySources()))throw new Error('API/toy identity changed during import');
for(const owner of owners){const b=bind(),sourceBefore=toySources(),result=api.prebuildTree(owner),a=bind(),sourceAfter=toySources();if(!same(b,a)||!same(sourceBefore,sourceAfter))throw new Error('prebuild target/toy identity changed');calls.push({name:'prebuildTree',owner,result,before:b,after:a,sourceBefore,sourceAfter})}
const req=createRequire(path.join(config.publicResolutionOwner,'package.json')),cli=req.resolve('tsx/cli'),loader=pathToFileURL(req.resolve('tsx')).href;
const entryFalse=path.join(owners[0],'scripts/entry.ts'),entryTrue=path.join(owners[1],'scripts/entry.ts'),syncEntry=path.join(owners[2],'scripts/main-alpha.ts');
const selectionEnv={...process.env,...config.baseEnv};for(const key of config.unsetEnv||['TSX_TSCONFIG_PATH','NODE_OPTIONS','KOL_PREBUILT'])delete selectionEnv[key];
const loaderBefore=bind(),loaderSourceBefore=toySources(),selectedLoader=api.fixtureLoader(entryFalse,selectionEnv,path.join(old,'fixtures/no-config/leaf')),loaderAfter=bind();
const loaderSourceAfter=toySources();if(!same(loaderBefore,loaderAfter)||!same(loaderSourceBefore,loaderSourceAfter))throw new Error('fixtureLoader target/toy identity changed');
if(selectedLoader!==loader)throw new Error('V4.LOADER.N.PUBLIC_TSX named contract failure: actual fixtureLoader must return public tsx');
calls.push({name:'fixtureLoader',script:entryFalse,cwd:path.join(old,'fixtures/no-config/leaf'),value:selectedLoader,before:loaderBefore,after:loaderAfter,sourceBefore:loaderSourceBefore,sourceAfter:loaderSourceAfter});
const sourceHashes={};
for(const owner of owners)for(const n of fs.readdirSync(path.join(owner,'scripts')))if(n.endsWith('.ts')){const p=path.join(owner,'scripts',n);sourceHashes[p]=digest(p).sha256}
const witnessReceipts=[];
for(const p of config.cacheWitnessPayloads||[]){
 if(!fs.statSync(p).isFile()||!p.endsWith('.js'))throw new Error('witness must name opaque ordinary payload');
 const suffix=Buffer.from('\\n'+fs.readFileSync(path.join(old,'inputs/cache-witness-prefix.mjs.txt'),'utf8'));
 const payload=fs.readFileSync(p),alreadyHasOwnSuffix=payload.length>=suffix.length&&payload.subarray(payload.length-suffix.length).equals(suffix),beforeHash=digest(p);
 if(!alreadyHasOwnSuffix)fs.appendFileSync(p,suffix);
 witnessReceipts.push({path:p,before:beforeHash,after:digest(p),alreadyHasOwnSuffix,operation:'compare only test-owned exact EOF bytes; append fixed witness once; no payload body/key parsing'});
}
const selectionBefore=bind(),selectionSourceBefore=toySources(),preparationSelection=api.prebuiltCommand([entryFalse,...spec.args],path.join(old,'fixtures/no-config/leaf'),selectionEnv),selectionAfter=bind(),selectionSourceAfter=toySources();
if(!same(selectionBefore,selectionAfter)||!same(selectionSourceBefore,selectionSourceAfter))throw new Error('preparation selection binding changed');
calls.push({name:'prebuiltCommand',purpose:'opaque witness locator only; never reused as final-env C execution evidence',args:[entryFalse,...spec.args],cwd:path.join(old,'fixtures/no-config/leaf'),value:preparationSelection,before:selectionBefore,after:selectionAfter,sourceBefore:selectionSourceBefore,sourceAfter:selectionSourceAfter});
const commands={};for(const[key,entry]of[['mainFalse',entryFalse],['mainTrue',entryTrue],['missingEntry',path.join(owners[0],'scripts/entry-missing.ts')]]){
 const args=[entry,...spec.args];commands[key]={R:[config.node,[cli,...args]],C:[config.node,[cli,...args]]};
 // C is a schema placeholder only; lifecycle319 overrides it after final env with actual factory output.
}
const injection=config.childSpawnFailureImportURL;
const runtime={schemaVersion:4,node:config.node,publicResolutionOwner:config.publicResolutionOwner,publicCli:cli,publicTsxHookURL:loader,hookURL:selectedLoader,compilerOptionsIdentity:'{}',baseEnv:config.baseEnv||{},unsetEnv:config.unsetEnv||['TSX_TSCONFIG_PATH','NODE_OPTIONS','KOL_PREBUILT'],commands,producerModuleURL:config.apiModuleURL,producerBindingFiles:bindingFiles,producerSourceHashes:sourceHashes,producerPayloadDirectories:owners.map(o=>path.join(o,'.check-cache/prebuilt')),childSpawnFailureImportURL:injection||null,preparationAttestation:{preparedBy:'actual public prebuildTree calls; each C tuple selected from actual public factory after final env; hookURL is actual fixtureLoader output',sourceHashes,witnessPayloads:config.cacheWitnessPayloads||[],witnessEvidenceRequired:true},outputRoot:config.lifecycleOutputRoot||path.join(root,'lifecycle-runs')};
runtime.bindingFiles={...bindingFiles};for(const d of runtime.producerPayloadDirectories)if(fs.existsSync(d))for(const n of fs.readdirSync(d))if(n.endsWith('.js'))runtime.bindingFiles['payload:'+path.join(d,n)]=path.join(d,n);
runtime.nodeVersion=config.nodeVersion;runtime.nodePlatform=process.platform;runtime.nodeArch=process.arch;runtime.nodeBinding=nodeBinding;
runtime.descriptorReadyForLifecycle=Boolean(config.childSpawnFailureImportURL&&(config.cacheWitnessPayloads||[]).length);runtime.preparationSelectionForWitnessLocator=preparationSelection;runtime.witnessReceipts=witnessReceipts;
runtime.syncSelf={R:[config.node,[cli,syncEntry,...spec.args]],C:[config.node,[cli,syncEntry,...spec.args]]};
if(injection){const args=[entryFalse,...spec.args];runtime.childSpawnFailure={R:[config.node,['--import',injection,cli,...args]],C:[config.node,['--import',injection,cli,...args]]}}else runtime.childSpawnFailure=null;
const dest=config.lifecycleRuntimePath||path.join(root,'supplied-lifecycle-runtime.json');
fs.writeFileSync(dest,JSON.stringify(runtime,null,2)+'\\n');fs.writeFileSync(dest+'.preparation.json',JSON.stringify({before,after:bind(),sourceAtImport,sourceAfterPreparation:toySources(),calls,sourceHashes,witnessReceipts,cacheWitnessPayloads:config.cacheWitnessPayloads||[],bodyRead:false,placeholderCNotExecutionEvidence:true},null,2)+'\\n');
console.log(JSON.stringify({runtime:dest,preparedOwners:owners.length,witnessPaths:(config.cacheWitnessPayloads||[]).length,note:'execute lifecycle319 C final-env factory provider; static placeholder tuples are not target evidence'}));
` },
  { name: "packet/execution-members.json", sha256: "87c782181f75d33293088271503bc92e660d7aeb58003994371c74ce9b337934", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/execution-members.json", rootBindings: [], body: `{
  "entries": {
    "producer117": "producer/src/run.mjs",
    "lifecycle312": "lifecycle319/src/run.mjs",
    "sync7": "lifecycle319/sync/run.mjs",
    "ordinary4": "lifecycle319/preload/run.mjs",
    "prepare": "descriptor/prepare.mjs",
    "bindingQualificationOnly": "binding/node-binding.mjs"
  },
  "legacyPublicSnapshot": "producer/legacy-public-api/manifest.json",
  "requiredRuntimeFields": [
    "node=current process.execPath",
    "nodeVersion=current process.version",
    "publicResolutionOwner=current installed package root",
    "apiModuleURL=current real production public API URL",
    "bindingFiles4 actual paths",
    "legacyOwnerApiModuleURL and legacyOwnerBindingFiles3 explicit or bundled defaults"
  ],
  "requiredEmptyDirectory": "producer/inputs/fixtures/no-config/leaf",
  "originalLifecycleInputRoot": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts",
  "rootBindingRules": "portable-root-binding.json",
  "guardScope": "runtime-member-only port manifest, explicitly not original full old v4.2/full26 guard claim",
  "newNodePatchOrLinuxPairedVerdict": null
}
` },
  { name: "packet/lifecycle319/README.md", sha256: "9487cfb56d0d84eaa2706458d71bd5f7745b095e23a15dd046210faba6f96b86", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/README.md", rootBindings: [], body: `Actual public factory provider for main312. Original frozen semantic expected/TS/cases unchanged; v3.2 atomic go retained. C tuple is selected only after final child env is assembled. N observer uses actual fixtureLoader output supplied by real preparation, so explicit public tsx in final NODE_OPTIONS correctly returns CLI. Trusted module/cache and toy SHA are recorded before/after actual C execution.
` },
  { name: "packet/lifecycle319/cases.json", sha256: "6cc03748079d4461036a9a78080d548b06e5e464bd53f3cd1603020650a0d51c", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/cases.json", rootBindings: ["original"], body: `[
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.FALSE.NORMAL",
    "mode": "normal"
  },
  {
    "commandKey": "mainTrue",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/scripts/entry.ts",
    "id": "N.TRUE.NORMAL",
    "mode": "normal"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.NONZERO",
    "mode": "nonzero"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.THROW",
    "mode": "throw"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.OBSERVER",
    "mode": "observer"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.CACHE",
    "mode": "cache"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.EARLY_EXIT",
    "mode": "early-exit"
  },
  {
    "commandKey": "missingEntry",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry-missing.ts",
    "id": "N.MISSING_ENTRY",
    "mode": "normal",
    "missingEntry": true
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "OUTER.SPAWN_ENOENT",
    "mode": "normal",
    "outerSpawnFailure": true
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.CHILD_SPAWN_FAILURE",
    "mode": "normal",
    "childSpawnFailure": true
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SELF_TERM",
    "mode": "self-term",
    "signal": "SIGTERM",
    "target": "self"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGTERM.PARENT",
    "mode": "wait",
    "signal": "SIGTERM",
    "target": "parent",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGTERM.ENTRY",
    "mode": "wait",
    "signal": "SIGTERM",
    "target": "entry",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGTERM.GROUP",
    "mode": "wait",
    "signal": "SIGTERM",
    "target": "group",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGINT.PARENT",
    "mode": "wait",
    "signal": "SIGINT",
    "target": "parent",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGINT.ENTRY",
    "mode": "wait",
    "signal": "SIGINT",
    "target": "entry",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGINT.GROUP",
    "mode": "wait",
    "signal": "SIGINT",
    "target": "group",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGHUP.PARENT",
    "mode": "wait",
    "signal": "SIGHUP",
    "target": "parent",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGHUP.ENTRY",
    "mode": "wait",
    "signal": "SIGHUP",
    "target": "entry",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGHUP.GROUP",
    "mode": "wait",
    "signal": "SIGHUP",
    "target": "group",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGKILL.PARENT",
    "mode": "wait",
    "signal": "SIGKILL",
    "target": "parent",
    "parentKill": true
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGKILL.ENTRY",
    "mode": "wait",
    "signal": "SIGKILL",
    "target": "entry",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SIGKILL.GROUP",
    "mode": "wait",
    "signal": "SIGKILL",
    "target": "group",
    "parentKill": false
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.USER_HANDLER_TERM",
    "mode": "handler",
    "signal": "SIGTERM",
    "target": "entry"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.SYNC_BLOCK_GROUP_TERM",
    "mode": "blocked",
    "signal": "SIGTERM",
    "target": "group"
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.REPEAT_ENTRY_TERM",
    "mode": "repeat-handler",
    "signal": "SIGTERM",
    "target": "entry",
    "repeat": true
  },
  {
    "commandKey": "mainFalse",
    "owner": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false",
    "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
    "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "id": "N.DESCENDANT_GROUP_TERM",
    "mode": "descendant",
    "signal": "SIGTERM",
    "target": "group"
  }
]
` },
  { name: "packet/lifecycle319/expected.json", sha256: "c56153b3b830a9f959874c68df73cd324d96a25ded6d7b9c5090d311db21b05f", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/expected.json", rootBindings: [], body: `{
  "frozenBeforeExecution": true,
  "runtimeOracle": "R side is independently resolved locked public CLI, never product fallback or copied execution constants",
  "outputUpdatePolicy": "No semantic expected/label/threshold changes based on R/C output. Harness-only corrections after qualification preserve this frozen version and explain the tool error.",
  "properties": {
    "RAW": {
      "expected": "C.raw == R.raw including status versus terminating signal distinction",
      "source": "v3 root design signals; public CLI relational oracle; ADR158 public exit shell contract"
    },
    "CALLER": {
      "expected": "shellWait(C.raw) == shellWait(R.raw); shellWait(status,signal)=status or 128+signalNumber",
      "source": "ADR158 allowed lines37/51; independent consumer view, not product asTsx execution"
    },
    "HOOKS": {
      "expected": "ordered entry {order,code} hooks C=R, filtered to actual entry PID/main thread",
      "source": "ADR158 lines53-68; explicit v3 real-entry hook requirement"
    },
    "BOUNDARY_HOOKS": {
      "expected": "same-wiring external boundary hooks at actual entry PID/thread0 C=R",
      "source": "4-VERIFY real observer positive rule; v3 entry hook requirement"
    },
    "USER_HANDLER": {
      "expected": "ordered user callback {signal,count} C=R",
      "source": "v3 finite user handler and repeated TERM requirement"
    },
    "LIFECYCLE": {
      "expected": "C/R full-group completion, pre-cleanup stdio close and residual process roles equal; root exit alone never full completion",
      "source": "v3 completion design; root task parent-shell-first warning"
    },
    "NO_ORPHANS": {
      "expected": "non-parent-only-KILL cases complete full process group and stdio before harness cleanup",
      "source": "v3 startup/early exit/completion contract; no-child-residue requirement"
    },
    "ERROR_SURFACED": {
      "expected": "nonzero/no terminal signal/no entry success; missing entry names exact missing path with ERR_MODULE_NOT_FOUND, ENOENT or Cannot find module; internal spawn failure names ENOENT",
      "source": "v3 explicit startup errors; independently named nonexistent test input"
    },
    "ENTRY": {
      "expected": "one frozen entry eval on actual entry PID/thread0/mainThread",
      "source": "self-authored entry.ts fixed eval and public v3 real-entry identity requirement"
    },
    "VALUES": {
      "expected": "all fixture result fields other than per-process identity C=R, including default {} setter calls",
      "source": "prior public contract6/9 and v3 independent {} profile; no numeric default extrapolation"
    },
    "FIDELITY": {
      "expected": "value=29; exact frozen argv; exact external cwd, env token, Node execPath and original .ts entryURL",
      "source": "self-authored entry.ts literal value29; spec frozen args/token; public argv/address contract"
    },
    "OBSERVER_WIRING": {
      "expected": "boundary-boot with frozen source fingerprint in actual entry PID/thread0/mainThread",
      "source": "4-VERIFY observer zero-event qualification"
    },
    "SAME_INSTANCE_POSITIVE": {
      "expected": "observer source and state fingerprints match; one entry-main-thread observer event; result shared token positive; state evaluates once in same PID/thread",
      "source": "self-authored observer/state fixtures and 4-VERIFY real same-instance positive"
    },
    "CACHE_CONSUMED": {
      "expected": "exactly one test-owned opaque payload prefix event token in actual entry PID/thread0/mainThread",
      "source": "v3 actual cache consumption requirement; test-owned prefix never in TS source"
    },
    "THROW": {
      "expected": "fixed error sentinel present; ordered original .ts source frames equal R after line/column normalization",
      "source": "self-authored throw fixture and public original TS address/exception behavior"
    },
    "STDERR": {
      "expected": "nonthrow finite fixture stderr bytes C=R",
      "source": "v3 public visible behavior finite relation"
    },
    "EXPLICIT_EXIT": {
      "expected": "normal/observer/cache status0; explicit nonzero23; early-exit37; no signal; hooks [{order:1,code},{order:2,code}]",
      "source": "independently authored fixture normal return/process.exitCode23/process.exit37 and two synchronous exit handlers"
    },
    "SPAWN_ERROR": {
      "expected": "R and C outer OS spawn both return ENOENT",
      "source": "runner creates nonexistent absolute executable path; this does not cover internal child spawn"
    },
    "NO_CHILDREN": {
      "expected": "outer ENOENT created no PID on either side",
      "source": "OS spawn boundary, separate from candidate child-spawn lifecycle"
    },
    "ENTRY_READY": {
      "expected": "candidate reaches same ready/interaction point as qualified public reference; failure is product FAIL without sending unsafe signal",
      "source": "v3 ready-before-signal and actual-entry requirement"
    }
  },
  "cases": [
    {
      "id": "N.FALSE.NORMAL",
      "expectedLabelsOnQualifiedPair": [
        "N.FALSE.NORMAL.RAW",
        "N.FALSE.NORMAL.CALLER",
        "N.FALSE.NORMAL.HOOKS",
        "N.FALSE.NORMAL.BOUNDARY_HOOKS",
        "N.FALSE.NORMAL.USER_HANDLER",
        "N.FALSE.NORMAL.LIFECYCLE",
        "N.FALSE.NORMAL.NO_ORPHANS",
        "N.FALSE.NORMAL.ENTRY",
        "N.FALSE.NORMAL.VALUES",
        "N.FALSE.NORMAL.FIDELITY",
        "N.FALSE.NORMAL.OBSERVER_WIRING",
        "N.FALSE.NORMAL.STDERR",
        "N.FALSE.NORMAL.EXPLICIT_EXIT"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR",
        "EXPLICIT_EXIT"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.TRUE.NORMAL",
      "expectedLabelsOnQualifiedPair": [
        "N.TRUE.NORMAL.RAW",
        "N.TRUE.NORMAL.CALLER",
        "N.TRUE.NORMAL.HOOKS",
        "N.TRUE.NORMAL.BOUNDARY_HOOKS",
        "N.TRUE.NORMAL.USER_HANDLER",
        "N.TRUE.NORMAL.LIFECYCLE",
        "N.TRUE.NORMAL.NO_ORPHANS",
        "N.TRUE.NORMAL.ENTRY",
        "N.TRUE.NORMAL.VALUES",
        "N.TRUE.NORMAL.FIDELITY",
        "N.TRUE.NORMAL.OBSERVER_WIRING",
        "N.TRUE.NORMAL.STDERR",
        "N.TRUE.NORMAL.EXPLICIT_EXIT"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR",
        "EXPLICIT_EXIT"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.NONZERO",
      "expectedLabelsOnQualifiedPair": [
        "N.NONZERO.RAW",
        "N.NONZERO.CALLER",
        "N.NONZERO.HOOKS",
        "N.NONZERO.BOUNDARY_HOOKS",
        "N.NONZERO.USER_HANDLER",
        "N.NONZERO.LIFECYCLE",
        "N.NONZERO.NO_ORPHANS",
        "N.NONZERO.ENTRY",
        "N.NONZERO.VALUES",
        "N.NONZERO.FIDELITY",
        "N.NONZERO.OBSERVER_WIRING",
        "N.NONZERO.STDERR",
        "N.NONZERO.EXPLICIT_EXIT"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR",
        "EXPLICIT_EXIT"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.THROW",
      "expectedLabelsOnQualifiedPair": [
        "N.THROW.RAW",
        "N.THROW.CALLER",
        "N.THROW.HOOKS",
        "N.THROW.BOUNDARY_HOOKS",
        "N.THROW.USER_HANDLER",
        "N.THROW.LIFECYCLE",
        "N.THROW.NO_ORPHANS",
        "N.THROW.ENTRY",
        "N.THROW.VALUES",
        "N.THROW.FIDELITY",
        "N.THROW.OBSERVER_WIRING",
        "N.THROW.THROW"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "THROW"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.OBSERVER",
      "expectedLabelsOnQualifiedPair": [
        "N.OBSERVER.RAW",
        "N.OBSERVER.CALLER",
        "N.OBSERVER.HOOKS",
        "N.OBSERVER.BOUNDARY_HOOKS",
        "N.OBSERVER.USER_HANDLER",
        "N.OBSERVER.LIFECYCLE",
        "N.OBSERVER.NO_ORPHANS",
        "N.OBSERVER.ENTRY",
        "N.OBSERVER.VALUES",
        "N.OBSERVER.FIDELITY",
        "N.OBSERVER.OBSERVER_WIRING",
        "N.OBSERVER.SAME_INSTANCE_POSITIVE",
        "N.OBSERVER.STDERR",
        "N.OBSERVER.EXPLICIT_EXIT"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "SAME_INSTANCE_POSITIVE",
        "STDERR",
        "EXPLICIT_EXIT"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.CACHE",
      "expectedLabelsOnQualifiedPair": [
        "N.CACHE.RAW",
        "N.CACHE.CALLER",
        "N.CACHE.HOOKS",
        "N.CACHE.BOUNDARY_HOOKS",
        "N.CACHE.USER_HANDLER",
        "N.CACHE.LIFECYCLE",
        "N.CACHE.NO_ORPHANS",
        "N.CACHE.ENTRY",
        "N.CACHE.VALUES",
        "N.CACHE.FIDELITY",
        "N.CACHE.OBSERVER_WIRING",
        "N.CACHE.CACHE_CONSUMED",
        "N.CACHE.STDERR",
        "N.CACHE.EXPLICIT_EXIT"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "CACHE_CONSUMED",
        "STDERR",
        "EXPLICIT_EXIT"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.EARLY_EXIT",
      "expectedLabelsOnQualifiedPair": [
        "N.EARLY_EXIT.RAW",
        "N.EARLY_EXIT.CALLER",
        "N.EARLY_EXIT.HOOKS",
        "N.EARLY_EXIT.BOUNDARY_HOOKS",
        "N.EARLY_EXIT.USER_HANDLER",
        "N.EARLY_EXIT.LIFECYCLE",
        "N.EARLY_EXIT.NO_ORPHANS",
        "N.EARLY_EXIT.ENTRY",
        "N.EARLY_EXIT.VALUES",
        "N.EARLY_EXIT.FIDELITY",
        "N.EARLY_EXIT.OBSERVER_WIRING",
        "N.EARLY_EXIT.STDERR",
        "N.EARLY_EXIT.EXPLICIT_EXIT"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR",
        "EXPLICIT_EXIT"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.MISSING_ENTRY",
      "expectedLabelsOnQualifiedPair": [
        "N.MISSING_ENTRY.RAW",
        "N.MISSING_ENTRY.CALLER",
        "N.MISSING_ENTRY.HOOKS",
        "N.MISSING_ENTRY.BOUNDARY_HOOKS",
        "N.MISSING_ENTRY.USER_HANDLER",
        "N.MISSING_ENTRY.LIFECYCLE",
        "N.MISSING_ENTRY.NO_ORPHANS",
        "N.MISSING_ENTRY.ERROR_SURFACED"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ERROR_SURFACED"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "OUTER.SPAWN_ENOENT",
      "expectedLabelsOnQualifiedPair": [
        "OUTER.SPAWN_ENOENT.SPAWN_ERROR",
        "OUTER.SPAWN_ENOENT.NO_CHILDREN"
      ],
      "properties": [
        "SPAWN_ERROR",
        "NO_CHILDREN"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.CHILD_SPAWN_FAILURE",
      "expectedLabelsOnQualifiedPair": [
        "N.CHILD_SPAWN_FAILURE.RAW",
        "N.CHILD_SPAWN_FAILURE.CALLER",
        "N.CHILD_SPAWN_FAILURE.HOOKS",
        "N.CHILD_SPAWN_FAILURE.BOUNDARY_HOOKS",
        "N.CHILD_SPAWN_FAILURE.USER_HANDLER",
        "N.CHILD_SPAWN_FAILURE.LIFECYCLE",
        "N.CHILD_SPAWN_FAILURE.NO_ORPHANS",
        "N.CHILD_SPAWN_FAILURE.ERROR_SURFACED"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ERROR_SURFACED"
      ],
      "optionalNotRun": true,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SELF_TERM",
      "expectedLabelsOnQualifiedPair": [
        "N.SELF_TERM.RAW",
        "N.SELF_TERM.CALLER",
        "N.SELF_TERM.HOOKS",
        "N.SELF_TERM.BOUNDARY_HOOKS",
        "N.SELF_TERM.USER_HANDLER",
        "N.SELF_TERM.LIFECYCLE",
        "N.SELF_TERM.NO_ORPHANS",
        "N.SELF_TERM.ENTRY",
        "N.SELF_TERM.VALUES",
        "N.SELF_TERM.FIDELITY",
        "N.SELF_TERM.OBSERVER_WIRING",
        "N.SELF_TERM.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGTERM.PARENT",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGTERM.PARENT.RAW",
        "N.SIGTERM.PARENT.CALLER",
        "N.SIGTERM.PARENT.HOOKS",
        "N.SIGTERM.PARENT.BOUNDARY_HOOKS",
        "N.SIGTERM.PARENT.USER_HANDLER",
        "N.SIGTERM.PARENT.LIFECYCLE",
        "N.SIGTERM.PARENT.NO_ORPHANS",
        "N.SIGTERM.PARENT.ENTRY",
        "N.SIGTERM.PARENT.VALUES",
        "N.SIGTERM.PARENT.FIDELITY",
        "N.SIGTERM.PARENT.OBSERVER_WIRING",
        "N.SIGTERM.PARENT.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGTERM.ENTRY",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGTERM.ENTRY.RAW",
        "N.SIGTERM.ENTRY.CALLER",
        "N.SIGTERM.ENTRY.HOOKS",
        "N.SIGTERM.ENTRY.BOUNDARY_HOOKS",
        "N.SIGTERM.ENTRY.USER_HANDLER",
        "N.SIGTERM.ENTRY.LIFECYCLE",
        "N.SIGTERM.ENTRY.NO_ORPHANS",
        "N.SIGTERM.ENTRY.ENTRY",
        "N.SIGTERM.ENTRY.VALUES",
        "N.SIGTERM.ENTRY.FIDELITY",
        "N.SIGTERM.ENTRY.OBSERVER_WIRING",
        "N.SIGTERM.ENTRY.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGTERM.GROUP",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGTERM.GROUP.RAW",
        "N.SIGTERM.GROUP.CALLER",
        "N.SIGTERM.GROUP.HOOKS",
        "N.SIGTERM.GROUP.BOUNDARY_HOOKS",
        "N.SIGTERM.GROUP.USER_HANDLER",
        "N.SIGTERM.GROUP.LIFECYCLE",
        "N.SIGTERM.GROUP.NO_ORPHANS",
        "N.SIGTERM.GROUP.ENTRY",
        "N.SIGTERM.GROUP.VALUES",
        "N.SIGTERM.GROUP.FIDELITY",
        "N.SIGTERM.GROUP.OBSERVER_WIRING",
        "N.SIGTERM.GROUP.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGINT.PARENT",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGINT.PARENT.RAW",
        "N.SIGINT.PARENT.CALLER",
        "N.SIGINT.PARENT.HOOKS",
        "N.SIGINT.PARENT.BOUNDARY_HOOKS",
        "N.SIGINT.PARENT.USER_HANDLER",
        "N.SIGINT.PARENT.LIFECYCLE",
        "N.SIGINT.PARENT.NO_ORPHANS",
        "N.SIGINT.PARENT.ENTRY",
        "N.SIGINT.PARENT.VALUES",
        "N.SIGINT.PARENT.FIDELITY",
        "N.SIGINT.PARENT.OBSERVER_WIRING",
        "N.SIGINT.PARENT.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGINT.ENTRY",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGINT.ENTRY.RAW",
        "N.SIGINT.ENTRY.CALLER",
        "N.SIGINT.ENTRY.HOOKS",
        "N.SIGINT.ENTRY.BOUNDARY_HOOKS",
        "N.SIGINT.ENTRY.USER_HANDLER",
        "N.SIGINT.ENTRY.LIFECYCLE",
        "N.SIGINT.ENTRY.NO_ORPHANS",
        "N.SIGINT.ENTRY.ENTRY",
        "N.SIGINT.ENTRY.VALUES",
        "N.SIGINT.ENTRY.FIDELITY",
        "N.SIGINT.ENTRY.OBSERVER_WIRING",
        "N.SIGINT.ENTRY.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGINT.GROUP",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGINT.GROUP.RAW",
        "N.SIGINT.GROUP.CALLER",
        "N.SIGINT.GROUP.HOOKS",
        "N.SIGINT.GROUP.BOUNDARY_HOOKS",
        "N.SIGINT.GROUP.USER_HANDLER",
        "N.SIGINT.GROUP.LIFECYCLE",
        "N.SIGINT.GROUP.NO_ORPHANS",
        "N.SIGINT.GROUP.ENTRY",
        "N.SIGINT.GROUP.VALUES",
        "N.SIGINT.GROUP.FIDELITY",
        "N.SIGINT.GROUP.OBSERVER_WIRING",
        "N.SIGINT.GROUP.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGHUP.PARENT",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGHUP.PARENT.RAW",
        "N.SIGHUP.PARENT.CALLER",
        "N.SIGHUP.PARENT.HOOKS",
        "N.SIGHUP.PARENT.BOUNDARY_HOOKS",
        "N.SIGHUP.PARENT.USER_HANDLER",
        "N.SIGHUP.PARENT.LIFECYCLE",
        "N.SIGHUP.PARENT.ENTRY",
        "N.SIGHUP.PARENT.VALUES",
        "N.SIGHUP.PARENT.FIDELITY",
        "N.SIGHUP.PARENT.OBSERVER_WIRING",
        "N.SIGHUP.PARENT.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGHUP.ENTRY",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGHUP.ENTRY.RAW",
        "N.SIGHUP.ENTRY.CALLER",
        "N.SIGHUP.ENTRY.HOOKS",
        "N.SIGHUP.ENTRY.BOUNDARY_HOOKS",
        "N.SIGHUP.ENTRY.USER_HANDLER",
        "N.SIGHUP.ENTRY.LIFECYCLE",
        "N.SIGHUP.ENTRY.NO_ORPHANS",
        "N.SIGHUP.ENTRY.ENTRY",
        "N.SIGHUP.ENTRY.VALUES",
        "N.SIGHUP.ENTRY.FIDELITY",
        "N.SIGHUP.ENTRY.OBSERVER_WIRING",
        "N.SIGHUP.ENTRY.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGHUP.GROUP",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGHUP.GROUP.RAW",
        "N.SIGHUP.GROUP.CALLER",
        "N.SIGHUP.GROUP.HOOKS",
        "N.SIGHUP.GROUP.BOUNDARY_HOOKS",
        "N.SIGHUP.GROUP.USER_HANDLER",
        "N.SIGHUP.GROUP.LIFECYCLE",
        "N.SIGHUP.GROUP.NO_ORPHANS",
        "N.SIGHUP.GROUP.ENTRY",
        "N.SIGHUP.GROUP.VALUES",
        "N.SIGHUP.GROUP.FIDELITY",
        "N.SIGHUP.GROUP.OBSERVER_WIRING",
        "N.SIGHUP.GROUP.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGKILL.PARENT",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGKILL.PARENT.RAW",
        "N.SIGKILL.PARENT.CALLER",
        "N.SIGKILL.PARENT.HOOKS",
        "N.SIGKILL.PARENT.BOUNDARY_HOOKS",
        "N.SIGKILL.PARENT.USER_HANDLER",
        "N.SIGKILL.PARENT.LIFECYCLE",
        "N.SIGKILL.PARENT.ENTRY",
        "N.SIGKILL.PARENT.VALUES",
        "N.SIGKILL.PARENT.FIDELITY",
        "N.SIGKILL.PARENT.OBSERVER_WIRING",
        "N.SIGKILL.PARENT.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGKILL.ENTRY",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGKILL.ENTRY.RAW",
        "N.SIGKILL.ENTRY.CALLER",
        "N.SIGKILL.ENTRY.HOOKS",
        "N.SIGKILL.ENTRY.BOUNDARY_HOOKS",
        "N.SIGKILL.ENTRY.USER_HANDLER",
        "N.SIGKILL.ENTRY.LIFECYCLE",
        "N.SIGKILL.ENTRY.NO_ORPHANS",
        "N.SIGKILL.ENTRY.ENTRY",
        "N.SIGKILL.ENTRY.VALUES",
        "N.SIGKILL.ENTRY.FIDELITY",
        "N.SIGKILL.ENTRY.OBSERVER_WIRING",
        "N.SIGKILL.ENTRY.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SIGKILL.GROUP",
      "expectedLabelsOnQualifiedPair": [
        "N.SIGKILL.GROUP.RAW",
        "N.SIGKILL.GROUP.CALLER",
        "N.SIGKILL.GROUP.HOOKS",
        "N.SIGKILL.GROUP.BOUNDARY_HOOKS",
        "N.SIGKILL.GROUP.USER_HANDLER",
        "N.SIGKILL.GROUP.LIFECYCLE",
        "N.SIGKILL.GROUP.NO_ORPHANS",
        "N.SIGKILL.GROUP.ENTRY",
        "N.SIGKILL.GROUP.VALUES",
        "N.SIGKILL.GROUP.FIDELITY",
        "N.SIGKILL.GROUP.OBSERVER_WIRING",
        "N.SIGKILL.GROUP.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.USER_HANDLER_TERM",
      "expectedLabelsOnQualifiedPair": [
        "N.USER_HANDLER_TERM.RAW",
        "N.USER_HANDLER_TERM.CALLER",
        "N.USER_HANDLER_TERM.HOOKS",
        "N.USER_HANDLER_TERM.BOUNDARY_HOOKS",
        "N.USER_HANDLER_TERM.USER_HANDLER",
        "N.USER_HANDLER_TERM.LIFECYCLE",
        "N.USER_HANDLER_TERM.NO_ORPHANS",
        "N.USER_HANDLER_TERM.ENTRY",
        "N.USER_HANDLER_TERM.VALUES",
        "N.USER_HANDLER_TERM.FIDELITY",
        "N.USER_HANDLER_TERM.OBSERVER_WIRING",
        "N.USER_HANDLER_TERM.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.SYNC_BLOCK_GROUP_TERM",
      "expectedLabelsOnQualifiedPair": [
        "N.SYNC_BLOCK_GROUP_TERM.RAW",
        "N.SYNC_BLOCK_GROUP_TERM.CALLER",
        "N.SYNC_BLOCK_GROUP_TERM.HOOKS",
        "N.SYNC_BLOCK_GROUP_TERM.BOUNDARY_HOOKS",
        "N.SYNC_BLOCK_GROUP_TERM.USER_HANDLER",
        "N.SYNC_BLOCK_GROUP_TERM.LIFECYCLE",
        "N.SYNC_BLOCK_GROUP_TERM.NO_ORPHANS",
        "N.SYNC_BLOCK_GROUP_TERM.ENTRY",
        "N.SYNC_BLOCK_GROUP_TERM.VALUES",
        "N.SYNC_BLOCK_GROUP_TERM.FIDELITY",
        "N.SYNC_BLOCK_GROUP_TERM.OBSERVER_WIRING",
        "N.SYNC_BLOCK_GROUP_TERM.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.REPEAT_ENTRY_TERM",
      "expectedLabelsOnQualifiedPair": [
        "N.REPEAT_ENTRY_TERM.RAW",
        "N.REPEAT_ENTRY_TERM.CALLER",
        "N.REPEAT_ENTRY_TERM.HOOKS",
        "N.REPEAT_ENTRY_TERM.BOUNDARY_HOOKS",
        "N.REPEAT_ENTRY_TERM.USER_HANDLER",
        "N.REPEAT_ENTRY_TERM.LIFECYCLE",
        "N.REPEAT_ENTRY_TERM.NO_ORPHANS",
        "N.REPEAT_ENTRY_TERM.ENTRY",
        "N.REPEAT_ENTRY_TERM.VALUES",
        "N.REPEAT_ENTRY_TERM.FIDELITY",
        "N.REPEAT_ENTRY_TERM.OBSERVER_WIRING",
        "N.REPEAT_ENTRY_TERM.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    },
    {
      "id": "N.DESCENDANT_GROUP_TERM",
      "expectedLabelsOnQualifiedPair": [
        "N.DESCENDANT_GROUP_TERM.RAW",
        "N.DESCENDANT_GROUP_TERM.CALLER",
        "N.DESCENDANT_GROUP_TERM.HOOKS",
        "N.DESCENDANT_GROUP_TERM.BOUNDARY_HOOKS",
        "N.DESCENDANT_GROUP_TERM.USER_HANDLER",
        "N.DESCENDANT_GROUP_TERM.LIFECYCLE",
        "N.DESCENDANT_GROUP_TERM.NO_ORPHANS",
        "N.DESCENDANT_GROUP_TERM.ENTRY",
        "N.DESCENDANT_GROUP_TERM.VALUES",
        "N.DESCENDANT_GROUP_TERM.FIDELITY",
        "N.DESCENDANT_GROUP_TERM.OBSERVER_WIRING",
        "N.DESCENDANT_GROUP_TERM.STDERR"
      ],
      "properties": [
        "RAW",
        "CALLER",
        "HOOKS",
        "BOUNDARY_HOOKS",
        "USER_HANDLER",
        "LIFECYCLE",
        "NO_ORPHANS",
        "ENTRY",
        "VALUES",
        "FIDELITY",
        "OBSERVER_WIRING",
        "STDERR"
      ],
      "optionalNotRun": false,
      "qualification": "R public CLI must establish frozen input and actual-entry observer positive. Infrastructure invalid emits zero semantic assertions. Candidate ready/interaction failure emits only named ENTRY_READY FAIL."
    }
  ],
  "finiteTotalCases": 27,
  "qualifiedSemanticLabels": 312,
  "oldPrototype1": "unchanged and outside this new directory",
  "overlayAuthority": "root MESSAGE explicitly adjudicated parent-only SIGHUP as default-termination boundary; no candidate had executed; original no-descendant requirement applies startup failure/early exit",
  "onlySemanticChange": "Remove N.SIGHUP.PARENT.NO_ORPHANS; retain RAW/CALLER/real entry hooks/LIFECYCLE residual-role equality; all timing/input/other expected unchanged"
}
` },
  { name: "packet/lifecycle319/freeze-manifest.json", sha256: "8e75b818b0baf50e4ddddffefe23ec57393ea133f1cc0fd908b27415e6cc2055", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/freeze-manifest.json", rootBindings: [], body: `{
  "version": "Node22-v4.2-runtime-members-only",
  "frozenAtUtc": "2026-10-25T09:06:48.669517+00:00",
  "scope": "runtime members only; old full-guard/provenance artifacts not claimed",
  "files": [
    {
      "path": "README.md",
      "sha256": "9487cfb56d0d84eaa2706458d71bd5f7745b095e23a15dd046210faba6f96b86",
      "bytes": 405
    },
    {
      "path": "cases.json",
      "sha256": "6cc03748079d4461036a9a78080d548b06e5e464bd53f3cd1603020650a0d51c",
      "bytes": 12320
    },
    {
      "path": "expected.json",
      "sha256": "c56153b3b830a9f959874c68df73cd324d96a25ded6d7b9c5090d311db21b05f",
      "bytes": 33379
    },
    {
      "path": "preload/README.md",
      "sha256": "099fb7a365dd7407d77ebd32df8b128a7f59786afc8c9d1352f14f8e6ee5ebf4",
      "bytes": 407
    },
    {
      "path": "preload/ordinary-preload.mjs",
      "sha256": "56620e06760cd26db5d95ae84800cdacc3377e07a25a6fb43770a86eb7912e22",
      "bytes": 1374
    },
    {
      "path": "preload/run.mjs",
      "sha256": "bcde72029a299beabb6b913fcfa5e520f2ffe69eb8ab74d409fdcba62ed604c6",
      "bytes": 9474
    },
    {
      "path": "preload/spec.json",
      "sha256": "604baa588ea7b89f26bf20c42e27a92d2c0c1976d0803bc5bead6c931a6ac18e",
      "bytes": 2509
    },
    {
      "path": "spec.json",
      "sha256": "15616faf9adb0bd24dda2c6b6167ace0904f1eac8522636e0ad4a5e9db73edce",
      "bytes": 1622
    },
    {
      "path": "src/boundary-observer.mjs",
      "sha256": "16ea6f135a334fe739920a6cd66afc629afed5f5bbd7edb2f16afc6e27b11576",
      "bytes": 475
    },
    {
      "path": "src/observer.mjs",
      "sha256": "7200e9a35b89dfc43f29736e683b2538d96578addb9a01d4d527694ccea0af2f",
      "bytes": 603
    },
    {
      "path": "src/run.mjs",
      "sha256": "de1a73c9a40eb3523d9a1e14bc4c682d3b6ed5910de4a6b1cce143f6b06bf9c5",
      "bytes": 29754
    },
    {
      "path": "sync/README.md",
      "sha256": "a4046831440f47e39c75f4769f67b85d96b24ed30b13ca1af3fc6181222e8d25",
      "bytes": 403
    },
    {
      "path": "sync/expected.json",
      "sha256": "50222826781a9da0dc75a24e7e1eb98a365ea6903572a0ab99dbaeec4701ab93",
      "bytes": 1485
    },
    {
      "path": "sync/run.mjs",
      "sha256": "474c874be95192e403bf037d253b22ac2c61f159444096ffd444a53d4b76ec8f",
      "bytes": 12022
    }
  ]
}
` },
  { name: "packet/lifecycle319/preload/README.md", sha256: "099fb7a365dd7407d77ebd32df8b128a7f59786afc8c9d1352f14f8e6ee5ebf4", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/preload/README.md", rootBindings: [], body: `Actual public factory provider for ordinary4. Original frozen semantic expected/TS/cases unchanged; v3.2 atomic go retained. C tuple is selected only after final child env is assembled. N observer uses actual fixtureLoader output supplied by real preparation, so explicit public tsx in final NODE_OPTIONS correctly returns CLI. Trusted module/cache and toy SHA are recorded before/after actual C execution.
` },
  { name: "packet/lifecycle319/preload/freeze-manifest.json", sha256: "66ace09e7f3b77144382c0acea666871d9d15373be09e399dc5b8366c8742c6a", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/preload/freeze-manifest.json", rootBindings: [], body: `{
  "version": "Node22-v4.2-runtime-members-only",
  "frozenAtUtc": "2026-10-25T09:06:48.668551+00:00",
  "scope": "runtime members only; old full-guard/provenance artifacts not claimed",
  "files": [
    {
      "path": "README.md",
      "sha256": "099fb7a365dd7407d77ebd32df8b128a7f59786afc8c9d1352f14f8e6ee5ebf4",
      "bytes": 407
    },
    {
      "path": "ordinary-preload.mjs",
      "sha256": "56620e06760cd26db5d95ae84800cdacc3377e07a25a6fb43770a86eb7912e22",
      "bytes": 1374
    },
    {
      "path": "run.mjs",
      "sha256": "bcde72029a299beabb6b913fcfa5e520f2ffe69eb8ab74d409fdcba62ed604c6",
      "bytes": 9474
    },
    {
      "path": "spec.json",
      "sha256": "604baa588ea7b89f26bf20c42e27a92d2c0c1976d0803bc5bead6c931a6ac18e",
      "bytes": 2509
    }
  ]
}
` },
  { name: "packet/lifecycle319/preload/ordinary-preload.mjs", sha256: "56620e06760cd26db5d95ae84800cdacc3377e07a25a6fb43770a86eb7912e22", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/preload/ordinary-preload.mjs", rootBindings: [], body: `import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { threadId, isMainThread } from 'node:worker_threads';
const entry = process.env.V4_PRELOAD_ENTRY;
const identity = { pid: process.pid, ppid: process.ppid, threadId, isMainThread, argv1: process.argv[1], knownEntry: entry };
const actualEntry = process.argv[1] === entry;
appendFileSync(process.env.V4_PRELOAD_LOG, JSON.stringify({ kind: 'preload-boot', ...identity, actualEntry }) + '\\n');
if (!actualEntry) {
  setInterval(() => {}, 1000);
  appendFileSync(process.env.V4_PRELOAD_LOG, JSON.stringify({ kind: 'keepalive-registered', ...identity }) + '\\n');
} else if (isMainThread) {
  // A synchronous test-only gate permits PGID proof before normal entry evaluation.
  // It creates no live handle and does not change the entry's code or cached payload.
  writeFileSync(process.env.V4_PRELOAD_READY, JSON.stringify({ ...identity, token: process.env.V4_PRELOAD_TOKEN }) + '\\n');
  const cell = new Int32Array(new SharedArrayBuffer(4));
  const started = Date.now();
  while (!existsSync(process.env.V4_PRELOAD_GO)) {
    if (Date.now() - started > 5000) throw new Error('V4_PRELOAD_GO_TIMEOUT');
    Atomics.wait(cell, 0, 0, 1);
  }
  if (JSON.parse(readFileSync(process.env.V4_PRELOAD_GO, 'utf8')).token !== process.env.V4_PRELOAD_TOKEN) throw new Error('V4_PRELOAD_BAD_TOKEN');
}
` },
  { name: "packet/lifecycle319/preload/run.mjs", sha256: "bcde72029a299beabb6b913fcfa5e520f2ffe69eb8ab74d409fdcba62ed604c6", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/preload/run.mjs", rootBindings: [], body: `import { bindNode22, assertBoundCarrier } from '../../binding/node-binding.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const runtime = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const nodeBinding=await bindNode22(runtime);if(nodeBinding.status!=='VALID_TOOL_BINDING'){console.log(JSON.stringify({status:'INVALID',semanticAssertions:0,reason:nodeBinding.reason,receipt:nodeBinding.receipt}));process.exit(2);}

const spec = JSON.parse(fs.readFileSync(path.join(here, 'spec.json'), 'utf8'));
const out = path.join(runtime.outputRoot || path.join(here, 'runs'), 'ordinary-preload-' + Date.now());
fs.mkdirSync(out, { recursive: true });
const hash = file => { try { return { state: 'FILE', sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }; } catch (e) { if (e.code === 'ENOENT') return { state: 'MISSING' }; throw e; } };
const bindings = () => Object.fromEntries(Object.entries(runtime.bindingFiles).map(([key, file]) => [key, { file, ...hash(file) }]));
const sources = () => Object.fromEntries(Object.keys(spec.sourceHashes).map(file => [file, hash(file)]));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const ps = () => { const p=spawnSync('/bin/ps',['-axo','pid=,ppid=,pgid=,stat='],{encoding:'utf8'}); if(p.error||p.status)throw new Error('ps unavailable'); return p.stdout.split('\\n').map(l=>l.trim().split(/\\s+/)).filter(v=>v.length===4).map(([pid,ppid,pgid,stat])=>({pid:+pid,ppid:+ppid,pgid:+pgid,stat})); };
const active = p => !p.stat.startsWith('Z');
const rows = file => fs.existsSync(file) ? fs.readFileSync(file,'utf8').split('\\n').filter(Boolean).map(l=>JSON.parse(l)) : [];
async function run(side, tuple) {
  const dir=path.join(out,side);fs.mkdirSync(dir);
  const log=path.join(dir,'preload.jsonl'),readyFile=path.join(dir,'ready.jsonl'),go=path.join(dir,'go.jsonl');
  const token=crypto.randomBytes(12).toString('hex');
  const env={...process.env,...runtime.baseEnv};for(const k of runtime.unsetEnv||[])delete env[k];
  Object.assign(env,{CONTRACT_MODE:'normal',CONTRACT_ENV_TOKEN:spec.envToken,CONTRACT_ENTRY_LOG:path.join(dir,'entry.jsonl'),CONTRACT_STATE_LOG:path.join(dir,'state.jsonl'),V4_PRELOAD_ENTRY:spec.entry,V4_PRELOAD_LOG:log,V4_PRELOAD_READY:readyFile,V4_PRELOAD_GO:go,V4_PRELOAD_TOKEN:token});
  env.NODE_OPTIONS=[env.NODE_OPTIONS||'','--import='+pathToFileURL(path.join(here,'ordinary-preload.mjs')).href].filter(Boolean).join(' ');
  const record={side,tuple,rawBeforeCleanup:null,stdout:'',stderr:'',ready:null,proof:null,closeBeforeCleanup:false,infrastructureError:null};
  let child,own,isolated=false,raw=null,closed=false;
  try {
    record.bindingBefore=bindings();record.sourceBefore=sources();
    own=ps().find(p=>p.pid===process.pid)?.pgid;if(!own)throw new Error('runner PGID absent');
    if(side==='C'&&runtime.producerModuleURL){const producer=await import(runtime.producerModuleURL);record.actualFactoryInput={args:spec.entryArgs,cwd:spec.cwd,NODE_OPTIONS:env.NODE_OPTIONS};tuple=producer.prebuiltCommand(spec.entryArgs,spec.cwd,env);record.tuple=tuple;}
    assertBoundCarrier(tuple,runtime);
    child=spawn(tuple[0],tuple[1],{cwd:spec.cwd,env,detached:true,stdio:['ignore','pipe','pipe']});
    record.rootPid=child.pid;
    child.stdout.on('data',b=>record.stdout+=b);child.stderr.on('data',b=>record.stderr+=b);child.once('error',e=>raw={status:null,signal:null,error:e.code});child.once('exit',(status,signal)=>raw={status,signal,error:null});child.once('close',()=>closed=true);
    const at=Date.now();
    while(Date.now()-at<spec.readyTimeoutMs&&!raw){
      const table=ps(),rootRow=table.find(p=>p.pid===child.pid);
      if(rootRow){if(rootRow.pgid!==child.pid||rootRow.pgid===own)throw new Error('isolated PGID proof failed');isolated=true;}
      if(fs.existsSync(readyFile)){
        const ready=rows(readyFile)[0],entryRow=table.find(p=>p.pid===ready.pid);
        if(!isolated||ready.token!==token||ready.argv1!==spec.entry||ready.threadId!==0||ready.isMainThread!==true||!entryRow||entryRow.pgid!==child.pid||entryRow.ppid!==child.pid)throw new Error('real entry preload/PGID proof failed');
        record.ready=ready;record.proof={runnerPid:process.pid,runnerPgid:own,isolatedPgid:child.pid,entryPid:ready.pid,members:table.filter(p=>p.pgid===child.pid)};
        const temp=go+'.tmp-'+process.pid;fs.writeFileSync(temp,JSON.stringify({token})+'\\n');fs.renameSync(temp,go);break;
      }
      await sleep(5);
    }
    const settle=Date.now();
    while(Date.now()-settle<spec.settleTimeoutMs){if(raw&&closed&&!ps().some(p=>p.pgid===child.pid&&active(p)))break;await sleep(5);}
    record.rawBeforeCleanup=raw;record.closeBeforeCleanup=closed;record.residualBeforeCleanup=ps().filter(p=>p.pgid===child.pid&&active(p));
    record.events=rows(log);record.result=record.stdout.split('\\n').filter(l=>l.startsWith('@@RESULT@@')).map(l=>JSON.parse(l.slice(10)))[0]||null;
    if(record.residualBeforeCleanup.length){
      if(!isolated||!record.ready||ps().find(p=>p.pid===process.pid)?.pgid!==own||child.pid===own)throw new Error('cleanup safety proof missing');
      record.cleanup={signal:'SIGKILL',pgid:child.pid,afterObservation:true};process.kill(-child.pid,'SIGKILL');
      const clean=Date.now();while(Date.now()-clean<2000&&ps().some(p=>p.pgid===child.pid&&active(p)))await sleep(5);
      if(ps().some(p=>p.pgid===child.pid&&active(p)))throw new Error('cleanup failed');
    }
    record.bindingAfter=bindings();record.sourceAfter=sources();
    if(!same(record.bindingBefore,record.bindingAfter)||!same(record.sourceBefore,record.sourceAfter))throw new Error('candidate/source identity changed during target');
  }catch(e){record.infrastructureError=e.message;try{if(isolated&&child?.pid!==own&&ps().find(p=>p.pid===process.pid)?.pgid===own)process.kill(-child.pid,'SIGKILL');}catch{}}
  fs.writeFileSync(path.join(dir,'record.json'),JSON.stringify(record,null,2)+'\\n');return record;
}
const report={nodeBinding,case:'V4.ORDINARY_PRELOAD_PARENT_KEEPALIVE',status:'INVALID',semanticAssertions:0,assertions:[]};
try{
  const manifest=JSON.parse(fs.readFileSync(path.join(here,'freeze-manifest.json'),'utf8'));
  for(const f of manifest.files)if(hash(path.join(here,f.path)).sha256!==f.sha256)throw new Error('frozen preload test changed: '+f.path);
  for(const [file,sha] of Object.entries(spec.sourceHashes))if(hash(file).sha256!==sha)throw new Error('frozen 319 source changed');
  const pair=runtime.commands.mainFalse;
  const publicCli=createRequire(path.join(runtime.publicResolutionOwner,'package.json')).resolve('tsx/cli');
  if(pair.R[0]!==runtime.node||pair.R[1][0]!==publicCli)throw new Error('R is not independently resolved public CLI');
  for(const side of ['R','C'])if(!same(pair[side][1].slice(-spec.entryArgs.length),spec.entryArgs))throw new Error('tuple changed frozen entry args');
  const qualify=record=>!record.infrastructureError&&record.ready&&record.result?.pid===record.ready.pid&&record.result.threadId===0&&record.result.isMainThread===true&&record.events.some(e=>e.kind==='keepalive-registered'&&e.pid===record.rootPid&&e.threadId===0&&e.isMainThread===true&&e.argv1!==spec.entry)&&record.events.some(e=>e.kind==='preload-boot'&&e.actualEntry===true&&e.pid===record.result.pid&&e.threadId===0)&&!record.events.some(e=>e.kind==='keepalive-registered'&&e.pid===record.result.pid&&e.threadId===0);
  const R=await run('R',pair.R);report.R=R;
  if(!qualify(R)||R.rawBeforeCleanup?.status!==0||R.rawBeforeCleanup.signal!==null||!R.closeBeforeCleanup||R.residualBeforeCleanup.length)throw new Error('public R preload qualification invalid; no product assertions');
  const C=await run('C',pair.C);report.C=C;if(C.infrastructureError)throw new Error(C.infrastructureError);
  const check=(label,ok,expected,actual)=>report.assertions.push({label:'V4.PRELOAD.'+label,status:ok?'PASS':'FAIL',expected,actual});
  check('IDENTITIES',qualify(C),'parent keepalive registered; actual entry PID/main thread saw preload and created no live handle',{rootPid:C.rootPid,ready:C.ready,result:C.result,events:C.events});
  check('NORMAL_COMPLETION',C.rawBeforeCleanup?.status===0&&C.rawBeforeCleanup.signal===null&&C.closeBeforeCleanup,'normal entry finishes with raw0/null and pipe close despite ordinary parent preload live handle',{raw:C.rawBeforeCleanup,closed:C.closeBeforeCleanup});
  check('NO_RESIDUAL',C.residualBeforeCleanup.length===0,'no parent/entry/descendants remain before harness cleanup',C.residualBeforeCleanup);
  check('STDERR',C.stderr===R.stderr,'same finite normal stderr as public CLI',{R:R.stderr,C:C.stderr});
  report.semanticAssertions=report.assertions.length;report.status=report.assertions.every(a=>a.status==='PASS')?'PASS':'FAIL';
}catch(e){report.reason=e.message;report.status='INVALID';report.semanticAssertions=0;report.assertions=[];}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\\n');console.log(JSON.stringify({status:report.status,semanticAssertions:report.semanticAssertions,report:path.join(out,'report.json'),reason:report.reason}));process.exitCode=report.status==='PASS'?0:report.status==='INVALID'?2:1;
` },
  { name: "packet/lifecycle319/preload/spec.json", sha256: "604baa588ea7b89f26bf20c42e27a92d2c0c1976d0803bc5bead6c931a6ac18e", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/preload/spec.json", rootBindings: ["original"], body: `{
  "case": "V4.ORDINARY_PRELOAD_PARENT_KEEPALIVE",
  "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
  "entryArgs": [
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts",
    "arg-one",
    "arg with space",
    "--literal-script-arg"
  ],
  "args": [
    "arg-one",
    "arg with space",
    "--literal-script-arg"
  ],
  "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
  "envToken": "contract-v3-env-token-671",
  "sourceHashes": {
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts": "8fad32508329d70c7e47ba21b08bc022ca11e007f6f452fd47eedf6605ac5661",
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/state.ts": "4fb0716aab273efe16486f9b2e5435010b9a3b210dddf621f00a429aac116c6f",
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/scripts/entry.ts": "8fad32508329d70c7e47ba21b08bc022ca11e007f6f452fd47eedf6605ac5661",
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/scripts/state.ts": "4fb0716aab273efe16486f9b2e5435010b9a3b210dddf621f00a429aac116c6f",
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/main-alpha.ts": "dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7",
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/state-beta.ts": "aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588"
  },
  "readyTimeoutMs": 5000,
  "settleTimeoutMs": 5000,
  "livenessDeadlinePurpose": "finite completion observation only; no performance threshold",
  "expectedBeforeExecution": {
    "IDENTITIES": "real CLI/own parent PID main thread registers keepalive; actual entry PID sees same preload and no keepalive",
    "NORMAL_COMPLETION": "normal entry completes raw status0/signalnull, pipes close",
    "NO_RESIDUAL": "no active isolated parent/entry/descendants before tool cleanup",
    "STDERR": "C=qualified public CLI R"
  },
  "invalid": "R cannot complete or ps/identity/source binding fails: INVALID with zero semantic assertions, never product red",
  "sourceBoundary": "existing frozen 319 mainFalse source and cache used unchanged; synchronous preload go gate creates no live entry handle"
}
` },
  { name: "packet/lifecycle319/spec.json", sha256: "15616faf9adb0bd24dda2c6b6167ace0904f1eac8522636e0ad4a5e9db73edce", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/spec.json", rootBindings: [], body: `{
  "version": 3,
  "baseline": "5b0f10af6b86f43425181bbf25c92f81b7feea9b",
  "scope": "finite N-domain thin parent black-box compatibility only",
  "args": [
    "arg-one",
    "arg with space",
    "--literal-script-arg"
  ],
  "envToken": "contract-v3-env-token-671",
  "observerToken": "contract-v3-same-instance-positive-601",
  "cacheToken": "contract-v3-cache-consumption-5021",
  "entryFingerprint": "0520bc40de12306139243f769b4ae00cdca2609f1e45a4643603822e07b7e4b3",
  "stateFingerprint": "80860a7ffe9dbff3c23806a5d70663f6944649e76a5c9ded6dbc93609e25e338",
  "observerFingerprint": "38bfbe4bfe830bd18be2489acb1c47f5c89e6b3a4aa350992bcb1882cfe763c5",
  "boundaryFingerprint": "681c0a435ec9f73847ff726047172fce83c5ca4f1863f18cc1bd497dfd987b21",
  "readyTimeoutMs": 5000,
  "settleTimeoutMs": 5000,
  "orphanObservationMs": 600,
  "cleanupTimeoutMs": 2000,
  "quietMs": 100,
  "timingPurpose": "finite safety/liveness deadlines only; no performance threshold or conclusion",
  "oracle": "live independent public tsx/cli with same Node/input/cwd/env; relational expressions frozen before first execution; never copy output into constants",
  "compilerOptions": "independent {} identity; source below owner true/false is executed with external all-ancestor-no-config cwd",
  "notClaimed": [
    "all tsx CLI/options/watch modes",
    "production caller asTsx implementation",
    "owner bare / direct Node / IPC domains",
    "selection/fallback producer internals",
    "unknown or unreadable/configured/disabled cache selection already belongs to existing frozen producer tests",
    "performance improvement"
  ]
}
` },
  { name: "packet/lifecycle319/src/boundary-observer.mjs", sha256: "16ea6f135a334fe739920a6cd66afc629afed5f5bbd7edb2f16afc6e27b11576", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/src/boundary-observer.mjs", rootBindings: [], body: `import { appendFileSync } from 'node:fs';
import { isMainThread, threadId } from 'node:worker_threads';
const fingerprint = '681c0a435ec9f73847ff726047172fce83c5ca4f1863f18cc1bd497dfd987b21';
const log = row => appendFileSync(process.env.CONTRACT_BOUNDARY_LOG, JSON.stringify({ ...row, fingerprint, pid: process.pid, ppid: process.ppid, threadId, isMainThread }) + '\\n');
log({ kind: 'boundary-boot' });
process.on('exit', code => log({ kind: 'boundary-exit-hook', code }));
` },
  { name: "packet/lifecycle319/src/observer.mjs", sha256: "7200e9a35b89dfc43f29736e683b2538d96578addb9a01d4d527694ccea0af2f", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/src/observer.mjs", rootBindings: [], body: `import { appendFileSync } from 'node:fs';
import { isMainThread, threadId } from 'node:worker_threads';
const fingerprint = '38bfbe4bfe830bd18be2489acb1c47f5c89e6b3a4aa350992bcb1882cfe763c5';
if (isMainThread) {
  const state = await import(process.env.CONTRACT_STATE_URL);
  state.box.value = 'contract-v3-same-instance-positive-601';
  appendFileSync(process.env.CONTRACT_OBSERVER_LOG, JSON.stringify({ kind: 'observer-positive', fingerprint, stateFingerprint: state.fingerprint, token: state.box.value, pid: process.pid, threadId, isMainThread, stateURL: process.env.CONTRACT_STATE_URL }) + '\\n');
}
` },
  { name: "packet/lifecycle319/src/run.mjs", sha256: "de1a73c9a40eb3523d9a1e14bc4c682d3b6ed5910de4a6b1cce143f6b06bf9c5", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/src/run.mjs", rootBindings: ["original"], body: `import { bindNode22, assertBoundCarrier } from '../../binding/node-binding.mjs';
// Independent black-box runner. It never imports or reads a candidate module.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtimePath = process.argv[2];
if (!runtimePath) { console.error('Usage: node src/run.mjs /absolute/runtime.json [case-id ...]'); process.exit(2); }
const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
const nodeBinding=await bindNode22(runtime);if(nodeBinding.status!=='VALID_TOOL_BINDING'){console.log(JSON.stringify({status:'INVALID',semanticAssertions:0,reason:nodeBinding.reason,receipt:nodeBinding.receipt}));process.exit(2);}

const spec = JSON.parse(fs.readFileSync(path.join(root, 'spec.json'), 'utf8'));
const allCases = JSON.parse(fs.readFileSync(path.join(root, 'cases.json'), 'utf8'));
const selectedIds = process.argv.slice(3);
const cases = selectedIds.length ? allCases.filter(c => selectedIds.includes(c.id)) : allCases;
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
const outputRoot = path.resolve(runtime.outputRoot || path.join(root, 'runs'), runId);
fs.mkdirSync(outputRoot, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const signalNumber = signal => os.constants.signals[signal] ?? null;
// This is a documented shell-wait view, independent of the product's asTsx helper.
const callerView = raw => !raw ? { unobserved: true } : raw.error ? { error: raw.error.code } : { status: raw.status ?? (raw.signal ? 128 + signalNumber(raw.signal) : null), signal: null };
function rows(file, final = false) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  if (final && text && !text.endsWith('\\n')) throw new Error('incomplete event record after all writers ended: ' + file);
  const lines = text.split('\\n');
  if (!text.endsWith('\\n')) lines.pop();
  return lines.filter(Boolean).map(line => JSON.parse(line));
}
function ps() {
  const result = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,stat='], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('ps infrastructure unavailable');
  return result.stdout.split('\\n').map(line => line.trim().split(/\\s+/)).filter(cols => cols.length === 4).map(([pid, ppid, pgid, stat]) => ({ pid: +pid, ppid: +ppid, pgid: +pgid, stat }));
}
const executable = row => row && !row.stat.startsWith('Z');
function noConfigProof(cwd) {
  const proof = [];
  let dir = fs.realpathSync(cwd);
  for (;;) {
    try { fs.lstatSync(path.join(dir, 'tsconfig.json')); throw new Error('N-domain contains tsconfig.json at ' + dir); }
    catch (error) { if (error.code !== 'ENOENT') throw error; proof.push({ directory: dir, tsconfig: 'ENOENT' }); }
    const parent = path.dirname(dir);
    if (parent === dir) return proof;
    dir = parent;
  }
}
function tupleValid(tuple, entryArgs, reference) {
  if (!Array.isArray(tuple) || tuple.length !== 2 || tuple[0] !== runtime.node || !Array.isArray(tuple[1]) || !tuple[1].every(s => typeof s === 'string')) throw new Error('invalid command tuple');
  if (entryArgs && !equal(tuple[1].slice(-entryArgs.length), entryArgs)) throw new Error('tuple does not preserve frozen entryArgs suffix');
  if (reference && tuple[1][0] !== runtime.publicCli) throw new Error('R must begin with independently resolved public tsx/cli');
}
function frozenCheck() {
  const originalRoot = '/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts';
  const originalManifest = JSON.parse(fs.readFileSync(path.join(originalRoot, 'freeze-manifest.json'), 'utf8'));
  for (const item of originalManifest.files) if (hashFile(path.join(originalRoot, item.path)) !== item.sha256) throw new Error('original frozen input changed: ' + item.path);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'freeze-manifest.json'), 'utf8'));
  for (const item of manifest.files) if (hashFile(path.join(root, item.path)) !== item.sha256) throw new Error('frozen input changed: ' + item.path);
  return manifest;
}
function errorObject(error) { return { code: error.code ?? null, message: error.message }; }
function productPrecondition(message) { const error = new Error(message); error.productPrecondition = true; throw error; }
function resultFrom(stdout) {
  const values = stdout.split('\\n').filter(line => line.startsWith('@@RESULT@@')).map(line => JSON.parse(line.slice('@@RESULT@@'.length)));
  return values.length === 1 ? values[0] : null;
}
function errorProjection(stderr, entry) {
  return { sentinel: stderr.includes('CONTRACT_V3_THROW_SENTINEL'), sourceFrames: stderr.split('\\n').filter(line => line.includes(entry)).map(line => line.trim().replace(/:\\d+:\\d+/g, ':LINE:COL')) };
}

async function execute(caseDef, side, command, envBase) {
  const dir = path.join(outputRoot, caseDef.id, side);
  fs.mkdirSync(dir, { recursive: true });
  const files = Object.fromEntries(['entry', 'state', 'observer', 'boundary', 'cacheWitness', 'ready', 'go', 'helper', 'block'].map(key => [key, path.join(dir, key + '.jsonl')]));
  const token = runId + ':' + caseDef.id + ':' + side;
  const env = { ...envBase, CONTRACT_MODE: caseDef.mode, CONTRACT_ENV_TOKEN: spec.envToken, CONTRACT_READY_TOKEN: token, CONTRACT_ENTRY_LOG: files.entry, CONTRACT_STATE_LOG: files.state, CONTRACT_OBSERVER_LOG: files.observer, CONTRACT_BOUNDARY_LOG: files.boundary, CONTRACT_READY_FILE: files.ready, CONTRACT_GO_FILE: files.go, CONTRACT_HELPER_FILE: files.helper, CONTRACT_BLOCK_FILE: files.block };
  if (caseDef.mode === 'cache') env.CONTRACT_CACHE_WITNESS_LOG = files.cacheWitness;
  else delete env.CONTRACT_CACHE_WITNESS_LOG;
  const imports = [pathToFileURL(path.join(root, 'src/boundary-observer.mjs')).href];
  if (caseDef.mode === 'observer') {
    env.CONTRACT_STATE_URL = pathToFileURL(path.join(caseDef.owner, 'scripts/state.ts')).href;
    imports.unshift(side === 'R' ? runtime.publicTsxHookURL : runtime.hookURL);
    imports.push(pathToFileURL(path.join(root, 'src/observer.mjs')).href);
  }
  env.NODE_OPTIONS = [envBase.NODE_OPTIONS || '', ...imports.map(url => '--import=' + url)].filter(Boolean).join(' ');
  const state = { side, command, stdout: '', stderr: '', raw: null, rootPid: null, ready: null, closeSeen: false, signalProofs: [], snapshots: [], cleanup: [], infrastructureError: null };
  let child;
  let ownPgid;
  let rawAt;
  let isolated = false;
  const producerBindings = () => {
    const files = { ...runtime.producerBindingFiles };
    for (const directory of runtime.producerPayloadDirectories || []) if (fs.existsSync(directory)) for (const name of fs.readdirSync(directory)) if (name.endsWith('.js')) files['payload:' + path.join(directory, name)] = path.join(directory, name);
    return Object.fromEntries(Object.entries(files).map(([key, file]) => [key, { file, sha256: fs.existsSync(file) ? hashFile(file) : null }]));
  };
  const producerSources = () => Object.fromEntries(Object.keys(runtime.producerSourceHashes || {}).map(file => [file, hashFile(file)]));
  try {
    if (side === 'C' && runtime.producerModuleURL && !caseDef.outerSpawnFailure) {
      state.producerBindingBefore = producerBindings(); state.producerSourceBefore = producerSources();
      for (const [file, sha] of Object.entries(runtime.producerSourceHashes)) if (state.producerSourceBefore[file] !== sha) throw new Error('prepared source fingerprint changed: ' + file);
      const producer = await import(runtime.producerModuleURL);
      const selected = producer.prebuiltCommand([caseDef.entry, ...spec.args], caseDef.cwd, env);
      if (!Array.isArray(selected) || typeof selected[0] !== 'string' || !Array.isArray(selected[1])) throw new Error('public producer returned invalid tuple');
      state.actualFactoryInput = { args: [caseDef.entry, ...spec.args], cwd: caseDef.cwd, NODE_OPTIONS: env.NODE_OPTIONS };
      state.actualFactoryTuple = selected; assertBoundCarrier(selected,runtime);
      command = caseDef.childSpawnFailure ? [selected[0], ['--import', runtime.childSpawnFailureImportURL, ...selected[1]]] : selected;
      state.command = command;
      state.producerBindingAfterFactory = producerBindings();
      if (!equal(state.producerBindingBefore, state.producerBindingAfterFactory)) throw new Error('producer identity changed during factory');
    }
    ownPgid = ps().find(row => row.pid === process.pid)?.pgid;
    if (!ownPgid) throw new Error('runner PGID not visible');
    if (!caseDef.outerSpawnFailure) assertBoundCarrier(command,runtime);
    child = spawn(command[0], command[1], { cwd: caseDef.cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    state.rootPid = child.pid ?? null;
    child.stdout.on('data', chunk => { state.stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { state.stderr += chunk.toString(); });
    child.once('error', error => { state.raw = { status: null, signal: null, error: errorObject(error) }; rawAt = Date.now(); });
    child.once('exit', (status, signal) => { state.raw = { status, signal, error: null }; rawAt = Date.now(); });
    child.once('close', () => { state.closeSeen = true; });
    const started = Date.now();
    // Prove the process-group boundary even for non-signal runs before any cleanup.
    while (Date.now() - started < spec.readyTimeoutMs) {
      const table = ps();
      const rootRow = table.find(row => row.pid === child.pid);
      if (rootRow) {
        if (rootRow.pgid !== child.pid || rootRow.pgid === ownPgid || child.pid === process.pid) throw new Error('detached isolated PGID proof failed');
        isolated = true;
        state.initialGroup = { runnerPid: process.pid, runnerPgid: ownPgid, rootPid: child.pid, pgid: rootRow.pgid };
      }
      if (!caseDef.signal && state.raw) break;
      if (caseDef.signal && fs.existsSync(files.ready)) {
        const records = rows(files.ready);
        if (records.length !== 1) throw new Error('ready file multiplicity invalid');
        state.ready = records[0];
        if (state.ready.token !== token || state.ready.threadId !== 0 || state.ready.isMainThread !== true || state.ready.fingerprint !== spec.entryFingerprint) productPrecondition('entry-ready identity does not match frozen fixture');
        const entryRow = table.find(row => row.pid === state.ready.pid);
        if (!entryRow || entryRow.pgid !== child.pid || state.ready.pid === child.pid || state.ready.ppid !== child.pid) productPrecondition('entry must be a distinct main-thread child in isolated PGID');
        if (!isolated) throw new Error('root isolation not established before ready');
        break;
      }
      if (caseDef.signal && state.raw) break;
      await sleep(5);
    }
    const safeSignal = (target, signal) => {
      const table = ps();
      const currentOwn = table.find(row => row.pid === process.pid)?.pgid;
      if (!isolated || currentOwn !== ownPgid || child.pid === ownPgid || !state.ready || state.ready.pid === process.pid) throw new Error('signal boundary not proven');
      const selected = target === 'parent' ? child.pid : target === 'entry' ? state.ready.pid : -child.pid;
      const liveRows = table.filter(row => executable(row) && row.pgid === child.pid);
      if (!liveRows.length || (selected > 0 && !liveRows.some(row => row.pid === selected))) productPrecondition('selected signal target exited before frozen interaction');
      const proof = { target, signal, selected, runnerPid: process.pid, runnerPgid: ownPgid, isolatedPgid: child.pid, readyPid: state.ready.pid, members: liveRows };
      state.signalProofs.push(proof);
      if (target === 'self') { const temp = files.go + '.tmp-' + process.pid; fs.writeFileSync(temp, JSON.stringify({ token }) + '\\n'); fs.renameSync(temp, files.go); }
      else process.kill(selected, signal);
    };
    if (caseDef.signal && state.ready) {
      if (caseDef.mode === 'blocked') {
        const waitAt = Date.now();
        while (!fs.existsSync(files.block) && Date.now() - waitAt < spec.readyTimeoutMs) await sleep(5);
        if (!fs.existsSync(files.block)) productPrecondition('synchronous-block helper did not acknowledge');
        state.block = rows(files.block)[0];
        const helperRow = ps().find(row => row.pid === state.block.pid);
        if (!helperRow || helperRow.ppid !== state.ready.pid || helperRow.pgid !== child.pid) productPrecondition('synchronous-block helper topology differs from frozen input');
      }
      safeSignal(caseDef.target, caseDef.signal);
      if (caseDef.repeat) {
        const ackAt = Date.now();
        while (!rows(files.entry).some(row => row.kind === 'user-signal' && row.count === 1) && Date.now() - ackAt < spec.readyTimeoutMs && !state.raw) await sleep(2);
        if (!rows(files.entry).some(row => row.kind === 'user-signal' && row.count === 1)) state.interactionFailure = 'first user-handler acknowledgement absent';
        else safeSignal(caseDef.target, caseDef.signal);
      }
    }
    const settleAt = Date.now();
    let quietAt = null;
    while (Date.now() - settleAt < (caseDef.parentKill ? spec.orphanObservationMs : spec.settleTimeoutMs)) {
      const table = ps();
      const group = table.filter(row => row.pgid === child.pid);
      state.snapshots.push({ rootExited: Boolean(state.raw), group });
      const active = group.filter(executable);
      if (state.raw && !active.length) { quietAt ??= Date.now(); if (Date.now() - quietAt >= spec.quietMs) break; }
      else quietAt = null;
      await sleep(10);
    }
    const finalTable = ps();
    const group = finalTable.filter(row => row.pgid === child.pid);
    const explicit = [state.ready?.pid, state.ready?.helperPid, state.block?.pid].filter(Number.isInteger);
    const escaped = finalTable.filter(row => explicit.includes(row.pid) && row.pgid !== child.pid && executable(row));
    state.activeBeforeCleanup = group.filter(executable);
    state.escapedBeforeCleanup = escaped;
    state.completedBeforeCleanup = Boolean(state.raw) && !state.activeBeforeCleanup.length && !escaped.length;
    state.closeBeforeCleanup = state.closeSeen;
    state.residualRoles = state.activeBeforeCleanup.map(row => row.pid === child.pid ? 'root' : row.pid === state.ready?.pid ? 'entry' : row.pid === state.ready?.helperPid ? 'entry-helper' : row.pid === state.block?.pid ? 'block-helper' : 'other').sort();
    if (escaped.length) throw new Error('tracked descendant escaped isolated PGID; no out-of-group kill performed');
    if (state.activeBeforeCleanup.length) {
      if (!isolated || ownPgid === child.pid || ps().find(row => row.pid === process.pid)?.pgid !== ownPgid) throw new Error('cleanup PGID safety proof failed');
      process.kill(-child.pid, 'SIGKILL');
      state.cleanup.push({ signal: 'SIGKILL', pgid: child.pid, afterSemanticObservation: true });
    }
    const cleanupAt = Date.now();
    while (Date.now() - cleanupAt < spec.cleanupTimeoutMs) {
      if (!ps().some(row => row.pgid === child.pid && executable(row))) break;
      await sleep(10);
    }
    if (ps().some(row => row.pgid === child.pid && executable(row))) throw new Error('cleanup could not stop isolated descendants');
    // close is awaited after cleanup, while its pre-cleanup state is retained separately.
    const closeAt = Date.now();
    while (!state.closeSeen && Date.now() - closeAt < spec.cleanupTimeoutMs) await sleep(5);
    if (!state.closeSeen) throw new Error('stdio did not close after process-group cleanup');
    state.entryEvents = rows(files.entry, true);
    state.stateEvents = rows(files.state, true);
    state.observerEvents = rows(files.observer, true);
    state.boundaryEvents = rows(files.boundary, true);
    state.cacheEvents = rows(files.cacheWitness, true);
    state.result = resultFrom(state.stdout);
    state.entryPid = state.ready?.pid ?? state.result?.pid ?? state.entryEvents.find(row => row.kind === 'entry-eval')?.pid ?? null;
    state.entryHooks = state.entryEvents.filter(row => row.kind === 'entry-exit-hook' && row.pid === state.entryPid && row.threadId === 0 && row.isMainThread === true).map(({ order, code }) => ({ order, code }));
    state.entryBoundaryHooks = state.boundaryEvents.filter(row => row.kind === 'boundary-exit-hook' && row.pid === state.entryPid && row.threadId === 0 && row.isMainThread === true).map(({ code }) => ({ code }));
    state.userSignals = state.entryEvents.filter(row => row.kind === 'user-signal').map(({ signal, count }) => ({ signal, count }));
    state.rawObservedBeforeCleanup = rawAt !== undefined && (!state.cleanup.length || rawAt <= cleanupAt);
    if (state.producerBindingBefore) { state.producerBindingAfterRun = producerBindings(); state.producerSourceAfter = producerSources(); if (!equal(state.producerBindingBefore, state.producerBindingAfterRun) || !equal(state.producerSourceBefore, state.producerSourceAfter)) throw new Error('producer/source identity changed during target'); }
  } catch (error) { if (error.productPrecondition) state.interactionFailure = error.message; else state.infrastructureError = error.message; }
  if ((state.infrastructureError || state.interactionFailure) && child?.pid && isolated) {
    // Best-effort emergency cleanup remains constrained to the already proven group.
    try { if (ps().find(row => row.pid === process.pid)?.pgid === ownPgid && child.pid !== ownPgid) process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  fs.writeFileSync(path.join(dir, 'record.json'), JSON.stringify(state, null, 2) + '\\n');
  return state;
}

function assertions(caseDef, R, C) {
  const output = [];
  const check = (suffix, predicate, expected, actual) => output.push({ label: caseDef.id + '.' + suffix, status: predicate ? 'PASS' : 'FAIL', expected, actual });
  if (caseDef.outerSpawnFailure) {
    check('SPAWN_ERROR', R.raw?.error?.code === 'ENOENT' && C.raw?.error?.code === 'ENOENT', 'both outer command spawns surface ENOENT', { R: R.raw, C: C.raw });
    check('NO_CHILDREN', !R.rootPid && !C.rootPid, 'no process created', { R: R.rootPid, C: C.rootPid });
    return output;
  }
  check('RAW', equal(C.raw, R.raw), 'C raw tuple equals independent R raw tuple', { R: R.raw, C: C.raw });
  check('CALLER', equal(callerView(C.raw), callerView(R.raw)), 'documented shell-wait caller view C=R; raw retained independently', { R: callerView(R.raw), C: callerView(C.raw) });
  check('HOOKS', equal(C.entryHooks, R.entryHooks), 'ordered exit hooks from actual entry PID/main thread C=R', { R: R.entryHooks, C: C.entryHooks });
  check('BOUNDARY_HOOKS', equal(C.entryBoundaryHooks, R.entryBoundaryHooks), 'same-wiring public observer entry-only exit hooks C=R', { R: R.entryBoundaryHooks, C: C.entryBoundaryHooks });
  check('USER_HANDLER', equal(C.userSignals, R.userSignals), 'user-owned signal callback sequence C=R', { R: R.userSignals, C: C.userSignals });
  check('LIFECYCLE', equal(C.residualRoles, R.residualRoles) && C.completedBeforeCleanup === R.completedBeforeCleanup && C.closeBeforeCleanup === R.closeBeforeCleanup, 'root exit is distinct from full group/pipe completion; residual roles C=R before harness cleanup', { R: [R.completedBeforeCleanup, R.closeBeforeCleanup, R.residualRoles], C: [C.completedBeforeCleanup, C.closeBeforeCleanup, C.residualRoles] });
  if (!caseDef.parentKill && caseDef.id !== 'N.SIGHUP.PARENT') check('NO_ORPHANS', C.completedBeforeCleanup === true && C.closeBeforeCleanup === true, 'non-parent-KILL case has full group and stdio completion before harness cleanup', { C: [C.completedBeforeCleanup, C.closeBeforeCleanup, C.residualRoles] });
  if (caseDef.missingEntry || caseDef.childSpawnFailure) {
    const diagnostic = caseDef.missingEntry ? C.stderr.includes(caseDef.entry) && /ERR_MODULE_NOT_FOUND|ENOENT|Cannot find module/.test(C.stderr) : C.stderr.includes('ENOENT');
    check('ERROR_SURFACED', C.raw?.status !== null && C.raw.status !== 0 && C.raw.signal === null && diagnostic && C.result === null, 'missing entry: named path plus explicit module-not-found diagnostic; child spawn: ENOENT; nonzero/no signal/no entry success', { raw: C.raw, stderr: C.stderr, result: C.result });
    return output;
  }
  check('ENTRY', C.result?.threadId === 0 && C.result?.isMainThread === true && C.entryEvents.filter(row => row.kind === 'entry-eval' && row.pid === C.entryPid).length === 1, 'one actual entry evaluation on entry PID main thread', C.result);
  if (C.result && R.result) {
    const semantic = value => { const { pid, ppid, threadId, isMainThread, ...rest } = value; return rest; };
    check('VALUES', equal(semantic(C.result), semantic(R.result)), 'fixture visible values incl default {} profile C=R; no owner default extrapolation', { R: semantic(R.result), C: semantic(C.result) });
    check('FIDELITY', C.result.value === 29 && C.result.execPath === runtime.node && C.result.cwd === caseDef.cwd && C.result.token === spec.envToken && C.result.entryURL === pathToFileURL(caseDef.entry).href && equal(C.result.args, spec.args), 'hand-derived value29, exact node/cwd/env/args/original .ts URL', C.result);
  } else check('VALUES', false, 'both entry result records present', { R: R.result, C: C.result });
  const booted = C.boundaryEvents.some(row => row.kind === 'boundary-boot' && row.pid === C.entryPid && row.threadId === 0 && row.isMainThread === true && row.fingerprint === spec.boundaryFingerprint);
  check('OBSERVER_WIRING', booted, 'boundary observer boot recorded by actual entry PID/main thread', C.boundaryEvents);
  if (caseDef.mode === 'observer') {
    const positive = C.observerEvents.filter(row => row.kind === 'observer-positive' && row.pid === C.entryPid && row.threadId === 0 && row.isMainThread === true && row.token === spec.observerToken && row.fingerprint === spec.observerFingerprint && row.stateFingerprint === spec.stateFingerprint);
    check('SAME_INSTANCE_POSITIVE', positive.length === 1 && C.result?.shared === spec.observerToken && C.stateEvents.filter(row => row.pid === C.entryPid && row.threadId === 0).length === 1, 'observer mutates same real entry state module instance exactly once', { positive, result: C.result, state: C.stateEvents });
  }
  if (caseDef.mode === 'cache') {
    const positive = C.cacheEvents.filter(row => row.kind === 'cache-payload-consumed' && row.token === spec.cacheToken && row.pid === C.entryPid && row.threadId === 0 && row.isMainThread === true);
    check('CACHE_CONSUMED', positive.length === 1, 'test-owned prefix on one opaque prepared entry payload executes in actual entry PID/main thread', C.cacheEvents);
  }
  if (caseDef.mode === 'throw') {
    const r = errorProjection(R.stderr, caseDef.entry), c = errorProjection(C.stderr, caseDef.entry);
    check('THROW', c.sentinel && c.sourceFrames.length > 0 && equal(c, r), 'same thrown marker and ordered original .ts source frames as public CLI', { R: r, C: c });
  } else check('STDERR', C.stderr === R.stderr, 'stderr byte equality on nonthrow finite fixtures', { R: R.stderr, C: C.stderr });
  if (caseDef.mode === 'normal' || caseDef.mode === 'nonzero' || caseDef.mode === 'observer' || caseDef.mode === 'cache' || caseDef.mode === 'early-exit') {
    const code = caseDef.mode === 'nonzero' ? 23 : caseDef.mode === 'early-exit' ? 37 : 0;
    check('EXPLICIT_EXIT', C.raw?.status === code && C.raw.signal === null && equal(C.entryHooks, [{ order: 1, code }, { order: 2, code }]), 'fixture-derived normal/explicit exit and real ordered hooks', { raw: C.raw, hooks: C.entryHooks });
  }
  return output;
}

const report = { nodeBinding, runId, runtimePath: path.resolve(runtimePath), cases: [], status: 'INVALID', semanticAssertions: 0, freeze: null, infrastructureError: null };
try {
  report.freeze = frozenCheck();
  if (selectedIds.some(id => !allCases.some(c => c.id === id))) throw new Error('unknown selected case id');
  const version = spawnSync(runtime.node, ['--version'], { encoding: 'utf8' });
  if (version.error || version.status !== 0 || version.stdout.trim() !== runtime.nodeVersion) throw new Error('bound runtime Node version unavailable');
  const publicRequire = createRequire(path.join(runtime.publicResolutionOwner, 'package.json'));
  const resolved = publicRequire.resolve('tsx/cli');
  if (resolved !== runtime.publicCli) throw new Error('public tsx/cli resolution differs from supplied R');
  if (pathToFileURL(publicRequire.resolve('tsx')).href !== runtime.publicTsxHookURL) throw new Error('R observer preload is not the resolved public tsx root export');
  const envBase = { ...process.env, ...(runtime.baseEnv || {}) };
  for (const key of runtime.unsetEnv || []) delete envBase[key];
  if (Object.hasOwn(envBase, 'TSX_TSCONFIG_PATH') || /tsx|no-experimental-strip-types/.test(envBase.NODE_OPTIONS || '') || envBase.KOL_PREBUILT === '0') throw new Error('base environment outside N-domain');
  if (runtime.compilerOptionsIdentity !== '{}') throw new Error('runtime must attest independent {} compile identity');
  if (typeof runtime.hookURL !== 'string' || typeof runtime.publicTsxHookURL !== 'string') throw new Error('public hook URLs not supplied');
  for (const caseDef of cases) {
    const entryArgs = caseDef.outerSpawnFailure ? null : [caseDef.entry, ...spec.args];
    const supplied = caseDef.outerSpawnFailure ? {} : caseDef.childSpawnFailure ? runtime.childSpawnFailure : runtime.commands[caseDef.commandKey];
    if (!supplied) { report.cases.push({ id: caseDef.id, status: 'NOT_RUN', semanticAssertions: 0, reason: 'runtime tuple pair not supplied' }); continue; }
    let pair;
    if (caseDef.outerSpawnFailure) pair = { R: [path.join(outputRoot, 'does-not-exist-node'), []], C: [path.join(outputRoot, 'does-not-exist-node'), []] };
    else pair = supplied;
    if (!caseDef.outerSpawnFailure) { tupleValid(pair.R, entryArgs, !caseDef.childSpawnFailure); tupleValid(pair.C, entryArgs, false); }
    const proof = noConfigProof(caseDef.cwd);
    const R = await execute(caseDef, 'R', pair.R, envBase);
    let referenceInvalid = R.infrastructureError || (!caseDef.outerSpawnFailure && (!R.raw || R.raw.error)) || (caseDef.signal && !R.ready) || R.interactionFailure;
    if (!caseDef.outerSpawnFailure && !caseDef.missingEntry && !caseDef.childSpawnFailure) {
      if (!R.result || R.result.fingerprint !== spec.entryFingerprint || R.result.threadId !== 0 || R.result.isMainThread !== true) referenceInvalid ||= 'public reference did not execute frozen real entry';
      if (!R.boundaryEvents?.some(row => row.kind === 'boundary-boot' && row.pid === R.entryPid && row.threadId === 0 && row.isMainThread === true)) referenceInvalid ||= 'public reference actual-entry boundary observer not wired';
      if (caseDef.mode === 'observer' && (!R.observerEvents?.some(row => row.kind === 'observer-positive' && row.pid === R.entryPid && row.threadId === 0 && row.isMainThread === true && row.token === spec.observerToken) || R.result?.shared !== spec.observerToken || R.stateEvents?.filter(row => row.pid === R.entryPid && row.threadId === 0).length !== 1)) referenceInvalid ||= 'public reference same-instance observer positive not established';
    }
    if (referenceInvalid) { report.cases.push({ id: caseDef.id, status: 'INVALID', semanticAssertions: 0, reason: referenceInvalid || 'reference did not establish required entry-ready', noConfigProof: proof }); continue; }
    const candidateProof = noConfigProof(caseDef.cwd);
    const C = await execute(caseDef, 'C', pair.C, envBase);
    if (C.infrastructureError) { report.cases.push({ id: caseDef.id, status: 'INVALID', semanticAssertions: 0, reason: C.infrastructureError, noConfigProof: proof }); continue; }
    if (caseDef.signal && (!C.ready || C.interactionFailure)) {
      const result = { label: caseDef.id + '.ENTRY_READY', status: 'FAIL', expected: 'valid candidate reaches same ready/interaction point before signal', actual: { raw: C.raw, ready: C.ready, interactionFailure: C.interactionFailure } };
      report.cases.push({ id: caseDef.id, status: 'FAIL', semanticAssertions: 1, assertions: [result], noConfigProof: proof });
      report.semanticAssertions++;
      continue;
    }
    const results = assertions(caseDef, R, C);
    report.semanticAssertions += results.length;
    report.cases.push({ id: caseDef.id, status: results.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL', semanticAssertions: results.length, assertions: results, noConfigProof: { R: proof, C: candidateProof } });
    fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(report, null, 2) + '\\n');
  }
  report.status = report.cases.some(c => c.status === 'INVALID') ? 'INVALID' : report.cases.some(c => c.status === 'FAIL') ? 'FAIL' : report.cases.some(c => c.status === 'NOT_RUN') ? 'INCOMPLETE' : 'PASS';
} catch (error) { report.infrastructureError = error.message; }
fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(report, null, 2) + '\\n');
for (const item of report.cases) console.log(item.status + ' ' + item.id + ' assertions=' + item.semanticAssertions);
console.log(JSON.stringify({ status: report.status, semanticAssertions: report.semanticAssertions, report: path.join(outputRoot, 'report.json'), infrastructureError: report.infrastructureError }));
process.exitCode = report.status === 'PASS' ? 0 : report.status === 'INVALID' ? 2 : report.status === 'INCOMPLETE' ? 3 : 1;
` },
  { name: "packet/lifecycle319/sync/README.md", sha256: "a4046831440f47e39c75f4769f67b85d96b24ed30b13ca1af3fc6181222e8d25", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/sync/README.md", rootBindings: [], body: `Actual public factory provider for sync7. Original frozen semantic expected/TS/cases unchanged; v3.2 atomic go retained. C tuple is selected only after final child env is assembled. N observer uses actual fixtureLoader output supplied by real preparation, so explicit public tsx in final NODE_OPTIONS correctly returns CLI. Trusted module/cache and toy SHA are recorded before/after actual C execution.
` },
  { name: "packet/lifecycle319/sync/expected.json", sha256: "50222826781a9da0dc75a24e7e1eb98a365ea6903572a0ab99dbaeec4701ab93", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/sync/expected.json", rootBindings: ["original"], body: `{
  "case": "N.SYNC_SELF_TERM",
  "origin": "Previously admitted prototype2 inputs/main.ts.txt and inputs/state.ts.txt; synchronous report -> self TERM, no timer or await",
  "sourceFingerprint": "750b927dbce742e64e7ffc4c798cd54a1366e2ab3d73a7704a5bfd5598913731",
  "entryFingerprint": "b5ab0823b19a40c1c2ff3c6a55b29d47f8acc9f2b2e428c93602140138f104f2",
  "entry": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/main-alpha.ts",
  "cwd": "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/no-config/leaf",
  "args": [
    "arg-one",
    "arg with space",
    "--literal-script-arg"
  ],
  "entryArgs": [
    "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/main-alpha.ts",
    "arg-one",
    "arg with space",
    "--literal-script-arg"
  ],
  "envToken": "contract-v3-env-token-671",
  "knownRaw": {
    "status": 0,
    "signal": null
  },
  "knownRawSource": "root NEW_TASK and follow-up explicitly preserve original synchronous self TERM raw0/null counterexample; not derived from supplement execution",
  "labels": [
    "ENTRY_READY",
    "RAW",
    "KNOWN_CLI_ZERO",
    "HOOKS",
    "RESULT",
    "STDERR",
    "NO_ORPHANS"
  ],
  "beforeExecution": true,
  "finiteBoundary": "A synchronous go handshake keeps module evaluation on the same stack before process.kill; public R/R must qualify this preserved shape before any C use."
}
` },
  { name: "packet/lifecycle319/sync/freeze-manifest.json", sha256: "856dfbffee67edeea75b009270ba09b45be4bdfd4cd726b4a588a64b2991ae70", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/sync/freeze-manifest.json", rootBindings: [], body: `{
  "version": "Node22-v4.2-runtime-members-only",
  "frozenAtUtc": "2026-10-25T09:06:48.668115+00:00",
  "scope": "runtime members only; old full-guard/provenance artifacts not claimed",
  "files": [
    {
      "path": "README.md",
      "sha256": "a4046831440f47e39c75f4769f67b85d96b24ed30b13ca1af3fc6181222e8d25",
      "bytes": 403
    },
    {
      "path": "expected.json",
      "sha256": "50222826781a9da0dc75a24e7e1eb98a365ea6903572a0ab99dbaeec4701ab93",
      "bytes": 1485
    },
    {
      "path": "run.mjs",
      "sha256": "474c874be95192e403bf037d253b22ac2c61f159444096ffd444a53d4b76ec8f",
      "bytes": 12022
    }
  ]
}
` },
  { name: "packet/lifecycle319/sync/run.mjs", sha256: "474c874be95192e403bf037d253b22ac2c61f159444096ffd444a53d4b76ec8f", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/lifecycle319/sync/run.mjs", rootBindings: ["original"], body: `import { bindNode22, assertBoundCarrier } from '../../binding/node-binding.mjs';
// One supplemental case, independent of candidate implementation and the frozen 27-case runner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = '/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts';
const runtime = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const nodeBinding=await bindNode22(runtime);if(nodeBinding.status!=='VALID_TOOL_BINDING'){console.log(JSON.stringify({status:'INVALID',semanticAssertions:0,reason:nodeBinding.reason,receipt:nodeBinding.receipt}));process.exit(2);}

const expected = JSON.parse(fs.readFileSync(path.join(here, 'expected.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'freeze-manifest.json'), 'utf8'));
const out = path.join(runtime.outputRoot || path.join(here, 'runs'), 'sync-self-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'));
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const readRows = (file, final = false) => { if (!fs.existsSync(file)) return []; const text = fs.readFileSync(file, 'utf8'); if (final && text && !text.endsWith('\\n')) throw new Error('incomplete final record'); const lines = text.split('\\n'); if (!text.endsWith('\\n')) lines.pop(); return lines.filter(Boolean).map(line => JSON.parse(line)); };
const ps = () => { const r = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,stat='], { encoding: 'utf8' }); if (r.error || r.status) throw new Error('ps infrastructure unavailable'); return r.stdout.split('\\n').map(l => l.trim().split(/\\s+/)).filter(v => v.length === 4).map(([pid,ppid,pgid,stat]) => ({pid:+pid,ppid:+ppid,pgid:+pgid,stat})); };
const active = row => !row.stat.startsWith('Z');
function noConfigProof() { let dir = fs.realpathSync(expected.cwd); const proof = []; for (;;) { try { fs.lstatSync(path.join(dir, 'tsconfig.json')); throw new Error('configured cwd ancestor'); } catch (e) { if (e.code !== 'ENOENT') throw e; proof.push({ directory: dir, tsconfig: 'ENOENT' }); } const parent = path.dirname(dir); if (dir === parent) return proof; dir = parent; } }
async function run(side, command) {
  const dir = path.join(out, side); fs.mkdirSync(dir);
  const files = Object.fromEntries(['ready','go','boundary','eval'].map(k => [k,path.join(dir,k+'.jsonl')]));
  const token = crypto.randomBytes(12).toString('hex');
  const env = { ...process.env, ...(runtime.baseEnv || {}) };
  for (const key of runtime.unsetEnv || []) delete env[key];
  if (Object.hasOwn(env,'TSX_TSCONFIG_PATH') || /tsx|no-experimental-strip-types/.test(env.NODE_OPTIONS||'') || env.KOL_PREBUILT === '0') throw new Error('environment outside N domain');
  Object.assign(env, { PROFILE_EXIT:'term', CI_PROFILE_TOKEN:expected.envToken, PROFILE_EVAL_LOG:files.eval, CONTRACT_BOUNDARY_LOG:files.boundary, CONTRACT_SYNC_READY:files.ready, CONTRACT_SYNC_GO:files.go, CONTRACT_SYNC_TOKEN:token });
  env.NODE_OPTIONS = [env.NODE_OPTIONS || '', '--import='+pathToFileURL(path.join(root,'src/boundary-observer.mjs')).href].filter(Boolean).join(' ');
  const record = {side,command,raw:null,stdout:'',stderr:'',ready:null,proof:null,infrastructureError:null,productPrecondition:null};
  const producerBindings=()=>{const files={...runtime.producerBindingFiles};for(const d of runtime.producerPayloadDirectories||[])if(fs.existsSync(d))for(const n of fs.readdirSync(d))if(n.endsWith('.js'))files['payload:'+path.join(d,n)]=path.join(d,n);return Object.fromEntries(Object.entries(files).map(([k,f])=>[k,{file:f,sha256:fs.existsSync(f)?crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'):null}]))};
  const producerSources=()=>Object.fromEntries(Object.keys(runtime.producerSourceHashes||{}).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
  let child, ownPgid, isolated=false, close=false;
  try {
    record.noConfigProof = noConfigProof();
    ownPgid = ps().find(p=>p.pid===process.pid)?.pgid;
    if (!ownPgid) throw new Error('runner PGID absent');
    if (side === 'C' && runtime.producerModuleURL) {
      record.producerBefore=producerBindings();record.producerSourcesBefore=producerSources();
      const producer=await import(runtime.producerModuleURL);
      record.actualFactoryInput={args:expected.entryArgs,cwd:expected.cwd,NODE_OPTIONS:env.NODE_OPTIONS};
      command=producer.prebuiltCommand(expected.entryArgs,expected.cwd,env);record.command=command;
    }
    assertBoundCarrier(command,runtime);
    child=spawn(command[0],command[1],{cwd:expected.cwd,env,detached:true,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',b=>record.stdout+=b); child.stderr.on('data',b=>record.stderr+=b);
    child.once('error',e=>record.raw={status:null,signal:null,error:e.code}); child.once('exit',(status,signal)=>record.raw={status,signal,error:null}); child.once('close',()=>close=true);
    const at=Date.now();
    while(Date.now()-at<5000 && !record.raw){
      const table=ps(), rootRow=table.find(p=>p.pid===child.pid);
      if(rootRow){ if(rootRow.pgid!==child.pid || rootRow.pgid===ownPgid) throw new Error('isolated PGID proof failed'); isolated=true; }
      const ready=readRows(files.ready)[0];
      if(ready){
        const entry=table.find(p=>p.pid===ready.pid);
        if(ready.token!==token || ready.fingerprint!==expected.entryFingerprint || ready.sourceFingerprint!==expected.sourceFingerprint || ready.threadId!==0 || ready.isMainThread!==true || !entry || entry.pgid!==child.pid || ready.pid===child.pid || entry.ppid!==child.pid){record.productPrecondition='actual entry ready identity/topology invalid';break;}
        record.ready=ready;
        // No yield between fresh topology check and allowing the fixture's synchronous self signal.
        const finalTable=ps();
        if(!isolated || finalTable.find(p=>p.pid===process.pid)?.pgid!==ownPgid || child.pid===ownPgid || !finalTable.some(p=>p.pid===ready.pid && p.pgid===child.pid && active(p))) throw new Error('self-signal safety proof failed');
        record.proof={runnerPid:process.pid,runnerPgid:ownPgid,isolatedPgid:child.pid,entryPid:ready.pid,signal:'SIGTERM',dispatch:'synchronous entry module evaluation after go',members:finalTable.filter(p=>p.pgid===child.pid)};
        const temp=files.go+'.tmp-'+process.pid;fs.writeFileSync(temp,JSON.stringify({token})+'\\n');fs.renameSync(temp,files.go);
        break;
      }
      await sleep(5);
    }
    if(!record.ready) record.productPrecondition ||= 'no qualified ready before self signal';
    const waitAt=Date.now();
    while(Date.now()-waitAt<5000){ if(record.raw && close && !ps().some(p=>p.pgid===child.pid && active(p))) break; await sleep(5); }
    record.residual=ps().filter(p=>p.pgid===child.pid && active(p));
    record.closeBeforeCleanup=close;
    if(record.residual.length){
      if(!isolated || ps().find(p=>p.pid===process.pid)?.pgid!==ownPgid || child.pid===ownPgid)throw new Error('cleanup proof unavailable');
      record.cleanupAfterObservation=true; process.kill(-child.pid,'SIGKILL');
      const cleanAt=Date.now(); while(Date.now()-cleanAt<2000 && ps().some(p=>p.pgid===child.pid && active(p)))await sleep(5);
      if(ps().some(p=>p.pgid===child.pid && active(p)))throw new Error('cleanup failed');
    }
    record.boundary=readRows(files.boundary,true);
    record.entryHooks=record.boundary.filter(e=>e.kind==='boundary-exit-hook'&&e.pid===record.ready?.pid&&e.threadId===0&&e.isMainThread===true).map(({code})=>({code}));
    record.entryBoot=record.boundary.some(e=>e.kind==='boundary-boot'&&e.pid===record.ready?.pid&&e.threadId===0&&e.isMainThread===true);
    record.result=record.stdout.split('\\n').filter(l=>l.startsWith('@@RESULT@@')).map(l=>JSON.parse(l.slice(10)))[0]||null;
    if(record.producerBefore){record.producerAfter=producerBindings();record.producerSourcesAfter=producerSources();if(!equal(record.producerBefore,record.producerAfter)||!equal(record.producerSourcesBefore,record.producerSourcesAfter))throw new Error('producer/source binding changed during sync target');}
  }catch(e){record.infrastructureError=e.message;try{if(isolated&&child?.pid!==ownPgid&&ps().find(p=>p.pid===process.pid)?.pgid===ownPgid)process.kill(-child.pid,'SIGKILL');}catch{}}
  fs.writeFileSync(path.join(dir,'record.json'),JSON.stringify(record,null,2)+'\\n');return record;
}
const report={nodeBinding,kind:'SYNC_SELF_TERM_SUPPLEMENT',status:'INVALID',semanticAssertions:0,assertions:[],infrastructureError:null};
try{
  for(const f of manifest.files)if(crypto.createHash('sha256').update(fs.readFileSync(path.join(here,f.path))).digest('hex')!==f.sha256)throw new Error('supplement frozen file changed: '+f.path);
  const pair=runtime.syncSelf;
  if(!pair){report.status='NOT_RUN';report.reason='runtime.syncSelf tuple pair not supplied';}
  else{
    for(const side of ['R','C'])if(!Array.isArray(pair[side])||pair[side][0]!==runtime.node||!equal(pair[side][1].slice(-expected.entryArgs.length),expected.entryArgs))throw new Error('syncSelf tuple suffix/node mismatch');
    if(pair.R[1][0]!==runtime.publicCli)throw new Error('syncSelf R is not public CLI tuple');
    const R=await run('R',pair.R);report.R=R;
    if(R.infrastructureError||R.productPrecondition||!R.entryBoot||R.result?.pid!==R.ready?.pid)throw new Error('reference qualification failed: '+(R.infrastructureError||R.productPrecondition||'real entry observer/result identity'));
    const C=await run('C',pair.C);report.C=C;
    if(C.infrastructureError)throw new Error('candidate infrastructure invalid: '+C.infrastructureError);
    const check=(name,ok,want,actual)=>report.assertions.push({label:'N.SYNC_SELF_TERM.'+name,status:ok?'PASS':'FAIL',expected:want,actual});
    check('ENTRY_READY',!C.productPrecondition&&C.entryBoot&&C.result?.pid===C.ready?.pid,'real entry ready and observer boot on actual entry PID/thread0/mainThread',{ready:C.ready,error:C.productPrecondition,entryBoot:C.entryBoot});
    check('RAW',equal(C.raw,R.raw),'candidate raw equals public CLI raw',{R:R.raw,C:C.raw});
    check('KNOWN_CLI_ZERO',R.raw?.status===0&&R.raw.signal===null&&C.raw?.status===0&&C.raw.signal===null,'previously specified synchronous self TERM remains raw status0/signalnull',{R:R.raw,C:C.raw});
    check('HOOKS',equal(C.entryHooks,R.entryHooks),'entry-only real-main-thread exit-hook code list C=R',{R:R.entryHooks,C:C.entryHooks});
    check('RESULT',C.result?.unit==='main-alpha'&&C.result?.fingerprint===expected.entryFingerprint&&C.result?.entryURL===pathToFileURL(expected.entry).href&&equal(C.result?.args,expected.args)&&C.result?.cwd===expected.cwd&&C.result?.execPath===runtime.node,'frozen old main-alpha result and original TS address/args/cwd/node',C.result);
    check('STDERR',C.stderr===R.stderr,'stderr byte equality public CLI',{R:R.stderr,C:C.stderr});
    check('NO_ORPHANS',C.residual?.length===0&&R.residual?.length===0&&C.closeBeforeCleanup&&R.closeBeforeCleanup,'both groups and stdio complete before any harness cleanup',{R:R.residual,C:C.residual,Rclose:R.closeBeforeCleanup,Cclose:C.closeBeforeCleanup});
    report.semanticAssertions=report.assertions.length;report.status=report.assertions.every(a=>a.status==='PASS')?'PASS':'FAIL';
  }
}catch(e){report.infrastructureError=e.message;report.status='INVALID';report.semanticAssertions=0;report.assertions=[];}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\\n');
console.log(JSON.stringify({status:report.status,semanticAssertions:report.semanticAssertions,report:path.join(out,'report.json'),infrastructureError:report.infrastructureError}));process.exitCode=report.status==='PASS'?0:report.status==='INVALID'?2:report.status==='NOT_RUN'?3:1;
` },
  { name: "packet/patch-inventory.json", sha256: "d93030bd64af33b4d1875cd791da4e336c55c325e9a0e6f17eb84cd82c52faf0", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/patch-inventory.json", rootBindings: [], body: `[
  {
    "entry": "lifecycle319/src/run.mjs",
    "sourceOriginalSha256": "33e1eab32217eb1b4a28d4bea5325973cb060a87c5bb6b8f44378651d657c036",
    "executedOverlaySha256": "de1a73c9a40eb3523d9a1e14bc4c682d3b6ed5910de4a6b1cce143f6b06bf9c5",
    "originalSource": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/v4.1/lifecycle319/src/run.mjs",
    "allowedExecutableChanges": [
      "Node runtime binding import/preflight/receipt",
      "replace only fixed22.22 preflight guard with validated runtime.nodeVersion where present",
      "assert all real R/C/factory carriers use bound same Node; controlled outer ENOENT remains exempt",
      "supply exact Node version/platform/arch metadata"
    ]
  },
  {
    "entry": "lifecycle319/sync/run.mjs",
    "sourceOriginalSha256": "3a3e462e190da75653b947c12616fd4f58ea6b3b7eeb5ab18ebfb0c082c1acd8",
    "executedOverlaySha256": "474c874be95192e403bf037d253b22ac2c61f159444096ffd444a53d4b76ec8f",
    "originalSource": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/v4.1/lifecycle319/sync/run.mjs",
    "allowedExecutableChanges": [
      "Node runtime binding import/preflight/receipt",
      "replace only fixed22.22 preflight guard with validated runtime.nodeVersion where present",
      "assert all real R/C/factory carriers use bound same Node; controlled outer ENOENT remains exempt",
      "supply exact Node version/platform/arch metadata"
    ]
  },
  {
    "entry": "lifecycle319/preload/run.mjs",
    "sourceOriginalSha256": "0853224a21d845300066150b2f51637c78a1e67c036ff8e430466dfc0f04248e",
    "executedOverlaySha256": "bcde72029a299beabb6b913fcfa5e520f2ffe69eb8ab74d409fdcba62ed604c6",
    "originalSource": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/v4.1/lifecycle319/preload/run.mjs",
    "allowedExecutableChanges": [
      "Node runtime binding import/preflight/receipt",
      "replace only fixed22.22 preflight guard with validated runtime.nodeVersion where present",
      "assert all real R/C/factory carriers use bound same Node; controlled outer ENOENT remains exempt",
      "supply exact Node version/platform/arch metadata"
    ]
  },
  {
    "entry": "descriptor/prepare.mjs",
    "sourceOriginalSha256": "b39c2e86e30b9eaea14cf7afe47fd2bca9fe99fcef65aa0d9d444dbe8f1fa96b",
    "executedOverlaySha256": "b421c038bba2f05bb208c476250ea72eef13a40971ddc89955e755720bfcfd00",
    "originalSource": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/descriptor-v4.1/prepare.mjs",
    "allowedExecutableChanges": [
      "same Node binding preflight",
      "emit validated runtime.nodeVersion/platform/arch/receipt; no semantic expected or cache/source change"
    ]
  },
  {
    "entry": "producer/src/run.mjs",
    "originalFrozenSource": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/v4.2/src/run.mjs",
    "originalSha256": "482bb28d79748d6d0d9447fe0dae332b1de17f5a2319972a7f495cb10576b9a2",
    "executedSha256": "00693b7a2e12ad1f11269489beaadb81864e4ef74bf43fd31e8ee790d629d275",
    "onlyChanges": [
      "Node binding import/preflight/receipt",
      "same Node carrier assertion",
      "descriptor version/platform/arch propagation where applicable"
    ]
  },
  {
    "entry": "producer/src/supply-lifecycle.mjs",
    "originalFrozenSource": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/v4.2/src/supply-lifecycle.mjs",
    "originalSha256": "cbbf0f45f5f0412dd5ddf91d37b171da3e66b40a3f268829908d7b0768608a6f",
    "executedSha256": "b46e6f5beb44276649807d85b1b91e74d3f1e3dad9bfd12feb9a9e364d22f368",
    "onlyChanges": [
      "Node binding import/preflight/receipt",
      "same Node carrier assertion",
      "descriptor version/platform/arch propagation where applicable"
    ]
  }
]
` },
  { name: "packet/portable-root-binding.json", sha256: "4d4e896b638a19bcf57c16365d70321da1bcdbbedcb309efbd7f16b1dc6fcfdc", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/portable-root-binding.json", rootBindings: [], body: `{
  "authority": "root-approved packaging as a separate explicit tool/root binding overlay",
  "allowedRootOnlyFields": [
    "lifecycle main frozenCheck originalRoot literal",
    "case owner/cwd/entry absolute path fields",
    "sync expected entry/cwd/entryArgs path fields",
    "ordinary spec entry/cwd/sourceHashes key path fields",
    "descriptor old root literal and own default output root when used",
    "runtime apiModuleURL/producerModuleURL/bindingFiles/legacyOwnerApiModuleURL/legacyOwnerBindingFiles and output roots supplied from actual job",
    "descriptor expectedToyHashes path keys only; digest values unchanged"
  ],
  "neverReplace": [
    "all6 original lifecycle TS bodies and all producer TS bodies",
    "legacy3 API bytes/Git blobs",
    "numerical expected",
    "labels",
    "signal relationships",
    "compilerOptions/profile requirements",
    "source fingerprint values"
  ],
  "sourceIntegrity": "original SHA is provenance; actual mapped executed SHA must also be recorded. Controlled root mapping makes a new tool variant, not the original SHA.",
  "guardScope": "copy all old26 guard members or label a new scoped portable runtime-member manifest with omitted-member inventory; never claim original full guard passed when reduced",
  "requiredPreparation": [
    "mkdir inputs/fixtures/no-config/leaf explicitly (or per-run real cwd before actual ancestor proof)",
    "provide only installed current public dependencies to legacy3 via node_modules link; no network fetch/old repository copy",
    "runtime.node=actual process.execPath and runtime.nodeVersion=actual process.version",
    "same typed import/registerHooks capability proof and R/C exact same carrier"
  ],
  "legacySourceManifest": "producer/legacy-public-api/manifest.json"
}
` },
  { name: "packet/producer/expected.json", sha256: "3f9846f1275d5dec59199b394d0399af44a83720ed847c690a9a55eb8a5e9057", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/expected.json", rootBindings: [], body: `{
  "frozenBeforeAnyProducerExecution": true,
  "labels": [
    "V4.false.COLD.COUNTS",
    "V4.false.COLD.PAYLOAD_K",
    "V4.false.WARM.COUNTS",
    "V4.false.WARM.PAYLOAD_K",
    "V4.false.N.FACTORY_RETURN",
    "V4.false.N.NEW_N_PARENT",
    "V4.false.N.SEMANTICS",
    "V4.false.N.COMPLETE",
    "V4.false.OWNER.FACTORY_RETURN",
    "V4.false.OWNER.BARE",
    "V4.false.OWNER.SEMANTICS",
    "V4.false.OWNER.COMPLETE",
    "V4.false.OWNER.DIRECT_PID",
    "V4.false.OWNER.FIELD_POSITIVE",
    "V4.true.COLD.COUNTS",
    "V4.true.COLD.PAYLOAD_K",
    "V4.true.WARM.COUNTS",
    "V4.true.WARM.PAYLOAD_K",
    "V4.true.N.FACTORY_RETURN",
    "V4.true.N.NEW_N_PARENT",
    "V4.true.N.SEMANTICS",
    "V4.true.N.COMPLETE",
    "V4.true.OWNER.FACTORY_RETURN",
    "V4.true.OWNER.BARE",
    "V4.true.OWNER.SEMANTICS",
    "V4.true.OWNER.COMPLETE",
    "V4.true.OWNER.DIRECT_PID",
    "V4.true.OWNER.FIELD_POSITIVE",
    "V4.empty.COLD.COUNTS",
    "V4.empty.COLD.PAYLOAD_K",
    "V4.empty.WARM.COUNTS",
    "V4.empty.WARM.PAYLOAD_K",
    "V4.empty.N.FACTORY_RETURN",
    "V4.empty.N.NEW_N_PARENT",
    "V4.empty.N.SEMANTICS",
    "V4.empty.N.COMPLETE",
    "V4.empty.OWNER.FACTORY_RETURN",
    "V4.empty.OWNER.BARE",
    "V4.empty.OWNER.SEMANTICS",
    "V4.empty.OWNER.COMPLETE",
    "V4.empty.OWNER.DIRECT_PID",
    "V4.SOURCE_START.SELECT.FACTORY_RETURN",
    "V4.SOURCE_START.SELECT.NEW_N_PARENT",
    "V4.SOURCE_START.STOPS",
    "V4.CACHE_START.SELECT.FACTORY_RETURN",
    "V4.CACHE_START.SELECT.NEW_N_PARENT",
    "V4.CACHE_START.STOPS",
    "V4.DEFAULT.N.FACTORY_RETURN",
    "V4.DEFAULT.N.NEW_N_PARENT",
    "V4.DEFAULT.OPTOUT.PUBLIC_CLI",
    "V4.LOADER.N.PUBLIC_TSX",
    "V4.LOADER.FINAL_ENV.FACTORY_RETURN",
    "V4.LOADER.FINAL_ENV.PUBLIC_CLI",
    "V4.DIRECT_N.IPC_UNMIGRATED",
    "V4.LOADER.OWNER.CACHED",
    "V4.OWNER.WORKER",
    "V4.F.OPTOUT.FACTORY_RETURN",
    "V4.F.OPTOUT.PUBLIC_CLI",
    "V4.F.TSX_EMPTY.FACTORY_RETURN",
    "V4.F.TSX_EMPTY.PUBLIC_CLI",
    "V4.F.TSX_EXPLICIT.FACTORY_RETURN",
    "V4.F.TSX_EXPLICIT.PUBLIC_CLI",
    "V4.F.EXISTING_TSX.FACTORY_RETURN",
    "V4.F.EXISTING_TSX.PUBLIC_CLI",
    "V4.F.NO_STRIP_ENV.FACTORY_RETURN",
    "V4.F.NO_STRIP_ENV.PUBLIC_CLI",
    "V4.F.CLI_CONFIG.FACTORY_RETURN",
    "V4.F.CLI_CONFIG.PUBLIC_CLI",
    "V4.F.CWD_CONFIG.FACTORY_RETURN",
    "V4.F.CWD_CONFIG.PUBLIC_CLI",
    "V4.F.CWD_CONFIG.SEMANTICS",
    "V4.F.CWD_CONFIG.COMPLETE",
    "V4.F.ANCESTOR_CONFIG.FACTORY_RETURN",
    "V4.F.ANCESTOR_CONFIG.PUBLIC_CLI",
    "V4.F.ANCESTOR_CONFIG.SEMANTICS",
    "V4.F.ANCESTOR_CONFIG.COMPLETE",
    "V4.F.CONFIG_SYMLINK.FACTORY_RETURN",
    "V4.F.CONFIG_SYMLINK.PUBLIC_CLI",
    "V4.F.UNKNOWN_CWD.FACTORY_RETURN",
    "V4.F.UNKNOWN_CWD.PUBLIC_CLI",
    "V4.F.UNREADABLE.FACTORY_RETURN",
    "V4.F.UNREADABLE.PUBLIC_CLI",
    "V4.F.OWNER_EXTENDS.FACTORY_RETURN",
    "V4.F.OWNER_EXTENDS.PUBLIC_CLI",
    "V4.F.OWNER_FILES.FACTORY_RETURN",
    "V4.F.OWNER_FILES.PUBLIC_CLI",
    "V4.F.OWNER_INCLUDE.FACTORY_RETURN",
    "V4.F.OWNER_INCLUDE.PUBLIC_CLI",
    "V4.F.OWNER_EXCLUDE.FACTORY_RETURN",
    "V4.F.OWNER_EXCLUDE.PUBLIC_CLI",
    "V4.F.OWNER_REFERENCES.FACTORY_RETURN",
    "V4.F.OWNER_REFERENCES.PUBLIC_CLI",
    "V4.F.CACHE_ABSENT.FACTORY_RETURN",
    "V4.F.CACHE_ABSENT.PUBLIC_CLI",
    "V4.SOURCE.STALE.FACTORY_RETURN",
    "V4.SOURCE.STALE.PUBLIC_CLI",
    "V4.ONE.VOID",
    "V4.ONE.TWO_NEW_PAYLOADS",
    "V4.ONE.N.FACTORY_RETURN",
    "V4.ONE.N.NEW_N_PARENT",
    "V4.ONE.N.SEMANTICS",
    "V4.ONE.N.COMPLETE",
    "V4.ONE.OWNER.FACTORY_RETURN",
    "V4.ONE.OWNER.SEMANTICS",
    "V4.ONE.OWNER.COMPLETE",
    "V4.ONE.CLEAN.COUNTS",
    "V4.ONE.CLEAN.PAYLOAD_K",
    "V4.DELETE.TREE.COUNTS",
    "V4.DELETE.TREE.PAYLOAD_K",
    "V4.INVALIDATE.SELECT.FACTORY_RETURN",
    "V4.INVALIDATE.SELECT.NEW_N_PARENT",
    "V4.INVALIDATE.STOPS",
    "V4.CAPABILITY.NO_STRIP",
    "V4.ONE.INVALID_NO_PUBLISH",
    "V4.ONE.INVALID_SOURCE.FACTORY_RETURN",
    "V4.ONE.INVALID_SOURCE.PUBLIC_CLI",
    "V4.ONE.INVALID_NO_STALE_EXECUTION"
  ],
  "normalCompleteLabelCount": 117,
  "propertySources": {
    "COUNTS/PAYLOAD_K": "v4 compile: two format profiles for each of three independently distinct TS sources, no shared-format alias even owner={} =>3*2=6. one changed source publishes2, retains old2 until tree cleanup; deletion removes2. K independently enumerates ordinary top-level .js payloads.",
    "NEW_N_PARENT": "v4 result/new N domain: factory command preserves exact Node/entryArgs suffix, differs from public CLI, contains no public CLI, isBare=false. Baseline old CLI is a named red, never an import crash.",
    "SEMANTICS": "v4 independent {} map identity; C=live independent public CLI at same child cwd/env. Explicit owner false setter invokes1; true defines field and invokes0. Neither number is substituted for {}.",
    "PUBLIC_CLI": "v4 fallback: exact independently resolved public tsx CLI tuple for observed configured/unknown/unreadable/disabled/complex/not-covered/missing/stale domains.",
    "SOURCE_START/CACHE_START/INVALIDATE": "v4 before-load source/cache/config invalidation refuses protected TS eval, nonzero no terminating signal. Config marker is CHECK_PREBUILT_CONFIG_INVALIDATED and includes actual cwd and exact discovered tsconfig path.",
    "LOADER/DIRECT_N/WORKER": "v4 unchanged owner/worker contract. N loader remains actual public tsx; final-env factory CLI fallback; direct IPC PID unchanged. C owner worker must be real non-main thread/host PID/original .ts args[]/env. Explicit false setter1 is independently hand-derived and compared to qualified public owner CLI same args[], not unproven library-worker config.",
    "ONE.INVALID": "v4 invalid source compilation cannot publish any new payload/current hit or silently execute prior valid cached result. The invalid TS body is frozen independently.",
    "BINDING": "v4 binding: each API call and child execution captures opaque API/hook/parent/signals bytes plus exact current toy SHA before/after; missing baseline modules are explicit MISSING, never imported to manufacture red.",
    "QUALIFICATION": "process table/real EACCES/public R/source identity failure INVALID=>0 semantic assertions. Candidate returned CLI where new N required, incorrect counts, API-call errors on valid input and measurable semantic differences are named product FAIL.",
    "EMPTY_OWNER_LEGACY": "Only V4.empty.OWNER.SEMANTICS uses actual cc57 public prebuildTree/prebuiltCommand in independent same-source/config copy, same Node/esbuild/args/env; pinned Git blobs/SHA; actual bare PID/main-thread/address/raw qualification. Map only copy-root cwd/entryURL. Candidate count is never copied into expected. All N/format/independent{} and other owner/fallback/worker expectations unchanged."
  },
  "notClaimed": [
    "all tsx CLI or configuration semantics",
    "all filesystem races or atomicity",
    "performance/whole CI restoration",
    "old frozen111 suite passed",
    "historical319 retroactive module binding"
  ],
  "historicalPreservation": "old bare-N111, old v3/v3.1/v3.2/319 cases and failures unchanged; new V4 label names are separate",
  "workerClarification": "worker-oracle-clarification.json",
  "emptyOwnerClarification": "empty-owner-oracle-clarification.json"
}
` },
  { name: "packet/producer/freeze-manifest.json", sha256: "12e657481d591eb65d7e2dde0b58100b3c408ee91ea270d6521a9b5d9e6f3fa2", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/freeze-manifest.json", rootBindings: [], body: `{
  "version": "Node22-v4.2-runtime-members-only",
  "frozenAtUtc": "2026-10-25T09:06:48.672124+00:00",
  "scope": "runtime members only; old full-guard/provenance artifacts not claimed",
  "files": [
    {
      "path": "expected.json",
      "sha256": "3f9846f1275d5dec59199b394d0399af44a83720ed847c690a9a55eb8a5e9057",
      "bytes": 7240
    },
    {
      "path": "inputs/entry-invalid.ts.txt",
      "sha256": "baf20f3736274a2262a36af0901597146592729bd138d4083c3b5a804d3c6ae0",
      "bytes": 25
    },
    {
      "path": "inputs/entry-v2.ts.txt",
      "sha256": "f5354b54bdc0ea76a8a85d80b5e4989ae6dc329452b3fb447be940d7bdc54c14",
      "bytes": 537
    },
    {
      "path": "inputs/fixtures/owner-empty/package.json",
      "sha256": "efe393d66fac9c641cf01b3eb935de0fbe9b41bb164484bf401f3df834ce6adb",
      "bytes": 69
    },
    {
      "path": "inputs/fixtures/owner-empty/scripts/entry.ts",
      "sha256": "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e",
      "bytes": 537
    },
    {
      "path": "inputs/fixtures/owner-empty/scripts/state.ts",
      "sha256": "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45",
      "bytes": 276
    },
    {
      "path": "inputs/fixtures/owner-empty/scripts/tail.ts",
      "sha256": "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481",
      "bytes": 69
    },
    {
      "path": "inputs/fixtures/owner-empty/subproject/tsconfig.json",
      "sha256": "72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896",
      "bytes": 13
    },
    {
      "path": "inputs/fixtures/owner-empty/tsconfig.json",
      "sha256": "caa48a7ab58f6ef8618d04668366d1ef3fd0d8512303d7eec9abdcd3e27f620c",
      "bytes": 28
    },
    {
      "path": "inputs/fixtures/owner-false/package.json",
      "sha256": "61309c3069922207c14132ddb9bef9e192ddd41f58251dd0b4e13fb488cf7665",
      "bytes": 69
    },
    {
      "path": "inputs/fixtures/owner-false/scripts/entry.ts",
      "sha256": "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e",
      "bytes": 537
    },
    {
      "path": "inputs/fixtures/owner-false/scripts/state.ts",
      "sha256": "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45",
      "bytes": 276
    },
    {
      "path": "inputs/fixtures/owner-false/scripts/tail.ts",
      "sha256": "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481",
      "bytes": 69
    },
    {
      "path": "inputs/fixtures/owner-false/subproject/tsconfig.json",
      "sha256": "72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896",
      "bytes": 13
    },
    {
      "path": "inputs/fixtures/owner-false/tsconfig.json",
      "sha256": "b9516496d03bb7ba72eeab4efff569049940478e2a39fbf8d51175ec57d00ac5",
      "bytes": 92
    },
    {
      "path": "inputs/fixtures/owner-true/package.json",
      "sha256": "aaa9a17a999331b612757994990130659389e88ebd7620cf5989bd6502b54cbd",
      "bytes": 68
    },
    {
      "path": "inputs/fixtures/owner-true/scripts/entry.ts",
      "sha256": "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e",
      "bytes": 537
    },
    {
      "path": "inputs/fixtures/owner-true/scripts/state.ts",
      "sha256": "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45",
      "bytes": 276
    },
    {
      "path": "inputs/fixtures/owner-true/scripts/tail.ts",
      "sha256": "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481",
      "bytes": 69
    },
    {
      "path": "inputs/fixtures/owner-true/subproject/tsconfig.json",
      "sha256": "72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896",
      "bytes": 13
    },
    {
      "path": "inputs/fixtures/owner-true/tsconfig.json",
      "sha256": "0a2db56b5ac91fdf7fec01a551e8141d462928593d52f0f897fa706db2e94c20",
      "bytes": 91
    },
    {
      "path": "legacy-public-api/manifest.json",
      "sha256": "640e211d40eee25f3ccba17abe55ae9529e9bd002544db3719f786363734bab1",
      "bytes": 1527
    },
    {
      "path": "legacy-public-api/package.json",
      "sha256": "89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035",
      "bytes": 33
    },
    {
      "path": "legacy-public-api/scripts/check/prebuilt-hook.ts",
      "sha256": "bbb759bf8031d7540479cb6e3c2cd5dba0a9daa7939b6558bf2e9a04c45cba6e",
      "bytes": 4588
    },
    {
      "path": "legacy-public-api/scripts/check/prebuilt.ts",
      "sha256": "fb09aed5603a95275a618dd4d7f5e06ee6e6508801a28b4a58a9c3a857155a89",
      "bytes": 13501
    },
    {
      "path": "legacy-public-api/scripts/check/tsx-cmd.ts",
      "sha256": "d30070e19848edca5f190d2355092696056e67af611e6caaa04aa144f195373f",
      "bytes": 4838
    },
    {
      "path": "spec.json",
      "sha256": "601275305d83ce538c79eda7885eac7bc0fc228dc86de43fbbcbbafc91bd013f",
      "bytes": 2911
    },
    {
      "path": "src/capability-probe.mjs",
      "sha256": "d49a08bac4e6ce0ac9d743a0938a5c12e4698eec955598d7e533d25dc0e2c57d",
      "bytes": 246
    },
    {
      "path": "src/legacy-empty-oracle.mjs",
      "sha256": "e1700d2db1b9dc09583c980e723a10a37c55fecb6d8f9155f4cf77f1eb00b9de",
      "bytes": 5446
    },
    {
      "path": "src/run.mjs",
      "sha256": "00693b7a2e12ad1f11269489beaadb81864e4ef74bf43fd31e8ee790d629d275",
      "bytes": 24817
    },
    {
      "path": "src/supply-lifecycle.mjs",
      "sha256": "b46e6f5beb44276649807d85b1b91e74d3f1e3dad9bfd12feb9a9e364d22f368",
      "bytes": 6000
    },
    {
      "path": "src/worker-host.mjs",
      "sha256": "575f1542ab12b91482c7b87d19d1fe21153639a1cf72a6f599abf12dca08e24a",
      "bytes": 415
    }
  ]
}
` },
  { name: "packet/producer/inputs/entry-invalid.ts.txt", sha256: "baf20f3736274a2262a36af0901597146592729bd138d4083c3b5a804d3c6ae0", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/entry-invalid.ts.txt", rootBindings: [], body: `export const broken: = ;
` },
  { name: "packet/producer/inputs/entry-v2.ts.txt", sha256: "f5354b54bdc0ea76a8a85d80b5e4989ae6dc329452b3fb447be940d7bdc54c14", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/entry-v2.ts.txt", rootBindings: [], body: `import { count, version, box } from './state.ts';
import { threadId, isMainThread, parentPort } from 'node:worker_threads';
const result={unit:'producer-entry',entryRevision:'entry-v2',count,version,shared:box.value,pid:process.pid,ppid:process.ppid,threadId,isMainThread,entryURL:import.meta.url,args:process.argv.slice(2),cwd:process.cwd(),execPath:process.execPath,token:process.env.PRODUCER_TOKEN};
console.log('@@RESULT@@'+JSON.stringify(result));
if(parentPort)parentPort.postMessage(result);
if(process.send)process.send(result);
` },
  { name: "packet/producer/inputs/fixtures/owner-empty/package.json", sha256: "efe393d66fac9c641cf01b3eb935de0fbe9b41bb164484bf401f3df834ce6adb", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-empty/package.json", rootBindings: [], body: `{"type": "module", "private": true, "name": "v4-producer-toy-empty"}
` },
  { name: "packet/producer/inputs/fixtures/owner-empty/scripts/entry.ts", sha256: "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-empty/scripts/entry.ts", rootBindings: [], body: `import { count, version, box } from './state.ts';
import { threadId, isMainThread, parentPort } from 'node:worker_threads';
const result={unit:'producer-entry',entryRevision:'entry-v1',count,version,shared:box.value,pid:process.pid,ppid:process.ppid,threadId,isMainThread,entryURL:import.meta.url,args:process.argv.slice(2),cwd:process.cwd(),execPath:process.execPath,token:process.env.PRODUCER_TOKEN};
console.log('@@RESULT@@'+JSON.stringify(result));
if(parentPort)parentPort.postMessage(result);
if(process.send)process.send(result);
` },
  { name: "packet/producer/inputs/fixtures/owner-empty/scripts/state.ts", sha256: "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-empty/scripts/state.ts", rootBindings: [], body: `let calls=0;
class Base {}
Object.defineProperty(Base.prototype,'value',{set(_value){calls++;},configurable:true});
class Derived extends Base {value:number=701;}
new Derived();
export const count=calls;
export const version='state-v1';
export const box={value:'unobserved'};
` },
  { name: "packet/producer/inputs/fixtures/owner-empty/scripts/tail.ts", sha256: "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-empty/scripts/tail.ts", rootBindings: [], body: `const tailSentinel:number=-77;
console.log('@@TAIL@@'+tailSentinel);
` },
  { name: "packet/producer/inputs/fixtures/owner-empty/subproject/tsconfig.json", sha256: "72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-empty/subproject/tsconfig.json", rootBindings: [], body: `{"files":[]}
` },
  { name: "packet/producer/inputs/fixtures/owner-empty/tsconfig.json", sha256: "caa48a7ab58f6ef8618d04668366d1ef3fd0d8512303d7eec9abdcd3e27f620c", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-empty/tsconfig.json", rootBindings: [], body: `{
  "compilerOptions": {}
}
` },
  { name: "packet/producer/inputs/fixtures/owner-false/package.json", sha256: "61309c3069922207c14132ddb9bef9e192ddd41f58251dd0b4e13fb488cf7665", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-false/package.json", rootBindings: [], body: `{"type": "module", "private": true, "name": "v4-producer-toy-false"}
` },
  { name: "packet/producer/inputs/fixtures/owner-false/scripts/entry.ts", sha256: "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-false/scripts/entry.ts", rootBindings: [], body: `import { count, version, box } from './state.ts';
import { threadId, isMainThread, parentPort } from 'node:worker_threads';
const result={unit:'producer-entry',entryRevision:'entry-v1',count,version,shared:box.value,pid:process.pid,ppid:process.ppid,threadId,isMainThread,entryURL:import.meta.url,args:process.argv.slice(2),cwd:process.cwd(),execPath:process.execPath,token:process.env.PRODUCER_TOKEN};
console.log('@@RESULT@@'+JSON.stringify(result));
if(parentPort)parentPort.postMessage(result);
if(process.send)process.send(result);
` },
  { name: "packet/producer/inputs/fixtures/owner-false/scripts/state.ts", sha256: "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-false/scripts/state.ts", rootBindings: [], body: `let calls=0;
class Base {}
Object.defineProperty(Base.prototype,'value',{set(_value){calls++;},configurable:true});
class Derived extends Base {value:number=701;}
new Derived();
export const count=calls;
export const version='state-v1';
export const box={value:'unobserved'};
` },
  { name: "packet/producer/inputs/fixtures/owner-false/scripts/tail.ts", sha256: "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-false/scripts/tail.ts", rootBindings: [], body: `const tailSentinel:number=-77;
console.log('@@TAIL@@'+tailSentinel);
` },
  { name: "packet/producer/inputs/fixtures/owner-false/subproject/tsconfig.json", sha256: "72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-false/subproject/tsconfig.json", rootBindings: [], body: `{"files":[]}
` },
  { name: "packet/producer/inputs/fixtures/owner-false/tsconfig.json", sha256: "b9516496d03bb7ba72eeab4efff569049940478e2a39fbf8d51175ec57d00ac5", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-false/tsconfig.json", rootBindings: [], body: `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": false
  }
}
` },
  { name: "packet/producer/inputs/fixtures/owner-true/package.json", sha256: "aaa9a17a999331b612757994990130659389e88ebd7620cf5989bd6502b54cbd", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-true/package.json", rootBindings: [], body: `{"type": "module", "private": true, "name": "v4-producer-toy-true"}
` },
  { name: "packet/producer/inputs/fixtures/owner-true/scripts/entry.ts", sha256: "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-true/scripts/entry.ts", rootBindings: [], body: `import { count, version, box } from './state.ts';
import { threadId, isMainThread, parentPort } from 'node:worker_threads';
const result={unit:'producer-entry',entryRevision:'entry-v1',count,version,shared:box.value,pid:process.pid,ppid:process.ppid,threadId,isMainThread,entryURL:import.meta.url,args:process.argv.slice(2),cwd:process.cwd(),execPath:process.execPath,token:process.env.PRODUCER_TOKEN};
console.log('@@RESULT@@'+JSON.stringify(result));
if(parentPort)parentPort.postMessage(result);
if(process.send)process.send(result);
` },
  { name: "packet/producer/inputs/fixtures/owner-true/scripts/state.ts", sha256: "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-true/scripts/state.ts", rootBindings: [], body: `let calls=0;
class Base {}
Object.defineProperty(Base.prototype,'value',{set(_value){calls++;},configurable:true});
class Derived extends Base {value:number=701;}
new Derived();
export const count=calls;
export const version='state-v1';
export const box={value:'unobserved'};
` },
  { name: "packet/producer/inputs/fixtures/owner-true/scripts/tail.ts", sha256: "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-true/scripts/tail.ts", rootBindings: [], body: `const tailSentinel:number=-77;
console.log('@@TAIL@@'+tailSentinel);
` },
  { name: "packet/producer/inputs/fixtures/owner-true/subproject/tsconfig.json", sha256: "72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-true/subproject/tsconfig.json", rootBindings: [], body: `{"files":[]}
` },
  { name: "packet/producer/inputs/fixtures/owner-true/tsconfig.json", sha256: "0a2db56b5ac91fdf7fec01a551e8141d462928593d52f0f897fa706db2e94c20", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/inputs/fixtures/owner-true/tsconfig.json", rootBindings: [], body: `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true
  }
}
` },
  { name: "packet/producer/legacy-public-api/manifest.json", sha256: "640e211d40eee25f3ccba17abe55ae9529e9bd002544db3719f786363734bab1", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/legacy-public-api/manifest.json", rootBindings: [], body: `{
  "referenceCommit": "cc571c95abfa9dac8e900fccf7537f78a2e5b66f",
  "gitBlobVerifiedAgainstActualRepository": true,
  "onlyThreeOriginalPublicModules": true,
  "semanticReadByTestAuthor": false,
  "files": [
    {
      "name": "prebuilt.ts",
      "relativePath": "scripts/check/prebuilt.ts",
      "repositoryPath": "scripts/check/prebuilt.ts",
      "gitBlobSha1": "c75a03456b602fe1292f16d65a0221dd487223ab",
      "sha256": "fb09aed5603a95275a618dd4d7f5e06ee6e6508801a28b4a58a9c3a857155a89",
      "bytes": 13501,
      "originalExport": "/private/tmp/kc-20261024/ci-recovery-owner-empty-baseline-probe/scripts/check/prebuilt.ts"
    },
    {
      "name": "prebuilt-hook.ts",
      "relativePath": "scripts/check/prebuilt-hook.ts",
      "repositoryPath": "scripts/check/prebuilt-hook.ts",
      "gitBlobSha1": "a28ecd5363e5d296f6865957307ffcfb528cefb3",
      "sha256": "bbb759bf8031d7540479cb6e3c2cd5dba0a9daa7939b6558bf2e9a04c45cba6e",
      "bytes": 4588,
      "originalExport": "/private/tmp/kc-20261024/ci-recovery-owner-empty-baseline-probe/scripts/check/prebuilt-hook.ts"
    },
    {
      "name": "tsx-cmd.ts",
      "relativePath": "scripts/check/tsx-cmd.ts",
      "repositoryPath": "scripts/check/tsx-cmd.ts",
      "gitBlobSha1": "49ffa141eaaf055c3049cd743a5d83aef589a319",
      "sha256": "d30070e19848edca5f190d2355092696056e67af611e6caaa04aa144f195373f",
      "bytes": 4838,
      "originalExport": "/private/tmp/kc-20261024/ci-recovery-owner-empty-baseline-probe/scripts/check/tsx-cmd.ts"
    }
  ]
}
` },
  { name: "packet/producer/legacy-public-api/package.json", sha256: "89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/legacy-public-api/package.json", rootBindings: [], body: `{"type":"module","private":true}
` },
  { name: "packet/producer/legacy-public-api/scripts/check/prebuilt-hook.ts", sha256: "bbb759bf8031d7540479cb6e3c2cd5dba0a9daa7939b6558bf2e9a04c45cba6e", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/legacy-public-api/scripts/check/prebuilt-hook.ts", rootBindings: [], body: `/**
 * 预编 JS 的模块钩子（ADR-158）：裸 node 经 \`--import <本文件>?root=…&cache=…&id=…\` 装上它，
 * \`root\` 那棵 \`scripts/\` 里的 \`.ts\` 一律换成缓存里预先编好的那一份来跑。
 *
 * **地址不换，只换内容。** 解析出来的仍是 \`.ts\` 的地址，加载时读这份 \`.ts\` 现在的正文、算出它的键，
 * 交给 Node 的是缓存里那个键对应的 JS。于是 \`process.argv[1]\`、\`import.meta.url\`、报错里的路径都与
 * tsx 跑时一样是 \`.ts\`；夹具按 \`.ts\` 地址 import 的产品模块与入口 import 的是同一份，不会一个模块拆成两份。
 * **键跟着正文走**：正文改一个字就是另一个键，缓存里没有就当场报错点名，不会拿一份旧的 JS 顶上。
 *
 * \`./x.js\` 这种写法（TS 的 ESM 规矩）在 \`x.ts\` 在时认 \`x.ts\`，与 tsx 一样；\`root\` 以外的一律不碰。
 *
 * 只 import \`node:\` 内建、只用 Node 能直接去掉的类型写法：裸 node 里没有任何转换，这个文件靠 Node
 * 自己去掉类型（与 \`launch-preload.ts\` 同一处境）。键怎么算只此一份，\`prebuilt.ts\` 写缓存时也从这里拿。
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import * as nodeModule from 'node:module'
import type { LoadHookSync, ResolveHookSync } from 'node:module'
import { basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * 一份 \`.ts\` 在缓存里的键：编译身份、文件名、正文三样的 sha256。不含目录 ——
 * 变异的 worker 副本与真树里同名同内容的文件共用一份。
 */
export const keyOf = (id: string, file: string, source: string): string =>
  createHash('sha256').update(id).update('\\0').update(basename(file)).update('\\0').update(source).digest('hex')

/** 缓存里装这个键的那个文件 */
export const entryPath = (cache: string, key: string): string => join(cache, \`\${key}.js\`)

/** 钩子读取路径与源码的接口；测试可用虚拟盘 */
export interface HookDisk { exists(path: string): boolean; read(path: string): string | undefined; realpath?(path: string): string }

/** 给定那棵树、缓存目录与编译身份的两个钩子 */
export function prebuiltHooks(at: { root: string; cache: string; id: string }, disk: HookDisk): { resolve: ResolveHookSync; load: LoadHookSync } {
  // 归属按真实位置判断；解析仍交 Node，按它的软链参数决定模块身份。
  const normalize = (url: string): string => disk.realpath === undefined ? url : pathToFileURL(disk.realpath(fileURLToPath(url))).href
  const prefix = normalize(pathToFileURL(at.root).href) + '/'
  const inside = (url: string | undefined): url is string => url !== undefined && url.startsWith('file:') && normalize(url).startsWith(prefix)
  return {
    resolve(specifier, context, next) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js') && inside(context.parentURL)) {
        const ts = new URL(\`\${specifier.slice(0, -3)}.ts\`, context.parentURL)
        if (inside(ts.href) && disk.exists(fileURLToPath(ts))) return next(ts.href, context)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (!inside(url) || !new URL(url).pathname.endsWith('.ts')) return next(url, context)
      const file = fileURLToPath(url)
      const source = disk.read(file)
      if (source === undefined) throw new Error(\`预编钩子读不到 \${file}\`)
      const key = keyOf(at.id, file, source)
      const code = disk.read(entryPath(at.cache, key))
      if (code === undefined) throw new Error(\`预编缓存里没有 \${file} 现在这一版（键 \${key}）：起进程之后它改过，或者缓存被删了\`)
      return { format: 'module', source: code, shortCircuit: true }
    },
  }
}

const disk: HookDisk = {
  exists: existsSync,
  realpath: path => { try { return realpathSync(path) } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return path; throw e } },
  read: path => { try { return readFileSync(path, 'utf8') } catch { return undefined } },
}

// 作为 \`--import\` 装进来时地址上带着三样；被当成普通模块 import 时（\`prebuilt.ts\`、需求测试）不带，只交出上面那几样
const given = new URL(import.meta.url).searchParams
const root = given.get('root'), cache = given.get('cache'), id = given.get('id')
if (root !== null && cache !== null && id !== null) nodeModule.registerHooks(prebuiltHooks({ root, cache, id }, disk))
` },
  { name: "packet/producer/legacy-public-api/scripts/check/prebuilt.ts", sha256: "fb09aed5603a95275a618dd4d7f5e06ee6e6508801a28b4a58a9c3a857155a89", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/legacy-public-api/scripts/check/prebuilt.ts", rootBindings: [], body: `/**
 * 起一个跑 \`.ts\` 的验证者或入口时，用裸 node 跑预编的 JS 还是照旧交给 tsx（ADR-158）—— 判定与缓存的读写。
 *
 * tsx 每起一个进程都要先起它的壳、再在里面装转换（成本实测见 ADR-158），
 * 检查链起几千次。这里把 \`scripts/\` 下的 \`.ts\` 预先用 esbuild 编好，**按正文存**进仓库根的
 * \`.check-cache/prebuilt/\`（键见 \`prebuilt-hook.ts\` 的 \`keyOf\`），起进程时装上那个钩子跑缓存里的那份。
 *
 * **不在 \`.ts\` 旁边放 \`.js\`。** 放在旁边的话，复制 \`scripts/\` 的玩具树会连旧的 \`.js\` 一起带走，
 * 而 Node 自己就能跑 \`.ts\`：哪天有一条起法绕过了这里，\`./x.js\` 就会认到那份旧的（ADR-158 第三节）。
 * 缓存按正文寻址，改过的文件自然是另一个键：没有「过期」这回事，变异也不必还原什么。
 *
 * **缺就照旧 tsx，不靠「记得重编」。** 整棵树每个 \`.ts\` 在缓存里都有现在这一版，才走裸 node；
 * 缺一份（改了没重编、变异编不出来）就交给 tsx，跑得慢、跑的东西不变。起进程之后才改的，
 * 钩子在加载时按正文找不到，当场报错 —— 不会拿旧的顶上。
 *
 * **谁的缓存。** 从那棵 \`scripts/\` 往上找第一个带 \`.check-cache/prebuilt/\` 的目录：仓库根自己，
 * 或者变异 worker 的副本（它在仓库根的 \`.check-cache/mutate-jobs/\` 底下）往上找到仓库根。
 * 玩具树在临时目录里，找不到，照旧 tsx —— 与原型量数时同一个范围（ADR-158 第一节）。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { constants } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type * as Esbuild from 'esbuild'
import { entryPath, keyOf } from './prebuilt-hook.js'
import { tsxCommand } from './tsx-cmd.js'

/** 仓库根底下放预编 JS 的目录 */
export const PREBUILT_DIR = '.check-cache/prebuilt'

/** 编译做法的版本：下面 \`compileTs\` 的选项一改就换它，旧缓存跟着全部作废 */
export const FORMAT = 'kol-prebuilt/v1'

/** 编译身份：做法版本、esbuild 版本、目标 node 版本、tsconfig 的 compilerOptions。任一样变了，编出来的东西就可能不同 */
export const identityOf = (parts: { esbuild: string; node: string; compilerOptions: unknown }): string =>
  createHash('sha256').update(JSON.stringify([FORMAT, parts.esbuild, parts.node, parts.compilerOptions])).digest('hex').slice(0, 16)

/** 一个脚本所在的那棵 \`scripts/\`：从它的目录往上找最近一层叫 scripts 的 */
export function scriptsRootOf(script: string): string | undefined {
  for (let dir = dirname(resolve(script)); ; dir = dirname(dir)) {
    if (basename(dir) === 'scripts') return dir
    if (dirname(dir) === dir) return undefined
  }
}

/** 这棵树用哪一份缓存：从树的上一层往上，第一个带 \`.check-cache/prebuilt/\` 的目录 */
export function ownerOf(root: string, exists: (path: string) => boolean): string | undefined {
  for (let dir = dirname(root); ; dir = dirname(dir)) {
    if (exists(join(dir, PREBUILT_DIR))) return dir
    if (dirname(dir) === dir) return undefined
  }
}

/** 每个 \`.ts\` 在缓存里都有现在这一版 */
export const complete = (files: readonly string[], entryOf: (file: string) => string, has: (entry: string) => boolean): boolean =>
  files.every(f => has(entryOf(f)))

/** NODE_OPTIONS 显式带着 tsx 的加载器时保留它；仓库夹具用 fixtureLoader 选与入口一致的加载器 */
export const bringsTsxLoader = (nodeOptions: string | undefined): boolean => /[\\\\/]node_modules[\\\\/]tsx[\\\\/]|(?:^|\\s)--(?:import|loader|experimental-loader|require)(?:=|\\s+)["']?tsx(?:[\\\\/]|["']?(?:\\s|$))/.test(nodeOptions ?? '')

/**
 * 这一次走不走裸 node。\`strips\` 是这个 node 自己能不能去掉类型：钩子是 \`.ts\`，靠的就是它（22.18 起默认开着；
 * 更早的 node 上装钩子当场就起不来，照旧 tsx）。\`complete\` 最后才问：前面几样不成立就不必走一遍树
 */
export const bareLaunch = (at: { disabled: boolean; strips: boolean; script: string | undefined; nodeOptions: string | undefined;
  root: string | undefined; owner: string | undefined; complete: () => boolean }): boolean =>
  !at.disabled && at.strips && at.script !== undefined && at.script.endsWith('.ts') && !bringsTsxLoader(at.nodeOptions)
    && !/(?:^|[\\s"'])--no-experimental-strip-types(?:[\\s"']|$)/.test(at.nodeOptions ?? '')
    && at.root !== undefined && at.owner !== undefined && at.complete()

/** 钩子的地址（不带参数的那一截）：\`isBare\` 认参数表靠它 */
const HOOK = new URL('./prebuilt-hook.ts', import.meta.url)
const hookSource = readFileSync(HOOK, 'utf8')

/** 这张参数表是不是 \`prebuiltCommand\` 交出来的裸 node 起法 */
export const isBare = (argv: readonly string[]): boolean => argv[0] === '--import' && (argv[1]?.startsWith(\`\${HOOK.href}?\`) ?? false)

/**
 * 按 tsx 起时会看到的样子交回退出码与信号：tsx 的壳把里面那个进程的信号死亡报成退出码 128+N、信号为空，
 * 裸 node 没有壳，这里照它换算；tsx 起的原样交回。读退出码的一侧于是不必分两种起法（夹具「被杀」那几条认的是 137）
 */
export const asTsx = (argv: readonly string[], status: number | null, signal: NodeJS.Signals | null): { status: number | null; signal: NodeJS.Signals | null } =>
  isBare(argv) && status === null && signal !== null ? { status: 128 + constants.signals[signal], signal: null } : { status, signal }

const require = createRequire(import.meta.url)
let esbuild: typeof Esbuild | undefined

/** 每次读取配置并换身份；JSONC、继承或坏配置不判为等价，调用方保留 tsx。缓存本身可按缺省编，但不能据此裸起 */
const settingsOf = (owner: string) => {
  let compilerOptions: Record<string, unknown> = {}
  let compatible = false
  let coversScripts = false
  try {
    const config = JSON.parse(readFileSync(join(owner, 'tsconfig.json'), 'utf8'))
    compilerOptions = config.compilerOptions ?? {}
    compatible = typeof config === 'object' && config !== null && !Array.isArray(config) && !('extends' in config)
      && typeof compilerOptions === 'object' && compilerOptions !== null && !Array.isArray(compilerOptions)
    coversScripts = compatible && !('files' in config) && !('exclude' in config) && !('references' in config)
      && (config.include === undefined || (Array.isArray(config.include) && config.include.length === 1 && config.include[0] === 'scripts/**/*.ts'))
  } catch (e) { compatible = coversScripts = (e as NodeJS.ErrnoException).code === 'ENOENT' }
  const version = (require('esbuild/package.json') as { version: string }).version
  return { compilerOptions, compatible, coversScripts, id: identityOf({ esbuild: version, node: process.versions.node, compilerOptions }) }
}

/** 只确认入口项目根本层的覆盖范围；跨目录、复杂范围或父层配置交给 tsx */
const settingsAtCwd = (cwd: string, root: string): ReturnType<typeof settingsOf> | undefined => {
  try {
    const here = realpathSync(cwd)
    if (here !== realpathSync(dirname(root))) return undefined
    for (let dir = here; ; dir = dirname(dir)) {
      try {
        statSync(join(dir, 'tsconfig.json'))
        if (dir !== here) return undefined
        const settings = settingsOf(here)
        return settings.coversScripts ? settings : undefined
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return undefined
      }
      if (dirname(dir) === dir) return settingsOf(here)
    }
  } catch { return undefined }
}

/** 编一个文件，选项照 tsx 给 esbuild 的那几项（esm、目标是当前 node、keepNames、minifyWhitespace）。编不出来就抛 */
export function compileTs(source: string, file: string, compilerOptions: Record<string, unknown>): string {
  esbuild ??= require('esbuild') as typeof Esbuild
  return esbuild.transformSync(source, {
    loader: 'ts', format: 'esm', target: \`node\${process.versions.node}\`, keepNames: true, minifyWhitespace: true,
    sourcefile: basename(file), tsconfigRaw: { compilerOptions },
  }).code
}

/** 先写到旁边再改名：别的进程同时读这个键，读到的要么没有、要么是整份 */
const writeEntry = (path: string, code: string): void => {
  const temp = \`\${path}.\${process.pid}.tmp\`
  writeFileSync(temp, code)
  renameSync(temp, path)
}

const tsFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = join(dir, e.name)
  return e.isDirectory() ? tsFiles(p) : e.name.endsWith('.ts') ? [p] : []
})

/** 一个文件现在这一版的键；没改过（修改时间与大小都没变）就不重读正文 */
const seen = new Map<string, { id: string; mtimeMs: number; size: number; key: string }>()
const keyNow = (file: string, id: string): string => {
  const st = statSync(file)
  const had = seen.get(file)
  if (had !== undefined && had.id === id && had.mtimeMs === st.mtimeMs && had.size === st.size) return had.key
  const key = keyOf(id, file, readFileSync(file, 'utf8'))
  seen.set(file, { id, mtimeMs: st.mtimeMs, size: st.size, key })
  return key
}

/** 预编整棵树（\`compile.ts\` 调）：缺的编上，不属于这棵树现在这一版的删掉 */
export function prebuildTree(owner: string): { wrote: number; kept: number; removed: number } {
  const cache = join(owner, PREBUILT_DIR)
  mkdirSync(cache, { recursive: true })
  const { compilerOptions, id } = settingsOf(owner)
  const want = new Set<string>()
  let wrote = 0, kept = 0, removed = 0
  for (const file of tsFiles(join(owner, 'scripts'))) {
    const source = readFileSync(file, 'utf8')
    const path = entryPath(cache, keyOf(id, file, source))
    want.add(basename(path))
    if (existsSync(path)) { kept++; continue }
    writeEntry(path, compileTs(source, file, compilerOptions))
    wrote++
  }
  for (const name of readdirSync(cache)) if (!want.has(name)) { rmSync(join(cache, name), { force: true }); removed++ }
  return { wrote, kept, removed }
}

/**
 * 变异落盘后把被改的那一个文件编进缓存（\`mutate.ts\` 调）。编不出来、写不进去、或者这棵树没有缓存，就什么也不写 ——
 * 这一条于是退回 tsx，照旧在那里报它的错。用完不删：别的 worker 可能正跑着同一份，下一次预编整棵树时清掉
 */
export function prebuildOne(file: string, source: string): void {
  const root = scriptsRootOf(file)
  const owner = root === undefined ? undefined : ownerOf(root, existsSync)
  if (owner === undefined) return
  const { compilerOptions, id } = settingsOf(owner)
  const path = entryPath(join(owner, PREBUILT_DIR), keyOf(id, resolve(file), source))
  try { writeEntry(path, compileTs(source, file, compilerOptions)) } catch { rmSync(\`\${path}.\${process.pid}.tmp\`, { force: true }) }
}

/** 钩子的地址，带上那棵树、缓存目录与编译身份 */
const hookFor = (root: string, owner: string, id: string): string => {
  const url = new URL(HOOK)
  url.searchParams.set('root', root)
  url.searchParams.set('cache', join(owner, PREBUILT_DIR))
  url.searchParams.set('id', id)
  return url.href
}

/**
 * 和 \`tsxCommand\` 同一个形状：走得了裸 node 就 \`node --import <钩子> <原参数>\`（命令行上照旧写 \`.ts\`），
 * 否则原样交给 tsx。\`cwd\` 是子进程的工作目录（相对路径按它找），\`env\` 是子进程拿到的环境。
 */
export function prebuiltCommand(args: string[], cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): [string, string[]] {
  if (env.TSX_TSCONFIG_PATH !== undefined) return tsxCommand(args)
  const script = args[0] === undefined ? undefined : resolve(cwd, args[0])
  const root = script === undefined ? undefined : scriptsRootOf(script)
  const owner = root === undefined ? undefined : ownerOf(root, existsSync)
  const bare = bareLaunch({ disabled: env.KOL_PREBUILT === '0', strips: Boolean(process.features.typescript), script,
    nodeOptions: env.NODE_OPTIONS, root, owner,
    complete: () => {
      // 钩子自身施变时不能兼任验证者的可信启动器；仍由 tsx 执行实际断言。
      if (readFileSync(HOOK, 'utf8') !== hookSource) return false
      const { id, compatible } = settingsOf(owner!)
      const current = settingsAtCwd(cwd, root!)
      if (!compatible || current?.compatible !== true || current.id !== id) return false
      const cache = join(owner!, PREBUILT_DIR)
      return complete(tsFiles(root!), f => entryPath(cache, keyNow(f, id)), existsSync)
    } })
  return bare ? [process.execPath, ['--import', hookFor(root!, owner!, settingsOf(owner!).id), ...args]] : tsxCommand(args)
}

/** 入口前的观察器及 fake-fetch 与入口共用同一加载器；script 定位入口所在树，env 是添加预加载前的子环境，cwd 是实际子工作目录（省略保留调用时目录） */
export function fixtureLoader(script: string, env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string {
  const [, argv] = prebuiltCommand([script], cwd, env)
  return isBare(argv) ? argv[1]! : pathToFileURL(require.resolve('tsx')).href
}
` },
  { name: "packet/producer/legacy-public-api/scripts/check/tsx-cmd.ts", sha256: "d30070e19848edca5f190d2355092696056e67af611e6caaa04aa144f195373f", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/legacy-public-api/scripts/check/tsx-cmd.ts", rootBindings: [], body: `/**
 * 起一个跑 \`.ts\` 的子进程要用的那条命令 —— **全仓只此一份。**
 *
 * 三处都要起 tsx，等法各不一样（自检同步等、还要两股分开收；测试同步等一股；
 * 变异异步等、还要自成一组）。**不一样的是等法，一样的是「起哪个可执行文件、
 * 前面垫哪些参数」** —— 只有后者搬进来。代跑的话这里就得装下三种等法，
 * 而那正是三处各自的语义。
 *
 * ## 为什么值得只此一份
 *
 * 三处原先各写各的，而且**各错各的**：
 *
 * | 原先那一行 | 在 Windows 上怎么坏 |
 * |---|---|
 * | \`spawn('npx', ['tsx', …])\`（\`mutate.ts\`，PR #73 已改） | \`npx\` 是 \`npx.cmd\`，而 **\`.cmd\` 不带 shell 根本起不来** —— Node 文档写着「\`.bat\` 和 \`.cmd\` 在 Windows 上没有终端就不能自己执行」 |
 * | \`spawnSync('npx', ['tsx', …])\`（\`selfcheck.ts\`） | 同上 |
 * | \`spawnSync('node_modules/.bin/tsx', …)\`（\`test.ts\`） | libuv 只按**文件名段**找扩展名（\`.bin\` 里那个点不算），无扩展名就只试 \`tsx.com\` / \`tsx.exe\`；而 npm 在 Windows 生成的是 \`tsx.cmd\` / \`tsx.ps1\` / \`tsx\`(sh shim) |
 *
 * #73 只修了第一处就收工，于是同一个坑在另外两处原样留着 —— ADR-69 第一块欠条记的
 * 就是这件事，而它自己写明修法是「三处抽一份共用的『怎么起 tsx』**一起改**」：
 * 同一份证据，按 \`process/6-INTEGRATE.md\` 的切分判据是**一个**改动。
 * 只改其中一处就是又一次「只修实例」（ADR-45 / ADR-69 的教训一节骂的正是这个）。
 *
 * ## 摆在桌上的三条路，为什么选当前这条
 *
 * | 做法 | 判定 |
 * |---|---|
 * | 显式挑 \`npx.cmd\` | **走不通**。不带 shell 起不来的正是 \`.cmd\` 这类文件，挑明名字也一样 |
 * | \`spawn(..., { shell: true })\` | 能跑，但要经 \`cmd.exe\`，而 DEP0190 的正文点名了 \`spawn\`：带 shell 传参数数组时，各个值**不转义、只用空格拼起来，会导致 shell 注入**。也就是说注入面不是「拼字符串才有」，是这条路自带的。（本仓库钉的是 Node v22，那里 DEP0190 是 Documentation-only；v24+ 的 \`.cmd\` 那一节才写着「不推荐」——**结论不受版本影响**，注入那句在 v22 文档里就在） |
 * | **当前 node + tsx 的 cli** | 不经 shell，也就没有注入面可争论；\`.cmd\` 压根不参与；还少一层进程 |
 *
 * ⚠️ **本仓库的 CI 只跑 Linux（\`.github/workflows/*.yml\` 的 \`runs-on\` 全是
 * \`ubuntu-latest\`），所以上面关于 Windows 的话没有任何自动化验过。** 它靠的是
 * Node 官方文档 + 代码推理，不是一次真的 Windows 运行。Linux 这一侧是真跑过的。
 *
 * ⚠️ 这一条只解决**「起不起得来」**。Windows 上「怎么把它停下来」是另一个坑，
 * 还欠着（ADR-69 第二块：\`mutate-restore.ts\` 的 \`process.kill(-pid)\` 配的是
 * POSIX 的进程组语义，而 \`detached\` 在 Windows 上给的是一个控制台窗口，不是进程组）。
 */
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

/**
 * tsx 的 cli 入口。
 *
 * \`tsx/cli\` 是 tsx 包的**公开导出**（它的 \`exports\` 里有 \`"./cli"\`），所以用
 * \`require.resolve\` 拿路径，不把 \`node_modules/tsx/dist/…\` 这种内部路径写死 ——
 * 写死的那种升一次版就指空，而且指空的样子是「起不来」，不是「说不出为什么」。
 *
 * 认的是 \`import.meta.url\`，**不是 \`process.cwd()\`**：自检有几处切到临时目录里跑，
 * 按 cwd 找会找到临时目录那一侧去。
 */
const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli')

/**
 * 跑这几个参数要用的 \`[可执行文件, 参数表]\`，直接摊给 \`spawn\` / \`spawnSync\`。
 *
 * \`process.execPath\` 就是正在跑这个进程的那个 node —— 子进程的版本不会和父进程错开，
 * 也不经 \`PATH\`，于是「装了哪个 node」和「跑的是哪个 node」不再是两件事。
 */
export const tsxCommand = (args: string[]): [string, string[]] =>
  [process.execPath, [TSX_CLI, ...args]]

/**
 * 起这些子进程时给的 V8 编译缓存目录（理由写在 \`mutate.ts\` 那个常量上）。**变异与独立自检
 * 共用这一份**：检查链里变异那一步先跑、把它焐热，独立自检起的几百个进程直接命中
 * （ADR-97 第八节那张欠条，ADR-132）。两处各写一份路径的话，改了一处，另一处就悄悄退回冷启动。
 *
 * 认已有的值：外面已经指了一份就用那份。按调用时的工作目录解析 —— 两处都在仓库根上取。
 */
export const compileCacheDir = (): string => process.env.NODE_COMPILE_CACHE ?? resolve('.check-cache/compile-cache')
` },
  { name: "packet/producer/spec.json", sha256: "601275305d83ce538c79eda7885eac7bc0fc228dc86de43fbbcbbafc91bd013f", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/spec.json", rootBindings: [], body: `{
  "version": "v4.2-producer-empty-legacy-reference",
  "publicContractSha256": "70a5c889b930e8010849e4c12d4fc13bba5806e629410730a577b9ca4b39070d",
  "historicalBase": "5b0f10af6b86f43425181bbf25c92f81b7feea9b",
  "args": [
    "producer-arg-one",
    "producer arg with space",
    "--literal-entry-arg"
  ],
  "envToken": "v4-producer-env-token-803",
  "fixtureSourceHashes": {
    "owner-empty/scripts/entry.ts": "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e",
    "owner-empty/scripts/state.ts": "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45",
    "owner-empty/scripts/tail.ts": "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481",
    "owner-false/scripts/entry.ts": "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e",
    "owner-false/scripts/state.ts": "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45",
    "owner-false/scripts/tail.ts": "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481",
    "owner-true/scripts/entry.ts": "823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e",
    "owner-true/scripts/state.ts": "fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45",
    "owner-true/scripts/tail.ts": "cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481"
  },
  "profilesPerSource": 2,
  "initialSourcesPerOwner": 3,
  "expectedCounts": {
    "cold": {
      "wrote": 6,
      "kept": 0,
      "removed": 0
    },
    "warm": {
      "wrote": 0,
      "kept": 6,
      "removed": 0
    },
    "oneUpdateBeforeCleanupK": 8,
    "afterOneTree": {
      "wrote": 0,
      "kept": 6,
      "removed": 2
    },
    "afterDeleteTail": {
      "wrote": 0,
      "kept": 4,
      "removed": 2
    }
  },
  "identity": "owner legacy format and new N relative-map format are independent even owner compilerOptions={}",
  "NdefaultSemanticOracle": "independently resolved public tsx CLI with same actual external cwd/env/input; never infer {} count from owner options",
  "invalid": "API import/export/ps permission fixture/public reference/source-identity infrastructure failure means INVALID and zero semantic assertions; new N returning old CLI is named NEW_N_PARENT FAIL",
  "neverRead": [
    "prebuilt.ts/hook/parent/signals implementation bodies",
    "cache key/index implementation",
    "author reasoning"
  ],
  "noPerformanceConclusion": true,
  "goPublication": "lifecycle tools use frozen v3.2 same-directory temporary JSON then rename; original 319 cases/TS/expected remain unchanged",
  "workerOracle": "explicit owner false setter1 hand calculation + qualified public owner CLI same args[]; actual public worker remains thread/address wiring positive",
  "emptyOwnerOracle": "unchanged legacy domain compared to immutable actual-cc57 public API under same Node/esbuild and frozen source/config/args/env; new N remains complete public CLI relation"
}
` },
  { name: "packet/producer/src/capability-probe.mjs", sha256: "d49a08bac4e6ce0ac9d743a0938a5c12e4698eec955598d7e533d25dc0e2c57d", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/src/capability-probe.mjs", rootBindings: [], body: `const api=await import(process.argv[2]);
const args=JSON.parse(process.argv[3]),env=JSON.parse(process.argv[5]);
console.log('@@CAP@@'+JSON.stringify({typescript:process.features.typescript,tuple:api.prebuiltCommand(args,process.argv[4],env)}));
` },
  { name: "packet/producer/src/legacy-empty-oracle.mjs", sha256: "e1700d2db1b9dc09583c980e723a10a37c55fecb6d8f9155f4cf77f1eb00b9de", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/src/legacy-empty-oracle.mjs", rootBindings: [], body: `// Only the unchanged empty-owner legacy domain uses this immutable public API oracle.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function legacyEmptyOwnerReference({runtime,root,out,args,env,run}){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'legacy-public-api/manifest.json'),'utf8'));
 const bundled=path.join(root,'legacy-public-api');
 const apiURL=runtime.legacyOwnerApiModuleURL||pathToFileURL(path.join(bundled,'scripts/check/prebuilt.ts')).href;
 const bindingFiles=runtime.legacyOwnerBindingFiles||Object.fromEntries(manifest.files.map(f=>[f.name,path.join(bundled,f.relativePath)]));
 const locations={};for(const f of manifest.files){const found=Object.values(bindingFiles).filter(p=>path.basename(p)===f.name);if(found.length!==1)throw new Error('legacy reference binding setup INVALID: '+f.name);locations[f.name]=found[0]}
 if(Object.keys(bindingFiles).length!==3||fileURLToPath(apiURL)!==locations['prebuilt.ts'])throw new Error('legacy oracle must execute exactly the three pinned cc57 public modules');
 const capture=()=>Object.fromEntries(manifest.files.map(f=>{const bytes=fs.readFileSync(locations[f.name]);const sha=hash(bytes),blob=crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\\0'),bytes])).digest('hex');if(sha!==f.sha256||blob!==f.gitBlobSha1)throw new Error('legacy immutable module identity INVALID: '+f.name);return[f.name,{file:locations[f.name],sha256:sha,gitBlobSha1:blob}]}));
 const initial=capture();
 // The packaged legacy API shares only installed public dependencies; no old repo fetch.
 if(!runtime.legacyOwnerApiModuleURL){const modules=path.join(bundled,'node_modules');if(!fs.existsSync(modules))fs.symlinkSync(path.join(runtime.publicResolutionOwner,'node_modules'),modules,'dir')}
 const currentRequire=createRequire(new URL(runtime.apiModuleURL));const legacyRequire=createRequire(new URL(apiURL));
 const currentCompiler=JSON.parse(fs.readFileSync(currentRequire.resolve('esbuild/package.json'),'utf8')).version;
 const referenceCompiler=JSON.parse(fs.readFileSync(legacyRequire.resolve('esbuild/package.json'),'utf8')).version;
 if(currentCompiler!==referenceCompiler)throw new Error('legacy oracle compiler identity INVALID: different esbuild versions');
 const referenceOwner=path.join(out,'legacy-owner-empty');fs.cpSync(path.join(root,'inputs/fixtures/owner-empty'),referenceOwner,{recursive:true});
 const referenceEntry=path.join(referenceOwner,'scripts/entry.ts');
 const inputSnapshot=()=>Object.fromEntries(['scripts/entry.ts','scripts/state.ts','scripts/tail.ts','tsconfig.json','package.json'].map(n=>[n,{file:path.join(referenceOwner,n),sha256:hash(fs.readFileSync(path.join(referenceOwner,n)))}]));
 const inputBefore=inputSnapshot();for(const[n,value]of Object.entries(inputBefore))if(value.sha256!==hash(fs.readFileSync(path.join(root,'inputs/fixtures/owner-empty',n))))throw new Error('legacy oracle copied input identity INVALID');
 const api=await import(apiURL);if(!same(initial,capture()))throw new Error('legacy module changed during import');
 const calls=[];
 const invoke=(name,values)=>{const before=capture(),sourcesBefore=inputSnapshot();if(!same(before,initial))throw new Error('legacy module changed between calls');const result=api[name](...values);const after=capture(),sourcesAfter=inputSnapshot();if(!same(before,after)||!same(sourcesBefore,sourcesAfter))throw new Error('legacy target/input binding changed');calls.push({name,result,before,after,sourcesBefore,sourcesAfter});return result};
 invoke('prebuildTree',[referenceOwner]);
 const tuple=invoke('prebuiltCommand',[[referenceEntry,...args],referenceOwner,env]);
 const bare=invoke('isBare',[tuple[1]]);
 if(tuple[0]!==runtime.node||bare!==true)throw new Error('legacy owner reference not eligible for original bare domain');
 const beforeTarget=capture(),sourceBeforeTarget=inputSnapshot();
 const reference=await run('empty.OWNER.LEGACY_CC57_R',tuple,referenceOwner,env);
 const afterTarget=capture(),sourceAfterTarget=inputSnapshot();
 if(!same(beforeTarget,afterTarget)||!same(sourceBeforeTarget,sourceAfterTarget))throw new Error('legacy module/input changed during reference execution');
 if(reference.rawBeforeCleanup?.status!==0||reference.rawBeforeCleanup.signal!==null||!reference.closeBeforeCleanup||reference.residual?.length||!reference.result||reference.result.pid!==reference.rootPid||reference.result.threadId!==0||reference.result.isMainThread!==true||reference.result.entryURL!==pathToFileURL(referenceEntry).href||!same(reference.result.args,args))throw new Error('legacy owner raw/PID/thread/address/args reference qualification INVALID');
 return{reference,evidence:{referenceCommit:manifest.referenceCommit,apiURL,compilerVersion:referenceCompiler,toolNode:process.execPath,toolVersion:process.version,platform:process.platform,arch:process.arch,calls,beforeTarget,afterTarget,sourceBeforeTarget,sourceAfterTarget,tuple,referenceOwner,referenceEntry,onlyAllowedOutputNormalization:['cwd: reference owner root -> current owner root','entryURL: reference original.ts URL -> current original.ts URL'],expectedCountTakenFromCandidate:false}};
}
` },
  { name: "packet/producer/src/run.mjs", sha256: "00693b7a2e12ad1f11269489beaadb81864e4ef74bf43fd31e8ee790d629d275", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/src/run.mjs", rootBindings: [], body: `import { bindNode22, assertBoundCarrier } from '../../binding/node-binding.mjs';
import { legacyEmptyOwnerReference } from './legacy-empty-oracle.mjs';
// Fixed producer contract. Only public exports are invoked; target bodies are never read as text.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtime=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const nodeBinding=await bindNode22(runtime);if(nodeBinding.status!=='VALID_TOOL_BINDING'){console.log(JSON.stringify({status:'INVALID',semanticAssertions:0,reason:nodeBinding.reason,receipt:nodeBinding.receipt}));process.exit(2);}
const spec=JSON.parse(fs.readFileSync(path.join(root,'spec.json'),'utf8'));
const out=path.join(runtime.outputRoot||path.join(root,'runs'),'producer-'+Date.now());fs.mkdirSync(out,{recursive:true});
const fixture=path.join(out,'fixtures');fs.cpSync(path.join(root,'inputs/fixtures'),fixture,{recursive:true});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=file=>{try{return{state:'FILE',sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}}catch(e){if(e.code==='ENOENT')return{state:'MISSING'};throw e}};
const apiFile=fileURLToPath(runtime.apiModuleURL),apiDir=path.dirname(apiFile);
const bindingFiles=runtime.bindingFiles||Object.fromEntries(['prebuilt.ts','prebuilt-hook.ts','prebuilt-parent.ts','prebuilt-signals.ts'].map(f=>[f,path.join(apiDir,f)]));
const bindings=()=>Object.fromEntries(Object.entries(bindingFiles).map(([k,f])=>[k,{file:f,...hash(f)}]));
function sources(dir){if(!dir)return Object.assign({},...['false','true','empty'].map(p=>sources(path.join(fixture,'owner-'+p,'scripts'))));const found={};for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())Object.assign(found,sources(p));else if(d.isFile()&&p.endsWith('.ts'))found[p]=hash(p)}return found}
function absence(cwd){let d=fs.realpathSync(cwd);const proof=[];for(;;){try{fs.lstatSync(path.join(d,'tsconfig.json'));throw new Error('N configuration exists at '+d)}catch(e){if(e.code!=='ENOENT')throw e;proof.push({directory:d,tsconfig:'ENOENT'})}const p=path.dirname(d);if(p===d)return proof;d=p}}
const ps=()=>{const p=spawnSync('/bin/ps',['-axo','pid=,ppid=,pgid=,stat='],{encoding:'utf8'});if(p.error||p.status)throw new Error('ps unavailable');return p.stdout.split('\\n').map(l=>l.trim().split(/\\s+/)).filter(v=>v.length===4).map(([pid,ppid,pgid,stat])=>({pid:+pid,ppid:+ppid,pgid:+pgid,stat}))};
const active=p=>!p.stat.startsWith('Z');
const report={nodeBinding,status:'INVALID',assertions:[],semanticAssertions:0,calls:[],runs:[],infrastructureError:null,apiModuleURL:runtime.apiModuleURL};
const check=(label,ok,expected,actual)=>report.assertions.push({label:'V4.'+label,status:ok?'PASS':'FAIL',expected,actual});
let api,initialBinding;
function call(id,name,args){const before=bindings(),sourceBefore=sources();if(!same(before,initialBinding))throw new Error('API/module identity changed before '+id);const relevant=e=>Object.fromEntries(['KOL_PREBUILT','TSX_TSCONFIG_PATH','NODE_OPTIONS'].filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]]));const input=name==='prebuiltCommand'?{args:args[0],cwd:args[1]??process.cwd(),eligibilityEnv:relevant(args[2]??process.env)}:name==='fixtureLoader'?{script:args[0],cwd:args[2]??process.cwd(),eligibilityEnv:relevant(args[1]??process.env)}:name==='prebuildOne'?{file:args[0],sourceSha256:crypto.createHash('sha256').update(args[1]).digest('hex')}:name==='prebuildTree'?{owner:args[0]}:{argv:args[0]};const record={id,name,input,before,sourceBefore};try{record.value=api[name](...args)}catch(e){record.error={name:e.name,code:e.code||null,message:e.message}}record.after=bindings();record.sourceAfter=sources();if(!same(record.before,record.after)||!same(record.sourceBefore,record.sourceAfter))throw new Error('binding changed during '+id);report.calls.push(record);return record}
const tupleValid=t=>Array.isArray(t)&&t.length===2&&typeof t[0]==='string'&&Array.isArray(t[1])&&t[1].every(a=>typeof a==='string');
const publicRequire=createRequire(path.join(runtime.publicResolutionOwner,'package.json'));
const publicCli=publicRequire.resolve('tsx/cli'),publicLoader=pathToFileURL(publicRequire.resolve('tsx')).href;
const env={...process.env,...runtime.baseEnv,PRODUCER_TOKEN:spec.envToken};for(const k of runtime.unsetEnv||[])delete env[k];
const nCwd=path.join(fixture,'no-config/leaf'),owner=p=>path.join(fixture,'owner-'+p),entry=p=>path.join(owner(p),'scripts/entry.ts'),entryArgs=p=>[entry(p),...spec.args];
const R=args=>[runtime.node,[publicCli,...args]];
function factory(id,args,cwd,childEnv=env){const x=call(id,'prebuiltCommand',[args,cwd,childEnv]);check(id+'.FACTORY_RETURN',!x.error&&tupleValid(x.value),'public factory returns valid command tuple, not import/runtime crash',x.error||x.value);return tupleValid(x.value)?x.value:null}
function isBare(id,argv){const x=call(id,'isBare',[argv]);return x.error?null:x.value}
function nRoute(id,t,args){check(id+'.NEW_N_PARENT',tupleValid(t)&&t[0]===runtime.node&&!same(t,R(args))&&!t[1].includes(publicCli)&&same(t[1].slice(-args.length),args)&&isBare(id+'.IS_BARE',t[1])===false,'N command uses own parent, original suffix, non-bare public status; never CLI+cache or bare node',t)}
function fallback(id,t,args){check(id+'.PUBLIC_CLI',same(t,R(args)),'byte-identical public tsx CLI tuple',t)}
function K(p){const dir=path.join(owner(p),'.check-cache/prebuilt');if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.js')).map(e=>path.join(dir,e.name)).sort()}
function tree(id,p,wanted){const x=call(id,'prebuildTree',[owner(p)]);check(id+'.COUNTS',!x.error&&['wrote','kept','removed'].every(k=>x.value?.[k]===wanted[k]),'independently counted two format profiles per TS source',x.error||x.value);check(id+'.PAYLOAD_K',K(p).length===wanted.wrote+wanted.kept,'top-level ordinary .js payload count = current complete two-format domain',K(p));return x}
async function run(id,tuple,cwd,childEnv=env,ipc=false){const before=bindings(),sourceBefore=sources();if(!same(before,initialBinding))throw new Error('target binding changed before '+id);const record={id,tuple,cwd,before,sourceBefore,raw:null,stdout:'',stderr:'',messages:[],rootPid:null};if(!tuple){record.invalidTuple=true;report.runs.push(record);return record}let child,own,isolated=false,closed=false;try{assertBoundCarrier(tuple,runtime);own=ps().find(p=>p.pid===process.pid)?.pgid;child=spawn(tuple[0],tuple[1],{cwd,env:{...childEnv,PRODUCER_TOKEN:spec.envToken},detached:true,stdio:ipc?['ignore','pipe','pipe','ipc']:['ignore','pipe','pipe']});record.rootPid=child.pid;child.stdout.on('data',b=>record.stdout+=b);child.stderr.on('data',b=>record.stderr+=b);child.on('message',m=>record.messages.push(m));child.once('error',e=>record.raw={status:null,signal:null,error:e.code});child.once('exit',(status,signal)=>record.raw={status,signal,error:null});child.once('close',()=>closed=true);const at=Date.now();while(Date.now()-at<5000){const table=ps(),row=table.find(p=>p.pid===child.pid);if(row){if(row.pgid!==child.pid||row.pgid===own)throw new Error('isolated PGID proof failed');isolated=true}if(record.raw&&closed&&!table.some(p=>p.pgid===child.pid&&active(p)))break;await sleep(5)}record.closeBeforeCleanup=closed;record.residual=ps().filter(p=>p.pgid===child.pid&&active(p));record.rawBeforeCleanup=record.raw;if(record.residual.length){if(!isolated||!own||ps().find(p=>p.pid===process.pid)?.pgid!==own||child.pid===own)throw new Error('safe cleanup unavailable');record.cleanup=true;process.kill(-child.pid,'SIGKILL');const clean=Date.now();while(Date.now()-clean<2000&&ps().some(p=>p.pgid===child.pid&&active(p)))await sleep(5);if(ps().some(p=>p.pgid===child.pid&&active(p)))throw new Error('test descendants survive cleanup')}record.result=record.stdout.split('\\n').filter(l=>l.startsWith('@@RESULT@@')).map(l=>JSON.parse(l.slice(10)))[0]||null;record.worker=record.stdout.split('\\n').filter(l=>l.startsWith('@@WORKER@@')).map(l=>JSON.parse(l.slice(10)))[0]||null}catch(e){record.infrastructureError=e.message;try{if(isolated&&child?.pid!==own)process.kill(-child.pid,'SIGKILL')}catch{}}record.after=bindings();record.sourceAfter=sources();if(!same(before,record.after)||!same(sourceBefore,record.sourceAfter))throw new Error('target/source binding changed during '+id);report.runs.push(record);if(record.infrastructureError)throw new Error(record.infrastructureError);return record}
const visible=x=>{if(!x)return null;const{pid,ppid,threadId,isMainThread,...v}=x;return v};
async function semantic(id,p,t,cwd=nCwd,wantRevision='entry-v1'){const ref=await run(id+'.R',R(entryArgs(p)),cwd);if(ref.rawBeforeCleanup?.status!==0||!ref.result)throw new Error('public reference invalid at '+id);const c=await run(id+'.C',t,cwd);check(id+'.SEMANTICS',same(visible(c.result),visible(ref.result))&&c.result?.entryRevision===wantRevision,'C fixture values/independent default profile/TS URL/args/cwd/env equal public CLI R', {R:ref.result,C:c.result});check(id+'.COMPLETE',same(c.rawBeforeCleanup,ref.rawBeforeCleanup)&&c.closeBeforeCleanup&&c.residual?.length===0,'raw0/null, stdio and all descendants complete before cleanup',c);return c}
async function semanticEmptyOwner(id,tuple,cwd){
 const diagnostic=await run(id+'.PUBLIC_CLI_DIAGNOSTIC',R(entryArgs('empty')),cwd);
 if(diagnostic.rawBeforeCleanup?.status!==0||!diagnostic.result||diagnostic.result.threadId!==0||diagnostic.result.isMainThread!==true)throw new Error('public owner CLI address/normal-exit diagnostic INVALID');
 const legacy=await legacyEmptyOwnerReference({runtime,root,out,args:spec.args,env,run});
 const mapped={...legacy.reference.result,cwd:diagnostic.result.cwd,entryURL:diagnostic.result.entryURL};
 const candidate=await run(id+'.C',tuple,cwd);
 check(id+'.SEMANTICS',candidate.result?.pid===candidate.rootPid&&candidate.result?.threadId===0&&candidate.result?.isMainThread===true&&same(visible(candidate.result),visible(mapped)),'unchanged empty owner legacy behavior equals pinned cc57 public owner API; only copy-root cwd/TS URL mapped; no candidate-derived count',{reference:legacy.reference.result,mappedReference:mapped,candidate:candidate.result,publicCliDiagnostic:diagnostic.result});
 check(id+'.COMPLETE',same(candidate.rawBeforeCleanup,legacy.reference.rawBeforeCleanup)&&candidate.closeBeforeCleanup&&candidate.residual?.length===0,'original empty owner bare normal0/stdout/all-descendant completion equals qualified legacy public API',candidate);
 report.legacyEmptyOwnerOracle={...legacy.evidence,publicCliDiagnostic:diagnostic.result,mappedReference:mapped,candidateAddress:diagnostic.result.entryURL};
 return candidate;
}
try{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'freeze-manifest.json'),'utf8'));for(const f of manifest.files)if(hash(path.join(root,f.path)).sha256!==f.sha256)throw new Error('frozen test input changed: '+f.path);
 for(const [relative,sha]of Object.entries(spec.fixtureSourceHashes))if(hash(path.join(fixture,relative)).sha256!==sha)throw new Error('copied toy source identity INVALID: '+relative);
 initialBinding=bindings();report.bindingAtImport=initialBinding;report.sourceAtImport=sources();
 try{api=await import(runtime.apiModuleURL)}catch(e){throw new Error('API import INVALID, no product assertions: '+e.message)}
 if(!['prebuildTree','prebuildOne','prebuiltCommand','fixtureLoader','isBare'].every(k=>typeof api[k]==='function'))throw new Error('public API export setup invalid');
 if(!same(initialBinding,bindings())||!same(report.sourceAtImport,sources()))throw new Error('module/source changed during import');
 report.noConfigProof=absence(nCwd);
 for(const p of ['false','true','empty']){tree(p+'.COLD',p,{wrote:6,kept:0,removed:0});tree(p+'.WARM',p,{wrote:0,kept:6,removed:0});const t=factory(p+'.N',entryArgs(p),nCwd);nRoute(p+'.N',t,entryArgs(p));await semantic(p+'.N',p,t);const own=factory(p+'.OWNER',entryArgs(p),owner(p));check(p+'.OWNER.BARE',Boolean(own)&&isBare(p+'.OWNER.IS_BARE',own[1])===true,'original owner remains bare',own);const ownRun=p==='empty'?await semanticEmptyOwner(p+'.OWNER',own,owner(p)):await semantic(p+'.OWNER',p,own,owner(p));check(p+'.OWNER.DIRECT_PID',ownRun.result?.pid===ownRun.rootPid,'original owner executes in direct Node PID without new parent',ownRun.result);if(p!=='empty')check(p+'.OWNER.FIELD_POSITIVE',ownRun.result?.count===(p==='false'?1:0),'explicit owner setter positive hand-derived false=1, true=0; not extrapolated to N default',ownRun.result)}
 const args=entryArgs('false');
 const startupSource=factory('SOURCE_START.SELECT',args,nCwd);nRoute('SOURCE_START.SELECT',startupSource,args);fs.writeFileSync(entry('false'),fs.readFileSync(path.join(root,'inputs/entry-v2.ts.txt'),'utf8'));try{const changed=await run('SOURCE_START.C',startupSource,nCwd);check('SOURCE_START.STOPS',Number.isInteger(changed.rawBeforeCleanup?.status)&&changed.rawBeforeCleanup.status!==0&&changed.rawBeforeCleanup.signal===null&&changed.result===null&&changed.residual?.length===0,'selected N cannot silently evaluate old or uncached new source after deterministic source change',changed)}finally{fs.writeFileSync(entry('false'),fs.readFileSync(path.join(root,'inputs/fixtures/owner-false/scripts/entry.ts'),'utf8'))}
 const startupCache=factory('CACHE_START.SELECT',args,nCwd);nRoute('CACHE_START.SELECT',startupCache,args);const startupCachePath=path.join(owner('false'),'.check-cache/prebuilt'),startupSaved=startupCachePath+'-startup-saved';fs.renameSync(startupCachePath,startupSaved);try{const missing=await run('CACHE_START.C',startupCache,nCwd);check('CACHE_START.STOPS',Number.isInteger(missing.rawBeforeCleanup?.status)&&missing.rawBeforeCleanup.status!==0&&missing.rawBeforeCleanup.signal===null&&missing.result===null&&missing.residual?.length===0,'selected N missing its cache fails explicitly before protected TS entry evaluation',missing)}finally{fs.renameSync(startupSaved,startupCachePath)}
 const savedCwd=process.cwd(),savedEnv={...process.env};try{Object.assign(process.env,env);for(const k of runtime.unsetEnv||[])delete process.env[k];process.chdir(nCwd);const implicit=call('DEFAULT.N','prebuiltCommand',[args]);check('DEFAULT.N.FACTORY_RETURN',!implicit.error&&tupleValid(implicit.value),'omitted cwd/env use call-time process values',implicit.error||implicit.value);nRoute('DEFAULT.N',implicit.value,args);process.env.KOL_PREBUILT='0';const disabled=call('DEFAULT.OPTOUT','prebuiltCommand',[args]);fallback('DEFAULT.OPTOUT',disabled.value,args)}finally{process.chdir(savedCwd);for(const k of Object.keys(process.env))if(!Object.hasOwn(savedEnv,k))delete process.env[k];Object.assign(process.env,savedEnv)}
 const loader=call('LOADER.N','fixtureLoader',[entry('false'),env,nCwd]);check('LOADER.N.PUBLIC_TSX',!loader.error&&loader.value===publicLoader,'N fixtureLoader stays exact public tsx root loader',loader.error||loader.value);
 const finalEnv={...env,NODE_OPTIONS:[env.NODE_OPTIONS||'','--import='+loader.value].filter(Boolean).join(' ')};fallback('LOADER.FINAL_ENV',factory('LOADER.FINAL_ENV',args,nCwd,finalEnv),args);
 const direct=await run('DIRECT_N.IPC',[runtime.node,['--import',publicLoader,...args]],nCwd,env,true);check('DIRECT_N.IPC_UNMIGRATED',direct.rawBeforeCleanup?.status===0&&direct.result?.pid===direct.rootPid&&direct.messages.length===1&&direct.messages[0].pid===direct.rootPid,'direct Node+public loader IPC still executes actual entry in direct PID and emits real message',direct);
 const ownLoader=call('LOADER.OWNER','fixtureLoader',[entry('false'),env,owner('false')]);check('LOADER.OWNER.CACHED',!ownLoader.error&&typeof ownLoader.value==='string'&&ownLoader.value!==publicLoader,'original qualified owner retains own cached hook',ownLoader.error||ownLoader.value);
 const host=path.join(root,'src/worker-host.mjs');const workerEnv={...env,PRODUCER_ENTRY:entry('false')};
 const workerR=await run('WORKER.R',[runtime.node,[host,publicLoader]],owner('false'),workerEnv);
 if(workerR.rawBeforeCleanup?.status!==0||!workerR.worker||workerR.worker.threadId<=0||workerR.worker.isMainThread!==false||workerR.worker.pid!==workerR.rootPid||workerR.worker.entryURL!==pathToFileURL(entry('false')).href)throw new Error('public worker thread/address wiring qualification invalid');
 // The library-worker loader does not prove owner-config selection. The pure setter
 // fixture requires1 under explicit false; public owner CLI with identical [] args
 // supplies the configuration oracle without deriving expected from candidate output.
 const workerConfigR=await run('WORKER.OWNER_CLI_R',R([entry('false')]),owner('false'),workerEnv);
 if(workerConfigR.rawBeforeCleanup?.status!==0||!workerConfigR.result||workerConfigR.result.count!==1||workerConfigR.result.isMainThread!==true||!same(workerConfigR.result.args,[])||workerConfigR.result.entryURL!==pathToFileURL(entry('false')).href)throw new Error('public owner CLI configuration oracle qualification invalid');
 const workerC=await run('WORKER.C',[runtime.node,[host,ownLoader.value]],owner('false'),workerEnv);
 check('OWNER.WORKER',workerC.rawBeforeCleanup?.status===0&&workerC.worker?.threadId>0&&workerC.worker?.isMainThread===false&&workerC.worker?.pid===workerC.rootPid&&workerC.worker?.count===1&&same(visible(workerC.worker),visible(workerConfigR.result)),'real owner worker retains explicit false setter1 and original TS address/args/env; semantic oracle=qualified public owner CLI same args[]',{publicWorkerWiring:workerR,configurationOracle:workerConfigR,candidate:workerC});
 for(const [id,patch] of [['OPTOUT',{KOL_PREBUILT:'0'}],['TSX_EMPTY',{TSX_TSCONFIG_PATH:''}],['TSX_EXPLICIT',{TSX_TSCONFIG_PATH:path.join(owner('false'),'tsconfig.json')}],['EXISTING_TSX',{NODE_OPTIONS:'--import='+publicLoader}],['NO_STRIP_ENV',{NODE_OPTIONS:'--no-experimental-strip-types'}]])fallback('F.'+id,factory('F.'+id,args,nCwd,{...env,...patch}),args);
 const flagged=['--tsconfig',path.join(owner('false'),'tsconfig.json'),...args];fallback('F.CLI_CONFIG',factory('F.CLI_CONFIG',flagged,nCwd),flagged);
 const cwdConfig=path.join(nCwd,'tsconfig.json'),ancestorConfig=path.join(path.dirname(nCwd),'tsconfig.json');
 for(const [id,file]of[['CWD_CONFIG',cwdConfig],['ANCESTOR_CONFIG',ancestorConfig]]){fs.writeFileSync(file,JSON.stringify({compilerOptions:{useDefineForClassFields:false}}));const t=factory('F.'+id,args,nCwd);fallback('F.'+id,t,args);await semantic('F.'+id,'false',t);fs.unlinkSync(file);absence(nCwd)}
 const dangling=path.join(nCwd,'tsconfig.json');fs.symlinkSync(path.join(nCwd,'absent-target.json'),dangling);fallback('F.CONFIG_SYMLINK',factory('F.CONFIG_SYMLINK',args,nCwd),args);fs.unlinkSync(dangling);
 fallback('F.UNKNOWN_CWD',factory('F.UNKNOWN_CWD',args,path.join(fixture,'absent-cwd')),args);
 const denied=path.join(fixture,'permission-parent'),deniedCwd=path.join(denied,'leaf');fs.mkdirSync(deniedCwd,{recursive:true});fs.chmodSync(denied,0);try{let code;try{fs.lstatSync(path.join(deniedCwd,'tsconfig.json'))}catch(e){code=e.code}report.permissionProof={cwd:deniedCwd,probe:path.join(deniedCwd,'tsconfig.json'),actualError:code};if(code!=='EACCES')throw new Error('permission fixture INVALID: expected actual EACCES, got '+code);fallback('F.UNREADABLE',factory('F.UNREADABLE',args,deniedCwd),args)}finally{fs.chmodSync(denied,0o700)}
 const configFile=path.join(owner('false'),'tsconfig.json'),originalConfig=fs.readFileSync(configFile,'utf8');fs.writeFileSync(path.join(owner('false'),'base.json'),'{"compilerOptions":{"target":"ES2022"}}');
 for(const [id,patch]of[['EXTENDS',{extends:'./base.json'}],['FILES',{files:['scripts/entry.ts']}],['INCLUDE',{include:['scripts/entry.ts']}],['EXCLUDE',{exclude:['scripts/tail.ts']}],['REFERENCES',{references:[{path:'./subproject'}]}]]){fs.writeFileSync(configFile,JSON.stringify({...JSON.parse(originalConfig),...patch}));fallback('F.OWNER_'+id,factory('F.OWNER_'+id,args,nCwd),args);fs.writeFileSync(configFile,originalConfig)}
 const cache=path.join(owner('false'),'.check-cache/prebuilt'),savedCache=cache+'-saved';fs.renameSync(cache,savedCache);try{fallback('F.CACHE_ABSENT',factory('F.CACHE_ABSENT',args,nCwd),args)}finally{fs.renameSync(savedCache,cache)}
 const sourceV2=fs.readFileSync(path.join(root,'inputs/entry-v2.ts.txt'),'utf8');fs.writeFileSync(entry('false'),sourceV2);fallback('SOURCE.STALE',factory('SOURCE.STALE',args,nCwd),args);const one=call('ONE.UPDATE','prebuildOne',[entry('false'),sourceV2]);check('ONE.VOID',!one.error&&one.value===undefined,'successful prebuildOne returns void',one.error||one.value);check('ONE.TWO_NEW_PAYLOADS',K('false').length===8,'two new profile payloads retained alongside six old/current payloads before tree cleanup',K('false'));const updated=factory('ONE.N',args,nCwd);nRoute('ONE.N',updated,args);await semantic('ONE.N','false',updated,nCwd,'entry-v2');const updatedOwner=factory('ONE.OWNER',args,owner('false'));await semantic('ONE.OWNER','false',updatedOwner,owner('false'),'entry-v2');tree('ONE.CLEAN','false',{wrote:0,kept:6,removed:2});
 fs.unlinkSync(path.join(owner('false'),'scripts/tail.ts'));tree('DELETE.TREE','false',{wrote:0,kept:4,removed:2});
 const selected=factory('INVALIDATE.SELECT',args,nCwd);nRoute('INVALIDATE.SELECT',selected,args);fs.writeFileSync(ancestorConfig,'{"compilerOptions":{}}');try{const stopped=await run('INVALIDATE.C',selected,nCwd);check('INVALIDATE.STOPS',Number.isInteger(stopped.rawBeforeCleanup?.status)&&stopped.rawBeforeCleanup.status!==0&&stopped.rawBeforeCleanup.signal===null&&stopped.stderr.includes('CHECK_PREBUILT_CONFIG_INVALIDATED')&&stopped.stderr.includes(nCwd)&&stopped.stderr.includes(ancestorConfig)&&stopped.result===null,'selected N rechecks before TS evaluation and explicitly identifies cwd/config invalidation',stopped)}finally{fs.unlinkSync(ancestorConfig)}
 const capBefore=bindings(),capSourceBefore=sources();const capPublicEnv=Object.fromEntries(['PATH','TMPDIR','KOL_PREBUILT','TSX_TSCONFIG_PATH','NODE_OPTIONS'].filter(k=>Object.hasOwn(env,k)).map(k=>[k,env[k]]));const cap=spawnSync(runtime.node,['--no-experimental-strip-types','--import',publicLoader,path.join(root,'src/capability-probe.mjs'),runtime.apiModuleURL,JSON.stringify(args),nCwd,JSON.stringify(capPublicEnv)],{encoding:'utf8',env});const capAfter=bindings(),capSourceAfter=sources();if(!same(capBefore,capAfter)||!same(capSourceBefore,capSourceAfter))throw new Error('capability target binding changed');const capLine=cap.stdout.split('\\n').find(l=>l.startsWith('@@CAP@@'));if(!capLine)throw new Error('capability probe INVALID: '+cap.stderr);const capability=JSON.parse(capLine.slice(7));check('CAPABILITY.NO_STRIP',capability.typescript===false&&same(capability.tuple,R(args)),'official Node disable-strip process reports feature=false and factory exact CLI fallback',capability);report.capability={before:capBefore,after:capAfter,sourceBefore:capSourceBefore,sourceAfter:capSourceAfter,stdout:cap.stdout,stderr:cap.stderr};
 const invalidSource=fs.readFileSync(path.join(root,'inputs/entry-invalid.ts.txt'),'utf8');fs.writeFileSync(entry('false'),invalidSource);const failedOne=call('ONE.INVALID_COMPILE','prebuildOne',[entry('false'),invalidSource]);report.invalidCompileCall=failedOne;check('ONE.INVALID_NO_PUBLISH',K('false').length===4,'invalid TypeScript cannot publish a new current payload for either format profile',K('false'));const invalidTuple=factory('ONE.INVALID_SOURCE',args,nCwd);fallback('ONE.INVALID_SOURCE',invalidTuple,args);const invalidRun=await run('ONE.INVALID_SOURCE.C',invalidTuple,nCwd);check('ONE.INVALID_NO_STALE_EXECUTION',Number.isInteger(invalidRun.rawBeforeCleanup?.status)&&invalidRun.rawBeforeCleanup.status!==0&&invalidRun.result===null,'invalid source never reports successful old cached entry-v2',invalidRun);
 report.status=report.assertions.every(a=>a.status==='PASS')?'PASS':'FAIL';report.semanticAssertions=report.assertions.length;
}catch(e){report.infrastructureError=e.message;report.status='INVALID';report.observedAssertions=report.assertions;report.assertions=[];report.semanticAssertions=0}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\\n');for(const a of report.assertions)console.log(a.status+' '+a.label);console.log(JSON.stringify({status:report.status,semanticAssertions:report.semanticAssertions,report:path.join(out,'report.json'),infrastructureError:report.infrastructureError}));process.exitCode=report.status==='PASS'?0:report.status==='INVALID'?2:1;
` },
  { name: "packet/producer/src/supply-lifecycle.mjs", sha256: "b46e6f5beb44276649807d85b1b91e74d3f1e3dad9bfd12feb9a9e364d22f368", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/src/supply-lifecycle.mjs", rootBindings: [], body: `import { bindNode22, assertBoundCarrier } from '../../binding/node-binding.mjs';
// Prepare via real public APIs, never by reconstructing C metadata.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const nodeBinding=await bindNode22(config);if(nodeBinding.status!=='VALID_TOOL_BINDING'){console.log(JSON.stringify({status:'INVALID',semanticAssertions:0,reason:nodeBinding.reason,receipt:nodeBinding.receipt}));process.exit(2);}
const old='/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts';
const spec=JSON.parse(fs.readFileSync(path.join(old,'spec.json'),'utf8'));
const owners=[path.join(old,'fixtures/owner-false'),path.join(old,'fixtures/owner-true'),path.join(old,'supplement-sync-self/fixtures/owner')];
const apiDir=path.dirname(fileURLToPath(config.apiModuleURL));
const bindingFiles=config.bindingFiles||Object.fromEntries(['prebuilt.ts','prebuilt-hook.ts','prebuilt-parent.ts','prebuilt-signals.ts'].map(n=>[n,path.join(apiDir,n)]));
const digest=p=>{try{return{state:'FILE',sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}}catch(e){if(e.code==='ENOENT')return{state:'MISSING'};throw e}};
const bind=()=>Object.fromEntries(Object.entries(bindingFiles).map(([k,p])=>[k,{path:p,...digest(p)}]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const before=bind(),api=await import(config.apiModuleURL),calls=[];
if(!same(before,bind()))throw new Error('API identity changed during import');
for(const owner of owners){const b=bind(),result=api.prebuildTree(owner),a=bind();if(!same(b,a))throw new Error('prebuild target identity changed');calls.push({owner,result,before:b,after:a})}
const req=createRequire(path.join(config.publicResolutionOwner,'package.json')),cli=req.resolve('tsx/cli'),loader=pathToFileURL(req.resolve('tsx')).href;
const entryFalse=path.join(owners[0],'scripts/entry.ts'),entryTrue=path.join(owners[1],'scripts/entry.ts'),syncEntry=path.join(owners[2],'scripts/main-alpha.ts');
const selectionEnv={...process.env,...config.baseEnv};for(const key of config.unsetEnv||['TSX_TSCONFIG_PATH','NODE_OPTIONS','KOL_PREBUILT'])delete selectionEnv[key];
const loaderBefore=bind(),selectedLoader=api.fixtureLoader(entryFalse,selectionEnv,path.join(old,'fixtures/no-config/leaf')),loaderAfter=bind();
if(!same(loaderBefore,loaderAfter))throw new Error('fixtureLoader target identity changed');
if(selectedLoader!==loader)throw new Error('V4.LOADER.N.PUBLIC_TSX named contract failure: actual fixtureLoader must return public tsx');
calls.push({name:'fixtureLoader',script:entryFalse,cwd:path.join(old,'fixtures/no-config/leaf'),value:selectedLoader,before:loaderBefore,after:loaderAfter});
const sourceHashes={};
for(const owner of owners)for(const n of fs.readdirSync(path.join(owner,'scripts')))if(n.endsWith('.ts')){const p=path.join(owner,'scripts',n);sourceHashes[p]=digest(p).sha256}
for(const p of config.cacheWitnessPayloads||[]){if(!fs.statSync(p).isFile()||!p.endsWith('.js'))throw new Error('witness must name opaque ordinary payload');fs.appendFileSync(p,'\\n'+fs.readFileSync(path.join(old,'inputs/cache-witness-prefix.mjs.txt'),'utf8'))}
const commands={};for(const[key,entry]of[['mainFalse',entryFalse],['mainTrue',entryTrue],['missingEntry',path.join(owners[0],'scripts/entry-missing.ts')]]){
 const args=[entry,...spec.args];commands[key]={R:[config.node,[cli,...args]],C:[config.node,[cli,...args]]};
 // C is a schema placeholder only; lifecycle319 overrides it after final env with actual factory output.
}
const injection=config.childSpawnFailureImportURL;
const runtime={schemaVersion:4,node:config.node,publicResolutionOwner:config.publicResolutionOwner,publicCli:cli,publicTsxHookURL:loader,hookURL:selectedLoader,compilerOptionsIdentity:'{}',baseEnv:config.baseEnv||{},unsetEnv:config.unsetEnv||['TSX_TSCONFIG_PATH','NODE_OPTIONS','KOL_PREBUILT'],commands,producerModuleURL:config.apiModuleURL,producerBindingFiles:bindingFiles,producerSourceHashes:sourceHashes,producerPayloadDirectories:owners.map(o=>path.join(o,'.check-cache/prebuilt')),childSpawnFailureImportURL:injection||null,preparationAttestation:{preparedBy:'actual public prebuildTree calls; each C tuple selected from actual public factory after final env; hookURL is actual fixtureLoader output',sourceHashes,witnessPayloads:config.cacheWitnessPayloads||[],witnessEvidenceRequired:true},outputRoot:config.lifecycleOutputRoot||path.join(root,'lifecycle-runs')};
runtime.nodeVersion=config.nodeVersion;runtime.nodePlatform=process.platform;runtime.nodeArch=process.arch;runtime.nodeBinding=nodeBinding;
runtime.bindingFiles={...bindingFiles};for(const d of runtime.producerPayloadDirectories)if(fs.existsSync(d))for(const n of fs.readdirSync(d))if(n.endsWith('.js'))runtime.bindingFiles['payload:'+path.join(d,n)]=path.join(d,n);
runtime.syncSelf={R:[config.node,[cli,syncEntry,...spec.args]],C:[config.node,[cli,syncEntry,...spec.args]]};
if(injection){const args=[entryFalse,...spec.args];runtime.childSpawnFailure={R:[config.node,['--import',injection,cli,...args]],C:[config.node,['--import',injection,cli,...args]]}}else runtime.childSpawnFailure=null;
const dest=config.lifecycleRuntimePath||path.join(root,'supplied-lifecycle-runtime.json');
fs.writeFileSync(dest,JSON.stringify(runtime,null,2)+'\\n');fs.writeFileSync(dest+'.preparation.json',JSON.stringify({before,after:bind(),calls,sourceHashes,cacheWitnessPayloads:config.cacheWitnessPayloads||[],bodyRead:false,placeholderCNotExecutionEvidence:true},null,2)+'\\n');
console.log(JSON.stringify({runtime:dest,preparedOwners:owners.length,witnessPaths:(config.cacheWitnessPayloads||[]).length,note:'execute lifecycle319 C final-env factory provider; static placeholder tuples are not target evidence'}));
` },
  { name: "packet/producer/src/worker-host.mjs", sha256: "575f1542ab12b91482c7b87d19d1fe21153639a1cf72a6f599abf12dca08e24a", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/producer/src/worker-host.mjs", rootBindings: [], body: `import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
const worker=new Worker(pathToFileURL(process.env.PRODUCER_ENTRY),{execArgv:['--import',process.argv[2]],env:process.env});
worker.on('message',value=>console.log('@@WORKER@@'+JSON.stringify(value)));
worker.on('error',error=>{console.error(error);process.exitCode=1});
worker.on('exit',code=>{if(code)process.exitCode=code});
` },
  { name: "packet/runtime.example.json", sha256: "e7ff966fc5ccd669a95cc9d3e959894b5d695770718e7478822a3f0b043c40a2", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/runtime.example.json", rootBindings: [], body: `{
  "node": "/private/tmp/kc-20261024/node-v22.22.0-darwin-arm64/bin/node",
  "publicResolutionOwner": "/private/tmp/kc-20261024/work",
  "apiModuleURL": "file:///SUPPLY/scripts/check/prebuilt.ts",
  "actualMainCommit": "SUPPLY",
  "baseEnv": {
    "PATH": "/private/tmp/kc-20261024/node-v22.22.0-darwin-arm64/bin:/usr/bin:/bin",
    "TMPDIR": "/private/tmp/kol-ci-producer-v4",
    "LANG": "C",
    "TZ": "UTC"
  },
  "unsetEnv": [
    "TSX_TSCONFIG_PATH",
    "NODE_OPTIONS",
    "KOL_PREBUILT"
  ],
  "outputRoot": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/runs",
  "bindingFiles": {
    "api": "/SUPPLY/scripts/check/prebuilt.ts",
    "hook": "/SUPPLY/scripts/check/prebuilt-hook.ts",
    "parent": "/SUPPLY/scripts/check/prebuilt-parent.ts",
    "signals": "/SUPPLY/scripts/check/prebuilt-signals.ts"
  },
  "childSpawnFailureImportURL": "file:///SUPPLY/test-owned-standard-child-spawn-injection.mjs",
  "cacheWitnessPayloads": [],
  "lifecycleOutputRoot": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/lifecycle-runs",
  "lifecycleRuntimePath": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/supplied-lifecycle-runtime.json",
  "legacyOwnerApiModuleURL": "file:///private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2/producer/legacy-public-api/scripts/check/prebuilt.ts",
  "legacyOwnerBindingFiles": {
    "prebuilt.ts": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2/producer/legacy-public-api/scripts/check/prebuilt.ts",
    "prebuilt-hook.ts": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2/producer/legacy-public-api/scripts/check/prebuilt-hook.ts",
    "tsx-cmd.ts": "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2/producer/legacy-public-api/scripts/check/tsx-cmd.ts"
  },
  "nodeVersion": "SUPPLY actual process.version",
  "nodePlatform": "SUPPLY actual process.platform",
  "nodeArch": "SUPPLY actual process.arch"
}
` },
  { name: "packet/scope-omissions.json", sha256: "f248a634b3854c544643d0eaf7b19897a942baf365b0baa586d8d05971e5cb17", source: "/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime/scope-omissions.json", rootBindings: [], body: `{
  "sourceSupersetManifestSha256": "05409c156a17e1bda0bc2cd5aa3b6a0abcb9bff56bbe6421b14a0ec1396cccb3",
  "scope": "only actual executable members plus frozen TS/JSON/input data; unused duplicate producer/lifecycle tools, provenance-only docs and superseded local manifests omitted",
  "omitted": [
    "lifecycle319/freeze-manifest.json",
    "lifecycle319/preload/freeze-manifest.json",
    "lifecycle319/sync/freeze-manifest.json",
    "producer/README.md",
    "producer/admission-log.json",
    "producer/empty-owner-oracle-clarification.json",
    "producer/freeze-manifest.json",
    "producer/inputs/4-VERIFY.md",
    "producer/inputs/ADR158-allowed-excerpt.txt",
    "producer/inputs/prior-PUBLIC-CONTRACT.md",
    "producer/inputs/production-contract-v4-supplement.json",
    "producer/inputs/production-contract-v4.json",
    "producer/inputs/public-api.d.ts",
    "producer/lifecycle319/README.md",
    "producer/lifecycle319/cases.json",
    "producer/lifecycle319/expected.json",
    "producer/lifecycle319/freeze-manifest.json",
    "producer/lifecycle319/preload/README.md",
    "producer/lifecycle319/preload/freeze-manifest.json",
    "producer/lifecycle319/preload/ordinary-preload.mjs",
    "producer/lifecycle319/preload/run.mjs",
    "producer/lifecycle319/preload/spec.json",
    "producer/lifecycle319/spec.json",
    "producer/lifecycle319/src/boundary-observer.mjs",
    "producer/lifecycle319/src/observer.mjs",
    "producer/lifecycle319/src/run.mjs",
    "producer/lifecycle319/sync/README.md",
    "producer/lifecycle319/sync/expected.json",
    "producer/lifecycle319/sync/freeze-manifest.json",
    "producer/lifecycle319/sync/run.mjs",
    "producer/runtime.example.json",
    "producer/worker-oracle-clarification.json"
  ],
  "semanticExpectedOrTSBytesChanged": false,
  "legacySourcesKept": 3,
  "originalManifestPassedClaimed": false
}
` },
  { name: "original/spec.json", sha256: "15616faf9adb0bd24dda2c6b6167ace0904f1eac8522636e0ad4a5e9db73edce", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/spec.json", rootBindings: [], body: `{
  "version": 3,
  "baseline": "5b0f10af6b86f43425181bbf25c92f81b7feea9b",
  "scope": "finite N-domain thin parent black-box compatibility only",
  "args": [
    "arg-one",
    "arg with space",
    "--literal-script-arg"
  ],
  "envToken": "contract-v3-env-token-671",
  "observerToken": "contract-v3-same-instance-positive-601",
  "cacheToken": "contract-v3-cache-consumption-5021",
  "entryFingerprint": "0520bc40de12306139243f769b4ae00cdca2609f1e45a4643603822e07b7e4b3",
  "stateFingerprint": "80860a7ffe9dbff3c23806a5d70663f6944649e76a5c9ded6dbc93609e25e338",
  "observerFingerprint": "38bfbe4bfe830bd18be2489acb1c47f5c89e6b3a4aa350992bcb1882cfe763c5",
  "boundaryFingerprint": "681c0a435ec9f73847ff726047172fce83c5ca4f1863f18cc1bd497dfd987b21",
  "readyTimeoutMs": 5000,
  "settleTimeoutMs": 5000,
  "orphanObservationMs": 600,
  "cleanupTimeoutMs": 2000,
  "quietMs": 100,
  "timingPurpose": "finite safety/liveness deadlines only; no performance threshold or conclusion",
  "oracle": "live independent public tsx/cli with same Node/input/cwd/env; relational expressions frozen before first execution; never copy output into constants",
  "compilerOptions": "independent {} identity; source below owner true/false is executed with external all-ancestor-no-config cwd",
  "notClaimed": [
    "all tsx CLI/options/watch modes",
    "production caller asTsx implementation",
    "owner bare / direct Node / IPC domains",
    "selection/fallback producer internals",
    "unknown or unreadable/configured/disabled cache selection already belongs to existing frozen producer tests",
    "performance improvement"
  ]
}
` },
  { name: "original/src/boundary-observer.mjs", sha256: "16ea6f135a334fe739920a6cd66afc629afed5f5bbd7edb2f16afc6e27b11576", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/src/boundary-observer.mjs", rootBindings: [], body: `import { appendFileSync } from 'node:fs';
import { isMainThread, threadId } from 'node:worker_threads';
const fingerprint = '681c0a435ec9f73847ff726047172fce83c5ca4f1863f18cc1bd497dfd987b21';
const log = row => appendFileSync(process.env.CONTRACT_BOUNDARY_LOG, JSON.stringify({ ...row, fingerprint, pid: process.pid, ppid: process.ppid, threadId, isMainThread }) + '\\n');
log({ kind: 'boundary-boot' });
process.on('exit', code => log({ kind: 'boundary-exit-hook', code }));
` },
  { name: "original/src/observer.mjs", sha256: "7200e9a35b89dfc43f29736e683b2538d96578addb9a01d4d527694ccea0af2f", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/src/observer.mjs", rootBindings: [], body: `import { appendFileSync } from 'node:fs';
import { isMainThread, threadId } from 'node:worker_threads';
const fingerprint = '38bfbe4bfe830bd18be2489acb1c47f5c89e6b3a4aa350992bcb1882cfe763c5';
if (isMainThread) {
  const state = await import(process.env.CONTRACT_STATE_URL);
  state.box.value = 'contract-v3-same-instance-positive-601';
  appendFileSync(process.env.CONTRACT_OBSERVER_LOG, JSON.stringify({ kind: 'observer-positive', fingerprint, stateFingerprint: state.fingerprint, token: state.box.value, pid: process.pid, threadId, isMainThread, stateURL: process.env.CONTRACT_STATE_URL }) + '\\n');
}
` },
  { name: "original/fixtures/owner-false/package.json", sha256: "89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/package.json", rootBindings: [], body: `{"type":"module","private":true}
` },
  { name: "original/fixtures/owner-false/scripts/entry.ts", sha256: "8fad32508329d70c7e47ba21b08bc022ca11e007f6f452fd47eedf6605ac5661", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/entry.ts", rootBindings: [], body: `import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { isMainThread, threadId } from 'node:worker_threads';
import { box, defaultSetterCalls } from './state.ts';

const fingerprint = '0520bc40de12306139243f769b4ae00cdca2609f1e45a4643603822e07b7e4b3';
const mode = process.env.CONTRACT_MODE || 'normal';
const common = { fingerprint, pid: process.pid, ppid: process.ppid, threadId, isMainThread };
const log = (event: Record<string, unknown>) => appendFileSync(process.env.CONTRACT_ENTRY_LOG!, JSON.stringify({ ...common, ...event }) + '\\n');
let helper: ReturnType<typeof spawn> | undefined;
process.on('exit', code => { log({ kind: 'entry-exit-hook', order: 1, code }); if (helper?.pid) { try { helper.kill('SIGKILL'); } catch {} } });
process.on('exit', code => log({ kind: 'entry-exit-hook', order: 2, code }));
const value: number = 29;
const result = { ...common, value, defaultSetterCalls, shared: box.value, args: process.argv.slice(2), cwd: process.cwd(), execPath: process.execPath, token: process.env.CONTRACT_ENV_TOKEN, entryURL: import.meta.url };
log({ kind: 'entry-eval', entryURL: import.meta.url });
console.log('@@RESULT@@' + JSON.stringify(result));

if (mode === 'early-exit') process.exit(37);
if (mode === 'throw') throw new Error('CONTRACT_V3_THROW_SENTINEL');
if (mode === 'nonzero') process.exitCode = 23;
if (mode === 'normal' || mode === 'nonzero' || mode === 'observer' || mode === 'cache') {
  // Let the normal event loop reach process exit so both ordered hooks are real.
} else {
  if (mode === 'descendant') {
    helper = spawn(process.execPath, ['-e', "require('node:fs').writeFileSync(process.env.CONTRACT_HELPER_FILE, JSON.stringify({pid:process.pid,ppid:process.ppid})+'\\\\n');setInterval(()=>{},1000)"], { env: process.env, stdio: 'ignore' });
  }
  if (mode === 'handler' || mode === 'repeat-handler') {
    // A user's explicit replacement of TERM ownership is a supported input.
    process.removeAllListeners('SIGTERM');
    let count = 0;
    process.on('SIGTERM', () => { count++; log({ kind: 'user-signal', signal: 'SIGTERM', count }); if (mode === 'handler' || count === 2) process.exit(mode === 'handler' ? 41 : 42); });
  }
  const ready = { ...common, token: process.env.CONTRACT_READY_TOKEN, mode, entryURL: import.meta.url, helperPid: helper?.pid ?? null };
  const publishReady = () => { writeFileSync(process.env.CONTRACT_READY_FILE!, JSON.stringify(ready) + '\\n'); console.log('@@ENTRY_READY@@' + JSON.stringify(ready)); };
  if (mode === 'descendant') {
    const readyTimer = setInterval(() => { if (existsSync(process.env.CONTRACT_HELPER_FILE!)) { clearInterval(readyTimer); publishReady(); } }, 2);
  } else publishReady();
  if (mode === 'self-term') {
    const goTimer = setInterval(() => { if (existsSync(process.env.CONTRACT_GO_FILE!)) { const go = JSON.parse(readFileSync(process.env.CONTRACT_GO_FILE!, 'utf8')); if (go.token !== process.env.CONTRACT_READY_TOKEN) throw new Error('bad self-signal authorization'); clearInterval(goTimer); process.kill(process.pid, 'SIGTERM'); } }, 2);
  } else if (mode === 'blocked') {
    setImmediate(() => spawnSync(process.execPath, ['-e', "require('node:fs').writeFileSync(process.env.CONTRACT_BLOCK_FILE, JSON.stringify({pid:process.pid,ppid:process.ppid})+'\\\\n');setTimeout(()=>{},3000)"], { env: process.env, stdio: 'ignore' }));
  } else setInterval(() => {}, 1000);
}
` },
  { name: "original/fixtures/owner-false/scripts/state.ts", sha256: "4fb0716aab273efe16486f9b2e5435010b9a3b210dddf621f00a429aac116c6f", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/scripts/state.ts", rootBindings: [], body: `import { appendFileSync } from 'node:fs';
import { isMainThread, threadId } from 'node:worker_threads';
export const fingerprint = '80860a7ffe9dbff3c23806a5d70663f6944649e76a5c9ded6dbc93609e25e338';
let calls = 0;
class Base {}
Object.defineProperty(Base.prototype, 'value', { set(_value) { calls++; }, configurable: true });
class Derived extends Base { value = 701; }
new Derived();
export const defaultSetterCalls = calls;
export const box = { value: 'unobserved' };
if (process.env.CONTRACT_STATE_LOG) appendFileSync(process.env.CONTRACT_STATE_LOG, JSON.stringify({ kind: 'state-eval', fingerprint, pid: process.pid, threadId, isMainThread, entryURL: import.meta.url }) + '\\n');
` },
  { name: "original/fixtures/owner-false/tsconfig.json", sha256: "b9516496d03bb7ba72eeab4efff569049940478e2a39fbf8d51175ec57d00ac5", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-false/tsconfig.json", rootBindings: [], body: `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": false
  }
}
` },
  { name: "original/fixtures/owner-true/package.json", sha256: "89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/package.json", rootBindings: [], body: `{"type":"module","private":true}
` },
  { name: "original/fixtures/owner-true/scripts/entry.ts", sha256: "8fad32508329d70c7e47ba21b08bc022ca11e007f6f452fd47eedf6605ac5661", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/scripts/entry.ts", rootBindings: [], body: `import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { isMainThread, threadId } from 'node:worker_threads';
import { box, defaultSetterCalls } from './state.ts';

const fingerprint = '0520bc40de12306139243f769b4ae00cdca2609f1e45a4643603822e07b7e4b3';
const mode = process.env.CONTRACT_MODE || 'normal';
const common = { fingerprint, pid: process.pid, ppid: process.ppid, threadId, isMainThread };
const log = (event: Record<string, unknown>) => appendFileSync(process.env.CONTRACT_ENTRY_LOG!, JSON.stringify({ ...common, ...event }) + '\\n');
let helper: ReturnType<typeof spawn> | undefined;
process.on('exit', code => { log({ kind: 'entry-exit-hook', order: 1, code }); if (helper?.pid) { try { helper.kill('SIGKILL'); } catch {} } });
process.on('exit', code => log({ kind: 'entry-exit-hook', order: 2, code }));
const value: number = 29;
const result = { ...common, value, defaultSetterCalls, shared: box.value, args: process.argv.slice(2), cwd: process.cwd(), execPath: process.execPath, token: process.env.CONTRACT_ENV_TOKEN, entryURL: import.meta.url };
log({ kind: 'entry-eval', entryURL: import.meta.url });
console.log('@@RESULT@@' + JSON.stringify(result));

if (mode === 'early-exit') process.exit(37);
if (mode === 'throw') throw new Error('CONTRACT_V3_THROW_SENTINEL');
if (mode === 'nonzero') process.exitCode = 23;
if (mode === 'normal' || mode === 'nonzero' || mode === 'observer' || mode === 'cache') {
  // Let the normal event loop reach process exit so both ordered hooks are real.
} else {
  if (mode === 'descendant') {
    helper = spawn(process.execPath, ['-e', "require('node:fs').writeFileSync(process.env.CONTRACT_HELPER_FILE, JSON.stringify({pid:process.pid,ppid:process.ppid})+'\\\\n');setInterval(()=>{},1000)"], { env: process.env, stdio: 'ignore' });
  }
  if (mode === 'handler' || mode === 'repeat-handler') {
    // A user's explicit replacement of TERM ownership is a supported input.
    process.removeAllListeners('SIGTERM');
    let count = 0;
    process.on('SIGTERM', () => { count++; log({ kind: 'user-signal', signal: 'SIGTERM', count }); if (mode === 'handler' || count === 2) process.exit(mode === 'handler' ? 41 : 42); });
  }
  const ready = { ...common, token: process.env.CONTRACT_READY_TOKEN, mode, entryURL: import.meta.url, helperPid: helper?.pid ?? null };
  const publishReady = () => { writeFileSync(process.env.CONTRACT_READY_FILE!, JSON.stringify(ready) + '\\n'); console.log('@@ENTRY_READY@@' + JSON.stringify(ready)); };
  if (mode === 'descendant') {
    const readyTimer = setInterval(() => { if (existsSync(process.env.CONTRACT_HELPER_FILE!)) { clearInterval(readyTimer); publishReady(); } }, 2);
  } else publishReady();
  if (mode === 'self-term') {
    const goTimer = setInterval(() => { if (existsSync(process.env.CONTRACT_GO_FILE!)) { const go = JSON.parse(readFileSync(process.env.CONTRACT_GO_FILE!, 'utf8')); if (go.token !== process.env.CONTRACT_READY_TOKEN) throw new Error('bad self-signal authorization'); clearInterval(goTimer); process.kill(process.pid, 'SIGTERM'); } }, 2);
  } else if (mode === 'blocked') {
    setImmediate(() => spawnSync(process.execPath, ['-e', "require('node:fs').writeFileSync(process.env.CONTRACT_BLOCK_FILE, JSON.stringify({pid:process.pid,ppid:process.ppid})+'\\\\n');setTimeout(()=>{},3000)"], { env: process.env, stdio: 'ignore' }));
  } else setInterval(() => {}, 1000);
}
` },
  { name: "original/fixtures/owner-true/scripts/state.ts", sha256: "4fb0716aab273efe16486f9b2e5435010b9a3b210dddf621f00a429aac116c6f", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/scripts/state.ts", rootBindings: [], body: `import { appendFileSync } from 'node:fs';
import { isMainThread, threadId } from 'node:worker_threads';
export const fingerprint = '80860a7ffe9dbff3c23806a5d70663f6944649e76a5c9ded6dbc93609e25e338';
let calls = 0;
class Base {}
Object.defineProperty(Base.prototype, 'value', { set(_value) { calls++; }, configurable: true });
class Derived extends Base { value = 701; }
new Derived();
export const defaultSetterCalls = calls;
export const box = { value: 'unobserved' };
if (process.env.CONTRACT_STATE_LOG) appendFileSync(process.env.CONTRACT_STATE_LOG, JSON.stringify({ kind: 'state-eval', fingerprint, pid: process.pid, threadId, isMainThread, entryURL: import.meta.url }) + '\\n');
` },
  { name: "original/fixtures/owner-true/tsconfig.json", sha256: "0a2db56b5ac91fdf7fec01a551e8141d462928593d52f0f897fa706db2e94c20", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/fixtures/owner-true/tsconfig.json", rootBindings: [], body: `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true
  }
}
` },
  { name: "original/supplement-sync-self/fixtures/owner/package.json", sha256: "89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/package.json", rootBindings: [], body: `{"type":"module","private":true}
` },
  { name: "original/supplement-sync-self/fixtures/owner/scripts/main-alpha.ts", sha256: "dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/main-alpha.ts", rootBindings: [], body: `const contractSyncSourceFingerprint='750b927dbce742e64e7ffc4c798cd54a1366e2ab3d73a7704a5bfd5598913731';
import {count,version,box} from './state-beta.ts';
import {appendFileSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {isMainThread,threadId} from 'node:worker_threads';
const fingerprint='b5ab0823b19a40c1c2ff3c6a55b29d47f8acc9f2b2e428c93602140138f104f2';
const unit="main-alpha";
const ownVersion="main-v1";
if(process.env.PROFILE_EVAL_LOG) appendFileSync(process.env.PROFILE_EVAL_LOG,JSON.stringify({kind:'eval',unit,version:ownVersion,fingerprint,pid:process.pid,threadId,isMainThread})+'\\n');
function report(count,version,shared){console.log('@@RESULT@@'+JSON.stringify({unit,count,version,shared,fingerprint,pid:process.pid,threadId,isMainThread,execPath:process.execPath,cwd:process.cwd(),env:process.env.CI_PROFILE_TOKEN,args:process.argv.slice(2),entryURL:import.meta.url}));if(process.env.PROFILE_EXIT==='term'){
const ready={kind:'sync-entry-ready',token:process.env.CONTRACT_SYNC_TOKEN,fingerprint,sourceFingerprint:contractSyncSourceFingerprint,pid:process.pid,ppid:process.ppid,threadId,isMainThread,entryURL:import.meta.url};
writeFileSync(process.env.CONTRACT_SYNC_READY,JSON.stringify(ready)+'\\n');
const gateCell=new Int32Array(new SharedArrayBuffer(4));const gateStart=Date.now();
while(!existsSync(process.env.CONTRACT_SYNC_GO)){if(Date.now()-gateStart>5000)throw new Error('SYNC_GO_TIMEOUT');Atomics.wait(gateCell,0,0,1);}
const go=JSON.parse(readFileSync(process.env.CONTRACT_SYNC_GO,'utf8'));if(go.token!==process.env.CONTRACT_SYNC_TOKEN)throw new Error('SYNC_GO_TOKEN_INVALID');
process.kill(process.pid,'SIGTERM');
}else process.exitCode=Number(process.env.PROFILE_EXIT||'0');}
report(count,version,box.value);
` },
  { name: "original/supplement-sync-self/fixtures/owner/scripts/state-beta.ts", sha256: "aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/state-beta.ts", rootBindings: [], body: `import {appendFileSync} from 'node:fs';
import {isMainThread,threadId} from 'node:worker_threads';
const fingerprint='6eb516a123be2949bbf007fd3975d0dedbbe98e04116bb24001c9c7484651c11';
const unit="state-beta";
const ownVersion="state-v1";
if(process.env.PROFILE_EVAL_LOG) appendFileSync(process.env.PROFILE_EVAL_LOG,JSON.stringify({kind:'eval',unit,version:ownVersion,fingerprint,pid:process.pid,threadId,isMainThread})+'\\n');
function report(count,version,shared){console.log('@@RESULT@@'+JSON.stringify({unit,count,version,shared,fingerprint,pid:process.pid,threadId,isMainThread,execPath:process.execPath,cwd:process.cwd(),env:process.env.CI_PROFILE_TOKEN,args:process.argv.slice(2),entryURL:import.meta.url}));if(process.env.PROFILE_EXIT==='term')process.kill(process.pid,'SIGTERM');else process.exitCode=Number(process.env.PROFILE_EXIT||'0');}
let calls=0;
class Base {}
Object.defineProperty(Base.prototype,'value',{set(_v){calls+=1;},configurable:true});
class Derived extends Base {value=701;}
new Derived();
export const count=calls;
export const version="state-v1";
export const box={value:'unset'};
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1])report(count,version,box.value);
` },
  { name: "original/supplement-sync-self/fixtures/owner/tsconfig.json", sha256: "6a8c5b15a1c6343da145ac63946fc85dd805c80e72b3575d58fbc740eb14edac", source: "/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/tsconfig.json", rootBindings: [], body: `{"compilerOptions":{"target":"ES2022","useDefineForClassFields":false}}
` },
]

// New standalone sync43 closure; old76 members/portable scopes above unchanged.
export const SYNC43_FREEZE_SHA256 = "3547b3c29ea76c03a4030101ab318d6fbdd7818e0cbf4769ca61a8471bd2bbff"
export const SYNC43_NORMAL_LABELS = {
  "linux": [
    "N.SYNC_SELF_TERM.PUBLIC_REFERENCE_QUALIFIED",
    "N.SYNC_SELF_TERM.REFERENCE_CONTINUITY",
    "N.SYNC_SELF_TERM.FACTORY_BINDING",
    "N.SYNC_SELF_TERM.ENTRY_READY",
    "N.SYNC_SELF_TERM.RAW",
    "N.SYNC_SELF_TERM.HOOKS",
    "N.SYNC_SELF_TERM.RESULT",
    "N.SYNC_SELF_TERM.STDERR",
    "N.SYNC_SELF_TERM.NO_ORPHANS"
  ],
  "darwin": [
    "N.SYNC_SELF_TERM.PUBLIC_REFERENCE_QUALIFIED",
    "N.SYNC_SELF_TERM.REFERENCE_CONTINUITY",
    "N.SYNC_SELF_TERM.FACTORY_BINDING",
    "N.SYNC_SELF_TERM.ENTRY_READY",
    "N.SYNC_SELF_TERM.RAW",
    "N.SYNC_SELF_TERM.HOOKS",
    "N.SYNC_SELF_TERM.KNOWN_CLI_ZERO",
    "N.SYNC_SELF_TERM.RESULT",
    "N.SYNC_SELF_TERM.STDERR",
    "N.SYNC_SELF_TERM.NO_ORPHANS"
  ]
} as const
export const SYNC43_FILES: readonly FrozenContractFile[] = [
  { name: "packet/sync43/CI-INTEGRATION.md", sha256: "b8ae929db95877e1d72970fa406b0fd53de7b683bc6d1bdd757e5a23e7775344", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/CI-INTEGRATION.md", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/CI-INTEGRATION.md"
    body: [
      "# Normal CI entry integration and public evidence retention — v4.3.1\n",
      "\n",
      "Only the sync self TERM slot changes. Original v4.3, v4.2 and all red originals\n",
      "remain unchanged. This package is not automatically integrated or authorized to\n",
      "run; root waits for static admission before allocating R/C windows. No .github\n",
      "change, extra outer tool process, C patch or signal-group expansion is proposed.\n",
      "\n",
      "1. Package the whole frozen-v4.3.1 closure and unchanged input bytes. Use the\n",
      "   frozen prepare-fixture helper or exact original owner/scripts paths; explicitly\n",
      "   create no-config/leaf. Map only runtime paths and retain input hashes. Supply\n",
      "   runtime.entry/cwd from the original mapped sync expected and the existing\n",
      "   opaque producer binding fields. A new source version needs a new runtime bind.\n",
      "2. The adapter must explicitly remove NODE_OPTIONS from the tool's invoking env\n",
      "   before starting exact Node, following its controlled-env unset path. The tool\n",
      "   refuses even an own empty NODE_OPTIONS property in its process environment;\n",
      "   runtime.unsetEnv cannot retroactively qualify an uncleared tool invocation.\n",
      "   The effective child base env must also have NODE_OPTIONS absent before the\n",
      "   frozen tool appends only its fixed boundary observer import. It never silently\n",
      "   clears inherited options or echoes their contents. Preserve the existing N\n",
      "   controls for TSX_TSCONFIG_PATH/KOL_PREBUILT and native TypeScript.\n",
      "3. Invoke exact Node src/run.mjs runtime.json in the existing sync/run slot.\n",
      "   If the existing adapter already declares an explicit argv --import of the\n",
      "   independently resolved public tsx root to load its typed public provider,\n",
      "   preserve [exactNode,--import,publicRootURL,runner,config] and the existing\n",
      "   runtime.publicTsxHookURL binding. This declared public tool flag is permitted;\n",
      "   it is not an inherited NODE_OPTIONS value or a replacement for public CLI R. The\n",
      "   same outer process performs R-only control+5 selfTERM+control first. Only\n",
      "   QUALIFIED opens the authorized pair. referenceOnly:true stops after public R;\n",
      "   its result is REFERENCE_QUALIFIED / candidateComparison NOT_RUN, not C PASS.\n",
      "4. Before summary parsing, throwing or finally cleanup, call\n",
      "   forwardEvidence(child.stdout, line => console.log(line)). It first forwards\n",
      "   every raw marker line unchanged, including partial red evidence, then fully\n",
      "   decodes/checks chunk indexes, counts, canonical bytes and SHA. It requires the\n",
      "   necessary package closure: all seven R records matching the complete\n",
      "   qualification packet, plus its matching report/summary; a pair additionally\n",
      "   requires R-before/C/R-after records, pair packet and matching judgment report.\n",
      "   Missing entire records/qualification/report/pair packets is a guard rejection,\n",
      "   even if all remaining chunks parse or the final summary says PASS. Do not catch\n",
      "   that rejection and continue as a passed guard.\n",
      "5. parseSummary(child.stdout) independently performs the same closure validation;\n",
      "   it cannot rescue partial stdout after a failed forward. The summary's report\n",
      "   path is bound to the packet output root. validateEvidenceClosure also returns\n",
      "   the decoded report and its SHA: use that validated report, or require the\n",
      "   local report JSON to equal it before accepting local assertions. A different\n",
      "   local report cannot replace missing public evidence. The adapter must\n",
      "   retain both nonzero tool status and guard rejection, while the already\n",
      "   forwarded partial evidence remains visible for review. An early INVALID with\n",
      "   no complete qualification packet is diagnostic-only, not a complete receipt.\n",
      "6. The stdout protocol retains complete public behavioral records, raw\n",
      "   stdout/stderr base64, boundary tape and ordered events, process/topology/input\n",
      "   identity, native Node binding receipt, controlled fixture/observer inputs and\n",
      "   actual inherited/effective environment hashes. The qualification packet's\n",
      "   retention field explicitly limits this claim. decodeEvidence(jobLog) can\n",
      "   recover complete packets from timestamp-prefixed CI logs; it does not by\n",
      "   itself prove the required closure. For admission use validateEvidenceClosure\n",
      "   or the forward/summary helpers on one tool invocation's stdout.\n",
      "7. Full effective-env.private.json bytes are a mode0600 local diagnostic only.\n",
      "   The existing CI adapter may remove these files in finally. No available CI\n",
      "   artifact upload or persistent full private environment is claimed or required\n",
      "   by this finite public-behavior/hash qualification. Do not encode inherited\n",
      "   secrets into stdout, add workflow upload steps or describe these files as\n",
      "   retained CI evidence. If a downstream acceptance requires full inherited env\n",
      "   bytes, this receipt has no qualification for that claim and must be marked\n",
      "   unknown/invalid. It cannot be repaired by pretending hashes are those bytes.\n",
      "8. Immediately before C, canStartCandidate requires the complete current\n",
      "   qualification identity, actual R origin/identity, sourceBefore equal to the\n",
      "   qualified source hashes, healthy wiring and the qualified raw/hooks/result/\n",
      "   stderr vector. A coherent before/after source drift cannot pass by keeping\n",
      "   raw/hooks unchanged. The gate runs before provider import or factory/start.\n",
      "   Final continuity uses the same predicate for both R samples. The real final\n",
      "   args/cwd/env factory call and strict RAW/HOOKS/RESULT/STDERR/NO_ORPHANS remain.\n",
      "9. Report qualification and semantic mismatch separately. Missing/incomplete\n",
      "   qualification never becomes PASS/SKIP and never rewrites existing RAW/HOOKS\n",
      "   red originals. Pair labels remain Linux9 / Darwin10; reference labels remain\n",
      "   Linux11 / Darwin12. This is the v4.3.1 source identity, not old164/319 identity.\n",
      "\n",
      "No R, C or Linux execution occurs while authoring this revision. The single\n",
      "CI2003 sample remains unqualified and its actual R/C RAW/HOOKS mismatches remain\n",
      "failures. The old Darwin raw0 assertion remains mandatory.\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/LABEL-MAPPING.json", sha256: "7d0b9f2e76e63958af92f5cc5ec0d84bb6e3befab4755053209dc4be21b61ec0", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/LABEL-MAPPING.json", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/LABEL-MAPPING.json"
    body: [
      "{\n",
      "  \"scope\": \"new v4.3.1 sync narrow group only; unchanged v4.3 semantic label/count mapping; no old164/319 identity claim\",\n",
      "  \"unchangedSemanticLabels\": [\n",
      "    \"ENTRY_READY\",\n",
      "    \"RAW\",\n",
      "    \"HOOKS\",\n",
      "    \"RESULT\",\n",
      "    \"STDERR\",\n",
      "    \"NO_ORPHANS\"\n",
      "  ],\n",
      "  \"oldKnownCliZero\": {\n",
      "    \"darwin\": {\n",
      "      \"label\": \"N.SYNC_SELF_TERM.KNOWN_CLI_ZERO\",\n",
      "      \"rule\": \"R and C literal raw0/null/null required, plus reference-only KNOWN_CLI_ZERO.REFERENCE\"\n",
      "    },\n",
      "    \"linux\": {\n",
      "      \"label\": \"N.SYNC_SELF_TERM.PUBLIC_REFERENCE_QUALIFIED\",\n",
      "      \"rule\": \"new explicit platform qualification gate replaces the invalid global Darwin0 premise; no copied Linux numerical expected; RAW/HOOKS strict equality unchanged\",\n",
      "      \"oldReportStatus\": \"old v4.2 KNOWN_CLI_ZERO remains FAIL in its original record; never rewritten\"\n",
      "    }\n",
      "  },\n",
      "  \"newLabels\": [\n",
      "    \"REFERENCE_IDENTITY\",\n",
      "    \"REFERENCE_SEQUENCE\",\n",
      "    \"REFERENCE_WIRING.R.CONTROL_BEFORE\",\n",
      "    \"REFERENCE_WIRING.R.SYNC.1\",\n",
      "    \"REFERENCE_WIRING.R.SYNC.2\",\n",
      "    \"REFERENCE_WIRING.R.SYNC.3\",\n",
      "    \"REFERENCE_WIRING.R.SYNC.4\",\n",
      "    \"REFERENCE_WIRING.R.SYNC.5\",\n",
      "    \"REFERENCE_WIRING.R.CONTROL_AFTER\",\n",
      "    \"REFERENCE_CONTROL\",\n",
      "    \"REFERENCE_STABLE\",\n",
      "    \"PUBLIC_REFERENCE_QUALIFIED\",\n",
      "    \"REFERENCE_CONTINUITY\",\n",
      "    \"FACTORY_BINDING\"\n",
      "  ],\n",
      "  \"sameSlot\": \"one normal sync/run.mjs outer tool process; complete evidence closure and pre-C continuity are in-process guards; no added helper process\",\n",
      "  \"strictness\": \"no Linux skip; no numeric status/signal conversion; no lost hook assertions; no fixed expected derived from C; new source/label identity must be disclosed\"\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/README.md", sha256: "59fe65a71782d8164a83ad27a9c11a7c0aac56f40ddba2313490d6793f2037d2", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/README.md", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/README.md"
    body: [
      "# Frozen v4.3.1: synchronous self TERM qualification\n",
      "\n",
      "Read `../review/PROPOSAL.md`, `../review-v4.3.1/AMENDMENT.md` and `contract.json` first. This is a new narrow supplement;\n",
      "all original v4.2 members and red reports remain unchanged. Darwin's original zero\n",
      "requirement remains an explicit platform assertion. Linux has no copied numerical\n",
      "expected: raw/hooks remain strict live public R/C equality.\n",
      "\n",
      "`src/run.mjs` occupies the existing sync tool slot in the same outer process. It\n",
      "imports the R-only qualification function, then starts R-before/C/R-after only\n",
      "after qualification. `src/judge.mjs` is independent judgment logic. Standalone\n",
      "`src/qualify.mjs` rejects C inputs; the shared finite sync measurement has no\n",
      "production import. The combined runner imports only the existing opaque actual\n",
      "public prebuiltCommand API after qualification and retains final env/tuple/source\n",
      "receipts. `src/verify-pair.mjs` is optional offline checking, not another CI tool\n",
      "process. Bare summaries or synthesized candidate tuples are insufficient.\n",
      "\n",
      "Qualification sequence is control, five original synchronous self TERM fresh R\n",
      "processes, control. No repetitions have run at freeze. A future root execution\n",
      "window must state exact Node/platform/arch and output root. Run R-only first;\n",
      "only QUALIFIED allows a new target comparison window. Existing mismatches may be\n",
      "classified offline even with INCOMPLETE reference qualification.\n",
      "\n",
      "Raw originals, stdout/stderr, boundary log, process snapshots, final env, no-config\n",
      "proof and exact input/runtime/public-source fingerprints are required. Five trials\n",
      "are finite stability evidence, not universal scheduling proof. No retry/pick/skip.\n",
      "\n",
      "Tool checks can run on Darwin and are recorded as tool-only checks. They cannot\n",
      "qualify Linux or execute product C. The supplied CI2003 observation remains one\n",
      "sample, with RAW and HOOKS semantic failures retained independently of the Linux\n",
      "qualification gap.\n",
      "\n",
      "This revision fixes only evidence-package closure, complete pre-C reference\n",
      "continuity and inherited NODE_OPTIONS disclosure. Both forwardEvidence and\n",
      "parseSummary require complete decoded/checksummed records and necessary packets.\n",
      "Incomplete originals are still forwarded before rejection. The adapter must\n",
      "explicitly unset NODE_OPTIONS before the tool starts; the tool never clears it\n",
      "silently. Private environment files are local diagnostics, not a CI persistence\n",
      "requirement or a claimed CI artifact. All original v4.3 members stay unchanged.\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/binding/native-probe.mjs", sha256: "88bed797099479800fb35ab7a84a703cb24ea366bd1d9794dbb5938e7ae23388", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/binding/native-probe.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/binding/native-probe.mjs"
    body: [
      "import * as Module from 'node:module';\n",
      "import { pathToFileURL } from 'node:url';\n",
      "try {\n",
      "  const native = await import(pathToFileURL(process.argv[2]).href);\n",
      "  if (typeof Module.registerHooks !== 'function') throw new Error('registerHooks unavailable');\n",
      "  const hook = Module.registerHooks({ resolve(specifier, context, next) {\n",
      "    if (specifier === 'ci-node22-binding:probe') return { url: 'data:text/javascript,export%20const%20hookValue%3D912%3B', shortCircuit: true };\n",
      "    return next(specifier, context);\n",
      "  } });\n",
      "  const hooked = await import('ci-node22-binding:probe');\n",
      "  hook.deregister();\n",
      "  console.log('@@NODE_BINDING@@' + JSON.stringify({ execPath: process.execPath, version: process.version, platform: process.platform, arch: process.arch, typescript: process.features.typescript, nativeValue: native.nativeValue, hookValue: hooked.hookValue }));\n",
      "} catch (error) {\n",
      "  console.log('@@NODE_BINDING@@' + JSON.stringify({ error: error.message }));\n",
      "  process.exitCode = 2;\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/binding/native-probe.mts", sha256: "61fa9de92eac477f270efafdb41005886619b188d6d8f96028c99899c27c456d", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/binding/native-probe.mts", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/binding/native-probe.mts"
    body: [
      "export const nativeValue: number = 911;\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/binding/node-binding.mjs", sha256: "cad4562e2a7116de484fd93b56a43cc9dbd80edc37546c06b9b78c7a4dd0da2d", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/binding/node-binding.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/binding/node-binding.mjs"
    body: [
      "import fs from 'node:fs';\n",
      "import path from 'node:path';\n",
      "import os from 'node:os';\n",
      "import crypto from 'node:crypto';\n",
      "import * as Module from 'node:module';\n",
      "import { fileURLToPath, pathToFileURL } from 'node:url';\n",
      "import { spawnSync } from 'node:child_process';\n",
      "const here=path.dirname(fileURLToPath(import.meta.url));\n",
      "const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');\n",
      "const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);\n",
      "export function assertBoundCarrier(tuple,runtime){\n",
      "  if(!Array.isArray(tuple)||tuple[0]!==runtime.node||runtime.node!==process.execPath)throw new Error('INVALID Node carrier differs from bound tool/runtime node; no cross-version pairing');\n",
      "}\n",
      "export async function bindNode22(runtime){\n",
      "  const output=path.join(runtime.nodeBindingOutputRoot||runtime.outputRoot||os.tmpdir(),'node-binding-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex'));\n",
      "  fs.mkdirSync(output,{recursive:true});\n",
      "  const receipt={status:'INVALID',semanticAssertions:0,receipt:path.join(output,'binding.json'),supplied:{node:runtime.node,nodeVersion:runtime.nodeVersion},tool:{node:process.execPath,nodeVersion:process.version,platform:process.platform,arch:process.arch,typescript:process.features.typescript,registerHooks:typeof Module.registerHooks},reason:null};\n",
      "  const invalid=(code,detail)=>{const error=new Error(code);error.detail=detail;throw error};\n",
      "  try{\n",
      "    if(typeof runtime.node!=='string'||!path.isAbsolute(runtime.node)||runtime.node!==process.execPath||fs.realpathSync(runtime.node)!==fs.realpathSync(process.execPath))invalid('NODE_EXEC_PATH_MISMATCH','runtime.node must be this exact canonical tool executable');\n",
      "    if(typeof runtime.nodeVersion!=='string'||runtime.nodeVersion!==process.version)invalid('NODE_VERSION_MISMATCH','supplied version must equal tool process.version');\n",
      "    if(Number(process.versions.node.split('.')[0])!==22)invalid('NODE_MAJOR_UNSUPPORTED','only the existing CI Node22 family is eligible');\n",
      "    if(!process.features.typescript)invalid('NATIVE_TYPESCRIPT_UNAVAILABLE','actual tool process has type stripping disabled or unavailable');\n",
      "    if(typeof Module.registerHooks!=='function')invalid('REGISTER_HOOKS_UNAVAILABLE','public synchronous Node module hook API required');\n",
      "    if(runtime.nodePlatform&&runtime.nodePlatform!==process.platform)invalid('PLATFORM_MISMATCH');\n",
      "    if(runtime.nodeArch&&runtime.nodeArch!==process.arch)invalid('ARCH_MISMATCH');\n",
      "    receipt.nodeBinaryBefore=hash(runtime.node);\n",
      "    const cleanEnv={...process.env,...runtime.baseEnv};delete cleanEnv.NODE_OPTIONS;delete cleanEnv.TSX_TSCONFIG_PATH;\n",
      "    const version=spawnSync(runtime.node,['--version'],{encoding:'utf8',env:cleanEnv});\n",
      "    receipt.versionProbe={status:version.status,stdout:version.stdout,stderr:version.stderr,error:version.error?.code||null};\n",
      "    if(version.error||version.status!==0||version.stdout.trim()!==runtime.nodeVersion||version.stdout.trim()!==process.version)invalid('SUPPLIED_NODE_VERSION_PROBE_MISMATCH');\n",
      "    const probe=spawnSync(runtime.node,[path.join(here,'native-probe.mjs'),path.join(here,'native-probe.mts')],{encoding:'utf8',env:cleanEnv});\n",
      "    receipt.nativeProbe={status:probe.status,stdout:probe.stdout,stderr:probe.stderr,error:probe.error?.code||null,mjsSha256:hash(path.join(here,'native-probe.mjs')),mtsSha256:hash(path.join(here,'native-probe.mts'))};\n",
      "    const line=probe.stdout?.split('\\n').find(value=>value.startsWith('@@NODE_BINDING@@'));\n",
      "    const positive=line?JSON.parse(line.slice('@@NODE_BINDING@@'.length)):null;\n",
      "    receipt.nativeProbe.positive=positive;\n",
      "    if(probe.error||probe.status!==0||!positive||positive.error||positive.nativeValue!==911||positive.hookValue!==912||positive.execPath!==runtime.node||positive.version!==runtime.nodeVersion||positive.platform!==process.platform||positive.arch!==process.arch||positive.typescript!==process.features.typescript)invalid('NATIVE_NODE_CAPABILITY_PROBE_INVALID');\n",
      "    const publicRequire=Module.createRequire(path.join(runtime.publicResolutionOwner,'package.json'));\n",
      "    const cli=publicRequire.resolve('tsx/cli'),loader=publicRequire.resolve('tsx'),tsxPackage=publicRequire.resolve('tsx/package.json');\n",
      "    const tsx=JSON.parse(fs.readFileSync(tsxPackage,'utf8'));\n",
      "    const apiURL=runtime.producerModuleURL||runtime.apiModuleURL;\n",
      "    const compilerRequire=apiURL?Module.createRequire(new URL(apiURL)):publicRequire;\n",
      "    const esbuildPackage=compilerRequire.resolve('esbuild/package.json'),esbuild=JSON.parse(fs.readFileSync(esbuildPackage,'utf8'));\n",
      "    receipt.publicExports={tsxVersion:tsx.version,tsxRootURL:pathToFileURL(loader).href,tsxCli:cli,tsxPackage,esbuildVersion:esbuild.version,esbuildPackage};\n",
      "    if(runtime.publicCli&&runtime.publicCli!==cli)invalid('PUBLIC_CLI_RESOLUTION_MISMATCH');\n",
      "    if(runtime.publicTsxHookURL&&runtime.publicTsxHookURL!==pathToFileURL(loader).href)invalid('PUBLIC_TSX_ROOT_RESOLUTION_MISMATCH');\n",
      "    receipt.compilerIdentity={nodeVersion:process.version,platform:process.platform,arch:process.arch,nativeTypeScriptMode:process.features.typescript,esbuildVersion:esbuild.version,profileContract:'v4 independent compilerOptions={} relative-basename inline-map profile; owner legacy format unchanged',opaquePreparedSelection:runtime.preparationSelectionForWitnessLocator||null};\n",
      "    receipt.nodeBinaryAfter=hash(runtime.node);\n",
      "    if(receipt.nodeBinaryBefore!==receipt.nodeBinaryAfter)invalid('NODE_BINARY_CHANGED_DURING_BINDING');\n",
      "    receipt.status='VALID_TOOL_BINDING';\n",
      "  }catch(error){receipt.reason=error.message;receipt.detail=error.detail||null;}\n",
      "  fs.writeFileSync(receipt.receipt,JSON.stringify(receipt,null,2)+'\\n');\n",
      "  return receipt;\n",
      "}\n",
      "if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){\n",
      "  const runtime=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));\n",
      "  const receipt=await bindNode22(runtime);\n",
      "  console.log(JSON.stringify({status:receipt.status,semanticAssertions:0,reason:receipt.reason,receipt:receipt.receipt}));\n",
      "  process.exitCode=receipt.status==='VALID_TOOL_BINDING'?0:2;\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/contract.json", sha256: "9d4bd36e17fcb415a9a5a91dd8226ff133609f3c7b01ab77b25d829977c9d5ae", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/contract.json", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/contract.json"
    body: [
      "{\n",
      "  \"version\": \"sync-self-term-v4.3.1.platform-qualified\",\n",
      "  \"scope\": \"N.SYNC_SELF_TERM only; no project total-ledger unit added\",\n",
      "  \"sourceAuthority\": \"root task: exact public CLI raw status/signal/error and actual entry exit-hook behavior; preserve Darwin original raw0; Linux strict C=R\",\n",
      "  \"authorIndependence\": {\n",
      "    \"currentCandidateImplementationRead\": false,\n",
      "    \"peerAnalysisRead\": false,\n",
      "    \"candidateExecutionsAtFreeze\": 0,\n",
      "    \"linuxReferenceRepeatsAtFreeze\": 0\n",
      "  },\n",
      "  \"requirements\": [\n",
      "    {\n",
      "      \"id\": \"SYNC.RAW\",\n",
      "      \"accept\": \"C raw literal {status,signal,error} equals same-window independent public CLI R. No signal/exit conversion.\"\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"SYNC.HOOKS\",\n",
      "      \"accept\": \"C actual entry PID/thread0/mainThread ordered exit-hook code list equals R. Empty list is measured only with target observer boot and same-wiring real hook-positive controls.\"\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"SYNC.DARWIN_ZERO\",\n",
      "      \"accept\": \"On Darwin qualified public R and C additionally remain raw {status:0,signal:null,error:null}.\"\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"SYNC.QUALIFICATION\",\n",
      "      \"accept\": \"Exact platform/runtime/public-source/input/wiring identity; frozen healthy R-only sequence control+5 selfTERM+control; all 5 raw/hooks vectors identical; no cherry picking or retries; R-only count is finite stability evidence.\"\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"SYNC.PAIR_CONTINUITY\",\n",
      "      \"accept\": \"After qualification, execute R-before,C,R-after under the qualified identity; both R agree with qualification and one another. C expected comes from live R, never candidate output.\"\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"SYNC.WIRING\",\n",
      "      \"accept\": \"Keep old ENTRY_READY/RESULT/STDERR/NO_ORPHANS requirements, TS body, synchronous stack, atomic go handshake, no-config proof and source/observer/runtime identity evidence.\"\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"SYNC.RED_RETENTION\",\n",
      "      \"accept\": \"Old v4.2 and CI red originals are immutable. Qualification gaps and already observed C/R mismatches remain distinct; no Linux skip, weakening, expected replacement, assertion deletion or overwriting of old report.\"\n",
      "    }\n",
      "  ],\n",
      "  \"referenceQualification\": {\n",
      "    \"sequence\": [\n",
      "      \"R.CONTROL_BEFORE\",\n",
      "      \"R.SYNC.1\",\n",
      "      \"R.SYNC.2\",\n",
      "      \"R.SYNC.3\",\n",
      "      \"R.SYNC.4\",\n",
      "      \"R.SYNC.5\",\n",
      "      \"R.CONTROL_AFTER\"\n",
      "    ],\n",
      "    \"selfTermCount\": 5,\n",
      "    \"controlInput\": {\n",
      "      \"PROFILE_EXIT\": \"0\"\n",
      "    },\n",
      "    \"selfTermInput\": {\n",
      "      \"PROFILE_EXIT\": \"term\"\n",
      "    },\n",
      "    \"stabilityFields\": [\n",
      "      \"raw\",\n",
      "      \"entryHooks\",\n",
      "      \"businessResult\",\n",
      "      \"stderr\"\n",
      "    ],\n",
      "    \"scope\": \"exact Node binary+version/platform/arch/public tsx source/fixture+wiring/cwd/args/controlled env; new identity needs new qualification\"\n",
      "  },\n",
      "  \"linuxFixedNumericExpected\": null,\n",
      "  \"darwinFixedRaw\": {\n",
      "    \"status\": 0,\n",
      "    \"signal\": null,\n",
      "    \"error\": null\n",
      "  },\n",
      "  \"knownCI2003\": {\n",
      "    \"provenance\": \"root-supplied one observed Linux x64 / Node22.23.3 diagnostic; original paths bound separately on receipt\",\n",
      "    \"samples\": 1,\n",
      "    \"qualification\": \"INCOMPLETE\",\n",
      "    \"R\": {\n",
      "      \"raw\": {\n",
      "        \"status\": 143,\n",
      "        \"signal\": null,\n",
      "        \"error\": null\n",
      "      },\n",
      "      \"entryHooks\": []\n",
      "    },\n",
      "    \"C\": {\n",
      "      \"raw\": {\n",
      "        \"status\": 0,\n",
      "        \"signal\": null,\n",
      "        \"error\": null\n",
      "      },\n",
      "      \"entryHooks\": [\n",
      "        {\n",
      "          \"code\": 0\n",
      "        }\n",
      "      ]\n",
      "    },\n",
      "    \"relation\": {\n",
      "      \"RAW\": \"FAIL\",\n",
      "      \"HOOKS\": \"FAIL\"\n",
      "    },\n",
      "    \"semanticExpectedSource\": false\n",
      "  },\n",
      "  \"statuses\": {\n",
      "    \"referenceQualification\": [\n",
      "      \"QUALIFIED\",\n",
      "      \"INCOMPLETE\",\n",
      "      \"FAILED\",\n",
      "      \"INVALID\"\n",
      "    ],\n",
      "    \"candidateComparison\": [\n",
      "      \"PASS\",\n",
      "      \"FAIL\",\n",
      "      \"NOT_RUN\",\n",
      "      \"INVALID\"\n",
      "    ],\n",
      "    \"aggregatePass\": \"reference QUALIFIED and every same-window semantic assertion PASS; never infer from exit code alone\"\n",
      "  },\n",
      "  \"runAuthorization\": \"No R repeat or C run in this author task. Root must allocate explicit execution windows after freeze review.\",\n",
      "  \"notClaimed\": [\n",
      "    \"Linux executed locally\",\n",
      "    \"Linux stable from a single sample\",\n",
      "    \"all platform/patch/schedules supported\",\n",
      "    \"lifecycle319 or full original guard passed\",\n",
      "    \"v5 or business-data/performance completion\"\n",
      "  ],\n",
      "  \"parentFreeze\": {\n",
      "    \"version\": \"sync-self-term-v4.3.platform-qualified\",\n",
      "    \"manifestSha256\": \"0cf621dcd88af0e81b718d0aa16634d2b010d9de2e28a2472431474aed7a8a41\",\n",
      "    \"originalMembersUnmodified\": 21\n",
      "  },\n",
      "  \"narrowAmendment\": [\n",
      "    \"complete SHA/chunk and necessary package closure required by both forwarding guard and summary parsing; partial originals still forwarded and rejected\",\n",
      "    \"full qualification/identity/origin/source/vector continuity checked before any C factory import/start\",\n",
      "    \"inherited NODE_OPTIONS must be explicitly unset before tool invocation and absent from effective base env; only fixed observer import can enter stdout\",\n",
      "    \"CI persists complete public behavior/identity/hash stdout only; private environment file remains local diagnostic, no upload or full-env persistence claimed\"\n",
      "  ],\n",
      "  \"environmentRetention\": {\n",
      "    \"stdout\": \"controlled fixture/observer values plus actual inherited/effective environment hashes; never inherited NODE_OPTIONS contents\",\n",
      "    \"privateEnv\": \"mode0600 local temporary diagnostic; existing CI may delete it; no CI artifact persistence claim\",\n",
      "    \"qualificationRequiresPersistentPrivateEnv\": false,\n",
      "    \"scopeLimit\": \"finite exact identity/hash and public behavior qualification; not a proof of reproducibility from retained full inherited environment bytes\",\n",
      "    \"ifFullEnvBytesRequiredByDownstreamAcceptance\": \"receipt is ineligible for that claim; report UNKNOWN/INVALID, do not pretend CI persisted bytes or expand workflow\"\n",
      "  }\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/inputs/boundary-observer.mjs", sha256: "16ea6f135a334fe739920a6cd66afc629afed5f5bbd7edb2f16afc6e27b11576", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/inputs/boundary-observer.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/inputs/boundary-observer.mjs"
    body: [
      "import { appendFileSync } from 'node:fs';\n",
      "import { isMainThread, threadId } from 'node:worker_threads';\n",
      "const fingerprint = '681c0a435ec9f73847ff726047172fce83c5ca4f1863f18cc1bd497dfd987b21';\n",
      "const log = row => appendFileSync(process.env.CONTRACT_BOUNDARY_LOG, JSON.stringify({ ...row, fingerprint, pid: process.pid, ppid: process.ppid, threadId, isMainThread }) + '\\n');\n",
      "log({ kind: 'boundary-boot' });\n",
      "process.on('exit', code => log({ kind: 'boundary-exit-hook', code }));\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/inputs/main-alpha.ts", sha256: "dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/inputs/main-alpha.ts", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/inputs/main-alpha.ts"
    body: [
      "const contractSyncSourceFingerprint='750b927dbce742e64e7ffc4c798cd54a1366e2ab3d73a7704a5bfd5598913731';\n",
      "import {count,version,box} from './state-beta.ts';\n",
      "import {appendFileSync,writeFileSync,existsSync,readFileSync} from 'node:fs';\n",
      "import {isMainThread,threadId} from 'node:worker_threads';\n",
      "const fingerprint='b5ab0823b19a40c1c2ff3c6a55b29d47f8acc9f2b2e428c93602140138f104f2';\n",
      "const unit=\"main-alpha\";\n",
      "const ownVersion=\"main-v1\";\n",
      "if(process.env.PROFILE_EVAL_LOG) appendFileSync(process.env.PROFILE_EVAL_LOG,JSON.stringify({kind:'eval',unit,version:ownVersion,fingerprint,pid:process.pid,threadId,isMainThread})+'\\n');\n",
      "function report(count,version,shared){console.log('@@RESULT@@'+JSON.stringify({unit,count,version,shared,fingerprint,pid:process.pid,threadId,isMainThread,execPath:process.execPath,cwd:process.cwd(),env:process.env.CI_PROFILE_TOKEN,args:process.argv.slice(2),entryURL:import.meta.url}));if(process.env.PROFILE_EXIT==='term'){\n",
      "const ready={kind:'sync-entry-ready',token:process.env.CONTRACT_SYNC_TOKEN,fingerprint,sourceFingerprint:contractSyncSourceFingerprint,pid:process.pid,ppid:process.ppid,threadId,isMainThread,entryURL:import.meta.url};\n",
      "writeFileSync(process.env.CONTRACT_SYNC_READY,JSON.stringify(ready)+'\\n');\n",
      "const gateCell=new Int32Array(new SharedArrayBuffer(4));const gateStart=Date.now();\n",
      "while(!existsSync(process.env.CONTRACT_SYNC_GO)){if(Date.now()-gateStart>5000)throw new Error('SYNC_GO_TIMEOUT');Atomics.wait(gateCell,0,0,1);}\n",
      "const go=JSON.parse(readFileSync(process.env.CONTRACT_SYNC_GO,'utf8'));if(go.token!==process.env.CONTRACT_SYNC_TOKEN)throw new Error('SYNC_GO_TOKEN_INVALID');\n",
      "process.kill(process.pid,'SIGTERM');\n",
      "}else process.exitCode=Number(process.env.PROFILE_EXIT||'0');}\n",
      "report(count,version,box.value);\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/inputs/package.json", sha256: "89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/inputs/package.json", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/inputs/package.json"
    body: [
      "{\"type\":\"module\",\"private\":true}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/inputs/state-beta.ts", sha256: "aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/inputs/state-beta.ts", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/inputs/state-beta.ts"
    body: [
      "import {appendFileSync} from 'node:fs';\n",
      "import {isMainThread,threadId} from 'node:worker_threads';\n",
      "const fingerprint='6eb516a123be2949bbf007fd3975d0dedbbe98e04116bb24001c9c7484651c11';\n",
      "const unit=\"state-beta\";\n",
      "const ownVersion=\"state-v1\";\n",
      "if(process.env.PROFILE_EVAL_LOG) appendFileSync(process.env.PROFILE_EVAL_LOG,JSON.stringify({kind:'eval',unit,version:ownVersion,fingerprint,pid:process.pid,threadId,isMainThread})+'\\n');\n",
      "function report(count,version,shared){console.log('@@RESULT@@'+JSON.stringify({unit,count,version,shared,fingerprint,pid:process.pid,threadId,isMainThread,execPath:process.execPath,cwd:process.cwd(),env:process.env.CI_PROFILE_TOKEN,args:process.argv.slice(2),entryURL:import.meta.url}));if(process.env.PROFILE_EXIT==='term')process.kill(process.pid,'SIGTERM');else process.exitCode=Number(process.env.PROFILE_EXIT||'0');}\n",
      "let calls=0;\n",
      "class Base {}\n",
      "Object.defineProperty(Base.prototype,'value',{set(_v){calls+=1;},configurable:true});\n",
      "class Derived extends Base {value=701;}\n",
      "new Derived();\n",
      "export const count=calls;\n",
      "export const version=\"state-v1\";\n",
      "export const box={value:'unset'};\n",
      "if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1])report(count,version,box.value);\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/inputs/tsconfig.json", sha256: "6a8c5b15a1c6343da145ac63946fc85dd805c80e72b3575d58fbc740eb14edac", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/inputs/tsconfig.json", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/inputs/tsconfig.json"
    body: [
      "{\"compilerOptions\":{\"target\":\"ES2022\",\"useDefineForClassFields\":false}}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/runtime.example.json", sha256: "0f4fa3eb32046d2f6bf3631cb5de9bc15fd1486623a63261823add3bf78a96c8", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/runtime.example.json", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/runtime.example.json"
    body: [
      "{\n",
      "  \"node\":\"/absolute/exact/ci-node22/bin/node\",\n",
      "  \"nodeVersion\":\"v22.23.3\",\n",
      "  \"nodePlatform\":\"linux\",\n",
      "  \"nodeArch\":\"x64\",\n",
      "  \"publicResolutionOwner\":\"/absolute/installed/public/dependency/owner\",\n",
      "  \"publicCli\":\"/absolute/resolved/tsx/cli\",\n",
      "  \"entry\":\"/absolute/fresh-fixture/owner/scripts/main-alpha.ts\",\n",
      "  \"cwd\":\"/absolute/fresh-fixture/no-config/leaf\",\n",
      "  \"outputRoot\":\"/absolute/ci-evidence-root-outside-old-adapter-cleanup\",\n",
      "  \"baseEnv\":{},\n",
      "  \"unsetEnv\":[],\n",
      "  \"note\":\"This is R-only. Do not supply producerModuleURL/apiModuleURL/syncSelf.C. Root execution-window authorization is still required. Invoke exact same Node as node. No C baseline or Linux success claimed by this example.\"\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/source-preservation.json", sha256: "c1c9a225b5ca3cae8ffcd9dc268a89b130ec86693e97e9bed392e9b267ac6d3c", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/source-preservation.json", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/source-preservation.json"
    body: [
      "{\n",
      "  \"version\": \"v4.3.1-old-preservation\",\n",
      "  \"oldV42Root\": \"/private/tmp/kc-20261024/ci-runtime-recovery-producer-v4-tests-artifacts/ci-node22-portability-v4.2-runtime\",\n",
      "  \"oldV42Files\": [\n",
      "    {\n",
      "      \"path\": \"README.md\",\n",
      "      \"sha256\": \"93e033f2728f56ed87f4532f40fc52f95dd962c45279b06d5dc54af45de31639\",\n",
      "      \"bytes\": 2629\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"binding/native-probe.mjs\",\n",
      "      \"sha256\": \"88bed797099479800fb35ab7a84a703cb24ea366bd1d9794dbb5938e7ae23388\",\n",
      "      \"bytes\": 977\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"binding/native-probe.mts\",\n",
      "      \"sha256\": \"61fa9de92eac477f270efafdb41005886619b188d6d8f96028c99899c27c456d\",\n",
      "      \"bytes\": 40\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"binding/node-binding.mjs\",\n",
      "      \"sha256\": \"cad4562e2a7116de484fd93b56a43cc9dbd80edc37546c06b9b78c7a4dd0da2d\",\n",
      "      \"bytes\": 6043\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"contract.json\",\n",
      "      \"sha256\": \"cfa1f633de94a2d74a7589c413d50b3b7a4743b25a9056d880f4dc64fda62389\",\n",
      "      \"bytes\": 1596\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"descriptor/prepare.mjs\",\n",
      "      \"sha256\": \"b421c038bba2f05bb208c476250ea72eef13a40971ddc89955e755720bfcfd00\",\n",
      "      \"bytes\": 9197\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"execution-members.json\",\n",
      "      \"sha256\": \"87c782181f75d33293088271503bc92e660d7aeb58003994371c74ce9b337934\",\n",
      "      \"bytes\": 1107\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"freeze-manifest.json\",\n",
      "      \"sha256\": \"f2d67ff071b7a2058ae62e56fffabc86f042c9597f905dd0b29690057c85c445\",\n",
      "      \"bytes\": 11234\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/README.md\",\n",
      "      \"sha256\": \"9487cfb56d0d84eaa2706458d71bd5f7745b095e23a15dd046210faba6f96b86\",\n",
      "      \"bytes\": 405\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/cases.json\",\n",
      "      \"sha256\": \"6cc03748079d4461036a9a78080d548b06e5e464bd53f3cd1603020650a0d51c\",\n",
      "      \"bytes\": 12320\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/expected.json\",\n",
      "      \"sha256\": \"c56153b3b830a9f959874c68df73cd324d96a25ded6d7b9c5090d311db21b05f\",\n",
      "      \"bytes\": 33379\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/freeze-manifest.json\",\n",
      "      \"sha256\": \"8e75b818b0baf50e4ddddffefe23ec57393ea133f1cc0fd908b27415e6cc2055\",\n",
      "      \"bytes\": 2309\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/preload/README.md\",\n",
      "      \"sha256\": \"099fb7a365dd7407d77ebd32df8b128a7f59786afc8c9d1352f14f8e6ee5ebf4\",\n",
      "      \"bytes\": 407\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/preload/freeze-manifest.json\",\n",
      "      \"sha256\": \"66ace09e7f3b77144382c0acea666871d9d15373be09e399dc5b8366c8742c6a\",\n",
      "      \"bytes\": 790\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/preload/ordinary-preload.mjs\",\n",
      "      \"sha256\": \"56620e06760cd26db5d95ae84800cdacc3377e07a25a6fb43770a86eb7912e22\",\n",
      "      \"bytes\": 1374\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/preload/run.mjs\",\n",
      "      \"sha256\": \"bcde72029a299beabb6b913fcfa5e520f2ffe69eb8ab74d409fdcba62ed604c6\",\n",
      "      \"bytes\": 9474\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/preload/spec.json\",\n",
      "      \"sha256\": \"604baa588ea7b89f26bf20c42e27a92d2c0c1976d0803bc5bead6c931a6ac18e\",\n",
      "      \"bytes\": 2509\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/spec.json\",\n",
      "      \"sha256\": \"15616faf9adb0bd24dda2c6b6167ace0904f1eac8522636e0ad4a5e9db73edce\",\n",
      "      \"bytes\": 1622\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/src/boundary-observer.mjs\",\n",
      "      \"sha256\": \"16ea6f135a334fe739920a6cd66afc629afed5f5bbd7edb2f16afc6e27b11576\",\n",
      "      \"bytes\": 475\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/src/observer.mjs\",\n",
      "      \"sha256\": \"7200e9a35b89dfc43f29736e683b2538d96578addb9a01d4d527694ccea0af2f\",\n",
      "      \"bytes\": 603\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/src/run.mjs\",\n",
      "      \"sha256\": \"de1a73c9a40eb3523d9a1e14bc4c682d3b6ed5910de4a6b1cce143f6b06bf9c5\",\n",
      "      \"bytes\": 29754\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/sync/README.md\",\n",
      "      \"sha256\": \"a4046831440f47e39c75f4769f67b85d96b24ed30b13ca1af3fc6181222e8d25\",\n",
      "      \"bytes\": 403\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/sync/expected.json\",\n",
      "      \"sha256\": \"50222826781a9da0dc75a24e7e1eb98a365ea6903572a0ab99dbaeec4701ab93\",\n",
      "      \"bytes\": 1485\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/sync/freeze-manifest.json\",\n",
      "      \"sha256\": \"856dfbffee67edeea75b009270ba09b45be4bdfd4cd726b4a588a64b2991ae70\",\n",
      "      \"bytes\": 640\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"lifecycle319/sync/run.mjs\",\n",
      "      \"sha256\": \"474c874be95192e403bf037d253b22ac2c61f159444096ffd444a53d4b76ec8f\",\n",
      "      \"bytes\": 12022\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"node-binding-qualification-receipts.json\",\n",
      "      \"sha256\": \"623c7cb70aac068e2587fbb8c1088889463b9ea1c6c315c8c1ed6e8e3d23ed78\",\n",
      "      \"bytes\": 5915\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"patch-inventory.json\",\n",
      "      \"sha256\": \"d93030bd64af33b4d1875cd791da4e336c55c325e9a0e6f17eb84cd82c52faf0\",\n",
      "      \"bytes\": 3830\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"portable-root-binding.json\",\n",
      "      \"sha256\": \"4d4e896b638a19bcf57c16365d70321da1bcdbbedcb309efbd7f16b1dc6fcfdc\",\n",
      "      \"bytes\": 1784\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/expected.json\",\n",
      "      \"sha256\": \"3f9846f1275d5dec59199b394d0399af44a83720ed847c690a9a55eb8a5e9057\",\n",
      "      \"bytes\": 7240\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/freeze-manifest.json\",\n",
      "      \"sha256\": \"12e657481d591eb65d7e2dde0b58100b3c408ee91ea270d6521a9b5d9e6f3fa2\",\n",
      "      \"bytes\": 5647\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/entry-invalid.ts.txt\",\n",
      "      \"sha256\": \"baf20f3736274a2262a36af0901597146592729bd138d4083c3b5a804d3c6ae0\",\n",
      "      \"bytes\": 25\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/entry-v2.ts.txt\",\n",
      "      \"sha256\": \"f5354b54bdc0ea76a8a85d80b5e4989ae6dc329452b3fb447be940d7bdc54c14\",\n",
      "      \"bytes\": 537\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-empty/package.json\",\n",
      "      \"sha256\": \"efe393d66fac9c641cf01b3eb935de0fbe9b41bb164484bf401f3df834ce6adb\",\n",
      "      \"bytes\": 69\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-empty/scripts/entry.ts\",\n",
      "      \"sha256\": \"823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e\",\n",
      "      \"bytes\": 537\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-empty/scripts/state.ts\",\n",
      "      \"sha256\": \"fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45\",\n",
      "      \"bytes\": 276\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-empty/scripts/tail.ts\",\n",
      "      \"sha256\": \"cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481\",\n",
      "      \"bytes\": 69\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-empty/subproject/tsconfig.json\",\n",
      "      \"sha256\": \"72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896\",\n",
      "      \"bytes\": 13\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-empty/tsconfig.json\",\n",
      "      \"sha256\": \"caa48a7ab58f6ef8618d04668366d1ef3fd0d8512303d7eec9abdcd3e27f620c\",\n",
      "      \"bytes\": 28\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-false/package.json\",\n",
      "      \"sha256\": \"61309c3069922207c14132ddb9bef9e192ddd41f58251dd0b4e13fb488cf7665\",\n",
      "      \"bytes\": 69\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-false/scripts/entry.ts\",\n",
      "      \"sha256\": \"823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e\",\n",
      "      \"bytes\": 537\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-false/scripts/state.ts\",\n",
      "      \"sha256\": \"fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45\",\n",
      "      \"bytes\": 276\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-false/scripts/tail.ts\",\n",
      "      \"sha256\": \"cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481\",\n",
      "      \"bytes\": 69\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-false/subproject/tsconfig.json\",\n",
      "      \"sha256\": \"72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896\",\n",
      "      \"bytes\": 13\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-false/tsconfig.json\",\n",
      "      \"sha256\": \"b9516496d03bb7ba72eeab4efff569049940478e2a39fbf8d51175ec57d00ac5\",\n",
      "      \"bytes\": 92\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-true/package.json\",\n",
      "      \"sha256\": \"aaa9a17a999331b612757994990130659389e88ebd7620cf5989bd6502b54cbd\",\n",
      "      \"bytes\": 68\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-true/scripts/entry.ts\",\n",
      "      \"sha256\": \"823f1ca2ed64bb799e00f5e86926d17fe6d3af62b76a878540eab6941361056e\",\n",
      "      \"bytes\": 537\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-true/scripts/state.ts\",\n",
      "      \"sha256\": \"fa01815d27a982452bf87a897d04b94a29422a0a537a5593bcad39cb96867b45\",\n",
      "      \"bytes\": 276\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-true/scripts/tail.ts\",\n",
      "      \"sha256\": \"cad5dbd7e8f50470d0d6acba11675a7e1c4a4b2131116d55dd25463910792481\",\n",
      "      \"bytes\": 69\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-true/subproject/tsconfig.json\",\n",
      "      \"sha256\": \"72094c8b2dcf0bfb4f1d7ef1e19f4be87352e3165051f0a9f28b3169215a5896\",\n",
      "      \"bytes\": 13\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/inputs/fixtures/owner-true/tsconfig.json\",\n",
      "      \"sha256\": \"0a2db56b5ac91fdf7fec01a551e8141d462928593d52f0f897fa706db2e94c20\",\n",
      "      \"bytes\": 91\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/legacy-public-api/manifest.json\",\n",
      "      \"sha256\": \"640e211d40eee25f3ccba17abe55ae9529e9bd002544db3719f786363734bab1\",\n",
      "      \"bytes\": 1527\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/legacy-public-api/package.json\",\n",
      "      \"sha256\": \"89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035\",\n",
      "      \"bytes\": 33\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/legacy-public-api/scripts/check/prebuilt-hook.ts\",\n",
      "      \"sha256\": \"bbb759bf8031d7540479cb6e3c2cd5dba0a9daa7939b6558bf2e9a04c45cba6e\",\n",
      "      \"bytes\": 4588\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/legacy-public-api/scripts/check/prebuilt.ts\",\n",
      "      \"sha256\": \"fb09aed5603a95275a618dd4d7f5e06ee6e6508801a28b4a58a9c3a857155a89\",\n",
      "      \"bytes\": 13501\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/legacy-public-api/scripts/check/tsx-cmd.ts\",\n",
      "      \"sha256\": \"d30070e19848edca5f190d2355092696056e67af611e6caaa04aa144f195373f\",\n",
      "      \"bytes\": 4838\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/spec.json\",\n",
      "      \"sha256\": \"601275305d83ce538c79eda7885eac7bc0fc228dc86de43fbbcbbafc91bd013f\",\n",
      "      \"bytes\": 2911\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/src/capability-probe.mjs\",\n",
      "      \"sha256\": \"d49a08bac4e6ce0ac9d743a0938a5c12e4698eec955598d7e533d25dc0e2c57d\",\n",
      "      \"bytes\": 246\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/src/legacy-empty-oracle.mjs\",\n",
      "      \"sha256\": \"e1700d2db1b9dc09583c980e723a10a37c55fecb6d8f9155f4cf77f1eb00b9de\",\n",
      "      \"bytes\": 5446\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/src/run.mjs\",\n",
      "      \"sha256\": \"00693b7a2e12ad1f11269489beaadb81864e4ef74bf43fd31e8ee790d629d275\",\n",
      "      \"bytes\": 24817\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/src/supply-lifecycle.mjs\",\n",
      "      \"sha256\": \"b46e6f5beb44276649807d85b1b91e74d3f1e3dad9bfd12feb9a9e364d22f368\",\n",
      "      \"bytes\": 6000\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"producer/src/worker-host.mjs\",\n",
      "      \"sha256\": \"575f1542ab12b91482c7b87d19d1fe21153639a1cf72a6f599abf12dca08e24a\",\n",
      "      \"bytes\": 415\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"runtime.example.json\",\n",
      "      \"sha256\": \"e7ff966fc5ccd669a95cc9d3e959894b5d695770718e7478822a3f0b043c40a2\",\n",
      "      \"bytes\": 2126\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"scope-omissions.json\",\n",
      "      \"sha256\": \"f248a634b3854c544643d0eaf7b19897a942baf365b0baa586d8d05971e5cb17\",\n",
      "      \"bytes\": 1873\n",
      "    }\n",
      "  ],\n",
      "  \"publishedSyncPins\": [\n",
      "    {\n",
      "      \"path\": \"README.md\",\n",
      "      \"expected\": \"a4046831440f47e39c75f4769f67b85d96b24ed30b13ca1af3fc6181222e8d25\",\n",
      "      \"actual\": \"a4046831440f47e39c75f4769f67b85d96b24ed30b13ca1af3fc6181222e8d25\"\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"expected.json\",\n",
      "      \"expected\": \"50222826781a9da0dc75a24e7e1eb98a365ea6903572a0ab99dbaeec4701ab93\",\n",
      "      \"actual\": \"50222826781a9da0dc75a24e7e1eb98a365ea6903572a0ab99dbaeec4701ab93\"\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"run.mjs\",\n",
      "      \"expected\": \"474c874be95192e403bf037d253b22ac2c61f159444096ffd444a53d4b76ec8f\",\n",
      "      \"actual\": \"474c874be95192e403bf037d253b22ac2c61f159444096ffd444a53d4b76ec8f\"\n",
      "    }\n",
      "  ],\n",
      "  \"publishedFixturePins\": [\n",
      "    {\n",
      "      \"path\": \"/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/package.json\",\n",
      "      \"publishedSha256\": \"89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035\",\n",
      "      \"actualSha256\": \"89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035\"\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/main-alpha.ts\",\n",
      "      \"publishedSha256\": \"dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7\",\n",
      "      \"actualSha256\": \"dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7\"\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/scripts/state-beta.ts\",\n",
      "      \"publishedSha256\": \"aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588\",\n",
      "      \"actualSha256\": \"aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588\"\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"/private/tmp/kc-20261024/ci-parent-runner-contract-v3-artifacts/supplement-sync-self/fixtures/owner/tsconfig.json\",\n",
      "      \"publishedSha256\": \"6a8c5b15a1c6343da145ac63946fc85dd805c80e72b3575d58fbc740eb14edac\",\n",
      "      \"actualSha256\": \"6a8c5b15a1c6343da145ac63946fc85dd805c80e72b3575d58fbc740eb14edac\"\n",
      "    }\n",
      "  ],\n",
      "  \"CI2003\": {\n",
      "    \"jobLog\": \"/private/tmp/kc-20261024/ci-recovery-CI2003-artifacts/job.log\",\n",
      "    \"bytes\": 508751,\n",
      "    \"sha256\": \"330f1f915bb149b975fbfb6e8d9dcaa66f4c6fc8c4ad39940c3b542499c9c015\",\n",
      "    \"rawLine\": 5318,\n",
      "    \"RDerived\": \"/private/tmp/kc-20261024/ci-recovery-CI2003-artifacts/R-only-derived.json\",\n",
      "    \"RDerivedSha256\": \"5795be8a106021f19ffd202eac55ef841163d765a44d825ce41e8c9547173d73\",\n",
      "    \"samples\": 1,\n",
      "    \"qualification\": \"INCOMPLETE\",\n",
      "    \"causality\": \"No OS-vs-Node-patch cause inferred\"\n",
      "  },\n",
      "  \"writesToOldRoots\": false,\n",
      "  \"parentFrozenV43\": {\n",
      "    \"root\": \"/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3\",\n",
      "    \"manifestSha256\": \"0cf621dcd88af0e81b718d0aa16634d2b010d9de2e28a2472431474aed7a8a41\",\n",
      "    \"members\": [\n",
      "      {\n",
      "        \"path\": \"CI-INTEGRATION.md\",\n",
      "        \"sha256\": \"31ba848c53e91fa616ac407909110ec33b1c1478dd55a099130b107b75c16d30\",\n",
      "        \"bytes\": 4740\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"LABEL-MAPPING.json\",\n",
      "        \"sha256\": \"b72de2deff3f48373e2763909f265ffc11a1fe71415c86dec70afc427d3f5eb6\",\n",
      "        \"bytes\": 1416\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"README.md\",\n",
      "        \"sha256\": \"6bc96b426b52a2ada74fe68a072c546cf50937713477a95fa26a5584fa25bb2c\",\n",
      "        \"bytes\": 1896\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"binding/native-probe.mjs\",\n",
      "        \"sha256\": \"88bed797099479800fb35ab7a84a703cb24ea366bd1d9794dbb5938e7ae23388\",\n",
      "        \"bytes\": 977\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"binding/native-probe.mts\",\n",
      "        \"sha256\": \"61fa9de92eac477f270efafdb41005886619b188d6d8f96028c99899c27c456d\",\n",
      "        \"bytes\": 40\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"binding/node-binding.mjs\",\n",
      "        \"sha256\": \"cad4562e2a7116de484fd93b56a43cc9dbd80edc37546c06b9b78c7a4dd0da2d\",\n",
      "        \"bytes\": 6043\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"contract.json\",\n",
      "        \"sha256\": \"76be96b98b15f20a6f5bfe5701ec83513041047d8f9217aad1ac4cdbbd174642\",\n",
      "        \"bytes\": 3504\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"inputs/boundary-observer.mjs\",\n",
      "        \"sha256\": \"16ea6f135a334fe739920a6cd66afc629afed5f5bbd7edb2f16afc6e27b11576\",\n",
      "        \"bytes\": 475\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"inputs/main-alpha.ts\",\n",
      "        \"sha256\": \"dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7\",\n",
      "        \"bytes\": 1758\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"inputs/package.json\",\n",
      "        \"sha256\": \"89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035\",\n",
      "        \"bytes\": 33\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"inputs/state-beta.ts\",\n",
      "        \"sha256\": \"aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588\",\n",
      "        \"bytes\": 1215\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"inputs/tsconfig.json\",\n",
      "        \"sha256\": \"6a8c5b15a1c6343da145ac63946fc85dd805c80e72b3575d58fbc740eb14edac\",\n",
      "        \"bytes\": 72\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"runtime.example.json\",\n",
      "        \"sha256\": \"0f4fa3eb32046d2f6bf3631cb5de9bc15fd1486623a63261823add3bf78a96c8\",\n",
      "        \"bytes\": 690\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"source-preservation.json\",\n",
      "        \"sha256\": \"7ea9654cf01c3a632d63657b754ce742d31f7243e5cff6cd4c5a4e0c2e2fd04c\",\n",
      "        \"bytes\": 13471\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"src/evidence.mjs\",\n",
      "        \"sha256\": \"3d3f386a4b5e2ea0a7d15cfa177b8ac4f0b7967510f0c30eb2dee1af1a322664\",\n",
      "        \"bytes\": 2166\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"src/judge.mjs\",\n",
      "        \"sha256\": \"d2b2536a368f7c7280dc013ba8e87e469088f04dff9acda7844f33c1c00250e1\",\n",
      "        \"bytes\": 8132\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"src/prepare-fixture.mjs\",\n",
      "        \"sha256\": \"e556b89fcfb7942519cd4cd3282e4ed3bb9397438512167c531c4fba4f8d1b04\",\n",
      "        \"bytes\": 852\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"src/qualify.mjs\",\n",
      "        \"sha256\": \"5eafe847bbcdf1c1fc20a0199123a474984bfcc36b5214a74d80e9264e2308ef\",\n",
      "        \"bytes\": 13687\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"src/run.mjs\",\n",
      "        \"sha256\": \"fa12840ee507508377227db4d4803afe09fb0a15d640afbae6583d459dad6f6f\",\n",
      "        \"bytes\": 6187\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"src/tool-selftest.mjs\",\n",
      "        \"sha256\": \"f513586977a9e3c022e32bb9cdb140dcbcd9312d4910f15a8a8898cc629d56ff\",\n",
      "        \"bytes\": 7122\n",
      "      },\n",
      "      {\n",
      "        \"path\": \"src/verify-pair.mjs\",\n",
      "        \"sha256\": \"df875dd9f8e4a5c9dcbb4fed8e2856a10942315c129933c03d1a089317457d56\",\n",
      "        \"bytes\": 652\n",
      "      }\n",
      "    ],\n",
      "    \"all21OriginalMembersUnchanged\": true\n",
      "  }\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/src/evidence.mjs", sha256: "38886a62a990845c904b6d79ad7715b7c3d370e65f8469d5d46949439b36076c", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/src/evidence.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/src/evidence.mjs"
    body: [
      "import crypto from 'node:crypto';\n",
      "import path from 'node:path';\n",
      "import {version,equal,judgeQualification,judgePair} from './judge.mjs';\n",
      "export const marker='@@SYNC43_TAPE@@';\n",
      "export const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');\n",
      "const release='4.3.1';\n",
      "const requireEvidence=(ok,message)=>{if(!ok)throw new Error('SYNC431_EVIDENCE_'+message);};\n",
      "export function emitEvidence(kind,id,value,emit=line=>process.stdout.write(line+'\\n')) {\n",
      "  const evidenceId=id+':'+crypto.randomBytes(6).toString('hex');const bytes=Buffer.from(JSON.stringify(value));const b64=bytes.toString('base64');const total=Math.ceil(b64.length/2048);\n",
      "  for(let index=0;index<total;index++)emit(marker+JSON.stringify({version:43,release,kind,id:evidenceId,index,total,sha256:sha(bytes),encoding:'base64(json-utf8)',chunk:b64.slice(index*2048,(index+1)*2048)}));\n",
      "}\n",
      "export function decodeEvidence(log) {\n",
      "  const groups=new Map();for(const line of log.split('\\n')){const p=line.indexOf(marker);if(p<0)continue;const x=JSON.parse(line.slice(p+marker.length));requireEvidence(x.version===43&&x.release===release&&x.encoding==='base64(json-utf8)'&&typeof x.kind==='string'&&typeof x.id==='string'&&typeof x.chunk==='string'&&/^[a-f0-9]{64}$/.test(x.sha256||'')&&Number.isInteger(x.index)&&Number.isInteger(x.total)&&x.total>0&&x.index>=0&&x.index<x.total,'HEADER_INVALID');const key=x.kind+':'+x.id;const g=groups.get(key)||{...x,chunks:new Map()};requireEvidence(g.sha256===x.sha256&&g.total===x.total&&!g.chunks.has(x.index),'MIXED_OR_DUPLICATE_CHUNK');g.chunks.set(x.index,x.chunk);groups.set(key,g);}\n",
      "  requireEvidence(groups.size>0,'MISSING');return [...groups.values()].map(g=>{requireEvidence(g.chunks.size===g.total,'INCOMPLETE_CHUNKS');const b64=Array.from({length:g.total},(_,i)=>g.chunks.get(i)).join('');const bytes=Buffer.from(b64,'base64');requireEvidence(bytes.toString('base64')===b64&&sha(bytes)===g.sha256,'BYTES_OR_SHA_MISMATCH');return {kind:g.kind,id:g.id,sha256:g.sha256,value:JSON.parse(bytes)};});\n",
      "}\n",
      "function rawSummary(stdout){const lines=stdout.split('\\n').filter(l=>l&&!l.startsWith(marker));requireEvidence(lines.length>0,'SUMMARY_MISSING');const summary=JSON.parse(lines.at(-1));requireEvidence(summary&&typeof summary.status==='string','SUMMARY_INVALID');return summary;}\n",
      "function publicRecordComplete(r){return !!r&&Object.hasOwn(r,'raw')&&Array.isArray(r.command)&&typeof r.stdoutBase64==='string'&&typeof r.stderrBase64==='string'&&Object.hasOwn(r,'boundaryBase64')&&(r.boundaryBase64===null||typeof r.boundaryBase64==='string')&&Array.isArray(r.boundary)&&Array.isArray(r.evaluation)&&r.envControlled&&/^[a-f0-9]{64}$/.test(r.effectiveEnvSha256||'')&&/^[a-f0-9]{64}$/.test(r.inheritedEnvSha256||'');}\n",
      "export function validateEvidenceClosure(stdout){\n",
      "  const summary=rawSummary(stdout),groups=decodeEvidence(stdout);\n",
      "  const of=kind=>groups.filter(g=>g.kind===kind);\n",
      "  requireEvidence(of('REFERENCE_QUALIFICATION').length===1,'QUALIFICATION_PACKET_REQUIRED');\n",
      "  const q=of('REFERENCE_QUALIFICATION')[0].value;\n",
      "  requireEvidence(q?.version===version&&q.identity?.version===version&&typeof q.sessionId==='string'&&q.sessionId.length>0&&typeof q.output==='string'&&Array.isArray(q.records)&&q.retention?.publicEvidence==='COMPLETE_SHA_CHECKED_STDOUT_PACKET'&&q.retention?.inheritedEnvInStdout==='HASH_AND_CONTROLLED_VALUES_ONLY'&&q.retention?.privateEnvPersistence==='LOCAL_DIAGNOSTIC_ONLY_NOT_ASSERTED_IN_CI'&&q.retention?.qualificationRequiresPersistentPrivateEnv===false,'QUALIFICATION_IDENTITY_INVALID');\n",
      "  const labels=['R.CONTROL_BEFORE',...Array.from({length:5},(_,i)=>'R.SYNC.'+(i+1)),'R.CONTROL_AFTER'];\n",
      "  requireEvidence(equal(q.records.map(r=>r.label),labels),'QUALIFICATION_SEQUENCE_INCOMPLETE');\n",
      "  const qualification=judgeQualification(q);\n",
      "  requireEvidence(equal(q.qualification,qualification),'QUALIFICATION_JUDGMENT_MISMATCH');\n",
      "  const references=of('REFERENCE_RECORD');\n",
      "  for(let i=0;i<labels.length;i++)requireEvidence(references[i]?.value.label===labels[i]&&equal(references[i].value,q.records[i])&&publicRecordComplete(references[i].value),'REFERENCE_RECORD_CLOSURE_INCOMPLETE');\n",
      "  let expectedKinds=[...labels.map(()=> 'REFERENCE_RECORD'),'REFERENCE_QUALIFICATION'];\n",
      "  const reports=of('SYNC_REPORT');\n",
      "  if(['QUALIFIED','FAILED','INCOMPLETE'].includes(summary.status)){\n",
      "    requireEvidence(reports.length===0&&summary.report===path.join(q.output,'qualification.json')&&summary.status===qualification.status&&summary.semanticCandidateAssertions===0&&summary.referenceExecutions===q.records.filter(r=>r.carrierPid).length,'STANDALONE_SUMMARY_MISMATCH');\n",
      "  }else{\n",
      "    requireEvidence(reports.length===1,'SYNC_REPORT_REQUIRED');const report=reports[0].value;\n",
      "    requireEvidence(summary.report===path.join(q.output,'report.json')&&report.status===summary.status&&report.semanticAssertions===summary.semanticAssertions,'SUMMARY_REPORT_MISMATCH');\n",
      "    if(summary.status==='REFERENCE_QUALIFIED'){\n",
      "      requireEvidence(qualification.status==='QUALIFIED'&&report.kind==='SYNC_SELF_TERM_V43_R_ONLY'&&report.referenceQualification==='QUALIFIED'&&report.candidateComparison==='NOT_RUN'&&report.candidateExecutions===0&&report.semanticAssertions===0&&report.referenceExecutions===q.records.filter(r=>r.carrierPid).length&&equal(report.assertions,qualification.assertions),'R_ONLY_REPORT_MISMATCH');\n",
      "    }else if(summary.status==='INVALID'&&qualification.status!=='QUALIFIED'){\n",
      "      requireEvidence(report.referenceQualification===qualification.status&&report.candidateComparison==='NOT_RUN'&&report.candidateExecutions===0&&report.semanticAssertions===0&&equal(report.qualification,qualification)&&equal(report.assertions,qualification.assertions),'QUALIFICATION_FAILURE_REPORT_MISMATCH');\n",
      "    }else{\n",
      "      requireEvidence(['PASS','FAIL'].includes(summary.status)&&qualification.status==='QUALIFIED'&&of('PAIR_PACKET').length===1,'PAIR_PACKET_REQUIRED');const pair=of('PAIR_PACKET')[0].value;\n",
      "      requireEvidence(equal(pair.identity,q.identity)&&pair.identitySha256===q.identitySha256,'PAIR_IDENTITY_MISMATCH');\n",
      "      requireEvidence(references.length===9&&references[7]?.value.label==='R.BEFORE'&&references[8]?.value.label==='R.AFTER'&&equal(references[7].value,pair.R)&&equal(references[8].value,pair.Rafter)&&of('CANDIDATE_RECORD').length===1&&equal(of('CANDIDATE_RECORD')[0].value,pair.C),'PAIR_RECORD_CLOSURE_INCOMPLETE');\n",
      "      const judged=judgePair(pair,qualification);\n",
      "      requireEvidence(report.status===judged.status&&report.referenceQualification===judged.referenceQualification&&report.candidateComparison===judged.candidateComparison&&equal(report.assertions,judged.assertions)&&equal(report.qualification,qualification)&&report.semanticAssertions===judged.assertions.length&&report.referenceExecutions===[...q.records,pair.R,pair.Rafter].filter(r=>r.carrierPid).length&&report.candidateExecutions===(pair.C?.carrierPid?1:0),'PAIR_JUDGMENT_MISMATCH');\n",
      "      expectedKinds.push('REFERENCE_RECORD','CANDIDATE_RECORD','REFERENCE_RECORD','PAIR_PACKET');\n",
      "    }\n",
      "    expectedKinds.push('SYNC_REPORT');\n",
      "  }\n",
      "  requireEvidence(equal(groups.map(g=>g.kind),expectedKinds),'NECESSARY_PACKAGE_CLOSURE_INCOMPLETE');\n",
      "  for(const g of [...references,...of('CANDIDATE_RECORD')])requireEvidence(publicRecordComplete(g.value)&&g.value.sessionId===q.sessionId&&g.value.identitySha256===q.identitySha256,'RECORD_IDENTITY_OR_PUBLIC_TAPE_INCOMPLETE');\n",
      "  const reportGroup=reports[0]||of('REFERENCE_QUALIFICATION')[0];\n",
      "  return {summary,groups,qualification,report:reportGroup.value,reportSha256:reportGroup.sha256};\n",
      "}\n",
      "export function forwardEvidence(stdout,emit=line=>process.stdout.write(line+'\\n')) {\n",
      "  // Preserve partial red originals too, but never return a successful guard for\n",
      "  // their incomplete or corrupt package. The caller must retain the rejection.\n",
      "  let count=0;for(const line of stdout.split('\\n'))if(line.startsWith(marker)){emit(line);count++;}\n",
      "  validateEvidenceClosure(stdout);return count;\n",
      "}\n",
      "export function parseSummary(stdout){return validateEvidenceClosure(stdout).summary;}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/src/judge.mjs", sha256: "ceba688457e6e9ea988bad5182a2bd898c44c72c217fb0e1bdf4cf4aa8d9242f", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/src/judge.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/src/judge.mjs"
    body: [
      "// Independent public-contract judgments. No production imports or execution.\n",
      "import {createHash} from 'node:crypto';\n",
      "const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');\n",
      "export const version = 'sync-self-term-v4.3.1.platform-qualified';\n",
      "export const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);\n",
      "export const rawZero = {status:0,signal:null,error:null};\n",
      "export function rawValid(r) { return r && Object.keys(r).sort().join(',')==='error,signal,status' && (r.status===null||Number.isInteger(r.status)) && (r.signal===null||typeof r.signal==='string') && r.error===null && ((r.status===null)!==(r.signal===null)); }\n",
      "const row = (label,ok,expected,actual) => ({label:'N.SYNC_SELF_TERM.'+label,status:ok?'PASS':'FAIL',expected,actual});\n",
      "export function businessResult(r) { if(!r?.result)return null;const {pid,ppid,threadId,isMainThread,...rest}=r.result;return rest; }\n",
      "export const vector = r => ({raw:r.raw,entryHooks:r.entryHooks,businessResult:businessResult(r),stderrBase64:r.stderrBase64});\n",
      "export function wiring(r,mode) {\n",
      "  return !!(r && !r.infrastructureError && !r.productPrecondition && rawValid(r.raw) && r.closeBeforeCleanup && r.residual?.length===0 && !r.cleanupAfterObservation && r.entryBoot && r.resultCount===1 && r.result?.threadId===0 && r.result?.isMainThread===true && r.result?.unit==='main-alpha' && r.result?.fingerprint===r.expected?.entryFingerprint && r.result?.entryURL===r.expected?.entryURL && equal(r.result?.args,r.expected?.args) && r.result?.cwd===r.expected?.cwd && r.result?.execPath===r.expected?.node && r.result?.env===r.expected?.envToken && r.entryPid===r.result?.pid && r.entryPid!==r.carrierPid && r.observerEntryPpid===r.carrierPid && r.noConfigProof?.at(-1)?.directory==='/' && r.sourceBefore && ['main','state','ownerPackage','ownerConfig','observer'].every(k=>/^[a-f0-9]{64}$/.test(r.sourceBefore[k]||'')) && equal(r.sourceBefore,r.sourceAfter) && Array.isArray(r.entryHooks) && (mode!=='term'||(r.ready?.pid===r.entryPid && r.ready?.threadId===0 && r.ready?.isMainThread===true && r.ready?.sourceFingerprint===r.expected?.sourceFingerprint && r.ready?.fingerprint===r.expected?.entryFingerprint && r.proof?.entryPid===r.entryPid && r.proof?.isolatedPgid===r.carrierPid && r.proof?.dispatch==='synchronous entry module evaluation after go')));\n",
      "}\n",
      "export function judgeQualification(packet) {\n",
      "  const a=[];const identity=packet?.identity;\n",
      "  const seq=packet?.records||[];\n",
      "  const labels=['R.CONTROL_BEFORE',...Array.from({length:5},(_,i)=>'R.SYNC.'+(i+1)),'R.CONTROL_AFTER'];\n",
      "  a.push(row('REFERENCE_IDENTITY',!!identity&&identity.version===version&&['linux','darwin'].includes(identity.platform)&&['x64','arm64'].includes(identity.arch)&&identity.nodeVersion?.startsWith('v22.')&&!!identity.nodeBinarySha256&&!!identity.publicSources&&!!identity.sourceHashes&&!!identity.envIdentitySha256&&packet.identitySha256===digest(identity),'exact Node/platform/arch/public source/input/env/wiring receipt',identity));\n",
      "  a.push(row('REFERENCE_SEQUENCE',equal(seq.map(r=>r.label),labels)&&seq.every(r=>r.origin==='LIVE_PUBLIC_CLI'&&r.identitySha256===packet.identitySha256&&equal(r.sourceBefore,identity?.sourceHashes))&&new Set(seq.map(r=>r.carrierPid)).size===7&&new Set(seq.map(r=>r.entryPid)).size===7,'control + 5 independent live R + control, one identity',seq.map(r=>({label:r.label,origin:r.origin,identitySha256:r.identitySha256}))));\n",
      "  for(let i=0;i<labels.length;i++)a.push(row('REFERENCE_WIRING.'+labels[i],wiring(seq[i],i===0||i===6?'0':'term'),'actual entry/observer/no-config/close/group/source proof',seq[i]||null));\n",
      "  const controls=[seq[0],seq[6]];\n",
      "  a.push(row('REFERENCE_CONTROL',controls.every(r=>r&&equal(r.raw,rawZero)&&equal(r.entryHooks,[{code:0}])),'same-wiring actual entry hook0 before and after selfTERM',controls.map(r=>({raw:r?.raw,hooks:r?.entryHooks,boot:r?.entryBoot}))));\n",
      "  const terms=seq.slice(1,6);\n",
      "  a.push(row('REFERENCE_STABLE',terms.length===5&&terms.every(r=>equal(vector(r),vector(terms[0]))),'all 5 literal raw/hooks/result/stderr vectors identical; no selecting/retrying',terms.map(vector)));\n",
      "  if(identity?.platform==='darwin')a.push(row('KNOWN_CLI_ZERO.REFERENCE',terms.length===5&&terms.every(r=>equal(r.raw,rawZero)),'Darwin original raw0/null/null preserved',terms.map(r=>r.raw)));\n",
      "  const complete=seq.length===7;\n",
      "  const status=!complete?'INCOMPLETE':a.every(x=>x.status==='PASS')?'QUALIFIED':'FAILED';\n",
      "  return {version,status,assertions:a,identity,identitySha256:packet?.identitySha256,referenceVector:status==='QUALIFIED'?vector(terms[0]):null,referenceAttempts:seq.length,referenceExecutions:seq.filter(r=>r.carrierPid).length,linuxSampleCount:identity?.platform==='linux'?seq.filter(r=>/^R\\.SYNC\\./.test(r.label||'')).length:0};\n",
      "}\n",
      "export function canStartCandidate(R,qualification,identity,identitySha256){\n",
      "  return qualification?.status==='QUALIFIED'&&equal(identity,qualification.identity)&&identitySha256===qualification.identitySha256&&wiring(R,'term')&&R.origin==='LIVE_PUBLIC_CLI'&&R.identitySha256===identitySha256&&equal(R.sourceBefore,identity?.sourceHashes)&&equal(vector(R),qualification.referenceVector);\n",
      "}\n",
      "export function judgePair(packet,qualification) {\n",
      "  // Even an incomplete qualification must not erase a retained pair mismatch.\n",
      "  const {R,C,Rafter,identity,identitySha256}=packet||{};const a=[];\n",
      "  a.push(row('PUBLIC_REFERENCE_QUALIFIED',qualification?.status==='QUALIFIED'&&equal(identity,qualification.identity)&&identitySha256===qualification.identitySha256,'qualified same exact platform/runtime/source/input/env identity',qualification?.status||'MISSING'));\n",
      "  a.push(row('REFERENCE_CONTINUITY',canStartCandidate(R,qualification,identity,identitySha256)&&canStartCandidate(Rafter,qualification,identity,identitySha256)&&R.carrierPid!==Rafter.carrierPid&&equal(vector(R),vector(Rafter)),'healthy live R-before/R-after unchanged from qualification', {R:R&&vector(R),Rafter:Rafter&&vector(Rafter)}));\n",
      "  const f=C?.factoryObservation;\n",
      "  a.push(row('FACTORY_BINDING',C?.origin==='LIVE_ACTUAL_PUBLIC_FACTORY'&&f?.called===true&&equal(f?.input?.args,[identity?.entry,...(identity?.args||[])])&&f?.input?.cwd===identity?.cwd&&f?.input?.inheritedEnvSha256===identity?.envIdentitySha256&&equal(f?.returnedTuple,C?.command)&&f?.providerBefore&&Object.keys(f.providerBefore).length>0&&equal(f?.providerBefore,f?.providerAfter)&&f?.sourceBefore&&Object.keys(f.sourceBefore).length>0&&equal(f?.sourceBefore,f?.sourceAfter)&&R?.carrierPid!==C?.carrierPid&&C?.carrierPid!==Rafter?.carrierPid,'actual final-args/cwd/env public factory invocation, source/provider bytes stable, fresh C process',f||null));\n",
      "  a.push(row('ENTRY_READY',wiring(C,'term')&&C.identitySha256===identitySha256&&equal(C.sourceBefore,identity?.sourceHashes),'real entry ready, observer boot, source and result identity/topology',C||null));\n",
      "  a.push(row('RAW',!!R&&!!C&&rawValid(R.raw)&&rawValid(C.raw)&&equal(C.raw,R.raw),'candidate literal raw equals live public CLI raw',{R:R?.raw,C:C?.raw}));\n",
      "  a.push(row('HOOKS',!!R&&!!C&&Array.isArray(C.entryHooks)&&Array.isArray(R.entryHooks)&&equal(C.entryHooks,R.entryHooks),'actual entry-only ordered hook codes C=R',{R:R?.entryHooks,C:C?.entryHooks}));\n",
      "  if(identity?.platform==='darwin')a.push(row('KNOWN_CLI_ZERO',!!R&&!!C&&equal(R.raw,rawZero)&&equal(C.raw,rawZero),'Darwin original raw0/null/null preserved',{R:R?.raw,C:C?.raw}));\n",
      "  a.push(row('RESULT',!!R&&!!C&&equal(businessResult(C),businessResult(R)),'original source business result C=live R',{R:businessResult(R),C:businessResult(C)}));\n",
      "  a.push(row('STDERR',!!R&&!!C&&typeof R.stderrBase64==='string'&&C.stderrBase64===R.stderrBase64,'stderr raw bytes equal live public CLI',{R:R?.stderrBase64,C:C?.stderrBase64}));\n",
      "  a.push(row('NO_ORPHANS',[R,C,Rafter].every(r=>r&&r.residual?.length===0&&r.closeBeforeCleanup&&!r.cleanupAfterObservation),'all actual groups/stdio completed before any cleanup',[R,C,Rafter].map(r=>({residual:r?.residual,close:r?.closeBeforeCleanup,cleanup:r?.cleanupAfterObservation}))));\n",
      "  const semantic=a.filter(r=>!r.label.includes('PUBLIC_REFERENCE_QUALIFIED')&&!r.label.includes('REFERENCE_CONTINUITY'));\n",
      "  return {version,status:a.every(x=>x.status==='PASS')?'PASS':'FAIL',referenceQualification:qualification?.status||'INCOMPLETE',candidateComparison:!C?'NOT_RUN':semantic.some(x=>x.status==='FAIL')?'FAIL':a.slice(0,2).every(x=>x.status==='PASS')?'PASS':'INVALID',assertions:a};\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/src/prepare-fixture.mjs", sha256: "e556b89fcfb7942519cd4cd3282e4ed3bb9397438512167c531c4fba4f8d1b04", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/src/prepare-fixture.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/src/prepare-fixture.mjs"
    body: [
      "// Test-only, explicit fresh fixture root. Does not read any production source.\n",
      "import fs from 'node:fs';\n",
      "import path from 'node:path';\n",
      "import {fileURLToPath} from 'node:url';\n",
      "const input=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../inputs');\n",
      "const root=path.resolve(process.argv[2]);if(fs.existsSync(root))throw new Error('fixture root must be fresh');\n",
      "fs.mkdirSync(path.join(root,'owner/scripts'),{recursive:true});\n",
      "fs.mkdirSync(path.join(root,'no-config/leaf'),{recursive:true});\n",
      "for(const f of ['main-alpha.ts','state-beta.ts'])fs.copyFileSync(path.join(input,f),path.join(root,'owner/scripts',f));\n",
      "for(const f of ['package.json','tsconfig.json'])fs.copyFileSync(path.join(input,f),path.join(root,'owner',f));\n",
      "console.log(JSON.stringify({entry:path.join(root,'owner/scripts/main-alpha.ts'),cwd:path.join(root,'no-config/leaf')}));\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/src/qualify.mjs", sha256: "85e2b09ea66cf568c42a4692fbf688cc797ae5e6298baa7d49d960ffb28c6d2b", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/src/qualify.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/src/qualify.mjs"
    body: [
      "// R-only qualification plus the finite sync measurement shared by the same-slot runner.\n",
      "// This module has no production import; standalone qualification rejects C inputs.\n",
      "import fs from 'node:fs';\n",
      "import path from 'node:path';\n",
      "import crypto from 'node:crypto';\n",
      "import {createRequire} from 'node:module';\n",
      "import {fileURLToPath,pathToFileURL} from 'node:url';\n",
      "import {spawn,spawnSync} from 'node:child_process';\n",
      "import {bindNode22} from '../binding/node-binding.mjs';\n",
      "import {version,judgeQualification} from './judge.mjs';\n",
      "import {sha,emitEvidence} from './evidence.mjs';\n",
      "const here=path.dirname(fileURLToPath(import.meta.url));const base=path.dirname(here);\n",
      "const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));\n",
      "const hash=f=>sha(fs.readFileSync(f));\n",
      "const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);\n",
      "const active=r=>!r.stat.startsWith('Z');\n",
      "const ps=()=>{const r=spawnSync('/bin/ps',['-axo','pid=,ppid=,pgid=,stat='],{encoding:'utf8'});if(r.error||r.status)throw new Error('ps infrastructure unavailable');return r.stdout.split('\\n').map(l=>l.trim().split(/\\s+/)).filter(v=>v.length===4).map(([pid,ppid,pgid,stat])=>({pid:+pid,ppid:+ppid,pgid:+pgid,stat}));};\n",
      "const rows=f=>{if(!fs.existsSync(f))return [];const s=fs.readFileSync(f,'utf8');if(s&&!s.endsWith('\\n'))throw new Error('incomplete final observer record');return s.split('\\n').filter(Boolean).map(JSON.parse);};\n",
      "const stableObject=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));\n",
      "function treeHashes(root){const out={};function visit(dir){for(const n of fs.readdirSync(dir).sort()){if(n==='node_modules')continue;const f=path.join(dir,n),s=fs.lstatSync(f);if(s.isDirectory())visit(f);else if(s.isFile())out[path.relative(root,f)]=hash(f);else if(s.isSymbolicLink())out[path.relative(root,f)]={link:fs.readlinkSync(f),resolved:hash(fs.realpathSync(f))};}}visit(root);return out;}\n",
      "function sourceFiles(entry){return {main:entry,state:path.join(path.dirname(entry),'state-beta.ts'),ownerPackage:path.join(path.dirname(entry),'../package.json'),ownerConfig:path.join(path.dirname(entry),'../tsconfig.json'),observer:path.join(base,'inputs/boundary-observer.mjs')};}\n",
      "const sourceSnapshot=files=>Object.fromEntries(Object.entries(files).map(([k,f])=>{try{return [k,hash(f)];}catch(e){return [k,'UNAVAILABLE:'+e.code];}}));\n",
      "function noConfig(cwd){let d=fs.realpathSync(cwd);const proof=[];for(;;){try{fs.lstatSync(path.join(d,'tsconfig.json'));throw new Error('configured cwd ancestor');}catch(e){if(e.code!=='ENOENT')throw e;}proof.push({directory:d,tsconfig:'ENOENT'});const p=path.dirname(d);if(p===d)return proof;d=p;}}\n",
      "function assertFrozen(){const manifest=JSON.parse(fs.readFileSync(path.join(base,'freeze-manifest.json'),'utf8'));for(const f of manifest.files)if(hash(path.join(base,f.path))!==f.sha256)throw new Error('frozen member changed '+f.path);}\n",
      "export function assertClearedNodeOptions(env){\n",
      "  if(Object.hasOwn(env,'NODE_OPTIONS'))throw new Error('INHERITED_NODE_OPTIONS_NOT_CLEARED');\n",
      "}\n",
      "export async function createSyncMeasurement(runtime) {\n",
      "  assertFrozen();assertClearedNodeOptions(process.env);if(runtime.producerModuleURL||runtime.apiModuleURL||runtime.syncSelf?.C)throw new Error('R-only qualification rejects any candidate provider/tuple');\n",
      "  const binding=await bindNode22(runtime);if(binding.status!=='VALID_TOOL_BINDING')throw new Error('Node binding invalid: '+binding.reason);\n",
      "  const entry=fs.realpathSync(runtime.entry);const cwd=fs.realpathSync(runtime.cwd);const files=sourceFiles(entry);const sourceHashes=sourceSnapshot(files);\n",
      "  const frozenSource={main:hash(path.join(base,'inputs/main-alpha.ts')),state:hash(path.join(base,'inputs/state-beta.ts')),ownerPackage:hash(path.join(base,'inputs/package.json')),ownerConfig:hash(path.join(base,'inputs/tsconfig.json')),observer:hash(path.join(base,'inputs/boundary-observer.mjs'))};if(!eq(sourceHashes,frozenSource))throw new Error('input bytes differ from original frozen sync source');\n",
      "  const require=createRequire(path.join(runtime.publicResolutionOwner,'package.json'));const cli=require.resolve('tsx/cli');if(cli!==runtime.publicCli)throw new Error('public CLI mismatch');\n",
      "  const tsxPkg=require.resolve('tsx/package.json');const er=createRequire(tsxPkg);const esbuildPkg=er.resolve('esbuild/package.json');const br=createRequire(esbuildPkg);const platformBin=br.resolve('@esbuild/'+process.platform+'-'+process.arch+'/bin/esbuild');\n",
      "  const publicSources=()=>({tsxPackage:hash(tsxPkg),tsxTree:treeHashes(path.dirname(tsxPkg)),esbuildPackage:hash(esbuildPkg),esbuildTree:treeHashes(path.dirname(esbuildPkg)),platformBin:{path:platformBin,sha256:hash(platformBin)},cli:{path:cli,sha256:hash(cli)},tsxRoot:{path:require.resolve('tsx'),sha256:hash(require.resolve('tsx'))}});\n",
      "  const inherited={...process.env,...runtime.baseEnv};for(const key of runtime.unsetEnv||[])delete inherited[key];assertClearedNodeOptions(inherited);if(Object.hasOwn(inherited,'TSX_TSCONFIG_PATH')||/tsx|no-experimental-strip-types/.test(inherited.NODE_OPTIONS||'')||inherited.KOL_PREBUILT==='0')throw new Error('environment outside N domain');\n",
      "  const envIdentitySha256=sha(JSON.stringify(stableObject(inherited)));const identity={version,node:runtime.node,nodeVersion:process.version,platform:process.platform,arch:process.arch,nodeBinarySha256:hash(runtime.node),publicSources:publicSources(),sourceHashes,entry,cwd,args:['arg-one','arg with space','--literal-script-arg'],envIdentitySha256,boundaryObserverURL:pathToFileURL(files.observer).href};\n",
      "  const identitySha256=sha(JSON.stringify(identity));const out=path.join(runtime.outputRoot,'sync43-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(out,{recursive:true});\n",
      "  const packet={version,sessionId:path.basename(out),identity,identitySha256,nodeBinding:binding,retention:{publicEvidence:'COMPLETE_SHA_CHECKED_STDOUT_PACKET',inheritedEnvInStdout:'HASH_AND_CONTROLLED_VALUES_ONLY',privateEnvPersistence:'LOCAL_DIAGNOSTIC_ONLY_NOT_ASSERTED_IN_CI',qualificationRequiresPersistentPrivateEnv:false},records:[],toolOnly:false,output:out};\n",
      "  const expected={entryFingerprint:'b5ab0823b19a40c1c2ff3c6a55b29d47f8acc9f2b2e428c93602140138f104f2',sourceFingerprint:'750b927dbce742e64e7ffc4c798cd54a1366e2ab3d73a7704a5bfd5598913731',entryURL:pathToFileURL(entry).href,args:identity.args,cwd,node:runtime.node,envToken:'contract-v3-env-token-671'};\n",
      "  async function one(label,mode,actualFactory=null){\n",
      "    const dir=path.join(out,label);fs.mkdirSync(dir);const logs=Object.fromEntries(['ready','go','boundary','eval'].map(k=>[k,path.join(dir,k+'.jsonl')]));const token=crypto.randomBytes(12).toString('hex');\n",
      "    const env={...inherited,PROFILE_EXIT:mode,CI_PROFILE_TOKEN:expected.envToken,PROFILE_EVAL_LOG:logs.eval,CONTRACT_BOUNDARY_LOG:logs.boundary,CONTRACT_SYNC_READY:logs.ready,CONTRACT_SYNC_GO:logs.go,CONTRACT_SYNC_TOKEN:token};env.NODE_OPTIONS='--import='+identity.boundaryObserverURL;\n",
      "    let command=[runtime.node,[cli,entry,...identity.args]];const r={label,sessionId:packet.sessionId,origin:actualFactory?'LIVE_ACTUAL_PUBLIC_FACTORY':'LIVE_PUBLIC_CLI',identitySha256,expected,command,envControlled:{PROFILE_EXIT:mode,CI_PROFILE_TOKEN:expected.envToken,PROFILE_EVAL_LOG:logs.eval,CONTRACT_BOUNDARY_LOG:logs.boundary,CONTRACT_SYNC_READY:logs.ready,CONTRACT_SYNC_GO:logs.go,CONTRACT_SYNC_TOKEN:token,NODE_OPTIONS:env.NODE_OPTIONS},effectiveEnvSha256:sha(JSON.stringify(stableObject(env))),inheritedEnvSha256:envIdentitySha256,sourceBefore:sourceSnapshot(files),raw:null,ready:null,proof:null,infrastructureError:null,productPrecondition:null};\n",
      "    fs.writeFileSync(path.join(dir,'effective-env.private.json'),JSON.stringify(stableObject(env))+'\\n',{mode:0o600});r.privateEnvFile=path.join(dir,'effective-env.private.json');let child,isolated=false,ownPgid,close=false;const stdout=[],stderr=[];\n",
      "    try{\n",
      "      r.noConfigProof=noConfig(cwd);ownPgid=ps().find(p=>p.pid===process.pid)?.pgid;if(!ownPgid)throw new Error('runner PGID absent');\n",
      "      if(actualFactory){const preEnv=JSON.stringify(stableObject(env));command=await actualFactory(env,r);if(preEnv!==JSON.stringify(stableObject(env)))throw new Error('factory mutated final R/C environment');r.command=command;if(!Array.isArray(command)||command[0]!==runtime.node||!Array.isArray(command[1])||!eq(command[1].slice(-identity.args.length-1),[entry,...identity.args]))throw new Error('actual final factory tuple/node/suffix invalid');}\n",
      "      child=spawn(command[0],command[1],{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});r.carrierPid=child.pid;\n",
      "      child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));child.once('error',e=>r.raw={status:null,signal:null,error:e.code});child.once('exit',(status,signal)=>r.raw={status,signal,error:null});child.once('close',()=>close=true);\n",
      "      const at=Date.now();while(Date.now()-at<5000&&!r.raw){const table=ps(),carrier=table.find(p=>p.pid===child.pid);if(carrier){if(carrier.pgid!==child.pid||carrier.pgid===ownPgid)throw new Error('isolation proof failed');isolated=true;}if(mode==='term'){\n",
      "        // Incomplete append is not final corruption while the writer is live.\n",
      "        let ready=[];if(fs.existsSync(logs.ready)){const text=fs.readFileSync(logs.ready,'utf8');if(text.endsWith('\\n'))ready=text.split('\\n').filter(Boolean).map(JSON.parse);}if(ready.length>1)throw new Error('duplicate ready');if(ready[0]){const q=ready[0],entryRow=table.find(p=>p.pid===q.pid);if(q.token!==token||q.fingerprint!==expected.entryFingerprint||q.sourceFingerprint!==expected.sourceFingerprint||q.threadId!==0||q.isMainThread!==true||!entryRow||entryRow.pgid!==child.pid||q.pid===child.pid||entryRow.ppid!==child.pid){r.productPrecondition='actual entry ready identity/topology invalid';break;}r.ready=q;const fresh=ps();if(!isolated||fresh.find(p=>p.pid===process.pid)?.pgid!==ownPgid||child.pid===ownPgid||!fresh.some(p=>p.pid===q.pid&&p.pgid===child.pid&&active(p)))throw new Error('self-signal safety proof failed');r.proof={runnerPid:process.pid,runnerPgid:ownPgid,isolatedPgid:child.pid,entryPid:q.pid,signal:'SIGTERM',dispatch:'synchronous entry module evaluation after go',members:fresh.filter(p=>p.pgid===child.pid)};const temp=logs.go+'.tmp';fs.writeFileSync(temp,JSON.stringify({token})+'\\n');fs.renameSync(temp,logs.go);break;}}\n",
      "        await sleep(5);\n",
      "      }\n",
      "      if(mode==='term'&&!r.ready)r.productPrecondition||='no qualified ready before self signal';const settled=Date.now();while(Date.now()-settled<5000){if(r.raw&&close&&!ps().some(p=>p.pgid===child.pid&&active(p)))break;await sleep(5);}r.residual=ps().filter(p=>p.pgid===child.pid&&active(p));r.closeBeforeCleanup=close;\n",
      "      if(r.residual.length){if(!isolated||ps().find(p=>p.pid===process.pid)?.pgid!==ownPgid||child.pid===ownPgid)throw new Error('cleanup proof unavailable');r.cleanupAfterObservation=true;process.kill(-child.pid,'SIGKILL');const t=Date.now();while(Date.now()-t<2000&&ps().some(p=>p.pgid===child.pid&&active(p)))await sleep(5);if(ps().some(p=>p.pgid===child.pid&&active(p)))throw new Error('cleanup failed');}\n",
      "      const boundary=rows(logs.boundary);r.boundary=boundary;r.boundaryBase64=fs.existsSync(logs.boundary)?fs.readFileSync(logs.boundary).toString('base64'):null;r.evaluation=rows(logs.eval);const text=Buffer.concat(stdout).toString('utf8');const results=text.split('\\n').filter(l=>l.startsWith('@@RESULT@@')).map(l=>JSON.parse(l.slice(10)));r.resultCount=results.length;r.result=results[0]||null;r.entryPid=r.result?.pid;const boots=boundary.filter(e=>e.kind==='boundary-boot'&&e.pid===r.entryPid&&e.threadId===0&&e.isMainThread===true&&e.fingerprint==='681c0a435ec9f73847ff726047172fce83c5ca4f1863f18cc1bd497dfd987b21');r.entryBoot=boots.length===1;r.observerEntryPpid=boots[0]?.ppid;r.entryHooks=boundary.filter(e=>e.kind==='boundary-exit-hook'&&e.pid===r.entryPid&&e.threadId===0&&e.isMainThread===true).map(({code})=>({code}));\n",
      "    }catch(e){r.infrastructureError=e.message;try{if(isolated&&child?.pid!==ownPgid&&ps().find(p=>p.pid===process.pid)?.pgid===ownPgid)process.kill(-child.pid,'SIGKILL');}catch{}}\n",
      "    r.stdoutBase64=Buffer.concat(stdout).toString('base64');r.stderrBase64=Buffer.concat(stderr).toString('base64');r.sourceAfter=sourceSnapshot(files);if(actualFactory?.after)try{await actualFactory.after(r);}catch(e){r.infrastructureError||='factory final binding unavailable: '+e.message;}try{if(!eq(publicSources(),identity.publicSources)||hash(runtime.node)!==identity.nodeBinarySha256)r.infrastructureError||='public reference/runtime bytes changed';}catch(e){r.infrastructureError||='public reference final binding unavailable: '+e.message;}fs.writeFileSync(path.join(dir,'record.json'),JSON.stringify(r,null,2)+'\\n');emitEvidence(actualFactory?'CANDIDATE_RECORD':'REFERENCE_RECORD',label,r);return r;\n",
      "  }\n",
      "  async function finishQualification(){const labels=['R.CONTROL_BEFORE',...Array.from({length:5},(_,i)=>'R.SYNC.'+(i+1)),'R.CONTROL_AFTER'];for(let i=0;i<labels.length;i++)packet.records.push(await one(labels[i],i===0||i===6?'0':'term'));\n",
      "  packet.qualification=judgeQualification(packet);fs.writeFileSync(path.join(out,'qualification.json'),JSON.stringify(packet,null,2)+'\\n');emitEvidence('REFERENCE_QUALIFICATION',identitySha256,packet);return packet;}\n",
      "  return {packet,one,finishQualification};\n",
      "}\n",
      "export async function collectQualification(runtime){const context=await createSyncMeasurement(runtime);return context.finishQualification();}\n",
      "if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){\n",
      "  try{const runtime=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const packet=await collectQualification(runtime);console.log(JSON.stringify({status:packet.qualification.status,referenceExecutions:packet.records.filter(r=>r.carrierPid).length,semanticCandidateAssertions:0,report:path.join(packet.output,'qualification.json')}));process.exitCode=packet.qualification.status==='QUALIFIED'?0:1;}catch(e){emitEvidence('REFERENCE_INVALID','invalid',{status:'INVALID',referenceExecutions:'UNKNOWN',semanticCandidateAssertions:0,reason:e.message});process.exitCode=2;}\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/src/run.mjs", sha256: "d900b4333866658a740f4c49125e0913e93f3a87868e1afdaa7000352ec237c2", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/src/run.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/src/run.mjs"
    body: [
      "// Same existing sync/run slot: one outer tool process. No target starts until\n",
      "// complete public R-only qualification. Candidate source is only hashed/imported\n",
      "// by its existing opaque public API; no semantic body reads.\n",
      "import fs from 'node:fs';\n",
      "import path from 'node:path';\n",
      "import {fileURLToPath} from 'node:url';\n",
      "import {createSyncMeasurement} from './qualify.mjs';\n",
      "import {judgePair,canStartCandidate} from './judge.mjs';\n",
      "import {sha,emitEvidence} from './evidence.mjs';\n",
      "const hash=f=>sha(fs.readFileSync(f));\n",
      "const here=path.dirname(fileURLToPath(import.meta.url));\n",
      "const runtime=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));\n",
      "let output,referenceExecutions=0,candidateExecutions=0;\n",
      "try{\n",
      "  // Binding/qualification cannot consult a candidate, even in the combined slot.\n",
      "  const publicRuntime={...runtime};delete publicRuntime.producerModuleURL;delete publicRuntime.apiModuleURL;delete publicRuntime.syncSelf;\n",
      "  const context=await createSyncMeasurement(publicRuntime);output=context.packet.output;\n",
      "  const qualificationPacket=await context.finishQualification();referenceExecutions=qualificationPacket.records.filter(r=>r.carrierPid).length;\n",
      "  if(qualificationPacket.qualification.status!=='QUALIFIED'){\n",
      "    const report={kind:'SYNC_SELF_TERM_V43',status:'INVALID',semanticAssertions:0,assertions:qualificationPacket.qualification.assertions,referenceQualification:qualificationPacket.qualification.status,candidateComparison:'NOT_RUN',referenceExecutions,candidateExecutions,reason:'public R qualification did not open C window',qualification:qualificationPacket.qualification};\n",
      "    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\\n');emitEvidence('SYNC_REPORT','qualification-blocked',report);console.log(JSON.stringify({status:report.status,semanticAssertions:0,report:path.join(output,'report.json'),infrastructureError:report.reason}));process.exitCode=2;\n",
      "  }else if(runtime.referenceOnly===true){\n",
      "    const report={kind:'SYNC_SELF_TERM_V43_R_ONLY',status:'REFERENCE_QUALIFIED',referenceQualification:'QUALIFIED',candidateComparison:'NOT_RUN',referenceExecutions,candidateExecutions,semanticAssertions:0,assertions:qualificationPacket.qualification.assertions};\n",
      "    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\\n');emitEvidence('SYNC_REPORT','reference-only',report);console.log(JSON.stringify({status:report.status,semanticAssertions:0,report:path.join(output,'report.json'),infrastructureError:null}));\n",
      "  }else{\n",
      "    if(!runtime.producerModuleURL)throw new Error('actual public factory provider missing; no C tuple synthesized');\n",
      "    const R=await context.one('R.BEFORE','term');referenceExecutions+=R.carrierPid?1:0;if(!canStartCandidate(R,qualificationPacket.qualification,context.packet.identity,context.packet.identitySha256))throw new Error('R-before continuity failed; C not started');\n",
      "    const bindingFiles=()=>{const files={provider:fileURLToPath(runtime.producerModuleURL),...runtime.producerBindingFiles};for(const d of runtime.producerPayloadDirectories||[])if(fs.existsSync(d))for(const n of fs.readdirSync(d))if(n.endsWith('.js'))files['payload:'+path.join(d,n)]=path.join(d,n);return Object.fromEntries(Object.entries(files).map(([k,f])=>[k,{file:f,sha256:fs.existsSync(f)?hash(f):null}]));};\n",
      "    const sourceFiles=()=>Object.fromEntries(Object.keys(runtime.producerSourceHashes||{}).map(f=>[f,hash(f)]));\n",
      "    const factory=async(env,r)=>{\n",
      "      const sourceBefore=sourceFiles();if(Object.keys(sourceBefore).length===0)throw new Error('factory source binding absent');for(const [f,want]of Object.entries(runtime.producerSourceHashes))if(sourceBefore[f]!==want)throw new Error('factory source binding changed before C');\n",
      "      r.factoryObservation={called:false,input:{args:[context.packet.identity.entry,...context.packet.identity.args],cwd:context.packet.identity.cwd,inheritedEnvSha256:context.packet.identity.envIdentitySha256,NODE_OPTIONS:env.NODE_OPTIONS,effectiveEnvSha256:r.effectiveEnvSha256},providerBefore:bindingFiles(),sourceBefore};\n",
      "      const provider=await import(runtime.producerModuleURL);if(typeof provider.prebuiltCommand!=='function')throw new Error('public prebuiltCommand absent');\n",
      "      const tuple=provider.prebuiltCommand(r.factoryObservation.input.args,r.factoryObservation.input.cwd,env);r.factoryObservation.called=true;r.factoryObservation.returnedTuple=tuple;return tuple;\n",
      "    };\n",
      "    factory.after=async r=>{if(r.factoryObservation){r.factoryObservation.providerAfter=bindingFiles();r.factoryObservation.sourceAfter=sourceFiles();}};\n",
      "    const C=await context.one('C','term',factory);candidateExecutions+=C.carrierPid?1:0;\n",
      "    const Rafter=await context.one('R.AFTER','term');referenceExecutions+=Rafter.carrierPid?1:0;\n",
      "    const pair={version:context.packet.version,identity:context.packet.identity,identitySha256:context.packet.identitySha256,R,C,Rafter};\n",
      "    fs.writeFileSync(path.join(output,'pair.json'),JSON.stringify(pair,null,2)+'\\n');const report=judgePair(pair,qualificationPacket.qualification);report.kind='SYNC_SELF_TERM_V43';report.referenceExecutions=referenceExecutions;report.candidateExecutions=candidateExecutions;report.semanticAssertions=report.assertions.length;report.qualification=qualificationPacket.qualification;\n",
      "    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\\n');emitEvidence('PAIR_PACKET','current',pair);emitEvidence('SYNC_REPORT','current',report);console.log(JSON.stringify({status:report.status,semanticAssertions:report.semanticAssertions,report:path.join(output,'report.json'),infrastructureError:null}));process.exitCode=report.status==='PASS'?0:1;\n",
      "  }\n",
      "}catch(e){const report={kind:'SYNC_SELF_TERM_V43',status:'INVALID',semanticAssertions:0,assertions:[],referenceExecutions:referenceExecutions||'UNKNOWN',candidateExecutions:candidateExecutions||'UNKNOWN',infrastructureError:e.message};if(output)fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\\n');emitEvidence('SYNC_REPORT','invalid',report);console.log(JSON.stringify({status:'INVALID',semanticAssertions:0,report:output?path.join(output,'report.json'):null,infrastructureError:e.message}));process.exitCode=2;}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/src/tool-selftest.mjs", sha256: "115a0baa7be35b6fbef5539f51eb8f40d96dde28ce3166e78722f1dcb2311502", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/src/tool-selftest.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/src/tool-selftest.mjs"
    body: [
      "// Synthetic contract/negative tests only. Never execute a public target or C.\n",
      "import assert from 'node:assert/strict';\n",
      "import {version,judgeQualification,judgePair,canStartCandidate,wiring,vector,equal} from './judge.mjs';\n",
      "import {sha,emitEvidence,decodeEvidence,forwardEvidence,parseSummary,validateEvidenceClosure,marker} from './evidence.mjs';\n",
      "import {assertClearedNodeOptions,createSyncMeasurement} from './qualify.mjs';\n",
      "const clone=x=>JSON.parse(JSON.stringify(x));\n",
      "const sourceHashes=Object.fromEntries(['main','state','ownerPackage','ownerConfig','observer'].map(k=>[k,'a'.repeat(64)]));\n",
      "function packet(platform='linux',raw={status:143,signal:null,error:null},hooks=[]){\n",
      "  const identity={version,platform,arch:'x64',nodeVersion:'v22.23.3',node:'/synthetic/node',nodeBinarySha256:'b'.repeat(64),publicSources:{cli:{path:'/synthetic/public-cli',sha256:'c'.repeat(64)}},sourceHashes,envIdentitySha256:'d'.repeat(64),entry:'/synthetic/owner/scripts/main-alpha.ts',cwd:'/synthetic/no-config/leaf',args:['arg-one','arg with space','--literal-script-arg']};\n",
      "  const identitySha256=sha(JSON.stringify(identity));const labels=['R.CONTROL_BEFORE',...Array.from({length:5},(_,i)=>'R.SYNC.'+(i+1)),'R.CONTROL_AFTER'];\n",
      "  const records=labels.map((label,i)=>{const expected={node:identity.node,cwd:identity.cwd,args:identity.args,entryURL:'file://'+identity.entry,envToken:'synthetic-token',entryFingerprint:'synthetic-entry',sourceFingerprint:'synthetic-source'};const entryPid=1001+i*2,carrierPid=1000+i*2;return {label,origin:'LIVE_PUBLIC_CLI',identitySha256,expected,carrierPid,entryPid,observerEntryPpid:carrierPid,raw:i===0||i===6?{status:0,signal:null,error:null}:raw,entryHooks:i===0||i===6?[{code:0}]:hooks,resultCount:1,result:{pid:entryPid,threadId:0,isMainThread:true,unit:'main-alpha',fingerprint:expected.entryFingerprint,entryURL:expected.entryURL,args:expected.args,cwd:expected.cwd,execPath:expected.node,env:expected.envToken},entryBoot:true,noConfigProof:[{directory:identity.cwd,tsconfig:'ENOENT'},{directory:'/',tsconfig:'ENOENT'}],ready:{pid:entryPid,threadId:0,isMainThread:true,sourceFingerprint:expected.sourceFingerprint,fingerprint:expected.entryFingerprint},proof:{entryPid,isolatedPgid:carrierPid,dispatch:'synchronous entry module evaluation after go'},sourceBefore:sourceHashes,sourceAfter:sourceHashes,closeBeforeCleanup:true,residual:[],stderrBase64:''};});const sessionId='synthetic-'+platform;\n",
      "  for(const r of records){r.sessionId=sessionId;r.command=[identity.node,['/synthetic/public-cli',identity.entry,...identity.args]];r.stdoutBase64=Buffer.from('@@RESULT@@'+JSON.stringify(r.result)+'\\n').toString('base64');r.boundary=[{kind:'boundary-boot',pid:r.entryPid,ppid:r.carrierPid},...r.entryHooks.map(h=>({kind:'boundary-exit-hook',pid:r.entryPid,...h}))];r.boundaryBase64=Buffer.from(r.boundary.map(x=>JSON.stringify(x)+'\\n').join('')).toString('base64');r.evaluation=[{kind:'eval',pid:r.entryPid}];r.envControlled={NODE_OPTIONS:'--import=file:///synthetic/boundary-observer.mjs'};r.effectiveEnvSha256=sha(JSON.stringify(r.envControlled));r.inheritedEnvSha256=identity.envIdentitySha256;}\n",
      "  return {version,sessionId,identity,identitySha256,records,output:'/synthetic/output',retention:{publicEvidence:'COMPLETE_SHA_CHECKED_STDOUT_PACKET',inheritedEnvInStdout:'HASH_AND_CONTROLLED_VALUES_ONLY',privateEnvPersistence:'LOCAL_DIAGNOSTIC_ONLY_NOT_ASSERTED_IN_CI',qualificationRequiresPersistentPrivateEnv:false}};\n",
      "}\n",
      "function pair(p){const R=clone(p.records[1]),Rafter=clone(p.records[2]),C=clone(p.records[3]);R.label='R.BEFORE';Rafter.label='R.AFTER';C.label='C';C.origin='LIVE_ACTUAL_PUBLIC_FACTORY';C.command=[p.identity.node,['/synthetic/candidate',p.identity.entry,...p.identity.args]];C.factoryObservation={called:true,input:{args:[p.identity.entry,...p.identity.args],cwd:p.identity.cwd,inheritedEnvSha256:p.identity.envIdentitySha256},returnedTuple:C.command,providerBefore:{sha256:'opaque-provider'},providerAfter:{sha256:'opaque-provider'},sourceBefore:{sha256:'opaque-source'},sourceAfter:{sha256:'opaque-source'}};return {identity:p.identity,identitySha256:p.identitySha256,R,C,Rafter};}\n",
      "function transcript(p,isPair=false,candidateMismatch=false){\n",
      "  const q=clone(p);q.qualification=judgeQualification(q);const lines=[];const emit=(kind,id,value)=>emitEvidence(kind,id,value,l=>lines.push(l));\n",
      "  for(const r of q.records)emit('REFERENCE_RECORD',r.label,r);emit('REFERENCE_QUALIFICATION','qualification',q);\n",
      "  let report;\n",
      "  if(isPair){const pa=pair(q);if(candidateMismatch){pa.C.raw={status:0,signal:null,error:null};pa.C.entryHooks=[{code:0}];}report=judgePair(pa,q.qualification);report.kind='SYNC_SELF_TERM_V43';report.referenceExecutions=9;report.candidateExecutions=1;report.semanticAssertions=report.assertions.length;report.qualification=q.qualification;emit('REFERENCE_RECORD','R.BEFORE',pa.R);emit('CANDIDATE_RECORD','C',pa.C);emit('REFERENCE_RECORD','R.AFTER',pa.Rafter);emit('PAIR_PACKET','pair',pa);}\n",
      "  else if(q.qualification.status!=='QUALIFIED')report={kind:'SYNC_SELF_TERM_V43',status:'INVALID',referenceQualification:q.qualification.status,candidateComparison:'NOT_RUN',referenceExecutions:7,candidateExecutions:0,semanticAssertions:0,assertions:q.qualification.assertions,qualification:q.qualification,reason:'public R qualification did not open C window'};\n",
      "  else report={kind:'SYNC_SELF_TERM_V43_R_ONLY',status:'REFERENCE_QUALIFIED',referenceQualification:'QUALIFIED',candidateComparison:'NOT_RUN',referenceExecutions:7,candidateExecutions:0,semanticAssertions:0,assertions:q.qualification.assertions};\n",
      "  emit('SYNC_REPORT','report',report);lines.push(JSON.stringify({status:report.status,semanticAssertions:report.semanticAssertions,report:q.output+'/report.json',infrastructureError:null}));return {lines,stdout:lines.join('\\n'),qualification:q};\n",
      "}\n",
      "const header=line=>line.startsWith(marker)?JSON.parse(line.slice(marker.length)):null;\n",
      "const guardRejects=(stdout,code)=>{const expected=e=>e instanceof Error&&(code?e.message==='SYNC431_EVIDENCE_'+code:e.message.startsWith('SYNC431_EVIDENCE_'));const forwarded=[];assert.throws(()=>forwardEvidence(stdout,l=>forwarded.push(l)),expected);assert.throws(()=>parseSummary(stdout),expected);return forwarded;};\n",
      "const named=(result,label)=>result.assertions.find(a=>a.label==='N.SYNC_SELF_TERM.'+label)?.status;\n",
      "const results=[];function test(name,fn){fn();results.push({label:name,status:'PASS'});}\n",
      "const linux=packet();const lq=judgeQualification(linux);\n",
      "test('synthetic Linux R143 empty-hooks qualifies only as finite R-only model',()=>assert.equal(lq.status,'QUALIFIED'));\n",
      "test('synthetic Linux strict same-window pair passes',()=>assert.equal(judgePair(pair(linux),lq).status,'PASS'));\n",
      "test('RAW and HOOKS both fail for observed mismatch shape',()=>{const p=pair(linux);p.C.raw={status:0,signal:null,error:null};p.C.entryHooks=[{code:0}];const r=judgePair(p,lq);assert.equal(named(r,'RAW'),'FAIL');assert.equal(named(r,'HOOKS'),'FAIL');});\n",
      "test('raw signal cannot be converted to numeric status',()=>{const p=pair(linux);p.C.raw={status:null,signal:'SIGTERM',error:null};assert.equal(named(judgePair(p,lq),'RAW'),'FAIL');});\n",
      "test('single R sample is incomplete and keeps observed RAW HOOKS failures',()=>{const p=clone(linux);p.records=p.records.slice(1,2);const q=judgeQualification(p);assert.equal(q.status,'INCOMPLETE');const c=pair(linux);c.C.raw={status:0,signal:null,error:null};c.C.entryHooks=[{code:0}];const r=judgePair(c,q);assert.equal(r.referenceQualification,'INCOMPLETE');assert.equal(named(r,'RAW'),'FAIL');assert.equal(named(r,'HOOKS'),'FAIL');});\n",
      "test('missing control hooks cannot establish zero-event observation',()=>{const p=clone(linux);p.records[0].entryHooks=[];assert.equal(named(judgeQualification(p),'REFERENCE_CONTROL'),'FAIL');});\n",
      "test('missing target observer boot invalidates measured empty hooks',()=>{const p=clone(linux);p.records[1].entryBoot=false;assert.equal(named(judgeQualification(p),'REFERENCE_WIRING.R.SYNC.1'),'FAIL');});\n",
      "test('replayed same process cannot count as independent runs',()=>{const p=clone(linux);p.records[2].carrierPid=p.records[1].carrierPid;assert.equal(named(judgeQualification(p),'REFERENCE_SEQUENCE'),'FAIL');});\n",
      "test('unstable R is failed without selecting majority',()=>{const p=clone(linux);p.records[3].raw={status:0,signal:null,error:null};assert.equal(named(judgeQualification(p),'REFERENCE_STABLE'),'FAIL');});\n",
      "test('Darwin original zero stays fixed',()=>{const d=packet('darwin',{status:0,signal:null,error:null},[{code:0}]);const q=judgeQualification(d);assert.equal(q.status,'QUALIFIED');assert.equal(judgePair(pair(d),q).status,'PASS');assert.equal(named(judgeQualification(packet('darwin')),'KNOWN_CLI_ZERO.REFERENCE'),'FAIL');});\n",
      "test('Darwin qualification cannot authorize Linux',()=>{const d=packet('darwin',{status:0,signal:null,error:null},[{code:0}]);assert.equal(named(judgePair(pair(linux),judgeQualification(d)),'PUBLIC_REFERENCE_QUALIFIED'),'FAIL');});\n",
      "test('missing R-after continuity fails without erasing C mismatch',()=>{const p=pair(linux);delete p.Rafter;p.C.raw={status:0,signal:null,error:null};const r=judgePair(p,lq);assert.equal(named(r,'REFERENCE_CONTINUITY'),'FAIL');assert.equal(named(r,'RAW'),'FAIL');});\n",
      "test('copied public R cannot masquerade as real factory C',()=>{const p=pair(linux);p.C.origin='LIVE_PUBLIC_CLI';delete p.C.factoryObservation;assert.equal(named(judgePair(p,lq),'FACTORY_BINDING'),'FAIL');});\n",
      "test('fixture bytes missing or mutated invalidate wiring',()=>{const p=pair(linux);p.C.sourceBefore={};p.C.sourceAfter={};assert.equal(named(judgePair(p,lq),'ENTRY_READY'),'FAIL');});\n",
      "test('complete R-only stdout guard and timestamped decode survive temp cleanup',()=>{const t=transcript(linux);const forwarded=[];forwardEvidence(t.stdout,l=>forwarded.push(l));assert.equal(parseSummary(t.stdout).status,'REFERENCE_QUALIFIED');assert.deepEqual(decodeEvidence(forwarded.map(l=>'2026-01-01Z '+l).join('\\n')).find(g=>g.kind==='REFERENCE_QUALIFICATION').value,t.qualification);});\n",
      "test('missing duplicate and corrupt stdout chunks reject',()=>{const lines=[];emitEvidence('TEST','one',linux,l=>lines.push(l));assert.throws(()=>decodeEvidence(lines.slice(1).join('\\n')));assert.throws(()=>decodeEvidence([...lines,lines[0]].join('\\n')));assert.throws(()=>decodeEvidence(lines.map((l,i)=>i?l:l.replace('\"chunk\":\"','\"chunk\":\"x')).join('\\n')));});\n",
      "test('complete same-window pair package closes with independent judgment',()=>{const t=transcript(linux,true);assert.equal(validateEvidenceClosure(t.stdout).summary.status,'PASS');});\n",
      "test('partial stdout one valid record plus green summary cannot pass either guard',()=>{const t=transcript(linux);const partial=t.lines.filter(l=>header(l)?.id.startsWith('R.CONTROL_BEFORE:')||!header(l)).join('\\n');assert.ok(guardRejects(partial,'QUALIFICATION_PACKET_REQUIRED').length>0);});\n",
      "test('dropping a qualification chunk is rejected while partial originals forward',()=>{const t=transcript(linux);let removed=false;const partial=t.lines.filter(l=>{if(!removed&&header(l)?.kind==='REFERENCE_QUALIFICATION'){removed=true;return false;}return true;}).join('\\n');assert.ok(guardRejects(partial,'INCOMPLETE_CHUNKS').length>0);});\n",
      "test('dropping complete qualification or report or R record packets rejects',()=>{for(const remove of [h=>h.kind==='REFERENCE_QUALIFICATION',h=>h.kind==='SYNC_REPORT',h=>h.kind==='REFERENCE_RECORD'&&h.id.startsWith('R.SYNC.3:')]){const t=transcript(linux);guardRejects(t.lines.filter(l=>!header(l)||!remove(header(l))).join('\\n'));}});\n",
      "test('dropping the complete pair packet cannot borrow its green summary',()=>{const t=transcript(linux,true);guardRejects(t.lines.filter(l=>header(l)?.kind!=='PAIR_PACKET').join('\\n'));});\n",
      "test('record packet and embedded qualification disagreement is rejected',()=>{const t=transcript(linux);const replaceAt=t.lines.findIndex(l=>header(l)?.id.startsWith('R.SYNC.1:'));const lines=t.lines.filter(l=>!header(l)?.id.startsWith('R.SYNC.1:'));const r=clone(linux.records[1]);r.stdoutBase64='Y2hhbmdlZA==';const replacement=[];emitEvidence('REFERENCE_RECORD','R.SYNC.1',r,l=>replacement.push(l));lines.splice(replaceAt,0,...replacement);guardRejects(lines.join('\\n'),'REFERENCE_RECORD_CLOSURE_INCOMPLETE');});\n",
      "test('green summary cannot replace a failing or missing matching report',()=>{const t=transcript(linux);t.lines[t.lines.length-1]=JSON.stringify({status:'PASS',semanticAssertions:0});guardRejects(t.lines.join('\\n'));});\n",
      "test('coherent source drift leaves wiring/vector intact but cannot open C',()=>{const r=clone(linux.records[1]);r.sourceBefore.main='e'.repeat(64);r.sourceAfter.main='e'.repeat(64);assert.equal(wiring(r,'term'),true);assert.equal(equal(vector(r),lq.referenceVector),true);let starts=0;if(canStartCandidate(r,lq,linux.identity,linux.identitySha256))starts++;assert.equal(starts,0);});\n",
      "test('all prior identity origin qualification and vector conditions reject before C',()=>{const cases=[{r:{...clone(linux.records[1]),origin:'COPIED_RECORD'},q:lq},{r:{...clone(linux.records[1]),identitySha256:'bad'},q:lq},{r:{...clone(linux.records[1]),entryBoot:false},q:lq},{r:{...clone(linux.records[1]),raw:{status:0,signal:null,error:null}},q:lq},{r:clone(linux.records[1]),q:{...lq,status:'FAILED'}},{r:clone(linux.records[1]),q:{...lq,identity:{...lq.identity,arch:'arm64'}}}];let starts=0;for(const c of cases)if(canStartCandidate(c.r,c.q,linux.identity,linux.identitySha256))starts++;assert.equal(starts,0);assert.equal(canStartCandidate(linux.records[1],lq,linux.identity,linux.identitySha256),true);});\n",
      "test('uncleared inherited NODE_OPTIONS rejects without echo or silent mutation',()=>{const secret='SYNTHETIC_PRIVATE_ENV_SENTINEL';const env={NODE_OPTIONS:'--import=/synthetic/'+secret};const before=JSON.stringify(env);let message;try{assertClearedNodeOptions(env);assert.fail('must reject');}catch(e){message=e.message;}assert.equal(message,'INHERITED_NODE_OPTIONS_NOT_CLEARED');assert.equal(JSON.stringify(env),before);const tape=[];emitEvidence('REFERENCE_INVALID','env',{status:'INVALID',reason:message},l=>tape.push(l));assert.equal(tape.join('\\n').includes(secret),false);assert.equal(JSON.stringify(decodeEvidence(tape.join('\\n'))).includes(secret),false);assert.throws(()=>assertClearedNodeOptions({NODE_OPTIONS:''}));assert.doesNotThrow(()=>assertClearedNodeOptions({}));});\n",
      "test('summary cannot point to a different local green report',()=>{const t=transcript(linux);const summary=JSON.parse(t.lines.at(-1));summary.report='/synthetic/another-green-report.json';t.lines[t.lines.length-1]=JSON.stringify(summary);guardRejects(t.lines.join('\\n'),'SUMMARY_REPORT_MISMATCH');});\n",
      "test('complete failed qualification stays invalid without opening a candidate phase',()=>{const p=clone(linux);p.records[3].raw={status:0,signal:null,error:null};const t=transcript(p);const validated=validateEvidenceClosure(t.stdout);assert.equal(validated.summary.status,'INVALID');assert.equal(validated.qualification.status,'FAILED');assert.equal(validated.report.candidateExecutions,0);});\n",
      "test('early invalid diagnostic forwards but cannot invent a qualification closure',()=>{const lines=[];const report={status:'INVALID',semanticAssertions:0,infrastructureError:'INHERITED_NODE_OPTIONS_NOT_CLEARED'};emitEvidence('SYNC_REPORT','invalid',report,l=>lines.push(l));lines.push(JSON.stringify({...report,report:null}));assert.ok(guardRejects(lines.join('\\n'),'QUALIFICATION_PACKET_REQUIRED').length>0);});\n",
      "test('complete public pair keeps RAW and HOOKS failures instead of a guard pass meaning product pass',()=>{const t=transcript(linux,true,true);const validated=validateEvidenceClosure(t.stdout);assert.equal(validated.summary.status,'FAIL');assert.equal(named(validated.report,'RAW'),'FAIL');assert.equal(named(validated.report,'HOOKS'),'FAIL');});\n",
      "const priorNodeOptions=process.env.NODE_OPTIONS,hadNodeOptions=Object.hasOwn(process.env,'NODE_OPTIONS');let runtimeReads=0;\n",
      "process.env.NODE_OPTIONS='--import=/synthetic/PRIVATE_ENTRY_SENTINEL';\n",
      "try{await assert.rejects(createSyncMeasurement(new Proxy({}, {get(){runtimeReads++;throw new Error('BINDING_REACHED_BEFORE_ENV_GATE');}})),{message:'INHERITED_NODE_OPTIONS_NOT_CLEARED'});assert.equal(runtimeReads,0);results.push({label:'actual collection entry rejects inherited options before runtime access or child binding',status:'PASS'});}finally{if(hadNodeOptions)process.env.NODE_OPTIONS=priorNodeOptions;else delete process.env.NODE_OPTIONS;}\n",
      "console.log(JSON.stringify({kind:'TOOL_ONLY_SYNTHETIC_SELFTEST',targetExecutions:0,linuxExecutions:0,candidateExecutions:0,assertions:results},null,2));\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/src/verify-pair.mjs", sha256: "df875dd9f8e4a5c9dcbb4fed8e2856a10942315c129933c03d1a089317457d56", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/src/verify-pair.mjs", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/src/verify-pair.mjs"
    body: [
      "// Offline checker only: no C import or execution. Pair records must come from\n",
      "// the existing actual public-factory launcher after an accepted R-only window.\n",
      "import fs from 'node:fs';\n",
      "import {judgeQualification,judgePair} from './judge.mjs';\n",
      "import {emitEvidence} from './evidence.mjs';\n",
      "const q=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));\n",
      "const p=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));\n",
      "const qualification=judgeQualification(q);\n",
      "const result=judgePair(p,qualification);\n",
      "emitEvidence('PAIR_JUDGMENT',p.identitySha256||'unqualified',result);\n",
      "console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;\n",
    ].join(''),
    // SYNC43-BODY-END
  },
  { name: "packet/sync43/freeze-manifest.json", sha256: "3547b3c29ea76c03a4030101ab318d6fbdd7818e0cbf4769ca61a8471bd2bbff", source: "/private/tmp/kc-20261024/ci-recovery-linux-sync-term-contract-artifacts/frozen-v4.3.1/freeze-manifest.json", rootBindings: [],
    // SYNC43-BODY-BEGIN "packet/sync43/freeze-manifest.json"
    body: [
      "{\n",
      "  \"version\": \"sync-self-term-v4.3.1.platform-qualified\",\n",
      "  \"frozenAtUtc\": \"2026-10-25T16:18:37.360955+00:00\",\n",
      "  \"parentManifestSha256\": \"0cf621dcd88af0e81b718d0aa16634d2b010d9de2e28a2472431474aed7a8a41\",\n",
      "  \"candidateExecutionsAtFreeze\": 0,\n",
      "  \"publicReferenceExecutionsAtFreeze\": 0,\n",
      "  \"linuxExecutionsAtFreeze\": 0,\n",
      "  \"scope\": \"only Astra B1 source gate, B2 complete public evidence closure, B3 inherited NODE_OPTIONS bound, B4 CI/private retention correction; unchanged signal group and semantic labels\",\n",
      "  \"reviewFiles\": [\n",
      "    {\n",
      "      \"path\": \"review-v4.3.1/AMENDMENT.md\",\n",
      "      \"sha256\": \"056fe1f21947a3359770522ed9c7089b3bc1cb79a2f49a709e74883133431e6e\",\n",
      "      \"bytes\": 2705\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"review-v4.3.1/astra-parent-review.txt\",\n",
      "      \"sha256\": \"08c826f213d30f55f7145538e556c6737580a5f5fe18d8530367c319d063cd88\",\n",
      "      \"bytes\": 6753\n",
      "    }\n",
      "  ],\n",
      "  \"files\": [\n",
      "    {\n",
      "      \"path\": \"CI-INTEGRATION.md\",\n",
      "      \"sha256\": \"b8ae929db95877e1d72970fa406b0fd53de7b683bc6d1bdd757e5a23e7775344\",\n",
      "      \"bytes\": 5918\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"LABEL-MAPPING.json\",\n",
      "      \"sha256\": \"7d0b9f2e76e63958af92f5cc5ec0d84bb6e3befab4755053209dc4be21b61ec0\",\n",
      "      \"bytes\": 1597\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"README.md\",\n",
      "      \"sha256\": \"59fe65a71782d8164a83ad27a9c11a7c0aac56f40ddba2313490d6793f2037d2\",\n",
      "      \"bytes\": 2479\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"binding/native-probe.mjs\",\n",
      "      \"sha256\": \"88bed797099479800fb35ab7a84a703cb24ea366bd1d9794dbb5938e7ae23388\",\n",
      "      \"bytes\": 977\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"binding/native-probe.mts\",\n",
      "      \"sha256\": \"61fa9de92eac477f270efafdb41005886619b188d6d8f96028c99899c27c456d\",\n",
      "      \"bytes\": 40\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"binding/node-binding.mjs\",\n",
      "      \"sha256\": \"cad4562e2a7116de484fd93b56a43cc9dbd80edc37546c06b9b78c7a4dd0da2d\",\n",
      "      \"bytes\": 6043\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"contract.json\",\n",
      "      \"sha256\": \"9d4bd36e17fcb415a9a5a91dd8226ff133609f3c7b01ab77b25d829977c9d5ae\",\n",
      "      \"bytes\": 5665\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"inputs/boundary-observer.mjs\",\n",
      "      \"sha256\": \"16ea6f135a334fe739920a6cd66afc629afed5f5bbd7edb2f16afc6e27b11576\",\n",
      "      \"bytes\": 475\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"inputs/main-alpha.ts\",\n",
      "      \"sha256\": \"dadbba6cd1edb4a0c1a13dd3061d90788b91932948b5db9e0ca191c2493c8cc7\",\n",
      "      \"bytes\": 1758\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"inputs/package.json\",\n",
      "      \"sha256\": \"89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035\",\n",
      "      \"bytes\": 33\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"inputs/state-beta.ts\",\n",
      "      \"sha256\": \"aa7b08f3a8f77b5dc032d8daa1326a27cd323979cca07359858132863171c588\",\n",
      "      \"bytes\": 1215\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"inputs/tsconfig.json\",\n",
      "      \"sha256\": \"6a8c5b15a1c6343da145ac63946fc85dd805c80e72b3575d58fbc740eb14edac\",\n",
      "      \"bytes\": 72\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"runtime.example.json\",\n",
      "      \"sha256\": \"0f4fa3eb32046d2f6bf3631cb5de9bc15fd1486623a63261823add3bf78a96c8\",\n",
      "      \"bytes\": 690\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"source-preservation.json\",\n",
      "      \"sha256\": \"c1c9a225b5ca3cae8ffcd9dc268a89b130ec86693e97e9bed392e9b267ac6d3c\",\n",
      "      \"bytes\": 17189\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"src/evidence.mjs\",\n",
      "      \"sha256\": \"38886a62a990845c904b6d79ad7715b7c3d370e65f8469d5d46949439b36076c\",\n",
      "      \"bytes\": 8024\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"src/judge.mjs\",\n",
      "      \"sha256\": \"ceba688457e6e9ea988bad5182a2bd898c44c72c217fb0e1bdf4cf4aa8d9242f\",\n",
      "      \"bytes\": 8425\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"src/prepare-fixture.mjs\",\n",
      "      \"sha256\": \"e556b89fcfb7942519cd4cd3282e4ed3bb9397438512167c531c4fba4f8d1b04\",\n",
      "      \"bytes\": 852\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"src/qualify.mjs\",\n",
      "      \"sha256\": \"85e2b09ea66cf568c42a4692fbf688cc797ae5e6298baa7d49d960ffb28c6d2b\",\n",
      "      \"bytes\": 14087\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"src/run.mjs\",\n",
      "      \"sha256\": \"d900b4333866658a740f4c49125e0913e93f3a87868e1afdaa7000352ec237c2\",\n",
      "      \"bytes\": 6208\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"src/tool-selftest.mjs\",\n",
      "      \"sha256\": \"115a0baa7be35b6fbef5539f51eb8f40d96dde28ce3166e78722f1dcb2311502\",\n",
      "      \"bytes\": 16588\n",
      "    },\n",
      "    {\n",
      "      \"path\": \"src/verify-pair.mjs\",\n",
      "      \"sha256\": \"df875dd9f8e4a5c9dcbb4fed8e2856a10942315c129933c03d1a089317457d56\",\n",
      "      \"bytes\": 652\n",
      "    }\n",
      "  ]\n",
      "}\n",
    ].join(''),
    // SYNC43-BODY-END
  },
]
