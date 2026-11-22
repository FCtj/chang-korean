-- ───────── 일본어판·영어판 (한국인이 일본어·영어를 배우는 판) — 로그인 기록을 판마다 따로 ─────────
-- 같은 계정(카카오·Facebook)으로 한국어판·일본어판·영어판을 써도 학습 기록이 섞이지 않게
--   edition_progress   판마다 학습 기록 (사용자 · 판마다 한 줄)  — 본인만 읽기/쓰기
--   edition_activity   판마다 하루 학습 요약 (사용자 · 판 · 날짜마다 한 줄) — log_edition_activity() 로만 씀
-- 한국어판 표(progress · daily_activity)와 관리자 함수는 그대로 둠
-- 날짜는 한국 시간(Asia/Seoul) 기준

create table if not exists public.edition_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null check (app in ('ja', 'en')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);
alter table public.edition_progress enable row level security;
drop policy if exists "read own edition progress" on public.edition_progress;
create policy "read own edition progress" on public.edition_progress for select using (auth.uid() = user_id);
drop policy if exists "insert own edition progress" on public.edition_progress;
create policy "insert own edition progress" on public.edition_progress for insert with check (auth.uid() = user_id);
drop policy if exists "update own edition progress" on public.edition_progress;
create policy "update own edition progress" on public.edition_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.edition_progress to authenticated;

create table if not exists public.edition_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null check (app in ('ja', 'en')),
  day date not null,
  study_seconds int not null default 0 check (study_seconds >= 0),
  words_seen int not null default 0 check (words_seen >= 0),
  questions int not null default 0 check (questions >= 0),
  sessions int not null default 0 check (sessions >= 0),
  last_seen timestamptz not null default now(),
  primary key (user_id, app, day)
);
alter table public.edition_activity enable row level security;
drop policy if exists "read own edition activity" on public.edition_activity;
create policy "read own edition activity" on public.edition_activity for select using (auth.uid() = user_id);
grant select on public.edition_activity to authenticated;

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
  if p_app is null or p_app not in ('ja', 'en') then
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

-- 관리자: 일본어판·영어판 사용 현황 (판마다 가입자 · 오늘/7일/30일 활동 · 공부 시간 · 날짜별)
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
      from (values ('ja'), ('en')) as apps(app)
    ) x
  ), '{}'::jsonb);
end;
$$;
revoke all on function public.admin_edition_overview(int) from public, anon;
grant execute on function public.admin_edition_overview(int) to authenticated;

-- 내 데이터 삭제: 일본어판·영어판 기록도 함께
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
  delete from progress where user_id = auth.uid();
  delete from daily_activity where user_id = auth.uid();
  delete from edition_progress where user_id = auth.uid();
  delete from edition_activity where user_id = auth.uid();
  delete from profile_private where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
