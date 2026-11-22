// 처음 시작: 한국어 실력 테스트 8문제 (쉬운 단어 → TOPIK 1~6급, 점점 어려워짐)
// 표지 → 문제 (문제 번호 · 진행 막대 · 20초 · 몰라요) → 결과 (점수 · 내 수준 · 정답 확인 · 추천 코스)
// → 환영 선물 → 포인트 교환소 미리보기 → 코스 고르기 (추천 코스 표시)
// 포인트(맞힌 문제 × 10 + 환영 선물)는 끝까지 마쳤을 때 한 번에 들어감
import { EDITION, IS_KO, levelLabel, levelName } from '../edition'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { PACKS, ROUNDS, translation, type Word } from '../data/words'
import { SHOP } from '../data/shop'
import { findCourse, topikTrack, type CourseId } from '../data/courses'
import { POINTS_ENABLED, WELCOME_POINTS } from '../config'
import { finishIntro, setCourse, useStore, MIN_ANSWER_MS } from '../store'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { burstFrom, fireworks, floatFrom, sparkleRain } from '../fx'
import { backendReady, signInWithFacebook, useAuth } from '../backend'
import { Elephant, Icon, Pron, shuffle } from '../ui'
import CoursePicker from './CoursePicker'

const PER_RIGHT = 10
const SECONDS = 20
const PER_LEVEL = 2 // 난이도마다 2문제 → 8문제

type Kind = 'meaning' | 'korean'
interface Q {
  word: Word
  kind: Kind
  options: Word[]
}
type Answer = Word | 'idk' | 'timeout'

const plain = (ws: Word[]) => ws.filter((w) => w.kind !== 'phrase' && w.ko.length <= (EDITION === 'en' ? 14 : 7) && !/[?!.。？]/.test(w.ko))
const topikWords = (...lv: number[]) => plain(lv.flatMap((n) => topikTrack(n)?.units.flatMap((u) => u.words) ?? []))

/** 난이도 4단계 × 2문제. 홀수 번째는 '뜻 고르기', 짝수 번째는 '한국어 고르기' */
function makeTest(): Q[] {
  const levels: Word[][] = IS_KO
    ? [plain([...PACKS[0].words, ...ROUNDS.filter((r) => r.tier === 1).flatMap((r) => r.words)]), topikWords(1, 2), topikWords(3, 4), topikWords(5, 6)]
    : [topikWords(1), topikWords(2), topikWords(3), topikWords(4, 5)]
  const out: Q[] = []
  levels.forEach((pool, li) => {
    if (pool.length < 8) return
    const picks = shuffle(pool).slice(0, PER_LEVEL)
    picks.forEach((word, k) => {
      const kind: Kind = (li * PER_LEVEL + k) % 2 === 0 ? 'meaning' : 'korean'
      const seen = new Set([translation(word), word.emoji, word.ko])
      const opts: Word[] = []
      for (const w of shuffle(pool)) {
        if (opts.length === 3) break
        if (seen.has(translation(w)) || seen.has(w.emoji) || seen.has(w.ko)) continue
        seen.add(translation(w))
        seen.add(w.emoji)
        seen.add(w.ko)
        opts.push(w)
      }
      out.push({ word, kind, options: shuffle([word, ...opts]) })
    })
  })
  return out
}

/** 맞힌 개수 → 수준 · 추천 코스 */
function levelOf(right: number, total: number): { key: 'lvBeginner' | 'lvElementary' | 'lvIntermediate' | 'lvAdvanced'; course: CourseId; topik?: number } {
  const r = (right / Math.max(1, total)) * 8
  if (!IS_KO) return r <= 2 ? { key: 'lvBeginner', course: 'topik', topik: 1 } : r <= 4 ? { key: 'lvElementary', course: 'topik', topik: 2 } : r <= 6 ? { key: 'lvIntermediate', course: 'topik', topik: 3 } : { key: 'lvAdvanced', course: 'topik', topik: 4 }
  if (r <= 2) return { key: 'lvBeginner', course: 'basic' }
  if (r <= 4) return { key: 'lvElementary', course: 'topik', topik: 1 }
  if (r <= 6) return { key: 'lvIntermediate', course: 'topik', topik: 3 }
  return { key: 'lvAdvanced', course: 'topik', topik: 5 }
}

export default function Intro() {
  const s = useStore()
  const auth = useAuth()
  const { t, tf, ui } = useApp()
  const test = useMemo(makeTest, [])
  const [stage, setStage] = useState<'cover' | 'test' | 'result' | 'gift' | 'shop' | 'course'>('cover')
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<Answer | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  // 포인트를 받은 문제 (맞혔고, 1초 넘게 생각했을 때만)
  const [paid, setPaid] = useState<boolean[]>([])
  const shownAt = useRef(Date.now())
  const optRefs = useRef<(HTMLButtonElement | null)[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const q = test[qi]
  const right = answers.filter((a, i) => a !== 'idk' && a !== 'timeout' && a.id === test[i].word.id).length
  const earned = paid.filter(Boolean).length * PER_RIGHT
  const total = s.totalPoints + earned + WELCOME_POINTS
  const lv = levelOf(right, test.length)

  // 문제가 바뀌면: '뜻 고르기' 는 발음을 들려주고, 20초 시계 시작
  useEffect(() => {
    if (stage !== 'test' || !q) return
    if (q.kind === 'meaning') speakWord(q.word)
    shownAt.current = Date.now()
    timer.current = setTimeout(() => answer('timeout'), SECONDS * 1000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, qi])

  useEffect(() => {
    if (stage !== 'gift') return
    sfx.levelUp()
    const tm = setTimeout(() => {
      fireworks(8)
      sparkleRain(36)
    }, 200)
    return () => clearTimeout(tm)
  }, [stage])

  function answer(a: Answer) {
    if (picked !== null || !q) return
    if (timer.current) clearTimeout(timer.current)
    setPicked(a)
    const ok = a !== 'idk' && a !== 'timeout' && a.id === q.word.id
    const pay = ok && Date.now() - shownAt.current >= MIN_ANSWER_MS
    if (ok) {
      sfx.correct()
      const el = optRefs.current[q.options.indexOf(a as Word)]
      if (pay && POINTS_ENABLED) floatFrom(el, `+${PER_RIGHT}P`, 'points')
      burstFrom(el, { count: 12 })
    } else sfx.wrong()
    setTimeout(
      () => {
        setAnswers((xs) => [...xs, a])
        setPaid((xs) => [...xs, pay])
        setPicked(null)
        if (qi + 1 < test.length) setQi(qi + 1)
        else setStage('result')
      },
      ok ? 900 : 1500,
    )
  }

  // ───────── 표지 ─────────
  if (stage === 'cover') {
    return (
      <div className="app">
        <main className="intro test-cover">
          <Elephant size={120} acc="grad" mood="happy" className="float" />
          <span className="chip chip-butter">📝 TEST</span>
          <h1 className="h1 center">{t('testCover')}</h1>
          <p className="test-cover-sub">{t(POINTS_ENABLED ? 'testCoverSub' : 'testCoverSubPlain')}</p>
          <ol className="test-steps" aria-hidden="true">
            {['🌱', '📘', '📗', '📕'].map((icon, i) => (
              <li key={i}>
                <span className="test-step-icon">{icon}</span>
                <span className="test-step-label">{!IS_KO ? (i < 3 ? levelLabel(i + 1) : `${levelLabel(4)}·${levelLabel(5)}`) : i === 0 ? t('lvBeginner') : `TOPIK ${i * 2 - 1}–${i * 2}`}</span>
              </li>
            ))}
          </ol>
          <p className="note center">{t('testCoverNote')}</p>
          <button className="btn btn-pink btn-block btn-big" onClick={() => setStage('test')}>
            ▶ {t('testStart')}
          </button>
        </main>
      </div>
    )
  }

  // ───────── 문제 ─────────
  if (stage === 'test' && q) {
    const isRight = (o: Word) => o.id === q.word.id
    return (
      <div className="app">
        <main className="intro test-page">
          <div className="test-head">
            <span className="test-qn num">{tf('qN', qi + 1, test.length)}</span>
            {POINTS_ENABLED && <span className="pill pill-butter num">💰 {tf('pointsN', earned)}</span>}
          </div>
          <div className="q-dots" aria-hidden="true">
            {test.map((_, i) => {
              const a = answers[i]
              const done = a !== undefined
              const ok = done && a !== 'idk' && a !== 'timeout' && a.id === test[i].word.id
              return <span key={i} className={done ? (ok ? 'qd done' : 'qd miss') : i === qi ? 'qd now' : 'qd'} />
            })}
          </div>
          <div className="q-time" aria-hidden="true">
            <span key={qi} className={picked ? 'stop' : ''} style={{ animationDuration: `${SECONDS}s` }} />
          </div>
          <section className="prompt">
            <div className="prompt-ask">{q.kind === 'meaning' ? t('testQ') : t('askKorean')}</div>
            {q.kind === 'meaning' ? (
              <>
                <div className="prompt-word ko">{q.word.ko}</div>
                <Pron ko={q.word.ko} block />
                <button className="round-btn sm" onClick={() => speakWord(q.word)} aria-label={t('speak')}>
                  <Icon name="speaker" />
                </button>
              </>
            ) : (
              <>
                <div className="prompt-emoji" aria-hidden="true">
                  {q.word.emoji}
                </div>
                <div className={`prompt-word nf-${s.native}`}>{translation(q.word)}</div>
              </>
            )}
          </section>
          <div className="options">
            {q.options.map((o, k) => {
              const isPicked = picked !== null && picked !== 'idk' && picked !== 'timeout' && picked.id === o.id
              const cls = picked === null ? '' : isRight(o) ? 'good' : isPicked ? 'bad' : 'dim'
              return (
                <button
                  key={o.id}
                  ref={(el) => {
                    optRefs.current[k] = el
                  }}
                  className={`opt ${cls}`}
                  onClick={() => answer(o)}
                  disabled={picked !== null}
                >
                  {q.kind === 'meaning' ? (
                    <>
                      <span className="opt-emoji">{o.emoji}</span>
                      <span className={`opt-text nf-${s.native}`}>{translation(o)}</span>
                    </>
                  ) : (
                    <span className="opt-text ko">{o.ko}</span>
                  )}
                </button>
              )
            })}
            <button className="btn btn-soft btn-block idk" onClick={() => answer('idk')} disabled={picked !== null}>
              🤔 {t('dontKnow')}
            </button>
          </div>
          {picked === 'timeout' && <p className="test-timeup">⏰ {t('timeUp')}</p>}
        </main>
      </div>
    )
  }

  // ───────── 결과 ─────────
  if (stage === 'result') {
    const course = findCourse(lv.course)
    return (
      <div className="app">
        <main className="intro test-result">
          <div className="test-result-hero">
            <Elephant size={110} acc={right >= 6 ? 'crown' : right >= 3 ? 'star' : 'bow'} mood={right >= 3 ? 'happy' : 'wow'} className="bounce" />
            <span className="eyebrow">{t('testResult')}</span>
            <div className="test-score num">
              {right}
              <span>/{test.length}</span>
            </div>
            <p className="test-score-line">{tf('scoreN', right, test.length)}</p>
          </div>
          <div className="test-cards">
            <div className="test-card">
              <span className="test-card-label">{t('myLevel')}</span>
              <span className="test-card-value">{t(lv.key)}</span>
            </div>
            <div className="test-card">
              <span className="test-card-label">{t('recCourse')}</span>
              <span className="test-card-value">
                {course.icon} {lv.topik ? (IS_KO ? `TOPIK ${tf('topikLevel', lv.topik)}` : levelName(lv.topik)) : course.title[ui]}
              </span>
            </div>
          </div>
          <section className="panel test-answers">
            <h2 className="h3">✅ {t('answersTitle')}</h2>
            <ol>
              {test.map((tq, i) => {
                const a = answers[i]
                const ok = a !== undefined && a !== 'idk' && a !== 'timeout' && a.id === tq.word.id
                return (
                  <li key={i} className={ok ? 'ok' : 'no'}>
                    <span className="ta-mark" aria-hidden="true">
                      {ok ? '⭕' : '❌'}
                    </span>
                    <span className="ta-emoji" aria-hidden="true">
                      {tq.word.emoji}
                    </span>
                    <span className="ta-ko ko">{tq.word.ko}</span>
                    <span className={`ta-mean nf-${s.native}`}>{translation(tq.word)}</span>
                  </li>
                )
              })}
            </ol>
          </section>
          {POINTS_ENABLED && earned > 0 && <p className="center chip chip-butter num test-earned">⭐ {tf('plusP', earned)}</p>}
          <button
            className="btn btn-pink btn-block btn-big"
            onClick={() => {
              // 일본어·영어판: 코스가 하나 → 추천 레벨에서 바로 시작
              if (!IS_KO) {
                sfx.pop()
                setCourse('topik', lv.topik ?? 1)
                finishIntro(earned + WELCOME_POINTS)
                return
              }
              setStage(POINTS_ENABLED ? 'gift' : 'course')
            }}
          >
            {t('nextLabel')} →
          </button>
        </main>
      </div>
    )
  }

  if (stage === 'gift') {
    return (
      <div className="app">
        <main className="intro intro-gift">
          <Elephant size={130} acc="crown" mood="happy" className="bounce" />
          <h1 className="intro-gift-title">🎁 {t('welcomeGift')}</h1>
          <p className="note center">{t('welcomeSub')}</p>
          <div className="intro-gift-points num">+{WELCOME_POINTS}P</div>
          <div className="wallet-mini">
            <span>💰 {t('myPoints')}</span>
            <strong className="num">{tf('pointsN', total)}</strong>
          </div>
          <button className="btn btn-pink btn-block btn-big" onClick={() => setStage('shop')}>
            {t('nextLabel')} →
          </button>
        </main>
      </div>
    )
  }

  if (stage === 'course') {
    return (
      <div className="app">
        <main className="intro intro-course">
          <div className="intro-course-head">
            <Elephant size={72} acc="grad" mood="happy" className="float" />
            <h1 className="h1">{t('courseQ')}</h1>
            <p className="note">{t('courseHint')}</p>
          </div>
          <CoursePicker
            current={null}
            recommend={lv.course}
            onPick={(id) => {
              sfx.pop()
              setCourse(id, id === 'topik' ? (lv.topik ?? 1) : undefined)
              finishIntro(earned + WELCOME_POINTS)
            }}
          />
          {!POINTS_ENABLED && backendReady && auth.status !== 'in' && (
            <button
              className="link-btn center"
              onClick={() => {
                finishIntro(earned + WELCOME_POINTS)
                signInWithFacebook()
              }}
            >
              {t('haveAccount')}
            </button>
          )}
        </main>
      </div>
    )
  }

  // 포인트 교환소 미리보기
  return (
    <div className="app">
      <main className="intro">
        <h1 className="h1 center">🛍️ {t('pointsShop')}</h1>
        <p className="note center">{t('shopIntro')}</p>
        <ShopGrid points={total} />
        <p className="note center">{t('shopNote')}</p>
        <button
          className="btn btn-pink btn-block btn-big"
          onClick={() => {
            sfx.pop()
            setStage('course')
          }}
        >
          📚 {t('startStudy')}
        </button>
        {backendReady && auth.status !== 'in' && (
          <button
            className="link-btn center"
            onClick={() => {
              finishIntro(earned + WELCOME_POINTS)
              signInWithFacebook()
            }}
          >
            {t('haveAccount')}
          </button>
        )}
      </main>
    </div>
  )
}

/** 포인트 교환소 카드들 (오픈 예정) */
export function ShopGrid({ points }: { points: number }) {
  const { t, tf, ui } = useApp()
  return (
    <div className="shop-grid">
      {SHOP.map((item) => {
        const pct = Math.min(100, Math.round((points / item.points) * 100))
        return (
          <div key={item.id} className="shop-item">
            <span className="shop-soon">{t('shopSoon')}</span>
            <span className="shop-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="shop-name">{item.name[ui === 'ko' ? 'ko' : ui]}</span>
            <span className="shop-price num">{tf('pointsN', item.points)}</span>
            <span className="pack-bar" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          </div>
        )
      })}
    </div>
  )
}
