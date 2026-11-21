import { TIERS, PROMO_QUESTIONS } from '../data/words'
import { useApp } from '../ctx'
import { currentRound, currentTierNo, isPromoOpen, isQuizOpen, isRoundOpen, isStepKnown, isTierOpen, stepKnownCount, stepOf, todayKey, useStore, STAMPS_PER_TICKET, STEP_SIZES } from '../store'
import { Avatar, Elephant, Icon, ProgressBar, TIER_ACC, pastel, shuffle } from '../ui'
import { useAuth } from '../backend'

export default function Home() {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const tierNo = currentTierNo(s)
  const tier = TIERS.find((x) => x.no === tierNo)!
  const cur = currentRound(s)
  const stampedToday = s.stamps.includes(todayKey())
  const cardStamps = s.stamps.length % STAMPS_PER_TICKET
  const auth = useAuth()

  return (
    <div className="page">
      <header className="home-head">
        <span className="head-avatar">
          <Elephant size={68} acc={TIER_ACC[tier.no - 1]} />
          {auth.me && (
            <span className="head-photo">
              <Avatar src={auth.me.avatar} name={auth.me.name} size={30} />
            </span>
          )}
        </span>
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
        const step = Math.min(stepOf(s, cur.id), 3)
        const done = stepKnownCount(s, cur, step)
        const need = cur.words.length
        const next5 = cur.words.filter((w) => !isStepKnown(s, w, step)).slice(0, 5)
        return (
          <button className="continue" onClick={() => push({ name: 'player', roundId: cur.id, startChunk: -1 })}>
            <span className="continue-deco" aria-hidden="true">✦ ♥ ✦</span>
            <span className="continue-top">
              <span className="continue-label">
                {tf('stepName', step)} · {tf('stepSize', STEP_SIZES[step - 1])}
              </span>
              <span className="continue-stamp">{stampedToday ? `☕ ${t('todayDone')}` : `☕ ${t('todayTodo')}`}</span>
            </span>
            <span className="continue-title">
              {tf('roundN', cur.no)} · {cur.title[ui]}
            </span>
            <span className="continue-row">
              <span className="continue-emojis" aria-hidden="true">
                {next5.map((w) => (
                  <span key={w.id}>{w.emoji}</span>
                ))}
              </span>
              <span className="play-dot" aria-hidden="true">
                <Icon name="play" size={26} />
              </span>
            </span>
            <span className="continue-foot">
              <ProgressBar value={done} max={need} tone="butter" />
              <span className="num">{tf('knownOf', done, need)}</span>
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
                  <h2 className="tier-name">
                    {tr.name[ui]} <span className="chip tiny tier-level">{tr.level[ui]}</span>
                  </h2>
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
                    const st = stepOf(s, r.id)
                    const vn = r.words.length * 3
                    const vd = st >= 4 ? vn : (st - 1) * r.words.length + stepKnownCount(s, r, st)
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
                                {isQuizOpen(s, r.id) && !passed ? (
                                  <span className="chip chip-pink tiny">{t('newBadge')}</span>
                                ) : (
                                  !passed && <span className="chip tiny num">{tf('stepName', Math.min(st, 3))}</span>
                                )}
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
