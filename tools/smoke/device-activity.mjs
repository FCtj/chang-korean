// 로그인하지 않은 사람의 기기 기록: 앱을 열고 떠날 때 log_device_activity 가 기기 번호와 함께 가는지 (판마다)
import { createRequire } from 'module'
const ROOT = process.cwd() // 저장소 루트에서 실행
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const b = await chromium.launch()
const errors = []
for (const [ed, key] of [['ko', 'chang-korean:v2'], ['lo', 'chang-lo:v1'], ['en', 'chang-en:v1']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const sent = []
  await ctx.route('**/rest/v1/rpc/**', async (r) => {
    const name = r.request().url().split('/rpc/')[1]
    sent.push([name, JSON.parse(r.request().postData() || '{}')])
    await r.fulfill({ status: 200, contentType: 'application/json', body: name.includes('leaderboard') ? '[]' : 'null' })
  })
  await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const s = { v: 5, started: true, ui: 'ko', native: ed === 'ko' ? 'lo' : 'lo', country: ed === 'ko' ? 'LA' : 'ZZ', theme: 'candy', course: 'topik', topikLevel: 1, newsSeen: '2026-11-22i', introDone: true, placementDone: true }
  await ctx.addInitScript(({ s, key }) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, JSON.stringify(s)); sessionStorage.setItem('seeded', '1') } } catch {} }, { s, key })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${ed}: ${e.message}`))
  await p.goto(`file://${ROOT}/dist-web/${ed === 'ko' ? '' : ed + '/'}index.html`)
  await p.waitForTimeout(1500)
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await p.waitForTimeout(500)
  const dev = sent.filter(([n]) => n === 'log_device_activity').map(([, a]) => a)
  const id = await p.evaluate(() => localStorage.getItem('chang-device-id'))
  console.log(ed, 'device calls:', dev.length, JSON.stringify(dev[0] ?? null), '| stored id ok:', !!id && id === dev[0]?.p_device, '| logged-in log_activity calls:', sent.filter(([n]) => n.startsWith('log_activity') || n === 'log_edition_activity').length)
  await ctx.close()
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
