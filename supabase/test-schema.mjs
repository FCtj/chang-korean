// supabase/schema.sql 검사 (npm run test:db). PGlite = WASM PostgreSQL, Supabase의 auth 스키마·역할은 흉내 냄
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

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
`)
await db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
await db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')) // 두 번 실행해도 안전한지
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

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
