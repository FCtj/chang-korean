// 일본어·영어판 블랙(남자) 테마: 회원가입 로고 · 홈 마스코트 · 테스트 표지
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const OUT = `${WORK}/carbon`
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const errors = []
for (const ed of ['ja', 'en']) {
  for (const stage of ['signup', 'home']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
    await ctx.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { kakao: true, facebook: true } }) }))
    const s = { v: 5, started: true, ui: 'ko', native: 'lo', country: 'ZZ', theme: 'carbon', gender: 'm', course: 'topik', topikLevel: 1, newsSeen: 'x', introDone: stage === 'home', placementDone: true }
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
    await p.waitForTimeout(900)
    await p.screenshot({ path: `${OUT}/${ed}-${stage}.png` })
    await ctx.close()
  }
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
