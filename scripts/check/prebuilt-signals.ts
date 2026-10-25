/** N child 的默认 INT/TERM 处理；真实入口拥有退出钩子，用户可按 Node 公开 API 接管。 */
import { constants } from 'node:os'

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => process.exit(128 + constants.signals[signal]))
}
