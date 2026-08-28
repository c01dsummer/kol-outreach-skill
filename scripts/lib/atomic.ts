import {
  writeFileSync, renameSync, rmSync, statSync, chmodSync, openSync, fsyncSync, closeSync,
  mkdirSync,
} from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

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
 *   断电时文件系统恢复出来的可能是一个空文件或者干脆没有这次改名，
 *   而这个函数已经返回成功了。刷目录是因为**改名本身也是目录的一次改动**（ADR-47）
 *
 * 目标不存在时保持 umask 默认：新文件该多严是产品决定，不在这里替它定。
 *
 * 临时名带 pid：两个任务同时跑时，共用一个临时名会让 A 的改名搬走 B 写的内容。
 * **本函数不清理孤儿临时文件** —— 什么时候算孤儿、清不清得起，由调用方
 * 按自己那份文件的处境决定（记忆文件要清，一次性的任务目录不用）。
 */
export function writeFileAtomic(file: string, data: string, verify?: () => void): void {
  let mode: number | undefined
  try { mode = statSync(file).mode & 0o777 } catch { /* 新文件 */ }
  const tmp = `${file}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, data, { encoding: 'utf8', mode: 0o600 })
    if (mode !== undefined) chmodSync(tmp, mode)
    fsyncFile(tmp)             // 内容先落盘，再让改名把它接上；刷不动就是没落盘，要抛
    // 改名前**最后一刻**再确认一次调用方的前提还成立。放在这里而不是函数外面，
    // 是为了让「确认」到「生效」之间的窗口尽可能小 —— 它缩不到零（ADR-47）。
    verify?.()
    renameSync(tmp, file)
    fsyncDirBestEffort(dirname(file))   // 改名是目录的改动，它自己也要落盘
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

/**
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
 */
function fsyncDirBestEffort(path: string): void {
  let fd: number | undefined
  try { fd = openSync(path, 'r'); fsyncSync(fd) }
  catch { /* 平台不支持刷目录 */ }
  finally { if (fd !== undefined) closeSync(fd) }
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
