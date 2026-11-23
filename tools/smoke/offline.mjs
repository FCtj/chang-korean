// 오프라인: 한 번 연 뒤 인터넷을 끊고 다시 열어도 앱이 뜨는지 (판마다) · 하위 판 폴더를 잘못 가로채지 않는지 · 끊긴 동안 기록이 모였다가 다시 연결되면 가는지
import { createRequire } from 'module'
import http from 'node:http'
import { readFileSync } from 'node:fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (!p.startsWith('/chang-korean/')) return res.writeHead(404).end()
  p = p.slice('/chang-korean'.length)
  if (p.endsWith('/')) p += 'index.html'
  else if (!/\.[a-z]+$/.test(p)) return res.writeHead(301, { location: req.url + '/' }).end()
  try {
    const body = readFileSync(`${ROOT}/dist-web${p}`)
    res.writeHead(200, { 'content-type': TYPES[p.slice(p.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'max-age=600' })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(8766)
const B = 'http://localhost:8766/chang-korean/'
const b = await chromium.launch()
const errors = []
async function check(path, key, seed) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(({ s, key }) => { try { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)) } catch {} }, { s: seed, key })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${path}: ${e.message}`))
  await p.goto(B + path)
  await p.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await p.waitForTimeout(1500)
  await ctx.setOffline(true)
  let r
  try {
    await p.reload({ timeout: 8000 })
    await p.waitForTimeout(1000)
    r = (await p.locator('.continue').count()) ? `열림 (${(await p.title())})` : '빈 화면'
  } catch (e) {
    r = '안 열림: ' + e.message.split('\n')[0]
  }
  console.log(`/${path || ''} 끊고 새로고침 →`, r)
  return { ctx, p }
}
const seed = { v: 5, started: true, ui: 'ko', native: 'lo', country: 'LA', theme: 'candy', course: 'topik', topikLevel: 1, newsSeen: '2026-11-22i', introDone: true, placementDone: true }
// 1) 한국어판
const ko = await check('', 'chang-korean:v2', seed)
// 2) 한국어판만 연 기기에서, 연 적 없는 라오스어판을 끊긴 채로 열면 → 한국어판이 뜨면 안 됨
let wrong
try {
  await ko.p.goto(B + 'lo/', { timeout: 6000 })
  wrong = (await ko.p.title()).includes('Lao') ? '라오스어판' : `잘못: ${await ko.p.title()}`
} catch {
  wrong = '안 열림 (정상 — 연 적 없는 판)'
}
console.log('연 적 없는 /lo/ 를 끊긴 채로 →', wrong)
await ko.ctx.close()
// 3) 라오스어판 · 영어판
for (const [path, key] of [['lo/', 'chang-lo:v1'], ['en/', 'chang-en:v1']]) (await check(path, key, { ...seed, country: 'ZZ' })).ctx.close()
// 4) 끊긴 동안 기록 → 다시 연결되면 보냄
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(({ s }) => { try { if (!localStorage.getItem('chang-korean:v2')) localStorage.setItem('chang-korean:v2', JSON.stringify(s)) } catch {} }, { s: seed })
  let online = false
  const sent = []
  await ctx.route('**/rest/v1/rpc/**', (r) => {
    if (!online) return r.abort('internetdisconnected')
    sent.push(r.request().url().split('/rpc/')[1])
    return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
  const p = await ctx.newPage()
  await p.goto(B)
  await p.waitForTimeout(1200)
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await p.waitForTimeout(800)
  const queued = await p.evaluate(() => localStorage.getItem('chang-offline-queue:ko'))
  online = true
  await p.evaluate(() => window.dispatchEvent(new Event('online')))
  await p.waitForTimeout(1200)
  const after = await p.evaluate(() => localStorage.getItem('chang-offline-queue:ko'))
  console.log('끊긴 동안 모임:', queued ? '있음' : '없음', '| 다시 연결 후 보냄:', sent.filter((n) => n === 'log_device_activity').length, '번 | 남은 것:', after ? after : '없음')
  await ctx.close()
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
srv.close()
