/**
 * 「从没被负片弄红过的断言」那份清单的判定（ADR-240）。
 *
 * 变异集证的是「每条负片都被抓到」；反过来那一句 —— 每条有名字的断言都至少被一条负片弄红过 ——
 * 原先没人查，一条永远为真的断言发现不了（ADR-70 那张欠条）。做法照变异测试工具的成熟做法：
 * Stryker 给每条测试记「抓到过 / 跑到了没抓到 / 没跑到」三态，要完整那份时关掉「红了就停」
 * （`disableBail`）去跑；PIT 的 `fullMutationMatrix` 同理。本仓库对应的两件事：
 *
 * - 每跑一次变异，把每一条负片那一次红过哪些有名字的断言记下来（`creditedReds`），落一份记录；
 * - 记录的读法、拼法与清单怎么算（`readRedsPart`、`mergeParts`、`neverRed`），在 `never-red.ts` 那个入口用。
 *
 * 平时的检查照常「点名的都红了就停」（见齐就停），那样停下的那一次后面的断言没跑到，清单会多报；
 * 记录里带着这一跑停没停，清单头上照实说。准的那份由每周不提前停的那一跑出（`MUTATE_NO_EARLY_STOP=1`，
 * `.github/workflows/never-red.yml`）。需求所有者 2026-11-23 选的就是这个分法。
 *
 * 全是纯函数：读盘、起进程、打印都在入口。
 */
import type { Outcome } from './jobs-rule.js'

/** 记录放在哪个目录；分份跑时一份一个文件 */
export const REDS_DIR = 'output/mutation-reds'
/** 记录的格式名：读的一侧只认这一个 */
export const REDS_SCHEMA = 'mutation-reds/v1'
/** 这个目录里哪些文件算记录：整跑一份 `reds.json`，分份时 `reds-<k>-of-<n>.json` */
export const REDS_PART_NAME = /^reds(?:-([1-9]\d*)-of-([1-9]\d*))?\.json$/

/** 第 `index` 份（共 `count` 份）的记录叫什么。只跑一份就是整份 */
export function redsPartName(index: number, count: number): string {
  return count === 1 ? 'reds.json' : `reds-${index}-of-${count}.json`
}

/**
 * 「提前停」开关怎么读。没写是照常提前停；写 `1` 是不提前停、每一条都跑到底；别的值读不出来，交回 `undefined`，
 * 由入口拒跑 —— 写了个读不出来的值就当没写，跑出来的是哪一种记录就说不清了。
 */
export function earlyStopWanted(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return true
  return raw === '1' ? false : undefined
}

/**
 * 一次运行里算「红过」的那几条有名字的断言，排好序、不重复。
 *
 * **认法与 `kills` 同一条**（`mutate-rule.ts` 的 `killsMatched`）：一行去掉前导空白后以 `✗ ` 开头，
 * 后面要么正好是名字，要么是名字接一个全角冒号（`✗ 名字：细节`）。名字只认清册里的（`labelsOf` 按语法树收的那份）：
 * 带记号的那几句（`✗ 名字（进程）：…`）对不上任何名字，派生的散文诊断也进不来。
 *
 * **只有「抓到」与「红错了地方」那两档算数** —— 那两档里断言是真的跑了并且红了。跑不起来那一档出过
 * 进程级或夹具级的失败，那一次的红不是任何一条断言的功劳（ADR-70）；存活与锚点失效那两档本来就没有断言红。
 */
export function creditedReds(outcome: Outcome, output: string, inventory: ReadonlyMap<string, number>): string[] {
  if (outcome !== 'caught' && outcome !== 'elsewhere') return []
  const found = new Set<string>()
  for (const line of output.split('\n')) {
    const rest = line.trimStart()
    if (!rest.startsWith('✗ ')) continue
    const body = rest.slice(2)
    if (inventory.has(body)) found.add(body)
    for (let at = body.indexOf('：'); at >= 0; at = body.indexOf('：', at + 1)) {
      const head = body.slice(0, at)
      if (inventory.has(head)) found.add(head)
    }
  }
  return [...found].sort()
}

/** 一条负片在这一跑里的记录 */
export interface RedsRecord {
  id: string
  /** 由哪个验证者来验（`test` 或 `selfcheck`） */
  by: string
  /** 只跑了验证者的哪几组；没有这一项是整跑 */
  only?: string[]
  /** 这一次是不是因为点名的都红了被提前停下 —— 停了的话，后面的断言没跑到 */
  stopped: boolean
  /** 红过的有名字的断言（`creditedReds`） */
  red: string[]
}

/** 一份记录：一跑（或一跑里的一份）写一个 */
export interface RedsPart {
  schema: string
  /** 这一跑验的是哪个提交（完整 40 位） */
  head: string
  /** 这一跑开没开「点名的都红了就停」 */
  earlyStop: boolean
  /** 这是第几份、共几份；整跑是 1 / 1 */
  shard: { index: number; count: number }
  records: RedsRecord[]
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')

/**
 * 读回一份记录。**每一个字段都验**，认不出交回 `{ fault }`，不替它补、不兜底 ——
 * 一份少了 `red` 的记录被读成「这一条什么都没弄红」，清单就多报，而多报的那几条看上去和真没红过的一模一样。
 */
export function readRedsPart(raw: unknown): RedsPart | { fault: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { fault: '不是一个对象' }
  const r = raw as Record<string, unknown>
  if (r.schema !== REDS_SCHEMA) return { fault: `格式名不是 ${REDS_SCHEMA}` }
  if (typeof r.head !== 'string' || !/^[0-9a-f]{40}$/.test(r.head)) return { fault: 'head 不是完整的 40 位提交号' }
  if (typeof r.earlyStop !== 'boolean') return { fault: 'earlyStop 不是真假值' }
  const s = r.shard as Record<string, unknown> | null
  if (s === null || typeof s !== 'object' || !Number.isInteger(s.index) || !Number.isInteger(s.count)
    || (s.count as number) < 1 || (s.index as number) < 1 || (s.index as number) > (s.count as number)) {
    return { fault: 'shard 不是 1 ≤ 第几份 ≤ 共几份 的两个整数' }
  }
  if (!Array.isArray(r.records)) return { fault: 'records 不是一组记录' }
  const records: RedsRecord[] = []
  for (const [i, x] of r.records.entries()) {
    const e = x as Record<string, unknown> | null
    if (e === null || typeof e !== 'object' || typeof e.id !== 'string' || e.id === '' || typeof e.by !== 'string'
      || typeof e.stopped !== 'boolean' || !isStrings(e.red) || (Object.hasOwn(e, 'only') && !isStrings(e.only))) {
      return { fault: `第 ${i + 1} 条记录缺字段或字段类型不对` }
    }
    records.push({ id: e.id, by: e.by, ...(Object.hasOwn(e, 'only') ? { only: [...e.only as string[]] } : {}),
      stopped: e.stopped, red: [...e.red] })
  }
  return { schema: REDS_SCHEMA, head: r.head, earlyStop: r.earlyStop,
    shard: { index: s.index as number, count: s.count as number }, records: records }
}

/** 几份记录拼回一跑 */
export interface MergedReds {
  head: string
  earlyStop: boolean
  records: RedsRecord[]
  /** 其中被提前停下的有几条 */
  stopped: number
}

/**
 * 几份记录拼回一跑，并核它就是**这一份变异目录**的一整跑。对不上交回 `{ fault }`：
 *
 * - 一份都没有；文件名与它自己写的第几份对不上；
 * - 几份的提交、停不停、共几份不一致；第几份缺了或重了；
 * - 同一条负片记了两次；目录里有的没记（派出去没回话的那种）、记了的目录里没有。
 *
 * 少一条就不出清单：那一条弄红过的断言会被算成没红过，而清单上分不出哪几条是这么来的。
 */
export function mergeParts(parts: readonly { name: string; part: RedsPart }[], catalogIds: readonly string[]):
  MergedReds | { fault: string } {
  if (parts.length === 0) return { fault: '一份记录都没有 —— 先跑一遍 npm run mutate' }
  const first = parts[0].part
  for (const { name, part } of parts) {
    if (name !== redsPartName(part.shard.index, part.shard.count)) return { fault: `${name} 里写的是第 ${part.shard.index}/${part.shard.count} 份，文件名对不上` }
    if (part.head !== first.head) return { fault: `${name} 验的提交与 ${parts[0].name} 不是同一个` }
    if (part.earlyStop !== first.earlyStop) return { fault: `${name} 与 ${parts[0].name} 一份提前停、一份不停` }
    if (part.shard.count !== first.shard.count) return { fault: `${name} 与 ${parts[0].name} 分的份数不一样` }
  }
  const indices = parts.map(p => p.part.shard.index).sort((a, b) => a - b)
  const want = Array.from({ length: first.shard.count }, (_, i) => i + 1)
  if (JSON.stringify(indices) !== JSON.stringify(want)) {
    return { fault: `共 ${first.shard.count} 份，手上的是第 ${indices.join('、')} 份` }
  }
  const records = parts.flatMap(p => p.part.records)
  const seen = new Set<string>()
  for (const r of records) {
    if (seen.has(r.id)) return { fault: `${r.id} 记了不止一次` }
    seen.add(r.id)
  }
  const catalog = new Set(catalogIds)
  const missing = catalogIds.filter(id => !seen.has(id))
  if (missing.length) return { fault: `变异目录里有 ${missing.length} 条没有记录（头一条 ${missing[0]}）` }
  const extra = records.filter(r => !catalog.has(r.id))
  if (extra.length) return { fault: `${extra.length} 条记录在变异目录里找不到（头一条 ${extra[0].id}）` }
  return { head: first.head, earlyStop: first.earlyStop, records: records, stopped: records.filter(r => r.stopped).length }
}

/** 清单上的一条：从没红过的那条断言，它在哪一组，有没有任何一条负片跑到过它那一组 */
export interface NeverRed {
  label: string
  /** 所在的组；不在任何一组里的没有这一项 */
  group?: string
  /**
   * 有没有一条负片跑到过它：有一条整跑的就算都跑到了；否则要有一条选了它那一组。
   * 不在任何一组里的，只有整跑的负片跑得到它。没跑到的，再多负片也弄不红它 —— 两种分开报
   */
  reached: boolean
}

/**
 * 一个验证者的清单：清册里（`labels`，名字 → 所在的组）哪几条从没在这个验证者的记录里红过。
 * 先按组、再按名字排，读的时候同一组的挨在一起。
 */
export function neverRed(labels: ReadonlyMap<string, string | undefined>, records: readonly RedsRecord[]): NeverRed[] {
  const red = new Set(records.flatMap(r => r.red))
  const whole = records.some(r => r.only === undefined)
  const groups = new Set(records.flatMap(r => r.only ?? []))
  const out: NeverRed[] = []
  for (const [label, group] of labels) {
    if (red.has(label)) continue
    const reached = whole || (group !== undefined && groups.has(group))
    out.push(group === undefined ? { label, reached } : { label, group, reached })
  }
  // 按码位比，不按语言习惯比：同一份清册在哪台机器上排出来都一样
  const cmp = (x: string, y: string): number => x < y ? -1 : x > y ? 1 : 0
  return out.sort((a, b) => cmp(a.group ?? '', b.group ?? '') || cmp(a.label, b.label))
}
