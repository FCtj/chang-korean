// 일본어판·영어판 빌드 (npm run build:editions) → dist-web/ja · dist-web/en
// 단어 레벨 파일이 들어온 판만 빌드함 (아직 비어 있는 판은 건너뜀)
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const FIRST = { ja: 'src/data/ja/n5.ts', en: 'src/data/en/toeic-450.ts' }
let built = 0
for (const [ed, file] of Object.entries(FIRST)) {
  if (!existsSync(file)) {
    console.log(`– ${ed}: 단어 데이터 없음 → 건너뜀`)
    continue
  }
  execSync('npx vite build --mode single', { stdio: 'inherit', env: { ...process.env, VITE_EDITION: ed } })
  execSync(`node scripts/make-standalone.mjs ${ed}`, { stdio: 'inherit' })
  built++
}
if (built) execSync('node scripts/check-no-secrets.mjs dist-web', { stdio: 'inherit' })
