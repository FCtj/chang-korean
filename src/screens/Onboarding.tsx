// 시작 화면: 닉네임 → 수준 테스트(또는 '처음이에요') → 학습 시작
import { useState } from 'react'
import { makeT, type UiLang } from '../i18n'
import { update } from '../store'
import { Elephant } from '../ui'
import Placement from './Placement'

export default function Onboarding() {
  const [name, setName] = useState('')
  const [ui, setUi] = useState<UiLang>('lo')
  const [step, setStep] = useState<'hello' | 'level'>('hello')
  const { t } = makeT(ui)

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
            <label htmlFor="nick">{t('nickname')}</label>
            <input id="nick" className="input" maxLength={16} placeholder={t('nicknamePh')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button
            className="btn btn-pink btn-block"
            onClick={() => {
              update((s) => ({ ...s, ui, nickname: name.trim() || (ui === 'lo' ? 'ຂ້ອຍ' : '나') }))
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
