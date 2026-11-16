#!/usr/bin/env tsx
/**
 * 准入读物包的入口（`npm run admission -- <需求编号> <包目录>`，ADR-202 第六节第二片）。
 *
 * 需求单与变异说明怎么出、签名怎么扫、包目录在不在仓库里，在 `admission-rule.ts`（`docs/CONVENTIONS.md` 第 10 条）。
 * 这里把真树读成那几样输入，出声明、拷文档、算 SHA256、写包、打印、设退出码；还留着几处只有自检够得到的小取舍
 * （取真实路径的走法、变异目录的形状、拒收的先后），ADR-202 第十七节记着（ADR-193 第 112 行那一类）。
 *
 * **先全部算完、扫完，再写。** 有一处不出包就一个文件都不写：写了一半的包看起来和写完的一样，
 * 而读它的上下文分不出少了什么。
 *
 * **退出码只设不退**（`process.exitCode`，不调 `process.exit`）：拒收时先打的那几百行要等写完再走，
 * 当场退出的话，stdout／stderr 接到管道上时排着没写出去的那一截会被截掉（ADR-202 第十六节「退出码只设不退」）。
 *
 * 退出码：0 出了包；1 扫出了实现（签名里有函数体之类、变异说明夹带实现原文）或声明没出全，一个文件都不写；
 * 2 用法不对或不肯出包（参数不是两个、包目录在仓库里或已存在而且不空或不是目录、路上有悬空的符号链接、
 * 上级不是目录或写不进去、登记表没过 `spec-sync` 那一道校验、编号不在登记表里或已作废、变异目录形状不对或编号重复、`package.json` 的命令指到不存在的入口），
 * 一个文件都不写；没接住的异常也以 2 退出。唯一会留下东西的是写包写到一半出错（磁盘满之类），那时照实说留下了什么。
 *
 * 不接进 `npm run check`：这是给人（或给起测试上下文的那一方）手动出包用的，检查链里没有一步要它的产物。
 */
import type * as Ts from 'typescript'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { accessSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { briefSheet, declarationFindings, entryScripts, entrySheet, insideRoot, requirementSheet } from './admission-rule.js'
import { duplicateIds } from './attribution-rule.js'
import { GIT_CONFIG } from './size-rule.js'
import { adrIdsIn, rootProblems, validateRegistry } from './spec-rule.js'

/** 出签名的两处：产品逻辑与数据源适配（ADR-202 第二节第 2 份） */
const SOURCES = ['scripts/lib', 'scripts/providers']
/** 照搬的对外文档：`skill/` 下全部 `.md`（第 3 份） */
const DOCS = 'skill'
const REGISTRY = 'docs/requirements.json'
const CATALOG = 'scripts/check/mutations.json'
const ADR_DIR = 'docs/adr'

/** 一个目录下（含子目录）的文件，路径用 `/` 接 */
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])

/**
 * 一个路径的真实路径：存在的那一截解掉符号链接，还不存在的那一截原样接在后面。
 * `insideRoot` 只比字符串（ADR-202 第十五节那张欠条）：仓库外一个指进仓库的符号链接，
 * 不先解开就会被当成在外面。
 *
 * 路上有一个**悬空的**符号链接（链接本身在、指的东西不在）时交回 `undefined`：它不存在、又解不开，
 * 当成「不存在的那一截」原样接上的话，判的是链接的名字，写的时候却顺着链接落到它指的地方（第十七节）。
 */
const realish = (p: string): string | undefined => {
  const abs = resolve(p)
  if (existsSync(abs)) return realpathSync(abs)
  try { if (lstatSync(abs).isSymbolicLink()) return undefined } catch { /* 连链接也没有：真不存在 */ }
  const parent = dirname(abs)
  if (parent === abs) return abs
  const base = realish(parent)
  return base === undefined ? undefined : join(base, basename(abs))
}

/** 包目录要写进去的那个最近的已存在的上级（含它自己） */
const nearestExisting = (p: string): string => existsSync(p) || dirname(p) === p ? p : nearestExisting(dirname(p))

/** 变异目录的形状：入口读的那几个字段在、是字符串；豁免缺着算没有（第十七节） */
const isText = (v: unknown): v is string => typeof v === 'string'
const catalogProblem = (corpus: any): string | undefined => {
  if (!Array.isArray(corpus?.mutations)) return '读不出 mutations 数组'
  const badMutation = corpus.mutations.findIndex((m: any) => m === null || typeof m !== 'object' || !isText(m.id) || !isText(m.req) || !isText(m.why))
  if (badMutation >= 0) return `mutations 第 ${badMutation + 1} 项不是带 id、req、why 三个字符串的对象`
  if (corpus.exemptions === undefined) return undefined
  if (!Array.isArray(corpus.exemptions)) return 'exemptions 不是数组'
  const badExemption = corpus.exemptions.findIndex((e: any) => e === null || typeof e !== 'object' || !isText(e.req) || !isText(e.why)
    || (e.scope !== undefined && !isText(e.scope)))
  return badExemption >= 0 ? `exemptions 第 ${badExemption + 1} 项不是带 req、why 两个字符串（scope 缺着或也是字符串）的对象` : undefined
}

const readJson = (file: string): any => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return undefined }
}

function main(): number {
  const refuse = (why: string): number => { console.error(`✗ 准入读物包：${why}`); return 2 }

  const args = process.argv.slice(2)
  if (args.length !== 2) {
    console.error('用法：npm run admission -- <需求编号> <包目录>\n  包目录要在仓库外面，不存在或是空的（ADR-202 第四节）')
    return 2
  }
  const [id, dirArg] = args
  const root = realpathSync(process.cwd())
  const out = realish(dirArg)
  if (out === undefined) return refuse(`包目录 ${resolve(dirArg)} 的路上有悬空的符号链接 —— 解不开，就判不了它在不在仓库里`)

  if (insideRoot(root, out)) return refuse(`包目录 ${out} 在仓库里 —— 要放在仓库外面，读它的上下文才碰不到实现`)
  if (existsSync(out) && !statSync(out).isDirectory()) return refuse(`包目录 ${out} 已存在而且不是目录`)
  if (existsSync(out) && readdirSync(out).length > 0) return refuse(`包目录 ${out} 已存在而且不空 —— 旧包里多出来的文件会留着，而清单不列它们`)
  // 写得进去先问清楚：算完再在建目录上失败，拒收就成了半路崩
  const base = nearestExisting(out)
  if (!statSync(base).isDirectory()) return refuse(`包目录 ${out} 的上级 ${base} 不是目录`)
  try { accessSync(base, constants.W_OK | constants.X_OK) } catch { return refuse(`包目录 ${out} 的上级 ${base} 写不进去`) }

  // 登记表先过 spec-sync 那一道校验再出需求单：需求单的判定假定编号唯一、形状对（ADR-202 第十四节第 9 条）。
  // 决策记录在不在照 spec-sync 的读法从 docs/adr 收
  const registry = readJson(REGISTRY)
  if (registry === undefined) return refuse(`读不出 ${REGISTRY} —— 当前目录要是仓库根`)
  const decisions = existsSync(ADR_DIR)
    ? readdirSync(ADR_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort().map(f => readFileSync(join(ADR_DIR, f), 'utf8')).join('\n')
    : ''
  const rootBad = rootProblems(registry)
  const problems = rootBad.length > 0 ? rootBad
    : validateRegistry(registry.requirements, adrIdsIn(decisions), Object.keys(registry.categories))
  if (problems.length > 0) {
    console.error(`✗ 准入读物包：需求登记表没过校验（${problems.length} 处，先跑 npm run spec），不出包`)
    for (const p of problems) console.error(`  · ${p}`)
    return 2
  }
  const sheet = requirementSheet(registry.requirements, id)
  if (!sheet.ok) return refuse(sheet.reason)

  const corpus = readJson(CATALOG)
  const catalogBad = catalogProblem(corpus)
  if (catalogBad !== undefined) return refuse(`${CATALOG}：${catalogBad}`)
  // 读变异编号的地方都先过 duplicateIds（ADR-34 第 90 行那一类）：同号两条在变异说明里分不出是哪一条
  const dup = duplicateIds(corpus.mutations)
  if (dup.length > 0) return refuse(`变异目录里编号重复：${dup.join('、')}`)
  const brief = briefSheet(id, corpus.mutations, corpus.exemptions ?? [])

  // 两个源目录与 skill/ 少一个就不出包：当成空集合出包的话，交出去的包缺一整份读物而照样以 0 退出（#484 上 CodeRabbit 第一轮）
  const missingDirs = [...SOURCES, DOCS].filter(d => !existsSync(d) || !statSync(d).isDirectory())
  if (missingDirs.length > 0) return refuse(`读不到 ${missingDirs.join('、')} —— 当前目录要是仓库根`)

  const ts = createRequire(import.meta.url)('typescript') as typeof Ts
  const sources = SOURCES.flatMap(d => walk(d)).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort()
  const signatures = new Map<string, string>()
  let skipped = false
  if (sources.length > 0) {
    const program = ts.createProgram(sources, {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true, skipLibCheck: true, declaration: true, emitDeclarationOnly: true, noEmit: false, types: ['node'],
    })
    skipped = program.emit(undefined, (name, text) => {
      signatures.set(relative(root, realish(name) ?? resolve(name)).split('\\').join('/'), text)
    }).emitSkipped
  }
  // 源码 import 了仓库外的 .ts（或源目录里的符号链接指到仓库外），tsc 也给它出声明，路径以 .. 起头：
  // 照搬进包会写到包目录外面去，而且那份不是这两个源目录的签名（#484 上 CodeRabbit 第一轮）
  const outside = [...signatures.keys()].filter(f => f === '..' || f.startsWith('../') || isAbsolute(f))
  if (outside.length > 0) return refuse(`声明产出落在仓库外：${outside.join('、')} —— 源目录里的代码引用了仓库外的文件`)
  // 仓库里、两个源目录之外的 .ts 被引用到，tsc 同样给它出声明（比如 scripts/check/ 下的）：那不是签名，进包就把实现那一侧递给了写测试的人（#484 上 CodeRabbit 第二轮）
  const expected = new Set(sources.map(f => f.replace(/\.ts$/, '.d.ts')))
  const stray = [...signatures.keys()].filter(f => !expected.has(f))
  if (stray.length > 0) return refuse(`声明产出不在源目录里：${stray.join('、')} —— 源目录里的代码引用了 ${SOURCES.join('、')} 之外的文件`)
  const missing = sources.map(f => f.replace(/\.ts$/, '.d.ts')).filter(f => !signatures.has(f))
  if (skipped || missing.length > 0) {
    console.error(`✗ 准入读物包：声明没出全（${missing.join('、') || '产出被跳过'}），不出包`)
    return 1
  }

  // 入口脚本不导出函数，签名里没有它们：只留它们从两个源目录 import 了哪些导出，写测试的人才知道入口走哪个函数、
  // 读名单用的是哪一个（ADR-206 第五节）。抄哪几行由 entrySheet 判定
  const entries = entryScripts(readJson('package.json'))
  const absentEntries = entries.filter(f => !existsSync(f) || !statSync(f).isFile())
  if (absentEntries.length > 0) return refuse(`package.json 里的命令指到不存在的入口：${absentEntries.join('、')}`)
  const entrySheets = new Map<string, string>()
  for (const f of entries) entrySheets.set(f.replace(/\.ts$/, '.d.ts'), entrySheet(f, readFileSync(f, 'utf8'), SOURCES))

  const findings = [...signatures, ...entrySheets].flatMap(([f, text]) => declarationFindings(text).map(x => `${f}：${x}`))
  const leaks = brief.leaks.map(l => `${l.id} 的「违反了什么」夹带实现原文：${l.leak}`)
  if (findings.length + leaks.length > 0) {
    console.error(`✗ 准入读物包：扫出 ${findings.length + leaks.length} 处实现，不出包`)
    for (const f of [...findings, ...leaks]) console.error(`  ${f}`)
    return 1
  }

  const docs = walk(DOCS).filter(f => f.endsWith('.md')).sort()
  const sigs = [...signatures].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const files = new Map<string, Buffer>([
    [`01-需求-${id}.md`, Buffer.from(sheet.text)],
    ...sigs.map(([f, t]): [string, Buffer] => [`02-签名/${f}`, Buffer.from(t)]),
    ...[...entrySheets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([f, t]): [string, Buffer] => [`02-签名/${f}`, Buffer.from(t)]),
    ...docs.map((f): [string, Buffer] => [`03-对外文档/${f}`, readFileSync(f)]),
    ['04-变异集-违反了什么.md', Buffer.from(brief.text)],
  ])

  const git = (...a: string[]): string | undefined => {
    try { return execFileSync('git', [...GIT_CONFIG, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
    catch { return undefined }
  }
  const head = git('rev-parse', 'HEAD')
  // 只问进包的那几样输入（含 package.json 与入口脚本：入口那一份从它们抄，#489 上 CodeRabbit），未跟踪的逐个列、被忽略的也列：用户配置里 status.showUntrackedFiles=no、或输入被 .gitignore 挡着时，
  // 光一句 git status 会说「干净」而包里装着没提交的东西（#484 上 CodeRabbit 第一轮）
  const status = head === undefined ? undefined
    : git('status', '--porcelain', '--untracked-files=all', '--ignored=matching', '--', REGISTRY, CATALOG, ADR_DIR, ...SOURCES, DOCS, 'package.json', ...entries)
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  const manifest = [
    `# 准入读物包 · ${id}`, '',
    `出自提交：${head ?? '无从确认（读不到 git）'}。工作区：${status === undefined ? '无从确认' : status === '' ? '干净' : '有没提交的改动 —— 包与那个提交对不上'}。`, '',
    '**读法：只读这个目录。** 不要读仓库，也不要照项目说明里「先读仓库文档」的路由去读。',
    '写不出来的地方说明判据没写清 —— 写下来交回去，不要去别处找。', '',
    '| 文件 | SHA256 |', '|---|---|',
    ...[...files].map(([f, b]) => `| \`${f}\` | \`${sha(b)}\` |`), '',
    '不在包里的：函数体、测试、决策记录、变异的代码原文。', '',
    '入口脚本（`package.json` 里命令指到的 `scripts/*.ts`）不导出函数：`02-签名/` 里它们那一份只有从源目录 import 的那几行，看得出入口走哪个函数，看不出怎么走。', '',
    '机器核过的：签名逐份扫过，只扫了三种 —— `函数体`、`不是声明的语句`、`初始值不是字面量`；变异说明里没有认得出的实现原文（同 `mutate --brief` 的判据）。'
      + '参数默认值、`export default` 后面的表达式之类别的形状不扫：声明产出里本来不出现它们（ADR-202 第十五节）。', '',
    '没核的：签名上的注释、入口那一份 import 里夹着的注释与对外文档原样带进来，里面有没有实现原文没有机器核（ADR-202 第三节）。', '',
  ].join('\n')

  const all = new Map<string, Buffer>([['00-清单.md', Buffer.from(manifest)], ...files])
  try {
    for (const [f, b] of all) {
      mkdirSync(dirname(join(out, f)), { recursive: true })
      writeFileSync(join(out, f), b)
      console.log(`  ${f}`)
    }
  } catch (e) {
    console.error(`✗ 准入读物包：写到一半出错，${out} 里留下了上面列出的那几个文件 —— 删掉整个目录再出（${e instanceof Error ? e.message : String(e)}）`)
    return 2
  }
  console.log(`✓ 准入读物包 · ${id} → ${out}：共 ${all.size} 个文件（清单 1 · 需求单 1 · 签名 ${sigs.length} · 入口 ${entrySheets.size} · 对外文档 ${docs.length} · 变异说明 1）`)
  return 0
}

// 没接住的异常（读盘、写盘出错之类）一律算拒收、以 2 退出：1 留给「扫出了实现」，按退出码分支的调用方不该把崩当成夹带
try {
  process.exitCode = main()
} catch (e) {
  console.error(`✗ 准入读物包：意外出错，不出包 —— ${e instanceof Error ? e.stack ?? e.message : String(e)}`)
  process.exitCode = 2
}
