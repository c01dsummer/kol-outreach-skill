#!/usr/bin/env tsx
/**
 * 脚本自检 —— 回答 process/4-VERIFY.md 的「未执行的路径」。
 *
 * 每个可执行文件都要有出处，分两种，**两种买到的东西不一样**：
 *
 * - **本文件用假 fetch 从头跑到尾的**（采集管线那几个）：喂完所有分支，
 *   跑通即证明结构成立，不证明结果正确
 * - **在 `npm run check` 里各自成一步的**（检查脚本自己）：每次跑检查链都会
 *   真的执行一遍。但**不保证跑到尾** —— 一个检查可以合法地提前退出
 *   （体量闸门与分支寿命在主干上都会打印「不适用」就走）
 *
 * 两种都没有的，就是没人跑过，报错。末尾那句话按这两组分开说 ——
 * 合起来说一句「全都从头执行到尾」，在单独跑 `npm run selfcheck` 时是假的。
 */
import {
  mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const EXEMPT: Record<string, string> = {}   // 目前无豁免

/** 脚本用绝对路径 —— 下面几处会切到临时目录里跑，让产出落在那边 */
const covered = new Set<string>()
const S = (f: string) => { covered.add(`scripts/${f}`); return resolve('scripts', f) }

const tmp = mkdtempSync(join(tmpdir(), 'kol-selfcheck-'))
const env = {
  ...process.env,
  TIKHUB_API_KEY: 'fake-key-for-selfcheck',
  NODE_OPTIONS: `--import ${JSON.stringify(new URL('./fake-fetch.ts', import.meta.url).href)}`,
}

let failed = 0
/**
 * 跑一个脚本，把退出码当成被检查的对外契约，交回其中一股输出。
 *
 * `expect` 说的是**预期哪个退出码**，`0` 也算 —— 成功那条路径也有对外承诺，
 * 而且它的话打在 stderr（结果走 stdout）。
 *
 * `stream` 说的是交回哪一股。中止的脚本把「你接下来怎么办」打在 stderr，
 * 所以写了 `expect` 时默认给 stderr；但有的脚本是**带着结果**非零结束的
 * （预算用尽那次，断点目录仍然打在 stdout），拿错了那一股，后面的断言就成了空转。
 * 没写 `expect` 的那些调用点拿的仍是 stdout。
 *
 * 用 `spawnSync` 不用 `execFileSync`：后者只在非零退出时抛，而抛出来的错误对象上
 * 才同时挂着两股。于是**退出码 0 的那条路径根本拿不到 stderr** —— 成功收尾时
 * 那句「续跑要不要花钱」就是这么长期没人断言的（ADR-25 的欠条）。
 * `spawnSync` 不抛，两股和退出码一起交回来，收尾各条路径于是一视同仁。
 *
 * 两股都要的用 `runBoth` —— 有的断言得同时读结果（stdout）和说给用户的话（stderr），
 * 比如「这一次到底走的是哪一种收尾」写在 stdout 的 `stopped` 里，而那句话在 stderr。
 * 分两次跑拿不到同一次的两股：进程跑两遍，两次的状态不保证一样。
 */
const runBoth = (label: string, args: string[], cwd = process.cwd(),
  expect?: { status: number }): { stdout: string; stderr: string } => {
  const r = spawnSync('npx', ['tsx', ...args], { env, cwd, encoding: 'utf8' })
  const stdout = r.stdout ?? ''   // p1-ok: 拿不到就是空输出，不是「没查过」——这是子进程的两股流
  const stderr = r.stderr ?? ''   // p1-ok: 同上
  const want = expect?.status ?? 0
  if (r.error || r.status !== want) {
    failed++
    const why = r.error ? String(r.error) : `预期以退出码 ${want} 结束，实际是 ${r.status}`
    console.error(`  ✗ ${label}：${why}\n${(stderr || stdout).split('\n').slice(-12).join('\n')}`)
    return { stdout: '', stderr: '' }
  }
  console.log(`  ✓ ${label}${expect ? `（按预期以退出码 ${want} 结束）` : ''}`)
  return { stdout, stderr }
}

const run = (label: string, args: string[], cwd = process.cwd(),
  expect?: { status: number; stream?: 'stdout' | 'stderr' }) => {
  const { stdout, stderr } = runBoth(label, args, cwd, expect)
  // 没写 expect 的调用点历来拿的是 stdout，写了的默认拿 stderr —— 保持原样，
  // 免得几十个既有断言在这次改动里悄悄换了读的那一股。
  return (expect?.stream ?? (expect ? 'stderr' : 'stdout')) === 'stdout' ? stdout : stderr
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

// ---- 三条入口：钱字段比不了大小就不许开跑（P3 · D6.a）----
// 闸门是一句「已花 + 本次开销 > 上限」的比较。两边有一个不是数，这句话恒为假 ——
// 闸门不是宽了一点，是整条不存在，而且百分比同时恒为 0，连提醒都不出现。
// 判定在 lib/budget.ts（有变异守着），但**接线在三条入口各一份**，
// 而变异只跑 scripts/test.ts、够不到入口 —— 与 P3.b 处境相同，只能由这里真跑一遍。
{
  const badProbe = join(tmp, 'probe-badbudget.json')
  writeFileSync(badProbe, JSON.stringify({
    market: 'US', budget_usd: 'abc',
    tasks: [{ keyword: 'k', dimension: 'category', platform: 'tiktok' }],
  }))
  run('probe 上限不是数字 → 停下问人', [S('probe.ts'), '--config', badProbe],
      process.cwd(), { status: 2 })

  const badCfg = join(tmp, 'collect-badbudget.json')
  writeFileSync(badCfg, JSON.stringify({
    product: 'badbudget', market: 'US', target_count: 1, budget_usd: 'abc',
    tasks: [{ keyword: 'k', dimension: 'category', platform: 'tiktok' }],
  }))
  run('collect 上限不是数字 → 停下问人', [S('collect.ts'), '--config', badCfg], tmp,
      { status: 2 })

  // 盘上那个「已经花了多少次」同样是外部输入：null 会让整本账退回零
  const stateOf = (requests: unknown) => JSON.stringify({
    product: 'badledger', market: 'US', target_count: 1, budget_usd: 1,
    tasks: [{ keyword: 'k', dimension: 'category', platform: 'tiktok' }],
    done: [], offsets: {}, requests, created_at: '', updated_at: '',
  })
  mkdirSync(join(tmp, 'badledger'), { recursive: true })
  writeFileSync(join(tmp, 'badledger', 'task.json'), stateOf(null))
  run('collect 续跑时盘上的已花次数是 null → 停下问人',
      [S('collect.ts'), '--resume', 'badledger'], tmp, { status: 2 })
  run('enrich 同一份坏断点 → 也停下问人',
      [S('enrich.ts'), '--dir', 'badledger'], tmp, { status: 2 })

  mkdirSync(join(tmp, 'okledger'), { recursive: true })
  writeFileSync(join(tmp, 'okledger', 'task.json'), stateOf(0))
  // 报的必须是**用户打的那个东西**：`3.0.0` 解析成 NaN，照解析结果印是「null」
  const badArg = run('collect 追加的预算不是数字 → 停下问人',
      [S('collect.ts'), '--resume', 'okledger', '--budget', '3.0.0'], tmp, { status: 2 })
  if (badArg && !badArg.includes('3.0.0')) {
    failed++
    console.error('  ✗ 报错里没有出现用户打的那个值，他不知道是哪一处写错了')
  } else if (badArg) console.log('  ✓ 报错指名用户打的那个值')
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
const tightOut = run('collect 预算用尽保存断点',
  [S('collect.ts'), '--config', tightCfg], tmp, { status: 3, stream: 'stdout' })
let tightDir = ''
try { tightDir = JSON.parse(tightOut).dir } catch {}
const tightTask = tightDir ? join(tmp, tightDir, 'task.json') : ''
// 断点没落盘、或落盘在读不出来的地方，下面那几条断言就无从跑起 ——
// 跳过不能算通过，否则 P3.b 可以一直是坏的而这一步照样打勾。
if (!tightDir || !existsSync(tightTask)) {
  failed++
  console.error('  ✗ collect 预算用尽后没有留下可读的断点（P3.b 要求捕获后保存断点）')
} else {
  const before = JSON.parse(readFileSync(tightTask, 'utf8'))
  run('collect --resume 追加预算续跑', [S('collect.ts'), '--resume', tightDir, '--budget', '1'], tmp)
  const after = JSON.parse(readFileSync(tightTask, 'utf8'))
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
    } else if (!accounts.some(a => a.metrics?.activity_status?.status === 'measured')) {
      failed++; console.error('  ✗ enrichment.json 没有已测量的活跃状态')
    } else if (!out.includes('samples_measured')) {
      failed++; console.error('  ✗ enrich 输出缺少样本状态统计')
    } else console.log('  ✓ enrichment.json 含公开指标与测量状态')

    // 模拟旧版本：原始样本在，但还没有活跃字段。再次 enrich 必须本地补算，不能付费重抓。
    for (const account of accounts) {
      if (!account.metrics) continue
      delete account.metrics.latest_post_at
      delete account.metrics.days_since_last_post
      delete account.metrics.activity_status
    }
    writeFileSync(enrichment, JSON.stringify(data, null, 2), 'utf8')
    const taskPath = join(tmp, dir, 'task.json')
    const beforeRequests = JSON.parse(readFileSync(taskPath, 'utf8')).requests
    const migrationOut = run('enrich 旧样本零请求补算活跃状态', [S('enrich.ts'), '--dir', dir], tmp)
    const afterRequests = JSON.parse(readFileSync(taskPath, 'utf8')).requests
    const migrated = JSON.parse(readFileSync(enrichment, 'utf8'))
    const migratedAccounts = Object.values(migrated.accounts ?? {}) as any[]
    let migrationSummary: any = {}
    try { migrationSummary = JSON.parse(migrationOut) } catch {}
    if (afterRequests !== beforeRequests || migrationSummary.newly_queried !== 0) {
      failed++; console.error('  ✗ 旧样本补算产生了新的 API 请求')
    } else if (!(migrationSummary.locally_recomputed > 0) ||
      !migratedAccounts.some(a => a.metrics?.activity_status)) {
      failed++; console.error('  ✗ 旧样本没有在本地补出活跃状态')
    } else console.log('  ✓ 旧 enrichment 样本零请求补出活跃状态')

    // 第二种旧缓存：活跃字段齐全，但中位数是上一版口径算出来的。这批账号以前
    // 会被整段跳过 —— 交付物里留着旧口径的数，而且看不出区别。见 ADR-13。
    const staleData = JSON.parse(readFileSync(enrichment, 'utf8'))
    let tampered = 0
    for (const account of Object.values(staleData.accounts ?? {}) as any[]) {
      if (account.metrics?.median_views?.status !== 'measured') continue
      account.metrics.median_views.value = 1
      tampered++
    }
    writeFileSync(enrichment, JSON.stringify(staleData, null, 2), 'utf8')
    const staleBefore = JSON.parse(readFileSync(taskPath, 'utf8')).requests
    const staleOut = run('enrich 旧口径缓存零请求纠正', [S('enrich.ts'), '--dir', dir], tmp)
    const staleAfter = JSON.parse(readFileSync(taskPath, 'utf8')).requests
    const fixed = Object.values(
      JSON.parse(readFileSync(enrichment, 'utf8')).accounts ?? {}) as any[]
    let staleSummary: any = {}
    try { staleSummary = JSON.parse(staleOut) } catch {}
    if (!tampered) {
      // 一个没篡改到任何东西的检查，下面两条断言会无条件通过 —— 那等于没检查。
      failed++; console.error('  ✗ 没有可篡改的中位播放量，这条检查什么都没验')
    } else if (staleAfter !== staleBefore || staleSummary.newly_queried !== 0) {
      failed++; console.error('  ✗ 纠正旧口径缓存产生了新的 API 请求')
    } else if (fixed.some(a => a.metrics?.median_views?.value === 1) ||
      !(staleSummary.locally_recomputed > 0)) {
      failed++; console.error('  ✗ 旧口径缓存没有被就地纠正')
    } else console.log(`  ✓ 旧口径缓存零请求就地纠正（篡改 ${tampered} 个账号）`)

    // 第三种旧缓存：样本记录本身超窗（提供方多返回、在收窄之前写下的那些）。
    // 交付物照着记录自己的说法报样本量，所以记录也必须被收 —— 见 ADR-14。
    const oversized = JSON.parse(readFileSync(enrichment, 'utf8'))
    let padded = 0
    for (const account of Object.values(oversized.accounts ?? {}) as any[]) {
      if (account.sample?.status !== 'measured' || !Array.isArray(account.sample.value)) continue
      for (let i = 0; i < 4; i++) {
        account.sample.value.push({ id: `padded-${i}`, views: 1, likes: 1, comments: 1 })
      }
      account.sample.sample_size = account.sample.value.length
      padded++
    }
    writeFileSync(enrichment, JSON.stringify(oversized, null, 2), 'utf8')
    const padBefore = JSON.parse(readFileSync(taskPath, 'utf8')).requests
    const padOut = run('enrich 超窗样本记录零请求收窄', [S('enrich.ts'), '--dir', dir], tmp)
    const padAfter = JSON.parse(readFileSync(taskPath, 'utf8')).requests
    const trimmed = Object.values(
      JSON.parse(readFileSync(enrichment, 'utf8')).accounts ?? {}) as any[]
    let padSummary: any = {}
    try { padSummary = JSON.parse(padOut) } catch {}
    const inconsistent = trimmed.filter(a => a.sample?.status === 'measured' &&
      (a.sample.value.length > 12 || a.sample.sample_size !== a.sample.value.length))
    if (!padded) {
      failed++; console.error('  ✗ 没有可撑大的样本记录，这条检查什么都没验')
    } else if (padAfter !== padBefore || padSummary.newly_queried !== 0) {
      failed++; console.error('  ✗ 收窄样本记录产生了新的 API 请求')
    } else if (inconsistent.length) {
      failed++
      console.error(`  ✗ ${inconsistent.length} 个账号的样本记录与它自己的说法仍不一致`)
    } else console.log(`  ✓ 超窗样本记录零请求收窄（撑大 ${padded} 个账号）`)
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
  const metaPath = join(tmp, dir, 'meta.json')
  if (!existsSync(metaPath)) { failed++; console.error('  ✗ 未生成 meta.json') }
  else {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    const activity = meta.capabilities?.creator_activity
    if (!activity || activity.measured + activity.unavailable + activity.unqueried !== activity.total) {
      failed++; console.error('  ✗ meta.json 缺少完整的 creator_activity 三态统计')
    } else console.log('  ✓ meta.json 含 creator_activity 三态统计')
    // P5.h：这条自检的管线不配置邮箱/地域增强层，
    // enriched 必须是 false —— 公开指标不能把邮箱/受众增强伪装成已完成。
    if (meta.enriched !== false) {
      failed++; console.error('  ✗ meta.json 的 enriched 不实 —— 未配置邮箱/地域增强却报 true（P5.h）')
    } else console.log('  ✓ meta.json 的 enriched 如实（未配置外部增强层时为 false）')
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
    if (!h.includes('活跃状态') || !h.includes('最后发布')) {
      failed++; console.error('  ✗ HTML 缺少 KOL 活跃状态（违反 D10/U7）')
    } else console.log('  ✓ HTML 展示 KOL 活跃状态')
    if (!h.includes('data-f="A"') || !h.includes('data-tier=')) {
      failed++; console.error('  ✗ HTML 缺分层 tab 或卡片 data-tier（违反 U6）')
    } else if (h.includes('scrollIntoView')) {
      failed++; console.error('  ✗ HTML 切 tab 会滚动页面（违反 U6）')
    } else console.log('  ✓ HTML 分层 tab 可用且不滚动')
  }

  // 防回归，**不认领判据**：P5.h 只管 false 那一头（见 ADR-67 的就地更正）。真跑过
  // 增强却报 false 眼下另有一条已知缺陷够得着 —— 合并与降权会把增强过的记录变换掉。
  // 这里给的是 `email_verified: false`：查了、没查到邮箱，也算跑过（见 report.ts）。
  const cPath = join(tmp, dir, 'creators.json')
  const pristine = readFileSync(cPath, 'utf8')
  const patched = JSON.parse(pristine)
  patched[0].email_verified = false
  writeFileSync(cPath, JSON.stringify(patched, null, 2), 'utf8')
  run('render 跑过邮箱增强时如实报 enriched', [S('render.ts'), '--dir', dir], tmp)
  const enrichedMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
  if (enrichedMeta.enriched !== true) {
    failed++; console.error('  ✗ meta.json 的 enriched 不实 —— 跑过邮箱增强却报 false')
  } else console.log('  ✓ meta.json 的 enriched 如实（跑过邮箱增强时为 true）')
  // 复位：后面几段接着用这个任务目录，交付物与产出物都要回到未增强的样子。
  writeFileSync(cPath, pristine, 'utf8')
  run('render 复位（回到未增强的产出）', [S('render.ts'), '--dir', dir], tmp)
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

// ---- 记忆读不出来：不产出名单、不覆盖原文件、逃生口要显式打出来（ADR-15）----
// 触发它的不是天灾 —— 这个产品要求运营手改 memory/creators.json 来标 contacted，
// 手改 JSON 就是最常见的损坏来源。原实现在这里退化成空记忆，于是打扰过的人
// 重新进名单，紧接着 render 又拿一份「谁都没联系过」的记忆盖掉原文件。
if (dir) {
  const memFile = join(tmp, 'memory', 'creators.json')
  const healthy = readFileSync(memFile, 'utf8')
  const contactedCount = Object.keys(JSON.parse(healthy).creators ?? {}).length
  const broken = healthy.slice(0, Math.floor(healthy.length * 0.6))
  writeFileSync(memFile, broken, 'utf8')

  const deliverable = join(tmp, dir, 'creators.json')
  const beforeList = readFileSync(deliverable, 'utf8')

  const stderr = run('collect 记忆读不出来时不产出名单',
                     [S('collect.ts'), '--resume', dir, '--budget', '1'], tmp,
                     { status: 2, stream: 'stderr' })
  if (!stderr.includes('--ignore-memory') || !stderr.includes('--resume')) {
    failed++
    console.error('  ✗ 中止时没有告诉用户怎么往下走 —— 一条人照做不了的报错等于没报')
  } else console.log('  ✓ 中止时给出了修复与强出名单两条路')
  // 这一轮采集已经跑完，所以续跑确实不花钱 —— 但那句话必须是**算出来的**，
  // 不是无条件写死的。还有关键词没跑完时它要说的是相反的话（ADR-22）。
  if (!stderr.includes('续跑不产生新的请求') && !stderr.includes('续跑会继续发请求')) {
    failed++
    console.error('  ✗ 没有说清续跑的代价 —— 或者把「已抓到的不重抓」写成了「续跑免费」')
  } else console.log('  ✓ 续跑的代价按实际剩余工作量说话')
  // 预算用尽时光 --resume 会立刻再退 3。这里采集已跑完，命令不该带 --budget；
  // 反过来说了「预算也已用尽」的那条命令必须带 —— 两句话要同进同出
  const budgetGone = stderr.includes('预算也已用尽')
  const cmdHasBudget = /修好它再跑:.*--budget <新额度>/.test(stderr)
  if (budgetGone !== cmdHasBudget) {
    failed++
    console.error('  ✗ 恢复命令与预算状态不一致 —— 用户照着敲会立刻再撞一次退出码 3')
  } else console.log('  ✓ 恢复命令按预算状态决定要不要带 --budget')
  if (readFileSync(deliverable, 'utf8') !== beforeList) {
    failed++; console.error('  ✗ 中止时仍改写了交付物 creators.json')
  } else console.log('  ✓ 中止未触碰交付物')

  // ---- 收尾那句话：两种剩余工作量各真跑一遍（D6.e 的入口那一半）----
  // 说哪一句、两个剩余量怎么数，都由 scripts/test.ts 断言；这里验的是**入口真的
  // 调了它**。上面那条老断言用的是「两句里出现一句」的或，两支对调它照样绿 ——
  // 而这一段的接线没有变异守得住：变异跑的只是 scripts/test.ts，够不到入口脚本。
  // 记忆此刻仍是坏的，所以两次都会走到收尾中止那条路（退出码 2）。
  //
  // 没活可干：target_count 给 1，达标提前停下 —— 剩下的关键词续跑一个都不会抓
  // （D6.c），profile 也在这一轮补全过了（D6.d）。
  const zeroCfg = join(tmp, 'zero.json')
  writeFileSync(zeroCfg, JSON.stringify({
    product: 'zero', market: 'US', target_count: 1, budget_usd: 1,
    tasks: Array.from({ length: 3 }, (_, i) => ({
      keyword: `zk${i}`, dimension: 'category', platform: 'tiktok',
    })),
  }))
  const zeroErr = run('collect 收尾：没活了就说续跑不产生新请求',
                      [S('collect.ts'), '--config', zeroCfg], tmp, { status: 2, stream: 'stderr' })
  if (!zeroErr.includes('续跑不产生新的请求')) {
    failed++
    console.error('  ✗ 都跑完了却没说「续跑不产生新的请求」—— 用户不敢续跑，那份已经付过钱的名单就拿不到')
  } else if (zeroErr.includes('续跑会继续发请求')) {
    failed++; console.error('  ✗ 两句话同时出现 —— 用户不知道该信哪一句')
  } else console.log('  ✓ 收尾：没活了，说的是续跑不产生新的请求')

  // 还有活：预算卡死在第一个关键词上，剩下的续跑真的会去抓
  const leftCfg = join(tmp, 'left.json')
  writeFileSync(leftCfg, JSON.stringify({
    product: 'left', market: 'US', target_count: 500, budget_usd: 0.002,
    tasks: Array.from({ length: 6 }, (_, i) => ({
      keyword: `lk${i}`, dimension: 'category', platform: 'tiktok',
    })),
  }))
  const leftErr = run('collect 收尾：还有活就说续跑要继续花钱',
                      [S('collect.ts'), '--config', leftCfg], tmp, { status: 2, stream: 'stderr' })
  if (!leftErr.includes('续跑会继续发请求、继续花钱')) {
    failed++
    console.error('  ✗ 还有活却没说续跑要继续花钱 —— 用户放心去续跑，账单在他不知情时又长一截')
  } else if (!/还有 \d+ 个关键词/.test(leftErr)) {
    failed++; console.error('  ✗ 说了要花钱却没说还剩什么 —— 用户没法判断值不值得续跑')
  } else console.log('  ✓ 收尾：还有活，说的是续跑要继续花钱，并点名了还剩多少')

  // 只剩 profile：上面两条都护不住**递进去的那批人**（评审指出，实测坐实）——
  // 把那个实参换成 `[]`，「没活」那条本来就没人要补，「还有活」那条光靠关键词
  // 就选中了要花钱的那支，两条照样绿，而少报的正是最危险的那一种：
  // 关键词全跑完、只剩 profile 没补时说成「续跑不产生新的请求」，
  // 而续跑第一件事就是去发那些付费请求。
  //
  // 造法：target_count 给 1 —— 第一个关键词就达标，剩下的续跑一个都不会抓
  // （D6.c）；预算恰好只够那一次搜索（0.001 = 一次请求），补全循环第一个人
  // 就撞上预算，三个人全都没补成（D6.d）。所以这一条**只能**由 profile 那一半
  // 说话，关键词那一半必须一个字都不出现。
  const onlyCfg = join(tmp, 'only-profile.json')
  writeFileSync(onlyCfg, JSON.stringify({
    product: 'onlyprofile', market: 'US', target_count: 1, budget_usd: 0.001,
    tasks: Array.from({ length: 3 }, (_, i) => ({
      keyword: `ok${i}`, dimension: 'category', platform: 'tiktok',
    })),
  }))
  const onlyErr = run('collect 收尾：只剩 profile 也要说续跑要花钱',
                      [S('collect.ts'), '--config', onlyCfg], tmp, { status: 2, stream: 'stderr' })
  if (!/还有 \d+ 个人的 profile/.test(onlyErr)) {
    failed++
    console.error('  ✗ 只剩 profile 没补时没点名它 —— 递进去的那批人没人守着')
  } else if (!onlyErr.includes('续跑会继续发请求、继续花钱')) {
    failed++
    console.error('  ✗ 只剩 profile 没补却说续跑不花钱 —— 续跑第一件事就是去发那些付费请求')
  } else if (/还有 \d+ 个关键词/.test(onlyErr)) {
    failed++
    console.error('  ✗ 这一条本该只由 profile 那一半说话，关键词那一半也出现了 —— 夹具没造对')
  } else console.log('  ✓ 收尾：只剩 profile 没补时也说要花钱，并点名了是 profile')

  // ---- 产出了名单的四种收尾都说续跑代价（D6.f 的入口那一半）----
  // 这四条路径原先一个字都不说，用户手里没有判断「值不值得续跑」的依据（ADR-25 的欠条）。
  // 四条共用分支之前的同一句话，所以是一条判据；也正因为共用，**一条把话写死就会被
  // 别的抓住** —— 前两条要的是「不花钱」，后两条要的是「花钱 + 还剩多少」。
  // 变异守不住这一段（变异跑的只是 scripts/test.ts，够不到入口脚本），只能这样真跑；
  // 这条缺口在 mutations.json 的 exemptions 里按 P3.b 的先例显式登记着。
  //
  // **每条都断言这一次到底走的是哪一种收尾**（stdout 的 `stopped`）—— 只看那句话的话，
  // 「达标提前停下」和「关键词跑完」都是退出码 0、都说「不花钱」，一条夹具会让另一条
  // 看起来也测过了，而它们是 `stopped` 的两个不同取值（评审指出）。
  const paths = join(tmp, 'paths')
  mkdirSync(join(paths, 'memory'), { recursive: true })
  const pathCfg = (name: string, over: Record<string, unknown>, keyword = 'pk') => {
    const f = join(paths, `${name}.json`)
    writeFileSync(f, JSON.stringify({
      product: name, market: 'US', target_count: 500, budget_usd: 1,
      tasks: Array.from({ length: 3 }, (_, i) => ({
        keyword: `${keyword}${i}`, dimension: 'category', platform: 'tiktok',
      })),
      ...over,
    }))
    return f
  }
  /** 一条收尾路径：退出码、`stopped` 取值、那句话该说什么 —— 三样一起验 */
  const endPath = (label: string, cfg: string, status: number, stopped: string,
                   want: RegExp, deny: RegExp) => {
    const { stdout, stderr } = runBoth(label, [S('collect.ts'), '--config', cfg], paths, { status })
    if (!new RegExp(`"stopped":\\s*"${stopped}"`).test(stdout)) {
      failed++
      console.error(`  ✗ ${label}：这一次走的不是 ${stopped} 那条收尾 —— 夹具没造对，`
                    + `断言绿了也不算测过那条路径`)
    } else if (!want.test(stderr)) {
      failed++
      console.error(`  ✗ ${label}：没说清续跑的代价 —— 用户手里就没有判断值不值得续跑的依据`)
    } else if (deny.test(stderr)) {
      failed++
      console.error(`  ✗ ${label}：说反了 —— 两句话不能同时出现，用户不知道该信哪一句`)
    } else console.log(`  ✓ ${label}（stopped=${stopped}）`)
  }

  const FREE = /续跑不产生新的请求/
  const COST = /还有 .*没跑完，续跑会继续发请求、继续花钱/

  // 关键词跑完：target 给得比罐头人口（3 人）高，达标那条路永远走不到，
  // 三个关键词各跑到页数上限才收工 —— 这才是 D6.f 点名的「关键词跑完」。
  endPath('collect 关键词跑完（退出码 0）也说续跑代价',
          pathCfg('pdone', { target_count: 9999 }), 0, 'done', FREE, COST)

  // 达标提前停下：和上面同为退出码 0、同说「不花钱」，但 stopped 不同 ——
  // 剩下的关键词一个都没碰过，而续跑会在第一个请求之前再次达标（D6.c）。
  endPath('collect 达标提前停下（退出码 0）也说续跑代价',
          pathCfg('ptarget', { target_count: 1 }), 0, 'target', FREE, COST)

  // 预算用尽：退出码 3，带着断点目录走 stdout，那句话在 stderr
  endPath('collect 预算用尽（退出码 3）也说续跑代价',
          pathCfg('pbudget', { budget_usd: 0.002 }), 3, 'budget', COST, FREE)

  // 出错中止：退出码 1。402 是对面拒收（余额不足），和预算用尽不是一回事 ——
  // 关键词里带 force-402 让罐头 fetch 抛它，这是走到这条路径的唯一办法。
  endPath('collect 出错中止（退出码 1）也说续跑代价',
          pathCfg('perror', {}, 'force-402-k'), 1, 'error', COST, FREE)

  // 逃生口：出名单，但状态必须原样带到 stdout
  const forced = run('collect --ignore-memory 强出名单',
                     [S('collect.ts'), '--resume', dir, '--budget', '1', '--ignore-memory'], tmp)
  let forcedSummary: any = {}
  try { forcedSummary = JSON.parse(forced) } catch {}
  if (forcedSummary.memory_status !== 'unreadable_ignored') {
    failed++
    console.error(`  ✗ 强出的名单没有声明未去重（memory_status=${forcedSummary.memory_status}）`)
  } else console.log('  ✓ 强出的名单在 stdout 声明 memory_status')

  // render：不写回，不覆盖，且报告上说出来
  run('render 记忆读不出来时不覆盖原文件', [S('render.ts'), '--dir', dir], tmp)
  if (readFileSync(memFile, 'utf8') !== broken) {
    failed++
    console.error(`  ✗ 读不出来的记忆被覆盖了 —— 原本记着 ${contactedCount} 个人的联系状态`)
  } else console.log('  ✓ 读不出来的记忆一个字节没动')

  const metaAfter = JSON.parse(readFileSync(join(tmp, dir, 'meta.json'), 'utf8'))
  const htmlAfter = readFileSync(join(tmp, dir, 'report.html'), 'utf8')
  if (metaAfter.memory_written !== false || metaAfter.memory_status !== 'unreadable_ignored') {
    failed++; console.error('  ✗ meta.json 没有报出记忆的两个状态')
  } else if (!htmlAfter.includes('未做「已联系 / 已推荐」去重')) {
    failed++; console.error('  ✗ 报告没有声明这批名单未去重（P5）')
  } else console.log('  ✓ meta.json 与报告都声明了记忆失效')

  // 旧任务目录：task.json 里根本没有这个字段。**不能读成「去重跑过了」** ——
  // 产出它的那一版遇到读不出来的记忆会静默当成空记忆（ADR-18）。
  writeFileSync(memFile, healthy, 'utf8')
  const taskFile = join(tmp, dir, 'task.json')
  const legacy = JSON.parse(readFileSync(taskFile, 'utf8'))
  delete legacy.memory_status
  writeFileSync(taskFile, JSON.stringify(legacy, null, 2), 'utf8')

  run('render 旧任务目录的去重状态记为无从确认', [S('render.ts'), '--dir', dir], tmp)
  const legacyMeta = JSON.parse(readFileSync(join(tmp, dir, 'meta.json'), 'utf8'))
  const legacyHtml = readFileSync(join(tmp, dir, 'report.html'), 'utf8')
  if (legacyMeta.memory_status !== 'unknown') {
    failed++
    console.error(`  ✗ 缺字段被读成了 ${legacyMeta.memory_status} —— 无从确认的事被当成了肯定答案`)
  } else if (!legacyHtml.includes('无从确认')) {
    failed++; console.error('  ✗ 报告没有声明去重状态无从确认')
  } else console.log('  ✓ 旧任务目录记为 unknown 并在报告上声明')
}

// ---- 纪律 lint：扫到违规就以退出码 1 结束（P1.b 的入口那一半）----
// 判定与扫描范围由 scripts/test.ts 断言；「命中即失败」是入口的退出码，
// 只有真跑一遍才看得见 —— 检查链平时跑的是干净的树，那条失败分支从不触发。
const lintTmp = join(tmp, 'lint-hit')
mkdirSync(join(lintTmp, 'scripts', 'lib'), { recursive: true })
writeFileSync(join(lintTmp, 'scripts', 'lib', 'bad.ts'), '  const x = c.followers ?? 0\n', 'utf8')
run('纪律 lint 命中即以退出码 1 结束', [S('check/lint.ts')], lintTmp, { status: 1 })

// ---- 变异集编号重复：两个入口都命中即以退出码 1 结束（M-H7-b、M-H7-c 的入口那一半）----
// 判定和「两种毛病同时在时先报哪一种」都由 scripts/test.ts 断言；剩下的那一半是
// **入口真的调了它、并且以退出码 1 结束** —— 把两处调用整块删掉，那些断言和
// M-H7-b、M-H7-c 照样全绿，因为变异跑的只是 scripts/test.ts，够不到入口。
// 一份语料喂两个入口，里面两处毛病都放：编号重复 + 记在不存在的需求名下。
const dupTmp = join(tmp, 'dup-mut')
mkdirSync(join(dupTmp, 'scripts', 'check'), { recursive: true })
mkdirSync(join(dupTmp, 'docs'), { recursive: true })
writeFileSync(join(dupTmp, 'docs', 'requirements.json'),
  JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
// 架构文档留空：arch-sync 的重复检查要是排在读表之后，报的就是「缺少 BEGIN/END 标记」
writeFileSync(join(dupTmp, 'docs', 'ARCHITECTURE.md'), '', 'utf8')
writeFileSync(join(dupTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({ mutations: [
  { id: 'M-X-a', req: 'X1', why: '顶着同一个名字的第一条', file: 'a.ts', find: 'x', replace: 'y' },
  { id: 'M-X-a', req: '登记表里没有这条', why: '同名的第二条，同时还记错了名下', file: 'a.ts', find: 'x', replace: 'z' },
] }), 'utf8')
// mutate：出来的必须是重复那一条 —— 先后由 attributionFault 定，这里验的是
// 入口照着它说的印、并且真的以 1 结束
// 不加 `dupMut &&` 那道真值判断：`run` 在退出码对得上、stderr 却是空的时候也返回空串，
// 于是「诊断被删光、只剩 process.exit(1)」会从这儿滑过去（评审指出）
const dupMut = run('mutate 遇到重复编号即以退出码 1 结束', [S('check/mutate.ts')], dupTmp, { status: 1 })
if (!dupMut.includes('个编号重复')) {
  failed++; console.error('  ✗ mutate 的输出里没有「编号重复」那条诊断')
} else if (dupMut.includes('记在不存在的需求名下')) {
  failed++
  console.error('  ✗ mutate 先报的是记错名下 —— 那份报告印的也是 id，它自己也指不回表里哪一行')
}
// arch-sync：它在检查链里排在 mutate **前面**，而它按编号建的是 Map（重名只留最后一条）。
// 不在这儿先拦下，顺序契约就会指着另一条变异报「不在该契约的位置里」，而 mutate 那条
// 真正的诊断根本轮不上说话。
const dupArch = run('arch-sync 遇到重复编号即以退出码 1 结束', [S('check/arch-sync.ts')], dupTmp, { status: 1 })
if (!dupArch.includes('个编号重复')) {
  failed++; console.error('  ✗ arch-sync 的输出里没有「编号重复」那条诊断')
}

// mutate 的 --brief 只在「写测试的上下文」里用，检查链平时走的是不带参数那条路。
// 一条写进文档、却从没被执行过的命令，等于没有 —— 在这里跑一次，证明它还活着。
run('mutate --brief（变异清单，不跑变异）', [S('check/mutate.ts'), '--brief'])

rmSync(tmp, { recursive: true, force: true })

for (const [f, why] of Object.entries(EXEMPT)) console.log(`  ⊘ ${f} 豁免：${why}`)

/**
 * **把「所有可执行文件」这句话变成可查的。**
 *
 * 这一句原来是直接打印的:上面跑一张手写的清单,末尾宣布「所有可执行文件均被
 * 从头执行到尾」,中间没有任何东西把两者对上。于是新增一个可执行文件、忘了接进来,
 * 检查照样全绿,而那句话已经不成立了 —— 这正是本仓库反对的
 * **「一条声称做到、其实没做到的规则」**,而它就长在检查链自己身上。
 *
 * 枚举 —— 带 shebang 的就是可执行文件,每一个要么在上面跑过,要么在检查链里
 * 作为自己那一步跑过,要么写进 `EXEMPT` 说明理由。
 *
 * **但这两条路买到的东西不一样,末尾那句话必须分开说。** 单独跑
 * `npm run selfcheck` 时,检查链里那几步一步都没跑过 —— 合起来宣布
 * 「全都从头执行到尾」在那次调用里就是假的。这一条是评审指出来的,
 * 而它正是我上一版要修的那个毛病的**另一个形态**:
 * 我把一句过头的话换成了另一句过头的话。
 *
 * 所以这里查的是**接线**(每个可执行文件都有出处),不是**执行**
 * (这一次调用里它们都跑了)。两者的区别写进输出,不留给读的人猜。
 */
const shebang = (f: string) => readFileSync(f, 'utf8').startsWith('#!')
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(dir, e.name))
    : e.name.endsWith('.ts') && shebang(join(dir, e.name)) ? [join(dir, e.name)] : [])

const chain: string = JSON.parse(readFileSync('package.json', 'utf8')).scripts.check
const steps: Record<string, string> = JSON.parse(readFileSync('package.json', 'utf8')).scripts
const byChain = new Set(
  chain.split('&&').map(s => s.trim().replace(/^npm run /, '').replace(/^npm /, ''))
    .flatMap(name => (steps[name] ?? '').match(/scripts\/[\w/.-]+\.ts/) ?? []))

const orphans = walk('scripts')
  .filter(f => !covered.has(f) && !byChain.has(f) && !(f in EXEMPT))
if (orphans.length) {
  console.error(`\n✗ 脚本自检：${orphans.length} 个可执行文件谁都没跑过\n`)
  for (const f of orphans) console.error(`  · ${f}`)
  console.error('\n  接进本文件、接进 `npm run check`，或写进 EXEMPT 说明理由。')
  console.error('  不接也不写的话，末尾那句「都有出处」就是假的。')
  process.exit(1)
}

if (failed) { console.error(`\n✗ 脚本自检：${failed} 项失败`); process.exit(1) }
const all = walk('scripts')
const here = all.filter(f => covered.has(f)).length
const inChain = all.filter(f => !covered.has(f) && byChain.has(f)).length
console.log(`\n✓ 脚本自检：${all.length} 个可执行文件都有出处 ——`
  + ` 本文件从头跑到尾 ${here} 个，检查链里各自成一步 ${inChain} 个`
  + `，具名豁免 ${Object.keys(EXEMPT).length} 个`)
