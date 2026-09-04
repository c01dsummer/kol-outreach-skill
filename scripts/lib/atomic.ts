import {
  writeFileSync, renameSync, rmSync, statSync, chmodSync, readlinkSync, accessSync, constants,
  readdirSync, openSync, fsyncSync, closeSync, mkdirSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

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
 * 的实现细节替它定**（ADR-42 追记）。
 *
 * 临时名带 pid：两个任务同时跑时，共用一个临时名会让 A 的改名搬走 B 写的内容。
 * 写之前先清掉**已经死掉的进程**留下的临时文件（`sweepStaleTemps`）：硬杀落在
 * 写与改名之间时 catch 不会跑，那份完整的半成品只能由下一次写回清掉（ADR-30）。
 *
 * 改名前刷文件、改名后尽力刷目录、新建的目录逐层尽力刷（`mkdirDurable`）——
 * 这些是**尽力而为**，不是保证：主机断电时这次写回留不留得住，D4 明确不作保证；
 * 丢的是这一轮的记录，文件本身不会坏（ADR-50）。
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
  sweepStaleTemps(target)
  const tmp = `${target}.${process.pid}.tmp`
  let fd: number | undefined
  try {
    // 建、写、刷都用**建文件那一个描述符**，不再重开。重开一次就多一次权限之问：
    // 改完权限再开，目标是 0200 这类只写文件时会被拒（它过得了上面「可写」那一问），
    // 改名就永远走不到（评审第一轮）；改权限之前开，umask 遮掉属主写位（0200）时
    // 临时文件建出来是 0400，按读写开一样被拒 —— 而建文件的那次打开不看新文件的
    // 权限位，拿到的就是可写句柄（读写句柄那一刀的评审第一轮）。可写也正是
    // Windows 刷盘要的：FlushFileBuffers 只认带写权限的句柄，只读的描述符刷不动，
    // 每一次原子写都会在改名前失败（合入后的评审意见）。root 跑的时候这些拒绝
    // 都不发生，对应的测试只在 CI（非 root）咬得住。
    // 临时名上已经有东西时**不复用它**。带着这个 pid 死掉的前任留下的临时文件，
    // 权限已经在改名之前被调宽；而 Node 对已存在的文件忽略 mode —— 复用它，
    // 这次的内容就在宽权限下敞开着写（评审第一轮）。它还可能是条软链，跟着写
    // 就落到别处去了。同名的只可能是死掉的前任（活着的进程不共用 pid），先删掉，
    // 再独占地建：删与建之间要是又冒出来一个，宁可报失败也不写进去。
    rmSync(tmp, { force: true })
    fd = openSync(tmp, 'wx', 0o600)
    writeFileSync(fd, data, { encoding: 'utf8' })
    // 已有的文件带回它原来的权限；新文件还原成 umask 默认。
    // **两条都得写** —— 少了后一条，「新文件保持默认」就只是一句注释（ADR-42 追记）。
    // 权限位是 inode 的元数据：改完再刷，和内容一次落盘。
    chmodSync(tmp, mode ?? (0o666 & ~process.umask()))
    // 内容先落盘，再让改名把它接上。**刷不动要抛**：刷不动就是没落盘，而调用方
    // 正要据此告诉用户「已记入」；延迟写的错误（磁盘满、IO 错）恰恰是在这一刻
    // 才浮出来的，吞掉它等于把刷盘这件事存在的理由抵消掉。
    fsyncSync(fd)
    closeSync(fd); fd = undefined         // 改名前先关：有的平台不许改名一个开着的文件
    renameSync(tmp, target)
    fsyncDirBestEffort(dirname(target))   // 改名是目录的改动，它自己也要落盘
  } catch (e) {
    // 关不上描述符、清不掉半成品（比如那个名字上正好卡着一个目录），都不该盖住真正的错
    try { if (fd !== undefined) closeSync(fd) } catch { /* 报出去的是写失败的原因 */ }
    try { rmSync(tmp, { force: true }) } catch { /* 同上 */ }
    throw e
  }
}

/**
 * 把**目录**刷到盘上，尽力而为。
 *
 * 这一个可以吞：有的平台压根不允许把目录当文件打开，而那不该让一次
 * 内容已经落了盘、改名也成功了的写回变成失败。
 * **能吞的只有这一个** —— 文件和目录合成一个函数的话，文件那半也跟着被吞了。
 *
 * **关不上也要吞**，理由和打不开是同一个：这里没有一个失败值得让调用方
 * 认为整件事没做成。`writeFileAtomic` 的那次调用尤其如此 —— 它跑在
 * `renameSync` 之后，替换已经生效了，让一个关描述符的错逃出去，调用方就会
 * 照着这个失败告诉用户「没写回、原文件一个字节没动」，而那是假话：
 * 推荐记录已经落进去了。**一个说反了的结论比一次没刷成的目录严重得多**（ADR-47 追记一）。
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
 * 加强的是常见情况下的持久性，**不是一个保证**（ADR-50）。
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
 * 那一种坏法，却会被它自己引入（ADR-46 追记三）。
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
 * 一个临时文件最多可能正在被写多久。
 *
 * 写的过程是一次 `writeFileSync` 加一次 `renameSync`，毫秒级。取一小时是
 * **荒谬地宽松** —— 为的是正常写盘的文件不会被误判成孤儿。
 * **不是「不可能」**：被 SIGSTOP 或调试器按住超过这个时长的写入方仍会被误判，
 * 那是 ADR-44 明写下来的取舍（误判是响的，不清理是静默的）。
 * 它只用来兜住 pid 被系统回收的那一种情况。
 */
const TMP_MAX_AGE_MS = 60 * 60 * 1000

/**
 * 系统发得出的 pid 上限：Linux 的硬上限 `PID_MAX_LIMIT` 在 64 位下是 4 * 1024 * 1024
 * （运行时的 `pid_max` 只能比它小），macOS / BSD 是 99999，都在这以内；Windows 没写死，
 * 但实际远在此内。名字里的数超过它就没有哪个进程写得出来。**宁严勿宽**：判严了的代价
 * 是那份残留留着不清，判松了会删掉别人的文件（评审第三轮）
 */
const PID_MAX = 4 * 1024 * 1024

/** 那个进程还在吗。EPERM 说明进程存在、只是不归我们管 —— 那也算活着 */
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true }
  catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM' }
}

/**
 * 清掉**已经死掉的进程**留在 `target` 旁边的临时文件。
 *
 * 写临时文件再改名挡得住「写到一半被打断」，挡不住**在两步之间被硬杀**
 * （SIGKILL、断电）—— 那时 catch 根本不会跑，一份完整的临时文件留在盘上。
 * 任何 write-then-rename 都躲不掉这一格，能做的是**下次写回时把它清掉**。
 *
 * 活着的进程的临时文件不动：两个 render 同时跑时，那是人家正在写的（ADR-30）。
 *
 * **但「pid 还活着」不等于「它就是写这个文件的那个进程」** —— 系统会回收 pid。
 * 回收到一个长命进程头上，这个孤儿就再也清不掉了，一份完整的记忆副本
 * 永远躺在盘上。所以再拿**文件年龄**兜一道：真正在写的文件只有毫秒级的寿命，
 * 活过一小时的**几乎一定不是**（ADR-39 · ADR-44）。
 *
 * **年龄这一道有代价，明写在这里：** 一个被 SIGSTOP 或调试器按住超过一小时的
 * 写入方，它的临时文件会被当成孤儿清掉，它恢复后改名失败。这是一个
 * **有意的取舍** —— 两边都罕见，但坏法不同：pid 回收留下的孤儿是**静默的**
 * （一份完整副本永远躺在盘上，没人知道），而误清一个被按住的写入方是**响的**
 * （那一次写回报为失败，交付照常完成并带出原因，走 D4 已有的那条路）。
 * 静默与响之间选响的（ADR-44）。
 *
 * 扫的是 `target` 所在的目录 —— 调用方传进来的已经是软链的终点，
 * 临时文件就落在那里；照着链接那一侧扫会永远扫不到（ADR-46 追记四）。
 */
function sweepStaleTemps(target: string): void {
  const dir = dirname(target)
  const prefix = `${basename(target)}.`
  let names: string[]
  // 目录列不出来（只写不可读这种权限组合）就跳过这一次清理，**不因此让写回失败** ——
  // 清不掉临时文件的代价是盘上多一份副本，而中断写回的代价是这一轮的记录全丢。
  try { names = readdirSync(dir) } catch { return }
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.tmp')) continue
    // 只认 `process.pid` 写得出来的名字：正规十进制（`1e3`、`007`、`0x10`、`-5` 都不是，
    // 而 `Number()` 全吞得下）、转成数字没丢精度（过了 2^53 转回来就对不上）、
    // 落在系统发得出的范围里（`PID_MAX`；超出它的 `process.kill` 答的是「没这个进程」，
    // 超出 int32 的更是直接抛参数错，`alive` 都会当成「死了」）。别的名字没有哪个进程
    // 写得出来 —— 那是别人的文件，不是残留，再老也不动（评审一、二、三轮）
    const spelled = name.slice(prefix.length, -'.tmp'.length)
    const pid = Number(spelled)
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid > PID_MAX || String(pid) !== spelled) continue
    let ageMs: number
    // 看不到它的年龄就跳过（刚被别人清掉、或者读不到）—— **跳过是安全的那一边**：
    // 拿不准的文件不删，代价是盘上多留一份；删错的代价是搬走别人正在写的东西
    try { ageMs = Date.now() - statSync(join(dir, name)).mtimeMs } catch { continue }
    // 自己这个 pid 名下的残留不在这里清：写入那一步会把它删掉重建
    if (pid === process.pid) continue
    if (alive(pid) && ageMs < TMP_MAX_AGE_MS) continue
    // 清不掉（比如它是个目录）也不让写回失败：这条要求 D4 写明了
    try { rmSync(join(dir, name), { force: true }) } catch { /* 留着，下次再试 */ }
  }
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
