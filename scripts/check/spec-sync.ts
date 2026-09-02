#!/usr/bin/env tsx
/**
 * SPEC.md 的表格由 requirements.json 生成 —— 两者不可能漂移。
 *
 * 顺带守住登记表自己的完整性：编号唯一、交点与决策记录编号真实存在、
 * **内容指纹与内容一致**。判定在 `spec-rule.ts`，这里只做读写、打印、退出码。
 *
 * 检查:  tsx scripts/check/spec-sync.ts
 * 回写:  tsx scripts/check/spec-sync.ts --write
 *
 * `content_hash` 是**派生字段,由 --write 写** —— 没有任何人需要记得改它。
 * 手改需求而不回写,这条检查当场变红。
 * （从 2026-08-25 到 2026-08-28,那里躺着一个从没递增过的 `version`,
 *  经历 5 次需求改动无人发现 —— 那正是「只能靠自觉的字段」的下场,见 ADR-17。
 *  同一个位置上曾经还有个 `updated_at`:它既没人读、也校验不了 ——
 *  随手改成任何日期都能通过。按同一条规矩删掉了,见 ADR-30。）
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  adrIdsIn, contentHash, danglingAdrRefs, renderTables, validateRegistry, type Req,
} from './spec-rule.js'

const JSON_PATH = 'docs/requirements.json'
const SPEC_PATH = 'docs/SPEC.md'
/** 决策记录一条一个文件（`DECISIONS.md` 只做转发，见那份文件） */
const ADR_DIR = 'docs/adr'
const BEGIN = '<!-- BEGIN:GENERATED 由 requirements.json 生成，勿手改 -->'
const END = '<!-- END:GENERATED -->'
const FIX = '跑 `npx tsx scripts/check/spec-sync.ts --write` 回写'

const registry = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
const reqs: Req[] = registry.requirements
const cats: Record<string, string> = registry.categories
/**
 * 记录已拆成一文件一条，把各文件接起来喂给判定 —— 判定只认「记录标题」和
 * 「冲击的需求」那几行的形状，不关心它们装在一个文件里还是许多个。
 */
const decisions = readdirSync(ADR_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort()
  .map(f => readFileSync(join(ADR_DIR, f), 'utf8')).join('\n')

// ---- 1. 登记表自身的完整性 ----
const problems = [
  ...validateRegistry(reqs, adrIdsIn(decisions), Object.keys(cats)),
  ...danglingAdrRefs(decisions, new Set(reqs.map(r => r.id)), Object.keys(cats)),
]
if (problems.length) {
  console.error(`✗ 需求登记表：${problems.length} 处问题\n`)
  for (const p of problems) console.error(`  · ${p}`)
  process.exit(1)
}

// ---- 2. 内容指纹 ----
const hash = contentHash(reqs, cats)
const write = process.argv.includes('--write')

if (write && registry.content_hash !== hash) {
  registry.content_hash = hash
  writeFileSync(JSON_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  console.log(`✓ 内容指纹已更新 → ${hash}`)
}

// ---- 3. SPEC.md 的表格 ----
const spec = readFileSync(SPEC_PATH, 'utf8')
const i = spec.indexOf(BEGIN)
const j = spec.indexOf(END)
if (i < 0 || j < 0) {
  console.error(`${SPEC_PATH} 缺少 BEGIN/END 标记`)
  process.exit(1)
}

const want = `${BEGIN}\n\n${renderTables(reqs, cats)}${END}`
const got = spec.slice(i, j + END.length)

if (write) {
  if (got !== want) {
    writeFileSync(SPEC_PATH, spec.slice(0, i) + want + spec.slice(j + END.length), 'utf8')
    console.log('✓ SPEC.md 已回写')
  } else console.log('✓ SPEC.md 无需回写')
  process.exit(0)
}

let failed = false
if (registry.content_hash !== hash) {
  console.error('✗ 需求登记表的内容指纹对不上 —— 需求改过但没回写')
  console.error(`  记着 ${registry.content_hash ?? '（无）'}，实际 ${hash}`)
  console.error(`  ${FIX}`)
  failed = true
}
if (got !== want) {
  console.error('✗ SPEC.md 与 requirements.json 不一致')
  console.error(`  以 json 为准，${FIX}`)
  failed = true
}
if (failed) process.exit(1)

const dead = reqs.filter(r => r.deprecated).length
console.log(`✓ SPEC.md 与 requirements.json 一致（现行 ${reqs.length - dead} 条` +
            `${dead ? ` · 已作废 ${dead} 条` : ''} · 指纹 ${hash}）`)
