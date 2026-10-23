/**
 * 起一个跑 `.ts` 的验证者或入口时，用裸 node 跑预编的 JS 还是照旧交给 tsx（ADR-158）—— 判定与缓存的读写。
 *
 * tsx 每起一个进程都要先起它的壳、再在里面装转换（本机一次约 0.35 秒 CPU，裸 node 约 0.05 秒），
 * 检查链起几千次。这里把 `scripts/` 下的 `.ts` 预先用 esbuild 编好，**按正文存**进仓库根的
 * `.check-cache/prebuilt/`（键见 `prebuilt-hook.ts` 的 `keyOf`），起进程时装上那个钩子跑缓存里的那份。
 *
 * **不在 `.ts` 旁边放 `.js`。** 放在旁边的话，复制 `scripts/` 的玩具树会连旧的 `.js` 一起带走，
 * 而 Node 自己就能跑 `.ts`：哪天有一条起法绕过了这里，`./x.js` 就会认到那份旧的（ADR-158 第三节）。
 * 缓存按正文寻址，改过的文件自然是另一个键：没有「过期」这回事，变异也不必还原什么。
 *
 * **缺就照旧 tsx，不靠「记得重编」。** 整棵树每个 `.ts` 在缓存里都有现在这一版，才走裸 node；
 * 缺一份（改了没重编、变异编不出来）就交给 tsx，跑得慢、跑的东西不变。起进程之后才改的，
 * 钩子在加载时按正文找不到，当场报错 —— 不会拿旧的顶上。
 *
 * **谁的缓存。** 从那棵 `scripts/` 往上找第一个带 `.check-cache/prebuilt/` 的目录：仓库根自己，
 * 或者变异 worker 的副本（它在仓库根的 `.check-cache/mutate-jobs/` 底下）往上找到仓库根。
 * 玩具树在临时目录里，找不到，照旧 tsx —— 与原型量数时同一个范围（ADR-158 第一节）。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { constants } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import type * as Esbuild from 'esbuild'
import { entryPath, keyOf } from './prebuilt-hook.js'
import { tsxCommand } from './tsx-cmd.js'

/** 仓库根底下放预编 JS 的目录 */
export const PREBUILT_DIR = '.check-cache/prebuilt'

/** 编译做法的版本：下面 `compileTs` 的选项一改就换它，旧缓存跟着全部作废 */
export const FORMAT = 'kol-prebuilt/v1'

/** 编译身份：做法版本、esbuild 版本、目标 node 版本、tsconfig 的 compilerOptions。任一样变了，编出来的东西就可能不同 */
export const identityOf = (parts: { esbuild: string; node: string; compilerOptions: unknown }): string =>
  createHash('sha256').update(JSON.stringify([FORMAT, parts.esbuild, parts.node, parts.compilerOptions])).digest('hex').slice(0, 16)

/** 一个脚本所在的那棵 `scripts/`：从它的目录往上找最近一层叫 scripts 的 */
export function scriptsRootOf(script: string): string | undefined {
  for (let dir = dirname(resolve(script)); ; dir = dirname(dir)) {
    if (basename(dir) === 'scripts') return dir
    if (dirname(dir) === dir) return undefined
  }
}

/** 这棵树用哪一份缓存：从树的上一层往上，第一个带 `.check-cache/prebuilt/` 的目录 */
export function ownerOf(root: string, exists: (path: string) => boolean): string | undefined {
  for (let dir = dirname(root); ; dir = dirname(dir)) {
    if (exists(join(dir, PREBUILT_DIR))) return dir
    if (dirname(dir) === dir) return undefined
  }
}

/** 每个 `.ts` 在缓存里都有现在这一版 */
export const complete = (files: readonly string[], entryOf: (file: string) => string, has: (entry: string) => boolean): boolean =>
  files.every(f => has(entryOf(f)))

/** NODE_OPTIONS 里自己带着 tsx 的加载器：夹具要在入口之前装一份按 `.ts` 地址 import 产品模块的观察器，留给第二片 */
export const bringsTsxLoader = (nodeOptions: string | undefined): boolean => /[\\/]node_modules[\\/]tsx[\\/]/.test(nodeOptions ?? '')

/**
 * 这一次走不走裸 node。`strips` 是这个 node 自己能不能去掉类型：钩子是 `.ts`，靠的就是它（22.18 起默认开着；
 * 更早的 node 上装钩子当场就起不来，照旧 tsx）。`complete` 最后才问：前面几样不成立就不必走一遍树
 */
export const bareLaunch = (at: { disabled: boolean; strips: boolean; script: string | undefined; nodeOptions: string | undefined;
  root: string | undefined; owner: string | undefined; complete: () => boolean }): boolean =>
  !at.disabled && at.strips && at.script !== undefined && at.script.endsWith('.ts') && !bringsTsxLoader(at.nodeOptions)
    && at.root !== undefined && at.owner !== undefined && at.complete()

/** 钩子的地址（不带参数的那一截）：`isBare` 认参数表靠它 */
const HOOK = new URL('./prebuilt-hook.ts', import.meta.url)

/** 这张参数表是不是 `prebuiltCommand` 交出来的裸 node 起法 */
export const isBare = (argv: readonly string[]): boolean => argv[0] === '--import' && (argv[1]?.startsWith(`${HOOK.href}?`) ?? false)

/**
 * 按 tsx 起时会看到的样子交回退出码与信号：tsx 的壳把里面那个进程的信号死亡报成退出码 128+N、信号为空，
 * 裸 node 没有壳，这里照它换算；tsx 起的原样交回。读退出码的一侧于是不必分两种起法（夹具「被杀」那几条认的是 137）
 */
export const asTsx = (argv: readonly string[], status: number | null, signal: NodeJS.Signals | null): { status: number | null; signal: NodeJS.Signals | null } =>
  isBare(argv) && status === null && signal !== null ? { status: 128 + constants.signals[signal], signal: null } : { status, signal }

const require = createRequire(import.meta.url)
let esbuild: typeof Esbuild | undefined

/** 一棵树（按它的缓存主人）的 tsconfig compilerOptions 与编译身份。读不到 tsconfig 就当没有选项：编译与身份用的是同一份 */
const owners = new Map<string, { compilerOptions: Record<string, unknown>; id: string }>()
const settingsOf = (owner: string) => {
  const had = owners.get(owner)
  if (had !== undefined) return had
  let compilerOptions: Record<string, unknown> = {}
  try { compilerOptions = JSON.parse(readFileSync(join(owner, 'tsconfig.json'), 'utf8')).compilerOptions ?? {} } catch { /* 用 esbuild 缺省 */ }
  const version = (require('esbuild/package.json') as { version: string }).version
  const made = { compilerOptions, id: identityOf({ esbuild: version, node: process.versions.node, compilerOptions }) }
  owners.set(owner, made)
  return made
}

/** 编一个文件，选项照 tsx 给 esbuild 的那几项（esm、目标是当前 node、keepNames、minifyWhitespace）。编不出来就抛 */
export function compileTs(source: string, file: string, compilerOptions: Record<string, unknown>): string {
  esbuild ??= require('esbuild') as typeof Esbuild
  return esbuild.transformSync(source, {
    loader: 'ts', format: 'esm', target: `node${process.versions.node}`, keepNames: true, minifyWhitespace: true,
    sourcefile: basename(file), tsconfigRaw: { compilerOptions },
  }).code
}

/** 先写到旁边再改名：别的进程同时读这个键，读到的要么没有、要么是整份 */
const writeEntry = (path: string, code: string): void => {
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, code)
  renameSync(temp, path)
}

const tsFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = join(dir, e.name)
  return e.isDirectory() ? tsFiles(p) : e.name.endsWith('.ts') ? [p] : []
})

/** 一个文件现在这一版的键；没改过（修改时间与大小都没变）就不重读正文 */
const seen = new Map<string, { mtimeMs: number; size: number; key: string }>()
const keyNow = (file: string, id: string): string => {
  const st = statSync(file)
  const had = seen.get(file)
  if (had !== undefined && had.mtimeMs === st.mtimeMs && had.size === st.size) return had.key
  const key = keyOf(id, file, readFileSync(file, 'utf8'))
  seen.set(file, { mtimeMs: st.mtimeMs, size: st.size, key })
  return key
}

/** 预编整棵树（`compile.ts` 调）：缺的编上，不属于这棵树现在这一版的删掉 */
export function prebuildTree(owner: string): { wrote: number; kept: number; removed: number } {
  const cache = join(owner, PREBUILT_DIR)
  mkdirSync(cache, { recursive: true })
  const { compilerOptions, id } = settingsOf(owner)
  const want = new Set<string>()
  let wrote = 0, kept = 0, removed = 0
  for (const file of tsFiles(join(owner, 'scripts'))) {
    const source = readFileSync(file, 'utf8')
    const path = entryPath(cache, keyOf(id, file, source))
    want.add(basename(path))
    if (existsSync(path)) { kept++; continue }
    writeEntry(path, compileTs(source, file, compilerOptions))
    wrote++
  }
  for (const name of readdirSync(cache)) if (!want.has(name)) { rmSync(join(cache, name), { force: true }); removed++ }
  return { wrote, kept, removed }
}

/**
 * 变异落盘后把被改的那一个文件编进缓存（`mutate.ts` 调）。编不出来、写不进去、或者这棵树没有缓存，就什么也不写 ——
 * 这一条于是退回 tsx，照旧在那里报它的错。用完不删：别的 worker 可能正跑着同一份，下一次预编整棵树时清掉
 */
export function prebuildOne(file: string, source: string): void {
  const root = scriptsRootOf(file)
  const owner = root === undefined ? undefined : ownerOf(root, existsSync)
  if (owner === undefined) return
  const { compilerOptions, id } = settingsOf(owner)
  const path = entryPath(join(owner, PREBUILT_DIR), keyOf(id, resolve(file), source))
  try { writeEntry(path, compileTs(source, file, compilerOptions)) } catch { rmSync(`${path}.${process.pid}.tmp`, { force: true }) }
}

/** 钩子的地址，带上那棵树、缓存目录与编译身份 */
const hookFor = (root: string, owner: string, id: string): string => {
  const url = new URL(HOOK)
  url.searchParams.set('root', root)
  url.searchParams.set('cache', join(owner, PREBUILT_DIR))
  url.searchParams.set('id', id)
  return url.href
}

/**
 * 和 `tsxCommand` 同一个形状：走得了裸 node 就 `node --import <钩子> <原参数>`（命令行上照旧写 `.ts`），
 * 否则原样交给 tsx。`cwd` 是子进程的工作目录（相对路径按它找），`env` 是子进程拿到的环境。
 */
export function prebuiltCommand(args: string[], cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): [string, string[]] {
  const script = args[0] === undefined ? undefined : resolve(cwd, args[0])
  const root = script === undefined ? undefined : scriptsRootOf(script)
  const owner = root === undefined ? undefined : ownerOf(root, existsSync)
  const bare = bareLaunch({ disabled: env.KOL_PREBUILT === '0', strips: Boolean(process.features.typescript), script,
    nodeOptions: env.NODE_OPTIONS, root, owner,
    complete: () => {
      const { id } = settingsOf(owner!)
      const cache = join(owner!, PREBUILT_DIR)
      return complete(tsFiles(root!), f => entryPath(cache, keyNow(f, id)), existsSync)
    } })
  return bare ? [process.execPath, ['--import', hookFor(root!, owner!, settingsOf(owner!).id), ...args]] : tsxCommand(args)
}
