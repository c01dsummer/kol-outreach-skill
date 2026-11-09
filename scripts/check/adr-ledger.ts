#!/usr/bin/env tsx
/**
 * 决策记录的只读台账 —— 只读 `docs/adr/`，不读覆盖记录、不读需求登记表、不写任何文件。
 *
 * 为什么不就用 `npm run audit -- --debts`：审计在处理任何参数之前先读两份覆盖记录，
 * 那是跑过需求测试与自检之后才在 `.check-cache/` 里有的（不进仓库），新克隆上它以 1 退出。
 * 周回访在新克隆上跑，所以抽取另开这个入口（ADR-151 第二节第 1 条、第三节第 1 条）。
 *
 * 读哪些文件、全表怎么打，与 `audit -- --debts` 是同一份（`debt-rule.ts` 的 `adrDocs`、
 * `ledgerReport`），这里只剩打印与退出码。孤儿欠条照样以 1 退出：它在审计那边是硬失败，
 * 到了这里放过，就成了一条能绕过那道闸门的路。
 *
 * `--cites` 换成被引表（`cite-rule.ts`）：每条记录被几条别的记录引过、有没有教训栏。
 * 这个模式**恒以 0 退出** —— 被引表只报数（ADR-151 第四节第 1 条：P2 不是闸门），
 * 孤儿那个 1 不能沿用过来（ADR-151 第六节末尾「不改的两条」）。这个模式也不打台账，
 * 所以没有哪一份台账在这里被放过；孤儿照旧由不带参数的这个入口与审计判。
 */
import { citeReport, citeTable } from './cite-rule.js'
import { adrDocs, entries, ledgerReport, orphanIous } from './debt-rule.js'

const docs = adrDocs()
if (process.argv.includes('--cites')) {
  for (const line of citeReport(citeTable(docs))) console.log(line)
} else {
  const { out, err } = ledgerReport(entries(docs), orphanIous(docs))
  for (const line of out) console.log(line)
  // 设退出码、不硬退出：全表几百行接在管道上，硬退出可能把末尾那几行截掉（`selfcheck.ts` 收尾那段记着实测）
  if (err) { console.error(err); process.exitCode = 1 }
}
