import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import type { Creator } from './types.js'

const FILE = 'memory/creators.json'

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
  mkdirSync('memory', { recursive: true })
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
 * - contacted / blocked → 一律排除
 * - 已推荐过 → 默认排除；换了产品则保留但标注，让用户自己判断
 */
export function filterByMemory(creators: Creator[], product: string): FilterResult {
  const mem = loadMemory()
  const kept: Creator[] = []
  let rec = 0, con = 0

  for (const c of creators) {
    const e = mem.creators[key(c)]
    if (!e) { kept.push(c); continue }
    if (e.contacted || e.blocked) { con++; continue }

    const prior = e.recommendations.filter(r => r.product !== product)
    const same = e.recommendations.some(r => r.product === product)
    if (same) { rec++; continue }

    if (prior.length) {
      const last = prior[prior.length - 1]
      c.previously_recommended = `${last.product} @ ${last.date}`
    }
    kept.push(c)
  }
  return { kept, filtered_recommended: rec, filtered_contacted: con }
}

/** 任务结束后写回。只记录进入名单的人。 */
export function recordRecommendations(creators: Creator[], product: string): void {
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
    e.recommendations.push({
      date, product, keyword: c.source_keyword,
      tier: c.tier, fit_reason: c.fit_reason,
    })
    mem.creators[k] = e
  }
  saveMemory(mem)
}
