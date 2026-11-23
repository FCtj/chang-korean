// 라오스어판 단어 데이터 만들기
// 원본: 한국어판 단원(한국어 단어 · 라오어 뜻 · 그림 · 예문의 라오어 번역)
// 남기는 단어: 라오어가 라오스 정부 사전(lao-eng-dictionary.csv, MIT) · 위키낱말사전 · Lao-Dictionary 에 그대로 있고,
//             예문 라오어 문장에 그 단어가 들어 있는 것
// 출력: src/data/lo/level-1..3.ts (입문·초급·중급) · daily-1..3.ts (여행·관광 / 식당·쇼핑 / 일·생활) · index.ts · daily.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { laoNormalize as N, laoRoman, laoHangul, laoSyllables } from '../../src/lao.ts'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)

const D = `${ROOT}/src/data`
const OUT = `${D}/lo`
const C = `${WORK}/lao/dl/whl/laonlp/corpus`
mkdirSync(OUT, { recursive: true })

// ── 사전 ──
const dict = new Set()
for (const line of readFileSync(`${C}/lao-eng-dictionary.csv`, 'utf8').split('\n').slice(1)) {
  const w = line.split(',')[1]
  if (w) dict.add(N(w.trim()))
}
for (const f of ['wiktionary-20210720.txt', 'Lao-Dictionary.txt']) for (const w of readFileSync(`${C}/${f}`, 'utf8').split('\n')) if (w.trim()) dict.add(N(w.trim()))

// ── 예문 (한국어 단어 → { ex 한국어, lo 라오어 }) ──
const EX = {}
for (const f of ['basic-1', 'basic-2', 'basic-3', 'curation', 'job-eps-a', 'job-eps-b', 'job-guide', 'job-hotel', 'job-massage', 'job-parenting-a', 'job-parenting-b', 'job-store', 'topik-1', 'topik-2', 'topik-3', 'topik-4', 'topik-5', 'topik-6', 'tracks']) {
  const m = await import(`${D}/ex-${f}.ts`)
  for (const v of Object.values(m)) if (v && typeof v === 'object') for (const [k, e] of Object.entries(v)) if (e?.ex && e?.lo && !EX[k]) EX[k] = e
}

const load = async (name) => Object.values(await import(`${D}/track-${name}.ts`)).find(Array.isArray)
const LAO = /[຀-໿]/
// 사전 확인: ① 그대로 있음 ② ການ/ຄວາມ(명사 만들기) + 사전 단어 ③ 사전 단어 2~3개를 이은 합성어 (예: ຫ້ອງ+ນ້ຳ)
const HOW = { exact: 0, prefix: 0, compound: 0 }
// 음절 경계에서만 자르고, 조각마다 사전 단어(2글자 이상)여야 함
function splits(w, depth) {
  const syl = laoSyllables(w)
  const go = (i, d) => {
    if (i === syl.length) return true
    if (d === 0) return false
    for (let j = syl.length; j > i; j--) {
      const piece = syl.slice(i, j).join('')
      if (piece.length >= 2 && dict.has(piece) && !(i === 0 && j === syl.length) && go(j, d - 1)) return true
    }
    return false
  }
  return syl.length >= 2 && go(0, depth)
}
function verified(c) {
  if (/\s/.test(c) || c.length > 18) return false
  if (dict.has(c)) return (HOW.exact++, true)
  const m = /^(ການ|ຄວາມ)(.+)$/.exec(c)
  if (m && dict.has(m[2])) return (HOW.prefix++, true)
  if (splits(c, 3)) return (HOW.compound++, true)
  return false
}
const clean = (lo) => lo.replace(/\s*\([^)]*\)/g, '').split(/[,/;]/).map((x) => x.trim()).filter(Boolean)
const isSentence = (ko) => /[.?!]$/.test(ko) || (ko.includes(' ') && ko.length > 10)

function buildSet(groups, prefix) {
  const seen = new Set()
  const stats = { words: 0, kept: 0, noDict: 0, noEx: 0, notIn: 0 }
  const levels = []
  for (const g of groups) {
    const units = []
    let n = 0
    for (const src of g.units) {
      const rows = []
      const phrases = []
      const usedEmoji = new Set()
      const usedMean = new Set()
      for (const r of [...src.words, ...(src.added ?? []).filter((a) => !a.phrase).map((a) => a.row)]) {
        const [ko, , lo, , , emoji] = r
        if (!LAO.test(lo) || isSentence(ko) || !/[가-힣]/.test(ko)) continue
        stats.words++
        const cand = clean(lo).map(N).find(verified)
        if (!cand) { stats.noDict++; continue }
        if (seen.has(cand)) continue
        const e = EX[ko]
        if (!e) { stats.noEx++; continue }
        const exLo = N(e.lo)
        if (!exLo.includes(cand)) { stats.notIn++; continue }
        if (usedEmoji.has(emoji) || usedMean.has(ko)) continue
        seen.add(cand)
        usedEmoji.add(emoji)
        usedMean.add(ko)
        rows.push({ term: cand, reading: laoRoman(cand), mean: ko, emoji, ex: { ex: exLo, rom: laoHangul(exLo), ko: e.ex } })
        stats.kept++
      }
      // 짧은 상황 문장 (초안) 5개까지
      for (const r of src.phrases ?? []) {
        const [ko, , lo, , , emoji] = r
        if (phrases.length >= 5 || !LAO.test(lo)) continue
        const t = N(lo.replace(/\s*\([^)]*\)/g, '').trim())
        if (t.length > 40 || seen.has(t) || usedEmoji.has(emoji)) continue
        seen.add(t)
        usedEmoji.add(emoji)
        phrases.push({ term: t, mean: ko, emoji })
      }
      if (rows.length < 3) continue
      // 25개 넘으면 나눔
      for (let k = 0; k < rows.length; k += 25) {
        const part = rows.slice(k, k + 25)
        n++
        units.push({ key: `${prefix}${g.id}-${String(n).padStart(2, '0')}`, icon: src.icon, title: src.title.ko + (rows.length > 25 ? ` ${'①②③④'[k / 25]}` : ''), words: part, phrases: k === 0 ? phrases : [] })
      }
    }
    levels.push({ ...g, units })
  }
  return { levels, stats }
}

const T = async (...names) => (await Promise.all(names.map(load))).flat()
const LEVELS = [
  { id: 1, file: 'level-1', units: await T('topik-1') },
  { id: 2, file: 'level-2', units: await T('topik-2') },
  { id: 3, file: 'level-3', units: await T('topik-3', 'topik-4', 'topik-5', 'topik-6') },
]
const DAILY = [
  { id: 1, file: 'daily-1', units: await T('guide', 'hotel') },
  { id: 2, file: 'daily-2', units: await T('restaurant', 'store') },
  { id: 3, file: 'daily-3', units: await T('work-a', 'work-b', 'eps-a', 'eps-b', 'massage', 'parenting-a', 'parenting-b') },
]

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
function write(set, head) {
  for (const lv of set.levels) {
    let src = head + "import type { EdUnit, EdExampleMap } from '../edition-types'\n\nexport const UNITS: EdUnit[] = [\n"
    const ex = []
    for (const u of lv.units) {
      src += `  {\n    key: ${q(u.key)},\n    icon: ${q(u.icon)},\n    title: ${q(u.title)},\n    words: [\n`
      for (const w of u.words) {
        src += `      [${q(w.term)}, ${q(w.reading)}, ${q(w.mean)}, ${q(w.emoji)}],\n`
        ex.push(`  ${q(w.term)}: { ex: ${q(w.ex.ex)}, rom: ${q(w.ex.rom)}, ko: ${q(w.ex.ko)} },`)
      }
      src += `    ],\n    phrases: [\n`
      for (const p of u.phrases) src += `      [${q(p.term)}, ${q(laoHangul(p.term))}, ${q(p.mean)}, ${q(p.emoji)}],\n`
      src += `    ],\n  },\n`
    }
    src += `]\n\nexport const EX: EdExampleMap = {\n${ex.join('\n')}\n}\n`
    writeFileSync(`${OUT}/${lv.file}.ts`, src)
    console.log(lv.file, lv.units.length, 'units', lv.units.reduce((a, u) => a + u.words.length, 0), 'words', lv.units.reduce((a, u) => a + u.phrases.length, 0), 'phrases')
  }
}
const HEAD = (what) => `// 라오스어판 — ${what} (출처 기반)
// 단어: 한국어판 단원의 한국어 단어와 라오어 뜻 중, 라오어가 라오스 정부 사전(E-Government Center, Ministry of Posts and
//   Telecommunications of Laos — lao-eng-dictionary, MIT) · 위키낱말사전 라오어 목록에 그대로 있는 말만
// 예문: 한국어판 예문의 라오어 번역 (초안, 원어민 검수 필요) · 읽기(rom)는 앱의 한글 발음 규칙(src/lao.ts)으로 만듦
// 자세한 출처: ./SOURCES.md
`
const A = buildSet(LEVELS, 'l')
write(A, HEAD('레벨 단어'))
const B = buildSet(DAILY, 'd')
write(B, HEAD('상황별 단어'))
console.log('levels', A.stats, '\ndaily', B.stats, '\nhow', HOW)

writeFileSync(`${OUT}/index.ts`, `// 라오스어판 레벨 (입문 · 초급 · 중급)\nimport type { EdLevel } from '../edition-data'\nimport * as L1 from './level-1.ts'\nimport * as L2 from './level-2.ts'\nimport * as L3 from './level-3.ts'\n\nexport const LEVELS: EdLevel[] = [L1, L2, L3]\n`)
writeFileSync(`${OUT}/daily.ts`, `// 라오스어판 상황별 (여행·관광 · 식당·쇼핑 · 일·생활)\nimport type { EdLevel } from '../edition-data'\nimport * as D1 from './daily-1.ts'\nimport * as D2 from './daily-2.ts'\nimport * as D3 from './daily-3.ts'\n\nexport const DAILY: EdLevel[] = [D1, D2, D3]\n`)
