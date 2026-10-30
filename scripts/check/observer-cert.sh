# KOL-21 零请求观察器与外层断网的冻结认证命令。本文件的 SHA256 记在 ADR-70 末尾「KOL-21 零请求观察器与外层断网」一节。
#
# 整合方在 PR head 的干净克隆根目录、Node 22 下照原样跑这两条（第一条是派发规定的安装步骤，不在本文件里执行）：
#
#   npm ci --prefer-offline --no-audit
#   sh scripts/check/observer-cert.sh
#
# 证据全部写进 output/kol21-observer-cert/（output/ 不进仓库）；那个目录已经存在就停下，不覆盖旧证据：
#   summary.json        最后写：被测提交（40 位）与工作区干不干净、Node 版本、设施各文件与每份证据的 SHA256、每一项的结论
#   console.txt         下面这条命令打到 stdout 的每一行
#   isolation/          外层断网认证：受控目标、两边的探针输出、沙箱布局、结论
#   <入口>-positive/    probe、collect、enrich、render 各一条阳性对照：work/ 是输入，run/ 是脚本、参数表、事件文件、两股输出、退出码、判的结果
#   <入口>-zero/        同上，零记录对照
#   fault-<种类>/       设施故障对照（脚本外的请求、事件写不进、事件文件建不出来、被信号打死、没装上观察器、伪造的认证）
# 全部成立以 0 退出，否则 1。不访问外网：唯一的连接是本机 127.0.0.1 上认证自己起的受控目标。
set -eu
cd "$(dirname "$0")/../.."
node_modules/.bin/tsx scripts/check/observer-cert.ts --out output/kol21-observer-cert
