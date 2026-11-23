// 로그인 시도 기록: 카카오 버튼 → (1) 오류로 돌아옴 (2) 그냥 돌아옴(그만둠) — log_login_attempt 가 단계별로 가는지 (일본어판)
import { createRequire } from 'module'
import http from 'node:http'
import { readFileSync } from 'node:fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (!p.startsWith('/chang-korean/')) return res.writeHead(404).end()
  p = p.slice('/chang-korean'.length)
  if (p.endsWith('/')) p += 'index.html'
  try {
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' })
    res.end(readFileSync(`${ROOT}/dist-web${p}`))
  } catch {
    res.writeHead(404).end()
  }
}).listen(8767)
const APP = 'http://localhost:8767/chang-korean/ja/'
const b = await chromium.launch()
for (const [label, back] of [['오류로 돌아옴', '?error=access_denied&error_description=KOE205%3A+%EB%8F%99%EC%9D%98+%ED%95%AD%EB%AA%A9'], ['그냥 돌아옴', '']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 KAKAOTALK 10.4.3' })
  const sent = []
  await ctx.route('**/rest/v1/rpc/**', async (r) => {
    if (r.request().url().endsWith('/log_login_attempt')) sent.push(JSON.parse(r.request().postData() || '{}'))
    await r.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
  await ctx.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { kakao: true, facebook: true } }) }))
  // 카카오 로그인 화면 대신 바로 앱으로 돌려보냄
  await ctx.route('**/auth/v1/authorize**', (r) => r.fulfill({ status: 302, headers: { location: APP + back } }))
  const p = await ctx.newPage()
  await p.goto(APP)
  await p.waitForTimeout(1200)
  await p.click('.kakao-btn')
  await p.waitForTimeout(2500)
  console.log(label, '→', sent.map((x) => `${x.p_stage}(${x.p_provider}${x.p_error ? ': ' + x.p_error : ''})`).join(' , '), '| 브라우저:', sent[0]?.p_browser, '| 기기 번호:', sent[0]?.p_device ? '있음' : '없음')
  await ctx.close()
}
await b.close()
srv.close()
