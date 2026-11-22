// 아랍어 (표준 아랍어): 단어·문장 뜻(AR)과 제목·설명(TITLE_AR) 모음 — ⚠️ 초안: 아랍어 원어민 검수 필요
// 나눠 번역한 파일(tr-ar-1..6.ts, tr-ar-titles.ts)을 아래 PARTS 에 넣어 합침
// (scripts 도 이 파일을 불러오므로 import.meta.glob 대신 고정 import)
// @ar-imports
import { TITLE_AR as TITLE_PART } from './tr-ar-titles.ts'
import { AR_6 } from './tr-ar-6.ts'
import { AR_5 } from './tr-ar-5.ts'
import { AR_4 } from './tr-ar-4.ts'
import { AR_1 } from './tr-ar-1.ts'
import { AR_3 } from './tr-ar-3.ts'
import { AR_2 } from './tr-ar-2.ts'

const PARTS: Record<string, string>[] = [
  AR_2,
  AR_3,
  AR_1,
  AR_4,
  AR_5,
  AR_6,
  // @ar-parts
]
const TITLE_PARTS: Record<string, string>[] = [
  TITLE_PART,
  // @ar-title-parts
]

export const AR: Record<string, string> = Object.assign({}, ...PARTS)
export const TITLE_AR: Record<string, string> = Object.assign({}, ...TITLE_PARTS)
