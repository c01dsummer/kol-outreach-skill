/**
 * 自检组之间共享的运行态，`needs` 有没有写全 —— 按语法树扫 `selfcheck.ts`。
 *
 * 完整自检拆进程之后（ADR-132），`needs` 连通的族是派工单位：同一族在同一个进程里、按登记顺序跑，
 * 不同族各在各的进程里，各有一份模块级变量、各有一个 `tmp`。一组读了别族的组写下的东西，
 * 拆进程跑时它读到的就是初始值 —— 被 `if (dir) { … }` 守着的那一节会整节静默跳过，自检照样全绿
 * （`group-rule.ts` 的 `wanted` 头上那段）。单进程整跑时这种漏写照样成立，所以拆进程之前没人看得见。
 *
 * 扫的是什么：
 * - **状态** = 顶层声明的非函数绑定。组里给它赋值（含解构赋值的目标、for-of／for-in 的循环变量）、
 *   `++`／`--`、`delete`、改它（或它的别名）的属性、调它会改自己的方法（`add`、`push`…），算写；
 *   其余提到它，算读。
 * - **`tmp` 下的固定路径** = 顶层 `const x = join(tmp, '字面量', …)`，以及组里直接写的
 *   `join(tmp, '字面量', …)`。谁写谁读源码里看不出（多半是子进程在写），提到就算又读又写；
 *   一条路径是另一条的上级目录也算碰到同一处。
 * - **经由顶层函数**：组里提到一个顶层函数（调用或当实参传），它（及它再提到的顶层函数）读写的
 *   都记到这一组头上。
 * - 名字按作用域认（编译器的符号表）：组里一个同名的局部变量不是那个顶层绑定。
 *
 * 判两种（写方 ≠ 读方）：
 * - `family`：写方与读方不在同一族 —— **完整跑**拆进程时读方拿不到写方那一份。
 * - `closure`：同一族，读方只读不写、而它的 `needs` 闭包里没有写方 —— `--only` 点它时写方不跑。
 *   自己也写这份状态的组（惰性建夹具的那种）、碰同一路径的组，不在这一种里判：看不出谁靠谁。
 *
 * 子进程交回、父进程合并的那几样（`MERGED`）各进程各写一份、由合并收回，写不算共享；
 * 组里**读**它们另判（`merged`）：拆进程后一组只看得见本进程那一份。
 *
 * ⚠️ 看不见的（这些仍只有真跑才证得了，ADR-99 第二节）：拿 `tmp` 当当前目录起的子进程按相对路径
 * 读写的文件（`memory/creators.json` 那一类）；拼出来的路径（模板串、变量，`join(tmp, 非字面量)`
 * 静默放过，不进 `problems`）；经由实参或返回值交出去之后再被改的对象（`Object.assign(S, …)`、
 * `S.get(k)!.add(…)` 都记成读）；对象方法、条件表达式里的函数体；`process.env`、`globalThis`、
 * import 进来的模块的状态；顶层收尾段读组写下的东西。**扫描绿只说明扫得见的共享都在 `needs` 里。**
 *
 * 报出来之后怎么回应：读方漏了写方，就把写方补进读方的 `needs`。两族各自建、各自用同一处
 * （`tmp` 下同名的落点、惰性夹具）也会报 —— 这是规则有意保守：改成各组各用各的路径或状态，
 * **不要补一条假依赖**让两族并成一族，那只会静默降低拆进程的并行度。
 */
import type * as Ts from 'typescript'
import { createRequire } from 'node:module'
import { type Group, type ShardReport, families, wanted } from './group-rule.js'

const ts = createRequire(import.meta.url)('typescript') as typeof Ts

/**
 * 子进程交回、父进程合并的那几样。类型钉在 `ShardReport` 的字段上：想把别的名字塞进来让这道
 * 检查闭嘴，得先让子进程把它交回、让父进程合并它。
 */
export const MERGED: readonly Exclude<keyof ShardReport, 'groups'>[] = ['failed', 'claimed', 'covered']

/** 会改调用对象自己的方法 —— 调了算写 */
const MUTATORS = new Set(['add', 'set', 'delete', 'clear', 'push', 'pop', 'shift', 'unshift',
  'splice', 'sort', 'reverse', 'fill', 'copyWithin'])

export interface Share { state: string; writer: string; reader: string }
export interface ShareFault extends Share { kind: 'family' | 'closure' | 'merged' }
/** 一组（连同它提到的顶层函数）读了什么、写了什么 */
export interface Effect { reads: ReadonlySet<string>; writes: ReadonlySet<string> }
export interface ShareJudgement {
  /** 全部「写方 → 碰到它的另一组」配对，同族的也在内 —— 给调用方做阳性对照 */
  pairs: Share[]
  faults: ShareFault[]
}
export interface ShareScan extends ShareJudgement {
  groups: Group[]
  effects: ReadonlyMap<string, Effect>
  /** 扫不了的形状 —— 扫不了不能当成没共享 */
  problems: string[]
}

export function scanShares(source: string, root = 'tmp', merged: readonly string[] = MERGED): ShareScan {
  const name = 'selfcheck.ts'
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true)
  const host: Ts.CompilerHost = {
    getSourceFile: f => f === name ? file : undefined,
    getDefaultLibFileName: () => 'lib.d.ts', writeFile: () => {}, getCurrentDirectory: () => '/',
    getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
    fileExists: f => f === name, readFile: () => undefined,
  }
  const checker = ts.createProgram([name], { noLib: true, noResolve: true, types: [] }, host).getTypeChecker()
  const symbolOf = (id: Ts.Identifier): Ts.Symbol | undefined =>
    ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id
      ? checker.getShorthandAssignmentValueSymbol(id.parent) : checker.getSymbolAtLocation(id)
  const literal = (n: Ts.Node | undefined): string | undefined =>
    n !== undefined && ts.isStringLiteralLike(n) ? n.text : undefined
  const problems: string[] = []

  // ── 顶层：哪些是函数（经由它传递），哪些是状态，哪些是 tmp 下的固定路径 ──
  const helpers = new Map<Ts.Symbol, Ts.Node>()
  const states = new Map<Ts.Symbol, string>()
  let base: Ts.Symbol | undefined
  const PATH = `${root}/`
  const fixedPath = (n: Ts.Node | undefined): string | undefined => {
    if (n === undefined || !ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return undefined
    if (!['join', 'resolve'].includes(n.expression.text)) return undefined
    const [first, ...rest] = n.arguments
    if (first === undefined || !ts.isIdentifier(first) || base === undefined || symbolOf(first) !== base) return undefined
    const parts = rest.map(literal)
    return parts.length && parts.every(p => p !== undefined) ? PATH + parts.join('/') : undefined
  }
  const names = (b: Ts.BindingName): Ts.Identifier[] => ts.isIdentifier(b) ? [b]
    : b.elements.flatMap(e => ts.isOmittedExpression(e) ? [] : names(e.name))
  for (const st of file.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) {
      const s = checker.getSymbolAtLocation(st.name)
      if (s) helpers.set(s, st)
    }
    if (!ts.isVariableStatement(st)) continue
    for (const d of st.declarationList.declarations) {
      const init = d.initializer
      if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
        const s = checker.getSymbolAtLocation(d.name)
        if (s) helpers.set(s, init)
        continue
      }
      for (const id of names(d.name)) {
        const s = checker.getSymbolAtLocation(id)
        if (!s) continue
        states.set(s, fixedPath(init) ?? id.text)
        if (id.text === root) base = s
      }
    }
  }
  if (base === undefined) problems.push(`顶层没有 ${root} 这个绑定，${root} 下的固定路径一条都扫不了`)

  // ── 一个函数体直接读写了什么、提到了哪些顶层函数 ──
  interface Touch { reads: Set<string>; writes: Set<string>; calls: Set<Ts.Symbol> }
  /** `const completed = renderInputCompleted` 这种别名：经由它改属性，算改那份状态 */
  const aliases = new Map<Ts.Symbol, string>()
  const bare = (e: Ts.Expression): Ts.Expression =>
    ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)
      || ts.isSatisfiesExpression(e) ? bare(e.expression) : e
  /** 这一处提到它，是不是在写它。`deep`：只认改属性、调会改自己的方法（别名自己被重新赋值不算） */
  const writes = (id: Ts.Identifier, deep: boolean): boolean => {
    let n: Ts.Node = id
    const up = (p: Ts.Node): boolean => (ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p))
      && p.expression === n || ts.isNonNullExpression(p) || ts.isParenthesizedExpression(p)
      || ts.isAsExpression(p) || ts.isSatisfiesExpression(p)
    while (up(n.parent)) n = n.parent
    const member = ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)
    if (deep && !member) return false
    const p = n.parent
    if (!deep) {
      // 解构赋值的目标、for-of／for-in 的循环变量：写的就是这个绑定本身
      let t: Ts.Node = n
      while (ts.isShorthandPropertyAssignment(t.parent) || ts.isSpreadElement(t.parent) || ts.isSpreadAssignment(t.parent)
             || (ts.isPropertyAssignment(t.parent) && t.parent.initializer === t)
             || ts.isArrayLiteralExpression(t.parent) || ts.isObjectLiteralExpression(t.parent)) t = t.parent
      if (t !== n && ts.isBinaryExpression(t.parent) && t.parent.left === t
          && t.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) return true
      if ((ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer === n) return true
    }
    if (ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return true
    if ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p))
        && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)) return true
    if (ts.isDeleteExpression(p)) return true
    return ts.isCallExpression(p) && p.expression === n && ts.isPropertyAccessExpression(n) && MUTATORS.has(n.name.text)
  }
  const touches = (body: Ts.Node): Touch => {
    const t: Touch = { reads: new Set(), writes: new Set(), calls: new Set() }
    const visit = (n: Ts.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        const init = bare(n.initializer)
        const from = ts.isIdentifier(init) ? symbolOf(init) : undefined
        const state = from === undefined ? undefined : states.get(from) ?? aliases.get(from)
        const self = checker.getSymbolAtLocation(n.name)
        if (state !== undefined && self !== undefined && !state.startsWith(PATH)) aliases.set(self, state)
      }
      const path = fixedPath(n)
      if (path !== undefined) { t.reads.add(path); t.writes.add(path) }
      if (ts.isIdentifier(n)) {
        const s = symbolOf(n)
        if (s !== undefined && helpers.has(s)) t.calls.add(s)
        const direct = s === undefined || s === base ? undefined : states.get(s)
        const via = s === undefined ? undefined : aliases.get(s)
        const state = direct ?? via
        if (state !== undefined && state.startsWith(PATH)) { t.reads.add(state); t.writes.add(state) }
        else if (state !== undefined) (writes(n, direct === undefined) ? t.writes : t.reads).add(state)
      }
      ts.forEachChild(n, visit)
    }
    visit(body)
    return t
  }

  // ── 顶层函数的读写传递闭包（不动点） ──
  const viaHelpers = new Map([...helpers].map(([s, body]) => [s, touches(body)]))
  const absorb = (t: Touch): boolean => {
    let grew = false
    for (const c of [...t.calls]) {
      const u = viaHelpers.get(c)!
      for (const [from, to] of [[u.reads, t.reads], [u.writes, t.writes]] as const) {
        for (const x of from) if (!to.has(x)) { to.add(x); grew = true }
      }
      for (const x of u.calls) if (!t.calls.has(x)) { t.calls.add(x); grew = true }
    }
    return grew
  }
  for (let grew = true; grew;) {
    grew = false
    for (const t of viaHelpers.values()) if (absorb(t)) grew = true
  }

  // ── 组：只认顶层的 group('字面量', ['字面量'…], () => {…}) ──
  const groups: Group[] = []
  const effects = new Map<string, Touch>()
  const topLevel = new Set(file.statements.filter(ts.isExpressionStatement).map(s => s.expression))
  const findGroups = (n: Ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'group') {
      const [idArg, needsArg, fn] = n.arguments
      const id = literal(idArg)
      const needs = needsArg !== undefined && ts.isArrayLiteralExpression(needsArg)
        ? needsArg.elements.map(literal) : undefined
      const where = `第 ${file.getLineAndCharacterOfPosition(n.getStart()).line + 1} 行的 group(…)`
      if (!topLevel.has(n)) problems.push(`${where}不在顶层，扫不了`)
      else if (id === undefined || needs === undefined || needs.some(x => x === undefined)
               || fn === undefined || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
        problems.push(`${where}不是 group('字面量', ['字面量'…], () => {…}) 的形状，扫不了`)
      } else {
        groups.push({ id, needs: needs as string[] })
        const t = touches(fn)
        absorb(t)
        effects.set(id, t)
      }
    }
    ts.forEachChild(n, findGroups)
  }
  findGroups(file)
  // needs 指到没扫到的组（那一组形状扫不了被跳过，或名字写错）也是扫不了：报出来、去掉那条边再判。
  // 留着那条边的话族划分当场抛，同一次扫出的别的 problems 全丢，报错还指着用它的那一组
  const known = new Set(groups.map(g => g.id))
  const judged = groups.map(g => {
    const unknown = g.needs.filter(x => !known.has(x))
    for (const x of unknown) problems.push(`组 ${g.id} 的 needs 里的 ${x} 没有扫到对应的组，扫不了`)
    return unknown.length ? { ...g, needs: g.needs.filter(x => known.has(x)) } : g
  })
  return { groups: judged, effects, problems, ...judgeShares(judged, effects, root, merged) }
}

/**
 * 只判不扫：同一份读写，换一套 `needs` 再判一遍 —— 调用方拿真源码扫出的读写做阳性对照时，
 * 不必改源码文本、再扫一遍。
 */
export function judgeShares(groups: readonly Group[], effects: ReadonlyMap<string, Effect>,
  root = 'tmp', merged: readonly string[] = MERGED): ShareJudgement {
  const PATH = `${root}/`
  const familyOf = new Map<string, number>()
  families(groups).forEach((f, i) => { for (const id of f) familyOf.set(id, i) })
  const overlap = (a: string, b: string): boolean =>
    a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
  const pairs: Share[] = [], faults: ShareFault[] = []
  for (const w of groups) for (const state of effects.get(w.id)!.writes) {
    if (merged.includes(state)) continue
    for (const r of groups) {
      if (r.id === w.id) continue
      const e = effects.get(r.id)!
      const hit = state.startsWith(PATH)
        ? [...e.writes].find(x => x.startsWith(PATH) && overlap(x, state))
        : e.reads.has(state) || e.writes.has(state) ? state : undefined
      if (hit === undefined) continue
      const pair = { state, writer: w.id, reader: r.id }
      pairs.push(pair)
      if (familyOf.get(w.id) !== familyOf.get(r.id)) faults.push({ ...pair, kind: 'family' })
      else if (!state.startsWith(PATH) && !e.writes.has(state)
               && !wanted(groups, [r.id])!.has(w.id)) faults.push({ ...pair, kind: 'closure' })
    }
  }
  for (const g of groups) for (const state of effects.get(g.id)!.reads) {
    if (merged.includes(state)) faults.push({ state, writer: '各进程', reader: g.id, kind: 'merged' })
  }
  return { pairs, faults }
}
