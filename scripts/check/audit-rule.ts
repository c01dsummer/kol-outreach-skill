/**
 * 链路审计里能被测的那些判定 —— 抽出来的理由同 `lint-rule.ts`:留在入口里就永远测不到
 * (`docs/CONVENTIONS.md` 第 10 条)。三半,各管各的:
 *
 * 1. **检查链自己**算不算数:哪些文件是判定模块、哪些没有变异守着
 *    (`judgmentModules` / `unguarded`)。下面这一整段讲的都是这一半。
 * 2. **计量输入怎么分**:现行的参与计量、作废的只参与展示
 *    (`ledger` / `deprecatedBlock`)。理由写在 `ledger` 自己头上,不在这里重复。
 * 3. **报告上那几个数怎么数**:哪些变异是判据级的、验收判据那一行三份名单各数各的
 *    (`criterionMutations` / `coverageSummary`)。理由各写在它们自己头上。
 *
 * 这一半守的是 `process/4-VERIFY.md` 那句「检查链自己也在这张清单里」:一条没有测试、也没有
 * 变异守着的检查,和没有检查之间的差别只有心理作用。审计原先只对产品红线强制
 * 「有测试 + 有变异」,闸门自己的需求不在登记表里 —— 于是 PR #7 那套判定的第三拍
 * 是评审看见的,不是检查看见的(ADR-59 里的欠条,ADR-62 还上)。
 *
 * ## 什么算「判定模块」
 *
 * `scripts/check/` 下**不带 shebang** 的 `.ts`。带 shebang 的是入口(走文件树、跑 git、
 * 打印、退出码),按 `docs/CONVENTIONS.md` 第 10 条它们不该装判定,也就没有可变异的东西;
 * 其余每一个文件的存在理由都是「有一段判定要能被测」—— 那它就得有变异证明那些测试
 * 真的会红。
 *
 * **不按文件名后缀(`*-rule.ts`)认**:`trailer.ts`、`quoted.ts` 都是判定,不叫 rule。
 * 一条靠命名约定成立的检查,换个名字就绕过去了。
 *
 * 显式豁免要写理由,和 `selfcheck.ts` 的 `EXEMPT` 同一个形状。
 *
 * ## 只要求「有变异」,不另查「有测试」
 *
 * `npm run mutate` 要求每个变异被抓到,而它只把「断言红了」算抓到 —— 测试进程崩掉不算
 * (`mutate-rule.ts`)。所以有变异被抓到,就有一条真的红过的测试。
 * 反过来「有测试」自己证明不了什么(`4-VERIFY.md`:绿不证明这条测试还能失败),所以不单列。
 *
 * 这个文件自己也在名单上:M-H13-a~e 守着它;`mutate-rule.ts` 由 M-H14-a 守着。
 * 少了这一步,这条检查就是它自己要拦的那种东西。
 */

import { active, type Req } from './spec-rule.js'

export const JUDGMENT_EXEMPT: Record<string, string> = {
  'scripts/check/fake-fetch.ts': '自检用的假响应,不是判定 —— 它决定自检能走多深,由 selfcheck 自己的断言守着',
}

export interface CheckFile { path: string; entry: boolean }

/** 判定模块 = 检查目录下不是入口、也没有豁免的文件。 */
export function judgmentModules(files: CheckFile[]): string[] {
  return files.filter(f => !f.entry && !(f.path in JUDGMENT_EXEMPT)).map(f => f.path).sort()
}

/** 没有任何变异指向它的判定模块。 */
export function unguarded(modules: string[], mutations: { file: string }[]): string[] {
  const guarded = new Set(mutations.map(m => m.file))
  return modules.filter(m => !guarded.has(m))
}

/**
 * 变异里**记在判据名下**的那些编号。
 *
 * `req` 这一栏两种编号混着写 —— 今天 21 种需求号、3 种判据号 —— 而审计的「变异」
 * 那一列只拿需求号去查。判据号那几条因此**对报告完全不可见**:`M-P5-a` 守着 P5.f、
 * `M-P5-i` 与 `M-P5-l` 守着 P5.g、`M-P5-j` 守着 P5.h,四条变异一个字都没露过。
 *
 * 分开的判据是**带不带点**(`docs/requirements.json` 里判据号就长 `P5.f` 这样)。
 * 两种编号都由 `attributionFault` 对着登记表校过,写岔了跑不起来 ——
 * 所以这里只管分类,不管真假。
 *
 * 留在 `audit.ts` 里的话没有任何一条测试够得着(评审指出):把这个条件反过来、
 * 或者干脆交个空集合,单元测试与那十一条新变异**照样全绿**,而报告悄悄退回
 * 「判据级的负片一个字都没有」——**实测过**,不是推测。`docs/CONVENTIONS.md` 第 10 条。
 */
export function criterionMutations(mutations: { req: string }[]): Set<string> {
  return new Set(mutations.map(m => m.req).filter(id => id.includes('.')))
}

/**
 * 审计的计量输入。**现行的参与计量,作废的只参与展示。**
 *
 * 抽出来的理由和上面两个一样,而且更硬:作废的需求算进覆盖率的分母,
 * 「还差多少」就变成一个虚报的数,人会去补一条已经不做的事的测试。
 * 这是判定,不是打印 —— 按 `docs/CONVENTIONS.md` 第 10 条它不该待在 `audit.ts` 里。
 *
 * **两半一起给,不分两次算**:只过滤不展示,作废的需求就从审计里彻底消失了,
 * 「这条为什么不见了」查不到出处;两边各自 filter 一遍,迟早出现两种口径。
 */
export interface Ledger {
  /** 参与计量:覆盖率、红线统计都只数这些 */
  live: Req[]
  /** 只参与展示:编号保留,不回收复用 */
  deprecated: Req[]
}

export function ledger(all: Req[]): Ledger {
  return { live: active(all), deprecated: all.filter(r => r.deprecated) }
}

/**
 * 「已作废」那一段的正文。空数组 = 这一段不印。
 *
 * 取代者是可选的 —— 作废不等于一定有继任,没有就只印作废于哪一版。
 */
export function deprecatedBlock(dead: Req[]): string[] {
  return dead.map(r => `~~${r.id}~~ ${r.deprecated!.since}` +
                       `${r.deprecated!.superseded_by ? ` → ${r.deprecated!.superseded_by}` : ''}`)
}

/** 认领名单:`Set` 与 `Map` 都算 —— 这里只问「在不在里面」。 */
interface Claimed { has(id: string): boolean }

/**
 * 验收判据那一行汇总。**三个名单各数各的,数错了报告上看得见、审计照样全绿。**
 *
 * 测试认领与显式豁免分开报 —— 豁免是显式缺口,不是测试证据。合起来报「认领 N」,
 * 一份审计的两个数(逐条与汇总)会对不上,而且把缺口装成了证据(P2.a / P3.b 没有运行时认领)。
 * 入口认领也单开一栏,同一个理由:一条单元断言与一条端到端夹具证的不是同一件事。
 *
 * 留在 `audit.ts` 里的话没有任何一条测试够得着(`criterionMutations` 那条记录的同一个形状):
 * 把入口认领那个数改成从单元那份名单里数、或者把红线那半数成全体,报告上的数字当场变了,
 * 而单元测试与全部变异照样全绿。`docs/CONVENTIONS.md` 第 10 条。
 *
 * ⚠️ 它守的是**数得对不对**,不是**喂得对不对**:交进来的名单由 `audit.ts` 挑,
 * 挑错了(比如交个空集合)这里一个字也看不见 —— 那一半是入口的接线,ADR-70 记着欠条。
 */
export function coverageSummary(
  all: readonly { id: string }[], redline: readonly { id: string }[],
  tested: Claimed, entry: Claimed, exempt: Claimed,
): string {
  const n = (crit: readonly { id: string }[], pick: (id: string) => boolean): number =>
    crit.filter(c => pick(c.id)).length
  // 三栏**互不重叠**,加起来不超过总数:同一条判据两边都认领时算在测试那一栏,
  // 豁免只数那些两边都没认领的。原先三栏各问各的,P3.b 拿到入口认领之后
  // 「入口认领 1 · 显式豁免 2」把它数了两遍,红线 17 条的三栏加出 18 来 ——
  // 而逐条那一头已经把它算成认领了,一份报告两种说法(落地 3 第二片)。
  const entryOnly = (id: string): boolean => entry.has(id) && !tested.has(id)
  const gapOnly = (id: string): boolean =>
    exempt.has(id) && !tested.has(id) && !entry.has(id)
  return `验收判据 ${all.length} 条 · 有测试认领 ${n(all, id => tested.has(id))}`
       + ` · 入口认领 ${n(all, entryOnly)}`
       + ` · 其中红线 ${redline.length} 条（测试认领 ${n(redline, id => tested.has(id))}`
       + ` · 入口认领 ${n(redline, entryOnly)}`
       + ` · 显式豁免 ${n(redline, gapOnly)}）`
}
