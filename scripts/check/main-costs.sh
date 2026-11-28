#!/usr/bin/env bash
# 取主干上一跑各份变异的成本报告（ADR-254）：CI 上变异分份与变异负载闸门都按它称每一摞有多重。
#
# 用法：bash scripts/check/main-costs.sh <输出文件> <份数>
# 要 GITHUB_REPOSITORY 与 GH_TOKEN（gh 用）；GITHUB_RUN_ID 是这一跑，跳过它自己。
#
# 挑哪一跑：主干上 push 触发、已经跑完的 check.yml 运行记录，从新到旧最多看 20 跑，取第一跑「名字以『变异（第』起头、
# 结论是 success 的 job 恰好 <份数> 个」的。从那几个 job 的日志里摘出带 `MUTATION_COST_JSON ` 的行，原样写在输出文件第一行之后；
# 日志按文本摘（`grep -a`）：日志里夹一个 NUL 字节时 grep 会当它是二进制文件、不吐原行，却仍以 0 退出。
# 第一行是一行 JSON：{"schema":"main-mutation-costs/v1","run":<运行编号>,"headSha":"<提交>"}。
# 取不到（列不出运行记录、20 跑里没有一跑各份都绿、某份日志取不下来或摘不出那一行）时第一行写
# {"schema":"main-mutation-costs/v1","unavailable":"<为什么>"}，后面什么都不写，照样以 0 退出 ——
# 取不到算不算红、分份怎么办，由读它的 `shard-load-rule.ts` 的 `mainCostWeights` 与两个入口定，这里不判。
# 这里只挑、只摘：报告的形状、几份是不是同一个提交、份与份有没有重叠，都由 `mainCostWeights` 核。
# 用法错（少参数、缺环境变量、没有 jq 或 gh）以 2 退出，这一跑红在这一步。
set -uo pipefail

out=${1:-}
shards=${2:-}
if [ -z "$out" ] || ! [[ $shards =~ ^[1-9][0-9]*$ ]]; then
  echo "用法：bash scripts/check/main-costs.sh <输出文件> <份数>" >&2; exit 2
fi
if [ -z "${GITHUB_REPOSITORY:-}" ]; then echo "要 GITHUB_REPOSITORY（形如 owner/name）" >&2; exit 2; fi
for tool in gh jq grep; do command -v "$tool" > /dev/null || { echo "找不到 $tool" >&2; exit 2; }; done
repo=$GITHUB_REPOSITORY
self=${GITHUB_RUN_ID:-}
mkdir -p "$(dirname "$out")" || exit 2

none() {
  jq -nc --arg why "$1" '{schema: "main-mutation-costs/v1", unavailable: $why}' > "$out" || exit 2
  echo "::warning title=主干实测::取不到主干上一跑的变异实测（$1）"
  exit 0
}

runs=$(gh api "repos/$repo/actions/workflows/check.yml/runs?branch=main&event=push&status=completed&per_page=20" \
         --jq '.workflow_runs[] | "\(.id) \(.head_sha)"') || none "列不出主干上的运行记录"
body=$(mktemp) || exit 2
while read -r id sha; do
  [ -n "$id" ] && [ "$id" != "$self" ] || continue
  jobs=$(gh api "repos/$repo/actions/runs/$id/jobs?per_page=100" \
           --jq '[.jobs[] | select(.name | startswith("变异（第")) | select(.conclusion == "success") | .id | tostring] | join(" ")') \
    || none "读不出 run $id 的 job 列表"
  read -r -a ids <<< "$jobs"
  [ "${#ids[@]}" = "$shards" ] || continue
  : > "$body"
  for job in "${ids[@]}"; do
    gh api "repos/$repo/actions/jobs/$job/logs" | grep -aF 'MUTATION_COST_JSON ' >> "$body" \
      || none "run $id 的 job $job：日志取不下来，或里面没有成本报告那一行"
  done
  { jq -nc --argjson run "$id" --arg sha "$sha" '{schema: "main-mutation-costs/v1", run: $run, headSha: $sha}' && cat "$body"; } > "$out" || exit 2
  echo "主干实测：取自 run $id（提交 ${sha:0:7}）的 $shards 份变异"
  exit 0
done <<< "$runs"
none "主干最近 20 跑里没有一跑 $shards 份变异都绿"
