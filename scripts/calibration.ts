#!/usr/bin/env tsx
/** `calibration version --dir <任务目录>`（D20.k–D20.u）：只读参数、打印与定退出码；判定与读写在 lib/calibration-version-task.ts。 */
import { resolve } from 'node:path'
import { runCalibrationVersion } from './lib/calibration-version-task.js'
import { ReviewInputError } from './lib/review.js'
import { taskFile } from './lib/task.js'

const usage = (): never => {
  console.error('用法：calibration version --dir <既有任务目录>')
  process.exit(2)
}
// D20.k：第一个参数是子命令，之后只接受一次必填 --dir；都在读写任务之前判完
const [command, ...args] = process.argv.slice(2)
if (command !== 'version') usage()
let dir: string | undefined
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--dir') usage()
  const value = args[++i]
  if (dir !== undefined || value === undefined || !value.trim() || value.startsWith('--')) usage()
  dir = resolve(value)
}
const taskDir = dir ?? usage()
try {
  const result = runCalibrationVersion(taskDir)
  // D20.m：缺席照实说明，stdout 仍只有那一份 JSON
  if (result.status === 'absent') console.error(`${result.file} 没有 brand_calibration：这个任务没有品牌校准，未生成校准或版本，task.json 未改动`)
  console.log(JSON.stringify(result))
} catch (error) {
  // D20.s：输入问题以 2 退出；其余都是保存失败，带 task.json 路径与实际原因，以 1 退出
  console.error(error instanceof ReviewInputError ? error.message
    : `${taskFile(taskDir)} 保存失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = error instanceof ReviewInputError ? 2 : 1
}
