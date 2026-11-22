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
  adminAccessPlaces,
  adminModerate,
  adminReports,
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
/** 의심 신호: 1시간 상한에 닿은 횟수 · 1초 안에 누른 정답 비율(정답 20개 이상일 때만) */
function suspect(u: AdminUser): string | null {
  const parts: string[] = []
  if (u.hour_caps > 0) parts.push(`1시간 상한 ${u.hour_caps}회`)
  if (u.correct >= 20 && u.fast / u.correct >= 0.4) parts.push(`빠른 답 ${Math.round((u.fast * 100) / u.correct)}%`)
  return parts.length ? parts.join(' · ') : null
}

/** 막대 그래프 한 개 (한 가지 숫자 · 날짜별). 막대를 누르거나 올리면 그날 값 */
function DayBars({ title, data, unit, fmt = fmtNum }: { title: string; data: { day: string; v: number }[]; unit: string; fmt?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.v))
  const total = data.reduce((n, d) => n + d.v, 0)
  const W = 320
  const H = 120
  const gap = 2
  const bw = Math.max(2, (W - gap * (data.length - 1)) / data.length)
  const sel = hover !== null ? data[hover] : null
  return (
    <section className="adm-chart panel">
      <div className="adm-chart-head">
        <h3 className="adm-h">{title}</h3>
        <span className="adm-chart-val">{sel ? `${fmtDay(sel.day)} · ${fmt(sel.v)}${unit}` : `합계 ${fmt(total)}${unit}`}</span>
      </div>
      <svg className="adm-bars" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${title}: 최근 ${data.length}일, 합계 ${fmt(total)}${unit}`} onMouseLeave={() => setHover(null)}>
        <line className="adm-grid" x1={0} x2={W} y1={0.5} y2={0.5} />
        <line className="adm-grid" x1={0} x2={W} y1={H / 2} y2={H / 2} />
        <line className="adm-base" x1={0} x2={W} y1={H} y2={H} />
        <text className="adm-tick" x={W} y={10} textAnchor="end">
          {fmt(max)}
        </text>
        {data.map((d, i) => {
          const h = d.v > 0 ? Math.max(3, (d.v / max) * (H - 14)) : 0
          const x = i * (bw + gap)
          const r = Math.min(4, bw / 2, h)
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)}>
              {h > 0 && <path className={hover === i ? 'adm-bar on' : 'adm-bar'} d={`M${x},${H} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`} />}
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
  const name = mask ? maskName(user.display_name || '—') : user.display_name || '—'
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
          <Tile label="활동한 날" value={`${user.active_days}일`} sub={d ? `공부한 날(기기) ${d.study_days}일` : undefined} />
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
              <span className="note">{p.ref ?? ''}</span>
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

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [o, u] = await Promise.all([adminOverview(Number(days)), adminUsers(q, order, 50, 0)])
      setOv(o)
      setUsers(u)
      // 접속 위치는 서버에 새 함수가 없으면(SQL 실행 전) 조용히 건너뜀
      adminAccessPlaces(Number(days)).then(setPlaces, () => setPlaces(null))
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

        {ov && (
          <>
            <div className="adm-tiles">
              <Tile label="전체 가입자" value={fmtNum(ov.users)} sub={`30일 신규 ${fmtNum(ov.new_30d)}`} />
              <Tile label="오늘 신규" value={fmtNum(ov.new_today)} sub={`7일 ${fmtNum(ov.new_7d)}`} />
              <Tile label="오늘 공부한 사람" value={fmtNum(ov.active_today)} sub={`7일 ${fmtNum(ov.active_7d)} · 30일 ${fmtNum(ov.active_30d)}`} />
              <Tile label="7일 공부 시간" value={fmtDur(ov.seconds_7d)} sub={`1명 하루 평균 ${fmtDur(last7Active ? ov.seconds_7d / last7Active : 0)}`} />
              <Tile label="7일 포인트" value={fmtNum(ov.points_7d)} sub="서버에 기록된 것만" />
              <Tile label="다시 온 비율" value={`${ov.users ? Math.round((ov.active_7d * 100) / ov.users) : 0}%`} sub="가입자 중 7일 안에 공부" />
            </div>
            <DayBars title="날짜별 신규 가입" data={series.map((d) => ({ day: d.day, v: d.signups }))} unit="명" />
            <DayBars title="날짜별 공부한 사람" data={series.map((d) => ({ day: d.day, v: d.active }))} unit="명" />
            <DayBars title="날짜별 공부 시간" data={series.map((d) => ({ day: d.day, v: Math.round(d.seconds / 60) }))} unit="분" />
            <div className="adm-breaks">
              <Breakdown title="나라별 가입자" counts={ov.countries} label={countryLabel} />
              <Breakdown title="공부 중인 코스" counts={ov.courses} label={(k) => courseLabel(k)} />
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

        <Reports mask={mask} />

        <section className="panel adm-users">
          <h3 className="adm-h">사용자별 사용 현황 {total ? <small className="note">· {fmtNum(total)}명</small> : null}</h3>
          <form
            className="adm-search"
            onSubmit={(e) => {
              e.preventDefault()
              setQ(search.trim())
            }}
          >
            <input className="input" placeholder="이름으로 찾기" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              const name = mask ? maskName(u.display_name || '—') : u.display_name || '—'
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
                        가입 {fmtDay(u.created_at)} · 마지막 {ago(u.last_seen)} · {courseLabel(u.course, u.topik_level)}
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
          <p className="note">사용 현황은 Facebook으로 로그인한 사람만 서버에 남아요. 로그인 없이 쓰는 사람은 각자 기기에만 기록돼요.</p>
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
