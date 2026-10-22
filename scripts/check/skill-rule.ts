/**
 * Skill 结构五样关系的判定（ADR-156）—— 一次列出全部问题，每条带一句照着就能改的话。
 *
 * 五样：SKILL.md 的 frontmatter、两个软链、reference 都点了名且点了名的都在、
 * 文档里的 `npm run` 命令名、文档里的 `scripts/….ts` 路径。读不到的输入单报一类，
 * 有一样没核，返回值里就一定有一条问题。软链按 git 索引判，不按文件系统（ADR-156 第四节）。
 * 纯函数，不读文件、不起进程；入口是 `skill.ts`（`npm run skill`，ADR-156 第十四节）。
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

const SKILL_MD = 'skill/SKILL.md'
const REFERENCES = 'skill/references/'
const LINK_DIRS = ['.claude/skills', '.agents/skills'] as const
const LINK_TARGET = '../../skill'
const KEYS = ['name', 'description'] as const

// 第 3、5 样的一处点名：前一个字符不是路径字符（或在行首），连同后面一串路径字符；末尾的句号另去
const REFERENCE = /(?<![A-Za-z0-9_./-])references\/[A-Za-z0-9_./-]*/g
const SCRIPT = /(?<![A-Za-z0-9_./-])scripts\/[A-Za-z0-9_./-]*/g
// 第 4 样的一处命令：npm、一段空白、run、零个或几个 - 打头的参数，再一段空白和命令名（第一个字符不是 -）
const COMMAND = /(?<![A-Za-z0-9_-])npm[ \t]+run(?:[ \t]+-[^\s`]*)*[ \t]+([^\s`'"()<>|&;,，。、；：（）「」-][^\s`'"()<>|&;,，。、；：（）「」]*)/g
// 第 1 样的键行：顶格的键名，可带半角空格或制表符，半角冒号，冒号后是空白或行尾
const KEY_LINE = (key: string): RegExp => new RegExp(`^${key}[ \\t]*:(?=\\s|$)`)
// YAML 的块标记：| 或 >，后面零到两个 +、- 或 1–9
const BLOCK = /^[|>][1-9+-]{0,2}$/

const withoutTrailingDots = (s: string): string => s.replace(/\.+$/, '')
const isFence = (line: string): boolean => line.trimEnd() === '---'

/** 一行键行的值：是不是空白，以及第 2 样要用的那个值（ADR-156 第二节第 1 样第 6、7 条） */
const valueOf = (lines: readonly string[], at: number, end: number, rest: string): { blank: boolean; value: string } => {
  const head = rest.trim()
  if (BLOCK.test(head)) {
    const block: string[] = []
    for (let j = at + 1; j < end && !/^\S/.test(lines[j]); j++) block.push(lines[j].trim())
    const kept = block.filter(l => l !== '')
    return { blank: kept.length === 0, value: kept.join(' ') }
  }
  let value = head
  if (value.startsWith('#')) value = ''
  else if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) value = value.slice(1, -1).trim()
  return { blank: value === '', value }
}

/** 按 ADR-156 第二节核五样，返回全部问题，先后与去重照第二节末。纯函数，不读文件、不起进程 */
export function skillFaults(input: SkillInput): SkillFault[] {
  const out: SkillFault[] = []
  const add = (item: SkillFault['item'], kind: SkillFaultKind, file: string, line: number | undefined,
    subject: string | undefined, fix: string): void => { out.push({ item, kind, file, line, subject, fix }) }
  const { docs, commands, scriptFiles, links } = input

  // 第 0 类：读不到的输入，各报一条；文档清单读不到时五样都不核，别的输入照样报
  if (docs === undefined) add(0, 'unreadable', 'skill/', undefined, undefined, '列不出 skill/ 下的文件，五样都没核；让 skill/ 能列出来再跑')
  if (commands === undefined) add(0, 'unreadable', 'package.json', undefined, undefined, '读不出 package.json 里 scripts 的键，第 4 样没核；修好 package.json 再跑')
  if (scriptFiles === undefined) add(0, 'unreadable', 'scripts/', undefined, undefined, '列不出 scripts/ 下的文件，第 5 样没核；让 scripts/ 能列出来再跑')
  if (links === undefined) add(0, 'unreadable', '.claude/skills/、.agents/skills/', undefined, undefined, '读不出 git 索引里 .claude/skills/ 与 .agents/skills/ 下的条目，第 2 样没核；在 git 仓库里跑')
  if (docs === undefined) return settle(out)
  for (const doc of docs) {
    if (doc.text !== undefined) continue
    add(0, 'unreadable', doc.path, undefined, undefined, doc.path === SKILL_MD
      ? '读不出这份文件的正文：第 1、2、3 样没核，它自己的第 4、5 样也没核；让它能读再跑'
      : '读不出这份文件的正文，它的第 4、5 样没核；让它能读再跑')
  }

  // 第 1 样：frontmatter；顺带取出第 2 样要用的 name
  const skill = docs.find(d => d.path === SKILL_MD)
  let name: string | undefined
  if (skill === undefined) {
    add(1, 'no-skill-md', SKILL_MD, undefined, undefined, '建 skill/SKILL.md：第一行写 ---，接着写 name: 与 description: 两行，再写一行 ---；第 2、3 样要等它在了才核')
  } else if (skill.text !== undefined) {
    const lines = skill.text.split('\n')
    const end = isFence(lines[0]) ? lines.findIndex((l, i) => i > 0 && isFence(l)) : -1
    if (end < 0) {
      add(1, 'no-frontmatter', SKILL_MD, undefined, undefined, 'skill/SKILL.md 第一行写 ---，接着写 name: 与 description: 两行，再写一行 --- 收尾；第 2 样要等 name 写好才核')
    } else {
      for (const key of KEYS) {
        const later = key === 'name' ? '；第 2 样要等 name 写好才核' : ''
        const pattern = KEY_LINE(key)
        const at: number[] = []
        for (let i = 1; i < end; i++) if (pattern.test(lines[i])) at.push(i)
        if (at.length === 0) add(1, 'missing-key', SKILL_MD, undefined, key, `在 skill/SKILL.md 开头两行 --- 之间加一行「${key}: …」${later}`)
        for (const i of at.slice(1)) add(1, 'duplicate-key', SKILL_MD, i + 1, key, `删掉第 ${i + 1} 行，${key} 只留一行${later}`)
        let only: string | undefined
        for (const i of at) {
          const { blank, value } = valueOf(lines, i, end, lines[i].slice(lines[i].indexOf(':') + 1))
          if (blank) add(1, 'blank-key', SKILL_MD, i + 1, key, `在第 ${i + 1} 行冒号后面写上 ${key} 的值${later}`)
          else only = value
        }
        if (key === 'name' && at.length === 1) name = only
      }
    }
  }

  // 第 2 样：两个软链，按 git 索引判（ADR-156 第四节）
  if (name !== undefined && links !== undefined) {
    for (const dir of LINK_DIRS) {
      const path = `${dir}/${name}`
      const entry = links.find(e => e.path === path)
      if (entry === undefined) {
        if (links.some(e => e.path.startsWith(`${path}/`))) add(2, 'not-link', path, undefined, undefined, `${path} 是一个目录，要的是指向 ../../skill 的软链：删掉它，改成 ln -s ../../skill ${path}，再 git add`)
        else add(2, 'no-link', path, undefined, undefined, `建软链 ${path} 指向 ../../skill：ln -s ../../skill ${path}，再 git add`)
      } else if (entry.mode !== '120000') {
        add(2, 'not-link', path, undefined, undefined, `${path} 在 git 里记的不是软链：删掉它，改成 ln -s ../../skill ${path}，再 git add`)
      } else if (entry.target !== LINK_TARGET) {
        add(2, 'wrong-target', path, undefined, entry.target, `${path} 指向 ${entry.target}，要指向 ../../skill：ln -sfn ../../skill ${path}，再 git add`)
      }
    }
  }

  // 第 3 样：SKILL.md 点名的 reference 都在，在的 reference 都被点了名
  const paths = new Set(docs.map(d => d.path))
  if (skill?.text !== undefined) {
    const named = new Set<string>()
    skill.text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(REFERENCE)) {
        const said = withoutTrailingDots(m[0])
        if (!said.endsWith('.md')) continue
        named.add(`skill/${said}`)
        if (!paths.has(`skill/${said}`)) add(3, 'dangling-reference', SKILL_MD, i + 1, said, `skill/${said} 不在：把 ${said} 改成实际的文件名，或者补上这份文件`)
      }
    })
    for (const doc of docs) {
      if (!doc.path.startsWith(REFERENCES) || !doc.path.endsWith('.md') || named.has(doc.path)) continue
      const said = doc.path.slice('skill/'.length)
      add(3, 'unnamed-reference', doc.path, undefined, said, `在 skill/SKILL.md 里点名 ${said}（「参考文档」表加一行，或者写进用到它的那一段）；不用了就删掉这份文件`)
    }
  }

  // 第 4、5 样：每份读得到正文的文档里的命令名与脚本路径
  const known = commands === undefined ? undefined : new Set(commands)
  const present = scriptFiles === undefined ? undefined : new Set(scriptFiles)
  for (const doc of docs) {
    if (doc.text === undefined) continue
    doc.text.split('\n').forEach((line, i) => {
      if (known !== undefined) {
        for (const m of line.matchAll(COMMAND)) {
          const command = withoutTrailingDots(m[1])
          if (command === '' || known.has(command)) continue
          add(4, 'unknown-command', doc.path, i + 1, command, `package.json 的 scripts 里没有 ${command}：把这里的命令名改成 scripts 里有的那个，或者在 package.json 里加上它`)
        }
      }
      if (present !== undefined) {
        for (const m of line.matchAll(SCRIPT)) {
          const said = withoutTrailingDots(m[0])
          if (!said.endsWith('.ts') || present.has(said)) continue
          add(5, 'missing-script', doc.path, i + 1, said, `${said} 不在：把路径改成 scripts/ 下实际的文件，或者补上这份文件`)
        }
      }
    })
  }
  return settle(out)
}

const byText = (a: string | undefined, b: string | undefined): number =>
  a === b ? 0 : a === undefined ? -1 : b === undefined ? 1 : a < b ? -1 : 1
const byLine = (a: number | undefined, b: number | undefined): number =>
  a === b ? 0 : a === undefined ? -1 : b === undefined ? 1 : a - b

/** 第二节末的先后与去重：和输入的先后无关；五个字段都相同的只留一条 */
function settle(faults: SkillFault[]): SkillFault[] {
  const sorted = [...faults].sort((a, b) => a.item - b.item || byText(a.file, b.file) || byLine(a.line, b.line)
    || byText(a.subject, b.subject) || byText(a.kind, b.kind))
  const key = (f: SkillFault): string => JSON.stringify([f.item, f.kind, f.file, f.line, f.subject])
  return sorted.filter((f, i) => i === 0 || key(f) !== key(sorted[i - 1]))
}
