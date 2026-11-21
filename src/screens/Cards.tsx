// 보기 모드: 카드가 설정한 초마다 자동으로 넘어가고, 끝나면 다시 처음부터 반복
// '반복할수록 빨라지기'를 켜면 한 바퀴마다 1초씩 빨라짐 (최소 1초)
import { useEffect, useMemo, useRef, useState } from 'react'
import { translation, type Word } from '../data/words'
import { useApp } from '../ctx'
import { completeSession, getState, setSettings, useStore } from '../store'
import { nativeName } from '../i18n'
import { sfx, speakWord, stopSpeaking } from '../audio'
import { Icon, Stepper, TopBar, shuffle } from '../ui'

function orderWords(words: Word[]): Word[] {
  const { settings, wordStats } = getState()
  if (settings.order === 'random') return shuffle(words)
  if (settings.order === 'wrong') {
    const score = (w: Word) => {
      const st = wordStats[w.id]
      return st ? st.w * 2 - st.c : 0
    }
    return words.slice().sort((a, b) => score(b) - score(a))
  }
  return words
}

export default function Cards({ words, label }: { roundId: string; words: Word[]; label: string }) {
  const s = useStore()
  const { t, tf, ui, native } = useApp()
  const [list, setList] = useState(() => orderWords(words))
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [playing, setPlaying] = useState(true)
  const [loop, setLoop] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const sec = s.settings.cardSec
  const word = list[idx]

  // 섞어서 모드: 카드마다 방향을 정해 둠
  const dirs = useMemo(
    () => list.map(() => (s.settings.direction === 'mix' ? (Math.random() < 0.5 ? 'ko2n' : 'n2ko') : s.settings.direction)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, loop, s.settings.direction],
  )
  const dir = dirs[idx]
  const koFirst = dir === 'ko2n'

  // 한국어가 보이는 순간에 발음
  const spokenKey = useRef('')
  useEffect(() => {
    const key = `${loop}-${idx}-${phase}`
    if (spokenKey.current === key || !s.settings.autoSpeak || !playing) return
    if ((phase === 'front' && koFirst) || (phase === 'back' && !koFirst)) {
      spokenKey.current = key
      speakWord(word)
    }
  }, [idx, phase, loop, koFirst, word, playing, s.settings.autoSpeak])

  // 자동 넘김 타이머
  useEffect(() => {
    if (!playing) return
    const ms = phase === 'front' ? sec * 1000 : Math.max(1200, sec * 600)
    const timer = setTimeout(() => {
      if (phase === 'front') setPhase('back')
      else advance(1)
    }, ms)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phase, idx, sec, loop])

  useEffect(() => () => stopSpeaking(), [])

  function advance(step: 1 | -1) {
    setPhase('front')
    if (step === -1) {
      setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (idx + 1 < list.length) {
      setIdx(idx + 1)
      return
    }
    // 한 바퀴 끝
    const gotStamp = completeSession()
    const nextSec = s.settings.autoFaster ? Math.max(1, sec - 1) : sec
    if (nextSec !== sec) setSettings({ cardSec: nextSec })
    sfx.fanfare()
    setToast(`${t('loopDone')} ${tf('loopN', loop + 1)} · ${nextSec}${t('sec')}${gotStamp ? ` · ☕ ${t('stampGot')}` : ''}`)
    setTimeout(() => setToast(null), 2600)
    setList(orderWords(words))
    setIdx(0)
    setLoop((l) => l + 1)
  }

  const front = koFirst ? (
    <>
      <div className="card-word ko">{word.ko}</div>
      <div className="card-rom">{word.rom}</div>
    </>
  ) : (
    <div className={`card-word ${native}`}>{translation(word, native)}</div>
  )
  const back = koFirst ? (
    <div className={`card-answer ${native}`}>{translation(word, native)}</div>
  ) : (
    <>
      <div className="card-answer ko">{word.ko}</div>
      <div className="card-rom">{word.rom}</div>
    </>
  )

  return (
    <div className="screen">
      <TopBar
        title={label}
        sub={
          <span className="num">
            {idx + 1}/{list.length} · {tf('loopN', loop)}
          </span>
        }
      />
      <div className="page cards-page">
        <div className="countdown" aria-hidden="true">
          <div
            key={`${loop}-${idx}-${phase}`}
            className={`countdown-fill ${phase}`}
            style={{
              animationDuration: `${phase === 'front' ? sec : Math.max(1.2, sec * 0.6)}s`,
              animationPlayState: playing ? 'running' : 'paused',
            }}
          />
        </div>

        <button className="flash" onClick={() => (phase === 'front' ? setPhase('back') : advance(1))} aria-label={t('tapToReveal')}>
          <div className="flash-emoji" aria-hidden="true">{word.emoji}</div>
          {front}
          <div className={phase === 'back' ? 'flash-back show' : 'flash-back'}>{phase === 'back' ? back : <span className="flash-hint">{t('tapToReveal')}</span>}</div>
        </button>

        <div className="card-tools">
          <button className="icon-btn lg" onClick={() => speakWord(word)} aria-label={t('speak')}>
            <Icon name="speaker" size={26} />
          </button>
          <span className="dir-chip">
            {koFirst ? `${t('korean')} → ${nativeName(native, ui)}` : `${nativeName(native, ui)} → ${t('korean')}`}
          </span>
        </div>

        <div className="player">
          <button className="icon-btn lg" onClick={() => advance(-1)} disabled={idx === 0} aria-label={t('prev')}>
            <Icon name="prev" size={26} />
          </button>
          <button className="play-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t('pause') : t('play')}>
            <Icon name={playing ? 'pause' : 'play'} size={32} />
          </button>
          <button className="icon-btn lg" onClick={() => advance(1)} aria-label={t('next')}>
            <Icon name="next" size={26} />
          </button>
        </div>

        <div className="panel quick">
          <div className="quick-row">
            <span className="quick-label">{t('cardSec')}</span>
            <Stepper value={sec} min={1} max={10} onChange={(cardSec) => setSettings({ cardSec })} format={(v) => `${v}${t('sec')}`} />
          </div>
          <label className="toggle-row" htmlFor="faster">
            <span>{t('autoFaster')}</span>
            <input id="faster" type="checkbox" className="toggle" checked={s.settings.autoFaster} onChange={(e) => setSettings({ autoFaster: e.target.checked })} />
          </label>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
