#!/usr/bin/env tsx
/**
 * 字段断言闸门的入口（`npm run fields`，检查链里紧跟类型检查，ADR-198 第四节）。
 *
 * 只问 git、读文件、建语言服务、读变异登记表、打印、交回退出码；什么算字段、算新增（含没加进 git 的整份、单问答空、git 看不见与符号链接）、
 * 算守着、什么时候红，都在 `field-use-rule.ts`。
 * 要用到的每件事实找谁要，照 ADR-198 第四节那张表：git 都经 git 入口问，每一问的路径与输出都按仓库根算（`:(top)`、`--full-name`、`--no-relative`），在哪个子目录里跑都一样；字段问 TypeScript 语言服务；
 * 变异的位置用登记表与语言服务程序里的同一份正文。
 * 无从判断时说出来、以 1 结束，不退化成「没有新字段，通过」。退出码只设在进程上、不当场退出。
 */
import { lstatSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type * as Ts from 'typescript'

import { askGit, runGit } from './git-entry.js'
import { addedLines, fieldsOf, fieldVerdict, isJudgedFile, markSite, outOfSight, wholeFile, type Field, type Site } from './field-use-rule.js'
import { anchorCatalog } from './mutate-rule.js'
import { resolveBaseline } from './size-rule.js'

const NAME = '字段断言'

/** 会改掉 git 答案的环境变量：`GIT_DIFF_OPTS` 盖掉 `-U0`；`GIT_*_PATHSPECS` 改路径的读法，`GIT_LITERAL_PATHSPECS` 让带魔法的路径一个也对不上、git 答空还退 0 */
const GIT_ENV_DROPPED = ['GIT_DIFF_OPTS', 'GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS'] as const

class CannotAnswer extends Error {}
const cannot = (why: string): never => { throw new CannotAnswer(why) }

/** 问一次 git，以 0 退出交回标准输出，否则无从判断（git 的原话带上） */
function ask(args: readonly string[], what: string): string {
  const r = runGit(args)
  if (r.error === undefined && r.status === 0) return r.stdout.toString('utf8')
  return cannot(`${what}：git 没答上来（${r.error?.message ?? `退出码 ${r.status}`}）${r.stderr.trim() === '' ? '' : `：${r.stderr.trim()}`}`)
}

/** 空字符分隔的一串名字，原样交回（不去空白、不解转义） */
const zList = (out: string): string[] => out.split('\0').filter(n => n !== '')

/** 新加的行：受跟踪的文件各问一次 `-U0`，交给 `addedLines` 读块头；没加进 git 的交给 `wholeFile` 整份算新加 */
function changes(base: string, root: string): Map<string, Set<number>> {
  const tracked = zList(ask(['diff', '--name-only', '--no-renames', '--no-relative', '-z', base], '列改过的文件')).filter(isJudgedFile)
  const diffs: [string, string][] = tracked.map(file => [file, ask(['diff', '--no-renames', '--no-relative', '--no-color', '--no-ext-diff', '--no-textconv',
    '--text', '--diff-algorithm=myers', '--indent-heuristic', '-U0', '--inter-hunk-context=0', base, '--', `:(top,literal)${file}`], `取 ${file} 改了哪几行`)])
  let added: Map<string, Set<number>>
  try { added = addedLines(diffs) } catch (e) { return cannot((e as Error).message) }
  for (const file of zList(ask(['ls-files', '-z', '--full-name', '--others', '--exclude-standard', '--', ':(top)scripts/check/'], '列没加进 git 的新文件')).filter(isJudgedFile)) {
    added.set(file, wholeFile(readFileSync(join(root, file), 'utf8')))
  }
  return added
}

/** 拿仓库根的 tsconfig.json 建语言服务 */
function serviceOf(root: string): Ts.LanguageService {
  const ts = createRequire(import.meta.url)('typescript') as typeof Ts
  const path = join(root, 'tsconfig.json')
  const read = ts.readConfigFile(path, ts.sys.readFile)
  if (read.error !== undefined) cannot(`tsconfig.json 读不出：${ts.flattenDiagnosticMessageText(read.error.messageText, '\n')}`)
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, path)
  if (parsed.errors.length > 0) cannot(`tsconfig.json 有错：${parsed.errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('；')}`)
  return ts.createLanguageService({
    getScriptFileNames: () => parsed.fileNames, getScriptVersion: () => '1', getCompilationSettings: () => parsed.options, getCurrentDirectory: () => root,
    getScriptSnapshot: f => { const t = ts.sys.readFile(f); return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t) },
    getDefaultLibFileName: o => ts.getDefaultLibFilePath(o), fileExists: ts.sys.fileExists, readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory, directoryExists: ts.sys.directoryExists, getDirectories: ts.sys.getDirectories,
  })
}

const where = (f: Field): string => `${f.file} 第 ${f.line} 行 ${f.via}`

function main(): number {
  for (const k of GIT_ENV_DROPPED) delete process.env[k]
  const top = askGit('rev-parse', '--show-toplevel')
  if (top === null) return cannot('这里不是一个 git 仓库')
  const baseline = resolveBaseline(askGit)
  if (baseline.kind === 'cannot-answer') return cannot(`${baseline.why}（${baseline.how}）`)
  if (baseline.kind === 'not-applicable') {
    console.log(`✓ ${NAME}：不适用 —— HEAD 就是 ${baseline.trunk} 且没有父提交`)
    return 0
  }
  const added = changes(baseline.base, top)

  const service = serviceOf(top)
  try {
    const fields = fieldsOf(service, top)
    if (fields.length === 0) cannot('一个字段都没取到')
    const program = service.getProgram()!
    // 字段所在的文件，git 说的行号都得能用（看得见、不是符号链接），由 `outOfSight` 判
    const visible = new Set(zList(ask(['ls-files', '-z', '--full-name', '--cached', '--others', '--exclude-standard', '--', ':(top)'], '列 git 看得见的文件')))
    for (const sf of program.getSourceFiles()) {
      const rel = sf.fileName.startsWith(top + '/') ? sf.fileName.slice(top.length + 1) : sf.fileName
      const why = isJudgedFile(rel) ? outOfSight(rel, visible.has(rel), () => lstatSync(join(top, rel)).isSymbolicLink()) : undefined
      if (why !== undefined) cannot(why)
    }
    const catalog = anchorCatalog(JSON.parse(readFileSync(join(top, 'scripts/check/mutations.json'), 'utf8')))
    if (catalog === undefined) cannot('变异登记表读不出一组变异')
    const marks: Site[] = []
    for (const m of catalog!) {
      const sf = program.getSourceFile(join(top, m.file))
      // 正文取程序里那一份：位置要和赋值处同一个坐标（TypeScript 读文件时去掉 BOM）；不在程序里的文件没有赋值处
      const site = sf === undefined ? undefined : markSite(m.file, sf.text, m.find, m.replace)
      if (site !== undefined) marks.push(site)
    }
    const v = fieldVerdict(fields, added, marks)
    const scope = `${baseline.onTrunk ? `${baseline.trunk} 的上一版` : baseline.trunk}（${baseline.base.slice(0, 7)}）`
    for (const f of v.waived) console.log(`⊘ ${NAME}：${where(f)} 靠豁免放行（${f.waiver}）`)
    if (baseline.onTrunk) {
      console.log(`✓ ${NAME}：HEAD 在主干上，只报数不判定 —— 比 ${scope} 新加 ${v.fresh.length} 个字段，${v.unmarked.length} 个没有变异守着，${v.unjustified.length} 个豁免没写理由`)
      return 0
    }
    for (const f of v.unmarked) console.error(`✗ ${NAME}：${where(f)} 是新加的字段，没有一条变异改到给它赋值的地方，也没写「字段不入断言：<理由>」`)
    for (const f of v.unjustified) console.error(`✗ ${NAME}：${where(f)} 写了豁免标记却没写理由`)
    if (v.red) {
      console.error(`  补一条改坏它的值、会被测试打红的变异（scripts/check/mutations.json），或在声明前写豁免；见 ADR-198`)
      return 1
    }
    console.log(`✓ ${NAME}：比 ${scope} 新加 ${v.fresh.length} 个字段，都有变异守着或写了豁免`)
    return 0
  } finally { service.dispose() }
}

try { process.exitCode = main() } catch (e) {
  if (!(e instanceof CannotAnswer)) throw e
  console.error(`✗ ${NAME}：无从判断 —— ${e.message}`)
  process.exitCode = 1
}
