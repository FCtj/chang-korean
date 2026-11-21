import { ROUNDS, roundSets, translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { isMastered, setSettings, useStore, type Direction } from '../store'
import { nativeName } from '../i18n'
import { Icon, Segmented, Stepper, TopBar, shuffle } from '../ui'

export default function RoundScreen({ roundId }: { roundId: string }) {
  const s = useStore()
  const { t, tf, ui, native, push } = useApp()
  const round = ROUNDS.find((r) => r.id === roundId)!
  const sets = roundSets(round)
  const passed = s.passedRounds.includes(round.id)
  const best = s.bestExam[round.id]
  const ko = t('korean')
  const nn = nativeName(native, ui)

  const startCards = (words: Word[], label: string) => push({ name: 'cards', roundId, words, label })
  const startQuiz = (kind: 'practice' | 'listen', words: Word[], label: string) =>
    push({ name: 'quiz', kind, words, pool: round.words, roundId, label })

  return (
    <div className="screen">
      <TopBar title={tf('roundN', round.no)} sub={round.title[ui]} />
      <div className="page">
        <section className="panel quick">
          <div className="quick-row">
            <span className="quick-label">{t('direction')}</span>
            <Segmented<Direction>
              name={t('direction')}
              value={s.settings.direction}
              onChange={(direction) => setSettings({ direction })}
              options={[
                { id: 'ko2n', label: `${ko} → ${nn}` },
                { id: 'n2ko', label: `${nn} → ${ko}` },
                { id: 'mix', label: t('dirMix') },
              ]}
            />
          </div>
          <div className="quick-row">
            <span className="quick-label">{t('cardSec')}</span>
            <Stepper value={s.settings.cardSec} min={1} max={10} onChange={(cardSec) => setSettings({ cardSec })} format={(v) => `${v}${t('sec')}`} />
          </div>
        </section>

        <ol className="sets">
          {sets.map((words, i) => {
            const m = words.filter((w) => isMastered(s, w)).length
            const label = `${tf('roundN', round.no)} · ${tf('setN', i + 1)}`
            return (
              <li key={i} className="set-row">
                <div className="set-head">
                  <span className="set-name">{tf('setN', i + 1)}</span>
                  <span className="set-range">
                    {words[0].ko} ~ {words[words.length - 1].ko}
                  </span>
                  <span className={m === words.length ? 'chip chip-good num' : 'chip num'}>
                    {m}/{words.length}
                  </span>
                </div>
                <div className="set-emojis" aria-label={words.map((w) => `${w.ko} ${translation(w, native)}`).join(', ')}>
                  {words.map((w) => (
                    <span key={w.id} className={isMastered(s, w) ? 'em on' : 'em'}>
                      {w.emoji}
                    </span>
                  ))}
                </div>
                <div className="set-actions">
                  <button className="btn btn-soft" onClick={() => startCards(words, label)}>
                    <Icon name="cards" size={18} /> {t('modeView')}
                  </button>
                  <button className="btn btn-soft" onClick={() => startQuiz('practice', words, label)}>
                    <Icon name="check" size={18} /> {t('modeQuiz')}
                  </button>
                  <button className="btn btn-soft" onClick={() => startQuiz('listen', words, label)}>
                    <Icon name="speaker" size={18} /> {t('modeListen')}
                  </button>
                </div>
              </li>
            )
          })}
          <li className="set-row set-all">
            <div className="set-head">
              <span className="set-name">
                {t('allWords')} {round.words.length}
              </span>
            </div>
            <div className="set-actions">
              <button className="btn btn-soft" onClick={() => startCards(round.words, `${tf('roundN', round.no)} · ${t('allWords')}`)}>
                <Icon name="cards" size={18} /> {t('modeView')}
              </button>
              <button className="btn btn-soft" onClick={() => startQuiz('practice', shuffle(round.words), `${tf('roundN', round.no)} · ${t('allWords')}`)}>
                <Icon name="check" size={18} /> {t('modeQuiz')}
              </button>
              <button className="btn btn-soft" onClick={() => startQuiz('listen', shuffle(round.words), `${tf('roundN', round.no)} · ${t('allWords')}`)}>
                <Icon name="speaker" size={18} /> {t('modeListen')}
              </button>
            </div>
          </li>
        </ol>

        <section className={passed ? 'exam-card passed' : 'exam-card'}>
          <div className="exam-top">
            <span className="exam-icon"><Icon name="flag" size={26} /></span>
            <div>
              <h2 className="exam-title">{t('exam')}</h2>
              <p className="exam-desc">{t('examDesc')}</p>
            </div>
          </div>
          <div className="exam-meta">
            <span className="chip num">{tf('questions', round.words.length)}</span>
            {best !== undefined && <span className="chip num">{tf('bestScore', best)}</span>}
            {passed && <span className="chip chip-good"><Icon name="check" size={14} /> {t('passed')}</span>}
          </div>
          <button
            className="btn btn-gold btn-block"
            onClick={() => push({ name: 'quiz', kind: 'exam', words: shuffle(round.words), pool: round.words, roundId, label: `${t('exam')} · ${tf('roundN', round.no)}` })}
          >
            {t('startExam')}
          </button>
        </section>
      </div>
    </div>
  )
}
