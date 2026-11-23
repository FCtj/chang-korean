// 판(edition) — 같은 앱 코드로 세 가지를 만듦 (빌드할 때 VITE_EDITION 으로 고름)
//   ko : 외국인이 한국어를 배우는 기본 판 (Chang Korean)
//   ja : 한국인이 일본어를 배우는 판 — JLPT N5 → N1
//   en : 한국인이 영어를 배우는 판 — TOEIC 450 → 900+
//   lo : 한국인이 라오스어를 배우는 판 — 입문 → 중급 + 상황별 (여행·식당·일터)
// 일본어·영어판은 TOPIK 자리에 시험 레벨이 들어가고(트랙 id 는 그대로 topik-1…5),
// 한국어판 전용 기능(기초 코스·나라·학습자 언어·서버 로그인)은 끔
export type Edition = 'ko' | 'ja' | 'en' | 'lo'

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
const raw = env?.VITE_EDITION
export const EDITION: Edition = raw === 'ja' || raw === 'en' || raw === 'lo' ? raw : 'ko'
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
  /** 두 번째 코스: 생활·학교 (일본어 생활 회화 · 영어 중·고 수준) */
  daily: { title: string; desc: string; icon: string; levels: { title: string; desc: string; icon: string }[] }
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
    daily: { title: '', desc: '', icon: '', levels: [] },
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
      '교육과정 기본: 2022 개정 제2외국어과 교육과정 고교 「일본어」 [별표 Ⅰ] 기본 어휘표 (국제교류기금 번역판) · 조사·접사 제외 · Jiten 빈도 순',
      '생활 회화: JMdict 상용어 표시(news1·ichi1·spec·gai1, EDRDG, CC BY-SA 4.0) 중 JLPT 목록에 없는 말 · Jiten 빈도 순',
      '뜻·예문: 앱에서 새로 씀 (초안 · 검수 중)',
    ],
    daily: {
      title: '학교·생활 일본어',
      desc: '고등학교 일본어 교육과정 기본 어휘 · JLPT 밖 생활 회화',
      icon: '🏫',
      levels: [
        { title: '교육과정 기본 ①', desc: '고교 「일본어」 기본 어휘표 — 자주 쓰는 순 앞쪽', icon: '🏫' },
        { title: '교육과정 기본 ②', desc: '고교 「일본어」 기본 어휘표 — 자주 쓰는 순 뒤쪽', icon: '📗' },
        { title: '생활 회화 ①', desc: '가장 자주 쓰는 300개', icon: '💬' },
        { title: '생활 회화 ②', desc: '자주 쓰는 301~600위', icon: '🗨️' },
        { title: '생활 회화 ③', desc: '자주 쓰는 601~900위', icon: '💭' },
      ],
    },
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
      '교육부 기본 어휘: 교육부 고시 제2022-33호 [별책 14] 영어과 교육과정 [별표 3] 기본 어휘 3,000 (초등 800 · 중·고 공통 1,200 · 고교 선택 1,000) · NGSL 빈도 순',
      '뜻·예문: 앱에서 새로 씀 (초안 · 검수 중) · 이 단어 데이터는 CC BY-SA 4.0',
    ],
    daily: {
      title: '교육부 기본 어휘',
      desc: '2022 개정 교육과정 영어 기본 어휘 3,000 — 초등 · 중학 · 고등',
      icon: '🏫',
      levels: [
        { title: '초등 (800)', desc: '교육부 기본 어휘 * 표시 — 초등학교 권장 800개', icon: '🌱' },
        { title: '중·고 공통 (1,200)', desc: '** 표시 — 중학교·고등학교 공통과목 1,200개', icon: '📗' },
        { title: '고교 선택 (1,000)', desc: '그 밖의 1,000개 — 고등학교 선택과목', icon: '🎓' },
      ],
    },
  },
  lo: {
    app: 'Chang Lao',
    lang: '라오스어',
    exam: '라오스어',
    bcp47: 'lo-LA',
    icon: '🇱🇦',
    tagline: '그림과 소리로 외우는 라오스어 단어 · 입문~중급 · 여행·식당·일터',
    levels: 5,
    levelLabel: (n) => ['입문', '필수①', '초급', '필수②', '중급'][n - 1] ?? String(n),
    levelDesc: [
      '입문 — 인사·가족·숫자·음식 같은 첫 단어 (주제별)',
      '필수 ① — 라오어 말뭉치에서 가장 자주 나오는 말 (그리고·있다·~이다·안 같은 문법 단어)',
      '초급 — 생활에서 자주 쓰는 단어 (주제별)',
      '필수 ② — 말뭉치에서 자주 나오는 말 (빈도순 다음 묶음)',
      '중급 — 일·사회·감정 표현까지 (주제별)',
    ],
    legend: ['입문·초급·중급: 주제별', '필수: 자주 나오는 말'],
    sources: [
      '단어: 한국어 학습용 기본 어휘(국립국어원 등급 참고)로 만든 이 앱의 단원 → 라오어는 라오스 정부 사전(E-Government Center, 라오스 우정통신부 lao-eng-dictionary, MIT)과 위키낱말사전 라오어 목록에 있는 말만',
      '필수 ①②: HVULao_NLP 라오어 말뭉치(11,000문장, Hung Vuong University) 빈도순 · 라오스 정부 사전에 있는 말만 · 한국어 뜻은 사전 영어 뜻과 말뭉치 문장을 보고 옮김',
      '읽기: 라오 글자 음절 나누기(LaoNLP, Apache-2.0)와 앱의 한글 발음 규칙 — 성조는 표시하지 않음',
      '예문·상황 문장: 앱에서 새로 씀 (초안 · 원어민 검수 중)',
    ],
    daily: {
      title: '상황별 라오스어',
      desc: '여행·식당·쇼핑·일터에서 바로 쓰는 말',
      icon: '🧳',
      levels: [
        { title: '여행·관광', desc: '길 찾기 · 숙소 · 관광지', icon: '🧳' },
        { title: '식당·쇼핑', desc: '주문 · 계산 · 가게', icon: '🍜' },
        { title: '일·생활', desc: '공장·사무실 · 몸·건강 · 아이', icon: '🏭' },
      ],
    },
  },
}

export const ED_INFO = ED[EDITION]
/** 레벨 짧은 이름: 1급 · N5 · 450 */
export const levelLabel = (n: number) => ED_INFO.levelLabel(n)
/** 레벨 전체 이름: TOPIK 1급 · JLPT N5 · TOEIC 450 */
export const levelName = (n: number) => `${ED_INFO.exam} ${ED_INFO.levelLabel(n)}`
/** 레벨 번호 목록 (1부터) */
export const LEVELS = Array.from({ length: ED_INFO.levels }, (_, i) => i + 1)
