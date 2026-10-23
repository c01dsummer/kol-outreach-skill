/**
 * 准入读物包的判定（ADR-162）：给写测试的那个上下文出的四份读物里，需求单与变异说明怎么出，
 * 签名怎么扫，包目录在不在仓库里。入口在第二片（ADR-162 第六节）。
 *
 * 读的上下文手里只有这个包（`process/4-VERIFY.md`「给测试上下文一张准入读物清单」）。
 * 所以这里的每一处取舍都是在定「它看得见什么」：少收一条交点，它就写不出那条交点的测试；
 * 签名里漏进一段函数体，它就读到了实现。
 */
import type * as Ts from 'typescript'
import { createRequire } from 'node:module'
import { isAbsolute, relative, sep } from 'node:path'
import type { Req } from './spec-rule.js'
import { implementationLeak } from './why-rule.js'
import { exemptionCovered, exemptionLead } from './mutate-rule.js'

const ts = createRequire(import.meta.url)('typescript') as typeof Ts

/**
 * 原文里点到名的需求编号（ADR-162 第二节第 1 份第 4 条）。前面贴着 ASCII 字母、数字或下划线的不算，
 * 所以 `ADR-15`、`Phase 01` 不认（汉字不算字母，`与P4冲突` 照认）。「数字串后面不是数字」不另写：
 * `+` 是贪婪的，一次吃到底，`P10` 认成 `P10` 而不是 `P1`。`P1.e` 认成 `P1`。
 */
const REQ_TOKEN = /(?<![A-Za-z0-9_])[PSDFU][0-9]+/g

const criteriaLines = (r: Req): string[] =>
  r.accept.length === 0 ? ['没有。'] : r.accept.map(c => `- **${c.id}** ${c.text}`)

/** 第 1 份（ADR-162 第二节）。不出包时交理由 */
export function requirementSheet(reqs: readonly Req[], id: string):
  { ok: true; text: string } | { ok: false; reason: string } {
  const target = reqs.find(r => r.id === id)
  if (target === undefined) return { ok: false, reason: `需求登记表里没有 ${id}` }
  if (target.deprecated !== undefined) return { ok: false, reason: `${id} 已作废` }

  // 交点是两条需求一起的事：声明在对面的那一半，只看自己的 tension 就漏了
  const tensions = reqs.flatMap(r => (r.tension ?? [])
    .filter(t => r.id === id || t.with === id)
    .map(t => ({ from: r.id, with: t.with, ruling: t.ruling })))

  const sources = [target.text, ...target.accept.map(c => c.text),
    ...tensions.flatMap(t => [t.from, t.with, t.ruling])]
  const named = new Set(sources.flatMap(s => s.match(REQ_TOKEN) ?? []))
  // 只走一跳：被点到的那几条自己点到的不再往下收
  const cited = reqs.filter(r => r.id !== id && named.has(r.id))

  const lines = [
    `# ${id}`, '', target.text, '',
    '## 验收标准', '', ...criteriaLines(target), '',
    '## 交点', '',
    ...(tensions.length === 0 ? ['没有。'] : tensions.map(t => `- **${t.from} × ${t.with}**：${t.ruling}`)), '',
    '## 点到名的需求', '',
  ]
  if (cited.length === 0) lines.push('没有。')
  else {
    lines.push('只走一跳：下面这些是上面的原文里点到名的，它们自己点到的不再往下收。')
    for (const r of cited) {
      lines.push('', `### ${r.id}${r.deprecated === undefined ? '' : '（已作废）'}`, '', r.text, '', ...criteriaLines(r))
    }
  }
  return { ok: true, text: `${lines.join('\n')}\n` }
}

/** 第 4 份（ADR-162 第二节）。leaks 不空时入口不出包 */
export function briefSheet(id: string,
  mutations: readonly { id: string; req: string; why: string }[],
  exemptions: readonly { req: string; why: string; scope?: string }[]):
  { text: string; leaks: { id: string; leak: string }[] } {
  // `D1` 的包不收 `D10`：只认整个编号，或编号后面紧跟一个点
  const owns = (req: string) => req === id || req.startsWith(`${id}.`)
  const muts = mutations.filter(m => owns(m.req))
  const exes = exemptions.filter(e => owns(e.req))
  // 行的写法与 `mutate --brief` 逐字相同；豁免那三个字按全部变异算，与它同一处取
  const body = [
    ...muts.map(m => `  ${m.id}  [${m.req}]  ${m.why}`),
    ...exes.map(e => `  ⊘     [${e.req}]  ${exemptionLead(exemptionCovered(e.req, mutations))}`
      + `${e.scope === undefined ? '' : `（${e.scope}）`}：${e.why}`),
  ]
  const leaks: { id: string; leak: string }[] = []
  for (const m of muts) {
    const leak = implementationLeak(m.why)
    if (leak !== undefined) leaks.push({ id: m.id, leak })
  }
  for (const e of exes) {
    const leak = implementationLeak(e.why)
    if (leak !== undefined) leaks.push({ id: `⊘ [${e.req}]`, leak })
  }
  const lines = [
    `# 变异集 · ${id}`, '',
    `${id} 与 ${id}.x 名下的变异「违反了什么」，与 \`npm run mutate -- --brief\` 同一栏；变异改哪个文件、改成什么不在这里。`, '',
    ...(body.length === 0 ? ['没有。'] : body), '',
    `共 ${muts.length} 个变异、${exes.length} 处显式豁免。`,
  ]
  return { text: `${lines.join('\n')}\n`, leaks }
}

/** 声明文件里允许出现的语句：顶层与每一个命名空间／模块块里（带不带 `declare`、套几层）都是这几种 */
const DECLARATION_STATEMENTS = new Set<Ts.SyntaxKind>([
  ts.SyntaxKind.ImportDeclaration, ts.SyntaxKind.ImportEqualsDeclaration,
  ts.SyntaxKind.ExportDeclaration, ts.SyntaxKind.ExportAssignment,
  ts.SyntaxKind.InterfaceDeclaration, ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.VariableStatement, ts.SyntaxKind.EnumDeclaration, ts.SyntaxKind.ModuleDeclaration,
])

const LITERALS = new Set<Ts.SyntaxKind>([
  ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.BigIntLiteral, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword,
])

const literal = (e: Ts.Expression): boolean => LITERALS.has(e.kind)
  || (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken
    && (ts.isNumericLiteral(e.operand) || ts.isBigIntLiteral(e.operand)))

/** ADR-162 第三节。空单子 = 没找到 */
export function declarationFindings(text: string): string[] {
  const file = ts.createSourceFile('pack.d.ts', text, ts.ScriptTarget.Latest, true)
  const found: { at: number; what: string }[] = []
  const report = (n: Ts.Node, what: string) => found.push({ at: n.getStart(file), what })

  const statements = (list: readonly Ts.Statement[]) => {
    for (const s of list) if (!DECLARATION_STATEMENTS.has(s.kind)) report(s, '不是声明的语句')
  }
  const visit = (n: Ts.Node): void => {
    if (ts.isFunctionLike(n) && (n as { body?: Ts.Node }).body !== undefined) {
      // 报了一处就不往里找：函数体里的任何东西都不另报
      report(n, '函数体')
      return
    }
    if ((ts.isVariableDeclaration(n) || ts.isPropertyDeclaration(n) || ts.isEnumMember(n))
      && n.initializer !== undefined && !literal(n.initializer)) report(n, '初始值不是字面量')
    if (ts.isModuleBlock(n)) statements(n.statements)
    ts.forEachChild(n, visit)
  }
  statements(file.statements)
  ts.forEachChild(file, visit)

  return found.sort((a, b) => a.at - b.at)
    .map(f => `第 ${file.getLineAndCharacterOfPosition(f.at).line + 1} 行：${f.what}`)
}

/** ADR-162 第四节。两个参数都是绝对路径 */
export function insideRoot(root: string, dir: string): boolean {
  const r = relative(root, dir)
  // 本身（`r` 是空串）也在里面。名字以 `..` 开头的子目录（`..cache`）在里面：只认整段的 `..`
  return r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r)
}
