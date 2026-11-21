import { ROUNDS, roundSets, translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { isKnown, isQuizOpen, knownCount, setKnown, setSettings, useStore, type Direction } from '../store'
import { Icon, ProgressBar, Segmented, Stepper, TopBar, pastel, shuffle } from '../ui'

export default function RoundScreen({ roundId }: { roundId: string }) {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const round = ROUNDS.find((r) => r.id === roundId)!
  const sets = roundSets(round)
  const passed = s.passedRounds.includes(round.id)
  const quizOpen = isQuizOpen(s, round.id)
  const best = s.bestExam[round.id]
  const known = knownCount(s, round)
  const allKnown = known === round.words.length
  const resume = s.lastChunk[round.id] ?? 0

  const play = (chunk: number, review = false) => push({ name: 'player', roundId, startChunk: chunk, review })
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
          {!allKnown && (
            <button className="btn btn-pink btn-block btn-big" onClick={() => play(resume)}>
              <Icon name="play" size={22} /> {t('playUnknown')}
              <span className="btn-sub">{tf('startFrom', resume + 1)}</span>
            </button>
          )}
          <button className={allKnown ? 'btn btn-pink btn-block btn-big' : 'btn btn-soft btn-block'} onClick={() => play(0, true)}>
            🔁 {t('reviewAll')}
          </button>
          <div className="learn-prog">
            <div className="learn-prog-top">
              <span>
                <Icon name="check" size={16} /> {t('knownProgress')}
              </span>
              <span className="num">
                {known}/{round.words.length}
              </span>
            </div>
            <ProgressBar value={known} max={round.words.length} tone={allKnown ? 'mint' : 'pink'} />
            {!quizOpen && <p className="hint">🎁 {tf('learnHint', round.words.length)}</p>}
          </div>
        </section>

        <ol className="sets">
          {sets.map((words, i) => {
            const k = words.filter((w) => isKnown(s, w)).length
            const label = `${tf('roundN', round.no)} · ${tf('setN', i + 1)}`
            return (
              <li key={i} className={`set-row c-${pastel(i)} ${k === words.length ? 'all-known' : ''}`}>
                <div className="set-head2">
                  <span className="set-no num">{k === words.length ? <Icon name="check" size={18} /> : i + 1}</span>
                  <span className="set-title">{tf('setN', i + 1)}</span>
                  <span className={k === words.length ? 'chip chip-mint num' : 'chip num'}>{tf('knownOf', k, words.length)}</span>
                  <button className="set-play" onClick={() => play(i)} aria-label={`${tf('setN', i + 1)} ${t('play')}`}>
                    <Icon name="play" size={18} />
                  </button>
                </div>
                <ul className="mini-words">
                  {words.map((w) => {
                    const kn = isKnown(s, w)
                    return (
                      <li key={w.id} className={kn ? 'known' : ''}>
                        <button className="mw" onClick={() => setKnown(w, !kn)} aria-pressed={kn} aria-label={`${w.ko} ${t('memorized')}`}>
                          <span className="mw-emoji" aria-hidden="true">{w.emoji}</span>
                          <span className="mw-ko ko">{w.ko}</span>
                          <span className="mw-lo lo">{translation(w)}</span>
                          <span className="mw-check" aria-hidden="true">
                            <Icon name="check" size={13} />
                          </span>
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

        <section className="panel quick">
          <h2 className="h3">{t('settingsHere')}</h2>
          <div className="quick-row">
            <span className="quick-label">{t('cardSec')}</span>
            <Stepper value={s.settings.cardSec} min={1} max={10} onChange={(cardSec) => setSettings({ cardSec })} format={(v) => `${v}${t('sec')}`} />
          </div>
          <div className="quick-row">
            <span className="quick-label">{t('repsPerSet')}</span>
            <Stepper value={s.settings.reps} min={1} max={10} onChange={(reps) => setSettings({ reps })} format={(v) => `${v}${t('times')}`} />
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
