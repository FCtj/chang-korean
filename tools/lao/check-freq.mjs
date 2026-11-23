// 자주 쓰는 말 결과 검사: node check-freq.mjs <in-N.json> <out-N.json>
import { readFileSync } from 'node:fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const [inF, outF] = process.argv.slice(2)
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
const LAO = /[຀-໿]/
const POS = /^\[(명|동|형|부|대|수|접|전|조|감|분|관)(·(명|동|형|부|대|수|접|전|조|감|분|관))?\] \S/
let bad = 0
const fail = (m) => (bad++, console.error('✗ ' + m))
for (const { w } of input) {
  const o = out[w]
  if (!o) {
    fail(`${w}: 결과 없음`)
    continue
  }
  if (o.skip) continue
  if (!POS.test(o.mean ?? '')) fail(`${w}: mean 은 '[품사] 뜻' (예: [동] 있다) → ${o.mean}`)
  if (/[A-Za-z]/.test(o.mean ?? '')) fail(`${w}: mean 에 영어`)
  if (!o.emoji || [...o.emoji].some((ch) => BANNED.has(ch)) || /[A-Za-z0-9가-힣຀-໿]/.test(o.emoji)) fail(`${w}: emoji 하나 (Emoji 13 이하) → ${o.emoji}`)
  if (!LAO.test(o.ex ?? '') || HANGUL.test(o.ex ?? '')) fail(`${w}: ex 는 라오어 문장`)
  if (!(o.ex ?? '').includes(w)) fail(`${w}: ex 에 단어가 그대로 들어가야 함 → ${o.ex}`)
  if ((o.ex ?? '').length > 45) fail(`${w}: ex 너무 김 (${o.ex.length}자, 45자까지)`)
  if (!HANGUL.test(o.exKo ?? '') || !/[.?!]$/.test(o.exKo ?? '')) fail(`${w}: exKo 는 한국어 번역 문장 (마침표로 끝)`)
}
for (const k of Object.keys(out)) if (!input.some((r) => r.w === k)) fail(`${k}: 입력에 없는 단어`)
const skipped = Object.values(out).filter((o) => o.skip).length
if (bad) {
  console.error(`\n${bad}개 문제`)
  process.exit(1)
}
console.log(`✓ ${Object.keys(out).length}개 (건너뜀 ${skipped})`)
