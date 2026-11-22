import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { makeT } from './i18n'
import { update, useStore } from './store'
import { applyUpdate, useUpdateReady } from './update'
import { NEWS, NEWS_ID } from './data/news'
import { personalizeCountry } from './data/country-words'
import { stopSpeaking } from './audio'
import { Ctx, type AppCtx, type Route, type Tab } from './ctx'
import { Icon, TopBar } from './ui'
import Onboarding from './screens/Onboarding'
import Community from './screens/Community'
import LoginError from './screens/LoginError'
import Home from './screens/Home'
import RoundScreen from './screens/RoundScreen'
import TrackScreen from './screens/TrackScreen'
import ReviewScreen from './screens/ReviewScreen'
import PointsScreen from './screens/PointsScreen'
import Intro from './screens/Intro'
import RankingScreen from './screens/RankingScreen'
import MockExam from './screens/MockExam'
import AdminScreen from './screens/AdminScreen'
import { SIMPLE_MODE } from './config'
import Player from './screens/Player'
import Placement from './screens/Placement'
import Quiz from './screens/Quiz'
import Rewards from './screens/Rewards'
import SettingsScreen from './screens/SettingsScreen'

export default function App() {
  const s = useStore()
  // 자기소개 문장 등을 내 나라로 (렌더 전에, 바뀔 때만)
  personalizeCountry(s.country)
  const [stack, setStack] = useState<Route[]>([{ name: 'tabs' }])
  const [adminHash, setAdminHash] = useState(() => typeof location !== 'undefined' && location.hash === '#admin')
  useEffect(() => {
    const on = () => setAdminHash(location.hash === '#admin')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const [tab, setTab] = useState<Tab>('learn')
  const stackRef = useRef(stack)
  stackRef.current = stack
  const tabRef = useRef(tab)
  tabRef.current = tab

  const ui = s.ui
  const { t, tf } = useMemo(() => makeT(ui), [ui])

  // 화면 언어·학습자 언어에 맞는 글꼴 (styles.css 의 data-ui / data-native)
  useEffect(() => {
    const el = document.documentElement
    el.lang = ui
    // 아랍어 화면은 오른쪽 → 왼쪽
    el.dir = ui === 'ar' ? 'rtl' : 'ltr'
    el.dataset.ui = ui
    el.dataset.native = s.native
  }, [ui, s.native])

  // 테마: candy(분홍) / carbon(블랙). 폰 상단 바 색도 같이
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.theme === 'carbon' ? '#0b0c0f' : '#FF8DB3')
  }, [s.theme])

  const top = stack[stack.length - 1]
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [top, tab])

  // 새 버전: 열 때·돌아올 때 찾았고 홈(탭) 화면이면 바로 새로 고침, 아니면 위에 띠
  const updateReady = useUpdateReady()
  useEffect(() => {
    if (updateReady && updateReady !== 'interval' && top.name === 'tabs') applyUpdate(true)
  }, [updateReady, top.name])

  // 안드로이드 뒤로가기 버튼
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const h = CapApp.addListener('backButton', () => {
      if (stackRef.current.length > 1) {
        stopSpeaking()
        setStack((st) => st.slice(0, -1))
      } else if (tabRef.current !== 'learn') setTab('learn')
      else CapApp.exitApp()
    })
    return () => {
      h.then((x) => x.remove())
    }
  }, [])

  const ctx: AppCtx = useMemo(
    () => ({
      ui,
      t,
      tf,
      tab,
      push: (r) => setStack((st) => [...st, r]),
      pop: () => {
        stopSpeaking()
        setStack((st) => (st.length > 1 ? st.slice(0, -1) : st))
      },
      replace: (r) => setStack((st) => [...st.slice(0, -1), r]),
      home: (nextTab) => {
        stopSpeaking()
        setStack([{ name: 'tabs' }])
        if (nextTab) setTab(nextTab)
      },
    }),
    [ui, t, tf, tab],
  )

  // 주소 끝 #admin → 관리자 화면 (처음 쓰는 기기여도 시작 화면 없이 바로)
  if (adminHash)
    return (
      <Ctx.Provider value={ctx}>
        <AdminScreen
          onClose={() => {
            history.replaceState(null, '', location.pathname + location.search)
            setAdminHash(false)
          }}
        />
      </Ctx.Provider>
    )
  if (!s.started)
    return (
      <Ctx.Provider value={ctx}>
        <Onboarding />
      </Ctx.Provider>
    )
  // 간단 모드: 처음 30초 체험 + 환영 포인트
  if (SIMPLE_MODE && !s.introDone)
    return (
      <Ctx.Provider value={ctx}>
        <Intro />
      </Ctx.Provider>
    )

  let screen
  if (top.name === 'tabs') {
    screen = (
      <>
        <main className="tab-page">
          <LoginError />
          {tab === 'learn' && <Home />}
          {tab === 'ranking' && <RankingScreen />}
          {tab === 'points' && <PointsScreen />}
          {tab === 'community' && <Community />}
          {tab === 'rewards' && <Rewards />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
        <nav className="tabbar" aria-label="menu">
          {(SIMPLE_MODE
            ? ([
                ['learn', 'home', t('tabLearn')],
                ['ranking', 'trophy', t('tabRanking')],
                ['points', 'gift', t('tabPoints')],
                ['settings', 'gear', t('tabSettings')],
              ] as const)
            : ([
                ['learn', 'home', t('tabLearn')],
                ['community', 'users', t('tabCommunity')],
                ['rewards', 'gift', t('tabRewards')],
                ['settings', 'gear', t('tabSettings')],
              ] as const)
          ).map(([id, icon, label]) => (
            <button key={id} className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <span className="tab-icon">
                <Icon name={icon} size={22} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </>
    )
  } else if (top.name === 'round') screen = <RoundScreen key={top.roundId} roundId={top.roundId} />
  else if (top.name === 'track') screen = <TrackScreen key={top.trackId} trackId={top.trackId} />
  else if (top.name === 'review') screen = <ReviewScreen />
  else if (top.name === 'mock') screen = <MockExam />
  else if (top.name === 'admin') screen = <AdminScreen onClose={() => ctx.pop()} />
  else if (top.name === 'community')
    screen = (
      <div className="screen">
        <TopBar title={`👥 ${t('tabCommunity')}`} />
        <Community />
      </div>
    )
  else if (top.name === 'player')
    screen = <Player key={`${stack.length}-${top.roundId}-${top.startChunk}-${!!top.review}-${top.nonce ?? 0}`} roundId={top.roundId} startChunk={top.startChunk} review={top.review} />
  else if (top.name === 'placement') screen = <Placement ui={ui} mode="retake" onBack={() => ctx.pop()} onDone={() => ctx.home('learn')} />
  else screen = <Quiz key={`${stack.length}-${top.kind}-${top.words.length}`} {...top} />

  const showNews = top.name === 'tabs' && !!s.introDone && s.newsSeen !== NEWS_ID
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">{screen}</div>
      {updateReady && (
        <div className="update-bar" role="status">
          <span>✨ {t('updateReady')}</span>
          <button className="btn btn-pink sm" onClick={() => applyUpdate()}>
            {t('updateNow')}
          </button>
        </div>
      )}
      {showNews && (
        <div className="sheet-backdrop" onClick={() => update((st) => ({ ...st, newsSeen: NEWS_ID }))}>
          <section className="sheet news-sheet" role="dialog" aria-label={t('newsTitle')} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <h2 className="h3">🎉 {t('newsTitle')}</h2>
            <ul className="news-list">
              {NEWS.map((n) => (
                <li key={n.icon}>
                  <span className="news-icon" aria-hidden="true">
                    {n.icon}
                  </span>
                  <span>{n.text[ui]}</span>
                </li>
              ))}
            </ul>
            <button className="btn btn-pink btn-block" onClick={() => update((st) => ({ ...st, newsSeen: NEWS_ID }))}>
              {t('ok')}
            </button>
          </section>
        </div>
      )}
    </Ctx.Provider>
  )
}
