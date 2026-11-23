// 랭킹: 이름 일부 가림 + 사진 모자이크 · 밝게/어둡게 · 설정 테마
import { createRequire } from 'module'
import { readFileSync } from 'fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const DIR = `${WORK}`
const faces = JSON.parse(readFileSync(`${DIR}/faces.json`, 'utf8'))
const b = await chromium.launch()
const errors = []
for (const [ed, theme] of [['ja', 'carbon'], ['en', 'candy'], ['ko', 'carbon']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await ctx.route('**/rest/v1/rpc/**', (r) => {
    const name = r.request().url().split('/rpc/')[1]
    const rows = [
      { rank: 1, user_id: 'u1', display_name: '김하나', avatar_url: faces[0], points: 820, country: 'VN' },
      { rank: 2, user_id: 'u2', display_name: 'Minji Park', avatar_url: faces[1], points: 640, country: 'VN' },
      { rank: 3, user_id: 'u3', display_name: 'Jason', avatar_url: faces[2], points: 410, country: 'VN' },
      { rank: 4, user_id: 'u4', display_name: '이수아', avatar_url: null, points: 120, country: 'VN' },
    ]
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(name.includes('leaderboard') ? rows : []) })
  })
  await ctx.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { kakao: true, facebook: true } }) }))
  const key = ed === 'ko' ? 'chang-korean:v2' : `chang-${ed}:v1`
  const s = { v: 5, started: true, ui: 'ko', native: ed === 'ko' ? 'vi' : 'lo', country: ed === 'ko' ? 'VN' : 'ZZ', theme, course: 'topik', topikLevel: 1, newsSeen: '2026-11-22i', introDone: true, placementDone: true }
  await ctx.addInitScript(({ s, key }) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); for (const p of ['today','month']) for (const sc of ['country','all']) localStorage.setItem(`ck-cer:${new Date().toISOString().slice(0,10)}:${p}:${sc}`, '1') } } catch {} }, { s, key })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${ed}: ${e.message}`))
  await p.goto(`file://${ROOT}/dist-web/${ed === 'ko' ? '' : ed + '/'}index.html`)
  await p.waitForTimeout(900)
  await p.click('.tabbar .tab >> nth=1')
  await p.waitForTimeout(1500)
  if (await p.locator('.cer-backdrop').count()) { await p.mouse.click(5, 5); await p.waitForTimeout(300) }
  const names = await p.$$eval('.pod-name, .board-name-text', (els) => els.map((e) => e.textContent.trim()))
  console.log(ed, theme, 'names:', names.join(' | '), '| mosaic canvases:', await p.locator('canvas.avatar.mosaic').count(), '| plain imgs:', await p.locator('img.avatar').count())
  await p.screenshot({ path: `${DIR}/feedback/rank2-${ed}.png` })
  // 설정 테마
  await p.click('.tabbar .tab >> nth=2')
  await p.waitForTimeout(500)
  const seg = await p.$$eval('.seg-btn', (els) => els.map((e) => e.textContent.trim()).filter((x) => /밝게|어둡게|기기/.test(x)))
  console.log('  theme options:', seg.join(' | '))
  await ctx.close()
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
