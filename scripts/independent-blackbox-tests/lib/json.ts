// KOL-21 C1 · 测试自写的 JSON 扫描与十进制规整（不 import 实现；不经 JSON.parse 取数值）
//
// J(stdout)：冻结单 pack/30-frozen-spec.md:52 —— 在文本的每一个 `{` 位置按 RFC 8259 尝试解析一个完整 JSON 值，
//   成功的每一个对象（含嵌套对象）收进集合 J；判定只看键与值，不受空白、键序、换行影响。
// FK 的 budget_usd、EXACT：:32-36 —— 从原字节取数字 token 原文，按十进制精确值比较，不经 Number（D13.a、D13.i）。

export type JNode =
  | { t: 'obj'; start: number; end: number; entries: Array<[string, JNode]> }
  | { t: 'arr'; start: number; end: number; items: JNode[] }
  | { t: 'str'; v: string }
  | { t: 'num'; raw: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }

const WS = new Set([' ', '\t', '\n', '\r'])

function skipWs(s: string, i: number): number {
  while (i < s.length && WS.has(s[i])) i++
  return i
}

/** 从 i 起解析一个 JSON 值（i 处不跳空白）；失败返回 null。 */
export function parseValueAt(s: string, i: number): { node: JNode; end: number } | null {
  const c = s[i]
  if (c === '{') {
    const start = i
    const entries: Array<[string, JNode]> = []
    i = skipWs(s, i + 1)
    if (s[i] === '}') return { node: { t: 'obj', start, end: i + 1, entries }, end: i + 1 }
    for (;;) {
      if (s[i] !== '"') return null
      const k = parseString(s, i)
      if (!k) return null
      i = skipWs(s, k.end)
      if (s[i] !== ':') return null
      i = skipWs(s, i + 1)
      const v = parseValueAt(s, i)
      if (!v) return null
      entries.push([k.v, v.node])
      i = skipWs(s, v.end)
      if (s[i] === ',') { i = skipWs(s, i + 1); continue }
      if (s[i] === '}') return { node: { t: 'obj', start, end: i + 1, entries }, end: i + 1 }
      return null
    }
  }
  if (c === '[') {
    const start = i
    const items: JNode[] = []
    i = skipWs(s, i + 1)
    if (s[i] === ']') return { node: { t: 'arr', start, end: i + 1, items }, end: i + 1 }
    for (;;) {
      const v = parseValueAt(s, i)
      if (!v) return null
      items.push(v.node)
      i = skipWs(s, v.end)
      if (s[i] === ',') { i = skipWs(s, i + 1); continue }
      if (s[i] === ']') return { node: { t: 'arr', start, end: i + 1, items }, end: i + 1 }
      return null
    }
  }
  if (c === '"') {
    const r = parseString(s, i)
    return r ? { node: { t: 'str', v: r.v }, end: r.end } : null
  }
  if (s.startsWith('true', i)) return { node: { t: 'bool', v: true }, end: i + 4 }
  if (s.startsWith('false', i)) return { node: { t: 'bool', v: false }, end: i + 5 }
  if (s.startsWith('null', i)) return { node: { t: 'null' }, end: i + 4 }
  const m = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(s.slice(i, i + 400))
  if (m && m[0].length > 0) return { node: { t: 'num', raw: m[0] }, end: i + m[0].length }
  return null
}

function parseString(s: string, i: number): { v: string; end: number } | null {
  if (s[i] !== '"') return null
  let out = ''
  i++
  while (i < s.length) {
    const ch = s[i]
    const code = ch.charCodeAt(0)
    if (ch === '"') return { v: out, end: i + 1 }
    if (code < 0x20) return null
    if (ch === '\\') {
      const e = s[i + 1]
      const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
      if (e in map) { out += map[e]; i += 2; continue }
      if (e === 'u') {
        const hex = s.slice(i + 2, i + 6)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null
        out += String.fromCharCode(parseInt(hex, 16))
        i += 6
        continue
      }
      return null
    }
    out += ch
    i++
  }
  return null
}

/** 整份文本恰为一个 JSON 值（前后只许空白）。 */
export function parseDocument(s: string): JNode | null {
  const text = s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
  const i = skipWs(text, 0)
  const r = parseValueAt(text, i)
  if (!r) return null
  return skipWs(text, r.end) === text.length ? r.node : null
}

/** J(stdout)：:52 的扫描器。按对象起点去重（嵌套对象在自己的 `{` 处也会被再次解析到）。 */
export function scanJ(text: string): JNode[] {
  const byStart = new Map<number, JNode>()
  const collect = (n: JNode): void => {
    if (n.t === 'obj') {
      if (!byStart.has(n.start)) byStart.set(n.start, n)
      for (const [, v] of n.entries) collect(v)
    } else if (n.t === 'arr') {
      for (const v of n.items) collect(v)
    }
  }
  for (let i = text.indexOf('{'); i !== -1; i = text.indexOf('{', i + 1)) {
    const r = parseValueAt(text, i)
    if (r) collect(r.node)
  }
  return [...byStart.values()].sort((a, b) => (a as { start: number }).start - (b as { start: number }).start)
}

/** 对象里键 k 的全部出现（重复键原样保留）。 */
export function getAll(n: JNode | undefined, k: string): JNode[] {
  if (!n || n.t !== 'obj') return []
  return n.entries.filter(([key]) => key === k).map(([, v]) => v)
}
/** 恰好出现一次时返回该值；缺席返回 undefined；重复返回 'dup'。 */
export function get1(n: JNode | undefined, k: string): JNode | undefined | 'dup' {
  const all = getAll(n, k)
  if (all.length === 0) return undefined
  if (all.length > 1) return 'dup'
  return all[0]
}
export function has(n: JNode | undefined, k: string): boolean {
  return getAll(n, k).length > 0
}

/** 转成普通值作深度相等比较（整数在安全整数内直接比，:33）。重复键取最后一处，并由 hasDupKeys 另报。 */
export function plain(n: JNode): unknown {
  switch (n.t) {
    case 'obj': { const o: Record<string, unknown> = {}; for (const [k, v] of n.entries) o[k] = plain(v); return o }
    case 'arr': return n.items.map(plain)
    case 'str': return n.v
    case 'num': return Number(n.raw)
    case 'bool': return n.v
    case 'null': return null
  }
}
export function hasDupKeys(n: JNode): boolean {
  if (n.t === 'obj') {
    const seen = new Set<string>()
    for (const [k, v] of n.entries) { if (seen.has(k)) return true; seen.add(k); if (hasDupKeys(v)) return true }
  } else if (n.t === 'arr') {
    for (const v of n.items) if (hasDupKeys(v)) return true
  }
  return false
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => deepEqual(x, b[i]))
  }
  if (typeof a === 'object') {
    if (Array.isArray(b)) return false
    const ka = Object.keys(a as object).sort()
    const kb = Object.keys(b as object).sort()
    if (!deepEqual(ka, kb)) return false
    return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

// ---- 十进制精确值（A.0.1 第 5、6 条，:32-36）----
export interface Dec { neg: boolean; digits: string; exp: number }

/** 数字 token（RFC 8259 写法）→ 规整的十进制（digits×10^exp，去前导零与尾随零）。不经浮点。 */
export function canonDec(raw: string): Dec | null {
  const m = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(raw)
  if (!m) return null
  const neg = m[1] === '-'
  const frac = m[3] ?? ''
  let digits = (m[2] + frac).replace(/^0+/, '')
  let exp = (m[4] ? parseInt(m[4], 10) : 0) - frac.length
  if (digits === '') return { neg: false, digits: '0', exp: 0 }
  while (digits.length > 1 && digits.endsWith('0')) { digits = digits.slice(0, -1); exp++ }
  return { neg, digits, exp }
}
export function decEq(a: string, b: string): boolean {
  const x = canonDec(a)
  const y = canonDec(b)
  return !!x && !!y && x.neg === y.neg && x.digits === y.digits && x.exp === y.exp
}
/** EXACT(x, d)：x 必须是数字 token，且与十进制文本 d 精确相等（:36）。 */
export function exact(n: JNode | undefined | 'dup', d: string): { ok: boolean; got: string } {
  if (n === undefined) return { ok: false, got: '缺席' }
  if (n === 'dup') return { ok: false, got: '重复键' }
  if (n.t !== 'num') return { ok: false, got: describe(n) }
  return { ok: decEq(n.raw, d), got: n.raw }
}
/** 微美元整数 → 美元十进制文本（只用于把手算结果写成 EXACT 的期望，例如 3 次 × 1000 µ$ → "0.003"）。 */
export function usdFromMicro(micro: number): string {
  if (!Number.isSafeInteger(micro) || micro < 0) throw new Error('usdFromMicro: 非法微美元 ' + micro)
  const s = String(micro).padStart(7, '0')
  return (s.slice(0, -6) + '.' + s.slice(-6)).replace(/^0+(?=\d)/, '')
}

export function describe(n: JNode | undefined | 'dup'): string {
  if (n === undefined) return '缺席'
  if (n === 'dup') return '重复键'
  switch (n.t) {
    case 'num': return n.raw
    case 'str': return JSON.stringify(n.v)
    case 'null': return 'null'
    case 'bool': return String(n.v)
    default: return JSON.stringify(plain(n))
  }
}
