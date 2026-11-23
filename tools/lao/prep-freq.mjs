// 자주 쓰는 말 후보 1,000개 → 일감 8묶음 (단어 · 순위 · 사전 영어 뜻 · 말뭉치 문장 2개)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { laoNormalize as N } from '../../src/lao.ts'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const S = `${WORK}/lao`
const ranked = JSON.parse(readFileSync(`${S}/freq.json`, 'utf8'))
const sents = []
for (const f of ['10ksegmented.txt', 'testsegsent_1000.txt']) for (const l of readFileSync(`${S}/hvu/${f}`, 'utf8').split('\n')) if (l.trim()) sents.push(l.trim())
const cand = ranked.filter((r) => !r.have && r.gloss.length && r.c >= 3 && [...r.w].length >= 2 && !/[໐-໙]/.test(r.w)).slice(0, 1000)
mkdirSync(`${S}/freq-work`, { recursive: true })
const ctx = (w) => {
  const hits = []
  for (const s of sents) {
    const toks = s.split(' ').map(N)
    if (toks.includes(w)) hits.push(s.replace(/ /g, ''))
    if (hits.length >= 12) break
  }
  return hits.sort((a, b) => a.length - b.length).slice(0, 2)
}
const per = 125
for (let k = 0; k < cand.length; k += per) {
  const chunk = cand.slice(k, k + per).map((r) => ({ w: r.w, rank: r.rank, gloss: r.gloss, ctx: ctx(r.w) }))
  writeFileSync(`${S}/freq-work/in-${k / per + 1}.json`, JSON.stringify(chunk, null, 1))
}
console.log('candidates', cand.length, 'chunks', Math.ceil(cand.length / per))
console.log(cand.slice(0, 5).map((r) => r.w + ' ' + r.gloss.join(' / ')).join('\n'))
