import { useState } from 'react'
import { LANG_OPTIONS, makeT } from '../i18n'
import { update } from '../store'
import type { Native } from '../data/words'

export default function Onboarding() {
  const [native, setNative] = useState<Native | null>(null)
  const [name, setName] = useState('')
  const { t } = makeT(native ?? 'ko')

  return (
    <div className="app">
      <main className="onboard">
        <div className="onboard-hero">
          <div className="onboard-elephant" aria-hidden="true">🐘</div>
          <h1 className="brand">Chang Korean</h1>
          <p className="onboard-tag">
            {native ? t('tagline') : (
              <>
                ຮຽນຄຳສັບເກົາຫຼີດ້ວຍຮູບ ແລະ ສຽງ
                <br />
                เรียนคำศัพท์เกาหลีด้วยภาพและเสียง
              </>
            )}
          </p>
        </div>

        <section className="onboard-card">
          <h2 className="h2">{native ? t('chooseLang') : 'ເລືອກພາສາ · เลือกภาษา · 언어 선택'}</h2>
          <div className="lang-grid">
            {LANG_OPTIONS.map((o) => (
              <button key={o.id} className={native === o.id ? 'lang-card on' : 'lang-card'} onClick={() => setNative(o.id)} aria-pressed={native === o.id}>
                <span className="lang-flag">{o.flag}</span>
                <span className="lang-label">{o.label}</span>
                <span className="lang-sub">{o.sub}</span>
              </button>
            ))}
          </div>

          {native && (
            <div className="field">
              <label htmlFor="nick">{t('nickname')}</label>
              <input id="nick" className="input" maxLength={16} placeholder={t('nicknamePh')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            disabled={!native}
            onClick={() => native && update((s) => ({ ...s, native, ui: native, nickname: name.trim() || (native === 'lo' ? 'ຂ້ອຍ' : 'ฉัน') }))}
          >
            {native ? t('start') : 'ເລີ່ມ · เริ่ม · 시작'}
          </button>
        </section>
      </main>
    </div>
  )
}
