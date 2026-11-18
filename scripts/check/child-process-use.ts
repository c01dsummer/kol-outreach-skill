#!/usr/bin/env tsx
/**
 * 起子进程接口闸门的入口（`npm run child-process-use`，检查链里排在外部工单号闸门之后）。
 *
 * 只起 git、读文件、打印、交回退出码；认哪几处、怎么比、什么时候红都在 `child-process-use-rule.ts`（ADR-217）。
 * 起点与体量闸门同一个判定（`size-rule.ts` 的 `resolveBaseline`）。扫的是工作区里的受控文件加上没被忽略的新文件
 * （`git ls-files -z`，空字符分隔，路径不加引号）。无从判断时说出来、以 1 结束，不退化成「通过」。
 * 本文件自己也在登记表的「待挪」里：git 入口有了之后挪过去。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GIT_CONFIG, resolveBaseline } from './size-rule.js'
import { type BaselineRegistry, type Site, REGISTRY_PATH, RULE_PATH, baselineFromFacts, goneFromWorktree, isScanned, judgeUse, launchSites, parseRegistry, useLines } from './child-process-use-rule.js'

function tryGit(...args: string[]): string | null {
  try {
    return execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
const trimmed = (...args: string[]) => tryGit(...args)?.trim() ?? null

function cannotAnswer(why: string): number {
  console.error(`✗ 起子进程的接口：无从判断 —— ${why}`)
  return 1
}

/** 基线那份登记表：这里只问 git，算哪一种在 `baselineFromFacts`。 */
function baselineRegistry(base: string): BaselineRegistry | string {
  // --full-tree：路径从仓库根算，在子目录里跑也问得对
  const has = (path: string) => tryGit('ls-tree', '-z', '--full-tree', '--name-only', base, '--', path)
  return baselineFromFacts(has(REGISTRY_PATH), has(RULE_PATH), () => tryGit('cat-file', 'blob', `${base}:${REGISTRY_PATH}`))
}

function main(): number {
  const baseline = resolveBaseline(trimmed)
  if (baseline.kind === 'cannot-answer') return cannotAnswer(`${baseline.why}（${baseline.how}）`)
  const root = trimmed('rev-parse', '--show-toplevel')
  const listed = tryGit('ls-files', '-z', '--full-name', '--cached', '--others', '--exclude-standard', '--', ':(top)')
  if (root === null || listed === null) return cannotAnswer('`git ls-files` 出错了')
  const sites = new Map<string, Site[]>()
  for (const path of new Set(listed.split('\0').filter(Boolean))) {
    if (!isScanned(path)) continue
    let text: string
    try { text = readFileSync(join(root, path), 'utf8') } catch (e) {
      if (goneFromWorktree(e)) continue // 受控却已从工作区删掉的文件：不在仓库里
      return cannotAnswer(`${path} 读不了：${(e as Error).message}`)
    }
    sites.set(path, launchSites(path, text))
  }
  let now
  try { now = parseRegistry(readFileSync(join(root, REGISTRY_PATH), 'utf8')) } catch (e) { return cannotAnswer(`登记表 ${REGISTRY_PATH} 读不了或解析不了：${(e as Error).message}`) }
  const base: BaselineRegistry | string = baseline.kind === 'not-applicable' ? { kind: 'no-gate' } : baselineRegistry(baseline.base)
  if (typeof base === 'string') return cannotAnswer(base)
  const onTrunk = baseline.kind === 'not-applicable' || baseline.onTrunk
  const scope = baseline.kind === 'not-applicable' ? `${baseline.trunk}（没有上一版）`
    : `${baseline.onTrunk ? `${baseline.trunk} 的上一版` : baseline.trunk}（${baseline.base.slice(0, 7)}）`
  const { ok, out, err } = useLines(judgeUse(sites, now, base), onTrunk, scope, base.kind === 'no-gate')
  for (const line of out) console.log(line)
  for (const line of err) console.error(line)
  return ok ? 0 : 1
}

process.exitCode = main()
