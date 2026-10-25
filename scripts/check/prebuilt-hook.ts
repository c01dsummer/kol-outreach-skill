/**
 * 预编 JS 的模块钩子（ADR-158）：裸 node 经 `--import <本文件>?root=…&cache=…&id=…` 装上它，
 * `root` 那棵 `scripts/` 里的 `.ts` 一律换成缓存里预先编好的那一份来跑。
 *
 * **地址不换，只换内容。** 解析出来的仍是 `.ts` 的地址，加载时读这份 `.ts` 现在的正文、算出它的键，
 * 交给 Node 的是缓存里那个键对应的 JS。于是 `process.argv[1]`、`import.meta.url`、报错里的路径都与
 * tsx 跑时一样是 `.ts`；夹具按 `.ts` 地址 import 的产品模块与入口 import 的是同一份，不会一个模块拆成两份。
 * **键跟着正文走**：正文改一个字就是另一个键，缓存里没有就当场报错点名，不会拿一份旧的 JS 顶上。
 *
 * `./x.js` 这种写法（TS 的 ESM 规矩）在 `x.ts` 在时认 `x.ts`，与 tsx 一样；`root` 以外的一律不碰。
 *
 * 只 import `node:` 内建、只用 Node 能直接去掉的类型写法：裸 node 里没有任何转换，这个文件靠 Node
 * 自己去掉类型（与 `launch-preload.ts` 同一处境）。键怎么算只此一份，`prebuilt.ts` 写缓存时也从这里拿。
 */
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import * as nodeModule from 'node:module'
import type { LoadHookSync, ResolveHookSync } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * 一份 `.ts` 在缓存里的键：编译身份、文件名、正文三样的 sha256。不含目录 ——
 * 变异的 worker 副本与真树里同名同内容的文件共用一份。
 */
export const keyOf = (id: string, file: string, source: string): string =>
  createHash('sha256').update(id).update('\0').update(basename(file)).update('\0').update(source).digest('hex')

/** 缓存里装这个键的那个文件 */
export const entryPath = (cache: string, key: string): string => join(cache, `${key}.js`)

/** 无配置身份只在真实 cwd 的完整祖先链均缺席时有效；未知与存在都明确拒绝。 */
export function assertNoConfig(cwd: string): void {
  const invalid = (path: string, reason: unknown): Error => Object.assign(
    new Error(`CHECK_PREBUILT_CONFIG_INVALIDATED: cwd=${cwd}; ${path}: ${String(reason)}`),
    { code: 'CHECK_PREBUILT_CONFIG_INVALIDATED' },
  )
  let here: string
  try { here = realpathSync(cwd) } catch (error) { throw invalid(cwd, error) }
  for (let dir = here; ; dir = dirname(dir)) {
    const file = join(dir, 'tsconfig.json')
    let absent = false
    try { lstatSync(file) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw invalid(file, error)
      absent = true
    }
    if (!absent) throw invalid(file, 'configuration exists')
    if (dirname(dir) === dir) return
  }
}

/** 钩子读取路径与源码的接口；测试可用虚拟盘 */
export interface HookDisk { exists(path: string): boolean; read(path: string): string | undefined; realpath?(path: string): string }

/** 给定那棵树、缓存目录与编译身份的两个钩子 */
export function prebuiltHooks(at: { root: string; cache: string; id: string; noConfig?: boolean }, disk: HookDisk): { resolve: ResolveHookSync; load: LoadHookSync } {
  // 归属按真实位置判断；解析仍交 Node，按它的软链参数决定模块身份。
  const normalize = (url: string): string => disk.realpath === undefined ? url : pathToFileURL(disk.realpath(fileURLToPath(url))).href
  const prefix = normalize(pathToFileURL(at.root).href) + '/'
  const inside = (url: string | undefined): url is string => url !== undefined && url.startsWith('file:') && normalize(url).startsWith(prefix)
  return {
    resolve(specifier, context, next) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js') && inside(context.parentURL)) {
        const ts = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL)
        if (inside(ts.href) && disk.exists(fileURLToPath(ts))) return next(ts.href, context)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (!inside(url) || !new URL(url).pathname.endsWith('.ts')) return next(url, context)
      if (at.noConfig) assertNoConfig(process.cwd())
      const file = fileURLToPath(url)
      const source = disk.read(file)
      if (source === undefined) throw new Error(`预编钩子读不到 ${file}`)
      const key = keyOf(at.id, file, source)
      const code = disk.read(entryPath(at.cache, key))
      if (code === undefined) throw new Error(`预编缓存里没有 ${file} 现在这一版（键 ${key}）：起进程之后它改过，或者缓存被删了`)
      return { format: 'module', source: code, shortCircuit: true }
    },
  }
}

const disk: HookDisk = {
  exists: existsSync,
  realpath: path => { try { return realpathSync(path) } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return path; throw e } },
  read: path => { try { return readFileSync(path, 'utf8') } catch { return undefined } },
}

// 作为 `--import` 装进来时地址上带着三样；被当成普通模块 import 时（`prebuilt.ts`、需求测试）不带，只交出上面那几样
const given = new URL(import.meta.url).searchParams
const root = given.get('root'), cache = given.get('cache'), id = given.get('id')
if (root !== null && cache !== null && id !== null) nodeModule.registerHooks(prebuiltHooks({ root, cache, id, noConfig: given.get('noConfig') === '1' }, disk))
