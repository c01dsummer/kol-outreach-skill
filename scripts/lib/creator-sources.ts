/**
 * P2：开发信里写博主的话，要能指回他自己资料里的原文（ADR-210）。
 *
 * Agent 写草稿时，在评审正本里给每一句写博主的话登记一条出处：信里那句（`draft`），
 * 依据的是哪一样资料（`from`：简介、作品文案、昵称；或者 `self` = 发件人自己的话，不是在描述博主），
 * 以及资料里的原文片段（`quote`）。这里只做两件确定的事：
 *
 * 1. 对账：登记的原文片段确实在那一样资料里逐字出现；登记的那句确实还在信里。
 * 2. 点名：信里提到博主（you / your 这一类词、昵称里的名字、账号名）却没有登记出处的句子列出来；
 *    一句里只登记了一段的，整句印出来并标「只登记了一部分」—— 登记半句不能盖住整句（ADR-210 第六节）。
 *
 * 改写得准不准，机器判断不了 —— 报告把「信里这句」和「他原文」并排放，交给人看。
 * **只标不拦**：结果只进评审 HTML，草稿一个字节不改（P2.b），也不让导出失败。
 */

/** 能当出处的资料：只认博主自己写的文字。Agent 评审里记的观察与证据是 Agent 自己的话，不算。 */
export const CREATOR_SOURCE_KINDS = ['bio', 'post', 'nickname', 'self'] as const
export type CreatorSourceKind = typeof CREATOR_SOURCE_KINDS[number]

export interface CreatorSource {
  /** 信里那一句或那一段，照抄草稿原文 */
  draft: string
  from: CreatorSourceKind
  /** 资料里的原文片段；`from` 为 `self` 时不写 */
  quote?: string
}

/**
 * 对账要用到的博主资料：简介、作品文案、昵称、账号名。
 * 类型写成 unknown：名单可能被手改坏，这一行只认字符串，别的一律当没有，不让 render 因此失败（P2.g）。
 * 三态照名单原样传（P1）：`bio` 缺席是没查过简介，`null` 是查过、他没写；`posts` 缺席或空数组都是没查过他的作品
 * （名单里 `recent_posts` 缺席或为空数组都是「没问过」，不是他没作品）。
 */
export interface CreatorText {
  bio?: unknown
  posts?: readonly unknown[]
  nickname?: unknown
  handle?: unknown
}

const KIND_LABEL: Record<Exclude<CreatorSourceKind, 'self'>, string> = {
  bio: '简介', post: '作品文案', nickname: '昵称',
}

/** 比对前的统一写法：全角半角统一、弯引号改直引号、不分大小写、空白合并成一个空格。 */
export function normalizeText(text: string): string {
  return text.normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

/** 第二人称：信里出现这些词，这一句就是在对博主说话，多半在说他。弯撇号先归一成直撇号再认。 */
const YOU = /\b(?:you|your|yours|yourself|yourselves|you're|you've|you'll|you'd)\b/i
/** 问候行：Hi/Hello/Hey/Dear 开头、不超过五个词、而且没有 you 一类词的一行只是称呼，不算描述。 */
const GREETING = /^(?:hi|hello|hey|dear)\b/i
const isGreeting = (line: string): boolean =>
  GREETING.test(line) && line.split(/\s+/).length <= 5 && !YOU.test(normalizeText(line))
/** 第一个非空行以 Subject: 开头时是主题行，冒号后面那段自成一句，不和下面的正文接起来（同 U13.a）。 */
const SUBJECT = /^subject\s*[:：]\s*/i
/** 列表行（-、*、•、1. 1) 开头）各自成句，不和上下行接起来。 */
const LIST_ITEM = /^(?:[-*•·]|\d+[.)])\s+/
/** 句点前是这些缩写或单个字母时不切句：「Dr. Oz」「U.S.」不在中间断开。 */
const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'vs', 'etc', 'e.g', 'i.e', 'u.s', 'u.k', 'no', 'prof', 'mt'])
/** 昵称里常见、但不是名字的词：不拿它们认「提到了博主」，免得每句带 the、with 的话都被列。 */
const NAME_STOPWORDS = new Set(['the', 'and', 'with', 'for', 'from', 'official', 'channel', 'daily', 'life', 'by', 'of', 'tv', 'real', 'its', 'his', 'her', 'our', 'your', 'you'])

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined

/** 昵称、账号里的名字：驼峰拆开（TechWithSarah → Tech、With、Sarah），取三个字母以上、不在停用词里的词，整词出现就算提到了他。 */
function nameWords(creator: CreatorText): RegExp[] {
  const words = new Set<string>()
  for (const source of [text(creator.nickname), text(creator.handle)]) {
    if (source === undefined) continue
    const split = source.normalize('NFKC').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    for (const word of split.match(/\p{L}{3,}/gu) ?? []) {
      const lower = word.toLowerCase()
      if (!NAME_STOPWORDS.has(lower)) words.add(lower)
    }
  }
  return [...words].map(word => new RegExp(`(?<![\\p{L}\\p{N}_.])${escapeRegExp(word)}(?![\\p{L}\\p{N}_])`, 'iu'))
}

/** 在一行正文里切句：句末标点（. ! ? …）后面可带收尾的引号括号，再跟空白、行尾或大写字母开头处切；缩写与单个字母后的句点不切。 */
function splitSentences(line: string): string[] {
  const out: string[] = []
  let start = 0
  const re = /[.!?…]+["'”’)\]]*/g
  for (let m = re.exec(line); m !== null; m = re.exec(line)) {
    const end = m.index + m[0].length
    const next = line.slice(end)
    if (next !== '' && !/^\s/.test(next) && !/^\p{Lu}/u.test(next)) continue
    if (m[0].startsWith('.')) {
      const before = /([\p{L}.]+)$/u.exec(line.slice(start, m.index))?.[1].toLowerCase()
      if (before !== undefined && (before.length === 1 || ABBREVIATIONS.has(before))) continue
    }
    const piece = line.slice(start, end).trim()
    if (piece) out.push(piece)
    start = end
  }
  const rest = line.slice(start).trim()
  if (rest) out.push(rest)
  return out
}

/** 把草稿切成句：空行分段，段内折行接回一行（信常常手动折行），列表行各自成句；主题行（第一个非空行）自成一句；问候行跳过。 */
function sentences(draft: string): string[] {
  const out: string[] = []
  let first = true
  for (const paragraph of draft.split(/\r?\n\s*\r?\n/)) {
    const body: string[] = []
    const flush = () => { if (body.length) out.push(...splitSentences(body.splice(0).join(' '))) }
    for (const raw of paragraph.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue
      const subject = first && SUBJECT.test(line)
      first = false
      if (subject) { const rest = line.replace(SUBJECT, '').trim(); if (rest) out.push(rest); continue }
      if (isGreeting(line)) continue
      if (LIST_ITEM.test(line)) { flush(); out.push(...splitSentences(line)); continue }
      body.push(line)
    }
    flush()
  }
  return out
}

function mentionsCreator(sentence: string, names: readonly RegExp[]): boolean {
  const normalized = normalizeText(sentence)
  return YOU.test(normalized) || names.some(name => name.test(sentence))
}

/** 登记的原文对不对得上：对得上、对不上（资料查过但里面没有这段），或没查过（那一样资料没取回来，无从对）。 */
function quoteVerdict(source: CreatorSource, creator: CreatorText): 'matched' | 'quote_missing' | 'not_queried' {
  let fields: readonly string[]
  if (source.from === 'bio') {
    if (creator.bio === undefined) return 'not_queried'
    const bio = text(creator.bio)
    fields = bio === undefined ? [] : [bio]
  } else if (source.from === 'post') {
    if (creator.posts === undefined || creator.posts.length === 0) return 'not_queried'
    fields = creator.posts.flatMap(post => { const desc = text(post); return desc === undefined ? [] : [desc] })
  } else {
    const nickname = text(creator.nickname)
    if (nickname === undefined) return 'not_queried'
    fields = [nickname]
  }
  const quote = source.quote === undefined ? '' : normalizeText(source.quote)
  return quote !== '' && fields.some(field => normalizeText(field).includes(quote)) ? 'matched' : 'quote_missing'
}

export type CreatorSourceItem =
  | { status: 'matched'; draft: string; from: Exclude<CreatorSourceKind, 'self'>; quote: string }
  | { status: 'quote_missing'; draft: string; from: Exclude<CreatorSourceKind, 'self'>; quote: string }
  | { status: 'not_queried'; draft: string; from: Exclude<CreatorSourceKind, 'self'>; quote: string }
  | { status: 'self'; draft: string }
  | { status: 'not_in_draft'; draft: string }
  | { status: 'partial'; draft: string; rest: string }
  | { status: 'unregistered'; draft: string }

/** 一句里没被任何登记盖住的字：按登记在这句里出现的每一处标出覆盖，剩下带字母或数字的段落按原顺序用「…」连起来；全盖住返回 ''。 */
function uncovered(sentence: string, keys: readonly string[]): { touched: boolean; rest: string } {
  const covered = new Array<boolean>(sentence.length).fill(false)
  let touched = false
  for (const key of keys) {
    if (!key) continue
    if (key.includes(sentence)) return { touched: true, rest: '' }
    for (let at = sentence.indexOf(key); at >= 0; at = sentence.indexOf(key, at + 1)) {
      touched = true
      for (let i = at; i < at + key.length; i++) covered[i] = true
    }
  }
  const pieces: string[] = []
  let piece = ''
  for (let i = 0; i < sentence.length; i++) {
    if (covered[i]) { if (piece) pieces.push(piece); piece = '' } else piece += sentence[i]
  }
  if (piece) pieces.push(piece)
  const rest = pieces.map(p => p.trim()).filter(p => /[\p{L}\p{N}]/u.test(p))
  return { touched, rest: rest.join('…') }
}

/**
 * 对一封草稿出逐条结果，按在草稿里出现的先后排；没草稿或只有空白时返回 undefined（不出这一行）。
 * 登记的那句已经不在信里的，排在最后（草稿改过、登记没跟着改）。
 */
export function creatorSourceItems(
  draft: string | undefined, sources: readonly CreatorSource[] | undefined, creator: CreatorText,
): CreatorSourceItem[] | undefined {
  if (draft === undefined || draft.trim() === '') return undefined
  const normalizedDraft = normalizeText(draft)
  const registered = (sources ?? []).map(source => ({ source, key: normalizeText(source.draft) }))
  const keys = registered.map(r => r.key)
  const placed: Array<{ at: number; item: CreatorSourceItem }> = []
  const missing: CreatorSourceItem[] = []
  for (const { source, key } of registered) {
    const at = key ? normalizedDraft.indexOf(key) : -1
    if (at < 0) { missing.push({ status: 'not_in_draft', draft: source.draft }); continue }
    const item: CreatorSourceItem = source.from === 'self'
      ? { status: 'self', draft: source.draft }
      : { status: quoteVerdict(source, creator), draft: source.draft, from: source.from, quote: source.quote === undefined ? '' : source.quote }
    placed.push({ at, item })
  }
  const names = nameWords(creator)
  let cursor = 0
  const seen = new Set<string>()
  for (const sentence of sentences(draft)) {
    const s = normalizeText(sentence)
    const found = normalizedDraft.indexOf(s, cursor)
    if (found >= 0) cursor = found + s.length
    if (!s || seen.has(s)) continue
    seen.add(s)
    const at = found >= 0 ? found : normalizedDraft.length
    const { touched, rest } = uncovered(s, keys)
    if (touched && rest) placed.push({ at, item: { status: 'partial', draft: sentence, rest } })
    else if (!touched && mentionsCreator(sentence, names)) placed.push({ at, item: { status: 'unregistered', draft: sentence } })
  }
  placed.sort((a, b) => a.at - b.at)
  return [...placed.map(p => p.item), ...missing]
}

/** 一条结果在报告里的写法。 */
export function creatorSourceText(item: CreatorSourceItem): string {
  switch (item.status) {
    case 'matched': return `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」`
    case 'quote_missing': return `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」（原文对不上：他的${KIND_LABEL[item.from]}里没有这段）`
    case 'not_queried': return `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」（对不了：他的${KIND_LABEL[item.from]}没查过）`
    case 'self': return `「${item.draft}」`
    case 'not_in_draft': return `「${item.draft}」（登记了出处，但信里已经没有这句）`
    case 'partial': return `「${item.draft}」（只登记了其中一段，没登记的：「${item.rest}」）`
    case 'unregistered': return `「${item.draft}」（提到了博主，没标出处）`
  }
}

/**
 * 报告那一行的内容。分三段，要人看的在前：「要看：」原文对不上、没查过、只登记了一部分、没标出处、信里已没有的；
 * 「对得上：」并排的信里这句与原文；「发件人自己的话：」登记成 self 的。每段内按在信里出现的先后、用「；」连；
 * 空的段不出，三段都空写「无」；没草稿返回 undefined。
 */
export function creatorSourceLine(
  draft: string | undefined, sources: readonly CreatorSource[] | undefined, creator: CreatorText,
): string | undefined {
  const items = creatorSourceItems(draft, sources, creator)
  if (items === undefined) return undefined
  const look = items.filter(item => item.status !== 'matched' && item.status !== 'self')
  const ok = items.filter(item => item.status === 'matched')
  const self = items.filter(item => item.status === 'self')
  const parts = [['要看', look], ['对得上', ok], ['发件人自己的话（确认没有借它给博主安新说法）', self]] as const
  const line = parts.filter(([, list]) => list.length).map(([label, list]) => `${label}：${list.map(creatorSourceText).join('；')}`)
  return line.length ? line.join('　｜　') : '无'
}

/** 正本校验用：一条登记的形状问题，没问题返回空数组。`at` 是这条在正本里的位置。 */
export function creatorSourceProblems(value: unknown, at: string): string[] {
  if (!Array.isArray(value)) return [`${at} 必须是数组`]
  const problems: string[] = []
  value.forEach((entry, index) => {
    const here = `${at}[${index}]`
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) { problems.push(`${here} 必须是对象`); return }
    const record = entry as Record<string, unknown>
    for (const key of Object.keys(record)) {
      if (!['draft', 'from', 'quote'].includes(key)) problems.push(`${here}.${key} 不认得（只有 draft、from、quote）`)
    }
    if (typeof record.draft !== 'string' || record.draft.trim() === '') problems.push(`${here}.draft 必须是非空字符串`)
    if (!(CREATOR_SOURCE_KINDS as readonly unknown[]).includes(record.from)) {
      problems.push(`${here}.from 必须是 ${CREATOR_SOURCE_KINDS.join('、')} 之一`)
      return
    }
    if (record.from === 'self') {
      if (record.quote !== undefined) problems.push(`${here}.quote 发件人自己的话不写原文`)
    } else if (typeof record.quote !== 'string' || record.quote.trim() === '') {
      problems.push(`${here}.quote 必须是非空字符串（资料里的原文片段）`)
    }
  })
  return problems
}
