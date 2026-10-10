/** D20：只读检查整份任务输入中的可选项目校准。 */
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const nonblank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export function brandCalibrationProblems(state: unknown): string[] {
  if (!object(state) || !Object.hasOwn(state, 'brand_calibration')) return []
  const calibration = state.brand_calibration
  if (!object(calibration)) return ['brand_calibration 必须是对象；缺席可不填，null 不代表缺席']

  const problems: string[] = []
  if (!nonblank(calibration.version)) problems.push('brand_calibration.version 必须是非空字符串')
  for (const field of ['target_creator_types', 'tone_aesthetic', 'natural_scenarios', 'negative_signals']) {
    const values = calibration[field]
    if (!Array.isArray(values)) {
      problems.push(`brand_calibration.${field} 必须是字符串数组`)
      continue
    }
    for (const [index, value] of values.entries()) {
      if (!nonblank(value)) problems.push(`brand_calibration.${field}[${index}] 必须是非空字符串`)
    }
  }
  if (!Array.isArray(calibration.sources)) problems.push('brand_calibration.sources 必须是来源数组')
  else for (const [index, source] of calibration.sources.entries()) {
    const at = `brand_calibration.sources[${index}]`
    if (!object(source)) {
      problems.push(`${at} 必须是对象`)
      continue
    }
    if (!nonblank(source.source)) problems.push(`${at}.source 必须是非空字符串`)
    if (source.kind !== 'brand_preference' && source.kind !== 'verified_product_fact') {
      problems.push(`${at}.kind 必须是 brand_preference 或 verified_product_fact`)
    }
    if (!nonblank(source.detail)) problems.push(`${at}.detail 必须是非空字符串`)
  }
  return problems
}

/** D20.f：version 是否为内容哈希格式 —— `sha256:` 加 64 位小写十六进制，别的写法都不是。 */
export function isContentVersion(version: unknown): boolean {
  void version
  throw new Error('尚未实现')
}

/** D20.f：brand_calibration 除 version 外全部内容（含 D20.a 未列出的键）的内容哈希；不改写输入。 */
export function calibrationContentVersion(calibration: object): string {
  void calibration
  throw new Error('尚未实现')
}

/**
 * D20.g–D20.i、D20 × P1：brand_calibration 存在、合 D20.a 且 version 为内容哈希格式时按内容复算；
 * 不一致时返回一条指出 brand_calibration.version、并给出复算值的问题，其余情况返回空数组。
 * 不改写输入，不补字段。collect、enrich、render 把它的结果并进 brandCalibrationProblems 的同一份问题清单；
 * 人工反馈模板命令不调用它（D20.j）。
 */
export function calibrationVersionProblems(state: unknown): string[] {
  void state
  throw new Error('尚未实现')
}
