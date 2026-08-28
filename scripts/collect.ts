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
 * **不要无条件说「续跑零花费」**，stderr 会按实际剩余量算给用户看（ADR-25 · ADR-30）。
 * `--ignore-memory` 是显式逃生口，见 ADR-15。
 */
import { readFileSync, existsSync } from 'node:fs'
import { TikHub, TikHubError, fillEmail } from './providers/tikhub.js'
import { Budget, BudgetExceeded } from './lib/budget.js'
import {
  finalize, keywordsResumeWillRun, needsProfile, pendingKeywords,
} from './lib/pipeline.js'
import { MemoryUnreadable } from './lib/memory.js'
import { passesFollowerGate } from './lib/score.js'
import { taskDir, taskId, loadTask, saveTask, loadRawCreators, saveRawCreators, saveCreators } from './lib/task.js'
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

let dir: string
let state: TaskState
const resume = arg('--resume')

if (resume) {
  if (!existsSync(`${resume}/task.json`)) {
    console.error(`找不到 ${resume}/task.json`)
    process.exit(2)
  }
  dir = resume
  state = loadTask(dir)
  const newBudget = arg('--budget')
  if (newBudget) state.budget_usd = Number(newBudget)
  console.error(`续跑 ${dir} —— 已完成 ${state.done.length}/${state.tasks.length} 个关键词，` +
                `预算 $${state.budget_usd}`)
} else {
  const cfgPath = arg('--config')
  if (!cfgPath) {
    console.error('用法: tsx scripts/collect.ts --config task.json | --resume <dir> [--budget N]')
    process.exit(2)
  }
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  state = {
    product: cfg.product, market: cfg.market ?? 'US',
    target_count: cfg.target_count ?? 50, budget_usd: cfg.budget_usd ?? 2,
    tasks: cfg.tasks, done: [], offsets: {}, requests: 0,
    created_at: new Date().toISOString(), updated_at: '',
  }
  dir = taskDir(state.product)
  saveTask(dir, state)
}

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
for (const c of loadRawCreators(dir)) creators.set(`${c.platform}:${c.handle.toLowerCase()}`, c)

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
        if (!p.handle) continue
        const k = `${p.platform}:${p.handle.toLowerCase()}`
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
  // 「续跑不花钱」：续跑还剩多少活，由下面那段按实际情况算（ADR-25 · ADR-29）。
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
    // 早先这里无条件说「续跑不会重复花费」，把「已抓到的不重抓」说成了「续跑免费」，
    // 而剩下的关键词照样要花钱（ADR-22）。
    if (stopped === 'error') console.error(`\n   ⚠️ 本轮采集也没跑完：${errorMsg}`)
    if (stopped === 'budget') console.error(`\n   ⚠️ 本轮预算也已用尽，续跑需要 --budget 追加`)
    // 「续跑要不要花钱」有**两种**没干完的活，只数关键词会漏掉后一种：
    // 关键词全跑完了，但只要还有人没补 profile，续跑第一件事就是去补，
    // 那是付费端点（ADR-25）。
    // 数的是**续跑真正会去抓的**，不是「不在 done 里的」—— 达标提前停下时
    // 那些关键词一个都没碰过，而续跑会在第一个请求之前再次达标（ADR-29）。
    const pending = keywordsResumeWillRun(state, qualified())
    const pendingProfiles = [...creators.values()].filter(needsProfile).length
    const rest = [
      pending.length ? `${pending.length} 个关键词` : '',
      pendingProfiles ? `${pendingProfiles} 个人的 profile` : '',
    ].filter(Boolean).join('、')
    console.error(rest
      ? `\n   已抓到的都在 ${dir}，不会重新抓；但还有 ${rest} 没跑完，` +
        `续跑会继续发请求、继续花钱。`
      : `\n   采集与补全都已跑完，结果都在 ${dir}，续跑不产生新的请求。`)

    console.error(`\n   修好它再跑: tsx scripts/collect.ts --resume ${dir}`)
    console.error(`   或明知重复打扰的风险仍要出名单: 上面那条命令加 --ignore-memory`)
    process.exit(2)
  }

  // **状态先落盘，名单后落盘。** 这是两次独立的 writeFileSync，中间被打断是可能的，
  // 而两种顺序的失败后果不对称：
  //
  // - 名单在前 → creators.json 已经是未去重的新名单，task.json 还留着上一轮的
  //   ok/absent。render 从 task.json 读状态，于是**压掉那条警告**，
  //   把打扰过、已拉黑的人当成「已去重」交付出去 —— 静默破 P4 与 P5
  // - 状态在前 → task.json 说「这批没去重」，creators.json 还是上一轮去重过的旧名单。
  //   报告多报一次警告，用户重跑一次就好
  //
  // 多报要用户重跑一次，少报是把人重新打扰一遍。**答不上来时报警告，
  // 不报「已去重」**（ADR-38）。persist() 一直是这个顺序，是这里偏离了它。
  state.memory_status = fin.memory_status
  saveTask(dir, state)
  // 交付物写 creators.json；累加器 creators.raw.json 由 persist() 保管，不在这里动
  saveCreators(dir, fin.kept)

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

  if (stopped === 'budget') {
    console.error(`\n⛔ 预算用尽 ${budget.summary()} —— 断点已保存。`)
    console.error(`   追加预算续跑: tsx scripts/collect.ts --resume ${dir} --budget <新额度>`)
    process.exit(3)              // 3 = 预算用尽，可续跑
  }
  if (stopped === 'error') process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
