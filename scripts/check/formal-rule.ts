/**
 * 预算与请求提交协议的**形式化模型**与判定 —— 从入口里抽出来的那一半。
 *
 * 抽出来的理由和 `lint-rule.ts`、`size-rule.ts` 一样：判定有语义就该能被测。
 * 跑模型、打印、退出码留在 `formal.ts`。
 *
 * ── 它模型化的是什么 ──────────────────────────────────────────────
 *
 * P3 说「未经用户确认不得超出预算上限」。`Budget.charge()` 是一个纯函数，
 * 单元测试早就验过它超限会抛。**但钱不是在 charge() 里花掉的** ——
 * 是在 `providers/tikhub.ts` 的 `fetch` 那一行花掉的，而 charge 与 fetch
 * 之间、fetch 与「把请求数写进 task.json」之间，都隔着可以崩溃的窗口。
 *
 * 那两个窗口不在任何一个单元里，所以任何单元测试都看不到它们
 * （`docs/CONVENTIONS.md` 第 10 条说的正是这一类）。只有把
 * 「内存里的计数 / 盘上的计数 / 供应商真正收了几次钱」三者放进同一个状态机、
 * 穷举所有交错，才谈得上回答 P3。
 *
 * ── 保证到哪为止 ──────────────────────────────────────────────────
 *
 * 这里有两半，**买到的东西不一样，报告里必须分开说**：
 *
 * | 半 | 跑的是什么 | 保证等级 |
 * |---|---|---|
 * | `explore()` | 抽象模型的**全部**可达状态 | 有界模型检查 —— 只对模型成立 |
 * | `conformance()` | **真的** `Budget` 与 **真的** `TikHub.get()` | 真实实现，但只在有界的响应序列上 |
 *
 * 两半之间由 `modelCall()` 连起来：它是协议在「一次 get() 调用」这个粒度上的
 * 投影，`explore()` 用它的分解动作，`conformance()` 拿它和真实实现逐步对照。
 * 一份只有 `explore()` 的资产会是 `formal/` 目录里一个与实现无关的玩具。
 *
 * ── 不在模型里的东西 ──────────────────────────────────────────────
 *
 * 入口脚本（`collect.ts` / `enrich.ts`）的落盘节奏与退出码接线**是模型化的、
 * 不是执行的** —— 它们是入口，import 不进来。对应关系逐条写在
 * `formal/budget/IMPLEMENTATION-MAP.md`，靠人核。
 */

// ═══════════ 一、状态与边界 ═══════════

/** 协议里一次请求的三个位置。崩溃可以发生在任意一个上 */
export type Phase = 'idle' | 'charged' | 'sent'

export interface State {
  /** 活着的进程里 `Budget.requests` */
  local: number
  /** `task.json` 的 `requests` —— 崩溃之后只剩下它 */
  disk: number
  /** 供应商**真正收了钱**的次数。这是 P3 要管的那个数，代码里没有任何变量装着它 */
  billed: number
  /** 供应商**收到**的提交次数（含非 200）。billed 与它的差就是那条环境假设 */
  sent: number
  phase: Phase
  /** 距上次落盘已经计费了几次 —— 崩溃时丢掉的就是这一段 */
  sinceSave: number
  /** 本进程已经提醒过的阈值个数（0..2）。0.8 成立时 0.5 必然也成立，所以数个数够用 */
  warnedHere: number
  /** 整个任务里的提醒总次数 —— 跨进程，F7.a 的「不重复触发」要看它 */
  warnTotal: number
  alive: boolean
  /** 预算已经拒绝过一次请求 */
  exit: 'none' | 'budget'
  /** 已经保存断点并以退出码 3 收尾 */
  stopped: boolean
  /** 已经续跑了几次。**没有它状态空间是无穷的** —— 崩溃与续跑可以无限循环，
   *  每一轮都把提醒集合清空再触发一次，`warnTotal` 一路涨上去 */
  resumes: number
}

export interface Bounds {
  /** 已确认的预算上限，折算成请求数（`UNIT_PRICE` = $0.001/次） */
  limit: number
  /** 有界：供应商侧最多收到多少次提交。状态空间靠它封顶 */
  maxSent: number
  /** 有界：最多续跑几次 */
  maxResumes: number
  /** 每计费几次落一次盘。1 = 每次都落；N = 入口脚本的实际节奏 */
  persistEvery: number
  /** **环境假设**：非 200 供应商计不计费。`Budget.refund()` 押的就是这一条 */
  billNon200: boolean
  /** 进程会不会在任意一步崩掉 */
  mayCrash: boolean
  /** 负例开关：把预检写成「先记账再判断」，闸门形同虚设 */
  brokenCharge: boolean
}

/** 阈值。与 `lib/budget.ts` 的 `[0.5, 0.8]` 是同一个口径（F7） */
const THRESHOLDS = [0.5, 0.8]

/** 初始状态。导出是为了 `scripts/test.ts` 能从这里出发单步验一条动作 */
export const initialState = (): State => ({
  local: 0, disk: 0, billed: 0, sent: 0, phase: 'idle', sinceSave: 0,
  warnedHere: 0, warnTotal: 0, alive: true, exit: 'none', stopped: false, resumes: 0,
})

/**
 * 提醒了几个阈值。
 *
 * 照 F7 的口径：跨越 0.5 与 0.8 时各提醒一次。上限为 0 时没有百分比可言，
 * 不提醒 —— 与 `Budget.pct` 在 `limitUsd <= 0` 时返回 0 是同一件事。
 */
function warnAfter(local: number, b: Bounds, already: number): number {
  if (b.limit <= 0) return already
  const pct = local / b.limit
  const due = THRESHOLDS.filter(t => pct >= t).length
  return Math.max(already, due)
}

// ═══════════ 二、动作 ═══════════

export type Action =
  | 'charge' | 'send' | 'ok' | 'nonOk' | 'persist' | 'crash' | 'resume' | 'stop'

export const ACTIONS: Action[] =
  ['charge', 'send', 'ok', 'nonOk', 'persist', 'crash', 'resume', 'stop']

/**
 * 一步转移。不合法（动作在这个状态下没开启）返回 `null`。
 *
 * **每个动作都对应实现里一处真实的位置**，对应表在
 * `formal/budget/IMPLEMENTATION-MAP.md`。没有对应位置的动作不许加进来 ——
 * 那样得到的就是一个自洽但与产品无关的模型。
 */
export function step(s: State, a: Action, b: Bounds): State | null {
  switch (a) {
    case 'charge': {
      if (!s.alive || s.stopped || s.phase !== 'idle' || s.exit !== 'none') return null
      if (s.sent >= b.maxSent) return null              // 有界
      if (b.brokenCharge) {                             // 负例：先记账，再判断
        const local = s.local + 1
        return { ...s, local, phase: 'charged', warnedHere: warnAfter(local, b, s.warnedHere),
                 warnTotal: s.warnTotal + (warnAfter(local, b, s.warnedHere) - s.warnedHere) }
      }
      // P3.a：不够就抛，**且不增加计数**
      if (s.local + 1 > b.limit) return { ...s, exit: 'budget' }
      const local = s.local + 1
      const warnedHere = warnAfter(local, b, s.warnedHere)
      return { ...s, local, phase: 'charged',
               warnedHere, warnTotal: s.warnTotal + (warnedHere - s.warnedHere) }
    }
    case 'send': {
      // 钱是在这一步花掉的 —— charge 之后、结果回来之前
      if (!s.alive || s.phase !== 'charged') return null
      return { ...s, phase: 'sent', sent: s.sent + 1 }
    }
    case 'ok': {
      if (!s.alive || s.phase !== 'sent') return null
      return { ...s, phase: 'idle', billed: s.billed + 1, sinceSave: s.sinceSave + 1 }
    }
    case 'nonOk': {
      // 非 200：`Budget.refund()` 退还一次计数。**供应商那边退不退，是环境假设**
      if (!s.alive || s.phase !== 'sent') return null
      return {
        ...s, phase: 'idle',
        local: Math.max(0, s.local - 1),
        billed: s.billed + (b.billNon200 ? 1 : 0),
        sinceSave: s.sinceSave + (b.billNon200 ? 1 : 0),
      }
    }
    case 'persist': {
      // `collect.ts` 的 persist()：把内存里的计数写进 task.json
      if (!s.alive || s.phase !== 'idle') return null
      if (s.disk === s.local && s.sinceSave === 0) return null   // 无变化，不产生新状态
      if (s.sinceSave < b.persistEvery && s.sinceSave > 0) return null
      return { ...s, disk: s.local, sinceSave: 0 }
    }
    case 'crash': {
      if (!b.mayCrash || !s.alive || s.stopped) return null
      return { ...s, alive: false }
    }
    case 'resume': {
      // 续跑：新进程，Budget 用盘上的 requests 初始化，提醒集合是空的
      if (s.alive || s.resumes >= b.maxResumes) return null
      return { ...s, alive: true, local: s.disk, phase: 'idle', sinceSave: 0,
               warnedHere: 0, exit: 'none', resumes: s.resumes + 1 }
    }
    case 'stop': {
      // P3.b：捕获 BudgetExceeded 之后 persist()，再以退出码 3 结束
      if (!s.alive || s.stopped || s.exit !== 'budget' || s.phase !== 'idle') return null
      return { ...s, disk: s.local, sinceSave: 0, stopped: true }
    }
  }
}

// ═══════════ 三、不变量 ═══════════

export interface Invariant {
  name: string
  /** 它守的验收判据编号。指不回登记表的性质不许进这张表 */
  req: string[]
  says: string
  /** 状态不变量 */
  holds?: (s: State, b: Bounds) => boolean
  /** 步不变量 —— 有些性质说的是「这一步不许改什么」，单看状态表达不出来 */
  step?: (prev: State, a: Action, next: State, b: Bounds) => boolean
}

export const INVARIANTS: Invariant[] = [
  {
    name: 'NoOverspend',
    req: ['P3', 'P3.a'],
    says: '供应商真正收费的次数，永远不超过用户已确认的上限',
    holds: (s, b) => s.billed <= b.limit,
  },
  {
    name: 'RejectedNotCounted',
    req: ['P3.a'],
    says: '被预算拒绝的那一次请求不增加计数',
    step: (prev, a, next) =>
      !(a === 'charge' && prev.exit === 'none' && next.exit === 'budget')
      || next.local === prev.local,
  },
  {
    name: 'SpendIsRecorded',
    req: ['P3', 'D6.a'],
    says: '进程死掉时，盘上记着的请求数不少于供应商已经收费的次数 —— '
        + '不存在「钱已经花出去、本地却没有记录」的静默状态',
    holds: s => s.alive || s.disk >= s.billed,
  },
  {
    name: 'Exit3Recoverable',
    req: ['P3.b'],
    says: '以退出码 3 收尾时，断点里的请求数与内存里的一致（断点真的可续跑）',
    holds: s => !s.stopped || s.disk === s.local,
  },
  {
    name: 'WarnOncePerTask',
    req: ['F7.a'],
    says: '整个任务里，两个阈值各只提醒一次',
    holds: s => s.warnTotal <= THRESHOLDS.length,
  },
  {
    name: 'ResumeKeepsCount',
    req: ['D6.a'],
    says: '续跑用盘上的请求数初始化，不从零开始',
    step: (prev, a, next) => a !== 'resume' || next.local === prev.disk,
  },
]

// ═══════════ 四、穷举 ═══════════

/**
 * 状态的规范写法。
 *
 * 形状照 TLC 的 `-dump` 输出：每行一个 `/\ 变量 = 值`，变量名按字典序。
 * 两边用同一个写法，`formal/budget/BudgetProtocol.tla` 的可达状态集就能
 * **逐个字符**和这里的比对 —— 两份模型漂移时当场看得见，而不是靠人记得同步
 * （`npm run formal -- --tla`）。
 */
export function canonical(s: State): string {
  const v: Record<string, string> = {
    alive: s.alive ? 'TRUE' : 'FALSE',
    billed: String(s.billed),
    disk: String(s.disk),
    exit: `"${s.exit}"`,
    local: String(s.local),
    phase: `"${s.phase}"`,
    resumes: String(s.resumes),
    sent: String(s.sent),
    sinceSave: String(s.sinceSave),
    stopped: s.stopped ? 'TRUE' : 'FALSE',
    warnTotal: String(s.warnTotal),
    warnedHere: String(s.warnedHere),
  }
  return Object.keys(v).sort().map(k => `/\\ ${k} = ${v[k]}`).join('\n')
}

export interface Violation {
  invariant: string
  req: string[]
  says: string
  /** 最短反例：从初始状态到违反那一步的动作序列 */
  trace: { action: Action | 'init'; state: State }[]
}

export interface ExploreResult {
  states: number
  /** 全部可达状态的规范写法，排过序 —— 给 TLA+ 那一侧比对用 */
  canonicalStates: string[]
  /** 每条被违反的不变量各留**一条最短反例**。多留没有价值，读的人只看第一条 */
  violations: Violation[]
  /** 探索有没有撞到边界（撞到说明 maxSent 定小了，结论的覆盖面比声称的窄） */
  truncated: boolean
}

/**
 * 宽度优先穷举全部可达状态。
 *
 * 宽度优先不是偏好：它保证**第一次**撞见的违反就是最短反例，而一条读不完的
 * 反例轨迹和没有反例的区别只有心理作用。
 */
interface Node { state: State; from: string | null; via: Action | 'init' }

export function explore(b: Bounds): ExploreResult {
  const start = initialState()
  const seen = new Map<string, Node>()
  const k0 = canonical(start)
  seen.set(k0, { state: start, from: null, via: 'init' })
  const queue: string[] = [k0]
  const violations = new Map<string, Violation>()
  let truncated = false

  const traceTo = (key: string): { action: Action | 'init'; state: State }[] => {
    const out: { action: Action | 'init'; state: State }[] = []
    let cur: string | null = key
    while (cur !== null) {
      const node: Node = seen.get(cur)!
      out.unshift({ action: node.via, state: node.state })
      cur = node.from
    }
    return out
  }

  const record = (inv: Invariant, key: string) => {
    if (violations.has(inv.name)) return
    violations.set(inv.name, {
      invariant: inv.name, req: inv.req, says: inv.says, trace: traceTo(key),
    })
  }

  for (const inv of INVARIANTS) if (inv.holds && !inv.holds(start, b)) record(inv, k0)

  while (queue.length) {
    const key = queue.shift()!
    const { state } = seen.get(key)!
    // 只有**被边界挡住**才算撞界：那一步本来开着，是 maxSent / maxResumes 把它关掉的
    if (state.alive && state.phase === 'idle' && state.exit === 'none' && !state.stopped
        && state.sent >= b.maxSent) truncated = true
    if (!state.alive && state.resumes >= b.maxResumes) truncated = true
    for (const a of ACTIONS) {
      const next = step(state, a, b)
      if (!next) continue
      const nk = canonical(next)
      const fresh = !seen.has(nk)
      if (fresh) seen.set(nk, { state: next, from: key, via: a })
      for (const inv of INVARIANTS) {
        if (inv.step && !inv.step(state, a, next, b)) record(inv, nk)
        if (inv.holds && !inv.holds(next, b)) record(inv, nk)
      }
      if (fresh) queue.push(nk)
    }
  }

  return {
    states: seen.size,
    canonicalStates: [...seen.keys()].sort(),
    violations: [...violations.values()],
    truncated,
  }
}

// ═══════════ 五、场景：每条不变量在每个配置下**预期**是什么 ═══════════

/**
 * 记的是**已知的事实**，不是愿望。
 *
 * 一条现在会失败的性质，把它记成「预期成立」只会让检查天天红；记成「预期失败」
 * 又会让它变成一条永远不会失败的检查（`process/4-VERIFY.md`）。所以两边都记：
 * **预期失败的还要对上最短反例的长度**。模型被改松、反例变长或消失，一样红。
 */
export interface Expectation {
  /** 不变量名 → 预期。`true` = 成立；数字 = 预期失败，且最短反例正好这么多步 */
  [invariant: string]: true | number
}

export interface Scenario {
  name: string
  why: string
  bounds: Bounds
  expect: Expectation
}

const BASE: Bounds = {
  limit: 2, maxSent: 4, maxResumes: 2, persistEvery: 1, billNon200: false,
  mayCrash: true, brokenCharge: false,
}

/**
 * 每条预期后面写的是**怎么推出来的**，不是跑一遍粘回来的数
 * （`process/4-VERIFY.md`：expected 不许来自运行结果）。步数含 `init` 那一步。
 */
export const SCENARIOS: Scenario[] = [
  {
    name: 'spec',
    why: '需求描述的那个协议：每次请求前过闸门、每计费一次就落盘、非 200 不计费、进程随时可能死',
    bounds: { ...BASE },
    expect: {
      NoOverspend: 12,       // 上限 2：先正常花满（charge·send·ok ×2 = 6 步），
                             // crash + resume 把内存计数退回盘上的 0，再花一次（3 步）
                             // → 供应商收了 3 次钱。1+6+2+3 = 12
      RejectedNotCounted: true,
      SpendIsRecorded: 5,    // 一次完整的计费请求，落盘之前死掉：charge·send·ok·crash
      Exit3Recoverable: true,
      WarnOncePerTask: 8,    // 上限 2 时 0.5 与 0.8 分别在 local=1、local=2 跨过。
                             // 两次提醒（charge·send·ok·charge = 4 步）之后 crash·resume
                             // 把本进程的提醒集合清空，再 charge 又提醒一次。1+4+2+1 = 8
      ResumeKeepsCount: true,
    },
  },
  {
    name: 'entry-cadence',
    why: 'collect.ts 补 profile 那个循环里一次都不落盘 —— 丢的不再是一次请求，而是一整段',
    bounds: { ...BASE, limit: 4, maxSent: 6, persistEvery: 3 },
    expect: {
      NoOverspend: 18,       // 同上，只是上限 4：1 + 4×3 + 2 + 3 = 18
      RejectedNotCounted: true,
      SpendIsRecorded: 5,    // 与落盘节奏无关 —— 第一次计费之后就已经存在这个窗口
      Exit3Recoverable: true,
      WarnOncePerTask: 14,   // 上限 4 时 0.5 在 local=2、0.8 在 local=4 跨过。
                             // 攒够 3 次才落一次盘：3×3 步走到 local=3（提醒过一次）、
                             // persist、crash、resume 清空提醒集合，再 charge 到 local=4
                             // 一次跨过两个阈值 → 总共 3 次。1+9+1+1+1+1 = 14
      ResumeKeepsCount: true,
    },
  },
  {
    name: 'no-crash',
    why: '把崩溃动作关掉 —— 用来分清哪些违反是崩溃带来的，哪些本来就在。**这一档必须全过**',
    bounds: { ...BASE, mayCrash: false },
    expect: {
      NoOverspend: true, RejectedNotCounted: true, SpendIsRecorded: true,
      Exit3Recoverable: true, WarnOncePerTask: true, ResumeKeepsCount: true,
    },
  },
  {
    name: 'bill-non-200',
    why: '把「非 200 不计费」这条环境假设取反 —— refund() 的安全性整个押在它身上',
    bounds: { ...BASE, billNon200: true, mayCrash: false },
    expect: {
      NoOverspend: 10,       // 上限 2：一次成功（3 步）、一次非 200（3 步，计数退了、
                             // 钱没退）、再一次成功（3 步）→ 收了 3 次钱。1+9 = 10
      RejectedNotCounted: true, SpendIsRecorded: true,
      Exit3Recoverable: true, WarnOncePerTask: true, ResumeKeepsCount: true,
    },
  },
  {
    name: 'broken-charge',
    why: '**负例**：把预检写成「先记账再判断」，闸门形同虚设。检查器抓不到它就是检查器坏了',
    bounds: { ...BASE, brokenCharge: true, mayCrash: false },
    expect: {
      NoOverspend: 10,       // 闸门不再拦，上限 2 时第三次请求照发：1 + 3×3 = 10
      RejectedNotCounted: true, SpendIsRecorded: true,
      Exit3Recoverable: true, WarnOncePerTask: true, ResumeKeepsCount: true,
    },
  },
]

export interface ScenarioVerdict {
  scenario: string
  states: number
  /** 探索有没有停在有界参数上。**永远是 true** —— 有界模型检查的定义就是这样，
   *  写出来是为了报告里不许把它说成「穷尽了全部行为」 */
  hitBound: boolean
  /** 与预期不符的那些 —— 空数组才算通过 */
  surprises: string[]
  violations: Violation[]
}

/**
 * 跑一个场景，把结果和预期比。
 *
 * **判据是「和记下来的事实一致」，不是「全绿」** —— 已知不成立的那几条，
 * 反例的长度变了同样是红。一条只会因为「变绿」而报警的检查，在模型被改松时
 * 是哑的；一条只会因为「变红」报警的检查，在缺陷被修好时是哑的。两头都要看着。
 */
export function judgeScenario(sc: Scenario): ScenarioVerdict {
  const r = explore(sc.bounds)
  const found = new Map(r.violations.map(v => [v.invariant, v]))
  const surprises: string[] = []

  for (const inv of INVARIANTS) {
    const want = sc.expect[inv.name]
    const got = found.get(inv.name)
    if (want === undefined) { surprises.push(`${inv.name}：场景没有写预期`); continue }
    if (want === true) {
      if (got) surprises.push(`${inv.name}：预期成立，实际被违反（${got.trace.length} 步）`)
      continue
    }
    if (!got) { surprises.push(`${inv.name}：预期在 ${want} 步内被违反，实际成立`); continue }
    if (got.trace.length !== want) {
      surprises.push(`${inv.name}：预期最短反例 ${want} 步，实际 ${got.trace.length} 步`)
    }
  }
  for (const name of Object.keys(sc.expect)) {
    if (!INVARIANTS.some(i => i.name === name)) surprises.push(`${name}：预期指向一条不存在的不变量`)
  }
  return { scenario: sc.name, states: r.states, hitBound: r.truncated,
           surprises, violations: r.violations }
}

// ═══════════ 六、与真实实现对照 ═══════════

/** 一次 `TikHub.get()` 调用的模型预测 */
export interface CallPrediction {
  /** 供应商收到几次提交 */
  sent: number
  /** 调用结束时 `Budget.count` */
  local: number
  /** 抛了什么：'' = 正常返回 */
  threw: '' | 'BudgetExceeded' | 'TikHubError'
  /** 每次提交的那一刻，`Budget.count` 至少应该是多少 —— 「先记账再发请求」看的是它 */
  countAtSend: number[]
  /** 提醒了几次 */
  warns: number
}

/**
 * 协议在「一次 get() 调用」这个粒度上的投影。
 *
 * 写它的依据是需求，不是实现原文：P3.a 说**每次请求之前**先过闸门、不够就抛
 * 且不增加计数；`skill/references/providers/tikhub.md` 说 429 退避重试、
 * 非 200 不计费。重试上限是对外可观察的（数提交次数就知道），所以它是参数 ——
 * 实现改了这个数，下面的对照会红，而不是悄悄跟着变。
 */
export function modelCall(
  outcomes: number[], limit: number, start: number, maxRetry: number,
): CallPrediction {
  let local = start
  let warnedHere = 0
  let warns = 0
  const countAtSend: number[] = []
  const b: Bounds = { limit, maxSent: 0, maxResumes: 0, persistEvery: 1,
                      billNon200: false, mayCrash: false, brokenCharge: false }

  for (let attempt = 0; ; attempt++) {
    if (local + 1 > limit) return { sent: countAtSend.length, local, threw: 'BudgetExceeded', countAtSend, warns }
    local += 1
    const w = warnAfter(local, b, warnedHere)
    warns += w - warnedHere
    warnedHere = w

    countAtSend.push(local)
    const status = outcomes[countAtSend.length - 1] ?? 200
    if (status === 200) return { sent: countAtSend.length, local, threw: '', countAtSend, warns }

    local = Math.max(0, local - 1)                       // refund
    if (status === 402) return { sent: countAtSend.length, local, threw: 'TikHubError', countAtSend, warns }
    if (status === 429 && attempt < maxRetry) continue
    return { sent: countAtSend.length, local, threw: 'TikHubError', countAtSend, warns }
  }
}

/** 一次对照的观测结果 —— 由 `formal.ts` 用真实的 Budget / TikHub 喂进来 */
export interface Observation {
  sent: number
  local: number
  threw: '' | 'BudgetExceeded' | 'TikHubError'
  countAtSend: number[]
  warns: number
}

export interface Mismatch { field: string; want: string; got: string }

/**
 * 逐项比对模型预测与真实观测。
 *
 * `countAtSend` 是这里最重要的一栏：它是**在请求真的发出去的那一刻**读到的
 * 计数。把 `charge()` 挪到 `fetch` 之后，其余每一栏的最终值都不变，只有它会
 * 在第一次提交上读到 0 —— 「先记账再发请求」这条顺序只能从它看出来。
 */
export function compareCall(want: CallPrediction, got: Observation): Mismatch[] {
  const out: Mismatch[] = []
  const cmp = (field: string, w: unknown, g: unknown) => {
    if (JSON.stringify(w) !== JSON.stringify(g)) {
      out.push({ field, want: JSON.stringify(w), got: JSON.stringify(g) })
    }
  }
  cmp('sent', want.sent, got.sent)
  cmp('local', want.local, got.local)
  cmp('threw', want.threw, got.threw)
  cmp('countAtSend', want.countAtSend, got.countAtSend)
  cmp('warns', want.warns, got.warns)
  return out
}

/**
 * 对照要跑的响应序列。
 *
 * 穷举 `{200,429,402,500}` 上长度 ≤ `len` 的全部序列 —— 有界，但这一段是**真的
 * 实现在跑**，不是模型。序列本身与上限、起始计数做笛卡尔积。
 */
export function outcomeSequences(len: number): number[][] {
  const alphabet = [200, 429, 402, 500]
  let acc: number[][] = [[]]
  const out: number[][] = []
  for (let i = 0; i < len; i++) {
    acc = acc.flatMap(seq => alphabet.map(s => [...seq, s]))
    out.push(...acc)
  }
  return out
}

/** 上限（折算成请求数）与起始计数的组合。0 与 1 各自都是边界，都要跑到 */
export const CONFORMANCE_LIMITS = [0, 1, 2, 3]
export const CONFORMANCE_STARTS = [0, 1]

/**
 * 上限可能长成的样子 —— **有限，所以可以穷举**。
 *
 * 两个来源：命令行 `--budget` 经 `Number()` 之后的结果，和 `task.json` 里
 * 反序列化出来的 `budget_usd`（那是外部输入，静态类型运行时一个字段都不拦，
 * `process/4-VERIFY.md` 的那张表里就有这一行）。
 */
export const LIMIT_DOMAIN: { shows: string; value: unknown }[] = [
  { shows: "Number('abc')", value: Number('abc') },
  { shows: "Number('3.0.0')", value: Number('3.0.0') },
  { shows: "Number('')", value: Number('') },
  { shows: "Number('1e999')", value: Number('1e999') },
  { shows: '-Infinity', value: -Infinity },
  { shows: '-1', value: -1 },
  { shows: '0', value: 0 },
  { shows: '0.005', value: 0.005 },
  { shows: '2', value: 2 },
  { shows: "task.json: '3'", value: '3' },
  { shows: 'task.json: true', value: true },
  { shows: 'task.json: null', value: null },
  { shows: 'task.json: {}', value: {} },
  { shows: 'task.json: []', value: [] },
]

/**
 * 「已经花了多少次」可能长成的样子。同样来自 `task.json`，同样是外部输入。
 * `undefined` 不在这里 —— 字段没写就是「还没花过」，按 0 算是对的。
 */
export const LEDGER_DOMAIN: { shows: string; value: unknown }[] = [
  { shows: '0', value: 0 },
  { shows: '5', value: 5 },
  { shows: 'null', value: null },
  { shows: "'4'", value: '4' },
  { shows: 'NaN', value: NaN },
  { shows: 'Infinity', value: Infinity },
  { shows: '-3', value: -3 },
  { shows: '1.5', value: 1.5 },
]

export interface GateHole { shows: string; why: string }

/**
 * **闸门到底在不在。**
 *
 * 对上限的每一个可能取值，只有两种合格的下场：要么在花钱之前就被
 * `budgetProblem` 挡下，要么真的能在超额时抛出来。第三种下场
 * ——「收下了，然后永远不抛」—— 就是 P3 那道红线的洞。
 *
 * 这一段**跑的是真实的 `Budget`**，不是模型；输入域有限，所以是穷举，
 * 不是抽样。用 `import()` 是因为它同时被 `scripts/test.ts` 调，
 * 顶层 import 会把产品代码拖进每一次判定模块的加载。
 */
export async function gateHoles(): Promise<GateHole[]> {
  const { Budget, BudgetExceeded, UNIT_PRICE, budgetProblem } = await import('../lib/budget.js')
  const out: GateHole[] = []
  for (const { shows, value } of LIMIT_DOMAIN) {
    if (budgetProblem(value) !== undefined) continue        // 花钱之前就被挡下了
    const limit = value as number
    // 合格的上限最多买得起 floor(上限 / 单价) 次；第 allowed + 1 次就该抛
    const affordable = Math.floor(limit / UNIT_PRICE)
    if (!Number.isFinite(affordable)) {
      // 穷举探不到底本身就是结论：闸门收下了一个永远不会触发它的上限
      out.push({ shows, why: `收下了这个上限，它买得起 ${affordable} 次请求 —— 闸门永远不会抛` })
      continue
    }
    const allowed = Math.max(0, affordable)
    const budget = new Budget(limit, 0)
    let charged = 0
    let caught: unknown
    let threw = false
    try {
      for (let i = 0; i <= allowed; i++) { budget.charge(); charged++ }
    } catch (e) { threw = true; caught = e }
    // 三档，不是两档：没拦 / 拦了但抛的不是 BudgetExceeded / 拦了但放行的次数不对。
    // 中间那一档最阴：调用方靠 `instanceof BudgetExceeded` 分辨「预算用尽、加钱能续」
    // 和「别的失败」，抛成 TypeError 会让 collect 退 1 而不是 3（P3.b）
    if (!threw) out.push({ shows, why: `收下了这个上限，发了 ${charged} 次请求都没有拦` })
    else if (!(caught instanceof BudgetExceeded)) {
      out.push({ shows, why: `拦是拦了，抛的却是 ${(caught as Error)?.name ?? typeof caught}`
                            + `，调用方分不出「预算用尽」和「别的失败」` })
    } else if (charged !== allowed) {
      out.push({ shows, why: `拦是拦了，但放行了 ${charged} 次，按单价算应该是 ${allowed} 次` })
    }
  }
  return out
}

/**
 * **续跑接得上账吗。**
 *
 * 对「已经花了多少次」的每一个可能取值，同样只有两种合格的下场：花钱之前被
 * `ledgerProblem` 挡下，或者续跑之后的账面确实从它接着往上加。第三种下场
 * ——「收下了，然后账退回零／变成拼接／变成 NaN」—— 就是 D6.a 那句
 * 「spent 连续不归零」的洞，而它是安静发生的：没有报错，只是下一轮又花一遍。
 */
export async function ledgerHoles(): Promise<GateHole[]> {
  const { Budget, UNIT_PRICE, ledgerProblem } = await import('../lib/budget.js')
  const out: GateHole[] = []
  for (const { shows, value } of LEDGER_DOMAIN) {
    if (ledgerProblem(value) !== undefined) continue        // 花钱之前就被挡下了
    const start = value as number
    const budget = new Budget(1, start)
    if (budget.count !== start) {
      out.push({ shows, why: `收下了，但续跑读回来的计数是 ${JSON.stringify(budget.count)}` })
      continue
    }
    if (budget.spent !== start * UNIT_PRICE) {
      out.push({ shows, why: `收下了，但已花读作 ${JSON.stringify(budget.spent)}，`
                            + `按单价算应该是 ${start * UNIT_PRICE}` })
      continue
    }
    // 收下一个坏取值之后，再花一次可能直接抛 —— 那也是一种「接不上账」，
    // 但**不能让它把这次判定整个炸掉**：进程崩了什么也没证明（4-VERIFY.md）
    try {
      budget.charge()
    } catch (e) {
      out.push({ shows, why: `收下了，再花一次直接抛 ${(e as Error)?.name ?? typeof e}` })
      continue
    }
    if (budget.count !== start + 1) {
      out.push({ shows, why: `收下了，再花一次之后计数变成 ${JSON.stringify(budget.count)}，`
                            + `应该是 ${start + 1}` })
    }
  }
  return out
}

// ═══════════ 七、拿真实实现跑一遍 ═══════════

export interface ConformanceCase { limit: number; start: number; outcomes: number[] }
export interface ConformanceFailure { where: ConformanceCase; mismatches: Mismatch[] }
export interface ConformanceResult { cases: number; sends: number; failures: ConformanceFailure[] }

/**
 * 用**真实的** `Budget` 与**真实的** `TikHub.get()` 把上面那个模型跑一遍。
 *
 * 这一段是整份资产里唯一「不是模型」的部分，所以它的接线本身就有语义：
 *
 * - `fetch` 被换掉，**但换的是它的返回值，不是它的位置** —— 请求还是从
 *   `TikHub.get()` 里那一行发出去的。谁在什么时候调它，仍然由产品代码决定
 * - 提交那一刻读一次 `budget.count`：**「先记账再发请求」这条顺序只能从这里看出来**。
 *   把 `charge()` 挪到 `fetch` 之后，最终计数一样，只有这一栏会在第一次提交上读到 0
 * - 限速用的 `sleep` 被短路。这是一条**环境假设**：等待多久不影响计费与顺序。
 *   不短路的话每个用例 150ms，几百个用例就没人会跑它了
 *
 * 恢复现场走 `finally` —— 这个函数在 `scripts/test.ts` 里也会被调到，
 * 把全局 `fetch` 留在被换掉的状态，后面的用例会莫名其妙地过或不过。
 */
export async function runConformance(
  { maxRetry = 3, seqLen = 3 }: { maxRetry?: number; seqLen?: number } = {},
): Promise<ConformanceResult> {
  const { Budget, BudgetExceeded, UNIT_PRICE } = await import('../lib/budget.js')
  const { TikHub, TikHubError } = await import('../providers/tikhub.js')

  const realFetch = globalThis.fetch
  const realSetTimeout = globalThis.setTimeout
  const failures: ConformanceFailure[] = []
  let cases = 0
  let sends = 0

  let current: { count: number } | null = null
  let script: number[] = []
  let seen: number[] = []
  let countAtSend: number[] = []

  try {
    // 限速的等待与本协议无关 —— 立刻兑现，否则每个用例 150ms
    ;(globalThis as unknown as { setTimeout: unknown }).setTimeout =
      ((fn: (...a: unknown[]) => void, _ms?: number, ...a: unknown[]) => {
        queueMicrotask(() => fn(...a)); return 0
      }) as unknown as typeof globalThis.setTimeout

    ;(globalThis as unknown as { fetch: unknown }).fetch = async () => {
      const status = script.shift() ?? 200
      seen.push(status)
      // 供应商收到请求的**那一刻**，本地已经记了几次账
      countAtSend.push(current ? current.count : -1)
      return {
        ok: status === 200,
        status,
        json: async () => ({ data: { search_item_list: [], has_more: false } }),
        text: async () => 'x',
      } as unknown as Response
    }

    for (const limit of CONFORMANCE_LIMITS) {
      for (const start of CONFORMANCE_STARTS) {
        if (start > limit) continue                 // 盘上比上限还多，不是本协议要谈的情形
        for (const outcomes of outcomeSequences(seqLen)) {
          script = [...outcomes]; seen = []; countAtSend = []
          const warns: number[] = []
          const budget = new Budget(limit * UNIT_PRICE, start, pct => warns.push(pct))
          current = budget
          const api = new TikHub('k', budget)

          let threw: Observation['threw'] = ''
          try {
            await api.search({ keyword: 'k', platform: 'tiktok', dimension: '品类词' } as never,
                             'US', 0)
          } catch (e) {
            threw = e instanceof BudgetExceeded ? 'BudgetExceeded'
              : e instanceof TikHubError ? 'TikHubError' : (`unexpected:${e}` as never)
          }

          const got: Observation = {
            sent: seen.length, local: budget.count, threw, countAtSend, warns: warns.length,
          }
          const want = modelCall(outcomes, limit, start, maxRetry)
          const mismatches = compareCall(want, got)
          if (mismatches.length) failures.push({ where: { limit, start, outcomes }, mismatches })
          cases++
          sends += seen.length
        }
      }
    }
  } finally {
    current = null
    globalThis.fetch = realFetch
    globalThis.setTimeout = realSetTimeout
  }
  return { cases, sends, failures }
}

// ═══════════ 八、和 TLC 对账 ═══════════

/**
 * 生成一个场景的 TLC 配置。
 *
 * **不把 `.cfg` 存进仓库**：常量存两份，改了 `SCENARIOS` 忘了改 `.cfg`，
 * TLC 那一侧会安静地跑一个别的模型，而两边的状态数看上去还挺像。生成出来
 * 就没有这个地方可以漂。`formal/README.md` 里贴了一份生成结果，供手跑复现。
 */
export function renderTlcConfig(
  sc: Scenario, check: { invariants?: string[]; properties?: string[] } = {},
): string {
  const b = sc.bounds
  const lines = [
    'CONSTANTS',
    `  Limit = ${b.limit}`,
    `  MaxSent = ${b.maxSent}`,
    `  MaxResumes = ${b.maxResumes}`,
    `  PersistEvery = ${b.persistEvery}`,
    `  BillNon200 = ${b.billNon200 ? 'TRUE' : 'FALSE'}`,
    `  MayCrash = ${b.mayCrash ? 'TRUE' : 'FALSE'}`,
    `  BrokenCharge = ${b.brokenCharge ? 'TRUE' : 'FALSE'}`,
    'INIT Init',
    'NEXT Next',
  ]
  for (const i of check.invariants ?? []) lines.push(`INVARIANT ${i}`)
  for (const p of check.properties ?? []) lines.push(`PROPERTY ${p}`)
  return lines.join('\n') + '\n'
}

/** 哪些不变量是「步性质」—— 在 TLC 里要写成 PROPERTY，不是 INVARIANT */
export const STEP_INVARIANTS = new Set(INVARIANTS.filter(i => i.step).map(i => i.name))

/**
 * 解析 TLC 的 `-dump` 输出。
 *
 * 每个状态一段 `State N:` + 若干 `/\ 变量 = 值`。TLC 打出来的**变量顺序不是
 * 字典序**（跟着它内部的排列），所以这里排一次序再拼 —— 与 `canonical()`
 * 对齐，两边才比得了。
 */
export function parseTlcDump(text: string): string[] {
  const out: string[] = []
  for (const block of text.split(/^State \d+:$/m)) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.startsWith('/\\ '))
    if (lines.length) out.push(lines.sort().join('\n'))
  }
  return out.sort()
}

export type TlcVerdict =
  | { kind: 'ok' }
  | { kind: 'violated'; invariant: string; trace: string }
  | { kind: 'unreadable'; why: string }

/**
 * TLC 这一跑算什么。
 *
 * 三档，不是两档：**跑不起来不算通过，也不算抓到**。语法错、jar 不对、
 * 常量漏给，都会让 TLC 非零退出而一条不变量也没检查过 —— 把那当成
 * 「抓到反例」和当成「通过」一样糟（`process/4-VERIFY.md` 的
 * 「测试进程崩了不算抓到」是同一条）。
 */
export function tlcVerdict(output: string): TlcVerdict {
  const bad = /^Error: (Invariant|Property) (\w+) is violated\.?$/m.exec(output)
  if (bad) {
    const at = output.indexOf(bad[0])
    return { kind: 'violated', invariant: bad[2], trace: output.slice(at) }
  }
  if (/^Model checking completed\. No error has been found\.?$/m.test(output)) return { kind: 'ok' }
  const err = output.split('\n').find(l => /^(Error|\*\*\* )/.test(l.trim()))
  return { kind: 'unreadable', why: err?.trim() ?? '既没说通过，也没说哪条被违反' }
}

export interface SetDiff { onlyModel: string[]; onlyTlc: string[] }

/** 两份模型的可达状态集之差。空集才算两边写的是同一个转移系统 */
export function compareStateSets(model: string[], tlc: string[]): SetDiff {
  const a = new Set(model), b = new Set(tlc)
  return {
    onlyModel: [...a].filter(s => !b.has(s)),
    onlyTlc: [...b].filter(s => !a.has(s)),
  }
}
