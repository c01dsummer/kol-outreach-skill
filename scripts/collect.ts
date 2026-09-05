#!/usr/bin/env tsx
/**
 * Phase 03 —— 规模采集（可断点续跑）
 *
 * 用法：
 *   首次:  tsx scripts/collect.ts --config task.json
 *   续跑:  tsx scripts/collect.ts --resume output/anker-powerbank-202608251430 [--budget 3]
 *
 * 预算用尽时保存断点并以退出码 3 结束 —— 调用方（Agent）据此询问用户是否追加预算。
 * 续跑时已完成的关键词不会重跑，已花掉的请求数不会重复计费。
 *
 * 记忆文件读不出来时**不产出名单**（退出码 2，采集结果完好，已抓到的不重抓）。
 * 修好后续跑要不要花钱，取决于剩余关键词与待补 profile 是否都为零 ——
 * **不要无条件说「续跑零花费」**，stderr 会按实际剩余量算给用户看（ADR-15 · ADR-25）。
 * `--ignore-memory` 是显式逃生口，见 ADR-15。
 */
import { readFileSync, existsSync } from 'node:fs'
import { TikHub, TikHubError, fillEmail } from './providers/tikhub.js'
import { Budget, BudgetExceeded } from './lib/budget.js'
import { finalize, needsProfile, pendingKeywords, resumeCostLine } from './lib/pipeline.js'
import { MemoryUnreadable } from './lib/memory.js'
import { passesFollowerGate } from './lib/score.js'
import {
  taskDir, taskId, loadTask, saveTask, loadRawCreators, saveRawCreators, persistListAndStatus,
} from './lib/task.js'
import { creatorKey, textProblem } from './lib/types.js'
import type { Creator, TaskState } from './lib/types.js'

const MAX_PAGES = 4          // 实测值：第 4 页后新增人数明显衰减

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
let productFrom: string        // 产品名是从哪读来的 —— 报错要指得出位置
const resume = arg('--resume')

if (resume) {
  if (!existsSync(`${resume}/task.json`)) {
    console.error(`找不到 ${resume}/task.json`)
    process.exit(2)
  }
  state = loadTask(resume)
  productFrom = `${resume}/task.json`
  const newBudget = arg('--budget')
  if (newBudget) state.budget_usd = Number(newBudget)
  console.error(`续跑 ${resume} —— 已完成 ${state.done.length}/${state.tasks.length} 个关键词，` +
                `预算 $${state.budget_usd}`)
} else {
  const cfgPath = arg('--config')
  if (!cfgPath) {
    console.error('用法: npm run collect -- --config task.json | --resume <dir> [--budget N] [--ignore-memory]')
    process.exit(2)
  }
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  state = {
    product: cfg.product, market: cfg.market ?? 'US',
    target_count: cfg.target_count ?? 50, budget_usd: cfg.budget_usd ?? 2,
    tasks: cfg.tasks, done: [], offsets: {}, requests: 0,
    created_at: new Date().toISOString(), updated_at: '',
  }
  productFrom = cfgPath
}

// 产品名一路要用到最后：任务目录名、跨任务记忆里那条「为哪个产品推荐过」。
// 空的走不到最后 —— 记忆写回会拒收（记下的那条下次会被判成损坏，ADR-46）。
// **在花钱之前说，不是花完再说**，而且**两条入口都要说**：
// 续跑读的是盘上的旧 task.json，它可能被手改过，也可能来自还没有这条校验的旧版本。
// 只守住新建那条的话，--resume 能带着一个空产品名一路采集、补 profile、
// 花完钱，最后停在写回被拒 —— 钱花了，去重记录一条没记下（ADR-46 追记二）。
const badProduct = textProblem(state.product)
if (badProduct) {
  console.error(`${productFrom} 里的 product ${badProduct} —— 它要用作任务目录名，` +
                `也要记进跨任务记忆的「为哪个产品推荐过」。先给它一个名字再跑。`)
  process.exit(2)
}

// 目录名就是产品名，所以只能等它过关之后才算得出来
const dir = resume ?? taskDir(state.product)
if (!resume) saveTask(dir, state)

const key = process.env.TIKHUB_API_KEY
if (!key) {
  console.error('缺少 TIKHUB_API_KEY。到 https://tikhub.io 注册后写入 .env')
  process.exit(2)
}

const budget = new Budget(state.budget_usd, state.requests, (pct, spent, limit) => {
  console.error(`\n💰 已用 ${(pct * 100).toFixed(0)}% —— $${spent.toFixed(3)} / $${limit.toFixed(2)}\n`)
})
const api = new TikHub(key, budget)

// 已采集的人（续跑时接着累加）。
// 读的是**累加器** creators.raw.json，不是交付物 creators.json ——
// 交付物是过滤后的结果，拿它当续跑的输入会让每轮都比上一轮少人。
const creators = new Map<string, Creator>()
for (const c of loadRawCreators(dir)) creators.set(creatorKey(c), c)

// ---------- 采集 ----------

let stopped: 'budget' | 'target' | 'done' | 'error' = 'done'
let errorMsg = ''

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
  state.requests = budget.count
  saveTask(dir, state)
  // 累加器只增不减 —— 过滤在 main() 末尾只作用于交付物
  saveRawCreators(dir, [...creators.values()])
}

/**
 * 轮转采集：先给每个关键词各抓一页，再回头抓第二页。
 *
 * 不能顺序跑完一个词再跑下一个 —— 实测 blendjet 一个词就够 50 人，于是场景词、
 * 人群词、整个 IG 一个都没跑到。**四个维度各有各的价值**正是关键词策略的核心，
 * 让第一个词吃掉全部配额等于把策略作废。
 */
async function run() {
  // 从 task.json 恢复 —— 预算中途用尽时，续跑要从断掉的那一页接上
  state.offsets ??= {}
  const exhausted = new Set<number>(state.done)
  const addedBy = new Map<number, number>()
  const pages = new Map<number, number>()       // 本关键词已抓页数（跨运行由 offsets 推不出来，只在本轮计）

  for (let round = 0; round < MAX_PAGES; round++) {
    let anyProgress = false

    for (let i = 0; i < state.tasks.length; i++) {
      if (exhausted.has(i)) continue
      if (qualified() >= state.target_count) { stopped = 'target'; break }

      const t = state.tasks[i]
      const offset = state.offsets[i] ?? 0
      const { creators: found, raw_count, has_more } = await api.search(t, state.market, offset)
      anyProgress = true

      let added = 0
      for (const p of found) {
        if (!p.handle || !p.platform) continue
        const k = creatorKey({ platform: p.platform, handle: p.handle })
        if (creators.has(k)) continue
        creators.set(k, { ...(p as Creator), source_keyword: t.keyword, source_dimension: t.dimension })
        added++
      }
      addedBy.set(i, (addedBy.get(i) ?? 0) + added)
      pages.set(i, (pages.get(i) ?? 0) + 1)

      // offset 按 API **实际返回条数**递增。固定 +20 会在返回不足的一页之后跳过数据。
      state.offsets[i] = offset + raw_count
      // 用 API 自己的 has_more，比「本页新增 0 人」准，也省一次探路请求
      if (!raw_count || !has_more) {
        exhausted.add(i)
        state.done.push(i)
        console.error(`  ✓ ${t.keyword} · ${t.platform} → 共 ${addedBy.get(i)} 人（累计 ${creators.size}）  ${budget.summary()}`)
      }
      persist()
    }

    if (stopped === 'target' || !anyProgress) break
  }

  // 跑满页数上限的关键词记为已完成。
  // 判据是**抓够了页数**，不是「本次新增 > 0」—— 续跑时同一批人已在库里，
  // 新增恒为 0，用新增数判断会导致关键词永远标不完，续跑无限重来。
  if (stopped !== 'budget') {
    for (let i = 0; i < state.tasks.length; i++) {
      if (state.done.includes(i)) continue
      if ((pages.get(i) ?? 0) >= MAX_PAGES) {
        state.done.push(i)
        console.error(`  ◦ ${state.tasks[i].keyword} · ${state.tasks[i].platform} → 达页数上限（累计新增 ${addedBy.get(i) ?? 0} 人）`)
      }
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
      if (e instanceof BudgetExceeded) throw e
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
    if (e instanceof BudgetExceeded) {
      stopped = 'budget'
    } else if (e instanceof TikHubError && e.status === 402) {
      stopped = 'error'; errorMsg = e.message
    } else {
      stopped = 'error'; errorMsg = String(e)
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
    if (stopped === 'budget') console.error(`\n   ⚠️ 本轮预算也已用尽，续跑需要 --budget 追加`)
    // 「续跑要不要花钱」有**两种**没干完的活，只数关键词会漏掉后一种：
    // 关键词全跑完了，但只要还有人没补 profile，续跑第一件事就是去补，
    // 那是付费端点（ADR-25）。
    // 数的是**续跑真正会去抓的**，不是「不在 done 里的」—— 达标提前停下时
    // 那些关键词一个都没碰过，而续跑会在第一个请求之前再次达标（ADR-25 追记）。
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
    requests: budget.count,
    cost_estimate_usd: Number(budget.spent.toFixed(4)),
    budget_usd: state.budget_usd,
  }

  console.log(JSON.stringify(summary, null, 2))

  // 续跑要不要花钱 —— **剩下三条收尾路径共用这一句**（跑完、预算用尽、出错）。
  // 原先只有「记忆读不出来」那条中止路径说它，另外三条一个字都不说，而用户要判断
  // 「值不值得续跑」靠的正是这句话：达标提前停下时关键词根本没跑完，补全失败的人
  // 下一轮还要再花钱查（ADR-25 的欠条）。
  //
  // 写成一句、放在分支之前，是有意的：三条路径**不能各自坏掉**，因此它们是一条判据
  // （D6.f）而不是三条 —— `1-REQUIREMENTS.md` 的拆分判据问的是「会不会被不同的代码
  // 路径独立满足、或者独立弄坏」。记忆读不出来那条在上面的 catch 里，它自己 exit 2，
  // 到不了这里，所以那条仍是独立的 D6.e。
  console.error(`\n${resumeCostLine(dir, state, qualified(), [...creators.values()])}`)

  if (stopped === 'budget') {
    console.error(`\n⛔ 预算用尽 ${budget.summary()} —— 断点已保存。`)
    console.error(`   追加预算续跑: npm run collect -- --resume ${dir} --budget <新额度>`)
    process.exit(3)              // 3 = 预算用尽，可续跑
  }
  if (stopped === 'error') process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
