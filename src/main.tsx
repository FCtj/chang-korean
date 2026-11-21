import { createRoot } from 'react-dom/client'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/noto-sans-lao-looped/lao-400.css'
import '@fontsource/noto-sans-lao-looped/lao-600.css'
import './styles.css'
import App from './App'

// 귀여운 한글 글꼴(Jua): 앱에는 파일로 넣고, 웹 한 파일 버전은 Google Fonts에서 불러옴
if (import.meta.env.MODE !== 'single') import('@fontsource/jua/korean-400.css')

createRoot(document.getElementById('root')!).render(<App />)
