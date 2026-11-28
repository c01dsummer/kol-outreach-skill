#!/usr/bin/env tsx
/**
 * 条件探针的入口（ADR-252，`docs/REVISIT.md`「周一」(b)）。判定全在 `condition-rule.ts`，这里只剩读参数、读文件、问 git 与打印。
 *
 *   tsx scripts/check/conditions.ts [--today <日期>] [--run <提交>]   （`npm run conditions`）
 *
 * `--conditions <文件>` 换一份登记表，只给入口测试用（`registryArg`）。
 *
 * 照登记表逐条算：第一行是几个数，之后越线、这一周要列的每条一行，最后是无从确认的每条一行。
 * `--today` 缺省是今天（北京时间），`--run` 缺省 `origin/main`。树里的文件与决策记录读工作区（回访在主干的检出上跑）。
 * 退出码：全算完 0（某条原料取不到算那一行无从确认，仍 0）；登记表核不过、原料形状不对 1；参数写错 2。只读，不写任何文件。
 */
import { RawShapeError, cliConditionGit, conditionFaults, conditionRaw, conditionReport, evaluate, pathKind, readTreeFile, registryArg } from './condition-rule.js'
import { adrDocs } from './debt-rule.js'
import { revisitLedger } from './iou-gate-rule.js'
import { beijingDate, carriedUntil, listings } from './revisit-rule.js'

const args = process.argv.slice(2)
// 写了选项没跟值（`--today` 在最后，或后面紧跟另一个选项）是参数写错，以 2 退出；没写才用缺省
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) { console.error(`${name} 后面要跟一个值`); process.exit(2) }
  return v
}
const run = opt('--run') ?? 'origin/main'
const today = opt('--today') ?? beijingDate(Date.now() / 1000)
const ms = Date.parse(`${today}T00:00:00Z`)
if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== today) {
  console.error(`--today 要写成成立的日子 YYYY-MM-DD，收到的是 ${today}`)
  process.exit(2)
}

const registry = registryArg(args)
if ('error' in registry) { console.error(registry.error); process.exit(2) }
if (registry.note !== undefined) console.error(registry.note)
const table = registry.table

const docs = adrDocs()
const faults = conditionFaults(table, docs, pathKind)
if (faults.length) {
  for (const f of faults) console.error(f)
  process.exitCode = 1
} else {
  try {
    const outcomes = evaluate(table, conditionRaw(docs, cliConditionGit(), run, readTreeFile))
    for (const l of conditionReport(outcomes, today, listings(revisitLedger(docs)), carriedUntil(docs))) console.log(l)
  } catch (e) {
    if (!(e instanceof RawShapeError)) throw e
    console.error(`原料形状不对：${e.message}`)
    process.exitCode = 1
  }
}
