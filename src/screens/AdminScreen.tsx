// 🛠️ 관리자 · 사용 현황 — 신규 가입 · 활동자 · 사용자별 공부 기록 · 의심 신호
// 들어오는 길: 설정의 '관리자' 버튼(관리자 계정만 보임) 또는 주소 끝에 #admin
// 서버 함수(admin_*)가 관리자만 허용하므로, 화면을 열어도 관리자가 아니면 숫자는 하나도 안 보임
// 운영자 화면이라 한국어만. 이름·사진은 기본으로 가림(화면 공유용) — 사용자가 직접 가린 이름은 원래 가려져 있음
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Icon, Segmented, Toggle } from '../ui'
import { NATIVE_INFO } from '../i18n'
import { COURSES } from '../data/courses'
import { maskName } from '../privacy'
import {
  checkActivityLogging,
  lastActivityReport,
  adminAccessPlaces,
  adminEditionOverview,
  adminDeviceOverview,
  adminLoginOverview,
  type LoginOverview,
  type DeviceStats,
  type EditionStats,
  adminModerate,
  adminReports,
  adminFeedback,
  adminFeedbackCounts,
  adminFeedbackSet,
  type AdminFeedback,
  type FeedbackCounts,
  type FeedbackStatus,
  adminOverview,
  adminUserDetail,
  adminUsers,
  checkAdmin,
  COUNTRIES,
  signInWithEmail,
  signInWithFacebook,
  signOut,
  useAuth,
  type AdminOrder,
  type AdminReport,
  type AdminOverview,
  type AdminUser,
  type AdminUserDetail,
} from '../backend'

const MASK_KEY = 'chang-korean:admin-mask'
const readMask = () => {
  try {
    return localStorage.getItem(MASK_KEY) !== 'off'
  } catch {
    return true
  }
}

const fmtNum = (n: number) => Math.round(n).toLocaleString('ko')
const fmtDur = (sec: number) => {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  return `${h}시간 ${m % 60 ? `${m % 60}분` : ''}`.trim()
}
const fmtDay = (iso: string) => {
  const [, mo, d] = iso.slice(0, 10).split('-')
  return `${Number(mo)}/${Number(d)}`
}
function ago(iso: string | null): string {
  if (!iso) return '기록 없음'
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `${min}분 전`
  if (min < 60 * 24) return `${Math.round(min / 60)}시간 전`
  return `${Math.round(min / 1440)}일 전`
}
const countryLabel = (code: string) => {
  const c = COUNTRIES.find((x) => x.code === code)
  return c ? `${c.flag} ${c.ko}` : code === 'ZZ' ? '🌏 기타' : code
}
const regionKo = (code: string) => {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
const flagOf = (code: string | null) => (code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '')
/** 접속 위치: "🇱🇦 Vientiane" (IP로 추정한 대략적인 위치) */
const placeLabel = (country: string | null, city: string | null) => [flagOf(country), city || country || ''].filter(Boolean).join(' ') || '위치 모름'
const nativeLabel = (id: string) => {
  const n = NATIVE_INFO.find((x) => x.id === id)
  return n ? `${n.flag} ${n.name}` : '응답 없음'
}
const courseLabel = (id: string, level?: number | null) => {
  const c = COURSES.find((x) => x.id === id)
  const name = c ? c.title.ko : id
  return id === 'topik' && level ? `TOPIK ${level}급` : name
}
/** 첫 화면 '공부 중인 코스': 판은 'ja:topik' 처럼 앱 이름이 붙어 옴 */
const courseLabelAll = (k: string) => {
  const i = k.indexOf(':')
  if (i < 0) return courseLabel(k)
  const app = k.slice(0, i)
  const c = k.slice(i + 1)
  return `${APP_LABEL[app] ?? app} · ${c === 'topik' ? '레벨 코스' : c === 'job' ? '생활·학교 코스' : c}`
}
/** 의심 신호: 1시간 상한에 닿은 횟수 · 1초 안에 누른 정답 비율(정답 20개 이상일 때만) */
function suspect(u: AdminUser): string | null {
  const parts: string[] = []
  if (u.hour_caps > 0) parts.push(`1시간 상한 ${u.hour_caps}회`)
  if (u.correct >= 20 && u.fast / u.correct >= 0.4) parts.push(`빠른 답 ${Math.round((u.fast * 100) / u.correct)}%`)
  return parts.length ? parts.join(' · ') : null
}

/** 막대 그래프 한 개 (한 가지 숫자 · 날짜별). 막대를 누르거나 올리면 그날 값 */
function DayBars({
  title,
  data,
  unit,
  fmt = fmtNum,
  legend,
}: {
  title: string
  /** v2 가 있으면 막대 위에 옅은 색으로 쌓음 (예: v 로그인한 계정 · v2 로그인 안 한 기기) */
  data: { day: string; v: number; v2?: number }[]
  unit: string
  fmt?: (n: number) => string
  legend?: [string, string]
}) {
  const [hover, setHover] = useState<number | null>(null)
  const sum = (d: { v: number; v2?: number }) => d.v + (d.v2 ?? 0)
  const max = Math.max(1, ...data.map(sum))
  const total = data.reduce((n, d) => n + sum(d), 0)
  const total1 = data.reduce((n, d) => n + d.v, 0)
  const W = 320
  const H = 120
  const gap = 2
  const bw = Math.max(2, (W - gap * (data.length - 1)) / data.length)
  const sel = hover !== null ? data[hover] : null
  const split = (a: number, b: number) => (legend ? ` (${legend[0]} ${fmt(a)} · ${legend[1]} ${fmt(b)})` : '')
  return (
    <section className="adm-chart panel">
      <div className="adm-chart-head">
        <h3 className="adm-h">{title}</h3>
        <span className="adm-chart-val">{sel ? `${fmtDay(sel.day)} · ${fmt(sum(sel))}${unit}${split(sel.v, sel.v2 ?? 0)}` : `합계 ${fmt(total)}${unit}`}</span>
      </div>
      {legend && (
        <div className="adm-legend note">
          <span className="adm-key" /> {legend[0]} {fmt(total1)}
          {unit} <span className="adm-key k2" /> {legend[1]} {fmt(total - total1)}
          {unit}
        </div>
      )}
      <svg className="adm-bars" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${title}: 최근 ${data.length}일, 합계 ${fmt(total)}${unit}`} onMouseLeave={() => setHover(null)}>
        <line className="adm-grid" x1={0} x2={W} y1={0.5} y2={0.5} />
        <line className="adm-grid" x1={0} x2={W} y1={H / 2} y2={H / 2} />
        <line className="adm-base" x1={0} x2={W} y1={H} y2={H} />
        <text className="adm-tick" x={W} y={10} textAnchor="end">
          {fmt(max)}
        </text>
        {data.map((d, i) => {
          const t = sum(d)
          const h = t > 0 ? Math.max(3, (t / max) * (H - 14)) : 0
          const h1 = t > 0 ? (h * d.v) / t : 0
          const x = i * (bw + gap)
          const r = Math.min(4, bw / 2, h)
          const top = `M${x},${H} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)}>
              {h > 0 && <path className={hover === i ? 'adm-bar on' : d.v2 ? 'adm-bar k2' : 'adm-bar'} d={top} />}
              {h > 0 && d.v2 ? h1 > 0 && <rect className={hover === i ? 'adm-bar on' : 'adm-bar'} x={x} y={H - h1} width={bw} height={h1} /> : null}
              <rect className="adm-hit" x={x - gap / 2} y={0} width={bw + gap} height={H} />
            </g>
          )
        })}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i) =>
          data[i] ? (
            <text key={i} className="adm-tick" x={i * (bw + gap) + bw / 2} y={H + 14} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
              {fmtDay(data[i].day)}
            </text>
          ) : null,
        )}
      </svg>
    </section>
  )
}

/** 항목별 사용자 수 (가로 막대, 큰 순서) */
function Breakdown({ title, counts, label, note }: { title: string; counts: Record<string, number>; label: (k: string) => string; note?: string }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...rows.map((r) => r[1]))
  const sum = rows.reduce((n, r) => n + r[1], 0)
  return (
    <section className="adm-break panel">
      <h3 className="adm-h">{title}</h3>
      {rows.length === 0 && <p className="note">아직 없음</p>}
      {rows.map(([k, n]) => (
        <div key={k} className="adm-break-row" title={`${label(k)} ${n}명`}>
          <span className="adm-break-label">{label(k)}</span>
          <span className="adm-break-track">
            <span className="adm-break-bar" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="adm-break-n num">
            {n}
            <small> {sum ? Math.round((n * 100) / sum) : 0}%</small>
          </span>
        </div>
      ))}
      {note && <p className="note">{note}</p>}
    </section>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="adm-tile">
      <span className="adm-tile-label">{label}</span>
      <span className="adm-tile-value num">{value}</span>
      {sub && <span className="adm-tile-sub">{sub}</span>}
    </div>
  )
}

function UserSheet({ user, mask, onClose }: { user: AdminUser; mask: boolean; onClose: () => void }) {
  const [d, setD] = useState<AdminUserDetail | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    adminUserDetail(user.user_id).then(setD, (e) => setErr(String(e.message ?? e)))
  }, [user.user_id])
  // 최근 60일을 빈 날까지 채워서
  const days = useMemo(() => {
    const byDay = new Map((d?.activity ?? []).map((a) => [a.day.slice(0, 10), a.seconds]))
    const out: { day: string; v: number }[] = []
    const now = new Date()
    for (let i = 59; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 86400000)
      const key = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      out.push({ day: key, v: Math.round((byDay.get(key) ?? 0) / 60) })
    }
    return out
  }, [d])
  const real = user.login_name || user.display_name || user.email || '—'
  const name = mask ? maskName(real) : real
  const kindLabel: Record<string, string> = { study: '공부', exam: '졸업시험', promo: '승급시험' }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet adm-sheet" role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="adm-user-head">
          <Avatar src={mask ? null : user.avatar_url} name={name} size={48} />
          <div>
            <div className="adm-user-name">{name}</div>
            <div className="note">
              {countryLabel(user.country)} · 가입 {fmtDay(user.created_at)} · {courseLabel(user.course, user.topik_level)}
            </div>
          </div>
        </div>
        {err && <p className="note bad">불러오지 못했어요: {err}</p>}
        <div className="adm-tiles">
          <Tile label="활동한 날" value={`${user.active_days}일`} sub={d ? `공부한 날(기기 기록) ${d.study_days}일` : undefined} />
          <Tile label="공부 시간" value={fmtDur(user.study_seconds)} sub={`단어 ${fmtNum(user.words)} · 문제 ${fmtNum(user.questions)}`} />
          <Tile label="포인트" value={fmtNum(user.points)} sub={`최근 7일 ${fmtNum(user.points_7d)}`} />
          <Tile label="그룹" value={d ? `${d.groups}개` : '…'} sub={d?.streak ? `연속 ${d.streak}일` : undefined} />
        </div>
        {suspect(user) && <p className="adm-flag">⚠️ {suspect(user)}</p>}
        {d && d.activity.some((a) => a.country || a.city) && (
          <>
            <h3 className="adm-h">📍 접속 위치 (IP로 추정)</h3>
            <ul className="adm-events">
              {d.activity
                .filter((a) => a.country || a.city)
                .slice(-10)
                .reverse()
                .map((a) => (
                  <li key={a.day} className="adm-place">
                    <span>{fmtDay(a.day)}</span>
                    <span>{placeLabel(a.country, a.city)}</span>
                  </li>
                ))}
            </ul>
          </>
        )}
        <DayBars title="최근 60일 공부 시간" data={days} unit="분" />
        <h3 className="adm-h">최근 포인트 기록</h3>
        <ul className="adm-events">
          {(d?.points ?? []).map((p, i) => (
            <li key={i}>
              <span>{kindLabel[p.kind] ?? p.kind}</span>
              <span className="note">{[p.app && p.app !== 'ko' ? APP_LABEL[p.app] ?? p.app : '', p.ref ?? ''].filter(Boolean).join(' · ')}</span>
              <span className="num">+{p.points}</span>
              <span className="note">{ago(p.created_at)}</span>
            </li>
          ))}
          {d && d.points.length === 0 && <li className="note">기록 없음</li>}
        </ul>
        <button className="btn btn-soft btn-block" onClick={onClose}>
          닫기
        </button>
      </section>
    </div>
  )
}

/** 🩺 기록 점검: 이 기기에서 공부 기록이 서버에 잘 저장되는지 */
function LoggingCheck() {
  const auth = useAuth()
  const [res, setRes] = useState<Awaited<ReturnType<typeof checkActivityLogging>> | null>(null)
  const [busy, setBusy] = useState(false)
  const last = lastActivityReport
  return (
    <section className="panel adm-check">
      <h3 className="adm-h">🩺 기록 점검 (이 기기)</h3>
      <p className="note">로그인: {auth.status === 'in' ? `✓ ${auth.me?.id.slice(0, 8)}…` : '✗ 로그인 안 됨 — 로그인해야 서버에 기록돼요'}</p>
      <p className="note">
        마지막 자동 기록: {last ? `${last.ok ? '✓ 성공' : `✗ 실패 (${last.error})`} · ${ago(new Date(last.at).toISOString())} · ${last.sec}초` : '아직 없음 (공부 화면에서 1분마다 보내요)'}
      </p>
      <button
        className="btn btn-soft btn-block"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setRes(await checkActivityLogging())
          setBusy(false)
        }}
      >
        {busy ? '확인 중…' : '지금 기록 보내고 서버에서 읽어 보기'}
      </button>
      {res && (
        <div className="adm-check-res">
          <p className={res.send ? 'adm-flag' : 'note'}>{res.send ? `✗ 보내기 실패: ${res.send}` : '✓ 보내기 성공'}</p>
          {res.readError && <p className="adm-flag">✗ 읽기 실패: {res.readError}</p>}
          <ul className="adm-events">
            {res.rows.map((r) => (
              <li key={r.day} className="adm-place">
                <span>{fmtDay(r.day)}</span>
                <span>
                  {fmtDur(r.study_seconds)} · 앱 연 횟수 {r.sessions} · {ago(r.last_seen)}
                </span>
              </li>
            ))}
            {!res.readError && res.rows.length === 0 && <li className="note">서버에 내 기록이 없어요</li>}
          </ul>
        </div>
      )}
    </section>
  )
}

const PROVIDER: Record<string, string> = { kakao: '💬 카카오', facebook: '📘 Facebook', email: '✉️ 이메일' }
const APP_LABEL: Record<string, string> = { ko: '🇰🇷 한국어판', ja: '🇯🇵 일본어판', en: '💼 영어판', lo: '🇱🇦 라오스어판' }
const REASON_KO: Record<string, string> = { spam: '광고·스팸', abuse: '욕설·괴롭힘', sexual: '성적인 내용', privacy: '개인정보', other: '기타' }

/** 🚩 신고된 글·댓글: 3명 이상이면 자동으로 숨겨져 있음 → 숨김 유지 · 되살리기 · 삭제 */
function Reports({ mask }: { mask: boolean }) {
  const [rows, setRows] = useState<AdminReport[] | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    adminReports().then(setRows, (e) => {
      setErr(String((e as Error).message ?? e))
      setRows([])
    })
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const act = async (r: AdminReport, a: 'hide' | 'dismiss' | 'delete') => {
    if (a === 'delete' && !confirm('정말 삭제할까요? 되돌릴 수 없어요')) return
    try {
      await adminModerate(r, a)
      load()
    } catch (e) {
      setErr(String((e as Error).message ?? e))
    }
  }
  if (err.includes('admin_reports') || err.includes('function')) return null // 서버에 커뮤니티 SQL 실행 전
  return (
    <section className="panel adm-reports">
      <h3 className="adm-h">
        🚩 신고된 글·댓글 {rows && rows.length > 0 && <small className="note">· {rows.length}건</small>}
      </h3>
      {rows === null && <p className="note">…</p>}
      {rows && rows.length === 0 && <p className="note">신고된 것이 없어요 👍</p>}
      {err && <p className="adm-flag">{err}</p>}
      <ul className="adm-list">
        {rows?.map((r) => (
          <li key={r.type + r.id} className="adm-report">
            <div className="adm-report-top">
              <span className={r.visibility === 'public' ? 'vis-badge vis-public' : 'vis-badge vis-group'}>{r.visibility === 'public' ? '🌏 공개' : '🔒 그룹'}</span>
              <span className="note">{r.type === 'post' ? '글' : '댓글'}</span>
              {r.hidden && <span className="vis-badge vis-hidden">숨겨짐</span>}
              <span className="adm-report-n">🚩 {r.n}명 · {r.reasons.map((x) => REASON_KO[x] ?? x).join(', ')}</span>
            </div>
            <p className="adm-report-body" dir="auto">
              <b>{mask ? maskName(r.name || '—') : r.name || '—'}</b> {r.body}
            </p>
            <div className="adm-report-actions">
              {!r.hidden && (
                <button className="btn btn-soft sm" onClick={() => act(r, 'hide')}>
                  숨기기
                </button>
              )}
              <button className="btn btn-soft sm" onClick={() => act(r, 'dismiss')}>
                {r.hidden ? '되살리기' : '문제없음'}
              </button>
              <button className="btn btn-soft sm danger" onClick={() => act(r, 'delete')}>
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="note">서로 다른 3명이 신고하면 자동으로 숨겨져요. 「문제없음/되살리기」는 신고 기록을 지우고 다시 보이게 해요.</p>
    </section>
  )
}

const FB_CAT: Record<string, string> = { pron: '🔊 발음', meaning: '📖 뜻', example: '💬 예문', picture: '🖼️ 그림', bug: '🐞 오류', idea: '💡 제안', other: '✏️ 기타' }
const FB_APP: Record<string, string> = { ko: '🇰🇷 한국어판', ja: '🇯🇵 일본어판', en: '🇺🇸 영어판', lo: '🇱🇦 라오스어판' }

/** 📮 수정 요청 · 제안 — 새 요청 → (지시를 붙여) Claude 에게 맡김 → 고침 / 넘김. 처리 방법: docs/FEEDBACK.md */
type FbTab = 'new' | 'todo' | 'closed'
const FB_TAB_LABEL: Record<FbTab, string> = { new: '새 요청', todo: '🤖 맡김', closed: '처리함' }

/** Claude 에게 붙여 넣을 글 (개인 이름은 넣지 않음) */
function feedbackBrief(rows: AdminFeedback[]): string {
  const day = new Date().toLocaleDateString('sv-SE')
  const head = `[Chang 수정 요청] 저장소 docs/FEEDBACK.md 대로 처리해 줘 · ${day} · ${rows.length}건`
  const items = rows.map((r) => {
    const top = [`#${r.id}`, `${FB_APP[r.app] ?? r.app}(${r.app})`, FB_CAT[r.category] ?? r.category]
    if (r.target) top.push(`단어: ${r.target}`)
    if (r.context) top.push(`지금: ${r.context}`)
    if (!r.target) top.push(`화면 언어 ${r.ui ?? '—'}`)
    return [top.join(' | '), `  보낸 말: ${r.message.replace(/\s+/g, ' ').trim()}`, `  지시: ${r.admin_note?.trim() || '(없음 — 알아서 판단)'}`].join('\n')
  })
  return [head, '', ...items, '', '끝나면 맨 아래에 CHANG-DONE 블록을 붙여 줘 (관리자 화면 📮 에 붙여 넣어 처리함 표시).'].join('\n')
}

/** Claude 의 CHANG-DONE 블록 읽기: "#12 | done | 무엇을 고쳤는지" · "#13 | skip | 이유" (상태를 빼면 done) */
function parseDone(text: string): { id: number; status: 'done' | 'skip'; note: string }[] {
  const out: { id: number; status: 'done' | 'skip'; note: string }[] = []
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^#?(\d+)\s*[|:·-]\s*(?:(done|skip|고침|넘김)\s*[|:·-]\s*)?(.*)$/i)
    if (!m) continue
    const st = (m[2] ?? 'done').toLowerCase()
    out.push({ id: Number(m[1]), status: st === 'skip' || st === '넘김' ? 'skip' : 'done', note: m[3].trim() })
  }
  return out
}

function FeedbackPanel({ mask }: { mask: boolean }) {
  const [tab, setTab] = useState<FbTab>('new')
  const [rows, setRows] = useState<AdminFeedback[] | null>(null)
  const [counts, setCounts] = useState<FeedbackCounts | null>(null)
  const [err, setErr] = useState('')
  const [noteFor, setNoteFor] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [brief, setBrief] = useState('')
  const [paste, setPaste] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    adminFeedback(tab, 200).then(setRows, (e) => {
      setErr(String((e as Error).message ?? e))
      setRows([])
    })
    adminFeedbackCounts().then(setCounts, () => setCounts(null))
  }, [tab])
  useEffect(() => {
    setRows(null)
    setBrief('')
    setInfo('')
    load()
  }, [load])
  const act = async (id: number, a: FeedbackStatus | 'delete', n?: string) => {
    if (a === 'delete' && !confirm('삭제할까요?')) return
    try {
      await adminFeedbackSet(id, a, n)
      setNoteFor(null)
      setNote('')
      load()
    } catch (e) {
      setErr(String((e as Error).message ?? e))
    }
  }
  const allToTodo = async () => {
    if (!rows?.length || !confirm(`새 요청 ${rows.length}건을 지시 없이 모두 Claude 에게 맡길까요?`)) return
    setBusy(true)
    for (const r of rows) await adminFeedbackSet(r.id, 'todo').catch(() => {})
    setBusy(false)
    setTab('todo')
  }
  const copyBrief = async () => {
    const text = feedbackBrief(rows ?? [])
    setBrief(text)
    try {
      await navigator.clipboard.writeText(text)
      setInfo('복사했어요 — Claude 채팅에 붙여 넣으세요')
    } catch {
      setInfo('아래 글을 길게 눌러 전체 복사해 주세요')
    }
  }
  const applyDone = async () => {
    const list = parseDone(paste)
    if (!list.length) {
      setInfo('읽을 줄이 없어요 — "#번호 | done | 내용" 모양인지 봐 주세요')
      return
    }
    setBusy(true)
    let ok = 0
    for (const x of list) {
      try {
        await adminFeedbackSet(x.id, x.status, x.note)
        ok++
      } catch {
        /* 없는 번호 등은 건너뜀 */
      }
    }
    setBusy(false)
    setPaste('')
    setInfo(`${ok}건을 처리함으로 바꿨어요${ok < list.length ? ` (${list.length - ok}건 실패)` : ''}`)
    load()
  }
  const missing = err.includes('admin_feedback') || err.includes('function')
  const n = (k: FeedbackStatus) => counts?.[k] ?? 0
  return (
    <section className="panel adm-feedback" id="adm-feedback">
      <h3 className="adm-h">
        📮 수정 요청 · 제안{' '}
        {counts && (
          <small className="note">
            · 새 {n('new')} · 맡김 {n('todo')} · 처리 {n('done') + n('skip')}
          </small>
        )}
      </h3>
      {missing ? (
        <p className="adm-flag">서버에 수정 요청 SQL 을 아직 실행하지 않았어요 ({err.includes('admin_feedback_counts') || err.includes('p_note') ? '20261124010000_feedback_workflow.sql' : '20261122080000_feedback.sql'})</p>
      ) : (
        <>
          <p className="note fb-how">
            ① 새 요청을 읽고 <b>🤖 Claude 에게 맡기기</b> (지시를 적어도 되고 비워도 돼요) → ② <b>맡김</b> 탭에서 <b>📋 Claude 에게 보낼 글 복사</b> → Claude 채팅에 붙여 넣기 → ③ Claude 가 고치고 배포한 뒤 준 <b>CHANG-DONE</b> 줄을 아래 칸에 붙여 넣기
          </p>
          <Segmented<FbTab>
            name="수정 요청"
            value={tab}
            onChange={setTab}
            options={(['new', 'todo', 'closed'] as FbTab[]).map((k) => ({
              id: k,
              label: `${FB_TAB_LABEL[k]}${counts ? ` ${k === 'closed' ? n('done') + n('skip') : n(k)}` : ''}`,
            }))}
          />
          {err && !missing && <p className="adm-flag">{err}</p>}
          {info && <p className="note fb-info">{info}</p>}
          {tab === 'new' && rows && rows.length > 1 && (
            <button className="btn btn-soft btn-block" disabled={busy} onClick={allToTodo}>
              🤖 새 요청 {rows.length}건 모두 맡기기 (지시 없이)
            </button>
          )}
          {tab === 'todo' && rows && rows.length > 0 && (
            <div className="fb-claude">
              <button className="btn btn-pink btn-block" onClick={copyBrief}>
                📋 Claude 에게 보낼 글 복사 ({rows.length}건)
              </button>
              {brief && <textarea className="input fb-brief" readOnly rows={8} value={brief} onFocus={(e) => e.currentTarget.select()} />}
              <label className="note" htmlFor="fb-paste">
                ✅ Claude 결과 붙여넣기 (CHANG-DONE 블록)
              </label>
              <textarea id="fb-paste" className="input fb-brief" rows={4} placeholder={'#12 | done | 歯 예문을 바꿈\n#13 | skip | 이미 맞는 뜻'} value={paste} onChange={(e) => setPaste(e.target.value)} />
              <button className="btn btn-mint btn-block" disabled={busy || !paste.trim()} onClick={applyDone}>
                처리함으로 표시
              </button>
            </div>
          )}
          {rows === null && <p className="note">…</p>}
          {rows && rows.length === 0 && <p className="note">{tab === 'new' ? '새 요청이 없어요 👍' : tab === 'todo' ? '맡긴 요청이 없어요' : '아직 처리한 요청이 없어요'}</p>}
          <ul className="adm-list">
            {rows?.map((r) => (
              <li key={r.id} className={`adm-report fb-row fb-st-${r.status}`}>
                <div className="adm-report-top">
                  <span className="chip num">#{r.id}</span>
                  <span className="chip">{FB_APP[r.app] ?? r.app}</span>
                  <span className="chip chip-pink">{FB_CAT[r.category] ?? r.category}</span>
                  {r.status === 'done' && <span className="chip chip-mint">✅ 고침</span>}
                  {r.status === 'skip' && <span className="chip">넘김</span>}
                  <span className="note">{new Date(r.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {r.target && (
                  <p className="fb-target">
                    <b>{r.target}</b> {r.context && <span className="note">· {r.context}</span>}
                  </p>
                )}
                <p className="adm-report-body" dir="auto">
                  {r.message}
                </p>
                <p className="note">
                  {r.user_id ? (mask ? maskName(r.display_name || '—') : r.display_name || '(이름 없음)') : '로그인 안 함'} · 화면 언어 {r.ui ?? '—'}
                </p>
                {r.admin_note && <p className="fb-note">📝 지시: {r.admin_note}</p>}
                {r.resolved_note && <p className="fb-note done">🔧 처리: {r.resolved_note}</p>}
                {noteFor === r.id ? (
                  <div className="fb-note-edit">
                    <textarea
                      className="input"
                      rows={2}
                      maxLength={1000}
                      autoFocus
                      placeholder="지시 (비워도 돼요) 예) 뜻을 '치아'로 · 예문만 고쳐 · 그대로 둬"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="adm-report-actions">
                      <button className="btn btn-pink sm" onClick={() => act(r.id, 'todo', note)}>
                        🤖 맡기기
                      </button>
                      <button className="btn btn-soft sm" onClick={() => setNoteFor(null)}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="adm-report-actions">
                    {r.status === 'new' && (
                      <>
                        <button
                          className="btn btn-pink sm"
                          onClick={() => {
                            setNoteFor(r.id)
                            setNote(r.admin_note ?? '')
                          }}
                        >
                          🤖 Claude 에게 맡기기
                        </button>
                        <button className="btn btn-soft sm" onClick={() => act(r.id, 'skip')}>
                          넘김
                        </button>
                        <button className="btn btn-soft sm" onClick={() => act(r.id, 'done')}>
                          ✅ 이미 고침
                        </button>
                      </>
                    )}
                    {r.status === 'todo' && (
                      <>
                        <button
                          className="btn btn-soft sm"
                          onClick={() => {
                            setNoteFor(r.id)
                            setNote(r.admin_note ?? '')
                          }}
                        >
                          📝 지시 고치기
                        </button>
                        <button className="btn btn-soft sm" onClick={() => act(r.id, 'new')}>
                          맡기기 취소
                        </button>
                      </>
                    )}
                    {(r.status === 'done' || r.status === 'skip') && (
                      <button className="btn btn-soft sm" onClick={() => act(r.id, 'new')}>
                        다시 열기
                      </button>
                    )}
                    <button className="btn btn-soft sm danger" onClick={() => act(r.id, 'delete')}>
                      삭제
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

const STAGE: Record<string, string> = { start: '▶️ 시작', success: '✅ 성공', error: '❌ 오류', abandoned: '↩️ 그만둠' }

/** 🔑 로그인 시도: 앱·로그인 방법별 시도·성공·오류·그만둠 + 실제로 생긴 계정 + 서버에 남은 끝나지 않은 로그인 + 최근 기록 */
function LoginPanel() {
  const [days, setDays] = useState<'1' | '7' | '30'>('7')
  const [d, setD] = useState<LoginOverview | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    setD(null)
    setErr('')
    adminLoginOverview(Number(days)).then(setD, (e) => setErr(String((e as Error).message ?? e)))
  }, [days])
  if (err.includes('admin_login_overview') || err.includes('function'))
    return (
      <section className="panel adm-logins">
        <h3 className="adm-h">🔑 로그인 시도</h3>
        <p className="adm-flag">서버에 로그인 시도 SQL(20261123020000_login_attempts.sql)을 아직 실행하지 않았어요</p>
      </section>
    )
  const fmtAt = (t: string) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <section className="panel adm-logins">
      <h3 className="adm-h">🔑 로그인 시도</h3>
      <Segmented<'1' | '7' | '30'>
        name="기간"
        value={days}
        onChange={setDays}
        options={[
          { id: '1', label: '오늘·어제' },
          { id: '7', label: '7일' },
          { id: '30', label: '30일' },
        ]}
      />
      {err && <p className="adm-flag">{err}</p>}
      {!d && !err && <p className="note">…</p>}
      {d && (
        <>
          {d.by.length === 0 && <p className="note">아직 로그인 버튼을 누른 기록이 없어요 (이 기능을 배포한 뒤부터 쌓여요)</p>}
          <ul className="adm-list">
            {d.by.map((r) => (
              <li key={r.app + r.provider} className="adm-login-row">
                <b>
                  {APP_LABEL[r.app] ?? r.app} · {PROVIDER[r.provider] ?? r.provider}
                </b>
                <span className="note">
                  {' '}
                  — 시도 {fmtNum(r.start)} · <b>성공 {fmtNum(r.success)}</b> · 오류 {fmtNum(r.error)} · 그만둠 {fmtNum(r.abandoned)} (기기 {fmtNum(r.devices)}대)
                </span>
              </li>
            ))}
          </ul>
          <p className="note">
            실제로 생긴 계정: {d.signups.length ? d.signups.map((x) => `${PROVIDER[x.provider] ?? x.provider} ${x.n}`).join(' · ') : '없음'}
            {d.server_pending.length > 0 && (
              <>
                <br />
                서버에 남은 끝나지 않은 로그인: {d.server_pending.map((x) => `${PROVIDER[x.provider] ?? x.provider} ${x.n} (마지막 ${fmtAt(x.last_at)})`).join(' · ')}
              </>
            )}
          </p>
          {d.recent.length > 0 && (
            <ul className="adm-list adm-login-recent">
              {d.recent.map((r, i) => (
                <li key={i} className={`adm-login-item st-${r.stage}`}>
                  <span className="note">{fmtAt(r.at)}</span> {STAGE[r.stage] ?? r.stage} · {APP_LABEL[r.app] ?? r.app} · {PROVIDER[r.provider] ?? r.provider}
                  {r.browser && <span className="note"> · {r.browser}</span>}
                  {r.device_id && <span className="note"> · 기기 {r.device_id.slice(0, 4)}</span>}
                  {r.error && <div className="adm-flag">{r.error}</div>}
                </li>
              ))}
            </ul>
          )}
          <p className="note">
            읽는 법: 📘 Facebook 이 시작만 있고 성공이 없으면 → Meta 앱이 '개발 모드'인지 확인 (개발 모드면 앱 역할이 있는 사람만 로그인됨). ❌ 오류에 KOE 로 시작하는 코드가 있으면 카카오 설정 문제.
            '카카오톡 앱 안'·'페이스북·인스타 앱 안' 브라우저에서 그만둠이 많으면 → 크롬·사파리로 열도록 안내.
          </p>
        </>
      )}
    </section>
  )
}

function Dashboard({ onClose }: { onClose?: () => void }) {
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const [ov, setOv] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [order, setOrder] = useState<AdminOrder>('recent')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [mask, setMask] = useState(readMask)
  const [open, setOpen] = useState<AdminUser | null>(null)
  const [places, setPlaces] = useState<{ countries: Record<string, number>; cities: { country: string | null; city: string; n: number }[] } | null>(null)
  const [eds, setEds] = useState<Partial<Record<'ja' | 'en' | 'lo', EditionStats>> | null>(null)
  const [devs, setDevs] = useState<Partial<Record<'ko' | 'ja' | 'en' | 'lo', DeviceStats>> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [o, u] = await Promise.all([adminOverview(Number(days)), adminUsers(q, order, 50, 0)])
      setOv(o)
      setUsers(u)
      // 접속 위치는 서버에 새 함수가 없으면(SQL 실행 전) 조용히 건너뜀
      adminAccessPlaces(Number(days)).then(setPlaces, () => setPlaces(null))
      // 일본어판·영어판 현황도 SQL 실행 전이면 조용히 건너뜀
      adminEditionOverview(Number(days)).then(setEds, () => setEds(null))
      // 로그인 안 한 사용(기기 기준)도 SQL 실행 전이면 조용히 건너뜀
      adminDeviceOverview(Number(days)).then(setDevs, () => setDevs(null))
    } catch (e) {
      setErr(String((e as Error).message ?? e))
    } finally {
      setLoading(false)
    }
  }, [days, q, order])
  useEffect(() => {
    load()
  }, [load])

  const more = async () => {
    try {
      const next = await adminUsers(q, order, 50, users.length)
      setUsers((u) => [...u, ...next])
    } catch (e) {
      setErr(String((e as Error).message ?? e))
    }
  }
  const setMaskSaved = (on: boolean) => {
    setMask(on)
    try {
      localStorage.setItem(MASK_KEY, on ? 'on' : 'off')
    } catch {
      /* 이 기기에서만 기억 못 함 */
    }
  }
  const series = ov?.series ?? []
  const last7Active = series.slice(-7).reduce((n, d) => n + d.active, 0)
  const total = users[0]?.total ?? 0

  return (
    <div className="screen adm">
      <header className="topbar">
        {onClose && (
          <button className="bubble-btn" onClick={onClose} aria-label="닫기">
            <Icon name="back" />
          </button>
        )}
        <div className="topbar-title">
          <div className="topbar-main">🛠️ 관리자 · 사용 현황</div>
          <div className="topbar-sub">{ov ? `기준일 ${ov.today} (라오스 시간)` : '불러오는 중…'}</div>
        </div>
        <button className="bubble-btn" onClick={() => load()} aria-label="새로 고침" disabled={loading}>
          <Icon name="repeat" />
        </button>
      </header>

      <div className="adm-body">
        <div className="adm-controls">
          <Segmented<'7' | '30' | '90'>
            name="기간"
            value={days}
            onChange={setDays}
            options={[
              { id: '7', label: '7일' },
              { id: '30', label: '30일' },
              { id: '90', label: '90일' },
            ]}
          />
          <Toggle id="adm-mask" label="이름·사진 가리기 (화면 공유용)" on={mask} onChange={setMaskSaved} />
        </div>
        {err && <p className="adm-flag">불러오지 못했어요: {err}</p>}

        {/* 📮 수정 요청은 맨 위 — 매일 가장 먼저 보는 곳 */}
        <FeedbackPanel mask={mask} />

        {ov && (
          <>
            <div className="adm-tiles">
              <Tile label="전체 가입자" value={fmtNum(ov.users)} sub={`30일 신규 ${fmtNum(ov.new_30d)}`} />
              <Tile label="오늘 신규" value={fmtNum(ov.new_today)} sub={`7일 ${fmtNum(ov.new_7d)}`} />
              <Tile
                label="오늘 공부한 사람"
                value={fmtNum(ov.active_today + (ov.anon_today ?? 0))}
                sub={`로그인 ${fmtNum(ov.active_today)}명 · 기기 ${fmtNum(ov.anon_today ?? 0)}대`}
              />
              <Tile
                label="7일 공부 시간"
                value={fmtDur(ov.seconds_7d + (ov.anon_seconds_7d ?? 0))}
                sub={`로그인 ${fmtDur(ov.seconds_7d)} · 기기 ${fmtDur(ov.anon_seconds_7d ?? 0)}`}
              />
              <Tile label="7일 포인트" value={fmtNum(ov.points_7d)} sub="서버에 기록된 것만" />
              <Tile label="다시 온 비율" value={`${ov.users ? Math.round((ov.active_7d * 100) / ov.users) : 0}%`} sub="가입자 중 7일 안에 공부" />
            </div>
            <DayBars title="날짜별 신규 가입" data={series.map((d) => ({ day: d.day, v: d.signups }))} unit="명" />
            {/* 모든 앱 · 실제로 공부한 것만: 진한 색 = 로그인한 계정, 옅은 색 = 그날 로그인하지 않은 기기 */}
            <DayBars title="날짜별 공부한 사람" data={series.map((d) => ({ day: d.day, v: d.active, v2: d.anon_active ?? 0 }))} unit="" legend={['로그인', '로그인 안 한 기기']} />
            <DayBars title="날짜별 공부 시간" data={series.map((d) => ({ day: d.day, v: Math.round(d.seconds / 60), v2: Math.round((d.anon_seconds ?? 0) / 60) }))} unit="분" legend={['로그인', '로그인 안 한 기기']} />
            <div className="adm-breaks">
              <Breakdown title="나라별 가입자" counts={ov.countries} label={countryLabel} />
              <Breakdown title="공부 중인 코스" counts={ov.courses} label={(k) => courseLabelAll(k)} />
              <Breakdown title="내 언어 (동의한 사람만)" counts={ov.natives} label={nativeLabel} note="성별·언어는 설정에서 동의한 사람만 서버에 있어요" />
            </div>
            {places && (
              <div className="adm-breaks">
                <Breakdown title={`접속한 나라 (최근 ${days}일)`} counts={places.countries} label={(k) => `${flagOf(k)} ${COUNTRIES.find((c) => c.code === k)?.ko ?? regionKo(k)}`} />
                <Breakdown
                  title={`접속한 도시 (최근 ${days}일)`}
                  counts={Object.fromEntries(places.cities.map((c) => [placeLabel(c.country, c.city), c.n]))}
                  label={(k) => k}
                  note="IP로 추정한 대략적인 위치예요. 통신사·VPN에 따라 다른 도시로 나올 수 있어요"
                />
              </div>
            )}
          </>
        )}

        {eds && (
          <section className="panel adm-editions">
            <h3 className="adm-h">🇯🇵 일본어판 · 💼 영어판 · 🇱🇦 라오스어판 (한국인 학습자)</h3>
            {(['ja', 'en', 'lo'] as const).map((k) => {
              const e = eds[k]
              if (!e) return null
              return (
                <div key={k} className="adm-ed">
                  <div className="adm-ed-title">{k === 'ja' ? '🇯🇵 일본어판 (JLPT)' : k === 'lo' ? '🇱🇦 라오스어판' : '💼 영어판 (TOEIC)'}</div>
                  <div className="note">
                    로그인 {fmtNum(e.users)}명 · 오늘 {fmtNum(e.active_today)}명 · 7일 {fmtNum(e.active_7d)}명 · 30일 {fmtNum(e.active_30d)}명 · 7일 공부 {fmtNum(Math.round(e.seconds_7d / 60))}분
                  </div>
                  {e.days.length > 0 && <DayBars title="날짜별 공부한 사람" data={e.days.map((d) => ({ day: d.day, v: d.users }))} unit="명" />}
                </div>
              )
            })}
          </section>
        )}

        {devs && (
          <section className="panel adm-editions adm-devices">
            <h3 className="adm-h">📱 로그인 안 하고 쓰는 사람 (기기 기준)</h3>
            <p className="note">
              기기마다 임의 번호로 센 숫자예요 (앱을 열기만 해도 셈). 한 번이라도 그 기기에서 로그인했으면 그 뒤로 로그아웃해도 '로그인함'으로 셉니다 — 실제 공부 시간은 위 '날짜별 공부 시간'을 보세요.
            </p>
            {(['ko', 'ja', 'en', 'lo'] as const).map((k) => {
              const e = devs[k]
              if (!e || !e.devices_30d) return null
              const countries = Object.entries(e.countries_7d ?? {}).sort((a, b) => b[1] - a[1])
              return (
                <div key={k} className="adm-ed">
                  <div className="adm-ed-title">{{ ko: '🇰🇷 한국어판', ja: '🇯🇵 일본어판', en: '💼 영어판', lo: '🇱🇦 라오스어판' }[k]}</div>
                  <div className="note">
                    오늘 {fmtNum(e.devices_today)}대 (로그인 안 함 {fmtNum(e.anon_today)}) · 7일 {fmtNum(e.devices_7d)}대 (안 함 {fmtNum(e.anon_7d)}) · 30일 {fmtNum(e.devices_30d)}대 (안 함 {fmtNum(e.anon_30d)})
                  </div>
                  <div className="note">
                    로그인 안 한 기기의 7일 공부 {fmtNum(Math.round(e.anon_seconds_7d / 60))}분 · 본 단어 {fmtNum(e.anon_words_7d)}개 · 나중에 로그인한 기기 {fmtNum(e.converted)}대
                    {countries.length > 0 && <> · 나라 {countries.map(([c, n]) => `${c} ${n}`).join(', ')}</>}
                  </div>
                  {e.days.length > 0 && <DayBars title="날짜별 기기 (전체)" data={e.days.map((d) => ({ day: d.day, v: d.devices }))} unit="대" />}
                  {e.days.length > 0 && <DayBars title="날짜별 로그인 안 한 기기" data={e.days.map((d) => ({ day: d.day, v: d.anon }))} unit="대" />}
                </div>
              )
            })}
          </section>
        )}

        <LoginPanel />
        <Reports mask={mask} />
        <LoggingCheck />

        <section className="panel adm-users">
          <h3 className="adm-h">사용자별 사용 현황 {total ? <small className="note">· {fmtNum(total)}명</small> : null}</h3>
          <form
            className="adm-search"
            onSubmit={(e) => {
              e.preventDefault()
              setQ(search.trim())
            }}
          >
            <input className="input" placeholder="이름 · 카카오 닉네임 · 이메일로 찾기" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn btn-soft sm" type="submit">
              찾기
            </button>
          </form>
          <div className="adm-chips" role="radiogroup" aria-label="정렬">
            {(
              [
                ['recent', '최근 활동'],
                ['new', '신규 가입'],
                ['points', '포인트'],
                ['time', '공부 시간'],
                ['suspect', '⚠️ 의심 신호'],
              ] as [AdminOrder, string][]
            ).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={order === id} className={order === id ? 'cchip on' : 'cchip'} onClick={() => setOrder(id)}>
                {label}
              </button>
            ))}
          </div>
          <ul className="adm-list">
            {users.map((u) => {
              const real = u.login_name || u.display_name || u.email || '—'
              const name = mask ? maskName(real) : real
              const flag = suspect(u)
              return (
                <li key={u.user_id}>
                  <button className="adm-row" onClick={() => setOpen(u)}>
                    <Avatar src={mask ? null : u.avatar_url} name={name} size={40} />
                    <span className="adm-row-body">
                      <span className="adm-row-top">
                        <b className="adm-row-name">{name}</b>
                        <span className="note">{countryLabel(u.country)}</span>
                      </span>
                      <span className="adm-row-sub">
                        {PROVIDER[u.provider ?? ''] ?? u.provider ?? '—'}
                        {!mask && u.email && <> · {u.email}</>}
                        {(u.apps ?? '').split(',').filter(Boolean).map((a) => (
                          <span key={a} className="chip tiny adm-app">{APP_LABEL[a] ?? a}</span>
                        ))}
                      </span>
                      <span className="adm-row-sub">
                        가입 {fmtDay(u.created_at)} · 로그인 {ago(u.last_sign_in)} · 공부 {ago(u.last_seen)}
                        {(u.apps ?? '').includes('ko') && <> · {courseLabel(u.course, u.topik_level)}</>}
                      </span>
                      <span className="adm-row-sub">📍 {placeLabel(u.geo_country, u.geo_city)}
                      </span>
                      <span className="adm-row-sub">
                        활동 {u.active_days}일 · {fmtDur(u.study_seconds)} · 단어 {fmtNum(u.words)} · ⭐ {fmtNum(u.points)} <small>(7일 {fmtNum(u.points_7d)})</small>
                      </span>
                      {flag && <span className="adm-row-flag">⚠️ {flag}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
            {!loading && users.length === 0 && <li className="note">아직 로그인한 사용자가 없어요</li>}
          </ul>
          {users.length < total && (
            <button className="btn btn-soft btn-block" onClick={more}>
              더 보기 ({users.length}/{total})
            </button>
          )}
          <p className="note">로그인(카카오·Facebook)한 사람의 원래 이름·로그인 방법이에요 (관리자만 봄). 활동·점수는 네 앱을 합친 값이에요. 로그인 없이 쓰는 사람은 위 📱 칸에 기기 기준으로 나와요.</p>
        </section>
      </div>
      {open && <UserSheet user={open} mask={mask} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** 로그인 → 관리자 확인 → 대시보드 */
export default function AdminScreen({ onClose }: { onClose?: () => void }) {
  const auth = useAuth()
  const [state, setState] = useState<'checking' | 'yes' | 'no'>('checking')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let alive = true
    if (auth.status !== 'in') {
      setState('no')
      return
    }
    setState('checking')
    checkAdmin().then((ok) => alive && setState(ok ? 'yes' : 'no'))
    return () => {
      alive = false
    }
  }, [auth.status, auth.me?.id])

  if (auth.status === 'in' && state === 'yes') return <Dashboard onClose={onClose} />

  const sql = auth.me ? `insert into public.admins (user_id) values ('${auth.me.id}');` : ''
  return (
    <div className="screen adm">
      <header className="topbar">
        {onClose && (
          <button className="bubble-btn" onClick={onClose} aria-label="닫기">
            <Icon name="back" />
          </button>
        )}
        <div className="topbar-title">
          <div className="topbar-main">🛠️ 관리자</div>
        </div>
      </header>
      <div className="adm-body">
        {((auth.status === 'in' && state === 'checking') || auth.status === 'loading') && <p className="note center">확인 중…</p>}
        {auth.status === 'in' && state === 'no' && (
          <section className="panel form">
            <h3 className="adm-h">이 계정은 아직 관리자가 아니에요</h3>
            <p className="note">Supabase → SQL Editor 에서 아래 한 줄을 실행하면 이 계정이 관리자가 돼요.</p>
            <pre className="adm-sql">{sql}</pre>
            <button
              className="btn btn-soft btn-block"
              onClick={() => {
                navigator.clipboard?.writeText(sql).then(() => setCopied(true), () => {})
              }}
            >
              {copied ? '✓ 복사했어요' : 'SQL 복사'}
            </button>
            <button className="btn btn-soft btn-block" onClick={() => signOut()}>
              다른 계정으로 로그인
            </button>
          </section>
        )}
        {(auth.status === 'out' || auth.status === 'off') && (
          <section className="panel form">
            <h3 className="adm-h">관리자 로그인</h3>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault()
                setMsg('')
                const err = await signInWithEmail(email, pw)
                if (err) setMsg(err === 'Invalid login credentials' ? '이메일 또는 비밀번호가 맞지 않아요' : err)
              }}
            >
              <label className="label" htmlFor="adm-email">
                이메일
              </label>
              <input id="adm-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="label" htmlFor="adm-pw">
                비밀번호
              </label>
              <input id="adm-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              {msg && <p className="adm-flag">{msg}</p>}
              <button className="btn btn-pink btn-block" type="submit" disabled={!email || !pw}>
                로그인
              </button>
            </form>
            <button className="fb-btn" onClick={() => signInWithFacebook()}>
              <span className="fb-logo" aria-hidden="true">
                f
              </span>{' '}
              Facebook으로 로그인
            </button>
            <p className="note">관리자 계정은 Supabase → Authentication → Users → Add user 로 만들고, SQL 한 줄로 관리자로 지정해요.</p>
          </section>
        )}
      </div>
    </div>
  )
}
