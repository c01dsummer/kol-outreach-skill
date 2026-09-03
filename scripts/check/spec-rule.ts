/**
 * 需求登记表的判定 —— 从 `spec-sync.ts` 里抽出来的那一半。
 *
 * 抽出来的理由与 `lint-rule.ts` / `why-rule.ts` 同：有语义就该能被测，
 * 能被测就不该待在入口脚本里（`docs/CONVENTIONS.md` 第 10 条）。
 * 读文件、回写、打印、退出码仍留在 `spec-sync.ts`。
 *
 * 这里管两件事:
 *
 * 1. **形状** —— 渲染要读的字段必须在、且类型对。缺了不会报错,会把空值写进生成的文档
 * 2. **完整性** —— 编号唯一、交点指向真实存在的编号、决策记录编号真实存在、作废须有理由
 */
import { quotedMask } from './quoted.js'

export interface Tension {
  /** 与哪条需求相拉扯 */
  with: string
  /** 裁决是什么。**写结论,不写「需要讨论」** */
  ruling: string
  /** 哪条决策记录裁的。红线交点通常有；写在别处（如约定文档）的可以没有 */
  adr?: string
}

export interface Deprecated {
  since: string
  why: string
  /** 被哪条取代。没有取代者就留空 —— 作废不等于一定有继任 */
  superseded_by?: string
}

/**
 * 一条**可独立判定**的验收判据。
 *
 * 拆分粒度的判据:**两半会不会被不同的代码路径独立满足、或独立弄坏。**
 * 会 → 两条;不会（同一个函数同一个分支产出的）→ 一条。
 * 机械地按标点切会造出一堆没有独立含义的碎片,那和不拆一样没用。
 *
 * 编号是 `{需求编号}.{字母}`,和需求编号一样**稳定、不回收复用** ——
 * 下游按它认领覆盖,含义一变,认领就指向了别的东西。
 */
export interface Criterion {
  id: string
  text: string
}

export interface Req {
  id: string
  cat: string
  pri: string
  text: string
  /**
   * 验收标准。**是一组判据,不是一段话** ——
   * 一段话里的「与」「且」在计量上是一条,在事实上是两条:
   * 一条需求报「有测试」,而它验收标准的后半句可以从来没实现过（ADR-24）。
   */
  accept: Criterion[]
  /**
   * 让这条需求变成今天这个样子的决策记录。
   *
   * **这是反向链接** —— 决策记录里的「冲击的需求」是正向的，审计据它回答
   * 「需求被引用了吗」，却回答不了「这句话是哪次决策的结果」。
   * 只列**塑造了这条文本**的，不列所有提到它的。
   */
  adr?: string[]
  /**
   * 与哪些需求在某个交点上互相拉扯。
   *
   * 声明在**让步的那一方**（通常是非红线那条），不双向声明 ——
   * 两处各写一遍，迟早会出现两种说法。
   */
  tension?: Tension[]
  /** 作废。**编号保留，不回收复用** —— 复用会让历史记录指向错误的东西 */
  deprecated?: Deprecated
}

/**
 * 红线所在的分类。**下游全按它分流** —— 渲染、审计的红线集合、
 * 「每条红线必须有测试和变异」那道硬要求，都从这个值算出来。
 */
export const REDLINE_CAT = 'P'

/** 现行的（未作废的）需求 —— 覆盖率、红线统计都只算这些 */
export const active = (reqs: Req[]): Req[] => reqs.filter(r => !r.deprecated)

/**
 * 登记表的**形状**。关系检查（编号唯一、交点指向真实存在的编号……）全都
 * 假定字段在、且类型对 —— 而登记表是 `JSON.parse` 出来的,`Req` 那个接口
 * 在运行时**一个字段都不拦**。
 *
 * 判据不是「我想得到哪些字段」,是**渲染实际会读哪些字段**:漏一个,
 * 渲染就把 `undefined` 写进生成出来的表格,`--write` 原样存下,
 * 而一致性检查比的是生成结果和生成结果 —— 于是全绿(ADR-33)。
 *
 * 缺 `why` / `ruling` / `text` 这类会当场抛 TypeError,吵是吵了点,至少不是
 * 静默的;**真正危险的是 `pri` 和 `deprecated.since` 这种只被渲染、不被检查的** ——
 * 它们安安静静地变成文档里的 `undefined`。
 */
function shapeProblems(reqs: Req[]): string[] {
  const bad: string[] = []
  const str = (v: unknown, at: string, what: string) => {
    if (typeof v !== 'string' || !v.trim()) bad.push(`${at} 的 ${what} 不是非空字符串`)
  }
  for (const [i, r] of reqs.entries()) {
    const at = typeof r?.id === 'string' && r.id ? r.id : `第 ${i + 1} 条需求`
    if (r === null || typeof r !== 'object' || Array.isArray(r)) {
      bad.push(`${at} 不是对象`)
      continue
    }
    for (const f of ['id', 'cat', 'pri', 'text'] as const) str(r[f], at, f)
    if (!Array.isArray(r.accept)) {
      bad.push(`${at} 的 accept 不是数组 —— 验收标准是一组判据,不是一段话`)
    } else {
      for (const [j, c] of r.accept.entries()) {
        const crit = `${at} 的第 ${j + 1} 条判据`
        if (c === null || typeof c !== 'object' || Array.isArray(c)) { bad.push(`${crit}不是对象`); continue }
        str(c.id, crit, 'id')
        str(c.text, crit, 'text')
      }
    }
    if (r.adr !== undefined && (!Array.isArray(r.adr) || r.adr.some(a => typeof a !== 'string'))) {
      bad.push(`${at} 的 adr 不是字符串数组`)
    }
    if (r.tension !== undefined) {
      if (!Array.isArray(r.tension)) bad.push(`${at} 的 tension 不是数组`)
      else for (const [j, t] of r.tension.entries()) {
        const tat = `${at} 的第 ${j + 1} 个交点`
        if (t === null || typeof t !== 'object' || Array.isArray(t)) { bad.push(`${tat}不是对象`); continue }
        str(t.with, tat, 'with')
        str(t.ruling, tat, 'ruling')
        if (t.adr !== undefined) str(t.adr, tat, 'adr')
      }
    }
    if (r.deprecated !== undefined) {
      const d = r.deprecated
      if (d === null || typeof d !== 'object' || Array.isArray(d)) bad.push(`${at} 的 deprecated 不是对象`)
      else {
        str(d.since, at, 'deprecated.since')
        str(d.why, at, 'deprecated.why')
        if (d.superseded_by !== undefined) str(d.superseded_by, at, 'deprecated.superseded_by')
      }
    }
  }
  return bad
}

/**
 * 登记表的完整性。返回问题清单,空数组表示干净。
 *
 * `adrIds` 是决策记录里真实存在的编号 —— 由调用方从 `docs/adr/` 各文件解析后传进来,
 * 这个模块不读盘。`cats` 是分类表里声明过的前缀。
 */
export function validateRegistry(reqs: Req[], adrIds: Set<string>, cats: string[]): string[] {
  // 形状先过。下面每一处 `.trim()` / `.length` / `for...of` 都假定字段在,
  // 形状不对时接着往下走只会抛 TypeError,把真正的问题盖掉。
  const shape = shapeProblems(reqs)
  if (shape.length) return shape

  const problems: string[] = []
  const ids = new Set<string>()
  for (const r of reqs) {
    if (ids.has(r.id)) problems.push(`${r.id} 编号重复 —— 编号是稳定标识,不许出现两次`)
    ids.add(r.id)
    // 分类表里没有的 cat,渲染时会被整条跳过 —— 而**一致性检查比的是
    // 生成结果和生成结果**,漏掉的那条与它自己完全一致,于是全绿通过。
    // 登记表与它号称的那份渲染,从此装着不一样的需求(ADR-21)。
    if (!cats.includes(r.cat)) {
      problems.push(`${r.id} 的分类 ${r.cat} 不在分类表里 —— 它不会出现在渲染出来的文档里`)
    } else if (!new RegExp(`^${r.cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d+$`).test(r.id)) {
      // 分类**声明过**但与编号前缀不符,是更难看见的一种:两个值各自合法,
      // 而下游全都按 cat 分流 —— 一条红线被挪进别的分类,审计就不再要求它
      // 有测试和变异,并且会报出比项目声明的更少的红线条数,然后照样通过(ADR-23)。
      problems.push(`${r.id} 的编号前缀与分类 ${r.cat} 不一致 —— 下游按分类分流,它会被当成另一类需求`)
    }
  }

  const declared = new Set<string>()
  for (const r of reqs) {
    for (const a of r.adr ?? []) {
      if (!adrIds.has(a)) problems.push(`${r.id} 的 adr 指向不存在的决策记录 ${a}`)
    }
    for (const t of r.tension ?? []) {
      if (t.with === r.id) problems.push(`${r.id} 声明与自己相拉扯`)
      else if (!ids.has(t.with)) problems.push(`${r.id} 的交点指向不存在的编号 ${t.with}`)
      const fwd = `${r.id}|${t.with}`
      if (declared.has(fwd)) {
        // 同一个方向声明两次:两条裁决可能互相矛盾,而运行时**一次**认领
        // 会同时算到两行头上 —— 一个测试证明了两条相反的裁决(ADR-26)。
        problems.push(`${r.id} 与 ${t.with} 的交点声明了两次 —— 两条裁决可能互相矛盾，而一次认领会同时算数`)
      }
      const back = `${t.with}|${r.id}`
      if (declared.has(back)) {
        problems.push(`${r.id} 与 ${t.with} 的交点被两边各声明了一次 —— 只写在让步的那一方`)
      }
      declared.add(fwd)
      if (!t.ruling.trim()) problems.push(`${r.id} 与 ${t.with} 的交点没写裁决`)
      if (t.adr && !adrIds.has(t.adr)) {
        problems.push(`${r.id} 与 ${t.with} 的交点指向不存在的决策记录 ${t.adr}`)
      }
    }
    // 验收标准必须是一组可独立判定的判据。判据编号与需求编号同规矩:
    // 稳定、不回收复用 —— 下游按它认领覆盖,含义一变认领就指向别的东西。
    if (!r.accept.length) problems.push(`${r.id} 没有验收判据 —— 想不出怎么算满足,说明需求没想清楚`)
    const seenCrit = new Set<string>()
    for (const c of r.accept) {
      if (!new RegExp(`^${r.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[a-z]+$`).test(c.id)) {
        problems.push(`${r.id} 的判据编号 ${c.id} 不是 ${r.id}.x 的形式`)
      }
      if (seenCrit.has(c.id)) problems.push(`判据编号 ${c.id} 重复 —— 编号不许出现两次`)
      seenCrit.add(c.id)
      if (!c.text.trim()) problems.push(`${c.id} 没有内容`)
    }
    if (r.deprecated) {
      // **红线不许被作废。** `active()` 会把作废的挡在渲染和审计之外,于是
      // 一条红线被标作废,红线条数静静少一条,它的测试、变异、交点要求
      // 全部随之消失 —— 而检查报「全部通过」。这和「分类填成另一个合法分类」
      // 是同一个静默削减,只是换了一扇门(ADR-30)。
      //
      // 作废一条红线,意思是「这个代价用户不再承担了」—— 那是产品定义变了,
      // 该走的是重新定义红线集合并留下决策记录,不是给一条需求加个字段。
      if (r.cat === REDLINE_CAT) {
        problems.push(`${r.id} 是红线,不许作废 —— 红线少一条是产品定义变了,` +
                      `要走变更评定并留下决策记录,不是加个字段`)
      }
      if (!r.deprecated.why.trim()) problems.push(`${r.id} 已作废但没写为什么`)
      if (r.deprecated.superseded_by && !ids.has(r.deprecated.superseded_by)) {
        problems.push(`${r.id} 的取代者 ${r.deprecated.superseded_by} 不存在`)
      }
    }
  }
  return problems
}

/**
 * 决策记录里提到的需求编号必须真实存在 —— 它是「编号不回收复用」查得了的那一半。
 *
 * 编号形状**从分类前缀派生**,不写死。写死成「一个大写字母加数字」的话,
 * 换一个用两字母前缀的项目,这条检查会安静地一条都匹配不到 ——
 * 一个永远通得过的检查和没有检查一样(`process/1-REQUIREMENTS.md`)。
 */
export function danglingAdrRefs(
  decisions: string, ids: Set<string>, prefixes: string[],
): string[] {
  if (!prefixes.length) return []
  const shape = new RegExp(`\\b(?:${prefixes.join('|')})\\d+\\b`, 'g')
  const out: string[] = []
  for (const line of decisions.split('\n')) {
    const m = /^- 冲击的需求[:：](.*)$/.exec(line.trim())
    if (!m) continue
    for (const id of m[1].match(shape) ?? []) {
      if (!ids.has(id)) out.push(`决策记录提到不存在的需求编号 ${id}`)
    }
  }
  return [...new Set(out)]
}

/**
 * 决策记录里真实存在的编号。**两级标题都认**：`##` 是整册里的写法，`#` 是拆成
 * 一文件一条之后的写法（`adr-sync.ts` 的 `RECORD_HEADING` 同一约定）。
 *
 * 只认**引文之外**的标题（围栏块、HTML 注释都算引文，与 `adr-sync.ts` 同一把遮罩）。
 * 记录正文里爱举例写 `# ADR-99 示例`；不遮住它，一条需求引用 ADR-99 就会被当成
 * 真实存在而放过 ——「决策记录编号真实存在」这条检查便只是嘴上说说（评审第一轮）。
 */
export function adrIdsIn(decisions: string): Set<string> {
  const mask = quotedMask(decisions)
  const out = new Set<string>()
  decisions.split('\n').forEach((line, i) => {
    const m = /^#{1,2}\s+(ADR-\d+)/.exec(line)
    if (m && !mask[i]) out.add(m[1])
  })
  return out
}
