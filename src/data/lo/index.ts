// 라오스어판 레벨: 입문 → 필수 ① → 초급 → 필수 ② → 중급 (필수 = 말뭉치에서 자주 나오는 말)
import type { EdLevel } from '../edition-data'
import * as L1 from './level-1.ts'
import * as L2 from './level-2.ts'
import * as L3 from './level-3.ts'
import * as F1 from './freq-1.ts'
import * as F2 from './freq-2.ts'

export const LEVELS: EdLevel[] = [L1, F1, L2, F2, L3]
