#!/usr/bin/env tsx
/**
 * Phase 03 —— 规模采集（可断点续跑）
 *
 * 用法：
 *   首次:  tsx scripts/collect.ts --config task.json
 *   续跑:  tsx scripts/collect.ts --resume output/anker-powerbank-202608251430 [--budget 3]
 *
 * 预算不足以支付下一请求时保存断点并以退出码 3 结束。
 * 续跑跳过已完成的关键词，并从有效逐端点费用账继续估算占用。
 *
 * 记忆文件读不出来时**不产出名单**（退出码 2，采集结果完好，已抓到的不重抓）。
 * 修好后续跑要不要花钱，取决于剩余关键词与待补 profile 是否都为零 ——
 * **不要无条件说「续跑零花费」**，stderr 会按实际剩余量算给用户看（ADR-15 · ADR-25）。
 * `--ignore-memory` 是显式逃生口，见 ADR-15。
 */
import { readFileSync, existsSync } from 'node:fs'
import { TikHub, TikHubError, fillEmail } from './providers/tikhub.js'
import { Budget, BudgetInputError, startBudget, type PersistCost } from './lib/budget.js'
import { CostError, parseUsdMicros } from './lib/cost-ledger.js'
import { readCostDocument, readCostLimit, stringifyCostJson } from './lib/cost-json.js'
import {
  MAX_PAGES, canRequestPage, finalize, firstPagePending, igAfterPage, mergePage, needsProfile,
  pagesFetched, pendingKeywords, resumeCostLine, underPageCap,
} from './lib/pipeline.js'
import { MemoryUnreadable } from './lib/memory.js'
import { passesFollowerGate } from './lib/score.js'
import { taskLabel } from './lib/task-label.js'
import {
  taskDir, taskFile, taskId, loadTask, saveTask, loadRawCreators, saveRawCreators,
  persistListAndStatus, saveCostCheckpoint,
} from './lib/task.js'
import { creatorKey, textProblem } from './lib/types.js'
import { igRouteProblems } from './lib/ig-route.js'
import { taskListProblems } from './lib/search-tasks.js'
import type { Creator, TaskState } from './lib/types.js'

/**
 * 记忆读不出来时仍然产出名单。**必须由用户显式打出来** —— 它不让重复打扰的风险
 * 消失，只是把它从一个静默默认变成一次显式决定，代价随 memory_status 声明在
 * 交付物上（ADR-15）。
 */
const ignoreMemory = process.argv.includes('--ignore-memory')

const argv = process.argv
const arg = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined
}

// ---------- 载入或恢复 ----------

let state: TaskState
let productFrom: string
let freshLimit: number | undefined
const resume = arg('--resume')
const newBudgetArg = arg('--budget')
let replacementLimit: number | undefined
try {
  if (argv.includes('--budget')) {
    if (newBudgetArg === undefined) throw new Error('--budget 缺少金额')
    try { replacementLimit = parseUsdMicros(newBudgetArg) }
    catch (e) { throw new Error(`--budget ${newBudgetArg}：${String(e)}`) }
  }
  if (resume) {
    const taskPath = taskFile(resume)
    if (!existsSync(taskPath)) throw new Error(`找不到 ${taskPath}`)
    state = loadTask(resume)
    productFrom = taskPath
  } else {
    const cfgPath = arg('--config')
    if (!cfgPath) throw new Error('用法: npm run collect -- --config task.json | --resume <dir> [--budget N] [--ignore-memory]')
    const cfg = readCostDocument<TaskState>(readFileSync(cfgPath, 'utf8'))
    if (Object.hasOwn(cfg, 'budget_usd')) freshLimit = readCostLimit(cfg)
    else {
      freshLimit = parseUsdMicros('2')
      if (replacementLimit === undefined) console.error('未提供预算，默认采用任务总预算 $2。')
    }
    if (replacementLimit !== undefined) freshLimit = replacementLimit
    state = {
      product: cfg.product, market: cfg.market ?? 'US', target_count: cfg.target_count ?? 50,
      tasks: cfg.tasks, done: [], offsets: {}, answered: {}, found: {}, pages: {},
      created_at: new Date().toISOString(), updated_at: '',
    }
    productFrom = cfgPath
  }
} catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(2) }

// D16.j/k、D15.j：原样整表与路线一起查；先于进度读取、建目录、改额、任何预留或写入。
const badTasks = taskListProblems(state.tasks)
const badRoutes = igRouteProblems(state.tasks)
const taskProblems = [...badTasks, ...badRoutes]
if (taskProblems.length) {
  console.error(`${productFrom} 里的任务配置不合规：\n  ${taskProblems.join('\n  ')}`)
  process.exit(2)
}

const badProduct = textProblem(state.product)
if (badProduct) {
  console.error(`${productFrom} 里的 product ${badProduct} —— 它要用作任务目录名，` +
                `也要记进跨任务记忆的「为哪个产品推荐过」。先给它一个名字再跑。`)
  process.exit(2)
}

const dir = resume ?? taskDir(state.product)
if (!resume && existsSync(taskFile(dir))) {
  console.error(`${taskFile(dir)} 已存在；请用 --resume 继续原任务，不能重新开账。`)
  process.exit(2)
}
let budget: Budget
try {
  if (resume) console.error(`续跑 ${resume} —— 已完成 ${state.done.length}/${state.tasks.length} 个关键词`)
  const notify = (pct: number, view: ReturnType<Budget['view']>) => {
    console.error(`\n💰 已用 ${(pct * 100).toFixed(0)}% —— 估算占用 $${view.cost_estimate_usd} / $${view.budget_usd}\n`)
  }
  const persistCost: PersistCost = snapshot => saveCostCheckpoint(dir, snapshot)
  budget = resume ? new Budget(state, notify, persistCost) : startBudget(state, freshLimit!, 'task', notify, persistCost)
  if (resume && replacementLimit !== undefined) budget.setLimit(replacementLimit)
} catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(2) }
// D13.j：改额先保存根上限及 ledger，一旦保存失败不能发下一请求。
if (!resume || replacementLimit !== undefined) {
  try { saveTask(dir, state) }
  catch (e) { console.error(`保存费用失败：${String(e)}`); process.exit(1) }
}
const api = new TikHub(process.env.TIKHUB_API_KEY, budget)

// 已采集的人（续跑时接着累加）。
// 读的是**累加器** creators.raw.json，不是交付物 creators.json ——
// 交付物是过滤后的结果，拿它当续跑的输入会让每轮都比上一轮少人。
const creators = new Map<string, Creator>()
for (const c of loadRawCreators(dir)) creators.set(creatorKey(c), c)

// ---------- 采集 ----------

let stopped: 'budget' | 'target' | 'done' | 'error' = 'done'
let errorMsg = ''
let errorExit = 1

/**
 * 达标判断必须数**能进名单的人**，不是采到的总数。
 *
 * 实测栽过：blendjet 一个词采到 64 人 ≥ 目标 50 于是停止，但过粉丝闸门后只剩
 * 36 人 —— 既没达标，又丢掉了另外 6 个关键词的维度多样性。
 */
function qualified(): number {
  return [...creators.values()].filter(passesFollowerGate).length
}

function persist() {
  // D6.t：先存作者，再推进分页进度。反过来的话，两次写之间被打断或累加器写失败时，
  // 盘上的进度已经前进而这一页的作者没存下，续跑就跳过了它（ADR-113）。
  // 累加器只增不减 —— 过滤在 main() 末尾只作用于交付物
  saveRawCreators(dir, [...creators.values()])
  saveTask(dir, state)
}

/**
 * 轮转采集：先给每个关键词各抓一页，再回头抓第二页。
 *
 * 不能顺序跑完一个词再跑下一个 —— 实测 blendjet 一个词就够 50 人，一个词就能把整轮配额
 * 翻完。**四个维度各有各的价值**正是关键词策略的核心。
 *
 * **F9：每个任务的第一页不受达标判断约束。** 达标之后仍然给「一页都没抓过」的任务补第一页，
 * 第一页之后的分页才照旧按达标停（F9.d）。这一条修掉的是「零」，修不掉「少」——
 * IG 词第一页之后按续页令牌翻、达标即停（D6.u），但它保证的仍只是**问过**，不保证问到多少人。
 *
 * 为什么非改不可：达标判断原先跑在**每一次**搜索之前、第一轮也不例外，于是前面几个词
 * 各抓一页填满目标时，后面的任务一个请求都不发；而 task.json 的顺序由 Agent 决定 ——
 * 实测 IG 写在后面时整个平台为零，而报告里它和「查了没人」长得一模一样（ADR-94）。
 *
 * 「抓过第一页没有」不另记一张表，就看 `state.offsets` 里有没有这个键 ——
 * 三态见 `TaskState.offsets` 的注释。判定在 `lib/pipeline.ts` 的 `firstPagePending`，
 * **调度与「续跑要不要花钱」那句话共用它**，不各写一份。
 */
async function run() {
  // 一页都没抓过的任务，本轮要给它们补第一页；`null` 是「无从确认」（F9.e）。
  // **必须在下面那个 ??= 之前取快照** —— 整张表缺失（F9 落地之前的旧目录）是
  // 「无从确认哪些任务查过」，而 ??= 之后这个证据就被抹平成「都没查过」，
  // 于是已经付过费的词会被整批重抓一遍。怎么读那三态在 firstPagePending 里判，
  // 这儿不再写一份。
  // ⚠️ **不要写成 `new Set(firstPagePending(state))`** —— `new Set(null)` 在 TS 里合法，
  // 会把「无从确认」静默压成空集，编译器一个字都不说（#138 评审指出的正是这个形状）。
  const owed = firstPagePending(state)
  const owedFirstPage = new Set(owed ?? [])
  const unknownPaging = owed === null
  // 从 task.json 恢复 —— 预算中途用尽时，续跑要从断掉的那一页接上。
  // ⚠️ **无从确认时不要初始化它**：`??= {}` 会把「整张表缺失」当场抹成「表在、都没查过」，
  // 而收尾那句话是在这之后才算的 —— 于是它说「还有 N 个关键词要抓」，
  // 调度这边却一个都不抓，两处对不上（ADR-25 的老形状，#138 评审之后实测又踩了一次）。
  // 下面那道闸保证无从确认时一次搜索都不发，所以这张丢弃的局部表永远不会被写。
  // ⚠️ **那道闸和这一行是一对**：谁把闸挪走，写入就会静默落进这张局部表、
  // 一个字都不报（负片 `M-F9-f` 指着那道闸，靠的是请求数，不是这张表）。
  const offsets = unknownPaging ? {} : (state.offsets ??= {})
  const exhausted = new Set<number>(state.done)
  const addedBy = new Map<number, number>()
  // IG 续页令牌：只在这一跑的内存里，不写进 task.json（ADR-111 第一节第 2 条）。
  // 只存 `igAfterPage` 交回的那一个 —— 空白令牌因此到不了 `search()`。
  const tokens = new Map<number, string>()
  const close = (i: number, line: string) => {
    exhausted.add(i)
    state.done.push(i)
    console.error(line)
  }
  /**
   * 搜索完成的那一行，带原任务身份（U8.i）。**两个平台共用这一处**：假供应商的 TikTok 恒给
   * `has_more`，自检里只有 IG 任务走得到「搜索完成」，写成两行的话 TikTok 那一行就没人守。
   * IG 停下时 `why` 说本地看到了什么。
   */
  const finish = (t: TaskState['tasks'][number], i: number, why: string) =>
    close(i, `  ✓ ${taskLabel(t, i)} → 共 ${addedBy.get(i)} 人（累计 ${creators.size}）${why}  ${budget.summary()}`)

  // 循环体故意不另缩进一格：`mutations.json` 里有十几条变异的锚点按它现在的缩进写，挪一格就一起失效。
  try {
  for (let round = 0; round < MAX_PAGES; round++) {
    let anyProgress = false

    for (let i = 0; i < state.tasks.length; i++) {
      if (exhausted.has(i)) continue
      // F9.e：无从确认哪些任务查过 → 一个关键词都不抓。
      // **这一条排在达标判断之前**：写在下面那个 if 里面的话，没达标那条路根本走不到它，
      // 于是旧目录会从 offset 0 整批重抓 —— 实测 `requests` 4 → 172、
      // `offsets` 被重写成 `{0: 80, 1: 80}`，而 0–40 那几页上一跑已经付过钱了（#138 评审指出）。
      if (unknownPaging) continue
      // D6.h：跨运行的页数天花板。**这一条同样排在达标判断之前** —— 写进下面那个 if
      // 里面的话，没达标那条路根本走不到它，于是续跑又给出一份满配额（F9.e 那道闸
      // 栽过的同一个形状，collect.ts 上方 #138 评审那几行记着）。
      // 达上限与「无从确认」都写进 done：`pendingKeywords` 只看 done（D6.g），
      // 不写的话调度这边不抓、收尾那句话却把它算进「要花钱」，两处当场对不上（ADR-25）。
      // **判定用中心那一份，别在这里抄第二遍**（ADR-25）—— 抄一遍就有两处可以各自
      // 漂走，而带测试与负片的是中心那一份。`pagesFetched` 只留给下面那句措辞。
      if (!underPageCap(state, i)) {
        const fetchedSoFar = pagesFetched(state, i)
        exhausted.add(i)
        state.done.push(i)
        console.error(fetchedSoFar === null
          ? `  ◦ ${taskLabel(state.tasks[i], i)} → 已抓页数无从确认，不再翻页 —— 上一版留下的目录只补第一页（D6.m）`
          : `  ◦ ${taskLabel(state.tasks[i], i)} → 已达页数上限 ${MAX_PAGES} 页，不再翻页`)
        persist()
        continue
      }
      // ADR-111：IG 抓过页之后，只有手里有这一跑拿到的令牌才能再翻。续跑时遇到抓过页、
      // 还没进 done 的 IG 任务就在这里记进 done、不发请求 —— 同上面那一支：调度不抓的
      // 必须进 done，否则收尾那句话仍把它算进要花钱的那一半（D6.g、ADR-25）。
      // 判定用中心那一份，收尾那句话（`keywordsResumeWillRun`）与这里共用（ADR-111 第二节）。
      if (!canRequestPage(state, i, tokens.get(i))) {
        close(i, `  ◦ ${taskLabel(state.tasks[i], i)} → 本次没有可继续的续页令牌（令牌不跨运行），不再翻页`)
        persist()
        continue
      }
      if (qualified() >= state.target_count) {
        stopped = 'target'
        // F9：达标之后**不是一律停**，还欠第一页的任务照抓不误。
        // 这里是 continue 不是 break —— break 会让排在后面、一页都没抓过的任务
        // 跟着一起被砍掉，而那正是这条需求要修的东西。
        // 第一页之后的分页照旧按达标停：这个集合里只有「一页都没抓过」的（F9.d）。
        if (!owedFirstPage.has(i)) continue
      }

      const t = state.tasks[i]
      const offset = offsets[i] ?? 0
      // D6.s：仅在前后费用账均可核验时记录终态净次数增量。
      // 记在 finally 里，因为要记的正是**抛出去那条路**：钱扣了、而在写游标之前抛了。
      const paidBefore = budget.view().cost_status === 'known' ? budget.count : null
      let page
      try {
        page = await api.search(t, state.market, offset, tokens.get(i))
      } finally {
        // ⚠️ **只改内存，不在这里落盘**：此刻 offsets[i] 还没更新、人也还没入库，
        // 落下去就是个自相矛盾的断点；而且会遮住循环末尾那次落盘的窗口（负片 M-P3-f）。
        // 抛出去那条路由 main() 的 catch 之后那次 persist() 负责。
        const paidAfter = budget.view().cost_status === 'known' ? budget.count : null
        const paid = paidBefore === null || paidAfter === null ? null : paidAfter - paidBefore
        // ⚠️ **两张表一律不在这里建**（`??=` 都不行）—— 缺表＝无从确认，
        // 凭空建一张就把它抹成「一个都没问过」，不可逆（D6.j，ADR-94 第十五节丙实测）。
        // 目录新建时就带着这两张表；缺表的是上一版留下的目录，它们从此也不长出来。
        if (paid !== null && paid > 0 && state.answered !== undefined) {
          state.answered[i] = (state.answered[i] ?? 0) + paid
        }
        // 付了钱、却没走到下面记条数那一步 —— **这一次的条数永远补不回来**。
        // 于是这个任务的累计条数从此「注定不全」：不这么记的话，下一页成功时
        // 它会从 0 重新数起，凑出一个偏小、却和真测量值印在同一列的数（D6.l）。
        if (paid !== null && paid > 0 && page === undefined && state.found !== undefined) {
          state.found[i] = null
        }
      }
      const { creators: found, raw_count, has_more, next_token } = page
      anyProgress = true

      // 去重与归人都在 mergePage 里 —— 判定不留在入口脚本，缺省那个验证者才够得到它
      const added = mergePage(creators, found, i, t)
      addedBy.set(i, (addedBy.get(i) ?? 0) + added)

      // offset 按 API **实际返回条数**递增。固定 +20 会在返回不足的一页之后跳过数据。
      // 写下这个键本身也是「这个任务抓过第一页了」的记录（F9）—— 所以哪怕 raw_count 为 0 也要写。
      offsets[i] = offset + raw_count
      // D6.h：只有真拿回了一页才计一页。**表缺失时不凭空建**（`??=` 也不行，D6.m）——
      // 凭空建一张就把「无从确认」抹成「一页都没抓过」，不可逆（D6.j 同款）。
      const ptbl = state.pages
      const fetched = ptbl === undefined ? undefined : (ptbl[i] = (ptbl[i] ?? 0) + 1)
      // 条数单独记 —— 它和 offset 不恒等：游标只在这一行写得到，而付了钱在这之前
      // 抛出去的那几次由上面的 finally 记成 `null`。**一旦判定不全就永远是 null**，
      // 不许凑出一个偏小却和真测量值印在同一列的数（D6.l）。
      const ftbl = state.found
      if (ftbl !== undefined) {
        ftbl[i] = ftbl[i] === null ? null : ((ftbl[i] as number | undefined) ?? 0) + raw_count
      }
      // 快照也要跟着改：**同一个事实记在两处，两处都得更新**。
      // 漏掉这一行的症状只在第二轮才露出来 —— 第一轮没达标、第二轮才达标时，
      // 第一轮抓过的任务会被当成还欠着第一页，于是又被翻一页（违反 F9.d）。
      owedFirstPage.delete(i)
      if (t.platform === 'instagram') {
        // IG 按令牌翻：停不停在拿回这一页的同一次迭代里判，结论随下面那次落盘（ADR-111 第二节）。
        // 措辞只说本地看到了什么，不说服务端已经没有更多。
        const verdict = igAfterPage(state, i, { token: next_token, rawCount: raw_count, parsed: found.length })
        if ('next' in verdict) tokens.set(i, verdict.next)
        else {
          tokens.delete(i)
          // 话题页的响应里其实带着令牌，是这条路线只取首页（D6.w）—— 不说成「没有可继续的令牌」
          const why = t.ig_route === 'hashtag' && verdict.stop === 'no-token' ? '话题路线只取首页'
            : { empty: '本页 0 条', unparsed: '本页解析不出作者', 'no-token': '本次没有可继续的续页令牌',
                cap: `已达页数上限 ${MAX_PAGES} 页或已抓页数无从确认` }[verdict.stop]
          finish(t, i, `，${why}，不再翻页`)
        }
      } else if (!raw_count || !has_more) {
        // 用 API 自己的 has_more，比「本页新增 0 人」准，也省一次探路请求
        finish(t, i, '')
      } else if (fetched !== undefined && fetched >= MAX_PAGES) {
        // **当场记，不留到收尾** —— 收尾那一段排在搜索循环之后，任何从 `api.search`
        // 抛穿 run() 的异常都会把它整个掀掉（预算用尽只是其中一种，402／换了响应结构
        // 走的是同一条），于是翻满 4 页却没能进 done 的词在续跑里重新拿一份配额。
        // 实测过 12 页（上限 4）。记在这里，紧跟着下面那次 persist() 就落盘了。
        exhausted.add(i)
        state.done.push(i)
        console.error(`  ◦ ${taskLabel(t, i)} → 达页数上限 ${MAX_PAGES} 页（累计新增 ${addedBy.get(i) ?? 0} 人）`)
      }
      persist()
    }

    if (stopped === 'target' || !anyProgress) break
  }
  } finally {
    // 令牌不跨运行（ADR-111 第一节第 2 条）：这一跑结束时手里还握着令牌的 IG 任务，续跑不会
    // 再为它请求 —— 当场记进 done，收尾那句话与调度才说同一件事。跑完、达标、预算用尽、
    // 出错都走这里；落盘由下面那次或 main() 的 catch 之后那次负责。
    for (const i of tokens.keys()) {
      if (!exhausted.has(i)) close(i, `  ◦ ${taskLabel(state.tasks[i], i)} → 续页令牌不跨运行，不再翻页，续跑也不会再为它请求`)
    }
  }

  persist()
}

// ---------- Profile 补全 ----------

let profileFailed = 0

async function enrichProfiles() {
  const list = [...creators.values()].filter(needsProfile)
  console.error(`\n补全 profile：${list.length} 人`)
  let done = 0
  for (const c of list) {
    try {
      const p = await api.profile(c.handle, c.platform)
      Object.assign(c, {
        ...p,
        nickname: p.nickname ?? c.nickname,
        followers: p.followers ?? c.followers,
        post_count: p.post_count ?? c.post_count,
      })
      fillEmail(c)
    } catch (e) {
      // 单个失败不该拖垮整轮（一个 404 就挂掉 50 人的采集是不可接受的）。
      // 但**不静默吞掉** —— 计数上报，且该创作者的 bio/email 保持 undefined，
      // 即「未查询」，不会被下游读成「没有邮箱」。
      if (e instanceof CostError || e instanceof BudgetInputError) throw e
      profileFailed++
    }
    if (++done % 10 === 0) console.error(`  ${done}/${list.length}`)
  }
  if (profileFailed) console.error(`  ⚠️ ${profileFailed} 人补全失败，其 bio/email 保持「未查询」`)
}

async function main() {
  try {
    await run()
    await enrichProfiles()
  } catch (e) {
    if (e instanceof CostError && e.code === 'persistence-failed') {
      try { persist() }
      catch (cleanupError) { console.error(`收尾保存也失败：${String(cleanupError)}`) }
      throw e
    }
    if (e instanceof CostError && e.code === 'budget-exceeded') {
      stopped = 'budget'
    } else if (e instanceof TikHubError && e.status === 402) {
      stopped = 'error'; errorMsg = e.message
    } else {
      stopped = 'error'; errorMsg = String(e)
      errorExit = e instanceof BudgetInputError ? 2 : 1
    }
  }

  persist()

  // 同人合并 → 粉丝闸门 → 记忆过滤。管线在 lib/pipeline.ts —— 这四步的**顺序**
  // 有语义，有语义就该能被测，所以它不留在入口脚本里。
  //
  // 记忆读不出来时 finalize 会抛：P4 保证不了就不产出名单。此时 persist() 已经跑过，
  // 采集结果与预算状态都在盘上 —— **中止不浪费任何已经花掉的请求**，这就是
  // 「不产出名单」能当默认的原因（ADR-15）。注意这说的是「不浪费」，不是
  // 「续跑不花钱」：续跑还剩多少活，由下面那段按实际情况算（ADR-25）。
  let fin
  try {
    fin = finalize([...creators.values()], state.product, taskId(dir),
                   { ignoreUnreadableMemory: ignoreMemory })
  } catch (e) {
    if (!(e instanceof MemoryUnreadable)) throw e
    console.error(`\n⛔ ${e.message}`)
    console.error(`   这个文件记着谁已经联系过 —— 读不出来就无法保证不重复打扰，`)
    console.error(`   所以本次不产出名单。`)

    // 采集本身也没跑完的话，那件事不能被这条错误盖掉 —— 它决定了续跑要花多少钱。
    // 无条件说「续跑不会重复花费」，是把「已抓到的不重抓」说成了「续跑免费」，
    // 而剩下的关键词照样要花钱（ADR-22）。
    if (stopped === 'error') console.error(`\n   ⚠️ 本轮采集也没跑完：${errorMsg}`)
    if (stopped === 'budget') console.error(`\n   ⚠️ 本轮余额不足以支付下一请求，续跑可用 --budget 指定新总额度`)
    // 「续跑要不要花钱」有**两种**没干完的活，只数关键词会漏掉后一种：
    // 关键词全跑完了，但只要还有人没补 profile，续跑第一件事就是去补，
    // 那是付费端点（ADR-25）。
    // 数的是**续跑真正会去抓的**，不是「不在 done 里的」—— 已经达标、而且每个
    // 关键词都抓过第一页时，续跑一个请求都不会发；反过来还欠着第一页的那些，
    // 达标也照样会被抓（F9），说成不花钱就是把要花的钱藏起来（ADR-25 追记 · ADR-94）。
    // 说哪一句、以及两个剩余量各是多少，全在 lib/pipeline.ts 的 resumeCostLine 里 ——
    // 留在这儿的话，把两支对调、或者把某一个剩余量写死成 0，检查链一路全绿
    // （ADR-25 的欠条，评审指出）。这里只剩「把它打出来」。
    console.error(`\n   ${resumeCostLine(dir, state, qualified(), [...creators.values()])}`)

    // 预算用尽时光 --resume 会立刻再退 3，所以命令里得把 --budget 一起给出来。
    // 写成 npm run 的形式：tsx 只在 npm script 里才在 PATH 上，而且 .env 也只有那条路会读
    console.error(`\n   修好它再跑: npm run collect -- --resume ${dir}` +
                  (stopped === 'budget' ? ' --budget <新额度>' : ''))
    // 逃生口要打出来，但只打出来 —— 走不走它是用户的取舍，不是这里替他选（ADR-15）
    console.error(`   或明知重复打扰的风险仍要出名单: 上面那条命令加 --ignore-memory`)
    process.exit(2)
  }

  // 交付物与它的去重状态一起落盘 —— **哪个先写都不安全**，判定在 lib/task.ts
  // 的 persistListAndStatus 里（ADR-41）。累加器 creators.raw.json 由 persist() 保管，不在这里动。
  persistListAndStatus(dir, state, fin.kept, fin.memory_status)

  const summary = {
    dir, stopped,
    ...(errorMsg ? { error: errorMsg } : {}),
    collected: fin.kept.length,
    target: state.target_count,
    with_email: fin.kept.filter(c => c.email).length,
    cross_platform: fin.linked,
    unknown_followers: fin.unknown_followers,
    profile_failed: profileFailed,
    filtered_recommended: fin.filtered_recommended,
    filtered_contacted: fin.filtered_contacted,
    memory_status: fin.memory_status,
    keywords_done: state.done.length,
    keywords_total: state.tasks.length,
    pending_keywords: pendingKeywords(state),
  }

  console.log(stringifyCostJson(summary, budget.view()))

  // 续跑要不要花钱 —— **产出了名单的四种收尾共用这一句**：关键词跑完（`done`）、
  // 达标提前停下（`target`）、预算用尽（`budget`）、出错中止（`error`）。原先只有
  // 「记忆读不出来」那条中止路径说它，这四条一个字都不说，而用户要判断「值不值得
  // 续跑」靠的正是这句话：达标提前停下时关键词根本没跑完，补全失败的人下一轮还要
  // 再花钱查（ADR-25 的欠条）。
  //
  // **四种，不是三种** —— 欠条原文和 D6.f 初稿都漏了 `target`，而当时那条叫「跑完」
  // 的自检夹具测的恰恰就是它（两者同为退出码 0、同说「不花钱」，互相冒充）。数
  // `stopped` 的取值，别数自己记得几种（评审指出）。
  //
  // 写成一句、放在分支之前，是有意的：四条路径**不能各自坏掉**，因此它们是一条判据
  // （D6.f）而不是四条 —— `1-REQUIREMENTS.md` 的拆分判据问的是「会不会被不同的代码
  // 路径独立满足、或者独立弄坏」。记忆读不出来那条在上面的 catch 里，它自己 exit 2，
  // 到不了这里，所以那条仍是独立的 D6.e。
  console.error(`\n${resumeCostLine(dir, state, qualified(), [...creators.values()])}`)

  if (stopped === 'budget') {
    console.error(`\n⛔ 余额不足以支付下一请求 ${budget.summary()} —— 断点已保存。`)
    console.error(`   指定新总预算续跑: npm run collect -- --resume ${dir} --budget <新额度>`)
    process.exit(3)              // 3 = 预算用尽，可续跑
  }
  if (stopped === 'error') process.exit(errorExit)
}

main().catch(e => { console.error(e); process.exit(1) })
