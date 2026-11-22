// 목적별 트랙(단원 묶음) 원본 데이터 형식
// 한 줄: [한국어, 로마자 발음, 라오어, 태국어, 베트남어, 이모지]
// 단원 = 단어(words) + 상황 문장(phrases). 문장도 같은 형식이고, 앱에서는 '문장 카드'로 보여요.
// ⚠️ 라오어·태국어·베트남어는 초안 — 원어민 검수 필요
export type TRow = [ko: string, rom: string, lo: string, th: string, vi: string, emoji: string]

export interface TitleL10n {
  ko: string
  lo: string
  th: string
  vi: string
}

export interface TrackUnitSrc {
  /** 단원 키 (영문 소문자·숫자·하이픈, 트랙 안에서 고유) */
  key: string
  icon: string
  title: TitleL10n
  words: TRow[]
  phrases: TRow[]
}
