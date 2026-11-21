import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Lang } from '../data/words'
import { useApp } from '../ctx'
import type { UiLang } from '../i18n'
import { resetAll, setSettings, update, useStore, type Direction, type Order } from '../store'
import { hasVoice, openVoiceInstall, speakText } from '../audio'
import { Icon, Segmented, Stepper, Toggle } from '../ui'

const SAMPLE: Partial<Record<Lang, string>> = { ko: '안녕하세요', lo: 'ສະບາຍດີ' }

export default function SettingsScreen() {
  const s = useStore()
  const { t, push } = useApp()
  const [name, setName] = useState(s.nickname)
  const [voices, setVoices] = useState<{ ko: boolean | null; lo: boolean | null }>({ ko: null, lo: null })
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    let alive = true
    ;(['ko', 'lo'] as const).forEach((l) => hasVoice(l).then((ok) => alive && setVoices((v) => ({ ...v, [l]: ok }))))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="page">
      <h1 className="h1">{t('tabSettings')}</h1>

      <section className="panel form">
        <h2 className="h3">🐘 {t('account')}</h2>
        <div className="field">
          <label htmlFor="nick-edit">{t('nickname')}</label>
          <input
            id="nick-edit"
            className="input"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && update((st) => ({ ...st, nickname: name.trim() }))}
          />
        </div>
        <div className="field">
          <span className="label">{t('uiLang')}</span>
          <Segmented<UiLang>
            name={t('uiLang')}
            value={s.ui}
            onChange={(l) => update((st) => ({ ...st, ui: l }))}
            options={[
              { id: 'lo', label: '🇱🇦 ພາສາລາວ' },
              { id: 'ko', label: '🇰🇷 한국어' },
            ]}
          />
        </div>
      </section>

      <section className="panel form">
        <h2 className="h3">🔁 {t('study')}</h2>
        <div className="quick-row">
          <span className="quick-label">{t('repsPerSet')}</span>
          <Stepper value={s.settings.reps} min={1} max={10} onChange={(reps) => setSettings({ reps })} format={(v) => `${v}${t('times')}`} />
        </div>
        <div className="quick-row">
          <span className="quick-label">{t('cardSec')}</span>
          <Stepper value={s.settings.cardSec} min={1} max={10} onChange={(cardSec) => setSettings({ cardSec })} format={(v) => `${v}${t('sec')}`} />
        </div>
        <Toggle id="set-faster" label={t('autoFaster')} on={s.settings.autoFaster} onChange={(autoFaster) => setSettings({ autoFaster })} />
        <div className="field">
          <span className="label">{t('direction')}</span>
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
        <div className="field">
          <span className="label">{t('order')}</span>
          <Segmented<Order>
            name={t('order')}
            value={s.settings.order}
            onChange={(order) => setSettings({ order })}
            options={[
              { id: 'seq', label: t('orderSeq') },
              { id: 'random', label: t('orderRandom') },
            ]}
          />
        </div>
        <Toggle id="set-speak" label={t('autoSpeak')} on={s.settings.autoSpeak} onChange={(autoSpeak) => setSettings({ autoSpeak })} />
        <div className="quick-row">
          <span className="quick-label">{t('quizSec')}</span>
          <Stepper value={s.settings.quizSec} min={0} max={20} onChange={(quizSec) => setSettings({ quizSec })} format={(v) => (v === 0 ? t('noLimit') : `${v}${t('sec')}`)} />
        </div>
      </section>

      <section className="panel form">
        <h2 className="h3">🔊 {t('voice')}</h2>
        {(['ko', 'lo'] as const).map((l) => (
          <div key={l} className="voice-row">
            <span className="voice-name">{l === 'ko' ? '한국어' : 'ພາສາລາວ'}</span>
            <span className={voices[l] ? 'chip chip-mint' : 'chip'}>{voices[l] === null ? '…' : voices[l] ? t('voiceOk') : t('voiceMissing')}</span>
            <button className="btn btn-soft sm" onClick={() => speakText(SAMPLE[l]!, l)}>
              <Icon name="speaker" size={16} /> {t('test')}
            </button>
          </div>
        ))}
        {Capacitor.isNativePlatform() && voices.ko === false && (
          <button className="btn btn-soft btn-block" onClick={openVoiceInstall}>
            {t('installVoice')}
          </button>
        )}
      </section>

      <section className="panel form">
        <button className="btn btn-soft btn-block" onClick={() => push({ name: 'placement' })}>
          ✏️ {t('retakeTest')}
        </button>
        <button
          className={confirmReset ? 'btn btn-danger btn-block' : 'btn btn-soft btn-block'}
          onClick={() => {
            if (confirmReset) {
              resetAll()
              setConfirmReset(false)
            } else setConfirmReset(true)
          }}
        >
          {confirmReset ? t('resetConfirm') : t('reset')}
        </button>
      </section>

      <p className="foot-note">
        Chang Korean v0.3.0 (MVP) · {t('contentDraft')}
      </p>
    </div>
  )
}
