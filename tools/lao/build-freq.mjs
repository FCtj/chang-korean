// 자주 쓰는 말 (말뭉치 빈도순) → src/data/lo/freq-1.ts · freq-2.ts (Day 단원 25개씩) + index.ts 순서
// 레벨 순서: 입문 → 필수 ① → 초급 → 필수 ② → 중급  (문법 단어를 일찍 익히게)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { laoNormalize as N, laoRoman, laoHangul } from '../../src/lao.ts'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const W = `${WORK}/lao/freq-work`
const OUT = `${ROOT}/src/data/lo`
// 라오스어 학습에 쓸모가 적은 말 (베트남 화폐 등)
const DROP = new Set(['ດົ່ງ'])
const rows = []
for (let n = 1; n <= 8; n++) {
  if (!existsSync(`${W}/out-${n}.json`)) {
    console.log(`– out-${n}.json 없음`)
    continue
  }
  const input = JSON.parse(readFileSync(`${W}/in-${n}.json`, 'utf8'))
  const out = JSON.parse(readFileSync(`${W}/out-${n}.json`, 'utf8'))
  for (const r of input) {
    const o = out[r.w]
    if (!o || o.skip || DROP.has(r.w)) continue
    rows.push({ term: N(r.w), rank: r.rank, mean: o.mean.trim(), emoji: o.emoji.trim(), ex: N(o.ex.trim()), exKo: o.exKo.trim() })
  }
}
rows.sort((a, b) => a.rank - b.rank)
const half = Math.ceil(rows.length / 2 / 25) * 25
const parts = [rows.slice(0, half), rows.slice(half)]
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
parts.forEach((list, pi) => {
  // 25개씩 · 같은 단원 안에서 그림·뜻이 겹치면 다음 단원으로 미룸
  const units = []
  let pending = [...list]
  while (pending.length) {
    const unit = []
    const em = new Set()
    const mn = new Set()
    const rest = []
    for (const r of pending) {
      if (unit.length < 25 && !em.has(r.emoji) && !mn.has(r.mean)) {
        unit.push(r)
        em.add(r.emoji)
        mn.add(r.mean)
      } else rest.push(r)
    }
    units.push(unit)
    pending = rest
  }
  let src = `// 라오스어판 — 필수 ${'①②'[pi]}: 말뭉치에서 자주 나오는 말 (빈도순, 지금 다른 레벨에 없는 말만)
// 빈도: HVULao_NLP 띄어쓰기 말뭉치 11,000문장 (Hung Vuong University) — 단어마다 나온 횟수로 순위
// 라오어 확인: 라오스 정부 lao-eng-dictionary (MIT) 에 있는 말만 · 한국어 뜻은 사전의 영어 뜻과 말뭉치 문장을 보고 옮김
// 예문·뜻: 앱에서 새로 씀 (초안, 원어민 검수 필요) · 읽기(rom)는 src/lao.ts 한글 규칙 — 자세한 출처: ./SOURCES.md
import type { EdUnit, EdExampleMap } from '../edition-types'

export const UNITS: EdUnit[] = [
`
  const ex = []
  units.forEach((u, ui) => {
    src += `  {\n    key: ${q(`f${pi + 1}-${String(ui + 1).padStart(2, '0')}`)},\n    icon: '📅',\n    title: ${q(`Day ${String(ui + 1).padStart(2, '0')}`)},\n    words: [\n`
    for (const r of u) {
      src += `      [${q(r.term)}, ${q(laoRoman(r.term))}, ${q(r.mean)}, ${q(r.emoji)}],\n`
      ex.push(`  ${q(r.term)}: { ex: ${q(r.ex)}, rom: ${q(laoHangul(r.ex))}, ko: ${q(r.exKo)} },`)
    }
    src += `    ],\n    phrases: [],\n  },\n`
  })
  src += `]\n\nexport const EX: EdExampleMap = {\n${ex.join('\n')}\n}\n`
  writeFileSync(`${OUT}/freq-${pi + 1}.ts`, src)
  console.log(`freq-${pi + 1}: ${units.length} units · ${list.length} words`)
})
writeFileSync(
  `${OUT}/index.ts`,
  `// 라오스어판 레벨: 입문 → 필수 ① → 초급 → 필수 ② → 중급 (필수 = 말뭉치에서 자주 나오는 말)
import type { EdLevel } from '../edition-data'
import * as L1 from './level-1.ts'
import * as L2 from './level-2.ts'
import * as L3 from './level-3.ts'
import * as F1 from './freq-1.ts'
import * as F2 from './freq-2.ts'

export const LEVELS: EdLevel[] = [L1, F1, L2, F2, L3]
`,
)
console.log('total', rows.length)
