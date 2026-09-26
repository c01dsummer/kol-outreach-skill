/**
 * 自检夹具的分组与选跑 —— 从 `selfcheck.ts` 里抽出来的那一半判定。
 *
 * `selfcheck.ts` 是入口（起进程、打印、退出码）；**「这一跑该跑哪几组」是判定**
 * —— 它决定这次自检看得见多少东西，而「扫描范围被悄悄缩小和判定写错一样致命」
 * （`docs/CONVENTIONS.md` 第十节，那句话原本是写给体量闸门的，这里同理）。
 * 抽出来的理由和那边一样：判定有语义就该能被测。
 */

/** 一组夹具：`id` 是点名用的，`needs` 是它**真跑起来才成立**的前置组 */
export interface Group { id: string; needs: readonly string[] }

/**
 * 这一跑要跑哪几组。
 *
 * **不点名就是全跑**（交回 `undefined`）—— 缺省行为逐字如旧，这是这条改动
 * 敢动这个文件的前提。点了名就跑**点名的那些 ＋ `needs` 的传递闭包**。
 *
 * ⚠️ **闭包不是调度提示，是正确性。** 一组没跑，用它产出的那几组读到的是初始值
 * （实测：`记忆读不出来` 那一整节被 `if (dir && rendered !== undefined)` 守着，
 * 缺了前置组就**整节静默跳过** —— 不报错、不打任何东西，而指着它的负片会
 * 「跑完、没红」，仿佛被验过了）。
 *
 * ⚠️ **点了不存在的组要当场抛，不能静默跑成空集。** 一个名字写错的 `--only`
 * 会让这一跑什么也不验、还以退出码 0 结束 —— 那正是本仓库反复栽的那种假绿。
 */
export function wanted(groups: readonly Group[], only?: readonly string[]): Set<string> | undefined {
  if (only === undefined) return undefined
  const byId = new Map(groups.map(g => [g.id, g]))
  if (byId.size !== groups.length) {
    throw new Error('夹具组 id 重复')
  }
  for (const g of groups) for (const need of g.needs) {
    if (!byId.has(need)) throw new Error(`组 ${g.id} 缺少依赖组 ${need}`)
  }
  const unknown = only.filter(id => !byId.has(id))
  if (unknown.length) {
    throw new Error(`--only 点了不存在的组：${unknown.join('、')}`
      + `\n  有的是：${groups.map(g => g.id).join('、')}`)
  }
  const out = new Set<string>()
  const walk = (id: string): void => {
    if (out.has(id)) return
    out.add(id)
    for (const n of byId.get(id)!.needs) walk(n)
  }
  for (const id of only) walk(id)
  return out
}

/** `--only=a,b` 里那几个名字；没写这个参数交回 `undefined`（＝全跑） */
export function parseOnly(argv: readonly string[]): string[] | undefined {
  const hit = argv.find(a => a.startsWith('--only='))
  if (hit === undefined) return undefined
  // 空的 `--only=` 交回空数组而不是 `undefined` —— 两者都是错，但错法不一样：
  // 空数组是「一组都不跑」；这个旧解析契约仍由测试与原有负片保留，
  // `undefined` 是「全跑」，静默变成另一件事。**这里不抛**，判定只管把两者分开，
  // 由入口去定性 —— 抛在这儿的话 `wanted` 就得替调用方决定空集算不算错。
  return hit.slice('--only='.length).split(',').filter(s => s !== '')
}

/**
 * 自检与需求测试入口共用的严格参数解析。`parseOnly` 保留旧解析契约；这里拒绝
 * 会把「我没选对」解释成「少跑了一些也通过」的拼写错误。
 */
export function parseOnlyStrict(argv: readonly string[], allowed: readonly string[] = []): string[] | undefined {
  const named = argv.filter(a => a.startsWith('--only='))
  const invalid = argv.filter(a => !a.startsWith('--only=') && !allowed.includes(a))
  if (invalid.length) throw new Error(`需求测试不认识参数：${invalid.join('、')}`)
  if (named.length > 1) throw new Error('需求测试只能写一次 --only=')
  if (!named.length) return undefined
  const ids = named[0].slice('--only='.length).split(',')
  if (ids.some(id => id === '' || id.trim() !== id)) {
    throw new Error('--only= 必须写非空、无首尾空格的组 id，逗号两侧不能留空')
  }
  if (new Set(ids).size !== ids.length) throw new Error('--only= 不能重复点同一组')
  return ids
}
