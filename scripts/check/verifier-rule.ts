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
 * 实测：只从 `selfcheck.ts` 的 `import` 出发，闭包是 3 个文件；把后两种边补上，是 **14 个**。
 * 少收的那 11 个里有 `mutate-rule.ts`（判定「抓到还是崩了」的那一半）——
 * 一条打在它身上的 `by: "selfcheck"` 变异，改的正是给它自己判分的那把尺。
 *
 * 14 个里包含**本文件自己** —— 自检 `import` 它来拿 `SELFCHECK_TOOLS`，所以这条判据
 * 也在它自己划的禁区里。这不是巧合：它就是验证基础设施。
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

/**
 * 自检给**进程级**失败打的记号 —— 自检打，判定认，只此一份。
 *
 * 「退出码不对」和「断言红了」原先打的是同一句 `✗ <名字>：…`。人分得出，机器分不出，
 * 而变异的 `kills` 认的正是这句话（`mutate-rule.ts`）：一条只把被测脚本弄崩的变异，
 * 会连同那条夹具「红了」一起被记成被抓到 —— 那是崩溃的功劳，不是断言的，
 * 正是判定里 `crashed` 一态要拦的东西，换个入口又发生一次。
 *
 * 记号跟在名字后面，于是「名字到此为止」和「名字 ＋ `：`」两种边界都对不上，
 * 判定不必为它开特例。**两边各写一份字面量的话，改一边不改另一边是静默的** ——
 * 自检照打，判定照认不出，而 `kills` 又开始把崩溃算成抓到。
 */
export const SELFCHECK_PROCESS_MARK = '（进程）'

/**
 * 自检给**夹具自己废了**打的记号 —— 同样是自检打、判定认,只此一份。
 *
 * 与进程记号治的是同一件事,在同一个函数里第二次发生:一条夹具的诊断分「夹具没造对」
 * 和「断言红了」两种,打出来却是同一句 `✗ <名字>：…`,而 `killsMatched` 只认名字、
 * 分不出红的理由。实测把一条收尾夹具的场景弄坏(让它走 `target` 而不是 `done`),
 * 整次自检唯一那行红逐字是「这一次走的不是 done 那条收尾 —— 夹具没造对」,
 * 判定给的仍是 `caught`:**自检在说「我什么也没测到」,而闸门把它记成
 * 「那条判据被守住了」**(ADR-70 的欠条,勘察 5c 时实测)。
 *
 * 理由与进程记号逐字相同:那不是任何一条断言的功劳。记号同样跟在名字后面,
 * 于是「名字到此为止」和「名字 ＋ `：`」两种边界都对不上,判定不必为它开特例。
 */
export const SELFCHECK_FIXTURE_MARK = '（夹具）'

/**
 * 自检末尾那句失败汇总 —— **自检打，判定认，文案只此一份。**
 *
 * 判定那边是另一份字面量（`mutate-rule.ts` 的 `VERIFIERS` 里那条正则），两份必须对得上。
 * 各写各的话，改了这边不改那边**两边的测试和变异都照样绿**，而每条 `by: "selfcheck"`
 * 的变异从此被误报成「跑不起来」—— 一个不响的假阴性（ADR-70 的欠条，评审指出）。
 * 文案收在这里，再由 `scripts/test.ts` 拿这句真话去喂那条正则。
 */
export const selfcheckSummary = (failed: number) => `✗ 脚本自检：${failed} 项失败`

/** 自检这个验证者的闭包种子：它自己 ＋ 它当工具起的 ＋ 它预加载的。 */
export const SELFCHECK_SEEDS: string[] = [
  'scripts/check/selfcheck.ts',
  ...Object.values(SELFCHECK_TOOLS).map(f => `scripts/${f}`),
  `scripts/${SELFCHECK_PRELOAD}`,
].sort()

/**
 * 一个文件 `import` 了哪些**本仓库内**的文件 —— 建图的那一半判据。
 *
 * 只认相对路径：`node:` 内建和第三方包不是本仓库的文件，改不动也变异不了。
 * 规格化成仓库根起算的 `.ts` 路径（源码里写的是 `.js`，那是 ESM 的规矩）。
 *
 * **判据故意写得宽**：认的是任何 `from '相对路径'`，不管它在代码里还是在注释里。
 * 理由是这条判据的两头不对称 —— 多收一个文件只是把闭包撑大、多拦下几条变异；
 * 少收一个就是**放行**一条自己验自己的变异。`closure` 头上写的是同一条道理。
 * 所以这里不玩「怎么把注释抠干净」那套军备竞赛（ADR-62 否掉过三条那样的判据）。
 */
export function importsOf(path: string, source: string): Reaches {
  const dir = path.slice(0, path.lastIndexOf('/'))
  const to = [...source.matchAll(/\bfrom\s*'(\.[^']+)'/g)].map(m => {
    const parts = `${dir}/${m[1]}`.split('/')
    const out: string[] = []
    for (const seg of parts) {
      if (seg === '.' || seg === '') continue
      if (seg === '..') out.pop()
      else out.push(seg)
    }
    return out.join('/').replace(/\.js$/, '.ts')
  })
  return { path, to: [...new Set(to)].sort() }
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
 * 从种子出发，边读边递归，收出验证基础设施闭包。
 *
 * **遍历本身是判定，不是 I/O**（评审指出，`docs/CONVENTIONS.md` 第 10 条讲的正是这个 ——
 * `lint-rule.ts` 的走文件树同理留在判定这边）：递归到多深、图里没有的怎么处理，
 * 决定了这道闸门看得见多少文件。把它留在入口的话，「少走一层」这种坏法**没有任何断言
 * 够得着** —— 闭包会静默缩回种子那几个，而缩小的那一头是放行。
 *
 * 读文件由调用方注入：入口传真的读法，测试传一张假的表，于是这段遍历不碰文件系统也验得了。
 * `read` 交回 `undefined` 表示读不到 —— 那种路径不再往下走，但**它自己仍留在闭包里**
 * （抽边那条判据故意写得宽，注释里提到的路径也算；偏大只是多拦几条，偏小才是放行）。
 */
export function infraClosure(read: (path: string) => string | undefined): string[] {
  const graph: Reaches[] = []
  const walked = new Set<string>()
  const pending = [...SELFCHECK_SEEDS]
  while (pending.length) {
    const f = pending.pop()
    if (f === undefined || walked.has(f)) continue
    walked.add(f)
    const source = read(f)
    if (source === undefined) continue
    const node = importsOf(f, source)
    graph.push(node)
    pending.push(...node.to)
  }
  return closure(graph, SELFCHECK_SEEDS)
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
