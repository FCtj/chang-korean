// 학습 기록·점수·도장 저장 (기기 안 localStorage)
// 서버를 붙이면 이 파일의 저장/불러오기 부분만 API 호출로 바꾸면 됩니다.
import { useSyncExternalStore } from 'react'
import { TIERS, ROUNDS, PACKS, SET_SIZE, findRound, type Purpose, type Round, type Word } from './data/words'
import type { UiLang } from './i18n'

export type Direction = 'ko2n' | 'n2ko' | 'mix'
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

export interface State {
  v: 5
  started: boolean
  /** 수준 테스트를 봤는지 (또는 '처음이에요'를 골랐는지) */
  placementDone: boolean
  /** 수준 테스트로 건너뛴 회차 */
  placedRounds: string[]
  ui: UiLang
  nickname: string
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
  totalPoints: number
}

export const DAILY_CAP = 400 // 하루에 받을 수 있는 최대 학습 점수
export const EXAM_BONUS = 100
export const PROMO_BONUS = 300
export const STAMPS_PER_TICKET = 10

const KEY = 'chang-korean:v2'

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const monthOf = (dayKey: string) => dayKey.slice(0, 7)

function initial(): State {
  const day = todayKey()
  return {
    v: 5,
    started: false,
    placementDone: false,
    placedRounds: [],
    ui: 'lo',
    nickname: '',
    country: 'LA',
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
    totalPoints: 0,
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State> & { v?: number }
      const base = initial()
      const merged: State = { ...base, ...parsed, v: 5, settings: { ...base.settings, ...(parsed.settings ?? {}) } }
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
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 무시 */
  }
}
persist() // 이전 버전 기록을 바꿨으면 바로 저장

/** 날짜·달이 바뀌었으면 일일 점수 / 월간 점수·도장 초기화 */
function rollover(s: State): State {
  const day = todayKey()
  let next = s
  if (next.dayKey !== day) next = { ...next, dayKey: day, dayPoints: 0 }
  if (next.monthKey !== monthOf(day)) next = { ...next, monthKey: monthOf(day), monthPoints: 0, stamps: [] }
  return next
}

export function update(fn: (s: State) => State) {
  state = fn(rollover(state))
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
  const keep = { started: state.started, ui: state.ui, nickname: state.nickname, country: state.country }
  // 기록을 지우면 수준 테스트도 다시 볼 수 있음
  state = { ...initial(), ...keep }
  persist()
  listeners.forEach((l) => l())
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
  const points = first ? addCapped(step === 1 ? 3 : 2) : 0
  return { points, stepDone }
}

/** 4지선다 문제·졸업시험이 보이는지: 처음엔 숨김, STEP 1~3을 모두 끝내면 열림 */
export function isQuizOpen(s: State, roundId: string): boolean {
  return s.quizOpen.includes(roundId) || stepsDone(s, roundId)
}

/** 추천 단어팩: 생존 단어 + 고른 목적의 팩 (순서대로) */
export function recommendedPacks(s: State): Round[] {
  return PACKS.filter((p) => p.pack!.purpose === null || s.purposes.includes(p.pack!.purpose))
}

/** 이어서 할 것: 아직 안 끝낸 추천 단어팩이 있으면 그것 먼저, 없으면 지금 회차 */
export function nextUnit(s: State): Round | null {
  return recommendedPacks(s).find((p) => !stepsDone(s, p.id)) ?? currentRound(s)
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

function addCapped(base: number): number {
  const s = rollover(state)
  const pts = Math.min(base, Math.max(0, DAILY_CAP - s.dayPoints))
  if (pts > 0) {
    update((st) => ({ ...st, dayPoints: st.dayPoints + pts, monthPoints: st.monthPoints + pts, totalPoints: st.totalPoints + pts }))
    report('study', null, pts)
  }
  return pts
}

/** 묶음을 한 번 다 본 것을 기록하고 점수(본 단어 수만큼, 하루 상한 있음)를 줌 */
export function recordGroupPass(roundId: string, chunk: number, total: number, viewed: number): number {
  update((s) => {
    const plays = [...(s.chunkPlays[roundId] ?? Array(total).fill(0))]
    while (plays.length < total) plays.push(0)
    plays[chunk] = (plays[chunk] ?? 0) + 1
    return { ...s, chunkPlays: { ...s.chunkPlays, [roundId]: plays } }
  })
  return addCapped(state.passedRounds.includes(roundId) ? Math.ceil(viewed / 2) : viewed)
}

export function setLastChunk(roundId: string, chunk: number) {
  if (state.lastChunk[roundId] === chunk) return
  update((s) => ({ ...s, lastChunk: { ...s.lastChunk, [roundId]: chunk } }))
}

/** 문제 정답 점수. 하루 상한을 넘으면 0점. 이미 통과한 회차는 절반 */
export function awardPractice(roundId: string): number {
  return addCapped(state.passedRounds.includes(roundId) ? 1 : 2)
}

/** 문제 결과 기록. 맞히면 '외운 단어', 틀리면 다시 자동 반복에 들어감 */
export function recordAnswer(wordId: string, ok: boolean) {
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
    if (s.stamps.includes(day)) return { ...s, streak, lastStudyDay: day }
    gotStamp = true
    return { ...s, stamps: [...s.stamps, day], streak, lastStudyDay: day }
  })
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
const DEMO_NAMES = ['Noy', 'Keo', 'Bounmy', 'Vanh', 'Souk', 'Phet', 'Dao', 'Mone', 'Kham', 'Nalee', 'Toy', 'Lae', 'Ping', 'Nok']
export interface RankRow {
  name: string
  points: number
  me?: boolean
  tier: number
}
export function demoRanking(s: State): RankRow[] {
  const day = new Date().getDate()
  const rows: RankRow[] = DEMO_NAMES.map((name, i) => ({
    name,
    points: Math.round((3400 - i * 230 + ((i * 37) % 90)) * Math.min(1, 0.25 + day / 30)),
    tier: i < 3 ? 2 : 1,
  }))
  rows.push({ name: s.nickname || 'ຂ້ອຍ', points: s.monthPoints, me: true, tier: currentTierNo(s) })
  return rows.sort((a, b) => b.points - a.points)
}

export function daysLeftInMonth(d = new Date()): number {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return last - d.getDate()
}
