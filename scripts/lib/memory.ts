import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Creator } from './types.js'

/** D4：本地单文件，不做多人共享。团队场景需另行设计。 */
const DEFAULT_FILE = 'memory/creators.json'

/** 可注入路径 —— 否则这套规则只能靠「看起来对」，测不了 */
let FILE = DEFAULT_FILE
export function useMemoryFile(path: string): void { FILE = path }

export interface MemoryEntry {
  platform: string
  handle: string
  nickname: string
  followers: number
  first_seen: string
  linked_to?: string
  recommendations: Array<{
    date: string
    product: string
    keyword: string
    /** 产出目录名 —— 用来区分「同一任务的续跑」与「另一次任务」，见 filterByMemory */
    task?: string
    tier?: string
    fit_reason?: string
  }>
  contacted: boolean
  replied: boolean
  blocked: boolean
  note: string
}

interface MemoryFile {
  version: number
  updated_at: string
  creators: Record<string, MemoryEntry>
}

const key = (c: { platform: string; handle: string }) => `${c.platform}:${c.handle.toLowerCase()}`

export function loadMemory(): MemoryFile {
  if (!existsSync(FILE)) return { version: 1, updated_at: '', creators: {} }
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    // 记忆文件损坏不该中断任务 —— 退化为空记忆
    console.warn(`⚠️  ${FILE} 解析失败，本次按空记忆处理（原文件未覆盖）`)
    return { version: 1, updated_at: '', creators: {} }
  }
}

export function saveMemory(mem: MemoryFile): void {
  mkdirSync(dirname(FILE), { recursive: true })
  mem.updated_at = new Date().toISOString()
  writeFileSync(FILE, JSON.stringify(mem, null, 2), 'utf8')
}

export interface FilterResult {
  kept: Creator[]
  filtered_recommended: number
  filtered_contacted: number
}

/**
 * 按记忆过滤。
 *
 * - contacted / blocked → 一律排除（P4）
 * - 同一产品在**别的任务**里推荐过 → 排除
 * - 同一任务自己写下的推荐 → **不参与过滤**。续跑要推荐的就是这批人；
 *   把他们滤掉，会让 render 之后的每一次 --resume 都产出一份空名单。
 * - 换了产品 → 保留但标注，让用户自己判断
 */
export function filterByMemory(creators: Creator[], product: string, task?: string): FilterResult {
  const mem = loadMemory()
  const kept: Creator[] = []
  let rec = 0, con = 0

  for (const c of creators) {
    const e = mem.creators[key(c)]
    if (!e) { kept.push(c); continue }
    if (e.contacted || e.blocked) { con++; continue }

    // 本任务自己留下的记录不算数 —— 否则续跑会把自己上一轮的产出判成「已推荐过」
    const others = e.recommendations.filter(r => !(task && r.task === task))
    if (others.some(r => r.product === product)) { rec++; continue }

    const prior = others.filter(r => r.product !== product)
    if (prior.length) {
      const last = prior[prior.length - 1]
      c.previously_recommended = `${last.product} @ ${last.date}`
    }
    kept.push(c)
  }
  return { kept, filtered_recommended: rec, filtered_contacted: con }
}

/** 任务结束后写回。只记录进入名单的人。 */
export function recordRecommendations(creators: Creator[], product: string, task?: string): void {
  const mem = loadMemory()
  const date = new Date().toISOString().slice(0, 10)

  for (const c of creators) {
    const k = key(c)
    const e = mem.creators[k] ?? {
      platform: c.platform, handle: c.handle, nickname: c.nickname,
      followers: c.followers, first_seen: date,
      recommendations: [], contacted: false, replied: false, blocked: false, note: '',
    }
    e.nickname = c.nickname || e.nickname
    e.followers = c.followers || e.followers
    if (c.linked_handle) e.linked_to = c.linked_handle
    // 同一任务重复 render 不该堆出多条记录 —— 覆盖而不是追加
    e.recommendations = e.recommendations.filter(r => !(task && r.task === task))
    e.recommendations.push({
      date, product, keyword: c.source_keyword, task,
      tier: c.tier, fit_reason: c.fit_reason,
    })
    mem.creators[k] = e
  }
  saveMemory(mem)
}
