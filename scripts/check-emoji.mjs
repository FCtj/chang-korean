// 단어 그림 검사 (npm test): Emoji 14 이후(2021~) 그림은 안드로이드 12 이하 · iOS 15.3 이하에서
// 빈 네모(□)로 보이므로 쓰지 않음. 오래된 폰을 쓰는 학습자가 많아서.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Emoji 14.0 · 15.0 · 15.1 · 16.0 에서 새로 생긴 그림 (+ 연령 제한 🔞 은 단어 그림으로 쓰지 않음)
const BANNED = [
  ...'🫠🫢🫣🫡🫥🫤🥹🫱🫲🫳🫴🫰🫵🫶🪸🪷🪹🪺🫘🫗🫙🛝🛞🛟🪬🪩🪫🩼🩻🫧🪪🟰', // 14.0
  ...'🫨🩷🩵🩶🫏🪿🫎🪼🪽🪮🪭🫚🫛🪯🛜🪇🪈', // 15.0
  ...'🫩🫆🪾🫜🪉🪏🫟', // 16.0
  '🔞',
]
const banned = new Set(BANNED)

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })
}

let bad = 0
for (const f of walk('src/data')) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const hits = [...line].filter((ch) => banned.has(ch))
      if (hits.length) {
        bad++
        console.log(`✗ ${f}:${i + 1} ${[...new Set(hits)].join(' ')} → ${line.trim().slice(0, 70)}`)
      }
    })
}
if (bad) {
  console.log(`\n${bad}줄: 오래된 폰에서 안 보이는 그림 (Emoji 14 이후). 예전부터 있던 그림으로 바꿔 주세요.`)
  process.exit(1)
}
console.log('✓ 그림: 오래된 폰에서도 보이는 그림만 씀 (Emoji 13 이하)')
