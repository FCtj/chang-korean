// 생활·학교 코스 레벨 (순서 = daily-1, daily-2 …) · 아직 채우지 않은 레벨은 빈 자리(화면에 안 보임)
import type { EdLevel } from '../edition-data'
import * as D_1 from './daily-1.ts'
import * as D_2 from './daily-2.ts'
import * as D_3 from './daily-3.ts'

const EMPTY: EdLevel = { UNITS: [], EX: {} }
export const DAILY: EdLevel[] = [D_1, D_2, D_3]
