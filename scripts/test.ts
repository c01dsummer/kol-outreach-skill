import { extractEmail, PR_SIGNALS } from './lib/email.js'
import { linkCrossPlatform, mergeCrossPlatform } from './lib/identity.js'
import { scoreCreator, tierOf } from './lib/score.js'
import { esc } from './lib/csv.js'
import type { Creator } from './lib/types.js'

let fail = 0
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fail++; console.log(`  ✗ ${label}\n     got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`) }
  else console.log(`  ✓ ${label}`)
}

console.log('\n[email]')
eq('普通', extractEmail('biz: sarah@gmail.com'), 'sarah@gmail.com')
eq('(at)/(dot)', extractEmail('📩 sarahbiz (at) gmail (dot) com'), 'sarahbiz@gmail.com')
eq('[at]', extractEmail('hi[at]brand[dot]co'), 'hi@brand.co')
eq('空格 at', extractEmail('press at mybrand dot com'), 'press@mybrand.com')
eq('无邮箱', extractEmail('just a bio 🌸'), null)
eq('空串', extractEmail(''), null)
eq('不误判 "look at x.com"', extractEmail('look at gmail.com for more'), null)
eq('不误判文件名', extractEmail('logo@2x.png'), null)
eq('.co 域名', extractEmail('hi@brand.co'), 'hi@brand.co')
eq('PR 信号', PR_SIGNALS.test('DM for collabs'), true)
eq('PR 中文', PR_SIGNALS.test('商务合作请私信'), true)
eq('PR 无', PR_SIGNALS.test('just vibes'), false)

console.log('\n[cross-platform]')
const mk = (p: 'tiktok'|'instagram', h: string, links: string[] = []): Creator => ({
  platform: p, handle: h, nickname: h, followers: 10000, post_count: 50,
  bio: '', bio_links: links, verified: false, profile_url: '',
  source_keyword: 'k', source_dimension: 'category', recent_posts: [],
})
const a = [mk('tiktok','sarahtech',['https://instagram.com/sarah.tech']), mk('instagram','sarah.tech')]
eq('外链互指', linkCrossPlatform(a), 1)
eq('标记', [a[0].cross_platform, a[0].linked_handle], [true, 'instagram:sarah.tech'])

const b = [mk('tiktok','danvlogs'), mk('instagram','danvlogs')]
eq('handle 相同', linkCrossPlatform(b), 1)

const c = [mk('tiktok','mei_cooks'), mk('instagram','meicooks')]
eq('去标点相同', linkCrossPlatform(c), 1)

const d = [mk('tiktok','alpha'), mk('instagram','beta')]
eq('不相关不合并', linkCrossPlatform(d), 0)

console.log('\n[merge]')
const m1 = mk('tiktok','sarah',['https://instagram.com/sarah']); m1.followers=82000; m1.email='a@b.com'
const m2 = mk('instagram','sarah'); m2.followers=31000
const pair2 = [m1, m2]
linkCrossPlatform(pair2)
const merged = mergeCrossPlatform(pair2)
eq('合并后只剩一条', merged.length, 1)
eq('粉丝求和', merged[0].followers, 113000)
eq('保留有邮箱的一条为主', merged[0].platform, 'tiktok')

console.log('\n[score/tier]')
const s1 = mk('tiktok','x'); s1.email='a@b.com'; s1.source_dimension='competitor'; s1.post_count=50
eq('分数', scoreCreator(s1), 30+20+15+10)
s1.fit='✅'; s1.score=scoreCreator(s1)
eq('A 级', tierOf(s1), 'A')
s1.fit='❌'
eq('❌ 一票否决', tierOf(s1), 'C')
const s2 = mk('tiktok','y'); s2.fit='✅'; s2.score=45
eq('强相关缺邮箱→B', tierOf(s2), 'B')

console.log('\n[csv]')
eq('含逗号', esc('a,b'), '"a,b"')
eq('含引号', esc('say "hi"'), '"say ""hi"""')
eq('含换行', esc('l1\nl2'), '"l1\nl2"')
eq('普通', esc('plain'), 'plain')

console.log(fail ? `\n${fail} 个失败\n` : '\n全部通过\n')
process.exit(fail ? 1 : 0)
