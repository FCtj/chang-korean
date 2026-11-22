import { useEffect, useState } from 'react'
import { ED_INFO, EDITION, IS_KO } from '../edition'
import { MASCOT_EMOJI, mascotOf } from '../mascot'
import { Capacitor } from '@capacitor/core'
import type { Lang, Purpose } from '../data/words'
import { NATIVE_INFO, makeT, nativeInfo } from '../i18n'
import { useApp } from '../ctx'
import type { UiLang } from '../i18n'
import { resetAll, setLanguage, setSettings, update, useStore, type Direction, type Order } from '../store'
import NativePicker from './NativePicker'
import { PUBLIC_PROFILE, SITE_URL } from '../config'
import { GenderPicker, PhotoPicker } from './ProfileFields'
import type { Theme } from '../store'
import { hasVoice, openVoiceInstall, speakText } from '../audio'
import { Avatar, Icon, Segmented, Stepper, Toggle } from '../ui'
import { backendReady, checkAdmin, COUNTRIES, setCountry, signInWithFacebook, signInWithKakao, signOut, useProviders, syncPublicProfile, useAuth, useMyPublic } from '../backend'


export default function SettingsScreen() {
  const s = useStore()
  const { t, push } = useApp()
  const [name, setName] = useState(s.nickname)
  const [voices, setVoices] = useState<Partial<Record<Lang, boolean | null>>>({})
  const me = nativeInfo(s.native)
  const voiceLangs: { lang: Lang; name: string; sample: string }[] = IS_KO
    ? [
        { lang: 'ko', name: '한국어', sample: '안녕하세요' },
        { lang: s.native, name: me.name, sample: me.hello },
      ]
    : [{ lang: 'ko', name: ED_INFO.lang, sample: EDITION === 'ja' ? 'こんにちは' : 'Hello! Nice to meet you.' }]
  const [confirmReset, setConfirmReset] = useState(false)
  const auth = useAuth()
  const pub = useMyPublic()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let alive = true
    if (auth.status === 'in') checkAdmin().then((ok) => alive && setIsAdmin(ok))
    else setIsAdmin(false)
    return () => {
      alive = false
    }
  }, [auth.status])

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

      {IS_KO && <section className="panel form">
        <h2 className="h3">🌏 {t('myLang')}</h2>
        <NativePicker value={s.native} onChange={(n) => setLanguage(n)} />
        <p className="note">{t('myLangHint')}</p>
        {(s.native === 'vi' || (s.native === 'mn' && s.ui === 'mn')) && <p className="note beta-note">🧪 {t('viBetaNote')}</p>}
      </section>}

      <section className="panel form">
        <h2 className="h3">{MASCOT_EMOJI[mascotOf(s.country)]} {t('account')}</h2>
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
              <LoginButtons />
              <p className="note">{t(PUBLIC_PROFILE ? 'fbLoginHint' : 'fbLoginPlain')}</p>
            </>
          ))}
        {isAdmin && (
          <button className="btn btn-soft btn-block" onClick={() => push({ name: 'admin' })}>
            🛠️ 관리자 · 사용 현황
          </button>
        )}
        {IS_KO && <div className="field">
          <span className="label">{t('country')}</span>
          <div className="country-chips" role="radiogroup" aria-label={t('country')}>
            {COUNTRIES.map((c) => (
              <button key={c.code} role="radio" aria-checked={s.country === c.code} className={s.country === c.code ? 'cchip on' : 'cchip'} onClick={() => setCountry(c.code)}>
                <span className="flag">{c.flag}</span> {c[s.ui]}
              </button>
            ))}
          </div>
        </div>}
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
        {IS_KO && <div className="field">
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
        </div>}
      </section>

      {IS_KO && (
        <section className="panel form">
          <h2 className="h3">🎯 {t('myPurpose')}</h2>
          <PurposePicker ui={s.ui} value={s.purposes} onChange={(purposes) => update((st) => ({ ...st, purposes }))} />
        </section>
      )}

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
              { id: 'ko2n', label: `${t('korean')} → ${IS_KO ? t(me.key) : '한국어'}` },
              { id: 'n2ko', label: `${IS_KO ? t(me.key) : '한국어'} → ${t('korean')}` },
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

      {/* 개인정보 설정: 기본 화면에서는 접어 둠 (펼치면 바로 바꿀 수 있음) */}
      {PUBLIC_PROFILE && (
      <details className="panel form privacy-more">
        <summary className="privacy-summary">
          <span className="h3">🔒 {t('privacyMore')}</span>
          <span className="privacy-chev" aria-hidden="true">›</span>
        </summary>
          <div className="field">
            <span className="label">👀 {t('publicLook')}</span>
            <div className="public-preview">
              <Avatar src={pub.avatar} name={pub.name} size={40} />
              <span className="public-name">{pub.name}</span>
            </div>
            <Toggle
              id="set-hide-name"
              label={t('hideName')}
              on={s.hideName}
              onChange={(on) => {
                update((st) => ({ ...st, hideName: on }))
                syncPublicProfile()
              }}
            />
            <Toggle
              id="set-hide-photo"
              label={t('hidePhoto')}
              on={s.hidePhoto}
              onChange={(on) => {
                update((st) => ({ ...st, hidePhoto: on }))
                syncPublicProfile()
              }}
            />
            <p className="note">{t('hideHint')}</p>
          </div>
      </details>
      )}

      {!IS_KO && (
        <section className="panel form ed-sources">
          <h2 className="h3">📚 단어 출처</h2>
          <ul className="note">
            {ED_INFO.sources.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel form">
        <h2 className="h3">🔍 {t('reviewTitle')}</h2>
        <p className="note">{t('reviewIntro')}</p>
        <button className="btn btn-soft btn-block" onClick={() => push({ name: 'review' })}>
          🔍 {t('reviewTitle')} →
        </button>
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
        <a href={`${SITE_URL}privacy.html`} target="_blank" rel="noopener noreferrer">
          {t('privacyPolicy')}
        </a>{' '}
        ·{' '}
        <a href={`${SITE_URL}delete-data.html`} target="_blank" rel="noopener noreferrer">
          {t('dataDeletion')}
        </a>
      </p>
      <p className="foot-note">
        {ED_INFO.app} v0.17.0 (MVP) · {t('contentDraft')}
      </p>
    </div>
  )
}

const PURPOSES: { id: Purpose; icon: string; key: 'pWork' | 'pParttime' | 'pCitizen' | 'pTravel' | 'pSchool' | 'pKpop' | 'pFamily' }[] = [
  { id: 'work', icon: '💼', key: 'pWork' },
  { id: 'parttime', icon: '🍜', key: 'pParttime' },
  { id: 'citizen', icon: '🇰🇷', key: 'pCitizen' },
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

/** 로그인 버튼: 서버에 켜져 있는 방법만 (카카오는 Supabase 대시보드에서 켜면 나타남). 일본어·영어판은 카카오 먼저 */
export function LoginButtons({ big = false }: { big?: boolean }) {
  const { t } = useApp()
  const p = useProviders()
  const kakao = p.kakao ? (
    <button key="kakao" className={big ? 'kakao-btn big' : 'kakao-btn'} onClick={() => signInWithKakao()}>
      <svg className="kakao-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.65 1.75 4.98 4.38 6.31l-.9 3.33c-.08.3.26.54.52.37l3.97-2.63c.5.06 1.01.1 1.53.1 5.25 0 9.5-3.36 9.5-7.48S17.25 3.5 12 3.5Z" fill="#191919" />
      </svg>
      {t('kakaoLogin')}
    </button>
  ) : null
  const fb =
    p.facebook !== false ? (
      <button key="fb" className={big ? 'fb-btn big' : 'fb-btn'} onClick={() => signInWithFacebook()}>
        <span className="fb-logo" aria-hidden="true">f</span> {t('fbLogin')}
      </button>
    ) : null
  return <div className="login-buttons">{IS_KO ? [fb, kakao] : [kakao, fb]}</div>
}
