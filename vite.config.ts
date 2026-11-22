import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// 판: VITE_EDITION=ja (한국인이 배우는 일본어 · JLPT) / en (영어 · TOEIC). 없으면 한국어판
const ED = ['ja', 'en', 'lo'].includes(process.env.VITE_EDITION ?? '') ? process.env.VITE_EDITION : ''

// 빌드마다 다른 번호 → 웹 앱이 version.json 과 비교해서 새 버전이면 스스로 새로 고침 (src/update.ts)
const BUILD_ID = process.env.BUILD_ID || (process.env.GITHUB_SHA || '').slice(0, 12) || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
const buildMeta = {
  name: 'ck-build-id',
  transformIndexHtml: (html: string) => html.replace('<title>', `<meta name="ck-build" content="${BUILD_ID}" />\n    <title>`),
}

// 기본 빌드(dist/) → Capacitor 안드로이드 앱에 들어감
// --mode single  → dist-single/index.html 한 파일 (웹 미리보기·간단 호스팅용)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile(), buildMeta] : [react(), buildMeta],
  // 일본어·영어판은 그 판의 단어 모음만 넣음 (src/data/edition-data.ts → edition-data-ja.ts / -en.ts)
  resolve: { alias: ED ? [{ find: /^\.\/edition-data\.ts$/, replacement: fileURLToPath(new URL(`./src/data/edition-data-${ED}.ts`, import.meta.url)) }] : [] },
  build: {
    outDir: (mode === 'single' ? 'dist-single' : 'dist') + (ED ? `-${ED}` : ''),
    emptyOutDir: true,
  },
}))
