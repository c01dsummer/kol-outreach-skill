/**
 * 独立筛选契约测试。断言只来自 D20–D22、F11、U9–U11、P4/P5 与架构的对外契约。
 * 本文件不依据 review/rows/report/score/pipeline 的函数体制定预期值。
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { inflateRawSync } from 'node:zlib'
import { runInNewContext } from 'node:vm'
import {
  MANUAL_FEEDBACK_HEADERS, feedbackSummary, persistReviewProjection,
  prepareReviewProjection, ReviewInputError, type AgentReview,
} from './lib/review.js'
import { HEADERS, buildSheets, sortForOutput, toRow } from './lib/rows.js'
import { renderHtml } from './lib/report.js'
import { tierOf } from './lib/score.js'
import { keywordRows } from './lib/pipeline.js'
import type { Creator, TaskState, AdoptionPriority } from './lib/types.js'

interface Checks {
  suite(req: string, name: string): void
  eq(label: string, got: unknown, want: unknown): void
  ok(label: string, condition: boolean): void
  criterion(...ids: string[]): void
  tension(a: string, b: string): void
}

const stamp = '2026-09-25T00:00:00.000Z'
const task = (extra: Partial<TaskState> = {}): TaskState => ({
  product: 'Paper journal', market: 'US', target_count: 20,
  tasks: [{ keyword: 'journaling', dimension: 'scene', platform: 'tiktok' }],
  done: [], created_at: stamp, updated_at: stamp, ...extra,
})
const creator = (platform: Creator['platform'], handle: string, extra: Partial<Creator> = {}): Creator => ({
  platform, handle, nickname: `Name ${handle}`, bio_links: [], verified: false,
  profile_url: `https://example.test/${platform}/${handle}`,
  source_keyword: 'journaling', source_dimension: 'scene', source_tasks: [0], ...extra,
})
const review = (key: string, priority: AdoptionPriority = '备选'): AgentReview => ({
  account_keys: [key], eligibility: '合格', adoption_priority: priority,
  observed_content: `Observed ${key}`, work_evidence: `Post ${key}`,
  natural_integration: `Uses the journal in a recurring planning video for ${key}`,
  mismatch_risk: 'Audience location unverified', fit: '✅', fit_reason: 'Planning content',
  reviewed_at: stamp,
})
const inTemp = <T>(run: (dir: string) => T): T => {
  const dir = mkdtempSync(join(tmpdir(), 'kol-screening-contract-'))
  try { return run(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}
const csvField = (value: unknown): string => {
  const s = value === undefined || value === null ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
const writeFeedback = (dir: string, rows: Array<Record<string, string>>): void => {
  const lines = [MANUAL_FEEDBACK_HEADERS.join(','),
    ...rows.map(row => MANUAL_FEEDBACK_HEADERS.map(header => csvField(row[header])).join(','))]
  writeFileSync(join(dir, 'manual-feedback.csv'), `${lines.join('\r\n')}\r\n`)
}
const feedback = (round_id: string, platform: string, handle: string,
  fields: Record<string, string> = {}): Record<string, string> => ({ round_id, platform, handle, ...fields })
const htmlMeta = (list: Creator[]) => ({
  product: 'Paper journal', market: 'US', platforms: ['tiktok', 'instagram'], keywords: [],
  total: list.length,
  tiers: {
    A: list.filter(c => c.tier === 'A').length,
    B: list.filter(c => c.tier === 'B').length,
    C: list.filter(c => c.tier === 'C').length,
  },
  email_count: 0, cross_platform_count: 0, enriched: false, memory_status: 'absent',
  cost_http_200_usd: '0', cost_unknown_result_usd: '0', cost_pending_usd: '0',
  cost_basis: 'Fixture cost only', cost_price_versions: [], cost_problems: [],
})
const xlsxColumn = (path: string, sheet: number, column: string): string[] | null => {
  const bytes = readFileSync(path)
  const wanted = `xl/worksheets/sheet${sheet}.xml`
  for (let i = 0; i + 30 < bytes.length; i++) {
    if (bytes.readUInt32LE(i) !== 0x04034b50) continue
    const nameLength = bytes.readUInt16LE(i + 26)
    const extraLength = bytes.readUInt16LE(i + 28)
    const name = bytes.subarray(i + 30, i + 30 + nameLength).toString('utf8')
    if (name !== wanted) continue
    const start = i + 30 + nameLength + extraLength
    const compressed = bytes.subarray(start, start + bytes.readUInt32LE(i + 18))
    const xml = (bytes.readUInt16LE(i + 8) === 8 ? inflateRawSync(compressed) : compressed).toString('utf8')
    return [...xml.matchAll(new RegExp(`<c r="${column}(\\d+)"[^>]*>[\\s\\S]*?<t[^>]*>([^<]*)<\\/t>`, 'g'))]
      .filter(match => Number(match[1]) > 1).map(match => match[2])
  }
  // 缺 sheet 是被测交付物的失败，由调用处的行序断言报告，不让夹具异常吞掉汇总。
  return null
}

/** Execute the delivered inline script against the card and filter controls in its HTML. */
const clickHtmlFilters = (html: string): { initial: number[]; after: number[][]; scrolls: number; cardCount: number } => {
  const attributes = (tag: string): Record<string, string> => Object.fromEntries(
    [...tag.matchAll(/\b([a-z][a-z0-9-]*)="([^"]*)"/gi)].map(match => [match[1], match[2]]))
  const element = (tag: string) => {
    const attrs = attributes(tag)
    const classes = new Set((attrs.class ?? '').split(/\s+/).filter(Boolean))
    const handlers: Array<() => void> = []
    return {
      dataset: Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-'))
        .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), value])),
      classList: {
        add: (name: string) => { classes.add(name) },
        remove: (name: string) => { classes.delete(name) },
        contains: (name: string) => classes.has(name),
      },
      style: { display: /(?:^|;)\s*display\s*:\s*none/i.test(attrs.style ?? '') ? 'none' : '' },
      hidden: false,
      textContent: '',
      innerHTML: '',
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'click') handlers.push(handler)
      },
      click: () => { for (const handler of handlers) handler() },
    }
  }
  const tags = [...html.matchAll(/<(?:button|div)\b[^>]*>/gi)].map(match => match[0])
  const tabs = tags.filter(tag => {
    const attrs = attributes(tag)
    return (attrs.class ?? '').split(/\s+/).includes('tab') && !!attrs['data-kind']
  }).map(element)
  const cards = tags.filter(tag => {
    const attrs = attributes(tag)
    return (attrs.class ?? '').split(/\s+/).includes('card') && !!attrs['data-tier']
  }).map(element)
  let scrolls = 0
  const otherNodes = new Map<string, ReturnType<typeof element>>()
  const document = {
    querySelectorAll: (selector: string) => {
      if (selector === '#cards .card') return cards
      if (selector === '.tab[data-kind]' || selector === '.tab') return tabs
      const kind = /^\.tab\[data-kind=["']?(priority|tier)["']?\]$/.exec(selector)?.[1]
      return kind ? tabs.filter(tab => tab.dataset.kind === kind) : []
    },
    getElementById: (id: string) => {
      if (!otherNodes.has(id)) otherNodes.set(id, element('<div>'))
      return otherNodes.get(id)
    },
  }
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1])
  runInNewContext(scripts.join('\n'), { document, window: {
    scrollTo: () => { scrolls++ }, scrollBy: () => { scrolls++ }, scrollY: 0,
  }, navigator: { clipboard: { writeText: async () => undefined } } }, { timeout: 1000 })
  const visible = (): number[] => cards.flatMap((card, index) =>
    card.hidden || card.style.display === 'none' || card.classList.contains('hidden') ? [] : [index])
  const initial = visible()
  const after: number[][] = []
  for (const [kind, value] of [
    ['priority', '优先联系'], ['tier', 'A'], ['tier', 'B'], ['priority', 'all'],
    ['tier', 'all'],
  ]) {
    const tab = tabs.find(one => one.dataset.kind === kind && one.dataset.value === value)
    if (!tab) throw new Error(`缺筛选按钮 ${kind}:${value}`)
    tab.click()
    after.push(visible())
  }
  return { initial, after, scrolls, cardCount: cards.length }
}

export function runScreeningContractTests({ suite, eq, ok, criterion, tension }: Checks): void {
  suite('D21', '未评和旧校准保留可区分状态，不制造新判断')
  inTemp(dir => {
    const unreviewed = creator('tiktok', 'unreviewed')
    const plain = prepareReviewProjection(dir, task(), [unreviewed]).creators[0]
    eq('缺 Agent 评审显示未评', plain.review_status, '未评')
    eq('未评不推断为不合格', plain.eligibility, undefined)
    eq('未评不推断内容适合', plain.fit, undefined)
    eq('缺语义判断只能为 B', tierOf(plain, 99), 'B')
    criterion('D21.c', 'D21.d')
    tension('D21', 'P1')
  })
  inTemp(dir => {
    const state = task({ brand_calibration: {
      version: 'v2', target_creator_types: ['journal makers'], tone_aesthetic: ['calm'],
      natural_scenarios: ['planning'], negative_signals: ['hard sell'],
      sources: [{ source: 'operator', kind: 'brand_preference', detail: 'calm' }],
    } })
    const item = creator('tiktok', 'oldreview', { email: 'oldreview@example.test' })
    const initial = prepareReviewProjection(dir, state, [item])
    initial.document.reviews['tiktok:oldreview'] = {
      ...review('tiktok:oldreview', '优先联系'), brand_calibration_version: 'v1',
    }
    persistReviewProjection(dir, initial)
    const projected = prepareReviewProjection(dir, state, [item]).creators[0]
    eq('校准版本变化后显示待重评', projected.review_status, '待重评')
    eq('旧评审证据仍可读', projected.observed_content, 'Observed tiktok:oldreview')
    ok('旧评审不能作为当前校准下的优先联系', projected.effective_priority !== '优先联系')
    ok('完整但版本已变的评审不能落 A', tierOf(projected, 99) !== 'A')
    criterion('D20.c')
  })
  eq('校准变更后的旧拒绝结论不再作为当前 C 层依据',
    tierOf(creator('tiktok', 'stalerejection', { fit: '❌', review_status: '待重评' }), 99), 'B')
  criterion('D20.c', 'D21.c')
  inTemp(dir => {
    const item = creator('tiktok', 'contradiction', { email: 'contradiction@example.test' })
    const initial = prepareReviewProjection(dir, task(), [item])
    initial.document.reviews['tiktok:contradiction'] = {
      ...review('tiktok:contradiction'), eligibility: '不合格', fit: '✅',
      brand_calibration_version: undefined,
    }
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify(initial.document))
    let error: unknown
    try { prepareReviewProjection(dir, task(), [item]) } catch (caught) { error = caught }
    ok('Agent 不合格却标内容适合时，投影前拒绝矛盾输入',
      error instanceof ReviewInputError && error.message.includes('tiktok:contradiction'))
    criterion('F11.b')
  })
  inTemp(dir => {
    const item = creator('tiktok', 'incomplete', { email: 'incomplete@example.test' })
    const initial = prepareReviewProjection(dir, task(), [item])
    initial.document.reviews['tiktok:incomplete'] = {
      account_keys: ['tiktok:incomplete'], eligibility: '合格',
    }
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify(initial.document))
    let projected: Creator | undefined, error: unknown
    try { projected = prepareReviewProjection(dir, task(), [item]).creators[0] }
    catch (caught) { error = caught }
    ok('只填合格、缺采用建议和证据，拒绝输入或至多待核实',
      error instanceof ReviewInputError || (projected !== undefined && tierOf(projected, 99) !== 'A'))
    criterion('D21.d', 'F11.a')
  })
  const legacyFitOnly = creator('tiktok', 'legacyfit', {
    fit: '✅', fit_reason: 'Legacy judgment', email: 'legacy@example.test',
  })
  eq('旧任务仅有 fit/fit_reason 的评审仍可按高分兼容 A', tierOf(legacyFitOnly, 99), 'A')
  criterion('D21.c')
  inTemp(dir => {
    const state = task()
    const old = creator('tiktok', 'cost-person', {
      fit: '✅', fit_reason: 'Legacy task field',
    })
    const anotherOld = creator('instagram', 'durable-a')
    const valid = creator('tiktok', 'validcreator')
    let prepared: ReturnType<typeof prepareReviewProjection> | undefined, error: unknown
    try { prepared = prepareReviewProjection(dir, state, [old, anotherOld, valid]) }
    catch (caught) { error = caught }
    ok('旧 creator 的不可规范化 handle 不阻断读取或交付投影',
      error === undefined && prepared?.creators.map(c => c.handle).join(',')
        === 'cost-person,durable-a,validcreator')
    if (prepared) {
      eq('非法旧账号不进入新审核轮次',
        prepared.document.rounds.flatMap(round => round.candidates.map(c => c.account_key)),
        ['tiktok:validcreator'])
      ok('非法旧账号不被迁移为 agent-review 键',
        !Object.keys(prepared.document.reviews).some(key => /cost-person|durable-a/.test(key)))
    }
    criterion('D21.b', 'D21.c')
  })
  inTemp(dir => {
    const item = creator('tiktok', 'validcreator')
    const initial = prepareReviewProjection(dir, task(), [item])
    initial.document.reviews['tiktok:bad-name'] = review('tiktok:bad-name')
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify(initial.document))
    let error: unknown
    try { prepareReviewProjection(dir, task(), [item]) } catch (caught) { error = caught }
    ok('Agent JSON 中非法账号键仍被拒绝',
      error instanceof ReviewInputError && error.message.includes('tiktok:bad-name'))
    criterion('D21.a')
  })

  suite('D22', '人工三态、账号键、轮次与明确分母')
  inTemp(dir => {
    const handles = ['eligibleyes', 'eligibleno', 'uncertain', 'blank', 'adoptedyes']
    const people = handles.map(h => creator('tiktok', h))
    const first = prepareReviewProjection(dir, task(), people)
    for (const h of handles) {
      const priority: AdoptionPriority = h === 'eligibleno' || h === 'uncertain' ? '优先联系' : '备选'
      first.document.reviews[`tiktok:${h}`] = review(`tiktok:${h}`, priority)
    }
    persistReviewProjection(dir, first)
    const round = first.document.rounds[0].round_id
    writeFeedback(dir, [
      feedback(round, 'tiktok', 'ELIGIBLEYES', { manual_eligible: 'yes' }),
      feedback(round, 'tiktok', 'eligibleno', { manual_eligible: 'no', manual_adopted: 'no',
        manual_reject_reason: '内容不匹配' }),
      feedback(round, 'tiktok', 'uncertain', { manual_eligible: 'unknown', manual_adopted: 'unknown' }),
      feedback(round, 'tiktok', 'blank'),
      feedback(round, 'tiktok', 'adoptedyes', { manual_eligible: 'yes', manual_adopted: 'yes',
        manual_note: 'Operator checked the recent work' }),
    ])
    const prepared = prepareReviewProjection(dir, task(), people)
    const byHandle = Object.fromEntries(prepared.creators.map(c => [c.handle, c]))
    eq('大小写不敏感地关联人工行', byHandle.eligibleyes.manual_eligible, 'yes')
    eq('空白仍为未评', byHandle.blank.manual_reviewed, false)
    eq('unknown 是已看但无法判断',
      [byHandle.uncertain.manual_reviewed, byHandle.uncertain.manual_adopted], [true, 'unknown'])
    eq('人工 no 覆盖有效展示优先级', byHandle.eligibleno.effective_priority, '暂不采用')
    eq('人工 unknown 覆盖有效展示优先级', byHandle.uncertain.effective_priority, '待核实')
    eq('人工 yes 提升有效展示优先级', byHandle.adoptedyes.effective_priority, '优先联系')
    eq('人工未填沿用 Agent 建议', byHandle.blank.effective_priority, '备选')
    eq('人工结论不覆盖 Agent 合格性和建议',
      [byHandle.eligibleno.eligibility, byHandle.eligibleno.adoption_priority],
      ['合格', '优先联系'])
    eq('人工备注保留', byHandle.adoptedyes.manual_note,
      'Operator checked the recent work')
    const summary = feedbackSummary(prepared.document, prepared.feedback)
    eq('合格分母仅 yes/no，unknown 与未评分开', summary.eligible,
      { yes: 2, no: 1, unknown: 1, unreviewed: 1, rate: 2 / 3 })
    eq('采用分母独立计算，仅 adopted 的 yes/no', summary.adopted,
      { yes: 1, no: 1, unknown: 1, unreviewed: 2, rate: 1 / 2 })
    eq('拒绝原因按人工明确原因计数', summary.reject_reasons,
      [{ reason: '内容不匹配', count: 1 }])
    ok('Agent 建议优先而团队拒绝的账号进入分歧清单',
      summary.disagreements.some(account => account.includes('eligibleno')))
    writeFileSync(join(dir, 'task.json'), JSON.stringify(task({ memory_status: 'absent' })))
    writeFileSync(join(dir, 'creators.json'), JSON.stringify(people))
    const repo = process.cwd()
    const rendered = spawnSync(process.execPath,
      ['--import', join(repo, 'node_modules/tsx/dist/loader.mjs'),
        join(repo, 'scripts/render.ts'), '--dir', dir],
      { cwd: dir, encoding: 'utf8', timeout: 15000 })
    eq('明确分母夹具经完整 render 交付', rendered.status, 0)
    if (rendered.status === 0) {
      const html = readFileSync(join(dir, 'report.html'), 'utf8')
      const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      const near = (label: string): string => {
        const at = visible.lastIndexOf(label)
        return at < 0 ? '' : visible.slice(at, at + 180)
      }
      ok('报告人工合格率在同一指标旁给出明确 2/3 分母',
        /2\s*\/\s*3/.test(near('合格率')))
      ok('报告人工采用率在同一指标旁给出独立 1/2 分母',
        /1\s*\/\s*2/.test(near('采用率')))
      ok('报告分别展示未评与已看无法判断',
        visible.includes('未评') && visible.includes('unknown'))
      ok('报告显示实际人工拒绝原因和分歧账号',
        visible.includes('内容不匹配') && visible.includes('eligibleno'))
    }
    criterion('D22.b', 'D22.c', 'D22.d', 'D22.e', 'U9.a', 'U11.a', 'U11.b')
    tension('U11', 'P5')
  })
  inTemp(dir => {
    const state = task()
    const both = creator('tiktok', 'crafttt', {
      cross_platform: true, linked_handle: 'instagram:craftig',
    })
    const initial = prepareReviewProjection(dir, state, [both])
    eq('同人两平台账号各自冻结为候选', initial.document.rounds[0].candidates.map(c => c.account_key),
      ['tiktok:crafttt', 'instagram:craftig'])
    initial.document.reviews['tiktok:crafttt'] = review('tiktok:crafttt')
    initial.document.reviews['instagram:craftig'] = review('instagram:craftig')
    persistReviewProjection(dir, initial)
    writeFeedback(dir, [feedback(initial.document.rounds[0].round_id, 'instagram', 'CRAFTIG', {
      manual_adopted: 'yes',
    })])
    const tiktokMain = prepareReviewProjection(dir, state, [both]).creators[0]
    eq('Instagram 作答不让 TikTok 主账号变为已审核', tiktokMain.manual_reviewed, false)
    eq('关联平台人工结论单独可见',
      tiktokMain.manual_feedback_accounts?.find(a => a.account_key === 'instagram:craftig')?.manual_adopted,
      'yes')
    const switched = creator('instagram', 'craftig', {
      cross_platform: true, linked_handle: 'tiktok:crafttt',
    })
    const switchedBeforeFeedback = prepareReviewProjection(dir, state, [switched])
    eq('切换主账号后原 Instagram 作答仍属 Instagram',
      [switchedBeforeFeedback.creators[0].manual_reviewed,
        switchedBeforeFeedback.creators[0].manual_adopted], [true, 'yes'])
    eq('两个账号已在同一冻结轮次，无新账号就不新开轮',
      switchedBeforeFeedback.document.rounds.length, 1)
    eq('切换主账号不删除原平台 Agent 评审',
      switchedBeforeFeedback.document.reviews['tiktok:crafttt']?.observed_content,
      'Observed tiktok:crafttt')
    eq('切换主账号找到 Instagram 自己的 Agent 评审',
      switchedBeforeFeedback.creators[0].observed_content,
      'Observed instagram:craftig')
    criterion('D21.c', 'D22.d')
  })
  inTemp(dir => {
    const oldState = task()
    const old = creator('tiktok', 'roundold')
    const first = prepareReviewProjection(dir, oldState, [old])
    persistReviewProjection(dir, first)
    const frozen = structuredClone(first.document.rounds[0])
    const nextState = task({ tasks: [
      { keyword: 'journaling', dimension: 'scene', platform: 'tiktok' },
      { keyword: 'paper art', dimension: 'category', platform: 'instagram' },
    ] })
    const newcomer = creator('instagram', 'roundnew', {
      source_keyword: 'paper art', source_dimension: 'category', source_tasks: [1],
    })
    const second = prepareReviewProjection(dir, nextState, [old, newcomer])
    persistReviewProjection(dir, second)
    eq('旧轮候选键和来源完全冻结', second.document.rounds[0], frozen)
    eq('新账号单独进入新轮', second.document.rounds[1]?.candidates.map(c => c.account_key),
      ['instagram:roundnew'])
    eq('新轮保留真实任务来源', second.document.rounds[1]?.candidates[0]?.source_tasks,
      [{ task_index: 1, keyword: 'paper art', dimension: 'category', platform: 'instagram' }])
    const repeated = prepareReviewProjection(dir, nextState, [old, newcomer])
    eq('重复交付不再新增轮次', repeated.document.rounds.length, 2)
    criterion('D22.a')
  })
  inTemp(dir => {
    const state = task()
    const alice = creator('tiktok', 'alice', {
      fit: '✅', fit_reason: 'Legacy review of journal content',
    })
    const first = prepareReviewProjection(dir, state, [alice])
    persistReviewProjection(dir, first)
    const frozenAliceRound = structuredClone(first.document.rounds[0])
    const bob = creator('tiktok', 'bob')
    let second: ReturnType<typeof prepareReviewProjection> | undefined
    let repeated: ReturnType<typeof prepareReviewProjection> | undefined
    let error: unknown
    try {
      second = prepareReviewProjection(dir, state, [bob])
      persistReviewProjection(dir, second)
      repeated = prepareReviewProjection(dir, state, [bob])
    } catch (caught) { error = caught }
    ok('旧已评账号不在当前名单时，新增账号与重复投影仍可读取',
      error === undefined && second !== undefined && repeated !== undefined)
    if (second && repeated) {
      eq('离开当前名单的 Alice 历史轮次保持冻结', repeated.document.rounds[0], frozenAliceRound)
      eq('本次新增的 Bob 单独进入下一轮',
        repeated.document.rounds[1]?.candidates.map(c => c.account_key), ['tiktok:bob'])
      eq('重复投影不再新开轮次', repeated.document.rounds.length, 2)
      ok('Alice 的历史 Agent 判断仍留在独立评审文件',
        repeated.document.reviews['tiktok:alice']?.fit === '✅')
    }
    criterion('D21.c', 'D22.a')
  })
  inTemp(dir => {
    const state = task()
    const person = creator('tiktok', 'eligibilitypending')
    const first = prepareReviewProjection(dir, state, [person])
    first.document.reviews['tiktok:eligibilitypending'] = {
      ...review('tiktok:eligibilitypending', '优先联系'),
      eligibility: '待核实', fit: '⚠️', fit_reason: 'Eligibility needs checking',
    }
    persistReviewProjection(dir, first)
    writeFeedback(dir, [feedback(first.document.rounds[0].round_id, 'tiktok',
      'eligibilitypending', { manual_eligible: 'no', manual_reject_reason: '内容不匹配' })])
    const projected = prepareReviewProjection(dir, state, [person])
    const summary = feedbackSummary(projected.document, projected.feedback)
    eq('人工否决但未填采用结论时仍保留 Agent 强推建议',
      [projected.creators[0].adoption_priority, projected.creators[0].manual_adopted],
      ['优先联系', undefined])
    ok('Agent 强推且合格性待核、团队明确不合格列入分歧',
      summary.disagreements.some(account => account.includes('eligibilitypending')))
    criterion('U11.b', 'D22.e')
  })
  inTemp(dir => {
    const person = creator('tiktok', 'denominatorzero')
    const prepared = prepareReviewProjection(dir, task(), [person])
    const summary = feedbackSummary(prepared.document, prepared.feedback)
    eq('没有明确 yes/no 时合格率不可计算', summary.eligible.rate, null)
    eq('没有明确 yes/no 时采用率不可计算', summary.adopted.rate, null)
    criterion('U11.a')
  })
  {
    const state = task({ done: [0], answered: { 0: 1 }, found: { 0: 4 } })
    for (const [name, source] of [
      ['null', null], ['empty', []], ['out of range', [99]], ['fractional', [0.5]],
    ] as const) {
      const person = creator('tiktok', 'badsource', {
        source_tasks: source as unknown as number[], fit: '✅', manual_reviewed: true,
        manual_feedback_accounts: [{ round_id: 'round-001', account_key: 'tiktok:badsource',
          manual_adopted: 'yes', manual_reviewed: true }],
      })
      const row = keywordRows(state, [person])[0]
      eq(`来源 ${name} 不伪造入围、语义通过或人工审核的零值`,
        [row.shortlisted, row.fit_pass, row.manual_reviewed], [null, null, null])
    }
    criterion('U11.c')
    tension('U11', 'P5')
  }
  {
    const state = task({
      tasks: [
        { keyword: 'same term', dimension: 'scene', platform: 'tiktok' },
        { keyword: 'same term', dimension: 'scene', platform: 'tiktok' },
      ],
      done: [0, 1], answered: { 0: 1, 1: 1 }, found: { 0: 7, 1: 4 },
    })
    const shared = creator('tiktok', 'bothterms', {
      source_keyword: 'same term', source_tasks: [0, 1], fit: '✅', manual_reviewed: true,
      manual_feedback_accounts: [{ round_id: 'round-001', account_key: 'tiktok:bothterms',
        manual_adopted: 'yes', manual_reviewed: true }],
    })
    const secondOnly = creator('tiktok', 'secondonly', {
      source_keyword: 'same term', source_tasks: [1], fit: '❌', manual_reviewed: false,
    })
    const unknownSource = creator('tiktok', 'unknownsource', {
      source_keyword: 'same term', source_tasks: undefined, fit: '✅', manual_reviewed: true,
    })
    const rows = keywordRows(state, [shared, secondOnly])
    eq('相同词与平台的不同任务保持两行和原下标', rows.map(r => r.task_index), [0, 1])
    eq('供应商返回条目与入围人数分开计', rows.map(r => [r.found, r.shortlisted]),
      [[7, 1], [4, 2]])
    eq('同人多任务各计一次人工审核归因',
      rows.map(r => r.manual_reviewed), [1, 1])
    const incomplete = keywordRows(state, [shared, secondOnly, unknownSource])
    eq('混入来源未知账号后不捏造该行入围和人工计数',
      incomplete.map(r => [r.shortlisted, r.manual_reviewed]),
      [[null, null], [null, null]])
    criterion('U11.c')
  }
  {
    const state = task({
      tasks: [
        { keyword: 'same creator', dimension: 'scene', platform: 'tiktok' },
        { keyword: 'same creator', dimension: 'scene', platform: 'instagram' },
      ],
      done: [0, 1], answered: { 0: 1, 1: 1 }, found: { 0: 3, 1: 4 },
    })
    const main = creator('tiktok', 'jointtt', {
      source_keyword: 'same creator', source_tasks: [0, 1],
      cross_platform: true, linked_handle: 'instagram:jointig',
      review_status: '已评', eligibility: '合格', fit: '✅',
    })
    const before = keywordRows(state, [main])
    eq('双平台任务均确实关联到同一合并行',
      before.map(row => [row.task_index, row.platform, row.shortlisted]),
      [[0, 'tiktok', 1], [1, 'instagram', 1]])
    eq('主 TikTok 已评且通过，不替未评 Instagram 宣称语义通过',
      before.map(row => row.fit_pass), [1, 0])
    const withInstagramReview = keywordRows(state, [{ ...main,
      linked_agent_review: {
        account_key: 'instagram:jointig', review_status: '已评',
        eligibility: '合格', fit: '✅',
      },
    }])
    eq('Instagram 自身已评且通过后才计入其任务',
      withInstagramReview.map(row => row.fit_pass), [1, 1])
    const withInstagramHuman = keywordRows(state, [{ ...main,
      manual_feedback_accounts: [{ round_id: 'round-001', account_key: 'instagram:jointig',
        manual_adopted: 'yes', manual_reviewed: true }],
    }])
    eq('关联 Instagram 已审只计入 Instagram 关键词任务',
      withInstagramHuman.map(row => row.manual_reviewed), [0, 1])
    const keywordCells = (rows: ReturnType<typeof keywordRows>, column: number): string[] => {
      const html = renderHtml([main], { ...htmlMeta([main]), keywords: rows })
      const body = ((html.split('<h2>关键词表现</h2>')[1] ?? '').split('<tbody>')[1] ?? '')
        .split('</tbody>')[0]
      return body.split('<tr>').slice(1).map(row =>
        [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(match => match[1].trim())[column] ?? '（缺单元格）')
    }
    eq('HTML 关键词表逐行显示对应平台的语义通过人数',
      keywordCells(withInstagramHuman, 6), ['1', '0'])
    eq('HTML 关键词表逐行显示对应平台的人工审核人数',
      keywordCells(withInstagramHuman, 7), ['0', '1'])
    const sourceUnknown = keywordRows(state, [creator('tiktok', 'sourceunknown', {
      source_tasks: null as unknown as number[], manual_reviewed: true,
    })])
    eq('HTML 来源未知时人工审核格不伪造零',
      keywordCells(sourceUnknown, 7), ['—', '—'])
    criterion('U11.c', 'F11.b')
  }

  suite('U9', '同一优先级全序进入 CSV、XLSX 和 HTML')
  inTemp(dir => {
    const unsorted = [
      creator('tiktok', 'rejecteda', { effective_priority: '暂不采用', tier: 'A', score: 200 }),
      creator('tiktok', 'preferredb', { effective_priority: '优先联系', tier: 'B', score: 90 }),
      creator('tiktok', 'backupa', { effective_priority: '备选', tier: 'A', score: 100 }),
      creator('tiktok', 'preferredalow', { effective_priority: '优先联系', tier: 'A', score: 10 }),
      creator('tiktok', 'pendinga', { effective_priority: '待核实', tier: 'A', score: 300 }),
      creator('tiktok', 'preferredahigh', { effective_priority: '优先联系', tier: 'A', score: 50 }),
    ]
    const expected = ['preferredahigh', 'preferredalow', 'preferredb',
      'backupa', 'pendinga', 'rejecteda']
    const sorted = sortForOutput(unsorted)
    eq('CSV 全序先优先级，再层级，再原分数', sorted.map(c => c.handle), expected)
    const rowHandle = HEADERS.indexOf('handle')
    const rowPriority = HEADERS.indexOf('effective_priority')
    ok('旧列仍在新增评审列之前', HEADERS.indexOf('metrics_sample_scope') < HEADERS.indexOf('eligibility'))
    eq('CSV 行保留账号和有效优先级列', sorted.map(c => [toRow(c)[rowHandle], toRow(c)[rowPriority]]),
      sorted.map(c => [c.handle, c.effective_priority]))
    const sheets = buildSheets(unsorted)
    eq('XLSX 固定 A/B/C 三层', sheets.length, 3)
    eq('A 层内先优先级再原分数', sheets[0]?.rows.map(row => row[rowHandle]) ?? [],
      ['preferredahigh', 'preferredalow', 'backupa', 'pendinga', 'rejecteda'])
    eq('B 层保留优先联系账号', sheets[1]?.rows.map(row => row[rowHandle]) ?? [], ['preferredb'])
    eq('空 C 层仍有工作表', sheets[2]?.rows.length, 0)
    const html = renderHtml(sorted, htmlMeta(sorted))
    const positions = sorted.map(c => html.indexOf(c.profile_url))
    ok('HTML 卡片顺序与 CSV 全序一致', positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])))
    ok('初始 HTML 卡片全可见', !/data-tier="[ABC]"[^>]*display\s*:\s*none/i.test(html))
    ok('报告包含优先级与层级两个筛选维度',
      html.includes('data-priority=') && html.includes('data-tier='))
    ok('筛选切换不触发滚动', !html.includes('scrollIntoView'))
    criterion('U9.b', 'U9.c')
  })
  inTemp(root => {
    const dir = join(root, 'task')
    mkdirSync(dir)
    const people = [
      creator('tiktok', 'latea', { tier: 'A', score: 200, fit: '✅', email: 'late@example.test' }),
      creator('tiktok', 'firstb', { tier: 'B', score: 90, fit: '✅' }),
      creator('tiktok', 'backupa', { tier: 'A', score: 100, fit: '✅', email: 'backup@example.test' }),
      creator('tiktok', 'firsta', { tier: 'A', score: 10, fit: '✅', email: 'first@example.test' }),
    ]
    const state = task({ memory_status: 'absent' })
    const prepared = prepareReviewProjection(dir, state, people)
    prepared.document.reviews['tiktok:latea'] = review('tiktok:latea', '优先联系')
    prepared.document.reviews['tiktok:firstb'] = review('tiktok:firstb', '备选')
    prepared.document.reviews['tiktok:backupa'] = review('tiktok:backupa', '备选')
    prepared.document.reviews['tiktok:firsta'] = review('tiktok:firsta', '优先联系')
    persistReviewProjection(dir, prepared)
    writeFeedback(dir, [
      feedback(prepared.document.rounds[0].round_id, 'tiktok', 'firstb', { manual_adopted: 'yes' }),
      feedback(prepared.document.rounds[0].round_id, 'tiktok', 'firsta', { manual_adopted: 'no' }),
    ])
    writeFileSync(join(dir, 'task.json'), JSON.stringify(state))
    writeFileSync(join(dir, 'creators.json'), JSON.stringify(people))
    const repo = process.cwd()
    const result = spawnSync(process.execPath,
      ['--import', join(repo, 'node_modules/tsx/dist/loader.mjs'),
        join(repo, 'scripts/render.ts'), '--dir', dir],
      { cwd: root, encoding: 'utf8', timeout: 15000 })
    eq('排序夹具经完整 render 交付', result.status, 0)
    if (result.status !== 0) return
    const csvLines = readFileSync(join(dir, 'kol.csv'), 'utf8').trim().split(/\r?\n/)
    const csvHeaders = csvLines[0].split(',')
    const values = csvLines.slice(1).map(line => line.split(','))
    const column = (row: string[], header: string): string => row[csvHeaders.indexOf(header)]
    const handles = values.map(row => column(row, 'handle'))
    eq('完整 render 中人工和 Agent 有效优先级未混淆',
      values.map(row => column(row, 'effective_priority')),
      ['优先联系', '优先联系', '备选', '暂不采用'])
    eq('人工 yes 的 B 先于 Agent 备选 A，人工 no 的 A 最后',
      handles, ['latea', 'firstb', 'backupa', 'firsta'])
    eq('人工结论未覆盖 Agent 原建议',
      values.map(row => column(row, 'adoption_priority')),
      ['优先联系', '备选', '备选', '优先联系'])
    const priorityRank: Record<string, number> = {
      '优先联系': 0, '备选': 1, '待核实': 2, '暂不采用': 3,
    }
    const tierRank: Record<string, number> = { A: 0, B: 1, C: 2 }
    const outputKey = (row: string[]): [number, number, number] => [
      priorityRank[column(row, 'effective_priority')],
      tierRank[column(row, 'tier')],
      -Number(column(row, 'score')),
    ]
    const compareKeys = (a: number[], b: number[]): number => {
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
      return 0
    }
    ok('真实 CSV 全序按优先级、A/B/C、原分数单调排列',
      values.every((row, i) => i === 0 || compareKeys(outputKey(values[i - 1]), outputKey(row)) <= 0))
    const html = readFileSync(join(dir, 'report.html'), 'utf8')
    const htmlPositions = handles.map(handle => html.indexOf(`https://example.test/tiktok/${handle}`))
    ok('真实 HTML 卡片与 CSV 同序',
      htmlPositions.every((p, i) => p >= 0 && (i === 0 || p > htmlPositions[i - 1])))
    const xlsx = join(dir, 'kol.xlsx')
    for (const [sheet, tier] of [[1, 'A'], [2, 'B'], [3, 'C']] as const)
      eq(`真实 XLSX ${tier} 层行序与 CSV 同一全序`, xlsxColumn(xlsx, sheet, 'F'),
        values.filter(row => column(row, 'tier') === tier).map(row => column(row, 'handle')))
    eq('真实 XLSX A 层保留人工降优先级后的内部顺序', xlsxColumn(xlsx, 1, 'F'),
      ['latea', 'backupa', 'firsta'])
    eq('真实 XLSX B 层保留人工提升的账号', xlsxColumn(xlsx, 2, 'F'), ['firstb'])
    criterion('U9.b')
  })

  suite('U10', '优先级与分层筛选同时生效，切换后不滚动页面')
  {
    const people = [
      creator('tiktok', 'prioritya', { effective_priority: '优先联系', tier: 'A' }),
      creator('tiktok', 'priorityb', { effective_priority: '优先联系', tier: 'B' }),
      creator('tiktok', 'backupa', { effective_priority: '备选', tier: 'A' }),
      creator('tiktok', 'backupb', { effective_priority: '备选', tier: 'B' }),
      creator('tiktok', 'pendingc', { effective_priority: '待核实', tier: 'C' }),
    ]
    let result: ReturnType<typeof clickHtmlFilters> | undefined, error: unknown
    try { result = clickHtmlFilters(renderHtml(people, htmlMeta(people))) }
    catch (caught) { error = caught }
    eq('交付 HTML 中的筛选脚本和五张候选卡片可执行',
      [error === undefined ? '' : String(error), result?.cardCount], ['', 5])
    if (result) {
      eq('初始不依赖脚本隐藏任何候选', result.initial, [0, 1, 2, 3, 4])
      eq('只选优先联系时两层都可见', result.after[0], [0, 1])
      eq('再选 A 时只留同时满足两维的一张', result.after[1], [0])
      eq('层级改 B 时保留优先级条件', result.after[2], [1])
      eq('优先级回全部但仍选 B 时两张 B 可见', result.after[3], [1, 3])
      eq('两维回全部重新显示所有候选', result.after[4], [0, 1, 2, 3, 4])
      eq('切筛选不调用页面滚动', result.scrolls, 0)
    }
    criterion('U10.a')
  }

  suite('U10', '每张卡片分别展示平台、Agent 证据、人工结论和未核边界')
  {
    const tt = creator('tiktok', 'cardtt', {
      tier: 'A', review_status: '已评', eligibility: '合格',
      adoption_priority: '优先联系', effective_priority: '暂不采用',
      observed_content: 'TT original journal videos', work_evidence: 'TT post evidence 101',
      natural_integration: 'TT journal scene with a quiet product touch',
      mismatch_risk: 'TT audience location remains unverified',
      manual_eligible: 'no', manual_adopted: 'no', manual_reviewed: true,
    })
    const ig = creator('instagram', 'cardig', {
      tier: 'B', review_status: '已评', eligibility: '合格',
      adoption_priority: '备选', effective_priority: '待核实',
      observed_content: 'IG paper craft reels', work_evidence: 'IG reel evidence 202',
      natural_integration: 'IG craft scene with a natural product placement',
      mismatch_risk: 'IG comment authenticity remains unverified',
      manual_eligible: 'unknown', manual_adopted: 'unknown', manual_reviewed: true,
    })
    const html = renderHtml([tt, ig], htmlMeta([tt, ig]))
    const starts = [...html.matchAll(/<div class="card\b[^>]*>/g)].map(match => match.index)
    eq('两个平台各有一张独立卡片', starts.length, 2)
    const cards = starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length))
    const ttCard = cards.find(card => card.includes(tt.profile_url)) ?? ''
    const igCard = cards.find(card => card.includes(ig.profile_url)) ?? ''
    const visibleCard = (card: string): string => card.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const ttText = visibleCard(ttCard), igText = visibleCard(igCard)
    ok('TikTok 与 Instagram 卡片各带本平台的视觉标识',
      /class="pf tiktok"/.test(ttCard) && /class="pf instagram"/.test(igCard))
    const ttStyle = /\.pf\.tiktok\{([^}]+)\}/.exec(html)?.[1]
    const igStyle = /\.pf\.instagram\{([^}]+)\}/.exec(html)?.[1]
    ok('两种平台标识使用不同的样式', !!ttStyle && !!igStyle && ttStyle !== igStyle)
    for (const [platform, card, item] of [
      ['TikTok', ttText, tt], ['Instagram', igText, ig],
    ] as const) {
      ok(`${platform} 卡片展示自己的三段 Agent 证据`,
        !!card && !!item.observed_content && card.includes(item.observed_content)
          && !!item.work_evidence && card.includes(item.work_evidence)
          && !!item.natural_integration && card.includes(item.natural_integration))
      ok(`${platform} 卡片展示自己的未核风险边界`,
        card.includes('最大风险／待核') && !!item.mismatch_risk && card.includes(item.mismatch_risk))
      ok(`${platform} 卡片分别标明 Agent 与人工两侧`,
        card.includes('Agent') && card.includes('人工'))
    }
    ok('TikTok 的 Agent 优先建议与人工明确否定并列可见',
      /Agent.{0,60}合格性\s*合格.{0,40}建议\s*优先联系/.test(ttText)
        && /人工.{0,60}合格\s*no.{0,30}采用\s*no/i.test(ttText))
    ok('Instagram 的 Agent 备选建议与人工 unknown 并列可见',
      /Agent.{0,60}合格性\s*合格.{0,40}建议\s*备选/.test(igText)
        && /人工.{0,60}合格\s*unknown.{0,30}采用\s*unknown/i.test(igText))
    criterion('U10.b')
  }

  suite('D22', '坏人工 CSV 带行号并在写交付物或记忆前拒绝')
  for (const [name, badRows, line] of [
    ['非法枚举', (r: string) => [feedback(r, 'tiktok', 'guarded', { manual_adopted: 'maybe' })], 2],
    ['非法账号名', (r: string) => [feedback(r, 'tiktok', 'cost-person', { manual_adopted: 'yes' })], 2],
    ['非法拒绝原因', (r: string) => [feedback(r, 'tiktok', 'guarded',
      { manual_eligible: 'no', manual_reject_reason: '随便写' })], 2],
    ['互相冲突', (r: string) => [feedback(r, 'tiktok', 'guarded',
      { manual_eligible: 'no', manual_adopted: 'yes' })], 2],
    ['无法匹配', (r: string) => [feedback(r, 'tiktok', 'someoneelse', { manual_adopted: 'yes' })], 2],
    ['重复账号', (r: string) => [feedback(r, 'tiktok', 'guarded', { manual_adopted: 'yes' }),
      feedback(r, 'TIKTOK', 'GUARDED', { manual_adopted: 'no' })], 3],
  ] as const) {
    inTemp(root => {
      const dir = join(root, 'task')
      mkdirSync(dir)
      const person = creator('tiktok', 'guarded')
      const state = task()
      const prepared = prepareReviewProjection(dir, state, [person])
      persistReviewProjection(dir, prepared)
      writeFileSync(join(dir, 'task.json'), JSON.stringify(state))
      writeFileSync(join(dir, 'creators.json'), JSON.stringify([person]))
      writeFeedback(dir, badRows(prepared.document.rounds[0].round_id))
      for (const file of ['kol.csv', 'kol.xlsx', 'meta.json', 'report.html']) {
        writeFileSync(join(dir, file), `sentinel for ${file}`)
      }
      const guarded = ['agent-review.json', 'creators.json', 'kol.csv', 'kol.xlsx', 'meta.json', 'report.html']
      const before = Object.fromEntries(guarded.map(file => [file, readFileSync(join(dir, file)).toString('base64')]))
      const repo = process.cwd()
      const result = spawnSync(process.execPath,
        ['--import', join(repo, 'node_modules/tsx/dist/loader.mjs'),
          join(repo, 'scripts/render.ts'), '--dir', dir],
        { cwd: root, encoding: 'utf8', timeout: 15000 })
      const message = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      eq(`${name}：render 以输入错误退出`, result.status, 2)
      ok(`${name}：错误指出人工文件行号 ${line}`,
        new RegExp(`manual-feedback\\.csv(?::|\\s*(?:行|line)\\s*)${line}(?!\\d)`, 'i').test(message))
      eq(`${name}：所有原交付文件与评审原件未动`,
        Object.fromEntries(guarded.map(file => [file, readFileSync(join(dir, file)).toString('base64')])), before)
      eq(`${name}：未写跨任务记忆`, existsSync(join(root, 'memory', 'creators.json')), false)
    })
  }
  criterion('D22.d', 'D22.e')

  suite('P4', '人工采用不能恢复已联系或屏蔽账号')
  inTemp(root => {
    const dir = join(root, 'task')
    mkdirSync(dir)
    const contacted = creator('tiktok', 'alreadycontacted', { followers: 20_000 })
    const blocked = creator('tiktok', 'alreadyblocked', { followers: 20_000 })
    const eligible = creator('tiktok', 'stilleligible', { followers: 20_000 })
    const people = [contacted, blocked, eligible]
    const state = task({ memory_status: 'ok' })
    const prepared = prepareReviewProjection(dir, state, people)
    persistReviewProjection(dir, prepared)
    writeFileSync(join(dir, 'task.json'), JSON.stringify(state))
    writeFileSync(join(dir, 'creators.json'), JSON.stringify(people))
    const csvRows = people.map(c => feedback(prepared.document.rounds[0].round_id,
      c.platform, c.handle, { manual_eligible: 'yes', manual_adopted: 'yes' }))
    writeFeedback(dir, csvRows)
    const feedbackBefore = readFileSync(join(dir, 'manual-feedback.csv'), 'utf8')
    const memoryDir = join(root, 'memory')
    mkdirSync(memoryDir)
    const memoryEntry = (c: Creator, flags: { contacted: boolean; blocked: boolean }) => ({
      platform: c.platform, handle: c.handle, nickname: c.nickname, followers: c.followers,
      first_seen: '2026-09-01', recommendations: [], contacted: flags.contacted,
      replied: false, blocked: flags.blocked, note: '',
    })
    writeFileSync(join(memoryDir, 'creators.json'), JSON.stringify({
      version: 1, updated_at: stamp, creators: {
        'tiktok:alreadycontacted': memoryEntry(contacted, { contacted: true, blocked: false }),
        'tiktok:alreadyblocked': memoryEntry(blocked, { contacted: false, blocked: true }),
      },
    }))
    const repo = process.cwd()
    const result = spawnSync(process.execPath,
      ['--import', join(repo, 'node_modules/tsx/dist/loader.mjs'),
        join(repo, 'scripts/render.ts'), '--dir', dir],
      { cwd: root, encoding: 'utf8', timeout: 15000 })
    eq('临时任务成功交付', result.status, 0)
    if (result.status !== 0) return
    const delivered = JSON.parse(readFileSync(join(dir, 'creators.json'), 'utf8')) as Creator[]
    eq('已联系与屏蔽账号即使人工采用也不得进入名单', delivered.map(c => c.handle),
      ['stilleligible'])
    const csv = readFileSync(join(dir, 'kol.csv'), 'utf8')
    const html = readFileSync(join(dir, 'report.html'), 'utf8')
    ok('CSV 不含已联系或屏蔽账号，HTML 不生成它们的名单卡片',
      !csv.includes('alreadycontacted') && !csv.includes('alreadyblocked')
      && !html.includes(contacted.profile_url) && !html.includes(blocked.profile_url)
      && html.includes(eligible.profile_url))
    eq('交付未覆盖人工作答', readFileSync(join(dir, 'manual-feedback.csv'), 'utf8'),
      feedbackBefore)
    const savedMemory = JSON.parse(readFileSync(join(memoryDir, 'creators.json'), 'utf8'))
    eq('原记忆的 contacted 与 blocked 状态不被人工结论改写',
      [savedMemory.creators['tiktok:alreadycontacted'].contacted,
        savedMemory.creators['tiktok:alreadyblocked'].blocked], [true, true])
    tension('D22', 'P4')
  })
}
