/**
 * P2.c：开发信草稿里像产品事实的说法，对不上产品资料的列出来给人看（ADR-199，规则按 ADR-207 重定）。
 *
 * 这一行给运营抓编出来的说法用。只标不拦：结果只进评审 HTML，不改草稿一个字节（P2.b），也不让导出失败。
 * 漏标的代价是一个编出来的数发出去；多标的代价是运营多看一眼，但噪音多了运营会整行跳过。所以：
 * - 只有产品资料（`kind=verified_product_fact` 的原文）能让一条说法过关；
 *   博主作品文字里找得到、产品资料里没有的，单独列成「只在博主作品里有」，不放过也不混进对不上的那一组。
 * - 机器能确定不是产品说法的形状（网址、邮箱、电话、序数词、钟点）不列；日期整串算一条。
 * - 对上的标准从严：写了单位就要同数同单位，价钱只认资料里标明是价钱的数，承诺词要整词对上、
 *   资料里那一句带否定（Not waterproof、Patent pending）不算出处。不做换算。
 *
 * 扫不到的：不带数字、又不在词表里的换说法编造，数字对得上但意思歪了，产品资料本身记错。那一半仍靠人看（P2.a）。
 */

/** 认得的单位写法；值是归一后的名字。表外的词按字面比（单复数归一），见 `foldUnit`。 */
const UNIT_ALIASES: Record<string, string> = {
  '%': '%', percent: '%', pct: '%',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  mm: 'mm', cm: 'cm', m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  inch: 'inch', inches: 'inch', ft: 'ft', feet: 'ft', foot: 'ft',
  mah: 'mah', wh: 'wh', w: 'w', watt: 'w', watts: 'w', v: 'v', volt: 'v', volts: 'v',
  hz: 'hz', khz: 'khz', gb: 'gb', tb: 'tb', mb: 'mb', db: 'db', decibel: 'db', decibels: 'db',
  s: 'second', sec: 'second', secs: 'second', second: 'second', seconds: 'second',
  min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute',
  h: 'hour', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour',
  day: 'day', days: 'day', week: 'week', weeks: 'week',
  month: 'month', months: 'month', mo: 'month', year: 'year', years: 'year', yr: 'year', yrs: 'year',
  x: 'x', times: 'x', k: 'k',
}

/** 跟在数后面但不是单位的虚词：「2 to 3 weeks」里 2 是裸数，「3 weeks」带单位。 */
const NOT_UNITS = new Set(('a an the and or nor but of to on at for with by from as is are was were be been being ' +
  'it its this that these those than then so if per up out off into onto over under about after before via vs ' +
  'also only just more less most very too our your my his her their we you they he she me us them which who ' +
  'what when where while not no all any each every both few many much some such can will would should could ' +
  'may might must do does did has have had get gets got am i plus today now yet again already ever still here there ' +
  'total overall apiece instead either back away left right').split(' '))

/** 表外的单位按字面比：小写，复数折成单数（colors → color、batteries → battery、boxes → box）。 */
function foldUnit(word: string): string {
  const w = word.toLowerCase()
  const alias = UNIT_ALIASES[w]
  if (alias !== undefined) return alias
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.length > 4 && /(?:s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

/** 拼写出来的数：个位、十几、整十，以及 hundred、thousand、million 这几个倍数。 */
const ONES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SMALL: Record<string, number> = Object.fromEntries([
  ...ONES.map((w, i) => [w, i + 1]), ...TEENS.map((w, i) => [w, i + 10]), ...TENS.map((w, i) => [w, (i + 2) * 10]),
  ['a', 1], ['an', 1], ['dozen', 12],
])
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1000000 }

/**
 * 一串拼写数字的值：「twenty five」「twenty-five」= 25，「two hundred」= 200，「a thousand」= 1000，「a dozen」= 12。
 * 读不成一个数时返回 undefined。
 */
function spelledValue(phrase: string): number | undefined {
  const words = phrase.toLowerCase().split(/[\s-]+/).filter(w => w !== '' && w !== 'and')
  let total = 0, current = 0, seen = false
  for (const w of words) {
    if (w === 'dozen') { current = (current || 1) * 12; seen = true; continue }
    if (SMALL[w] !== undefined) { current += SMALL[w]; seen = true; continue }
    const scale = SCALES[w]
    if (scale === undefined) return undefined
    current = (current || 1) * scale
    if (scale >= 1000) { total += current; current = 0 }
    seen = true
  }
  return seen ? total + current : undefined
}

const W = (words: readonly string[]) => [...words].sort((a, b) => b.length - a.length).join('|')
/** 一组拼写数字：「twenty five」「twenty-five」「two hundred」「a thousand」「a dozen」；必须以数词开头。 */
const SPELLED = `(?:(?:a|an)[\\s-]+(?:dozen|hundred|thousand|million)|(?:${W([...ONES, ...TEENS, ...TENS])})(?:[\\s-]+(?:${W([...ONES, ...TEENS, ...TENS, 'hundred', 'thousand', 'million', 'and'])}))*)`

/**
 * 承诺词：写进信里就是在替品牌许诺或声称资质的词。左边要整词起头（inorganic 里没有 organic），右边只要求不是数字字母延续，
 * 由正则自己收尾。每项是 [草稿里认的写法, 去出处里找的词干]；词干两边都按整词找。
 */
const PROMISE_WORDS: ReadonlyArray<readonly [string, string]> = [
  // 「终身保修」整个词组对：资料里的 battery lifetime 不是信里 lifetime warranty 的出处。
  ['lifetime (?:warranty|guarantee)', 'lifetime (?:warranty|guarantee)'],
  ['warrant(?:y|ies|ied|ee)', 'warrant(?:y|ies|ied|ee)'],
  ['guarantee(?:[ds]|ing)?', 'guarantee(?:[ds]|ing)?'],
  ['refund(?:s|ed|able)?', 'refund(?:s|ed|able)?'],
  ['money[- ]?back', 'money[- ]?back'],
  ['cash[- ]?back', 'cash[- ]?back'],
  ['risk[- ]free', 'risk[- ]free'],
  ['(?:free|easy) returns?', 'free returns?|easy returns?'],
  ['returns? (?:policy|window)', 'returns? (?:policy|window)'],
  // 免费类各对各的：出处里的 free trial 不是信里 free shipping 的出处。
  ['ships? (?:for )?free|shipping is free|free (?:(?:express|standard|US|international|2-day|two-day) )?(?:shipping|delivery)', 'ships? (?:for )?free|shipping is free|free (?:(?:express|standard|US|international|2-day|two-day) )?(?:shipping|delivery)'],
  ['free (?:gift|sample|samples|trial|replacement|replacements|upgrade|accessor(?:y|ies))', 'free (?:gift|sample|samples|trial|replacement|replacements|upgrade|accessor(?:y|ies))'],
  ['complimentary', 'complimentary'],
  ['discount(?:s|ed)?', 'discount(?:s|ed)?'],
  ['commission(?:s)?', 'commission(?:s)?'],
  ['lifetime', 'lifetime'],
  ['for life|forever', 'for life|forever'],
  ['certif(?:y|ied|ication|ications|icate|icates)', 'certif(?:y|ied|ication|ications|icate|icates)'],
  ['patent(?:s|ed)?', 'patent(?:s|ed)?'],
  ['award[- ]winning|won an award|awards?', 'award[- ]winning|won an award|awards?'],
  ['clinically|clinical(?: trials?| studies| study)?', 'clinically|clinical(?: trials?| studies| study)?'],
  ['dermatologist(?:[- ](?:tested|approved|recommended))?', 'dermatologist(?:[- ](?:tested|approved|recommended))?'],
  ['doctor[- ](?:recommended|approved)', 'doctor[- ](?:recommended|approved)'],
  ['lab[- ]tested', 'lab[- ]tested'],
  ['(?:food|medical)[- ]grade', '(?:food|medical)[- ]grade'],
  ['hypoallergenic', 'hypoallergenic'],
  ['fda(?:[- ](?:approved|cleared|registered))?', 'fda(?:[- ](?:approved|cleared|registered))?'],
  ['ce(?:[- ]marked| certified| mark)', 'ce(?:[- ]marked| certified| mark)?'],
  ['ul[- ](?:listed|certified)', 'ul(?:[- ](?:listed|certified))?'],
  ['fcc(?:[- ](?:approved|certified))?', 'fcc(?:[- ](?:approved|certified))?'],
  ['iso(?: ?\\d+)?(?:[- ]certified)?', 'iso(?: ?\\d+)?(?:[- ]certified)?'],
  ['usda(?:[- ]organic)?', 'usda(?:[- ]organic)?'],
  ['non[- ]?(?:toxic|gmo)', 'non[- ]?(?:toxic|gmo)'],
  // 以 -free、-proof 结尾的整词：BPA-free、gluten-free、leakproof、water proof。中间不许有空格：「it's free」不是。
  ['[a-z]+-?free', '__SAME__'],
  ['[a-z]+-?proof|water proof', '__SAME__'],
  ['all[- ]natural', 'all[- ]natural'],
  ['organic', 'organic'],
  ['vegan', 'vegan'],
  ['water[- ]resistant', 'water[- ]resistant'],
  ['dishwasher[- ]safe', 'dishwasher[- ]safe'],
  ['safe for kids|kid[- ]safe', 'safe for kids|kid[- ]safe'],
  ['biodegradable', 'biodegradable'],
  ['recyclable', 'recyclable'],
  ['best[- ]?sell(?:ing|ers?)', 'best[- ]?sell(?:ing|ers?)'],
  ['top[- ]rated', 'top[- ]rated'],
  ['five[- ]star|5[- ]star', 'five[- ]star|5[- ]star'],
  ["world'?s first", "world'?s first"],
  ['#1|number one|no\\. ?1|number 1', '#1|number one|no\\. ?1|number 1'],
]

/** 认承诺词的正则（左边整词起头，「#1」前面不能再有 #）。查否定时先把句子里的承诺词整个拿掉：「Non-toxic BPA-free jar」里的 non 是 non-toxic 自己的，不否定 BPA-free。 */
const PROMISE_RES = PROMISE_WORDS.map(([word]) => new RegExp(`(?<![\\w#])(?:${word})(?![\\w])`, 'gi'))
const withoutPromises = (clause: string): string => PROMISE_RES.reduce((rest, re) => rest.replace(re, ' '), clause)

/** -free、-proof 这两项按草稿里那个词本身去出处里找（leakproof 只认 leak proof / leak-proof / leakproof）。 */
const literalStem = (word: string): string => word.toLowerCase().replace(/[- ]/g, '').split('')
  .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[- ]?')

/** 「免费」类后缀里的日常用法：hands-free 也是产品说法，照列；只排掉不是在说产品的这几个。 */
const NOT_PROMISE = /^(?:feel|stress|worry|hassle|commitment|obligation|string|strings|care|toll)[- ]?free$/i

/** 一句话里的否定：资料里这一句是否定说法时，不给草稿里同一个承诺词当出处。 */
const NEGATION = /(?<![a-z])(?:no|not|non|never|without|pending|void|cannot|isn't|aren't|doesn't|don't|won't)(?![a-z])|n't(?![a-z])/i

/** 一个数：千分位只认三位一组（「400, weighs」里的逗号不算），可带小数，也可以是「.5」。 */
const DIGITS = '(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)'
const CURRENCY_WORDS = 'dollars?|bucks|usd|eur|euros?|gbp|cad|aud'

/** 机器能确定不是产品说法的形状：整段遮掉，不列也不当出处。 */
const NOISE: readonly RegExp[] = [
  /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gi,                                             // 邮箱
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi,                                                  // 网址
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ly|me|app|shop|store|us|uk|ca|de|fr|tv|gg|link|bio|page)\b(?:\/\S*)?/gi, // 不带协议的网址
  /\b\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)(?![a-z])/gi,                      // 钟点 3pm、10:30 am
  /\b\d{1,2}:\d{2}\b/g,                                                             // 钟点 10:30
  /\b\d+(?:st|nd|rd|th)\b/gi,                                                       // 序数词 2nd
]
/** 电话：几组数字用空格、点、连字符、括号隔开，合起来至少九位；位数不够的（「3-5 business」）不是电话，照常扫。 */
const PHONE = /(?<![\w.])\+?\(?\d{1,4}\)?(?:[\s.-]\(?\d{2,4}\)?){2,}(?![\w%])/g
const isPhone = (s: string) => (s.match(/\d/g) ?? []).length >= 9

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
/** 日期整串算一条：11/20/2026、2026-11-20、March 15、15 March 2026。 */
const DATE = new RegExp(`\\b(?:\\d{1,2}/\\d{1,2}/\\d{2,4}|\\d{4}-\\d{1,2}-\\d{1,2}|(?:${MONTHS})\\.? \\d{1,2}(?:st|nd|rd|th)?(?:,? \\d{4})?|\\d{1,2} (?:${MONTHS})(?:,? \\d{4})?)\\b`, 'gi')

/** 价格：币符在前（$29.99、US$5、USD 40），或币种写在后面（40 dollars、40 USD）。 */
const PRICE_BEFORE = new RegExp(`(?:US\\$|[$€£¥]|\\b(?:usd|eur|gbp)\\s?)(${DIGITS})(?:\\s?(k|m)\\b)?`, 'gi')
const PRICE_AFTER = new RegExp(`(?<![\\w.])(${DIGITS})\\s?(?:${CURRENCY_WORDS})\\b`, 'gi')
/** 拼写的数加钱或百分号：fifty dollars、thirty bucks、fifty per cent。 */
const SPELLED_PRICE = new RegExp(`\\b(${SPELLED})\\s(?:${CURRENCY_WORDS})\\b`, 'gi')
const SPELLED_PERCENT = new RegExp(`\\b(${SPELLED})[\\s-](?:percent|per cent)\\b`, 'gi')
/** 拼写的数后面跟单位表里的单位：ten seconds、twenty five hours、a thousand-hour。 */
const unitWords = W(Object.keys(UNIT_ALIASES).filter(u => u !== '%' && u.length > 1))
const SPELLED_UNIT = new RegExp(`\\b(${SPELLED})[\\s-](${unitWords})\\b`, 'gi')
/** 开发信里最常被编的几种不带阿拉伯数字的数量：half off、double、twice、a dozen、a million。 */
const QUANTITY_PHRASES = /\b(?:half[- ](?:off|price)|double[sd]?|twice|(?:a|an)[\s-](?:dozen|million|thousand|hundred)|millions|thousands)\b/gi
/** 百分号与 per cent 写法。 */
const PERCENT_WORDS = '%|percent\\b|per cent\\b|pct\\b'
/**
 * 一个阿拉伯数后面可以跟单位：贴着写（400ml、1080p、4K）、空格或连字符隔开（400 ml、10-second）、度数（40°C）。
 * 负号只在前面不是字母、数字、点时才算数的一部分：「-20」是负数，「3-5 years」「COVID-19」里的不是。
 */
const NUMBER = new RegExp(`(?<![\\w.$€£¥])(-?${DIGITS})(?:(\\s?(?:${PERCENT_WORDS}))|(°\\s?[cf]\\b)|([a-z]+(?![\\w]))|(?:[\\s-]([a-z]+(?![\\w'])))?)(?!\\w|\\.\\d)`, 'gi')
/** 型号串：字母起头又含数字的整词（IPX7、Qi2、H13、IPX-7）；「1-on-1」里的 on-1 不算。 */
const ALNUM = /(?<![\w-])[a-z]+-?\d[a-z0-9]*\b/gi

/** `key` 是归一后用来比的样子；承诺词另带去出处里找的写法。 */
export interface Claim { text: string; key: string; at: number; stem?: RegExp }

const numberValue = (raw: string): string => {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? String(n) : raw
}

/** {…} 占位符：只认同一行、40 字以内的，套着写的（{{price}}）由里往外剥。剥掉的位置补空白，下标不变。 */
function placeholders(text: string): { rest: string; unmatched: boolean } {
  let rest = text, prev = ''
  while (rest !== prev) { prev = rest; rest = rest.replace(/\{[^{}\n]{0,40}\}/g, m => ' '.repeat(m.length)) }
  return { rest, unmatched: /[{}]/.test(rest) }
}

/** 把一段文字拆成可比的说法；草稿与出处走同一个函数，归一口径才一致。 */
export function claimsIn(text: string): Claim[] {
  const out: Claim[] = []
  let rest = placeholders(text).rest
  // take 返回 'keep' 时这一段原样留下给后面的规则；返回 undefined 时遮掉、不算说法。
  const mask = (re: RegExp, take: (m: RegExpExecArray) => Omit<Claim, 'at'> | undefined | 'keep') => {
    rest = rest.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray
      const claim = take(m)
      if (claim === 'keep') return m[0]
      if (claim !== undefined) out.push({ ...claim, at: args.at(-2) as number })
      return ' '.repeat(m[0].length)
    })
  }
  // 先遮掉确定不是产品说法的形状；位数不够的「电话」原样留下照常扫。
  for (const re of NOISE) mask(re, () => undefined)
  mask(PHONE, m => isPhone(m[0]) ? undefined : 'keep')
  mask(DATE, m => ({ text: m[0], key: `date:${m[0].toLowerCase().replace(/[\s,.]+/g, ' ')}` }))
  // 承诺词先认走：「#1」里的 1、「5-star」里的 5 不另算一个数字。
  PROMISE_WORDS.forEach(([, stem], i) => {
    mask(PROMISE_RES[i], m => {
      if (NOT_PROMISE.test(m[0])) return undefined
      const source = stem === '__SAME__' ? literalStem(m[0]) : stem
      return { text: m[0], key: `word:${m[0].toLowerCase()}`, stem: new RegExp(`(?<!\\w)(?:${source})(?!\\w)`, 'gi') }
    })
  })
  mask(SPELLED_PRICE, m => withValue(m, spelledValue(m[1]), v => `price:${v}`))
  mask(SPELLED_PERCENT, m => withValue(m, spelledValue(m[1]), v => `num:${v}:%`))
  mask(SPELLED_UNIT, m => withValue(m, spelledValue(m[1]), v => `num:${v}:${foldUnit(m[2])}`))
  mask(QUANTITY_PHRASES, m => ({ text: m[0], key: `phrase:${m[0].toLowerCase().replace(/[\s-]+/g, ' ')}` }))
  mask(PRICE_BEFORE, m => ({ text: m[0].trim(), key: `price:${scaled(m[1], m[2])}` }))
  mask(PRICE_AFTER, m => ({ text: m[0].trim(), key: `price:${numberValue(m[1])}` }))
  mask(ALNUM, m => ({ text: m[0], key: `alnum:${m[0].toLowerCase().replace(/-/g, '')}` }))
  mask(NUMBER, m => {
    const [, value, percent, degree, glued, spaced] = m
    const unit = percent !== undefined ? '%'
      : degree !== undefined ? `°${degree.replace(/[°\s]/g, '').toLowerCase()}`
        : glued !== undefined ? foldUnit(glued)
          : spaced !== undefined && !NOT_UNITS.has(spaced.toLowerCase()) ? foldUnit(spaced) : ''
    const text = unit === '' && spaced !== undefined ? value : m[0].trim()
    return { text, key: `num:${numberValue(value)}:${unit}` }
  })
  return out.sort((a, b) => a.at - b.at)
}

function withValue(m: RegExpExecArray, value: number | undefined, key: (v: string) => string): Omit<Claim, 'at'> | 'keep' {
  return value === undefined ? 'keep' : { text: m[0], key: key(String(value)) }
}
const scaled = (raw: string, suffix: string | undefined): string => {
  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n) || suffix === undefined) return numberValue(raw)
  return String(n * (suffix.toLowerCase() === 'k' ? 1000 : 1000000))
}

/** 出处那一边：比对用的键、每个数在出处里出现过的单位，和拆成句子的原文（承诺词按句查否定）。 */
interface Source { keys: ReadonlySet<string>; values: ReadonlyMap<string, ReadonlySet<string>>; clauses: readonly string[] }

function sourceOf(texts: readonly string[]): Source {
  const keys = new Set<string>()
  const values = new Map<string, Set<string>>()
  for (const text of texts) {
    for (const c of claimsIn(text)) {
      keys.add(c.key)
      const [kind, value, unit] = c.key.split(':')
      if (kind !== 'num' && kind !== 'price') continue
      if (!values.has(value)) values.set(value, new Set())
      values.get(value)!.add(kind === 'price' ? '$' : unit)   // P1 例外：上一行刚建好这一项
    }
  }
  const clauses = texts.flatMap(t => placeholders(t).rest.split(/[.;!?\n]+(?:\s|$)|[;!?\n]/)).filter(s => s.trim() !== '')
  return { keys, values, clauses }
}

/**
 * 出处里有没有这一条：
 * - 带单位的数要同数同单位（单位按别名与单复数归一）；草稿里的裸数，出处里有同一个数就算；
 * - 价钱只对出处里标明是价钱的同数；型号串、日期、数量写法整串对；
 * - 承诺词要在出处某一句里整词出现，且那一句不带否定（Not waterproof、Patent pending、warranty void）。
 */
function sourced(claim: Claim, source: Source): boolean {
  if (claim.stem !== undefined) {
    const stem = claim.stem
    return source.clauses.some(clause => {
      stem.lastIndex = 0
      if (!stem.test(clause)) return false
      return !NEGATION.test(withoutPromises(clause))
    })
  }
  if (source.keys.has(claim.key)) return true
  const [kind, value, unit] = claim.key.split(':')
  if (kind !== 'num' || unit !== '') return false
  return source.values.has(value)
}

/** 列出来的一条：草稿里的原写法，和它在那一行里的前后几个词（运营不用回正文找）。 */
export interface Flagged { text: string; context: string }

/** 前后各取三个词，不跨行；没有前后词时 context 就是原写法本身。 */
function withContext(draft: string, claim: Claim): Flagged {
  const lineStart = draft.lastIndexOf('\n', claim.at - 1) + 1
  const next = draft.indexOf('\n', claim.at)
  const lineEnd = next === -1 ? draft.length : next
  const left = /(?:\S*\s+){0,3}\S*$/.exec(draft.slice(lineStart, claim.at))?.[0] ?? ''
  const right = /^\S*(?:\s+\S+){0,3}/.exec(draft.slice(claim.at + claim.text.length, lineEnd))?.[0] ?? ''
  return { text: claim.text, context: `${left}${claim.text}${right}`.replace(/\s+/g, ' ').trim() }
}

/** 一条的显示写法：「12-blade（a 12-blade motor）」；前后没有别的词时只写原写法。 */
const shown = (f: Flagged): string => f.context === f.text ? f.text : `${f.text}（${f.context}）`

/** 扫完一封草稿的结果：对不上产品资料的、只在博主作品里有的，各按出现先后、同一写法只列一次。 */
export interface DraftClaims { unsourced: Flagged[]; postsOnly: Flagged[]; unmatchedBraces: boolean }

/**
 * `facts` 是任务里已证实的产品事实原文（`kind=verified_product_fact` 的 detail）；
 * `posts` 是这位博主作品的文字。都可以是空的。只有 `facts` 能让一条说法过关。
 */
export function draftClaims(draft: string, facts: readonly string[], posts: readonly string[]): DraftClaims {
  const fromFacts = sourceOf(facts)
  const fromPosts = sourceOf(posts)
  const seen = new Set<string>()
  const unsourced: Flagged[] = [], postsOnly: Flagged[] = []
  for (const claim of claimsIn(draft)) {
    if (sourced(claim, fromFacts)) continue
    if (seen.has(claim.text.toLowerCase())) continue
    seen.add(claim.text.toLowerCase())
    ;(sourced(claim, fromPosts) ? postsOnly : unsourced).push(withContext(draft, claim))
  }
  return { unsourced, postsOnly, unmatchedBraces: placeholders(draft).unmatched }
}

/** 任务里一条已证实的产品事实都没有时的说明：草稿里的说法全都对不上，不是比对过的结果。 */
export const NO_FACTS = '任务里没有已证实的产品事实可对'
/** 产品资料里有中日韩文字时的说明：英文的承诺词和单位多半比不上，列出来的要自己核。 */
export const NOT_ENGLISH = '产品资料不是英文，承诺词和单位可能比不上，请自己核'
/** 草稿里有没配对的花括号：占位符可能没写完整，后面的字照常扫了。 */
export const UNMATCHED_BRACES = '草稿里有没配对的花括号'
/** 有草稿、扫完没有对不上的：和「没草稿」的空白分开（P1）。 */
export const NONE_FLAGGED = '无'

const CJK = /[぀-ヿ㐀-鿿가-힯]/

/** 评审 HTML 草稿块里那两行的文字。`postsOnly` 一行没有可列的就缺席。 */
export interface ClaimsLines { unsourced: string; postsOnly?: string }

/**
 * 没有草稿或草稿全是空白 → undefined（不出这两行）。
 * 「出处对不上」一行：没有就写「无」，有就用「；」连起来；任务里没有已证实的产品事实、或产品资料不是英文时前面加一句说明；
 * 草稿里有没配对的花括号时后面加一句。「只在博主作品里有」一行：有才出。
 */
export function claimsLines(draft: string | undefined, facts: readonly string[] | undefined,
  posts: readonly string[]): ClaimsLines | undefined {
  if (draft === undefined || draft.trim() === '') return undefined
  const found = draftClaims(draft, facts ?? [], posts)
  const list = found.unsourced.length === 0 ? NONE_FLAGGED : found.unsourced.map(shown).join('；')
  const prefix = !facts?.length ? `${NO_FACTS}：` : facts.some(f => CJK.test(f)) ? `${NOT_ENGLISH}：` : ''
  const suffix = found.unmatchedBraces ? `；${UNMATCHED_BRACES}` : ''
  return { unsourced: `${prefix}${list}${suffix}`, ...(found.postsOnly.length === 0 ? {} : { postsOnly: found.postsOnly.map(shown).join('；') }) }
}

/** 任务里已证实的产品事实原文。校准缺席或一条都没有时是空数组。 */
export function verifiedFacts(calibration: { sources?: ReadonlyArray<{ kind: string; detail: string }> } | undefined): string[] {
  return (calibration?.sources ?? []).filter(s => s.kind === 'verified_product_fact').map(s => s.detail)
}
