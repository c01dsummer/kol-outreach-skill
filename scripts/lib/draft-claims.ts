/**
 * P2.c：开发信草稿里像产品事实的说法，对不上产品资料的列出来给人看（ADR-199，规则按 ADR-209 重定）。
 *
 * 这一行给运营抓编出来的说法用。只标不拦：结果只进评审 HTML，不改草稿一个字节（P2.b），也不让导出失败。
 * 漏标的代价是一个编出来的数发出去；多标的代价是运营多看一眼，但噪音多了运营会整行跳过。所以：
 * - 只有产品资料（`kind=verified_product_fact` 的原文）能让一条说法过关；
 *   博主作品文字里找得到、产品资料里没有的，单独列成「只在博主作品里有」，不放过也不混进对不上的那一组。
 * - 只藏网址和邮箱；电话、钟点、日期各整串算一条照列，不藏（藏错了就是漏标）。
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

/**
 * 表外的单位按字面比：小写，单复数折成同一个样子。不求折出真正的单数，只求两边折法一致：
 * 先去复数的 s，再把结尾的 ie 写成 y、去掉结尾的 e —— calories 与 calorie、batteries 与 battery、sizes 与 size、boxes 与 box 各折成同一个。
 */
function foldUnit(word: string): string {
  const w = word.toLowerCase()
  const alias = UNIT_ALIASES[w]
  if (alias !== undefined) return alias
  let f = w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w
  if (f.length > 3 && f.endsWith('ie')) f = `${f.slice(0, -2)}y`
  else if (f.length > 3 && f.endsWith('e')) f = f.slice(0, -1)
  return f
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

/** 一串拼写数字的值：「twenty five」「twenty-five」= 25，「two hundred」= 200，「a dozen」= 12；读不成一个数时返回 undefined。 */
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
const NUM_WORDS = W([...ONES, ...TEENS, ...TENS])
/** 「and」只在 hundred、thousand、million 后面才连着读（one hundred and five）；「five and ten minutes」是两个数。 */
const SPELLED = `(?:(?:a|an)[\\s-]+(?:dozen|hundred|thousand|million)|(?:${NUM_WORDS})(?:[\\s-]+(?:${NUM_WORDS}|hundred|thousand|million|dozen)|(?<=hundred|thousand|million)\\s+and(?=\\s+(?:${NUM_WORDS})))*)`

/** 「BPA free」「leak proof」这样中间带空格写时认的前缀；连写或带连字符的不受这两张表限制。 */
const FREE_PREFIXES = 'bpa|cruelty|gluten|sugar|dairy|lactose|fat|parabens?|sulfates?|fragrance|latex|nut|soy|alcohol|phthalates?|' +
  'lead|plastic|chemical|toxin|pfas|pfoa|caffeine|grain|egg|wheat|carbon|maintenance|scent|oil|silicone|preservative'
const PROOF_PREFIXES = 'water|leak|dust|shock|scratch|rust|splash|fire|tamper|child|spill|shatter|odor|weather|stain|drop|sweat'

/**
 * 承诺词：写进信里就是在替品牌许诺或声称资质的词。左边要整词起头（inorganic 里没有 organic），右边只要求不是数字字母延续，
 * 由正则自己收尾。每项是 [草稿里认的写法, 去出处里找的词干]，两边按整词找；__SAME__ 是按草稿原词找（资料 Non-GMO 不给信里 non-toxic 当出处）。
 */
const PROMISE_WORDS: ReadonlyArray<readonly [string, string]> = [
  // 「终身保修」整个词组对：资料里的 battery lifetime 不是信里 lifetime warranty 的出处。
  ['lifetime (?:warranty|guarantee)', '__SAME__'],
  ['warrant(?:y|ies|ied|ee)', 'warrant(?:y|ies|ied|ee)'],
  ['guarantee(?:[ds]|ing)?', 'guarantee(?:[ds]|ing)?'],
  ['refund(?:s|ed|able)?', 'refund(?:s|ed|able)?'],
  ['money[- ]?back', '__SAME__'],
  ['cash[- ]?back', '__SAME__'],
  ['risk[- ]free', '__SAME__'],
  ['(?:free|easy) returns?', '__SAME__'],
  ['returns? (?:policy|window)', '__SAME__'],
  // 免费类各对各的：资料的 free trial 不是信里 free shipping 的出处。
  ['free (?:express|standard|US|international|2-day|two-day) (?:shipping|delivery)', '__SAME__'],
  ['ships? (?:for )?free|shipping is free|free (?:shipping|delivery)', 'ships? (?:for )?free|shipping is free|free (?:shipping|delivery)'],
  ['free (?:gifts?|samples?|trials?|replacements?|upgrades?|accessor(?:y|ies))', '__SAME__'],
  ['complimentary', '__SAME__'],
  ['discount(?:s|ed)?', 'discount(?:s|ed)?'],
  ['commission(?:s)?', 'commission(?:s)?'],
  ['lifetime', '__SAME__'],
  ['for life|forever', '__SAME__'],
  ['ce(?:[- ]marked|[- ]certified| mark)?|ul', '__VERBATIM__'],
  ['certif(?:y|ied|ication|ications|icate|icates)', '__VERBATIM__'],
  ['patent(?:s|ed)?', '__VERBATIM__'],
  ['award[- ]winning|won an award|awards?|awarded', '__VERBATIM__'],
  ['clinically|clinical(?: trials?| studies| study)?', '__VERBATIM__'],
  ['dermatologists?(?:[- ](?:tested|approved|recommended))?', '__VERBATIM__'],
  ['(?:food|medical)[- ]grade', '__SAME__'],
  ['hypoallergenic', '__SAME__'],
  ['fda(?:[- ](?:approved|cleared|registered))?', '__VERBATIM__'],
  ['fcc(?:[- ](?:approved|certified))?', '__VERBATIM__'],
  ['iso(?: ?\\d+)?(?:[- ]certified)?', '__VERBATIM__'],
  ['usda(?:[- ]organic)?', '__VERBATIM__'],
  ['non[- ]?(?:toxic|gmo)', '__SAME__'],
  // 以 -free、-proof 结尾的整词（BPA-free、leakproof）；带空格的只认上面两张表里的前缀，「it's free」「totally free」不是在说产品。
  [`[a-z]+-?free|(?:${FREE_PREFIXES}) free`, '__SAME__'],
  [`[a-z]+-?proof|(?:${PROOF_PREFIXES}) proof`, '__SAME__'],
  ['all[- ]natural', '__SAME__'],
  ['organic', '__SAME__'],
  ['vegan', '__SAME__'],
  ['water[- ]resistant', '__SAME__'],
  ['dishwasher[- ]safe', '__SAME__'],
  ['safe for kids|kid[- ]safe', 'safe for kids|kid[- ]safe'],
  ['biodegradable', '__SAME__'],
  ['recyclable', '__SAME__'],
  ['best[- ]?sell(?:ing|ers?)', 'best[- ]?sell(?:ing|ers?)'],
  ['top[- ]rated', '__SAME__'],
  ['five[- ]star|5[- ]star', 'five[- ]star|5[- ]star'],
  ["world'?s first", "world'?s first"],
  ['#1|number one|no\\. ?1|number 1', '#1|number one|no\\. ?1|number 1'],
]

/** 认承诺词的正则（左边整词起头，「#1」前面不能再有 #）。查否定时先把句子里的承诺词整个拿掉：「Non-toxic BPA-free jar」里的 non 是 non-toxic 自己的，不否定 BPA-free。 */
const PROMISE_RES = PROMISE_WORDS.map(([word]) => new RegExp(`(?<![\\w#])(?:${word})(?![\\w])`, 'gi'))
const withoutPromises = (clause: string): string => PROMISE_RES.reduce((rest, re) => rest.replace(re, ' '), clause)

/** 按草稿里那个词本身去出处里找：空格、连字符可有可无（leakproof 认 leak proof），词尾单复数不计（awards 认 award）。 */
const literalStem = (word: string): string => word.toLowerCase().replace(/[- ]/g, '').replace(/(?<=\w{3})(?<!s)s$/, '').split('')
  .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[- ]?') + '(?:e?s)?'

/** 「免费」类后缀里的日常用法：hands-free 也是产品说法，照列；只排掉不是在说产品的这几个。 */
const NOT_PROMISE = /^(?:feel|stress|worry|hassle|commitment|obligation|string|strings|care|toll)[- ]?free$/i

/**
 * 认证类说法核整句：认证、批准、注册、检测、推荐、获奖、专利，和 FDA、CE 这类机构名（承诺词表里标 __VERBATIM__ 的几项）。
 * 这些词所在的那一整句要在资料某一句里原样出现，且资料那一句不是否定、问句、还没拿到或说别家。以前从句子里取「谁认证」那几个词去比，
 * 取不全的写法一直有（certified organic、a WQA, NSF certified filter），整句比不用取词。表外的 approved、tested 这类词只在说明是谁认可时才核。
 */
const ENDORSE = /(?<![\p{L}\d_])(?:certif(?:y|ied|ication|ications|icate|icates)|patent(?:s|ed)?|award(?:s|ed)?|approv(?:e|ed|al|als)|clear(?:ed|ance)|regist(?:ered|ration)|listed|complian(?:t|ce)|tested|recommend(?:ed|s)?|endorse(?:d|ment|ments)?|proven|accredit(?:ed|ation))(?![\p{L}\d_])/giu
const ENDORSED = 'endorsed:'
/**
 * 句子的边界：句号、分号、问叹号后跟空白，或换行。U.S. 这种连写的单字母缩写、Dr.、Inc.、Nov. 后面的点不算；
 * 50 m.、1 L. 这种数后面单个字母的点照常算（下一句的 not 不否定上一句）。草稿与资料两边分句用同一份。
 */
const NOT_ABBREV = String.raw`(?<!\p{L}\.\p{L}|(?:^|[^\p{L}])(?:Dr|Mr|Mrs|Ms|Jr|Sr|St|vs|etc|Inc|Ltd|Co|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec))`
const CLAUSE_END = new RegExp(`${NOT_ABBREV}[.;!?\\n]+(?:\\s|$)|[;!?\\n]`, 'u')
const SENTENCE_END = new RegExp(`${NOT_ABBREV}[.;!?](?=\\s|$)|\\n`, 'gu')
/** 认证类那一句在资料里要原样出现（空格、连字符、单复数、大小写不计）。 */
const verbatim = (text: string): RegExp => new RegExp(`(?<![\\p{L}\\d_-])${literalStem(text)}(?![\\p{L}\\d_])`, 'giu')
/** 认证词左边紧挨着、但不说明是谁认可的词：We tested it、Once approved、Highly recommended 不算认证说法。 */
const NOT_WHO = /^(?:our|your|their|its|it|it's|this|that|these|those|we|we're|you|you're|they|they're|i|i'm|is|are|was|were|be|been|being|has|have|had|and|or|but|with|for|of|to|in|on|at|as|the|a|an|by|so|also|both|all|every|each|fully|totally|highly|now|just|still|once|my|hi|hey|plus|not|if|when|get|gets|got|i've|we've|you've|they've|i'd|we'd|you'd|would|could|should|can|can't|cannot|will|really|definitely|strongly|personally|she|he|who|which)$/i
/** by 后面、认证词后面紧跟的这些词说的是收信人或我们自己，不是认证方（approved by you、Sarah recommended you）。 */
const PRONOUN = /^(?:you|your|yours|me|my|us|our|ours|it|its|this|that|them|their|him|her|everyone|anyone)$/i
/** 主语是这些时说的是自己做的事（I tested Whirl Go、we cleared Friday），不是认证。 */
const SUBJECT = /^(?:i|we|you|they|he|she|i've|we've|you've|they've|i'd|we'd|you'd|i'll|we'll|you'll)$/i
const WORD = String.raw`[\p{L}\d](?:[\p{L}\d'®™-]|\.(?=[\p{L}\d]))*`
const BY = new RegExp(`^\\s(?:by|from|to|under|through|with|include|includes|including)\\s(?:the\\s|a\\s|an\\s)?(${WORD})|^(?:\\s[\\p{L}-]+){1,3}\\sby\\s(?:the\\s)?(${WORD})`, 'iu')
/**
 * 一个认证词算不算认证说法：左边紧挨着一个说明是谁的词（vet recommended、FDA approved、lab tested），
 * 或右边接冒号、括号、by / from / to / under / through / with / include（几个词之内的 by 也算：Tested hypoallergenic by SGS），
 * 或紧跟大写的名字（Certified Kosher）。只决定要不要核这一句；核的时候比的是整句，不靠这里取词。
 */
function endorsing(before: string, after: string): boolean {
  const left = new RegExp(`([\\p{L}\\d][\\p{L}\\d'®™-]*)["'”’]?[ \\t\\u00a0-]$`, 'u').exec(before.slice(-60))?.[1]
  const next = new RegExp(`^\\s(?:the\\s|a\\s|an\\s)?(${WORD})`, 'u').exec(after)?.[1]
  if (next !== undefined && PRONOUN.test(next)) return false
  if (left !== undefined && (!NOT_WHO.test(left) || /^\p{Lu}{2,}$/u.test(left))) return true
  if (/^\s?[:(]/u.test(after)) return true
  const by = BY.exec(after)
  if (by !== null) return !PRONOUN.test(by[1] ?? by[2])
  return next !== undefined && /^\p{Lu}/u.test(next) && !(left !== undefined && SUBJECT.test(left))
}
/** 一段文字里每一句的起止（按 SENTENCE_END 切，一遍走完）；认证词所在的那一句用二分查找取。 */
function sentences(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let from = 0
  for (const b of text.matchAll(SENTENCE_END)) { out.push([from, b.index]); from = b.index + b[0].length }
  out.push([from, text.length])
  return out
}
/** 下标 at 所在的那一句：返回句首下标与整句（去掉首尾空白）。 */
function sentenceAt(text: string, spans: ReadonlyArray<[number, number]>, at: number): { at: number; text: string } {
  let lo = 0, hi = spans.length - 1
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (spans[mid][0] <= at) lo = mid; else hi = mid - 1 }
  const [from, to] = spans[lo], raw = text.slice(from, to)
  return { at: from + raw.length - raw.trimStart().length, text: raw.trim() }
}
/** 一句话里的否定：资料里这一句是否定说法时，不给草稿里同一个承诺词当出处。 */
const NEGATION = /(?<![a-z])(?:no|not|non|never|neither|nor|none|without|pending|awaiting|applied|applying|seeking|submitted|expected|planned|upcoming|in progress|in process|void|cannot|except|unless|expired|hardly|exclud(?:e|es|ed|ing)|exclusions?|isn't|aren't|doesn't|don't|won't)(?![a-z])|n't(?![a-z])/i
/** 认证类那一句另外不算出处的：还没拿到、已失效、说的是别家（只对认证类，普通承诺词照上面那份）。 */
const NOT_YET = /(?<![a-z])(?:lapsed|revoked|suspended|withdrawn|filed|filing|exempt|lacks?|lacking|unlike|yet|soon|hoping|hope|intends?|will be|under review|competitors?|rivals?|other brands?|coming|plans?|planning|aims?|goal|to become|to be|in the process|in the works|underway|getting|pursuing|waiting|working towards?|formerly|previous|until|false|untrue|avoid|tbd|n\/a|isnt|arent|doesnt|dont|wont)(?![a-z])/i

/** 一个数：千分位只认三位一组（「400, weighs」里的逗号不算），可带小数，也可以是「.5」。 */
const DIGITS = '(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)'
const CURRENCY_WORDS = 'dollars?|bucks|usd|eur|euros?|gbp|cad|aud|inr'
const CURRENCY_SIGNS = '$€£¥₹'

/** 钟点后面认的时区缩写。 */
const TIME_ZONES = 'pst|pdt|est|edt|cst|cdt|mst|mdt|cet|cest|gmt|utc|bst|ist|jst|aest|sgt|hkt'
/**
 * 只藏网址和邮箱（里面的日期、数字不算说法）；别的一概不藏。漏标比多标贵，而「猜哪些数字是噪音」每多猜一种写法，
 * 就多一条把真的规格、比例、价钱藏掉的路。电话、钟点不藏，整串合成一条照列（带上下文，运营一眼看出是什么）：
 * 合并只会多标（出处里要有同一串才对上），不会漏标。都只在一行之内认，不跨行。
 */
const LINKS: readonly RegExp[] = [
  /\b[\w.+-]+@[\w-]+(?:\.[a-zA-Z][\w-]*)*\.[a-z][a-z0-9-]*\b/g,                    // 邮箱：后缀小写字母起头（4K@59.94fps、1080p@60fps.It 不是）
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi,                                                  // 网址
  // 不带协议的网址：网址名里要有字母，后缀要小写（「$29.99.Shop now」「40 hours.Me and」是句号后漏了空格，不是网址）。
  /(?<![\w-])(?=[\w-]*[a-zA-Z])[\w-]+\.(?:[\w-]+\.)*(?:com|net|org|io|co|ly|me|app|shop|store|us|uk|ca|de|fr|tv|gg|link|bio|page)\b(?:\/\S*)?/g,
]
/** 钟点整串一条：10:30、9:00-17:00、10:30 and 11:30、10:30 am PST、1:10 to 1:20（比例也是这个形状，照样列出）。 */
const CLOCK = new RegExp(`(?<![\\w.${CURRENCY_SIGNS}])\\d{1,2}:\\d{2}(?:[ \\t]?(?:-|to|and|until|till)[ \\t]?\\d{1,2}:\\d{2})?` +
  `(?:[ \\t]?(?:am|pm|a\\.m\\.|p\\.m\\.))?(?:[ \\t]?(?:${TIME_ZONES})\\b)?(?![\\w:])`, 'gi')
/** 一行里用空格、点、连字符、括号隔开的几组数字，合起来至少九位：多半是电话（415 555 0199、07700 900123、+44 (0)20 7946 0958），整串一条。 */
const DIGIT_GROUPS = new RegExp(`(?<![\\w.${CURRENCY_SIGNS}])\\+?\\(?\\d{1,5}\\)?(?:(?:[ \\t]{1,2}|[.-]|(?<=\\)))\\(?\\d{1,6}\\)?){1,}(?![\\w%]|[.,]\\d)`, 'g')
const groupKey = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ')
/** 一个数后面的单位，按 NUMBER 的口径：%、度数、贴写、空格或连字符隔开（越过 +、plus、more 这几个词），虚词不算。 */
function numberUnit(m: RegExpExecArray): string {
  const [, , percent, degree, glued, spaced] = m
  return percent !== undefined ? '%'
    : degree !== undefined ? `°${degree.replace(/[°\s]/g, '').toLowerCase()}`
      : glued !== undefined ? foldUnit(glued)
        : spaced !== undefined && !NOT_UNITS.has(spaced.toLowerCase()) ? foldUnit(spaced) : ''
}
/** 合成的一条（电话、钟点、斜杠日期）后面的单位：最后一个数接上后面的文字，按普通数字的口径取（1000$ 算价钱）。 */
function unitAfter(group: string, after: string): string {
  // 不以数字结尾的一串（(400)、1:30 pm）拿 0 去接后文，口径一样。
  const probe = (/\d+(?:\.\d+)?$/.exec(group)?.[0] ?? '0') + after
  if (new RegExp(`^(?:${PRICE_AFTER.source})`, 'i').test(probe)) return '$'
  const m = new RegExp(`^(?:${NUMBER.source})`, 'i').exec(probe)
  return m === null ? '' : numberUnit(m)
}
const isLong = (s: string) => (s.match(/\d/g) ?? []).length >= 9

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
/** 日期整串算一条：11/20/2026、2026-11-20、March 15、March 15th、15 March 2026、15th March、the 20th of March。 */
const DATE = new RegExp(`\\b(?:\\d{1,2}/\\d{1,2}/\\d{2,4}|\\d{4}-\\d{1,2}-\\d{1,2}|(?:${MONTHS})\\.? \\d{1,2}(?:st|nd|rd|th)?(?:,? \\d{4})?|\\d{1,2}(?:st|nd|rd|th)? (?:of )?(?:${MONTHS})(?:,? \\d{4})?)\\b`, 'gi')

/** 价格：币符或币种在前（$29.99、$ 40、US$5、₹400、USD 40、CAD 40），或写在后面（40 dollars、50-dollar、40 USD、40$、40€）。 */
const PRICE_BEFORE = new RegExp(`(?:US\\$|[${CURRENCY_SIGNS}][ \\t]?|\\b(?:usd|eur|gbp|cad|aud|inr)\\s?)(${DIGITS})(?:\\s?(k|m)\\b)?`, 'gi')
// 币符写在后面只认贴着前一个数、又不贴着后一个数的（40$、129$ 40）；「2 $50」「59 $39」「129$40」里的 $ 归后面那个数。
const PRICE_AFTER = new RegExp(`(?<![\\w.])(${DIGITS})(?:[ \\t-]?(?:${CURRENCY_WORDS})\\b|[${CURRENCY_SIGNS}](?!\\d)|[ \\t][${CURRENCY_SIGNS}](?![ \\t]?\\d))`, 'gi')
/** 拼写的数加钱或百分号：fifty dollars、a fifty-dollar card、thirty bucks、fifty per cent。 */
const SPELLED_PRICE = new RegExp(`\\b(${SPELLED})[\\s-](?:${CURRENCY_WORDS})\\b`, 'gi')
const SPELLED_PERCENT = new RegExp(`\\b(${SPELLED})[\\s-](?:percent|per cent)\\b`, 'gi')
/** 拼写的数后面跟单位表里的单位：ten seconds、twenty five hours、a thousand-hour。 */
const unitWords = W(Object.keys(UNIT_ALIASES).filter(u => u !== '%' && u.length > 1))
const SPELLED_UNIT = new RegExp(`\\b(${SPELLED})[\\s-](${unitWords})\\b`, 'gi')
/** 开发信里最常被编的几种不带阿拉伯数字的数量：half off、double、twice、a dozen、several hundred、hundreds。 */
const QUANTITY_PHRASES = /\b(?:half[- ](?:off|price)|double[sd]?|twice|(?:a|an|a few|several|many)[\s-](?:dozen|million|thousand|hundred)|millions|thousands|hundreds|dozens)\b/gi
/** 百分号与 per cent 写法。 */
const PERCENT_WORDS = '%|percent\\b|per cent\\b|pct\\b'
/**
 * 一个阿拉伯数后面可以跟单位：贴着写（400ml、1080p、4K）、空格或连字符隔开（400 ml、10-second）、度数（40°C）。
 * 负号只在前面不是字母、数字、点时才算数的一部分：「-20」是负数，「3-5 years」「COVID-19」里的不是。
 */
const NUMBER = new RegExp(`(?<![\\w.${CURRENCY_SIGNS}])(-?${DIGITS})(?:\\s?\\+|[\\s-]plus)?(?:(\\s?(?:${PERCENT_WORDS}))|(°\\s?[cf]\\b)|([a-z]+(?![\\w]))|(?:[\\s-](?:(?:more|extra|additional|full|whole|total|or more|plus)\\s+)?([a-z]+(?!\\w|'(?!s\\b)[a-z])))?)(?!\\w|\\.\\d)`, 'gi')
/** 兜底：前面各条都没认走、仍带数字的一串整串列（1920x1080、5V2A、6.1x2.8、20.11.2026），不带末尾标点；
 * 紧跟的字母后缀（px、-inch）列出来但不进比对。 */
const LEFTOVER = /[\w.,/+-]*\d([a-z]*(?:[-/][a-z]+)*)/gi
/** 型号串：字母起头又含数字的整词（IPX7、Qi2、H13、IPX-7）；「1-on-1」里的 on-1 不算。 */
const ALNUM = /(?<![\w-])[a-z]+-?\d[a-z0-9]*\b/gi

/** `key` 是归一后用来比的样子；承诺词另带去出处里找的写法。 */
export interface Claim { text: string; key: string; at: number; stem?: RegExp }

const numberValue = (raw: string): string => {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? String(n) : raw
}

/** 排版字符换成键盘上的写法（弯撇号换 '，各种连字符、短横换 -）；一个换一个，下标不变，前后文仍取草稿原文。 */
const plain = (text: string): string => text.replace(/[’‘ʼ]/g, "'").replace(/[‐‑‒–]/g, '-').replace(/(?<=\w)—/g, ' ').replace(/—/g, '-')

/** {…} 占位符：只认同一行、40 字以内的，套着写的（{{price}}）由里往外剥。剥掉的位置补空白，下标不变。 */
function placeholders(text: string): { rest: string; unmatched: boolean } {
  let rest = text, prev = ''
  while (rest !== prev) { prev = rest; rest = rest.replace(/\{[^{}\n]{0,40}\}/g, m => ' '.repeat(m.length)) }
  return { rest, unmatched: /[{}]/.test(rest) }
}

/** 把一段文字拆成可比的说法；草稿与出处走同一个函数，归一口径才一致。 */
export function claimsIn(text: string): Claim[] {
  const out: Claim[] = []
  const unmasked = placeholders(plain(text)).rest
  let rest = unmasked
  const spans = sentences(unmasked)
  // take 返回 'keep' 时这一段原样留下给后面的规则；返回 undefined 时遮掉、不算说法。
  // after 是这一段后面紧跟的文字，合成一条的电话、钟点拿它取单位。
  const mask = (re: RegExp, take: (m: RegExpExecArray, after: string, before: string) => Omit<Claim, 'at'> & { at?: number } | undefined | 'keep') => {
    rest = rest.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray
      const whole = args.at(-1) as string, at = args.at(-2) as number
      const claim = take(m, whole.slice(at + m[0].length), whole.slice(0, at))
      if (claim === 'keep') return m[0]
      if (claim !== undefined) out.push({ at, ...claim })
      return ' '.repeat(m[0].length)
    })
  }
  // 只藏网址、邮箱，最先认（链接里的日期不算）；日期、钟点、电话各合成一条，位数不够的一串数原样留下照常扫。
  for (const re of LINKS) mask(re, () => undefined)
  // 只有斜杠写的三段（10/20/30 oz）可能是规格，带上后面的单位；月份名、年月日写法的真日期不比后面的词。
  mask(DATE, (m, after) => ({ text: m[0], key: `date:${m[0].toLowerCase().replace(/[\s,.]+/g, ' ')}:${/^\d+\/\d+\/\d+$/.test(m[0]) ? unitAfter(m[0], after) : ''}` }))
  // 合成的一条照原串比（分隔符、小数点都算），后面紧跟的单位也进比对：1:30 hours 对不上 1:30 minutes。
  mask(CLOCK, (m, after) => ({ text: m[0], key: `time:${groupKey(m[0])}:${unitAfter(m[0], after)}` }))
  mask(DIGIT_GROUPS, (m, after) => isLong(m[0]) ? { text: m[0], key: `digits:${groupKey(m[0])}:${unitAfter(m[0], after)}` } : 'keep')
  // 认证类说法核整句：认证词所在的那一句要在资料某一句里原样出现。只遮认证词本身，句子里的数照常比。
  // 不说明是谁认可的（once approved、we tested）不算认证说法。
  // 整句从没遮过的原文里取（前面的规则已经遮掉的字照样算在句子里）。
  const endorsed = (m: RegExpExecArray, after: string, before: string) => {
    const { at, text } = sentenceAt(unmasked, spans, before.length)
    return { at, text, key: ENDORSED + text.toLowerCase(), stem: verbatim(text) }
  }
  mask(ENDORSE, (m, after, before) => endorsing(before, after) ? endorsed(m, after, before) : 'keep')
  // 承诺词先认走：「#1」里的 1、「5-star」里的 5 不另算一个数字。
  PROMISE_WORDS.forEach(([, stem], i) => {
    mask(PROMISE_RES[i], (m, after, before) => {
      if (NOT_PROMISE.test(m[0])) return undefined
      // 认证、专利、获奖、机构名（FDA、CE、UL…）同样核整句。
      if (stem === '__VERBATIM__') return endorsed(m, after, before)
      const source = stem === '__SAME__' ? literalStem(m[0]) : stem
      return { text: m[0], key: `word:${m[0].toLowerCase()}`, stem: new RegExp(`(?<!\\w)(?:${source})(?!\\w)`, 'gi') }
    })
  })
  mask(SPELLED_PRICE, m => withValue(m, spelledValue(m[1]), v => `price:${v}`))
  mask(SPELLED_PERCENT, m => withValue(m, spelledValue(m[1]), v => `num:${v}:%`))
  mask(SPELLED_UNIT, m => withValue(m, spelledValue(m[1]), v => `num:${v}:${foldUnit(m[2])}`))
  mask(QUANTITY_PHRASES, m => ({ text: m[0], key: `phrase:${m[0].toLowerCase().replace(/[\s-]+/g, ' ')}` }))
  // 币符写在后面的先认：「129$ 40 hours」里的 $ 归 129，不和后面的 40 拼成价钱。
  mask(PRICE_AFTER, m => ({ text: m[0].trim(), key: `price:${numberValue(m[1])}` }))
  mask(PRICE_BEFORE, m => ({ text: m[0].trim(), key: `price:${scaled(m[1], m[2])}` }))
  mask(ALNUM, m => ({ text: m[0], key: `alnum:${m[0].toLowerCase().replace(/-/g, '')}` }))
  mask(NUMBER, m => {
    const unit = numberUnit(m)
    const text = unit === '' && m[5] !== undefined ? m[1] : m[0].trim()
    return { text, key: `num:${numberValue(m[1])}:${unit}` }
  })
  // 兜底：上面哪条规则都没认走的数字（6.1x2.8、1.000.000、v1.2.3 里的 2.3）整串照列，不让它静默消失。
  // 比的是到最后一个数字为止的那一截：6.1x2.8-inch 与 6.1x2.8 inches、1920x1080px 与 1920x1080 算同一个（同型号串，不比单位）。
  mask(LEFTOVER, m => ({ text: m[0], key: `raw:${m[0].slice(0, m[0].length - m[1].length).toLowerCase()}` }))
  // 列出来的是草稿原文那几个字（BPA‑free 里的不换行连字符照原样），比对用的 key 来自换过排版字符的文字。
  return out.map(c => ({ ...c, text: text.slice(c.at, c.at + c.text.length) })).sort((a, b) => a.at - b.at)
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
  // 问句（Is it FDA approved?）不是在说产品，不给承诺词当出处：按标点切成小段，以问号收尾的那段换成空格（逐段走一遍，不回头扫）。
  // 再分句；U.S. 这类单个字母后面的点不当句号（照抄 approved by the U.S. FDA 要整句对得上）。
  const noQuestions = (t: string) => (t.match(/[^.;!?\n]+[.;!?\n]*|[.;!?\n]+/g) ?? []).map(p => p.includes('?') ? ' ' : p).join('')
  const clauses = texts.flatMap(t => noQuestions(placeholders(plain(t)).rest).split(CLAUSE_END))
    .filter(s => s.trim() !== '')
  return { keys, values, clauses }
}

/**
 * 出处里有没有这一条：
 * - 带单位的数要同数同单位（单位按别名与单复数归一）；草稿里的裸数，出处里有同一个数就算；
 * - 价钱只对出处里标明是价钱的同数；型号串、日期、数量写法整串对；
 * - 承诺词要在出处某一句里整词出现，且那一句不带否定（Not waterproof、Patent pending、warranty void）；
 *   认证类那一整句要在出处某一句里原样出现，那一句还不能是还没拿到、已失效或说别家。
 */
function sourced(claim: Claim, source: Source): boolean {
  if (claim.stem !== undefined) {
    const stem = claim.stem
    return source.clauses.some(clause => {
      stem.lastIndex = 0
      if (!stem.test(clause)) return false
      const rest = withoutPromises(clause)
      return !NEGATION.test(rest) && !(claim.key.startsWith(ENDORSED) && NOT_YET.test(rest))
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
