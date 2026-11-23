// 일본어판 예문 ②③ — tools/exmore/build-ja.py 가 만듦 (예문 ① 은 각 레벨 파일의 EX)
import type { EdExampleMoreMap } from '../edition-types'
import { MORE as M1 } from './ex-more-1.ts'
import { MORE as M2 } from './ex-more-2.ts'
import { MORE as M3 } from './ex-more-3.ts'
import { MORE as M4 } from './ex-more-4.ts'

export const EX_MORE: EdExampleMoreMap = { ...M1, ...M2, ...M3, ...M4 }
