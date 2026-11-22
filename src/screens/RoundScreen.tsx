import { findRound, roundSets, translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { isQuizOpen, isStepKnown, setStepKnown, stepKnownCount, stepOf, stepSizesOf, useStore } from '../store'
import { Icon, ProgressBar, TopBar, pastel, shuffle } from '../ui'
import { StepBar } from './Player'
import WordHelp from './WordHelp'
import { useState } from 'react'

export default function RoundScreen({ roundId }: { roundId: string }) {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const [helpWord, setHelpWord] = useState<Word | null>(null)
  const round = findRound(roundId)
  const sizes = stepSizesOf(round)
  const sets = roundSets(round)
  const passed = s.passedRounds.includes(round.id)
  const quizOpen = isQuizOpen(s, round.id)
  const best = s.bestExam[round.id]
  const step = stepOf(s, round.id) // 1부터, sizes.length+1 = 끝
  const done = step > sizes.length
  const known = done ? round.words.length : stepKnownCount(s, round, step)
  const isK = (w: Word) => done || isStepKnown(s, w, step)

  const play = (review = false) => push({ name: 'player', roundId, startChunk: review ? 0 : -1, review })
  const quiz = (kind: 'practice' | 'listen', words: Word[], label: string) => push({ name: 'quiz', kind, words, pool: round.words, roundId, label })

  return (
    <div className="screen">
      <TopBar title={round.pack ? `${round.pack.icon} ${round.title[ui]}` : tf('roundN', round.no)} sub={round.pack ? round.pack.desc[ui] : round.title[ui]} />
      <div className="page">
        <section className="round-hero">
          <div className="round-hero-emojis" aria-hidden="true">
            {round.words.slice(0, 5).map((w) => (
              <span key={w.id}>{w.emoji}</span>
            ))}
          </div>
          <StepBar step={step} sizes={sizes} t={t} tf={tf} />
          {!done && (
            <div className="learn-prog">
              <div className="learn-prog-top">
                <span>
                  <Icon name="check" size={16} /> {tf('stepName', step)} · {tf('stepSize', sizes[step - 1])}
                </span>
                <span className="num">
                  {known}/{round.words.length}
                </span>
              </div>
              <ProgressBar value={known} max={round.words.length} />
            </div>
          )}
          {!done && (
            <button className="btn btn-pink btn-block btn-big" onClick={() => play()}>
              <Icon name="play" size={22} /> {known > 0 || step > 1 ? t('continueStep') : tf('startStep', step)}
              <span className="btn-sub">
                {tf('stepName', step)} · {tf('stepSize', sizes[step - 1])}
              </span>
            </button>
          )}
          <button className={done ? 'btn btn-pink btn-block btn-big' : 'btn btn-soft btn-block'} onClick={() => play(true)}>
            🔁 {t('reviewAll')}
          </button>
          {!quizOpen && <p className="hint">🎁 {round.pack ? t('packsSub') : tf('stepHint', round.words.length)}</p>}
        </section>

        <ol className="sets">
          {sets.map((words, i) => {
            const k = words.filter(isK).length
            const label = `${tf('roundN', round.no)} · ${tf('setN', i + 1)}`
            return (
              <li key={i} className={`set-row c-${pastel(i)} ${k === words.length ? 'all-known' : ''}`}>
                <div className="set-head2">
                  <span className="set-no num">{k === words.length ? <Icon name="check" size={18} /> : i + 1}</span>
                  <span className="set-title">{tf('setN', i + 1)}</span>
                  <span className={k === words.length ? 'chip chip-mint num' : 'chip num'}>{tf('knownOf', k, words.length)}</span>
                </div>
                <ul className="mini-words">
                  {words.map((w) => {
                    const kn = isK(w)
                    return (
                      <li key={w.id} className={kn ? 'known' : ''}>
                        <button className="mw" onClick={() => !done && setStepKnown(w, step, !kn)} disabled={done} aria-pressed={kn} aria-label={`${w.ko} ${t('memorized')}`}>
                          <span className="mw-emoji" aria-hidden="true">{w.emoji}</span>
                          <span className="mw-ko ko">{w.ko}</span>
                          <span className="mw-lo lo">{translation(w)}</span>
                          <span className="mw-check" aria-hidden="true">
                            <Icon name="check" size={13} />
                          </span>
                        </button>
                        <button className="mw-help" onClick={() => setHelpWord(w)} aria-label={`${w.ko} ${t('wordHelp')}`}>
                          ?
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {quizOpen && (
                  <div className="set-actions">
                    <button className="btn btn-soft sm" onClick={() => quiz('practice', words, label)}>
                      <Icon name="check" size={16} /> {t('modeQuiz')}
                    </button>
                    <button className="btn btn-soft sm" onClick={() => quiz('listen', words, label)}>
                      <Icon name="speaker" size={16} /> {t('modeListen')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        {quizOpen && !round.pack && (
          <section className={passed ? 'exam-card passed' : 'exam-card'}>
            <div className="exam-top">
              <span className="exam-icon" aria-hidden="true">
                🎓
              </span>
              <div>
                <h2 className="exam-title">
                  {t('exam')} {!passed && <span className="chip chip-pink tiny">{t('newBadge')}</span>}
                </h2>
                <p className="exam-desc">{t('examDesc')}</p>
              </div>
            </div>
            <div className="exam-meta">
              <span className="chip num">{tf('questions', round.words.length)}</span>
              {best !== undefined && <span className="chip num">{tf('bestScore', best)}</span>}
              {passed && (
                <span className="chip chip-mint">
                  <Icon name="check" size={14} /> {t('passed')}
                </span>
              )}
            </div>
            <div className="exam-actions">
              <button className="btn btn-soft" onClick={() => quiz('practice', shuffle(round.words), `${tf('roundN', round.no)} · ${t('practice')}`)}>
                {t('practice')}
              </button>
              <button
                className="btn btn-butter"
                onClick={() => push({ name: 'quiz', kind: 'exam', words: shuffle(round.words), pool: round.words, roundId, label: `${t('exam')} · ${tf('roundN', round.no)}` })}
              >
                {t('startExam')}
              </button>
            </div>
          </section>
        )}
      </div>
      {helpWord && <WordHelp word={helpWord} onClose={() => setHelpWord(null)} />}
    </div>
  )
}
