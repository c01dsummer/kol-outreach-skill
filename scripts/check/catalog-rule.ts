/**
 * 变异目录（`scripts/check/mutations.json`）的**唯一读法**：检查链里每一处要读变异目录的地方，都先把读到的文字交给
 * `readCatalog`，拿到的才是一份可以按编号用的目录（ADR-242）。
 *
 * 为什么只开一个口：原先七八处各读各的，编号唯一由每一处自己先拒或写成前提，新加一处读的地方忘了拒，
 * 同号两条的结果就会互相覆盖、没人发现（ADR-202 末尾「变异编号的唯一性没有统一阶段」那张欠条，ADR-34 那一类）。
 * 成熟的做法是「读进来就整份判过，判过的才交出去」，不是让每个用的地方各查一遍。口外有没有人绕开，
 * 由 `catalog-door-rule.ts` 在需求测试里按语法树查。
 *
 * 只判所有读者都用得上的那一层：读得出 JSON、`mutations` 是数组、每一条是带字符串 `id` 的对象、编号不重复、
 * `exemptions` 缺着或是数组。各读者自己要的字段（`file`、`find`、`req`、`why`、`kills`……）照旧由各自的判定核，
 * 这里不替它们核：拿不准它们各自缺了算什么。
 */
import { duplicateIds } from './attribution-rule.js'

/** 变异目录在仓库里的位置（从仓库根写起）。字面只许写在这里，见 `catalog-door-rule.ts` */
export const MUTATION_CATALOG = 'scripts/check/mutations.json'

/** 一条变异：读口只保证有字符串 `id`，其余字段原样交出 */
export type CatalogEntry = { id: string } & Record<string, unknown>

export type CatalogFault =
  | { kind: 'unreadable'; why: string }
  | { kind: 'shape'; why: string }
  | { kind: 'duplicate'; ids: string[] }

export type CatalogRead =
  | { ok: true; mutations: CatalogEntry[]; exemptions: unknown[] }
  | { ok: false; fault: CatalogFault }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * 把读到的文字判成一份目录。`text` 是 `undefined` 表示文件读不到（不在、或 `git show` 问不到）。
 * 判的先后：读不出 → 形状不对 → 编号重复；编号重复排最后，因为没有一组带 `id` 的对象就谈不上重复。
 */
export function readCatalog(text: string | undefined): CatalogRead {
  if (text === undefined) return { ok: false, fault: { kind: 'unreadable', why: '读不到这个文件' } }
  let json: unknown
  try { json = JSON.parse(text) } catch (e) {
    return { ok: false, fault: { kind: 'unreadable', why: `不是 JSON（${e instanceof Error ? e.message : String(e)}）` } }
  }
  if (!isRecord(json)) return { ok: false, fault: { kind: 'shape', why: '最外层不是一个对象' } }
  const muts = json.mutations
  if (!Array.isArray(muts)) return { ok: false, fault: { kind: 'shape', why: 'mutations 不是数组' } }
  const bad = muts.findIndex(m => !isRecord(m) || typeof m.id !== 'string')
  if (bad >= 0) return { ok: false, fault: { kind: 'shape', why: `mutations 第 ${bad + 1} 项不是带字符串 id 的对象` } }
  const exemptions = json.exemptions
  if (exemptions !== undefined && !Array.isArray(exemptions)) return { ok: false, fault: { kind: 'shape', why: 'exemptions 不是数组' } }
  const entries = muts as CatalogEntry[]
  const ids = duplicateIds(entries)
  if (ids.length > 0) return { ok: false, fault: { kind: 'duplicate', ids } }
  return { ok: true, mutations: entries, exemptions: exemptions ?? [] }
}

/** 一句话说出读口拒收的原因，给各入口照抄进自己的报错 */
export function catalogFaultText(fault: CatalogFault): string {
  if (fault.kind === 'duplicate') return `变异目录里编号重复：${fault.ids.join('、')}`
  return `变异目录${fault.kind === 'unreadable' ? '读不出' : '形状不对'}：${fault.why}`
}
