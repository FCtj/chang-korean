// 일본어·영어판 발음 소리: 무엇을 읽는지(가나 읽기) · 빠르게 넘겨도 마지막 말이 나오는지 · 음성 없는 기기 안내
import { createRequire } from 'module'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const log = (...a) => console.log('•', ...a)
const b = await chromium.launch()
const errors = []
const seed = { v: 5, started: true, introDone: true, placementDone: true, ui: 'ko', native: 'lo', country: 'ZZ', theme: 'candy', course: 'topik', topikLevel: 1, newsSeen: 'x' }
async function open(ed, voices) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 900 } })
  await ctx.addInitScript(
    ({ s, ed, voices }) => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(`chang-${ed}:v1`, JSON.stringify(s))
          sessionStorage.setItem('seeded', '1')
        }
      } catch {}
      // 음성 엔진 흉내: 말한 글자·언어를 기록, 말하는 중 상태도 흉내
      window.__spoken = []
      let speaking = false
      const fake = {
        get speaking() {
          return speaking
        },
        get pending() {
          return false
        },
        speak(u) {
          speaking = true
          window.__spoken.push([u.text, u.lang, u.voice ? u.voice.name : ''])
          setTimeout(() => {
            speaking = false
            u.onend && u.onend()
          }, 300)
        },
        cancel() {
          speaking = false
        },
        resume() {},
        getVoices: () => voices,
        addEventListener() {},
      }
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
    },
    { s: seed, ed, voices },
  )
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${ed}: ${e.message}`))
  await p.goto(`file://${ROOT}/dist-web/${ed}/index.html`)
  await p.waitForTimeout(2200)
  return { ctx, p }
}
for (const ed of ['ja', 'en']) {
  const lang = ed === 'ja' ? 'ja-JP' : 'en-US'
  const { ctx, p } = await open(ed, [
    { lang, name: ed === 'ja' ? 'Google 日本語' : 'Google US English', localService: false },
    { lang, name: ed === 'ja' ? 'Kyoko' : 'Samantha', localService: true },
  ])
  log(ed, 'voice hint shown (should be 0):', await p.locator('.voice-hint').count())
  await p.click('.continue')
  await p.waitForTimeout(900)
  const card = (await p.textContent('.card-word').catch(() => '')).trim()
  await p.evaluate(() => (window.__spoken = []))
  log(ed, 'speak btn:', await p.locator('.fcard-speak').count(), await p.evaluate(() => typeof window.speechSynthesis.speak + ' ' + typeof window.SpeechSynthesisUtterance + ' ' + ('speechSynthesis' in window)))
  await p.click('.fcard-speak')
  await p.waitForTimeout(500)
  log(ed, 'after one tap:', JSON.stringify(await p.evaluate(() => window.__spoken)))
  // 빠르게: 다음 카드 + 발음 버튼 3번 → 마지막 카드의 말이 나와야 함 (앞 말이 끝나기 전에 눌러도)
  for (let i = 0; i < 3; i++) {
    await p.click('.act-row .btn-mint').catch(() => {})
    await p.waitForTimeout(60)
    await p.click('.fcard-speak').catch(() => {})
    await p.waitForTimeout(60)
  }
  await p.waitForTimeout(800)
  const last = (await p.textContent('.card-word').catch(() => '')).trim()
  const spoken = await p.evaluate(() => window.__spoken)
  log(ed, 'first card:', card, '| after fast taps:', last, '| spoken:', JSON.stringify(spoken.slice(-3)))
  await ctx.close()
}
// 음성이 없는 기기
{
  const { ctx, p } = await open('ja', [{ lang: 'ko-KR', name: 'Yuna', localService: true }])
  log('ja no voice → hint:', await p.locator('.voice-hint').count(), (await p.textContent('.voice-hint').catch(() => '')).slice(0, 60))
  await ctx.close()
}
log('errors:', errors.length ? errors : 'none')
await b.close()
