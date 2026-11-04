#!/usr/bin/env tsx
/**
 * KOL-21 独立测试包的接线：把冻结在 `scripts/kol21-independent/` 的测试套件接到真实入口与观察器的公开调用面上，
 * 跑一遍，把冻结套件自己写的报告原样落盘（ADR-183 第 95 行 T 那一片）。
 *
 *   tsx scripts/kol21-independent-wiring.ts --work <已存在的空目录> --report <报告文件> [--only <用例号,…>]
 *
 * 冻结目录一个字节都不改（嵌入提交按 freeze-tests.sha256 核等）。这里只做冻结包 `INTEGRATION.md` 写明留给整合方的几样：
 *
 * - `facility`：观察器的四个公开调用面，`observer-run.ts` 的 `certifyIsolation`、`runObserved` 与 `observer-rule.ts` 的
 *   `zeroVerdict`、`readEvents`（ADR-70 末尾那一节，`Zero` 是修复轮 1 修订后带 side/cause 的那一版）。前三个原样传入；
 *   `readEvents` 交回的事件逐条浅拷贝一份，只为过类型（接口类型的事件不能直接当 `Record` 用），字段一个不增不减。
 * - `sortForOutput`：`scripts/lib/rows.ts` 的导出函数，同一个数组原样传进去（G5-03 要看调用后输入有没有被改）。
 * - `conditions`、`reviews`：一条都不登记、一条复核都不给。GAP 与 E 前提的补齐要需求方的答案，语义复核要独立复核方
 *   对着本跑的文本写；依赖它们的断言照冻结单落在 not-judged、review-pending，不算过、也不算红。
 * - `e2`、`e3`、`creatorCheck`：E-2、E-3 契约与公开的夹具资格检查都还没公开，不传。
 *
 * 判定一律在冻结套件里：这里不读、不改、不合并任何一条结论。pass、red、fixture、facility、review-pending、not-judged、
 * not-covered 原样留在报告里，由读报告的一侧（自检组 `kol21-independent`）分开报。
 * 退出码：报告写成就是 0，不论里面的结论是什么；用法错 2；跑到一半抛出 1。
 *
 * 它不是 `scripts/check/` 下的工具，自检把它当被测对象起（`verifier-rule.ts`「它挡不住什么」第一条说的正是这种写法：
 * 从 `scripts/check/` 外面起的东西，自己验自己的判据按被测对象放行）。不放进自检的工具表，是因为那张表是验证基础设施闭包的
 * 种子：本文件 import 的 `scripts/lib/rows.ts` 及其依赖会跟着进闭包，现有指着它们的 `by: "selfcheck"` 负片会被当成自己验自己拦下。
 * 所以指着本文件或冻结目录的变异不该写 `by: "selfcheck"` —— 那是拿被改坏的验证接线给自己判分，判据拦不住，靠写的人不写。
 */
import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { CASES, runSuite } from './kol21-independent/suite.ts'
import type { ObserverFacility, SortForOutput } from './kol21-independent/lib/contract.ts'
import { certifyIsolation, facilityFiles, runObserved } from './check/observer-run.js'
import { readEvents, zeroVerdict } from './check/observer-rule.js'
import { sortForOutput } from './lib/rows.js'
import type { Creator } from './lib/types.js'

const USAGE = '用法: tsx scripts/kol21-independent-wiring.ts --work <已存在的空目录> --report <报告文件> [--only <用例号,…>]'
const args = process.argv.slice(2)
const flags = new Map<string, string>()
for (let i = 0; i < args.length; i += 2) {
  const [k, v] = [args[i], args[i + 1]]
  if (!['--work', '--report', '--only'].includes(k) || v === undefined || v.startsWith('--') || flags.has(k)) {
    console.error(USAGE); process.exit(2)
  }
  flags.set(k, v)
}
const work = flags.get('--work'), report = flags.get('--report')
if (work === undefined || report === undefined || !isAbsolute(work) || !isAbsolute(report)) { console.error(USAGE); process.exit(2) }
if (!existsSync(work) || readdirSync(work).length > 0) { console.error(`--work ${work} 不是已存在的空目录`); process.exit(2) }
// 点了冻结单里没有的用例号就停：冻结套件按 `only` 过滤，点错的那个只会静默少跑一例
const only = flags.get('--only')?.split(',')
const unknown = only?.filter(id => !CASES.some(c => c.id === id)) ?? []
if (only !== undefined && (only.length === 0 || unknown.length)) { console.error(`--only 里有冻结单没有的用例号：${unknown.join('、') || '（空）'}`); process.exit(2) }

const facility: ObserverFacility = {
  certifyIsolation,
  runObserved,
  zeroVerdict,
  readEvents: text => { const r = readEvents(text); return { events: r.events.map(e => ({ ...e })), problems: r.problems } },
}
// 冻结包里没有 Creator 的完整声明（GAP-18），G5 按导出签名把冻结单的候选原文当参数传进来；这里只在类型上认作
// `Creator[]`，运行时就是那个数组本身。G5 在 GAP-18 登记补齐之前不调它（冻结单 G5 各例的闸门）。
//
// R 片（`claude/kol-21-u9p1-independent-claim`，ADR-183 第 96 行）要补的 U9×P1 独立认领，用的就是从这里接进去的 G5
// 排序函数层与 G6 名单层（真实 render 入口）那几例：只用冻结了的用例，不改断言、不改冻结字节。交点的认领只写在需求测试里
// （自检的入口认领记录不收交点），本片不认领 U9×P1。
const sort: SortForOutput = creators => sortForOutput(creators as Creator[])

try {
  const r = runSuite({ workRoot: work, facility, sortForOutput: sort, conditions: {}, reviews: [], only, reportPath: report })
  console.log(JSON.stringify({ cases: r.cases.length, runs: r.runs.length, verdicts: r.verdicts, items: r.items, facility: facilityFiles() }))
} catch (e) {
  console.error(`冻结套件跑到一半抛出：${e instanceof Error ? e.stack ?? e.message : String(e)}`)
  process.exitCode = 1
}
