-- 📚 단어 검토 (관리자 화면): 코스의 단어·문장 카드마다 검토 상태를 남김
-- status: 'ok'       검토함 (괜찮음)
--         'excluded' 제외 — 앱이 이 카드를 빼고 보여 줌 (다음에 앱을 열 때부터)
--         'fix'      고칠 곳 — 메모와 함께 📮 수정 요청에 'Claude 에게 맡김'(todo)으로 들어감
-- word_id = 앱의 단어 id (예: t-massage-greet-01). 데이터 파일을 고칠 때 id 가 그대로면 상태도 그대로 이어짐
create table if not exists public.content_flags (
  word_id text primary key check (char_length(word_id) between 1 and 80),
  status text not null check (status in ('ok', 'excluded', 'fix')),
  note text check (char_length(note) <= 500),
  ko text check (char_length(ko) <= 200),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.content_flags enable row level security;
revoke all on public.content_flags from anon, authenticated;

-- 누구나(로그인 없이도): 제외된 카드 id 목록 — 앱이 시작할 때 받아서 그 카드를 뺌
create or replace function public.excluded_words()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(word_id order by word_id), '{}'::text[]) from content_flags where status = 'excluded';
$$;
revoke all on function public.excluded_words() from public;
grant execute on function public.excluded_words() to anon, authenticated;

-- 관리자: 검토 상태 목록 (p_prefix = 'massage' 처럼 코스 id → t-massage-… 만)
create or replace function public.admin_content_flags(p_prefix text default null)
returns table (word_id text, status text, note text, ko text, updated_at timestamptz)
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
    select c.word_id, c.status, c.note, c.ko, c.updated_at
    from content_flags c
    where p_prefix is null or c.word_id like 't-' || p_prefix || '-%'
    order by c.word_id;
end;
$$;
revoke all on function public.admin_content_flags(text) from public, anon;
grant execute on function public.admin_content_flags(text) to authenticated;

-- 관리자: 상태 바꾸기. p_status = 'ok' | 'excluded' | 'fix' | 'clear'(검토 안 함으로 되돌림)
-- 'fix' 면 수정 요청(feedback)에 todo 로 한 줄 넣음 — 관리자 메모가 Claude 에게 주는 지시가 됨
create or replace function public.admin_content_flag_set(
  p_word_id text,
  p_status text,
  p_note text default null,
  p_ko text default null,
  p_context text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_ko text := nullif(left(btrim(coalesce(p_ko, '')), 200), '');
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  if p_word_id is null or char_length(p_word_id) not between 1 and 80 then
    raise exception 'bad_word_id';
  end if;
  if p_status = 'clear' then
    delete from content_flags where word_id = p_word_id;
    return;
  end if;
  if p_status not in ('ok', 'excluded', 'fix') then
    raise exception 'bad_status';
  end if;
  if p_status = 'fix' and v_note is null then
    raise exception 'note_required';
  end if;
  insert into content_flags (word_id, status, note, ko, updated_by, updated_at)
  values (p_word_id, p_status, v_note, v_ko, auth.uid(), now())
  on conflict (word_id) do update
    set status = excluded.status, note = excluded.note, ko = coalesce(excluded.ko, content_flags.ko),
        updated_by = excluded.updated_by, updated_at = now();
  if p_status = 'fix' then
    insert into feedback (user_id, app, kind, category, target, context, message, ui, status, admin_note, updated_at)
    values (auth.uid(), 'ko', 'word', 'other', left(p_word_id || coalesce(' ' || v_ko, ''), 200),
            nullif(left(btrim(coalesce(p_context, '')), 300), ''),
            '[관리자 단어 검토] ' || v_note, 'ko', 'todo', v_note, now());
  end if;
end;
$$;
revoke all on function public.admin_content_flag_set(text, text, text, text, text) from public, anon;
grant execute on function public.admin_content_flag_set(text, text, text, text, text) to authenticated;
