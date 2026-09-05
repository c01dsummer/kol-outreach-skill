import type { Creator, TaskState } from './types.js'
import { linkCrossPlatform, mergeCrossPlatform } from './identity.js'
import {
  passesFollowerGate, scoreCreator, tierOf, applyGeoPenalty, applyAudienceRiskPenalty,
} from './score.js'
import { filterByMemory, type MemoryStatus } from './memory.js'
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
  /** 这一批有没有去过重 —— 收尾算出来的永远是肯定的答案，「无从确认」只会来自盘上 */
  memory_status: Exclude<MemoryStatus, 'unknown'>
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
 *
 * 记忆读不出来时这里会抛（P4 无法保证就不产出名单，ADR-15）。入口负责把它
 * 翻译成退出码和一条人能照做的话；**要不要继续的决定不在入口**，
 * 由调用方显式传 ignoreUnreadableMemory 表达。
 */
export function finalize(
  raw: Creator[], product: string, task?: string,
  opts: { ignoreUnreadableMemory?: boolean } = {},
): FinalizeResult {
  const all = structuredClone(raw)
  const linked = linkCrossPlatform(all)
  const merged = mergeCrossPlatform(all)

  // P1：粉丝数未知的**不丢弃** —— 「没查到」不等于「不合格」。留下并计数上报，
  //     由用户决定要不要看。静默过滤会让真实创作者凭空消失且无人知晓。
  const unknown_followers = merged.filter(c => c.followers === undefined).length
  const gated = merged.filter(passesFollowerGate)

  const { kept, filtered_recommended, filtered_contacted, memory_status } =
    filterByMemory(gated, product, task, { ignoreUnreadable: opts.ignoreUnreadableMemory })
  return { kept, linked, unknown_followers, filtered_recommended, filtered_contacted, memory_status }
}

/**
 * 这个人还要不要补 profile。
 *
 * **它决定要不要花钱**，所以有语义，所以不留在入口脚本里。抽出来的第二个理由
 * 更实际：补全循环和「续跑要花多少钱」那句话必须用**同一个**判定 ——
 * 两处各写一份表达式，迟早有一边先改，而先改的那边不会报错（ADR-25）。
 */
export function needsProfile(c: Creator): boolean {
  return c.bio === undefined || !c.bio_links?.length
}

/**
 * **续跑真正会去抓的关键词。**
 *
 * 「不在 done 里」不等于「续跑会去抓」：达标提前停下时，剩下的关键词一个都
 * 没被碰过，也不会被标记完成 —— 而续跑做的第一件事就是再查一次达标，
 * 于是一个请求都不会发（ADR-25 追记）。
 *
 * 拿 `pendingKeywords` 去说「续跑要花钱」会**多报**。方向和之前那几次相反，
 * 危害也不同：那几次是让用户少估了开销，这次是让他以为要花钱而不敢续跑 ——
 * 而不续跑就永远拿不到那份名单。
 */
export function keywordsResumeWillRun(state: TaskState, qualified: number): string[] {
  return qualified >= state.target_count ? [] : pendingKeywords(state)
}

/** 尚未跑完的关键词 —— Agent 据此向用户报进度、问要不要追加预算 */
export function pendingKeywords(state: TaskState): string[] {
  return state.tasks
    .filter((_, i) => !state.done.includes(i))
    .map(t => `${t.as_hashtag ? '#' : ''}${t.keyword}(${t.platform})`)
}

/**
 * **收尾时说给用户的那句话：续跑还要不要花钱。**
 *
 * 这句话有两支，而选哪一支是判定 —— 说反了的代价不对称：说成「不花钱」，
 * 用户放心去续跑，账单在他不知情时又长一截；说成「要花钱」，用户不敢续跑，
 * 那份已经付过钱的名单就永远拿不到（ADR-25）。
 *
 * 抽出来是因为它原来长在入口脚本里：把两支对调，检查链一路全绿 —— 端到端
 * 那条自检只验「两句话里出现了一句」，正好分不出是哪一句（评审指出）。
 *
 * **两个剩余量也在这里数**，不由调用方递进来：递数字的话，第二个写死成 0、
 * 或者两个参数调个位置，下面每一条断言和每一条变异都照样绿，而用户看到的那句话
 * 是错的 —— 那个缺口没法用变异守住（变异跑的只是 `scripts/test.ts`，够不到入口
 * 脚本）。把数数搬进来，这一类错误就不再有地方发生（评审指出）。
 *
 * 数法不是新写的：关键词那一半是 `keywordsResumeWillRun`（D6.c —— 达标提前停下时
 * 一个都不会去抓），profile 那一半是 `needsProfile`（D6.d —— 补全循环用的同一个判定）。
 */
export function resumeCostLine(
  dir: string, state: TaskState, qualified: number, creators: Creator[],
): string {
  const keywordsLeft = keywordsResumeWillRun(state, qualified).length
  const profilesLeft = creators.filter(needsProfile).length
  const rest = [
    keywordsLeft ? `${keywordsLeft} 个关键词` : '',
    profilesLeft ? `${profilesLeft} 个人的 profile` : '',
  ].filter(Boolean).join('、')
  return rest
    ? `已抓到的都在 ${dir}，不会重新抓；但还有 ${rest} 没跑完，续跑会继续发请求、继续花钱。`
    : `采集与补全都已跑完，结果都在 ${dir}，续跑不产生新的请求。`
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
