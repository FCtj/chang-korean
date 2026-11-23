// 출처 단어 묶음 채움 검사: node check-chunk.mjs <name>   (chunk-<name>.json + out-<name>.json)
import { readFileSync, existsSync } from 'node:fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const D = `${WORK}/edition2`
const name = process.argv[2]
const lang = name?.slice(0, 2)
const chunk = JSON.parse(readFileSync(`${D}/chunk-${name}.json`, 'utf8'))
if (!existsSync(`${D}/out-${name}.json`)) {
  console.error(`✗ out-${name}.json 없음`)
  process.exit(1)
}
let out
try {
  out = JSON.parse(readFileSync(`${D}/out-${name}.json`, 'utf8'))
} catch (e) {
  console.error('✗ JSON 아님: ' + e.message)
  process.exit(1)
}
const HANGUL = /[가-힣]/
const KANA = /^[぀-ゟ゠-ヿー・\s、。？！「」『』〜～…（）()0-9０-９A-Za-zＡ-Ｚａ-ｚ,.?!%％]+$/
const JA = /[぀-ヿ一-鿿]/
const POS = /^\[(명|동|형|부|전|접|대|감)(·(명|동|형|부|전|접|대|감))?\] \S/
let errors = 0
let warns = 0
const fail = (m) => (errors++, console.error('✗ ' + m))
const warn = (m) => (warns++, console.error('△ ' + m))
const terms = new Set()
let n = 0
for (const u of chunk) {
  const emoji = new Map()
  const mean = new Map()
  // 같은 단원에 이미 있는 단어(토익 데이터에서 가져온 것)의 그림·뜻은 피하기
  for (const e of u.taken?.emoji ?? []) emoji.set(e, '(이미 있는 단어)')
  for (const m of u.taken?.meaning ?? []) mean.set(m, '(이미 있는 단어)')
  for (const w of u.words) {
    n++
    terms.add(w.term)
    const o = out[w.term]
    const where = `${u.level} ${u.title} "${w.term}"`
    if (!o) {
      fail(`${where}: 없음`)
      continue
    }
    for (const k of ['meaning', 'emoji', 'ex', 'exKo']) if (!String(o[k] ?? '').trim()) fail(`${where}: ${k} 비어 있음`)
    if (o.meaning && !HANGUL.test(o.meaning)) fail(`${where}: 뜻은 한국어`)
    if (o.exKo && !HANGUL.test(o.exKo)) fail(`${where}: exKo 는 한국어`)
    if (o.ex && HANGUL.test(o.ex)) fail(`${where}: ex 에 한글`)
    if (o.emoji) {
      if (emoji.has(o.emoji)) fail(`${where}: 그림 ${o.emoji} 이 단원에 이미 있음 ("${emoji.get(o.emoji)}")`)
      emoji.set(o.emoji, w.term)
    }
    if (o.meaning) {
      if (mean.has(o.meaning)) fail(`${where}: 뜻 "${o.meaning}" 이 단원에 이미 있음 ("${mean.get(o.meaning)}")`)
      mean.set(o.meaning, w.term)
    }
    if (lang === 'ja') {
      if (/[぀-ヿ]/.test(o.meaning ?? '')) fail(`${where}: 뜻에 가나`)
      if (o.ex && !JA.test(o.ex)) fail(`${where}: ex 는 일본어`)
      if (!o.exRom?.trim() || !KANA.test(o.exRom)) fail(`${where}: exRom 은 가나 읽기 → ${o.exRom}`)
      if ((o.ex ?? '').length > 45) fail(`${where}: ex 너무 김 (${o.ex.length}자)`)
      const t = w.term.replace(/[～〜]/g, '')
      const stem = t.length > 1 && /[るうくすつぬむぶぐいだ]$/.test(t) ? t.slice(0, -1) : t
      const rstem = w.reading.replace(/[～〜]/g, '')
      if (o.ex && !o.ex.includes(stem) && !o.ex.includes(rstem.length > 1 ? rstem.slice(0, -1) : rstem)) warn(`${where}: 예문에 단어가 안 보임 → ${o.ex}`)
    } else {
      if (o.meaning && !POS.test(o.meaning)) fail(`${where}: 뜻 앞에 품사 [명]/[동]… → ${o.meaning}`)
      if ((o.exRom ?? '') !== '') fail(`${where}: 영어 exRom 은 ""`)
      if (o.ex && (!/^[A-Z0-9"'“]/.test(o.ex) || !/[.?!]["”']?$/.test(o.ex))) fail(`${where}: 문장 형태로 (대문자 시작, 마침표)`)
      if ((o.ex ?? '').split(/\s+/).length > 18) fail(`${where}: ex 너무 김`)
      if (!w.reading && !String(o.ipa ?? '').trim()) fail(`${where}: reading 이 비어 있어 ipa 필요`)
      if (o.ipa && /[\/\[\]가-힣]/.test(o.ipa)) fail(`${where}: ipa 는 빗금 없이`)
      const stem = w.term.toLowerCase().split(/[\s-]/)[0].slice(0, Math.max(3, Math.min(5, w.term.length - 2)))
      if (o.ex && !o.ex.toLowerCase().includes(stem)) warn(`${where}: 예문에 단어가 안 보임 → ${o.ex}`)
    }
  }
}
for (const k of Object.keys(out)) if (!terms.has(k)) fail(`목록에 없는 단어 "${k}" (단어는 바꾸지 말 것)`)
if (errors) {
  console.error(`\n${errors}개 문제 · 경고 ${warns}`)
  process.exit(1)
}
console.log(`✓ out-${name}.json: ${n}단어 정상${warns ? ` (경고 ${warns})` : ''}`)
