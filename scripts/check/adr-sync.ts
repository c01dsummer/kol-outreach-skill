#!/usr/bin/env tsx
/**
 * 决策记录:一条一个文件,索引由本脚本生成。
 *
 * 检查:  tsx scripts/check/adr-sync.ts
 * 回写:  tsx scripts/check/adr-sync.ts --write
 *
 * ⚠️ 证不了记录写得对。它保证的是编号唯一、文件名与正文一致、索引不漂移。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Adr, FILE_RE, HEAD_RE, checkAll, markerFault,
  renderIndex,
} from './adr-rule.js'
import { quotedMask } from './quoted.js'

const DIR = 'docs/adr'
const INDEX = join(DIR, 'README.md')
const LEGACY = 'DECISIONS.md'
const BEGIN = '<!-- BEGIN:GENERATED 由 npm run adr 生成，勿手改 -->'
const END = '<!-- END:GENERATED -->'
/**
 * 整册里的记录标题。**两级都认**:`##` 是旧整册的写法,`#` 是拆开后单文件的写法。
 *
 * 只认 `##` 的话,一条照**新**格式误写进转发页的记录会溜过去 —— 它既不在
 * `docs/adr/`,也不在索引里,而检查是绿的。
 */
const RECORD_HEADING = /^#{1,2}\s+ADR-(\d+)\s+(.+?)\s*$/

// ── 读 ──────────────────────────────────────────────────────────
if (!existsSync(DIR)) { console.error(`✗ 决策记录：缺少 ${DIR}/`); process.exit(1) }

const errors: string[] = []
const adrs: Adr[] = []
for (const file of readdirSync(DIR).sort()) {
  if (file === 'README.md') continue
  const m = FILE_RE.exec(file)
  if (!m) { errors.push(`${file} 文件名不合格式，应为 ADR-<编号>-<标题>.md`); continue }
  const first = readFileSync(join(DIR, file), 'utf8').split('\n')[0]
  const h = HEAD_RE.exec(first)
  if (!h) { errors.push(`${file} 第一行不是 \`# ADR-<编号> <标题>\``); continue }
  adrs.push({ file, num: Number(h[1]), title: h[2] })
}
errors.push(...checkAll(adrs))

/** 拆开之后 `DECISIONS.md` 只做转发。写回整册就是把冲突面又装回去。 */
if (existsSync(LEGACY)) {
  const src = readFileSync(LEGACY, 'utf8')
  const mask = quotedMask(src)
  // 引文里的示例不算 —— 转发页本来就要举例说明记录长什么样
  const found = src.split('\n').some((l, i) => !mask[i] && RECORD_HEADING.test(l))
  if (found) {
    errors.push(`${LEGACY} 里又出现了记录标题(\`# ADR-\` 或 \`## ADR-\`)`
      + ` —— 记录写进 ${DIR}/，一条一个文件`)
  }
}

// ── 索引 ────────────────────────────────────────────────────────
const index = existsSync(INDEX) ? readFileSync(INDEX, 'utf8') : ''
const i = index.indexOf(BEGIN)
const j = index.indexOf(END)
const FAULT: Record<'missing' | 'reversed' | 'duplicate', string> = {
  missing: '缺少 BEGIN/END 标记',
  reversed: '的 END 标记在 BEGIN 之前 —— 手工调回来再跑 `--write`',
  duplicate: '的 BEGIN/END 标记不止一对 —— 手工只留一对再跑 `--write`',
}
const fault = markerFault(index, BEGIN, END)
if (fault) errors.push(`${INDEX} ${FAULT[fault]}`)

if (errors.length) {
  console.error(`✗ 决策记录：${errors.length} 项\n`)
  for (const e of errors) console.error(`  · ${e}`)
  process.exit(1)
}

const want = `${BEGIN}\n\n${renderIndex(adrs)}${END}`
if (process.argv.includes('--write')) {
  writeFileSync(INDEX, index.slice(0, i) + want + index.slice(j + END.length), 'utf8')
  console.log('✓ 决策记录：索引已回写')
  process.exit(0)
}
if (index.slice(i, j + END.length) !== want) {
  console.error(`✗ 决策记录：${INDEX} 的索引与目录不一致`)
  console.error('  跑 `npm run adr -- --write` 回写')
  process.exit(1)
}

const nums = adrs.map(a => a.num).sort((a, b) => a - b)
console.log(`✓ 决策记录：${adrs.length} 条，编号 ${nums[0]}–${nums[nums.length - 1]}，索引一致`)
