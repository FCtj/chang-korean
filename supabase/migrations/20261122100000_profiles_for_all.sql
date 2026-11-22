-- 가입하면 바로 프로필 (앱이 저장하기 전에 로그인이 끊겨도 관리자 화면·랭킹에 보이게)
-- · auth.users 에 새 계정이 생기면 profiles 한 줄을 자동으로 만듦: 이름은 일부 가림(김*나), 나라는 'ZZ'(아직 모름)
--   → 앱이 로그인 후 나라·사진을 채움 (한국어판은 'ZZ' 면 내가 고른 나라로)
-- · 이미 가입했는데 프로필이 없는 계정도 지금 채움
-- · 랭킹: 점수가 0인 사람도 그 앱을 쓰는 가입자면 아래쪽에 보임 (친구가 가입만 해도 목록에 나옴)

create or replace function public.mask_name(p text)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(
    case
      when char_length(w) <= 1 then w
      when char_length(w) = 2 then left(w, 1) || '*'
      else left(w, 1) || repeat('*', char_length(w) - 2) || right(w, 1)
    end, ' ' order by i), '')
  from regexp_split_to_table(btrim(coalesce(p, '')), '\s+') with ordinality as t(w, i)
  where w <> '';
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, country)
  values (
    new.id,
    left(mask_name(coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'nickname', ''),
      nullif(new.raw_user_meta_data->>'preferred_username', ''),
      'User'
    )), 60),
    'ZZ'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입한 계정 중 프로필이 없는 사람
insert into public.profiles (id, display_name, country)
select u.id,
       left(public.mask_name(coalesce(
         nullif(u.raw_user_meta_data->>'full_name', ''),
         nullif(u.raw_user_meta_data->>'name', ''),
         nullif(u.raw_user_meta_data->>'nickname', ''),
         nullif(u.raw_user_meta_data->>'preferred_username', ''),
         'User'
       )), 60),
       'ZZ'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ───────── 한국어판 랭킹: 한국어판을 쓰는 가입자(학습 기록·점수·하루 기록 중 하나라도 있음)는 0점이어도 보임 ─────────
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
  ), members as (
    select p.id, p.display_name, p.avatar_url, p.country, coalesce(s.points, 0)::bigint as points
    from profiles p
    left join sums s on s.user_id = p.id
    where s.user_id is not null
       or exists (select 1 from progress g where g.user_id = p.id)
       or exists (select 1 from point_events e where e.user_id = p.id)
       or exists (select 1 from daily_activity d where d.user_id = p.id)
  )
  select rank() over (order by m.points desc) as rank, m.id, m.display_name, m.avatar_url, m.country, m.points
  from members m
  where p_country is null or m.country = p_country
  order by m.points desc, m.display_name
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
  ), members as (
    select p.id, p.country, coalesce(s.points, 0)::bigint as points
    from profiles p
    left join sums s on s.user_id = p.id
    where s.user_id is not null
       or exists (select 1 from progress g where g.user_id = p.id)
       or exists (select 1 from point_events e where e.user_id = p.id)
       or exists (select 1 from daily_activity d where d.user_id = p.id)
  ), ranked as (
    select m.id, m.points, rank() over (order by m.points desc) as rank, count(*) over () as total
    from members m
    where p_country is null or m.country = p_country
  )
  select rank, points, total from ranked where id = auth.uid();
$$;

-- ───────── 일본어·영어판 랭킹: 그 판을 쓰는 가입자(판 학습 기록·하루 기록·점수)는 0점이어도 보임 ─────────
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
  ), members as (
    select p.id, p.display_name, p.avatar_url, coalesce(s.points, 0)::bigint as points
    from profiles p
    left join sums s on s.user_id = p.id
    where s.user_id is not null
       or exists (select 1 from edition_progress g where g.user_id = p.id and g.app = p_app)
       or exists (select 1 from edition_activity a where a.user_id = p.id and a.app = p_app)
       or exists (select 1 from edition_points e where e.user_id = p.id and e.app = p_app)
  )
  select rank() over (order by m.points desc) as rank, m.id, m.display_name, m.avatar_url, m.points
  from members m
  order by m.points desc, m.display_name
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

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
  ), members as (
    select p.id, coalesce(s.points, 0)::bigint as points
    from profiles p
    left join sums s on s.user_id = p.id
    where s.user_id is not null
       or exists (select 1 from edition_progress g where g.user_id = p.id and g.app = p_app)
       or exists (select 1 from edition_activity a where a.user_id = p.id and a.app = p_app)
       or exists (select 1 from edition_points e where e.user_id = p.id and e.app = p_app)
  ), ranked as (
    select m.id, m.points, rank() over (order by m.points desc) as rank, count(*) over () as total
    from members m
  )
  select rank, points, total from ranked where id = auth.uid();
$$;
