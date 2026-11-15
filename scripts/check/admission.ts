#!/usr/bin/env tsx
/**
 * 准入读物包的入口（`npm run admission -- <需求编号> <包目录>`，ADR-202 第六节第二片）。
 *
 * 只读、写包、打印、设退出码：需求单与变异说明怎么出、签名怎么扫、包目录在不在仓库里，
 * 全在 `admission-rule.ts`（`docs/CONVENTIONS.md` 第 10 条）。这里只把真树读成那几样输入，
 * 出声明、拷文档、算 SHA256。
 *
 * **先全部算完、扫完，再写。** 有一处不出包就一个文件都不写：写了一半的包看起来和写完的一样，
 * 而读它的上下文分不出少了什么。
 *
 * **退出码只设不退**（`process.exitCode`，不调 `process.exit`）：拒收时先打的那几百行要等写完再走，
 * 当场退出的话，stdout／stderr 接到管道上时排着没写出去的那一截会被截掉（KOL-45 关单标准第 4 条）。
 *
 * 退出码：0 出了包；1 扫出了实现（签名里有函数体之类、变异说明夹带实现原文）或声明没出全，一个文件都不写；
 * 2 用法不对或不肯出包（参数不是两个、包目录在仓库里或已存在而且不空、登记表没过 `spec-sync` 那一道校验、
 * 编号不在登记表里或已作废、变异目录读不出或编号重复），一个文件都不写。
 *
 * 不接进 `npm run check`：这是给人（或给起测试上下文的那一方）手动出包用的，检查链里没有一步要它的产物。
 */
import type * as Ts from 'typescript'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { briefSheet, declarationFindings, insideRoot, requirementSheet } from './admission-rule.js'
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
 */
const realish = (p: string): string => {
  const abs = resolve(p)
  if (existsSync(abs)) return realpathSync(abs)
  const parent = dirname(abs)
  return parent === abs ? abs : join(realish(parent), basename(abs))
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

  if (insideRoot(root, out)) return refuse(`包目录 ${out} 在仓库里 —— 要放在仓库外面，读它的上下文才碰不到实现`)
  if (existsSync(out) && readdirSync(out).length > 0) return refuse(`包目录 ${out} 已存在而且不空 —— 旧包里多出来的文件会留着，而清单不列它们`)

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
  if (!Array.isArray(corpus?.mutations)) return refuse(`读不出 ${CATALOG} 里的 mutations`)
  // 读变异编号的地方都先过 duplicateIds（ADR-34 第 90 行那一类）：同号两条在变异说明里分不出是哪一条
  const dup = duplicateIds(corpus.mutations)
  if (dup.length > 0) return refuse(`变异目录里编号重复：${dup.join('、')}`)
  const brief = briefSheet(id, corpus.mutations, corpus.exemptions ?? [])

  const ts = createRequire(import.meta.url)('typescript') as typeof Ts
  const sources = SOURCES.flatMap(d => existsSync(d) ? walk(d) : []).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort()
  const signatures = new Map<string, string>()
  let skipped = false
  if (sources.length > 0) {
    const program = ts.createProgram(sources, {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true, skipLibCheck: true, declaration: true, emitDeclarationOnly: true, noEmit: false, types: ['node'],
    })
    skipped = program.emit(undefined, (name, text) => {
      signatures.set(relative(root, realish(name)).split('\\').join('/'), text)
    }).emitSkipped
  }
  const missing = sources.map(f => f.replace(/\.ts$/, '.d.ts')).filter(f => !signatures.has(f))
  if (skipped || missing.length > 0) {
    console.error(`✗ 准入读物包：声明没出全（${missing.join('、') || '产出被跳过'}），不出包`)
    return 1
  }

  const findings = [...signatures].flatMap(([f, text]) => declarationFindings(text).map(x => `${f}：${x}`))
  const leaks = brief.leaks.map(l => `${l.id} 的「违反了什么」夹带实现原文：${l.leak}`)
  if (findings.length + leaks.length > 0) {
    console.error(`✗ 准入读物包：扫出 ${findings.length + leaks.length} 处实现，不出包`)
    for (const f of [...findings, ...leaks]) console.error(`  ${f}`)
    return 1
  }

  const docs = existsSync(DOCS) ? walk(DOCS).filter(f => f.endsWith('.md')).sort() : []
  const sigs = [...signatures].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const files = new Map<string, Buffer>([
    [`01-需求-${id}.md`, Buffer.from(sheet.text)],
    ...sigs.map(([f, t]): [string, Buffer] => [`02-签名/${f}`, Buffer.from(t)]),
    ...docs.map((f): [string, Buffer] => [`03-对外文档/${f}`, readFileSync(f)]),
    ['04-变异集-违反了什么.md', Buffer.from(brief.text)],
  ])

  const git = (...a: string[]): string | undefined => {
    try { return execFileSync('git', [...GIT_CONFIG, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
    catch { return undefined }
  }
  const head = git('rev-parse', 'HEAD')
  const status = head === undefined ? undefined : git('status', '--porcelain')
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  const manifest = [
    `# 准入读物包 · ${id}`, '',
    `出自提交：${head ?? '无从确认（读不到 git）'}。工作区：${status === undefined ? '无从确认' : status === '' ? '干净' : '有没提交的改动 —— 包与那个提交对不上'}。`, '',
    '**读法：只读这个目录。** 不要读仓库，也不要照项目说明里「先读仓库文档」的路由去读。',
    '写不出来的地方说明判据没写清 —— 写下来交回去，不要去别处找。', '',
    '| 文件 | SHA256 |', '|---|---|',
    ...[...files].map(([f, b]) => `| \`${f}\` | \`${sha(b)}\` |`), '',
    '不在包里的：函数体、测试、决策记录、变异的代码原文。', '',
    '机器核过的：签名逐份扫过，只扫了三种 —— `函数体`、`不是声明的语句`、`初始值不是字面量`；变异说明里没有认得出的实现原文（同 `mutate --brief` 的判据）。'
      + '参数默认值、`export default` 后面的表达式之类别的形状不扫：声明产出里本来不出现它们（ADR-202 第十五节）。', '',
    '没核的：签名上的注释与对外文档原样带进来，里面有没有实现原文没有机器核（ADR-202 第三节）。', '',
  ].join('\n')

  const all = new Map<string, Buffer>([['00-清单.md', Buffer.from(manifest)], ...files])
  for (const [f, b] of all) {
    mkdirSync(dirname(join(out, f)), { recursive: true })
    writeFileSync(join(out, f), b)
    console.log(`  ${f}`)
  }
  console.log(`✓ 准入读物包 · ${id} → ${out}：共 ${all.size} 个文件（清单 1 · 需求单 1 · 签名 ${sigs.length} · 对外文档 ${docs.length} · 变异说明 1）`)
  return 0
}

process.exitCode = main()
