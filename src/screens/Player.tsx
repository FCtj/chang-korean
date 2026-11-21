// 자동 반복 플레이어
// - 위에는 지금 묶음의 단어 5개를 작은 목록으로 미리 보여주고, 아래 카드에서 한 단어씩 그림·한국어·발음·뜻을 보여줌
// - 「외웠어요」를 누른 단어는 더 이상 나오지 않음. 못 외운 단어만 1~5 → 6~10 → … 순서대로 계속 반복
// - 마지막 묶음이 끝나면 처음부터 다시 (남은 못 외운 단어만). 모두 외우면 끝 → 시험으로
// - review=true 이면 외운 단어까지 전부 복습
import { useEffect, useMemo, useRef, useState } from 'react'
import { ROUNDS, roundSets, translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { completeSession, getState, isKnown, knownCount, recordGroupPass, setKnown, setLastChunk, setSettings, useStore } from '../store'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { Elephant, Icon, Stepper, Toggle, TopBar, pastel, shuffle } from '../ui'

const orderOf = (words: Word[]) => (getState().settings.order === 'random' ? shuffle(words) : words)

export default function Player({ roundId, startChunk, review = false }: { roundId: string; startChunk: number; review?: boolean }) {
  const s = useStore()
  const { t, tf, replace } = useApp()
  const round = ROUNDS.find((r) => r.id === roundId)!
  const sets = useMemo(() => roundSets(round), [round])
  const total = sets.length

  const activeOf = (c: number) => sets[c].filter((w) => review || !isKnown(getState(), w))
  /** from부터(끝나면 처음으로 돌아가며) 못 외운 단어가 있는 묶음 찾기 */
  const findGroup = (from: number): { c: number; wrapped: boolean } | null => {
    for (let k = 0; k < total; k++) {
      const c = (from + k) % total
      if (activeOf(c).length) return { c, wrapped: from + k >= total }
    }
    return null
  }

  const first = useMemo(() => findGroup(Math.min(startChunk, total - 1)), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [chunk, setChunk] = useState(first?.c ?? 0)
  const [queue, setQueue] = useState<Word[]>(() => (first ? orderOf(activeOf(first.c)) : []))
  const [pos, setPos] = useState(0)
  const [rep, setRep] = useState(1)
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [playing, setPlaying] = useState(true)
  const [loop, setLoop] = useState(1)
  const [pending, setPending] = useState<number | null>(null) // "다음 5개!" 화면에서 기다리는 묶음
  const [finished, setFinished] = useState(!first)
  const [toast, setToast] = useState<string | null>(null)
  const sec = s.settings.cardSec
  const reps = s.settings.reps
  const word: Word | undefined = queue[pos]
  const known = knownCount(s, round)

  useEffect(() => setLastChunk(roundId, chunk), [roundId, chunk])
  useEffect(() => () => stopSpeaking(), [])

  // 섞어서 모드: 카드마다 방향을 정해 둠
  const dirs = useMemo(
    () => queue.map(() => (s.settings.direction === 'mix' ? (Math.random() < 0.5 ? 'ko2n' : 'n2ko') : s.settings.direction)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, rep, s.settings.direction],
  )
  const koFirst = dirs[pos] !== 'n2ko'

  function showToast(text: string, ms = 1800) {
    setToast(text)
    setTimeout(() => setToast((cur) => (cur === text ? null : cur)), ms)
  }

  // 한국어가 보이는 순간 발음
  const spokenKey = useRef('')
  useEffect(() => {
    if (!word || pending !== null || finished || !playing || !s.settings.autoSpeak) return
    const key = `${loop}-${chunk}-${rep}-${pos}-${phase}-${word.id}`
    if (spokenKey.current === key) return
    if ((phase === 'front' && koFirst) || (phase === 'back' && !koFirst)) {
      spokenKey.current = key
      speakWord(word)
    }
  }, [loop, chunk, rep, pos, phase, koFirst, word, playing, pending, finished, s.settings.autoSpeak])

  // 자동 넘김
  useEffect(() => {
    if (!playing || pending !== null || finished || !word) return
    const ms = phase === 'front' ? sec * 1000 : Math.max(1200, sec * 600)
    const timer = setTimeout(() => (phase === 'front' ? setPhase('back') : advance()), ms)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, pending, finished, phase, pos, rep, chunk, sec, loop, queue])

  // "다음 5개!" → 잠깐 보여주고 자동으로 다음 묶음
  useEffect(() => {
    if (pending === null || !playing) return
    const timer = setTimeout(() => startChunkAt(pending), 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, playing])

  function startChunkAt(c: number) {
    const g = findGroup(c)
    if (!g) return finishAll()
    setPending(null)
    setChunk(g.c)
    setRep(1)
    setQueue(orderOf(activeOf(g.c)))
    setPos(0)
    setPhase('front')
  }

  function finishAll() {
    stopSpeaking()
    setPending(null)
    setFinished(true)
    completeSession()
    sfx.fanfare()
  }

  function advance() {
    setPhase('front')
    const st = getState()
    let p = pos + 1
    while (p < queue.length && !review && isKnown(st, queue[p])) p++
    if (p < queue.length) {
      setPos(p)
      return
    }
    // 이 묶음 한 번 끝
    const pts = recordGroupPass(roundId, chunk, total, queue.length)
    if (pts > 0) showToast(`⭐ ${tf('earned', pts)}`, 1300)
    const active = activeOf(chunk)
    if (rep < reps && active.length) {
      sfx.tick()
      setRep(rep + 1)
      setQueue(orderOf(active))
      setPos(0)
      return
    }
    // 다음 5개 (못 외운 단어가 있는 묶음으로)
    const g = findGroup(chunk + 1)
    if (!g) return finishAll()
    if (g.wrapped) {
      const stamp = completeSession()
      const nextSec = s.settings.autoFaster ? Math.max(1, sec - 1) : sec
      if (nextSec !== sec) setSettings({ cardSec: nextSec })
      setLoop((l) => l + 1)
      showToast(`${t('loopDone')} ${tf('loopN', loop + 1)}${stamp ? ` · ☕ ${t('stampGot')}` : ''}`, 2600)
    }
    sfx.correct()
    if (g.c === chunk) {
      // 남은 묶음이 지금 묶음뿐이면 "다음 5개!" 없이 바로 다시
      setRep(1)
      setQueue(orderOf(activeOf(chunk)))
      setPos(0)
      return
    }
    setPending(g.c)
  }

  function toggleKnown(w: Word) {
    const on = !isKnown(getState(), w)
    const { points } = setKnown(w, on)
    if (on) {
      sfx.correct()
      if (points > 0) showToast(`✓ ${t('memorized')} · ⭐ ${tf('earned', points)}`, 1300)
      if (!review && word && w.id === word.id) advance()
      else if (!review && activeOf(chunk).length === 0 && !findGroup(chunk)) finishAll()
    } else showToast(t('unmarkHint'), 1600)
  }

  if (finished) {
    return (
      <div className="screen">
        <TopBar title={tf('roundN', round.no)} sub={round.title[s.ui]} />
        <Confetti />
        <div className="page">
          <div className="result-hero pass">
            <Elephant size={130} acc="star" mood="happy" className="bounce" />
            <h1 className="result-title">🎉 {tf('allMemorized', round.words.length)}</h1>
            <p className="result-line">{t('stepOpened')}</p>
          </div>
          <button className="btn btn-butter btn-block btn-big" onClick={() => replace({ name: 'round', roundId })}>
            🎓 {t('goExam')}
          </button>
          <button className="btn btn-soft btn-block" onClick={() => replace({ name: 'player', roundId, startChunk: 0, review: true })}>
            🔁 {t('reviewAll')}
          </button>
        </div>
      </div>
    )
  }

  const group = sets[chunk]
  const pendingWords = pending !== null ? sets[pending] : null

  return (
    <div className="screen">
      <TopBar
        title={`${tf('roundN', round.no)} · ${tf('setOf', chunk + 1, total)}`}
        sub={
          <span className="num">
            {review ? `🔁 ${t('reviewMode')}` : `✓ ${tf('knownOf', known, round.words.length)} · ▶ ${t('autoPlaying')}`}
            {reps > 1 && ` · ${tf('repOf', rep, reps)}`}
          </span>
        }
      />
      <div className="page player-page">
        <div className="groups" aria-label={tf('setOf', chunk + 1, total)}>
          {sets.map((g, k) => {
            const allKnown = g.every((w) => isKnown(s, w))
            return (
              <button
                key={k}
                className={`grp ${k === chunk ? 'now' : allKnown ? 'known' : k < chunk ? 'done' : ''}`}
                onClick={() => startChunkAt(k)}
                aria-label={tf('setN', k + 1)}
              >
                {k === chunk ? k + 1 : ''}
              </button>
            )
          })}
        </div>

        {/* 지금 묶음의 단어 5개 미리 보기 */}
        <ul className="wordlist">
          {group.map((w, k) => {
            const kn = isKnown(s, w)
            const now = !pendingWords && word?.id === w.id
            return (
              <li key={w.id} className={`wl c-${pastel(k + chunk)} ${now ? 'now' : ''} ${kn && !review ? 'known' : ''}`}>
                <span className="wl-emoji" aria-hidden="true">{w.emoji}</span>
                <span className="wl-ko ko">{w.ko}</span>
                <span className="wl-rom">{w.rom}</span>
                <span className="wl-lo lo">{translation(w)}</span>
                <button className={kn ? 'wl-check on' : 'wl-check'} onClick={() => toggleKnown(w)} aria-pressed={kn} aria-label={`${w.ko} ${t('memorized')}`}>
                  <Icon name="check" size={16} />
                </button>
              </li>
            )
          })}
        </ul>

        <div className="countdown" aria-hidden="true">
          {pending === null && word && (
            <div
              key={`${loop}-${chunk}-${rep}-${pos}-${phase}`}
              className={`countdown-fill ${phase}`}
              style={{ animationDuration: `${phase === 'front' ? sec : Math.max(1.2, sec * 0.6)}s`, animationPlayState: playing ? 'running' : 'paused' }}
            />
          )}
        </div>

        {pendingWords ? (
          <div className="flash interlude" role="status">
            <Elephant size={84} acc="bow" mood="happy" className="bounce" />
            <div className="interlude-title">{t('nextFive')}</div>
            <div className="interlude-words">
              {pendingWords.map((w, k) => (
                <span key={w.id} className={isKnown(s, w) && !review ? 'iw known' : 'iw'} style={{ animationDelay: `${k * 0.07}s` }}>
                  <span className="iw-emoji">{w.emoji}</span>
                  <span className="ko">{w.ko}</span>
                </span>
              ))}
            </div>
            <div className="interlude-sub num">{tf('setOf', (pending ?? 0) + 1, total)}</div>
          </div>
        ) : word ? (
          <button className="flash compact" onClick={() => (phase === 'front' ? setPhase('back') : advance())} aria-label={t('tapToReveal')}>
            <span className={`flash-blob c-${pastel(group.indexOf(word) + chunk)}`} aria-hidden="true">
              <span key={`${chunk}-${rep}-${pos}`} className="flash-emoji">
                {word.emoji}
              </span>
            </span>
            {koFirst ? (
              <>
                <span className="card-word ko">{word.ko}</span>
                <span className="rom-pill">{word.rom}</span>
              </>
            ) : (
              <span className="card-word lo">{translation(word)}</span>
            )}
            <span className={phase === 'back' ? 'flash-back show' : 'flash-back'}>
              {phase === 'back' ? (
                koFirst ? (
                  <span className="card-answer lo">{translation(word)}</span>
                ) : (
                  <>
                    <span className="card-answer ko">{word.ko}</span>
                    <span className="rom-pill">{word.rom}</span>
                  </>
                )
              ) : (
                <span className="flash-hint">{t('tapToReveal')}</span>
              )}
            </span>
          </button>
        ) : null}

        {!review && (
          <button className="btn btn-mint btn-block" onClick={() => word && toggleKnown(word)} disabled={!word || pending !== null}>
            <Icon name="check" size={20} /> {t('memorized')}
          </button>
        )}

        <div className="player">
          <button className="round-btn" onClick={() => { setPhase('front'); setPos((i) => Math.max(0, i - 1)) }} disabled={pos === 0 || pending !== null} aria-label={t('prev')}>
            <Icon name="prev" size={26} />
          </button>
          <button className="round-btn" onClick={() => word && speakWord(word)} disabled={!word || pending !== null} aria-label={t('speak')}>
            <Icon name="speaker" size={24} />
          </button>
          <button className="play-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t('pause') : t('play')}>
            <Icon name={playing ? 'pause' : 'play'} size={34} />
          </button>
          <button className="round-btn" onClick={() => (pending !== null ? startChunkAt(pending) : advance())} aria-label={t('next')}>
            <Icon name="next" size={26} />
          </button>
          <button className="round-btn" onClick={() => startChunkAt((chunk + 1) % total)} aria-label={t('nextFive')}>
            <Icon name="skip" size={24} />
          </button>
        </div>

        <section className="panel quick">
          <p className="note">💡 {t('onlyUnknown')}</p>
          <div className="quick-row">
            <span className="quick-label">{t('cardSec')}</span>
            <Stepper value={sec} min={1} max={10} onChange={(v) => setSettings({ cardSec: v })} format={(v) => `${v}${t('sec')}`} />
          </div>
          <div className="quick-row">
            <span className="quick-label">{t('repsPerSet')}</span>
            <Stepper value={reps} min={1} max={10} onChange={(v) => setSettings({ reps: v })} format={(v) => `${v}${t('times')}`} />
          </div>
          <Toggle id="faster" label={t('autoFaster')} on={s.settings.autoFaster} onChange={(v) => setSettings({ autoFaster: v })} />
        </section>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

export function Confetti() {
  const colors = ['#FF8DB3', '#B9A6FF', '#7FD8C2', '#FFD66B', '#FFB59A', '#8CCBFF']
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
