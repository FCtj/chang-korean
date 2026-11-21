// 자동 반복 플레이어
// 1~5 → "다음 5개!" → 6~10 → … 순서대로 계속, 마지막 묶음이 끝나면 처음부터 다시
// (설정에서 '5개씩 반복'을 2번 이상으로 하면 같은 5개를 그만큼 반복한 뒤 넘어감)
// 버튼을 누르지 않아도 계속 자동으로 이어집니다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ROUNDS, roundSets, translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { completeSession, getState, recordChunkPlay, setLastChunk, setSettings, useStore } from '../store'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { Elephant, Icon, Stepper, Toggle, TopBar, pastel, shuffle } from '../ui'

const orderOf = (words: Word[]) => (getState().settings.order === 'random' ? shuffle(words) : words)

export default function Player({ roundId, startChunk }: { roundId: string; startChunk: number }) {
  const s = useStore()
  const { t, tf } = useApp()
  const round = ROUNDS.find((r) => r.id === roundId)!
  const sets = useMemo(() => roundSets(round), [round])
  const total = sets.length

  const [chunk, setChunk] = useState(Math.min(startChunk, total - 1))
  const [rep, setRep] = useState(1)
  const [order, setOrder] = useState<Word[]>(() => orderOf(sets[Math.min(startChunk, total - 1)]))
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [playing, setPlaying] = useState(true)
  const [loop, setLoop] = useState(1)
  const [pending, setPending] = useState<number | null>(null) // "다음 5개!" 화면에서 기다리는 다음 묶음
  const [toast, setToast] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const sec = s.settings.cardSec
  const reps = s.settings.reps
  const word = order[idx]

  useEffect(() => setLastChunk(roundId, chunk), [roundId, chunk])
  useEffect(() => () => stopSpeaking(), [])

  // 섞어서 모드: 카드마다 방향을 정해 둠
  const dirs = useMemo(
    () => order.map(() => (s.settings.direction === 'mix' ? (Math.random() < 0.5 ? 'ko2n' : 'n2ko') : s.settings.direction)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, rep, s.settings.direction],
  )
  const koFirst = dirs[idx] === 'ko2n'

  function showToast(text: string, ms = 2200) {
    setToast(text)
    setTimeout(() => setToast((cur) => (cur === text ? null : cur)), ms)
  }

  // 한국어가 보이는 순간 발음
  const spokenKey = useRef('')
  useEffect(() => {
    if (pending !== null || !playing || !s.settings.autoSpeak) return
    const key = `${loop}-${chunk}-${rep}-${idx}-${phase}`
    if (spokenKey.current === key) return
    if ((phase === 'front' && koFirst) || (phase === 'back' && !koFirst)) {
      spokenKey.current = key
      speakWord(word)
    }
  }, [loop, chunk, rep, idx, phase, koFirst, word, playing, pending, s.settings.autoSpeak])

  // 자동 넘김
  useEffect(() => {
    if (!playing || pending !== null) return
    const ms = phase === 'front' ? sec * 1000 : Math.max(1200, sec * 600)
    const timer = setTimeout(() => (phase === 'front' ? setPhase('back') : advance()), ms)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, pending, phase, idx, rep, chunk, sec, loop])

  // "다음 5개!" 화면 → 잠깐 보여주고 자동으로 다음 묶음 시작
  useEffect(() => {
    if (pending === null || !playing) return
    const timer = setTimeout(() => startChunkAt(pending), 1300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, playing])

  function startChunkAt(c: number) {
    setPending(null)
    setChunk(c)
    setRep(1)
    setOrder(orderOf(sets[c]))
    setIdx(0)
    setPhase('front')
  }

  function advance() {
    setPhase('front')
    if (idx + 1 < order.length) {
      setIdx(idx + 1)
      return
    }
    // 5개 한 번 반복 끝
    const { points, unlocked } = recordChunkPlay(roundId, chunk, total)
    if (unlocked) {
      sfx.fanfare()
      setCelebrate(true)
      setTimeout(() => setCelebrate(false), 3200)
    } else if (points > 0) showToast(`⭐ ${tf('earned', points)}`, 1400)

    if (rep < reps) {
      sfx.tick()
      setRep(rep + 1)
      setOrder(orderOf(sets[chunk]))
      setIdx(0)
      return
    }
    // 이 묶음 반복 끝 → 다음 5개
    let next = chunk + 1
    if (next >= total) {
      next = 0
      const stamp = completeSession()
      const nextSec = s.settings.autoFaster ? Math.max(1, sec - 1) : sec
      if (nextSec !== sec) setSettings({ cardSec: nextSec })
      setLoop((l) => l + 1)
      showToast(`${t('loopDone')} ${tf('loopN', loop + 1)}${stamp ? ` · ☕ ${t('stampGot')}` : ''}`, 2800)
    }
    sfx.correct()
    setPending(next)
  }

  function goPrevCard() {
    setPhase('front')
    setIdx((i) => Math.max(0, i - 1))
  }

  const blob = pastel(idx + chunk)
  const pendingWords = pending !== null ? sets[pending] : null

  return (
    <div className="screen">
      <TopBar
        title={`${tf('roundN', round.no)} · ${tf('setOf', chunk + 1, total)}`}
        sub={
          <span className="num">
            {reps > 1 ? `🔁 ${tf('repOf', rep, reps)}` : `▶ ${t('autoPlaying')}`}
            {loop > 1 && ` · ${tf('loopN', loop)}`}
          </span>
        }
      />
      <div className="page player-page">
        <div className="groups" aria-label={tf('setOf', chunk + 1, total)}>
          {sets.map((g, k) => (
            <button
              key={k}
              className={`grp ${k === chunk ? 'now' : k < chunk ? 'done' : ''}`}
              onClick={() => startChunkAt(k)}
              aria-label={tf('setN', k + 1)}
            >
              {k === chunk ? g[0].emoji : ''}
            </button>
          ))}
        </div>
        <div className="strip" aria-hidden="true">
          {order.map((w, k) => (
            <span key={w.id} className={`bead c-${pastel(k + chunk)} ${k === idx ? 'now' : k < idx ? 'done' : ''}`}>
              {w.emoji}
            </span>
          ))}
        </div>

        <div className="countdown" aria-hidden="true">
          {pending === null && (
            <div
              key={`${loop}-${chunk}-${rep}-${idx}-${phase}`}
              className={`countdown-fill ${phase}`}
              style={{ animationDuration: `${phase === 'front' ? sec : Math.max(1.2, sec * 0.6)}s`, animationPlayState: playing ? 'running' : 'paused' }}
            />
          )}
        </div>

        {pendingWords ? (
          <div className="flash interlude" role="status">
            <Elephant size={96} acc="bow" mood="happy" className="bounce" />
            <div className="interlude-title">{t('nextFive')}</div>
            <div className="interlude-emojis">
              {pendingWords.map((w, k) => (
                <span key={w.id} style={{ animationDelay: `${k * 0.08}s` }}>
                  {w.emoji}
                </span>
              ))}
            </div>
            <div className="interlude-sub num">{tf('setOf', (pending ?? 0) + 1, total)}</div>
          </div>
        ) : (
          <button className="flash" onClick={() => (phase === 'front' ? setPhase('back') : advance())} aria-label={t('tapToReveal')}>
            <span className={`flash-blob c-${blob}`} aria-hidden="true">
              <span key={`${chunk}-${rep}-${idx}`} className="flash-emoji">
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
        )}

        <div className="player">
          <button className="round-btn" onClick={goPrevCard} disabled={idx === 0 || pending !== null} aria-label={t('prev')}>
            <Icon name="prev" size={26} />
          </button>
          <button className="round-btn" onClick={() => speakWord(word)} disabled={pending !== null} aria-label={t('speak')}>
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
          <div className="quick-row">
            <span className="quick-label">{t('repsPerSet')}</span>
            <Stepper value={reps} min={1} max={10} onChange={(v) => setSettings({ reps: v })} format={(v) => `${v}${t('times')}`} />
          </div>
          <div className="quick-row">
            <span className="quick-label">{t('cardSec')}</span>
            <Stepper value={sec} min={1} max={10} onChange={(v) => setSettings({ cardSec: v })} format={(v) => `${v}${t('sec')}`} />
          </div>
          <Toggle id="faster" label={t('autoFaster')} on={s.settings.autoFaster} onChange={(v) => setSettings({ autoFaster: v })} />
        </section>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {celebrate && (
        <div className="celebrate" role="status">
          <Confetti />
          <div className="celebrate-card">
            <Elephant size={110} acc="star" mood="happy" className="bounce" />
            <div className="celebrate-title">🎉 {t('stepOpened')}</div>
          </div>
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
