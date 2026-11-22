// 수정 요청 · 제안 창: 단어(발음·뜻·예문·그림)가 틀렸거나 앱에 바라는 점을 운영자에게 보냄
// 로그인하지 않아도 보낼 수 있음. 서버에 못 보내면 메일로 보내기
import { useState } from 'react'
import { useApp } from '../ctx'
import { translation, type Word } from '../data/words'
import { useStore } from '../store'
import { submitFeedback, type FeedbackCategory } from '../backend'
import { CONTACT_EMAIL } from '../config'
import { ED_INFO } from '../edition'

type CatKey = 'fbCatPron' | 'fbCatMeaning' | 'fbCatExample' | 'fbCatPicture' | 'fbCatBug' | 'fbCatIdea' | 'fbCatOther'
const WORD_CATS: [FeedbackCategory, CatKey, string][] = [
  ['pron', 'fbCatPron', '🔊'],
  ['meaning', 'fbCatMeaning', '📖'],
  ['example', 'fbCatExample', '💬'],
  ['picture', 'fbCatPicture', '🖼️'],
  ['other', 'fbCatOther', '✏️'],
]
const APP_CATS: [FeedbackCategory, CatKey, string][] = [
  ['bug', 'fbCatBug', '🐞'],
  ['idea', 'fbCatIdea', '💡'],
  ['other', 'fbCatOther', '✏️'],
]

export default function FeedbackSheet({ word, onClose }: { word?: Word; onClose: () => void }) {
  const s = useStore()
  const { t } = useApp()
  const cats = word ? WORD_CATS : APP_CATS
  const [cat, setCat] = useState<FeedbackCategory>(cats[0][0])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'edit' | 'done' | 'too_many' | 'fail'>('edit')

  const target = word ? `${word.id} ${word.ko}` : undefined
  const context = word ? `${word.rom} · ${translation(word)}`.slice(0, 300) : undefined

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    const r = await submitFeedback({ kind: word ? 'word' : 'app', category: cat, target, context, message: text.trim() })
    setBusy(false)
    setState(r === null ? 'done' : r === 'too_many' ? 'too_many' : 'fail')
  }

  const mailto = (() => {
    const subject = `[${ED_INFO.app}] ${t('fbTitle')}${word ? ` — ${word.ko}` : ''}`
    const body = [word ? `${target}\n${context}` : '', `(${cat})`, text.trim()].filter(Boolean).join('\n\n')
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  })()

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet fb-sheet" role="dialog" aria-label={t('fbTitle')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2 className="h3">{t('fbTitle')}</h2>
        {state === 'done' ? (
          <>
            <p className="fb-done">{t('fbThanks')}</p>
            <button className="btn btn-pink btn-block" onClick={onClose}>
              {t('ok')}
            </button>
          </>
        ) : (
          <>
            {word ? (
              <div className="fb-word">
                <span className="fb-word-emoji" aria-hidden="true">
                  {word.emoji}
                </span>
                <span className="fb-word-ko ko">{word.ko}</span>
                <span className={`fb-word-tr nf-${s.native}`}>{translation(word)}</span>
              </div>
            ) : (
              <p className="note">{t('fbAppIntro')}</p>
            )}
            <div className="fb-cats" role="radiogroup" aria-label={t('fbWhat')}>
              {cats.map(([id, key, icon]) => (
                <button key={id} role="radio" aria-checked={cat === id} className={`fb-cat ${cat === id ? 'on' : ''}`} onClick={() => setCat(id)}>
                  <span aria-hidden="true">{icon}</span> {t(key)}
                </button>
              ))}
            </div>
            <textarea
              className={`input fb-text nf-${s.native}`}
              rows={4}
              maxLength={1000}
              placeholder={t('fbPh')}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                if (state !== 'edit') setState('edit')
              }}
              dir="auto"
            />
            {state === 'too_many' && <p className="fb-err">{t('fbTooMany')}</p>}
            {state === 'fail' && (
              <p className="fb-err">
                {t('fbFail')} ·{' '}
                <a href={mailto} target="_blank" rel="noopener noreferrer">
                  {t('fbMail')}
                </a>
              </p>
            )}
            <div className="fb-actions">
              <button className="btn btn-soft" onClick={onClose}>
                ✕
              </button>
              <button className="btn btn-pink" onClick={send} disabled={busy || !text.trim()}>
                {busy ? '…' : t('fbSend')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
