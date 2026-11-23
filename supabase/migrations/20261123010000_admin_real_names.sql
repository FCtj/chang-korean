-- 관리자 사용자 목록: 원래 로그인 이름(카카오 닉네임 · Facebook 이름) · 로그인 방법 · 이메일 · 쓰는 앱 · 마지막 로그인
-- · 공개 이름(profiles.display_name)은 테스트 기간에 가려서 저장되므로(김*나) 관리자 화면에서는 auth.users 의 원래 이름을 같이 보여 줌
-- · 검색도 원래 이름 · 이메일로 됨
-- · 활동·점수는 한국어판(daily_activity · point_events)과 일본어·영어·라오스어판(edition_activity · edition_points)을 합침
-- 반환 칸이 바뀌어서 지우고 다시 만듦

drop function if exists public.admin_users(text, text, int, int);

create function public.admin_users(p_search text default null, p_order text default 'recent', p_limit int default 50, p_offset int default 0)
returns table (
  user_id uuid, display_name text, avatar_url text, country text, created_at timestamptz, last_seen timestamptz,
  active_days int, study_seconds bigint, words bigint, questions bigint, points bigint, points_7d bigint,
  course text, topik_level int, native text, hour_caps int, fast int, correct int,
  geo_country text, geo_city text,
  login_name text, provider text, email text, apps text, last_sign_in timestamptz,
  total bigint
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
  with act as (
    select da.user_id, da.day, da.last_seen, da.study_seconds, da.words_seen, da.questions from daily_activity da
    union all
    select ea.user_id, ea.day, ea.last_seen, ea.study_seconds, ea.words_seen, ea.questions from edition_activity ea
  ),
  a as (
    select act.user_id, max(act.last_seen) as last_seen, count(distinct act.day)::int as days, sum(act.study_seconds)::bigint as secs,
           sum(act.words_seen)::bigint as words, sum(act.questions)::bigint as qs
    from act group by act.user_id
  ),
  geo as (
    select distinct on (da.user_id) da.user_id, da.geo_country, da.geo_city
    from daily_activity da
    where da.geo_country is not null or da.geo_city is not null
    order by da.user_id, da.day desc
  ),
  pts as (
    select e.user_id, e.points, e.created_at from point_events e
    union all
    select x.user_id, x.points, x.created_at from edition_points x
  ),
  pe as (
    select pts.user_id, sum(pts.points)::bigint as pts, coalesce(sum(pts.points) filter (where pts.created_at > now() - interval '7 days'), 0)::bigint as pts7
    from pts group by pts.user_id
  ),
  used as (
    select g.user_id, 'ko'::text as app from progress g
    union select da.user_id, 'ko' from daily_activity da
    union select ep.user_id, ep.app from edition_progress ep
    union select ea.user_id, ea.app from edition_activity ea
  ),
  apps as (
    select used.user_id, string_agg(used.app, ',' order by array_position(array['ko', 'ja', 'en', 'lo'], used.app)) as apps
    from used group by used.user_id
  ),
  rows as (
    select p.id, p.display_name, p.avatar_url, p.country, coalesce(u.created_at, p.created_at) as created_at, a.last_seen,
           coalesce(a.days, 0) as days, coalesce(a.secs, 0)::bigint as secs, coalesce(a.words, 0)::bigint as words, coalesce(a.qs, 0)::bigint as qs,
           coalesce(pe.pts, 0)::bigint as pts, coalesce(pe.pts7, 0)::bigint as pts7,
           coalesce(g.data->>'course', 'basic') as course,
           case when (g.data->>'topikLevel') ~ '^[0-9]+$' then (g.data->>'topikLevel')::int else null end as topik,
           pp.native,
           case when (g.data->'cheat'->>'hourCaps') ~ '^[0-9]+$' then (g.data->'cheat'->>'hourCaps')::int else 0 end as caps,
           case when (g.data->'cheat'->>'fast') ~ '^[0-9]+$' then (g.data->'cheat'->>'fast')::int else 0 end as fast,
           case when (g.data->'cheat'->>'correct') ~ '^[0-9]+$' then (g.data->'cheat'->>'correct')::int else 0 end as correct,
           geo.geo_country, geo.geo_city,
           coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), nullif(u.raw_user_meta_data->>'nickname', ''),
                    nullif(u.raw_user_meta_data->>'preferred_username', ''), nullif(u.raw_user_meta_data->>'user_name', '')) as login_name,
           u.raw_app_meta_data->>'provider' as provider,
           u.email::text as email,
           ap.apps,
           u.last_sign_in_at as last_sign_in
    from profiles p
    left join auth.users u on u.id = p.id
    left join a on a.user_id = p.id
    left join geo on geo.user_id = p.id
    left join pe on pe.user_id = p.id
    left join progress g on g.user_id = p.id
    left join profile_private pp on pp.user_id = p.id
    left join apps ap on ap.user_id = p.id
    where p_search is null or p_search = ''
       or p.display_name ilike '%' || p_search || '%'
       or u.raw_user_meta_data::text ilike '%' || p_search || '%'
       or u.email ilike '%' || p_search || '%'
  )
  select r.id, r.display_name, r.avatar_url, r.country, r.created_at, r.last_seen, r.days, r.secs, r.words, r.qs, r.pts, r.pts7,
         r.course, r.topik, r.native, r.caps, r.fast, r.correct, r.geo_country, r.geo_city,
         r.login_name, r.provider, r.email, r.apps, r.last_sign_in, count(*) over ()
  from rows r
  order by
    case when p_order = 'new' then extract(epoch from r.created_at) end desc nulls last,
    case when p_order = 'points' then r.pts end desc nulls last,
    case when p_order = 'time' then r.secs end desc nulls last,
    case when p_order = 'suspect' then r.caps * 100 + case when r.correct >= 20 then (r.fast * 100 / r.correct) else 0 end end desc nulls last,
    greatest(r.last_seen, r.last_sign_in) desc nulls last,
    r.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke all on function public.admin_users(text, text, int, int) from public, anon;
grant execute on function public.admin_users(text, text, int, int) to authenticated;
