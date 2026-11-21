// 서버 연결 (Supabase): Facebook 로그인 · 프로필 · 학습 기록 동기화 · 점수 · 랭킹(실시간)
// 빌드할 때 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 없으면 서버 없이(예시 랭킹) 동작합니다.
// 설정 방법: docs/backend-setup.md
import { useSyncExternalStore } from 'react'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { getState, setPointsReporter, subscribe, update, type State } from './store'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

// 빌드할 때 넣은 값(GitHub 저장소 변수)이 있으면 그것, 없으면 src/config.ts 의 공개값
const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || SUPABASE_URL
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || SUPABASE_PUBLISHABLE_KEY
const native = Capacitor.isNativePlatform()

/** 서버 설정이 들어 있는지 */
export const backendReady = !!(URL_ && KEY)

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

async function onSession(session: Session | null) {
  if (!supabase) return
  if (!session) {
    setAuth({ status: 'out', me: null })
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
    await supabase.from('profiles').upsert({ id: u.id, display_name: name, avatar_url: avatar, country, updated_at: new Date().toISOString() })
  } catch {
    /* 네트워크 오류여도 로그인 상태는 유지 */
  }
  update((s) => ({ ...s, nickname: name, country }))
  setAuth({ status: 'in', me: { id: u.id, name, avatar, country } })
  await pullProgress(u.id)
}

// ───────── 학습 기록 동기화 ─────────
// 기기 기록과 서버 기록을 합쳐서(외운 단어·통과한 회차는 합집합, STEP은 큰 쪽) 양쪽에 저장

const SYNC_KEYS = ['purposes', 'studyDays', 'passedRounds', 'passedTiers', 'quizOpen', 'placedRounds', 'placementDone', 'bestExam', 'known', 'steps', 'stepKnown', 'wordStats', 'lastChunk', 'streak', 'lastStudyDay'] as const
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

export function initBackend() {
  if (!supabase) return
  setPointsReporter(reportPoints)
  subscribe(schedulePush)
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

export const COUNTRIES: { code: string; flag: string; ko: string; lo: string; th: string; vi: string }[] = [
  { code: 'LA', flag: '🇱🇦', ko: '라오스', lo: 'ລາວ', th: 'ลาว', vi: 'Lào' },
  { code: 'TH', flag: '🇹🇭', ko: '태국', lo: 'ໄທ', th: 'ไทย', vi: 'Thái Lan' },
  { code: 'VN', flag: '🇻🇳', ko: '베트남', lo: 'ຫວຽດນາມ', th: 'เวียดนาม', vi: 'Việt Nam' },
  { code: 'ZZ', flag: '🌏', ko: '기타', lo: 'ອື່ນໆ', th: 'อื่น ๆ', vi: 'Khác' },
]
export const countryOf = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1]
