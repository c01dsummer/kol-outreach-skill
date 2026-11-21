/**
 * 报告网页的默认转义（U12.d，ADR-228）。
 *
 * 用 `html` 这个带标签的模板写页面：模板里写死的那部分原样输出；`${…}` 插进去的值，
 * 除了 `SafeHtml`（由 `html` 自己拼出来的页面片段）以外，一律先转成文字再转义，
 * 所以插值处不用另写转义，忘了写也不会把取值当成标记。
 *
 * - 插值是 `undefined` 或 `null` 时写成空串；其余值按 `String(v)` 转成文字（数组照 `String` 用逗号连）。
 *   要把缺值印成 `undefined` 这几个字的地方，自己写 `String(v)`。
 * - 一串片段拼起来用 `joinHtml`，不要对数组插值：数组按文字处理，里面的片段会被转义。
 * - `SafeHtml` 只由 `html` 和 `joinHtml` 造，造出来就冻住；认片段查本模块自己的登记，仿造的对象当文字转义。
 *   挡不住的口子：把 `html` 当普通函数、手造一个字符串数组传进去（`html([s] as never)`）。这不是写错一处会碰上的，
 *   要故意绕；报告里原有的「这一处没转义」变异正是这么造的。
 */

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** 取值转成文字再转义；缺值（undefined、null）写成空串 */
export const escapeText = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]!)

let make!: (text: string) => SafeHtml

/**
 * 本模块亲手造出来的片段。认片段只查这张表，不看原型：`Object.create(SafeHtml.prototype)` 再挂上
 * `html` 字段造出来的东西过得了 `instanceof`，却不在表里，照样当文字转义（U12.d「长得像片段的也照样转义」）。
 */
const made = new WeakSet<object>()

/** 已经是页面片段的 HTML：插进 `html` 模板时原样输出。只有 `html`、`joinHtml` 造得出来 */
export class SafeHtml {
  private constructor(readonly html: string) {}
  static { make = text => { const fragment = Object.freeze(new SafeHtml(text)); made.add(fragment); return fragment } }
}

const piece = (value: unknown): string =>
  value instanceof Object && made.has(value) ? (value as SafeHtml).html : escapeText(value)

/** 带标签的模板：写死的部分原样，插值默认转义（`SafeHtml` 除外） */
export function html(strings: TemplateStringsArray, ...values: readonly unknown[]): SafeHtml {
  let out = strings[0]
  for (let i = 0; i < values.length; i++) out += piece(values[i]) + strings[i + 1]
  return make(out)
}

/** 把一串片段（或文字，文字照样转义）用分隔片段连起来 */
export function joinHtml(items: readonly unknown[], separator?: SafeHtml): SafeHtml {
  // 分隔也走 piece：只认本模块造的片段，仿造的（`meta` 一类 any 取值不用强转就能塞进来）照样当文字转义
  return make(items.map(piece).join(separator === undefined ? '' : piece(separator)))
}
