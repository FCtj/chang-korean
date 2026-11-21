import { TIERS, PROMO_QUESTIONS } from '../data/words'
import { useApp } from '../ctx'
import { currentRound, currentTierNo, isPromoOpen, isQuizOpen, isRoundOpen, isTierOpen, todayKey, useStore, viewProgress, STAMPS_PER_TICKET } from '../store'
import { Elephant, Icon, ProgressBar, TIER_ACC, pastel, shuffle } from '../ui'

export default function Home() {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const tierNo = currentTierNo(s)
  const tier = TIERS.find((x) => x.no === tierNo)!
  const cur = currentRound(s)
  const stampedToday = s.stamps.includes(todayKey())
  const cardStamps = s.stamps.length % STAMPS_PER_TICKET

  return (
    <div className="page">
      <header className="home-head">
        <Elephant size={68} acc={TIER_ACC[tier.no - 1]} />
        <div className="home-head-text">
          <div className="home-hi">{tf('hi', s.nickname)}</div>
          <div className="tier-tag">
            {tf('tierN', tier.no)} · {tier.name[ui]}
          </div>
        </div>
        <div className="pills">
          <span className="pill pill-butter num">⭐ {s.monthPoints.toLocaleString()}</span>
          {s.streak > 0 && <span className="pill pill-peach num">🔥 {tf('streak', s.streak)}</span>}
        </div>
      </header>

      {!s.placementDone && (
        <button className="level-card" onClick={() => push({ name: 'placement' })}>
          <Elephant size={56} acc="grad" />
          <span className="level-card-body">
            <span className="level-card-title">✏️ {t('levelTest')}</span>
            <span className="level-card-text">{t('levelPrompt')}</span>
          </span>
          <Icon name="next" size={22} />
        </button>
      )}

      {cur && (() => {
        const [done, need] = viewProgress(s, cur)
        const startChunk = s.lastChunk[cur.id] ?? 0
        return (
          <button className="continue" onClick={() => push({ name: 'player', roundId: cur.id, startChunk })}>
            <span className="continue-deco" aria-hidden="true">✦ ♥ ✦</span>
            <span className="continue-top">
              <span className="continue-label">{t('continueStudy')}</span>
              <span className="continue-stamp">{stampedToday ? `☕ ${t('todayDone')}` : `☕ ${t('todayTodo')}`}</span>
            </span>
            <span className="continue-title">
              {tf('roundN', cur.no)} · {cur.title[ui]}
            </span>
            <span className="continue-row">
              <span className="continue-emojis" aria-hidden="true">
                {cur.words.slice(startChunk * 5, startChunk * 5 + 5).map((w) => (
                  <span key={w.id}>{w.emoji}</span>
                ))}
              </span>
              <span className="play-dot" aria-hidden="true">
                <Icon name="play" size={26} />
              </span>
            </span>
            <span className="continue-foot">
              <ProgressBar value={done} max={need} tone="butter" />
              <span className="num">{tf('startFrom', startChunk + 1)}</span>
            </span>
          </button>
        )
      })()}

      <div className="mini-stamps" aria-label={t('stampCard')}>
        <span className="mini-stamps-label">☕ {t('stampCard')}</span>
        <span className="num mini-stamps-count">
          {cardStamps}/{STAMPS_PER_TICKET}
        </span>
        <span className="mini-cups" aria-hidden="true">
          {Array.from({ length: STAMPS_PER_TICKET }, (_, i) => (
            <span key={i} className={i < cardStamps ? 'cup on' : 'cup'}>
              {i < cardStamps ? '☕' : ''}
            </span>
          ))}
        </span>
      </div>

      <div className="path">
        {TIERS.map((tr) => {
          const open = isTierOpen(s, tr.no)
          const ready = tr.rounds.length > 0
          const done = s.passedTiers.includes(tr.no)
          return (
            <section key={tr.no} className={`tier ${open ? 'open' : 'closed'}`}>
              <div className="tier-head">
                <Elephant size={46} acc={TIER_ACC[tr.no - 1]} tone={open ? 'pink' : 'grey'} />
                <div className="tier-head-text">
                  <div className="tier-no">{tf('tierN', tr.no)}</div>
                  <h2 className="tier-name">{tr.name[ui]}</h2>
                </div>
                {done ? (
                  <span className="chip chip-mint">
                    <Icon name="check" size={14} /> {t('passed')}
                  </span>
                ) : !ready ? (
                  <span className="chip">{t('comingSoon')}</span>
                ) : !open ? (
                  <span className="chip">
                    <Icon name="lock" size={14} /> {t('locked')}
                  </span>
                ) : null}
              </div>

              {ready ? (
                <ol className="rounds">
                  {tr.rounds.map((r, i) => {
                    const ro = isRoundOpen(s, r)
                    const passed = s.passedRounds.includes(r.id)
                    const [vd, vn] = viewProgress(s, r)
                    return (
                      <li key={r.id}>
                        <button className={`round-card ${ro ? '' : 'locked'} ${passed ? 'passed' : ''}`} disabled={!ro} onClick={() => push({ name: 'round', roundId: r.id })}>
                          <span className={`round-no num c-${pastel(i + tr.no)}`}>{passed ? <Icon name="check" size={20} /> : ro ? r.no : <Icon name="lock" size={18} />}</span>
                          <span className="round-body">
                            <span className="round-title">{tf('roundN', r.no)}</span>
                            <span className="round-sub">{r.title[ui]}</span>
                            {s.placedRounds.includes(r.id) ? (
                              <span className="round-prog">
                                <span className="chip chip-mint tiny">✓ {t('placedBadge')}</span>
                              </span>
                            ) : ro ? (
                              <span className="round-prog">
                                <ProgressBar value={passed ? vn : vd} max={vn} tone={passed ? 'mint' : 'pink'} />
                                {isQuizOpen(s, r.id) && !passed && <span className="chip chip-pink tiny">{t('newBadge')}</span>}
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
                  {isPromoOpen(s, tr.no) && (
                    <li>
                      <button
                        className={done ? 'promo-card passed' : 'promo-card'}
                        onClick={() => {
                          const pool = tr.rounds.flatMap((r) => r.words)
                          push({ name: 'quiz', kind: 'promo', tierNo: tr.no, pool, words: shuffle(pool).slice(0, PROMO_QUESTIONS), label: `${t('promo')} · ${tf('tierN', tr.no)}` })
                        }}
                      >
                        <span className="promo-icon" aria-hidden="true">🏆</span>
                        <span className="round-body">
                          <span className="round-title">{t('promo')}</span>
                          <span className="round-sub">{done ? t('promoted') : t('promoDesc')}</span>
                        </span>
                      </button>
                    </li>
                  )}
                </ol>
              ) : (
                <p className="tier-coming">
                  {tr.topics[ui]} · {t('tierComing')}
                </p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
