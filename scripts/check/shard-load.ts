#!/usr/bin/env tsx
/**
 * 变异负载闸门（ADR-203）—— 检查链第三步，紧跟体量闸门：两道都只看这次改了什么，不跑任何东西。
 *
 * 读当前树的变异清单，照变异一步的分法（`jobs-rule.ts` 的 `shardPlan`，同一个键、同一个估重）算出每一份的估重；
 * 读 PR 基线（主干上是上一版）那份清单，算出估重总量；从这条分支自己的提交信息末段读豁免；读 `check.yml` 与 `package.json` 核份数、worker 数与 chain 那一串的接线。
 * 交给 `shard-load-rule.ts` 的 `shardLoadGate`，照它交回的打、退出。判法全在那里，这里没有一条路把「读不到」变成「没超」。
 *
 * 「哪些提交算这条分支自己的、基线是哪一个」与体量闸门同一个判法（`size-rule.ts` 的 `resolveBaseline`，同样钉死 `GIT_CONFIG`）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { shardKey, shardPlan } from './jobs-rule.js'
import { executionRoutes } from './mutate-rule.js'
import { SHARD_COUNT, chainWiringFaults, growthWaivers, mutationWeight, shardLoadGate, shardWiringFaults, type ShardLoadInput } from './shard-load-rule.js'
import { GIT_CONFIG, resolveBaseline } from './size-rule.js'
import { trailerLines } from './trailer.js'

const MUTATIONS = 'scripts/check/mutations.json'
const WORKFLOW = '.github/workflows/check.yml'

const tryGit = (...args: string[]): string | null => {
  try { return execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim() } catch { return null }
}
type Mut = { id: string; by?: string }
const listOf = (text: string): Mut[] => (JSON.parse(text) as { mutations: Mut[] }).mutations

/** 当前树每一份的估重：与变异一步同一个路由、同一个键、同一个估重。算不出来就抛 —— 由下面打成红 */
const loadsNow = (): number[] => {
  const muts = listOf(readFileSync(MUTATIONS, 'utf8'))
  const routes = new Map(executionRoutes(muts as unknown as Parameters<typeof executionRoutes>[0],
    file => existsSync(file) ? readFileSync(file, 'utf8') : undefined).routes.map(r => [r.id, r]))
  return shardPlan(muts, m => shardKey(m.by, routes.get(m.id)!.only), m => mutationWeight(m.by), SHARD_COUNT).loads
}

let loads: number[]
try { loads = loadsNow() } catch (e) {
  console.log(`✗ 变异负载：当前树的变异清单算不出每一份的估重（${e instanceof Error ? e.message : String(e)}）`)
  process.exit(1)
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
  const text = tryGit('show', `${baseline.base}:${MUTATIONS}`)
  try {
    if (text === null) throw new Error(`${baseline.base.slice(0, 7)} 上没有 ${MUTATIONS}`)
    base = { total: listOf(text).reduce((sum, m) => sum + mutationWeight(m.by), 0) }
  } catch (e) { base = { unknown: e instanceof Error ? e.message : String(e) } }
  if (!baseline.onTrunk) messages = baseline.commits.map(c => tryGit('log', '-1', '--format=%B', c) ?? '')
}

let workflow: string | undefined
try { workflow = readFileSync(WORKFLOW, 'utf8') } catch { workflow = undefined }
const checkScript = ((): string | undefined => {
  try { const s = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, unknown> }).scripts?.check; return typeof s === 'string' ? s : undefined } catch { return undefined }
})()
const wiring = workflow === undefined ? [`读不到 ${WORKFLOW}`] : [...shardWiringFaults(workflow, SHARD_COUNT), ...chainWiringFaults(workflow, checkScript)]

const gate = shardLoadGate({ loads, base, trunk, waivers: growthWaivers(messages.flatMap(trailerLines)), wiring })
for (const line of gate.lines) console.log(line)
process.exitCode = gate.red ? 1 : 0
