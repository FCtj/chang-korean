// 공부 화면 토스트("못 외운 단어만 한 번 더!")가 검은/분홍 테마에서 잘 보이고, 아래 버튼을 막지 않는지
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const OUT = `${WORK}/toast`
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const errors = []
const runs = [
  ['ja', 'carbon', 'chang-ja:v1', 'ja/index.html'],
  ['en', 'candy', 'chang-en:v1', 'en/index.html'],
  ['ko', 'carbon', 'chang-korean:v2', 'index.html'],
]
for (const [ed, theme, key, file] of runs) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const s = { v: 5, started: true, ui: 'ko', native: ed === 'ko' ? 'vi' : 'lo', country: ed === 'ko' ? 'VN' : 'ZZ', theme, gender: theme === 'carbon' ? 'm' : 'f', course: 'topik', topikLevel: 1, newsSeen: '2026-11-22i', introDone: true, placementDone: true }
  await ctx.addInitScript(
    ({ s, key }) => {
      try {
        if (!sessionStorage.getItem('seeded')) {
          const prev = JSON.parse(localStorage.getItem(key) || 'null')
          localStorage.setItem(key, JSON.stringify(prev ? { ...prev, ...s } : s))
          sessionStorage.setItem('seeded', '1')
        }
      } catch {}
    },
    { s, key },
  )
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${ed}: ${e.message}`))
  await p.goto(`file://${ROOT}/dist-web/${file}`)
  await p.waitForTimeout(1200)
  await p.click('.continue').catch((e) => errors.push(`${ed}: no .continue ${e.message.slice(0, 60)}`))
  await p.waitForTimeout(900)
  // 다시 볼래요를 묶음 끝까지 → 토스트
  let shown = false
  for (let i = 0; i < 12 && !shown; i++) {
    await p.click('.act-row.with-play .btn-soft', { timeout: 2000 }).catch(() => {})
    await p.waitForTimeout(120)
    shown = (await p.locator('.toast').count()) > 0
  }
  console.log(ed, theme, 'toast shown:', shown, shown ? (await p.textContent('.toast')).trim() : '')
  if (shown) {
    await p.screenshot({ path: `${OUT}/${ed}-${theme}.png` })
    const info = await p.evaluate(() => {
      const t = document.querySelector('.toast')
      const cs = getComputedStyle(t)
      const btns = [...document.querySelectorAll('.act-row.with-play .btn')]
      const r = t.getBoundingClientRect()
      const hits = btns.map((bt) => {
        const br = bt.getBoundingClientRect()
        const el = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2)
        return { overlap: !(r.bottom < br.top || r.top > br.bottom), hitIsButton: bt.contains(el) }
      })
      return { bg: cs.backgroundColor, fg: cs.color, pe: cs.pointerEvents, top: Math.round(r.top), bottom: Math.round(r.bottom), hits }
    })
    console.log('  ', JSON.stringify(info))
  }
  await ctx.close()
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
