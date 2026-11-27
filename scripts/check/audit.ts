#!/usr/bin/env tsx
/**
 * 链路审计 —— 回答**完成度**，不回答「功能做完了没有」。
 *
 * 「功能做完了」是自评，审计是他评。
 *
 * 注意：报出来的缺口不要急着消灭。合理的缺口（需要真实 API、属于人工约定）
 * 应当显式留在报告里 —— 一份没有任何待办的审计报告，通常意味着标准被调低了。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { JUDGMENT_EXEMPT, auditBook, deprecatedBlock, judgmentModules, ledger, type AuditSources } from './audit-rule.js'
import {
  CLAIMS_PATH, ENTRY_CLAIMS_PATH, claimInputs, claimsFresh, claimsReadFault, claimsWellFormed,
  fingerprint,
  type Claims,
} from './claims.js'
import { citeSummary, citeTable } from './cite-rule.js'
import { ADR_DIR, adrDocs, iouNameFaults, ledgerGaps, ledgerReport, ledgerStatus, ledgerSummary, orphanIous } from './debt-rule.js'
import { MUTATION_CATALOG, catalogFaultText, readCatalog } from './catalog-rule.js'
import {
  REDLINE_CAT, criteriaCell, mutationCell, requirementVerdict, tensionEvidence, tensionVerdict,
  type Req, type Tension,
} from './spec-rule.js'
const spec = JSON.parse(readFileSync('docs/requirements.json', 'utf8'))
/**
 * 分区这件事本身是判定,在 `audit-rule.ts` 里,被变异守着。
 *
 * 本文件原先自带一份 `interface Req`,`accept` 写成 `string` —— 那是判据拆分
 * 之前的形状,登记表早就改成了一组判据。一份没人用得上的、并且说错了的类型,
 * 正好也遮住了 `deprecated` 这个字段的存在。改成用 spec-rule 那一份。
 */
const { live: reqs, deprecated } = ledger(spec.requirements as Req[])
// 读变异目录只经读取函数（ADR-242）：读不出、形状不对、编号重复都不往下审。抛出去、不硬退出 ——
// 这时还一行都没打，抛出的那句就是全部输出，以 1 退出（原先 JSON 坏了也是这样抛出去的）
const catalogRead = readCatalog(existsSync(MUTATION_CATALOG) ? readFileSync(MUTATION_CATALOG, 'utf8') : undefined)
if (!catalogRead.ok) throw new Error(`审计：${catalogFaultText(catalogRead.fault)}`)

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
 *
 * 目录常量在 `debt-rule.ts`：欠条台账从同一个目录读，只读入口 `adr-ledger.ts` 也是。
 */
const sources = [...walk('scripts'), ...walk('docs', '.md'), ...walk('skill', '.md')]
  .filter(f => !f.startsWith(ADR_DIR))
const corpus = new Map<string, string>()
for (const f of sources) corpus.set(f, readFileSync(f, 'utf8'))

/*
 * 「有没有测试」从**运行时记录**读，不从源码里搜。
 *
 * 原先按源码正则找 `suite('X')` 与 `covered.add('X')`，于是**注释掉的认领照样算数** ——
 * 把测试删掉、认领留在注释里，审计照样报「有测试」。这个文件下面那段关于
 * `includes(base)` 的注释记的就是同一个坑（ADR-20）。记录带着整个仓库的指纹
 *（`claimInputs` 那份清单：代码、Skill 说明、需求表都在里面，ADR-233），对不上就是过期的，不算数。
 */
/** 整个仓库的指纹,算一次给两份记录用 —— 走一遍、读一遍不便宜。 */
const selfHash = (() => {
  try { return fingerprint(claimInputs()) } catch (e) {
    // 问不到 git 就说问不到，不退回只算一部分（ADR-233）：没有指纹，两份记录新不新鲜都答不了
    console.error('✗ 算不出仓库的指纹，判断不了覆盖记录新不新鲜\n')
    console.error(`  ${(e as Error).message}`)
    console.error('  审计要在 git 仓库的顶层跑（指纹算的是 git 列出的全部文件）。')
    process.exit(1)
  }
})()

/**
 * 读一份覆盖记录,四道闸都过了才交回来。两份记录共用这一段 —— 各写一份的话,
 * 改了这边不改那边的症状是「有一份记录的坏法没人说得清」,而那正是这四种说法要防的。
 *
 * 哪一份、重跑哪条命令,由调用方给:路径进消息,命令进「先跑 …」那句。
 */
function readClaims(path: string, rerun: string): Claims {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    // 读不出来分三种，说法也分三种 —— 「先跑一遍」只对头一种成立。
    // 权限不对、路径底下变成了目录、磁盘满，重跑一遍照样写不进同一个地方。
    const fault = claimsReadFault(e)
    if (fault === 'unreadable') {
      console.error(`✗ 读不了覆盖记录 ${path}\n`)
      console.error(`  ${e}`)
      console.error('  这不是「没跑过」—— 重跑一遍也写不进同一个路径。')
      console.error('  先看这个路径本身：权限、它是不是变成了目录、磁盘还有没有地方。')
    } else if (fault === 'unparsable') {
      console.error(`✗ 覆盖记录不是合法 JSON ${path}\n`)
      console.error(`  ${e}`)
      console.error(`  先跑 \`${rerun}\` 重写一份。`)
    } else {
      console.error(`✗ 还没有覆盖记录 ${path}\n`)
      console.error('  审计回答不了这一半有没有跑过 —— 那是跑过之后才存在的事实。')
      console.error(`  先跑 \`${rerun}\`（\`npm run check\` 会按顺序跑）。`)
    }
    process.exit(1)
  }
  // 形状不对的记录当**没有**记录办，不当成「这些东西没测过」——
  // 后者会报出一串根本不存在的缺口，把人支到错的地方去修。
  if (!claimsWellFormed(raw)) {
    console.error(`✗ 覆盖记录的形状不对 ${path}\n`)
    console.error('  缺字段、字段不是数组、数组里混进非字符串 —— 都不能当证据。')
    console.error(`  先跑 \`${rerun}\` 重写一份。`)
    process.exit(1)
  }
  if (!claimsFresh(raw.source_hash, selfHash)) {
    console.error(`✗ 覆盖记录是旧的：仓库里有文件改过（代码、CI 工作流、Skill 说明、需求表都算），但没重跑 ${path}\n`)
    console.error(`  记录里是 ${raw.source_hash}，实际 ${selfHash}`)
    console.error(`  先跑 \`${rerun}\`。`)
    process.exit(1)
  }
  return raw
}

const claims: Claims = readClaims(CLAIMS_PATH, 'npm test')
/**
 * 判据级的覆盖。
 *
 * 「每条需求有没有测试」这个计量单位**比事实粗**：验收标准里的「与」在计量上
 * 是一条，在事实上是两条。P5 的「测试✓」挂了很久，而它后来拆出来的 P5.h
 * ——「未配置增强层时 meta.json 的 enriched 必须为 false」—— 是另一条独立会坏的
 * 判定，粗计量看不见它（ADR-24）。
 */
/**
 * **入口认领**:自检端到端跑过的那几条判据,单独一份记录(`claims.ts` 记着为什么不是
 * 同一份里多一栏)。四道闸与单元那份逐字相同 —— 读不出、不是合法 JSON、形状不对、
 * 指纹过期,四种各有各的说法,一律 `exit 1` 而不是当成「这些判据没测过」。
 *
 * 它也是必需的:检查链里自检排在审计前面,缺这份记录说明自检没跑或者没跑完,
 * 那时审计回答不了「入口那一半有没有跑过」—— 说「没有认领」就是替它编了个答案。
 */
const entryClaims = readClaims(ENTRY_CLAIMS_PATH, 'npm run selfcheck')
/** 真正认领过的交点 —— 编号由 `tensionKey` 出，写认领的那一头用的是同一个函数 */
const claimedTensions = new Set(claims.tensions)

/*
 * 从原料到各份名单（哪些需求有测试、哪些判据有负片、哪些豁免……）都在 `audit-rule.ts` 的
 * `auditBook` 里：原先由这里挑，挑错了（比如交个空数组）判定那边一个字也看不见 ——
 * ADR-70 历史文件「入口把什么喂给判定，仍然没人守着」那张欠条。这里只把读到的原样交进去。
 */
// 每条的字段形状由读取函数只查了编号，其余照旧按目录的约定读（原先这里写的是 any）
const catalog = catalogRead as unknown as Pick<AuditSources, 'mutations' | 'exemptions'>
const book = auditBook({
  mutations: catalog.mutations, exemptions: catalog.exemptions,
  covered: claims.covered, criteria: claims.criteria, entryCriteria: entryClaims.criteria, corpus,
})

const rows: string[] = []
const gaps: string[] = []
let hard = 0

// ---- 1. 每条需求是否在下游被引用 ----
for (const r of reqs) {
  // 裁定在 spec-rule.ts：留在这个入口里，没有任何一条测试够得着它（ADR-13 的老处境）。
  // 证据怎么拼在 audit-rule.ts 的 auditBook（架构文档那条引用不算落到实处，也在那里）
  const e = book.evidence(r)
  const v = requirementVerdict(r, e)
  const { flag, claimed, exempted } = v
  hard += v.hard
  gaps.push(...v.gaps)

  rows.push(`  ${flag} ${r.id.padEnd(3)} ${r.cat}  测试${e.tested ? '✓' : '·'} ` +
            `${mutationCell(e.mutated, e.exempt)}  ` +
            `${criteriaCell(claimed, v.mutatedCrit, exempted, r.accept.length)}  ` +
            `引用 ${e.refs} 处`)
}

// ---- 2. （撤了）可执行文件是否都被执行过 ----
// 原先这里按 `selfcheck.ts` 的源码里有没有那个文件名的调用写法，判一个入口「被自检执行过」——
// 那是读源码去猜跑没跑。自检自己在跑的时候记下了真走到的每个脚本，跑完对着 `scripts/` 下
// 全部带 shebang 的文件找孤儿，同一个问题它是跑出来的答案，范围还更大；这一节只是它的弱副本，
// 撤掉（ADR-251）。节号留着不挪，别处按「第 3 节」「第 4 节」引的仍对得上。

// ---- 3. 检查链自己的判定模块，是否都有变异守着 ----
/**
 * 红线那一段查的是「产品的需求有没有被证明过」；这一段查的是「闸门自己有没有被证明过」。
 * 判据在 `audit-rule.ts`：scripts/check/ 下不带 shebang 的文件都是判定，每个都得有变异指向它。
 * 这不是待办（`·`），是硬失败 —— 一道没被证明过的闸门，和红线没变异是同一级的事。
 */
const judgments = judgmentModules(walk('scripts/check').map(f =>
  ({ path: f, entry: readFileSync(f, 'utf8').startsWith('#!') })))
const naked = book.naked(judgments)
for (const f of naked) {
  hard++
  gaps.push(`${f} 是判定模块但没有变异守着 —— 它的测试没被证明过会红（process/4-VERIFY.md 的第三拍）`)
}

// ---- 4. 需求之间的交点，裁决有没有被证明过 ----
/**
 * 交点的裁决**跨着两条需求**，不属于任何一条 —— 所以两条需求各自的验收判据
 * 谁也不会验它：登记表上写着「撞上时以 P4 为准」，代码里可以完全不是这么做的，
 * 而两边的判据全绿。交点里有红线的，没有测试认领就是硬失败（ADR-17）。
 *
 * 裁定在 `spec-rule.ts`，和上面那两节同一个理由：留在这个入口里就没有测试够得着。
 */
const redlineIds = new Set(reqs.filter(r => r.cat === REDLINE_CAT).map(r => r.id))
/** 逐条计量与末尾汇总走同一份证据 —— 两处各配一次的话，一份审计的两个数会对不上 */
const evidenceFor = (from: string, t: Tension) =>
  tensionEvidence(from, t, claimedTensions, redlineIds)
const tensionRows: string[] = []
for (const r of reqs) {
  for (const t of r.tension ?? []) {
    const v = tensionVerdict(r.id, t, evidenceFor(r.id, t))
    hard += v.hard
    gaps.push(...v.gaps)
    tensionRows.push(`  ${v.flag} ${r.id} × ${t.with}  裁决记在 ${t.adr ?? '裁决正文（无 ADR）'}`)
  }
}

// ---- 5. SPEC 与 json 一致性由 spec-sync 保证，这里只提示 ----

// ---- 6. 欠条台账：三套「什么时候回来」的写法，抽成一份清单 ----
/**
 * 这一节**读人写的状态行，不判条件** —— 哪张开着、哪张已还，照指着它的那一行状态行报；
 * 条件成没成立、这次改动踩到了谁，它不说。撤掉匹配那一半的理由在 ADR-86：读懂条件是会随模型变强的那一侧，正则不是。
 *
 * 决策记录不在 `sources` 里（上面 `ADR_DIR` 那段说了为什么），所以单独读一遍 ——
 * 读哪些、全表怎么打，与只读入口 `adr-ledger.ts` 是同一份（`debt-rule.ts` 的 `adrDocs`、`ledgerReport`）。
 */
const adrs = adrDocs()
const debts = ledgerStatus(adrs)
/** 硬失败先判,再看要不要只打清单 —— 反过来的话 `--debts` 这条路把闸门跳过去了 */
const orphans = orphanIous(adrs)
const badNames = iouNameFaults(adrs)
// 孤儿与短名字有错各一张一行、每行一次硬失败；行怎么写在 `debt-rule.ts` 的 `ledgerGaps`，需求测试够得着
const ledgerHard = ledgerGaps(orphans, badNames)
hard += ledgerHard.length
gaps.push(...ledgerHard)
if (process.argv.includes('--debts')) {
  const { out, err } = ledgerReport(debts, orphans, badNames)
  // 等写完再退。全表一百多 KB，接在管道上时打完就硬退出，还在排队的那一截会被丢掉 ——
  // 实测截到约 60 KB、汇总行没了、退出码照样是 0（独立复核，ADR-151 历史文件的第六节）
  const flushed = (s: NodeJS.WriteStream, text: string) => new Promise<void>(done => s.write(text, () => done()))
  await flushed(process.stdout, out.map(line => `${line}\n`).join(''))
  if (err) await flushed(process.stderr, `${err}\n`)
  process.exit(err ? 1 : 0)
}

console.log('\n链路审计\n')
console.log(rows.join('\n'))
console.log(`\n  图例：✓ 完整  ⊘ 显式豁免  · 缺口  ✗ 硬失败\n`)

if (tensionRows.length) {
  console.log('  需求之间的交点（不属于任何一条，所以单独列）：')
  console.log(tensionRows.join('\n'))
  console.log('')
}

const deadLines = deprecatedBlock(deprecated)
if (deadLines.length) {
  console.log('  已作废（编号保留，不回收复用）：')
  for (const line of deadLines) console.log(`    ${line}`)
  console.log('')
}

// 说法与 `mutate` 那两份报告出自同一处判定（`exemptionLead`）—— 三处各写一份的话，
// 一条判据有了负片之后，改了两处忘了第三处的症状是「同一件事，两份报告说两样」（#91）。
// 这一行怎么拼、拿哪份变异表去问，都在 auditBook 里
for (const line of book.exemptionLines()) console.log(`  ${line}`)
for (const [f, why] of Object.entries(JUDGMENT_EXEMPT)) {
  console.log(`  ⊘ ${f} 不算判定模块：${why}`)
}

if (gaps.length) {
  console.log(`\n  待办 ${gaps.length} 项：`)
  for (const g of gaps) console.log(`    · ${g}`)
}

console.log(`\n  ${book.redlineLine(reqs)}`)
console.log(`  ${book.requirementLine(reqs, deprecated.length)}`)
console.log(`  检查链的判定模块 ${judgments.length} 个 · 有变异守着 ${judgments.length - naked.length}`)
const tensions = reqs.flatMap(r => (r.tension ?? []).map(t => ({ from: r.id, t })))
console.log(`  需求之间的交点 ${tensions.length} 个 · 有测试认领 ` +
            `${tensions.filter(({ from, t }) => evidenceFor(from, t).claimed).length}` +
            ` · 其中有红线的 ${tensions.filter(({ from, t }) =>
              evidenceFor(from, t).redline).length}`)
const allCrit = reqs.flatMap(r => r.accept)
const redlineCrit = reqs.filter(r => r.cat === REDLINE_CAT).flatMap(r => r.accept)
// 三个名单怎么数、分几栏报，都是判定，在 `audit-rule.ts` 里（第一轮评审指出）
console.log(`  ${book.coverageLine(allCrit, redlineCrit)}`)
console.log(`  ${ledgerSummary(debts)}`)
console.log('    条件认三种写法、状态行认四种两种指法，别的形状不在账上 · 全表：`npm run audit -- --debts`')
// 被引表只多这一行分布（ADR-151 第一节 P2、第三节第 1 条）；全表挂在只读入口上，新克隆上也跑得起来
console.log(`  ${citeSummary(citeTable(adrs))} · 全表：\`npm run adr-ledger -- --cites\``)

if (hard) { console.error(`\n✗ 审计：${hard} 项硬失败`); process.exit(1) }
// 「有测试认领」→「有认领」：入口认领算数之后，未豁免的红线判据里可以有几条是
// 只被自检端到端跑过的，那句话再说「全部有测试认领」就是假的（#104 第一轮评审指出）。
// 交点那一半仍是「测试认领」—— 自检不认领交点，那一栏恒空（`claims.ts` 记着）。
console.log('\n✓ 审计：红线需求全部有测试且被变异验证；未豁免的红线判据全部有认领（测试或自检）；' +
            '只由自检认领的判据都有一条 by: "selfcheck" 的负片；' +
            '有红线的交点全部有测试认领；检查链的判定模块全部有变异守着')
