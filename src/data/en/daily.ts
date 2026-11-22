// 생활·학교 코스 레벨 (순서 = daily-1, daily-2 …) · 아직 채우지 않은 레벨은 빈 자리(화면에 안 보임)
import type { EdLevel } from '../edition-data'
import * as D_A1 from './daily-a1.ts'
import * as D_A2 from './daily-a2.ts'
import * as D_B1 from './daily-b1.ts'

const EMPTY: EdLevel = { UNITS: [], EX: {} }
export const DAILY: EdLevel[] = [D_A1, D_A2, D_B1]
