// 학습 기록·점수·도장 저장 (기기 안 localStorage)
// 서버를 붙이면 이 파일의 저장/불러오기 부분만 API 호출로 바꾸면 됩니다.
import { useSyncExternalStore } from 'react'
import { TIERS, ROUNDS, PACKS, SET_SIZE, findRound, setNative as setWordNative, NATIVES, type Native, type Purpose, type Round, type Word } from './data/words'
import type { UiLang } from './i18n'
import { DEMO_PEOPLE } from './data/friends'
import { TRACKS, findTrack, type Track } from './data/tracks'
import { COURSE_IDS, isJobTrack, jobTrack, topikTrack, type CourseId } from './data/courses'
import { NEWS_ID } from './data/news'

export type Direction = 'ko2n' | 'n2ko' | 'mix'
/** candy = 분홍 파스텔(기본, 여자 선택) · carbon = 묵직한 블랙(남자 선택) */
export type Theme = 'candy' | 'carbon'
export type Gender = 'f' | 'm' | ''
export type Order = 'seq' | 'random'

export interface Settings {
  direction: Direction
  cardSec: number // 카드 앞면 보여주는 시간 (초)
  reps: number // 5개 묶음을 몇 번 반복하고 다음 5개로 넘어갈지 (기본 1 = 1~5, 6~10 … 순서대로 계속)
  autoFaster: boolean // 회차 전체를 한 바퀴 돌 때마다 1초씩 빨라짐 (최소 1초)
  quizSec: number // 문제당 제한시간, 0 = 없음
  order: Order
  autoSpeak: boolean
}

export interface WordStat {
  c: number // 맞힌 횟수
  w: number // 틀린 횟수
  lastWrong: number
}

export interface DayActivity {
  sec: number
  words: number
  questions: number
  sessions: number
}

export interface State {
  v: 5
  started: boolean
  /** 수준 테스트를 봤는지 (또는 '처음이에요'를 골랐는지) */
  placementDone: boolean
  /** 수준 테스트로 건너뛴 회차 */
  placedRounds: string[]
  ui: UiLang
  /** 배우는 사람의 언어 (뜻이 이 언어로 나옴): 라오어 · 태국어 · 베트남어(베타) */
  native: Native
  nickname: string
  /** 내 사진 (기기에서 고른 사진을 작게 줄인 data URL). 페이스북 로그인하면 페이스북 사진이 우선 */
  photo: string
  gender: Gender
  theme: Theme
  /** 나라 (ISO 2글자, 랭킹용). 기본 라오스 */
  country: string
  /** 배우는 목적 (단어팩 추천용) */
  purposes: Purpose[]
  settings: Settings
  /** 회차별 묶음(5개)마다 반복해서 본 횟수 (참고용) */
  chunkPlays: Record<string, number[]>
  /** 한 번이라도 '외웠어요'로 표시한 단어 (스티커북용) */
  known: Record<string, number>
  /** 회차별 지금 STEP (1 = 5개씩, 2 = 25개씩, 3 = 50개씩, 4 = 모두 끝) */
  steps: Record<string, number>
  /** STEP마다 외운 단어: 키 = "회차id#STEP" → { 단어id: 시각 } */
  stepKnown: Record<string, Record<string, number>>
  /** 마지막으로 보던 묶음 (이어보기). 키 = "회차id#STEP" */
  lastChunk: Record<string, number>
  /** 문제·시험이 열린 회차 (한 번 열리면 계속 열림) */
  quizOpen: string[]
  passedRounds: string[]
  passedTiers: number[]
  bestExam: Record<string, number>
  wordStats: Record<string, WordStat>
  monthKey: string
  monthPoints: number
  dayKey: string
  dayPoints: number
  stamps: string[] // 이번 달 도장 받은 날짜 (YYYY-MM-DD)
  streak: number
  lastStudyDay: string
  /** 공부한 날 모음 (YYYY-MM-DD). '나의 한국어 이력'의 공부한 날·성실도 계산용 */
  studyDays: string[]
  /** 하루 활동 요약 (최근 60일): 공부 시간(초)·본 단어·푼 문제·앱 연 횟수. 로그인하면 서버 daily_activity 에도 쌓임 */
  activity: Record<string, DayActivity>
  /** 국적·영주 모의 평가 최고 점수 (100점 만점) */
  bestMock: number
  /** 지금 공부하는 코스 (null = 아직 안 고름 → 목적으로 추정) */
  course: CourseId | null
  /** TOPIK 코스에서 보고 있는 급 (1~6) */
  topikLevel: number
  /** 일·알바 코스에서 고른 트랙 (eps · work · restaurant · store · hotel · massage · guide, 비어 있으면 목적으로 추정) */
  jobTrack: string
  /** 마지막으로 본 '새로워졌어요' 소식 (data/news.ts 의 NEWS_ID) */
  newsSeen: string
  /** 오늘 단원별 연습 문제 포인트 (하루 상한용, 날이 바뀌면 비움) */
  unitDayPts: Record<string, number>
  /** 모의 평가 포인트를 받은 날 */
  mockDay: string
  /** 지금 1시간 (날짜-시) 과 그동안 받은 학습 포인트 */
  hourKey: string
  hourPoints: number
  /** 치팅 의심 신호 (오늘): 맞힌 수 · 그중 1초 안에 누른 수 · 1시간 상한에 닿은 횟수 — 교환 전 서버 심사용 */
  signals: { day: string; correct: number; fast: number; hourCaps: number }
  /** 처음 30초 체험(+환영 포인트)을 마쳤는지 */
  introDone: boolean
  /** 성별·내 언어를 서버에 저장하는 데 동의했는지 (null = 아직 안 물어봄) */
  profileConsent: 'yes' | 'no' | null
  /** 랭킹·그룹에서 이름 일부 가리기 · 사진 가리기 (서버에는 가린 값만) */
  hideName: boolean
  hidePhoto: boolean
  /** 지금까지 누적 의심 신호 (관리자 화면용, signals 는 오늘만) */
  cheat: { correct: number; fast: number; hourCaps: number }
  totalPoints: number
}

// ───────── 포인트 규칙 (docs/points-plan: 공부를 '증명'했을 때만) ─────────
// 카드 넘기기·외웠어요 = 0P (진도만) · 연습 문제는 첫 번에, 1초 넘게 생각하고 맞힐 때만
export const DAILY_CAP = 300 // 하루 최대 학습 포인트 (공부 벌레도 충분히 · 시험 보너스는 따로, 한 번씩만)
export const HOURLY_CAP = 60 // 1시간 최대 — 사람이 정상 속도로는 넘기 어려움. 자주 닿으면 의심 신호
export const EXAM_BONUS = 30 // 졸업시험: 단원마다 처음 통과 한 번
export const PROMO_BONUS = 100 // 승급시험: 계급마다 처음 통과 한 번
export const PRACTICE_POINT = 1 // 연습 문제 첫 번 정답
export const PRACTICE_UNIT_DAY = 10 // 같은 단원 연습 문제는 하루 최대 (반복 파밍 막기)
export const DAILY_DONE_BONUS = 5 // 오늘 공부 완료 (문제 한 세트를 끝내면, 하루 한 번)
export const MIN_ANSWER_MS = 1000 // 이보다 빨리 누른 답은 포인트 없음
export const MOCK_PASS = 60 // 모의 평가: 60점 이상일 때만, 하루 한 번
export const STAMPS_PER_TICKET = 10

const KEY = 'chang-korean:v2'

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const monthOf = (dayKey: string) => dayKey.slice(0, 7)

/** 처음 열 때 폰/브라우저 언어로 학습자 언어를 짐작 (몽골어 폰이면 몽골어 · 나라 · 말 마스코트까지). 모르는 언어면 라오어 */
function guessNative(): Native {
  try {
    const langs = (navigator.languages?.length ? navigator.languages : [navigator.language || '']).map((l) => l.toLowerCase())
    for (const l of langs) {
      if (l.startsWith('mn')) return 'mn'
      if (l.startsWith('ar')) return 'ar'
      if (l.startsWith('th')) return 'th'
      if (l.startsWith('vi')) return 'vi'
      if (l.startsWith('lo')) return 'lo'
    }
  } catch {
    /* 무시 */
  }
  return 'lo'
}
const COUNTRY_OF: Record<Native, string> = { lo: 'LA', th: 'TH', vi: 'VN', mn: 'MN', ar: 'LB' }

function initial(): State {
  const day = todayKey()
  const native = guessNative()
  return {
    v: 5,
    started: false,
    placementDone: false,
    placedRounds: [],
    ui: native,
    native,
    nickname: '',
    photo: '',
    gender: '',
    theme: 'candy',
    country: COUNTRY_OF[native],
    purposes: [],
    settings: { direction: 'ko2n', cardSec: 3, reps: 1, autoFaster: false, quizSec: 10, order: 'seq', autoSpeak: true },
    chunkPlays: {},
    known: {},
    steps: {},
    stepKnown: {},
    lastChunk: {},
    quizOpen: [],
    passedRounds: [],
    passedTiers: [],
    bestExam: {},
    wordStats: {},
    monthKey: monthOf(day),
    monthPoints: 0,
    dayKey: day,
    dayPoints: 0,
    stamps: [],
    streak: 0,
    lastStudyDay: '',
    studyDays: [],
    activity: {},
    introDone: false,
    bestMock: 0,
    course: null,
    topikLevel: 1,
    jobTrack: '',
    newsSeen: '',
    unitDayPts: {},
    mockDay: '',
    hourKey: '',
    hourPoints: 0,
    signals: { day: '', correct: 0, fast: 0, hourCaps: 0 },
    profileConsent: null,
    hideName: false,
    hidePhoto: false,
    cheat: { correct: 0, fast: 0, hourCaps: 0 },
    totalPoints: 0,
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State> & { v?: number }
      const base = initial()
      let merged: State = { ...base, ...parsed, v: 5, settings: { ...base.settings, ...(parsed.settings ?? {}) } }
      // 공부한 날 기록이 생기기 전 사용자: 이번 달 도장 + 마지막 공부한 날로 시작
      if (!Array.isArray(parsed.studyDays)) merged.studyDays = [...new Set([...(parsed.stamps ?? []), ...(parsed.lastStudyDay ? [parsed.lastStudyDay] : [])])].sort()
      // 체험이 생기기 전에 이미 시작한 사람은 체험을 건너뜀
      if (parsed.introDone === undefined) merged.introDone = !!parsed.started
      // 코스·TOPIK 급은 아는 값만
      // 예전 코스 '한국 일자리'·'식당 알바' → 일·알바 코스의 그 트랙
      const oldCourse = merged.course as string | null
      if (oldCourse === 'work' || oldCourse === 'restaurant') merged = { ...merged, course: 'job', jobTrack: oldCourse }
      if (!isJobTrack(merged.jobTrack ?? '')) merged.jobTrack = ''
      if (merged.course !== null && !COURSE_IDS.includes(merged.course)) merged.course = null
      if (!(merged.topikLevel >= 1 && merged.topikLevel <= 6)) merged.topikLevel = 1
      // 나라는 라오스 · 태국 · 베트남 · 몽골 · 레바논 · 기타만
      if (!['LA', 'TH', 'VN', 'MN', 'LB', 'ZZ'].includes(merged.country)) merged.country = 'ZZ'
      // v0.8 이전 기록(라오어만 있던 때)은 라오어로
      if (!parsed.native || !NATIVES.includes(parsed.native)) merged.native = 'lo'
      // v2 → v3: 예전 기본값(같은 5개를 3번 반복)은 '순서대로 계속'으로 바꿈
      if ((parsed.v ?? 0) < 3 && merged.settings.reps === 3) merged.settings = { ...merged.settings, reps: 1 }
      // v4 → v5: 예전에 외운 단어는 STEP 1(5개씩)에서 외운 것으로 옮김
      if ((parsed.v ?? 0) < 5 && parsed.known) {
        const stepKnown: State['stepKnown'] = {}
        for (const [id, ts] of Object.entries(parsed.known)) {
          const key = `${id.split('-')[0]}#1`
          stepKnown[key] = { ...(stepKnown[key] ?? {}), [id]: ts }
        }
        merged.stepKnown = stepKnown
        merged.lastChunk = {}
        for (const r of ROUNDS) if (r.words.every((w) => stepKnown[`${r.id}#1`]?.[w.id])) merged.steps = { ...merged.steps, [r.id]: 2 }
      }
      return merged
    }
  } catch {
    /* 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 메모리에만 보관 */
  }
  return initial()
}

let state: State = rollover(load())
setWordNative(state.native)
const listeners = new Set<() => void>()
// 다른 탭에서 기록이 바뀌면 이 탭도 최신으로 (낡은 기록으로 덮어쓰지 않게)
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return
    state = rollover(load())
    setWordNative(state.native)
    listeners.forEach((l) => l())
  })

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 무시 */
  }
}
persist() // 이전 버전 기록을 바꿨으면 바로 저장

/** 날짜·달이 바뀌었으면 일일 점수 / 월간 점수·도장 초기화 */
// function 선언(호이스팅): 아래 rollover 가 파일을 불러올 때(load) 바로 쓰기 때문
function hourKeyNow(): string {
  return `${todayKey()}-${new Date().getHours()}`
}

function rollover(s: State): State {
  const day = todayKey()
  let next = s
  const hk = hourKeyNow()
  if (next.hourKey !== hk) next = { ...next, hourKey: hk, hourPoints: 0 }
  if (next.signals?.day !== day) next = { ...next, signals: { day, correct: 0, fast: 0, hourCaps: 0 } }
  if (next.dayKey !== day) next = { ...next, dayKey: day, dayPoints: 0, unitDayPts: {} }
  if (next.monthKey !== monthOf(day)) next = { ...next, monthKey: monthOf(day), monthPoints: 0, stamps: [] }
  return next
}

export function update(fn: (s: State) => State) {
  state = fn(rollover(state))
  setWordNative(state.native)
  persist()
  listeners.forEach((l) => l())
}

export function getState() {
  return state
}

/** React 밖에서 상태 변화를 구독 (서버 동기화용) */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ───────── 서버로 점수 보내기 (backend.ts 가 연결) ─────────
type PointsReporter = (kind: 'study' | 'exam' | 'promo', ref: string | null, points: number) => void
let reporter: PointsReporter | null = null
export function setPointsReporter(fn: PointsReporter | null) {
  reporter = fn
}
function report(kind: 'study' | 'exam' | 'promo', ref: string | null, points: number) {
  if (points > 0) reporter?.(kind, ref, points)
}

export function useStore(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export function resetAll() {
  const keep = { started: state.started, ui: state.ui, native: state.native, nickname: state.nickname, photo: state.photo, gender: state.gender, theme: state.theme, country: state.country, profileConsent: state.profileConsent, hideName: state.hideName, hidePhoto: state.hidePhoto }
  // 기록을 지우면 수준 테스트도 다시 볼 수 있음
  state = { ...initial(), ...keep }
  persist()
  listeners.forEach((l) => l())
}

/** 학습자 언어 바꾸기: 화면 언어도 같이 (운영자용 한국어 화면이면 그대로) */
export function setLanguage(native: Native, opts: { country?: boolean } = {}) {
  // 나라를 따로 바꾼 적이 없으면(= 이전 언어의 기본 나라) 언어를 따라 나라·마스코트도 바뀜
  update((s) => ({ ...s, native, ui: s.ui === 'ko' ? 'ko' : native, ...(opts.country || s.country === COUNTRY_OF[s.native] ? { country: COUNTRY_OF[native] } : {}) }))
}

/** 체험 중 외운 단어 포인트 (기기 포인트. 랭킹 점수와는 별개) */
export function grantPoints(n: number) {
  if (n > 0) update((s) => ({ ...s, totalPoints: s.totalPoints + n }))
}
/** 체험 끝: 환영 포인트 주고 끝 표시 */
export function finishIntro(welcome: number) {
  // 처음 시작한 사람은 '새로워졌어요' 를 따로 보여 주지 않음
  update((s) => (s.introDone ? s : { ...s, introDone: true, newsSeen: NEWS_ID, totalPoints: s.totalPoints + welcome }))
}

/** 성별 고르기: 남자 → 블랙(carbon) 테마, 여자 → 분홍(candy) 테마. 테마는 설정에서 따로 바꿀 수 있음 */
export function setGender(gender: Gender) {
  update((s) => ({ ...s, gender, theme: gender === 'm' ? 'carbon' : 'candy' }))
}

export function setSettings(patch: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
}

// ───────── 잠금 규칙 ─────────

export function isTierOpen(s: State, tierNo: number): boolean {
  const tier = TIERS.find((t) => t.no === tierNo)
  if (!tier || tier.rounds.length === 0) return false
  return tierNo === 1 || s.passedTiers.includes(tierNo - 1)
}

export function isRoundOpen(s: State, round: Round): boolean {
  if (!isTierOpen(s, round.tier)) return false
  const tier = TIERS.find((t) => t.no === round.tier)!
  const idx = tier.rounds.findIndex((r) => r.id === round.id)
  return idx === 0 || s.passedRounds.includes(tier.rounds[idx - 1].id)
}

export function isPromoOpen(s: State, tierNo: number): boolean {
  const tier = TIERS.find((t) => t.no === tierNo)
  if (!tier || tier.rounds.length === 0 || !isTierOpen(s, tierNo)) return false
  return tier.rounds.every((r) => s.passedRounds.includes(r.id))
}

/** 외운 단어인지 ('외웠어요' 표시 또는 통과한 회차의 단어) */
export function isKnown(s: State, w: Word): boolean {
  return !!s.known[w.id] || s.passedRounds.includes(w.roundId)
}

export function knownCount(s: State, round: Round): number {
  return round.words.filter((w) => isKnown(s, w)).length
}

// ───────── STEP (5개씩 → 25개씩 → 50개씩) ─────────

export const STEP_SIZES = [5, 25, 50] as const

/** 회차의 STEP별 묶음 크기: 50개 → [5, 25, 50], 25개 단어팩 → [5, 25] */
export function stepSizesOf(round: Round): number[] {
  const n = round.words.length
  return [...STEP_SIZES.filter((k) => k < n), n]
}
export const finalStep = (round: Round) => stepSizesOf(round).length

/** 회차의 지금 STEP: 1부터, 마지막 STEP을 끝내면 finalStep+1 (통과한 회차도) */
export function stepOf(s: State, roundId: string): number {
  const round = findRound(roundId)
  if (s.passedRounds.includes(roundId)) return finalStep(round) + 1
  return Math.min(s.steps[roundId] ?? 1, finalStep(round) + 1)
}

/** STEP을 모두 끝냈는지 */
export function stepsDone(s: State, roundId: string): boolean {
  return stepOf(s, roundId) > finalStep(findRound(roundId))
}

export const stepKey = (roundId: string, step: number) => `${roundId}#${step}`

export function isStepKnown(s: State, w: Word, step: number): boolean {
  return !!s.stepKnown[stepKey(w.roundId, step)]?.[w.id]
}

export function stepKnownCount(s: State, round: Round, step: number): number {
  const m = s.stepKnown[stepKey(round.id, step)] ?? {}
  return round.words.filter((w) => m[w.id]).length
}

/**
 * STEP에서 '외웠어요' 표시/해제. 처음 표시하면 점수(STEP 1은 3점, 2·3은 2점).
 * 회차 50개를 이 STEP에서 모두 외우면 다음 STEP으로 (STEP 3까지 끝나면 문제·시험 열림).
 */
export function setStepKnown(w: Word, step: number, on: boolean): { points: number; stepDone: boolean } {
  const round = findRound(w.roundId)
  const key = stepKey(round.id, step)
  const first = on && !state.stepKnown[key]?.[w.id] && !state.passedRounds.includes(round.id)
  let stepDone = false
  update((s) => {
    const m = { ...(s.stepKnown[key] ?? {}) }
    if (on) m[w.id] = m[w.id] ?? Date.now()
    else delete m[w.id]
    const known = on ? { ...s.known, [w.id]: s.known[w.id] ?? Date.now() } : s.known
    let { steps, quizOpen } = s
    if (on && (s.steps[round.id] ?? 1) === step && round.words.every((x) => m[x.id])) {
      stepDone = true
      steps = { ...steps, [round.id]: step + 1 }
      if (step >= finalStep(round) && !quizOpen.includes(round.id)) quizOpen = [...quizOpen, round.id]
    }
    return { ...s, stepKnown: { ...s.stepKnown, [key]: m }, known, steps, quizOpen }
  })
  // 카드에서 '외웠어요' 는 포인트 없음 (진도만). 공부한 날로는 기록
  if (first) update((s) => markStudyDay(s))
  return { points: 0, stepDone }
}

/** 4지선다 문제·졸업시험이 보이는지: 처음엔 숨김, STEP 1~3을 모두 끝내면 열림 */
export function isQuizOpen(s: State, roundId: string): boolean {
  return s.quizOpen.includes(roundId) || stepsDone(s, roundId)
}

/** 추천 단어팩: 생존 단어 + 고른 목적의 팩 (순서대로) */
export function recommendedPacks(s: State): Round[] {
  return PACKS.filter((p) => p.pack!.purpose === null || s.purposes.includes(p.pack!.purpose))
}

/** 내 목적에 맞는 트랙 (목적을 고르지 않았으면 없음) */
export function recommendedTracks(s: State): Track[] {
  return TRACKS.filter((t) => s.purposes.includes(t.purpose))
}

/** 지금 코스: 고른 것 → 없으면 목적으로 추정 → 기초 */
export function currentCourse(s: State): CourseId {
  if (s.course) return s.course
  const p = s.purposes
  return p.includes('citizen') ? 'citizen' : p.includes('work') || p.includes('parttime') ? 'job' : p.includes('family') ? 'parenting' : p.includes('school') ? 'topik' : 'basic'
}

/** 일·알바 코스의 지금 트랙: 고른 것 → 알바 목적이면 식당 → EPS 단어집 */
export function currentJobTrack(s: State): string {
  if (s.jobTrack && isJobTrack(s.jobTrack)) return s.jobTrack
  return s.purposes.includes('parttime') && !s.purposes.includes('work') ? 'restaurant' : 'eps'
}

/** 코스 바꾸기 — TOPIK 은 급(숫자), 일·알바는 트랙 id 도 함께 */
export function setCourse(id: CourseId, sub?: number | string) {
  update((s) => ({ ...s, course: id, ...(id === 'topik' && typeof sub === 'number' ? { topikLevel: sub } : {}), ...(id === 'job' && typeof sub === 'string' ? { jobTrack: sub } : {}) }))
}

/** 코스 안의 단원들 (기초 = 추천 단어팩 + 회차) */
export function courseUnits(s: State, id: CourseId = currentCourse(s)): Round[] {
  if (id === 'basic') return [...recommendedPacks(s), ...ROUNDS]
  if (id === 'topik') return topikTrack(s.topikLevel)?.units ?? []
  if (id === 'job') return jobTrack(currentJobTrack(s))?.units ?? []
  return findTrack(id)?.units ?? []
}

/** 이어서 할 것: 지금 코스의 다음 단원 (기초는 추천 단어팩 → 지금 회차) */
export function nextUnit(s: State): Round | null {
  const c = currentCourse(s)
  if (c === 'basic') return recommendedPacks(s).find((p) => !stepsDone(s, p.id)) ?? currentRound(s)
  return courseUnits(s, c).find((u) => !stepsDone(s, u.id)) ?? null
}

/** 지금 공부해야 할 회차 (열려 있고 아직 통과 못 한 첫 회차) */
export function currentRound(s: State): Round | null {
  return ROUNDS.find((r) => isRoundOpen(s, r) && !s.passedRounds.includes(r.id)) ?? null
}

export function currentTierNo(s: State): number {
  let t = 1
  for (const tier of TIERS) if (s.passedTiers.includes(tier.no)) t = tier.no + 1
  return Math.min(t, TIERS.length)
}

export function chunkCount(round: Round) {
  return Math.ceil(round.words.length / SET_SIZE)
}

/** 스티커가 색칠되는 조건 = 외운 단어 */
export const isCollected = isKnown

// ───────── 수준 테스트 ─────────

/**
 * 수준 테스트 결과 반영. placedAt = 처음으로 모르는 회차의 순번(ROUNDS 기준, 0이면 처음부터).
 * 앞 회차들은 통과 처리(점수 보너스 없음), 회차를 모두 건너뛴 계급은 승급 처리. 이미 통과한 기록은 지우지 않음.
 */
export function applyPlacement(placedAt: number) {
  const skip = ROUNDS.slice(0, placedAt).map((r) => r.id)
  update((s) => {
    const passedRounds = [...new Set([...s.passedRounds, ...skip])]
    const passedTiers = [...new Set([...s.passedTiers, ...TIERS.filter((t) => t.rounds.length > 0 && t.rounds.every((r) => passedRounds.includes(r.id))).map((t) => t.no)])]
    return {
      ...s,
      placementDone: true,
      placedRounds: [...new Set([...s.placedRounds, ...skip])],
      passedRounds,
      passedTiers,
      quizOpen: [...new Set([...s.quizOpen, ...skip])],
    }
  })
}

// ───────── 점수·도장 ─────────

function markStudyDay(s: State): State {
  const day = todayKey()
  return s.studyDays.includes(day) ? s : { ...s, studyDays: [...s.studyDays, day] }
}

// ───────── 하루 활동 요약 (공부 시간·본 단어·푼 문제·앱 연 횟수) ─────────
// 자주 바뀌므로 모아 두었다가 1분마다(또는 화면을 떠날 때) 한 번에 저장
const pendingActivity: DayActivity = { sec: 0, words: 0, questions: 0, sessions: 0 }
type ActivityReporter = (day: string, delta: DayActivity) => void
let activityReporter: ActivityReporter | null = null
export function setActivityReporter(fn: ActivityReporter | null) {
  activityReporter = fn
}
export function addActivity(delta: Partial<DayActivity>) {
  for (const k of ['sec', 'words', 'questions', 'sessions'] as const) pendingActivity[k] += delta[k] ?? 0
}
const STASH_KEY = 'chang-korean:activity-stash'
function addDay(activity: Record<string, DayActivity>, day: string, d: DayActivity): Record<string, DayActivity> {
  const cur = activity[day] ?? { sec: 0, words: 0, questions: 0, sessions: 0 }
  const next = { ...activity, [day]: { sec: cur.sec + d.sec, words: cur.words + d.words, questions: cur.questions + d.questions, sessions: cur.sessions + d.sessions } }
  // 60일보다 오래된 날은 기기에서 정리 (서버에는 남음)
  const oldest = todayKey(new Date(Date.now() - 59 * 86400000))
  for (const k of Object.keys(next)) if (k < oldest) delete next[k]
  return next
}
/**
 * 모아 둔 활동을 저장.
 * - live: 앱을 쓰는 중 → 상태에 바로 더함
 * - stash: 앱을 떠나는 중 → 전체 기록을 다시 쓰지 않고 작은 별도 칸에만 적어 둠
 *   (다른 탭이 쓴 최신 기록을 낡은 기록으로 덮어쓰지 않도록. 다음에 열 때 합침)
 */
export function flushActivity(mode: 'live' | 'stash' = 'live') {
  const d = { ...pendingActivity }
  if (!d.sec && !d.words && !d.questions && !d.sessions) return
  pendingActivity.sec = pendingActivity.words = pendingActivity.questions = pendingActivity.sessions = 0
  const day = todayKey()
  if (mode === 'stash') {
    try {
      const stash = JSON.parse(localStorage.getItem(STASH_KEY) || '{}') as Record<string, DayActivity>
      localStorage.setItem(STASH_KEY, JSON.stringify(addDay(stash, day, d)))
    } catch {
      /* 저장소를 못 쓰면 버림 */
    }
  } else {
    update((s) => ({ ...s, activity: addDay(s.activity, day, d) }))
  }
  activityReporter?.(day, d)
}
/** 떠날 때 적어 둔 활동을 기록에 합침 (앱을 열 때 · 다시 돌아왔을 때) */
export function absorbActivityStash() {
  let stash: Record<string, DayActivity> = {}
  try {
    stash = JSON.parse(localStorage.getItem(STASH_KEY) || '{}')
    localStorage.removeItem(STASH_KEY)
  } catch {
    return
  }
  const days = Object.entries(stash)
  if (!days.length) return
  update((s) => ({ ...s, activity: days.reduce((a, [day, d]) => addDay(a, day, d), s.activity) }))
}
/** 서버(여러 기기 합계)에서 받은 하루 요약을 기기 기록과 합침 (항목마다 큰 값) */
export function mergeServerActivity(rows: { day: string; sec: number; words: number; questions: number; sessions: number }[]) {
  update((s) => {
    const activity = { ...s.activity }
    for (const r of rows) {
      const cur = activity[r.day] ?? { sec: 0, words: 0, questions: 0, sessions: 0 }
      activity[r.day] = { sec: Math.max(cur.sec, r.sec), words: Math.max(cur.words, r.words), questions: Math.max(cur.questions, r.questions), sessions: Math.max(cur.sessions, r.sessions) }
    }
    return { ...s, activity }
  })
}

/** 나의 한국어 이력: 꾸준함과 성과 (나중에 일자리·유학 연계의 바탕. 공유는 본인이 허락할 때만) */
export function learningRecord(s: State) {
  const since = todayKey(new Date(Date.now() - 29 * 86400000))
  const recent = s.studyDays.filter((d) => d >= since).length
  const best = Math.max(0, ...Object.values(s.bestExam))
  const totalSec = Object.values(s.activity).reduce((n, a) => n + a.sec, 0)
  // 이번 주(월~일) 날짜별 공부 시간(분)
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = todayKey(d)
    return { day: key, min: Math.round((s.activity[key]?.sec ?? 0) / 60), today: key === todayKey(now) }
  })
  return {
    minutes: Math.round(totalSec / 60),
    week,
    days: s.studyDays.length,
    streak: s.streak,
    words: Object.keys(s.known).length,
    rounds: s.passedRounds.length,
    tier: currentTierNo(s),
    best,
    consistency: Math.round((recent / 30) * 100),
    since: s.studyDays[0] ?? '',
  }
}

function addCapped(base: number): number {
  const s = rollover(state)
  const room = Math.max(0, Math.min(DAILY_CAP - s.dayPoints, HOURLY_CAP - s.hourPoints))
  const pts = Math.min(base, room)
  // 이번 1시간 상한에 처음 닿는 순간 = 의심 신호 하나
  const hitHour = s.hourPoints < HOURLY_CAP && s.hourPoints + pts >= HOURLY_CAP
  if (pts > 0 || hitHour) {
    update((st) => {
      const r = rollover(st)
      return markStudyDay({
        ...r,
        dayPoints: r.dayPoints + pts,
        hourPoints: r.hourPoints + pts,
        monthPoints: r.monthPoints + pts,
        totalPoints: r.totalPoints + pts,
        ...(hitHour ? { signals: { ...r.signals, hourCaps: r.signals.hourCaps + 1 }, cheat: { ...r.cheat, hourCaps: (r.cheat?.hourCaps ?? 0) + 1 } } : {}),
      })
    })
    if (pts > 0) report('study', null, pts)
  }
  return pts
}

/** 지금 포인트를 더 못 받는 이유: 하루 상한 / 1시간 상한 / 없음 */
export function capState(s: State = rollover(state)): 'day' | 'hour' | null {
  if (s.dayPoints >= DAILY_CAP) return 'day'
  if (s.hourKey === hourKeyNow() && s.hourPoints >= HOURLY_CAP) return 'hour'
  return null
}

/** 묶음을 한 번 다 본 것을 기록하고 점수(본 단어 수만큼, 하루 상한 있음)를 줌 */
export function recordGroupPass(roundId: string, chunk: number, total: number, viewed: number): number {
  update((s) => {
    const plays = [...(s.chunkPlays[roundId] ?? Array(total).fill(0))]
    while (plays.length < total) plays.push(0)
    plays[chunk] = (plays[chunk] ?? 0) + 1
    return { ...s, chunkPlays: { ...s.chunkPlays, [roundId]: plays } }
  })
  // 묶음을 다 봐도 포인트 없음 (진도만)
  if (viewed > 0) update((s) => markStudyDay(s))
  return 0
}

export function setLastChunk(roundId: string, chunk: number) {
  if (state.lastChunk[roundId] === chunk) return
  update((s) => ({ ...s, lastChunk: { ...s.lastChunk, [roundId]: chunk } }))
}

/** 문제 정답 점수. 하루 상한을 넘으면 0점. 이미 통과한 회차는 절반 */
/** 모의 평가 끝: 최고 점수 저장 + 60점 이상이면 맞힌 문제마다 1P (하루 한 번, 상한 안에서) */
export function recordMock(correct: number, total: number): { score: number; points: number } {
  const score = Math.round((correct / total) * 100)
  const day = todayKey()
  const eligible = score >= MOCK_PASS && state.mockDay !== day
  update((s) => ({ ...s, bestMock: Math.max(s.bestMock, score), ...(eligible ? { mockDay: day } : {}) }))
  // 60점 이상일 때만, 하루 한 번: 맞힌 문제마다 1P
  return { score, points: eligible ? addCapped(correct) : 0 }
}

/** 연습 문제 정답 포인트: 첫 번에 · 1초 넘게 생각하고 맞혔을 때만, 같은 단원은 하루 10P까지 */
export function awardPractice(roundId: string, answerMs: number, firstTry: boolean): number {
  // 의심 신호: 맞힌 수와 그중 너무 빨리 누른 수
  const fast = answerMs < MIN_ANSWER_MS
  update((st) => {
    const r = rollover(st)
    const cheat = r.cheat ?? { correct: 0, fast: 0, hourCaps: 0 }
    return { ...r, signals: { ...r.signals, correct: r.signals.correct + 1, fast: r.signals.fast + (fast ? 1 : 0) }, cheat: { ...cheat, correct: cheat.correct + 1, fast: cheat.fast + (fast ? 1 : 0) } }
  })
  if (!firstTry || fast) return 0
  const s = rollover(state)
  if ((s.unitDayPts[roundId] ?? 0) >= PRACTICE_UNIT_DAY) return 0
  const pts = addCapped(PRACTICE_POINT)
  if (pts > 0) update((st) => ({ ...st, unitDayPts: { ...st.unitDayPts, [roundId]: (st.unitDayPts[roundId] ?? 0) + pts } }))
  return pts
}

/** 문제 결과 기록. 맞히면 '외운 단어', 틀리면 다시 자동 반복에 들어감 */
export function recordAnswer(wordId: string, ok: boolean) {
  addActivity({ questions: 1 })
  update((s) => {
    const prev = s.wordStats[wordId] ?? { c: 0, w: 0, lastWrong: 0 }
    const next: WordStat = ok ? { ...prev, c: prev.c + 1 } : { ...prev, w: prev.w + 1, lastWrong: Date.now() }
    const known = { ...s.known }
    if (ok) known[wordId] = known[wordId] ?? Date.now()
    else delete known[wordId]
    return { ...s, wordStats: { ...s.wordStats, [wordId]: next }, known }
  })
}

/** 공부 한 번을 끝냈을 때 → 오늘 도장(하루 1개)과 연속 학습일 갱신. 새 도장이면 true */
export function completeSession(): boolean {
  const day = todayKey()
  let gotStamp = false
  update((s) => {
    const yesterday = todayKey(new Date(Date.now() - 86400000))
    const streak = s.lastStudyDay === day ? s.streak : s.lastStudyDay === yesterday ? s.streak + 1 : 1
    if (s.stamps.includes(day)) return markStudyDay({ ...s, streak, lastStudyDay: day })
    gotStamp = true
    return markStudyDay({ ...s, stamps: [...s.stamps, day], streak, lastStudyDay: day })
  })
  // 오늘 공부 완료 (문제 한 세트를 끝냄): 하루 한 번 +5P
  if (gotStamp) addCapped(DAILY_DONE_BONUS)
  return gotStamp
}

/** 졸업시험 결과 저장. 첫 통과면 보너스 점수 반환 */
export function recordExam(roundId: string, score: number, total: number): number {
  let bonus = 0
  update((s) => {
    const best = Math.max(s.bestExam[roundId] ?? 0, score)
    let next: State = { ...s, bestExam: { ...s.bestExam, [roundId]: best } }
    if (score === total && !s.passedRounds.includes(roundId)) {
      bonus = EXAM_BONUS
      next = { ...next, passedRounds: [...s.passedRounds, roundId], monthPoints: s.monthPoints + bonus, totalPoints: s.totalPoints + bonus }
    }
    return next
  })
  report('exam', roundId, bonus)
  return bonus
}

export function recordPromo(tierNo: number, passed: boolean): number {
  if (!passed) return 0
  let bonus = 0
  update((s) => {
    if (s.passedTiers.includes(tierNo)) return s
    bonus = PROMO_BONUS
    return { ...s, passedTiers: [...s.passedTiers, tierNo], monthPoints: s.monthPoints + bonus, totalPoints: s.totalPoints + bonus }
  })
  report('promo', String(tierNo), bonus)
  return bonus
}

// ───────── 데모 랭킹 ─────────
// 서버 연결 전 화면 확인용 예시 데이터입니다. 실제 서비스에서는 서버 랭킹으로 바꿉니다.
export interface RankRow {
  name: string
  points: number
  me?: boolean
  tier: number
  avatar?: string | null
  country?: string
}
export function demoRanking(s: State): RankRow[] {
  const day = new Date().getDate()
  const rows: RankRow[] = DEMO_PEOPLE.map((p, i) => ({
    name: p.name,
    avatar: p.avatar,
    country: p.country,
    points: Math.round((3400 * 0.88 ** i + ((i * 37) % 40)) * Math.min(1, 0.25 + day / 30)),
    tier: i < 3 ? 2 : 1,
  }))
  rows.push({ name: s.nickname || ({ lo: 'ຂ້ອຍ', th: 'ฉัน', vi: 'Tôi', mn: 'Би', ar: 'أنا' } as const)[s.native], points: s.monthPoints, me: true, tier: currentTierNo(s), country: s.country })
  return rows.sort((a, b) => b.points - a.points)
}

export function daysLeftInMonth(d = new Date()): number {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return last - d.getDate()
}
