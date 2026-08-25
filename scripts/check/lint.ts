#!/usr/bin/env tsx
/**
 * 纪律 lint —— 把 P1 从散文变成能报错的检查。
 *
 * 只盯**会变成决策的数据字段**上的兜底写法，不管展示层的字符串拼接 ——
 * 一个满屏假阳性的检查会被忽略，而被忽略的检查比没有检查更糟。
 *
 * 需要例外时在该行加 `// p1-ok: <理由>`。理由是必填的。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 这些字段的值会进入过滤、评分、分层 —— 兜底就是静默改变决策 */
const SENSITIVE = [
  'followers', 'follower_count', 'post_count', 'aweme_count', 'media_count',
  'bio', 'signature', 'biography', 'email', 'email_verified',
  'audience_geo', 'fake_follower_score',
]
const FALLBACK = /(\?\?|\|\|)\s*(0\b|''|""|`|\[\]|false\b)/

/**
 * 第二类形状：**空输入时返回 0**。
 * 实测栽过一次 —— probe 的 median 在无粉丝数据时返回 0，被读成「这批全是小号」。
 * 敏感字段启发式抓不到它（median 是局部函数），所以单列一条。
 */
const EMPTY_ZERO = /if\s*\(\s*!\w+\.length\s*\)\s*return\s+(0\b|''|"")/

const SKIP_DIRS = ['check']
const SKIP_FILES = ['test.ts']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.includes(e)) out.push(...walk(p))
    } else if (e.endsWith('.ts') && !SKIP_FILES.includes(e)) out.push(p)
  }
  return out
}

interface Hit { file: string; line: number; text: string }
const hits: Hit[] = []
let exempted = 0

for (const file of walk('scripts')) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((text, i) => {
    const emptyZero = EMPTY_ZERO.test(text)
    if (!emptyZero) {
      if (!FALLBACK.test(text)) return
      if (!SENSITIVE.some(f => text.includes(f))) return
    }
    if (/\/\/\s*p1-ok:\s*\S/.test(text)) { exempted++; return }
    if (/\/\/\s*p1-ok\b/.test(text)) {
      hits.push({ file, line: i + 1, text: text.trim() + '   ← p1-ok 必须写明理由' })
      return
    }
    hits.push({ file, line: i + 1, text: text.trim() })
  })
}

if (hits.length) {
  console.error(`✗ 纪律 lint：${hits.length} 处敏感字段上的兜底写法（违反 P1）\n`)
  for (const h of hits) console.error(`  ${h.file}:${h.line}\n    ${h.text}\n`)
  console.error('  「没查到」和「值为 0/空」必须可区分。')
  console.error('  确有必要时在该行加 `// p1-ok: <理由>`。')
  process.exit(1)
}
console.log(`✓ 纪律 lint：无违规（${exempted} 处已具名豁免）`)
