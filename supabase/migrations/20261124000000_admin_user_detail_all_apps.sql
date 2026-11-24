-- 관리자 회원 상세(admin_user_detail): 한국어판 기록만 보던 것을 일본어·영어·라오스어판까지 함께
-- - 최근 60일 공부 시간: daily_activity + edition_activity 를 날짜별로 합침 (그날 쓴 앱 apps)
-- - 최근 포인트 기록: point_events + edition_points (어느 앱인지 app)
-- - 공부한 날 · 연속 학습일: progress + edition_progress 의 studyDays / streak
-- 목록(admin_users)은 이미 모든 앱을 합쳐서 보여 주고 있어, 목록의 '공부 시간'과 상세 그래프가 어긋났음
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
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', x.day, 'seconds', x.seconds, 'words', x.words, 'questions', x.questions, 'sessions', x.sessions,
        'country', x.country, 'city', x.city, 'apps', to_jsonb(x.apps)) order by x.day), '[]'::jsonb)
      from (
        select a.day,
               sum(a.study_seconds)::int as seconds,
               sum(a.words_seen)::int as words,
               sum(a.questions)::int as questions,
               sum(a.sessions)::int as sessions,
               max(a.geo_country) as country,
               max(a.geo_city) as city,
               array_agg(distinct a.app) filter (where a.study_seconds > 0 or a.words_seen > 0 or a.questions > 0) as apps
        from (
          select da.day, 'ko'::text as app, da.study_seconds, da.words_seen, da.questions, da.sessions, da.geo_country, da.geo_city
          from daily_activity da where da.user_id = p_user and da.day > v_today - 60
          union all
          select ea.day, ea.app, ea.study_seconds, ea.words_seen, ea.questions, ea.sessions, null::text, null::text
          from edition_activity ea where ea.user_id = p_user and ea.day > v_today - 60
        ) a
        group by a.day
      ) x
    ),
    'points', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      from (
        select u.kind, u.ref, u.points, u.created_at, u.app
        from (
          select pe.kind, pe.ref, pe.points, pe.created_at, 'ko'::text as app from point_events pe where pe.user_id = p_user
          union all
          select ep.kind, ep.ref, ep.points, ep.created_at, ep.app from edition_points ep where ep.user_id = p_user
        ) u
        order by u.created_at desc
        limit 50
      ) x
    ),
    'groups', (select count(*) from group_members where user_id = p_user),
    'study_days', (
      select count(distinct s.d)::int
      from (
        select jsonb_array_elements_text(p.data->'studyDays') as d
        from (
          select data from progress where user_id = p_user
          union all
          select data from edition_progress where user_id = p_user
        ) p
        where jsonb_typeof(p.data->'studyDays') = 'array'
      ) s
    ),
    'streak', (
      select max((p.data->>'streak')::int)
      from (
        select data from progress where user_id = p_user
        union all
        select data from edition_progress where user_id = p_user
      ) p
      where jsonb_typeof(p.data->'streak') = 'number'
    )
  );
end;
$$;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;
