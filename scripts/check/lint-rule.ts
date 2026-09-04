/**
 * 纪律 lint 的判定 —— 从入口里抽出来的那一半。
 *
 * 抽出来的理由是 `docs/CONVENTIONS.md` 第 10 条自己那句话：有语义就该能被测，
 * 能被测就不该待在入口脚本里。这条 lint 是 P1 唯一机器可执行的那一半，
 * 而它的判定以前没有任何测试碰得到。
 *
 * **走文件树也是判定**：跳过哪些目录、哪些文件算数、递归到多深，决定了这条 lint
 * 到底看得见多少代码 —— 「全量扫描」被悄悄缩小，和判定写错一样致命，所以它也在
 * 这里。留在 `lint.ts` 的只剩打印和退出码。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 这些字段的值会进入过滤、评分、分层 —— 兜底就是静默改变决策 */
export const SENSITIVE = [
  'followers', 'follower_count', 'post_count', 'aweme_count', 'media_count',
  'following', 'following_count', 'views', 'play_count', 'plays', 'likes', 'like_count',
  'comments', 'comment_count', 'median_views', 'median_engagements',
  'engagement_rate_followers', 'engagement_rate_views', 'view_rate', 'following_ratio',
  'reach_consistency', 'median_post_gap_days', 'latest_post_at', 'days_since_last_post',
  'activity_status', 'audience_quality_risk',
  'implied_ecpm', 'implied_ecpe',
  'bio', 'signature', 'biography', 'email', 'email_verified',
  'audience_geo', 'fake_follower_score',
]

/**
 * `null` 必须在这张表里。它是三态模型的**中间态** —— `?? null` 把「未查询」
 * 写成「查过，没有」，恰恰是 P1 要防的那件事，却是唯一一个曾经漏掉的兜底值。
 * 合法的 `?? null`（确实查过、确实没有）加 p1-ok 说明理由即可。
 */
export const FALLBACK = /(\?\?|\|\|)\s*(0\b|''|""|`|\[\]|false\b|null\b)/

/**
 * 第二类形状：**空输入时返回 0**。
 * 实测栽过一次 —— probe 的 median 在无粉丝数据时返回 0，被读成「这批全是小号」。
 * 敏感字段启发式抓不到它（median 是局部函数），所以单列一条。
 */
export const EMPTY_ZERO = /if\s*\(\s*!\w+\.length\s*\)\s*return\s+(0\b|''|"")/

export type LintVerdict = 'clean' | 'violation' | 'exempt' | 'unjustified_exemption'

/** 一行代码的判定。`unjustified_exemption` 也不放行 —— 豁免的理由是必填的。 */
export function judgeLine(text: string): LintVerdict {
  if (!EMPTY_ZERO.test(text)) {
    if (!FALLBACK.test(text)) return 'clean'
    if (!SENSITIVE.some(f => text.includes(f))) return 'clean'
  }
  if (/\/\/\s*p1-ok:\s*\S/.test(text)) return 'exempt'
  if (/\/\/\s*p1-ok\b/.test(text)) return 'unjustified_exemption'
  return 'violation'
}

/**
 * 检查链自己那一坨不受这条纪律约束：它判定的对象就是兜底写法本身。
 * **只认顶层那一个** —— 按名字在任意深度排除的话，`lib/check/` 这种同名子目录
 * 会跟着被放过，而「全量扫描」正是这么被悄悄缩小的。
 */
export const SKIP_DIRS = ['check']
/**
 * 测试里那些故意写出来的兜底样例不算违规 —— 否则这条 lint 天天红，红到没人看。
 * 同样只认顶层那一个：`lib/test.ts` 是普通代码，该扫。
 */
export const SKIP_FILES = ['test.ts']

export interface Hit { file: string; line: number; text: string }

function walk(dir: string, atRoot = true): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (!(atRoot && SKIP_DIRS.includes(e))) out.push(...walk(p, false))
    } else if (e.endsWith('.ts') && !(atRoot && SKIP_FILES.includes(e))) out.push(p)
  }
  return out
}

/** 扫一棵目录树，交回命中的行与具名豁免的条数。入口拿着它决定打印什么、怎么退出。 */
export function lintTree(root: string): { hits: Hit[]; exempted: number } {
  const hits: Hit[] = []
  let exempted = 0
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((text, i) => {
      const verdict = judgeLine(text)
      if (verdict === 'clean') return
      if (verdict === 'exempt') { exempted++; return }
      hits.push({
        file, line: i + 1,
        text: text.trim() + (verdict === 'unjustified_exemption' ? '   ← p1-ok 必须写明理由' : ''),
      })
    })
  }
  return { hits, exempted }
}
