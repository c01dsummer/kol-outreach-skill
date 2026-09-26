/** Contract tests for task review, frozen human pools, and per-platform identity. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Creator, TaskState } from './lib/types.js'
import {
  appendManualFeedbackTemplate, brandCalibrationProblems, feedbackSummary, prepareReviewProjection,
  persistReviewProjection, writeManualFeedbackTemplate, type AgentReview,
} from './lib/review.js'
import { tierOf } from './lib/score.js'
import { filterByMemory, useMemoryFile } from './lib/memory.js'
import { keywordRows } from './lib/pipeline.js'

type Check = {
  suite: (req: string, name: string) => void
  eq: (label: string, got: unknown, want: unknown) => void
  ok: (label: string, condition: boolean) => void
}

const task = (): TaskState => ({
  product: 'Example', market: 'US', target_count: 4,
  tasks: [
    { keyword: 'journal with me', dimension: 'scene', platform: 'instagram' },
    { keyword: 'journal with me', dimension: 'audience', platform: 'instagram' },
    { keyword: 'journal with me', dimension: 'scene', platform: 'tiktok' },
  ],
  done: [], created_at: '2026-09-25T00:00:00Z', updated_at: '',
})

const creator = (platform: Creator['platform'], handle: string, extra: Partial<Creator> = {}): Creator => ({
  platform, handle, nickname: handle, bio_links: [], verified: false,
  profile_url: `https://www.${platform}.com/${handle}`,
  source_keyword: 'journal with me', source_dimension: 'scene', ...extra,
})

const reviewed = (key: string, version?: string): AgentReview => ({
  account_keys: [key], eligibility: '合格', adoption_priority: '优先联系',
  observed_content: '个人手帐和夜间整理视频', work_evidence: '公开作品链接 https://example.test/post/1',
  natural_integration: '在原有夜间记录段落中先佩戴，再轻触，再记录当天感受',
  mismatch_risk: '尚未核实受众所在地区', ...(version ? { brand_calibration_version: version } : {}),
})

const withTemp = (run: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), 'kol-review-contract-'))
  try { run(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

const caught = (run: () => unknown): string => {
  try { run(); return '' } catch (error) { return String(error) }
}

export function runReviewStorageTests({ suite, eq, ok }: Check): void {
  suite('D21', '旧 Agent 字段入独立正本，重建名单和重复投影仍保留；缺新判断显示未评')
  withTemp(dir => {
    const state = task()
    const old = creator('instagram', 'Legacy', {
      fit: '✅', fit_reason: '已观察到真实手帐内容', outreach_draft: 'Hello {name}', email: 'x@example.test',
    })
    writeFileSync(join(dir, 'creators.json'), JSON.stringify([old]))
    const first = prepareReviewProjection(dir, state, [creator('instagram', 'legacy')])
    eq('legacy fit survives first projection', first.creators[0].fit, '✅')
    eq('legacy draft survives first projection', first.creators[0].outreach_draft, 'Hello {name}')
    eq('legacy review has no invented new verdict', first.creators[0].review_status, '未评')
    persistReviewProjection(dir, first)
    writeFileSync(join(dir, 'creators.json'), JSON.stringify([creator('instagram', 'legacy')]))
    const resumed = prepareReviewProjection(dir, state, [creator('instagram', 'legacy')])
    eq('legacy fit survives rebuilt delivery', resumed.creators[0].fit, '✅')
    eq('legacy draft survives rebuilt delivery', resumed.creators[0].outreach_draft, 'Hello {name}')
    eq('legacy review stays unreviewed under new contract', resumed.creators[0].review_status, '未评')
    ok('review did not enter raw accumulator', !existsSync(join(dir, 'creators.raw.json')))
  })

  suite('D21', '旧名单先被标未评后补入历史 fit，仍能迁移给指标补全')
  withTemp(dir => {
    const state = task()
    const historical = creator('instagram', 'legacyaftercollect', {
      fit: '✅', fit_reason: '旧人工语义补评', review_status: '未评', email: 'known@example.test',
    })
    writeFileSync(join(dir, 'creators.json'), JSON.stringify([historical]))
    const projected = prepareReviewProjection(dir, state, [historical])
    eq('unreviewed status plus legacy fit remains semantic candidate', projected.creators[0].fit, '✅')
    eq('legacy fit migrated into independent Agent document',
      projected.document.reviews['instagram:legacyaftercollect']?.fit, '✅')
    eq('legacy fit does not invent new review fields', projected.creators[0].review_status, '未评')
  })

  suite('D21', '续跑先冻结旧交付候选，新增账号进入下一轮且旧评审不游离')
  withTemp(dir => {
    const state = task()
    const old = creator('instagram', 'alice', {
      fit: '✅', fit_reason: '旧观察', source_tasks: [0],
    })
    const next = creator('tiktok', 'bob', { source_tasks: [2] })
    writeFileSync(join(dir, 'creators.json'), JSON.stringify([old]))
    const resumed = prepareReviewProjection(dir, state, [next])
    eq('old account remains fixed in first review round',
      resumed.document.rounds[0]?.candidates.map(c => c.account_key), ['instagram:alice'])
    eq('new account is a separate review round',
      resumed.document.rounds[1]?.candidates.map(c => c.account_key), ['tiktok:bob'])
    eq('old and new rounds retain their own task origins',
      resumed.document.rounds.map(r => r.candidates[0]?.source_tasks?.[0]?.task_index), [0, 2])
    // 缺旧轮时，上面已有明确失败；继续保存游离的旧评审再读会抛输入错误，吞掉测试汇总。
    if (resumed.document.rounds.length !== 2) return
    persistReviewProjection(dir, resumed)
    writeFileSync(join(dir, 'creators.json'), JSON.stringify(resumed.creators))
    const repeated = prepareReviewProjection(dir, state, resumed.creators)
    eq('later render keeps the same two frozen pools', repeated.document.rounds.length, 2)
    eq('old Agent fit remains in the separate review document',
      repeated.document.reviews['instagram:alice']?.fit, '✅')
    const template = readFileSync(writeManualFeedbackTemplate(dir, repeated.document), 'utf8')
    ok('feedback template contains both fixed candidate pools',
      template.includes('round-001,instagram,alice') && template.includes('round-002,tiktok,bob'))
  })

  suite('D21', '新版评审正本缺失时不从旧名单投影复活判断')
  withTemp(dir => {
    const state = task()
    const person = creator('instagram', 'newreview', { email: 'known@example.test' })
    const initial = prepareReviewProjection(dir, state, [person])
    initial.document.reviews['instagram:newreview'] = reviewed('instagram:newreview')
    persistReviewProjection(dir, initial)
    const projected = prepareReviewProjection(dir, state, [person])
    writeFileSync(join(dir, 'creators.json'), JSON.stringify(projected.creators))
    rmSync(join(dir, 'agent-review.json'))
    const missing = prepareReviewProjection(dir, state, [person]).creators[0]
    eq('removed new review is not migrated from old delivery projection', missing.fit, undefined)
    eq('removed new review is visibly unreviewed', missing.review_status, '未评')
    eq('removed new review cannot enter A', tierOf(missing, 99), 'B')
  })

  suite('D21', '旧供应商账号名无效时不制造评审身份，人工与 Agent 文件仍严格校验')
  withTemp(dir => {
    const state = task()
    const invalid = creator('instagram', 'cost-person', { fit: '✅', linked_handle: 'tiktok:valid' })
    writeFileSync(join(dir, 'creators.json'), JSON.stringify([invalid]))
    const projected = prepareReviewProjection(dir, state, [invalid])
    eq('invalid legacy handle has no frozen account', projected.document.rounds.length, 0)
    eq('invalid legacy handle has no inferred new review', projected.creators[0].review_status, '未评')
    eq('invalid legacy row retains historical fit for enrichment', projected.creators[0].fit, '✅')
    eq('invalid primary cannot inherit linked-platform review', projected.creators[0].linked_agent_review, undefined)
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify({
      version: 1, updated_at: '', reviews: { 'instagram:cost-person': {
        account_keys: ['instagram:cost-person'],
      } }, rounds: [],
    }))
    ok('explicit invalid Agent account still rejected',
      caught(() => prepareReviewProjection(dir, state, [invalid])).includes('reviews["instagram:cost-person"]'))
  })

  suite('D20', '品牌版本变化保留旧判断并标待重评，不继续强推荐')
  withTemp(dir => {
    const state = task()
    state.brand_calibration = {
      version: 'v2', target_creator_types: ['journaling'], tone_aesthetic: ['natural'],
      natural_scenarios: ['daily reset'], negative_signals: [],
      sources: [{ source: 'brand brief', kind: 'brand_preference', detail: 'natural' }],
    }
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify({
      version: 1, updated_at: '', reviews: { 'instagram:alice': reviewed('instagram:alice', 'v1') }, rounds: [],
    }))
    const result = prepareReviewProjection(dir, state, [creator('instagram', 'ALICE')]).creators[0]
    eq('original Agent adoption retained', result.adoption_priority, '优先联系')
    eq('review explicitly stale', result.review_status, '待重评')
    eq('stale strong recommendation not shown as effective priority', result.effective_priority, '待核实')
    eq('stale semantic fit cannot remain A', tierOf({ ...result, email: 'known@example.test' }, 99), 'B')
    eq('stale negative fit cannot remain current C', tierOf({ ...result, fit: '❌' }, 99), 'B')
    const removedCalibration = prepareReviewProjection(dir, task(), [creator('instagram', 'ALICE')]).creators[0]
    eq('removing calibration also marks old judgment stale', removedCalibration.review_status, '待重评')
    eq('removing calibration cannot restore old priority', removedCalibration.effective_priority, '待核实')
  })

  suite('D20', '项目校准可缺席；存在时版本和逐条来源性质须可核')
  withTemp(dir => {
    eq('optional calibration absent is valid', brandCalibrationProblems(task()), [])
    const state = { ...task(), brand_calibration: {
      version: ' ', target_creator_types: ['journaling'], tone_aesthetic: [],
      natural_scenarios: [], negative_signals: [],
      sources: [{ source: 'brief', kind: 'assumed_fact', detail: 'claimed' }],
    } } as unknown as TaskState
    const error = caught(() => prepareReviewProjection(dir, state, []))
    ok('invalid calibration version points to task input', error.includes('task.json') && error.includes('brand_calibration.version'))
    ok('unverified source kind cannot be treated as fact', error.includes('brand_calibration.sources[0].kind'))
    ok('bad calibration created no review document', !existsSync(join(dir, 'agent-review.json')))
  })

  suite('D21', '跨平台主账号切换保留各平台评审；未评平台不借用关联平台结论')
  withTemp(dir => {
    const state = task()
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify({
      version: 1, updated_at: '', reviews: { 'instagram:alice': reviewed('instagram:alice') },
      rounds: [{ round_id: 'round-001', created_at: '2026-09-25T00:00:00Z', source: 'task.json',
        candidates: [{ account_key: 'instagram:alice', source_tasks: null }] }],
    }))
    const agentOnly = prepareReviewProjection(dir, state,
      [creator('tiktok', 'Alice', { linked_handle: 'instagram:ALICE' })]).creators[0]
    eq('linked Agent priority alone does not turn new main into a strong recommendation',
      [agentOnly.review_status, agentOnly.effective_priority, agentOnly.linked_agent_review?.adoption_priority],
      ['未评', '待核实', '优先联系'])
    writeFileSync(join(dir, 'manual-feedback.csv'),
      '\uFEFFround_id,platform,handle,manual_eligible,manual_adopted,manual_content_fit,manual_engagement,manual_comment_authenticity,manual_reject_reason,manual_note\r\n' +
      'round-001,instagram,@ALICE,yes,yes,,,,,\r\n')
    const tt = prepareReviewProjection(dir, state, [creator('tiktok', 'Alice', { linked_handle: 'instagram:ALICE' })])
    eq('new main platform has no Agent review', tt.creators[0].review_status, '未评')
    eq('linked Agent review remains visible with identity', tt.creators[0].linked_agent_review?.account_key, 'instagram:alice')
    eq('new main platform has no human adoption', tt.creators[0].manual_adopted, undefined)
    eq('linked human adoption retains platform identity', tt.creators[0].manual_feedback_accounts?.[0]?.account_key, 'instagram:alice')
    eq('linked platform human yes keeps person priority after switch', tt.creators[0].effective_priority, '优先联系')
    eq('priority names reviewed platform without marking current main reviewed',
      tt.creators[0].effective_priority_account_key, 'instagram:alice')
    persistReviewProjection(dir, tt)
    const ig = prepareReviewProjection(dir, state, [creator('instagram', 'alice', { linked_handle: 'tiktok:Alice' })])
    eq('old platform Agent result still found after switch', ig.creators[0].review_status, '已评')
    eq('old platform human result still found after switch', ig.creators[0].manual_adopted, 'yes')
    eq('human yes controls old platform priority', ig.creators[0].effective_priority, '优先联系')
    writeFileSync(join(dir, 'manual-feedback.csv'),
      '\uFEFFround_id,platform,handle,manual_eligible,manual_adopted,manual_content_fit,manual_engagement,manual_comment_authenticity,manual_reject_reason,manual_note\r\n' +
      'round-001,instagram,@ALICE,yes,yes,,,,,\r\n' +
      'round-002,tiktok,alice,yes,no,,,,,\r\n')
    const conflict = caught(() => prepareReviewProjection(dir, state,
      [creator('tiktok', 'alice', { linked_handle: 'instagram:alice' })]))
    ok('opposite platform adoption points to both CSV lines before output',
      conflict.includes('manual-feedback.csv:2') && conflict.includes('manual-feedback.csv:3')
        && conflict.includes('冲突'))
  })

  suite('D22', '审核轮次冻结原任务身份；同词同平台两个任务仍分开记录')
  withTemp(dir => {
    const state = task()
    const first = prepareReviewProjection(dir, state, [creator('instagram', 'a', { source_tasks: [0, 1] })])
    eq('first round has one candidate', first.document.rounds[0].candidates.length, 1)
    eq('original task indices preserved', first.document.rounds[0].candidates[0].source_tasks?.map(t => t.task_index), [0, 1])
    persistReviewProjection(dir, first)
    const next = prepareReviewProjection(dir, state, [
      creator('instagram', 'a', { source_tasks: [0, 1] }),
      creator('tiktok', 'b', { source_tasks: [2] }),
    ])
    eq('new account belongs to new round', next.document.rounds.map(r => r.round_id), ['round-001', 'round-002'])
    eq('first round pool unchanged', next.document.rounds[0].candidates.map(c => c.account_key), ['instagram:a'])
    eq('new round source retains original index', next.document.rounds[1].candidates[0].source_tasks?.[0].task_index, 2)
    next.document.rounds[0].candidates[0].source_tasks![0].platform = 'tiktok'
    persistReviewProjection(dir, next)
    const sourceError = caught(() => prepareReviewProjection(dir, state, [creator('instagram', 'a')]))
    ok('tampered frozen source names exact candidate and task location',
      sourceError.includes('rounds[0].candidates[0].source_tasks[0]')
        && sourceError.includes('不一致'))
  })

  suite('U11', '关键词人工审核人数按原任务和对应平台归因，未知来源不补造')
  {
    const state = task()
    state.answered = { 0: 1, 1: 1, 2: 1 }
    state.found = { 0: 3, 1: 4, 2: 2 }
    const merged = creator('tiktok', 'alice', {
      linked_handle: 'instagram:alice', source_tasks: [0, 1, 2],
      manual_feedback_accounts: [{ round_id: 'round-001', account_key: 'instagram:alice',
        manual_eligible: 'yes', manual_reviewed: true }],
    })
    const rows = keywordRows(state, [merged])
    eq('two same-word IG tasks keep distinct original indices', rows.map(row => row.task_index), [0, 1, 2])
    eq('IG review counts in both IG source tasks, not TT source task', rows.map(row => row.manual_reviewed), [1, 1, 0])
    eq('vendor row counts remain separate from candidate count', rows.map(row => [row.found, row.shortlisted]),
      [[3, 1], [4, 1], [2, 1]])
    eq('unknown source yields no invented human attribution', keywordRows(state, [
      creator('instagram', 'unknown', { manual_reviewed: true }),
    ]).map(row => row.manual_reviewed), [null, null, null])
  }

  suite('D22', '人工空白、unknown 与明确否定分开，比例分母只用明确 yes/no')
  withTemp(dir => {
    const state = task()
    const creators = ['a', 'b', 'c', 'd'].map(handle => creator('instagram', handle))
    const initial = prepareReviewProjection(dir, state, creators)
    initial.document.reviews = {
      'instagram:a': { ...reviewed('instagram:a'), adoption_priority: '备选' },
      'instagram:b': reviewed('instagram:b'),
      'instagram:c': reviewed('instagram:c'),
    }
    persistReviewProjection(dir, initial)
    const file = writeManualFeedbackTemplate(dir, initial.document)
    const header = readFileSync(file, 'utf8').split('\r\n')[0]
    writeFileSync(file, [header,
      'round-001,instagram,a,yes,yes,high,high,unknown,,',
      'round-001,instagram,b,no,no,low,low,low,商家号；内容不匹配,',
      'round-001,instagram,c,unknown,unknown,unknown,unknown,unknown,,',
      'round-001,instagram,d,,,,,,,',
      ''].join('\r\n'))
    const prepared = prepareReviewProjection(dir, state, creators)
    const summary = feedbackSummary(prepared.document, prepared.feedback)
    eq('eligibility denominator excludes unknown and blank', summary.eligible.rate, 0.5)
    eq('adoption denominator excludes unknown and blank', summary.adopted.rate, 0.5)
    eq('unknown separately counted', summary.adopted.unknown, 1)
    eq('blank separately counted', summary.adopted.unreviewed, 1)
    eq('one human no is effective rejection', prepared.creators[1].effective_priority, '暂不采用')
    eq('human yes overrides Agent backup', prepared.creators[0].effective_priority, '优先联系')
    eq('unknown is a reviewed verify', [prepared.creators[2].manual_reviewed, prepared.creators[2].effective_priority], [true, '待核实'])
    eq('blank is not reviewed', prepared.creators[3].manual_reviewed, false)
    eq('multiple allowed reasons retain separate counts', summary.reject_reasons.length, 2)
    eq('backup versus adopted and two conflicts on one account each list once',
      summary.disagreements, ['instagram:a', 'instagram:b'])
    writeFileSync(file, readFileSync(file, 'utf8').replace('round-001,instagram,b,no,no,',
      'round-001,instagram,b,yes,no,'))
    eq('adopted no with eligible yes still rejects',
      prepareReviewProjection(dir, state, creators).creators[1].effective_priority, '暂不采用')
  })

  suite('D22', 'Agent 判不合格而人工明确合格也进入分歧账号')
  withTemp(dir => {
    const state = task()
    const person = creator('instagram', 'reverse')
    const prepared = prepareReviewProjection(dir, state, [person])
    prepared.document.reviews['instagram:reverse'] = {
      ...reviewed('instagram:reverse'), eligibility: '不合格', adoption_priority: '暂不采用',
    }
    persistReviewProjection(dir, prepared)
    const file = writeManualFeedbackTemplate(dir, prepared.document)
    const header = readFileSync(file, 'utf8').split('\r\n')[0]
    writeFileSync(file, `${header}\r\nround-001,instagram,reverse,yes,,,,,,\r\n`)
    const projected = prepareReviewProjection(dir, state, [person])
    eq('opposite explicit eligibility verdict is a disagreement',
      feedbackSummary(projected.document, projected.feedback).disagreements, ['instagram:reverse'])
  })

  suite('D22', '人工明确不合格与 Agent 强推荐分歧即使 Agent 合格性待核实也列出')
  withTemp(dir => {
    const state = task()
    const person = creator('instagram', 'uncertain')
    const prepared = prepareReviewProjection(dir, state, [person])
    prepared.document.reviews['instagram:uncertain'] = {
      ...reviewed('instagram:uncertain'), eligibility: '待核实', adoption_priority: '优先联系',
    }
    persistReviewProjection(dir, prepared)
    const file = writeManualFeedbackTemplate(dir, prepared.document)
    const header = readFileSync(file, 'utf8').split('\r\n')[0]
    writeFileSync(file, `${header}\r\nround-001,instagram,uncertain,no,,,,,,\r\n`)
    const projected = prepareReviewProjection(dir, state, [person])
    eq('manual eligible no changes effective priority', projected.creators[0].effective_priority, '暂不采用')
    eq('agent priority versus manual eligibility rejection is a disagreement',
      feedbackSummary(projected.document, projected.feedback).disagreements, ['instagram:uncertain'])
  })

  suite('D22', 'D1.c/D22.d：人工反馈平台大小写不影响账号关联，归一后的重复行仍指出文件行号')
  withTemp(dir => {
    const state = task()
    const creators = [creator('instagram', 'Alice'), creator('tiktok', 'Bob')]
    const initial = prepareReviewProjection(dir, state, creators)
    persistReviewProjection(dir, initial)
    const csvFile = join(dir, 'manual-feedback.csv')
    const header = 'round_id,platform,handle,manual_eligible,manual_adopted,manual_content_fit,manual_engagement,manual_comment_authenticity,manual_reject_reason,manual_note'

    writeFileSync(csvFile, `${header}\r\n` +
      'round-001,Instagram,@ALICE,yes,yes,,,,,\r\n' +
      'round-001,TIKTOK,@BOB,yes,no,,,,,\r\n')
    try {
      const projected = prepareReviewProjection(dir, state, creators)
      eq('mixed-case Instagram feedback attaches to its account',
        [projected.creators[0].manual_eligible, projected.creators[0].manual_adopted], ['yes', 'yes'])
      eq('uppercase TikTok feedback attaches to its account',
        [projected.creators[1].manual_eligible, projected.creators[1].manual_adopted], ['yes', 'no'])
      eq('feedback identities remain separate and normalized',
        projected.creators.map(person => person.manual_feedback_accounts?.[0]?.account_key),
        ['instagram:alice', 'tiktok:bob'])
    } catch (error) {
      eq('mixed-case platform feedback is accepted', String(error), '')
    }

    writeFileSync(csvFile, `${header}\r\n` +
      'round-001,instagram,alice,yes,,,,,,\r\n' +
      'round-001,Instagram,@ALICE,no,,,,,,\r\n')
    const duplicate = caught(() => prepareReviewProjection(dir, state, creators))
    ok('platform-case duplicate identifies both original CSV lines',
      duplicate.includes(`${csvFile}:2`) && duplicate.includes(`${csvFile}:3`) && duplicate.includes('重复账号'))

    writeFileSync(csvFile, `${header}\r\nround-001,INSTAGRAMX,alice,yes,,,,,,\r\n`)
    const invalid = caught(() => prepareReviewProjection(dir, state, creators))
    ok('unsupported platform is still rejected at its CSV line', invalid.includes(`${csvFile}:2`))
  })

  suite('D22', '重复、冲突、非法及无法匹配的人工行逐行拒绝，坏输入不写正本')
  withTemp(dir => {
    const state = task()
    const creators = [creator('instagram', 'a')]
    const initial = prepareReviewProjection(dir, state, creators)
    persistReviewProjection(dir, initial)
    const docFile = join(dir, 'agent-review.json')
    const before = readFileSync(docFile, 'utf8')
    const csvFile = join(dir, 'manual-feedback.csv')
    const header = 'round_id,platform,handle,manual_eligible,manual_adopted,manual_content_fit,manual_engagement,manual_comment_authenticity,manual_reject_reason,manual_note'
    const cases = [
      ['conflict', 'round-001,instagram,a,no,yes,,,,,', 'manual_eligible=no'],
      ['invalid', 'round-001,instagram,a,,,wrong,,,,', 'manual_content_fit'],
      ['unmatched', 'round-001,instagram,ghost,yes,,,,,,', '无法匹配'],
      ['duplicate', 'round-001,instagram,a,yes,,,,,,\r\nround-001,instagram,@A,no,,,,,,', '重复账号'],
    ] as const
    for (const [label, rows, expected] of cases) {
      const csv = `${header}\r\n${rows}\r\n`
      writeFileSync(csvFile, csv)
      const error = caught(() => prepareReviewProjection(dir, state, creators))
      ok(`${label} gives line 2`, error.includes(`${csvFile}:2`))
      ok(`${label} gives concrete reason`, error.includes(expected))
      eq(`${label} did not write review document`, readFileSync(docFile, 'utf8'), before)
      eq(`${label} did not overwrite human CSV`, readFileSync(csvFile, 'utf8'), csv)
    }
    writeFileSync(docFile, '{"version":1,"updated_at":"","reviews":{\n' +
      '"instagram:a":{"account_keys":["instagram:a"]},\n' +
      '"instagram:a":{"account_keys":["instagram:a"]}},"rounds":[]}')
    const duplicateReview = caught(() => prepareReviewProjection(dir, state, creators))
    ok('duplicate Agent review key identifies file and line',
      duplicateReview.includes(`${docFile}:3`) && duplicateReview.includes('重复 JSON 键'))
    rmSync(csvFile)
    writeFileSync(docFile, JSON.stringify({ ...initial.document, reviews: {
      'instagram:ghost': reviewed('instagram:ghost'),
    } }))
    const unmatchedReview = caught(() => prepareReviewProjection(dir, state, creators))
    ok('unmatched Agent review points to exact review key',
      unmatchedReview.includes('reviews["instagram:ghost"]') && unmatchedReview.includes('无法匹配'))
  })

  suite('F11', '已评候选缺实际内容、证据、植入或风险时报错；旧未评可读')
  withTemp(dir => {
    const state = task()
    const review = reviewed('instagram:a')
    delete (review as Partial<typeof review>).natural_integration
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify({
      version: 1, updated_at: '', reviews: { 'instagram:a': review }, rounds: [],
    }))
    const error = caught(() => prepareReviewProjection(dir, state, [creator('instagram', 'a')]))
    ok('priority without scene is refused', error.includes('不能给优先联系'))
    ok('missing evidence named', error.includes('natural_integration'))
    const weak = { ...reviewed('instagram:a'), adoption_priority: '备选' }
    delete (weak as Partial<typeof weak>).observed_content
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify({
      version: 1, updated_at: '', reviews: { 'instagram:a': weak }, rounds: [],
    }))
    const evidenceError = caught(() => prepareReviewProjection(dir, state, [creator('instagram', 'a')]))
    ok('all reviewed recommendations require observed content', evidenceError.includes('observed_content'))
    writeFileSync(join(dir, 'agent-review.json'), JSON.stringify({
      version: 1, updated_at: '', reviews: { 'instagram:a': {
        account_keys: ['instagram:a'], eligibility: '合格',
      } }, rounds: [],
    }))
    const partialError = caught(() => prepareReviewProjection(dir, state, [creator('instagram', 'a', {
      email: 'x@example.test',
    })]))
    ok('partial new review cannot be silently projected as historical fit',
      partialError.includes('reviews["instagram:a"]') && partialError.includes('adoption_priority') &&
      partialError.includes('observed_content'))
    for (const [field, override] of [
      ['fit', { fit: '✅' }],
      ['priority', { adoption_priority: '优先联系' }],
    ] as const) {
      writeFileSync(join(dir, 'agent-review.json'), JSON.stringify({
        version: 1, updated_at: '', reviews: { 'instagram:a': {
          ...reviewed('instagram:a'), eligibility: '不合格', adoption_priority: '暂不采用', ...override,
        } }, rounds: [],
      }))
      const mismatch = caught(() => prepareReviewProjection(dir, state, [creator('instagram', 'a')]))
      ok(`ineligible creator with contradictory ${field} refused at review path`,
        mismatch.includes('reviews["instagram:a"]') && mismatch.includes('冲突') ||
        mismatch.includes('reviews["instagram:a"]') && mismatch.includes('自相矛盾'))
    }
    eq('unreviewed score cannot enter A', tierOf(creator('instagram', 'a', { email: 'x@example.test' }), 100), 'B')
  })

  suite('D22', '模板只由独立命令创建，新增轮次显式追加且保留既有填写字节')
  withTemp(dir => {
    const state = task()
    const one = prepareReviewProjection(dir, state, [creator('instagram', 'a')])
    persistReviewProjection(dir, one)
    const file = writeManualFeedbackTemplate(dir, one.document)
    const filled = readFileSync(file, 'utf8').replace('round-001,instagram,a,,,,,,,',
      'round-001,instagram,a,yes,yes,,,,,')
    writeFileSync(file, filled)
    ok('plain template create never overwrites existing file', caught(() => writeManualFeedbackTemplate(dir, one.document)).includes('不会覆盖'))
    eq('filled bytes remain after refused create', readFileSync(file, 'utf8'), filled)
    const two = prepareReviewProjection(dir, state, [creator('instagram', 'a'), creator('instagram', 'b')])
    const appended = appendManualFeedbackTemplate(dir, two.document, two.feedback)
    eq('only new candidate appended', appended.appended, 1)
    ok('existing answer bytes remain prefix', readFileSync(file, 'utf8').startsWith(filled))
  })

  suite('P4', '关联平台已联系或屏蔽时整人不交付，同任务历史推荐仍可重复生成')
  withTemp(dir => {
    const file = join(dir, 'memory.json')
    useMemoryFile(file)
    const entry = (contacted: boolean, blocked: boolean, taskId: string | undefined) => ({
      platform: 'instagram', handle: 'sameperson', nickname: 'sameperson', followers: 10000,
      first_seen: '2026-09-25', recommendations: taskId ? [{
        date: '2026-09-25', product: 'Example', keyword: 'journal', task: taskId,
      }] : [], contacted, replied: false, blocked, note: '',
    })
    const person = creator('tiktok', 'sameperson', {
      linked_handle: 'instagram:sameperson', effective_priority: '优先联系',
    })
    try {
      const save = (contacted: boolean, blocked: boolean, taskId?: string) =>
        writeFileSync(file, JSON.stringify({ version: 1, updated_at: '',
          creators: { 'instagram:sameperson': entry(contacted, blocked, taskId) } }))
      save(true, false)
      eq('linked contacted blocks manually adopted creator', filterByMemory([person], 'Example', 'task-A').kept.length, 0)
      save(false, true)
      eq('linked blocked account blocks whole creator', filterByMemory([person], 'Example', 'task-A').kept.length, 0)
      save(false, false, 'task-A')
      eq('same-task recommendation remains exempt', filterByMemory([person], 'Example', 'task-A').kept.length, 1)
      save(false, false, 'task-B')
      eq('other task recommendation still filters person', filterByMemory([person], 'Example', 'task-A').kept.length, 0)
    } finally { useMemoryFile('memory/creators.json') }
  })
}
