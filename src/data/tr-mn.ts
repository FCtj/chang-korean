// 몽골어 (키릴 문자): 단어·문장 뜻(MN)과 제목·설명(TITLE_MN) 모음 — ⚠️ 초안: 몽골어 원어민 검수 필요
// 나눠 번역한 파일(tr-mn-1..6.ts, tr-mn-titles.ts)을 아래 PARTS 에 넣어 합침
// (scripts 도 이 파일을 불러오므로 import.meta.glob 대신 고정 import)
// @mn-imports
import { MN_CURATION } from './tr-mn-curation.ts'
// 일·알바 트랙: 한 파일에 단어·문장·제목이 같이 있어 PARTS·TITLE_PARTS 둘 다에 넣음
import { MN_JOB_EPS_A } from './tr-mn-job-eps-a.ts'
import { MN_JOB_EPS_B } from './tr-mn-job-eps-b.ts'
import { MN_JOB_STORE } from './tr-mn-job-store.ts'
import { MN_JOB_HOTEL } from './tr-mn-job-hotel.ts'
import { MN_JOB_MASSAGE } from './tr-mn-job-massage.ts'
import { MN_JOB_GUIDE } from './tr-mn-job-guide.ts'
import { MN_JOB_PARENTING_A } from './tr-mn-job-parenting-a.ts'
import { MN_JOB_PARENTING_B } from './tr-mn-job-parenting-b.ts'
import { TITLE_AR } from './tr-ar.ts'
import { TITLE_MN as TITLE_PART } from './tr-mn-titles.ts'
import { MN_6 } from './tr-mn-6.ts'
import { MN_5 } from './tr-mn-5.ts'
import { MN_3 } from './tr-mn-3.ts'
import { MN_4 } from './tr-mn-4.ts'
import { MN_2 } from './tr-mn-2.ts'
import { MN_1 } from './tr-mn-1.ts'
// TOPIK 필수 단어 단원: 단어 · 문장 · 제목이 한 파일 (PARTS · TITLE_PARTS 둘 다)
import { MN_CORE } from './tr-mn-core.ts'

const PARTS: Record<string, string>[] = [
  MN_1,
  MN_2,
  MN_4,
  MN_3,
  MN_5,
  MN_6,
  MN_JOB_EPS_A,
  MN_JOB_EPS_B,
  MN_JOB_STORE,
  MN_JOB_HOTEL,
  MN_JOB_MASSAGE,
  MN_JOB_GUIDE,
  MN_JOB_PARENTING_A,
  MN_JOB_PARENTING_B,
  MN_CURATION,
  MN_CORE,
  // @mn-parts
]
const TITLE_PARTS: Record<string, string>[] = [
  TITLE_PART,
  MN_JOB_EPS_A,
  MN_JOB_EPS_B,
  MN_JOB_STORE,
  MN_JOB_HOTEL,
  MN_JOB_MASSAGE,
  MN_JOB_GUIDE,
  MN_JOB_PARENTING_A,
  MN_JOB_PARENTING_B,
  MN_CORE,
  // @mn-title-parts
]

export const MN: Record<string, string> = Object.assign({}, ...PARTS)
export const TITLE_MN: Record<string, string> = Object.assign({}, ...TITLE_PARTS)

/** 제목·설명(L10n)에 몽골어·아랍어 채우기: 이미 있으면 그대로, 없으면 TITLE_MN/TITLE_AR → 없으면 한국어 */
export function withMn<T extends { ko: string; mn?: string; ar?: string }>(x: T): T & { mn: string; ar: string } {
  return { ...x, mn: x.mn || TITLE_MN[x.ko] || x.ko, ar: x.ar || TITLE_AR[x.ko] || x.ko }
}
