// 교육부 기본 어휘 코스 (순서 = daily-1, daily-2 …): 초등 · 중·고 공통 · 고교 선택
import type { EdLevel } from '../edition-data'
import * as M1 from './moe-1.ts'
import * as M2 from './moe-2.ts'
import * as M3 from './moe-3.ts'

export const DAILY: EdLevel[] = [M1, M2, M3]
