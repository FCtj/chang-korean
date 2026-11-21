import { TIERS, PACKS, PROMO_QUESTIONS, type Round } from '../data/words'
import { useApp } from '../ctx'
import { currentTierNo, isPromoOpen, isQuizOpen, isRoundOpen, isStepKnown, isTierOpen, nextUnit, recommendedPacks, stepKnownCount, stepOf, stepSizesOf, stepsDone, todayKey, useStore, STAMPS_PER_TICKET } from '../store'
import { Avatar, Elephant, Icon, ProgressBar, TIER_ACC, pastel, shuffle, useCountUp } from '../ui'
import { useAuth } from '../backend'
import { GenderPicker } from './ProfileFields'

export default function Home() {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const tierNo = currentTierNo(s)
  const tier = TIERS.find((x) => x.no === tierNo)!
  const cur = nextUnit(s)
  const recPacks = recommendedPacks(s)
  const otherPacks = PACKS.filter((p) => !recPacks.includes(p))
  const stampedToday = s.stamps.includes(todayKey())
  const cardStamps = s.stamps.length % STAMPS_PER_TICKET
  const auth = useAuth()
  const [pts, bump] = useCountUp(s.monthPoints)

  return (
    <div className="page">
      <header className="home-head">
        <span className="head-avatar">
          <Elephant size={68} acc={TIER_ACC[tier.no - 1]} />
          {(auth.me?.avatar || s.photo) && (
            <span className="head-photo">
              <Avatar src={auth.me?.avatar || s.photo} name={auth.me?.name ?? s.nickname} size={30} />
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
          <span className={bump ? 'pill pill-butter num bump' : 'pill pill-butter num'}>⭐ {pts.toLocaleString()}</span>
          {s.streak > 0 && <span className="pill pill-peach num">🔥 {tf('streak', s.streak)}</span>}
        </div>
      </header>

      {!s.gender && (
        <section className="panel theme-card">
          <h2 className="h3">✨ {t('themeCardTitle')}</h2>
          <p className="note">{t('themeCardSub')}</p>
          <GenderPicker />
        </section>
      )}

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
        const sizes = stepSizesOf(cur)
        const step = Math.min(stepOf(s, cur.id), sizes.length)
        const done = stepKnownCount(s, cur, step)
        const need = cur.words.length
        const next5 = cur.words.filter((w) => !isStepKnown(s, w, step)).slice(0, 5)
        return (
          <button className="continue" onClick={() => push({ name: 'player', roundId: cur.id, startChunk: -1 })}>
            <span className="continue-deco" aria-hidden="true">{s.theme === 'carbon' ? '✦ ✦ ✦' : '✦ ♥ ✦'}</span>
            <span className="continue-top">
              <span className="continue-label">
                {cur.pack ? `${t('packsTitle')} · ` : ''}
                {tf('stepName', step)} · {tf('stepSize', sizes[step - 1])}
              </span>
              <span className="continue-stamp">{stampedToday ? `☕ ${t('todayDone')}` : `☕ ${t('todayTodo')}`}</span>
            </span>
            <span className="continue-title">
              {cur.pack ? `${cur.pack.icon} ${cur.title[ui]}` : `${tf('roundN', cur.no)} · ${cur.title[ui]}`}
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

      <section className="packs">
        <div className="packs-head">
          <h2 className="h3">⚡ {t('packsTitle')}</h2>
          <span className="note">{t('packsSub')}</span>
        </div>
        <div className="pack-grid">
          {recPacks.map((p, i) => (
            <PackCard key={p.id} pack={p} badge={i === 0 ? t('startFirst') : t('recommended')} />
          ))}
        </div>
        {otherPacks.length > 0 && (
          <details className="more-packs">
            <summary>{t('morePacks')}</summary>
            <div className="pack-grid">
              {otherPacks.map((p) => (
                <PackCard key={p.id} pack={p} />
              ))}
            </div>
          </details>
        )}
      </section>

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
                    const vd = unitProgress(s, r)
                    const vn = 1
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
                                  !passed && <span className="chip tiny num">{tf('stepName', Math.min(st, stepSizesOf(r).length))}</span>
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

/** STEP 진행률 0~1 (STEP마다 전체 단어 수만큼 칸) */
function unitProgress(s: ReturnType<typeof useStore>, r: Round): number {
  const n = stepSizesOf(r).length
  if (stepsDone(s, r.id)) return 1
  const st = stepOf(s, r.id)
  return ((st - 1) * r.words.length + stepKnownCount(s, r, st)) / (n * r.words.length)
}

function PackCard({ pack, badge }: { pack: Round; badge?: string }) {
  const s = useStore()
  const { t, ui, push } = useApp()
  const done = stepsDone(s, pack.id)
  const pct = unitProgress(s, pack)
  return (
    <button className={done ? 'pack-card done' : 'pack-card'} onClick={() => push({ name: 'round', roundId: pack.id })}>
      {done ? <span className="pack-badge done">✓ {t('done')}</span> : badge && <span className="pack-badge">{badge}</span>}
      <span className="pack-icon" aria-hidden="true">{pack.pack!.icon}</span>
      <span className="pack-title">{pack.title[ui]}</span>
      <span className="pack-desc">{pack.pack!.desc[ui]}</span>
      <span className="pack-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(pct * 100)}%` }} />
      </span>
    </button>
  )
}
