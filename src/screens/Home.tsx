import { TIERS, type Round } from '../data/words'
import { useApp } from '../ctx'
import { currentRound, currentTierNo, isMastered, isPromoOpen, isRoundOpen, isTierOpen, todayKey, useStore, STAMPS_PER_TICKET } from '../store'
import { Icon, Mascot, ProgressBar, shuffle } from '../ui'
import { PROMO_QUESTIONS } from '../data/words'

export default function Home() {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const tierNo = currentTierNo(s)
  const tier = TIERS.find((x) => x.no === tierNo)!
  const cur = currentRound(s)
  const stampedToday = s.stamps.includes(todayKey())
  const cardStamps = s.stamps.length % STAMPS_PER_TICKET

  const masteredIn = (r: Round) => r.words.filter((w) => isMastered(s, w)).length

  return (
    <div className="page">
      <header className="home-head">
        <Mascot badge={tier.badge} size={52} />
        <div className="home-head-text">
          <div className="eyebrow">{tf('tierN', tier.no)}</div>
          <div className="home-tier">{tier.name[ui]}</div>
          <div className="home-name">{s.nickname}</div>
        </div>
        <div className="pills">
          <span className="pill pill-gold num">⭐ {s.monthPoints.toLocaleString()}</span>
          {s.streak > 0 && <span className="pill num">🔥 {tf('streak', s.streak)}</span>}
        </div>
      </header>

      {cur && (
        <button className="continue" onClick={() => push({ name: 'round', roundId: cur.id })}>
          <div className="continue-top">
            <span className="eyebrow light">{t('continueStudy')}</span>
            <span className="continue-stamp">
              {stampedToday ? `☕ ${t('todayDone')}` : `☕ ${t('todayTodo')}`}
            </span>
          </div>
          <div className="continue-title">
            {tf('roundN', cur.no)} · {cur.title[ui]}
          </div>
          <div className="continue-emojis" aria-hidden="true">
            {cur.words.slice(0, 8).map((w) => (
              <span key={w.id}>{w.emoji}</span>
            ))}
          </div>
          <div className="continue-foot">
            <ProgressBar value={masteredIn(cur)} max={cur.words.length} tone="gold" />
            <span className="num">
              {masteredIn(cur)}/{cur.words.length} {t('mastered')}
            </span>
          </div>
        </button>
      )}

      <div className="mini-stamps" aria-label={t('stampCard')}>
        <span className="mini-stamps-label">{t('stampCard')}</span>
        <span className="mini-cups" aria-hidden="true">
          {Array.from({ length: STAMPS_PER_TICKET }, (_, i) => (
            <span key={i} className={i < cardStamps ? 'cup on' : 'cup'}>☕</span>
          ))}
        </span>
        <span className="num mini-stamps-count">
          {cardStamps}/{STAMPS_PER_TICKET}
        </span>
      </div>

      <div className="path">
        {TIERS.map((tr) => {
          const open = isTierOpen(s, tr.no)
          const ready = tr.rounds.length > 0
          const done = s.passedTiers.includes(tr.no)
          return (
            <section key={tr.no} className={`tier ${open ? 'open' : 'closed'} ${done ? 'done' : ''}`}>
              <div className="tier-head">
                <Mascot badge={tr.badge} size={34} />
                <div className="tier-head-text">
                  <div className="eyebrow">{tf('tierN', tr.no)}</div>
                  <h2 className="tier-name">{tr.name[ui]}</h2>
                  <div className="tier-topics">{tr.topics[ui]}</div>
                </div>
                {done ? (
                  <span className="chip chip-good"><Icon name="check" size={14} /> {t('passed')}</span>
                ) : !ready ? (
                  <span className="chip">{t('comingSoon')}</span>
                ) : !open ? (
                  <span className="chip"><Icon name="lock" size={14} /> {t('locked')}</span>
                ) : null}
              </div>

              {ready ? (
                <ol className="rounds">
                  {tr.rounds.map((r) => {
                    const ro = isRoundOpen(s, r)
                    const passed = s.passedRounds.includes(r.id)
                    const m = masteredIn(r)
                    return (
                      <li key={r.id}>
                        <button className={`round-card ${ro ? '' : 'locked'} ${passed ? 'passed' : ''}`} disabled={!ro} onClick={() => push({ name: 'round', roundId: r.id })}>
                          <span className="round-no num">{passed ? <Icon name="check" size={20} /> : ro ? r.no : <Icon name="lock" size={18} />}</span>
                          <span className="round-body">
                            <span className="round-title">
                              {tf('roundN', r.no)} <span className="round-sub">{r.title[ui]}</span>
                            </span>
                            {ro ? (
                              <span className="round-prog">
                                <ProgressBar value={m} max={r.words.length} />
                                <span className="num">{m}/50</span>
                              </span>
                            ) : (
                              <span className="round-hint">{t('lockedHint')}</span>
                            )}
                          </span>
                          <span className="round-emoji" aria-hidden="true">{r.words[0].emoji}</span>
                        </button>
                      </li>
                    )
                  })}
                  <li>
                    <PromoCard tierNo={tr.no} />
                  </li>
                </ol>
              ) : (
                <p className="tier-coming">{t('tierComing')}</p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function PromoCard({ tierNo }: { tierNo: number }) {
  const s = useStore()
  const { t, tf, push } = useApp()
  const tier = TIERS.find((x) => x.no === tierNo)!
  const open = isPromoOpen(s, tierNo)
  const done = s.passedTiers.includes(tierNo)
  const pool = tier.rounds.flatMap((r) => r.words)
  return (
    <button
      className={`promo-card ${open ? '' : 'locked'} ${done ? 'passed' : ''}`}
      disabled={!open}
      onClick={() =>
        push({ name: 'quiz', kind: 'promo', tierNo, pool, words: shuffle(pool).slice(0, PROMO_QUESTIONS), label: `${t('promo')} · ${tf('tierN', tierNo)}` })
      }
    >
      <span className="promo-icon"><Icon name="trophy" size={24} /></span>
      <span className="round-body">
        <span className="round-title">
          {t('promo')} <span className="round-sub">{tf('questions', PROMO_QUESTIONS)}</span>
        </span>
        <span className="round-hint">{done ? t('promoted') : open ? t('promoDesc') : t('promoLockedHint')}</span>
      </span>
      {done ? <span className="chip chip-good"><Icon name="check" size={14} /></span> : !open ? <Icon name="lock" size={18} /> : null}
    </button>
  )
}
