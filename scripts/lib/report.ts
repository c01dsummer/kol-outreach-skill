import type { Creator } from './types.js'

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!))

const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n)

/** 单文件、内联样式、不依赖网络 —— 运营要发给同事、要存档 */
export function renderHtml(creators: Creator[], meta: any): string {
  const card = (c: Creator) => `
<div class="card ${c.tier}">
  <div class="hd">
    <span class="tier ${c.tier}">${c.tier}</span>
    <a href="${esc(c.profile_url)}" target="_blank" rel="noopener">@${esc(c.handle)}</a>
    <span class="pf">${c.platform === 'tiktok' ? 'TikTok' : 'IG'}</span>
    ${c.cross_platform ? `<span class="xp" title="${esc(c.linked_handle)}">跨平台</span>` : ''}
    <span class="sc">${c.score}</span>
  </div>
  <div class="nm">${esc(c.nickname)}</div>
  <div class="st">
    <span>${fmt(c.followers)} 粉丝</span><span>${c.post_count} 作品</span>
    ${c.email ? `<span class="em">${esc(c.email)}</span>` : '<span class="no">无邮箱</span>'}
  </div>
  ${c.fit_reason ? `<div class="fit">${esc(c.fit)} ${esc(c.fit_reason)}</div>` : ''}
  ${c.bio ? `<div class="bio">${esc(c.bio)}</div>` : ''}
  ${c.previously_recommended ? `<div class="prev">曾推荐：${esc(c.previously_recommended)}</div>` : ''}
  ${c.outreach_draft ? `<details class="dr"><summary>开发信草稿</summary>
    <pre>${esc(c.outreach_draft)}</pre>
    <button onclick="cp(this)">复制</button></details>` : ''}
</div>`

  const kwRows = (meta.keywords ?? []).map((k: any) => `
    <tr><td>${esc(k.keyword)}</td><td>${esc(k.dimension)}</td>
        <td>${k.found}</td><td>${k.fit_pass}</td>
        <td>${k.found ? Math.round(k.fit_pass / k.found * 100) : 0}%</td></tr>`).join('')

  const notes: string[] = []
  if (!meta.enriched) {
    notes.push('邮箱来自 bio 提取，未做有效性验证，建议首轮小批量试发观察退信率。')
    notes.push('未配置增强层，无法确认这批人的粉丝是否在目标市场。')
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
.hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hd a{color:#38bdf8;text-decoration:none;font-weight:600}
.tier{font-size:11px;font-weight:700;padding:1px 7px;border-radius:4px}
.tier.A{background:rgba(34,197,94,.15);color:#22c55e}
.tier.B{background:rgba(245,158,11,.15);color:#f59e0b}
.tier.C{background:rgba(71,85,105,.2);color:#94a3b8}
.pf,.xp{font-size:11px;color:#64748b;border:1px solid #1e293b;border-radius:4px;padding:0 5px}
.xp{color:#a78bfa;border-color:#a78bfa}
.sc{margin-left:auto;color:#64748b;font-size:12px}
.nm{color:#cbd5e1;font-size:13px;margin-top:4px}
.st{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#64748b;margin-top:6px}
.st .em{color:#22c55e}.st .no{color:#ef4444}
.fit{margin-top:8px;font-size:13px;color:#e2e8f0;background:#0f172a;padding:7px 9px;border-radius:6px}
.bio{margin-top:6px;font-size:12px;color:#64748b;white-space:pre-wrap;word-break:break-word}
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
</div>

${notes.length ? `<div class="notes">${notes.map(n => `<div>⚠️ ${esc(n)}</div>`).join('')}</div>` : ''}

<h2>关键词表现</h2>
<table><thead><tr><th>关键词</th><th>维度</th><th>找到</th><th>语义通过</th><th>命中率</th></tr></thead>
<tbody>${kwRows}</tbody></table>

<h2>名单</h2>
<div class="cards">${creators.map(card).join('')}</div>
</div>
<script>
function cp(b){const t=b.previousElementSibling.textContent;
navigator.clipboard.writeText(t).then(()=>{b.textContent='已复制';setTimeout(()=>b.textContent='复制',1500)})}
</script></body></html>`
}
