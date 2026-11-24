/**
 * 存下来的数据的形状快照（ADR-246，`process/3-BUILD.md` 第 9 条第五件）。
 *
 * 程序会读回来的那几类数据，各自的形状由它的 TypeScript 类型生成一份（ts-json-schema-generator，与增强结果那份格式说明同一个工具，ADR-232），
 * 放进仓库里的快照。需求测试拿当前类型现生成的与快照比，不一样就红，点名是哪几类 —— 直到同一条改动里回写快照。
 * 红的那一刻就是该问第 9 条那一句的时候：「这次加的、删的、改名的字段，旧数据里缺着时读成什么，写在哪，测了什么？」
 *
 * 快照只看得到类型说了的形状：不经类型、手拼出来写盘的字段它看不到。增强结果不在这张表里：它那份格式说明本身就是由类型生成、
 * 读入时还拿来整份校验的（ADR-232），已经是一份快照，同一个形状不登记两次。
 */
import { join, resolve } from 'node:path'
import { createGenerator } from 'ts-json-schema-generator'
import ts from 'typescript'

/**
 * 一类存下来的数据：叫什么、存在哪、形状由哪份文件里的哪个类型说。
 * 盘上是表格、读的时候按表头逐列核的，再给 `columnsFrom`：同一份文件里导出的那串表头常量（写死的字符串、`as const`）的名字。
 * 类型说的是读进来以后的样子，表头改了它看不出；表头也从被检查的那份仓库里、由编译器读出来，与类型同出一处 ——
 * 不从检查器自己 import：那样读到的是检查器所在那份仓库的表头。
 */
export interface StoredShape {
  readonly name: string
  readonly stored: string
  readonly source: string
  readonly type: string
  readonly columnsFrom?: string
}

/** 登记的几类。加一类就在这里加一行，再回写快照 */
export const STORED_SHAPES: readonly StoredShape[] = [
  { name: '任务状态', stored: '任务目录里的 task.json', source: 'scripts/lib/types.ts', type: 'TaskState' },
  { name: '名单里的一位创作者', stored: '任务目录里的 creators.json 与 creators.raw.json（每一项）', source: 'scripts/lib/types.ts', type: 'Creator' },
  { name: '评审正本', stored: '任务目录里的 agent-review.json', source: 'scripts/lib/review.ts', type: 'AgentReviewDocument' },
  { name: '跨任务记忆', stored: 'memory/creators.json', source: 'scripts/lib/memory.ts', type: 'MemoryFile' },
  { name: '经验库', stored: 'memory/lessons/<品类>.json', source: 'scripts/lib/lessons.ts', type: 'LessonsFile' },
  { name: '经验读取记录', stored: '任务目录里的 lessons-read.json', source: 'scripts/lib/lessons.ts', type: 'LessonsReadFile' },
  { name: '人工反馈表的一行', stored: '任务目录里的 manual-feedback.csv（人填好后程序读回来）', source: 'scripts/lib/manual-feedback.ts', type: 'ManualFeedbackRow', columnsFrom: 'MANUAL_FEEDBACK_HEADERS' },
]

/** 快照在仓库里的位置 */
export const SHAPES_SNAPSHOT_PATH = 'scripts/check/data-shapes.json'

/** 按仓库根 `root` 下的类型现生成快照全文：每一类一项，键是登记的名字，按登记的先后排 */
export function generateShapes(root: string, shapes: readonly StoredShape[] = STORED_SHAPES): string {
  // 生成器按类型名找声明、不看是哪份文件：两类登记了同一个类型名，会拿到同一个（或错的那个）声明
  const seen = new Map<string, StoredShape>()
  for (const s of shapes) {
    const first = seen.get(s.type)
    if (first !== undefined) throw new Error(`形状快照：「${first.name}」（${first.source}）与「${s.name}」（${s.source}）登记了同一个类型名 ${s.type}`)
    seen.set(s.type, s)
  }
  // 几类共用一个 TypeScript 程序：各建一次要慢上好几倍。程序由字面路径建：交给生成器的 path 会被当成 glob，
  // 仓库所在目录名里带 [ ] { } 时会匹配到别的目录
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile)
  if (config.error !== undefined) throw new Error(`形状快照：读不出 tsconfig.json：${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`)
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root)).options
  const program = ts.createProgram([...new Set(shapes.map(s => resolve(root, s.source)))], { ...options, noEmit: true })
  const broken = ts.getPreEmitDiagnostics(program)
  if (broken.length > 0) throw new Error(`形状快照：类型检查不过：${ts.flattenDiagnosticMessageText(broken[0].messageText, '\n')}`)
  const generator = createGenerator({
    tsProgram: program,
    // 与增强结果那份同样的开关：类型里没写的键一律不认、可辨识联合按 if/then 写出、定义名不做 URL 编码
    additionalProperties: false,
    discriminatorType: 'json-schema',
    // 注释不进快照：只改一句说明不是改形状，不该报「形状变了」（增强结果那份要给人读说明，才写进去）
    jsDoc: 'basic',
    encodeRefs: false,
  })
  const out: Record<string, unknown> = {}
  for (const s of shapes) {
    const columns = s.columnsFrom === undefined ? undefined : constColumns(program, resolve(root, s.source), s.source, s.columnsFrom)
    out[s.name] = { stored: s.stored, type: `${s.source} 里的 ${s.type}`, ...(columns === undefined ? {} : { columns }), shape: withoutNotes(generator.createSchema(s.type)) }
  }
  return `${JSON.stringify({
    $comment: '存下来的数据的形状快照（ADR-246），由类型生成，勿手改。哪一类变了，先照 process/3-BUILD.md 第 9 条写明缺着怎么读、该不该升版本，再跑 npm run data-shapes -- --write 回写。',
    shapes: out,
  }, null, 2)}\n`
}

/**
 * 从程序里那份文件读出导出常量 `name` 的值：必须是写死的一串字符串（`as const`，编译器看到的类型是逐项字面量的元组），
 * 按顺序交回。不是这样（没有这个常量、不是元组、某一项不是写死的字符串）就抛：快照不收猜出来的表头。
 */
function constColumns(program: ts.Program, file: string, shown: string, name: string): string[] {
  const sf = program.getSourceFile(file)
  if (sf === undefined) throw new Error(`形状快照：程序里没有 ${shown}`)
  const checker = program.getTypeChecker()
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== name) continue
      const t = checker.getTypeAtLocation(d.name)
      const items = checker.isTupleType(t) ? checker.getTypeArguments(t as ts.TypeReference) : undefined
      if (items === undefined || !items.every(i => i.isStringLiteral())) throw new Error(`形状快照：${shown} 里的 ${name} 要是写死的一串字符串（as const）`)
      return items.map(i => (i as ts.StringLiteralType).value)
    }
  }
  throw new Error(`形状快照：${shown} 里没有常量 ${name}`)
}

/**
 * `@deprecated` 后面那句说明不算形状：留下「弃用了」这件事（true），丢掉说明文字。
 * 别的注解（长度、范围之类的约束）照留 —— 它们是形状的一部分。
 */
function withoutNotes(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutNotes)
  if (typeof node !== 'object' || node === null) return node
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k === 'deprecated' && typeof v === 'string' ? true : withoutNotes(v)]))
}

/**
 * 快照与现生成的比：交回哪几类变了、哪几类是新登记的、哪几类登记里已经没有了，一类一句；一样就是空的。
 * 快照读不出（不在、不是 JSON、没有 shapes）交回一句为什么。
 */
export function shapeChanges(onDisk: string | undefined, fresh: string): string[] {
  if (onDisk === undefined) return [`快照 ${SHAPES_SNAPSHOT_PATH} 不在`]
  let old: unknown
  try { old = JSON.parse(onDisk) } catch (e) { return [`快照不是 JSON：${(e as Error).message}`] }
  const shapesOf = (d: unknown): Record<string, unknown> | undefined => {
    const s = typeof d === 'object' && d !== null ? (d as Record<string, unknown>).shapes : undefined
    return typeof s === 'object' && s !== null && !Array.isArray(s) ? s as Record<string, unknown> : undefined
  }
  const before = shapesOf(old)
  if (before === undefined) return ['快照里没有 shapes']
  const after = shapesOf(JSON.parse(fresh)) ?? {}
  const out: string[] = []
  for (const [name, now] of Object.entries(after)) {
    if (!(name in before)) out.push(`${name}：新登记的，快照里还没有`)
    else if (JSON.stringify(before[name]) !== JSON.stringify(now)) out.push(`${name}：形状变了`)
  }
  for (const name of Object.keys(before)) if (!(name in after)) out.push(`${name}：登记里已经没有了，快照里还在`)
  return out
}
