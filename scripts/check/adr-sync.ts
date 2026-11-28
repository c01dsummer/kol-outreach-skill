#!/usr/bin/env tsx
/**
 * 决策记录:一条一个文件,索引由本脚本生成。
 *
 * 检查:  tsx scripts/check/adr-sync.ts
 * 回写:  tsx scripts/check/adr-sync.ts --write
 *
 * ⚠️ 证不了记录写得对。它保证的是编号唯一、文件名与正文一致、索引不漂移，
 * 历史文件跟着一条还在的记录、钉住的旧内容只加不删（ADR-211，主文件只放现行结论那一份）。
 *
 * 读、判、比、回写全在 `adr-rule.ts` 的 `adrSync`，需求测试在玩具目录上直接调它；这里只剩打印、退出码，
 * 和把真 git 交给它（拿主干上的指纹表再比一遍）。
 *
 * 另核一遍条件探针的登记表（`condition-rule.ts` 的 `conditionFaults`，ADR-252）：绑的台账条目还在、种类对、欠条还开着。
 * 不放进 `adrSync`：需求测试在玩具目录上调 `adrSync`，那里没有登记表绑的那些真记录；核对的判定在玩具台账上另有一组测试直接调。
 * `--conditions <文件>` 换一份登记表，只给入口测试用（`registryArg`）；写错以 2 退出。
 */
import { adrSync } from './adr-rule.js'
import { conditionFaults, pathKind, registryArg } from './condition-rule.js'
import { adrDocs } from './debt-rule.js'
import { askGit } from './git-entry.js'

const registry = registryArg(process.argv.slice(2))
if ('error' in registry) {
  console.error(registry.error)
  // 设退出码、自然退出：硬退出会掐掉管道里还没写完的诊断（ADR-70 那张「硬退出收口只到 mutate.ts」）
  process.exitCode = 2
} else {
  if (registry.note !== undefined) console.error(registry.note)
  const r = adrSync('.', process.argv.includes('--write'), askGit)
  for (const line of r.out) console.log(line)
  for (const line of r.err) console.error(line)
  const faults = conditionFaults(registry.table, adrDocs(), pathKind)
  for (const line of faults) console.error(line)
  process.exitCode = r.ok && faults.length === 0 ? 0 : 1
}
