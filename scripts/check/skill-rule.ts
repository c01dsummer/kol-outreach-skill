/**
 * Skill 结构五样关系的判定（ADR-156）—— 一次列出全部问题，每条带一句照着就能改的话。
 *
 * 五样：SKILL.md 的 frontmatter、两个软链、reference 都点了名且点了名的都在、
 * 文档里的 `npm run` 命令名、文档里的 `scripts/….ts` 路径。读不到的输入单报一类，
 * 有一样没核，返回值里就一定有一条问题。软链按 git 索引判，不按文件系统（ADR-156 第四节）。
 * 纯函数，不读文件、不起进程；还没有入口调它（ADR-156 第六节）。
 */

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
  /** 问题落在哪：相对仓库根的路径；第 0 类见 ADR-156 第二节 */
  readonly file: string
  /** 行号，从 1 起；没有的是 undefined */
  readonly line: number | undefined
  /** 点名的东西：键名、软链目标原文、点名原文、命令名、脚本路径；没有的是 undefined */
  readonly subject: string | undefined
  /** 一句照着就能改的话；措辞不算契约（ADR-156 第二节末） */
  readonly fix: string
}

/** 按 ADR-156 第二节核五样，返回全部问题，先后与去重照第二节末。纯函数，不读文件、不起进程 */
export function skillFaults(input: SkillInput): SkillFault[] {
  void input
  throw new Error('skillFaults：还没实现（ADR-156 第七节：测试先于实现）')
}
