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
// 하루 학습 기록·비공개 프로필 테이블 권한은 schema.sql 의 grant 그대로인지 (아래 테스트용 일괄 grant 전에 확인)
{
  const privs = async (role, table) =>
    (await q(`select string_agg(p, ',' order by p) as s from unnest(array['select','insert','update','delete']) p where has_table_privilege($1, $2, p)`, [role, table])).rows[0].s ?? ''
  const got = {
    authActivity: await privs('authenticated', 'public.daily_activity'),
    anonActivity: await privs('anon', 'public.daily_activity'),
    authPrivate: await privs('authenticated', 'public.profile_private'),
    anonPrivate: await privs('anon', 'public.profile_private'),
  }
  check(
    'daily_activity: authenticated select only, anon nothing; profile_private: authenticated select/insert/update/delete, anon nothing',
    got.authActivity === 'select' && got.anonActivity === '' && got.authPrivate === 'delete,insert,select,update' && got.anonPrivate === '',
    JSON.stringify(got),
  )
  const fx = (await q(`select has_function_privilege('anon', 'public.log_activity(date,int,int,int,int)', 'execute') as anon,
    has_function_privilege('authenticated', 'public.log_activity(date,int,int,int,int)', 'execute') as auth`)).rows[0]
  check('log_activity: authenticated only', fx.anon === false && fx.auth === true, JSON.stringify(fx))
}
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant select on all tables in schema public to anon, authenticated;
  grant insert, update on public.profiles, public.progress to authenticated;
  -- 위 일괄 grant 는 예전 테스트용. 새 비공개 테이블은 schema.sql 권한 그대로 둠 (anon 은 아무것도 없음)
  revoke select on public.daily_activity, public.profile_private, public.translation_reviews from anon;
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

// ───────── 하루 학습 기록 (daily_activity / log_activity) ─────────
console.log('\n  -- daily activity / private profile --')
const A = {
  lin: 'cccccccc-0000-0000-0000-000000000001',
  tou: 'cccccccc-0000-0000-0000-000000000002', // 상한 검사
  vee: 'cccccccc-0000-0000-0000-000000000003', // 내 데이터 삭제
}
for (const id of Object.values(A)) await q('insert into auth.users values ($1)', [id])
const TODAY = `(now() at time zone 'Asia/Vientiane')::date`
const logAct = (uid, day, s, w, qs, ss) => as(uid, () => q(`select log_activity(${day}, $1::int, $2::int, $3::int, $4::int)`, [s, w, qs, ss]))
const actRow = async (uid, day = TODAY) =>
  (await q(`select study_seconds s, words_seen w, questions q, sessions n, last_seen > now() - interval '1 minute' as fresh from daily_activity where user_id=$1 and day=${day}`, [uid])).rows[0]
const actIs = (r, s, w, qs, n) => !!r && r.s === s && r.w === w && r.q === qs && r.n === n

await logAct(A.lin, TODAY, 600, 30, 10, 1)
await logAct(A.lin, TODAY, 300, 20, 5, 1)
let ar = await actRow(A.lin)
check('log_activity twice for today accumulates', actIs(ar, 900, 50, 15, 2) && ar.fresh, JSON.stringify(ar))
await q(`update daily_activity set last_seen = now() - interval '1 day' where user_id=$1 and day=${TODAY}`, [A.lin])
await logAct(A.lin, TODAY, 0, 0, 0, 0)
ar = await actRow(A.lin)
check('log_activity refreshes last_seen (zeros add nothing)', actIs(ar, 900, 50, 15, 2) && ar.fresh, JSON.stringify(ar))
await logAct(A.tou, TODAY, 4000, 5000, 3000, 50)
ar = await actRow(A.tou)
check('per-call clamp: 4000 s → 3600, words/questions → 2000, sessions → 20', actIs(ar, 3600, 2000, 2000, 20), JSON.stringify(ar))
for (let i = 0; i < 50; i++) await logAct(A.tou, TODAY, 3600, 2000, 2000, 20)
ar = await actRow(A.tou)
check('daily totals cap at 86400 s / 20000 / 20000 / 1000', actIs(ar, 86400, 20000, 20000, 1000), JSON.stringify(ar))
e = await errOf(() => logAct(A.lin, `${TODAY} - 1`, 120, 4, 2, 1))
ar = await actRow(A.lin, `${TODAY} - 1`)
check('yesterday (Vientiane) allowed', e === '' && actIs(ar, 120, 4, 2, 1), e || JSON.stringify(ar))
e = await errOf(() => logAct(A.lin, `${TODAY} - 3`, 60, 1, 1, 1))
check("3 days ago → 'bad_day'", e.includes('bad_day'), e)
e = await errOf(() => logAct(A.lin, `${TODAY} + 1`, 60, 1, 1, 1))
check("tomorrow → 'bad_day'", e.includes('bad_day'), e)
e = await errOf(() => logAct(A.lin, TODAY, -5, 1, 1, 1))
check("negative value → 'bad_value'", e.includes('bad_value'), e)
e = await errOf(() => logAct(A.lin, TODAY, 60, null, 1, 1))
check("null value → 'bad_value'", e.includes('bad_value'), e)
check('rejected calls change nothing', actIs(await actRow(A.lin), 900, 50, 15, 2) && (await q(`select count(*)::int n from daily_activity where user_id=$1`, [A.lin])).rows[0].n === 2)
e = await errOf(async () => {
  await db.exec('set role anon')
  try {
    await q(`select log_activity(${TODAY}, 60, 1, 1, 1)`)
  } finally {
    await db.exec('reset role')
  }
})
check('anonymous cannot call log_activity', e !== '', e)
e = await errOf(async () => {
  await db.exec('set role authenticated')
  try {
    await q(`select log_activity(${TODAY}, 60, 1, 1, 1)`)
  } finally {
    await db.exec('reset role')
  }
})
check("log_activity without a user → 'not_logged_in'", e.includes('not_logged_in'), e)

const linSees = (await as(A.lin, () => q('select user_id from daily_activity'))).rows
const touSees = (await as(A.tou, () => q('select user_id from daily_activity'))).rows
check('users see only their own daily_activity rows', linSees.length === 2 && linSees.every((r) => r.user_id === A.lin) && touSees.length === 1 && touSees[0].user_id === A.tou)
e = await asErr(A.lin, `insert into daily_activity (day, study_seconds) values (${TODAY} - 2, 100)`)
check('direct insert into daily_activity blocked', e !== '' && (await q(`select count(*)::int n from daily_activity where user_id=$1`, [A.lin])).rows[0].n === 2, e)
e = await asErr(A.lin, `update daily_activity set study_seconds = 86400 where user_id=$1`, [A.lin])
check('direct update of daily_activity blocked', e !== '' && (await actRow(A.lin)).s === 900, e)
e = await asErr(A.lin, `delete from daily_activity where user_id=$1`, [A.lin])
check('direct delete from daily_activity blocked', e !== '' && (await q(`select count(*)::int n from daily_activity where user_id=$1`, [A.lin])).rows[0].n === 2, e)

// ───────── 비공개 프로필 (profile_private) ─────────
const privRow = async (uid) => (await q('select gender, native from profile_private where user_id=$1', [uid])).rows[0]
const ins = await one(A.lin, `insert into profile_private (gender, native) values ('f', 'lo') returning user_id`)
check('user inserts own private profile (user_id defaults to auth.uid())', ins?.user_id === A.lin && (await privRow(A.lin))?.gender === 'f')
check('user reads own private profile', (await as(A.lin, () => q('select * from profile_private'))).rows.length === 1)
await as(A.lin, () => q(`update profile_private set native = 'th', updated_at = now() where user_id=$1`, [A.lin]))
check('user updates own private profile', (await privRow(A.lin))?.native === 'th')
check("another user cannot read it", (await as(A.tou, () => q('select * from profile_private'))).rows.length === 0)
await as(A.tou, () => q(`update profile_private set gender = 'm' where user_id=$1`, [A.lin]))
await as(A.tou, () => q('delete from profile_private where user_id=$1', [A.lin]))
check("another user cannot change or delete it", (await privRow(A.lin))?.gender === 'f')
e = await asErr(A.tou, `insert into profile_private (user_id, gender) values ($1, 'm')`, [A.vee])
check("cannot insert a private profile for someone else", e !== '' && !(await privRow(A.vee)), e)
e = await asErr(A.lin, `update profile_private set user_id = $1 where user_id = $2`, [A.vee, A.lin])
check('cannot move own private profile to someone else', e !== '' && (await privRow(A.lin))?.native === 'th' && !(await privRow(A.vee)), e)
let anonPriv = ''
try {
  await db.exec('set role anon')
  anonPriv = String((await q('select count(*)::int n from profile_private')).rows[0].n)
} catch (err) {
  anonPriv = err.message
} finally {
  await db.exec('reset role')
}
check('anonymous cannot read private profiles', anonPriv.includes('permission denied') || anonPriv === '0', anonPriv)
e = await asErr(A.tou, `insert into profile_private (gender) values ('x')`)
check('invalid gender rejected', e.includes('profile_private_gender_check'), e)
e = await asErr(A.tou, `insert into profile_private (native) values ('ko')`)
check('invalid native language rejected', e.includes('profile_private_native_check'), e)
await as(A.lin, () => q('delete from profile_private where user_id=$1', [A.lin]))
check('user deletes own private profile', !(await privRow(A.lin)))

// 내 데이터 삭제: 하루 학습 기록·비공개 프로필도
await logAct(A.vee, TODAY, 300, 10, 5, 1)
await logAct(A.vee, `${TODAY} - 1`, 60, 2, 1, 1)
await as(A.vee, () => q(`insert into profile_private (gender, native) values ('m', 'vi')`))
await as(A.tou, () => q(`insert into profile_private (native) values ('lo')`))
await as(A.vee, () => q('select delete_my_data()'))
const veeLeft = (await q('select (select count(*) from daily_activity where user_id=$1) + (select count(*) from profile_private where user_id=$1) as n', [A.vee])).rows[0].n
check('delete_my_data removes own daily_activity and profile_private', Number(veeLeft) === 0, `left=${veeLeft}`)
check(
  "delete_my_data leaves other users' rows",
  (await q('select count(*)::int n from daily_activity where user_id = any($1)', [[A.lin, A.tou]])).rows[0].n === 3 && (await privRow(A.tou))?.native === 'lo',
)

// 몽골어 학습자 (v0.20): native 'mn' 허용, 모르는 값은 막음
await as(A.lin, () => q(`insert into profile_private (gender, native) values ('f', 'mn')`))
check("profile_private accepts native 'mn'", (await privRow(A.lin))?.native === 'mn')
await as(A.lin, () => q(`update profile_private set native = 'ar' where user_id = $1`, [A.lin]))
check("profile_private accepts native 'ar'", (await privRow(A.lin))?.native === 'ar')
e = await asErr(A.lin, `update profile_private set native = 'xx' where user_id = $1`, [A.lin])
check('profile_private rejects unknown native', !!e, e)
await as(A.lin, () => q('delete from profile_private where user_id=$1', [A.lin]))

// ───────── 번역 검수 ─────────
const R = { rev1: 'dddddddd-0000-0000-0000-000000000001', rev2: 'dddddddd-0000-0000-0000-000000000002' }
for (const id of Object.values(R)) await q('insert into auth.users values ($1)', [id])
const review = (uid, ko, verdict, suggestion = '') =>
  as(uid, () =>
    q(
      `insert into translation_reviews (unit_id, ko, lang, current_text, verdict, suggestion) values ('t-restaurant-greet', $1, 'lo', 'ສະບາຍດີ', $2, $3)
       on conflict (user_id, unit_id, ko, lang) do update set verdict = excluded.verdict, suggestion = excluded.suggestion, updated_at = now()`,
      [ko, verdict, suggestion],
    ),
  )
await review(R.rev1, '어서 오세요', 'ok')
await review(R.rev1, '어서 오세요', 'fix', 'ຍິນດີຕ້ອນຮັບ')
const myRev = (await as(R.rev1, () => q('select verdict, suggestion from translation_reviews'))).rows
check('reviewer can save and update own review (one row per item)', myRev.length === 1 && myRev[0].verdict === 'fix' && myRev[0].suggestion === 'ຍິນດີຕ້ອນຮັບ', JSON.stringify(myRev))
check("reviewer cannot see others' reviews", (await as(R.rev2, () => q('select * from translation_reviews'))).rows.length === 0)
e = await asErr(R.rev2, `insert into translation_reviews (user_id, unit_id, ko, lang, verdict) values ($1, 'u', '가', 'lo', 'ok')`, [R.rev1])
check('cannot write a review as someone else', e !== '', e)
e = await asErr(R.rev2, `insert into translation_reviews (unit_id, ko, lang, verdict) values ('u', '가', 'ko', 'ok')`)
check('review language must be lo/th/vi', e.includes('translation_reviews_lang_check'), e)
await as(R.rev2, () => q(`insert into translation_reviews (unit_id, ko, lang, current_text, verdict) values ('t-topik-1-greet', '안녕하세요', 'mn', 'Сайн байна уу', 'ok')`))
check("translation_reviews accepts lang 'mn'", (await q(`select count(*)::int n from translation_reviews where lang = 'mn'`)).rows[0].n === 1)
await q(`delete from translation_reviews where lang = 'mn'`) // 아래 개수 검사에 영향 없게
e = await errOf(async () => {
  await db.exec('set role anon')
  try {
    await q('select * from translation_reviews')
  } finally {
    await db.exec('reset role')
  }
})
check('anon cannot read reviews', e !== '', e)
await review(R.rev2, '어서 오세요', 'ok')
await as(R.rev1, () => q('select delete_my_review_data()'))
check('delete_my_review_data removes only own reviews', (await q('select user_id from translation_reviews')).rows.map((r) => r.user_id).join() === R.rev2)


// ───────── 관리자 · 사용 현황 ─────────
{
  let e = ''
  try {
    await as(U.noy, () => q('select admin_overview(30)'))
  } catch (err) {
    e = String(err.message)
  }
  check('non-admin cannot read admin_overview', e.includes('not_admin'), e)
  await q('insert into admins (user_id) values ($1) on conflict do nothing', [U.ploy])
  const flags = [await as(U.noy, async () => (await q('select is_admin() as a')).rows[0].a), await as(U.ploy, async () => (await q('select is_admin() as a')).rows[0].a)]
  check('is_admin: false for normal user, true for admin', flags[0] === false && flags[1] === true, JSON.stringify(flags))
  const seen = await as(U.noy, async () => {
    try {
      return (await q('select * from admins')).rows.length
    } catch {
      return 0
    }
  })
  check('admins list is not readable from the app', seen === 0, String(seen))
  const ov = await as(U.ploy, async () => (await q('select admin_overview(30) as o')).rows[0].o)
  const nProfiles = (await q('select count(*)::int n from profiles')).rows[0].n
  check('admin_overview: totals and 30-day series', ov.users === nProfiles && ov.series.length === 30 && typeof ov.countries === 'object', JSON.stringify({ users: ov.users, n: ov.series.length, countries: ov.countries }))
  const list = await as(U.ploy, async () => (await q(`select * from admin_users(null, 'points', 10, 0)`)).rows)
  check('admin_users: one row per profile, sorted by points', list.length === Math.min(10, nProfiles) && Number(list[0].total) === nProfiles && Number(list[0].points) >= Number(list[list.length - 1].points), JSON.stringify(list.slice(0, 2).map((r) => [r.display_name, r.points])))
  const found = await as(U.ploy, async () => (await q(`select display_name from admin_users('keo', 'recent', 10, 0)`)).rows)
  check('admin_users: search by name', found.length === 1 && found[0].display_name === 'Keo', JSON.stringify(found))
  const det = await as(U.ploy, async () => (await q('select admin_user_detail($1) as d', [U.keo])).rows[0].d)
  check('admin_user_detail: point history', Array.isArray(det.points) && det.points.length > 0 && Array.isArray(det.activity), JSON.stringify({ points: det.points.length }))
  e = ''
  try {
    await db.exec(`set role anon`)
    await q('select admin_overview(30)')
  } catch (err) {
    e = String(err.message)
  } finally {
    await db.exec(`reset role`)
  }
  check('anon cannot call admin functions', e !== '', e)
}


// ───────── 접속 위치 (나라·도시만, IP 저장 안 함) ─────────
{
  await as(U.keo, () => q(`select log_geo('la', 'Vientiane')`))
  const row = (await q(`select geo_country, geo_city from daily_activity where user_id = $1 order by day desc limit 1`, [U.keo])).rows[0]
  check('log_geo stores country (upper-cased) and city', row?.geo_country === 'LA' && row?.geo_city === 'Vientiane', JSON.stringify(row))
  await as(U.keo, async () => {
    await db.exec(`select set_config('request.headers', '{"cf-ipcountry":"TH"}', false)`)
    try {
      await q(`select log_geo('LA', '<b>Bangkok</b>')`)
    } finally {
      await db.exec(`select set_config('request.headers', '', false)`)
    }
  })
  const row2 = (await q(`select geo_country, geo_city from daily_activity where user_id = $1 order by day desc limit 1`, [U.keo])).rows[0]
  check('server header country wins over app value; city cleaned', row2?.geo_country === 'TH' && row2?.geo_city === 'bBangkok/b', JSON.stringify(row2))
  await as(U.keo, () => q(`select log_geo('Korea', null)`))
  const row3 = (await q(`select geo_country from daily_activity where user_id = $1 order by day desc limit 1`, [U.keo])).rows[0]
  check('bad country value ignored (keeps previous)', row3?.geo_country === 'TH', JSON.stringify(row3))
  let e = ''
  try {
    await db.exec(`set role anon`)
    await q(`select log_geo('LA', 'Vientiane')`)
  } catch (err) {
    e = String(err.message)
  } finally {
    await db.exec(`reset role`)
  }
  check('anon cannot call log_geo', e !== '', e)
  const cols = (await q(`select column_name from information_schema.columns where table_name = 'daily_activity' and column_name like '%ip%'`)).rows
  check('no IP address column anywhere in daily_activity', cols.length === 0, JSON.stringify(cols))
  const u = await as(U.ploy, async () => (await q(`select display_name, geo_country, geo_city from admin_users('keo', 'recent', 5, 0)`)).rows[0])
  check('admin_users shows last access country/city', u?.geo_country === 'TH' && u?.geo_city === 'bBangkok/b', JSON.stringify(u))
  const places = await as(U.ploy, async () => (await q(`select admin_access_places(30) as p`)).rows[0].p)
  check('admin_access_places: cities and countries', places.cities.length >= 1 && places.countries.TH >= 1, JSON.stringify(places))
  e = ''
  try {
    await as(U.noy, () => q(`select admin_access_places(30)`))
  } catch (err) {
    e = String(err.message)
  }
  check('non-admin cannot read access places', e.includes('not_admin'), e)
}


// ───────── 커뮤니티 v2: 전체 공개 글 · 댓글 · 신고 · 차단 ─────────
{
  const C = { a: 'c1111111-1111-1111-1111-111111111111', b: 'c2222222-2222-2222-2222-222222222222', c: 'c3333333-3333-3333-3333-333333333333', d: 'c4444444-4444-4444-4444-444444444444' }
  for (const id of Object.values(C)) await q('insert into auth.users values ($1) on conflict do nothing', [id])
  await q(`insert into profiles (id, display_name, country) values ($1,'Ana','LA'),($2,'Bee','TH'),($3,'Cat','VN'),($4,'Dee','LA') on conflict do nothing`, [C.a, C.b, C.c, C.d])
  const rpc1 = (uid, sql, params = []) => as(uid, async () => (await q(sql, params)).rows[0])
  const err = async (fn) => {
    try {
      await fn()
      return ''
    } catch (e) {
      return String(e.message)
    }
  }
  const anonFeed = async (...args) => {
    await db.exec(`set role anon`)
    try {
      return (await q('select public_feed($1, $2, null, 20) as f', args)).rows[0].f
    } finally {
      await db.exec(`reset role`)
    }
  }
  const pid = (await rpc1(C.a, `select create_post('public', null, 'question', '  안녕하세요! 질문 있어요  ') as id`)).id
  const p2 = (await rpc1(C.b, `select create_post('public', null, 'study', 'วันนี้เรียน 50 คำ') as id`)).id
  let feed = await anonFeed(null, null)
  check('anon can read public feed (newest first, trimmed body)', feed.length >= 2 && feed[0].id === p2 && feed.find((x) => x.id === pid)?.body === '안녕하세요! 질문 있어요', JSON.stringify(feed.map((x) => x.body)))
  check('public feed filters by category and country', (await anonFeed('study', null)).every((x) => x.category === 'study') && (await anonFeed(null, 'TH')).every((x) => x.country === 'TH'))
  check('anon cannot post', (await err(async () => { await db.exec('set role anon'); try { await q(`select create_post('public', null, 'free', 'x')`) } finally { await db.exec('reset role') } })) !== '')
  check('empty post rejected', (await err(() => rpc1(C.a, `select create_post('public', null, 'free', '   ')`))).includes('bad_body'))
  // 그룹 글은 공개 피드에 안 나옴, 멤버 아니면 못 봄
  const g = (await rpc1(C.a, `select create_group('엄마 모임', '🍼') as g`)).g
  const gid = g.id
  const gp = (await rpc1(C.a, `select create_post('group', $1, null, '그룹 안 글') as id`, [gid])).id
  feed = await anonFeed(null, null)
  check('group post is not in public feed', !feed.some((x) => x.id === gp))
  check('non-member cannot open group post', (await err(() => rpc1(C.b, 'select post_thread($1)', [gp]))).includes('not_found'))
  check('non-member cannot post into group', (await err(() => rpc1(C.b, `select create_post('group', $1, null, 'x')`, [gid]))).includes('not_member'))
  check('non-member cannot comment on group post', (await err(() => rpc1(C.b, `select add_comment($1, 'hi')`, [gp]))).includes('not_found'))
  // 댓글
  await rpc1(C.b, `select add_comment($1, '저도 궁금해요')`, [pid])
  const cmt = (await rpc1(C.c, `select add_comment($1, 'Tôi biết!') as id`, [pid])).id
  let th = (await rpc1(C.d, 'select post_thread($1) as t', [pid])).t
  check('thread shows comments in order with count', th.comments.length === 2 && th.post.comments === 2 && th.comments[1].body === 'Tôi biết!' && th.comments[0].mine === false, JSON.stringify(th.comments.map((c) => c.body)))
  check('stranger cannot delete a comment', (await err(() => rpc1(C.d, 'select delete_comment($1)', [cmt]))).includes('not_allowed'))
  await rpc1(C.a, 'select delete_comment($1)', [cmt]) // 글쓴이는 지울 수 있음
  th = (await rpc1(C.d, 'select post_thread($1) as t', [pid])).t
  check('post author can delete comments on own post', th.comments.length === 1)
  check('reactions work on public posts', (await rpc1(C.d, `select toggle_reaction($1, '❤️') as r`, [pid])).r === true)
  // 차단
  await rpc1(C.d, 'select block_user($1, true)', [C.b])
  const dFeed = (await rpc1(C.d, 'select public_feed(null, null, null, 20) as f')).f
  th = (await rpc1(C.d, 'select post_thread($1) as t', [pid])).t
  check('blocked author hidden from my feed and comments', !dFeed.some((x) => x.user_id === C.b) && th.comments.length === 0, JSON.stringify({ n: th.comments.length }))
  check('my_blocks lists blocked person', (await rpc1(C.d, 'select my_blocks() as b')).b[0]?.name === 'Bee')
  await rpc1(C.d, 'select block_user($1, false)', [C.b])
  // 신고 3명 → 숨김
  for (const u of [C.b, C.c]) await rpc1(u, `select report_content($1, null, 'spam')`, [pid])
  await rpc1(C.c, `select report_content($1, null, 'spam')`, [pid]) // 같은 사람 두 번은 한 번
  check('two reporters do not hide yet', (await anonFeed(null, null)).some((x) => x.id === pid))
  const hidden = (await rpc1(C.d, `select report_content($1, null, 'abuse') as h`, [pid])).h
  check('third reporter hides the post', hidden === true && !(await anonFeed(null, null)).some((x) => x.id === pid))
  // 관리자 확인 (U.ploy 는 위에서 관리자)
  const reps = (await rpc1(U.ploy, 'select admin_reports() as r')).r
  const rp = reps.find((r) => r.id === pid)
  check('admin sees reported post with 3 reporters and reasons', rp?.n === 3 && rp.hidden === true && rp.reasons.includes('spam'), JSON.stringify(rp))
  check('non-admin cannot read reports', (await err(() => rpc1(C.a, 'select admin_reports()'))).includes('not_admin'))
  await rpc1(U.ploy, `select admin_moderate($1, null, 'dismiss')`, [pid])
  check('admin dismiss restores the post', (await anonFeed(null, null)).some((x) => x.id === pid))
  // 하루 공개 글 10개 제한
  for (let i = 0; i < 9; i++) await rpc1(C.c, `select create_post('public', null, 'free', $1)`, [`글 ${i}`])
  check('10th public post ok, 11th refused', (await err(() => rpc1(C.c, `select create_post('public', null, 'free', '10')`))) === '' && (await err(() => rpc1(C.c, `select create_post('public', null, 'free', '11')`))).includes('too_many_posts'))
  // 내 활동 · 그룹 피드 댓글 수
  await rpc1(C.a, `select add_comment($1, '그룹 댓글')`, [gp])
  const act = (await rpc1(C.a, 'select my_activity() as a')).a
  check('my_activity lists my public and group posts', act.posts.some((x) => x.id === pid && x.visibility === 'public') && act.posts.some((x) => x.id === gp && x.group_name === '엄마 모임' && x.comments === 1), JSON.stringify(act.posts.map((x) => [x.visibility, x.comments])))
  const gf = (await rpc1(C.a, 'select group_feed($1) as f', [gid])).f
  check('group feed carries comment count', gf.find((x) => x.id === gp)?.comments === 1)
  const direct = await as(C.a, async () => {
    try {
      return (await q('select * from comments')).rows.length
    } catch {
      return 0
    }
  })
  check('comments table not readable directly (RLS, no policy)', direct === 0, String(direct))
  // 내 데이터 삭제 → 댓글도 삭제
  await as(C.b, () => q('select delete_my_data()'))
  check('delete_my_data removes my comments and posts', (await q('select count(*)::int n from comments where user_id = $1', [C.b])).rows[0].n === 0 && (await q('select count(*)::int n from posts where user_id = $1', [C.b])).rows[0].n === 0)
}

// ───────── 일본어판·영어판: 판마다 따로 저장 ─────────
{
  const E = { a: 'e1111111-1111-1111-1111-111111111111', b: 'e2222222-2222-2222-2222-222222222222' }
  for (const id of Object.values(E)) await q('insert into auth.users values ($1) on conflict do nothing', [id])
  const one = (uid, sql, params = []) => as(uid, async () => (await q(sql, params)).rows[0])
  const err = async (fn) => {
    try {
      await fn()
      return ''
    } catch (e) {
      return String(e.message)
    }
  }
  await as(E.a, () => q(`insert into edition_progress (user_id, app, data) values ($1, 'ja', '{"n":1}'), ($1, 'en', '{"n":2}')`, [E.a]))
  await as(E.a, () => q(`insert into progress (user_id, data) values ($1, '{"ko":true}') on conflict (user_id) do update set data = excluded.data`, [E.a]))
  const mine = await as(E.a, async () => (await q(`select app, data->>'n' as n from edition_progress order by app`)).rows)
  check('edition progress: ja and en kept apart for the same user', mine.length === 2 && mine[0].app === 'en' && mine[0].n === '2' && mine[1].n === '1', JSON.stringify(mine))
  const korean = (await q('select data from progress where user_id = $1', [E.a])).rows[0]?.data
  check('edition progress does not touch Korean progress', korean?.ko === true, JSON.stringify(korean))
  const other = await as(E.b, async () => (await q('select count(*)::int n from edition_progress')).rows[0].n)
  check('edition progress: others cannot read it (RLS)', other === 0, String(other))
  check('edition progress: cannot write for someone else', (await err(() => as(E.b, () => q(`insert into edition_progress (user_id, app) values ($1, 'ja')`, [E.a])))) !== '')
  check('edition progress: only ja / en', (await err(() => as(E.a, () => q(`insert into edition_progress (user_id, app) values ($1, 'ko')`, [E.a])))) !== '')
  // 하루 기록 (한국 시간)
  const today = `(now() at time zone 'Asia/Seoul')::date`
  await one(E.a, `select log_edition_activity('ja', ${today}, 120, 10, 5, 1)`)
  await one(E.a, `select log_edition_activity('ja', ${today}, 99999, 10, 5, 1)`)
  await one(E.a, `select log_edition_activity('en', ${today}, 60, 3, 0, 1)`)
  const act = (await q(`select app, study_seconds, words_seen, sessions from edition_activity where user_id = $1 order by app`, [E.a])).rows
  check('log_edition_activity: per app, adds up, caps one call at 3600s', act.length === 2 && act[1].app === 'ja' && act[1].study_seconds === 3720 && act[1].words_seen === 20 && act[1].sessions === 2 && act[0].study_seconds === 60, JSON.stringify(act))
  check('log_edition_activity: bad app refused', (await err(() => one(E.a, `select log_edition_activity('ko', ${today}, 1, 1, 1, 1)`))).includes('bad_app'))
  check('log_edition_activity: old day refused', (await err(() => one(E.a, `select log_edition_activity('ja', ${today} - 5, 1, 1, 1, 1)`))).includes('bad_day'))
  check('edition_activity not writable directly', (await err(() => as(E.a, () => q(`insert into edition_activity (user_id, app, day) values ($1, 'ja', current_date - 3)`, [E.a])))) !== '')
  const fx = (await q(`select has_function_privilege('anon', 'public.log_edition_activity(text,date,int,int,int,int)', 'execute') as anon,
    has_function_privilege('authenticated', 'public.log_edition_activity(text,date,int,int,int,int)', 'execute') as auth`)).rows[0]
  check('log_edition_activity: authenticated only', fx.anon === false && fx.auth === true, JSON.stringify(fx))
  // 관리자 현황
  const ov = (await one(U.ploy, 'select admin_edition_overview(14) as o')).o
  check('admin_edition_overview: users and today per app', ov.ja.users >= 1 && ov.ja.active_today >= 1 && ov.en.users >= 1 && ov.ja.seconds_7d >= 3720 && Array.isArray(ov.ja.days), JSON.stringify(ov))
  check('admin_edition_overview: non-admin refused', (await err(() => one(E.b, 'select admin_edition_overview(14)'))).includes('not_admin'))
  // 내 데이터 삭제 → 판 기록도
  await as(E.a, () => q('select delete_my_data()'))
  const left = (await q(`select (select count(*) from edition_progress where user_id = $1)::int + (select count(*) from edition_activity where user_id = $1)::int as n`, [E.a])).rows[0].n
  check('delete_my_data removes edition progress and activity', left === 0, String(left))
}

// ───────── 수정 요청 · 제안 ─────────
{
  const F = { a: 'f1111111-1111-1111-1111-111111111111', b: 'f2222222-2222-2222-2222-222222222222' }
  for (const id of Object.values(F)) await q('insert into auth.users values ($1) on conflict do nothing', [id])
  const err = async (fn) => {
    try {
      await fn()
      return ''
    } catch (e) {
      return String(e.message)
    }
  }
  const asAnon = async (fn) => {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`)
    try {
      return await fn()
    } finally {
      await db.exec('reset role;')
    }
  }
  const send = `select submit_feedback($1, $2, $3, $4, $5, $6, $7) as id`
  const id1 = (await as(F.a, () => q(send, ['ja', 'word', 'pron', 'ja-n5-歯', '歯 · は · 이', '치라고 읽혀요', 'ko']))).rows[0].id
  const id2 = (await asAnon(() => q(send, ['ko', 'app', 'idea', null, null, '  다크 모드 더 진하게  ', 'lo']))).rows[0].id
  const rows = (await q('select id, user_id, app, message from feedback order by id')).rows
  check('submit_feedback: logged in keeps user id, anon has none, message trimmed', rows.length === 2 && rows[0].user_id === F.a && rows[1].user_id === null && rows[1].message === '다크 모드 더 진하게' && id1 && id2, JSON.stringify(rows))
  check('submit_feedback: empty message refused', (await err(() => as(F.a, () => q(send, ['ko', 'app', 'bug', null, null, '   ', 'ko'])))).includes('empty_message'))
  check('submit_feedback: bad category refused', (await err(() => as(F.a, () => q(send, ['ko', 'app', 'hack', null, null, 'x', 'ko'])))) !== '')
  check('submit_feedback: long message cut to 1000', (await as(F.a, async () => (await q(send, ['en', 'word', 'meaning', 'x', null, 'a'.repeat(1500), 'ko'])).rows[0].id)) && (await q(`select max(char_length(message))::int n from feedback`)).rows[0].n === 1000)
  // 하루 30건까지
  for (let i = 0; i < 28; i++) await as(F.a, () => q(send, ['ko', 'app', 'other', null, null, `m${i}`, 'ko']))
  check('submit_feedback: 31st in a day refused', (await err(() => as(F.a, () => q(send, ['ko', 'app', 'other', null, null, 'one more', 'ko'])))).includes('too_many'))
  // (이 테스트는 위에서 모든 표에 select 를 일괄로 줬음 → 그래도 RLS 로 한 줄도 안 보여야 함)
  const seen = (await as(F.b, () => q('select count(*)::int n from feedback'))).rows[0].n
  const e2 = await err(() => asAnon(() => q(`insert into feedback (app, kind, category, message) values ('ko','app','bug','x')`)))
  const e3 = await err(() => as(F.b, () => q(`insert into feedback (app, kind, category, message) values ('ko','app','bug','x')`)))
  check('feedback table: rows hidden, no direct insert', seen === 0 && e2 !== '' && e3 !== '', `${seen} | ${e2} | ${e3}`)
  const fx = (await q(`select has_function_privilege('anon', 'public.submit_feedback(text,text,text,text,text,text,text)', 'execute') as anon,
    has_function_privilege('anon', 'public.admin_feedback(text,int)', 'execute') as anon_admin`)).rows[0]
  check('submit_feedback open to anon; admin_feedback is not', fx.anon === true && fx.anon_admin === false, JSON.stringify(fx))
  // 관리자
  const list = (await as(U.ploy, () => q('select * from admin_feedback(null, 10)'))).rows
  check('admin_feedback: admin sees newest first, limited', list.length === 10 && list[0].status === 'new', String(list.length))
  check('admin_feedback: non-admin refused', (await err(() => as(F.b, () => q('select * from admin_feedback(null, 10)')))).includes('not_admin'))
  await as(U.ploy, () => q(`select admin_feedback_set($1, 'done')`, [id1]))
  check('admin_feedback_set: marks done', (await q('select status from feedback where id = $1', [id1])).rows[0].status === 'done')
  check('admin_feedback_set: non-admin refused', (await err(() => as(F.b, () => q(`select admin_feedback_set($1, 'skip')`, [id2])))).includes('not_admin'))
  await as(U.ploy, () => q(`select admin_feedback_set($1, 'delete')`, [id2]))
  check('admin_feedback_set: delete', (await q('select count(*)::int n from feedback where id = $1', [id2])).rows[0].n === 0)
  // 내 정보 삭제 → 내가 보낸 요청도
  await as(F.a, () => q('select delete_my_data()'))
  check('delete_my_data removes my feedback', (await q('select count(*)::int n from feedback where user_id = $1', [F.a])).rows[0].n === 0)
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
