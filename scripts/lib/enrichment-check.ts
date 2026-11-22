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
  // JSON 读不出 NaN；1e999 这样的写法读进来是 Infinity，JSON.stringify 会印成 null，照数说
  if (typeof value === 'number' && !Number.isFinite(value)) return `${value}（读成了无穷大，多半是数字写得太大）`
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

/** 粉丝数、关注数写错时多给一句去哪改：旧版 enrich 会把名单里不是数的这两样原样抄进来（本条起不再抄，D21.x），所以错的源头多半在名单，只改增强结果、名单不改的话名单那边照样是错的 */
const countHint = (pointer: string): string =>
  /^\/accounts\/[^/]+\/(followers|following)$/.test(pointer)
    ? '；这个数可能是旧版 enrich 从名单（creators.raw.json 或 creators.json）抄来的，名单里同一个账号的这一格多半也写错了，一起改正'
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
    case 'minLength':
      return `${at} 不能是空的，读到 ${shown(error.data)}`
    case 'additionalProperties':
      return `${at} 多了格式说明里没有的一格 ${shown(params.additionalProperty)}（可能是拼错了，或者不该写在这一层）`
    case 'if':
      return undefined
    default:
      return `${at} 不合格式说明：${error.message ?? error.keyword}`
  }
}

const STATUS_HINT = '；这一格是三态包装，先写 status（"measured" 已测，或 "unavailable" 不可用），这一格里别的问题补上 status 后再跑会接着报'

/** Ajv 的这一条出自按 status 分的某一支（`allOf/…/then`），而不是三态包装外层 */
const fromBranch = (error: ErrorObject): boolean => error.schemaPath.includes('/then/')

/**
 * 去掉会把人带偏的几条，剩下的才翻成话：
 * - 三态包装没写 status、或者整格不是对象时，生成的 if 两支都算成立（JSON Schema 里 if 只看写了的键），
 *   两支各报一遍「缺了 value」「缺了 reason」「多了 value」，照做会删掉正确的内容。外层已经报了「缺了 status」或「应是对象」，
 *   这一格由分支报的、以及这一格里面更深处报的全部丢掉（不知道该照哪一支查），那句话里提示补上 status 后再跑会接着报。status 写了却不是那两个值时两支都不成立，本来就只有外层那一句。
 * - 同一格类型就不对时（`version` 写成 `"1"`），不再另报「应是 1」：先把类型改对。
 */
function relevant(errors: ErrorObject[]): ErrorObject[] {
  const noBranch = new Set<string>()
  const wrongType = new Set<string>()
  for (const e of errors) {
    if (fromBranch(e)) continue
    if (e.keyword === 'required' && (e.params as Record<string, unknown>).missingProperty === 'status') noBranch.add(e.instancePath)
    if (e.keyword === 'type') { noBranch.add(e.instancePath); wrongType.add(e.instancePath) }
  }
  const under = (path: string): boolean => [...noBranch].some(p => path.startsWith(`${p}/`))
  return errors.filter(e => {
    if (fromBranch(e) && noBranch.has(e.instancePath)) return false
    // 这一格里面更深的（例如 value 里的金额）：不知道该照哪一支查，先不报，补上 status 再跑会接着报
    if (under(e.instancePath)) return false
    if ((e.keyword === 'const' || e.keyword === 'enum') && wrongType.has(e.instancePath)) return false
    return true
  })
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
  for (const error of relevant(check.errors ?? [])) {
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
    : `${where(file, line.path)} 缺了 ${line.missing.join('、')}（格式说明里这几格必有）${line.missing.includes('status') ? STATUS_HINT : ''}`)
}
