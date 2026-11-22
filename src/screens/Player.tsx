// 외우기 화면 (자동 반복)
// STEP 1: 5개씩 — 지금 5개 중 못 외운 단어만 반복, 5개를 다 외우면 다음 5개
// STEP 2: 25개씩 — 같은 방식으로 1~25 → 26~50
// (STEP 3 없음) STEP 2 까지 다 외우면 문제·졸업시험이 열림 — 문제를 풀어 통과해야 단원 완료
// STEP마다 처음엔 모두 '못 외움'에서 시작 (다시 확인하며 외우기)
// review=true: 외운 단어까지 5개씩 계속 복습
import { useEffect, useMemo, useRef, useState } from 'react'
import { findRound, translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { nativeInfo } from '../i18n'
import { ShareToGroupButton } from './Community'
import { COMMUNITY_ENABLED } from '../config'
import { touchStudy, useStudyClock } from '../activity'
import WordHelp from './WordHelp'
import {
  addActivity,
  completeSession,
  getState,
  isStepKnown,
  recordGroupPass,
  setLastChunk,
  setSettings,
  setStepKnown,
  stepKey,
  stepKnownCount,
  stepOf,
  stepSizesOf,
  useStore,
  STEP_SIZES,
  type Direction,
} from '../store'
import { burstFrom, fireworks, floatFrom, fxColors, sparkleRain } from '../fx'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { Elephant, Icon, Segmented, Stepper, Toggle, TopBar, pastel, shuffle, Pron } from '../ui'

const orderOf = (words: Word[]) => (getState().settings.order === 'random' ? shuffle(words) : words)
function chunkBy<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export default function Player({ roundId, startChunk, review = false }: { roundId: string; startChunk: number; review?: boolean }) {
  const s = useStore()
  const { t, tf, replace } = useApp()
  const round = findRound(roundId)
  const sizes = stepSizesOf(round)
  const final = sizes.length
  const startStep = stepOf(getState(), roundId)
  const [step] = useState(() => Math.min(startStep, final))
  const size = review ? 5 : sizes[step - 1]
  const unitTitle = round.pack ? `${round.pack.icon} ${round.title[getState().ui]}` : null
  const batches = useMemo(() => chunkBy(round.words, size), [round, size])
  const total = batches.length
  const resumeKey = stepKey(roundId, review ? 0 : step)

  const isActive = (w: Word) => review || !isStepKnown(getState(), w, step)
  const activeOf = (b: number) => batches[b].filter(isActive)
  /** from부터 못 외운 단어가 남은 묶음 찾기 (끝까지 가면 처음으로) */
  const findBatch = (from: number): { c: number; wrapped: boolean } | null => {
    for (let k = 0; k < total; k++) {
      const c = (from + k) % total
      if (activeOf(c).length) return { c, wrapped: from + k >= total }
    }
    return null
  }

  const first = useMemo(() => {
    if (!review && startStep > final) return null
    const from = startChunk >= 0 ? startChunk : getState().lastChunk[resumeKey] ?? 0
    return findBatch(Math.min(from, total - 1))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [batch, setBatch] = useState(first?.c ?? 0)
  const [queue, setQueue] = useState<Word[]>(() => (first ? orderOf(activeOf(first.c)) : []))
  const [pos, setPos] = useState(0)
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [playing, setPlaying] = useState(true)
  const [helpWord, setHelpWord] = useState<Word | null>(null)
  const [loop, setLoop] = useState(1)
  const [pending, setPending] = useState<number | null>(null)
  const [view, setView] = useState<'play' | 'stepDone' | 'allDone'>(first ? 'play' : startStep > final ? 'allDone' : 'stepDone')
  const [combo, setCombo] = useState(0)
  const markBtn = useRef<HTMLButtonElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const sec = s.settings.cardSec
  const word: Word | undefined = queue[pos]
  const batchWords = batches[batch]

  useEffect(() => setLastChunk(resumeKey, batch), [resumeKey, batch])
  useEffect(() => () => stopSpeaking(), [])

  // 섞어서 모드: 카드마다 방향
  const dirs = useMemo(
    () => queue.map(() => (s.settings.direction === 'mix' ? (Math.random() < 0.5 ? 'ko2n' : 'n2ko') : s.settings.direction)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, s.settings.direction],
  )
  const koFirst = dirs[pos] !== 'n2ko'

  function showToast(text: string, ms = 1600) {
    setToast(text)
    setTimeout(() => setToast((cur) => (cur === text ? null : cur)), ms)
  }

  // 공부 시간 재기 + 카드를 볼 때마다 '본 단어' 1개 (하루 활동 요약)
  useStudyClock()
  const seenKey = useRef('')
  useEffect(() => {
    if (!word || view !== 'play') return
    const key = `${loop}-${batch}-${pos}-${word.id}`
    if (seenKey.current === key) return
    seenKey.current = key
    addActivity({ words: 1 })
    touchStudy()
  }, [word, view, loop, batch, pos])

  // 한국어가 보이는 순간 발음
  const spokenKey = useRef('')
  useEffect(() => {
    if (!word || view !== 'play' || pending !== null || !playing || !s.settings.autoSpeak) return
    const key = `${loop}-${batch}-${pos}-${phase}-${word.id}-${queue.length}`
    if (spokenKey.current === key) return
    if ((phase === 'front' && koFirst) || (phase === 'back' && !koFirst)) {
      spokenKey.current = key
      speakWord(word)
    }
  }, [loop, batch, pos, phase, koFirst, word, playing, pending, view, queue.length, s.settings.autoSpeak])

  // 자동 넘김
  useEffect(() => {
    if (!playing || pending !== null || view !== 'play' || !word) return
    const ms = phase === 'front' ? sec * 1000 : Math.max(1500, sec * 700)
    const timer = setTimeout(() => (phase === 'front' ? setPhase('back') : advance()), ms)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, pending, view, phase, pos, batch, sec, loop, queue])

  // "다음 n개!" → 잠깐 보여주고 자동으로 다음 묶음
  useEffect(() => {
    if (pending === null || !playing) return
    const timer = setTimeout(() => startBatch(pending), 1600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, playing])

  // 지금 단어 칩이 보이게 가로 스크롤
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  useEffect(() => {
    if (word) chipRefs.current[word.id]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [word])

  function startBatch(c: number) {
    const g = findBatch(c)
    if (!g) return completeStep()
    setPending(null)
    setBatch(g.c)
    setQueue(orderOf(activeOf(g.c)))
    setPos(0)
    setPhase('front')
  }

  function completeStep() {
    stopSpeaking()
    setPending(null)
    completeSession()
    sfx.levelUp()
    setTimeout(() => {
      fireworks(step >= final ? 9 : 6)
      sparkleRain(step >= final ? 34 : 20)
    }, 150)
    setView(step >= final ? 'allDone' : 'stepDone')
  }

  function goNextBatch() {
    const g = findBatch(batch + 1)
    if (!g) return completeStep()
    if (g.c === batch) {
      // 남은 묶음이 지금 묶음뿐 → 바로 다시
      setQueue(orderOf(activeOf(batch)))
      setPos(0)
      setPhase('front')
      return
    }
    if (g.wrapped) setLoop((l) => l + 1)
    sfx.correct()
    setPending(g.c)
  }

  function advance(fromMark = false) {
    if (!fromMark) setCombo(0)
    setPhase('front')
    let p = pos + 1
    while (p < queue.length && !isActive(queue[p])) p++
    if (p < queue.length) return setPos(p)
    // 이 묶음 한 바퀴 끝
    const pts = recordGroupPass(roundId, batch, total, queue.length)
    if (pts > 0) floatFrom(stageRef.current, `+${pts} ⭐`)
    const left = activeOf(batch)
    if (!review && left.length) {
      // 다 외울 때까지 같은 묶음에서 못 외운 단어만 다시
      sfx.tick()
      showToast(`🔁 ${t('remainingAgain')} (${left.length})`, 1500)
      setQueue(orderOf(left))
      setPos(0)
      return
    }
    goNextBatch()
  }

  function mark(w: Word, on: boolean) {
    const { points, stepDone } = setStepKnown(w, step, on)
    if (!on) return showToast(t('unmarkHint'))
    // 팡! 효과 + 떠오르는 점수 + 콤보
    const n = combo + 1
    setCombo(n)
    sfx.pop()
    burstFrom(markBtn.current, { count: n >= 3 ? 20 : 14, power: n >= 3 ? 1.3 : 1 })
    if (points > 0) floatFrom(markBtn.current, `+${points} ⭐`)
    if (n >= 2) {
      setTimeout(() => {
        sfx.combo(n)
        floatFrom(stageRef.current, tf('combo', n), 'combo')
      }, 180)
    }
    if (stepDone) return completeStep()
    if (activeOf(batch).length === 0) return goNextBatch()
    if (word && w.id === word.id) advance(true)
  }

  function jumpTo(w: Word) {
    const i = queue.findIndex((x) => x.id === w.id)
    if (i >= 0) {
      setPhase('front')
      setPos(i)
    }
  }

  // ───────── STEP 끝 / 모두 끝 ─────────
  if (view !== 'play') {
    const all = view === 'allDone'
    return (
      <div className="screen">
        <TopBar title={unitTitle ?? tf('roundN', round.no)} sub={round.pack ? round.pack.desc[s.ui] : round.title[s.ui]} />
        <Confetti />
        <div className="page">
          <div className="result-hero pass">
            <Elephant size={130} acc={all ? 'crown' : 'star'} mood="happy" className="bounce" />
            <h1 className="result-title">🎉 {all ? t('allStepsDone') : tf('stepDone', step)}</h1>
            <p className="result-line">{all ? t('examOpenNow') : tf('nextStepDesc', sizes[step])}</p>
          </div>
          <StepBar step={all ? final + 1 : step + 1} sizes={sizes} t={t} tf={tf} />
          {COMMUNITY_ENABLED && <ShareToGroupButton data={all && round.pack ? { type: 'pack', unit: roundId } : { type: 'step', unit: roundId, n: all ? final : step }} />}
          {all ? (
            <>
              <button className="btn btn-butter btn-block btn-big" onClick={() => replace({ name: 'round', roundId })}>
                🎓 {t('goExam')}
              </button>
              <button className="btn btn-soft btn-block" onClick={() => replace({ name: 'player', roundId, startChunk: 0, review: true })}>
                🔁 {t('reviewAll')}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-pink btn-block btn-big" onClick={() => replace({ name: 'player', roundId, startChunk: 0, nonce: Date.now() })}>
                <Icon name="play" size={22} /> {tf('startStep', step + 1)}
              </button>
              <button className="btn btn-soft btn-block" onClick={() => replace({ name: 'round', roundId })}>
                {t('later')}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const knownInBatch = batchWords.filter((w) => !isActive(w)).length
  const pendingWords = pending !== null ? batches[pending] : null
  // 일시정지: 공부 중에는 「다시 보기」와 「외웠어요」 사이 (손이 가장 쉽게 닿는 곳), 복습에서는 아래 줄
  const playBtn = (
    <button className="play-btn sm" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t('pause') : t('play')}>
      <Icon name={playing ? 'pause' : 'play'} size={26} />
    </button>
  )

  return (
    <div className="screen">
      <TopBar
        title={unitTitle ?? tf('roundN', round.no)}
        sub={review ? `🔁 ${t('reviewMode')}` : `${tf('stepName', step)} · ${tf('stepSize', size)}`}
        right={
          <button className="bubble-btn" onClick={() => setSheet(true)} aria-label={t('study')}>
            <Icon name="gear" />
          </button>
        }
      />
      <div className="page player-page">
        {!review && <StepBar step={step} sizes={sizes} t={t} tf={tf} compact />}

        <section className="batch-box">
          <div className="batch-head">
            <span className="batch-label num">{tf('batchOf', batch + 1, total)}</span>
            {!review && (
              <span className="batch-known num">
                ✓ {knownInBatch}/{batchWords.length}
              </span>
            )}
          </div>
          {!review && (
            <div className="batch-bar" aria-hidden="true">
              <span style={{ width: `${(knownInBatch / batchWords.length) * 100}%` }} />
            </div>
          )}
          <div className={batchWords.length > 5 ? 'chips scroll' : 'chips'} role="list">
            {batchWords.map((w, i) => {
              const kn = !review && !isActive(w)
              const now = !pendingWords && word?.id === w.id
              return (
                <button
                  key={w.id}
                  ref={(el) => {
                    chipRefs.current[w.id] = el
                  }}
                  role="listitem"
                  className={`wchip c-${pastel(i)} ${now ? 'now' : ''} ${kn ? 'known' : ''}`}
                  onClick={() => (kn ? mark(w, false) : jumpTo(w))}
                  aria-label={`${w.ko} ${translation(w)}${kn ? ` ✓ ${t('memorized')}` : ''}`}
                >
                  <span className="wchip-emoji" aria-hidden="true">
                    {w.emoji}
                  </span>
                  <span className="wchip-ko ko">{w.ko}</span>
                  {kn && <span className="wchip-badge" aria-hidden="true">✓</span>}
                </button>
              )
            })}
          </div>
        </section>

        <div className="countdown slim" aria-hidden="true">
          {pending === null && word && (
            <div
              key={`${loop}-${batch}-${pos}-${phase}-${queue.length}`}
              className={`countdown-fill ${phase}`}
              style={{ animationDuration: `${phase === 'front' ? sec : Math.max(1.5, sec * 0.7)}s`, animationPlayState: playing ? 'running' : 'paused' }}
            />
          )}
        </div>

        {pendingWords ? (
          <div
            className="fcard-stage interlude"
            role="button"
            tabIndex={0}
            aria-label={tf('nextN', pendingWords.length)}
            onClick={() => pending !== null && startBatch(pending)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pending !== null && startBatch(pending)}
          >
            <Elephant size={84} acc="bow" mood="happy" className="bounce" />
            <div className="interlude-title">{tf('nextN', pendingWords.length)}</div>
            <div className="interlude-words">
              {pendingWords.slice(0, 10).map((w, k) => (
                <span key={w.id} className="iw" style={{ animationDelay: `${k * 0.05}s` }}>
                  <span className="iw-emoji">{w.emoji}</span>
                  <span className="ko">{w.ko}</span>
                </span>
              ))}
              {pendingWords.length > 10 && <span className="iw more">+{pendingWords.length - 10}</span>}
            </div>
          </div>
        ) : word ? (
          <div className="fcard-stage" ref={stageRef}>
            {combo >= 2 && <span key={combo} className="combo-badge">🔥 {tf('combo', combo)}</span>}
            <button
              key={`${loop}-${batch}-${pos}-${word.id}`}
              className={phase === 'back' ? 'fcard flipped' : 'fcard'}
              onClick={() => (phase === 'front' ? setPhase('back') : advance())}
              aria-label={t('tapToReveal')}
            >
              <span className="fcard-inner">
                <span className={`fcard-face front c-${pastel(batchWords.indexOf(word))} ${word.kind === 'phrase' ? 'phrase' : ''}`}>
                  {word.kind === 'phrase' && <span className="phrase-tag">💬 {t('phraseTag')}</span>}
                  {/* 그림은 단어 위에 동그랗게 (글자가 주인공, 그림은 기억을 돕는 짝) */}
                  <span className="front-pic" aria-hidden="true">
                    <span className="front-emoji">{word.emoji}</span>
                  </span>
                  {koFirst ? (
                    <>
                      <span className="card-word ko">{word.ko}</span>
                      <Pron ko={word.ko} />
                    </>
                  ) : (
                    <span className="card-word lo">{translation(word)}</span>
                  )}
                  <span className="flip-hint">↻ {t('tapToReveal')}</span>
                </span>
                <span className={`fcard-face back c-${pastel(batchWords.indexOf(word))} ${word.kind === 'phrase' ? 'phrase' : ''}`}>
                  {/* 글자 중심: 단어 → 발음 → 뜻 (그림은 뜻 옆에 작게) */}
                  <span className={koFirst ? 'back-q ko' : 'back-q lo'}>{koFirst ? word.ko : translation(word)}</span>
                  {koFirst && <Pron ko={word.ko} />}
                  <span className="back-divider" aria-hidden="true" />
                  <span className="back-meaning">
                    <span className="back-emoji" aria-hidden="true">
                      {word.emoji}
                    </span>
                    <span className={koFirst ? 'back-a lo' : 'back-a ko'}>{koFirst ? translation(word) : word.ko}</span>
                  </span>
                  {!koFirst && <Pron ko={word.ko} />}
                </span>
              </span>
            </button>
            <button
              className="fcard-help"
              onClick={() => {
                setPlaying(false)
                setHelpWord(word)
              }}
              aria-label={t('wordHelp')}
            >
              ?
            </button>
            <button className="fcard-speak" onClick={() => speakWord(word)} aria-label={t('speak')}>
              <Icon name="speaker" size={22} />
            </button>
          </div>
        ) : null}

        {pendingWords ? (
          // 한 묶음을 다 외우면: 다음 묶음으로 가는 큰 버튼 하나 (화면 아래 작은 화살표를 찾지 않아도 되게)
          <div className="act-row next-row">
            <button className="btn btn-pink btn-big next-batch-btn" onClick={() => pending !== null && startBatch(pending)}>
              ▶ {tf('nextN', pendingWords.length)}
            </button>
          </div>
        ) : !review && (
          <div className="act-row with-play">
            <button className="btn btn-soft" onClick={() => word && advance()} disabled={!word || pending !== null}>
              <Icon name="repeat" size={18} /> {t('seeAgain')}
            </button>
            {playBtn}
            <button ref={markBtn} className="btn btn-mint" onClick={() => word && mark(word, true)} disabled={!word || pending !== null}>
              <Icon name="check" size={20} /> {t('memorized')}
            </button>
          </div>
        )}

        <div className={review ? 'mini-ctrl' : 'mini-ctrl pager'}>
          <button className="round-btn sm" onClick={() => { setPhase('front'); setPos((i) => Math.max(0, i - 1)) }} disabled={pos === 0 || pending !== null} aria-label={t('prev')}>
            <Icon name="prev" size={22} />
          </button>
          {review && playBtn}
          <button className="round-btn sm" onClick={() => (pending !== null ? startBatch(pending) : advance())} aria-label={t('next')}>
            <Icon name="next" size={22} />
          </button>
        </div>
        {!review && <p className="note center">💡 {t('markHint')}</p>}
      </div>

      {helpWord && <WordHelp word={helpWord} onClose={() => setHelpWord(null)} />}
      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <section className="sheet" role="dialog" aria-label={t('study')} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <h2 className="h3">⚙️ {t('study')}</h2>
            <div className="quick-row">
              <span className="quick-label">{t('cardSec')}</span>
              <Stepper value={sec} min={1} max={10} onChange={(v) => setSettings({ cardSec: v })} format={(v) => `${v}${t('sec')}`} />
            </div>
            <div className="quick-col">
              <span className="quick-label">{t('direction')}</span>
              <Segmented<Direction>
                name={t('direction')}
                value={s.settings.direction}
                onChange={(direction) => setSettings({ direction })}
                options={[
                  { id: 'ko2n', label: `${t('korean')} → ${t(nativeInfo(s.native).key)}` },
                  { id: 'n2ko', label: `${t(nativeInfo(s.native).key)} → ${t('korean')}` },
                  { id: 'mix', label: t('dirMix') },
                ]}
              />
            </div>
            <Toggle id="sh-speak" label={t('autoSpeak')} on={s.settings.autoSpeak} onChange={(v) => setSettings({ autoSpeak: v })} />
            <Toggle id="sh-rand" label={t('orderRandom')} on={s.settings.order === 'random'} onChange={(v) => setSettings({ order: v ? 'random' : 'seq' })} />
            <button className="btn btn-pink btn-block" onClick={() => setSheet(false)}>
              {t('ok')}
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

/** STEP 1·2·3 진행 표시 */
export function StepBar({
  step,
  sizes = [...STEP_SIZES],
  t,
  tf,
  compact = false,
}: {
  step: number
  sizes?: number[]
  t: ReturnType<typeof useApp>['t']
  tf: ReturnType<typeof useApp>['tf']
  compact?: boolean
}) {
  return (
    <ol className={compact ? 'stepbar compact' : 'stepbar'} style={{ gridTemplateColumns: `repeat(${sizes.length}, 1fr)` }} aria-label={t('stepsTitle')}>
      {sizes.map((k, i) => {
        const n = i + 1
        const cls = n < step ? 'done' : n === step ? 'now' : 'todo'
        return (
          <li key={n} className={`step ${cls}`}>
            <span className="step-dot num">{n < step ? '✓' : n}</span>
            <span className="step-text">
              <span className="step-name">{tf('stepName', n)}</span>
              <span className="step-size">{compact ? tf('stepSizeShort', k) : tf('stepSize', k)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function Confetti() {
  const colors = fxColors()
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 7) * 0.12}s`,
            animationDuration: `${1.6 + (i % 5) * 0.25}s`,
            borderRadius: i % 3 === 0 ? '50%' : '3px',
          }}
        />
      ))}
    </div>
  )
}
