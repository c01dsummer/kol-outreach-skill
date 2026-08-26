import { deflateRawSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

/*
 * 最小 XLSX 写出器（多 sheet）。
 *
 * 为什么手写而不用 exceljs：本项目是发布给别人 clone 的，零运行时依赖是
 * 一项实打实的好处（npm install 更快、供应链面更小）。这里只需要「字符串+
 * 数字、多个 sheet、首行加粗冻结」，用不上完整 Excel 模型。
 *
 * 产出用 inlineStr，省掉 sharedStrings 表；ZIP 用 deflate-raw。
 */

// ---------- ZIP ----------

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

interface Entry { name: string; data: Buffer }

function zip(entries: Entry[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8')
    const comp = deflateRawSync(e.data)
    const crc = crc32(e.data)

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)            // version needed
    lh.writeUInt16LE(0, 6)             // flags
    lh.writeUInt16LE(8, 8)             // method: deflate
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12)   // time/date
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(comp.length, 18)
    lh.writeUInt32LE(e.data.length, 22)
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)
    locals.push(lh, nameBuf, comp)

    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10)
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(comp.length, 20)
    ch.writeUInt32LE(e.data.length, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt32LE(offset, 42)       // 本条目 local header 在文件中的偏移
    centrals.push(ch, nameBuf)

    offset += 30 + nameBuf.length + comp.length
  }

  const central = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(offset, 16)

  return Buffer.concat([...locals, central, end])
}

// ---------- XLSX ----------

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   // XML 1.0 不允许的控制字符会让 Excel 直接拒绝打开文件
   .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

function colName(i: number): string {
  let s = ''
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

export interface Sheet {
  name: string
  headers: string[]
  rows: unknown[][]
}

function sheetXml(sheet: Sheet): string {
  const cell = (r: number, c: number, v: unknown): string => {
    const ref = `${colName(c)}${r}`
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`
    const s = String(v ?? '')
    if (!s) return ''
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(s)}</t></is></c>`
  }
  const rows = [
    `<row r="1">${sheet.headers.map((h, c) => cell(1, c, h)).join('')}</row>`,
    ...sheet.rows.map((r, i) =>
      `<row r="${i + 2}">${r.map((v, c) => cell(i + 2, c, v)).join('')}</row>`),
  ].join('')
  const lastCol = colName(Math.max(sheet.headers.length - 1, 0))
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetData>${rows}</sheetData>
<autoFilter ref="A1:${lastCol}${sheet.rows.length + 1}"/>
</worksheet>`
}

/** sheet 名不能含 : \ / ? * [ ]，且不超过 31 字符 */
const safeName = (n: string) => n.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)

export function writeXlsx(path: string, sheets: Sheet[]): void {
  const files: Entry[] = []
  const add = (name: string, s: string) => files.push({ name, data: Buffer.from(s, 'utf8') })

  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`)

  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)

  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(safeName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`)

  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
</Relationships>`)

  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)))

  writeFileSync(path, zip(files))
}
