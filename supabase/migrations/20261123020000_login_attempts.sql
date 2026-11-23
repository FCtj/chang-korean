-- 로그인 시도 기록 (관리자 화면 🔑) — 친구가 '가입했다'는데 계정이 없을 때 어디서 막혔는지 보려고
-- · 앱이 남김: 로그인 버튼(start) · 성공(success) · 오류로 돌아옴(error) · 중간에 그만둠(abandoned)
--   + 기기 번호(device_activity 와 같은 임의 번호) · 앱 · 로그인 방법 · 오류 문구 · 브라우저 종류(예: 'android · 카카오톡 앱 안')
-- · 누구나 log_login_attempt() 로만 씀 (기기마다 한 시간 30번까지), 표는 직접 읽기·쓰기 막음
-- · 관리자: admin_login_overview() — 앱·방법별 합계 + 서버의 가입 수 · 끝나지 않은 OAuth(auth.flow_state) + 최근 기록

create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device_id uuid,
  app text not null check (app in ('ko', 'ja', 'en', 'lo')),
  provider text not null check (provider in ('kakao', 'facebook', 'email', 'unknown')),
  stage text not null check (stage in ('start', 'success', 'error', 'abandoned')),
  error text check (char_length(error) <= 300),
  browser text check (char_length(browser) <= 40),
  user_id uuid references auth.users (id) on delete set null
);
create index if not exists login_attempts_time_idx on public.login_attempts (created_at desc);
create index if not exists login_attempts_device_idx on public.login_attempts (device_id, created_at desc);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.log_login_attempt(
  p_device uuid,
  p_app text,
  p_provider text,
  p_stage text,
  p_error text default null,
  p_browser text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_app is null or p_app not in ('ko', 'ja', 'en', 'lo')
     or p_stage is null or p_stage not in ('start', 'success', 'error', 'abandoned') then
    raise exception 'bad_value';
  end if;
  -- 너무 많이 보내면 조용히 무시 (기기마다 한 시간 30번 · 전체 1분 300번)
  if p_device is not null and (select count(*) from login_attempts where device_id = p_device and created_at > now() - interval '1 hour') >= 30 then
    return;
  end if;
  if (select count(*) from login_attempts where created_at > now() - interval '1 minute') >= 300 then
    return;
  end if;
  insert into login_attempts (device_id, app, provider, stage, error, browser, user_id)
  values (p_device, p_app, case when p_provider in ('kakao', 'facebook', 'email') then p_provider else 'unknown' end, p_stage,
          left(p_error, 300), left(p_browser, 40), auth.uid());
end;
$$;
revoke all on function public.log_login_attempt(uuid, text, text, text, text, text) from public;
grant execute on function public.log_login_attempt(uuid, text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_login_overview(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d int := least(greatest(coalesce(p_days, 7), 1), 90);
  since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90));
  v_by jsonb;
  v_recent jsonb;
  v_signups jsonb;
  v_pending jsonb := '[]'::jsonb;
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  select coalesce(jsonb_agg(x order by x.app, x.provider), '[]'::jsonb) into v_by from (
    select app, provider,
           count(*) filter (where stage = 'start')::int as start,
           count(*) filter (where stage = 'success')::int as success,
           count(*) filter (where stage = 'error')::int as error,
           count(*) filter (where stage = 'abandoned')::int as abandoned,
           count(distinct device_id)::int as devices
    from login_attempts where created_at >= since group by app, provider
  ) x;
  select coalesce(jsonb_agg(r order by r.at desc), '[]'::jsonb) into v_recent from (
    select created_at as at, app, provider, stage, error, browser, user_id is not null as linked, device_id
    from login_attempts where created_at >= since order by created_at desc limit 40
  ) r;
  -- 실제로 생긴 계정 (서버) — 로그인 방법별
  select coalesce(jsonb_agg(s), '[]'::jsonb) into v_signups from (
    select coalesce(u.raw_app_meta_data->>'provider', 'unknown') as provider, count(*)::int as n
    from auth.users u where u.created_at >= since group by 1 order by 2 desc
  ) s;
  -- Supabase 가 시작했지만 끝나지 않은 OAuth (성공하면 지워지므로 여기 남은 것은 대부분 중간에 막힌 것)
  if to_regclass('auth.flow_state') is not null then
    execute $q$
      select coalesce(jsonb_agg(f), '[]'::jsonb) from (
        select provider_type as provider, count(*)::int as n, max(created_at) as last_at
        from auth.flow_state where created_at >= $1 and user_id is null group by provider_type
      ) f
    $q$ into v_pending using since;
  end if;
  return jsonb_build_object('days', d, 'by', v_by, 'recent', v_recent, 'signups', v_signups, 'server_pending', v_pending);
end;
$$;
revoke all on function public.admin_login_overview(int) from public, anon;
grant execute on function public.admin_login_overview(int) to authenticated;
