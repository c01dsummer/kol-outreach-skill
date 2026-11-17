#!/usr/bin/env tsx
/**
 * 周回访「定期清点」与「只起草一条」两步的入口（`docs/REVISIT.md`）。判定全在 `revisit-rule.ts`，这里只剩读参数、问 git 与打印。
 *
 *   tsx scripts/check/revisit-due.ts --due <截止日> [--run <提交>] < 新台账
 *     打四样：取不到登记日的条数、满四周的条数、没列过的条数，再是没列过的前 5 行。
 *   tsx scripts/check/revisit-due.ts --born [--run <提交>] < 两道门判「过」的行（`文件|行号|…`）
 *     按登记日排好打出来。
 *
 * `--run` 缺省 `origin/main`。欠条正文读工作区里的文件（回访在主干的检出上跑）。只读，不写任何文件。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { bornReport, cliGit, dueReport, dueRow, listedItems, periodicEntries } from './revisit-rule.js'

const args = process.argv.slice(2)
const opt = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
const run = opt('--run') ?? 'origin/main'

const realGit = cliGit()

// 台账里列着、工作区里却没有的文件（台账与检出不是同一份）当空文件读：名字取不到、登记日照样去问 git，不让一行把整份打断
const text = (file: string) => existsSync(file) ? readFileSync(file, 'utf8') : ''
const stdin = readFileSync(0, 'utf8')
const cut = opt('--due')
if (cut !== undefined) {
  const adr152 = readdirSync('docs/adr').filter(f => /^ADR-152-.*\.md$/.test(f)).map(f => readFileSync(`docs/adr/${f}`, 'utf8')).join('\n')
  const rows = periodicEntries(stdin).map(e => dueRow(realGit, run, e.file, e.line, text(e.file)))
  for (const l of dueReport(rows, cut, listedItems(adr152))) console.log(l)
} else if (args.includes('--born')) {
  const rows = stdin.split('\n').filter(Boolean).map(l => { const [file, line] = l.split('|'); return { file, line: Number(line), text: text(file) } })
  for (const l of bornReport(realGit, run, rows)) console.log(l)
} else {
  console.error('用法：revisit-due.ts --due <截止日> [--run <提交>] < 新台账，或 --born [--run <提交>] < 两道门「过」的行')
  process.exitCode = 2
}
