#!/usr/bin/env tsx
/**
 * 复评经验库（D31，ADR-230）的三个动作。都不开账、不发请求、不读写已联系名单。
 *
 *   npm run lessons -- list
 *     列出已有经验库的品类名（给新任务定品类名时先看这张，能沿用就沿用，D31.m）。
 *
 *   npm run lessons -- read --dir output/<任务目录> --category <品类名>
 *     语义筛选前读同名那一份（D31.l），把每条经验连同它相对现行规则的状态打到 stdout（D31.j），
 *     并在任务目录里记下这次读了什么（lessons-read.json），render 据此在数据边界里写明（D31.k、D31.t、D31.v、D31.w）。
 *     没有那一份、读不出来都照常以 0 结束 —— 经验只是参考，缺了照常跑（D31.l、D31.t）；读不出来时原文件一字不动（D31.u）。
 *
 *   npm run lessons -- add --category <品类名> --entry <草稿 JSON 文件> --confirmed-by-user
 *     把一条用户在对话里确认收下的经验追加进库（D31.g）。不带 --confirmed-by-user 不写：
 *     这个开关是 Agent 替用户按下的，机器核不了用户真说过没有，只防 Agent 顺手就写（ADR-230 第五节）。
 *     五项不齐不写（D31.d），库读不出来不写（D31.u）。
 *
 * 退出码沿用 ADR-193 那张表：0 做完；1 保存失败以外的运行错误；2 输入问题；6 保存失败。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { writeFileAtomic } from './lib/atomic.js'
import { EXIT } from './lib/exit-codes.js'
import {
  LESSONS_READ_FILE, LessonRejected, addLesson, categoryProblem, currentRuleVersion, lessonsFile, lessonsRecord, listCategories, readLessons,
} from './lib/lessons.js'
import { taskFile } from './lib/task.js'

const usage = (): never => {
  console.error('用法：lessons list\n      lessons read --dir <任务目录> --category <品类名>\n      lessons add --category <品类名> --entry <草稿 JSON 文件> --confirmed-by-user')
  process.exit(EXIT.input)
}
const [action, ...rest] = process.argv.slice(2)
const opts = new Map<string, string>()
const flags = new Set<string>()
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i]
  if (arg === '--confirmed-by-user') { if (flags.has(arg)) usage(); flags.add(arg); continue }
  if (arg !== '--dir' && arg !== '--category' && arg !== '--entry') usage()
  const value = rest[i + 1]
  if (opts.has(arg) || value === undefined || value.startsWith('--')) usage()
  opts.set(arg, value); i++
}
const allowed: Record<string, { need: string[]; flags: string[] }> = {
  list: { need: [], flags: [] },
  read: { need: ['--dir', '--category'], flags: [] },
  add: { need: ['--category', '--entry'], flags: ['--confirmed-by-user'] },
}
const spec = action === undefined ? undefined : allowed[action]
if (spec === undefined) usage()
const shape = spec as { need: string[]; flags: string[] }
if ([...opts.keys()].some(k => !shape.need.includes(k)) || shape.need.some(k => !opts.has(k))) usage()
if ([...flags].some(f => !shape.flags.includes(f))) usage()

const category = opts.get('--category')
if (category !== undefined) {
  const bad = categoryProblem(category)
  if (bad) { console.error(`品类名 ${bad}（这里是 ${JSON.stringify(category)}）`); process.exit(EXIT.input) }
}

if (action === 'list') {
  let categories: string[]
  try { categories = listCategories() }
  catch (e) { console.error(`经验库目录读不出来：${e instanceof Error ? e.message : String(e)}`); process.exit(EXIT.input) }
  console.log(JSON.stringify({ categories }))
  process.exit(EXIT.done)
}

if (action === 'add') {
  if (!flags.has('--confirmed-by-user')) {
    console.error('没有写入：只收用户在对话里明确确认收下的经验。用户确认后再带 --confirmed-by-user 写入（D31.g）。')
    process.exit(EXIT.input)
  }
  const entryFile = resolve(opts.get('--entry') as string)
  let draft: unknown
  try { draft = JSON.parse(readFileSync(entryFile, 'utf8')) }
  catch (e) { console.error(`${entryFile} 读不成草稿：${e instanceof Error ? e.message : String(e)}；没有写入。`); process.exit(EXIT.input) }
  try {
    const r = addLesson(category as string, draft, new Date().toISOString())
    console.log(JSON.stringify(r))
    process.exit(EXIT.done)
  } catch (e) {
    if (e instanceof LessonRejected) { console.error(e.message); process.exit(EXIT.input) }
    console.error(`${lessonsFile(category as string)} 保存失败：${e instanceof Error ? e.message : String(e)}；不能当成已写入。`)
    process.exit(EXIT.save)
  }
}

// read
const dir = resolve(opts.get('--dir') as string)
try { readFileSync(taskFile(dir)) }
catch (e) { console.error(`${taskFile(dir)} 读不出来，不是一个任务目录：${e instanceof Error ? e.message : String(e)}`); process.exit(EXIT.input) }
const current = currentRuleVersion()
const read = readLessons(category as string)
const file = lessonsFile(category as string)
const record = lessonsRecord(category as string, read, current)
try { writeFileAtomic(join(dir, LESSONS_READ_FILE), `${JSON.stringify({ ...record, read_at: new Date().toISOString() }, null, 2)}\n`) }
catch (e) {
  console.error(`${join(dir, LESSONS_READ_FILE)} 保存失败：${e instanceof Error ? e.message : String(e)}；这次读了什么没记下，报告里会写成没有读经验库。`)
  process.exit(EXIT.save)
}
if (read.status === 'unreadable') console.error(`⚠️ ${file} 读不出来，本次不参考经验，照常往下做；原文件没有改动：${read.detail}`)
// 给 Agent 读的全文：每条经验原样，加上它的状态
console.log(JSON.stringify({
  ...record,
  lessons: read.status === 'ok' ? read.lessons.map((l, i) => ({ index: i + 1, state: record.lessons[i].state, ...l })) : [],
}, null, 2))
process.exit(EXIT.done)
