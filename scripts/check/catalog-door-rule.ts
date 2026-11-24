/**
 * 查有没有人绕开变异目录的读取函数（ADR-242）：需求测试 `h-catalog-door` 拿真树上的源码交给 `catalogDoorFaults`，交回非空就红。
 *
 * **怎么认**（只看语法树，确切回答，不猜实参）：
 * 1. 变异目录的文件名 `mutations.json` 出现在字符串字面量或模板串的任何一段里 —— 只许写在 `catalog-rule.ts`。
 *    注释不算（语法树上没有注释节点）。
 * 2. 导入了 `MUTATION_CATALOG`（目录的位置）的文件，同一个文件里也要导入 `readCatalog`：
 *    拿了位置去读，就得经读取函数判。
 * 两条都由 `NOT_READERS` 逐个放行：那几处碰到这个名字，但不读目录里的变异。
 *
 * **不扫的**：测试文件（`isTestFile`）—— 它们写夹具目录、或拿真目录做测试的输入，不是检查链读目录拿去判。
 * **认不出的**：拆开拼的文件名（`'mutations' + '.json'`）、从环境变量或参数传进来的路径、读目录的 shell
 * （工作流里那一行 `jq` 只数条数，不读编号）。这几种仍靠评审。
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

/** 一个文件里提到文件名的那几行、有没有导入位置与读取函数（行号从 1 起） */
function scan(path: string, text: string): { mentions: number[]; importsPath: boolean; importsReader: boolean } {
  const ts = typescript()
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const mentions: number[] = []
  let importsPath = false
  let importsReader = false
  const visit = (node: Ts.Node): void => {
    const piece = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.text : undefined
    if (piece !== undefined && piece.includes(CATALOG_NAME)) {
      mentions.push(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1)
    }
    if (ts.isImportSpecifier(node)) {
      const imported = (node.propertyName ?? node.name).text
      if (imported === 'MUTATION_CATALOG') importsPath = true
      if (imported === 'readCatalog') importsReader = true
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return { mentions, importsPath, importsReader }
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
    if (found.importsPath && !found.importsReader) {
      faults.push(`${path}：导入了变异目录的位置，却没导入 readCatalog —— 读目录要经读取函数判`)
    }
  }
  for (const path of Object.keys(NOT_READERS)) {
    if (!seen.has(path)) faults.push(`${path}：在放行名单里，却不在要扫的文件里`)
  }
  return faults
}
