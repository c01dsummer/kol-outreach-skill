import {
  writeFileSync, renameSync, rmSync, statSync, chmodSync, mkdirSync, readlinkSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'

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
 * **「写了」不等于「落到盘上了」**：本函数不刷盘，主机断电时这一次写回
 * 可能留不住 —— D4 明确不作保证。丢的是这一轮的记录，**文件本身不会坏**，
 * 因为坏的那一半是临时文件，原文件要么是旧的、要么是新的（ADR-54）。
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
export function writeFileAtomic(file: string, data: string): void {
  // 顺着软链找到真正要写的那个文件 —— 改名换掉的是**链接本身**
  const target = followLinks(file)
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
    renameSync(tmp, target)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

/**
 * 顺着软链找到真正要写的那个文件。
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
 */
function followLinks(file: string): string {
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
 */
export function mkdirDurable(dir: string): void {
  mkdirSync(dir, { recursive: true })
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
