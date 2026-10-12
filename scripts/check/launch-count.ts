/**
 * 变异入口启动数的「数」那一侧（ADR-145 第十三节）：给正常基线那一跑造计数用的环境，读回预加载写的日志。
 * 纯函数，不起进程、不读文件；预加载本身是 `launch-preload.ts`（第二片的下一条 PR），判有没有过线在 `launch-rule.ts`。
 *
 * **git 不算在这里定**，不在预加载里：预加载每次调用都照记，这里按 `api`、`shell` 与可执行文件的末段认出 git。
 * 这样「哪一次算」有断言够得着，预加载只剩照实记这一件事。
 *
 * **认不得就是 undefined，不是 0**：日志缺一行、多一行、没写完，计数都不能拿来判 —— 记成 0 等于放行。
 */
import type { BaselineLaunches, LaunchPrint } from './launch-rule.js'

/** 预加载认的那个环境变量。预加载只能 import `node:` 内建，不能从这里取，得另写一份同样的字面量 */
export const LAUNCH_COUNT_ENV = 'LAUNCH_COUNT'
/** 预加载包住的七个函数，也是日志里 `api` 认得的全部名字（promisify 版记成原名） */
export const LAUNCH_APIS = ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork'] as const

/** 正常基线那一跑的环境：原样的 env，`NODE_OPTIONS` 后面加上预加载，原来的 `NODE_OPTIONS` 交给预加载去还原 */
export function countingEnv(env: Readonly<Record<string, string | undefined>>,
  count: { readonly log: string; readonly target: string; readonly preload: string }): Record<string, string | undefined> {
  const before = env.NODE_OPTIONS
  const load = `--import ${JSON.stringify(count.preload)}`
  return {
    ...env,
    NODE_OPTIONS: before === undefined || before === '' ? load : `${before} ${load}`,
    [LAUNCH_COUNT_ENV]: JSON.stringify(before === undefined
      ? { log: count.log, target: count.target } : { log: count.log, target: count.target, options: before }),
  }
}

// 直接起的是不是 git：exec、execSync 与带 shell 的，起的是 shell（第一节「sh -c 都算」）
const DIRECT = new Set<string>(['spawn', 'spawnSync', 'execFile', 'execFileSync'])
const isGit = (api: string, file: string, shell: boolean): boolean => {
  const last = file.split(/[/\\]/).pop()
  return DIRECT.has(api) && !shell && (last === 'git' || last === 'git.exe')
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** 预加载的日志 → 一种配置一次正常基线的计数；认不得就是 undefined（规矩逐条在 ADR-145 第十三节第 3 小节） */
export function parseLaunchLog(text: string): BaselineLaunches | undefined {
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  let launches = 0
  let counted = 0
  const prints: LaunchPrint[] = []
  for (const [i, raw] of lines.entries()) {
    let e: unknown
    try { e = JSON.parse(raw) } catch { return undefined }
    if (!object(e)) return undefined
    if (e.t === 'E') {
      // E 只能是最后一行，它的两个数要与上面的行对得上：预加载写丢一行，这里就对不上
      return i === lines.length - 1 && e.launches === launches && e.prints === prints.length
        ? { total: counted, prints } : undefined
    }
    if (e.t === 'L') {
      if (!LAUNCH_APIS.includes(e.api as never) || typeof e.file !== 'string') return undefined
      if (e.shell !== undefined && e.shell !== true) return undefined
      launches++
      if (!isGit(e.api as string, e.file, e.shell === true)) counted++
    } else if (e.t === 'O') {
      if (typeof e.line !== 'string') return undefined
      const line = e.line.trimStart()
      if (!line.startsWith('✓ ') && !line.startsWith('✗ ')) return undefined
      prints.push({ body: line.slice(2), launched: counted })
    } else return undefined
  }
  return undefined
}

/** 同一种配置的两次计数有没有出入：一样是 undefined，不一样交回第一处出入的说法（给报错用） */
export function launchDrift(a: BaselineLaunches, b: BaselineLaunches): string | undefined {
  if (a.total !== b.total) return `整跑 ${a.total} 次对 ${b.total} 次`
  if (a.prints.length !== b.prints.length) return `打印 ${a.prints.length} 行对 ${b.prints.length} 行`
  for (const [i, p] of a.prints.entries()) {
    const q = b.prints[i]
    if (p.body !== q.body) return `第 ${i + 1} 行打印的不同：「${p.body}」对「${q.body}」`
    if (p.launched !== q.launched) return `第 ${i + 1} 行「${p.body}」打印时 ${p.launched} 次对 ${q.launched} 次`
  }
  return undefined
}
