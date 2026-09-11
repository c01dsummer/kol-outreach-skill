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
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tsxCommand } from './tsx-cmd.js'
import {
  ENTRY_CLAIMS_PATH, claimsOwnedBy, claimsPublishable, fingerprint, sourceFiles,
} from './claims.js'
import { writeFileAtomic } from '../lib/atomic.js'
import {
  SELFCHECK_FIXTURE_MARK, SELFCHECK_PRELOAD, SELFCHECK_PROCESS_MARK, SELFCHECK_TOOLS,
  selfcheckSummary,
} from './verifier-rule.js'

const EXEMPT: Record<string, string> = {}   // 目前无豁免

/**
 * **入口认领**:哪几条验收判据是这一次端到端真跑过的。
 *
 * 与单元认领同一套纪律,逐条复用 `claims.ts` 的判定:开跑前先清掉(不清的话,
 * 源码没改而这一跑半路死了,上一次的记录就成了这一次的证据);跑完全绿、
 * 源码一路没动过、且不是变异跑,才写得下(`claimsPublishable`)。
 *
 * `criterion()` 写在它认领的那几条断言**后面** —— 与 `test.ts` 的约定一样:
 * 那句话的意思是「上面那几条真的跑到了这里」,不是「打算测这一条」。
 *
 * 它们大多落在条件分支里(夹具没造起来就整段跳过)。跳过不会写下一条假认领:
 * 每一处跳过都是先记了一次失败才跳的,而 `claimsPublishable` 要求这一跑**全绿** ——
 * 认领与失败计数是同一个闸的两边,少认领一条与写下一条假的不是同一回事。
 */
const claimed = new Set<string>()
const criterion = (...ids: string[]): void => { for (const id of ids) claimed.add(id) }
const mutating = process.env.MUTATING === '1'
if (claimsOwnedBy(mutating)) rmSync(ENTRY_CLAIMS_PATH, { force: true })
const startHash = fingerprint(sourceFiles())

/** 脚本用绝对路径 —— 下面几处会切到临时目录里跑，让产出落在那边 */
const covered = new Set<string>()
const S = (f: string) => { covered.add(`scripts/${f}`); return resolve('scripts', f) }

const tmp = mkdtempSync(join(tmpdir(), 'kol-selfcheck-'))
const env = {
  ...process.env,
  TIKHUB_API_KEY: 'fake-key-for-selfcheck',
  NODE_OPTIONS: `--import ${JSON.stringify(pathToFileURL(resolve('scripts', SELFCHECK_PRELOAD)).href)}`,
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
 *
 * ## 进程级的失败要和断言红了分得开
 *
 * 两种原先打的是同一句 `✗ <名字>：…`。人看得出，机器看不出 —— 而变异的 `kills` 认的
 * 正是这句话，于是一条只把被测脚本弄崩的变异会被记成被抓到。所以进程级的带记号
 * （记号只此一份，在 `verifier-rule.ts`），断言红的不带；`endPath` 那一族还**一失败就
 * 不再往下断言**，免得再打一句不带记号的同名诊断。
 *
 * **每个调用点自己判。** `run` 交回 `string | undefined`，没跑起来给 `undefined`；
 * 调用点判空之后**整段跳过依赖它的断言**，不补打一句 —— 失败已经由这里带记号报过一次。
 * 早先 `run` 把 `ok` 丢了，被测脚本崩掉之后派生诊断照打、且不带记号（实测漏出
 * 「没有留下可读的断点」等两条，`failed` 还重复计数）。那笔账已经还完（ADR-70）。
 */
/**
 * 一条**有名字的**断言 —— 名字进清册(`labelsOf` 按 `VERIFIERS.selfcheck.declares` 扫),
 * 于是指着入口接线的变异写得出 `kills`、点得着这一条。
 *
 * 本文件几十句诊断是行内散文(`✗ <一句话>`)。那种句子是夹具的**后果**,不是夹具的名字,
 * 清册不收 —— `scripts/test.ts` 有一条断言钉着。收了的话 `kills` 就能点着一句在崩溃之后
 * 照打的话,正是 `judgeRun` 那道记号闸要堵的错误归因。
 *
 * ⚠️ **本条只把预算用尽那一段(今天的 P3.i)改成具名的**,全文件几十处一起改是另一个改动(ADR-70 记着)。
 */
const named = (label: string, ok: boolean, why: string) => {
  if (ok) { console.log(`  ✓ ${label}`); return }
  failed++
  console.error(`  ✗ ${label}：${why}`)
}

const runBoth = (label: string, args: string[], cwd = process.cwd(),
  expect?: { status: number }): { ok: boolean; stdout: string; stderr: string } => {
  const [exe, argv] = tsxCommand(args)
  const r = spawnSync(exe, argv, { env, cwd, encoding: 'utf8' })
  const stdout = r.stdout ?? ''   // p1-ok: 拿不到就是空输出，不是「没查过」——这是子进程的两股流
  const stderr = r.stderr ?? ''   // p1-ok: 同上
  const want = expect?.status ?? 0
  if (r.error || r.status !== want) {
    failed++
    const why = r.error ? String(r.error) : `预期以退出码 ${want} 结束，实际是 ${r.status}`
    console.error(`  ✗ ${label}${SELFCHECK_PROCESS_MARK}：${why}\n${(stderr || stdout).split('\n').slice(-12).join('\n')}`)
    return { ok: false, stdout: '', stderr: '' }
  }
  console.log(`  ✓ ${label}${expect ? `（按预期以退出码 ${want} 结束）` : ''}`)
  return { ok: true, stdout, stderr }
}

/**
 * 起一个被测对象。**没跑起来交回 `undefined`,不是空串。**
 *
 * 早先这里把 `runBoth` 的 `ok` 丢了,于是「没跑起来」和「跑起来了、输出为空」
 * 拿到的都是空串。二十来个调用点照样接着打派生诊断,说的是「没有留下可读的断点」,
 * 实际是脚本压根没起来 —— **自检报的原因是错的**,`failed` 还重复计一次。
 * 改成可空之后,编译器把接返回值的那些逐个逼出来;不接返回值、却在后面读磁盘副作用
 * 的那几处编译器看不见,是人肉扫出来的(ADR-70 那条欠条,重启条件已触发)。
 *
 * 判空之后**直接跳过派生断言,不再补打一句** —— 失败已经由 `runBoth` 带着
 * `SELFCHECK_PROCESS_MARK` 报过一次,再打一句不带记号的同名诊断,正是变异那边
 * `judgeRun` 要拦的错误归因。
 */
const run = (label: string, args: string[], cwd = process.cwd(),
  expect?: { status: number; stream?: 'stdout' | 'stderr' }): string | undefined => {
  const { ok, stdout, stderr } = runBoth(label, args, cwd, expect)
  if (!ok) return undefined
  // 没写 expect 的调用点历来拿的是 stdout，写了的默认拿 stderr —— 保持原样，
  // 免得几十个既有断言在这次改动里悄悄换了读的那一股。
  return (expect?.stream ?? (expect ? 'stderr' : 'stdout')) === 'stdout' ? stdout : stderr
}

/**
 * 起一个**检查链自己的工具**（不是被测对象）。
 *
 * 路径只能来自 `SELFCHECK_TOOLS` —— 形参类型是它的键，起一个表里没有的**编译期就过不去**。
 * 那张表同时是隔离判据的种子来源（`verifier-rule.ts`），所以「自检起了什么」和
 * 「闭包以为它起了什么」不可能对不上：两边读的是同一份东西。
 */
const runTool = (label: string, tool: keyof typeof SELFCHECK_TOOLS, rest: string[] = [],
  cwd = process.cwd(), expect?: { status: number }) =>
  run(label, [S(SELFCHECK_TOOLS[tool]), ...rest], cwd, expect)

/**
 * 同 `runTool`,但把 `ok` 一并交出来。
 *
 * 早先 `run` 只给一个字符串,「没跑起来」和「跑起来了、一个字也没输出」拿到的都是空串,
 * 拿 `if (out && …)` 当前置条件的调用点于是把后一种当成「无需检查」跳过 ——
 * **而那恰好就是下面两处入口夹具要防的那种退化**:整跑那份报告或 `--brief`
 * 什么也不打、照样以 0 退出,断言全部静默跳过,夹具打勾(#91 评审指出)。
 *
 * `run` 现在也交回可空了,所以这两件事都有了准确的表达:`undefined` 是「没跑起来」,
 * 空串是「跑起来了、什么也没打」。这里要 `ok` 的理由只剩一个 —— 那两处夹具**同时**
 * 要读 stdout 与判成败,`run` 只给一股。
 */
const runToolBoth = (label: string, tool: keyof typeof SELFCHECK_TOOLS, rest: string[] = [],
  cwd = process.cwd(), expect?: { status: number }) =>
  runBoth(label, [S(SELFCHECK_TOOLS[tool]), ...rest], cwd, expect)

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
if (probeOut !== undefined && !probeOut.includes('bio_available')) {
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
if (collectOut !== undefined) {
  try { dir = JSON.parse(collectOut).dir } catch {}
  // 走到这里说明进程跑起来了、退出码也对，只是 stdout 里没有可解析的 dir
  if (!dir) { failed++; console.error('  ✗ collect 未输出可解析的 dir') }
}

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
if (tightOut !== undefined) { try { tightDir = JSON.parse(tightOut).dir } catch {} }
const tightTask = tightDir ? join(tmp, tightDir, 'task.json') : ''
// 断点没落盘、或落盘在读不出来的地方，下面那几条断言就无从跑起 ——
// 跳过不能算通过，否则 P3.g～P3.j 可以一直是坏的而这一步照样打勾。
if (tightOut === undefined) {
  // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
} else {
  // 断点那一半（今天的 P3.i）改成**具名**断言：名字进清册，于是指着入口接线的变异
  // 写得出 `kills`、点得着它（落地 2 第 5 步 · 5b）。原先这里是一句行内散文，点不着。
  // 断点不只要**在**，还要记到**中止那一刻**：`requests` 与这一次实际发出的请求数对得上。
  // 只验「文件存在」太弱 —— 这份语料给 6 个 tiktok 关键词、预算只够两次请求，
  // 第三次搜索在 `run()` 里就抛了；而前两次成功的搜索**每次都调过 `persist()`**
  // （循环里那一处），所以几乎任何坏法下那个文件都在（实测：两条变异都从这条断言下滑过去了）。
  //
  // 两次解析都要兜住：退出码对得上、stdout 却是坏的时候，不兜的那一次会**抛**，
  // 于是本该红的具名断言变成了验证者崩溃，判定看到的是 `crashed` 而不是「被抓到」（#95 评审指出）。
  const saved = Boolean(tightDir) && existsSync(tightTask)
  let tightTaskJson: any
  if (saved) { try { tightTaskJson = JSON.parse(readFileSync(tightTask, 'utf8')) } catch {} }
  let tightSummary: any = {}
  try { tightSummary = JSON.parse(tightOut) } catch {}
  named('collect 预算用尽后留下的断点记到了中止那一刻',
        tightTaskJson !== undefined && tightTaskJson.requests === tightSummary.requests,
        tightTaskJson === undefined ? '断点读不出来'
          : `断点记着 ${tightTaskJson.requests} 次请求，而这一次实际发出了 `
            + `${tightSummary.requests} 次 —— 续跑的预算从断点里这个数起算，`
            + '记少了就等于同一份额度被反复重开，用户在没确认过的情况下超出上限')
  // 断点读不出来时，底下这些诊断全建立在同一份读不出来的文件上 —— 整段跳过。
  // 在这儿再解析一次会**抛**：刚刚红掉的那条具名断言就变成了验证者崩溃，判定看到的是
  // `crashed` 而不是「被抓到」。上一轮堵的是前两处解析，这一处漏了（#95 第二轮评审指出）。
  // 续跑之后那次解析同样兜住 —— 坏了就说「读不出来」，而不是把整个自检掀掉。
  if (tightTaskJson !== undefined) {
    const before = tightTaskJson
    const resumed = run('collect --resume 追加预算续跑',
                        [S('collect.ts'), '--resume', tightDir, '--budget', '1'], tmp)
    let after: any
    try { after = JSON.parse(readFileSync(tightTask, 'utf8')) } catch {}
    if (resumed === undefined) {
      // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
    } else if (after === undefined) {
      failed++; console.error('  ✗ 续跑之后断点读不出来')
    } else if (after.requests <= before.requests) {
      failed++; console.error('  ✗ 续跑后请求数未增长，断点恢复可能没生效')
    } else if (after.done.length <= before.done.length) {
      failed++; console.error('  ✗ 续跑后已完成关键词数未增长')
    } else {
      console.log(`  ✓ 断点恢复：关键词 ${before.done.length}→${after.done.length}，请求 ${before.requests}→${after.requests}`)
    }
  }
  // 写在整段之后，不写在「续跑」那一半之前：这一段要**全跑到**才认领得起 ——
  // 退出码 3（`expect` 那一档）、断点在、断点记到中止那一刻、续跑从断点起算。
  // 缺省那个验证者够不到入口，所以这条认领只有自检发得出（落地 3 第一片）。
  // ⚠️ **只认领 P3.i**（断点记的内容那一半）。原先这里认领的是还没拆开的 P3.b，
  // 于是一条负片盖住四半里的一半，整条就报成有覆盖 —— 拆开正是为了让那三半看得见。
  // 另外三半（P3.g 捕获、P3.h 断点在、P3.j 退出码 3）端到端也真跑到了，但都**拿不到
  // 可执行负片**（三条各自的理由与实测记在 ADR-70），所以按 `docs/SYNC.md`
  // 「红线判据两种认领一个都没有时要显式登记豁免」走豁免、不在这里认领：认领了就撞上
  // 「只由自检认领的判据必须有一条 `by: "selfcheck"` 的负片」那条硬失败，而它是对的。
  criterion('P3.i')
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
  if (out === undefined) {
    // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
  } else if (!existsSync(enrichment)) { failed++; console.error('  ✗ 未生成 enrichment.json') }
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
    if (migrationOut !== undefined) { try { migrationSummary = JSON.parse(migrationOut) } catch {} }
    if (migrationOut === undefined) {
      // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
    } else if (afterRequests !== beforeRequests || migrationSummary.newly_queried !== 0) {
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
    if (staleOut !== undefined) { try { staleSummary = JSON.parse(staleOut) } catch {} }
    if (staleOut === undefined) {
      // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
    } else if (!tampered) {
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
    if (padOut !== undefined) { try { padSummary = JSON.parse(padOut) } catch {} }
    const inconsistent = trimmed.filter(a => a.sample?.status === 'measured' &&
      (a.sample.value.length > 12 || a.sample.sample_size !== a.sample.value.length))
    if (padOut === undefined) {
      // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
    } else if (!padded) {
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
// **整段一起守住,不是只守第一条链。** 这一段往下每一条断言读的都是这次 render 的
// 产出物,只在第一条链前面判空的话,后面几条兄弟断言照样会跑 —— 轻则拿上一次的
// 陈旧产物报「✓」,重则 `readFileSync` 直接抛,自检连末尾那句汇总都打不出来
// （#94 评审指出；本文件另外两处同一形状,改法相同）。
const rendered = dir ? run('render 完整产出', [S('render.ts'), '--dir', dir], tmp) : undefined
if (dir && rendered !== undefined) {
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
  const reRendered = run('render 跑过邮箱增强时如实报 enriched',
                         [S('render.ts'), '--dir', dir], tmp)
  // 读也放进判空里：没跑起来时读到的是上一次留下的产出物，拿它判会把功劳记错
  if (reRendered !== undefined) {
    const enrichedMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
    if (enrichedMeta.enriched !== true) {
      failed++; console.error('  ✗ meta.json 的 enriched 不实 —— 跑过邮箱增强却报 false')
    } else console.log('  ✓ meta.json 的 enriched 如实（跑过邮箱增强时为 true）')
  }
  // 复位：后面几段接着用这个任务目录，交付物与产出物都要回到未增强的样子。
  writeFileSync(cPath, pristine, 'utf8')
  // 这一处不判空：它后面没有派生断言，跑不起来时 runBoth 已经带记号报过一次，
  // 再加一道判空只会多一层缩进而不多守住任何东西。同理还有下面那处纪律 lint 的入口。
  run('render 复位（回到未增强的产出）', [S('render.ts'), '--dir', dir], tmp)
}

// ---- 回归：collect → render → --resume 之后，已采集的人必须还在 ----
// 早先 creators.json 一个文件身兼两职：既是 --resume 的输入，又是过滤后的交付物。
// render 把这批人写进记忆后再续跑，记忆过滤判定「本产品已推荐过」，交付物被清成
// 空数组 —— 已经付费采集的数据不可恢复地消失。触发路径不冷门：用户看完报告说
// 「人不够，再多找点」，Agent 就会去跑 --resume。
// 这一段验的是「render 之后再续跑，已采集的人还在」—— render 没跑起来它就无从验起
if (dir && rendered !== undefined) {
  const deliverable = join(tmp, dir, 'creators.json')
  const rawPath = join(tmp, dir, 'creators.raw.json')
  const before = JSON.parse(readFileSync(deliverable, 'utf8')).length
  const afterRender = run('collect --resume（在 render 之后）',
                          [S('collect.ts'), '--resume', dir, '--budget', '1'], tmp)

  if (afterRender === undefined) {
    // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
  } else if (!existsSync(rawPath)) {
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
// 同样依赖上面那次 render：memory/creators.json 是它写回来的。
// 不带这个前置条件的话，render 没跑起来时下一行 readFileSync 直接抛 ——
// **自检整个死掉，连末尾那句失败汇总都打不出来**（#94 评审指出，实测两版都会死）
if (dir && rendered !== undefined) {
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
  // 整段一起守住 —— 下面四条断言全都依赖这一次中止。逐条判空的写法里第三条
  // 会判出**假绿**：`stderr` 为空时两个布尔都是 false，`budgetGone !== cmdHasBudget`
  // 不成立，于是它在进程失败之后打了一个 ✓（#94 评审指出）
  if (stderr !== undefined) {
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
  }

  // ---- 收尾那句话：两种剩余工作量各真跑一遍（D6.e 的入口那一半）----
  // 说哪一句、两个剩余量怎么数，都由 scripts/test.ts 断言；这里验的是**入口真的
  // 调了它**。上面那条老断言用的是「两句里出现一句」的或，两支对调它照样绿 ——
  // 而这一段的接线至今没有变异守着：变异缺省跑的是 scripts/test.ts，够不到入口脚本
  // （改跑自检的那条路要在变异上写 by，这一处还没写，ADR-70）。
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
  if (zeroErr === undefined) {
    // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
  } else if (!zeroErr.includes('续跑不产生新的请求')) {
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
  if (leftErr === undefined) {
    // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
  } else if (!leftErr.includes('续跑会继续发请求、继续花钱')) {
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
  if (onlyErr === undefined) {
    // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
  } else if (!/还有 \d+ 个人的 profile/.test(onlyErr)) {
    failed++
    console.error('  ✗ 只剩 profile 没补时没点名它 —— 递进去的那批人没人守着')
  } else if (!onlyErr.includes('续跑会继续发请求、继续花钱')) {
    failed++
    console.error('  ✗ 只剩 profile 没补却说续跑不花钱 —— 续跑第一件事就是去发那些付费请求')
  } else if (/还有 \d+ 个关键词/.test(onlyErr)) {
    failed++
    console.error('  ✗ 这一条本该只由 profile 那一半说话，关键词那一半也出现了'
                  + ` —— 夹具没造对${SELFCHECK_FIXTURE_MARK}`)
  } else console.log('  ✓ 收尾：只剩 profile 没补时也说要花钱，并点名了是 profile')

  // ---- 产出了名单的四种收尾都说续跑代价（D6.f 的入口那一半）----
  // 这四条路径原先一个字都不说，用户手里没有判断「值不值得续跑」的依据（ADR-25 的欠条）。
  // 四条共用分支之前的同一句话，所以是一条判据；也正因为共用，**一条把话写死就会被
  // 别的抓住** —— 前两条要的是「不花钱」，后两条要的是「花钱 + 还剩多少」。
  // 缺省那个验证者（scripts/test.ts）够不到入口脚本，所以这一段只能这样真跑。
  // **现在有一条负片指着它**：M-D6-j 删掉那行共用的接线、改跑自检来验，kills 点名下面
  // 四条夹具**全部** —— 一条没红就判「红错了地方」（5c 第二片把 kills 收成一组之前只点得着
  // 第一条，剩下三条删光它照样绿）。⚠️ 它证明的是四条都还活着、都靠那一行，不是
  // 「四条路能各自坏掉」—— 后者要四条各自的变异（ADR-70 记着这条欠条）。
  // ⚠️ 这条缺口原先在 mutations.json 的 exemptions 里按 P3.b 的先例登记着，
  // **落地 4 已经撤掉那条豁免** —— D6.f 现在靠 M-D6-j 与那条硬失败顶着；
  // 「四条路能各自坏掉」那半仍然欠着，记在 ADR-70，不在豁免表里。
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
    const { ok, stdout, stderr } = runBoth(label, [S('collect.ts'), '--config', cfg], paths, { status })
    if (!ok) return                            // 没跑起来，下面每一句诊断都会说错原因
    if (!new RegExp(`"stopped":\\s*"${stopped}"`).test(stdout)) {
      failed++
      // 记号在这儿:这一行红说明**夹具废了**,不是断言说了话 —— 判定见了整次判
      // 「跑不起来」,不许把它记成 `kills` 点名那条的功劳(5c 第一片,与进程记号同形)
      console.error(`  ✗ ${label}${SELFCHECK_FIXTURE_MARK}：`
                    + `这一次走的不是 ${stopped} 那条收尾 —— 夹具没造对，`
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

  // 四条收尾各跑过一次，每次都验了退出码、`stopped` 取值、那句话说什么 ——
  // D6.f 逐字要求的正是这四条路都说清续跑要不要花钱（落地 3 第一片）
  criterion('D6.f')

  // 逃生口：出名单，但状态必须原样带到 stdout
  const forced = run('collect --ignore-memory 强出名单',
                     [S('collect.ts'), '--resume', dir, '--budget', '1', '--ignore-memory'], tmp)
  let forcedSummary: any = {}
  if (forced !== undefined) { try { forcedSummary = JSON.parse(forced) } catch {} }
  if (forced === undefined) {
    // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
  } else if (forcedSummary.memory_status !== 'unreadable_ignored') {
    failed++
    console.error(`  ✗ 强出的名单没有声明未去重（memory_status=${forcedSummary.memory_status}）`)
  } else console.log('  ✓ 强出的名单在 stdout 声明 memory_status')

  // render：不写回，不覆盖，且报告上说出来
  const keptMemory = run('render 记忆读不出来时不覆盖原文件', [S('render.ts'), '--dir', dir], tmp)
  // 三条后置条件一起守住 —— 后两条读的是这一次 render 的产出物，只守第一条的话
  // 它们会拿上一次留下的陈旧文件报「✓」，把功劳记在一次失败的运行头上
  if (keptMemory !== undefined) {
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
  }

  // 旧任务目录：task.json 里根本没有这个字段。**不能读成「去重跑过了」** ——
  // 产出它的那一版遇到读不出来的记忆会静默当成空记忆（ADR-18）。
  writeFileSync(memFile, healthy, 'utf8')
  const taskFile = join(tmp, dir, 'task.json')
  const legacy = JSON.parse(readFileSync(taskFile, 'utf8'))
  delete legacy.memory_status
  writeFileSync(taskFile, JSON.stringify(legacy, null, 2), 'utf8')

  const legacyRun = run('render 旧任务目录的去重状态记为无从确认', [S('render.ts'), '--dir', dir], tmp)
  // 读也放进判空里 —— 同上
  if (legacyRun !== undefined) {
    const legacyMeta = JSON.parse(readFileSync(join(tmp, dir, 'meta.json'), 'utf8'))
    const legacyHtml = readFileSync(join(tmp, dir, 'report.html'), 'utf8')
    if (legacyMeta.memory_status !== 'unknown') {
      failed++
      console.error(`  ✗ 缺字段被读成了 ${legacyMeta.memory_status} —— 无从确认的事被当成了肯定答案`)
    } else if (!legacyHtml.includes('无从确认')) {
      failed++; console.error('  ✗ 报告没有声明去重状态无从确认')
    } else console.log('  ✓ 旧任务目录记为 unknown 并在报告上声明')
  }
}

// ---- 纪律 lint：扫到违规就以退出码 1 结束（P1.b 的入口那一半）----
// 判定与扫描范围由 scripts/test.ts 断言；「命中即失败」是入口的退出码，
// 只有真跑一遍才看得见 —— 检查链平时跑的是干净的树，那条失败分支从不触发。
const lintTmp = join(tmp, 'lint-hit')
mkdirSync(join(lintTmp, 'scripts', 'lib'), { recursive: true })
writeFileSync(join(lintTmp, 'scripts', 'lib', 'bad.ts'), '  const x = c.followers ?? 0\n', 'utf8')
runTool('纪律 lint 命中即以退出码 1 结束', 'lint', [], lintTmp, { status: 1 })

// ---- 变异集编号重复：两个入口都命中即以退出码 1 结束（M-H7-b、M-H7-c 的入口那一半）----
// 判定和「两种毛病同时在时先报哪一种」都由 scripts/test.ts 断言；剩下的那一半是
// **入口真的调了它、并且以退出码 1 结束** —— 把两处调用整块删掉，那些断言和
// M-H7-b、M-H7-c 照样全绿，因为它们跑的是缺省那个验证者 scripts/test.ts，够不到入口。
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
// **不拿真值当前置条件。** 早先 `run` 在退出码对得上、stderr 却是空的时候也返回空串，
// 写成 `dupMut &&` 的话「诊断被删光、只剩那句退出」会从这儿滑过去（评审指出）。
// 现在 `run` 交回 `undefined` 表示没跑起来，空串就只剩「跑起来了、什么也没打」这一种意思 ——
// 判的是 `=== undefined`，不是真值。
const dupMut = runTool('mutate 遇到重复编号即以退出码 1 结束', 'mutate', [], dupTmp, { status: 1 })
if (dupMut === undefined) {
  // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
} else if (!dupMut.includes('个编号重复')) {
  failed++; console.error('  ✗ mutate 的输出里没有「编号重复」那条诊断')
} else if (dupMut.includes('记在不存在的需求名下')) {
  failed++
  console.error('  ✗ mutate 先报的是记错名下 —— 那份报告印的也是 id，它自己也指不回表里哪一行')
}
// arch-sync：它在检查链里排在 mutate **前面**，而它按编号建的是 Map（重名只留最后一条）。
// 不在这儿先拦下，顺序契约就会指着另一条变异报「不在该契约的位置里」，而 mutate 那条
// 真正的诊断根本轮不上说话。
const dupArch = runTool('arch-sync 遇到重复编号即以退出码 1 结束', 'arch', [], dupTmp, { status: 1 })
if (dupArch === undefined) {
  // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
} else if (!dupArch.includes('个编号重复')) {
  failed++; console.error('  ✗ arch-sync 的输出里没有「编号重复」那条诊断')
}

// ---- 变异的验证者接线不成立即以退出码 1 结束（wiringFault 的入口那一半）----
// 判据是 mutate-rule.ts 的 wiringFault，由 scripts/test.ts 断言、M-H14-t/u/v/w 四条负片
// 守着；剩下的那一半是**入口真的调了它、并且以退出码 1 结束**，还把四种裁定各翻成
// 一句人话 —— 把这一整段删掉，那四条负片和那些断言照样全绿，因为变异跑的是缺省
// 那个验证者，够不到入口。四种写错各喂一条，诊断也逐条对。
const wireTmp = join(tmp, 'bad-by')
mkdirSync(join(wireTmp, 'scripts', 'check'), { recursive: true })
mkdirSync(join(wireTmp, 'docs'), { recursive: true })
writeFileSync(join(wireTmp, 'docs', 'requirements.json'),
  JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
writeFileSync(join(wireTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({ mutations: [
  { id: 'M-X-b', req: 'X1', why: '指了一个不认得的验证者', file: 'a.ts', find: 'x', replace: 'y', by: '查无此人' },
  { id: 'M-X-c', req: 'X1', why: '指名了验证者却没说该红的是哪一条', file: 'a.ts', find: 'x', replace: 'z', by: 'selfcheck' },
  { id: 'M-X-d', req: 'X1', why: '点了名却没说谁来验', file: 'a.ts', find: 'x', replace: 'w', kills: ['某条夹具'] },
  // 老写法那个字符串：判定拦得住，但入口那句提示原先没人验 —— 改坏了整份检查照样绿
  // （#97 第二轮评审指出）。JSON 里就是要写成字符串，所以这里绕过类型
  { id: 'M-X-h', req: 'X1', why: 'kills 还写着老写法那个字符串', file: 'a.ts', find: 'x', replace: 'v',
    by: 'selfcheck', kills: '某条夹具' as unknown as string[] },
] }), 'utf8')
const badBy = runTool('mutate 的验证者接线不成立即以退出码 1 结束', 'mutate', [], wireTmp, { status: 1 })
if (badBy === undefined) {
  // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
} else if (!badBy.includes('不认得')) {
  failed++; console.error('  ✗ mutate 没报出「指的验证者不认得」')
} else if (!badBy.includes('没说该红的是哪几条夹具')) {
  failed++; console.error('  ✗ mutate 没报出「指名了验证者却漏了 kills」')
} else if (!badBy.includes('写了 kills 却没写 by')) {
  failed++; console.error('  ✗ mutate 没报出「写了 kills 却没写 by」')
} else if (!badBy.includes('kills 要写成一组名字')) {
  failed++; console.error('  ✗ mutate 没报出「kills 写成了老写法那个字符串」')
}

// ---- 自己验自己的变异即以退出码 1 结束（隔离判据的入口那一半）----
// 判据在 verifier-rule.ts（抽边、收闭包、裁定），由 scripts/test.ts 断言、四条负片守着；
// 剩下的那一半是**入口真的建了图、真的调了它、并且以退出码 1 结束**。把那一整段从
// mutate.ts 删掉，那些断言和负片照样全绿 —— 变异跑的是缺省那个验证者，够不到入口。
// **夹具搭成两跳，打在叶子上。** 打在种子上的话，闭包不用读任何文件就含着它 ——
// 建图那一整段删掉照样绿（评审指出，我原先正是这么写的）。现在从种子的源码里
// 引出一跳、再引到叶子：入口必须真的读了文件、真的顺着边递归，叶子才进得了闭包。
const isoTmp = join(tmp, 'self-verify')
mkdirSync(join(isoTmp, 'scripts', 'check'), { recursive: true })
mkdirSync(join(isoTmp, 'docs'), { recursive: true })
writeFileSync(join(isoTmp, 'docs', 'requirements.json'),
  JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
// **那一句拼出来，不写成整串。** 本文件是闭包的种子，而抽边那条判据认的是源码字面里
// 任何一处「from ＋ 相对路径」—— 写成整串的话，这两句夹具会被当成本文件真的 import，
// 把 hop 与 leaf 收进真闭包（实测 13 变 15）。#81 的评审两轮抓过同一个形状的诱饵，
// 我又踩了一次；`scripts/test.ts` 里那条硬退出的反例也是这么拼的。
const importLine = (spec: string) => `import { a } from '${spec}'\n`
writeFileSync(join(isoTmp, 'scripts', 'check', 'selfcheck.ts'), importLine('./hop.js'), 'utf8')
writeFileSync(join(isoTmp, 'scripts', 'check', 'hop.ts'), importLine('./leaf.js'), 'utf8')
writeFileSync(join(isoTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({ mutations: [
  { id: 'M-X-e', req: 'X1', why: '改的是验证者自己要用的东西', by: 'selfcheck', kills: ['某条夹具'],
    file: 'scripts/check/leaf.ts', find: 'x', replace: 'y' },
] }), 'utf8')
const selfVer = runTool('mutate 遇到自己验自己即以退出码 1 结束', 'mutate', [], isoTmp, { status: 1 })
if (selfVer === undefined) {
  // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
} else if (!selfVer.includes('在自己验自己')) {
  failed++; console.error('  ✗ mutate 没报出「这条变异在自己验自己」')
}

// ---- 见齐就停：验证者不结束，mutate 照样得判它被抓到（提前退出的入口那一半）----
// 判据在 mutate-rule.ts（allKilled 说见没见齐、judgeRun 凭点名认），由 scripts/test.ts
// 断言、负片守着；剩下的那一半是**入口真的边收边看、真的把整组停掉**。把那一段从
// mutate.ts 删掉，那些断言和负片照样全绿 —— 变异跑的是缺省那个验证者，够不到入口。
//
// 这条夹具的验证者**故意不立刻结束**：见齐就停生效时它被当场停掉，mutate 立刻判「被抓到」；
// 坏掉的话只能等它自己退（退出码 0）——判定当场给「存活」，mutate 以 1 结束，这里就红了。
// 用定时退出而不是永不退出：坏掉时要红，不是要把整份检查挂住。
const stopTmp = join(tmp, 'stop-on-kills')
mkdirSync(join(stopTmp, 'scripts', 'check'), { recursive: true })
mkdirSync(join(stopTmp, 'docs'), { recursive: true })
writeFileSync(join(stopTmp, 'docs', 'requirements.json'),
  JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
writeFileSync(join(stopTmp, 'a.ts'), 'const x = 1\n', 'utf8')
// 这个假验证者既要被清册扫得到（endPath 的字面量），又要真的打出那一行、然后赖着不走
writeFileSync(join(stopTmp, 'scripts', 'check', 'selfcheck.ts'),
  ['const endPath = (label: string, _rest: unknown[]): void => {',
   '  console.error(`  ✗ ${label}`)',
   '}',
   "endPath('甲', [])",
   'setTimeout(() => {}, 20_000)',
   ''].join('\n'), 'utf8')
writeFileSync(join(stopTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({ mutations: [
  { id: 'M-X-i', req: 'X1', why: '把那个常量改掉', file: 'a.ts', find: 'const x = 1', replace: 'const x = 2',
    by: 'selfcheck', kills: ['甲'] },
] }), 'utf8')
// 那句「✓ … 被抓到」打在 stdout；给了 expect 的 run 缺省交回的是 stderr（#99 自检当场抓到）
const stopRun = runToolBoth('mutate 见齐就停（验证者不结束也不必等它）', 'mutate', [], stopTmp,
                            { status: 0 })
const stopOut = stopRun.ok ? stopRun.stdout : undefined
if (stopOut === undefined) {
  // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
} else if (!stopOut.includes('M-X-i')) {
  failed++; console.error('  ✗ mutate 没报出那条变异的结果')
} else if (!/M-X-i\s+\[X1\] 被抓到/.test(stopOut)) {
  failed++
  console.error('  ✗ 见齐了却没停 —— 验证者赖着不走，判定于是等到它自己退，'
                + `报的不是「被抓到」：\n${stopOut.split('\n').filter(l => l.includes('M-X-i')).join('\n')}`)
} else console.log('  ✓ 见齐就停：验证者没结束，那条变异照样判「被抓到」')

// ---- 点的夹具立不住即以退出码 1 结束（清册的入口那一半）----
// 判据在 mutate-rule.ts（扫源码建清册、裁定点得着点不着），由 scripts/test.ts 断言、
// 负片守着；剩下的那一半是**入口真的读了验证者的源码、真的建了清册、并且以退出码 1
// 结束**。把那一整段从 mutate.ts 删掉，那些断言和负片照样全绿 —— 变异跑的是缺省
// 那个验证者，够不到入口（与上面隔离判据那一段同一处境）。
const labelTmp = join(tmp, 'bad-kills')
mkdirSync(join(labelTmp, 'scripts', 'check'), { recursive: true })
mkdirSync(join(labelTmp, 'docs'), { recursive: true })
writeFileSync(join(labelTmp, 'docs', 'requirements.json'),
  JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
// 这三行**可以**写成整串：清册按语法树数，串的内容是一个字符串字面量的值，
// 结构上就不是调用（第一版按正则扫，那时它们真会被当成本文件自己的声明凭空进清册，
// 与 #84 在闭包那一头抓过的是同一个诱饵）。`scripts/test.ts` 里留着一条断言盯住它 ——
// 哪天换回按字面扫，那条当场红。
const declLine = (name: string) => `endPath('${name}', [])\n`
writeFileSync(join(labelTmp, 'scripts', 'check', 'selfcheck.ts'),
  declLine('甲') + declLine('乙') + declLine('乙'), 'utf8')
writeFileSync(join(labelTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({ mutations: [
  // 两条的**头一项都立得住**：立不住的在后面。只查首项的入口会一声不响地放过它们，
  // 而那正是 #97 评审点出来的坏法（判定已搬进 mutate-rule.ts，这一条端到端再守一次）
  { id: 'M-X-f', req: 'X1', why: '点了一个清册里没有的名字', file: 'a.ts', find: 'x', replace: 'y',
    by: 'selfcheck', kills: ['甲', '丙'] },
  { id: 'M-X-g', req: 'X1', why: '点的那个名字有两条夹具在用', file: 'a.ts', find: 'x', replace: 'z',
    by: 'selfcheck', kills: ['甲', '乙'] },
] }), 'utf8')
const badKills = runTool('mutate 的 kills 点不着夹具即以退出码 1 结束',
  'mutate', [], labelTmp, { status: 1 })
if (badKills === undefined) {
  // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
} else if (!badKills.includes('不在 selfcheck 的清册里')) {
  failed++; console.error('  ✗ mutate 没报出「点的夹具不在清册里」')
} else if (!badKills.includes('不止一条夹具叫')) {
  failed++; console.error('  ✗ mutate 没报出「点的那个名字有重名」')
}

// ---- 整跑那份报告里的豁免行，也要随负片改口（入口的第二处）----
// 上面那条断言守的是 `--brief`；**同一句话在 mutate.ts 里有两处**，整跑那一处
// 单元测试与变异集都够不到（`mutate.ts` 在验证基础设施闭包里，指着它的变异会被
// 「自己验自己」当场拦下，所以这一处只能有夹具、不能有负片 —— 与本文件另外四处
// mutate 夹具同一处境）。造一份最小语料真跑一遍整跑：一条会被抓到的变异 ＋ 两条豁免，
// 一条命中、一条不命中，两支话在同一次输出里各出现一次。约 2.7 秒。
const bothTmp = join(tmp, 'exempt-lead')
mkdirSync(join(bothTmp, 'scripts', 'check'), { recursive: true })
mkdirSync(join(bothTmp, 'docs'), { recursive: true })
writeFileSync(join(bothTmp, 'docs', 'requirements.json'),
  JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }, { id: 'X1.b' }] }] }), 'utf8')
// 语料自带的「被测对象」与「验证者」：变异把 keep 改成 gone，而这份测试见了 gone 就红
writeFileSync(join(bothTmp, 'scripts', 'check', 'a.ts'), "export const v = 'keep'\n", 'utf8')
// **那一句拼出来，不写成整串** —— 与上面 isoTmp 的 `importLine` 同一个理由：
// 抽边认的是本文件源码字面里任何一处「from ＋ 相对路径」，写成整串的话，
// 这行夹具会被当成本文件真的 import，往真闭包里塞一个磁盘上不存在的路径。
// 头一版正是这么写的，`scripts/test.ts` 里那条「真闭包里没有磁盘上不存在的路径」
// 当场红（#84 评审抓过同一个诱饵、#85 为它记了欠条，这是第三次 —— 这回是断言抓的）。
const q = "'"
writeFileSync(join(bothTmp, 'scripts', 'test.ts'),
  `import { v } from ${q}./check/a.js${q}\n`
  + `if (v !== ${q}keep${q}) { console.log('\\n1 个失败\\n'); process.exitCode = 1 }\n`, 'utf8')
writeFileSync(join(bothTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({
  mutations: [{ id: 'M-X-h', req: 'X1.a', why: '把那个值改掉，测试该红', 
                file: 'scripts/check/a.ts', find: 'keep', replace: 'gone' }],
  exemptions: [
    { req: 'X1.a', scope: '一半', why: '这一条名下有变异。' },
    { req: 'X1.b', scope: '一半', why: '这一条名下没有。' },
  ],
}), 'utf8')
// 前置条件问的是 `ok`,不是「输出非空」—— 跑起来了就必须断言,一个字不打也算红
const both = runToolBoth('mutate 整跑那份报告的豁免行随负片改口', 'mutate', [], bothTmp)
if (both.ok && !/^\s*⊘ X1\.a 名下有负片/m.test(both.stdout)) {
  failed++
  console.error('  ✗ 整跑那份报告里，名下有负片的那条没这么说 —— 又写死了')
} else if (both.ok && !/^\s*⊘ X1\.b 名下无变异/m.test(both.stdout)) {
  failed++
  console.error('  ✗ 整跑那份报告里，名下没有变异的那条没这么说')
}

// mutate 的 --brief 只在「写测试的上下文」里用，检查链平时走的是不带参数那条路。
// 一条写进文档、却从没被执行过的命令，等于没有 —— 在这里跑一次，证明它还活着。
//
// **还要断言它说了什么，不能只看它退出码是 0。** 那条豁免行的措辞是判定出的
// （`exemptionLead`），而入口把它换回写死的字符串这种坏法，单元测试与变异集都够不到
// —— 判定那一层守得很密，入口那一层原先是整个空的（#91 评审指出）。
// **认的是豁免那一行的形状，不是那句话在输出里出现过。** 头一版写成
// `brief.includes('名下有负片')`，反向验当场露馅：`--brief` 会把每条变异的 `why` 也打出来，
// 而其中一条负片的 `why` 里正好有这四个字 —— 接线退回写死，那句断言照样绿。
// 现在只认「⊘ ＋ 方括号里的编号 ＋ 这句话」的行首形状，与哪一条豁免命中无关。
//
// ⚠️ **跑的是上面那份合成语料，不是真仓库**（落地 4 改）。原先跑真仓库，靠的是
// 「仓库里总有一条名下有负片的豁免」—— 而落地 4 撤掉 P3.b 与 D6.f 之后就只剩 P2.a，
// 它名下无变异，这条断言当场失去对象。**一条断言的成立不该取决于登记表今天恰好长什么样**：
// 那不是这条夹具要守的东西，而且它会在一个与它无关的改动里红。
// 指到语料上之后两支话都在，于是两支都断言 —— 与整跑那一处对齐。
// ⚠️ 拆 P3.b 又往豁免表里添了三条名下无变异的，而这条夹具一动不动：那正是指到语料上买到的东西。
// ---- 判 `crashed` 那一档要留下现场（入口的第三处）----
// 判定说「跑不起来」时，原先一个字都不留下验证者说过什么 —— 而那是唯一能分辨
// 「真崩了」与「这一次不巧」的证据（ADR-70：它在落地 4 那一片里咬了两次才补上）。
// 这段输出在 `mutate.ts` 入口里，**变异够不到它**（`mutate.ts` 在验证基础设施闭包里，
// 指着它的变异会被「自己验自己」当场拦下）—— 与另外几处 mutate 夹具同一处境，
// 所以只能有夹具。删掉那几行打印，这条断言必须红。
//
// 单独一份语料，两条变异各造一种 `crashed`（口径见下面那段）。⚠️ 不能塞进上面那份 ——
// 一条 crashed 会让整跑非零退出，上面两条断言的前置条件 `both.ok` 当场为假，
// 它们就被静默跳过了。
const crashTmp = join(tmp, 'crash-scene')
mkdirSync(join(crashTmp, 'scripts', 'check'), { recursive: true })
mkdirSync(join(crashTmp, 'docs'), { recursive: true })
writeFileSync(join(crashTmp, 'docs', 'requirements.json'),
  JSON.stringify({ requirements: [{ id: 'X2', accept: [{ id: 'X2.a' }] }] }), 'utf8')
writeFileSync(join(crashTmp, 'scripts', 'check', 'a.ts'),
  "export const v = 'keep'\nexport const w = 'ok'\n", 'utf8')
// 这份语料造**两种 crashed**，两支分开守（#105 第一、四轮评审各指出一支）：
//   `M-X-c` 验证者**打 18 条失败行、再以非零退出**（不打汇总）→ 成形的失败行那一支。
//           打 18 条是因为封顶是 15 —— 只打两条的话 `omitted` 恒为 0，
//           「另有 N 行未显示」那一支从没跑到，整行删掉照样绿（第三轮评审指出）。
//   `M-X-r` 把另一处改成**语法错误** → 验证者打的是栈、一行成形的失败行都没有，
//           走「原始输出的尾巴」那一支。⚠️ **那才是真崩的样子**，而这段现场存在的
//           唯一理由就是诊断它；头一版只有这一种，于是反过来把上面那一支漏空了。
// 用 `exitCode` 而不是那个硬退出的写法：`exitRace` 扫的是**源码字面**，把那一串原样
// 写进这里，本文件自己就会被判成「打完汇总立刻退出」（ADR-70 逐字警告过这个坑，
// 我照样踩了 —— 断言 `selfcheck 这个验证者不硬退出` 当场红）。
writeFileSync(join(crashTmp, 'scripts', 'test.ts'),
  `import { v } from ${q}./check/a.js${q}\n`
  + `if (v !== ${q}keep${q}) {\n`
  + `  for (let i = 1; i <= 18; i++) console.log(\`  ✗ 假失败 \${i}\`)\n`
  + `  process.exitCode = 1\n`
  + `}\n`, 'utf8')
writeFileSync(join(crashTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({
  mutations: [
    { id: 'M-X-c', req: 'X2.a', why: '把那个值改掉，验证者打一串失败行之后以非零退出',
      file: 'scripts/check/a.ts', find: 'keep', replace: 'gone' },
    { id: 'M-X-r', req: 'X2.a', why: '把另一处改成语法错误，验证者起不来、打的是栈',
      file: 'scripts/check/a.ts', find: "'ok'", replace: "'ok" },
  ],
  exemptions: [],
}), 'utf8')
const crash = runToolBoth('mutate 判「跑不起来」时留下现场', 'mutate', [], crashTmp,
                          { status: 1 })
if (crash.ok && !/跑不起来/.test(crash.stdout)) {
  failed++
  console.error('  ✗ 那条变异没被判成「跑不起来」—— '
                + '这份语料造的是「验证者红过、却没打汇总」，那一档判的就是跑不起来')
// 认的是**逐字那一句**，不是「有个点号隔开的两截」—— 后者措辞怎么退化都能过
} else if (crash.ok && !/^\s+退出码 1 · 未因见齐点名而主动停$/m.test(crash.stdout)) {
  failed++
  console.error('  ✗ 判「跑不起来」那一行的退出码或停法不对 —— 现场丢了，或者措辞退化了')
} else if (crash.ok && !/^\s+│ ✗ 假失败 1$/m.test(crash.stdout)) {
  failed++
  console.error('  ✗ 判「跑不起来」却没把验证者的失败行逐条留下来 —— 分不出是真崩了还是这一次不巧')
} else if (crash.ok && !/^\s+│ ✗ 假失败 15$/m.test(crash.stdout)) {
  failed++
  console.error('  ✗ 只留了头几条失败行 —— 封顶之内的也被丢了')
} else if (crash.ok && /^\s+│ ✗ 假失败 16$/m.test(crash.stdout)) {
  failed++
  console.error('  ✗ 留的行数超过封顶 —— 一次吵的运行会把整份输出淹掉')
} else if (crash.ok && !/^\s+（另有 3 行未显示）$/m.test(crash.stdout)) {
  failed++
  console.error('  ✗ 截掉了 3 行却没报出来 —— 被截过的现场和本来就这么短的现场长得一样')
// ⚠️ 真崩那一支：验证者打的是栈，一行成形的失败行都没有。只认成形的失败行的话，
// 现场恰恰在最需要它的那一档是空的 —— 而这段代码存在的唯一理由就是诊断那一次。
} else if (crash.ok && !/^\s+没有成形的失败行，下面是它最后几行输出：$/m.test(crash.stdout)) {
  failed++
  console.error('  ✗ 真崩的那一次没说「下面是原始输出」—— 两种现场混在一起，读的人分不出')
} else if (crash.ok && !/^\s+┆ .*Transform failed/m.test(crash.stdout)) {
  failed++
  console.error('  ✗ 真崩的那一次把栈丢了 —— 现场在最需要它的那一档是空的')
}

const briefLead = /^\s*⊘\s+\[[^\]]+\]\s+名下有负片/m
const briefNone = /^\s*⊘\s+\[[^\]]+\]\s+名下无变异/m
const brief = runToolBoth('mutate --brief（变异清单，不跑变异）', 'mutate', ['--brief'], bothTmp)
if (brief.ok && !briefLead.test(brief.stdout)) {
  failed++
  console.error('  ✗ --brief 的豁免行没有随负片改口 —— 那句写死的「无变异」又回来了')
} else if (brief.ok && !briefNone.test(brief.stdout)) {
  failed++
  console.error('  ✗ --brief 里名下没有变异的那条没这么说')
}

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

// 孤儿也计进 failed，不再自带汇总、也不再自己退出：原先那句形状与末尾那句汇总不同，
// 而判定认的是末尾那一句，于是踩红它的变异会被判成「跑不起来」（评审指出）。
const orphans = walk('scripts')
  .filter(f => !covered.has(f) && !byChain.has(f) && !(f in EXEMPT))
if (orphans.length) {
  failed += orphans.length
  console.error(`\n  ✗ ${orphans.length} 个可执行文件谁都没跑过\n`)
  for (const f of orphans) console.error(`  · ${f}`)
  console.error('\n  接进本文件、接进 `npm run check`，或写进 EXEMPT 说明理由。')
  console.error('  不接也不写的话，末尾那句「都有出处」就是假的。')
}

// **设退出码，不硬退出**：汇总是最后打的，紧跟着硬退出会在管道上把它截掉
// （实测 stderr 积压 400 行时 40 次丢 18 次）。由 `exitRace` 守着（`mutate-rule.ts`）。
if (failed) {
  console.error(`\n${selfcheckSummary(failed)}`)
  process.exitCode = 1
} else {
  const all = walk('scripts')
  const here = all.filter(f => covered.has(f)).length
  const inChain = all.filter(f => !covered.has(f) && byChain.has(f)).length
  console.log(`\n✓ 脚本自检：${all.length} 个可执行文件都有出处 ——`
    + ` 本文件从头跑到尾 ${here} 个，检查链里各自成一步 ${inChain} 个`
    + `，具名豁免 ${Object.keys(EXEMPT).length} 个`)
}

// 写在最后：`failed` 要数完，指纹要在跑完之后再算一次。中途改过源码的话，拿跑完
// 那一刻的指纹写进去，审计会认为这份记录新鲜 —— 而断言跑的是改之前那棵树。所以
// 写进去的是**开跑那一刻**的，两头对不上就一个字也不写（`claimsPublishable`）。
// `covered`／`tensions` 恒空：自检不认领需求级与交点级，那两栏留着只是为了与单元
// 那份**同形**，同一套 `claimsWellFormed` 守两份。
if (claimsPublishable(mutating, failed, startHash, fingerprint(sourceFiles()))) {
  mkdirSync(dirname(ENTRY_CLAIMS_PATH), { recursive: true })
  writeFileAtomic(ENTRY_CLAIMS_PATH, `${JSON.stringify({
    source_hash: startHash,
    covered: [],
    criteria: [...claimed].sort(),
    tensions: [],
  }, null, 2)}\n`)
}
