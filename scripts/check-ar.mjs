// 아랍어 번역 검사
// 사용: node scripts/check-ar.mjs <파일.ts> <목록.tsv>   → 목록 첫 칸(한국어)이 모두 있는지, 값이 아랍어(아랍 문자)인지
//       node scripts/check-ar.mjs                         → src/data/tr-ar-*.ts · exar-*.ts 형식만 검사
// 값: 문자열(단어 뜻·제목) 또는 { mn, tip? } (예문)
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve, join } from 'node:path'

let errors = 0
const fail = (m) => {
  errors++
  if (errors <= 40) console.error('✗ ' + m)
}
const ARABIC = /[\u0600-\u06FF]/
const HANGUL = /[가-힣]/
function checkValue(name, ko, v) {
  const texts = typeof v === 'string' ? [v] : v && typeof v === 'object' ? [v.mn, ...(v.tip !== undefined ? [v.tip] : [])] : [v]
  for (const x of texts) {
    if (typeof x !== 'string' || !x.trim()) fail(`${name}: "${ko}" 비어 있음`)
    else {
      if (!ARABIC.test(x)) fail(`${name}: "${ko}" 아랍 문자가 없음 → "${x}"`)
      if (HANGUL.test(x)) fail(`${name}: "${ko}" 값에 한글 → "${x}"`)
    }
  }
}
async function load(file) {
  const mod = await import(pathToFileURL(resolve(file)).href)
  return Object.values(mod).find((v) => v && typeof v === 'object' && !Array.isArray(v)) ?? {}
}
const [file, list] = process.argv.slice(2)
if (file === '--coverage') {
  // 앱의 모든 단어·문장·제목에 아랍어가 있는지 (tr-ar.ts 에 모은 것 기준)
  const { ROUNDS, PACKS, TIERS } = await import('../src/data/words.ts')
  const { TRACKS } = await import('../src/data/tracks.ts')
  const { AR, TITLE_AR } = await import('../src/data/tr-ar.ts')
  const words = new Set()
  for (const r of [...ROUNDS, ...PACKS, ...TRACKS.flatMap((t) => t.units)]) for (const w of r.words) words.add(w.ko)
  const titles = new Set()
  const addT = (l) => l?.ko && titles.add(l.ko)
  for (const t of TIERS) [t.name, t.level, t.topics].forEach(addT)
  for (const r of [...ROUNDS, ...PACKS]) addT(r.title)
  for (const t of TRACKS) [t.title, t.desc, ...t.units.map((u) => u.title)].forEach(addT)
  const missW = [...words].filter((k) => !AR[k])
  const missT = [...titles].filter((k) => !TITLE_AR[k])
  if (missW.length || missT.length) {
    console.error(`✗ 아랍어 없음: 단어·문장 ${missW.length}개 (${missW.slice(0, 8).join(', ')}…) · 제목 ${missT.length}개 (${missT.slice(0, 5).join(', ')}…)`)
    process.exit(1)
  }
  console.log(`✓ 아랍어 전부 있음: 단어·문장 ${words.size}개 · 제목 ${titles.size}개`)
  process.exit(0)
}
if (file) {
  const map = await load(file)
  for (const [ko, v] of Object.entries(map)) checkValue(file, ko, v)
  if (list) {
    const keys = readFileSync(list, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t')[0])
    const want = new Set(keys)
    for (const k of keys) if (!(k in map)) fail(`${file}: "${k}" 번역 없음`)
    for (const k of Object.keys(map)) if (!want.has(k)) fail(`${file}: 목록에 없는 키 "${k}"`)
  }
  if (errors) {
    console.error(`\n${errors}개 문제`)
    process.exit(1)
  }
  console.log(`✓ ${file}: ${Object.keys(map).length}개`)
} else {
  const dir = resolve('src/data')
  let total = 0
  for (const f of readdirSync(dir).filter((f) => /^(tr-ar-.*|exar-.*)\.ts$/.test(f))) {
    const map = await load(join(dir, f))
    for (const [ko, v] of Object.entries(map)) checkValue(f, ko, v)
    total += Object.keys(map).length
  }
  if (errors) {
    console.error(`\n${errors}개 문제`)
    process.exit(1)
  }
  console.log(`✓ 아랍어 정상: ${total}개`)
}
