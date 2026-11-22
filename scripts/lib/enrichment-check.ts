/**
 * D21.w（ADR-232）：读增强结果（enrichment.json）时整份对照格式说明。
 *
 * 格式说明不手写，由 `types.ts` 的 `EnrichmentState` 生成（`scripts/lib/enrichment-schema.ts`）；
 * 校验用 Ajv（JSON Schema 的常用校验器），不逐项手写判断。这里只做两件事：
 * 第一次用到时编好校验函数，把 Ajv 给的每一处不合规翻成一句点名文件、账号、哪一格、读到什么的话。
 *
 * 同一格缺了几项合成一句（「缺了 value、source」），免得一个漏写的三态包装报出五六句。
 * Ajv 为按 status 分支的那一层另报的「没满足 then」不单独成句：它下面那几句已经说清了是哪一格。
 */
import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv'
import { ENRICHMENT_SCHEMA } from './enrichment-schema.js'

let validate: ValidateFunction | undefined
const validator = (): ValidateFunction => {
  validate ??= new Ajv({ allErrors: true, verbose: true, strict: true }).compile(ENRICHMENT_SCHEMA)
  return validate
}

/** 原值按 JSON 写法给出，过长截短；嵌套深到印不出时照直说 */
const shown = (value: unknown): string => {
  let text: string | undefined
  try { text = JSON.stringify(value) } catch { return '一个嵌套太深、印不出来的值' }
  if (text === undefined) return `一个 JSON 写不出的值（${typeof value}）`
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}

const TYPE_WORDS: Record<string, string> = {
  number: '数字', integer: '整数', string: '文字（带引号）', boolean: 'true 或 false', object: '对象（{…}）', array: '数组（[…]）', null: 'null',
}
const typeWords = (type: unknown): string =>
  (Array.isArray(type) ? type : [type]).map(t => TYPE_WORDS[String(t)] ?? String(t)).join(' 或 ')

/** JSON Pointer 的一段还原成键名（`~1` 是 `/`，`~0` 是 `~`） */
const unescape = (segment: string): string => segment.replace(/~1/g, '/').replace(/~0/g, '~')

/** 把 `/accounts/tiktok:abc/metrics/view_rate` 说成「账号 tiktok:abc 的 metrics.view_rate」 */
function where(file: string, pointer: string): string {
  const parts = pointer === '' ? [] : pointer.slice(1).split('/').map(unescape)
  if (parts[0] === 'accounts' && parts.length >= 2) {
    const rest = parts.slice(2)
    return `${file} 里账号 ${parts[1]}${rest.length ? ` 的 ${rest.join('.')}` : ''}`
  }
  return parts.length ? `${file} 的 ${parts.join('.')}` : `${file} 的最外层`
}

/** 粉丝数、关注数写错时多给一句去哪改：enrich 会从名单抄这两样，只删增强结果里这一格、名单不改的话下次又抄回来 */
const countHint = (pointer: string): string =>
  /^\/accounts\/[^/]+\/(followers|following)$/.test(pointer)
    ? '；这个数可能是 enrich 从名单（creators.raw.json 或 creators.json）抄来的，名单里同一个账号的这一格也要一起改正'
    : ''

function sentence(file: string, error: ErrorObject): string | undefined {
  const at = where(file, error.instancePath)
  const params = error.params as Record<string, unknown>
  switch (error.keyword) {
    case 'type':
      return `${at} 应是${typeWords(params.type)}，读到 ${shown(error.data)}${countHint(error.instancePath)}`
    case 'enum':
      return `${at} 应是 ${(params.allowedValues as unknown[]).map(shown).join('、')} 之一，读到 ${shown(error.data)}`
    case 'const':
      return `${at} 应是 ${shown(params.allowedValue)}，读到 ${shown(error.data)}`
    case 'additionalProperties':
      return `${at} 多了格式说明里没有的一格 ${shown(params.additionalProperty)}（可能是拼错了，或者不该写在这一层）`
    case 'if':
      return undefined
    default:
      return `${at} 不合格式说明：${error.message ?? error.keyword}`
  }
}

/**
 * 按格式说明整份查一遍，每处不合规一句话；合规时是空数组。
 * `file` 只用来写进报错，说是哪个文件。
 */
export function enrichmentSchemaProblems(file: string, state: unknown): string[] {
  const check = validator()
  if (check(state)) return []
  // 按 Ajv 报的先后排；同一格缺的几项挂在那一格第一次出现的位置，合成一句
  const lines: Array<string | { path: string; missing: string[] }> = []
  const missingAt = new Map<string, { path: string; missing: string[] }>()
  for (const error of check.errors ?? []) {
    if (error.keyword === 'required') {
      let entry = missingAt.get(error.instancePath)
      if (!entry) {
        entry = { path: error.instancePath, missing: [] }
        missingAt.set(error.instancePath, entry)
        lines.push(entry)
      }
      entry.missing.push(String((error.params as Record<string, unknown>).missingProperty))
      continue
    }
    const text = sentence(file, error)
    if (text !== undefined) lines.push(text)
  }
  return lines.map(line => typeof line === 'string'
    ? line
    : `${where(file, line.path)} 缺了 ${line.missing.join('、')}（格式说明里这几格必有）`)
}
