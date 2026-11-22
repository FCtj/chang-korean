// 일본어판(JLPT)·영어판(TOEIC) 단어 검사 (npm test)
// 레벨 파일마다 형식·개수·중복을 보고, 아래 레벨에 있는 말이 위 레벨에 또 나오지 않는지 확인
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// 시험 코스 · 생활 코스는 따로 검사 (두 코스 사이에는 같은 단어가 있어도 됨)
const SETS = [
  ['ja', ['n5', 'n4', 'n3', 'n2', 'n1']],
  ['en', ['toeic-450', 'toeic-600', 'toeic-700', 'toeic-800', 'toeic-900']],
  ['ja', ['daily-1', 'daily-2', 'daily-3']],
  ['en', ['daily-a1', 'daily-a2', 'daily-b1']],
  ['lo', ['level-1', 'freq-1', 'level-2', 'freq-2', 'level-3']],
  ['lo', ['daily-1', 'daily-2', 'daily-3']],
]
let failed = false
for (const [lang, levels] of SETS) {
  const files = levels.map((l) => `src/data/${lang}/${l}.ts`).filter((f) => existsSync(f))
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
