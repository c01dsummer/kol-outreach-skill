/**
 * 决策记录的判定 —— 一条记录一个文件,编号即文件名。
 *
 * 拆成一文件一条的理由是**冲突面**:ADR 在语义上追加、彼此独立,是这个仓库里
 * 最不该冲突的东西;装在一个文件里之后,它变成了最大的冲突面。实测三条在途分支
 * 各自把 `DECISIONS.md` 从 537 行写到 1978~2539 行,而且编号互相交错 ——
 * 第一条合进主干后,后两条不是「追加到末尾」,是往文件中间十几个位置插入。
 *
 * 换成文件之后,记录之间不再共用文件,**稳定**的冲突面从「整册」缩到**那张生成的索引**:
 * 新行都加在同一个位置,两条分支各加一条就撞在那儿。而这道冲突**不区分**两边有没有
 * 抢同一个号 —— 号不同也照样撞。**它挡的是并发加记录,不是抢号**;
 * 撞号由下面的 `checkAll` 报,而那是两边合到一起之后的事 —— **且只覆盖两份记录各自
 * 作为不同文件留下来的那一种**;同名那一种够不着 —— git 报的是两边都新建了这个文件,
 * 人按「留一个」解掉就无声少一条记录。
 *
 * 这道检查的死亡条件记在 ADR-85。两条都可核,但都几乎不会响 —— 那正是它们
 * 算死亡条件的原因:说得准比听起来会响要紧。
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { factTableFaults } from './adr-fact-table.js'
import { quotedMask } from './quoted.js'
import { TRUNK_CANDIDATES, type GitAsk } from './size-rule.js'

/** `ADR-08-采集累加器与交付物拆成两个文件.md` */
export const FILE_RE = /^ADR-(\d+)-(.+)\.md$/
/** 文件里的第一行:`# ADR-08 采集累加器与交付物拆成两个文件` */
export const HEAD_RE = /^#\s+ADR-(\d+)\s+(.+?)\s*$/

export interface Adr { file: string; num: number; title: string }

/** 编号宽度跟随既有约定:个位数补零到两位,其余原样。**编号不复用,允许有空号。** */
export const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 文件名里的标题部分。保留中文,只去掉会坏事的字符,分三类:
 *
 * - 文件系统有歧义的 `/ \ : * ? " < >`
 * - **Markdown 链接语法**的 `# [ ] ( )` —— `#` 留在文件名里,链接里它会被当成锚点,
 *   指向一个不存在的文件;方括号会把链接标签截断
 * - 表格分隔符 `|`
 *
 * 全角逗号一类**不剔** —— 它在文件名和链接里都无害,剔掉只会让既有文件
 * 全部改名,那是自造的假阳性。
 *
 * 截到 32 数的是**码点**,不是 `String` 的码元。`slice(0, 32)` 数码元,会从中间
 * 劈开一个代理对 —— 31 个汉字后面跟一个 emoji,切口正好落在那个 emoji 中间,
 * 留下半个字符。半个代理对不是合法 Unicode,写盘时 Node 把它换成 `�`,于是
 * **盘上的名字和算出来的名字不是同一个**:`--split`(已撤,ADR-79 末尾)当年照它
 * 刚写出的文件,`npm run adr` 会当场判文件名与正文不符,而报错的位置离出错的位置隔着一整条命令。
 *
 * 只保到码点,不保到**字形簇** —— ZWJ 序列、旗帜、组合符照样会被劈开。这不是偷懒:
 * 劈开的字形簇仍是合法 Unicode,原样往返,名字稳定,检查照过,难看而已。
 * 界划在合法性上,是因为**合法性有规范定义的边界,好不好看没有**。
 *
 * 纯 BMP 的标题(这个仓库现有的全部)按码点和按码元截出来一模一样,所以既有文件
 * 一个都不改名。
 */
export const slugify = (title: string) =>
  [...title.replace(/[\/\\:*?"<>|#[\]()「」『』（）,。.]/g, '').replace(/\s+/g, '-')]
    .slice(0, 32).join('')

/**
 * 索引里的标签用的是**原标题**(不是过了 slugify 的文件名),所以结构性字符要在
 * 这里转义,一个都不能少 —— 少一个,`npm run adr` 仍报「索引一致」,而那份一致的
 * 索引点不开:
 *
 * | 字符 | 少转义会怎样 |
 * |---|---|
 * | `\\` | 它自己会把后面那个转义吃掉,所以**必须第一个转** |
 * | `\|` | 表格多切出一列 |
 * | `[` `]` | **提前终止链接标签** —— 一个标题里有 `]`,后面半截连同链接一起散成纯文本 |
 * | `<` `>` | 被当成原始 HTML 或自动链接 |
 * | `` ` `` | 起一个代码段,把后面的内容吞进去 |
 *
 * CommonMark 允许反斜杠转义任何 ASCII 标点,所以统一用反斜杠。
 */
export const escapeCell = (t: string) => t.replace(/[\\|[\]<>`]/g, c => '\\' + c)

/**
 * 链接目标里**只编码真正会断链的那一组** ASCII:空格与 `( ) # [ ] < > "`。
 *
 * 不用 `encodeURI` —— 它会把中文整片编成百分号序列,而中文在链接里本来合法,
 * 结果是索引变成一页看不懂的乱码,换来的安全是零。
 *
 * **`%` 自己也要编码。** 一个标题里含 `%20`,slugify 原样留在文件名里,而渲染器
 * 会把它当成编码过的空格 —— 链接指向一个别的文件名,`npm run adr` 却仍报一致。
 * 不必担心顺序:`String.replace` 的替换结果不会被再次扫描,所以把 `%` 放进
 * 同一个字符组就够,不会把自己产生的 `%2F` 再编一遍。
 *
 * 这一组之外的字符 slugify 已经从文件名里去掉了,所以那部分是兜底:
 * 万一哪天 slugify 放宽了,断的是链接而不是这条规则。
 */
export const encodeTarget = (t: string) =>
  t.replace(/[ %()#[\]<>"]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))

export const fileNameOf = (num: number, title: string) => `ADR-${pad(num)}-${slugify(title)}.md`

/**
 * 编号必须唯一,且文件名与正文标题里的编号必须一致。
 *
 * 后一条不是洁癖:改标题时只改了正文,文件名还留着旧编号,索引会指到一个
 * 说着别的编号的文件 —— 而下游引用的是编号。
 */
export function checkAll(adrs: Adr[]): string[] {
  const errors: string[] = []
  const seen = new Map<number, string>()
  for (const a of adrs) {
    const prev = seen.get(a.num)
    if (prev) errors.push(`ADR-${pad(a.num)} 被两个文件同时占用:${prev} 与 ${a.file} —— 编号不复用`)
    else seen.set(a.num, a.file)
    const want = fileNameOf(a.num, a.title)
    if (a.file !== want) errors.push(`${a.file} 的文件名与正文标题对不上,应为 ${want}`)
  }
  return errors
}

/**
 * 历史文件所在的子目录：`docs/adr/历史/`。一条记录的主文件只放现行结论，
 * 过程原样搬进这里一份**同名**文件（ADR-211，主文件只放现行结论那一份）。
 */
export const HISTORY_DIR = '历史'

/**
 * 历史文件的判定：每份都要有同名的主文件，第一行是同一个编号。
 *
 * 没有主文件的历史，是记录被删了、过程还留着 —— 索引里找不到它，读的人也就找不到；
 * 第一行编号对不上，是挪错了地方，顺着编号去查的人会读到别的记录的过程。
 */
export function historyFaults(mains: string[], history: Array<{ file: string; first: string }>): string[] {
  const have = new Set(mains)
  const errors: string[] = []
  for (const h of history) {
    const m = FILE_RE.exec(h.file)
    if (!m) { errors.push(`${HISTORY_DIR}/${h.file} 文件名不合格式，应与它的主文件同名`); continue }
    if (!have.has(h.file)) errors.push(`${HISTORY_DIR}/${h.file} 没有同名的主文件 —— 历史文件只能跟着一条还在的记录`)
    const head = HEAD_RE.exec(h.first)
    if (!head || Number(head[1]) !== Number(m[1])) errors.push(`${HISTORY_DIR}/${h.file} 第一行应为 \`# ADR-${m[1]} …\`，与文件名同号`)
  }
  return errors
}

export function renderIndex(adrs: Adr[]): string {
  const rows = [...adrs].sort((a, b) => a.num - b.num)
    // 标签转义 `|`;链接目标编码 —— 文件名过了 slugify,标题没有,两边规则不同
    .map(a => `| **ADR-${pad(a.num)}** | [${escapeCell(a.title)}](${encodeTarget(a.file)}) |`)
  return ['| 编号 | 结论 |', '|---|---|', ...rows, ''].join('\n')
}

/**
 * 生成区标记的形状。`--write` 是 `slice(0, i) + want + slice(j + end.length)` ——
 * 这个式子只在**恰好一对、BEGIN 在前**时成立,所以两个都在还不够:
 *
 * | 形状 | 回写会怎样 |
 * |---|---|
 * | 缺任一个 | 下标为 −1,切出来的位置全错 |
 * | END 在 BEGIN 前 | 两个下标都非负、判断放行,而前半段留下 END、后半段又把 BEGIN 抄一遍 —— **索引被写坏**,而这条命令正是报错时让人去跑的那条 |
 * | 不止一对 | `indexOf` 只认第一个,多出来的那对留在生成区里,下一次比对永远不一致,提示还是「跑 `--write`」—— 一个自己修不好自己的循环 |
 *
 * 判不准时**不动**:回写会盖掉内容,报错让人看一眼,比动了便宜。
 */
export type MarkerFault = 'missing' | 'reversed' | 'duplicate'

export function markerFault(text: string, begin: string, end: string): MarkerFault | null {
  const i = text.indexOf(begin)
  const j = text.indexOf(end)
  if (i < 0 || j < 0) return 'missing'
  if (j < i) return 'reversed'
  if (text.indexOf(begin, i + 1) >= 0 || text.indexOf(end, j + 1) >= 0) return 'duplicate'
  return null
}

/**
 * 历史文件指纹表：`docs/adr/` 下与索引并列的一份 JSON，不是记录、不进索引。
 *
 * 一份历史文件一行：到上次 `--write` 为止它有多少字节、这些字节的 sha256。
 * 历史文件只加不删（ADR-211，主文件只放现行结论那一份）—— 钉住的那一段一个字节都不许变，
 * 新的话只能接在末尾。按行号写的老状态行改去认历史文件同一行号，靠的就是这一段不动。
 */
export const PINS_FILE = '历史文件指纹.json'

export interface Pin { bytes: number; sha256: string }

export const pinOf = (data: Buffer): Pin =>
  ({ bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') })

/** 指纹表的样子由内容决定：按文件名排、两格缩进、末尾换行 —— 比字符串就知道钉没钉到最新 */
export function renderPins(history: Array<{ file: string; data: Buffer }>): string {
  const out: Record<string, Pin> = {}
  for (const h of [...history].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) out[h.file] = pinOf(h.data)
  return JSON.stringify(out, null, 2) + '\n'
}

/** 读进来的指纹表形状不对，就当没钉过会放过一切 —— 形状先报出来 */
export function parsePins(text: string): { pins: Record<string, Pin>; errors: string[] } {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { pins: {}, errors: [`${PINS_FILE} 不是合法的 JSON`] } }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { pins: {}, errors: [`${PINS_FILE} 应是一个对象：文件名 → { bytes, sha256 }`] }
  const pins: Record<string, Pin> = {}
  const errors: string[] = []
  for (const [file, v] of Object.entries(raw as Record<string, unknown>)) {
    const p = v as Partial<Pin> | null
    if (typeof p !== 'object' || p === null || !Number.isSafeInteger(p.bytes) || (p.bytes as number) < 0
      || typeof p.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(p.sha256)) {
      errors.push(`${PINS_FILE} 里 ${file} 那一项应为 { bytes: 非负整数, sha256: 64 位十六进制 }`)
      continue
    }
    pins[file] = { bytes: p.bytes as number, sha256: p.sha256 }
  }
  return { pins, errors }
}

/**
 * 历史文件只加不删的判定。`errors` 是改了或删了钉住的内容；`unpinned` 是末尾有新加的、
 * 或整份是新的、还没钉住 —— 后者不算错，跑一次 `--write` 钉上就好。
 */
export function pinFaults(pins: Record<string, Pin>, history: Array<{ file: string; data: Buffer }>): { errors: string[]; unpinned: string[] } {
  const errors: string[] = []
  const unpinned: string[] = []
  const have = new Set(history.map(h => h.file))
  for (const f of Object.keys(pins).sort()) {
    if (!have.has(f)) errors.push(`${PINS_FILE} 钉着 ${HISTORY_DIR}/${f}，历史目录里却没有这一份 —— 历史文件只加不删`)
  }
  for (const h of history) {
    const pin = pins[h.file]
    if (!pin) { unpinned.push(h.file); continue }
    if (h.data.length < pin.bytes) {
      errors.push(`${HISTORY_DIR}/${h.file} 比钉住时短了（${h.data.length} 字节，钉住时 ${pin.bytes}）—— 历史文件只加不删`)
      continue
    }
    if (pinOf(h.data.subarray(0, pin.bytes)).sha256 !== pin.sha256) {
      errors.push(`${HISTORY_DIR}/${h.file} 钉住的前 ${pin.bytes} 字节被改了 —— 历史文件只加不删，新的话接在末尾`)
      continue
    }
    if (h.data.length > pin.bytes) unpinned.push(h.file)
  }
  return { errors, unpinned }
}

const INDEX_BEGIN = '<!-- BEGIN:GENERATED 由 npm run adr 生成，勿手改 -->'
const INDEX_END = '<!-- END:GENERATED -->'
const LEGACY = 'DECISIONS.md'
/**
 * 整册里的记录标题。**两级都认**:`##` 是旧整册的写法,`#` 是拆开后单文件的写法。
 *
 * 只认 `##` 的话,一条照**新**格式误写进转发页的记录会溜过去 —— 它既不在
 * `docs/adr/`,也不在索引里,而检查是绿的。
 */
const RECORD_HEADING = /^#{1,2}\s+ADR-(\d+)\s+(.+?)\s*$/
const MARKER_FAULT: Record<MarkerFault, string> = {
  missing: '缺少 BEGIN/END 标记',
  reversed: '的 END 标记在 BEGIN 之前 —— 手工调回来再跑 `--write`',
  duplicate: '的 BEGIN/END 标记不止一对 —— 手工只留一对再跑 `--write`',
}

/**
 * 主干上的那份指纹表，没有就交回 `null`（ADR-211 的欠条「历史文件指纹只靠评审看 diff 守着」）。
 * 本树的指纹表这条分支自己改得动：钉过的一行被删掉（或整份换成 `{}`），本树只看得出「整份还没钉过」，
 * `--write` 就把改过的内容照钉上去。主干上那份这条分支改不动，所以拿它再比一遍。
 * 找主干的顺序同体量闸门（`TRUNK_CANDIDATES`），取的是这边与主干的分叉点（`merge-base`）上那份，同体量闸门：
 * 落后于主干的分支不会因为主干后来新钉的历史文件报红，分叉点上那份这条分支同样改不动。
 * 不是 git 仓库、找不到主干、没有分叉点、分叉点上还没有这份表，都答 `null`：
 * 没有可比的，只比本树。分叉点上有这份表、却读不出来（`git show` 失败），交回 `{ unreadable }`：
 * 那不是「没有可比的」，要报红、拦住 `--write`，否则这一下失败就等于把比主干那一道静默关掉。
 * 有没有这份表先用 `ls-tree` 问（没有时它照常成功、什么都不打），读不出来与没有才分得开。
 */
export function trunkPinsText(ask: GitAsk): string | null | { unreadable: string } {
  const trunk = TRUNK_CANDIDATES.find(r => ask('rev-parse', '--verify', `${r}^{commit}`) !== null)
  if (trunk === undefined) return null
  // 比分叉点，不比主干头：还没合进主干新钉的那几份，这边本来就没有，不该报红
  const base = ask('merge-base', trunk, 'HEAD')
  if (base === null) return null
  const listed = ask('ls-tree', '--name-only', base, '--', `docs/adr/${PINS_FILE}`)
  if (listed === null) return { unreadable: `问不出分叉点 ${base} 上有没有 docs/adr/${PINS_FILE}` }
  if (listed === '') return null
  return ask('show', `${base}:docs/adr/${PINS_FILE}`) ?? { unreadable: `分叉点 ${base} 上有 docs/adr/${PINS_FILE}，却读不出来` }
}

/**
 * `npm run adr` 整条：在仓库根 `root` 下读 `docs/adr/`，判、比，`write` 时回写索引与指纹表。
 *
 * 入口只剩打印与退出码，读目录、跳过历史目录、核历史文件这些接线都在这里 ——
 * 留在入口里的话需求测试够不着，删掉一行检查链照样全绿（ADR-211 的欠条「两处入口接线没有测试」）。
 * 给了 `ask`（入口给的是真 git）就再拿主干上的指纹表比一遍，见 `trunkPinsText`；玩具目录不给，只比本树。
 */
export function adrSync(root: string, write: boolean, ask?: GitAsk): { ok: boolean; out: string[]; err: string[] } {
  const dir = join(root, 'docs', 'adr')
  const index = join(dir, 'README.md')
  const pinsPath = join(dir, PINS_FILE)
  if (!existsSync(dir)) return { ok: false, out: [], err: ['✗ 决策记录：缺少 docs/adr/'] }

  const errors: string[] = []
  const adrs: Adr[] = []
  for (const file of readdirSync(dir).sort()) {
    if (file === 'README.md' || file === PINS_FILE) continue
    // 历史文件不是记录、不进索引，下面单独核
    if (file === HISTORY_DIR && statSync(join(dir, file)).isDirectory()) continue
    const m = FILE_RE.exec(file)
    if (!m) { errors.push(`${file} 文件名不合格式，应为 ADR-<编号>-<标题>.md`); continue }
    const text = readFileSync(join(dir, file), 'utf8')
    const h = HEAD_RE.exec(text.split('\n')[0])
    if (!h) { errors.push(`${file} 第一行不是 \`# ADR-<编号> <标题>\``); continue }
    adrs.push({ file, num: Number(h[1]), title: h[2] })
    // 新记录要带「要用到的事实，各找谁要」那一节（ADR-224）；旧的不查
    errors.push(...factTableFaults(file, Number(h[1]), text))
  }
  errors.push(...checkAll(adrs))

  const historyDir = join(dir, HISTORY_DIR)
  let history: Array<{ file: string; data: Buffer }> = []
  // `历史` 是个普通文件时，上面已按文件名不合格式报过；这里不当目录去读 —— 读了会直接抛错
  if (existsSync(historyDir) && statSync(historyDir).isDirectory()) {
    const names = readdirSync(historyDir).sort()
    const isFile = (f: string) => statSync(join(historyDir, f)).isFile()
    // 不是文件的（子目录）先报出来，不去读它 —— 读一个目录会直接抛错，报的就不是哪里不对了
    for (const f of names.filter(f => !isFile(f))) errors.push(`${HISTORY_DIR}/${f} 不是文件 —— 历史目录里只放与主文件同名的历史文件`)
    history = names.filter(isFile).map(file => ({ file, data: readFileSync(join(historyDir, file)) }))
    errors.push(...historyFaults(adrs.map(a => a.file),
      history.map(h => ({ file: h.file, first: h.data.toString('utf8').split('\n')[0] }))))
  }
  const pinsText = existsSync(pinsPath) ? readFileSync(pinsPath, 'utf8') : ''
  const parsed = pinsText ? parsePins(pinsText) : { pins: {}, errors: [] }
  errors.push(...parsed.errors)
  const { errors: pinErrors, unpinned } = pinFaults(parsed.pins, history)
  errors.push(...pinErrors)
  // 主干钉过的每一份：这边还在、不比钉住时短、钉住的那段一个字节没变。比出错就和本树的错一样拦住 `--write`
  const trunkText = ask ? trunkPinsText(ask) : null
  if (trunkText !== null && typeof trunkText !== 'string') errors.push(`主干上的指纹表：${trunkText.unreadable} —— 比不了主干，按出错处理`)
  else if (trunkText !== null) {
    const trunk = parsePins(trunkText)
    errors.push(...trunk.errors.map(e => `主干上的 ${e}`))
    errors.push(...pinFaults(trunk.pins, history).errors.map(e => `比主干上的指纹表：${e}`))
  }

  /** 拆开之后 `DECISIONS.md` 只做转发。写回整册就是把冲突面又装回去。 */
  const legacy = join(root, LEGACY)
  if (existsSync(legacy)) {
    const src = readFileSync(legacy, 'utf8')
    const mask = quotedMask(src)
    // 引文里的示例不算 —— 转发页本来就要举例说明记录长什么样
    if (src.split('\n').some((l, i) => !mask[i] && RECORD_HEADING.test(l))) {
      errors.push(`${LEGACY} 里又出现了记录标题(\`# ADR-\` 或 \`## ADR-\`)`
        + ' —— 记录写进 docs/adr/，一条一个文件')
    }
  }

  const indexText = existsSync(index) ? readFileSync(index, 'utf8') : ''
  const fault = markerFault(indexText, INDEX_BEGIN, INDEX_END)
  if (fault) errors.push(`docs/adr/README.md ${MARKER_FAULT[fault]}`)

  if (errors.length) return { ok: false, out: [], err: [`✗ 决策记录：${errors.length} 项`, '', ...errors.map(e => `  · ${e}`)] }

  const i = indexText.indexOf(INDEX_BEGIN)
  const j = indexText.indexOf(INDEX_END)
  const want = `${INDEX_BEGIN}\n\n${renderIndex(adrs)}${INDEX_END}`
  const wantPins = history.length ? renderPins(history) : ''
  if (write) {
    writeFileSync(index, indexText.slice(0, i) + want + indexText.slice(j + INDEX_END.length), 'utf8')
    if (wantPins !== pinsText) {
      // 历史文件都没了，指纹表也不留空文件
      if (wantPins) writeFileSync(pinsPath, wantPins, 'utf8'); else rmSync(pinsPath, { force: true })
    }
    return { ok: true, out: ['✓ 决策记录：索引与历史文件指纹已回写'], err: [] }
  }
  if (indexText.slice(i, j + INDEX_END.length) !== want) {
    return { ok: false, out: [], err: ['✗ 决策记录：docs/adr/README.md 的索引与目录不一致', '  跑 `npm run adr -- --write` 回写'] }
  }
  if (wantPins !== pinsText) {
    // 整份没钉过的与末尾新加的分开说：钉过的被人从指纹表里删掉，--write 会把改过的内容重新钉上，评审要看得出是哪一种
    const fresh = unpinned.filter(f => !(f in parsed.pins)), grown = unpinned.filter(f => f in parsed.pins)
    const what = [
      ...fresh.length ? [`${fresh.map(f => `${HISTORY_DIR}/${f}`).join('、')} 整份还没钉过（新拆的记录才会这样；钉过的又被从 ${PINS_FILE} 删掉的话，--write 会把改过的内容钉上去）`] : [],
      ...grown.length ? [`${grown.map(f => `${HISTORY_DIR}/${f}`).join('、')} 末尾有还没钉住的新内容`] : [],
    ].join('；') || `${PINS_FILE} 与历史目录对不上`
    return { ok: false, out: [], err: [`✗ 决策记录：${what}`, '  跑 `npm run adr -- --write` 钉住'] }
  }
  const nums = adrs.map(a => a.num).sort((a, b) => a - b)
  return { ok: true, out: [`✓ 决策记录：${adrs.length} 条，编号 ${nums[0]}–${nums[nums.length - 1]}，索引一致`
    + (history.length ? `，历史文件 ${history.length} 份只加未改` : '')], err: [] }
}
