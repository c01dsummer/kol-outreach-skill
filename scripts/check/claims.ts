/**
 * 测试运行时留下的覆盖记录 —— 审计据它回答「有没有测试」。
 *
 * 为什么不从源码里搜:**注释掉的认领会被搜出来。**把测试删掉、
 * 把认领留在注释里,审计照样报「有测试」(ADR-20)。
 * 运行时收集的记录里,没执行的就是没有。
 *
 * 路径与文件名常量单独放这里,让写的一方和读的一方指向同一个地方 ——
 * 两边各写一个字符串,迟早会有一边先改。
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const CLAIMS_PATH = '.check-cache/test-claims.json'
/** 指纹算哪些文件 —— 是一棵树,不是某一个文件,理由见 `sourceFiles` */
export const SOURCE_DIR = 'scripts'

export interface Claims {
  /** 写下这份记录时整棵 `scripts/` 树的指纹。对不上就是过期记录,不算数 */
  source_hash: string
  /** 真正跑过的需求编号 */
  covered: string[]
}

/**
 * 这份记录还新鲜吗 —— 指纹对不上就是过期的,不算数（ADR-20）。
 *
 * 抽出来是为了它能被测:比较本身留在入口里,改成反向比较或恒真,
 * 没有任何一条测试会红,而过期检查就静默失效了（M-H14-c 守着）。
 */
export const claimsFresh = (recordHash: string, selfHash: string): boolean =>
  recordHash === selfHash

/** 一组「路径 → 内容」的指纹。路径也进哈希:只哈希内容的话,改名、挪位置指纹不变（M-H14-g） */
export const fingerprint = (files: readonly (readonly [string, string])[]): string => {
  const h = createHash('sha256')
  // 内部排序:目录遍历的顺序不保证稳定,同一棵树算出两个指纹就成了假的「过期」
  for (const [p, body] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) h.update(`${p}\0${body}\0`)
  return h.digest('hex').slice(0, 12)
}

/**
 * 指纹的范围:`scripts/` 下所有 `.ts`,不只是 `test.ts` 自己。
 *
 * 只钉 `test.ts` 有个洞:静态 import 先于模块体求值,被 import 的实现改出语法错误时,
 * 测试在「开跑前清掉记录」那一行之前就崩了 —— `test.ts` 一个字没动,指纹照样对得上,
 * 上一次的记录成了这一次的证据。范围放到整棵树,改坏实现就等于改了指纹,
 * 那份记录当场判过期（M-H14-b 守范围,M-H14-h 守子目录）。
 */
export const sourceFiles = (dir: string = SOURCE_DIR): [string, string][] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(p)
    return p.endsWith('.ts') ? [[p, readFileSync(p, 'utf8')] as [string, string]] : []
  })

/**
 * 这份记录长得对吗 —— 缺字段、字段不是数组、数组里混进非字符串,一律**认不出**。
 *
 * 不给缺失的字段兜底成空数组:兜底看着温和,实际是把「记录坏了」说成
 * 「这些东西没测过」—— 审计会照着报一串需求没有测试,而人会去翻那些需求,
 * 不是去翻那份坏掉的记录。认不出就说认不出,让人重跑一次测试（ADR-47 的老规矩:
 * 认不出的一律 unknown,不替它编一个答案）。
 *
 * 元素类型也得看:只验到「是数组」为止的话,一份元素不是字符串的记录会通过形状这一关,
 * 然后在审计里被当成编号去比对 —— 该说「记录坏了、重跑测试」的地方变成一串对不上的编号。
 *
 * 抽出来是为了它能被测:判定留在入口里没有测试守得住（M-H14-f 守形状,M-H14-i 守元素）。
 */
export const claimsWellFormed = (v: unknown): v is Claims =>
  typeof v === 'object' && v !== null &&
  typeof (v as Claims).source_hash === 'string' &&
  Array.isArray((v as Claims).covered) &&
  (v as Claims).covered.every(x => typeof x === 'string')

/**
 * 这一次运行**拥有**那份记录吗 —— 拥有的一方开跑前先把它清掉,跑完再写。
 *
 * 「先清掉」挡的是另一半:源码一个字没改、这一跑却红了或者半路死了。那时指纹
 * 对得上（`sourceFiles` 挡的是改了源码的那一半),上一次成功的记录就成了这一次
 * 的证据。开跑前清掉,死了就没有记录,审计说「先跑 npm test」。
 *
 * 变异测试跑的是被改过的源码:它既不清也不写,那一份记录不归它（M-H14-e 守着）。
 *
 * **够不到的那一段**:清掉那一行在所有静态 import 求值**之后**才跑。import 阶段就崩了
 * —— 依赖装漏、`node_modules` 坏了、内存不够 —— 清不掉,上一次的记录原样留着,而这些
 * 毛病都不体现在源码指纹里,审计比对得上。要堵死,得让「清掉」跑在 import 之前,
 * 那是换一种进场方式,不在这一片里做。写在这儿是为了别把它当成已经保证了的事。
 */
export const claimsOwnedBy = (mutating: boolean): boolean => !mutating

/**
 * 这一次运行有资格写下覆盖记录吗 —— 拥有它、**断言全过**,而且**源码一路没被动过**（ADR-20）。
 *
 * 最后那一条挡的是「跑到一半源码变了」:指纹只在跑完之后算一次的话,记录带的是
 * 新那棵树的指纹,而断言执行的是旧的 —— 审计比对得上,于是一棵从没被完整测过的树
 * 拿到了证据。开跑前先算一次,跑完再算一次,两次对不上就不写,让人重跑一遍。
 *
 * 抽出来是为了它能被测:条件留在入口里,少掉 `fail === 0` 或者少掉两次指纹的比较,
 * 没有任何一条测试会红,而审计会把不作数的认领当成证据（M-H14-d、M-H14-k 守着）。
 */
export const claimsPublishable = (mutating: boolean, fail: number, startHash: string, endHash: string): boolean =>
  claimsOwnedBy(mutating) && fail === 0 && startHash === endHash

/** 记录读不出来时,到底是哪一种读不出来 */
export type ClaimsFault = 'missing' | 'unparsable' | 'unreadable'

/**
 * 读不出那份记录时,是**还没跑过**、**记录坏了**,还是**这个路径读不了**。
 *
 * 三种都当成一句「先跑 `npm test`」是在替毛病编一个答案:权限不对、路径底下变成了
 * 目录、磁盘满 —— 重跑一遍测试照样写不进同一个地方,那句话把人支到跟毛病无关的方向。
 * 这个仓库在反过来的那一头栽过同一个跟头(ADR-20 第二节:写不进去被说成文件坏了)。
 *
 * 抽出来是为了它能被测:分类留在入口里,塌成一种,没有任何一条测试会红（M-H14-j 守着）。
 */
export const claimsReadFault = (err: unknown): ClaimsFault => {
  if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return 'missing'
  if (err instanceof SyntaxError) return 'unparsable'
  return 'unreadable'
}
