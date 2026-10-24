# 回归检查：改了 `skill/` 的判断类文字以后，产出有没有变差

检查链只管 `scripts/` 的机械劳动。`skill/` 里的判断（语义评审、开发信）改完以后产出变没变差，
检查链答不了；这份是答这一问的手工流程。机器只管产出，人读、人判；不进 CI，不是闸门。
为什么这样定、为什么先写办法不先跑、它在回路里是哪一段，见 ADR-159。

下面九节对应 a 到 i 九项。每次跑的结果只进那条改 `skill/` 的 PR 正文，不另建台账。

---

## a　能答什么，答不了什么

**能答**：改了 `skill/` 的判断类文字以后，在 3–5 个固定的真实任务上，产出有没有变差。

**答不了**：

- **变好了没有。** 任务只有几个，又是改文字的这一方挑的；新版在它们上面看着更好，
  分不出是改对了，还是改得正好合这几个任务（ADR-159 第三节）。所以判词里「看着更好」只记录、不当证据（g）。
- **开发信的真实效果。** 只有真发信才知道。`AGENTS.md`「目前已知的缺口」第三行照旧留着。

---

## b　冻结集

### 挑哪几个任务

3–5 个真实任务目录，由需求所有者指定（不进仓库，只在他的机器上）。优先挑这两种：

- 人工复评与 Agent 判断对不上的：`manual-feedback.csv` 的 `manual_eligible`、`manual_adopted`
  与 `agent-review.json` 里的判断不一致。render 交出的 `meta.json` 里 `feedback_summary.disagreements`
  列着这些账号，报告里「Agent 原记录与人工分歧」那一栏也有。
- 有处在边上的账号的：合格性或采用建议是「待核实」「备选」的。

这样挑有偏向：挑的正是旧版被人判得不对的地方，新版更容易显得好。这是 g 里「看着更好」只记录的又一个理由。

### 冻结哪些，不冻结哪些

Phase 04、06 与 render 读的输入冻结；要重新产出的不冻结；会把旧判断或人工作答漏给重跑的那一方的，不进冻结集。

| 任务目录里的文件 | 处理 | 为什么 |
|---|---|---|
| `task.json` | 冻结 | 任务配置、品牌校准、搜索进度与费用账；Phase 04 读校准，render 读其余 |
| `creators.raw.json` | 冻结 | 采集原件：bio、作品证据 |
| `agent-review.json` | 冻结 `version` 与 `rounds`，**清空 `reviews`** | `rounds` 是冻结的候选池、来源与时间；`reviews` 是旧判断与旧草稿，正是要重新产出的 |
| `creators.json` | 清空 `reviews` 后离线 render 一次，冻结重建出来的那份 | 原件里带着旧判断的投影（`fit_reason`、草稿等）；不重建，Phase 04 读名单时就读到了旧结论 |
| `kol.csv`、`kol.xlsx`、`report.html`、`meta.json` | 不冻结 | 交付物，每一跑由 render 重新产出 |
| `enrichment.json` | 不进冻结集 | Phase 05 不在比对范围；它只给旧判断为 ✅、⚠️ 的候选取过数，留着就等于告诉重跑的一方旧版判了谁 |
| `manual-feedback.csv` | 不进冻结集，只留在原件里 | 人工作答；重跑的一方读到就不盲了。判的人只读 f 单独拷出的原件副本 |

两个坑（ADR-159 第五节的演练里都踩出来过）：

1. **别整份删掉 `agent-review.json`，只清空 `reviews`。** 整份删掉，render 会重新冻结一轮候选，
   时间变成这一跑的时间；名单里只存着旧式 `fit`、理由和草稿的老任务，render 还会把它们当判断迁回来
   （`skill/references/semantic-fit.md`「判断保存在哪里」：只有正本缺席时才迁入）。
2. **别在需求所有者自己那份工作目录里跑 render，也别把 `memory/` 拷进 worktree。**
   render 读写当前目录下的 `memory/creators.json`（`scripts/lib/memory.ts`）：在自己那份目录里跑，
   推荐记录会写进真的跨任务记忆；把真记忆拷进 worktree，冻结集又改了名，原任务推荐过的人
   会被当成「这个产品在别的任务里推荐过」滤掉。新 worktree 里本来没有 `memory/`，就让它没有。

### 怎么冻

在需求所有者自己那份工作目录的根下（`output/` 不进仓库）。`<名字>` 是这个冻结集的名字，`<原任务>` 是原任务目录名：

选入的原任务须保留实际搜索配置与已保存的评审正本。当前 render 先校验 `task.json`：它须是可读 JSON 对象，`tasks` 须是非空数组，各项的 keyword、dimension、platform 满足原规则；重复键、品牌输入、进度、正本与冻结来源也照生产校验。下面任一次 render 被拒绝，就停止这个任务的冻结或比对，保留诊断；不能跳过校验，也不能补空列表、猜任务、删坏字段或编造轮次让它通过。由需求所有者按原搜索配置或备份恢复有据的输入后重新冻结；无法恢复就换他指定的另一个任务。原件不因这套流程被修写。

冻结名字必须全新。冻结名和原任务名都只用一个非空目录名，不能是 `.`、`..`，也不能含 `/` 或 `\`；避免把冻结目录建进原任务树。冻结根目录用不带 `-p` 的 `mkdir` 一次创建；路径已存在（包括已有目录或链接）就失败并停止这一整段，不覆盖、不复用，也不删除旧证据来腾名字。失败后新建的目录同样保留，重试换一个新名字。

原任务树只接受普通文件和目录；复制前检查整棵树，遇到符号链接（包括目录链接、断链）或其他文件类型就停止。不能让冻结副本里的链接继续指向原件，再沿链接清空或改写原件。

原件按字节复制后，在清空 `reviews` 或作任何 JSON 改写之前，先对这份尚未改写的原正本调用现有 `readAgentReviewDocument`。严格读取拒绝时保留其诊断并停止；正本缺席同样停止，不把 reader 返回的缺席空文档当成已保存原件。不能先用普通 `JSON.parse`/`JSON.stringify` 洗过，再拿洗后的结果验证。以下整段在独立 Bash 子 shell 中执行，任一失败就停止，不继续后文。

```bash
bash <<'FREEZE'
set -euo pipefail
N='<名字>'; O='<原任务>'
T="output/$O"
F="output/$N"
# 复制之前拒绝链接与特殊文件，不跟随它们进入原件
node --input-type=module - "$T" "$N" "$O" <<'TREE'
import { lstatSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
for (const name of process.argv.slice(3)) {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw Error('冻结名和原任务名必须是非空单目录名，停止冻结')
  }
}
function plainTree(file) {
  const stat = lstatSync(file)
  if (!stat.isFile() && !stat.isDirectory()) throw Error(`任务输入只接受普通文件和目录，停止冻结：${file}`)
  if (stat.isDirectory()) for (const name of readdirSync(file)) plainTree(join(file, name))
}
plainTree(process.argv[2])
TREE
# 1. 原件：原子创建全新冻结根；已存在就停止，不复用
mkdir "$F"
mkdir "$F/source" "$F/frozen"
cp -a "$T"/. "$F/source/"
# 2. 任何 JSON 改写前，用现有严格 reader 核原件，拒绝即停
node --import tsx --input-type=module - "$F/source" <<'NODE'
import { readAgentReviewDocument } from './scripts/lib/review.ts'
try {
  const read=readAgentReviewDocument(process.argv[2])
  if(read.status!=='present') throw Error(`${process.argv[2]}/agent-review.json 缺席，停止冻结`)
} catch(error) {
  console.error(error instanceof Error?`${error.name}: ${error.message}`:String(error))
  process.exitCode=1
}
NODE
# 只有严格 reader 接受未改写的原件后，才生成并改写冻结副本
cp -a "$F/source"/. "$F/frozen/"
rm -f "$F/frozen"/{kol.csv,kol.xlsx,report.html,meta.json,enrichment.json,manual-feedback.csv}
node -e 'const fs=require("fs"),f=process.argv[1],d=JSON.parse(fs.readFileSync(f,"utf8"));d.reviews={};fs.writeFileSync(f,JSON.stringify(d,null,2)+"\n")' "$F/frozen/agent-review.json"
# 3. 在一个临时 worktree 里离线 render 一次，重建名单投影（不在自己这份目录里跑，见上面第 2 个坑）
P="../reg-prep-$N"
git worktree add --detach "$P" '<旧版提交>'
(cd "$P" && npm ci)
mkdir -p "$P/output/$N"
cp -a "$F/frozen"/. "$P/output/$N/"
(cd "$P" && env -u TIKHUB_API_KEY npm run render -- --dir "output/$N")
cp "$P/output/$N/task.json" "$P/output/$N/creators.json" "$P/output/$N/agent-review.json" "$F/frozen/"
# 4. 核：从原件的 agent-review.json 里挑三五句旧理由、旧草稿的开头，冻结集里一处都不该有
if grep -rF -- "<一句旧理由>" "$F/frozen/"; then
  echo "冻结集仍带旧判断，停止" >&2
  exit 1
else
  status=$?
  [ "$status" -eq 1 ] || exit "$status"
fi
# 5. 清单
(cd "$F" && find source frozen -type f -exec shasum -a 256 {} + | LC_ALL=C sort) > "$F/MANIFEST.sha256"
FREEZE
```

第 4 步搜到了就停：说明还有地方带着旧判断，先找出是哪份文件、补进上面那张表，换全新名字再冻。
`<旧版提交>` 见 d。第 3 步 render 会改 `task.json` 里的 `memory_status` 与 `updated_at`，不动费用账。

五个 worktree 的名字都带本任务的冻结名；每个任务换全新的冻结名，连续处理任务时就不会复用已登记的路径。已有 worktree 或失败留下的目录同样保留，失败即停，重试换全新冻结名。下文的 `reg-old1`、`reg-old2`、`reg-old3`、`reg-new` 是跑次代号，实际目录各带 `-<名字>` 后缀。

---

## c　重跑什么

只重跑 Phase 04 语义评审、Phase 06 开发信草稿，以及不发请求的 render。不跑 collect，不跑 enrich。

- **环境里不放任何出网凭据**（现在只有 `TIKHUB_API_KEY`）：从一个去掉它的 shell 起 Agent，
  比如在 worktree 根下 `env -u TIKHUB_API_KEY <Agent 的命令>`。
- **worktree 根下不放 `.env`**：`collect`、`enrich`、`render`、`calibration`、`feedback-template` 与两条 `probe` 命令都带 `--env-file-if-exists=.env`；`.env` 不进仓库，新 worktree 本来没有，别复制。
- 这样任何请求企图都在发送前失败（`902e63e` 上 `scripts/providers/tikhub.ts` 第 163 行：没有 key 就抛错，不发请求）。render 本身不发请求。
- **Agent 问要不要跑 Phase 05（查公开指标）时，答「不跑」**，每一跑答话一字不差。Phase 05 不在比对范围；没有 key 它也发不出请求，可跑没跑、怎么失败会变成几跑之间多出来的差别。
- **跑完核一遍费用账没变**：每一跑的 `task.json` 里 `cost_ledger` 与冻结集里的内容及原始数字记号相同；缺席不等于零。先确认该跑的 render 成功；被输入校验拒绝的，不算完成一跑，也不继续下判词。

```bash
bash <<'COST'
set -euo pipefail
N='<名字>'
for run in reg-old1 reg-old2 reg-old3 reg-new; do
node - "output/$N/frozen/task.json" "../$run-$N/output/$N/task.json" <<'NODE'
const fs=require('fs'),assert=require('assert/strict')
class NumberToken {
  constructor(raw) {
    if(typeof raw!=='string') throw Error('当前 Node 不能保留 JSON 数字原文，停止核对')
    this.raw=raw
  }
}
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'),(_k,v,c)=>typeof v==='number'?new NumberToken(c?.source):v)
const [a,b]=process.argv.slice(2).map(read)
const present=o=>Object.hasOwn(o,'cost_ledger')
assert.equal(present(a),present(b),'费用账的缺席状态变了')
if(!present(a)) console.log('两份费用账均缺席；只确认仍缺席，金额无从确认')
else {
  assert.deepStrictEqual(a.cost_ledger,b.cost_ledger,'费用账内容或数字原文变了')
  console.log('费用账内容及数字原文未变')
}
NODE
done
COST
```

---

## d　新旧两版

- **旧版**：开 PR 时的改动前主干基准。开 PR 时，在 head 后来合入新主干之前，用 `git merge-base origin/main '<开 PR 时的 head 提交>'` 一次取得 SHA，并把它记在 PR 正文里；之后的每一跑都检出这个固定 SHA，不随 `origin/main` 前移或 head 同步主干而重算。**新版**：本次比较开始时记录的 PR head SHA。四跑都用这两个固定提交。
- **每一跑一个 worktree**，各自只读自己的 `skill/`：`.claude/skills/kol-outreach`、`.agents/skills/kol-outreach`
  两条软链在 git 里，指向本 worktree 的 `skill/`（`docs/ARCHITECTURE.md`「新东西落在哪个目录」）。Agent 在 worktree 根下起。
- **每个任务四跑：旧版三跑、新版一跑。** 旧版前两跑量噪声（e），第三跑与新版配成新旧对（f）。新旧对不用噪声对里的那两跑：
  判的人先看过噪声对，新旧对里要是又出现其中一跑，草稿逐字认得出，就知道另一边是新版，盲比就不盲了。
- 四跑用同一个 Agent、同一个模型版本。模型版本不同，差别里就混着模型那一份：不下判词，照实写进 PR 正文（ADR-159 第四节）。
- **共用判据先定。** 第 f 节的形状和占位符参照默认取上述固定旧版提交；在四跑、量噪声之前记录这一共同提交及两份参照内容的 SHA256。若本次就是要改这两项承诺，先由需求所有者指定同一份共同参照及适用范围，固定提交和内容后才跑；未定就停，不给 A、B 各用自己的版本，也不随主干移动或看过结果后换标准。

```bash
bash <<'RUNS'
set -euo pipefail
N='<名字>'
git worktree add --detach "../reg-old1-$N" '<旧版提交>'
git worktree add --detach "../reg-old2-$N" '<旧版提交>'
git worktree add --detach "../reg-old3-$N" '<旧版提交>'
git worktree add --detach "../reg-new-$N"  '<新版提交>'
for w in reg-old1 reg-old2 reg-old3 reg-new; do
  (cd "../$w-$N"; npm ci)
  mkdir -p "../$w-$N/output/$N"
  cp -a "output/$N/frozen/." "../$w-$N/output/$N/"
done
RUNS
```

- **冻结集拷到每个 worktree 的同一个相对路径 `output/<名字>/`。** 任务号取的是目录名；路径一样，产出里就不会因为目录名不同漏出是哪一跑。
- **四跑的先后随机排。** 产出里有这一跑的时间（评审时间、`task.json` 的 `updated_at`），先后固定的话，时间就漏出哪份是新版。
  `node -e 'console.log(["reg-old1","reg-old2","reg-old3","reg-new"].sort(()=>Math.random()-0.5).join(" "))'`
- **每一跑给 Agent 的话一字不差**，像用户真会说的话，不出现「评测」「打分」这类字眼。比如：

  > `output/<名字>` 这批候选帮我重新筛一遍，A 级的写好开发信，出名单和报告。不用再采集，也不用查公开指标。

---

## e　先量噪声

- 同一个旧版对同一个冻结集跑两次（`reg-old1`、`reg-old2`），两份产出照 f 的办法比。这时看到的差别，就是这套办法分不出的范围。
- 新旧对比里，不大于这个范围的差别，记「没看出差别」。
- **范围量完写下来，看过新旧结果以后不改**（RRSI 的做法）：先判噪声那一对，把范围写进那条 PR 正文「回归检查」一节，
  按 f 那六步逐步写（比如「第 1、2 步没差别；判断：14 个账号里 2 个采用建议不同；草稿措辞全都不同，引用的作品相同」）；
  写完再看新旧那一对。之后要补，另起一段注明时间，不改原来那段。

---

## f　盲比

**改名与密封**。四跑都跑完后，每个任务配两对：噪声对（`reg-old1`、`reg-old2`），新旧对（`reg-old3`、`reg-new`）。
每对只拷交付物，A、B 两边随机分；对应关系先写进密封文件，再判。`<名字>-compare` 已经有了就换个名字，不覆盖（`sealed.txt` 是只读的，旧拷贝也会混进来）：

```bash
bash <<'COMPARE'
set -euo pipefail
C='output/<名字>-compare'
R='<共同参照提交的完整40位SHA>'
mkdir "$C"
node -e '
const fs=require("fs"),c=process.argv[1],n=process.argv[2]
const r=process.argv[3],crypto=require("crypto"),cp=require("child_process")
if(!/^[0-9a-f]{40}$/.test(r)||cp.execFileSync("git",["cat-file","-t",r],{encoding:"utf8"}).trim()!=="commit") throw Error("共同参照须为事前固定的提交")
const members=[],absent=[]
for(const dir of ["inputs","references","feedback"]) fs.mkdirSync(`${c}/common/${dir}`,{recursive:true})
function copyPlain(from,name,optional=false){
  let stat
  try{stat=fs.lstatSync(from)}catch(error){if(optional&&error.code==="ENOENT"){absent.push(name);return}throw error}
  if(!stat.isFile()) throw Error(`只读资料不是普通文件：${from}`)
  fs.copyFileSync(from,`${c}/common/${name}`,fs.constants.COPYFILE_EXCL)
  fs.chmodSync(`${c}/common/${name}`,0o400);members.push(name)
}
for(const dir of ["frozen","source"]) if(!fs.lstatSync(`output/${n}/${dir}`).isDirectory()) throw Error("冻结目录缺席或不是目录")
for(const file of ["task.json","creators.raw.json","agent-review.json","creators.json"]) copyPlain(`output/${n}/frozen/${file}`,`inputs/${file}`,file==="creators.raw.json")
copyPlain(`output/${n}/source/manual-feedback.csv`,"feedback/manual-feedback.csv",true)
for(const file of ["output-format.md","outreach-draft.md"]){
  fs.writeFileSync(`${c}/common/references/${file}`,cp.execFileSync("git",["show",`${r}:skill/references/${file}`]),{flag:"wx",mode:0o400})
  members.push(`references/${file}`)
}
fs.writeFileSync(`${c}/common/ABSENT.txt`,absent.sort().join("\n")+"\n",{flag:"wx",mode:0o400});members.push("ABSENT.txt")
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
fs.writeFileSync(`${c}/common/MANIFEST.sha256`,members.sort().map(name=>`${hash(`${c}/common/${name}`)}  ${name}`).join("\n")+"\n",{flag:"wx",mode:0o400})
const pairs={noise:["reg-old1","reg-old2"],change:["reg-old3","reg-new"]}
const files=["agent-review.json","creators.json","kol.csv","kol.xlsx","report.html","meta.json"]
const seal=[`reference=${r}`,`common_manifest_sha256=${hash(`${c}/common/MANIFEST.sha256`)}`]
for(const [name,two] of Object.entries(pairs)){
  if(Math.random()<0.5) two.reverse()
  ;["A","B"].forEach((side,i)=>{
    fs.mkdirSync(`${c}/${name}/${side}`,{recursive:true})
    for(const f of files) fs.copyFileSync(`../${two[i]}-${n}/output/${n}/${f}`,`${c}/${name}/${side}/${f}`)
  })
  seal.push(`${name} A=${two[0]} B=${two[1]}`)
}
fs.writeFileSync(`${c}/sealed.txt`,seal.join("\n")+"\n",{mode:0o400})
' "$C" '<名字>' "$R"
shasum -a 256 "$C/sealed.txt"
COMPARE
```

- 判之前，把 `sealed.txt` 的 SHA256 写进那条 PR 正文；判完、判词写下以后才打开它。打开时再算一次，对得上才算数。
- 改名和密封由跑的一方做，判词仍由需求所有者写。四跑执行与密封由另一方负责（可由 Agent 承担）；判方不参与四跑执行，不接触带版本或跑次标签的执行顺序、执行日志和目录对应关系，也不看 worktree、`source/` 整树与 `sealed.txt`。判方只读共用只读资料，并按下述次序读取两对交付物；已知这些对应关系时，这组四跑不具备盲判资格，保留事实、不下盲判词，是否重新安排全新四跑仍由需求所有者逐次决定。不得靠改写产出时间或删除冻结轮次时间把已知标签说成重新盲了。
- `common/inputs/` 逐字来自 b 完成时给四跑的同一份冻结输入；合法缺席的 `creators.raw.json` 保持缺席，不造文件。`common/references/` 是 d 事前固定的同一份参照，第 2、6 步都按它；`common/feedback/` 只给判方原人工反馈，原缺席仍缺席，不给四跑 Agent。共有资料不归 A/B，目录、文件名和说明不带版本、跑次或映射；来源提交只留密封记录。判前核公开清单及已记录的参照内容 hash，判后再核密封中的清单 hash；资料缺失（已明确的合法缺席除外）、不可读、清单或内容变动均保留诊断、不下判词，不去 worktree 补看。只读文件权限是防误写措施，不冒称隔离同一账号的保密屏障。
- **判的人一次看一对。** 先噪声对（e），再新旧对。

**核对顺序**。借 harness2 盲选的六步，有两处按本仓库改了（第 3 步、第 6 步对占位符的态度）：

1. **交付**：`agent-review.json` 与三种交付格式（`kol.csv`、`kol.xlsx`、`report.html`）都在；每个 A 级候选都有一封草稿。
2. **形状**：表头和列序照 `skill/references/output-format.md`；多出的、改了名的都算偏差。
3. **忠实**：每个说法都能在冻结输入里找到。没查到就写「未查询」、该留占位符就留占位符的那份更好（红线 P1、P2）。
4. **自洽**：计数和条目对得上。
5. **可用**：运营填完占位符就能用。
6. **收尾**：没人认领的 TODO、断链算缺陷；P2 和 `skill/references/outreach-draft.md` 要求留的占位符不算缺陷。
   harness2 原版把占位符一律算缺陷，这里反过来。

**判的人要把每份产出读完，不能只看评审结论。** harness2 论文附录 E.6 里，它的盲选把 95 分的那份淘汰、选了 55 分的那份。

---

## g　判词四档

每个任务的新旧对一个判词，由需求所有者判：

| 判词 | 什么时候用 |
|---|---|
| **变差** | 新版在 f 某一步上比旧版差，差得超出 e 量出的范围 |
| **没看出差别** | 差别都不超出 e 量出的范围 |
| **看着更好** | 只记录，不当证据（a）；冻结集按 b 那样挑，本来就偏向让新版显得好 |
| **混杂** | 一次改了几处，分不出差别出自哪一处 |

判词连同理由（哪一步、哪个账号、哪句话）写进那条改 `skill/` 的 PR 正文，不另建台账。

---

## h　什么时候跑

推荐只在改 Phase 04、06 的判断标准时跑：`skill/references/semantic-fit.md`、`skill/references/outreach-draft.md`，
以及 `skill/SKILL.md` 里 Phase 04、Phase 06 对应的段落。跑不跑由需求所有者定。不进 CI，不做成闸门。

---

## i　成本

- **模型调用**：每个任务四跑（旧版三跑、新版一跑，见 d），每跑一次 Agent 会话做完 Phase 04、06 与 render；合计「任务数 × 4」次会话。
- **API 费**：零。不发 TikHub 请求（c）。
- 判的人的时间：每个任务读两对产出。还没跑过真的，花多久没量过。
