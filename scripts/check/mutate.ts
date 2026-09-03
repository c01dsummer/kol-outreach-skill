#!/usr/bin/env tsx
/**
 * 变异测试 —— 给测试做的测试。
 *
 * 逐个应用「故意违反需求」的改动，跑测试，**期望测试失败**。
 * 变异被抓到 = 那条测试有效；**变异存活 = 那条测试是假的**，要修测试不是删变异。
 * **测试进程崩了不算抓到**（`mutate-rule.ts`）：崩溃不是任何一条断言的功劳。
 *
 * 用法：
 *   tsx scripts/check/mutate.ts            逐个应用变异并跑测试
 *   tsx scripts/check/mutate.ts --brief    只列出每条「违反了什么」，不跑任何东西
 *
 * `--brief` 是给**写测试的那个上下文**用的：`why` 是需求语言，可以给；
 * `find`/`replace` 是实现原文，给了就等于让它读实现。
 * 见 process/4-VERIFY.md 的「给测试上下文一张准入读物清单」。
 *
 * 这条防线的强度取决于 `why` 怎么写 —— 引了实现原文的 why，`--brief` 照样把它漏出去。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { orphanAttributions } from './attribution-rule.js'
import { implementationLeak } from './why-rule.js'
import { type RunVerdict, judgeRun } from './mutate-rule.js'

interface Mut { id: string; req: string; why: string; file: string; find: string; replace: string }
interface Exemption { req: string; scope?: string; why: string; mitigation?: string }
const cfg = JSON.parse(readFileSync('scripts/check/mutations.json', 'utf8'))
const muts: Mut[] = cfg.mutations
const exemptions: Exemption[] = cfg.exemptions ?? []

// 记在谁名下。审计拿 req 回答「这条需求有没有变异守着」—— 写成一个不存在的
// 编号时，变异照样跑、照样被抓到，全绿，而它对任何一条需求都不算数（ADR-34）。
// 名下目前是需求编号；验收判据拆成独立编号之后，判据编号也进这份名单。
const registry: { id: string }[] = JSON.parse(readFileSync('docs/requirements.json', 'utf8')).requirements
const known = new Set(registry.map(r => r.id))
const orphans = [
  ...orphanAttributions(muts, known),
  ...orphanAttributions(exemptions.map(e => ({ id: `豁免 ${e.req}`, req: e.req })), known),
]
if (orphans.length) {
  console.error(`✗ 变异集：${orphans.length} 条记在不存在的需求名下 —— 它们对任何一条需求都不算数\n`)
  for (const o of orphans) console.error(`  ${o.id}  记在 ${o.req} 名下，而登记表里没有这条`)
  console.error('\n  守检查链本身的写 harness；守某条需求的写它真实的编号。')
  process.exit(1)
}

const dirty = muts.flatMap(m => {
  const leak = implementationLeak(m.why)
  return leak === undefined ? [] : [`${m.id}  夹带实现原文：${leak}`]
})
if (dirty.length) {
  console.error(`✗ 变异集：${dirty.length} 条 why 夹带实现原文 —— --brief 会把它漏给写测试的上下文\n`)
  for (const d of dirty) console.error(`  ${d}`)
  console.error('\n  why 说「什么会变错、用户会看到什么」，不引代码。对外契约里的名字不算实现原文。')
  process.exit(1)
}

if (process.argv.includes('--brief')) {
  console.log('\n变异集 —— 每条变异「违反了什么」。不含实现原文，可以交给写测试的上下文。\n')
  for (const m of muts) console.log(`  ${m.id}  [${m.req}]  ${m.why}`)
  for (const e of exemptions) {
    console.log(`  ⊘     [${e.req}]  无变异（显式缺口${e.scope === undefined ? '' : `，${e.scope}`}）：${e.why}`)
  }
  console.log(`\n共 ${muts.length} 个变异、${exemptions.length} 处显式豁免。`)
  process.exit(0)
}

const survived: Mut[] = []
const crashed: Mut[] = []
const notApplied: Mut[] = []

for (const m of muts) {
  const orig = readFileSync(m.file, 'utf8')
  if (!orig.includes(m.find)) {
    notApplied.push(m)
    console.log(`  ⚠ ${m.id}  锚点失效，未能应用`)
    continue
  }
  writeFileSync(m.file, orig.replace(m.find, m.replace), 'utf8')
  let verdict: RunVerdict
  try {
    execSync('npx tsx scripts/test.ts', { stdio: 'pipe' })
    verdict = 'survived'
  } catch (e: any) {
    // 非零退出是期望的结果 —— 但要看是断言红的,还是进程死在半路(被信号杀掉时 status 为 null)
    verdict = judgeRun(e.status ?? null, `${e.stdout ?? ''}\n${e.stderr ?? ''}`)
  } finally {
    writeFileSync(m.file, orig, 'utf8')
  }
  if (verdict === 'caught') console.log(`  ✓ ${m.id}  [${m.req}] 被抓到`)
  else if (verdict === 'crashed') {
    crashed.push(m)
    console.log(`  ✗ ${m.id}  [${m.req}] 跑不起来 —— 测试进程死在半路,没有任何一条断言抓到它`)
  } else { survived.push(m); console.log(`  ✗ ${m.id}  [${m.req}] 存活 —— ${m.why}`) }
}

console.log()
for (const e of exemptions) {
  console.log(`  ⊘ ${e.req} 无变异（显式缺口）：${e.why.split('。')[0]}。`)
}

if (survived.length || crashed.length || notApplied.length) {
  console.error(`\n✗ 变异测试：${survived.length} 个存活，${crashed.length} 个跑不起来，${notApplied.length} 个锚点失效`)
  if (survived.length) console.error('  存活意味着对应的测试证明不了任何事 —— 修测试，不要删变异。')
  if (crashed.length) console.error('  跑不起来不算抓到：崩溃不是断言的功劳。让那条测试作为断言失败，或者把变异改成一处语义改动而不是语法错误。')
  process.exit(1)
}
console.log(`✓ 变异测试：${muts.length} 个变异全部被抓到`)
