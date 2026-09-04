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
import { JUDGMENT_EXEMPT, deprecatedBlock, judgmentModules, ledger, unguarded } from './audit-rule.js'
import {
  CLAIMS_PATH, SOURCE_DIR, claimsFresh, claimsReadFault, claimsWellFormed, fingerprint, sourceFiles,
  type Claims,
} from './claims.js'
import { REDLINE_CAT, requirementVerdict, type Req } from './spec-rule.js'
const spec = JSON.parse(readFileSync('docs/requirements.json', 'utf8'))
/**
 * 分区这件事本身是判定,在 `audit-rule.ts` 里,被变异守着。
 *
 * 本文件原先自带一份 `interface Req`,`accept` 写成 `string` —— 那是判据拆分
 * 之前的形状,登记表早就改成了一组判据。一份没人用得上的、并且说错了的类型,
 * 正好也遮住了 `deprecated` 这个字段的存在。改成用 spec-rule 那一份。
 */
const { live: reqs, deprecated } = ledger(spec.requirements as Req[])
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
 * 原先按源码正则找 `suite('X')` 与 `covered.add('X')`，于是**注释掉的认领照样算数** ——
 * 把测试删掉、认领留在注释里，审计照样报「有测试」。这个文件下面那段关于
 * `includes(base)` 的注释记的就是同一个坑（ADR-20）。记录带着整棵 `scripts/`
 * 树的指纹，对不上就是过期的，不算数。
 */
let raw: unknown
try {
  raw = JSON.parse(readFileSync(CLAIMS_PATH, 'utf8'))
} catch (e) {
  // 读不出来分三种，说法也分三种 —— 「先跑 npm test」只对头一种成立。
  // 权限不对、路径底下变成了目录、磁盘满，重跑一遍照样写不进同一个地方。
  const fault = claimsReadFault(e)
  if (fault === 'unreadable') {
    console.error(`✗ 读不了测试的覆盖记录 ${CLAIMS_PATH}\n`)
    console.error(`  ${e}`)
    console.error('  这不是「没跑过测试」—— 重跑一遍也写不进同一个路径。')
    console.error('  先看这个路径本身：权限、它是不是变成了目录、磁盘还有没有地方。')
  } else if (fault === 'unparsable') {
    console.error(`✗ 覆盖记录不是合法 JSON ${CLAIMS_PATH}\n`)
    console.error(`  ${e}`)
    console.error('  先跑 `npm test` 重写一份。')
  } else {
    console.error(`✗ 还没有测试的覆盖记录 ${CLAIMS_PATH}\n`)
    console.error('  审计回答不了「有没有测试」—— 那是测试跑过之后才存在的事实。')
    console.error('  先跑 `npm test`（`npm run check` 会按顺序跑）。')
  }
  process.exit(1)
}
// 形状不对的记录当**没有**记录办，不当成「这些东西没测过」——
// 后者会报出一串根本不存在的缺口，把人支到错的地方去修。
if (!claimsWellFormed(raw)) {
  console.error(`✗ 覆盖记录的形状不对 ${CLAIMS_PATH}\n`)
  console.error('  缺字段、字段不是数组、数组里混进非字符串 —— 都不能当证据。')
  console.error('  先跑 `npm test` 重写一份。')
  process.exit(1)
}
const claims: Claims = raw
const selfHash = fingerprint(sourceFiles())
if (!claimsFresh(claims.source_hash, selfHash)) {
  console.error(`✗ 覆盖记录是旧的：${SOURCE_DIR}/ 下有改动，但测试没重跑\n`)
  console.error(`  记录里是 ${claims.source_hash}，实际 ${selfHash}`)
  console.error('  先跑 `npm test`。')
  process.exit(1)
}
const testedIds = new Set(claims.covered)
/**
 * 判据级的覆盖。
 *
 * 「每条需求有没有测试」这个计量单位**比事实粗**：验收标准里的「与」在计量上
 * 是一条，在事实上是两条。P5 的「测试✓」挂了很久，而它后来拆出来的 P5.h
 * ——「未配置增强层时 meta.json 的 enriched 必须为 false」—— 是另一条独立会坏的
 * 判定，粗计量看不见它（ADR-24）。
 */
const testedCriteria = new Set(claims.criteria)

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

  // 裁定在 spec-rule.ts：留在这个入口里，没有任何一条测试够得着它（ADR-13 的老处境）。
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

const deadLines = deprecatedBlock(deprecated)
if (deadLines.length) {
  console.log('  已作废（编号保留，不回收复用）：')
  for (const line of deadLines) console.log(`    ${line}`)
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
const allCrit = reqs.flatMap(r => r.accept)
const redlineCrit = reqs.filter(r => r.cat === REDLINE_CAT).flatMap(r => r.accept)
/**
 * 测试认领与显式豁免分开报 —— 豁免是显式缺口，不是测试证据。
 * 合起来报「认领 N」，一份审计的两个数（逐条与汇总）会对不上，
 * 而且把缺口装成了证据（P2.a / P3.b 没有运行时认领）。
 */
console.log(`  验收判据 ${allCrit.length} 条 · 有测试认领 ` +
            `${allCrit.filter(c => testedCriteria.has(c.id)).length}` +
            ` · 其中红线 ${redlineCrit.length} 条（测试认领 ` +
            `${redlineCrit.filter(c => testedCriteria.has(c.id)).length}` +
            ` · 显式豁免 ${redlineCrit.filter(c => exemptIds.has(c.id)).length}）`)

if (hard) { console.error(`\n✗ 审计：${hard} 项硬失败`); process.exit(1) }
console.log('\n✓ 审计：红线全部有测试且被变异验证；检查链的判定模块全部有变异守着')
