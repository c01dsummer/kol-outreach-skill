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
 */
import { execFileSync } from 'node:child_process'
import { adrSync } from './adr-rule.js'
import { GIT_CONFIG } from './size-rule.js'

/** 答得上来交回去掉首尾空白的输出，答不上来交回 `null`（同体量闸门的 `tryGit`） */
function tryGit(...args: string[]): string | null {
  try {
    return execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch { return null }
}

const r = adrSync('.', process.argv.includes('--write'), tryGit)
for (const line of r.out) console.log(line)
for (const line of r.err) console.error(line)
// 设退出码、自然退出：硬退出会掐掉管道里还没写完的诊断（ADR-70 那张「硬退出收口只到 mutate.ts」）
process.exitCode = r.ok ? 0 : 1
