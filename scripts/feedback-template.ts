#!/usr/bin/env tsx
import { join, resolve } from 'node:path'
import { runManualFeedbackTemplate } from './lib/feedback-template-task.js'
import { ReviewInputError } from './lib/review.js'

const usage = (): never => {
  console.error('用法：feedback-template --dir <既有任务目录> [--append]')
  process.exit(2)
}
const args = process.argv.slice(2)
let dir: string | undefined
let append = false
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--dir') {
    const value = args[++i]
    if (dir !== undefined || value === undefined || !value.trim() || value.startsWith('--')) usage()
    dir = resolve(value)
  } else if (arg === '--append') {
    if (append) usage()
    append = true
  } else usage()
}
const taskDir = dir ?? usage()
try {
  const result = runManualFeedbackTemplate(taskDir, append)
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(error instanceof ReviewInputError ? error.message
    : `${join(taskDir, 'manual-feedback.csv')} 保存失败：${String(error)}`)
  process.exitCode = error instanceof ReviewInputError ? 2 : 1
}
