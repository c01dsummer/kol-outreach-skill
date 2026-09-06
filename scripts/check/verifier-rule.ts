/**
 * 「验证者跑得到哪些文件」的判定 —— 给 `by: "selfcheck"` 那种变异用的隔离判据。
 *
 * 一条变异如果改的正是**验证者自己要用的东西**，就成了自己验自己：跑出来的绿或红
 * 都不算数。ADR-70「两处接缝」第二条要的就是这道判据。
 *
 * ## 要禁的是基础设施，不是被测对象
 *
 * 按字面写成「验证者跑到的文件一律不许改」会**否决这条记录的头号用例**：自检必须真的
 * 起被变异的 `collect.ts` 才验得了 D6.f。两者的区别是语义的，而这里拿一条可查的判据
 * 把它划开：
 *
 * > **验证者起 `scripts/check/` 底下的东西，是在用工具；起别处的，是在跑被测对象。**
 *
 * `scripts/check/` 就是检查链本身 —— 这不是巧合，是这个目录的定义。
 *
 * ## 三种边，少收一种闭包就是假的
 *
 * 验证者够得到一个文件有三条路，只扫 `import` 会漏掉后两条：
 *
 * | 边 | 例子 | 只扫 import 会怎样 |
 * |---|---|---|
 * | `import` | `selfcheck.ts` → `tsx-cmd.ts` | 收得到 |
 * | **当工具起** | `selfcheck.ts` 起 `check/mutate.ts`、`check/lint.ts`、`check/arch-sync.ts` | 漏掉，连同它们各自的传递依赖 |
 * | **预加载** | `selfcheck.ts` 用 `NODE_OPTIONS: --import …/fake-fetch.ts` 把假 fetch 塞进每个子进程 | 漏掉 —— 而它决定自检能走多深（`audit-rule.ts` 的 `JUDGMENT_EXEMPT` 里就是这么写的） |
 *
 * 实测：只从 `selfcheck.ts` 的 `import` 出发，闭包是 2 个文件；把后两种边补上，是 **12 个**。
 * 少收的那 10 个里有 `mutate-rule.ts`（判定「抓到还是崩了」的那一半）——
 * 一条打在它身上的 `by: "selfcheck"` 变异，改的正是给它自己判分的那把尺。
 *
 * ## 它挡不住什么
 *
 * - **验证者从 `scripts/check/` 外面起一个工具**：按上面那条判据会被当成被测对象放行。
 *   今天没有这种写法（实测三处工具全在 `check/` 下），但判据拦不住有人这么写。
 * - **动态拼出来的路径**：这里认的是源码里的字符串字面量。`S('check/' + name)` 这种收不到。
 *   两条都是「写的人绕得过去」，不是「机器判错」—— 和 `docs/CONVENTIONS.md` 第 10 条同一处境。
 */

/** 一个文件够得到谁。`to` 里放的是仓库根起算的路径。 */
export interface Reaches {
  path: string
  to: string[]
}

/**
 * 从一份验证者源码里抠出 **`import` 之外**的那两类边。
 *
 * 只认字符串字面量 —— 散文里顺口提到的路径不算数（同 `arch-sync.ts` 认反引号那条）。
 * 返回的是仓库根起算的路径，已排序去重。
 */
export function toolEdges(src: string): string[] {
  const found = new Set<string>()
  // 当工具起：`check/xxx.ts` 这种写法，前缀写不写 `scripts/` 都认
  for (const m of src.matchAll(/'(?:scripts\/)?(check\/[\w.-]+\.ts)'/g)) found.add(`scripts/${m[1]}`)
  // 预加载：`--import` 那一路拿 `new URL('./xxx.ts', import.meta.url)` 拼出来
  for (const m of src.matchAll(/'\.\/([\w.-]+\.ts)'/g)) found.add(`scripts/check/${m[1]}`)
  return [...found].sort()
}

/**
 * 从种子出发递归收，返回验证基础设施闭包（**含种子**），排序去重。
 *
 * 图里没有的路径按「够不到别人」处理 —— 它仍然进闭包（种子或别人指过来的都算），
 * 只是不再往下走。**不是**悄悄丢掉：丢掉会让闭包偏小，而偏小的那一头是放行，
 * 也就是把一条自己验自己的变异当成合法的。
 */
export function closure(graph: Reaches[], seeds: string[]): string[] {
  const edges = new Map(graph.map(n => [n.path, n.to]))
  const seen = new Set<string>()
  const stack = [...seeds]
  while (stack.length) {
    const f = stack.pop()
    if (f === undefined || seen.has(f)) continue
    seen.add(f)
    for (const next of edges.get(f) ?? []) stack.push(next)
  }
  return [...seen].sort()
}

/**
 * 这条变异算不算「自己验自己」。
 *
 * 只对指名了验证者的变异成立：缺省跑 `scripts/test.ts` 的那些不受这条判据管
 * （它们改的东西和自检的基础设施是两回事）。
 */
export function selfVerifying(mut: { by?: string; file: string }, infra: string[]): boolean {
  return mut.by !== undefined && mut.by !== 'test' && infra.includes(mut.file)
}
