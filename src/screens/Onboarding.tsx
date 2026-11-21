// 시작 화면: 닉네임 → 수준 테스트(또는 '처음이에요') → 학습 시작
import { useState } from 'react'
import { makeT, type UiLang } from '../i18n'
import { getState, update } from '../store'
import { Avatar, Elephant } from '../ui'
import { backendReady, COUNTRIES, signInWithFacebook, useAuth } from '../backend'
import Placement from './Placement'

export default function Onboarding() {
  const [name, setName] = useState('')
  const [ui, setUi] = useState<UiLang>('lo')
  const [step, setStep] = useState<'hello' | 'level'>('hello')
  const [country, setCountry] = useState(getState().country || 'LA')
  const auth = useAuth()
  const { t } = makeT(ui)
  const loggedIn = auth.status === 'in' && auth.me

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
          {(['lo', 'ko'] as UiLang[]).map((l) => (
            <button key={l} role="radio" aria-checked={ui === l} className={ui === l ? 'on' : ''} onClick={() => setUi(l)}>
              {l === 'lo' ? 'ລາວ' : '한국어'}
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
          <p className="onboard-tag lo">ຮຽນຄຳສັບເກົາຫຼີດ້ວຍຮູບ ແລະ ສຽງ</p>
          <p className="onboard-sub">그림과 소리로 외우는 한국어 단어</p>
        </div>

        <section className="onboard-card">
          <div className="lang-pill" aria-label="ພາສາລາວ → 한국어">
            <span className="flag">🇱🇦</span> ພາສາລາວ → 한국어
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
                  <span className="flag">{c.flag}</span> {ui === 'ko' ? c.ko : c.lo}
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
            backendReady && (
              <>
                <button
                  className="fb-btn big"
                  onClick={() => {
                    update((s) => ({ ...s, ui, country }))
                    signInWithFacebook()
                  }}
                >
                  <span className="fb-logo" aria-hidden="true">f</span> {t('fbLogin')}
                </button>
                <p className="note center">{t('fbLoginHint')}</p>
                {auth.error && <p className="note center err">{t('loginFailed')}</p>}
                <div className="or-line">{t('orNickname')}</div>
              </>
            )
          )}
          {!loggedIn && (
            <div className="field">
              <label htmlFor="nick">{t('nickname')}</label>
              <input id="nick" className="input" maxLength={16} placeholder={t('nicknamePh')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <button
            className="btn btn-pink btn-block"
            onClick={() => {
              update((s) => ({ ...s, ui, country, nickname: loggedIn ? auth.me!.name : name.trim() || (ui === 'lo' ? 'ຂ້ອຍ' : '나') }))
              setStep('level')
            }}
          >
            {t('start')} ♥
          </button>
        </section>
      </main>
    </div>
  )
}
