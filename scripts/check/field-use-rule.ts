/**
 * 字段断言闸门的**判定**（ADR-198）：检查链里一处判定的返回值多了一个字段，
 * 却没有任何一条测试碰过它 —— 这件事从 ADR-70 第 2050 行起一直靠评审器逐个核，没有机器。
 *
 * 三件事都在这里，因为三件都决定这道闸门看得见什么（`docs/CONVENTIONS.md` 第十节）：
 *
 * 1. **哪些是「字段」**（`fieldsOf`）：`scripts/check/` 下非验证者文件里，每个导出函数的返回类型
 *    逐层展开 —— 数组、元组、联合、交叉、索引签名（`Record`）、`Readonly`／`Partial` 这类映射；`Promise`、`Map`/`Set` 这类库里的泛型取类型参数 ——
 *    展开到的、**声明在这些文件里**的每一个属性。函数类型的属性本身算一个字段，它的返回值不展开（那是回调，不是数据）。
 *    一个字段的名字（`key`）从它的声明位置算，不从「走到它的路」算：文件 ＋ 往上每一层有名字的
 *    声明（接口、类型别名、函数、属性、变量），类型字面量若带一个取字符串字面量的属性（判别联合的 `kind`），
 *    记成 `{kind=…}`。所以新加一个函数、走到旧字段的路变了，旧字段的名字不变。
 * 2. **哪些算「用到」**（也在 `fieldsOf` 里）：验证者文件（`isVerifierFile` 认的那几种）里任一处
 *    —— 读属性（`.x`、`['x']`）、解构、按上下文类型对得上的对象字面量键（期望值写成那个类型），
 *    解析到这个声明上；或把**整个值**交给整体比对：`eq`、`assert`、`deepStrictEqual`、`JSON.stringify`，
 *    以及返回 `unknown`/`any` 的调用（`canon` 这类先规整再比的）的实参，它类型里的属性逐层都算碰到 ——
 *    加了字段、期望值没跟着改，整体比对自己就会失败。
 *    另有一条按名字的兜底：验证者自己重抄了一份类型（`await import(…) as unknown as { … }` 的黑盒写法），
 *    读到的声明落在那份重抄的类型里；这时只要这个验证者 import 了字段所在的那个文件、读的名字相同，也算。
 * 3. **哪些是「新增」、红不红**（`fieldVerdict`）：现在有、基线（`size-rule.ts` 的 `resolveBaseline` 定的起点）
 *    上没有这个名字的字段；没用到、又没有具名豁免的，红。豁免写在字段声明前面独占几行的注释里、或那一行行尾的注释里：
 *    `字段不入断言：<理由>`，理由必填；写了标记没写理由的照样红。HEAD 在主干上只报数（入口管）。
 *
 * ⚠️ 证不了的（ADR-198 第三节）：「碰到」不等于「断言了」—— 只拿来搭场景的一次读取也算；
 * 打印出来的文字不是字段；不导出的函数、返回 `any` 的函数看不见；整体比对的认法会把
 * 交给 `eq` 的值里每一层都记成碰到，哪怕期望值是从实现那边算出来的。
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

/** 声明往上每一层有名字的东西，接成字段的稳定名字 */
function keyOf(ts: typeof Ts, root: string, decl: Ts.Declaration): string {
  const parts: string[] = []
  for (let n: Ts.Node | undefined = decl; n !== undefined && !ts.isSourceFile(n); n = n.parent) {
    if (ts.isTypeLiteralNode(n)) {
      for (const m of n.members) {
        if (m === decl || !ts.isPropertySignature(m) || m.type === undefined) continue
        if (ts.isLiteralTypeNode(m.type) && ts.isStringLiteral(m.type.literal)) {
          parts.push(`{${m.name.getText()}=${m.type.literal.text}}`); break
        }
      }
      continue
    }
    const name = (n as { name?: Ts.Node }).name
    if (name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)))
      parts.push(name.text)
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
  const comments = [
    // 前导注释只收换行之后的：上一个字段行尾的那条 TypeScript 自己就不算进来
    ...(ts.getLeadingCommentRanges(text, decl.pos) ?? []),
    ...(ts.getTrailingCommentRanges(text, after) ?? []),
  ]
  for (const r of comments) {
    const comment = text.slice(r.pos, r.end)
    const at = comment.indexOf(FIELD_WAIVER)
    if (at >= 0) return comment.slice(at + FIELD_WAIVER.length).replace(/\*\/$/, '').trim()
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

  // ── 1. 字段 ──
  const found = new Map<Ts.Declaration, string>()
  const walk = (t: Ts.Type, via: string, seen: Set<Ts.Type>): void => {
    if (seen.has(t)) return
    seen.add(t)
    if (t.isUnion() || t.isIntersection()) { for (const u of t.types) walk(u, via, seen); return }
    if (tc.isArrayType(t) || tc.isTupleType(t)) {
      for (const a of tc.getTypeArguments(t as Ts.TypeReference)) walk(a, `${via}[]`, seen)
      return
    }
    if (!(t.flags & ts.TypeFlags.Object)) return
    if (fromLibrary(t)) for (const a of argumentsOf(t)) walk(a, `${via}<>`, seen)
    for (const info of tc.getIndexInfosOfType(t)) walk(info.type, `${via}[*]`, seen)
    for (const p of t.getProperties()) {
      for (const d of p.declarations ?? []) if (isJudgedFile(rel(d.getSourceFile())) && !found.has(d)) found.set(d, `${via}.${p.name}`)
      walk(tc.getTypeOfSymbol(p), `${via}.${p.name}`, seen)
    }
  }
  for (const sf of program.getSourceFiles()) {
    if (!isJudgedFile(rel(sf))) continue
    const module = tc.getSymbolAtLocation(sf)
    if (module === undefined) continue
    for (const exported of tc.getExportsOfModule(module)) {
      const s = exported.flags & ts.SymbolFlags.Alias ? tc.getAliasedSymbol(exported) : exported
      const decl = s.valueDeclaration
      if (decl === undefined) continue
      for (const sig of tc.getTypeOfSymbolAtLocation(s, decl).getCallSignatures()) {
        walk(tc.getReturnTypeOfSignature(sig), `${s.name}()`, new Set())
      }
    }
  }

  // ── 2. 用到 ──
  const used = new Set<Ts.Declaration>()
  /** 验证者文件 → 它 import 的文件（相对仓库根）；按名字的兜底用 */
  const imports = new Map<string, Set<string>>()
  /** 验证者文件 → 它读到、而声明落在它自己重抄的那份类型（`import(…) as … as { … }` 里的类型）里的属性名 */
  const localNames = new Map<string, Set<string>>()
  for (const sf of program.getSourceFiles()) {
    const self = rel(sf)
    if (!isVerifierFile(self)) continue
    const mine = new Set<string>(), names = new Set<string>()
    imports.set(self, mine); localNames.set(self, names)
    const dir = self.slice(0, self.lastIndexOf('/'))
    const imported = (spec: string) => {
      if (!spec.startsWith('.')) return
      const parts = `${dir}/${spec}`.split('/'), out: string[] = []
      for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p) }
      mine.add(out.join('/').replace(/\.js$/, '.ts'))
    }
    /**
     * 重抄的类型：断言的值剥掉括号、`await` 与里层的 `as` 以后是一个 `import(…)` 调用。
     * 从那份类型逐层走（属性、数组、联合、函数的返回值），走到的、声明在本文件里的属性都算重抄的 ——
     * 重抄常把形状另起成本文件里的类型别名再引用。
     */
    const copied = new Set<Ts.Declaration>()
    const copy = (t: Ts.Type, seen: Set<Ts.Type>): void => {
      if (seen.has(t)) return
      seen.add(t)
      if (t.isUnion() || t.isIntersection()) { for (const u of t.types) copy(u, seen); return }
      for (const a of argumentsOf(t)) copy(a, seen)
      if (fromLibrary(t)) return
      for (const sig of t.getCallSignatures()) copy(tc.getReturnTypeOfSignature(sig), seen)
      for (const p of t.getProperties()) {
        for (const d of p.declarations ?? []) if (d.getSourceFile() === sf) copied.add(d)
        copy(tc.getTypeOfSymbol(p), seen)
      }
    }
    const findCopies = (n: Ts.Node): void => {
      if (ts.isAsExpression(n)) {
        let inner: Ts.Expression = n.expression
        while (ts.isParenthesizedExpression(inner) || ts.isAwaitExpression(inner) || ts.isAsExpression(inner)) inner = inner.expression
        if (ts.isCallExpression(inner) && inner.expression.kind === ts.SyntaxKind.ImportKeyword) copy(tc.getTypeFromTypeNode(n.type), new Set())
      }
      ts.forEachChild(n, findCopies)
    }
    findCopies(sf)
    const mark = (s: Ts.Symbol | undefined): void => {
      for (const d of s?.declarations ?? []) {
        used.add(d)
        if (copied.has(d)) names.add(s!.name)
      }
    }
    const whole = (t: Ts.Type, seen: Set<Ts.Type>): void => {
      if (seen.has(t)) return
      seen.add(t)
      if (t.isUnion() || t.isIntersection()) { for (const u of t.types) whole(u, seen); return }
      if (tc.isArrayType(t) || tc.isTupleType(t)) { for (const a of tc.getTypeArguments(t as Ts.TypeReference)) whole(a, seen); return }
      if (!(t.flags & ts.TypeFlags.Object)) return
      if (fromLibrary(t)) for (const a of argumentsOf(t)) whole(a, seen)
      for (const info of tc.getIndexInfosOfType(t)) whole(info.type, seen)
      for (const p of t.getProperties()) { mark(p); whole(tc.getTypeOfSymbol(p), seen) }
    }
    const visit = (n: Ts.Node): void => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) imported(n.moduleSpecifier.text)
      else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword
        && n.arguments.length > 0 && ts.isStringLiteralLike(n.arguments[0])) imported(n.arguments[0].text)
      if (ts.isPropertyAccessExpression(n)) mark(tc.getSymbolAtLocation(n.name))
      else if (ts.isElementAccessExpression(n)) mark(tc.getSymbolAtLocation(n.argumentExpression))
      else if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent)) {
        const name = n.propertyName ?? n.name
        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) mark(tc.getTypeAtLocation(n.parent).getProperty(name.text))
      } else if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && ts.isObjectLiteralExpression(n.parent)) {
        const contextual = tc.getContextualType(n.parent)
        const name = n.name
        if (contextual !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)))
          for (const t of contextual.isUnion() ? contextual.types : [contextual]) mark(t.getProperty(name.text))
      } else if (ts.isCallExpression(n)) {
        const callee = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text
          : ts.isIdentifier(n.expression) ? n.expression.text : ''
        const opaque = (tc.getTypeAtLocation(n).flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any)) !== 0
        if (WHOLE_COMPARE.has(callee) || opaque) for (const a of n.arguments) whole(tc.getTypeAtLocation(a), new Set())
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  const byName = (file: string, name: string): boolean =>
    [...imports].some(([v, files]) => files.has(file) && localNames.get(v)!.has(name))

  return [...found].map(([decl, via]) => {
    const sf = decl.getSourceFile()
    const file = rel(sf)
    const name = (decl as { name?: Ts.Node }).name
    const text = name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : ''
    const waiver = waiverOf(ts, decl)
    return {
      key: keyOf(ts, root, decl), file, via,
      line: sf.getLineAndCharacterOfPosition(decl.getStart()).line + 1,
      used: used.has(decl) || byName(file, text),
      ...(waiver === undefined ? {} : { waiver }),
    }
  })
}

/** 整个值交给它们就算逐层碰到（文件头第 2 条） */
export const WHOLE_COMPARE: ReadonlySet<string> = new Set(['eq', 'assert', 'deepStrictEqual', 'stringify'])

export interface FieldVerdict {
  /** 现在有、基线上没有这个名字的，按 `key` 排 */
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
 * 新增 = `now` 里有、`base` 里没有这个 `key` 的字段。新增里没用到的：有成立的豁免进 `waived`，否则进 `unused`。
 * 不成立的豁免（标记后面空着）只看新增的 —— 旧字段上的不归这道闸门管。`unused` 或 `unjustified` 非空就红。
 * 同一个 `key` 出现多次（判别联合的不同成员里同名同判别值，少见）按一个算：任一处用到就算用到。
 */
export function fieldVerdict(now: readonly Field[], base: readonly string[]): FieldVerdict {
  const before = new Set(base)
  const merged = new Map<string, Field>()
  for (const f of now) {
    const had = merged.get(f.key)
    if (had === undefined) { merged.set(f.key, f); continue }
    const waiver = had.waiver ?? f.waiver
    merged.set(f.key, { ...had, used: had.used || f.used, ...(waiver === undefined ? {} : { waiver }) })
  }
  const fresh = [...merged.values()].filter(f => !before.has(f.key)).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const unjustified = fresh.filter(f => f.waiver !== undefined && f.waiver.length === 0)
  const idle = fresh.filter(f => !f.used)
  const waived = idle.filter(f => f.waiver !== undefined && f.waiver.length > 0)
  const unused = idle.filter(f => f.waiver === undefined)
  return { fresh, unused, waived, unjustified, red: unused.length > 0 || unjustified.length > 0 }
}
