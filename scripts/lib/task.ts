import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
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

/**
 * 任务标识 —— 取目录名，与用户怎么写路径（相对/绝对/带尾斜杠）无关。
 * collect 与 render 必须算出同一个值，记忆才认得出「这是同一次任务」。
 */
export const taskId = (dir: string): string => basename(dir.replace(/[/\\]+$/, ''))

const RAW = 'creators.raw.json'

/**
 * 采集累加器。**与交付物 creators.json 是两个文件。**
 *
 * 早先两者共用一个：collect 结尾把过滤后的名单写回 creators.json，而 --resume
 * 开头又从同一个文件读回。于是 render 跑过之后再续跑，记忆过滤把整批人判成
 * 「本产品已推荐过」，creators.json 被清成空数组 —— 已经付费采集的数据
 * 不可恢复地消失。累加器只增不减，过滤只作用于交付物。
 */
export function loadRawCreators(dir: string): Creator[] {
  const raw = join(dir, RAW)
  if (existsSync(raw)) return JSON.parse(readFileSync(raw, 'utf8'))
  // 兼容分文件之前产生的任务目录
  return loadCreators(dir)
}

export function saveRawCreators(dir: string, creators: Creator[]): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, RAW), JSON.stringify(creators, null, 2), 'utf8')
}
