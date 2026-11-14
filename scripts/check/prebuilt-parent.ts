/**
 * N 域的缓存入口仍保留父子边界（ADR-158）：child 自己执行退出钩子，父进程转发
 * INT/TERM，并为同步阻塞的 child 保留一次有界硬停。只用公开 Node API，不复制 tsx 实现。
 * stdout/stderr 由 child 直接继承；收到真实 close 后收尾，不能被父侧普通预加载的活句柄留住。
 */
import { spawn } from 'node:child_process'
import { constants } from 'node:os'
import { fileURLToPath } from 'node:url'

const meta = process.argv.slice(2), split = meta.indexOf('--')
if (split !== 2 || meta[0] !== '--hook' || !meta[1] || meta.length <= 3) {
  throw new Error('prebuilt parent requires --hook URL -- entry args')
}
const hook = meta[1], args = meta.slice(split + 1)
const signals = fileURLToPath(new URL('./prebuilt-signals.ts', import.meta.url))
const preloads = process.platform === 'linux' ? [hook, signals] : [signals, hook]
const child = spawn(process.execPath, ['--enable-source-maps', '--import', preloads[0], '--import', preloads[1], ...args], {
  stdio: 'inherit', env: process.env, cwd: process.cwd(),
})
let interrupted: NodeJS.Signals | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let spawnError = false, closed = false
let errorWritten: Promise<void> = Promise.resolve()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (closed) return
    interrupted = signal
    try { child.kill(signal) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      if (!closed) {
        try { child.kill('SIGKILL') } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
        }
      }
    }, 60)
  })
}
child.on('error', error => {
  spawnError = true
  errorWritten = new Promise(resolve => process.stderr.write(String(error) + '\n', () => resolve()))
})
child.on('close', async (code, signal) => {
  closed = true
  if (timer !== undefined) clearTimeout(timer)
  await errorWritten
  process.exit(spawnError ? 1 : code !== null ? code : signal !== null ? 128 + constants.signals[interrupted ?? signal] : 1)
})
