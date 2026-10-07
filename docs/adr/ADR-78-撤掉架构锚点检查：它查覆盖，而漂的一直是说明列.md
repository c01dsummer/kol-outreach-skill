# ADR-78 撤掉架构锚点检查：它查覆盖，而漂的一直是说明列

- 2026-09-18 · 按 Bitter Lesson 原则重整检查链，逐道评定里的第四道
- 类型：缩范围（撤一道闸门）
- 冲击的需求：无 —— `docs/requirements.json` 里没有判据认领它，也没有一条变异指向它
- 结论：**撤 `arch-sync.ts`（156 行）**，`docs/ARCHITECTURE.md` 原样留下当文档，
  但把它对读者的那几句保证改成实话

## 撤它那天，它正绿着，而它守的那张表上有两个数是错的

这不是从记录里抄来的，是撤它的时候顺手量的：

| 这一页上写着 | 实测 |
|---|---|
| 「递归收出验证基础设施闭包（**实测 14 个**）」 | **13 个** |
| 「只扫第一条，闭包从 14 个缩到 **3 个**」 | 只走 `import` 是 **5 个** |

同一句话在 `verifier-rule.ts` 与 `mutate-rule.ts` 的注释里还有两份副本，一起错。
**而 `npm run arch` 那一刻是绿的。**

原因不难懂，`arch-sync.ts` 自己的注释就承认了：它查的是**覆盖**（磁盘上的模块都在表里、
表里的模块都在磁盘上）、**编号有效**（引用的需求编号真实存在）、**绑定**（顺序契约那行
写出了守它的变异）。这三样都是**关系**。而一张表里最会骗人的是**说明列** ——
那一列写的是「这个模块保证什么」，是散文，没有任何机器读得懂它还对不对。

ADR-12 记着四次真实漂移，逐条读下来**四次漂的全是说明列，四次全是人或评审发现的，
`arch` 一路全绿**。加上这次量出来的两个数，是五次。

真阳性 **0**。

## 斜率

「表里的模块和磁盘上的文件对不对得上」是个**关系**问题 —— 一个能把仓库读一遍的
上下文顺手就答了，不需要一道闸门替它记账。模型再强一档，这道检查的边际价值是**跌**的。

而说明列是**语义**问题，它恰恰是模型越强越答得好的那一类 —— 但那不是这道闸门在做的事，
它从来就没查过。**撤掉的是那个查得了的、不重要的一半；查不了的那一半本来就没人查。**

## 三件事的去向，逐件说清

1. **ANCHORS 双向覆盖** → 撤。判决点名的就是它
2. **「变异编号重复」前置检查** → **不用挪，`mutate.ts` 早就有了**。
   `mutate.ts` 第 83 行调 `attributionFault`，查的是同一件事。
   arch 当初要抢在前面拦一道，是因为它排在 `mutate` 之前、按编号建 Map（重名只留最后一条），
   不先拦下就会指着另一条变异报错。**它一撤，这个理由自动没了** ——
   `mutate` 那条真正的诊断反而轮得上说话
3. **ORDER 表绑变异** → **跟着一起没了，这里不含糊**。`mutate.ts` 不读
   `ARCHITECTURE.md`，所以「每条顺序契约都写出了守它的变异」从今天起没有机器核。
   要把它捡回来是另起一道闸门、另开一条 PR 的事，本条不做

## 文档那几句保证改成了实话

`ARCHITECTURE.md` 开头原先写「下面两张表由 `npm run arch` 校验……**新增模块不登记，
CI 会红**」。撤了闸门还留着这句，文档就从「被核过的」变成「**声称**自己被核过的」，
比没有保证更坏。

改掉的一共五处，其中两处藏在 HTML 注释里（`BEGIN:ANCHORS` / `BEGIN:ORDER` 的标记文字）——
**那正是 ADR-43 那条教训说的「副本的措辞常常不一样，按记忆搜必漏」**，
这次是靠逐字 grep `npm run arch` 才捞出来的。

锚点表上方加了一句：**当索引读，别当证据读。**
`AGENTS.md` 那句「不登记 `npm run arch` 会红」也改了 —— 它是全仓唯一一处对新人做这个承诺的话。
`docs/SYNC.md` 三行的「机器检查」列跟着改。

顺带把那两个漂了的数订正成实测值（撤 arch 之后闭包 12、只走 import 5），四处副本一起改。

## 什么条件下重开这个讨论

- **锚点表真的开始骗人时**：出现一次「表里写着的模块磁盘上没有」或反过来，
  而且是靠人翻出来的。那说明关系这一层也开始失守了，值得重装 ——
  但重装的话**要连说明列一起想办法**，否则装回来的还是这一次撤掉的东西
- **顺序契约那张表出现一次没有变异守着的行**，而且它真的坏了。
  那时该做的不是重开 arch，是把「ORDER 表每行绑一条变异」接进 `mutate.ts`
  （它本来就读 `mutations.json`），让绑定和变异跑在同一个地方

**谁去数**：没有机器在数了。下一个改锚点表的人自己核 —— 这是有意的，也是本条要说的事。

> ⚠️ 欠条：**顺序契约与变异的绑定从今天起没人守。** ORDER 表每行写着「守它的变异是
> M-xx-x」，而那条变异删掉、改名、或者 `file` 挪到别处，都不会有任何东西红。
> 本条不修：修法是把这条判据接进 `mutate.ts`，那是另一道闸门的活。
> · 重启条件：**下一条改 `ARCHITECTURE.md` 顺序契约表、或删改 ORDER 表点名的那些变异的 PR**。

> ⚠️ 复核发现（2026-10-07，#266 合入后复核顺序契约表时顺带查到 · 档：登记 · 去向：本块，并登记下面两块欠条）：上面那张欠条只写了点名的变异「删掉、改名、或者 `file` 挪到别处」，重启条件也只管「下一条改 `ARCHITECTURE.md` 顺序契约表、或删改 ORDER 表点名的那些变异的 PR」。有两件它没写到。
>
> 一是**漏列**。往某一行「位置」里的文件新增守那一行的变异、却不碰顺序契约表时，重启条件的两半都不响，也没有检查会红。ADR-132 第九节「复核发现三」就是这一种（那一行已在 #274 补列）。这一种机器判不了：一条变异算不算守某一行，要看施加之后的后果；`file` 落在位置里，只说明它是候选。
>
> 二是**按字面规则已经不合的行**。顺序契约节首要求点名的变异存在、且指向该行的位置。按字面核（`file` 要在该行「位置」那一栏里），树 `5e4e43c` 与 `cf5d63a` 上都是这四行不合：「任务级品牌输入原样校验…」那一行的 M-D20-e（`scripts/lib/task.ts`）；「算分 → 基础分层…」那一行的 M-D21-w、x（`scripts/lib/score.ts`）；「三个入口读旧名单…」那一行的 M-U9-x、y、z（`scripts/lib/pipeline.ts`）；「render 当前 Agent／人工投影…」那一行的 M-U9-o（`scripts/lib/task-reviews.ts`）与 M-U9-y（`scripts/lib/pipeline.ts`）。是「位置」那一栏漏写了文件，还是变异指错了地方，这里没有逐行判。
>
> 另记一个事实：从本条（`8eef246`）起按 main 的第一父链数，改过 `BEGIN:ORDER` 与 `END:ORDER` 之间内容的提交，到 `5e4e43c` 有 21 个，到 `cf5d63a` 有 22 个（多出的是 #274），每一个都触发了上面那张欠条的重启条件。到 `5e4e43c` 为止，`docs/adr/` 里写明不重装的只有 ADR-94；#274 在 ADR-132 末尾也写明了这一次不还。
>
> 复核命令在仓库根目录跑，不抄输出；本块的事实是在 `5e4e43c` 与 `cf5d63a` 两棵树上各跑一遍得到的（字面规则那条读工作区里的两个文件，换树时把这两个文件换成那棵树的版本）：
>
> - 字面规则：`node -e "const fs=require('fs');const md=fs.readFileSync('docs/ARCHITECTURE.md','utf8');const t=md.slice(md.indexOf('BEGIN:ORDER'),md.indexOf('END:ORDER'));const ms=require('./scripts/check/mutations.json').mutations;const by=new Map(ms.map(m=>[m.id,m]));const n=s=>[...s].reduce((a,c)=>a*26+c.charCodeAt(0)-96,0);for(const l of t.split('\n').filter(l=>l.startsWith('| ')&&l.startsWith('| 顺序契约 |')===false)){const c=l.split(' | ');const pos=[...c[1].matchAll(/\x60([^\x60]+)\x60/g)].map(m=>m[1]);const ids=[];for(const m of c[3].matchAll(/(M-[A-Z]+\d+)-([a-z]+)(?:\s*[…–]\s*([a-z]+))?/g)){if(m[3]===undefined){ids.push(m[1]+'-'+m[2]);continue}for(const x of ms){const i=x.id.lastIndexOf('-');const k=n(x.id.slice(i+1));if(x.id.slice(0,i)===m[1]&&k>=n(m[2])&&k<=n(m[3]))ids.push(x.id)}}const bad=ids.filter(id=>by.has(id)===false||pos.includes(by.get(id).file)===false).map(id=>id+'→'+(by.has(id)?by.get(id).file:'不存在'));if(bad.length)console.log(c[0].slice(2,24)+'…：'+bad.join(' '))}"`
> - 改过顺序契约表的提交数（`<树>` 换成要核的提交）：`for h in $(git log --first-parent --format=%h 8eef246..<树> -- docs/ARCHITECTURE.md); do a=$(git show $h^:docs/ARCHITECTURE.md | sed -n '/BEGIN:ORDER/,/END:ORDER/p' | git hash-object --stdin); b=$(git show $h:docs/ARCHITECTURE.md | sed -n '/BEGIN:ORDER/,/END:ORDER/p' | git hash-object --stdin); [ "$a" = "$b" ] || echo $h; done | wc -l`

> ⚠️ 欠条：顺序契约表每一行点名的守护变异，只在有人改那一行的时候是全的；新增守某一行的变异却不点名，没有东西提醒；ADR-132 第九节「复核发现三」记的就是一例 · 重启条件：再查出一行漏列了守它的变异时，把全表逐行按后果核一遍

> ⚠️ 欠条：上面四行按字面规则不合，没有判是「位置」那一栏漏写还是变异指错 · 重启条件：下一条改这四行中任一行的 PR，先判那一行，改对了在本条末尾追加一块
