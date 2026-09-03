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
import { createHash } from 'node:crypto'
import { CLAIMS_PATH, SELF, claimsFresh, type Claims } from './claims.js'

import {
  REDLINE_CAT, active, requirementVerdict, tensionCritical, tensionVerdict, type Req,
} from './spec-rule.js'
const spec = JSON.parse(readFileSync('docs/requirements.json', 'utf8'))
const all: Req[] = spec.requirements
/** 作废的不参与覆盖率 —— 算进去会让「还差多少」变成一个虚报的数 */
const reqs = active(all)
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

/*
 * 「有没有测试」从**运行时记录**读，不从源码里搜。
 *
 * 原先按源码正则找 `suite('X')` 和交点认领，于是**注释掉的认领照样算数** ——
 * 把测试删掉、认领留在注释里，红线交点的硬失败就被一句注释绕过去了。
 * 这个文件下面那段关于 `includes(base)` 的注释记的是同一个坑，我又踩了一次
 * （ADR-20）。记录带着 `scripts/test.ts` 的指纹，对不上就是过期的，不算数。
 */
let claims: Claims
try {
  claims = JSON.parse(readFileSync(CLAIMS_PATH, 'utf8'))
} catch {
  console.error(`✗ 找不到测试的覆盖记录 ${CLAIMS_PATH}\n`)
  console.error('  审计回答不了「有没有测试」—— 那是测试跑过之后才存在的事实。')
  console.error('  先跑 `npm test`（`npm run check` 会按顺序跑）。')
  process.exit(1)
}
const selfHash = createHash('sha256')
  .update(readFileSync(SELF, 'utf8')).digest('hex').slice(0, 12)
if (!claimsFresh(claims.source_hash, selfHash)) {
  console.error(`✗ 覆盖记录是旧的：${SELF} 改过，但测试没重跑\n`)
  console.error(`  记录里是 ${claims.source_hash}，实际 ${selfHash}`)
  console.error('  先跑 `npm test`。')
  process.exit(1)
}
const testedIds = new Set(claims.covered)
/**
 * 判据级的覆盖。
 *
 * 「每条需求有没有测试」这个计量单位**比事实粗**:验收标准里的「与」在计量上
 * 是一条,在事实上是两条。D1 的「测试✓」挂了很久,而它验收标准的后半句
 * ——「记忆查询中视为同一人」—— 从来没实现过,那半句是 P4 的承重结构（ADR-24）。
 */
const testedCriteria = new Set(claims.criteria ?? [])

const mutatedIds = new Set<string>(mutCfg.mutations.map((m: any) => m.req))

/**
 * 交点上的测试。
 *
 * 这是本文件原先最大的盲区:计量单位是「每条需求有没有测试」,于是**交点上的
 * 测试不属于任何一条需求 —— 写了不加分,不写不扣分**。D4 × P4 那个红线失效
 * 就是这么活下来的:两条需求各自都有测试、各自都通过,而它们的交点没人看
 * (ADR-15)。计量决定行为,所以交点必须在计量里有位置。
 *
 * 登记表里声明的每个交点,都要在测试里有一句 `tension('A', 'B')` 认领它 ——
 * 而且那句必须**真的执行到**,注释掉的不算(ADR-20)。
 */
const testedTensions = new Set(claims.tensions.flatMap(t => {
  const [a, b] = t.split('|')
  return [`${a}|${b}`, `${b}|${a}`]
}))
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

  const v = requirementVerdict(r, {
    tested, mutated, exempt, impl: impl.length, refs: refs.length,
    claimedCriteria: testedCriteria, exemptIds: new Set(exemptIds.keys()),
  })
  const { flag, claimed } = v
  hard += v.hard
  gaps.push(...v.gaps)

  rows.push(`  ${flag} ${r.id.padEnd(3)} ${r.cat}  测试${tested ? '✓' : '·'} ` +
            `变异${mutated ? '✓' : exempt ? '⊘' : '·'}  ` +
            `判据 ${claimed}/${r.accept.length}  引用 ${refs.length} 处`)
}

// ---- 1b. 每个交点是否有测试认领 ----
const redlines = new Set(reqs.filter(r => r.cat === REDLINE_CAT).map(r => r.id))
const tensionRows: string[] = []
for (const r of reqs) {
  for (const t of r.tension ?? []) {
    const covered = testedTensions.has(`${r.id}|${t.with}`)
    // 裁定在 spec-rule.ts：交点里有红线就继承红线的第 2 条硬要求 ——
    // 必须有测试。两条非红线的交点是缺口,不是硬失败。
    const critical = tensionCritical(r.id, t.with, redlines)
    const verdict = tensionVerdict(covered, critical)
    hard += verdict.hard
    if (!covered) {
      gaps.push(`${r.id} × ${t.with} 的交点没有测试认领` +
                `${critical ? '（含红线，必须有）' : ''}`)
    }
    tensionRows.push(`  ${verdict.flag} ${r.id} × ${t.with}${t.adr ? `  ${t.adr}` : '  裁决在文档'}`)
  }
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

if (tensionRows.length) {
  console.log('  需求之间的交点 —— 不属于任何一条需求，所以要单独数\n')
  console.log(tensionRows.join('\n'))
  console.log('')
}

const deprecated = all.filter(r => r.deprecated)
if (deprecated.length) {
  console.log('  已作废（编号保留，不回收复用）：')
  for (const r of deprecated) {
    console.log(`    ~~${r.id}~~ ${r.deprecated!.since}` +
                `${r.deprecated!.superseded_by ? ` → ${r.deprecated!.superseded_by}` : ''}`)
  }
  console.log('')
}

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

const P = reqs.filter(r => r.cat === REDLINE_CAT)
console.log(`\n  红线 ${P.length} 条 · 有测试 ${P.filter(r => testedIds.has(r.id)).length} · ` +
            `有变异 ${P.filter(r => mutatedIds.has(r.id)).length} · 显式豁免 ${P.filter(r => exemptIds.has(r.id)).length}`)
console.log(`  需求 ${reqs.length} 条 · 被测试覆盖 ${reqs.filter(r => testedIds.has(r.id)).length}` +
            `${deprecated.length ? ` · 已作废 ${deprecated.length} 条（不计入）` : ''}`)
console.log(`  检查链的判定模块 ${judgments.length} 个 · 有变异守着 ${judgments.length - naked.length}`)
console.log(`  交点 ${tensionRows.length} 处 · 有测试认领 ` +
            `${tensionRows.filter(r => r.trimStart().startsWith('✓')).length}`)
const allCrit = reqs.flatMap(r => r.accept)
const redlineCrit = reqs.filter(r => r.cat === REDLINE_CAT).flatMap(r => r.accept)
/**
 * 测试认领与显式豁免分开报 —— 豁免是显式缺口，不是测试证据。
 * 合起来报「认领 N」，一份审计的两个数（逐条与汇总）会对不上，
 * 而且把缺口装成了证据（P2.a / P3.b 没有运行时认领）。
 */
const redlineTested = redlineCrit.filter(c => testedCriteria.has(c.id)).length
const redlineExempt = redlineCrit.filter(c => exemptIds.has(c.id)).length
console.log(`  验收判据 ${allCrit.length} 条 · 有测试认领 ` +
            `${allCrit.filter(c => testedCriteria.has(c.id)).length}` +
            ` · 其中红线 ${redlineCrit.length} 条（测试认领 ${redlineTested}` +
            ` · 显式豁免 ${redlineExempt}）`)

if (hard) { console.error(`\n✗ 审计：${hard} 项硬失败`); process.exit(1) }
console.log('\n✓ 审计：红线全部有测试且被变异验证；检查链的判定模块全部有变异守着')
