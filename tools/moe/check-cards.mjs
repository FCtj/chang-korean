// 교육부 기본 어휘 카드 검사: node check.mjs <en-in|ja-in.json> <out.json>
import { readFileSync } from 'node:fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const [inF, outF] = process.argv.slice(2)
const ja = inF.includes('ja-in')
const input = JSON.parse(readFileSync(inF, 'utf8'))
let out
try {
  out = JSON.parse(readFileSync(outF, 'utf8'))
} catch (e) {
  console.error('✗ JSON 을 읽을 수 없음:', e.message)
  process.exit(1)
}
const BANNED = new Set([...'🫠🫢🫣🫡🫥🫤🥹🫱🫲🫳🫴🫰🫵🫶🪸🪷🪹🪺🫘🫗🫙🛝🛞🛟🪬🪩🪫🩼🩻🫧🪪🟰🫨🩷🩵🩶🫏🪿🫎🪼🪽🪮🪭🫚🫛🪯🛜🪇🪈🫩🫆🪾🫜🪉🪏🫟🔞'])
const HANGUL = /[가-힣]/
const KANA = /^[぀-ゟ゠-ヿー・\s、。？！「」『』〜～…（）()0-9０-９A-Za-zＡ-Ｚａ-ｚ,.?!%％]+$/
const POS = /^\[(명|동|형|부|전|접|대|감|조)(·(명|동|형|부|전|접|대|감|조))?\] \S/
let bad = 0
const fail = (m) => (bad++, console.error('✗ ' + m))
for (const it of input) {
  const k = ja ? it.term : it.w
  const o = out[k]
  if (!o) {
    fail(`${k}: 결과 없음`)
    continue
  }
  if (o.skip) continue
  if (!o.emoji || [...o.emoji].some((ch) => BANNED.has(ch)) || /[A-Za-z0-9가-힣぀-ヿ一-鿿]/.test(o.emoji)) fail(`${k}: emoji 하나 (Emoji 13 이하) → ${o.emoji}`)
  if (!HANGUL.test(o.exKo ?? '') || !/[.?!]$/.test(o.exKo ?? '')) fail(`${k}: exKo 는 한국어 문장 (마침표로 끝)`)
  if (HANGUL.test(o.ex ?? '')) fail(`${k}: ex 에 한글`)
  if (ja) {
    if (!HANGUL.test(o.mean ?? '') || /[぀-ヿ]/.test(o.mean ?? '')) fail(`${k}: mean 은 한국어 (가나 없이) → ${o.mean}`)
    if (!/[。？！]$/.test(o.ex ?? '') || (o.ex ?? '').length > 45) fail(`${k}: ex 는 45자 이하 일본어 문장 (。？！ 로 끝)`)
    const stem = k.length > 1 && /[るうくすつぬむぶぐいだ]$/.test(k) ? k.slice(0, -1) : k
    if (!(o.ex ?? '').includes(stem) && !(o.ex ?? '').includes(it.kana.slice(0, -1) || it.kana)) fail(`${k}: ex 에 단어가 안 보임 → ${o.ex}`)
    if (!o.rom?.trim() || !KANA.test(o.rom)) fail(`${k}: rom 은 가나 읽기 → ${o.rom}`)
  } else {
    if (!POS.test(o.mean ?? '')) fail(`${k}: mean 은 '[품사] 뜻' → ${o.mean}`)
    if (/[A-Za-z]/.test((o.mean ?? '').replace(/^\[[^\]]+\]/, ''))) fail(`${k}: mean 에 영어`)
    if (!/^[A-Z0-9"'“]/.test(o.ex ?? '') || !/[.?!]["”']?$/.test(o.ex ?? '') || (o.ex ?? '').length > 110) fail(`${k}: ex 는 대문자 시작·마침표 끝·110자 이하`)
    const stem = k.toLowerCase().split(' ')[0].slice(0, Math.max(3, Math.min(5, k.length - 2)))
    if (!(o.ex ?? '').toLowerCase().includes(stem)) fail(`${k}: ex 에 단어가 안 보임 → ${o.ex}`)
  }
}
for (const key of Object.keys(out)) if (!input.some((it) => (ja ? it.term : it.w) === key)) fail(`${key}: 입력에 없는 단어`)
if (bad) {
  console.error(`\n${bad}개 문제`)
  process.exit(1)
}
console.log(`✓ ${Object.keys(out).length}개 (건너뜀 ${Object.values(out).filter((o) => o.skip).length})`)
