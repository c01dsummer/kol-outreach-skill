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
 */
import { adrDocs, entries, ledgerReport, orphanIous } from './debt-rule.js'

const docs = adrDocs()
const { out, err } = ledgerReport(entries(docs), orphanIous(docs))
for (const line of out) console.log(line)
// 设退出码、不硬退出：全表几百行接在管道上，硬退出可能把末尾那几行截掉（`selfcheck.ts` 收尾那段记着实测）
if (err) { console.error(err); process.exitCode = 1 }
