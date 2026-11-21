// 누구나 열 수 있는 웹 버전 한 파일 만들기 (글꼴까지 모두 들어 있음, 인터넷 없어도 동작)
// 결과: dist-web/index.html          ← 호스팅용 (Netlify, GitHub Pages, 아무 웹서버)
//       dist-web/chang-korean.html   ← 메신저·이메일로 바로 보내는 용도 (내용 동일)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const root = new URL('../', import.meta.url)
let html = readFileSync(new URL('dist-single/index.html', root), 'utf8')

// 한 파일 빌드에서는 빠져 있는 한글 글꼴(Jua)을 직접 넣음
const jua = readFileSync(new URL('node_modules/@fontsource/jua/files/jua-korean-400-normal.woff2', root)).toString('base64')
const fontCss = `<style>@font-face{font-family:'Jua';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${jua}) format('woff2')}</style>`

const meta = `
    <meta name="description" content="ຮຽນຄຳສັບເກົາຫຼີດ້ວຍຮູບ ແລະ ສຽງ · 라오스 학습자를 위한 그림·소리 한국어 단어 앱" />
    <meta property="og:title" content="Chang Korean 🐘" />
    <meta property="og:description" content="ຮຽນຄຳສັບເກົາຫຼີດ້ວຍຮູບ ແລະ ສຽງ · 그림과 소리로 외우는 한국어 단어" />
    <meta property="og:type" content="website" />
    ${fontCss}`

if (!html.includes('<title>Chang Korean</title>')) throw new Error('dist-single/index.html 형식이 예상과 다릅니다')
html = html.replace('<title>Chang Korean</title>', `<title>Chang Korean</title>${meta}`)

mkdirSync(new URL('dist-web/', root), { recursive: true })
writeFileSync(new URL('dist-web/index.html', root), html)
writeFileSync(new URL('dist-web/chang-korean.html', root), html)
console.log(`✓ dist-web/index.html, dist-web/chang-korean.html (${(html.length / 1024).toFixed(0)} KB)`)

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
