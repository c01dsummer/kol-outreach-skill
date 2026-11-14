/**
 * 引文遮罩 —— 一段 Markdown 里,哪些行是**在演示语法**而不是在使用语法。
 *
 * **凡是要按结构解析 Markdown 的地方,都要先过这一道。** 今天用它的四处都在决策记录这边:
 * `adr-sync.ts`(转发页里又出现记录标题)、`spec-rule.ts`(记录编号与元数据行)、
 * `debt-rule.ts`(欠条台账)、`cite-rule.ts`(被引表)—— 正文里举例写的 `## ADR-NN`、
 * 欠条与引用都不能被当成真的。
 *
 * 写下这个模块时用它的是另外两处,都已不在:提交信息里的 `size-ok:` 示例不能变成真豁免
 * (今天豁免只认提交信息的最后一段,不过这道遮罩),和 `--split` 切分整册时不能把示例当成
 * 分节(切错会把原记录截断、再写出一个假记录,**那是在动决策历史本身**;`--split` 已撤,
 * ADR-79 末尾)。
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
 *
 * 这份不对称是照 `--split` 算的;`--split` 撤了(ADR-79 末尾),偏向没跟着改。
 * 今天的几处调用方读到的是另一边:多盖一行就少读一行 —— `spec-rule.ts` 那一处
 * 为此对行内注释另做了处理(见它那段注释)。
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
 * | 1 | `<pre` `<script` `<style` `<textarea` | 四个收尾标签中的任意一个 |
 * | 2 | `<!--` | `-->`(一行里可能开合多次,单独处理) |
 * | 3 | `<?` | `?>` |
 * | 4 | `<!` + 字母 | `>` |
 * | 5 | `<![CDATA[` | `]]>` |
 * | 6、7 | 其余以标签开头的行 | **空行** |
 *
 * 第 6、7 类没有嵌那张六十个标签的表,判据放宽成「行首是 `<` 加字母或 `/`」。
 * 宽了会多盖几行,而多盖是安全的那一侧;嵌长表反而会因为漏了某个标签而少盖。
 *
 * ## 第 1 类的两处细节,都得照规范的原话,不能照直觉
 *
 * **开启符后面允许直接是行尾。** 规范原话是「后跟一个空格、一个制表符、`>`、
 * 或**行尾**」。少了行尾这一种,单独一行的 `<pre` 认不出来,掉进第 6、7 类的
 * 兜底判据里按**空行**收尾 —— 而第 1 类本该一直开到收尾标签。差别不是多盖少盖:
 * 块里空行之后的 `## ADR-59` 会露出来当成分节(当初 `--split` 会因此把真记录截断、
 * 再写出一条假记录;它已撤,ADR-79 末尾)。
 *
 * **收尾标签不必与开启的那个匹配。** 规范括号里写明了(`it need not match the
 * start tag`)。所以收尾判据是四个标签的并集,不是开启的那一个 —— 这一处
 * 收得比规范紧会多盖,虽然落在安全的那一侧,但遮罩要如实反映一个 CommonMark
 * 解析器的行为,而**规范说了算的地方没有「保守一点」这个选项**。
 * 放宽只留给规范之外的判断(第 6、7 类那张长表)。
 */
const HTML_RAW = /^ {0,3}<(?:pre|script|style|textarea)(?:[\s>]|$)/i
const HTML_RAW_END = /<\/(?:pre|script|style|textarea)>/i
const HTML_ANY = /^ {0,3}<[a-zA-Z/]/

/** 开启符 → 收尾判据。`'blank'` 表示到空行为止。 */
function openerOf(line: string): { end: RegExp | 'blank' } | null {
  if (HTML_RAW.test(line)) return { end: HTML_RAW_END }
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

/** 行首的引用记号(可以嵌套),剥掉它才认得出引用块里的围栏。 */
const QUOTE_PREFIX = /^(?: {0,3}>[ \t]?)+/

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
    /**
     * **围栏要先剥掉引用记号再认。** 规范说围栏最多三个前导空格,而 `> ` 不是空白 ——
     * 于是写在引用块里的围栏整段一行都遮不住(实测,不是推的)。而欠条块、死亡条件、
     * 决策记录里的例子恰恰都写在引用块里,那正是最需要盖住的地方(ADR-86)。
     *
     * 只剥给围栏这一路用,HTML 与注释那两路仍看原行 —— 改得越窄，另外两个
     * 调用方(体量豁免的示例、决策记录分节)受到的影响越小。而这一剥只会让遮罩
     * **盖得更多**，正是本文件开头声明的那个故意的偏向。
     */
    const run = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.replace(QUOTE_PREFIX, ''))
    if (state.fence) {
      const closes = run !== null
        && run[1][0] === state.fence.char
        && run[1].length >= state.fence.len
        && run[2].trim() === ''
      if (closes) state.fence = null
      mask.push(true)
      continue
    }
    /**
     * **反引号围栏的信息串里不许再有反引号**(规范如此;波浪号围栏不受这条限制)。
     * 不判这一句的话,一行以三个反引号起头、后面又带反引号的普通文字会被当成开启,
     * 于是它到下一个闭合之间**整段被遮住** —— 而那中间可能正有一条真的重启条件,
     * 少遮是危险的那一侧,多遮同样会让判定看不见该看见的东西。
     */
    const opensFence = run !== null && !(run[1][0] === '`' && run[2].includes('`'))
    if (opensFence && run) {
      state.fence = { char: run[1][0], len: run[1].length }
      mask.push(true)
      continue
    }
    /**
     * **规范的开启条件先判,我那条放宽的注释判据殿后。** 顺序反过来就漏:
     * `<pre><!-- 说明 -->` 是规范认的第 1 类开启符(行首是 `<pre` 后跟 `>`),
     * 而第 2 类要求行**以** `<!--` 开头 —— 它压根不满足,不存在优先级之争。
     * 可我的注释判据放宽成了「这一行**含有** `<!--`」,于是它抢先接管:
     * 注释在同一行开合,状态归零,`<pre>` 块**从未被记下**,块里的
     * `## ADR-NN` 就露出来当分节了。
     *
     * 放宽本身没错(`## ADR-59 甲 <!-- 注释` 这种半真半假的行要盖住),
     * 错在把它排在规范前面 —— **放宽只能补规范判不了的那些行,不能改判规范判得了的。**
     */
    const opener = openerOf(line)
    if (opener) {
      mask.push(true)
      // 同一行就收尾的（`<pre>x</pre>`、`<!DOCTYPE html>`）不进入跨行状态
      const rest = line.replace(/^ {0,3}</, '')
      if (opener.end === 'blank' || !opener.end.test(rest)) state.html = opener
      continue
    }
    if (line.includes('<!--')) {
      mask.push(true)
      state.comment = commentStateAfter(line, false)
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
 * 写下它是给 `--split` 当兜底(一刀切在引文中间,切出来的那段必然带着一个没关上的构造;
 * `--split` 已撤,ADR-79 末尾)。今天用它的是 `spec-rule.ts`:剥掉一行里的行内注释之前,
 * 先问这一行之前有没有开着的引文构造。
 * 这条判断**与引文的形态无关** —— 只要遮罩认识那种形态,没关上的就被看见,
 * 不必指望我把每种写法都提前想到。
 */
export function endsOpen(text: string): boolean {
  const { state } = scan(text)
  return state.fence !== null || state.comment || state.html !== null
}
