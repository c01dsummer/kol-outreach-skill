/**
 * 新的决策记录必须带「要用到的事实，各找谁要」那一节（ADR-224，`process/3-BUILD.md` 第 8 条）。
 *
 * 机器只管「在不在、填没填」：这一节有没有、是不是正好一节，节里第一样东西是那张表（表头一字不差、
 * 至少一行、每行三格都填了），或是一句以「不列：」开头、后面写了理由的话（第 8 条本来就说不用出计划的
 * 平凡改动不用列）。「找谁要」填得对不对、「不列」的理由站不站得住，仍由写代码前的独立复核和评审读。
 *
 * 这一节的标题、表头和「不列：」是本项目定的格式，由这里校验，算第 8 条说的「写给机器读的契约」，
 * 不是从给人看的文字里推。引文（围栏代码块、HTML 注释）里的不算，先过 `quotedMask`。
 *
 * 只管编号不小于 `FACT_TABLE_FROM` 的记录：旧记录不追溯。认不出的写法一律报红（选多报那一边）。
 * 起算号以下原有的空号（`OLD_GAPS`）不许再用：新记录占一个旧空号，就绕开了「新的才查」。
 */
import { quotedMask } from './quoted.js'

/** 从这一号起的决策记录要带这一节（本条自己就是第一条） */
export const FACT_TABLE_FROM = 224

/**
 * 起算号以下的空号，本条合入时按 `docs/adr/` 目录实数抄下（编号不复用、允许空号；`adr-rule.ts` 只管撞号，不管空号）。
 * 新记录写成这些号，按「旧号」就不查了，所以这些号一律报红
 */
export const OLD_GAPS: ReadonlySet<number> = new Set([27, 29, 48, 51, 52, 53, 57, 60, 68, 160, 162, 163, 164, 165, 166, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179])

/** 节标题：二级标题，前面可带「一、」这样的序号，后面可带括号补充 */
export const FACT_HEADING_RE = /^## (?:[一二三四五六七八九十]+、)?要用到的事实，各找谁要(?:[（(].*)?\s*$/
/** 表头一字不差 */
export const FACT_TABLE_HEAD = '| 要用到的事实 | 找谁要 | 给机器读的还是给人看的 |'
const DIVIDER_RE = /^\|(?:\s*:?-+:?\s*\|){3}\s*$/
/** 不列时这一节的第一行：「不列：」后面要有理由 */
export const SKIP_PREFIX = '不列：'

/** 一行表格拆成格：按没被反斜杠转义的竖线拆，去掉首尾那两根 */
export function cellsOf(row: string): string[] {
  const t = row.trim()
  const cells: string[] = []
  let cur = ''
  for (let i = 1; i < t.length; i++) {
    const c = t[i]
    if (c === '\\' && i + 1 < t.length) { cur += c + t[i + 1]; i++; continue }
    if (c === '|') { cells.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  // 最后一根竖线之后还有字：行没有以竖线收尾，多出来的那段也算一格（会让格数不对、报红）
  if (cur.trim()) cells.push(cur.trim())
  return cells
}

/** 这份记录缺什么；空数组就是齐了。编号小于起算号的不查 */
export function factTableFaults(file: string, num: number, text: string): string[] {
  if (OLD_GAPS.has(num)) return [`${file} 用了 ${FACT_TABLE_FROM} 以下的旧空号 ${num}：新记录从 ${FACT_TABLE_FROM} 往后编，否则绕开了「要用到的事实，各找谁要」那一节的检查（ADR-224）`]
  if (num < 1) return [`${file} 的编号 ${num} 不是正数：新记录从 ${FACT_TABLE_FROM} 往后编（ADR-224）`]
  if (num < FACT_TABLE_FROM) return []
  const lines = text.split('\n')
  const mask = quotedMask(text)
  const live = (i: number) => !mask[i]
  const heads = lines.flatMap((l, i) => live(i) && FACT_HEADING_RE.test(l) ? [i] : [])
  const name = '「要用到的事实，各找谁要」'
  if (heads.length === 0) {
    // 标题写得差一点（半角逗号、少个字、级别不对）的，指给他看是哪一行
    const near = lines.flatMap((l, i) => live(i) && /^#/.test(l) && l.includes('找谁要') ? [`第 ${i + 1} 行`] : [])
    return [`${file} 缺${name}一节（ADR-${num} 不小于 ${FACT_TABLE_FROM}，要带；不写代码的写一句「${SKIP_PREFIX}理由」）`
      + (near.length ? `；${near.join('、')}像是这一节，标题要一字不差写成 \`## 要用到的事实，各找谁要\`` : '')]
  }
  if (heads.length > 1) return [`${file} 有 ${heads.length} 节${name}，只许一节`]

  // 节的范围：到下一个一级或二级标题为止
  let end = lines.length
  for (let i = heads[0] + 1; i < lines.length; i++) if (live(i) && /^#{1,2} /.test(lines[i])) { end = i; break }
  const body = lines.slice(heads[0] + 1, end).map((l, k) => ({ l, i: heads[0] + 1 + k })).filter(x => live(x.i) && x.l.trim())
  if (body.length === 0) return [`${file} 的${name}一节是空的`]

  const first = body[0].l.trim()
  if (first.startsWith(SKIP_PREFIX)) {
    return first.slice(SKIP_PREFIX.length).trim() ? [] : [`${file} 的${name}一节写了「${SKIP_PREFIX}」却没写理由`]
  }
  if (first !== FACT_TABLE_HEAD) {
    return [`${file} 的${name}一节，第一行既不是表头 \`${FACT_TABLE_HEAD}\`，也不是「${SKIP_PREFIX}理由」`]
  }
  if (!body[1] || body[1].i !== body[0].i + 1 || !DIVIDER_RE.test(body[1].l.trim())) return [`${file} 的${name}表头下面缺分隔行 \`|---|---|---|\``]

  const rows: Array<{ l: string; i: number }> = []
  const faults: string[] = []
  // 表从分隔行的下一行起，到空行或节尾为止（GFM：紧跟表格、没空行隔开的那一行，哪怕没有竖线也算表里的一行）。
  // 按原文逐行走、不跳引文：表里夹着一行被当成引文的（比如格里写了 `<!--`），不让它悄悄把表截断，报红；
  // 不以竖线开头的行本仓库不认，也报红，不当成表的结尾
  for (let i = body[1].i + 1; i < end && lines[i].trim(); i++) {
    if (!live(i)) faults.push(`${file} 第 ${i + 1} 行：${name}表里这一行被当成了引文（多半是格里写了 \`<!--\`），后面的行查不到`)
    else if (!lines[i].trim().startsWith('|')) faults.push(`${file} 第 ${i + 1} 行：${name}表里这一行没以竖线开头（紧跟表格、没空一行的正文也算表里的一行；表后要空一行再写正文）`)
    else rows.push({ l: lines[i], i })
  }
  if (rows.length === 0 && faults.length === 0) return [`${file} 的${name}表里一行都没有`]
  for (const r of rows) {
    const cells = cellsOf(r.l)
    if (cells.length !== 3) faults.push(`${file} 第 ${r.i + 1} 行：${name}表要三格，这一行 ${cells.length} 格`)
    else if (cells.some(c => !c)) faults.push(`${file} 第 ${r.i + 1} 行：${name}表有空格子`)
  }
  return faults
}
