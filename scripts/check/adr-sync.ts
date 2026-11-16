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
 * 读、判、比、回写全在 `adr-rule.ts` 的 `adrSync`，需求测试在玩具目录上直接调它；这里只剩打印与退出码。
 */
import { adrSync } from './adr-rule.js'

const r = adrSync('.', process.argv.includes('--write'))
for (const line of r.out) console.log(line)
for (const line of r.err) console.error(line)
process.exit(r.ok ? 0 : 1)
