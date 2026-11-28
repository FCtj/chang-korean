// 서버 연결 (Supabase): Facebook 로그인 · 프로필 · 학습 기록 동기화 · 점수 · 랭킹(실시간)
// 빌드할 때 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 없으면 서버 없이(예시 랭킹) 동작합니다.
// 설정 방법: docs/backend-setup.md
import { EDITION, IS_KO } from './edition'
import { useSyncExternalStore } from 'react'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { getState, mergeServerActivity, setActivityReporter, setPointsReporter, subscribe, update, useStore, type DayActivity, type State } from './store'
import { publicAvatar, publicName } from './privacy'
import { FACEBOOK_LOGIN, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { saveExcluded, savedExcluded } from './data/excluded'

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

export type LoginProvider = 'facebook' | 'kakao'
const SCOPES: Record<LoginProvider, string> = { facebook: 'public_profile', kakao: 'profile_nickname profile_image' }

/** Facebook 로그인 버튼을 보일지: config FACEBOOK_LOGIN, 또는 주소에 ?fb=1 (이 기기에 기억, ?fb=0 으로 끔) */
export const FB_LOGIN_ON: boolean = (() => {
  if (FACEBOOK_LOGIN) return true
  try {
    const q = new URLSearchParams(window.location.search).get('fb')
    if (q === '1') localStorage.setItem('chang-fb', '1')
    if (q === '0') localStorage.removeItem('chang-fb')
    return localStorage.getItem('chang-fb') === '1'
  } catch {
    return false
  }
})()

/** 서버(Supabase)에 켜져 있는 로그인 방법 — 카카오는 대시보드에서 켜야 버튼이 보임, Facebook 은 FB_LOGIN_ON 일 때만 */
let providers: Partial<Record<LoginProvider, boolean>> | null = null
const providerListeners = new Set<() => void>()
export function loadProviders() {
  if (providers || !backendReady) return
  providers = {}
  fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY ?? '' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { external?: Record<string, boolean> } | null) => {
      providers = { facebook: FB_LOGIN_ON && !!j?.external?.facebook, kakao: !!j?.external?.kakao }
      providerListeners.forEach((f) => f())
    })
    .catch(() => {
      providers = { facebook: FB_LOGIN_ON }
      providerListeners.forEach((f) => f())
    })
}
export function useProviders(): Partial<Record<LoginProvider, boolean>> {
  loadProviders()
  return useSyncExternalStore(
    (f) => {
      providerListeners.add(f)
      return () => providerListeners.delete(f)
    },
    () => providers ?? {},
    () => ({}),
  )
}

export function signInWithFacebook(): Promise<void> {
  return signInWith('facebook')
}
export function signInWithKakao(): Promise<void> {
  return signInWith('kakao')
}
/** '기록 저장' 같은 링크 하나로 로그인할 때: Facebook 이 켜져 있으면 Facebook, 아니면 카카오 */
export function signInPreferred(): Promise<void> {
  return FB_LOGIN_ON ? signInWithFacebook() : signInWithKakao()
}

// ───────── 로그인 시도 기록 (관리자 화면 🔑) ─────────
// 버튼을 누름(start) → 성공(success) / 오류로 돌아옴(error) / 그냥 돌아옴(abandoned). 기기 번호는 기기 기록과 같은 임의 번호
const PENDING_KEY = 'chang-login-pending'
function browserKind(): string {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent
  const os = native ? 'app' : /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'pc'
  const b = /KAKAOTALK/i.test(ua)
    ? '카카오톡 앱 안'
    : /FBAN|FBAV|FB_IAB|Instagram/i.test(ua)
      ? '페이스북·인스타 앱 안'
      : /NAVER/i.test(ua)
        ? '네이버 앱 안'
        : /\bLine\//i.test(ua)
          ? '라인 앱 안'
          : /SamsungBrowser/i.test(ua)
            ? '삼성 인터넷'
            : /EdgA?\//i.test(ua)
              ? 'Edge'
              : /CriOS|Chrome\//i.test(ua)
                ? 'Chrome'
                : /Firefox|FxiOS/i.test(ua)
                  ? 'Firefox'
                  : /Safari/i.test(ua)
                    ? 'Safari'
                    : '기타'
  return `${os} · ${b}`
}
function logLogin(stage: 'start' | 'success' | 'error' | 'abandoned', provider: string, error?: string, token?: string) {
  if (!supabase) return
  const body = JSON.stringify({ p_device: getDeviceId(), p_app: IS_KO ? 'ko' : EDITION, p_provider: provider, p_stage: stage, p_error: error ? error.slice(0, 300) : null, p_browser: browserKind() })
  // 로그인 화면으로 넘어가는 중에도 보내지도록 keepalive
  fetch(`${URL_}/rest/v1/rpc/log_login_attempt`, { method: 'POST', keepalive: true, headers: { apikey: KEY ?? '', Authorization: `Bearer ${token ?? KEY}`, 'Content-Type': 'application/json' }, body }).catch(() => {})
}
function setLoginPending(provider: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ provider, at: Date.now() }))
  } catch {
    /* 무시 */
  }
}
function takeLoginPending(): { provider: string; at: number } | null {
  try {
    const v = localStorage.getItem(PENDING_KEY)
    localStorage.removeItem(PENDING_KEY)
    return v ? (JSON.parse(v) as { provider: string; at: number }) : null
  } catch {
    return null
  }
}

async function signInWith(provider: LoginProvider): Promise<void> {
  if (!supabase) return
  logLogin('start', provider)
  setLoginPending(provider)
  try {
    if (native) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true, scopes: SCOPES[provider] },
      })
      if (error || !data.url) throw error ?? new Error('no url')
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url })
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + window.location.pathname, scopes: SCOPES[provider] },
      })
      if (error) throw error
    }
  } catch (e) {
    takeLoginPending()
    logLogin('error', provider, String((e as Error)?.message ?? e))
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
  /** 그날 로그인하지 않은 기기의 공부 (20261127000000_admin_overview_devices.sql 부터) */
  anon_today?: number
  anon_7d?: number
  anon_seconds_7d?: number
  points_7d: number
  series: { day: string; signups: number; active: number; seconds: number; anon_active?: number; anon_seconds?: number }[]
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
  /** 원래 로그인 이름 (카카오 닉네임 · Facebook 이름) — 관리자만 */
  login_name: string | null
  provider: string | null
  email: string | null
  /** 쓰는 앱: 'ko,ja,en,lo' 중 */
  apps: string | null
  last_sign_in: string | null
  total: number
}
export interface AdminUserDetail {
  /** 날짜별 합계 — 한국어판 + 판(일본어·영어·라오스어) (apps: 그날 공부한 앱) */
  activity: { day: string; seconds: number; words: number; questions: number; sessions: number; country: string | null; city: string | null; apps?: string[] | null }[]
  points: { kind: string; ref: string | null; points: number; created_at: string; app?: string }[]
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
export type EditionStats = { users: number; active_today: number; active_7d: number; active_30d: number; seconds_7d: number; days: { day: string; users: number; seconds: number }[] }
/** 관리자: 일본어판·영어판 사용 현황 (SQL 20261122070000_editions 실행 후) */
export async function adminEditionOverview(days = 30): Promise<Partial<Record<'ja' | 'en' | 'lo', EditionStats>>> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_edition_overview', { p_days: days })
  if (error) throw new Error(error.message)
  return (data ?? {}) as Partial<Record<'ja' | 'en' | 'lo', EditionStats>>
}
// ───────── 수정 요청 · 제안 ─────────
export type FeedbackCategory = 'pron' | 'meaning' | 'example' | 'picture' | 'bug' | 'idea' | 'other'
export type FeedbackInput = { kind: 'word' | 'app'; category: FeedbackCategory; target?: string; context?: string; message: string }
/** 보내기 (로그인 안 해도 됨). 실패하면 이유: no_backend · too_many · 그 밖의 오류 문구 */
export async function submitFeedback(f: FeedbackInput): Promise<string | null> {
  if (!supabase) return 'no_backend'
  const { error } = await supabase.rpc('submit_feedback', {
    p_app: IS_KO ? 'ko' : EDITION,
    p_kind: f.kind,
    p_category: f.category,
    p_target: f.target?.slice(0, 200) || null,
    p_context: f.context?.slice(0, 300) || null,
    p_message: f.message.slice(0, 1000),
    p_ui: getState().ui,
  })
  if (!error) return null
  return error.message.includes('too_many') ? 'too_many' : error.message
}
export type AdminFeedback = {
  id: number
  created_at: string
  app: 'ko' | 'ja' | 'en' | 'lo'
  kind: 'word' | 'app'
  category: FeedbackCategory
  target: string | null
  context: string | null
  message: string
  ui: string | null
  /** new 새 요청 → todo Claude 에게 맡김 → done 고침 / skip 넘김 */
  status: FeedbackStatus
  user_id: string | null
  display_name: string | null
  /** 관리자가 Claude 에게 남긴 지시 */
  admin_note?: string | null
  /** 처리 결과 (무엇을 고쳤는지 / 왜 넘겼는지) */
  resolved_note?: string | null
  updated_at?: string | null
}
export type FeedbackStatus = 'new' | 'todo' | 'done' | 'skip'
export type FeedbackCounts = Record<FeedbackStatus, number>
/** status: 'closed' = 고침 + 넘김, null = 전체 */
export async function adminFeedback(status: 'new' | 'todo' | 'closed' | 'done' | 'skip' | null = null, limit = 200): Promise<AdminFeedback[]> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_feedback', { p_status: status, p_limit: limit })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminFeedback[]
}
/** 상태 바꾸기 + 메모 (todo: 지시, done/skip: 처리 결과) */
export async function adminFeedbackSet(id: number, status: FeedbackStatus | 'delete', note?: string): Promise<void> {
  if (!supabase) throw new Error('no_backend')
  const { error } = await supabase.rpc('admin_feedback_set', { p_id: id, p_status: status, p_note: note ?? null })
  if (error) throw new Error(error.message)
}
export async function adminFeedbackCounts(): Promise<FeedbackCounts> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_feedback_counts')
  if (error) throw new Error(error.message)
  return data as FeedbackCounts
}

/** 📚 단어 검토: ok 검토함 · excluded 제외(앱에서 뺌) · fix 고칠 곳(📮 에 Claude 지시로) */
export type ContentFlagStatus = 'ok' | 'excluded' | 'fix'
export type ContentFlag = { word_id: string; status: ContentFlagStatus; note: string | null; ko: string | null; updated_at: string }
export async function adminContentFlags(trackId: string | null = null): Promise<ContentFlag[]> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_content_flags', { p_prefix: trackId })
  if (error) throw new Error(error.message)
  return (data ?? []) as ContentFlag[]
}
export async function adminContentFlagSet(wordId: string, status: ContentFlagStatus | 'clear', opts: { note?: string; ko?: string; context?: string } = {}): Promise<void> {
  if (!supabase) throw new Error('no_backend')
  const { error } = await supabase.rpc('admin_content_flag_set', {
    p_word_id: wordId,
    p_status: status,
    p_note: opts.note ?? null,
    p_ko: opts.ko ?? null,
    p_context: opts.context?.slice(0, 300) ?? null,
  })
  if (error) throw new Error(error.message)
  // 이 기기의 제외 목록도 바로 고침 (다음에 앱을 열 때 반영)
  const ids = savedExcluded()
  if (status === 'excluded') ids.add(wordId)
  else ids.delete(wordId)
  saveExcluded(ids)
}
/** 앱을 열 때: 관리자가 제외한 카드 목록을 받아 저장 (SQL 실행 전·오프라인이면 조용히 그대로) */
export async function refreshExcluded(): Promise<void> {
  if (!supabase || !IS_KO) return
  try {
    const { data, error } = await supabase.rpc('excluded_words')
    if (error || !Array.isArray(data)) return
    saveExcluded(data as string[])
  } catch {
    /* 오프라인 */
  }
}

/** 관리자: 로그인 시도 (앱·방법별 합계 · 최근 기록 · 서버의 가입 수 · 끝나지 않은 OAuth) */
export type LoginOverview = {
  days: number
  by: { app: string; provider: string; start: number; success: number; error: number; abandoned: number; devices: number }[]
  recent: { at: string; app: string; provider: string; stage: string; error: string | null; browser: string | null; linked: boolean; device_id: string | null }[]
  signups: { provider: string; n: number }[]
  server_pending: { provider: string; n: number; last_at: string }[]
}
export async function adminLoginOverview(days = 7): Promise<LoginOverview> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_login_overview', { p_days: days })
  if (error) throw new Error(error.message)
  return data as LoginOverview
}

/** 관리자: 로그인 안 한 사용 (기기 기준) — 앱마다 */
export type DeviceStats = {
  devices_today: number
  anon_today: number
  devices_7d: number
  anon_7d: number
  devices_30d: number
  anon_30d: number
  anon_seconds_7d: number
  anon_words_7d: number
  converted: number
  countries_7d: Record<string, number>
  days: { day: string; devices: number; anon: number }[]
}
export async function adminDeviceOverview(days = 30): Promise<Partial<Record<'ko' | 'ja' | 'en' | 'lo', DeviceStats>>> {
  if (!supabase) throw new Error('no_backend')
  const { data, error } = await supabase.rpc('admin_device_overview', { p_days: days })
  if (error) throw new Error(error.message)
  return (data ?? {}) as Partial<Record<'ko' | 'ja' | 'en' | 'lo', DeviceStats>>
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
    // 로그인 버튼을 누르고 돌아왔는데 세션이 없음: code 가 있으면 마무리 실패, 없으면 중간에 그만둠
    const pending = takeLoginPending()
    if (pending) logLogin(returnedWithCode ? 'error' : 'abandoned', pending.provider, returnedWithCode ? 'code_exchange_failed' : undefined)
    // 로그인에서 돌아왔는데(code 있음) 세션이 없으면 마무리 실패 — 보통 다른 브라우저/앱에서 돌아온 경우
    const error = auth.error ?? (returnedWithCode ? 'code_exchange_failed' : undefined)
    setAuth({ status: 'out', me: null, error })
    return
  }
  const u = session.user
  {
    const pending = takeLoginPending()
    if (pending) logLogin('success', pending.provider, undefined, session.access_token)
  }
  const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>
  const name = meta.full_name || meta.name || meta.nickname || meta.preferred_username || getState().nickname || 'User'
  const avatar = meta.avatar_url || meta.picture || null
  let country = getState().country || 'LA'
  try {
    const { data: prof } = await supabase.from('profiles').select('country').eq('id', u.id).maybeSingle()
    // 'ZZ' = 가입할 때 서버가 자동으로 만든 프로필(나라 모름) → 앱에서 고른 나라로
    if (prof?.country && prof.country !== 'ZZ') country = prof.country
    const st = getState()
    if (IS_KO || !prof)
      await supabase.from('profiles').upsert({ id: u.id, display_name: publicName(name, st.hideName), avatar_url: publicAvatar(avatar, st.hidePhoto), country: IS_KO ? country : prof?.country || 'ZZ', updated_at: new Date().toISOString() })
    // 일본어·영어판: 나라는 그대로 두고 공개 이름·사진만 (가린 값으로)
    else await supabase.from('profiles').update({ display_name: publicName(name, st.hideName), avatar_url: publicAvatar(avatar, st.hidePhoto), updated_at: new Date().toISOString() }).eq('id', u.id)
  } catch {
    /* 네트워크 오류여도 로그인 상태는 유지 */
  }
  update((s) => ({ ...s, nickname: name, ...(IS_KO ? { country } : {}) }))
  setAuth({ status: 'in', me: { id: u.id, name, avatar, country } })
  await pullProgress(u.id)
  reportGeo().catch(() => {})
  pullActivity().catch(() => {})
  lastPrivate = ''
  if (IS_KO) syncPrivateProfile().catch(() => {})
}

// ───────── 하루 활동 요약 (daily_activity) ─────────
/** 서버의 '하루' 기준(라오스 시간, UTC+7) 날짜 */
const vientianeDay = (offsetDays = 0) => new Date(Date.now() + (IS_KO ? 7 : 9) * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10)
// 일본어·영어판은 판마다 따로 (edition_progress · edition_activity · log_edition_activity, 날짜는 한국 시간 UTC+9)
const ACTIVITY_TABLE = IS_KO ? 'daily_activity' : 'edition_activity'
const logActivity = (a: { p_day: string; p_seconds: number; p_words: number; p_questions: number; p_sessions: number }) =>
  supabase!.rpc(IS_KO ? 'log_activity' : 'log_edition_activity', IS_KO ? a : { p_app: EDITION, ...a })
const progressQuery = () => (IS_KO ? supabase!.from('progress') : supabase!.from('edition_progress'))

// ───────── 접속 위치 (대략적인 나라·도시, 관리자 화면용) ─────────
// 로그인한 사람만 하루 한 번. IP 위치 서비스(GeoJS)에 물어 나라·도시 이름만 서버에 보냄 — IP 주소는 저장하지 않음
// 서버는 자기가 받은 요청의 나라 헤더가 있으면 그걸 먼저 씀. 실패해도 앱 동작에는 영향 없음
const GEO_KEY = 'chang-korean:geo-day'
let geoBusy = false
async function reportGeo() {
  if (!IS_KO || !supabase || auth.status !== 'in' || geoBusy) return
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

/** 마지막으로 서버에 공부 기록을 보낸 결과 (관리자 화면 '기록 점검'에서 봄) */
export let lastActivityReport: { at: number; ok: boolean; error?: string; sec: number } | null = null

// ───────── 로그인하지 않아도 남기는 기기 기록 (device_activity, 관리자 통계용) ─────────
// 기기마다 임의 번호 하나 (이름·연락처 없음). 로그인한 뒤에는 서버가 그 계정과 이어 줌
const DEVICE_KEY = 'chang-device-id'
let deviceId: string | null = null
function getDeviceId(): string | null {
  if (deviceId) return deviceId
  try {
    deviceId = localStorage.getItem(DEVICE_KEY)
    if (!deviceId || !/^[0-9a-f-]{36}$/.test(deviceId)) {
      deviceId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16))
      localStorage.setItem(DEVICE_KEY, deviceId)
    }
  } catch {
    return null
  }
  return deviceId
}
// ───────── 인터넷이 끊겼을 때: 보내지 못한 기록·점수를 기기에 모아 두었다가 다시 연결되면 보냄 ─────────
type Pt = { kind: 'study' | 'exam' | 'promo'; ref: string | null; points: number }
type OfflineQueue = { device: Record<string, DayActivity>; user: { uid: string; days: Record<string, DayActivity> } | null; points: { uid: string; items: Pt[] } | null }
const QUEUE_KEY = `chang-offline-queue:${IS_KO ? 'ko' : EDITION}`
function readQueue(): OfflineQueue {
  try {
    return { device: {}, user: null, points: null, ...(JSON.parse(localStorage.getItem(QUEUE_KEY) || '{}') as Partial<OfflineQueue>) }
  } catch {
    return { device: {}, user: null, points: null }
  }
}
function writeQueue(q: OfflineQueue) {
  try {
    if (!Object.keys(q.device).length && !q.user && !q.points?.items.length) localStorage.removeItem(QUEUE_KEY)
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    /* 기기 저장소를 못 쓰면 버림 */
  }
}
const addDayTo = (m: Record<string, DayActivity>, day: string, d: DayActivity) => {
  const c = m[day] ?? { sec: 0, words: 0, questions: 0, sessions: 0 }
  m[day] = { sec: c.sec + d.sec, words: c.words + d.words, questions: c.questions + d.questions, sessions: c.sessions + d.sessions }
}
/** 서버가 거절한 것(날짜가 지남·값 오류 등)은 다시 보내지 않음. 인터넷·서버의 잠깐 오류만 모아 둠 */
const retryable = (msg?: string) => !/bad_day|bad_value|bad_app|not_logged_in|not_admin|permission|violates/i.test(msg ?? '')
const errText = (e: unknown) => String((e as Error)?.message ?? e)

function sendDevice(day: string, d: DayActivity): PromiseLike<'ok' | 'drop' | 'retry'> {
  const id = getDeviceId()
  if (!supabase || !id) return Promise.resolve('drop')
  const st = getState()
  return supabase
    .rpc('log_device_activity', {
      p_device: id,
      p_app: IS_KO ? 'ko' : EDITION,
      p_day: day,
      p_seconds: Math.round(d.sec),
      p_words: Math.round(d.words),
      p_questions: Math.round(d.questions),
      p_sessions: Math.round(d.sessions),
      p_country: IS_KO && /^[A-Z]{2}$/.test(st.country) && st.country !== 'ZZ' ? st.country : null,
      p_native: IS_KO ? st.native : null,
    })
    .then(
      ({ error }) => (!error ? 'ok' : retryable(error.message) ? 'retry' : 'drop'),
      (e) => (retryable(errText(e)) ? 'retry' : 'drop'),
    )
}
function sendUser(day: string, d: DayActivity): PromiseLike<'ok' | 'drop' | 'retry'> {
  if (!supabase) return Promise.resolve('drop')
  return logActivity({ p_day: day, p_seconds: Math.round(d.sec), p_words: Math.round(d.words), p_questions: Math.round(d.questions), p_sessions: Math.round(d.sessions) }).then(
    ({ error }) => {
      lastActivityReport = { at: Date.now(), ok: !error, error: error?.message, sec: Math.round(d.sec) }
      if (error) console.warn('log_activity failed:', error.message)
      return !error ? 'ok' : retryable(error.message) ? 'retry' : 'drop'
    },
    (e) => {
      lastActivityReport = { at: Date.now(), ok: false, error: errText(e), sec: Math.round(d.sec) }
      return retryable(errText(e)) ? 'retry' : 'drop'
    },
  )
}

function reportActivity(_day: string, d: DayActivity) {
  const day = vientianeDay()
  sendDevice(day, d).then((r) => {
    if (r === 'retry') {
      const q = readQueue()
      addDayTo(q.device, day, d)
      writeQueue(q)
    } else if (r === 'ok') flushOfflineQueue()
  })
  if (!supabase || auth.status !== 'in' || !auth.me) return
  const uid = auth.me.id
  reportGeo().catch(() => {})
  sendUser(day, d).then((r) => {
    if (r !== 'retry') return
    const q = readQueue()
    if (!q.user || q.user.uid !== uid) q.user = { uid, days: {} }
    addDayTo(q.user.days, day, d)
    writeQueue(q)
  })
}

/** 다시 연결되면(또는 앱을 열 때) 모아 둔 기록·점수를 보냄. 아직 끊겨 있으면 다음에 */
let flushing = false
export async function flushOfflineQueue() {
  if (flushing || !supabase) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  flushing = true
  try {
    const q = readQueue()
    for (const [day, d] of Object.entries(q.device)) {
      const r = await sendDevice(day, d)
      if (r === 'retry') return
      delete q.device[day]
      writeQueue(q)
    }
    const uid = auth.status === 'in' ? auth.me?.id : undefined
    if (q.user && uid === q.user.uid) {
      for (const [day, d] of Object.entries(q.user.days)) {
        const r = await sendUser(day, d)
        if (r === 'retry') return
        delete q.user.days[day]
        writeQueue(q)
      }
      q.user = null
      writeQueue(q)
    }
    if (q.points && uid === q.points.uid) {
      while (q.points.items.length) {
        const r = await sendPoint(q.points.items[0])
        if (r === 'retry') return
        q.points.items.shift()
        writeQueue(q)
      }
      q.points = null
      writeQueue(q)
    }
  } finally {
    flushing = false
  }
}

/** 기록 점검: 테스트 기록 한 번 보내고(앱 연 횟수 +1), 서버에 저장된 내 최근 기록을 읽어 옴 */
export async function checkActivityLogging(): Promise<{ send: string | null; rows: { day: string; study_seconds: number; sessions: number; last_seen: string }[]; readError: string | null }> {
  if (!supabase || auth.status !== 'in') return { send: 'not_logged_in', rows: [], readError: null }
  const { error } = await logActivity({ p_day: vientianeDay(), p_seconds: 0, p_words: 0, p_questions: 0, p_sessions: 1 })
  let rq = supabase.from(ACTIVITY_TABLE).select('day, study_seconds, sessions, last_seen')
  if (!IS_KO) rq = rq.eq('app', EDITION)
  const r = await rq.order('day', { ascending: false }).limit(5)
  return { send: error ? error.message : null, rows: (r.data ?? []) as { day: string; study_seconds: number; sessions: number; last_seen: string }[], readError: r.error ? r.error.message : null }
}

async function pullActivity() {
  if (!supabase) return
  let rq = supabase.from(ACTIVITY_TABLE).select('day, study_seconds, words_seen, questions, sessions').gte('day', vientianeDay(59))
  if (!IS_KO) rq = rq.eq('app', EDITION)
  const { data } = await rq
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
const SYNC_KEYS = ['purposes', 'studyDays', 'passedRounds', 'passedTiers', 'quizOpen', 'placedRounds', 'placementDone', 'bestExam', 'known', 'steps', 'stepKnown', 'wordStats', 'lastChunk', 'streak', 'lastStudyDay', 'course', 'topikLevel', 'totalPoints', 'native', 'ui', 'cheat', 'mockRounds'] as const
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
    mockRounds: maxMap(local.mockRounds ?? {}, remote.mockRounds ?? {}),
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
    let rq = progressQuery().select('data').eq('user_id', uid)
    if (!IS_KO) rq = rq.eq('app', EDITION)
    const { data } = await rq.maybeSingle()
    if (data?.data) {
      const remote = data.data as Partial<Synced>
      update((s) => mergeProgress(s, remote))
      // 일본어·영어판: 이 판에서 공부한 기록이 있는 계정이면 실력 테스트 없이 그 레벨로 바로 홈
      if (!IS_KO && ((remote.studyDays?.length ?? 0) > 0 || Object.keys(remote.steps ?? {}).length > 0))
        update((s) => (s.introDone ? s : { ...s, introDone: true, course: 'topik', topikLevel: remote.topikLevel ?? s.topikLevel }))
    }
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
    await progressQuery().upsert({ user_id: auth.me.id, ...(IS_KO ? {} : { app: EDITION }), data: snapshot(getState()), updated_at: new Date().toISOString() })
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

function sendPoint(p: Pt): PromiseLike<'ok' | 'drop' | 'retry'> {
  if (!supabase) return Promise.resolve('drop')
  const call = IS_KO
    ? supabase.rpc('award_points', { p_kind: p.kind, p_ref: p.ref, p_points: p.points })
    : supabase.rpc('award_edition_points', { p_app: EDITION, p_kind: p.kind, p_ref: p.ref, p_points: p.points })
  return call.then(
    ({ error }) => (!error ? 'ok' : retryable(error.message) ? 'retry' : 'drop'),
    (e) => (retryable(errText(e)) ? 'retry' : 'drop'),
  )
}
function reportPoints(kind: 'study' | 'exam' | 'promo', ref: string | null, points: number) {
  if (!supabase || auth.status !== 'in' || !auth.me) return
  // 일본어·영어·라오스어판: 판마다 따로 쌓는 점수 (승급 보너스 없음). 서버가 한 번에 10점 · 하루 400점 등 상한
  if (!IS_KO && kind === 'promo') return
  const uid = auth.me.id
  const parts: Pt[] = (kind === 'study' ? Array.from({ length: Math.ceil(points / 10) }, (_, i) => Math.min(10, points - i * 10)) : [points]).map((n) => ({ kind, ref, points: n }))
  for (const p of parts)
    sendPoint(p).then((r) => {
      if (r !== 'retry') return
      const q = readQueue()
      if (!q.points || q.points.uid !== uid) q.points = { uid, items: [] }
      if (q.points.items.length < 300) q.points.items.push(p)
      writeQueue(q)
    })
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
  const { data, error } = IS_KO
    ? await supabase.rpc('get_leaderboard', { p_period: period, p_country: country, p_limit: limit })
    : await supabase.rpc('get_edition_leaderboard', { p_app: EDITION, p_period: period, p_limit: limit })
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
  const { data, error } = IS_KO
    ? await supabase.rpc('get_my_rank', { p_period: period, p_country: country })
    : await supabase.rpc('get_my_edition_rank', { p_app: EDITION, p_period: period })
  if (error || !Array.isArray(data) || !data[0]) return null
  return { rank: Number(data[0].rank), points: Number(data[0].points), total: Number(data[0].total) }
}

/** 누군가 점수를 얻으면 onChange 호출 (실시간). 해제 함수 반환 */
export function subscribeLeaderboard(onChange: () => void): () => void {
  // 일본어·영어판 점수 표는 직접 읽을 수 없어 실시간 대신 30초마다 다시 불러옴
  if (!supabase || !IS_KO) return () => {}
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
  if (returnError) {
    setAuth({ ...auth, error: returnError })
    const pending = takeLoginPending()
    logLogin('error', pending?.provider ?? 'unknown', returnError)
  }
  setPointsReporter(reportPoints)
  setActivityReporter(reportActivity)
  // 인터넷이 다시 되면: 모아 둔 기록·점수 보내기 + 학습 기록 동기화
  if (typeof window !== 'undefined')
    window.addEventListener('online', () => {
      flushOfflineQueue()
      if (auth.status === 'in') schedulePush()
    })
  setTimeout(() => flushOfflineQueue(), 5000)
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
