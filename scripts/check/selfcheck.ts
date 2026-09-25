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
 *   （体量闸门在主干上就会打印「只报数不判定」走掉）
 *
 * 两种都没有的，就是没人跑过，报错。末尾那句话按这两组分开说 ——
 * 合起来说一句「全都从头执行到尾」，在单独跑 `npm run selfcheck` 时是假的。
 *
 * `--only=<组 id>` 只跑点名的那几组 ＋ 依赖闭包（`group-rule.ts`），给上面那句
 * 无条件的「两种都没有的就报错」开了**两处例外**：子集跑不判孤儿，也不碰入口认领。
 * 缩掉的面由运行时那两行照实打出来（ADR-77 的先例），这里不假装没缩。
 *
 * 死亡条件记在 ADR-85:一身三半,三半的答案不一样,所以没有整道的那一份。
 */
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import { tsxCommand } from './tsx-cmd.js'
import {
  ENTRY_CLAIMS_PATH, claimsOwnedBy, claimsPublishable, fingerprint, sourceFiles,
} from './claims.js'
import { type Group, parseOnly, wanted } from './group-rule.js'
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
const subset = parseOnly(process.argv.slice(2)) !== undefined
// **子集跑既不删也不写入口认领。** `claimed` 只装这一跑真跑到的那几条判据，
// 写回去等于拿残缺的记录盖掉完整的，而审计读的就是这份文件（它会报一批
// 「没有认领」）。删了不写更糟：审计连文件都读不到。所以子集跑按变异跑那一侧走。
if (!subset && claimsOwnedBy(mutating)) rmSync(ENTRY_CLAIMS_PATH, { force: true })
const startHash = fingerprint(sourceFiles())

/** 脚本用绝对路径 —— 下面几处会切到临时目录里跑，让产出落在那边 */
const covered = new Set<string>()
const S = (f: string) => { covered.add(`scripts/${f}`); return resolve('scripts', f) }

const tmp = mkdtempSync(join(tmpdir(), 'kol-selfcheck-'))
// **收尾那句 `rmSync(tmp)` 够不到顶层抛出去的那一路。** `--only` 点错组名会在
// `runGroups` 里抛，那时目录已经建好、语料已经写盘，收尾一行都不跑，每敲错一次
// 漏一个目录。照 `mutate.ts` 里 `restoreClaims` 的先例挂在 exit 上 —— 同样管不到
// 信号杀进来的那一路，写在这儿是为了别把它当成已经保证了的事。
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))
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
 * ⚠️ **本条只把 P3.b 那一段改成具名的**,全文件几十处一起改是另一个改动(ADR-70 记着)。
 */
const named = (label: string, ok: boolean, why: string) => {
  if (ok) { console.log(`  ✓ ${label}`); return }
  failed++
  console.error(`  ✗ ${label}：${why}`)
}

const runBoth = (label: string, args: string[], cwd = process.cwd(),
  expect?: { status: number; soft?: readonly number[] }, extra: NodeJS.ProcessEnv = {}): { ok: boolean; stdout: string; stderr: string; status: number | null } => {
  const [exe, argv] = tsxCommand(args)
  // extra 只给这一次 spawn：崩溃续跑那几条轨迹要给「杀掉那一跑」传旋钮、给续跑不传
  const r = spawnSync(exe, argv, { env: { ...env, ...extra }, cwd, encoding: 'utf8' })
  const stdout = r.stdout ?? ''   // P1 例外：拿不到就是空输出，不是「没查过」——这是子进程的两股流
  const stderr = r.stderr ?? ''   // P1 例外：同上
  const want = expect?.status ?? 0
  const bad = Boolean(r.error) || r.status !== want
  // `soft` 列的是**退出码本身就是判据点名的东西**时，调用点准备用 `named()` 判的那几个
  // 取值（D6.k 逐字写着「不得以退出码 0 收尾」，所以那里写 `soft: [0]`）。对上了就不打
  // 进程记号 —— 记号是一票否决（`judgeRun` 的 `notAssertion`），指着这条行为的变异会被判
  // 「跑不起来」而不是「被抓到」，功劳记错了人。**标签要写成字面量**，否则 `labelsOf`
  // 看不见它（它按语法树找 `named(…)` 的第一个实参，helper 包一层就认不出来）。
  //
  // ⚠️ **列的是取值，不是一个开关。** 头一版写成 `soft: true`，于是**起不来**（`r.error`）
  // 和**被信号打死**也一起走了这一支：进程记号不打、崩溃现场不打，而后面几条断言接着
  // 对着半截产出跑。实测（给这条夹具挂上 `FAKE_FETCH_KILL_AFTER_OK`）：退出码 137
  // 照样被当成「由具名断言判」（#139 评审指出）。真崩了就该是崩了。
  if (bad && !r.error && r.status !== null && (expect?.soft?.includes(r.status) ?? false)) {
    console.log(`  · ${label}（退出码 ${r.status}，由下面的具名断言判）`)
    return { ok: true, stdout, stderr, status: r.status }
  }
  if (bad) {
    failed++
    const why = r.error ? String(r.error) : `预期以退出码 ${want} 结束，实际是 ${r.status}`
    console.error(`  ✗ ${label}${SELFCHECK_PROCESS_MARK}：${why}\n${(stderr || stdout).split('\n').slice(-12).join('\n')}`)
    return { ok: false, stdout: '', stderr: '', status: r.status }
  }
  console.log(`  ✓ ${label}${expect ? `（按预期以退出码 ${want} 结束）` : ''}`)
  return { ok: true, stdout, stderr, status: r.status }
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
  expect?: { status: number; stream?: 'stdout' | 'stderr' }, extra?: NodeJS.ProcessEnv): string | undefined => {
  const { ok, stdout, stderr } = runBoth(label, args, cwd, expect, extra)
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


// ── 跨节引用的声明外提到这里 ──────────────────────────────────
//
// 这些名字被后面好几节用着。摊在某一节里的时候，那一节不跑、用它的那几节就
// `ReferenceError` 当场崩 —— 而崩了不算被抓到（ADR-70）。外提之后它们与「哪一节跑了」
// 无关，跨节引用只剩下面两个**真运行态**那两条。
//
// ⚠️ `bothTmp` 整段一起搬，不是只搬那行 `join(tmp, …)`。只搬路径常量的话，造目录与
// 写语料还留在原处，用它的地方会拿到 ENOENT —— 那会打出带（进程）记号的失败，
// 一票否决，整次判「跑不起来」。这一条是 #142 之后那轮独立复核指出的。

const searchHits = (ledger: string): number => !existsSync(ledger) ? 0
  : readFileSync(ledger, 'utf8').split('\n')
      .filter(l => l.startsWith('200\t') && l.includes('fetch_video_search_result')).length

const ledgerLines = (ledger: string, ok: boolean) => !existsSync(ledger) ? 0
  : readFileSync(ledger, 'utf8').split('\n').filter(l => /^\d/.test(l) && l.startsWith('200\t') === ok).length
const warnLines = (s: string) => s.split('\n').filter(l => l.includes('💰 已用')).length
const onlyDir = (cwd: string, product: string): string | undefined => {
  const hits = existsSync(join(cwd, 'output'))
    ? readdirSync(join(cwd, 'output')).filter(n => n.startsWith(`${product}-`)) : []
  return hits.length === 1 ? join('output', hits[0]) : undefined
}
// 断点不在约定的文件名下（M-D6-n 那类变异）→ 读成 NaN 让断言红，不是让自检崩：崩了不算抓到
const requestsOnDisk = (file: string): number => {
  try { return (JSON.parse(readFileSync(file, 'utf8')) as { requests: number }).requests } catch { return NaN }
}
const diskRequests = (cwd: string, dir: string): number => requestsOnDisk(join(cwd, dir, 'task.json'))
// 抽取列，只打印不判定：提醒行数是 F7.a「一次是每进程还是每任务」那张欠条的原料
const extract = (tag: string, disk: number, ledger: string, a: string, b: string) =>
  console.log(`    抽取 ${tag}：盘上 ${disk} · 账本 200 行 ${ledgerLines(ledger, true)} · 非 200 行 ${ledgerLines(ledger, false)}`
    + ` · 提醒行 杀掉那跑 ${warnLines(a)} 续跑 ${warnLines(b)}`)

const summaryOf = (stdout: string): any => { try { return JSON.parse(stdout) } catch { return {} } }

// F3.c／F3.d／F3.e：probe 因输入问题以退出码 2 结束时，stderr 不带内部异常的类名与调用堆栈（F3.c 管配置里的问题、F3.e 管缺 key），
// 配置里的问题还要写出配置路径与问题本身（F3.d）。三条会被不同的代码路径各自弄坏，所以分开认领（process/1-REQUIREMENTS.md）。
// probe、cost-input、hashtag-route、cost-save-errors 几组各拿它判一类输入问题（配置读不出、预算不合法、初始费用不可用、
// 路线不合规、缺 API key），判据只此一份。
// 期望只出自 F3.c 原文与 ADR-112 第六节第一张欠条，没有读 probe.ts 的函数体，也没有照着实现的输出抄：
//  · 类名：按 JS 的命名惯例认以 `Error` 结尾的标识符 —— 覆盖欠条点名的 `BudgetInputError`，也覆盖换个名字的
//    同一种泄漏（`TypeError`、`SyntaxError`、`Error: …` 前缀）。给运营看的问题描述用不着这个词
//  · 调用堆栈：认栈帧的形状「行首空白加 at 」，逐行认（`m` 旗标 —— 不带它只看得到整段的第一行，这半条就成了摆设）
//  · 配置路径：读作 `--config` 实参那个**文件路径**的原字符串，不是配置里的字段路径。依据：F3.c 把「配置读不出」
//    列在同一条里，读不出时能指认的只有文件路径；collect 的同类报错也是点名文件（skill/SKILL.md「stderr 提到
//    memory/creators.json」）。夹具一律传绝对路径，实现照原样打或先 resolve 再打都是同一串
const probeInputLeak = (stderr: string) => ({
  className: /\b[A-Za-z]*Error\b/.test(stderr),
  frames: /^\s+at\s/m.test(stderr),
})
// 末 8 行而不是 6 行：泄漏了堆栈时末尾几行全是栈帧，6 行时报错那一句容易被截掉，看不出红在哪
const stderrTail = (s: string) => JSON.stringify(s.split('\n').filter(Boolean).slice(-8))

// ADR-107/108 的公开账目形状与固定价格；只给调用方明确选择的已知夹具使用。
// 旧费用未知的夹具故意不调这个函数，不能在写盘辅助里见到缺账就补零。
const COST_VERSION = 'tikhub-public-20260720-5d52fe8fb109'
const COST_BASIS = '按固定公开基础价、不计优惠的估算；不是实际账单，也不保证供应商未来价格上限。'
const TT_SEARCH = '/api/v1/tiktok/app/v3/fetch_video_search_result'
const TT_PROFILE = '/api/v1/tiktok/web/fetch_user_profile'
const TT_POSTS = '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3'
const IG_REELS = '/api/v1/instagram/v2/search_reels'
const IG_USERS = '/api/v1/instagram/v2/search_users'
const IG_PROFILE = '/api/v1/instagram/v1/fetch_user_info_by_username_v3'
const IG_PROFILE_V2 = '/api/v1/instagram/v1/fetch_user_info_by_username_v2'
const costEntry = (endpoint: string, unit: number, http = 0, unknown = 0) => ({
  endpoint, price_version: COST_VERSION, unit_micro_usd: unit,
  http_200_count: http, unknown_result_count: unknown,
})
const knownCosts = (limit: number, entries: ReturnType<typeof costEntry>[], pending?: Record<string, unknown>) => {
  const requests = entries.reduce((sum, e) => sum + e.http_200_count + e.unknown_result_count, 0)
  return { requests, cost_ledger: { schema: 1, currency: 'USD', unit: 'micro_usd', scope: 'task',
    limit_micro_usd: limit, next_attempt_id: requests + (pending ? 2 : 1), entries,
    ...(pending ? { pending } : {}) } }
}
const jsonFile = (path: string): any => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return undefined }
}
const fileText = (path: string): string => {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}
const fetchAttempts = (path: string): string[] => fileText(path).split('\n').filter(Boolean)
// JSON source context 只读原 token，不用生产 parser，也不以舍入后的 Number 作精度 oracle。
const rootToken = (text: string, key: string, path: readonly (string | number)[] = []): string | undefined => {
  const tokens = new WeakMap<object, Map<string, string>>()
  let root: object | undefined
  try {
    ;(JSON.parse as any)(text, function (this: object, name: string, value: unknown, context?: { source?: string }) {
      if (context?.source !== undefined) {
        let own = tokens.get(this)
        if (!own) { own = new Map(); tokens.set(this, own) }
        own.set(name, context.source)
      }
      if (name === '') root = value as object
      return value
    })
    let holder: any = root
    for (const part of path) holder = holder?.[part]
    return holder !== null && typeof holder === 'object' ? tokens.get(holder)?.get(key) : undefined
  } catch { return undefined }
}
const costPerson = (platform = 'tiktok', handle = 'cost-person', over: Record<string, unknown> = {}) => ({
  platform, handle, nickname: handle, followers: 10000, post_count: 50, bio: null,
  bio_links: ['https://example.com'], verified: false, profile_url: '', source_keyword: 'local',
  source_dimension: 'category', recent_posts: [], fit: '✅', ...over,
})
const costFixture = (name: string, costs: Record<string, unknown>,
  over: Record<string, unknown> = {}, people: ReturnType<typeof costPerson>[] = []) => {
  const cwd = join(tmp, `cost-${name}`), taskDir = join(cwd, 'task')
  mkdirSync(join(cwd, 'memory'), { recursive: true })
  mkdirSync(taskDir, { recursive: true })
  writeFileSync(join(taskDir, 'task.json'), JSON.stringify({ product: name, market: 'US',
    target_count: 9999, budget_usd: 1,
    tasks: [{ keyword: 'local', dimension: 'category', platform: 'tiktok' }],
    done: [0], offsets: { 0: 5 }, pages: { 0: 1 }, answered: { 0: 1 }, found: { 0: 3 },
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...costs, ...over }))
  for (const file of ['creators.json', 'creators.raw.json'])
    writeFileSync(join(taskDir, file), JSON.stringify(people))
  return { cwd, taskDir, task: join(taskDir, 'task.json'), log: join(cwd, 'attempts.tsv') }
}
const costEnv = (log: string, extra: NodeJS.ProcessEnv = {}) => ({
  FAKE_FETCH_LEDGER: log, FAKE_FETCH_NO_429: '1', ...extra,
})
const moneyFields = ['cost_estimate_usd', 'budget_usd', 'cost_http_200_usd',
  'cost_unknown_result_usd', 'cost_pending_usd'] as const
const costViewMatches = (v: any, expected: Record<string, unknown>): boolean => v !== undefined
  && v.cost_basis === COST_BASIS && Array.isArray(v.cost_price_versions)
  && Array.isArray(v.cost_problems) && v.cost_problems.every((p: any) =>
    typeof p?.path === 'string' && typeof p?.reason === 'string')
  && moneyFields.every(k => v[k] === null || typeof v[k] === 'number')
  && Object.entries(expected).every(([key, value]) => JSON.stringify(v[key]) === JSON.stringify(value))

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

/** 派工那几组共用的落点 —— `seedJobs` 写进语料里，派工那一节读它 */
const jobsMark = join(tmp, 'jobs-cwd.txt')

const seedJobs = (dir: string, muts: unknown[]) => {
  mkdirSync(join(dir, 'scripts', 'check'), { recursive: true })
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'requirements.json'),
    JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
  writeFileSync(join(dir, 'scripts', 'check', 'a.ts'),
    "export const v = 'keep'\nexport const w = 'hold'\n", 'utf8')
  // 验证者每跑一遍就把自己那一刻的当前目录记一笔 —— 派工时它该在某个 worker 副本里
  const q = "'"
  writeFileSync(join(dir, 'scripts', 'test.ts'), [
    `import { v, w } from ${q}./check/a.js${q}`,
    `import { appendFileSync } from ${q}node:fs${q}`,
    `appendFileSync(${JSON.stringify(jobsMark)}, process.cwd() + ${q}\\n${q})`,
    `const bad = (v !== ${q}keep${q} ? 1 : 0) + (w !== ${q}hold${q} ? 1 : 0)`,
    `if (bad) { console.log(${q}\\n${q} + bad + ${q} 个失败\\n${q}); process.exitCode = 1 }`,
  ].join('\n') + '\n', 'utf8')
  writeFileSync(join(dir, 'scripts', 'check', 'mutations.json'),
    JSON.stringify({ mutations: muts, exemptions: [] }), 'utf8')
}
const jobMut = (id: string, find: string, replace: string, file = 'scripts/check/a.ts') =>
  ({ id, req: 'X1.a', why: '把那个值改掉，测试该红', file, find, replace })


/** collect 那一跑的产出目录 —— 真运行态，值由下面那一节写进来 */
let dir = ''
/** render 那一跑的产出 —— 真运行态，同上 */
let rendered: string | undefined


// ── 夹具分组：先登记，后统一派跑 ───────────────────────────────
//
// **两遍是必须的。** 一组要不要跑，取决于后面有没有别的组 `needs` 它 —— 边登记边跑的话，
// 第三组执行的那一刻还不知道第八组会不会点它，于是只能另外维护一张手写的依赖表，
// 而手写清单会烂（ADR-77 撤掉的那张手写敏感字段表就是先例）。登记完再派，
// 依赖只写在 `group(...)` 的第二个实参上，只此一份。
//
// 判定（哪几组该跑）在 `group-rule.ts`，这里只剩登记与执行。
const REGISTERED: (Group & { fn: () => void })[] = []
const group = (id: string, needs: readonly string[], fn: () => void): void => {
  REGISTERED.push({ id, needs, fn })
}
const runGroups = (): Set<string> | undefined => {
  const pick = wanted(REGISTERED, parseOnly(process.argv.slice(2)))
  if (pick !== undefined) {
    // 子集跑先把「这一跑到底跑了哪几组」印出来 —— 后面几处「本次没验」都指着它
    console.log(`[只跑 ${[...pick].join('、')}]（其余 ${REGISTERED.length - pick.size} 组没跑）\n`)
  }
  for (const g of REGISTERED) if (pick === undefined || pick.has(g.id)) g.fn()
  return pick
}

// ---- probe：双平台 + hashtag + 关键词搜索 ----
group('probe', [], () => {
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

  // ADR-106：同词同平台、不同维度与完全重复项都保留原任务身份。
  const identityCfg = join(tmp, 'probe-identity.json')
  writeFileSync(identityCfg, JSON.stringify({
    market: 'US', budget_usd: 0.5,
    tasks: [
      { keyword: 'selfcare', dimension: 'category', platform: 'instagram', as_hashtag: true },
      { keyword: '#Self Care', dimension: 'audience', platform: 'instagram', as_hashtag: true },
      { keyword: 'selfcare', dimension: 'scene', platform: 'instagram', as_hashtag: true },
      { keyword: 'selfcare', dimension: 'scene', platform: 'instagram', as_hashtag: true },
      // 普通错误会结束本次试探，放在末尾，前面每个成功任务才真正被执行。
      { keyword: 'force-402-selfcare', dimension: 'competitor', platform: 'tiktok' },
    ],
  }))
  const identityRun = runBoth('probe 同词与失败任务身份', [S('probe.ts'), '--config', identityCfg],
    tmp, undefined, { FAKE_FETCH_NO_429: '1' })
  if (identityRun.ok) {
    const results = summaryOf(identityRun.stdout).results
    const rows: any[] = Array.isArray(results) ? results : []
    named('probe 成功行带原下标与维度，完全重复任务也不合并',
      JSON.stringify(rows.filter(r => !r.error).map(r => [r.task_index, r.dimension]))
        === JSON.stringify([[0, 'category'], [1, 'audience'], [2, 'scene'], [3, 'scene']]),
      `成功行身份实际为 ${JSON.stringify(rows.filter(r => !r.error).map(r => [r.task_index, r.dimension]))}`)
    named('probe 普通错误行带原下标与维度，失败能定位到原任务',
      JSON.stringify(rows.filter(r => r.error).map(r => [r.task_index, r.dimension]))
        === JSON.stringify([[4, 'competitor']]),
      `错误行身份实际为 ${JSON.stringify(rows.filter(r => r.error).map(r => [r.task_index, r.dimension]))}`)
    const successLines = identityRun.stderr.split('\n').filter(l => l.trimStart().startsWith('✓'))
    const expected = [
      '任务 1 · category · instagram · 关键词「selfcare」',
      '任务 2 · audience · instagram · 关键词「#Self Care」',
      '任务 3 · scene · instagram · 关键词「selfcare」',
      '任务 4 · scene · instagram · 关键词「selfcare」',
    ]
    named('probe 每条成功进度保留原任务标签，原词不因配置加井号',
      successLines.length === expected.length && expected.every((label, i) => successLines[i]?.includes(label)),
      `成功进度实际为 ${JSON.stringify(successLines)}`)
    const failureLines = identityRun.stderr.split('\n').filter(l => l.trimStart().startsWith('✗'))
    named('probe 每条失败进度保留原任务标签',
      failureLines.length === 1
        && failureLines[0].includes('任务 5 · competitor · tiktok · 关键词「force-402-selfcare」'),
      `失败进度实际为 ${JSON.stringify(failureLines)}`)
    criterion('U8.f', 'U8.g', 'U8.h')
  }

  const postsCfg = join(tmp, 'probe-posts.json')
  writeFileSync(postsCfg, JSON.stringify({
    market: 'US', budget_usd: 0.5,
    tasks: [
      { keyword: 'force-noparse', dimension: 'category', platform: 'instagram' },
      { keyword: 'force-probe-captions', dimension: 'scene', platform: 'instagram' },
    ],
  }))
  const postsOut = run('probe 作品证据三态', [S('probe.ts'), '--config', postsCfg])
  if (postsOut !== undefined) {
    const summary = summaryOf(postsOut)
    const results: any[] = Array.isArray(summary.results) ? summary.results : []
    const topPost = (keyword: string, handle: string): unknown => {
      const sample = results.find(r => r.keyword === keyword)?.sample
      return Array.isArray(sample) ? sample.find(c => c.handle === handle)?.top_post : undefined
    }
    const missing = topPost('force-noparse', 'wanderwithmei')
    const empty = topPost('force-probe-captions', 'probeempty')
    const text = topPost('force-probe-captions', 'probetext')
    const long = topPost('force-probe-captions', 'probelong')
    named('小样试探：未查询作品明确显示未查询', missing === '（未查询）',
      `top_post 应为「（未查询）」，实际 ${JSON.stringify(missing)}`)
    named('小样试探：已取得作品的空文案仍为空串', empty === '',
      `top_post 应为空串，实际 ${JSON.stringify(empty)}`)
    named('小样试探：有文案时保留第一条而非最高播放', text === 'First caption',
      `top_post 应为第一条文案，实际 ${JSON.stringify(text)}`)
    named('小样试探：文案仅保留前120字符', long === 'a'.repeat(119) + 'B',
      `top_post 应保留第120字符 B、去掉第121字符 C，实际 ${JSON.stringify(long)}`)
    // 入口只读实时搜索，不读盘上旧记录；当前 search 不产生 recent_posts: []。
    // 旧空数组的输出要求因此不能靠此入口的假 HTTP 响应走到，不伪造不可达的生产输入。
    criterion('P1.i')
  }

  // F3.c／F3.d「配置读不出」那一类：文件不存在、文件在但不是合法 JSON。退出码 2 出自 ADR-108 退出契约表
  // （probe 的配置问题退出 2），F3.c 也把它列作以退出码 2 结束的输入问题。读不出就无从说是哪一个字段，
  // 所以问题的措辞不设判据，只要求除了配置路径（和假 fetch 那行接管声明）之外还写着别的 —— 否则只打一个路径
  // 就能让这条绿，而 F3.d 要的是「配置路径与问题本身」。零请求不在 F3.c／F3.d 里，这里不判
  const unreadableDir = join(tmp, 'probe-unreadable')
  mkdirSync(unreadableDir, { recursive: true })
  const brokenCfg = join(unreadableDir, 'broken.json')
  writeFileSync(brokenCfg, '{"market": "US", "budget_usd": 0.5, "tasks": [')
  for (const [what, cfg] of [['文件不存在', join(unreadableDir, 'missing.json')], ['不是合法 JSON', brokenCfg]] as const) {
    const r = runBoth(`probe 配置读不出：${what}`, [S('probe.ts'), '--config', cfg], unreadableDir,
      { status: 2, soft: [0, 1, 3] }, { FAKE_FETCH_NO_429: '1' })
    if (!r.ok) continue
    const leak = probeInputLeak(r.stderr)
    // 「问题本身」：写着配置路径的那一行，去掉路径之后还得剩下字母或数字 —— 只剩一个冒号不算写了问题。
    // 这是对「问题本身与配置路径」的一种读法：路径和问题分两行打的实现会在这里红（独立审阅指出，照需求原文收紧）
    const problem = r.stderr.split('\n').filter(l => l.includes(cfg))
      .some(l => /[\p{L}\p{N}]/u.test(l.split(cfg).join('')))
    named('F3.c：probe 的配置读不出以退出码 2 结束时，stderr 不带异常类名与调用栈',
      r.status === 2 && !leak.className && !leak.frames,
      `${what}：退出码 ${r.status}、带异常类名=${leak.className}、带栈帧=${leak.frames}，stderr 末几行 ${stderrTail(r.stderr)}`
      + ' —— F3.c：配置读不出是输入问题，内部异常的类名与堆栈都不该出现')
    criterion('F3.c')
    named('F3.d：probe 的配置读不出以退出码 2 结束时，stderr 写出配置路径与问题本身',
      r.status === 2 && r.stderr.includes(cfg) && problem,
      `${what}：退出码 ${r.status}、写着配置路径=${r.stderr.includes(cfg)}、路径之外写着问题=${problem}，stderr 末几行 ${stderrTail(r.stderr)}`
      + ' —— F3.d：配置读不出时，stderr 要写出是哪个配置文件、出了什么问题')
    criterion('F3.d')
  }
})

// ---- IG 分页探针：每一种读法各造一次，尤其是最容易被读成假结论的那几种 ----
//
// 这个探针要回答的是「Reels 搜索顺着官方游标翻，到底能不能多拿到人」。
// 它最危险的一支是**链上多出来的人其实是端点自己漂出来的**：这个端点两次完全相同的
// 请求会返回不同条目，所以「翻页有效」与「端点在漂」在只看链那条曲线时**不可区分**，
// 而两种读法的结论正好相反。对照曲线就是为这一条造的（夹具 `force-drift`）。
//
// 另外三种假结论各有一支守着：把「条目在涨」读成「人在涨」（`force-onecreator`）、
// 把「这 N 次之内没再涨」读成「服务端就只有这么多人」、以及把链提前断掉时
// 没发生过的那几次算进结论（`force-paged` 第三页到头）。
//
// ⚠️ 这一组 2026-09-22 整个重写过。上一版守的是「试猜来的参数名」那套三句判词，
// 而那些参数名在官方 spec 里根本不存在（ADR-101 第十、十一节），机器连同判词一起删了。
group('ig-paging-probe', [], () => {
  const P = S('probe-ig-paging.ts')
  // 关掉假 fetch 那个「第 7 次回 429」的定位触发器 —— 探针的请求数随跑数增长，
  // 而它不走 `TikHub.get()`、没有重试，撞上就是整跑中止
  const NO429 = { FAKE_FETCH_NO_429: '1' }
  const probe = (label: string, kw: string, mode?: string, n?: number): any =>
    summaryOf(run(label, mode ? [P, '--keyword', kw, mode, String(n)] : [P, '--keyword', kw],
                  process.cwd(), undefined, NO429) ?? '')

  // ---- 默认模式：只打一次，报形状 ----
  const shape = probe('IG 探针：只打一次，报响应形状', 'smoothie')
  // 2026-09-22 真跑时栽的就是这儿：几个参数的对比全判作废，而响应里躺着一个
  // `data.pagination_token` —— 只读结论那一行的人整个错过了最重要的发现，
  // 而那个键后来正是翻页真正的钥匙。游标那一条与任何对比无关（是对一份响应的直接
  // 观测），所以必须**不分支**地打出来。
  named('响应里有游标时，结论那句话自己要说出来 —— 不许只躺在字段里',
    String(shape.reading ?? '').includes('pagination_token'),
    `reading 里没提响应中的游标键：${JSON.stringify(shape.reading)}`)
  named('只打一次就只发一次请求 —— 看形状不该顺带花钱',
    shape.requests === 1,
    `应当只发 1 次请求，实际 ${JSON.stringify(shape.requests)}`)

  // ---- 链式翻页：服务端真认游标 ----
  // force-paged 带着游标来就回新一批，翻到第三页不再给游标。
  const paged = probe('IG 探针：链 —— 服务端真认游标，第三页到头', 'force-paged', '--chain', 3)
  named('链比对照多拿到人，才判「翻页多拿到了人」',
    paged.chain_cum_creators === 3 && paged.control_cum_creators === 1
      && String(paged.reading ?? '').includes('翻页确实多拿到了人'),
    `链应当 3 人、对照 1 人并判翻页有效，实际 ${JSON.stringify([paged.chain_cum_creators, paged.control_cum_creators])}`)
  // 「服务端不再给游标」是这个工具唯一一个不靠推断的终止条件 —— 它和「这 N 次之内
  // 没再涨」不是一回事，混为一谈就等于把推断说成了对方的原话。
  named('服务端不再给游标就停下，并报出停在第几次',
    paged.chain_stopped_at_call === 3 && String(paged.reading ?? '').includes('是它自己说的'),
    `应当停在第 3 次并说明是服务端自己说的，实际 ${JSON.stringify(paged.chain_stopped_at_call)}`)
  named('链要发够两组 —— 一组链、一组对照，缺了对照这一跑读不出结论',
    paged.requests === 2 * 3,
    `--chain 3 应当发 6 次请求（3 链 ＋ 3 对照），实际 ${JSON.stringify(paged.requests)}`)

  // 链提前断掉时，读法里那个次数必须是**实际跑了几次**，不是要求的次数。
  // 上一版的写法在链不断时两个数恰好相等，所以看不出来 —— 这里特意要 5 次、断在第 3 次。
  const earlyStop = probe('IG 探针：链 —— 要 5 次，服务端第 3 次就不给游标了', 'force-paged', '--chain', 5)
  named('链提前断掉时，读法里报的是实际跑了几次，不是要求的次数',
    earlyStop.chain_stopped_at_call === 3
      && String(earlyStop.reading ?? '').includes('链：3 次累计')
      && !String(earlyStop.reading ?? '').includes('链：5 次累计'),
    `应当停在第 3 次且读法说「链：3 次累计」，实际 ${JSON.stringify([earlyStop.chain_stopped_at_call, earlyStop.reading])}`)
  // 链断在第三次时对照组也只该跑三次。让对照跑满要求的次数，它的采样就比链多，
  // 而这个端点会漂 —— 采样多的一方天然累计更多人，于是「翻页有没有用」会偏向判没用。
  // 这是在本工具最重的那个结论上造**假阴性**。
  named('链提前断掉时对照组跟着变短 —— 采样不等长就是在制造假阴性',
    Array.isArray(earlyStop.control_curve) && earlyStop.control_curve.length === 3
      && earlyStop.requests === 6,
    `对照曲线应当也是 3 行、总请求 6 次，实际 ${JSON.stringify([(earlyStop.control_curve ?? []).length, earlyStop.requests])}`)

  // ---- 链式翻页：端点在漂，链上多出来的人不是游标给的 ----
  // 整组里最关键的一条。force-drift 每次都换一批人、每次都照给游标 ——
  // 只看链那条曲线的话它一路在涨，而对照组涨得一样多。
  const drifting = probe('IG 探针：链 —— 端点在漂，链和对照涨得一样多', 'force-drift', '--chain', 3)
  named('链涨了也不算 —— 要减掉对照组，涨的那些可能全是端点自己在漂',
    drifting.chain_cum_creators === 3 && drifting.control_cum_creators === 3
      && String(drifting.reading ?? '').includes('是**漂**给的，不是翻页给的'),
    `链与对照都该是 3 人且判成漂，实际 ${JSON.stringify([drifting.chain_cum_creators, drifting.control_cum_creators, drifting.reading])}`)

  // ---- 链式翻页：游标收了，但回来的还是同一批（实测 2026-09-22 就是这一支）----
  const ignored = probe('IG 探针：链 —— 游标收下了，回来的还是同一批', 'smoothie', '--chain', 3)
  named('末尾不涨只说得出「这几次之内没再涨」 —— 不许说成「就只有这么多人」',
    ignored.tail_calls_without_new_creator === 2
      && String(ignored.reading ?? '').includes('不可区分'),
    `末尾平段应当是 2 次且结论里带「不可区分」，实际 ${JSON.stringify([ignored.tail_calls_without_new_creator, ignored.reading])}`)

  // ---- 评审第六轮抓到的三条：工具自己在说假话 ----
  // 非 200 撤销本次同额占用，不增加净次数（D13.n）；这不是实际账单断言。
  // 中止那一次真的发出去了，故应分别报告发出 1 次、净次数 0 与费用占用为零。
  const aborted = run('IG 探针：对面拒收时，发出数与净次数分开报',
                      [P, '--keyword', 'force-402'], process.cwd(),
                      { status: 1, stream: 'stderr' }, NO429)
  const abortedText = String(aborted ?? '')
  named('中止时报的「发出几次」是真发出的次数，不是计费次数',
    /发出\s*1\s*次请求/.test(abortedText)
      && /净(?:请求)?次数\s*[:：]?\s*0(?![\d.])/.test(abortedText)
      && /(?:预算|费用|估算)占用(?:估算)?\s*[:：]?\s*\$0(?:\.0+)?(?![\d.])/.test(abortedText),
    `中止诊断应当报告发出 1 次、净次数 0 与费用占用 $0，实际是 ${JSON.stringify(aborted)}`)

  // 「没写这个 flag」与「写了但没给数」必须分开：合起来的话，要了一次链式跑会静默
  // 退化成只发一次请求的形状 dump，而且不报错 —— 用户拿到的东西和他要的不是一回事。
  const noOperand = run('IG 探针：--chain 后面没跟数字',
                        [P, '--keyword', 'smoothie', '--chain'], process.cwd(),
                        { status: 2, stream: 'stderr' }, NO429)
  named('flag 写了却没给数就报错退出 —— 不许静默当成没写过',
    String(noOperand ?? '').includes('--chain 后面要跟一个'),
    `应当因缺少操作数退出并说明，实际是 ${JSON.stringify(noOperand)}`)

  // ---- 原样重发：只量漂移，不碰游标 ----
  const REP = 3
  const oc = probe('IG 探针：照搬 —— 条目一直换，人是同一个', 'force-onecreator', '--repeat', REP)
  named('召回数的是人不是条目 —— 同一个人的多条视频不算多个人',
    oc.cum_creators === 1 && oc.cum_items === 2 * REP,
    `同一个人发的 ${2 * REP} 条应当只算 1 个人，实际 ${JSON.stringify([oc.cum_creators, oc.cum_items])}`)
  // 这一句是整条曲线最贵的那种误读：曲线在涨，而涨的全是同一批人的更多视频。
  // 只把数放进字段里不算 —— 读的人会照着「累计条目」下结论（ADR-73）。
  named('条目在涨而人没涨，结论那句话自己要说出来 —— 不能只躺在字段里',
    String(oc.reading ?? '').includes('条目在涨，人没涨'),
    `结论里没点出「条目涨、人没涨」：${JSON.stringify(oc.reading)}`)
  named('照搬几次就发几次请求 —— 这一支不带任何游标',
    oc.requests === REP && Array.isArray(oc.curve) && oc.curve.length === REP,
    `应当是 ${REP} 次请求与 ${REP} 行曲线，实际 ${JSON.stringify([oc.requests, (oc.curve ?? []).length])}`)
})

// ---- 入口：钱字段比不了大小就不许开跑（P3 · D6.a）----
group('budget-gate', [], () => {
  // 闸门是一句「已花 + 本次开销 > 上限」的比较。两边有一个不是数，这句话恒为假 ——
  // 闸门不是宽了一点，是整条不存在，而且百分比同时恒为 0，连提醒都不出现。
  // 判定在 lib/budget.ts（有变异守着），但**接线在每条入口各一份**，而缺省那个
  // 验证者够不到入口，所以只能由这里真跑一遍。
  // ⚠️ 这几条还没配 `by: "selfcheck"` 的负片 —— 跑是真跑了，但没有第三拍。
  {
    const badProbe = join(tmp, 'probe-badbudget.json')
    writeFileSync(badProbe, JSON.stringify({
      market: 'US', budget_usd: 'abc',
      tasks: [{ keyword: 'k', dimension: 'category', platform: 'tiktok' }],
    }))
    run('probe 上限不是数字 → 停下问人', [S('probe.ts'), '--config', badProbe],
        process.cwd(), { status: 2 })
    // 写了个 null 不等于没写：默认值只给 undefined，null 要被拦下
    const nullProbe = join(tmp, 'probe-nullbudget.json')
    writeFileSync(nullProbe, JSON.stringify({
      market: 'US', budget_usd: null,
      tasks: [{ keyword: 'k', dimension: 'category', platform: 'tiktok' }],
    }))
    run('probe 上限是 null → 也停下问人', [S('probe.ts'), '--config', nullProbe],
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
      done: [], offsets: {}, ...knownCosts(1_000_000, []), requests, created_at: '', updated_at: '',
    })
    mkdirSync(join(tmp, 'badledger'), { recursive: true })
    writeFileSync(join(tmp, 'badledger', 'task.json'), stateOf(null))
    const paidCreator = [{ platform: 'tiktok', handle: 'costgate', nickname: 'Cost gate',
      followers: 10000, post_count: 50, bio: null, bio_links: ['https://example.com'],
      verified: false, profile_url: '', source_keyword: 'k', source_dimension: 'category', fit: '✅' }]
    writeFileSync(join(tmp, 'badledger', 'creators.json'), JSON.stringify(paidCreator))
    writeFileSync(join(tmp, 'badledger', 'creators.raw.json'), JSON.stringify(paidCreator))
    for (const entry of ['collect', 'enrich']) {
      const log = join(tmp, `badledger-${entry}.tsv`)
      const result = runBoth(`${entry} 已知空账却将次数写成 null`,
        [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', 'badledger'], tmp,
        { status: 2, soft: [0, 1, 3] }, { FAKE_FETCH_LEDGER: log })
      if (result.ok) named('坏次数必须指明费用问题并在实际付费前拒绝',
        result.status === 2 && /requests|次数/.test(result.stderr) && fetchAttempts(log).length === 0,
        `${entry}: status=${result.status}, attempts=${fetchAttempts(log).length}, ${result.stderr}`)
    }

    mkdirSync(join(tmp, 'okledger'), { recursive: true })
    writeFileSync(join(tmp, 'okledger', 'task.json'), stateOf(0))
    // 报的必须是**用户打的那个东西**：`3.0.0` 解析成 NaN，照解析结果印是「null」
    const badArg = run('collect 设置的总预算不是数字 → 停下问人',
        [S('collect.ts'), '--resume', 'okledger', '--budget', '3.0.0'], tmp, { status: 2 })
    if (badArg !== undefined && !badArg.includes('3.0.0')) {
      failed++
      console.error('  ✗ 报错里没有出现用户打的那个值，他不知道是哪一处写错了')
    } else if (badArg !== undefined) console.log('  ✓ 报错指名用户打的那个值')
  }
})

// ADR-108：独立进程测试。预期取自原始输入、固定价目及公开输出契约，没有读取生产函数体。
group('cost-input', [], () => {
  const preciseBad = '0.00499999999999999999999999999999999999999'
  for (const entry of ['collect', 'probe']) {
    for (const token of [preciseBad, '9007199254.740992', '1e999', 'null', '"0.005"']) {
      const cwd = join(tmp, `input-${entry}-${token.replace(/[^a-z0-9]/gi, '_')}`)
      mkdirSync(cwd, { recursive: true })
      const cfg = join(cwd, 'config.json'), log = join(cwd, 'attempts.tsv')
      writeFileSync(cfg, `{"product":"input","market":"US","target_count":1,"nested":{"budget_usd":0.005},"budget_usd":${token},"tasks":[{"keyword":"k","dimension":"category","platform":"tiktok"}]}`)
      const result = runBoth(`${entry} 原始金额 ${token}`, [S(`${entry}.ts`), '--config', cfg], cwd,
        { status: 2, soft: [0, 1, 3] }, costEnv(log))
      if (result.ok) named('原始非法预算不能被浮点舍入、嵌套字段或默认值救活',
        result.status === 2 && fetchAttempts(log).length === 0 && /budget|预算|金额/i.test(result.stderr),
        `${entry} token=${token}, status=${result.status}, attempts=${fetchAttempts(log).length}`)
      // F3.c／F3.d「配置不合规」那一类（budget_usd 不合法），只管 probe（collect 不在这两条里）。「初始费用不可用」另有夹具。
      // 问题本身认 `budget_usd` 或「预算／金额」—— 区分大小写，不认裸的 budget：类名 BudgetInputError 本身就含 budget，
      // 不区分大小写的话，这半条会被要禁掉的那个类名满足
      if (result.ok && entry === 'probe') {
        const leak = probeInputLeak(result.stderr)
        const problem = /budget_usd|预算|金额/.test(result.stderr)
        named('F3.c：probe 的 budget_usd 不合法以退出码 2 结束时，stderr 不带异常类名与调用栈',
          result.status === 2 && !leak.className && !leak.frames,
          `token=${token}、退出码 ${result.status}、带异常类名=${leak.className}、带栈帧=${leak.frames}，stderr 末几行 ${stderrTail(result.stderr)}`
          + ' —— F3.c：预算不合法是输入问题，内部异常的类名与堆栈都不该出现')
        criterion('F3.c')
        named('F3.d：probe 的 budget_usd 不合法以退出码 2 结束时，stderr 写出配置路径与问题本身',
          result.status === 2 && result.stderr.includes(cfg) && problem,
          `token=${token}、退出码 ${result.status}、写着配置路径=${result.stderr.includes(cfg)}、写着预算问题=${problem}，stderr 末几行 ${stderrTail(result.stderr)}`
          + ' —— F3.d：预算不合法时，stderr 要写出是哪个配置文件、预算哪里不对')
        criterion('F3.d')
      }
    }
  }
  criterion('D13.a')

  for (const entry of ['collect', 'enrich']) {
    for (const token of ['3.0.0', preciseBad, '9007199254.740992', undefined]) {
      const f = costFixture(`cli-${entry}-${String(token)}`, knownCosts(5000, []),
        { budget_usd: 0.005, done: [] }, [costPerson()])
      const result = runBoth(`${entry} CLI 原始金额 ${String(token)}`,
        [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir, '--budget',
          ...(token === undefined ? [] : [token])], f.cwd,
        { status: 2, soft: [0, 1, 3] }, costEnv(f.log))
      if (result.ok) named('CLI 非法金额保留原输入，缺操作数不能当成未指定',
        result.status === 2 && fetchAttempts(f.log).length === 0
          && result.stderr.includes(token === undefined ? '--budget' : token)
          && jsonFile(f.task)?.cost_ledger?.limit_micro_usd === 5000,
        `${entry} token=${String(token)}, status=${result.status}, stderr=${result.stderr}`)
    }
  }
  criterion('D13.b')

  for (const token of ['0.005', '9007199254.740991']) {
    const cwd = join(tmp, `precise-${token}`)
    mkdirSync(join(cwd, 'memory'), { recursive: true })
    const cfg = join(cwd, 'config.json'), log = join(cwd, 'attempts.tsv')
    // 嵌套坏值放在根之后；有效根值不能被同名嵌套字段污染。
    writeFileSync(cfg, `{"product":"precise","market":"US","target_count":1,"budget_usd":${token},"nested":{"budget_usd":${preciseBad}},"tasks":[{"keyword":"k","dimension":"category","platform":"tiktok"}]}`)
    const result = runBoth(`collect 精确保存 ${token}`, [S('collect.ts'), '--config', cfg], cwd,
      undefined, costEnv(log))
    if (!result.ok) continue
    const taskDir = onlyDir(cwd, 'precise')
    if (!taskDir) { named('精确金额的新任务必须留下断点目录', false, '没有唯一的 precise 目录'); continue }
    const task = join(cwd, taskDir, 'task.json')
    const render = runBoth(`render 精确金额 ${token}`, [S('render.ts'), '--dir', taskDir], cwd,
      undefined, costEnv(log, { TIKHUB_API_KEY: undefined }))
    if (render.ok) {
      named('task、meta 与 stdout 保留最大安全微美元和 0.005 的原数值',
        [fileText(task), fileText(join(cwd, taskDir, 'meta.json')), result.stdout]
          .every(text => rootToken(text, 'budget_usd') === token)
          && fileText(join(cwd, taskDir, 'report.html')).includes(`$${token}`),
        `token=${token}, task=${rootToken(fileText(task), 'budget_usd')}, stdout=${rootToken(result.stdout, 'budget_usd')}`)
      criterion('D13.c')
    }
  }

  for (const entry of ['collect', 'probe']) {
    const cwd = join(tmp, `default-${entry}`)
    mkdirSync(join(cwd, 'memory'), { recursive: true })
    const cfg = join(cwd, 'config.json'), log = join(cwd, 'attempts.tsv')
    writeFileSync(cfg, JSON.stringify({ product: 'default', market: 'US', target_count: 1,
      tasks: [{ keyword: 'default', dimension: 'category', platform: 'tiktok' }] }))
    const result = runBoth(`${entry} 缺席预算声明默认与范围`, [S(`${entry}.ts`), '--config', cfg],
      cwd, undefined, costEnv(log))
    if (result.ok) named('只有新输入预算缺席才使用有范围说明的默认值',
      costViewMatches(summaryOf(result.stdout), { budget_usd: entry === 'collect' ? 2 : 0.5,
        cost_scope: entry === 'collect' ? 'task' : 'process', cost_status: 'known' })
        && /默认/.test(result.stderr) && /任务|进程/.test(result.stderr) && fetchAttempts(log).length > 0,
      `${entry}: ${result.stdout}\n${result.stderr}`)
  }

  // 只给这两个子进程固定时间，保证同配置得到同一目录名。没有修改系统时钟。
  const collision = join(tmp, 'cost-collision')
  mkdirSync(join(collision, 'memory'), { recursive: true })
  const clock = join(collision, 'fixed-time.mjs')
  writeFileSync(clock, `const OriginalDate = Date; globalThis.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : ['2026-01-02T03:04:05.000Z'])); } static now() { return 1767323045000; } };`)
  const cfg = join(collision, 'config.json'), log = join(collision, 'attempts.tsv')
  writeFileSync(cfg, JSON.stringify({ product: 'collision', market: 'US', target_count: 1, budget_usd: 0.001,
    tasks: [{ keyword: 'collision', dimension: 'category', platform: 'tiktok' }] }))
  const extra = costEnv(log, { NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(clock).href)}` })
  const first = runBoth('同目录第一次新建', [S('collect.ts'), '--config', cfg], collision, { status: 3 }, extra)
  if (first.ok) {
    const taskDir = onlyDir(collision, 'collision'), beforeAttempts = fetchAttempts(log).length
    const task = taskDir ? join(collision, taskDir, 'task.json') : ''
    const before = fileText(task)
    const second = runBoth('同目录第二次新建必须拒绝', [S('collect.ts'), '--config', cfg], collision,
      { status: 2, soft: [0, 1, 3] }, extra)
    if (second.ok) {
      named('再次 config 不能覆盖已有任务、归零账目或重发请求',
        second.status === 2 && before !== '' && fileText(task) === before
          && fetchAttempts(log).length === beforeAttempts && /resume/.test(second.stderr),
        `status=${second.status}, attempts=${beforeAttempts}→${fetchAttempts(log).length}`)
      criterion('D13.d')
    }
  }
  const missingJson = join(tmp, 'cost-no-raw-json')
  mkdirSync(missingJson, { recursive: true })
  const noRaw = join(missingJson, 'no-raw-json.mjs'), noRawConfig = join(missingJson, 'config.json')
  writeFileSync(noRaw, 'JSON.rawJSON = undefined; console.error("[test-json-capability-disabled]");')
  writeFileSync(noRawConfig, '{"product":"nojson","market":"US","target_count":1,"budget_usd":0.005,"tasks":[{"keyword":"k","dimension":"category","platform":"tiktok"}]}')
  const noRawLog = join(missingJson, 'attempts.tsv')
  const noRawRun = runBoth('缺少精确 JSON 写出能力不得降级付费', [S('collect.ts'), '--config', noRawConfig], missingJson,
    { status: 2, soft: [0, 1, 3] }, costEnv(noRawLog, {
      NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(noRaw).href)}`,
    }))
  if (noRawRun.ok) named('精确 JSON 能力缺失确实被注入，且没有浮点降级或真实请求',
    noRawRun.status === 2 && noRawRun.stderr.includes('[test-json-capability-disabled]')
      && fetchAttempts(noRawLog).length === 0 && /JSON|精确/.test(noRawRun.stderr),
    `status=${noRawRun.status}, attempts=${fetchAttempts(noRawLog).length}`)
  // F3.c／F3.d「初始费用不可用」那一类：同一份注入（运行时没有精确 JSON 写出能力），换 probe 跑。
  // 问题本身沿用上面那条对同一情形的判据（/JSON|精确/，区分大小写 —— 注入标记那行是小写的 json，不会顺带满足）
  const noRawProbeCfg = join(missingJson, 'probe.json')
  writeFileSync(noRawProbeCfg, '{"market":"US","budget_usd":0.5,"tasks":[{"keyword":"k","dimension":"category","platform":"tiktok"}]}')
  const noRawProbe = runBoth('probe 缺少精确 JSON 写出能力', [S('probe.ts'), '--config', noRawProbeCfg], missingJson,
    { status: 2, soft: [0, 1, 3] }, costEnv(join(missingJson, 'probe-attempts.tsv'), {
      NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(noRaw).href)}`,
    }))
  if (noRawProbe.ok) {
    const leak = probeInputLeak(noRawProbe.stderr)
    const problem = /JSON|精确/.test(noRawProbe.stderr.split('\n')
      .filter(l => !l.startsWith('[fake-fetch]') && !l.includes('[test-json-capability-disabled]'))
      .join('\n').split(noRawProbeCfg).join(''))
    const injected = noRawProbe.stderr.includes('[test-json-capability-disabled]')
    named('F3.c：probe 的初始费用不可用以退出码 2 结束时，stderr 不带异常类名与调用栈',
      noRawProbe.status === 2 && injected && !leak.className && !leak.frames,
      `退出码 ${noRawProbe.status}、注入生效=${injected}、带异常类名=${leak.className}、带栈帧=${leak.frames}，stderr 末几行 ${stderrTail(noRawProbe.stderr)}`
      + ' —— F3.c：初始费用不可用是输入问题，内部异常的类名与堆栈都不该出现')
    criterion('F3.c')
    named('F3.d：probe 的初始费用不可用以退出码 2 结束时，stderr 写出配置路径与问题本身',
      noRawProbe.status === 2 && injected && noRawProbe.stderr.includes(noRawProbeCfg) && problem,
      `退出码 ${noRawProbe.status}、注入生效=${injected}、写着配置路径=${noRawProbe.stderr.includes(noRawProbeCfg)}、写着问题=${problem}，stderr 末几行 ${stderrTail(noRawProbe.stderr)}`
      + ' —— F3.d：初始费用不可用时，stderr 要写出是哪个配置文件、出了什么问题')
    criterion('F3.d')
  }
})

group('cost-local', [], () => {
  const pending = { endpoint: TT_PROFILE, price_version: COST_VERSION, unit_micro_usd: 1000, attempt_id: 3 }
  const badPrice = knownCosts(1_000_000, [costEntry(TT_SEARCH, 1001, 1)])
  const unknownVersion = knownCosts(1_000_000, [costEntry(TT_SEARCH, 1000, 1)])
  unknownVersion.cost_ledger.entries[0].price_version = 'unknown-version'
  const cases: { name: string; costs: Record<string, unknown>; status: string }[] = [
    { name: 'unknown-zero', costs: { requests: 0 }, status: 'unknown-history' },
    { name: 'unknown-positive', costs: { requests: 7 }, status: 'unknown-history' },
    { name: 'unknown-invalid-count', costs: { requests: null }, status: 'unknown-history' },
    { name: 'invalid-price', costs: badPrice, status: 'invalid-ledger' },
    { name: 'unknown-version', costs: unknownVersion, status: 'unavailable-evidence' },
    { name: 'pending', costs: knownCosts(1_000_000,
      [costEntry(TT_SEARCH, 1000, 1), costEntry(IG_REELS, 2000, 0, 1)], pending), status: 'known' },
  ]
  for (const scenario of cases) for (const entry of ['collect', 'enrich', 'render']) {
    // requests=0 的未知 collect/render 最小交点由独立需求测试进程认领；这里保留其余矩阵。
    if (scenario.name === 'unknown-zero' && entry !== 'enrich') continue
    const people = entry === 'enrich'
      ? [costPerson('tiktok', 'cached'), costPerson('instagram', 'private', { is_private: true })]
      : [costPerson()]
    const f = costFixture(`local-${scenario.name}-${entry}`, scenario.costs, {}, people)
    if (entry === 'enrich') writeFileSync(join(f.taskDir, 'enrichment.json'), JSON.stringify({
      version: 1, updated_at: '2026-01-01T00:00:00.000Z', accounts: {
        'tiktok:cached': { platform: 'tiktok', handle: 'cached', followers: 10000, following: 100,
          sample: { status: 'measured', value: Array.from({ length: 6 }, (_, i) => ({
            id: `cached-${i}`, views: 1000 + i, likes: 20, comments: 1,
            published_at: `2026-01-0${i + 1}T00:00:00.000Z`, is_pinned: false })),
          source: { kind: 'public_api', provider: 'tikhub', endpoint: TT_POSTS },
          observed_at: '2026-01-07T00:00:00.000Z', sample_size: 6, basis: 'cached six posts' } },
      },
    }))
    const before = jsonFile(f.task)
    const result = runBoth(`${entry} 本地处理 ${scenario.name}`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir], f.cwd,
      { status: 0, soft: [1, 2, 3] }, costEnv(f.log, { TIKHUB_API_KEY: undefined }))
    if (!result.ok) continue
    const after = jsonFile(f.task)
    named('历史费用不可用和恢复 pending 不阻止三个本地入口，缺 key 仍零请求',
      result.status === 0 && fetchAttempts(f.log).length === 0,
      `${entry}/${scenario.name}: status=${result.status}, attempts=${JSON.stringify(fetchAttempts(f.log))}`)
    named('本地保存不新建、修复或结算原费用记录',
      after !== undefined && ['cost_ledger', 'requests', 'budget_usd'].every(key =>
        Object.hasOwn(before, key) === Object.hasOwn(after, key)
          && JSON.stringify(before[key]) === JSON.stringify(after[key])),
      `${entry}/${scenario.name}: before=${JSON.stringify(scenario.costs)}, after=${JSON.stringify(after?.cost_ledger)}`)
    const view = entry === 'render' ? jsonFile(join(f.taskDir, 'meta.json')) : summaryOf(result.stdout)
    const expected = scenario.status === 'known'
      ? { cost_status: 'known', requests: 2, cost_estimate_usd: 0.004, cost_http_200_usd: 0.001,
          cost_unknown_result_usd: 0.002, cost_pending_usd: 0.001, cost_price_versions: [COST_VERSION], cost_scope: 'task' }
      : { cost_status: scenario.status, requests: scenario.costs.requests, cost_estimate_usd: null,
          budget_usd: 1, cost_scope: null, cost_http_200_usd: null,
          cost_unknown_result_usd: null, cost_pending_usd: null, cost_price_versions: [] }
    named('本地费用输出区分未知、损坏、未知版本和三种已知金额',
      costViewMatches(view, expected) && (scenario.status === 'known'
        ? view.cost_problems.length === 0 : view.cost_problems.length > 0),
      `${entry}/${scenario.name}: ${JSON.stringify(view)}`)
    if (entry === 'enrich') {
      const accounts = jsonFile(join(f.taskDir, 'enrichment.json'))?.accounts
      named('离线 enrich 真正完成缓存重算和私密账号记录',
        accounts?.['tiktok:cached']?.metrics?.median_views?.status === 'measured'
          && accounts?.['instagram:private']?.sample?.status === 'unavailable'
          && accounts?.['instagram:private']?.sample?.reason === 'private_account',
        JSON.stringify(accounts))
    }
    if (entry === 'render') {
      const html = fileText(join(f.taskDir, 'report.html'))
      named('HTML 的未知金额没有伪造零费用，已知保守留存与未结额分别可见',
        html !== '' && (scenario.status === 'known'
          ? html.includes('$0.004') && html.includes('$0.002') && html.includes('$0.001')
            && /结果不明|保守/.test(html) && /未结|预留/.test(html)
          : !/\$null|\$0(?:\.0+)?(?=[\s<／/])|已用[^<\n]*0%/.test(html)
            && /无从确认|未知|不可用|损坏|invalid-ledger|unavailable-evidence/.test(html)),
        `${scenario.name}: report length=${html.length}`)
    }
  }
  criterion('D13.f', 'D13.g', 'D13.h', 'D13.r')

  // 即使旧根预算本身非法，纯本地写回也不能先 JSON.parse 再把它舍入或变成 null。
  for (const entry of ['collect', 'enrich']) for (const token of [
    '0.00499999999999999999999999999999999999999', '1e999', 'null', '"old-budget"', undefined,
  ]) {
    const f = costFixture(`raw-${entry}-${String(token)}`, { requests: 0 })
    const before = fileText(f.task).replace('"budget_usd":1,', token === undefined ? '' : `"budget_usd":${token},`)
    writeFileSync(f.task, before)
    const result = runBoth(`${entry} 原样保留历史预算 ${String(token)}`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir], f.cwd,
      { status: 0, soft: [1, 2, 3] }, costEnv(f.log, { TIKHUB_API_KEY: undefined }))
    if (result.ok) named('未知费用本地写回保留原预算 token，缺席不制造字段',
      result.status === 0 && fetchAttempts(f.log).length === 0
        && rootToken(fileText(f.task), 'budget_usd') === token
        && !Object.hasOwn(jsonFile(f.task) ?? {}, 'cost_ledger'),
      `${entry}/${String(token)}: status=${result.status}, saved=${rootToken(fileText(f.task), 'budget_usd')}`)
  }
  // 根预算类型非法也不是丢弃原始数字的理由；容器里的数字必须直接取 source token。
  for (const entry of ['collect', 'enrich']) for (const [shape, raw, keys] of [
    ['object', '{"overflow":1e400,"integer":9007199254740993,"fraction":0.99999999999999999}', ['overflow', 'integer', 'fraction']],
    ['array', '[1e400,9007199254740993,0.99999999999999999]', ['0', '1', '2']],
  ] as const) {
    const f = costFixture(`raw-${entry}-${shape}`, { requests: 0 })
    writeFileSync(f.task, fileText(f.task).replace('"budget_usd":1,', `"budget_usd":${raw},`))
    const result = runBoth(`${entry} 原样保留非法${shape}预算中的数字`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir], f.cwd,
      { status: 0, soft: [1, 2, 3] }, costEnv(f.log, { TIKHUB_API_KEY: undefined }))
    if (!result.ok) continue
    const after = jsonFile(f.task), saved = fileText(f.task)
    const tokens = keys.map(key => rootToken(saved, key, ['budget_usd']))
    named('非法对象或数组预算的零请求写回保留内部原数字，不新造费用账',
      result.status === 0 && fetchAttempts(f.log).length === 0 && after !== undefined
        && after.requests === 0 && !Object.hasOwn(after, 'cost_ledger')
        && JSON.stringify(tokens) === JSON.stringify(['1e400', '9007199254740993', '0.99999999999999999']),
      `${entry}/${shape}: status=${result.status}, saved tokens=${JSON.stringify(tokens)}`)
  }
  criterion('D13.i')
})

group('cost-resume', [], () => {
  // IG 的一页历史也会被页数上限挡住，不能单独证明 done 生效。再放一个只抓过
  // 一页的已完成 TT：它尚未达四页上限、目标也未达标，只有 done 应让它退出调度。
  // 历史共占 0.003，剩余 0.001 只够未完成 TT 搜一次；按任务下标区分两条 TT 的痕迹。
  const skipped = costFixture('done-skipped', knownCosts(4000, [
    costEntry(IG_REELS, 2000, 1), costEntry(TT_SEARCH, 1000, 1),
  ]), {
    budget_usd: 0.004, tasks: [
      { keyword: 'already-done', dimension: 'scene', platform: 'instagram' },
      { keyword: 'already-done-tt', dimension: 'scene', platform: 'tiktok' },
      { keyword: 'still-pending', dimension: 'category', platform: 'tiktok' },
    ], done: [0, 1], offsets: { 0: 5, 1: 5 }, pages: { 0: 1, 1: 1 },
    answered: { 0: 1, 1: 1 }, found: { 0: 2, 1: 3 },
  })
  const skippedRun = runBoth('续跑跳过 done 中的任务', [S('collect.ts'), '--resume', skipped.taskDir], skipped.cwd,
    { status: 3 }, costEnv(skipped.log))
  if (skippedRun.ok) {
    const state = jsonFile(skipped.task)
    named('续跑已完成 IG 不重搜，未完成 TT 确实发出请求',
      JSON.stringify(fetchAttempts(skipped.log)) === JSON.stringify([`200\t${TT_SEARCH}`])
        && state?.done?.includes(0) && state?.done?.includes(1)
        && state?.answered?.[0] === 1 && state?.answered?.[1] === 1 && state?.answered?.[2] === 1
        && state?.requests === 3,
      `attempts=${JSON.stringify(fetchAttempts(skipped.log))}, task=${JSON.stringify(state)}`)
    // 期望出自 D6.n 原文「done 数组中的索引被跳过」：跳过就是不再经手，不会被再记一次完成。
    named('续跑不把 done 里已有的任务再记一遍',
      Array.isArray(state?.done) && new Set(state.done).size === state.done.length,
      `盘上 done=${JSON.stringify(state?.done)} —— 同一个下标出现两次，说明已完成的任务又被调度了一遍`)
    criterion('D6.n')
  }
  const bad = knownCosts(5000, [costEntry(TT_SEARCH, 1001, 1)])
  const missingVersion = knownCosts(5000, [costEntry(TT_SEARCH, 1000, 1)])
  missingVersion.cost_ledger.entries[0].price_version = 'unverified'
  const pending = knownCosts(5000, [], {
    endpoint: TT_SEARCH, price_version: COST_VERSION, unit_micro_usd: 1000, attempt_id: 1,
  })
  for (const entry of ['collect', 'enrich']) for (const [kind, costs] of [
    ['missing', { requests: 0 }], ['bad-price', bad], ['unknown-version', missingVersion], ['pending', pending],
  ] as const) for (const change of [false, true]) {
    if (entry === 'collect' && kind === 'missing' && !change) continue
    const f = costFixture(`blocked-${entry}-${kind}-${change}`, costs,
      { budget_usd: 0.005, done: [], offsets: {}, pages: {}, answered: {}, found: {} }, [costPerson()])
    const before = jsonFile(f.task)
    const result = runBoth(`${entry} ${kind} ${change ? '不能借改额恢复' : '首次付费拒绝'}`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir,
        ...(change ? ['--budget', '0.006'] : [])], f.cwd,
      { status: 2, soft: [0, 1, 3] }, costEnv(f.log))
    if (result.ok) {
      const after = jsonFile(f.task)
      named('历史未知、坏价、未知版本和恢复 pending 都在付费前拒绝，改额不能洗白',
        result.status === 2 && fetchAttempts(f.log).length === 0 && after !== undefined
          && ['cost_ledger', 'budget_usd', 'requests', 'done', 'pages', 'answered', 'found'].every(key =>
            JSON.stringify(after[key]) === JSON.stringify(before[key]))
          && /费用|预算|pending|价目|未结/.test(result.stderr),
        `${entry}/${kind}/${change}: status=${result.status}, attempts=${JSON.stringify(fetchAttempts(f.log))}`)
    }
  }
  criterion('D13.e')

  const history = [costEntry(TT_PROFILE, 1000, 1), costEntry(IG_REELS, 2000, 0, 1)]
  for (const entry of ['collect', 'enrich']) {
    const f = costFixture(`conflict-${entry}`, knownCosts(5000, structuredClone(history)),
      { budget_usd: 0.007, done: [], offsets: {}, pages: {}, answered: {}, found: {} },
      Array.from({ length: 4 }, (_, i) => costPerson('tiktok', `resume-${i}`)))
    const before = jsonFile(f.task)
    const denied = runBoth(`${entry} 根预算冲突禁止付费`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir], f.cwd,
      { status: 2, soft: [0, 1, 3] }, costEnv(f.log))
    if (!denied.ok) continue
    named('根预算冲突不静默选择一份，也不发出新请求',
      denied.status === 2 && fetchAttempts(f.log).length === 0
        && jsonFile(f.task)?.budget_usd === before.budget_usd
        && JSON.stringify(jsonFile(f.task)?.cost_ledger) === JSON.stringify(before.cost_ledger),
      `${entry}: status=${denied.status}, attempts=${fetchAttempts(f.log).length}`)
    const rendered = runBoth(`${entry} 冲突仍可离线导出`, [S('render.ts'), '--dir', f.taskDir], f.cwd,
      undefined, costEnv(f.log, { TIKHUB_API_KEY: undefined }))
    if (rendered.ok) {
      const view = jsonFile(join(f.taskDir, 'meta.json'))
      named('根预算冲突整体 invalid-ledger，金额与 scope 全 null 且保留合法次数',
        costViewMatches(view, { cost_status: 'invalid-ledger', requests: 2, cost_scope: null,
          cost_price_versions: [], ...Object.fromEntries(moneyFields.map(k => [k, null])) })
          && view.cost_problems.some((p: any) => p.path === 'budget_usd' && p.reason.length > 0),
        `${entry}: ${JSON.stringify(view)}`)
    }
    // 在真正 fetch 的观察点读取磁盘，证实改额先保存了两份一致上限。
    const observer = join(f.cwd, 'observe-saved-limit.mjs'), snapshots = join(f.cwd, 'at-fetch.jsonl')
    writeFileSync(observer, `import { readFileSync, appendFileSync } from 'node:fs'; const previous = globalThis.fetch; globalThis.fetch = async (...args) => { appendFileSync(${JSON.stringify(snapshots)}, readFileSync(${JSON.stringify(f.task)}, 'utf8').replace(/\\n/g, '') + '\\n'); return previous(...args); };`)
    const changed = runBoth(`${entry} 显式设置总额修正冲突`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir, '--budget', '0.006'], f.cwd,
      { status: 3, soft: [0, 1, 2] }, costEnv(f.log, {
        NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(observer).href)}`,
      }))
    if (!changed.ok) continue
    const after = jsonFile(f.task), atFetch = fileText(snapshots).split('\n').filter(Boolean).map(summaryOf)
    named('显式预算替换总上限，保存一致后才请求，历史混价费用保持连续',
      changed.status === 3 && fetchAttempts(f.log).length === 3 && atFetch.length === 3
        && atFetch.every(s => s.budget_usd === 0.006 && s.cost_ledger?.limit_micro_usd === 6000)
        && after?.budget_usd === 0.006 && after?.cost_ledger?.limit_micro_usd === 6000
        && after?.requests === 5 && after?.cost_ledger?.next_attempt_id === 6
        && history.every(old => after.cost_ledger.entries.some((e: any) =>
          JSON.stringify(e) === JSON.stringify(old)))
        && costViewMatches(summaryOf(changed.stdout), { requests: 5, cost_estimate_usd: 0.006,
          cost_http_200_usd: 0.004, cost_unknown_result_usd: 0.002, cost_pending_usd: 0,
          budget_usd: 0.006, cost_status: 'known', cost_scope: 'task' }),
      `${entry}: status=${changed.status}, attempts=${fetchAttempts(f.log).length}, summary=${changed.stdout}`)
  }
  criterion('D13.j', 'D13.k', 'D6.o')

  for (const entry of ['collect', 'enrich']) for (const limit of ['0.003', '0.002']) {
    const f = costFixture(`lower-${entry}-${limit}`, knownCosts(5000, structuredClone(history)),
      { budget_usd: 0.005, done: [] }, [costPerson()])
    const before = jsonFile(f.task)
    const wanted = limit === '0.003' ? 3 : 2
    const result = runBoth(`${entry} 降额 ${limit}`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir, '--budget', limit], f.cwd,
      { status: wanted, soft: [0, 1, 2, 3].filter(n => n !== wanted) }, costEnv(f.log))
    if (result.ok) {
      const after = jsonFile(f.task)
      named('总上限可降到占用，低于占用拒绝且不写半份上限',
        result.status === wanted && fetchAttempts(f.log).length === 0 && after?.requests === 2
          && after?.budget_usd === (limit === '0.003' ? 0.003 : before.budget_usd)
          && after?.cost_ledger?.limit_micro_usd === (limit === '0.003' ? 3000 : 5000)
          && after?.cost_ledger?.next_attempt_id === before.cost_ledger.next_attempt_id
          && JSON.stringify(after?.cost_ledger?.entries) === JSON.stringify(history),
        `${entry}/${limit}: status=${result.status}, task=${JSON.stringify(after)}`)
    }
  }
  const reminders = costFixture('restored-thresholds', knownCosts(10000, [costEntry(TT_PROFILE, 1000, 8)]),
    { budget_usd: 0.01, done: [], offsets: {}, pages: {}, answered: {}, found: {} })
  const reminded = runBoth('恢复已过两条提醒线的费用账', [S('collect.ts'), '--resume', reminders.taskDir],
    reminders.cwd, { status: 3 }, costEnv(reminders.log))
  if (reminded.ok) named('恢复已过80%的任务在首个成功预留后提醒两次，后续预留不重复提醒',
    warnLines(reminded.stderr) === 2 && fetchAttempts(reminders.log).length === 2
      && summaryOf(reminded.stdout).cost_estimate_usd === 0.01,
    `提醒=${warnLines(reminded.stderr)}, attempts=${fetchAttempts(reminders.log).length}, stderr=${reminded.stderr}`)
})

group('cost-http', [], () => {
  for (const fault of ['bad-json-200', 'bad-body-201', 'bad-body-204', 'bad-body-429', 'bad-body-500', 'no-http-status']) {
    const cwd = join(tmp, `http-${fault}`)
    mkdirSync(join(cwd, 'memory'), { recursive: true })
    const cfg = join(cwd, 'config.json'), log = join(cwd, 'attempts.tsv')
    writeFileSync(cfg, JSON.stringify({ product: 'http', market: 'US', target_count: 9999, budget_usd: 0.001,
      tasks: [{ keyword: 'http', dimension: 'category', platform: 'tiktok' }] }))
    // 不额外定义供应商重试策略。若既有策略重试，下一次为200且恰好占满额度。
    // 费用 oracle 只读真正发出的响应序列：非200为零、200/无状态各保留1000。
    const result = runBoth(`collect HTTP 结算 ${fault}`, [S('collect.ts'), '--config', cfg], cwd,
      { status: 1, soft: [0, 2, 3] }, costEnv(log, {
        FAKE_FETCH_FAULT_PATH: TT_SEARCH, FAKE_FETCH_FAULT: fault,
      }))
    if (!result.ok) continue
    const taskDir = onlyDir(cwd, 'http'), task = taskDir ? jsonFile(join(cwd, taskDir, 'task.json')) : undefined
    const rows = fetchAttempts(log)
    const unknown = fault === 'no-http-status'
    const firstStatus = unknown ? 'NO_HTTP_STATUS' : fault === 'bad-json-200' ? '200' : fault.slice('bad-body-'.length)
    const http200 = rows.filter(row => row === `200\t${TT_SEARCH}`).length
    const retained = http200 + (unknown ? 1 : 0)
    named('HTTP 故障确实发生在指定搜索端点，退款重试各自独立预检',
      rows[0] === `${firstStatus}\t${TT_SEARCH}` && rows.length >= 1 && rows.length <= 2
        && rows.slice(1).every(row => row === `200\t${TT_SEARCH}`) && retained <= 1
        && (rows.length === 2 ? result.status === 3 : result.status === 1),
      `${fault}: status=${result.status}, attempts=${JSON.stringify(rows)}`)
    const view = summaryOf(result.stdout)
    named('HTTP 200 坏正文仍留存，非 200 坏正文撤销，无状态单列保守占用并保存',
      task !== undefined && costViewMatches(view, {
        requests: retained, budget_usd: 0.001, cost_estimate_usd: retained * 0.001,
        cost_http_200_usd: http200 * 0.001, cost_unknown_result_usd: unknown ? 0.001 : 0,
        cost_pending_usd: 0, cost_status: 'known', cost_scope: 'task', cost_price_versions: retained ? [COST_VERSION] : [],
      }) && task.requests === view.requests && !Object.hasOwn(task.cost_ledger ?? {}, 'pending')
        && task.cost_ledger?.entries?.reduce((sum: number, e: any) => sum
          + (e.http_200_count + e.unknown_result_count) * e.unit_micro_usd, 0) === retained * 1000
        && (retained === 0 ? task.answered?.[0] === undefined && task.found?.[0] === undefined
          : task.answered?.[0] === 1 && (rows.length === 2 || task.found?.[0] === null)),
      `${fault}: summary=${result.stdout}, task=${JSON.stringify(task)}`)
  }
  criterion('D13.m', 'D13.n', 'D13.o', 'D6.s')

  // IG profile 无关键词；第一次500退款后 v2 正常返回，只保留 v2 的 0.001。
  const profile = costFixture('profile-fallback', knownCosts(1000, []), { budget_usd: 0.001 },
    [costPerson('instagram', 'profile-fallback', { bio: undefined, bio_links: [] })])
  const profileRun = runBoth('collect IG profile 一次故障后换 v2',
    [S('collect.ts'), '--resume', profile.taskDir], profile.cwd, undefined, costEnv(profile.log, {
      FAKE_FETCH_FAULT_PATH: IG_PROFILE, FAKE_FETCH_FAULT: 'bad-body-500',
    }))
  if (profileRun.ok) named('profile fallback 两次实际端点分别计价，非 200 不占后续额度',
    JSON.stringify(fetchAttempts(profile.log)) === JSON.stringify([`500\t${IG_PROFILE}`, `200\t${IG_PROFILE_V2}`])
      && costViewMatches(summaryOf(profileRun.stdout), { requests: 1, cost_estimate_usd: 0.001,
        cost_http_200_usd: 0.001, cost_unknown_result_usd: 0, cost_pending_usd: 0 }),
    `attempts=${JSON.stringify(fetchAttempts(profile.log))}, summary=${profileRun.stdout}`)

  // probe 普通错误仍输出部分结果；费用不足也保留既有成功结果且退出0。
  const probeCwd = join(tmp, 'cost-probe')
  mkdirSync(probeCwd, { recursive: true })
  const probeCfg = join(probeCwd, 'config.json'), probeLog = join(probeCwd, 'attempts.tsv')
  writeFileSync(probeCfg, JSON.stringify({ market: 'US', budget_usd: 0.003, tasks: [
    { keyword: 'first', dimension: 'category', platform: 'instagram' },
    { keyword: 'second', dimension: 'scene', platform: 'instagram' },
  ] }))
  const probe = runBoth('probe 余额不够下一次仍输出部分结果', [S('probe.ts'), '--config', probeCfg], probeCwd,
    { status: 0, soft: [1, 2, 3] }, costEnv(probeLog))
  if (probe.ok) named('probe 预算不足退出0且保留一次 IG 成果，不把三分之二说成100%',
    probe.status === 0 && JSON.stringify(fetchAttempts(probeLog)) === JSON.stringify([`200\t${IG_REELS}`])
      && costViewMatches(summaryOf(probe.stdout), { cost_status: 'known', cost_scope: 'process',
        requests: 1, budget_usd: 0.003, cost_estimate_usd: 0.002, cost_http_200_usd: 0.002,
        cost_unknown_result_usd: 0, cost_pending_usd: 0 })
      && summaryOf(probe.stdout).results?.some((r: any) => r.keyword === 'first' && !r.error)
      && !/已用[^\n]*100%/.test(probe.stderr),
    `status=${probe.status}, stdout=${probe.stdout}, stderr=${probe.stderr}`)

  for (const fault of ['bad-json-200', 'bad-body-201', 'bad-body-204', 'bad-body-429', 'bad-body-500', 'no-http-status']) {
    const log = join(tmp, `direct-${fault}.tsv`)
    const direct = runBoth(`直接探针错误 ${fault}`, [S('probe-ig-paging.ts'), '--keyword', 'cost-fault'], tmp,
      { status: 1, soft: [0, 2, 3] }, costEnv(log, { FAKE_FETCH_FAULT_PATH: IG_REELS, FAKE_FETCH_FAULT: fault }))
    if (direct.ok) named('直接分页探针非 200、坏正文与无状态均中止且不输出成功 JSON',
      direct.status === 1 && fetchAttempts(log).length === 1 && direct.stdout.trim() === '',
      `${fault}: status=${direct.status}, attempts=${JSON.stringify(fetchAttempts(log))}, stdout=${direct.stdout}`)
  }
  const directLog = join(tmp, 'direct-known.tsv')
  const direct = runBoth('直接探针已知费用出口', [S('probe-ig-paging.ts'), '--keyword', 'cost-known'], tmp,
    undefined, costEnv(directLog))
  if (direct.ok) named('直接探针固定进程上限1，一次 Reels 的费用为0.002',
    costViewMatches(summaryOf(direct.stdout), { requests: 1, cost_estimate_usd: 0.002, budget_usd: 1,
      cost_http_200_usd: 0.002, cost_unknown_result_usd: 0, cost_pending_usd: 0,
      cost_status: 'known', cost_scope: 'process', cost_price_versions: [COST_VERSION] })
      && JSON.stringify(fetchAttempts(directLog)) === JSON.stringify([`200\t${IG_REELS}`]),
    direct.stdout)
  criterion('D13.l', 'D13.q', 'F7.d')
})

// ADR-109：独立作者只读需求、费用公开形状及测试设施；未读生产函数体。
group('discovery', [], () => {
  // D15/ADR-110：期望取自三条公开路径及五字段契约，不读取适配或输出实现。
  const tasks = [
    { keyword: '#Source', dimension: 'category', platform: 'tiktok', as_hashtag: true },
    { keyword: 'reel-source', dimension: 'scene', platform: 'instagram', as_hashtag: true },
    { keyword: 'force-empty-reels', dimension: 'audience', platform: 'instagram' },
  ]
  const endpoints = [TT_SEARCH, IG_REELS, IG_USERS]
  const source = (i: number, handle: string) => ({ platform: tasks[i].platform, handle,
    keyword: tasks[i].keyword, dimension: tasks[i].dimension, endpoint: endpoints[i] })
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v
  const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
  const f = costFixture('discovery', knownCosts(50000, []), { budget_usd: 0.05, target_count: 1,
    tasks, done: [], offsets: {}, pages: {}, answered: {}, found: {} },
    ['techwithsarah', 'powerbankdeals', 'mysteryuser'].map(h => costPerson('tiktok', h)).concat(
      ['techwithsarah', 'privateaccount', 'wanderwithmei'].map(h => costPerson('instagram', h))))
  const config = join(f.cwd, 'probe.json')
  writeFileSync(config, JSON.stringify({ market: 'US', budget_usd: 0.05, tasks }))
  const probeLog = join(f.cwd, 'probe.tsv')
  const probed = runBoth('发现来源 probe 三路', [S('probe.ts'), '--config', config], f.cwd, undefined, costEnv(probeLog))
  if (probed.ok) {
    const view = summaryOf(probed.stdout), rows = view.results
    named('probe 原样保留三路账号的五字段实际来源，hashtag配置不改端点',
      Array.isArray(rows) && rows.length === 3 && rows.every((r: any, i: number) =>
        Array.isArray(r.sample) && r.sample.length > 0 && r.sample.every((c: any) =>
          equal(c.discovery_sources, [source(i, c.handle)]))), probed.stdout)
    named('发现来源不增加probe请求或改变原路线费用',
      equal(fetchAttempts(probeLog), [`200\t${TT_SEARCH}`, `200\t${IG_REELS}`, `200\t${IG_REELS}`, `200\t${IG_USERS}`])
        && view.requests === 4 && view.cost_estimate_usd === 0.007, probed.stdout)
  }
  const emptyCfg = join(f.cwd, 'empty.json')
  writeFileSync(emptyCfg, JSON.stringify({ market: 'US', tasks: [
    { keyword: 'force-discovery-zero', dimension: 'category', platform: 'instagram' },
    { keyword: 'force-402-source', dimension: 'scene', platform: 'tiktok' },
  ] }))
  const empty = runBoth('发现来源 空结果及错误', [S('probe.ts'), '--config', emptyCfg], f.cwd, undefined,
    costEnv(join(f.cwd, 'empty.tsv')))
  if (empty.ok) named('零账号与请求错误不制造账号发现来源',
    summaryOf(empty.stdout).results?.[0]?.sample?.length === 0
      && Boolean(summaryOf(empty.stdout).results?.[1]?.error)
      && !empty.stdout.includes('discovery_sources'), empty.stdout)
  const collected = runBoth('发现来源 collect 保存', [S('collect.ts'), '--resume', f.taskDir], f.cwd, undefined, costEnv(f.log))
  if (collected.ok) {
    const raw = jsonFile(join(f.taskDir, 'creators.raw.json')), delivery = jsonFile(join(f.taskDir, 'creators.json'))
    named('三路来源进入raw，空Reels后的账号只有users来源',
      Array.isArray(raw) && raw.length === 6 && raw.every((c: any) =>
        equal(c.discovery_sources, [source(c.platform === 'tiktok' ? 0 : c.handle === 'wanderwithmei' ? 2 : 1, c.handle)])),
      JSON.stringify(raw))
    named('交付JSON合并账号后保留双方真实来源与原账号', Array.isArray(delivery)
      && equal(delivery.find((c: any) => c.handle === 'techwithsarah')?.discovery_sources,
        [source(0, 'techwithsarah'), source(1, 'techwithsarah')])
      && equal(delivery.find((c: any) => c.handle === 'wanderwithmei')?.discovery_sources, [source(2, 'wanderwithmei')]),
      JSON.stringify(delivery))
    const resumed = runBoth('发现来源 collect 零请求恢复', [S('collect.ts'), '--resume', f.taskDir], f.cwd,
      undefined, costEnv(f.log))
    if (resumed.ok) named('来源保存恢复不丢记录且不改变请求次数和费用',
      equal(jsonFile(join(f.taskDir, 'creators.raw.json')), raw)
        && equal(jsonFile(join(f.taskDir, 'creators.json')), delivery)
        && fetchAttempts(f.log).length === 4 && summaryOf(resumed.stdout).requests === 4
        && summaryOf(resumed.stdout).cost_estimate_usd === 0.007, resumed.stdout)
  }
  const profile = costFixture('discovery-profile', knownCosts(2000, []), { budget_usd: 0.002 }, [
    costPerson('tiktok', 'techwithsarah', { bio: undefined, bio_links: [], discovery_sources: [source(0, 'techwithsarah')] }),
    costPerson('tiktok', 'legacy-source', { bio: undefined, bio_links: [] }),
  ])
  const profiles = runBoth('发现来源 profile 仅补资料', [S('collect.ts'), '--resume', profile.taskDir], profile.cwd,
    undefined, costEnv(profile.log))
  if (profiles.ok) {
    const raw = jsonFile(join(profile.taskDir, 'creators.raw.json'))
    named('profile保留已有发现来源，旧账号未知来源不从资料或任务倒推', Array.isArray(raw)
      && equal(raw.find((c: any) => c.handle === 'techwithsarah')?.discovery_sources, [source(0, 'techwithsarah')])
      && !Object.hasOwn(raw.find((c: any) => c.handle === 'legacy-source') ?? {}, 'discovery_sources')
      && equal(fetchAttempts(profile.log), [`200\t${TT_PROFILE}`, `200\t${TT_PROFILE}`])
      && summaryOf(profiles.stdout).cost_estimate_usd === 0.002, JSON.stringify(raw))
  }
  criterion('D15.a', 'D15.b', 'D15.d', 'D15.e', 'D15.f', 'D15.g')
  const shown = [source(0, 'display-known'), source(1, 'linked-ig'), source(2, 'users-ig')]
  shown[0].keyword = 'source,<attribution&payload>'
  const routes = ['TikTok 视频搜索', 'Instagram Reels 搜索', 'Instagram 账号名搜索']
  const text = shown.map((s, i) => `${routes[i]} · ${s.platform}:@${s.handle} · ${s.keyword} · ${s.dimension}`).join('；')
  const display = costFixture('discovery-display', knownCosts(1000, []), { budget_usd: 0.001 }, [
    costPerson('tiktok', 'display-known', { discovery_sources: shown }),
    costPerson('tiktok', 'display-missing'), costPerson('instagram', 'display-empty', { discovery_sources: [] }),
  ])
  const rendered = runBoth('发现来源 真实交付文件', [S('render.ts'), '--dir', display.taskDir], display.cwd,
    undefined, costEnv(display.log))
  if (rendered.ok) {
    // 只解读标准CSV/ZIP/XML，不调用生产格式化器当预期。
    const csvRows = fileText(join(display.taskDir, 'kol.csv')).trim().replace(/^\uFEFF/, '').split(/\r?\n/)
      .map(line => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map(m => (m[1] ?? m[2]).replace(/""/g, '"')))
    named('CSV实际文件末列展示来源，缺席与空数组均明确未知',
      csvRows[0]?.at(-1) === 'discovery_sources' && csvRows.some(r => r.at(-1) === text)
        && csvRows.filter(r => r.at(-1) === '来源未知').length === 2, JSON.stringify(csvRows))
    const entries = new Map<string, string>(), xlsx = join(display.taskDir, 'kol.xlsx')
    try {
      const b = readFileSync(xlsx), end = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
      let p = b.readUInt32LE(end + 16)
      for (let n = b.readUInt16LE(end + 10); n > 0; n--) {
        const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nameLen = b.readUInt16LE(p + 28)
        const name = b.subarray(p + 46, p + 46 + nameLen).toString(), local = b.readUInt32LE(p + 42)
        const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), bytes = b.subarray(start, start + size)
        entries.set(name, (method === 8 ? inflateRawSync(bytes) : bytes).toString('utf8'))
        p += 46 + nameLen + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32)
      }
    } catch { /* malformed/missing XLSX is the named assertion below, not a verifier crash */ }
    const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    const cellText = (s: string) => [...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join('')
    const shared = [...(entries.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => cellText(m[1]))
    const sheetRows = [...entries].filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .flatMap(([, xml]) => [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(m => {
        const last = [...m[1].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)].at(-1)?.[0] ?? ''
        return /\bt="s"/.test(last) ? shared[Number(last.match(/<v>(\d+)<\/v>/)?.[1])] : cellText(last)
      }))
    named('XLSX实际工作表末列展示来源，缺席与空数组均明确未知',
      sheetRows.filter(v => v === 'discovery_sources').length === 3 && sheetRows.includes(text)
        && sheetRows.filter(v => v === '来源未知').length === 2, JSON.stringify(sheetRows))
    const html = fileText(join(display.taskDir, 'report.html'))
    named('HTML展示并转义账号发现来源，未知不伪造路径且声明记录边界',
      html.includes('已观察发现来源') && html.includes(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        && !html.includes('<attribution&payload>') && (html.match(/来源未知/g)?.length ?? 0) === 2
        && html.includes('仅含已记录的账号发现来源，可能不含完整历史；不对应具体作品或请求次数'), html)
    named('发现来源渲染不新增请求或制造历史费用', fetchAttempts(display.log).length === 0
      && jsonFile(join(display.taskDir, 'task.json'))?.requests === 0, rendered.stdout)
    criterion('D15.h', 'D15.i')
  }
})

group('cost-durable', [], () => {
  const history = [costEntry(TT_PROFILE, 1000, 1), costEntry(IG_REELS, 2000, 0, 1)]
  const fresh = { budget_usd: 0.007, done: [], offsets: {}, pages: {}, answered: {}, found: {} }
  const fixture = (name: string, entry: string, over: Record<string, unknown> = {}) => {
    const f = costFixture(`durable-${name}-${entry}`, knownCosts(7000, structuredClone(history)),
      { ...fresh, ...over }, entry === 'enrich'
        ? [costPerson('tiktok', 'durable-a'), costPerson('tiktok', 'durable-b')] : [])
    return { ...f, events: join(f.cwd, 'events.jsonl'), marks: join(f.cwd, 'save-events.jsonl') }
  }
  type Fixture = ReturnType<typeof fixture>
  const events = (path: string): any[] => fileText(path).split('\n').filter(Boolean).map(line => JSON.parse(line))
  const args = (entry: string, f: Fixture) => [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir]
  const observeEnv = (f: Fixture, extra: NodeJS.ProcessEnv = {}) => costEnv(f.log, {
    FAKE_FETCH_COST_EVENTS: f.events, FAKE_FETCH_COST_TASK: f.task, ...extra,
  })
  const retained = (task: any) => Array.isArray(task?.cost_ledger?.entries)
    ? task.cost_ledger.entries.reduce((n: number, e: any) => n + e?.http_200_count + e?.unknown_result_count, 0) : undefined
  const unknown = (task: any) => Array.isArray(task?.cost_ledger?.entries)
    ? task.cost_ledger.entries.reduce((n: number, e: any) => n + e?.unknown_result_count, 0) : undefined
  const sameEntries = (actual: any, expected: any[]) => {
    const rows = (items: any[]) => items.map(e => [e?.endpoint, e?.price_version, e?.unit_micro_usd,
      e?.http_200_count, e?.unknown_result_count]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    return Array.isArray(actual) && JSON.stringify(rows(actual)) === JSON.stringify(rows(expected))
  }
  const validRun = (result: ReturnType<typeof runBoth>) => {
    if (!result.ok) return false
    if (/SyntaxError|ReferenceError|TypeError|ERR_MODULE_NOT_FOUND|does not provide an export|TransformError|Error: listen EPERM/.test(result.stderr)) {
      failed++
      console.error(`  ✗ 持久费用入口未运行${SELFCHECK_PROCESS_MARK}：缺实现或无法加载，不能记作行为断言\n${result.stderr}`)
      return false
    }
    return true
  }
  // 正向顺序 oracle 仅按 ADR-107 手算：历史200一次、无状态一次，共3000微美元。
  // 下一次 id 从3起；429不加净次数但消耗尝试号；每次正文只能看见已移除 pending 的终态。
  for (const scenario of ['collect-retry', 'collect-fallback', 'collect-profile-fallback', 'enrich-retry']) {
    const entry = scenario.startsWith('collect') ? 'collect' : 'enrich'
    const fallback = scenario === 'collect-fallback', profile = scenario === 'collect-profile-fallback'
    const endpoint = entry === 'collect' ? (fallback ? IG_REELS : profile ? IG_PROFILE : TT_SEARCH) : TT_POSTS
    const f = fixture(scenario, entry, fallback ? { tasks: [
      { keyword: 'force-noparse', dimension: 'category', platform: 'instagram' },
    ] } : profile ? { done: [0] } : {})
    if (profile) for (const file of ['creators.json', 'creators.raw.json'])
      writeFileSync(join(f.taskDir, file), JSON.stringify([
        costPerson('instagram', 'durable-profile', { bio: undefined, bio_links: [] }),
      ]))
    const result = runBoth(`持久费用逐次顺序 ${scenario}`, args(entry, f), f.cwd,
      { status: entry === 'enrich' || profile ? 0 : 3, soft: [0, 1, 2, 3] }, observeEnv(f, fallback ? {} : {
        FAKE_FETCH_FAULT_PATH: endpoint, FAKE_FETCH_FAULT: profile ? 'bad-body-500' : 'bad-body-429',
      }))
    if (!validRun(result)) continue
    const seen = events(f.events), fetches = seen.filter(e => e.kind === 'fetch')
    const expectedEntries = structuredClone(history)
    let attempt = 3, requests = 2, pendingOK = true, terminalOK = true
    for (const e of seen) {
      if (e.kind === 'fetch') {
        const p = e.task?.cost_ledger?.pending
        const unit = [IG_REELS, IG_USERS].includes(e.endpoint) ? 2000 : 1000
        pendingOK &&= p?.endpoint === e.endpoint && p?.price_version === COST_VERSION
          && p?.unit_micro_usd === unit && p?.attempt_id === attempt++
          && e.task?.cost_ledger?.next_attempt_id === attempt && e.task?.requests === requests
          && sameEntries(e.task?.cost_ledger?.entries, expectedEntries)
      } else if (e.kind === 'http' && e.status === 200) {
        requests++
        let row = expectedEntries.find(r => r.endpoint === e.endpoint)
        if (!row) { row = costEntry(e.endpoint, [IG_REELS, IG_USERS].includes(e.endpoint) ? 2000 : 1000); expectedEntries.push(row) }
        row.http_200_count++
      } else if (e.kind === 'body') {
        terminalOK &&= e.task?.cost_ledger?.pending === undefined && e.task?.requests === requests
          && sameEntries(e.task?.cost_ledger?.entries, expectedEntries)
      }
    }
    const exercised = fallback
      ? fetches[0]?.endpoint === IG_REELS && fetches[1]?.endpoint === IG_USERS
      : profile ? fetches[0]?.endpoint === IG_PROFILE && fetches[1]?.endpoint === IG_PROFILE_V2
      : fetches.length >= 2 && fetches[0]?.endpoint === endpoint && fetches[1]?.endpoint === endpoint
        && seen.some(e => e.kind === 'http' && e.status === 429)
    named('collect/enrich 每次实际请求前已保存对应预留，重试与兜底不例外',
      exercised && pendingOK && fetches.length >= 2,
      `${scenario}: fetches=${JSON.stringify(fetches)}, stderr=${result.stderr}`)
    named('collect/enrich 每次正文读取前已保存HTTP终态，历史费用及净次数连续',
      exercised && terminalOK && seen.some(e => e.kind === 'body'),
      `${scenario}: body=${JSON.stringify(seen.filter(e => e.kind === 'body'))}`)
  }
  criterion('D14.a')

  // 在文件替换边界注入EIO：看将要落盘的公开pending字段和fetch事件，不依赖临时文件名。
  // once只失败一次，随后允许收尾保存；persistent持续阻止同阶段保存，两者盘上预期不同。
  const failSave = (f: Fixture, phase: string, mode: string) => {
    const preload = join(f.cwd, 'fail-cost-checkpoint.mjs')
    writeFileSync(preload, [
      `import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module';`,
      `const original = fs.renameSync; let failures = 0;`,
      `const mark = row => fs.appendFileSync(${JSON.stringify(f.marks)}, JSON.stringify(row)+'\\n');`,
      `fs.renameSync = function(src, dest) {`,
      `  if (String(dest) !== ${JSON.stringify(f.task)}) return original(src, dest);`,
      `  const next = JSON.parse(fs.readFileSync(src, 'utf8'));`,
      `  const fetched = fs.existsSync(${JSON.stringify(f.events)}) && fs.readFileSync(${JSON.stringify(f.events)}, 'utf8').includes('"kind":"fetch"');`,
      `  const hit = ${JSON.stringify(phase)} === 'reserve' ? !!next.cost_ledger?.pending && !fetched : fetched && !next.cost_ledger?.pending;`,
      `  if (hit && (${JSON.stringify(mode)} === 'persistent' || failures === 0)) { failures++; mark({kind:'injected', task:next}); throw Object.assign(new Error('test durable cost save denied'), {code:'EIO'}); }`,
      `  const result = original(src, dest); mark({kind:'saved', task:next}); return result;`,
      `}; syncBuiltinESMExports(); mark({kind:'armed'});`,
    ].join('\n'))
    return `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(preload).href)}`
  }
  for (const route of ['collect-search', 'collect-profile', 'enrich']) for (const outcome of ['reserve', 'http200', 'non200', 'nostatus'])
    for (const mode of ['persistent', 'once']) {
      const entry = route.startsWith('collect') ? 'collect' : 'enrich', profile = route === 'collect-profile'
      const f = fixture(`${route}-${outcome}-${mode}`, entry, profile ? { done: [0] } : entry === 'collect' ? { tasks: [
        { keyword: 'force-noparse', dimension: 'category', platform: 'instagram' },
      ] } : {})
      if (profile) for (const file of ['creators.json', 'creators.raw.json'])
        writeFileSync(join(f.taskDir, file), JSON.stringify(['a', 'b'].map(h =>
          costPerson('instagram', `durable-profile-${h}`, { bio: undefined, bio_links: [] }))))
      const endpoint = entry === 'collect' ? (profile ? IG_PROFILE : IG_REELS) : TT_POSTS
      const unit = entry === 'collect' && !profile ? 2000 : 1000
      const beforePeople = fileText(join(f.taskDir, 'creators.json'))
      // 收尾若错误进入记忆读取，会遇到坏JSON；D14.h要求原费用运行错误仍是退出1。
      if (mode === 'once') writeFileSync(join(f.cwd, 'memory', 'creators.json'), '{broken-memory')
      const result = runBoth(`持久费用保存故障 ${route}/${outcome}/${mode}`, args(entry, f), f.cwd,
        { status: 1, soft: [0, 2, 3] }, observeEnv(f, {
          NODE_OPTIONS: failSave(f, outcome === 'reserve' ? 'reserve' : 'terminal', mode),
          ...(outcome === 'non200' || outcome === 'nostatus' ? {
            FAKE_FETCH_FAULT_PATH: endpoint,
            FAKE_FETCH_FAULT: outcome === 'non200' ? (profile ? 'bad-body-500' : 'bad-body-429') : 'no-http-status',
          } : {}),
        }))
      if (!validRun(result)) continue
      const seen = events(f.events), marks = events(f.marks), after = jsonFile(f.task)
      if (!marks.some(e => e.kind === 'armed')) {
        failed++
        console.error(`  ✗ 持久费用故障未安装${SELFCHECK_FIXTURE_MARK}：${result.stderr}`)
        continue
      }
      const injected = marks.filter(e => e.kind === 'injected'), count = seen.filter(e => e.kind === 'fetch').length
      const why = `${route}/${outcome}/${mode}: exit=${result.status}, fetch=${count}, injected=${injected.length}, disk=${JSON.stringify(after)}, stderr=${result.stderr}`
      if (outcome === 'reserve') {
        named('预留保存失败退出1且零请求，不伪造无HTTP状态留存',
          injected.length > 0 && result.status === 1 && count === 0 && after?.requests === 2
            && unknown(after) === 1 && retained(after) === 2, why)
      } else {
        const stopped = injected.length > 0 && result.status === 1 && count === 1
          && !seen.some(e => e.kind === 'body')
        if (outcome === 'http200') named('HTTP200终态保存失败停止正文及后续请求，不走兜底', stopped, why)
        if (outcome === 'non200') named('非200终态保存失败停止正文及重试，不走兜底', stopped, why)
        if (outcome === 'nostatus') named('无HTTP状态终态保存失败停止后续请求，不退款或兜底', stopped, why)
        const pending = after?.cost_ledger?.pending
        const stablePending = pending?.endpoint === endpoint && pending?.unit_micro_usd === unit
          && pending?.attempt_id === 3 && pending?.price_version === COST_VERSION
          && after?.requests === 2 && sameEntries(after?.cost_ledger?.entries, history)
        const terminal = pending === undefined && after?.requests === (outcome === 'non200' ? 2 : 3)
          && retained(after) === after.requests && unknown(after) === (outcome === 'nostatus' ? 2 : 1)
          && (outcome !== 'non200' || sameEntries(after.cost_ledger.entries, history))
          && (outcome !== 'http200' || after.cost_ledger.entries.some((e: any) => e.endpoint === endpoint && e.http_200_count === 1))
        named('费用保存持续失败保留盘上pending，一次失败后收尾只保存真实终态',
          injected.length > 0 && (mode === 'persistent' ? stablePending
            : terminal && marks.some(e => e.kind === 'saved')), why)
      }
      named('费用保存失败不生成常规结果或成功续跑提示，后续记忆错误不覆盖退出1',
        injected.length > 0 && result.status === 1 && result.stdout.trim() === ''
          && !/断点已保存|已保存.*(?:续跑|继续)|追加预算|续跑不产生|续跑会继续/.test(result.stderr)
          && result.stderr.includes('test durable cost save denied')
          && fileText(join(f.taskDir, 'creators.json')) === beforePeople, why)
    }
  criterion('D14.b', 'D14.c', 'D14.d', 'D14.e', 'D14.h')

  for (const entry of ['collect', 'enrich']) {
    const f = fixture('kill-barrier', entry)
    const controller = join(f.cwd, 'kill-at-fetch.mjs')
    // 控制器是同步自检的一个子进程；被测入口是其直接IPC子进程，没有tsx壳的信号换算。
    writeFileSync(controller, [
      `import { spawn } from 'node:child_process';`,
      `const child = spawn(process.execPath, ['--import', ${JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href)}, ...${JSON.stringify(args(entry, f))}], {cwd:${JSON.stringify(f.cwd)}, env:process.env, stdio:['ignore','pipe','pipe','ipc']});`,
      `let stdout='', stderr='', barrier=false;`,
      `child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);`,
      `const timer = setTimeout(() => { child.kill('SIGKILL'); }, 15000);`,
      `child.on('message', m => { if (m?.kind === 'cost-fetch-barrier' && m.pid === child.pid) { barrier=true; child.kill('SIGKILL'); } });`,
      `child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode=1; });`,
      `child.on('close', (code, signal) => { clearTimeout(timer); console.log(JSON.stringify({code,signal,barrier,stdout,stderr})); });`,
    ].join('\n'))
    const killed = runBoth(`持久费用确定屏障强杀 ${entry}`, [controller], f.cwd, undefined,
      observeEnv(f, { FAKE_FETCH_COST_BARRIER: '1' }))
    if (!killed.ok) continue
    const report = summaryOf(killed.stdout)
    if (!report.barrier || report.signal !== 'SIGKILL') {
      failed++
      console.error(`  ✗ 持久费用强杀未到屏障${SELFCHECK_FIXTURE_MARK}：${JSON.stringify(report)}`)
      continue
    }
    const before = fileText(f.task), disk = jsonFile(f.task)
    named('强杀发生在fetch确定屏障时，盘上保留未结占用且不增加净次数',
      disk?.cost_ledger?.pending?.endpoint === (entry === 'collect' ? TT_SEARCH : TT_POSTS)
        && disk?.cost_ledger?.pending?.attempt_id === 3 && disk?.requests === 2
        && sameEntries(disk?.cost_ledger?.entries, history)
        && events(f.events).filter(e => e.kind === 'fetch').length === 1,
      `${entry}: disk=${before}, report=${JSON.stringify(report)}`)
    for (const change of [false, true]) {
      const log = join(f.cwd, `resume-${change}.tsv`)
      const resumed = runBoth(`强杀后拒绝付费 ${entry}/${change}`, [...args(entry, f),
        ...(change ? ['--budget', '0.009'] : [])], f.cwd,
        { status: 2, soft: [0, 1, 3] }, costEnv(log))
      if (validRun(resumed)) {
        const after = jsonFile(f.task)
        const changed = [...new Set([...Object.keys(disk ?? {}), ...Object.keys(after ?? {})])]
          .filter(key => JSON.stringify(disk?.[key]) !== JSON.stringify(after?.[key]))
        if (changed.length) console.log(`  · ${entry}/change=${change} 恢复拒绝后的任务变字段：${changed.join('、')}`)
        named('强杀后恢复未结费用拒绝新增付费及显式改额，退出2且零请求',
          resumed.status === 2 && fetchAttempts(log).length === 0
            && after?.requests === disk?.requests
            && JSON.stringify(after?.cost_ledger) === JSON.stringify(disk?.cost_ledger)
            && rootToken(fileText(f.task), 'budget_usd') === rootToken(before, 'budget_usd'),
          `${entry}/change=${change}: exit=${resumed.status}, requests=${fetchAttempts(log).length}, changed=${changed}, stderr=${resumed.stderr}`)
      }
    }
  }
  criterion('D14.f')

  // 无任务的两个探针沿用process预算；不得因本次任务持久化改动引入task落盘。
  for (const direct of [false, true]) {
    const f = fixture(`process-${direct}`, 'probe')
    const config = join(f.cwd, 'probe.json'), before = fileText(f.task)
    writeFileSync(config, JSON.stringify({ market: 'US', budget_usd: 0.005, tasks: [
      { keyword: 'local', dimension: 'category', platform: 'tiktok' },
    ] }))
    const result = runBoth(`探针仍为进程费用 ${direct}`, direct
      ? [S('probe-ig-paging.ts'), '--keyword', 'local'] : [S('probe.ts'), '--config', config], f.cwd,
      undefined, observeEnv(f, { NODE_OPTIONS: failSave(f, 'reserve', 'persistent') }))
    if (validRun(result)) named('probe与直接分页探针保持process费用，不新增任务检查点',
      summaryOf(result.stdout).cost_scope === 'process' && fetchAttempts(f.log).length === 1
        && fileText(f.task) === before && !existsSync(join(f.cwd, 'output'))
        && !events(f.marks).some(e => e.kind === 'injected' || e.kind === 'saved'), result.stderr)
  }
})

group('cost-save-errors', [], () => {
  for (const entry of ['collect', 'enrich', 'probe']) {
    const f = costFixture(`missing-key-${entry}`, knownCosts(1000, []),
      { budget_usd: 0.001, done: [] }, [costPerson()])
    const cfg = join(f.cwd, 'config.json')
    writeFileSync(cfg, JSON.stringify({ market: 'US', budget_usd: 0.001,
      tasks: [{ keyword: 'key-required', dimension: 'category', platform: 'tiktok' }] }))
    const args = entry === 'probe' ? [S('probe.ts'), '--config', cfg]
      : [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir]
    const result = runBoth(`${entry} 真正需付费却缺 key`, args, f.cwd,
      { status: 2, soft: [0, 1, 3] }, costEnv(f.log, { TIKHUB_API_KEY: undefined }))
    if (result.ok) named('真正需要请求时缺 key 是输入错误，零 fetch 且不冒充预算不足',
      result.status === 2 && fetchAttempts(f.log).length === 0 && /TIKHUB_API_KEY|密钥|key/i.test(result.stderr),
      `${entry}: status=${result.status}, attempts=${fetchAttempts(f.log).length}, stderr=${result.stderr}`)
    // F3.e：缺 API key 只写缺 key 这件事；它不是配置里的问题，不要求写配置路径
    if (result.ok && entry === 'probe') {
      const leak = probeInputLeak(result.stderr)
      named('F3.e：probe 缺 API key 以退出码 2 结束时，stderr 只写缺 key 这件事，不带异常类名与调用栈',
        result.status === 2 && !leak.className && !leak.frames && /TIKHUB_API_KEY|密钥|key/i.test(result.stderr),
        `退出码 ${result.status}、带异常类名=${leak.className}、带栈帧=${leak.frames}，stderr 末几行 ${stderrTail(result.stderr)}`
        + ' —— F3.e：缺 API key 是输入问题，stderr 只写缺 key 这件事，内部异常的类名与堆栈都不该出现')
      criterion('F3.e')
    }
  }
  for (const entry of ['collect', 'enrich']) for (const scenario of ['budget', 'change', 'after-http']) {
    const costs = scenario === 'after-http' ? knownCosts(1000, []) : knownCosts(1000, [costEntry(TT_PROFILE, 1000, 1)])
    const f = costFixture(`save-${entry}-${scenario}`, costs,
      { budget_usd: 0.001, done: [], offsets: {}, pages: {}, answered: {}, found: {} },
      [costPerson('tiktok', 'save-a'), costPerson('tiktok', 'save-b')])
    const preload = join(f.cwd, 'fail-task-save.mjs'), mark = join(f.cwd, 'save-fault.txt')
    // 只拦公开最终写入触点 renameSync(src,dest) 的目标；不依赖临时文件名或生产函数体。
    // after-http 的名字限定失败位置：D14预留必须先成功，不能拿「预留失败」代替终态故障。
    writeFileSync(preload, `import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module'; const original = fs.renameSync; fs.renameSync = function(src, dest) { const active = ${JSON.stringify(scenario)} !== 'after-http' || (fs.existsSync(${JSON.stringify(f.log)}) && fs.readFileSync(${JSON.stringify(f.log)}, 'utf8').length > 0); if (active && String(dest) === ${JSON.stringify(f.task)}) { fs.appendFileSync(${JSON.stringify(mark)}, 'injected\\n'); throw Object.assign(new Error('test task save denied'), { code: 'EIO' }); } return original(src, dest); }; syncBuiltinESMExports(); fs.appendFileSync(${JSON.stringify(mark)}, 'armed\\n');`)
    const before = fileText(f.task)
    const result = runBoth(`${entry} 保存失败 ${scenario}`,
      [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir,
        ...(scenario === 'change' ? ['--budget', '0.003'] : [])], f.cwd,
      { status: 1, soft: [0, 2, 3] }, costEnv(f.log, {
        NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(preload).href)}`,
      }))
    if (!result.ok) continue
    if (!fileText(mark).includes('armed')) {
      failed++
      console.error(`  ✗ 费用保存故障注入${SELFCHECK_FIXTURE_MARK}：预加载夹具未成功安装\n${result.stderr}`)
      continue
    }
    const attempts = fetchAttempts(f.log)
    named('费用保存故障确实发生，失败不得退3、宣称已保存或继续请求',
      fileText(mark).includes('injected') && result.status === 1 && !result.stderr.includes('已保存')
        && attempts.length === (scenario === 'after-http' ? 1 : 0)
        && (scenario !== 'after-http' || attempts[0] === `200\t${entry === 'collect' ? TT_SEARCH : TT_POSTS}`)
        && (scenario === 'after-http' ? jsonFile(f.task)?.cost_ledger?.pending?.endpoint === (entry === 'collect' ? TT_SEARCH : TT_POSTS)
          && jsonFile(f.task)?.requests === 0 : fileText(f.task) === before),
      `${entry}/${scenario}: injected=${fileText(mark)}, status=${result.status}, attempts=${JSON.stringify(attempts)}, stderr=${result.stderr}`)
  }
  criterion('P3.d', 'D13.p')

  // D6.t：作者累加器写失败时，盘上这一页的分页进度不得前进（ADR-113）。
  // 同上一段只拦最终改名写入的目标，这次是 creators.raw.json；task.json 照常可写，费用检查点不受影响。
  // 一页一次付费请求：先落盘的若是分页进度，续跑会从下一页接着翻，这一页的作者就永远丢了。
  {
    const f = costFixture('raw-save-order', knownCosts(1000, []),
      { budget_usd: 0.001, done: [], offsets: {}, pages: {}, answered: {}, found: {} })
    const raw = join(f.taskDir, 'creators.raw.json')
    const preload = join(f.cwd, 'fail-raw-save.mjs'), mark = join(f.cwd, 'raw-fault.txt')
    writeFileSync(preload, `import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module'; const original = fs.renameSync; fs.renameSync = function(src, dest) { if (String(dest) === ${JSON.stringify(raw)}) { fs.appendFileSync(${JSON.stringify(mark)}, 'injected\\n'); throw Object.assign(new Error('test raw save denied'), { code: 'EIO' }); } return original(src, dest); }; syncBuiltinESMExports(); fs.appendFileSync(${JSON.stringify(mark)}, 'armed\\n');`)
    const result = runBoth('collect 作者累加器写失败', [S('collect.ts'), '--resume', f.taskDir], f.cwd,
      { status: 1, soft: [0, 2, 3] }, costEnv(f.log, {
        NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(preload).href)}`,
      }))
    if (result.ok) {
      if (!fileText(mark).includes('armed')) {
        failed++
        console.error(`  ✗ 作者累加器写入故障注入${SELFCHECK_FIXTURE_MARK}：预加载夹具未成功安装\n${result.stderr}`)
      } else {
        const disk = jsonFile(f.task)
        const attempts = fetchAttempts(f.log)
        named('作者累加器写失败时，盘上这一页的分页进度不前进',
          fileText(mark).includes('injected') && result.status === 1
            && attempts.length === 1 && attempts[0] === `200\t${TT_SEARCH}`
            && disk?.offsets !== undefined && !Object.hasOwn(disk.offsets, '0')
            && disk?.pages !== undefined && !Object.hasOwn(disk.pages, '0')
            && Array.isArray(disk?.done) && !disk.done.includes(0),
          `status=${result.status}, attempts=${JSON.stringify(attempts)}, task=${JSON.stringify(disk)}, stderr=${result.stderr}`)
      }
    }
  }
  criterion('D6.t')

  // 公共方法级注入纯费用错误，避免用普通 fetch 错误冒充内部费用错误。
  // --import tsx 在夹具前加载；不读或改写 Budget/CostError 的函数体。
  const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
  const budgetModule = pathToFileURL(resolve('scripts/lib/budget.ts')).href
  const costModule = pathToFileURL(resolve('scripts/lib/cost-ledger.ts')).href
  for (const entry of ['collect', 'enrich', 'probe']) for (const method of ['reserve', 'settle']) {
    const f = costFixture(`internal-${entry}-${method}`, knownCosts(10000, []),
      { budget_usd: 0.01, done: [], offsets: {}, pages: {}, answered: {}, found: {} },
      [costPerson('tiktok', 'internal-a'), costPerson('tiktok', 'internal-b')])
    const mark = join(f.cwd, 'internal-fault.txt'), preload = join(f.cwd, 'internal-fault.mjs')
    writeFileSync(preload, [
      `import { appendFileSync } from 'node:fs';`,
      `import { Budget } from ${JSON.stringify(budgetModule)};`,
      `import { CostError, createCostBudget } from ${JSON.stringify(costModule)};`,
      `const isolated = createCostBudget(1000, 'process', { test: { '/attempt': 1000 } });`,
      `const receipt = isolated.reserve({ endpoint: '/attempt', price_version: 'test', unit_micro_usd: 1000 });`,
      `isolated.settle(receipt, { kind: 'http', status: 200 });`,
      `let internalError; try { isolated.settle(receipt, { kind: 'http', status: 200 }); } catch (error) { internalError = error; }`,
      `if (!(internalError instanceof CostError) || internalError.code !== 'invalid-receipt') { console.error(${JSON.stringify(SELFCHECK_FIXTURE_MARK)}); throw new Error('cannot construct public receipt-error fixture'); }`,
      `Budget.prototype.${method} = function() { appendFileSync(${JSON.stringify(mark)}, 'injected\\n'); throw internalError; };`,
      `appendFileSync(${JSON.stringify(mark)}, 'armed\\n');`,
    ].join('\n'))
    const cfg = join(f.cwd, 'probe.json')
    writeFileSync(cfg, JSON.stringify({ market: 'US', budget_usd: 0.01, tasks: [
      { keyword: 'internal-a', dimension: 'category', platform: 'tiktok' },
      { keyword: 'internal-b', dimension: 'scene', platform: 'tiktok' },
    ] }))
    const args = entry === 'probe' ? [S('probe.ts'), '--config', cfg]
      : [S(`${entry}.ts`), entry === 'collect' ? '--resume' : '--dir', f.taskDir]
    const result = runBoth(`${entry} 运行中 ${method} 费用错误`, args, f.cwd,
      { status: 1, soft: [0, 2, 3] }, costEnv(f.log, {
        NODE_OPTIONS: `--import ${JSON.stringify(tsx)} ${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(preload).href)}`,
      }))
    if (result.ok) {
      if (!fileText(mark).includes('armed')) {
        failed++
        console.error(`  ✗ 内部费用错误注入${SELFCHECK_FIXTURE_MARK}：预加载夹具未成功安装\n${result.stderr}`)
        continue
      }
      named('运行中费用错误穿透入口，退出1且不再请求，不伪装成输入或余额不足',
        fileText(mark).split('\n').filter(line => line === 'injected').length === 1 && result.status === 1
          && fetchAttempts(f.log).length === (method === 'reserve' ? 0 : 1)
          && !/追加预算|加钱|余额不足/.test(result.stderr),
        `${entry}/${method}: injected=${fileText(mark)}, status=${result.status}, attempts=${JSON.stringify(fetchAttempts(f.log))}, stderr=${result.stderr}`)
    }
  }
  criterion('D13.s')
})

// ---- 崩溃续跑 A / B：业务保存窗口仍要验证，费用窗口由D14持久预留封住 ----
group('crash-resume', [], () => {
  // 第n个假200响应确定触发SIGKILL，状态尚未交还，终态未保存。
  // D14要求盘上已有该次pending，并保留此前终态；D6仍要求此前完成页的业务断点不丢。
  // tsx 壳把孙进程的 SIGKILL 译成 128 + 信号号的退出码（实测记在 ADR-96 第三节），所以杀掉那一跑走 runBoth 照常判。
  // 每条轨迹一个独立 cwd：别处把 tmp/memory/creators.json 截坏之后不恢复，共用会让续跑退 2 而不是 3。
  // 被杀那一跑打不出目录名（summary 在循环之后），按产品名前缀在 output/ 下找。**只数账本里 200 的行**：
  // 假 fetch 每进程到某一次调用会回一个 429（第几次写在 fake-fetch.ts），这几条轨迹每进程的调用数够不到；碰到也只是多一行 429。
  const crashCwd = (name: string) => {
    const cwd = join(tmp, name)
    mkdirSync(join(cwd, 'memory'), { recursive: true })
    return cwd
  }
  /** 账本里关键词搜索的成功次数。端点路径出自 `scripts/providers/tikhub.ts` 的 `searchTikTok`；
   *  只数搜索，不数 profile —— 续跑要补 profile，拿总请求数当判据会把两件事混在一起。 */

  {
    // A：单关键词第一页完成，第二页请求已开始但未取得可供入口结算的状态。
    // 只有一个词，避免F9先补另一个词的第一页，使第二次请求确实验证同一分页断点。
    // 前提：罐头 has_more 为 1，kw0 不进 done，续跑才会再搜它。
    const cwd = crashCwd('crash-a')
    const ledger = join(tmp, 'ledger-a.tsv')
    const observations = join(cwd, 'fetch-events.jsonl')
    const cfg = join(cwd, 'crash-a.json')
    writeFileSync(cfg, JSON.stringify({
      product: 'crasha', market: 'US', target_count: 500, budget_usd: 0.002,
      tasks: [{ keyword: 'kw0', dimension: 'category', platform: 'tiktok' }],
    }))
    const first = runBoth('collect 搜索循环里被杀：进程以 137 结束', [S('collect.ts'), '--config', cfg], cwd,
                          { status: 137 }, { FAKE_FETCH_LEDGER: ledger, FAKE_FETCH_KILL_AFTER_OK: '2',
                            FAKE_FETCH_COST_EVENTS: observations })
    const dir = first.ok ? onlyDir(cwd, 'crasha') : undefined
    if (first.ok && dir === undefined) {
      failed++
      console.error(`  ✗ collect 搜索循环里被杀${SELFCHECK_FIXTURE_MARK}：output/ 下找不到恰好一个 crasha- 目录 —— 夹具没造对`)
    }
    if (dir !== undefined) {
      const disk = jsonFile(join(cwd, dir, 'task.json'))
      const raw = jsonFile(join(cwd, dir, 'creators.raw.json'))
      const nextQuery = fileText(observations).split('\n').filter(Boolean).map(line => JSON.parse(line))
        .filter(e => e.kind === 'fetch')[1]?.query
      const nextOffset = nextQuery?.offset
      named('collect 搜索循环里被杀：此前页的作者与分页断点已保存',
        disk?.pages?.[0] === 1 && Number.isSafeInteger(disk?.offsets?.[0]) && disk.offsets[0] > 0
          && nextQuery?.keyword === 'kw0' && nextOffset !== undefined
          && disk.offsets[0] === Number(nextOffset) && disk?.answered?.[0] === 1
          && disk?.found?.[0] === 3 && Array.isArray(raw)
          && raw.some(c => c.platform === 'tiktok' && c.handle === 'techwithsarah'
            && c.recent_posts?.some((p: any) => p.desc === 'Testing the new GaN charger')),
        `task=${JSON.stringify(disk)}, nextOffset=${nextOffset}, raw=${JSON.stringify(raw)}`)
      named('collect 搜索循环里被杀：最后一次预留在盘上且此前终态未丢',
        diskRequests(cwd, dir) === 1 && ledgerLines(ledger, true) === 2
          && disk?.cost_ledger?.pending?.endpoint === TT_SEARCH
          && disk?.cost_ledger?.pending?.unit_micro_usd === 1000
          && disk?.cost_ledger?.entries?.some((e: any) => e.endpoint === TT_SEARCH && e.http_200_count === 1),
        `task=${JSON.stringify(disk)}, attempts=${ledgerLines(ledger, true)}`)
      const second = runBoth('collect 搜索循环里被杀后续跑：未结费用退 2', [S('collect.ts'), '--resume', dir], cwd,
                             { status: 2, soft: [0, 1, 3] }, { FAKE_FETCH_LEDGER: ledger })
      if (second.ok) {
        named('collect 搜索循环里被杀后续跑：未结占用阻止任何新请求',
              second.status === 2 && ledgerLines(ledger, true) === 2,
              `退出 ${second.status}，账本 200 行 ${ledgerLines(ledger, true)}，应仍是 2`)
        extract('A', diskRequests(cwd, dir), ledger, first.stderr, second.stderr)
      }
    }
  }

  {
    // B：搜索及第一个profile已取得200，第二个profile响应交还前被杀。
    // 即使profile业务结果尚未批量保存，前两次费用终态也不得被清空。
    const cwd = crashCwd('crash-b')
    const ledger = join(tmp, 'ledger-b.tsv')
    const cfg = join(cwd, 'crash-b.json')
    writeFileSync(cfg, JSON.stringify({
      product: 'crashb', market: 'US', target_count: 1, budget_usd: 0.004,
      tasks: [{ keyword: 'kw0', dimension: 'category', platform: 'tiktok' }],
    }))
    const first = runBoth('collect 补 profile 循环里被杀：进程以 137 结束', [S('collect.ts'), '--config', cfg], cwd,
                          { status: 137 }, { FAKE_FETCH_LEDGER: ledger, FAKE_FETCH_KILL_AFTER_OK: '3' })
    const dir = first.ok ? onlyDir(cwd, 'crashb') : undefined
    if (first.ok && dir === undefined) {
      failed++
      console.error(`  ✗ collect 补 profile 循环里被杀${SELFCHECK_FIXTURE_MARK}：output/ 下找不到恰好一个 crashb- 目录 —— 夹具没造对`)
    }
    if (dir !== undefined) {
      const disk = jsonFile(join(cwd, dir, 'task.json'))
      named('collect 补 profile 循环里被杀：历史搜索与profile终态均已保存',
        diskRequests(cwd, dir) === 2 && ledgerLines(ledger, true) === 3
          && [TT_SEARCH, TT_PROFILE].every(endpoint => disk?.cost_ledger?.entries?.some((e: any) =>
            e.endpoint === endpoint && e.http_200_count === 1 && e.unknown_result_count === 0))
          && disk?.cost_ledger?.pending?.endpoint === TT_PROFILE
          && disk?.cost_ledger?.pending?.attempt_id === 3,
        `task=${JSON.stringify(disk)}, attempts=${ledgerLines(ledger, true)}`)
      const second = runBoth('collect 补 profile 循环里被杀后续跑：未结费用退 2', [S('collect.ts'), '--resume', dir], cwd,
                             { status: 2, soft: [0, 1, 3] }, { FAKE_FETCH_LEDGER: ledger })
      if (second.ok) {
        named('collect 补 profile 循环里被杀后续跑：未结占用阻止任何新请求',
              second.status === 2 && ledgerLines(ledger, true) === 3,
              `退出 ${second.status}，账本 200 行 ${ledgerLines(ledger, true)}，应仍是 3`)
        extract('B', diskRequests(cwd, dir), ledger, first.stderr, second.stderr)
      }
    }
  }
})

// ---- collect：完整采集 + profile 补全 + 同人合并 + 记忆 ----
group('collect', [], () => {
  const taskCfg = join(tmp, 'task.json')
  writeFileSync(taskCfg, JSON.stringify({
    product: 'selfcheck', market: 'US', target_count: 100, budget_usd: 1,
    tasks: [
      { keyword: 'power bank review', dimension: 'category', platform: 'tiktok' },
      { keyword: 'smoothie', dimension: 'scene', platform: 'instagram' },
    ],
  }))
  const collected = runBoth('collect 完整流程', [S('collect.ts'), '--config', taskCfg], tmp)
  if (collected.ok) {
    try { dir = JSON.parse(collected.stdout).dir } catch {}
    const completed = collected.stderr.split('\n').filter(l => l.trimStart().startsWith('✓'))
    named('collect 搜索完成进度保留原任务序号、维度、平台和原词',
      completed.some(l => l.includes('任务 2 · scene · instagram · 关键词「smoothie」')),
      `搜索完成进度实际为 ${JSON.stringify(completed)}`)
    criterion('U8.i')
    // 走到这里说明进程跑起来了、退出码也对，只是 stdout 里没有可解析的 dir
    if (!dir) { failed++; console.error('  ✗ collect 未输出可解析的 dir') }
  }
})

// ---- collect：预算用尽 → 断点 → 续跑 ----
group('collect-resume', [], () => {
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
  // 跳过不能算通过，否则 P3.b 可以一直是坏的而这一步照样打勾。
  if (tightOut === undefined) {
    // 没跑起来 —— 失败已由 runBoth 带着记号报过一次，下面的诊断只会说错原因
  } else {
    // P3.b 的「保存断点」那一半改成**具名**断言：名字进清册，于是指着入口接线的变异
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
      // **续跑的预算要从断点里那个数起算 —— 这是 `D6.a`，不是 `P3.b`。**
      // `D6.a` 逐字：「以 --resume 重入时，task.json 的 done 数组中的索引被跳过；
      // Budget 以已有 requests 初始化，spent 连续不归零。」后半句说的就是这件事。
      // ⚠️ 下面那句认领原先把它列进 `P3.b` 的账里 —— 那是**另一条需求的判据**，
      // 而 `D6.a` 至今没有任何认领（审计逐条报着）。
      //
      // 这一半原先只有下面那条「请求数涨了没有」的散文诊断顶着，而它在结构上分不出两种
      // 起算法：续跑给的额度宽得多，从零起算发的请求只会更多，那条判断照样过
      // （实测：把起算点改成零，整份自检全绿）。
      //
      // 分得开的办法是把额度卡在**只够已经花掉那么多**：起算点对的话第一次请求就超限、
      // 一个请求都不再发；从零起算的话同一份额度被原样重花一遍。
      // ⚠️ 认的是**采集进度**，不是断点里那个请求数 —— 两种起算法下那个数都停在
      // 「额度 ÷ 单价」，恰好相等，拿它断言等于写下一句永远为真的话。
      const stingyLedger = join(tmp, 'stingy-attempts.tsv')
      const stingy = run('collect --resume 额度只够已经花掉的那些',
                         [S('collect.ts'), '--resume', tightDir, '--budget', '0.002'], tmp,
                         { status: 3, stream: 'stdout' }, { FAKE_FETCH_LEDGER: stingyLedger })
      let afterStingy: any
      if (stingy !== undefined) { try { afterStingy = JSON.parse(readFileSync(tightTask, 'utf8')) } catch {} }
      const pagesOf = (t: { offsets?: unknown } | undefined): string =>
        `${t === undefined ? '读不出来' : JSON.stringify(t.offsets)}`
      const pagesBefore = pagesOf(before)
      // ⚠️ 还要求中止那一刻**真的抓到过页**：语料造不出这个前提时两边都空、比较恒真，
      // 这条断言从写下那天起就没验过任何事 —— 那是这个仓库反复栽的形状。
      const measurable = !['读不出来', 'undefined', '{}'].includes(pagesBefore)
      named('续跑的额度只够已经花掉的那些时，一个请求都不再发',
            measurable && pagesOf(afterStingy) === pagesBefore && fetchAttempts(stingyLedger).length === 0
              && afterStingy?.requests === before.requests
              && JSON.stringify(afterStingy?.cost_ledger) === JSON.stringify(before.cost_ledger),
            measurable
              ? `采集进度从 ${pagesBefore} 动到了 ${pagesOf(afterStingy)} —— 续跑的预算没有从`
                + '断点里那个数起算，同一份额度被原样重花了一遍，而用户只确认过一次'
              : `中止那一刻的采集进度是 ${pagesBefore} —— 这条断言的前提没造出来，它证不了任何事`)
      const resumed = run('collect --resume 设置新总预算续跑',
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
      if (stingy !== undefined && resumed !== undefined) criterion('D6.o')
    }
    // 写在整段之后，不写在「续跑」那一半之前：`P3.b` 逐字要求的每一件事都要跑到过才认领得起
    // ——正本在 `docs/requirements.json` 的 `P3.b`，这里不复述它，也不数它有几件。
    // ⚠️ **原先这里数过**（「四半」），而那张清单与 ADR-70 里同名的那张装的不是同一批东西，
    // 两张都少一件，全仓也没有第三处写下过总数。一个写在散文里的数没有任何东西守着它（ADR-82）。
    // 缺省那个验证者够不到入口，所以这条认领只有自检发得出（落地 3 第一片）。
    // ⚠️ 它原先的显式豁免逐字写的就是这个理由，**落地 4 已经撤掉** —— 现在由硬失败
    // 盯着：只由自检认领的判据没有一条 `by: "selfcheck"` 的负片就红。
    // ⚠️ 这条认领只认 `P3.b`。上面那条紧额度断言守的是 `D6.a`（续跑从断点起算），
    // **不在这条认领里** —— 它另有半句（done 里的索引被跳过）这段夹具没有断言，
    // 认领整条就是把没验的那半也算进来。`D6.a` 今天仍按「没有认领」报着，这是实情。
    // ⚠️ 名下的负片各守各的一件：`M-P3-b` 守断点记的内容（`P3.b`）；
    // `M-D6-m` 守续跑的预算从断点起算、`M-D6-n` 守断点还在契约点名的那个文件名（都是 `D6.a`）。
    // 后一条**由 `P3.b` 这条夹具抓到** —— 违反的是谁、被谁抓到，不必是同一条。
    // 「捕获」与「退出码 3」两件今天拿不到负片，理由是判定层的结论，记在 ADR-70。
    criterion('P3.d')
  }
})

// ---- enrich：主页近期样本、公开指标、断点文件 ----
group('enrich', ['collect'], () => {
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

    // ---- 崩溃续跑 C：上一账号的业务缓存与下一请求的费用预留都须保存（D6/D14）----
    // 复制为独立夹具，明确放三个 TikTok 账号、完整新账及一致上限，删掉缓存。
    // 每个主页作品端点 0.001，0.002 正好够两个；不能只把旧 requests 改零而留下旧账。
    // 第一跑：第一个账号查完落盘，在第二个账号的 200 那一瞬被杀。
    // 第二跑同一条命令拒绝未结费用，不重新查询第二个账号。
    const crashDir = `${dir}-crash`
    cpSync(join(tmp, dir), join(tmp, crashDir), { recursive: true })
    const crashTaskFile = join(tmp, crashDir, 'task.json')
    const crashTask = existsSync(crashTaskFile)
      ? JSON.parse(readFileSync(crashTaskFile, 'utf8')) as Record<string, unknown> : undefined
    if (!crashTask) {
      failed++
      console.error(`  ✗ enrich 两个账号之间被杀${SELFCHECK_FIXTURE_MARK}：复制出来的目录里没有 task.json，改不了预算 —— 夹具没造对`)
    } else {
      crashTask.budget_usd = 0.002
      Object.assign(crashTask, knownCosts(2000, []))
      writeFileSync(crashTaskFile, JSON.stringify(crashTask, null, 2))
      for (const file of ['creators.json', 'creators.raw.json'])
        writeFileSync(join(tmp, crashDir, file), JSON.stringify(
          Array.from({ length: 3 }, (_, i) => costPerson('tiktok', `crash-${i}`))))
      rmSync(join(tmp, crashDir, 'enrichment.json'), { force: true })
      const ledgerC = join(tmp, 'ledger-c.tsv')
      const diskC = () => requestsOnDisk(crashTaskFile)
      const firstC = runBoth('enrich 两个账号之间被杀：进程以 137 结束', [S('enrich.ts'), '--dir', crashDir], tmp,
                             { status: 137 }, { FAKE_FETCH_LEDGER: ledgerC, FAKE_FETCH_KILL_AFTER_OK: '2' })
      if (firstC.ok) {
        const disk = jsonFile(crashTaskFile)
        const cached = jsonFile(join(tmp, crashDir, 'enrichment.json'))?.accounts
        named('enrich 两个账号之间被杀：已完成账号的样本缓存已保存',
          cached?.['tiktok:crash-0']?.sample?.status === 'measured'
            && cached['tiktok:crash-0'].sample.value.length === 12
            && cached['tiktok:crash-1'] === undefined,
          `accounts=${JSON.stringify(cached)}`)
        named('enrich 两个账号之间被杀：最后一次预留在盘上且此前终态未丢',
          diskC() === 1 && ledgerLines(ledgerC, true) === 2
            && disk?.cost_ledger?.pending?.endpoint === TT_POSTS
            && disk?.cost_ledger?.pending?.unit_micro_usd === 1000
            && disk?.cost_ledger?.entries?.some((e: any) => e.endpoint === TT_POSTS && e.http_200_count === 1),
          `task=${JSON.stringify(disk)}, attempts=${ledgerLines(ledgerC, true)}`)
        const secondC = runBoth('enrich 两个账号之间被杀后续跑：未结费用退 2', [S('enrich.ts'), '--dir', crashDir], tmp,
                                { status: 2, soft: [0, 1, 3] }, { FAKE_FETCH_LEDGER: ledgerC })
        if (secondC.ok) {
          named('enrich 两个账号之间被杀后续跑：未结占用阻止任何新请求',
                secondC.status === 2 && ledgerLines(ledgerC, true) === 2,
                `退出 ${secondC.status}，账本 200 行 ${ledgerLines(ledgerC, true)}，应仍是 2`)
          extract('C', diskC(), ledgerC, firstC.stderr, secondC.stderr)
        }
      }
    }
  }
})

// ---- render：算分、分层、CSV、HTML、记忆写回 ----
group('render', ['collect', 'enrich'], () => {
  // **整段一起守住,不是只守第一条链。** 这一段往下每一条断言读的都是这次 render 的
  // 产出物,只在第一条链前面判空的话,后面几条兄弟断言照样会跑 —— 轻则拿上一次的
  // 陈旧产物报「✓」,重则 `readFileSync` 直接抛,自检连末尾那句汇总都打不出来
  // （#94 评审指出；本文件另外两处同一形状,改法相同）。
  rendered = dir ? run('render 完整产出', [S('render.ts'), '--dir', dir], tmp) : undefined
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
      named('meta 关键词行保留原任务下标',
        JSON.stringify(meta.keywords?.map((k: any) => k.task_index)) === '[0,1]',
        `meta 关键词下标实际为 ${JSON.stringify(meta.keywords?.map((k: any) => k.task_index))}`)
      const activity = meta.capabilities?.creator_activity
      if (!activity || activity.measured + activity.unavailable + activity.unqueried !== activity.total) {
        failed++; console.error('  ✗ meta.json 缺少完整的 creator_activity 三态统计')
      } else console.log('  ✓ meta.json 含 creator_activity 三态统计')
      // 上面那条只看一个能力，而且**恒等式本身盖不住要防的那件事**：把 unqueried 并进
      // unavailable，三项之和照样等于 total，报表上却再也分不出「没查」和「查了测不出」。
      // 所以这里加两层，各管一件事：**这一条**把平账铺到每个能力上（哪一个漏项都报得出名字），
      // **下一条**才是冲着并桶去的 —— 并桶时这一条仍然全绿，只有下一条会红。
      //
      // ⚠️ 下一条不是「三个桶都得有人」。那个写法试过，**并桶之后照样全绿** ——
      // 六个能力里有两个的计数在入口里另算、不走被并掉的那个函数，它们把全局的和撑住了
      // （ADR-90 第三节）。所以下一条钉的是场景，不是求和。
      const caps: Array<[string, Record<string, number>]> = Object.entries(meta.capabilities ?? {})
      const offBooks = caps.filter(([, v]) => v.measured + v.unavailable + v.unqueried !== v.total)
      named('每个能力的三态各自平账', caps.length > 0 && offBooks.length === 0,
        `对不上账的是 ${offBooks.map(([k]) => k).join('、') || '（一个能力都没报出来）'}`)
      // 这一跑没有配置报价层，所以 collaboration_quote 是**一个人都没查过** ——
      // 整数必须落在 unqueried 上。并桶的那一刻它会跑到 unavailable 去，
      // 而恒等式对此一声不吭：上面那两条在并桶时照样全绿，只有这一条会红。
      // 挑它而不挑别的：这一跑里只有它既走 countMeasurements、又整份是「没查过」。
      const quote = meta.capabilities?.collaboration_quote
      named('「没查过」没被并进「查了测不出」', quote !== undefined && quote.unqueried === quote.total,
        `这一跑没配报价层，collaboration_quote 应当整份记在 unqueried，实际 ${JSON.stringify(quote)}`)
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
    // 再加一道判空只会多一层缩进而不多守住任何东西。
    run('render 复位（回到未增强的产出）', [S('render.ts'), '--dir', dir], tmp)
  }
})

// ---- 回归：collect → render → --resume 之后，已采集的人必须还在 ----
group('regress', ['collect', 'render'], () => {
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
})

// ---- 记忆读不出来：不产出名单、不覆盖原文件、逃生口要显式打出来（ADR-15）----
group('memory', ['collect', 'render'], () => {
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
      // 余额不足以支付下一请求时，光 --resume 会再退 3（F7.d、D13）；
      // 无待查项时不该要求改额，有这条不足提示时修复命令必须带 --budget，两者同进同出。
      const budgetInsufficient = /不足以支付下一(?:次)?请求/.test(stderr)
      const cmdHasBudget = /修好它再跑:.*--budget <新额度>/.test(stderr)
      if (budgetInsufficient !== cmdHasBudget) {
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
    // 没活可干：target_count 给 1，达标提前停下 —— 三个关键词都在第一轮问过了第一页
    // （F9），第一页之后照旧按达标停，所以续跑一个都不会抓（D6.g）；
    // profile 也在这一轮补全过了（D6.d）。
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
    // 造法：**只给一个关键词** —— 它抓完第一页就不再欠着，target_count 给 1 让它
    // 当场达标，于是关键词那一半确实为空（D6.g）。预算恰好只够那一次搜索
    // （0.001 = 一次请求），补全循环第一个人就撞上预算，没人补成（D6.d）。
    // 所以这一条**只能**由 profile 那一半说话，关键词那一半必须一个字都不出现。
    //
    // ⚠️ **原先给的是三个关键词**，靠的是「第一个就达标、剩下两个续跑一个都不会抓」——
    // F9 之后那句不成立了：没抓过第一页的任务，达标也照样会去抓，于是关键词那一半
    // 又冒了出来，这条夹具当场红。**它红得对** —— 它守的是「递进去的那批人有没有人守着」，
    // 而不是「达标之后一律不抓」。把前提换成真正为空的那一种，守的东西一点没变。
    const onlyCfg = join(tmp, 'only-profile.json')
    writeFileSync(onlyCfg, JSON.stringify({
      product: 'onlyprofile', market: 'US', target_count: 1, budget_usd: 0.001,
      tasks: [{ keyword: 'ok0', dimension: 'category', platform: 'tiktok' }],
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
    // 这个夹具里补全没把人筛下去，收尾时 qualified 仍够目标，且三个关键词都问过了
    // 第一页，所以那句话说不花钱（D6.g 按调用那一刻的 qualified 算）。
    // 筛掉之后结论会反过来 —— ADR-94 第十三节。
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
    criterion('D6.r')

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
})

// ---- F9：达标判断不得让任何一个关键词×平台连第一页都没抓到 ----
group('f9', [], () => {
  // 达标判断原先跑在**每一次**搜索之前、第一轮也不例外：前面几个词各抓一页就填满目标时，
  // 后面的任务一个请求都不发 —— 而 task.json 的顺序由 Agent 决定，实测 IG 写在后面时
  // 整个平台为零，报告里它和「查了没人」长得一模一样（ADR-94）。
  //
  // 只能这样真跑：缺省那个验证者（scripts/test.ts）够不到入口脚本的调度循环。
  // scripts/test.ts 那一头断言的是「续跑会去抓哪些」那份判定本身（D6.g、F9.c～F9.e）。
  //
  // 「这个任务问过第一页没有」不另外数请求，读 task.json 的分页记录表：写下那个键本身
  // 就是这个任务抓过第一页的记录（F9），所以键在不在就是答案。
  const firstPage = join(tmp, 'firstpage')
  mkdirSync(join(firstPage, 'memory'), { recursive: true })
  const F9_TASKS = 6
  /**
   * 六个关键词、两个平台交替，`order` 决定它们在 task.json 里的先后。
   *
   * `target_count` 给 1：第一个词抓完第一页就达标，于是**整轮都在达标之后跑** ——
   * 这正是这条需求要管的那个局面。
   */
  const f9Cfg = (name: string, order: number[], over: Record<string, unknown> = {}) => {
    const f = join(firstPage, `${name}.json`)
    const all = Array.from({ length: F9_TASKS }, (_, i) => ({
      keyword: `f9k${i}`,
      dimension: i % 2 ? 'scene' : 'category',
      platform: i % 2 ? 'instagram' : 'tiktok',
    }))
    writeFileSync(f, JSON.stringify({
      product: name, market: 'US', target_count: 1, budget_usd: 1,
      tasks: order.map(i => all[i]), ...over,
    }))
    return f
  }
  /** 分页记录表里有键的任务个数 —— 「问过第一页」的唯一记录 */
  const asked = (dir: string): number => Object.keys(
    JSON.parse(readFileSync(join(firstPage, dir, 'task.json'), 'utf8')).offsets ?? {}).length

  const ascRun = runBoth('collect 第一页保证：正序跑一遍',
                         [S('collect.ts'), '--config', f9Cfg('asc', [0, 1, 2, 3, 4, 5])], firstPage)
  const descRun = runBoth('collect 第一页保证：同一批任务倒序再跑一遍',
                          [S('collect.ts'), '--config', f9Cfg('desc', [5, 4, 3, 2, 1, 0])], firstPage)
  if (ascRun.ok && descRun.ok) {
    const asc = summaryOf(ascRun.stdout)
    const desc = summaryOf(descRun.stdout)
    if (asc.stopped !== 'target' || desc.stopped !== 'target') {
      failed++
      // 记号在这儿：这一行红说明**夹具废了**，不是断言说了话 —— F9.a 逐字说的是
      // 「以达标收尾时」，走的不是那条收尾，下面绿了也不算测过（同 endPath 的先例）
      console.error(`  ✗ 第一页保证的夹具${SELFCHECK_FIXTURE_MARK}：这两次走的不是达标那条收尾`
                    + `（正序 ${asc.stopped}、倒序 ${desc.stopped}）`)
    } else {
      named('达标收尾时每个关键词×平台都问过一次，换个顺序也一样',
            asked(asc.dir) === F9_TASKS && asked(desc.dir) === F9_TASKS,
            `正序问过 ${asked(asc.dir)}/${F9_TASKS} 个、倒序 ${asked(desc.dir)}/${F9_TASKS} 个`
            + ' —— 没问到的那些在报告里和「查了没人」长得一模一样，用户据此以为那个平台没有合适的人')

      // F9.d：第一页保证是**范围边界**，不是「无视达标一直翻」。这个目录里每个任务都
      // 已经问过第一页，所以续跑一个请求都不该发。请求数跨运行累加（D6.a），
      // 两次的差就是这一次真发了多少 —— 不必另外数。
      //
      // ⚠️ **这一条没有负片指着它**，F9.d 的负片 `M-F9-d` 指的是那份判定本身、跑的是
      // `scripts/test.ts`。理由实测过：任何让采集多发一次请求的变异，都会把上面
      // 「补 profile 循环里被杀后续跑」那条额度卡死的夹具顶成退出码 3 ——
      // 那是**进程级**失败，一票否决整次运行（`judgeRun`），于是变异判「跑不起来」
      // 而不是「被抓到」。那条夹具的额度是按「上限恰好花完」算的，为了这条去放宽它，
      // 它自己那句「供应商多收恰好两次」就不成立了。所以这一条是**白得的端到端保险**，
      // 不是它的第三拍 —— 别把它读成「这段接线有人守着」。
      const again = run('collect 第一页保证：每个任务都问过之后再续跑一次',
                        [S('collect.ts'), '--resume', asc.dir, '--budget', '2'], firstPage,
                        { status: 0, stream: 'stdout' })
      if (again !== undefined) {
        const after = summaryOf(again).requests
        named('第一页之后照旧按达标停下 —— 已经问过的不再多翻一页',
              after === asc.requests,
              `续跑又发了 ${after - asc.requests} 次请求 —— 第一页保证只保证第一页，`
              + '接着翻下去花的是用户没打算花的钱')
      }
    }
  }

  // F9.b：预算不够给每个任务抓第一页时 **P3 赢** —— 照旧退 3、存断点，
  // 没问到的如实列出，不得为了抓齐第一页超出预算（F9×P3 的裁定，ADR-94 第三节）。
  // 六个任务，预算只够三次搜索，所以没问到的正好三个。**这个数字写死是有意的**：
  // 写成 `\d+` 的话，把没问到的少报一个照样绿 —— 而少报的那一个，续跑不会去抓它，
  // 它的第一页就永远丢了。
  const tightRun = runBoth('collect 第一页保证：预算不够抓齐第一页',
                           [S('collect.ts'), '--config',
                            f9Cfg('tight', [0, 2, 4, 1, 3, 5], { budget_usd: 0.003 })],
                           firstPage, { status: 3 })
  if (tightRun.ok) {
    const tight = summaryOf(tightRun.stdout)
    if (tight.stopped !== 'budget') {
      failed++
      console.error(`  ✗ 预算不够抓齐第一页的夹具${SELFCHECK_FIXTURE_MARK}：`
                    + `这一次走的不是预算那条收尾，是 ${tight.stopped}`)
    } else {
      named('预算不够抓齐第一页时按预算停下，没问到的如实列出',
            tight.cost_estimate_usd <= tight.budget_usd && /还有 3 个关键词/.test(tightRun.stderr),
            `花了 ${tight.cost_estimate_usd}/${tight.budget_usd}，那句话说的是`
            + `「${tightRun.stderr.split('\n').find(l => l.includes('续跑')) ?? '（没说）'}」`
            + ' —— 第一页保证在达标判断之前生效，不在预算之前；少报一个，那个词的第一页就永远丢了')
    }
  }

  // **预算那一侧，顺序照样决定谁被砍掉** —— 达标那一侧不决定（上面 asc／desc 两跑），
  // 两件事必须分开说。`skill/SKILL.md` 一度把它写成无条件的「顺序不再决定谁被砍掉，
  // IG 写在前面还是后面都一样」，而那句话在预算先用尽时是假的：排在后面的**整个平台**
  // 可能一次都没被问过 —— 正是这条需求最初要修的那个形状的另一半（ADR-94 第一节）。
  // 这一条钉住的就是那句改过的话：散文不会红，夹具会。
  {
    const platformsAsked = (dir: string): string[] => {
      const st = JSON.parse(readFileSync(join(firstPage, dir, 'task.json'), 'utf8'))
      return Object.keys(st.offsets ?? {}).map((k: string) => st.tasks[Number(k)].platform).sort()
    }
    // 上面那一跑是 [0,2,4,1,3,5]：偶数下标是 tiktok，所以 TikTok 三个排在前面
    const tkFirstDir = tightRun.ok ? summaryOf(tightRun.stdout).dir : undefined
    const igRun = runBoth('collect 第一页保证：同一批任务、同样预算，只把 IG 排到最前',
                          [S('collect.ts'), '--config',
                           f9Cfg('tightig', [1, 3, 5, 0, 2, 4], { budget_usd: 0.003 })],
                          firstPage, { status: 3 })
    const igFirstDir = igRun.ok ? summaryOf(igRun.stdout).dir : undefined
    if (tkFirstDir !== undefined && igFirstDir !== undefined) {
      const a = platformsAsked(tkFirstDir)
      const b = platformsAsked(igFirstDir)
      named('预算先用尽时顺序决定哪个平台整个挨刀 —— 换个顺序，挨刀的就换一个',
            a.length === 3 && b.length === 1
            && a.every(x => x === 'tiktok') && b.every(x => x === 'instagram'),
            `TikTok 排前时问过的是 ${JSON.stringify(a)}，IG 排前时是 ${JSON.stringify(b)}`
            + ' —— 两次问过的平台必须相反；一样的话说明顺序不再决定谁挨刀，'
            + '那 SKILL.md 里「预算不够时把最在意的平台排在前面」这条建议就成了空话')
    }
  }

  // 三条一起才是这条需求：换顺序都问过（F9.a）、预算不够时 P3 赢（F9.b）、
  // 第一页之后照旧按达标停（F9.d）。剩下两条判据在 scripts/test.ts 里 ——
  // 「续跑会去抓哪些」那份判定只此一份（F9.c）、整张分页记录表缺失读作无从确认（F9.e）。

  // F9.e：旧目录 —— `task.json` 里**根本没有**分页记录表（F9 落地之前那一版留下的）。
  // 「无从确认」不得读成「都没查过」：读错了就从 offset 0 把已经付过钱的几页重买一遍。
  //
  // **必须端到端跑。** 单元那一头只看得到判定的返回值，看不到入口在**达标判断之前**
  // 有没有真的把闸放下 —— #138 评审之前那道闸写在 `target` 分支里面，没达标那条路
  // 压根走不到它，实测 `requests` 4 → 172、已付过钱的 offsets 被整批重买。
  //
  // 夹具的两个前提，缺一个这一条就什么都证不到（头一版两个都没造对，M-F9-f 当场存活）：
  // ① **第一跑要被预算卡停，不能跑满页数上限** —— 跑满了两个词都会进 `done`，
  //    续跑在 `exhausted` 那一关就 continue 了，根本走不到要测的那道闸；
  // ② **要数供应商真正收到几次搜索，不能数 `requests`、也不能看盘上那张表** ——
  //    续跑要补 profile，`requests` 本来就会涨；而闸被拿掉时写入落进的是一张丢弃的
  //    局部表，盘上那张表照样缺失（`collect.ts` 里那对注释说的正是这个静默）。
  const legacyCfg = join(firstPage, 'legacy.json')
  writeFileSync(legacyCfg, JSON.stringify({
    product: 'legacy', market: 'US', target_count: 9999, budget_usd: 0.004,
    tasks: [{ keyword: 'lg0', dimension: 'category', platform: 'tiktok' },
            { keyword: 'lg1', dimension: 'category', platform: 'tiktok' }],
  }))
  const legacyFirst = runBoth('collect 第一页保证：先跑出一个被预算卡停的目录',
                              [S('collect.ts'), '--config', legacyCfg], firstPage, { status: 3 })
  if (legacyFirst.ok) {
    const before = summaryOf(legacyFirst.stdout)
    const taskPath = join(firstPage, before.dir, 'task.json')
    // 断点不在约定的文件名下时（`M-D6-n` 那类变异）读成 `undefined` 让下面整段跳过，
    // **不是让自检崩** —— 崩了那条变异就被判「跑不起来」，而它本该被别处的夹具抓到
    // （同本文件 `requestsOnDisk` 的先例）。
    let legacyState: any
    try { legacyState = JSON.parse(readFileSync(taskPath, 'utf8')) } catch { legacyState = undefined }
    if (legacyState !== undefined) {
      // 把整张分页记录表删掉 —— 这就是旧目录在盘上的样子（`offsets` 是 7b1acd7 才加的字段）
      delete legacyState.offsets
      writeFileSync(taskPath, JSON.stringify(legacyState, null, 2), 'utf8')
    }

    const legacyLedger = join(tmp, 'ledger-legacy.tsv')
    const again = runBoth('collect 第一页保证：在旧目录上续跑',
                          [S('collect.ts'), '--resume', before.dir, '--budget', '2'], firstPage,
                          undefined, { FAKE_FETCH_LEDGER: legacyLedger })
    if (legacyState !== undefined && !legacyState.done.length && again.ok) {
      named('分页记录表整张缺失时，一次关键词搜索都不发',
            searchHits(legacyLedger) === 0,
            `供应商收到了 ${searchHits(legacyLedger)} 次关键词搜索`
            + ' —— 这个目录里哪些词查过是无从确认的，照第一页重抓等于把已经付过钱的那几页再买一遍')
      // 期望出自 F9.e 原文「不得读作『都查过了』」：done 就是「查完了」（D6.n），
      // 这个目录的第一跑没把任何词记完成（上面那个 if 的前提），续跑也不许记。
      const legacyAfter = jsonFile(taskPath)
      named('分页记录表整张缺失时，续跑不把任何关键词记成已完成',
            Array.isArray(legacyAfter?.done) && legacyAfter.done.length === 0,
            `盘上 done=${JSON.stringify(legacyAfter?.done)} —— 无从确认哪些词查过，记进 done 就是读成了「都查过了」，`
            + 'F9.e 逐字禁的第二种误读；这些词此后再也不会被碰')
      named('分页记录表整张缺失时，收尾那句话说得出「无从确认」',
            again.stderr.includes('无从确认') && !again.stderr.includes('采集与补全都已跑完'),
            // 认代价那句话的三种写法，**不认「续跑」两个字** —— 那会先抓到入口打的
            // 「续跑 <目录> —— 已完成 …」那句横幅，诊断于是说错话（实测）
            `那句话是「${again.stderr.split('\n').find(l =>
                /无从确认|续跑不产生新的请求|续跑会继续发请求/.test(l)) ?? '（没说）'}」`
            + ' —— 说成「都已跑完」就是把无从确认读成了「都查过了」，F9.e 逐字禁的第二种误读')
    } else if (legacyState !== undefined && again.ok) {
      failed++
      console.error(`  ✗ 旧目录夹具${SELFCHECK_FIXTURE_MARK}：第一跑把关键词标完成了`
                    + `（done=${JSON.stringify(legacyState.done)}）—— 续跑在 exhausted 那一关就跳过了，`
                    + '走不到要测的那道闸')
    }
  }

  criterion('F9.a')
  criterion('F9.b')
  criterion('F9.d')
  criterion('F9.e')
})

// ---- D6.i／D6.l：请求发出去了、钱扣了，在记下来之前抛了 ----
group('d6il-paid', [], () => {
  // 供应商换了响应结构：200 已返回、`charge()` 已计费且不退，而 `pickList` 认不出结构抛出。
  // 这条路上 `offsets` 那个键从头到尾没被写过 —— 一度打算拿它兼职回答「问过没有」，
  // 于是一个付过钱的词在盘上看起来像从没问过（ADR-94 第十五节甲，独立复核的实测反例）。
  // **只能端到端跑**：写它的是入口脚本搜索调用外面那个 finally，缺省那个验证者够不到。
  const paid = join(tmp, 'paidbutlost')
  mkdirSync(join(paid, 'memory'), { recursive: true })
  const paidCfg = join(paid, 'paid.json')
  writeFileSync(paidCfg, JSON.stringify({
    product: 'paidlost', market: 'US', target_count: 9999, budget_usd: 1,
    tasks: [{ keyword: 'force-schema-kw', dimension: 'category', platform: 'tiktok' }],
  }))
  // 认不出结构 → TikHubError 冒到 main()，stopped='error'、退出码 1
  const paidRun = runBoth('collect 请求成功计费之后才抛：以出错收尾',
                          [S('collect.ts'), '--config', paidCfg], paid, { status: 1 })
  if (paidRun.ok) {
    const pdir = onlyDir(paid, 'paidlost')
    // 断点不在约定的文件名下时（`M-D6-n` 那类变异）读成 undefined 让这一段跳过，
    // **不是让自检崩** —— 崩了那条变异会被判「跑不起来」，功劳记错了人
    // （同本文件 `requestsOnDisk` 的先例）。
    let pstate: any
    try { pstate = JSON.parse(readFileSync(join(paid, pdir ?? '', 'task.json'), 'utf8')) } catch {}
    if (pstate !== undefined) {
      named('请求付过钱就留得下痕迹，哪怕它抛在记录之前',
            pstate.answered?.[0] >= 1 && pstate.requests >= 1
            && pstate.offsets !== undefined && pstate.offsets[0] === undefined,
            `盘上 answered=${JSON.stringify(pstate.answered)}、offsets=${JSON.stringify(pstate.offsets)}、`
            + `requests=${pstate.requests} —— 只认 offsets 的话这个词看起来从没问过，`
            + '而它的钱已经花掉了，续跑会再买一次同样的第一页')
      named('那一次拿回几条永远补不回来 → 条数记成「注定不全」',
            pstate.found !== undefined && pstate.found[0] === null,
            `盘上 found=${JSON.stringify(pstate.found)} —— 不记 null 的话，下一页成功时`
            + '它会从 0 重新数起，凑出一个偏小、却和真测量值印在同一列的数')
    }
    // 供应商把结构改回来之后**又抓成功了几页**：那个 null 不许被凑成一个数（D6.l）。
    // ⚠️ 这一段就是独立复核第二条 blocking 的复现，实测 found 会从 null 变成 12。
    if (pdir !== undefined) {
      let ok = false
      try {
        const f = join(paid, pdir, 'task.json')
        const st = JSON.parse(readFileSync(f, 'utf8'))
        st.tasks[0].keyword = 'recovered-kw'      // 结构认得出了
        writeFileSync(f, JSON.stringify(st, null, 2), 'utf8')
        ok = true
      } catch {}
      if (ok) {
        const again = runBoth('collect 供应商把结构改回来了：同一个词又抓成功几页',
                              [S('collect.ts'), '--resume', pdir, '--budget', '1'], paid)
        if (again.ok) {
          let st2: any
          try { st2 = JSON.parse(readFileSync(join(paid, pdir, 'task.json'), 'utf8')) } catch {}
          named('又抓成功几页，也不把「注定不全」凑成一个数',
                st2?.found !== undefined && st2.found[0] === null && st2.offsets?.[0] > 0,
                `盘上 found=${JSON.stringify(st2?.found)}、offsets=${JSON.stringify(st2?.offsets)}`
                + ' —— 真值是它加上第一次那笔已付费的未知条数，凑出来的那个数偏小却像测量值')
        }
      }
    }
  }
})

// ---- D6.i／D6.l：402 退了费 —— 钱没花，盘上不许记成「发出过付费请求」 ----
group('d6il-402', [], () => {
  // 判据逐字：「402／429 退了费的不计入 —— 钱没花、续跑会照常重试，读作『还没问过』
  // 既如实也可行动。」这一半在**入口**：`paid` 取的是预算计数器的**净**增量，
  // `charge()` 加、`refund()` 减，402 那一次净增 0。
  // ⚠️ 独立复核实测：把 `paid` 换成 `Math.max(…, 1)`，整条检查链一个字都不说 ——
  // 一个一分钱没花的词从此在盘上「发出过 1 次付费请求」，而且因为它抛了，
  // 条数还被永久钉成 `null`（ADR-94 第十五节丙）。
  const refunded = join(tmp, 'refunded402')
  mkdirSync(join(refunded, 'memory'), { recursive: true })
  const refCfg = join(refunded, 'ref.json')
  writeFileSync(refCfg, JSON.stringify({
    product: 'refunded', market: 'US', target_count: 9999, budget_usd: 1,
    tasks: [{ keyword: 'force-402-kw', dimension: 'category', platform: 'tiktok' }],
  }))
  // 402 是对面拒收：不重试、直接抛穿搜索循环 → stopped='error'、退出码 1
  const refRun = runBoth('collect 供应商拒收（402）：以出错收尾',
                         [S('collect.ts'), '--config', refCfg], refunded, { status: 1 })
  if (refRun.ok) {
    let rstate: any
    try {
      rstate = JSON.parse(readFileSync(join(refunded, onlyDir(refunded, 'refunded') ?? '', 'task.json'), 'utf8'))
    } catch {}
    if (rstate !== undefined) {
      named('退了费的那一次不留痕迹 —— 钱没花，续跑会照常重试它',
            rstate.answered !== undefined && rstate.answered[0] === undefined
            && rstate.found !== undefined && rstate.found[0] === undefined
            && rstate.requests === 0,
            `盘上 answered=${JSON.stringify(rstate.answered)}、found=${JSON.stringify(rstate.found)}、`
            + `requests=${rstate.requests} —— 一分钱没花的词被记成「发出过付费请求」，`
            + '而且因为它抛了，条数还会被永久钉成 null：一个从没查过的词从此「注定不全」')
    }
  }
})

// ---- D6.j：上一版留下的目录，两张表缺着就一直缺着 ----
group('d6j-legacy', [], () => {
  // **只能端到端跑**：建表那两处都在入口脚本里，缺省那个验证者够不到
  // （实测 `M-D6-q` 在 npm test 下存活）。
  //
  // 造法：正常跑出一个目录 → 删掉 answered／found 两张表（＝本条落地之前建的目录）
  // → 续跑 → 看盘上有没有凭空长出一张空表。
  //
  // ⚠️ 代价是明写在判据里的：这种目录升级之后**也不会**长出这两张表，一直说「无从确认」。
  // 上一版试过「按分页记录照实迁移」，独立复核当场推翻：`offsets` 为空（钱花了、
  // 在写游标之前抛了）的那种旧目录，迁移照样建出 `answered: {}` ——
  // 一句肯定的假话，而同一份文件里 `requests: 1` 证明反面（ADR-94 第十五节丙，含实测）。
  const migBase = join(tmp, 'migrate')
  mkdirSync(join(migBase, 'memory'), { recursive: true })
  const migCfg = (name: string, budget: number) => {
    const f = join(migBase, `${name}.json`)
    writeFileSync(f, JSON.stringify({
      product: name, market: 'US', target_count: 9999, budget_usd: budget,
      tasks: [{ keyword: 'mg0', dimension: 'category', platform: 'tiktok' }],
    }))
    return f
  }
  /** 删掉两张新表，把目录退回成上一版的样子 */
  const stripNewTables = (dir: string): boolean => {
    const f = join(migBase, dir, 'task.json')
    try {
      const st = JSON.parse(readFileSync(f, 'utf8'))
      delete st.answered; delete st.found
      writeFileSync(f, JSON.stringify(st, null, 2), 'utf8')
      return true
    } catch { return false }
  }
  const migState = (dir: string): any => {
    try { return JSON.parse(readFileSync(join(migBase, dir, 'task.json'), 'utf8')) } catch { return undefined }
  }
  /** 两张表还缺着没有 —— 诊断文案共用，**标签留给调用点写字面量**（见 `runBoth` 的 soft） */
  const tablesAbsent = (st: any): [boolean, string] => [
    st !== undefined && st.answered === undefined && st.found === undefined,
    `盘上 answered=${JSON.stringify(st?.answered)}、found=${JSON.stringify(st?.found)}、`
    + `requests=${st?.requests} —— 空表是一句肯定的假话（「一个都没问过」），`
    + '而这种目录的钱早就花了；一句诚实的「无从确认」退化成假话，而且不可逆',
  ]

  // (a) 续跑一次请求都发不出去：两张表缺着就该一直缺着
  {
    const first = runBoth('collect 旧目录夹具 a：先跑出一个正常目录',
                          [S('collect.ts'), '--config', migCfg('miga', 0.004)], migBase, { status: 3 })
    const dir = first.ok ? summaryOf(first.stdout).dir : undefined
    if (dir !== undefined && stripNewTables(dir)) {
      // 新总上限等于已经占用的 0.004；不能改到占用以下来伪造预算不足分支。
      const again = runBoth('collect 旧目录夹具 a：旧目录上续跑，一次请求都发不出去',
                            [S('collect.ts'), '--resume', dir, '--budget', '0.004'],
                            migBase, { status: 3 })
      if (again.ok) {
        named('旧目录续跑之后，两张表仍然缺着 —— 不凭空建出一张空表', ...tablesAbsent(migState(dir)))
      }
    }
  }

  // (b) 续跑真的又抓了几页：照样不建表 —— 惰性建表和开跑就建一样坏
  {
    const first = runBoth('collect 旧目录夹具 b：先跑出一个被预算卡停的目录',
                          [S('collect.ts'), '--config', migCfg('migb', 0.002)], migBase, { status: 3 })
    const dir = first.ok ? summaryOf(first.stdout).dir : undefined
    if (dir !== undefined && stripNewTables(dir)) {
      const again = runBoth('collect 旧目录夹具 b：旧目录上续跑，这次真的又抓了几页',
                            [S('collect.ts'), '--resume', dir, '--budget', '1'], migBase)
      if (again.ok) {
        named('旧目录上又抓了几页，两张表照样不建 —— 惰性建表和开跑就建一样坏',
              ...tablesAbsent(migState(dir)))
      }
    }
  }
})

// ---- D6.h / D6.m：页数上限跨运行有效 ----
group('d6h-pagecap', [], () => {
  // **只能端到端跑**：计数与那道闸都在入口脚本里，缺省那个验证者够不到；而且这条判据
  // 说的正是「**跨运行**」—— 一次进程内的断言天然证不了它。
  //
  // 修之前实测：同一个关键词跨四次续跑累计抓到 **12** 页（上限 4）。原因不是「预算
  // 那条路径」—— 把本轮页数兑现成持久事实的那段收尾循环排在搜索循环**之后**，
  // 任何从 `api.search` 抛穿 `run()` 的异常都会把它整个掀掉（预算用尽只是其中一种，
  // 供应商换了响应结构走的是同一条），于是翻满 4 页却没进 done 的词在续跑里重新拿一份配额。
  const capBase = join(tmp, 'pagecap')
  mkdirSync(join(capBase, 'memory'), { recursive: true })
  const capCfg = (name: string, budget: number, keywords: readonly string[]) => {
    const f = join(capBase, `${name}.json`)
    writeFileSync(f, JSON.stringify({
      product: name, market: 'US', target_count: 9999, budget_usd: budget,
      tasks: keywords.map(k => ({ keyword: k, dimension: 'category', platform: 'tiktok' })),
    }))
    return f
  }
  const capState = (dir: string): any => {
    try { return JSON.parse(readFileSync(join(capBase, dir, 'task.json'), 'utf8')) } catch { return undefined }
  }

  // (a) 跨运行累计。额度手算：UNIT_PRICE 0.001，budget 0.003 → 正好 3 次付费搜索，
  //     于是第一跑停在 3 页（不到上限 4、也没进 done）——这一半正是修之前会被丢掉的记录。
  {
    const first = runBoth('collect 页数上限夹具 a：先被预算卡停在上限以下',
                          [S('collect.ts'), '--config', capCfg('capa', 0.003, ['cap0'])],
                          capBase, { status: 3 })
    const dir = first.ok ? summaryOf(first.stdout).dir : undefined
    if (dir !== undefined) {
      const mid = capState(dir)
      named('被预算卡停的那一跑也把已抓页数落了盘 —— 丢了它，续跑就是一份新配额',
            mid?.pages?.[0] === 3 && mid.done.includes(0) === false,
            `盘上 pages=${JSON.stringify(mid?.pages)}、done=${JSON.stringify(mid?.done)}`)
      const capLedger = join(tmp, 'ledger-pagecap.tsv')
      const again = runBoth('collect 页数上限夹具 a：预算给足，续跑',
                            [S('collect.ts'), '--resume', dir, '--budget', '2'], capBase,
                            undefined, { FAKE_FETCH_LEDGER: capLedger })
      if (again.ok) {
        const after = capState(dir)
        named('collect 本轮达到页数上限的进度保留完整原任务标签',
          again.stderr.split('\n').some(l => l.includes('达页数上限')
            && l.includes('任务 1 · category · tiktok · 关键词「cap0」')),
          `达上限进度实际为 ${JSON.stringify(again.stderr.split('\n').filter(l => l.includes('达页数上限')))}`)
        // 4 是 `MAX_PAGES`（`lib/pipeline.ts`）。改那个常量本来就该让这一条红 —— 它是对外契约
        named('跨运行累计停在页数上限 4 页 —— 预算给多少都一样',
              after?.pages?.[0] === 4 && after.done.includes(0) === true,
              `盘上 pages=${JSON.stringify(after?.pages)}、done=${JSON.stringify(after?.done)}、`
              + `offsets=${JSON.stringify(after?.offsets)} —— 修之前这里会一路涨到 12 页`)
        const moreLedger = join(tmp, 'ledger-pagecap-more.tsv')
        const third = runBoth('collect 页数上限夹具 a：达上限之后再续一次',
                              [S('collect.ts'), '--resume', dir, '--budget', '2'], capBase,
                              undefined, { FAKE_FETCH_LEDGER: moreLedger })
        if (third.ok) {
          named('达上限之后续跑一次关键词搜索都不发', searchHits(moreLedger) === 0,
                `供应商收到了 ${searchHits(moreLedger)} 次关键词搜索 —— 上限只有在「不再发请求」时才是上限`)
        }
      }
    }
  }

  // (b) 上一版留下的目录（有游标、没有页数表）。两种读法必须分开，不能一刀切。
  {
    const first = runBoth('collect 页数上限夹具 b：先跑出一个目录',
                          [S('collect.ts'), '--config', capCfg('capb', 0.002, ['cap1', 'cap2'])],
                          capBase, { status: 3 })
    const dir = first.ok ? summaryOf(first.stdout).dir : undefined
    let staged = false
    if (dir !== undefined) {
      try {
        const f = join(capBase, dir, 'task.json')
        const st = JSON.parse(readFileSync(f, 'utf8'))
        delete st.pages                 // ← 退回成上一版的样子
        st.offsets = { 0: 9 }           // 任务 0 抓过（几页无从确认）；任务 1 连键都没有
        st.done = []
        writeFileSync(f, JSON.stringify(st, null, 2), 'utf8')
        staged = true
      } catch {}
    }
    if (dir !== undefined && staged) {
      const legLedger = join(tmp, 'ledger-pagecap-legacy.tsv')
      const again = runBoth('collect 页数上限夹具 b：上一版留下的目录上续跑',
                            [S('collect.ts'), '--resume', dir, '--budget', '2'], capBase,
                            undefined, { FAKE_FETCH_LEDGER: legLedger })
      if (again.ok) {
        const after = capState(dir)
        named('旧目录：页数表缺着就一直缺着，不凭空建出一张空表',
              after !== undefined && after.pages === undefined,
              `盘上 pages=${JSON.stringify(after?.pages)} —— 空表把「无从确认」抹成`
              + '「一页都没抓过」，而那正好给它一份新的满配额，且不可逆')
        named('旧目录：游标里有键的不再翻页，游标里没有键的照样补到第一页（F9 不受影响）',
              after?.offsets?.[0] === 9 && after?.offsets?.[1] !== undefined,
              `盘上 offsets=${JSON.stringify(after?.offsets)} —— 任务 0 的游标一格都不许动`
              + '（抓了几页无从确认→按已达上限处理），而任务 1 一页都没抓过、必须拿到它的第一页')
        named('旧目录：冻住的任务写进 done —— 不写的话调度不抓，而收尾那句话仍把它算进要花钱的那一半',
              after?.done?.includes(0) === true,
              `盘上 done=${JSON.stringify(after?.done)} —— \`pendingKeywords\` 读的就是它（D6.g）`)
      }
    }
  }

  // (c) 开跑时就已达上限、却不在 done 里 —— 顶上那道闸唯一真正管得着的状态。
  //     循环里那句 `else if` 只在**本轮又抓到一页之后**才拦得住，也就是说没有这道闸，
  //     这种状态会先多买一页才停 —— 而判据写的是「达到上限之后不得再发出搜索请求」。
  //     ⚠️ 这一组是补出来的：头一版没有它，拿掉顶上那道闸的负片红在了别处（`elsewhere`），
  //     按 ADR-70 那不算抓到。一条没有夹具走到的分支就是没被验证的分支。
  {
    const first = runBoth('collect 页数上限夹具 c：先跑出一个目录',
                          [S('collect.ts'), '--config', capCfg('capc', 0.002, ['cap3'])],
                          capBase, { status: 3 })
    const dir = first.ok ? summaryOf(first.stdout).dir : undefined
    let staged = false
    if (dir !== undefined) {
      try {
        const f = join(capBase, dir, 'task.json')
        const st = JSON.parse(readFileSync(f, 'utf8'))
        st.pages = { 0: 4 }      // ← 已达上限（4 ＝ MAX_PAGES）
        st.done = []             // ← 却不在 done 里：上一版写下的、或被人手改过的状态
        writeFileSync(f, JSON.stringify(st, null, 2), 'utf8')
        staged = true
      } catch {}
    }
    if (dir !== undefined && staged) {
      const capcLedger = join(tmp, 'ledger-pagecap-atcap.tsv')
      const before = capState(dir)?.offsets?.[0]
      const again = runBoth('collect 页数上限夹具 c：已达上限的状态上续跑',
                            [S('collect.ts'), '--resume', dir, '--budget', '2'], capBase,
                            undefined, { FAKE_FETCH_LEDGER: capcLedger })
      if (again.ok) {
        const after = capState(dir)
        named('collect 开跑时已达页数上限的进度也保留完整原任务标签',
          again.stderr.split('\n').some(l => l.includes('达页数上限')
            && l.includes('任务 1 · category · tiktok · 关键词「cap3」')),
          `达上限进度实际为 ${JSON.stringify(again.stderr.split('\n').filter(l => l.includes('达页数上限')))}`)
        criterion('U8.j')
        named('开跑时就已达上限：一次关键词搜索都不发，不是「先多买一页再停」',
              searchHits(capcLedger) === 0 && after?.offsets?.[0] === before,
              `供应商收到了 ${searchHits(capcLedger)} 次关键词搜索，游标 ${before} → `
              + `${after?.offsets?.[0]} —— 判据写的是「达到上限之后不得再发出搜索请求」，`
              + '循环里那句只在又抓到一页之后才拦得住')
        named('开跑时就已达上限：补记进 done，让调度与收尾那句话对上',
              after?.done?.includes(0) === true,
              `盘上 done=${JSON.stringify(after?.done)}`)
      }
    }
  }

  criterion('D6.h')
  criterion('D6.m')
})

// ---- D6.k：IG 兜底撞上预算时，这个任务不许被烧掉 ----
group('d6k-igfallback', [], () => {
  // 判据逐字点名的三样（不进 done、不以退出码 0 收尾、那句话不说「续跑不产生新的请求」）
  // **全在入口那一层**，provider 契约测试够不到（`scripts/test.ts` 那一组只调 `search()`）。
  // 造法：reels 返回条目但一条都解析不出人 → 走兜底；额度只够一次请求 → 第二次当场抛。
  const igBurn = join(tmp, 'igburn')
  mkdirSync(join(igBurn, 'memory'), { recursive: true })
  const igCfg = join(igBurn, 'ig.json')
  writeFileSync(igCfg, JSON.stringify({
    product: 'igburn', market: 'US', target_count: 9999, budget_usd: 0.003,
    tasks: [{ keyword: 'force-noparse-kw', dimension: 'scene', platform: 'instagram' }],
  }))
  const burnLedger = join(igBurn, 'attempts.tsv')
  const burnRun = runBoth('collect IG 兜底撞上预算',
                          [S('collect.ts'), '--config', igCfg], igBurn, { status: 3, soft: [0] },
                          { FAKE_FETCH_LEDGER: burnLedger, FAKE_FETCH_NO_429: '1' })
  named('IG 兜底撞上预算：按 P3 停下，不以退出码 0 收尾', burnRun.status === 3,
        `实际以退出码 ${burnRun.status} 结束 —— 0 的意思是「这个词跑完了」，`
        + '而预算其实已经见底，兜底那条唯一还能找到人的路一次都没发出去')
  if (burnRun.ok) {
    let bstate: any
    try {
      bstate = JSON.parse(readFileSync(join(igBurn, summaryOf(burnRun.stdout).dir ?? '', 'task.json'), 'utf8'))
    } catch {}
    if (bstate !== undefined) {
      named('IG 兜底只发出 0.002 的 Reels，余额 0.001 不够下一次请求',
        JSON.stringify(fetchAttempts(burnLedger)) === JSON.stringify([`200\t${IG_REELS}`])
          && bstate.requests === 1 && bstate.found?.[0] === null
          && summaryOf(burnRun.stdout).cost_estimate_usd === 0.002
          && !/已用[^\n]*100%/.test(burnRun.stderr),
        `attempts=${JSON.stringify(fetchAttempts(burnLedger))}, summary=${burnRun.stdout}`)
      named('IG 兜底撞上预算：这个任务不进 done，续跑还能再碰它',
            !bstate.done.includes(0) && bstate.answered?.[0] >= 1,
            `盘上 done=${JSON.stringify(bstate.done)}、answered=${JSON.stringify(bstate.answered)}`
            + ' —— 走了兜底的那一页不带续页令牌，把预算用尽吞成正常返回就会当场把它标记完成，'
            + '追加预算续跑时它再也不会被碰，而它是这个词唯一还能找到人的那条路')
      named('IG 兜底撞上预算：不说「续跑不产生新的请求」',
            !burnRun.stderr.includes('续跑不产生新的请求'),
            `那句话是「${burnRun.stderr.split('\n').find(l =>
                /续跑不产生新的请求|追加预算续跑|续跑会继续发请求/.test(l)) ?? '（没说）'}」`
            + ' —— 预算已经见底而工具说「不产生新的请求」，用户据此认定这个词已经跑完了')
    }
  }

  criterion('D6.s')
  criterion('D6.j')
  criterion('D6.k')
  criterion('D6.l')
})

// ---- D6.u／D6.v：IG Reels 顺着续页令牌翻页，令牌只在一次运行内用 ----
group('d6uv-igpaging', [], () => {
  // **只能端到端跑**：「下一页拿什么去请求」「一次运行结束时手里的令牌怎么处置」都是入口脚本的
  // 调度，缺省那个验证者（scripts/test.ts）够不到；而 D6.v 说的正是**跨运行**的事。
  //
  // 期望值一律从需求原文与假供应商的已知行为推出来，推导写在每条断言旁边
  // （process/4-VERIFY.md「expected 不许来自运行结果」）。用到的假供应商行为（fake-fetch.ts）：
  //  · 关键词含 `force-paged` 的 Reels：不带令牌回第 1 页（作者 pager1）并给 `page-2`；
  //    带 `page-2` 回第 2 页并给 `page-3`；带 `page-3` 回第 3 页、**不再给令牌**
  //  · 其余 Reels 回罐头 `igReels`：每次同样 2 个作者、每次都给同一个令牌 `fake-token-for-selfcheck`
  //  · 账本（FAKE_FETCH_LEDGER）只记 pathname、**不带查询串** —— 令牌带没带只能从
  //    FAKE_FETCH_COST_EVENTS 那份逐次记录的 `query` 里读（同 crash-resume A 读 offset 的先例）
  // 单价（ADR-107/108）：IG Reels 0.002/次、TikTok 搜索 0.001/次、profile 0.001/次；
  // 页数上限 4（D6.h 的 `MAX_PAGES`，对外契约）。额度按「已占用 + 这一次 ≤ 上限」放行，
  // 恰好花完那一次照样放行（d6h-pagecap 夹具 a：0.003 正好 3 次 0.001 的搜索）。
  // 每一跑都关掉第 7 次回 429 的触发器 —— IG 翻页让请求数变多，碰上它就多出一行重试。
  //
  // 旧行为（入口没接令牌：IG 每个任务只取一页、第二页起一个请求都不发）下，夹具 1、2、4
  // 各有一条会红。夹具 3 的「一次请求都不发」那一半**分不出**旧行为 —— 旧行为本来就不为
  // 第二页发请求；能分出来的是同一条里的记账那一半（没拿回页，pages 就不许动，D6.h）。
  // 请求数那一半守的是另一种错法：接上了令牌、续跑时却不带令牌退回首页重抓（D6.u 末句、D6.v）。
  const igBase = join(tmp, 'igpaging')
  const TOKEN = 'fake-token-for-selfcheck'
  const igCwd = (name: string): string => {
    const cwd = join(igBase, name)
    mkdirSync(join(cwd, 'memory'), { recursive: true })
    return cwd
  }
  /** 目标一律 9999：罐头里的人远凑不够，达标那条路走不到，停下的理由只剩令牌、上限与预算 */
  const igCfg = (cwd: string, name: string, budget: number, tasks: unknown[]): string => {
    const f = join(cwd, `${name}.json`)
    writeFileSync(f, JSON.stringify({
      product: name, market: 'US', target_count: 9999, budget_usd: budget, tasks,
    }))
    return f
  }
  const igEnv = (ledger: string, events?: string): NodeJS.ProcessEnv => ({
    FAKE_FETCH_LEDGER: ledger, FAKE_FETCH_NO_429: '1',
    ...(events !== undefined ? { FAKE_FETCH_COST_EVENTS: events } : {}),
  })
  /** 每一次 Reels 请求带的令牌，按发出顺序；没带（缺这个参数或空串）记 null */
  const reelsTokens = (events: string): (string | null)[] => fileText(events).split('\n')
    .filter(Boolean)
    .map((line): any => { try { return JSON.parse(line) } catch { return undefined } })
    .filter(e => e?.kind === 'fetch' && e.endpoint === IG_REELS)
    .map(e => typeof e.query?.pagination_token === 'string' && e.query.pagination_token !== ''
      ? e.query.pagination_token as string : null)
  /** 账本里某个端点的 200 行数 */
  const hits = (ledger: string, endpoint: string): number =>
    fetchAttempts(ledger).filter(l => l === `200\t${endpoint}`).length
  /** 收尾那句「续跑要不要花钱」—— 两种说法认一种（同 memory 组的认法） */
  const resumeLine = (stderr: string): string | undefined =>
    stderr.split('\n').find(l => /续跑不产生新的请求|续跑会继续发请求/.test(l))
  /** 把「本地这一次没拿到令牌」说成「服务端那边已经没有了」的那一类说法（D6.u 的措辞约束） */
  const NOT_LOCAL = /没有更多|没更多|无更多|穷尽|没有下一页|无下一页|最后一页|到底了/
  const taskOf = (cwd: string, dir: unknown): any =>
    typeof dir === 'string' ? jsonFile(join(cwd, dir, 'task.json')) : undefined

  // (1) 顺着令牌翻，响应不再给令牌就停。
  //     推导：force-paged 第 1、2 页各交回一个令牌、第 3 页不交回 → 第 1 次不带、第 2 次带 page-2、
  //     第 3 次带 page-3；第 3 页「响应没有令牌」（D6.u 列的停止条件之一）→ 当页记进 done、
  //     不再发第 4 次 → 恰好 3 次 Reels、pages 记 3（三页都真的拿回了，D6.h）。
  //     预算 1 远够 3 × 0.002 + 3 个人的 profile，目标 9999 走不到达标 —— 能让它停的只有令牌。
  {
    const cwd = igCwd('chain')
    const ledger = join(cwd, 'attempts.tsv'), events = join(cwd, 'fetch-events.jsonl')
    // 每次请求出去之前把盘上的 task.json 抄一份。只看收尾那一份的话，「途中把令牌写进去、
    // 进 done 时再删掉」的写法照样干净 —— 而 D6.u 说的是令牌不写进 task.json，不是「最后删掉」。
    // 写法照 cost-resume 那个 observer：挂在假 fetch 外面一层，只读盘、不改行为。
    const outDir = join(cwd, 'output'), snaps = join(cwd, 'task-at-fetch.txt')
    const observer = join(cwd, 'observe-task-at-fetch.mjs')
    writeFileSync(observer, `import { readFileSync, readdirSync, appendFileSync } from 'node:fs'; `
      + `import { join } from 'node:path'; `
      + `const previous = globalThis.fetch; globalThis.fetch = async (...args) => { `
      + `let ds = []; try { ds = readdirSync(${JSON.stringify(outDir)}) } catch {} `
      + `for (const d of ds) { try { appendFileSync(${JSON.stringify(snaps)}, `
      + `readFileSync(join(${JSON.stringify(outDir)}, d, 'task.json'), 'utf8').replace(/\\n/g, '') + '\\n') } catch {} } `
      + `return previous(...args) };`)
    const chain = runBoth('collect IG 续页夹具 1：force-paged 的词顺着令牌翻',
      [S('collect.ts'), '--config', igCfg(cwd, 'igchain', 1,
        [{ keyword: 'force-paged-kw', dimension: 'scene', platform: 'instagram' }])],
      cwd, { status: 0 }, { ...igEnv(ledger, events),
        NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(observer).href)}` })
    if (chain.ok) {
      const dir1 = summaryOf(chain.stdout).dir
      const st = taskOf(cwd, dir1)
      const toks = reelsTokens(events)
      named('IG 续页带上一页交回的令牌：第 1 次不带，第 2、3 次依次带 page-2、page-3',
        JSON.stringify(toks) === JSON.stringify([null, 'page-2', 'page-3']),
        `Reels 请求带的令牌依次是 ${JSON.stringify(toks)} —— 只取一页的话后两页一次都没问；`
        + '不带令牌重问的话拿回的永远是第 1 页，钱花了、人一个没多')
      named('IG 响应不再给令牌就停：恰好 3 次 Reels 搜索，pages 记 3，任务进 done',
        hits(ledger, IG_REELS) === 3 && st?.pages?.[0] === 3 && st?.done?.includes(0) === true,
        `Reels ${hits(ledger, IG_REELS)} 次，盘上 pages=${JSON.stringify(st?.pages)}、`
        + `done=${JSON.stringify(st?.done)} —— 第 3 页没交回令牌，本次就没有可继续的东西了，`
        + '不记进 done 的话续跑那句话会把它算进要花钱的那一半')
      // 这一跑真的握过 page-2、page-3 两个令牌、也真的走到了「响应不再给令牌」那一页，
      // 下面两条才有东西可测；没走到的话上面两条已经红过了
      if (toks.includes('page-3')) {
        const during = fileText(snaps).split('\n').filter(Boolean)
        const final = typeof dir1 === 'string' ? fileText(join(cwd, dir1, 'task.json')) : ''
        const leaked = [...during, final].filter(t => t.includes('page-2') || t.includes('page-3'))
        // 前提：第 2、3 次 Reels 发出之前第 1 页已经落盘（D6.t），所以途中至少抄到两份
        named('IG 续页令牌只在内存里：抓取途中与收尾后的 task.json 都找不到令牌字符串',
          during.length >= 2 && final !== '' && leaked.length === 0,
          `途中抄到 ${during.length} 份、收尾那份${final === '' ? '读不出来' : '读得出来'}，`
          + `其中 ${leaked.length} 份带着 page-2／page-3 —— D6.u：令牌只在同一次运行内有效，`
          + '写进 task.json 就会被续跑拿去用，而跨运行的令牌能不能用没有任何样本（ADR-111）')
        const bad = chain.stderr.match(NOT_LOCAL)?.[0]
        named('IG 没有可继续的令牌而停时，提示说的是令牌，不说服务端已经没有更多',
          /令牌/.test(chain.stderr) && bad === undefined,
          `提示里${/令牌/.test(chain.stderr) ? '提到了令牌' : '一处「令牌」都没提'}`
          + `${bad === undefined ? '' : `，还出现了「${bad}」`}；相关行：`
          + `${JSON.stringify(chain.stderr.split('\n').filter(l =>
              l.includes('force-paged-kw') || l.includes('令牌') || NOT_LOCAL.test(l)))}`
          + ' —— D6.u：提示只说本地看到的事（本次没有可继续的令牌），服务端还有没有，我们不知道')
      }
    }
  }

  // (2) 每页都给令牌，也停在页数上限。
  //     推导：罐头 igReels 每次都交回同一个令牌、每次 2 个作者（不是 0 条、也解析得出人），
  //     D6.u 列的停止条件里只剩「累计页数达到上限」→ 第 4 页拿回后当页记进 done（D6.h 上限 4）
  //     → 恰好 4 次 Reels：第 1 次不带，第 2～4 次各带上一页交回的那个令牌。
  //     「这一页没多出新的人」不在 D6.u 的停止条件里，不能拿它提前停。
  {
    const cwd = igCwd('cap')
    const ledger = join(cwd, 'attempts.tsv'), events = join(cwd, 'fetch-events.jsonl')
    const capRun = runBoth('collect IG 续页夹具 2：每页都给令牌的词',
      [S('collect.ts'), '--config', igCfg(cwd, 'igcap', 1,
        [{ keyword: 'igcap-kw', dimension: 'scene', platform: 'instagram' }])],
      cwd, { status: 0 }, igEnv(ledger, events))
    if (capRun.ok) {
      const st = taskOf(cwd, summaryOf(capRun.stdout).dir)
      const toks = reelsTokens(events)
      named('IG 每页都给令牌也停在页数上限：恰好 4 次 Reels、第 2～4 次带令牌，pages 记 4，任务进 done',
        JSON.stringify(toks) === JSON.stringify([null, TOKEN, TOKEN, TOKEN])
          && hits(ledger, IG_REELS) === 4 && st?.pages?.[0] === 4 && st?.done?.includes(0) === true,
        `Reels ${hits(ledger, IG_REELS)} 次、带的令牌依次是 ${JSON.stringify(toks)}，`
        + `盘上 pages=${JSON.stringify(st?.pages)}、done=${JSON.stringify(st?.done)}`
        + ' —— IG 与 TikTok 同一个上限（ADR-111 第一节），有令牌不等于可以一直翻')
    }
  }

  // (3) 续跑遇到抓过页、不在 done 的 IG 任务（进程被硬杀留下的样子）。
  //     造法：先真跑一个目录 —— IG 在前、TikTok 在后，预算 0.003：IG 第 1 页 0.002 ＋ TikTok
  //     第 1 页 0.001 正好花完（F9 让每个任务先各抓一页），下一次请求放不行 → 退 3。
  //     然后手改 task.json 把 IG 从 done 里拿掉 —— 按 D6.v 这一跑收尾时它握着令牌、本该进 done；
  //     被硬杀的进程走不到收尾那一步，盘上就是「offsets 有键、pages 记 1、不在 done」。
  //     推导：令牌不跨运行，续跑手里没有它的令牌 → D6.v：记进 done、一次请求都不发
  //     → Reels 与账号名兜底（search_users）都是 0 次；没拿回页，它的 pages／offsets／
  //     answered／found 一格都不动（D6.h 只数真的拿回了的页，D6.s 只数真发出的请求）。
  //     对照：TikTok 不看令牌（D6.u、D6.v 只管 Instagram），pages 1 → 上限 4，恰好再搜 3 次。
  {
    const cwd = igCwd('stale')
    const first = runBoth('collect IG 续页夹具 3：先跑出 IG 与 TikTok 各抓了一页的目录',
      [S('collect.ts'), '--config', igCfg(cwd, 'igstale', 0.003, [
        { keyword: 'igstale-kw', dimension: 'scene', platform: 'instagram' },
        { keyword: 'ttctl-kw', dimension: 'category', platform: 'tiktok' },
      ])], cwd, { status: 3 }, igEnv(join(cwd, 'attempts-first.tsv')))
    const dir3 = first.ok ? summaryOf(first.stdout).dir : undefined
    let before: any
    if (typeof dir3 === 'string') {
      const f = join(cwd, dir3, 'task.json')
      const st = jsonFile(f)
      if (st?.pages?.[0] === 1 && st?.pages?.[1] === 1 && st?.offsets?.[0] !== undefined
          && st?.offsets?.[1] !== undefined && Array.isArray(st?.done) && !st.done.includes(1)) {
        st.done = st.done.filter((i: number) => i !== 0)   // ← 硬杀：收尾那一步没走到
        writeFileSync(f, JSON.stringify(st, null, 2), 'utf8')
        before = st
      } else {
        failed++
        console.error(`  ✗ IG 续页夹具 3${SELFCHECK_FIXTURE_MARK}：第一跑没留下「两个任务各抓了一页、`
          + `TikTok 不在 done」的目录（pages=${JSON.stringify(st?.pages)}、offsets=${JSON.stringify(st?.offsets)}、`
          + `done=${JSON.stringify(st?.done)}）—— 后面的续跑测不到要测的那个状态`)
      }
    }
    if (typeof dir3 === 'string' && before !== undefined) {
      const ledger = join(cwd, 'attempts-resume.tsv')
      const again = runBoth('collect IG 续页夹具 3：预算给足续跑',
        [S('collect.ts'), '--resume', dir3, '--budget', '1'], cwd, { status: 0 }, igEnv(ledger))
      if (again.ok) {
        const after = taskOf(cwd, dir3)
        const igBooks = (t: any) => JSON.stringify([t?.pages?.[0], t?.offsets?.[0], t?.answered?.[0], t?.found?.[0]])
        named('续跑遇到抓过页、不在 done、手里没令牌的 IG 任务：一次搜索请求都不发，记进 done',
          hits(ledger, IG_REELS) === 0 && hits(ledger, IG_USERS) === 0
            && after?.done?.includes(0) === true && igBooks(after) === igBooks(before),
          `续跑发了 Reels ${hits(ledger, IG_REELS)} 次、账号名搜索 ${hits(ledger, IG_USERS)} 次，`
          + `盘上 done=${JSON.stringify(after?.done)}，IG 的 [pages, offsets, answered, found] 从 `
          + `${igBooks(before)} 变成 ${igBooks(after)} —— 令牌不跨运行，不带令牌再问就是退回首页重抓，`
          + '同一页的钱再花一遍')
        named('同一次续跑里 TikTok 任务照常翻到页数上限 —— 它不看令牌',
          hits(ledger, TT_SEARCH) === 3 && after?.pages?.[1] === 4 && after?.done?.includes(1) === true,
          `TikTok 搜索 ${hits(ledger, TT_SEARCH)} 次，盘上 pages=${JSON.stringify(after?.pages)}、`
          + `done=${JSON.stringify(after?.done)} —— D6.v 只冻 Instagram，TikTok 被一起冻住就是少抓`)
        named('续跑收尾那句话不把没令牌的 IG 任务算进要抓的关键词',
          resumeLine(again.stderr) !== undefined && !/还有 \d+ 个关键词/.test(again.stderr),
          `那句话是「${resumeLine(again.stderr) ?? '（没说）'}」 —— 两个任务都该在 done 里，`
          + '说「还有关键词」就是调度不抓、那句话却把它算进要花钱的那一半（D6.g、D6.v）')
      }
    }
  }

  // (4) 一次运行以预算不足收尾时，手里还握着令牌。
  //     选预算不足这条收尾、不选达标：旧行为（只取一页）下 IG 第 1 页之后 has_more 恒 false、
  //     照样进 done，达标收尾时新旧两种行为在盘上长得一样，分不出来；预算这条分得出 ——
  //     新行为会花钱去拿第 2 页，旧行为不会。而且预算不足正是 D6.k 那条「不进 done」的邻居：
  //     兜底那一页不带令牌、撞上预算不进 done；带着令牌的那一页之后撞上预算，要进 done。
  //     推导：预算 0.004 → 第 1 页 0.002、第 2 页（带第 1 页交回的令牌）累计 0.004 正好放行，
  //     第 3 页要到 0.006 放不行 → 按 P3 退 3、stopped=budget；两页都拿回了 → pages 记 2。
  //     第 2 页照样交回了令牌、2 < 上限 4、目标 9999 没达到、不是 0 条也解析得出人 ——
  //     D6.u 列的停止条件一条都不成立，能让它进 done 的只剩 D6.v 那一句。
  //     这一跑只有这一个关键词，所以收尾那句话里不该出现「还有 N 个关键词」；
  //     两个作者都还没补 profile，那句话说要花钱是对的，这里不断言它。
  {
    const cwd = igCwd('budget')
    const ledger = join(cwd, 'attempts.tsv'), events = join(cwd, 'fetch-events.jsonl')
    // 退出码 3 是下面第一条具名断言点名的东西（旧行为这里会以 0 收尾），所以 soft 放过 0 由它判
    const budgetRun = runBoth('collect IG 续页夹具 4：预算只够两页 Reels',
      [S('collect.ts'), '--config', igCfg(cwd, 'igbudget', 0.004,
        [{ keyword: 'igbudget-kw', dimension: 'scene', platform: 'instagram' }])],
      cwd, { status: 3, soft: [0] }, igEnv(ledger, events))
    if (budgetRun.ok) {
      const sum = summaryOf(budgetRun.stdout)
      const st = taskOf(cwd, sum.dir)
      const toks = reelsTokens(events)
      named('IG 预算只够两页 Reels：带着令牌抓到第 2 页，第 3 页撞上预算按 P3 停下',
        budgetRun.status === 3 && sum.stopped === 'budget'
          && JSON.stringify(toks) === JSON.stringify([null, TOKEN]) && st?.pages?.[0] === 2,
        `退出码 ${budgetRun.status}、stopped=${sum.stopped}、Reels 带的令牌依次是 ${JSON.stringify(toks)}、`
        + `盘上 pages=${JSON.stringify(st?.pages)}、账本 ${JSON.stringify(fetchAttempts(ledger))}`)
      // 收尾那一刻手里确实握着第 2 页交回的令牌，下面三条才有东西可测；不是的话上面那条已经红过了
      if (sum.stopped === 'budget' && toks.length === 2 && st !== undefined) {
        named('预算不足收尾时手里还握着令牌的 IG 任务记进 done',
          st.done?.includes(0) === true,
          `盘上 done=${JSON.stringify(st.done)}、pages=${JSON.stringify(st.pages)} —— 令牌不跨运行，`
          + '续跑拿不到它，不记进 done 的话调度不抓、那句话却把它算进要花钱的那一半（D6.v）')
        const text = fileText(join(cwd, sum.dir, 'task.json'))
        named('预算不足收尾时握着的令牌不写进 task.json',
          text !== '' && !text.includes(TOKEN),
          `task.json ${text === '' ? '读不出来' : `里${text.includes(TOKEN) ? '有' : '没有'} ${TOKEN}`}`
          + ' —— 收尾时手里还有令牌，最容易被顺手存下来留给续跑，D6.u 逐字不许')
        named('预算不足收尾那句话不把握着令牌的 IG 任务算进要抓的关键词',
          resumeLine(budgetRun.stderr) !== undefined && !/还有 \d+ 个关键词/.test(budgetRun.stderr),
          `那句话是「${resumeLine(budgetRun.stderr) ?? '（没说）'}」 —— 目录里只有这一个关键词，`
          + '续跑不会再为它请求（D6.v），说「还有关键词」等于让用户为一个不会被抓的词追加预算')
      }
    }
  }

  criterion('D6.u')
  criterion('D6.v')
})

// ---- D16.j–m：整张任务表按原值校验，拒绝在落盘和付费之前 ----
group('task-list', [], () => {
  // 独立上下文先于入口实现写成；只读需求、ADR-115 第 1–5 节及入口交点欠条、
  // 缝隙契约、类型声明与测试基础设施，没有读入口或两个校验函数的函数体。
  // expected 来自 D16.a–m、D15.j、F3.c/d：不是对象的项只指认整项；对象的三个字段
  // 各自指认；原值用 JSON 表达、缺席明说。合法任务故意在前，续跑坏任务故意在 done。
  // 四条调用路径各吃同一批坏输入，免得新建的保证被误当作续跑也已保证。
  const output = resolve('output')
  mkdirSync(output, { recursive: true })
  const base = mkdtempSync(join(output, 'selfcheck-task-list-'))
  process.on('exit', () => rmSync(base, { recursive: true, force: true }))
  // 零 fetch 不能证明此前没有进程内预留。只包裹公共 reserve 方法记录调用，原样委托，
  // 不读其函数体、不改变返回/抛错；合法入口也用同一观测作对照，防止挂错模块空报绿。
  const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
  const budgetModule = pathToFileURL(resolve('scripts/lib/budget.ts')).href
  type Problem = { task?: number; field?: string; value?: unknown }
  type Scenario = { id: string; tasks?: unknown; problems: Problem[]; good?: number[]; routes?: number[] }
  const good = { keyword: 'task-list-good', dimension: 'category', platform: 'tiktok' }
  const scenarios: Scenario[] = [
    { id: 'absent', problems: [{ field: 'tasks' }] },
    ...[null, {}, 'not-a-list', 17, false, []].map((tasks, i) => ({
      id: `list-${i}`, tasks, problems: [{ field: 'tasks', value: tasks }],
    })),
    { id: 'items', tasks: [good, null, good, [], 'not-a-task', 23, false], good: [1, 3],
      problems: [null, [], 'not-a-task', 23, false].map((value, i) => ({
        task: [2, 4, 5, 6, 7][i], value,
      })) },
    { id: 'fields', tasks: [good,
      { keyword: ' \t ', dimension: 'Category', platform: 'TikTok' }, good,
      { keyword: null, dimension: ' scene', platform: 'instagram ' },
      { keyword: '', dimension: [], platform: false }, {},
      { keyword: 31, dimension: 'brand', platform: 'youtube' },
    ], good: [1, 3], problems: [
      { task: 2, field: 'keyword', value: ' \t ' },
      { task: 2, field: 'dimension', value: 'Category' },
      { task: 2, field: 'platform', value: 'TikTok' },
      { task: 4, field: 'keyword', value: null },
      { task: 4, field: 'dimension', value: ' scene' },
      { task: 4, field: 'platform', value: 'instagram ' },
      { task: 5, field: 'keyword', value: '' },
      { task: 5, field: 'dimension', value: [] },
      { task: 5, field: 'platform', value: false },
      { task: 6, field: 'keyword' }, { task: 6, field: 'dimension' }, { task: 6, field: 'platform' },
      { task: 7, field: 'keyword', value: 31 },
      { task: 7, field: 'dimension', value: 'brand' },
      { task: 7, field: 'platform', value: 'youtube' },
    ] },
    { id: 'routes-too', tasks: [good,
      { keyword: '', dimension: 'Scene', platform: 'instagram', ig_route: 'Hashtag' }, good,
      { keyword: 'task-list-route', dimension: 'category', platform: 'tiktok', ig_route: 'hashtag' },
      { keyword: '#', dimension: 'audience', platform: 'instagram', ig_route: 'hashtag' },
    ], good: [1, 3], routes: [2, 4, 5], problems: [
      { task: 2, field: 'keyword', value: '' }, { task: 2, field: 'dimension', value: 'Scene' },
    ] },
    // P1 交点：两个缺席各自成一份配置，不让另一处错误替先补默认值的入口挡住请求。
    { id: 'missing-platform-hashtag', tasks: [good,
      { keyword: '#tasklistmissing', dimension: 'scene', ig_route: 'hashtag' },
    ], good: [1], routes: [2], problems: [{ task: 2, field: 'platform' }] },
    { id: 'missing-dimension', tasks: [good,
      { keyword: 'task-list-dimension', platform: 'tiktok' },
    ], good: [1], problems: [{ task: 2, field: 'dimension' }] },
  ]
  const modes = ['new', 'resume', 'resume-budget', 'probe'] as const
  type Mode = typeof modes[number]
  const make = (mode: Mode, scenario: Scenario) => {
    const cwd = join(base, `${mode}-${scenario.id}`), taskDir = join(cwd, 'task')
    mkdirSync(join(cwd, 'memory'), { recursive: true })
    const config = { product: 'tasklist', market: 'US', target_count: 1, budget_usd: 0.01,
      ...(Object.hasOwn(scenario, 'tasks') ? { tasks: scenario.tasks } : {}) }
    const resume = mode === 'resume' || mode === 'resume-budget'
    const file = resume ? join(taskDir, 'task.json') : join(cwd, 'config.json')
    if (resume) {
      mkdirSync(taskDir)
      // 合法首项未完成、坏项已经 done：只查待抓子集会漏掉它们（ADR-115 第二节）。
      const done = Array.isArray(scenario.tasks) ? scenario.tasks.map((_, i) => i)
        .filter(i => !(scenario.good ?? []).includes(i + 1)) : []
      writeFileSync(file, JSON.stringify({ ...config, ...knownCosts(10_000, []),
        done, offsets: {}, pages: {}, answered: {}, found: {},
        created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      }, null, 2) + '\n')
      for (const f of ['creators.raw.json', 'creators.json']) writeFileSync(join(taskDir, f), '[]\n')
    } else writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
    const log = join(cwd, 'attempts.tsv'), events = join(cwd, 'events.jsonl')
    const reserves = join(cwd, 'reserve-calls.txt'), armed = join(cwd, 'reserve-observer.txt')
    const preload = join(cwd, 'observe-reserve.mjs')
    writeFileSync(reserves, '')
    writeFileSync(preload, [
      `import { appendFileSync } from 'node:fs';`,
      `import { Budget } from ${JSON.stringify(budgetModule)};`,
      `const original = Budget.prototype.reserve;`,
      `Budget.prototype.reserve = function(...args) {`,
      `  appendFileSync(${JSON.stringify(reserves)}, 'reserve\\n');`,
      `  return Reflect.apply(original, this, args);`,
      `};`,
      `appendFileSync(${JSON.stringify(armed)}, 'armed\\n');`,
    ].join('\n'))
    const observation = costEnv(log, { FAKE_FETCH_COST_EVENTS: events,
      NODE_OPTIONS: `--import ${JSON.stringify(tsx)} ${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(preload).href)}`,
    })
    const args = resume ? [S('collect.ts'), '--resume', taskDir,
      ...(mode === 'resume-budget' ? ['--budget', '0.02'] : [])]
      : [S(mode === 'probe' ? 'probe.ts' : 'collect.ts'), '--config', file]
    return { cwd, file, taskDir, log, events, reserves, armed, observation, args, before: fileText(file) }
  }
  const observerReady = (armed: string, stderr: string): boolean => {
    if (fetchAttempts(armed).includes('armed')) return true
    failed++
    console.error(`  ✗ 任务列表预算预留观测${SELFCHECK_FIXTURE_MARK}：预加载观测未成功安装\n${stderr}`)
    return false
  }
  // 同一问题须在同一任务段里同时点名字段与原值，不能由其他任务的报错凑齐。
  // 不规定一任务分几句；「任务 N」与「第 N 个」都符合一起始序号的契约。
  const taskParts = (stderr: string): { task: number; text: string }[] => {
    const matches = [...stderr.matchAll(/任务\s*(\d+)(?!\d)|第\s*(\d+)\s*个/g)]
    return matches.map((m, i) => ({ task: Number(m[1] ?? m[2]),
      text: stderr.slice(m.index, matches[i + 1]?.index) }))
  }
  const reports = (stderr: string, scenario: Scenario): boolean => {
    const parts = taskParts(stderr)
    return scenario.problems.every(p => {
      const texts = p.task === undefined ? (parts.length === 0 ? [stderr] : [])
        : parts.filter(part => part.task === p.task).map(part => part.text)
      return texts.some(text => (!p.field || text.includes(p.field))
        && (Object.hasOwn(p, 'value') ? text.includes(JSON.stringify(p.value)!) : /缺席/.test(text)))
    }) && (scenario.good ?? []).every(i => !parts.some(p => p.task === i))
      && (scenario.routes ?? []).every(i => parts.some(p => p.task === i && p.text.includes('ig_route')))
  }
  const taskDirs = (cwd: string): string[] => existsSync(join(cwd, 'output'))
    ? readdirSync(join(cwd, 'output')) : []
  const completed: Record<Mode, number> = { new: 0, resume: 0, 'resume-budget': 0, probe: 0 }
  for (const mode of modes) for (const scenario of scenarios) {
    const f = make(mode, scenario)
    const r = runBoth(`任务列表 ${mode}：${scenario.id}`, f.args, f.cwd,
      { status: 2, soft: [0, 1, 3] }, f.observation)
    if (!r.ok || !observerReady(f.armed, r.stderr)) continue
    const requests = fetchAttempts(f.log), events = fetchAttempts(f.events)
    const reserveCalls = fetchAttempts(f.reserves)
    const rejected = r.status === 2 && requests.length === 0 && events.length === 0
    const same = fileText(f.file) === f.before
    const noPending = jsonFile(f.file)?.cost_ledger?.pending === undefined
    const detail = `${mode}/${scenario.id}，退出码 ${r.status}、请求 ${JSON.stringify(requests)}、`
      + `预留调用=${JSON.stringify(reserveCalls)}、任务文件原样=${same}、无预留=${noPending}，stderr=${stderrTail(r.stderr)}`
    const diagnosis = r.status === 2 && r.stderr.includes(f.file) && reports(r.stderr, scenario)
    if (mode === 'new') {
      named('任务列表：collect 新建拒绝坏输入前从未调用预算预留',
        r.status === 2 && reserveCalls.length === 0, detail)
      named('任务列表：collect 新建拒绝整份坏输入，退出2、零请求、不建任务目录',
        rejected && taskDirs(f.cwd).length === 0 && same, detail)
      named('任务列表：collect 新建报文件及全部原值问题，路线问题一并报', diagnosis, detail)
    } else if (mode === 'resume') {
      named('任务列表：collect 续跑拒绝坏输入前从未调用预算预留',
        r.status === 2 && reserveCalls.length === 0, detail)
      named('任务列表：collect 续跑校验整表，退出2、零请求、不留预留', rejected && noPending, detail)
      named('任务列表：collect 续跑拒绝时 task.json 逐字不变', rejected && same, detail)
      named('任务列表：collect 续跑报 task.json 及全部原值问题，路线问题一并报', diagnosis, detail)
    } else if (mode === 'resume-budget') {
      named('任务列表：collect 改额续跑拒绝坏输入前从未调用预算预留',
        r.status === 2 && reserveCalls.length === 0, detail)
      named('任务列表：collect 改额续跑校验整表，退出2、零请求、不留预留', rejected && noPending, detail)
      named('任务列表：collect 改额续跑拒绝时 task.json 逐字不变，新上限不落盘', rejected && same, detail)
      named('任务列表：collect 改额续跑报 task.json 及全部原值问题，路线问题一并报', diagnosis, detail)
    } else {
      named('任务列表：probe 拒绝坏输入前从未调用预算预留',
        r.status === 2 && reserveCalls.length === 0, detail)
      named('任务列表：probe 拒绝整份坏输入，退出2、零请求', rejected && same, detail)
      named('任务列表：probe 报全部原值问题，路线问题一并报', diagnosis, detail)
      const leak = probeInputLeak(r.stderr)
      named('F3.c：probe 的任务列表不合规以退出码2结束，stderr 不带异常类名与调用栈',
        r.status === 2 && !leak.className && !leak.frames, detail)
      named('F3.d：probe 的任务列表不合规以退出码2结束，stderr 写出配置路径与问题本身',
        diagnosis, detail)
    }
    if (scenario.id === 'missing-platform-hashtag' || scenario.id === 'missing-dimension') {
      if (mode === 'probe') {
        named('任务列表：probe 不按路线补平台、不补默认维度，点名缺席且零请求',
          rejected && diagnosis, detail)
      } else if (mode === 'new') {
        named('任务列表：collect 新建不按路线补平台、不补默认维度，点名缺席且零请求',
          rejected && diagnosis && taskDirs(f.cwd).length === 0, detail)
      } else {
        named('任务列表：collect 续跑不按路线补平台、不补默认维度，点名缺席且文件不变',
          rejected && diagnosis && same, detail)
      }
    }
    completed[mode]++
  }
  if (completed.new === scenarios.length && completed.resume === scenarios.length
    && completed['resume-budget'] === scenarios.length) criterion('D16.j', 'D16.k')
  if (completed.probe === scenarios.length) criterion('D16.l', 'D16.m', 'F3.c', 'F3.d')

  // 相邻回归：任务列表合规、旧断点 done:null 的既有输入错误出口仍为 2（ADR-108）。
  // 只守这一份已知旧输入，不在这里扩展其他断点字段的规则。
  {
    const f = make('resume', { id: 'bad-done', tasks: [good], problems: [], good: [1] })
    const config = jsonFile(f.file)
    config.done = null
    writeFileSync(f.file, JSON.stringify(config, null, 2) + '\n')
    const before = fileText(f.file)
    const r = runBoth('任务列表 resume：合法任务与 done:null 旧断点', f.args, f.cwd,
      { status: 2, soft: [0, 1, 3] }, f.observation)
    if (r.ok && observerReady(f.armed, r.stderr)) {
      named('任务列表：合法任务续跑遇到 done:null 仍退出2、零请求且文件不变',
        r.status === 2 && fetchAttempts(f.log).length === 0 && fetchAttempts(f.events).length === 0
          && fileText(f.file) === before,
        `退出码 ${r.status}、请求 ${JSON.stringify(fetchAttempts(f.log))}、`
          + `文件原样=${fileText(f.file) === before}，stderr=${stderrTail(r.stderr)}`)
    }
  }

  // 不能把「全部拒绝」当成校验正确。合法非空列表含两个完全相同的任务，四个维度、
  // 双平台及 Reels/话题路线；首尾有空白但有内容的 keyword 合规且须保留（D16.c/h/i）。
  const acceptedTasks = [
    { keyword: '  task-list-positive  ', dimension: 'category', platform: 'tiktok' },
    { keyword: '#tasklistpositive', dimension: 'scene', platform: 'instagram', ig_route: 'hashtag' },
    { keyword: '  task-list-positive  ', dimension: 'category', platform: 'tiktok' },
    { keyword: 'task-list-reels', dimension: 'competitor', platform: 'instagram', as_hashtag: true },
    { keyword: 'task-list-audience', dimension: 'audience', platform: 'tiktok' },
  ]
  for (const mode of modes) {
    const f = make(mode, { id: 'accepted', tasks: acceptedTasks, problems: [], good: [1, 2, 3, 4, 5] })
    // 合法路径给足预算；坏输入的 0.01 只用来限制接线被删后负片会误发多少次。
    const config = jsonFile(f.file)
    config.budget_usd = 1
    if (mode === 'resume' || mode === 'resume-budget') Object.assign(config, knownCosts(1_000_000, []))
    writeFileSync(f.file, JSON.stringify(config))
    const args = mode === 'resume-budget' ? [...f.args.slice(0, -1), '2'] : f.args
    const r = runBoth(`任务列表 ${mode}：合法非空列表`, args, f.cwd,
      { status: 0, soft: [1, 2, 3] }, f.observation)
    if (!r.ok || !observerReady(f.armed, r.stderr)) continue
    const requests = fetchAttempts(f.log)
    const searched = r.status === 0 && [TT_SEARCH, IG_REELS, '/api/v1/instagram/v2/fetch_hashtag_posts']
      .every(endpoint => requests.includes(`200\t${endpoint}`))
    const detail = `${mode}，退出码 ${r.status}、请求 ${JSON.stringify(requests)}，stderr=${stderrTail(r.stderr)}`
    named('任务列表：合法入口的预算预留观测确实记录调用',
      r.status === 0 && fetchAttempts(f.reserves).includes('reserve'), detail)
    if (mode === 'probe') {
      const rows = summaryOf(r.stdout).results
      named('任务列表：probe 合法非空列表照常搜索，重复任务及原关键词保留',
        searched && Array.isArray(rows) && rows.length === acceptedTasks.length
          && acceptedTasks.every((task, i) => rows[i]?.task_index === i && !rows[i]?.error
            && rows[i]?.keyword === task.keyword && rows[i]?.dimension === task.dimension
            && rows[i]?.platform === task.platform), detail)
    } else {
      const state = mode === 'new' ? jsonFile(join(f.cwd, onlyDir(f.cwd, 'tasklist') ?? '', 'task.json'))
        : jsonFile(f.file)
      named('任务列表：collect 合法非空列表照常搜索，重复任务及所有原字段落盘',
        searched && JSON.stringify(state?.tasks) === JSON.stringify(acceptedTasks), detail)
    }
  }
})

// ---- D15.j／D15.k／D6.w：IG 话题入口只由配置显式开启，校验在一切请求之前，probe 与 collect 同一处分派 ----
group('hashtag-route', [], () => {
  // **只能端到端跑**：「退出码 2、零请求、不建目录」「续跑也校验」「probe 与 collect 走同一条路线」
  // 「拿回首页即进 done」都在入口那一层，缺省那个验证者（scripts/test.ts）只够得到
  // `igRouteProblems` 与 `search()` 本身。独立上下文先于实现写成，没有读 collect.ts、probe.ts。
  //
  // 期望一律出自 ADR-112 第二节、D15.j、D15.k、D6.w 原文与假供应商的已知行为（fake-fetch.ts）：
  //  · 话题页回罐头 igHashtag：3 条（视频、图文、轮播），作者 hashtagreeler（两条）与 hashtagphoto，
  //    响应里带着令牌；关键词含 `hashtag-nobody` 时回 2 条、一个作者都解析不出
  //  · 其余 Reels 回罐头 igReels：作者 techwithsarah、privateaccount，每次都给令牌
  //  · 账本只记 pathname；请求参数从 FAKE_FETCH_COST_EVENTS 的逐次记录里读（同 d6uv-igpaging）
  // 单价（ADR-107、#167）：话题页与 Reels 各 0.002/次；预算 1 远够，目标 9999 走不到达标。
  // 每一跑都关掉第 7 次回 429 的触发器，免得多出一行重试。
  const base = join(tmp, 'hashtag-route')
  const HT = '/api/v1/instagram/v2/fetch_hashtag_posts'
  const cwdOf = (name: string): string => {
    const cwd = join(base, name)
    mkdirSync(join(cwd, 'memory'), { recursive: true })
    return cwd
  }
  const cfgOf = (cwd: string, product: string, tasks: unknown[]): string => {
    const f = join(cwd, `${product}.json`)
    writeFileSync(f, JSON.stringify({ product, market: 'US', target_count: 9999, budget_usd: 1, tasks }))
    return f
  }
  const htEnv = (ledger: string, events?: string): NodeJS.ProcessEnv => ({
    FAKE_FETCH_LEDGER: ledger, FAKE_FETCH_NO_429: '1',
    ...(events !== undefined ? { FAKE_FETCH_COST_EVENTS: events } : {}),
  })
  /** 某个端点每一次请求带的查询参数，按发出顺序 */
  const queries = (events: string, endpoint: string): Record<string, string>[] => fileText(events).split('\n')
    .filter(Boolean)
    .map((line): any => { try { return JSON.parse(line) } catch { return undefined } })
    .filter(e => e?.kind === 'fetch' && e.endpoint === endpoint).map(e => e.query ?? {})
  const hits = (ledger: string, endpoint: string): number =>
    fetchAttempts(ledger).filter(l => l === `200\t${endpoint}`).length
  /** 报错写明第 2 个任务（从 1 数、同任务标签「任务 N」；「第 N 个」也认），且点名 ig_route（D15.j） */
  const namesTask2 = (stderr: string): boolean => /任务\s*2(?!\d)|第\s*2\s*个/.test(stderr) && stderr.includes('ig_route')
  const taskDirs = (cwd: string, product: string): string[] => existsSync(join(cwd, 'output'))
    ? readdirSync(join(cwd, 'output')).filter(n => n.startsWith(`${product}-`)) : []
  const tail = (s: string) => JSON.stringify(s.split('\n').filter(Boolean).slice(-6))
  /** 来源投影成五元组比：不依赖落盘时对象的键顺序 */
  const sources = (c: any) => Array.isArray(c?.discovery_sources)
    ? JSON.stringify(c.discovery_sources.map((s: any) => [s?.platform, s?.handle, s?.keyword, s?.dimension, s?.endpoint]))
    : String(c?.discovery_sources)

  // (1)–(3) 不合规的配置：三个入口都在建目录、预留与请求之前以退出码 2 结束（D15.j）。
  //     第 1 个任务一律合规、坏的放第 2 个 —— 「零请求」才分得出「开跑前全部校验」与「抓到那个任务才发现」。
  //     退出码 2 是下面具名断言点名的东西，所以 soft 放过 0／1／3 由它判（同 cost-input 组）。
  {
    const cwd = cwdOf('bad-config'), ledger = join(cwd, 'attempts.tsv')
    const r = runBoth('collect 话题入口：新建时第 2 个任务的 ig_route 写成 Hashtag',
      [S('collect.ts'), '--config', cfgOf(cwd, 'htbadcfg', [
        { keyword: 'htbad-tt-kw', dimension: 'category', platform: 'tiktok' },
        { keyword: 'htbad-ig-kw', dimension: 'scene', platform: 'instagram', ig_route: 'Hashtag' },
      ])], cwd, { status: 2, soft: [0, 1, 3] }, htEnv(ledger))
    if (r.ok) {
      named('IG 话题入口：collect 新建时 ig_route 不合规，以退出码 2 结束、零请求、不建任务目录',
        r.status === 2 && fetchAttempts(ledger).length === 0 && taskDirs(cwd, 'htbadcfg').length === 0,
        `退出码 ${r.status}、账本 ${JSON.stringify(fetchAttempts(ledger))}、任务目录 ${JSON.stringify(taskDirs(cwd, 'htbadcfg'))}`
        + ' —— D15.j：大小写不同也不是 "hashtag"，要在建任务目录、任何预留与请求之前停下')
      named('IG 话题入口：collect 新建时的报错写明第 2 个任务与 ig_route', r.status === 2 && namesTask2(r.stderr),
        `退出码 ${r.status}，stderr 末几行 ${tail(r.stderr)} —— D15.j：要指出是第几个任务、哪一条不合规`)
    }
  }
  {
    // 续跑：盘上 task.json 本身合规（已知空账、各表齐全），只有第 2 个任务的 ig_route 是 null（JSON 里写得出来的「出现了却不是 hashtag」）。
    // 第 1 个任务是合规的话题任务：没有这道校验时续跑照常开抓。
    const f = costFixture('htbadresume', knownCosts(1_000_000, []), { budget_usd: 1, target_count: 9999,
      tasks: [
        { keyword: '#htresume-ok', dimension: 'scene', platform: 'instagram', ig_route: 'hashtag' },
        { keyword: 'htresume-bad-kw', dimension: 'scene', platform: 'instagram', ig_route: null },
      ], done: [], offsets: {}, pages: {}, answered: {}, found: {} })
    const r = runBoth('collect 话题入口：续跑的 task.json 里第 2 个任务的 ig_route 是 null',
      [S('collect.ts'), '--resume', f.taskDir], f.cwd, { status: 2, soft: [0, 1, 3] }, htEnv(f.log))
    if (r.ok) {
      const st = jsonFile(f.task)
      named('IG 话题入口：collect 续跑时 task.json 的 ig_route 不合规，以退出码 2 结束、零请求、不留预留',
        r.status === 2 && fetchAttempts(f.log).length === 0 && st?.requests === 0
          && st?.cost_ledger?.pending === undefined,
        `退出码 ${r.status}、账本 ${JSON.stringify(fetchAttempts(f.log))}、盘上 requests=${st?.requests}、`
        + `pending=${JSON.stringify(st?.cost_ledger?.pending)} —— D15.j：续跑同样在任何预留与请求之前停下`)
      named('IG 话题入口：collect 续跑时的报错写明第 2 个任务与 ig_route', r.status === 2 && namesTask2(r.stderr),
        `退出码 ${r.status}，stderr 末几行 ${tail(r.stderr)}`)
    }
  }
  {
    // 续跑带 --budget：这条路径在开抓前会把新上限落盘（D13.j），只带 --resume 的上一个夹具走不到。
    // 盘上同一份 task.json（上限 $1、空账）；--budget 3 不少于当前占用，D13.j 本会接受 —— 拒绝只能来自路线校验。
    const f = costFixture('htbadresumebudget', knownCosts(1_000_000, []), { budget_usd: 1, target_count: 9999,
      tasks: [
        { keyword: '#htresume-ok', dimension: 'scene', platform: 'instagram', ig_route: 'hashtag' },
        { keyword: 'htresume-bad-kw', dimension: 'scene', platform: 'instagram', ig_route: null },
      ], done: [], offsets: {}, pages: {}, answered: {}, found: {} })
    const before = fileText(f.task)
    const r = runBoth('collect 话题入口：续跑带 --budget，task.json 里第 2 个任务的 ig_route 是 null',
      [S('collect.ts'), '--resume', f.taskDir, '--budget', '3'], f.cwd, { status: 2, soft: [0, 1, 3] }, htEnv(f.log))
    if (r.ok) {
      const st = jsonFile(f.task)
      named('IG 话题入口：collect 续跑带 --budget 时 ig_route 不合规，以退出码 2 结束、零请求、不留预留',
        r.status === 2 && fetchAttempts(f.log).length === 0 && st?.requests === 0
          && st?.cost_ledger?.pending === undefined,
        `退出码 ${r.status}、账本 ${JSON.stringify(fetchAttempts(f.log))}、盘上 requests=${st?.requests}、`
        + `pending=${JSON.stringify(st?.cost_ledger?.pending)} —— D15.j：续跑改额同样在任何预留与请求之前停下`)
      named('IG 话题入口：collect 续跑带 --budget 时 ig_route 不合规，盘上 task.json 原样不动',
        r.status === 2 && fileText(f.task) === before,
        `退出码 ${r.status}、盘上 budget_usd=${st?.budget_usd}、limit_micro_usd=${st?.cost_ledger?.limit_micro_usd}`
        + ' —— D15.j 把整次调用当输入问题以退出码 2 拒绝；改额是这次调用的一部分，'
        + '同 D13 的口径（有未结项时「显式改额以退出码 2 拒绝」），被拒的调用不带着新上限落盘')
    }
  }
  {
    const cwd = cwdOf('bad-probe'), ledger = join(cwd, 'attempts.tsv')
    const cfg = cfgOf(cwd, 'htbadprobe', [
      { keyword: 'htbad-probe-ig', dimension: 'scene', platform: 'instagram' },
      { keyword: 'htbad-probe-tt', dimension: 'category', platform: 'tiktok', ig_route: 'hashtag' },
    ])
    const r = runBoth('probe 话题入口：第 2 个任务把 hashtag 写在 TikTok 任务上',
      [S('probe.ts'), '--config', cfg], cwd, { status: 2, soft: [0, 1, 3] }, htEnv(ledger))
    if (r.ok) {
      named('IG 话题入口：probe 的 ig_route 不合规，以退出码 2 结束、零请求',
        r.status === 2 && fetchAttempts(ledger).length === 0,
        `退出码 ${r.status}、账本 ${JSON.stringify(fetchAttempts(ledger))} —— D15.j：hashtag 只能写在 Instagram 任务上`)
      named('IG 话题入口：probe 的报错写明第 2 个任务与 ig_route', r.status === 2 && namesTask2(r.stderr),
        `退出码 ${r.status}，stderr 末几行 ${tail(r.stderr)}`)
      // F3.c／F3.d「路线不合规」那一类：问题本身认 `ig_route`（D15.j 要求点名哪一条不合规），配置路径认 --config 的实参
      const leak = probeInputLeak(r.stderr)
      named('F3.c：probe 的 ig_route 不合规以退出码 2 结束时，stderr 不带异常类名与调用栈',
        r.status === 2 && !leak.className && !leak.frames,
        `退出码 ${r.status}、带异常类名=${leak.className}、带栈帧=${leak.frames}，stderr 末几行 ${stderrTail(r.stderr)}`
        + ' —— F3.c：路线不合规是输入问题，内部异常的类名与堆栈都不该出现')
      criterion('F3.c')
      named('F3.d：probe 的 ig_route 不合规以退出码 2 结束时，stderr 写出配置路径与问题本身',
        r.status === 2 && r.stderr.includes(cfg) && r.stderr.includes('ig_route'),
        `退出码 ${r.status}、写着配置路径=${r.stderr.includes(cfg)}、写着 ig_route=${r.stderr.includes('ig_route')}，stderr 末几行 ${stderrTail(r.stderr)}`
        + ' —— F3.d：路线不合规时，stderr 要写出是哪个配置文件、哪一条 ig_route 不合规')
      criterion('F3.d')
    }
  }
  criterion('D15.j')

  // (4) 合规的 collect：两个话题任务 ＋ 一个没写 ig_route、写了 as_hashtag 的 IG 对照任务。
  {
    const cwd = cwdOf('collect'), ledger = join(cwd, 'attempts.tsv'), events = join(cwd, 'fetch-events.jsonl')
    const r = runBoth('collect 话题入口：两个话题任务与一个 Reels 对照任务',
      [S('collect.ts'), '--config', cfgOf(cwd, 'htcollect', [
        { keyword: '#htselfcare', dimension: 'scene', platform: 'instagram', ig_route: 'hashtag' },
        { keyword: '#hashtag-nobody', dimension: 'audience', platform: 'instagram', ig_route: 'hashtag' },
        { keyword: 'htplain-kw', dimension: 'category', platform: 'instagram', as_hashtag: true },
      ])], cwd, { status: 0 }, htEnv(ledger, events))
    if (r.ok) {
      const dir1 = summaryOf(r.stdout).dir
      const st = typeof dir1 === 'string' ? jsonFile(join(cwd, dir1, 'task.json')) : undefined
      const raw = typeof dir1 === 'string' ? jsonFile(join(cwd, dir1, 'creators.raw.json')) : undefined
      const people: any[] = Array.isArray(raw) ? raw : []
      const person = (h: string) => people.find(c => c?.platform === 'instagram' && c?.handle === h)
      // 推导：话题任务只请求首页、每页一次请求（D6.w）→ 恰好 2 次话题页；请求参数 keyword 去掉一个开头的 #、
      //   feed_type=top（D15.k）；不交回令牌、也不带令牌（D6.w）。任务顺序不在这里验，按关键词排序后比
      const htQ = queries(events, HT).map(q => JSON.stringify([q.keyword, q.feed_type, q.pagination_token ?? null])).sort()
      const wantQ = [['htselfcare', 'top', null], ['hashtag-nobody', 'top', null]].map(q => JSON.stringify(q)).sort()
      named('IG 话题入口：collect 每个话题任务恰好一次话题页请求，keyword 去掉开头的 #、feed_type 为 top、不带令牌',
        hits(ledger, HT) === 2 && JSON.stringify(htQ) === JSON.stringify(wantQ),
        `话题页 ${hits(ledger, HT)} 次，参数 ${JSON.stringify(htQ)}，账本 ${JSON.stringify(fetchAttempts(ledger))}`)
      // 推导：hashtag-nobody 那一页有条目却一个作者都解析不出 —— Reels 这样会改搜账号名（D6.k），话题路线不会（D6.w）；
      //   全跑唯一可能走兜底的就是它，所以账号名搜索应为 0。话题任务不走 Reels：Reels 只该出现对照任务的关键词
      const reelsQ = queries(events, IG_REELS).map(q => q.keyword)
      named('IG 话题入口：collect 话题页解析不出人也不改搜账号名，话题任务一次 Reels 都不发',
        hits(ledger, IG_USERS) === 0 && reelsQ.every(k => k === 'htplain-kw'),
        `账号名搜索 ${hits(ledger, IG_USERS)} 次，Reels 请求的关键词依次是 ${JSON.stringify(reelsQ)}`)
      // 对照：ig_route 缺席照旧走 Reels，as_hashtag 不切换路线（D15.k）
      named('IG 话题入口：collect 没写 ig_route 的 IG 任务照走 Reels，as_hashtag 不切换路线',
        reelsQ.includes('htplain-kw') && !queries(events, HT).some(q => String(q.keyword).includes('htplain')),
        `Reels 关键词 ${JSON.stringify(reelsQ)}，话题页关键词 ${JSON.stringify(queries(events, HT).map(q => q.keyword))}`)
      // 推导：拿回首页、不交回令牌（D6.w）→ 按 D6.u「响应没有令牌」当页记进 done；pages 只数真的拿回的页（D6.h）、
      //   answered 数真发出的请求（D6.s）、found 数供应商返回的条目（D6.l）：igHashtag 3 条、hashtag-nobody 2 条
      //   —— 解析不出人也照数条目，D6.w「如实记」
      const books = JSON.stringify([st?.pages?.[0], st?.pages?.[1], st?.answered?.[0], st?.answered?.[1],
        st?.found?.[0], st?.found?.[1]])
      named('IG 话题入口：collect 话题任务拿回首页即进 done，pages 与 answered 各记 1，found 记条目数',
        st?.done?.includes(0) === true && st?.done?.includes(1) === true && books === JSON.stringify([1, 1, 1, 1, 3, 2]),
        `盘上 done=${JSON.stringify(st?.done)}，两个话题任务的 [pages, pages, answered, answered, found, found]=${books}`)
      // 原词保留（ADR-112 第二节）：来源、source_keyword 照用任务关键词原样，只有请求参数去掉 #；端点是话题页（D15.a）
      const want = (h: string) => JSON.stringify([['instagram', h, '#htselfcare', 'scene', HT]])
      named('IG 话题入口：collect 话题账号的来源是话题端点与原关键词，source_keyword 照用原词',
        ['hashtagreeler', 'hashtagphoto'].every(h => sources(person(h)) === want(h) && person(h)?.source_keyword === '#htselfcare'),
        `hashtagreeler 来源 ${sources(person('hashtagreeler'))}、source_keyword ${JSON.stringify(person('hashtagreeler')?.source_keyword)}；`
        + `hashtagphoto 来源 ${sources(person('hashtagphoto'))}`)
      // 任务标签照用原关键词（D15.k、U8）：格式同 collect 组那条
      const progress = r.stderr.split('\n').filter(l => l.trimStart().startsWith('✓'))
      named('IG 话题入口：collect 话题任务的进度标签照用原关键词',
        progress.some(l => l.includes('任务 1 · scene · instagram · 关键词「#htselfcare」')),
        `搜索完成进度实际为 ${JSON.stringify(progress)}`)
      // 推导：话题首页的响应里其实带着令牌（ADR-112 第五节），是这条路线只取首页（D6.w）；提示只说本地看到的事（D6.u）
      //   —— 收尾那一行说「话题路线只取首页」，不说「本次没有可继续的续页令牌」
      const doneLine = progress.find(l => l.includes('关键词「#htselfcare」'))
      named('IG 话题入口：collect 话题任务收尾那一行说话题路线只取首页，不说没有可继续的令牌',
        doneLine !== undefined && doneLine.includes('话题路线只取首页') && !doneLine.includes('续页令牌'),
        `那一行是 ${JSON.stringify(doneLine)}`)
      // 续跑要认得出话题任务，路线就得跟着任务落盘（D15.j 说续跑也校验 task.json 里的 ig_route）
      named('IG 话题入口：task.json 原样留着每个任务的 ig_route',
        JSON.stringify((Array.isArray(st?.tasks) ? st.tasks : []).map((t: any) => t?.ig_route ?? null))
          === JSON.stringify(['hashtag', 'hashtag', null]),
        `盘上 tasks=${JSON.stringify(st?.tasks)}`)
    }
  }

  // (5) 合规的 probe：同一个 search() 分派，试探与采集走同一条路线（D15.k）。
  //     推导：probe 每个任务只试探首页（discovery 组：一个 IG 任务一次搜索请求）→ 账本恰好一行话题页
  {
    const cwd = cwdOf('probe'), ledger = join(cwd, 'attempts.tsv'), events = join(cwd, 'fetch-events.jsonl')
    const r = runBoth('probe 话题入口：一个话题任务',
      [S('probe.ts'), '--config', cfgOf(cwd, 'htprobe', [
        { keyword: '#htprobe', dimension: 'audience', platform: 'instagram', ig_route: 'hashtag' },
      ])], cwd, { status: 0 }, htEnv(ledger, events))
    if (r.ok) {
      const results = summaryOf(r.stdout).results
      const sample: any[] = Array.isArray(results?.[0]?.sample) ? results[0].sample : []
      const sent = queries(events, HT).map(q => [q.keyword, q.feed_type])
      named('IG 话题入口：probe 与 collect 同一处分派，话题任务试探也只请求一次话题页',
        JSON.stringify(fetchAttempts(ledger)) === JSON.stringify([`200\t${HT}`])
          && JSON.stringify(sent) === JSON.stringify([['htprobe', 'top']]),
        `账本 ${JSON.stringify(fetchAttempts(ledger))}，话题页参数 ${JSON.stringify(sent)}`)
      named('IG 话题入口：probe 试探出的账号来源是话题端点与原关键词',
        sample.length > 0 && sample.every(c =>
          sources(c) === JSON.stringify([['instagram', c?.handle, '#htprobe', 'audience', HT]])),
        `样本来源 ${JSON.stringify(sample.map(sources))}`)
    }
  }
  criterion('D15.k', 'D6.w', 'D15.a')

  // (6)–(8) probe 的结果行带出任务配置里的 ig_route：成功结果（D15.l）与错误结果（D15.m）。
  //     独立上下文先于实现写成：只读了 D15、U8、F3 原文，ADR-112，_interface.md 与 types.ts 的 SearchTask 类型，
  //     以及假供应商（fake-fetch.ts）；没有读 probe.ts、tikhub.ts、lib/ 下的函数体。
  //     期望只出自需求原文，没有照着实现的输出抄：
  //      · 「任务写了就原样带出」→ 那一行的 ig_route 恰好是 "hashtag"（D15.j 定死合规取值只有这一个，不合规的走不到结果行）
  //      · 「没写就不带这个字段」→ 结果对象上**没有** ig_route 这个键。用 Object.hasOwn 判，不判 `=== undefined`：
  //        JSON 里写出 `"ig_route": null` 也是带了这个字段
  //      · 「不由 as_hashtag、关键词写法、平台或返回结果推断补写」→ 各放一个诱饵任务：写了 as_hashtag 的、关键词以 # 开头的、
  //        TikTok 的，都没写 ig_route；另放一个写了 hashtag、话题页却一个人都解析不出的（返回结果里没有任何话题端点来源，
  //        照样要带出 —— ADR-112 第六节第二张欠条要的正是「话题任务 0 人时只看 stdout 分得出走的哪条路线」）
  //     结果一律按 task_index 找（U8.f／U8.g），不靠位置对齐。找不到那一行、或那一行的成败与夹具设计的不符，断言照红 ——
  //     否则「没有这个键」会被一行根本不存在的结果满足。这里不打夹具记号：行找不到也可能是 U8.f／U8.g 那几条变异弄的，
  //     打了记号会把它们的整跑判成跑不起来。
  //     错误结果用 `force-402` 造（fake-fetch.ts：URL 里带这个串就回 402，判在按路由挑罐头之前，话题页一样命中）。
  //     402 会让 probe 停在那一条（probe 组「普通错误会结束本次试探」），所以一跑只放一个、放在末尾，前面垫一个成功任务；
  //     三种错误各跑一次（写了 hashtag 的、没写的 IG 任务、TikTok 任务）。账本里那一行 402 落在哪个端点，只证明请求走了哪条路；
  //     路线字段是不是出自**这个**任务，靠垫着的成功任务故意和出错任务的路线相反来证明 —— 两个任务路线一样的话，
  //     错误行拿前一个任务的路线、或按整份配置补写，都会假绿。（这一句与第三跑、以及成功那一跑的第 6 个任务，
  //     是开 PR 前的审阅指出后补的，写在实现之后，红由 M-D15-ac／ad／ae 重演。）
  const rowsByIndex = (stdout: string): ((i: number) => any) => {
    const results = summaryOf(stdout).results
    const rows: any[] = Array.isArray(results) ? results : []
    return i => rows.find(r => r?.task_index === i)
  }
  const hasRoute = (row: any): boolean => row !== null && typeof row === 'object' && Object.hasOwn(row, 'ig_route')
  const showRow = (row: any): string => row === undefined ? '（没有这一行）'
    : JSON.stringify({ task_index: row?.task_index, keyword: row?.keyword, platform: row?.platform, error: row?.error,
        has_ig_route: hasRoute(row), ig_route: row?.ig_route,
        sample: Array.isArray(row?.sample) ? row.sample.length : String(row?.sample) })
  {
    const cwd = cwdOf('probe-route-ok'), ledger = join(cwd, 'attempts.tsv')
    const r = runBoth('probe 话题入口：结果行的 ig_route —— 七个任务混在一份配置里、全部成功',
      [S('probe.ts'), '--config', cfgOf(cwd, 'htrouteok', [
        { keyword: '#htroute-tagged', dimension: 'scene', platform: 'instagram', ig_route: 'hashtag' },
        { keyword: 'htroute-plain', dimension: 'category', platform: 'instagram' },
        { keyword: 'htroute-ashashtag', dimension: 'audience', platform: 'instagram', as_hashtag: true },
        { keyword: '#htroute-hashy', dimension: 'competitor', platform: 'instagram' },
        { keyword: 'htroute-tiktok', dimension: 'category', platform: 'tiktok' },
        { keyword: '#hashtag-nobody-htroute', dimension: 'audience', platform: 'instagram', ig_route: 'hashtag' },
        // 两样线索都占（as_hashtag 且关键词以 # 开头）而没写 ig_route：只在两样同时成立时补写的实现，上面两个单线索诱饵抓不到
        { keyword: '#htroute-both', dimension: 'scene', platform: 'instagram', as_hashtag: true },
      ])], cwd, { status: 0 }, htEnv(ledger))
    if (r.ok) {
      const at = rowsByIndex(r.stdout)
      const success = (i: number): boolean => at(i) !== undefined && !at(i)?.error
      named('IG 话题入口：probe 成功结果带出任务配置里写的 ig_route，写了 hashtag 的 IG 任务那一行原样是 hashtag',
        success(0) && at(0)?.ig_route === 'hashtag',
        `task_index 0 那一行 ${showRow(at(0))} —— D15.l：任务写了就原样带出`)
      named('IG 话题入口：probe 成功结果带出任务配置里写的 ig_route，话题页一个人都没解析出来也照样是 hashtag',
        success(5) && Array.isArray(at(5)?.sample) && at(5).sample.length === 0 && at(5)?.ig_route === 'hashtag',
        `task_index 5 那一行 ${showRow(at(5))} —— D15.l：照配置带出，不由返回结果推断；样本为空时也要带`)
      named('IG 话题入口：probe 成功结果里，没写 ig_route 的 IG 任务那一行没有 ig_route 这个键',
        success(1) && !hasRoute(at(1)),
        `task_index 1 那一行 ${showRow(at(1))} —— D15.l：没写就不带这个字段`)
      named('IG 话题入口：probe 成功结果不由 as_hashtag 推断 ig_route，写了 as_hashtag 而没写 ig_route 的那一行没有这个键',
        success(2) && !hasRoute(at(2)),
        `task_index 2 那一行 ${showRow(at(2))} —— D15.l：不由 as_hashtag 推断补写`)
      named('IG 话题入口：probe 成功结果不由关键词写法推断 ig_route，关键词以 # 开头而没写 ig_route 的那一行没有这个键',
        success(3) && !hasRoute(at(3)),
        `task_index 3 那一行 ${showRow(at(3))} —— D15.l：不由关键词写法推断补写`)
      named('IG 话题入口：probe 成功结果不由平台补写 ig_route，TikTok 任务那一行没有这个键',
        success(4) && !hasRoute(at(4)),
        `task_index 4 那一行 ${showRow(at(4))} —— D15.l：不由平台推断补写`)
      named('IG 话题入口：probe 成功结果不由 as_hashtag 与关键词写法合起来推断 ig_route，两样都占而没写 ig_route 的那一行没有这个键',
        success(6) && !hasRoute(at(6)),
        `task_index 6 那一行 ${showRow(at(6))} —— D15.l：两种线索合起来也不推断补写`)
      criterion('D15.l')
    }
  }
  let routeErrorRuns = 0
  {
    const cwd = cwdOf('probe-route-err-tagged'), ledger = join(cwd, 'attempts.tsv')
    const r = runBoth('probe 话题入口：话题任务的话题页请求被拒收（402），排在最后',
      [S('probe.ts'), '--config', cfgOf(cwd, 'htrouteerrtag', [
        // 垫的成功任务故意不写 ig_route（走 Reels），和出错的那个相反
        { keyword: 'htroute-err-ok', dimension: 'scene', platform: 'instagram' },
        { keyword: '#force-402-htroute', dimension: 'audience', platform: 'instagram', ig_route: 'hashtag' },
      ])], cwd, { status: 0 }, htEnv(ledger))
    if (r.ok) {
      const row = rowsByIndex(r.stdout)(1)
      const refused = fetchAttempts(ledger).includes(`402\t${HT}`)
      named('IG 话题入口：probe 错误结果同样带出任务配置里写的 ig_route，话题页请求失败的那一行原样是 hashtag',
        refused && row !== undefined && Boolean(row?.error) && row?.ig_route === 'hashtag',
        `话题页那次请求被拒收=${refused}（账本 ${JSON.stringify(fetchAttempts(ledger))}），task_index 1 那一行 ${showRow(row)}`
        + ' —— D15.m：错误结果同样是任务写了就原样带出')
      routeErrorRuns++
    }
  }
  {
    // 诱饵照放：没写 ig_route，但写了 as_hashtag、关键词以 # 开头 —— 两样都不该让错误行长出这个字段
    const cwd = cwdOf('probe-route-err-plain'), ledger = join(cwd, 'attempts.tsv')
    const r = runBoth('probe 话题入口：没写 ig_route 的 IG 任务的 Reels 请求被拒收（402），排在最后',
      [S('probe.ts'), '--config', cfgOf(cwd, 'htrouteerrplain', [
        // 垫的成功任务故意写了 hashtag（走话题页），和出错的那个相反
        { keyword: '#htroute-err-plain-ok', dimension: 'category', platform: 'instagram', ig_route: 'hashtag' },
        { keyword: '#force-402-htroute-plain', dimension: 'competitor', platform: 'instagram', as_hashtag: true },
      ])], cwd, { status: 0 }, htEnv(ledger))
    if (r.ok) {
      const row = rowsByIndex(r.stdout)(1)
      const refused = fetchAttempts(ledger).includes(`402\t${IG_REELS}`)
      named('IG 话题入口：probe 错误结果里，没写 ig_route 的 IG 任务请求失败的那一行没有 ig_route 这个键',
        refused && row !== undefined && Boolean(row?.error) && !hasRoute(row),
        `Reels 那次请求被拒收=${refused}（账本 ${JSON.stringify(fetchAttempts(ledger))}），task_index 1 那一行 ${showRow(row)}`
        + ' —— D15.m：没写就不带这个字段')
      routeErrorRuns++
    }
  }
  {
    // TikTok 任务不可能写 ig_route（D15.j），它的错误行同样不许长出这个字段；垫的成功任务写了 hashtag，和它相反
    const cwd = cwdOf('probe-route-err-tiktok'), ledger = join(cwd, 'attempts.tsv')
    const r = runBoth('probe 话题入口：TikTok 任务的视频搜索请求被拒收（402），排在最后',
      [S('probe.ts'), '--config', cfgOf(cwd, 'htrouteerrtt', [
        { keyword: '#htroute-err-tt-ok', dimension: 'category', platform: 'instagram', ig_route: 'hashtag' },
        { keyword: 'force-402-htroute-tt', dimension: 'scene', platform: 'tiktok' },
      ])], cwd, { status: 0 }, htEnv(ledger))
    if (r.ok) {
      const row = rowsByIndex(r.stdout)(1)
      const refused = fetchAttempts(ledger).includes(`402\t${TT_SEARCH}`)
      named('IG 话题入口：probe 错误结果不由平台补写 ig_route，TikTok 任务请求失败的那一行没有这个键',
        refused && row !== undefined && Boolean(row?.error) && !hasRoute(row),
        `TikTok 搜索那次请求被拒收=${refused}（账本 ${JSON.stringify(fetchAttempts(ledger))}），task_index 1 那一行 ${showRow(row)}`
        + ' —— D15.m：没写就不带这个字段，TikTok 任务也一样')
      routeErrorRuns++
    }
  }
  // 三跑都真跑到了断言才认领 —— 任一跑没起来已经由 runBoth 带记号记过一次失败，这一跑本来也写不下认领
  if (routeErrorRuns === 3) criterion('D15.m')
})

// ---- P5.i：一次都没查到人的平台，不得从报告上静默消失 ----
group('p5i-platform', [], () => {
  // 这一条**只能端到端跑**：`meta.platforms` 的接线在 `render.ts` 里，缺省那个验证者
  // （scripts/test.ts）够不到入口脚本。单元那一头断言的是判定本身（`taskPlatforms`、
  // `keywordRows` 的四态）与渲染（直调 `renderHtml`）。
  //
  // 造法：预算只够跑完 TikTok 那几个词，IG 那个**一次都没被查过**。
  // 从采到的人反推的话，`platforms` 里就没有 instagram —— 运营看不见它，
  // 结论是「这个品类 IG 没人」，下次预算就不投（ADR-94 第三节，这条判据的由来）。
  const ghost = join(tmp, 'ghost')
  mkdirSync(join(ghost, 'memory'), { recursive: true })
  const ghostCfg = join(ghost, 'ghost.json')
  writeFileSync(ghostCfg, JSON.stringify({
    product: 'ghost', market: 'US', target_count: 9999, budget_usd: 0.002,
    tasks: [{ keyword: 'gt0', dimension: 'category', platform: 'tiktok' },
            { keyword: 'gt1', dimension: 'category', platform: 'tiktok' },
            { keyword: 'gig', dimension: 'scene', platform: 'instagram' }],
  }))
  const ghostRun = runBoth('collect 预算只够 TikTok，IG 一次都没被查过',
                           [S('collect.ts'), '--config', ghostCfg], ghost, { status: 3 })
  if (ghostRun.ok) {
    const gdir = summaryOf(ghostRun.stdout).dir
    const rendered = run('render 出一份 IG 零命中的报告', [S('render.ts'), '--dir', gdir], ghost)
    // 产出物读不到就整段跳过，**不是让自检崩** —— 崩了那条变异会被判「跑不起来」，
    // 而它本该被别处的夹具抓到，功劳就记错了人（同本文件 `requestsOnDisk` 的先例，
    // 以及 F9.e 那条旧目录夹具踩过的同一个坑）。
    const readJson = (f: string): any => {
      try { return JSON.parse(readFileSync(join(ghost, gdir, f), 'utf8')) } catch { return undefined }
    }
    const gmeta = readJson('meta.json')
    const ghtml = (() => {
      try { return readFileSync(join(ghost, gdir, 'report.html'), 'utf8') } catch { return undefined }
    })()
    const gcreators = readJson('creators.json')
    if (rendered !== undefined && gmeta !== undefined && ghtml !== undefined
        && Array.isArray(gcreators)) {
      const igPeople = gcreators.filter((c: any) => c.platform === 'instagram').length
      if (igPeople !== 0) {
        failed++
        console.error(`  ✗ IG 幽灵平台夹具${SELFCHECK_FIXTURE_MARK}：这一跑 IG 采到了 ${igPeople} 个人`
                      + ' —— 夹具要的是「一次都没查过、所以一个人都没有」，造错了这条断言就不算测过')
      } else {
        // ⚠️ **断言要落在它说的那个东西上。** 这两条头一版写的是整页 `includes(...)`，
        // 而 `instagram` 恒命中样式表里的 `.pf.instagram{`、`未查询` 恒命中同一个提交里
        // 新写的那句说明文案 —— 关键词表整个为空时照样绿（ADR-94 第十六节乙，实测）。
        // `scripts/test.ts` 那一头我改成了切 `<tbody>`，**这一头当时没跟着改**，
        // 同一个「改了一处没改另一处」的形状。
        const kwBody = ((ghtml.split('<h2>关键词表现</h2>')[1] ?? '').split('<tbody>')[1] ?? '')
          .split('</tbody>')[0]
        const subtitle = (ghtml.split('<div class="sub">')[1] ?? '').split('</div>')[0]
        named('报告副标题与 meta.json 上，一次都没查到人的平台仍然在',
              (gmeta.platforms ?? []).includes('instagram') && subtitle.includes('instagram'),
              `meta.platforms 是 ${JSON.stringify(gmeta.platforms)}，副标题是「${subtitle}」`
              + ' —— 平台从报告上消失时，运营的结论是「这个品类这个平台没人」，下次预算就不投了')
        // ⚠️ 两个条件要落在**同一行**上。头一版写的是「表体里有一行、表体里有 gig」，
        // 两件事不要求同行 —— 今天只有 gig 是未查询所以还成立，多一个未查询的词就恒真了。
        const gigRow = kwBody.split('<tr>').find(r => r.includes('gig')) ?? ''
        named('没查过的那个关键词也在表体里，写着「未查询」',
              (gmeta.keywords ?? []).some((k: any) => k.keyword === 'gig' && k.status === 'unqueried')
              && gigRow.includes('未查询'),
              `关键词表体里 gig 那一行是「${(kwBody.split('<tr>').find(r => r.includes('gig')) ?? '（没有这一行）').trim().slice(0, 120)}」`
              + ' —— 从交付名单反推时它整行都不存在，而「没有这一行」和「查了没人」看起来一模一样')
        // 反证：把表体整段挖掉，上面那两个字就必须不再命中 —— 否则说明断言看的是
        // 说明文案或样式表，而不是行。头一版那两条就是这么恒真的。
        const withoutBody = ghtml.replace(kwBody, '')
        named('把关键词表体挖空之后「未查询」不再命中 —— 证明上一条测的是行',
              !((withoutBody.split('<h2>关键词表现</h2>')[1] ?? '').split('<tbody>')[1] ?? '')
                .split('</tbody>')[0].includes('未查询'),
              '挖空表体之后那三个字仍然命中，说明那条断言测的不是行')
      }
    }
  }

  // ⚠️ **只认这两条。** 这个夹具量的是「没查过的平台和词仍然在报告上」（P5.i）
  // 与「每个任务都有自己那一行」（U3.b）—— 它**没有**量 U3.c 说的那三列长什么样，
  // 认领它就是替 U3.c 免掉一道闸（同一轮独立复核在 D6.i 上证明过这个机制，
  // ADR-94 第十五节丙）。U3.c 的证据在 `scripts/test.ts` 里。
  criterion('P5.i')
  criterion('P5.j')
  criterion('U3.b')
})

// ---- 变异集编号重复：两个入口都命中即以退出码 1 结束（M-H7-b、M-H7-c 的入口那一半）----
group('dup-ids', [], () => {
  // 判定和「两种毛病同时在时先报哪一种」都由 scripts/test.ts 断言；剩下的那一半是
  // **入口真的调了它、并且以退出码 1 结束** —— 把两处调用整块删掉，那些断言和
  // M-H7-b、M-H7-c 照样全绿，因为它们跑的是缺省那个验证者 scripts/test.ts，够不到入口。
  // 一份语料喂两个入口，里面两处毛病都放：编号重复 + 记在不存在的需求名下。
  const dupTmp = join(tmp, 'dup-mut')
  mkdirSync(join(dupTmp, 'scripts', 'check'), { recursive: true })
  mkdirSync(join(dupTmp, 'docs'), { recursive: true })
  writeFileSync(join(dupTmp, 'docs', 'requirements.json'),
    JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
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
})

// ---- 变异锚点不唯一即以退出码 1 结束（anchorMatches 的入口那一半，ADR-99 第十二节）----
group('anchors', [], () => {
  // 判定在 mutate-rule.ts 的 anchorMatches，由 scripts/test.ts 断言、M-H45-a／b 守着；
  // 剩下的是入口真的调了它、点名并以 1 结束。入口在自检的验证基础设施闭包里，
  // 指着它的变异会被「自己验自己」拒掉，所以这一半只由这条夹具守（ADR-70）。
  const anchorTmp = join(tmp, 'dup-anchor')
  mkdirSync(join(anchorTmp, 'scripts', 'check'), { recursive: true })
  mkdirSync(join(anchorTmp, 'docs'), { recursive: true })
  writeFileSync(join(anchorTmp, 'docs', 'requirements.json'),
    JSON.stringify({ requirements: [{ id: 'X1', accept: [{ id: 'X1.a' }] }] }), 'utf8')
  const anchorSource = 'const x = 1\nconst y = 2\nconst x = 1\n'
  writeFileSync(join(anchorTmp, 'a.ts'), anchorSource, 'utf8')
  writeFileSync(join(anchorTmp, 'scripts', 'check', 'mutations.json'), JSON.stringify({ mutations: [
    { id: 'M-X-e', req: 'X1', why: '锚点在目标文件里出现两处', file: 'a.ts', find: 'const x = 1', replace: 'const x = 2' },
  ] }), 'utf8')
  const out = runTool('mutate 遇到不唯一的锚点即以退出码 1 结束', 'mutate', [], anchorTmp, { status: 1 })
  if (out !== undefined) named('mutate 开跑前点名不唯一的锚点及其处数',
    out.includes('锚点不唯一') && out.includes('M-X-e') && out.includes('出现 2 处'), out)
  // 「开跑前」要看得见：先把变异写进目标文件、再发现不唯一就退出的写法，同样退 1、同样点名，
  // 而退出会跳过恢复那一步，目标文件就留着一处故意的违例（评审指出）
  named('mutate 拒绝时目标文件一个字没动',
    readFileSync(join(anchorTmp, 'a.ts'), 'utf8') === anchorSource,
    `a.ts 变成了 ${JSON.stringify(readFileSync(join(anchorTmp, 'a.ts'), 'utf8'))}`)
})

// ---- 变异的验证者接线不成立即以退出码 1 结束（wiringFault 的入口那一半）----
group('wiring', [], () => {
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
})

// ---- 自己验自己的变异即以退出码 1 结束（隔离判据的入口那一半）----
group('self-verify', [], () => {
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
  // 把 hop 与 leaf 收进真闭包（凭空多两个文件）。#81 的评审两轮抓过同一个形状的诱饵，
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
})

// ---- 见齐就停：验证者不结束，mutate 照样得判它被抓到（提前退出的入口那一半）----
group('stop-if-seen', [], () => {
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
})

// ---- 点的夹具立不住即以退出码 1 结束（清册的入口那一半）----
group('roster', [], () => {
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
})

// ---- 整跑那份报告里的豁免行，也要随负片改口（入口的第二处）----
group('exempt-lead', [], () => {
  // 上面那条断言守的是 `--brief`；**同一句话在 mutate.ts 里有两处**，整跑那一处
  // 单元测试与变异集都够不到（`mutate.ts` 在验证基础设施闭包里，指着它的变异会被
  // 「自己验自己」当场拦下，所以这一处只能有夹具、不能有负片 —— 与本文件另外四处
  // mutate 夹具同一处境）。造一份最小语料真跑一遍整跑：一条会被抓到的变异 ＋ 两条豁免，
  // 一条命中、一条不命中，两支话在同一次输出里各出现一次。约 2.7 秒。
  // 前置条件问的是 `ok`,不是「输出非空」—— 跑起来了就必须断言,一个字不打也算红
  const both = runToolBoth('mutate 整跑那份报告的豁免行随负片改口', 'mutate', [], bothTmp)
  if (both.ok && !/^\s*⊘ X1\.a 名下有负片/m.test(both.stdout)) {
    failed++
    console.error('  ✗ 整跑那份报告里，名下有负片的那条没这么说 —— 又写死了')
  } else if (both.ok && !/^\s*⊘ X1\.b 名下无变异/m.test(both.stdout)) {
    failed++
    console.error('  ✗ 整跑那份报告里，名下没有变异的那条没这么说')
  }
})

// ---- 派工那条路：真起 worker，真在隔离目录里跑 ----
group('jobs', [], () => {
  // **上面那些 mutate 夹具没有一处走到派工。** 那几道体检在派几个之前就退出了，`--brief`
  // 在打完清单那一步退出，而整跑那一份只有一条变异 —— 派几个按「不超过要跑的条数」收口
  // 成 1，落回原来那条串行路。于是隔离目录、起 worker、一条一派、打断转发、跑完核账，
  // 检查链里**一行都没执行到**：把核账那一整段从入口删掉，整条链照样全绿（实测）。
  // 指着入口的变异又造不出来（入口在验证基础设施闭包里，指着它的变异会被「自己验自己」
  // 当场拦下），所以这一层只能有夹具 —— 与本文件别处那些 mutate 夹具同一处境。
  //
  // **断言认的是「跑那一遍的当前目录在哪」，不是「结论对不对」。** 结论对不对串行也能对，
  // 证不了它真的派了工；而验证者跑在 `.check-cache/mutate-jobs/` 底下这件事，
  // 只有真派工才成立 —— 那正是整套隔离的地基：改的、还的、写的，全在各自那份副本里。
  const jobsTmp = join(tmp, 'jobs')

  seedJobs(jobsTmp, [jobMut('M-J-a', 'keep', 'gone'), jobMut('M-J-b', 'hold', 'lost')])
  rmSync(jobsMark, { force: true })
  const jobs = runToolBoth('mutate 派工：两条变异各在自己的隔离目录里跑', 'mutate',
    ['--jobs=2'], jobsTmp)
  if (jobs.ok && !/2 个变异全部被抓到/.test(jobs.stdout)) {
    failed++
    console.error('  ✗ 派工跑完，两条的结论没有都回来')
  } else if (jobs.ok) {
    // 每一行都得落在隔离目录里。串行那条路记下的会是语料根目录，一眼分得出
    const cwds = existsSync(jobsMark)
      ? readFileSync(jobsMark, 'utf8').split('\n').filter(Boolean) : []
    const outside = cwds.filter(d => !d.includes('mutate-jobs'))
    // **还要两个目录互不相同。** 只问「都在 mutate-jobs 底下」的话，两个 worker 错误地
    // 共用同一个 w0 时这条照样绿 —— 而「一人一个隔离目录」正是整套隔离的地基，
    // 那样就等于没证（#109 第四轮评审指出）
    if (cwds.length !== 2 || outside.length || new Set(cwds).size !== 2) {
      failed++
      console.error(`  ✗ 验证者没各跑在自己的隔离目录里 —— 记下的当前目录：${JSON.stringify(cwds)}`)
    }
  }

  // 派出去却没有结论回来的，是「没查过」不是通过。这里让其中一条指着一个不存在的文件，
  // 跑它的那个 worker 当场死在半路 —— 它站的是「worker 崩了／被杀了／汇报行被截断」
  // 这一整类，那几种在输出上长得一模一样。**不许把它记成通过。**
  const silentTmp = join(tmp, 'jobs-silent')
  seedJobs(silentTmp, [
    jobMut('M-J-c', 'keep', 'gone'),
    jobMut('M-J-d', '不存在', 'x', 'scripts/check/没有这个文件.ts'),
  ])
  const silent = runToolBoth('mutate 派工：有一条没回话，判成没有结论而不是通过', 'mutate',
    ['--jobs=2'], silentTmp, { status: 1 })
  if (silent.ok && !/M-J-d.*没有结论/.test(silent.stdout)) {
    failed++
    console.error('  ✗ 那条没回话的被放过去了 —— 报告里没有「没有结论」')
  }
})

// ---- 起 worker 时资源不够：报出来的原因要指向资源，不要指向派工代码 ----
group('jobs-resource', [], () => {
  // 打开的文件数到顶时，`spawn` **既不同步抛、也来不及发 `error`**：Node 在装管道之前
  // 就返回，交回来的对象上 `stdin` 压根不存在。入口不先问这一句的话，紧跟着那句给 stdin
  // 装监听器会同步抛「读不到 undefined 上的属性」—— 闸门照样非零退出、目录照样收干净，
  // 但人看到的原因是派工代码有 bug，于是去翻派工代码，而该做的是调高 `ulimit -n`。
  //
  // 判定那一半（`noStdio`）有单测和负片守着；**这里守的是入口那一半** ——
  // 问得够不够早（在碰 stdin 之前）、说的是不是资源、以及走完硬来之后目录收没收干净。
  // 那三件都在 `mutate.ts` 里，而指着它的变异造不出来（它在验证基础设施闭包里），
  // 与本文件另外几处 mutate 夹具同一处境。
  //
  // 低文件数上限不能决定耗尽位置：macOS / Node 24 曾先在复制首个 worker 时撞 EMFILE，
  // 没到这条分支（ADR-104）。保留派工语料，给复制留空间，再由临时预加载在真实
  // worker spawn 前打开描述符直到 EMFILE；不构造假的子进程，也不把复制失败当成验到了。
  //
  // **这条路上压根没有验证者可漏**，虽然它每次都走硬来（硬来现在会按组收掉各 worker 底下的
  // 验证者，见 ADR-74；这里说的不是那一刀，是这条路走到时一个验证者都还没起来）。
  // 理由是结构上的，不是运气：派工那一段从 `cpSync` 到 `spawn` 到
  // 派第一个编号，整个是**一遍同步**跑完的，中间事件循环一次都没转 —— 而 worker 要先把
  // tsx 启起来、读到 stdin，才谈得上起验证者。硬来那一句 `process.exit` 就发生在同一拍里。
  // 本夹具在第一趟真实 spawn 前耗尽描述符，spawn 返回后释放；它只验启动失败后的清理
  // 接线，不承诺清理时仍无可用描述符。持续耗尽时清理失败的边界仍见 ADR-72。
  // ⚠️ Windows 没验过，与打断那几条同一处境（ADR-72 记着）。
  const fdTmp = join(tmp, 'jobs-fd')
  seedJobs(fdTmp, Array.from({ length: 40 }, (_unused, i) =>
    jobMut(`M-J-fd${i}`, `k${i} = 'keep'`, `k${i} = 'gone'`)))
  writeFileSync(join(fdTmp, 'scripts', 'check', 'a.ts'),
    Array.from({ length: 40 }, (_unused, i) => `export const k${i} = 'keep'`).join('\n') + '\n', 'utf8')
  // 引号拼出来，不写成字面量 —— 闭包那一步按**源码文本**扫 import（「注释里的也收，
  // 宁可偏大不可偏小」），写死的话它会从本文件收到一条磁盘上不存在的路径
  // `scripts/check/check/a.ts`，「真闭包里没有磁盘上不存在的路径」当场红。
  // `seedJobs` 里那个 `q` 是同一个理由，我头一版没照做，检查当场拦下
  const fdQ = "'"
  writeFileSync(join(fdTmp, 'scripts', 'test.ts'), [
    `import * as a from ${fdQ}./check/a.js${fdQ}`,
    `const bad = Object.values(a).filter(v => v !== ${fdQ}keep${fdQ}).length`,
    `if (bad) { console.log(${fdQ}\\n${fdQ} + bad + ${fdQ} 个失败\\n${fdQ}); process.exitCode = 1 }`,
  ].join('\n') + '\n', 'utf8')
  const fdPreload = join(tmp, 'fd-at-worker-spawn.mjs')
  const exhaustedMark = '[selfcheck fd] EMFILE before real worker spawn'
  writeFileSync(fdPreload, [
    "import childProcess from 'node:child_process'",
    "import { openSync, closeSync, writeSync } from 'node:fs'",
    "import { syncBuiltinESMExports } from 'node:module'",
    'const originalSpawn = childProcess.spawn',
    'childProcess.spawn = function (...args) {',
    "  if (!Array.isArray(args[1]) || !args[1].includes('--worker')) return Reflect.apply(originalSpawn, this, args)",
    '  const held = []',
    '  try {',
    '    for (;;) {',
    "      try { held.push(openSync('/dev/null', 'r')) }",
    "      catch (error) { if (error.code !== 'EMFILE') throw error; break }",
    '    }',
    `    writeSync(2, ${JSON.stringify(exhaustedMark + '\n')})`,
    '    return Reflect.apply(originalSpawn, this, args)',
    '  } finally { for (const fd of held) closeSync(fd) }',
    '}',
    'syncBuiltinESMExports()',
  ].join('\n') + '\n', 'utf8')
  const [fdExe, fdArgv] = tsxCommand([S(SELFCHECK_TOOLS.mutate), '--jobs=32'])
  const shQuote = (a: string) => `'${a.replace(/'/g, `'\\''`)}'`
  const r = spawnSync('/bin/sh',
    ['-c', `ulimit -n 128; exec ${[fdExe, ...fdArgv].map(shQuote).join(' ')}`],
    { env: { ...env, NODE_OPTIONS: `${env.NODE_OPTIONS} --import ${JSON.stringify(pathToFileURL(fdPreload).href)}` },
      cwd: fdTmp, encoding: 'utf8' })
  if (r.error !== undefined) {
    // shell 起不来时没有验证任何断言，沿用显式未验证报告，不拿空输出记通过。
    console.log('  ⊘ 起 worker 时资源不够：这台机器上没跑 —— 压低「允许打开的文件数」'
                + '要 POSIX shell（`/bin/sh`），这里起不来')
  } else {
    const out = (r.stdout ?? '') + (r.stderr ?? '')   // P1 例外：拿不到就是空输出，这是子进程的两股流
    const left = existsSync(join(fdTmp, '.check-cache', 'mutate-jobs'))
    rmSync(join(fdTmp, '.check-cache'), { recursive: true, force: true })
    const tail = out.split('\n').slice(-6).join('\n')
    named('起 worker 时资源不够：真实派工前实际耗尽了文件描述符',
      out.split('\n').includes(exhaustedMark),
      `没有真实耗尽的运行记录 —— 这条夹具什么也没验到：\n${tail}`)
    named('起 worker 时资源不够：没有生抛出来的读属性错',
      !/Cannot read properties of undefined/.test(out),
      `报出来的是一句指向派工代码的读属性错，而不是资源不够：\n${tail}`)
    named('起 worker 时资源不够：真实命中管道未装好的分支', /连管道都没装上/.test(out),
      `没到目标分支，不能把其他失败算作验到了：\n${tail}`)
    // 钉死在 1 上，不写「非零」：`spawnSync` 在**被信号杀掉**时交回的 `status` 是 `null`，
    // 而 `null !== 0` 为真 —— 写成「非零」的话，一次被杀也会被记成「闸门正常关上了」。
    // 本仓库别处逐字分着这两件事（`Ran.status` 的契约就写着这一句），这里不能松。
    // 硬来那一步拿 1 当退出码（`hardStop` 末尾那一句），外壳用 `exec` 不吃掉它，
    // 所以 1 是确定的那个数。（这句话不能把那个退出调用原样写出来 —— 判「验证者硬退出」
    // 的那条检查按**源码文本**扫，注释也算，写了当场红。头一版就是这么红的）
    named('起 worker 时资源不够：以退出码 1 收场', r.status === 1,
      `拿到的是 ${String(r.status)} —— null 表示它是被信号杀掉的，那根本不是「退出」`)
    named('起 worker 时资源不够：说的是调高允许打开的文件数或者少派几个',
      /ulimit -n/.test(out) && /--jobs=/.test(out),
      `那句话没给出路：\n${tail}`)
    named('起 worker 时资源不够：隔离目录收干净了', !left,
      '硬来之后 `.check-cache/mutate-jobs` 还在 —— 半成品副本留在盘上了')
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
})

// ---- 判 `crashed` 那一档要留下现场（入口的第三处）----
group('crashed', [], () => {
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
})

const ranOnly = runGroups()

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
if (ranOnly !== undefined) {
  // **子集跑一律不判这一条，也不计 failed。** `covered` 只装这一跑真执行过的脚本，
  // 没跑的组自然一个都不在里面 —— 判下去必然误报。而误报的代价不是「多一条红」：
  // `failed` 一涨退出码就非零，`judgeRun` 第一句 `exitCode === 0` 走不到，
  // **`survived` 这一态对每一条负片都不可达**，于是「这条变异没人抓得住」这个
  // 最要紧的信号被静默换成 `elsewhere`。
  //
  // 照 `noShell` 的先例：缩了就照实说出来，不假装它被守住（ADR-77）。
  console.log(`  · 这一跑没验「每个可执行文件都有出处」—— 只跑了 ${ranOnly.size} 组，`
    + `谁都没跑过的那份清单在子集里不成立`)
} else if (orphans.length) {
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
} else if (ranOnly !== undefined && ranOnly.size === 0) {
  // **零组跑完不许打绿。** `--only=` 等号后面空着时 24 组一组没跑，而这一支原本
  // 打的那句话形状与一次合法的子集全绿一模一样（只有括号里的数字不同），退出码也是 0。
  // 屏幕上那两行人看得见，但真正的触发路径是 `--only=$IDS` 而 IDS 没设 —— 那时
  // 没人在看屏幕，看的是退出码。`group-rule.ts` 开头写着「什么也不验、还以退出码 0
  // 结束，那正是本仓库反复栽的那种假绿」，那条原则对空集一样成立。
  console.error('\n✗ 脚本自检：`--only=` 点了零个组 —— 这一跑一条断言都没验')
  console.error('  要整跑就别写 `--only`；要点名就至少给一个组 id。')
  process.exitCode = 1
} else if (ranOnly !== undefined) {
  console.log(`\n✓ 脚本自检（只跑 ${ranOnly.size} 组）：点名的那几组都跑完了，一条断言都没红`)
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
if (!subset && claimsPublishable(mutating, failed, startHash, fingerprint(sourceFiles()))) {
  mkdirSync(dirname(ENTRY_CLAIMS_PATH), { recursive: true })
  writeFileAtomic(ENTRY_CLAIMS_PATH, `${JSON.stringify({
    source_hash: startHash,
    covered: [],
    criteria: [...claimed].sort(),
    tensions: [],
  }, null, 2)}\n`)
}
