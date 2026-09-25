#!/usr/bin/env tsx
/**
 * Phase 02 —— 小样试探（F3）
 *
 * 每个关键词每个平台只抓 1 页，输出样本供 Agent 判读方向对不对。
 * 费用按实际端点的固定公开价目估算，用来避免整轮返工。
 *
 * 用法：
 *   tsx scripts/probe.ts --config probe.json
 *
 * probe.json:
 *   { "market": "US", "budget_usd": 0.5,
 *     "tasks": [{ "keyword": "power bank review", "dimension": "category",
 *                 "platform": "tiktok" }, ...] }
 */
import { readFileSync } from 'node:fs'
import { TikHub, TikHubError } from './providers/tikhub.js'
import { Budget, BudgetInputError, startBudget } from './lib/budget.js'
import { CostError, parseUsdMicros } from './lib/cost-ledger.js'
import { readCostDocument, readCostLimit, stringifyCostJson, type CostState } from './lib/cost-json.js'
import { extractEmail } from './lib/email.js'
import type { SearchTask } from './lib/types.js'
import { taskLabel } from './lib/task-label.js'
import { igRouteProblems } from './lib/ig-route.js'
import { taskListProblems } from './lib/search-tasks.js'

const cfgIndex = process.argv.indexOf('--config')
const cfgPath = process.argv[cfgIndex + 1]
if (cfgIndex < 0 || !cfgPath || cfgPath.startsWith('--')) {
  console.error('用法: tsx scripts/probe.ts --config probe.json')
  process.exit(2)
}
type ProbeConfig = CostState & { market?: string; tasks: SearchTask[] }

/** 结果行里的 ig_route：任务写了就原样带出，没写就一个键都不加（D15.l、D15.m） */
const routeOf = (t: SearchTask): { ig_route?: SearchTask['ig_route'] } =>
  t.ig_route === undefined ? {} : { ig_route: t.ig_route }

/**
 * P1：没有数据时返回 undefined，**不是 0**。
 * 返回 0 会让用户读成「这批全是小号」，而事实是「这个平台的搜索结果不给粉丝数」——
 * 他会据此毙掉一个好关键词。
 */
const median = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  let cfg: ProbeConfig
  let budget: Budget
  try {
    cfg = readCostDocument<ProbeConfig>(readFileSync(cfgPath, 'utf8'))
    // D16.l/m、D15.j：原样任务列表与路线一起查，在开预算、发请求之前停下。
    const badTasks = taskListProblems(cfg.tasks)
    const badRoutes = igRouteProblems(cfg.tasks)
    const taskProblems = [...badTasks, ...badRoutes]
    if (taskProblems.length) throw new Error(`任务配置不合规：${taskProblems.join('；')}`)
    // D13.a：只在缺席时默认；显式 null、字符串与超精度原 token 均交给共同边界拒绝。
    const absent = cfg.budget_usd === undefined
    const limit = absent ? parseUsdMicros('0.5') : readCostLimit(cfg)
    if (absent) console.error('未提供 budget_usd，本次试探默认使用进程总预算 $0.5。')
    budget = startBudget(cfg, limit, 'process', (threshold, view) => {
      console.error(`预算占用已达 ${threshold * 100}%：$${view.cost_estimate_usd} / $${view.budget_usd}`)
    })
  } catch (error) {
    throw new BudgetInputError(`${cfgPath}：${error instanceof Error ? error.message : String(error)}`)
  }
  const api = new TikHub(process.env.TIKHUB_API_KEY, budget)
  const market = cfg.market ?? 'US'
  const results: any[] = []

  for (const [i, t] of cfg.tasks.entries()) {
    const label = taskLabel(t, i)
    try {
      const { creators: found } = await api.search(t, market, 0)
      // P1：粉丝数未知的排除出中位数计算，而不是当作 0 拉低它
      const followers = found.map(c => c.followers).filter((n): n is number => n !== undefined)

      // 样本取粉丝数居中的 3 个 —— 比取头部更能反映这个词的典型产出
      const sample = [...found]
        .sort((a, b) => (b.followers ?? -1) - (a.followers ?? -1))   // P1 例外：仅排序取样，未知排末位，不写回数据
        .slice(Math.floor(found.length / 4), Math.floor(found.length / 4) + 3)

      results.push({
        task_index: i,
        keyword: t.keyword, dimension: t.dimension, platform: t.platform,
        as_hashtag: t.as_hashtag ?? false,
        // D15.l：路线只由 ig_route 决定（D15.k），话题任务 0 人时只看这一行也要分得出走的哪条路。
        // 照配置原样带出；没写就不带这个键 —— 不补成 "reels"，那是配置里没有的值（P1）
        ...routeOf(t),
        found: found.length,
        follower_count_known: followers.length,
        // JSON.stringify 会直接丢掉 undefined 的键 —— 字段消失后，消费方
        // 写 `r.follower_median ?? 0` 又回到「未知被当成 0」。显式发 null。
        follower_median: median(followers) ?? null,   // P1 例外：上一句注释已说明——这里的 null 是「样本里没人有粉丝数」的显式表达，不是把未知当成值
        // P1：bio 未取到 ≠ bio 里没邮箱。分母要一起给出，否则用户会据此
        //     误判关键词质量 —— 搜索结果本来就常常不含 bio。
        //     「查过、对方没写」（null）算取到了：我们确实读到了他的简介栏。
        bio_available: found.filter(c => c.bio !== undefined).length,
        email_in_bio: found.filter(c => typeof c.bio === 'string' && extractEmail(c.bio)).length,
        sample: sample.map(c => ({
          handle: c.handle, nickname: c.nickname,
          discovery_sources: c.discovery_sources,
          followers: c.followers === undefined ? '未知' : c.followers,
          bio: c.bio === undefined ? '（未取到）' : c.bio === null ? '（没写简介）' : c.bio.slice(0, 120),
          top_post: c.recent_posts?.length ? c.recent_posts[0].desc.slice(0, 120) : '（未查询）',
        })),
      })
      console.error(`  ✓ ${label} → ${found.length} 人`)
    } catch (e) {
      if (e instanceof CostError && e.code === 'budget-exceeded') {
        console.error(`\n余额不足以支付下一请求（${budget.summary()}），试探未跑完。`)
        break
      }
      if (e instanceof CostError || e instanceof BudgetInputError) throw e
      const msg = e instanceof TikHubError ? e.message : String(e)
      results.push({ task_index: i, keyword: t.keyword, dimension: t.dimension, platform: t.platform, ...routeOf(t), error: msg })   // D15.m
      console.error(`  ✗ ${label} → ${msg}`)
      if (e instanceof TikHubError && e.status === 402) break
    }
  }

  // stdout 出 JSON 给 Agent 读，进度信息走 stderr
  console.log(stringifyCostJson({ market, results }, budget.view()))
}

// F3.c／F3.e：输入问题（BudgetInputError，退出码 2）只写问题本身 —— 内部异常的类名与堆栈对运营没有用，类名还会把
// 路线、读不出配置这类问题说成预算问题。配置里的问题在 main() 开头那个 try 里抛出，包装时带上了配置路径（F3.d）；
// 缺 API key 是请求时由 TikHub 抛的，消息里没有配置路径，也用不着。运行中的内部错误（退出码 1）照旧整条打出来。
main().catch(e => { console.error(e instanceof BudgetInputError ? e.message : e); process.exit(e instanceof BudgetInputError ? 2 : 1) })
