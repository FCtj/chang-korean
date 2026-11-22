// 포인트 탭 (간단 모드): 내 포인트 · 교환소(오픈 예정) · 최근 교환 내역(테스트 예시) · 모으는 법
import { useApp } from '../ctx'
import { backendReady, signInWithFacebook, useAuth } from '../backend'
import { DAILY_CAP, EXAM_BONUS, PROMO_BONUS, useStore } from '../store'
import { nextShopItem } from '../data/shop'
import { ShopGrid } from './Intro'
import RecentRewards from './RecentRewards'

export default function PointsScreen() {
  const s = useStore()
  const auth = useAuth()
  const { t, tf, ui } = useApp()
  const pts = s.totalPoints
  const next = nextShopItem(pts)
  const pct = Math.min(100, Math.round((pts / next.points) * 100))
  return (
    <div className="page">
      <h1 className="h1">💰 {t('myPoints')}</h1>
      <section className="wallet-card big" aria-label={t('myPoints')}>
        <span className="wallet-points num">{tf('pointsN', pts)}</span>
        <span className="wallet-goal">
          <span aria-hidden="true">{next.icon}</span> {tf('toReward', next.name[ui], Math.max(0, next.points - pts))}
        </span>
        <span className="wallet-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      </section>

      {backendReady && auth.status !== 'in' && (
        <section className="panel center-panel">
          <p className="note">{t('savePoints')}</p>
          <button className="fb-btn" onClick={() => signInWithFacebook()}>
            <span className="fb-logo" aria-hidden="true">
              f
            </span>{' '}
            {t('fbLogin')}
          </button>
        </section>
      )}

      <section className="panel">
        <h2 className="h3">🛍️ {t('pointsShop')}</h2>
        <ShopGrid points={pts} />
        <p className="note">{t('shopNote')}</p>
      </section>

      <RecentRewards />

      <section className="panel">
        <h2 className="h3">✨ {t('earnTitle')}</h2>
        <ul className="earn-list">
          <li>
            <span aria-hidden="true">📚</span> {t('earnWord')} <b className="num">+3P</b>
          </li>
          <li>
            <span aria-hidden="true">🎓</span> {t('earnExam')} <b className="num">+{EXAM_BONUS}P</b>
          </li>
          <li>
            <span aria-hidden="true">🏆</span> {t('earnPromo')} <b className="num">+{PROMO_BONUS}P</b>
          </li>
          <li>
            <span aria-hidden="true">⏱️</span> {t('earnCap')} <b className="num">{DAILY_CAP}P</b>
          </li>
        </ul>
      </section>
    </div>
  )
}
