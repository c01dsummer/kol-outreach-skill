#!/usr/bin/env tsx
/**
 * 变异测试 —— 给测试做的测试。
 *
 * 逐个应用「故意违反需求」的改动，跑**验证者**，**期望它失败**。
 * 变异被抓到 = 那条测试有效；**变异存活 = 那条测试是假的**，要修测试不是删变异。
 * **验证者崩了不算抓到**（`mutate-rule.ts`）：崩溃不是任何一条断言的功劳。
 *
 * 验证者缺省是 `scripts/test.ts`；写了 `by` 的改跑别的（今天只有自检），为的是接线
 * 那一层 —— 入口里的接线缺省那个验证者够不到。⚠️ 原先这类缺口只能靠显式缺口顶着，
 * **落地 4 起改成闸门**：只由自检认领的判据没有一条 `by: "selfcheck"` 的负片就硬失败
 * （判定在 `spec-rule.ts`，分类在 `audit-rule.ts`）。
 * `by` 与 `kills` **同进同出**，理由在下面那道校验上。
 *
 * 用法：
 *   tsx scripts/check/mutate.ts            逐个应用变异并跑测试
 *   tsx scripts/check/mutate.ts --brief    只列出每条「违反了什么」，不跑任何东西
 *   tsx scripts/check/mutate.ts --jobs=N   同时跑几条（也可以用环境变量 MUTATE_JOBS）
 *
 * 缺省按机器核数派工，**一人一个隔离目录**；`--jobs=1` 回到一条一条串着跑那条路。
 * 为什么必须隔离到目录、为什么一条一派、派出去没回话的怎么算，都在 `jobs-rule.ts`
 * 和 ADR-72 上。**串行跑和派工跑共用同一套判定** —— 同一批变异、同一个验证者、
 * 同一套归因。⚠️ 但「判定本身一个字没改」这句话在本条**不成立**：`judgeRun` 的
 * 「主动停掉」那一档改成了判开枪那一刻的快照（修一处间歇性假红，ADR-72 末节记着）。
 * 两句话不是一回事，别把前一句读成后一句。
 *
 * `--brief` 是给**写测试的那个上下文**用的：`why` 是需求语言，可以给；
 * `find`/`replace` 是实现原文，给了就等于让它读实现。
 * 见 process/4-VERIFY.md 的「给测试上下文一张准入读物清单」。
 *
 * 这条防线的强度取决于 `why` 怎么写 —— 引了实现原文的 why，`--brief` 照样把它漏出去。
 */
import { cpSync, existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { attributionFault } from './attribution-rule.js'
import { implementationLeak } from './why-rule.js'
import {
  type LabelFault, type Verifier, type WiringFault,
  VERIFIERS, allKilled, complete, crashEvidence, exemptionCovered, exemptionLead, judgeRun,
  groupOfLabel, labelFaults, labelsOf,
  wiringFault,
} from './mutate-rule.js'
import { CLAIMS_PATH } from './claims.js'
import {
  type Ran, BEACON_FLAG, beaconFrom, beaconGone, beaconNote, beaconPathOf, copyIntoWorker,
  groupShot, hardStopPlan, jobsWanted, looksLikeReport, missingVerdicts,
  noStdio, ownGroup, parseReport, reportLine,
} from './jobs-rule.js'
import {
  INTERRUPTS, beginMutation, onInterrupt, restoreMutation, stopJobs, trackTest,
} from './mutate-restore.js'
import { tsxCommand } from './tsx-cmd.js'
import { infraClosure, selfVerifying } from './verifier-rule.js'

interface Mut {
  id: string; req: string; why: string; file: string; find: string; replace: string
  /** 谁来验它。缺省 `test` —— 不写的那些逐字保持原来的行为 */
  by?: string
  /**
   * 该红的那些夹具的名字，**一组，每一条都要红**。和 `by` 同进同出 —— 写了 `by` 就必填，
   * 没写 `by` 就不许写。只收一个名字时，弄红头一条就算抓到，剩下几条明天删光也照样绿。
   */
  kills?: string[]
}
interface Exemption { req: string; scope?: string; why: string; mitigation?: string }
const cfg = JSON.parse(readFileSync('scripts/check/mutations.json', 'utf8'))
const muts: Mut[] = cfg.mutations
const exemptions: Exemption[] = cfg.exemptions ?? []

// 记在谁名下。审计拿 req 回答「这条需求有没有变异守着」—— 写成一个不存在的
// 编号时，变异照样跑、照样被抓到，全绿，而它对任何一条需求都不算数（ADR-34）。
// 名下可以是一条需求，也可以是一条验收判据 —— 豁免常常只豁免其中一条判据。
// 登记表里的 accept 拆成判据数组之前是一段话，那时名单里只有需求编号。
const registry: { id: string; accept: string | { id: string }[] }[] =
  JSON.parse(readFileSync('docs/requirements.json', 'utf8')).requirements
const known = new Set<string>(registry.flatMap(r =>
  [r.id, ...(Array.isArray(r.accept) ? r.accept.map(c => c.id) : [])]))
// 两种毛病同时在时先报哪一种，由 attributionFault 定 —— 那个先后有语义（`attribution-rule.ts`）
const fault = attributionFault(muts, [
  ...muts,
  ...exemptions.map(e => ({ id: `豁免 ${e.req}`, req: e.req })),
], known)
if (fault?.kind === 'duplicate') {
  console.error(`✗ 变异集：${fault.ids.length} 个编号重复 —— 多条顶着同一个名字，报告指不回表里哪一行\n`)
  for (const d of fault.ids) console.error(`  ${d}  出现不止一次`)
  console.error('\n  编号是报告里唯一能把一条变异指回表里那一行的东西。复制一条就改掉它的字母。')
  process.exit(1)
}
if (fault?.kind === 'orphan') {
  console.error(`✗ 变异集：${fault.entries.length} 条记在不存在的需求名下 —— 它们对任何一条需求都不算数\n`)
  for (const o of fault.entries) console.error(`  ${o.id}  记在 ${o.req} 名下，而登记表里没有这条`)
  console.error('\n  守检查链本身的写 harness；守某条需求的写它真实的编号。')
  process.exit(1)
}

const dirty = muts.flatMap(m => {
  const leak = implementationLeak(m.why)
  return leak === undefined ? [] : [`${m.id}  夹带实现原文：${leak}`]
})
if (dirty.length) {
  console.error(`✗ 变异集：${dirty.length} 条 why 夹带实现原文 —— --brief 会把它漏给写测试的上下文\n`)
  for (const d of dirty) console.error(`  ${d}`)
  console.error('\n  why 说「什么会变错、用户会看到什么」，不引代码。对外契约里的名字不算实现原文。')
  process.exit(1)
}

// 四种写错都在开跑之前拦下 —— 判据在 `mutate-rule.ts` 的 `wiringFault`，这里只把它的
// 裁定翻成人话（`docs/CONVENTIONS.md` 第 10 条）。「名字不认得」与「漏了 kills」是
// **静默的坏**；「不写 by 只写 kills」相反 —— 它**真会生效**（判定收的是验证者和点的名
// 两个独立参数），正因为生效才要拦：那是 ADR-70 明写不承诺、要另外评定的延伸。
// 第四种「kills 不是一组名字」拦的是老写法那个字符串：它连拒都拒不干净 —— 入口拿它去
// 逐项核对清册时当场抛，人看见的是一个栈，而不是「kills 写错了」。
const SAY: Record<WiringFault, (m: Mut) => string> = {
  'unknown-verifier': m => `指的验证者 ${m.by} 不认得 —— 认得的是 ${Object.keys(VERIFIERS).join('、')}`,
  'missing-kills': m => `指了验证者 ${m.by}，却没说该红的是哪几条夹具`,
  'kills-without-by': () => '写了 kills 却没写 by —— 缺省验证者那些不点名（ADR-70 说这条延伸另外评定）',
  'kills-not-list': m => `kills 要写成一组名字（["…"]），${m.by} 那条写的不是`,
}
const miswired = muts.flatMap(m => {
  const fault = wiringFault(m)
  return fault === undefined ? [] : [`${m.id}  ${SAY[fault](m)}`]
})
if (miswired.length) {
  console.error(`✗ 变异集：${miswired.length} 条的验证者接线不成立 —— 它们的绿或红都不算数\n`)
  for (const w of miswired) console.error(`  ${w}`)
  console.error('\n  by 只能写 mutate-rule.ts 认得的那几个；by 与 kills 同进同出，写一个就要写另一个。')
  process.exit(1)
}

// 指名了验证者的变异，不许改**验证者自己要用的东西** —— 那是自己验自己，跑出来的
// 绿或红都不算数（ADR-70「两处接缝」第二条）。**整条判据都在 `verifier-rule.ts`**，
// 连遍历也在：递归到多深是判定，不是 I/O（评审指出）—— 留在入口的话，「少走一层」
// 这种坏法没有任何断言够得着，而闭包缩小的那一头是放行。入口只出一个读法。
const infra = infraClosure(f => existsSync(f) ? readFileSync(f, 'utf8') : undefined)
const selfVerified = muts.filter(m => selfVerifying(m, infra))
if (selfVerified.length) {
  console.error(`✗ 变异集：${selfVerified.length} 条在自己验自己 —— 它们的绿或红都不算数\n`)
  for (const m of selfVerified) console.error(`  ${m.id}  改的 ${m.file} 是 ${m.by} 自己要用的东西`)
  console.error(`\n  验证基础设施闭包共 ${infra.length} 个文件。要么把变异挪到被测对象上，`
                + '要么让缺省那个验证者来验它。')
  process.exit(1)
}

// 点的那些夹具真的在，而且各自只有一条叫那个名字 —— 判据在 `mutate-rule.ts` 的
// `labelsOf` / `labelFault`。**扫源码也是判定**（`mutate-restore.ts` 判字面形状那条的同一路数）：
// 扫得出什么决定了清册有多大，而清册小了是拦住、大了是放行。入口只出一个读法，
// 外加「同一个验证者只读一次」—— 上面两道体检已经放行，`by` 到这里必定认得。
// **排在隔离之后**：由粗到细 —— 自己验自己是「这份证据整份不算数」，
// 点不着夹具是「证据算数，但功劳记错了人」。反过来排，一条自己验自己的变异
// 会先因为名字问题被打回，人改完名字再撞第二堵墙。
const inventories = new Map<string, ReadonlyMap<string, number>>()
const inventoryOf = (by: string): ReadonlyMap<string, number> => {
  const had = inventories.get(by)
  if (had !== undefined) return had
  const v = VERIFIERS[by]
  const built = labelsOf(existsSync(v.script) ? readFileSync(v.script, 'utf8') : '', v.declares)
  inventories.set(by, built)
  return built
}
/**
 * 这条负片只要跑验证者的哪几组 —— 交回 `undefined` 就是「整跑」。
 *
 * **任何一条点名的夹具落不进某一组，就整跑。** 那说明它在组外（比如文件末尾
 * 不属于任何一组的那段），缩到子集会把它整段漏掉 —— 而漏掉的表现是「跑完、没红」，
 * 一条本该被抓到的变异会被判成没人抓得住。宁可多跑，不可漏验。
 */
const groupsFor = new Map<string, ReadonlyMap<string, string>>()
const onlyFor = (m: Mut): string[] | undefined => {
  if (m.by === undefined || m.kills === undefined) return undefined
  const v = VERIFIERS[m.by]
  let map = groupsFor.get(m.by)
  if (map === undefined) {
    map = groupOfLabel(existsSync(v.script) ? readFileSync(v.script, 'utf8') : '', v.declares)
    groupsFor.set(m.by, map)
  }
  const ids = m.kills.map(k => map!.get(k))
  if (ids.some(id => id === undefined)) return undefined
  return [...new Set(ids as string[])]
}
const SAY_LABEL: Record<LabelFault, (m: Mut, label: string) => string> = {
  'unknown-label': (m, k) => `点的夹具「${k}」不在 ${m.by} 的清册里 —— 名字写岔了，或者那条夹具没了`,
  'ambiguous-label': (m, k) => `${m.by} 里不止一条夹具叫「${k}」—— 红的是哪一条分不出`,
}
// 「名单里每一项各查一次」是语义，判定在 mutate-rule.ts，这儿只渲染（CONVENTIONS 第 10 条）
const misnamed = muts.flatMap(m => {
  if (m.by === undefined || m.kills === undefined) return []
  return labelFaults(m.kills, inventoryOf(m.by)).map(f => `${m.id}  ${SAY_LABEL[f.fault](m, f.label)}`)
})
if (misnamed.length) {
  console.error(`✗ 变异集：${misnamed.length} 条点的夹具立不住 —— 它们的绿或红都不算数\n`)
  for (const w of misnamed) console.error(`  ${w}`)
  console.error('\n  kills 要逐字抄验证者里那条夹具的名字。清册静态扫源码得出，只认字面量 ——'
                + '拼出来的名字点不着，把那条夹具的名字写成字面量。')
  process.exit(1)
}

if (process.argv.includes('--brief')) {
  // **攒起来一次同步写，不是逐行 console.log。** 下面那句硬退出紧跟在打印之后，而 stdout
  // 接管道时 `console.log` 是异步的 —— 排在队里还没写出去就被 `process.exit` 掐掉。
  // 照自检那条 spawn 路径实测 8 次：豁免行只活下来 2 次，末尾那句汇总只活 1 次，
  // 另外 6 次停在 139／140／221／233 行。而豁免行恰好在最末尾，正是要断言的那一段。
  // 这就是 `mutate-rule.ts` 的 `exitRace` 记着的那个坑 —— 那道判据只查**验证者**，
  // 查不到 `mutate.ts` 自己，于是同一个坑在检查链自己身上又踩了一次（#91 评审引出）。
  const out = ['\n变异集 —— 每条变异「违反了什么」。不含实现原文，可以交给写测试的上下文。\n']
  for (const m of muts) out.push(`  ${m.id}  [${m.req}]  ${m.why}`)
  for (const e of exemptions) {
    const lead = exemptionLead(exemptionCovered(e.req, muts))
    out.push(`  ⊘     [${e.req}]  ${lead}${e.scope === undefined ? '' : `（${e.scope}）`}：${e.why}`)
  }
  out.push(`\n共 ${muts.length} 个变异、${exemptions.length} 处显式豁免。`)
  writeFileSync(1, `${out.join('\n')}\n`)
  process.exit(0)
}

/**
 * 验证者那几百个进程共用的一份 V8 编译缓存。
 *
 * 一次验证者跑里真正在断言的部分只占一成三，其余是起进程和装模块 —— 而装模块里
 * 有一大块是同一批源文件被反复编译。Node 自己的这份缓存把编译结果落到盘上，
 * **本仓库只做一件事：告诉它放哪，好让几百次跑共用同一份**（跑在隔离目录里的
 * 那几个 worker 各有各的 cwd，不指绝对路径的话就成了几份互不相通的缓存）。
 *
 * **它失效在源码上，不失效在时间上。** 缓存条目由 Node 按源文本、Node 版本与 V8
 * 参数校验，对不上就当场重编 —— 也就是说，一条变异改过的那个文件永远不会命中
 * 未改之前那一条。缓存里没有任何「上一次的结论」，只有「这段字节码是这段源码编出来的」。
 * 这一层对判定不可见：跑的还是那批断言，抓到还是抓到。
 *
 * 认已有的值：外面已经指了一份就用那份，不覆盖人家的安排。
 */
const NODE_COMPILE_CACHE = process.env.NODE_COMPILE_CACHE ?? resolve('.check-cache/compile-cache')

const survived: Mut[] = []
const elsewhere: Mut[] = []
const crashed: Mut[] = []
const notApplied: Mut[] = []
const silent: Mut[] = []

// 变异跑不得留下痕迹 —— 源码在 finally 里还原，那份覆盖记录同理。
// 平时 test.ts 认得 MUTATING 标记、既不清也不写；但**变异改的正可能是那个判定
// 本身**，那一次跑就会把记录清掉或写脏。记录只由一次干净的 npm test 产生，
// 在这里存下再放回去，免得一个被抓到的变异顺手把后面的审计弄红。
const claimsBackup = existsSync(CLAIMS_PATH) ? readFileSync(CLAIMS_PATH) : undefined
// 本来就没有记录时**要把新长出来的删掉**：变异改的可能正是写盘资格那个判定，
// 那一跑会凭空写下一份由被改过的源码产生的记录，留下就是给后面的审计递假证。
const restoreClaims = () => {
  if (claimsBackup) writeFileSync(CLAIMS_PATH, claimsBackup)
  else rmSync(CLAIMS_PATH, { force: true })
}
process.on('exit', restoreClaims)
// 但**信号杀进来时 exit 处理也不跑** —— Ctrl-C、被杀掉、CI 超时、终端关掉，
// 留下的是一份被改写的源文件加一份对不上的覆盖记录，而没有任何东西说过它们在那儿。
// 下面记现场那一步顺手把这几个信号接管了（`mutate-restore.ts`），
// 让「被打断」和「跑完」走同一条还原路径 —— 这里不再单写一行，是为了没有一行可忘。

/**
 * 跑一次验证者。**异步等，不能同步等。**
 *
 * 信号处理是排在事件循环上的：同步等子进程（`node:child_process` 里带 Sync 的那几个）
 * 会把事件循环整个挡住，挡住的那段时间里，接管过的信号一次也派发不出去。而变异跑起来
 * 之后，**几乎所有时间都在等子进程**——挡住的正是要接管的那一段。
 *
 * 上一版就是同步等的，实测两条路都不成立：只给这个进程发 SIGTERM，信号被整个吞掉
 * （接管压住了默认动作，处理函数又轮不上），循环跑完还以 0 退出；Ctrl-C 打到整个
 * 进程组时这一轮靠 `finally` 还回去了，但循环照样把剩下两百个变异跑完才停。
 * 两条都是「接管了信号，看上去做了，实际没有」（评审指出）。
 *
 * stdout 和 stderr 分开收：判定认的是自成一行的失败汇总，两股混着收会在块边界
 * 把那一行劈开（`mutate-rule.ts`）。
 *
 * ⚠️ **Windows 上的打断没修，别把下面那个 `detached` 当成全的。**
 *
 * 「起不起得来」那一半已经修好，而且是**三处一起修**的：怎么起 tsx 全仓只此一份，
 * 连同选它的理由都在 `tsx-cmd.ts` 上（ADR-69 第一块欠条 —— 那条欠条自己写明
 * 修法是三处一起改，只改一处就是又一次「只修实例」）。这里只剩没修的那一半。
 *
 * 没修的是**「把它停下来」**：`mutate-restore.ts` 的 `killTest` 用的是
 * `process.kill(-pid)` —— 负号是 POSIX 的进程组语义，配的是这里的 `detached`。
 * 而 `detached` 在 Windows 上给的是**一个自己的控制台窗口，不是进程组**，
 * 那一刀落不到任何东西上，还被 `catch` 吞掉。
 *
 * 落空的**不是**还原：`onInterrupt` 是「先杀、再还原、才退出」，那一刀被吞掉之后
 * `restoreMutation` 照样跑，源文件还是还得回去（**评审指出，我原先在这里写错了**）。
 * 落空的是子进程那一半：它活着，跑的是被改过的源码，而父进程已经还原完、退出了 ——
 * 正是 `trackTest` 那段注释说的「父进程退掉不会把它带走」那个窗口，
 * 在 Windows 上没有东西关得上它。
 *
 * **覆盖记录也在这个窗口里，但坏法是「被清掉」，不是「被写脏」**（这一段前后被评审
 * 纠正了三次，最后这版是我实际跑出来的）：平时 `MUTATING=1` 让子进程既不清也不写
 * 那份记录，而**变异改坏的可能正是那个判定本身** —— M-H14-e 就是把「谁拥有这份记录」
 * 改成人人有份，于是子进程开跑时把记录**删了**。它写不回一份新的：M-H14-e 自己会被
 * `test.ts` 里那条断言抓到，`fail` 不为零，而写盘资格还要求 `fail === 0`
 * （`claimsPublishable`，那一半没被同时变异）。
 *
 * 实测：造一份记录，改坏 `claimsOwnedBy`，带 `MUTATING=1` 跑一次 —— 退出码 1，
 * 记录没了，也没有新的写出来。所以 Windows 上子进程没被杀掉时，它可能在父进程把
 * 备份放回去**之后**再清一次，盘上于是没有记录：审计报「先跑 `npm test`」。
 * 那是个**响**的坏法（假的「没测过」），不是静默的假证据 —— 方向要说准，
 * 否则修它的人会去防一个不会发生的事。
 *
 * **这一条至今没修，也不假装修了** —— 改它要碰 `mutate-restore.ts` 的杀进程策略
 * （Windows 上得换成 `taskkill /T` 之类），是另一个证据问题。
 *
 * **本仓库的 CI 只跑 Linux，所以上面关于 Windows 的话没有任何自动化验过。**
 * 它靠的是 Node 官方文档 + 代码推理，不是一次真的 Windows 运行。Linux 这一侧
 * 是真跑过的：整条变异链绿。
 */
/**
 * 跑一次验证者。点了名的话**见齐就停** —— 名单里每一条都红过之后不必再等它跑完。
 *
 * 「见齐了没有」是判据，在 `mutate-rule.ts` 的 `allKilled`；这里只管什么时候杀
 * （`docs/CONVENTIONS.md` 第 10 条）。只按**整行**问：收到的字节按 \n 切，最后一段
 * 可能是半行，留着等下一块 —— 拿半行去匹配，名字会在写到一半时就算数。
 */
/**
 * 这一跑有没有人收验证者的号。判定在 `beaconFrom`：串行那条路、被当工具起的 `mutate`、
 * `--brief`，argv 里都没有那个参数，于是这里是 undefined，一个字节都不落盘。
 */
const BEACON = beaconFrom(process.argv)

/**
 * 这一轮的验证者没了，把号抹掉。**判定在 `beaconGone`** —— 这里只剩「它给了就抹」。
 *
 * **先作废，再删。** 只删不作废的话，删失败（只读、盘满）会留下一份**号还合法**的文件；
 * 下一次硬来会拿那个早就死了的号去发刀，而那个号可能已经被系统分给了别人 ——
 * 那正是 ADR-74 里「死号」那一段说的最坏情形，也是这个仓库栽过两次的形状
 * （#116 第二轮评审指出）。先写一个**读回来认不出**的空正文：即便接着的删失败了，
 * 硬来那一步读到的是「号在却认不得」，于是**出一句话、不发刀** —— 响，而且不误伤。
 */
const forgetVerifier = (): void => {
  const gone = beaconGone(BEACON)
  if (gone === undefined) return
  let why: string | undefined
  try { writeFileSync(gone, '') } catch (e) { why = e instanceof Error ? e.message : String(e) }
  try { rmSync(gone, { force: true }); why = undefined } catch { /* 作废成了就够 */ }
  if (why === undefined) return
  // **两步都没成 = 文件里还是一个合法的号**，而这个 worker 接着就去接下一条了。
  // 那个号迟早被系统回收分给别人，下一次硬来就对着无关的一组开刀 —— 正是上面
  // 整段要挡的那一格。所以不许往下走：就地停（#116 第五轮评审指出）。
  // 出话这一步**必须兜住**：它抛出去就是从 `close` 监听器里抛，promise 不 resolve、
  // `runOne` 的 `finally` 走不到 —— 被改过的源码留在 worker 树里。和第五轮在 `hardStop`
  // 那头修的是同一类，我在同一条提交里又犯了一次（#116 第六轮评审指出）。
  try {
    writeFileSync(2, `\n⚠️ 验证者的号作废不掉(${why}) —— 这个 worker 停在这里，这一条没有结论\n`)
  } catch { /* 说不出也要停 */ }
  // **停要走 `onInterrupt`，不能自己还原完就退。** 走信号那条路进来时手上正有一个
  // 活着的验证者（号文件里有号就是证据），而 `onInterrupt` 的顺序是定死的：先杀那一组、
  // 再还原、最后退。自己写「还原+退出」会把杀组那一步整个跳过 —— 恰好在最需要它的那一格
  // 留下孤儿（#116 第七轮评审指出）。从 `close` 那条路进来也安全：`trackTest` 的监听器
  // 装在前面、先跑，已经把这个收摊的子进程抹掉了，`killTest` 拿不到号直接返回。
  onInterrupt()
}

const runTest = (verifier: Verifier, kills?: readonly string[], only?: readonly string[]):
  Promise<{ status: number | null; output: string; atStop?: string }> =>
  new Promise(resolve => {
    // 带标记跑：变异跑的是被改过的源码，那一次执行留下的覆盖记录不作数，
    // 记录只能由一次干净的测试运行写（test.ts 据此跳过写盘）。
    // 自成一组：被打断时要连它一起结束，而只杀手上这一个是杀不掉的 ——
    // `tsx` 自己还要再分出一个真正跑脚本的进程来（POSIX 上才成立，见 `tsx-cmd.ts`）
    const [exe, argv] = tsxCommand(
      only === undefined ? [verifier.script] : [verifier.script, `--only=${only.join(',')}`])
    const kid = spawn(exe, argv,
      { stdio: 'pipe', detached: true, env: { ...process.env, MUTATING: '1', NODE_COMPILE_CACHE } })
    trackTest(kid)
    let out = ''
    let err = ''
    /** 我们动手那一刻它说过的话。**没动手就是 undefined** —— 判定据此分岔 */
    let atStop: string | undefined
    // 见齐了就把整组停掉。**杀的是进程组**（负的 pid）：`tsx` 底下还有一个真正跑脚本的
    // 进程，只杀手上这一个杀不掉，剩下那个会一直跑到自己结束 —— 那样「省下的时间」就没了
    const stopIfSeen = (): void => {
      if (atStop !== undefined || kills === undefined) return
      // **两股各自截**：合起来再截会把两者之间那个人为插入的换行当成行尾，于是先到的
      // 那一股的半行被当成整行 —— 名字写到一半就算数，后缀还没到就把人杀了（#99 评审指出）
      const whole = complete(out) + complete(err)
      if (!allKilled(whole, kills)) return
      // **杀成了才算停过**：信号发不出去（负 pid 在别的平台上不成立、或者它正好自己退了）
      // 时把标志立起来，判定就会去走那条绕开汇总的路，而这一次其实是跑到底的 ——
      // 一次普通的「非零退出、没有汇总」会被记成被抓到（#99 第二轮评审指出）
      try {
        process.kill(-(kid.pid as number), 'SIGTERM')
        // **快照留在开枪之前。** 这一刀连验证者手上的子进程一起杀，它临死会补打一句
        // 带「进程」记号的失败 —— 那是我们自己打出来的，不能算进这条变异的账
        atStop = whole
      } catch { /* 没杀成：这一次就当没停过，按老规矩判 */ }
    }
    kid.stdout.on('data', d => { out += d; stopIfSeen() })
    kid.stderr.on('data', d => { err += d; stopIfSeen() })
    // 压根没起来（命令不在、权限不足）也要留下话：那时两股都是空的，
    // 判定只会说「跑不起来」，而人得知道是没起来还是跑崩了
    kid.on('error', e => { err += `\n${e}` })
    kid.on('close', status => { forgetVerifier(); resolve({ status, output: `${out}\n${err}`, atStop }) })
    // **留号在装完那两个监听器之后。** 放在 `trackTest` 紧后面的话,这一句一抛就落在
    // 「验证者已经起来、监听器还没装」那个缝里 —— promise 永不落地,`runOne` 的 `finally`
    // 不跑,被改过的源文件留在工作区。
    //
    // **抛了不能就这么放着。** 头一版在这里把异常吞掉,注释还写着「不许留下孤儿」——
    // 而那正是它干的事:验证者已经在跑,号文件却不存在,派工那头读到 ENOENT 会当成
    // 「压根没起验证者」,于是这一组被静默过继出去(#116 第一轮评审指出)。
    // 手上有号,就地连组收掉:这一条于是没有结论,而**没有结论不是通过**
    // (`process/README.md` 总纲),下游会当作「跑不起来」报出来,带着下面这句现场。
    const note = beaconNote(BEACON, kid.pid)
    if (note !== undefined) {
      try { writeFileSync(note.path, note.text) } catch (e) {
        err += `\n⚠️ 验证者的号发不出去(${e instanceof Error ? e.message : String(e)})`
             + ` —— 就地把那一组收掉,这一条没有结论`
        // 算号走同一道判定(同样的往返核对与自保守卫),不在入口里另写一份
        const shot = groupShot(`${kid.pid}\n`, { pid: process.pid, pgid: readOwnGroup() })
        if (shot !== undefined) { try { process.kill(shot, 'SIGKILL') } catch { /* 组散了 */ } }
      }
    }
  })

/**
 * 跑一条变异：应用、跑验证者、判、还原。**串行跑和派工跑共用这一份。**
 *
 * 两边各写一份的话，「还原」「判定」这些正是分岔的地方 —— 而分岔出来的差别，
 * 在报告上和「这条变异本来就是这个结论」长得一模一样。
 *
 * **现场跟着结论一起交出去，不留在这儿。** 判 `crashed` 那一档要摆出验证者说过什么，
 * 而派工跑的时候「跑」在 worker 进程里、「报」在派工进程里 —— 现场留在局部变量里，
 * 过不了那道进程边界，报告就只剩一句「跑不起来」而没有为什么。那正是这一档
 * 唯一的用处（分辨「真崩了」与「这一次不巧」）。
 */
const runOne = async (m: Mut): Promise<Ran> => {
  const orig = readFileSync(m.file, 'utf8')
  if (!orig.includes(m.find)) return { outcome: 'not-applied', status: null, stopped: false, output: '' }
  beginMutation(m.file, orig)
  try {
    // 写盘也在这一段里面：写盘是先截断再写的，写到一半抛出去（盘满、IO 错）留下的是
    // 半份源文件，而那时 `finally` 要是够不着，被截断的那份就留在工作区里，
    // 记着的现场谁也不去取（评审指出）
    writeFileSync(m.file, orig.replace(m.find, m.replace), 'utf8')
    // 非零退出是期望的结果 —— 但要看是断言红的,还是进程死在半路(被信号杀掉时 status 为 null);
    // 点了名的还要再看一层:红的是不是 kills 说的那一条
    const verifier = VERIFIERS[m.by ?? 'test']
    const r = await runTest(verifier, m.kills, onlyFor(m))
    return {
      outcome: judgeRun(r.status, r.output, verifier, m.kills, r.atStop),
      status: r.status, stopped: r.atStop !== undefined, output: r.output,
    }
  } finally {
    restoreMutation()
  }
}

/** 一条变异的结论怎么报、记在哪一摞里。**派工那一侧也走这里**，报告只此一份写法 */
const record = (m: Mut, ran: Ran): void => {
  if (ran.outcome === 'not-applied') {
    notApplied.push(m)
    console.log(`  ⚠ ${m.id}  锚点失效，未能应用`)
  } else if (ran.outcome === 'caught') console.log(`  ✓ ${m.id}  [${m.req}] 被抓到`)
  else if (ran.outcome === 'elsewhere') {
    elsewhere.push(m)
    console.log(`  ✗ ${m.id}  [${m.req}] 红的不是点名的那些 —— ${m.by} 确实红了，`
                + `但点名的「${(m.kills ?? []).join('」「')}」里有没红的`)
  } else if (ran.outcome === 'crashed') {
    crashed.push(m)
    console.log(`  ✗ ${m.id}  [${m.req}] 跑不起来 —— 验证者死在半路,没有任何一条断言抓到它`)
    // 现场：退出码、有没有因为见齐点名而主动停、以及验证者打出来的失败行。
    // 带记号的那些是判定一票否决的原因,不带记号的说明断言真的红过 —— 两者分得开。
    // ⚠️ 「没主动停」**不等于「跑到了尾」**：被信号杀掉的那一次也是没主动停（评审指出，
    // 头一版写成「跑到了尾」，跟「无，被信号杀掉」摆在同一行里自相矛盾）。
    // 留哪几行是判定，在 `mutate-rule.ts`（`docs/CONVENTIONS.md` 第 10 条）。
    console.log(`      退出码 ${ran.status === null ? '（无，被信号杀掉）' : ran.status}`
                + ` · ${ran.stopped ? '见齐点名的就停了' : '未因见齐点名而主动停'}`)
    const scene = crashEvidence(ran.output, VERIFIERS[m.by ?? 'test'])
    if (scene.lines.length === 0) console.log('      验证者一个字都没打出来')
    else {
      // 两种现场的前缀**分得开**：`│` 是成形的失败行（断言说了话），
      // `┆` 是原始输出的尾巴（一条成形的失败行都没有，八成是真崩了）。
      if (scene.raw) console.log('      没有成形的失败行，下面是它最后几行输出：')
      for (const l of scene.lines) console.log(`      ${scene.raw ? '┆' : '│'} ${l}`)
    }
    if (scene.omitted) console.log(`      （另有 ${scene.omitted} 行未显示）`)
  } else { survived.push(m); console.log(`  ✗ ${m.id}  [${m.req}] 存活 —— ${m.why}`) }
}

/**
 * 干活的那一侧：从 stdin 一行一个编号收，跑一条回一句，收到 EOF 就收工。
 *
 * **只往 stdout 写结论那一种行**，人看的报告由派工那一侧打 —— 两边都打的话，
 * 同一条变异在同一份输出里出现两次，而两次的措辞将来一定会岔开。
 *
 * 写用的是同步那一路（和 `--brief` 同一个理由）：紧接着可能就没有事件循环再跑了，
 * 排在队里没写出去的那一行会被当成「这一条没回话」，而那是硬失败。
 */
if (process.argv.includes('--worker')) {
  // **抹号的处理函数要装在第一次 `beginMutation` 之前**，也就是排在 `mutate-restore`
  // 那个会退掉进程的处理函数之前 —— 否则温和那条路上 worker 收到 SIGTERM 就走
  // `onInterrupt` 硬退出，`close` 永远不来，整 5 秒宽限期里人人都留着一份死号。
  //
  // ⚠️ **它必须自己也把进程收掉，不能只做清理。** 装上任何一个处理函数，Node 的默认
  // 终止动作就被压住（实测：只做清理的那种，进程照样活着）—— 这一句到 `beginMutation`
  // 装上真正那个之间收到 SIGTERM 的 worker 会只清理、接着等 stdin，派工看不到它
  // `close`，白等满整个宽限期（#116 第四轮评审指出）。抹号排在收尾**之前**是有意的：
  // 万一在这两句中间被硬杀，号文件已**作废**（写空），派工读到「号在却认不得」——
  // 出一句话、不发刀，而不是对着一个可能已被回收的号开刀。
  for (const sig of INTERRUPTS) process.on(sig, () => { forgetVerifier(); onInterrupt() })
  const byId = new Map(muts.map(m => [m.id, m]))
  for await (const line of createInterface({ input: process.stdin })) {
    const m = byId.get(line.trim())
    if (m === undefined) break
    writeFileSync(1, `${reportLine(m.id, await runOne(m))}\n`)
  }
  process.exit(0)
}

/**
 * 派工那一侧：一人一个隔离目录，一条一派，谁先空出来谁接下一条。
 *
 * **隔离到目录，不是到进程。** 一条变异是真的改写一份源文件；两条同时改同一棵树，
 * 验证者跑的就是「两处叠在一起」那棵树，而报告仍按条归因 —— 每一条的绿或红都不算数。
 * 所以每个 worker 拿一份自己的源码树：改的、还的、它那一跑写下的覆盖记录，全在自己那份里。
 * `node_modules` 是符号链接，那份没人改。
 *
 * 复制时把 `.check-cache` 排除在外 —— worker 目录自己就在那底下，不排除会一路复制自己。
 *
 * ⚠️ **这一句靠的是 `cpSync` 的一处没写进文档的次序**（#109 评审追问出来的）：
 * 目标目录在源目录**底下**时 `cpSync` 会拒绝（`ERR_FS_CP_EINVAL`），而 `filter`
 * 是在那道检查**之前**跑的 —— `.check-cache` 整棵被 `filter` 挡掉，那道检查于是根本
 * 没机会撞上。Node v22.22.2 上实测成立（本条全部计时数据都来自真跑成功的并行）。
 * 但**官方文档没有承诺这个次序**：哪天它挪到检查后面，症状是每一次派工跑当场抛
 * `ERR_FS_CP_EINVAL`（响的，不是静默的）。升 Node 之后要重新确认的就是这一句；
 * 真变了的话，改法是把 worker 目录挪到源码树外面（比如 `mkdtempSync` 到系统临时目录），
 * 而那会连带改掉「隔离目录跟着仓库走、看得见也删得掉」这个性质。
 *
 * 报告的行序是**跑完的先后**，不再是清单的顺序（串行那条路仍是清单顺序）。
 * 每行自带编号，归因不受影响；换来的是跑的过程中一直有东西在动，而不是憋到最后一次吐完。
 */
const JOBS_DIR = '.check-cache/mutate-jobs'
/** 宽限期：请 worker 自己收摊之后等多久。它们要停掉手上的验证者、把动过的那份还回去 */
const GRACE_MS = 5000
const SELF = fileURLToPath(import.meta.url)

/**
 * 读一份号。**「没有这个文件」与「读不动」不能压成同一个值**：前者是「量出来是零」
 * （那个 worker 没起验证者），后者是「没量成」（fd 到顶、权限），而硬来那一步正是
 * fd 到顶最爱发生的地方。压成一个值的话，真出事那次就淹在一堆正常里（`CONVENTIONS.md` 第 3、6 条）。
 */
const readBeacon = (path: string): { text?: string; error?: string } => {
  try { return { text: readFileSync(path, 'utf8') } }
  catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    return code === 'ENOENT' ? {} : { error: code ?? String(e) }
  }
}

/**
 * 这个进程自己那一组的号，拿不到就 undefined。判定（怎么从那一行里切出来）在 `ownGroup`。
 * 拿不到时自保守卫那一格就是没守 —— 非 Linux、procfs 没挂的时候如此，记在 ADR-74。
 */
const readOwnGroup = (): number | undefined => {
  try { return ownGroup(readFileSync('/proc/self/stat', 'utf8')) } catch { return undefined }
}

const dispatch = async (jobs: number): Promise<void> => {
  rmSync(JOBS_DIR, { recursive: true, force: true })
  const queue = muts.map(m => m.id)
  const byId = new Map(muts.map(m => [m.id, m]))
  const reported = new Set<string>()
  /** 一个槽 = 一个 worker 壳,加上它那份号文件搁哪 */
  const live = new Set<{ kid: ChildProcess; beacon: string }>()
  // 硬来那一步：还没停的 worker 直接杀掉，把目录收干净，非零退出（这一跑没跑完，不能算过）。
  // ⚠️ **那一刀落在 tsx 壳上，连 worker 自己都没杀到**（实测：SIGTERM 壳会转发、worker 死；
  // SIGKILL 转发不了、worker 活着，而且 `close` 永远不来）。验证者更够不到 —— 它是
  // `detached` 起的、自成一组。所以这里不再只发那一刀：判定 `hardStopPlan` 排出整张计划，
  // 壳一刀、每个读得出号的验证者组一刀、读不动或认不出的各出一句话、最后才删目录。
  // **「真 worker 仍然活着」这一格本条没修**，边界与修法记在 ADR-74（ADR-72 那张欠条已还）
  //
  // ⚠️ **没起来的那个不许杀。** `spawn` 因为资源不够没起来时交回的对象上 `pid` 是
  // undefined，而对它调 `kill` 打出去的**不是「那个子进程」** —— 实测那一刀落在
  // **调用者自己这个进程组**上：派工进程当场 137（SIGKILL，不是未捕获异常的 1），
  // 收目录那一句再也走不到，半成品副本连同里面那份**被改过的源码**留在盘上。
  // 在终端里跑的话，挨这一刀的还包括人的那个前台组。
  // `mutate-restore.ts` 的 `killTest` 早就有这个守卫（`pid === undefined` 就返回），
  // 这里漏了 —— 同一个坑的第二处。
  //
  // 是 #111 的 CI 逼出来的：同一个提交两个 job 一绿一红，红的那次报「隔离目录没收干净」。
  // 本地同形状 32 次复现到 2 次，插同步标记定位到死在「杀第 N 个 pid=undefined」那一句。
  const hardStop = (): never => {
    const self = { pid: process.pid, pgid: readOwnGroup() }
    for (const step of hardStopPlan(live, readBeacon, self)) {
      if (step.do === 'kid') { try { step.kid.kill('SIGKILL') } catch { /* 早没了 */ } }
      else if (step.do === 'group') { try { process.kill(step.shot, 'SIGKILL') } catch { /* 组散了 */ } }
      else if (step.do === 'warn') { try { writeFileSync(2, step.text) } catch { /* 说不出也要收完 */ } }
      else break
    }
    // 收不动也要把话说完整。这一步的承诺是「杀干净、收目录、非零退出」，而递归删一棵树
    // 是要开目录的：实测剩 0 个 fd 时 `rmSync` 抛 `EMFILE(scandir)`，剩 1 个就够。
    // 这条路触发的条件正是 fd 到顶，所以那一支够得着 —— 真撞上时让人知道半成品留在哪，
    // 比让异常冒上去盖掉上面那句真正的诊断强。（⚠️ 这一支在真入口上还没撞到过。）
    try {
      rmSync(JOBS_DIR, { recursive: true, force: true })
    } catch (e) {
      // **同步写 fd 2，不用 `console.error`。** 下一句就是硬退出，而输出接管道时
      // `console.error` 是异步的 —— 排在队里还没写出去就被掐掉，那正是本文件 `--brief`
      // 那一支早就改成同步写的理由。这一句的**全部用处**就是告诉人半成品留在哪，
      // 被截掉就等于没有（#112 第二轮机器评审指出）
      writeFileSync(2, `\n  ⚠️ 隔离目录没收干净（${e instanceof Error ? e.message : String(e)}）`
                       + ` —— 半成品副本留在 ${JOBS_DIR}，下一跑开头会重建\n`)
    }
    process.exit(1)
  }
  for (const sig of INTERRUPTS) {
    process.on(sig, () => stopJobs([...live].map(s => s.kid), hardStop, GRACE_MS,
                                   (fn, ms) => { setTimeout(fn, ms) }))
  }
  // **建目录那一步抛出来的，也要走收尾。** `cpSync` / `symlinkSync` 在第 i 个上失败时，
  // 前面已经起来的 worker 正拿着任务在跑，而 `Promise.all` 会把异常直接抛上去、
  // 跳过下面那句删目录 —— 活着的子进程和半成品目录都留下了。走跟打断同一条硬来路径
  // （杀干净、收目录、非零退出），不另写一份（#109 第四轮评审指出）
  try {
    await Promise.all(Array.from({ length: jobs }, (_unused, i) => new Promise<void>(done => {
    const dir = join(JOBS_DIR, `w${i}`)
    cpSync('.', dir, { recursive: true, filter: copyIntoWorker })
    symlinkSync(resolve('node_modules'), join(dir, 'node_modules'))
    // 号文件搁在 `w<i>/` 的**兄弟**位置(判定在 `beaconPathOf`),绝对路径交给 worker ——
    // 它的 cwd 是 `dir`,相对路径会落进那棵被复制的树里
    const beacon = resolve(beaconPathOf(JOBS_DIR, process.pid, i))
    const [exe, argv] = tsxCommand([SELF, '--worker', `${BEACON_FLAG}${beacon}`])
    const kid = spawn(exe, argv,
      { cwd: dir, stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, NODE_COMPILE_CACHE } })
    const slot = { kid, beacon }
    live.add(slot)
    // **起不来有三种形状，缺哪一条都是洞**（实测与事件序记在 ADR-72）：有的 errno
    // 同步抛（ENOTDIR），外层 `try/catch` 接得到；有的只发 `error` 事件（ENOENT），
    // 接不到 —— 而 `error` 没人听的话 Node 当未捕获异常退掉，活着的 worker 和隔离目录
    // 全留下；资源不够那一种更早，连 stdio 都没装上，由下面那一问认出来
    kid.on('error', e => {
      console.error(`\n✗ 变异测试：worker 起不来 —— ${e.message}`)
      hardStop()
    })
    // 为什么这一问必须在这里、而且在给 stdin 装监听器之前：判定与理由见 `noStdio`。
    // 实测（node v22.22.2）：`spawn` 那一刻剩 ≤6 个 fd 走这一支，剩 ≥8 个正常。
    // 耗尽位置随环境变化，小语料也可能在前面的 cpSync 先撞 EMFILE（ADR-104）。
    // 自检现在给复制留空间，只在真实 worker spawn 前耗尽描述符，专门验证下面这一支。
    if (noStdio(kid)) {
      console.error('\n✗ 变异测试：worker 起不来 —— 起进程时资源不够，Node 连管道都没装上。'
                    + '最常见是打开的文件数到顶（EMFILE／ENFILE）：调高 `ulimit -n`，'
                    + '或者用 `--jobs=` 少派几个。')
      hardStop()
    }
    // worker 已经没了还往它 stdin 写，常见情形是流已关闭、编号被**静默丢掉**（由核账兜住）；
    // 只有死亡窗口里那一下才真发 EPIPE，而那是异步的，没人听就是未捕获退出
    kid.stdin.on('error', () => {})
    const hand = () => {
      const id = queue.shift()
      if (id === undefined) kid.stdin.end()
      else kid.stdin.write(`${id}\n`)
    }
    createInterface({ input: kid.stdout }).on('line', line => {
      const r = parseReport(line)
      if (r === undefined) {
        // **带着记号却读不出来 = 协议坏了，得让这个 worker 收摊。** 它这会儿正等着下一个
        // 编号，而那一条已经不会有结论了；不收摊的话它永远等下去、`close` 永远不来、
        // 这里的 `Promise.all` 也就永远不返回 —— **整条检查挂住，而不是硬失败**。
        // 模块头上承诺的是后者（「汇报行被截断……少一个就是硬失败」），挂住连核账
        // 那一步都走不到。收摊之后剩下的编号由别的 worker 领，没领到的由核账报出来。
        // 不带记号的那种是验证者漏出来的闲话，照旧跳过（#109 第三轮评审指出）
        if (looksLikeReport(line)) kid.stdin.end()
        return
      }
      reported.add(r.id)
      const m = byId.get(r.id)
      if (m !== undefined) record(m, r)
      hand()
    })
    kid.on('close', () => { live.delete(slot); done() })
    hand()
    })))
  } catch (e) {
    console.error(`\n✗ 变异测试：派工没能起来 —— ${e instanceof Error ? e.message : String(e)}`)
    hardStop()
  }
  rmSync(JOBS_DIR, { recursive: true, force: true })
  // 派出去却没回话的：跑它的那一份崩了、被杀了、或者那一行没写出来。三种在输出上
  // 长得一样 —— **那一条没有结论**，而没有结论不是通过（`process/README.md` 总纲）
  for (const id of missingVerdicts(muts.map(m => m.id), reported)) {
    const m = byId.get(id)
    if (m === undefined) continue
    silent.push(m)
    console.log(`  ✗ ${m.id}  [${m.req}] 没有结论 —— 派出去了，跑它的那一份没回话`)
  }
}

const jobs = jobsWanted(process.argv, process.env.MUTATE_JOBS, availableParallelism(), muts.length)
if (jobs === undefined) {
  console.error('✗ 变异测试：说不清要派几个 —— --jobs= 或 MUTATE_JOBS 要一个 1 以上的整数\n')
  console.error('  按机器核数跑请把它去掉，不要写一个读不出来的值。')
  process.exit(1)
}
// 只有一条路走串行：清单只剩一条、机器只有一个核、或者人明确要求。那条路逐字保持原样，
// 派工那一侧一个进程都不起 —— 自检里那几份最小语料走的正是它
if (jobs === 1) for (const m of muts) record(m, await runOne(m))
else await dispatch(jobs)

console.log()
for (const e of exemptions) {
  console.log(`  ⊘ ${e.req} ${exemptionLead(exemptionCovered(e.req, muts))}：${e.why.split('。')[0]}。`)
}

if (survived.length || elsewhere.length || crashed.length || notApplied.length || silent.length) {
  console.error(`\n✗ 变异测试：${survived.length} 个存活，${elsewhere.length} 个红错了地方，`
                + `${crashed.length} 个跑不起来，${notApplied.length} 个锚点失效，`
                + `${silent.length} 个没有结论`)
  if (silent.length) console.error('  没有结论不是通过：那一条派出去了，而跑它的那一份没回话 —— 重跑，或者用 MUTATE_JOBS=1 串行跑一遍看它到底怎么了。')
  if (survived.length) console.error('  存活意味着对应的测试证明不了任何事 —— 修测试，不要删变异。')
  if (elsewhere.length) console.error('  红错了地方也不算抓到：点名的夹具里有没红的，它对那几条就什么也没证明。'
                                      + '先核对名单里的名字是不是都指对了，再看没红的那条夹具在不在、这个变异该不该弄红它。')
  if (crashed.length) console.error('  跑不起来不算抓到：崩溃不是断言的功劳。让那条测试作为断言失败，或者把变异改成一处语义改动而不是语法错误。')
  process.exit(1)
}
console.log(`✓ 变异测试：${muts.length} 个变异全部被抓到`)
