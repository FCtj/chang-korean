// 일본어판(JLPT)·영어판(TOEIC) 단어 검사 (npm test)
// 레벨 파일마다 형식·개수·중복을 보고, 아래 레벨에 있는 말이 위 레벨에 또 나오지 않는지 확인
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const SETS = {
  ja: ['n5', 'n4', 'n3', 'n2', 'n1'],
  en: ['450', '600', '700', '800', '900'],
}
let failed = false
for (const [lang, levels] of Object.entries(SETS)) {
  const files = levels.map((l) => `src/data/${lang}/${lang === 'ja' ? l : `toeic-${l}`}.ts`).filter((f) => existsSync(f))
  if (!files.length) continue
  files.forEach((f, i) => {
    try {
      execFileSync('node', ['scripts/check-edition.mjs', lang, f, ...files.slice(0, i)], { stdio: ['ignore', 'inherit', 'pipe'] })
    } catch (e) {
      failed = true
      process.stderr.write(String(e.stderr ?? e.message))
    }
  })
}
if (failed) process.exit(1)
