// KOL-21 C1 · 入口启动表（每一跑一个全新 <RUN>，:25；同一跑被多条用例共用时只起一次，:1926）
// 命令行一律为参数数组、绝对路径、不经 shell / npm（冻结单 pack/30-frozen-spec.md:42-48；ADR-70:3232）。
// apiKey 缺省 placeholder，注明 absent 的除外；入口环境 TZ=UTC 由观察器白名单给出（:48；ADR-70:3235-3236）。
import type { RunDef } from './lib/judge.ts'
import type { SavePoint, ApiKey } from './lib/contract.ts'
import {
  CFG, COST, DIR, EMPTY_LIST, F_DONE_LINES, F_MEM_BAD, F_OLD_LINES, F_PAY_LINES, G6_K, G6_K3, G6_TASK, G6_U, G6_U3, MEMORY_BAD,
  deleteLine, fileBytes, g6List, replaceLine, withCost,
} from './fixtures.ts'

// probe：['--config','<RUN>/cwd/probe.json']（:43；README.md:154）
function probe(id: string, cfg: string, script: string): RunDef {
  return { id, entry: 'probe', script, files: { 'probe.json': fileBytes(cfg) }, configRel: 'probe.json', args: (cwd) => ['--config', `${cwd}/probe.json`] }
}
// collect 新建：['--config','<RUN>/cwd/config.json']，带预算参数时再加 ['--budget','<文本>']（:44；README.md:157；D16.k；D13.u）
function fresh(id: string, cfg: string, script: string, extra: string[] = [], apiKey?: ApiKey): RunDef {
  return { id, entry: 'collect', script, apiKey, files: { 'config.json': fileBytes(cfg) }, configRel: 'config.json', args: (cwd) => ['--config', `${cwd}/config.json`, ...extra] }
}
// 任务目录（:207-210）：creators.raw.json 与 creators.json 都是 []；task.json 按行数组原样写盘
function taskDir(dir: string, lines: string[], memory = false): Record<string, string> {
  const f: Record<string, string> = {
    [`${dir}/creators.raw.json`]: fileBytes(EMPTY_LIST),
    [`${dir}/creators.json`]: fileBytes(EMPTY_LIST),
    [`${dir}/task.json`]: fileBytes(lines.join('\n')),
  }
  if (memory) f['memory/creators.json'] = fileBytes(MEMORY_BAD)
  return f
}
// collect 续跑：['--resume','<任务目录绝对路径>']，改额再加 ['--budget','<文本>']（:45；README.md:160；skill/SKILL.md:181）
function resume(id: string, dir: string, lines: string[], script: string, o: { extra?: string[]; apiKey?: ApiKey; memory?: boolean; e2?: { point: SavePoint; k: number } } = {}): RunDef {
  return {
    id, entry: 'collect', script, apiKey: o.apiKey, e2: o.e2, files: taskDir(dir, lines, o.memory), taskRel: `${dir}/task.json`,
    args: (cwd) => ['--resume', `${cwd}/${dir}`, ...(o.extra ?? [])],
  }
}
// render：['--dir','<任务目录绝对路径>']（:46；README.md:172）
function render(id: string, dir: string, files: Record<string, string>): RunDef {
  return { id, entry: 'render', script: 'S-TRAP', files, taskRel: `${dir}/task.json`, args: (cwd) => ['--dir', `${cwd}/${dir}`] }
}
// render + F-MEM-BAD（F 节 :1953-1966）：任务目录文件之外，在 <RUN>/cwd/memory/creators.json 写入 F-MEM-BAD（:1959）。
// ignoreMemory = true：命令行在 ['--dir','<任务目录绝对路径>'] 后面加 '--ignore-memory'，不给它操作数（:1955；A.0.2 :47 的仅有例外，只限 G3-19、G3-19N）；
// ignoreMemory = false：对照跑 Q-MEM、Q-MEM-N，命令行与普通 render 相同（:1978、:2019「不加」）。脚本 S-TRAP（由 render() 给出）。
function renderMemBad(id: string, dir: string, files: Record<string, string>, ignoreMemory: boolean): RunDef {
  const base = render(id, dir, { ...files, 'memory/creators.json': fileBytes(F_MEM_BAD) })
  return ignoreMemory ? { ...base, args: (cwd) => [...base.args(cwd), '--ignore-memory'] } : base
}
const PAY = (slot: string[]): string[] => withCost(F_PAY_LINES, slot)
const DONE = (slot: string[]): string[] => withCost(F_DONE_LINES, slot)
const g6Files = (list: string): Record<string, string> => ({
  [`${DIR['F-G6']}/task.json`]: fileBytes(G6_TASK),
  [`${DIR['F-G6']}/creators.json`]: fileBytes(list),
  [`${DIR['F-G6']}/creators.raw.json`]: fileBytes(list),
})

export const RUNS: RunDef[] = [
  // ---------------- G1 probe ----------------
  probe('G1-01', CFG['G1-01'], 'S-G1-PROBE'),
  probe('G1-01B', CFG['G1-01B'], 'S-G1-PROBE'),
  probe('G1-03', CFG['G1-03'], 'S-G1-REGION'),
  probe('G1-05', CFG['G1-05'], 'S-TRAP'),
  probe('G1-07', CFG['G1-07'], 'S-TRAP'),
  probe('G1-09', CFG['G1-09'], 'S-TRAP'),
  probe('G1-11', CFG['G1-11'], 'S-TRAP'),
  probe('G1-13', CFG['G1-13'], 'S-TRAP'),
  probe('G1-15', CFG['G1-15'], 'S-TRAP'),
  probe('G1-17', CFG['G1-17'], 'S-TRAP'),
  probe('G1-19', CFG['G1-19'], 'S-G1-PROBE'),
  probe('G1-24', CFG['G1-24'], 'S-G1-PROBE'),
  // ---------------- G1 collect 新建 ----------------
  fresh('G1-02', CFG['G1-02'], 'S-SEARCH-402'),
  fresh('G1-02P', CFG['G1-02P'], 'S-TRAP'),
  fresh('G1-02B', CFG['G1-02B'], 'S-SEARCH-402'),
  fresh('G1-02C', CFG['G1-02C'], 'S-SEARCH-402'),
  fresh('G1-02U', CFG['G1-02'], 'S-SEARCH-402', ['--budget', '3']),
  fresh('G1-02W', CFG['G1-02'], 'S-TRAP', ['--budget', 'abc']),
  fresh('G1-02X', CFG['G1-02'], 'S-TRAP', ['--budget']),
  fresh('G1-03C', CFG['G1-03C'], 'S-SEARCH-402-REGION'),
  fresh('G1-04', CFG['G1-04'], 'S-TRAP'),
  fresh('G1-06', CFG['G1-06'], 'S-TRAP'),
  fresh('G1-08', CFG['G1-08'], 'S-TRAP'),
  fresh('G1-10', CFG['G1-10'], 'S-TRAP'),
  fresh('G1-12', CFG['G1-12'], 'S-TRAP'),
  fresh('G1-14', CFG['G1-14'], 'S-TRAP'),
  fresh('G1-16', CFG['G1-16'], 'S-TRAP'),
  fresh('G1-18', CFG['G1-18'], 'S-TRAP'),
  // ---------------- G1 collect 续跑（F-PAY + L0 的单行改写，:611、:622、:632、:639）----------------
  resume('G1-20', DIR['F-PAY'], replaceLine(PAY(COST.L0), '  "done": [],', '  "done": [0, 0],'), 'S-TRAP'),
  resume('G1-21', DIR['F-PAY'], replaceLine(PAY(COST.L0), '  "offsets": {},', '  "offsets": {"0": null},'), 'S-TRAP'),
  resume('G1-22', DIR['F-PAY'], replaceLine(PAY(COST.L0), '  "done": [],', '  "done": [0, 0],'), 'S-TRAP', { extra: ['--budget', '3'] }),
  resume('G1-23', DIR['F-PAY'], deleteLine(PAY(COST.L0), '  "target_count": 50,'), 'S-TRAP'),
  // ---------------- G2 F-PAY 续跑 ----------------
  resume('G2-00', DIR['F-PAY'], PAY(COST.L0), 'S-SEARCH-402'),
  resume('G2-01', DIR['F-PAY'], PAY(COST.P2), 'S-SEARCH-402'),
  resume('G2-02', DIR['F-PAY'], PAY(COST.B1), 'S-TRAP'),
  resume('G2-03', DIR['F-PAY'], PAY(COST.B2), 'S-TRAP'),
  resume('G2-04', DIR['F-PAY'], PAY(COST.B3), 'S-TRAP'),
  resume('G2-04Z', DIR['F-PAY'], PAY(COST.B3z), 'S-TRAP'),
  resume('G2-05', DIR['F-PAY'], PAY(COST.B3b), 'S-TRAP'),
  resume('G2-06', DIR['F-PAY'], PAY(COST.B3), 'S-TRAP', { extra: ['--budget', '5'] }),
  resume('G2-07', DIR['F-PAY'], PAY(COST.B4), 'S-TRAP'),
  resume('G2-08', DIR['F-PAY'], PAY(COST.B5), 'S-TRAP'),
  resume('G2-09', DIR['F-PAY'], PAY(COST.B6), 'S-TRAP'),
  resume('G2-10', DIR['F-PAY'], PAY(COST.PD), 'S-TRAP'),
  resume('G2-11', DIR['F-PAY'], PAY(COST.PD), 'S-TRAP', { extra: ['--budget', '3'] }),
  resume('G2-12', DIR['F-PAY'], PAY(COST.B7), 'S-TRAP'),
  // ---------------- G2 F-DONE 续跑 ----------------
  resume('G2-13', DIR['F-DONE'], DONE(COST.B3), 'S-TRAP'),
  resume('G2-13Z', DIR['F-DONE'], DONE(COST.B3z), 'S-TRAP'),
  resume('G2-14', DIR['F-DONE'], DONE(COST.B1), 'S-TRAP'),
  resume('G2-15', DIR['F-DONE'], DONE(COST.B4), 'S-TRAP'),
  resume('G2-15C', DIR['F-DONE'], DONE(COST.B2), 'S-TRAP'),
  resume('G2-16', DIR['F-DONE'], DONE(COST.L0), 'S-TRAP', { apiKey: 'absent' }),
  resume('G2-16P', DIR['F-DONE'], DONE(COST.PD), 'S-TRAP'),
  resume('G2-24', DIR['F-DONE'], DONE(COST.LNB), 'S-TRAP'),
  // ---------------- G2 render ----------------
  render('G2-17', DIR['F-PAY'], taskDir(DIR['F-PAY'], PAY(COST.L0))),
  render('G2-18', DIR['F-PAY'], taskDir(DIR['F-PAY'], PAY(COST.PD))),
  render('G2-19', DIR['F-PAY'], taskDir(DIR['F-PAY'], PAY(COST.B3))),
  render('G2-20', DIR['F-PAY'], taskDir(DIR['F-PAY'], PAY(COST.B2))),
  render('G2-21', DIR['F-PAY'], taskDir(DIR['F-PAY'], PAY(COST.B3z))),
  // ---------------- G3 collect 新建 ----------------
  fresh('G3-01', CFG['G3-01'], 'S-G3-TARGET'),
  fresh('G3-04', CFG['G3-04'], 'S-TRAP'),
  fresh('G3-05', CFG['G3-05'], 'S-G3-BUDGET1'),
  fresh('G3-06', CFG['G3-06'], 'S-SEARCH-402'),
  fresh('G3-07', CFG['G3-07'], 'S-G3-P402'),
  fresh('G3-07T', CFG['G3-07'], 'S-G3-P-OK'),
  fresh('G3-08', CFG['G3-08'], 'S-G3-IG402'),
  fresh('G3-09', CFG['G3-09'], 'S-TRAP', [], 'absent'),
  fresh('G3-11', CFG['G3-11'], 'S-TRAP'),
  fresh('G3-11B', CFG['G3-11B'], 'S-TRAP'),
  fresh('G3-11N', CFG['G3-11N'], 'S-TRAP'),
  // ---------------- G3 collect 续跑 ----------------
  resume('G3-02', DIR['F-DONE'], DONE(COST.L0), 'S-TRAP'),
  resume('G3-03', DIR['F-OLD'], withCost(F_OLD_LINES, COST.L0), 'S-TRAP'),
  resume('G3-04R', DIR['F-PAY'], PAY(COST.L0z), 'S-TRAP'),
  resume('G3-10', DIR['F-PAY'], PAY(COST.L0), 'S-TRAP', { extra: ['--budget', 'abc'] }),
  // G3-14 组：E-2 注入点第 1 次（:1251）；没有 E-2 契约就不起（不改目录权限，:1252）
  resume('G3-14a', DIR['F-PAY'], PAY(COST.L0), 'S-TRAP', { e2: { point: 'SP-R', k: 1 } }),
  resume('G3-14b', DIR['F-PAY'], PAY(COST.L0z), 'S-TRAP', { e2: { point: 'SP-BUD', k: 1 } }),
  resume('G3-14c', DIR['F-PAY'], PAY(COST.L0), 'S-TRAP', { e2: { point: 'SP-R', k: 1 }, memory: true }),
  resume('G3-14d', DIR['F-PAY'], PAY(COST.L0), 'S-SAVE-200', { e2: { point: 'SP-200', k: 1 } }),
  resume('G3-14e', DIR['F-PAY'], PAY(COST.L0), 'S-SAVE-404', { e2: { point: 'SP-N200', k: 1 } }),
  resume('G3-14f', DIR['F-PAY'], PAY(COST.L0), 'S-SAVE-NS', { e2: { point: 'SP-NS', k: 1 } }),
  resume('G3-15', DIR['F-DONE'], DONE(COST.L0), 'S-TRAP', { memory: true }),
  // ---------------- G3 render + F-MEM-BAD（F 节 :1932-2053，D4.t 补例；每一跑各自全新的 <RUN>）----------------
  // Q-MEM、Q-MEM-N 是资格对照跑，不另编号、不计入用例数（:1976、:2019、:2053）。
  renderMemBad('Q-MEM', DIR['F-PAY'], taskDir(DIR['F-PAY'], PAY(COST.L0)), false),            // :1978 F-PAY（L0），不加 --ignore-memory
  renderMemBad('G3-19', DIR['F-PAY'], taskDir(DIR['F-PAY'], PAY(COST.L0)), true),             // :1986-1987
  renderMemBad('Q-MEM-N', DIR['F-G6'], g6Files(g6List(G6_U, G6_K)), false),                   // :2019 F-G6（G6-01 的顺序、U 在前），不加 --ignore-memory
  renderMemBad('G3-19N', DIR['F-G6'], g6Files(g6List(G6_U, G6_K)), true),                     // :2015-2016
  // ---------------- G4 render 阳性对照（control，:1375）----------------
  { id: 'G4-04', entry: 'control', script: 'S-CONTROL', files: {}, args: () => ['fetch', 'http://kol21-control.invalid/kol21/control'] },
  // ---------------- G6 名单层（F-G6，:1473-1502；G6-02 只换数组顺序，G6-03 只换身份）----------------
  render('G6-01', DIR['F-G6'], g6Files(g6List(G6_U, G6_K))),
  render('G6-02', DIR['F-G6'], g6Files(g6List(G6_K, G6_U))),
  render('G6-03', DIR['F-G6'], g6Files(g6List(G6_U3, G6_K3))),
]
