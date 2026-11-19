/**
 * 起子进程接口闸门的**判定**（ADR-217）—— 起子进程的那个内建模块，只许登记过的文件碰。
 *
 * 为什么这样拦：检查脚本和测试里几十处各自起 git、各自拼参数、各自读输出，读歪过（ADR-216 记的第三个案例：
 * 自己解析 git 给人看的改动正文）。成熟的做法是「危险的接口只开一个口」：起进程收进一个通用启动函数，
 * 调 git 收进一个按问题给函数的入口，口里集中做对、集中测透；口外不许直接碰。
 * 一开始按「每一处调用起的是不是 git」判，独立复核找出十类漏网的写法（设计复核第一轮），于是改成按文件拦：
 * 一个文件碰没碰这个模块，语法树上就能确切回答，不必猜实参。
 *
 * **认得出的三类**（`launchSites`，只看语法树，不建类型检查的程序）：
 * 1. 模块名：`'child_process'` 或 `'node:child_process'` 这个字符串字面量出现在任何位置
 *    （导入、`require`、`import()`、`getBuiltinModule`、甚至一个普通常量）。纯类型的导入
 *    （`import type …`、`export type … from`、类型位置上的 `import('…')`）不碰运行时，不算。
 * 2. 动态取模块：`require`、`import()`、`getBuiltinModule` 的实参不是字面量 —— 取到的是什么判不了，
 *    宁可多报。`createRequire(…)` 交出来的函数被调、或存进变量后被调，也算 `require`。
 *    实参是 `pathToFileURL(…)` 的结果（或它的 `.href`）的不算：那确切是一个文件，不是内建模块。
 * 3. 进程内部的口：`execve`、`binding` 这两个名字出现在任何位置（属性访问、按名字导入、解构，写成标识符或字符串），
 *    与 `process[不是字面量]`。宁可多报：别的对象上同名的字段也记。
 *
 * **认不出的**（ADR-217 第三节，那里按复核实测列出，这几样仍靠评审与第二片的运行时拒绝）：写在字符串里的代码（落成文件去跑、或当场 eval）；
 * 换了形状的动态取模块（改名导入 `createRequire`、`getBuiltinModule`，先声明后赋值，`require` 存进别的变量，`Module._load`）；
 * 模块对象从登记过的文件经 `any` 或参数递出来；别的会起进程的内建模块（`node:cluster` 的 `fork`、
 * `worker_threads` 不起进程不算）；拿到子进程对象后碰未公开的内部方法；不在仓库受控文件里、
 * 扩展名不在 `SCANNED` 里的文件（`.sh`、工作流 yaml）。
 *
 * **登记表**（`REGISTRY_PATH`，JSON）分两节：「登记」是可以碰的文件与逐个的理由；「待挪」是现在碰着、
 * 等着挪进通用启动函数或 git 入口的文件，只有名字。判法（`judgeUse`）：
 * - 不在两节里的文件碰了，红。
 * - 「待挪」比基线多了，红（基线那份读不出、解析不了也红；基线上有这道闸门却没有登记表，红）。
 *   基线上还没有这道闸门的（引入它的那条 PR），不比，只列出来。
 * - 「待挪」里的文件已经一处都不碰了还挂着，红 —— 逼着清名单，名单才只会越来越短。
 * - 登记了却不在仓库里的文件，红。
 * - 「登记」比基线多出的行不红，单独列出来给评审看：理由写得对不对是人判的。
 * 主干上只报不判，与体量闸门同一个理由（CI 跑在推送之后，判红只会让主干变红）。
 */
import { createRequire } from 'node:module'
import type * as Ts from 'typescript'

let compiler: typeof Ts | undefined
const typescript = (): typeof Ts => compiler ??= createRequire(import.meta.url)('typescript') as typeof Ts

/** 登记表在仓库里的位置（从仓库根写起）。 */
export const REGISTRY_PATH = 'scripts/check/child-process-registry.json'
/** 闸门判定本身的位置：基线上有它，就说明那时已经有这道闸门了。 */
export const RULE_PATH = 'scripts/check/child-process-use-rule.ts'
/** 起子进程那个内建模块的两种写法。 */
export const MODULE_NAMES: readonly string[] = ['child_process', 'node:child_process']
/** 要扫的扩展名：TypeScript 的语法树都读得懂。声明文件（`.d.ts`）也扫：tsx 下它能被当成真代码加载。 */
export const SCANNED: readonly string[] = ['.ts', '.mts', '.cts', '.tsx', '.js', '.mjs', '.cjs', '.jsx']
/** 进程内部、能绕开这个模块起进程的两个口。 */
const INTERNAL_NAMES: readonly string[] = ['execve', 'binding']

export function isScanned(path: string): boolean {
  return SCANNED.some(ext => path.endsWith(ext))
}

export type SiteKind = '模块名' | '动态取模块' | '进程内部的口'
export interface Site { line: number; kind: SiteKind }

/** 一个文件里碰到起进程接口的每一处（行号从 1 起）。读不懂的源码照样有语法树，认得出几处算几处。 */
export function launchSites(path: string, text: string): Site[] {
  const ts = typescript()
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind)
  const sites: Site[] = []
  const add = (node: Ts.Node, k: SiteKind) => sites.push({ line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, kind: k })
  const literalText = (node: Ts.Node): string | undefined =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined

  // 纯类型的导入：整条语句只带类型，运行时不加载那个模块
  const typeOnly = (node: Ts.Node): boolean => {
    for (let p: Ts.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isImportTypeNode(p)) return true
      if (ts.isImportDeclaration(p)) return p.importClause?.isTypeOnly === true
      if (ts.isExportDeclaration(p)) return p.isTypeOnly
      if (ts.isImportEqualsDeclaration(p)) return p.isTypeOnly
    }
    return false
  }

  // `const r = createRequire(…)` 这样存下来的名字，之后 `r(…)` 也算 require
  const requireNames = new Set<string>(['require'])
  const isCreateRequire = (node: Ts.Node): boolean => ts.isCallExpression(node)
    && ((ts.isIdentifier(node.expression) && node.expression.text === 'createRequire')
      || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'createRequire'))
  const collect = (node: Ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isCreateRequire(node.initializer)) {
      requireNames.add(node.name.text)
    }
    ts.forEachChild(node, collect)
  }
  collect(tree)

  const isLoader = (call: Ts.CallExpression): boolean => {
    const callee = call.expression
    if (callee.kind === ts.SyntaxKind.ImportKeyword) return true
    if (ts.isIdentifier(callee)) return requireNames.has(callee.text) || callee.text === 'getBuiltinModule'
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'require' || callee.name.text === 'getBuiltinModule'
    return isCreateRequire(callee)
  }
  // 确切是一个文件：`pathToFileURL(…)` 或 `pathToFileURL(…).href`
  const isFileUrl = (node: Ts.Node): boolean => {
    const call = ts.isPropertyAccessExpression(node) && node.name.text === 'href' ? node.expression : node
    if (!ts.isCallExpression(call)) return false
    const callee = call.expression
    return (ts.isIdentifier(callee) && callee.text === 'pathToFileURL')
      || (ts.isPropertyAccessExpression(callee) && callee.name.text === 'pathToFileURL')
  }

  // `process`，外面套括号、类型断言、`!` 的也算（`(process as any)[k]` 编译得过，裸写 `process[k]` 在 strict 下反而编译不过）
  const isProcess = (node: Ts.Node): boolean => ts.isIdentifier(node) && node.text === 'process'
  const unwrap = (node: Ts.Expression): Ts.Expression =>
    ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node) ? unwrap(node.expression) : node
  const visit = (node: Ts.Node): void => {
    const text = literalText(node)
    if (text !== undefined && MODULE_NAMES.includes(text) && !typeOnly(node)) add(node, '模块名')
    if (ts.isCallExpression(node) && isLoader(node)) {
      const first = node.arguments[0]
      if (first !== undefined && literalText(first) === undefined && !isFileUrl(first)) add(node, '动态取模块')
    }
    // 名字本身出现就记：属性访问、按名字导入、解构、对象字面量的键，写成标识符或字符串都一样
    if ((ts.isIdentifier(node) && INTERNAL_NAMES.includes(node.text)) || (text !== undefined && INTERNAL_NAMES.includes(text))) add(node, '进程内部的口')
    if (ts.isElementAccessExpression(node) && literalText(node.argumentExpression) === undefined
        && isProcess(unwrap(node.expression))) add(node, '进程内部的口')
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return sites
}

export interface Registry {
  /** 可以碰的文件 → 为什么可以 */
  registered: Map<string, string>
  /** 等着挪走的文件 */
  toMove: string[]
}

/**
 * 读登记表。形状不对就抛错，不当成空表：空表等于谁都不许碰，看着严、其实是把读坏了藏起来。
 * 只认三个键（「说明」「登记」「待挪」）；「登记」每一项的理由不许空；「待挪」按字典序排、不重复；
 * 一个文件不能两节都在。
 */
export function parseRegistry(text: string): Registry {
  const raw: unknown = JSON.parse(text)
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('登记表的根要是一个对象')
  const keys = Object.keys(raw).sort()
  if (keys.join() !== ['待挪', '登记', '说明'].sort().join()) throw new Error(`登记表只认「说明」「登记」「待挪」三个键，读到的是 ${keys.join('、')}`)
  const r = raw as Record<string, unknown>
  if (typeof r['说明'] !== 'string') throw new Error('「说明」要是一段字')
  const reg = r['登记'], move = r['待挪']
  if (reg === null || typeof reg !== 'object' || Array.isArray(reg)) throw new Error('「登记」要是「文件 → 理由」的对象')
  const registered = new Map<string, string>()
  for (const [path, why] of Object.entries(reg)) {
    if (typeof why !== 'string' || why.trim() === '') throw new Error(`「登记」里 ${path} 没写理由`)
    registered.set(path, why)
  }
  if (!Array.isArray(move) || move.some(p => typeof p !== 'string')) throw new Error('「待挪」要是文件名的列表')
  const toMove = move as string[]
  for (let i = 1; i < toMove.length; i++) {
    if (toMove[i - 1] >= toMove[i]) throw new Error(`「待挪」要按字典序排、不重复：${toMove[i - 1]} 与 ${toMove[i]}`)
  }
  const both = toMove.filter(p => registered.has(p))
  if (both.length) throw new Error(`这几个文件两节都在：${both.join('、')}`)
  return { registered, toMove }
}

/** 基线那一侧：有登记表；或者那时还没有这道闸门（引入它的那条 PR）。 */
export type BaselineRegistry = { kind: 'registry'; registry: Registry } | { kind: 'no-gate' }

/**
 * 基线那份登记表算哪一种。入口只交来 git 答的事实，在这里判：
 * `registryListed`、`ruleListed` 是 `git ls-tree --name-only` 对登记表、判定文件的回答（空串＝基线上没有，`null`＝git 出错）；
 * `readRegistry` 读基线那份登记表的内容（`null`＝读不出）。返回字符串＝无从判断的说法。
 */
export function baselineFromFacts(registryListed: string | null, ruleListed: string | null, readRegistry: () => string | null): BaselineRegistry | string {
  if (registryListed === null || ruleListed === null) return '`git ls-tree` 读不了基线'
  if (registryListed === '') return ruleListed === '' ? { kind: 'no-gate' } : '基线上有这道闸门却没有登记表（无从判断，先合主干）'
  const text = readRegistry()
  if (text === null) return '基线那份登记表读不出来'
  try { return { kind: 'registry', registry: parseRegistry(text) } } catch (e) { return `基线那份登记表解析不了：${(e as Error).message}` }
}

/** 读工作区里一个受控文件出错时，是不是「它已经不在了」（删掉了、上一级不再是目录）。别的错（没权限……）不是，要说无从判断。 */
export function goneFromWorktree(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

export interface UseReport {
  /** 不在两节里却碰了的文件，带着每一处 */
  unlisted: { path: string; sites: Site[] }[]
  /** 「待挪」里比基线多出来的文件；基线上还没有闸门时为空 */
  grownToMove: string[]
  /** 「待挪」里已经一处都不碰的文件 */
  staleToMove: string[]
  /** 登记了、待挪了，却不在仓库里的文件 */
  missing: string[]
  /** 「登记」比基线多出的文件与理由（不红，给评审看）；基线上还没有闸门时是全部 */
  newRegistered: { path: string; why: string }[]
  /** 「待挪」比基线少了的文件 */
  movedOut: string[]
  toMoveCount: number
}

/**
 * 判。`sites` 是仓库里每个要扫的文件碰到的那几处（一处都没有的文件也要在里面，值是空数组 ——
 * 「在仓库里」靠它答）。
 */
export function judgeUse(sites: Map<string, Site[]>, now: Registry, base: BaselineRegistry): UseReport {
  const listed = (p: string) => now.registered.has(p) || now.toMove.includes(p)
  const unlisted = [...sites].filter(([p, s]) => s.length > 0 && !listed(p)).map(([path, s]) => ({ path, sites: s }))
    .sort((a, b) => a.path < b.path ? -1 : 1)
  const baseMove = base.kind === 'registry' ? new Set(base.registry.toMove) : undefined
  const grownToMove = baseMove ? now.toMove.filter(p => !baseMove.has(p)) : []
  const staleToMove = now.toMove.filter(p => sites.has(p) && sites.get(p)!.length === 0)
  const missing = [...now.registered.keys(), ...now.toMove].filter(p => !sites.has(p)).sort()
  const baseReg = base.kind === 'registry' ? base.registry.registered : new Map<string, string>()
  const newRegistered = [...now.registered].filter(([p, why]) => baseReg.get(p) !== why).map(([path, why]) => ({ path, why }))
  const movedOut = base.kind === 'registry' ? base.registry.toMove.filter(p => !now.toMove.includes(p)) : []
  return { unlisted, grownToMove, staleToMove, missing, newRegistered, movedOut, toMoveCount: now.toMove.length }
}

/** 报告与结论。分支上有一样不对就红；主干上只报不判。 */
export function useLines(report: UseReport, onTrunk: boolean, scope: string, firstTime: boolean): { ok: boolean; out: string[]; err: string[] } {
  const out = [`起子进程的接口 · 相对 ${scope}：待挪 ${report.toMoveCount} 个文件（只许减，ADR-217）`]
  for (const p of report.movedOut) out.push(`  ↓ 挪走了 ${p}`)
  if (report.newRegistered.length) {
    out.push(firstTime ? '  基线上还没有这道闸门，登记表整份给评审看：' : '  「登记」比基线多了（或理由改了），评审看理由对不对：')
    for (const r of report.newRegistered) out.push(`    + ${r.path} —— ${r.why}`)
  }
  const faults: string[] = []
  for (const u of report.unlisted) {
    faults.push(`  ✗ ${u.path} 碰了起子进程的接口，却不在登记表里：${u.sites.map(s => `第 ${s.line} 行（${s.kind}）`).join('、')}`)
  }
  for (const p of report.grownToMove) faults.push(`  ✗ 「待挪」比基线多了 ${p}`)
  for (const p of report.staleToMove) faults.push(`  ✗ ${p} 已经一处都不碰了，从「待挪」里删掉它`)
  for (const p of report.missing) faults.push(`  ✗ 登记表里的 ${p} 不在仓库里`)
  if (!faults.length) {
    out.push('✓ 起子进程的接口：只有登记过的文件碰它')
    return { ok: true, out, err: [] }
  }
  if (onTrunk) {
    out.push(...faults, `✓ 起子进程的接口：HEAD 就在主干上，${faults.length} 处不对，**只报不判定**`)
    return { ok: true, out, err: [] }
  }
  const err = [`✗ 起子进程的接口：${faults.length} 处不对`, ...faults,
    `  起进程走通用启动函数 scripts/check/start-process.ts；调 git 走 git 入口 scripts/check/git-entry.ts（只答它表里列的那几问，要问新的先往表里加一行）—— 登记表在 ${REGISTRY_PATH}。`,
    '  「待挪」只许减：挪走了就删掉那一行；新文件要碰，只能进「登记」并写清理由，由评审判（ADR-217）。']
  return { ok: false, out, err }
}
