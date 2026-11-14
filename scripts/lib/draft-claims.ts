/**
 * P2.c：开发信草稿里像产品事实的说法，对不上出处的列出来给人看（ADR-199）。
 *
 * 只认两类说法：带数字的（数字、数字加单位、价格、型号一类的字母数字串）和一张固定词表里的
 * 承诺词（保修、退款、认证、专利……）。对的是任务里 `kind=verified_product_fact` 的已证实产品事实，
 * 再加这位博主自己作品的文字 —— 第一句引用他作品里的数字（「3-ingredient」）不算产品事实。
 *
 * **只标不拦**：结果只进评审 HTML 给人看，不改草稿一个字节（P2.b），也不让导出失败。
 * 扫不到的：不带数字、又不在词表里的换说法编造（「dishwasher safe」），意思被歪曲的说法。
 * 那一半仍靠人看（P2.a）。
 */

/** 「数字 + 单位」里认得的单位；键是写法，值是归一后的名字。只用于比对，不出现在输出里。 */
const UNIT_ALIASES: Record<string, string> = {
  '%': '%', percent: '%',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  mm: 'mm', cm: 'cm', m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  inch: 'inch', inches: 'inch', ft: 'ft', feet: 'ft', foot: 'ft',
  mah: 'mah', wh: 'wh', w: 'w', watt: 'w', watts: 'w', v: 'v', volt: 'v', volts: 'v',
  hz: 'hz', khz: 'khz', gb: 'gb', tb: 'tb', mb: 'mb',
  s: 'second', sec: 'second', secs: 'second', second: 'second', seconds: 'second',
  min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute',
  h: 'hour', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour',
  day: 'day', days: 'day', week: 'week', weeks: 'week',
  month: 'month', months: 'month', year: 'year', years: 'year', yr: 'year', yrs: 'year',
  x: 'x', times: 'x', k: 'k',
}

/** 拼写出来的数字只在后面跟着单位时才算说法：「one post」不是产品事实，「ten seconds」是。 */
const ONES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
/** 一到九十九（含「twenty-five」这类连写）、hundred、thousand；键是写法，值是阿拉伯数字。 */
const NUMBER_WORDS: Record<string, string> = Object.fromEntries([
  ...ONES.map((w, i) => [w, String(i + 1)]),
  ...TEENS.map((w, i) => [w, String(i + 10)]),
  ...TENS.flatMap((t, i) => [[t, String((i + 2) * 10)],
    ...ONES.map((o, j) => [`${t}-${o}`, String((i + 2) * 10 + j + 1)])]),
  ['hundred', '100'], ['thousand', '1000'],
])

/**
 * 承诺词：写进信里就是在替品牌许诺或声称资质的词。词表固定，不全 —— 不在表里的换说法扫不到，
 * 这一点写在 outreach-draft.md 里。每项是一个正则源（不分大小写）与归一后用来对出处的词干。
 */
const PROMISE_WORDS: ReadonlyArray<readonly [RegExp, RegExp]> = ([
  ['warrant(?:y|ies|ied)', 'warrant'],
  ['guarantee[ds]?', 'guarantee'],
  ['refund(?:s|ed|able)?', 'refund'],
  ['money[- ]back', 'money[- ]?back'],
  ['free (?:shipping|delivery|returns?|trial)', 'free (?:shipping|delivery|returns?|trial)'],
  ['returns? (?:policy|window)', 'returns? (?:policy|window)'],
  ['lifetime', 'lifetime'],
  ['certif(?:ied|ication|icate)s?', 'certif'],
  ['patent(?:s|ed)?', 'patent'],
  ['award[- ]winning', 'award'],
  ['clinically', 'clinical'],
  ['dermatologist(?:[- ]tested|[- ]approved)?', 'dermatologist'],
  ['hypoallergenic', 'hypoallergenic'],
  ['fda', 'fda'],
  ['bpa[- ]free', 'bpa[- ]?free'],
  ['non[- ]toxic', 'non[- ]?toxic'],
  ['organic', 'organic'],
  ['cruelty[- ]free', 'cruelty[- ]?free'],
  ['vegan', 'vegan'],
  ['waterproof', 'waterproof'],
  ['water[- ]resistant', 'water[- ]?resistant'],
  ['biodegradable', 'biodegradable'],
  ['recyclable', 'recyclable'],
  ['best[- ]sell(?:ing|er)', 'best[- ]?sell'],
  ['#1|number one', '#1|number one'],
] as const).map(([word, stem]) => [new RegExp(`(?<![\\w#])(?:${word})(?!\\w)`, 'gi'), new RegExp(stem, 'i')] as const)

const unitPattern = Object.keys(UNIT_ALIASES).filter(u => u !== '%')
  .sort((a, b) => b.length - a.length).join('|')
const numberWordPattern = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')
/** 一个数：千分位只认三位一组（「400, weighs」里的逗号不算），可带小数，也可以是「.5」。 */
const DIGITS = '(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)'
/** 价格：币符在前。币种不比，只比数（ADR-199）。 */
const PRICE = new RegExp(`[$€£¥]\\s?${DIGITS}`, 'g')
/** 数字后可跟单位；连字符、空格都可以隔开（「10-second」「400 ml」「30%」）。 */
const NUMBER = new RegExp(`(?<![\\w.])(${DIGITS})(?:\\s?-?\\s?(%|(?:${unitPattern})\\b))?`, 'gi')
const WORD_NUMBER = new RegExp(`\\b(${numberWordPattern})(?:\\s|-)(${unitPattern})\\b`, 'gi')
/** 字母数字串（IPX7、Qi2、H13）：拆掉价格与数字之后剩下的、又含数字又含字母的词。 */
const ALNUM = /\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]+\b/gi

/** `key` 是归一后用来比的样子；承诺词另带它在词表里的词干。 */
interface Claim { text: string; key: string; at: number; stem?: RegExp }

const numberValue = (raw: string): string => {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? String(n) : raw
}

/** 去掉 {…} 占位符：占位符就是「这里还没出处」的标准写法，不是说法。 */
const withoutPlaceholders = (text: string): string => text.replace(/\{[^{}]*\}/g, ' ')

/** 把一段文字拆成可比的说法；草稿与出处走同一个函数，归一口径才一致。 */
function claimsIn(text: string): Claim[] {
  const out: Claim[] = []
  let rest = withoutPlaceholders(text)
  const mask = (re: RegExp, take: (m: RegExpExecArray) => Omit<Claim, 'at'> | undefined) => {
    rest = rest.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray
      const claim = take(m)
      if (claim) out.push({ ...claim, at: args.at(-2) as number })
      return ' '.repeat(m[0].length)
    })
  }
  // 承诺词先认走：「#1」里的 1 不另算一个数字。
  for (const [word, stem] of PROMISE_WORDS) mask(word, m => ({ text: m[0], key: `word:${m[0].toLowerCase()}`, stem }))
  mask(PRICE, m => ({ text: m[0], key: `price:${numberValue(m[0].replace(/^[$€£¥]\s?/, ''))}` }))
  mask(WORD_NUMBER, m => ({ text: m[0], key: `num:${NUMBER_WORDS[m[1].toLowerCase()]}:${UNIT_ALIASES[m[2].toLowerCase()]}` }))
  mask(NUMBER, m => ({
    text: m[0].trim(),
    key: `num:${numberValue(m[1])}:${m[2] ? UNIT_ALIASES[m[2].toLowerCase()] : ''}`,
  }))
  // 数字已被换成空白，型号串得在原文上找（只找没被前面认走的那几段）。
  const original = withoutPlaceholders(text)
  for (const m of original.matchAll(ALNUM)) {
    const at = m.index ?? 0
    if (rest.slice(at, at + m[0].length) !== m[0]) continue
    out.push({ text: m[0], key: `alnum:${m[0].toLowerCase()}`, at })
  }
  return out.sort((a, b) => a.at - b.at)
}

/** 出处那一边：比对用的键，和每个数在出处里出现过的样子（带什么单位、是不是价格）。 */
interface Source { keys: ReadonlySet<string>; values: ReadonlyMap<string, ReadonlySet<string>>; text: string }

function sourceOf(text: string): Source {
  const claims = claimsIn(text)
  const values = new Map<string, Set<string>>()
  for (const c of claims) {
    const [kind, value, unit] = c.key.split(':')
    if (kind !== 'num' && kind !== 'price') continue
    if (!values.has(value)) values.set(value, new Set())
    values.get(value)!.add(kind === 'price' ? 'price' : unit)   // P1 例外：上一行刚建好这一项
  }
  return { keys: new Set(claims.map(c => c.key)), values, text: withoutPlaceholders(text) }
}

/**
 * 出处里有没有这一条：同数同单位；有一边没写单位时同数即可（单位冲突不算，400ml 对不上 400 g）；
 * 价格对价格或不带单位的同数；型号串整串对；承诺词对词干。
 */
function sourced(claim: Claim, source: Source): boolean {
  if (claim.stem !== undefined) return claim.stem.test(source.text)
  if (source.keys.has(claim.key)) return true
  const [kind, value, unit] = claim.key.split(':')
  const seen = source.values.get(value)
  if (seen === undefined) return false
  if (kind === 'price') return seen.has('')
  if (kind === 'num') return unit === '' || seen.has('')
  return false
}

/**
 * 草稿里对不上出处的说法，按出现先后、同一写法只列一次。
 *
 * `facts` 是任务里已证实的产品事实原文（`kind=verified_product_fact` 的 detail）；
 * `posts` 是这位博主作品的文字。都可以是空的：那样草稿里每一条说法都对不上。
 */
export function unsourcedClaims(draft: string, facts: readonly string[], posts: readonly string[]): string[] {
  const source = sourceOf([...facts, ...posts].join('\n'))
  const seen = new Set<string>()
  const out: string[] = []
  for (const claim of claimsIn(draft)) {
    if (sourced(claim, source)) continue
    if (seen.has(claim.text.toLowerCase())) continue
    seen.add(claim.text.toLowerCase())
    out.push(claim.text)
  }
  return out
}

/** 任务里一条已证实的产品事实都没有时的说明：草稿里的说法全都对不上，不是比对过的结果。 */
export const NO_FACTS = '任务里没有已证实的产品事实可对'
/** 有草稿、扫完没有对不上的：和「没草稿」的空白分开（P1）。 */
export const NONE_FLAGGED = '无'

/**
 * 评审 HTML 草稿块里「出处对不上」那一行的文字。
 * 没有草稿或草稿全是空白 → undefined（不出这一行）；扫完没有 → 「无」；
 * 有 → 用「；」连起来；任务里没有已证实的产品事实时（有没有扫到都一样），前面加一句说明，不让人以为是比对过的结果。
 */
export function unsourcedLine(draft: string | undefined, facts: readonly string[] | undefined,
  posts: readonly string[]): string | undefined {
  if (draft === undefined || draft.trim() === '') return undefined
  const claims = unsourcedClaims(draft, facts ?? [], posts)
  const list = claims.length === 0 ? NONE_FLAGGED : claims.join('；')
  return facts?.length ? list : `${NO_FACTS}：${list}`
}

/** 任务里已证实的产品事实原文。校准缺席或一条都没有时是空数组。 */
export function verifiedFacts(calibration: { sources?: ReadonlyArray<{ kind: string; detail: string }> } | undefined): string[] {
  return (calibration?.sources ?? []).filter(s => s.kind === 'verified_product_fact').map(s => s.detail)
}
