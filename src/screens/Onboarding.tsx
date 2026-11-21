import { useState } from 'react'
import { makeT } from '../i18n'
import { update } from '../store'
import { Elephant } from '../ui'

export default function Onboarding() {
  const [name, setName] = useState('')
  const { t } = makeT('lo')

  return (
    <div className="app">
      <main className="onboard">
        <div className="onboard-hero">
          <div className="hero-blob" aria-hidden="true">
            <span className="spark s1">✦</span>
            <span className="spark s2">♥</span>
            <span className="spark s3">✦</span>
            <Elephant size={150} acc="bow" className="float" />
          </div>
          <h1 className="brand">Chang Korean</h1>
          <p className="onboard-tag lo">{t('tagline')}</p>
          <p className="onboard-sub">그림과 소리로 외우는 한국어 단어</p>
        </div>

        <section className="onboard-card">
          <div className="lang-pill" aria-label="ພາສາລາວ">
            <span className="flag">🇱🇦</span> ພາສາລາວ → 한국어
          </div>
          <div className="field">
            <label htmlFor="nick" className="lo">
              {t('nickname')}
            </label>
            <input id="nick" className="input" maxLength={16} placeholder={t('nicknamePh')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-pink btn-block" onClick={() => update((s) => ({ ...s, started: true, ui: 'lo', nickname: name.trim() || 'ຂ້ອຍ' }))}>
            {t('start')} ♥
          </button>
        </section>
      </main>
    </div>
  )
}
