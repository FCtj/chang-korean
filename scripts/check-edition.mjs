// 일본어판·영어판 레벨 파일 하나 검사 (scripts/check-editions.mjs 가 레벨마다 부름)
// 사용: node check-edition.mjs <ja|en> <레벨 파일.ts> [같은 시험의 다른 레벨 파일.ts ...]
// 파일은 export const UNITS: EdUnit[] 과 export const EX: EdExampleMap 을 내보내야 함
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [lang, file, ...others] = process.argv.slice(2)
if (!['ja', 'en'].includes(lang) || !file) {
  console.error('사용: node check-edition.mjs <ja|en> <file.ts> [others.ts ...]')
  process.exit(2)
}
let errors = 0
let warns = 0
const fail = (m) => (errors++, console.error('✗ ' + m))
const warn = (m) => (warns++, console.error('△ ' + m))
const load = async (f) => import(pathToFileURL(resolve(f)).href)
const { UNITS, EX } = await load(file)
if (!Array.isArray(UNITS)) fail('UNITS 없음')
if (!EX || typeof EX !== 'object') fail('EX 없음')
const HANGUL = /[가-힣]/
const KANA = /^[぀-ゟ゠-ヿー・\s、。？！「」『』〜…（）()0-9０-９A-Za-zＡ-Ｚａ-ｚ,.?!%％]+$/
const JA = /[぀-ヿ一-鿿]/
const EN_TERM = /^[A-Za-z0-9][A-Za-z0-9\s'’\-.,?!:;/()&$%]*$/
const POS = /^\[(명|동|형|부|전|접|대|감|조)\] \S/
const otherTerms = new Map()
for (const f of others) if (existsSync(f)) for (const u of (await load(f)).UNITS ?? []) for (const r of [...u.words, ...u.phrases]) otherTerms.set(r[0], f.split('/').pop())

const terms = new Map()
const keys = new Set()
let nWords = 0
let nPhrases = 0
for (const [ui, u] of (UNITS ?? []).entries()) {
  const where = `단원 ${ui + 1} (${u?.key})`
  if (!u?.key || !/^[a-z][a-z0-9-]*$/.test(u.key)) fail(`${where}: key 는 영문 소문자`)
  if (keys.has(u.key)) fail(`${where}: key 중복`)
  keys.add(u.key)
  if (!u.icon) fail(`${where}: icon 없음`)
  if (!HANGUL.test(u.title ?? '')) fail(`${where}: title 은 한국어`)
  if ((u.words ?? []).length !== 25) fail(`${where}: 단어 ${(u.words ?? []).length}개 (25개)`)
  if ((u.phrases ?? []).length !== 5) fail(`${where}: 문장 ${(u.phrases ?? []).length}개 (5개)`)
  const emoji = new Set()
  const meaning = new Set()
  for (const [kind, rows] of [['단어', u.words ?? []], ['문장', u.phrases ?? []]]) {
    for (const r of rows) {
      const w = `${where} ${kind} "${r?.[0]}"`
      if (!Array.isArray(r) || r.length !== 4) {
        fail(`${w}: [말, 읽기, 뜻, 그림] 4칸`)
        continue
      }
      const [term, reading, mean, em] = r
      if (!term?.trim() || !mean?.trim() || !em?.trim()) fail(`${w}: 빈 칸`)
      if (terms.has(term)) fail(`${w}: 이 레벨에 이미 있음 (${terms.get(term)})`)
      terms.set(term, u.key)
      if (otherTerms.has(term)) fail(`${w}: 다른 레벨(${otherTerms.get(term)})에 이미 있음`)
      if (!HANGUL.test(mean)) fail(`${w}: 뜻은 한국어`)
      if (emoji.has(em)) fail(`${w}: 그림 ${em} 이 단원에 이미 있음`)
      emoji.add(em)
      if (meaning.has(mean)) fail(`${w}: 뜻 "${mean}" 이 단원에 이미 있음`)
      meaning.add(mean)
      if (lang === 'ja') {
        if (!JA.test(term)) fail(`${w}: 일본어가 아님`)
        if (HANGUL.test(term) || HANGUL.test(reading)) fail(`${w}: 일본어 칸에 한글`)
        if (!reading?.trim() || !KANA.test(reading)) fail(`${w}: 읽기는 가나로 → ${reading}`)
        if (/[぀-ヿ]/.test(mean)) fail(`${w}: 뜻에 가나`)
        if (kind === '문장' && !/[。？！?!]$/.test(term)) fail(`${w}: 문장은 。？！ 로 끝내기`)
        if (kind === '단어' && /[。？！]/.test(term)) fail(`${w}: 단어에 문장 부호`)
      } else {
        if (!EN_TERM.test(term)) fail(`${w}: 영어 글자만`)
        if (kind === '단어') {
          if (!reading?.trim() || /[\/\[\]]/.test(reading) || HANGUL.test(reading)) fail(`${w}: 읽기는 빗금 없는 IPA → ${reading}`)
          if (!POS.test(mean)) fail(`${w}: 뜻 앞에 품사 [명]/[동]/[형]/[부]… → ${mean}`)
          if (term.trim().split(/\s+/).length > 4) fail(`${w}: 단어가 너무 김`)
        } else {
          if (reading !== '') fail(`${w}: 영어 문장의 읽기는 ''`)
          if (term.trim().split(/\s+/).length < 3) fail(`${w}: 문장은 세 단어 이상`)
          if (!/[.?!]$/.test(term)) fail(`${w}: 문장은 . ? ! 로 끝내기`)
        }
      }
    }
  }
  nWords += (u.words ?? []).length
  nPhrases += (u.phrases ?? []).length
  // 예문 (단어만)
  for (const r of u.words ?? []) {
    const [term] = r
    const e = EX?.[term]
    const w = `${where} 예문 "${term}"`
    if (!e) {
      fail(`${w}: 없음`)
      continue
    }
    if (!e.ex?.trim() || !HANGUL.test(e.ko ?? '')) fail(`${w}: ex·ko 필요 (ko 는 한국어 번역)`)
    if (HANGUL.test(e.ex ?? '')) fail(`${w}: ex 에 한글`)
    if (lang === 'ja') {
      if (!JA.test(e.ex ?? '')) fail(`${w}: ex 는 일본어`)
      if (!e.rom?.trim() || !KANA.test(e.rom)) fail(`${w}: rom 은 가나 읽기 → ${e.rom}`)
      if ((e.ex ?? '').length > 45) fail(`${w}: ex 너무 김 (${e.ex.length}자, 45자까지)`)
      const stem = term.length > 1 && /[るうくすつぬむぶぐいだ]$/.test(term) ? term.slice(0, -1) : term
      if (!(e.ex ?? '').includes(stem)) warn(`${w}: 예문에 단어가 안 보임 → ${e.ex}`)
    } else {
      if (e.rom !== '') fail(`${w}: 영어 예문의 rom 은 ''`)
      if (!/^[A-Z0-9"'“]/.test(e.ex ?? '') || !/[.?!]["”']?$/.test(e.ex ?? '')) fail(`${w}: 문장 형태로 (대문자 시작, 마침표)`)
      if ((e.ex ?? '').length > 110) fail(`${w}: ex 너무 김`)
      const stem = term.toLowerCase().split(' ')[0].slice(0, Math.max(3, Math.min(5, term.length - 2)))
      if (!(e.ex ?? '').toLowerCase().includes(stem)) warn(`${w}: 예문에 단어가 안 보임 → ${e.ex}`)
    }
  }
}
for (const k of Object.keys(EX ?? {})) if (![...terms.keys()].includes(k)) fail(`예문 키 "${k}" 가 단어 목록에 없음`)
if ((UNITS ?? []).length !== 12) fail(`단원 ${(UNITS ?? []).length}개 (12개)`)
if (errors) {
  console.error(`\n${errors}개 문제 · 경고 ${warns}`)
  process.exit(1)
}
console.log(`✓ ${file.split('/').pop()}: ${UNITS.length}단원 · 단어 ${nWords} · 문장 ${nPhrases} · 예문 ${Object.keys(EX).length}${warns ? ` (경고 ${warns})` : ''}`)
