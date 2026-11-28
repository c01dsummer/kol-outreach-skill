#!/usr/bin/env bash
# 跑一条命令，跑完打一行它花了多少 CPU 时间（ADR-254，还 ADR-203 第 157 行「主干 CI 只有墙钟」）。
# CI 上检查链与各份变异都经它跑：墙钟会被抢占、换机器拉长，CPU 时间（用户加系统）受抢占影响小得多，两个并列给出，
# 只报数，不判红 —— 闸门的线照旧按墙钟估（ADR-203、ADR-254）。
#
# 用法：bash scripts/check/cpu-time.sh <名字> <命令> [参数…]
# CPU 时间取自 shell 内建的 `times` 第二行：这个 shell 等过的所有子进程（连同它们等过的子孙）的用户与系统时间之和。
# `times` 必须在这个 shell 自己里跑（重定向到文件，不经 `$(…)`）：放进子 shell 就成了那个子 shell 的子进程，是 0。
# 没被等过的进程不算在里面：自己脱离出去的，或连着父进程一起被杀、改由 init 收的 —— 变异一步「见齐就停」整组杀掉验证者时，
# 那一刻正在跑的子进程树就是这样，所以开着提前停的那几份报的 CPU 偏小。
# 打一行 `::notice title=CPU 时间::…`，设了 GITHUB_STEP_SUMMARY 就同一行也写进去；以那条命令的退出码退出。
# 用法错（少名字或少命令）以 2 退出，什么都不跑。
set -u

label=${1:-}
if [ -z "$label" ] || [ $# -lt 2 ]; then
  echo "用法：bash scripts/check/cpu-time.sh <名字> <命令> [参数…]" >&2; exit 2
fi
shift
start=$SECONDS
"$@"
status=$?
wall=$((SECONDS - start))
spent=$(mktemp) || { echo "::warning title=CPU 时间::${label}：拿不到临时文件，没算 CPU 时间"; exit "$status"; }
times > "$spent"
# 第二行形如「12m3.456s 0m7.890s」：子进程的用户时间、系统时间
cpu=$(LC_ALL=C awk 'NR == 2 { n = split($0, f, " "); for (i = 1; i <= 2; i++) { split(f[i], p, "m"); sub("s", "", p[2]); t[i] = p[1] * 60 + p[2] }
             printf "%.1f %.1f %.1f", t[1] + t[2], t[1], t[2] }' "$spent")
rm -f "$spent"
read -r total user sys <<< "$cpu"
line="CPU 时间：${label}：CPU ${total} 秒（用户 ${user} · 系统 ${sys}，含子进程） · 墙钟 ${wall} 秒 · 退出码 ${status}"
echo "::notice title=CPU 时间::$line"
[ -z "${GITHUB_STEP_SUMMARY:-}" ] || echo "$line" >> "$GITHUB_STEP_SUMMARY"
exit "$status"
