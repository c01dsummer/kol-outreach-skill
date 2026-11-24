/**
 * 查有没有人绕开变异目录的读取函数（ADR-242）：需求测试 `h-catalog-door` 拿真树上的源码交给 `catalogDoorFaults`，交回非空就红。
 *
 * **怎么认**（只看语法树，确切回答，不猜实参）：
 * 1. 变异目录的文件名 `mutations.json` 出现在字符串字面量或模板串的任何一段里 —— 只许写在 `catalog-rule.ts`。
 *    注释不算（语法树上没有注释节点）。
 * 2. 引用了读取函数所在模块（`catalog-rule`）的文件 —— 按名字导入、整个模块导入、`import()`、`require`、转出都算，
 *    只带类型的导入与转出（整句只带类型、或每个名字都只带类型）不算 —— 同一个文件里要真调用那个模块里的 `readCatalog`：
 *    调的是不是它问编译器（`readerCallers`），不按名字认。拿了位置去读，就得经读取函数判。
 * 两条都由 `NOT_READERS` 逐个放行：那几处碰到这个名字，但不读目录里的变异。
 *
 * **不扫的**：测试文件（`isTestFile`）—— 它们写夹具目录、或拿真目录做测试的输入，不是检查链读目录拿去判。
 * **认不出的**：拆开拼的文件名（`'mutations' + '.json'`）、从环境变量或参数传进来的路径、读目录的 shell
 * （工作流里那一行 `jq` 只数条数，不读编号）；一个文件里调了 `readCatalog`、另一处又拿位置自己读（要看数据怎么流，
 * 语法树答不了）；拆开拼的模块名。这几种仍靠评审。
 */
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type * as Ts from 'typescript'

let compiler: typeof Ts | undefined
const typescript = (): typeof Ts => compiler ??= createRequire(import.meta.url)('typescript') as typeof Ts

/** 读取函数所在的文件：文件名只许写在这里 */
export const DOOR = 'scripts/check/catalog-rule.ts'
/** 变异目录的文件名：任何字面量里带着它就算提到了 */
export const CATALOG_NAME = 'mutations.json'

/** 碰到这个名字、但不读目录里变异的文件，逐个写理由 */
export const NOT_READERS: Readonly<Record<string, string>> = {
  'scripts/check/catalog-door-rule.ts': '这道检查自己：要按这个文件名去认',
  'scripts/check/claims.ts': '只算目录文件的指纹，不读里面的变异',
  'scripts/check/size-rule.ts': '只按路径把目录归进「测试」那一类算体量，不读文件',
  'scripts/check/shard-load-rule.ts': '只核工作流里那一行数条数的命令写没写对，不读文件',
}

/** 测试文件：需求测试、脚本自检、各个 `*-test.ts` */
export function isTestFile(path: string): boolean {
  return path === 'scripts/test.ts' || path === 'scripts/check/selfcheck.ts' || path.endsWith('-test.ts')
}

/** 读取函数所在模块的说明符：`./catalog-rule.js`、`../check/catalog-rule.ts`、不带扩展名的都认 */
const DOOR_SPECIFIER = /(^|\/)catalog-rule(\.[cm]?[jt]s)?$/

/** 一个文件里提到文件名的那几行（行号从 1 起）、有没有引用读取函数所在模块 —— 都按语法树字面认 */
function scan(path: string, text: string): { mentions: number[]; refsDoor: boolean } {
  const ts = typescript()
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const mentions: number[] = []
  let refsDoor = false
  const isDoor = (node: Ts.Node | undefined): boolean =>
    node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && DOOR_SPECIFIER.test(node.text)
  const visit = (node: Ts.Node): void => {
    const piece = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.text : undefined
    if (piece !== undefined && piece.includes(CATALOG_NAME)) {
      mentions.push(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1)
    }
    if (ts.isImportDeclaration(node) && isDoor(node.moduleSpecifier)) {
      const clause = node.importClause
      // 只为副作用导入（没有导入子句）也算引用；整句只带类型、或每个名字都只带类型的不算
      if (clause === undefined || (!clause.isTypeOnly && clause.name !== undefined)) refsDoor = true
      const named = clause === undefined || clause.isTypeOnly ? undefined : clause.namedBindings
      if (named !== undefined && (ts.isNamespaceImport(named) || named.elements.some(el => !el.isTypeOnly))) refsDoor = true
    }
    if (ts.isExportDeclaration(node) && isDoor(node.moduleSpecifier) && !node.isTypeOnly
      && (node.exportClause === undefined || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(el => !el.isTypeOnly))) refsDoor = true
    if (ts.isCallExpression(node)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      && isDoor(node.arguments[0])) refsDoor = true
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return { mentions, refsDoor }
}

/**
 * 引用了读取函数所在模块的那几个文件里，哪些真调用了读取函数 —— 问编译器，不按名字认（ADR-242，CodeRabbit 第一轮后改的设计）：
 * 把这几个文件连同读取函数所在的文件编成一个程序，凡是写成读取函数所在模块的说明符都解析到那个文件，
 * 每一处调用问编译器「这一处调的是哪个函数声明」，是 `catalog-rule.ts` 里的 `readCatalog` 才算。
 * 改名、经模块对象、动态导入、解构出来再调都由编译器顺着值走到；同名的本地函数、参数、别的对象上的同名方法都不是那个声明。
 * 读取函数所在的文件不在这组文件里时，谁都调不到它。
 */
function readerCallers(files: readonly { path: string; text: string }[], door: string | undefined): Set<string> {
  const ts = typescript()
  const sources = new Map(files.map(f => [f.path, f.text]))
  if (door !== undefined) sources.set(DOOR, door)
  const libDir = dirname(ts.getDefaultLibFilePath({}))
  const host: Ts.CompilerHost = {
    getSourceFile: (name, target) => {
      const text = sources.get(name) ?? (name.startsWith(libDir) ? ts.sys.readFile(name) : undefined)
      return text === undefined ? undefined : ts.createSourceFile(name, text, target, true)
    },
    getDefaultLibFileName: o => ts.getDefaultLibFilePath(o), writeFile: () => {}, getCurrentDirectory: () => '',
    getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
    fileExists: f => sources.has(f) || (f.startsWith(libDir) && ts.sys.fileExists(f)), readFile: f => sources.get(f),
    // 只解析读取函数所在模块那一种说明符；别的模块一概不解析（编译器把它们当未知，不影响判这一处调的是谁）
    resolveModuleNameLiterals: literals => literals.map(l => ({
      resolvedModule: door !== undefined && DOOR_SPECIFIER.test(l.text) ? { resolvedFileName: DOOR, extension: ts.Extension.Ts } : undefined,
    })),
  }
  const program = ts.createProgram([...files.map(f => f.path), ...(door === undefined ? [] : [DOOR])],
    { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, lib: ['lib.es2022.d.ts'], allowJs: true, types: [], noEmit: true }, host)
  const checker = program.getTypeChecker()
  const isReader = (decl: Ts.Declaration | undefined): boolean => decl !== undefined && ts.isFunctionDeclaration(decl)
    && decl.name?.text === 'readCatalog' && decl.getSourceFile().fileName === DOOR
  const callers = new Set<string>()
  for (const { path } of files) {
    const tree = program.getSourceFile(path)
    if (tree === undefined) continue
    const visit = (node: Ts.Node): void => {
      if (ts.isCallExpression(node) && isReader(checker.getResolvedSignature(node)?.declaration as Ts.Declaration | undefined)) callers.add(path)
      if (!callers.has(path)) ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  return callers
}

/**
 * 判一组源码文件（路径从仓库根写起）。交回每一处毛病一行；没有毛病交空数组。
 * `NOT_READERS` 里列了、却不在这组文件里的，也报：放行名单只许越来越准。
 */
export function catalogDoorFaults(files: readonly { path: string; text: string }[]): string[] {
  const faults: string[] = []
  const seen = new Set<string>()
  const referring: { path: string; text: string }[] = []
  for (const { path, text } of files) {
    seen.add(path)
    if (path === DOOR || isTestFile(path) || Object.hasOwn(NOT_READERS, path)) continue
    const found = scan(path, text)
    for (const line of found.mentions) {
      faults.push(`${path} 第 ${line} 行：直接写了变异目录的文件名，要读就从 catalog-rule.ts 导入位置并经 readCatalog 读`)
    }
    if (found.refsDoor) referring.push({ path, text })
  }
  const callers = referring.length === 0 ? new Set<string>() : readerCallers(referring, files.find(f => f.path === DOOR)?.text)
  for (const { path } of referring) {
    if (!callers.has(path)) faults.push(`${path}：引用了读取函数所在的模块，却没调用 readCatalog —— 读目录要经读取函数判`)
  }
  for (const path of Object.keys(NOT_READERS)) {
    if (!seen.has(path)) faults.push(`${path}：在放行名单里，却不在要扫的文件里`)
  }
  return faults
}
