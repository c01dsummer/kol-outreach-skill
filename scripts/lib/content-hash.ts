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
 * 用显式工作栈、不靠递归：D20.f 的哈希含未列出的键，嵌多深都得算得出（ADR-136 2026-10-10 补记）。
 */
export function canonicalJson(value: unknown): string {
  const out: string[] = []
  // 每层容器一格：成员的值、对象才有的键（已按码点排好）、下一个该写第几个
  const stack: { values: unknown[]; keys?: string[]; next: number }[] = []
  let current = value
  for (;;) {
    if (Array.isArray(current)) {
      out.push('[')
      stack.push({ values: current, next: 0 })
    } else if (current !== null && typeof current === 'object') {
      const record = current as Record<string, unknown>
      const keys = Object.keys(record).sort(byCodePoint)
      out.push('{')
      stack.push({ values: keys.map(key => record[key]), keys, next: 0 })
    } else out.push(JSON.stringify(current))
    // 写完的层补上收尾括号、出栈，回到还有成员没写的那一层；栈空了就写完了
    let top = stack.at(-1)
    while (top !== undefined && top.next === top.values.length) {
      out.push(top.keys ? '}' : ']')
      stack.pop()
      top = stack.at(-1)
    }
    if (top === undefined) return out.join('')
    if (top.next > 0) out.push(',')
    if (top.keys) out.push(`${JSON.stringify(top.keys[top.next])}:`)
    current = top.values[top.next++]
  }
}

/** `sha256:` 加 `canonicalJson(value)` 按 UTF-8 编码后 SHA256 的 64 位小写十六进制。 */
export function contentHash(value: unknown): string {
  return 'sha256:' + createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}
