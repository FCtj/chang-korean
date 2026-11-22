-- 라오스어판 (한국인이 라오스어를 배우는 판, app = 'lo') 추가
-- 판 학습 기록 · 하루 기록 · 랭킹 점수 · 수정 요청에서 'lo' 를 받음

alter table public.edition_progress drop constraint if exists edition_progress_app_check;
alter table public.edition_progress add constraint edition_progress_app_check check (app in ('ja', 'en', 'lo'));
alter table public.edition_activity drop constraint if exists edition_activity_app_check;
alter table public.edition_activity add constraint edition_activity_app_check check (app in ('ja', 'en', 'lo'));
alter table public.edition_points drop constraint if exists edition_points_app_check;
alter table public.edition_points add constraint edition_points_app_check check (app in ('ja', 'en', 'lo'));
alter table public.feedback drop constraint if exists feedback_app_check;
alter table public.feedback add constraint feedback_app_check check (app in ('ko', 'ja', 'en', 'lo'));

create or replace function public.log_edition_activity(p_app text, p_day date, p_seconds int, p_words int, p_questions int, p_sessions int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if p_app is null or p_app not in ('ja', 'en', 'lo') then
    raise exception 'bad_app';
  end if;
  if p_day is null or p_seconds is null or p_words is null or p_questions is null or p_sessions is null
     or p_seconds < 0 or p_words < 0 or p_questions < 0 or p_sessions < 0 then
    raise exception 'bad_value';
  end if;
  if p_day <> v_today and p_day <> v_today - 1 then
    raise exception 'bad_day';
  end if;
  insert into edition_activity as a (user_id, app, day, study_seconds, words_seen, questions, sessions, last_seen)
    values (uid, p_app, p_day, least(p_seconds, 3600), least(p_words, 2000), least(p_questions, 2000), least(p_sessions, 20), now())
  on conflict (user_id, app, day) do update set
    study_seconds = least(a.study_seconds + excluded.study_seconds, 86400),
    words_seen = least(a.words_seen + excluded.words_seen, 20000),
    questions = least(a.questions + excluded.questions, 20000),
    sessions = least(a.sessions + excluded.sessions, 1000),
    last_seen = now();
end;
$$;
revoke all on function public.log_edition_activity(text, date, int, int, int, int) from public, anon;
grant execute on function public.log_edition_activity(text, date, int, int, int, int) to authenticated;

create or replace function public.admin_edition_overview(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  d int := least(greatest(coalesce(p_days, 14), 1), 90);
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  return coalesce((
    select jsonb_object_agg(x.app, x.info)
    from (
      select apps.app, jsonb_build_object(
        'users', (select count(*) from edition_progress where app = apps.app),
        'active_today', (select count(distinct user_id) from edition_activity where app = apps.app and day = v_today),
        'active_7d', (select count(distinct user_id) from edition_activity where app = apps.app and day > v_today - 7),
        'active_30d', (select count(distinct user_id) from edition_activity where app = apps.app and day > v_today - 30),
        'seconds_7d', (select coalesce(sum(study_seconds), 0) from edition_activity where app = apps.app and day > v_today - 7),
        'days', (
          select coalesce(jsonb_agg(jsonb_build_object('day', day, 'users', users, 'seconds', seconds) order by day), '[]'::jsonb)
          from (select day, count(*)::int as users, sum(study_seconds)::bigint as seconds from edition_activity where app = apps.app and day > v_today - d group by day) s
        )
      ) as info
      from (values ('ja'), ('en'), ('lo')) as apps(app)
    ) x
  ), '{}'::jsonb);
end;
$$;
revoke all on function public.admin_edition_overview(int) from public, anon;
grant execute on function public.admin_edition_overview(int) to authenticated;

create or replace function public.award_edition_points(p_app text, p_kind text, p_ref text, p_points int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  day_start timestamptz := edition_period_start('today');
  today_total int;
  allowed int;
begin
  if uid is null or coalesce(p_points, 0) <= 0 then
    return 0;
  end if;
  if p_app is null or p_app not in ('ja', 'en', 'lo') then
    raise exception 'bad_app';
  end if;
  if p_kind = 'study' then
    select coalesce(sum(points), 0) into today_total
      from edition_points where user_id = uid and app = p_app and kind = 'study' and created_at >= day_start;
    allowed := least(p_points, 10, greatest(0, 400 - today_total));
  elsif p_kind = 'exam' then
    if p_ref is null or p_ref !~ '^[A-Za-z0-9_.:-]{1,80}$' then return 0; end if;
    if exists (select 1 from edition_points where user_id = uid and app = p_app and kind = 'exam' and ref = p_ref) then return 0; end if;
    select coalesce(sum(points), 0) into today_total
      from edition_points where user_id = uid and app = p_app and kind = 'exam' and created_at >= day_start;
    allowed := least(p_points, 100, greatest(0, 300 - today_total));
  else
    return 0;
  end if;
  if allowed <= 0 then
    return 0;
  end if;
  insert into edition_points (user_id, app, kind, ref, points) values (uid, p_app, p_kind, p_ref, allowed);
  return allowed;
end;
$$;
revoke all on function public.award_edition_points(text, text, text, int) from public, anon;
grant execute on function public.award_edition_points(text, text, text, int) to authenticated;
