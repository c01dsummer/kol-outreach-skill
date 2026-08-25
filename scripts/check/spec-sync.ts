#!/usr/bin/env tsx
/**
 * SPEC.md 的表格由 requirements.json 生成 —— 两者不可能漂移。
 *
 * 检查:  tsx scripts/check/spec-sync.ts
 * 回写:  tsx scripts/check/spec-sync.ts --write
 */
import { readFileSync, writeFileSync } from 'node:fs'

const JSON_PATH = 'docs/requirements.json'
const SPEC_PATH = 'docs/SPEC.md'
const BEGIN = '<!-- BEGIN:GENERATED 由 requirements.json 生成，勿手改 -->'
const END = '<!-- END:GENERATED -->'

interface Req { id: string; cat: string; pri: string; text: string; accept: string }

const reqs: Req[] = JSON.parse(readFileSync(JSON_PATH, 'utf8')).requirements
const cats: Record<string, string> = JSON.parse(readFileSync(JSON_PATH, 'utf8')).categories

function render(): string {
  const out: string[] = []
  for (const [cat, label] of Object.entries(cats)) {
    const rows = reqs.filter(r => r.cat === cat)
    if (!rows.length) continue
    out.push(`### ${cat} · ${label}\n`)
    out.push('| 编号 | 优先级 | 需求 | 验收标准 |')
    out.push('|---|---|---|---|')
    for (const r of rows) {
      const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
      out.push(`| **${r.id}** | ${r.pri} | ${esc(r.text)} | ${esc(r.accept)} |`)
    }
    out.push('')
  }
  return out.join('\n')
}

const spec = readFileSync(SPEC_PATH, 'utf8')
const i = spec.indexOf(BEGIN)
const j = spec.indexOf(END)
if (i < 0 || j < 0) {
  console.error(`${SPEC_PATH} 缺少 BEGIN/END 标记`)
  process.exit(1)
}

const want = `${BEGIN}\n\n${render()}${END}`
const got = spec.slice(i, j + END.length)

if (process.argv.includes('--write')) {
  writeFileSync(SPEC_PATH, spec.slice(0, i) + want + spec.slice(j + END.length), 'utf8')
  console.log('✓ SPEC.md 已回写')
  process.exit(0)
}

if (got !== want) {
  console.error('✗ SPEC.md 与 requirements.json 不一致')
  console.error('  以 json 为准，跑 `npx tsx scripts/check/spec-sync.ts --write` 回写')
  process.exit(1)
}
console.log(`✓ SPEC.md 与 requirements.json 一致（${reqs.length} 条需求）`)
