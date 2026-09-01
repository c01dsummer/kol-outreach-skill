/**
 * 引文遮罩 —— 一段 Markdown 里,哪些行是**在演示语法**而不是在使用语法。
 *
 * **凡是要按结构解析 Markdown 的地方,都要先过这一道。** 两处用它:
 *
 * - 提交信息里的 `size-ok:` 示例不能变成真豁免
 * - 决策记录正文里的 `## ADR-NN` 示例不能被当成分节 —— `--split` 会把原记录
 *   截断、再写出一个假记录,**那是在动决策历史本身**
 *
 * 两种引文写法都要盖住,少一种就漏一种(围栏补完了,注释里又漏了一次):
 *
 * - **围栏代码块**,规则照抄 CommonMark:最多三个前导空格、开启可带信息串、
 *   闭合必须同种不更短且后面只有空白
 * - **HTML 注释块** `<!-- … -->`,可以跨行
 *
 * 这个模块只回答「这一行是不是引文」。它不认识豁免,也不认识决策记录 ——
 * 两边各自拿遮罩去做自己的解析。
 *
 * ## 它是近似的,而偏向是**故意**的
 *
 * 这不是一个完整的 Markdown 解析器(这个仓库零依赖,不为此引一个)。判不准时
 * 它**偏向「算引文」**:整行盖住。因为两个方向的代价不对称 ——
 *
 * - 多盖一行 → `--split` 少切一刀,记录留在一起,人工再分即可,**可逆**
 * - 少盖一行 → 把示例当成分节,原记录被截断、写出假记录,**不可逆**
 *
 * 所以像 `## ADR-59 甲 <!-- 注释` 这种半真半假的行,整行按引文处理。
 */
/**
 * 一行里可能有多个界定符:`<!-- 甲 --> <!-- 乙` —— 状态由**最后一个**决定。
 * 只看「这行有没有 `-->`」会把仍然开着的注释当成关了。
 */
function commentStateAfter(line: string, open: boolean): boolean {
  const re = /<!--|-->/g
  for (let m = re.exec(line); m; m = re.exec(line)) open = m[0] === '<!--'
  return open
}

/**
 * 原始 HTML 块的开启符与各自的收尾。**照 CommonMark 的七类,列全**。
 *
 * 列全是有意义的:这是一个**闭合的集合** —— 七类之外没有第八种开启符。
 * 前几轮一种一种补(`pre` → `div` → CDATA),每次都在猜下一个;
 * 照着规范把七类一次列完,这条线就到头了。
 *
 * 收尾规则各不相同,不能一概按空行:
 *
 * | 类 | 开启 | 收尾 |
 * |---|---|---|
 * | 1 | `<pre` `<script` `<style` `<textarea` | 匹配的收尾标签 |
 * | 2 | `<!--` | `-->`(一行里可能开合多次,单独处理) |
 * | 3 | `<?` | `?>` |
 * | 4 | `<!` + 字母 | `>` |
 * | 5 | `<![CDATA[` | `]]>` |
 * | 6、7 | 其余以标签开头的行 | **空行** |
 *
 * 第 6、7 类没有嵌那张六十个标签的表,判据放宽成「行首是 `<` 加字母或 `/`」。
 * 宽了会多盖几行,而多盖是安全的那一侧;嵌长表反而会因为漏了某个标签而少盖。
 */
const HTML_RAW = /^ {0,3}<(pre|script|style|textarea)[\s>]/i
const HTML_ANY = /^ {0,3}<[a-zA-Z/]/
const htmlClose = (tag: string) => new RegExp(`</${tag}>`, 'i')

/** 开启符 → 收尾判据。`'blank'` 表示到空行为止。 */
function openerOf(line: string): { end: RegExp | 'blank' } | null {
  const raw = HTML_RAW.exec(line)
  if (raw) return { end: htmlClose(raw[1]) }
  if (/^ {0,3}<!\[CDATA\[/.test(line)) return { end: /\]\]>/ }
  if (/^ {0,3}<\?/.test(line)) return { end: /\?>/ }
  if (/^ {0,3}<![a-zA-Z]/.test(line)) return { end: />/ }
  if (HTML_ANY.test(line)) return { end: 'blank' }
  return null
}

interface State {
  fence: { char: string; len: number } | null
  comment: boolean
  html: { end: RegExp | 'blank' } | null
}

function scan(text: string): { mask: boolean[]; state: State } {
  const mask: boolean[] = []
  const state: State = { fence: null, comment: false, html: null }

  for (const line of text.split('\n')) {
    if (state.comment) {
      mask.push(true)
      state.comment = commentStateAfter(line, true)
      continue
    }
    if (state.html) {
      mask.push(true)
      const done = state.html.end === 'blank' ? line.trim() === '' : state.html.end.test(line)
      if (done) state.html = null
      continue
    }
    const run = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (state.fence) {
      const closes = run !== null
        && run[1][0] === state.fence.char
        && run[1].length >= state.fence.len
        && run[2].trim() === ''
      if (closes) state.fence = null
      mask.push(true)
      continue
    }
    if (run) { state.fence = { char: run[1][0], len: run[1].length }; mask.push(true); continue }
    if (line.includes('<!--')) {
      mask.push(true)
      state.comment = commentStateAfter(line, false)
      continue
    }
    const opener = openerOf(line)
    if (opener) {
      mask.push(true)
      // 同一行就收尾的（`<pre>x</pre>`、`<!DOCTYPE html>`）不进入跨行状态
      const rest = line.replace(/^ {0,3}</, '')
      if (opener.end === 'blank' || !opener.end.test(rest)) state.html = opener
      continue
    }
    mask.push(false)
  }
  return { mask, state }
}

export function quotedMask(text: string): boolean[] {
  return scan(text).mask
}

/**
 * 这段文本结束时,还有没有**没关上的**引文构造(围栏、注释、HTML 块)。
 *
 * 给 `--split` 当兜底用:一刀切在引文中间,切出来的那段必然带着一个没关上的构造。
 * 这条判断**与引文的形态无关** —— 只要遮罩认识那种形态,切错就被抓住,
 * 不必指望我把每种写法都提前想到。
 */
export function endsOpen(text: string): boolean {
  const { state } = scan(text)
  return state.fence !== null || state.comment || state.html !== null
}
