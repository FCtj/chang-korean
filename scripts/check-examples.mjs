// 단어 예문 검사
// 사용: node scripts/check-examples.mjs src/data/ex-basic-1.ts <단어목록.tsv>   → 한 파일 + 목록의 모든 단어가 있는지
//       node scripts/check-examples.mjs                                         → src/data/ex-*.ts 전체 형식 검사
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve, join } from 'node:path'

let errors = 0
const fail = (m) => {
  errors++
  console.error('✗ ' + m)
}
function checkMap(name, map) {
  for (const [ko, e] of Object.entries(map)) {
    for (const k of ['ex', 'rom', 'lo', 'th', 'vi']) if (typeof e?.[k] !== 'string' || !e[k].trim()) fail(`${name}: "${ko}" ${k} 비어 있음`)
    if (e.rom && /[가-힣]/.test(e.rom)) fail(`${name}: "${ko}" 로마자에 한글`)
    if (e.ex && !/[가-힣]/.test(e.ex)) fail(`${name}: "${ko}" 예문에 한글이 없음`)
    if (e.ex && e.ex.length > 70) fail(`${name}: "${ko}" 예문이 너무 김 (${e.ex.length}자)`)
    if (e.tip) for (const k of ['lo', 'th', 'vi']) if (!e.tip[k]?.trim()) fail(`${name}: "${ko}" tip.${k} 비어 있음`)
    // 몽골어(선택): 있으면 키릴 문자, 한글 없음. 몽골어가 있으면 팁에도 몽골어
    for (const [k, v] of [['mn', e.mn], ['tip.mn', e.tip?.mn]]) if (v !== undefined && (!/[\u0400-\u04FF]/.test(v) || /[가-힣]/.test(v))) fail(`${name}: "${ko}" ${k} 는 몽골어(키릴 문자)로`)
    if (e.mn && e.tip && !e.tip.mn) fail(`${name}: "${ko}" tip.mn 없음`)
  }
  return Object.keys(map).length
}
const [file, list] = process.argv.slice(2)
if (file) {
  const mod = await import(pathToFileURL(resolve(file)).href)
  const map = Object.values(mod).find((v) => v && typeof v === 'object' && !Array.isArray(v))
  const n = checkMap(file, map ?? {})
  if (list) {
    const words = readFileSync(list, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t')[0])
    for (const w of words) if (!map?.[w]) fail(`${file}: "${w}" 예문 없음`)
    for (const k of Object.keys(map ?? {})) if (!words.includes(k)) fail(`${file}: 목록에 없는 단어 "${k}"`)
  }
  if (errors) {
    console.error(`\n${errors}개 문제`)
    process.exit(1)
  }
  console.log(`✓ ${file}: 예문 ${n}개`)
} else {
  const dir = resolve('src/data')
  let total = 0
  for (const f of readdirSync(dir).filter((f) => /^ex-.*\.ts$/.test(f))) {
    const mod = await import(pathToFileURL(join(dir, f)).href)
    const map = Object.values(mod).find((v) => v && typeof v === 'object' && !Array.isArray(v))
    total += checkMap(f, map ?? {})
  }
  if (errors) {
    console.error(`\n${errors}개 문제`)
    process.exit(1)
  }
  console.log(`✓ 예문 정상: ${total}개`)
}
