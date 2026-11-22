
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
