// 학습 기록·점수·도장 저장 (기기 안 localStorage)
// 서버를 붙이면 이 파일의 저장/불러오기 부분만 API 호출로 바꾸면 됩니다.
import { useSyncExternalStore } from 'react'
import { TIERS, ROUNDS, type Lang, type Native, type Round, type Word } from './data/words'

export type Direction = 'ko2n' | 'n2ko' | 'mix'
export type Order = 'seq' | 'random' | 'wrong'

export interface Settings {
  direction: Direction
  cardSec: number // 카드 앞면 보여주는 시간 (초)
  autoFaster: boolean // 한 바퀴 돌 때마다 1초씩 빨라짐 (최소 1초)
  quizSec: number // 문제당 제한시간, 0 = 없음
  order: Order
  autoSpeak: boolean
}

export interface WordStat {
  c: number // 맞힌 횟수
  w: number // 틀린 횟수
  lastWrong: number // 마지막으로 틀린 시각
}

export interface State {
  v: 1
  native: Native | null
  ui: Lang | null
  nickname: string
  settings: Settings
  passedRounds: string[]
  passedTiers: number[]
  bestExam: Record<string, number>
  wordStats: Record<string, WordStat>
  monthKey: string
  monthPoints: number
  dayKey: string
  dayPoints: number
  stamps: string[] // 이번 달 도장 받은 날짜들 (YYYY-MM-DD)
  streak: number
  lastStudyDay: string
  totalPoints: number
}

export const DAILY_CAP = 400 // 연습으로 하루에 받을 수 있는 최대 점수
export const EXAM_BONUS = 100
export const PROMO_BONUS = 300
export const STAMPS_PER_TICKET = 10

const KEY = 'chang-korean:v1'

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
    v: 1,
    native: null,
    ui: null,
    nickname: '',
    settings: { direction: 'ko2n', cardSec: 4, autoFaster: true, quizSec: 10, order: 'seq', autoSpeak: true },
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
  const keep = { native: state.native, ui: state.ui, nickname: state.nickname }
  state = { ...initial(), ...keep }
  persist()
  listeners.forEach((l) => l())
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

/** 지금 공부해야 할 회차 (열려 있고 아직 통과 못 한 첫 회차) */
export function currentRound(s: State): Round | null {
  return ROUNDS.find((r) => isRoundOpen(s, r) && !s.passedRounds.includes(r.id)) ?? null
}

export function currentTierNo(s: State): number {
  let t = 1
  for (const tier of TIERS) if (s.passedTiers.includes(tier.no)) t = tier.no + 1
  return Math.min(t, TIERS.length)
}

export function isMastered(s: State, w: Word): boolean {
  return s.passedRounds.includes(w.roundId) || (s.wordStats[w.id]?.c ?? 0) >= 3
}

// ───────── 점수·도장 ─────────

/** 연습 문제 정답 점수. 하루 상한(DAILY_CAP)을 넘으면 0점. 이미 통과한 회차는 절반. */
export function awardPractice(roundId: string): number {
  const s = rollover(state)
  const base = s.passedRounds.includes(roundId) ? 1 : 2
  const room = Math.max(0, DAILY_CAP - s.dayPoints)
  const pts = Math.min(base, room)
  if (pts > 0) {
    update((st) => ({ ...st, dayPoints: st.dayPoints + pts, monthPoints: st.monthPoints + pts, totalPoints: st.totalPoints + pts }))
  }
  return pts
}

export function recordAnswer(wordId: string, ok: boolean) {
  update((s) => {
    const prev = s.wordStats[wordId] ?? { c: 0, w: 0, lastWrong: 0 }
    const next: WordStat = ok ? { ...prev, c: prev.c + 1 } : { ...prev, w: prev.w + 1, lastWrong: Date.now() }
    return { ...s, wordStats: { ...s.wordStats, [wordId]: next } }
  })
}

/** 공부 한 번을 끝냈을 때 호출 → 오늘 도장(하루 1개)과 연속 학습일 갱신. 새 도장이면 true */
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
      next = {
        ...next,
        passedRounds: [...s.passedRounds, roundId],
        monthPoints: s.monthPoints + bonus,
        totalPoints: s.totalPoints + bonus,
      }
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

export function setSettings(patch: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
}

// ───────── 데모 랭킹 ─────────
// 서버 연결 전 화면 확인용 예시 데이터입니다. 실제 서비스에서는 서버 랭킹으로 바꿉니다.
const DEMO_NAMES = ['Noy', 'Somchai', 'Keo', 'Ploy', 'Bounmy', 'Nok', 'Vanh', 'Aom', 'Phet', 'Mint', 'Souk', 'Fon', 'Dao', 'Beam']
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
  rows.push({ name: s.nickname || '나', points: s.monthPoints, me: true, tier: currentTierNo(s) })
  return rows.sort((a, b) => b.points - a.points)
}

export function daysLeftInMonth(d = new Date()): number {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return last - d.getDate()
}
