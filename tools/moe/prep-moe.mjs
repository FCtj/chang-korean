// 교육부 기본 어휘: 영어 3,001 · 일본어 907 → 앱에 이미 있는 카드 찾기 + 없는 단어 일감
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const S = `${WORK}`
const D = `${S}/drive`
mkdirSync(`${D}/work`, { recursive: true })
const csv = (p) => readFileSync(p, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split(','))

// ── 영어 ──
const moeEn = JSON.parse(readFileSync(`${D}/moe-en.json`, 'utf8'))
const ngsl = new Map(csv(`${S}/src-data/en/NGSL_12_stats.csv`).map((r) => [r[0].toLowerCase(), Number(r[1])]))
const ranks = new Map(csv(`${S}/src-data/en/word_ranks.csv`).map((r, i) => [r[0]?.toLowerCase(), i + 1]))
const cefr = new Map()
for (const r of csv(`${S}/src-data/en/olp-cefrj-vocabulary-profile-1.5.csv`)) for (const h of r[0].split('/')) if (!cefr.has(h.toLowerCase())) cefr.set(h.toLowerCase(), `${r[1]} ${r[2]}`)
const haveEn = new Map()
for (const f of ['toeic-450', 'toeic-600', 'toeic-700', 'toeic-800', 'toeic-900', 'daily-a1', 'daily-a2', 'daily-b1']) {
  const m = await import(`${ROOT}/src/data/en/${f}.ts`)
  for (const u of m.UNITS) for (const r of u.words) if (!haveEn.has(r[0].toLowerCase())) haveEn.set(r[0].toLowerCase(), { row: r, ex: m.EX[r[0]] })
}
const rankEn = (w) => ngsl.get(w.toLowerCase()) ?? 5000 + (ranks.get(w.toLowerCase()) ?? 50000)
const en = moeEn.map((e) => ({ ...e, rank: rankEn(e.w), have: haveEn.get(e.w.toLowerCase()) ?? null }))
writeFileSync(`${D}/moe-en-full.json`, JSON.stringify(en))
const missEn = en.filter((e) => !e.have).map((e) => ({ w: e.w, mark: e.mark, forms: e.forms, hint: cefr.get(e.w.toLowerCase()) ?? '' }))
const per = 125
for (let k = 0; k < missEn.length; k += per) writeFileSync(`${D}/work/en-in-${k / per + 1}.json`, JSON.stringify(missEn.slice(k, k + per), null, 1))
console.log('en', en.length, 'have', en.length - missEn.length, 'missing', missEn.length, 'chunks', Math.ceil(missEn.length / per))

// ── 일본어 ──
const moeJa = JSON.parse(readFileSync(`${D}/moe-ja.json`, 'utf8')).filter((o) => !o.affix)
const jiten = new Map()
for (const r of csv(`${S}/src-data/jlpt/jiten_freq_global.csv`)) {
  if (!jiten.has(r[0])) jiten.set(r[0], Number(r[2]))
}
const byTerm = new Map()
const byRead = new Map()
for (const f of ['n5', 'n4', 'n3', 'daily-1', 'daily-2', 'daily-3']) {
  const m = await import(`${ROOT}/src/data/ja/${f}.ts`)
  for (const u of m.UNITS)
    for (const r of u.words) {
      const v = { row: r, ex: m.EX[r[0]] }
      if (!byTerm.has(r[0])) byTerm.set(r[0], v)
      if (!byRead.has(r[1])) byRead.set(r[1], v)
    }
}
const ja = moeJa.map((o) => {
  const kanas = o.kana.split('・').map((x) => x.replace(/[〜~-]/g, '')).filter(Boolean)
  const kanji = o.kanji ? o.kanji.replace(/[〜~-]/g, '') : null
  let have = (kanji && byTerm.get(kanji)) || null
  for (const k of kanas) have ||= byTerm.get(k) || (!kanji ? byRead.get(k) : null) || null
  const term = have ? have.row[0] : kanji || kanas[0]
  const rank = Math.min(...[term, ...kanas].map((t) => jiten.get(t) ?? 99999))
  return { kana: kanas[0], kanji, term, rank, have }
})
const seen = new Set()
const jaU = ja.filter((o) => (seen.has(o.term) ? false : (seen.add(o.term), true)))
writeFileSync(`${D}/moe-ja-full.json`, JSON.stringify(jaU))
const missJa = jaU.filter((o) => !o.have).map((o) => ({ term: o.term, kana: o.kana, kanji: o.kanji }))
writeFileSync(`${D}/work/ja-in-1.json`, JSON.stringify(missJa, null, 1))
console.log('ja', jaU.length, 'have', jaU.length - missJa.length, 'missing', missJa.length)
console.log(missJa.map((o) => o.term).join(' '))
