#!/usr/bin/env tsx
/**
 * 变异测试 —— 给测试做的测试。
 *
 * 逐个应用「故意违反需求」的改动，跑测试，**期望测试失败**。
 * 变异被抓到 = 那条测试有效；**变异存活 = 那条测试是假的**，要修测试不是删变异。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

interface Mut { id: string; req: string; why: string; file: string; find: string; replace: string }
const cfg = JSON.parse(readFileSync('scripts/check/mutations.json', 'utf8'))
const muts: Mut[] = cfg.mutations

const survived: Mut[] = []
const notApplied: Mut[] = []

for (const m of muts) {
  const orig = readFileSync(m.file, 'utf8')
  if (!orig.includes(m.find)) {
    notApplied.push(m)
    console.log(`  ⚠ ${m.id}  锚点失效，未能应用`)
    continue
  }
  writeFileSync(m.file, orig.replace(m.find, m.replace), 'utf8')
  let testFailed = false
  try {
    execSync('npx tsx scripts/test.ts', { stdio: 'pipe' })
  } catch {
    testFailed = true              // 期望的结果
  } finally {
    writeFileSync(m.file, orig, 'utf8')
  }
  if (testFailed) console.log(`  ✓ ${m.id}  [${m.req}] 被抓到`)
  else { survived.push(m); console.log(`  ✗ ${m.id}  [${m.req}] 存活 —— ${m.why}`) }
}

console.log()
for (const e of cfg.exemptions ?? []) {
  console.log(`  ⊘ ${e.req} 无变异（显式缺口）：${e.why.split('。')[0]}。`)
}

if (survived.length || notApplied.length) {
  console.error(`\n✗ 变异测试：${survived.length} 个存活，${notApplied.length} 个锚点失效`)
  if (survived.length) console.error('  存活意味着对应的测试证明不了任何事 —— 修测试，不要删变异。')
  process.exit(1)
}
console.log(`✓ 变异测试：${muts.length} 个变异全部被抓到`)
