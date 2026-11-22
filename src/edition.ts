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
    levelDesc: [
      'N5 입문 — 인사·숫자·음식·교통·기본 동사·형용사',
      'N4 초급 — 생활·여행·병원·이사·감정·자주 쓰는 동사',
      'N3 중급 — 일·돈·건강·관계·환경·매체 · 부사·가타카나어',
      'N2 중상급 — 비즈니스·경제·정치·과학·의성어·의태어',
      'N1 상급 — 정치·법·경영·추상어·논설 표현·관용구·사자성어',
    ],
    legend: ['N5·N4 기초', 'N3~N1 중·상급'],
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
      '450 입문 — 토익 기본 비즈니스·생활 단어',
      '600 — 토익 핵심 단어 (Part 1~7 자주 나오는 말)',
      '700 — 환급·일정·보증·규정 등 실무 단어',
      '800 — 고득점 필수 (Part 5·7 어휘 문제)',
      '900+ — 최상위 (격식 문서·동의어 바꿔 쓰기)',
    ],
    legend: ['450·600 기본', '700~900+ 고득점'],
  },
}

export const ED_INFO = ED[EDITION]
/** 레벨 짧은 이름: 1급 · N5 · 450 */
export const levelLabel = (n: number) => ED_INFO.levelLabel(n)
/** 레벨 전체 이름: TOPIK 1급 · JLPT N5 · TOEIC 450 */
export const levelName = (n: number) => `${ED_INFO.exam} ${ED_INFO.levelLabel(n)}`
/** 레벨 번호 목록 (1부터) */
export const LEVELS = Array.from({ length: ED_INFO.levels }, (_, i) => i + 1)
