#!/usr/bin/env tsx
/**
 * D8/F8 —— 在语义筛选之后，用主页近期作品计算公开绩效指标与受众质量风险。
 *
 * 用法：
 *   tsx scripts/enrich.ts --dir output/xxx
 *   tsx scripts/enrich.ts --dir output/xxx --budget 3
 *   tsx scripts/enrich.ts --dir output/xxx --refresh
 *
 * 默认跳过 enrichment.json 里已经查询过的账号；--refresh 才会重新花费请求。
 */
import { existsSync } from 'node:fs'
import {
  INSTAGRAM_POSTS_ENDPOINT,
  TIKTOK_POSTS_ENDPOINT,
  TikHub,
  TikHubError,
} from './providers/tikhub.js'
import { Budget, BudgetExceeded, UNIT_PRICE, budgetProblem, ledgerProblem } from './lib/budget.js'
import {
  accountKey,
  assignAudienceRisks,
  calculatePublicMetrics,
  publicPostSample,
  recomputeCachedAssessment,
  unavailable,
} from './lib/assessment.js'
import {
  loadCreators,
  loadEnrichment,
  loadRawCreators,
  loadTask,
  saveEnrichment,
  saveTask,
} from './lib/task.js'
import type {
  AccountAssessment,
  Creator,
  EnrichmentState,
  MetricSource,
  Platform,
  TaskState,
} from './lib/types.js'

const argv = process.argv
const arg = (name: string) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined
}

const dir = arg('--dir')
if (!dir || !existsSync(`${dir}/task.json`)) {
  console.error('用法: tsx scripts/enrich.ts --dir <output/xxx> [--budget N] [--refresh]')
  process.exit(2)
}

const key = process.env.TIKHUB_API_KEY
if (!key) {
  console.error('缺少 TIKHUB_API_KEY。公开指标仍由 TikHub 提供，不需要额外供应商。')
  process.exit(2)
}

const task: TaskState = loadTask(dir)

// 盘上的两个钱字段先查，再拿它们算任何东西 —— 下面那句 `task.requests * UNIT_PRICE`
// 拿 null 算出来是 0，于是「新预算不能低于已花」这条校验自己先失了准（D6.a · P3）。
// 判定与 collect 共用 lib/budget.ts 的那一份：各写一份表达式时，先改的那边不会报错。
for (const [field, problem] of [
  ['budget_usd', budgetProblem(task.budget_usd)],
  ['requests', ledgerProblem(task.requests)],
] as const) {
  if (!problem) continue
  console.error(`${dir}/task.json 里的 ${field} ${problem}：` +
                `${JSON.stringify((task as unknown as Record<string, unknown>)[field])} —— ` +
                `预算闸门要拿这两个数比大小，比不了就等于没有闸门。`)
  process.exit(2)
}

const newBudget = arg('--budget')
if (newBudget !== undefined) {
  const parsed = Number(newBudget)
  const alreadySpent = task.requests * UNIT_PRICE
  if (!Number.isFinite(parsed) || parsed < alreadySpent) {
    console.error(`--budget 必须是至少 $${alreadySpent.toFixed(3)} 的总预算`)
    process.exit(2)
  }
  task.budget_usd = parsed
}

const refresh = argv.includes('--refresh')
const budget = new Budget(task.budget_usd, task.requests, (pct, spent, limit) => {
  console.error(`\n💰 已用 ${(pct * 100).toFixed(0)}% —— $${spent.toFixed(3)} / $${limit.toFixed(2)}\n`)
})
const api = new TikHub(key, budget)
const state: EnrichmentState = loadEnrichment(dir) ?? { version: 1, updated_at: '', accounts: {} }
const creators = loadCreators(dir)
const rawByKey = new Map(loadRawCreators(dir).map(c => [accountKey(c.platform, c.handle), c]))

interface AccountRef {
  platform: Platform
  handle: string
  followers?: number
  following?: number
  is_private?: boolean
}

const refs = new Map<string, AccountRef>()

const addRef = (platform: Platform, handle: string, fallback?: Creator) => {
  const k = accountKey(platform, handle)
  if (refs.has(k)) return
  const raw = rawByKey.get(k)
  const src = raw ?? fallback
  refs.set(k, {
    platform,
    handle,
    ...(src?.followers === undefined ? {} : { followers: src.followers }),
    ...(src?.following === undefined ? {} : { following: src.following }),
    ...(src?.is_private === undefined ? {} : { is_private: src.is_private }),
  })
}

for (const c of creators) {
  if (c.fit !== '✅' && c.fit !== '⚠️') continue
  addRef(c.platform, c.handle, c.cross_platform ? undefined : c)
  if (!c.linked_handle) continue
  const split = c.linked_handle.indexOf(':')
  const platform = c.linked_handle.slice(0, split)
  const handle = c.linked_handle.slice(split + 1)
  if ((platform === 'tiktok' || platform === 'instagram') && handle) addRef(platform, handle)
}

const sourceFor = (platform: Platform): MetricSource => ({
  kind: 'public_api',
  provider: 'tikhub',
  endpoint: platform === 'tiktok' ? TIKTOK_POSTS_ENDPOINT : INSTAGRAM_POSTS_ENDPOINT,
})

const persist = () => {
  task.requests = budget.count
  saveTask(dir, task)
  saveEnrichment(dir, state)
}

let newlyQueried = 0
let locallyRecomputed = 0
let stopped: 'done' | 'budget' | 'error' = 'done'
let errorMessage = ''

async function assess(ref: AccountRef): Promise<void> {
  const k = accountKey(ref.platform, ref.handle)
  const existing = state.accounts[k]
  if (!refresh && existing?.sample) {
    // 缓存命中不重抓，但**每次都按当前口径重算**（零请求）。要不要重算的判定在
    // lib/assessment.ts —— 那里能被测、能被变异守住；这里只回填与照实计数。
    if (existing.followers === undefined && ref.followers !== undefined) {
      existing.followers = ref.followers
    }
    if (existing.following === undefined && ref.following !== undefined) {
      existing.following = ref.following
    }
    const { sample, metrics, changed } = recomputeCachedAssessment(
      existing.sample, existing.followers, existing.following, existing.metrics)
    existing.sample = sample
    existing.metrics = metrics
    if (changed) locallyRecomputed++
    return
  }

  let next: AccountAssessment

  if (ref.is_private) {
    const observedAt = new Date().toISOString()
    const sample = unavailable<never[]>('private_account', sourceFor(ref.platform), observedAt)
    next = {
      ...existing,
      platform: ref.platform,
      handle: ref.handle,
      ...(ref.followers === undefined ? {} : { followers: ref.followers }),
      ...(ref.following === undefined ? {} : { following: ref.following }),
      sample,
      metrics: calculatePublicMetrics(sample, ref.followers, ref.following),
    }
  } else {
    const fetched = await api.recentPosts(ref.handle, ref.platform)
    // 采样时间记在响应到达后，避免刚发布的帖子因为请求耗时显得“来自未来”。
    const observedAt = new Date().toISOString()
    const followers = fetched.followers === undefined ? ref.followers : fetched.followers
    const following = fetched.following === undefined ? ref.following : fetched.following
    const sample = publicPostSample(fetched.posts, fetched.source, observedAt)
    next = {
      ...existing,
      platform: ref.platform,
      handle: ref.handle,
      ...(followers === undefined ? {} : { followers }),
      ...(following === undefined ? {} : { following }),
      sample,
      metrics: calculatePublicMetrics(sample, followers, following),
    }
  }

  state.accounts[k] = next
  newlyQueried++
  persist()
}

async function main() {
  let done = 0
  const list = [...refs.values()]
  console.error(`公开指标：${list.length} 个平台账号${refresh ? '（强制刷新）' : ''}`)

  try {
    for (const ref of list) {
      try {
        await assess(ref)
      } catch (e) {
        if (e instanceof BudgetExceeded) throw e
        if (e instanceof TikHubError && e.status === 404) {
          const observedAt = new Date().toISOString()
          const sample = unavailable<never[]>(
            'account_unavailable', sourceFor(ref.platform), observedAt)
          const k = accountKey(ref.platform, ref.handle)
          state.accounts[k] = {
            ...state.accounts[k], platform: ref.platform, handle: ref.handle, sample,
            metrics: calculatePublicMetrics(sample, ref.followers, ref.following),
          }
          newlyQueried++
          persist()
        } else {
          throw e
        }
      }
      done++
      if (done % 10 === 0) console.error(`  ${done}/${list.length}`)
    }
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      stopped = 'budget'
    } else {
      stopped = 'error'
      errorMessage = e instanceof Error ? e.message : String(e)
    }
  }

  // 同行百分位只用本次仍在 fit=✅/⚠️ 名单里的账号。enrichment.json 可能保留
  // 以前查询过、后来被判 ❌ 的账号；让它们继续影响当前阈值会形成隐蔽的陈旧基线。
  const selectedKeys = new Set([...refs.keys()])
  const selectedAccounts = Object.fromEntries(
    [...selectedKeys].flatMap(k => state.accounts[k] ? [[k, state.accounts[k]]] : []),
  )
  assignAudienceRisks(selectedAccounts)
  persist()

  const selected = Object.entries(state.accounts)
    .filter(([k]) => selectedKeys.has(k))
    .map(([, a]) => a)
  const sampleMeasured = selected.filter(a => a.sample?.status === 'measured').length
  const sampleUnavailable = selected.filter(a => a.sample?.status === 'unavailable').length
  const riskMeasured = selected.filter(a => a.metrics?.audience_quality_risk.status === 'measured').length
  const activityMeasured = selected.filter(a => a.metrics?.activity_status.status === 'measured').length
  const activityUnavailable = selected.filter(a => a.metrics?.activity_status.status === 'unavailable').length
  const highRisk = selected.filter(a =>
    a.metrics?.audience_quality_risk.status === 'measured' &&
    a.metrics.audience_quality_risk.value.level === 'high').length

  console.log(JSON.stringify({
    dir,
    stopped,
    ...(errorMessage ? { error: errorMessage } : {}),
    accounts_selected: selected.length,
    newly_queried: newlyQueried,
    locally_recomputed: locallyRecomputed,
    samples_measured: sampleMeasured,
    samples_unavailable: sampleUnavailable,
    activity_measured: activityMeasured,
    activity_unavailable: activityUnavailable,
    risks_measured: riskMeasured,
    high_risk: highRisk,
    requests: budget.count,
    cost_estimate_usd: Number(budget.spent.toFixed(4)),
    budget_usd: task.budget_usd,
  }, null, 2))

  if (stopped === 'budget') {
    console.error(`\n⛔ 预算用尽 ${budget.summary()} —— enrichment.json 已保存，可提高总预算后续跑。`)
    process.exit(3)
  }
  if (stopped === 'error') process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
