#!/usr/bin/env tsx
/**
 * IG Reels 搜索到底能不能翻页 —— 核实工具（ADR-94 那张欠条 · ADR-101）。
 *
 * ## 它回答哪一个问题
 *
 * `skill/references/providers/tikhub.md` 与 `providers/tikhub.ts` 都写过「Reels 搜索
 * **没有分页游标**」，而整个 IG 侧的召回上限论证都压在这句话上。它的证据只有一句
 * 「响应只有 `count` 和 `items`」—— 那是**响应**那一侧的观测，而请求那一侧从来没人试过：
 * 我们的代码只发过 `keyword` 一个参数，`has_more: false` 是写死的字面量，`search()`
 * 见到 `offset > 0` 直接返回空。**所以「第 2 页是空的」这个现象，是我们自己造的。**
 *
 * 所以这个脚本不走 `providers/tikhub.ts`：那一份只取 `data.data.items`，别的一律扔掉，
 * 「响应只有 count 和 items」正是这么来的 —— 没有人看过整份响应。这里发原始请求、
 * 打整份响应的键路径。
 *
 * ## 参数名不猜 —— 按官方 spec 来
 *
 * 上一版带着一张 `VARIANTS`：`count`／`offset`／`page`／`max_id`，**四个名字全是猜的**，
 * 为它们烧掉了十几次付费请求。后来读 TikHub 自己那份**按 OpenAPI 机械生成**的
 * Python SDK：那四个 spec 里一个都没有，而 `search_reels` 官方声明的分页参数就是
 * `pagination_token` —— 正是响应里那个键的名字。于是猜参数那一整套拿掉了。
 *
 * **教训不在「猜错了」，在顺序**：先拿真 key 去试，才去找正本。某个域被出网代理挡住
 * 不等于正本拿不到（官方 SDK 在 GitHub 上，一直没被挡）。
 * ⚠️ 固定 spec 中该端点的 200 响应引用 ResponseModel；外壳有 schema，业务 data
 * 为 anyOf [{}, {type: null}]。具体字段路径仍要响应样本证明（ADR-101 第十三节）。
 *
 * ## 两个模式，共用一条曲线
 *
 * | 模式 | 每一次带什么 | 回答什么 | 发几次请求 |
 * |---|---|---|---|
 * | 默认 | 只有 `keyword` | 响应长什么样、有没有像游标的键 | 1 |
 * | `--chain N` | 上一次响应里的 `pagination_token` | **翻页**能拿到多少人 | 2N |
 * | `--repeat N` | 什么都不带，原样再发一次 | **漂移**能刷出多少人 | N |
 *
 * ⚠️ **`--chain` 一定同时跑对照组** —— 这就是它 2N 次请求的来源。这个端点实测会漂：
 * 两次完全相同的请求会返回不同的条目。少了对照曲线，链上多出来的人分不清是翻页给的
 * 还是漂给的，**而这两种读法的结论正好相反**。上一版栽的就是这一类坑。
 *
 * ⚠️ **数的是人，不是条目。** 同一个人连发三条 Reels，翻页能多拿到视频却一个新达人都
 * 没多给 —— 「条目在涨、人没涨」是这里最贵的误读，所以两条分开报，结论自己会点出来。
 *
 * ⚠️ **它给不出「服务端只有这么多人」这个结论。** 末尾连着几次不涨，说的是
 * 「**这 N 次之内**没再涨」——「问完了」与「还没问够」在一次观测里不可区分。
 * 唯一的例外是**链自己断了**：服务端不再给下一个游标，那是它自己说的，单独报出来。
 *
 * ## 用法（要一把**充过值**的 key，IG 端点不吃免费额度，恒 402）
 *
 *   npm run probe:ig-paging -- --keyword smoothie
 *   npm run probe:ig-paging -- --keyword smoothie --chain 10
 *   npm run probe:ig-paging -- --keyword smoothie --repeat 10
 *
 * 费用看 `cost_estimate_usd` 及其分项：按该端点固定公开价估算的进程预算占用，
 * 含无 HTTP 状态的保守留存与未结预留，不是 TikHub 的账单。
 */
import { TikHubError, pickList } from './providers/tikhub.js'
import { Budget, BudgetInputError, startBudget } from './lib/budget.js'
import { formatUsd, parseUsdMicros } from './lib/cost-ledger.js'
import { stringifyCostJson } from './lib/cost-json.js'
import { quoteTikHub } from './providers/tikhub-pricing.js'

const BASE = 'https://api.tikhub.io'
const PATH = '/api/v1/instagram/v2/search_reels'

/**
 * 翻页参数叫什么。**这一个不是猜的** —— TikHub 官方那份按 OpenAPI 机械生成的 SDK 里，
 * `search_reels` 的请求参数就是 `keyword` ＋ `pagination_token`，没有第三个。
 */
const CURSOR_PARAM = 'pagination_token'

/** 名字里带这些字样的键值得单独点出来 —— 有一个就说明游标可能一直在响应里。 */
const CURSOR_HINT = /cursor|max_id|next|page|has_more|more_available|token/i

/**
 * 按键路径把值取出来。**只打键名不够** —— 「它是 null 还是真有个 token」才是要问的。
 *
 * ⚠️ **原值与给人看的值必须分开。** 显示要截断（token 是一长串不透明字符），而回传给
 * 服务端时**必须用原值** —— 拿截断过的串去当参数，是一次注定失败、且失败原因看不出来的
 * 试探。上一版就是在这儿差点栽：显示那一版把收尾引号都截掉了。
 */
function rawAt(root: unknown, path: string): unknown {
  let cur: any = root
  for (const seg of path.split('.')) {
    const m = /^(.*)\[0\]$/.exec(seg)
    cur = cur?.[m ? m[1] : seg]
    if (m) cur = cur?.[0]
    if (cur === undefined || cur === null) break
  }
  return cur
}

/** 给人看的那一份：截断到能认出形状为止，不整份抄进输出。 */
const show = (v: unknown): string =>
  v === undefined ? '(缺)' : v === null ? 'null' : JSON.stringify(v).slice(0, 120)

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  const v = i < 0 ? undefined : process.argv[i + 1]
  return v === undefined || v.startsWith('--') ? undefined : v
}

const keyword = arg('keyword')
if (!keyword) {
  console.error('用法: npm run probe:ig-paging -- --keyword smoothie [--chain N | --repeat N]')
  process.exit(2)
}
const key = process.env.TIKHUB_API_KEY

/**
 * 跑几次。**至少两次** —— 跑一次量不出「累计」，而「第二次还能不能多给」本身就是要测的。
 * 不设上限：上限是 `Budget` 那道闸门，超了当场抛，不会闷头花下去。
 */
const countOf = (flag: string): number | undefined => {
  // **「没写这个 flag」与「写了但没给数」必须分开。** 合起来的话
  // `--chain`（后面漏了数字，或紧跟着另一个 flag）会被当成没写过 —— 于是要了一次
  // 链式跑，拿回来的是一份只发一次请求的形状 dump，**而且不报错**
  //（评审第六轮指出，负片 `M-H44-k`）。
  if (!process.argv.includes(`--${flag}`)) return undefined
  const raw = arg(flag)
  if (raw === undefined) {
    console.error(`--${flag} 后面要跟一个 ≥2 的整数，这次什么都没跟上`)
    process.exit(2)
  }
  const n = Number(raw)
  if (!(Number.isInteger(n) && n >= 2)) {
    console.error(`--${flag} 要一个 ≥2 的整数，收到 ${JSON.stringify(raw)}`)
    process.exit(2)
  }
  return n
}
const chain = countOf('chain')
const repeat = countOf('repeat')
if (chain !== undefined && repeat !== undefined) {
  console.error('--chain 与 --repeat 只能选一个：--chain 自己就带着对照组跑 --repeat。')
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

/**
 * 条目背后是**谁**。`identify()` 数的是条目，这一条数的是人 —— 召回要的是后者：
 * 同一个人连发三条 Reels，多拿两条视频一个新达人都没多给。两条曲线必须分开报，
 * 「条目在涨、人没涨」才看得出来，而那正是这里最贵的误读。
 *
 * 认不出作者的条目**单独计数：既不折成一个人，也不当成零个** —— 折成一个桶会凭空多出
 * 一个达人，当成零个又把「有人、但没认出来」说成「没有人」。两种都是替数据打包票，
 * 所以那个数原样报出来，人头只当**下限**（P1）。
 */
const whoOf = (list: any[]): { ids: string[]; unidentified: number } => {
  const raw = list.map(it => it?.user?.id ?? it?.media?.user?.id
    ?? it?.user?.username ?? it?.media?.user?.username)
  const ids = raw.filter(x => x !== undefined && x !== null).map(String)
  return { ids, unidentified: raw.length - ids.length }
}
const WHO_BY = '条目里的 user.id，缺了退回 user.username'

let budget: Budget
try {
  budget = startBudget({}, parseUsdMicros('1'), 'process', (threshold, view) => {
    console.error(`预算占用已达 ${threshold * 100}%：$${view.cost_estimate_usd} / $${view.budget_usd}`)
  })
} catch (error) {
  console.error(error)
  process.exit(2)
}
console.error('本探针使用进程总预算 $1。')
const unitMicroUsd = quoteTikHub(PATH).unit_micro_usd
// 只显示按计划次数算出的固定价估算；过大次数不改变原采样/停止规则。
const estimatedCost = (calls: number, groups = 1): string => {
  const micros = BigInt(calls) * BigInt(groups) * BigInt(unitMicroUsd)
  return micros <= BigInt(Number.MAX_SAFE_INTEGER)
    ? `$${formatUsd(Number(micros))}` : '金额超出安全微美元显示范围'
}
/**
 * **真的发出去了几次** —— 与计费次数分开数。
 *
 * `ask()` 对非 200 撤销本次预留，于是 `budget.count` 只计 HTTP 200 和无状态留存，
 * 不是发出数：中止那一次的非 200 请求确确实实发出去了，却不在里面。
 * 中止时只报净次数，就会把「发出 N+1 次」说成「发出 N 次」—— 而这个文件整个存在的
 * 理由就是不让观测被说成别的样子（评审第六轮指出，负片 `M-H44-j`）。
 */
let sent = 0

/**
 * 发一次请求。**非 200 直接抛，不重试** —— 与 `providers/tikhub.ts` 的 `get()` 不同，
 * 那一份会对 429 退避重试三次，于是它的 `requests` 是净计数、可以小于 HTTP 尝试次数。
 *
 * 这里刻意不那样：异常穿过 `main()` 落到末尾的 `catch`，打一句诊断就非零退出，
 * **那份 JSON 一个字都不会打印**。所以反过来成立 —— **输出存在 ⇒ 每一次都是 200 ⇒
 * `requests` 就是真发出去的次数**。读这个数的人不必再去想退费那一层。
 */
async function ask(extra: Record<string, string | number>): Promise<any> {
  const url = new URL(PATH, BASE)
  url.searchParams.set('keyword', keyword!)
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, String(v))
  if (!key) throw new BudgetInputError('缺少 TIKHUB_API_KEY，未发送请求。')
  const receipt = budget.reserve(PATH)
  sent++
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
  } catch (error) {
    budget.settle(receipt, { kind: 'no_http_status' })
    throw error
  }
  budget.settle(receipt, { kind: 'http', status: res.status })
  if (res.status !== 200) {
    const body = await res.text().catch(() => '')
    throw new TikHubError(res.status, `${res.status} ${PATH} ${body.slice(0, 200)}`)
  }
  return res.json()
}

type Row = {
  call: number; items: number; new_items: number; cum_items: number
  new_creators: number; cum_creators: number; unidentified: number
}

/** 一条曲线：把每一次响应按**人**和条目两套身份分别累计去重。 */
class Curve {
  private readonly seenItems = new Set<string>()
  private readonly seenPeople = new Set<string>()
  readonly rows: Row[] = []
  blind = 0
  by = ''

  feed(list: any[]): Row {
    const id = identify(list)
    this.by ||= id.by
    const who = whoOf(list)
    // **先在这一次里面去重，再跟累计集合比。** 同一个人在一次响应里出现两条，
    // 直接按条目逐个过滤的话会被数成两个新达人 —— 而整条曲线的读法全系在这个数上。
    const freshItems = new Set(id.ids.filter(x => !this.seenItems.has(x)))
    const freshPeople = new Set(who.ids.filter(x => !this.seenPeople.has(x)))
    freshItems.forEach(x => this.seenItems.add(x))
    freshPeople.forEach(x => this.seenPeople.add(x))
    this.blind += who.unidentified
    const row: Row = {
      call: this.rows.length + 1, items: list.length,
      new_items: freshItems.size, cum_items: this.seenItems.size,
      new_creators: freshPeople.size, cum_creators: this.seenPeople.size,
      unidentified: who.unidentified,
    }
    this.rows.push(row)
    return row
  }

  get cumItems() { return this.seenItems.size }
  get cumPeople() { return this.seenPeople.size }

  /** 末尾连着几次一个新达人都没多给。**这是观测，不是结论** —— 见文件头那两条限定。 */
  get tailFlat(): number {
    let n = 0
    for (let i = this.rows.length - 1; i >= 0 && this.rows[i].new_creators === 0; i--) n++
    return n
  }
}

const line = (label: string, r: Row, c: Curve) =>
  console.error(`  ${label} 第 ${r.call} 次 → ${r.items} 条 · 新条目 ${r.new_items}`
    + ` · 新达人 ${r.new_creators} · 累计 ${c.cumPeople} 人 / ${c.cumItems} 条`)

/** 原样再发 N 次。`--repeat` 走它，`--chain` 也拿它当对照组。 */
async function repeatInto(c: Curve, n: number, label: string, first?: any) {
  for (let i = 0; i < n; i++) {
    line(label, c.feed(pickList(first && i === 0 ? first : await ask({}), 'instagram/search_reels')), c)
  }
}

/**
 * 顺着游标翻 N 次。**拿不到下一个游标就停，并报出停在第几次** —— 那是服务端自己说
 * 「没有下一页了」，是这个工具唯一一个**不靠推断**的终止条件（ADR-85）。
 */
async function chainInto(c: Curve, n: number, first: any, cursorPath: string | undefined) {
  let raw = first
  for (let call = 1; call <= n; call++) {
    line('链', c.feed(pickList(raw, 'instagram/search_reels')), c)
    const token = cursorPath === undefined ? undefined : rawAt(raw, cursorPath)
    if (typeof token !== 'string' || token.length === 0) return call
    if (call < n) raw = await ask({ [CURSOR_PARAM]: token })
  }
  return undefined
}

async function main() {
  const first = await ask({})
  const paths = keyPaths(first)
  // 只看**最后一段**：`data.data.items[0].is_pinned` 里的 pinned 不算游标
  const cursorPaths = paths.filter(p => CURSOR_HINT.test(p.split('.').pop() ?? ''))
  const cursorish = cursorPaths.map(path => ({ path, value: show(rawAt(first, path)) }))
  // 回传要用的那一条：第一个取到非空串的。**值是观测到的，参数名按官方 spec。**
  const cursorPath = cursorPaths.find(p => {
    const v = rawAt(first, p)
    return typeof v === 'string' && v.length > 0
  })
  console.error(`  响应键路径 ${paths.length} 条，其中像游标的 ${cursorish.length} 条：`
    + `${cursorish.map(c => `${c.path} = ${c.value}`).join('、') || '（一条都没有）'}`)

  const head = { keyword, endpoint: PATH, identity_creators: WHO_BY, cursor_like_keys: cursorish }
  const tail = () => ({
    // 此字段仅为已核 Reels 固定价；所有累计金额由 CostView 精确写出。
    unit_price_usd: unitMicroUsd / 1_000_000,
  })
  // 游标那一句**不分支**：它是对一份响应的直接观测，与下面任何对比都无关，
  // 所以对比作废也好、没跑对比也好，它照样成立。上一版正栽在把它藏进字段里。
  const cursorNote = cursorish.length
    ? `⚠️ 响应里有像游标的键：${cursorish.map(c => `${c.path} = ${c.value}`).join('、')}。`
      + `**这一条与任何对比无关**，是对一份响应的直接观测 —— 它直接反驳「响应只有 count `
      + `和 items」那句话。回传时参数名用 \`${CURSOR_PARAM}\`（官方 spec 声明的那一个）。\n`
    : '⚠️ 这一份响应里一个像游标的键都没有。\n'

  if (chain === undefined && repeat === undefined) {
    console.log(stringifyCostJson({
      ...head, mode: '只打一次，报形状', all_key_paths: paths, ...tail(),
      reading: cursorNote + '只打了一次，没有任何对比 —— 要量能拿到多少人，跑 `--chain N`'
        + '（顺着游标翻，自带对照组）或 `--repeat N`（原样重发，只量漂移）。',
    }, budget.view()))
    return
  }

  if (repeat !== undefined) {
    const c = new Curve()
    console.error(`  原样重发 ${repeat} 次 · 固定价目估算 ${estimatedCost(repeat)}`)
    await repeatInto(c, repeat, '照搬', first)
    console.log(stringifyCostJson({
      ...head, mode: '原样重发', calls: repeat, identity_items: c.by,
      cum_items: c.cumItems, cum_creators: c.cumPeople,
      tail_calls_without_new_creator: c.tailFlat, unidentified_items: c.blind,
      curve: c.rows, ...tail(),
      reading: cursorNote + readCurve(c, '原样重发'),
    }, budget.view()))
    return
  }

  const n = chain!
  console.error(`  顺着游标翻最多 ${n} 次 ＋ 同样长度的对照组 · 固定价目估算 ${estimatedCost(n, 2)}`
    + '（链提前断掉的话两边一起变短）')
  const ch = new Curve()
  const stoppedAt = await chainInto(ch, n, first, cursorPath)
  // **对照组跟着链的实际长度走，不是跟着要求的次数。** 链提前断掉（服务端不再给游标）
  // 时若让对照跑满，对照的采样就比链多 —— 而这个端点会漂，采样多的一方天然累计更多人，
  // 于是「翻页有没有用」那个比较会偏向判它没用。**这是在本工具最重的那个结论上造假阴性**
  //（评审第六轮指出，负片 `M-H44-l`）。
  const ctrl = new Curve()
  await repeatInto(ctrl, ch.rows.length, '对照')
  // **链比对照多拿到人，才叫翻页有用。** 端点自己会漂，所以链上多出来的人不减掉
  // 对照那一份，就会把漂的功劳记到翻页头上 —— 这两种读法的结论正好相反。
  const beatsDrift = ch.cumPeople > ctrl.cumPeople
  console.log(stringifyCostJson({
    ...head, mode: '顺着游标翻（带对照组）', calls: n, identity_items: ch.by,
    chain_stopped_at_call: stoppedAt,
    chain_cum_creators: ch.cumPeople, control_cum_creators: ctrl.cumPeople,
    chain_cum_items: ch.cumItems, control_cum_items: ctrl.cumItems,
    tail_calls_without_new_creator: ch.tailFlat,
    unidentified_items: ch.blind + ctrl.blind,
    chain_curve: ch.rows, control_curve: ctrl.rows, ...tail(),
    reading: cursorNote
      + (stoppedAt !== undefined
        ? `链在第 ${stoppedAt} 次断了：服务端不再给下一个游标。**这一条不是推的，是它自己说的** ——`
          + '「没有下一页了」在这里是可验的，和下面那句限定不是一回事。\n'
        : '')
      + (beatsDrift
        ? `**翻页确实多拿到了人**：链累计 ${ch.cumPeople} 人，对照（原样重发同样次数）`
          + `${ctrl.cumPeople} 人。IG 侧的召回上限要按这条曲线重算，`
          + `而且该把 \`${CURSOR_PARAM}\` 接进 \`providers/tikhub.ts\` 的搜索里。\n`
        : `⚠️ **翻页没比原样重发多拿到人**：链累计 ${ch.cumPeople} 人，对照 ${ctrl.cumPeople} 人。`
          + '链上多出来的那些人是**漂**给的，不是翻页给的 —— 这个端点两次相同请求本来就返回'
          + '不同条目。把这算成翻页有效，是把漂的功劳记到了游标头上。\n')
      + readCurve(ch, '链'),
  }, budget.view()))
}

/**
 * 一条曲线自己那几句读法。**「条目涨而人没涨」必须单独有一支**。
 *
 * ⚠️ **跑了几次要从曲线自己数出来，不许用「要求跑几次」那个数。** 链会提前断
 * （服务端不再给游标），那时两个数不相等，而拿后者去报就是一句假话 —— 正是这个文件
 * 存在的理由所反对的那种。上一版的 `n` 是待试参数的个数、必然等于实际跑数，换成
 * 链式翻页之后这条不再成立，而那个写法被照搬了过来（负片 `M-H44-i`）。
 */
function readCurve(c: Curve, label: string): string {
  const n = c.rows.length
  const first = c.rows[0]
  const peopleGrew = c.cumPeople > first.cum_creators
  const itemsGrew = c.cumItems > first.cum_items
  return `${label}：${n} 次累计去重 ${c.cumPeople} 个达人、${c.cumItems} 条视频`
    + `（第一次就拿到 ${first.cum_creators} 人 / ${first.items} 条）。\n`
    + (peopleGrew ? ''
      : itemsGrew
        ? '⚠️ **条目在涨，人没涨** —— 多拿到的只是同一批人的更多视频，一个新达人都没有。'
          + '这对召回没用：别把条目数当成人数。\n'
        : '第一次之后条目和人都没再涨，一个新的都没有。\n')
    + (c.tailFlat
      ? `末尾连着 ${c.tailFlat} 次一个新达人都没多给。**这只说得出「这 ${n} 次之内没再涨」** ——`
        + '与「服务端就只有这么多人」在本观测下**不可区分**，想再往下钉只能加跑数或换关键词。'
      : `**最后一次仍在涨**（这一次还多出 ${c.rows[c.rows.length - 1].new_creators} 个没见过的人）`
        + ` —— 这 ${n} 次连上限的边都没摸到，值得往大了再跑一次。`)
    + (c.blind
      ? `\n⚠️ 有 ${c.blind} 条认不出作者，没计进人头、也没折成一个人 —— 上面的人数是**下限**。`
      : '')
}

main().catch(e => {
  // D13.q：中止仍报告占用，200、无状态留存与未结额由共同 summary 区分。
  console.error(`✗ 探针中止：${e instanceof Error ? e.message : String(e)}`)
  console.error(`  这一跑发出 ${sent} 次请求；${budget.summary()}，结果没有落地。`)
  process.exit(e instanceof BudgetInputError ? 2 : 1)
})
