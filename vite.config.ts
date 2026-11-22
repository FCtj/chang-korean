import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

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
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
  },
}))
