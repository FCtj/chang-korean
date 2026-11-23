// 누구나 열 수 있는 웹 버전 한 파일 만들기 (글꼴까지 모두 들어 있음, 인터넷 없어도 동작)
// 결과: dist-web/index.html          ← 호스팅용 (Netlify, GitHub Pages, 아무 웹서버)
//       dist-web/chang-korean.html   ← 메신저·이메일로 바로 보내는 용도 (내용 동일)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)

// ───────── 오프라인(서비스 워커) · 홈 화면 앱(manifest) — 판 폴더마다 ─────────
// 이 폴더의 파일만 맡음 (하위 판 폴더 /ja/ 등은 그 판의 sw.js 가 맡음). 인터넷이 되면 언제나 서버의 새것, 끊기면 저장해 둔 것
function swSource(ed, build, files) {
  return `// Chang 오프라인 (${ed}) — 빌드 ${build}. scripts/make-standalone.mjs 가 만듦
const CACHE = 'chang-${ed}-${build}'
const BASE = new URL('./', self.location).pathname
const FILES = ${JSON.stringify(files)}
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('chang-${ed}-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
// 이 폴더 바로 아래의 파일만 (폴더 이름만 있는 주소 /ja 같은 것은 건드리지 않음)
function mine(url) {
  const u = new URL(url)
  if (u.origin !== self.location.origin || !u.pathname.startsWith(BASE)) return false
  const rest = u.pathname.slice(BASE.length)
  return rest === '' || (rest.includes('.') && !rest.includes('/'))
}
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !mine(req.url)) return
  const u = new URL(req.url)
  if (u.pathname.endsWith('version.json') || u.pathname.endsWith('sw.js')) return // 새 버전 확인은 언제나 서버로
  const page = req.mode === 'navigate' || u.pathname === BASE || u.pathname.endsWith('/index.html')
  const key = page ? BASE + 'index.html' : u.pathname
  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const res = await fetch(req)
      if (res.ok && res.type === 'basic') cache.put(key, res.clone())
      return res
    } catch {
      return (await cache.match(key)) || (await cache.match(req)) || Response.error()
    }
  })())
})
`
}
function manifestSource({ name, short, bg, theme, icons }) {
  return JSON.stringify({ name, short_name: short, start_url: './', scope: './', display: 'standalone', background_color: bg, theme_color: theme, icons: icons.map(([src, size]) => ({ src, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) }, null, 2) + '\n'
}

// 일본어판·영어판: node scripts/make-standalone.mjs ja|en → dist-web/ja/index.html · dist-web/en/index.html
const ED = process.argv[2]
if (ED === 'ja' || ED === 'en' || ED === 'lo') {
  const info = {
    ja: { app: 'Chang Japanese', emoji: '🗻', desc: '그림과 소리로 외우는 일본어 단어 · JLPT N5~N1 레벨별 핵심 단어' },
    en: { app: 'Chang English', emoji: '💼', desc: '그림과 소리로 외우는 영어 단어 · TOEIC 450~900+ 점수대별 핵심 단어' },
    lo: { app: 'Chang Lao', emoji: '🐘', desc: '그림과 소리로 외우는 라오스어 단어 · 입문~중급 · 여행·식당·일터 상황별' },
  }[ED]
  let page = readFileSync(new URL(`dist-single-${ED}/index.html`, root), 'utf8')
  // 판 로고: src/logos.ts (SVG) · store/editions/<판>-icon-180/512.png (홈 화면 아이콘)
  const { LOGO_SVG } = await import(new URL('src/logos.ts', root).href)
  const favicon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_SVG[ED])}`
  mkdirSync(new URL(`dist-web/${ED}/`, root), { recursive: true })
  for (const px of [180, 192, 512]) copyFileSync(new URL(`store/editions/${ED}-icon-${px}.png`, root), new URL(`dist-web/${ED}/icon-${px}.png`, root))
  const pageUrl = `https://fctj.github.io/chang-korean/${ED}/`
  const juaFont = readFileSync(new URL('node_modules/@fontsource/jua/files/jua-korean-400-normal.woff2', root)).toString('base64')
  const head = `
    <meta name="description" content="${info.desc}" />
    <meta property="og:title" content="${info.app} ${info.emoji}" />
    <meta property="og:description" content="${info.desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${pageUrl}icon-512.png" />
    <link rel="icon" type="image/svg+xml" href="${favicon}" />
    <link rel="apple-touch-icon" href="icon-180.png" />
    <link rel="manifest" href="manifest.webmanifest" />
    <style>@font-face{font-family:'Jua';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${juaFont}) format('woff2')}</style>`
  if (!page.includes('<title>Chang Korean</title>')) throw new Error(`dist-single-${ED}/index.html 형식이 예상과 다릅니다`)
  page = page.replace('<title>Chang Korean</title>', `<title>${info.app}</title>${head}`).replace('<html lang="ko"', `<html lang="${ED}"`)
  mkdirSync(new URL(`dist-web/${ED}/`, root), { recursive: true })
  writeFileSync(new URL(`dist-web/${ED}/index.html`, root), page)
  const id = (page.match(/<meta name="ck-build" content="([^"]+)"/) ?? [])[1]
  if (!id) throw new Error('빌드 번호(ck-build)가 없음')
  writeFileSync(new URL(`dist-web/${ED}/version.json`, root), JSON.stringify({ build: id }) + '\n')
  writeFileSync(new URL(`dist-web/${ED}/manifest.webmanifest`, root), manifestSource({ name: info.app, short: info.app.replace('Chang ', 'Chang '), bg: '#FFF7F9', theme: '#FF8DB3', icons: [['icon-192.png', 192], ['icon-512.png', 512]] }))
  writeFileSync(new URL(`dist-web/${ED}/sw.js`, root), swSource(ED, id, ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png']))
  console.log(`✓ dist-web/${ED}/index.html (${(page.length / 1024).toFixed(0)} KB) · version.json (${id})`)
  process.exit(0)
}

let html = readFileSync(new URL('dist-single/index.html', root), 'utf8')

// 한 파일 빌드에서는 빠져 있는 한글 글꼴(Jua)을 직접 넣음
const jua = readFileSync(new URL('node_modules/@fontsource/jua/files/jua-korean-400-normal.woff2', root)).toString('base64')
const fontCss = `<style>@font-face{font-family:'Jua';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${jua}) format('woff2')}</style>`

const meta = `
    <meta name="description" content="ຮຽນຄຳສັບເກົາຫຼີດ້ວຍຮູບ ແລະ ສຽງ · 라오스 학습자를 위한 그림·소리 한국어 단어 앱" />
    <meta property="og:title" content="Chang Korean 🐘" />
    <meta property="og:description" content="ຮຽນຄຳສັບເກົາຫຼີດ້ວຍຮູບ ແລະ ສຽງ · 그림과 소리로 외우는 한국어 단어" />
    <meta property="og:type" content="website" />
    <link rel="manifest" href="manifest.webmanifest" />
    <link rel="apple-touch-icon" href="icon-192.png" />
    ${fontCss}`

if (!html.includes('<title>Chang Korean</title>')) throw new Error('dist-single/index.html 형식이 예상과 다릅니다')
html = html.replace('<title>Chang Korean</title>', `<title>Chang Korean</title>${meta}`)

mkdirSync(new URL('dist-web/', root), { recursive: true })
writeFileSync(new URL('dist-web/index.html', root), html)
writeFileSync(new URL('dist-web/chang-korean.html', root), html)
console.log(`✓ dist-web/index.html, dist-web/chang-korean.html (${(html.length / 1024).toFixed(0)} KB)`)

// 새 버전 알림용: 앱 안의 빌드 번호와 같은 값 (src/update.ts 가 주기적으로 확인)
const build = (html.match(/<meta name="ck-build" content="([^"]+)"/) ?? [])[1]
if (!build) throw new Error('빌드 번호(ck-build)가 없음')
writeFileSync(new URL('dist-web/version.json', root), JSON.stringify({ build }) + '\n')
console.log(`✓ dist-web/version.json (${build})`)
for (const px of [192, 512]) copyFileSync(new URL(`store/icon-${px}.png`, root), new URL(`dist-web/icon-${px}.png`, root))
writeFileSync(new URL('dist-web/manifest.webmanifest', root), manifestSource({ name: 'Chang Korean', short: 'Chang', bg: '#FFF7F9', theme: '#FF8DB3', icons: [['icon-192.png', 192], ['icon-512.png', 512]] }))
writeFileSync(new URL('dist-web/sw.js', root), swSource('ko', build, ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']))
console.log('✓ dist-web/sw.js · manifest.webmanifest (오프라인 · 홈 화면 앱)')

// 회사 소개 (니즈랩) → dist-web/needslab/ — 원본 site/needslab/, 앱 아이콘은 store/ 에서
mkdirSync(new URL('dist-web/needslab/img/', root), { recursive: true })
for (const f of ['index.html', 'logo.svg']) copyFileSync(new URL(`site/needslab/${f}`, root), new URL(`dist-web/needslab/${f}`, root))
copyFileSync(new URL('store/icon-512.png', root), new URL('dist-web/needslab/img/ko.png', root))
for (const ed of ['ja', 'en', 'lo']) copyFileSync(new URL(`store/editions/${ed}-icon-512.png`, root), new URL(`dist-web/needslab/img/${ed}.png`, root))
console.log('✓ dist-web/needslab/ (회사 소개)')

// 개인정보처리방침 · 데이터 삭제 안내 (Facebook 앱 라이브 전환에 필요) → dist-web/privacy.html, dist-web/delete-data.html
const config = readFileSync(new URL('src/config.ts', root), 'utf8')
const email = (config.match(/CONTACT_EMAIL = '([^']*)'/) ?? [])[1] ?? ''
const issues = 'https://github.com/FCtj/chang-korean/issues'
const contact = email
  ? `문의: <a href="mailto:${email}">${email}</a>`
  : `문의: <a href="${issues}">${issues}</a>`
const contactEn = email ? `Contact: <a href="mailto:${email}">${email}</a>` : `Contact: <a href="${issues}">${issues}</a>`
const style = readFileSync(new URL('legal/_style.css', root), 'utf8')
for (const page of ['privacy.html', 'delete-data.html']) {
  const out = readFileSync(new URL(`legal/${page}`, root), 'utf8')
    .replaceAll('{{STYLE}}', style)
    .replaceAll('{{CONTACT_EN}}', contactEn)
    .replaceAll('{{CONTACT}}', contact)
  if (out.includes('{{')) throw new Error(`legal/${page}: 바꾸지 못한 {{…}} 가 남아 있음`)
  writeFileSync(new URL(`dist-web/${page}`, root), out)
}
console.log('✓ dist-web/privacy.html, dist-web/delete-data.html')
