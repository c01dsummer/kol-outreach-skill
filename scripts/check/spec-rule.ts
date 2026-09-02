/**
 * 需求登记表的判定 —— 从 `spec-sync.ts` 里抽出来的那一半。
 *
 * 抽出来的理由与 `lint-rule.ts` / `why-rule.ts` 同：有语义就该能被测，
 * 能被测就不该待在入口脚本里（`docs/CONVENTIONS.md` 第 10 条）。
 * 读文件、回写、打印、退出码仍留在 `spec-sync.ts`。
 *
 * 这里管三件事:
 *
 * 1. **渲染** —— 人类可读的表格由登记表生成，两者不可能漂移
 * 2. **内容指纹** —— 让「登记表改了」成为一个机器看得见的事件。
 *    它是**派生**的，由 `--write` 写、由检查校验，没有任何人需要记得改它
 * 3. **完整性** —— 编号唯一、交点指向真实存在的编号、决策记录编号真实存在
 */
import { createHash } from 'node:crypto'

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
 * 键序无关的规范化。**必须递归** —— `JSON.stringify` 的白名单参数是**逐层**生效的,
 * 拿顶层键当白名单会把嵌套字段整个抹掉:`tension` 会被序列化成 `[{}]`,
 * 交点的裁决改成相反的意思,指纹纹丝不动(ADR-18)。
 */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v !== null && typeof v === 'object') {
    const src = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src).sort()) out[k] = canonical(src[k])
    return out
  }
  return v
}

/**
 * 内容指纹。覆盖**需求与分类表**,不覆盖 updated_at 与指纹自己 ——
 * 否则它会自我循环。键顺序无关:磁盘上的键序由写下它的那一版代码决定,
 * 直接比较序列化结果会把键序差异误报成改动（ADR-13 踩过同一个坑）。
 */
export function contentHash(reqs: Req[], cats: Record<string, string>): string {
  // 分类表也进指纹：只改一个分类的说明，渲染出来的文档就变了，
  // 而指纹不动的话，「派生元数据」这四个字就名不副实了（ADR-22）。
  //
  // 用 **entries（数组）而不是对象**：`canonical` 会把对象的键排序，而渲染是按
  // **插入顺序**分节的 —— 只调换两个分类的先后，SPEC 的分节顺序就变了，
  // 而排序之后的指纹一动不动（ADR-28）。凡是影响渲染的东西都得进指纹，
  // 包括顺序。
  return createHash('sha256')
    .update(JSON.stringify(canonical({
      requirements: reqs, categories: Object.entries(cats),
    })))
    .digest('hex').slice(0, 12)
}

/** 表格渲染。作废的单独成节 —— 混在现行需求里会被当成还要做的事 */
export function renderTables(reqs: Req[], cats: Record<string, string>): string {
  const out: string[] = []
  const live = active(reqs)
  for (const [cat, label] of Object.entries(cats)) {
    const rows = live.filter(r => r.cat === cat)
    if (!rows.length) continue
    out.push(`### ${cat} · ${label}\n`)
    out.push('| 编号 | 优先级 | 需求 | 验收标准 |')
    out.push('|---|---|---|---|')
    for (const r of rows) {
      out.push(`| **${r.id}** | ${r.pri} | ${esc(r.text)} | ${renderAccept(r)} |`)
    }
    out.push('')
  }

  // 交点单独成节。裁决只躺在登记表的 json 里等于没写 ——
  // 读 SPEC 的人才是需要知道「这两条撞上时以谁为准」的人。
  const tensions = live.flatMap(r => (r.tension ?? []).map(t => ({ from: r.id, t })))
  if (tensions.length) {
    out.push('### 需求之间的交点 —— 不属于任何一条，所以单独列\n')
    out.push('| 交点 | 撞上时以谁为准 | 裁决记在哪 |')
    out.push('|---|---|---|')
    for (const { from, t } of tensions) {
      out.push(`| **${from}** × **${t.with}** | ${esc(t.ruling)} | ${t.adr ?? '见裁决正文'} |`)
    }
    out.push('')
  }

  const dead = reqs.filter(r => r.deprecated)
  if (dead.length) {
    out.push('### 已作废 —— 编号保留，不回收复用\n')
    out.push('| 编号 | 作废于 | 原来要什么 | 为什么作废 | 由谁取代 |')
    out.push('|---|---|---|---|---|')
    for (const r of dead) {
      const d = r.deprecated!
      out.push(`| ~~${r.id}~~ | ${d.since} | ${esc(r.text)} | ${esc(d.why)} | ` +
               `${d.superseded_by ? `**${d.superseded_by}**` : '无'} |`)
    }
    out.push('')
  }
  return out.join('\n')
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

/** 判据带着编号渲染 —— 下游要引用的是判据编号,看不见就没法引用 */
const renderAccept = (r: Req) =>
  r.accept.map(c => `**${c.id}** ${esc(c.text)}`).join('<br>')

/**
 * 登记表的**形状**。关系检查（编号唯一、交点指向真实存在的编号……）全都
 * 假定字段在、且类型对 —— 而登记表是 `JSON.parse` 出来的,`Req` 那个接口
 * 在运行时**一个字段都不拦**。
 *
 * 判据不是「我想得到哪些字段」,是**渲染实际会读哪些字段**:漏一个,
 * `renderTables` 就把 `undefined` 写进生成出来的表格,`--write` 原样存下,
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
 */
export function adrIdsIn(decisions: string): Set<string> {
  return new Set([...decisions.matchAll(/^#{1,2}\s+(ADR-\d+)/gm)].map(m => m[1]))
}

/** 一条需求在审计里的裁定 —— 旗标、缺口、是否硬失败 */
export interface Verdict {
  flag: '✓' | '⊘' | '·' | '✗'
  gaps: string[]
  hard: number
  claimed: number
}

/** 审计判定的输入。**全是已经算好的事实**,这个模块不读盘、不扫源码。 */
export interface Evidence {
  /** 这条需求有没有被测试认领 */
  tested: boolean
  /** 有没有变异守着 */
  mutated: boolean
  /** 整条需求是否显式豁免变异 */
  exempt: boolean
  /** 落到实处的引用数（架构文档说了不算） */
  impl: number
  /** 任何形式的引用数 */
  refs: number
  /** 真正跑过的判据编号 */
  claimedCriteria: ReadonlySet<string>
  /** 显式豁免的编号（需求级与判据级共用一张表） */
  exemptIds: ReadonlySet<string>
}

/**
 * 一条需求该得什么旗标、报哪些缺口。
 *
 * 从 `audit.ts` 抽出来的理由与 `lint-rule` / `why-rule` / 上面那几个函数同：
 * 有语义就该能被测。这条路踩过三次 —— 而**审计自己的判定连着两轮出问题**
 * （注释掉的认领照样算数、一条判据都没认领反而干净），
 * 那两次都没有任何测试或变异守得住（ADR-26）。
 */
export function requirementVerdict(r: Req, e: Evidence): Verdict {
  const gaps: string[] = []
  let flag: Verdict['flag'] = '✓'
  let hard = 0
  const claimed = r.accept.filter(c => e.claimedCriteria.has(c.id))
  const unclaimed = r.accept.filter(c =>
    !e.claimedCriteria.has(c.id) && !e.exemptIds.has(c.id))

  if (r.cat === REDLINE_CAT) {
    if (!e.tested) { flag = '✗'; hard++; gaps.push(`${r.id} 是红线但没有测试`) }
    else if (!e.mutated && !e.exempt) {
      flag = '✗'; hard++
      gaps.push(`${r.id} 有测试但没有变异验证 —— 那条测试没被证明过`)
    } else if (e.exempt) flag = '⊘'
    // 红线的判据**逐条**都要有认领 —— 整条需求「有测试」不代表每一条判据都有
    for (const c of unclaimed) {
      flag = '✗'; hard++
      gaps.push(`${c.id} 是红线的验收判据但没有测试认领：${c.text.slice(0, 40)}…`)
    }
  } else {
    if (!e.impl && !e.tested) {
      flag = '·'
      gaps.push(e.refs
        ? `${r.id} 仅被架构文档引用，未落到代码或测试`
        : `${r.id} 未在任何下游文件中被引用`)
    }
    // **一条都没认领同样是缺口。** 原先只报「认领了一部分」的那种,于是
    // 「一条都没认领」反而干干净净 —— 把仅有的那条认领删掉,缺口就消失了。
    // **一个删掉证据就能变绿的检查,是在奖励删证据。**
    if (unclaimed.length) {
      flag = '·'
      gaps.push(`${r.id} 有 ${unclaimed.length}/${r.accept.length} 条判据没有测试认领：` +
                unclaimed.map(c => c.id).join(' '))
    }
  }
  return { flag, gaps, hard, claimed: claimed.length }
}
