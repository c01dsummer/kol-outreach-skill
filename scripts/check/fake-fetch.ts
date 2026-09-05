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

/** 实测结构：data.data.items[]，user 里有 username/full_name，无 follower_count */
const igReels = {
  data: { data: { count: 2, items: [
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

let calls = 0
globalThis.fetch = (async (input: RequestInfo | URL) => {
  calls++
  const url = String(input)
  // 关键词里带上 `force-402` 就让对面拒收 —— **出错那条收尾路径只有这样才走得到**。
  // 402 是 TikHub 说「你账户没钱了」，和「预算用尽」不是一回事：预算是我们自己设的
  // 闸门（退出码 3），402 是对面拒收（退出码 1），而且 402 不重试、直接抛穿搜索循环。
  // 用关键词触发不用环境变量：夹具本来就要写配置，触发条件跟着配置走，读的人在
  // 同一个地方看得到（D6.f 的出错那一条）。
  if (url.includes('force-402')) {
    return new Response('payment required', { status: 402 })
  }
  // 第 7 次调用返回 429，确保错误分支也被执行到
  if (calls === 7) {
    return new Response('rate limited', { status: 429 })
  }
  return new Response(JSON.stringify(pick(url)), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
}) as typeof fetch

console.error('[fake-fetch] 已接管 fetch —— 本次运行不发出任何真实请求')
