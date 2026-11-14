// KOL-21 C1 · G6 用的两种表格读取，各自独立（冻结单 pack/30-frozen-spec.md:1469）
// - CSV：测试自写最小解析器。格式依据 output-format.md:58（UTF-8 with BOM）、:110（逗号/引号/换行转义，内部引号写两个）。
// - XLSX：测试自写最小 ZIP 容器读取 + XML 读取；deflate 解压用 Node 内置 node:zlib（不是产品模块，也不是产品 reader）。
//   格式依据 output-format.md:118-134（按分层分 sheet、首行冻结、列定义与 CSV 一致）。
// 两种格式互不借用对方的解析结果作证。
import { inflateRawSync } from 'node:zlib'

export interface Table { header: string[]; rows: string[][] }

/** 最小 CSV：去单个 BOM；字段以逗号分隔；双引号包裹的字段内可含逗号、换行，"" 表示一个引号；行以 LF 或 CRLF 结束。 */
export function parseCsv(text: string): Table {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const records: string[][] = []
  let field = ''
  let rec: string[] = []
  let i = 0
  let quoted = false
  let any = false
  while (i < s.length) {
    const c = s[i]
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue }
        quoted = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"' && field === '') { quoted = true; any = true; i++; continue }
    if (c === ',') { rec.push(field); field = ''; any = true; i++; continue }
    if (c === '\r' && s[i + 1] === '\n') { i++; continue }
    if (c === '\n') { rec.push(field); records.push(rec); rec = []; field = ''; any = false; i++; continue }
    field += c; any = true; i++
  }
  if (any || field !== '' || rec.length > 0) { rec.push(field); records.push(rec) }
  const header = records.shift() ?? []
  // 只有一个空字段的记录 = 空行（如文件末尾 LF 之后），不算数据行
  const rows = records.filter((r) => !(r.length === 1 && r[0] === ''))
  return { header, rows }
}

export function col(t: Table, name: string): number {
  return t.header.indexOf(name)
}

// ---- 最小 ZIP 读取（只读中央目录与本地头；支持 stored(0) 与 deflate(8)）----
export function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip: 找不到中央目录结束记录')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: 中央目录项签名不对')
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('zip: 本地头签名不对 ' + name)
    const lNameLen = buf.readUInt16LE(local + 26)
    const lExtraLen = buf.readUInt16LE(local + 28)
    const data = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + csize)
    if (method === 0) out.set(name, Buffer.from(data))
    else if (method === 8) out.set(name, inflateRawSync(data))
    else throw new Error('zip: 不支持的压缩方法 ' + method + '（' + name + '）')
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

function xmlDecode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e === 'amp') return '&'
    if (e === 'lt') return '<'
    if (e === 'gt') return '>'
    if (e === 'quot') return '"'
    if (e === 'apos') return "'"
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16))
    return String.fromCodePoint(parseInt(e.slice(1), 10))
  })
}
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp('(?:^|\\s)' + name.replace(':', '\\:') + '="([^"]*)"').exec(tag)
  return m ? xmlDecode(m[1]) : undefined
}
/** <t> 文本拼接（含富文本 <r><t>…</t></r>）。 */
function textOf(xml: string): string {
  let out = ''
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g
  for (let m = re.exec(xml); m; m = re.exec(xml)) out += xmlDecode(m[1] ?? '')
  return out
}
function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? ''
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export interface XCell { v: string; numeric: boolean }
export interface XSheet { name: string; header: XCell[]; rows: XCell[][] }

/** 读出全部工作表：工作簿顺序、表名、首行为表头、其余有任一非空单元格的行为数据行。 */
export function readXlsx(buf: Buffer): XSheet[] {
  const files = unzip(buf)
  const get = (n: string): string => {
    const b = files.get(n)
    if (!b) throw new Error('xlsx: 缺少 ' + n)
    return b.toString('utf8')
  }
  const shared: string[] = []
  if (files.has('xl/sharedStrings.xml')) {
    const re = /<si>([\s\S]*?)<\/si>/g
    const xml = get('xl/sharedStrings.xml')
    for (let m = re.exec(xml); m; m = re.exec(xml)) shared.push(textOf(m[1]))
  }
  const rels = new Map<string, string>()
  {
    const xml = get('xl/_rels/workbook.xml.rels')
    const re = /<Relationship\b([^>]*)\/?>/g
    for (let m = re.exec(xml); m; m = re.exec(xml)) {
      const id = attr(m[1], 'Id')
      const target = attr(m[1], 'Target')
      if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, ''))
    }
  }
  const sheets: XSheet[] = []
  const wb = get('xl/workbook.xml')
  const re = /<sheet\b([^>]*)\/?>/g
  for (let m = re.exec(wb); m; m = re.exec(wb)) {
    const name = attr(m[1], 'name') ?? ''
    const rid = attr(m[1], 'r:id')
    const path = rid ? rels.get(rid) : undefined
    if (!path) throw new Error('xlsx: 表 ' + name + ' 找不到关系目标')
    const xml = get(path)
    const rowsAll: XCell[][] = []
    const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g
    for (let r = rowRe.exec(xml); r; r = rowRe.exec(xml)) {
      const cells: XCell[] = []
      const body = r[1] ?? ''
      const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
      let next = 0
      for (let c = cRe.exec(body); c; c = cRe.exec(body)) {
        const ref = attr(c[1], 'r')
        const idx = ref ? colIndex(ref) : next
        const t = attr(c[1], 't')
        const inner = c[2] ?? ''
        const vRaw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
        let cell: XCell
        if (t === 's') cell = { v: shared[Number(vRaw)] ?? '', numeric: false }
        else if (t === 'inlineStr') cell = { v: textOf(inner), numeric: false }
        else if (t === 'str' || t === 'b' || t === 'e') cell = { v: xmlDecode(vRaw ?? ''), numeric: false }
        else cell = { v: xmlDecode(vRaw ?? ''), numeric: vRaw !== undefined }
        while (cells.length < idx) cells.push({ v: '', numeric: false })
        cells[idx] = cell
        next = idx + 1
      }
      rowsAll.push(cells)
    }
    const header = rowsAll.shift() ?? []
    const rows = rowsAll.filter((row) => row.some((c) => c && c.v.trim() !== ''))
    sheets.push({ name, header, rows })
  }
  return sheets
}

export function xcol(s: XSheet, name: string): number {
  return s.header.findIndex((c) => c && c.v === name)
}
