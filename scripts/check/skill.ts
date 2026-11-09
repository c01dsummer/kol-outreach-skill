#!/usr/bin/env tsx
/**
 * Skill 结构检查的入口（`npm run skill`，ADR-156 第十四节）—— 检查链里紧跟 `npm run spec` 的那一步。
 *
 * 只读、打印、设退出码：五样怎么判全在 `skill-rule.ts` 的 `skillFaults`（`docs/CONVENTIONS.md` 第 10 条）。
 * 这里只把真树读成那四样输入：`skill/` 下的 `.md`、`package.json` 的命令名、`scripts/` 下的文件清单、
 * git 索引里 `.claude/skills/` 与 `.agents/skills/` 下的条目。软链读索引不读文件系统（ADR-156 第四节）。
 *
 * 读不到的一样交 `undefined`，不交空清单：判定把它报成第 0 类，于是读不到也以 1 退出（第二节）。
 * 交一个空清单，就是把「没读到」说成「读到了、一个也没有」—— 第 4、5 样会照着它把每处命令、
 * 每个脚本都报成不在，第 2 样会说两个软链都没有，指的都不是真正的毛病。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { type IndexEntry, type SkillDoc, skillFaults } from './skill-rule.js'
import { GIT_CONFIG } from './size-rule.js'

/** 一个目录下（含子目录）不是目录的条目，路径用 `/` 接；只往真目录里走，软链指着的目录不进。任何一层列不出来就抛 */
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
const listed = (dir: string): string[] | undefined => { try { return walk(dir).sort() } catch { return undefined } }
const text = (path: string): string | undefined => { try { return readFileSync(path, 'utf8') } catch { return undefined } }

const docs: SkillDoc[] | undefined = listed('skill')?.filter(p => p.endsWith('.md')).map(path => ({ path, text: text(path) }))

const commands = ((): string[] | undefined => {
  try {
    const scripts: unknown = JSON.parse(readFileSync('package.json', 'utf8')).scripts
    return typeof scripts === 'object' && scripts !== null && !Array.isArray(scripts) ? Object.keys(scripts) : undefined
  } catch { return undefined }
})()

const scriptFiles = listed('scripts')

const git = (...args: string[]): string => execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
/** `git ls-files -s -z` 的一条：`<mode> <blob> <stage>`，一个制表符，再接路径 */
const ENTRY = /^(\d{6}) ([0-9a-f]+) \d\t(.+)$/s
const links = ((): IndexEntry[] | undefined => {
  try {
    const out: IndexEntry[] = []
    for (const raw of git('ls-files', '-s', '-z', '--', '.claude/skills', '.agents/skills').split('\0')) {
      if (raw === '') continue
      const m = ENTRY.exec(raw)
      if (m === null) return undefined
      const [, mode, blob, path] = m
      out.push({ path, mode, target: mode === '120000' ? git('cat-file', 'blob', blob) : undefined })
    }
    return out
  } catch { return undefined }
})()

const faults = skillFaults({ docs, commands, scriptFiles, links })
if (faults.length === 0) {
  console.log(`✓ Skill 结构：五样都成立（文档 ${docs?.length} 份 · 命令 ${commands?.length} 个 · scripts/ 下文件 ${scriptFiles?.length} 份 · 软链条目 ${links?.length} 个）`)
} else {
  console.error(`✗ Skill 结构：${faults.length} 处问题`)
  for (const f of faults) {
    const at = f.line === undefined ? f.file : `${f.file}:${f.line}`
    console.error(`  ${at}  ${f.item === 0 ? '读不到' : `第 ${f.item} 样`} · ${f.fix}`)
  }
  // 设退出码、不硬退出：硬退出可能把管道上还没写完的那几行截掉（`adr-ledger.ts` 同一条）
  process.exitCode = 1
}
