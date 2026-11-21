// supabase/schema.sql 검사 (npm run test:db). PGlite = WASM PostgreSQL, Supabase의 auth 스키마·역할은 흉내 냄
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

const db = new PGlite()
const q = (sql, params) => db.query(sql, params)
let fails = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) fails++
}

// Supabase 환경 흉내
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
  -- 새 Supabase 프로젝트처럼: 테이블 권한을 자동으로 주지 않음 → schema.sql 의 grant 만으로 앱이 동작해야 함
  -- (함수는 PostgreSQL 기본값대로 PUBLIC 실행 가능, 막을 함수는 schema.sql 에서 revoke)
`)
await db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
await db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')) // 두 번 실행해도 안전한지

// supabase/migrations/*.sql (Supabase GitHub 연동이 자동 적용) 을 순서대로 이어 붙인 것 = schema.sql 이어야 함
{
  const dir = new URL('./migrations/', import.meta.url)
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  const joined = files.map((f) => readFileSync(new URL(f, dir), 'utf8')).join('')
  check('migrations match schema.sql', joined === readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'), files.join(', '))
}
check('schema runs twice without error', true)
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant select on all tables in schema public to anon, authenticated;
  grant insert, update on public.profiles, public.progress to authenticated;
`)

const U = { noy: '11111111-1111-1111-1111-111111111111', keo: '22222222-2222-2222-2222-222222222222', ploy: '33333333-3333-3333-3333-333333333333' }
for (const id of Object.values(U)) await q('insert into auth.users values ($1)', [id])
await q(`insert into profiles (id, display_name, country) values ($1,'Noy','LA'),($2,'Keo','LA'),($3,'Ploy','TH')`, [U.noy, U.keo, U.ploy])

const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
const award = (uid, kind, ref, pts) => as(uid, async () => (await q('select award_points($1,$2,$3) as n', [kind, ref, pts])).rows[0].n)

check('study 5 points', (await award(U.noy, 'study', null, 5)) === 5)
check('study capped at 10 per call', (await award(U.noy, 'study', null, 50)) === 10)
let total = 15
for (let i = 0; i < 60; i++) total += await award(U.noy, 'study', null, 10)
check('study daily cap 400', total === 400, `total=${total}`)
check('exam bonus 100', (await award(U.noy, 'exam', 'r1', 100)) === 100)
check('exam bonus only once', (await award(U.noy, 'exam', 'r1', 100)) === 0)
check('exam bad ref rejected', (await award(U.noy, 'exam', 'hack', 100)) === 0)
check('promo capped at 300', (await award(U.noy, 'promo', '1', 9999)) === 300)
check('unknown kind rejected', (await award(U.noy, 'cheat', null, 100)) === 0)

await award(U.keo, 'study', null, 10)
await award(U.keo, 'study', null, 10)
await award(U.ploy, 'study', null, 10)
await award(U.ploy, 'exam', 'r2', 100)
// 지난달 점수 (월간에서 빠져야 함) / 오늘 아닌 이번 달 점수 (오늘 랭킹에서 빠져야 함)
await q(`insert into point_events (user_id, kind, ref, points, created_at) values ($1,'study',null,999, period_start('month') - interval '1 day')`, [U.keo])
const firstOfMonth = (await q(`select period_start('month') = period_start('today') as same`)).rows[0].same
if (!firstOfMonth) await q(`insert into point_events (user_id, kind, ref, points, created_at) values ($1,'exam','r3',100, period_start('month') + interval '1 hour')`, [U.keo])

const lb = async (period, country) => (await as(U.keo, () => q('select rank, display_name, country, points from get_leaderboard($1,$2,50)', [period, country]))).rows
const monthAll = await lb('month', null)
console.log('  month/all:', monthAll.map((r) => `${r.rank}.${r.display_name}(${r.country}) ${r.points}`).join(' | '))
check('month ranking excludes last month', !monthAll.some((r) => Number(r.points) >= 999))
check('month ranking order', monthAll[0].display_name === 'Noy' && Number(monthAll[0].points) === 800)
const monthLA = await lb('month', 'LA')
check('country filter (LA only)', monthLA.every((r) => r.country === 'LA') && monthLA.length === 2)
const monthTH = await lb('month', 'TH')
check('rank restarts per country', monthTH.length === 1 && Number(monthTH[0].rank) === 1)
const today = await lb('today', null)
const keoToday = today.find((r) => r.display_name === 'Keo')
check('today ranking excludes earlier days', firstOfMonth || Number(keoToday.points) === 20, `keo today=${keoToday?.points}`)
const mine = await as(U.ploy, async () => (await q(`select * from get_my_rank('month', null)`)).rows[0])
check('my rank', Number(mine.rank) >= 1 && Number(mine.total) === 3, JSON.stringify(mine))

// 권한: 직접 점수 쓰기 막힘, 남의 프로필 수정 막힘, 남의 진도 안 보임
let blocked = false
try {
  await as(U.keo, () => q(`insert into point_events (user_id, kind, points) values ($1,'study',10)`, [U.keo]))
} catch {
  blocked = true
}
check('direct insert into point_events blocked', blocked)
await as(U.keo, () => q(`update profiles set display_name='HACK' where id=$1`, [U.noy]))
check("cannot edit someone else's profile", (await q('select display_name from profiles where id=$1', [U.noy])).rows[0].display_name === 'Noy')
await as(U.noy, () => q(`insert into progress (user_id, data) values ($1, '{"steps":{"r1":2}}')`, [U.noy]))
const seen = await as(U.keo, () => q('select * from progress'))
check("cannot read someone else's progress", seen.rows.length === 0)
const own = await as(U.noy, () => q('select data from progress'))
check('can read own progress', own.rows.length === 1)
let anonBlocked = false
try {
  await db.exec(`set role anon;`)
  await q(`select award_points('study', null, 10)`)
} catch {
  anonBlocked = true
} finally {
  await db.exec('reset role')
}
check('anonymous cannot award points', anonBlocked)

await as(U.noy, () => q('select delete_my_data()'))
const left = (await q('select (select count(*) from point_events where user_id=$1) + (select count(*) from profiles where id=$1) + (select count(*) from progress where user_id=$1) as n', [U.noy])).rows[0].n
check('delete_my_data removes everything', Number(left) === 0)
check('realtime publication includes point_events', (await q(`select count(*) n from pg_publication_tables where pubname='supabase_realtime' and tablename='point_events'`)).rows[0].n == 1)

// ───────── 스터디 그룹 / 커뮤니티 ─────────
console.log('\n  -- study groups --')
const G = {
  bee: 'aaaaaaaa-0000-0000-0000-000000000001', // 방장
  mai: 'aaaaaaaa-0000-0000-0000-000000000002', // 멤버 (먼저 가입)
  som: 'aaaaaaaa-0000-0000-0000-000000000003', // 멤버 (나중에 가입)
  nok: 'aaaaaaaa-0000-0000-0000-000000000004', // 멤버 아님
  dao: 'aaaaaaaa-0000-0000-0000-000000000005', // 내 데이터 삭제
}
for (const id of Object.values(G)) await q('insert into auth.users values ($1)', [id])
await q(
  `insert into profiles (id, display_name, avatar_url, country) values ($1,'Bee','https://img/bee.jpg','LA'),($2,'Mai',null,'TH'),($3,'Som',null,'LA'),($4,'Nok',null,'LA'),($5,'Dao',null,'TH')`,
  Object.values(G),
)
// 오류 메시지 ('' = 오류 없음)
const errOf = async (fn) => {
  try {
    await fn()
    return ''
  } catch (e) {
    return e.message
  }
}
const one = async (uid, sql, params) => (await as(uid, () => q(sql, params))).rows[0]
const val = async (uid, sql, params) => Object.values(await one(uid, sql, params))[0]
const asErr = (uid, sql, params) => errOf(() => as(uid, () => q(sql, params)))
// PGlite 시계는 1ms 단위라 연달아 실행하면 시각이 겹칠 수 있음 → 순서가 중요한 검사는 시각을 직접 정해 둠
const setJoinOrder = async (groupId, uids) => {
  for (const [i, uid] of uids.entries())
    await q(`update group_members set joined_at = now() - interval '1 hour' + $3 * interval '1 minute' where group_id=$1 and user_id=$2`, [groupId, uid, i])
}
const setPostAge = (postId, minutesAgo) => q(`update posts set created_at = now() - $2 * interval '1 minute' where id=$1`, [postId, minutesAgo])

const wk = (await q(`select extract(isodow from period_start('week') at time zone 'Asia/Vientiane') as dow,
  (period_start('week') at time zone 'Asia/Vientiane')::time::text as t,
  period_start('week') <= now() and period_start('week') > now() - interval '7 days' as recent,
  period_start('week') <= period_start('today') as before_today`)).rows[0]
check("period_start('week') = this Monday 00:00 (Vientiane)", Number(wk.dow) === 1 && wk.t === '00:00:00' && wk.recent && wk.before_today, JSON.stringify(wk))

let e = await errOf(async () => {
  await db.exec('set role authenticated')
  try {
    await q(`select create_group('x')`)
  } finally {
    await db.exec('reset role')
  }
})
check('create_group requires login (not_logged_in)', e.includes('not_logged_in'), e)

// 만들기 / 가입
const g1 = await val(G.bee, `select create_group('  Korean Club ', '📚')`)
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
check(
  'create_group returns 6-char code + owner info',
  CODE_RE.test(g1.code) && g1.name === 'Korean Club' && g1.emoji === '📚' && g1.owner === G.bee && g1.role === 'owner' && g1.member_count === 1,
  JSON.stringify(g1),
)
check('creator is an owner member', (await q('select role from group_members where group_id=$1 and user_id=$2', [g1.id, G.bee])).rows[0]?.role === 'owner')
const joined = await val(G.mai, 'select join_group($1)', [`  ${g1.code.toLowerCase()} `])
check('join by lower-case code with spaces', joined.id === g1.id && joined.role === 'member' && joined.member_count === 2 && joined.code === g1.code, JSON.stringify(joined))
const again = await val(G.mai, 'select join_group($1)', [g1.code])
check('joining again just returns the group', again.id === g1.id && again.member_count === 2 && again.role === 'member')
await val(G.som, 'select join_group($1)', [g1.code])
await setJoinOrder(g1.id, [G.bee, G.mai, G.som])
e = await asErr(G.nok, `select join_group('ZZZZZZ')`)
check('unknown code → not_found', e.includes('not_found'), e)
const maiGroups = await val(G.mai, 'select my_groups()')
check(
  'my_groups shape',
  Array.isArray(maiGroups) && maiGroups.length === 1 && maiGroups[0].id === g1.id && maiGroups[0].member_count === 3 && maiGroups[0].role === 'member' && maiGroups[0].code === g1.code && maiGroups[0].owner === G.bee,
  JSON.stringify(maiGroups),
)
check('my_groups empty → []', JSON.stringify(await val(G.nok, 'select my_groups()')) === '[]')
const g1b = await val(G.bee, `select create_group('Second')`)
check("default emoji '🐘'", g1b.emoji === '🐘')

// 글 쓰기
const brag = await one(G.mai, `insert into posts (group_id, kind, body, data) values ($1,'brag','I learned 50 words!','{"words":50}') returning id, user_id, verified`, [g1.id])
check('member inserts a brag post', brag.user_id === G.mai && brag.verified === false)
e = await asErr(G.mai, `insert into posts (group_id, kind, body) values ($1,'achievement','fake')`, [g1.id])
check("member cannot insert kind 'achievement'", e !== '', e)
e = await asErr(G.mai, `insert into posts (group_id, kind, body, verified) values ($1,'brag','fake',true)`, [g1.id])
check('member cannot insert verified=true', e !== '', e)
e = await asErr(G.mai, `insert into posts (group_id, user_id, kind, body) values ($1,$2,'text','as Bee')`, [g1.id, G.bee])
check("cannot post as someone else", e !== '', e)
e = await asErr(G.nok, `insert into posts (group_id, kind, body) values ($1,'text','hi')`, [g1.id])
check('non-member cannot post', e !== '', e)
const future = await one(G.som, `insert into posts (group_id, kind, body, created_at) values ($1,'text','from the future', now() + interval '1 year') returning id, created_at <= now() as ok`, [g1.id])
check('client-supplied created_at ignored', future.ok === true)
await as(G.som, () => q('delete from posts where id=$1', [future.id]))
await as(G.mai, () => q(`update posts set verified = true, body = 'edited' where id=$1`, [brag.id])).catch(() => {}) // 권한 없음(42501) 또는 RLS로 0행 — 둘 다 막힌 것
check('posts cannot be updated', (await q('select verified, body from posts where id=$1', [brag.id])).rows[0].body === 'I learned 50 words!')

// 멤버가 아니면 안 보임
check('non-member cannot see the group', (await as(G.nok, () => q('select * from groups where id=$1', [g1.id]))).rows.length === 0)
check('non-member cannot see members', (await as(G.nok, () => q('select * from group_members where group_id=$1', [g1.id]))).rows.length === 0)
check("non-member cannot select the group's posts", (await as(G.nok, () => q('select * from posts where group_id=$1', [g1.id]))).rows.length === 0)
check('member sees members', (await as(G.som, () => q('select * from group_members where group_id=$1', [g1.id]))).rows.length === 3)
e = await asErr(G.nok, 'select group_feed($1)', [g1.id])
check('non-member group_feed → not_member', e.includes('not_member'), e)
e = await asErr(G.nok, 'select group_ranking($1)', [g1.id])
check('non-member group_ranking → not_member', e.includes('not_member'), e)
e = await asErr(G.nok, `select toggle_reaction($1, '👏')`, [brag.id])
check('non-member toggle_reaction → not_member', e.includes('not_member'), e)
e = await asErr(G.nok, `insert into reactions (post_id, emoji) values ($1, '👏')`, [brag.id])
check('non-member cannot insert a reaction directly', e !== '', e)

// 시험 통과 → 인증 글 자동 게시
check('exam award', (await award(G.mai, 'exam', 'r5', 100)) === 100)
const ach = (await q(`select * from posts where kind='achievement' and user_id=$1`, [G.mai])).rows
check(
  'exam award creates a verified achievement post in the group',
  ach.length === 1 && ach[0].group_id === g1.id && ach[0].verified === true && ach[0].body === '' && ach[0].data.type === 'exam' && ach[0].data.ref === 'r5' && ach[0].data.points === 100,
  JSON.stringify(ach.map((p) => p.data)),
)
await award(G.mai, 'study', null, 10)
await award(G.bee, 'promo', '2', 300)
const beeAch = (await q(`select group_id from posts where kind='achievement' and user_id=$1`, [G.bee])).rows.map((r) => r.group_id).sort()
check('promo award posts to every group of the user, study does not', beeAch.length === 2 && beeAch.join() === [g1.id, g1b.id].sort().join() && (await q(`select count(*)::int n from posts where kind='achievement' and user_id=$1`, [G.mai])).rows[0].n === 1)

// 반응
const t1 = await val(G.bee, `select toggle_reaction($1, '👏')`, [brag.id])
const t2 = await val(G.som, `select toggle_reaction($1, '👏')`, [brag.id])
const t3 = await val(G.bee, `select toggle_reaction($1, '🔥')`, [brag.id])
const t4 = await val(G.bee, `select toggle_reaction($1, '🔥')`, [brag.id])
check('toggle_reaction on → true, again → false', t1 === true && t2 === true && t3 === true && t4 === false)
await val(G.som, `select toggle_reaction($1, '❤️')`, [brag.id])
await val(G.som, `select toggle_reaction($1, '❤️')`, [brag.id])
e = await asErr(G.bee, `select toggle_reaction($1, '👎')`, [brag.id])
check('unknown reaction emoji rejected', e !== '', e)
check('member sees reactions', (await as(G.mai, () => q('select * from reactions where post_id=$1', [brag.id]))).rows.length === 2)
check('non-member cannot see reactions', (await as(G.nok, () => q('select * from reactions where post_id=$1', [brag.id]))).rows.length === 0)
await as(G.mai, () => q(`delete from reactions where post_id=$1`, [brag.id]))
check("cannot delete someone else's reaction", (await q('select count(*)::int n from reactions where post_id=$1', [brag.id])).rows[0].n === 2)

await setPostAge(brag.id, 30)
await setPostAge(ach[0].id, 20)
await q(`update posts set created_at = now() - interval '10 minutes' where kind='achievement' and user_id=$1`, [G.bee])
const feed = await val(G.bee, 'select group_feed($1)', [g1.id])
const fBrag = feed.find((p) => p.id === brag.id)
const fAch = feed.find((p) => p.kind === 'achievement' && p.user_id === G.mai)
check(
  'group_feed shape (name, reactions, mine)',
  fBrag &&
    fBrag.name === 'Mai' &&
    fBrag.avatar === null &&
    fBrag.user_id === G.mai &&
    fBrag.kind === 'brag' &&
    fBrag.body === 'I learned 50 words!' &&
    fBrag.data.words === 50 &&
    fBrag.verified === false &&
    typeof fBrag.created_at === 'string' &&
    JSON.stringify(fBrag.reactions) === JSON.stringify({ '👏': 2 }) &&
    JSON.stringify(fBrag.mine) === JSON.stringify(['👏']),
  JSON.stringify(fBrag),
)
check('group_feed: no reactions → {} and []', fAch && JSON.stringify(fAch.reactions) === '{}' && JSON.stringify(fAch.mine) === '[]' && fAch.verified === true, JSON.stringify(fAch))
const beeAchFeed = feed.find((p) => p.kind === 'achievement' && p.user_id === G.bee)
check('group_feed avatar from profile', beeAchFeed?.avatar === 'https://img/bee.jpg' && beeAchFeed?.name === 'Bee')
const times = feed.map((p) => Date.parse(p.created_at))
check(
  'group_feed newest first',
  feed.length === 3 && feed[0].user_id === G.bee && feed[1].id === ach[0].id && feed[2].id === brag.id && times.every((t, i) => i === 0 || times[i - 1] > t),
  feed.map((p) => p.kind).join(','),
)
const maiFeed = await val(G.mai, 'select group_feed($1)', [g1.id])
check("'mine' is per caller", JSON.stringify(maiFeed.find((p) => p.id === brag.id).mine) === '[]')
const page1 = await val(G.som, 'select group_feed($1, null, 1)', [g1.id])
const page2 = await val(G.som, 'select group_feed($1, $2, 50)', [g1.id, page1[0].created_at])
check('group_feed paging (limit, before)', page1.length === 1 && page1[0].id === feed[0].id && page2.length === 2 && page2[0].id === ach[0].id && page2[1].id === brag.id)
check('group_feed limit clamped to ≥1', (await val(G.som, 'select group_feed($1, null, 0)', [g1.id])).length === 1)

// 그룹 랭킹 (이번 주)
await award(G.bee, 'study', null, 10)
await q(`insert into point_events (user_id, kind, ref, points, created_at) values ($1,'study',null,999, period_start('week') - interval '1 hour')`, [G.bee]) // 지난주 (빠져야 함)
const rk = await val(G.som, 'select group_ranking($1)', [g1.id])
console.log('  group week:', rk.map((r) => `${r.name}(${r.role}) ${r.points}`).join(' | '))
check(
  "group_ranking 'week' sums points and orders",
  rk.length === 3 &&
    rk[0].user_id === G.bee && rk[0].points === 310 && rk[0].role === 'owner' && rk[0].country === 'LA' && rk[0].avatar === 'https://img/bee.jpg' &&
    rk[1].user_id === G.mai && rk[1].points === 110 && rk[1].name === 'Mai' && rk[1].country === 'TH' &&
    rk[2].user_id === G.som && rk[2].points === 0 && rk[2].role === 'member',
  JSON.stringify(rk),
)
const rkToday = await val(G.som, `select group_ranking($1, 'today')`, [g1.id])
check("group_ranking 'today' works", rkToday.find((r) => r.user_id === G.mai).points === 110)

// 그룹 수정 권한
await as(G.bee, () => q(`update groups set name='한국어 반', emoji='🇰🇷' where id=$1`, [g1.id]))
check('owner can rename the group', (await q('select name, emoji from groups where id=$1', [g1.id])).rows[0].name === '한국어 반')
await as(G.mai, () => q(`update groups set name='HACK' where id=$1`, [g1.id]))
check('member cannot rename the group', (await q('select name from groups where id=$1', [g1.id])).rows[0].name === '한국어 반')
e = await asErr(G.bee, `update groups set code='AAAAAA' where id=$1`, [g1.id])
check('owner cannot change the code', e !== '' && (await q('select code from groups where id=$1', [g1.id])).rows[0].code === g1.code, e)
e = await asErr(G.bee, `update groups set owner=$2 where id=$1`, [g1.id, G.som])
check('owner column cannot be changed directly', e !== '', e)
e = await asErr(G.nok, `insert into groups (name, code, owner) values ('x','XXXXXX',$1)`, [G.nok])
check('direct insert into groups blocked', e !== '', e)
e = await asErr(G.nok, `insert into group_members (group_id, user_id) values ($1,$2)`, [g1.id, G.nok])
check('direct insert into group_members blocked', e !== '', e)
await as(G.bee, () => q('delete from groups where id=$1', [g1.id])).catch(() => {}) // 권한 없음(42501) 또는 RLS로 0행
check('direct delete of a group blocked', (await q('select count(*)::int n from groups where id=$1', [g1.id])).rows[0].n === 1)

// 글 삭제 / 멤버 내보내기
const txt = await one(G.mai, `insert into posts (group_id, kind, body) values ($1,'text','hello') returning id`, [g1.id])
await as(G.som, () => q('delete from posts where id=$1', [txt.id]))
check("member cannot delete someone else's post", (await q('select count(*)::int n from posts where id=$1', [txt.id])).rows[0].n === 1)
await as(G.bee, () => q('delete from posts where id=$1', [txt.id]))
check("owner can delete a member's post", (await q('select count(*)::int n from posts where id=$1', [txt.id])).rows[0].n === 0)
const txt2 = await one(G.mai, `insert into posts (group_id, kind, body) values ($1,'text','bye') returning id`, [g1.id])
await as(G.mai, () => q('delete from posts where id=$1', [txt2.id]))
check('author can delete own post', (await q('select count(*)::int n from posts where id=$1', [txt2.id])).rows[0].n === 0)
await val(G.nok, 'select join_group($1)', [g1.code])
await as(G.mai, () => q('delete from group_members where group_id=$1 and user_id=$2', [g1.id, G.bee]))
check('member cannot remove the owner', (await q('select count(*)::int n from group_members where group_id=$1 and user_id=$2', [g1.id, G.bee])).rows[0].n === 1)
await as(G.bee, () => q('delete from group_members where group_id=$1 and user_id=$2', [g1.id, G.nok]))
check('owner can remove a member', (await q('select count(*)::int n from group_members where group_id=$1 and user_id=$2', [g1.id, G.nok])).rows[0].n === 0)

// 나가기: 방장 승계 → 그룹 삭제
await as(G.bee, () => q('select leave_group($1)', [g1.id]))
let grp = (await q('select owner from groups where id=$1', [g1.id])).rows[0]
let roles = Object.fromEntries((await q('select user_id, role from group_members where group_id=$1', [g1.id])).rows.map((r) => [r.user_id, r.role]))
check('owner leaving transfers ownership to earliest member', grp?.owner === G.mai && roles[G.mai] === 'owner' && roles[G.som] === 'member' && !roles[G.bee], JSON.stringify({ grp, roles }))
check('left member no longer sees the group', (await val(G.bee, 'select my_groups()')).every((g) => g.id !== g1.id) && (await as(G.bee, () => q('select * from posts where group_id=$1', [g1.id]))).rows.length === 0)
await as(G.mai, () => q('delete from group_members where group_id=$1 and user_id=$2', [g1.id, G.mai])) // 직접 삭제해도 승계
grp = (await q('select owner from groups where id=$1', [g1.id])).rows[0]
check('owner leaving by direct delete also transfers', grp?.owner === G.som && (await q('select role from group_members where group_id=$1 and user_id=$2', [g1.id, G.som])).rows[0]?.role === 'owner')
await as(G.som, () => q('select leave_group($1)', [g1.id]))
check(
  'last member leaving deletes the group (and its posts)',
  (await q('select count(*)::int n from groups where id=$1', [g1.id])).rows[0].n === 0 && (await q('select count(*)::int n from posts where group_id=$1', [g1.id])).rows[0].n === 0,
)

// 개수 제한
const bulk = Array.from({ length: 54 }, (_, i) => `bbbbbbbb-0000-0000-0000-${String(i + 1).padStart(12, '0')}`)
for (const id of bulk) await q('insert into auth.users values ($1)', [id])
const [o1, o2, o3, joiner] = bulk
const codes = []
for (const o of [o1, o2, o3]) for (let i = 0; i < 7; i++) codes.push((await val(o, 'select create_group($1)', [`G${codes.length + 1}`])).code)
check('codes are unique', new Set(codes).size === 21 && codes.every((c) => CODE_RE.test(c)))
for (let i = 0; i < 20; i++) await val(joiner, 'select join_group($1)', [codes[i]])
check('can be in 20 groups', (await val(joiner, 'select my_groups()')).length === 20)
e = await asErr(joiner, 'select join_group($1)', [codes[20]])
check("21st group join → 'too_many'", e.includes('too_many'), e)
// 가입 시각을 만든 순서와 반대로 → my_groups 는 가입 순서(역순)여야 함
await q(
  `update group_members m set joined_at = now() - c.i * interval '1 minute'
   from groups g join jsonb_array_elements_text($1::jsonb) with ordinality as c(code, i) on c.code = g.code
   where m.group_id = g.id and m.user_id = $2`,
  [JSON.stringify(codes.slice(0, 20)), joiner],
)
const myOrder = (await val(joiner, 'select my_groups()')).map((g) => g.code)
check('my_groups ordered by joined_at', myOrder.join() === codes.slice(0, 20).reverse().join())
for (let i = 0; i < 3; i++) await val(o1, 'select create_group($1)', [`More${i}`])
e = await asErr(o1, `select create_group('Eleventh')`)
check("11th owned group → 'too_many'", e.includes('too_many'), e)
const big = await val(o2, `select create_group('Big')`) // o2: 방장 8개
for (const id of bulk.slice(4, 53)) await val(id, 'select join_group($1)', [big.code]) // 49명 → 50명
check('50 members', (await val(o2, 'select my_groups()')).find((g) => g.id === big.id).member_count === 50)
e = await asErr(bulk[53], 'select join_group($1)', [big.code])
check("51st member → 'full'", e.includes('full'), e)
e = await asErr(G.nok, `select create_group('   ')`)
check('blank group name rejected', e !== '', e)

// 내 데이터 삭제: 반응·글·멤버십, 방장 그룹 승계/삭제
const g2 = await val(G.dao, `select create_group('Dao club')`)
const g3 = await val(G.dao, `select create_group('Dao alone')`)
await val(G.bee, 'select join_group($1)', [g2.code])
await val(G.mai, 'select join_group($1)', [g2.code])
await setJoinOrder(g2.id, [G.dao, G.bee, G.mai])
const daoPost = await one(G.dao, `insert into posts (group_id, kind, body) values ($1,'brag','dao!') returning id`, [g2.id])
const beePost = await one(G.bee, `insert into posts (group_id, kind, body) values ($1,'text','bee!') returning id`, [g2.id])
await val(G.bee, `select toggle_reaction($1, '💪')`, [daoPost.id])
await val(G.dao, `select toggle_reaction($1, '😂')`, [beePost.id])
await award(G.dao, 'exam', 'r1', 100)
await as(G.dao, () => q('select delete_my_data()'))
const daoLeft = (await q(
  `select (select count(*) from group_members where user_id=$1) + (select count(*) from posts where user_id=$1) + (select count(*) from reactions where user_id=$1) + (select count(*) from groups where owner=$1) + (select count(*) from point_events where user_id=$1) + (select count(*) from profiles where id=$1) as n`,
  [G.dao],
)).rows[0].n
check('delete_my_data cleans memberships/posts/reactions', Number(daoLeft) === 0, `left=${daoLeft}`)
grp = (await q('select owner from groups where id=$1', [g2.id])).rows[0]
check('delete_my_data hands owned group to earliest member', grp?.owner === G.bee && (await q('select role from group_members where group_id=$1 and user_id=$2', [g2.id, G.bee])).rows[0]?.role === 'owner')
check('delete_my_data deletes owned group with no one left', (await q('select count(*)::int n from groups where id=$1', [g3.id])).rows[0].n === 0)
check("others' posts survive, reactions on them by the user are gone", (await q('select count(*)::int n from posts where id=$1', [beePost.id])).rows[0].n === 1 && (await q('select count(*)::int n from reactions where post_id=$1', [beePost.id])).rows[0].n === 0)

// 계정(auth.users) 삭제 후에도 그룹이 깨지지 않음
e = await errOf(() => q('delete from auth.users where id=$1', [G.bee]))
grp = (await q('select owner from groups where id=$1', [g2.id])).rows[0]
const orphan = (await q(`select count(*)::int n from groups g where not exists (select 1 from group_members m where m.group_id=g.id and m.user_id=g.owner and m.role='owner')`)).rows[0].n
check('deleting an auth user keeps groups consistent', e === '' && (!grp || grp.owner === G.mai) && orphan === 0, e || JSON.stringify(grp))

// 로그인 안 한 사용자 / 실시간
let anonGroups = ''
try {
  await db.exec('set role anon')
  anonGroups = (await q('select count(*)::int n from groups')).rows[0].n
  await q('select my_groups()')
} catch (err) {
  anonGroups = `${anonGroups}|${err.message}`
} finally {
  await db.exec('reset role')
}
check('anonymous sees no groups and cannot call group functions', String(anonGroups).startsWith('0|'), String(anonGroups))
check('realtime publication includes posts', (await q(`select count(*) n from pg_publication_tables where pubname='supabase_realtime' and tablename='posts'`)).rows[0].n == 1)

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
