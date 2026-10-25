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
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import * as nodeModule from 'node:module'
import type { LoadHookSync, ResolveHookSync } from 'node:module'
import { basename, dirname, join, relative, resolve } from 'node:path'
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

/** 受控观察器仅绑定所选正文及必要缓存；不复制或解析任意预加载依赖图。 */
export function observerSnapshot(root: string, cache: string, id: string): { identity: string; complete: boolean; keys: Map<string, string> } {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const file = join(dir, item.name)
    return item.isDirectory() ? walk(file) : item.name.endsWith('.ts') ? [file] : []
  })
  const keys = new Map(walk(root).sort().map(file => [realpathSync(file), keyOf(id, file, readFileSync(file, 'utf8'))]))
  const identity = createHash('sha256').update(JSON.stringify([...keys].map(([file, key]) => [relative(realpathSync(root), file), key]))).digest('hex')
  return { identity, complete: [...keys.values()].every(key => existsSync(entryPath(cache, key))), keys }
}

/** 启动模块与实际 Node/esbuild 身份；普通无观察器路径不执行此读取。 */
export function observerLaunchIdentity(): string {
  const hash = createHash('sha256').update(process.versions.node)
  for (const name of ['prebuilt.ts', 'prebuilt-hook.ts', 'prebuilt-parent.ts', 'prebuilt-signals.ts']) {
    hash.update(name).update('\0').update(readFileSync(new URL(name, import.meta.url)))
  }
  const require = nodeModule.createRequire(import.meta.url)
  return hash.update(readFileSync(require.resolve('esbuild/package.json'))).digest('hex')
}

/** owner 配置的存在与正文也属于这一次受控选择，不把 N 的 {} 借给新配置。 */
export function observerOwnerIdentity(cache: string): string {
  let source: string | null
  try { source = readFileSync(join(dirname(dirname(cache)), 'tsconfig.json'), 'utf8') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; source = null }
  return createHash('sha256').update(JSON.stringify(source)).digest('hex')
}

const observerInvalid = (reason: unknown): Error => Object.assign(
  new Error(`CHECK_PREBUILT_OBSERVER_INVALIDATED: ${String(reason)}`), { code: 'CHECK_PREBUILT_OBSERVER_INVALIDATED' },
)
interface ObservedSource { file: string; hash: string; keys: ReadonlyMap<string, string> }

/** 给定那棵树、缓存目录与编译身份的两个钩子 */
export function prebuiltHooks(at: { root: string; cache: string; id: string; noConfig?: boolean; observed?: ObservedSource }, disk: HookDisk): { resolve: ResolveHookSync; load: LoadHookSync } {
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
      if (at.observed && url.startsWith('file:') && normalize(url) === pathToFileURL(at.observed.file).href) {
        const source = disk.read(fileURLToPath(url))
        if (source === undefined || createHash('sha256').update(source).digest('hex') !== at.observed.hash) throw observerInvalid('observer bytes changed')
        return { format: 'module', source, shortCircuit: true }
      }
      if (!inside(url) || !new URL(url).pathname.endsWith('.ts')) return next(url, context)
      if (at.noConfig) assertNoConfig(process.cwd())
      const file = fileURLToPath(url)
      const source = disk.read(file)
      if (source === undefined) throw new Error(`预编钩子读不到 ${file}`)
      const key = keyOf(at.id, file, source)
      if (at.observed && at.observed.keys.get(disk.realpath?.(file) ?? file) !== key) throw observerInvalid(`selected source changed: ${file}`)
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
let observed: ObservedSource | undefined
if (root !== null && cache !== null && id !== null && given.has('observed')) {
  try {
    assertNoConfig(process.cwd())
    const value: unknown = JSON.parse(given.get('observed')!)
    const fields = ['file', 'hash', 'launch', 'owner', 'script', 'tree']
    if (typeof value !== 'object' || value === null || Array.isArray(value)
      || Object.keys(value).sort().join() !== fields.join()
      || !fields.every(field => typeof (value as Record<string, unknown>)[field] === 'string')) throw observerInvalid('invalid binding')
    const selected = value as Record<typeof fields[number], string>
    const fetch = pathToFileURL(join(root, 'check/fake-fetch.ts')).href
    const options = `--enable-source-maps --import ${JSON.stringify(import.meta.url)} --import ${JSON.stringify(fetch)} --import ${JSON.stringify(pathToFileURL(selected.file).href)}`
    const main = process.argv[1] === undefined ? '' : resolve(process.argv[1])
    if (given.get('noConfig') !== '1' || process.env.KOL_PREBUILT === '0' || process.env.TSX_TSCONFIG_PATH !== undefined
      || process.env.NODE_OPTIONS !== options
      || (main !== selected.script && main !== fileURLToPath(new URL('prebuilt-parent.ts', import.meta.url)))) throw observerInvalid('launch or environment changed')
    if (observerLaunchIdentity() !== selected.launch || observerOwnerIdentity(cache) !== selected.owner) throw observerInvalid('launch modules or profile changed')
    const snapshot = observerSnapshot(root, cache, id)
    if (!snapshot.complete || snapshot.identity !== selected.tree) throw observerInvalid('selected source or cache changed')
    if (createHash('sha256').update(readFileSync(selected.file)).digest('hex') !== selected.hash) throw observerInvalid('observer bytes changed')
    observed = { file: realpathSync(selected.file), hash: selected.hash, keys: snapshot.keys }
  } catch (error) {
    if (['CHECK_PREBUILT_CONFIG_INVALIDATED', 'CHECK_PREBUILT_OBSERVER_INVALIDATED'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
    throw observerInvalid(error)
  }
}
if (root !== null && cache !== null && id !== null) nodeModule.registerHooks(prebuiltHooks({ root, cache, id, noConfig: given.get('noConfig') === '1', observed }, disk))
