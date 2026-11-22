
-- ═════════ 관리자 · 사용 현황 (v0.22) ═════════
-- admins           관리자 계정 목록. 정책이 없어 앱(anon·authenticated)에서는 읽기·쓰기 모두 불가 → SQL 편집기에서만 추가·삭제
--                  예) insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일';
-- is_admin()       지금 로그인한 계정이 관리자인지 (설정 화면에 '관리자' 버튼을 보일지)
-- admin_overview(days)   가입·활동 합계, 날짜별 신규 가입·활동자, 나라·언어·코스별 사용자 수 (관리자만, 아니면 'not_admin')
-- admin_users(search, order, limit, offset)   사용자별 사용 현황 목록 (관리자만)
-- admin_user_detail(user)   한 사람의 최근 60일 학습·최근 포인트 기록 (관리자만)
-- 이름·사진은 profiles 에 올라간 값 그대로 = 본인이 '이름 일부 가리기'를 켰으면 관리자에게도 가린 채로 보임
-- 날짜는 앱과 같이 라오스 시간(Asia/Vientiane) 기준

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_overview(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 7), 180);
  v_today date := (now() at time zone 'Asia/Vientiane')::date;
  r jsonb;
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  with days as (
    select (v_today - g)::date as day from generate_series(0, d - 1) g
  ),
  signups as (
    select (created_at at time zone 'Asia/Vientiane')::date as day, count(*)::int as n from profiles group by 1
  ),
  act as (
    select day, count(*)::int as users, sum(study_seconds)::bigint as seconds from daily_activity where day > v_today - d group by day
  )
  select jsonb_build_object(
    'today', v_today,
    'users', (select count(*) from profiles),
    'new_today', coalesce((select n from signups where day = v_today), 0),
    'new_7d', (select count(*) from profiles where (created_at at time zone 'Asia/Vientiane')::date > v_today - 7),
    'new_30d', (select count(*) from profiles where (created_at at time zone 'Asia/Vientiane')::date > v_today - 30),
    'active_today', (select count(distinct user_id) from daily_activity where day = v_today),
    'active_7d', (select count(distinct user_id) from daily_activity where day > v_today - 7),
    'active_30d', (select count(distinct user_id) from daily_activity where day > v_today - 30),
    'seconds_7d', (select coalesce(sum(study_seconds), 0) from daily_activity where day > v_today - 7),
    'points_7d', (select coalesce(sum(points), 0) from point_events where created_at > now() - interval '7 days'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('day', days.day, 'signups', coalesce(s.n, 0), 'active', coalesce(a.users, 0), 'seconds', coalesce(a.seconds, 0)) order by days.day), '[]'::jsonb)
      from days left join signups s on s.day = days.day left join act a on a.day = days.day
    ),
    'countries', (select coalesce(jsonb_object_agg(country, n), '{}'::jsonb) from (select country, count(*) as n from profiles group by country) x),
    'natives', (select coalesce(jsonb_object_agg(native, n), '{}'::jsonb) from (select coalesce(native, '?') as native, count(*) as n from profile_private group by 1) x),
    'courses', (select coalesce(jsonb_object_agg(course, n), '{}'::jsonb) from (select coalesce(data->>'course', 'basic') as course, count(*) as n from progress group by 1) x)
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_overview(int) from public, anon;
grant execute on function public.admin_overview(int) to authenticated;

-- 다음 마이그레이션(접속 위치)에서 반환 열이 늘어나므로, 다시 실행해도 되게 먼저 지움
drop function if exists public.admin_users(text, text, int, int);
create or replace function public.admin_users(p_search text default null, p_order text default 'recent', p_limit int default 50, p_offset int default 0)
returns table (
  user_id uuid, display_name text, avatar_url text, country text, created_at timestamptz, last_seen timestamptz,
  active_days int, study_seconds bigint, words bigint, questions bigint, points bigint, points_7d bigint,
  course text, topik_level int, native text, hour_caps int, fast int, correct int, total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  return query
  with a as (
    select da.user_id, max(da.last_seen) as last_seen, count(*)::int as days, sum(da.study_seconds)::bigint as secs,
           sum(da.words_seen)::bigint as words, sum(da.questions)::bigint as qs
    from daily_activity da group by da.user_id
  ),
  pe as (
    select e.user_id, sum(e.points)::bigint as pts, coalesce(sum(e.points) filter (where e.created_at > now() - interval '7 days'), 0)::bigint as pts7
    from point_events e group by e.user_id
  ),
  rows as (
    select p.id, p.display_name, p.avatar_url, p.country, p.created_at, a.last_seen,
           coalesce(a.days, 0) as days, coalesce(a.secs, 0)::bigint as secs, coalesce(a.words, 0)::bigint as words, coalesce(a.qs, 0)::bigint as qs,
           coalesce(pe.pts, 0)::bigint as pts, coalesce(pe.pts7, 0)::bigint as pts7,
           coalesce(g.data->>'course', 'basic') as course,
           case when (g.data->>'topikLevel') ~ '^[0-9]+$' then (g.data->>'topikLevel')::int else null end as topik,
           pp.native,
           case when (g.data->'cheat'->>'hourCaps') ~ '^[0-9]+$' then (g.data->'cheat'->>'hourCaps')::int else 0 end as caps,
           case when (g.data->'cheat'->>'fast') ~ '^[0-9]+$' then (g.data->'cheat'->>'fast')::int else 0 end as fast,
           case when (g.data->'cheat'->>'correct') ~ '^[0-9]+$' then (g.data->'cheat'->>'correct')::int else 0 end as correct
    from profiles p
    left join a on a.user_id = p.id
    left join pe on pe.user_id = p.id
    left join progress g on g.user_id = p.id
    left join profile_private pp on pp.user_id = p.id
    where p_search is null or p_search = '' or p.display_name ilike '%' || p_search || '%'
  )
  select r.id, r.display_name, r.avatar_url, r.country, r.created_at, r.last_seen, r.days, r.secs, r.words, r.qs, r.pts, r.pts7,
         r.course, r.topik, r.native, r.caps, r.fast, r.correct, count(*) over ()
  from rows r
  order by
    case when p_order = 'new' then extract(epoch from r.created_at) end desc nulls last,
    case when p_order = 'points' then r.pts end desc nulls last,
    case when p_order = 'time' then r.secs end desc nulls last,
    case when p_order = 'suspect' then r.caps * 100 + case when r.correct >= 20 then (r.fast * 100 / r.correct) else 0 end end desc nulls last,
    r.last_seen desc nulls last,
    r.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke all on function public.admin_users(text, text, int, int) from public, anon;
grant execute on function public.admin_users(text, text, int, int) to authenticated;

create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Vientiane')::date;
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  return jsonb_build_object(
    'activity', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'seconds', study_seconds, 'words', words_seen, 'questions', questions, 'sessions', sessions) order by day), '[]'::jsonb)
      from daily_activity where user_id = p_user and day > v_today - 60
    ),
    'points', (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (select kind, ref, points, created_at from point_events where user_id = p_user order by created_at desc limit 50) x
    ),
    'groups', (select count(*) from group_members where user_id = p_user),
    'study_days', (select coalesce(jsonb_array_length(data->'studyDays'), 0) from progress where user_id = p_user),
    'streak', (select data->'streak' from progress where user_id = p_user)
  );
end;
$$;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;
