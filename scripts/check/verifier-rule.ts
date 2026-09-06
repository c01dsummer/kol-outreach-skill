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
 * - **别的验证者**：这里只有自检一个。将来多一个验证者，它的种子要照样在这儿声明成
 *   「就是行为」的形状，而不是回头去扫源码。
 *
 * 第一条是「写的人绕得过去」，不是「机器判错」—— 和 `docs/CONVENTIONS.md` 第 10 条同一处境。
 */

/** 一个文件够得到谁。`to` 里放的是仓库根起算的路径。 */
export interface Reaches {
  path: string
  to: string[]
}

/**
 * 自检当**工具**起的那几个脚本。
 *
 * 这份清单**不是对行为的描述，它就是行为** —— 自检从这里取路径去起进程（`runTool`），
 * 闭包也从这里取种子。要加一个工具只能加在这儿：`runTool` 的形参类型是
 * `keyof typeof SELFCHECK_TOOLS`，起一个不在表里的工具**编译期就过不去**。
 * 于是「清单漂了」在类型层不成立。
 *
 * ## 为什么不是扫源码
 *
 * 上一版是扫自检的源码，猜哪些路径是它要起的工具。评审两轮各找到一批诱饵：
 * 注释里提到的路径、写进夹具串的路径、`const fixture = "S('check/audit.ts')"`
 * 这种串里装着调用形状的、以及 `readFileSync('./fixture.ts')` 这种普通读文件。
 * 每收紧一次正则就出现新的一批 —— 那是军备竞赛，而 ADR-62 为这种事立过标准
 * （三条静态判据全因假阳性被否决）。
 *
 * **根因不在正则不够严，在于「描述行为的东西会说谎」。** 让清单成为行为本身，
 * 就没有可骗的东西了 —— 这和 `tsx-cmd.ts`（怎么起 tsx 只此一份）、
 * `types.ts`（D1 的身份键只此一份）是同一条路子。
 */
export const SELFCHECK_TOOLS = {
  lint: 'check/lint.ts',
  mutate: 'check/mutate.ts',
  arch: 'check/arch-sync.ts',
} as const

/**
 * 自检用 `NODE_OPTIONS: --import` 塞进**每个子进程**的那一份假 fetch。
 *
 * 它够不到的方式和工具不同（不是起进程，是预加载），但一样是验证基础设施 ——
 * `audit-rule.ts` 的 `JUDGMENT_EXEMPT` 里写着它「决定自检能走多深」。
 * 单独列出来，因为只扫 `import` 和只扫「起了谁」都收不到它。
 */
export const SELFCHECK_PRELOAD = 'check/fake-fetch.ts'

/** 自检这个验证者的闭包种子：它自己 ＋ 它当工具起的 ＋ 它预加载的。 */
export const SELFCHECK_SEEDS: string[] = [
  'scripts/check/selfcheck.ts',
  ...Object.values(SELFCHECK_TOOLS).map(f => `scripts/${f}`),
  `scripts/${SELFCHECK_PRELOAD}`,
].sort()

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
