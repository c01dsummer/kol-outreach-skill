#!/usr/bin/env tsx
/**
 * 纪律 lint —— 把 P1 从散文变成能报错的检查。
 *
 * 只盯**会变成决策的数据字段**上的兜底写法，不管展示层的字符串拼接 ——
 * 一个满屏假阳性的检查会被忽略，而被忽略的检查比没有检查更糟。
 *
 * 需要例外时在该行加 `// p1-ok: <理由>`。理由是必填的。
 */
import { lintTree } from './lint-rule.js'

const { hits, exempted } = lintTree('scripts')

if (hits.length) {
  console.error(`✗ 纪律 lint：${hits.length} 处敏感字段上的兜底写法（违反 P1）\n`)
  for (const h of hits) console.error(`  ${h.file}:${h.line}\n    ${h.text}\n`)
  console.error('  「没查到」和「值为 0/空」必须可区分。')
  console.error('  确有必要时在该行加 `// p1-ok: <理由>`。')
  process.exit(1)
}
console.log(`✓ 纪律 lint：无违规（${exempted} 处已具名豁免）`)
