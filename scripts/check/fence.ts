/**
 * 围栏遮罩 —— 一段 Markdown 里,哪些行属于围栏代码块。
 *
 * **凡是要按结构解析 Markdown 的地方,都要先过这一道。** 围栏里的东西是引文:
 * 它在演示语法,不是在使用语法。两者分不开,后果在这个仓库里出现过两次形态:
 *
 * - 提交信息里的 `size-ok:` 示例被当成真豁免(格式对的白送豁免,写歪的把 CI 弄红)
 * - 决策记录正文里的 `## ADR-NN` 示例被当成真的分节,`--split` 会把原记录截断、
 *   再写出一个假记录 —— **那是在动决策历史本身**
 *
 * 两处原本各写各的判断,于是同一个坑补了两遍还漏了第三遍。抽到这里,
 * 是为了下一个要解析 Markdown 的地方不必再补一次
 * (`docs/CONVENTIONS.md`:能靠结构保证的,就别靠对比保证)。
 *
 * 规则照抄 CommonMark,不自己攒:
 *
 * - 最多三个前导空格
 * - 开启可以带信息串(``` ```ts ```)
 * - **闭合必须与开启同种、不更短,且后面只能是空白** —— 所以 ``` ```ts ``` 这样的行
 *   出现在块里时是内容,不是闭合
 */
export function fenceMask(text: string): boolean[] {
  const out: boolean[] = []
  let fence: { char: string; len: number } | null = null

  for (const line of text.split('\n')) {
    const run = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      const closes = run !== null
        && run[1][0] === fence.char
        && run[1].length >= fence.len
        && run[2].trim() === ''
      if (closes) fence = null
      out.push(true)          // 围栏标记本身也算「不是结构」
      continue
    }
    if (run) { fence = { char: run[1][0], len: run[1].length }; out.push(true); continue }
    out.push(false)
  }
  return out
}
