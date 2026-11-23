// 라오스어판: 회원가입(밝게·어둡게) · 홈 · 카드 앞/뒤 · 음성 없음 안내 · 상황별 코스
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const OUT = `${WORK}/lao/shots`
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const errors = []
async function open(seed, voices = [{ lang: 'ko-KR', name: 'Yuna', localService: true }]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await ctx.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { kakao: true, facebook: true } }) }))
  await ctx.route('**/rest/v1/rpc/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await ctx.addInitScript(
    ({ s, voices }) => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('chang-lo:v1', JSON.stringify(s))
          sessionStorage.setItem('seeded', '1')
        }
      } catch {}
      window.__spoken = []
      const fake = { speaking: false, pending: false, speak(u) { window.__spoken.push([u.text, u.lang]); setTimeout(() => u.onend && u.onend(), 50) }, cancel() {}, resume() {}, getVoices: () => voices, addEventListener() {} }
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
    },
    { s: seed, voices },
  )
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(`file://${ROOT}/dist-web/lo/index.html`)
  await p.waitForTimeout(1200)
  return { ctx, p }
}
const base = { v: 5, started: true, ui: 'ko', native: 'lo', country: 'ZZ', course: 'topik', topikLevel: 1, newsSeen: '2026-11-22i' }
for (const theme of ['candy', 'carbon']) {
  const { ctx, p } = await open({ ...base, theme, introDone: false, placementDone: false })
  console.log(theme, 'signup brand:', (await p.textContent('.ed-brand').catch(() => '')).replace(/\s+/g, ' ').trim(), '| kakao:', await p.locator('.kakao-btn').count())
  await p.screenshot({ path: `${OUT}/signup-${theme}.png` })
  await ctx.close()
}
{
  const { ctx, p } = await open({ ...base, theme: 'candy', introDone: true, placementDone: true })
  console.log('home course:', (await p.textContent('.continue').catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 80))
  console.log('voice hint:', await p.locator('.voice-hint').count(), (await p.textContent('.voice-hint').catch(() => '')).replace(/\s+/g, ' ').slice(0, 50))
  console.log('level buttons:', (await p.$$eval('.topik-lv, .lv-btn, .level-btn', (els) => els.map((e) => e.textContent.trim()))).join(' | '))
  await p.screenshot({ path: `${OUT}/home.png` })
  await p.click('.continue')
  await p.waitForTimeout(900)
  const word = (await p.textContent('.card-word').catch(() => '')).trim()
  const pron = (await p.textContent('.fcard-face.front .ed-pron, .fcard-face.front .pron').catch(() => '')).trim()
  console.log('card front:', word, '|', pron, '| front pic:', await p.locator('.fcard-face.front .front-pic').count())
  await p.screenshot({ path: `${OUT}/card-front.png` })
  await p.click('.fcard')
  await p.waitForTimeout(800)
  console.log('card back:', (await p.textContent('.fcard-face.back').catch(() => '')).replace(/\s+/g, ' ').trim())
  await p.screenshot({ path: `${OUT}/card-back.png` })
  await p.click('.fcard-help')
  await p.waitForTimeout(500)
  console.log('help:', (await p.textContent('.word-help').catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 160))
  await p.screenshot({ path: `${OUT}/help.png` })
  await ctx.close()
}
{
  // 라오어 음성이 있는 기기
  const { ctx, p } = await open({ ...base, theme: 'candy', introDone: true, placementDone: true }, [{ lang: 'lo-LA', name: 'Lao', localService: true }])
  await p.click('.continue')
  await p.waitForTimeout(900)
  await p.click('.fcard-speak')
  await p.waitForTimeout(300)
  console.log('spoken with lao voice:', JSON.stringify(await p.evaluate(() => window.__spoken)))
  await ctx.close()
}
{
  const { ctx, p } = await open({ ...base, theme: 'candy', introDone: true, placementDone: true, course: 'job' })
  console.log('daily tabs:', (await p.$$eval('.job-tr-name', (els) => els.map((e) => e.textContent.trim()))).join(' | '))
  await p.screenshot({ path: `${OUT}/daily.png` })
  await ctx.close()
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
