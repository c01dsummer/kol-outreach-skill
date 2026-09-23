/**
 * 预加载模块：把 globalThis.fetch 换成罐头响应。
 *
 * 目的（process/4-VERIFY.md「未执行的路径」）：让 probe / collect 这些
 * 需要密钥和网络的脚本，能在没有密钥和网络的环境里**从头执行到尾**。
 * 跑通即证明结构成立 —— 声明顺序、模板字符串、解析分支都真的执行过。
 *
 * 它不断言正确性，只证明「这条路径能走完」。
 */
/**
 * 结构取自 2026-08-25 的真实响应（keyword=portable blender, region=US）。
 * 关键点：aweme_list **存在且为空**，真实结果在 search_item_list —— 这里必须
 * 原样复现，否则自检验证的是我的想象而不是 TikHub 的行为。
 * author.aweme_count 实测对所有人都返回 0，同样复现。
 */
import { appendFileSync, readFileSync } from 'node:fs'

const tiktokVideoSearch = {
  data: {
    aweme_list: [],
    has_more: 1,
    cursor: 5,
    search_item_list: [
      // 搜索结果里 signature 缺失、aweme_count 恒为 0 —— 均为实测行为
      { aweme_info: { desc: 'Testing the new GaN charger', statistics: { play_count: 240000, digg_count: 18000 },
        author: { unique_id: 'techwithsarah', nickname: 'Sarah | Tech', follower_count: 82000, aweme_count: 0 } } },
      { aweme_info: { desc: 'Budget power banks', statistics: { play_count: 1200, digg_count: 30 },
        author: { unique_id: 'powerbankdeals', nickname: 'Deals', follower_count: 8000, aweme_count: 0 } } },
      // 故意缺 follower_count —— 走 P1 的「未知」分支
      { aweme_info: { desc: 'no stats here', author: { unique_id: 'mysteryuser', nickname: 'Mystery' } } },
    ],
  },
}

const tiktokProfile = {
  data: { userInfo: {
    user: { uniqueId: 'techwithsarah', nickname: 'Sarah | Tech', signature: 'Reviews 📩 sarahbiz@example.com',
            verified: false, bioLink: { link: 'https://instagram.com/techwithsarah' }, avatarMedium: '' },
    stats: { followerCount: 82000, videoCount: 214 } } },
}

/**
 * 实测结构：data.data.items[]，user 里有 username/full_name，无 follower_count。
 * `pagination_token` 是 2026-09-22 真跑一次才看见的 —— 它是 `data.data` 的兄弟，
 * 而 `pickList` 只取 `data.data.items`，所以在那之前没有任何一行代码看得见它。
 * 放进罐头里有两个用处：让夹具贴住真实形状，以及让探针「响应里有游标」那一支被走到。
 */
const igReels = {
  data: { pagination_token: 'fake-token-for-selfcheck', data: { count: 2, items: [
    { caption: { text: 'mango dragon fruit smoothie 🥭 layered tropical' },
      play_count: 1582569, like_count: 200211,
      user: { id: '7763449524', username: 'techwithsarah', full_name: 'Sarah',
              is_verified: true, is_private: false } },
    // like_count 实测可能为 null（作者隐藏赞数）
    { caption: { text: "Don't do this in Blender" }, play_count: 999236, like_count: null,
      user: { id: '55', username: 'privateaccount', full_name: 'Priv',
              is_verified: false, is_private: true } },
  ] } },
}

const igSearchUsers = {
  data: { data: { items: [
    { username: 'wanderwithmei', full_name: 'Mei', id: '456', is_verified: false, is_private: false },
  ] } },
}

/** 实测：user 对象直接在 data 下，media_count 常为 null */
const igProfile = {
  data: {
    pk: '7763449524', id: '7763449524', username: 'techwithsarah', full_name: 'Sarah',
    biography: '3D Generalist\nContact: press@example.com',
    bio_links: [{ url: 'https://tiktok.com/@techwithsarah', lynx_url: 'https://l.instagram.com/?u=x', title: 'TikTok' }],
    external_url: 'https://tiktok.com/@techwithsarah',
    follower_count: 31000, following_count: 630, media_count: null,
    is_verified: false, is_private: false, profile_pic_url: '',
  },
}

/** D8：主页近期作品与关键词搜索样本分开；六条以上才能形成聚合指标。 */
const tiktokUserPosts = {
  data: {
    aweme_list: Array.from({ length: 12 }, (_, i) => ({
      aweme_id: `tt-post-${i}`,
      desc: `recent tiktok post ${i}`,
      create_time: 1_767_225_600 + i * 86_400,
      is_top: i === 0 ? 1 : 0,
      statistics: {
        play_count: 10_000 + i * 100,
        digg_count: 500 + i * 10,
        comment_count: 20 + i,
        share_count: 5 + i,
      },
      author: { follower_count: 82_000, following_count: 150 },
    })),
    has_more: 0,
  },
}

const instagramUserPosts = {
  data: { data: {
    count: 12,
    user: { follower_count: 31_000, following_count: 630 },
    items: Array.from({ length: 12 }, (_, i) => ({
      id: `ig-post-${i}`,
      caption: { text: `recent instagram reel ${i}` },
      is_video: true,
      media_type: 2,
      media_name: 'reel',
      is_pinned: i === 0,
      play_count: 20_000 + i * 200,
      like_count: 800 + i * 10,
      comment_count: 30 + i,
      taken_at: 1_767_225_600 + i * 86_400,
      user: { username: 'techwithsarah', follower_count: 31_000, following_count: 630 },
    })),
  } },
}

function pick(url: string): unknown {
  if (url.includes('fetch_user_post_videos_v3')) return tiktokUserPosts
  if (url.includes('instagram/v2/fetch_user_posts')) return instagramUserPosts
  if (url.includes('fetch_video_search_result')) return tiktokVideoSearch
  if (url.includes('tiktok/web/fetch_user_profile')) return tiktokProfile
  if (url.includes('instagram/v2/search_reels')) return igReels
  if (url.includes('instagram/v2/search_users')) return igSearchUsers
  if (url.includes('fetch_user_info_by_username')) return igProfile
  return { data: {} }              // 走「无法识别响应结构」分支
}

// 两个 env 旋钮，未设时严格无副作用 —— 给崩溃续跑那几条轨迹用（ADR-96）。
// 账本：每次响应之前同步追加一行「状态码 ⇥ pathname」。它就是「供应商真正收到几次」这个
//       代码里没有任何变量装着的量，由请求真正出去那一刻的观测者写下。
// 杀：第 n 个 200 响应，先追加账本行，再把自己 SIGKILL。落在假 fetch 内部 —— 状态尚未交还，
//       D14要求预留已保存但终态未保存。只传给崩溃那一次 spawn，续跑不带。
// 不在模块加载时碰账本：NODE_OPTIONS 让 tsx 壳也执行这个模块，只有真正调 fetch 的孙进程才该写。
const ledger = process.env.FAKE_FETCH_LEDGER
const killAfterOk = Number(process.env.FAKE_FETCH_KILL_AFTER_OK)   // 没设 → NaN，永不相等
let oks = 0
const record = (status: number | 'NO_HTTP_STATUS', url: string) => {
  if (ledger) appendFileSync(ledger, `${status}\t${new URL(url).pathname}\n`)
}

let calls = 0
/** `force-drift` 那一支的批次号 —— 每调一次就换一批，供探针的地基对照用 */
let drifts = 0
/** `force-onecreator` 那一支的批次号 —— 每调一次换一批条目，但发的人始终是同一个 */
let oneCreator = 0
// 费用接线用的单次故障：只有本次 spawn 明确指定的 pathname 才命中，随后恢复罐头。
// profile 没有 keyword，所以用路径定位；不改变既有 force-* 或第 7 次 429 的默认行为。
let faultUsed = false
const fakeFetch = async (input: RequestInfo | URL) => {
  calls++
  const url = String(input)
  const fault = process.env.FAKE_FETCH_FAULT
  if (!faultUsed && fault && new URL(url).pathname === process.env.FAKE_FETCH_FAULT_PATH) {
    faultUsed = true
    if (fault === 'no-http-status') {
      record('NO_HTTP_STATUS', url)
      throw new Error('fake fetch: connection lost before HTTP status')
    }
    if (fault === 'bad-json-200') {
      record(200, url)
      return new Response('{broken', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const status = Number(fault.replace('bad-body-', ''))
    if ([201, 204, 429, 500].includes(status)) {
      record(status, url)
      // 204 必须以 null 构造，不能让 Response 构造异常伪装成无 HTTP 状态。
      const response = new Response(status === 204 ? null : 'unreadable', { status })
      response.text = async () => { throw new Error('fake response: text body unreadable') }
      response.json = async () => { throw new Error('fake response: JSON body unreadable') }
      return response
    }
    throw new Error(`unknown fake-fetch fault: ${fault}`)
  }
  // 关键词里带上 `force-402` 就让对面拒收 —— **出错那条收尾路径只有这样才走得到**。
  // 402 是 TikHub 说「你账户没钱了」，和「预算用尽」不是一回事：预算是我们自己设的
  // 闸门（退出码 3），402 是对面拒收（退出码 1），而且 402 不重试、直接抛穿搜索循环。
  // 用关键词触发不用环境变量：夹具本来就要写配置，触发条件跟着配置走，读的人在
  // 同一个地方看得到（D6.f 的出错那一条）。
  if (url.includes('force-402')) {
    record(402, url)
    return new Response('payment required', { status: 402 })
  }
  // 关键词里带 `force-schema` → **200、计过费，但结构认不出**。
  // 这是「请求发出去了、钱扣了，在记下来之前抛了」那条路唯一的入口（D6.i）。
  // 和 402 不是一回事：402 会 refund，这一条的钱**真的花掉了**，所以报告绝不能
  // 把这个词说成「未查询」。
  if (url.includes('force-schema')) {
    record(200, url)
    return new Response(JSON.stringify({ data: { 全新的键: [] } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  // 关键词里带 `force-noparse` → reels **返回了条目、但一条都解析不出人**。
  // 这是 IG 兜底那条路唯一的入口：走到它就说明第一次请求已经付过钱、也确实拿回了条目，
  // 而第二次（搜账号名）可能正好撞上预算（D6.k）。
  if (url.includes('force-noparse') && url.includes('search_reels')) {
    record(200, url)
    return new Response(JSON.stringify({ data: { data: { count: 2, items: [
      { caption: { text: 'no user field here' } }, { caption: { text: 'nor here' } },
    ] } } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  // D15：真正空的Reels页仍走既有users兜底；zero让两路均空，不能凭请求制造账号来源。
  if ((url.includes('force-empty-reels') && url.includes('search_reels'))
    || url.includes('force-discovery-zero')) {
    record(200, url)
    return new Response(JSON.stringify({ data: { data: { items: [] } } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  // P1.i：同一个真实 reels 响应形状里放空文案、普通文案和超长文案。
  // 普通文案账号的第二条播放更高，不能拿它替换小样试探承诺的第一条。
  if (url.includes('force-probe-captions') && url.includes('search_reels')) {
    record(200, url)
    return new Response(JSON.stringify({ data: { data: { count: 4, items: [
      { caption: { text: '' }, play_count: 1,
        user: { id: 'probe-empty', username: 'probeempty', full_name: 'Empty' } },
      { caption: { text: 'First caption' }, play_count: 2,
        user: { id: 'probe-text', username: 'probetext', full_name: 'Text' } },
      { caption: { text: 'a'.repeat(119) + 'BC' }, play_count: 3,
        user: { id: 'probe-long', username: 'probelong', full_name: 'Long' } },
      { caption: { text: 'Later caption with more plays' }, play_count: 100,
        user: { id: 'probe-text', username: 'probetext', full_name: 'Text' } },
    ] } } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  // 关键词里带 `force-onecreator` → reels **每次换一批条目，但都是同一个人发的**。
  // 这是连打模式那条最贵的误读唯一的入口：累计条目一直涨、累计达人一个都不涨。
  // 少了它，把「条目数」当「人数」的写法照样全绿 —— 而那种曲线会让人以为召回有救，
  // 实际上多问几次只拿到了同一个人的更多视频。
  if (url.includes('search_reels') && url.includes('force-onecreator')) {
    record(200, url)
    const seed = ++oneCreator
    const same = { id: '900', username: 'sameperson', full_name: 'Same' }
    return new Response(JSON.stringify({ data: { data: { count: 2, items: [
      { id: `oc-${seed}-a`, caption: { text: `a ${seed}` }, user: same },
      { id: `oc-${seed}-b`, caption: { text: `b ${seed}` }, user: same },
    ] } } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  // 关键词里带 `force-paged` → reels **认 `pagination_token`**：带着上一页的游标来就回新一批，
  // 并给出下一个游标。翻到第三页就**不再给游标** —— 那是「服务端自己说没有下一页了」
  // 唯一的入口，而它是探针里唯一一个**不靠推断**的终止条件（其余都只说得出
  // 「这 N 次之内没再涨」）。
  if (url.includes('search_reels') && url.includes('force-paged')) {
    record(200, url)
    const tok = new URL(url).searchParams.get('pagination_token')
    const page = tok ? Number(tok.replace('page-', '')) : 1
    const body: any = { data: { data: { count: 1, items: [
      { id: `pg-${page}`, caption: { text: `page ${page}` },
        user: { id: `p${page}`, username: `pager${page}`, full_name: 'P' } },
    ] } } }
    if (page < 3) body.data.pagination_token = `page-${page + 1}`
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  // 关键词里带 `force-drift` → **每次都换一批人，而且每次都照给游标**。
  // 这是整组里最关键的判别用例：链和对照**涨得一样多** —— 天真的读法会把它判成
  // 「翻页有效」，而实际上一个人都不是游标给的，全是这个端点自己在漂。
  // 少了它，「拿链去减对照」那一步删掉也全绿。
  if (url.includes('search_reels') && url.includes('force-drift')) {
    record(200, url)
    const seed = ++drifts
    return new Response(JSON.stringify({ data: { pagination_token: `drift-${seed}`, data: {
      count: 1, items: [
        { id: `reel-${seed}`, caption: { text: `item ${seed}` },
          user: { id: String(seed), username: `user${seed}`, full_name: 'X' } },
      ] } } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  // 第 7 次调用返回 429，确保 `TikHub.get()` 的退避重试分支也被执行到。
  // ⚠️ **这是个按「第几次」定位的触发器，调用数一变就会误伤。** 分页探针不走
  // `get()`（它有自己的 `ask()`，非 200 直接抛、不重试），所以这个 429 对它是纯误伤：
  // 探针一多试几个参数就跨过第 7 次，整跑当场中止。给它一个显式的关门旋钮 ——
  // 比把上面那条改成关键词触发安全：那样会让 `collect` 那几条轨迹不再顺带走到重试分支，
  // 而那条分支今天没有任何变异守着，减了覆盖也不会有人报错。
  if (calls === 7 && process.env.FAKE_FETCH_NO_429 !== '1') {
    record(429, url)
    return new Response('rate limited', { status: 429 })
  }
  record(200, url)
  if (++oks === killAfterOk) process.kill(process.pid, 'SIGKILL')
  return new Response(JSON.stringify(pick(url)), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
}

// D14 的独立观测协议：只在显式启用时读任务快照；观测不替被测入口保存费用。
// IPC 屏障在 fetch 已产生响应、但尚未交还状态时通知父进程；父进程据事件强杀，
// 不靠 sleep 猜窗口。正文观测包住实际调用，不能把「有响应」当成「读过正文」。
const costEvents = process.env.FAKE_FETCH_COST_EVENTS
const observe = (kind: string, url: string, extra: Record<string, unknown> = {}) => {
  if (!costEvents) return
  let task: unknown, task_error: string | undefined
  if (process.env.FAKE_FETCH_COST_TASK) {
    try { task = JSON.parse(readFileSync(process.env.FAKE_FETCH_COST_TASK, 'utf8')) }
    catch (error) { task_error = String(error) }
  }
  const parsed = new URL(url)
  appendFileSync(costEvents, `${JSON.stringify({ kind, endpoint: parsed.pathname,
    query: Object.fromEntries(parsed.searchParams), task, task_error, ...extra })}\n`)
}
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  observe('fetch', url)
  let response: Response
  try { response = await fakeFetch(input) }
  catch (error) { observe('no-http-status', url); throw error }
  observe('http', url, { status: response.status })
  if (process.env.FAKE_FETCH_COST_BARRIER === '1') {
    if (!process.send) throw new Error('fake fetch: cost barrier requires IPC')
    process.send({ kind: 'cost-fetch-barrier', pid: process.pid })
    await new Promise(() => { setInterval(() => {}, 60_000) })
  }
  if (costEvents) for (const method of ['text', 'json'] as const) {
    const original = response[method].bind(response)
    response[method] = async () => { observe('body', url, { method }); return original() }
  }
  return response
}) as typeof fetch

console.error('[fake-fetch] 已接管 fetch —— 本次运行不发出任何真实请求')
