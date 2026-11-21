import { ROUNDS } from '../data/words'
import { useApp } from '../ctx'
import { daysLeftInMonth, demoRanking, isCollected, todayKey, useStore, STAMPS_PER_TICKET } from '../store'
import { Elephant, TIER_ACC } from '../ui'

export default function Rewards() {
  const s = useStore()
  const { t, tf, ui } = useApp()
  const rows = demoRanking(s)
  const myRank = rows.findIndex((r) => r.me) + 1
  const month = Number(s.monthKey.slice(5, 7))
  const stamps = s.stamps.length
  const tickets = Math.floor(stamps / STAMPS_PER_TICKET)
  const onCard = stamps % STAMPS_PER_TICKET
  const stampedToday = s.stamps.includes(todayKey())
  const target = myRank > 3 ? rows[2] : myRank > 1 ? rows[0] : null
  const targetRank = myRank > 3 ? 3 : 1
  const visible = rows.map((r, i) => ({ ...r, rank: i + 1 })).filter((r) => r.rank <= 5 || Math.abs(r.rank - myRank) <= 1)

  return (
    <div className="page">
      <header className="rw-head">
        <div>
          <div className="eyebrow">{t('thisMonth')}</div>
          <h1 className="h1">{tf('monthTitle', month)}</h1>
        </div>
        <span className="dday num">D-{daysLeftInMonth()}</span>
      </header>

      <section className="me-card">
        <div className="me-rank num">
          <span>#</span>
          {myRank}
        </div>
        <div className="me-body">
          <div className="me-name">{s.nickname}</div>
          <div className="me-points num">
            ⭐ {s.monthPoints.toLocaleString()} {t('points')}
          </div>
          {target && <div className="me-gap num">{tf('toRank', targetRank, Math.max(1, target.points - s.monthPoints + 1))}</div>}
        </div>
        <Elephant size={64} acc="crown" className="me-elephant" />
      </section>

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
        <div className="panel-head">
          <h2 className="h3">🏆 {t('monthlyRanking')}</h2>
          <span className="chip">{t('demoBadge')}</span>
        </div>
        <ol className="rank-list">
          {visible.map((r, i) => {
            const gap = i > 0 && r.rank - visible[i - 1].rank > 1
            return (
              <li key={r.name + r.rank} className={`${r.me ? 'rank-row me' : 'rank-row'} ${gap ? 'after-gap' : ''}`}>
                <span className="rank-no num">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
                <Elephant size={30} acc={TIER_ACC[r.tier - 1]} tone={r.me ? 'pink' : 'lilac'} />
                <span className="rank-name">
                  {r.name}
                  {r.me && <span className="me-tag">{t('me')}</span>}
                </span>
                <span className="rank-pts num">{r.points.toLocaleString()}</span>
              </li>
            )
          })}
        </ol>
        <p className="note">{t('demoNote')}</p>
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
