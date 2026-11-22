// 새 버전 알림 (웹): 페이지에 들어 있는 빌드 번호(meta ck-build)와 서버의 version.json 을 비교
// - 처음 열 때 · 앱으로 돌아올 때 · 10분마다 확인
// - 새 버전이면: 홈(탭) 화면이면 바로 새로 고침, 공부하는 중이면 위에 '업데이트' 띠를 보여 줌
// 학습 기록은 기기(localStorage)에 있어서 새로 고쳐도 그대로 남음
import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'

export type UpdateReason = 'load' | 'resume' | 'interval'
let ready: UpdateReason | null = null
let target = ''
const subs = new Set<() => void>()
const current = typeof document !== 'undefined' ? document.querySelector('meta[name="ck-build"]')?.getAttribute('content') ?? '' : ''

export function useUpdateReady(): UpdateReason | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => ready,
  )
}

async function check(reason: UpdateReason) {
  if (ready) return
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const j = (await r.json()) as { build?: string }
    if (j.build && j.build !== current) {
      target = j.build
      ready = reason
      subs.forEach((f) => f())
    }
  } catch {
    /* 오프라인 등 — 다음에 다시 */
  }
}

/** main.tsx 에서 한 번 */
export function startUpdateCheck() {
  // 새로 고침 때 붙인 ?v= 는 주소창에서 지움
  const q = new URLSearchParams(location.search)
  if (q.has('v') && [...q.keys()].length === 1) history.replaceState(null, '', location.pathname + location.hash)
  if (!current || !/^https?:$/.test(location.protocol) || Capacitor.isNativePlatform()) return
  check('load')
  setInterval(() => check('interval'), 10 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check('resume')
  })
}

/** 새 버전으로: 주소를 살짝 바꿔서 브라우저 캐시를 건너뜀.
 *  auto = 저절로 새로 고침 — 같은 새 버전으로는 한 번만 (배포 직후 서버가 잠깐 옛 페이지를 줄 때 계속 새로 고치지 않게) */
export function applyUpdate(auto = false) {
  if (auto) {
    try {
      if (sessionStorage.getItem('ck-upd') === target) return
      sessionStorage.setItem('ck-upd', target)
    } catch {
      return
    }
  }
  location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`)
}
