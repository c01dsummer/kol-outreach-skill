/** 单请求单价（美元）。TikHub 基础价，实际有阶梯折扣，故此为上限估算。 */
export const UNIT_PRICE = 0.001

export class BudgetExceeded extends Error {
  constructor(public spent: number, public limit: number) {
    super(`budget exceeded: $${spent.toFixed(3)} / $${limit.toFixed(2)}`)
    this.name = 'BudgetExceeded'
  }
}

/**
 * **这个上限本身有没有毛病。**
 *
 * 闸门只是一句比较：`已花 + 本次开销 > 上限`。上限不是有限的数时，这句话
 * **恒为假** —— 闸门不是宽了一点，是整条不存在：`--budget 3.0.0` 这样一个手误
 * 就能让采集一路花到供应商余额见底。而且 `pct` 同时恒为 0，连 50%／80% 的提醒
 * 都不会出现，用户看到的是一次「没有任何异常」的采集（P3 · F7）。
 * `Number('abc')` 给的正是这个值。
 *
 * 返回毛病的原文、没毛病返回 `undefined` —— 与 `types.ts` 的 `textProblem`
 * 同一个形状：报错要指得出是哪一种，不替用户断定。
 *
 * 判定放在这里而不是入口里，是因为它有语义（`docs/CONVENTIONS.md` 第 10 条）：
 * 判错一次的代价是红线失效，而入口里的判定既测不了也没有变异守得住。
 * `enrich.ts` 早就在自己那条入口上查了这一条，`collect.ts` 一直没查 ——
 * **同一个判定有两份副本时，先改的那边不会报错**（ADR-46）。
 */
export const budgetProblem = (v: unknown): string | undefined =>
  typeof v !== 'number' ? `不是数字（${typeof v}）`
    : !Number.isFinite(v) ? '不是一个有限的数'
      : v < 0 ? '是负数'
        : undefined

/**
 * 报错里怎么写那个坏取值。
 *
 * 不能直接走 JSON —— `NaN` 与 `Infinity` 在 JSON 里都是 `null`，于是用户打的
 * `--budget 3.0.0` 会被印成「null」，他会以为自己打错成了一个 null。
 * 数字照原样写，其余走 JSON（字符串要带引号，否则 `"0"` 和 `0` 在报错里长得一样）。
 */
export const showAmount = (v: unknown): string =>
  typeof v === 'number' ? String(v) : JSON.stringify(v)

/**
 * **这个「已经花了多少次」有没有毛病。**
 *
 * 和上面那条是同一件事的另一半：闸门要拿「已花」和「上限」比大小，两边都得是数。
 * 它从 `task.json` 反序列化进来 —— **那是外部输入**，静态类型运行时一个字段都不拦
 * （`process/4-VERIFY.md` 那张表里就有这一行）。文件是我们自己写的不构成理由：
 * 手改过、上一版写的、写到一半断电，都会给出别的形状。
 *
 * 几种坏法各不相同，报告要指得出是哪一种：
 *
 * | 盘上是 | 会发生什么 |
 * |---|---|
 * | `null` | 计数读作 null、已花读作 0 —— **整本账退回零**，续跑等于重新给一份预算（D6.a）|
 * | `"4"` | 计数是字符串，加一次变成 `"41"` —— 一次请求把账面翻了十倍 |
 * | `NaN` | 已花是 NaN，闸门那句比较恒为假 —— 和上限是 NaN 一样，闸门整条失效 |
 * | 负数 | 凭空多出一段额度 |
 * | 小数 | 请求数不是整数，`--budget` 该给多少算不明白 |
 *
 * 构造函数的默认值只兜得住 `undefined`（那是「这个字段没写」，按 0 算是对的），
 * 兜不住上面任何一种。
 */
export const ledgerProblem = (v: unknown): string | undefined =>
  v === undefined ? undefined                        // 字段没写 = 还没花过，按 0 算
    : typeof v !== 'number' ? `不是数字（${typeof v}）`
      : !Number.isFinite(v) ? '不是一个有限的数'
        : v < 0 ? '是负数'
          : !Number.isInteger(v) ? '不是整数'
            : undefined

/**
 * 请求计数与预算闸门。
 *
 * 跨运行累加：续跑时用已有的 requests 初始化，不会重复计费已花掉的部分。
 * 达到上限抛 BudgetExceeded，调用方负责保存断点。
 *
 * **上限必须先过 `budgetProblem`。** 这个类里没有再查一遍 —— 查两遍就有两份
 * 判定，而闸门失效时它自己是沉默的：不抛、不提醒、照常返回。
 */
export class Budget {
  private notified = new Set<number>()

  constructor(
    private limitUsd: number,
    private requests = 0,
    private onNotify: (pct: number, spent: number, limit: number) => void = () => {},
  ) {}

  get count() { return this.requests }
  get spent() { return this.requests * UNIT_PRICE }
  get remaining() { return Math.max(0, this.limitUsd - this.spent) }
  get pct() { return this.limitUsd > 0 ? this.spent / this.limitUsd : 0 }

  /** 还能发多少次请求 */
  get affordable() { return Math.max(0, Math.floor(this.remaining / UNIT_PRICE)) }

  /** 预检：不够就抛，够就记账。在每次实际请求前调用。 */
  charge(n = 1): void {
    if (this.spent + n * UNIT_PRICE > this.limitUsd) {
      throw new BudgetExceeded(this.spent, this.limitUsd)
    }
    this.requests += n
    for (const th of [0.5, 0.8]) {
      if (this.pct >= th && !this.notified.has(th)) {
        this.notified.add(th)
        this.onNotify(th, this.spent, this.limitUsd)
      }
    }
  }

  /** 非 200 不计费 —— 退还一次 */
  refund(n = 1): void {
    this.requests = Math.max(0, this.requests - n)
  }

  summary(): string {
    return `$${this.spent.toFixed(3)} / $${this.limitUsd.toFixed(2)} (${(this.pct * 100).toFixed(0)}%, ${this.requests} 次请求)`
  }
}
