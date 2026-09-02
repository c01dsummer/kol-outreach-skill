import {
  writeFileSync, renameSync, rmSync, statSync, chmodSync, mkdirSync, readlinkSync,
  openSync, fsyncSync, closeSync, readFileSync,
} from 'node:fs'
import { dirname, resolve, join, relative, sep } from 'node:path'

/**
 * 整体替换地写一个文件：**先写临时文件，再改名。**
 *
 * 这个仓库里有两处需要它 —— 跨任务记忆和任务目录里的几个文件 —— 而它们
 * 曾经各写过一份。结果是同一个权限位的 bug 被修好一次、又在另一份里
 * 原样重现（ADR-46）。**所以只留这一份。**
 *
 * 直接盖原文件是非原子的：写到一半被打断，留下的是一份截断的 JSON，
 * 而这些文件每个都只有一份，坏了要重新花钱抓、或者永久丢掉「谁联系过」。
 *
 * 三件事都要做，各有各的理由：
 *
 * - **临时文件建的时候就给 0600** —— 按 umask 建（通常 0644）再收紧的话，
 *   完整的内容在那段窗口里是别人读得到的，硬杀落在窗口里还会把它留在盘上
 * - **再 chmod 到目标原有的权限** —— rename 换掉整个 inode，权限跟着新文件走；
 *   不带过去的话，用户特意收紧过的文件每写一次就被放开一次。
 *   建文件时的 mode 会被 umask 削而 chmod 不会，所以两步都要
 * - **失败时清掉半成品**，不留在盘上
 * - **改名前刷临时文件，改名后刷所在目录** —— 「写了」和「落到盘上了」是两件事。
 *   刷目录是因为**改名本身也是目录的一次改动**（ADR-47）。
 *   **这一条是尽力而为，不是承诺**：主机断电时这次写回留不留得住，
 *   D4 明确不作保证 —— 真丢了，损失是这一轮的记录，而文件本身不会坏。
 *   把它做成保证需要的是另一个量级的工程（每一环都不能漏），
 *   那要先成为一条需求再实现，不是在这里悄悄加深（ADR-50）
 *
 * 目标不存在时**显式还原成 umask 默认**：临时文件是按最严建的，不还原的话
 * 每个新建的文件都变成只有属主可读 —— 而这个函数写的不只是记忆，还有
 * `task.json`、名单、增强结果。新文件该多严是产品决定，**不该由一个临时文件
 * 的实现细节替它定**（ADR-57）。
 *
 * 临时名带 pid：两个任务同时跑时，共用一个临时名会让 A 的改名搬走 B 写的内容。
 * **本函数不清理孤儿临时文件** —— 什么时候算孤儿、清不清得起，由调用方
 * 按自己那份文件的处境决定（记忆文件要清，一次性的任务目录不用）。
 */
export function writeFileAtomic(file: string, data: string, verify?: () => void): void {
  const target = writeTarget(file)
  let mode: number | undefined
  // **只有「不存在」才是新文件。** 权限、路径、IO 出错时读不到目标的权限位，
  // 那时候不该假装它是新的 —— 假装的后果是把用户设过的权限换成 0600，
  // 方向反了但同样是「悄悄改掉用户定的东西」。读不到就抛，别猜（自查发现）。
  try { mode = statSync(target).mode & 0o777 }
  catch (e) { if (!isAbsence(e)) throw e }
  const tmp = `${target}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, data, { encoding: 'utf8', mode: 0o600 })
    // 已有的文件带回它原来的权限；新文件还原成 umask 默认。
    // **两条都得写** —— 少了后一条，「新文件保持默认」就只是一句注释（ADR-57）。
    chmodSync(tmp, mode ?? (0o666 & ~process.umask()))
    fsyncFile(tmp)             // 内容先落盘，再让改名把它接上；刷不动就是没落盘，要抛
    // 改名前**最后一刻**再确认一次调用方的前提还成立。放在这里而不是函数外面，
    // 是为了让「确认」到「生效」之间的窗口尽可能小 —— 它缩不到零（ADR-47）。
    verify?.()
    renameSync(tmp, target)
    fsyncDirBestEffort(dirname(target))   // 改名是目录的改动，它自己也要落盘
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

/**
 * 一次整体替换**真正落在哪个文件上**。
 *
 * 顺着软链找到终点 —— 改名换掉的是链接本身，不是它指向的文件。
 *
 * `renameSync` 换掉的是**链接本身**，不是它指向的文件。目标是软链时，
 * 第一次写回就把用户配好的那条链接换成一个普通文件，而真正那份从此不再
 * 更新 —— 报告照样说「已记入」。**静默地停止记录**，正是这个改动存在的
 * 理由要防的那一种，却被它自己引入了（ADR-57）。
 *
 * 换成整体替换之前，这里是一次普通的 `writeFileSync`，它跟着链接写到终点。
 * 所以这不是补一个新能力，是**把整体替换顺手弄坏的那个行为还回去**。
 *
 * 不用 `realpathSync`：它要求终点存在，而**终点不存在时该写的正是那个终点**，
 * 不是把链接换掉。
 *
 * **导出，因为不止写的那一方要问。** 清理孤儿临时文件的那一方也得问同一个
 * 问题 —— 它照着链接那一侧去扫，就永远扫不到落在终点旁边的那些，
 * 而那是一份完整的联系历史（ADR-60）。判据只此一份，两边都调它。
 */
export function writeTarget(file: string): string {
  let cur = file
  for (let i = 0; i < 32; i++) {
    let next: string
    try { next = readlinkSync(cur) }
    catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      // 不是链接（EINVAL）、或者盘上没有（ENOENT）：就是它了。
      // 别的错是「看不出来」—— 和 isAbsence 同一条规矩，看不出来就别猜
      if (code === 'EINVAL' || code === 'ENOENT') return cur
      throw e
    }
    cur = resolve(dirname(cur), next)
  }
  throw new Error(`${file} 的软链超过 32 层，可能成环 —— 不猜终点在哪`)
}

/**
 * 建目录。**只保证目录在**，不保证断电之后它还在 —— 让新建的每一层都落盘
 * 属于持久性那一层，单独一个改动（ADR-54）。

 * 把**文件**刷到盘上。**失败要抛。**
 *
 * 刷不动就是没落盘 —— 而调用方正要据此告诉用户「已记入」。
 * 延迟写的错误（磁盘满、IO 错）恰恰是在这一刻才浮出来的，吞掉它等于
 * 把这个函数存在的理由抵消掉（ADR-48）。
 */
function fsyncFile(path: string): void {
  const fd = openSync(path, 'r')
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

/**
 * 把**目录**刷到盘上，尽力而为。
 *
 * 这一个可以吞：有的平台压根不允许把目录当文件打开，而那不该让一次
 * 内容已经落了盘、改名也成功了的写回变成失败。
 * **能吞的只有这一个** —— 上一版把文件和目录合成一个函数，于是文件那半
 * 也跟着被吞了。
 *
 * **关不上也要吞**，理由和打不开是同一个：这里没有一个失败值得让调用方
 * 认为整件事没做成。`writeFileAtomic` 的那次调用尤其如此 —— 它跑在
 * `renameSync` 之后，替换已经生效了，让一个关描述符的错逃出去，调用方就会
 * 照着这个失败告诉用户「没写回、原文件一个字节没动」，而那是假话：
 * 推荐记录已经落进去了。**一个说反了的结论比一次没刷成的目录严重得多**（ADR-53）。
 */
function fsyncDirBestEffort(path: string): void {
  let fd: number | undefined
  try { fd = openSync(path, 'r'); fsyncSync(fd) }
  catch { /* 平台不支持刷目录 */ }
  finally { try { if (fd !== undefined) closeSync(fd) } catch { /* 同上，尽力而为 */ } }
}

/**
 * 建目录，并让**新建的每一层都被记住**。
 *
 * `writeFileAtomic` 刷的是文件所在的那一层 —— 它让**文件的目录项**落了盘。
 * 但如果这些目录本身是刚建出来的，**记录这些目录的是它们各自的上一层**，
 * 而那几层没有人刷过。断电之后整个目录可能不存在，而调用方已被告知成功：
 * 第一次跑时的断点、或者第一份联系历史，就这么没了（ADR-49）。
 *
 * `mkdirSync` 的 recursive 会返回**第一个被新建的那一层**（本来就在则返回
 * undefined），所以确切知道要刷哪几层：从那一层的父目录开始，逐层往下刷到
 * `dir` 的上一层为止。`dir` 自己不在这里刷 —— 写文件那一步会刷它。
 *
 * 刷目录仍然是尽力而为（有的平台不允许把目录当文件打开），所以这一条
 * 加强的是常见情况下的持久性，**不是一个保证**。
 */
export function mkdirDurable(dir: string): void {
  const first = mkdirSync(dir, { recursive: true })
  if (first === undefined) return          // 本来就在，没有新的目录项要记
  fsyncDirBestEffort(dirname(first))       // 记住 first 的是它的父目录
  const rest = relative(first, dir)
  let cur = first
  for (const seg of rest ? rest.split(sep) : []) {
    fsyncDirBestEffort(cur)                // 记住下一层的是当前这层
    cur = join(cur, seg)
  }
}

/** 盘上「什么都没有」的那个取值。必须和任何真实内容都不相等 */
export const ABSENT_FILE = '\u0000absent'

/**
 * 盘上现在是什么，用来做改名前的比对。
 *
 * **只有「文件不存在」返回哨兵值** —— 权限不足、路径不是目录、IO 错都是
 * 「看不到」，把它们和「确实没有」压成一个值，比对就会拿「看不到」当
 * 「没变过」放行（ADR-26 · ADR-48 各栽过一次，所以这里只留一份）。
 */
export function readIfExists(file: string): string {
  try { return readFileSync(file, 'utf8') }
  catch (e) { if (isAbsence(e)) return ABSENT_FILE; throw e }
}

/**
 * 一次读失败，算不算「盘上没有这个文件」？
 *
 * **只有 ENOENT 算。** 权限不足、父路径不是目录、IO 错都是「看不到」——
 * 把它们和「确实没有」压成一个值，就会拿「看不到」当「没有」放行。
 * 这个塌陷在这个仓库里出现过两次（ADR-26 · ADR-48），两次都是因为
 * 同一个判断有两份副本 —— 所以现在只有这一份。
 */
export const isAbsence = (e: unknown): boolean =>
  (e as NodeJS.ErrnoException | null)?.code === 'ENOENT'
