import { ROUNDS, roundSets, translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { isQuizOpen, playsOf, setSettings, useStore, viewProgress, UNLOCK_PLAYS, type Direction } from '../store'
import { Icon, ProgressBar, Segmented, Stepper, TopBar, pastel, shuffle } from '../ui'

export default function RoundScreen({ roundId }: { roundId: string }) {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const round = ROUNDS.find((r) => r.id === roundId)!
  const sets = roundSets(round)
  const passed = s.passedRounds.includes(round.id)
  const quizOpen = isQuizOpen(s, round.id)
  const best = s.bestExam[round.id]
  const [done, need] = viewProgress(s, round)
  const resume = s.lastChunk[round.id] ?? 0

  const play = (chunk: number) => push({ name: 'player', roundId, startChunk: chunk })
  const quiz = (kind: 'practice' | 'listen', words: Word[], label: string) => push({ name: 'quiz', kind, words, pool: round.words, roundId, label })

  return (
    <div className="screen">
      <TopBar title={tf('roundN', round.no)} sub={round.title[ui]} />
      <div className="page">
        <section className="round-hero">
          <div className="round-hero-emojis" aria-hidden="true">
            {round.words.slice(0, 5).map((w) => (
              <span key={w.id}>{w.emoji}</span>
            ))}
          </div>
          <button className="btn btn-pink btn-block btn-big" onClick={() => play(resume)}>
            <Icon name="play" size={22} /> {t('autoPlay')}
            <span className="btn-sub">{tf('startFrom', resume + 1)}</span>
          </button>
          <div className="learn-prog">
            <div className="learn-prog-top">
              <span>
                <Icon name="repeat" size={16} /> {t('learnProgress')}
              </span>
              <span className="num">
                {passed ? need : done}/{need}
              </span>
            </div>
            <ProgressBar value={passed ? need : done} max={need} tone={quizOpen ? 'mint' : 'pink'} />
            {!quizOpen && <p className="hint">🎁 {tf('unlockHint', UNLOCK_PLAYS)}</p>}
          </div>
        </section>

        <section className="panel quick">
          <h2 className="h3">{t('settingsHere')}</h2>
          <div className="quick-row">
            <span className="quick-label">{t('repsPerSet')}</span>
            <Stepper value={s.settings.reps} min={1} max={10} onChange={(reps) => setSettings({ reps })} format={(v) => `${v}${t('times')}`} />
          </div>
          <div className="quick-row">
            <span className="quick-label">{t('cardSec')}</span>
            <Stepper value={s.settings.cardSec} min={1} max={10} onChange={(cardSec) => setSettings({ cardSec })} format={(v) => `${v}${t('sec')}`} />
          </div>
          <div className="quick-col">
            <span className="quick-label">{t('direction')}</span>
            <Segmented<Direction>
              name={t('direction')}
              value={s.settings.direction}
              onChange={(direction) => setSettings({ direction })}
              options={[
                { id: 'ko2n', label: `${t('korean')} → ${t('lao')}` },
                { id: 'n2ko', label: `${t('lao')} → ${t('korean')}` },
                { id: 'mix', label: t('dirMix') },
              ]}
            />
          </div>
        </section>

        <ol className="sets">
          {sets.map((words, i) => {
            const plays = playsOf(s, round.id, i)
            const label = `${tf('roundN', round.no)} · ${tf('setN', i + 1)}`
            return (
              <li key={i} className={`set-row c-${pastel(i)}`}>
                <button className="set-main" onClick={() => play(i)} aria-label={`${tf('setN', i + 1)} ${t('play')}`}>
                  <span className="set-no num">{i + 1}</span>
                  <span className="set-body">
                    <span className="set-emojis" aria-hidden="true">
                      {words.map((w) => (
                        <span key={w.id}>{w.emoji}</span>
                      ))}
                    </span>
                    <span className="set-words">
                      {words.map((w) => w.ko).join(' · ')}
                    </span>
                    <span className="set-words lo">{words.map((w) => translation(w)).join(' · ')}</span>
                  </span>
                  <span className="set-side">
                    <span className="hearts" aria-label={`${Math.min(plays, UNLOCK_PLAYS)}/${UNLOCK_PLAYS}`}>
                      {Array.from({ length: UNLOCK_PLAYS }, (_, k) => (
                        <span key={k} className={k < plays ? 'heart on' : 'heart'}>
                          ♥
                        </span>
                      ))}
                    </span>
                    <span className="set-play" aria-hidden="true">
                      <Icon name="play" size={18} />
                    </span>
                  </span>
                </button>
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

        {quizOpen && (
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
    </div>
  )
}
