#!/usr/bin/env tsx
/**
 * 决策记录:一条一个文件,索引由本脚本生成。
 *
 * 检查:  tsx scripts/check/adr-sync.ts
 * 回写:  tsx scripts/check/adr-sync.ts --write
 * 迁移:  tsx scripts/check/adr-sync.ts --split   ← 把还装在 DECISIONS.md 里的记录拆成文件
 *
 * `--split` 是给在途分支用的:它们各自往 `DECISIONS.md` 里写了上千行,
 * 跑一次就地拆开,不必手工搬。**幂等**:没有可拆的就什么都不做。
 *
 * ⚠️ 证不了记录写得对。它保证的是编号唯一、文件名与正文一致、索引不漂移。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Adr, FILE_RE, HEAD_RE, checkAll, fileNameOf, renderIndex } from './adr-rule.js'

const DIR = 'docs/adr'
const INDEX = join(DIR, 'README.md')
const LEGACY = 'DECISIONS.md'
const BEGIN = '<!-- BEGIN:GENERATED 由 npm run adr 生成，勿手改 -->'
const END = '<!-- END:GENERATED -->'
/** 正文里的分节标题。`## ADR-NN` 是旧的整册格式，拆开后不该再出现。 */
const LEGACY_SECTION = /^## ADR-\d+ /m

// ── 迁移 ────────────────────────────────────────────────────────
if (process.argv.includes('--split')) {
  const src = existsSync(LEGACY) ? readFileSync(LEGACY, 'utf8') : ''
  const parts = src.split(/\n(?=## ADR-\d+ )/)
  const body = parts.filter(p => /^## ADR-\d+ /.test(p))
  if (!body.length) { console.log('✓ 决策记录：没有可拆的整册内容'); process.exit(0) }
  mkdirSync(DIR, { recursive: true })
  for (const sec of body) {
    const m = /^## ADR-(\d+) (.+)$/m.exec(sec)!
    const [num, title] = [Number(m[1]), m[2].trim()]
    const text = sec.split('\n').slice(1).join('\n').replace(/\n+---\s*$/, '').trim()
    writeFileSync(join(DIR, fileNameOf(num, title)), `# ADR-${m[1]} ${title}\n\n${text}\n`, 'utf8')
  }
  console.log(`✓ 决策记录：${body.length} 条已拆成文件，preamble 与转发页需手工确认`)
  process.exit(0)
}

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
if (existsSync(LEGACY) && LEGACY_SECTION.test(readFileSync(LEGACY, 'utf8'))) {
  errors.push(`${LEGACY} 里又出现了 \`## ADR-\` 分节 —— 记录写进 ${DIR}/，跑 \`npm run adr -- --split\``)
}

// ── 索引 ────────────────────────────────────────────────────────
const index = existsSync(INDEX) ? readFileSync(INDEX, 'utf8') : ''
const i = index.indexOf(BEGIN)
const j = index.indexOf(END)
if (i < 0 || j < 0) errors.push(`${INDEX} 缺少 BEGIN/END 标记`)

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
