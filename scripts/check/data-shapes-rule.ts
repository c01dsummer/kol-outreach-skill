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
import { join } from 'node:path'
import { createGenerator } from 'ts-json-schema-generator'

/** 一类存下来的数据：叫什么、存在哪、形状由哪份文件里的哪个类型说 */
export interface StoredShape {
  readonly name: string
  readonly stored: string
  readonly source: string
  readonly type: string
}

/** 登记的几类。加一类就在这里加一行，再回写快照 */
export const STORED_SHAPES: readonly StoredShape[] = [
  { name: '任务状态', stored: '任务目录里的 task.json', source: 'scripts/lib/types.ts', type: 'TaskState' },
  { name: '名单里的一位创作者', stored: '任务目录里的 creators.json 与 creators.raw.json（每一项）', source: 'scripts/lib/types.ts', type: 'Creator' },
  { name: '评审正本', stored: '任务目录里的 agent-review.json', source: 'scripts/lib/review.ts', type: 'AgentReviewDocument' },
  { name: '跨任务记忆', stored: 'memory/creators.json', source: 'scripts/lib/memory.ts', type: 'MemoryFile' },
  { name: '经验库', stored: 'memory/lessons/<品类>.json', source: 'scripts/lib/lessons.ts', type: 'LessonsFile' },
  { name: '经验读取记录', stored: '任务目录里的 lessons-read.json', source: 'scripts/lib/lessons.ts', type: 'LessonsReadFile' },
  { name: '人工反馈表的一行', stored: '任务目录里的 manual-feedback.csv（人填好后程序读回来）', source: 'scripts/lib/manual-feedback.ts', type: 'ManualFeedbackRow' },
]

/** 快照在仓库里的位置 */
export const SHAPES_SNAPSHOT_PATH = 'scripts/check/data-shapes.json'

/** 按仓库根 `root` 下的类型现生成快照全文：每一类一项，键是登记的名字，按登记的先后排 */
export function generateShapes(root: string, shapes: readonly StoredShape[] = STORED_SHAPES): string {
  // 几类共用一个 TypeScript 程序：各建一次要慢上好几倍
  const sources = [...new Set(shapes.map(s => s.source))]
  const generator = createGenerator({
    path: join(root, sources.length === 1 ? sources[0] : `{${sources.join(',')}}`),
    tsconfig: join(root, 'tsconfig.json'),
    // 与增强结果那份同样的开关：类型里没写的键一律不认、可辨识联合按 if/then 写出、定义名不做 URL 编码
    additionalProperties: false,
    discriminatorType: 'json-schema',
    // 注释不进快照：只改一句说明不是改形状，不该报「形状变了」（增强结果那份要给人读说明，才写进去）
    jsDoc: 'basic',
    encodeRefs: false,
  })
  const out: Record<string, unknown> = {}
  for (const s of shapes) out[s.name] = { stored: s.stored, type: `${s.source} 里的 ${s.type}`, shape: generator.createSchema(s.type) }
  return `${JSON.stringify({
    $comment: '存下来的数据的形状快照（ADR-246），由类型生成，勿手改。哪一类变了，先照 process/3-BUILD.md 第 9 条写明缺着怎么读、该不该升版本，再跑 npm run data-shapes -- --write 回写。',
    shapes: out,
  }, null, 2)}\n`
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
