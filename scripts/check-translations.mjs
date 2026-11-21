// 태국어·베트남어 단어 번역 검사
// 실행: node scripts/check-translations.mjs th   또는   node scripts/check-translations.mjs vi
// - 모든 한국어 단어(회차 18개 + 단어팩 6개)에 번역이 있는지
// - 한 회차/단어팩 안에서 서로 다른 한국어 단어의 번역이 겹치지 않는지 (4지선다 보기가 헷갈리지 않게)
// - 번역 파일에 쓰이지 않는 한국어 키가 없는지
import { TIERS, PACKS } from '../src/data/words.ts'

const lang = process.argv[2]
if (lang !== 'th' && lang !== 'vi') {
  console.error('사용법: node scripts/check-translations.mjs th|vi')
  process.exit(2)
}
const mod = lang === 'th' ? await import('../src/data/tr-th.ts') : await import('../src/data/tr-vi.ts')
const map = lang === 'th' ? mod.TH : mod.VI

let errors = 0
const fail = (m) => {
  errors++
  console.error('✗ ' + m)
}
const units = [...TIERS.flatMap((t) => t.rounds), ...PACKS]
const used = new Set()
for (const u of units) {
  const seen = new Map()
  for (const w of u.words) {
    used.add(w.ko)
    const tr = map[w.ko]
    if (!tr || !tr.trim()) {
      fail(`${u.id}: "${w.ko}" 번역 없음`)
      continue
    }
    if (seen.has(tr) && seen.get(tr) !== w.ko) fail(`${u.id}: 번역 중복 "${tr}" (${seen.get(tr)}, ${w.ko})`)
    seen.set(tr, w.ko)
  }
}
for (const k of Object.keys(map)) if (!used.has(k)) fail(`쓰이지 않는 키 "${k}"`)
if (errors) {
  console.error(`\n${errors}개 문제`)
  process.exit(1)
}
console.log(`✓ ${lang} 번역 정상: ${used.size}개 단어`)
