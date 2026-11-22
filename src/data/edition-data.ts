// 일본어·영어판 단어 모음 — 기본(한국어판)은 비어 있음
// VITE_EDITION=ja|en 으로 빌드하면 vite.config.ts 가 이 파일 대신 edition-data-ja.ts / edition-data-en.ts 를 씀
import type { EdUnit, EdExampleMap } from './edition-types'

export interface EdLevel {
  UNITS: EdUnit[]
  EX: EdExampleMap
}
export const ED_LEVELS: EdLevel[] = []
/** 두 번째 코스(생활·학교) 레벨 */
export const ED_DAILY: EdLevel[] = []
