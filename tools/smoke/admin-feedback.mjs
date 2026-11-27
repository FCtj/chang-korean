// 관리자 화면 📮 수정 요청 점검: 로그인·서버를 흉내 내고 새 요청 → 맡기기(지시) → 맡김 탭 → 복사 글 → 결과 붙여넣기
// 빌드 후 저장소 루트에서: node tools/smoke/admin-feedback.mjs  (스크린샷: tools/_work/shots/adm-fb-*.png)
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
const ROOT = process.cwd()
const OUT = `${process.env.CK_WORK || `${ROOT}/tools/_work`}/shots`
mkdirSync(OUT, { recursive: true })
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const REF = 'aoonpimjvqrdfbkeomya'
const UID = 'aaaaaaaa-1111-2222-3333-444444444444'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp, aud: 'authenticated' })}.sig`
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: { provider: 'kakao' }, user_metadata: { name: '관리자' } }
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user }
// 서버(가짜) 상태
const rows = [
  { id: 41, created_at: new Date(Date.now() - 3600e3).toISOString(), app: 'ja', kind: 'word', category: 'pron', target: 't-topik-1-d01-02 二', context: 'に · 이(2)', message: '치라고 읽어요', ui: 'ko', status: 'new', user_id: UID, display_name: '제킹', admin_note: null, resolved_note: null },
  { id: 42, created_at: new Date(Date.now() - 7200e3).toISOString(), app: 'ko', kind: 'word', category: 'meaning', target: 'b1-01-03 감사합니다', context: 'gamsahamnida · ຂອບໃຈ', message: 'ຄວາມໝາຍບໍ່ຖືກ', ui: 'lo', status: 'new', user_id: null, display_name: null, admin_note: null, resolved_note: null },
  { id: 43, created_at: new Date(Date.now() - 86400e3).toISOString(), app: 'en', kind: 'app', category: 'idea', target: null, context: null, message: '다크 모드에서 글씨가 조금 더 컸으면', ui: 'ko', status: 'new', user_id: null, display_name: null, admin_note: null, resolved_note: null },
]
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
await ctx.addInitScript(({ k, v, s }) => {
  try {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(k, v)
      localStorage.setItem('chang-korean:v2', JSON.stringify(s))
      sessionStorage.setItem('seeded', '1')
    }
  } catch {}
}, { k: `sb-${REF}-auth-token`, v: JSON.stringify(session), s: { v: 5, started: true, ui: 'ko', native: 'lo', country: 'LA', theme: 'candy', gender: 'f', course: 'topik', topikLevel: 1, newsSeen: '2026-11-22i', introDone: true, placementDone: true } })
await ctx.route('**/*.supabase.co/**', async (route) => {
  const url = route.request().url()
  const body = route.request().postDataJSON?.() ?? null
  const json = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) })
  if (url.includes('/auth/v1/user')) return json(user)
  if (url.includes('/auth/v1/settings')) return json({ external: { kakao: true, facebook: true } })
  const rpc = url.match(/\/rpc\/(\w+)/)?.[1]
  if (rpc === 'is_admin') return json(true)
  if (rpc === 'admin_feedback_counts') {
    const c = { new: 0, todo: 0, done: 0, skip: 0 }
    rows.forEach((r) => c[r.status]++)
    return json(c)
  }
  if (rpc === 'admin_feedback') {
    const st = body?.p_status
    return json(rows.filter((r) => !st || r.status === st || (st === 'closed' && (r.status === 'done' || r.status === 'skip'))))
  }
  if (rpc === 'admin_feedback_set') {
    const r = rows.find((x) => x.id === body.p_id)
    if (r) {
      r.status = body.p_status
      if (body.p_status === 'todo' && body.p_note) r.admin_note = body.p_note
      if (body.p_status === 'done' || body.p_status === 'skip') r.resolved_note = body.p_note ?? r.resolved_note
    }
    return json(null)
  }
  if (rpc === 'admin_access_places') return json({ countries: {}, cities: [] })
  if (rpc === 'admin_users' || rpc === 'admin_reports') return json([])
  if (rpc) return json(null)
  return json([])
})
const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push(e.message))
await p.goto(`file://${ROOT}/dist-web/index.html`)
await p.waitForTimeout(1500)
await p.locator('.tabbar button, .tabbar a').last().click()
await p.waitForTimeout(1200)
await p.getByText('관리자 · 사용 현황').first().click()
await p.waitForTimeout(1500)
await p.screenshot({ path: `${OUT}/adm-fb-1-new.png` })
// 첫 요청: 지시를 붙여 맡기기
await p.locator('button', { hasText: 'Claude 에게 맡기기' }).first().click()
await p.locator('.fb-note-edit textarea').fill('가타카나 ニ 로 읽게 해 줘')
await p.locator('.fb-note-edit').getByText('🤖 맡기기').click()
await p.waitForTimeout(600)
// 나머지는 한꺼번에
p.once('dialog', (d) => d.accept())
await p.locator('button', { hasText: '모두 맡기기' }).click().catch(() => {})
await p.waitForTimeout(900)
await p.locator('button', { hasText: 'Claude 에게 보낼 글 복사' }).click()
await p.waitForTimeout(500)
const brief = await p.locator('textarea.fb-brief').first().inputValue()
console.log('--- brief ---\n' + brief + '\n-------------')
await p.locator('#adm-feedback').screenshot({ path: `${OUT}/adm-fb-2-todo.png` })
await p.locator('#fb-paste').fill('CHANG-DONE\n#41 | done | 二 를 가타카나 ニ 로 읽게 바꿈\n#42 | done | ຂອບໃຈ 뜻 확인 후 고침\n#43 | skip | 다음 업데이트에서 글씨 크기 설정으로')
await p.locator('button', { hasText: '처리함으로 표시' }).click()
await p.waitForTimeout(900)
console.log('info:', await p.locator('.fb-info').textContent().catch(() => ''))
console.log('status:', rows.map((r) => `${r.id}:${r.status}`).join(' '))
await p.locator('#adm-feedback button', { hasText: '처리함' }).first().click().catch(() => {})
await p.waitForTimeout(800)
await p.locator('#adm-feedback').screenshot({ path: `${OUT}/adm-fb-3-closed.png` })
console.log('errors:', errors.length ? errors : 'none')
await b.close()
