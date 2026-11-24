#!/usr/bin/env tsx
/**
 * 存下来的数据的形状快照的检查与回写入口（ADR-246）。判定在 `data-shapes-rule.ts`，这里只剩读写一个文件与打印。
 *
 * 检查:  npm run data-shapes            快照与按当前类型现生成的一样才退 0，不一样点名是哪几类
 * 回写:  npm run data-shapes -- --write
 *
 * 检查链里守它的是需求测试组 h-data-shapes（调同一个生成函数），不是这个入口。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateShapes, SHAPES_SNAPSHOT_PATH, shapeChanges } from './data-shapes-rule.js'

const root = process.cwd()
const file = join(root, SHAPES_SNAPSHOT_PATH)
const fresh = generateShapes(root)
if (process.argv.includes('--write')) {
  writeFileSync(file, fresh)
  console.log(`✓ 已回写 ${SHAPES_SNAPSHOT_PATH}`)
} else {
  let onDisk: string | undefined
  try { onDisk = readFileSync(file, 'utf8') } catch (e) {
    // 只有「不在」才算不在；别的读不出（没权限、是目录）照实说
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') { console.error(`✗ 读不出 ${SHAPES_SNAPSHOT_PATH}：${(e as Error).message}`); process.exit(1) }
    onDisk = undefined
  }
  const changes = shapeChanges(onDisk, fresh)
  if (changes.length > 0) {
    for (const c of changes) console.error(`✗ ${c}`)
    console.error('  先照 process/3-BUILD.md 第 9 条写明缺着怎么读、该不该升版本，再跑 npm run data-shapes -- --write 回写')
    process.exit(1)
  }
  console.log(`✓ ${SHAPES_SNAPSHOT_PATH} 与类型同步`)
}
