/**
 * 字段断言闸门的**判定**（ADR-198）：检查链里一处判定的返回值多了一个字段，
 * 却没有任何一条测试碰过它 —— 这件事从 ADR-70 第二节第①条那张欠条起一直靠评审器逐个核，没有机器。
 *
 * 三件事都在这里，因为三件都决定这道闸门看得见什么（`docs/CONVENTIONS.md` 第十节）：
 *
 * 1. **哪些是「字段」**（`fieldsOf`）：`scripts/check/` 下非验证者文件里，每个导出函数的返回类型
 *    逐层展开 —— 数组、元组、联合、交叉、索引签名（`Record`）、`Readonly`／`Partial` 这类映射；`Promise`、`Map`/`Set` 这类库里的泛型取类型参数 ——
 *    展开到的、**声明在这些文件里**的每一个属性。函数类型的属性本身算一个字段，它的返回值不展开（那是回调，不是数据）。
 *    一个字段的名字（`key`）从它的声明位置算，不从「走到它的路」算：文件 ＋ 往上每一层有名字的
 *    声明（接口、类型别名、函数、属性、变量；数字名与计算属性名也算名字），类型字面量若带一个取字符串字面量的属性（判别联合的 `kind`），
 *    记成 `{kind=…}`；推断出来的对象字面量同理，看那个属性推出来的类型是不是字符串字面量（`'a' as const`）。所以新加一个函数、走到旧字段的路变了，旧字段的名字不变。
 * 2. **哪些算「用到」**（也在 `fieldsOf` 里）：只认测试作者在验证者文件（`isVerifierFile` 认的那几种）里**写出来的**，
 *    解析到这个声明上的：读属性（`.x`、`['x']`；只写不读的不算，见 `writeOnly`）、解构，
 *    或比对（`COMPARE` 里的调用）实参里对象字面量写出来的键（期望值写成那个类型）。
 *    不替比对去猜它读了什么：整个值交给 `eq`、`assert`、`JSON.stringify` 不算碰到里面的字段 ——
 *    期望值是空数组、比对的那个值里根本没有这个可选字段、`eq(r, r)` 时，「加了字段比对自己会失败」都不成立。
 *    只为搭场景、过类型检查写的对象字面量（传给别的函数的）也不算。黑盒测试自己重抄的那份类型读到的是重抄的声明，不算；要算就写豁免。
 * 3. **哪些是「新增」、红不红**（`fieldVerdict`）：名字的处数比基线（`size-rule.ts` 的 `resolveBaseline` 定的起点）
 *    上多的（撞名照样数得出来）；不是每处都用到、又没有具名豁免的，红。豁免写在字段声明前面独占几行的注释里、或那一行行尾的注释里：
 *    `字段不入断言：<理由>`，理由必填；写了标记没写理由的照样红。HEAD 在主干上只报数（入口管）。
 *
 * ⚠️ 证不了的（ADR-198 第三节）：「碰到」不等于「断言了」—— 只拿来搭场景的一次读取也算，
 * 永远不跑的循环里的读取也算；打印出来的文字不是字段；不导出的函数、返回 `any` 的函数看不见。
 *
 * 纯函数，不读文件、不起进程：程序（`ts.Program`）由入口建好交进来。`typescript` 按需加载，
 * 同 `mutate-rule.ts`（只 import 本模块的验证者不必为它付编译器的加载时间）。
 */
import { createRequire } from 'node:module'
import type * as Ts from 'typescript'

let compiler: typeof Ts | undefined
const typescript = (): typeof Ts => compiler ??= createRequire(import.meta.url)('typescript') as typeof Ts

/** 豁免标记：写在字段声明那一行或紧挨的上一行的注释里，后面跟理由 */
export const FIELD_WAIVER = '字段不入断言：'

/** 验证者文件：需求测试、自检、各份 `*-test.ts` 契约测试、独立黑盒测试。路径相对仓库根、用 `/` */
export function isVerifierFile(path: string): boolean {
  return path === 'scripts/test.ts' || path === 'scripts/check/selfcheck.ts'
    || /^scripts\/[^/]+-test\.ts$/.test(path) || path.startsWith('scripts/independent-blackbox-tests/')
}

/** 字段从哪些文件里算：`scripts/check/` 直属的 `.ts`，验证者除外 */
export function isJudgedFile(path: string): boolean {
  return /^scripts\/check\/[^/]+\.ts$/.test(path) && !isVerifierFile(path)
}

export interface Field {
  /** 稳定的名字：`文件#外层名.….属性名`，基线与现在按它对 */
  readonly key: string
  readonly file: string
  /** 声明所在行，从 1 起 */
  readonly line: number
  /** 第一次走到它的那条路，只为打印：`函数()[].属性` */
  readonly via: string
  readonly used: boolean
  /** 没有豁免标记时缺席；有标记时是理由（可能是空串 —— 那是不成立的豁免） */
  readonly waiver?: string
}

const relOf = (root: string, fileName: string): string =>
  fileName.startsWith(root + '/') ? fileName.slice(root.length + 1) : fileName

/** 写死的属性名：标识符、字符串、数字，或里面是字符串、数字字面量的计算属性名；别的给 undefined */
function literalName(ts: typeof Ts, name: Ts.Node): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name) && (ts.isStringLiteralLike(name.expression) || ts.isNumericLiteral(name.expression))) return name.expression.text
  return undefined
}

/** 一个声明自己的名字：写死的名字（见 `literalName`）、私有名；别的计算属性名写成 `[表达式]` */
function nameOf(ts: typeof Ts, n: Ts.Node): string | undefined {
  const name = (n as { name?: Ts.Node }).name
  if (name === undefined) return undefined
  if (ts.isPrivateIdentifier(name)) return name.text
  return literalName(ts, name) ?? (ts.isComputedPropertyName(name) ? `[${name.expression.getText()}]` : undefined)
}

/** 键里的一段：名字里带 `.`、`#`、`{`、`}`、`=`、`[`、`]`、`"` 的写成 JSON 字符串，免得和别的路径撞成同一个键 */
const segment = (name: string): string => /[.#{}=[\]"]/.test(name) ? JSON.stringify(name) : name

/** 只写不读：`=` 的左边（套着括号、`!`、`as`／`<T>` 断言、在解构赋值的数组或对象字面量里也算）、`for (… of/in …)` 的循环变量、`delete` 的操作数；`+=`、`++` 先读旧值，不算 */
function writeOnly(ts: typeof Ts, e: Ts.Expression): boolean {
  let n: Ts.Node = e
  for (;;) {
    const p = n.parent
    if (ts.isDeleteExpression(p)) return true
    if (ts.isParenthesizedExpression(p) || ts.isArrayLiteralExpression(p) || ts.isSpreadElement(p)) { n = p; continue }
    if (ts.isNonNullExpression(p) || ts.isAsExpression(p) || ts.isTypeAssertionExpression(p)) { n = p; continue }
    if ((ts.isPropertyAssignment(p) && p.initializer === n) || ts.isSpreadAssignment(p)) { n = p.parent; continue }
    if ((ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer === n) return true
    return ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind === ts.SyntaxKind.EqualsToken
  }
}

/** 声明往上每一层有名字的东西，接成字段的稳定名字 */
function keyOf(ts: typeof Ts, tc: Ts.TypeChecker, root: string, decl: Ts.Declaration): string {
  const parts: string[] = []
  for (let n: Ts.Node | undefined = decl; n !== undefined && !ts.isSourceFile(n); n = n.parent) {
    if (n.parent !== undefined && ts.isTupleTypeNode(n.parent)) parts.push(`[${n.parent.elements.indexOf(n as Ts.TypeNode)}]`) // 无名元组成员按位置分开
    if (ts.isObjectLiteralExpression(n)) {
      for (const m of n.properties) {
        if (m === decl || !ts.isPropertyAssignment(m) || !(ts.isIdentifier(m.name) || ts.isStringLiteral(m.name))) continue
        const t = tc.getTypeAtLocation(m.name)
        if (t.isStringLiteral()) { parts.push(`{${segment(m.name.text)}=${segment(t.value)}}`); break }
      }
      continue
    }
    if (ts.isTypeLiteralNode(n)) {
      for (const m of n.members) {
        if (m === decl || !ts.isPropertySignature(m) || m.type === undefined) continue
        if (ts.isLiteralTypeNode(m.type) && ts.isStringLiteral(m.type.literal)) {
          parts.push(`{${segment(nameOf(ts, m) ?? m.name.getText())}=${segment(m.type.literal.text)}}`); break
        }
      }
      continue
    }
    const name = ts.isFunctionDeclaration(n) && n.name !== undefined && (tc.getSymbolAtLocation(n.name)?.declarations ?? []).filter(d => ts.isFunctionDeclaration(d) && d.body === undefined).length > 1 ? `${n.name.text}${n.typeParameters === undefined ? '' : `<${n.typeParameters.map(p => p.getText()).join(', ')}>`}(${n.parameters.map(p => p.getText()).join(', ')})`.replace(/\s+/g, ' ') : nameOf(ts, n) // 重载：各签名带上类型参数与参数，分开
    const raw = (n as { name?: Ts.Node }).name
    if (name !== undefined) parts.push(raw !== undefined && ts.isComputedPropertyName(raw) && literalName(ts, raw) === undefined ? name : segment(name))
  }
  return `${relOf(root, decl.getSourceFile().fileName)}#${parts.reverse().join('.')}`
}

/**
 * 字段的豁免：声明前面独占几行的注释里，或声明那一行行尾的注释里（行注释与块注释都认）。
 * 缺席 = 没写标记；空串 = 写了标记没写理由。上一个字段行尾的注释是它自己的，不漏到下一个字段上；
 * 字符串里的标记不算（只读注释）。
 */
function waiverOf(ts: typeof Ts, decl: Ts.Declaration): string | undefined {
  const sf = decl.getSourceFile(), text = sf.text
  const after = text[decl.end] === ',' ? decl.end + 1 : decl.end
  // 前导注释只收换行之后的：上一个字段行尾的那条 TypeScript 自己就不算进来
  const comments = [...(ts.getLeadingCommentRanges(text, decl.pos) ?? []), ...(ts.getTrailingCommentRanges(text, after) ?? [])]
  for (const r of comments) {
    const comment = text.slice(r.pos, r.end)
    const at = comment.indexOf(FIELD_WAIVER)
    if (at >= 0) return comment.slice(at + FIELD_WAIVER.length).replace(/\*\/$/, '').replace(/^\s*\*+/gm, '').trim()
  }
  return undefined
}

const fromLibrary = (t: Ts.Type): boolean =>
  (t.symbol?.declarations ?? []).some(d => /[\\/]node_modules[\\/]/.test(d.getSourceFile().fileName))

/**
 * 字段的全集，连同用没用到、有没有豁免。`root` 是仓库根的绝对路径（程序里的文件名以它开头）。
 * 判定见文件头第 1、2 条。
 */
export function fieldsOf(program: Ts.Program, root: string): Field[] {
  const ts = typescript()
  const tc = program.getTypeChecker()
  const rel = (sf: Ts.SourceFile) => relOf(root, sf.fileName)
  const argumentsOf = (t: Ts.Type): readonly Ts.Type[] =>
    ((t as Ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) ? tc.getTypeArguments(t as Ts.TypeReference) : []
  // 递归类型（`next?: Chain<T[]>`、`type Loop<T> = Loop<T[]>[]`）每展开一层都是新实例，seen 拦不住。找字段按层数停：往下每走一步（属性、元素、联合成员、类型实参……）算一层，不管类型是谁，到 `DEPTH` 层整个不展开；一次从头走总共超过 `BUDGET` 步也停（多路递归每层分叉）。所以必停。找字段这一路停下就报红（见 `cut`），不悄悄少找
  let spent = 0; const enter = (depth: number): number | undefined => (depth === 0 ? spent = 1 : ++spent) > BUDGET || depth >= DEPTH ? undefined : depth + 1 // `spent`：这一次从头（第 0 层）走起已经展开的步数

  // ── 1. 字段 ──
  // `cut`：找字段时展开到上限停下的导出函数 —— 里面可能还有字段没找到，记成这个函数名下一个没人用过的「字段」，照新增字段报红（可在函数前写豁免）
  const found = new Map<Ts.Declaration, string>(), cut = new Set<Ts.Declaration>(); let owner: Ts.Declaration | undefined
  const walk = (t: Ts.Type, via: string, seen: Set<Ts.Type>, depth = 0): void => {
    const inner = enter(depth)
    if (inner === undefined) { if (owner !== undefined) { cut.add(owner); if (!found.has(owner)) found.set(owner, `${via}…`) } return }
    if (seen.has(t)) return; seen.add(t) // 先判层数再记 seen：在深处被停下的，从浅处走到照样展开
    if (t.isUnion() || t.isIntersection()) { for (const u of t.types) walk(u, via, seen, inner); return }
    if (tc.isArrayType(t) || tc.isTupleType(t)) { for (const a of tc.getTypeArguments(t as Ts.TypeReference)) walk(a, `${via}[]`, seen, inner); return }
    if (t.flags & ts.TypeFlags.TypeParameter) { const c = tc.getBaseConstraintOfType(t); if (c !== undefined) walk(c, via, seen, inner); return } // 按约束找：调用处读的是实参那份，宁可多报红
    if (!(t.flags & ts.TypeFlags.Object)) return
    if (fromLibrary(t)) for (const a of argumentsOf(t)) walk(a, `${via}<>`, seen, inner)
    for (const info of tc.getIndexInfosOfType(t)) walk(info.type, `${via}[*]`, seen, inner)
    for (const p of t.getProperties()) {
      for (const d of p.declarations ?? []) if (isJudgedFile(rel(d.getSourceFile())) && !found.has(d)) found.set(d, `${via}.${p.name}`)
      walk(tc.getTypeOfSymbol(p), `${via}.${p.name}`, seen, inner)
    }
  }
  for (const sf of program.getSourceFiles()) {
    if (!isJudgedFile(rel(sf))) continue
    const module = tc.getSymbolAtLocation(sf)
    if (module === undefined) continue
    for (const exported of tc.getExportsOfModule(module)) {
      const s = exported.flags & ts.SymbolFlags.Alias ? tc.getAliasedSymbol(exported) : exported
      const decl = s.valueDeclaration
      if (decl === undefined) continue; owner = decl
      for (const sig of tc.getTypeOfSymbolAtLocation(s, decl).getCallSignatures()) {
        walk(tc.getReturnTypeOfSignature(sig), `${s.name}()`, new Set())
      }
    }
  }

  // ── 2. 用到 ──
  // 只认测试作者白纸黑字写出来的：读属性、解构、比对的期望值里写出来的键（文件头第 2 条）。不替比对去猜它读了什么
  const used = new Set<Ts.Declaration>()
  const mark = (s: Ts.Symbol | undefined): void => { for (const d of s?.declarations ?? []) used.add(d) }
  const calleeOf = (c: Ts.CallExpression): string => ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : ts.isIdentifier(c.expression) ? c.expression.text : ''
  const valueOf = (m: Ts.ShorthandPropertyAssignment): Ts.Type | undefined => { const v = tc.getShorthandAssignmentValueSymbol(m); return v === undefined ? undefined : tc.getTypeOfSymbol(v) }
  const split = (t: Ts.Type): readonly Ts.Type[] => t.isUnion() ? t.types : [t] // 可能为空的也只是联合里多一个 undefined，它上面没有属性
  /** 期望值对象 `lit` 对得上的那几个类型：联合拆开，只留写出来的键它都有、写出来的判别值（字符串字面量）也对得上的成员 —— 不让同名字段在别的成员上沾光 */
  const fit = (lit: Ts.ObjectLiteralExpression, types: readonly Ts.Type[]): readonly Ts.Type[] => types.flatMap(split).filter(t => lit.properties.every(m => {
    const name = ts.isPropertyAssignment(m) || ts.isShorthandPropertyAssignment(m) ? literalName(ts, m.name) : undefined, q = name === undefined ? undefined : t.getProperty(name)
    if (name === undefined || q === undefined) return name === undefined
    const tags = split(tc.getNonNullableType(tc.getTypeOfSymbol(q))) // 可选的判别属性带个 undefined，去掉再看是不是全是字符串字面量
    // 写出来的判别值按它的类型认：'a'、'a' as const、套括号的、简写的 { kind }（取那个变量的类型）都是字面量 'a'
    const said = ts.isPropertyAssignment(m) ? tc.getTypeAtLocation(m.initializer) : ts.isShorthandPropertyAssignment(m) ? valueOf(m) : undefined
    return said === undefined || !said.isStringLiteral() || !tags.every(x => x.isStringLiteral()) || tags.some(x => x.isStringLiteral() && x.value === said.value)
  }))
  /**
   * 期望值里这个位置该是什么类型：一路往上走到一次比对（`COMPARE` 里的调用）的实参，取同一次比对里**别的**实参的类型，再按键、按元素往下找回来。
   * 不在比对的实参里（只为搭场景、过类型检查写的）就是空 —— 那里写的键不算读到
   */
  const expectedOf = (e: Ts.Node): readonly Ts.Type[] => {
    const p = e.parent
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p)) return expectedOf(p)
    if (ts.isCallExpression(p)) { // 只看被比的那两个实参：eq 第一个是标签，node:assert 第三个是出错时的消息，都不比
      const sides = calleeOf(p) === 'eq' ? p.arguments.slice(1, 3) : p.arguments.slice(0, 2)
      return COMPARE.has(calleeOf(p)) && sides.includes(e as Ts.Expression) ? sides.filter(a => a !== e).map(a => tc.getTypeAtLocation(a)) : [] }
    if (ts.isPropertyAssignment(p) && p.initializer === e && ts.isObjectLiteralExpression(p.parent)) {
      const name = literalName(ts, p.name)
      return name === undefined ? [] : fit(p.parent, expectedOf(p.parent)).flatMap(t => { const q = t.getProperty(name); return q === undefined ? [] : [tc.getTypeOfSymbol(q)] })
    }
    if (ts.isArrayLiteralExpression(p)) { const i = p.elements.indexOf(e as Ts.Expression) // 元组按位置取，别的数组取元素类型
      return expectedOf(p).flatMap(split).flatMap(t => { const el = tc.isTupleType(t) ? tc.getTypeArguments(t as Ts.TypeReference)[i] : tc.getIndexTypeOfType(t, ts.IndexKind.Number); return el === undefined ? [] : [el] }) }
    return []
  }
  // 下标读的键按类型认：字面量（常量、联合字面量）与 unique symbol 都换成属性的转义名，再到被索引对象的类型上找
  const keysOf = (t: Ts.Type): Ts.__String[] => t.isUnion() ? t.types.flatMap(keysOf) : t.isStringLiteral() || t.isNumberLiteral() ? [ts.escapeLeadingUnderscores(String(t.value))]
    : t.flags & ts.TypeFlags.UniqueESSymbol ? [(t as Ts.UniqueESSymbolType).escapedName] : []
  for (const sf of program.getSourceFiles()) {
    if (!isVerifierFile(rel(sf))) continue
    const visit = (n: Ts.Node): void => {
      if (ts.isPropertyAccessExpression(n)) { if (!writeOnly(ts, n)) mark(tc.getSymbolAtLocation(n.name)) }
      else if (ts.isElementAccessExpression(n)) { if (!writeOnly(ts, n)) for (const k of keysOf(tc.getTypeAtLocation(n.argumentExpression)))
        mark(tc.getNonNullableType(tc.getTypeAtLocation(n.expression)).getProperties().find(p => p.escapedName === k)) }
      else if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent)) {
        const name = literalName(ts, n.propertyName ?? n.name)
        if (name !== undefined) mark(tc.getTypeAtLocation(n.parent).getProperty(name))
      } else if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && ts.isObjectLiteralExpression(n.parent)) {
        const assigned = ts.isBinaryExpression(n.parent.parent) && n.parent.parent.left === n.parent && n.parent.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
        const name = literalName(ts, n.name) // 解构赋值：键读的是右边；期望值：键读的是同一次比对里别的实参
        if (name !== undefined) for (const t of assigned ? split(tc.getTypeAtLocation(n.parent.parent.right)) : fit(n.parent, expectedOf(n.parent))) mark(t.getProperty(name))
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }

  return [...found].map(([decl, via]) => {
    const sf = decl.getSourceFile()
    const file = rel(sf)
    const waiver = waiverOf(ts, decl)
    return {
      key: `${keyOf(ts, tc, root, decl)}${cut.has(decl) ? INCOMPLETE : ''}`, file, via,
      line: sf.getLineAndCharacterOfPosition(decl.getStart()).line + 1,
      used: !cut.has(decl) && used.has(decl),
      ...(waiver === undefined ? {} : { waiver }),
    }
  })
}

export const DEPTH = 16, BUDGET = 2000 // 找字段往下展开的上限：层数（每走一步——属性、元素、联合成员、类型实参……——算一层；仓库里最深 7 层，2026-11-16 量，留一倍余量）与一次从头走总共展开的步数（多路递归每层分叉，层数没到也会指数爆）
export const INCOMPLETE = '<没展开完>' // 找字段展开到上限停下的函数记的那一条的名字尾巴：不按基线比、每次都判 —— 停下的地方里面加了字段，基线上那条挡不住
/** 比对：它们实参里的对象字面量是期望值，写出来的键算读到（文件头第 2 条） */
export const COMPARE: ReadonlySet<string> = new Set(['eq', 'deepStrictEqual', 'deepEqual', 'strictEqual', 'equal'])

export interface FieldVerdict {
  /** 这个名字的处数比基线多的（基线上没有就是 0 处），按 `key` 排 */
  readonly fresh: readonly Field[]
  /** 新增里没用到、没有豁免的 */
  readonly unused: readonly Field[]
  /** 新增里没用到、有成立的豁免的 */
  readonly waived: readonly Field[]
  /** 新增里写了豁免标记却没写理由的（用没用到都算） */
  readonly unjustified: readonly Field[]
  readonly red: boolean
}

/**
 * 名字可能撞（重载、同判别值的联合成员……写法列不完），所以按处数比：`base` 每处一个名字，`now` 里这个名字的处数比它多就算新增，
 * 而且要每一处都用到（或那一处自己有豁免）才算过 —— 撞了名最坏是多报红，不会漏。新增里没用到的：有成立的豁免进 `waived`，否则进 `unused`。
 * 不成立的豁免（标记后面空着）只看新增的；任一处写了空理由就算不成立。`unused` 或 `unjustified` 非空就红。
 */
export function fieldVerdict(now: readonly Field[], base: readonly string[]): FieldVerdict {
  const tally = (keys: readonly string[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>()), before = tally(base), after = tally(now.map(f => f.key))
  const places = new Map<string, Field[]>()
  for (const f of now) places.set(f.key, [...(places.get(f.key) ?? []), f])
  // 每处各自判：没用到的每一处都要有自己的豁免，别处的不替它挡；任一处空理由就不成立（先后无关）
  const merged = [...places.values()].map(fs => {
    const idle = fs.filter(f => !f.used), waiver = fs.some(f => f.waiver === '') ? '' : idle.every(f => f.waiver !== undefined) ? idle[0]?.waiver : undefined
    const { waiver: _first, ...first } = fs[0] // 第一处自己的豁免不带过来，合起来的豁免只看上一行
    return { ...first, used: idle.length === 0, ...(waiver === undefined ? {} : { waiver }) }
  })
  const fresh = merged.filter(f => after.get(f.key)! > (before.get(f.key) ?? 0) || f.key.endsWith(INCOMPLETE)).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const unjustified = fresh.filter(f => f.waiver !== undefined && f.waiver.length === 0)
  const idle = fresh.filter(f => !f.used)
  const waived = idle.filter(f => f.waiver !== undefined && f.waiver.length > 0)
  const unused = idle.filter(f => f.waiver === undefined)
  return { fresh, unused, waived, unjustified, red: unused.length > 0 || unjustified.length > 0 }
}
