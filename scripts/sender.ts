#!/usr/bin/env tsx
/**
 * 任务建好之后才给的发件人姓名，补进既有任务 task.json 根上的 sender_name（D30.g，ADR-190 第 5 片）。
 *
 *   npm run sender -- --dir output/<任务目录> --name "<发件人姓名>"
 *
 * 只动这一个键：先按 D30 同一道校验（非空白字符串），再把盘上 task.json 原样读进来、改这一个键、整份写回。
 * 不开账、不发请求、不读写记忆；拒绝时 task.json 保持原字节。
 * 写回走 saveTask，所以 updated_at 会换成这次写入的时刻；其余键照读入时的原值写回，数字照原文（D19.g）。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readCostDocument, sourceDuplicates } from './lib/cost-json.js'
import { duplicateKeyProblems } from './lib/duplicate-keys.js'
import { saveTask, taskFile } from './lib/task.js'
import { textProblem, type TaskState } from './lib/types.js'

const usage = (): never => {
  console.error('用法：sender --dir <既有任务目录> --name <发件人姓名>')
  process.exit(2)
}
const args = process.argv.slice(2)
let dir: string | undefined
let name: string | undefined
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  const value = args[i + 1]
  if (arg === '--dir') {
    if (dir !== undefined || value === undefined || !value.trim() || value.startsWith('--')) usage()
    dir = resolve(value); i++
  } else if (arg === '--name') {
    // 姓名本身可能以 -- 开头以外的任何字符开头；空白与空串留给下面 D30 那一道报，好让报错写出字段与原值
    if (name !== undefined || value === undefined || value.startsWith('--')) usage()
    name = value; i++
  } else usage()
}
const taskDir = dir ?? usage()
const sender = name ?? usage()

// D30.g：与 D30.b/c 同一道 —— 不是非空白字符串就拒绝，原值写进 stderr
const bad = textProblem(sender)
if (bad !== undefined) {
  console.error(`sender_name ${bad}（这里是 ${JSON.stringify(sender)}）；${taskFile(taskDir)} 没有改动。`)
  process.exit(2)
}

const file = taskFile(taskDir)
let state: TaskState
try {
  // 根不是对象、费用数字写不成精确值，都在这里拒（readCostDocument 只交回对象）
  state = readCostDocument<TaskState>(readFileSync(file, 'utf8'))
} catch (e) {
  // 目录里没有 task.json 也走这里：发件人姓名只补进已经建好的任务，新建任务时写进 collect 的配置根上
  console.error(`${file} 读不成任务：${e instanceof Error ? e.message : String(e)}；没有改动。`)
  process.exit(2)
}
// 写重复的键：整份写回会悄悄只留最后一处，等于替用户改了别的键（D27）。先拒，让人先把重复的那几处理清
const duplicates = duplicateKeyProblems(sourceDuplicates(state))
if (duplicates.length) {
  console.error(`${file} 里写重复的键，整份写回会丢掉前几处；没有改动：\n  ${duplicates.join('\n  ')}`)
  process.exit(2)
}

const before = Object.hasOwn(state, 'sender_name') ? state.sender_name : undefined
state.sender_name = sender
try { saveTask(taskDir, state) }
catch (e) {
  console.error(`${file} 保存失败：${String(e)}`)
  process.exit(1)
}
console.log(JSON.stringify({ task: file, sender_name: sender, ...(before === undefined ? {} : { replaced: before }) }))
