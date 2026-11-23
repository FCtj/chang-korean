import { createRequire } from 'module'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const { chromium } = (() => { const r = createRequire(import.meta.url); try { return r('playwright') } catch { return r('/opt/node22/lib/node_modules/playwright') } })()
const OUT = `${WORK}/lao/shots`
const b = await chromium.launch()
const errors = []
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"external":{"kakao":true}}' }))
const s = { v: 5, started: true, ui: 'ko', native: 'lo', country: 'ZZ', theme: 'candy', course: 'topik', topikLevel: 2, newsSeen: '2026-11-22i', introDone: true, placementDone: true }
await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('chang-lo:v1', JSON.stringify(s)); localStorage.setItem('chang-ed-voice-hint', '1'); sessionStorage.setItem('seeded', '1') } } catch {} }, s)
const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push(e.message))
await p.goto(`file://${ROOT}/dist-web/lo/index.html`)
await p.waitForTimeout(1200)
console.log('levels:', (await p.$$eval('.topik-lv, .lv-btn, .level-btn, .tk-lv', (els) => els.map((e) => e.textContent.trim()))).join(' | '))
console.log('course:', (await p.textContent('.continue')).replace(/\s+/g, ' ').trim().slice(0, 70))
await p.screenshot({ path: `${OUT}/freq-home.png` })
await p.click('.continue')
await p.waitForTimeout(800)
const chips = await p.$$eval('.wchip-ko', (els) => els.map((e) => e.textContent.trim()))
console.log('chips:', chips.join(' '), '| front:', (await p.textContent('.card-word')).trim(), (await p.textContent('.fcard-face.front .ed-pron, .fcard-face.front .pron').catch(() => '')).trim())
await p.click('.fcard')
await p.waitForTimeout(700)
console.log('back:', (await p.textContent('.fcard-face.back')).replace(/\s+/g, ' ').trim())
await p.screenshot({ path: `${OUT}/freq-card.png` })
console.log('errors:', errors.length ? errors : 'none')
await b.close()
