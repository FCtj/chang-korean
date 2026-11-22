// 랭킹 탭 (간단 모드): 이번 달 랭킹 — 오늘 / 이번 달 · 우리나라 / 전체
import { useApp } from '../ctx'
import { daysLeftInMonth, useStore } from '../store'
import Leaderboard from './Leaderboard'

export default function RankingScreen() {
  const s = useStore()
  const { t, tf } = useApp()
  const month = Number(s.monthKey.slice(5, 7))
  return (
    <div className="page">
      <header className="rw-head">
        <div>
          <div className="eyebrow">{t('thisMonth')}</div>
          <h1 className="h1">🏆 {tf('monthTitle', month)}</h1>
        </div>
        <span className="dday num">D-{daysLeftInMonth()}</span>
      </header>
      <Leaderboard />
    </div>
  )
}
