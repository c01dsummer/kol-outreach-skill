#!/usr/bin/env tsx
/**
 * 变异测试 —— 给测试做的测试。
 *
 * 逐个应用「故意违反需求」的改动，跑测试，**期望测试失败**。
 * 变异被抓到 = 那条测试有效；**变异存活 = 那条测试是假的**，要修测试不是删变异。
 * **测试进程崩了不算抓到**（`mutate-rule.ts`）：崩溃不是任何一条断言的功劳。
 *
 * 用法：
 *   tsx scripts/check/mutate.ts            逐个应用变异并跑测试
 *   tsx scripts/check/mutate.ts --brief    只列出每条「违反了什么」，不跑任何东西
 *
 * `--brief` 是给**写测试的那个上下文**用的：`why` 是需求语言，可以给；
 * `find`/`replace` 是实现原文，给了就等于让它读实现。
 * 见 process/4-VERIFY.md 的「给测试上下文一张准入读物清单」。
 *
 * 这条防线的强度取决于 `why` 怎么写 —— 引了实现原文的 why，`--brief` 照样把它漏出去。
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { orphanAttributions } from './attribution-rule.js'
import { implementationLeak } from './why-rule.js'
import { type RunVerdict, judgeRun } from './mutate-rule.js'
import { CLAIMS_PATH } from './claims.js'
import { beginMutation, restoreMutation, trackTest } from './mutate-restore.js'

interface Mut { id: string; req: string; why: string; file: string; find: string; replace: string }
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
const orphans = [
  ...orphanAttributions(muts, known),
  ...orphanAttributions(exemptions.map(e => ({ id: `豁免 ${e.req}`, req: e.req })), known),
]
if (orphans.length) {
  console.error(`✗ 变异集：${orphans.length} 条记在不存在的需求名下 —— 它们对任何一条需求都不算数\n`)
  for (const o of orphans) console.error(`  ${o.id}  记在 ${o.req} 名下，而登记表里没有这条`)
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

if (process.argv.includes('--brief')) {
  console.log('\n变异集 —— 每条变异「违反了什么」。不含实现原文，可以交给写测试的上下文。\n')
  for (const m of muts) console.log(`  ${m.id}  [${m.req}]  ${m.why}`)
  for (const e of exemptions) {
    console.log(`  ⊘     [${e.req}]  无变异（显式缺口${e.scope === undefined ? '' : `，${e.scope}`}）：${e.why}`)
  }
  console.log(`\n共 ${muts.length} 个变异、${exemptions.length} 处显式豁免。`)
  process.exit(0)
}

const survived: Mut[] = []
const crashed: Mut[] = []
const notApplied: Mut[] = []

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
 * 跑一次测试。**异步等，不能同步等。**
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
 */
const runTest = (): Promise<{ status: number | null; output: string }> =>
  new Promise(resolve => {
    // 带标记跑：变异跑的是被改过的源码，那一次执行留下的覆盖记录不作数，
    // 记录只能由一次干净的测试运行写（test.ts 据此跳过写盘）。
    // 自成一组：被打断时要连它一起结束，而只杀手上这一个是杀不掉的 ——
    // `npx` 是一层壳，`tsx` 自己还要再分出一个真正跑脚本的进程来
    const kid = spawn('npx', ['tsx', 'scripts/test.ts'],
      { stdio: 'pipe', detached: true, env: { ...process.env, MUTATING: '1' } })
    trackTest(kid)
    let out = ''
    let err = ''
    kid.stdout.on('data', d => { out += d })
    kid.stderr.on('data', d => { err += d })
    // 压根没起来（命令不在、权限不足）也要留下话：那时两股都是空的，
    // 判定只会说「跑不起来」，而人得知道是没起来还是跑崩了
    kid.on('error', e => { err += `\n${e}` })
    kid.on('close', status => resolve({ status, output: `${out}\n${err}` }))
  })

for (const m of muts) {
  const orig = readFileSync(m.file, 'utf8')
  if (!orig.includes(m.find)) {
    notApplied.push(m)
    console.log(`  ⚠ ${m.id}  锚点失效，未能应用`)
    continue
  }
  beginMutation(m.file, orig)
  let verdict: RunVerdict
  try {
    // 写盘也在这一段里面：写盘是先截断再写的，写到一半抛出去（盘满、IO 错）留下的是
    // 半份源文件，而那时 `finally` 要是够不着，被截断的那份就留在工作区里，
    // 记着的现场谁也不去取（评审指出）
    writeFileSync(m.file, orig.replace(m.find, m.replace), 'utf8')
    // 非零退出是期望的结果 —— 但要看是断言红的,还是进程死在半路(被信号杀掉时 status 为 null)
    const r = await runTest()
    verdict = judgeRun(r.status, r.output)
  } finally {
    restoreMutation()
  }
  if (verdict === 'caught') console.log(`  ✓ ${m.id}  [${m.req}] 被抓到`)
  else if (verdict === 'crashed') {
    crashed.push(m)
    console.log(`  ✗ ${m.id}  [${m.req}] 跑不起来 —— 测试进程死在半路,没有任何一条断言抓到它`)
  } else { survived.push(m); console.log(`  ✗ ${m.id}  [${m.req}] 存活 —— ${m.why}`) }
}

console.log()
for (const e of exemptions) {
  console.log(`  ⊘ ${e.req} 无变异（显式缺口）：${e.why.split('。')[0]}。`)
}

if (survived.length || crashed.length || notApplied.length) {
  console.error(`\n✗ 变异测试：${survived.length} 个存活，${crashed.length} 个跑不起来，${notApplied.length} 个锚点失效`)
  if (survived.length) console.error('  存活意味着对应的测试证明不了任何事 —— 修测试，不要删变异。')
  if (crashed.length) console.error('  跑不起来不算抓到：崩溃不是断言的功劳。让那条测试作为断言失败，或者把变异改成一处语义改动而不是语法错误。')
  process.exit(1)
}
console.log(`✓ 变异测试：${muts.length} 个变异全部被抓到`)
