// KOL-21 C1 · 夹具原文（逐字照冻结单代码块誊写；不经 JSON 序列化器生成配置/任务文件）
// 冻结单 pack/30-frozen-spec.md：R-* :105-160；T1–T15 :166-182；S-* :186-199；F-* :201-272；G1/G3 配置见各用例；
// «COST» 槽样本 :660-761；G5 候选 :1426-1441；F-G6 :1473-1502。
// 写盘规则（:25）：代码块就是文件原字节，UTF-8、无 BOM、块内文本原样，末尾再加一个 LF —— 见 fileBytes()。
import type { ResponseScript, ScriptResponse, ScriptRule } from './lib/contract.ts'

/** :25 代码块 → 文件原字节：块内文本 + 一个 LF。 */
export function fileBytes(block: string): string {
  return block + '\n'
}

// ---------------- R-*（:105-160；每块一行紧凑 JSON，作为 body 字符串写入脚本）----------------
export const R = {
  'R-402': `{"detail":"kol21 fixture: payment required"}`,
  'R-404': `{"detail":"kol21 fixture: not found"}`,
  'R-TT-SEARCH-EMPTY': `{"data":{"search_item_list":[]}}`,
  'R-TT-SEARCH-G1': `{"data":{"search_item_list":[{"aweme_info":{"aweme_id":"7000000000000000101","desc":"kol21 g1 sample desc","author":{"unique_id":"kol21_g1_author","nickname":"KOL21 G1 Author","follower_count":12000},"statistics":{"play_count":1000,"digg_count":10}}}]}}`,
  'R-TT-PROFILE-G1': `{"data":{"userInfo":{"user":{"uniqueId":"kol21_g1_author","nickname":"KOL21 G1 Author","signature":"kol21 g1 bio","followerCount":12000,"followingCount":10,"videoCount":40,"verified":false,"bioLink":{"link":"https://example.com/kol21-g1"}}}}}`,
  'R-TT-POSTS-EMPTY': `{"data":{"aweme_list":[]}}`,
  'R-TT-SEARCH-G3P': `{"data":{"search_item_list":[{"aweme_info":{"aweme_id":"7000000000000000371","desc":"kol21 g3p one","author":{"unique_id":"kol21_g3p_c1","nickname":"KOL21 G3P C1","follower_count":12000},"statistics":{"play_count":1000,"digg_count":10}}},{"aweme_info":{"aweme_id":"7000000000000000372","desc":"kol21 g3p two","author":{"unique_id":"kol21_g3p_c2","nickname":"KOL21 G3P C2","follower_count":12000},"statistics":{"play_count":1000,"digg_count":10}}},{"aweme_info":{"aweme_id":"7000000000000000373","desc":"kol21 g3p three","author":{"unique_id":"kol21_g3p_c3","nickname":"KOL21 G3P C3","follower_count":12000},"statistics":{"play_count":1000,"digg_count":10}}}]}}`,
  'R-TT-PROFILE-G3P-C1': `{"data":{"userInfo":{"user":{"uniqueId":"kol21_g3p_c1","nickname":"KOL21 G3P C1","signature":"kol21 g3p bio one","followerCount":12000,"followingCount":10,"videoCount":40,"verified":false,"bioLink":{"link":"https://example.com/kol21-g3p-c1"}}}}}`,
  'R-IG-REELS-G3T-A': `{"data":{"data":{"items":[{"id":"3300000000000000311","media_type":2,"play_count":1500,"caption":{"text":"kol21 g3 target reel a"},"user":{"username":"kol21_g3t_a","full_name":"KOL21 G3T A","id":"5500000000311","is_verified":false,"is_private":false}}]},"pagination_token":"kol21-g3t-token-a"}}`,
  'R-IG-REELS-G3T-B': `{"data":{"data":{"items":[{"id":"3300000000000000312","media_type":2,"play_count":1500,"caption":{"text":"kol21 g3 target reel b"},"user":{"username":"kol21_g3t_b","full_name":"KOL21 G3T B","id":"5500000000312","is_verified":false,"is_private":false}}]},"pagination_token":"kol21-g3t-token-b"}}`,
  'R-IG-PROFILE-G3T-A': `{"data":{"pk":"5500000000311","id":"5500000000311","username":"kol21_g3t_a","full_name":"KOL21 G3T A","biography":"kol21 g3 target bio a","follower_count":12000,"following_count":100,"media_count":40,"is_verified":false,"is_private":false,"external_url":"https://example.com/kol21-g3t-a","bio_links":[{"url":"https://example.com/kol21-g3t-a","lynx_url":"https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2Fkol21-g3t-a"}]}}`,
  'R-IG-PROFILE-G3T-B': `{"data":{"pk":"5500000000312","id":"5500000000312","username":"kol21_g3t_b","full_name":"KOL21 G3T B","biography":"kol21 g3 target bio b","follower_count":12000,"following_count":100,"media_count":40,"is_verified":false,"is_private":false,"external_url":"https://example.com/kol21-g3t-b","bio_links":[{"url":"https://example.com/kol21-g3t-b","lynx_url":"https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2Fkol21-g3t-b"}]}}`,
  'R-IG-REELS-G3I': `{"data":{"data":{"items":[{"id":"3300000000000000381","media_type":2,"play_count":1500,"caption":{"text":"kol21 g3 ig profile reel"},"user":{"username":"kol21_g3i_c1","full_name":"KOL21 G3I C1","id":"5500000000381","is_verified":false,"is_private":false}}]}}}`,
}
// :137「C2、C3 只把三处 c1/one 换成 c2/two、c3/three」：按区分大小写的字面替换，C1 原文里 `c1` 两处、`one` 一处，恰为三处；
// 昵称里的大写 `C1` 不在这三处之内，原样保留（见日志疑问表 Q-03）。
const g3pProfile = (c: string, word: string): string =>
  R['R-TT-PROFILE-G3P-C1'].replaceAll('c1', c).replace('one', word)
export const R_G3P_C2 = g3pProfile('c2', 'two')
export const R_G3P_C3 = g3pProfile('c3', 'three')

// ---------------- T1–T15（:166-182）----------------
export const T: Record<string, string> = {
  T1: '/api/v1/tiktok/app/v3/fetch_video_search_result',
  T2: '/api/v1/tiktok/web/fetch_user_profile',
  T3: '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3',
  T4: '/api/v1/tiktok/app/v3/fetch_user_search_result',
  T5: '/api/v1/tiktok/web/fetch_search_user',
  T6: '/api/v1/tiktok/app/v3/fetch_hashtag_search_result',
  T7: '/api/v1/instagram/v2/search_reels',
  T8: '/api/v1/instagram/v2/search_users',
  T9: '/api/v1/instagram/v2/fetch_hashtag_posts',
  T10: '/api/v1/instagram/v1/fetch_user_info_by_username_v3',
  T11: '/api/v1/instagram/v2/fetch_user_posts',
  T12: '/api/v1/instagram/v1/fetch_user_info_by_username_v2',
  T13: '/api/v1/instagram/v2/general_search',
  T14: '/api/v1/instagram/v1/fetch_hashtag_posts',
  T15: '/api/v1/instagram/v3/get_user_posts',
}
const TN = Object.keys(T)

// :107「所有 200/404/402 响应都带 headers content-type: application/json」
const resp = (status: number, body: string): ScriptResponse => ({ status, headers: { 'content-type': 'application/json' }, body })
const r402 = (): ScriptResponse => resp(402, R['R-402'])
const r404 = (): ScriptResponse => resp(404, R['R-404'])
const r200 = (body: string): ScriptResponse => resp(200, body)
const times = (n: number, f: () => ScriptResponse): ScriptResponse[] => Array.from({ length: n }, f)
// :164 陷阱规则的 responses 为 3 个 402 «R-402»
const trap = (name: string): ScriptRule => ({ method: 'GET', endpoint: T[name], responses: times(3, r402) })

/** 带规则名的脚本：names[i] 是第 i 条规则的名字（T1…、R0…、P1…）；名字不进脚本（多出的键会使脚本不合格，ADR-70:3254）。 */
export interface NamedScript { id: string; script: ResponseScript; names: string[]; uses200: boolean }
function build(id: string, special: Array<[string, ScriptRule]>, trapExcept: string[]): NamedScript {
  const rules: ScriptRule[] = []
  const names: string[] = []
  for (const [n, r] of special) { names.push(n); rules.push(r) }
  for (const t of TN) if (!trapExcept.includes(t)) { names.push(t); rules.push(trap(t)) }
  const uses200 = rules.some((r) => r.responses.some((x) => 'status' in x && x.status === 200))
  return { id, script: { schema: 'kol-observer-script/v1', rules }, names, uses200 }
}
const rule = (endpoint: string, responses: ScriptResponse[], query?: Record<string, string>): ScriptRule =>
  query ? { method: 'GET', endpoint, query, responses } : { method: 'GET', endpoint, responses }

export const S: Record<string, () => NamedScript> = {
  // :186 S-TRAP：T1–T15 全是陷阱。用于一切应零请求的跑。
  'S-TRAP': () => build('S-TRAP', [], []),
  // :187
  'S-SEARCH-402': () => build('S-SEARCH-402', [['T1', rule(T.T1, [r402(), r402()])]], ['T1']),
  // :188
  'S-SEARCH-402-REGION': () => build('S-SEARCH-402-REGION', [
    ['R0', rule(T.T1, [r402(), r402()], { region: 'us' })],
    ['R1', rule(T.T1, [r402(), r402()], { region: 'US' })],
  ], ['T1']),
  // :189
  'S-G1-PROBE': () => build('S-G1-PROBE', [
    ['T1', rule(T.T1, times(8, () => r200(R['R-TT-SEARCH-G1'])))],
    ['T2', rule(T.T2, times(8, () => r200(R['R-TT-PROFILE-G1'])))],
    ['T3', rule(T.T3, times(8, () => r200(R['R-TT-POSTS-EMPTY'])))],
  ], ['T1', 'T2', 'T3']),
  // :190
  'S-G1-REGION': () => build('S-G1-REGION', [
    ['R0', rule(T.T1, times(8, () => r200(R['R-TT-SEARCH-G1'])), { region: 'us' })],
    ['R1', rule(T.T1, times(8, () => r200(R['R-TT-SEARCH-G1'])), { region: 'US' })],
    ['T2', rule(T.T2, times(8, () => r200(R['R-TT-PROFILE-G1'])))],
    ['T3', rule(T.T3, times(8, () => r200(R['R-TT-POSTS-EMPTY'])))],
  ], ['T1', 'T2', 'T3']),
  // :191
  'S-G3-TARGET': () => build('S-G3-TARGET', [
    ['R0', rule(T.T7, [r200(R['R-IG-REELS-G3T-A']), r402()], { keyword: 'kol21 g3 target a' })],
    ['R1', rule(T.T7, [r200(R['R-IG-REELS-G3T-B']), r402()], { keyword: 'kol21 g3 target b' })],
    ['R2', rule(T.T10, [r200(R['R-IG-PROFILE-G3T-A']), r402()], { username: 'kol21_g3t_a' })],
    ['R3', rule(T.T10, [r200(R['R-IG-PROFILE-G3T-B']), r402()], { username: 'kol21_g3t_b' })],
  ], ['T7', 'T10']),
  // :192
  'S-G3-BUDGET1': () => build('S-G3-BUDGET1', [
    ['R0', rule(T.T1, [r200(R['R-TT-SEARCH-EMPTY']), r402()], { keyword: 'kol21 g3 budget a' })],
    ['R1', rule(T.T1, [r402(), r402()], { keyword: 'kol21 g3 budget b' })],
  ], ['T1']),
  // :193
  'S-G3-P402': () => build('S-G3-P402', [
    ['T1', rule(T.T1, [r200(R['R-TT-SEARCH-G3P']), r402()])],
    ['T2', rule(T.T2, [r404(), r402(), r402()])],
  ], ['T1', 'T2']),
  // :194
  'S-G3-P-OK': () => build('S-G3-P-OK', [
    ['T1', rule(T.T1, [r200(R['R-TT-SEARCH-G3P']), r402()])],
    ['P1', rule(T.T2, [r200(R['R-TT-PROFILE-G3P-C1']), r402()], { uniqueId: 'kol21_g3p_c1' })],
    ['P2', rule(T.T2, [r200(R_G3P_C2), r402()], { uniqueId: 'kol21_g3p_c2' })],
    ['P3', rule(T.T2, [r200(R_G3P_C3), r402()], { uniqueId: 'kol21_g3p_c3' })],
  ], ['T1', 'T2']),
  // :195
  'S-G3-IG402': () => build('S-G3-IG402', [
    ['T7', rule(T.T7, [r200(R['R-IG-REELS-G3I']), r402()])],
    ['T10', rule(T.T10, [r402(), r402()])],
  ], ['T7', 'T10']),
  // :196
  'S-SAVE-200': () => build('S-SAVE-200', [['T1', rule(T.T1, [r200(R['R-TT-SEARCH-EMPTY']), r402()])]], ['T1']),
  // :197
  'S-SAVE-404': () => build('S-SAVE-404', [['T1', rule(T.T1, [r404(), r402(), r402()])]], ['T1']),
  // :198
  'S-SAVE-NS': () => build('S-SAVE-NS', [['T1', rule(T.T1, [{ connect: 'fail' }, r402()])]], ['T1']),
  // :199 render 阳性对照专用
  'S-CONTROL': () => ({
    id: 'S-CONTROL',
    script: { schema: 'kol-observer-script/v1', rules: [{ method: 'GET', endpoint: '/kol21/control', responses: [{ status: 200, headers: { 'content-type': 'text/plain' }, body: 'kol21-control-ok' }] }] },
    names: ['C0'],
    uses200: false,
  }),
}

// ---------------- 任务目录 F-*（:201-272）----------------
const LEDGER_L0 = `{"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":1,"entries":[]}`
export const F_PAY_LINES: string[] = [
  `{`,
  `  "product": "kol-pay",`,
  `  "market": "US",`,
  `  "target_count": 50,`,
  `  "budget_usd": 2,`,
  `  "cost_ledger": ${LEDGER_L0},`,
  `  "requests": 0,`,
  `  "tasks": [{"keyword":"kol21 g2 pay","dimension":"category","platform":"tiktok"}],`,
  `  "done": [],`,
  `  "offsets": {},`,
  `  "answered": {},`,
  `  "found": {},`,
  `  "pages": {},`,
  `  "created_at": "2026-10-01T00:00:00.000Z",`,
  `  "updated_at": "2026-10-01T00:00:00.000Z"`,
  `}`,
]
export const F_DONE_LINES: string[] = [
  `{`,
  `  "product": "kol-done",`,
  `  "market": "US",`,
  `  "target_count": 50,`,
  `  "budget_usd": 2,`,
  `  "cost_ledger": ${LEDGER_L0},`,
  `  "requests": 0,`,
  `  "tasks": [{"keyword":"kol21 g2 done","dimension":"category","platform":"tiktok"}],`,
  `  "done": [0],`,
  `  "offsets": {"0": 20},`,
  `  "created_at": "2026-10-01T00:00:00.000Z",`,
  `  "updated_at": "2026-10-01T00:00:00.000Z"`,
  `}`,
]
export const F_OLD_LINES: string[] = [
  `{`,
  `  "product": "kol-old",`,
  `  "market": "US",`,
  `  "target_count": 50,`,
  `  "budget_usd": 2,`,
  `  "cost_ledger": ${LEDGER_L0},`,
  `  "requests": 0,`,
  `  "tasks": [{"keyword":"kol21 g3 old","dimension":"category","platform":"tiktok"}],`,
  `  "done": [],`,
  `  "created_at": "2026-10-01T00:00:00.000Z",`,
  `  "updated_at": "2026-10-01T00:00:00.000Z"`,
  `}`,
]
export const DIR = {
  'F-PAY': 'output/kol-pay-202610010000',
  'F-DONE': 'output/kol-done-202610010000',
  'F-OLD': 'output/kol-old-202610010000',
  'F-G6': 'output/kol-gsix-202610010000',
}
/** 名单两份都是 `[]`（F-PAY :213-216、F-DONE :239、F-OLD :258）。F-PAY 任务块 :219-234，F-DONE :241-253，F-OLD :260-271。 */
export const EMPTY_LIST = `[]`

// «COST» 槽样本（:660-761）：替换 F-PAY / F-DONE 的第 5–7 行（替换成 0–3 行，:236）。
export const COST: Record<string, string[]> = {
  L0: [
    `  "budget_usd": 2,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 0,`,
  ],
  L0z: [
    `  "budget_usd": 0,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":0,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 0,`,
  ],
  P2: [
    `  "budget_usd": 1.000001,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":1000001,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 0,`,
  ],
  B1: [
    `  "budget_usd": 2,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 1,`,
  ],
  B2: [
    `  "budget_usd": 2,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":1,"entries":{}},`,
    `  "requests": 0,`,
  ],
  B3: [
    `  "budget_usd": 2,`,
  ],
  B3b: [
    `  "budget_usd": 2,`,
    `  "requests": 0,`,
  ],
  B3z: [],
  B4: [
    `  "budget_usd": 2,`,
    `  "cost_ledger": {"schema":2,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 0,`,
  ],
  B5: [
    `  "budget_usd": 2,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":3000000,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 0,`,
  ],
  B6: [
    `  "budget_usd": 1.000001,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":1000000,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 0,`,
  ],
  PD: [
    `  "budget_usd": 2,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":2,"entries":[],"pending":{"endpoint":"/api/v1/instagram/v2/fetch_hashtag_posts","price_version":"tikhub-public-20260720-5d52fe8fb109","unit_micro_usd":2000,"attempt_id":1}},`,
    `  "requests": 0,`,
  ],
  B7: [
    `  "budget_usd": 2,`,
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":2,"entries":[],"pending":{"endpoint":"/api/v1/instagram/v2/fetch_hashtag_posts","price_version":"tikhub-public-19990101-000000000000","unit_micro_usd":2000,"attempt_id":1}},`,
    `  "requests": 0,`,
  ],
  // :756-760 只用于 G2-24，替换 F-DONE 的第 5–7 行为 2 行
  LNB: [
    `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":3000000,"next_attempt_id":1,"entries":[]},`,
    `  "requests": 0,`,
  ],
}

/** 第 5–7 行（下标 4–6）换成 slot；其余行原样。 */
export function withCost(lines: string[], slot: string[]): string[] {
  return [...lines.slice(0, 4), ...slot, ...lines.slice(7)]
}
/** 把恰好等于 from 的那一行换成 to（G1-20、G1-21）；不存在即抛错（夹具写错应立刻暴露）。 */
export function replaceLine(lines: string[], from: string, to: string): string[] {
  const i = lines.indexOf(from)
  if (i < 0 || lines.indexOf(from, i + 1) >= 0) throw new Error('夹具行不唯一或不存在：' + from)
  return [...lines.slice(0, i), to, ...lines.slice(i + 1)]
}
/** 删掉恰好等于 line 的那一行（G1-23）。 */
export function deleteLine(lines: string[], line: string): string[] {
  const i = lines.indexOf(line)
  if (i < 0 || lines.indexOf(line, i + 1) >= 0) throw new Error('夹具行不唯一或不存在：' + line)
  return [...lines.slice(0, i), ...lines.slice(i + 1)]
}
export const PRICE_VERSION = 'tikhub-public-20260720-5d52fe8fb109' // ADR-107:106-107

// ---------------- G1 / G3 配置（各用例代码块原文）----------------
export const CFG: Record<string, string> = {
  // G1-01 :299
  'G1-01': `{"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-01B :327
  'G1-01B': `{"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g1 beta","dimension":"scene","platform":"tiktok"}]}`,
  // G1-02 :338（G1-02U/W/X「输入同 G1-02」:408、:415、:421）
  'G1-02': `{"product":"kol-alpha","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-02P :377
  'G1-02P': `{"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-02B :388
  'G1-02B': `{"product":"kol-alpha","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g1 beta","dimension":"scene","platform":"tiktok"}]}`,
  // G1-02C :399
  'G1-02C': `{"product":"kol-alpha","budget_usd":2,"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-03 :431
  'G1-03': `{"market":"us","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-03C :443
  'G1-03C': `{"product":"kol-alpha","market":"us","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-04 :454
  'G1-04': `{"product":"kol-alpha"}`,
  // G1-05 :465
  'G1-05': `{}`,
  // G1-06 :476
  'G1-06': `{"product":"kol-alpha","tasks":[]}`,
  // G1-07 :486
  'G1-07': `{"tasks":[]}`,
  // G1-08 :495
  'G1-08': `{"product":"kol-alpha","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"   ","dimension":"scene","platform":"tiktok"}]}`,
  // G1-09 :505
  'G1-09': `{"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"   ","dimension":"scene","platform":"tiktok"}]}`,
  // G1-10 :514
  'G1-10': `{"product":"kol-alpha","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g1 beta","dimension":"Scene","platform":"tiktok"}]}`,
  // G1-11 :524
  'G1-11': `{"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g1 beta","dimension":"Scene","platform":"tiktok"}]}`,
  // G1-12 :533
  'G1-12': `{"product":"kol-alpha","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g1 beta","dimension":"scene"}]}`,
  // G1-13 :543
  'G1-13': `{"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g1 beta","dimension":"scene"}]}`,
  // G1-14 :552
  'G1-14': `{"product":"kol-alpha","market":null,"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-15 :562
  'G1-15': `{"market":null,"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-16 :572（重复键：必须按原字节写盘，:570）
  'G1-16': `{"product":"kol-alpha","budget_usd":2.5,"budget_usd":3.75,"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-17 :583（重复键：原字节，:581）
  'G1-17': `{"tasks":[{"keyword":"kol21 g1 dup-first","keyword":"kol21 g1 dup-second","dimension":"category","platform":"tiktok"}]}`,
  // G1-18 :593
  'G1-18': `{"product":"kol-alpha","target_count":"50","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-19 :603
  'G1-19': `{"target_count":"50","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G1-24 :648
  'G1-24': `{"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G3-01 :1041
  'G3-01': `{"product":"kol-gamma","budget_usd":1,"target_count":0,"tasks":[{"keyword":"kol21 g3 target a","dimension":"category","platform":"instagram"},{"keyword":"kol21 g3 target b","dimension":"category","platform":"instagram"}]}`,
  // G3-04 :1078
  'G3-04': `{"product":"kol-gamma","budget_usd":0,"tasks":[{"keyword":"kol21 g3 budget a","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g3 budget b","dimension":"category","platform":"tiktok"}]}`,
  // G3-05 :1100
  'G3-05': `{"product":"kol-gamma","budget_usd":0.001,"tasks":[{"keyword":"kol21 g3 budget a","dimension":"category","platform":"tiktok"},{"keyword":"kol21 g3 budget b","dimension":"category","platform":"tiktok"}]}`,
  // G3-06 :1116
  'G3-06': `{"product":"kol-gamma","budget_usd":1,"tasks":[{"keyword":"kol21 g3 err","dimension":"category","platform":"tiktok"}]}`,
  // G3-07 :1127；G3-07T「输入与 G3-07 完全相同」:1151
  'G3-07': `{"product":"kol-gamma","budget_usd":1,"target_count":0,"tasks":[{"keyword":"kol21 g3 profile","dimension":"category","platform":"tiktok"}]}`,
  // G3-08 :1172
  'G3-08': `{"product":"kol-gamma","budget_usd":1,"target_count":50,"tasks":[{"keyword":"kol21 g3 ig","dimension":"category","platform":"instagram"}]}`,
  // G3-09 :1183
  'G3-09': `{"product":"kol-gamma","budget_usd":1,"tasks":[{"keyword":"kol21 g3 nokey","dimension":"category","platform":"tiktok"}]}`,
  // G3-11 :1201
  'G3-11': `{"product":"kol-gamma","budget_usd":"2","tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G3-11B :1212
  'G3-11B': `{"product":"kol-gamma","budget_usd":0.0010005,"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
  // G3-11N :1223
  'G3-11N': `{"product":"kol-gamma","budget_usd":null,"tasks":[{"keyword":"kol21 g1 alpha","dimension":"category","platform":"tiktok"}]}`,
}
/** G3-14c、G3-15 的记忆文件内容（:1272-1274 text 块 `{`；G3-15 :1309 引用同一行）。 */
export const MEMORY_BAD = `{`

// ---------------- G5 候选（:1426-1441；C-Z :1430、C-U :1434、C-N :1438）----------------
export const G5 = {
  'C-Z': `{"platform":"tiktok","handle":"a_zero_g5","nickname":"G5 A","followers":0,"post_count":10,"bio":"g5 bio","bio_links":[],"verified":false,"profile_url":"https://www.tiktok.com/@a_zero_g5","source_keyword":"kol21 g5","source_dimension":"category","email":null,"tier":"B","score":20}`,
  'C-U': `{"platform":"tiktok","handle":"b_unqueried_g5","nickname":"G5 B","post_count":10,"bio":"g5 bio","bio_links":[],"verified":false,"profile_url":"https://www.tiktok.com/@b_unqueried_g5","source_keyword":"kol21 g5","source_dimension":"category","email":null,"tier":"B","score":20}`,
  'C-N': `{"platform":"tiktok","handle":"c_known_g5","nickname":"G5 C","followers":12000,"post_count":10,"bio":"g5 bio","bio_links":[],"verified":false,"profile_url":"https://www.tiktok.com/@c_known_g5","source_keyword":"kol21 g5","source_dimension":"category","email":null,"tier":"B","score":20}`,
}
/** :1440 身份组 II：只换身份（handle、nickname，profile_url 里的账号名随之替换）。 */
function reIdentify(src: string, fromHandle: string, toHandle: string, fromNick: string, toNick: string): string {
  return src
    .replace(`"handle":"${fromHandle}"`, `"handle":"${toHandle}"`)
    .replace(`"nickname":"${fromNick}"`, `"nickname":"${toNick}"`)
    .replace(`https://www.tiktok.com/@${fromHandle}`, `https://www.tiktok.com/@${toHandle}`)
}
export const G5_II = {
  "C-N'": reIdentify(G5['C-N'], 'c_known_g5', 'a_known_g5', 'G5 C', 'G5 A'),
  "C-Z'": reIdentify(G5['C-Z'], 'a_zero_g5', 'b_zero_g5', 'G5 A', 'G5 B'),
  "C-U'": reIdentify(G5['C-U'], 'b_unqueried_g5', 'c_unqueried_g5', 'G5 B', 'G5 C'),
}
/** :1441 C-N7：同 C-N，只把 "followers":12000 换成 "followers":7。 */
export const G5_N7 = G5['C-N'].replace('"followers":12000', '"followers":7')

// ---------------- F-G6（:1473-1502；task.json :1479-1494）----------------
export const G6_TASK = [
  `{`,
  `  "product": "kol-gsix",`,
  `  "market": "US",`,
  `  "target_count": 50,`,
  `  "budget_usd": 2,`,
  `  "cost_ledger": {"schema":1,"currency":"USD","unit":"micro_usd","scope":"task","limit_micro_usd":2000000,"next_attempt_id":1,"entries":[]},`,
  `  "requests": 0,`,
  `  "tasks": [{"keyword":"kol21 g6 scene","dimension":"scene","platform":"instagram"},{"keyword":"kol21 g6 cat","dimension":"category","platform":"tiktok"}],`,
  `  "done": [0, 1],`,
  `  "offsets": {"0": 0, "1": 20},`,
  `  "answered": {"0": 1, "1": 1},`,
  `  "found": {"0": 1, "1": 1},`,
  `  "pages": {"0": 1, "1": 1},`,
  `  "created_at": "2026-10-01T00:00:00.000Z",`,
  `  "updated_at": "2026-10-01T00:00:00.000Z"`,
  `}`,
].join('\n')
export const G6_U = `{"platform":"instagram","handle":"aa_unqueried_g6","user_id":"5500000000601","nickname":"G6 Unqueried","post_count":31,"bio":"home cooking diary","bio_links":[],"verified":false,"is_private":false,"profile_url":"https://www.instagram.com/aa_unqueried_g6/","source_keyword":"kol21 g6 scene","source_dimension":"scene","source_tasks":[0],"recent_posts":[{"id":"instagram:3300000000000000601","desc":"g6 scene reel"}],"email":null,"tier":"B","score":20}`
export const G6_K = `{"platform":"tiktok","handle":"zz_known_g6","nickname":"G6 Known","followers":10000,"following":50,"post_count":5,"bio":"daily kitchen clips","bio_links":[],"verified":false,"profile_url":"https://www.tiktok.com/@zz_known_g6","source_keyword":"kol21 g6 cat","source_dimension":"category","source_tasks":[1],"recent_posts":[{"id":"tiktok:7000000000000000602","desc":"g6 category clip","plays":1000,"likes":10}],"email":null,"tier":"B","score":20}`
/** :1496-1502 两份名单字节相同；数组两行，第一行末尾逗号。G6-02 只差数组顺序（各元素字节不变，:1549）。 */
export const g6List = (first: string, second: string): string => `[\n  ${first},\n  ${second}\n]`
/** :1556 G6-03：U 的 handle→zz_unqueried_g6、profile_url 随之；K 的 handle→aa_known_g6、profile_url 随之；其余字节不变。 */
export const G6_U3 = G6_U
  .replace('"handle":"aa_unqueried_g6"', '"handle":"zz_unqueried_g6"')
  .replace('https://www.instagram.com/aa_unqueried_g6/', 'https://www.instagram.com/zz_unqueried_g6/')
export const G6_K3 = G6_K
  .replace('"handle":"zz_known_g6"', '"handle":"aa_known_g6"')
  .replace('https://www.tiktok.com/@zz_known_g6', 'https://www.tiktok.com/@aa_known_g6')
