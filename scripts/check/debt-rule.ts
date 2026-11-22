/**
 * 欠条台账 —— 把散在 `docs/adr/` 里的「什么时候回来」抽成一份可列的清单，并读出人写的状态行。
 *
 * **它读人写的那一行，不判条件。** 一张欠条开着还是关上，看的是有没有一行
 * `⚠️ 已还／收尾／已重挂／续挂：ADR-N …` 指着它（写法见 `process/6-INTEGRATE.md`「登记怎么做」第 3 条）；
 * 条件成没成立、这次改动踩到了谁，它一概不判 —— 那两件要读懂条件本身，而「读懂」是会随模型变强的
 * 那一侧，一张正则表不是。撤掉匹配那一半的理由记在 ADR-86，连同实测：一条写着「下一条往
 * `SELFCHECK_TOOLS` 里加东西的 PR」的欠条，照字面做那件事，diff 的 ± 行里那个词出现 **0** 次。
 * 读状态行是 ADR-167（欠条台账机制）第一片，那一节写着为什么它仍在「替代跑的建」这一侧。
 *
 * 扫的范围是**调用方交进来的那些文件**，判据里写的范围也只到这里为止。
 * 两个调用方交的都是 `adrDocs` 读进来的那一批：`audit.ts` 第 6 节与只读入口 `adr-ledger.ts`。
 * 欠条块的定界（`iouBlocks`）还另有一个用处：被引表（`cite-rule.ts`）拿它把块里的引用单列；
 * 状态行的认法（`isStatusLine`）也给它，状态行里的引用同样单列。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { quotedMask } from './quoted.js'

/** 决策记录目录。`audit.ts` 还拿它把决策记录排出下游引用的语料（那一段写着为什么）。 */
export const ADR_DIR = 'docs/adr/'

/**
 * 读进 `dir` 下的全部 `*.md`（含子目录）。键是 `dir` 接上文件在它下面的相对路径 ——
 * 不给 `dir`、在仓库根上跑时，就是全表每行开头那个 `docs/adr/…`。
 *
 * 审计与只读入口读的是**同一批**，所以读哪些文件也在这里、不在两个入口里：各走各的目录的话，
 * 一边多收或少收一份，两份台账就对不上，而 ADR-151 第二节第 1 条问的正是两边逐条相同。
 * 扫描范围被悄悄缩小和判定写错一样致命（`docs/CONVENTIONS.md` 第 10 条），所以它算判定。
 */
export function adrDocs(dir: string = ADR_DIR): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.md')) out.set(p, readFileSync(p, 'utf8'))
    }
  }
  walk(dir)
  return out
}

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
 * 欠条块：块头那一行，与它的下界（不含）。孤儿闸门与被引表（`cite-rule.ts`）用的是这一份定界 ——
 * 被引表要把欠条块里的引用单列（ADR-151 第一节 P2），各定一份界的话，同一张欠条在两边可能不一样长。
 *
 * 块的下界是这样推的：块头带 `>` 的，连续到第一个非 `>` 行；不带的，到第一个
 * 空行。**这个定界是本模块定的，仓库里没有写着分隔符** —— ADR-86 逐块核过的那 88 个块
 * 排版是齐的，排版一变这个判据就跟着错，而且不总是错在报错那一侧：两张欠条之间没隔开
 * （带 `>` 的中间没有一行非 `>`、不带的缺一个空行）时，前一张并进后一张、借到后一张的条件，
 * 孤儿闸门那边就是**放过**（ADR-151 的欠条「两张欠条没隔开时前一张借后一张的条件」）；被引表那边只是块里的引用挪进或挪出主计数。
 */
export function iouBlocks(lines: string[], quoted: boolean[]): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = []
  lines.forEach((line, i) => {
    if (quoted[i] || !IOU_HEAD.test(line)) return
    const quotedBlock = line.trimStart().startsWith('>')
    let end = i + 1
    while (end < lines.length &&
           (quotedBlock ? lines[end].trimStart().startsWith('>') : lines[end].trim() !== '')) end++
    out.push({ start: i, end })
  })
  return out
}

/**
 * 写了欠条却没写重启条件的块 —— 硬失败。
 *
 * `docs/SYNC.md:56` 说 `docs/adr/` 里「带重启条件的欠条不算待办」，反过来就是：
 * 不带重启条件的那些是纯待办，而待办不该住在决策记录里。这条纪律在 ADR-86
 * 逐块核过时是 88 个块 88 个都执行住了的 —— **所以这道闸门落地时就是绿的，
 * 它拦的是往后的滑坡，不是现状。** 块怎么定界见 `iouBlocks`。
 */
export function orphanIous(docs: Map<string, string>): Entry[] {
  const out: Entry[] = []
  for (const [file, text] of docs) {
    const lines = text.split('\n')
    const quoted = quotedMask(text)
    for (const { start: i, end } of iouBlocks(lines, quoted)) {
      // 块内也要过遮罩:一段演示「欠条该怎么写」的围栏例子里有那四个字加冒号,
      // 不过滤的话它替这个块交了差 —— 而漏报正是这道闸门放行的意思。
      // 头一版只够到**裸**围栏 —— 遮罩不认嵌在引用块里的围栏,而欠条块恰恰都是
      // 引用块,等于这道闸门留着一条绕过去的路。洞在 `quoted.ts`,已在那边补上
      const body = lines.slice(i, end).filter((_, k) => !quoted[i + k]).join('\n')
      if (!CONDITION.test(body)) {
        out.push({ file, line: i + 1, notation: '重启条件', text: plain(lines[i]) })
      }
    }
  }
  return out
}

/**
 * 欠条的短名字：块头的「⚠️ 欠条」后面紧跟一对书名号，`⚠️ 欠条「短名字」：…`（「欠条」两字可以加粗）。
 * 状态行与别的欠条按名字指过来（`⚠️ 已还：ADR-N「短名字」`），不再按行号 —— 主文件重写成现行结论、
 * 过程挪进历史文件以后，行号全变，名字不变（ADR-211，主文件只放现行结论那一份）。
 *
 * 只认紧跟在「⚠️ 欠条」后面的那一对：块头别处提到的「接着某某的欠条「甲」」不是这张的名字 ——
 * 认了它，没起名字的这张就冒名顶替了「甲」，按名字关上「甲」时它也跟着不提醒。
 * 所以从行首认起，和认块头的 `IOU_HEAD` 同一个起头：块头第一个「⚠️ 欠条」后面没有书名号，就是没起名字，
 * 哪怕说明里又提到一个带名字的「⚠️ 欠条「甲」」。
 * 名字最长 `NAME_LIMIT` 个字；没起名字的老欠条交回 null，照旧只能按行号指。
 */
export const IOU_NAME = /^>?\s*\*{0,2}⚠️\s*\*{0,2}欠条\*{0,2}\s*「([^」\n]*)」/
const IOU_NAME_OPEN = /^>?\s*\*{0,2}⚠️\s*\*{0,2}欠条\*{0,2}\s*「/
export const NAME_LIMIT = 40
export function iouName(head: string): string | null {
  const m = IOU_NAME.exec(head)
  const name = m ? m[1].trim() : ''
  return name && [...name].length <= NAME_LIMIT ? name : null
}

/**
 * 块头起了名字、却取不出来时的原因：书名号没收尾、名字是空的、超过上限。取得出或根本没起名字交回 null。
 * 取不出来不能静默当成没名字：写的人以为起了名字，按名字写的状态行却永远关不上它，重名查验也跳过它。
 */
export function iouNameFault(head: string): string | null {
  if (!IOU_NAME_OPEN.test(head)) return null
  const m = IOU_NAME.exec(head)
  if (!m) return '书名号没收尾'
  const name = m[1].trim()
  if (!name) return '名字是空的'
  if ([...name].length > NAME_LIMIT) return `名字超过 ${NAME_LIMIT} 个字`
  return null
}

/** 「记录 + 短名字」的键。欠条那一侧与状态行那一侧都用这一个，免得两边各拼一份、拼法一变就对不上。 */
export const recordKey = (num: number, name: string): string => `ADR-${num}「${name}」`

/** 历史文件：`docs/adr/历史/` 下的那一份（ADR-211，主文件只放现行结论那一份）。 */
export const isHistory = (file: string): boolean => /(?:^|\/)历史\/ADR-\d+-[^/]*$/.test(file)

/** 哪几条记录拆过了：有历史文件的那些编号。 */
export function splitRecords(docs: Map<string, string>): Set<number> {
  const out = new Set<number>()
  for (const file of docs.keys()) if (isHistory(file)) out.add(recordNum(file)!)
  return out
}

/** 文件属于哪条记录：主文件 `docs/adr/ADR-86-….md` 与历史文件 `docs/adr/历史/ADR-86-….md` 都是 86；不是编号记录的文件交回 null。 */
export function recordNum(file: string): number | null {
  const m = /(?:^|\/)ADR-(\d+)-[^/]*$/.exec(file)
  return m ? Number(m[1]) : null
}

/**
 * 短名字写坏了的欠条 —— 硬失败，三种：
 * - 起了名字却取不出来（见 `iouNameFault`）；
 * - 拆过的记录，主文件里的欠条没起名字：主文件重写过，按行号的状态行不算到它头上，没名字就永远关不上；
 * - 同一条记录里两张用了同一个名字：状态行按名字指过来时分不清是哪一张，关上一张等于把另一张也当成关了。
 *   主文件和它的历史文件算同一条记录：欠条挪进历史后名字还在用。报的是后出现的那一张（按文件路径、再按行排）。
 * 交回的条目 `text` 以原因开头。
 */
export function iouNameFaults(docs: Map<string, string>): Entry[] {
  const seen = new Set<string>()
  const out: Entry[] = []
  const split = splitRecords(docs)
  for (const [file, text] of [...docs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const num = recordNum(file)
    if (num === null) continue
    const lines = text.split('\n')
    for (const { start } of iouBlocks(lines, quotedMask(text))) {
      const head = lines[start]
      const fault = iouNameFault(head)
      if (fault !== null) { out.push({ file, line: start + 1, notation: '重启条件', text: `${fault}：${plain(head)}` }); continue }
      const name = iouName(head)
      if (name === null) {
        if (split.has(num) && !isHistory(file)) out.push({ file, line: start + 1, notation: '重启条件', text: `拆过的记录，主文件里的欠条没起名字：${plain(head)}` })
        continue
      }
      const key = recordKey(num, name)
      if (seen.has(key)) out.push({ file, line: start + 1, notation: '重启条件', text: `和同一条记录里的另一张重名：${plain(head)}` })
      else seen.add(key)
    }
  }
  return out
}

/**
 * 欠条所在的块：起点最靠后的那个包住它的块。两张欠条没隔开时，前一张的块会一直延到后一张里面（`iouBlocks`
 * 写着这个定界的毛病），取第一个包住的块，后一张的条目就拿到前一张的短名字 —— 按名字关上前一张，后一张也跟着算关上。
 * 点名提醒（`debt-touch-rule.ts`）与台账的状态栏用的是这一份。
 */
export function blockAt(blocks: ReturnType<typeof iouBlocks>, i: number): ReturnType<typeof iouBlocks>[number] | undefined {
  return blocks.filter(b => b.start <= i && i < b.end).at(-1)
}

/**
 * 条目的行号键：`ADR-86:118`；不是编号记录的文件交回 null。老状态行写的「ADR-86 第 118 行」指的是
 * **写下它那一刻**那份文件的第 118 行，所以：
 * - 没拆过的记录：就是主文件那一行；
 * - 拆过的记录：旧正文原样搬进了历史文件，行号在那里不变 —— 键给历史文件的条目；主文件已经重写，
 *   它的条目没有行号键（交回 null），只能按短名字关。反过来的话，重写后主文件第 118 行恰好是另一张开着的欠条，
 *   一行老状态行就把它静默算成已关。
 */
export function entryKey(e: Entry, split: ReadonlySet<number> = new Set()): string | null {
  const num = recordNum(e.file)
  if (num === null) return null
  if (!isHistory(e.file) && split.has(num)) return null
  return `ADR-${num}:${e.line}`
}

/** 条目的名字键：所在欠条块的块头写了短名字时由 `recordKey` 拼，主文件与历史文件同一个键；没写名字交回 null。 */
export function nameKey(file: string, name: string | null): string | null {
  const num = recordNum(file)
  return num === null || name === null ? null : recordKey(num, name)
}

/** 状态行的四种。前三种关上一张欠条，续挂不关（`process/6-INTEGRATE.md`「登记怎么做」第 3、5 条）。 */
export type Status = '已还' | '收尾' | '已重挂' | '续挂'
export const CLOSED_KINDS: ReadonlySet<Status> = new Set<Status>(['已还', '收尾', '已重挂'])

/**
 * 状态行的两种指法：
 * - 老写法 `⚠️ 已还：ADR-N 第 M 行` 指到「记录 + 行号」，键写成 `ADR-N:M`（M 是台账每行开头那个行号）；
 * - 新写法 `⚠️ 已还：ADR-N「短名字」` 指到「记录 + 欠条的短名字」，键由 `recordKey` 拼（ADR-211，欠条用短名字互指那一份）。
 *   名字不随文件重写或挪进历史文件而变，所以新写的状态行都用这一种。
 * 一行里任何位置出现都认（和 2026-11 以前点名提醒认已关的口径一样）。别的写法 —— 散文里一句「已还」、
 * 「上文第 N 句那张欠条已还」、候选句记录的驳回块 —— 不认：它们指不到一条确定的条目。
 */
export const STATUS_BY_LINE = /⚠️\s*\*{0,2}(已还|已重挂|收尾|续挂)\*{0,2}\s*[：:]\s*ADR-(\d+)\s*第\s*(\d+)\s*行/g
export const STATUS_BY_NAME = /⚠️\s*\*{0,2}(已还|已重挂|收尾|续挂)\*{0,2}\s*[：:]\s*ADR-(\d+)\s*「([^」\n]+)」/g

export interface StatusLine {
  file: string
  line: number
  kind: Status
  /** 指到哪一张：`entryKey` 或 `nameKey` 的那种键 */
  key: string
  /** 这一行去掉 Markdown 装饰之后的原文 */
  text: string
}

/** 一行里写着的状态（两种指法都算），按出现先后。 */
function statusesIn(line: string): Array<{ kind: Status; key: string }> {
  return [
    ...[...line.matchAll(STATUS_BY_LINE)].map(m => ({ at: m.index, kind: m[1] as Status, key: `ADR-${Number(m[2])}:${Number(m[3])}` })),
    // 名字不在这里限长：取出来去掉首尾空白，和欠条那一侧（`iouName`）同一个拼法，长短由那一侧判
    ...[...line.matchAll(STATUS_BY_NAME)].map(m => ({ at: m.index, kind: m[1] as Status, key: recordKey(Number(m[2]), m[3].trim()) })),
  ].sort((a, b) => a.at - b.at).map(({ kind, key }) => ({ kind, key }))
}

/** 这一行是不是状态行（被引表拿它把状态行里的引用单列）。不管遮罩，遮罩由调用方先过。 */
export const isStatusLine = (line: string): boolean => statusesIn(line).length > 0

/**
 * 全部状态行，按文件路径、再按行排。围栏与 HTML 注释里的不算 —— ADR-167（欠条台账机制那一份）的历史文件
 * 自己就在围栏里演示了这几种写法。一行里写了两处的，各算一条。
 */
export function statusLines(docs: Map<string, string>): StatusLine[] {
  const out: StatusLine[] = []
  for (const [file, text] of [...docs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const lines = text.split('\n'), quoted = quotedMask(text)
    lines.forEach((line, i) => {
      if (quoted[i]) return
      for (const st of statusesIn(line)) out.push({ file, line: i + 1, kind: st.kind, key: st.key, text: plain(line) })
    })
  }
  return out
}

/** 台账一行的状态：开着（没有状态行指它）、续挂（只有续挂行指它，仍开着），或关上它的那一种。 */
export type RowStatus = '开着' | Status

export interface Row {
  entry: Entry
  /** 只有重启条件有状态；重开讨论与死亡条件不是欠条，没有这一栏（null） */
  status: RowStatus | null
}

export interface Ledger {
  rows: Row[]
  /** 指不到任何一条重启条件的状态行：只报出来、不红，它想关的那张照旧算开着 */
  unmatched: StatusLine[]
}

/**
 * 台账加状态栏：每条重启条件按「记录 + 行号」（`entryKey`）或「记录 + 短名字」（`nameKey`）找指着它的状态行。
 *
 * - 有一行已还、收尾或已重挂指着它：关上，状态取最先写下的那一行（按文件路径、再按行）；
 * - 只有续挂行指着它：续挂，仍算开着；
 * - 都没有：开着。
 *
 * 只配重启条件：状态行指的那一行是重开讨论、死亡条件或什么都不是，就算配不上，单列出来、不红 ——
 * 那张欠条照旧算开着，多列一条读的人排除得掉，少列一条没人会发现（ADR-86 第六节「不判已还」那条的理由，
 * ADR-167 历史文件第四节第 1 小节）。
 */
export function ledgerStatus(docs: Map<string, string>): Ledger {
  const split = splitRecords(docs)
  const all = statusLines(docs)
  const byKey = new Map<string, StatusLine[]>()
  for (const s of all) byKey.set(s.key, [...byKey.get(s.key) ?? [], s])
  const used = new Set<StatusLine>()
  const list: Row[] = []
  for (const [file, text] of docs) {
    const lines = text.split('\n')
    const blocks = iouBlocks(lines, quotedMask(text))
    for (const entry of entries(new Map([[file, text]]))) {
      if (entry.notation !== '重启条件') { list.push({ entry, status: null }); continue }
      const block = blockAt(blocks, entry.line - 1)
      const name = block ? iouName(lines[block.start]) : null
      const found = [entryKey(entry, split), nameKey(file, name)].flatMap(k => k === null ? [] : byKey.get(k) ?? [])
      for (const s of found) used.add(s)
      const closing = found.find(s => CLOSED_KINDS.has(s.kind))
      list.push({ entry, status: closing ? closing.kind : found.length ? '续挂' : '开着' })
    }
  }
  return { rows: list, unmatched: all.filter(s => !used.has(s)) }
}

/**
 * 报告里那一行。
 *
 * 怎么数、分几栏报都是判定，所以和 `coverageSummary` 一样留在判定模块里 ——
 * 留在入口的话没有任何一条测试够得着（`docs/CONVENTIONS.md` 第 10 条）。
 * 「开着」数的是重启条件，续挂的也算开着；已还、收尾、已重挂各报几条；配不上的状态行另报。
 * 末尾那句限定不是客套：**状态是人写的那一行，不是这份清单判的**，去掉它，读的人会把「开着」
 * 当成「条件还没响」、把「已还」当成「核过真还了」。
 */
export function ledgerSummary({ rows, unmatched }: Ledger): string {
  const n = (k: Notation) => rows.filter(r => r.entry.notation === k).length
  const s = (k: RowStatus) => rows.filter(r => r.status === k).length
  return `欠条台账 ${rows.length} 条 · 重启条件 ${n('重启条件')} · ` +
         `重开讨论 ${n('重开讨论')} · 死亡条件 ${n('死亡条件')}` +
         ` · 重启条件里开着 ${s('开着') + s('续挂')}（其中续挂 ${s('续挂')}） · 已还 ${s('已还')} · 收尾 ${s('收尾')} · 已重挂 ${s('已重挂')}` +
         ` · 配不上的状态行 ${unmatched.length}` +
         ` —— 状态照人写的状态行读，不判条件成没成立、也不判这次改动踩到了谁`
}

/**
 * 审计第 6 节的硬失败：孤儿欠条与短名字有错，一张一行。审计每行计一次硬失败。
 *
 * 留在审计入口里的话需求测试够不着 —— 删掉「短名字有错」那一段检查链照样全绿
 * （ADR-211 的欠条「两处入口接线没有测试」）。
 */
export function ledgerGaps(orphans: Entry[], badNames: Entry[]): string[] {
  return [
    ...orphans.map(o => `${o.file}:${o.line} 写了欠条却没写重启条件 —— `
      + '没有重启条件的登记不是登记，是免责声明（process/6-INTEGRATE.md）'),
    ...badNames.map(d => `${d.file}:${d.line} 欠条的短名字有错（${d.text}） —— `
      + '按名字写的状态行会关不上它，或分不清是哪一张（ADR-211，欠条用短名字互指那一份）'),
  ]
}

/**
 * 全表：每条一行（重启条件带状态栏）、配不上的状态行与孤儿、短名字有错的各另标一行、空一行、末尾汇总；
 * 有孤儿或短名字有错时另交回打在 stderr 的那一句。配不上的状态行不进那一句：只报、不红。
 *
 * 两个入口打的是这一份 —— `npm run audit -- --debts` 与只读入口 `npm run adr-ledger`。
 * 各写一份的话，改了一处忘了另一处，症状是「同一份台账，两个入口说两样」。
 * 退出码跟着 `err` 走：有它就以 1 退出，孤儿与短名字有错都是硬失败，只读入口也不放过。
 */
export function ledgerReport(ledger: Ledger, orphans: Entry[], badNames: Entry[] = []): {
  out: string[] // 字段不入断言：旧字段，只因这一句换了第一个参数的类型被算成新加；全表有测试按全文比，M-H41-e 改的就是它的内容
  err?: string // 字段不入断言：旧字段，同上；那一句有测试按全文比，M-H41-f 改的就是它的内容
} {
  const out = [
    ...ledger.rows.map(({ entry: e, status }) => `${e.file}:${e.line}  [${e.notation}]${status ? `  [${status}]` : ''}  ${e.text}`),
    ...ledger.unmatched.map(s => `${s.file}:${s.line}  [状态行配不上·${s.kind}]  ${s.text}`),
    ...orphans.map(o => `${o.file}:${o.line}  [孤儿·没写重启条件]  ${o.text}`),
    ...badNames.map(d => `${d.file}:${d.line}  [短名字有错]  ${d.text}`),
    '',
    `  ${ledgerSummary(ledger)}`,
  ]
  const errs = [
    ...orphans.length ? [`${orphans.length} 张欠条没写重启条件`] : [],
    ...badNames.length ? [`${badNames.length} 张欠条的短名字有错（重名或取不出）`] : [],
  ]
  return errs.length ? { out, err: `\n✗ 欠条台账：${errs.join('；')}` } : { out }
}
