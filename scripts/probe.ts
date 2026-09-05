#!/usr/bin/env tsx
/**
 * Phase 02 —— 小样试探（F3）
 *
 * 每个关键词每个平台只抓 1 页，输出样本供 Agent 判读方向对不对。
 * 成本约 20 次请求（不到 3 美分），用来避免整轮返工。
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
import { Budget, BudgetExceeded, budgetProblem, showAmount } from './lib/budget.js'
import { extractEmail } from './lib/email.js'
import type { SearchTask } from './lib/types.js'

const cfgPath = process.argv[process.argv.indexOf('--config') + 1]
if (!cfgPath || cfgPath.startsWith('--')) {
  console.error('用法: tsx scripts/probe.ts --config probe.json')
  process.exit(2)
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as {
  market?: string; budget_usd?: number; tasks: SearchTask[]
}

const key = process.env.TIKHUB_API_KEY
if (!key) {
  console.error('缺少 TIKHUB_API_KEY。到 https://tikhub.io 注册后写入 .env')
  process.exit(2)
}

// 预算上限在花钱之前查。闸门是一句「已花 + 本次开销 > 上限」的比较：上限不是
// 有限的数时它恒为假，闸门整条失效（P3）。判定与另外两条入口共用 lib/budget.ts
// 的那一份 —— 三条入口各写一份表达式时，先改的那边不会报错。
const probeBudget = cfg.budget_usd ?? 0.5
const badBudget = budgetProblem(probeBudget)
if (badBudget) {
  console.error(`${cfgPath} 里的 budget_usd ${badBudget}：${showAmount(cfg.budget_usd)} —— ` +
                `预算闸门要拿它和已花的钱比大小，比不了就等于没有闸门。`)
  process.exit(2)
}
const budget = new Budget(probeBudget)
const api = new TikHub(key, budget)
const market = cfg.market ?? 'US'

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
  const results: any[] = []

  for (const t of cfg.tasks) {
    const label = `${t.as_hashtag ? '#' : ''}${t.keyword} · ${t.platform}`
    try {
      const { creators: found } = await api.search(t, market, 0)
      // P1：粉丝数未知的排除出中位数计算，而不是当作 0 拉低它
      const followers = found.map(c => c.followers).filter((n): n is number => n !== undefined)

      // 样本取粉丝数居中的 3 个 —— 比取头部更能反映这个词的典型产出
      const sample = [...found]
        .sort((a, b) => (b.followers ?? -1) - (a.followers ?? -1))   // p1-ok: 仅排序取样，未知排末位，不写回数据
        .slice(Math.floor(found.length / 4), Math.floor(found.length / 4) + 3)

      results.push({
        keyword: t.keyword, dimension: t.dimension, platform: t.platform,
        as_hashtag: t.as_hashtag ?? false,
        found: found.length,
        follower_count_known: followers.length,
        // JSON.stringify 会直接丢掉 undefined 的键 —— 字段消失后，消费方
        // 写 `r.follower_median ?? 0` 又回到「未知被当成 0」。显式发 null。
        follower_median: median(followers) ?? null,   // p1-ok: 上一句注释已说明——这里的 null 是「样本里没人有粉丝数」的显式表达，不是把未知当成值
        // P1：bio 未取到 ≠ bio 里没邮箱。分母要一起给出，否则用户会据此
        //     误判关键词质量 —— 搜索结果本来就常常不含 bio。
        //     「查过、对方没写」（null）算取到了：我们确实读到了他的简介栏。
        bio_available: found.filter(c => c.bio !== undefined).length,
        email_in_bio: found.filter(c => typeof c.bio === 'string' && extractEmail(c.bio)).length,
        sample: sample.map(c => ({
          handle: c.handle, nickname: c.nickname,
          followers: c.followers === undefined ? '未知' : c.followers,
          bio: c.bio === undefined ? '（未取到）' : c.bio === null ? '（没写简介）' : c.bio.slice(0, 120),
          top_post: (c.recent_posts?.[0]?.desc ?? '').slice(0, 120),
        })),
      })
      console.error(`  ✓ ${label} → ${found.length} 人`)
    } catch (e) {
      if (e instanceof BudgetExceeded) {
        console.error(`\n预算用尽（${budget.summary()}），试探未跑完。`)
        break
      }
      const msg = e instanceof TikHubError ? e.message : String(e)
      results.push({ keyword: t.keyword, platform: t.platform, error: msg })
      console.error(`  ✗ ${label} → ${msg}`)
      if (e instanceof TikHubError && e.status === 402) break
    }
  }

  // stdout 出 JSON 给 Agent 读，进度信息走 stderr
  console.log(JSON.stringify({
    market,
    requests: budget.count,
    cost_estimate_usd: Number(budget.spent.toFixed(4)),
    results,
  }, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
