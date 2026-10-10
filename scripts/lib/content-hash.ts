/** D20.f：规范化 JSON 与内容哈希。批次 A 只有这一份实现（ADR-136 第一节第 1 条与 2026-10-10 补记）。 */
import { createHash } from 'node:crypto'

// 逐码点比较：默认 sort 比 UTF-16 码元，U+1F600 会排到 U+FF5E 前面（ADR-136 第一节第 1 条）
function byCodePoint(a: string, b: string): number {
  const x = [...a], y = [...b]
  for (let i = 0; i < x.length && i < y.length; i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!
    if (d !== 0) return d
  }
  return x.length - y.length
}

/**
 * 规范化 JSON：对象键按 Unicode 码点递归排序，数组保持原顺序，不含空白；
 * 标量照 `JSON.stringify` 的写法。返回字符串，按 UTF-8 编码后才算哈希。
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort(byCodePoint)
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** `sha256:` 加 `canonicalJson(value)` 按 UTF-8 编码后 SHA256 的 64 位小写十六进制。 */
export function contentHash(value: unknown): string {
  return 'sha256:' + createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}
