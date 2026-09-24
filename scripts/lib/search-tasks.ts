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
  return []
}
