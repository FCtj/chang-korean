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
