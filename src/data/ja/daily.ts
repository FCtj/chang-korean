// 학교·생활 코스 (순서 = daily-1, daily-2 …): 교육과정 기본 어휘 ①② → 생활 회화 ①②③
import type { EdLevel } from '../edition-data'
import * as M1 from './moe-1.ts'
import * as M2 from './moe-2.ts'
import * as D_1 from './daily-1.ts'
import * as D_2 from './daily-2.ts'
import * as D_3 from './daily-3.ts'

export const DAILY: EdLevel[] = [M1, M2, D_1, D_2, D_3]
