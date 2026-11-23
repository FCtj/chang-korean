// 번역 검수: 원어민이 단어·문장의 뜻을 보고 [맞아요] / [고칠게요]
// 결과는 Supabase translation_reviews (본인 것만 보임). 운영자는 SQL Editor 에서 모아 봄
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../ctx'
import { backendReady, supabase, useAuth } from '../backend'
import { NATIVE_INFO } from '../i18n'
import { TIERS, PACKS, type Native, type Round } from '../data/words'
import { TRACKS } from '../data/tracks'
import { useStore } from '../store'
import { Segmented, TopBar, Pron } from '../ui'
import { sfx } from '../audio'
import { rankEmoji } from '../mascot'
import { LoginButtons } from './SettingsScreen'

type Verdict = 'ok' | 'fix'

export default function ReviewScreen() {
  const s = useStore()
  const auth = useAuth()
  const { t, tf, ui } = useApp()
  const [lang, setLang] = useState<Native>(s.native)
  // 내 언어가 맨 앞
  const [langOrder] = useState(() => [...NATIVE_INFO].sort((a, b) => Number(b.id === s.native) - Number(a.id === s.native)))
  const groups = useMemo(
    () => [
      ...TRACKS.filter((tr) => tr.units.length).map((tr) => ({ label: `${tr.icon} ${tr.title[ui]}`, units: tr.units })),
      { label: `⚡ ${t('packsTitle')}`, units: PACKS },
      ...TIERS.map((tier) => ({ label: `${rankEmoji(tier.no)} ${tf('tierN', tier.no)}`, units: tier.rounds })),
    ],
    [ui, t, tf],
  )
  const [unitId, setUnitId] = useState(groups[0].units[0].id)
  const unit = groups.flatMap((g) => g.units).find((u) => u.id === unitId) as Round
  const [done, setDone] = useState<Record<string, Verdict>>({})
  const [i, setI] = useState(0)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const loggedIn = backendReady && auth.status === 'in'

  // 이 단원·언어에서 내가 이미 검수한 것
  useEffect(() => {
    setI(0)
    setEditing(false)
    setDone({})
    if (!loggedIn || !supabase) return
    supabase
      .from('translation_reviews')
      .select('ko, verdict')
      .eq('unit_id', unitId)
      .eq('lang', lang)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, Verdict> = {}
        for (const r of data as { ko: string; verdict: Verdict }[]) map[r.ko] = r.verdict
        setDone(map)
        const first = unit.words.findIndex((w) => !map[w.ko])
        setI(first < 0 ? unit.words.length : first)
      })
  }, [unitId, lang, loggedIn])

  const w = unit.words[i]
  const reviewed = unit.words.filter((x) => done[x.ko]).length

  const next = () => {
    setEditing(false)
    const after = unit.words.findIndex((x, j) => j > i && !done[x.ko])
    setI(after < 0 ? unit.words.length : after)
  }

  const send = async (verdict: Verdict) => {
    if (!supabase || !w) return
    setBusy(true)
    const { error } = await supabase.from('translation_reviews').upsert(
      {
        user_id: auth.me!.id,
        unit_id: unit.id,
        ko: w.ko,
        lang,
        current_text: w[lang],
        verdict,
        suggestion: verdict === 'fix' ? text.trim().slice(0, 300) : '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,unit_id,ko,lang' },
    )
    setBusy(false)
    if (error) return
    sfx.pop()
    setDone((d) => ({ ...d, [w.ko]: verdict }))
    next()
  }

  return (
    <div className="screen">
      <TopBar title={`🔍 ${t('reviewTitle')}`} sub={tf('reviewedN', reviewed, unit.words.length)} />
      <div className="page review">
        <p className="note">{t('reviewIntro')}</p>

        <div className="field">
          <span className="label">{t('reviewLang')}</span>
          <Segmented<Native> name={t('reviewLang')} value={lang} onChange={setLang} options={langOrder.map((n) => ({ id: n.id, label: `${n.flag} ${n.name}` }))} />
        </div>
        <div className="field">
          <label htmlFor="review-unit">{t('reviewUnit')}</label>
          <select id="review-unit" className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.track ? tf('unitN', u.no) : u.pack ? u.pack.icon : tf('roundN', u.no)} · {u.title[ui]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="track-progress" aria-hidden="true">
          <span style={{ width: `${Math.round((reviewed / unit.words.length) * 100)}%` }} />
        </div>

        {!loggedIn ? (
          <section className="panel center-panel">
            <p>{t('reviewLogin')}</p>
            {backendReady && (
              <LoginButtons />
            )}
          </section>
        ) : !w ? (
          <section className="panel center-panel">
            <p className="h3">{t('reviewDone')}</p>
          </section>
        ) : (
          <section className={w.kind === 'phrase' ? 'panel review-card phrase' : 'panel review-card'}>
            <span className="review-no num">
              {i + 1}/{unit.words.length}
              {done[w.ko] && ` · ${done[w.ko] === 'ok' ? '✅' : '✏️'}`}
            </span>
            <span className="review-emoji" aria-hidden="true">
              {w.emoji}
            </span>
            <span className="review-ko ko">{w.ko}</span>
            <Pron ko={w.ko} lang={lang} />
            <span className="review-label">{t('reviewCurrent')}</span>
            <span className={`review-tr nf-${lang}`}>{w[lang]}</span>
            {editing ? (
              <>
                <textarea className={`input review-input nf-${lang}`} rows={2} maxLength={300} placeholder={t('reviewPh')} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                <div className="review-actions">
                  <button className="btn btn-soft" onClick={() => setEditing(false)}>
                    ←
                  </button>
                  <button className="btn btn-pink" disabled={busy || !text.trim() || text.trim() === w[lang]} onClick={() => send('fix')}>
                    {t('reviewSend')}
                  </button>
                </div>
              </>
            ) : (
              <div className="review-actions">
                <button className="btn btn-mint" disabled={busy} onClick={() => send('ok')}>
                  ✅ {t('reviewOk')}
                </button>
                <button
                  className="btn btn-soft"
                  disabled={busy}
                  onClick={() => {
                    setText(w[lang])
                    setEditing(true)
                  }}
                >
                  ✏️ {t('reviewFix')}
                </button>
              </div>
            )}
            {!editing && (
              <button className="link-btn review-skip" onClick={next}>
                {t('reviewSkip')} →
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
