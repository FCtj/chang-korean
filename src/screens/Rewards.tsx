import { ROUNDS } from '../data/words'
import { useApp } from '../ctx'
import { daysLeftInMonth, isCollected, todayKey, useStore, STAMPS_PER_TICKET } from '../store'
import Leaderboard from './Leaderboard'

export default function Rewards() {
  const s = useStore()
  const { t, tf, ui } = useApp()
  const month = Number(s.monthKey.slice(5, 7))
  const stamps = s.stamps.length
  const tickets = Math.floor(stamps / STAMPS_PER_TICKET)
  const onCard = stamps % STAMPS_PER_TICKET
  const stampedToday = s.stamps.includes(todayKey())

  return (
    <div className="page">
      <header className="rw-head">
        <div>
          <div className="eyebrow">{t('thisMonth')}</div>
          <h1 className="h1">{tf('monthTitle', month)}</h1>
        </div>
        <span className="dday num">D-{daysLeftInMonth()}</span>
      </header>

      <Leaderboard />

      <section className="panel">
        <h2 className="h3">🎁 {t('rewardsTitle')}</h2>
        <ul className="reward-list">
          <li className="reward first">
            <span className="reward-medal">🥇</span>
            <span className="reward-rank">{tf('rankLabel', 1)}</span>
            <span className="reward-prize">☕🍰 {t('reward1')}</span>
          </li>
          <li className="reward">
            <span className="reward-medal">🥈</span>
            <span className="reward-rank">{tf('rankLabel', 2, 3)}</span>
            <span className="reward-prize">☕ {t('reward23')}</span>
          </li>
          <li className="reward">
            <span className="reward-medal">🏅</span>
            <span className="reward-rank">{tf('rankLabel', 4, 10)}</span>
            <span className="reward-prize">🥤 {t('reward410')}</span>
          </li>
          <li className="reward">
            <span className="reward-medal">🎟️</span>
            <span className="reward-rank">{t('drawLabel')}</span>
            <span className="reward-prize">☕ {t('rewardDraw')}</span>
          </li>
        </ul>
        <p className="note">{t('rewardNote')}</p>
      </section>

      <section className="panel stamp-panel">
        <div className="panel-head">
          <h2 className="h3">☕ {t('stampCard')}</h2>
          {tickets > 0 && <span className="chip chip-butter">🎟️ {tf('tickets', tickets)}</span>}
        </div>
        <p className="note">{t('stampDesc')}</p>
        <div className="stamp-grid" role="img" aria-label={`${onCard}/${STAMPS_PER_TICKET}`}>
          {Array.from({ length: STAMPS_PER_TICKET }, (_, i) => (
            <span key={i} className={i < onCard ? 'stamp on' : 'stamp'}>
              {i < onCard ? '☕' : <span className="num">{i + 1}</span>}
            </span>
          ))}
        </div>
        <div className="stamp-foot">
          <span className={stampedToday ? 'chip chip-mint' : 'chip chip-pink'}>{stampedToday ? `✓ ${t('todayDone')}` : t('todayTodo')}</span>
          <span className="note">{tf('stampsLeft', STAMPS_PER_TICKET - onCard)}</span>
        </div>
      </section>

      <section className="panel">
        <h2 className="h3">🌸 {t('stickers')}</h2>
        <p className="note">{t('stickersDesc')}</p>
        {ROUNDS.map((r) => {
          const got = r.words.filter((w) => isCollected(s, w)).length
          return (
            <div key={r.id} className="sticker-round">
              <div className="sticker-title">
                <span>
                  {tf('roundN', r.no)} · {r.title[ui]}
                </span>
                <span className="num">
                  {got}/{r.words.length}
                </span>
              </div>
              <div className="sticker-grid">
                {r.words.map((w) => (
                  <span key={w.id} className={isCollected(s, w) ? 'sticker on' : 'sticker'} title={w.ko}>
                    {w.emoji}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
