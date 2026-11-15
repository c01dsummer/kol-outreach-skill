#!/usr/bin/env tsx
/**
 * 变异负载闸门（ADR-203）—— 只看这次改了什么，不跑任何东西。还没接进检查链：入口与 `check.yml` 的接线核对另一条 PR 一起接（ADR-203 第四节）。
 *
 * 读当前树的变异清单，照变异一步的分法（`jobs-rule.ts` 的 `shardPlan`，同一个键、同一份 `shard-weights.json`）算出每一份的验证者秒数；
 * 读 PR 基线（主干上是上一版）那份清单，按同一份秒数文件算出总秒数；从这条分支自己的提交信息末段读豁免。
 * 交给 `shard-load-rule.ts` 的 `shardLoadGate`，照它交回的打、退出。判法全在那里，这里没有一条路把「读不到」变成「没超」。
 *
 * 「哪些提交算这条分支自己的、基线是哪一个」与体量闸门同一个判法（`size-rule.ts` 的 `resolveBaseline`，同样钉死 `GIT_CONFIG`）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { shardKey, shardPlan } from './jobs-rule.js'
import { executionRoutes } from './mutate-rule.js'
import { SHARD_COUNT, SHARD_WEIGHTS_FILE, growthWaivers, pileWeigher, readWeights, shardLoadGate, type ShardLoadInput, type ShardWeights } from './shard-load-rule.js'
import { GIT_CONFIG, resolveBaseline } from './size-rule.js'
import { trailerLines } from './trailer.js'

const MUTATIONS = 'scripts/check/mutations.json'

const tryGit = (...args: string[]): string | null => {
  try { return execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim() } catch { return null }
}
type Mut = { id: string; by?: string }
const listOf = (text: string): Mut[] => (JSON.parse(text) as { mutations: Mut[] }).mutations

/** 一份清单每一份的秒数：与变异一步同一个路由、同一个键、同一份秒数文件。算不出来就抛 —— 由调用处打成红 */
const loadsOf = (muts: Mut[], readSource: (file: string) => string | undefined, w: ShardWeights): { loads: number[]; defaulted: Mut[] } => {
  const routes = new Map(executionRoutes(muts as unknown as Parameters<typeof executionRoutes>[0], readSource).routes.map(r => [r.id, r]))
  const keyOf = (m: Mut) => shardKey(m.by, routes.get(m.id)!.only)
  // 不在秒数文件里的（新加或改了名的组、整跑的）按默认值或整跑的算法估：报出来有多少条，量丢了看得见
  const defaulted = muts.filter(m => { const k = keyOf(m); return k === undefined || !Object.hasOwn(w.configs, k) })
  return { loads: shardPlan(muts, keyOf, pileWeigher(w), SHARD_COUNT).loads, defaulted }
}

const main = (): number => {
  let weights: ShardWeights
  let loads: number[]
  let defaulted: number
  try {
    const read = readWeights(JSON.parse(readFileSync(SHARD_WEIGHTS_FILE, 'utf8')))
    if ('fault' in read) throw new Error(`${SHARD_WEIGHTS_FILE}：${read.fault}`)
    weights = read.weights
    const now = loadsOf(listOf(readFileSync(MUTATIONS, 'utf8')), file => existsSync(file) ? readFileSync(file, 'utf8') : undefined, weights)
    loads = now.loads
    defaulted = now.defaulted.length
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
    // 基线那份清单与它那时的源码，按这棵树的秒数文件算 —— 量的是变异变了多少，不是秒数文件换了多少
    const at = baseline.base
    try {
      const text = tryGit('show', `${at}:${MUTATIONS}`)
      if (text === null) throw new Error(`${at.slice(0, 7)} 上没有 ${MUTATIONS}`)
      base = { total: loadsOf(listOf(text), file => tryGit('show', `${at}:${file}`) ?? undefined, weights).loads.reduce((a, b) => a + b, 0) }
    } catch (e) { base = { unknown: e instanceof Error ? e.message : String(e) } }
    if (!baseline.onTrunk) messages = baseline.commits.map(c => tryGit('log', '-1', '--format=%B', c) ?? '')
  }

  const gate = shardLoadGate({ loads, base, trunk, waivers: growthWaivers(messages.flatMap(trailerLines)), wiring: [] })
  for (const line of gate.lines) console.log(line)
  if (defaulted > 0) console.log(`  其中 ${defaulted} 条变异的配置不在 ${SHARD_WEIGHTS_FILE} 里（新加或改了名的组、整跑的），按验证者的默认值估；多了就该重写秒数文件（ADR-203 第五节）`)
  return gate.red ? 1 : 0
}
process.exitCode = main()
