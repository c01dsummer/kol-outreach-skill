import { readFileSync, writeFileSync, renameSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { TaskState, Creator, EnrichmentState, MemoryStatus } from './types.js'

/**
 * 落盘：**先写临时文件再改名。**
 *
 * 直接盖原文件是非原子的 —— 写到一半被杀，留下的是一份截断的 JSON。
 * 这个目录里的四个文件**每个都只有一份，坏了要重新花钱抓**：
 *
 * - `task.json` —— 坏了续跑起不来，已经花钱抓到的东西找不回来；
 *   而且 `persistListAndStatus` 那套三步协议正建立在「盘上确实有那个状态」
 *   之上，写到一半留下的是个读不出来的文件，不是一个保守的状态
 * - `creators.raw.json` —— 采集累加器，坏了整批采集作废
 * - `creators.json` / `enrichment.json` —— 交付物与已付费的补全结果
 *
 * 与 `memory.ts` 里那套是同一个做法，理由也同一个（ADR-15 · ADR-45）。
 * 临时名带 pid：两个任务同时跑时，共用一个临时名会让 A 的改名搬走 B 写的内容。
 *
 * **不做孤儿清理**：硬杀留下的临时文件就躺在这个任务目录里，而任务目录本身
 * 是一次性的、可以整个删掉。记忆文件那边要清，是因为它长期存在、
 * 而且孤儿是一份完整的联系历史副本。这里两条都不成立。
 */
function writeAtomic(file: string, data: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    renameSync(tmp, file)
  } catch (e) {
    rmSync(tmp, { force: true })   // 半成品不留在盘上
    throw e
  }
}

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
  writeAtomic(join(dir, 'task.json'), state)
}

export function loadCreators(dir: string): Creator[] {
  const p = join(dir, 'creators.json')
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []
}

export function saveCreators(dir: string, creators: Creator[]): void {
  mkdirSync(dir, { recursive: true })
  writeAtomic(join(dir, 'creators.json'), creators)
}

/**
 * 名单和它的去重状态一起落盘。
 *
 * 两个文件、两次 `writeFileSync`，中间被打断是可能的，而**哪个先写都不安全** ——
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
  mkdirSync(dir, { recursive: true })
  writeAtomic(join(dir, RAW), creators)
}

const ENRICHMENT = 'enrichment.json'

export function loadEnrichment(dir: string): EnrichmentState | undefined {
  const p = join(dir, ENRICHMENT)
  if (!existsSync(p)) return undefined
  return JSON.parse(readFileSync(p, 'utf8'))
}

export function saveEnrichment(dir: string, state: EnrichmentState): void {
  mkdirSync(dir, { recursive: true })
  state.updated_at = new Date().toISOString()
  writeAtomic(join(dir, ENRICHMENT), state)
}
