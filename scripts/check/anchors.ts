#!/usr/bin/env tsx
/**
 * 变异锚点对着当前树 —— 检查链的第一步（ADR-70 末尾「变异残留」第三片）。
 *
 * 读变异目录与每条变异的目标文件，交给 `mutate-rule.ts` 的 `anchorCatalog` 与 `anchorVerdict`，照它交回的逐条说人话，
 * 有一条就以 1 退出。编号不重复时再读 git 暂存区与 HEAD，交给 `stagedResidue`：变异被 `git add` 过、工作树那一处
 * 又按回去了的，工作树上看不出来，下一次提交却会带进去（ADR-70 末尾「变异残留：暂存区」第五片）。
 * 判定全在这几个函数（目录是不是一组变异、编号重复先报、五种对不上、哪条是被连带的、附哪两句话、暂存区里哪条算躺着），
 * 这里只读文件与 git、说人话、设退出码（`docs/CONVENTIONS.md` 第 10 条）。
 *
 * 暂存区与 HEAD 对目录里**每一个**目标文件都读，一次 `git cat-file --batch` 读完（`:./文件` 与 `HEAD:./文件`，路径相对
 * 当前目录），不挑文件：挑哪几个读决定这一步看得见多少，那是判定（第 10 条），而 `git diff` 列的又漏掉
 * `assume-unchanged`、`skip-worktree` 的文件（复审实测）。`cat-file` 也不回写索引的 stat 缓存，git 真的只读。
 * git 读不到时，`notARepo` 认出「这里本来就不是仓库」的，暂存区那一步不做，✓ 那一行照实说没查；别的读不到
 * （属主不符、`.git` 坏了、没装 git）以 1 退出并打出 git 的原话。读出来不是 blob 的（缺、歧义、合并冲突里的多阶段条目）
 * 那个文件按不在暂存区算。
 *
 * **排在最前面**：一处变异没还原、躺在树里时，后面每一步跑的都是被改过的源码，报出来的却是别的事 ——
 * 需求测试红在某条断言上，或者变异一步十几分钟后才说那一条「锚点失效」。也为了提交之前单跑
 * `npm run anchors` 就查得到：不起验证者，git 只读不写。
 *
 * 它拦不住「变异正在跑、恰好在那一刻提交」那个窗口（要一把锁，ADR-70 第 1399–1400 行）；派工跑时变异施加在
 * 隔离目录里，树上本来就不会有，会躺在树上的只有串行那条路（`--jobs=1`、单核、只剩一条）和被打断没还原的。
 *
 * 读不到的目标文件交 `undefined`，由判定报成一处，不当成空文件。变异目录本身读不到、读不出一组变异（不是数组、
 * 空的、哪一条缺了那四样字符串）时也以 1 退出：没得核不是核过了。设退出码、不硬退出：报的行可能有几十条，接管道时硬退出会把还没写出去的
 * 截掉（`mutate-rule.ts` 的 `exitRace` 记着的那个坑）。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { type AnchorFault, type StagedFault, anchorCatalog, anchorVerdict, notARepo, stagedResidue } from './mutate-rule.js'
import { GIT_CONFIG } from './size-rule.js'

const CATALOG = 'scripts/check/mutations.json'
type Mut = { id: string; file: string; find: string; replace: string }

const read = (file: string): string | undefined => { try { return readFileSync(file, 'utf8') } catch { return undefined } }
const catalog = ((): Mut[] | undefined => {
  try { return anchorCatalog(JSON.parse(readFileSync(CATALOG, 'utf8'))) } catch { return undefined }
})()

/**
 * 一次 `git cat-file --batch` 读一组对象（`<修订>:./<文件>`）。交回每一个读出来的正文（不是 blob 的交 `undefined`），
 * 或 git 起不来、以非 0 退出时的原话。文件名里带换行的没法写进一行，按读不到算。
 */
type Batch = { ok: true; blobs: (string | undefined)[] } | { ok: false; stderr: string }
const catBatch = (specs: readonly string[]): Batch => {
  const asked = specs.map(s => s.includes('\n') ? ':' : s)
  const r = spawnSync('git', [...GIT_CONFIG, 'cat-file', '--batch'], { input: asked.join('\n') + '\n', maxBuffer: 1 << 30,
    env: { ...process.env, LC_ALL: 'C' } })
  // git 不读 stdin 就退了时 spawnSync 另报一个 EPIPE，原话还在 stderr 里，先认原话
  const said = r.stderr?.toString('utf8') ?? ''
  if (r.error !== undefined || r.status !== 0) return { ok: false, stderr: said.trim() !== '' ? said : String(r.error) }
  const out = r.stdout, blobs: (string | undefined)[] = []
  let at = 0
  for (const spec of specs) {
    const eol = out.indexOf(0x0a, at)
    const head = out.toString('utf8', at, eol).match(/^[0-9a-f]+ (\S+) (\d+)$/)
    at = eol + 1
    if (head === null) { blobs.push(undefined); continue }
    const size = Number(head[2])
    blobs.push(head[1] === 'blob' && !spec.includes('\n') ? out.toString('utf8', at, at + size) : undefined)
    at += size + 1
  }
  return { ok: true, blobs }
}

const STAGED: Record<StagedFault['kind'], string> = {
  residue: '暂存区里像是没还原 —— 工作树已按回去，暂存区里还是这条变异施加之后的样子',
  unclear: '暂存区里分不开 —— 暂存区里 find 一处都没有、replace 在，工作树里对得上',
}

const SAY: Record<AnchorFault['kind'], string> = {
  unreadable: '目标文件读不到',
  residue: '像是没还原 —— 文件里是这条变异施加之后的样子',
  ambiguous: '锚点不止一处，要恰好一处',
  unclear: '分不开 —— find 一处都没有、replace 在，没还原与锚点失效都是这个样子',
  stale: '锚点失效 —— find 一处都没有',
}

if (catalog === undefined) {
  console.error(`✗ 变异锚点：${CATALOG} 读不到，或读不出一组变异 —— 没得核不是核过了`)
  process.exitCode = 1
} else {
  const verdict = anchorVerdict(catalog, read)
  if (verdict.kind === 'duplicate') {
    const out = [`✗ 变异锚点：${verdict.ids.length} 个编号重复 —— 报告按编号指回目录里那一行，重名时指不回，锚点没往下查\n`]
    for (const id of verdict.ids) out.push(`  ${id}  出现不止一次`)
    out.push('\n  复制一条就改掉它的字母。')
    console.error(out.join('\n'))
    process.exitCode = 1
  } else {
    const files = [...new Set(catalog.map(m => m.file))]
    const batch = catBatch([...files.map(f => `:./${f}`), ...files.map(f => `HEAD:./${f}`)])
    const gitBroken = !batch.ok && !notARepo(batch.stderr)
    const blob = (offset: number) => (file: string) => batch.ok ? batch.blobs[offset + files.indexOf(file)] : undefined
    const staged = batch.ok ? stagedResidue(catalog, read, blob(0), blob(files.length)) : []
    const { faults, advice } = verdict
    if (gitBroken) {
      const said = batch.ok ? '' : batch.stderr.trim().split('\n')[0]
      console.error(`✗ 变异锚点：git 读不到暂存区（${said}）—— 仓库可能就在这里，暂存区里躺着的变异会被下一次提交带进去，没得核不是核过了。`
        + '属主不符的按 git 的提示加 safe.directory，或换成仓库的属主来跑')
      process.exitCode = 1
    }
    if (faults.length === 0 && staged.length === 0) {
      const index = batch.ok ? '暂存区也查过' : '不是 git 仓库，暂存区没查'
      if (!gitBroken) console.log(`✓ 变异锚点：${catalog.length} 条变异的锚点各在目标文件里恰好一处，树上没有没还原的变异（${index}）`)
    } else {
      const out = faults.length === 0 ? [] : [`✗ 变异锚点：${faults.length} 条变异对不上目标文件\n`]
      for (const f of faults) {
        const count = f.kind === 'ambiguous' ? `（${f.count} 处）` : ''
        const knock = f.knockOn ? '（这个文件里有一处可能没还原的，先撤那一处再看这一条）' : ''
        out.push(`  ${f.id}  ${f.file}：${SAY[f.kind]}${count}${knock}`)
      }
      if (advice.diff) {
        out.push('\n  没还原或分不开的：先用 git diff HEAD 看那个文件再动手（暂存了的也看得见；还没 git add 过的新文件，diff 和历史都看不见它，直接看文件内容找那一处，别凭历史判锚点失效）。是没还原的（多半是上一次变异跑被打断，'
          + '或者 --jobs=1 正跑着的时候动了树），只撤那一处 —— 整个文件 git checkout 会把别的改动一起按回去（ADR-70 第 2099 行）。'
          + 'diff 里看不到那一处的（空的，或者只有你自己的改动），那处可能已经提交了：先 git log -p 那个文件，找出那次提交里的那一处：是变异跑漏下的残留才撤，是有意改的就不撤，改变异集；'
          + '浅克隆（git rev-parse --is-shallow-repository 为 true）先 git fetch --unshallow 再查；历史完整也找不到，还要直接看文件内容、确认树上没有那一处变异后的样子（新文件先暂存再被变异的，diff HEAD 和历史都看不出来），才是锚点失效：改那条变异的 file 与 find，跟上现在的代码。')
      }
      if (advice.catalog) {
        out.push('\n  锚点失效、不唯一、读不到的：改那条变异的 file 与 find，跟上现在的代码。')
      }
      if (staged.length > 0) {
        out.push(`${faults.length === 0 ? '' : '\n'}✗ 变异锚点：暂存区里 ${staged.length} 条变异是施加之后的样子，下一次 git commit 会把它带进去\n`)
        for (const f of staged) out.push(`  ${f.id}  ${f.file}：${STAGED[f.kind]}`)
        out.push('\n  暂存区里的：先用 git diff --cached 看那个文件，只撤暂存区里那一处 —— git restore --staged 整个文件会把它暂存的别的改动一起撤掉，'
          + '有别的改动就用 git restore --staged -p 挑出那一处。工作树里也有那一处的，两边都要撤。')
      }
      console.error(out.join('\n'))
      process.exitCode = 1
    }
  }
}
