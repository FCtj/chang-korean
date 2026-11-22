// 서버 연결 (Supabase): Facebook 로그인 · 프로필 · 학습 기록 동기화 · 점수 · 랭킹(실시간)
// 빌드할 때 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 없으면 서버 없이(예시 랭킹) 동작합니다.
// 설정 방법: docs/backend-setup.md
import { useSyncExternalStore } from 'react'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { getState, mergeServerActivity, setActivityReporter, setPointsReporter, subscribe, update, useStore, type DayActivity, type State } from './store'
import { publicAvatar, publicName } from './privacy'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

// 주소·키는 src/config.ts 의 공개값 (빌드할 때 VITE_* 로 넣은 값이 있으면 그것)
// 잘못된 값은 쓰지 않음: 주소는 https:// 로 시작해야 하고, 비밀 키(sb_secret_ / service_role)는 절대 쓰지 않음
const isUrl = (v?: string) => !!v && /^https:\/\/[^\s/]+/.test(v)
function isPublicKey(v?: string): boolean {
  if (!v) return false
  if (v.startsWith('sb_publishable_')) return true
  if (v.startsWith('eyJ')) {
    try {
      return JSON.parse(atob(v.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'
    } catch {
      return false
    }
  }
  return false
}
const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const URL_ = isUrl(envUrl) ? envUrl : SUPABASE_URL
const KEY = isPublicKey(envKey) ? envKey : SUPABASE_PUBLISHABLE_KEY
const native = Capacitor.isNativePlatform()

/** 서버 설정이 들어 있는지 */
export const backendReady = isUrl(URL_) && isPublicKey(KEY)

export const supabase: SupabaseClient | null = backendReady
  ? createClient(URL_!, KEY!, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !native },
    })
  : null

/** 안드로이드 앱에서 로그인 후 돌아올 주소 (AndroidManifest.xml 의 intent-filter 와 같아야 함) */
const NATIVE_REDIRECT = 'com.changkorean.app://auth-callback'

// ───────── 로그인 상태 ─────────

export interface Me {
  id: string
  name: string
  avatar: string | null
  country: string
}
export interface AuthState {
  status: 'off' | 'loading' | 'out' | 'in'
  me: Me | null
  error?: string
}

let auth: AuthState = { status: backendReady ? 'loading' : 'off', me: null }
const authSubs = new Set<() => void>()
function setAuth(next: AuthState) {
  auth = next
  authSubs.forEach((f) => f())
}
export function getAuth() {
  return auth
}
export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => {
      authSubs.add(cb)
      return () => authSubs.delete(cb)
    },
    () => auth,
  )
}

export async function signInWithFacebook(): Promise<void> {
  if (!supabase) return
  try {
    if (native) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true, scopes: 'public_profile' },
      })
      if (error || !data.url) throw error ?? new Error('no url')
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url })
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin + window.location.pathname, scopes: 'public_profile' },
      })
      if (error) throw error
    }
  } catch (e) {
    setAuth({ ...auth, error: String((e as Error)?.message ?? e) })
  }
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut().catch(() => {})
  setAuth({ status: 'out', me: null })
}

/** 서버에 있는 내 정보(프로필·학습 기록·점수)를 모두 지우고 로그아웃 */
export async function deleteMyData(): Promise<boolean> {
  if (!supabase || auth.status !== 'in') return false
  const { error } = await supabase.rpc('delete_my_data')
  if (error) return false
  await supabase.rpc('delete_my_review_data').then(undefined, () => {})
  await signOut()
  return true
}

export async function setCountry(country: string) {
  update((s) => ({ ...s, country }))
  if (supabase && auth.status === 'in' && auth.me) {
    setAuth({ ...auth, me: { ...auth.me, country } })
    await supabase.from('profiles').update({ country, updated_at: new Date().toISOString() }).eq('id', auth.me.id)
  }
}

/** 다른 사람에게 보이는 내 모습 (랭킹 '나' 줄·그룹 기록 카드·설정 미리보기) */
export function useMyPublic(): { name: string; avatar: string | null } {
  const s = useStore()
  const a = useAuth()
  return { name: publicName(a.me?.name ?? s.nickname, s.hideName), avatar: publicAvatar(a.me?.avatar || s.photo, s.hidePhoto) }
}

/** 이름 일부·사진 가리기를 바꾸면 서버의 공개 프로필(랭킹·그룹에 보이는 값)도 바로 바꿈 */
export async function syncPublicProfile() {
  if (!supabase || auth.status !== 'in' || !auth.me) return
  const st = getState()
  try {
    await supabase.from('profiles').update({ display_name: publicName(auth.me.name, st.hideName), avatar_url: publicAvatar(auth.me.avatar, st.hidePhoto), updated_at: new Date().toISOString() }).eq('id', auth.me.id)
  } catch {
    /* 다음 로그인 때 다시 */
  }
}

// ───────── 관리자 · 사용 현황 (admin_* 함수는 서버에서 관리자만 허용) ─────────
export interface AdminOverview {
  today: string
  users: number
  new_today: number
  new_7d: number
  new_30d: number
  active_today: number
  active_7d: number
  active_30d: number
  seconds_7d: number
  points_7d: number
  series: { day: string; signups: number; active: number; seconds: number }[]
  countries: Record<string, number>
  natives: Record<string, number>
  courses: Record<string, number>
}
export interface AdminUser {
  user_id: string
  display_name: string
  avatar_url: string | null
  country: string
  created_at: string
  last_seen: string | null
  active_days: number
  study_seconds: number
  words: number
  questions: number
  points: number
  points_7d: number
  course: string
  topik_level: number | null
  native: string | null
  hour_caps: number
  fast: number
  correct: number
  geo_country: string | null
  geo_city: string | null
  total: number
}
export interface AdminUserDetail {
  activity: { day: string; seconds: number; words: number; questions: number; sessions: number; country: string | null; city: string | null }[]
  points: { kind: string; ref: string | null; points: number; created_at: string }[]
  groups: number
  study_days: number
  streak: number | null
}
export type AdminOrder = 'recent' | 'new' | 'points' | 'time' | 'suspect'

export async function adminOverview(days = 30): Promise<AdminOverview> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_overview', { p_days: days })
  if (error) throw new Error(error.message)
  return data as AdminOverview
}
export async function adminUsers(search: string, order: AdminOrder, limit = 50, offset = 0): Promise<AdminUser[]> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_users', { p_search: search || null, p_order: order, p_limit: limit, p_offset: offset })
  if (error) throw new Error(error.message)
  const num = (v: unknown) => Number(v ?? 0)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as AdminUser),
    active_days: num(r.active_days),
    study_seconds: num(r.study_seconds),
    words: num(r.words),
    questions: num(r.questions),
    points: num(r.points),
    points_7d: num(r.points_7d),
    hour_caps: num(r.hour_caps),
    fast: num(r.fast),
    correct: num(r.correct),
    total: num(r.total),
  }))
}
export async function adminUserDetail(userId: string): Promise<AdminUserDetail> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user: userId })
  if (error) throw new Error(error.message)
  return data as AdminUserDetail
}
export interface AdminReport {
  type: 'post' | 'comment'
  id: string
  post_id: string
  body: string
  hidden: boolean
  visibility: 'public' | 'group'
  user_id: string
  name: string
  n: number
  reasons: string[]
  last_at: string
}
/** 신고된 글·댓글 (숨겨진 것 먼저) */
export async function adminReports(): Promise<AdminReport[]> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_reports')
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminReport[]
}
/** hide 숨기기 · dismiss 신고 지우고 되살리기 · delete 삭제 */
export async function adminModerate(r: Pick<AdminReport, 'type' | 'id'>, action: 'hide' | 'dismiss' | 'delete'): Promise<void> {
  if (!supabase) throw new Error('no_backend')
  const { error } = await supabase.rpc('admin_moderate', { p_post: r.type === 'post' ? r.id : null, p_comment: r.type === 'comment' ? r.id : null, p_action: action })
  if (error) throw new Error(error.message)
}

/** 최근 n일 접속 위치: 나라별·도시별 사람 수 */
export async function adminAccessPlaces(days = 30): Promise<{ countries: Record<string, number>; cities: { country: string | null; city: string; n: number }[] }> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_access_places', { p_days: days })
  if (error) throw new Error(error.message)
  return data as { countries: Record<string, number>; cities: { country: string | null; city: string; n: number }[] }
}
/** 관리자 전용 계정(이메일·비밀번호, Supabase 대시보드에서 만든 계정)으로 로그인 — 실패하면 오류 문구 */
export async function signInWithEmail(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'no_backend'
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? error.message : null
}

/** 관리자인지 (admins 표에 있는 계정만 true) */
export async function checkAdmin(): Promise<boolean> {
  if (!supabase || auth.status !== 'in') return false
  try {
    const { data, error } = await supabase.rpc('is_admin')
    return !error && data === true
  } catch {
    return false
  }
}

async function onSession(session: Session | null) {
  if (!supabase) return
  if (!session) {
    // 로그인에서 돌아왔는데(code 있음) 세션이 없으면 마무리 실패 — 보통 다른 브라우저/앱에서 돌아온 경우
    const error = auth.error ?? (returnedWithCode ? 'code_exchange_failed' : undefined)
    setAuth({ status: 'out', me: null, error })
    return
  }
  const u = session.user
  const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>
  const name = meta.full_name || meta.name || getState().nickname || 'User'
  const avatar = meta.avatar_url || meta.picture || null
  let country = getState().country || 'LA'
  try {
    const { data: prof } = await supabase.from('profiles').select('country').eq('id', u.id).maybeSingle()
    if (prof?.country) country = prof.country
    const st = getState()
    await supabase.from('profiles').upsert({ id: u.id, display_name: publicName(name, st.hideName), avatar_url: publicAvatar(avatar, st.hidePhoto), country, updated_at: new Date().toISOString() })
  } catch {
    /* 네트워크 오류여도 로그인 상태는 유지 */
  }
  update((s) => ({ ...s, nickname: name, country }))
  setAuth({ status: 'in', me: { id: u.id, name, avatar, country } })
  await pullProgress(u.id)
  reportGeo().catch(() => {})
  pullActivity().catch(() => {})
  lastPrivate = ''
  syncPrivateProfile().catch(() => {})
}

// ───────── 하루 활동 요약 (daily_activity) ─────────
/** 서버의 '하루' 기준(라오스 시간, UTC+7) 날짜 */
const vientianeDay = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10)

// ───────── 접속 위치 (대략적인 나라·도시, 관리자 화면용) ─────────
// 로그인한 사람만 하루 한 번. IP 위치 서비스(GeoJS)에 물어 나라·도시 이름만 서버에 보냄 — IP 주소는 저장하지 않음
// 서버는 자기가 받은 요청의 나라 헤더가 있으면 그걸 먼저 씀. 실패해도 앱 동작에는 영향 없음
const GEO_KEY = 'chang-korean:geo-day'
let geoBusy = false
async function reportGeo() {
  if (!supabase || auth.status !== 'in' || geoBusy) return
  const day = vientianeDay()
  try {
    if (localStorage.getItem(GEO_KEY) === `${auth.me?.id}:${day}`) return
  } catch {
    /* 기억 못 하면 그냥 진행 (서버는 하루 한 줄만 고침) */
  }
  geoBusy = true
  let country: string | null = null
  let city: string | null = null
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5000)
    const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    clearTimeout(timer)
    if (r.ok) {
      const g = (await r.json()) as Record<string, unknown>
      const cc = String(g.country_code ?? '').toUpperCase()
      country = /^[A-Z]{2}$/.test(cc) ? cc : null
      const c = typeof g.city === 'string' ? g.city.trim().slice(0, 80) : ''
      city = c || null
    }
  } catch {
    /* 위치 서비스가 막혀 있어도 서버 헤더의 나라는 남음 */
  }
  try {
    const { error } = await supabase.rpc('log_geo', { p_country: country, p_city: city })
    if (!error) localStorage.setItem(GEO_KEY, `${auth.me?.id}:${day}`)
  } catch {
    /* 다음에 다시 */
  } finally {
    geoBusy = false
  }
}

function reportActivity(_day: string, d: DayActivity) {
  if (!supabase || auth.status !== 'in') return
  reportGeo().catch(() => {})
  supabase
    .rpc('log_activity', { p_day: vientianeDay(), p_seconds: Math.round(d.sec), p_words: d.words, p_questions: d.questions, p_sessions: d.sessions })
    .then(undefined, () => {})
}

async function pullActivity() {
  if (!supabase) return
  const { data } = await supabase.from('daily_activity').select('day, study_seconds, words_seen, questions, sessions').gte('day', vientianeDay(59))
  if (data)
    mergeServerActivity(
      (data as { day: string; study_seconds: number; words_seen: number; questions: number; sessions: number }[]).map((r) => ({
        day: r.day,
        sec: r.study_seconds,
        words: r.words_seen,
        questions: r.questions,
        sessions: r.sessions,
      })),
    )
}

// ───────── 성별 · 내 언어 (profile_private, 동의한 경우만 · 본인만 볼 수 있음) ─────────
let lastPrivate = ''
async function syncPrivateProfile() {
  if (!supabase || auth.status !== 'in' || !auth.me) return
  const s = getState()
  if (!s.profileConsent) return
  const want = s.profileConsent === 'yes' ? `yes:${s.gender}:${s.native}` : 'no'
  if (want === lastPrivate) return
  lastPrivate = want
  const uid = auth.me.id
  const { error } =
    s.profileConsent === 'yes'
      ? await supabase.from('profile_private').upsert({ user_id: uid, gender: s.gender || null, native: s.native, updated_at: new Date().toISOString() })
      : await supabase.from('profile_private').delete().eq('user_id', uid)
  if (error) lastPrivate = ''
}
let privateTimer: ReturnType<typeof setTimeout> | null = null
function schedulePrivateSync() {
  if (privateTimer) clearTimeout(privateTimer)
  privateTimer = setTimeout(() => syncPrivateProfile().catch(() => {}), 1500)
}

// ───────── 학습 기록 동기화 ─────────
// 기기 기록과 서버 기록을 합쳐서(외운 단어·통과한 회차는 합집합, STEP은 큰 쪽) 양쪽에 저장

// 뒤쪽 course…cheat 는 합치지 않고 올리기만 함 (관리자 사용 현황 화면용)
const SYNC_KEYS = ['purposes', 'studyDays', 'passedRounds', 'passedTiers', 'quizOpen', 'placedRounds', 'placementDone', 'bestExam', 'known', 'steps', 'stepKnown', 'wordStats', 'lastChunk', 'streak', 'lastStudyDay', 'course', 'topikLevel', 'totalPoints', 'native', 'ui', 'cheat'] as const
type Synced = Pick<State, (typeof SYNC_KEYS)[number]>

function snapshot(s: State): Synced {
  const out = {} as Record<string, unknown>
  for (const k of SYNC_KEYS) out[k] = s[k]
  return out as Synced
}

const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])]
const unionN = (a: number[] = [], b: number[] = []) => [...new Set([...a, ...b])]
function maxMap(a: Record<string, number> = {}, b: Record<string, number> = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v)
  return out
}

export function mergeProgress(local: State, remote: Partial<Synced>): State {
  const stepKnown: State['stepKnown'] = { ...local.stepKnown }
  for (const [k, m] of Object.entries(remote.stepKnown ?? {})) stepKnown[k] = { ...m, ...(stepKnown[k] ?? {}) }
  const wordStats: State['wordStats'] = { ...(remote.wordStats ?? {}) }
  for (const [k, v] of Object.entries(local.wordStats)) {
    const r = wordStats[k]
    wordStats[k] = r ? { c: Math.max(r.c, v.c), w: Math.max(r.w, v.w), lastWrong: Math.max(r.lastWrong, v.lastWrong) } : v
  }
  const remoteNewer = (remote.lastStudyDay ?? '') > local.lastStudyDay
  return {
    ...local,
    purposes: local.purposes.length ? local.purposes : (remote.purposes ?? []),
    studyDays: union(local.studyDays, remote.studyDays).sort(),
    passedRounds: union(local.passedRounds, remote.passedRounds),
    passedTiers: unionN(local.passedTiers, remote.passedTiers),
    quizOpen: union(local.quizOpen, remote.quizOpen),
    placedRounds: union(local.placedRounds, remote.placedRounds),
    placementDone: local.placementDone || !!remote.placementDone,
    bestExam: maxMap(local.bestExam, remote.bestExam),
    known: { ...(remote.known ?? {}), ...local.known },
    steps: maxMap(local.steps, remote.steps),
    stepKnown,
    wordStats,
    lastChunk: { ...(remote.lastChunk ?? {}), ...local.lastChunk },
    streak: remoteNewer ? remote.streak ?? local.streak : local.streak,
    lastStudyDay: remoteNewer ? remote.lastStudyDay ?? local.lastStudyDay : local.lastStudyDay,
  }
}

async function pullProgress(uid: string) {
  if (!supabase) return
  try {
    const { data } = await supabase.from('progress').select('data').eq('user_id', uid).maybeSingle()
    if (data?.data) update((s) => mergeProgress(s, data.data as Partial<Synced>))
  } catch {
    /* 무시 */
  }
  await pushProgress()
}

let pushing = false
async function pushProgress() {
  if (!supabase || auth.status !== 'in' || !auth.me || pushing) return
  pushing = true
  try {
    await supabase.from('progress').upsert({ user_id: auth.me.id, data: snapshot(getState()), updated_at: new Date().toISOString() })
  } catch {
    /* 다음에 다시 */
  } finally {
    pushing = false
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
function schedulePush() {
  if (auth.status !== 'in') return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(pushProgress, 4000)
}

// ───────── 점수 → 서버 ─────────
// 서버(award_points)가 하루 상한·한 번에 최대 10점·보너스 중복을 막음

function reportPoints(kind: 'study' | 'exam' | 'promo', ref: string | null, points: number) {
  if (!supabase || auth.status !== 'in') return
  const calls = kind === 'study' ? Array.from({ length: Math.ceil(points / 10) }, (_, i) => Math.min(10, points - i * 10)) : [points]
  for (const p of calls) supabase.rpc('award_points', { p_kind: kind, p_ref: ref, p_points: p }).then(undefined, () => {})
}

// ───────── 랭킹 ─────────

export type Period = 'today' | 'month'
export interface RankRow {
  rank: number
  userId: string
  name: string
  avatar: string | null
  country: string
  points: number
  me?: boolean
  /** 테스트 기간 예시 사용자 */
  sample?: boolean
}

export async function fetchLeaderboard(period: Period, country: string | null, limit = 50): Promise<RankRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('get_leaderboard', { p_period: period, p_country: country, p_limit: limit })
  if (error || !Array.isArray(data)) throw error ?? new Error('bad response')
  const myId = auth.me?.id
  return data.map((r: Record<string, unknown>) => ({
    rank: Number(r.rank),
    userId: String(r.user_id),
    name: String(r.display_name || '—'),
    avatar: (r.avatar_url as string) || null,
    country: String(r.country || ''),
    points: Number(r.points),
    me: r.user_id === myId,
  }))
}

export async function fetchMyRank(period: Period, country: string | null): Promise<{ rank: number; points: number; total: number } | null> {
  if (!supabase || auth.status !== 'in') return null
  const { data, error } = await supabase.rpc('get_my_rank', { p_period: period, p_country: country })
  if (error || !Array.isArray(data) || !data[0]) return null
  return { rank: Number(data[0].rank), points: Number(data[0].points), total: Number(data[0].total) }
}

/** 누군가 점수를 얻으면 onChange 호출 (실시간). 해제 함수 반환 */
export function subscribeLeaderboard(onChange: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`leaderboard-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_events' }, () => onChange())
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

// ───────── 시작 ─────────

/** 웹: Facebook → Supabase 에서 돌아온 주소에 붙은 오류(error_description)를 읽고 주소를 깨끗하게 */
let returnedWithCode = false
function readAuthReturn(): string | undefined {
  if (native || typeof window === 'undefined') return undefined
  const q = new URLSearchParams(window.location.search)
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  returnedWithCode = q.has('code')
  const err = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error')
  if (err) {
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      /* 무시 */
    }
    return err.replace(/\+/g, ' ')
  }
  return undefined
}

export function initBackend() {
  if (!supabase) return
  const returnError = readAuthReturn()
  if (returnError) setAuth({ ...auth, error: returnError })
  setPointsReporter(reportPoints)
  setActivityReporter(reportActivity)
  subscribe(schedulePush)
  subscribe(schedulePrivateSync)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') setTimeout(() => onSession(session), 0)
    if (event === 'SIGNED_OUT') setAuth({ status: 'out', me: null })
  })
  if (native) {
    // 브라우저에서 Facebook 로그인을 마치고 앱으로 돌아왔을 때
    CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT)) return
      const code = new URL(url).searchParams.get('code')
      if (code) await supabase.auth.exchangeCodeForSession(code).catch(() => {})
      const { Browser } = await import('@capacitor/browser')
      Browser.close().catch(() => {})
    })
  }
}

// ───────── 나라 목록 ─────────

export const COUNTRIES: { code: string; flag: string; ko: string; lo: string; th: string; vi: string; mn: string; ar: string }[] = [
  { code: 'LA', flag: '🇱🇦', ko: '라오스', lo: 'ລາວ', th: 'ลาว', vi: 'Lào', mn: 'Лаос', ar: 'لاوس' },
  { code: 'TH', flag: '🇹🇭', ko: '태국', lo: 'ໄທ', th: 'ไทย', vi: 'Thái Lan', mn: 'Тайланд', ar: 'تايلاند' },
  { code: 'VN', flag: '🇻🇳', ko: '베트남', lo: 'ຫວຽດນາມ', th: 'เวียดนาม', vi: 'Việt Nam', mn: 'Вьетнам', ar: 'فيتنام' },
  { code: 'MN', flag: '🇲🇳', ko: '몽골', lo: 'ມົງໂກລີ', th: 'มองโกเลีย', vi: 'Mông Cổ', mn: 'Монгол', ar: 'منغوليا' },
  { code: 'LB', flag: '🇱🇧', ko: '레바논', lo: 'ເລບານອນ', th: 'เลบานอน', vi: 'Li-băng', mn: 'Ливан', ar: 'لبنان' },
  { code: 'ZZ', flag: '🌏', ko: '기타', lo: 'ອື່ນໆ', th: 'อื่น ๆ', vi: 'Khác', mn: 'Бусад', ar: 'أخرى' },
]
export const countryOf = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1]
