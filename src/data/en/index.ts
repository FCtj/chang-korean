// 영어판 — TOEIC 450 → 900+ (TSL 1.2 + NGSL 1.2) · 레벨 순서 = topik-1, topik-2 …
import type { EdLevel } from '../edition-data'
import * as T450 from './toeic-450.ts'
import * as T600 from './toeic-600.ts'
import * as T700 from './toeic-700.ts'
import * as T800 from './toeic-800.ts'
import * as T900 from './toeic-900.ts'

// 아직 단어를 다 채우지 않은 레벨은 빈 자리 (화면에서 준비 중)
const EMPTY: EdLevel = { UNITS: [], EX: {} }
export const LEVELS: EdLevel[] = [T450, T600, T700, T800, T900]
