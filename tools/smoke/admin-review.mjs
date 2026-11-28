// 관리자 화면 📚 단어 검토 점검: 로그인·서버를 흉내 내고 마사지 코스 → 괜찮음 · 제외 · 고칠 곳 → 다시 열면 제외 카드가 빠지는지
// 빌드 후 저장소 루트에서: node tools/smoke/admin-review.mjs  (스크린샷: tools/_work/shots/adm-rv-*.png)
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
const flags = { 't-massage-greet-01': { word_id: 't-massage-greet-01', status: 'ok', note: null, ko: '안녕하세요', updated_at: new Date().toISOString() } }
const feedback = []
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(({ k, v, s }) => {
  try {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(k, v)
      localStorage.setItem('chang-korean:v2', JSON.stringify(s))
      sessionStorage.setItem('seeded', '1')
    }
  } catch {}
}, { k: `sb-${REF}-auth-token`, v: JSON.stringify(session), s: { v: 5, started: true, ui: 'ko', native: 'lo', country: 'LA', theme: 'candy', gender: 'f', course: 'job', jobTrack: 'massage', newsSeen: '2026-11-28m', introDone: true, placementDone: true } })
await ctx.route('**/*.supabase.co/**', async (route) => {
  const url = route.request().url()
  const body = route.request().postDataJSON?.() ?? null
  const json = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) })
  if (url.includes('/auth/v1/user')) return json(user)
  if (url.includes('/auth/v1/settings')) return json({ external: { kakao: true, facebook: true } })
  const rpc = url.match(/\/rpc\/(\w+)/)?.[1]
  if (rpc === 'is_admin') return json(true)
  if (rpc === 'excluded_words') return json(Object.values(flags).filter((f) => f.status === 'excluded').map((f) => f.word_id))
  if (rpc === 'admin_content_flags') return json(Object.values(flags).filter((f) => !body?.p_prefix || f.word_id.startsWith(`t-${body.p_prefix}-`)))
  if (rpc === 'admin_content_flag_set') {
    if (body.p_status === 'clear') delete flags[body.p_word_id]
    else flags[body.p_word_id] = { word_id: body.p_word_id, status: body.p_status, note: body.p_note, ko: body.p_ko, updated_at: new Date().toISOString() }
    if (body.p_status === 'fix') feedback.push(body)
    return json(null)
  }
  if (rpc === 'admin_feedback_counts') return json({ new: 0, todo: feedback.length, done: 0, skip: 0 })
  if (rpc === 'admin_access_places') return json({ countries: {}, cities: [] })
  if (rpc === 'admin_users' || rpc === 'admin_reports' || rpc === 'admin_feedback') return json([])
  if (rpc) return json(null)
  return json([])
})
const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push(e.message))
await p.goto(`file://${ROOT}/dist-web/index.html`)
await p.waitForTimeout(1500)
// 처음: 마사지 1단원 카드 수
await p.locator('.unit-card').first().click()
await p.waitForTimeout(800)
const before = await p.locator('.round-hero, body').first().innerText()
await p.goBack?.().catch(() => {})
await p.goto(`file://${ROOT}/dist-web/index.html#admin`)
await p.waitForTimeout(2000)
await p.locator('#adm-review').scrollIntoViewIfNeeded()
await p.waitForTimeout(400)
await p.locator('#adm-review').screenshot({ path: `${OUT}/adm-rv-1.png` })
// 2번째 카드 제외, 3번째 고칠 곳
const rows = p.locator('#adm-review .rv-row')
await rows.nth(1).locator('button', { hasText: '제외' }).click()
await p.waitForTimeout(400)
await rows.nth(2).locator('button', { hasText: '✏️' }).click()
await rows.nth(2).locator('textarea').fill('라오스에서는 이렇게 안 써요 — 더 쉬운 말로')
await rows.nth(2).locator('button', { hasText: 'Claude 에게 맡기기' }).click()
await p.waitForTimeout(600)
await p.locator('#adm-review').screenshot({ path: `${OUT}/adm-rv-2.png` })
console.log('flags', JSON.stringify(Object.values(flags).map((f) => [f.word_id, f.status])))
console.log('fix → feedback', feedback.length, feedback[0]?.p_note)
const saved = await p.evaluate(() => localStorage.getItem('chang-korean:excluded'))
console.log('saved excluded', saved)
// 다시 열기: 1단원에서 제외한 카드(감사합니다)가 빠졌는지
await p.goto(`file://${ROOT}/dist-web/index.html`)
await p.waitForTimeout(1500)
await p.locator('.unit-card').first().click()
await p.waitForTimeout(900)
const txt = await p.locator('body').innerText()
console.log('unit page has 감사합니다:', txt.includes('감사합니다'), '| 안녕하세요:', txt.includes('안녕하세요'))
await p.screenshot({ path: `${OUT}/adm-rv-3-unit.png`, fullPage: false })
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no page errors')
await b.close()
