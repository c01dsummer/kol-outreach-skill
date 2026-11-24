#!/usr/bin/env tsx
/**
 * 周回访「周一」取原料与只进 PR 正文的 (a)、(d)、(e) 三段的入口（`docs/REVISIT.md`）。判定全在 `revisit-raw-rule.ts`，这里只剩读参数、读写文件与打印。
 *
 *   tsx scripts/check/revisit-raw.ts --gather --today <日期> --dir <目录> [--run <提交>]
 *     取原料：两份台账、两份被引表、新增、消失六份文件写进 `<目录>`，打一行「原料齐了 / 原料不齐：为什么」。不齐以 1 退出。
 *   tsx scripts/check/revisit-raw.ts --top --dir <目录>
 *     (d) 被引表前十：读 `<目录>` 里的两份被引表。
 *   tsx scripts/check/revisit-raw.ts --slow --today <日期> --runs <文件>
 *     (a) 主干上偏慢的几跑与工作量：`<文件>` 是例程存下来的 `check.yml` 在主干上 push 触发的成功跑（接口返回原样，一页或几页排成数组；混进别的跑就不收）。条数从本仓库的 git 里取。
 *   tsx scripts/check/revisit-raw.ts --never-red-pick --today <日期> --runs <文件>
 *     (e) 挑本周那一跑与上一跑：`<文件>` 是 `never-red.yml` 跑完了的那几页。打两个 run id。
 *   tsx scripts/check/revisit-raw.ts --never-red --run-id <id> --log <文件> --jobs <文件> [--prev-log <文件>]
 *     (e) 从没红过的断言：本周那一跑「清单」job 的日志、那一跑的 jobs 接口返回、上一跑「清单」job 的日志（读不到就不给）。
 *
 * 交进来的文件形状不对就以 2 退出、说哪里不对，不往下算（整份先核形状，`process/3-BUILD.md` 第 9 条）；日志里没有那一行不算形状不对，照常报无从确认。
 * 给了带值的选项却没跟值，也以 2 退出。
 * `--run` 缺省 `origin/main`。只读 git；`--gather` 只写 `--dir` 那个目录。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHECK_RUNS, catalogCount, cliRawGit, gatherRaw, NEVER_RED_RUNS, neverRedLines, neverRedStop, optValue, parseJobs, parseRuns, pickNeverRed, rawLine, readNeverRed, type RunsWant, slowRuns, topTen } from './revisit-raw-rule.js'

const args = process.argv.slice(2)
const stop = (why: string): never => { console.error(why); process.exit(2) }
// 给了选项却没跟值就停，不当成没给（`--run` 漏写提交会悄悄用缺省）
const opt = (name: string): string | undefined => { const v = optValue(args, name); return typeof v === 'object' ? stop(v.fault) : v }
const need = (name: string): string => opt(name) ?? stop(`缺 ${name}`)
const read = (file: string): string => { try { return readFileSync(file, 'utf8') } catch (e) { return stop(`读不出 ${file}：${(e as Error).message}`) } }
const day = (): string => {
  const d = need('--today')
  const ms = Date.parse(`${d}T00:00:00Z`)
  // 日子写错（格式不对、2 月 30 日那种会被挪到下个月的）就停：窗口全算错，却照常打出来
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== d) stop(`--today 要写成成立的日子 YYYY-MM-DD，收到的是 ${d}`)
  return d
}
const runs = (file: string, want: RunsWant) => {
  const r = parseRuns(read(file), want)
  return 'fault' in r ? stop(`${file}：${r.fault}`) : r
}

const git = cliRawGit()
if (args.includes('--gather')) {
  const dir = need('--dir')
  const raw = gatherRaw(git, opt('--run') ?? 'origin/main', day())
  mkdirSync(dir, { recursive: true })
  for (const [name, text] of Object.entries(raw.files)) writeFileSync(join(dir, name), text, 'utf8')
  console.log(rawLine(raw))
  if (raw.faults.length > 0) process.exitCode = 1
} else if (args.includes('--top')) {
  const dir = need('--dir')
  for (const l of topTen(read(join(dir, '旧被引表')), read(join(dir, '新被引表')))) console.log(l)
} else if (args.includes('--slow')) {
  const r = runs(need('--runs'), CHECK_RUNS)
  for (const l of slowRuns(r.runs, day(), sha => catalogCount(git, sha), r.total)) console.log(l)
} else if (args.includes('--never-red-pick')) {
  const p = pickNeverRed(runs(need('--runs'), NEVER_RED_RUNS).runs, day(), Date.now())
  console.log(`本周那一跑 ${p.this?.id ?? '无从确认'} · 上一跑 ${p.prev?.id ?? '无从确认'}${p.fault === undefined ? '' : `（${p.fault}）`}`)
} else if (args.includes('--never-red')) {
  const id = Number(need('--run-id'))
  if (!Number.isInteger(id) || id <= 0) stop(`--run-id 要是正整数，收到的是 ${opt('--run-id')}`)
  const jobs = parseJobs(read(need('--jobs')), id)
  if ('fault' in jobs) stop(`${opt('--jobs')}：${jobs.fault}`)
  const prevLog = opt('--prev-log')
  const prev = prevLog === undefined ? { absent: '上一跑的日志没给' } : readNeverRed(read(prevLog))
  const mine = readNeverRed(read(need('--log')))
  const why = neverRedStop(mine, prev)
  if (why !== undefined) stop(why)
  for (const l of neverRedLines(id, mine, prev, 'fault' in jobs ? [] : jobs.jobs)) console.log(l)
} else {
  stop('用法见 scripts/check/revisit-raw.ts 开头：--gather、--top、--slow、--never-red-pick、--never-red 之一')
}
