import type { Creator, TaskState } from './types.js'
import { linkCrossPlatform, mergeCrossPlatform } from './identity.js'
import {
  passesFollowerGate, scoreCreator, tierOf, applyGeoPenalty, applyAudienceRiskPenalty,
} from './score.js'
import { filterByMemory } from './memory.js'
import { sortForOutput } from './rows.js'

/*
 * 入口脚本里不该有决策逻辑。
 *
 * 这里装的是 collect.ts 的 main() 和 render.ts 顶层原先裸露的两段管线。
 * 每一步单独都对，错的会是它们的**组合方式** —— ADR-08 那个「续跑清空名单」
 * 的数据丢失 bug 正好落在这段，而 lint、类型、变异、自检、审计全部放行：
 * 它不在任何一个单元里，所以任何单元测试都看不到它。
 *
 * 这是本仓库第四次踩「逻辑埋在入口脚本就测不了」这个坑，前三次见 ADR-08。
 * 判断一段代码该不该搬到这里，只问一句：**它的顺序错了会不会出错？**
 * 会，就说明它有语义，有语义就该能被测。
 */

// ═══════════ collect 的收尾 ═══════════

export interface FinalizeResult {
  kept: Creator[]
  linked: number
  unknown_followers: number
  filtered_recommended: number
  filtered_contacted: number
}

/**
 * 从采集累加器算出交付名单。**四步的先后都是有约束的**：
 *
 *   同人识别 → 合并 → 粉丝闸门 → 记忆过滤
 *
 * 合并必须在闸门**之前**：合并会把两个平台的粉丝数相加，先过闸门会把
 * 「TikTok 3000 + Instagram 3000、合起来 6000 够线」的人提前丢掉。
 *
 * 闸门必须在记忆过滤**之前**：filtered_contacted 报的是「本可进名单、但因为
 * 联系过而排除」的人数。先过记忆会把连闸门都过不了的人也算进去，虚报打扰规模。
 *
 * 不写盘，也**不修改传入的数据** —— 累加器只增不减（D6）是这个函数的结构性
 * 保证，不依赖调用方记得先落盘再调用。
 */
export function finalize(raw: Creator[], product: string, task?: string): FinalizeResult {
  const all = structuredClone(raw)
  const linked = linkCrossPlatform(all)
  const merged = mergeCrossPlatform(all)

  // P1：粉丝数未知的**不丢弃** —— 「没查到」不等于「不合格」。留下并计数上报，
  //     由用户决定要不要看。静默过滤会让真实创作者凭空消失且无人知晓。
  const unknown_followers = merged.filter(c => c.followers === undefined).length
  const gated = merged.filter(passesFollowerGate)

  const { kept, filtered_recommended, filtered_contacted } = filterByMemory(gated, product, task)
  return { kept, linked, unknown_followers, filtered_recommended, filtered_contacted }
}

/** 尚未跑完的关键词 —— Agent 据此向用户报进度、问要不要追加预算 */
export function pendingKeywords(state: TaskState): string[] {
  return state.tasks
    .filter((_, i) => !state.done.includes(i))
    .map(t => `${t.as_hashtag ? '#' : ''}${t.keyword}(${t.platform})`)
}

// ═══════════ render 的分层 ═══════════

/** 受众地域不达标时降一层。C 已是最低，保持不动。 */
const DEMOTE = { A: 'B', B: 'C', C: 'C' } as const

/**
 * 算分 → 分层 → 受众地域规则 → 公开信号风险降级 → 排序。
 *
 * 顺序同样有约束：降权改的是**已经算出来的** tier，放到 tierOf 之前会被覆盖；
 * 排序又必须在降权之后，否则名单按降权前的分层排，A 区里混着已经掉到 B 的人。
 *
 * F5：没有增强层时 audience_geo 为 undefined，applyGeoPenalty 一律返回 keep ——
 * 主流程照常走完，不因为缺增强数据而中断。
 *
 * 与 finalize 相反，这个函数**就地写入** score / tier —— 调用方要把这些字段
 * 存回 creators.json，克隆反而会把结果丢掉。
 */
export function rankCreators(creators: Creator[], market: string): Creator[] {
  const kept = creators.filter(c => {
    c.score = scoreCreator(c)
    c.tier = tierOf(c)
    c.tier_adjustments = []
    const geo = applyGeoPenalty(c, market)
    if (geo === 'drop') return false
    if (geo === 'demote') {
      const from = c.tier
      c.tier = DEMOTE[c.tier]
      if (from !== c.tier) c.tier_adjustments.push({
        kind: 'audience_geo', from, to: c.tier,
        reason: `${market} 受众占比低于 30%`,
      })
    }
    // F8：必须发生在 tierOf 之后，否则降级会被重新计算的 tier 覆盖。
    if (applyAudienceRiskPenalty(c) === 'demote') {
      const from = c.tier
      c.tier = DEMOTE[c.tier]
      if (from !== c.tier) c.tier_adjustments.push({
        kind: 'audience_quality_risk', from, to: c.tier,
        reason: '公开信号受众质量风险高，降一级人工复核',
      })
    }
    return true
  })
  return sortForOutput(kept)
}

export interface KeywordStat {
  keyword: string
  dimension: string
  found: number
  fit_pass: number
}

/** U3：关键词表现 —— 下一轮调整关键词策略的依据 */
export function keywordStats(creators: Creator[]): KeywordStat[] {
  const m = new Map<string, KeywordStat>()
  for (const c of creators) {
    const e = m.get(c.source_keyword)
      ?? { keyword: c.source_keyword, dimension: c.source_dimension, found: 0, fit_pass: 0 }
    e.found++
    if (c.fit === '✅') e.fit_pass++
    m.set(c.source_keyword, e)
  }
  return [...m.values()]
}

/** 分层计数。未分层的不计入 —— 三个数之和小于总数就说明有人没被分层。 */
export function tierCounts(creators: Creator[]): { A: number; B: number; C: number } {
  const t = { A: 0, B: 0, C: 0 }
  for (const c of creators) if (c.tier) t[c.tier]++
  return t
}
