// 단어 데이터 검사: 회차당 50개, 회차 안에서 이모지·번역 중복 없음, 계급 안에서 한국어 중복 없음
// 실행: npm test
import { TIERS } from '../src/data/words.ts'

let errors = 0
const fail = (msg) => {
  errors++
  console.error('✗ ' + msg)
}

for (const tier of TIERS) {
  const koInTier = new Map()
  for (const round of tier.rounds) {
    if (round.words.length !== 50) fail(`${round.id}: 단어 ${round.words.length}개 (50개여야 함)`)
    for (const key of ['emoji', 'lo', 'th']) {
      const seen = new Map()
      for (const w of round.words) {
        if (seen.has(w[key])) fail(`${round.id}: ${key} 중복 "${w[key]}" (${seen.get(w[key])}, ${w.ko})`)
        seen.set(w[key], w.ko)
      }
    }
    for (const w of round.words) {
      for (const key of ['ko', 'rom', 'lo', 'th', 'emoji']) if (!w[key]?.trim()) fail(`${w.id}: ${key} 비어 있음`)
      if (koInTier.has(w.ko)) fail(`계급 ${tier.no}: 한국어 중복 "${w.ko}" (${koInTier.get(w.ko)}, ${w.id})`)
      koInTier.set(w.ko, w.id)
    }
  }
}

const total = TIERS.reduce((n, t) => n + t.rounds.reduce((m, r) => m + r.words.length, 0), 0)
if (errors) {
  console.error(`\n${errors}개 문제 발견`)
  process.exit(1)
}
console.log(`✓ 단어 데이터 정상: 계급 ${TIERS.length}개, 회차 ${TIERS.flatMap((t) => t.rounds).length}개, 단어 ${total}개`)
