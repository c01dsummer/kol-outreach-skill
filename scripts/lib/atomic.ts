import {
  writeFileSync, renameSync, rmSync, statSync, chmodSync, openSync, fsyncSync, closeSync,
} from 'node:fs'
import { dirname } from 'node:path'

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
    fsync(tmp)                 // 内容先落盘，再让改名把它接上
    // 改名前**最后一刻**再确认一次调用方的前提还成立。放在这里而不是函数外面，
    // 是为了让「确认」到「生效」之间的窗口尽可能小 —— 它缩不到零（ADR-47）。
    verify?.()
    renameSync(tmp, file)
    fsync(dirname(file))       // 改名是目录的改动，它自己也要落盘
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

/** 把一个路径（文件或目录）刷到盘上。刷不动就算了 —— 有些文件系统不支持刷目录 */
function fsync(path: string): void {
  let fd: number | undefined
  try {
    fd = openSync(path, 'r')
    fsyncSync(fd)
  } catch { /* 刷不动不该让一次成功的写回变成失败 */ }
  finally { if (fd !== undefined) closeSync(fd) }
}
