#!/usr/bin/env tsx
/**
 * 增强结果（enrichment.json）的格式说明由 `scripts/lib/types.ts` 里的 `EnrichmentState` 类型生成，不手写（ADR-232）。
 * 生成用的是 ts-json-schema-generator（把 TypeScript 类型转成 JSON Schema 的常用工具）。
 *
 * 检查:  npm run enrichment-schema           入库的那份与现生成的逐字相同才退 0
 * 回写:  npm run enrichment-schema -- --write
 *
 * 改了类型却没回写，需求测试里「格式说明与类型同步」那条当场变红（`d21w-enrichment-schema` 组）。
 * 读入时拿 Ajv 照这份说明整份校验，见 `scripts/lib/enrichment-check.ts`。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from 'ts-json-schema-generator'

/**
 * 入库那份格式说明相对仓库根的位置。写成 `.ts` 模块而不是 `.json`：读它的代码不必按自己所在位置找文件，
 * 检查链预编到别处的那份也照样认得（ADR-158 的预编 JS 不复制 `.json`）。
 */
export const ENRICHMENT_SCHEMA_PATH = 'scripts/lib/enrichment-schema.ts'

/** 按仓库根 `root` 下的类型现生成一份格式说明，返回将要写进那份 `.ts` 的全文 */
export function generateEnrichmentSchema(root: string): string {
  const schema = createGenerator({
    path: join(root, 'scripts/lib/types.ts'),
    tsconfig: join(root, 'tsconfig.json'),
    type: 'EnrichmentState',
    // 类型里没写的键一律不认：拼错的可选格（例如 `follower`）不会被悄悄当成没写
    additionalProperties: false,
    // `@discriminator status` 按 JSON Schema 自己的 if/then 写出，Ajv 不需要额外开关
    discriminatorType: 'json-schema',
    jsDoc: 'extended',
    // 定义名里不做 URL 编码，`Measurement<number>` 这样的名字读得出来
    encodeRefs: false,
  }).createSchema('EnrichmentState')
  return [
    '/**',
    ' * 增强结果（enrichment.json）的格式说明（JSON Schema），由 `scripts/lib/types.ts` 的 `EnrichmentState` 类型生成。',
    ' * **勿手改**：改类型后跑 `npm run enrichment-schema -- --write` 回写（ADR-232）。',
    ' */',
    `export const ENRICHMENT_SCHEMA: Record<string, unknown> = ${JSON.stringify(schema, null, 2)}`,
    '',
  ].join('\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd()
  const fresh = generateEnrichmentSchema(root)
  const file = join(root, ENRICHMENT_SCHEMA_PATH)
  if (process.argv.includes('--write')) {
    writeFileSync(file, fresh)
    console.log(`✓ 已回写 ${ENRICHMENT_SCHEMA_PATH}`)
  } else {
    let onDisk: string | undefined
    try { onDisk = readFileSync(file, 'utf8') } catch { onDisk = undefined }
    if (onDisk !== fresh) {
      console.error(`✗ ${ENRICHMENT_SCHEMA_PATH} 与 scripts/lib/types.ts 现生成的不同；跑 \`npm run enrichment-schema -- --write\` 回写`)
      process.exit(1)
    }
    console.log(`✓ ${ENRICHMENT_SCHEMA_PATH} 与类型同步`)
  }
}
