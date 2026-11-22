import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { makeT } from './i18n'
import { useStore } from './store'
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
import { SIMPLE_MODE } from './config'
import Player from './screens/Player'
import Placement from './screens/Placement'
import Quiz from './screens/Quiz'
import Rewards from './screens/Rewards'
import SettingsScreen from './screens/SettingsScreen'

export default function App() {
  const s = useStore()
  const [stack, setStack] = useState<Route[]>([{ name: 'tabs' }])
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
  else if (top.name === 'community')
    screen = (
      <div className="screen">
        <TopBar title={`👥 ${t('tabCommunity')}`} />
        <Community />
      </div>
    )
  else if (top.name === 'player')
    screen = <Player key={`${stack.length}-${top.roundId}-${top.startChunk}-${!!top.review}`} roundId={top.roundId} startChunk={top.startChunk} review={top.review} />
  else if (top.name === 'placement') screen = <Placement ui={ui} mode="retake" onBack={() => ctx.pop()} onDone={() => ctx.home('learn')} />
  else screen = <Quiz key={`${stack.length}-${top.kind}-${top.words.length}`} {...top} />

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">{screen}</div>
    </Ctx.Provider>
  )
}
