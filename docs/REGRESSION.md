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
| `manual-feedback.csv` | 不进冻结集，只留在原件里 | 人工作答；重跑的一方读到就不盲了。判的人从原件读 |

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

```bash
N=<名字>; T=output/<原任务>
# 1. 原件：整份字节拷贝。以后原任务目录再怎么变，这份不动；判的时候从这里读人工作答
mkdir -p output/$N/source output/$N/frozen
cp -a "$T"/. output/$N/source/
# 2. 冻结集：从原件拷，去掉不冻结的，清空旧判断
cp -a output/$N/source/. output/$N/frozen/
rm -f output/$N/frozen/{kol.csv,kol.xlsx,report.html,meta.json,enrichment.json,manual-feedback.csv}
node -e 'const fs=require("fs"),f=process.argv[1],d=JSON.parse(fs.readFileSync(f,"utf8"));d.reviews={};fs.writeFileSync(f,JSON.stringify(d,null,2)+"\n")' output/$N/frozen/agent-review.json
# 3. 在一个临时 worktree 里离线 render 一次，重建名单投影（不在自己这份目录里跑，见上面第 2 个坑）
git worktree add --detach ../reg-prep <旧版提交>
(cd ../reg-prep && npm ci)
mkdir -p ../reg-prep/output/$N && cp -a output/$N/frozen/. ../reg-prep/output/$N/
(cd ../reg-prep && env -u TIKHUB_API_KEY npm run render -- --dir output/$N)
cp ../reg-prep/output/$N/{task.json,creators.json,agent-review.json} output/$N/frozen/
# 4. 核：从原件的 agent-review.json 里挑三五句旧理由、旧草稿的开头，冻结集里一处都不该有
grep -rF "<一句旧理由>" output/$N/frozen/
# 5. 清单
(cd output/$N && find source frozen -type f | sort | xargs shasum -a 256) > output/$N/MANIFEST.sha256
```

第 4 步搜到了就停：说明还有地方带着旧判断，先找出是哪份文件、补进上面那张表，再冻。
`<旧版提交>` 见 d。第 3 步 render 会改 `task.json` 里的 `memory_status` 与 `updated_at`，不动费用账。

---

## c　重跑什么

只重跑 Phase 04 语义评审、Phase 06 开发信草稿，以及不发请求的 render。不跑 collect，不跑 enrich。

- **环境里不放任何出网凭据**（现在只有 `TIKHUB_API_KEY`）：从一个去掉它的 shell 起 Agent，
  比如在 worktree 根下 `env -u TIKHUB_API_KEY <Agent 的命令>`。
- **worktree 根下不放 `.env`**：每条 npm 命令都带 `--env-file-if-exists=.env`；`.env` 不进仓库，新 worktree 本来没有，别复制。
- 这样任何请求企图都在发送前失败（`902e63e` 上 `scripts/providers/tikhub.ts` 第 163 行：没有 key 就抛错，不发请求）。render 本身不发请求。
- **跑完核一遍费用账没变**：每一跑的 `task.json` 里 `cost_ledger` 与冻结集里的逐字相同。

```bash
node -e 'const p=require("path"),r=f=>JSON.stringify(require(p.resolve(f)).cost_ledger);console.log(r(process.argv[1])===r(process.argv[2])?"费用账没变":"费用账变了")' output/<名字>/frozen/task.json ../reg-old1/output/<名字>/task.json
```

---

## d　新旧两版

- **旧版**：改动前的主干提交（那条 PR 的 base：`git merge-base origin/main <PR 的 head>`）。**新版**：PR 的 head。
- **每一跑一个 worktree**，各自只读自己的 `skill/`：`.claude/skills/kol-outreach`、`.agents/skills/kol-outreach`
  两条软链在 git 里，指向本 worktree 的 `skill/`（`docs/ARCHITECTURE.md`「新东西落在哪个目录」）。Agent 在 worktree 根下起。
- 每个任务三跑：旧版两跑（e 用）、新版一跑。三跑用同一个 Agent、同一个模型版本；模型换了，差别里就混着模型那一份，只能判「混杂」（g）。

```bash
git worktree add --detach ../reg-old1 <旧版提交>
git worktree add --detach ../reg-old2 <旧版提交>
git worktree add --detach ../reg-new  <新版提交>
for w in reg-old1 reg-old2 reg-new; do
  (cd ../$w && npm ci)
  mkdir -p ../$w/output/<名字> && cp -a output/<名字>/frozen/. ../$w/output/<名字>/
done
```

- **冻结集拷到每个 worktree 的同一个相对路径 `output/<名字>/`。** 任务号取的是目录名；路径一样，产出里就不会因为目录名不同漏出是哪一跑。
- **三跑的先后随机排。** 产出里有这一跑的时间（评审时间、`task.json` 的 `updated_at`），先后固定的话，时间就漏出哪份是新版。
  `node -e 'console.log(["reg-old1","reg-old2","reg-new"].sort(()=>Math.random()-0.5).join(" "))'`
- **每一跑给 Agent 的话一字不差**，像用户真会说的话，不出现「评测」「打分」这类字眼。比如：

  > `output/<名字>` 这批候选帮我重新筛一遍，A 级的写好开发信，出名单和报告。不用再采集。

---

## e　先量噪声

- 同一个旧版对同一个冻结集跑两次（`reg-old1`、`reg-old2`），两份产出照 f 的办法比。这时看到的差别，就是这套办法分不出的范围。
- 新旧对比里，不大于这个范围的差别，记「没看出差别」。
- **范围量完写下来，看过新旧结果以后不改**（RRSI 的做法）：先判噪声那一对，把范围写进那条 PR 正文「回归检查」一节，
  按 f 那六步逐步写（比如「第 1、2 步没差别；判断：14 个账号里 2 个采用建议不同；草稿措辞全都不同，引用的作品相同」）；
  写完再看新旧那一对。之后要补，另起一段注明时间，不改原来那段。

---

## f　盲比

**改名与密封**。三跑都跑完后，每个任务配两对：噪声对（`reg-old1`、`reg-old2`），新旧对（两跑旧版里随机挑一跑，配 `reg-new`）。
每对只拷交付物，A、B 两边随机分；对应关系先写进密封文件，再判：

```bash
C=output/<名字>-compare; mkdir -p $C
node -e '
const fs=require("fs"),c=process.argv[1],n=process.argv[2]
const old=Math.random()<0.5?"reg-old1":"reg-old2"
const pairs={noise:["reg-old1","reg-old2"],change:[old,"reg-new"]}
const files=["agent-review.json","creators.json","kol.csv","kol.xlsx","report.html","meta.json"]
const seal=[]
for(const [name,two] of Object.entries(pairs)){
  if(Math.random()<0.5) two.reverse()
  ;["A","B"].forEach((side,i)=>{
    fs.mkdirSync(`${c}/${name}/${side}`,{recursive:true})
    for(const f of files) fs.copyFileSync(`../${two[i]}/output/${n}/${f}`,`${c}/${name}/${side}/${f}`)
  })
  seal.push(`${name} A=${two[0]} B=${two[1]}`)
}
fs.writeFileSync(`${c}/sealed.txt`,seal.join("\n")+"\n",{mode:0o400})
' $C <名字>
shasum -a 256 $C/sealed.txt
```

- 判之前，把 `sealed.txt` 的 SHA256 写进那条 PR 正文；判完、判词写下以后才打开它。打开时再算一次，对得上才算数。
- 改名和密封由跑的一方做，判的人不看 `sealed.txt`，也不看 worktree。
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

- **模型调用**：每个任务三跑（旧版两跑、新版一跑），每跑一次 Agent 会话做完 Phase 04、06 与 render；合计「任务数 × 3」次会话。
- **API 费**：零。不发 TikHub 请求（c）。
- 判的人的时间：每个任务读两对产出。还没跑过真的，花多久没量过。
