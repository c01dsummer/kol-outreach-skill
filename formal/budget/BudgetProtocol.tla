-------------------------- MODULE BudgetProtocol --------------------------
(*****************************************************************************)
(* 预算与请求提交协议。                                                       *)
(*                                                                           *)
(* 这份模型和 `scripts/check/formal-rule.ts` 里那份是**同一个转移系统的两种   *)
(* 写法**。两份都存在，是因为它们买到的东西不一样：                           *)
(*                                                                           *)
(*   - TLA+ 这一份由 TLC 检查 —— 一个别人写的、被用了二十年的模型检查器      *)
(*   - TypeScript 那一份能**调真实的 Budget 与 TikHub.get()**                *)
(*                                                                           *)
(* 两份会漂移，所以不靠人记得同步：`npm run formal -- --tla` 把两边的可达     *)
(* 状态集逐个字符比一遍，不一致当场红。见 formal/budget/IMPLEMENTATION-MAP.md。*)
(*                                                                           *)
(* 建模的对象是 P3「未经用户确认不得超出预算上限」。要点是钱不在              *)
(* `Budget.charge()` 里花掉 —— 是在 `providers/tikhub.ts` 的 fetch 那一行。   *)
(* charge 与 fetch 之间、fetch 与「把请求数写进 task.json」之间各有一个可以   *)
(* 崩溃的窗口，而那两个窗口不在任何一个单元里。                               *)
(*****************************************************************************)
EXTENDS Naturals

CONSTANTS
  Limit,          \* 已确认的预算上限，折算成请求数（$0.001/次）
  MaxSent,        \* 有界：供应商侧最多收到多少次提交
  MaxResumes,     \* 有界：最多续跑几次。没有它状态空间是无穷的
  PersistEvery,   \* 每计费几次落一次盘。1 = 每次；N = 入口脚本的实际节奏
  BillNon200,     \* 环境假设：非 200 供应商计不计费。refund() 押的就是这一条
  MayCrash,       \* 进程会不会在任意一步崩掉
  BrokenCharge    \* 负例开关：预检写成「先记账再判断」

VARIABLES
  alive,          \* 进程还活着
  billed,         \* 供应商**真正收了钱**的次数。代码里没有任何变量装着它
  disk,           \* task.json 的 requests —— 崩溃之后只剩下它
  exit,           \* "none" | "budget"
  local,          \* 活着的进程里 Budget.requests
  phase,          \* "idle" | "charged" | "sent"
  resumes,
  sent,           \* 供应商**收到**的提交次数（含非 200）
  sinceSave,      \* 距上次落盘已经计费了几次 —— 崩溃时丢掉的就是这一段
  stopped,        \* 已经保存断点并以退出码 3 收尾
  warnTotal,      \* 整个任务的提醒总次数（跨进程）
  warnedHere      \* 本进程已提醒过的阈值个数（0..2）

vars == <<alive, billed, disk, exit, local, phase, resumes, sent, sinceSave,
          stopped, warnTotal, warnedHere>>

(* 跨过了几个阈值。0.5 与 0.8 写成整数比较，避免引进实数：                    *)
(*   l / Limit >= 1/2  <=>  l * 2 >= Limit                                   *)
(*   l / Limit >= 4/5  <=>  l * 5 >= Limit * 4                               *)
(* 上限为 0 时没有百分比可言，不提醒 —— 与 Budget.pct 在上限 <= 0 时返回 0 一致 *)
Due(l) == IF Limit <= 0 THEN 0
          ELSE (IF l * 2 >= Limit THEN 1 ELSE 0)
             + (IF l * 5 >= Limit * 4 THEN 1 ELSE 0)

WarnAfter(l, already) == IF Due(l) > already THEN Due(l) ELSE already

Init ==
  /\ alive = TRUE
  /\ billed = 0
  /\ disk = 0
  /\ exit = "none"
  /\ local = 0
  /\ phase = "idle"
  /\ resumes = 0
  /\ sent = 0
  /\ sinceSave = 0
  /\ stopped = FALSE
  /\ warnTotal = 0
  /\ warnedHere = 0

(* ── 动作 ── 每个动作都对应实现里一处真实的位置，对应表在 IMPLEMENTATION-MAP.md *)

ChargeOk ==
  /\ local' = local + 1
  /\ phase' = "charged"
  /\ warnedHere' = WarnAfter(local + 1, warnedHere)
  /\ warnTotal' = warnTotal + (WarnAfter(local + 1, warnedHere) - warnedHere)
  /\ UNCHANGED exit

\* P3.a：不够就抛，**且不增加计数**
ChargeRejected ==
  /\ exit' = "budget"
  /\ UNCHANGED <<local, phase, warnedHere, warnTotal>>

Charge ==
  /\ alive /\ ~stopped /\ phase = "idle" /\ exit = "none"
  /\ sent < MaxSent
  /\ IF BrokenCharge THEN ChargeOk
     ELSE IF local + 1 > Limit THEN ChargeRejected ELSE ChargeOk
  /\ UNCHANGED <<disk, billed, sent, sinceSave, alive, stopped, resumes>>

\* 钱是在这一步花掉的 —— charge 之后、结果回来之前
Send ==
  /\ alive /\ phase = "charged"
  /\ phase' = "sent"
  /\ sent' = sent + 1
  /\ UNCHANGED <<local, disk, billed, sinceSave, warnedHere, warnTotal, alive,
                 exit, stopped, resumes>>

Ok ==
  /\ alive /\ phase = "sent"
  /\ phase' = "idle"
  /\ billed' = billed + 1
  /\ sinceSave' = sinceSave + 1
  /\ UNCHANGED <<local, disk, sent, warnedHere, warnTotal, alive, exit, stopped, resumes>>

\* 非 200：refund() 退还一次计数。**供应商那边退不退，是环境假设**
NonOk ==
  /\ alive /\ phase = "sent"
  /\ phase' = "idle"
  /\ local' = IF local > 0 THEN local - 1 ELSE 0
  /\ billed' = billed + (IF BillNon200 THEN 1 ELSE 0)
  /\ sinceSave' = sinceSave + (IF BillNon200 THEN 1 ELSE 0)
  /\ UNCHANGED <<disk, sent, warnedHere, warnTotal, alive, exit, stopped, resumes>>

\* collect.ts 的 persist()：把内存里的计数写进 task.json
Persist ==
  /\ alive /\ phase = "idle"
  /\ ~(disk = local /\ sinceSave = 0)
  /\ ~(sinceSave < PersistEvery /\ sinceSave > 0)
  /\ disk' = local
  /\ sinceSave' = 0
  /\ UNCHANGED <<local, billed, sent, phase, warnedHere, warnTotal, alive,
                 exit, stopped, resumes>>

Crash ==
  /\ MayCrash /\ alive /\ ~stopped
  /\ alive' = FALSE
  /\ UNCHANGED <<local, disk, billed, sent, phase, sinceSave, warnedHere,
                 warnTotal, exit, stopped, resumes>>

\* 续跑：新进程，Budget 用盘上的 requests 初始化，提醒集合是空的
Resume ==
  /\ ~alive /\ resumes < MaxResumes
  /\ alive' = TRUE
  /\ local' = disk
  /\ phase' = "idle"
  /\ sinceSave' = 0
  /\ warnedHere' = 0
  /\ exit' = "none"
  /\ resumes' = resumes + 1
  /\ UNCHANGED <<disk, billed, sent, warnTotal, stopped>>

\* P3.b：捕获 BudgetExceeded 之后 persist()，再以退出码 3 结束
Stop ==
  /\ alive /\ ~stopped /\ exit = "budget" /\ phase = "idle"
  /\ disk' = local
  /\ sinceSave' = 0
  /\ stopped' = TRUE
  /\ UNCHANGED <<local, billed, sent, phase, warnedHere, warnTotal, alive,
                 exit, resumes>>

Next == Charge \/ Send \/ Ok \/ NonOk \/ Persist \/ Crash \/ Resume \/ Stop

Spec == Init /\ [][Next]_vars

(* ── 不变量 ── 每一条都指得回 docs/requirements.json 的一条验收判据 ── *)

\* P3 · P3.a：供应商真正收费的次数，永远不超过用户已确认的上限
NoOverspend == billed <= Limit

\* P3 · D6.a：进程死掉时，盘上记着的不少于供应商已经收费的 ——
\*            不存在「钱已经花出去、本地却没有记录」的静默状态
SpendIsRecorded == alive \/ disk >= billed

\* P3.b：以退出码 3 收尾时，断点里的请求数与内存里的一致
Exit3Recoverable == ~stopped \/ disk = local

\* F7.a：整个任务里，两个阈值各只提醒一次
WarnOncePerTask == warnTotal <= 2

(* ── 步性质 ── 说的是「这一步不许改什么」，单看状态表达不出来 ── *)

\* P3.a：被预算拒绝的那一次请求不增加计数
RejectedNotCounted == [][ (exit = "none" /\ exit' = "budget") => local' = local ]_vars

\* D6.a：续跑用盘上的请求数初始化，不从零开始
ResumeKeepsCount == [][ (~alive /\ alive') => local' = disk ]_vars

=============================================================================
