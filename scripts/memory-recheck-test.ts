/**
 * P4 / P5.d / D4: exercise the public render CLI against an isolated task and memory.
 * Expected results below come from the requirements, not from render internals.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const render = join(project, 'scripts/render.ts')
const tsxLoader = import.meta.resolve('tsx')
const now = '2026-09-01T12:00:00Z'
const handle = 'review_sage'
const linkedHandle = 'review_sage_ig'

type Fixture = { root: string; dir: string; memory: string; taskId: string }
const roots: string[] = []

function json(path: string): any { return JSON.parse(readFileSync(path, 'utf8')) }
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}

function candidate(linked = false): Record<string, unknown> {
  return {
    platform: 'tiktok', handle, nickname: 'Review Sage', followers: 42000,
    bio: 'Reviews everyday gear', bio_links: [], verified: false,
    profile_url: `https://www.tiktok.com/@${handle}`,
    source_keyword: 'travel gear', source_dimension: 'category', source_tasks: [0],
    email: 'sage@example.test', fit: '✅', fit_reason: 'Reviews similar gear',
    score: 80, tier: 'A', outreach_draft: 'Hi Sage, I enjoyed your travel gear review.',
    ...(linked ? { cross_platform: true, linked_handle: `instagram:${linkedHandle}` } : {}),
  }
}

function fixture(taskId: string, linked = false): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'kol-render-memory-'))
  roots.push(root)
  const dir = join(root, 'output', taskId)
  mkdirSync(dir, { recursive: true })
  const task = {
    product: 'sample-pack', market: 'US', target_count: 1,
    tasks: [{ keyword: 'travel gear', dimension: 'category', platform: 'tiktok' }],
    done: [0], offsets: { 0: 1 }, answered: { 0: 1 }, found: { 0: 1 }, pages: { 0: 1 },
    memory_status: 'ok', created_at: now, updated_at: now,
  }
  writeJson(join(dir, 'task.json'), task)
  writeJson(join(dir, 'creators.json'), [candidate(linked)])
  writeJson(join(dir, 'creators.raw.json'), [candidate(linked)])
  return { root, dir, memory: join(root, 'memory/creators.json'), taskId }
}

function memoryEntry(platform: 'tiktok' | 'instagram', account: string) {
  return {
    platform, handle: account, nickname: 'Review Sage', followers: 42000,
    first_seen: '2026-09-01', recommendations: [] as Array<Record<string, string>>,
    contacted: false, replied: false, blocked: false, note: '',
  }
}

function putMemory(f: Fixture, marked?: 'primary-contacted' | 'primary-blocked' | 'linked-contacted' | 'linked-blocked') {
  const primary = { ...memoryEntry('tiktok', handle), linked_to: `instagram:${linkedHandle}` }
  const linked = memoryEntry('instagram', linkedHandle)
  if (marked === 'primary-contacted') primary.contacted = true
  if (marked === 'primary-blocked') primary.blocked = true
  if (marked === 'linked-contacted') linked.contacted = true
  if (marked === 'linked-blocked') linked.blocked = true
  writeJson(f.memory, {
    version: 1, updated_at: now,
    creators: { [`tiktok:${handle}`]: primary, [`instagram:${linkedHandle}`]: linked },
  })
}

function run(f: Fixture, ignore = false) {
  return spawnSync(process.execPath, ['--import', tsxLoader, render, '--dir', f.dir, ...(ignore ? ['--ignore-memory'] : [])], {
    cwd: f.root, encoding: 'utf8', env: process.env,
  })
}

function success(result: ReturnType<typeof run>): void { assert.equal(result.status, 0, `render failed: ${result.error ?? result.stderr}`) }

function delivered(f: Fixture): void {
  assert.ok(existsSync(join(f.dir, 'kol.csv')), 'render did not produce the delivery CSV')
  assert.ok(readFileSync(join(f.dir, 'kol.csv'), 'utf8').includes(handle), 'candidate absent from delivery CSV')
  assert.ok(json(join(f.dir, 'creators.json')).some((c: any) => c.handle === handle), 'candidate absent from structured delivery')
}

function omitted(f: Fixture, earlierRecommendations = 0): void {
  assert.ok(existsSync(join(f.dir, 'kol.csv')), 'render did not produce the delivery CSV')
  assert.ok(!readFileSync(join(f.dir, 'kol.csv'), 'utf8').includes(handle), 'contacted or blocked candidate reached delivery CSV')
  assert.ok(!json(join(f.dir, 'creators.json')).some((c: any) => c.handle === handle), 'contacted or blocked candidate reached structured delivery')
  const saved = json(f.memory).creators[`tiktok:${handle}`]
  assert.equal(saved.recommendations.length, earlierRecommendations, 'excluded candidate was written as a new recommendation')
  assert.equal(json(join(f.dir, 'meta.json')).memory_status, 'ok', 'delivery did not declare checked memory')
  assert.equal(json(join(f.dir, 'task.json')).memory_status, 'ok', 'task state did not record the current memory check')
}

function unreadable(f: Fixture, reason: string): void {
  const paths = [f.memory, join(f.dir, 'task.json'), join(f.dir, 'creators.json')]
  const before = paths.map(path => readFileSync(path))
  const refused = run(f)
  assert.equal(refused.status, 2, `${reason} should stop render: ${refused.stderr}`)
  for (const file of ['kol.csv', 'kol.xlsx', 'meta.json', 'report.html'])
    assert.ok(!existsSync(join(f.dir, file)), `${file} was written despite ${reason}`)
  paths.forEach((path, i) => assert.deepEqual(readFileSync(path), before[i]))
  success(run(f, true)); delivered(f)
  for (const file of ['meta.json', 'task.json'])
    assert.equal(json(join(f.dir, file)).memory_status, 'unreadable_ignored')
  assert.match(readFileSync(join(f.dir, 'report.html'), 'utf8'), /本次.{0,20}(未做|没有做).{0,12}去重/)
  assert.deepEqual(readFileSync(f.memory), before[0], `ignore overwrote ${reason}`)
}

let failed = 0
function check(name: string, action: () => void): void {
  try { action(); process.stdout.write(`✓ ${name}\n`) }
  catch (error) { failed++; process.stderr.write(`✗ ${name}: ${error}\n`) }
}

try {
  // Positive control: the fixture must be renderable before a negative result counts.
  check('fixture control: unmarked linked creator is deliverable', () => {
    const f = fixture('safe-linked', true)
    putMemory(f)
    success(run(f))
    delivered(f)
  })

  for (const marked of ['primary-contacted', 'primary-blocked', 'linked-contacted', 'linked-blocked'] as const) {
    check(`current ${marked} excludes the person before output and memory write`, () => {
      const f = fixture(marked, true)
      putMemory(f, marked)
      success(run(f))
      omitted(f)
    })
  }

  check('render rereads current memory even when task status already says ok', () => {
    const f = fixture('repeat-after-contact')
    success(run(f))
    delivered(f)
    const saved = json(f.memory)
    const earlierRecommendations = saved.creators[`tiktok:${handle}`].recommendations.length
    saved.creators[`tiktok:${handle}`].contacted = true
    writeJson(f.memory, saved)
    const task = json(join(f.dir, 'task.json'))
    task.memory_status = 'ok'
    writeJson(join(f.dir, 'task.json'), task)
    success(run(f))
    omitted(f, earlierRecommendations)
  })

  check('unreadable memory stops delivery, and explicit ignore declares no deduplication', () => {
    const f = fixture('bad-memory')
    mkdirSync(dirname(f.memory), { recursive: true })
    writeFileSync(f.memory, '{not valid JSON')
    unreadable(f, 'invalid JSON memory')
  })

  check('recommendation from this same task permits a legitimate repeat render', () => {
    const f = fixture('same-task-repeat')
    success(run(f))
    delivered(f)
    const saved = json(f.memory).creators[`tiktok:${handle}`]
    assert.ok(saved.recommendations.some((r: any) => r.task === f.taskId), 'first render did not create a same-task recommendation')
    success(run(f))
    delivered(f)
  })

} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}

if (failed) process.exitCode = 1
