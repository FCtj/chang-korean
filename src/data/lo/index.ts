// 라오스어판 레벨 (입문 · 초급 · 중급)
import type { EdLevel } from '../edition-data'
import * as L1 from './level-1.ts'
import * as L2 from './level-2.ts'
import * as L3 from './level-3.ts'

export const LEVELS: EdLevel[] = [L1, L2, L3]
