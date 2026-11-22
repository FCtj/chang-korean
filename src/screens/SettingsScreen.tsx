import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Lang, Purpose } from '../data/words'
import { NATIVE_INFO, makeT, nativeInfo } from '../i18n'
import { useApp } from '../ctx'
import type { UiLang } from '../i18n'
import { resetAll, setLanguage, setSettings, update, useStore, type Direction, type Order } from '../store'
import NativePicker from './NativePicker'
import { SITE_URL } from '../config'
import { GenderPicker, PhotoPicker } from './ProfileFields'
import type { Theme } from '../store'
import { hasVoice, openVoiceInstall, speakText } from '../audio'
import { Avatar, Icon, Segmented, Stepper, Toggle } from '../ui'
import { backendReady, COUNTRIES, deleteMyData, setCountry, signInWithFacebook, signOut, useAuth } from '../backend'


export default function SettingsScreen() {
  const s = useStore()
  const { t, push } = useApp()
  const [name, setName] = useState(s.nickname)
  const [voices, setVoices] = useState<Partial<Record<Lang, boolean | null>>>({})
  const me = nativeInfo(s.native)
  const voiceLangs: { lang: Lang; name: string; sample: string }[] = [
    { lang: 'ko', name: '한국어', sample: '안녕하세요' },
    { lang: s.native, name: me.name, sample: me.hello },
  ]
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletedMsg, setDeletedMsg] = useState(false)
  const auth = useAuth()

  useEffect(() => {
    let alive = true
    ;(['ko', s.native] as const).forEach((l) => hasVoice(l).then((ok) => alive && setVoices((v) => ({ ...v, [l]: ok }))))
    return () => {
      alive = false
    }
  }, [s.native])

  return (
    <div className="page">
      <h1 className="h1">{t('tabSettings')}</h1>

      <section className="panel form">
        <h2 className="h3">🌏 {t('myLang')}</h2>
        <NativePicker value={s.native} onChange={(n) => setLanguage(n)} />
        <p className="note">{t('myLangHint')}</p>
        {s.native === 'vi' && <p className="note beta-note">🧪 {t('viBetaNote')}</p>}
      </section>

      <section className="panel form">
        <h2 className="h3">🐘 {t('account')}</h2>
        {backendReady &&
          (auth.status === 'in' && auth.me ? (
            <div className="account-row">
              <Avatar src={auth.me.avatar} name={auth.me.name} size={48} />
              <div className="account-body">
                <div className="account-name">{auth.me.name}</div>
                <div className="note">☁️ {t('syncOn')}</div>
              </div>
              <button className="btn btn-soft sm" onClick={() => signOut()}>
                {t('logout')}
              </button>
            </div>
          ) : (
            <>
              <button className="fb-btn" onClick={() => signInWithFacebook()}>
                <span className="fb-logo" aria-hidden="true">f</span> {t('fbLogin')}
              </button>
              <p className="note">{t('fbLoginHint')}</p>
            </>
          ))}
        {deletedMsg && <p className="note">✓ {t('deleted')}</p>}
        {backendReady && auth.status === 'in' && (
          <>
            <Toggle id="set-consent" label={`🔒 ${t('consentToggle')}`} on={s.profileConsent === 'yes'} onChange={(on) => update((st) => ({ ...st, profileConsent: on ? 'yes' : 'no' }))} />
            <p className="note">{t('consentHint')}</p>
          </>
        )}
        <div className="field">
          <span className="label">{t('country')}</span>
          <div className="country-chips" role="radiogroup" aria-label={t('country')}>
            {COUNTRIES.map((c) => (
              <button key={c.code} role="radio" aria-checked={s.country === c.code} className={s.country === c.code ? 'cchip on' : 'cchip'} onClick={() => setCountry(c.code)}>
                <span className="flag">{c.flag}</span> {c[s.ui]}
              </button>
            ))}
          </div>
        </div>
        {auth.status !== 'in' && (
          <div className="field">
            <span className="label">{t('photo')}</span>
            <PhotoPicker name={s.nickname} />
          </div>
        )}
        <div className="field">
          <span className="label">{t('gender')}</span>
          <GenderPicker />
        </div>
        <div className="field">
          <span className="label">{t('theme')}</span>
          <Segmented<Theme>
            name={t('theme')}
            value={s.theme}
            onChange={(theme) => update((st) => ({ ...st, theme }))}
            options={[
              { id: 'candy', label: `💗 ${t('themeCandy')}` },
              { id: 'carbon', label: `🖤 ${t('themeCarbon')}` },
            ]}
          />
        </div>
        {auth.status !== 'in' && <div className="field">
          <label htmlFor="nick-edit">{t('nickname')}</label>
          <input
            id="nick-edit"
            className="input"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && update((st) => ({ ...st, nickname: name.trim() }))}
          />
        </div>}
        <div className="field">
          <span className="label">{t('uiLang')}</span>
          <Segmented<UiLang>
            name={t('uiLang')}
            value={s.ui}
            onChange={(l) => update((st) => ({ ...st, ui: l }))}
            options={[
              // 화면 언어만 바뀜 (단어 뜻 언어는 위의 '내 언어')
              ...NATIVE_INFO.map((n) => ({ id: n.id as UiLang, label: `${n.flag} ${n.name}` })),
              { id: 'ko', label: '🇰🇷 한국어' },
            ]}
          />
        </div>
      </section>

      <section className="panel form">
        <h2 className="h3">🎯 {t('myPurpose')}</h2>
        <PurposePicker ui={s.ui} value={s.purposes} onChange={(purposes) => update((st) => ({ ...st, purposes }))} />
      </section>

      <section className="panel form">
        <h2 className="h3">🔁 {t('study')}</h2>
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
              { id: 'ko2n', label: `${t('korean')} → ${t(me.key)}` },
              { id: 'n2ko', label: `${t(me.key)} → ${t('korean')}` },
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
        {voiceLangs.map(({ lang: l, name, sample }) => (
          <div key={l} className="voice-row">
            <span className="voice-name">{name}</span>
            <span className={voices[l] ? 'chip chip-mint' : 'chip'}>{voices[l] == null ? '…' : voices[l] ? t('voiceOk') : t('voiceMissing')}</span>
            <button className="btn btn-soft sm" onClick={() => speakText(sample, l)}>
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

      {backendReady && auth.status === 'in' && (
        <section className="panel form">
          <button
            className={confirmDelete ? 'btn btn-danger btn-block' : 'btn btn-soft btn-block'}
            onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true)
              setConfirmDelete(false)
              if (await deleteMyData()) setDeletedMsg(true)
            }}
          >
            {confirmDelete ? t('deleteConfirm') : t('deleteData')}
          </button>
        </section>
      )}

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
        <a href={`${SITE_URL}privacy.html`} target="_blank" rel="noopener noreferrer">
          {t('privacyPolicy')}
        </a>{' '}
        ·{' '}
        <a href={`${SITE_URL}delete-data.html`} target="_blank" rel="noopener noreferrer">
          {t('dataDeletion')}
        </a>
      </p>
      <p className="foot-note">
        Chang Korean v0.14.0 (MVP) · {t('contentDraft')}
      </p>
    </div>
  )
}

const PURPOSES: { id: Purpose; icon: string; key: 'pWork' | 'pTravel' | 'pSchool' | 'pKpop' | 'pFamily' }[] = [
  { id: 'work', icon: '💼', key: 'pWork' },
  { id: 'travel', icon: '✈️', key: 'pTravel' },
  { id: 'school', icon: '🎓', key: 'pSchool' },
  { id: 'kpop', icon: '🎤', key: 'pKpop' },
  { id: 'family', icon: '👨‍👩‍👧', key: 'pFamily' },
]

/** 배우는 목적 고르기 (여러 개) */
export function PurposePicker({ ui, value, onChange, big = false }: { ui: UiLang; value: Purpose[]; onChange: (v: Purpose[]) => void; big?: boolean }) {
  const { t } = makeT(ui)
  return (
    <div className={big ? 'purpose-grid big' : 'purpose-grid'} role="group" aria-label={t('myPurpose')}>
      {PURPOSES.map((p) => {
        const on = value.includes(p.id)
        return (
          <button key={p.id} className={on ? 'purpose on' : 'purpose'} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}>
            <span className="purpose-icon" aria-hidden="true">{p.icon}</span>
            <span className="purpose-label">{t(p.key)}</span>
            {on && <span className="purpose-check" aria-hidden="true">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
