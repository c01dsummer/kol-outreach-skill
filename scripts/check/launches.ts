#!/usr/bin/env tsx
/**
 * 启动数闸门 —— 检查链的最后一步（ADR-145 第二十一节）。
 *
 * 不起验证者、不重跑任何东西：读变异一步写的 `output/mutation-launches/launches.json`（CI 上分份跑时是几份 `launches-k-of-n.json`，
 * 由 `joinLaunchParts` 拼回整份，ADR-200），算当前树的源码身份，
 * 问 git 判 HEAD 在不在主干上，交给 `launch-rule.ts`，照它交回的打、退出：闸门的判法在 `launchGate`，摘要那一行的在 `summaryLine`。
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
 *
 * 上面这些判法（读哪份、读不成怎么吞、在不在主干上怎么翻、退出码怎么并）全在 `launch-rule.ts` 的 `launchEntry`，由需求测试直接调；
 * 这里只把读文件、写文件、问 git、算源码身份与路由交给它，照它交回的打、退出。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mutationSourceIdentity } from './claims.js'
import { launchEntry } from './launch-rule.js'
import { executionRoutes } from './mutate-rule.js'
import { MUTATION_CATALOG, readCatalog } from './catalog-rule.js'
import { askGit } from './git-entry.js'
import { resolveBaseline } from './size-rule.js'

const result = launchEntry({
  write: process.argv.slice(2).includes('--write'),
  // 与体量闸门同一个判法，git 经 git 入口问（ADR-220）
  baseline: resolveBaseline(askGit),
  readText: path => readFileSync(path, 'utf8'),
  listDir: dir => readdirSync(dir),
  source: mutationSourceIdentity,
  routes: () => {
    // 读变异目录只经读取函数（ADR-242）；读不成交 undefined
    const catalog = readCatalog(existsSync(MUTATION_CATALOG) ? readFileSync(MUTATION_CATALOG, 'utf8') : undefined)
    if (!catalog.ok) return undefined
    return executionRoutes(catalog.mutations as unknown as Parameters<typeof executionRoutes>[0],
      file => existsSync(file) ? readFileSync(file, 'utf8') : undefined).routes
  },
  writeText: (path, text) => writeFileSync(path, text),
})
for (const line of result.lines) console.log(line)
process.exitCode = result.red ? 1 : 0
