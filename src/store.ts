// 학습 기록·점수·도장 저장 (기기 안 localStorage)
// 서버를 붙이면 이 파일의 저장/불러오기 부분만 API 호출로 바꾸면 됩니다.
import { useSyncExternalStore } from 'react'
import { TIERS, ROUNDS, SET_SIZE, type Round, type Word } from './data/words'
import type { UiLang } from './i18n'

export type Direction = 'ko2n' | 'n2ko' | 'mix'
export type Order = 'seq' | 'random'

export interface Settings {
  direction: Direction
  cardSec: number // 카드 앞면 보여주는 시간 (초)
  reps: number // 5개 묶음을 몇 번 반복하고 다음 5개로 넘어갈지
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
  v: 2
  started: boolean
  ui: UiLang
  nickname: string
  settings: Settings
  /** 회차별 묶음(5개)마다 반복해서 본 횟수 */
  chunkPlays: Record<string, number[]>
  /** 회차별 마지막으로 보던 묶음 (이어보기) */
  lastChunk: Record<string, number>
  /** 반복 학습을 다 해서 문제·시험이 열린 회차 */
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

/** 모든 묶음을 이만큼 반복해서 봐야 4지선다 문제·졸업시험이 나타남 */
export const UNLOCK_PLAYS = 3
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
    v: 2,
    started: false,
    ui: 'lo',
    nickname: '',
    settings: { direction: 'ko2n', cardSec: 3, reps: 3, autoFaster: false, quizSec: 10, order: 'seq', autoSpeak: true },
    chunkPlays: {},
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
      const parsed = JSON.parse(raw) as Partial<State>
      const base = initial()
      return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } }
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
  const keep = { started: state.started, ui: state.ui, nickname: state.nickname }
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

/** 4지선다 문제·졸업시험이 보이는지 (처음엔 숨김, 반복 학습을 다 하면 열림) */
export function isQuizOpen(s: State, roundId: string): boolean {
  return s.quizOpen.includes(roundId) || s.passedRounds.includes(roundId)
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

export function playsOf(s: State, roundId: string, chunk: number): number {
  return s.chunkPlays[roundId]?.[chunk] ?? 0
}

/** 반복 학습 진행도: (지금까지 채운 반복 수, 열리는 데 필요한 반복 수) */
export function viewProgress(s: State, round: Round): [number, number] {
  const n = chunkCount(round)
  let done = 0
  for (let i = 0; i < n; i++) done += Math.min(UNLOCK_PLAYS, playsOf(s, round.id, i))
  return [done, n * UNLOCK_PLAYS]
}

/** 스티커가 색칠되는 조건: 그 단어의 묶음을 3번 반복했거나, 회차 통과, 또는 문제에서 3번 맞힘 */
export function isCollected(s: State, w: Word): boolean {
  if (s.passedRounds.includes(w.roundId)) return true
  const round = ROUNDS.find((r) => r.id === w.roundId)!
  const chunk = Math.floor(round.words.findIndex((x) => x.id === w.id) / SET_SIZE)
  return playsOf(s, w.roundId, chunk) >= UNLOCK_PLAYS || (s.wordStats[w.id]?.c ?? 0) >= 3
}

// ───────── 점수·도장 ─────────

function addCapped(base: number): number {
  const s = rollover(state)
  const pts = Math.min(base, Math.max(0, DAILY_CAP - s.dayPoints))
  if (pts > 0) {
    update((st) => ({ ...st, dayPoints: st.dayPoints + pts, monthPoints: st.monthPoints + pts, totalPoints: st.totalPoints + pts }))
  }
  return pts
}

/** 5개 묶음을 한 번 다 본 것을 기록. 이번에 문제·시험이 처음 열렸으면 unlocked=true */
export function recordChunkPlay(roundId: string, chunk: number, total: number): { points: number; unlocked: boolean } {
  let unlocked = false
  update((s) => {
    const plays = [...(s.chunkPlays[roundId] ?? Array(total).fill(0))]
    while (plays.length < total) plays.push(0)
    plays[chunk] = (plays[chunk] ?? 0) + 1
    let quizOpen = s.quizOpen
    if (!quizOpen.includes(roundId) && plays.every((p) => p >= UNLOCK_PLAYS)) {
      quizOpen = [...quizOpen, roundId]
      unlocked = true
    }
    return { ...s, chunkPlays: { ...s.chunkPlays, [roundId]: plays }, quizOpen }
  })
  const points = addCapped(state.passedRounds.includes(roundId) ? 2 : 5)
  return { points, unlocked }
}

export function setLastChunk(roundId: string, chunk: number) {
  if (state.lastChunk[roundId] === chunk) return
  update((s) => ({ ...s, lastChunk: { ...s.lastChunk, [roundId]: chunk } }))
}

/** 문제 정답 점수. 하루 상한을 넘으면 0점. 이미 통과한 회차는 절반 */
export function awardPractice(roundId: string): number {
  return addCapped(state.passedRounds.includes(roundId) ? 1 : 2)
}

export function recordAnswer(wordId: string, ok: boolean) {
  update((s) => {
    const prev = s.wordStats[wordId] ?? { c: 0, w: 0, lastWrong: 0 }
    const next: WordStat = ok ? { ...prev, c: prev.c + 1 } : { ...prev, w: prev.w + 1, lastWrong: Date.now() }
    return { ...s, wordStats: { ...s.wordStats, [wordId]: next } }
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
