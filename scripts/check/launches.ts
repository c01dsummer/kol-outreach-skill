#!/usr/bin/env tsx
/**
 * 启动数闸门 —— 检查链的最后一步（ADR-145 第二十一节）。
 *
 * 不起验证者、不重跑任何东西：读变异一步写的 `output/mutation-launches/launches.json`，算当前树的源码身份，
 * 问 git 判 HEAD 在不在主干上，交给 `launch-rule.ts` 的 `launchGate`，照它交回的打、退出。
 * 放在最后，是为了它红的时候变异、自检、审计的结果照常拿得到（`&&` 链会跳过红了之后的每一步）。
 *
 * 闸门的判法全在 `launchGate`：数据缺了或对不上一律红（主干上也红），有发现时 PR 上红、主干上只报数（缺计数的除外）。
 * 这里没有一条路把「读不到」变成「没超」。
 *
 * 闸门那几行之前先打第七节末第二行（ADR-145 第三十一节第 3 小节）：读整跑自检写的按族计数，路由同变异一步从源码静态算，
 * 交给 `idleGroupsLine`。只报数，读到什么都不改退出码。
 *
 * 再打启动数摘要那一行（ADR-145 第三十五节第 4 小节）：树内的 `scripts/check/launches.json` 照 UTF-8 读，与 `launchSummary`
 * 照这一跑现算的一起交给 `summaryLine`。它说红就以 1 退出，闸门绿着也一样（第四十四节第 2 小节）；红不红全由它判。
 * 带 `--write` 时只做一件事（第 3 小节）：派生得出来就写这个文件；派生不出来或写不进去打一行 ✗、以 1 退出。不打别的行，不判闸门。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mutationSourceIdentity } from './claims.js'
import { LAUNCH_SUMMARY_FILE, type LaunchTrunk, SELFCHECK_LAUNCHES_FILE, idleGroupsLine, launchGate, launchSummary, summaryLine } from './launch-rule.js'
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

const tree = source(), record = json('output/mutation-launches/launches.json'), summary = launchSummary(record, tree)
// 读不成、算的时候抛错都交 undefined，由 idleGroupsLine 打成数不出来的那句
const routes = (): Parameters<typeof idleGroupsLine>[2] => {
  try {
    return executionRoutes((json('scripts/check/mutations.json') as { mutations: [] }).mutations,
      file => existsSync(file) ? readFileSync(file, 'utf8') : undefined).routes
  } catch { return undefined }
}
// 没有这个文件、是个目录、读的时候出错，都交 undefined：第三十五节第 4 小节第 2 句，PR 上是第四十四节的乙
const inTree = (): string | undefined => { try { return readFileSync(LAUNCH_SUMMARY_FILE, 'utf8') } catch { return undefined } }
// 写不进去时括号里是那个错误的 code，没有就是「未知」
const code = (e: unknown): string => { const c = (e as { code?: unknown } | null)?.code; return typeof c === 'string' ? c : '未知' }
if (process.argv.slice(2).includes('--write')) {
  if ('fault' in summary) { console.log(`✗ 启动数摘要没写：${summary.fault}`); process.exitCode = 1 }
  else {
    try {
      writeFileSync(LAUNCH_SUMMARY_FILE, summary.text)
      console.log(`启动数摘要已写回 ${LAUNCH_SUMMARY_FILE}：${summary.configs} 种配置`)
    } catch (e) { console.log(`✗ 启动数摘要没写：写不进 ${LAUNCH_SUMMARY_FILE}（${code(e)}）`); process.exitCode = 1 }
  }
} else {
  console.log(idleGroupsLine(json(SELFCHECK_LAUNCHES_FILE), tree, routes()))
  const sum = summaryLine(inTree(), summary, trunk)
  console.log(sum.line)
  const gate = launchGate(record, tree, trunk)
  for (const line of gate.lines) console.log(line)
  process.exitCode = gate.red || sum.red ? 1 : 0
}
