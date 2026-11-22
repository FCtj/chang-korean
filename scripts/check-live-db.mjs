// 실제 Supabase 에 마이그레이션이 다 들어갔는지 확인 (공개 키만 사용 · 로그인 없이)
// 로그인이 필요한 함수는 '권한 없음(42501/401)' 이 나오면 = 함수가 있다는 뜻, 'PGRST202' 면 = 없음(SQL 안 들어감)
// 결과에는 함수 이름과 개수만 찍음 (빌드 로그는 공개라 개인정보·글 내용은 찍지 않음)
// 사용: node scripts/check-live-db.mjs   (GitHub Actions 'DB check' 에서 수동 실행)
import { readFileSync } from 'node:fs'

const cfg = readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8')
const URL_ = cfg.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1]
const KEY = cfg.match(/(sb_publishable_[A-Za-z0-9_]+)/)?.[1]
if (!URL_ || !KEY) {
  console.error('config 에서 주소·공개 키를 못 찾음')
  process.exit(1)
}
const ZERO = '00000000-0000-0000-0000-000000000000'
async function call(fn, args = {}) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
  let body = null
  try {
    body = await r.json()
  } catch {
    /* 빈 응답 */
  }
  return { status: r.status, body }
}
let missing = 0
const row = (ok, name, note) => console.log(`${ok ? '✓' : '✗'} ${name}${note ? ' — ' + note : ''}`)

// 1) 로그인 없이 되는 것: 공개 게시판
{
  const r = await call('public_feed', { p_category: null, p_country: null, p_before: null, p_limit: 5 })
  const ok = r.status === 200 && Array.isArray(r.body)
  if (!ok) missing++
  row(ok, 'public_feed (로그인 없이 공개 글 읽기)', ok ? `글 ${r.body.length}개 받음` : `${r.status} ${r.body?.code ?? ''} ${r.body?.message ?? ''}`)
}
{
  const r = await call('post_thread', { p_post: ZERO })
  const ok = r.body?.message?.includes('not_found')
  if (!ok) missing++
  row(ok, 'post_thread (없는 글 → not_found)', ok ? '' : `${r.status} ${r.body?.code ?? ''} ${r.body?.message ?? ''}`)
}

// 2) 로그인해야 하는 함수: 있는지만 (권한 없음 = 있음)
const AUTH_ONLY = [
  ['is_admin', {}, '관리자'],
  ['admin_overview', { p_days: 30 }, '관리자'],
  ['admin_users', { p_search: null, p_order: 'recent', p_limit: 1, p_offset: 0 }, '관리자'],
  ['admin_user_detail', { p_user: ZERO }, '관리자'],
  ['admin_access_places', { p_days: 30 }, '접속 위치'],
  ['log_geo', { p_country: null, p_city: null }, '접속 위치'],
  ['create_post', { p_visibility: 'public', p_group: null, p_category: 'free', p_body: 'x' }, '커뮤니티'],
  ['add_comment', { p_post: ZERO, p_body: 'x' }, '커뮤니티'],
  ['delete_comment', { p_comment: ZERO }, '커뮤니티'],
  ['report_content', { p_post: ZERO, p_comment: null, p_reason: 'spam' }, '커뮤니티'],
  ['block_user', { p_user: ZERO, p_block: true }, '커뮤니티'],
  ['my_blocks', {}, '커뮤니티'],
  ['my_activity', {}, '커뮤니티'],
  ['admin_reports', {}, '커뮤니티 관리'],
  ['admin_moderate', { p_post: ZERO, p_comment: null, p_action: 'hide' }, '커뮤니티 관리'],
  ['log_activity', { p_day: '2026-01-01', p_seconds: 0, p_words: 0, p_questions: 0, p_sessions: 0 }, '기존'],
  ['delete_my_data', {}, '기존'],
]
for (const [fn, args, group] of AUTH_ONLY) {
  const r = await call(fn, args)
  const code = r.body?.code ?? ''
  const msg = String(r.body?.message ?? '')
  const notFound = code === 'PGRST202' || /Could not find the function/i.test(msg)
  const denied = r.status === 401 || r.status === 403 || code === '42501' || /permission denied|not_logged_in|not signed in/i.test(msg)
  const ok = !notFound && denied
  if (!ok) missing++
  row(ok, `${fn} [${group}]`, ok ? '있음 (로그인 필요 → 막힘)' : notFound ? '없음 — 이 SQL 이 안 들어감' : `확인 필요: ${r.status} ${code} ${msg.slice(0, 80)}`)
}

console.log(missing ? `\n${missing}개 확인 필요` : '\n✓ 마이그레이션 전부 들어감 (아랍어 · 관리자 · 접속 위치 · 커뮤니티 v2)')
process.exit(missing ? 1 : 0)
