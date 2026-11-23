/**
 * 决策记录的白话目录（`docs/adr/白话目录.md`，ADR-236）：每份决策记录一行白话，原文不动。
 *
 * 机器只管「一一对应、格都填了」：目录里每一行是 `| ADR-<编号> | 定了什么 | 对用户有什么影响 | 还欠什么 |`，
 * 编号与 `docs/adr/` 下的记录一一对应 —— 新记录没补那一行、目录里多出没有记录的一行、同一个编号写了两行，
 * 都报红；四格任何一格是空的也报红。写得白不白、说得对不对，仍由写的人和评审读（`docs/GLOSSARY.md` 那套白话规矩）。
 *
 * 引文（围栏代码块、HTML 注释）里的行不算，先过 `quotedMask`：说明里举的例子不当目录行。
 */
import { cellsOf } from './adr-fact-table.js'
import { quotedMask } from './quoted.js'

/** 目录文件名（放在 `docs/adr/` 下，不是一份决策记录，`adrSync` 读目录时跳过它） */
export const PLAIN_INDEX_FILE = '白话目录.md'
/** 表头一字不差 */
export const PLAIN_INDEX_HEAD = '| 编号 | 定了什么 | 对用户有什么影响 | 还欠什么 |'
/** 目录行：第一格是 `ADR-<编号>`（编号可带前导零，与记录文件名一致） */
const ROW_RE = /^\|\s*ADR-(\d+)\s*\|/

/**
 * 核白话目录：`nums` 是 `docs/adr/` 下现有记录的编号，`text` 是目录全文（读不到时传 `undefined`）。
 * 返回每一处问题一句话；一一对应、格都填了时返回空数组。
 */
export function plainIndexFaults(nums: readonly number[], text: string | undefined): string[] {
  if (text === undefined) return [`缺少 docs/adr/${PLAIN_INDEX_FILE}（每份决策记录一行白话，ADR-236）`]
  const faults: string[] = []
  const lines = text.split('\n')
  const mask = quotedMask(text)
  if (!lines.some((l, i) => !mask[i] && l.trim() === PLAIN_INDEX_HEAD)) {
    faults.push(`${PLAIN_INDEX_FILE} 里没有表头 \`${PLAIN_INDEX_HEAD}\``)
  }
  const seen = new Map<number, number>()
  lines.forEach((line, i) => {
    if (mask[i]) return
    const m = ROW_RE.exec(line.trim())
    if (!m) return
    const num = Number(m[1])
    const where = `${PLAIN_INDEX_FILE} 第 ${i + 1} 行（ADR-${m[1]}）`
    const first = seen.get(num)
    if (first !== undefined) faults.push(`${where} 与第 ${first} 行是同一个编号，一份记录只写一行`)
    else seen.set(num, i + 1)
    const cells = cellsOf(line)
    if (cells.length !== 4) faults.push(`${where} 应是四格（编号、定了什么、对用户有什么影响、还欠什么），这一行是 ${cells.length} 格`)
    else if (cells.slice(1).some(c => c.trim() === '')) faults.push(`${where} 有空格子：定了什么、对用户有什么影响、还欠什么三格都要写（没有就写「无」）`)
  })
  const have = new Set(nums)
  for (const n of [...have].sort((a, b) => a - b)) {
    if (!seen.has(n)) faults.push(`ADR-${n} 在 ${PLAIN_INDEX_FILE} 里没有那一行 —— 新加决策记录时同一条改动里补上`)
  }
  for (const [n, at] of [...seen].sort((a, b) => a[0] - b[0])) {
    if (!have.has(n)) faults.push(`${PLAIN_INDEX_FILE} 第 ${at} 行写的 ADR-${n} 在 docs/adr/ 下没有这份记录`)
  }
  return faults
}
