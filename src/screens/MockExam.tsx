// 🇰🇷 국적·영주 준비 — 모의 평가 (연습용): 문제 은행에서 주제를 고르게 20문항
// 문제는 한국어, 아래에 내 언어 번역(끄고 켤 수 있음). 고르면 바로 정답·설명. 60점 이상 합격
import { useMemo, useRef, useState } from 'react'
import { POINTS_ENABLED } from '../config'
import { useApp } from '../ctx'
import { MOCK_QUESTIONS, MOCK_ROUND_COUNT, mockRound, type MockQuestion } from '../data/citizen-quiz'
import { addActivity, recordMock, useStore } from '../store'
import { sfx, speakText } from '../audio'
import { burstFrom, fireworks, sparkleRain } from '../fx'
import { useStudyClock } from '../activity'
import { Elephant, Icon, TopBar, shuffle } from '../ui'

const TOPIC_ICON: Record<MockQuestion['topic'], string> = {
  symbols: '🇰🇷',
  democracy: '🗳️',
  law: '⚖️',
  history: '📜',
  geography: '🗺️',
  economy: '💰',
  culture: '🎎',
  life: '🏠',
}
const COUNT = 20
// 몽골어 질문·설명 (있으면)
// 몽골어·아랍어 문항 번역: citizen-quiz-mn*.ts · citizen-quiz-ar*.ts (기본 + 추가 문제) 를 모두 합침
type MockTr = Record<string, { q: string; explain: string }>
const mergeTr = (mods: Record<string, Record<string, unknown>>): MockTr => Object.assign({}, ...Object.values(mods).flatMap((m) => Object.values(m)))
const MOCK_MN: MockTr = mergeTr(import.meta.glob<Record<string, unknown>>('../data/citizen-quiz-mn*.ts', { eager: true }))
const MOCK_AR: MockTr = mergeTr(import.meta.glob<Record<string, unknown>>('../data/citizen-quiz-ar*.ts', { eager: true }))
const MOCK_EXTRA = { mn: MOCK_MN, ar: MOCK_AR }
const PASS = 60

/** 주제마다 고르게 뽑기 */
function pick(): MockQuestion[] {
  const byTopic = new Map<string, MockQuestion[]>()
  for (const q of shuffle([...MOCK_QUESTIONS])) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q])
  const out: MockQuestion[] = []
  while (out.length < Math.min(COUNT, MOCK_QUESTIONS.length)) {
    for (const list of byTopic.values()) {
      const q = list.shift()
      if (q && out.length < COUNT) out.push(q)
    }
  }
  return shuffle(out)
}

export default function MockExam() {
  const s = useStore()
  const { t, tf, ui, pop } = useApp()
  useStudyClock()
  // 회차: 1…20 (고정 문제) · 0 = 무작위 20문항 · null = 회차 고르는 화면
  const [mockNo, setMockNo] = useState<number | null>(null)
  const [round, setRound] = useState(0)
  const questions = useMemo(() => (mockNo ? mockRound(mockNo) : pick()), [round, mockNo])
  const [i, setI] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const [showTr, setShowTr] = useState(true)
  const [result, setResult] = useState<{ score: number; points: number } | null>(null)
  const optRefs = useRef<(HTMLButtonElement | null)[]>([])
  const native = s.native
  const lang = ui === 'ko' ? native : ui
  const isExtra = (x: string): x is 'mn' | 'ar' => x === 'mn' || x === 'ar'
  // 몽골어·아랍어는 따로 번역한 파일에서 (문항 id 로)
  const tr = (l: { ko: string; lo: string; th: string; vi: string }, id: string, part: 'q' | 'explain') =>
    isExtra(lang) ? MOCK_EXTRA[lang][id]?.[part] || l.ko : l[lang] || l[isExtra(native) ? 'lo' : native]
  const q = questions[i]

  const choose = (k: number) => {
    if (chosen !== null) return
    setChosen(k)
    addActivity({ questions: 1 })
    if (k === q.answer) {
      setRight((r) => r + 1)
      sfx.correct()
      burstFrom(optRefs.current[k], { count: 10 })
    } else sfx.wrong()
  }

  const next = () => {
    if (i + 1 < questions.length) {
      setI(i + 1)
      setChosen(null)
      return
    }
    const r = recordMock(right, questions.length, mockNo || undefined)
    setResult(r)
    if (r.score >= PASS) {
      sfx.levelUp()
      setTimeout(() => {
        fireworks(8)
        sparkleRain(30)
      }, 200)
    }
  }

  const start = (no: number | null) => {
    setMockNo(no)
    setRound((n) => n + 1)
    setI(0)
    setChosen(null)
    setRight(0)
    setResult(null)
  }
  const restart = () => start(mockNo)

  // 회차 고르기
  if (mockNo === null) {
    return (
      <div className="screen">
        <TopBar title={`📝 ${t('mockTitle')}`} />
        <div className="page mock-pick">
          <p className="note">{t('mockPick')}</p>
          <div className="mock-rounds">
            {Array.from({ length: MOCK_ROUND_COUNT }, (_, k) => k + 1).map((n) => {
              const best = s.mockRounds?.[n]
              return (
                <button key={n} className={`mock-round ${best == null ? '' : best >= PASS ? 'pass' : 'tried'}`} onClick={() => start(n)}>
                  <span className="mock-round-no">{tf('mockRoundN', n)}</span>
                  <span className="mock-round-best num">{best == null ? '–' : `${best >= PASS ? '✅' : '📝'} ${best}`}</span>
                </button>
              )
            })}
          </div>
          <button className="btn btn-soft btn-block" onClick={() => start(0)}>
            {t('mockRandom')}
          </button>
          <p className="note">{t('mockNote')}</p>
        </div>
      </div>
    )
  }

  if (result) {
    const pass = result.score >= PASS
    return (
      <div className="screen">
        <TopBar title={`📝 ${t('mockTitle')}`} />
        <div className="page result">
          <div className={pass ? 'result-hero pass' : 'result-hero'}>
            <Elephant size={120} acc={pass ? 'grad' : 'star'} mood={pass ? 'happy' : 'wow'} className="bounce" />
            <h1 className="result-title">{pass ? t('mockPass') : t('mockFail')}</h1>
            <div className="result-score num">
              {result.score}
              <span>/100</span>
            </div>
            <p className="result-line">
              {right}/{questions.length} · {tf('mockBest', Math.max(s.bestMock, result.score))}
            </p>
          </div>
          {POINTS_ENABLED && result.points > 0 && (
            <div className="result-chips">
              <span className="chip chip-butter num">⭐ {tf('earned', result.points)}</span>
            </div>
          )}
          <p className="note">{t('mockNote')}</p>
          {mockNo > 0 && mockNo < MOCK_ROUND_COUNT && (
            <button className="btn btn-pink btn-block btn-big" onClick={() => start(mockNo + 1)}>
              {t('mockNextRound')} · {tf('mockRoundN', mockNo + 1)} →
            </button>
          )}
          <button className={mockNo > 0 && mockNo < MOCK_ROUND_COUNT ? 'btn btn-soft btn-block' : 'btn btn-pink btn-block btn-big'} onClick={restart}>
            🔁 {t('mockRetry')}
          </button>
          <button className="btn btn-soft btn-block" onClick={() => setMockNo(null)}>
            📋 {t('mockList')}
          </button>
          <button className="btn btn-soft btn-block" onClick={pop}>
            {t('back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar title={`📝 ${t('mockTitle')}${mockNo ? ` · ${tf('mockRoundN', mockNo)}` : ''}`} sub={`${i + 1}/${questions.length}`} onBack={() => setMockNo(null)} />
      <div className="page mock">
        <div className="track-progress" aria-hidden="true">
          <span style={{ width: `${Math.round((i / questions.length) * 100)}%` }} />
        </div>
        <section className="panel mock-q">
          <div className="mock-q-top">
            <span className="mock-topic" aria-hidden="true">
              {TOPIC_ICON[q.topic]}
            </span>
            <button className="round-btn sm" onClick={() => speakText(q.q.ko, 'ko')} aria-label={t('speak')}>
              <Icon name="speaker" size={18} />
            </button>
          </div>
          <p className="mock-q-ko ko">{q.q.ko}</p>
          {showTr && <p className={`mock-q-tr nf-${native}`}>{tr(q.q, q.id, 'q')}</p>}
          <button className="link-btn" onClick={() => setShowTr((v) => !v)}>
            {showTr ? '🙈' : '👀'} {t('mockShowTr')}
          </button>
        </section>
        <div className="mock-options">
          {q.options.map((o, k) => {
            const state = chosen === null ? '' : k === q.answer ? 'good' : k === chosen ? 'bad' : 'dim'
            return (
              <button
                key={k}
                ref={(el) => {
                  optRefs.current[k] = el
                }}
                className={`opt mock-opt ${state}`}
                onClick={() => choose(k)}
                disabled={chosen !== null}
              >
                <span className="mock-opt-no num">{k + 1}</span>
                <span className="ko">{o}</span>
              </button>
            )
          })}
        </div>
        {chosen !== null && (
          <section className={chosen === q.answer ? 'feedback good' : 'feedback bad'}>
            <strong>{chosen === q.answer ? `✅ ${t('mockCorrect')}` : `❌ ${t('mockWrongAns')} ${q.options[q.answer]}`}</strong>
            <p className="ko">{q.explain.ko}</p>
            <p className={`nf-${native}`}>{tr(q.explain, q.id, 'explain')}</p>
            <button className="btn btn-pink btn-block" onClick={next}>
              {t('nextLabel')} →
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
