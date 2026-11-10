import { writeFileAtomic } from './atomic.js'

/** 含逗号/引号/换行的字段必须用引号包裹，内部引号写成两个 */
export function esc(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * 以 = + - @、制表符或回车开头的文字，表格软件打开 CSV 时会当成公式算：格首先加一个 '（D5.c，ADR-161）。
 * 数不加（D5.d），纯数字的文字也不加 —— 它在表格里本来就是数，加了反而变成文字，排序求和都错（D5.e）。
 * 不放进 esc：人工反馈模板直接调 esc 写 round_id 与账号，读回时 ' 是非法字符（D5.f，ADR-161 第二节第 4 条）。
 */
const defuseFormula = (v: unknown): unknown =>
  typeof v === 'string' && /^[=+\-@\t\r]/.test(v) && !/^[+-]?\d+(\.\d+)?$/.test(v) ? `'${v}` : v
/** UTF-8 **with BOM** —— 没有 BOM 的话 Excel/Numbers 打开中文乱码 */
export function writeCsv(path: string, headers: string[], rows: unknown[][]): void {
  const body = [headers.join(','), ...rows.map(r => r.map(v => esc(defuseFormula(v))).join(','))].join('\n')
  writeFileAtomic(path, '﻿' + body)
}
