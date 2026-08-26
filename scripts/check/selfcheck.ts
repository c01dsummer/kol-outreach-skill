#!/usr/bin/env tsx
/**
 * 脚本自检 —— 回答 process/4-VERIFY.md 的「未执行的路径」。
 *
 * 每个可执行文件，要么被这里从头执行到尾，要么在豁免表里写明理由。
 * 用假 fetch 喂完所有分支：**跑通即证明结构成立**，不证明结果正确。
 */
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const EXEMPT: Record<string, string> = {}   // 目前无豁免

/** 脚本用绝对路径 —— 下面几处会切到临时目录里跑，让产出落在那边 */
const S = (f: string) => resolve('scripts', f)

const tmp = mkdtempSync(join(tmpdir(), 'kol-selfcheck-'))
const env = {
  ...process.env,
  TIKHUB_API_KEY: 'fake-key-for-selfcheck',
  NODE_OPTIONS: `--import ${JSON.stringify(new URL('./fake-fetch.ts', import.meta.url).href)}`,
}

let failed = 0
const run = (label: string, args: string[], cwd = process.cwd()) => {
  try {
    const out = execFileSync('npx', ['tsx', ...args], { env, cwd, stdio: 'pipe', encoding: 'utf8' })
    console.log(`  ✓ ${label}`)
    return out
  } catch (e: any) {
    // collect 预算用尽时退出码 3 是**预期行为**，不算失败
    if (e.status === 3 && label.includes('预算用尽')) {
      console.log(`  ✓ ${label}（按预期以退出码 3 结束）`)
      return e.stdout ?? ''
    }
    failed++
    console.error(`  ✗ ${label}\n${(e.stderr ?? e.stdout ?? e.message).toString().split('\n').slice(-12).join('\n')}`)
    return ''
  }
}

console.log('\n[脚本自检] 假 fetch，无真实请求\n')

// ---- probe：双平台 + hashtag + 关键词搜索 ----
const probeCfg = join(tmp, 'probe.json')
writeFileSync(probeCfg, JSON.stringify({
  market: 'US', budget_usd: 0.5,
  tasks: [
    { keyword: 'power bank review', dimension: 'category', platform: 'tiktok' },
    { keyword: 'smoothie', dimension: 'scene', platform: 'instagram' },
    { keyword: 'traveltech', dimension: 'audience', platform: 'instagram' },
  ],
}))
const probeOut = run('probe 三种发现路径', [S('probe.ts'), '--config', probeCfg])
if (probeOut && !probeOut.includes('bio_available')) {
  failed++; console.error('  ✗ probe 输出缺少 bio_available（P1 要求给出分母）')
}

// ---- collect：完整采集 + profile 补全 + 同人合并 + 记忆 ----
const taskCfg = join(tmp, 'task.json')
writeFileSync(taskCfg, JSON.stringify({
  product: 'selfcheck', market: 'US', target_count: 100, budget_usd: 1,
  tasks: [
    { keyword: 'power bank review', dimension: 'category', platform: 'tiktok' },
    { keyword: 'smoothie', dimension: 'scene', platform: 'instagram' },
  ],
}))
const collectOut = run('collect 完整流程', [S('collect.ts'), '--config', taskCfg], tmp)
let dir = ''
try { dir = JSON.parse(collectOut).dir } catch {}
if (!dir) { failed++; console.error('  ✗ collect 未输出可解析的 dir') }

// ---- collect：预算用尽 → 断点 → 续跑 ----
const tightCfg = join(tmp, 'tight.json')
writeFileSync(tightCfg, JSON.stringify({
  product: 'tight', market: 'US', target_count: 500, budget_usd: 0.002,
  tasks: Array.from({ length: 6 }, (_, i) => ({
    keyword: `kw${i}`, dimension: 'category', platform: 'tiktok',
  })),
}))
const tightOut = run('collect 预算用尽保存断点', [S('collect.ts'), '--config', tightCfg], tmp)
let tightDir = ''
try { tightDir = JSON.parse(tightOut).dir } catch {}
if (tightDir) {
  const before = JSON.parse(readFileSync(join(tmp, tightDir, 'task.json'), 'utf8'))
  run('collect --resume 追加预算续跑', [S('collect.ts'), '--resume', tightDir, '--budget', '1'], tmp)
  const after = JSON.parse(readFileSync(join(tmp, tightDir, 'task.json'), 'utf8'))
  if (after.requests <= before.requests) {
    failed++; console.error('  ✗ 续跑后请求数未增长，断点恢复可能没生效')
  } else if (after.done.length <= before.done.length) {
    failed++; console.error('  ✗ 续跑后已完成关键词数未增长')
  } else {
    console.log(`  ✓ 断点恢复：关键词 ${before.done.length}→${after.done.length}，请求 ${before.requests}→${after.requests}`)
  }
}

// ---- enrich：主页近期样本、公开指标、断点文件 ----
if (dir) {
  const creatorsPath = join(tmp, dir, 'creators.json')
  const creators = JSON.parse(readFileSync(creatorsPath, 'utf8'))
  // enrich 明确只处理完成语义判断的幸存者；自检补上这一步的输入契约。
  for (const c of creators) c.fit = '✅'
  writeFileSync(creatorsPath, JSON.stringify(creators, null, 2), 'utf8')

  const out = run('enrich 公开指标完整流程', [S('enrich.ts'), '--dir', dir], tmp)
  const enrichment = join(tmp, dir, 'enrichment.json')
  if (!existsSync(enrichment)) { failed++; console.error('  ✗ 未生成 enrichment.json') }
  else {
    const data = JSON.parse(readFileSync(enrichment, 'utf8'))
    const accounts = Object.values(data.accounts ?? {}) as any[]
    if (!accounts.some(a => a.metrics?.median_views?.status === 'measured')) {
      failed++; console.error('  ✗ enrichment.json 没有已测量的中位播放量')
    } else if (!out.includes('samples_measured')) {
      failed++; console.error('  ✗ enrich 输出缺少样本状态统计')
    } else console.log('  ✓ enrichment.json 含公开指标与测量状态')
  }
}

// ---- render：算分、分层、CSV、HTML、记忆写回 ----
if (dir) {
  const out = run('render 完整产出', [S('render.ts'), '--dir', dir], tmp)
  const csv = join(tmp, dir, 'kol.csv')
  const html = join(tmp, dir, 'report.html')
  if (!existsSync(csv)) { failed++; console.error('  ✗ 未生成 CSV') }
  else {
    const buf = readFileSync(csv)
    if (buf[0] !== 0xef || buf[1] !== 0xbb || buf[2] !== 0xbf) {
      failed++; console.error('  ✗ CSV 缺少 UTF-8 BOM（违反 D5）')
    } else console.log('  ✓ CSV 带 BOM')
    if (!buf.toString('utf8').includes('未查询')) {
      failed++; console.error('  ✗ CSV 未出现「未查询」—— P1 的三档区分没到达产出物')
    } else console.log('  ✓ CSV 区分「未查询」与空值')
  }
  const xlsx = join(tmp, dir, 'kol.xlsx')
  if (!existsSync(xlsx)) { failed++; console.error('  ✗ 未生成 xlsx') }
  else {
    const b = readFileSync(xlsx)
    if (b.subarray(0, 2).toString() !== 'PK') { failed++; console.error('  ✗ xlsx 不是 ZIP 容器') }
    else if (!b.toString('latin1').includes('xl/worksheets/sheet3.xml')) {
      failed++; console.error('  ✗ xlsx 缺 sheet（应为 A/B/C 三个）')
    } else console.log('  ✓ xlsx 三个 sheet 齐全')
  }
  if (!existsSync(html)) { failed++; console.error('  ✗ 未生成 HTML') }
  else {
    const h = readFileSync(html, 'utf8')
    if (!h.includes('未做有效性验证')) {
      failed++; console.error('  ✗ HTML 缺少数据边界声明（违反 P5）')
    } else console.log('  ✓ HTML 含数据边界声明')
    if (!h.includes('不是假粉率') || !h.includes('公开指标')) {
      failed++; console.error('  ✗ HTML 缺少公开指标或其边界声明（违反 U7/P5）')
    } else console.log('  ✓ HTML 展示公开指标且声明不是假粉率')
    if (!h.includes('data-f="A"') || !h.includes('data-tier=')) {
      failed++; console.error('  ✗ HTML 缺分层 tab 或卡片 data-tier（违反 U6）')
    } else if (h.includes('scrollIntoView')) {
      failed++; console.error('  ✗ HTML 切 tab 会滚动页面（违反 U6）')
    } else console.log('  ✓ HTML 分层 tab 可用且不滚动')
  }
}

// ---- 回归：collect → render → --resume 之后，已采集的人必须还在 ----
// 早先 creators.json 一个文件身兼两职：既是 --resume 的输入，又是过滤后的交付物。
// render 把这批人写进记忆后再续跑，记忆过滤判定「本产品已推荐过」，交付物被清成
// 空数组 —— 已经付费采集的数据不可恢复地消失。触发路径不冷门：用户看完报告说
// 「人不够，再多找点」，Agent 就会去跑 --resume。
if (dir) {
  const deliverable = join(tmp, dir, 'creators.json')
  const rawPath = join(tmp, dir, 'creators.raw.json')
  const before = JSON.parse(readFileSync(deliverable, 'utf8')).length
  run('collect --resume（在 render 之后）', [S('collect.ts'), '--resume', dir, '--budget', '1'], tmp)

  if (!existsSync(rawPath)) {
    failed++; console.error('  ✗ 缺少采集累加器 creators.raw.json')
  } else {
    const after = JSON.parse(readFileSync(deliverable, 'utf8')).length
    const rawN = JSON.parse(readFileSync(rawPath, 'utf8')).length
    if (rawN < before) { failed++; console.error(`  ✗ 累加器缩水 ${before}→${rawN}`) }
    else if (!after) { failed++; console.error(`  ✗ render 之后续跑把交付物清空了（${before}→0）`) }
    else console.log(`  ✓ render 后续跑数据未丢：交付物 ${before}→${after}，累加器 ${rawN}`)
  }
}

rmSync(tmp, { recursive: true, force: true })

for (const [f, why] of Object.entries(EXEMPT)) console.log(`  ⊘ ${f} 豁免：${why}`)

if (failed) { console.error(`\n✗ 脚本自检：${failed} 项失败`); process.exit(1) }
console.log('\n✓ 脚本自检：所有可执行文件均被从头执行到尾')
