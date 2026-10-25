/** N child 的信号处理；Linux TERM 在真实入口求值后安装，保留同步自身信号的 native 退出。 */
import { constants } from 'node:os'
import { pathToFileURL } from 'node:url'

const install = (signal: 'SIGINT' | 'SIGTERM'): void => {
  process.on(signal, () => process.exit(128 + constants.signals[signal]))
}
install('SIGINT')
if (process.platform === 'linux') {
  const entry = process.argv[1]
  if (!entry) throw new Error('prebuilt child requires an entry')
  await import(pathToFileURL(entry).href)
  if (process.listenerCount('SIGTERM') === 0) install('SIGTERM')
} else {
  install('SIGTERM')
}
