import type {
  AccountAssessmentSummary, AudienceRiskFlag, Creator, Measurement,
} from './types.js'

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
  const sample = a.sample?.status === 'measured'
    ? `${a.sample.value} 条 · ${a.sample.source.provider} · ${a.sample.observed_at.slice(0, 10)}`
    : metricText(a.sample, value => `${value} 条`)
  const activityLabel = metricText(activity, value => ({
    active: '活跃', cooling: '降温', dormant: '停更',
  })[value])

  return `<div class="assessment">
    <div class="at">${esc(label)} · @${esc(a.handle)} · ${esc(fmt(a.followers))} 粉丝 ·
      关注 ${esc(fmt(a.following))} · 样本 ${esc(sample)}</div>
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
    <div class="commercial">合作报价 ${esc(quoteText)} · 隐含 eCPM ${esc(ecpm)} · 隐含 eCPE ${esc(ecpe)}</div>
  </div>`
}

/** 单文件、内联样式、不依赖网络 —— 运营要发给同事、要存档 */
export function renderHtml(creators: Creator[], meta: any): string {
  // 没有「全部」tab，所以必须有一个分层默认选中。取第一个非空的 ——
  // 默认落在空分层上，打开报告第一眼是空白，会被当成出错了。
  const def: 'A' | 'B' | 'C' =
    (['A', 'B', 'C'] as const).find(t => (meta.tiers?.[t] ?? 0) > 0) ?? 'A'

  const card = (c: Creator) => `
<div class="card ${c.tier}" data-tier="${c.tier}"${c.tier === def ? '' : ' style="display:none"'}>
  <div class="hd">
    <span class="tier ${c.tier}">${c.tier}</span>
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
  ${c.tier_adjustments?.length ? `<div class="adjust">${c.tier_adjustments.map(a =>
    esc(`${a.from}→${a.to} ${a.reason}`)).join('<br>')}</div>` : ''}
  ${c.bio ? `<div class="bio">${esc(c.bio)}</div>` : ''}
  ${renderAssessment(c.account_assessment, c.platform === 'tiktok' ? 'TikTok' : 'Instagram')}
  ${c.linked_handle ? renderAssessment(c.linked_account_assessment,
    c.linked_handle.startsWith('tiktok:') ? 'TikTok（关联）' : 'Instagram（关联）') : ''}
  ${c.previously_recommended ? `<div class="prev">曾推荐：${esc(c.previously_recommended)}</div>` : ''}
  ${c.outreach_draft ? `<details class="dr"><summary>开发信草稿</summary>
    <pre>${esc(c.outreach_draft)}</pre>
    <button onclick="cp(this)">复制</button></details>` : ''}
</div>`

  // U3：关键词表现是下次调整策略的依据
  const kwRows = (meta.keywords ?? []).map((k: any) => `
    <tr><td>${esc(k.keyword)}</td><td>${esc(k.dimension)}</td>
        <td>${k.found}</td><td>${k.fit_pass}</td>
        <td>${k.found ? Math.round(k.fit_pass / k.found * 100) : 0}%</td></tr>`).join('')

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
    // 说「不知道」，不说「没问题」：产出这批人的那一版采集，遇到读不出来的记忆
    // 会静默当成空记忆，所以这份名单到底去没去重，事后查不出来（ADR-18）。
    notes.push('本次名单的「已联系 / 已推荐」去重状态无从确认（这批人由早期版本采集，' +
               '当时记忆文件读不出来会被静默当成空记忆）—— ' +
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
.adjust{margin-top:7px;font-size:12px;color:#fbbf24;background:#3f2b0a;padding:7px 9px;border-radius:6px}
.bio{margin-top:6px;font-size:12px;color:#64748b;white-space:pre-wrap;word-break:break-word}
.assessment{margin-top:9px;background:#0f172a;border:1px solid #1e293b;border-radius:7px;padding:9px}
.at{font-size:11px;color:#64748b;margin-bottom:5px}.metrics{display:flex;gap:8px 12px;flex-wrap:wrap;font-size:11px;color:#94a3b8}
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
<div class="sub">目标市场 ${esc(meta.market)} · ${(meta.platforms ?? []).join(' + ')} · 花费约 $${meta.cost_estimate_usd}（预算 $${meta.budget_usd}）</div>

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
<table><thead><tr><th>关键词</th><th>维度</th><th>找到</th><th>语义通过</th><th>命中率</th></tr></thead>
<tbody>${kwRows}</tbody></table>

<h2>名单</h2>
<div class="tabs">
  <button class="tab A${def === 'A' ? ' on' : ''}" data-f="A">A级 直接发信<span class="n">${meta.tiers.A}</span></button>
  <button class="tab B${def === 'B' ? ' on' : ''}" data-f="B">B级 先互动<span class="n">${meta.tiers.B}</span></button>
  <button class="tab C${def === 'C' ? ' on' : ''}" data-f="C">C级 观察池<span class="n">${meta.tiers.C}</span></button>
</div>
<div class="cards" id="cards">${creators.map(card).join('')}</div>
<div class="empty" id="none" style="display:${meta.tiers[def] ? 'none' : ''}">这一层没有人</div>
</div>
<script>
function cp(b){const t=b.previousElementSibling.textContent;
navigator.clipboard.writeText(t).then(()=>{b.textContent='已复制';setTimeout(()=>b.textContent='复制',1500)})}

const cards=[...document.querySelectorAll('#cards .card')];
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  tab.classList.add('on');
  const f=tab.dataset.f;
  let shown=0;
  for(const c of cards){
    const hit = c.dataset.tier===f;
    c.style.display = hit ? '' : 'none';
    if(hit) shown++;
  }
  document.getElementById('none').style.display = shown ? 'none' : '';
}));
</script></body></html>`
}
