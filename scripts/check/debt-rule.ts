/**
 * 欠条台账 —— 把散在 `docs/adr/` 里的「什么时候回来」抽成一份可列的清单。
 *
 * **这个模块只抽取，不判断。** 它不说哪条欠条已经还了，也不说这次改动踩到了谁。
 * 那两件事都要读懂条件本身，而「读懂」是会随模型变强的那一侧，一张正则表不是 ——
 * 撤掉匹配那一半的理由记在 ADR-86，连同实测：一条写着「下一条往
 * `SELFCHECK_TOOLS` 里加东西的 PR」的欠条，照字面做那件事，diff 的 ± 行里
 * 那个词出现 **0** 次。
 *
 * 扫的范围是**调用方交进来的那些文件**，判据里写的范围也只到这里为止。
 * 调用方今天交的是 `docs/adr/` 下的 `*.md`（`audit.ts` 第 6 节）。
 */
import { quotedMask } from './quoted.js'

export type Notation = '重启条件' | '重开讨论' | '死亡条件'

export interface Entry {
  file: string
  line: number
  notation: Notation
  /** 去掉 Markdown 装饰之后的条件原文。 */
  text: string
}

/**
 * 第一套写法，**必须带冒号**。
 *
 * 裸的「重启条件」三个字有一大半不是条件：是在统计、在引用别处的欠条、
 * 或者在讲「重启条件响了没人提醒」这类元叙述。带冒号的 109 行对得上人工
 * 逐条分类出的 107 条，裸 grep 的 167 行对不上（ADR-86 有那张分桶表）。
 *
 * 冒号之前允许的后缀是**一张闭集**，不是「随便什么」。放开成随便什么，
 * `重启条件响了没人提醒」：` 这种叙述句会被收进来 —— 而这条判据同时给下面
 * 那道硬失败用：一条叙述被当成条件，那个块就会被判成「写了重启条件」，于是
 * 真正的孤儿欠条报不出来。**报不出来是危险的那一侧**（ADR-85 的第三问），
 * 所以宁可闭集漏一种写法：漏了只会多报一条假孤儿，当场看得见。
 */
export const CONDITION =
  /重启条件(?:收紧|不变|放宽|改为|[（(][^）)\n]{0,30}[）)])?\s*[：:]/
/** 第三套：`## 死亡条件` 这一节下的条目，以及 ADR-85 那种不挂在这个标题下的。 */
export const DEATH_LEAD = /\*\*什么条件下[^*]*\*\*\s*[：:]/
const DEATH_HEADING = /^##\s+死亡条件\s*$/
const DEATH_ITEM = /^>\s*\*\*/
/** 第二套：整节都是条目，所以判据是节标题加条目行，不是某个词。 */
export const REOPEN_HEADING = /^##\s+什么条件下重开这个讨论\s*$/
const REOPEN_ITEM = /^-\s+\*\*/
const HEADING = /^##\s/
const IOU_HEAD = /^>?\s*\*{0,2}⚠️\s*\*{0,2}欠条/

/** 去掉引用记号、列表记号与加粗，只留条件本身。 */
export function plain(line: string): string {
  return line.replace(/^[>\s]*/, '').replace(/^-\s+/, '').replace(/\*\*/g, '').trim()
}

/**
 * 三套写法下的全部条目。
 *
 * 先过一道引文遮罩：决策记录里有演示这些写法的代码块与命令示例，不盖住的话
 * 一段讲「怎么 grep 欠条」的示例会被当成一条真欠条（`quoted.ts` 的文件头
 * 写着凡按结构解析 Markdown 的地方都要先过这一道）。
 */
export function entries(docs: Map<string, string>): Entry[] {
  const out: Entry[] = []
  for (const [file, text] of docs) {
    const lines = text.split('\n')
    const quoted = quotedMask(text)
    let section: Notation | null = null
    lines.forEach((line, i) => {
      if (quoted[i]) return
      if (REOPEN_HEADING.test(line)) { section = '重开讨论'; return }
      if (DEATH_HEADING.test(line)) { section = '死亡条件'; return }
      if (HEADING.test(line)) section = null
      const notation: Notation | null =
        CONDITION.test(line) ? '重启条件'
          : DEATH_LEAD.test(line) ? '死亡条件'
            : section === '死亡条件' && DEATH_ITEM.test(line) ? '死亡条件'
              : section === '重开讨论' && REOPEN_ITEM.test(line) ? '重开讨论'
                : null
      if (notation) out.push({ file, line: i + 1, notation, text: plain(line) })
    })
  }
  return out
}

/**
 * 写了欠条却没写重启条件的块 —— 硬失败。
 *
 * `docs/SYNC.md:56` 说 `docs/adr/` 里「带重启条件的欠条不算待办」，反过来就是：
 * 不带重启条件的那些是纯待办，而待办不该住在决策记录里。这条纪律今天是
 * 88 个块 88 个都执行住了的（ADR-86 逐块核过）—— **所以这道闸门今天是绿的，
 * 它拦的是往后的滑坡，不是现状。**
 *
 * 块的下界是这样推的：块头带 `>` 的，连续到第一个非 `>` 行；不带的，到第一个
 * 空行。**这个定界是本模块定的，仓库里没有写着分隔符** —— 今天 88 个块的排版
 * 是齐的，排版一变这个判据就跟着错，那一刻它会偏向报错而不是放过。
 */
export function orphanIous(docs: Map<string, string>): Entry[] {
  const out: Entry[] = []
  for (const [file, text] of docs) {
    const lines = text.split('\n')
    const quoted = quotedMask(text)
    lines.forEach((line, i) => {
      if (quoted[i] || !IOU_HEAD.test(line)) return
      const quotedBlock = line.trimStart().startsWith('>')
      let end = i + 1
      while (end < lines.length &&
             (quotedBlock ? lines[end].trimStart().startsWith('>') : lines[end].trim() !== '')) end++
      // 块内也要过遮罩:一段演示「欠条该怎么写」的围栏例子里有那四个字加冒号,
      // 不过滤的话它替这个块交了差 —— 而漏报正是这道闸门放行的意思。
      // 头一版只够到**裸**围栏 —— 遮罩不认嵌在引用块里的围栏,而欠条块恰恰都是
      // 引用块,等于这道闸门留着一条绕过去的路。洞在 `quoted.ts`,已在那边补上
      const body = lines.slice(i, end).filter((_, k) => !quoted[i + k]).join('\n')
      if (!CONDITION.test(body)) {
        out.push({ file, line: i + 1, notation: '重启条件', text: plain(line) })
      }
    })
  }
  return out
}

/**
 * 报告里那一行。
 *
 * 怎么数、分几栏报都是判定，所以和 `coverageSummary` 一样留在判定模块里 ——
 * 留在入口的话没有任何一条测试够得着（`docs/CONVENTIONS.md` 第 10 条）。
 * 末尾那句限定不是客套：**这份清单不知道哪条已经还了**，去掉它，读的人会把
 * 条数当成「还欠着这么多」。
 */
export function ledgerSummary(list: Entry[]): string {
  const n = (k: Notation) => list.filter(e => e.notation === k).length
  return `欠条台账 ${list.length} 条 · 重启条件 ${n('重启条件')} · ` +
         `重开讨论 ${n('重开讨论')} · 死亡条件 ${n('死亡条件')}` +
         ` —— 只抽取，不判已还、也不判这次改动踩到了谁`
}
