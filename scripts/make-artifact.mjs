// dist-single/index.html (한 파일 빌드)을 웹 미리보기용 조각 파일로 변환
// 결과: dist-single/chang-korean-web.html  ← 그대로 정적 호스팅에 올려도 되고, 미리보기 페이지로 게시해도 됨
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8')
const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
const scripts = [...src.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
if (!styles.length || !scripts.length) throw new Error('빌드 결과에서 style/script를 찾지 못했습니다')

const out = `<title>Chang Korean</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="라오스·태국 학습자를 위한 그림·소리 한국어 단어 앱 (MVP 웹 버전)">
<style>${styles.join('\n')}</style>
<style>:root{--safe-top:0px}</style>
<div id="root"></div>
<script type="module">${scripts.join('\n')}</script>
`
writeFileSync(new URL('../dist-single/chang-korean-web.html', import.meta.url), out)
console.log(`✓ dist-single/chang-korean-web.html (${(out.length / 1024).toFixed(0)} KB)`)
