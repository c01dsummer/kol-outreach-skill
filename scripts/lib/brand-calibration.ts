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
