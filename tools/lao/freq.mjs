// HVULao_NLP 띄어쓴 말뭉치(11,000문장)로 라오어 단어 빈도 → 지금 라오스어판에 없는 자주 쓰는 말 · 사전 영어 뜻
import { readFileSync, writeFileSync } from 'node:fs'
import { laoNormalize as N } from '../../src/lao.ts'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const H = `${WORK}/lao/hvu`
const C = `${WORK}/lao/dl/whl/laonlp/corpus`
const LAO = /^[຀-໿]+$/
const freq = new Map()
let tokens = 0
for (const f of ['10ksegmented.txt', 'testsegsent_1000.txt'])
  for (const line of readFileSync(`${H}/${f}`, 'utf8').split('\n'))
    for (const t0 of line.split(/\s+/)) {
      const t = N(t0.replace(/ໆ$/, ''))
      if (!t || !LAO.test(t)) continue
      tokens++
      freq.set(t, (freq.get(t) ?? 0) + 1)
    }
// 사전 영어 뜻
const gloss = new Map()
for (const line of readFileSync(`${C}/lao-eng-dictionary.csv`, 'utf8').split('\n').slice(1)) {
  const m = /^\d+,([^,]+),(.*),([^,]*),([^,]*)$/.exec(line.trim())
  if (!m) continue
  const w = N(m[1].trim())
  const g = m[2].replace(/^"|"$/g, '').trim()
  if (!gloss.has(w)) gloss.set(w, [])
  if (gloss.get(w).length < 4 && g) gloss.get(w).push(g)
}
// 지금 라오스어판에 있는 말
const have = new Set()
for (const f of ['level-1', 'level-2', 'level-3', 'daily-1', 'daily-2', 'daily-3']) {
  const m = await import(`${ROOT}/src/data/lo/${f}.ts`)
  for (const u of m.UNITS) for (const r of u.words) have.add(N(r[0]))
}
const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1])
console.log('tokens', tokens, 'types', freq.size)
const top = (n) => ranked.slice(0, n)
for (const n of [500, 1000, 2000, 3000]) {
  const t = top(n)
  console.log(`top ${n}: in edition ${t.filter(([w]) => have.has(w)).length}, in dict ${t.filter(([w]) => gloss.has(w)).length}, missing+dict ${t.filter(([w]) => !have.has(w) && gloss.has(w)).length}`)
}
const missing = ranked.filter(([w, c]) => !have.has(w) && gloss.has(w) && c >= 3)
console.log('missing with dict gloss and freq>=3:', missing.length)
console.log(missing.slice(0, 40).map(([w, c]) => `${w}(${c}) ${gloss.get(w)[0]}`).join(' | '))
writeFileSync(`${WORK}/lao/freq.json`, JSON.stringify(ranked.slice(0, 6000).map(([w, c], i) => ({ w, c, rank: i + 1, have: have.has(w), gloss: gloss.get(w) ?? [] })), null, 0))
