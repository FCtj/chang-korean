-- 수정 요청 처리 흐름: 새 요청(new) → 관리자가 지시를 붙여 'Claude 에게 맡김'(todo) → 고침(done) / 넘김(skip)
-- - admin_note: 관리자가 Claude 에게 남기는 지시 (예: "뜻을 '치아'로")
-- - resolved_note: 처리 결과 (Claude 가 무엇을 고쳤는지 / 왜 넘겼는지)
-- 처리 방법은 저장소 docs/FEEDBACK.md
alter table public.feedback add column if not exists admin_note text check (char_length(admin_note) <= 1000);
alter table public.feedback add column if not exists resolved_note text check (char_length(resolved_note) <= 1000);
alter table public.feedback add column if not exists updated_at timestamptz;
alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check check (status in ('new', 'todo', 'done', 'skip'));

-- 목록: p_status = 'new' | 'todo' | 'closed'(done+skip) | 'done' | 'skip' | null(전체). 새 요청 → 맡김 → 나머지, 최신 순
drop function if exists public.admin_feedback(text, int);
create or replace function public.admin_feedback(p_status text default null, p_limit int default 200)
returns table (
  id bigint, created_at timestamptz, app text, kind text, category text, target text, context text,
  message text, ui text, status text, user_id uuid, display_name text,
  admin_note text, resolved_note text, updated_at timestamptz
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
    select f.id, f.created_at, f.app, f.kind, f.category, f.target, f.context, f.message, f.ui, f.status, f.user_id, p.display_name,
           f.admin_note, f.resolved_note, f.updated_at
    from feedback f
    left join profiles p on p.id = f.user_id
    where p_status is null or f.status = p_status or (p_status = 'closed' and f.status in ('done', 'skip'))
    order by case f.status when 'new' then 0 when 'todo' then 1 else 2 end, coalesce(f.updated_at, f.created_at) desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;
revoke all on function public.admin_feedback(text, int) from public, anon;
grant execute on function public.admin_feedback(text, int) to authenticated;

-- 상태별 개수 (관리자 화면 맨 위 📮 요약)
create or replace function public.admin_feedback_counts()
returns jsonb
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
    select jsonb_build_object(
      'new', count(*) filter (where status = 'new'),
      'todo', count(*) filter (where status = 'todo'),
      'done', count(*) filter (where status = 'done'),
      'skip', count(*) filter (where status = 'skip')
    ) from feedback
  );
end;
$$;
revoke all on function public.admin_feedback_counts() from public, anon;
grant execute on function public.admin_feedback_counts() to authenticated;

-- 상태 바꾸기 + 메모: todo 면 지시(admin_note), done/skip 이면 처리 결과(resolved_note)
drop function if exists public.admin_feedback_set(bigint, text);
create or replace function public.admin_feedback_set(p_id bigint, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  if p_status = 'delete' then
    delete from feedback where id = p_id;
    return;
  end if;
  if p_status not in ('new', 'todo', 'done', 'skip') then
    raise exception 'bad_status';
  end if;
  update feedback set
    status = p_status,
    admin_note = case when p_status = 'todo' and v_note is not null then v_note else admin_note end,
    resolved_note = case when p_status in ('done', 'skip') then coalesce(v_note, resolved_note) else null end,
    updated_at = now()
  where id = p_id;
end;
$$;
revoke all on function public.admin_feedback_set(bigint, text, text) from public, anon;
grant execute on function public.admin_feedback_set(bigint, text, text) to authenticated;
