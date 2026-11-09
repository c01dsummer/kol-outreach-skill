/**
 * Independently authored from contract.md and the admitted fixed specifications.
 * Importing this module does not run a test or import a DUT. See README.md.
 */
import fs, {
  readFileSync as esmReadFileSync,
  readdirSync as esmReaddirSync,
  unlinkSync as esmUnlinkSync,
  openSync as esmOpenSync,
  readSync as esmReadSync,
  closeSync as esmCloseSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncBuiltinESMExports } from "node:module";

export type WriteAtomic = (file: string, data: string | Buffer) => void;
export type ContractStatus = "PASS" | "FAIL" | "INVALID";
export interface ContractResult {
  label: string;
  status: ContractStatus;
  expected: string;
  provenance: string[];
  derivation: string;
  failures: string[];
  thrown?: string;
  observation: {
    targetWritten: boolean;
    targetModePreserved: boolean;
    neighborStates: Record<string, "kept" | "removed" | "changed">;
    targetFsEvents: number;
    targetProcReads: number;
    cleanupFaultsObserved: number;
    sourceReadFaultsObserved: number;
    zeroSourceReadQualified?: boolean;
  };
}
export interface TraceEvent {
  phase: "control" | "target";
  caseLabel: string;
  op: string;
  path?: string;
  pid?: number;
}
export interface PidBoundaryReport {
  schemaVersion: 1;
  assertionResults: ContractResult[];
  fixture: {
    status: "VALID" | "INVALID";
    issues: string[];
    controls: Record<string, boolean>;
    restorationChecked: boolean;
    recursiveCleanupHookEvents: number;
  };
  trace: TraceEvent[];
}

type Age = "fresh" | "old";
type Life = "alive" | "dead";
interface Neighbor {
  suffix: string;
  expect: "keep" | "remove";
  age?: Age;
  life?: Life;
  denyUnlink?: boolean;
}
interface ProcSource { text?: string; error?: NodeJS.ErrnoException }
interface CaseSpec {
  label: string;
  platform: NodeJS.Platform;
  proc: ProcSource;
  neighbors: Neighbor[];
  expected: string;
  provenance: string[];
  derivation: string;
  /** Escaping I/O needs this actual target-stage event plus error identity/cause. */
  expectedFaultEvent?: "proc-read-denied" | "cleanup-denied";
}

const PROC = "/proc/sys/kernel/pid_max";
const CAP = 4_194_304;
const FIXED_MAIN = "7fbbd4c7c78d811695a6a8276ec1eec86d685c11";
const K = "contract.md §本轮明确的有限工程选择";
const D = `${FIXED_MAIN}:docs/requirements.json D4.i/k/l`;
const A = `${FIXED_MAIN}:docs/adr/ADR-44 文首/第二节/最后追记`;
const L = "platform-contract-sources.md L1/L3/L4 (fixed Linux v6.6)";

function errno(code: string, message: string): NodeJS.ErrnoException {
  return Object.assign(new Error(message), { code });
}
function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
function boundaryNeighbors(boundary: number, extra?: number): Neighbor[] {
  const result: Neighbor[] = [
    { suffix: `${boundary - 1}.tmp`, expect: "remove" },
    { suffix: `${boundary}.tmp`, expect: "keep" },
    { suffix: `${boundary + 1}.tmp`, expect: "keep" },
  ];
  if (extra !== undefined) result.push({ suffix: `${extra}.tmp`, expect: "remove" });
  return result;
}

// Each row below is a distinct, predeclared name. No label is shared by a loop.
const BAD_TEXT = [
  ["blank", " \n\t", "trim 后为空，没有正整数"],
  ["zero", "0\n", "0 不是正数"],
  ["negative", "-24011\n", "有负号，不是正规正十进制"],
  ["leading-zero", "024011\n", "多位数以 0 开头"],
  ["exponent", "24e3\n", "e 不是 ASCII 十进制数字"],
  ["plus", "+24011\n", "+ 号不属于正规十进制"],
  ["junk", "24011x\n", "x 不是 ASCII 十进制数字，不能接受数字前缀"],
  ["fraction", "24011.0\n", "小数点不属于十进制整数文本"],
  ["non-ascii", "２４０１１\n", "全角数字不是 ASCII 0–9"],
] as const;

function fixedCases(): CaseSpec[] {
  const fallback = BAD_TEXT.map(([id, text, reason]): CaseSpec => ({
    label: `pid.linux.fallback.${id}`,
    platform: "linux",
    proc: { text },
    neighbors: boundaryNeighbors(CAP, 24_011),
    expected: "24011 与 4194303 清理；4194304 与 4194305 原样保留；写回成功且权限不变。",
    provenance: [`${K} 2/4/5`, D, A],
    derivation: `${reason}，因此 B=4194304；0<24011<4194304，4194303=B−1，4194304=B，4194305=B+1。年龄均为两小时，范围内按年龄兜底清理。`,
  }));
  return [
    ...fallback,
    {
      label: "pid.linux.fallback.read-denied",
      platform: "linux",
      proc: { error: errno("EACCES", "fixture pid_max read denied") },
      neighbors: boundaryNeighbors(CAP, 24_011),
      expected: "读取失败仍采用 4194304，不阻止新数据写回；仅清理范围内旧残留。",
      provenance: [`${K} 4/5`, D],
      derivation: "读失败 => B=4194304；24011 与 B−1 在开区间内，B 与 B+1 不在。读取失败不是原子写回失败的理由。",
      expectedFaultEvent: "proc-read-denied",
    },
    ...[
      ["just-over-cap", "4194305\n", "4194305=4194304+1"],
      ["huge-digits", "9999999999999999999999999999999999999999\n", "40 位的全 9 正十进制数严格大于 4194304，且不依赖浮点转换"],
    ].map(([id, text, arithmetic]): CaseSpec => ({
      label: `pid.linux.cap.${id}`,
      platform: "linux",
      proc: { text },
      neighbors: boundaryNeighbors(CAP),
      expected: "纯数字过大来源收至 4194304；4194303 清理，4194304 与 4194305 保留。",
      provenance: [`${K} 2/4`, D],
      derivation: `${arithmetic}；B=min(来源,4194304)=4194304。故 B−1 有资格，B 与 B+1 无资格；超大整数不得溢出成无效的小界。`,
    })),
    {
      label: "pid.darwin.same-named-proc-ignored",
      platform: "darwin",
      proc: { text: "2048\n" },
      neighbors: boundaryNeighbors(99_999, 2_048),
      expected: "2048 与 99998 清理；99999 与 100000 保留；伪 Linux proc 不改变 Darwin 兜底，且不读取其正文。",
      provenance: [`${K} 1/4/5`, D, "platform-contract-sources.md A1–A6 的版本限度"],
      derivation: "Darwin 项目策略 B=99999；2048<99999，99998=B−1，99999=B，100000=B+1。2048 恰等于伪 proc 值：若错误套用 Linux 来源它会被保留，因此该阳性后果可排除此错。",
    },
    {
      label: "pid.other-platform.same-named-proc-ignored",
      platform: "freebsd",
      proc: { text: "2048\n" },
      neighbors: boundaryNeighbors(CAP, 2_048),
      expected: "FreeBSD 沿用项目通用兜底 4194304；2048 与 4194303 清理；端点及以上保留，且不读取 Linux proc 正文。",
      provenance: [`${K} 1/4/5`, D],
      derivation: "FreeBSD 不属于 Linux/Darwin => B=4194304；2048<B，B−1<B；B 与 B+1 无资格。此处不声称 4194304 是 FreeBSD 的真实内核范围。",
    },
    {
      label: "pid.name.noncanonical-neighbors-preserved",
      platform: "linux",
      proc: { text: "24011\n" },
      neighbors: [
        { suffix: "17.tmp", expect: "remove", life: "dead" },
        ...["0.tmp", "-17.tmp", "+17.tmp", "0017.tmp", "17e0.tmp", "17.0.tmp", " 17.tmp", "9007199254740993.tmp", "17.tmp.extra"].map((suffix): Neighbor => ({ suffix, expect: "keep", life: "dead" })),
      ],
      expected: "正规 17.tmp 被清理；零、符号、前导零、指数、小数、空白、不精确超大值和错误后缀全部原样保留。",
      provenance: [A, `${K} 4`, D],
      derivation: "17 是正规正十进制且 17<24011；其余名字不能是公开命名协议可写出的 PID（9007199254740993=2^53+1 亦越界），年龄两小时不赋予非法名字清理资格。",
    },
    {
      label: "pid.lifecycle.age-and-soft-cleanup",
      platform: "linux",
      proc: { text: "24011\n" },
      neighbors: [
        { suffix: "17.tmp", expect: "remove", age: "fresh", life: "dead" },
        { suffix: "18.tmp", expect: "keep", age: "fresh", life: "alive" },
        { suffix: "19.tmp", expect: "remove", age: "old", life: "alive" },
        { suffix: "20.tmp", expect: "keep", age: "old", life: "dead", denyUnlink: true },
      ],
      expected: "新近死号清理、新近活号保留、两小时活号按年龄清理；20 的清理 EACCES 不阻新数据写回。",
      provenance: [D, A, `${K} 保留原年龄取舍`],
      derivation: "17/18/19/20 都在 (0,24011)；fresh 为五秒、old 为两小时，远离一小时阈值。死号 17 可清；活号 18 新近须留；19 超过一小时可清；20 的 unlink 被拒，D4.k 要求其失败不得传成写回失败。",
      expectedFaultEvent: "cleanup-denied",
    },
  ];
}

function dynamicCases(): CaseSpec[] {
  const common = [D, A, `${K} 2/3/4`, L];
  return [
    {
      label: "pid.linux.dynamic.initial-exclusive-boundary",
      platform: "linux", proc: { text: "24011\n" },
      neighbors: boundaryNeighbors(24_011),
      expected: "24010 清理；24011 与 24012 保留；正规换行来源可用。",
      provenance: common,
      derivation: "B=24011；24010=B−1>0；24011=B 与 24012=B+1 不在 0<PID<B。",
    },
    {
      label: "pid.linux.dynamic.lowered-and-whitespace",
      platform: "linux", proc: { text: " \t12011 \r\n" },
      neighbors: [
        { suffix: "12010.tmp", expect: "remove" },
        { suffix: "12011.tmp", expect: "keep" },
        { suffix: "24010.tmp", expect: "keep" },
        { suffix: "24011.tmp", expect: "keep" },
        { suffix: "24012.tmp", expect: "keep" },
      ],
      expected: "同一目标调低至 12011：12010 清理；12011、重新放入的 24010 和原端点文件保留。",
      provenance: common,
      derivation: "先 trim 得 12011，B 从 24011 降为 12011；12010=B−1；12011=B；24010>12011。继续沿用上一轮界会错误删除 12011 与 24010。",
    },
    {
      label: "pid.linux.dynamic.restored",
      platform: "linux", proc: { text: "24011" },
      neighbors: [
        { suffix: "12011.tmp", expect: "remove" },
        { suffix: "24010.tmp", expect: "remove" },
        { suffix: "24011.tmp", expect: "keep" },
        { suffix: "24012.tmp", expect: "keep" },
      ],
      expected: "同一目标恢复至 24011：上一轮保留的 12011 与 24010 现在清理，24011 与 24012 继续保留。",
      provenance: common,
      derivation: "B 恢复为 24011；0<12011<24011 且 24010=B−1；端点 B 与 B+1 仍无资格。一直使用降后的界会错误保留两个本轮范围内旧文件。",
    },
  ];
}

export const PID_BOUNDARY_ASSERTIONS = [...dynamicCases(), ...fixedCases()].map(
  ({ label, expected, provenance, derivation }) => ({ label, expected, provenance, derivation }),
);

/**
 * Invoke serially, in the narrow PID-boundary group. The caller owns test-line
 * formatting; any fixture INVALID invalidates the complete run for red evidence.
 */
export function runPidBoundaryContract(writeAtomic: WriteAtomic): PidBoundaryReport {
  const report: PidBoundaryReport = {
    schemaVersion: 1, assertionResults: [],
    fixture: { status: "VALID", issues: [], controls: {}, restorationChecked: false, recursiveCleanupHookEvents: 0 },
    trace: [],
  };
  const mutable = fs as unknown as Record<string, any>;
  const raw = { ...mutable } as Record<string, any>;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  const originalKill = process.kill;
  const replaced: string[] = [];
  const installed = new Map<string, (...args: any[]) => any>();
  let sandbox = "";
  let phase: "control" | "target" = "control";
  let active: CaseSpec | undefined;
  let source: ProcSource = { text: "71\n" };
  let live = new Map<number, Life>();
  let denied = new Set<string>();
  let injectedErrors = new Set<unknown>();
  const ownedFds = new Set<number>();
  const virtualFds = new Map<number, { bytes: Buffer; offset: number }>();
  let nextVirtualFd = 0x7fff0000;
  const markInvalid = (message: string): never => {
    report.fixture.status = "INVALID";
    report.fixture.issues.push(message);
    throw new Error(`PID_CONTRACT_FIXTURE_INVALID: ${message}`);
  };
  const event = (op: string, value?: string, pid?: number) => {
    report.trace.push({ phase, caseLabel: active?.label ?? "fixture.controls", op, path: value, pid });
  };
  const pathname = (value: unknown): string => {
    if (value instanceof URL) return path.resolve(fileURLToPath(value));
    if (Buffer.isBuffer(value)) return path.resolve(value.toString());
    if (typeof value === "string") return path.resolve(value);
    return markInvalid(`unrecognized path argument: ${typeof value}`);
  };
  const guard = (value: unknown, permitProc = false): string => {
    if (typeof value === "number") {
      if (!ownedFds.has(value) && !virtualFds.has(value)) markInvalid(`unowned file descriptor: ${value}`);
      return `fd:${value}`;
    }
    const name = pathname(value);
    if (permitProc && name === PROC) return name;
    if (name !== sandbox && !name.startsWith(`${sandbox}${path.sep}`)) markInvalid(`blocked path outside fixture: ${name}`);
    return name;
  };
  const procBytes = (): Buffer => {
    event("proc-read", PROC);
    if (source.error) {
      event("proc-read-denied", PROC);
      injectedErrors.add(source.error);
      throw source.error;
    }
    return Buffer.from(source.text ?? "", "utf8");
  };
  const procStats = (options?: unknown) => {
    // Obtain a Stats shape from our own directory, not from the real proc path.
    const stats = raw.statSync(sandbox, options);
    const bigint = typeof stats.mode === "bigint";
    stats.mode = bigint ? BigInt(0o100444) : 0o100444;
    const size = Buffer.byteLength(source.text ?? "");
    stats.size = bigint ? BigInt(size) : size;
    return stats;
  };
  const replacement = (name: string, fn: (...args: any[]) => any) => {
    if (typeof raw[name] !== "function") return;
    if (typeof raw[name].native === "function") (fn as any).native = fn;
    mutable[name] = fn;
    installed.set(name, fn);
    replaced.push(name);
  };
  const emptyObservation = () => ({
    targetWritten: false, targetModePreserved: false,
    neighborStates: {} as Record<string, "kept" | "removed" | "changed">,
    targetFsEvents: 0, targetProcReads: 0,
    cleanupFaultsObserved: 0,
    sourceReadFaultsObserved: 0,
  });
  const hookBindingsConnected = () =>
    esmReadFileSync === installed.get("readFileSync") && esmReadFileSync === mutable.readFileSync &&
    esmOpenSync === installed.get("openSync") && esmOpenSync === mutable.openSync &&
    esmReadSync === installed.get("readSync") && esmReadSync === mutable.readSync &&
    esmCloseSync === installed.get("closeSync") && esmCloseSync === mutable.closeSync &&
    esmReaddirSync === installed.get("readdirSync") && esmReaddirSync === mutable.readdirSync &&
    esmUnlinkSync === installed.get("unlinkSync") && esmUnlinkSync === mutable.unlinkSync;
  const isInjectedErrorOrCause = (error: unknown): boolean => {
    const visited = new Set<unknown>();
    let current = error;
    while (current !== undefined && current !== null && !visited.has(current)) {
      if (injectedErrors.has(current)) return true;
      visited.add(current);
      current = typeof current === "object" ? (current as { cause?: unknown }).cause : undefined;
    }
    return false;
  };
  const addInvalid = (spec: CaseSpec, message: string) => report.assertionResults.push({
    label: spec.label, status: "INVALID", expected: spec.expected,
    provenance: spec.provenance, derivation: spec.derivation,
    failures: [message], observation: emptyObservation(),
  });

  try {
    if (typeof writeAtomic !== "function") markInvalid("public callback is not callable");
    if (!originalPlatform?.configurable) markInvalid("process.platform cannot be restored via its original descriptor");
    sandbox = raw.realpathSync(raw.mkdtempSync(path.join(os.tmpdir(), "pid-boundary-contract-")));
    // Recursive removal may lazily load helpers that retain fs function values.
    // Load that path with originals, using a real nested tree, before any hook.
    const cleanupWarmup = path.join(sandbox, "recursive-cleanup-control");
    raw.mkdirSync(path.join(cleanupWarmup, "nested"), { recursive: true });
    raw.writeFileSync(path.join(cleanupWarmup, "nested", "positive.tmp"), "recursive cleanup positive");
    raw.rmSync(cleanupWarmup, { recursive: true, force: true });
    report.fixture.controls.recursiveCleanupPrewarm = !raw.existsSync(cleanupWarmup);
    if (!report.fixture.controls.recursiveCleanupPrewarm) markInvalid("original-fs recursive cleanup positive failed before hook installation");
    replacement("readFileSync", (...args) => {
      const target = guard(args[0], true);
      const virtual = typeof args[0] === "number" ? virtualFds.get(args[0]) : undefined;
      if (target === PROC || virtual) {
        const bytes = virtual ? virtual.bytes.subarray(virtual.offset) : procBytes();
        if (virtual) { virtual.offset = virtual.bytes.length; event("proc-read", PROC); }
        const option = args[1];
        const encoding = typeof option === "string" ? option : option?.encoding;
        return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
      }
      event("readFileSync", target);
      return raw.readFileSync(...args);
    });
    replacement("openSync", (...args) => {
      const target = guard(args[0], true);
      if (target === PROC) {
        const flags = args[1];
        const writeBits = fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_APPEND | fs.constants.O_TRUNC | fs.constants.O_CREAT;
        const readonly = typeof flags === "string" ? flags === "r" || flags === "rs" : (flags & writeBits) === 0;
        if (!readonly) markInvalid("blocked proc write attempt");
        const fd = nextVirtualFd--;
        virtualFds.set(fd, { bytes: procBytes(), offset: 0 });
        return fd;
      }
      event("openSync", target);
      const fd = raw.openSync(...args);
      ownedFds.add(fd);
      return fd;
    });
    replacement("readSync", (...args) => {
      guard(args[0]);
      const virtual = virtualFds.get(args[0]);
      if (!virtual) return raw.readSync(...args);
      const options = typeof args[2] === "object" ? args[2] : undefined;
      const offset = options?.offset ?? args[2] ?? 0;
      const length = options?.length ?? args[3] ?? args[1].byteLength - offset;
      const position = options?.position ?? args[4];
      const start = typeof position === "number" ? position : virtual.offset;
      const amount = Math.min(length, Math.max(0, virtual.bytes.length - start));
      virtual.bytes.copy(args[1], offset, start, start + amount);
      if (position === null || position === undefined) virtual.offset += amount;
      event("proc-read", PROC);
      return amount;
    });
    replacement("closeSync", (...args) => {
      guard(args[0]);
      if (virtualFds.delete(args[0])) return;
      ownedFds.delete(args[0]);
      return raw.closeSync(...args);
    });
    for (const name of ["writeSync", "fsyncSync", "fdatasyncSync", "fchmodSync", "fchownSync", "ftruncateSync", "futimesSync", "fstatSync"]) {
      replacement(name, (...args) => {
        guard(args[0]);
        if (name === "fstatSync" && virtualFds.has(args[0])) return procStats(args[1]);
        if (virtualFds.has(args[0])) markInvalid(`unsupported virtual proc fd operation: ${name}`);
        event(name, `fd:${args[0]}`);
        return raw[name](...args);
      });
    }
    for (const name of ["readdirSync", "statSync", "lstatSync", "realpathSync", "accessSync", "readlinkSync", "opendirSync", "existsSync", "writeFileSync", "appendFileSync", "mkdirSync", "rmdirSync", "rmSync", "chmodSync", "chownSync", "truncateSync", "utimesSync"]) {
      replacement(name, (...args) => {
        const readOnly = ["readdirSync", "statSync", "lstatSync", "realpathSync", "accessSync", "readlinkSync", "opendirSync", "existsSync"].includes(name);
        const target = guard(args[0], readOnly);
        if (target === PROC) {
          event(name, PROC);
          if (name === "existsSync") return true;
          if (name === "statSync" || name === "lstatSync") return procStats(args[1]);
          if (name === "realpathSync") return PROC;
          if (name === "accessSync") {
            if ((args[1] ?? 0) & fs.constants.W_OK) throw errno("EACCES", "fixture proc source is read-only");
            return;
          }
          throw errno(name === "readlinkSync" ? "EINVAL" : "ENOTDIR", "fixture proc is a regular file");
        }
        event(name, target);
        if ((name === "rmSync" || name === "rmdirSync") && denied.has(target)) {
          event("cleanup-denied", target);
          const error = errno("EACCES", "fixture stale-temp removal denied");
          injectedErrors.add(error);
          throw error;
        }
        return raw[name](...args);
      });
    }
    for (const name of ["renameSync", "copyFileSync", "linkSync", "symlinkSync"]) {
      replacement(name, (...args) => {
        const from = guard(args[0]);
        const to = guard(args[1]);
        event(name, `${from} -> ${to}`);
        return raw[name](...args);
      });
    }
    replacement("unlinkSync", (...args) => {
      const target = guard(args[0]);
      event("unlinkSync", target);
      if (denied.has(target)) {
        event("cleanup-denied", target);
        const error = errno("EACCES", "fixture stale-temp unlink denied");
        injectedErrors.add(error);
        throw error;
      }
      return raw.unlinkSync(...args);
    });
    process.kill = ((pid: number, signal?: string | number) => {
      if (signal !== 0) return markInvalid(`blocked nonzero process signal: ${String(signal)}`);
      event("signal0", undefined, pid);
      if (pid === process.pid || live.get(pid) === "alive") return true;
      throw errno("ESRCH", "fixture synthetic process does not exist");
    }) as typeof process.kill;
    syncBuiltinESMExports();

    // Controls exercise the exact exported interception points, never real proc.
    report.fixture.controls.esmBindingsSynchronized = hookBindingsConnected();
    report.fixture.controls.procReadPositive = esmReadFileSync(PROC, "utf8") === "71\n";
    const streamedFd = esmOpenSync(PROC, "r");
    const streamedBytes = Buffer.alloc(3);
    report.fixture.controls.procOpenReadSyncPositive =
      esmReadSync(streamedFd, streamedBytes, 0, 3, null) === 3 && streamedBytes.toString() === "71\n";
    esmCloseSync(streamedFd);
    const readFileFd = esmOpenSync(PROC, "r");
    report.fixture.controls.procOpenReadFilePositive = esmReadFileSync(readFileFd, "utf8") === "71\n";
    esmCloseSync(readFileFd);
    report.fixture.controls.directoryReadPositive = Array.isArray(esmReaddirSync(sandbox));
    const controlFile = path.join(sandbox, "observer-control.tmp");
    raw.writeFileSync(controlFile, "observer positive");
    esmUnlinkSync(controlFile);
    report.fixture.controls.unlinkPositive = !raw.existsSync(controlFile);
    live.set(31, "alive");
    report.fixture.controls.signalZeroAlive = process.kill(31, 0) === true;
    report.fixture.controls.signalZeroDead = false;
    try { process.kill(29, 0); } catch (error) {
      report.fixture.controls.signalZeroDead = (error as NodeJS.ErrnoException).code === "ESRCH";
    }
    if (Object.values(report.fixture.controls).some((ok) => !ok)) markInvalid("same-interception-point control failed");

    const runCase = (spec: CaseSpec, directory: string, reuseExisting: boolean) => {
      if (report.fixture.status === "INVALID") { addInvalid(spec, "fixture was already invalid"); return; }
      active = spec;
      source = spec.proc;
      live = new Map();
      denied = new Set();
      injectedErrors = new Set();
      const target = path.join(directory, "record.json");
      const oldPayload = `old:${spec.label}`;
      const newPayload = `new:${spec.label}\n`;
      const markers = new Map<string, string>();
      const result: ContractResult = {
        label: spec.label, status: "PASS", expected: spec.expected,
        provenance: spec.provenance, derivation: spec.derivation,
        failures: [], observation: emptyObservation(),
      };
      try {
        raw.mkdirSync(directory, { recursive: true });
        raw.writeFileSync(target, oldPayload);
        raw.chmodSync(target, 0o640);
        const modeBefore = raw.statSync(target).mode & 0o777;
        if (raw.readFileSync(target, "utf8") !== oldPayload) markInvalid(`${spec.label}: target fixture readback mismatch`);
        const now = Date.now();
        for (const neighbor of spec.neighbors) {
          const file = `${target}.${neighbor.suffix}`;
          const canonical = /^([1-9][0-9]*)\.tmp$/.exec(neighbor.suffix);
          if (canonical && Number(canonical[1]) === process.pid) markInvalid(`${spec.label}: synthetic PID collides with the writer PID`);
          const preserve = reuseExisting && raw.existsSync(file);
          const marker = preserve ? raw.readFileSync(file, "utf8") : `left:${spec.label}:${neighbor.suffix}`;
          if (!preserve) {
            raw.writeFileSync(file, marker);
            const time = new Date(now - (neighbor.age === "fresh" ? 5_000 : 2 * 60 * 60 * 1000));
            raw.utimesSync(file, time, time);
          }
          markers.set(file, marker);
          if (raw.readFileSync(file, "utf8") !== marker) markInvalid(`${spec.label}: neighbor fixture readback mismatch`);
          const age = Date.now() - raw.statSync(file).mtimeMs;
          if (neighbor.age === "fresh" ? age >= 60_000 : age < 90 * 60 * 1000) markInvalid(`${spec.label}: fixture age outside its safe band`);
          if (canonical) live.set(Number(canonical[1]), neighbor.life ?? "alive");
          if (neighbor.denyUnlink) denied.add(file);
        }
        Object.defineProperty(process, "platform", { ...originalPlatform, value: spec.platform });
        const traceStart = report.trace.length;
        phase = "target";
        let callbackError: unknown;
        try {
          // Buffer and string both use the only admitted public call signature.
          writeAtomic(target, spec.label.endsWith("restored") ? Buffer.from(newPayload) : newPayload);
        } catch (error) { callbackError = error; }
        phase = "control";
        if ((report.fixture.status as ContractStatus) === "INVALID") throw new Error("fixture guard was triggered during callback");
        const targetEvents = report.trace.slice(traceStart).filter((entry) => entry.phase === "target");
        result.observation.targetFsEvents = targetEvents.filter((entry) => entry.path !== undefined && entry.path !== PROC).length;
        result.observation.targetProcReads = targetEvents.filter((entry) => entry.op === "proc-read").length;
        result.observation.cleanupFaultsObserved = targetEvents.filter((entry) => entry.op === "cleanup-denied").length;
        result.observation.sourceReadFaultsObserved = targetEvents.filter((entry) => entry.op === "proc-read-denied").length;
        if (callbackError !== undefined) {
          result.thrown = describe(callbackError);
          const reachedExpectedFault = spec.expectedFaultEvent !== undefined &&
            targetEvents.some((entry) => entry.op === spec.expectedFaultEvent);
          if (!reachedExpectedFault || !isInjectedErrorOrCause(callbackError)) {
            markInvalid(`${spec.label}: exception has no target-stage injected-I/O provenance, not a qualified semantic red: ${result.thrown}`);
          }
          result.failures.push(`public write threw after the injected I/O fault: ${result.thrown}`);
        }
        result.observation.targetWritten = raw.existsSync(target) && raw.readFileSync(target, "utf8") === newPayload;
        result.observation.targetModePreserved = raw.existsSync(target) && (raw.statSync(target).mode & 0o777) === modeBefore;
        if (!result.observation.targetWritten) result.failures.push("target is not the complete new payload");
        if (!result.observation.targetModePreserved) result.failures.push("target original permission bits changed");
        for (const neighbor of spec.neighbors) {
          const file = `${target}.${neighbor.suffix}`;
          const exists = raw.existsSync(file);
          const state = !exists ? "removed" : raw.readFileSync(file, "utf8") === markers.get(file) ? "kept" : "changed";
          result.observation.neighborStates[neighbor.suffix] = state;
          if (state !== (neighbor.expect === "keep" ? "kept" : "removed")) result.failures.push(`${neighbor.suffix}: expected ${neighbor.expect}, observed ${state}`);
        }
        if (denied.size && !result.observation.cleanupFaultsObserved) result.failures.push("eligible stale file removal was never attempted; injected cleanup fault was not exercised");
        if (spec.platform !== "linux") {
          // Only body-source paths count. stat/exists/other metadata stay outside
          // this assertion. Positive controls and target FS events qualify zero.
          result.observation.zeroSourceReadQualified =
            hookBindingsConnected() && Object.values(report.fixture.controls).every(Boolean) &&
            result.observation.targetFsEvents > 0;
          if (!result.observation.zeroSourceReadQualified) markInvalid(`${spec.label}: zero-source-read observer lacks positive control or target connection`);
          if (result.observation.targetProcReads !== 0) result.failures.push("non-Linux target read the Linux pid_max body source");
        }
        // Linux old code that never reads the bound gets file-outcome reds;
        // a zero Linux read count is never treated as a disconnected observer.
        result.status = result.failures.length ? "FAIL" : "PASS";
      } catch (error) {
        report.fixture.status = "INVALID";
        report.fixture.issues.push(`${spec.label}: ${describe(error)}`);
        result.status = "INVALID";
        result.failures.push(describe(error));
      } finally {
        phase = "control";
        Object.defineProperty(process, "platform", originalPlatform!);
        report.assertionResults.push(result);
      }
    };

    const dynamicDirectory = path.join(sandbox, "dynamic-same-target");
    dynamicCases().forEach((spec, index) => runCase(spec, dynamicDirectory, index > 0));
    fixedCases().forEach((spec, index) => runCase(spec, path.join(sandbox, `isolated-${index}`), false));
  } catch (error) {
    report.fixture.status = "INVALID";
    report.fixture.issues.push(describe(error));
  } finally {
    phase = "control";
    for (const fd of ownedFds) {
      try { raw.closeSync(fd); } catch (error) { report.fixture.status = "INVALID"; report.fixture.issues.push(`fd cleanup: ${describe(error)}`); }
    }
    for (const name of replaced) mutable[name] = raw[name];
    process.kill = originalKill;
    if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
    syncBuiltinESMExports();
    report.fixture.restorationChecked =
      replaced.every((name) => mutable[name] === raw[name]) &&
      process.kill === originalKill &&
      process.platform === originalPlatform?.value &&
      esmReadFileSync === raw.readFileSync && esmReaddirSync === raw.readdirSync && esmUnlinkSync === raw.unlinkSync &&
      esmOpenSync === raw.openSync && esmReadSync === raw.readSync && esmCloseSync === raw.closeSync;
    if (!report.fixture.restorationChecked) {
      report.fixture.status = "INVALID";
      report.fixture.issues.push("original fs/process bindings were not restored");
    }
    if (sandbox) {
      // Fault injection belongs to the target call, never fixture teardown.
      // Still reject any cached hook use rather than hiding it by clearing deny.
      denied.clear();
      const cleanupTraceStart = report.trace.length;
      try { raw.rmSync(sandbox, { recursive: true, force: true }); } catch (error) {
        report.fixture.status = "INVALID";
        report.fixture.issues.push(`temporary directory cleanup failed: ${describe(error)}`);
      }
      report.fixture.recursiveCleanupHookEvents = report.trace.length - cleanupTraceStart;
      report.fixture.controls.recursiveCleanupNoHooks = report.fixture.recursiveCleanupHookEvents === 0;
      if (!report.fixture.controls.recursiveCleanupNoHooks) {
        report.fixture.status = "INVALID";
        report.fixture.issues.push("restored recursive cleanup still invoked an installed fs hook");
      }
    }
  }
  const expectedLabels = PID_BOUNDARY_ASSERTIONS.map((entry) => entry.label);
  for (const label of expectedLabels) {
    const count = report.assertionResults.filter((entry) => entry.label === label).length;
    if (count !== 1) {
      report.fixture.status = "INVALID";
      report.fixture.issues.push(`${label}: expected exactly one result, received ${count}`);
    }
  }
  if (new Set(expectedLabels).size !== expectedLabels.length) {
    report.fixture.status = "INVALID";
    report.fixture.issues.push("predeclared assertion labels are not unique");
  }
  return report;
}
