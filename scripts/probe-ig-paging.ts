#!/usr/bin/env tsx
/**
 * IG Reels 搜索到底收不收分页参数 —— 一次性核实工具（ADR-94 那张欠条）。
 *
 * ## 它回答哪一个问题
 *
 * `skill/references/providers/tikhub.md` 与 `providers/tikhub.ts` 都写着「Reels 搜索
 * **没有分页游标**」，而这句话**整个 IG 侧的召回上限论证都压在它上面**。
 * 它的证据只有一句：「响应只有 `count` 和 `items`」—— 那是**响应**那一侧的观测，
 * 而「请求收不收 offset」从来没有人试过。两件事不是一回事。
 *
 * 所以这个脚本不走 `providers/tikhub.ts`：那一份只取 `data.data.items`，别的一律扔掉，
 * 「响应只有 count 和 items」正是这么来的 —— 没有人看过整份响应。这里发原始请求、
 * 打整份响应的键路径。
 *
 * ## ⚠️ 怎么读它的结论：只有三种判词，**没有「不支持」这一种**
 *
 * | 判词 | 什么时候打 | 它到底说了什么 |
 * |---|---|---|
 * | **认了** | 条目集与基线不同，且基线自己两次一致 | 服务端确实按这个参数换了结果 —— 这是个肯定结论 |
 * | **这一次没多给** | 条目集与基线相同 | **只有这么多。** 未知的查询参数常被服务端静默忽略，「传了没变化」与「这个参数不存在」在这个观测下**不可区分** |
 * | **作废** | 基线自己两次就不一样 | 这个端点在漂，本次全部对比都不作数，一个参数也别判 |
 *
 * 把「这一次没多给」读成「不支持分页」，就是 `process/1-REQUIREMENTS.md` 里禁的那种
 * 「把不确定伪装成确定」—— 而且方向最坏：它会让下一个人不再试，那句承重话就永远没人验。
 *
 * ## 用法（要一把**充过值**的 key，IG 端点不吃免费额度，恒 402）
 *
 *   npm run probe:ig-paging -- --keyword smoothie
 *
 * 每跑一次发几个请求：基线重跑一次做对照，`VARIANTS` 里每个参数各一次。
 * **这个形状不是散文里的一个数** —— 自检 `ig-paging-probe` 那组里
 * 「基线真的跑了两次」那条断言拿 `requests` 跟它对，改了这里的请求次数
 * 而不改那条断言，检查链当场红（负片 `M-H44-b` 守着它）。
 *
 * 花了多少看输出的 `cost_estimate_usd`。⚠️ 那是**估算**：请求数乘以
 * `lib/budget.ts` 里我们自己写死的单价，不是 TikHub 的账单。
 */
import { TikHubError, pickList } from './providers/tikhub.js'
import { Budget, UNIT_PRICE } from './lib/budget.js'

const BASE = 'https://api.tikhub.io'
const PATH = '/api/v1/instagram/v2/search_reels'

/** 试哪几个参数名。**只加不改** —— 换掉一个就少验一个，而少验的那个不会有人提醒你。 */
const VARIANTS: { name: string; extra: Record<string, string | number> }[] = [
  { name: 'count=50', extra: { count: 50 } },
  { name: 'offset=12', extra: { offset: 12 } },
  { name: 'page=2', extra: { page: 2 } },
  { name: 'max_id=12', extra: { max_id: 12 } },
]

/** 名字里带这些字样的键值得单独点出来 —— 有一个就说明游标可能一直在响应里。 */
const CURSOR_HINT = /cursor|max_id|next|page|has_more|more_available|token/i

/**
 * 按键路径把值取出来。**只打键名不够** —— 2026-09-22 那一跑在响应里发现了
 * `data.pagination_token`，而「它是 null 还是真有个 token」才是下一步要问的，
 * 光有键名答不了。值截断到能认出形状为止，不整份抄进输出。
 */
function valueAt(root: unknown, path: string): string {
  let cur: any = root
  for (const seg of path.split('.')) {
    const m = /^(.*)\[0\]$/.exec(seg)
    cur = cur?.[m ? m[1] : seg]
    if (m) cur = cur?.[0]
    if (cur === undefined || cur === null) break
  }
  return cur === undefined ? '(缺)' : cur === null ? 'null' : JSON.stringify(cur).slice(0, 120)
}

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  const v = i < 0 ? undefined : process.argv[i + 1]
  return v === undefined || v.startsWith('--') ? undefined : v
}

const keyword = arg('keyword')
if (!keyword) {
  console.error('用法: npm run probe:ig-paging -- --keyword smoothie')
  process.exit(2)
}
const key = process.env.TIKHUB_API_KEY
if (!key) {
  console.error('缺少 TIKHUB_API_KEY。IG 端点不吃免费额度，要一把充过值的 —— 没充值时恒 402。')
  process.exit(2)
}

/** 整份响应的键路径。数组只下钻第一个元素：要的是形状，不是全文。 */
function keyPaths(v: unknown, prefix = '', out: string[] = [], depth = 0): string[] {
  if (depth > 5 || v === null || typeof v !== 'object') return out
  if (Array.isArray(v)) {
    if (v.length) keyPaths(v[0], `${prefix}[0]`, out, depth + 1)
    return out
  }
  for (const [k, val] of Object.entries(v)) {
    const p = prefix ? `${prefix}.${k}` : k
    out.push(p)
    keyPaths(val, p, out, depth + 1)
  }
  return out
}

/**
 * 条目的身份。**用哪一种要打出来** —— 拿不到稳定标识时退回「用户名＋文案前 60 字」，
 * 而那一种在同一个人连发两条相似内容时会把两条当成一条。读的人得知道自己在比什么。
 */
function identify(list: any[]): { by: string; ids: string[] } {
  const direct = list.map(it => it?.id ?? it?.pk ?? it?.media?.id ?? it?.media?.pk)
  if (direct.every(x => x !== undefined && x !== null)) {
    return { by: '条目自带的 id', ids: direct.map(String) }
  }
  return {
    by: '用户名 ＋ 文案前 60 字（条目上没有稳定标识，相似内容会被当成同一条）',
    ids: list.map(it => `${it?.user?.username ?? it?.media?.user?.username ?? '?'}|`
      + `${String(it?.caption?.text ?? '').slice(0, 60)}`),
  }
}

const budget = new Budget(1)
/**
 * `b` 里有、`a` 里没有的那些。**分页要问的是「多拿到了几个」，不是「一不一样」** ——
 * 按顺序比整张列表的话，服务端只是把同一批换个次序返回，就会被判成「认了」，
 * 而那恰好是这个工具最重的那句肯定结论。
 */
const freshOf = (a: string[], b: string[]) => b.filter(x => !a.includes(x))

/**
 * 发一次请求。**非 200 直接抛，不重试** —— 与 `providers/tikhub.ts` 的 `get()` 不同，
 * 那一份会对 429 退避重试三次，于是它的 `requests` 是净计数、可以小于 HTTP 尝试次数。
 *
 * 这里刻意不那样：异常穿过 `main()` 落到末尾的 `catch`，打一句诊断就非零退出，
 * **那份 JSON 一个字都不会打印**。所以反过来成立 —— **输出存在 ⇒ 每一次都是 200 ⇒
 * `requests` 就是真发出去的次数**。读这个数的人不必再去想退费那一层。
 *
 * （这一条被评审误读过一次，按 `get()` 的语义指出「`requests` 不等于尝试次数」。
 * 在这里不成立，但那说明光看调用点看不出来，所以写在这儿。）
 */
async function ask(extra: Record<string, string | number>): Promise<any> {
  const url = new URL(PATH, BASE)
  url.searchParams.set('keyword', keyword!)
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, String(v))
  budget.charge()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) {
    budget.refund()
    const body = await res.text().catch(() => '')
    throw new TikHubError(res.status, `${res.status} ${PATH} ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function main() {
  const rawA = await ask({})
  const listA = pickList(rawA, 'instagram/search_reels')
  const { by, ids: idsA } = identify(listA)
  const paths = keyPaths(rawA)
  // 只看**最后一段**：`data.data.items[0].is_pinned` 里的 pinned 不算游标
  const cursorish = paths.filter(p => CURSOR_HINT.test(p.split('.').pop() ?? ''))
    .map(path => ({ path, value: valueAt(rawA, path) }))

  console.error(`  基线：${listA.length} 条 · 身份按「${by}」`)
  console.error(`  响应键路径 ${paths.length} 条，其中像游标的 ${cursorish.length} 条：`
    + `${cursorish.map(c => `${c.path} = ${c.value}`).join('、') || '（一条都没有）'}`)

  // **基线重跑是整个对比的地基，不是一次多余的请求。** 少了它，「带 offset 拿到了
  // 另一批」既可能是参数被认了，也可能只是这个端点本来就在漂 —— 两种读法的结论
  // 正好相反，而观测到的现象一模一样。
  const idsB = identify(pickList(await ask({}), 'instagram/search_reels')).ids
  // **漂了多少要量出来，不能只说漂没漂。** 2026-09-22 那一跑四个参数全判「作废」，
  // 而读的人无从知道该不该当真：基线只漂 1 条、某个参数多给 7 条，那很可疑；
  // 基线自己就漂 7 条，那就是噪音。两个数摆在一起才读得出来。
  const baselineDrift = freshOf(idsA, idsB).length
  const stable = baselineDrift === 0 && idsA.length === idsB.length
  console.error(stable ? '  基线重跑：两次一致 —— 下面的对比作数'
    : '  基线重跑：两次就不一样 —— 这个端点在漂，下面一个参数也不判')

  const trials: { name: string; count: number; new_items: number; verdict: string }[] = []
  for (const v of VARIANTS) {
    const list = pickList(await ask(v.extra), 'instagram/search_reels')
    const fresh = freshOf(idsA, identify(list).ids)
    const verdict = !stable ? '作废（基线自己在漂）'
      : fresh.length === 0 ? '这一次没多给'
        : '认了'
    trials.push({ name: v.name, count: list.length, new_items: fresh.length, verdict })
    console.error(`  ${v.name} → ${list.length} 条 · 基线没有的 ${fresh.length} 个 · ${verdict}`)
  }

  const honored = trials.filter(t => t.verdict === '认了').map(t => t.name)
  console.log(JSON.stringify({
    keyword, endpoint: PATH,
    identity: by,
    baseline_items: listA.length,
    baseline_stable: stable,
    baseline_drift_items: baselineDrift,
    cursor_like_keys: cursorish,
    all_key_paths: paths,
    trials,
    requests: budget.count,
    cost_estimate_usd: Number(budget.spent.toFixed(4)),
    unit_price_usd: UNIT_PRICE,
    // 结论那句话自己带着读法 —— 只写进输出，不让读的人从表格里自己总结（ADR-73）。
    // ⚠️ **游标那一条排在最前，而且不分支**：它是对一份响应的直接观测，与四个参数的
    // 对比无关，基线漂了也照样成立。2026-09-22 那一跑正栽在这儿 —— 全部判「作废」，
    // 而响应里躺着一个 `data.pagination_token`，只读这句话的人整个错过了。
    reading: (cursorish.length
      ? `⚠️ 响应里有像游标的键：${cursorish.map(c => `${c.path} = ${c.value}`).join('、')}。`
        + '**这一条与下面的对比无关**，是对一份响应的直接观测 —— 它直接反驳「响应只有 '
        + 'count 和 items」那句话。下一步：把这个值当参数回传，看是不是能接着往下翻。'
        + '（有键不等于能用：值可能是 null，回传也可能被忽略。）\n'
      : '')
      + (!stable
      ? `基线自己两次就不一样（重跑多出 ${baselineDrift} 个基线没有的条目），本次一个参数都没判。`
        + '拿这个漂移量跟下面每一行的「基线没有的」比：漂移小而某一行大得多，才值得再试；'
        + '两者一个量级就是噪音。换个时段或换个关键词再跑。'
      : honored.length
        ? `这些参数被服务端认了：${honored.join('、')}。「一个关键词只能拿一页」那句话是错的，`
          + 'IG 侧的召回上限要按这个重算。⚠️ **「有没有游标」还要看认的是哪个** —— '
          + '`count` 只说明页大小可调，`offset`／`max_id` 才是接着往下翻。'
        : '试过的参数这一次都没多给。**这不等于不支持分页** —— 未知参数常被静默忽略，'
          + `两者在本观测下不可区分。真要否掉分页，得有别的证据（比如 ${PATH} 的接口文档）。`),
  }, null, 2))
}

main().catch(e => {
  if (e instanceof TikHubError && e.status === 402) {
    console.error('\nTikHub 返回 402：这把 key 没有余额。IG 端点不吃免费额度，充值后再跑。')
    process.exit(1)
  }
  console.error(e)
  process.exit(1)
})
