// KOL-21 C1 · 文件树快照与字节比较（冻结单 pack/30-frozen-spec.md:26-31）
// TREE：运行前后各取一次 <RUN>/cwd 下全部路径（含目录）及每个文件的 SHA-256。
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { join, relative, sep, basename } from 'node:path'

export interface Snap { root: string; dirs: Set<string>; files: Map<string, string> }

export function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex')
}
export function sha256File(p: string): string | null {
  return existsSync(p) ? sha256(readFileSync(p)) : null
}

/** 取快照：相对 root 的路径（统一用 /）。符号链接按链接本身记（目标文本的哈希），不跟进。 */
export function snap(root: string): Snap {
  const dirs = new Set<string>()
  const files = new Map<string, string>()
  const walk = (abs: string): void => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name)
      const rel = relative(root, p).split(sep).join('/')
      const st = lstatSync(p)
      if (st.isSymbolicLink()) files.set(rel, 'symlink:' + sha256(readlinkSync(p)))
      else if (st.isDirectory()) { dirs.add(rel); walk(p) }
      else files.set(rel, sha256(readFileSync(p)))
    }
  }
  if (existsSync(root)) walk(root)
  return { root, dirs, files }
}

/** TREE-SAME（:28）：路径集合与每个文件哈希前后完全相同。 */
export function treeSame(a: Snap, b: Snap): { ok: boolean; diff: string[] } {
  const diff: string[] = []
  for (const d of a.dirs) if (!b.dirs.has(d)) diff.push('目录消失 ' + d)
  for (const d of b.dirs) if (!a.dirs.has(d)) diff.push('新增目录 ' + d)
  for (const [f, h] of a.files) {
    if (!b.files.has(f)) diff.push('文件消失 ' + f)
    else if (b.files.get(f) !== h) diff.push('文件改动 ' + f)
  }
  for (const f of b.files.keys()) if (!a.files.has(f)) diff.push('新增文件 ' + f)
  return { ok: diff.length === 0, diff }
}
export function newDirs(a: Snap, b: Snap): string[] {
  return [...b.dirs].filter((d) => !a.dirs.has(d))
}
/** 运行后新增的、名为 name 的文件（任何位置）。 */
export function newFilesNamed(a: Snap, b: Snap, name: string): string[] {
  return [...b.files.keys()].filter((f) => !a.files.has(f) && basename(f) === name)
}
/** TREE-NODIR（:29）：没有新增任何目录，也没有任何新增的名为 task.json 的文件。 */
export function treeNoDir(a: Snap, b: Snap): { ok: boolean; diff: string[] } {
  const diff = [...newDirs(a, b).map((d) => '新增目录 ' + d), ...newFilesNamed(a, b, 'task.json').map((f) => '新增 task.json ' + f)]
  return { ok: diff.length === 0, diff }
}
/** TREE-NOTASK（:30）：任何位置都没有新增名为 task.json 的文件（不管目录）。 */
export function treeNoTask(a: Snap, b: Snap): { ok: boolean; diff: string[] } {
  const diff = newFilesNamed(a, b, 'task.json').map((f) => '新增 task.json ' + f)
  return { ok: diff.length === 0, diff }
}
/** BYTES(f)（:31）：运行前后 SHA-256 相同（rel 相对 cwd）。缺席与缺席也算相同。 */
export function bytesSame(a: Snap, b: Snap, rel: string): { ok: boolean; detail: string } {
  const x = a.files.get(rel)
  const y = b.files.get(rel)
  return { ok: x === y, detail: `前 ${x ?? '缺席'} / 后 ${y ?? '缺席'}` }
}
