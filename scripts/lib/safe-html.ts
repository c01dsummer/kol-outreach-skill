/**
 * 报告网页的默认转义（U12.e，ADR-228）。
 *
 * 用 `html` 这个带标签的模板写页面：模板里写死的那部分原样输出；`${…}` 插进去的值，
 * 除了 `SafeHtml`（由 `html` 自己拼出来的页面片段）以外，一律先转成文字再转义，
 * 所以插值处不用另写转义，忘了写也不会把取值当成标记。
 *
 * - 插值是 `undefined` 或 `null` 时**不写**：抛 `MissingValueError`，报错里带上那一处前后写死的文字，点名是哪一格
 *   （P1：缺值不悄悄写成空，也不替它编一个；需求所有者 2026-11-21 选「不出报告，点名哪一格缺了」，ADR-231）。
 *   可能缺的格，调用处自己先写明缺了显示什么（如 `x === undefined ? '未查询' : x`），再插进来。
 *   类型上插值收 `{}`（不含 undefined、null），可能缺的取值不先处理，类型检查当场红；`any` 的取值类型拦不住，靠运行时这一抛。
 *   其余值按 `String(v)` 转成文字；数组照 `String` 用逗号连，但逐项查缺值（空位也算缺），不让 `[1, undefined]` 连成 `1,`。
 * - 一串片段拼起来用 `joinHtml`，不要对数组插值：数组按文字处理，里面的片段会被转义。
 * - `SafeHtml` 只由 `html` 和 `joinHtml` 造，造出来就冻住；认片段查本模块自己的登记，仿造的对象当文字转义。
 *   挡不住的口子：把 `html` 当普通函数、手造一个字符串数组传进去（`html([s] as never)`）。这不是写错一处会碰上的，
 *   要故意绕；报告里原有的「这一处没转义」变异正是这么造的。
 */

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * 插进页面的取值缺了（undefined、null）。`where` 是那一处前后写死的文字，缺的那一格用 ▯ 标出；
 * 报告不出，入口把这句原样报给用户（退 2）。
 */
export class MissingValueError extends Error {
  constructor(readonly where: string) {
    super(`报告里这一格没有值，报告没有生成（缺的值不写成空，也不替它编一个）：${where}`)
    this.name = 'MissingValueError'
  }
}

/**
 * 本该总有的取值：缺了（undefined、null）抛 `MissingValueError`，`name` 用白话说是哪一格（如「卡片上的分层」）。
 * 类型上可选、实际由上游保证有的取值（render 自己算的人数、排过序就有的分层），插进页面前先过它。
 */
export const need = <T>(value: T | undefined | null, name: string): T => {
  if (value === undefined || value === null) throw new MissingValueError(name)
  return value
}

/**
 * 取值转成文字再转义；缺值（undefined、null，数组里任一项或空位）抛 `MissingValueError`，`where` 是报错里点名的那一格（要用时才算）。
 * 不认片段：`SafeHtml` 传进来也按 `String` 转成文字（得到 `[object Object]`）再转义 —— 要原样输出片段，插进 `html` 模板或交给 `joinHtml`。
 */
export const escapeText = (value: {}, where: string | (() => string) = '▯'): string => {
  if (value === undefined || value === null) throw new MissingValueError(typeof where === 'string' ? where : where())
  if (Array.isArray(value)) return Array.from(value as unknown[], item => escapeText(item as {}, where)).join(',')
  return String(value).replace(/[&<>"']/g, ch => ESCAPES[ch]!)
}

let make!: (text: string) => SafeHtml

/**
 * 本模块亲手造出来的片段。认片段只查这张表，不看原型：`Object.create(SafeHtml.prototype)` 再挂上
 * `html` 字段造出来的东西过得了 `instanceof`，却不在表里，照样当文字转义（U12.e「长得像片段的也照样转义」）。
 */
const made = new WeakSet<object>()

/** 已经是页面片段的 HTML：插进 `html` 模板时原样输出。只有 `html`、`joinHtml` 造得出来 */
export class SafeHtml {
  private constructor(readonly html: string) {}
  static { make = text => { const fragment = Object.freeze(new SafeHtml(text)); made.add(fragment); return fragment } }
}

const piece = (value: {}, where: () => string): string =>
  value instanceof Object && made.has(value) ? (value as SafeHtml).html : escapeText(value, where)

/** 报错里点名那一格：前一段写死文字的末尾、▯、后一段写死文字的开头，空白压成一个空格 */
const around = (before: string, after: string): string => {
  const squash = (t: string) => t.replace(/\s+/g, ' ')
  return `…${squash(before).slice(-60)}▯${squash(after).slice(0, 40)}…`
}

/** 带标签的模板：写死的部分原样，插值默认转义（`SafeHtml` 除外）；插值缺了抛 `MissingValueError` */
export function html(strings: TemplateStringsArray, ...values: readonly {}[]): SafeHtml {
  let out = strings[0]
  for (let i = 0; i < values.length; i++) out += piece(values[i], () => around(strings[i], strings[i + 1])) + strings[i + 1]
  return make(out)
}

/**
 * 把一串片段（或文字，文字照样转义）用分隔片段连起来；哪一项缺了（undefined、null、空位）抛 `MissingValueError`，
 * 报错点名「一串里的第几项（共几项）」。
 * - 不传分隔：各项直接首尾相接，中间什么都不加。
 * - 空数组：得到一个空片段（原样输出时什么也不写），不抛。
 * - 分隔不是本模块造的片段（文字，或仿造的对象）：照样当文字转义后夹在各项之间，不抛（`null` 不在此列，会抛）。
 */
export function joinHtml(items: readonly {}[], separator?: SafeHtml): SafeHtml {
  // 分隔也走 piece：只认本模块造的片段，仿造的（`meta` 一类 any 取值不用强转就能塞进来）照样当文字转义
  return make(Array.from(items, (item, i) => piece(item, () => `一串里的第 ${i + 1} 项（共 ${items.length} 项）`))
    .join(separator === undefined ? '' : piece(separator, () => '一串的分隔')))
}
