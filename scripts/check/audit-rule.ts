/**
 * 链路审计里关于**检查链自己**的那一半判定 —— 抽出来是为了它能被测,理由同 `lint-rule.ts`。
 *
 * 守的是 `process/4-VERIFY.md` 那句「检查链自己也在这张清单里」:一条没有测试、也没有
 * 变异守着的检查,和没有检查之间的差别只有心理作用。审计原先只对产品红线强制
 * 「有测试 + 有变异」,闸门自己的需求不在登记表里 —— 于是 PR #7 那套判定的第三拍
 * 是评审看见的,不是检查看见的(ADR-59 里的欠条,ADR-62 还上)。
 *
 * ## 什么算「判定模块」
 *
 * `scripts/check/` 下**不带 shebang** 的 `.ts`。带 shebang 的是入口(走文件树、跑 git、
 * 打印、退出码),按 `docs/CONVENTIONS.md` 第 10 条它们不该装判定,也就没有可变异的东西;
 * 其余每一个文件的存在理由都是「有一段判定要能被测」—— 那它就得有变异证明那些测试
 * 真的会红。
 *
 * **不按文件名后缀(`*-rule.ts`)认**:`trailer.ts`、`quoted.ts` 都是判定,不叫 rule。
 * 一条靠命名约定成立的检查,换个名字就绕过去了。
 *
 * 显式豁免要写理由,和 `selfcheck.ts` 的 `EXEMPT` 同一个形状。
 *
 * ## 只要求「有变异」,不另查「有测试」
 *
 * `npm run mutate` 要求每个变异被抓到,而它只把「断言红了」算抓到 —— 测试进程崩掉不算
 * (`mutate-rule.ts`)。所以有变异被抓到,就有一条真的红过的测试。
 * 反过来「有测试」自己证明不了什么(`4-VERIFY.md`:绿不证明这条测试还能失败),所以不单列。
 *
 * 这个文件自己也在名单上:M-H13-a/b 守着它;`mutate-rule.ts` 由 M-H14-a 守着。
 * 少了这一步,这条检查就是它自己要拦的那种东西。
 */

export const JUDGMENT_EXEMPT: Record<string, string> = {
  'scripts/check/fake-fetch.ts': '自检用的假响应,不是判定 —— 它决定自检能走多深,由 selfcheck 自己的断言守着',
}

export interface CheckFile { path: string; entry: boolean }

/** 判定模块 = 检查目录下不是入口、也没有豁免的文件。 */
export function judgmentModules(files: CheckFile[]): string[] {
  return files.filter(f => !f.entry && !(f.path in JUDGMENT_EXEMPT)).map(f => f.path).sort()
}

/** 没有任何变异指向它的判定模块。 */
export function unguarded(modules: string[], mutations: { file: string }[]): string[] {
  const guarded = new Set(mutations.map(m => m.file))
  return modules.filter(m => !guarded.has(m))
}
