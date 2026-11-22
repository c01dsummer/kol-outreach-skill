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
 *    值为 `undefined` 的当没给。再设 `GIT_CONFIG_NOSYSTEM=1`、`GIT_CONFIG_SYSTEM`、`GIT_CONFIG_GLOBAL` 指向 `/dev/null`（不读本机的系统、用户配置文件；后两个变量 git 2.32 起才认，更老的仍读用户配置）。
 *    用户级的忽略、属性文件是另一路（不走配置文件，从 `XDG_CONFIG_HOME`、没设时从 `HOME/.config` 底下的 `git/ignore`、`git/attributes` 读），
 *    所以 `XDG_CONFIG_HOME` 指到 `NO_USER_CONFIG`：一个不可能存在的路径（`/dev/null` 不是目录），git 读不到也不报错（ADR-235 第五节），
 *    `GIT_CEILING_DIRECTORIES` 加上系统临时目录（往上找仓库找不出临时目录），与调用方给的用 `:` 拼。
 *
 * 起 git 用的函数在调用时从模块上取：自检记当前目录、计数预加载换掉模块上的函数后照样记得到、数得到。
 */
import cp from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitOrThrow, gitText } from './git-entry.js'

/** 夹具能用的子命令。新加一个由评审看：它是不是只在玩具仓库里用得着 */
export const SUBCOMMANDS: readonly string[] = ['add', 'checkout', 'commit', 'config', 'init', 'merge', 'rev-parse', 'switch', 'update-ref']
/** 子命令前 `-c 键=值` 能给的键 */
export const CONFIG_KEYS: readonly string[] = ['commit.gpgsign', 'core.quotePath', 'user.email', 'user.name']
/** 调用方能经 `env` 给的环境变量 */
export const ENV_KEYS: readonly string[] = [
  'GIT_AUTHOR_DATE', 'GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_NAME', 'GIT_CEILING_DIRECTORIES',
  'GIT_COMMITTER_DATE', 'GIT_COMMITTER_EMAIL', 'GIT_COMMITTER_NAME',
]

/** 子命令后不许带的开关：它们让 git 写到玩具仓库以外。长开关也拦缩写与 `--x=值` 写法，短开关也拦粘着值的写法 */
export const ELSEWHERE_SWITCHES: Readonly<Record<string, readonly string[]>> = {
  config: ['--global', '--system', '--worktree', '--file', '-f'],
  init: ['--separate-git-dir', '--template'],
}

/** 夹具起 git 时 `XDG_CONFIG_HOME` 指的地方：不可能存在（`/dev/null` 不是目录），用户级的忽略、属性文件读不到（上面第 3 条） */
export const NO_USER_CONFIG = '/dev/null/no-user-git-config'

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

/** 真实路径；路径还不存在时解最近一层存在的上级、再接上没有的那几段（临时目录本身是软链的系统上也比得对） */
const real = (p: string): string => {
  const missing: string[] = []
  let at = resolve(p)
  for (;;) {
    try { return join(realpathSync(at), ...missing) } catch {
      const up = dirname(at)
      if (up === at) return resolve(p)
      missing.unshift(basename(at)); at = up
    }
  }
}
/** 参数 a 是不是在说开关 s：长开关认 git 认的缩写（`--glo`）与带等号的写法，短开关认粘着值的写法（`-f路径`） */
const says = (a: string, s: string): boolean => {
  if (!s.startsWith('--')) return a.startsWith(s) && !a.startsWith('--')
  const name = a.split('=')[0]
  return a.startsWith('--') && name.length > 2 && s.startsWith(name)
}
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
  const hit = elsewhere === undefined ? undefined : args.slice(i + 1).find(a => elsewhere.some(s => says(a, s)))
  if (hit !== undefined) throw new Error(`git 夹具的 ${sub} 不带指别处的开关 ${hit}：只写玩具仓库自己（ADR-222）`)
  return fixtureEnv(options.env ?? {})
}

/**
 * 夹具起 git 用的整份环境（上面第 3 条），只造环境、不查参数与目录。夹具以外还要在玩具仓库里问 git 的测试
 * （比如经 git 入口问的那几处）也从这里拿，不自己拼：自己拼是「列出要挡哪些」，漏一个就挡不住（ADR-233 第七节）
 */
export function fixtureEnv(given: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const tmp = real(tmpdir())
  const env: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_')) env[k] = v
  for (const [k, v] of Object.entries(given)) {
    if (v === undefined) continue
    if (!ENV_KEYS.includes(k)) throw new Error(`git 夹具不认这个环境变量：${k}。能给的：${ENV_KEYS.join('、')}（ADR-222）`)
    env[k] = v
  }
  env.GIT_CONFIG_NOSYSTEM = '1'
  env.GIT_CONFIG_SYSTEM = '/dev/null'
  env.GIT_CONFIG_GLOBAL = '/dev/null'
  env.XDG_CONFIG_HOME = NO_USER_CONFIG
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

/** 玩具仓库里提交用的身份与开关：本机用户配置挡掉了（上面第 3 条），不给就提交不了 */
const TOY_IDENTITY: readonly string[] = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false']

/**
 * 一个玩具仓库（ADR-235「同一处连着两轮：改设计」）。测试各自手搭玩具仓库时，隔开本机设置、读不到就报错、
 * 用完删掉这几样一次漏一样，评审一轮挑一样；收在这里，用它的测试就不用再各管一遍。
 */
export interface ToyRepo {
  /** 玩具仓库的目录 */
  readonly dir: string
  /** 写（init、add、commit……）：经夹具起 git，带提交身份，没成就抛错；交回去掉首尾空白的输出 */
  git(...args: string[]): string
  /** 读，答不上来交回 `null`：给 resolveBaseline 这类把「答不上来」当一种答案的判定用；去掉首尾空白 */
  ask(...args: string[]): string | null
  /** 读，答不上来就抛错、带 git 的原话，不当成空：量行数、读提交信息这类「没答上来」不能当「没有」的用；原样交回 */
  read(...args: string[]): string
  /** 写一个文件，路径相对玩具仓库，上级目录不在就建 */
  write(path: string, text: string): void
}

/** 在 `dir` 上的玩具仓库：读写都用夹具的环境（`fixtureEnv`），读走 git 入口的问法 */
function toyAt(dir: string): ToyRepo {
  const env = fixtureEnv({})
  return {
    dir: dir,
    git: (...args) => fixtureGitOrThrow([...TOY_IDENTITY, ...args], { cwd: dir }),
    ask: (...args) => gitText(args, { cwd: dir, env })?.trim() ?? null,
    read: (...args) => gitOrThrow(args, { cwd: dir, env }),
    write: (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text, 'utf8') },
  }
}

/**
 * 在系统临时目录底下起一个临时根，建一个玩具仓库（只建目录，`git init` 由调用方做）交给 `fn`；
 * `fn` 跑完或抛错，整个临时根都删掉，抛的错原样往外抛。`more(名字)` 在同一个临时根底下再开一个空目录
 * （另一个玩具仓库、假的用户目录……），跟着一起删；要当玩具仓库用就交给 `toyRepoAt`。
 */
export function withToyRepo<T>(fn: (toy: ToyRepo, more: (name: string) => string) => T): T {
  const root = mkdtempSync(join(real(tmpdir()), 'kol-toy-'))
  try {
    return fn(toyAt(mkdtempSync(join(root, 'repo-'))), name => mkdtempSync(join(root, `${name}-`)))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

/** `withToyRepo` 的 `more` 开出来的目录当玩具仓库用 */
export const toyRepoAt = (dir: string): ToyRepo => toyAt(dir)
