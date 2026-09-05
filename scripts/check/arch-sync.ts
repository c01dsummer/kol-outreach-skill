#!/usr/bin/env tsx
/**
 * 架构锚点 —— 把「架构文档跟不跟得上代码」从期望变成能报错的检查。
 *
 * 架构文档是全仓库唯一一份「改了代码但忘了改它，不会有任何后果」的文档。
 * 所以它的骨架必须被机器守住（process/5-DESIGN.md 的锚点机制）：
 *
 *   1. 双向覆盖   —— 新增模块忘了登记 / 模块删了表没删
 *   2. 编号有效   —— 引用的需求编号真的存在于登记表
 *   3. 顺序绑变异 —— 声明「这里顺序有语义」，就必须有一个故意改坏它的变异
 *
 * 第 3 条是唯一一条真正的耦合：没有它，顺序契约表就退化成散文 ——
 * 声称什么都行，没有任何东西证明改了它会被抓到。
 *
 * ⚠️ 这个检查**证不了文档是真的**。什么东西能在事实不成立时也让它通过？
 *    一份把目录树抄进去、每行胡写一句话的文档。
 *    所以它保证的是覆盖与绑定，不是散文为真 —— 后者是 process/README.md 的第三层。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { duplicateIds } from './attribution-rule.js'

const DOC = 'docs/ARCHITECTURE.md'
const ANCHORS = 'ANCHORS'
const ORDER = 'ORDER'
/** 只覆盖 .ts —— 判据要简单到没有例外可争论 */
const EXT = '.ts'

const doc = readFileSync(DOC, 'utf8')
const reqIds = new Set<string>(
  JSON.parse(readFileSync('docs/requirements.json', 'utf8'))
    .requirements.map((r: { id: string }) => r.id))
const mutations: { id: string; file: string }[] =
  JSON.parse(readFileSync('scripts/check/mutations.json', 'utf8')).mutations
// 编号唯一先查，而且要在建 `mutById` 之前：Map 遇到重名只留最后一条，于是顺序契约
// 拿着编号查到的是**另一条**变异，报出来的是「指向 xxx，不在该契约的位置里」——
// 一句指着位置的话，而错的是有两条重名。这一步在检查链里排在 `mutate` 前面，
// 所以那边真正的诊断轮不上说话（评审指出的正是这个次序）。
const dupes = duplicateIds(mutations)
if (dupes.length) {
  console.error(`✗ scripts/check/mutations.json：${dupes.length} 个编号重复 —— 多条顶着同一个名字\n`)
  for (const d of dupes) console.error(`  ${d}  出现不止一次`)
  console.error('\n  编号是把一条变异指回表里那一行的唯一凭据。复制一条就改掉它的字母。')
  process.exit(1)
}

const mutById = new Map(mutations.map(m => [m.id, m]))

const errors: string[] = []

/** 取 BEGIN/END 之间的表格行。缺标记即失败 —— 和 spec-sync 同一个约定。 */
function section(name: string): string[] {
  const i = doc.indexOf(`<!-- BEGIN:${name}`)
  const j = doc.indexOf(`<!-- END:${name} -->`)
  if (i < 0 || j < 0) {
    console.error(`✗ ${DOC} 缺少 ${name} 的 BEGIN/END 标记`)
    process.exit(1)
  }
  return doc.slice(i, j).split('\n')
    .filter(l => l.trimStart().startsWith('|') && !/^\s*\|[\s|:-]+\|\s*$/.test(l))
    .slice(1)          // 去掉表头
}

/** 单元格里用反引号括起来的路径。只认反引号 —— 散文里顺口提到的路径不算登记。 */
const paths = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map(m => m[1])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith(EXT)) out.push(p)
  }
  return out
}

// ═══════════ 1. 模块锚点表：双向覆盖 + 编号有效 ═══════════

const onDisk = new Set(walk('scripts'))
const listed = new Map<string, { reqs: string[]; note: string }>()
const noReq: string[] = []

for (const row of section(ANCHORS)) {
  const cells = row.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
  const [mod, layer, req, note] = cells
  const [path, ...extra] = paths(mod ?? '')

  if (!path) { errors.push(`锚点表有一行没有用反引号写出模块路径：${row.trim()}`); continue }
  if (extra.length) errors.push(`${path} 这一行的模块列写了多个路径，一行只登记一个模块`)
  if (listed.has(path)) errors.push(`${path} 在锚点表里登记了两次`)
  if (!['入口', '逻辑', '适配', '检查'].includes(layer ?? '')) {
    errors.push(`${path} 的层是「${layer}」，只能是 入口/逻辑/适配/检查`)
  }
  // 「它保证什么」空着的行，等于登记了一个名字 —— 那正是这份文档不该变成的样子
  if (!note) errors.push(`${path} 没写「它保证什么」`)

  const reqs = req === '—' ? [] : (req ?? '').split(/\s+/).filter(Boolean)
  for (const id of reqs) {
    if (!reqIds.has(id)) errors.push(`${path} 引用了不存在的需求编号 ${id}`)
  }
  if (!reqs.length) noReq.push(path)
  listed.set(path, { reqs, note: note ?? '' })
}

for (const f of [...onDisk].sort()) {
  if (!listed.has(f)) errors.push(`${f} 未登记在锚点表 —— 新增模块必须同时登记`)
}
for (const f of [...listed.keys()].sort()) {
  if (!onDisk.has(f)) errors.push(`锚点表里的 ${f} 在磁盘上不存在 —— 模块删了表没删`)
}

// ═══════════ 2. 顺序契约表：每条必须有真的变异守着 ═══════════

let contracts = 0

for (const row of section(ORDER)) {
  const cells = row.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
  const [what, where, consequence, guards] = cells
  contracts++

  const at = paths(where ?? '')
  if (!at.length) { errors.push(`顺序契约「${what}」没写位置`); continue }
  for (const p of at) {
    if (!onDisk.has(p)) errors.push(`顺序契约「${what}」的位置 ${p} 不存在`)
  }
  if (!consequence) errors.push(`顺序契约「${what}」没写错了会怎样`)

  const ids = [...(guards ?? '').matchAll(/M-[A-Z]\d+-[a-z]/g)].map(m => m[0])
  if (!ids.length) {
    errors.push(`顺序契约「${what}」没有变异守着 —— 没有变异的顺序声明只是散文`)
    continue
  }
  for (const id of ids) {
    const mut = mutById.get(id)
    if (!mut) { errors.push(`顺序契约「${what}」写的变异 ${id} 不存在于 mutations.json`); continue }
    // 变异必须落在这条契约声明的位置上，否则它守的是别处
    if (!at.includes(mut.file)) {
      errors.push(`顺序契约「${what}」写的变异 ${id} 指向 ${mut.file}，不在该契约的位置里`)
    }
  }
}

// ═══════════ 报告 ═══════════

if (errors.length) {
  console.error(`✗ 架构锚点：${errors.length} 项与 ${DOC} 对不上\n`)
  for (const e of errors) console.error(`  · ${e}`)
  console.error(`\n  规则见 process/5-DESIGN.md。改了模块边界或调用顺序，文档要当场跟上。`)
  process.exit(1)
}

console.log(`✓ 架构锚点：${listed.size} 个模块全部登记，${contracts} 条顺序契约各有变异守着`)
if (noReq.length) {
  console.log(`  ⊘ 不直接服务任何需求编号（显式缺口，不消灭）：${noReq.join(' ')}`)
}
console.log(`  注：可查的是覆盖与绑定，不是散文是否为真 —— 见 process/README.md 第三层`)
