// 단어 데이터 검사 (npm test)
// - 회차마다 50개 이상 (원래 50개 + 검수로 맨 뒤에 더한 단어)
// - 회차 안에서 이모지·라오어 뜻 중복 없음 (문제 보기가 헷갈리지 않게)
// - 한국어 단어는 전체에서 중복 없음 (HOMONYMS 는 예외)
// - 한국어·로마자·라오어·태국어·베트남어·이모지 비어 있으면 안 됨
// (태국어·베트남어 번역 중복 검사는 check-translations.mjs)
import { TIERS, PACKS } from '../src/data/words.ts'

let errors = 0
const fail = (msg) => {
  errors++
  console.error('✗ ' + msg)
}

// 같은 글자 다른 뜻으로 일부러 둘 다 가르치는 단어 (뜻·예문은 단어 id 로 따로: tr-fix.ts · ex-curation.ts)
const HOMONYMS = new Set(['팔', '개', '시'])
const koAll = new Map()
for (const tier of TIERS) {
  for (const round of tier.rounds) {
    // 원래 50개 + 검수로 맨 뒤에 더한 단어 (기존 단어 번호가 밀리지 않게)
    if (round.words.length < 50) fail(`${round.id}: 단어 ${round.words.length}개 (50개 이상)`)
    for (const key of ['emoji', 'lo']) {
      const seen = new Map()
      for (const w of round.words) {
        if (seen.has(w[key])) fail(`${round.id}: ${key} 중복 "${w[key]}" (${seen.get(w[key])}, ${w.ko})`)
        seen.set(w[key], w.ko)
      }
    }
    for (const w of round.words) {
      for (const key of ['ko', 'rom', 'lo', 'th', 'vi', 'emoji']) if (!w[key]?.trim()) fail(`${w.id}: ${key} 비어 있음`)
      if (koAll.has(w.ko) && !HOMONYMS.has(w.ko)) fail(`한국어 중복 "${w.ko}" (${koAll.get(w.ko)}, ${w.id})`)
      koAll.set(w.ko, w.id)
    }
  }
}

// 바로 쓰는 단어팩: 팩마다 25개, 팩 안에서 한국어·이모지·라오어 중복 없음
for (const pack of PACKS) {
  if (pack.words.length < 25) fail(`${pack.id}: 단어 ${pack.words.length}개 (25개 이상)`)
  for (const key of ['ko', 'emoji', 'lo']) {
    const seen = new Set()
    for (const w of pack.words) {
      if (seen.has(w[key])) fail(`${pack.id}: ${key} 중복 "${w[key]}"`)
      seen.add(w[key])
    }
  }
  for (const w of pack.words) for (const key of ['ko', 'rom', 'lo', 'th', 'vi', 'emoji']) if (!w[key]?.trim()) fail(`${w.id}: ${key} 비어 있음`)
}

const rounds = TIERS.flatMap((t) => t.rounds)
if (errors) {
  console.error(`\n${errors}개 문제 발견`)
  process.exit(1)
}
const perTier = TIERS.map((t) => `${t.no}계급 ${t.rounds.reduce((n, r) => n + r.words.length, 0)}`).join(', ')
console.log(`✓ 단어 데이터 정상: 회차 ${rounds.length}개, 단어 ${koAll.size}개 (${perTier}) + 단어팩 ${PACKS.length}개 ${PACKS.reduce((n, p) => n + p.words.length, 0)}단어`)
