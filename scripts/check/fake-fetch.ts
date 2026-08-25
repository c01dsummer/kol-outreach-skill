/**
 * 预加载模块：把 globalThis.fetch 换成罐头响应。
 *
 * 目的（process/4-VERIFY.md「未执行的路径」）：让 probe / collect 这些
 * 需要密钥和网络的脚本，能在没有密钥和网络的环境里**从头执行到尾**。
 * 跑通即证明结构成立 —— 声明顺序、模板字符串、解析分支都真的执行过。
 *
 * 它不断言正确性，只证明「这条路径能走完」。
 */
const tiktokVideoSearch = {
  data: {
    data: [
      { aweme_info: { desc: 'Testing the new GaN charger', statistics: { play_count: 240000, digg_count: 18000 },
        author: { unique_id: 'techwithsarah', nickname: 'Sarah | Tech', follower_count: 82000,
                  aweme_count: 214, signature: 'Gadget reviews 📩 sarahbiz (at) gmail (dot) com' } } },
      { aweme_info: { desc: 'Budget power banks', statistics: { play_count: 1200, digg_count: 30 },
        author: { unique_id: 'powerbankdeals', nickname: 'Deals', follower_count: 8000, aweme_count: 41 } } },
      // 故意缺 follower_count —— 走 P1 的「未知」分支
      { aweme_info: { desc: 'no stats here', author: { unique_id: 'mysteryuser', nickname: 'Mystery' } } },
    ],
  },
}

const tiktokProfile = {
  data: { userInfo: {
    user: { uniqueId: 'techwithsarah', nickname: 'Sarah | Tech', signature: 'Reviews 📩 sarahbiz@gmail.com',
            verified: false, bioLink: { link: 'https://instagram.com/techwithsarah' }, avatarMedium: '' },
    stats: { followerCount: 82000, videoCount: 214 } } },
}

const igHashtag = {
  data: { hashtag: { edge_hashtag_to_media: { edges: [
    { node: { edge_media_to_caption: { edges: [{ node: { text: 'Packing list for tokyo' } }] },
              video_view_count: 9000, edge_liked_by: { count: 800 },
              owner: { username: 'techwithsarah', id: '123', full_name: 'Sarah',
                       edge_followed_by: { count: 31000 }, is_verified: false } } },
  ] } } },
}

const igSearch = { data: { users: [
  { user: { username: 'wanderwithmei', pk: '456', full_name: 'Mei', follower_count: 120000, is_verified: false } },
] } }

const igProfile = {
  data: { user: { pk: '123', username: 'techwithsarah', full_name: 'Sarah',
                  biography: 'travel + tech · press@mybrand.com',
                  bio_links: [{ url: 'https://tiktok.com/@techwithsarah' }],
                  follower_count: 31000, media_count: 88, is_verified: false, profile_pic_url: '' } },
}

function pick(url: string): unknown {
  if (url.includes('fetch_video_search_result')) return tiktokVideoSearch
  if (url.includes('tiktok/web/fetch_user_profile')) return tiktokProfile
  if (url.includes('instagram/v1/fetch_hashtag_posts')) return igHashtag
  if (url.includes('instagram/v1/fetch_search')) return igSearch
  if (url.includes('fetch_user_info_by_username')) return igProfile
  return { data: {} }              // 走「无法识别响应结构」分支
}

let calls = 0
globalThis.fetch = (async (input: RequestInfo | URL) => {
  calls++
  const url = String(input)
  // 第 7 次调用返回 429，确保错误分支也被执行到
  if (calls === 7) {
    return new Response('rate limited', { status: 429 })
  }
  return new Response(JSON.stringify(pick(url)), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
}) as typeof fetch

console.error('[fake-fetch] 已接管 fetch —— 本次运行不发出任何真实请求')
