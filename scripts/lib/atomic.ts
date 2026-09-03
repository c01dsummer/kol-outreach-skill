import {
  writeFileSync, renameSync, rmSync, statSync, chmodSync, readlinkSync, accessSync, constants,
} from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * 整体替换地写一个文件：**先写临时文件，再改名。**
 *
 * 跨任务记忆、任务目录里的状态文件、四个交付物都经它落盘 —— 拆分前的分支上
 * 它们曾各写过一份，结果是同一个权限位的 bug 被修好一次、又在另一份里原样重现
 * （ADR-46）。**所以只留这一份。**
 *
 * 直接盖原文件是非原子的：写到一半被打断，留下的是一份截断的 JSON，
 * 而这些文件每个都只有一份，坏了要重新花钱抓、或者永久丢掉「谁联系过」（ADR-15）。
 *
 * 三件事都要做，各有各的理由：
 *
 * - **临时文件建的时候就给 0600** —— 按 umask 建（通常 0644）再收紧的话，
 *   完整的内容在那段窗口里是别人读得到的，硬杀落在窗口里还会把它留在盘上（ADR-42）
 * - **再 chmod 到目标原有的权限** —— 改名换掉整个 inode，权限跟着新文件走；
 *   不带过去的话，用户特意收紧过的文件每写一次就被放开一次（ADR-40）。
 *   建文件时的 mode 会被 umask 削而 chmod 不会，所以两步都要
 * - **失败时清掉半成品**，不留在盘上
 *
 * 目标不存在时**显式还原成 umask 默认**：临时文件是按最严建的，不还原的话
 * 每个新建的文件都变成只有属主可读 —— 而这个函数写的不只是记忆，还有
 * `task.json`、名单、增强结果。新文件该多严是产品决定，**不该由一个临时文件
 * 的实现细节替它定**（ADR-57）。
 *
 * 临时名带 pid：两个任务同时跑时，共用一个临时名会让 A 的改名搬走 B 写的内容。
 * **本函数不清理孤儿临时文件** —— 什么时候算孤儿、清不清得起，由调用方
 * 按自己那份文件的处境决定（ADR-30）。
 *
 * 改名前后**不刷盘**：主机断电时这次写回留不留得住，D4 明确不作保证（ADR-50）；
 * 尽力而为的刷盘是持久性那一层，单独一片。
 */
export function writeFileAtomic(file: string, data: string | Buffer): void {
  const target = writeTarget(file)
  let mode: number | undefined
  // **只有「不存在」才是新文件。** 权限、路径、IO 出错时读不到目标的权限位，
  // 那时候不该假装它是新的 —— 假装的后果是把用户设过的权限换成 0600，
  // 方向反了但同样是「悄悄改掉用户定的东西」。读不到就抛，别猜（ADR-40 的另一面）。
  try { mode = statSync(target).mode & 0o777 }
  catch (e) { if (!isAbsence(e)) throw e }
  // 目标存在但不可写时**不替换**。直接写会被拒（EACCES），改名却会成功 —— 换掉的
  // 是目录里的条目，目录可写就行；整体替换不该悄悄绕过用户给文件设的只读
  // （评审第三轮）。先看权限位：root 跑的时候 accessSync 对什么都说可写，而用户把
  // 文件设成只读的意思不因为谁在跑而变。再问 accessSync：不是 root 时按属主属组判，
  // 别人的文件同样不替换。变异把这两问一起拿掉：只拿掉权限位那一问的话，
  // 非 root 跑测试时 accessSync 照样拦住，看不出区别（CI 就是这么跑的）。
  if (mode !== undefined) {
    if ((mode & 0o222) === 0) throw readOnly(target)
    accessSync(target, constants.W_OK)
  }
  const tmp = `${target}.${process.pid}.tmp`
  try {
    // 临时名上已经有东西时**不复用它**。带着这个 pid 死掉的前任留下的临时文件，
    // 权限已经在改名之前被调宽；而 Node 对已存在的文件忽略 mode —— 复用它，
    // 这次的内容就在宽权限下敞开着写（评审第一轮）。它还可能是条软链，跟着写
    // 就落到别处去了。同名的只可能是死掉的前任（活着的进程不共用 pid），先删掉，
    // 再独占地建：删与建之间要是又冒出来一个，宁可报失败也不写进去。
    rmSync(tmp, { force: true })
    writeFileSync(tmp, data, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    // 已有的文件带回它原来的权限；新文件还原成 umask 默认。
    // **两条都得写** —— 少了后一条，「新文件保持默认」就只是一句注释（ADR-57）。
    chmodSync(tmp, mode ?? (0o666 & ~process.umask()))
    renameSync(tmp, target)
  } catch (e) {
    // 清不掉半成品（比如那个名字上正好卡着一个目录）也不该盖住真正的错
    try { rmSync(tmp, { force: true }) } catch { /* 报出去的是写失败的原因 */ }
    throw e
  }
}

function readOnly(target: string): NodeJS.ErrnoException {
  const e = new Error(`EACCES: ${target} 是只读的（权限位没有写），不替换`) as NodeJS.ErrnoException
  e.code = 'EACCES'
  return e
}

/**
 * 一次整体替换**真正落在哪个文件上**：顺着软链找到终点。
 *
 * `renameSync` 换掉的是**链接本身**，不是它指向的文件。目标是软链时，
 * 第一次写回就把用户配好的那条链接换成一个普通文件，而真正那份从此不再
 * 更新 —— 报告照样说「已记入」。**静默地停止记录**，正是整体替换要防的
 * 那一种坏法，却会被它自己引入（ADR-57）。
 *
 * 换成整体替换之前，这里是一次普通的 `writeFileSync`，它跟着链接写到终点。
 * 所以这不是补一个新能力，是**不让整体替换顺手弄坏原来对的行为**。
 *
 * 不用 `realpathSync`：它要求终点存在，而**终点不存在时该写的正是那个终点**，
 * 不是把链接换掉。
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
 * 一次读失败，算不算「盘上没有这个文件」？
 *
 * **只有 ENOENT 算。** 权限不足、父路径不是目录、IO 错都是「看不到」——
 * 把它们和「确实没有」压成一个值，就会拿「看不到」当「没有」放行（ADR-26）。
 * 读记忆的那一侧和写文件的这一侧问的是同一个问题，所以只有这一份。
 */
export const isAbsence = (e: unknown): boolean =>
  (e as NodeJS.ErrnoException | null)?.code === 'ENOENT'
