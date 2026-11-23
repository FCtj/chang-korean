// 웹: 한 번 열면 앱(한 파일)을 기기에 저장 → 다음부터 인터넷 없이도 열림
// sw.js · manifest.webmanifest 는 빌드할 때 scripts/make-standalone.mjs 가 판 폴더마다 만듦 (/, /ja/, /en/, /lo/)
// 인터넷이 되면 언제나 서버의 새 버전을 먼저 받으므로 업데이트는 그대로 됨
import { Capacitor } from '@capacitor/core'

export function startOffline() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // 안드로이드·iOS 앱은 파일이 앱 안에 있음 · 메신저로 받은 한 파일(file://)은 등록 불가 · 개발 서버에는 sw.js 없음
  if (Capacitor.isNativePlatform() || import.meta.env.MODE !== 'single') return
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return
  const register = () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {})
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
