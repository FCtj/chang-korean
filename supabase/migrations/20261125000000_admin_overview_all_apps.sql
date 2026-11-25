-- 관리자 첫 화면(admin_overview): 한국어판(daily_activity)만 세던 것을 일본어·영어·라오스어판(edition_activity)까지 합침
-- - '공부한 사람'은 실제로 공부한 기록(공부 시간 · 본 단어 · 푼 문제 중 하나라도)이 있는 사람만
--   (로그인하면 하루 한 번 접속 위치만 남기는 0분짜리 줄이 생겨서, 공부 시간은 0분인데 사람 수만 잡히던 문제)
-- - 포인트도 point_events + edition_points
-- - 공부 중인 코스: 한국어판 progress + 판 edition_progress ('ja:…' 처럼 앱 이름을 붙임)
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
  -- 모든 앱의 하루 기록 (실제로 공부한 줄만)
  study as (
    select user_id, day, study_seconds, 'ko'::text as app from daily_activity
    where day > v_today - greatest(d, 30) and (study_seconds > 0 or words_seen > 0 or questions > 0)
    union all
    select user_id, day, study_seconds, app from edition_activity
    where day > v_today - greatest(d, 30) and (study_seconds > 0 or words_seen > 0 or questions > 0)
  ),
  act as (
    select day, count(distinct user_id)::int as users, sum(study_seconds)::bigint as seconds from study where day > v_today - d group by day
  )
  select jsonb_build_object(
    'today', v_today,
    'users', (select count(*) from profiles),
    'new_today', coalesce((select n from signups where day = v_today), 0),
    'new_7d', (select count(*) from profiles where (created_at at time zone 'Asia/Vientiane')::date > v_today - 7),
    'new_30d', (select count(*) from profiles where (created_at at time zone 'Asia/Vientiane')::date > v_today - 30),
    'active_today', (select count(distinct user_id) from study where day = v_today),
    'active_7d', (select count(distinct user_id) from study where day > v_today - 7),
    'active_30d', (select count(distinct user_id) from study where day > v_today - 30),
    'seconds_7d', (select coalesce(sum(study_seconds), 0) from study where day > v_today - 7),
    'points_7d', (
      (select coalesce(sum(points), 0) from point_events where created_at > now() - interval '7 days')
      + (select coalesce(sum(points), 0) from edition_points where created_at > now() - interval '7 days')
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('day', days.day, 'signups', coalesce(s.n, 0), 'active', coalesce(a.users, 0), 'seconds', coalesce(a.seconds, 0)) order by days.day), '[]'::jsonb)
      from days left join signups s on s.day = days.day left join act a on a.day = days.day
    ),
    'countries', (select coalesce(jsonb_object_agg(country, n), '{}'::jsonb) from (select country, count(*) as n from profiles group by country) x),
    'natives', (select coalesce(jsonb_object_agg(native, n), '{}'::jsonb) from (select coalesce(native, '?') as native, count(*) as n from profile_private group by 1) x),
    'courses', (
      select coalesce(jsonb_object_agg(course, n), '{}'::jsonb)
      from (
        select course, count(*) as n
        from (
          select coalesce(data->>'course', 'basic') as course from progress
          union all
          select app || ':' || coalesce(data->>'course', 'topik') from edition_progress
        ) c
        group by course
      ) x
    )
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_overview(int) from public, anon;
grant execute on function public.admin_overview(int) to authenticated;
