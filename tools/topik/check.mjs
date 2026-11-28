// TOPIK 새 단원 일감 검사: node tools/topik/check.mjs NN   (in-NN.json + out-NN.json, 저장소 루트에서)
import { readFileSync, existsSync } from 'node:fs'
const ROOT = process.cwd()
const WORK = `${process.env.CK_WORK || `${ROOT}/tools/_work`}/topik`
const nn = process.argv[2]
const inp = JSON.parse(readFileSync(`${WORK}/in-${nn}.json`, 'utf8'))
if (!existsSync(`${WORK}/out-${nn}.json`)) {
  console.error(`✗ out-${nn}.json 없음`)
  process.exit(1)
}
let out
try {
  out = JSON.parse(readFileSync(`${WORK}/out-${nn}.json`, 'utf8'))
} catch (e) {
  console.error('✗ JSON 아님: ' + e.message)
  process.exit(1)
}
const BANNED = new Set([...'🫠🫢🫣🫡🫥🫤🥹🫱🫲🫳🫴🫰🫵🫶🪸🪷🪹🪺🫘🫗🫙🛝🛞🛟🪬🪩🪫🩼🩻🫧🪪🟰🫨🩷🩵🩶🫏🪿🫎🪼🪽🪮🪭🫚🫛🪯🛜🪇🪈🫩🫆🪾🫜🪉🪏🫟', '🔞'])
const SCRIPT = {
  lo: /[຀-໿]/,
  th: /[฀-๿]/,
  vi: /[a-zA-ZÀ-ỹ]/,
  mn: /[А-Яа-яЁёӨөҮү]/,
  ar: /[؀-ۿ]/,
}
const NOT = { lo: /[฀-๿]/, th: /[຀-໿]/, vi: /[฀-໿Ѐ-ӿ؀-ۿ]/, mn: /[฀-໿؀-ۿ]/, ar: /[฀-໿Ѐ-ӿ]/ }
const HANGUL = /[가-힣]/
const hangulOutsideBrackets = (s) => HANGUL.test(String(s).replace(/\([^)]*\)|\[[^\]]*\]/g, ''))
const ROM = /^[a-z0-9' \-.,?!~"]+$/
// 숫자 키캡(1️⃣ · #️⃣)도 그림으로 인정
const KEYCAP = /^[#*0-9]\uFE0F?\u20E3$/u
const isEmoji = (e) => typeof e === 'string' && e.length > 0 && e.length <= 14 && (KEYCAP.test(e) || (!/[\p{L}\p{N}\s]/u.test(e.replace(/\uFE0F|\u200D/g, '')) && /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u.test(e)))
let errors = 0
let warns = 0
const fail = (m) => (errors++, console.error('✗ ' + m))
const warn = (m) => (warns++, console.error('△ ' + m))
const norm = (s) => String(s ?? '').trim().toLowerCase()
const checkLangs = (where, o, keys = ['lo', 'th', 'vi', 'mn', 'ar']) => {
  for (const k of keys) {
    const v = o?.[k]
    if (typeof v !== 'string' || !v.trim()) {
      fail(`${where}: ${k} 비어 있음`)
      continue
    }
    if (!SCRIPT[k].test(v) || NOT[k].test(v)) fail(`${where}: ${k} 글자가 맞지 않음 → ${v}`)
    if (hangulOutsideBrackets(v)) fail(`${where}: ${k} 에 한글 (괄호 밖) → ${v}`)
  }
}
const units = new Set()
let nNew = 0
let nPh = 0
for (const u of inp) {
  const uk = `${u.level}-${u.key}`
  units.add(uk)
  const o = out[uk]
  if (!o) {
    fail(`${uk}: 단원 없음`)
    continue
  }
  const emoji = new Map()
  const mean = { lo: new Map(), th: new Map(), vi: new Map() }
  const koSeen = new Set(u.words.map((w) => w.ko))
  // 주어진 기존 단어의 그림 · 뜻
  for (const w of u.words.filter((w) => w.status !== 'new')) {
    emoji.set(w.emoji, w.ko)
    for (const k of ['lo', 'th', 'vi']) mean[k].set(norm(w[k]), w.ko)
  }
  const want = u.words.filter((w) => w.status === 'new').map((w) => w.ko)
  for (const k of Object.keys(o.words ?? {})) if (!want.includes(k)) fail(`${uk}: 새 단어가 아닌 "${k}" (기존 단어는 쓰지 말 것)`)
  for (const ko of want) {
    const w = o.words?.[ko]
    const at = `${uk} "${ko}"`
    if (!w) {
      fail(`${at}: 없음`)
      continue
    }
    nNew++
    if (!ROM.test(w.rom ?? '')) fail(`${at}: rom 은 소문자 로마자 → ${w.rom}`)
    checkLangs(at, w)
    if (!isEmoji(w.emoji)) fail(`${at}: 그림 하나 → ${w.emoji}`)
    if ([...String(w.emoji)].some((ch) => BANNED.has(ch))) fail(`${at}: Emoji 14 이후 그림 → ${w.emoji}`)
    if (emoji.has(w.emoji)) fail(`${at}: 그림 ${w.emoji} 이 단원에 이미 있음 ("${emoji.get(w.emoji)}")`)
    emoji.set(w.emoji, ko)
    for (const k of ['lo', 'th', 'vi']) {
      const v = norm(w[k])
      if (v && mean[k].has(v)) fail(`${at}: ${k} 뜻 "${w[k]}" 이 단원에 이미 있음 ("${mean[k].get(v)}")`)
      mean[k].set(v, ko)
    }
    const e = w.ex
    if (!e || !HANGUL.test(e.ko ?? '')) fail(`${at}: ex.ko (한국어 예문) 필요`)
    else {
      if (e.ko.length > 60) fail(`${at}: 예문이 너무 김 (${e.ko.length}자)`)
      if (!ROM.test(e.rom ?? '')) fail(`${at}: ex.rom 은 소문자 로마자 → ${e.rom}`)
      checkLangs(`${at} 예문`, e)
      const stem = ko.length > 1 && /다$/.test(ko) ? ko.slice(0, -1) : ko
      if (!e.ko.includes(stem) && !e.ko.includes(stem.slice(0, Math.max(1, stem.length - 1)))) warn(`${at}: 예문에 단어가 안 보임 → ${e.ko}`)
      if (!/요[.?!]?$|니다[.?!]?$|세요[.?!]?$|까요\?$/.test(e.ko.trim())) warn(`${at}: 해요체가 아닌 것 같음 → ${e.ko}`)
    }
  }
  const ph = o.phrases ?? []
  if (ph.length !== 5) fail(`${uk}: 문장 ${ph.length}개 (5개)`)
  const phKo = new Set()
  ph.forEach((p, i) => {
    nPh++
    const at = `${uk} 문장${i + 1}`
    if (!HANGUL.test(p?.ko ?? '') || !/\s/.test(p.ko.trim())) fail(`${at}: 한국어 2어절 이상 → ${p?.ko}`)
    if (phKo.has(p?.ko) || koSeen.has(p?.ko)) fail(`${at}: 같은 문장이 이미 있음`)
    phKo.add(p?.ko)
    if (!ROM.test(p?.rom ?? '')) fail(`${at}: rom 은 소문자 로마자 → ${p?.rom}`)
    checkLangs(at, p)
    if (!isEmoji(p?.emoji)) fail(`${at}: 그림 하나 → ${p?.emoji}`)
    if ([...String(p?.emoji)].some((ch) => BANNED.has(ch))) fail(`${at}: Emoji 14 이후 그림`)
    if (emoji.has(p?.emoji)) fail(`${at}: 그림 ${p?.emoji} 이 단원에 이미 있음 ("${emoji.get(p?.emoji)}")`)
    emoji.set(p?.emoji, `문장${i + 1}`)
    for (const k of ['lo', 'th', 'vi']) {
      const v = norm(p?.[k])
      if (v && mean[k].has(v)) fail(`${at}: ${k} 가 단원의 다른 카드와 같음`)
      mean[k].set(v, `문장${i + 1}`)
    }
    const words = u.words.map((w) => (w.ko.length > 1 && /다$/.test(w.ko) ? w.ko.slice(0, -1) : w.ko))
    if (!words.some((st) => p?.ko?.includes(st))) warn(`${at}: 단원 단어가 안 보임 → ${p?.ko}`)
  })
}
for (const k of Object.keys(out)) if (!units.has(k)) fail(`목록에 없는 단원 "${k}"`)
if (errors) {
  console.error(`\n${errors}개 문제 · 경고 ${warns}`)
  process.exit(1)
}
console.log(`✓ out-${nn}.json: 단원 ${units.size}개 · 새 단어 ${nNew} · 문장 ${nPh} 정상${warns ? ` (경고 ${warns})` : ''}`)
