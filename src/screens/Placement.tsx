// 수준 테스트 (처음 시작할 때 / 설정에서 다시 보기)
// 회차 순서대로 단계별 6문제씩: 5개 이상 맞히면 다음 단계, 2개 틀리면 그 회차부터 시작.
// '몰라요'를 누르면 틀린 것으로 처리 (찍기 방지).
import { useEffect, useMemo, useRef, useState } from 'react'
import { ROUNDS, TIERS, translation, type Word } from '../data/words'
import { makeT, type UiLang } from '../i18n'
import { applyPlacement } from '../store'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { Elephant, Icon, TIER_ACC, shuffle } from '../ui'
import { Confetti } from './Player'

const PER = 6 // 단계마다 문제 수
const NEED = 5 // 다음 단계로 가려면 맞혀야 하는 수

interface Q {
  word: Word
  options: Word[]
}

function makeStage(roundIdx: number): Q[] {
  const pool = ROUNDS[roundIdx].words
  return shuffle(pool)
    .slice(0, PER)
    .map((word) => {
      const seen = new Set([translation(word), word.emoji])
      const opts: Word[] = []
      for (const w of shuffle(pool)) {
        if (opts.length === 3) break
        if (w.id === word.id || seen.has(translation(w)) || seen.has(w.emoji)) continue
        seen.add(translation(w))
        seen.add(w.emoji)
        opts.push(w)
      }
      return { word, options: shuffle([word, ...opts]) }
    })
}

export default function Placement({ ui, mode, onDone, onBack }: { ui: UiLang; mode: 'first' | 'retake'; onDone: () => void; onBack?: () => void }) {
  const { t, tf } = useMemo(() => makeT(ui), [ui])
  const [phase, setPhase] = useState<'intro' | 'test' | 'result'>('intro')
  const [stage, setStage] = useState(0)
  const [qs, setQs] = useState<Q[]>(() => makeStage(0))
  const [qi, setQi] = useState(0)
  const [right, setRight] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [picked, setPicked] = useState<Word | 'idk' | null>(null)
  const [placedAt, setPlacedAt] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const q = qs[qi]

  useEffect(() => {
    if (phase === 'test' && q) speakWord(q.word)
  }, [phase, stage, qi, q])
  useEffect(
    () => () => {
      stopSpeaking()
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function finish(at: number) {
    setPlacedAt(at)
    setPhase('result')
    stopSpeaking()
    if (at > 0) sfx.fanfare()
  }

  function answer(choice: Word | 'idk') {
    if (picked) return
    const ok = choice !== 'idk' && choice.id === q.word.id
    setPicked(choice)
    ok ? sfx.correct() : sfx.wrong()
    const r = right + (ok ? 1 : 0)
    const w = wrong + (ok ? 0 : 1)
    timer.current = setTimeout(() => {
      setPicked(null)
      if (w > PER - NEED) return finish(stage) // 이 회차는 아직 모름 → 여기부터 시작
      if (r + w < PER) {
        setRight(r)
        setWrong(w)
        setQi(qi + 1)
        return
      }
      // 이 단계 통과 → 다음 회차 단계로
      if (stage + 1 >= ROUNDS.length) return finish(ROUNDS.length)
      setStage(stage + 1)
      setQs(makeStage(stage + 1))
      setQi(0)
      setRight(0)
      setWrong(0)
    }, ok ? 550 : 900)
  }

  if (phase === 'intro') {
    return (
      <div className="screen">
        {onBack && (
          <header className="topbar">
            <button className="bubble-btn" onClick={onBack} aria-label={t('back')}>
              <Icon name="back" />
            </button>
            <div className="topbar-title">
              <div className="topbar-main">{t('levelTest')}</div>
            </div>
          </header>
        )}
        <div className="page level-intro">
          <div className="hero-blob small" aria-hidden="true">
            <span className="spark s1">✦</span>
            <span className="spark s2">♥</span>
            <Elephant size={120} acc="grad" className="float" />
          </div>
          <h1 className="h1 center">{t('levelTest')}</h1>
          <p className="center level-desc">{t('levelTestDesc')}</p>
          <div className="level-steps" aria-hidden="true">
            {ROUNDS.map((r, i) => (
              <span key={r.id} className="level-step">
                <span className="level-step-emoji">{r.words[0].emoji}</span>
                <span className="num">{i + 1}</span>
              </span>
            ))}
          </div>
          <p className="note center">{tf('testRule', PER, NEED)}</p>
          <button className="btn btn-pink btn-block btn-big" onClick={() => setPhase('test')}>
            ✏️ {t('takeTest')}
          </button>
          {mode === 'first' && (
            <button
              className="btn btn-soft btn-block"
              onClick={() => {
                applyPlacement(0)
                onDone()
              }}
            >
              🌱 {t('beginner')}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const all = placedAt >= ROUNDS.length
    const round = ROUNDS[Math.min(placedAt, ROUNDS.length - 1)]
    const lastReady = TIERS.filter((x) => x.rounds.length > 0)
    const tier = all ? lastReady[lastReady.length - 1] : TIERS.find((x) => x.no === round.tier)!
    return (
      <div className="screen">
        {placedAt > 0 && <Confetti />}
        <div className="page level-result">
          <div className="result-hero pass">
            <div className="eyebrow">{t('levelResult')}</div>
            <Elephant size={130} acc={TIER_ACC[tier.no - 1]} mood="happy" className="bounce" />
            <div className="level-tier">
              {tf('tierN', tier.no)} · {tier.name[ui]}
            </div>
            <p className="level-from">{all ? t('allKnown') : placedAt === 0 ? t('fromStart') : tf('placedFrom', round.no)}</p>
            {placedAt > 0 && <span className="chip chip-mint">✓ {tf('skipped', placedAt)}</span>}
          </div>
          <ol className="level-map">
            {ROUNDS.map((r, i) => (
              <li key={r.id} className={i < placedAt ? 'done' : i === placedAt ? 'here' : ''}>
                <span className="level-map-no num">{i < placedAt ? '✓' : r.no}</span>
                <span className="level-map-title">
                  {tf('roundN', r.no)} · {r.title[ui]}
                </span>
                {i === placedAt && <span className="chip chip-pink tiny">START</span>}
              </li>
            ))}
          </ol>
          <button
            className="btn btn-pink btn-block btn-big"
            onClick={() => {
              applyPlacement(placedAt)
              onDone()
            }}
          >
            {t('startHere')} ♥
          </button>
        </div>
      </div>
    )
  }

  // 문제 풀기
  return (
    <div className="screen">
      <header className="topbar">
        <button className="bubble-btn" onClick={() => (onBack ? onBack() : setPhase('intro'))} aria-label={t('back')}>
          <Icon name="back" />
        </button>
        <div className="topbar-title">
          <div className="topbar-main">{t('levelTest')}</div>
          <div className="topbar-sub num">{tf('testStage', stage + 1, ROUNDS.length)}</div>
        </div>
      </header>
      <div className="page quiz-page">
        <div className="level-progress" aria-label={tf('testStage', stage + 1, ROUNDS.length)}>
          {ROUNDS.map((r, i) => (
            <span key={r.id} className={i < stage ? 'lp done' : i === stage ? 'lp now' : 'lp'}>
              {i < stage ? '✓' : i + 1}
            </span>
          ))}
        </div>
        <div className="q-dots" aria-hidden="true">
          {qs.map((_, i) => (
            <span key={i} className={i < qi ? 'qd done' : i === qi ? 'qd now' : 'qd'} />
          ))}
        </div>
        <section className="prompt">
          <div className="prompt-ask">{t('testQ')}</div>
          <div className="prompt-word ko">{q.word.ko}</div>
          <div className="rom-pill">{q.word.rom}</div>
          <button className="round-btn sm" onClick={() => speakWord(q.word)} aria-label={t('speak')}>
            <Icon name="speaker" />
          </button>
        </section>
        <div className="options">
          {q.options.map((o) => {
            const isAnswer = o.id === q.word.id
            const isPicked = picked !== null && picked !== 'idk' && picked.id === o.id
            const cls = !picked ? '' : isAnswer ? 'good' : isPicked ? 'bad' : 'dim'
            return (
              <button key={o.id} className={`opt ${cls}`} onClick={() => answer(o)} disabled={!!picked}>
                <span className="opt-emoji">{o.emoji}</span>
                <span className="opt-text lo">{translation(o)}</span>
              </button>
            )
          })}
          <button className="btn btn-soft btn-block idk" onClick={() => answer('idk')} disabled={!!picked}>
            🤔 {t('dontKnow')}
          </button>
        </div>
      </div>
    </div>
  )
}
