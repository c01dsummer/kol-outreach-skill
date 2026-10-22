# ADR-156 Skill 结构五样关系一次报全：先合判定，软链认 git 记录

- 日期 · 2026-10-22 · 需求所有者交来的 harness 问题清单第 3 条（清单与照它改仓库的执行稿都不在仓库里；需求所有者同日在项目线程里说「11处都改」，照执行稿开工）。本条那条 PR 是第一片，只有判定
- 类型：不属于反向输入的几类 —— 改的是检查链自己，不触及需求登记表
- 触发它的事实：`skill/` 的五样结构关系（第二节）在 `dee799a` 上全成立，但没有一样有东西守：新加一份 reference 忘了在 `skill/SKILL.md` 里点名、改了 `package.json` 的命令名、挪了 `scripts/` 下的文件，都不会有东西变红。`git grep -n 'skill/' dee799a -- scripts/check/` 命中的全是注释与说明文字，没有一处读 `skill/`。harness2 的 `validate` 一次列出一个 skill 的全部结构问题、每条写成照着就能改的话，做法借它
- 冲击的需求：无。管的是检查链自己与 `skill/` 的结构
- 结论：采纳。新的纯判定 `scripts/check/skill-rule.ts` 按第二节核五样，一次返回全部问题，每条带文件、行号（有的话）、哪一样、一句怎么改。分两片（第六节）：本条这条 PR 是第一片，只有判定、测试与变异，没有入口调它；第二片加入口、接进 `npm run check`。人批痕迹是需求所有者合入本条那条 PR
- 理由：第一到第四节
- 连带改动：`scripts/check/skill-rule.ts`（新）；`scripts/test.ts` 新组 `h-skill-rule`；`scripts/check/mutations.json`；`scripts/check/launches.json`（派生）；`docs/ARCHITECTURE.md` 锚点表加一行；本记录及生成的索引。第二片另列（第六节）

---

## 一、为什么建、为什么是这个样子

五样都是「看两处对不对得上」：SKILL.md 点名的文件在不在、`package.json` 有没有这个命令名、索引里那个条目是不是指向 `skill/` 的软链。判据写得成一条命令，替代的是「跑」，照 `process/README.md`「替代『读』的那些不要建」那一段该建。

锚点表覆盖撤过（ADR-78），而第 3 样也是一种覆盖，所以要说清这里为什么建。ADR-145 第二十三节已按 ADR-87 回核过：ADR-78 撤它的理由（一个能把仓库读一遍的上下文顺手就答了）与 ADR-87 正相反。需求所有者 2026-10-13 定的「锚点表覆盖不建」（ADR-145 第 762 行）管的是锚点表，不管这里。这里另有一层锚点表没有的后果：

- `skill/SKILL.md` 是 Agent 的入口，Agent 经它才找到 reference。SKILL.md 没点名的 reference，Agent 不会去读；点了名却不在的，Agent 照着去读就扑空。
- `npm run <名字>` 是 Agent 照着在用户机器上跑的命令。名字对不上，这条路径第一次运行就在用户那里失败（`process/4-VERIFY.md`「未执行的路径」）。`scripts/….ts` 的路径同理。
- 两个软链是两个工具找到这个 Skill 的路（`docs/ARCHITECTURE.md`「新东西落在哪个目录」）。

锚点表漏一行，少的是给人看的一条索引。

**说明列不判。** SKILL.md「参考文档」表里「内容」那一栏写得对不对、一份 reference 的正文对不对，是读（ADR-78 说漂的一直是说明列），本条不查（第三节）。

**借 harness2 的两处**：一次列全，每条写成照着就能改的话；它的「skill 引用的脚本必须存在」就是第 5 样。问题清单原来只有前四样，本条多了三处，都便宜：第 2 样多查软链指向哪里（只查名字的话，指到别处的软链也算对）；第 4 样从 SKILL.md 里的命令扩到 `skill/` 下所有文档（reference 里同样写着要 Agent 跑的命令，`dee799a` 上 SKILL.md 里那 5 个命令名在 reference 里也都出现）；第 5 样是新加的。

## 二、判什么：五样的字面规则

**行**：正文按 `\n` 切，切出来的第一段是第 1 行。判「整行是 `---`」时先去掉行尾空白（含 `\r`）。别处的「空白」指 JavaScript 正则 `\s` 认的字符（含全角空格）；第 4 样的「一段空白」只认半角空格与制表符，见那一样。

**路径**：文档的路径都相对仓库根，写成 `skill/…`；点名原文（`references/…`、`scripts/…`）照文档里的写法。

### 第 1 样：SKILL.md 的 frontmatter

1. 输入的文档里没有路径为 `skill/SKILL.md` 的一份 → 「SKILL.md 不在」。第 2、3 样跟着不核。
2. **frontmatter** 是第 1 行与它下面第一个「整行是 `---`」的行之间的那些行。第 1 行不是 `---`、或者下面找不到这样一行 → 「没有 frontmatter」；第 2 样跟着不核。
3. **键行**：frontmatter 里顶格写的 `name` 或 `description`，后面可以有半角空格或制表符，再接一个半角冒号，冒号后面是空白或行尾（`name:x` 在 YAML 里不是键，这里也不算键行）。缩进的行不是键行。
4. frontmatter 里没有某个键的键行 → 「缺键」，点名那个键。
5. 同一个键有两行以上键行：从第二行起，每一行一条「键写了不止一次」，行号是那一行。
6. 每一行键行都判值是不是空白。值是冒号之后的那段：
   - **块写法**：那段去掉首尾空白后，是 `|` 或 `>`，后面跟着零到两个字符、每个是 `+`、`-` 或一位数字 `1`–`9`（YAML 的块标记）。值是键行下面的那些行，到第一行「行首是非空白字符」的行、或 frontmatter 结束为止；这些行全是空白、或者一行也没有，就是空白。
   - **不是块写法**：那段去掉首尾空白；以 `#` 开头算空白（YAML 的注释）；两端是同一种引号（`"` 或 `'`）、长度至少 2 的，去掉这一对，再去首尾空白；剩下空串就是空白。
   - 是空白 → 「值是空白」，行号是键行。
7. **`name` 的值**（第 2 样用）只在 `name` 恰好一行键行、而且不空白时才有：不是块写法的，就是上面去掉引号、去掉首尾空白后的那段；块写法的，是那些行逐行去掉首尾空白、丢掉空行，再用一个半角空格连起来。没有值时第 2 样不核。

### 第 2 样：两个软链

只在 `name` 有值、软链的输入读得到时核；按 git 索引判（第四节）。对 `.claude/skills` 与 `.agents/skills` 两个目录各核一次，期望的条目是 `<目录>/<name>`：

1. 索引里有路径恰好是它的条目：mode 不是 `120000` → 「不是软链」；是 `120000`、目标却不恰好是 `../../skill` → 「软链指错了」，点名目标原文。
2. 没有恰好是它的条目，但有路径以 `<目录>/<name>/` 开头的（那是一个目录）→ 「不是软链」。
3. 都没有 → 「没有软链」。

文件是期望的条目路径，没有行号。目录下名字不等于 `name` 的别的条目不判。

### 第 3 样：reference 都点了名、点了名的都在

只在 `skill/SKILL.md` 读得到正文时核。

1. **reference**：输入的文档里，路径以 `skill/references/` 开头、以 `.md` 结尾的每一份，含子目录；读不到正文的也算在。
2. **点名**：SKILL.md 全文（frontmatter、代码围栏都算）里的 `references/`，它前面一个字符不是英文字母、数字、`_`、`.`、`/`、`-`（或者它在行首），连同紧跟着的一串英文字母、数字、`_`、`.`、`/`、`-`；去掉这串末尾的 `.` 以后以 `.md` 结尾，就是一处点名，被点名的文档路径是 `skill/` 接上它。
3. 被点名的路径不是任何一份输入文档的路径 → 「点名了但文件不在」：文件是 `skill/SKILL.md`，行号是那一行，点名原文。
4. 一份 reference 的路径不在被点名的路径里 → 「文件在但没点名」：文件是那份 reference，没有行号，点名它该被点名的写法 `references/<相对路径>`。

### 第 4 样：npm 命令名

只在 `package.json` 的命令读得到时核；每一份读得到正文的输入文档（含 SKILL.md）都核，逐行找，不跨行，代码围栏里的也算。

1. **一处命令**：`npm`，它前面一个字符不是英文字母、数字、`_`、`-`（或者它在行首）；接一段空白、`run`；再接零个或几个参数，每个参数是「一段空白 + 一个 `-` 打头、不含空白与反引号的串」（比如 `--silent`、`-s`）；再接一段空白和命令名。这里「一段空白」是一个或几个半角空格或制表符。
2. **命令名**是一串字符：第一个不是 `-`；每一个都不是空白，也不是反引号、`'`、`"`、`(`、`)`、`<`、`>`、`|`、`&`、`;`、`,`、`，`、`。`、`、`、`；`、`：`、`（`、`）`、`「`、`」`。去掉末尾的 `.` 以后不能是空串，是空串就不算一处命令。
3. 命令名不是 `package.json` 里 `scripts` 的键 → 「没有这个命令」：文件是那份文档，行号是那一行，点名命令名。

### 第 5 样：脚本路径

只在 `scripts/` 的文件清单读得到时核；每一份读得到正文的输入文档都核。

1. **一处路径**：`scripts/`，它前面一个字符不是英文字母、数字、`_`、`.`、`/`、`-`（或者它在行首），连同紧跟着的一串英文字母、数字、`_`、`.`、`/`、`-`；去掉这串末尾的 `.` 以后以 `.ts` 结尾。
2. 不在 `scripts/` 的文件清单里 → 「脚本不在」：文件是那份文档，行号是那一行，点名路径原文。

### 第 0 类：输入读不到

不属于五样，`item` 记 0：

1. 文档清单读不到 → 一条，文件记 `skill/`；五样都不核。
2. 一份文档读不到正文 → 一条，文件是那份；它的第 4、5 样不核；是 `skill/SKILL.md` 的话，第 1、2、3 样也不核。
3. `package.json` 的命令读不到 → 一条，文件记 `package.json`；第 4 样不核。
4. `scripts/` 的文件清单读不到 → 一条，文件记 `scripts/`；第 5 样不核。
5. 软链的输入读不到 → 一条，文件记 `.claude/skills/、.agents/skills/`；第 2 样不核。

**有一样没核，返回值里就一定有一条问题。** 上面每一种「不核」都配着一条：第 0 类，或第 1 样的「SKILL.md 不在」「没有 frontmatter」「缺键」「键写了不止一次」「值是空白」。所以返回空只有一个意思：五样都核了、都成立。

### 先后、去重、怎么改

1. **先后**：按「哪一样」从小到大；同一样里按文件（逐个码点比），再按行号（没有行号的在前，小的在前），再按点名的东西（没有的在前，逐个码点比），最后按问题的种类名（逐个码点比）。和输入的先后无关。
2. **去重**：哪一样、种类、文件、行号、点名的东西都相同的两条只留一条（比如同一行写了两次同一个不在的命令名）。
3. **怎么改**：每条带一句照着就能改的话。措辞不算契约，契约只有三条：去掉首尾空白后不是空串；点名了东西的，这句话里原样出现它；第 2 样的三种，这句话里原样出现 `../../skill`。

## 三、不判什么

- **description 的长度上限。** 上限由加载 Skill 的工具定，不同工具、同一个工具的不同版本可以不一样，本仓库没有它的正本。照抄一个数进来，就是一张会过时的表，过时的时候它报绿。
- **SKILL.md 的总字数。** 多长算太长是判断，写不成一条命令。
- **reference 的正文**，以及 SKILL.md「参考文档」表的「内容」一栏：写得对不对是读（第一节）。
- **reference 之间的互相引用。** 写法不统一：`dee799a` 上有写 `references/memory.md` 的，有只写 `memory.md`、`tikhub.md`、`_interface.md` 的，还有 `../SKILL.md`。一套文法认不全，认不全的那部分报绿；Agent 找 reference 的入口是 SKILL.md，第 3 样管的就是那一处。
- **`npm run` 以外的写法**：`npm test`、`npm start`、`npm run-script`、`npx tsx …`。后一种里的 `scripts/….ts` 路径第 5 样照样核。
- **别的路径写法**：`scripts/` 下 `.ts` 以外的文件；目录写法（`scripts/lib/`）；前一个字符是 `/` 的（`./scripts/x.ts`、`skill/references/x.md`）不算点名。
- **YAML 的其余写法**：`~`、`null`、流式写法、锚点、标签都按字面算非空；frontmatter 里别的键不看。
- **软链在工作区里能不能解析**，以及软链目录下名字不等于 `name` 的条目（第四节）。

## 四、软链按 git 索引判，不按文件系统判

两种判法：按 git 记下的类型与目标（`git ls-files -s` 的 mode 为 `120000`，那个 blob 的正文就是目标），或按文件系统（`lstat` 看是不是软链、`readlink` 读目标）。选前一种：

1. **在哪台机器上都是同一个结论。** Windows 或 `core.symlinks=false` 的检出里，软链在磁盘上是一个普通文件，内容是目标路径。按文件系统判，这类检出上每跑一次都红，而仓库本身是对的。
2. **发出去的是仓库。** 用 Skill 的人拿到的是提交里记下的东西（克隆、tag、打包），不是某个工作区一时的样子。
3. **代价**：读的是索引。工作区里改坏了软链、还没 `git add` 时，本地跑不红，暂存以后才红；CI 上的检出没有未暂存的改动，看到的就是提交里的。
4. 所以不判软链在工作区里能不能解析：那是检出的事，不是仓库的事。

## 五、接口

写测试的上下文只读这一节、第一到第四节、第七节与 `process/4-VERIFY.md`；不读 `skill-rule.ts` 的函数体。

```ts
// scripts/check/skill-rule.ts

/** skill/ 下一份 .md：路径相对仓库根；读不到正文时 text 为 undefined */
export interface SkillDoc { readonly path: string; readonly text: string | undefined }

/** git 索引里的一个条目：mode 是 `git ls-files -s` 的那六位数字；mode 为 120000 时 target 是那个 blob 的正文，否则 undefined */
export interface IndexEntry { readonly path: string; readonly mode: string; readonly target: string | undefined }

export interface SkillInput {
  /** skill/ 下（含子目录）全部 .md；列不出时 undefined */
  readonly docs: readonly SkillDoc[] | undefined
  /** package.json 里 scripts 的键；读不到、不是 JSON、或 scripts 不是对象时 undefined */
  readonly commands: readonly string[] | undefined
  /** scripts/ 下（含子目录）的文件，路径相对仓库根；列不出时 undefined */
  readonly scriptFiles: readonly string[] | undefined
  /** git 索引里 .claude/skills/ 与 .agents/skills/ 下的全部条目；读不出时 undefined */
  readonly links: readonly IndexEntry[] | undefined
}

export type SkillFaultKind =
  | 'unreadable'                                        // 第 0 类
  | 'no-skill-md' | 'no-frontmatter' | 'missing-key' | 'duplicate-key' | 'blank-key' // 第 1 样
  | 'no-link' | 'not-link' | 'wrong-target'             // 第 2 样
  | 'dangling-reference' | 'unnamed-reference'          // 第 3 样
  | 'unknown-command'                                   // 第 4 样
  | 'missing-script'                                    // 第 5 样

export interface SkillFault {
  readonly item: 0 | 1 | 2 | 3 | 4 | 5
  readonly kind: SkillFaultKind
  /** 问题落在哪：相对仓库根的路径；第 0 类见第二节 */
  readonly file: string
  /** 行号，从 1 起；没有的是 undefined */
  readonly line: number | undefined
  /** 点名的东西：键名、软链目标原文、点名原文、命令名、脚本路径；没有的是 undefined */
  readonly subject: string | undefined
  /** 一句照着就能改的话；措辞不算契约（第二节末） */
  readonly fix: string
}

/** 按第二节核五样，返回全部问题，先后与去重照第二节末。纯函数，不读文件、不起进程 */
export function skillFaults(input: SkillInput): SkillFault[]
```

每种问题的 `subject` 与 `line`：

| 种类 | file | line | subject |
|---|---|---|---|
| `unreadable` | 第二节第 0 类那五种 | 无 | 无 |
| `no-skill-md` | `skill/SKILL.md` | 无 | 无 |
| `no-frontmatter` | `skill/SKILL.md` | 无 | 无 |
| `missing-key` | `skill/SKILL.md` | 无 | 键名 |
| `duplicate-key` | `skill/SKILL.md` | 第二行起那一行 | 键名 |
| `blank-key` | `skill/SKILL.md` | 键行 | 键名 |
| `no-link`、`not-link` | `<目录>/<name>` | 无 | 无 |
| `wrong-target` | `<目录>/<name>` | 无 | 目标原文 |
| `dangling-reference` | `skill/SKILL.md` | 那一行 | 点名原文（`references/…`，末尾的 `.` 已去掉） |
| `unnamed-reference` | 那份 reference | 无 | `references/<相对路径>` |
| `unknown-command` | 那份文档 | 那一行 | 命令名（末尾的 `.` 已去掉） |
| `missing-script` | 那份文档 | 那一行 | 路径原文（末尾的 `.` 已去掉） |

## 六、怎么落地：两片

按 `process/6-INTEGRATE.md`「怎么切」与「闸门自身走『最后一块砖』」：判定、测试、变异先合，入口最后接。两片都碰本记录与索引，串行。

1. **本条这片：纯判定。** `skill-rule.ts`、`h-skill-rule` 一组测试（测试先写，第七节）、全部 `by: test` 的变异、锚点表加一行。没有入口：没有东西调用 `skill-rule.ts`，没有一项检查的结论因它而变；变异一步多几十条进程内的变异、多一种配置（`h-skill-rule`，组内 0 次启动）。
2. **第二片：接进检查链**，本片合入以后开。
   - 入口 `scripts/check/skill.ts`：读真树（文档与 `scripts/` 的清单读工作区；软链读 git 索引：`git ls-files -s -- .claude/skills .agents/skills`，mode 为 `120000` 的再取 blob 正文），调本片的判定，逐条打印「文件:行」与怎么改；有问题就非 0 退出，读不到也非 0（判定把读不到报成第 0 类，不当成 0 处）。退出码照现有检查入口的约定。
   - `package.json` 加 `skill`，接进 `npm run check`，推荐紧跟 `npm run spec` 之后：纯静态，几秒就完。
   - `scripts/check/selfcheck.ts` 新自检组，在玩具树上起真入口：好树退 0；五样各一棵坏树，非 0 退出、输出点了名；几处问题一起报。组 `needs: []`，玩具树只写几个文件。
   - 副本：`AGENTS.md`「检查命令」那一行的链；`docs/ARCHITECTURE.md` 锚点表；`docs/SYNC.md` 触发表加一行（改 `skill/references/` 下的文件，或 `package.json` 的命令名，或 SKILL.md 的 `name`、软链 → 要看 SKILL.md「参考文档」表等 → 🔒 新命令）；全仓搜描述检查链的句子。
   - 在本条末尾追加「第二片」一节，不新开记录。这道闸门守的是本仓库 skill 的结构，那一节写明它守的是哪一条（触发表新加的那一行），`process/` 里有没有对应的话。
   - **验收**：真树上新命令退 0；在副本里把五样各改坏一次，每次都红，输出能照着改。

## 七、测试怎么写

断言先写，写的上下文不读实现（`process/4-VERIFY.md`「新功能」那一条：先于实现，没东西可读）。

- **需求测试组 `h-skill-rule`**（进程内，0 次启动），`needs: []`，排在 `h-order-rule` 之后。只调 `skillFaults`，不读文件、不起进程；期望值从第二、五节手推，不跑实现抄输出。
- 至少覆盖：五样各自成立、不成立；第 0 类每一种，以及它让哪几样不核；一棵玩具树上几处问题一次全报、每处只报一次；代码围栏里的命令算数；`npm run --silent x` 的写法；`providers/` 这样的子目录；「点名了但文件不在」与「文件在但没点名」两个方向；软链名不等于 `name`、软链目标不对、不是软链（普通文件、目录）；缺 frontmatter、缺键、值是空白（什么也没有、只有空白、只有一对引号、只有注释、块写法下面没有内容）；键写了不止一次；先后与去重；「有一样没核，返回值里就一定有一条问题」；怎么改那三条契约。
- 断言写成 `eq('…', 实际, 期望)` 或 `ok('…', …)`，首参是字面量、各不相同：变异点名用的清册只认这两个函数的字面量首参，包一层就点不着（ADR-145 第 242 行）。
- **变异**全部 `by: test`、`req: "harness"`，编号 M-H61，落在 `skill-rule.ts` 上，由 `h-skill-rule` 的断言点名抓。判定模块里每个判断分支至少一条。

## 八、死亡条件

> **什么条件下整个撤掉**：仓库里不再有 `skill/SKILL.md` 时（这个 Skill 不再以这个目录发出去）。对着 git 就核得出。

不设「退成只报数」的条件：它只在五样有一样不成立时红，修法是改文字、补文件或改软链，没有要躲的误报。文法认不出一种新写法时（第三节的边界），改文法是本模块的一条改动，不是退档的理由。

## 九、验收（本片）

1. 测试先写：先提交本记录、一个抛错的桩和全部测试，`h-skill-rule` 在桩上全红；条数与那个提交写进落地那一节。再提交实现，全绿。
2. 判定模块里每个判断分支至少有一条变异，`npm run mutate` 全部抓到，`npm run audit` 不报这个模块缺变异。
3. 真树：一段不进仓库的命令把本条树上的真输入喂给 `skillFaults`，得空；命令与结果写进落地那一节，钉提交。不写成测试 —— 那样本片就已经把它接进了检查链。
4. `package.json` 的 `dependencies` 与 `devDependencies` 一个不加；`scripts/check/launches.json` 写回。
5. 不接入口：不改 `package.json` 的 `scripts`、不改 `docs/SYNC.md`、不改 `skill/` 下任何文字。
6. 前后成本照 `process/6-INTEGRATE.md`「改验证成本时」，写进落地那一节。
7. 本机以 nobody 用户跑完整 `npm run check` 通过；这条 PR 的 CI 绿。

## 十、文档（本片）

`docs/ARCHITECTURE.md` 锚点表加 `skill-rule.ts` 一行：判什么、不判什么、还没有入口调它。`docs/SYNC.md` 与 `AGENTS.md` 这一片不改：检查链还没变。
