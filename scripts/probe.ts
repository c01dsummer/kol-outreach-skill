#!/usr/bin/env tsx
/**
 * Phase 02 —— 小样试探
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
import { Budget, BudgetExceeded } from './lib/budget.js'
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

const budget = new Budget(cfg.budget_usd ?? 0.5)
const api = new TikHub(key, budget)
const market = cfg.market ?? 'US'

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  const results: any[] = []

  for (const t of cfg.tasks) {
    const label = `${t.as_hashtag ? '#' : ''}${t.keyword} · ${t.platform}`
    try {
      const found = await api.search(t, market, 0)
      const followers = found.map(c => c.followers ?? 0).filter(n => n > 0)

      // 样本取粉丝数居中的 3 个 —— 比取头部更能反映这个词的典型产出
      const sample = [...found]
        .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
        .slice(Math.floor(found.length / 4), Math.floor(found.length / 4) + 3)

      results.push({
        keyword: t.keyword, dimension: t.dimension, platform: t.platform,
        as_hashtag: t.as_hashtag ?? false,
        found: found.length,
        follower_median: median(followers),
        email_in_bio: found.filter(c => extractEmail(c.bio ?? '')).length,
        sample: sample.map(c => ({
          handle: c.handle, nickname: c.nickname, followers: c.followers,
          bio: (c.bio ?? '').slice(0, 120),
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
