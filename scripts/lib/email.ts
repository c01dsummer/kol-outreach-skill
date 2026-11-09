/*
 * 创作者常用反爬写法：
 *   sarah@example.com
 *   sarah (at) example (dot) com
 *   sarah[at]example[dot]com
 *   sarah at example dot com
 *
 * 两条模式而非一条：符号 @ 可以配任意 dot 形式；但**拼写出来的 " at " 必须配
 * 拼写出来的 " dot "**。否则 "look at gmail.com" 这类正常语句会被误判成邮箱。
 *
 * 符号 @ 前面隔了空白、后面紧贴着名字的，是 @提及（"follow @jane.doe"），不是邮箱：
 * 那个 @ 要么紧贴前面的名字，要么两边都隔空白（"press @ example.com"）。
 */
const AT_SYM = String.raw`(?:@|\s+@(?=\s)|\s*\(\s*at\s*\)|\s*\[\s*at\s*\])`
const DOT_ANY = String.raw`(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)`
const DOT_SPELLED = String.raw`(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)`

const PATTERNS = [
  new RegExp(String.raw`[\w.+-]+${AT_SYM}\s*[\w-]+(?:\s*${DOT_ANY}\s*[\w-]+)+`, 'gi'),
  new RegExp(String.raw`[\w.+-]+\s+at\s+[\w-]+(?:\s*${DOT_SPELLED}\s*[\w-]+)+`, 'gi'),
]

/** 图片/视频文件名会被误判成邮箱（如 logo@2x.png） */
const FILE_EXT = /\.(png|jpe?g|gif|webp|svg|mp4|mov|pdf)$/i

/** 多个邮箱连成一个值时的分隔（D7.d） */
export const EMAIL_SEP = ', '

const VALID = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

function normalize(raw: string): string {
  return raw
    .replace(new RegExp(String.raw`\s*(?:\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+)\s*`, 'i'), '@')
    .replace(new RegExp(String.raw`\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*`, 'gi'), '.')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * 从 bio 提取邮箱。找不到返回 null。
 *
 * 有几个列几个（D7.d）：按在 bio 里出现的先后、同一地址只列一次，用 ', ' 连成一个值。
 * 只取第一个的话，常常留下的是经纪公司那个，而该联系谁是人的判断，不是这里的。
 */
export function extractEmail(text: string): string | null {
  if (!text) return null
  const found: { at: number, email: string }[] = []
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const norm = normalize(m[0])
      if (!VALID.test(norm)) continue
      if (FILE_EXT.test(norm)) continue
      found.push({ at: m.index, email: norm })
    }
  }
  const emails = [...new Set(found.sort((a, b) => a.at - b.at).map(f => f.email))]
  return emails.length ? emails.join(EMAIL_SEP) : null
}

/** 商务合作信号 —— 命中给 +10 分 */
export const PR_SIGNALS =
  /\b(pr|collab|collabs|business|partner|partnerships?|brand|sponsor|inquiry|inquiries|ugc|creator|media\s?kit)\b|工作|合作|商务/i
