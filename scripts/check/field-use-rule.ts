/**
 * 字段断言闸门的**判定**（ADR-198）：检查链里一处判定的返回值多了一个字段，
 * 却没有任何一条测试会因为它错了而变红 —— 这件事从 ADR-70 第二节第①条那张欠条起一直靠评审器逐个核，没有机器。
 *
 * 字段不按名字认，按**位置**认（名字会撞，位置不会）。三件事都在这里，因为三件都决定这道闸门看得见什么（`docs/CONVENTIONS.md` 第十节）：
 *
 * 1. **哪些是「字段」**（`fieldsOf`）：`scripts/check/` 下非验证者文件里，每个导出函数的返回类型
 *    逐层展开 —— 数组、元组、联合、交叉、索引签名（`Record`）、`Readonly`／`Partial` 这类映射；`Promise`、`Map`/`Set` 这类库里的泛型取类型参数 ——
 *    展开到的、**声明在这些文件里**的每一个属性，一处声明一个字段。函数类型的属性本身算一个字段，它的返回值不展开（那是回调，不是数据）。
 *    每个字段还带着**给它赋值的那几处**（`sites`）：对象字面量里写它的那一项（简写也算，方法简写不算）、`x.f = …`、`x['f'] += …` 这类赋值。哪一处给哪个字段赋值，
 *    问 TypeScript 的「跳到定义」（编辑器里同一个功能），交回的恰好一个、而且是字段才认；交回几个的（没分开的联合）不算任何一个的。
 * 2. **哪些算「测到了」**：**不读测试源码去猜**。变异登记表（`scripts/check/mutations.json`）里有一条变异，它要改的那段源码
 *    （`find` 在文件里只出现一次，位置是确定的；`find` 与 `replace` 相同的开头结尾不算改动）和这个字段的某一处赋值重叠 —— 变异跑（`npm run mutate`）本来就要求每条变异都被测试打红，
 *    所以重叠就等于「把这个字段的值改坏，有测试会红」。
 * 3. **哪些是「新增」、红不红**（`fieldVerdict`）：字段声明所在的那一行，是这次改动相对基线（`size-rule.ts` 的 `resolveBaseline` 定的起点）
 *    新加的行（`addedLines` 读每个文件各自的 `git diff -U0` 块头）。新增的字段没有变异守着、又没有具名豁免的，红。豁免写在字段声明前面独占几行的注释里、或那一行行尾的注释里：
 *    `字段不入断言：<理由>`，理由必填；写了标记没写理由的照样红。HEAD 在主干上只报数（入口管）。
 *
 * ⚠️ 证不了的（ADR-198 第三节）：变异改到了赋值那一处，改坏的是不是这个字段的值、还是只改了旁边的东西，不核；打印出来的文字不是字段；
 * 不导出的函数、返回 `any` 的函数看不见；只挪了位置、改了格式的旧字段也算新增（多报红）。
 *
 * 纯函数，不读文件、不起进程：语言服务（`ts.LanguageService`，读文件的是调用方交进来的那个宿主）、改动与变异的位置由入口准备好交进来。
 * `typescript` 按需加载，同 `mutate-rule.ts`（只 import 本模块的验证者不必为它付编译器的加载时间）。
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

/** 一段源码：文件（相对仓库根、用 `/`）与 [start, end) 字符位置 */
export interface Site { readonly file: string; readonly start: number; readonly end: number }

export interface Field {
  readonly file: string
  /** 声明里属性名那一行，从 1 起；「新增」按它是不是这次加的行判 */
  readonly line: number
  /** 第一次走到它的那条路，只为打印：`函数()[].属性` */
  readonly via: string
  /** 给它赋值的那几处（见文件头第 1 条）；变异要和其中一处重叠才算守着它 */
  readonly sites: readonly Site[]
  /** 找字段展开到上限停下的导出函数记的那一条：里面可能还有字段没找到，没有赋值处，变异守不了，而且不论哪一行改没改、每次都判 */
  readonly cut?: true
  /** 没有豁免标记时缺席；有标记时是理由（可能是空串 —— 那是不成立的豁免） */
  readonly waiver?: string
}

const relOf = (root: string, fileName: string): string =>
  fileName.startsWith(root + '/') ? fileName.slice(root.length + 1) : fileName

/**
 * 字段的豁免：声明前面独占几行的注释里，或声明那一行行尾的注释里（行注释与块注释都认）。
 * 缺席 = 没写标记；空串 = 写了标记没写理由。上一个字段行尾的注释是它自己的，不漏到下一个字段上；
 * 字符串里的标记不算（只读注释）。
 */
function waiverOf(ts: typeof Ts, decl: Ts.Declaration): string | undefined {
  const sf = decl.getSourceFile(), text = sf.text
  const head = ts.isVariableDeclaration(decl) && ts.isVariableStatement(decl.parent.parent) ? decl.parent.parent : decl // `export const f = () => …` 的豁免写在整句前面
  const after = text[decl.end] === ',' ? decl.end + 1 : decl.end
  // 前导注释只收换行之后的：上一个字段行尾的那条 TypeScript 自己就不算进来
  const comments = [...(ts.getLeadingCommentRanges(text, head.pos) ?? []), ...(ts.getTrailingCommentRanges(text, after) ?? [])]
  for (const r of comments) {
    const comment = text.slice(r.pos, r.end)
    const at = comment.indexOf(FIELD_WAIVER)
    if (at >= 0) return comment.slice(at + FIELD_WAIVER.length).replace(/\*\/$/, '').replace(/^\s*\*+/gm, '').trim()
  }
  return undefined
}

const fromLibrary = (t: Ts.Type): boolean =>
  (t.symbol?.declarations ?? []).some(d => /[\\/]node_modules[\\/]/.test(d.getSourceFile().fileName))

/** 声明的名字那个节点（属性名）；没有名字的给声明本身 */
const nameNode = (decl: Ts.Node): Ts.Node => (decl as { name?: Ts.Node }).name ?? decl

/**
 * 字段的全集，连同豁免与赋值处。`root` 是仓库根的绝对路径（程序里的文件名以它开头）。
 * 判定见文件头第 1 条。
 */
export function fieldsOf(service: Ts.LanguageService, root: string): Field[] {
  const ts = typescript()
  const program = service.getProgram()!
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

  // ── 2. 赋值处 ──
  // 字段按它的名字节点认：「跳到定义」交回的是名字那一段的位置
  const fields = [...found.keys()].filter(d => !cut.has(d))
  const at = (d: Ts.Node): string => `${d.getSourceFile().fileName}\0${nameNode(d).getStart()}`
  const byName = new Map(fields.map(d => [at(d), d]))
  // 先按名字粗筛、省掉大多数「跳到定义」：比的是解析后的名字（`'f'`、`` `f` ``、`\u0066` 都是 f），源码原文里的引号与转义不算；算出来的名字（`[k]`）照原文
  const key = (n: Ts.Node): string => ts.isIdentifier(n) || ts.isPrivateIdentifier(n) || ts.isStringLiteralLike(n) || ts.isNumericLiteral(n) ? n.text : n.getText()
  const names = new Set(fields.map(d => key(nameNode(d))))
  const sites = new Map<Ts.Declaration, Site[]>()
  const visit = (sf: Ts.SourceFile, n: Ts.Node): void => {
    let name: Ts.Node | undefined
    if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) name = n.name // 方法简写 `{ run() {…} }` 不算：没有赋值处，宁可多报红
    else if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      name = ts.isPropertyAccessExpression(n.left) ? n.left.name : ts.isElementAccessExpression(n.left) && ts.isStringLiteralLike(n.left.argumentExpression) ? n.left.argumentExpression : undefined
    }
    if (name !== undefined && names.has(key(name))) {
      // 简写 `{ n }` 的「跳到定义」还会交回变量 `n` 自己，那一个不算；剩下的要恰好一个，而且是字段 —— 先数、后筛，跳到一个字段加一个别的（lib 下的、不导出的）也不算
      const value = new Set(ts.isShorthandPropertyAssignment(n) ? (tc.getShorthandAssignmentValueSymbol(n)?.declarations ?? []).map(at) : [])
      const defs = new Set((service.getDefinitionAtPosition(sf.fileName, name.getStart()) ?? []).map(d => `${d.fileName}\0${d.textSpan.start}`).filter(k => !value.has(k)))
      const d = byName.get(at(n)) ?? (defs.size === 1 ? byName.get([...defs][0]) : undefined) // 推断出来的字面量里，这一项自己就是字段声明
      if (d !== undefined) sites.set(d, [...(sites.get(d) ?? []), { file: rel(sf), start: n.getStart(), end: n.end }])
    }
    ts.forEachChild(n, c => visit(sf, c))
  }
  for (const sf of program.getSourceFiles()) if (!sf.isDeclarationFile && !/[\\/]node_modules[\\/]/.test(sf.fileName) && !isVerifierFile(rel(sf))) visit(sf, sf)

  return [...found].map(([decl, via]): Field => {
    const sf = decl.getSourceFile()
    const waiver = waiverOf(ts, decl)
    return {
      file: rel(sf), via, line: sf.text.slice(0, nameNode(decl).getStart()).split('\n').length, // 按 git 的算法数行：只认换行符；TypeScript 自己还把单独的回车、U+2028／U+2029 当换行，跟 git 的行号对不上
      sites: sites.get(decl) ?? [],
      ...(cut.has(decl) ? { cut: true as const } : {}),
      ...(waiver === undefined ? {} : { waiver }),
    }
  })
}

export const DEPTH = 16, BUDGET = 2000 // 找字段往下展开的上限：层数（每走一步——属性、元素、联合成员、类型实参……——算一层；在提交 9e1fd00 的树上量，最深 7 层、一次从头走最多 77 步，留一倍余量；量法见 ADR-198 第四节）与一次从头走总共展开的步数（多路递归每层分叉，层数没到也会指数爆）

/**
 * 一条变异真正改动的那一段的位置：`find` 在文件里恰好出现一次才有位置（变异跑本来就这样要求），否则给 undefined。
 * `find` 与 `replace` 相同的开头和结尾不算改动，去掉；只插入、不删字的变异剩下一个空段（`start === end`），落在插入点上。
 */
export function markSite(file: string, text: string, find: string, replace: string): Site | undefined {
  const start = text.indexOf(find)
  if (start < 0 || text.indexOf(find, start + 1) >= 0) return undefined
  let head = 0, tail = 0
  while (head < find.length && head < replace.length && find[head] === replace[head]) head++
  while (tail < find.length - head && tail < replace.length - head && find[find.length - 1 - tail] === replace[replace.length - 1 - tail]) tail++
  return { file, start: start + head, end: start + find.length - tail }
}

/**
 * 这次新加的行：交回「文件 → 新加的行号（从 1 起）」。文件名与改动文本都由 git 交出，这里不解析文件名、也不逐行数正文：
 * - 文件名由入口用 `git diff --name-only -z` 列出（空字符分隔，git 不加引号、不转义），原样作键；
 * - 每个文件各问一次 `git diff -U0 … -- <文件>`，值就是它的输出。`-U0` 下块里没有上下文行，块头 `@@ -a,b +c,d @@` 写的新文件那一边
 *   第 c 行起的 d 行（d 省略时为 1）就是这一块新加的行；d 为 0 的块只删不加。统一 diff 格式里正文每行都带一个前缀字符（`+`、`-`、空格、`\`），
 *   所以以 `@@` 开头的行一定是块头。
 * 读不懂的抛错（入口报「无从判断」、红）：输出不以 `diff --git ` 开头（带颜色的、外部 diff 工具的；答空的也算 —— 列出来的文件一定有输出，
 *   只改权限的也有文件头、删掉的有一个只删的块，答空说明路径没对上，不能当成没改），以 `@@` 开头的行不是块头的样子，
 * 或 git 把它当成二进制文件（文件里有空字节、`.gitattributes` 写了 `-diff`；入口带 `--text`，仍这样说就红，不当成没改）。
 * 带了上下文行（没用 `-U0`）时上下文行也会算成新加的 —— 只会多报红。
 */
export function addedLines(diffs: Iterable<readonly [string, string]>): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>()
  for (const [file, diff] of diffs) {
    if (!diff.startsWith('diff --git ')) throw new Error(`读不懂的 diff：${file} 的输出不以「diff --git 」开头${diff === '' ? '（git 把它列在改过的文件里，单问它却答空）' : ''}`)
    for (const l of diff.split('\n')) {
      if (l.startsWith('Binary files ')) throw new Error(`读不懂的 diff：${file} 被 git 当成二进制文件，改了哪几行说不出来`)
      if (!l.startsWith('@@')) continue
      const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(l)
      if (h === null) throw new Error(`读不懂的 diff 块头：${file}：${JSON.stringify(l)}`)
      const from = Number(h[1]), count = h[2] === undefined ? 1 : Number(h[2])
      for (let n = from; n < from + count; n++) out.set(file, (out.get(file) ?? new Set()).add(n))
    }
  }
  return out
}

/** 还没加进 git 的文件整份算新加：第 1 行到最后一行（行号与 `fieldsOf` 同一算法，只数换行符，末尾换行后的空段也算一行） */
export function wholeFile(text: string): Set<number> {
  return new Set(Array.from({ length: text.split('\n').length }, (_, i) => i + 1))
}

/**
 * 类型检查范围里的一个判定文件，git 对它说的行号能不能用：不能用时交回为什么（入口报「无从判断」、红），能用交回 undefined。
 * - git 看不见它（被忽略了，或名字两边写法不一样）：它的改动列不出来，里面的字段永远不算新；
 * - 它是符号链接：git 的 diff 只有链接指向的那一行，TypeScript 读的却是指向的文件，两边的行号对不上。
 * `symlink` 只在 git 看得见时才问。
 */
export function outOfSight(file: string, seen: boolean, symlink: () => boolean): string | undefined {
  if (!seen) return `${file} 在类型检查的范围里，git 却看不见它（被忽略了，或名字两边写法不一样）`
  if (symlink()) return `${file} 是一个符号链接：git 说的是链接本身改了哪几行，字段却在它指向的文件里，行号对不上`
  return undefined
}

export interface FieldVerdict {
  /** 声明那一行是这次新加的（或是「没展开完」那一条），按文件、行号排 */
  readonly fresh: readonly Field[]
  /** 新增里没有变异守着、没有豁免的 */
  readonly unmarked: readonly Field[]
  /** 新增里没有变异守着、靠成立的豁免放行的 */
  readonly waived: readonly Field[]
  /** 新增里写了豁免标记却没写理由的（有没有变异都算） */
  readonly unjustified: readonly Field[]
  readonly red: boolean
}

/**
 * `added` 是 `addedLines` 交回的；`marks` 是每条变异真正改动的那一段的位置（`markSite`）。
 * 守着 = 有一条变异的那段和这个字段的一处赋值重叠。一个字段一处声明，豁免只管它自己，同名的别处挡不了它。
 * `unmarked` 或 `unjustified` 非空就红。
 */
export function fieldVerdict(now: readonly Field[], added: ReadonlyMap<string, ReadonlySet<number>>, marks: readonly Site[]): FieldVerdict {
  const fresh = now.filter(f => f.cut === true || added.get(f.file)?.has(f.line) === true)
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line))
  // 重叠：两段有公共的字（挨着的不算）；只插入的空段，同一个式子就是插入点落在赋值处里面、不在两头
  const held = (f: Field): boolean => f.sites.some(s => marks.some(m => m.file === s.file && m.start < s.end && s.start < m.end))
  const blank = (f: Field): boolean => f.waiver !== undefined && f.waiver.trim() === ''
  const unjustified = fresh.filter(blank)
  const unmarked = fresh.filter(f => f.waiver === undefined && !held(f))
  const waived = fresh.filter(f => f.waiver !== undefined && !blank(f) && !held(f))
  return { fresh, unmarked, waived, unjustified, red: unmarked.length > 0 || unjustified.length > 0 }
}
