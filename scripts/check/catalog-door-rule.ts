/**
 * 查有没有人绕开变异目录的读取函数（ADR-242）：需求测试 `h-catalog-door` 拿真树上的源码交给 `catalogDoorFaults`，交回非空就红。
 *
 * **怎么认**（只看语法树，确切回答，不猜实参）：
 * 1. 变异目录的文件名 `mutations.json` 出现在字符串字面量或模板串的任何一段里 —— 只许写在 `catalog-rule.ts`。
 *    注释不算（语法树上没有注释节点）。
 * 2. 引用了读取函数所在模块（`catalog-rule`）的文件 —— 按名字导入、整个模块导入、`import()`、`require`、转出都算，
 *    只带类型的导入与转出（整句只带类型、或每个名字都只带类型）不算 —— 同一个文件里要真调用那个模块里的 `readCatalog`
 *    （按名字、改了名、经模块对象调、从动态导入解构出来的都认；同名的本地函数、别的对象上的同名方法不认）：拿了位置去读，就得经读取函数判。
 * 两条都由 `NOT_READERS` 逐个放行：那几处碰到这个名字，但不读目录里的变异。
 *
 * **不扫的**：测试文件（`isTestFile`）—— 它们写夹具目录、或拿真目录做测试的输入，不是检查链读目录拿去判。
 * **认不出的**：拆开拼的文件名（`'mutations' + '.json'`）、从环境变量或参数传进来的路径、读目录的 shell
 * （工作流里那一行 `jq` 只数条数，不读编号）；一个文件里调了 `readCatalog`、另一处又拿位置自己读（要看数据怎么流，
 * 语法树答不了）；拆开拼的模块名。这几种仍靠评审。
 */
import { createRequire } from 'node:module'
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

/** 一个文件里提到文件名的那几行（行号从 1 起）、有没有引用读取函数所在模块、有没有调用读取函数 */
function scan(path: string, text: string): { mentions: number[]; refsDoor: boolean; callsReader: boolean } {
  const ts = typescript()
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const mentions: number[] = []
  let refsDoor = false
  // 指向读取函数的本地名字（从读取函数所在模块按名字导入、或从它的模块对象解构出来的），与指向那个模块对象的本地名字
  const readerNames = new Set<string>()
  const moduleNames = new Set<string>()
  const calls: Ts.CallExpression[] = []
  const isDoor = (node: Ts.Node | undefined): boolean =>
    node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && DOOR_SPECIFIER.test(node.text)
  // 去掉外层的括号与 await：`(await import(…)).readCatalog` 里的接收者就是那次导入
  const bare = (node: Ts.Expression): Ts.Expression =>
    ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node) ? bare(node.expression) : node
  // `import(…)` 或 `require(…)` 读取函数所在的模块
  const loadsDoor = (node: Ts.Expression): boolean => ts.isCallExpression(node)
    && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    && isDoor(node.arguments[0])
  const isDoorModule = (node: Ts.Expression): boolean => {
    const e = bare(node)
    return (ts.isIdentifier(e) && moduleNames.has(e.text)) || loadsDoor(e)
  }
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
      if (named !== undefined && ts.isNamespaceImport(named)) { refsDoor = true; moduleNames.add(named.name.text) }
      if (named !== undefined && ts.isNamedImports(named)) {
        for (const el of named.elements) {
          if (el.isTypeOnly) continue
          refsDoor = true
          if ((el.propertyName ?? el.name).text === 'readCatalog') readerNames.add(el.name.text)
        }
      }
    }
    if (ts.isExportDeclaration(node) && isDoor(node.moduleSpecifier) && !node.isTypeOnly
      && (node.exportClause === undefined || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(el => !el.isTypeOnly))) refsDoor = true
    if (ts.isCallExpression(node)) {
      if (loadsDoor(node)) refsDoor = true
      calls.push(node)
    }
    // `const c = await import(…)` 记下模块对象；`const { readCatalog } = …`、`const { readCatalog: rc } = …` 记下读取函数
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined && loadsDoor(bare(node.initializer))) {
      if (ts.isIdentifier(node.name)) moduleNames.add(node.name.text)
      else if (ts.isObjectBindingPattern(node.name)) {
        for (const el of node.name.elements) {
          const key = el.propertyName ?? el.name
          if (ts.isIdentifier(key) && key.text === 'readCatalog' && ts.isIdentifier(el.name)) readerNames.add(el.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  // 只认指向那个模块里读取函数的调用：同名的本地函数、别的对象上的同名方法都不算
  const callsReader = calls.some(c => {
    const callee = bare(c.expression)
    if (ts.isIdentifier(callee)) return readerNames.has(callee.text)
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'readCatalog' && isDoorModule(callee.expression)
    return ts.isElementAccessExpression(callee) && ts.isStringLiteral(callee.argumentExpression)
      && callee.argumentExpression.text === 'readCatalog' && isDoorModule(callee.expression)
  })
  return { mentions, refsDoor, callsReader }
}

/**
 * 判一组源码文件（路径从仓库根写起）。交回每一处毛病一行；没有毛病交空数组。
 * `NOT_READERS` 里列了、却不在这组文件里的，也报：放行名单只许越来越准。
 */
export function catalogDoorFaults(files: readonly { path: string; text: string }[]): string[] {
  const faults: string[] = []
  const seen = new Set<string>()
  for (const { path, text } of files) {
    seen.add(path)
    if (path === DOOR || isTestFile(path) || Object.hasOwn(NOT_READERS, path)) continue
    const found = scan(path, text)
    for (const line of found.mentions) {
      faults.push(`${path} 第 ${line} 行：直接写了变异目录的文件名，要读就从 catalog-rule.ts 导入位置并经 readCatalog 读`)
    }
    if (found.refsDoor && !found.callsReader) {
      faults.push(`${path}：引用了读取函数所在的模块，却没调用 readCatalog —— 读目录要经读取函数判`)
    }
  }
  for (const path of Object.keys(NOT_READERS)) {
    if (!seen.has(path)) faults.push(`${path}：在放行名单里，却不在要扫的文件里`)
  }
  return faults
}
