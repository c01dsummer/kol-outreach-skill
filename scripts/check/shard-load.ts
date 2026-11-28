#!/usr/bin/env tsx
/**
 * 变异负载闸门（ADR-203）—— 检查链第三步，紧跟体量闸门：两道都只看这次改了什么，不跑任何东西。
 *
 * 读当前树的变异清单，照变异一步的分法（`jobs-rule.ts` 的 `shardPlan`，同一个键、同一份秒数）算出每一份的验证者秒数；
 * 秒数取自 `MAIN_COSTS_ENV` 指着的那份文件（CI 上 `scripts/check/main-costs.sh` 写的主干上一跑的成本报告，`mainCostWeights` 认，ADR-254）。
 * 读 PR 基线（主干上是上一版）那份清单，按同一份秒数算出总秒数；从这条分支自己的提交信息末段读豁免；
 * 读 `.github/workflows/check.yml` 与 `package.json` 的 `check`，交 `workflowWiringFaults` 核接线（ADR-203 第八节）。
 * 交给 `shard-load-rule.ts` 的 `shardLoadGate`，照它交回的打、退出。判法全在那里，这里没有一条路把「读不到」变成「没超」。
 *
 * 「哪些提交算这条分支自己的、基线是哪一个」与体量闸门同一个判法（`size-rule.ts` 的 `resolveBaseline`，同样钉死 `GIT_CONFIG`）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { shardKey, shardPlan } from './jobs-rule.js'
import { executionRoutes } from './mutate-rule.js'
import { MUTATION_CATALOG, catalogFaultText, readCatalog } from './catalog-rule.js'
import { MAIN_COSTS_ENV, SHARD_COUNT, growthWaivers, mainCostWeights, pileWeigher, shardLoadGate, workflowWiringFaults, type ShardLoadInput, type ShardWeights } from './shard-load-rule.js'
import { askGit } from './git-entry.js'
import { resolveBaseline } from './size-rule.js'
import { trailerLines } from './trailer.js'

const MUTATIONS = MUTATION_CATALOG
const WORKFLOW = '.github/workflows/check.yml'

const tryGit = askGit
type Mut = { id: string; by?: string }
/** 读变异目录只经读取函数（ADR-242）：读不出、形状不对、编号重复都抛，由调用处打成红或记成算不出 */
const listOf = (text: string | undefined): Mut[] => {
  const read = readCatalog(text)
  if (!read.ok) throw new Error(catalogFaultText(read.fault))
  return read.mutations as Mut[]
}

/** 一份清单每一份的秒数：与变异一步同一个路由、同一个键、同一份秒数。算不出来就抛 —— 由调用处打成红 */
const loadsOf = (muts: Mut[], readSource: (file: string) => string | undefined, w: ShardWeights): { loads: number[]; defaulted: Mut[] } => {
  const routes = new Map(executionRoutes(muts as unknown as Parameters<typeof executionRoutes>[0], readSource).routes.map(r => [r.id, r]))
  const keyOf = (m: Mut) => shardKey(m.by, routes.get(m.id)!.only)
  // 主干上一跑里没有的配置（新加或改了名的组、整跑的）按默认值或整跑的算法估：报出来有多少条，量丢了看得见
  const defaulted = muts.filter(m => { const k = keyOf(m); return k === undefined || !Object.hasOwn(w.configs, k) })
  return { loads: shardPlan(muts, keyOf, pileWeigher(w), SHARD_COUNT).loads, defaulted }
}

const main = (): number => {
  // 秒数取自哪里：CI 上是主干上一跑的实测；本地没设那个变量就是没有（三道线只在 CI 上判）。读不到、认不得都交给闸门判，不在这里放行
  const costsPath = process.env[MAIN_COSTS_ENV]
  let measured: ShardLoadInput['measured'] = { local: true }
  let weights: ShardWeights | undefined
  if (costsPath !== undefined) {
    let got: ReturnType<typeof mainCostWeights>
    try { got = mainCostWeights(readFileSync(costsPath, 'utf8')) } catch (e) {
      got = { unavailable: `读不到 ${MAIN_COSTS_ENV} 指着的 ${JSON.stringify(costsPath)}（${e instanceof Error ? e.message : String(e)}）` }
    }
    if ('unavailable' in got) measured = got
    else { measured = { run: got.run, headSha: got.headSha }; weights = got.weights }
  }
  let loads: number[] = []
  let defaulted = 0
  try {
    // 当前树的清单读不出来，有没有秒数都红
    const muts = listOf(existsSync(MUTATIONS) ? readFileSync(MUTATIONS, 'utf8') : undefined)
    if (weights !== undefined) {
      const now = loadsOf(muts, file => existsSync(file) ? readFileSync(file, 'utf8') : undefined, weights)
      loads = now.loads
      defaulted = now.defaulted.length
    }
  } catch (e) {
    console.log(`✗ 变异负载：当前树算不出每一份的秒数（${e instanceof Error ? e.message : String(e)}）`)
    return 1
  }

  const baseline = resolveBaseline(tryGit)
  let trunk: ShardLoadInput['trunk']
  let base: ShardLoadInput['base']
  let messages: string[] = []
  if (baseline.kind === 'cannot-answer') {
    trunk = { unknown: baseline.why }
    base = { unknown: baseline.why }
  } else if (baseline.kind === 'not-applicable') {
    trunk = { onTrunk: true }
    base = { unknown: '主干上的第一个提交，没有上一版' }
  } else {
    trunk = { onTrunk: baseline.onTrunk }
    // 基线那份清单与它那时的源码，按同一份秒数算 —— 量的是变异变了多少，不是秒数换了多少
    const at = baseline.base
    if (weights === undefined) base = { unknown: '没有秒数' }
    else try {
      const text = tryGit('show', `${at}:${MUTATIONS}`)
      if (text === null) throw new Error(`${at.slice(0, 7)} 上没有 ${MUTATIONS}`)
      base = { total: loadsOf(listOf(text), file => tryGit('show', `${at}:${file}`) ?? undefined, weights).loads.reduce((a, b) => a + b, 0) }
    } catch (e) { base = { unknown: e instanceof Error ? e.message : String(e) } }
    if (!baseline.onTrunk) messages = baseline.commits.map(c => tryGit('log', '-1', '--format=%B', c) ?? '')
  }

  // 接线：工作流或 package.json 读不到也算对不上，不当成没写错
  let workflow: string | undefined
  try { workflow = readFileSync(WORKFLOW, 'utf8') } catch { workflow = undefined }
  const checkScript = ((): string | undefined => {
    try { const s = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, unknown> }).scripts?.check; return typeof s === 'string' ? s : undefined } catch { return undefined }
  })()
  const wiring = workflow === undefined ? [`读不到 ${WORKFLOW}`] : workflowWiringFaults(workflow, checkScript)

  const gate = shardLoadGate({ measured, loads, base, trunk, waivers: growthWaivers(messages.flatMap(trailerLines)), wiring })
  for (const line of gate.lines) console.log(line)
  if (defaulted > 0) console.log(`  其中 ${defaulted} 条变异的配置不在主干上一跑的实测里（新加或改了名的组、整跑的），按验证者的默认值估；主干跑过一次就有了`)
  return gate.red ? 1 : 0
}
process.exitCode = main()
