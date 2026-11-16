/**
 * 字段断言闸门的**判定**（ADR-198）：检查链里一处判定的返回值多了一个字段，
 * 却没有任何一条测试会因为它错了而变红 —— 这件事从 ADR-70 第二节第①条那张欠条起一直靠评审器逐个核，没有机器。
 *
 * 三件事都在这里，因为三件都决定这道闸门看得见什么（`docs/CONVENTIONS.md` 第十节）：
 *
 * 1. **哪些是「字段」**（`fieldsOf`）：`scripts/check/` 下非验证者文件里，每个导出函数的返回类型
 *    逐层展开 —— 数组、元组、联合、交叉、索引签名（`Record`）、`Readonly`／`Partial` 这类映射；`Promise`、`Map`/`Set` 这类库里的泛型取类型参数 ——
 *    展开到的、**声明在这些文件里**的每一个属性。函数类型的属性本身算一个字段，它的返回值不展开（那是回调，不是数据）。
 *    一个字段的名字（`key`）从它的声明位置算，不从「走到它的路」算：文件 ＋ 往上每一层有名字的
 *    声明（接口、类型别名、函数、属性、变量；数字名与计算属性名也算名字），类型字面量若带一个取字符串字面量的属性（判别联合的 `kind`），
 *    记成 `{kind=…}`；推断出来的对象字面量同理，看那个属性推出来的类型是不是字符串字面量（`'a' as const`）。所以新加一个函数、走到旧字段的路，旧字段的名字不变。
 * 2. **哪些算「测到了」**（`fieldVerdict` 的第三个参数）：**不读测试源码去猜**。变异登记表（`scripts/check/mutations.json`）里
 *    有一条变异用 `field` 写明它弄坏的是这个字段（写这个字段的名字 `key`），而且它的 `find` 里写得到这个字段自己的名字（前后不接别的标识符字符，`ok` 不算写在 `token` 里）——
 *    变异跑（`npm run mutate`）本来就要求每条变异都被测试打红，所以登记了就等于有测试会因为这个字段错了而变红。
 *    读到了不等于断言了，这一条判的是「改坏了有没有测试红」，不是「有没有测试碰过」。
 * 3. **哪些是「新增」、红不红**（`fieldVerdict`）：名字的处数比基线（`size-rule.ts` 的 `resolveBaseline` 定的起点）
 *    上多的（撞名照样数得出来）；登记的变异不够、又没有具名豁免的，红。豁免写在字段声明前面独占几行的注释里、或那一行行尾的注释里：
 *    `字段不入断言：<理由>`，理由必填；写了标记没写理由的照样红。HEAD 在主干上只报数（入口管）。
 *
 * ⚠️ 证不了的（ADR-198 第三节）：变异弄坏的是不是**这个**字段，只核到 `find` 里有这个名字为止；打印出来的文字不是字段；
 * 不导出的函数、返回 `any` 的函数看不见。
 *
 * 纯函数，不读文件、不起进程：程序（`ts.Program`）与变异登记由入口读好交进来。`typescript` 按需加载，
 * 同 `mutate-rule.ts`（只 import 本模块的验证者不必为它付编译器的加载时间）。
 */
import { createRequire } from 'node:module'
import type * as Ts from 'typescript'

let compiler: typeof Ts | undefined
const typescript = (): typeof Ts => compiler ??= createRequire(import.meta.url)('typescript') as typeof Ts

/** 豁免标记：写在字段声明前面独占几行的注释里、或那一行行尾的注释里，后面跟理由 */
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
  /** 字段自己的名字（属性名），变异的 `find` 里要写得到它；「没展开完」那一条没有 */
  readonly name?: string
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
 * 字段的全集，连同有没有豁免。`root` 是仓库根的绝对路径（程序里的文件名以它开头）。
 * 判定见文件头第 1 条。
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
  // `cut`：找字段时展开到上限停下的导出函数 —— 里面可能还有字段没找到，记成这个函数名下一个变异守不了的「字段」，照新增字段报红（可在函数前写豁免）
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

  return [...found].map(([decl, via]) => {
    const sf = decl.getSourceFile()
    const file = rel(sf)
    const waiver = waiverOf(ts, decl)
    return {
      key: `${keyOf(ts, tc, root, decl)}${cut.has(decl) ? INCOMPLETE : ''}`, file, via,
      line: sf.getLineAndCharacterOfPosition(decl.getStart()).line + 1,
      ...(cut.has(decl) ? {} : { name: nameOf(ts, decl) }),
      ...(waiver === undefined ? {} : { waiver }),
    }
  })
}

export const DEPTH = 16, BUDGET = 2000 // 找字段往下展开的上限：层数（每走一步——属性、元素、联合成员、类型实参……——算一层；在提交 9e1fd00 的树上量，最深 7 层、一次从头走最多 77 步，留一倍余量；量法见 ADR-198 第四节）与一次从头走总共展开的步数（多路递归每层分叉，层数没到也会指数爆）
export const INCOMPLETE = '<没展开完>' // 找字段展开到上限停下的函数记的那一条的名字尾巴：不按基线比、每次都判 —— 停下的地方里面加了字段，基线上那条挡不住
/** 变异登记表里的一条，闸门只看这两样：它说自己弄坏哪个字段（`field`，写字段的 `key`），和它要找的那段源码 */
export interface FieldMark { readonly field?: string; readonly find: string }

export interface FieldVerdict {
  /** 这个名字的处数比基线多的（基线上没有就是 0 处），按 `key` 排 */
  readonly fresh: readonly Field[]
  /** 新增里登记的变异不够、没有豁免的 */
  readonly unmarked: readonly Field[]
  /** 新增里登记的变异不够、靠成立的豁免放行的 */
  readonly waived: readonly Field[]
  /** 新增里写了豁免标记却没写理由的（有没有变异都算） */
  readonly unjustified: readonly Field[]
  readonly red: boolean
}

/**
 * 名字可能撞（重载、同判别值的联合成员……写法列不完），所以按处数比：`base` 每处一个名字，`now` 里这个名字的处数比它多就算新增。
 * 一个名字的变异按条数算：没写豁免的那几处，每处要有一条 `field` 写着这个名字、`find` 里写得到字段名的变异 ——
 * 分不出哪条变异守哪一处，所以只数条数；撞了名最坏是多报红，不会漏。条数够的过；不够时，几处里有一处空理由就只进 `unjustified`；
 * 否则没写豁免的那几处条数够、靠豁免放行的进 `waived`，再不够的进 `unmarked`。不成立的豁免（标记后面空着）只看新增的；任一处写了空理由就算不成立。`unmarked` 或 `unjustified` 非空就红。
 * 「没展开完」那一条（`INCOMPLETE`）没有字段名，变异守不了，只认豁免，而且不按基线比、每次都判。
 */
/** `find` 里写到了这个属性名：前后不能再接标识符的字符（`ok` 不算写在 `token` 里）；空名字算没写到 */
function writes(find: string, name: string): boolean {
  if (name === '') return false
  const at = (i: number) => i >= 0 && i < find.length && /[\p{ID_Continue}$]/u.test(find[i])
  for (let i = find.indexOf(name); i >= 0; i = find.indexOf(name, i + 1)) if (!at(i - 1) && !at(i + name.length)) return true
  return false
}

export function fieldVerdict(now: readonly Field[], base: readonly string[], marks: readonly FieldMark[]): FieldVerdict {
  const tally = (keys: readonly string[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>()), before = tally(base), after = tally(now.map(f => f.key))
  const places = new Map<string, Field[]>()
  for (const f of now) places.set(f.key, [...(places.get(f.key) ?? []), f])
  const blank = (f: Field): boolean => f.waiver !== undefined && f.waiver.trim() === ''
  const judged = [...places.values()].map(fs => {
    const name = fs[0].name, open = fs.filter(f => f.waiver === undefined)
    const held = name === undefined ? 0 : marks.filter(m => m.field === fs[0].key && writes(m.find, name)).length
    const state = held >= fs.length ? 'marked' as const : fs.some(blank) ? 'bare' as const : held < open.length ? 'unmarked' as const : 'waived' as const // 有空理由的先判，只进 unjustified
    // 报出来的是该看的那一处：缺变异的报没写豁免的那处，靠豁免放行的报写了豁免的那处；几处里有一处空理由，就带空理由
    const at = (state === 'unmarked' ? open.at(0) : fs.find(f => f.waiver !== undefined)) ?? fs[0], { waiver: _own, ...place } = at
    const waiver = fs.some(blank) ? '' : at.waiver
    return { field: { ...place, ...(waiver === undefined ? {} : { waiver }) }, state }
  })
  const fresh = judged.filter(({ field: f }) => after.get(f.key)! > (before.get(f.key) ?? 0) || f.key.endsWith(INCOMPLETE))
    .sort((a, b) => (a.field.key < b.field.key ? -1 : a.field.key > b.field.key ? 1 : 0))
  const unjustified = fresh.filter(j => j.field.waiver === '').map(j => j.field)
  const unmarked = fresh.filter(j => j.state === 'unmarked').map(j => j.field)
  const waived = fresh.filter(j => j.state === 'waived').map(j => j.field)
  return { fresh: fresh.map(j => j.field), unmarked, waived, unjustified, red: unmarked.length > 0 || unjustified.length > 0 }
}
