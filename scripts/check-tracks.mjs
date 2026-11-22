// 목적별 트랙 데이터 검사
// 사용: node scripts/check-tracks.mjs                     → src/data/tracks.ts 의 모든 트랙
//       node scripts/check-tracks.mjs src/data/track-restaurant.ts  → 그 파일의 단원 배열만
// 규칙: 단원마다 단어 ≥ 20, 문장 ≥ 5 / 모든 칸 채움 / 단원 안에서 이모지·한국어·라오·태국·베트남 뜻 겹치지 않음
//       트랙 안에서 한국어 겹치지 않음 / TOPIK 급끼리도 겹치지 않음 / 문장은 한국어가 2어절 이상 / 단원 키 형식
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

let errors = 0
const fail = (m) => {
  errors++
  console.error('✗ ' + m)
}

function checkUnits(trackName, units) {
  const seenKo = new Map()
  const keys = new Set()
  let words = 0
  let phrases = 0
  for (const u of units) {
    const where = `${trackName}/${u.key}`
    if (!/^[a-z0-9-]+$/.test(u.key ?? '')) fail(`${where}: 단원 키 형식`)
    if (keys.has(u.key)) fail(`${where}: 단원 키 중복`)
    keys.add(u.key)
    for (const l of ['ko', 'lo', 'th', 'vi']) if (!u.title?.[l]?.trim()) fail(`${where}: 제목 ${l} 없음`)
    if (!u.icon?.trim()) fail(`${where}: 아이콘 없음`)
    if ((u.words?.length ?? 0) < 20) fail(`${where}: 단어 ${u.words?.length ?? 0}개 (20개 이상)`)
    if ((u.phrases?.length ?? 0) < 5) fail(`${where}: 문장 ${u.phrases?.length ?? 0}개 (5개 이상)`)
    const rows = [...(u.words ?? []).map((r) => ['단어', r]), ...(u.phrases ?? []).map((r) => ['문장', r]), ...(u.added ?? []).map((a) => [a.phrase ? '문장' : '단어', a.row])]
    const uniq = { ko: new Map(), lo: new Map(), th: new Map(), vi: new Map(), emoji: new Map() }
    for (const [kind, r] of rows) {
      if (!Array.isArray(r) || r.length !== 6) {
        fail(`${where}: 형식 오류 ${JSON.stringify(r)}`)
        continue
      }
      const [ko, rom, lo, th, vi, emoji] = r
      const cells = { ko, rom, lo, th, vi, emoji }
      for (const [k, v] of Object.entries(cells)) if (typeof v !== 'string' || !v.trim()) fail(`${where}: "${ko}" ${k} 비어 있음`)
      if (/[가-힣]/.test(rom)) fail(`${where}: "${ko}" 로마자에 한글`)
      if (kind === '문장' && ko.trim().split(/\s+/).length < 2) fail(`${where}: 문장 "${ko}" 이 너무 짧음 (2어절 이상)`)
      if (kind === '단어' && ko.trim().split(/\s+/).length > 3) fail(`${where}: 단어 "${ko}" 가 너무 김 (문장이면 phrases 로)`)
      for (const k of Object.keys(uniq)) {
        const v = cells[k]
        if (uniq[k].has(v)) fail(`${where}: ${k} 중복 "${v}" (${uniq[k].get(v)}, ${ko})`)
        uniq[k].set(v, ko)
      }
      if (seenKo.has(ko) && seenKo.get(ko) !== u.key) fail(`${trackName}: 한국어 "${ko}" 가 ${seenKo.get(ko)} 와 ${u.key} 에 모두 있음`)
      seenKo.set(ko, u.key)
    }
    words += (u.words?.length ?? 0) + (u.added ?? []).filter((a) => !a.phrase).length
    phrases += (u.phrases?.length ?? 0) + (u.added ?? []).filter((a) => a.phrase).length
  }
  return { words, phrases, units: units.length }
}

const arg = process.argv[2]
if (arg) {
  const mod = await import(pathToFileURL(resolve(arg)).href)
  const units = Object.values(mod).find((v) => Array.isArray(v))
  if (!units) {
    console.error('단원 배열(export const …: TrackUnitSrc[])을 찾지 못함')
    process.exit(2)
  }
  const r = checkUnits(arg, units)
  if (errors) {
    console.error(`\n${errors}개 문제`)
    process.exit(1)
  }
  console.log(`✓ ${arg}: 단원 ${r.units}개, 단어 ${r.words}개, 문장 ${r.phrases}개`)
} else {
  const { TRACK_SOURCES } = await import('../src/data/tracks.ts')
  const out = []
  for (const t of TRACK_SOURCES) {
    const r = checkUnits(t.id, t.units)
    out.push(`${t.id} ${r.units}단원 ${r.words}단어 ${r.phrases}문장`)
  }
  // TOPIK: 급이 달라도 같은 한국어 단어는 한 번만 (낮은 급에 둠)
  const topikSeen = new Map()
  for (const t of TRACK_SOURCES.filter((x) => x.group === 'topik'))
    for (const u of t.units)
      for (const r of [...u.words, ...(u.added ?? []).filter((x) => !x.phrase).map((x) => x.row)]) {
        if (topikSeen.has(r[0])) fail(`TOPIK: "${r[0]}" 가 ${topikSeen.get(r[0])} 와 ${t.id}/${u.key} 에 모두 있음`)
        else topikSeen.set(r[0], `${t.id}/${u.key}`)
      }
  if (errors) {
    console.error(`\n${errors}개 문제`)
    process.exit(1)
  }
  console.log(`✓ 트랙 정상: ${out.filter((x) => !/ 0단원/.test(x)).join(' · ')}`)
}
