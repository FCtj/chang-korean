import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 기본 빌드(dist/) → Capacitor 안드로이드 앱에 들어감
// --mode single  → dist-single/index.html 한 파일 (웹 미리보기·간단 호스팅용)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
  },
}))
