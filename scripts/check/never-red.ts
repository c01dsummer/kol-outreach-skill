#!/usr/bin/env tsx
/**
 * 列出从没被负片弄红过的有名字的断言（`npm run never-red`，ADR-240）。
 *
 * 读 `npm run mutate` 留下的「每条负片红过哪些断言」那份记录（`output/mutation-reds/`），
 * 对着两个验证者的清册（按语法树从源码收的那份，同 `kills` 用的），列出从没红过的那几条：
 * 没有任何负片跑到过的、跑到了却从没红过的，分开列。**只报，不拦**：列出来几条都以 0 退出；
 * 记录读不到、读不出、或者对不上这一份变异目录，以 1 退出，不出清单。
 *
 * 记录是平时的检查留下的，那一跑「点名的都红了就停」，停下的那一次后面的断言没跑到，清单会多报 ——
 * 头上照实说有几条停了。准的那份由每周不提前停的那一跑出（`.github/workflows/never-red.yml`）。
 * 判定都在 `never-red-rule.ts`；这里只读盘、打印、设退出码。不接进 `npm run check`。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { duplicateIds } from './attribution-rule.js'
import { askGit } from './git-entry.js'
import { VERIFIERS, groupOfLabel, labelsOf } from './mutate-rule.js'
import { REDS_DIR, REDS_PART_NAME, type RedsPart, mergeParts, neverRed, readRedsPart } from './never-red-rule.js'

const fail = (why: string): void => {
  console.error(`✗ 从没红过的断言：${why}`)
  process.exitCode = 1
}

const main = (): void => {
  let catalogIds: string[]
  try {
    const muts = JSON.parse(readFileSync('scripts/check/mutations.json', 'utf8')).mutations as { id: string }[]
    catalogIds = muts.map(m => m.id)
  } catch (e) {
    fail(`读不出变异目录（${e instanceof Error ? e.message : String(e)}）`)
    return
  }
  // 读变异编号的地方都先过 duplicateIds（ADR-34 第 90 行那一类）：目录里同号两条，拼记录时按编号对就分不出是哪一条
  const dup = duplicateIds(catalogIds.map(id => ({ id })))
  if (dup.length > 0) { fail(`变异目录里编号重复：${dup.join('、')}`); return }
  const names = existsSync(REDS_DIR) ? readdirSync(REDS_DIR).filter(n => REDS_PART_NAME.test(n)).sort() : []
  const parts: { name: string; part: RedsPart }[] = []
  for (const name of names) {
    let raw: unknown
    try { raw = JSON.parse(readFileSync(join(REDS_DIR, name), 'utf8')) } catch (e) {
      fail(`${name} 读不出来（${e instanceof Error ? e.message : String(e)}）`)
      return
    }
    const part = readRedsPart(raw)
    if ('fault' in part) { fail(`${name}：${part.fault}`); return }
    parts.push({ name, part })
  }
  const merged = mergeParts(parts, catalogIds)
  if ('fault' in merged) { fail(`${REDS_DIR} 里的记录用不了 —— ${merged.fault}`); return }

  console.log(`从没被负片弄红过的有名字的断言（提交 ${merged.head.slice(0, 7)}，${merged.records.length} 条负片的记录）`)
  // 清册是从工作区的源码收的；记录验的要不是这个提交，跑完之后改过的断言名字会对不上，清单照样出、但要说出来
  const now = askGit('rev-parse', 'HEAD')
  if (now !== merged.head) {
    console.log(`  ⚠ 记录验的是 ${merged.head.slice(0, 7)}，工作区现在是 ${now === null ? '（读不出）' : now.slice(0, 7)}：那之后改过名字的断言会被报成没红过`)
  }
  console.log(merged.earlyStop
    ? `  ⚠ 这份记录是照常「点名的都红了就停」跑出来的，其中 ${merged.stopped} 条停在了半路：停下之后的断言没跑到，下面可能多报。准的那份看每周不提前停的那一跑`
    : '  这份记录每一条负片都跑到了底（没开提前停），下面是准的')
  const summary: Record<string, { catalog: number; notReached: number; neverRed: number }> = {}
  for (const [by, verifier] of Object.entries(VERIFIERS)) {
    const source = readFileSync(verifier.script, 'utf8')
    const groups = groupOfLabel(source, verifier.declares)
    const labels = new Map([...labelsOf(source, verifier.declares).keys()].map(l => [l, groups.get(l)]))
    const list = neverRed(labels, merged.records.filter(r => r.by === by))
    const notReached = list.filter(x => !x.reached)
    const green = list.filter(x => x.reached)
    summary[by] = { catalog: labels.size, notReached: notReached.length, neverRed: list.length }
    console.log(`\n[${by}] 清册 ${labels.size} 条，从没红过 ${list.length} 条：没有负片跑到 ${notReached.length} 条，跑到了没红过 ${green.length} 条`)
    for (const [title, rows] of [['没有负片跑到', notReached], ['跑到了，没红过', green]] as const) {
      if (rows.length === 0) continue
      console.log(`  ${title}：`)
      for (const x of rows) console.log(`    · ${x.group === undefined ? '（不在任何一组）' : x.group} ｜ ${x.label}`)
    }
  }
  // 给每周回访读的那一行：只有数，清单本身在上面
  console.log(`\nNEVER_RED_JSON ${JSON.stringify({ schema: 'never-red/v1', head: merged.head, earlyStop: merged.earlyStop,
    stopped: merged.stopped, verifiers: summary })}`)
}

main()
