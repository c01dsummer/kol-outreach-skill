/**
 * 新登记欠条的闸门：判定（ADR-167 第四节第 4 小节，第 9 片）。本片只做判定，不接进检查链（接入是第 10 片）。
 *
 * 数什么：周回访列给需求所有者、他还没判的欠条（到期清单里「列过没判」那一段，`dueList` 交回的 `again`）。
 * 每周最多列 `DUE_LIMIT` 张、没判的下周照列不换，所以这个数最多就是那么多：门槛取「满」而不是「超过」，
 * 满了说明这一周列出去的一张都没判（「超过 10 张」永远到不了，闸门永远不红 —— 需求所有者 2026-11-26 选了「满 10 张就红」）。
 *
 * 只在一种情形红：这条改动新加了以登记为去向的欠条块，而主干上列过没判的满了。新加的块认：
 * - 以「⚠️ 欠条」起头的引用行（`> ⚠️ 欠条…`），
 * - 档写的是「登记」，或者「本改动」而且同一格里写了「不阻塞」、轮次是第三轮起或者没写轮次（第三轮起不阻塞、合并者判不阻塞的那一种）。
 * 档写扩范围、既有缺陷的不拦（那两档有自己的去向）；只写状态行的改动加的是「⚠️ 已还／收尾／已重挂／续挂」行，不是欠条块，不拦。
 * 回访 PR 不拦（它就是来列欠条、落状态行的）。
 */

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

/** 欠条块里写档的那一格：重启条件之前、紧跟在「·」或开括号后面的「档：」，有几格取最后一格；正文里顺口提到的、重启条件里写的「档：」不算 */
export function tierOf(line: string): string {
  const head = line.split(/重启条件[：:]/)[0]
  const cells = [...head.matchAll(/(?:·|（|\()\s*档[：:]\s*([^·）)]*)/g)]
  return cells.length === 0 ? '' : cells[cells.length - 1][1]
}

/** 一行是不是新开的、以登记为去向的欠条块 */
export function registersIou(line: string): boolean {
  if (!/^\s*>\s*⚠️\s*欠条/.test(line)) return false
  const tier = tierOf(line)
  if (/^登记/.test(tier)) return true
  if (!/^本改动/.test(tier) || !tier.includes('不阻塞')) return false
  // 第一、二轮里判不阻塞的仍算修在本改动；写了轮次的从第三轮起算登记，轮次核不出的也算
  const round = roundOf(tier)
  return round === undefined || round >= 3
}

export interface GateInput {
  /** 这条改动新加的行（不含删掉的；文件里原有、只是挪了位置的不算新加，由调用方按差异取） */
  added: readonly string[]
  /** 主干上列过没判的张数 */
  waiting: number
  /** 是不是周回访的 PR */
  revisit: boolean
  /** 门槛，不给用 `GATE_LIMIT` */
  limit?: number
}

/** 判定：红不红，与要打的几行。红时第一行以「✗ 」起头，点名新加的每一块，并写明作者的三条路 */
export function iouGate(input: GateInput): { red: boolean; lines: string[] } {
  const limit = input.limit ?? GATE_LIMIT
  const fresh = input.added.filter(registersIou)
  const head = `列给需求所有者、他还没判的欠条 ${input.waiting} 张（满 ${limit} 张就不许新登记）`
  if (input.revisit) return { red: false, lines: [`新登记闸门（只报数）：${head}；回访 PR 不拦`] }
  if (fresh.length === 0) return { red: false, lines: [`新登记闸门（只报数）：${head}；这条改动没有新登记的欠条`] }
  if (input.waiting < limit) return { red: false, lines: [`新登记闸门（只报数）：${head}；这条改动新登记 ${fresh.length} 张，没满，放行`] }
  return {
    red: true,
    lines: [
      `✗ 新登记闸门：${head}，这条改动又新登记了 ${fresh.length} 张：`,
      ...fresh.map(l => `  ${l.replace(/^\s+/, '')}`),
      '  三条路任选：把这条发现修在本改动；照扩范围或既有缺陷排队；或者等需求所有者判完列给他的那几张、状态行落下之后再登记',
    ],
  }
}
