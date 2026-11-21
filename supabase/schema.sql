-- Chang Korean 데이터베이스 (Supabase / PostgreSQL)
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다. 여러 번 실행해도 안전합니다.
--
-- 테이블
--   profiles      사용자 정보 (Facebook 이름·사진, 나라)          — 누구나 읽기, 본인만 쓰기
--   progress      학습 기록 (STEP·외운 단어·통과한 회차 등 JSON)   — 본인만 읽기/쓰기
--   point_events  점수 기록 (랭킹 계산용)                          — 누구나 읽기, 쓰기는 award_points() 로만
-- 함수
--   award_points(kind, ref, points)   점수 적립 (서버에서 하루 상한·중복 보너스 막음)
--   get_leaderboard(period, country)  랭킹 (period: 'today' 실시간 / 'month' 월간, country: 'LA' 등 또는 null=전체)
--   get_my_rank(period, country)      내 순위
--   delete_my_data()                  내 데이터 전부 삭제 (Facebook 데이터 삭제 요구사항)
-- 하루·한 달의 기준 시간대: 라오스/태국 시간 (Asia/Vientiane, UTC+7)

-- ───────── 테이블 ─────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  country text not null default 'LA' check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.point_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('study', 'exam', 'promo')),
  ref text,
  points int not null check (points > 0),
  created_at timestamptz not null default now()
);

create index if not exists point_events_created_idx on public.point_events (created_at);
create index if not exists point_events_user_kind_idx on public.point_events (user_id, kind, created_at);
create unique index if not exists point_events_bonus_once on public.point_events (user_id, kind, ref) where kind in ('exam', 'promo');

-- ───────── 권한 (RLS) ─────────

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.point_events enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "read own progress" on public.progress;
create policy "read own progress" on public.progress for select using (auth.uid() = user_id);
drop policy if exists "insert own progress" on public.progress;
create policy "insert own progress" on public.progress for insert with check (auth.uid() = user_id);
drop policy if exists "update own progress" on public.progress;
create policy "update own progress" on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 점수 기록은 랭킹·실시간 업데이트용으로 누구나 읽을 수 있음 (직접 쓰기는 불가, award_points() 로만)
drop policy if exists "points are public" on public.point_events;
create policy "points are public" on public.point_events for select using (true);

-- ───────── 점수 적립 ─────────

create or replace function public.award_points(p_kind text, p_ref text, p_points int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Vientiane') at time zone 'Asia/Vientiane';
  today_total int;
  allowed int;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_points is null or p_points <= 0 then
    return 0;
  end if;

  if p_kind = 'study' then
    -- 공부 점수: 한 번에 최대 10점, 하루 최대 400점
    select coalesce(sum(points), 0) into today_total
      from point_events where user_id = uid and kind = 'study' and created_at >= day_start;
    allowed := least(p_points, 10, greatest(0, 400 - today_total));
  elsif p_kind = 'exam' then
    -- 졸업시험 첫 통과 보너스: 회차마다 한 번, 최대 100점
    if p_ref is null or p_ref !~ '^r([1-9]|[1-9][0-9])$' then return 0; end if;
    if exists (select 1 from point_events where user_id = uid and kind = 'exam' and ref = p_ref) then return 0; end if;
    allowed := least(p_points, 100);
  elsif p_kind = 'promo' then
    -- 승급시험 보너스: 계급마다 한 번, 최대 300점
    if p_ref is null or p_ref !~ '^[1-9]$' then return 0; end if;
    if exists (select 1 from point_events where user_id = uid and kind = 'promo' and ref = p_ref) then return 0; end if;
    allowed := least(p_points, 300);
  else
    return 0;
  end if;

  if allowed <= 0 then
    return 0;
  end if;
  insert into point_events (user_id, kind, ref, points) values (uid, p_kind, p_ref, allowed);
  return allowed;
end;
$$;

-- ───────── 랭킹 ─────────

create or replace function public.period_start(p_period text)
returns timestamptz
language sql
stable
as $$
  select case
    when p_period = 'today' then date_trunc('day', now() at time zone 'Asia/Vientiane') at time zone 'Asia/Vientiane'
    else date_trunc('month', now() at time zone 'Asia/Vientiane') at time zone 'Asia/Vientiane'
  end;
$$;

create or replace function public.get_leaderboard(p_period text, p_country text default null, p_limit int default 50)
returns table (rank bigint, user_id uuid, display_name text, avatar_url text, country text, points bigint)
language sql
stable
security definer
set search_path = public
as $$
  with sums as (
    select e.user_id, sum(e.points)::bigint as points
    from point_events e
    where e.created_at >= period_start(p_period)
    group by e.user_id
  )
  select rank() over (order by s.points desc) as rank, p.id, p.display_name, p.avatar_url, p.country, s.points
  from sums s
  join profiles p on p.id = s.user_id
  where p_country is null or p.country = p_country
  order by s.points desc, p.display_name
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.get_my_rank(p_period text, p_country text default null)
returns table (rank bigint, points bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with sums as (
    select e.user_id, sum(e.points)::bigint as points
    from point_events e
    where e.created_at >= period_start(p_period)
    group by e.user_id
  ), ranked as (
    select s.user_id, s.points, rank() over (order by s.points desc) as rank, count(*) over () as total
    from sums s
    join profiles p on p.id = s.user_id
    where p_country is null or p.country = p_country
  )
  select rank, points, total from ranked where user_id = auth.uid();
$$;

-- ───────── 내 데이터 삭제 ─────────

create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from point_events where user_id = auth.uid();
  delete from progress where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end;
$$;

revoke all on function public.award_points(text, text, int) from public, anon;
grant execute on function public.award_points(text, text, int) to authenticated;
grant execute on function public.get_leaderboard(text, text, int) to anon, authenticated;
grant execute on function public.get_my_rank(text, text) to authenticated;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- ───────── 실시간 (랭킹 자동 갱신) ─────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'point_events'
  ) then
    alter publication supabase_realtime add table public.point_events;
  end if;
end $$;
