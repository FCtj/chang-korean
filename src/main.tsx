import { createRoot } from 'react-dom/client'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/noto-sans-lao-looped/lao-400.css'
import '@fontsource/noto-sans-lao-looped/lao-600.css'
// 몽골어(키릴)·베트남어 화면용 둥근 글꼴 (Fredoka 에 없는 글자)
import '@fontsource/nunito/latin-500.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/cyrillic-500.css'
import '@fontsource/nunito/cyrillic-700.css'
import '@fontsource/nunito/cyrillic-ext-500.css'
import '@fontsource/nunito/cyrillic-ext-700.css'
import '@fontsource/nunito/vietnamese-500.css'
import '@fontsource/nunito/vietnamese-700.css'
import './styles.css'
import App from './App'
import { initBackend } from './backend'
import { startActivityTracking } from './activity'
import { startUpdateCheck } from './update'

// 귀여운 한글 글꼴(Jua): 앱에는 파일로 넣고, 웹 한 파일 버전은 Google Fonts에서 불러옴
if (import.meta.env.MODE !== 'single') import('@fontsource/jua/korean-400.css')

initBackend()
startActivityTracking()
startUpdateCheck()
createRoot(document.getElementById('root')!).render(<App />)
