/**
 * 自检夹具的分组与选跑 —— 从 `selfcheck.ts` 里抽出来的那一半判定。
 *
 * `selfcheck.ts` 是入口（起进程、打印、退出码）；**「这一跑该跑哪几组」是判定**
 * —— 它决定这次自检看得见多少东西，而「扫描范围被悄悄缩小和判定写错一样致命」
 * （`docs/CONVENTIONS.md` 第十节，那句话原本是写给体量闸门的，这里同理）。
 * 抽出来的理由和那边一样：判定有语义就该能被测。
 */

import { jobsWanted } from './jobs-rule.js'

/** 一组夹具：`id` 是点名用的，`needs` 是它**真跑起来才成立**的前置组 */
export interface Group { id: string; needs: readonly string[] }

/**
 * 这一跑要跑哪几组。
 *
 * **不点名就是全跑**（交回 `undefined`）—— 缺省行为逐字如旧，这是这条改动
 * 敢动这个文件的前提。点了名就跑**点名的那些 ＋ `needs` 的传递闭包**。
 *
 * ⚠️ **闭包不是调度提示，是正确性。** 一组没跑，用它产出的那几组读到的是初始值
 * （实测：`记忆读不出来` 那一整节被 `if (dir && rendered !== undefined)` 守着，
 * 缺了前置组就**整节静默跳过** —— 不报错、不打任何东西，而指着它的负片会
 * 「跑完、没红」，仿佛被验过了）。
 *
 * ⚠️ **点了不存在的组要当场抛，不能静默跑成空集。** 一个名字写错的 `--only`
 * 会让这一跑什么也不验、还以退出码 0 结束 —— 那正是本仓库反复栽的那种假绿。
 */
export function wanted(groups: readonly Group[], only?: readonly string[]): Set<string> | undefined {
  if (only === undefined) return undefined
  const byId = new Map(groups.map(g => [g.id, g]))
  if (byId.size !== groups.length) {
    throw new Error('夹具组 id 重复')
  }
  for (const g of groups) for (const need of g.needs) {
    if (!byId.has(need)) throw new Error(`组 ${g.id} 缺少依赖组 ${need}`)
  }
  const unknown = only.filter(id => !byId.has(id))
  if (unknown.length) {
    throw new Error(`--only 点了不存在的组：${unknown.join('、')}`
      + `\n  有的是：${groups.map(g => g.id).join('、')}`)
  }
  const out = new Set<string>()
  const walk = (id: string): void => {
    if (out.has(id)) return
    out.add(id)
    for (const n of byId.get(id)!.needs) walk(n)
  }
  for (const id of only) walk(id)
  return out
}

/** `--only=a,b` 里那几个名字；没写这个参数交回 `undefined`（＝全跑） */
export function parseOnly(argv: readonly string[]): string[] | undefined {
  const hit = argv.find(a => a.startsWith('--only='))
  if (hit === undefined) return undefined
  // 空的 `--only=` 交回空数组而不是 `undefined` —— 两者都是错，但错法不一样：
  // 空数组是「一组都不跑」；这个旧解析契约仍由测试与原有负片保留，
  // `undefined` 是「全跑」，静默变成另一件事。**这里不抛**，判定只管把两者分开，
  // 由入口去定性 —— 抛在这儿的话 `wanted` 就得替调用方决定空集算不算错。
  return hit.slice('--only='.length).split(',').filter(s => s !== '')
}

/**
 * 自检与需求测试入口共用的严格参数解析。`parseOnly` 保留旧解析契约；这里拒绝
 * 会把「我没选对」解释成「少跑了一些也通过」的拼写错误。
 */
export function parseOnlyStrict(argv: readonly string[], allowed: readonly string[] = []): string[] | undefined {
  const named = argv.filter(a => a.startsWith('--only='))
  const invalid = argv.filter(a => !a.startsWith('--only=') && !allowed.includes(a))
  if (invalid.length) throw new Error(`需求测试不认识参数：${invalid.join('、')}`)
  if (named.length > 1) throw new Error('需求测试只能写一次 --only=')
  if (!named.length) return undefined
  const ids = named[0].slice('--only='.length).split(',')
  if (ids.some(id => id === '' || id.trim() !== id)) {
    throw new Error('--only= 必须写非空、无首尾空格的组 id，逗号两侧不能留空')
  }
  if (new Set(ids).size !== ids.length) throw new Error('--only= 不能重复点同一组')
  return ids
}


/**
 * 完整自检拆成多个进程时的派工单位：按 `needs` 连通（不分方向）的**族**。
 *
 * 族内的组共享运行态（模块级变量、上一组落在 `tmp` 里的产出），必须在同一个进程里、
 * 按登记顺序跑 —— 那正是今天单进程整跑时它们的处境。共用同一个前置组的两组也在同一族：
 * 拆开的话前置组要在两个进程里各跑一遍，两份运行态互不相通（ADR-132 第二节）。
 * 族内按登记顺序，族按首个成员的登记位置排，于是派工与输出顺序都是确定的。
 *
 * 校验与 `wanted` 同一套：重复 id、缺失依赖当场抛 —— 一组落不进任何族，就是一组没人跑。
 */
export function families(groups: readonly Group[]): string[][] {
  const index = new Map(groups.map((g, i) => [g.id, i]))
  if (index.size !== groups.length) throw new Error('夹具组 id 重复')
  const root = groups.map((_g, i) => i)
  const find = (i: number): number => root[i] === i ? i : (root[i] = find(root[i]))
  groups.forEach((g, i) => {
    for (const need of g.needs) {
      const j = index.get(need)
      if (j === undefined) throw new Error(`组 ${g.id} 缺少依赖组 ${need}`)
      root[find(i)] = find(j)
    }
  })
  const byRoot = new Map<number, string[]>()
  groups.forEach((g, i) => {
    const r = find(i)
    byRoot.set(r, [...byRoot.get(r) ?? [], g.id])
  })
  return [...byRoot.values()]
}

/**
 * 这一跑拆几个进程。**1 就是照旧单进程**，说不清要几个交回 `undefined`，由入口当场拒绝。
 *
 * 只有完整、非变异的那一跑才拆。子集跑（变异那一步的验证者、人手 `--only`）照旧单进程：
 * 变异的「见齐就停」读的是验证者自己的输出流，拆开就换成了另一种输出；变异跑整跑时
 * 也不拆，四个 worker 底下再各起几个进程只会互相抢核。个数的读法与 `MUTATE_JOBS`
 * 同一份（`jobsWanted`）：环境变量写错不当成没写，族比核少就按族数收口。
 */
export function shardJobs(o: {
  subset: boolean; mutating: boolean; env: string | undefined; cpus: number; families: number
}): number | undefined {
  if (o.subset || o.mutating) return 1
  return jobsWanted([], o.env, o.cpus, o.families)
}

/** 子进程跑完交回给父进程的那一份：它跑了哪几组、红了几处、认领了什么、执行过哪些脚本 */
export interface ShardReport { groups: string[]; failed: number; claimed: string[]; covered: string[] }
/**
 * 父进程手上的一条派工记录。`report` 缺席 = 子进程没交回结果（崩了、被杀、写不出来）；
 * `error` = 子进程**根本没起来**，带的是 Node 交回的原因（命令不在、资源不够）
 */
export interface ShardRun {
  family: readonly string[]; status: number | null; signal: string | null; error?: string; report?: ShardReport
}
export interface ShardMerge { failed: number; claimed: string[]; covered: string[]; problems: string[] }

/**
 * 把各子进程交回的结果合成一次完整跑的结论。**合并之后才算数** —— 父进程据此打汇总、
 * 判孤儿、决定写不写入口认领，与单进程整跑走同一段收尾。
 *
 * 失败数 = 各子进程报告的断言失败数之和 ＋ 每一处进程级问题各算一处。进程级问题有五种，
 * 每一种都会让「全绿」这句话失去根据：子进程没起来；子进程没交回结果；退出码与它自己报的
 * 失败数对不上；它跑的组与派给它的那族对不上；某一组没派给任何子进程、或派给了不止一个。
 * 没起来、没交回结果的那一族只记一处，不再因为它那几组没报回来重复计。没起来要单说、带上
 * 原因：说成「没交回结果（退出码 null）」，人会去翻子进程的输出，而那里什么都没有。
 */
export function mergeShards(runs: readonly ShardRun[], all: readonly string[]): ShardMerge {
  const problems: string[] = []
  let failed = 0
  const claimed = new Set<string>(), covered = new Set<string>()
  const planned = new Map<string, number>()
  for (const run of runs) for (const id of run.family) planned.set(id, (planned.get(id) ?? 0) + 1)
  for (const id of all) {
    const n = planned.get(id) ?? 0
    if (n === 0) problems.push(`组 ${id} 没派给任何子进程`)
    else if (n > 1) problems.push(`组 ${id} 派给了 ${n} 个子进程`)
  }
  for (const run of runs) {
    const name = `${run.family[0]} 那一族（${run.family.length} 组）`
    const ended = run.signal !== null ? `信号 ${run.signal}` : `退出码 ${run.status}`
    if (run.error !== undefined) { problems.push(`${name}的子进程没起来（${run.error}）`); continue }
    if (run.report === undefined) { problems.push(`${name}的子进程没交回结果（${ended}）`); continue }
    const r = run.report
    failed += r.failed
    if ((r.failed === 0) !== (run.status === 0)) {
      problems.push(`${name}的子进程报告 ${r.failed} 处失败，却以${ended} 结束`)
    }
    const ran = new Set(r.groups)
    const missing = run.family.filter(id => !ran.has(id))
    const extra = r.groups.filter(id => !run.family.includes(id))
    if (missing.length || extra.length) {
      problems.push(`${name}的子进程跑的组对不上：`
        + `${missing.length ? `没跑 ${missing.join('、')}` : ''}${missing.length && extra.length ? '；' : ''}`
        + `${extra.length ? `多跑 ${extra.join('、')}` : ''}`)
    }
    for (const c of r.claimed) claimed.add(c)
    for (const c of r.covered) covered.add(c)
  }
  return { failed: failed + problems.length, claimed: [...claimed].sort(), covered: [...covered].sort(), problems }
}

/**
 * 子进程写回的那一份。**读不出来就是没交回结果**（交回 `undefined`）：写了一半、缺一栏、
 * 失败数不是非负整数，都不能半截读进去 —— 半截读进去的那一种会把「崩在半路」读成「零失败」。
 */
export function readShardReport(text: string): ShardReport | undefined {
  let v: unknown
  try { v = JSON.parse(text) } catch { return undefined }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const r = v as Record<string, unknown>
  const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(s => typeof s === 'string')
  if (!strings(r.groups) || !strings(r.claimed) || !strings(r.covered)) return undefined
  if (typeof r.failed !== 'number' || !Number.isInteger(r.failed) || r.failed < 0) return undefined
  return { groups: r.groups, failed: r.failed, claimed: r.claimed, covered: r.covered }
}
