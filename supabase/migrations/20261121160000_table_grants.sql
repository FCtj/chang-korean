
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
