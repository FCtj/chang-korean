// 시작 화면: 내 언어(라오어·태국어·베트남어 베타) + 닉네임 → 목적 → 수준 테스트(또는 '처음이에요') → 학습 시작
import { useState } from 'react'
import { makeT, nativeInfo, type UiLang } from '../i18n'
import { getState, setLanguage, update } from '../store'
import type { Native, Purpose } from '../data/words'
import NativePicker from './NativePicker'
import { PUBLIC_PROFILE, SIMPLE_MODE } from '../config'
import { loginErrorKey } from './LoginError'
import { GenderPicker, PhotoPicker } from './ProfileFields'
import { PurposePicker } from './SettingsScreen'
import { Avatar, Elephant, useHeart } from '../ui'
import { backendReady, COUNTRIES, signInWithFacebook, useAuth } from '../backend'
import Placement from './Placement'

export default function Onboarding() {
  const [name, setName] = useState('')
  const [native, setNativeState] = useState<Native>(getState().native)
  const [ui, setUi] = useState<UiLang>(getState().ui)
  const [step, setStep] = useState<'hello' | 'purpose' | 'level'>('hello')
  const [purposes, setPurposes] = useState<Purpose[]>(getState().purposes)
  const [country, setCountry] = useState(getState().country || 'LA')
  const auth = useAuth()
  const heart = useHeart()
  const { t } = makeT(ui)
  const loggedIn = auth.status === 'in' && auth.me

  if (step === 'purpose') {
    return (
      <div className="app">
        <main className="onboard">
          <div className="onboard-hero small">
            <Elephant size={110} acc="bow" mood="happy" className="float" />
            <h1 className="h1 center">{t('purposeQ')}</h1>
            <p className="note center">{t('purposeHint')}</p>
          </div>
          <section className="onboard-card">
            <PurposePicker ui={ui} value={purposes} onChange={setPurposes} big />
            <button
              className="btn btn-pink btn-block btn-big"
              onClick={() => {
                update((s) => ({ ...s, purposes }))
                setStep('level')
              }}
            >
              {t('next')} →
            </button>
          </section>
        </main>
      </div>
    )
  }

  if (step === 'level') {
    return (
      <div className="app">
        <Placement ui={ui} mode="first" onBack={() => setStep('hello')} onDone={() => update((s) => ({ ...s, started: true }))} />
      </div>
    )
  }

  return (
    <div className="app">
      <main className="onboard">
        <div className="lang-toggle" role="radiogroup" aria-label="language">
          {([native, 'ko'] as UiLang[]).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={ui === l}
              className={ui === l ? 'on' : ''}
              onClick={() => {
                setUi(l)
                update((s) => ({ ...s, ui: l }))
              }}
            >
              {l === 'ko' ? '한국어' : nativeInfo(native).name}
            </button>
          ))}
        </div>
        <div className="onboard-hero">
          <div className="hero-blob" aria-hidden="true">
            <span className="spark s1">✦</span>
            <span className="spark s2">♥</span>
            <span className="spark s3">✦</span>
            <Elephant size={150} acc="bow" className="float" />
          </div>
          <h1 className="brand">Chang Korean</h1>
          <p className="onboard-tag lo">{makeT(native).t('tagline')}</p>
          <p className="onboard-sub">그림과 소리로 외우는 한국어 단어</p>
        </div>

        <section className="onboard-card">
          <div className="field">
            <span className="label">{t('myLang')}</span>
            <NativePicker
              value={native}
              onChange={(n) => {
                setNativeState(n)
                if (ui !== 'ko') setUi(n)
                setCountry(nativeInfo(n).country)
                setLanguage(n, { country: true })
              }}
            />
          </div>
          <div className="field">
            <span className="label">{t('country')}</span>
            <div className="country-chips" role="radiogroup" aria-label={t('country')}>
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  role="radio"
                  aria-checked={country === c.code}
                  className={country === c.code ? 'cchip on' : 'cchip'}
                  onClick={() => {
                    setCountry(c.code)
                    update((s) => ({ ...s, country: c.code }))
                  }}
                >
                  <span className="flag">{c.flag}</span> {c[ui]}
                </button>
              ))}
            </div>
          </div>
          {loggedIn ? (
            <div className="me-hello">
              <Avatar src={auth.me!.avatar} name={auth.me!.name} size={48} />
              <span>{auth.me!.name}</span>
            </div>
          ) : (
            backendReady && !SIMPLE_MODE && (
              <>
                <button
                  className="fb-btn big"
                  onClick={() => {
                    update((s) => ({ ...s, ui, native, country }))
                    signInWithFacebook()
                  }}
                >
                  <span className="fb-logo" aria-hidden="true">f</span> {t('fbLogin')}
                </button>
                <p className="note center">{t(PUBLIC_PROFILE ? 'fbLoginHint' : 'fbLoginPlain')}</p>
                {auth.error && (
                  <p className="note center err">
                    {t(loginErrorKey(auth.error))}
                    <br />
                    <code className="login-error-raw">{auth.error}</code>
                  </p>
                )}
                <div className="or-line">{t('orNickname')}</div>
              </>
            )
          )}
          {!loggedIn && (
            <>
              <div className="field">
                <label htmlFor="nick">{t('nickname')}</label>
                <input id="nick" className="input" maxLength={16} placeholder={t(PUBLIC_PROFILE ? 'nicknamePh' : 'nicknamePlain')} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {!SIMPLE_MODE && (
                <div className="field">
                  <span className="label">{t('photo')}</span>
                  <PhotoPicker name={name} />
                </div>
              )}
            </>
          )}
          <div className="field">
            <span className="label">{t('gender')}</span>
            <GenderPicker />
          </div>
          <button
            className="btn btn-pink btn-block"
            onClick={() => {
              const nickname = loggedIn ? auth.me!.name : name.trim() || (ui === 'ko' ? '나' : nativeInfo(native).me)
              // 간단 모드: 목적·수준 테스트를 건너뛰고 바로 30초 체험으로 (설정에서 나중에 할 수 있음)
              if (SIMPLE_MODE) update((s) => ({ ...s, ui, native, country, nickname, placementDone: true, started: true }))
              else {
                update((s) => ({ ...s, ui, native, country, nickname }))
                setStep('purpose')
              }
            }}
          >
            {t('start')} {heart}
          </button>
          {SIMPLE_MODE && backendReady && !loggedIn && (
            <>
              <button
                className="link-btn center fb-link"
                onClick={() => {
                  update((s) => ({ ...s, ui, native, country }))
                  signInWithFacebook()
                }}
              >
                <span className="fb-logo sm" aria-hidden="true">f</span> {t('haveAccount')}
              </button>
              {auth.error && (
                <p className="note center err">
                  {t(loginErrorKey(auth.error))}
                  <br />
                  <code className="login-error-raw">{auth.error}</code>
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
