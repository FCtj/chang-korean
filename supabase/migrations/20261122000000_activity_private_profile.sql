
-- ───────── 하루 학습 기록 · 비공개 프로필 (2026-11-22 추가) ─────────
-- 테이블
--   daily_activity   하루 학습 요약 (사용자·날짜마다 한 줄: 공부 시간(초)·본 단어·푼 문제·앱 연 횟수, 마지막 접속 시각)
--                    — 본인만 읽기, 쓰기는 log_activity() 로만 (화면마다 기록하는 추적이 아니라 하루 합계만)
--   profile_private  동의한 사람만 적는 선택 정보 (성별 f/m, 모국어 lo/th/vi, 동의 시각) — 절대 공개 안 함, 본인만 읽기·쓰기·삭제
-- 함수
--   log_activity(day, seconds, words, questions, sessions)  그날 합계에 더함 (로그인 필요 'not_logged_in')
--       day 는 라오스 시간(Asia/Vientiane) 기준 오늘 또는 어제만 ('bad_day'), 음수·null 은 'bad_value'
--       한 번에 최대 3600초·단어 2000·문제 2000·20회 (넘으면 조용히 줄임), 하루 합계는 86400초·20000·20000·1000 에서 멈춤
--   delete_my_data()  위 두 테이블의 내 행도 함께 지우도록 다시 만듦 (나머지 동작은 그대로)

create table if not exists public.daily_activity (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  study_seconds int not null default 0 check (study_seconds between 0 and 86400),
  words_seen int not null default 0 check (words_seen between 0 and 20000),
  questions int not null default 0 check (questions between 0 and 20000),
  sessions int not null default 0 check (sessions between 0 and 1000),
  last_seen timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.profile_private (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  gender text check (gender in ('f', 'm')),
  native text check (native in ('lo', 'th', 'vi')),
  consent_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_activity enable row level security;
alter table public.profile_private enable row level security;

-- daily_activity: 본인 행만 읽기. 쓰기 정책 없음 → 직접 쓰기 불가, log_activity() 로만
drop policy if exists "read own activity" on public.daily_activity;
create policy "read own activity" on public.daily_activity for select using (auth.uid() = user_id);

-- profile_private: 본인 행만 읽기·쓰기·삭제 (다른 사람·로그인 전에는 절대 안 보임)
drop policy if exists "read own private profile" on public.profile_private;
create policy "read own private profile" on public.profile_private for select using (auth.uid() = user_id);
drop policy if exists "insert own private profile" on public.profile_private;
create policy "insert own private profile" on public.profile_private for insert with check (auth.uid() = user_id);
drop policy if exists "update own private profile" on public.profile_private;
create policy "update own private profile" on public.profile_private for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own private profile" on public.profile_private;
create policy "delete own private profile" on public.profile_private for delete using (auth.uid() = user_id);

grant select on public.daily_activity to authenticated;
grant select, insert, update, delete on public.profile_private to authenticated;

create or replace function public.log_activity(p_day date, p_seconds int, p_words int, p_questions int, p_sessions int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Vientiane')::date;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if p_day is null or p_seconds is null or p_words is null or p_questions is null or p_sessions is null
     or p_seconds < 0 or p_words < 0 or p_questions < 0 or p_sessions < 0 then
    raise exception 'bad_value';
  end if;
  if p_day <> v_today and p_day <> v_today - 1 then
    raise exception 'bad_day';
  end if;
  insert into daily_activity as a (user_id, day, study_seconds, words_seen, questions, sessions, last_seen)
    values (uid, p_day, least(p_seconds, 3600), least(p_words, 2000), least(p_questions, 2000), least(p_sessions, 20), now())
  on conflict (user_id, day) do update set
    study_seconds = least(a.study_seconds + excluded.study_seconds, 86400),
    words_seen = least(a.words_seen + excluded.words_seen, 20000),
    questions = least(a.questions + excluded.questions, 20000),
    sessions = least(a.sessions + excluded.sessions, 1000),
    last_seen = now();
end;
$$;

revoke all on function public.log_activity(date, int, int, int, int) from public, anon;
grant execute on function public.log_activity(date, int, int, int, int) to authenticated;

-- 내 데이터 삭제: 하루 학습 기록·비공개 프로필도 함께
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
  -- 스터디 그룹: 내 반응·글 삭제 후 모든 그룹에서 나가기
  -- (방장이었던 그룹은 leave_group 과 똑같이 가장 먼저 들어온 멤버에게 넘기거나, 아무도 없으면 삭제 — group_members 삭제 트리거가 처리)
  delete from reactions where user_id = auth.uid();
  delete from posts where user_id = auth.uid();
  delete from group_members where user_id = auth.uid();
  for g in select id from groups where owner = auth.uid() loop
    perform group_owner_left(g.id, auth.uid());
  end loop;
  delete from point_events where user_id = auth.uid();
  delete from progress where user_id = auth.uid();
  delete from daily_activity where user_id = auth.uid();
  delete from profile_private where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
