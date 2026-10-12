/**
 * task.json 里写重复的键（D27）。读入只留最后一处，哪一处是真的只有人知道：
 * 读它的命令在写回与请求之前拒绝，不替用户挑一处留下（ADR-142）。
 */
import type { KeyDuplicate } from './cost-json.js'

/**
 * 每一处写重复的键一条问题：位置、次数与按先后的每一处原文。`outsideProgress` 为真时跳过 D19.k 那几处
 * （根上五个进度键、四张表里的键），它们由 `duplicateProgressProblems` 报，同一处不报两遍。
 * 找不到原文（null）判为无从核对，不当成没有重复。
 */
export function duplicateKeyProblems(duplicates: readonly KeyDuplicate[] | null, outsideProgress = false): string[] {
  void duplicates; void outsideProgress
  return [] // 接口桩
}
