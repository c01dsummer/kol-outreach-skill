/**
 * P2：开发信里每一句都要登记它从哪来（ADR-210 管写博主的话，ADR-215 扩到整封信）。
 *
 * Agent 写草稿时，在评审正本里给信里每一句登记一条出处：信里那句（`draft`），
 * 依据的是哪一样（`from`）—— 博主自己的资料（简介、作品文案、昵称）、任务里已证实的产品事实，
 * 或者 `self` = 发件人自己的话（问候、提议、感受、约时间、联系方式、落款）—— 以及资料里的原文片段（`quote`）。
 * 约时间、联系方式那几个字由 Agent 单独登记一条 `self`，并标上 `purpose`（`schedule` 约时间、`contact` 联系方式）：
 * 机器不猜哪个数字是约时间，只认这条标注（ADR-215 第三节）。
 * 这里只做两件确定的事：
 *
 * 1. 对账：登记的原文片段确实在那一样资料里逐字出现；登记的那句确实还在信里。
 * 2. 点名：信里有字没被任何登记盖住的那一行列出来。列不列只看「有没有字没被盖住」，
 *    不猜哪句在说博主、哪句是问候（ADR-215 第二节）；报告按换行分组显示，不切句（ADR-215 第九节）。
 *
 * 改写得准不准，机器判断不了 —— 报告把「信里这句」和「原文」并排放，交给人看。
 * **只标不拦**：结果只进评审 HTML，草稿一个字节不改（P2.b），也不让导出失败。
 */

/** 能当出处的：博主自己写的文字、任务里已证实的产品事实、发件人自己的话。Agent 评审里记的观察与证据是 Agent 自己的话，不算。 */
export const DRAFT_SOURCE_KINDS = ['bio', 'post', 'nickname', 'product', 'self'] as const
export type DraftSourceKind = typeof DRAFT_SOURCE_KINDS[number]
type QuotedKind = Exclude<DraftSourceKind, 'self'>

export interface DraftSource {
  /** 信里那一句或那一段，照抄草稿原文 */
  draft: string
  from: DraftSourceKind
  /** 资料里的原文片段；`from` 为 `self` 时不写 */
  quote?: string
  /** 只有 `from` 为 `self` 时可写：这一段是约时间（`schedule`）还是联系方式（`contact`）。 */
  purpose?: DraftSourcePurpose
}

/** 发件人自己的话里，Agent 明着标出的两种用途（P2.e）。 */
export const DRAFT_SOURCE_PURPOSES = ['schedule', 'contact'] as const
export type DraftSourcePurpose = typeof DRAFT_SOURCE_PURPOSES[number]
const PURPOSE_LABEL: Record<DraftSourcePurpose, string> = { schedule: '约时间', contact: '联系方式' }

/**
 * 对账要用到的资料：博主的简介、作品文案、昵称，和任务里已证实的产品事实原文。
 * 博主那几样类型写成 unknown：名单可能被手改坏，这一行只认字符串，别的一律当没有，不让 render 因此失败（P2.g）。
 * 三态照名单原样传（P1）：`bio` 缺席是没查过简介，`null` 是查过、他没写；`posts` 缺席或空数组都是没查过他的作品
 * （名单里 `recent_posts` 缺席或为空数组都是「没问过」，不是他没作品）。
 * `facts` 缺席或空数组都是「任务里没有已证实的产品事实」：登记成产品事实的原文一律对不上。
 */
export interface SourceText {
  bio?: unknown
  posts?: readonly unknown[]
  nickname?: unknown
  facts?: readonly string[]
}

const KIND_LABEL: Record<QuotedKind, string> = {
  bio: '简介', post: '作品文案', nickname: '昵称', product: '产品事实',
}

/** 一个字归一后的写法：全角半角统一、弯引号改直引号、长短破折号改连字符、不分大小写。 */
function foldPiece(piece: string): string {
  return piece.normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
}

/**
 * 比对前的统一写法，同时记下归一后每个字来自原文哪一段（`from`、`to` 是原文里的下标）。
 * 按「一个字母、数字或符号加它后面的附加符号」一段一段归一，别的每个字自成一段：空白合并成一个空格、去掉头尾空白。
 * 草稿、登记、原文都走这一个函数，两边口径一致；记下来处是为了把「哪些字被登记成发件人自己的话」
 * 换回原文下标，交给数字扫描用（ADR-215 第三节）。
 */
function normalized(raw: string): { text: string; from: number[]; to: number[] } {
  let text = ''
  const from: number[] = [], to: number[] = []
  let space = -1
  // 附加符号只跟在字母、数字、符号后面并成一段（合字只发生在这几类上：e+´ 合成 é、=+̸ 合成 ≠）；
  // 跟在空白、标点、换行后面或打头的附加符号自成一段，来处记在它自己的位置 ——
  // 不然它会和前面那个不用登记的空白或「Subject:」字样共用一个来处，被一起跳过。
  for (const m of raw.matchAll(/[\p{L}\p{N}\p{S}]\p{M}*|[^]/gsu)) {
    const start = m.index, end = start + m[0].length
    for (const ch of foldPiece(m[0])) {
      if (/\s/u.test(ch)) { if (space < 0) space = start; continue }
      if (space >= 0 && text !== '') { text += ' '; from.push(space); to.push(space + 1) }
      space = -1
      for (let i = 0; i < ch.length; i++) { text += ch[i]; from.push(start); to.push(end) }
    }
  }
  return { text, from, to }
}

/** 比对前的统一写法（见 `normalized`）。 */
export function normalizeText(text: string): string {
  return normalized(text).text
}

/** 换行的认法与拆主题列（`draftSubject`，U13.a）一致：\r\n、\r、\n、\u2028、\u2029 都算一行的结尾。 */
const LINE_BREAK = /\r\n|\r|\n|\u2028|\u2029/g
/** 第一个非空行以 Subject: 开头时是主题行，「Subject:」字样不算要登记的字（和拆主题列的规矩 U13.a 一致）。 */
const SUBJECT = /^\s*subject\s*[:：]\s*/i

const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined

/**
 * 报告按行分组：信按换行切开，每一行（去掉头尾空白）是一个显示单位；主题行去掉「Subject:」字样。
 * 不切句：切句要猜句子边界（缩写、引号、列表编号、数字里的点），猜错就漏列或拆碎（ADR-215 第九节）。
 * `start`、`end` 是这一行要登记的字在草稿原文里的下标。
 */
type Line = { start: number; end: number; text: string }
function lines(draft: string): Line[] {
  const out: Line[] = []
  let first = true
  const add = (start: number, end: number) => {
    if (draft.slice(start, end).trim() === '') return
    if (first) { first = false; start += SUBJECT.exec(draft.slice(start, end))?.[0].length ?? 0 }
    const body = draft.slice(start, end).trim()
    if (body) out.push({ start, end, text: body })
  }
  let start = 0
  for (const m of draft.matchAll(LINE_BREAK)) { add(start, m.index); start = m.index + m[0].length }
  add(start, draft.length)
  return out
}

/** 登记的原文对不对得上：对得上、对不上（资料查过但里面没有这段），或没查过（那一样资料没取回来，无从对）。 */
function quoteVerdict(source: DraftSource & { from: QuotedKind }, given: SourceText): 'matched' | 'quote_missing' | 'not_queried' {
  let fields: readonly string[]
  if (source.from === 'bio') {
    if (given.bio === undefined) return 'not_queried'
    const bio = text(given.bio)
    fields = bio === undefined ? [] : [bio]
  } else if (source.from === 'post') {
    if (given.posts === undefined || given.posts.length === 0) return 'not_queried'
    fields = given.posts.flatMap(post => { const desc = text(post); return desc === undefined ? [] : [desc] })
  } else if (source.from === 'product') {
    fields = (given.facts ?? []).filter(fact => typeof fact === 'string')
  } else {
    const nickname = text(given.nickname)
    if (nickname === undefined) return 'not_queried'
    fields = [nickname]
  }
  const quote = source.quote === undefined ? '' : normalizeText(source.quote)
  return quote !== '' && fields.some(field => normalizeText(field).includes(quote)) ? 'matched' : 'quote_missing'
}

export type DraftSourceItem =
  | { status: 'matched'; draft: string; from: QuotedKind; quote: string }
  | { status: 'quote_missing'; draft: string; from: QuotedKind; quote: string }
  | { status: 'not_queried'; draft: string; from: QuotedKind; quote: string }
  | { status: 'self'; draft: string; purpose?: DraftSourcePurpose }
  | { status: 'not_in_draft'; draft: string }
  | { status: 'partial'; draft: string; rest: string }
  | { status: 'unregistered'; draft: string }

/**
 * 覆盖按整封信的字算：每条登记在（归一后的）信里出现的每一处都标成盖住，登记跨不跨行都一样。
 * 哪一行还有字没被盖住，哪一行就列出来（ADR-210 第六节、ADR-215 第九节）。
 */
function coverage(normalizedDraft: string, keys: readonly string[]): boolean[] {
  const covered = new Array<boolean>(normalizedDraft.length).fill(false)
  for (const key of keys) {
    if (!key) continue
    for (let at = normalizedDraft.indexOf(key); at >= 0; at = normalizedDraft.indexOf(key, at + 1)) {
      for (let i = at; i < at + key.length; i++) covered[i] = true
    }
  }
  return covered
}

/**
 * 一段里有没有要登记的话：纯空白与标点不算；花括号算（写信说明里没填的占位符写成 `{...}`，整段是标点也要登记）。
 */
const hasWords = (text: string): boolean => /[^\s\p{P}]|[{}]/u.test(text)

/**
 * 一行（归一后的第 `at` 到第 `end` 个字）有没有被碰到；没被盖住的部分照草稿原文的写法（`show` 换回原文）按原顺序用「…」连起来，
 * 全盖住时 `rest` 为 ''。哪段要列由 `keep` 按归一后的字判（全角花括号归一成 `{}` 才认得出是占位符），印的是原文。
 */
function uncovered(
  covered: readonly boolean[], at: number, end: number,
  keep: (from: number, to: number) => boolean, show: (from: number, to: number) => string,
): { touched: boolean; rest: string } {
  let touched = false
  const pieces: string[] = []
  let start = -1
  for (let i = at; i <= end; i++) {
    if (i < end && !covered[i]) { if (start < 0) start = i; continue }
    if (i < end) touched = true
    // 只丢纯空白与标点的剩余段；表情、符号（🔥、=、>>>）也是没登记的话，照列。
    if (start >= 0) { if (keep(start, i)) pieces.push(show(start, i).trim()); start = -1 }
  }
  return { touched, rest: pieces.join('…') }
}

/**
 * 对一封草稿出逐条结果，按在草稿里出现的先后排；没草稿或只有空白时返回 undefined（不出这一行）。
 * 登记的那段已经不在信里的，排在最后（草稿改过、登记没跟着改）。
 */
export function draftSourceItems(
  draft: string | undefined, sources: readonly DraftSource[] | undefined, given: SourceText,
): DraftSourceItem[] | undefined {
  if (draft === undefined || draft.trim() === '') return undefined
  const { text: normalizedDraft, from, to } = normalized(draft)
  const show = (start: number, end: number) => draft.slice(from[start], to[end - 1])
  const keep = (start: number, end: number) => hasWords(normalizedDraft.slice(start, end))
  const registered = (sources ?? []).map(source => ({ source, key: normalizeText(source.draft) }))
  const covered = coverage(normalizedDraft, registered.map(r => r.key))
  const placed: Array<{ at: number; item: DraftSourceItem }> = []
  const missing: DraftSourceItem[] = []
  for (const { source, key } of registered) {
    const at = key ? normalizedDraft.indexOf(key) : -1
    if (at < 0) { missing.push({ status: 'not_in_draft', draft: source.draft }); continue }
    const item: DraftSourceItem = source.from === 'self'
      ? { status: 'self', draft: source.draft, ...(source.purpose === undefined ? {} : { purpose: source.purpose }) }
      : { status: quoteVerdict({ ...source, from: source.from }, given), draft: source.draft, from: source.from, quote: source.quote === undefined ? '' : source.quote }
    placed.push({ at, item })
  }
  // 每一行看它的字有没有被登记盖住：归一后的字按来处（原文下标）分到各行，换行与「Subject:」字样不归任何一行。
  let i = 0
  for (const line of lines(draft)) {
    while (i < from.length && from[i] < line.start) i++
    const begin = i
    while (i < from.length && from[i] < line.end) i++
    const { touched, rest } = uncovered(covered, begin, i, keep, show)
    if (touched && rest) placed.push({ at: begin, item: { status: 'partial', draft: line.text, rest } })
    else if (!touched && hasWords(normalizedDraft.slice(begin, i))) placed.push({ at: begin, item: { status: 'unregistered', draft: line.text } })
  }
  placed.sort((a, b) => a.at - b.at)
  return [...placed.map(p => p.item), ...missing]
}

/** 一条结果在报告里的写法。 */
export function draftSourceText(item: DraftSourceItem): string {
  switch (item.status) {
    case 'matched': return `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」`
    case 'quote_missing': return item.from === 'product'
      ? `「${item.draft}」← 产品事实原文「${item.quote}」（原文对不上：任务里已证实的产品事实没有这段）`
      : `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」（原文对不上：他的${KIND_LABEL[item.from]}里没有这段）`
    case 'not_queried': return `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」（对不了：他的${KIND_LABEL[item.from]}没查过）`
    case 'self': return item.purpose === undefined ? `「${item.draft}」` : `「${item.draft}」（${PURPOSE_LABEL[item.purpose]}）`
    case 'not_in_draft': return `「${item.draft}」（登记了出处，但信里已经没有这段）`
    case 'partial': return `「${item.draft}」（只登记了其中一段，没登记的：「${item.rest}」）`
    case 'unregistered': return `「${item.draft}」（没登记出处）`
  }
}

/**
 * 报告那一行的内容。分三段，要人看的在前：「要看：」原文对不上、没查过、只登记了一部分、没登记、信里已没有的；
 * 「对得上：」并排的信里这段与原文；「发件人自己的话：」登记成 self 的。每段内按在信里出现的先后、用「；」连；
 * 空的段不出，三段都空写「无」；没草稿返回 undefined。
 */
export function draftSourceLine(
  draft: string | undefined, sources: readonly DraftSource[] | undefined, given: SourceText,
): string | undefined {
  const items = draftSourceItems(draft, sources, given)
  if (items === undefined) return undefined
  const look = items.filter(item => item.status !== 'matched' && item.status !== 'self')
  const ok = items.filter(item => item.status === 'matched')
  const self = items.filter(item => item.status === 'self')
  const parts = [['要看', look], ['对得上', ok], ['发件人自己的话（确认没有借它给博主安新说法，也没有夹带产品说法）', self]] as const
  const line = parts.filter(([, list]) => list.length).map(([label, list]) => `${label}：${list.map(draftSourceText).join('；')}`)
  if (line.length === 0) return '无'
  // 「要看」那一段空着时明写一句，运营不用从下一段的开头去推断没问题。
  return (look.length ? line : ['要看：无', ...line]).join('　｜　')
}

/**
 * 草稿里哪些字被 Agent 明着标成约时间、联系方式（`self` 且带 `purpose`），换成原文下标给数字扫描用（P2.c 与 ADR-215 第三节）：
 * 返回的函数回答「草稿原文从 `at` 起、长 `length` 的这一段，除空白外每个字是不是都在这几条登记里」。
 * 登记在信里出现的每一处都算；没有这类登记时一律答否。没标 `purpose` 的 `self` 登记不算 —— 机器不猜哪个数字是约时间。
 */
export function senderOwnSpans(draft: string, sources: readonly DraftSource[] | undefined): (at: number, length: number) => boolean {
  const own = (sources ?? []).filter(source => source.from === 'self' && source.purpose !== undefined).map(source => normalizeText(source.draft))
  if (own.length === 0) return () => false
  const { text: normalizedDraft, from, to } = normalized(draft)
  const covered = coverage(normalizedDraft, own)
  const raw = new Array<boolean>(draft.length).fill(false)
  covered.forEach((yes, i) => { if (yes) for (let j = from[i]; j < to[i]; j++) raw[j] = true })
  return (at, length) => {
    let any = false
    for (let i = at; i < at + length; i++) {
      if (/\s/u.test(draft[i])) continue
      if (!raw[i]) return false
      any = true
    }
    return any
  }
}

/** 正本校验用：一条登记的形状问题，没问题返回空数组。`at` 是这条在正本里的位置。 */
export function draftSourceProblems(value: unknown, at: string): string[] {
  if (!Array.isArray(value)) return [`${at} 必须是数组`]
  const problems: string[] = []
  value.forEach((entry, index) => {
    const here = `${at}[${index}]`
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) { problems.push(`${here} 必须是对象`); return }
    const record = entry as Record<string, unknown>
    for (const key of Object.keys(record)) {
      if (!['draft', 'from', 'quote', 'purpose'].includes(key)) problems.push(`${here}.${key} 不认得（只有 draft、from、quote、purpose）`)
    }
    if (typeof record.draft !== 'string' || record.draft.trim() === '') problems.push(`${here}.draft 必须是非空字符串`)
    if (!(DRAFT_SOURCE_KINDS as readonly unknown[]).includes(record.from)) {
      problems.push(`${here}.from 必须是 ${DRAFT_SOURCE_KINDS.join('、')} 之一`)
      return
    }
    if (record.from === 'self') {
      if (record.quote !== undefined) problems.push(`${here}.quote 发件人自己的话不写原文`)
      if (record.purpose !== undefined && !(DRAFT_SOURCE_PURPOSES as readonly unknown[]).includes(record.purpose)) {
        problems.push(`${here}.purpose 必须是 ${DRAFT_SOURCE_PURPOSES.join('、')} 之一（约时间、联系方式）`)
      }
    } else if (record.purpose !== undefined) {
      problems.push(`${here}.purpose 只有发件人自己的话（from 为 self）才写`)
    }
    if (record.from !== 'self' && (typeof record.quote !== 'string' || record.quote.trim() === '')) {
      problems.push(`${here}.quote 必须是非空字符串（资料里的原文片段）`)
    }
  })
  return problems
}
