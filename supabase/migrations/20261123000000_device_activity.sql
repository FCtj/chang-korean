-- 로그인하지 않은 사람의 공부 기록 (관리자 통계용)
-- · 기기마다 앱이 만든 임의 번호(device_id)로 하루 합계만: 공부 시간 · 본 단어 · 푼 문제 · 앱 연 횟수 (+ 한국어판은 고른 나라·언어)
-- · 이름·연락처·IP 는 저장하지 않음. 그 기기에서 로그인하면 그 뒤 기록에 user_id 가 붙어 가입 전환을 볼 수 있음
-- · 누구나 log_device_activity() 로만 쓰고(값마다 상한), 표는 직접 읽기·쓰기 막음. 관리자만 admin_device_overview()

create table if not exists public.device_activity (
  device_id uuid not null,
  app text not null check (app in ('ko', 'ja', 'en', 'lo')),
  day date not null,
  user_id uuid references auth.users (id) on delete set null,
  country text check (country ~ '^[A-Z]{2}$'),
  native text check (char_length(native) <= 8),
  study_seconds int not null default 0,
  words_seen int not null default 0,
  questions int not null default 0,
  sessions int not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (device_id, app, day)
);
create index if not exists device_activity_app_day_idx on public.device_activity (app, day);
create index if not exists device_activity_user_idx on public.device_activity (user_id);
alter table public.device_activity enable row level security;
revoke all on public.device_activity from anon, authenticated;

create or replace function public.log_device_activity(
  p_device uuid,
  p_app text,
  p_day date,
  p_seconds int,
  p_words int,
  p_questions int,
  p_sessions int,
  p_country text default null,
  p_native text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 한국어판은 라오스 시간, 다른 판은 한국 시간 — 둘 다 받도록 UTC 기준 어제~내일
  v_utc date := (now() at time zone 'UTC')::date;
  v_country text := case when upper(coalesce(p_country, '')) ~ '^[A-Z]{2}$' then upper(p_country) end;
begin
  if p_device is null or p_app is null or p_app not in ('ko', 'ja', 'en', 'lo') then
    raise exception 'bad_app';
  end if;
  if p_day is null or p_seconds is null or p_words is null or p_questions is null or p_sessions is null
     or p_seconds < 0 or p_words < 0 or p_questions < 0 or p_sessions < 0 then
    raise exception 'bad_value';
  end if;
  if p_day < v_utc - 1 or p_day > v_utc + 1 then
    raise exception 'bad_day';
  end if;
  insert into device_activity as a (device_id, app, day, user_id, country, native, study_seconds, words_seen, questions, sessions)
    values (p_device, p_app, p_day, auth.uid(), v_country, left(p_native, 8),
            least(p_seconds, 3600), least(p_words, 2000), least(p_questions, 2000), least(p_sessions, 20))
  on conflict (device_id, app, day) do update set
    user_id = coalesce(auth.uid(), a.user_id),
    country = coalesce(excluded.country, a.country),
    native = coalesce(excluded.native, a.native),
    study_seconds = least(a.study_seconds + excluded.study_seconds, 86400),
    words_seen = least(a.words_seen + excluded.words_seen, 20000),
    questions = least(a.questions + excluded.questions, 20000),
    sessions = least(a.sessions + excluded.sessions, 1000),
    last_seen = now();
end;
$$;
revoke all on function public.log_device_activity(uuid, text, date, int, int, int, int, text, text) from public;
grant execute on function public.log_device_activity(uuid, text, date, int, int, int, int, text, text) to anon, authenticated;

-- 관리자: 앱마다 기기 수 · 그중 로그인한 적 없는 기기 · 공부 시간 · 날짜별 · 나라별(한국어판)
create or replace function public.admin_device_overview(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  d int := least(greatest(coalesce(p_days, 14), 1), 90);
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  return coalesce((
    with dev as (
      -- 기기별: 한 번이라도 로그인한 기록이 있으면 '로그인함'
      select device_id, bool_or(user_id is not null) as linked from device_activity group by device_id
    ), rows as (
      select a.*, coalesce(v.linked, false) as linked from device_activity a join dev v using (device_id)
    )
    select jsonb_object_agg(x.app, x.info)
    from (
      select apps.app, jsonb_build_object(
        'devices_today', (select count(distinct device_id) from rows where app = apps.app and day >= v_today - 1),
        'anon_today', (select count(distinct device_id) from rows where app = apps.app and day >= v_today - 1 and not linked),
        'devices_7d', (select count(distinct device_id) from rows where app = apps.app and day > v_today - 7),
        'anon_7d', (select count(distinct device_id) from rows where app = apps.app and day > v_today - 7 and not linked),
        'devices_30d', (select count(distinct device_id) from rows where app = apps.app and day > v_today - 30),
        'anon_30d', (select count(distinct device_id) from rows where app = apps.app and day > v_today - 30 and not linked),
        'anon_seconds_7d', (select coalesce(sum(study_seconds), 0) from rows where app = apps.app and day > v_today - 7 and not linked),
        'anon_words_7d', (select coalesce(sum(words_seen), 0) from rows where app = apps.app and day > v_today - 7 and not linked),
        'converted', (select count(distinct device_id) from rows where app = apps.app and linked),
        'countries_7d', (
          select coalesce(jsonb_object_agg(country, n), '{}'::jsonb)
          from (select country, count(distinct device_id) as n from rows where app = apps.app and day > v_today - 7 and country is not null group by country) c
        ),
        'days', (
          select coalesce(jsonb_agg(jsonb_build_object('day', day, 'devices', n, 'anon', na) order by day), '[]'::jsonb)
          from (
            select day, count(distinct device_id)::int as n, count(distinct device_id) filter (where not linked)::int as na
            from rows where app = apps.app and day > v_today - d group by day
          ) s
        )
      ) as info
      from (values ('ko'), ('ja'), ('en'), ('lo')) as apps(app)
    ) x
  ), '{}'::jsonb);
end;
$$;
revoke all on function public.admin_device_overview(int) from public, anon;
grant execute on function public.admin_device_overview(int) to authenticated;

-- 내 정보 삭제: 내 계정에 이어진 기기 기록도 지움 (나머지는 20261122090000_edition_ranking.sql 과 같음)
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from reports where reporter = auth.uid();
  delete from user_blocks where user_id = auth.uid() or blocked_id = auth.uid();
  delete from comments where user_id = auth.uid();
  delete from reactions where user_id = auth.uid();
  delete from posts where user_id = auth.uid();
  delete from group_members where user_id = auth.uid();
  for g in select id from groups where owner = auth.uid() loop
    perform group_owner_left(g.id, auth.uid());
  end loop;
  delete from point_events where user_id = auth.uid();
  delete from edition_points where user_id = auth.uid();
  delete from progress where user_id = auth.uid();
  delete from daily_activity where user_id = auth.uid();
  delete from edition_progress where user_id = auth.uid();
  delete from edition_activity where user_id = auth.uid();
  delete from device_activity where user_id = auth.uid();
  delete from feedback where user_id = auth.uid();
  delete from profile_private where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
