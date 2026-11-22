
-- ═════════ 몽골어 학습자 (v0.20) ═════════
-- 학습자 언어(native)·번역 검수 언어(lang)에 'mn' 추가. 두 번 실행해도 안전
alter table public.profile_private drop constraint if exists profile_private_native_check;
alter table public.profile_private add constraint profile_private_native_check check (native in ('lo', 'th', 'vi', 'mn'));
alter table public.translation_reviews drop constraint if exists translation_reviews_lang_check;
alter table public.translation_reviews add constraint translation_reviews_lang_check check (lang in ('lo', 'th', 'vi', 'mn'));
