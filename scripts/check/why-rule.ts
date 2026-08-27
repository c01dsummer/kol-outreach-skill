/**
 * 变异集 why 的判定 —— 从 `mutate.ts` 里抽出来的那一半，理由与 `lint-rule.ts` 同：
 * 有语义就该能被测，能被测就不该待在入口脚本里。
 *
 * why 是唯一会被单独打印给**写测试的那个上下文**的字段（`mutate --brief`，
 * 见 `process/4-VERIFY.md` 的准入读物清单）。夹带在里面的实现原文，
 * 等于绕过清单让那个上下文读了实现。
 *
 * 界线：**对外契约里的名字算需求语言** —— stdout 字段、产出文件字段、提供方响应键、
 * 命令行参数（`filtered_contacted`、`sample_size`、`aweme_list`、`--resume`），
 * 写测试的人本来就该看得到它们。本仓库内部的函数名与任何代码表达式不算。
 */

/** 代码运算符：中文散文里不会出现，出现即引了表达式 */
const CODE_OP = /\?\?|\|\||=>|===|!==|\?\./

/**
 * lowerCamelCase：本仓库内部的函数与变量都是这个形状。
 * 对外契约里的名字是 snake_case、带点的文件名、带杠的参数，不会被误伤；
 * 品牌名（TikTok、TikHub）首字母大写，也不在这条规则里。
 */
const LOWER_CAMEL = /\b[a-z][a-z0-9]*[A-Z][a-z]/

/**
 * 返回夹带的那一段实现原文；没夹带返回 `undefined`。
 *
 * **它挡不住内部的 snake_case 名字** —— 那一半与对外契约的字段形状一样，
 * 机器分不开，靠写的人自觉。不假装它被保证了。
 */
export function implementationLeak(why: string): string | undefined {
  const op = CODE_OP.exec(why)
  if (op) return op[0]
  const camel = LOWER_CAMEL.exec(why)
  return camel ? camel[0] : undefined
}
