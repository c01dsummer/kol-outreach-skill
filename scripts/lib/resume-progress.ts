/**
 * 续跑 task.json 的原始进度字段问题。只读，不修复旧任务，也不从别的表推算。
 * 任务列表须先经 taskListProblems 校验；它的长度定义唯一合法的索引范围。
 */
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
sourceToken?: (holder: object, key: string) => string | undefined): string[] {
  const out: string[] = []
  const shown = (value: unknown, holder?: object, key?: string): string => {
    const token = typeof value === 'number' && holder && key !== undefined
      ? sourceToken?.(holder, key) : undefined
    if (token !== undefined) return token
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
    return JSON.stringify(value) ?? String(value)
  }
  const nonnegative = (value: unknown, holder: object, key: string): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    && (sourceToken === undefined || exactProgressInteger(sourceToken(holder, key) ?? '') === BigInt(value))
  const index = (value: unknown, holder: object, key: string): value is number =>
    nonnegative(value, holder, key) && value < taskCount

  if (!Array.isArray(raw.done)) {
    out.push(`done 必须是任务索引数组，这里${Object.hasOwn(raw, 'done') ? `是 ${shown(raw.done)}` : '缺席'}`)
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
      out.push(`${field} 必须是按任务索引记录的对象，这里是 ${shown(table)}`)
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
  return out
}
