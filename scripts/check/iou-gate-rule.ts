/**
 * 新登记欠条的闸门：判定（ADR-167 第四节第 4 小节，第 9、10 片）。入口是 `iou-gate.ts`，接在检查链里。
 *
 * 数什么：周回访列给需求所有者、他还没判的欠条（到期清单里「列过没判」那一段，`dueList` 交回的 `again`）。
 * 每周最多列 `DUE_LIMIT` 张、没判的下周照列不换，所以这个数最多就是那么多：门槛取「满」而不是「超过」，
 * 满了说明这一周列出去的一张都没判（「超过 10 张」永远到不了，闸门永远不红 —— 需求所有者 2026-11-26 选了「满 10 张就红」）。
 *
 * 只在一种情形红：这条改动新加了以登记为去向的欠条块，而主干上列过没判的满了。新加的块认：
 * - 块头与台账同一个认法（`debt-rule.ts` 的 `IOU_HEAD`），围栏与注释里的示例不算（`freshBlocks` 照台账遮掉），
 * - 档（流程固定格式里紧挨重启条件的那一格）写的是「登记」，或者「本改动」而且同一格里写了「不阻塞」、轮次是第三轮起或者没写轮次；
 * - 没照固定格式写档的，也算（需求所有者定）。
 * 档写扩范围、既有缺陷的不拦（那两档有自己的去向）；只写状态行的改动加的是「⚠️ 已还／收尾／已重挂／续挂」行，不是欠条块，不拦。
 * 回访 PR 不拦（它就是来列欠条、落状态行的）；主干上只报数（合进来了，拦不回去）。
 */

import { IOU_HEAD, iouBlocks } from './debt-rule.js'
import { quotedMask } from './quoted.js'
import { type DueItem, dueList, listings } from './revisit-rule.js'

/** 列过没判的满了这个数就拦（需求所有者 2026-10-23 定 10，四周后按回访数据再调） */
export const GATE_LIMIT = 10

const DIGITS = '一二三四五六七八九'

/** 轮次：阿拉伯数字，或一到九十九的汉字（「第三轮」「第十二轮」）；认不出交回 undefined */
export function roundOf(tier: string): number | undefined {
  const m = /第\s*(\d+|[一二三四五六七八九十]+)\s*轮/.exec(tier)?.[1]
  if (m === undefined) return undefined
  if (/^\d+$/.test(m)) return Number(m)
  const parts = m.split('十')
  if (parts.length > 2) return undefined
  const [tens, ones] = parts.length === 2 ? parts : ['', parts[0]]
  if (tens.length > 1 || ones.length > 1) return undefined
  const t = parts.length === 2 ? (tens === '' ? 1 : DIGITS.indexOf(tens) + 1) : 0
  const o = ones === '' ? 0 : DIGITS.indexOf(ones) + 1
  return t * 10 + o
}

/**
 * 欠条块里的档：只认流程（`process/6-INTEGRATE.md`「登记怎么做」）定死的那一行格式里、紧挨在重启条件前面的那一格
 * —— `… · 档：<档> · 重启条件：<条件>`。这样的两格恰好一处才交回档；没有或不止一处（说明或条件里抄了这种写法）
 * 都交回 undefined，分不出哪一处是真的，不猜，照没照格式写算（需求所有者 2026-11-26 定，算登记）
 */
export function tierOf(line: string): string | undefined {
  const pairs = [...line.matchAll(/ · 档[：:]\s*([^·]+?) · 重启条件[：:]/g)]
  return pairs.length === 1 ? pairs[0][1] : undefined
}

/**
 * 欠条块里档那一格的全部合法写法，与流程（`process/6-INTEGRATE.md`「登记怎么做」）里那张表逐字对上：
 * 五个档名之一，或本改动后面括号里写「第 N 轮，不阻塞」「轮次核不出，不阻塞」。整格比，括号里不收别的字；
 * 表外的写法当成没照格式写（需求所有者 2026-11-26 定）
 */
const TIERS = /^(?:登记|扩范围|既有缺陷|驳回|本改动|本改动\s*[(（](?:第\s*(?:\d+|[一二三四五六七八九十]+)\s*轮|轮次核不出)\s*[,，]\s*不阻塞[)）])$/

/** 一行是不是新开的、以登记为去向的欠条块；没照固定格式写档的、档名不是流程里那几个的，按需求所有者定的算登记 */
export function registersIou(line: string): boolean {
  if (!IOU_HEAD.test(line)) return false
  const tier = tierOf(line)
  if (tier === undefined || !TIERS.test(tier.trim())) return true
  if (/^登记/.test(tier)) return true
  if (!/^本改动/.test(tier) || !tier.includes('不阻塞')) return false
  // 第一、二轮里判不阻塞的仍算修在本改动；写了轮次的从第三轮起算登记，轮次核不出的也算
  const round = roundOf(tier)
  return round === undefined || round >= 3
}

/** 一块的整段文字：块头连同续行，续行去掉行首的引用号，空白并成一个空格 —— 档与重启条件写到第二行也认得 */
function blockText(lines: readonly string[], start: number, end: number): string {
  return lines.slice(start, end).map((l, k) => k === 0 ? l : l.replace(/^\s*>?/, '')).join(' ').replace(/\s+/g, ' ').trim()
}

/** 一份份记录里的欠条块（围栏、注释里的不算），按文件名排好，交回每块的整段文字 */
function blocksOf(docs: ReadonlyMap<string, string>): string[] {
  return [...docs.keys()].sort().flatMap(file => {
    const text = docs.get(file) ?? ''
    const lines = text.split('\n')
    return iouBlocks(lines, quotedMask(text)).map(b => blockText(lines, b.start, b.end))
  })
}

/**
 * 这条改动新加的欠条块：改动后的记录里有、改动前的记录里没有的块（按整段文字比，一张对一张地抵）。
 * 只是挪了地方的块（挪进历史文件、换一节）整段文字没变，抵掉，不算新加；改了块里文字的，当新加的算
 */
export function freshBlocks(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string[] {
  const left = new Map<string, number>()
  for (const b of blocksOf(before)) left.set(b, (left.get(b) ?? 0) + 1)
  return blocksOf(after).filter(b => {
    const n = left.get(b) ?? 0
    if (n === 0) return true
    left.set(b, n - 1)
    return false
  })
}

/** 周回访的 PR：分支名以 `claude/revisit-` 起头（`docs/REVISIT.md`「一天只开一条」定的分支名）；取不到分支名的不算 */
export function revisitBranch(ref: string | undefined): boolean {
  return ref !== undefined && ref.startsWith('claude/revisit-')
}

/** 回访台账全文：挪进历史文件的旧块在前、主文件在后，与周回访读到期清单同一个读法；一份份记录的键是仓库里的路径 */
export function revisitLedger(docs: ReadonlyMap<string, string>): string {
  const pick = (dir: string) => [...docs.keys()].filter(f => f.startsWith(dir) && /^ADR-152-[^/]*\.md$/.test(f.slice(dir.length))).sort()
  return [...pick('docs/adr/历史/'), ...pick('docs/adr/')].map(f => docs.get(f)).join('\n')
}

/** 列给需求所有者、他还没判的张数：周回访到期清单里「列过没判」那一段，与回访同一个数法（列过没判的不看到没到期） */
export function waitingOf(items: DueItem[], docs: ReadonlyMap<string, string>, today: string): number {
  return dueList(items, today, listings(revisitLedger(docs))).again
}

export interface GateInput {
  /** 这条改动新加的欠条块的整段文字（`freshBlocks` 交回的） */
  added: readonly string[]
  /** 主干上列过没判的张数。要数一遍到期清单（几十秒），所以只在这条改动真有新登记、又不是回访 PR 时才问 */
  waiting: () => number
  /** 是不是周回访的 PR */
  revisit: boolean
  /** 是不是在主干上跑：改动已经合进来了，拦也拦不回去，只报数 */
  trunk: boolean
  /** 门槛，不给用 `GATE_LIMIT` */
  limit?: number
}

/** 判定：红不红，与要打的几行。红时第一行以「✗ 」起头，点名新加的每一块，并写明作者的三条路 */
export function iouGate(input: GateInput): { red: boolean; lines: string[] } {
  const limit = input.limit ?? GATE_LIMIT
  const fresh = input.added.filter(registersIou)
  if (input.revisit) return { red: false, lines: [`新登记闸门（只报数）：回访 PR 不拦；这条改动新登记 ${fresh.length} 张`] }
  if (fresh.length === 0) return { red: false, lines: ['新登记闸门（只报数）：这条改动没有新登记的欠条，不用数列过没判的'] }
  const waiting = input.waiting()
  const head = `列给需求所有者、他还没判的欠条 ${waiting} 张（满 ${limit} 张就不许新登记）`
  if (input.trunk) return { red: false, lines: [`新登记闸门（只报数）：${head}；主干上不拦，这次合进来新登记 ${fresh.length} 张`] }
  if (waiting < limit) return { red: false, lines: [`新登记闸门（只报数）：${head}；这条改动新登记 ${fresh.length} 张，没满，放行`] }
  return {
    red: true,
    lines: [
      `✗ 新登记闸门：${head}，这条改动又新登记了 ${fresh.length} 张：`,
      ...fresh.map(l => `  ${l}`),
      '  三条路任选：把这条发现修在本改动；照扩范围或既有缺陷排队；或者等需求所有者判完列给他的那几张、状态行落下之后再登记',
    ],
  }
}
