-- 일본어판 · 영어판 랭킹 (판마다 따로, 한국 시간 기준)
-- · 점수는 award_edition_points() 로만 쌓임: 공부 점수 한 번에 최대 10점 · 하루 400점,
--   단원 시험 첫 통과 보너스 단원마다 한 번 최대 100점 · 하루 300점
-- · get_edition_leaderboard(): 누구나 봄 (공개 이름·사진만) · get_my_edition_rank(): 내 순위
-- · 표는 직접 읽기·쓰기 막음

create table if not exists public.edition_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null check (app in ('ja', 'en')),
  kind text not null check (kind in ('study', 'exam')),
  ref text check (char_length(ref) <= 80),
  points int not null check (points between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists edition_points_app_time_idx on public.edition_points (app, created_at desc);
create index if not exists edition_points_user_idx on public.edition_points (user_id, app, kind, created_at desc);
alter table public.edition_points enable row level security;
revoke all on public.edition_points from anon, authenticated;

create or replace function public.edition_period_start(p_period text)
returns timestamptz
language sql
stable
as $$
  select case
    when p_period = 'today' then date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
    when p_period = 'week' then date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
    else date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
  end;
$$;

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
  if p_app is null or p_app not in ('ja', 'en') then
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

create or replace function public.get_edition_leaderboard(p_app text, p_period text, p_limit int default 50)
returns table (rank bigint, user_id uuid, display_name text, avatar_url text, points bigint)
language sql
stable
security definer
set search_path = public
as $$
  with sums as (
    select e.user_id, sum(e.points)::bigint as points
    from edition_points e
    where e.app = p_app and e.created_at >= edition_period_start(p_period)
    group by e.user_id
  )
  select rank() over (order by s.points desc) as rank, p.id, p.display_name, p.avatar_url, s.points
  from sums s
  join profiles p on p.id = s.user_id
  order by s.points desc, p.display_name
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.get_edition_leaderboard(text, text, int) from public;
grant execute on function public.get_edition_leaderboard(text, text, int) to anon, authenticated;

create or replace function public.get_my_edition_rank(p_app text, p_period text)
returns table (rank bigint, points bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with sums as (
    select e.user_id, sum(e.points)::bigint as points
    from edition_points e
    where e.app = p_app and e.created_at >= edition_period_start(p_period)
    group by e.user_id
  ), ranked as (
    select s.user_id, s.points, rank() over (order by s.points desc) as rank, count(*) over () as total
    from sums s
    join profiles p on p.id = s.user_id
  )
  select rank, points, total from ranked where user_id = auth.uid();
$$;
revoke all on function public.get_my_edition_rank(text, text) from public, anon;
grant execute on function public.get_my_edition_rank(text, text) to authenticated;

-- 내 정보 삭제: 판 점수도 지움 (나머지는 20261122080000_feedback.sql 과 같음)
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
  delete from feedback where user_id = auth.uid();
  delete from profile_private where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
