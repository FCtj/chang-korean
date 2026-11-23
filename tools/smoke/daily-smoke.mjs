// 일본어·영어판 생활/학교 코스: 홈에 보이는지 · 레벨 탭 · 공부 화면 카드 · 발음 표시
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const OUT = `${WORK}/daily`
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const errors = []
for (const ed of ['ja', 'en']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const s = { v: 5, started: true, ui: 'ko', native: 'lo', country: 'ZZ', theme: 'candy', course: 'job', topikLevel: 1, newsSeen: '2026-11-22i', introDone: true, placementDone: true }
  await ctx.addInitScript(
    ({ s, ed }) => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(`chang-${ed}:v1`, JSON.stringify(s))
          sessionStorage.setItem('seeded', '1')
        }
      } catch {}
    },
    { s, ed },
  )
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${ed}: ${e.message}`))
  await p.goto(`file://${ROOT}/dist-web/${ed}/index.html`)
  await p.waitForTimeout(1200)
  const tabs = await p.$$eval('.job-tr-name', (els) => els.map((e) => e.textContent.trim()))
  const head = (await p.textContent('.course-card, .my-course, .home-course').catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 80)
  console.log(ed, 'tabs:', tabs.join(' | '), '| head:', head, '| change course btn:', await p.locator('text=코스 바꾸기').count())
  await p.screenshot({ path: `${OUT}/${ed}-home.png` })
  // 마지막 레벨 탭 눌러 보기
  if (tabs.length) {
    await p.click('.job-tr >> nth=-1')
    await p.waitForTimeout(400)
  }
  await p.click('.continue').catch((e) => errors.push(`${ed}: continue ${e.message.slice(0, 50)}`))
  await p.waitForTimeout(900)
  const word = (await p.textContent('.card-word').catch(() => '')).trim()
  const pron = (await p.textContent('.ed-pron, .pron').catch(() => '')).trim()
  console.log(ed, 'player card:', word, '| pron:', pron, '| title:', (await p.textContent('.topbar h1, .topbar-title').catch(() => '')).trim())
  await p.screenshot({ path: `${OUT}/${ed}-player.png` })
  await ctx.close()
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
