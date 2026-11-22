// 몽골어 (키릴 문자): 단어·문장 뜻(MN)과 제목·설명(TITLE_MN) 모음 — ⚠️ 초안: 몽골어 원어민 검수 필요
// 나눠 번역한 파일(tr-mn-1..6.ts, tr-mn-titles.ts)을 아래 PARTS 에 넣어 합침
// (scripts 도 이 파일을 불러오므로 import.meta.glob 대신 고정 import)
// @mn-imports
import { MN_4 } from './tr-mn-4.ts'
import { MN_2 } from './tr-mn-2.ts'
import { MN_1 } from './tr-mn-1.ts'

const PARTS: Record<string, string>[] = [
  MN_1,
  MN_2,
  MN_4,
  // @mn-parts
]
const TITLE_PARTS: Record<string, string>[] = [
  // @mn-title-parts
]

export const MN: Record<string, string> = Object.assign({}, ...PARTS)
export const TITLE_MN: Record<string, string> = Object.assign({}, ...TITLE_PARTS)

/** 제목·설명(L10n)에 몽골어 채우기: 이미 있으면 그대로, 없으면 TITLE_MN → 없으면 한국어 */
export function withMn<T extends { ko: string; mn?: string }>(x: T): T & { mn: string } {
  return { ...x, mn: x.mn || TITLE_MN[x.ko] || x.ko }
}
