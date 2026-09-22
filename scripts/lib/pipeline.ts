import { creatorKey, type Creator, type Platform, type SearchTask, type TaskState } from './types.js'
import { linkCrossPlatform, mergeCrossPlatform } from './identity.js'
import {
  passesFollowerGate, scoreCreator, tierOf, applyGeoPenalty, applyAudienceRiskPenalty,
} from './score.js'
import { filterByMemory, type MemoryStatus } from './memory.js'
import { sortForOutput } from './rows.js'

/*
 * 入口脚本里不该有决策逻辑。
 *
 * 这里装的是 collect.ts 的 main() 和 render.ts 顶层原先裸露的两段管线。
 * 每一步单独都对，错的会是它们的**组合方式** —— ADR-08 那个「续跑清空名单」
 * 的数据丢失 bug 正好落在这段，而当时全套检查（含已撤的纪律 lint）全部放行：
 * 它不在任何一个单元里，所以任何单元测试都看不到它。
 *
 * 这是本仓库第四次踩「逻辑埋在入口脚本就测不了」这个坑，前三次见 ADR-08。
 * 判断一段代码该不该搬到这里，只问一句：**它的顺序错了会不会出错？**
 * 会，就说明它有语义，有语义就该能被测。
 */

// ═══════════ collect 的收尾 ═══════════

export interface FinalizeResult {
  kept: Creator[]
  linked: number
  unknown_followers: number
  filtered_recommended: number
  filtered_contacted: number
  /** 这一批有没有去过重 —— 收尾算出来的永远是肯定的答案，「无从确认」只会来自盘上 */
  memory_status: Exclude<MemoryStatus, 'unknown'>
}

/**
 * 从采集累加器算出交付名单。**四步的先后都是有约束的**：
 *
 *   同人识别 → 合并 → 粉丝闸门 → 记忆过滤
 *
 * 合并必须在闸门**之前**：合并会把两个平台的粉丝数相加，先过闸门会把
 * 「TikTok 3000 + Instagram 3000、合起来 6000 够线」的人提前丢掉。
 *
 * 闸门必须在记忆过滤**之前**：filtered_contacted 报的是「本可进名单、但因为
 * 联系过而排除」的人数。先过记忆会把连闸门都过不了的人也算进去，虚报打扰规模。
 *
 * 不写盘，也**不修改传入的数据** —— 累加器只增不减（D6）是这个函数的结构性
 * 保证，不依赖调用方记得先落盘再调用。
 *
 * 记忆读不出来时这里会抛（P4 无法保证就不产出名单，ADR-15）。入口负责把它
 * 翻译成退出码和一条人能照做的话；**要不要继续的决定不在入口**，
 * 由调用方显式传 ignoreUnreadableMemory 表达。
 */
export function finalize(
  raw: Creator[], product: string, task?: string,
  opts: { ignoreUnreadableMemory?: boolean } = {},
): FinalizeResult {
  const all = structuredClone(raw)
  const linked = linkCrossPlatform(all)
  const merged = mergeCrossPlatform(all)

  // P1：粉丝数未知的**不丢弃** —— 「没查到」不等于「不合格」。留下并计数上报，
  //     由用户决定要不要看。静默过滤会让真实创作者凭空消失且无人知晓。
  const unknown_followers = merged.filter(c => c.followers === undefined).length
  const gated = merged.filter(passesFollowerGate)

  const { kept, filtered_recommended, filtered_contacted, memory_status } =
    filterByMemory(gated, product, task, { ignoreUnreadable: opts.ignoreUnreadableMemory })
  return { kept, linked, unknown_followers, filtered_recommended, filtered_contacted, memory_status }
}

/**
 * 这个人还要不要补 profile。
 *
 * **它决定要不要花钱**，所以有语义，所以不留在入口脚本里。抽出来的第二个理由
 * 更实际：补全循环和「续跑要花多少钱」那句话必须用**同一个**判定 ——
 * 两处各写一份表达式，迟早有一边先改，而先改的那边不会报错（ADR-25）。
 */
export function needsProfile(c: Creator): boolean {
  return c.bio === undefined || !c.bio_links?.length
}

/**
 * **续跑真正会去抓的关键词。**
 *
 * 「不在 done 里」不等于「续跑会去抓」：已经达标、而且每个关键词都抓过第一页时，
 * 续跑一个请求都不会发 —— 那些词没被标记完成，却也不会再被碰（ADR-25 追记）。
 * 拿 `pendingKeywords` 去说「续跑要花钱」在这种局面下会**多报**：方向和之前
 * 那几次相反，危害也不同 —— 那几次是让用户少估了开销，这次是让他以为要花钱
 * 而不敢续跑，而不续跑就永远拿不到那份已经付过钱的名单。
 *
 * 反过来**少报**同样有害，而这正是 F9 改掉的那一半：达标之后仍然要给「一页都
 * 没抓过」的任务补第一页，说成「续跑不产生新的请求」就是把要花的钱藏起来。
 */
export function keywordsResumeWillRun(state: TaskState, qualified: number): string[] {
  const owed = firstPagePending(state)
  // F9.e：无从确认 → 续跑一个关键词都不抓，所以这一半是空的。
  // **这一支要排在达标判断之前** —— 排在后面的话，没达标那条路会交回「不在 done 里的」全部，
  // 而调度那边一个都不会抓，两句话当场对不上。
  if (owed === null) return []
  if (qualified < state.target_count) return pendingKeywords(state)
  // F9：达标了也照样去抓**一页都没抓过**的那些 —— 第一页不受达标判断约束。
  const first = new Set(owed)
  return state.tasks.filter((_, i) => first.has(i)).map(label)
}

/**
 * 一页都没抓过的任务下标（F9）。**三态在返回值里，调用方分不掉：**
 *
 * - `null` —— 整张分页记录表缺失，**无从确认**哪些任务查过（F9 落地之前的旧任务目录）
 * - `[]` —— 表在，但没有一个任务欠着第一页
 * - `[i, …]` —— 这几个任务一页都没抓过
 *
 * **`null` 和 `[]` 不能合成一个。** 早先这里两种都交回 `[]`，调用方于是分不出
 * 「无从确认」和「没有一个欠着」—— 症状是：没达标那条路根本不问这个集合，直接从
 * `offset 0` 重抓，把已经付过钱的几页整批重买一遍（#138 评审指出，实测
 * `requests` 4 → 172、`offsets` 被重写成 `{0: 80, 1: 80}`）。
 * 推错的代价不对称，所以**无从确认时一个都不抓**；这不是断言「都查过了」，
 * 而是在拿不到证据时唯一不会多花钱的取法。
 *
 * **这份判定只此一份** —— 调度（`collect.ts` 的 `run()`）、「续跑要不要花钱」那句话
 * 共用它。各写一份表达式的话，先改的那边不会报错，而用户看到的那句话就开始撒谎
 * （同 `needsProfile` 的先例，ADR-25；也是 F9.c 逐字要求的那件事）。
 */
export function firstPagePending(state: TaskState): number[] | null {
  // **读 offsets，不读 answered** —— 隔壁 `taskQueryStatus` 不是这一份的副本：
  // 这里问「这一页付过钱没有」，那里问「发出过请求没有」。合用一张表时两者都不准
  // （ADR-94 第十五节甲）。
  const offsets = state.offsets
  if (offsets === undefined) return null
  return state.tasks
    .map((_, i) => i)
    .filter(i => !state.done.includes(i) && !(i in offsets))
}

/**
 * 这个任务查询过没有（P5.i 四态里的前三态）。
 *
 * ⚠️ **它和 `firstPagePending` 不是同一份判定，读的也不是同一张表。**
 * 那个读 `offsets` 答「这一页付过钱没有」，这个读 `answered` 答「发出过请求没有」。
 * 一度合用一张表，独立复核推翻了那个设计 —— `offsets` 只在 `search()` 正常返回之后才写，
 * 「请求发了、钱扣了、在写它之前抛了」会塌回「没查过」（ADR-94 第十五节甲）。
 *
 * 第四态「查了 0 命中」不在这里 —— 它由条数给（`found[i]` 为 0），见 `keywordRows`。
 */
export type TaskQueryStatus = 'unknown' | 'unqueried' | 'queried'

export function taskQueryStatus(state: TaskState, i: number): TaskQueryStatus {
  const answered = state.answered
  // ⚠️ `== null` 不是手滑：盘上那个值是**反序列化进来的外部输入**，`null` 与整张表缺失
  // 一样是「无从确认」。只判 `undefined` 的话，`answered: null` 会让 `i in answered` 当场抛，
  // 而抛的位置在 render **写完名单、写回记忆之后** —— 交付物互相矛盾（`4-VERIFY.md`）。
  if (answered == null) return 'unknown'
  return i in answered ? 'queried' : 'unqueried'
}

/** 尚未跑完的关键词 —— Agent 据此向用户报进度、问要不要追加预算 */
/**
 * 单个任务的页数上限（D6.h）。**常量与判定放在一起，不从入口传进来** ——
 * 传参的话调度与「续跑要不要花钱」那句话可以各拿一个数，而先改的那一边不会报错
 * （`needsProfile` 栽过的同一个形状，ADR-25）。
 */
export const MAX_PAGES = 4          // 实测值：第 4 页后新增人数明显衰减

/**
 * 这个任务**累计拿回了几页** —— 三态，调用方分不掉：
 *
 * - `0`     —— 确知一页都没抓过（分页游标里没有它的键；那个键只在 `search()` 正常
 *              返回之后才写，所以「没有键」⇒「没成功拿回过页」是恒真的，不是推测）
 * - `n > 0` —— 确知抓了 n 页
 * - `null`  —— **无从确认**：这张表里有它的键而值认不出（反序列化进来的外部输入：
 *              负数、小数、字符串），或者表整个缺失而分页游标里有它的键（抓过至少一页，
 *              几页无从确认，D6.m）
 *
 * **`null` 不许被压成 0。** 压成 0 的话，上一版留下的目录里每个已经抓过页的词都会
 * 重新拿到一份满配额，而那种目录正是今天用户手上的形状 —— 这条需求对现存数据一条都不管。
 * 压成「上限」那一侧（不再翻页）才是拿不到证据时不多花钱的那一边，与 F9.e 同一个取法。
 *
 * 分页游标整张缺失时交回 `null`：那时 F9.e 已经让这一跑一个关键词都不抓，这里给什么
 * 都不改变行为，但交回 `null` 才是实话。
 */
export function pagesFetched(state: TaskState, i: number): number | null {
  const pages = state.pages
  // **先问键在不在，再验值。** 合起来写成 `pages?.[i]` 认不出就往下掉的话，
  // 一个写脏的值（`-1`、小数、字符串）会在分页游标里恰好**没有**这个键时落进
  // 下面那句的 `0` —— 「认不出」当场变成「确知一页都没抓过」，再给一份满配额。
  // 评审指出；而我原来那条断言只试了游标里**有**键的情形，偶然被救回来（M-D6-aa 守着）。
  if (pages !== undefined && i in pages) {
    const n = pages[i]
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null
  }
  const offsets = state.offsets
  if (offsets === undefined) return null
  return i in offsets ? null : 0
}

/** 还能不能再为这个任务翻一页 —— 上限判定只此一份，调度与收尾那句话共用 */
export const underPageCap = (state: TaskState, i: number): boolean => {
  const n = pagesFetched(state, i)
  return n !== null && n < MAX_PAGES
}

export function pendingKeywords(state: TaskState): string[] {
  return state.tasks.filter((_, i) => !state.done.includes(i)).map(label)
}

/** 关键词×平台的展示名。两处列表共用，免得一处带 # 一处不带。 */
const label = (t: TaskState['tasks'][number]): string =>
  `${t.as_hashtag ? '#' : ''}${t.keyword}(${t.platform})`

/**
 * **收尾时说给用户的那句话：续跑还要不要花钱。**
 *
 * 这句话有两支，而选哪一支是判定 —— 说反了的代价不对称：说成「不花钱」，
 * 用户放心去续跑，账单在他不知情时又长一截；说成「要花钱」，用户不敢续跑，
 * 那份已经付过钱的名单就永远拿不到（ADR-25）。
 *
 * 抽出来是因为它原来长在入口脚本里：把两支对调，检查链一路全绿 —— 端到端
 * 那条自检只验「两句话里出现了一句」，正好分不出是哪一句（评审指出）。
 *
 * **两个剩余量也在这里数**，不由调用方递进来：递数字的话，第二个写死成 0、
 * 或者两个参数调个位置，下面每一条断言和每一条变异都照样绿，而用户看到的那句话
 * 是错的 —— 那个缺口至今没有变异守着（变异缺省跑的是 `scripts/test.ts`，够不到入口
 * 脚本；改跑自检的那条路要在变异上写 `by`，这一处还没写，ADR-70）。把数数搬进来，
 * 这一类错误就不再有地方发生（评审指出）。
 *
 * 数法不是新写的：关键词那一半是 `keywordsResumeWillRun`（D6.g —— 按**续跑那一刻**的
 * `qualified()` 重算，而不是按「不在 done 里的」；达标提前停下**不等于**续跑不去抓：
 * 补全把粉丝数写回之后那个数会掉，而且还欠着第一页的任务无视达标照抓不误，
 * 见 ADR-94 第十三节与 F9），profile 那一半是 `needsProfile`（D6.d —— 哪些人还要补；
 * 「补全循环与这里共用它」那条约束在 `docs/ARCHITECTURE.md` 的锚点行上）。
 *
 * **`collect.ts` 里有两处调它**，对应两条判据：
 *
 * - `catch (MemoryUnreadable)` 里那一处，退出码 2、不产出名单 —— **D6.e**
 * - 产出了名单的四种收尾共用的那一处（在 `stopped` 分支之前）：关键词跑完、
 *   达标提前停下、预算用尽、出错中止 —— **D6.f**
 *
 * 分成两条判据是因为两处**能各自坏掉**；四种收尾共用一处，所以它们合起来才是一条。
 *
 * 缺省那个验证者（`scripts/test.ts`）够不到入口脚本，两处都由自检端到端守着。
 * **两处现在各有一条负片**：`M-D6-j` 改跑自检来验，`kills` 点名四条收尾夹具**全部**，
 * 一条没红就判「红错了地方」（5c 第二片把 `kills` 收成一组之前只点得着第一条）——
 * 它证明的是四条都还活着、都靠那一行，不是「四条路能各自坏掉」，后者仍欠着；
 * `P3.b` 那一处由 `M-P3-b` 守着断点记的内容；它逐字要求的另外两件（捕获、退出码 3）今天
 * 拿不到负片，理由是判定层的结论（弄坏它们打的是进程级失败，整次判「跑不起来」），记在 ADR-70。
 *
 * ⚠️ **同一段夹具还抓着 `D6.a`**（续跑从断点起算、断点在它点名的那个文件名下），
 * 由 `M-D6-m` 与 `M-D6-n` 守 —— 违反的是谁、被哪条断言抓到，不必是同一条需求。
 *
 * **两条都不在 `mutations.json` 的 `exemptions` 里** —— D6.f 原先登记过，落地 4 撤了；
 * `P3.b` 从头到尾没登记过。D6.e 也不必：它说的是「那句话说什么」，在 `scripts/test.ts`
 * 里有认领；`M-D6-f`／`M-D6-g`／`M-D6-h` 的 `req` 写的是 `D6`，按「编号逐字相同」守的是
 * 需求级的 D6、不是判据 D6.e，但判据这一头有测试认领就不会被报成缺口（ADR-25）。
 */
export function resumeCostLine(
  dir: string, state: TaskState, qualified: number, creators: Creator[],
): string {
  const keywordsLeft = keywordsResumeWillRun(state, qualified).length
  const profilesLeft = creators.filter(needsProfile).length
  // F9.e：整张分页记录表缺失时**要说出来**。走不到下面那两支 ——
  // 关键词那一半确实为零，但理由是「无从确认」，而下面那句「采集与补全都已跑完」
  // 会被读成「都查过了」，那正是 F9.e 逐字禁的第二种误读。
  if (firstPagePending(state) === null) {
    return `已抓到的都在 ${dir}。这个目录没有分页记录（上一版留下的），无从确认哪些关键词查过 —— `
      + `为免把已经付过钱的词重抓一遍，续跑不再抓关键词`
      + (profilesLeft
        ? `；但还有 ${profilesLeft} 个人的 profile 没补，续跑会继续发请求、继续花钱。`
        : `，也不会有新的请求。`)
  }
  const rest = [
    keywordsLeft ? `${keywordsLeft} 个关键词` : '',
    profilesLeft ? `${profilesLeft} 个人的 profile` : '',
  ].filter(Boolean).join('、')
  return rest
    ? `已抓到的都在 ${dir}，不会重新抓；但还有 ${rest} 没跑完，续跑会继续发请求、继续花钱。`
    : `采集与补全都已跑完，结果都在 ${dir}，续跑不产生新的请求。`
}

// ═══════════ render 的分层 ═══════════

/** 受众地域不达标时降一层。C 已是最低，保持不动。 */
const DEMOTE = { A: 'B', B: 'C', C: 'C' } as const

/**
 * 算分 → 分层 → 受众地域规则 → 公开信号风险降级 → 排序。
 *
 * 顺序同样有约束：降权改的是**已经算出来的** tier，放到 tierOf 之前会被覆盖；
 * 排序又必须在降权之后，否则名单按降权前的分层排，A 区里混着已经掉到 B 的人。
 *
 * F5：没有增强层时 audience_geo 为 undefined，applyGeoPenalty 一律返回 keep ——
 * 主流程照常走完，不因为缺增强数据而中断。
 *
 * 与 finalize 相反，这个函数**就地写入** score / tier —— 调用方要把这些字段
 * 存回 creators.json，克隆反而会把结果丢掉。
 */
export function rankCreators(creators: Creator[], market: string): Creator[] {
  const kept = creators.filter(c => {
    const score = scoreCreator(c)
    c.score = score
    c.tier = tierOf(c, score)
    c.tier_adjustments = []
    const geo = applyGeoPenalty(c, market)
    if (geo === 'drop') return false
    if (geo === 'demote') {
      const from = c.tier
      c.tier = DEMOTE[c.tier]
      if (from !== c.tier) c.tier_adjustments.push({
        kind: 'audience_geo', from, to: c.tier,
        reason: `${market} 受众占比低于 30%`,
      })
    }
    // F8：必须发生在 tierOf 之后，否则降级会被重新计算的 tier 覆盖。
    if (applyAudienceRiskPenalty(c) === 'demote') {
      const from = c.tier
      c.tier = DEMOTE[c.tier]
      if (from !== c.tier) c.tier_adjustments.push({
        kind: 'audience_quality_risk', from, to: c.tier,
        reason: '公开信号受众质量风险高，降一级人工复核',
      })
    }
    return true
  })
  return sortForOutput(kept)
}

/**
 * P5.i／U3.b：关键词×平台的战果，一个任务一行。
 *
 * **从任务列表出发，不是从交付名单出发。** 从名单出发时，0 命中的词和一次都没查过的词
 * **整行都不存在** —— 而运营看不见一行，结论就是「这个方向没人」，下次预算就不投。
 * 那正是 IG 为零时最贵的那一半：报告里它和「查了没人」长得一模一样（ADR-94）。
 */
export interface KeywordRow {
  keyword: string
  platform: Platform
  dimension: string
  as_hashtag?: boolean
  /** 查询过没有（P5.i 四态的前三态，判定在 `taskQueryStatus`） */
  status: TaskQueryStatus
  /**
   * 搜索命中条数 —— 第四态在这里：`0` 是「查过、一条都没返回」。
   * `null` 是「这个数无从确认」，只在 `status` 不是 `queried` 时出现。
   * **不要把 null 渲染成 0**：那是把没测量说成测量结果是零（同 P1.e 的口径）。
   */
  found: number | null
  /**
   * 入围人数；`null` ＝无从确认或注定不全。
   * ⚠️ **各行相加可以大于名单总人数** —— 一个人可以被多个关键词搜到。
   * **与 `found` 不得合并**（单位不同：条目 vs 人），所以不再出「命中率」那一列。
   */
  shortlisted: number | null
  /** 入围里语义通过的；无从确认时为 `null` */
  fit_pass: number | null
}

/**
 * ⚠️ `state` 给顺序与身份，`delivered` 给入围 —— **两个来源缺一不可**。
 * 只拿 `delivered` 反推就回到了上面说的那个洞；只拿 `state` 则数不出入围。
 */
export function keywordRows(state: TaskState, delivered: Creator[]): KeywordRow[] {
  // **归人算不算得准，是整张名单的属性，不是某一行的。** 只要有一个人身上没带来源任务，
  // 这份名单就是本条落地之前采的 —— 那时没有这个字段，于是**每一行都会印一个确定为假的 0**。
  // ⚠️ 上一条 PR（`answered`／`found` 两张表）先合，本条后合，中间那个窗口里建的目录
  // 正是这个形状：表在、人身上没有下标。独立复核实测到两行都印「找到 40 / 入围 0」，
  // 而名单里有 3 个人（ADR-94 第十六节丁）。注释一度声称这不可能，那句话只对更早的目录成立。
  const attributable = delivered.every(c => c.source_tasks !== undefined)
  return state.tasks.map((t, i) => {
    const status = taskQueryStatus(state, i)
    // **只有真问过的行才谈得上「入围几个」。** 没问过的行印 0 就是把「没看」说成
    // 「看了没有」—— P5.i 逐字禁的那种「看起来像测量值的数」，而同一张表里
    // 「无从确认」那一行印的是「—」，两边口径必须一致。
    const counted = attributable && status === 'queried'
    // **按任务下标归人，不按（关键词, 平台）** —— 那个二元组比行粗（行的身份还带
    // dimension 与 as_hashtag），同词同平台的两行会数到同一批人，于是一个从没发过
    // 请求的行上挂着别人的测量结果（ADR-94 第十六节甲）。
    const mine = counted ? delivered.filter(c => c.source_tasks?.includes(i)) : []
    return {
      keyword: t.keyword,
      platform: t.platform,
      dimension: t.dimension,
      ...(t.as_hashtag ? { as_hashtag: true } : {}),
      status,
      // 查过才有这个数。`null` 有两种来源，渲染侧都不许写 0：
      // 没问过／无从确认，以及**问过但那一次的条数没记下来**（抛在记录之前）。
      found: status === 'queried' ? (state.found?.[i] ?? null) : null,   // null ＝ 这个数注定不全或没记下
      // ⚠️ **条数不全不等于归人不全。** 一度把两者绑在一起，理由是「同源：升级前那段」——
      // 而迁移已经被上一条 PR 整个撤掉，`found[i] = null` 今天只发生在「这一页付了钱、
      // 抛在记条数之前」：那一页一个人都没入库，前几页成功采到的人身上下标一个不少。
      // 绑着的后果是把一个**确知**的入围数抹成「无从确认」（独立复核实测：真值 3，印「—」）。
      shortlisted: counted ? mine.length : null,
      fit_pass: counted ? mine.filter(c => c.fit === '✅').length : null,
    }
  })
}

/**
 * 把一页搜索结果并进累加器，交回**新增了几个人**。
 *
 * **归人就在这里落笔**：同一个人被第二个任务搜到时保留已有字段，缺的作品可补齐；那个任务的下标要追加进
 * `source_tasks` —— 漏了这一笔，后面那个词在关键词表上被报成「找到 N 条、一个都没入围」，
 * 而运营据此把一个其实出了人的词砍掉（U3.b，ADR-94 第十六节甲）。
 *
 * ⚠️ **它从入口脚本里搬出来是为了能被缺省那个验证者够到。** 留在 `collect.ts` 的循环里时，
 * 指着它的负片只能靠整跑一遍自检来验 —— 而那是本仓库最贵的一种验证者（每条这样的负片
 * 都要把自检从头跑到尾）。判据不变，验证者便宜了一个数量级。
 *
 * `creators` 就地改，交回新增数 —— 累加器本来就是跨页跨任务共用的那一份。
 */
export function mergePage(creators: Map<string, Creator>, page: readonly Partial<Creator>[],
  i: number, t: SearchTask): number {
  let added = 0
  for (const p of page) {
    if (!p.handle || !p.platform) continue
    const k = creatorKey({ platform: p.platform, handle: p.handle })
    const seen = creators.get(k)
    if (seen) {
      // ⚠️ **只在他已经带着来源任务时才追加。** 累加器里可能有本条落地之前采的人
      // （`loadRawCreators` 从 creators.raw.json 读回来的），他们的来源**无从确认** ——
      // 凭空给一个 `[i]` 等于替他打包票说「他只来自这个任务」，而 `keywordRows` 会据此
      // 认定整张名单归得了人，于是每一行又开始印确定为假的 0（#140 评审指出）。
      const at = seen.source_tasks
      if (at !== undefined && !at.includes(i)) at.push(i)
      // **作品只补不换**：先到的那次没问过作品（IG 按账号名搜人的兜底路径），这一页带来了，
      // 就补上 —— 不补的话交付表对一个我们明明见过作品的人说「未查询」（P1.e）。
      // 判「没有」用长度不用 `undefined`：盘上旧数据里的空数组也是没问过（ADR-102）。
      // 两边都有时不合并：`RecentPost` 还没有作品 id，同一条作品在两个词下各来一次，
      // 拼起来就成了两条 —— 而重复文案在语义判定里是「非真人」的信号。并集等 id 落地再做。
      if (p.recent_posts?.length && !seen.recent_posts?.length) seen.recent_posts = p.recent_posts
      continue
    }
    creators.set(k, { ...(p as Creator), source_keyword: t.keyword,
                      source_dimension: t.dimension, source_tasks: [i] })
    added++
  }
  return added
}

/**
 * P5.i：从**任务列表**出发 —— 从采到的人反推的话，一次都没查到人的平台会整个消失。
 */
export function taskPlatforms(state: TaskState): Platform[] {
  return [...new Set(state.tasks.map(t => t.platform))]
}

/** 分层计数。未分层的不计入 —— 三个数之和小于总数就说明有人没被分层。 */
export function tierCounts(creators: Creator[]): { A: number; B: number; C: number } {
  const t = { A: 0, B: 0, C: 0 }
  for (const c of creators) if (c.tier) t[c.tier]++
  return t
}
