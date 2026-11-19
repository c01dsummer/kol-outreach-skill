/**
 * git 夹具模块（ADR-222）：测试在临时目录里建玩具仓库、造提交，经这里起 git。只许「测试文件」用（登记表那一节，ADR-217 的闸门按名字认）。
 *
 * 和 git 入口（`git-entry.ts`）分开：入口只答读本仓库的那几问；夹具要写（init、add、commit……），写的是临时目录里的玩具仓库。
 * 故意不带 git 入口钉死的那组配置：夹具有时要造出与入口相反的配置，去验被测的入口自己带没带。
 *
 * 每次起 git 前查三样，不对就当场抛错、不起 git（防的是误伤，不是存心绕，绕得开的写在 ADR-222 第四节）：
 * 1. 在哪起：`cwd` 必填，真实路径要在系统临时目录（`os.tmpdir()` 的真实路径）底下，且不在本仓库里（本仓库根由本文件的位置算出）。
 * 2. 起什么：子命令在 `SUBCOMMANDS` 里；子命令前只许 `-c 键=值`，键在 `CONFIG_KEYS` 里。`init` 不带目录参数（建在 `cwd`；`-b` 后面的分支名不算，
 *    分开写的 `--initial-branch 名字` 会被当成目录拒掉，写成 `-b` 或带等号）。`config`、`init` 不带 `ELSEWHERE_SWITCHES` 里那几个指别处的开关。
 * 3. 带什么环境：从本进程的环境起，先去掉全部 `GIT_` 开头的；调用方的 `env` 只许给 `ENV_KEYS` 里那几样（提交身份与日期、往上找仓库的天花板），
 *    值为 `undefined` 的当没给。再设 `GIT_CONFIG_NOSYSTEM=1`、`GIT_CONFIG_SYSTEM`、`GIT_CONFIG_GLOBAL` 指向 `/dev/null`（不读本机的系统、用户配置文件；
 *    用户级的忽略、属性文件是另一路，仍会读），
 *    `GIT_CEILING_DIRECTORIES` 加上系统临时目录（往上找仓库找不出临时目录），与调用方给的用 `:` 拼。
 *
 * 起 git 用的函数在调用时从模块上取：自检记当前目录、计数预加载换掉模块上的函数后照样记得到、数得到。
 */
import cp from 'node:child_process'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 夹具能用的子命令。新加一个由评审看：它是不是只在玩具仓库里用得着 */
export const SUBCOMMANDS: readonly string[] = ['add', 'checkout', 'commit', 'config', 'init', 'rev-parse', 'switch', 'update-ref']
/** 子命令前 `-c 键=值` 能给的键 */
export const CONFIG_KEYS: readonly string[] = ['commit.gpgsign', 'core.quotePath', 'user.email', 'user.name']
/** 调用方能经 `env` 给的环境变量 */
export const ENV_KEYS: readonly string[] = [
  'GIT_AUTHOR_DATE', 'GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_NAME', 'GIT_CEILING_DIRECTORIES',
  'GIT_COMMITTER_DATE', 'GIT_COMMITTER_EMAIL', 'GIT_COMMITTER_NAME',
]

/** 子命令后不许带的开关：它们让 git 写到玩具仓库以外。`--x` 也拦 `--x=值` 写法 */
export const ELSEWHERE_SWITCHES: Readonly<Record<string, readonly string[]>> = {
  config: ['--global', '--system', '--worktree', '--file', '-f'],
  init: ['--separate-git-dir', '--template'],
}

/** 本仓库根：本文件在 `scripts/check/` 下 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export interface FixtureOptions {
  /** 玩具仓库所在目录，必填 */
  cwd: string
  /** 只许 `ENV_KEYS` 里那几样 */
  env?: Record<string, string | undefined>
  /** 写进 git 标准输入的内容；不给就不接标准输入 */
  input?: string
}

/** git 真跑一遍的结果：退出码、标准输出（utf8）、标准错误、起不来时的错误 */
export interface FixtureAnswer { status: number | null; stdout: string; stderr: string; error?: Error }

const real = (p: string): string => { try { return realpathSync(p) } catch { return resolve(p) } }
const inside = (child: string, parent: string): boolean => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep)

/** 这一次起 git 合不合规矩；不合就抛错，说出原样的参数与目录。交回整份环境 */
export function fixtureCheck(args: readonly string[], options: FixtureOptions): NodeJS.ProcessEnv {
  if (!Array.isArray(args) || args.some(a => typeof a !== 'string')) throw new Error('git 夹具的参数要是一组字符串（ADR-222）')
  if (typeof options?.cwd !== 'string' || options.cwd === '') throw new Error('git 夹具要给 cwd：玩具仓库在哪（ADR-222）')
  const at = real(options.cwd), tmp = real(tmpdir()), repo = real(REPO_ROOT)
  if (!inside(at, tmp) || at === tmp) throw new Error(`git 夹具只在系统临时目录（${tmp}）底下起，${at} 不在（ADR-222）`)
  if (inside(at, repo) || inside(repo, at)) throw new Error(`git 夹具不在本仓库（${repo}）里起，也不在它的上级目录起：${at}（ADR-222）`)
  let i = 0
  while (args[i] === '-c') {
    const pair = args[i + 1] ?? '', key = pair.slice(0, pair.indexOf('='))
    if (!pair.includes('=') || !CONFIG_KEYS.includes(key)) throw new Error(`git 夹具不认这一项配置：-c ${pair}。能给的键：${CONFIG_KEYS.join('、')}（ADR-222）`)
    i += 2
  }
  const sub = args[i]
  if (sub === undefined || !SUBCOMMANDS.includes(sub)) throw new Error(`git 夹具不认这个子命令：git ${JSON.stringify(args)}。能用的：${SUBCOMMANDS.join('、')}（ADR-222）`)
  // `-b` 后面那一个是分支名，不是目录
  if (sub === 'init' && args.slice(i + 1).some((a, j, rest) => !a.startsWith('-') && rest[j - 1] !== '-b')) throw new Error(`git 夹具的 init 不带目录参数，建在 cwd：git ${JSON.stringify(args)}（ADR-222）`)
  // 指别处的开关：写到玩具仓库以外的文件或目录（root 下写 `--global` 会把 `/dev/null` 换成普通文件）
  const elsewhere = ELSEWHERE_SWITCHES[sub]
  const hit = elsewhere === undefined ? undefined : args.slice(i + 1).find(a => elsewhere.some(s => a === s || (s.startsWith('--') && a.startsWith(`${s}=`))))
  if (hit !== undefined) throw new Error(`git 夹具的 ${sub} 不带指别处的开关 ${hit}：只写玩具仓库自己（ADR-222）`)
  const env: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_')) env[k] = v
  const given = options.env ?? {}
  for (const [k, v] of Object.entries(given)) {
    if (v === undefined) continue
    if (!ENV_KEYS.includes(k)) throw new Error(`git 夹具不认这个环境变量：${k}。能给的：${ENV_KEYS.join('、')}（ADR-222）`)
    env[k] = v
  }
  env.GIT_CONFIG_NOSYSTEM = '1'
  env.GIT_CONFIG_SYSTEM = '/dev/null'
  env.GIT_CONFIG_GLOBAL = '/dev/null'
  env.GIT_CEILING_DIRECTORIES = [given.GIT_CEILING_DIRECTORIES, tmp].filter(s => s !== undefined && s !== '').join(':')
  return env
}

/** 起一次 git，原样交回它怎么答的。不合规矩就抛错、不起 git */
export function fixtureGit(args: readonly string[], options: FixtureOptions): FixtureAnswer {
  const env = fixtureCheck(args, options)
  const { cwd, input } = options
  const r = cp.spawnSync('git', [...args], { cwd, env, input, encoding: 'utf8', maxBuffer: 1 << 30,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error }
}

/** 起一次 git：以 0 退出交回去掉首尾空白的标准输出，起不来或非 0 退出就抛错，错里带 git 的原话 */
export function fixtureGitOrThrow(args: readonly string[], options: FixtureOptions): string {
  const r = fixtureGit(args, options)
  if (r.error === undefined && r.status === 0) return r.stdout.trim()
  throw new Error(`（夹具）git ${args.join(' ')} 没成（${r.error?.message ?? `退出码 ${r.status}`}）${r.stderr.trim() === '' ? '' : `：${r.stderr.trim()}`}`)
}
