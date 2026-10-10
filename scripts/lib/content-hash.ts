/** D20.f：规范化 JSON 与内容哈希。批次 A 只有这一份实现（ADR-136 第一节第 1 条与 2026-10-10 补记）。 */

/**
 * 规范化 JSON：对象键按 Unicode 码点递归排序，数组保持原顺序，不含空白；
 * 标量照 `JSON.stringify` 的写法。返回字符串，按 UTF-8 编码后才算哈希。
 */
export function canonicalJson(value: unknown): string {
  void value
  throw new Error('尚未实现')
}

/** `sha256:` 加 `canonicalJson(value)` 按 UTF-8 编码后 SHA256 的 64 位小写十六进制。 */
export function contentHash(value: unknown): string {
  void value
  throw new Error('尚未实现')
}
