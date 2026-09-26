import type {
  AccountAssessmentSummary, AudienceRiskFlag, Creator, Measurement,
} from './types.js'
import { taskOrdinal } from './task-label.js'
import { formatDiscoverySources } from './discovery.js'
import { sampleScopeText } from './rows.js'
import type { CostView } from './budget.js'

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!))

/** P1：未知显示成「未知」，绝不显示成 0 —— 那是把没测量说成测量结果是零 */
const fmt = (n?: number) =>
  n === undefined ? '未知'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K'
  : String(n)

const REASON: Record<string, string> = {
  private_account: '私密账号',
  insufficient_posts: '有效近期作品不足 6 条',
  missing_post_dates: '近期作品缺少发布时间',
  invalid_post_date: '近期作品发布时间异常',
  missing_followers: '粉丝数缺失',
  missing_following: '关注数缺失',
  zero_denominator: '分母为零',
  insufficient_peer_group: '可比较同行不足 8 个',
  insufficient_comparable_metrics: '可比较指标不足',
  unsupported_content: '报价或内容形式不可比',
  account_unavailable: '账号不可访问',
  unknown_sample_scope: '旧样本媒体范围未知',
  legacy_video_only_sample: '旧版仅视频窗口，无法判断最近发布或全作品发帖间隔',
}

const metricText = <T>(m: Measurement<T> | undefined, format: (value: T) => string): string => {
  if (!m) return '未查询'
  if (m.status === 'unavailable') return `不可用 · ${REASON[m.reason] ?? m.reason}`
  return format(m.value)
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const riskFlagText = (flag: AudienceRiskFlag): string => {
  const name = {
    engagement_rate_followers: '粉丝互动率',
    view_rate: '播粉比',
    following_ratio: '关注/粉丝比',
  }[flag.metric]
  return `${name}${flag.direction === 'low' ? '偏低' : '偏高'}`
}

const renderAssessment = (a: AccountAssessmentSummary | undefined, label: string): string => {
  if (!a) return `<div class="assessment"><div class="at">${esc(label)} · 公开指标未查询</div></div>`
  const m = a.metrics
  const risk = m?.audience_quality_risk
  const activity = m?.activity_status
  const riskLevel = metricText(risk, value => value.level.toUpperCase())
  const flags = risk?.status === 'measured' && risk.value.flags.length
    ? `<div class="flags">依据：${risk.value.flags.map(riskFlagText).map(esc).join(' · ')}</div>`
    : ''
  const quote = a.collaboration_quote
  const quoteText = !quote ? '未查询'
    : quote.status === 'unavailable' ? `不可用 · ${REASON[quote.reason] ?? quote.reason}`
    : `${quote.value.currency} ${quote.value.amount} / ${quote.value.quantity} ${quote.value.format}` +
      ` · ${quote.value.source} · ${quote.value.observed_at.slice(0, 10)}`
  const ecpm = metricText(a.quote_efficiency?.implied_ecpm, value => {
    const currency = quote?.status === 'measured' ? quote.value.currency : ''
    return `${currency} ${value.toFixed(2)}`.trim()
  })
  const ecpe = metricText(a.quote_efficiency?.implied_ecpe, value => {
    const currency = quote?.status === 'measured' ? quote.value.currency : ''
    return `${currency} ${value.toFixed(2)}`.trim()
  })
  const reelQuote = quote?.status === 'measured' && quote.value.format === 'instagram_reel'
  const ecpeEvidence = reelQuote && a.quote_efficiency?.implied_ecpe?.status === 'measured'
    ? `（确认视频互动样本 ${a.quote_efficiency.implied_ecpe.sample_size} 条；${a.quote_efficiency.implied_ecpe.basis}）`
    : reelQuote && a.quote_efficiency?.implied_ecpe?.status === 'unavailable' &&
      a.quote_efficiency.implied_ecpe.sample_size !== undefined
      ? `（视频互动有效样本 ${a.quote_efficiency.implied_ecpe.sample_size} 条）` : ''
  const sample = a.sample?.status === 'measured'
    ? `${a.sample.value} 条 · ${a.sample.source.provider} · ${a.sample.observed_at.slice(0, 10)}`
    : metricText(a.sample, value => `${value} 条`)
  const activityLabel = metricText(activity, value => ({
    active: '活跃', cooling: '降温', dormant: '停更',
  })[value])

  return `<div class="assessment">
    <div class="at">${esc(label)} · @${esc(a.handle)} · ${esc(fmt(a.followers))} 粉丝 ·
      关注 ${esc(fmt(a.following))} · 样本 ${esc(sample)}</div>
    ${a.sample?.status === 'measured' ? `<div class="scope">样本范围：${esc(sampleScopeText(a))}</div>` : ''}
    <div class="metrics">
      <span>粉丝互动率 <b>${esc(metricText(m?.engagement_rate_followers, pct))}</b></span>
      <span>播放互动率 <b>${esc(metricText(m?.engagement_rate_views, pct))}</b></span>
      <span>中位播放 <b>${esc(metricText(m?.median_views, v => fmt(v)))}</b></span>
      <span>播粉比 <b>${esc(metricText(m?.view_rate, pct))}</b></span>
      <span>稳定度 <b>${esc(metricText(m?.reach_consistency, pct))}</b></span>
      <span>发帖间隔 <b>${esc(metricText(m?.median_post_gap_days, v => `${v.toFixed(1)} 天`))}</b></span>
      <span>最后发布 <b>${esc(metricText(m?.latest_post_at, v => v.slice(0, 10)))}</b></span>
      <span>距采样 <b>${esc(metricText(m?.days_since_last_post, v => `${v.toFixed(1)} 天`))}</b></span>
      <span>活跃状态 <b class="activity ${activity?.status === 'measured' ? activity.value : 'unknown'}">${esc(activityLabel)}</b></span>
      <span>受众风险 <b class="risk ${risk?.status === 'measured' ? risk.value.level : 'unknown'}">${esc(riskLevel)}</b></span>
    </div>${flags}
    <div class="commercial">合作报价 ${esc(quoteText)} · 隐含 eCPM ${esc(ecpm)} · 隐含 eCPE ${esc(ecpe + ecpeEvidence)}</div>
  </div>`
}

/**
 * meta.json 的 enriched：这次交付跑没跑过邮箱/地域增强。P5.h 只要求「未配置增强层时
 * 为 false」那一头 —— true 那一头有已知缺陷，见 ADR-67 的就地更正（#51）。
 *
 * 兼容旧消费者的布尔：公开帖子指标不能把「邮箱/受众增强」伪装成已完成 ——
 * `email_verified` 为 false 也算「跑过」（查了、没有邮箱），所以只看字段在不在。
 * 这个**判定**放在这里而不是 render 里，是因为它能被测（CONVENTIONS 第 10 条）。
 *
 * 负片分工：M-P5-j 守 P5.h（未增强却报 true）；M-P5-h（恒 false）守的是 test.ts
 * 里 true 那一头的**两条**单测断言，那两条不认领任何判据。selfcheck 里还有一条
 * true 断言，守的是 render.ts 的接线 —— 变异只跑 test.ts，够不着它，两层各管各的。
 */
export const enrichedFlag = (creators: Creator[]): boolean =>
  creators.some(c => c.email_verified !== undefined || c.audience_geo !== undefined)

/** D13.r / P5：金额文本原样展示；未知金额不能变成 $0 或 $null。 */
const renderCost = (view: CostView): string => {
  const money = (value: string | null): string => value == null ? '无从确认' : `$${esc(value)}`
  const status = {
    known: '已核费用账',
    'unknown-history': '历史费用未知',
    'unavailable-evidence': '费用依据不可用',
    'invalid-ledger': '费用账无效',
  }[view.cost_status]
  const scope = view.cost_scope === 'task' ? '任务总额度'
    : view.cost_scope === 'process' ? '本次进程额度' : '额度范围无从确认'
  const problems = view.cost_problems.map(p =>
    `<div>${esc(p.path)}：${esc(p.reason)}</div>`).join('')
  return `<div class="sub">预算占用估算 ${money(view.cost_estimate_usd)} · 总上限 ${money(view.budget_usd)} · ${esc(status)} · ${scope}</div>
<div class="sub">HTTP 200 估算 ${money(view.cost_http_200_usd)} · 结果不明保守留存 ${money(view.cost_unknown_result_usd)} · 未结预留 ${money(view.cost_pending_usd)}</div>
<div class="sub">${esc(view.cost_basis)}${problems}</div>`
}

/** 单文件、内联样式、不依赖网络 —— 运营要发给同事、要存档 */
export function renderHtml(creators: Creator[], meta: any): string {
  const reviewed = (value: string | undefined): string => value ?? '未评'
  const manual = (value: string | undefined): string => value ?? '未评'
  const feedback = meta.feedback_summary

  const card = (c: Creator) => `
<div class="card ${c.tier}" data-tier="${esc(c.tier ?? '')}" data-priority="${esc(c.effective_priority ?? '待核实')}">
  <div class="hd">
    <span class="tier ${c.tier}">${c.tier}</span>
    <span class="priority">${esc(c.effective_priority ?? '待核实')}</span>
    <span class="pf ${c.platform}">${c.platform === 'tiktok' ? '♪ TikTok' : '◉ Instagram'}</span>
    ${c.cross_platform ? `<span class="xp" title="也在 ${esc(c.linked_handle)}">⇄ 双平台</span>` : ''}
    ${c.is_private ? '<span class="priv">🔒 私密号</span>' : ''}
    <span class="sc">${c.score}</span>
  </div>
  <div class="handle"><a href="${esc(c.profile_url)}" target="_blank" rel="noopener">@${esc(c.handle)}</a></div>
  <div class="nm">${esc(c.nickname)}</div>
  <div class="st">
    <span>${fmt(c.followers)} 粉丝</span><span>${fmt(c.post_count)} 作品</span>
    ${c.email ? `<span class="em">${esc(c.email)}</span>` : '<span class="no">无邮箱</span>'}
  </div>
  ${c.fit_reason ? `<div class="fit">${esc(c.fit)} ${esc(c.fit_reason)}</div>` : ''}
  <div class="review">
    ${c.effective_priority_account_key ? `<div>排序依据：${esc(c.effective_priority_account_key)} 的人工结论${c.effective_priority_account_key !== `${c.platform}:${c.handle.toLowerCase()}` ? '（关联账号；当前主账号仍按自身字段显示）' : ''}</div>` : ''}
    <div><b>Agent</b> · ${esc(c.review_status ?? '未评')} · 合格性 ${esc(reviewed(c.eligibility))} · 建议 ${esc(reviewed(c.adoption_priority))}
      ${c.brand_calibration_version ? `· 校准 ${esc(c.brand_calibration_version)}` : ''}</div>
    <div>观察内容：${esc(c.observed_content ?? '未评')}</div>
    <div>作品证据：${esc(c.work_evidence ?? '未评')}</div>
    <div>自然植入：${esc(c.natural_integration ?? '未评')}</div>
    <div>最大风险／待核：${esc(c.mismatch_risk ?? '未评')}</div>
    <div><b>人工</b> · ${esc(c.manual_round_id ?? '未分轮')} · 合格 ${esc(manual(c.manual_eligible))} · 采用 ${esc(manual(c.manual_adopted))}
      · 内容 ${esc(manual(c.manual_content_fit))} · 互动 ${esc(manual(c.manual_engagement))}
      · 评论真实性 ${esc(manual(c.manual_comment_authenticity))}</div>
    ${c.manual_reject_reason ? `<div>拒绝原因：${esc(c.manual_reject_reason)}</div>` : ''}
    ${c.manual_note ? `<div>人工备注：${esc(c.manual_note)}</div>` : ''}
    ${c.manual_feedback_accounts?.filter(a => a.account_key !== `${c.platform}:${c.handle.toLowerCase()}`).map(a =>
      `<div>关联账号人工复核（${esc(a.account_key)}）：合格 ${esc(manual(a.manual_eligible))} · 采用 ${esc(manual(a.manual_adopted))}</div>`).join('') ?? ''}
    ${c.linked_agent_review ? `<div>关联账号 Agent 评审（${esc(c.linked_agent_review.account_key)}）：${esc(c.linked_agent_review.review_status)} · 合格性 ${esc(reviewed(c.linked_agent_review.eligibility))} · 建议 ${esc(reviewed(c.linked_agent_review.adoption_priority))}</div>` : ''}
  </div>
  ${c.tier_adjustments?.length ? `<div class="adjust">${c.tier_adjustments.map(a =>
    esc(`${a.from}→${a.to} ${a.reason}`)).join('<br>')}</div>` : ''}
  ${c.bio ? `<div class="bio">${esc(c.bio)}</div>` : ''}
  <div class="bio">已观察发现来源：${esc(formatDiscoverySources(c.discovery_sources))}</div>
  ${renderAssessment(c.account_assessment, c.platform === 'tiktok' ? 'TikTok' : 'Instagram')}
  ${c.linked_handle ? renderAssessment(c.linked_account_assessment,
    c.linked_handle.startsWith('tiktok:') ? 'TikTok（关联）' : 'Instagram（关联）') : ''}
  ${c.previously_recommended ? `<div class="prev">曾推荐：${esc(c.previously_recommended)}</div>` : ''}
  ${c.outreach_draft ? `<details class="dr"><summary>开发信草稿</summary>
    <pre>${esc(c.outreach_draft)}</pre>
    <button onclick="cp(this)">复制</button></details>` : ''}
</div>`

  // U3.b：关键词表现是下次调整策略的依据，**一个任务一行** —— 0 命中的与一次都没查过的
  // 也要在表上。P5.i：四态各说各的话，没查过的那一行不许带出一个看起来像测量值的数。
  const foundText = (k: any): string =>
    k.status === 'unknown' ? '无从确认'
    : k.status === 'unqueried' ? '未查询'
    // 问过、但那一次的条数没记下来（抛在记录之前）—— 仍然不写 0
    : k.found === null || k.found === undefined ? '未知'
    : String(k.found)
  /** 入围／语义通过：`null` 是无从确认，印「—」；**不印 0** —— 那是把没测量说成零 */
  const countText = (n: unknown): string => n === null || n === undefined ? '—' : String(n)
  const kwRows = (meta.keywords ?? []).map((k: any) => `
    <tr><td>${esc(taskOrdinal(k.task_index))}</td><td>${esc(k.keyword)}</td>
        <td>${esc(k.platform ?? '未知')}</td><td>${esc(k.dimension)}</td>
        <td>${esc(foundText(k))}</td><td>${esc(countText(k.shortlisted))}</td>
        <td>${esc(countText(k.fit_pass))}</td><td>${esc(countText(k.manual_reviewed))}</td></tr>`).join('')
  const rate = (part: any): string => part?.rate === null || part?.rate === undefined
    ? '不可计算' : `${(part.rate * 100).toFixed(1)}%（${part.yes}/${part.yes + part.no}）`
  const roundRows = (feedback?.rounds ?? []).map((r: any) => `
    <tr><td>${esc(r.round_id)}</td><td>${esc(r.candidates)}</td>
    <td>${esc(r.reviewed)}</td><td>${esc(r.unreviewed)}</td></tr>`).join('')
  const reasonRows = (feedback?.reject_reasons ?? []).map((r: any) =>
    `<li>${esc(r.reason)}：${esc(r.count)}</li>`).join('')
  const roundSources = (meta.review_rounds ?? []).map((r: any) => `
    <details class="round"><summary>${esc(r.round_id)} · 固定候选池 ${esc(r.candidates?.length ?? 0)} 个平台账号</summary>
      <ul>${(r.candidates ?? []).map((c: any) => `<li>${esc(c.account_key)} · ${c.source_tasks === null
        ? '来源未知' : c.source_tasks?.length
          ? c.source_tasks.map((s: any) => `任务 ${esc(taskOrdinal(s.task_index))} · ${esc(s.platform)} · ${esc(s.keyword)}`).join('；')
          : '无已记录任务来源'}</li>`).join('')}</ul>
    </details>`).join('')

  const notes: string[] = []
  const missingEmailVerification = meta.capabilities
    ? meta.capabilities.email_verification.total === 0 ||
      meta.capabilities.email_verification.measured < meta.capabilities.email_verification.total
    : !meta.enriched
  const missingAudienceGeo = meta.capabilities
    ? meta.capabilities.audience_geo.total === 0 ||
      meta.capabilities.audience_geo.measured < meta.capabilities.audience_geo.total
    : !meta.enriched
  // P4/P5（ADR-15）：去重没跑，用户必须在发信之前知道。这一条排在最前面 ——
  // 其余几条是「数据可能不全」，这一条是「这份名单可能让你二次打扰同一个人」。
  if (meta.memory_status === 'unreadable_ignored') {
    notes.push('本次名单未做「已联系 / 已推荐」去重（记忆文件读不出来，运行时显式跳过）—— ' +
               '名单里可能包含你已经联系过、甚至已经拉黑的人。发信前请自行核对。')
  } else if (meta.memory_status === 'unknown') {
    // 说「不知道」，不说「没问题」。**也不说是为什么不知道** —— unknown 有两个
    // 来源（早期采集、名单与状态没能一起落成），事后分不出是哪一个，
    // 而写死一个就是给用户一个编造的诊断（ADR-22 的老规矩：不许替下一步打包票；
    // 这一次是不许替上一步编原因）。措辞与来源无关（ADR-43）。
    notes.push('本次名单的「已联系 / 已推荐」去重状态无从确认 —— ' +
               '名单里可能包含你已经联系过的人。重跑一次采集即可得到确定答案。')
  }
  if (meta.memory_written === false) {
    // 不替用户断定原因：读不出来要去修 JSON，写不进去要去看权限或磁盘。
    // 写死成前者，会让磁盘满的人对着一份没坏的文件较劲（ADR-20）。
    notes.push('本次推荐未记入跨任务记忆（原文件未被改动）—— ' +
               `原因：${meta.memory_write_error ?? '未记录'}。` +
               '在解决之前，下一批名单可能重复推荐这批人。')
  }
  if (missingEmailVerification) {
    notes.push('邮箱来自 bio 提取，未做有效性验证，建议首轮小批量试发观察退信率。')
  }
  if (missingAudienceGeo) {
    notes.push('未配置增强层，无法确认这批人的粉丝是否在目标市场。')
  }
  const publicCapability = meta.capabilities?.public_post_sample
  if (publicCapability?.measured || publicCapability?.unavailable) {
    notes.push('受众质量风险只依据近期公开互动异常，不是假粉率，也不能代表实际带货效果。')
  }
  if (publicCapability?.unqueried || publicCapability?.unavailable) {
    notes.push(`公开指标边界：${publicCapability.unqueried} 个账号未查询，${publicCapability.unavailable} 个账号不可用。`)
  }

  return `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KOL 建联名单 · ${esc(meta.product)}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0b0f19;color:#e2e8f0;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px}
.wrap{max-width:1100px;margin:0 auto}
h1{font-size:22px;margin-bottom:4px}
.sub{color:#64748b;font-size:13px;margin-bottom:20px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px}
.stat{background:#111827;border:1px solid #1e293b;border-radius:8px;padding:12px;text-align:center}
.stat .v{font-size:20px;font-weight:700;color:#38bdf8}
.stat .l{color:#64748b;font-size:11px;margin-top:2px}
h2{font-size:15px;margin:22px 0 10px;color:#94a3b8}
table{width:100%;border-collapse:collapse;font-size:13px;background:#111827;border-radius:8px;overflow:hidden}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #1e293b}
th{color:#64748b;font-weight:600;font-size:12px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.card{background:#111827;border:1px solid #1e293b;border-radius:10px;padding:14px}
.card.A{border-left:3px solid #22c55e}.card.B{border-left:3px solid #f59e0b}.card.C{border-left:3px solid #475569}
.hd{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.tier{font-size:11px;font-weight:700;padding:1px 7px;border-radius:4px}
.tier.A{background:rgba(34,197,94,.15);color:#22c55e}
.tier.B{background:rgba(245,158,11,.15);color:#f59e0b}
.tier.C{background:rgba(71,85,105,.2);color:#94a3b8}
.pf{font-size:11px;font-weight:700;border-radius:5px;padding:2px 8px;letter-spacing:.02em}
.pf.tiktok{background:#25f4ee1f;color:#25f4ee;border:1px solid #25f4ee55}
.pf.instagram{background:linear-gradient(90deg,#f5843733,#dd2a7b33,#8134af33);color:#f09433;border:1px solid #dd2a7b55}
.xp{font-size:11px;font-weight:600;color:#a78bfa;background:#a78bfa1a;border:1px solid #a78bfa55;border-radius:5px;padding:2px 7px}
.priv{font-size:11px;color:#f59e0b;background:#f59e0b1a;border:1px solid #f59e0b44;border-radius:5px;padding:2px 7px}
.handle{margin-top:7px}
.handle a{color:#38bdf8;text-decoration:none;font-weight:700;font-size:15px}
.handle a:hover{text-decoration:underline}
.tabs{display:flex;gap:6px;margin:10px 0 14px;flex-wrap:wrap;position:sticky;top:0;background:#0b0f19;padding:10px 0;z-index:10;border-bottom:1px solid #1e293b}
.tab{background:#111827;border:1px solid #1e293b;border-radius:7px;padding:7px 14px;color:#94a3b8;font-size:13px;cursor:pointer;font-family:inherit;transition:all .15s}
.tab:hover{border-color:#334155;color:#e2e8f0}
.tab.on{background:#1e293b;color:#f8fafc;border-color:#38bdf8}
.tab .n{opacity:.6;margin-left:5px;font-size:12px}
.tab.A.on{border-color:#22c55e}.tab.B.on{border-color:#f59e0b}.tab.C.on{border-color:#64748b}
.empty{color:#475569;text-align:center;padding:40px;font-size:14px}
.sc{margin-left:auto;color:#64748b;font-size:12px}
.nm{color:#94a3b8;font-size:13px;margin-top:3px}
.st{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#64748b;margin-top:6px}
.st .em{color:#22c55e}.st .no{color:#ef4444}
.fit{margin-top:8px;font-size:13px;color:#e2e8f0;background:#0f172a;padding:7px 9px;border-radius:6px}
.review{margin-top:8px;font-size:12px;color:#cbd5e1;background:#0f172a;padding:9px;border-radius:6px}
.review div{margin:3px 0}.review b{color:#38bdf8}
.priority{font-size:11px;color:#f8fafc;background:#1e293b;border-radius:5px;padding:2px 7px}
.round{margin:6px 0;background:#111827;border:1px solid #1e293b;border-radius:7px;padding:7px 10px}
.round summary{cursor:pointer}.round ul{margin:8px 0 0 18px;color:#94a3b8;max-height:280px;overflow:auto}
.feedback-grid{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0;color:#cbd5e1}
.feedback-grid span{background:#111827;border:1px solid #1e293b;border-radius:7px;padding:8px 12px}
.reason-list{margin-left:18px}
.adjust{margin-top:7px;font-size:12px;color:#fbbf24;background:#3f2b0a;padding:7px 9px;border-radius:6px}
.bio{margin-top:6px;font-size:12px;color:#64748b;white-space:pre-wrap;word-break:break-word}
.assessment{margin-top:9px;background:#0f172a;border:1px solid #1e293b;border-radius:7px;padding:9px}
.at{font-size:11px;color:#64748b;margin-bottom:5px}.scope{font-size:11px;color:#94a3b8;margin-bottom:5px}.metrics{display:flex;gap:8px 12px;flex-wrap:wrap;font-size:11px;color:#94a3b8}
.metrics b{color:#e2e8f0;font-weight:600}.risk.high{color:#ef4444}.risk.medium{color:#f59e0b}.risk.low{color:#22c55e}.risk.unknown{color:#64748b}
.activity.active{color:#22c55e}.activity.cooling{color:#f59e0b}.activity.dormant{color:#ef4444}.activity.unknown{color:#64748b}
.flags{font-size:11px;color:#f59e0b;margin-top:5px}.commercial{font-size:11px;color:#94a3b8;margin-top:5px}
.prev{margin-top:6px;font-size:11px;color:#f59e0b}
.dr{margin-top:9px}
.dr summary{cursor:pointer;font-size:12px;color:#38bdf8}
.dr pre{white-space:pre-wrap;background:#0f172a;padding:10px;border-radius:6px;margin-top:6px;font-size:12px;color:#cbd5e1;font-family:ui-monospace,SFMono-Regular,monospace}
.dr button{margin-top:6px;background:#1e293b;border:1px solid #334155;color:#94a3b8;border-radius:5px;padding:4px 10px;font-size:12px;cursor:pointer}
.dr button:hover{background:#334155;color:#e2e8f0}
.notes{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:12px;margin:20px 0;font-size:13px;color:#fbbf24}
.notes div{margin:3px 0}
</style></head><body><div class="wrap">
<h1>KOL 建联名单 · ${esc(meta.product)}</h1>
<div class="sub">目标市场 ${esc(meta.market)} · ${(meta.platforms ?? []).join(' + ')}</div>
${renderCost(meta)}

<div class="stats">
  <div class="stat"><div class="v">${meta.total}</div><div class="l">总人数</div></div>
  <div class="stat"><div class="v" style="color:#22c55e">${meta.tiers.A}</div><div class="l">A 级</div></div>
  <div class="stat"><div class="v" style="color:#f59e0b">${meta.tiers.B}</div><div class="l">B 级</div></div>
  <div class="stat"><div class="v" style="color:#94a3b8">${meta.tiers.C}</div><div class="l">C 级</div></div>
  <div class="stat"><div class="v">${meta.email_count}</div><div class="l">有邮箱</div></div>
  <div class="stat"><div class="v" style="color:#a78bfa">${meta.cross_platform_count}</div><div class="l">跨平台</div></div>
  <div class="stat"><div class="v">${meta.capabilities?.public_post_sample.measured ?? 0}</div><div class="l">公开指标已测账号</div></div>
  <div class="stat"><div class="v" style="color:#ef4444">${meta.high_risk_count ?? 0}</div><div class="l">高风险复核</div></div>
</div>

${notes.length ? `<div class="notes">${notes.map(n => `<div>⚠️ ${esc(n)}</div>`).join('')}</div>` : ''}

<h2>关键词表现</h2>
<p class="sub">「找到」是供应商返回的条目数，「入围」是过完粉丝闸门与去重之后还在名单上的人 ——
<strong>两个不是一个数，也不该相除</strong>（单位不同）。「语义通过」和「人工已审」只数该任务平台对应账号的判断，未评不当作通过；一次都没查过的词照样在表上，写着「未查询」。</p>
<table><thead><tr><th>任务</th><th>关键词</th><th>平台</th><th>维度</th><th>找到 · 条目</th><th>入围 · 人</th><th>语义通过 · 人</th><th>人工已审 · 平台账号</th></tr></thead>
<tbody>${kwRows}</tbody></table>

<h2>人工复核</h2>
<p class="sub">人工结论按平台账号记录；空白是未评，unknown 是已看但无法判断。比率只用对应字段明确 yes/no 的平台账号数计算。</p>
<table><thead><tr><th>轮次</th><th>固定候选池</th><th>任一人工字段已评</th><th>未评</th></tr></thead>
<tbody>${roundRows}</tbody></table>
<div class="feedback-grid">
  <span>人工合格率：${esc(rate(feedback?.eligible))} · unknown ${esc(feedback?.eligible?.unknown ?? '未提供')} · 未评 ${esc(feedback?.eligible?.unreviewed ?? '未提供')}</span>
  <span>人工采用率：${esc(rate(feedback?.adopted))} · unknown ${esc(feedback?.adopted?.unknown ?? '未提供')} · 未评 ${esc(feedback?.adopted?.unreviewed ?? '未提供')}</span>
</div>
<div>主要拒绝原因：${reasonRows ? `<ul class="reason-list">${reasonRows}</ul>` : '暂无明确人工拒绝原因'}</div>
<div>Agent 与团队分歧账号：${feedback?.disagreements?.length
    ? feedback.disagreements.map((k: string) => esc(k)).join('、') : '暂无可确认分歧'}</div>
${roundSources}

<h2>名单</h2>
<div class="tabs">
  <button class="tab on" data-kind="priority" data-value="all">全部优先级</button>
  ${(['优先联系', '备选', '待核实', '暂不采用'] as const).map(p =>
    `<button class="tab" data-kind="priority" data-value="${p}">${p}</button>`).join('')}
</div>
<div class="tabs">
  <button class="tab on" data-kind="tier" data-value="all">全部分层</button>
  <button class="tab A" data-kind="tier" data-value="A">A 级<span class="n">${meta.tiers.A}</span></button>
  <button class="tab B" data-kind="tier" data-value="B">B 级<span class="n">${meta.tiers.B}</span></button>
  <button class="tab C" data-kind="tier" data-value="C">C 级<span class="n">${meta.tiers.C}</span></button>
</div>
<div class="cards" id="cards">${creators.map(card).join('')}</div>
<p class="sub">仅含已记录的账号发现来源，可能不含完整历史；不对应具体作品或请求次数。</p>
<div class="empty" id="none" style="display:${creators.length ? 'none' : ''}">所选条件下没有候选</div>
</div>
<script>
function cp(b){const t=b.previousElementSibling.textContent;
navigator.clipboard.writeText(t).then(()=>{b.textContent='已复制';setTimeout(()=>b.textContent='复制',1500)})}

const cards=[...document.querySelectorAll('#cards .card')];
const filters={priority:'all',tier:'all'};
document.querySelectorAll('.tab[data-kind]').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab[data-kind="'+tab.dataset.kind+'"]').forEach(t=>t.classList.remove('on'));
  tab.classList.add('on');
  filters[tab.dataset.kind]=tab.dataset.value;
  let shown=0;
  for(const c of cards){
    const hit=(filters.priority==='all'||c.dataset.priority===filters.priority)&&
      (filters.tier==='all'||c.dataset.tier===filters.tier);
    c.style.display = hit ? '' : 'none';
    if(hit) shown++;
  }
  document.getElementById('none').style.display = shown ? 'none' : '';
}));
</script></body></html>`
}
