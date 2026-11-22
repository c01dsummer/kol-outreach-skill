#!/usr/bin/env tsx
/**
 * 同一处连着两轮被评审挑中就拦住合入（ADR-225）：取数的入口，判定在 `same-spot-rule.ts`。
 *
 * 只在 GitHub 上跑（`.github/workflows/same-spot.yml`）：要这条 PR 的评审意见，本地 `npm run check` 没有、也不该有这份令牌。
 * 本地只跑它的测试（`scripts/test.ts` 那一组，含 #471 的真实评审记录回放）。
 *
 * 要的环境变量：`GITHUB_REPOSITORY`（主人/仓库）、`GITHUB_TOKEN`（只读）、`SAME_SPOT_PR`（PR 号）、
 * `SAME_SPOT_HEAD`（PR 头的提交，检出在当前目录）、`SAME_SPOT_MAIN`（主干，比如 `origin/main`）。
 * 缺一样、取不到一样都报红，不退化成「没找到，通过」。
 */
import fs from 'node:fs'
import path from 'node:path'

import { gitOrThrow, gitText } from './git-entry.js'
import {
  type ReviewComment, type Waiver,
  chainFrom, changedRecords, hitsOf, newWaiversOf, positionIn, roundsOf, spotText, spotsOf,
} from './same-spot-rule.js'

function need(name: string): string {
  const v = process.env[name]
  if (!v) { console.error(`✗ 同一处连着两轮：缺环境变量 ${name}，无从判断（ADR-225）`); process.exit(1) }
  return v
}

/** 全部评审意见（行内的那种），按页取完 */
async function commentsOf(repo: string, pr: string, token: string): Promise<ReviewComment[]> {
  const all: ReviewComment[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}/comments?per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    })
    if (!res.ok) throw new Error(`取评审意见第 ${page} 页失败：HTTP ${res.status}`)
    const batch = await res.json() as ReviewComment[]
    all.push(...batch)
    if (batch.length < 100) return all
  }
}

async function main(): Promise<void> {
  const repo = need('GITHUB_REPOSITORY'), token = need('GITHUB_TOKEN'), pr = need('SAME_SPOT_PR')
  const head = need('SAME_SPOT_HEAD'), mainRef = need('SAME_SPOT_MAIN')
  const mainSet = new Set(gitOrThrow(['rev-list', mainRef]).trim().split('\n'))
  const onMain = (sha: string) => mainSet.has(sha)
  // 父提交与树都问 git：`rev-parse <提交>^@` 一行一个父提交（第一个父在前），`rev-parse <提交>^{tree}` 是树
  const parentsOf = (sha: string) => gitOrThrow(['rev-parse', `${sha}^@`]).split('\n').filter(Boolean)
  const treeOf = (sha: string) => gitOrThrow(['rev-parse', `${sha}^{tree}`]).trim()
  const chain = chainFrom(gitOrThrow(['rev-parse', head]).trim(), parentsOf, treeOf, onMain)
  const comments = await commentsOf(repo, pr, token)

  const files = new Map<string, string | null>()
  const fileAt = (sha: string, p: string) => {
    const key = `${sha}:${p}`
    if (!files.has(key)) files.set(key, gitText(['cat-file', 'blob', key]))
    return files.get(key)!
  }
  const rounds = roundsOf(chain, onMain, comments, c => spotsOf(c, fileAt))

  // 解除表：检出的 PR 头上、这条 PR 加了或改了的决策记录里找。比的是 PR 头与主干的分叉点上的同名文件（经 git 入口取，
  // 没有就是新加的）：比主干的头，PR 没同步时主干后来改过的记录也会被当成本 PR 改的
  const waivers: Waiver[] = [], faults: string[] = []
  const adrDir = 'docs/adr'
  const fork = gitOrThrow(['merge-base', head, mainRef]).trim()
  const records = fs.readdirSync(adrDir).filter(f => f.endsWith('.md')).sort().map(f => {
    const file = path.join(adrDir, f)
    return { file, text: fs.readFileSync(file, 'utf8'), base: gitText(['cat-file', 'blob', `${fork}:${file}`]) }
  })
  for (const r of changedRecords(records)) {
    const got = newWaiversOf(r.file, r.text, r.base)
    waivers.push(...got.waivers); faults.push(...got.faults)
  }
  const judged = hitsOf(rounds, waivers, sha => positionIn(chain, sha))
  faults.push(...judged.faults)

  console.log(`同一处连着两轮（ADR-225）：PR #${pr}，${chain.length} 个提交，${rounds.length} 轮评审`)
  for (const h of judged.hits) {
    console.log(`${h.blocks ? '✗ 拦' : '· 只列出'}  ${spotText(h.spot)}：版本 ${h.earlier.head.slice(0, 7)} 那一轮与版本 ${h.later.head.slice(0, 7)} 那一轮`)
    for (const r of [h.earlier, h.later]) {
      for (const i of r.items) if (i.spots.some(s => s.path === h.spot.path)) console.log(`    ${i.comment.html_url}`)
    }
  }
  for (const f of faults) console.log(`✗ ${f}`)
  const blocked = judged.hits.filter(h => h.blocks)
  if (blocked.length || faults.length) {
    console.log(`\n要合入：停手改设计，拿给需求所有者定；定了以后在决策记录里写「## 同一处连着两轮：改设计」那张表，`
      + `每一处一行，写明旧做法最后一轮的提交（process/6-INTEGRATE.md「同一处连着两轮被挑出毛病」）`)
    process.exit(1)
  }
  console.log('✓ 没有连着两轮落在同一处的代码')
}

await main()
