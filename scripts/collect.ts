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
 */
import { readFileSync, existsSync } from 'node:fs'
import { TikHub, TikHubError, fillEmail } from './providers/tikhub.js'
import { Budget, BudgetExceeded } from './lib/budget.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { filterByMemory } from './lib/memory.js'
import { passesFollowerGate } from './lib/score.js'
import { taskDir, taskId, loadTask, saveTask, loadRawCreators, saveRawCreators, saveCreators } from './lib/task.js'
import type { Creator, TaskState } from './lib/types.js'

const MAX_PAGES = 4          // 实测值：第 4 页后新增人数明显衰减

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
  const list = [...creators.values()].filter(c => c.bio === undefined || !c.bio_links?.length)
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

  // 跨平台同人识别 + 记忆过滤
  let all = [...creators.values()]
  const linked = linkCrossPlatform(all)
  all = mergeCrossPlatform(all)
  // P1：粉丝数未知的**不丢弃** —— 「没查到」不等于「不合格」。留下并计数上报，
  //     由用户决定要不要看。静默过滤会让真实创作者凭空消失且无人知晓。
  const unknownFollowers = all.filter(c => c.followers === undefined).length
  all = all.filter(passesFollowerGate)
  const { kept, filtered_recommended, filtered_contacted } =
    filterByMemory(all, state.product, taskId(dir))

  // 交付物写 creators.json；累加器 creators.raw.json 由 persist() 保管，不在这里动
  saveCreators(dir, kept)

  const pending = state.tasks
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => !state.done.includes(i))
    .map(({ t }) => `${t.as_hashtag ? '#' : ''}${t.keyword}(${t.platform})`)

  const summary = {
    dir, stopped,
    ...(errorMsg ? { error: errorMsg } : {}),
    collected: kept.length,
    target: state.target_count,
    with_email: kept.filter(c => c.email).length,
    cross_platform: linked,
    unknown_followers: unknownFollowers,
    profile_failed: profileFailed,
    filtered_recommended, filtered_contacted,
    keywords_done: state.done.length,
    keywords_total: state.tasks.length,
    pending_keywords: pending,
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
