/**
 * 复评经验库（D31，ADR-230）：用户确认过的「什么局面、该怎么判、证据从哪个任务来」，按品类存在本机，
 * 下一个同品类任务在语义筛选前先读。这里只做机械的那一半 —— 读、校验、记规则版本、追加写入；
 * 经验的措辞、该不该起草、用户有没有确认，是 Agent 照 `skill/` 文字做的判断，不在这里。
 *
 * 放在 `memory/lessons/<品类名>.json`：与 `memory/creators.json` 同在记忆目录下、不进仓库（D31.a、D31.b）。
 * 单开一层子目录，是因为品类名由用户的产品定，直接放在 `memory/` 下，一个叫 creators 的品类就会撞上已联系名单。
 *
 * 三态与记忆文件同一个规矩（ADR-15）：没有这个文件是「没有」，读不出来是「看不到」，两者分开；
 * 看不到时不当成没有，也不拿任何东西去盖掉原文件（D31.t、D31.u）。
 */
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { isAbsence, mkdirDurable, writeFileAtomic } from './atomic.js'
import { readCostDocument, sourceDuplicates } from './cost-json.js'
import { duplicateKeyProblems } from './duplicate-keys.js'
import { PLATFORMS, textProblem } from './types.js'

/** 经验库目录与 Skill 规则文字所在目录；按当前目录算，与 `memory/creators.json` 一样。可注入，测试才测得了 */
let DIR = 'memory/lessons'
let SKILL = 'skill'
export function useLessonsDir(path: string): void { DIR = path }
export function useSkillDir(path: string): void { SKILL = path }

/** 一条经验的归因：这次分歧能不能就归到这一条；一次改了几样、或只有一个例子，写「混杂」（D31.d） */
export const ATTRIBUTIONS = ['能归到这一条', '混杂'] as const
/** 规则版本取不到时记的值（D31.i） */
export const UNKNOWN_VERSION = '未知'
/** 读的时候一条经验相对现行规则的三种状态（D31.j） */
export const VERSION_STATES = ['同一版本', '写于规则改动之前', '版本未知'] as const
export type VersionState = typeof VERSION_STATES[number]

export interface Lesson {
  /** 局面：写成以后还认得出的情境形状，不写某一次的具体事实 */
  situation: string
  /** 教训：语义筛选时该怎么判 */
  lesson: string
  /** 证据：哪个任务、哪个平台账号、哪一轮冻结候选池，用户怎么答、Agent 当时怎么判 */
  evidence: { task: string; platform: string; handle: string; round_id: string; manual: string; agent: string }
  attribution: typeof ATTRIBUTIONS[number]
  /** 写入时 Skill 规则文字的版本标识：64 位十六进制，或「未知」 */
  rule_version: string
  /** 写入时刻（ISO 8601） */
  added_at: string
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const VERSION_RE = /^[0-9a-f]{64}$/

/**
 * 品类名能不能当文件名用。品类名原样当文件名（读同名那一份，D31.l），所以只拦会让它指到别处或建不成文件的写法：
 * 带路径分隔符、以点开头（`.`、`..`、隐藏文件）、控制字符、首尾空白（同名比的是原字，首尾空白肉眼看不出，宁可拒）。
 */
export function categoryProblem(name: unknown): string | undefined {
  const bad = textProblem(name)
  if (bad !== undefined) return bad
  const s = name as string
  if (s !== s.trim()) return '首尾带空白'
  if (/[/\\]/.test(s)) return '带路径分隔符'
  if (s.startsWith('.')) return '以点开头'
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) return '带控制字符'
  if ([...s].length > 80) return '超过 80 个字'
  return undefined
}

/** 这一品类的经验库文件 */
export const lessonsFile = (category: string): string => join(DIR, `${category}.json`)

/**
 * 一条经验缺什么；空数组就是五项齐了（D31.d）。逐项报，修它的是人或 Agent。
 * 只校验这五项与它们底下用得到的几格；多出来的自定义键不算坏。
 */
export function lessonProblems(v: unknown): string[] {
  if (!isObject(v)) return ['不是对象']
  const out: string[] = []
  const text = (key: string, value: unknown) => { const bad = textProblem(value); if (bad) out.push(`${key} ${bad}`) }
  text('局面（situation）', v.situation)
  text('教训（lesson）', v.lesson)
  if (!isObject(v.evidence)) out.push('证据（evidence）不是对象')
  else {
    const e = v.evidence
    for (const k of ['task', 'handle', 'round_id', 'manual', 'agent'] as const) text(`证据的 ${k}`, e[k])
    if (!(PLATFORMS as readonly unknown[]).includes(e.platform)) out.push(`证据的 platform 不是 ${PLATFORMS.join(' 或 ')}`)
  }
  if (!(ATTRIBUTIONS as readonly unknown[]).includes(v.attribution)) out.push(`归因（attribution）不是 ${ATTRIBUTIONS.join(' 或 ')}`)
  if (v.rule_version !== UNKNOWN_VERSION && (typeof v.rule_version !== 'string' || !VERSION_RE.test(v.rule_version))) {
    out.push(`规则版本（rule_version）不是 64 位十六进制，也不是「${UNKNOWN_VERSION}」`)
  }
  text('写入时刻（added_at）', v.added_at)
  return out
}

export type LessonsRead =
  | { status: 'absent' }
  | { status: 'unreadable'; detail: string }
  | { status: 'ok'; lessons: Lesson[] }

/** 一份经验库文件的内容哪里不对；空就是能用。重复的键先查（解析之后就看不见了，D27 同一个道理） */
function storeProblem(text: string): { problem: string } | { lessons: Lesson[] } {
  let doc: Record<string, unknown>
  try { doc = readCostDocument<Record<string, unknown>>(text) }
  catch (e) { return { problem: e instanceof Error ? e.message : String(e) } }
  const dups = duplicateKeyProblems(sourceDuplicates(doc))
  if (dups.length) return { problem: `写重复的键：${dups.join('；')}` }
  if (!Array.isArray(doc.lessons)) return { problem: 'lessons 不是数组' }
  for (const [i, entry] of doc.lessons.entries()) {
    const bad = lessonProblems(entry)
    if (bad.length) return { problem: `第 ${i + 1} 条经验：${bad.join('；')}` }
  }
  return { lessons: doc.lessons as Lesson[] }
}

/** 读一个品类的经验库：没有、读不出来、读到了，三态分开（D31.l、D31.t） */
export function readLessons(category: string): LessonsRead {
  let text: string
  try { text = readFileSync(lessonsFile(category), 'utf8') }
  catch (e) {
    if (isAbsence(e)) return { status: 'absent' }
    return { status: 'unreadable', detail: e instanceof Error ? e.message : String(e) }
  }
  const r = storeProblem(text)
  return 'problem' in r ? { status: 'unreadable', detail: r.problem } : { status: 'ok', lessons: r.lessons }
}

/**
 * 现行 Skill 规则文字的版本标识：`skill/` 下每一项按路径排序，文件取字节、符号链接取它指向的路径，
 * 一起算 SHA-256。不问 git：装到用户机器上的 Skill 多半不是一个仓库。任何一项读不出来，整个记「未知」（D31.i）——
 * 少读一份就算出的标识，会把一次改动算成「同一版本」。
 */
export function currentRuleVersion(): string {
  try {
    const hash = createHash('sha256')
    const walk = (rel: string): void => {
      const abs = rel === '' ? SKILL : join(SKILL, rel)
      const st = lstatSync(abs)
      if (st.isSymbolicLink()) { hash.update(`l\0${rel}\0${readlinkSync(abs)}\0`); return }
      if (st.isDirectory()) {
        hash.update(`d\0${rel}\0`)
        for (const name of readdirSync(abs).sort()) walk(rel === '' ? name : `${rel}/${name}`)
        return
      }
      if (!st.isFile()) throw new Error(`${abs} 不是文件、目录或符号链接`)
      const body = readFileSync(abs)
      hash.update(`f\0${rel}\0${body.length}\0`)
      hash.update(body)
    }
    walk('')
    return hash.digest('hex')
  } catch { return UNKNOWN_VERSION }
}

/** 一条经验相对现行规则的状态（D31.j）：任一边取不到就是版本未知；都在时相同、不同各一态 */
export function versionState(written: string, current: string): VersionState {
  if (written === UNKNOWN_VERSION || current === UNKNOWN_VERSION) return '版本未知'
  return written === current ? '同一版本' : '写于规则改动之前'
}

/** 已有经验库的品类名（给新任务定品类名时先看这张，能沿用就沿用，D31.m）。目录不存在就是一个都没有 */
export function listCategories(): string[] {
  let names: string[]
  try { names = readdirSync(DIR) }
  catch (e) { if (isAbsence(e)) return []; throw e }
  return names.filter(n => n.endsWith('.json') && !n.startsWith('.')).map(n => n.slice(0, -'.json'.length)).sort()
}

export class LessonRejected extends Error {}

/**
 * 追加一条经验。`draft` 是 Agent 起草、用户确认过的那四项（局面、教训、证据、归因）；
 * 规则版本与写入时刻由这里填，草稿里带了就拒 —— 不许起草的一方替这条经验报版本（D31.e）。
 * 五项不齐不写（D31.d）；原文件读不出来不写，也不新建一份去盖它（D31.u）。
 */
export function addLesson(category: string, draft: unknown, now: string): { file: string; count: number } {
  const badName = categoryProblem(category)
  if (badName) throw new LessonRejected(`品类名 ${badName}（这里是 ${JSON.stringify(category)}）`)
  if (isObject(draft) && (Object.hasOwn(draft, 'rule_version') || Object.hasOwn(draft, 'added_at'))) {
    throw new LessonRejected('草稿里不写 rule_version、added_at：这两项由写入时填')
  }
  const entry = isObject(draft) ? { ...draft, rule_version: currentRuleVersion(), added_at: now } : draft
  const bad = lessonProblems(entry)
  if (bad.length) throw new LessonRejected(`这条经验不收：${bad.join('；')}`)
  const file = lessonsFile(category)
  const read = readLessons(category)
  if (read.status === 'unreadable') throw new LessonRejected(`${file} 读不出来，没有写入（不新建一份去盖它）：${read.detail}`)
  const lessons = read.status === 'ok' ? [...read.lessons, entry as Lesson] : [entry as Lesson]
  mkdirDurable(DIR)
  writeFileAtomic(file, `${JSON.stringify({ version: 1, lessons }, null, 2)}\n`)
  return { file, count: lessons.length }
}

/** 任务目录里那份读取记录的文件名：`lessons read` 写，render 读 */
export const LESSONS_READ_FILE = 'lessons-read.json'

/** 读取记录里一条经验：第几条、相对现行规则的状态、局面（报告里用它让人认出是哪条） */
export interface LessonSeen { index: number; state: VersionState; situation: string }
/** `lessons read` 记下的这次读了什么 */
export type LessonsRecord =
  | { category: string; file: string; status: 'ok'; rule_version: string; lessons: LessonSeen[] }
  | { category: string; file: string; status: 'absent'; rule_version: string; lessons: [] }
  | { category: string; file: string; status: 'unreadable'; detail: string; rule_version: string; lessons: [] }

/** 由一次读的结果与现行规则版本，得出要记进任务目录的那份记录 */
export function lessonsRecord(category: string, read: LessonsRead, current: string): LessonsRecord {
  const file = lessonsFile(category)
  if (read.status === 'ok') {
    return { category, file, status: 'ok', rule_version: current,
      lessons: read.lessons.map((l, i) => ({ index: i + 1, state: versionState(l.rule_version, current), situation: l.situation })) }
  }
  if (read.status === 'absent') return { category, file, status: 'absent', rule_version: current, lessons: [] }
  return { category, file, status: 'unreadable', detail: read.detail, rule_version: current, lessons: [] }
}

/**
 * render 眼里这次任务读经验库的情况。比 `LessonsRecord` 多两态：任务目录里没有读取记录（没读过，不是「没有经验」，P1），
 * 读取记录本身读不出来（读过什么无从确认）。都要在数据边界里各说各的（D31.t、D31.v、D31.w）。
 */
export type LessonsSeen =
  | { status: 'not_read' }
  | { status: 'record_unreadable'; detail: string }
  | LessonsRecord

const isRecord = (v: unknown): v is LessonsRecord => {
  if (!isObject(v) || typeof v.category !== 'string' || typeof v.file !== 'string' || typeof v.rule_version !== 'string') return false
  if (!Array.isArray(v.lessons)) return false
  if (v.status === 'absent') return v.lessons.length === 0
  if (v.status === 'unreadable') return typeof v.detail === 'string' && v.lessons.length === 0
  if (v.status !== 'ok') return false
  return v.lessons.every((l: unknown, i: number) => isObject(l) && l.index === i + 1
    && (VERSION_STATES as readonly unknown[]).includes(l.state) && typeof l.situation === 'string')
}

/** 读任务目录里的读取记录：没有就是没读过；读不出来、形状不对都报读不出来，不猜它记了什么 */
export function readLessonsSeen(dir: string): LessonsSeen {
  let text: string
  try { text = readFileSync(join(dir, LESSONS_READ_FILE), 'utf8') }
  catch (e) {
    if (isAbsence(e)) return { status: 'not_read' }
    return { status: 'record_unreadable', detail: e instanceof Error ? e.message : String(e) }
  }
  let v: unknown
  try { v = JSON.parse(text) } catch (e) { return { status: 'record_unreadable', detail: e instanceof Error ? e.message : String(e) } }
  if (!isRecord(v)) return { status: 'record_unreadable', detail: `${LESSONS_READ_FILE} 的形状不对` }
  const { category, file, status, rule_version, lessons } = v
  return status === 'unreadable'
    ? { category, file, status, detail: (v as { detail: string }).detail, rule_version, lessons: [] }
    : status === 'absent' ? { category, file, status, rule_version, lessons: [] }
      : { category, file, status, rule_version, lessons: lessons.map(({ index, state, situation }) => ({ index, state, situation })) }
}

/**
 * 数据边界里关于经验库的那一句（D31.k、D31.t、D31.v、D31.w）。每一态各说各的：
 * 没读过、没有这一品类、有这一份但零条、读不出来、读取记录读不出来、读了几条，不压成同一句。
 */
export function lessonsBoundaryNote(seen: LessonsSeen): string {
  switch (seen.status) {
    case 'not_read': return '本次没有读复评经验库（任务目录里没有读取记录），语义筛选没有参考以前确认过的经验。'
    case 'record_unreadable': return `复评经验库的读取记录读不出来（${seen.detail}），本次参考了哪些经验无从确认。`
    case 'absent': return `还没有「${seen.category}」这一品类的复评经验库，本次没有可参考的经验。`
    case 'unreadable': return `复评经验库「${seen.category}」读不出来，本次没有参考经验（原文件没有改动）：${seen.detail}`
    case 'ok': {
      if (seen.lessons.length === 0) return `复评经验库「${seen.category}」里还没有一条经验，本次没有可参考的经验。`
      const list = seen.lessons.map(l => `第 ${l.index} 条「${l.situation}」（${l.state}）`).join('；')
      const stale = seen.lessons.filter(l => l.state !== '同一版本').length
      return `本次语义筛选前读了复评经验库「${seen.category}」的 ${seen.lessons.length} 条经验：${list}。` +
        (stale ? `其中 ${stale} 条不是按现行规则写的（写于规则改动之前或版本未知），照常参考。` : '')
    }
  }
}
