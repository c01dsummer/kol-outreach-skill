/**
 * 变异跑完一次之后的判定 —— 抽出来是为了它能被测(它自己也在判定模块的名单上)。
 *
 * 「被抓到」原先的定义是「进程以非零退出」。评审指出这太宽:一个把进程弄崩的变异
 * (语法错、`TypeError`)也算被抓到,而崩溃不是任何一条断言的功劳。自己撞过:M-H12-b
 * 最初删掉整个 if 块、留下一个悬空的右花括号,`mutate` 照样报「被抓到」。
 *
 * 四态,不压成三态:
 *
 * | 状态 | 判据 |
 * |---|---|
 * | `caught` | 非零退出,打出了那个验证者的失败汇总,而且点了名的话名单里**每一条**都红了 |
 * | `elsewhere` | 断言确实红了,**但 `kills` 点名的那些里至少有一条没红** |
 * | `crashed` | 非零退出但没有汇总,或者这一次出过进程级的失败 |
 * | `survived` | 零退出 |
 *
 * **一条例外:见齐就停的那一次。** 它是被我们主动杀掉的,退出码和汇总都拿不到,
 * 于是不问这两样,改问「点名的那些是不是真的都红过、而且没有记号」—— 那几行
 * 不带记号的 `✗ <名字>` 比「打出了汇总」这个代理更硬(见 `judgeRun`)。
 *
 * `elsewhere` 单成一态,是因为另外三条路都错:压进 `caught` 会让人以为那条夹具有效,
 * 压进 `survived` 或 `crashed` 又都是假话 —— 它确实被某条断言抓到了,只是不是那一条。
 */
import ts from 'typescript'
import { SELFCHECK_FIXTURE_MARK, SELFCHECK_PROCESS_MARK } from './verifier-rule.js'

/** 一个验证者:跑哪个脚本,失败汇总长什么样,进程级失败带什么记号,哪些调用给夹具起名。 */
export interface Verifier {
  script: string
  summary: RegExp
  /** 不填就是这个验证者分不出「进程级失败」与「断言红了」(`test` 就是) */
  processMark?: string
  /** 不填就是这个验证者分不出「夹具没造对」与「断言红了」(`test` 就是) */
  fixtureMark?: string
  /**
   * 哪些调用**声明**一条夹具的名字 —— 清册只认这些调用的第一个字面量实参。
   *
   * 门槛是「这个名字有没有可能满足 `kills`」,不是「有没有起过名」(评审指出)。
   * 自检的 `run` / `runBoth` / `runTool` 起过名,可它们失败时只打
   * `✗ <名字>（进程）：…` —— `killsMatched` 认的是 `<名字>` 或 `<名字>：`,
   * 对不上;就算对上了,`judgeRun` 见了记号也整次判 `crashed`。
   * **登记它们等于放行一批永远得不到 `caught` 的点名**,正是这道闸要拦的。
   */
  declares: string[]
}

/**
 * 认得的验证者。变异的 `by` 缺省 `test` —— 不写的那些逐字保持今天的行为。
 *
 * **判定认的是验证者自成一行的失败汇总,而每个验证者的汇总不一样**:自检打的是
 * `✗ 脚本自检：N 项失败`,测试打的是 `N 个失败`。所以「跑哪个脚本」和「它的汇总长什么样」
 * 在同一处声明 —— 分开放的话,换一边不换另一边的症状是「它真的红了,却被判成崩了」。
 *
 * 用 `Record` 不用 `as const` 加 `keyof typeof`(与 `verifier-rule.ts` 的 `SELFCHECK_TOOLS`
 * 有意不同):那张表的消费方是 TS 代码,而 `by` 是从 JSON 读进来的字符串,编译期不在场。
 * 认不得的名字只能在运行时拦,写成 `keyof` 只会让人以为有一道并不存在的编译期保证。
 */
export const VERIFIERS: Record<string, Verifier> = {
  test: {
    script: 'scripts/test.ts',
    summary: /(^|\n)\d+ 个失败\s*(\n|$)/,
    declares: ['eq', 'ok'],
  },
  selfcheck: {
    script: 'scripts/check/selfcheck.ts',
    summary: /(^|\n)✗ 脚本自检：\d+ 项失败\s*(\n|$)/,
    processMark: SELFCHECK_PROCESS_MARK,
    fixtureMark: SELFCHECK_FIXTURE_MARK,
    declares: ['endPath', 'named'],
  },
}

/** 这一次运行里,有没有过一条带**这个记号**的失败 —— 哪一种记号由调用方给。 */
export function processFailed(output: string, mark: string): boolean {
  return output.split('\n').some(l => l.trimStart().startsWith('✗ ') && l.includes(mark))
}

/**
 * 判 `crashed` 时该把哪几行现场留下来。**带记号的一条都不许丢**,其余的封顶。
 *
 * 带记号的那几行是判定一票否决的**原因**(`notAssertion`) —— 把它们和普通失败行
 * 混在一起按顺序截,吵一点的一次运行就会把唯一说得清原因的那行挤掉,
 * 而留下来的十几行全是无关的。⚠️ 头一版正是「先 filter 再 slice(0,15)」,
 * 评审指出:承诺的是「每一条失败行」,做的是「前十五条」,而**最该留的那条恰好可能在后面**。
 *
 * 截掉了几行要报出来 —— 不报的话,一份被截过的现场和一份本来就这么短的现场长得一样。
 *
 * ⚠️ **一条成形的失败行都没有时,交回原始输出的末尾几行**(`raw`)。真崩掉的那一次
 * (抛异常、语法错误)打的是**栈**,一行以「✗ 」开头的都没有 —— 只认成形的失败行的话,
 * 现场恰恰在**最需要它的那一档**是空的,而这段代码存在的唯一理由就是诊断那一次
 * (#105 第四轮评审指出;实测:语法错误那一次打的是 `Error: Transform failed`)。
 * 两者**不混**:有成形的失败行就只交那些,`raw` 为假 —— 掺进栈只会把它们淹掉。
 */
export function crashEvidence(output: string, verifier: Verifier, cap = 15):
  { lines: string[]; omitted: number; raw: boolean } {
  // 「失败行」的文法与 `processFailed` / `killsMatched` **逐字同一条**：trim 之后以
  // 「✗ 」开头。只问「含不含这个字」的话，一行顺带提到它的诊断（或某个值里带着它）
  // 就能占掉普通行的名额，把真正的失败行挤出去（#105 第二轮评审指出）。
  const fails = output.split('\n').map(l => l.trim()).filter(l => l.startsWith('✗ '))
  const marked = (l: string): boolean =>
    (verifier.processMark !== undefined && l.includes(verifier.processMark))
    || (verifier.fixtureMark !== undefined && l.includes(verifier.fixtureMark))
  const causal = fails.filter(marked)
  const plain = fails.filter(l => !marked(l))
  if (fails.length === 0) {
    const tail = output.split('\n').map(l => l.trim()).filter(l => l !== '')
    return { lines: tail.slice(-cap), omitted: Math.max(tail.length - cap, 0), raw: true }
  }
  const room = Math.max(cap - causal.length, 0)
  return {
    lines: [...causal, ...plain.slice(0, room)],
    omitted: Math.max(plain.length - room, 0),
    raw: false,
  }
}

/**
 * `by` 与 `kills` 这一对写得成不成立 —— 四种不成立各有名字,成立时返回 `undefined`。
 *
 * 判定在这里、打印在入口(`docs/CONVENTIONS.md` 第 10 条)。同一个入口里的另外两道体检
 * 早就是这形状(`attribution-rule.ts` / `why-rule.ts`),这一道原先留在入口里是它自己不合群。
 *
 * | 不成立 | 不拦会怎样 |
 * |---|---|
 * | `unknown-verifier` | 判定拿到的不是验证者,当场抛在跑变异那一段 —— 人看见的是一个栈,不是「名字写错了」 |
 * | `missing-kills` | 只知道「那个验证者红了」,红在哪儿不问,一条把别处弄红的变异照样记成被抓到 |
 * | `kills-without-by` | 那是 ADR-70 明写要另外评定的延伸:机制生效、没有规矩、没有记录 |
 * | `kills-not-list` | 老写法那个字符串会被按一组名字**逐个字符**遍历,每个字都得红才算抓到 —— 那条变异从此永远判「红错了地方」,没有一句话说得出为什么 |
 *
 * ⚠️ **认的是自有键,不是「原型链上有没有」**(评审指出):后者会放行语言内建的那几个名字,
 * 它们「在」这个对象上,取出来却不是验证者 —— 这道体检就在它唯一该说话的时候抛了个栈。
 */
export type WiringFault = 'unknown-verifier' | 'missing-kills' | 'kills-without-by'
  | 'kills-not-list'

export function wiringFault(mut: { by?: string; kills?: unknown }): WiringFault | undefined {
  if (mut.by === undefined) return mut.kills === undefined ? undefined : 'kills-without-by'
  if (!Object.hasOwn(VERIFIERS, mut.by)) return 'unknown-verifier'
  if (mut.kills === undefined) return 'missing-kills'
  // JSON 读进来的东西编译期不在场：老写法 `kills: '某条夹具'` 是个字符串，按一组名字遍历
  // 它会逐个字符走一遍 —— 每个字都得红才算抓到，永远判「红错了地方」。静默，所以要拦。
  if (!Array.isArray(mut.kills) || mut.kills.some(k => typeof k !== 'string')) return 'kills-not-list'
  // 点了验证者、名单却是空的 = 没点名任何夹具，与漏写同一件事
  return mut.kills.length === 0 ? 'missing-kills' : undefined
}

/**
 * 验证者源码里**打完汇总立刻退出**的写法 —— 交回撞上的那一段,没撞上交回 `undefined`。
 *
 * 汇总是最后打的,紧跟着硬退出、而输出又接着管道(变异就是这么跑的),那一行可能还没
 * 写出去就被截掉:退出码非零、汇总没有,判定只能判 `crashed`。**一条真被抓到的变异被
 * 报成跑不起来,而且时红时绿。** 实测(40 次一组):积压全在另一条流上时一次不丢 ——
 * 我上一轮只量了这一种,结论下早了;而自检真失败时诊断和汇总都在 stderr,积压 400 行
 * 丢 18 次、3400 行丢 31 次。改成设退出码让进程自己走完,两种都是 0 次。
 *
 * 顺带买到第二样:**没有提前退出,就没有绕过汇总的路** —— 自检原先「孤儿文件」那一条
 * 就是打完自己那句话直接退出,它的失败根本到不了汇总。
 *
 * ⚠️ 扫的是源码字面,**注释也算**(和 `mutate-restore.ts` 那条同步等法的判据同一处境)。
 * 只提名字不带括号的是散文,不算;要举反例得把那一串拼出来,别写成整串。
 */
const HARD_EXIT = /\bprocess\.exit\s*\(/

export function exitRace(source: string): string | undefined {
  return HARD_EXIT.exec(source)?.[0]
}

/**
 * 一个验证者能打出哪些夹具名字,各起过几次 —— **按语法树**数,不是按字面扫。
 *
 * 不拿「某一次跑出来打了什么」当清册。落地 2 第 5 步要的「见齐 `kills` 就停」会让
 * 一次运行只走到一部分夹具,那样清册装什么取决于停在哪一条上;而「有没有重名」
 * 恰恰要看全体。**两件事互斥,静态这一头两件都成立。**
 *
 * **按语法树而不是按正则,是评审指出来的,而且买到的东西不一样**:正则分不出
 * 「真的在调用」与「串里、注释里写着一句长得像调用的话」。第一版就自带一处
 * —— `scripts/test.ts` 里喂给本函数的测试数据 `eq('甲', …)` 被数进了 `test` 的
 * 真清册(实测:正则扫到 740 个名字,其中 739 个是真声明)。**方向是放行**:
 * 往任何一份源码里写一句 `"eq('幽灵', …)"`,`kills: '幽灵'` 就过得了这道闸。
 * 语法树没有这个洞 —— 串的内容是一个 `StringLiteral` 节点的值,**结构上就不是调用**。
 * 顺带还分得出 `别的对象.eq('甲')`(不是那个函数)和写在块里的调用(要递归才看得见)。
 *
 * 认第一个实参是**字符串字面量或不带插值的反引号串**的那些调用 —— 两种都静态定得下来。
 * 带插值的、传变量的(`run(label, …)` 这种转发)定不下来,定不下来就不进清册:
 * 清册唯一的用途是「点的这条真的在」,小了是拦住,大了是放行。
 */
export function labelsOf(source: string, declares: readonly string[]): Map<string, number> {
  const seen = new Map<string, number>()
  const tree = ts.createSourceFile('verifier.ts', source, ts.ScriptTarget.Latest, true)
  const literal = (node: ts.Node | undefined): string | undefined =>
    node !== undefined && ts.isStringLiteralLike(node) ? node.text : undefined
  /** 调的是谁 —— 只认光秃秃一个名字。`别的对象.eq(…)` 不是那个函数,交回 `undefined` */
  const callee = (node: ts.CallExpression): string | undefined =>
    ts.isIdentifier(node.expression) ? node.expression.text : undefined
  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = callee(node)
      const label = literal(node.arguments[0])
      if (name !== undefined && declares.includes(name) && label !== undefined) {
        const had = seen.get(label)
        seen.set(label, had === undefined ? 1 : had + 1)
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(tree)
  return seen
}

/**
 * 这条豁免的编号,有没有变异记在它名下。
 *
 * 报告里那句「无变异(显式缺口)」原先是写死的,而落地 2 第 5 步起它变成假话:
 * D6.f 挂着豁免、同时被 `M-D6-j` 真守着,同一份报告里两句话打架。
 *
 * **只报事实,不判「豁免该不该撤」。** 后者要看 `scope`（豁免有,变异没有),而那是
 * 落地 4 的事 —— ADR-70 那条欠条说的是:按 `req` 去判覆盖关系,会因为同一判据
 * **另一半**有了负片,删掉这一半唯一的缓解记录。#88 的评审正是照它把我造的那道
 * 硬失败拦下来的（这里是转述,不是原句）。这里只说
 * 「有没有一条变异写着这个编号」,那是数据直接答得出来的。
 *
 * **编号要逐字相同**:`D6` 的变异不算守着 `D6.f`,反过来也不算 —— 判据比需求细,
 * 拿粗的去顶细的正是判据级计量当初要治的那件事。
 */
export function exemptionCovered(req: string,
  mutations: readonly { req: string }[]): boolean {
  return mutations.some(m => m.req === req)
}

/**
 * 报告里那条豁免旁边怎么说 —— 排版留在判定里,与 `criteriaCell` 同一个理由。
 *
 * **只回答一个问题:名下有没有一条变异。** 短到不带括号,是为了让三处报告各自组框:
 * `--brief` 后面接 `（scope）`、整跑接冒号、审计接在它自己那句「显式缺口,不消灭」之后。
 * 各写一份的话,一条判据有了负片之后改了两处忘了第三处,症状是「同一件事,两份报告
 * 说两样」——本 PR 头一版正是只改了 `mutate.ts` 那两处（#91 评审指出）。
 */
export const exemptionLead = (covered: boolean): string =>
  covered ? '名下有负片' : '名下无变异'

/**
 * 一个**入口**的源码里,那句豁免行是不是从判定取的 —— **按语法树**问,不是按字面扫。
 *
 * 同一句话有三处入口在印(`mutate` 的 `--brief` 与整跑、`audit` 的报告)。`mutate`
 * 那两处各有一个自检夹具真跑一遍、断言输出;`audit` 那一处**没有** —— 给它造夹具要把
 * `audit` 加进自检的工具表(`runTool` 的形参类型就是那张表的键,起一个表里没有的
 * 编译期都过不去),而那张表同时是隔离判据的种子来源:闭包实测从 13 个撑大到 17
 * (`audit.ts` 自己,带上 `audit-rule` / `spec-rule` / `quoted`),`verifier-rule.ts`
 * 与 `ARCHITECTURE.md` 里四处写着「13 个」的话同时失真,此后能被自检验证的变异空间
 * 也跟着缩小。为一行报告付这个代价不划算(#91 第二轮评审要的是给 `audit` 也造夹具,
 * 这里是实测之后另选的路)。
 *
 * 退而求其次:扫源码,问「这个入口还在调那个判定吗」。**它比输出级的夹具弱**,两层弱:
 * 一是只证明调用还在,不证明印出来的话对 —— 调用留着、把结果丢掉照样绿;二是它**按文件
 * 问**,`mutate.ts` 里那两处调用断了哪一处它分不出来。
 * 但它挡得住评审点名的那个坏法(把整句话换回写死的字面量),而且零代价、不动闭包;
 * `mutate` 那两处另有夹具真跑着断言输出,所以这条判定真正独自扛的是 `audit` 那一处。
 * ⚠️ 这条差额记在 ADR-70 的欠条里。
 *
 * **头一版写成正则,评审当场指出洞在哪**:`// exemptionLead(exemptionCovered(x, y))`
 * 也算数,于是真调用删掉、同一句话留在注释或串里,这条断言照样绿 —— **它证不了
 * 「还在调」,只证得了「还写着这几个字」**。而这正是本文件上面 `labelsOf` 刚补过的
 * 同一个洞,同样是评审指出来的。语法树没有它:注释不进树,串的内容是一个
 * `StringLiteral` 节点的值,结构上就不是调用。
 */
export function leadWired(source: string): boolean {
  const tree = ts.createSourceFile('entry.ts', source, ts.ScriptTarget.Latest, true)
  /** 调的是不是光秃秃这个名字 —— `别的对象.exemptionLead(…)` 不是那个函数 */
  const callTo = (node: ts.Node | undefined, name: string): node is ts.CallExpression =>
    node !== undefined && ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === name
  let wired = false
  const visit = (node: ts.Node): void => {
    if (callTo(node, 'exemptionLead') && callTo(node.arguments[0], 'exemptionCovered')) wired = true
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return wired
}

export type LabelFault = 'unknown-label' | 'ambiguous-label'

/**
 * `kills` 点的那条夹具,在这个验证者的清册里立不立得住。
 *
 * | 立不住 | 不拦会怎样 |
 * |---|---|
 * | `unknown-label` | 点了一个谁也不会打出来的名字。那条变异从此只会判 `elsewhere` —— 读起来像「抓到了,只是抓错地方」,其实是名字打错了或那条夹具没了 |
 * | `ambiguous-label` | 两条夹具同名,红的是哪一条分不出。**那正是 `kills` 要堵的错误归因,换个入口又发生一次** |
 *
 * 重名只在**被点到**时才拦,不做全局唯一:实测 `scripts/test.ts` 今天有 4 个名字
 * 各起了两三次,而谁也没点它们。全局唯一要为一条没人用到的性质去改一批无关的断言;
 * 「后来有人把某条 `kills` 点着的名字弄重了」这一头,这道体检本来就每次都查。
 */
export function labelFault(kills: string,
  inventory: ReadonlyMap<string, number>): LabelFault | undefined {
  const n = inventory.get(kills)
  if (n === undefined) return 'unknown-label'
  return n > 1 ? 'ambiguous-label' : undefined
}

export type RunVerdict = 'caught' | 'elsewhere' | 'crashed' | 'survived'

/**
 * 名单里**每一项各查一次**,立不住的连同它自己的名字一起交回。
 *
 * 「每一项都要查」是语义,不是打印:只查头一项的话,后面几项点着不存在的夹具没人说,
 * 而判定要求它们全红 —— 那条变异会一直判「红错了地方」,报出来的却是「没红」
 * 而不是「没这条」。语义留在入口就没有负片守得住它(`docs/CONVENTIONS.md` 第 10 条,
 * #97 评审指出:入口那道循环改成只查首项,当时的测试与三条新负片仍会全绿)。
 */
export function labelFaults(kills: readonly string[], inventory: ReadonlyMap<string, number>):
  { label: string; fault: LabelFault }[] {
  return kills.flatMap(label => {
    const fault = labelFault(label, inventory)
    return fault === undefined ? [] : [{ label, fault }]
  })
}

/**
 * `kills` 点名的那条夹具红了没有。
 *
 * **匹配精确到 label 边界**:`✗ ` 之后要么正好是那条 label,要么是「label ＋ `：`」。
 * 不这么钉的话,一条 label 是另一条的前缀时,红了短的会被算成红了长的 —— 那正是
 * `kills` 要堵的错误归因,换个入口又发生一次(评审指出)。
 *
 * 用字符串比不用正则:label 里满是中文全角括号,拼进正则要转义,而转义漏一个是静默的。
 *
 * ⚠️ **它管不了「崩溃算不算数」,那一道在 `judgeRun` 上。**
 */
export function killsMatched(output: string, label: string): boolean {
  return output.split('\n').some(line => {
    const rest = line.trimStart()
    if (!rest.startsWith('✗ ')) return false
    const body = rest.slice(2)
    return body === label || body.startsWith(`${label}：`)
  })
}

/**
 * 收到的字节里**已经成行**的那一段 —— 最后一截可能还没写完,不算数。
 *
 * 边收边看的时候,半行会让名字**写到一半就算数**:`✗ 某条夹具` 与
 * `✗ 某条夹具又长了一截` 的前缀一模一样,而后者不该满足点名。两股流要**各自**截,
 * 合起来再截会把它们之间那个人为插入的换行当成行尾(#99 评审指出)。
 */
export function complete(chunk: string): string {
  return chunk.slice(0, chunk.lastIndexOf('\n') + 1)
}

/**
 * 点名的那些是不是**都**已经红过了 —— 见齐就可以停,不必等验证者跑完。
 *
 * 判据只此一份:入口靠它决定什么时候杀掉子进程,`judgeRun` 靠它给 `caught`。
 * 各写一份的话,「停下的条件」和「算不算抓到」会悄悄分家 —— 停早了的那一次
 * 照样被判成抓到,而它其实什么都没见齐。
 */
export function allKilled(output: string, kills: readonly string[]): boolean {
  return kills.every(k => killsMatched(output, k))
}

/**
 * 这一次运行里,有没有过一条**不是任何断言功劳**的失败:进程级的,或者夹具自己废了。
 *
 * 两种记号同一个理由、同一个待遇,合在一处 —— 分开写的话,新加一种记号时
 * 很容易只补一条路(提前停下那条路今天就差点漏掉)。
 */
export function notAssertion(output: string, verifier: Verifier): boolean {
  return (verifier.processMark !== undefined && processFailed(output, verifier.processMark))
    || (verifier.fixtureMark !== undefined && processFailed(output, verifier.fixtureMark))
}

/**
 * 一次运行算什么。
 *
 * **被信号杀掉(没有退出码)一律 `crashed`** —— **除了我们自己为「见齐就停」杀的那一次**
 * (那一条在下面单说),哪怕汇总已经打出来了:那一次没跑完,
 * 它剩下的断言一条也没说过话,拿它当证据就是拿半份跑当整份用。这个洞从判定第一版
 * 就在,是 ADR-70 把四态表写出来之后才看得见「散文说的」与「代码做的」对不上。
 *
 * `kills` 没写时不判第四态 —— 缺省跑测试的那两百多条没有点名任何夹具,行为逐字如旧。
 *
 * **出过进程级失败,这一次的证据就不算数。** 记号只贴在打那句话的那一行上,护不住它
 * 后面照打的派生诊断 —— 实测一条只把 `collect` 弄崩的变异会漏出「没有留下可读的断点」
 * 这类不带记号的 `✗`,`kills` 点它就成了把崩溃的功劳记到断言头上(评审第三轮指出,
 * 我第一轮驳回错了)。所以拦在**整次运行**这一层:记号只有一个打点(`runBoth`),
 * 而派生诊断有几十处、还会长 —— 保证要挂在不随数量长的那一头。
 *
 * 代价是**保守的假阴性**:一次里既崩了、又真红了点名那条,现在也判 `crashed`;
 * 「入口的退出码接线」也从此没法靠 `kills` 认领 —— 那条路本来就只能靠点名派生诊断
 * 走通,而那正是要堵的错误归因。
 *
 * **夹具自己废了,这一次同样什么也没证明。** 同一个道理第二次发生:一条夹具红在
 * 「夹具没造对」上,`killsMatched` 只认名字、分不出红的理由,于是自检在说
 * 「我什么也没测到」而这里记成「被抓到」。两道闸的形状一样、理由逐字一样,
 * 只是记号不同 —— 那不是任何一条断言的功劳(ADR-70 的欠条,5c 第一片)。
 *
 * **点名是一组,每一条都要红。** 只收一个名字的时候,一条变异只要弄红名单里的头一条
 * 就算被抓到 —— `M-D6-j` 因此只证明了「四条收尾里的第一条还活着」,后三条夹具删光它
 * 照样绿(#91 复查实测)。一组里有一条没红,这条变异对那一条就什么也没证明,
 * 判的是 `elsewhere`(ADR-70 的欠条,5c 第二片)。
 */
export function judgeRun(exitCode: number | null, output: string,
  verifier: Verifier, kills?: readonly string[], stoppedOnKills = false): RunVerdict {
  if (exitCode === 0) return 'survived'
  // 见齐就停的那一次:退出码和汇总都拿不到(是我们主动杀的、也没跑到尾),
  // 但**看见那几行不带记号的 `✗ <名字>`** 本身就是「断言真的跑了、真的红了」的直接证据,
  // 比「打出了汇总」这个代理更硬 —— 汇总那道闸是给不点名的那两百多条用的。
  //
  // **入口说停了不算数,这里自己再问一遍 `allKilled`**(#99 评审指出):不然入口那边一漂,
  // 一次连一行具名失败都没有的运行也能拿到 `caught` —— 而「两边共用同一判据」正是
  // `allKilled` 只此一份的理由,只让入口用、判定不用,等于把那句承诺自己作废。
  // 记号照旧一票否决:崩了或夹具废了,这一次整份不算数。
  if (stoppedOnKills) {
    return kills !== undefined && allKilled(output, kills) && !notAssertion(output, verifier)
      ? 'caught' : 'crashed'
  }
  if (exitCode === null) return 'crashed'
  if (!verifier.summary.test(output)) return 'crashed'
  if (kills === undefined) return 'caught'
  if (notAssertion(output, verifier)) return 'crashed'
  return allKilled(output, kills) ? 'caught' : 'elsewhere'
}
