import { writeFileAtomic } from './atomic.js'

/** 含逗号/引号/换行的字段必须用引号包裹，内部引号写成两个 */
export function esc(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** UTF-8 **with BOM** —— 没有 BOM 的话 Excel/Numbers 打开中文乱码 */
export function writeCsv(path: string, headers: string[], rows: unknown[][]): void {
  const body = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  writeFileAtomic(path, '﻿' + body)
}
