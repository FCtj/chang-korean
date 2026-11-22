
-- ═════════ 접속 위치 (대략적인 나라·도시) · 관리자 화면용 (v0.23) ═════════
-- daily_activity 에 그날 접속한 나라·도시만 적음. IP 주소 자체는 어디에도 저장하지 않음
-- log_geo(country, city)   로그인한 사람만, 하루 한 번 앱이 부름
--   나라: 서버가 받은 요청의 cf-ipcountry 헤더(있으면) → 없으면 앱이 보낸 값. 두 글자 대문자만
--   도시: 앱이 IP 위치 서비스(GeoJS)로 알아낸 대략적인 도시 이름 (80자까지, 틀릴 수 있음)
-- admin_users 에 마지막 접속 나라·도시, admin_overview 에 최근 30일 접속 도시별 사람 수, admin_user_detail 날짜별 위치 추가
-- 내 데이터 삭제(delete_my_data) 때 daily_activity 와 함께 지워짐

alter table public.daily_activity add column if not exists geo_country text;
alter table public.daily_activity add column if not exists geo_city text;
alter table public.daily_activity drop constraint if exists daily_activity_geo_country_check;
alter table public.daily_activity add constraint daily_activity_geo_country_check check (geo_country is null or geo_country ~ '^[A-Z]{2}$');
alter table public.daily_activity drop constraint if exists daily_activity_geo_city_check;
alter table public.daily_activity add constraint daily_activity_geo_city_check check (geo_city is null or char_length(geo_city) between 1 and 80);

create or replace function public.log_geo(p_country text default null, p_city text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Vientiane')::date;
  v_header text := upper(coalesce(nullif(current_setting('request.headers', true), '')::json->>'cf-ipcountry', ''));
  v_country text;
  v_city text := nullif(left(btrim(regexp_replace(coalesce(p_city, ''), '[[:cntrl:]<>]', '', 'g')), 80), '');
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  v_country := case
    when v_header ~ '^[A-Z]{2}$' and v_header not in ('XX', 'T1') then v_header
    when upper(coalesce(p_country, '')) ~ '^[A-Z]{2}$' then upper(p_country)
    else null
  end;
  if v_country is null and v_city is null then
    return;
  end if;
  insert into daily_activity as a (user_id, day, geo_country, geo_city, last_seen)
    values (uid, v_today, v_country, v_city, now())
  on conflict (user_id, day) do update set
    geo_country = coalesce(excluded.geo_country, a.geo_country),
    geo_city = coalesce(excluded.geo_city, a.geo_city);
end;
$$;
revoke all on function public.log_geo(text, text) from public, anon;
grant execute on function public.log_geo(text, text) to authenticated;

-- 반환 열이 늘어서 다시 만듦
drop function if exists public.admin_users(text, text, int, int);
create or replace function public.admin_users(p_search text default null, p_order text default 'recent', p_limit int default 50, p_offset int default 0)
returns table (
  user_id uuid, display_name text, avatar_url text, country text, created_at timestamptz, last_seen timestamptz,
  active_days int, study_seconds bigint, words bigint, questions bigint, points bigint, points_7d bigint,
  course text, topik_level int, native text, hour_caps int, fast int, correct int,
  geo_country text, geo_city text, total bigint
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
  geo as (
    select distinct on (da.user_id) da.user_id, da.geo_country, da.geo_city
    from daily_activity da
    where da.geo_country is not null or da.geo_city is not null
    order by da.user_id, da.day desc
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
           case when (g.data->'cheat'->>'correct') ~ '^[0-9]+$' then (g.data->'cheat'->>'correct')::int else 0 end as correct,
           geo.geo_country, geo.geo_city
    from profiles p
    left join a on a.user_id = p.id
    left join geo on geo.user_id = p.id
    left join pe on pe.user_id = p.id
    left join progress g on g.user_id = p.id
    left join profile_private pp on pp.user_id = p.id
    where p_search is null or p_search = '' or p.display_name ilike '%' || p_search || '%'
  )
  select r.id, r.display_name, r.avatar_url, r.country, r.created_at, r.last_seen, r.days, r.secs, r.words, r.qs, r.pts, r.pts7,
         r.course, r.topik, r.native, r.caps, r.fast, r.correct, r.geo_country, r.geo_city, count(*) over ()
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

-- 개요: 최근 30일 접속 도시별·나라별 사람 수 추가 (나머지는 그대로)
create or replace function public.admin_access_places(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Asia/Vientiane')::date;
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  return jsonb_build_object(
    'countries', (
      select coalesce(jsonb_object_agg(geo_country, n), '{}'::jsonb)
      from (select geo_country, count(distinct user_id) as n from daily_activity where day > v_today - d and geo_country is not null group by geo_country) x
    ),
    'cities', (
      select coalesce(jsonb_agg(jsonb_build_object('country', geo_country, 'city', geo_city, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select geo_country, geo_city, count(distinct user_id) as n
        from daily_activity where day > v_today - d and geo_city is not null
        group by geo_country, geo_city order by n desc limit 30
      ) x
    )
  );
end;
$$;
revoke all on function public.admin_access_places(int) from public, anon;
grant execute on function public.admin_access_places(int) to authenticated;

-- 한 사람 상세: 날짜별 위치도
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
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'seconds', study_seconds, 'words', words_seen, 'questions', questions, 'sessions', sessions, 'country', geo_country, 'city', geo_city) order by day), '[]'::jsonb)
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
