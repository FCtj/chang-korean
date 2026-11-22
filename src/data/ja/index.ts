// 일본어판 — JLPT N5 → N3 (출처 기반, N2·N1 준비 중) · 레벨 순서 = topik-1, topik-2 …
import type { EdLevel } from '../edition-data'
import * as N5 from './n5.ts'
import * as N4 from './n4.ts'
import * as N3 from './n3.ts'

// 아직 단어를 다 채우지 않은 레벨은 빈 자리 (화면에서 준비 중)
const EMPTY: EdLevel = { UNITS: [], EX: {} }
export const LEVELS: EdLevel[] = [N5, N4, N3]
