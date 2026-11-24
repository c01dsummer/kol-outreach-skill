#!/usr/bin/env tsx
/**
 * 周回访「到期清单」「死亡条件轮到哪几条」与「只起草一条」三步的入口（`docs/REVISIT.md`）。判定全在 `revisit-rule.ts`，这里只剩读参数、问 git 与打印。
 *
 *   tsx scripts/check/revisit-due.ts --born [--run <提交>] < 两道门判「过」的行（`文件|行号|…`）
 *     按登记日排好打出来。
 *   tsx scripts/check/revisit-due.ts --list [--today <日期>] [--run <提交>]   （`npm run due-list`）
 *     到期清单：开着、到期或列过没判的，最老先列，最多 10 张；第一行是几个数，末行是已重挂行里认不出现行那张的行数。`--today` 缺省是今天（北京时间）。
 *   tsx scripts/check/revisit-due.ts --deaths [--today <日期>]
 *     这一周轮到的死亡条件（四周轮完一遍）：第一行是几个数，后面每行是记法与条件原文。
 *
 * `--run` 缺省 `origin/main`。欠条正文读工作区里的文件（回访在主干的检出上跑）。只读，不写任何文件。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { adrDocs } from './debt-rule.js'
import { beijingDate, bornReport, cliGit, deathRota, dueItems, dueList, listings, movesUnread } from './revisit-rule.js'

const args = process.argv.slice(2)
const opt = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
const run = opt('--run') ?? 'origin/main'

const realGit = cliGit()

// 台账里列着、工作区里却没有的文件（台账与检出不是同一份）当空文件读：名字取不到、登记日照样去问 git，不让一行把整份打断
const text = (file: string) => existsSync(file) ? readFileSync(file, 'utf8') : ''
const adr152 = () => readdirSync('docs/adr').filter(f => /^ADR-152-.*\.md$/.test(f)).map(f => readFileSync(`docs/adr/${f}`, 'utf8')).join('\n')
const today = opt('--today') ?? beijingDate(Date.now() / 1000)
// 日子写错（格式不对、2 月 30 日那种会被挪到下个月的）就停：不然轮到哪一组、到没到期都算错，却照常打出来
const ms = Date.parse(`${today}T00:00:00Z`)
if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== today) {
  console.error(`--today 要写成成立的日子 YYYY-MM-DD，收到的是 ${today}`)
  process.exit(2)
}
if (args.includes('--deaths')) {
  for (const l of deathRota(adrDocs(), today)) console.log(l)
} else if (args.includes('--list')) {
  const docs = adrDocs()
  for (const l of dueList(dueItems(realGit, run, docs), today, listings(adr152())).lines) console.log(l)
  console.log(`已重挂行里认不出现行那张的 ${movesUnread(docs)} 行：它们的接手者按自己的登记日算`)
} else if (args.includes('--born')) {
  const stdin = readFileSync(0, 'utf8')
  const rows = stdin.split('\n').filter(Boolean).map(l => { const [file, line] = l.split('|'); return { file, line: Number(line), text: text(file) } })
  for (const l of bornReport(realGit, run, rows)) console.log(l)
} else {
  console.error('用法：revisit-due.ts --list [--today <日期>] [--run <提交>]，--deaths [--today <日期>]，或 --born [--run <提交>] < 两道门「过」的行')
  process.exitCode = 2
}
