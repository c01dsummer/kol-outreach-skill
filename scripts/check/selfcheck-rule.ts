/**
 * 自检里那几条判定 —— 打印出来的话对不对、跑出来的数对不对。抽出来的理由同 `lint-rule.ts`：
 * 留在入口脚本里就永远测不到（`docs/CONVENTIONS.md` 第 10 条）。
 *
 * 这条纪律在这个仓库踩过六次，这是第七次 —— 形状和第五次（纪律 lint 自己）一模一样：
 * 判定与跑法混在同一个入口文件里，于是这条检查自己既没有测试也没有变异 ——
 * 它要拦的那种写法从它自己身上过去了，而没有任何东西会变红。
 * **检查自己也是被检查对象。**
 */

/**
 * **续跑代价那句话说清楚了没有。**
 *
 * 收尾必须二选一：要么「续跑不产生新的请求」，要么「续跑会继续发请求、继续花钱」。
 * `expected` 是调用方按这一轮实际剩下多少活算出来的那个答案。四道闸门，
 * 少一道就有说不清代价的写法能溜过去：
 *
 * 1. **两句必须互斥。**一句都没有是没说；两句都有，用户不知道该信哪句。
 *    只认「这两句里出现了一句」的写法，把「已抓到的不重抓」写成「续跑免费」照样过 ——
 *    那正是 ADR-22 记下的那张空头支票。两种坏法**各报各的**：都报成「没说」，
 *    看错误的人会照着去找一句根本不在收尾里的话。
 * 2. **说的得是该说的那一句。**光互斥不够 —— 两句都合规矩，说反了照样过。
 *    活都干完了却说要花钱，是剩余量算多了；还有活没干完却说免费，
 *    就是 ADR-22 那张空头支票本身。两个方向后果不同，也**各报各的**。
 * 3. **说了要继续花钱，就得说出还剩什么**，否则用户无从判断值不值得续。
 * 4. **剩什么不能是空的。**「还有　没跑完」是把一个空的剩余量填进了付费那句话：
 *    看着像说了，其实什么都没说，比不说更难发现。
 *
 * 没问题返回 `null`，否则返回该打印的那行错。
 */
export function resumeCostVerdict(stderr: string, expected: 'free' | 'cost'): string | null {
  const saysFree = stderr.includes('续跑不产生新的请求')
  const saysCost = stderr.includes('续跑会继续发请求、继续花钱')
  if (saysFree === saysCost) {
    return saysFree
      ? '续跑的代价说了两句相反的话 —— 「续跑不产生新的请求」和「续跑会继续发请求、继续花钱」同时出现，用户不知道该信哪句'
      : '续跑的代价一句都没说 —— 「续跑不产生新的请求」和「续跑会继续发请求、继续花钱」，两句里必须有一句'
  }
  if (saysCost !== (expected === 'cost')) {
    return expected === 'free'
      ? '这一轮的活都干完了，收尾却说续跑还要花钱 —— 剩余量与实际干完的活对不上'
      : '还有活没干完，收尾却说续跑不花钱 —— 用户据此以为续跑白送'
  }
  if (!saysCost) return null
  const said = /还有 (.*?) 没跑完/.exec(stderr)
  if (!said) return '说了续跑要继续花钱，却没说还剩什么 —— 用户无从判断值不值得续'
  if (!said[1].trim()) return '说了「还有 …… 没跑完」，可那个「……」是空的 —— 等于没说'
  return null
}


/**
 * **续跑还剩的活里，profile 那一头点到了没有。**
 *
 * 上面那条只管「该说哪一句」—— 关键词一头没抓完就够它过关。于是入口把创作者从算钱
 * 那一侧整个断掉（只按剩下的关键词算），它照样是绿的（D6.i）。这一条专钉另一头：
 * 说得出「几个人的 profile」，补全那一侧才算真的接进了算钱。
 *
 * 得钉在**那句话里面**、而且数目得是正的。整个 stderr 里搜这几个字是不够的：随便哪条
 * 别的诊断带上这几个字，剩余量里根本没算创作者也照样放行 —— 那正是这条要拦的（复查十七）。
 */
export function profileInRemainingWork(stderr: string): string | null {
  const said = /还有 (.*?) 没跑完/.exec(stderr)
  const n = said && /(\d+) 个人的 profile/.exec(said[1])
  return n && Number(n[1]) > 0
    ? null
    : '收尾没点出还有 profile 没补 —— 入口不把创作者交给算钱那一步也照样不红'
}

/**
 * **预算用尽那一侧，给出的恢复命令带 `--budget` 没有。**
 *
 * 光 `--resume` 会立刻再撞退出码 3 —— 一条照着敲就再死一次的命令，跟没给一样。
 */
export function budgetResumeCmd(stderr: string): string | null {
  return /修好它再跑:.*--budget <新额度>/.test(stderr)
    ? null
    : '预算已用尽，恢复命令却没带 --budget —— 照着敲会立刻再撞退出码 3'
}

/**
 * **续跑那一轮，补全循环真的又跑了一趟没有。**
 *
 * 关键词已经全跑完，所以这一轮发得出的请求只可能是补全发的。`requests` 是**累计值**，
 * 只问「有没有请求」是句空话 —— 一个都没多发也是「有」（这一条第一版就是这么写的，
 * 复查十三改掉）。得跟第一次那个数比，涨了才算数。
 *
 * 两次的 stdout 都从这里读：**「拿什么去判」也是判定的一部分**，只搬走比较、把取数
 * 留在入口，等于没搬（`docs/CONVENTIONS.md` 第 10 条，第七次那一段的教训）。
 * 读不出来算判不了，要红 —— 而且跟「没多发」**各报各的**：报错指错方向，人会去查
 * 补全循环，而真正坏掉的是那次采集根本没吐出 JSON。
 */
export function enrichRanOnResume(first: string, again: string): string | null {
  const requests = (out: string): number => {
    try {
      const n = JSON.parse(out).requests
      return typeof n === 'number' ? n : -1
    } catch { return -1 }
  }
  const before = requests(first)
  const after = requests(again)
  if (before < 0 || after < 0) {
    return '两次采集的 requests 读不出来 —— 补全有没有再跑一趟，无从判断'
  }
  return after > before
    ? null
    : `续跑一次请求都没多发（requests ${before} → ${after}）——`
      + ' bio 查到了、外链是空的，这个人被漏在了补全循环外面'
}
