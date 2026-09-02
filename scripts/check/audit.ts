#!/usr/bin/env tsx
/**
 * 链路审计 —— 回答**完成度**，不回答「功能做完了没有」。
 *
 * 「功能做完了」是自评，审计是他评。
 *
 * 注意：报出来的缺口不要急着消灭。合理的缺口（需要真实 API、属于人工约定）
 * 应当显式留在报告里 —— 一份没有任何待办的审计报告，通常意味着标准被调低了。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { JUDGMENT_EXEMPT, judgmentModules, unguarded } from './audit-rule.js'

interface Req { id: string; cat: string; pri: string; text: string; accept: string }
const spec = JSON.parse(readFileSync('docs/requirements.json', 'utf8'))
const reqs: Req[] = spec.requirements
const mutCfg = JSON.parse(readFileSync('scripts/check/mutations.json', 'utf8'))

function walk(dir: string, ext = '.ts'): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p, ext))
    else if (p.endsWith(ext)) out.push(p)
  }
  return out
}

/**
 * 决策记录不算下游引用。
 *
 * 它们讲的是「当初为什么这么定」，不是「这条需求落在哪」。整册还在根目录
 * `DECISIONS.md` 的时候不在语料里；拆进 `docs/adr/` 之后如果照单收下，一条
 * 只被某条记录顺口提过、根本没落到代码的需求，会从「· 未被引用」变成「✓」——
 * 和架构文档那条是同一个坑，而且会是这次搬家自己引入的。
 */
const ADR_DIR = 'docs/adr/'

const sources = [...walk('scripts'), ...walk('docs', '.md'), ...walk('skill', '.md')]
  .filter(f => !f.startsWith(ADR_DIR))
const corpus = new Map<string, string>()
for (const f of sources) corpus.set(f, readFileSync(f, 'utf8'))

const testSrc = corpus.get('scripts/test.ts') ?? ''
const testedIds = new Set([...testSrc.matchAll(/suite\('([A-Z]\d+)'/g)].map(m => m[1]))
const alsoCovered = new Set([...testSrc.matchAll(/covered\.add\('([A-Z]\d+)'\)/g)].map(m => m[1]))
for (const id of alsoCovered) testedIds.add(id)

const mutatedIds = new Set<string>(mutCfg.mutations.map((m: any) => m.req))
const exemptIds = new Map<string, string>(
  (mutCfg.exemptions ?? []).map((e: any) => [e.req, e.why]))

const rows: string[] = []
const gaps: string[] = []
let hard = 0

/**
 * 架构文档也是合法的下游引用，但它**只是一份文档**。
 *
 * 不单独拎出来的话，一条只在锚点表里被提过、根本没落到代码的需求，会从
 * 「· 未被引用」变成「✓」—— 正是 4-VERIFY.md 说的「判据被无关的东西满足」，
 * 而且是新增这份文档时自己引入的。
 */
const ARCH_DOC = 'docs/ARCHITECTURE.md'

// ---- 1. 每条需求是否在下游被引用 ----
for (const r of reqs) {
  const refs = [...corpus.entries()]
    .filter(([f, c]) => f !== 'docs/requirements.json' && f !== 'docs/SPEC.md' &&
                        new RegExp(`\\b${r.id}\\b`).test(c))
    .map(([f]) => f)
  /** 落到实处的引用 —— 架构文档说了不算 */
  const impl = refs.filter(f => f !== ARCH_DOC)
  const tested = testedIds.has(r.id)
  const mutated = mutatedIds.has(r.id)
  const exempt = exemptIds.has(r.id)

  let flag = '✓'
  if (r.cat === 'P') {
    if (!tested) { flag = '✗'; hard++; gaps.push(`${r.id} 是红线但没有测试`) }
    else if (!mutated && !exempt) { flag = '✗'; hard++; gaps.push(`${r.id} 有测试但没有变异验证 —— 那条测试没被证明过`) }
    else if (exempt) flag = '⊘'
  } else if (!impl.length && !tested) {
    flag = '·'
    gaps.push(refs.length
      ? `${r.id} 仅被架构文档引用，未落到代码或测试`
      : `${r.id} 未在任何下游文件中被引用`)
  }
  rows.push(`  ${flag} ${r.id.padEnd(3)} ${r.cat}  测试${tested ? '✓' : '·'} 变异${mutated ? '✓' : exempt ? '⊘' : '·'}  引用 ${refs.length} 处`)
}

// ---- 2. 可执行文件是否都被执行过 ----
const selfcheck = corpus.get('scripts/check/selfcheck.ts') ?? ''
const entrypoints = walk('scripts').filter(f =>
  readFileSync(f, 'utf8').startsWith('#!') && !f.startsWith('scripts/check/'))
/** 自身就是检查链一环的文件，不需要再被自检执行一遍 */
const EXEC_EXEMPT: Record<string, string> = {
  'scripts/test.ts': '它本身就是检查链的一环，由 npm test 与变异测试反复执行',
}
const unexecuted = entrypoints.filter(f => {
  if (f in EXEC_EXEMPT) return false
  const base = f.split('/').pop()!
  // 只认 S('xxx.ts') 这个精确形式。早先还 or 了一个 `includes(base)` 兜底，
  // 结果是 selfcheck.ts 里**任何地方**提到文件名（哪怕注释里）就算「执行过」——
  // 前面那个精确判据变成死代码，整条检查形同虚设。
  return !selfcheck.includes(`S('${base}')`)
})
for (const f of unexecuted) { hard++; gaps.push(`${f} 是可执行文件但未被自检执行，也未登记豁免`) }

// ---- 3. 检查链自己的判定模块，是否都有变异守着 ----
/**
 * 红线那一段查的是「产品的需求有没有被证明过」；这一段查的是「闸门自己有没有被证明过」。
 * 判据在 `audit-rule.ts`：scripts/check/ 下不带 shebang 的文件都是判定，每个都得有变异指向它。
 * 这不是待办（`·`），是硬失败 —— 一道没被证明过的闸门，和红线没变异是同一级的事。
 */
const judgments = judgmentModules(walk('scripts/check').map(f =>
  ({ path: f, entry: readFileSync(f, 'utf8').startsWith('#!') })))
const naked = unguarded(judgments, mutCfg.mutations)
for (const f of naked) {
  hard++
  gaps.push(`${f} 是判定模块但没有变异守着 —— 它的测试没被证明过会红（process/4-VERIFY.md 的第三拍）`)
}

// ---- 4. SPEC 与 json 一致性由 spec-sync 保证，这里只提示 ----

console.log('\n链路审计\n')
console.log(rows.join('\n'))
console.log(`\n  图例：✓ 完整  ⊘ 显式豁免  · 缺口  ✗ 硬失败\n`)

for (const [id, why] of exemptIds) {
  console.log(`  ⊘ ${id} 部分豁免（显式缺口，不消灭）：\n     ${why}`)
}
for (const [f, why] of Object.entries(EXEC_EXEMPT)) {
  console.log(`  ⊘ ${f} 免于自检执行：${why}`)
}
for (const [f, why] of Object.entries(JUDGMENT_EXEMPT)) {
  console.log(`  ⊘ ${f} 不算判定模块：${why}`)
}

if (gaps.length) {
  console.log(`\n  待办 ${gaps.length} 项：`)
  for (const g of gaps) console.log(`    · ${g}`)
}

const P = reqs.filter(r => r.cat === 'P')
console.log(`\n  红线 ${P.length} 条 · 有测试 ${P.filter(r => testedIds.has(r.id)).length} · ` +
            `有变异 ${P.filter(r => mutatedIds.has(r.id)).length} · 显式豁免 ${P.filter(r => exemptIds.has(r.id)).length}`)
console.log(`  需求 ${reqs.length} 条 · 被测试覆盖 ${reqs.filter(r => testedIds.has(r.id)).length}`)
console.log(`  检查链的判定模块 ${judgments.length} 个 · 有变异守着 ${judgments.length - naked.length}`)

if (hard) { console.error(`\n✗ 审计：${hard} 项硬失败`); process.exit(1) }
console.log('\n✓ 审计：红线全部有测试且被变异验证；检查链的判定模块全部有变异守着')
