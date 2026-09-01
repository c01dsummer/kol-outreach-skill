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

export function quotedMask(text: string): boolean[] {
  const out: boolean[] = []
  let fence: { char: string; len: number } | null = null
  let inComment = false

  for (const line of text.split('\n')) {
    if (inComment) {
      out.push(true)
      inComment = commentStateAfter(line, true)
      continue
    }
    const run = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      const closes = run !== null
        && run[1][0] === fence.char
        && run[1].length >= fence.len
        && run[2].trim() === ''
      if (closes) fence = null
      out.push(true)
      continue
    }
    if (run) { fence = { char: run[1][0], len: run[1].length }; out.push(true); continue }
    if (line.includes('<!--')) {
      out.push(true)
      inComment = commentStateAfter(line, false)
      continue
    }
    out.push(false)
  }
  return out
}
