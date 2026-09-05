#!/usr/bin/env tsx
/**
 * 形式化验证 —— 预算与请求提交协议（P3 · P3.a · P3.b · F7.a · D6.a）。
 *
 * 用法：
 *   npm run formal                穷举抽象模型 + 拿真实实现跑一遍对照（进检查链）
 *   npm run formal -- --tla       再加：TLC 跑同一个模型，并逐字符比两边的可达状态集
 *   npm run formal -- --trace X   把某条不变量的最短反例整条打出来
 *
 * 三件事，**买到的东西不一样**：
 *
 *   1. 穷举    —— 抽象模型的全部可达状态。结论只对模型成立
 *   2. 对照    —— 真实的 Budget 与真实的 TikHub.get()，有界的响应序列上穷举
 *   3. 闸门域  —— 真实的 Budget，上限的全部可能取值上穷举
 *
 * 判定全在 `formal-rule.ts`（`docs/CONVENTIONS.md` 第 10 条）；这里只跑、只打印、
 * 只决定退出码。退出码：0 一致 · 1 与记下来的事实不符 · 2 环境不具备（`--tla`）。
 *
 * ⚠️ **它证不了什么**：模型是有界的，反例的不存在只说明「在这些边界内没有」；
 * 崩溃与落盘那一段是**模型化的**，不是执行的。逐条写在
 * `formal/budget/IMPLEMENTATION-MAP.md`，报告里不许含糊成一句「已形式化验证」。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  INVARIANTS, SCENARIOS, STEP_INVARIANTS, compareStateSets, explore, gateHoles, judgeScenario,
  ledgerHoles, parseTlcDump, renderTlcConfig, runConformance, tlcVerdict,
} from './formal-rule.js'

const argv = process.argv
const wantTla = argv.includes('--tla')
const traceOf = (() => {
  const i = argv.indexOf('--trace')
  return i >= 0 ? argv[i + 1] : undefined
})()

let failed = 0
const fail = (msg: string) => { failed++; console.error(`  ✗ ${msg}`) }

// ═══════════ 1. 穷举抽象模型 ═══════════

console.log('形式化验证 · 预算与请求提交协议\n')
console.log('一、穷举抽象模型（结论只对模型成立）')

for (const sc of SCENARIOS) {
  const v = judgeScenario(sc)
  const shape = v.violations.length
    ? v.violations.map(x => `${x.invariant}(${x.trace.length} 步)`).join('、')
    : '全部成立'
  if (v.surprises.length) {
    fail(`${sc.name}：${v.states} 个可达状态 —— ${shape}`)
    for (const s of v.surprises) console.error(`      ${s}`)
  } else {
    console.log(`  ✓ ${sc.name.padEnd(14)} ${String(v.states).padStart(5)} 个可达状态 —— ${shape}`)
  }
}

if (traceOf) {
  // 反例要能读。默认只报长度，要看整条轨迹得自己点名 —— 五个场景全打出来没人会读
  for (const sc of SCENARIOS) {
    const v = judgeScenario(sc)
    for (const x of v.violations.filter(x => x.invariant === traceOf)) {
      console.log(`\n【${sc.name}】${x.invariant}（${x.req.join(' · ')}）`)
      console.log(`  ${x.says}`)
      for (const [i, t] of x.trace.entries()) {
        const s = t.state
        console.log(`  ${String(i + 1).padStart(2)}. ${String(t.action).padEnd(8)}`
          + ` local=${s.local} disk=${s.disk} billed=${s.billed} sent=${s.sent}`
          + ` phase=${s.phase} alive=${s.alive} warnTotal=${s.warnTotal}`)
      }
    }
  }
}

// ═══════════ 2. 拿真实实现跑一遍 ═══════════

console.log('\n二、与真实实现对照（真的 Budget、真的 TikHub.get()）')
const conf = await runConformance()
if (conf.failures.length) {
  fail(`${conf.cases} 个用例里 ${conf.failures.length} 个与模型不符`)
  for (const f of conf.failures.slice(0, 5)) {
    console.error(`      上限=${f.where.limit} 起始=${f.where.start}`
      + ` 响应=[${f.where.outcomes}] → `
      + f.mismatches.map(m => `${m.field} 期待 ${m.want}、实际 ${m.got}`).join('；'))
  }
  if (conf.failures.length > 5) console.error(`      （还有 ${conf.failures.length - 5} 个）`)
} else {
  console.log(`  ✓ ${conf.cases} 个响应序列、${conf.sends} 次真实提交，逐步与模型一致`)
}

// ═══════════ 3. 闸门域 ═══════════

console.log('\n三、两个钱字段的取值全域（真的 Budget）')
const holes = await gateHoles()
if (holes.length) {
  fail(`${holes.length} 个上限取值让闸门失效`)
  for (const h of holes) console.error(`      ${h.shows}：${h.why}`)
} else {
  console.log('  ✓ 上限：每个取值要么在花钱之前被挡下，要么真的拦得住')
}
const ledger = await ledgerHoles()
if (ledger.length) {
  fail(`${ledger.length} 个「已花次数」取值让续跑接不上账`)
  for (const h of ledger) console.error(`      ${h.shows}：${h.why}`)
} else {
  console.log('  ✓ 已花次数：每个取值要么在花钱之前被挡下，要么续跑真的从它接着加')
}

// ═══════════ 4. TLC（可选，要 Java 与 tla2tools.jar） ═══════════

if (wantTla) {
  console.log('\n四、TLC 跑同一个模型')
  const jar = process.env.TLA_TOOLS_JAR
  if (!jar || !existsSync(jar)) {
    // 拿不到工具就说拿不到 —— **不是跳过，也不是通过**。一条会自己消失的检查
    // 比没有检查更糟（process/4-VERIFY.md）
    console.error('  ✗ 无从判断：TLA_TOOLS_JAR 没指向一个存在的文件')
    console.error('    取法见 formal/README.md（版本与 sha256 都钉在那儿）')
    process.exit(2)
  }
  const dir = mkdtempSync(join(tmpdir(), 'kol-formal-'))
  writeFileSync(join(dir, 'BudgetProtocol.tla'),
                readFileSync('formal/budget/BudgetProtocol.tla', 'utf8'))

  const tlc = (cfg: string, extra: string[] = []): string => {
    const name = `${cfg}.cfg`
    try {
      return execFileSync('java', [
        '-XX:+UseParallelGC', '-cp', jar, 'tlc2.TLC', '-nowarning', '-workers', '1',
        '-deadlock', '-config', name, ...extra, 'BudgetProtocol.tla',
      ], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      // TLC 发现违反时以非零退出 —— 那不是「跑不起来」，输出照样要读
      const out = e as { stdout?: string; stderr?: string; message?: string }
      return `${out.stdout ?? ''}${out.stderr ?? ''}${out.stdout ? '' : out.message ?? ''}`
    }
  }

  for (const sc of SCENARIOS) {
    const expectHold = INVARIANTS.filter(i => sc.expect[i.name] === true).map(i => i.name)
    const expectBad = INVARIANTS.filter(i => sc.expect[i.name] !== true).map(i => i.name)
    const put = (tag: string, names: string[]) => {
      writeFileSync(join(dir, `${sc.name}-${tag}.cfg`), renderTlcConfig(sc, {
        invariants: names.filter(n => !STEP_INVARIANTS.has(n)),
        properties: names.filter(n => STEP_INVARIANTS.has(n)),
      }))
      return `${sc.name}-${tag}`
    }

    // 一次跑「预期成立的那些」：TLC 必须说 No error has been found
    if (expectHold.length) {
      const v = tlcVerdict(tlc(put('hold', expectHold)))
      if (v.kind === 'ok') console.log(`  ✓ ${sc.name}：${expectHold.length} 条预期成立的，TLC 也说成立`)
      else if (v.kind === 'violated') fail(`${sc.name}：TLC 说 ${v.invariant} 被违反，而这里记着它成立`)
      else fail(`${sc.name}：TLC 跑不出结论 —— ${v.why}`)
    }
    // 预期被违反的逐条单跑 —— 合在一起 TLC 只会报第一条
    for (const name of expectBad) {
      const v = tlcVerdict(tlc(put(`bad-${name}`, [name])))
      if (v.kind === 'violated' && v.invariant === name) {
        console.log(`  ✓ ${sc.name}：TLC 也抓到 ${name}`)
      } else if (v.kind === 'ok') {
        fail(`${sc.name}：这里记着 ${name} 会被违反，TLC 说没有`)
      } else if (v.kind === 'violated') {
        fail(`${sc.name}：查的是 ${name}，TLC 报的是 ${v.invariant}`)
      } else {
        fail(`${sc.name}：TLC 跑不出结论 —— ${v.why}`)
      }
    }

    // 两份模型是不是同一个转移系统 —— 比可达状态集，不比状态**个数**：
    // 个数一样而集合不同的两个模型是存在的，那正是漂移最难看出来的形状
    writeFileSync(join(dir, `${sc.name}-dump.cfg`), renderTlcConfig(sc))
    const out = tlc(`${sc.name}-dump`, ['-dump', 'states.dump'])
    const v = tlcVerdict(out)
    if (v.kind !== 'ok') { fail(`${sc.name}：导出可达状态集时 TLC 没跑通 —— ${JSON.stringify(v)}`); continue }
    const dumpFile = join(dir, 'states.dump')
    if (!existsSync(dumpFile)) { fail(`${sc.name}：TLC 没有留下可达状态集`); continue }
    const diff = compareStateSets(explore(sc.bounds).canonicalStates,
                                  parseTlcDump(readFileSync(dumpFile, 'utf8')))
    if (diff.onlyModel.length || diff.onlyTlc.length) {
      fail(`${sc.name}：两份模型的可达状态集不一样 ——`
        + ` 只有 TypeScript 那份有 ${diff.onlyModel.length} 个，只有 TLA+ 那份有 ${diff.onlyTlc.length} 个`)
      for (const s of [...diff.onlyModel.slice(0, 1), ...diff.onlyTlc.slice(0, 1)]) {
        console.error(`      ${s.split('\n').join(' ')}`)
      }
    } else {
      console.log(`  ✓ ${sc.name}：两份模型的可达状态集逐字符一致`)
    }
  }
} else {
  console.log('\n四、TLC 这一步没跑 —— 加 `-- --tla` 且 TLA_TOOLS_JAR 指向 jar 才跑')
}

if (failed) {
  console.error(`\n✗ 形式化验证：${failed} 项与记下来的事实不符`)
  console.error('  要么实现变了、要么模型变了。别改预期让它变绿 —— 先弄清是哪一种。')
  process.exit(1)
}
console.log('\n✓ 形式化验证：模型、真实实现与记下来的事实三者一致')
console.log('  保证到哪为止、哪些只是模型：formal/budget/IMPLEMENTATION-MAP.md')
