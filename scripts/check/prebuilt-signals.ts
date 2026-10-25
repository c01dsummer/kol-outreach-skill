/** N child 的信号处理；Linux TERM 在真实入口求值后安装，保留同步自身信号与用户显式清空。 */
import { constants } from 'node:os'
import { pathToFileURL } from 'node:url'

const install = (signal: 'SIGINT' | 'SIGTERM'): void => {
  process.on(signal, () => process.exit(128 + constants.signals[signal]))
}
install('SIGINT')
if (process.platform === 'linux') {
  const entry = process.argv[1]
  if (!entry) throw new Error('prebuilt child requires an entry')
  const own = Object.getOwnPropertyDescriptor(process, 'removeAllListeners')
  const original = process.removeAllListeners
  let explicitTermClear = false
  const replacement = function(this: NodeJS.Process, ...args: Parameters<typeof original>) {
    if (this === process && (args.length === 0 || args[0] === 'SIGTERM')) explicitTermClear = true
    return Reflect.apply(original, this, args)
  }
  process.removeAllListeners = replacement
  try {
    await import(pathToFileURL(entry).href)
  } finally {
    if (process.removeAllListeners === replacement) {
      if (own === undefined) {
        if (!Reflect.deleteProperty(process, 'removeAllListeners')) throw new Error('prebuilt child could not restore removeAllListeners')
      } else Object.defineProperty(process, 'removeAllListeners', own)
    }
  }
  if (!explicitTermClear && process.listenerCount('SIGTERM') === 0) install('SIGTERM')
} else {
  install('SIGTERM')
}
