/**
 * 外部工单号闸门的**判定** —— 仓库里的文字只往里指，不往外指（ADR-205）。
 *
 * 外部任务工具（本仓库是 Linear）的卡可以写决策记录编号；仓库里的文字不写卡号，也不放指向一张卡的链接
 * （需求所有者 2026-11-15）。旧决策记录追加不删改，里面已经有的号只能留着（对照见 ADR-204），
 * 于是这里不判「有没有」，判「有没有多」：每个文件里认得出的号与基线比，**只许减、不许加**；
 * 基线上没有的文件（新文件、改了名的文件）必须一个都没有。基线与体量闸门是同一个起点
 * （`size-rule.ts` 的 `resolveBaseline`）：分支上是与主干的共同祖先，主干上是上一版。
 *
 * 认得出的两种写法在 `TICKET_PATTERN`：工单号（`KOL-` 接数字），与 linear.app 上指向一张卡的链接
 * （路径里带 `/issue/` 的那种）。指向项目页的链接不算 —— `AGENTS.md` 的接手入口就是一条。
 * **认不出的**：不带号、只说「卡片」的话；把号拆开写的（字母与数字之间隔了别的字）；别的工具的号；
 * 没 `git add` 的新文件（`git grep` 只看受控文件）。这几样仍靠人读。
 *
 * 怎么数也是判定（`docs/CONVENTIONS.md` 第 10 条），所以 `git grep` 的参数（`refsArgs`）、
 * 它的退出码怎么读（`grepOutput`）、输出怎么切（`parseRefs`）都在这里；入口只起 git、打印、退出。
 */

/**
 * `git grep -E` 用的扩展正则：工单号，或指向一张卡的链接。链接一直吃到空白为止，
 * 所以链接末尾带着的那个号随链接算一处，不另算一处。
 */
export const TICKET_PATTERN = 'KOL-[0-9]+|linear\\.app/[^/[:space:]]+/issue/[^[:space:]]*'

/**
 * 数号的那条 `git grep`。`-o` 每处一行（同一行两个号算两个），`-z` 让路径后面跟 NUL 不跟冒号
 * （路径里有冒号、空格、中文都不被拆开或包上引号），`-I` 跳过二进制文件。
 * 给了 `tree` 就数那个提交里的树；不给就数工作区里的受控文件 —— 本地没提交的改动也算。
 * 路径一律从仓库根写起（`--full-name`、`:(top)`），在哪个目录起都一样。
 */
export function refsArgs(tree?: string): string[] {
  return ['grep', '-o', '-z', '-I', '--full-name', '-E', TICKET_PATTERN, ...(tree ? [tree] : []), '--', ':(top)']
}

/**
 * `git grep` 的退出码：0 是找到了，1 是**一处都没有**（不是出错），别的都是出错。
 * 出错交回 `null` —— 无从判断，不退化成「零个，通过」。
 */
export function grepOutput(status: number | null, stdout: string): string | null {
  if (status === 0) return stdout
  if (status === 1) return ''
  return null
}

/**
 * 每个文件里有几处。每一处一条记录：`[树:]路径 NUL 命中的字 换行`。
 * 数树的时候路径前面带着 `树:`，去掉它，两边才按同一个路径对得上。
 */
export function parseRefs(out: string, tree?: string): Map<string, number> {
  const counts = new Map<string, number>()
  const prefix = tree ? `${tree}:` : ''
  for (const record of out.split('\n')) {
    const cut = record.indexOf('\0')
    if (cut < 0) continue
    let path = record.slice(0, cut)
    if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length)
    counts.set(path, (counts.get(path) ?? 0) + 1)
  }
  return counts
}

export interface RefChange { path: string; before: number; now: number }
export interface RefsReport {
  /** 比基线多了的文件。基线上没有这个文件就按 0 算。 */
  grown: RefChange[]
  /** 比基线少了的文件（删掉的文件按 0 算）。 */
  shrunk: RefChange[]
  before: number
  now: number
}

/** 两边逐个文件比。 */
export function judgeRefs(before: Map<string, number>, now: Map<string, number>): RefsReport {
  const grown: RefChange[] = [], shrunk: RefChange[] = []
  for (const path of [...new Set([...before.keys(), ...now.keys()])].sort()) {
    const b = before.get(path) ?? 0, n = now.get(path) ?? 0
    if (n > b) grown.push({ path, before: b, now: n })
    else if (n < b) shrunk.push({ path, before: b, now: n })
  }
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, c) => a + c, 0)
  return { grown, shrunk, before: sum(before), now: sum(now) }
}

/**
 * 报告与结论。分支上多了就红；**主干上只报数不判定**，与体量闸门同一个理由：
 * CI 跑在推送之后，这时判红只会让主干变红，拦直推主干是分支保护的活。
 */
export function refsLines(report: RefsReport, onTrunk: boolean, scope: string): { ok: boolean; out: string[]; err: string[] } {
  const out = [`外部工单号 · 相对 ${scope}：${report.before} 处 → ${report.now} 处（旧决策记录里的号留着，只许减不许加，ADR-205）`]
  for (const s of report.shrunk) out.push(`  ↓ ${s.path}  ${s.before} → ${s.now}`)
  if (!report.grown.length) {
    out.push('✓ 外部工单号：没有哪个文件比基线多')
    return { ok: true, out, err: [] }
  }
  const lines = report.grown.map(g => `  ↑ ${g.path}  ${g.before} → ${g.now}`)
  if (onTrunk) {
    out.push(...lines, `✓ 外部工单号：HEAD 就在主干上，${report.grown.length} 个文件比上一版多，**只报数不判定**`)
    return { ok: true, out, err: [] }
  }
  const err = [`✗ 外部工单号：${report.grown.length} 个文件比基线多`, ...lines,
    '  仓库里的文字不写外部任务工具的卡号，也不放指向一张卡的链接；卡那边可以写决策记录编号（ADR-205）。',
    '  要说的是哪件事，写那件事本身（描述性的名字、决策记录编号、需求编号、PR 号）。',
    '  新文件、改了名的文件按零个算：改名时一并把号撤掉。']
  return { ok: false, out, err }
}
