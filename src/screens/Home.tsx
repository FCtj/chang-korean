import { useEffect, useState } from 'react'
import { ED_INFO, EDITION, IS_KO } from '../edition'
import { hasVoice, openVoiceInstall } from '../audio'
import { Capacitor } from '@capacitor/core'
import { TIERS, PACKS, PROMO_QUESTIONS, type Round } from '../data/words'
import { useApp } from '../ctx'
import { courseUnits, currentCourse, currentJobTrack, setCourse, unitPassed, update, currentTierNo, isPromoOpen, isQuizOpen, isRoundOpen, isStepKnown, isTierOpen, nextUnit, recommendedPacks, stepKnownCount, stepOf, stepSizesOf, stepsDone, todayKey, useStore, STAMPS_PER_TICKET } from '../store'
import { Avatar, Elephant, Icon, ProgressBar, TIER_ACC, pastel, shuffle, useCountUp } from '../ui'
import { backendReady, useAuth } from '../backend'
import { GenderPicker } from './ProfileFields'
import { findTrack } from '../data/tracks'
import { COURSES, JOB_TRACKS, TOPIK_LEVELS, findCourse, jobTrack, topikTrack, type CourseId } from '../data/courses'
import { nextShopItem } from '../data/shop'
import { COMMUNITY_ENABLED, POINTS_ENABLED, SIMPLE_MODE } from '../config'
import UnitList, { MockCard, unitProgress } from './UnitList'
import { CourseSheet, OtherCourses, courseProgress } from './CoursePicker'
import { RewardTicker } from './RecentRewards'
import { MASCOT_EMOJI, RANK_ANIMALS, mascotOf, tierName } from '../mascot'
import { RankAnimal } from '../rankAnimals'

export default function Home() {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const tierNo = currentTierNo(s)
  const tier = TIERS.find((x) => x.no === tierNo)!
  const cur = nextUnit(s)
  const course = currentCourse(s)
  const mascot = mascotOf(s.country)
  const [sheet, setSheet] = useState(false)
  const stampedToday = s.stamps.includes(todayKey())
  const cardStamps = s.stamps.length % STAMPS_PER_TICKET
  const auth = useAuth()
  const [pts, bump] = useCountUp(SIMPLE_MODE ? s.totalPoints : s.monthPoints)

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
          {IS_KO && <div className="tier-tag">
            <RankAnimal tier={tier.no} size={24} className="tier-tag-animal" />
            {tf('tierN', tier.no)} · {tierName(tier, mascot)![ui]}
          </div>}
        </div>
        <div className="pills">
          {POINTS_ENABLED && <span className={bump ? 'pill pill-butter num bump' : 'pill pill-butter num'}>⭐ {pts.toLocaleString()}</span>}
          {s.streak > 0 && <span className="pill pill-peach num">🔥 {tf('streak', s.streak)}</span>}
        </div>
      </header>
      {SIMPLE_MODE && POINTS_ENABLED && <WalletCard />}

      {IS_KO && backendReady && auth.status === 'in' && s.profileConsent === null && (
        <section className="panel consent-card">
          <h2 className="h3">🔒 {t('consentTitle')}</h2>
          <p className="note">{t('consentBody')}</p>
          <div className="consent-row">
            <button className="btn btn-pink sm" onClick={() => update((st) => ({ ...st, profileConsent: 'yes' }))}>
              {t('consentYes')}
            </button>
            <button className="btn btn-soft sm" onClick={() => update((st) => ({ ...st, profileConsent: 'no' }))}>
              {t('consentNo')}
            </button>
          </div>
        </section>
      )}
      {!SIMPLE_MODE && !s.gender && (
        <section className="panel theme-card">
          <h2 className="h3">✨ {t('themeCardTitle')}</h2>
          <p className="note">{t('themeCardSub')}</p>
          <GenderPicker />
        </section>
      )}

      <CourseHead onChange={() => setSheet(true)} />

      {course === 'basic' && !s.placementDone && (
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
                {cur.track ? `${findTrack(cur.track)?.title[ui] ?? ''} · ` : cur.pack ? `${t('packsTitle')} · ` : ''}
                {tf('stepName', step)} · {tf('stepSize', sizes[step - 1])}
              </span>
              <span className="continue-stamp">
                {POINTS_ENABLED ? (stampedToday ? `☕ ${t('todayDone')}` : `☕ ${t('todayTodo')}`) : stampedToday ? `✅ ${t('todayDonePlain')}` : `📖 ${t('todayTodoPlain')}`}
              </span>
            </span>
            <span className="continue-title">
              {cur.track ? `${cur.pack!.icon} ${tf('unitN', cur.no)} · ${cur.title[ui]}` : cur.pack ? `${cur.pack.icon} ${cur.title[ui]}` : `${tf('roundN', cur.no)} · ${cur.title[ui]}`}
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
      {!cur && courseUnits(s, course).length > 0 && <p className="panel center-panel">{t('courseDone')}</p>}
      {/* 음성 안내는 '이어하기' 아래 — 가장 많이 누르는 이어하기 카드가 먼저 보이게 */}
      {!IS_KO && <VoiceHint />}

      {course === 'basic' ? <BasicBody /> : course === 'topik' ? <TopikBody /> : course === 'job' ? <JobBody /> : <TrackBody id={course} />}

      {(IS_KO || COURSES.length > 1) && <OtherCourses />}

      {!SIMPLE_MODE && POINTS_ENABLED && (
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
      )}
      {SIMPLE_MODE && COMMUNITY_ENABLED && (
        <button className="community-card" onClick={() => push({ name: 'community' })}>
          <span aria-hidden="true">👥</span> {t('communityCard')} →
        </button>
      )}
      {sheet && <CourseSheet onClose={() => setSheet(false)} />}
    </div>
  )
}

/** 내 코스: 지금 공부하는 코스 + 바꾸기 */
function CourseHead({ onChange }: { onChange: () => void }) {
  const s = useStore()
  const { t, tf, ui } = useApp()
  const id = currentCourse(s)
  const c = findCourse(id)
  const lv = id === 'topik' ? topikTrack(s.topikLevel) : id === 'job' ? jobTrack(currentJobTrack(s)) : undefined
  const { done, total } = lv ? { done: lv.units.filter((u) => unitPassed(s, u.id)).length, total: lv.units.length } : courseProgress(s, id)
  return (
    <section className="course-head">
      <span className="course-head-icon" aria-hidden="true">
        {id === 'basic' ? MASCOT_EMOJI[mascotOf(s.country)] : c.icon}
      </span>
      <span className="course-head-body">
        <span className="course-head-label">{t('myCourse')}</span>
        <span className="course-head-title">{c.title[ui]}</span>
        <span className="course-head-meta num">
          {id === 'topik' ? `${tf('topikLevel', s.topikLevel)} · ` : id === 'job' && lv ? `${lv.icon} ${lv.title[ui]} · ` : ''}
          {total ? tf('unitsDone', done, total) : t('comingSoon')}
        </span>
        <span className="pack-bar" aria-hidden="true">
          <span style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
        </span>
      </span>
      {(IS_KO || COURSES.length > 1) && (
        <button className="course-change" onClick={onChange}>
          <span aria-hidden="true">⇄</span> {t('changeCourse')}
        </button>
      )}
    </section>
  )
}

/** 목적 트랙 코스 (일자리 · 식당 · 국적) */
function TrackBody({ id }: { id: CourseId }) {
  const { t } = useApp()
  const track = findTrack(id)
  if (!track) return null
  return (
    <section className="course-units">
      {id === 'citizen' && <MockCard />}
      {track.units.length ? <UnitList track={track} /> : <p className="panel center-panel">{t('levelSoon')}</p>}
    </section>
  )
}

/** 일·알바 코스: 일 종류 고르기(EPS 단어집 · 일자리 · 식당 · 편의점·카페 · 호텔 · 마사지샵 · 가이드) + 그 트랙의 단원 */
function JobBody() {
  const s = useStore()
  const { t, ui } = useApp()
  const cur = currentJobTrack(s)
  const track = jobTrack(cur)
  return (
    <section className="course-units">
      <div className="job-tracks" role="tablist" aria-label={findCourse('job').title[ui]}>
        {JOB_TRACKS.map((tr) => {
          const total = tr.units.length
          const done = tr.units.filter((u) => unitPassed(s, u.id)).length
          const on = tr.id === cur
          return (
            <button key={tr.id} role="tab" aria-selected={on} className={`job-tr ${on ? 'on' : ''}`} onClick={() => setCourse('job', tr.id)}>
              <span className="job-tr-icon" aria-hidden="true">
                {tr.icon}
              </span>
              <span className="job-tr-name">{tr.title[ui]}</span>
              <span className="job-tr-sub num">
                {done}/{total}
              </span>
            </button>
          )
        })}
      </div>
      {track && <p className="note">{track.desc[ui]}</p>}
      {track?.units.length ? <UnitList track={track} /> : <p className="panel center-panel">{t('levelSoon')}</p>}
    </section>
  )
}

/** TOPIK 코스: 1~6급 고르기 + 그 급의 단원 */
function TopikBody() {
  const s = useStore()
  const { t, tf, ui } = useApp()
  const track = topikTrack(s.topikLevel)
  return (
    <section className="course-units">
      <div className="topik-levels" role="tablist" aria-label="TOPIK">
        {TOPIK_LEVELS.map((n) => {
          const tr = topikTrack(n)
          const total = tr?.units.length ?? 0
          const done = tr ? tr.units.filter((u) => unitPassed(s, u.id)).length : 0
          const on = n === s.topikLevel
          return (
            <button key={n} role="tab" aria-selected={on} className={`topik-lv ${on ? 'on' : ''} ${total ? '' : 'soon'} ${n <= 2 ? 'lv-i' : 'lv-ii'}`} onClick={() => setCourse('topik', n)}>
              <span className="topik-lv-no">{tf('topikLevel', n)}</span>
              <span className="topik-lv-sub num">{total ? `${done}/${total}` : t('comingSoon')}</span>
            </button>
          )
        })}
      </div>
      <div className="topik-legend" aria-hidden="true">
        <span className="lv-i">{IS_KO ? 'TOPIK I · 1–2' : ED_INFO.legend[0]}</span>
        <span className="lv-ii">{IS_KO ? 'TOPIK II · 3–6' : ED_INFO.legend[1]}</span>
      </div>
      {track && <p className="note">{track.desc[ui]}</p>}
      {track?.units.length ? <UnitList track={track} /> : <p className="panel center-panel">{t('levelSoon')}</p>}
    </section>
  )
}

/** 계급 동물 사다리: 🐣 → 🐰 → 🦊 → 🐯 → 🐲 (지금 계급 강조, 앞으로 갈 계급은 회색) */
function RankLadder() {
  const s = useStore()
  const { t, tf, ui } = useApp()
  const cur = currentTierNo(s)
  return (
    <section className="rank-ladder" aria-label={t('rankLadder')}>
      <h2 className="h3">🏅 {t('rankLadder')}</h2>
      <ol className="rank-steps">
        {RANK_ANIMALS.map((a, i) => {
          const no = i + 1
          const state = s.passedTiers.includes(no) ? 'done' : no === cur ? 'now' : no < cur ? 'done' : 'next'
          return (
            <li key={no} className={`rank-step ${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <RankAnimal tier={no} size={state === 'now' ? 56 : 44} locked={state === 'next'} />
              <span className="rank-step-no">{tf('tierN', no)}</span>
              <span className="rank-step-name">{a.name[ui]}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** 기초 코스: 꼭 필요한 단어팩 + 1~5계급 */
function BasicBody() {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const recPacks = recommendedPacks(s)
  const packs = [...recPacks, ...PACKS.filter((p) => !recPacks.includes(p))]
  return (
    <>
      <section className="packs">
        <div className="packs-head">
          <h2 className="h3">⚡ {t('packsTitle')}</h2>
          <span className="note">{t('packsSub')}</span>
        </div>
        <div className="pack-grid">
          {packs.map((p, i) => (
            <PackCard key={p.id} pack={p} badge={i === 0 ? t('startFirst') : recPacks.includes(p) ? t('recommended') : undefined} />
          ))}
        </div>
      </section>

      <RankLadder />
      <div className="path">
        {TIERS.map((tr) => {
          const open = isTierOpen(s, tr.no)
          const ready = tr.rounds.length > 0
          const done = s.passedTiers.includes(tr.no)
          return (
            <section key={tr.no} className={`tier ${open ? 'open' : 'closed'}`}>
              <div className="tier-head">
                <RankAnimal tier={tr.no} size={54} locked={!open} />
                <div className="tier-head-text">
                  <div className="tier-no">{tf('tierN', tr.no)}</div>
                  <h2 className="tier-name">
                    {tierName(tr, mascotOf(s.country))![ui]} <span className="chip tiny tier-level">{tr.level[ui]}</span>
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
    </>
  )
}

/** 간단 모드: 내 포인트 + 다음 교환 목표 */
function WalletCard() {
  const s = useStore()
  const { t, tf, ui, home } = useApp()
  const next = nextShopItem(s.totalPoints)
  const pct = Math.min(100, Math.round((s.totalPoints / next.points) * 100))
  return (
    <button className="wallet-card" onClick={() => home('points')}>
      <span className="wallet-top">
        <span className="wallet-label">💰 {t('myPoints')}</span>
        <span className="wallet-shop">🛍️ {t('seeShop')} →</span>
      </span>
      <span className="wallet-points num">{tf('pointsN', s.totalPoints)}</span>
      <span className="wallet-goal">
        <span aria-hidden="true">{next.icon}</span> {tf('toReward', next.name[ui], Math.max(0, next.points - s.totalPoints))}
      </span>
      <span className="wallet-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <RewardTicker />
    </button>
  )
}

function PackCard({ pack, badge }: { pack: Round; badge?: string }) {
  const s = useStore()
  const { t, ui, push } = useApp()
  const done = unitPassed(s, pack.id)
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

/** 일본어·영어판: 이 기기에 배울 말 음성(TTS)이 없으면 설치 안내 (한 번 닫으면 다시 안 보임) */
function VoiceHint() {
  const KEY = 'chang-ed-voice-hint'
  const [missing, setMissing] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (hidden) return
    let alive = true
    const check = () => hasVoice('ko').then((v) => alive && setMissing(!v))
    // 음성 목록이 늦게 오는 브라우저가 있어 한 번 더 확인
    const t = setTimeout(check, 1500)
    check()
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [hidden])
  if (hidden || !missing) return null
  const close = () => {
    setHidden(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* 무시 */
    }
  }
  return (
    <section className="panel voice-hint" role="status">
      <p>
        🔇 이 기기에 <b>{ED_INFO.lang} 음성</b>이 없어서 발음 소리가 안 날 수 있어요.
      </p>
      {EDITION === 'lo' ? (
        // 라오스어 음성은 대부분의 휴대폰(구글·애플 기본 음성)에 없음 → 한글 읽기로 안내
        <p className="note">
          라오스어 음성은 대부분의 휴대폰에 들어 있지 않아요. 카드 아래 <b>한글 읽기</b>(예: ສະບາຍດີ → 사바이디)를 보고 따라 읽어 주세요. 원어민 녹음 소리는 준비 중이에요.
        </p>
      ) : (
        <p className="note">
          안드로이드: 설정 → 일반 관리(또는 접근성) → 텍스트 음성 변환 → Google 음성 엔진 → 음성 데이터 설치에서 {ED_INFO.lang}를 받아 주세요.
          <br />
          iPhone: 설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성에서 {ED_INFO.lang} 음성을 받아 주세요.
        </p>
      )}
      <div className="quick-row">
        {Capacitor.isNativePlatform() && EDITION !== 'lo' && (
          <button className="btn btn-soft sm" onClick={() => openVoiceInstall()}>
            음성 설치
          </button>
        )}
        <button className="link-btn" onClick={close}>
          닫기
        </button>
      </div>
    </section>
  )
}
