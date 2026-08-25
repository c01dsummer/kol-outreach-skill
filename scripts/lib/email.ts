/*
 * 创作者常用反爬写法：
 *   sarah@gmail.com
 *   sarah (at) gmail (dot) com
 *   sarah[at]gmail[dot]com
 *   sarah at gmail dot com
 *
 * 两条模式而非一条：符号 @ 可以配任意 dot 形式；但**拼写出来的 " at " 必须配
 * 拼写出来的 " dot "**。否则 "look at gmail.com" 这类正常语句会被误判成邮箱。
 */
const AT_SYM = String.raw`(?:@|\(\s*at\s*\)|\[\s*at\s*\])`
const DOT_ANY = String.raw`(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)`
const DOT_SPELLED = String.raw`(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)`

const PATTERNS = [
  new RegExp(String.raw`[\w.+-]+\s*${AT_SYM}\s*[\w-]+(?:\s*${DOT_ANY}\s*[\w-]+)+`, 'gi'),
  new RegExp(String.raw`[\w.+-]+\s+at\s+[\w-]+(?:\s*${DOT_SPELLED}\s*[\w-]+)+`, 'gi'),
]

/** 图片/视频文件名会被误判成邮箱（如 logo@2x.png） */
const FILE_EXT = /\.(png|jpe?g|gif|webp|svg|mp4|mov|pdf)$/i

const VALID = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

function normalize(raw: string): string {
  return raw
    .replace(new RegExp(String.raw`\s*(?:\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+)\s*`, 'i'), '@')
    .replace(new RegExp(String.raw`\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*`, 'gi'), '.')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 从 bio 提取邮箱。找不到返回 null。 */
export function extractEmail(text: string): string | null {
  if (!text) return null
  for (const re of PATTERNS) {
    re.lastIndex = 0
    for (const raw of text.match(re) ?? []) {
      const norm = normalize(raw)
      if (!VALID.test(norm)) continue
      if (FILE_EXT.test(norm)) continue
      return norm
    }
  }
  return null
}

/** 商务合作信号 —— 命中给 +10 分 */
export const PR_SIGNALS =
  /\b(pr|collab|collabs|business|partner|partnerships?|brand|sponsor|inquiry|inquiries|ugc|creator|media\s?kit)\b|工作|合作|商务/i
