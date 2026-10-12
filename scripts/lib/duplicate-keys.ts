/**
 * task.json 里写重复的键（D27）。读入只留最后一处，哪一处是真的只有人知道：
 * 读它的命令在写回与请求之前拒绝，不替用户挑一处留下（ADR-142）。
 */
import type { KeyDuplicate } from './cost-json.js'

const PROGRESS_ROOT = new Set(['done', 'offsets', 'answered', 'found', 'pages'])
const PROGRESS_TABLES = new Set(['offsets', 'answered', 'found', 'pages'])

/** D19.k 那几处：根上的五个进度键，四张表里的键 */
const inProgress = (path: readonly (string | number)[]): boolean => path.length === 1
  ? PROGRESS_ROOT.has(path[0] as string)
  : path.length === 2 && PROGRESS_TABLES.has(path[0] as string)

/** 根上的键照写，往下对象里的键写成 ["键"]、数组里的下标写成 [下标]，与 D19.k 的 found["0"] 同一种写法 */
const where = (path: readonly (string | number)[]): string => path
  .map((step, i) => typeof step === 'number' ? `[${step}]` : i === 0 ? step : `[${JSON.stringify(step)}]`).join('')

/**
 * 每一处写重复的键一条问题：位置、次数与按先后的每一处原文。`outsideProgress` 为真时跳过 D19.k 那几处
 * （根上五个进度键、四张表里的键），它们由 `duplicateProgressProblems` 报，同一处不报两遍。
 * 找不到原文（null）判为无从核对，不当成没有重复。
 */
export function duplicateKeyProblems(duplicates: readonly KeyDuplicate[] | null, outsideProgress = false): string[] {
  if (duplicates === null) return ['找不到这份任务读入时的原文，无从核对有没有写重复的键']
  return duplicates.filter(({ path }) => !(outsideProgress && inProgress(path))).map(({ path, values }) =>
    `${where(path)} 在文件里写了 ${values.length} 次，依次是 ${values.join('、')}；读入只留最后一处，哪一处是真的要人来定`)
}
