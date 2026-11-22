// 아랍어 (표준 아랍어): 단어·문장 뜻(AR)과 제목·설명(TITLE_AR) 모음 — ⚠️ 초안: 아랍어 원어민 검수 필요
// 나눠 번역한 파일(tr-ar-1..6.ts, tr-ar-titles.ts)을 아래 PARTS 에 넣어 합침
// (scripts 도 이 파일을 불러오므로 import.meta.glob 대신 고정 import)
// @ar-imports
// 일·알바 트랙: 한 파일에 단어·문장·제목이 같이 있어 PARTS·TITLE_PARTS 둘 다에 넣음
import { AR_JOB_EPS_A } from './tr-ar-job-eps-a.ts'
import { AR_JOB_EPS_B } from './tr-ar-job-eps-b.ts'
import { AR_JOB_STORE } from './tr-ar-job-store.ts'
import { AR_JOB_HOTEL } from './tr-ar-job-hotel.ts'
import { AR_JOB_MASSAGE } from './tr-ar-job-massage.ts'
import { AR_JOB_GUIDE } from './tr-ar-job-guide.ts'
import { AR_JOB_PARENTING_A } from './tr-ar-job-parenting-a.ts'
import { AR_JOB_PARENTING_B } from './tr-ar-job-parenting-b.ts'
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
  AR_JOB_EPS_A,
  AR_JOB_EPS_B,
  AR_JOB_STORE,
  AR_JOB_HOTEL,
  AR_JOB_MASSAGE,
  AR_JOB_GUIDE,
  AR_JOB_PARENTING_A,
  AR_JOB_PARENTING_B,
  // @ar-parts
]
const TITLE_PARTS: Record<string, string>[] = [
  TITLE_PART,
  AR_JOB_EPS_A,
  AR_JOB_EPS_B,
  AR_JOB_STORE,
  AR_JOB_HOTEL,
  AR_JOB_MASSAGE,
  AR_JOB_GUIDE,
  AR_JOB_PARENTING_A,
  AR_JOB_PARENTING_B,
  // @ar-title-parts
]

export const AR: Record<string, string> = Object.assign({}, ...PARTS)
export const TITLE_AR: Record<string, string> = Object.assign({}, ...TITLE_PARTS)
