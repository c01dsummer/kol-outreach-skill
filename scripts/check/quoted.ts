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
 */
export function quotedMask(text: string): boolean[] {
  const out: boolean[] = []
  let fence: { char: string; len: number } | null = null
  let inComment = false

  for (const line of text.split('\n')) {
    if (inComment) {
      out.push(true)
      if (line.includes('-->')) inComment = false
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
      if (!line.includes('-->')) inComment = true
      continue
    }
    out.push(false)
  }
  return out
}
