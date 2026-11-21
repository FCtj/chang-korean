import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { makeT } from './i18n'
import { useStore } from './store'
import { stopSpeaking } from './audio'
import { Ctx, type AppCtx, type Route, type Tab } from './ctx'
import { Icon } from './ui'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import RoundScreen from './screens/RoundScreen'
import Cards from './screens/Cards'
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

  const ui = s.ui ?? 'ko'
  const { t, tf } = useMemo(() => makeT(ui), [ui])

  useEffect(() => {
    document.documentElement.lang = ui
  }, [ui])

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
      native: s.native ?? 'lo',
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
    [ui, s.native, t, tf, tab],
  )

  if (!s.native || !s.ui) return <Onboarding />

  let screen
  if (top.name === 'tabs') {
    screen = (
      <>
        <main className="tab-page">
          {tab === 'learn' && <Home />}
          {tab === 'rewards' && <Rewards />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
        <nav className="tabbar" aria-label="menu">
          {(
            [
              ['learn', 'book', t('tabLearn')],
              ['rewards', 'gift', t('tabRewards')],
              ['settings', 'gear', t('tabSettings')],
            ] as const
          ).map(([id, icon, label]) => (
            <button key={id} className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon name={icon} size={24} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </>
    )
  } else if (top.name === 'round') screen = <RoundScreen key={top.roundId} roundId={top.roundId} />
  else if (top.name === 'cards') screen = <Cards key={stack.length} {...top} />
  else screen = <Quiz key={`${stack.length}-${top.kind}-${top.words.length}`} {...top} />

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">{screen}</div>
    </Ctx.Provider>
  )
}
