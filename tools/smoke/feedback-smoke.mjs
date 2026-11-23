// 수정 요청: 카드 ? → 틀린 곳 알리기 → 보내기 (서버 흉내) · 실패 시 메일 링크 · 설정에서 앱 의견 · 일본어 한 글자 단어 읽기
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const OUT = `${WORK}/feedback`
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const errors = []
for (const [ed, theme, fail] of [['ja', 'candy', false], ['ko', 'carbon', true]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const sent = []
  await ctx.route('**/rest/v1/rpc/submit_feedback', async (r) => {
    sent.push(JSON.parse(r.request().postData() || '{}'))
    await r.fulfill(fail ? { status: 500, contentType: 'application/json', body: '{"message":"boom"}' } : { status: 200, contentType: 'application/json', body: '7' })
  })
  await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const key = ed === 'ko' ? 'chang-korean:v2' : `chang-${ed}:v1`
  const s = { v: 5, started: true, ui: 'ko', native: ed === 'ko' ? 'vi' : 'lo', country: ed === 'ko' ? 'VN' : 'ZZ', theme, course: 'topik', topikLevel: 1, newsSeen: '2026-11-22i', introDone: true, placementDone: true }
  await ctx.addInitScript(
    ({ s, key }) => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(key, JSON.stringify(s))
          sessionStorage.setItem('seeded', '1')
        }
      } catch {}
      window.__spoken = []
      const fake = { speaking: false, pending: false, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 50) }, cancel() {}, resume() {}, getVoices: () => [{ lang: 'ja-JP', name: 'Kyoko', localService: true }, { lang: 'ko-KR', name: 'Yuna', localService: true }], addEventListener() {} }
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
    },
    { s, key },
  )
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${ed}: ${e.message}`))
  await p.goto(`file://${ROOT}/dist-web/${ed === 'ko' ? '' : ed + '/'}index.html`)
  await p.waitForTimeout(1200)
  await p.click('.continue')
  await p.waitForTimeout(800)
  if (ed === 'ja') {
    await p.click('.fcard-speak')
    await p.waitForTimeout(300)
    console.log('ja first card', (await p.textContent('.card-word')).trim(), 'spoken:', JSON.stringify(await p.evaluate(() => window.__spoken)))
  }
  await p.click('.fcard-help')
  await p.waitForTimeout(400)
  await p.click('.fb-link')
  await p.waitForTimeout(300)
  await p.click('.fb-cat >> nth=0')
  await p.fill('.fb-text', '치라고 읽혀요. は 로 읽어야 해요')
  await p.screenshot({ path: `${OUT}/${ed}-${theme}-form.png` })
  await p.click('.fb-actions .btn-pink')
  await p.waitForTimeout(600)
  console.log(ed, 'sent:', JSON.stringify(sent[0]), '| done:', await p.locator('.fb-done').count(), '| mail link:', await p.locator('.fb-err a[href^="mailto:"]').count())
  await p.screenshot({ path: `${OUT}/${ed}-${theme}-after.png` })
  await ctx.close()
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
