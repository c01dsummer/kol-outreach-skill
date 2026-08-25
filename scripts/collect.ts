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
import { taskDir, loadTask, saveTask, loadCreators, saveCreators } from './lib/task.js'
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
    tasks: cfg.tasks, done: [], requests: 0,
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

// 已采集的人（续跑时接着累加）
const creators = new Map<string, Creator>()
for (const c of loadCreators(dir)) creators.set(`${c.platform}:${c.handle.toLowerCase()}`, c)

// ---------- 采集 ----------

let stopped: 'budget' | 'target' | 'done' | 'error' = 'done'
let errorMsg = ''

function persist() {
  state.requests = budget.count
  saveTask(dir, state)
  saveCreators(dir, [...creators.values()])
}

async function run() {
  for (let i = 0; i < state.tasks.length; i++) {
    if (state.done.includes(i)) continue
    if (creators.size >= state.target_count) { stopped = 'target'; break }

    const t = state.tasks[i]
    const label = `${t.as_hashtag ? '#' : ''}${t.keyword} · ${t.platform}`
    let added = 0

    for (let page = 0; page < MAX_PAGES; page++) {
      const found = await api.search(t, state.market, page)
      if (!found.length) break          // 该关键词耗尽，不再翻页浪费请求

      let newThisPage = 0
      for (const p of found) {
        if (!p.handle) continue
        const k = `${p.platform}:${p.handle.toLowerCase()}`
        if (creators.has(k)) continue
        creators.set(k, {
          ...(p as Creator),
          source_keyword: t.keyword,
          source_dimension: t.dimension,
        })
        newThisPage++; added++
      }
      // 新增衰减到 0 说明这个词已经挖完了
      if (newThisPage === 0) break
      if (creators.size >= state.target_count) break
    }

    state.done.push(i)
    persist()
    console.error(`  ✓ ${label} → 新增 ${added} 人（累计 ${creators.size}）  ${budget.summary()}`)
  }
}

// ---------- Profile 补全 ----------

async function enrichProfiles() {
  const list = [...creators.values()].filter(c => !c.bio || !c.bio_links?.length)
  console.error(`\n补全 profile：${list.length} 人`)
  for (const c of list) {
    const p = await api.profile(c.handle, c.platform)
    Object.assign(c, {
      ...p,
      nickname: p.nickname ?? c.nickname,
      followers: p.followers ?? c.followers,
      post_count: p.post_count ?? c.post_count,
    })
    fillEmail(c)
  }
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
  const { kept, filtered_recommended, filtered_contacted } = filterByMemory(all, state.product)

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
