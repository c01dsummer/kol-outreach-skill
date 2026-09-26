#!/usr/bin/env tsx
/** Generate or explicitly extend the independent Excel-compatible human review form. */
import { loadTask, loadCreators } from './lib/task.js'
import { existsSync } from 'node:fs'
import { taskListProblems } from './lib/search-tasks.js'
import {
  appendManualFeedbackTemplate, prepareReviewProjection, persistReviewProjection,
  feedbackFile, ReviewInputError, writeManualFeedbackTemplate,
} from './lib/review.js'

const at = process.argv.indexOf('--dir')
const dir = at >= 0 ? process.argv[at + 1] : undefined
if (!dir) {
  console.error('用法: npm run feedback-template -- --dir <任务目录> [--append]')
  process.exit(2)
}
try {
  const append = process.argv.includes('--append')
  if (!append && existsSync(feedbackFile(dir))) {
    throw new ReviewInputError([`${feedbackFile(dir)} 已存在；不会覆盖人工填写内容`])
  }
  const state = loadTask(dir)
  const taskProblems = taskListProblems(state.tasks)
  if (taskProblems.length) throw new ReviewInputError(taskProblems.map(problem => `task.json：${problem}`))
  const prepared = prepareReviewProjection(dir, state, loadCreators(dir))
  // Both input files have passed validation; preserve rounds before creating a form.
  persistReviewProjection(dir, prepared)
  const result = append
    ? appendManualFeedbackTemplate(dir, prepared.document, prepared.feedback)
    : { file: writeManualFeedbackTemplate(dir, prepared.document), appended: prepared.document.rounds
      .reduce((sum, round) => sum + round.candidates.length, 0) }
  console.log(JSON.stringify(result))
} catch (e) {
  console.error(e instanceof ReviewInputError ? e.problems.join('\n') : String(e))
  process.exitCode = e instanceof ReviewInputError ? 2 : 1
}
