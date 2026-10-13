#!/usr/bin/env tsx
/**
 * 启动数闸门 —— 检查链的最后一步（ADR-145 第二十一节）。
 *
 * 不起验证者、不重跑任何东西：读变异一步写的 `output/mutation-launches/launches.json`，算当前树的源码身份，
 * 问 git 判 HEAD 在不在主干上，交给 `launch-rule.ts` 的 `launchGate`，照它交回的打、退出。
 * 放在最后，是为了它红的时候变异、自检、审计的结果照常拿得到（`&&` 链会跳过红了之后的每一步）。
 *
 * 判法全在 `launchGate`：数据缺了或对不上一律红（主干上也红），有发现时 PR 上红、主干上只报数（缺计数的除外）。
 * 这里没有一条路把「读不到」变成「没超」。
 *
 * 闸门那几行之前先打第七节末第二行（ADR-145 第三十一节第 3 小节）：读整跑自检写的按族计数，路由同变异一步从源码静态算，
 * 交给 `idleGroupsLine`。只报数，读到什么都不改退出码。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mutationSourceIdentity } from './claims.js'
import { type LaunchTrunk, SELFCHECK_LAUNCHES_FILE, idleGroupsLine, launchGate } from './launch-rule.js'
import { executionRoutes } from './mutate-rule.js'
import { GIT_CONFIG, resolveBaseline } from './size-rule.js'

const json = (path: string): unknown => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return undefined } }
const source = (): string | undefined => { try { return mutationSourceIdentity() } catch { return undefined } }
// 与体量闸门同一个判法、同样钉死 GIT_CONFIG；HEAD 就是主干且没有父提交也算在主干上
const tryGit = (...args: string[]): string | null => {
  try { return execFileSync('git', [...GIT_CONFIG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() } catch { return null }
}
const baseline = resolveBaseline(tryGit)
const trunk: LaunchTrunk = baseline.kind === 'cannot-answer' ? { unknown: baseline.why }
  : { onTrunk: baseline.kind === 'not-applicable' || baseline.onTrunk }

const tree = source()
// 读不成、算的时候抛错都交 undefined，由 idleGroupsLine 打成数不出来的那句
const routes = (): Parameters<typeof idleGroupsLine>[2] => {
  try {
    return executionRoutes((json('scripts/check/mutations.json') as { mutations: [] }).mutations,
      file => existsSync(file) ? readFileSync(file, 'utf8') : undefined).routes
  } catch { return undefined }
}
console.log(idleGroupsLine(json(SELFCHECK_LAUNCHES_FILE), tree, routes()))
const gate = launchGate(json('output/mutation-launches/launches.json'), tree, trunk)
for (const line of gate.lines) console.log(line)
process.exitCode = gate.red ? 1 : 0
