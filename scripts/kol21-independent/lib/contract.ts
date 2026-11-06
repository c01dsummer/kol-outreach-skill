// KOL-21 C1 · 测试侧声明的调用面（只声明形状；不 import 任何产品实现、观察器源码、writer/reader 或比较器）
//
// 观察器类型照公开协议誊写：ADR-70:3276-3324（导出签名，ADR-70:3278-3321）；
// `Zero` 按修复轮 1 修订替换为带 side/cause 的版本（ADR-70:3431-3432；同号条目以修订为准，ADR-70:3410）。
// `Layout` 协议说「作者不用读它」（ADR-70:3323），这里写 unknown。
// 真实模块由整合方在测试之外接入：把满足 ObserverFacility 的对象经 SuiteOptions.facility 传进来（见 suite.ts）。

export type FacilityCause = 'launch' | 'loader' | 'observer' | 'isolation' | 'signal'
export type Outcome =
  | { kind: 'observed' }
  | { kind: 'facility'; cause: FacilityCause; reason: string }
  | { kind: 'fixture'; reason: string }
export type ApiKey = 'placeholder' | 'absent'
export type ObserverEntry = 'probe' | 'collect' | 'enrich' | 'render'
export interface Armed {
  kind: 'armed'; run: string; pid: number; ppid: number; entry: string; script_sha256: string
  preload_sha256: string; exec_argv: string[]; node: string; env_names: string[]; api_key: ApiKey | 'other'; net: string[]
}
export type Refusal = 'unmatched' | 'exhausted' | 'ambiguous'
export type RequestOutcome = { status: number } | { connect: 'fail' } | { refused: Refusal }
export interface RequestEvent {
  kind: 'request'; run: string; pid: number; seq: number; method: string; origin: string
  endpoint: string; query_keys: string[]; rule: number | null; index: number | null; outcome: RequestOutcome
}
export interface BodyEvent { kind: 'body'; run: string; pid: number; seq: number; read: string; ok: boolean }
export interface Judged { outcome: Outcome; attributable: boolean; armed?: Armed; requests: RequestEvent[] }
export interface Observation extends Judged { entry: ObserverEntry | 'control'; isolation: string }
export interface ObservedRun extends Observation {
  run: string; evidenceDir: string; status: number | null; signal: string | null; stdout: string; stderr: string
}
export interface Isolation { readonly id: string; readonly bwrap: string; readonly layout: unknown }
export type Certification =
  | { certified: true; isolation: Isolation; problems: string[]; evidenceDir: string }
  | { certified: false; problems: string[]; evidenceDir: string }
export type ScriptResponse =
  | { status: number; headers?: Record<string, string>; body?: string; body_base64?: string; body_read?: 'fail' }
  | { connect: 'fail' }
export interface ScriptRule { method?: string; endpoint: string; query?: Record<string, string>; responses: ScriptResponse[] }
export interface ResponseScript { schema: 'kol-observer-script/v1'; rules: ScriptRule[] }
export interface RunOptions {
  isolation: Isolation; entry: ObserverEntry | 'control'; args: readonly string[]; cwd: string
  script: ResponseScript; evidenceDir: string; apiKey?: ApiKey; timeoutMs?: number
}
export type Zero =
  | { verdict: 'pass' }
  | { verdict: 'red'; requests: number }
  | { verdict: 'facility'; side: 'target' | 'positive'; cause: FacilityCause; reason: string }
  | { verdict: 'fixture'; reason: string }

/** 整合方注入的观察器公开调用面（ADR-70:3279-3283、:3292、:3319）。测试只调这四个。 */
export interface ObserverFacility {
  certifyIsolation(o: { evidenceDir: string }): Certification
  runObserved(o: RunOptions): ObservedRun
  zeroVerdict(target: Observation, positive: Observation | undefined): Zero
  readEvents(text: string): { events: Array<Record<string, unknown>>; problems: string[] }
}

/** G5 的被测函数：只按导出签名 `sortForOutput(creators: Creator[]): Creator[]`（scripts/lib/rows.ts:170）由整合方传入。
 *  Creator 完整声明不在包内（GAP-18），这里写 unknown[]，不编造字段。 */
export type SortForOutput = (creators: unknown[]) => unknown[]

// ---- E 节契约插槽（冻结单 pack/30-frozen-spec.md:1795-1867）----
// E-1/E-2/E-3 尚未由实现方公开、需求方确认。下列接口只是测试侧给将来接入留的插槽（形式选择，不是产品契约）：
// 字段只取冻结单 E 节「至少含」所列各项；传入方式与通道格式在契约公开后由整合方实现。没传 = 依赖它的断言不判。

export type SavePoint = 'SP-R' | 'SP-200' | 'SP-N200' | 'SP-NS' | 'SP-BUD'
/** E-2 第 4 条命中证据（:1836）。miss=true 表示入口写的「未命中」记录。 */
export interface E2HitRecord {
  point: SavePoint; occurrence: number; entry: string
  attempt_id?: number; endpoint?: string; notWritten: boolean; miss?: boolean
}
export interface E2Adapter {
  /** E-2 第 2、3 条：选〈保存点，第 k 次出现，只这一次〉；只能经公开命令行开关或 cwd 下控制文件传入（:1834-1835）。 */
  arm(point: SavePoint, k: number, at: { cwd: string; evidenceDir: string }): { extraArgs?: string[]; files?: Record<string, string> }
  /** 取回本跑的命中记录（:1836；不写 stdout）。 */
  hits(run: ObservedRun): E2HitRecord[]
}
/** E-3 第 3 条预留事件（:1853）。stderrLine：取 stderr 通道时该事件所在的 stderr 行号（从 0 数）。 */
export interface E3ReserveEvent {
  entry: string; scope: 'task' | 'process'; endpoint: string; unit_micro_usd: number
  result: 'reserved' | 'rejected'; attempt_id?: number; reason?: string; stderrLine?: number
}
export interface E3Adapter {
  channel: 'stderr' | 'events'
  /** E-3 第 2 条就绪标记（:1852）。 */
  ready(run: ObservedRun): boolean
  events(run: ObservedRun): E3ReserveEvent[]
  /** E-3 第 5 条：取 stderr 通道时，固定前缀的行不参与 stderr 语义复核（:1855）。 */
  stripFromStderr?(stderr: string): string
}

// ---- 前提登记（GAP / E 编号；冻结单 B 节 :1563-1610、E 节）----
// 子编号（①④、a/b/c）是本测试为分别开关同一 GAP 的不同小题而加的标签，各自对应冻结单原文：
//   GAP-07①  pending_keywords / keywords_done 的 JSON 形状（:1575 第①题）
//   GAP-07④  error 收尾汇总是否必带 pending_keywords（:1575 第④题；:56）
//   GAP-18   完整 Creator 声明或公开夹具资格检查（:1586）
//   GAP-24a  名单为空的续跑是否走到读记忆（:1592；G3-15 :1313）
//   GAP-24b  保存失败后的收尾是否读记忆（:1592；G3-14c :1277）
//   GAP-24c  collect 读不出记忆时原文件是否必不被改动（:1592；BYTES(memory) 子断言）
//   GAP-39   TikTok profile 404 后是否改用 secUid 再查（:1607）
//   GAP-40   stderr 写出时刻与 request 事件的先后（:1608）
//   E-1/E-2/E-3  契约公开并经需求方逐字确认（:1797）
// answer：只有冻结单把「补齐后照现有 expected 判」写死的那一种答案才放行，见 suite.ts 各处 gate。
export type ConditionId =
  | 'GAP-07①' | 'GAP-07④' | 'GAP-09' | 'GAP-10' | 'GAP-18' | 'GAP-20'
  | 'GAP-24a' | 'GAP-24b' | 'GAP-24c' | 'GAP-39' | 'GAP-40' | 'E-1' | 'E-2' | 'E-3'
export interface Resolution { resolved: true; ref: string; answer?: string }

/** 语义复核记录（冻结单 :13、:67）：评审人读 stderr（或指明的文本）后给出结论，并绑定所读文本的 SHA-256 与所依据的原文行。 */
export interface ReviewRecord {
  key: string                       // `${用例号}/${标签}`，或 `GAP-25@${跑号}`、`PK@${用例号}/${标签}`
  verdict: 'pass' | 'red' | 'parse-failure' | 'no-parse-failure' | 'gap07'
  textSha256: string                // 所复核文本的 SHA-256（与本跑实际输出绑定，防止旧复核替新输出作证）
  quotes?: string[]                 // 所依据的那一行（几行）原文，必须逐字出现在该文本里
  reviewer: string
  note?: string
}
