import type { SearchTask } from './types.js'

/** U8：身份来自原任务列表；旧行缺失或非法下标不能由显示位置猜补。 */
export function taskOrdinal(index: unknown): string {
  return typeof index === 'number' && Number.isSafeInteger(index)
    && index >= 0 && index < Number.MAX_SAFE_INTEGER
    ? String(index + 1) : '无从确认'
}

/** as_hashtag 是配置意图，不证明实际发现路径。原词（包括自带的 #）照留。 */
export function taskLabel(task: SearchTask, index: number): string {
  return `任务 ${taskOrdinal(index)} · ${task.dimension} · ${task.platform} · 关键词「${task.keyword}」`
}
