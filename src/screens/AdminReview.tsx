// 📚 관리자 단어 검토 — 코스의 단어·문장 카드를 하나씩 보고
//   ✅ 괜찮음 · 🚫 제외(앱에서 뺌, 다음에 열 때부터) · ✏️ 고칠 곳(메모 → 📮 수정 요청에 'Claude 에게 맡김')
// 검토 상태는 서버 content_flags (supabase/migrations/20261128000000_content_review.sql)
import { useEffect, useMemo, useState } from 'react'
import { Segmented } from '../ui'
import { reviewTracks, type Track } from '../data/tracks'
import { loadExamples } from '../examples'
import type { ExampleEntry } from '../data/example-types'
import type { Word } from '../data/words'
import { adminContentFlags, adminContentFlagSet, type ContentFlag, type ContentFlagStatus } from '../backend'
import { excludedChanged } from '../data/excluded'

type Lang = 'lo' | 'th' | 'vi' | 'mn' | 'ar'
type Filter = 'all' | 'todo' | 'excluded' | 'fix'
const LANG_LABEL: Record<Lang, string> = { lo: '라오', th: '태국', vi: '베트남', mn: '몽골', ar: '아랍' }
const FILTER_LABEL: Record<Filter, string> = { all: '전체', todo: '안 봄', excluded: '제외', fix: '고칠 곳' }
const ST_LABEL: Record<ContentFlagStatus, string> = { ok: '✅ 괜찮음', excluded: '🚫 제외됨', fix: '✏️ 고칠 곳' }

// 일·알바 코스를 앞에 (검토할 일이 가장 많은 곳)
const ORDER = ['massage', 'restaurant', 'store', 'hotel', 'guide', 'eps', 'work', 'parenting', 'citizen']
const sortTracks = (ts: Track[]) =>
  [...ts].sort((a, b) => {
    const ia = ORDER.indexOf(a.id)
    const ib = ORDER.indexOf(b.id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

export default function AdminReview() {
  const tracks = useMemo(() => sortTracks(reviewTracks()), [])
  const [trackId, setTrackId] = useState('massage')
  const [unitIdx, setUnitIdx] = useState(0)
  const [lang, setLang] = useState<Lang>('lo')
  const [filter, setFilter] = useState<Filter>('all')
  const [flags, setFlags] = useState<Record<string, ContentFlag>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [ex, setEx] = useState<Record<string, ExampleEntry>>({})
  const [showEx, setShowEx] = useState(false)

  const track = tracks.find((t) => t.id === trackId) ?? tracks[0]
  const unit = track.units[Math.min(unitIdx, track.units.length - 1)]

  useEffect(() => {
    let alive = true
    setErr('')
    adminContentFlags(trackId).then(
      (rows) => alive && setFlags(Object.fromEntries(rows.map((r) => [r.word_id, r]))),
      (e) => alive && setErr(String((e as Error).message ?? e)),
    )
    return () => {
      alive = false
    }
  }, [trackId])
  useEffect(() => {
    if (!showEx) return
    loadExamples().then((c) => setEx(c.map))
  }, [showEx])

  const missing = /admin_content_flags|function|schema cache/i.test(err)
  const allWords = track.units.flatMap((u) => u.words)
  const count = (st: ContentFlagStatus, ws: Word[]) => ws.filter((w) => flags[w.id]?.status === st).length
  const seen = (ws: Word[]) => ws.filter((w) => flags[w.id]).length
  const rows = unit.words.filter((w) => {
    const st = flags[w.id]?.status
    if (filter === 'all') return true
    if (filter === 'todo') return !st
    return st === filter
  })

  const meaning = (w: Word) => (w[lang] as string) || '—'
  const set = async (w: Word, status: ContentFlagStatus | 'clear', n?: string) => {
    setBusy(w.id)
    setErr('')
    try {
      await adminContentFlagSet(w.id, status, { note: n, ko: w.ko, context: `${w.rom} · ${w.lo}` })
      setFlags((f) => {
        const next = { ...f }
        if (status === 'clear') delete next[w.id]
        else next[w.id] = { word_id: w.id, status, note: n ?? null, ko: w.ko, updated_at: new Date().toISOString() }
        return next
      })
      if (status === 'fix') {
        setEditing(null)
        setNote('')
      }
    } catch (e) {
      setErr(String((e as Error).message ?? e))
    } finally {
      setBusy('')
    }
  }
  const okAll = async () => {
    const left = unit.words.filter((w) => !flags[w.id])
    for (const w of left) await set(w, 'ok')
  }

  return (
    <section className="panel adm-review" id="adm-review">
      <h3 className="adm-h">
        📚 단어 검토{' '}
        <small className="note">
          · {track.title.ko} {seen(allWords)}/{allWords.length} 봄 · 제외 {count('excluded', allWords)} · 고칠 곳 {count('fix', allWords)}
        </small>
      </h3>
      {missing ? (
        <p className="adm-flag">서버에 단어 검토 SQL 을 아직 실행하지 않았어요 (20261128000000_content_review.sql)</p>
      ) : (
        <>
          <p className="note fb-how">
            카드마다 <b>✅ 괜찮음</b> · <b>🚫 제외</b>(앱에서 빠짐 — 앱을 다시 열면 반영) · <b>✏️ 고칠 곳</b>(메모를 쓰면 📮 수정 요청의 <b>맡김</b>으로 들어가 Claude 가 고침)
          </p>
          <div className="rv-pick">
            <select className="input" value={trackId} onChange={(e) => (setTrackId(e.target.value), setUnitIdx(0))} aria-label="코스">
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.title.ko}
                </option>
              ))}
            </select>
            <select className="input" value={unitIdx} onChange={(e) => setUnitIdx(Number(e.target.value))} aria-label="단원">
              {track.units.map((u, i) => (
                <option key={u.id} value={i}>
                  {i + 1}. {u.title.ko} ({seen(u.words)}/{u.words.length})
                </option>
              ))}
            </select>
          </div>
          <div className="rv-pick">
            <Segmented<Lang> name="뜻 언어" value={lang} onChange={setLang} options={(Object.keys(LANG_LABEL) as Lang[]).map((k) => ({ id: k, label: LANG_LABEL[k] }))} />
          </div>
          <div className="rv-pick">
            <Segmented<Filter> name="보기" value={filter} onChange={setFilter} options={(Object.keys(FILTER_LABEL) as Filter[]).map((k) => ({ id: k, label: FILTER_LABEL[k] }))} />
            <label className="rv-ex-toggle">
              <input type="checkbox" checked={showEx} onChange={(e) => setShowEx(e.target.checked)} /> 예문
            </label>
          </div>
          {err && !missing && <p className="adm-flag">{err}</p>}
          {excludedChanged() && <p className="note fb-info">제외 목록이 바뀌었어요 — 앱을 다시 열면 학습 화면에 반영돼요</p>}
          <ul className="rv-list">
            {rows.map((w) => {
              const f = flags[w.id]
              const e = showEx ? ex[w.id] ?? ex[w.ko] : undefined
              const no = Number(w.id.slice(-2))
              return (
                <li key={w.id} className={`rv-row${f ? ` rv-${f.status}` : ''}`}>
                  <div className="rv-main">
                    <span className="rv-no">{no}</span>
                    <span className="rv-emoji" aria-hidden>
                      {w.emoji}
                    </span>
                    <div className="rv-text">
                      <div className="rv-ko">
                        {w.kind === 'phrase' && <span className="rv-kind">문장</span>}
                        {w.ko} <span className="rv-rom">{w.rom}</span>
                      </div>
                      <div className={`rv-mean ${lang}`} dir={lang === 'ar' ? 'rtl' : undefined}>
                        {meaning(w)}
                      </div>
                      {e && (
                        <div className="rv-ex">
                          {e.ex} <span className="rv-rom">· {lang === 'mn' ? e.mn ?? '' : lang === 'ar' ? e.ar ?? '' : e[lang]}</span>
                        </div>
                      )}
                      {f?.note && <div className="rv-note">✏️ {f.note}</div>}
                    </div>
                  </div>
                  <div className="rv-btns">
                    {f && <span className="rv-st">{ST_LABEL[f.status]}</span>}
                    <button className={`chip${f?.status === 'ok' ? ' on' : ''}`} disabled={busy === w.id} onClick={() => set(w, f?.status === 'ok' ? 'clear' : 'ok')}>
                      ✅
                    </button>
                    <button className={`chip${f?.status === 'excluded' ? ' on' : ''}`} disabled={busy === w.id} onClick={() => set(w, f?.status === 'excluded' ? 'clear' : 'excluded')}>
                      {f?.status === 'excluded' ? '↩️ 되돌리기' : '🚫 제외'}
                    </button>
                    <button className={`chip${f?.status === 'fix' ? ' on' : ''}`} disabled={busy === w.id} onClick={() => (setEditing(editing === w.id ? null : w.id), setNote(f?.note ?? ''))}>
                      ✏️
                    </button>
                  </div>
                  {editing === w.id && (
                    <div className="rv-edit">
                      <textarea className="input" rows={2} maxLength={500} placeholder="무엇이 이상한지 · 어떻게 바꿀지 (예: 라오스에서는 이 말 안 씀 → ○○ 로)" value={note} onChange={(e) => setNote(e.target.value)} />
                      <button className="btn btn-pink" disabled={!note.trim() || busy === w.id} onClick={() => set(w, 'fix', note.trim())}>
                        🤖 Claude 에게 맡기기
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
            {!rows.length && <li className="note">이 보기에는 카드가 없어요</li>}
          </ul>
          {unit.words.some((w) => !flags[w.id]) && filter !== 'excluded' && filter !== 'fix' && (
            <button className="btn btn-soft btn-block" disabled={!!busy} onClick={okAll}>
              ✅ 이 단원에서 안 본 카드 {unit.words.filter((w) => !flags[w.id]).length}개 모두 괜찮음
            </button>
          )}
        </>
      )}
    </section>
  )
}
