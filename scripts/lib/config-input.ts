import { textProblem } from './types.js'

export type ConfigInputRole = 'new' | 'resume' | 'probe'

// JSON 会把非有限数写成 null；直接调用还可能给到 JSON 没有的类型。
const seen = (value: unknown): string => {
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return `${value}n`
  return JSON.stringify(value) ?? String(value)
}

/**
 * 原始配置的市场与目标人数问题（D17，ADR-116）；合规时返回空数组。
 * 只认自有字段：存在的 market 必须是非空白字符串；collect 的 target_count 必须是有限数。
 * new 允许二者缺席，resume 二者必填；probe 允许 market 缺席且不检查 target_count。
 * 每个问题写明字段与原值，缺席、显式 undefined、null 和非有限数可区分。
 * 不修改输入、不套默认、不转换类型；市场原空白/大小写、人数 0/负数/小数均不另加限制。
 * 根对象由读取边界负责，本函数不定义根数组/null 的配置语义。
 */
export function configFieldProblems(
  raw: Readonly<{ market?: unknown; target_count?: unknown }>,
  role: ConfigInputRole,
): string[] {
  const out: string[] = []
  const fields = role === 'probe' ? ['market'] as const : ['market', 'target_count'] as const
  for (const field of fields) {
    if (!Object.hasOwn(raw, field)) {
      if (role === 'resume') out.push(`${field} 缺席，续跑必须保留原配置`)
      continue
    }
    const value = raw[field]
    const valid = field === 'market' ? textProblem(value) === undefined
      : typeof value === 'number' && Number.isFinite(value)
    if (!valid) {
      const expected = field === 'market' ? '非空白字符串' : '有限数值'
      out.push(`${field} 必须是${expected}，这里是 ${seen(value)}`)
    }
  }
  return out
}
