/**
 * 同步把一段话写满一个 fd —— 硬退出之前那句话靠它出去（ADR-70 末尾「硬退出收口」一节）。
 *
 * `console.error` 接管道时是异步的：排在队里还没写出去，紧跟着的硬退出就把它掐掉。同步写没有那个窗口，
 * 可是只换成 `writeFileSync(2, …)` 不够：这个进程只要先用 `console` 写过一次，那条管道就被设成了非阻塞，
 * 管道一满（正是有积压的时候），同步写写进去一截就抛 `EAGAIN`，余下的照样没了，还多一个异常盖在上面。
 * 实测：先 `console.error` 一行、再同步写 5 MB、读的那头先睡一秒，只到了 64326 字节就抛了。
 *
 * 所以这里一截一截写：写进去多少记多少，`EAGAIN` 就停 1 毫秒接着写，直到写完；读的那头一直不读的话，
 * 累计等够 `deadlineMs` 就放弃，交回 `false` —— 不能为了一句诊断把退出挂死。别的错（读的那头关了，`EPIPE`）
 * 不等，当场交回 `false`。
 *
 * 写与等由调用方给（缺省是真的 `writeSync` 和真的睡），需求测试拿假的验这几条路。
 */
import { writeSync } from 'node:fs'

export interface SyncIo {
  write: (fd: number, buf: Uint8Array, offset: number, length: number) => number
  pause: (ms: number) => void
}

const realIo: SyncIo = {
  write: (fd, buf, offset, length) => writeSync(fd, buf, offset, length),
  pause: ms => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) },
}

export function writeAllSync(fd: number, text: string, io: SyncIo = realIo, deadlineMs = 5000): boolean {
  const buf = Buffer.from(text, 'utf8')
  let offset = 0
  let waited = 0
  while (offset < buf.length) {
    try {
      offset += io.write(fd, buf, offset, buf.length - offset)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EAGAIN' || waited >= deadlineMs) return false
      io.pause(1)
      waited += 1
    }
  }
  return true
}
