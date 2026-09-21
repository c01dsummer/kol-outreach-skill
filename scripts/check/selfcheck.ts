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
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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
    if (badArg !== undefined && !badArg.includes('3.0.0')) {
      failed++
      console.error('  ✗ 报错里没有出现用户打的那个值，他不知道是哪一处写错了')
    } else if (badArg !== undefined) console.log('  ✓ 报错指名用户打的那个值')
  }
})

// ---- 崩溃续跑 A / B：真实入口在落盘之前被杀，供应商账本比上限多出窗口大小（P3 · D6.a）----
group('crash-resume', [], () => {
  // 供应商真正收了几次钱，代码里没有任何变量装着 —— 假 fetch 在请求出去那一刻写一行账（旋钮见
  // fake-fetch.ts）。第 n 个 200 那一瞬间把进程 SIGKILL 掉：tikhub.ts 的 charge 已做完、入口的 persist
  // 还没跑，正是落盘窗口；再 --resume。期望值都是「上限折算的次数 + 落盘窗口内已计费的次数」，
  // 推导在 ADR-96 第三节；上限取自逐次算过的安全集合（闸门是浮点比较，有的上限比 floor 少放一次，见 ADR-96 第二节）。
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
    // A · 搜索循环：每抓一页落一次盘，窗口是一页。第一跑在第二个 200 那一瞬被杀：第一页已落盘，
    // 第二页只在内存里。第二跑 --resume 把剩下的额度花完、闸门抛、退 3。数字的推导在 ADR-96 第三节。
    // 前提：罐头 has_more 为 1，kw0 不进 done，续跑才会再搜它。
    const cwd = crashCwd('crash-a')
    const ledger = join(tmp, 'ledger-a.tsv')
    const cfg = join(cwd, 'crash-a.json')
    writeFileSync(cfg, JSON.stringify({
      product: 'crasha', market: 'US', target_count: 500, budget_usd: 0.002,
      tasks: [{ keyword: 'kw0', dimension: 'category', platform: 'tiktok' },
              { keyword: 'kw1', dimension: 'category', platform: 'tiktok' }],
    }))
    const first = runBoth('collect 搜索循环里被杀：进程以 137 结束', [S('collect.ts'), '--config', cfg], cwd,
                          { status: 137 }, { FAKE_FETCH_LEDGER: ledger, FAKE_FETCH_KILL_AFTER_OK: '2' })
    const dir = first.ok ? onlyDir(cwd, 'crasha') : undefined
    if (first.ok && dir === undefined) {
      failed++
      console.error(`  ✗ collect 搜索循环里被杀${SELFCHECK_FIXTURE_MARK}：output/ 下找不到恰好一个 crasha- 目录 —— 夹具没造对`)
    }
    if (dir !== undefined) {
      named('collect 搜索循环里被杀：盘上少记的正好是落盘窗口那一次',
            diskRequests(cwd, dir) === ledgerLines(ledger, true) - 1,
            `盘上 ${diskRequests(cwd, dir)}，账本 200 行 ${ledgerLines(ledger, true)}，窗口应是 1`)
      const second = runBoth('collect 搜索循环里被杀后续跑：预算用尽退 3', [S('collect.ts'), '--resume', dir], cwd,
                             { status: 3 }, { FAKE_FETCH_LEDGER: ledger })
      if (second.ok) {
        named('collect 搜索循环里被杀后续跑：供应商多收恰好一次',
              ledgerLines(ledger, true) === 2 + 1,
              `账本 200 行 ${ledgerLines(ledger, true)}，应是上限 2 + 窗口 1 = 3`)
        extract('A', diskRequests(cwd, dir), ledger, first.stderr, second.stderr)
      }
    }
  }

  {
    // B · 补 profile 循环：整段循环一次都不落盘，窗口 = 循环里已计费的账号数。
    // 第一跑：搜索那一页落盘后达标，进补 profile（罐头搜索结果没有 signature，人人都要补），
    //   在循环里第二个人的 200 那一瞬被杀：盘上只有搜索那一次。
    // 第二跑：达标不搜索；上次补全的结果一个都没落盘，全员重补，退 0。数字的推导在 ADR-96 第三节。
    // 上限比刚好够用再多一档：让续跑在 M-P3-b（断点永远写 0）下退出码也不变，否则那条变异会以进程记号判成跑不起来。
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
      named('collect 补 profile 循环里被杀：整段循环都在落盘窗口里',
            diskRequests(cwd, dir) === ledgerLines(ledger, true) - 2,
            `盘上 ${diskRequests(cwd, dir)}，账本 200 行 ${ledgerLines(ledger, true)}，窗口应是 2 —— 那个循环里没有落盘`)
      const second = runBoth('collect 补 profile 循环里被杀后续跑：跑完退 0', [S('collect.ts'), '--resume', dir], cwd,
                             { status: 0 }, { FAKE_FETCH_LEDGER: ledger })
      if (second.ok) {
        named('collect 补 profile 循环里被杀后续跑：供应商多收恰好两次',
              ledgerLines(ledger, true) === 4 + 2,
              `账本 200 行 ${ledgerLines(ledger, true)}，应是上限 4 + 窗口 2 = 6`)
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
  const collectOut = run('collect 完整流程', [S('collect.ts'), '--config', taskCfg], tmp)
  if (collectOut !== undefined) {
    try { dir = JSON.parse(collectOut).dir } catch {}
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
      const stingy = run('collect --resume 额度只够已经花掉的那些',
                         [S('collect.ts'), '--resume', tightDir, '--budget', '0.002'], tmp,
                         { status: 3, stream: 'stdout' })
      let afterStingy: { offsets?: unknown } | undefined
      if (stingy !== undefined) { try { afterStingy = JSON.parse(readFileSync(tightTask, 'utf8')) } catch {} }
      const pagesOf = (t: { offsets?: unknown } | undefined): string =>
        `${t === undefined ? '读不出来' : JSON.stringify(t.offsets)}`
      const pagesBefore = pagesOf(before)
      // ⚠️ 还要求中止那一刻**真的抓到过页**：语料造不出这个前提时两边都空、比较恒真，
      // 这条断言从写下那天起就没验过任何事 —— 那是这个仓库反复栽的形状。
      const measurable = !['读不出来', 'undefined', '{}'].includes(pagesBefore)
      named('续跑的额度只够已经花掉的那些时，一个请求都不再发',
            measurable && pagesOf(afterStingy) === pagesBefore,
            measurable
              ? `采集进度从 ${pagesBefore} 动到了 ${pagesOf(afterStingy)} —— 续跑的预算没有从`
                + '断点里那个数起算，同一份额度被原样重花了一遍，而用户只确认过一次'
              : `中止那一刻的采集进度是 ${pagesBefore} —— 这条断言的前提没造出来，它证不了任何事`)
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
    criterion('P3.b')
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

    // ---- 崩溃续跑 C：enrich 每个账号查完落一次盘，窗口 1（P3 · D6.a）----
    // 复制这个目录（连 creators.raw.json，fit 已经全设 ✅），预算改成只够两个账号、已花归零，删掉缓存。
    // 第一跑：第一个账号查完落盘，在第二个账号的 200 那一瞬被杀。
    // 第二跑同一条命令（enrich 没有 --resume，靠 enrichment.json 跳过已查的）：第二个账号重查、落盘，
    //   第三个账号闸门抛，收尾落盘，退 3。数字的推导在 ADR-96 第三节。
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
      crashTask.requests = 0
      writeFileSync(crashTaskFile, JSON.stringify(crashTask, null, 2))
      rmSync(join(tmp, crashDir, 'enrichment.json'), { force: true })
      const ledgerC = join(tmp, 'ledger-c.tsv')
      const diskC = () => requestsOnDisk(crashTaskFile)
      const firstC = runBoth('enrich 两个账号之间被杀：进程以 137 结束', [S('enrich.ts'), '--dir', crashDir], tmp,
                             { status: 137 }, { FAKE_FETCH_LEDGER: ledgerC, FAKE_FETCH_KILL_AFTER_OK: '2' })
      if (firstC.ok) {
        named('enrich 两个账号之间被杀：盘上少记的正好是落盘窗口那一次',
              diskC() === ledgerLines(ledgerC, true) - 1,
              `盘上 ${diskC()}，账本 200 行 ${ledgerLines(ledgerC, true)}，窗口应是 1`)
        const secondC = runBoth('enrich 两个账号之间被杀后续跑：预算用尽退 3', [S('enrich.ts'), '--dir', crashDir], tmp,
                                { status: 3 }, { FAKE_FETCH_LEDGER: ledgerC })
        if (secondC.ok) {
          named('enrich 两个账号之间被杀后续跑：供应商多收恰好一次',
                ledgerLines(ledgerC, true) === 2 + 1,
                `账本 200 行 ${ledgerLines(ledgerC, true)}，应是上限 2 + 窗口 1 = 3`)
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
      // 额度一次请求都不够 → 搜索循环第一次 charge 就抛，零次请求
      const again = runBoth('collect 旧目录夹具 a：旧目录上续跑，一次请求都发不出去',
                            [S('collect.ts'), '--resume', dir, '--budget', '0.0001'],
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
    product: 'igburn', market: 'US', target_count: 9999, budget_usd: 0.001,
    tasks: [{ keyword: 'force-noparse-kw', dimension: 'scene', platform: 'instagram' }],
  }))
  const burnRun = runBoth('collect IG 兜底撞上预算',
                          [S('collect.ts'), '--config', igCfg], igBurn, { status: 3, soft: [0] })
  named('IG 兜底撞上预算：按 P3 停下，不以退出码 0 收尾', burnRun.status === 3,
        `实际以退出码 ${burnRun.status} 结束 —— 0 的意思是「这个词跑完了」，`
        + '而预算其实已经见底，兜底那条唯一还能找到人的路一次都没发出去')
  if (burnRun.ok) {
    let bstate: any
    try {
      bstate = JSON.parse(readFileSync(join(igBurn, summaryOf(burnRun.stdout).dir ?? '', 'task.json'), 'utf8'))
    } catch {}
    if (bstate !== undefined) {
      named('IG 兜底撞上预算：这个任务不进 done，续跑还能再碰它',
            !bstate.done.includes(0) && bstate.answered?.[0] >= 1,
            `盘上 done=${JSON.stringify(bstate.done)}、answered=${JSON.stringify(bstate.answered)}`
            + ' —— reels 页恒 has_more:false，把预算用尽吞成正常返回就会当场把它标记完成，'
            + '追加预算续跑时它再也不会被碰，而它是这个词唯一还能找到人的那条路')
      named('IG 兜底撞上预算：不说「续跑不产生新的请求」',
            !burnRun.stderr.includes('续跑不产生新的请求'),
            `那句话是「${burnRun.stderr.split('\n').find(l =>
                /续跑不产生新的请求|追加预算续跑|续跑会继续发请求/.test(l)) ?? '（没说）'}」`
            + ' —— 预算已经见底而工具说「不产生新的请求」，用户据此认定这个词已经跑完了')
    }
  }

  criterion('D6.i')
  criterion('D6.j')
  criterion('D6.k')
  criterion('D6.l')
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
  // **为什么语料要有几十条变异**：派几个按「不超过要跑的条数」收口，两条变异时
  // `--jobs=32` 实际只派 2 个，fd 耗不掉。条数上去之后，复制那一步在小语料上几乎不花
  // fd，于是耗在起进程这一步 —— 实测 `ulimit -n` 36～64 全部落在这一支（真仓库那棵树上
  // 相反：复制排在前面，先撞 EMFILE，而那条路本来就报得对）。
  // 逐个试几档而不是钉死一个数：机器不同基线不同，钉死一个数是给自己埋一条会漂的夹具。
  //
  // **这条路上压根没有验证者可漏**，虽然它每次都走硬来（硬来现在会按组收掉各 worker 底下的
  // 验证者，见 ADR-74；这里说的不是那一刀，是这条路走到时一个验证者都还没起来）。
  // 理由是结构上的，不是运气：派工那一段从 `cpSync` 到 `spawn` 到
  // 派第一个编号，整个是**一遍同步**跑完的，中间事件循环一次都没转 —— 而 worker 要先把
  // tsx 启起来、读到 stdin，才谈得上起验证者。硬来那一句 `process.exit` 就发生在同一拍里。
  // 实测：48／56／64 三档各跑三遍，验证者**一次都没起来过**，跑完一个残留进程也没有
  // （拿一个一起来就记一笔、而且故意空转 30 秒的验证者量的 —— 快的那种看不出差别）。
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
  const [fdExe, fdArgv] = tsxCommand([S(SELFCHECK_TOOLS.mutate), '--jobs=32'])
  const shQuote = (a: string) => `'${a.replace(/'/g, `'\\''`)}'`
  let fdHit: { status: number | null; out: string; left: boolean } | undefined
  let noShell = false
  for (const cap of [48, 40, 36]) {
    const r = spawnSync('/bin/sh',
      ['-c', `ulimit -n ${cap}; exec ${[fdExe, ...fdArgv].map(shQuote).join(' ')}`],
      { env, cwd: fdTmp, encoding: 'utf8' })
    // **起不起得来 POSIX shell 要先问，不能默认它在。** 压低「允许打开的文件数」只有
    // `ulimit` 这一条路，而 `ulimit` 是 shell 内建 —— 原生 Windows 上 `/bin/sh` 不存在，
    // `spawnSync` 交回 `error`，两股流都是空的。不先问的话：下面那条「没有生抛出来的
    // 读属性错」拿空串去比，**空串当然不含那句话，于是记绿** —— 一条什么也没验到的假绿；
    // 再往下「至少有一档耗尽了」必红，整条 `npm run check` 在这里确定性地失败。
    // 本仓库为了不依赖 shell 专门抽过 `tsx-cmd.ts`（那条 ADR 欠条就是这件事），
    // 唯一一处 POSIX-only 的杀进程也是包在 `try/catch` 里优雅降级的 —— 照同一条路子办：
    // **不硬失败，显式降级，把没验到这件事留在报告里**（`process/README.md` 第三层的写法）
    if (r.error !== undefined) { noShell = true; break }
    const out = (r.stdout ?? '') + (r.stderr ?? '')   // P1 例外：拿不到就是空输出，这是子进程的两股流
    const left = existsSync(join(fdTmp, '.check-cache', 'mutate-jobs'))
    rmSync(join(fdTmp, '.check-cache'), { recursive: true, force: true })
    named(`起 worker 时资源不够（允许打开 ${cap} 个文件）：没有生抛出来的读属性错`,
      !/Cannot read properties of undefined/.test(out),
      `报出来的是一句指向派工代码的读属性错，而不是资源不够：\n${out.split('\n').slice(-6).join('\n')}`)
    if (/连管道都没装上/.test(out)) { fdHit = { status: r.status, out, left }; break }
  }
  if (noShell) {
    // **显式缺口，不假装它被保证了。** 注意这里打的不是一句绿：一条「因为没跑所以通过」
    // 的断言，正是本仓库最不许的那种假绿。要么真验到、要么明说没验到，不并存
    console.log('  ⊘ 起 worker 时资源不够：这台机器上没跑 —— 压低「允许打开的文件数」'
                + '要 POSIX shell（`/bin/sh`），这里起不来')
  } else {
  named('起 worker 时资源不够：三档里至少有一档真的耗尽了', fdHit !== undefined,
    '三档都走完了也没到那一支 —— 这条夹具这一跑什么也没验到，不能当它绿')
  if (fdHit !== undefined) {
    // 钉死在 1 上，不写「非零」：`spawnSync` 在**被信号杀掉**时交回的 `status` 是 `null`，
    // 而 `null !== 0` 为真 —— 写成「非零」的话，一次被杀也会被记成「闸门正常关上了」。
    // 本仓库别处逐字分着这两件事（`Ran.status` 的契约就写着这一句），这里不能松。
    // 硬来那一步拿 1 当退出码（`hardStop` 末尾那一句），外壳用 `exec` 不吃掉它，
    // 所以 1 是确定的那个数。（这句话不能把那个退出调用原样写出来 —— 判「验证者硬退出」
    // 的那条检查按**源码文本**扫，注释也算，写了当场红。头一版就是这么红的）
    named('起 worker 时资源不够：以退出码 1 收场', fdHit.status === 1,
      `拿到的是 ${String(fdHit.status)} —— null 表示它是被信号杀掉的，那根本不是「退出」`)
    named('起 worker 时资源不够：说的是调高允许打开的文件数或者少派几个',
      /ulimit -n/.test(fdHit.out) && /--jobs=/.test(fdHit.out),
      `那句话没给出路：\n${fdHit.out.split('\n').slice(-6).join('\n')}`)
    named('起 worker 时资源不够：隔离目录收干净了', !fdHit.left,
      '硬来之后 `.check-cache/mutate-jobs` 还在 —— 半成品副本留在盘上了')
  }
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
