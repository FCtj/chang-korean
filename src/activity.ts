// 공부 시간 재기 + 앱 연 횟수 (하루 요약용)
// - 공부 화면(외우기·문제)이 보이는 동안만, 마지막 조작/카드 넘김 뒤 3분 안일 때만 센다
// - 1분마다, 그리고 앱을 떠날 때 저장 (store.flushActivity → 서버 log_activity)
import { useEffect } from 'react'
import { absorbActivityStash, addActivity, flushActivity } from './store'

let lastTouch = Date.now()
let studyScreens = 0
const IDLE_MS = 3 * 60 * 1000
const TICK_MS = 10 * 1000

/** 카드가 넘어가거나(자동 반복 포함) 사용자가 무언가 눌렀을 때 */
export function touchStudy() {
  lastTouch = Date.now()
}

/** 외우기·문제 화면에서 호출: 이 화면이 열려 있는 동안 공부 시간을 잰다 */
export function useStudyClock() {
  useEffect(() => {
    studyScreens++
    touchStudy()
    return () => {
      studyScreens--
      flushActivity()
    }
  }, [])
}

let started = false
/** 앱 시작 때 한 번: 타이머·화면 전환 감지 */
export function startActivityTracking() {
  if (started || typeof window === 'undefined') return
  started = true
  absorbActivityStash()
  addActivity({ sessions: 1 })
  window.addEventListener('pointerdown', touchStudy, { passive: true })
  window.addEventListener('keydown', touchStudy)
  setInterval(() => {
    if (studyScreens > 0 && document.visibilityState === 'visible' && Date.now() - lastTouch < IDLE_MS) addActivity({ sec: TICK_MS / 1000 })
  }, TICK_MS)
  setInterval(() => {
    if (document.visibilityState === 'visible') flushActivity('live')
  }, 60 * 1000)
  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      flushActivity('stash')
    } else {
      absorbActivityStash()
      // 30분 넘게 나갔다가 돌아오면 새로 연 것으로 셈
      if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) addActivity({ sessions: 1 })
    }
  })
  window.addEventListener('pagehide', () => flushActivity('stash'))
}
