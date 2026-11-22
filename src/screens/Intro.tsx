// 처음 30초 체험: 카드 3장 (뒤집기 → 외웠어요 → +10P) → 환영 선물 +100P → 포인트 교환소 미리보기 → 코스 고르기
// 포인트는 끝까지 마쳤을 때 한 번에 들어감 (중간에 나갔다 다시 해도 두 번 받지 않음)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { PACKS, translation, type Word } from '../data/words'
import { SHOP } from '../data/shop'
import { WELCOME_POINTS } from '../config'
import { finishIntro, setCourse, useStore } from '../store'
import CoursePicker from './CoursePicker'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { burstFrom, fireworks, floatFrom, sparkleRain } from '../fx'
import { backendReady, signInWithFacebook, useAuth } from '../backend'
import { Elephant, pastel } from '../ui'

const SAMPLE = ['안녕하세요', '감사합니다', '사랑해요']
const PER_CARD = 10

export default function Intro() {
  const s = useStore()
  const auth = useAuth()
  const { t, tf } = useApp()
  const words = useMemo(() => {
    const all = PACKS.flatMap((p) => p.words)
    return SAMPLE.map((ko) => all.find((w) => w.ko === ko)).filter((w): w is Word => !!w)
  }, [])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [stage, setStage] = useState<'cards' | 'gift' | 'shop' | 'course'>('cards')
  const [earned, setEarned] = useState(0)
  const knowBtn = useRef<HTMLButtonElement>(null)
  const w = words[i]
  const total = s.totalPoints + earned + WELCOME_POINTS

  useEffect(() => {
    if (stage === 'cards' && w) speakWord(w)
    return () => stopSpeaking()
  }, [i, stage])

  useEffect(() => {
    if (stage !== 'gift') return
    sfx.levelUp()
    const tm = setTimeout(() => {
      fireworks(8)
      sparkleRain(36)
    }, 200)
    return () => clearTimeout(tm)
  }, [stage])

  const know = () => {
    if (!flipped) return
    sfx.correct()
    floatFrom(knowBtn.current, `+${PER_CARD}P`, 'points')
    burstFrom(knowBtn.current, { count: 14 })
    setEarned((e) => e + PER_CARD)
    if (i + 1 < words.length) {
      setTimeout(() => {
        setI(i + 1)
        setFlipped(false)
      }, 350)
    } else setTimeout(() => setStage('gift'), 500)
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
            current={s.course}
            onPick={(id) => {
              sfx.pop()
              setCourse(id)
              finishIntro(earned + WELCOME_POINTS)
            }}
          />
        </main>
      </div>
    )
  }

  if (stage === 'shop') {
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

  return (
    <div className="app">
      <main className="intro">
        <div className="intro-head">
          <Elephant size={56} acc="bow" mood="happy" />
          <div>
            <h1 className="h3">{t('introTitle')}</h1>
            <div className="intro-dots" aria-hidden="true">
              {words.map((_, k) => (
                <span key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />
              ))}
            </div>
          </div>
          <span className="pill pill-butter num">💰 {tf('pointsN', earned)}</span>
        </div>
        {w && (
          <div className="fcard-stage">
            <button key={w.id} className={flipped ? 'fcard flipped' : 'fcard'} onClick={() => setFlipped((f) => !f)} aria-label={t('tapToReveal')}>
              <span className="fcard-inner">
                <span className={`fcard-face front c-${pastel(i)}`}>
                  <span className="flash-blob" aria-hidden="true">
                    <span className="flash-emoji">{w.emoji}</span>
                  </span>
                  <span className="card-word ko">{w.ko}</span>
                  <span className="rom-pill">{w.rom}</span>
                </span>
                <span className={`fcard-face back c-${pastel(i)}`}>
                  <span className="back-top">
                    <span className="back-emoji" aria-hidden="true">
                      {w.emoji}
                    </span>
                    <span className="back-q ko">{w.ko}</span>
                  </span>
                  <span className="back-divider" aria-hidden="true" />
                  <span className="back-a lo">{translation(w)}</span>
                  <span className="rom-pill">{w.rom}</span>
                </span>
              </span>
            </button>
          </div>
        )}
        <p className={flipped ? 'intro-hint go' : 'intro-hint'}>{flipped ? t('introKnow') : t('introTap')}</p>
        <button ref={knowBtn} className="btn btn-mint btn-block btn-big" disabled={!flipped} onClick={know}>
          ✓ {t('memorized')}
        </button>
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
