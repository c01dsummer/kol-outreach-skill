import { DIMENSIONS, PLATFORMS, textProblem } from './types.js'
import { taskOrdinal } from './task-label.js'

// 读到的值按 JSON 写法写出；字段缺席时写「缺席」，不写成 undefined 或空白
const seen = (v: unknown): string => v === undefined ? '缺席' : `是 ${JSON.stringify(v)}`
const quoted = (values: readonly string[]) => values.map(v => JSON.stringify(v)).join('、')

/**
 * 搜索任务列表合不合规（D16.a–i，ADR-115）。**合规时交回空数组。**
 *
 * `tasks` 是从任务配置或 task.json 里读出来的原样值，所以收 `unknown`。只判列表本身与三个必填字段
 * （keyword、dimension、platform）；`ig_route` 由 `igRouteProblems` 判（D15.j），别的字段不在这里判。
 * **不改动传入的值**（D16.i）。
 *
 * 交回的每一句写明是哪一处，以及读到的值（按 JSON 写法，字符串带引号；缺席写「缺席」）：
 * - `tasks` 缺席、不是数组或是空数组：只交回一句，点名 `tasks`，不点名任何「任务 N」；
 * - 某一项不是对象（null、数组、字符串、数字、布尔）：这一项一句，写明「任务 N」（从 1 数，同任务标签）；
 * - 某一项是对象：keyword、dimension、platform 每个不合规的字段各一句，写明「任务 N」与字段名。
 *   keyword 用 `textProblem` 的口径；dimension 只认 `DIMENSIONS`、platform 只认 `PLATFORMS`，按原值比较。
 * 每个不合规的任务都报；合规的任务（包括与别的任务完全相同的）一个都不点名。
 */
export function taskListProblems(tasks: unknown): string[] {
  // 列表本身不合规时只报这一句：没有可数的任务，不点名任何「任务 N」。空列表也在这里（ADR-115 第二节）
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [`tasks 必须是至少有一个任务的数组，这里${seen(tasks)}`]
  }
  const out: string[] = []
  // 按下标走，不用 forEach：稀疏数组的空位也要当成一项报出来
  for (let i = 0; i < tasks.length; i++) {
    const t: unknown = tasks[i]
    const at = `任务 ${taskOrdinal(i)}`
    if (t === null || typeof t !== 'object' || Array.isArray(t)) {
      out.push(`${at} 不是一个任务对象，这里${seen(t)}`)
      continue
    }
    // 三个字段互相独立，坏几个报几个（D16.g）；只读不写（D16.i）
    const { keyword, dimension, platform } = t as Record<string, unknown>
    if (textProblem(keyword) !== undefined) {
      out.push(`${at} 的 keyword 必须是去掉首尾空白后仍有内容的字符串，这里${seen(keyword)}`)
    }
    if (!(DIMENSIONS as readonly unknown[]).includes(dimension)) {
      out.push(`${at} 的 dimension 只能是 ${quoted(DIMENSIONS)} 之一（区分大小写），这里${seen(dimension)}`)
    }
    if (!(PLATFORMS as readonly unknown[]).includes(platform)) {
      out.push(`${at} 的 platform 只能是 ${quoted(PLATFORMS)} 之一（区分大小写），这里${seen(platform)}`)
    }
  }
  return out
}
