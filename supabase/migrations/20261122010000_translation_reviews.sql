
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
