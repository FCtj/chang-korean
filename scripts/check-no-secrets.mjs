// 빌드 결과에 비밀 키가 들어가지 않았는지 검사 (들어 있으면 빌드 실패 → 배포 안 됨)
// 사용: node scripts/check-no-secrets.mjs dist dist-web
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dirs = process.argv.slice(2)
const bad = []
const walk = (p) => {
  if (statSync(p).isDirectory()) return readdirSync(p).forEach((f) => walk(join(p, f)))
  if (!/\.(html|js|css|json|txt|map)$/.test(p)) return
  const s = readFileSync(p, 'utf8')
  if (/sb_secret_[A-Za-z0-9_-]{6,}/.test(s)) bad.push(`${p}: sb_secret_ 키`)
  for (const m of s.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(m[1], 'base64url').toString()).role === 'service_role') bad.push(`${p}: service_role 키`)
    } catch {
      /* JWT 아님 */
    }
  }
}
for (const d of dirs) walk(d)
if (bad.length) {
  console.error('✗ 빌드 결과에 비밀 키가 있습니다. 배포하지 마세요:\n  ' + bad.join('\n  '))
  process.exit(1)
}
console.log(`✓ 비밀 키 없음 (${dirs.join(', ')})`)
