import { readFileSync, existsSync } from 'node:fs'
import { ABSENT_FILE, readIfExists } from './atomic.js'
import { basename, join } from 'node:path'
import type { TaskState, Creator, EnrichmentState, MemoryStatus } from './types.js'
import { mkdirDurable, writeFileAtomic } from './atomic.js'


/**
 * 任务状态的文件名。**全仓库只此一份** —— `saveTask` 和 `persistListAndStatus` 都要拼它，
 * 各写一份时改了一处没改另一处，改名前的比对就会去比**另一个文件**，
 * 而且比得通过：那道并发保护会静默失效（ADR-52 自查发现）。
 */
const TASK_FILE = 'task.json'

/**
 * 任务状态文件的路径。**入口脚本也要走它** —— 上一轮把名字收成一份常量之后，
 * `collect` 与 `enrich` 里还各自拼着 `${dir}/task.json`，那句「只此一份」
 * 在仓库范围内并不成立（ADR-53 自查发现）。
 */
export const taskFile = (dir: string): string => join(dir, TASK_FILE)

export function taskDir(product: string, timestamp?: string): string {
  const ts = timestamp ?? new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  return join('output', `${product}-${ts}`)
}

export function loadTask(dir: string): TaskState {
  return JSON.parse(readFileSync(taskFile(dir), 'utf8'))
}

/**
 * 写 `task.json`。`seen` 传了就在改名前最后一刻确认盘上还是那一份。
 *
 * 返回这次写下去的内容 —— 下一步要拿它当新的 `seen`。
 */
export function saveTask(dir: string, state: TaskState, seen?: string): string {
  mkdirDurable(dir)
  state.updated_at = new Date().toISOString()
  const data = JSON.stringify(state, null, 2)
  const file = taskFile(dir)
  writeFileAtomic(file, data, seen === undefined ? undefined : () => {
    if (readIfExists(file) !== seen) throw new TaskChangedUnderfoot(dir)
  })
  return data
}

/** 同一个任务目录被另一个进程写过了 —— 见 persistListAndStatus */
export class TaskChangedUnderfoot extends Error {
  constructor(readonly dir: string) {
    super(`任务目录 ${dir} 在这次落盘之间被别的进程改过了 —— ` +
          `同一个目录不要同时跑两个 collect`)
    this.name = 'TaskChangedUnderfoot'
  }
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
  // 三步各自是原子的，**但三步合起来不是**。同一个任务目录跑两个 collect 时
  // 它们会交错：两边都写下 unknown，一边写去过重的名单、另一边写没去重的，
  // 最后一边补上 ok —— 盘上就成了「没去重的名单 + 说已去重的状态」，
  // 报告据此压掉警告（ADR-51）。
  //
  // 和记忆那边一样：**不做串行化，只做检测** —— 每一步改名前确认盘上还是
  // 上一步留下的那份，被别人插进来就当场停下并报出来。
  const file = taskFile(dir)
  let seen = readIfExists(file)
  // 一、撤掉旧断言。此后到第三步之间，盘上的状态都不替任何一份名单打包票
  state.memory_status = 'unknown'
  seen = saveTask(dir, state, seen)
  // 二、换名单
  saveCreators(dir, creators)
  // 三、名单确实落盘了，这才敢断言
  state.memory_status = status
  saveTask(dir, state, seen)
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
