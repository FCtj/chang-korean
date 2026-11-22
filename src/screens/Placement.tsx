// 수준 테스트 (처음 시작할 때 / 설정에서 다시 보기)
// 계급(1~5단계) 순서대로 단계마다 6문제: 5개 이상 맞히면 다음 단계, 2개 틀리면 그 계급의 첫 회차부터 시작.
// '몰라요'를 누르면 틀린 것으로 처리 (찍기 방지). 최대 30문제.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ROUNDS, TIERS, translation, type Word } from '../data/words'
import { makeT, type UiLang } from '../i18n'
import { tierName } from '../mascot'
import { applyPlacement } from '../store'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { Elephant, Icon, TIER_ACC, shuffle, useHeart, useMascot } from '../ui'
import { Confetti } from './Player'

const PER = 6 // 단계마다 문제 수
const NEED = 5 // 다음 단계로 가려면 맞혀야 하는 수
const STAGES = TIERS.filter((t) => t.rounds.length > 0)

interface Q {
  word: Word
  options: Word[]
}

/** 계급의 여러 회차에서 고루 뽑은 6문제. 보기는 같은 회차(비슷한 난이도) 단어로 */
function makeStage(stageIdx: number): Q[] {
  const rounds = STAGES[stageIdx].rounds
  const picks: Word[] = []
  const bags = rounds.map((r) => shuffle(r.words))
  for (let i = 0; picks.length < PER; i++) picks.push(bags[i % bags.length].pop()!)
  return shuffle(picks).map((word) => {
    const pool = ROUNDS.find((r) => r.id === word.roundId)!.words
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

/** n단계까지 통과했을 때 시작할 회차 순번 (ROUNDS 기준) */
const placedIndex = (passedStages: number) =>
  passedStages >= STAGES.length ? ROUNDS.length : ROUNDS.findIndex((r) => r.id === STAGES[passedStages].rounds[0].id)

export default function Placement({ ui, mode, onDone, onBack }: { ui: UiLang; mode: 'first' | 'retake'; onDone: () => void; onBack?: () => void }) {
  const { t, tf } = useMemo(() => makeT(ui), [ui])
  const mascot = useMascot()
  const heart = useHeart()
  const [phase, setPhase] = useState<'intro' | 'test' | 'result'>('intro')
  const [stage, setStage] = useState(0)
  const [qs, setQs] = useState<Q[]>(() => makeStage(0))
  const [qi, setQi] = useState(0)
  const [right, setRight] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [picked, setPicked] = useState<Word | 'idk' | null>(null)
  const [passedStages, setPassedStages] = useState(0)
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

  function finish(passed: number) {
    setPassedStages(passed)
    setPhase('result')
    stopSpeaking()
    if (passed > 0) sfx.fanfare()
  }

  function answer(choice: Word | 'idk') {
    if (picked) return
    const ok = choice !== 'idk' && choice.id === q.word.id
    setPicked(choice)
    ok ? sfx.correct() : sfx.wrong()
    const r = right + (ok ? 1 : 0)
    const w = wrong + (ok ? 0 : 1)
    timer.current = setTimeout(
      () => {
        setPicked(null)
        if (w > PER - NEED) return finish(stage) // 이 계급은 아직 → 이 계급 처음부터
        if (r + w < PER) {
          setRight(r)
          setWrong(w)
          setQi(qi + 1)
          return
        }
        if (stage + 1 >= STAGES.length) return finish(STAGES.length)
        setStage(stage + 1)
        setQs(makeStage(stage + 1))
        setQi(0)
        setRight(0)
        setWrong(0)
      },
      ok ? 550 : 900,
    )
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
          <ol className="level-ladder">
            {STAGES.map((tr) => (
              <li key={tr.no}>
                <Elephant size={34} acc={TIER_ACC[tr.no - 1]} />
                <span className="ll-name">
                  {tf('tierN', tr.no)} · {tierName(tr, mascot)![ui]}
                </span>
                <span className="chip tiny">{tr.level[ui]}</span>
              </li>
            ))}
          </ol>
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
    const all = passedStages >= STAGES.length
    const tier = STAGES[Math.min(passedStages, STAGES.length - 1)]
    const at = placedIndex(passedStages)
    const startRound = ROUNDS[Math.min(at, ROUNDS.length - 1)]
    return (
      <div className="screen">
        {passedStages > 0 && <Confetti />}
        <div className="page level-result">
          <div className="result-hero pass">
            <div className="eyebrow">{t('levelResult')}</div>
            <Elephant size={130} acc={TIER_ACC[tier.no - 1]} mood="happy" className="bounce" />
            <div className="level-tier">
              {tf('tierN', tier.no)} · {tierName(tier, mascot)![ui]}
            </div>
            <span className="chip chip-pink">{tier.level[ui]}</span>
            <p className="level-from">{all ? t('allKnown') : passedStages === 0 ? t('fromStart') : tf('placedFrom', startRound.no)}</p>
            {at > 0 && <span className="chip chip-mint">✓ {tf('skipped', at)}</span>}
          </div>
          <ol className="level-map">
            {STAGES.map((tr, i) => (
              <li key={tr.no} className={i < passedStages ? 'done' : i === passedStages ? 'here' : ''}>
                <span className="level-map-no num">{i < passedStages ? '✓' : tr.no}</span>
                <span className="level-map-title">
                  {tf('tierN', tr.no)} · {tierName(tr, mascot)![ui]} <span className="muted">({tr.level[ui]})</span>
                </span>
                {i === passedStages && <span className="chip chip-pink tiny">START</span>}
              </li>
            ))}
          </ol>
          <button
            className="btn btn-pink btn-block btn-big"
            onClick={() => {
              applyPlacement(at)
              onDone()
            }}
          >
            {t('startHere')} {heart}
          </button>
        </div>
      </div>
    )
  }

  // 문제 풀기
  const cur = STAGES[stage]
  return (
    <div className="screen">
      <header className="topbar">
        <button className="bubble-btn" onClick={() => (onBack ? onBack() : setPhase('intro'))} aria-label={t('back')}>
          <Icon name="back" />
        </button>
        <div className="topbar-title">
          <div className="topbar-main">{t('levelTest')}</div>
          <div className="topbar-sub num">
            {tf('testStage', stage + 1, STAGES.length)} · {cur.level[ui]}
          </div>
        </div>
      </header>
      <div className="page quiz-page">
        <div className="level-progress" aria-label={tf('testStage', stage + 1, STAGES.length)}>
          {STAGES.map((tr, i) => (
            <span key={tr.no} className={i < stage ? 'lp done' : i === stage ? 'lp now' : 'lp'}>
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
