#!/usr/bin/env tsx
/**
 * 把整棵 `scripts/` 预编进 `.check-cache/prebuilt/`（ADR-158），检查链里的 `npm run compile`。
 * 排在 `npm run typecheck` 后面：类型对不上的话链在上一步就停了，这里只管转。判定与读写都在 `prebuilt.ts`。
 */
import { prebuildTree } from './prebuilt.js'

const started = performance.now()
const { wrote, kept, removed } = prebuildTree(process.cwd())
console.log(`✓ 预编 JS：写 ${wrote} 份、沿用 ${kept} 份、删 ${removed} 份（${Math.round(performance.now() - started)} 毫秒）`)
