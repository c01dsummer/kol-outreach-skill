import type { SearchTask } from './types.js'

/**
 * 任务配置里的 IG 路线哪里不合规（D15.j，ADR-112 第二节）。**合规时交回空数组。**
 *
 * `tasks` 是从配置或断点里读出来的原样数组，所以收 `unknown`：这里只看路线这一件事，
 * 任务列表本身是不是数组、每项是不是对象，不在这里判（不是数组时交回空数组，交给别处）。
 *
 * 每个不合规的任务交回一句话，**写明是第几个任务（从 1 数，同任务标签）与哪一条不合规**：
 * - `ig_route` 出现了、却不是字符串 `"hashtag"`（包括 `null`、空串、大小写不同、别的路线名）；
 * - `ig_route` 为 `"hashtag"`、却写在非 Instagram 任务上；
 * - `ig_route` 为 `"hashtag"`、关键词去掉一个开头的 `#` 之后为空，或含空白（空格、制表符、换行等）。
 *
 * 调用方（collect 的新建与续跑、probe）有问题就以退出码 2 结束，在建目录、预留与请求之前 —— 零请求。
 */
export function igRouteProblems(tasks: unknown): string[] {
  if (!Array.isArray(tasks)) return []
  const out: string[] = []
  tasks.forEach((t: any, i) => {
    if (t === null || typeof t !== 'object' || t.ig_route === undefined) return
    const at = `任务 ${i + 1}`
    // 每个任务只报一句：先说最根本的那一条，后面的在它改对之前没有意义
    if (t.ig_route !== 'hashtag') {
      out.push(`${at} 的 ig_route 只能是 "hashtag" 或不写，这里是 ${JSON.stringify(t.ig_route)}`)
    } else if (t.platform !== 'instagram') {
      out.push(`${at} 写了 ig_route "hashtag"，但它是 ${JSON.stringify(t.platform)} 任务 —— 话题路线只属于 Instagram`)
    } else {
      const query = typeof t.keyword === 'string' ? hashtagKeyword(t) : ''
      if (query === '' || /\s/.test(query)) {
        out.push(`${at} 写了 ig_route "hashtag"，关键词 ${JSON.stringify(t.keyword)} 去掉开头的 # 之后为空或含空白 —— 话题搜索只认一个不含空白的话题词`)
      }
    }
  })
  return out
}

/**
 * 话题搜索的请求关键词：任务关键词去掉**一个**开头的 `#`（D15.k）。只用于请求参数 ——
 * 来源、任务标签、关键词行照用原关键词。`##tag` 只去掉一个，变成 `#tag`；不修剪空白（空白在校验里就拒了）。
 */
export function hashtagKeyword(task: Pick<SearchTask, 'keyword'>): string {
  return task.keyword.startsWith('#') ? task.keyword.slice(1) : task.keyword
}
