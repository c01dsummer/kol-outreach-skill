/**
 * P2：开发信里写博主的话，要能指回他自己资料里的原文（ADR-210）。
 *
 * Agent 写草稿时，在评审正本里给每一句写博主的话登记一条出处：信里那句（`draft`），
 * 依据的是哪一样资料（`from`：简介、作品文案、昵称；或者 `self` = 发件人自己的话，不是在描述博主），
 * 以及资料里的原文片段（`quote`）。这里只做两件确定的事：
 *
 * 1. 对账：登记的原文片段确实在那一样资料里逐字出现；登记的那句确实还在信里。
 * 2. 点名：信里提到博主（you / your 这一类词、昵称里的名字、账号名）却没有登记出处的句子列出来。
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

/** 对账要用到的博主资料：简介、作品文案、昵称、账号名。缺席就是没有可对的。 */
export interface CreatorText {
  bio?: string | null
  posts?: readonly string[]
  nickname?: string
  handle?: string
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

/** 第二人称：信里出现这些词，这一句就是在对博主说话，多半在说他。 */
const YOU = /\b(?:you|your|yours|yourself|yourselves|you're|you've|you'll|you'd)\b/i
/** 问候行：Hi/Hello/Hey/Dear 开头、不超过五个词的一行只是称呼，不算描述。 */
const GREETING = /^(?:hi|hello|hey|dear)\b/i
const isGreeting = (line: string): boolean => GREETING.test(line) && line.split(/\s+/).length <= 5
/** 主题行自成一句，不和下面的正文接起来。 */
const SUBJECT = /^subject\s*[:：]/i

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 昵称里的名字（三个字母以上的词）与账号名，整词出现就算提到了他。 */
function nameWords(creator: CreatorText): RegExp[] {
  const words = new Set<string>()
  for (const word of (creator.nickname ?? '').normalize('NFKC').match(/\p{L}{3,}/gu) ?? []) words.add(word.toLowerCase())
  const handle = (creator.handle ?? '').replace(/^@/, '').trim().toLowerCase()
  if (handle.length >= 3) words.add(handle)
  return [...words].map(word => new RegExp(`(?<![\\p{L}\\p{N}_.])${escapeRegExp(word)}(?![\\p{L}\\p{N}_])`, 'iu'))
}

/**
 * 把草稿切成句：空行分段，段内折行接回一行（信常常手动折行），再按句末标点（. ! ?）后跟空白切。
 * 主题行自成一句；问候行跳过。
 */
function sentences(draft: string): string[] {
  const out: string[] = []
  const push = (text: string) => {
    for (const part of text.split(/(?<=[.!?])\s+/)) if (part.trim()) out.push(part.trim())
  }
  for (const paragraph of draft.split(/\r?\n\s*\r?\n/)) {
    const body: string[] = []
    for (const raw of paragraph.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || isGreeting(line)) continue
      if (SUBJECT.test(line)) { out.push(line); continue }
      body.push(line)
    }
    if (body.length) push(body.join(' '))
  }
  return out
}

function mentionsCreator(sentence: string, names: readonly RegExp[]): boolean {
  return YOU.test(sentence) || names.some(name => name.test(sentence))
}

function quoteFound(source: CreatorSource, creator: CreatorText): boolean {
  if (source.quote === undefined) return false
  const quote = normalizeText(source.quote)
  if (!quote) return false
  const fields = source.from === 'bio' ? [creator.bio ?? '']
    : source.from === 'post' ? [...(creator.posts ?? [])]
    : source.from === 'nickname' ? [creator.nickname ?? '']
    : []
  return fields.some(field => normalizeText(field).includes(quote))
}

export type CreatorSourceItem =
  | { status: 'matched'; draft: string; from: Exclude<CreatorSourceKind, 'self'>; quote: string }
  | { status: 'quote_missing'; draft: string; from: Exclude<CreatorSourceKind, 'self'>; quote: string }
  | { status: 'self'; draft: string }
  | { status: 'not_in_draft'; draft: string }
  | { status: 'unregistered'; draft: string }

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
  const placed: Array<{ at: number; item: CreatorSourceItem }> = []
  const missing: CreatorSourceItem[] = []
  for (const { source, key } of registered) {
    const at = key ? normalizedDraft.indexOf(key) : -1
    if (at < 0) { missing.push({ status: 'not_in_draft', draft: source.draft }); continue }
    const item: CreatorSourceItem = source.from === 'self'
      ? { status: 'self', draft: source.draft }
      : { status: quoteFound(source, creator) ? 'matched' : 'quote_missing', draft: source.draft, from: source.from, quote: source.quote ?? '' }
    placed.push({ at, item })
  }
  const covered = (sentence: string): boolean => {
    const s = normalizeText(sentence)
    return registered.some(({ key }) => key !== '' && (s.includes(key) || key.includes(s)))
  }
  const names = nameWords(creator)
  let cursor = 0
  const seen = new Set<string>()
  for (const sentence of sentences(draft)) {
    const s = normalizeText(sentence)
    const at = normalizedDraft.indexOf(s, cursor)
    if (at >= 0) cursor = at + s.length
    if (!mentionsCreator(sentence, names) || covered(sentence) || seen.has(s)) continue
    seen.add(s)
    placed.push({ at: at >= 0 ? at : normalizedDraft.length, item: { status: 'unregistered', draft: sentence } })
  }
  placed.sort((a, b) => a.at - b.at)
  return [...placed.map(p => p.item), ...missing]
}

/** 一条结果在报告里的写法。 */
export function creatorSourceText(item: CreatorSourceItem): string {
  switch (item.status) {
    case 'matched': return `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」`
    case 'quote_missing': return `「${item.draft}」← ${KIND_LABEL[item.from]}原文「${item.quote}」（原文对不上：他的${KIND_LABEL[item.from]}里没有这段）`
    case 'self': return `「${item.draft}」← 发件人自己的话（确认没有给博主安新说法）`
    case 'not_in_draft': return `「${item.draft}」（登记了出处，但信里已经没有这句）`
    case 'unregistered': return `「${item.draft}」（提到了博主，没标出处）`
  }
}

/** 报告那一行的内容：逐条用「；」连起来；一条都没有写「无」；没草稿返回 undefined。 */
export function creatorSourceLine(
  draft: string | undefined, sources: readonly CreatorSource[] | undefined, creator: CreatorText,
): string | undefined {
  const items = creatorSourceItems(draft, sources, creator)
  if (items === undefined) return undefined
  return items.length ? items.map(creatorSourceText).join('；') : '无'
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
