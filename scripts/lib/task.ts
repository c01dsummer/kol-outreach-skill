import { readFileSync, existsSync } from 'node:fs'
import { mkdirDurable, writeFileAtomic } from './atomic.js'
import { basename, join } from 'node:path'
import type { TaskState, Creator, EnrichmentState, MemoryStatus } from './types.js'

export function taskDir(product: string, timestamp?: string): string {
  const ts = timestamp ?? new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  return join('output', `${product}-${ts}`)
}

export function loadTask(dir: string): TaskState {
  return JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'))
}

export function saveTask(dir: string, state: TaskState): void {
  mkdirDurable(dir)
  state.updated_at = new Date().toISOString()
  writeFileAtomic(join(dir, 'task.json'), JSON.stringify(state, null, 2))
}

export function loadCreators(dir: string): Creator[] {
  const p = join(dir, 'creators.json')
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []
}

export function saveCreators(dir: string, creators: Creator[]): void {
  mkdirDurable(dir)
  writeFileAtomic(join(dir, 'creators.json'), JSON.stringify(creators, null, 2))
}

/**
 * 名单和它的去重状态一起落盘。
 *
 * 两个文件、两次写入，中间被打断是可能的，而**哪个先写都不安全** ——
 * 安全与否取决于状态往哪个方向变（ADR-41）：
 *
 * | 状态怎么变 | 名单先写 | 状态先写 |
 * |---|---|---|
 * | `ok` → `unreadable_ignored` | 未去重的新名单 + 说已去重的旧状态 ✗ | 安全 |
 * | `unreadable_ignored` → `ok` | 安全 | 未去重的旧名单 + 说已去重的新状态 ✗ |
 *
 * 两种坏法一模一样：报告压掉警告，把打扰过、已拉黑的人当成已去重交付。
 *
 * 所以**不选顺序，分三步**：先把断言撤成「无从确认」，再换名单，最后才断言。
 * 任何一步被打断，盘上留下的都是一个不做肯定断言的状态 —— 报告会警告，
 * 用户重跑一次。**肯定的断言永远最后写，而且只在它描述的东西已经落盘之后。**
 *
 * 每一步自己是整体替换（`atomic.ts`，写到一半被杀不会留下截断的文件）；
 * 两个采集同时写同一个目录时的交错，按 D4 当前不保证（ADR-66）。
 */
export function persistListAndStatus(
  dir: string, state: TaskState, creators: Creator[], status: MemoryStatus,
): void {
  // 一、撤掉旧断言。此后到第三步之间，盘上的状态都不替任何一份名单打包票
  state.memory_status = 'unknown'
  saveTask(dir, state)
  // 二、换名单
  saveCreators(dir, creators)
  // 三、名单确实落盘了，这才敢断言
  state.memory_status = status
  saveTask(dir, state)
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
  mkdirDurable(dir)
  writeFileAtomic(join(dir, RAW), JSON.stringify(creators, null, 2))
}

const ENRICHMENT = 'enrichment.json'

export function loadEnrichment(dir: string): EnrichmentState | undefined {
  const p = join(dir, ENRICHMENT)
  if (!existsSync(p)) return undefined
  return JSON.parse(readFileSync(p, 'utf8'))
}

export function saveEnrichment(dir: string, state: EnrichmentState): void {
  mkdirDurable(dir)
  state.updated_at = new Date().toISOString()
  writeFileAtomic(join(dir, ENRICHMENT), JSON.stringify(state, null, 2))
}
