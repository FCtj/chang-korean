// 판(edition) — 같은 앱 코드로 세 가지를 만듦 (빌드할 때 VITE_EDITION 으로 고름)
//   ko : 외국인이 한국어를 배우는 기본 판 (Chang Korean)
//   ja : 한국인이 일본어를 배우는 판 — JLPT N5 → N1
//   en : 한국인이 영어를 배우는 판 — TOEIC 450 → 900+
// 일본어·영어판은 TOPIK 자리에 시험 레벨이 들어가고(트랙 id 는 그대로 topik-1…5),
// 한국어판 전용 기능(기초 코스·나라·학습자 언어·서버 로그인)은 끔
export type Edition = 'ko' | 'ja' | 'en'

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
const raw = env?.VITE_EDITION
export const EDITION: Edition = raw === 'ja' || raw === 'en' ? raw : 'ko'
export const IS_KO = EDITION === 'ko'

interface EdInfo {
  app: string
  /** 배울 말 이름 (한국어) */
  lang: string
  exam: string
  /** 음성·발음 (BCP 47) */
  bcp47: string
  icon: string
  tagline: string
  levels: number
  levelLabel: (n: number) => string
  levelDesc: string[]
  /** 홈 레벨 버튼 아래 두 묶음 설명 */
  legend: [string, string]
  /** 단어 출처 (설정 화면에 표시) */
  sources: string[]
}

const TOEIC_SCORE = ['450', '600', '700', '800', '900+']

export const ED: Record<Edition, EdInfo> = {
  ko: {
    app: 'Chang Korean',
    lang: '한국어',
    exam: 'TOPIK',
    bcp47: 'ko-KR',
    icon: '📝',
    tagline: '그림과 소리로 외우는 한국어 단어',
    levels: 6,
    levelLabel: (n) => `${n}급`,
    levelDesc: [],
    legend: ['TOPIK I · 1–2', 'TOPIK II · 3–6'],
    sources: [],
  },
  ja: {
    app: 'Chang Japanese',
    lang: '일본어',
    exam: 'JLPT',
    bcp47: 'ja-JP',
    icon: '🇯🇵',
    tagline: '그림과 소리로 외우는 일본어 단어 · JLPT N5~N1',
    levels: 5,
    levelLabel: (n) => `N${6 - n}`,
    levelDesc: ['N5 입문 — JLPT N5 단어 전체 · 자주 쓰는 순', 'N4 초급 — JLPT N4 단어 전체 · 자주 쓰는 순', 'N3 중급 — JLPT N3 단어 전체 · 자주 쓰는 순', 'N2 — 준비 중', 'N1 — 준비 중'],
    legend: ['N5·N4 기초', 'N3~N1 중·상급'],
    sources: [
      '단어 목록: Jonathan Waller의 JLPT N5~N3 목록 (tanos.co.uk, CC BY) — open-anki-jlpt-decks 판 (MIT)',
      '단원 순서: Jiten 빈도 목록 (jiten.moe, CC BY-SA 4.0) — 자주 쓰는 단어부터',
      '뜻·예문: 앱에서 새로 씀 (초안 · 검수 중)',
    ],
  },
  en: {
    app: 'Chang English',
    lang: '영어',
    exam: 'TOEIC',
    bcp47: 'en-US',
    icon: '💼',
    tagline: '그림과 소리로 외우는 영어 단어 · TOEIC 450~900+',
    levels: 5,
    levelLabel: (n) => TOEIC_SCORE[n - 1] ?? String(n),
    levelDesc: [
      '450 — 토익 빈출 TSL 1~250위 + 기본 NGSL 701~1,122위',
      '600 — 토익 빈출 TSL 251~500위 + NGSL 1,123~1,544위',
      '700 — 토익 빈출 TSL 501~750위 + NGSL 1,545~1,965위',
      '800 — 토익 빈출 TSL 751~1,000위 + NGSL 1,966~2,387위',
      '900+ — 토익 빈출 TSL 1,001~1,250위 + NGSL 2,388~2,809위',
    ],
    legend: ['450·600 기본', '700~900+ 고득점'],
    sources: [
      '단어 목록: TOEIC Service List 1.2 (토익 전용 1,250개) + New General Service List 1.2 701~2,809위 — Browne, Culligan & Phillips (CC BY-SA 4.0)',
      '발음: CMU Pronouncing Dictionary (Carnegie Mellon University)',
      '뜻·예문: 앱에서 새로 씀 (초안 · 검수 중) · 이 단어 데이터는 CC BY-SA 4.0',
    ],
  },
}

export const ED_INFO = ED[EDITION]
/** 레벨 짧은 이름: 1급 · N5 · 450 */
export const levelLabel = (n: number) => ED_INFO.levelLabel(n)
/** 레벨 전체 이름: TOPIK 1급 · JLPT N5 · TOEIC 450 */
export const levelName = (n: number) => `${ED_INFO.exam} ${ED_INFO.levelLabel(n)}`
/** 레벨 번호 목록 (1부터) */
export const LEVELS = Array.from({ length: ED_INFO.levels }, (_, i) => i + 1)
