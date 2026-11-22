// 고르기 · 듣기 · 졸업시험 · 승급시험 공통 화면
// - 연습(고르기/듣기): 틀린 단어는 맨 뒤에 다시 나와서, 모두 맞혀야 끝남
// - 졸업시험(50문제)·승급시험(30문제): 다시 나오지 않음. 전부 맞혀야 통과
//
// 그림이 정답을 알려주지 않도록:
//   한국어→내 언어: 문제 = 한국어(+발음), 보기 = 그림 + 뜻
//   내 언어→한국어: 문제 = 그림 + 뜻,     보기 = 한국어
//   듣기:          문제 = 소리,          보기 = 그림
import { useEffect, useRef, useState } from 'react'
import { translation, type Word } from '../data/words'
import { useApp, type QuizKind } from '../ctx'
import { demoAutoAchievement } from '../community'
import { awardPractice, completeSession, getState, recordAnswer, recordExam, recordPromo, DAILY_CAP, type Direction } from '../store'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { useStudyClock } from '../activity'
import WordHelp from './WordHelp'
import { Elephant, Icon, ProgressBar, TopBar, shuffle, Pron } from '../ui'
import { Confetti } from './Player'
import { burstFrom, fireworks, floatFrom, sparkleRain } from '../fx'

type QType = 'k2n' | 'n2k' | 'listen'
interface Q {
  word: Word
  type: QType
  options: Word[]
  retry: boolean
}

function pickType(kind: QuizKind, direction: Direction): QType {
  if (kind === 'listen') return 'listen'
  const d = direction === 'mix' ? (Math.random() < 0.5 ? 'ko2n' : 'n2ko') : direction
  return d === 'ko2n' ? 'k2n' : 'n2k'
}

function makeQ(word: Word, type: QType, pool: Word[], retry = false): Q {
  const keyOf = (w: Word) => (type === 'listen' ? w.emoji : type === 'k2n' ? translation(w) : w.ko)
  const seen = new Set([keyOf(word)])
  const distractors: Word[] = []
  for (const w of shuffle(pool)) {
    if (distractors.length === 3) break
    if (w.id === word.id || seen.has(keyOf(w))) continue
    seen.add(keyOf(w))
    distractors.push(w)
  }
  return { word, type, options: shuffle([word, ...distractors]), retry }
}

interface Result {
  firstTry: number
  total: number
  wrong: Word[]
  earned: number
  bonus: number
  stamp: boolean
  passed: boolean
  capHit: boolean
}

export default function Quiz(props: { kind: QuizKind; words: Word[]; pool: Word[]; roundId?: string; tierNo?: number; label: string }) {
  const { kind, words, pool, roundId, tierNo, label } = props
  const { t, tf, replace, pop, home } = useApp()
  useStudyClock()
  const settings = getState().settings
  const isTest = kind === 'exam' || kind === 'promo'

  const [queue, setQueue] = useState<Q[]>(() => words.map((w) => makeQ(w, pickType(kind, settings.direction), pool)))
  const [pos, setPos] = useState(0)
  const [picked, setPicked] = useState<Word | 'timeout' | null>(null)
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [earned, setEarned] = useState(0)
  const [capHit, setCapHit] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const q = queue[pos]
  // 문제가 보인 시각 (너무 빨리 누른 답은 포인트 없음)
  const shownAt = useRef(Date.now())
  useEffect(() => {
    shownAt.current = Date.now()
  }, [pos])
  const answered = picked !== null
  const ok = answered && picked !== 'timeout' && picked.id === q.word.id

  // 문제 시작: 한국어 문제·듣기 문제는 바로 읽어줌
  useEffect(() => {
    if (!q || result) return
    if (q.type === 'listen' || (q.type === 'k2n' && settings.autoSpeak)) speakWord(q.word)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, result])

  useEffect(() => () => stopSpeaking(), [])

  // 제한시간
  const timeLimit = settings.quizSec
  useEffect(() => {
    if (!timeLimit || answered || result) return
    const timer = setTimeout(() => answer('timeout'), timeLimit * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, answered, result, timeLimit])

  const autoNext = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (autoNext.current) clearTimeout(autoNext.current)
  }, [])

  // 타이머·자동 넘김 콜백이 항상 최신 값을 보도록 ref로 관리
  const queueRef = useRef(queue)
  queueRef.current = queue
  const posRef = useRef(pos)
  posRef.current = pos
  const wrongRef = useRef<string[]>([])
  const finished = useRef(false)

  function answer(choice: Word | 'timeout', el?: HTMLElement | null) {
    if (answered) return
    const correct = choice !== 'timeout' && choice.id === q.word.id
    setPicked(choice)
    recordAnswer(q.word.id, correct)
    if (correct) {
      sfx.correct()
      const pts = awardPractice(roundId ?? q.word.roundId, Date.now() - shownAt.current, !q.retry)
      setEarned((e) => e + pts)
      burstFrom(el, { count: 12 })
      if (pts > 0) floatFrom(el, `+${pts} ⭐`)
      if (pts === 0 && getState().dayPoints >= DAILY_CAP) setCapHit(true)
      if (q.type === 'n2k' && settings.autoSpeak) speakWord(q.word)
      autoNext.current = setTimeout(next, q.type === 'n2k' && settings.autoSpeak ? 1500 : 900)
    } else {
      sfx.wrong()
      if (!wrongRef.current.includes(q.word.id)) {
        wrongRef.current = [...wrongRef.current, q.word.id]
        setWrongIds(wrongRef.current)
      }
      if (!isTest) {
        queueRef.current = [...queueRef.current, makeQ(q.word, q.type, pool, true)]
        setQueue(queueRef.current)
      }
      setTimeout(() => speakWord(q.word), 350)
    }
  }

  function next() {
    if (autoNext.current) clearTimeout(autoNext.current)
    autoNext.current = null
    if (posRef.current + 1 < queueRef.current.length) {
      setPos(posRef.current + 1)
      setPicked(null)
    } else finish()
  }

  function finish() {
    if (finished.current) return
    finished.current = true
    stopSpeaking()
    const wrong = wrongRef.current.map((id) => words.find((w) => w.id === id)).filter((w): w is Word => !!w)
    const total = words.length
    const firstTry = total - wrong.length
    const stamp = completeSession()
    let bonus = 0
    let passed = true
    if (kind === 'exam' && roundId) {
      passed = wrong.length === 0
      bonus = recordExam(roundId, firstTry, total)
      // 처음 통과(보너스)면 내 그룹에 '인증' 글 (서버는 트리거가, 데모는 여기서)
      if (bonus > 0) demoAutoAchievement({ type: 'exam', ref: roundId, points: bonus, score: firstTry })
    } else if (kind === 'promo' && tierNo) {
      passed = wrong.length === 0
      bonus = recordPromo(tierNo, passed)
      if (bonus > 0) demoAutoAchievement({ type: 'promo', ref: String(tierNo), points: bonus })
    }
    if (passed) {
      sfx.levelUp()
      setTimeout(() => {
        fireworks(isTest ? 9 : 5)
        sparkleRain(isTest ? 34 : 18)
      }, 200)
    }
    setResult({ firstTry, total, wrong, earned: 0, bonus, stamp, passed, capHit: getState().dayPoints >= DAILY_CAP })
  }

  if (result) {
    return (
      <ResultView
        kind={kind}
        r={{ ...result, earned }}
        label={label}
        onAgain={() => replace({ name: 'quiz', ...props, words: shuffle(words) })}
        onPracticeWrong={() => replace({ name: 'quiz', kind: 'practice', words: result.wrong, pool, roundId, label: t('practiceWrong') })}
        onBack={pop}
        onHome={() => home('learn')}
        t={t}
        tf={tf}
      />
    )
  }

  const answeredCount = pos + (answered ? 1 : 0)
  const showKoPrompt = q.type === 'k2n'
  const showNativePrompt = q.type === 'n2k'

  return (
    <div className="screen">
      <TopBar
        title={label}
        sub={
          <span className="num">
            {Math.min(answeredCount, queue.length)}/{queue.length}
            {isTest && ` · ${t('wrongCount')} ${wrongIds.length}`}
          </span>
        }
      />
      <div className="page quiz-page">
        <ProgressBar value={answeredCount} max={queue.length} />
        {timeLimit > 0 && (
          <div className="countdown thin" aria-hidden="true">
            <div key={pos} className="countdown-fill front" style={{ animationDuration: `${timeLimit}s`, animationPlayState: answered ? 'paused' : 'running' }} />
          </div>
        )}

        <section className="prompt">
          <div className="prompt-ask">{q.type === 'listen' ? t('pickPicture') : q.type === 'k2n' ? t('pickMeaning') : t('pickKorean')}</div>
          {q.retry && <div className="chip retry-chip">{t('wrongAgain')}</div>}
          {showKoPrompt && (
            <>
              <div className="prompt-word ko">{q.word.ko}</div>
              <Pron ko={q.word.ko} block />
            </>
          )}
          {showNativePrompt && (
            <>
              <div className="prompt-emoji" aria-hidden="true">{q.word.emoji}</div>
              <div className="prompt-word lo">{translation(q.word)}</div>
            </>
          )}
          {q.type === 'listen' && (
            <button className="listen-btn" onClick={() => speakWord(q.word)} aria-label={t('listenAgain')}>
              <Icon name="speaker" size={44} />
              <span>{t('listenAgain')}</span>
            </button>
          )}
          {q.type === 'k2n' && (
            <button className="round-btn sm" onClick={() => speakWord(q.word)} aria-label={t('speak')}>
              <Icon name="speaker" />
            </button>
          )}
        </section>

        <div className={q.type === 'listen' ? 'options grid' : 'options'}>
          {q.options.map((o) => {
            const isAnswer = o.id === q.word.id
            const isPicked = picked !== null && picked !== 'timeout' && picked.id === o.id
            const cls = !answered ? '' : isAnswer ? 'good' : isPicked ? 'bad' : 'dim'
            return (
              <button key={o.id} className={`opt ${cls}`} onClick={(e) => answer(o, e.currentTarget)} disabled={answered}>
                {q.type === 'listen' && <span className="opt-emoji big">{o.emoji}</span>}
                {q.type === 'k2n' && (
                  <>
                    <span className="opt-emoji">{o.emoji}</span>
                    <span className="opt-text lo">{translation(o)}</span>
                  </>
                )}
                {q.type === 'n2k' && <span className="opt-text ko">{o.ko}</span>}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className={ok ? 'feedback good' : 'feedback bad'} role="status">
            <div className="feedback-head">
              <strong>{ok ? t('correct') : picked === 'timeout' ? t('timeUp') : t('wrong')}</strong>
              {ok && earned > 0 && <span className="num">{tf('earned', earned)}</span>}
            </div>
            <div className="feedback-word">
              <span className="feedback-emoji" aria-hidden="true">{q.word.emoji}</span>
              <span className="feedback-text">
                <span className="ko">{q.word.ko}</span> <Pron ko={q.word.ko} sm />
                <br />
                <span className="lo">{translation(q.word)}</span>
              </span>
              <button className="round-btn sm" onClick={() => speakWord(q.word)} aria-label={t('speak')}>
                <Icon name="speaker" />
              </button>
            </div>
            {!ok && (
              <button className="btn btn-pink btn-block" onClick={next} autoFocus>
                {t('next')}
              </button>
            )}
          </div>
        )}
        {capHit && <p className="note">{t('dailyCap')}</p>}
      </div>
    </div>
  )
}

function ResultView({
  kind,
  r,
  label,
  onAgain,
  onPracticeWrong,
  onBack,
  onHome,
  t,
  tf,
}: {
  kind: QuizKind
  r: Result
  label: string
  onAgain: () => void
  onPracticeWrong: () => void
  onBack: () => void
  onHome: () => void
  t: ReturnType<typeof useApp>['t']
  tf: ReturnType<typeof useApp>['tf']
}) {
  const [helpWord, setHelpWord] = useState<Word | null>(null)
  const isTest = kind === 'exam' || kind === 'promo'
  let title = t('quizDone')
  if (isTest) title = r.passed ? (kind === 'promo' ? t('promoted') : t('examPass')) : t('examFail')
  const acc = kind === 'promo' && r.passed ? 'crown' : kind === 'exam' && r.passed ? 'grad' : 'bow'
  return (
    <div className="screen">
      <TopBar title={label} onBack={onBack} />
      <div className="page result">
        {r.passed && <Confetti />}
        <div className={r.passed ? 'result-hero pass' : 'result-hero'}>
          <Elephant size={120} acc={acc} mood={r.passed ? 'happy' : 'wow'} className="bounce" />
          <h1 className="result-title">{title}</h1>
          <div className="result-score num">
            {r.firstTry}
            <span>/{r.total}</span>
          </div>
          {isTest && r.passed && kind === 'exam' && r.bonus > 0 && <p className="result-line">{t('unlockedNext')}</p>}
          {isTest && r.passed && r.bonus > 0 && <p className="note">👥 {t('autoShareNote')}</p>}
        </div>

        <div className="result-chips">
          {r.earned > 0 && <span className="chip chip-butter num">⭐ {tf('earned', r.earned)}</span>}
          {r.bonus > 0 && <span className="chip chip-butter num">🎁 {tf('earned', r.bonus)}</span>}
          {r.stamp && <span className="chip chip-mint">☕ {t('stampGot')}</span>}
        </div>
        {r.capHit && <p className="note">{t('dailyCap')}</p>}

        {r.wrong.length > 0 && (
          <section className="panel">
            <h2 className="h3">
              {t('wrongCount')} {r.wrong.length}
            </h2>
            <ul className="wrong-list">
              {r.wrong.map((w) => (
                <li key={w.id}>
                  <span className="wrong-emoji" aria-hidden="true">{w.emoji}</span>
                  <span className="ko">{w.ko}</span>
                  <span className="muted lo">{translation(w)}</span>
                  <button className="mw-help" onClick={() => setHelpWord(w)} aria-label={`${w.ko} ?`}>
                    ?
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="result-actions">
          {isTest && !r.passed && (
            <>
              <button className="btn btn-pink btn-block" onClick={onPracticeWrong}>
                {t('practiceWrong')}
              </button>
              <button className="btn btn-soft btn-block" onClick={onAgain}>
                {t('retryExam')}
              </button>
            </>
          )}
          {isTest && r.passed && (
            <button className="btn btn-butter btn-block" onClick={onHome}>
              {t('toHome')}
            </button>
          )}
          {!isTest && (
            <>
              <button className="btn btn-pink btn-block" onClick={onAgain}>
                {t('again')}
              </button>
              <button className="btn btn-soft btn-block" onClick={onBack}>
                {t('back')}
              </button>
            </>
          )}
        </div>
      </div>
      {helpWord && <WordHelp word={helpWord} onClose={() => setHelpWord(null)} />}
    </div>
  )
}
