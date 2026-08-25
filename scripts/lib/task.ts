import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskState, Creator } from './types.js'

export function taskDir(product: string, timestamp?: string): string {
  const ts = timestamp ?? new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  return join('output', `${product}-${ts}`)
}

export function loadTask(dir: string): TaskState {
  return JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'))
}

export function saveTask(dir: string, state: TaskState): void {
  mkdirSync(dir, { recursive: true })
  state.updated_at = new Date().toISOString()
  writeFileSync(join(dir, 'task.json'), JSON.stringify(state, null, 2), 'utf8')
}

export function loadCreators(dir: string): Creator[] {
  const p = join(dir, 'creators.json')
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []
}

export function saveCreators(dir: string, creators: Creator[]): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'creators.json'), JSON.stringify(creators, null, 2), 'utf8')
}
