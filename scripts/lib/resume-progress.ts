/**
 * task.json 的原始进度字段问题（collect 续跑与 render 导出前共用，D19.e、D19.h；重复键 D19.k）。只读，不修复旧任务，也不从别的表推算。
 * 任务列表须先经 taskListProblems 校验；它的长度定义唯一合法的索引范围。
 */
import type { SourceDuplicate } from './cost-json.js'

const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)

/** JSON 数字可以用小数或指数写成整数；按十进制原文计算，绝不先用 Number 舍入。 */
function exactProgressInteger(token: string): bigint | null {
  const parts = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)
  if (!parts) return null
  const fraction = parts[3] ?? ''
  let digits = `${parts[2]}${fraction}`.replace(/^0+/, '')
  if (!digits) return 0n
  if (parts[1] === '-') return null
  const shift = BigInt(parts[4] ?? '0') - BigInt(fraction.length)
  if (shift < 0n) {
    const cut = -shift
    if (cut > BigInt(digits.length)) return null
    if (!digits.endsWith('0'.repeat(Number(cut)))) return null
    digits = digits.slice(0, digits.length - Number(cut))
  } else {
    if (shift > BigInt(16 - digits.length)) return null
    digits += '0'.repeat(Number(shift))
  }
  const value = BigInt(digits)
  return value <= maxSafe ? value : null
}

export function resumeProgressProblems(raw: Readonly<{
  done?: unknown; offsets?: unknown; answered?: unknown; found?: unknown; pages?: unknown
}>, taskCount: number,
sourceToken?: (holder: object, key: string) => string | undefined,
duplicates?: readonly SourceDuplicate[] | null): string[] {
  const out: string[] = []
  // 显示读到的值：每个数字（含整张表位置上的、装在坏容器里的）都按原文 token 写，溢出不显示成 Infinity 或 null（D19.f、D19.i）。
  // 坏容器只展开几层：再深的不是要人改的那一处，也不该为显示它递归到栈溢出（ADR-136 记过深键）
  const shown = (value: unknown, holder?: object, key?: string, depth = 0): string => {
    if (typeof value === 'number') {
      const token = holder && key !== undefined ? sourceToken?.(holder, key) : undefined
      if (token !== undefined) return token
      return Number.isFinite(value) ? JSON.stringify(value) : String(value)
    }
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
    if (depth >= 4) return Array.isArray(value) ? '[…]' : '{…}'
    if (Array.isArray(value)) return `[${value.map((item, i) => shown(item, value, String(i), depth + 1)).join(',')}]`
    return `{${Object.entries(value).map(([k, item]) => `${JSON.stringify(k)}:${shown(item, value, k, depth + 1)}`).join(',')}}`
  }
  const nonnegative = (value: unknown, holder: object, key: string): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    && (sourceToken === undefined || exactProgressInteger(sourceToken(holder, key) ?? '') === BigInt(value))
  const index = (value: unknown, holder: object, key: string): value is number =>
    nonnegative(value, holder, key) && value < taskCount

  if (!Array.isArray(raw.done)) {
    out.push(`done 必须是任务索引数组，这里${Object.hasOwn(raw, 'done') ? `是 ${shown(raw.done, raw, 'done')}` : '缺席'}`)
  } else {
    const seen = new Set<number>()
    for (let position = 0; position < raw.done.length; position++) {
      const value: unknown = raw.done[position]
      if (!index(value, raw.done, String(position)))
        out.push(`done[${position}] 必须是 0 到 ${taskCount - 1} 的安全整数，这里是 ${shown(value, raw.done, String(position))}`)
      else if (seen.has(value)) out.push(`done[${position}] 的任务索引 ${value} 重复`)
      else seen.add(value)
    }
  }

  for (const field of ['offsets', 'answered', 'found', 'pages'] as const) {
    if (!Object.hasOwn(raw, field)) continue // 旧目录缺整张表＝无从确认；绝不补空表。
    const table = raw[field]
    if (table === null || typeof table !== 'object' || Array.isArray(table)) {
      out.push(`${field} 必须是按任务索引记录的对象，这里是 ${shown(table, raw, field)}`)
      continue
    }
    for (const [key, value] of Object.entries(table)) {
      if (!/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(Number(key))
        || Number(key) >= taskCount) {
        out.push(`${field}[${JSON.stringify(key)}] 不是 0 到 ${taskCount - 1} 的标准十进制任务索引`)
      }
      if (!(field === 'found' && value === null)
        && !nonnegative(value, table, key)) {
        out.push(`${field}[${JSON.stringify(key)}] 必须是非负安全整数${field === 'found' ? '或 null' : ''}，这里是 ${shown(value, table, key)}`)
      }
    }
  }

  // D19.k：重复的进度键读进来的只有最后一处，前面的在整份写回时会消失；哪一处是真的只有人知道，不按留下的那处放行
  if (duplicates === null) out.push('找不到这份任务读入时的原文，无从核对进度键有没有写重复')
  for (const { parent, key, values } of duplicates ?? []) {
    const at = parent === undefined
      ? (['done', 'offsets', 'answered', 'found', 'pages'].includes(key) ? key : undefined)
      : (['offsets', 'answered', 'found', 'pages'].includes(parent) ? `${parent}[${JSON.stringify(key)}]` : undefined)
    if (at !== undefined)
      out.push(`${at} 在文件里写了 ${values.length} 次，依次是 ${values.join('、')}；读入只留最后一处，哪一处是真的要人来定`)
  }
  return out
}
