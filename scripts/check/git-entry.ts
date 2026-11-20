/**
 * git 入口（ADR-220）：检查脚本调 git 都经这里（ADR-223 起待挪名单已清空），不直接碰 `node:child_process`（ADR-217 的闸门管着），
 * 通用启动函数也不替它们起 git（ADR-219）。
 *
 * 只答下面 `QUESTIONS` 里列出的那几问（每一行由评审看过是只读的、输出能给机器读）。一问是一串参数的形状：写死的字面量逐个比，`<修订>`、`<值>` 这两种空位
 * 填调用方的值、但不许以 `-` 开头（填不成开关），`<路径…>` 只许放在 `--` 后面、填一个或几个。不在表里的一律当场抛错、
 * 不起 git：问法换了，就得来这张表里加一行，由评审看这一问是不是只读、输出是不是给机器读的那种（`-z`、`--porcelain`）。
 *
 * 每一次都带上 `GIT_CONFIG` 里钉死的几项（中文路径不转义、改名检测开着），调用方不用、也不许各带一份；再带 `--no-optional-locks`：
 * `status` 本来会顺手刷新索引里的时间戳缓存，带了就不写（对工作区的 `diff` 带了也照样刷新，见 ADR-220 第四节）。
 * 起 git 用的函数在调用时从模块上取，计数预加载与观察器预加载换掉模块上的函数后照样数得到、拦得住。
 */
import cp from 'node:child_process'

import { GIT_CONFIG } from './git-config.js'

const REV = '<修订>', VALUE = '<值>', PATHS = '<路径…>'

/** 能问的全部形状。新加一行就是新加一种问法：只读、给机器读的输出、写明是谁要问（ADR-220 第二节） */
export const QUESTIONS: readonly (readonly string[])[] = [
  // 基线与主干（体量闸门的 resolveBaseline、决策记录同步的指纹表、外部工单号、启动数、分片负载）
  ['rev-parse', 'HEAD'],
  ['rev-parse', '--is-shallow-repository'],
  ['rev-parse', '--show-toplevel'],
  // 变异派工：worker 副本要带哪些文件（与下面列文件那几行一起交给 `workerCopyList`）
  ['rev-parse', '--show-prefix'],
  ['rev-parse', '--verify', REV],
  ['rev-parse', REV],
  ['merge-base', REV, REV],
  ['rev-list', REV],
  ['ls-tree', '--name-only', REV, '--', PATHS],
  ['ls-tree', '-z', '--full-tree', '--name-only', REV, '--', PATHS],
  ['show', REV],
  ['log', '-1', '--format=%B', REV],
  ['cat-file', 'blob', REV],
  // 体量闸门量改动；欠条碰没碰到列改到的文件
  ['diff', '--numstat', '-z', REV, REV],
  ['diff', '--numstat', '-z', '-w', REV, REV],
  ['diff', '--name-only', '--no-renames', '-z', REV],
  // 字段断言闸门：改过的文件（`--no-relative` 压住本机的 `diff.relative`）、单个文件新加了哪几行（只读块头，算法钉死），ADR-198 第四节
  ['diff', '--name-only', '--no-renames', '--no-relative', '-z', REV],
  ['diff', '--no-renames', '--no-relative', '--no-color', '--no-ext-diff', '--no-textconv', '--text', '--diff-algorithm=myers', '--indent-heuristic', '-U0', '--inter-hunk-context=0', REV, '--', PATHS],
  // 列文件：受控文件、技能目录的索引条目、起子进程闸门的全部文件
  ['ls-files', '-z'],
  ['ls-files', '-s', '-z', '--', PATHS],
  ['ls-files', '-z', '--full-name', '--cached', '--others', '--exclude-standard', '--', ':(top)'],
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  // 字段断言闸门：还没加进 git 的新文件（整份算新加），ADR-198 第四节
  ['ls-files', '-z', '--full-name', '--others', '--exclude-standard', '--', PATHS],
  // 变异锚点一次读暂存区与 HEAD 上的一组对象（从标准输入读）
  ['cat-file', '--batch'],
  // 打包时核输入有没有没提交的改动
  ['status', '--porcelain', '--untracked-files=all', '--ignored=matching', '--', PATHS],
  // 观察器认证：被测的树干不干净（只判输出空不空）
  ['status', '--porcelain'],
  // 外部工单号：工作区与基线树上各数一遍
  ['grep', '--no-color', '-o', '-z', '-I', '-i', '--full-name', '-E', VALUE, '--', ':(top)'],
  ['grep', '--no-color', '-o', '-z', '-I', '-i', '--full-name', '-E', VALUE, REV, '--', ':(top)'],
  // 到期复查：一行欠条是哪次提交加进来的、那时候的文件
  ['log', '--first-parent', '--diff-filter=A', '--format=%H', REV, '--', PATHS],
  ['blame', '--first-parent', '--porcelain', '-L', VALUE, REV, '--', PATHS],
]

const fits = (shape: readonly string[], args: readonly string[]): boolean => {
  const tail = shape.at(-1) === PATHS
  if (tail ? args.length < shape.length : args.length !== shape.length) return false
  return args.every((arg, i) => {
    const want = i < shape.length ? shape[i] : PATHS
    if (want === PATHS) return true
    if (want === REV || want === VALUE) return !arg.startsWith('-')
    return arg === want
  })
}

/** 这一串参数是不是表里的一问。不是就抛错：说出原样的参数，指到这张表 */
export function questionOf(args: readonly string[]): void {
  if (!Array.isArray(args) || args.some(a => typeof a !== 'string')) throw new Error('git 入口的参数要是一组字符串（ADR-220）')
  if (!QUESTIONS.some(s => fits(s, args))) throw new Error(`git 入口没有这一问：git ${JSON.stringify(args)}。要问新的，先在 git-entry.ts 的 QUESTIONS 里加一行（ADR-220）`)
}

export interface GitOptions {
  /** 仓库目录，缺省是当前目录 */
  cwd?: string
  /** 整份环境，缺省是本进程的 */
  env?: NodeJS.ProcessEnv
  /** 写进 git 标准输入的内容；不给就不接标准输入 */
  input?: string
}

/** git 真跑一遍的结果：退出码、标准输出的原始字节、标准错误、起不来时的错误 */
export interface GitAnswer { status: number | null; stdout: Buffer; stderr: string; error?: Error }

/** 同步、异步两版共用：先查表（不在表里抛错），再拼出交给 git 的整串参数 */
const argvFor = (args: readonly string[]): string[] => {
  questionOf(args)
  return ['--no-optional-locks', ...GIT_CONFIG, ...args]
}
/** 同步、异步两版共用：没给标准输入就不接 */
const stdioFor = (input: string | undefined): ['ignore' | 'pipe', 'pipe', 'pipe'] => [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']

/** 问一次，原样交回 git 怎么答的。参数不是表里的一问就抛错、不起 git */
export function runGit(args: readonly string[], options: GitOptions = {}): GitAnswer {
  const argv = argvFor(args)
  const { cwd, env, input } = options
  const r = cp.spawnSync('git', argv, { cwd, env, input, maxBuffer: 1 << 30, stdio: stdioFor(input) })
  return { status: r.status, stdout: r.stdout ?? Buffer.alloc(0), stderr: r.stderr?.toString('utf8') ?? '', error: r.error }
}

/**
 * 异步问一次，交回的形状与 `runGit` 一样：`error` 只表示起不来，非 0 退出、被信号杀都看 `status`（被杀是 `null`），
 * 标准输出不设上限。给接管了信号、不能同步等子进程的入口用（变异派工，ADR-221）。
 * 用 `spawn` 不用 `execFile`：后者不认 `stdio`，标准输入是一根开着的管道，从标准输入读的那一问会一直等下去；
 * 它还把起不来、非 0、被杀、超上限都放进同一个错误里，与同步版对不上。
 */
export function runGitAsync(args: readonly string[], options: GitOptions = {}): Promise<GitAnswer> {
  const argv = argvFor(args)
  const { cwd, env, input } = options
  return new Promise(done => {
    const kid = cp.spawn('git', argv, { cwd, env, stdio: stdioFor(input) })
    const out: Buffer[] = [], err: Buffer[] = []
    let failed: Error | undefined
    kid.stdout?.on('data', (b: Buffer) => out.push(b))
    kid.stderr?.on('data', (b: Buffer) => err.push(b))
    const answer = (status: number | null): GitAnswer =>
      ({ status, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8'), error: failed })
    // 起不来时有的只发 `error` 不发 `close`（没有 pid）；起得来的以 `close` 收尾，那时两股都读完了
    kid.on('error', e => { failed ??= e; if (kid.pid === undefined) done(answer(null)) })
    kid.on('close', status => done(answer(status)))
    // git 没读完就退出时写标准输入会报管道断了；那时答案看退出码，这一错不另算
    if (input !== undefined) { kid.stdin?.on('error', () => {}); kid.stdin?.end(input) }
  })
}

/** 问一次：git 以 0 退出交回标准输出（不去首尾空白），起不来或非 0 退出交回 `null` */
export function gitText(args: readonly string[], options: GitOptions = {}): string | null {
  const r = runGit(args, options)
  return r.error === undefined && r.status === 0 ? r.stdout.toString('utf8') : null
}

/** 问一次：git 以 0 退出交回标准输出（不去首尾空白），起不来或非 0 退出就抛错，错里带 git 的原话 */
export function gitOrThrow(args: readonly string[], options: GitOptions = {}): string {
  const r = runGit(args, options)
  if (r.error === undefined && r.status === 0) return r.stdout.toString('utf8')
  throw new Error(`git ${args.join(' ')} 没答上来（${r.error?.message ?? `退出码 ${r.status}`}）${r.stderr.trim() === '' ? '' : `：${r.stderr.trim()}`}`)
}

/** 给 resolveBaseline 这类吃「问一句、答一行」的判定用：去掉首尾空白，答不上来交回 `null` */
export const askGit = (...args: string[]): string | null => gitText(args)?.trim() ?? null
