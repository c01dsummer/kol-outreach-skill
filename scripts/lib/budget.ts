/** 单请求单价（美元）。TikHub 基础价，实际有阶梯折扣，故此为上限估算。 */
export const UNIT_PRICE = 0.001

export class BudgetExceeded extends Error {
  constructor(public spent: number, public limit: number) {
    super(`budget exceeded: $${spent.toFixed(3)} / $${limit.toFixed(2)}`)
    this.name = 'BudgetExceeded'
  }
}

/**
 * 请求计数与预算闸门。
 *
 * 跨运行累加：续跑时用已有的 requests 初始化，不会重复计费已花掉的部分。
 * 达到上限抛 BudgetExceeded，调用方负责保存断点。
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
