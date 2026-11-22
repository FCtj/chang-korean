-- Chang Korean 데이터베이스 (Supabase / PostgreSQL)
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다. 여러 번 실행해도 안전합니다.
-- 같은 내용이 supabase/migrations/ 에도 있습니다. Supabase의 GitHub 연동에서 'Deploy to production' 을 켜 두면
-- main 에 올릴 때 자동으로 적용됩니다. 스키마를 바꿀 때는 새 migration 파일을 만들고, 같은 SQL 을 이 파일 끝에 그대로 붙이세요
-- (npm run test:db 가 migrations 를 이어 붙인 것 = 이 파일인지 검사).
--
-- 테이블
--   profiles      사용자 정보 (Facebook 이름·사진, 나라)          — 누구나 읽기, 본인만 쓰기
--   progress      학습 기록 (STEP·외운 단어·통과한 회차 등 JSON)   — 본인만 읽기/쓰기
--   point_events  점수 기록 (랭킹 계산용)                          — 누구나 읽기, 쓰기는 award_points() 로만
--   groups / group_members / posts / reactions  스터디 그룹·피드 (아래 "스터디 그룹" 부분 참고) — 같은 그룹 멤버만 읽기
-- 함수
--   award_points(kind, ref, points)   점수 적립 (서버에서 하루 상한·중복 보너스 막음)
--   get_leaderboard(period, country)  랭킹 (period: 'today' 실시간 / 'month' 월간, country: 'LA' 등 또는 null=전체)
--   get_my_rank(period, country)      내 순위
--   delete_my_data()                  내 데이터 전부 삭제 (Facebook 데이터 삭제 요구사항, 그룹 글·반응·멤버십 포함)
--   create_group / join_group / my_groups / leave_group / group_feed / group_ranking / toggle_reaction  스터디 그룹
-- 하루·한 주·한 달의 기준 시간대: 라오스/태국 시간 (Asia/Vientiane, UTC+7), 한 주는 월요일 0시부터

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
    -- 'week' = 이번 주 월요일 0시 (ISO 주)
    when p_period = 'week' then date_trunc('week', now() at time zone 'Asia/Vientiane') at time zone 'Asia/Vientiane'
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

-- ═════════════════ 스터디 그룹 / 커뮤니티 ═════════════════
-- 테이블
--   groups         스터디 그룹 (이름·이모지·초대 코드 6자리)   — 멤버만 읽기, 방장만 이름·이모지 수정, 만들기는 create_group() 로만
--   group_members  그룹 멤버 (owner 방장 / member)            — 같은 그룹 멤버만 읽기, 가입은 join_group() 로만, 삭제는 본인(나가기) 또는 방장(내보내기)
--   posts          그룹 피드 글 (brag 자랑 / text 글 / achievement 시험 통과 인증 — 서버만 씀) — 멤버만 읽기·쓰기, 수정 불가
--   reactions      글 반응 (👏 🔥 💪 ❤️ 😂)                   — 멤버만 읽기, 본인 반응만 달기/지우기
-- 함수 (모두 로그인 필요, 아니면 'not_logged_in')
--   create_group(name, emoji)         그룹 만들기 → {id,name,emoji,code,owner,member_count,role} (방장은 최대 10개 → 'too_many')
--   join_group(code)                  초대 코드로 가입 (대소문자·앞뒤 공백 무시, 'not_found' / 그룹당 50명 'full' / 한 사람 20개 그룹 'too_many')
--   my_groups()                       내 그룹 목록 (들어간 순서)
--   leave_group(group)                나가기 (방장이 나가면 가장 먼저 들어온 멤버가 방장, 아무도 없으면 그룹 삭제)
--   group_feed(group, before, limit)  피드 (최신순, 반응 수·내 반응 포함, 멤버 아니면 'not_member')
--   group_ranking(group, period)      그룹 안 랭킹 (period: 'week' 이번 주(기본) / 'today' / 'month')
--   toggle_reaction(post, emoji)      반응 달기/취소 (true = 달림, false = 취소됨)
-- 졸업시험·승급시험 보너스(point_events kind 'exam'/'promo')가 적립되면 내가 속한 모든 그룹 피드에 인증 글(achievement, verified)이 자동으로 올라감

-- ───────── 그룹 테이블 ─────────

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  emoji text not null default '🐘' check (char_length(emoji) <= 8),
  code text not null unique,
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id, joined_at);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('brag', 'text', 'achievement')),
  body text not null default '' check (char_length(body) <= 500),
  data jsonb not null default '{}' check (pg_column_size(data) < 2000),
  verified boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists posts_group_created_idx on public.posts (group_id, created_at desc);

create table if not exists public.reactions (
  post_id uuid references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👏', '🔥', '💪', '❤️', '😂')),
  created_at timestamptz default now(),
  primary key (post_id, user_id, emoji)
);

-- 글 시각은 서버 시각으로 (앱이 미래 시각을 넣어 피드 맨 위에 고정하는 것 방지)
create or replace function public.posts_set_created_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists posts_set_created_at on public.posts;
create trigger posts_set_created_at before insert on public.posts
  for each row execute function public.posts_set_created_at();

-- ───────── 그룹 도우미 함수 ─────────

-- 내가 이 그룹 멤버인가? (RLS 정책에서 사용. security definer 라서 group_members 정책을 다시 타지 않음 → 재귀 없음)
create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;

-- (내부용) 그룹 정보 JSON {id, name, emoji, code, owner, member_count, role}
create or replace function public.group_json(p_group uuid, p_user uuid)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'id', g.id,
    'name', g.name,
    'emoji', g.emoji,
    'code', g.code,
    'owner', g.owner,
    'member_count', (select count(*)::int from group_members c where c.group_id = g.id),
    'role', m.role
  )
  from groups g
  join group_members m on m.group_id = g.id and m.user_id = p_user
  where g.id = p_group;
$$;

-- (내부용) 방장이 그룹을 떠났을 때: 가장 먼저 들어온 남은 멤버에게 방장을 넘기고, 아무도 없으면 그룹 삭제
create or replace function public.group_owner_left(p_group uuid, p_user uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_next uuid;
begin
  if not exists (select 1 from groups where id = p_group and owner = p_user) then
    return;
  end if;
  select user_id into v_next
    from group_members
    where group_id = p_group and user_id <> p_user
    order by joined_at, user_id
    limit 1;
  if v_next is null then
    delete from groups where id = p_group;
  else
    update groups set owner = v_next where id = p_group;
    update group_members set role = 'owner' where group_id = p_group and user_id = v_next;
  end if;
end;
$$;

-- 멤버 행이 지워질 때마다 (leave_group, 직접 삭제, delete_my_data) 방장 승계 처리
create or replace function public.group_member_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform group_owner_left(old.group_id, old.user_id);
  return null;
end;
$$;

drop trigger if exists group_members_owner_left on public.group_members;
create trigger group_members_owner_left after delete on public.group_members
  for each row execute function public.group_member_deleted();

-- ───────── 그룹 권한 (RLS) ─────────

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;

-- groups: 멤버만 읽기. 만들기·삭제는 함수로만. 방장은 이름·이모지만 수정 가능
drop policy if exists "members read group" on public.groups;
create policy "members read group" on public.groups for select using (public.is_group_member(id));
drop policy if exists "owner updates group" on public.groups;
create policy "owner updates group" on public.groups for update using (auth.uid() = owner) with check (auth.uid() = owner);
revoke update on public.groups from anon, authenticated;
grant update (name, emoji) on public.groups to authenticated;

-- group_members: 같은 그룹 멤버만 읽기. 가입은 join_group() 로만. 삭제는 본인(나가기) 또는 방장(내보내기)
drop policy if exists "members read members" on public.group_members;
create policy "members read members" on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists "leave or owner removes" on public.group_members;
create policy "leave or owner removes" on public.group_members for delete using (
  auth.uid() = user_id
  or exists (select 1 from public.groups g where g.id = group_members.group_id and g.owner = auth.uid())
);

-- posts: 멤버만 읽기. 멤버는 본인 이름으로 brag/text 만 쓰기 (achievement·verified 는 서버만). 삭제는 글쓴이 또는 방장. 수정 불가
drop policy if exists "members read posts" on public.posts;
create policy "members read posts" on public.posts for select using (public.is_group_member(group_id));
drop policy if exists "members write posts" on public.posts;
create policy "members write posts" on public.posts for insert with check (
  auth.uid() = user_id
  and kind in ('brag', 'text')
  and verified = false
  and public.is_group_member(group_id)
);
drop policy if exists "author or owner deletes post" on public.posts;
create policy "author or owner deletes post" on public.posts for delete using (
  auth.uid() = user_id
  or exists (select 1 from public.groups g where g.id = posts.group_id and g.owner = auth.uid())
);

-- reactions: 글이 있는 그룹의 멤버만 읽기. 본인 반응만, 멤버일 때만 달기/지우기
drop policy if exists "members read reactions" on public.reactions;
create policy "members read reactions" on public.reactions for select using (
  exists (select 1 from public.posts p where p.id = reactions.post_id and public.is_group_member(p.group_id))
);
drop policy if exists "members add own reaction" on public.reactions;
create policy "members add own reaction" on public.reactions for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.posts p where p.id = reactions.post_id and public.is_group_member(p.group_id))
);
drop policy if exists "members remove own reaction" on public.reactions;
create policy "members remove own reaction" on public.reactions for delete using (
  auth.uid() = user_id
  and exists (select 1 from public.posts p where p.id = reactions.post_id and public.is_group_member(p.group_id))
);

-- ───────── 그룹 함수 ─────────

create or replace function public.create_group(p_name text, p_emoji text default '🐘')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 헷갈리는 I O 0 1 제외
  v_code text;
  v_id uuid;
  v_tries int := 0;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  -- 방장은 최대 10개 그룹, 한 사람은 최대 20개 그룹
  if (select count(*) from groups where owner = uid) >= 10
     or (select count(*) from group_members where user_id = uid) >= 20 then
    raise exception 'too_many';
  end if;
  -- 초대 코드 6자리, 겹치면 다시 만듦
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    begin
      insert into groups (name, emoji, code, owner)
        values (btrim(p_name), coalesce(nullif(btrim(p_emoji), ''), '🐘'), v_code, uid)
        returning id into v_id;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries >= 20 then
        raise;
      end if;
    end;
  end loop;
  insert into group_members (group_id, user_id, role) values (v_id, uid, 'owner');
  return group_json(v_id, uid);
end;
$$;

create or replace function public.join_group(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  select id into v_id
    from groups
    where code = upper(regexp_replace(coalesce(p_code, ''), '^\s+|\s+$', '', 'g'))
    for update; -- 동시에 가입해도 50명을 넘지 않게
  if v_id is null then
    raise exception 'not_found';
  end if;
  if exists (select 1 from group_members where group_id = v_id and user_id = uid) then
    return group_json(v_id, uid);
  end if;
  if (select count(*) from group_members where group_id = v_id) >= 50 then
    raise exception 'full';
  end if;
  if (select count(*) from group_members where user_id = uid) >= 20 then
    raise exception 'too_many';
  end if;
  insert into group_members (group_id, user_id, role) values (v_id, uid, 'member');
  return group_json(v_id, uid);
end;
$$;

create or replace function public.my_groups()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v json;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  select coalesce(json_agg(group_json(m.group_id, uid) order by m.joined_at, m.group_id), '[]'::json) into v
    from group_members m
    where m.user_id = uid;
  return v;
end;
$$;

create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  -- 방장이었다면 group_members 삭제 트리거가 방장을 넘기거나 그룹을 삭제함
  delete from group_members where group_id = p_group and user_id = uid;
  perform group_owner_left(p_group, uid); -- 멤버 행 없이 방장만 남아 있던 경우까지 정리
end;
$$;

create or replace function public.group_feed(p_group uuid, p_before timestamptz default null, p_limit int default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v json;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if not is_group_member(p_group) then
    raise exception 'not_member';
  end if;
  select coalesce(json_agg(json_build_object(
      'id', p.id,
      'user_id', p.user_id,
      'name', pr.display_name,
      'avatar', pr.avatar_url,
      'kind', p.kind,
      'body', p.body,
      'data', p.data,
      'verified', p.verified,
      'created_at', p.created_at,
      'reactions', (
        select coalesce(json_object_agg(r.emoji, r.n order by r.first_at), '{}'::json)
        from (
          select emoji, count(*)::int as n, min(created_at) as first_at
          from reactions where post_id = p.id group by emoji
        ) r
      ),
      'mine', (
        select coalesce(json_agg(r.emoji order by r.created_at), '[]'::json)
        from reactions r where r.post_id = p.id and r.user_id = uid
      )
    ) order by p.created_at desc, p.id desc), '[]'::json) into v
  from (
    select * from posts
    where group_id = p_group and (p_before is null or created_at < p_before)
    order by created_at desc, id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  ) p
  left join profiles pr on pr.id = p.user_id;
  return v;
end;
$$;

create or replace function public.group_ranking(p_group uuid, p_period text default 'week')
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_since timestamptz := period_start(p_period);
  v json;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if not is_group_member(p_group) then
    raise exception 'not_member';
  end if;
  select coalesce(json_agg(json_build_object(
      'user_id', m.user_id,
      'name', pr.display_name,
      'avatar', pr.avatar_url,
      'country', pr.country,
      'role', m.role,
      'points', m.points
    ) order by m.points desc, m.joined_at, m.user_id), '[]'::json) into v
  from (
    select gm.user_id, gm.role, gm.joined_at,
      coalesce((select sum(e.points) from point_events e where e.user_id = gm.user_id and e.created_at >= v_since), 0)::bigint as points
    from group_members gm
    where gm.group_id = p_group
  ) m
  left join profiles pr on pr.id = m.user_id;
  return v;
end;
$$;

create or replace function public.toggle_reaction(p_post uuid, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_group uuid;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  select group_id into v_group from posts where id = p_post;
  if v_group is null or not is_group_member(v_group) then
    raise exception 'not_member';
  end if;
  delete from reactions where post_id = p_post and user_id = uid and emoji = p_emoji;
  if found then
    return false;
  end if;
  insert into reactions (post_id, user_id, emoji) values (p_post, uid, p_emoji) on conflict do nothing;
  return true;
end;
$$;

-- 졸업시험·승급시험 보너스가 적립되면 내가 속한 모든 그룹에 인증 글 자동 게시
create or replace function public.post_achievement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into posts (group_id, user_id, kind, body, data, verified)
  select m.group_id, new.user_id, 'achievement', '',
         jsonb_build_object('type', new.kind, 'ref', new.ref, 'points', new.points), true
  from group_members m
  where m.user_id = new.user_id;
  return null;
end;
$$;

drop trigger if exists point_events_achievement on public.point_events;
create trigger point_events_achievement after insert on public.point_events
  for each row when (new.kind in ('exam', 'promo')) execute function public.post_achievement();

revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to anon, authenticated; -- RLS 정책이 호출하므로 필요 (로그인 안 했으면 false)
revoke all on function public.group_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.group_owner_left(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;
revoke all on function public.my_groups() from public, anon;
grant execute on function public.my_groups() to authenticated;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;
revoke all on function public.group_feed(uuid, timestamptz, int) from public, anon;
grant execute on function public.group_feed(uuid, timestamptz, int) to authenticated;
revoke all on function public.group_ranking(uuid, text) from public, anon;
grant execute on function public.group_ranking(uuid, text) to authenticated;
revoke all on function public.toggle_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_reaction(uuid, text) to authenticated;

-- ───────── 실시간 (그룹 피드 자동 갱신) ─────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

-- ───────── 테이블 권한 (2026-11-21 추가) ─────────
-- 새 Supabase 프로젝트는 anon(로그인 전)·authenticated(로그인 후) 역할에 테이블 권한을 자동으로 주지 않아서
-- 앱이 "permission denied for table …" 로 막힙니다. 여기서 테이블에 접근할 수 있는 권한만 열고,
-- 어떤 행을 보고 쓸 수 있는지는 위의 RLS 정책이 그대로 정합니다. 여러 번 실행해도 안전합니다.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.point_events to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update on public.progress to authenticated;
grant select on public.groups to authenticated;
grant update (name, emoji) on public.groups to authenticated;
grant select, delete on public.group_members to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant select, insert, delete on public.reactions to authenticated;

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

-- ───────── 번역 검수 (2026-11-22 추가) ─────────
-- 원어민이 앱의 번역(라오어·태국어·베트남어)을 보고 [맞아요] / [고칠게요]를 남기는 곳.
-- 단어 id 는 내용이 바뀌면 달라질 수 있어서, 단원 id + 한국어 + 그때 보던 번역을 함께 저장합니다.
-- 한 사람이 같은 항목·언어에는 한 번만 (다시 보내면 고쳐짐). 본인 것만 보이고, 결과는 운영자가 SQL Editor 에서 봅니다:
--   select unit_id, ko, lang, current_text, verdict, suggestion, count(*) from translation_reviews
--   group by 1,2,3,4,5,6 order by 1,2;
create table if not exists public.translation_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unit_id text not null check (char_length(unit_id) between 1 and 80),
  ko text not null check (char_length(ko) between 1 and 200),
  lang text not null check (lang in ('lo', 'th', 'vi')),
  current_text text not null default '' check (char_length(current_text) <= 300),
  verdict text not null check (verdict in ('ok', 'fix')),
  suggestion text not null default '' check (char_length(suggestion) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, unit_id, ko, lang)
);
create index if not exists translation_reviews_item_idx on public.translation_reviews (unit_id, lang);

alter table public.translation_reviews enable row level security;
drop policy if exists "read own reviews" on public.translation_reviews;
create policy "read own reviews" on public.translation_reviews for select using (auth.uid() = user_id);
drop policy if exists "write own reviews" on public.translation_reviews;
create policy "write own reviews" on public.translation_reviews for insert with check (auth.uid() = user_id);
drop policy if exists "update own reviews" on public.translation_reviews;
create policy "update own reviews" on public.translation_reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own reviews" on public.translation_reviews;
create policy "delete own reviews" on public.translation_reviews for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.translation_reviews to authenticated;

-- 내 데이터 삭제 때 검수 기록도 지움 (on delete cascade 는 계정 삭제 때만이라 여기서 따로)
create or replace function public.delete_my_review_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.translation_reviews where user_id = auth.uid();
$$;
revoke all on function public.delete_my_review_data() from public, anon;
grant execute on function public.delete_my_review_data() to authenticated;

-- ═════════ 몽골어 학습자 (v0.20) ═════════
-- 학습자 언어(native)·번역 검수 언어(lang)에 'mn' 추가. 두 번 실행해도 안전
alter table public.profile_private drop constraint if exists profile_private_native_check;
alter table public.profile_private add constraint profile_private_native_check check (native in ('lo', 'th', 'vi', 'mn'));
alter table public.translation_reviews drop constraint if exists translation_reviews_lang_check;
alter table public.translation_reviews add constraint translation_reviews_lang_check check (lang in ('lo', 'th', 'vi', 'mn'));

-- ═════════ 아랍어 학습자 · 레바논 (v0.21) ═════════
-- 학습자 언어(native)·번역 검수 언어(lang)에 'ar' 추가. 두 번 실행해도 안전
alter table public.profile_private drop constraint if exists profile_private_native_check;
alter table public.profile_private add constraint profile_private_native_check check (native in ('lo', 'th', 'vi', 'mn', 'ar'));
alter table public.translation_reviews drop constraint if exists translation_reviews_lang_check;
alter table public.translation_reviews add constraint translation_reviews_lang_check check (lang in ('lo', 'th', 'vi', 'mn', 'ar'));

-- ═════════ 관리자 · 사용 현황 (v0.22) ═════════
-- admins           관리자 계정 목록. 정책이 없어 앱(anon·authenticated)에서는 읽기·쓰기 모두 불가 → SQL 편집기에서만 추가·삭제
--                  예) insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일';
-- is_admin()       지금 로그인한 계정이 관리자인지 (설정 화면에 '관리자' 버튼을 보일지)
-- admin_overview(days)   가입·활동 합계, 날짜별 신규 가입·활동자, 나라·언어·코스별 사용자 수 (관리자만, 아니면 'not_admin')
-- admin_users(search, order, limit, offset)   사용자별 사용 현황 목록 (관리자만)
-- admin_user_detail(user)   한 사람의 최근 60일 학습·최근 포인트 기록 (관리자만)
-- 이름·사진은 profiles 에 올라간 값 그대로 = 본인이 '이름 일부 가리기'를 켰으면 관리자에게도 가린 채로 보임
-- 날짜는 앱과 같이 라오스 시간(Asia/Vientiane) 기준

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_overview(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 7), 180);
  v_today date := (now() at time zone 'Asia/Vientiane')::date;
  r jsonb;
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  with days as (
    select (v_today - g)::date as day from generate_series(0, d - 1) g
  ),
  signups as (
    select (created_at at time zone 'Asia/Vientiane')::date as day, count(*)::int as n from profiles group by 1
  ),
  act as (
    select day, count(*)::int as users, sum(study_seconds)::bigint as seconds from daily_activity where day > v_today - d group by day
  )
  select jsonb_build_object(
    'today', v_today,
    'users', (select count(*) from profiles),
    'new_today', coalesce((select n from signups where day = v_today), 0),
    'new_7d', (select count(*) from profiles where (created_at at time zone 'Asia/Vientiane')::date > v_today - 7),
    'new_30d', (select count(*) from profiles where (created_at at time zone 'Asia/Vientiane')::date > v_today - 30),
    'active_today', (select count(distinct user_id) from daily_activity where day = v_today),
    'active_7d', (select count(distinct user_id) from daily_activity where day > v_today - 7),
    'active_30d', (select count(distinct user_id) from daily_activity where day > v_today - 30),
    'seconds_7d', (select coalesce(sum(study_seconds), 0) from daily_activity where day > v_today - 7),
    'points_7d', (select coalesce(sum(points), 0) from point_events where created_at > now() - interval '7 days'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('day', days.day, 'signups', coalesce(s.n, 0), 'active', coalesce(a.users, 0), 'seconds', coalesce(a.seconds, 0)) order by days.day), '[]'::jsonb)
      from days left join signups s on s.day = days.day left join act a on a.day = days.day
    ),
    'countries', (select coalesce(jsonb_object_agg(country, n), '{}'::jsonb) from (select country, count(*) as n from profiles group by country) x),
    'natives', (select coalesce(jsonb_object_agg(native, n), '{}'::jsonb) from (select coalesce(native, '?') as native, count(*) as n from profile_private group by 1) x),
    'courses', (select coalesce(jsonb_object_agg(course, n), '{}'::jsonb) from (select coalesce(data->>'course', 'basic') as course, count(*) as n from progress group by 1) x)
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_overview(int) from public, anon;
grant execute on function public.admin_overview(int) to authenticated;

-- 다음 마이그레이션(접속 위치)에서 반환 열이 늘어나므로, 다시 실행해도 되게 먼저 지움
drop function if exists public.admin_users(text, text, int, int);
create or replace function public.admin_users(p_search text default null, p_order text default 'recent', p_limit int default 50, p_offset int default 0)
returns table (
  user_id uuid, display_name text, avatar_url text, country text, created_at timestamptz, last_seen timestamptz,
  active_days int, study_seconds bigint, words bigint, questions bigint, points bigint, points_7d bigint,
  course text, topik_level int, native text, hour_caps int, fast int, correct int, total bigint
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
           case when (g.data->'cheat'->>'correct') ~ '^[0-9]+$' then (g.data->'cheat'->>'correct')::int else 0 end as correct
    from profiles p
    left join a on a.user_id = p.id
    left join pe on pe.user_id = p.id
    left join progress g on g.user_id = p.id
    left join profile_private pp on pp.user_id = p.id
    where p_search is null or p_search = '' or p.display_name ilike '%' || p_search || '%'
  )
  select r.id, r.display_name, r.avatar_url, r.country, r.created_at, r.last_seen, r.days, r.secs, r.words, r.qs, r.pts, r.pts7,
         r.course, r.topik, r.native, r.caps, r.fast, r.correct, count(*) over ()
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
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'seconds', study_seconds, 'words', words_seen, 'questions', questions, 'sessions', sessions) order by day), '[]'::jsonb)
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

-- ═════════ 커뮤니티 v2: 전체 공개 글 · 댓글 · 신고 · 차단 · 관리자 관리 (v0.24) ═════════
-- 글은 두 가지
--   전체 공개 (visibility 'public', group_id 없음) — 누구나 읽기(로그인 전에도), 로그인한 사람이 쓰기. 말머리: 질문·공부 인증·일·생활·자유
--   그룹 (visibility 'group') — 지금까지처럼 그 그룹 멤버만
-- 댓글(comments): 글을 볼 수 있는 사람만 읽고 쓰기. 지우기는 댓글 쓴 사람 · 글쓴이 · 그룹 방장 · 관리자
-- 신고(reports): 서로 다른 3명이 신고하면 자동으로 숨김 → 관리자가 확인(숨김 유지 · 되살리기 · 삭제)
-- 차단(user_blocks): 내가 차단한 사람의 글·댓글은 나에게 안 보임
-- 쓰기는 모두 함수로만 (하루 글 공개 10개 · 그룹 50개, 댓글 100개까지). 테이블 직접 읽기·쓰기 불가
-- 함수: public_feed · create_post · post_thread · add_comment · delete_comment · report_content · block_user · my_blocks · my_activity
--       admin_reports · admin_moderate (관리자만). group_feed 에 댓글 수 추가 · 숨긴 글/차단한 사람 제외. toggle_reaction 은 공개 글에도
-- delete_my_data 는 댓글 · 신고 · 차단 기록도 함께 삭제

alter table public.posts alter column group_id drop not null;
alter table public.posts add column if not exists visibility text not null default 'group';
alter table public.posts add column if not exists category text;
alter table public.posts add column if not exists hidden boolean not null default false;
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check ((visibility = 'group' and group_id is not null) or (visibility = 'public' and group_id is null));
alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check check (category is null or category in ('question', 'study', 'life', 'free'));
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check check (char_length(body) <= 1000);
create index if not exists posts_public_created_idx on public.posts (created_at desc) where visibility = 'public';
create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);

-- 공개 글은 누구나 읽을 수 있음 (그룹 글 정책은 그대로)
drop policy if exists "anyone reads public posts" on public.posts;
create policy "anyone reads public posts" on public.posts for select using (visibility = 'public' and not hidden);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_user_idx on public.comments (user_id, created_at desc);
alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;
drop trigger if exists comments_set_created_at on public.comments;
create trigger comments_set_created_at before insert on public.comments
  for each row execute function public.posts_set_created_at();

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'sexual', 'privacy', 'other')),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);
create unique index if not exists reports_once on public.reports (reporter, coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create table if not exists public.user_blocks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;

-- 이 글을 지금 사람이 볼 수 있나 (숨김 아님 + 공개이거나 그 그룹 멤버)
create or replace function public.can_see_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from posts p
    where p.id = p_post and not p.hidden and (p.visibility = 'public' or public.is_group_member(p.group_id))
  );
$$;
revoke all on function public.can_see_post(uuid) from public, anon;
grant execute on function public.can_see_post(uuid) to authenticated;

-- 글 한 개를 앱에 보낼 모양 (피드·상세 공통)
create or replace function public.post_json(p_post uuid, p_uid uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'name', coalesce(pr.display_name, ''),
    'avatar', pr.avatar_url,
    'country', pr.country,
    'visibility', p.visibility,
    'group_id', p.group_id,
    'group_name', g.name,
    'group_emoji', g.emoji,
    'category', p.category,
    'kind', p.kind,
    'body', p.body,
    'data', p.data,
    'verified', p.verified,
    'created_at', p.created_at,
    'reactions', (
      select coalesce(json_object_agg(r.emoji, r.n order by r.first_at), '{}'::json)
      from (select emoji, count(*)::int as n, min(created_at) as first_at from reactions where post_id = p.id group by emoji) r
    ),
    'mine', (select coalesce(json_agg(r.emoji order by r.created_at), '[]'::json) from reactions r where r.post_id = p.id and r.user_id = p_uid),
    'comments', (
      select count(*)::int from comments c
      where c.post_id = p.id and not c.hidden
        and (p_uid is null or not exists (select 1 from user_blocks b where b.user_id = p_uid and b.blocked_id = c.user_id))
    )
  )
  from posts p
  left join profiles pr on pr.id = p.user_id
  left join groups g on g.id = p.group_id
  where p.id = p_post;
$$;
revoke all on function public.post_json(uuid, uuid) from public, anon, authenticated;

create or replace function public.public_feed(p_category text default null, p_country text default null, p_before timestamptz default null, p_limit int default 20)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v json;
begin
  select coalesce(json_agg(post_json(x.id, uid) order by x.created_at desc, x.id desc), '[]'::json) into v
  from (
    select p.id, p.created_at
    from posts p
    left join profiles pr on pr.id = p.user_id
    where p.visibility = 'public' and not p.hidden
      and (p_category is null or p.category = p_category)
      and (p_country is null or pr.country = p_country)
      and (p_before is null or p.created_at < p_before)
      and (uid is null or not exists (select 1 from user_blocks b where b.user_id = uid and b.blocked_id = p.user_id))
    order by p.created_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) x;
  return v;
end;
$$;
grant execute on function public.public_feed(text, text, timestamptz, int) to anon, authenticated;

create or replace function public.create_post(p_visibility text, p_group uuid default null, p_category text default null, p_body text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'bad_body';
  end if;
  if p_visibility = 'public' then
    if (select count(*) from posts where user_id = uid and visibility = 'public' and created_at > now() - interval '1 day') >= 10 then
      raise exception 'too_many_posts';
    end if;
    insert into posts (group_id, user_id, kind, body, visibility, category)
      values (null, uid, 'text', v_body, 'public', case when p_category in ('question', 'study', 'life', 'free') then p_category else 'free' end)
      returning id into v_id;
  elsif p_visibility = 'group' then
    if p_group is null or not is_group_member(p_group) then
      raise exception 'not_member';
    end if;
    if (select count(*) from posts where user_id = uid and visibility = 'group' and created_at > now() - interval '1 day') >= 50 then
      raise exception 'too_many_posts';
    end if;
    insert into posts (group_id, user_id, kind, body, visibility) values (p_group, uid, 'text', v_body, 'group') returning id into v_id;
  else
    raise exception 'bad_visibility';
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_post(text, uuid, text, text) from public, anon;
grant execute on function public.create_post(text, uuid, text, text) to authenticated;

-- 글 + 댓글 (공개 글은 로그인 전에도)
create or replace function public.post_thread(p_post uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_vis text;
begin
  select visibility into v_vis from posts where id = p_post and not hidden;
  if v_vis is null or (v_vis = 'group' and (uid is null or not is_group_member((select group_id from posts where id = p_post)))) then
    raise exception 'not_found';
  end if;
  return json_build_object(
    'post', post_json(p_post, uid),
    'comments', (
      select coalesce(json_agg(json_build_object(
          'id', c.id, 'user_id', c.user_id, 'name', coalesce(pr.display_name, ''), 'avatar', pr.avatar_url, 'country', pr.country,
          'body', c.body, 'created_at', c.created_at, 'mine', c.user_id = uid
        ) order by c.created_at, c.id), '[]'::json)
      from comments c
      left join profiles pr on pr.id = c.user_id
      where c.post_id = p_post and not c.hidden
        and (uid is null or not exists (select 1 from user_blocks b where b.user_id = uid and b.blocked_id = c.user_id))
    )
  );
end;
$$;
grant execute on function public.post_thread(uuid) to anon, authenticated;

create or replace function public.add_comment(p_post uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if not can_see_post(p_post) then
    raise exception 'not_found';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'bad_body';
  end if;
  if (select count(*) from comments where user_id = uid and created_at > now() - interval '1 day') >= 100 then
    raise exception 'too_many_comments';
  end if;
  insert into comments (post_id, user_id, body) values (p_post, uid, v_body) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_comment(uuid, text) from public, anon;
grant execute on function public.add_comment(uuid, text) to authenticated;

create or replace function public.delete_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  delete from comments c
  using posts p
  where c.id = p_comment and p.id = c.post_id
    and (c.user_id = uid or p.user_id = uid or exists (select 1 from groups g where g.id = p.group_id and g.owner = uid) or is_admin());
  if not found then
    raise exception 'not_allowed';
  end if;
end;
$$;
revoke all on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

-- 신고: 같은 것을 한 사람이 한 번만. 서로 다른 3명이 신고하면 숨김. 숨겨졌는지 돌려줌
create or replace function public.report_content(p_post uuid default null, p_comment uuid default null, p_reason text default 'other')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_post uuid := p_post;
  n int;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if (p_post is null) = (p_comment is null) then
    raise exception 'bad_target';
  end if;
  if p_comment is not null then
    select post_id into v_post from comments where id = p_comment;
  end if;
  if v_post is null or not can_see_post(v_post) then
    raise exception 'not_found';
  end if;
  insert into reports (reporter, post_id, comment_id, reason)
    values (uid, p_post, p_comment, case when p_reason in ('spam', 'abuse', 'sexual', 'privacy', 'other') then p_reason else 'other' end)
  on conflict do nothing;
  if p_comment is not null then
    select count(distinct reporter) into n from reports where comment_id = p_comment;
    if n >= 3 then
      update comments set hidden = true where id = p_comment;
      return true;
    end if;
  else
    select count(distinct reporter) into n from reports where post_id = p_post;
    if n >= 3 then
      update posts set hidden = true where id = p_post;
      return true;
    end if;
  end if;
  return false;
end;
$$;
revoke all on function public.report_content(uuid, uuid, text) from public, anon;
grant execute on function public.report_content(uuid, uuid, text) to authenticated;

create or replace function public.block_user(p_user uuid, p_block boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if p_user is null or p_user = uid then
    raise exception 'bad_target';
  end if;
  if p_block then
    insert into user_blocks (user_id, blocked_id) values (uid, p_user) on conflict do nothing;
  else
    delete from user_blocks where user_id = uid and blocked_id = p_user;
  end if;
end;
$$;
revoke all on function public.block_user(uuid, boolean) from public, anon;
grant execute on function public.block_user(uuid, boolean) to authenticated;

create or replace function public.my_blocks()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('user_id', b.blocked_id, 'name', coalesce(pr.display_name, ''), 'avatar', pr.avatar_url) order by b.created_at desc), '[]'::json)
  from user_blocks b left join profiles pr on pr.id = b.blocked_id
  where b.user_id = auth.uid();
$$;
revoke all on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

-- 내 활동: 내가 쓴 글(공개·그룹, 마지막 댓글 시각) · 내가 쓴 댓글
create or replace function public.my_activity()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  return json_build_object(
    'posts', (
      select coalesce(json_agg(json_build_object(
          'id', p.id, 'visibility', p.visibility, 'group_name', g.name, 'group_emoji', g.emoji, 'category', p.category,
          'body', left(p.body, 140), 'created_at', p.created_at, 'hidden', p.hidden,
          'comments', (select count(*)::int from comments c where c.post_id = p.id and not c.hidden),
          'last_comment_at', (select max(c.created_at) from comments c where c.post_id = p.id and c.user_id <> uid and not c.hidden)
        ) order by p.created_at desc), '[]'::json)
      from (select * from posts where user_id = uid and kind = 'text' order by created_at desc limit 30) p
      left join groups g on g.id = p.group_id
      where p.visibility = 'public' or is_group_member(p.group_id)
    ),
    'comments', (
      select coalesce(json_agg(json_build_object(
          'id', c.id, 'post_id', c.post_id, 'body', left(c.body, 140), 'created_at', c.created_at,
          'post_body', left(p.body, 60), 'visibility', p.visibility, 'group_name', g.name
        ) order by c.created_at desc), '[]'::json)
      from (select * from comments where user_id = uid order by created_at desc limit 30) c
      join posts p on p.id = c.post_id
      left join groups g on g.id = p.group_id
      where not p.hidden and (p.visibility = 'public' or is_group_member(p.group_id))
    )
  );
end;
$$;
revoke all on function public.my_activity() from public, anon;
grant execute on function public.my_activity() to authenticated;

-- 그룹 피드: 댓글 수 · 숨긴 글과 차단한 사람 제외 (모양은 post_json 과 같음)
create or replace function public.group_feed(p_group uuid, p_before timestamptz default null, p_limit int default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v json;
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if not is_group_member(p_group) then
    raise exception 'not_member';
  end if;
  select coalesce(json_agg(post_json(x.id, uid) order by x.created_at desc, x.id desc), '[]'::json) into v
  from (
    select p.id, p.created_at from posts p
    where p.group_id = p_group and not p.hidden
      and (p_before is null or p.created_at < p_before)
      and not exists (select 1 from user_blocks b where b.user_id = uid and b.blocked_id = p.user_id)
    order by p.created_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  ) x;
  return v;
end;
$$;

-- 반응: 볼 수 있는 글이면 (공개 글 포함)
create or replace function public.toggle_reaction(p_post uuid, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_logged_in';
  end if;
  if not can_see_post(p_post) then
    raise exception 'not_member';
  end if;
  delete from reactions where post_id = p_post and user_id = uid and emoji = p_emoji;
  if found then
    return false;
  end if;
  insert into reactions (post_id, user_id, emoji) values (p_post, uid, p_emoji) on conflict do nothing;
  return true;
end;
$$;

-- 관리자: 신고된 글·댓글 목록 (숨김 여부 · 신고 수 · 이유)
create or replace function public.admin_reports()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  return (
    select coalesce(json_agg(x order by x.hidden desc, x.n desc, x.last_at desc), '[]'::json)
    from (
      select 'post' as type, p.id, p.id as post_id, p.body, p.hidden, p.visibility, p.user_id, coalesce(pr.display_name, '') as name,
             count(distinct r.reporter)::int as n, json_agg(distinct r.reason) as reasons, max(r.created_at) as last_at
      from reports r join posts p on p.id = r.post_id left join profiles pr on pr.id = p.user_id
      group by p.id, pr.display_name
      union all
      select 'comment', c.id, c.post_id, c.body, c.hidden, p.visibility, c.user_id, coalesce(pr.display_name, ''),
             count(distinct r.reporter)::int, json_agg(distinct r.reason), max(r.created_at)
      from reports r join comments c on c.id = r.comment_id join posts p on p.id = c.post_id left join profiles pr on pr.id = c.user_id
      group by c.id, p.visibility, pr.display_name
    ) x
  );
end;
$$;
revoke all on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

-- 관리자: hide 숨기기 · dismiss 신고 지우고 되살리기 · delete 삭제
create or replace function public.admin_moderate(p_post uuid default null, p_comment uuid default null, p_action text default 'hide')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  if (p_post is null) = (p_comment is null) then
    raise exception 'bad_target';
  end if;
  if p_action = 'hide' then
    update posts set hidden = true where id = p_post;
    update comments set hidden = true where id = p_comment;
  elsif p_action = 'dismiss' then
    delete from reports where post_id = p_post or comment_id = p_comment;
    update posts set hidden = false where id = p_post;
    update comments set hidden = false where id = p_comment;
  elsif p_action = 'delete' then
    delete from posts where id = p_post;
    delete from comments where id = p_comment;
  else
    raise exception 'bad_action';
  end if;
end;
$$;
revoke all on function public.admin_moderate(uuid, uuid, text) from public, anon;
grant execute on function public.admin_moderate(uuid, uuid, text) to authenticated;

-- 내 데이터 삭제: 댓글 · 신고 · 차단 기록도 함께
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
  delete from profile_private where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
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
-- 수정 요청 · 제안 (단어의 발음·뜻·예문·그림이 틀렸을 때, 앱에 대한 의견)
-- · 누구나(로그인하지 않아도) 보낼 수 있음 — 표에 직접 쓰기는 막고 submit_feedback() 만 열어 둠
-- · 너무 많이 보내기 막기: 로그인한 사람 하루 30건, 로그인 안 한 사람 전체 1시간 200건
-- · 관리자만 보기 · 처리 표시: admin_feedback(), admin_feedback_set()
-- · 내 정보 삭제(delete_my_data)나 계정 삭제 때 내가 보낸 요청도 지움

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  app text not null check (app in ('ko', 'ja', 'en')),
  kind text not null check (kind in ('word', 'app')),
  category text not null check (category in ('pron', 'meaning', 'example', 'picture', 'bug', 'idea', 'other')),
  target text check (char_length(target) <= 200),
  context text check (char_length(context) <= 300),
  message text not null check (char_length(message) between 1 and 1000),
  ui text check (char_length(ui) <= 8),
  status text not null default 'new' check (status in ('new', 'done', 'skip'))
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(
  p_app text,
  p_kind text,
  p_category text,
  p_target text,
  p_context text,
  p_message text,
  p_ui text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_msg text := left(btrim(coalesce(p_message, '')), 1000);
begin
  if char_length(v_msg) = 0 then
    raise exception 'empty_message';
  end if;
  if auth.uid() is not null then
    if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
      raise exception 'too_many';
    end if;
  elsif (select count(*) from feedback where user_id is null and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'too_many';
  end if;
  insert into feedback (user_id, app, kind, category, target, context, message, ui)
  values (auth.uid(), p_app, p_kind, p_category, left(p_target, 200), left(p_context, 300), v_msg, left(p_ui, 8))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_feedback(text, text, text, text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text, text, text, text) to anon, authenticated;

-- 관리자: 처리 안 한 것 먼저, 최신 순
create or replace function public.admin_feedback(p_status text default null, p_limit int default 100)
returns table (
  id bigint, created_at timestamptz, app text, kind text, category text, target text, context text,
  message text, ui text, status text, user_id uuid, display_name text
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
    select f.id, f.created_at, f.app, f.kind, f.category, f.target, f.context, f.message, f.ui, f.status, f.user_id, p.display_name
    from feedback f
    left join profiles p on p.id = f.user_id
    where p_status is null or f.status = p_status
    order by (f.status = 'new') desc, f.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;
revoke all on function public.admin_feedback(text, int) from public, anon;
grant execute on function public.admin_feedback(text, int) to authenticated;

create or replace function public.admin_feedback_set(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  if p_status = 'delete' then
    delete from feedback where id = p_id;
  else
    update feedback set status = p_status where id = p_id;
  end if;
end;
$$;
revoke all on function public.admin_feedback_set(bigint, text) from public, anon;
grant execute on function public.admin_feedback_set(bigint, text) to authenticated;

-- 내 정보 삭제: 내가 보낸 수정 요청도 지움 (나머지는 20261122070000_editions.sql 과 같음)
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
  delete from feedback where user_id = auth.uid();
  delete from profile_private where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
